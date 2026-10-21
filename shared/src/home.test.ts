import { describe, expect, it } from "vitest";
import { HomeLayoutSchema, applyLayout, generateRooms, legacyLayout, roomTypeOf, spaceOf, type HomeLayout } from "./home";
import { concernsFor, generatePlan, type HomeProfile } from "./planner";

const layout = (l: Partial<HomeLayout> & Pick<HomeLayout, "homeType">) => HomeLayoutSchema.parse(l);
const labels = (l: HomeLayout) => generateRooms(l).map((s) => s.label);
const roomIds = (l: HomeLayout) => generateRooms(l).map((s) => s.id);

describe("generateRooms — home types", () => {
  it("Studio / 1RK: one main room for living + sleeping, kitchen, bathroom, entrance", () => {
    expect(labels(layout({ homeType: "studio" }))).toEqual([
      "Entrance",
      "Main room (living + sleeping)",
      "Kitchen",
      "Bathroom",
    ]);
    const main = generateRooms(layout({ homeType: "studio" }))[1]!;
    expect(main).toMatchObject({ id: "living_room", type: "living_room", merged: ["bedroom"] });
  });

  it("Studio with an open kitchen and the door into the main room → kitchenette, no separate entrance", () => {
    expect(labels(layout({ homeType: "studio", openKitchen: true, doorIntoLiving: true }))).toEqual([
      "Main room (living + sleeping + entrance + kitchenette)",
      "Bathroom",
    ]);
  });

  it("1BHK: living room, bedroom, kitchen, bathroom, plus entrance when the door doesn't open into the living room", () => {
    expect(labels(layout({ homeType: "1bhk" }))).toEqual(["Entrance", "Living room", "Bedroom", "Kitchen", "Bathroom"]);
    expect(labels(layout({ homeType: "1bhk", doorIntoLiving: true }))).toEqual([
      "Living room + entrance",
      "Bedroom",
      "Kitchen",
      "Bathroom",
    ]);
  });

  it("2BHK: numbered bedrooms and the selected number of bathrooms", () => {
    expect(roomIds(layout({ homeType: "2bhk", bathrooms: 2 }))).toEqual([
      "entrance",
      "living_room",
      "bedroom",
      "bedroom_2",
      "kitchen",
      "bathroom",
      "bathroom_2",
    ]);
    expect(labels(layout({ homeType: "2bhk", bathrooms: 2 }))).toContain("Bedroom 2");
    expect(labels(layout({ homeType: "2bhk", bathrooms: 2 }))).toContain("Bathroom 2");
  });

  it("3BHK: three bedrooms, up to three bathrooms", () => {
    const l = layout({ homeType: "3bhk", bathrooms: 3 });
    expect(roomIds(l).filter((id) => roomTypeOf(id) === "bedroom")).toEqual(["bedroom", "bedroom_2", "bedroom_3"]);
    expect(roomIds(l).filter((id) => roomTypeOf(id) === "bathroom")).toEqual(["bathroom", "bathroom_2", "bathroom_3"]);
  });

  it("Custom: exactly the rooms picked, in a stable order, ignoring duplicates and unknown ids", () => {
    const l = layout({ homeType: "custom", customRooms: ["balcony", "bedroom_2", "kitchen", "bedroom", "kitchen"] });
    expect(labels(l)).toEqual(["Bedroom 1", "Bedroom 2", "Kitchen", "Balcony"]);
    expect(HomeLayoutSchema.safeParse({ homeType: "custom", customRooms: ["attic"] }).success).toBe(false);
  });
});

describe("generateRooms — merge and extra options", () => {
  it("open kitchen merges the kitchen into the living room", () => {
    const spaces = generateRooms(layout({ homeType: "1bhk", openKitchen: true }));
    expect(spaces.map((s) => s.id)).not.toContain("kitchen");
    expect(spaces.find((s) => s.id === "living_room")).toMatchObject({ label: "Living room + open kitchen", merged: ["kitchen"] });
  });

  it("both merges at once", () => {
    expect(labels(layout({ homeType: "2bhk", doorIntoLiving: true, openKitchen: true }))[0]).toBe(
      "Living room + entrance + open kitchen",
    );
  });

  it("attached bathroom is labelled; ignored for a studio (no bedroom) and for custom", () => {
    expect(labels(layout({ homeType: "1bhk", attachedBathroom: true }))).toContain("Bathroom (attached to bedroom)");
    expect(labels(layout({ homeType: "2bhk", bathrooms: 2, attachedBathroom: true }))).toContain(
      "Bathroom 1 (attached to Bedroom 1)",
    );
    expect(labels(layout({ homeType: "studio", attachedBathroom: true }))).toContain("Bathroom");
    expect(labels(layout({ homeType: "studio", attachedBathroom: true })).join()).not.toMatch(/attached/);
  });

  it("balcony is added only when asked", () => {
    expect(roomIds(layout({ homeType: "1bhk" }))).not.toContain("balcony");
    expect(roomIds(layout({ homeType: "1bhk", balcony: true })).at(-1)).toBe("balcony");
  });

  it("custom homes merge only when both rooms are present", () => {
    expect(labels(layout({ homeType: "custom", doorIntoLiving: true, customRooms: ["entrance", "living_room"] }))).toEqual([
      "Living room + entrance",
    ]);
    expect(labels(layout({ homeType: "custom", doorIntoLiving: true, customRooms: ["entrance", "kitchen"] }))).toEqual([
      "Entrance",
      "Kitchen",
    ]);
  });
});

describe("plans with layouts", () => {
  const base: HomeProfile = { aids: [], rooms: [], concerns: {}, notes: "" };

  it("old plans without a layout open as a Custom home with exactly their rooms", () => {
    const old: HomeProfile = { ...base, rooms: ["bathroom", "living_room"], concerns: { bathroom: ["slippery_floor"] } };
    expect(legacyLayout(old.rooms).homeType).toBe("custom");
    expect(spaceOf(old, "bathroom").label).toBe("Bathroom");
    expect(generatePlan(old).map((i) => i.id)).toContain("bathroom:slippery_floor:non-slip"); // ids unchanged
  });

  it("a merged space gets the concerns of every room it covers", () => {
    const p: HomeProfile = { ...base, layout: layout({ homeType: "1bhk", doorIntoLiving: true, openKitchen: true }), rooms: ["living_room"] };
    const applicable = concernsFor(spaceOf(p, "living_room"));
    expect(applicable).toContain("entry_step"); // from the entrance
    expect(applicable).toContain("slippery_floor"); // from the kitchen
    const plan = generatePlan({ ...p, concerns: { living_room: ["entry_step"] } });
    expect(plan.some((i) => i.room === "living_room" && i.concern === "entry_step")).toBe(true);
  });

  it("a second bedroom gets its own checklist items", () => {
    const p: HomeProfile = {
      ...base,
      layout: layout({ homeType: "2bhk" }),
      rooms: ["bedroom", "bedroom_2"],
      concerns: { bedroom: ["clutter"], bedroom_2: ["clutter"] },
    };
    const rooms = new Set(generatePlan(p).map((i) => i.room));
    expect(rooms).toEqual(new Set(["bedroom", "bedroom_2"]));
  });

  it("editing the layout keeps what still applies and moves merged rooms' observations", () => {
    const before: HomeProfile = {
      ...base,
      layout: layout({ homeType: "1bhk" }),
      rooms: ["entrance", "living_room", "bedroom"],
      concerns: { entrance: ["entry_step"], bedroom: ["clutter"] },
    };
    const { profile, done } = applyLayout(before, ["entrance:entry_step:clear-step-area", "bedroom:clutter:remove-clutter"], {
      ...before.layout!,
      doorIntoLiving: true,
    });
    expect(profile.rooms).toEqual(["living_room", "bedroom"]);
    expect(profile.concerns).toEqual({ living_room: ["entry_step"], bedroom: ["clutter"] });
    expect(done).toEqual(["living_room:entry_step:clear-step-area", "bedroom:clutter:remove-clutter"]);

    // Switching to a studio: the bedroom becomes part of the main room (with its observations).
    const studio = applyLayout({ ...before, rooms: ["bedroom", "kitchen"] }, [], layout({ homeType: "studio" }));
    expect(studio.profile.rooms).toEqual(["living_room", "kitchen"]);
    expect(studio.profile.concerns.living_room).toEqual(["clutter"]);

    // Switching to a smaller home drops rooms that no longer exist, keeps the rest.
    const smaller = applyLayout(
      { ...before, layout: layout({ homeType: "2bhk" }), rooms: ["bedroom_2", "kitchen"] },
      [],
      layout({ homeType: "1bhk" }),
    );
    expect(smaller.profile.rooms).toEqual(["kitchen"]);
  });
});
