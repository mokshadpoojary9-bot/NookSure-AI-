import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { HomeLayoutSchema, KIND_ORDER, SAFETY_PRINCIPLES, generatePlan } from "@nooksure/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "./server";
import type { PlanResult } from "./tools";

let client: Client;

beforeEach(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverSide);
  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientSide);
});
afterEach(async () => {
  await client.close();
});

const texts = (r: Awaited<ReturnType<Client["callTool"]>>) => (r.content as { type: string; text: string }[]).map((c) => c.text);
const call = async (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });
const planOf = async (args: Record<string, unknown>) => {
  const r = await call("build_home_safety_plan", args);
  expect(r.isError, texts(r).join("\n")).toBeFalsy();
  return { plan: JSON.parse(texts(r)[1]!) as PlanResult, text: texts(r)[0]! };
};

const EXAMPLE = {
  homeType: "1bhk",
  doorIntoLiving: true,
  openKitchen: true,
  garden: true,
  mobilityAids: ["walker"],
  rooms: ["living_room", "bathroom", "garden"],
  furniture: { living_room: ["sofa", "rug", "floor_lamp"], bathroom: ["towel_rail", "stool"] },
  observations: {
    living_room: ["loose_rugs", "poor_lighting", "narrow_path", "slippery_floor"],
    bathroom: ["no_support_rail", "slippery_floor"],
    garden: ["steps_no_railing", "uneven_ground"],
  },
};

describe("NookSure MCP server", () => {
  it("offers exactly the three read-only tools, with input schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["build_home_safety_plan", "get_safety_principles", "list_options"]);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(t.inputSchema.type).toBe("object");
    }
    const build = tools.find((t) => t.name === "build_home_safety_plan")!;
    expect(Object.keys(build.inputSchema.properties ?? {})).toEqual(
      expect.arrayContaining(["homeType", "doorIntoLiving", "openKitchen", "garden", "mobilityAids", "rooms", "furniture", "observations"]),
    );
  });
});

describe("build_home_safety_plan", () => {
  it("returns the same ordered plan the web app produces for the same answers", async () => {
    const { plan } = await planOf(EXAMPLE);
    // What the web app's planner does with these answers.
    const webApp = generatePlan({
      aids: ["walker"],
      notes: "",
      layout: HomeLayoutSchema.parse({ homeType: "1bhk", doorIntoLiving: true, openKitchen: true, garden: true }),
      rooms: EXAMPLE.rooms,
      concerns: EXAMPLE.observations as never,
      furniture: Object.fromEntries(Object.entries(EXAMPLE.furniture).map(([r, items]) => [r, { items, other: "", skipped: false }])) as never,
    });
    expect(webApp.length).toBeGreaterThan(5);
    expect(plan.steps.map((s) => [s.roomId, s.kind, s.title, s.detail])).toEqual(webApp.map((i) => [i.room, i.kind, i.title, i.detail]));
    expect(plan.steps.map((s) => s.step)).toEqual(webApp.map((_, i) => i + 1));
    // Reuse → Rearrange → Remove → Purchase.
    const ranks = plan.steps.map((s) => KIND_ORDER.indexOf(s.kind));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(plan.order).toEqual(["Reuse", "Rearrange", "Remove", "Purchase"]);
    // Merged rooms keep their real names, and advice about the person's own furniture is marked.
    expect(plan.home.rooms[0]).toEqual({ id: "living_room", label: "Living room + entrance + open kitchen" });
    expect(plan.steps.some((s) => s.aboutYourFurniture === "Rug")).toBe(true);
  });

  it("keeps every safety rule: professional installation, no improvised supports, honest labelling", async () => {
    const { plan, text } = await planOf(EXAMPLE);
    expect(plan.source).toBe("rule-based");
    expect(plan.disclaimer).toMatch(/not AI analysis/);
    expect(plan.disclaimer).toMatch(/not a safety certification/);
    expect(text).toContain(plan.disclaimer);
    // Grab bars and handrails are only ever "install by a professional" purchases.
    const fixtures = plan.steps.filter((s) => /grab bar|handrail/i.test(s.title));
    expect(fixtures.length).toBeGreaterThan(0);
    for (const s of fixtures) expect([s.kind, s.seekProfessional], s.title).toEqual(["purchase", true]);
    // The towel rail advice says not to lean on it, with the no-improvised-support note.
    const rail = plan.steps.find((s) => s.aboutYourFurniture === "Towel rail")!;
    expect(rail.title).toBe("Your towel rail: use it for towels only");
    expect(rail.safetyNote).toMatch(/Never use towel rails, sinks, furniture/);
    expect(JSON.stringify(plan)).not.toMatch(/certified safe|fully accessible/i);
  });

  it("plans every room of the home by default, and says when there is nothing to plan", async () => {
    const { plan, text } = await planOf({ homeType: "2bhk", balcony: true });
    expect(plan.home.rooms.map((r) => r.id)).toEqual(["entrance", "living_room", "bedroom", "bedroom_2", "kitchen", "bathroom", "balcony"]);
    expect(plan.steps).toEqual([]);
    expect(text).toMatch(/nothing to plan yet/);
  });

  it("reports input it had to ignore instead of silently dropping it", async () => {
    const { plan } = await planOf({
      homeType: "1bhk",
      rooms: ["bathroom"],
      observations: { bathroom: ["trailing_cables", "slippery_floor"] },
      furniture: { bathroom: ["sofa", "bath_mat"] },
    });
    expect(plan.ignored).toEqual(['Observation "trailing_cables" doesn\'t apply to Bathroom.', 'Furniture "sofa" isn\'t an option for Bathroom.']);
    expect(plan.steps.every((s) => s.roomId === "bathroom")).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it("rejects bad input with a message the agent can act on", async () => {
    const missingRoom = await call("build_home_safety_plan", { homeType: "1bhk", rooms: ["garden"] });
    expect(missingRoom.isError).toBe(true);
    expect(texts(missingRoom)[0]).toMatch(/"garden" isn't a room in this home\. This home's rooms: entrance \(Entrance\), living_room \(Living room\)/);

    const badEnum = await call("build_home_safety_plan", { homeType: "castle" });
    expect(badEnum.isError).toBe(true);
    expect(texts(badEnum)[0]).toMatch(/homeType/);

    const badObservation = await call("build_home_safety_plan", { homeType: "1bhk", observations: { living_room: ["haunted"] } });
    expect(badObservation.isError).toBe(true);

    const emptyCustom = await call("build_home_safety_plan", { homeType: "custom" });
    expect(emptyCustom.isError).toBe(true);
    expect(texts(emptyCustom)[0]).toMatch(/custom home needs customRooms/);
  });
});

describe("list_options", () => {
  it("lists every valid home type, room, mobility aid, furniture item and observation", async () => {
    const r = await call("list_options");
    const o = JSON.parse(texts(r)[0]!);
    expect(o.homeTypes.map((h: { id: string }) => h.id)).toEqual(["studio", "1bhk", "2bhk", "3bhk", "custom"]);
    expect(o.mobilityAids.map((a: { id: string }) => a.id)).toEqual(["wheelchair", "walker", "cane", "low_vision", "fall_risk"]);
    expect(o.roomTypes).toHaveLength(8);
    expect(o.observations).toHaveLength(15);
    expect(o.furnitureByRoomType.bathroom.map((f: { id: string }) => f.id)).toContain("towel_rail");
    expect(o.planOrder).toEqual(["Reuse", "Rearrange", "Remove", "Purchase"]);
    expect(o.home).toBeUndefined();
  });

  it("with a home type, lists that home's rooms and what applies to each", async () => {
    const r = await call("list_options", { homeType: "1bhk", openKitchen: true, garden: true });
    const { home } = JSON.parse(texts(r)[0]!);
    const living = home.rooms.find((x: { id: string }) => x.id === "living_room");
    expect(living.label).toBe("Living room + open kitchen");
    expect(living.furniture.map((f: { id: string }) => f.id)).toEqual(expect.arrayContaining(["sofa", "counter_stove"]));
    const garden = home.rooms.find((x: { id: string }) => x.id === "garden");
    expect(garden.observations.map((c: { id: string }) => c.id)).toContain("steps_no_railing");
  });
});

describe("get_safety_principles", () => {
  it("returns the app's safety rules", async () => {
    const r = await call("get_safety_principles");
    const p = JSON.parse(texts(r)[0]!);
    expect(p).toEqual(JSON.parse(JSON.stringify(SAFETY_PRINCIPLES)));
    expect(p.disclaimer).toMatch(/not a safety certification/);
    expect(p.neverRecommend.join(" ")).toMatch(/Stacked objects .* as ramps/);
    expect(p.neverRecommend.join(" ")).toMatch(/Improvised solutions for anything load-bearing/);
    expect(p.professionalInstallation.join(" ")).toMatch(/installed by a professional/);
  });
});
