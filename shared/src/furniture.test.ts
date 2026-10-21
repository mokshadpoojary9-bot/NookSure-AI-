import { describe, expect, it } from "vitest";
import { FURNITURE_BY_ROOM, furnitureChoicesFor } from "./furniture";
import { HomeLayoutSchema, applyLayout, generateRooms } from "./home";
import { FURNITURE_SUGGESTIONS, KIND_ORDER, generatePlan, type HomeProfile } from "./planner";

const base: HomeProfile = { aids: [], rooms: [], concerns: {}, notes: "" };
const withFurniture = (p: Partial<HomeProfile>, furniture: HomeProfile["furniture"]): HomeProfile => ({ ...base, ...p, furniture });
const keys = (p: HomeProfile) => generatePlan(p).map((i) => i.id.split(":")[2]);

describe("furniture choices", () => {
  it("asks the listed items per room", () => {
    expect(FURNITURE_BY_ROOM.bathroom).toContain("toilet_indian");
    expect(FURNITURE_BY_ROOM.entrance).toEqual(["shoe_rack", "door_mat", "cabinet"]);
  });

  it("a merged space asks about every part, without repeats", () => {
    const studio = generateRooms(HomeLayoutSchema.parse({ homeType: "studio", doorIntoLiving: true }));
    const main = studio.find((s) => s.id === "living_room")!;
    const choices = furnitureChoicesFor(main);
    expect(choices).toEqual(expect.arrayContaining(["sofa", "bed", "shoe_rack"]));
    expect(choices.filter((c) => c === "rug")).toHaveLength(1); // living + bedroom both list "rug"
  });
});

describe("furniture-aware plan", () => {
  it("adds advice about the user's own furniture only when they have it and flagged the issue", () => {
    const p = { rooms: ["living_room"], concerns: { living_room: ["narrow_path" as const] } };
    expect(keys({ ...base, ...p })).not.toContain("f-sofa");
    expect(keys(withFurniture(p, { living_room: { items: ["sofa"], other: "", skipped: false } }))).toContain("f-sofa");
    // Having a sofa without the narrow-path issue adds nothing.
    expect(keys(withFurniture({ rooms: ["living_room"], concerns: { living_room: ["clutter"] } }, { living_room: { items: ["sofa"], other: "", skipped: false } }))).not.toContain("f-sofa");
  });

  it("replaces the generic suggestion with one about their own item", () => {
    const p = { rooms: ["living_room"], concerns: { living_room: ["poor_lighting" as const] } };
    expect(keys({ ...base, ...p })).toContain("reuse-lamps");
    const own = keys(withFurniture(p, { living_room: { items: ["floor_lamp"], other: "", skipped: false } }));
    expect(own).toContain("f-floor-lamp");
    expect(own).not.toContain("reuse-lamps");
  });

  it("marks furniture items and keeps the reuse → rearrange → remove → purchase order", () => {
    const plan = generatePlan(
      withFurniture(
        { rooms: ["bathroom"], concerns: { bathroom: ["slippery_floor", "no_support_rail"] } },
        { bathroom: { items: ["stool", "bath_mat", "towel_rail", "bucket_mug"], other: "", skipped: false } },
      ),
    );
    const ranks = plan.map((i) => KIND_ORDER.indexOf(i.kind));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(plan.find((i) => i.id.endsWith("f-stool"))).toMatchObject({ furniture: "stool", kind: "rearrange" });
  });

  it("never suggests an ordinary stool as a shower seat — points to a purpose-made shower chair", () => {
    const plan = generatePlan(
      withFurniture({ rooms: ["bathroom"], concerns: { bathroom: ["slippery_floor"] } }, { bathroom: { items: ["stool"], other: "", skipped: false } }),
    );
    const stool = plan.find((i) => i.id.endsWith("f-stool"))!;
    expect(stool.detail).toMatch(/Don't use it to sit on while showering/);
    expect(plan.find((i) => i.id.endsWith("f-shower-chair"))).toMatchObject({ kind: "purchase", seekProfessional: true });
  });

  it("existing plans without furniture produce exactly the same items as before", () => {
    const p: HomeProfile = { ...base, rooms: ["bathroom", "living_room"], concerns: { bathroom: ["slippery_floor"], living_room: ["loose_rugs"] } };
    // Same ids and order as before furniture existed (sorted reuse → rearrange → remove → purchase).
    expect(keys(p)).toEqual(["rearrange-toiletries", "remove-slip-mats", "remove-rugs", "non-slip"]);
  });
});

describe("furniture suggestion safety", () => {
  const all = Object.values(FURNITURE_SUGGESTIONS).flat();
  it("never offers furniture as support, a step, a ramp or a wet-area seat", () => {
    for (const s of all) {
      // Ignore warnings ("Don't lean on it for support") — those are the safe message.
      const text = `${s.title}. ${s.detail}`.toLowerCase().replace(/\b(don't|do not|never)\b[^.]*\./g, "");
      expect(text, s.key).not.toMatch(/\b(use|hold|grab|lean on)\b[^.]*\b(as|for) (a )?(grab bar|handrail|support|step|ramp)\b/);
      expect(text, s.key).not.toMatch(/certified|fully accessible|guaranteed/);
    }
  });
  it("every towel rail / basin note warns it is not support", () => {
    for (const s of all.filter((x) => x.requires === "towel_rail" || x.requires === "washbasin")) {
      expect(s.safetyNote, s.key).toMatch(/Never use towel rails/);
    }
  });
});

describe("layout edits keep furniture answers", () => {
  it("moves the entrance's furniture into the living room when they merge", () => {
    const layout = HomeLayoutSchema.parse({ homeType: "1bhk" });
    const p = withFurniture(
      { layout, rooms: ["entrance", "living_room"] },
      {
        entrance: { items: ["shoe_rack"], other: "umbrella stand", skipped: false },
        living_room: { items: ["sofa"], other: "", skipped: false },
      },
    );
    const { profile } = applyLayout(p, [], { ...layout, doorIntoLiving: true });
    expect(profile.furniture).toEqual({ living_room: { items: ["sofa", "shoe_rack"], other: "umbrella stand", skipped: false } });
  });
});
