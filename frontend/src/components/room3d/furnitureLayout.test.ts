import { describe, expect, it } from "vitest";
import { FURNITURE_BY_ROOM, type FurnitureItem, type RoomType } from "@nooksure/shared";
import { FRAMES, furnitureBoxes, type FurnitureBox } from "./furnitureLayout";
import { MODELS, ROOM_D, ROOM_W, WALL_H, fitModel } from "./sceneModel";

const EPS = 0.005;
const range = (b: FurnitureBox, i: number) => [b.position[i]! - b.size[i]! / 2, b.position[i]! + b.size[i]! / 2] as const;
const overlap = (a: FurnitureBox, b: FurnitureBox) =>
  [0, 2].every((i) => {
    const [a0, a1] = range(a, i);
    const [b0, b1] = range(b, i);
    return a0 < b1 - EPS && b0 < a1 - EPS;
  });

// Every item a layout can hold (the living room also holds merged rooms' items).
const allItems = (type: RoomType) => Object.keys(FRAMES[type] ?? {}) as FurnitureItem[];

describe("furniture layout", () => {
  for (const type of Object.keys(FRAMES) as RoomType[]) {
    describe(type, () => {
      const boxes = furnitureBoxes(type, allItems(type))!;

      it("places every item without floor items overlapping each other", () => {
        const floor = boxes.filter((b) => b.support === "floor");
        for (let i = 0; i < floor.length; i++)
          for (let j = i + 1; j < floor.length; j++)
            expect(overlap(floor[i]!, floor[j]!), `${floor[i]!.key} overlaps ${floor[j]!.key}`).toBe(false);
      });

      it("keeps everything inside the room, below the ceiling, on or above the floor", () => {
        for (const b of boxes) {
          const [x0, x1] = range(b, 0);
          const [y0, y1] = range(b, 1);
          const [z0, z1] = range(b, 2);
          expect(x0, `${b.key} x`).toBeGreaterThanOrEqual(-ROOM_W / 2 - 1e-9);
          expect(x1, `${b.key} x`).toBeLessThanOrEqual(ROOM_W / 2 + 1e-9);
          expect(z0, `${b.key} z`).toBeGreaterThanOrEqual(-ROOM_D / 2 - 1e-9);
          expect(z1, `${b.key} z`).toBeLessThanOrEqual(ROOM_D / 2 + 1e-9);
          expect(y0, `${b.key} floor`).toBeGreaterThanOrEqual(-1e-9);
          expect(y1, `${b.key} ceiling`).toBeLessThanOrEqual(WALL_H);
          if (b.support === "floor" || b.support === "flat") expect(y0, `${b.key} stands on floor`).toBeCloseTo(0, 6);
        }
      });

      it("keeps the doorway clear (left wall, z 0.7–1.7) except for a flat door mat", () => {
        const door = { position: [-2.6, 0.5, 1.2], size: [0.8, 1, 1.0] } as unknown as FurnitureBox;
        for (const b of boxes.filter((x) => x.support === "floor")) expect(overlap(b, door), `${b.key} blocks the door`).toBe(false);
      });

      it("uses verified models at a sensible scale", () => {
        for (const b of boxes.filter((x) => x.model)) {
          expect(MODELS[b.model!], b.model).toBeDefined();
          const s = fitModel(b, b.model!).scale;
          expect(s, `${b.key} scale`).toBeGreaterThan(0.5);
          expect(s, `${b.key} scale`).toBeLessThan(1.3);
        }
      });
    });
  }

  it("offers a slot for every furniture question of rooms that have a layout", () => {
    for (const type of Object.keys(FRAMES) as RoomType[])
      for (const item of FURNITURE_BY_ROOM[type] ?? []) expect(FRAMES[type]![item], `${type}/${item}`).toBeDefined();
  });

  it("shows only the chosen items, and gives a bedside lamp a stand when there's no side table", () => {
    const boxes = furnitureBoxes("bedroom", ["bed", "bedside_lamp"])!;
    expect(new Set(boxes.map((b) => b.item))).toEqual(new Set(["bed", "bedside_lamp"]));
    expect(boxes.map((b) => b.key)).toContain("lamp-stand");
    expect(furnitureBoxes("bedroom", ["bed", "side_tables", "bedside_lamp"])!.map((b) => b.key)).not.toContain("lamp-stand");
  });

  it("has no layout for rooms without furniture questions", () => {
    expect(furnitureBoxes("hallway_stairs", ["rug"])).toBeNull();
  });
});
