import { describe, expect, it } from "vitest";
import { choosePins, placePins, type Anchor } from "./pinLayout";

const R = 13;
const GAP = 4;
const opts = (width: number, height: number) => ({ width, height, radius: R, gap: GAP });

function expectNoOverlaps(placed: ReturnType<typeof placePins>) {
  const shown = placed.filter((p) => p.visible);
  for (let i = 0; i < shown.length; i++)
    for (let j = i + 1; j < shown.length; j++)
      expect(Math.hypot(shown[i]!.x - shown[j]!.x, shown[i]!.y - shown[j]!.y), `pins ${i} and ${j}`).toBeGreaterThanOrEqual(2 * R + GAP - 1e-6);
}

describe("placePins", () => {
  it("keeps pins on their anchors when there is room", () => {
    const placed = placePins(
      [
        { x: 100, y: 100, visible: true },
        { x: 200, y: 100, visible: true },
      ],
      opts(400, 300),
    );
    expect(placed).toEqual([
      { x: 100, y: 100, visible: true, moved: false },
      { x: 200, y: 100, visible: true, moved: false },
    ]);
  });

  it("spreads pins that pile up on one spot, so none overlap, and marks them for a leader line", () => {
    const pile: Anchor[] = Array.from({ length: 10 }, () => ({ x: 160, y: 140, visible: true }));
    const placed = placePins(pile, opts(320, 280));
    expect(placed.every((p) => p.visible)).toBe(true);
    expect(placed[0]!.moved).toBe(false);
    expect(placed.slice(1).every((p) => p.moved)).toBe(true);
    expectNoOverlaps(placed);
  });

  it("stays inside a phone-sized view and out of avoided areas", () => {
    const anchors: Anchor[] = Array.from({ length: 12 }, (_, i) => ({ x: 5 + i * 3, y: 4 + i * 2, visible: true }));
    const avoid = [{ x: 0, y: 0, w: 140, h: 40 }];
    const placed = placePins(anchors, { ...opts(328, 320), avoid });
    for (const p of placed) {
      expect(p.visible).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(R);
      expect(p.x).toBeLessThanOrEqual(328 - R);
      expect(p.y).toBeGreaterThanOrEqual(R);
      expect(p.y).toBeLessThanOrEqual(320 - R);
      const inAvoid = p.x + R > 0 && p.x - R < 140 && p.y + R > 0 && p.y - R < 40;
      expect(inAvoid).toBe(false);
    }
    expectNoOverlaps(placed);
  });

  it("hides pins whose point is behind the camera", () => {
    const placed = placePins([{ x: 50, y: 50, visible: false }], opts(200, 200));
    expect(placed[0]!.visible).toBe(false);
  });
});

describe("choosePins", () => {
  const labels = [
    { id: "f1", kind: "furniture", status: "medium" as const },
    { id: "i1", kind: "issue", status: "medium" as const },
    { id: "f2", kind: "furniture", status: "high" as const },
    { id: "i2", kind: "issue", status: "high" as const },
    { id: "i3", kind: "issue", status: "done" as const },
  ];

  it("keeps all labels when there is no limit or they fit", () => {
    expect(choosePins(labels)).toEqual(labels);
    expect(choosePins(labels, 9)).toEqual(labels);
  });

  it("keeps issues first, by priority, in their original order", () => {
    expect(choosePins(labels, 3).map((l) => l.id)).toEqual(["i1", "i2", "i3"]);
    expect(choosePins(labels, 4).map((l) => l.id)).toEqual(["i1", "f2", "i2", "i3"]);
  });
});
