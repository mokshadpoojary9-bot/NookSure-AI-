import { describe, expect, it } from "vitest";
import { CONCERNS, HomeProfileSchema, KIND_ORDER, SUGGESTIONS, generatePlan, type HomeProfile } from "./planner";

const profile = (p: Partial<HomeProfile>): HomeProfile =>
  HomeProfileSchema.parse({ aids: [], rooms: [], concerns: {}, ...p });

describe("generatePlan", () => {
  it("orders items reuse → rearrange → remove → purchase", () => {
    const plan = generatePlan(
      profile({
        rooms: ["bathroom", "living_room"],
        concerns: { bathroom: ["no_support_rail", "slippery_floor"], living_room: ["clutter", "poor_lighting"] },
      }),
    );
    const ranks = plan.map((i) => KIND_ORDER.indexOf(i.kind));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(plan[0]?.kind).toBe("reuse");
    expect(plan.at(-1)?.kind).toBe("purchase");
  });

  it("returns an empty plan when nothing is observed", () => {
    expect(generatePlan(profile({ rooms: ["bedroom"] }))).toEqual([]);
  });

  it("ignores concerns for rooms that were not selected or do not apply", () => {
    const plan = generatePlan(
      profile({ rooms: ["bedroom"], concerns: { bedroom: ["slippery_floor"], kitchen: ["clutter"] } }),
    );
    expect(plan).toEqual([]);
  });

  it("includes aid-specific suggestions only for matching aids", () => {
    const base = { rooms: ["living_room" as const], concerns: { living_room: ["narrow_path" as const] } };
    const without = generatePlan(profile({ ...base, aids: ["cane"] }));
    const withChair = generatePlan(profile({ ...base, aids: ["wheelchair"] }));
    expect(without.some((i) => i.id.endsWith("turning-space"))).toBe(false);
    expect(withChair.some((i) => i.id.endsWith("turning-space"))).toBe(true);
  });

  it("routes ramps and support rails to professional, purpose-built purchases with warnings", () => {
    const plan = generatePlan(
      profile({ rooms: ["entrance"], concerns: { entrance: ["entry_step", "no_support_rail"] } }),
    );
    const ramp = plan.find((i) => i.id.endsWith("purpose-built-ramp"));
    const rail = plan.find((i) => i.id.endsWith("installed-support"));
    expect(ramp).toMatchObject({ kind: "purchase", seekProfessional: true });
    expect(ramp?.safetyNote).toMatch(/never build a ramp/i);
    expect(rail).toMatchObject({ kind: "purchase", seekProfessional: true });
    expect(rail?.safetyNote).toMatch(/never use towel rails/i);
  });
});

describe("suggestion catalog safety", () => {
  const all = Object.values(SUGGESTIONS).flat();
  const text = all.map((s) => `${s.title} ${s.detail}`.toLowerCase());

  it("never claims a home is certified or fully safe/accessible", () => {
    for (const t of text) expect(t).not.toMatch(/certified|fully accessible|guaranteed|100% safe/);
  });

  it("never offers an improvised support or ramp outside a purchase", () => {
    for (const s of all) {
      if (s.kind === "purchase") continue;
      expect(`${s.title} ${s.detail}`.toLowerCase()).not.toMatch(/\b(ramp|grab bar|handrail)\b.*\b(install|build|make)\b/);
    }
  });

  it("has suggestions for every concern", () => {
    for (const c of Object.keys(CONCERNS)) expect(SUGGESTIONS[c as keyof typeof SUGGESTIONS].length).toBeGreaterThan(0);
  });
});
