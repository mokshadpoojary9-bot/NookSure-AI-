import type { RoomType } from "@nooksure/shared";
import type { Box, Vec3 } from "./sceneModel";

/**
 * Decorative touches so rooms look lived-in. They never contradict the user's
 * furniture answers: small items only appear ON furniture that is present
 * (pillows on a sofa, a kettle on a counter), wall items (curtains, a picture,
 * a clock) imply no furniture, and anything that would collide with furniture
 * or a wall unit is left out.
 */

const FABRIC = "#c9b8a6";
const QUARTER = Math.PI / 2;

const box = (key: string, position: Vec3, size: Vec3, color: string, extra: Partial<Box> = {}): Box => ({
  key: `decor-${key}`,
  position,
  size,
  color,
  support: "top",
  ...extra,
});
const onTop = (anchor: Box, key: string, dx: number, dz: number, size: Vec3, color: string, extra: Partial<Box> = {}): Box =>
  box(key, [anchor.position[0] + dx, anchor.position[1] + anchor.size[1] / 2 + size[1] / 2, anchor.position[2] + dz], size, color, extra);

/** Furniture to sit decor on: a named surface first (e.g. a worktop), else the user's item. */
function find(furniture: readonly Box[], items: string[], keys: string[]): Box | undefined {
  return (
    furniture.find((b) => keys.includes(b.key)) ??
    furniture.find((b) => b.item !== undefined && items.includes(b.item) && b.support !== "top")
  );
}

function overlaps(a: Box, b: Box): boolean {
  return [0, 1, 2].every((i) => Math.abs(a.position[i]! - b.position[i]!) < (a.size[i]! + b.size[i]!) / 2 - 0.002);
}

export function decorFor(type: RoomType, furniture: readonly Box[]): Box[] {
  if (type === "garden") return [];
  const out: { decor: Box; anchor?: Box }[] = [];
  const add = (decor: Box, anchor?: Box) => out.push({ decor, anchor });

  // Curtains either side of the back-wall window (all indoor rooms have it).
  add(box("curtain-l", [-0.32, 1.675, -2.43], [0.18, 1.25, 0.04], FABRIC, { support: "wall", radius: 0.02 }));
  add(box("curtain-r", [1.22, 1.675, -2.43], [0.18, 1.25, 0.04], FABRIC, { support: "wall", radius: 0.02 }));

  if (type === "living_room") {
    add(box("picture", [-1.6, 1.75, -2.43], [0.75, 0.5, 0.04], "#ffffff", { model: "picture-frame", support: "wall" }));
    add(box("clock", [2.3, 1.95, -2.44], [0.32, 0.32, 0.05], "#ffffff", { model: "wall-clock", support: "wall" }));
    const sofa = find(furniture, ["sofa"], ["sofa"]);
    if (sofa) add(box("pillows", [sofa.position[0], 0.42 + 0.2, sofa.position[2] + 0.05], [0.9, 0.4, 0.42], FABRIC, { model: "throw-pillows" }), sofa);
    const table = find(furniture, ["coffee_table"], ["coffee-table"]);
    if (table) add(onTop(table, "vase", 0.25, 0, [0.15, 0.3, 0.15], "#ffffff", { model: "vase" }), table);
  }
  if (type === "bedroom") {
    add(box("picture", [-1.3, 1.75, -2.43], [0.75, 0.5, 0.04], "#ffffff", { model: "picture-frame", support: "wall" }));
    const side = find(furniture, ["side_tables"], ["nightstand"]);
    if (side) add(onTop(side, "alarm-clock", -0.12, 0.05, [0.13, 0.17, 0.07], "#4a7c6f", { model: "alarm-clock" }), side);
  }
  if (type === "kitchen") {
    add(box("clock", [-1.6, 1.95, -2.44], [0.32, 0.32, 0.05], "#ffffff", { model: "wall-clock", support: "wall" }));
    const counter = find(furniture, ["counter_stove"], ["worktop-back", "worktop"]);
    if (counter) {
      // Offsets fit both the long kitchen worktop and the shorter open-kitchen one, clear of the hob.
      add(onTop(counter, "kettle", -0.8, 0, [0.28, 0.27, 0.22], "#a6a6a6", { model: "kettle" }), counter);
      add(onTop(counter, "pot", -0.45, 0, [0.24, 0.17, 0.17], "#8b2e1f", { model: "pot" }), counter);
      add(onTop(counter, "cutting-board", -0.1, 0.05, [0.4, 0.04, 0.22], "#a77b56", { model: "cutting-board" }), counter);
    }
  }
  if (type === "bathroom") {
    const toilet = find(furniture, ["toilet_western"], ["toilet"]);
    if (toilet)
      add(box("paper-holder", [2.93, 0.65, toilet.position[2] + 0.55], [0.12, 0.16, 0.13], "#cccccc", { model: "toilet-paper-holder", rotationY: -QUARTER, support: "wall" }));
  }

  // Keep only decor that doesn't collide with furniture (other than what it sits on) or other decor.
  const kept: Box[] = [];
  for (const { decor, anchor } of out) {
    // Parts of the anchor (e.g. "sofa-cushion-1" for "sofa") may be touched too.
    const isAnchor = (f: Box) => f === anchor || (anchor !== undefined && f.key.startsWith(`${anchor.key}-`));
    const hits = furniture.some((f) => !isAnchor(f) && overlaps(decor, f)) || kept.some((k) => overlaps(decor, k));
    if (!hits) kept.push(decor);
  }
  return kept;
}
