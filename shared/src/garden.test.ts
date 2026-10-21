import { describe, expect, it } from "vitest";
import { furnitureChoicesFor } from "./furniture";
import { HomeLayoutSchema, generateRooms, spaceOf } from "./home";
import { CONCERNS, KIND_ORDER, SUGGESTIONS, concernsFor, generatePlan, type HomeProfile } from "./planner";

const layout = (l: object) => HomeLayoutSchema.parse({ homeType: "1bhk", ...l });
const garden = (extra: Partial<HomeProfile> = {}): HomeProfile => ({
  aids: [],
  layout: layout({ garden: true, gardenType: "terrace", gardenSteps: true }),
  rooms: ["garden"],
  concerns: {},
  notes: "",
  ...extra,
});

describe("garden in the home layout", () => {
  it("adds a labelled outdoor space only when the user has one", () => {
    expect(generateRooms(layout({})).map((s) => s.id)).not.toContain("garden");
    const spaces = generateRooms(layout({ garden: true, gardenType: "front_garden" }));
    expect(spaces.at(-1)).toMatchObject({ id: "garden", type: "garden", label: "Garden / Outdoor (Front garden)" });
  });

  it("works for every home type, including Custom", () => {
    for (const homeType of ["studio", "1bhk", "2bhk", "3bhk"] as const)
      expect(generateRooms(layout({ homeType, garden: true })).map((s) => s.id)).toContain("garden");
    expect(generateRooms(layout({ homeType: "custom", customRooms: ["kitchen"], garden: true })).map((s) => s.id)).toEqual([
      "kitchen",
      "garden",
    ]);
  });

  it("asks about outdoor furniture", () => {
    expect(furnitureChoicesFor(spaceOf(garden(), "garden"))).toEqual(["bench", "garden_chairs", "garden_table", "plant_pots", "garden_lights", "hose"]);
  });
});

describe("outdoor issues", () => {
  it("apply outdoors only; indoor-only issues don't apply to the garden", () => {
    const outdoor = concernsFor(spaceOf(garden(), "garden"));
    expect(outdoor).toEqual(
      expect.arrayContaining(["uneven_ground", "steps_no_railing", "slippery_outdoor", "loose_gravel", "low_branches", "path_clutter", "narrow_path", "poor_lighting"]),
    );
    expect(outdoor).not.toContain("loose_rugs");
    expect(outdoor).not.toContain("slippery_floor");
    expect(CONCERNS.uneven_ground.rooms).toEqual(["garden"]);
  });

  it("gives outdoor guidance in the reuse → rearrange → remove → purchase order", () => {
    const plan = generatePlan(
      garden({ concerns: { garden: ["uneven_ground", "steps_no_railing", "slippery_outdoor", "low_branches", "path_clutter", "poor_lighting"] } }),
    );
    const ranks = plan.map((i) => KIND_ORDER.indexOf(i.kind));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // Outdoor lighting advice instead of indoor plug-in night lights.
    const keys = plan.map((i) => i.id.split(":")[2]);
    expect(keys).toContain("outdoor-lights");
    expect(keys).not.toContain("night-lights");
    expect(keys).not.toContain("reuse-lamps");
  });

  it("handrails and ramps are always professional, purpose-built purchases with warnings", () => {
    const plan = generatePlan(garden({ concerns: { garden: ["steps_no_railing"] } }));
    const rail = plan.find((i) => i.id.endsWith("installed-handrail"))!;
    const ramp = plan.find((i) => i.id.endsWith("garden-ramp"))!;
    expect(rail).toMatchObject({ kind: "purchase", seekProfessional: true });
    expect(rail.safetyNote).toMatch(/Never use plant pots, garden furniture/);
    expect(ramp).toMatchObject({ kind: "purchase", seekProfessional: true });
    expect(ramp.safetyNote).toMatch(/Never build a ramp/);
    for (const s of [...SUGGESTIONS.steps_no_railing, ...SUGGESTIONS.uneven_ground]) {
      if (s.kind !== "purchase") expect(`${s.title} ${s.detail}`.toLowerCase(), s.key).not.toMatch(/\b(build|make) (a )?(ramp|handrail|rail)\b/);
    }
  });

  it("uses the user's garden furniture first", () => {
    const plan = generatePlan(
      garden({
        concerns: { garden: ["path_clutter", "poor_lighting"] },
        furniture: { garden: { items: ["hose", "garden_lights"], other: "", skipped: false } },
      }),
    );
    const keys = plan.map((i) => i.id.split(":")[2]);
    expect(keys).toEqual(expect.arrayContaining(["f-hose", "f-garden-lights"]));
    expect(keys).not.toContain("outdoor-lights"); // replaced by "Point your garden lights at the path"
  });
});
