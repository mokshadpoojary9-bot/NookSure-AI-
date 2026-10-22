import type { RoomType } from "@nooksure/shared";
import type { Box, Vec3 } from "./sceneModel";

/**
 * Decorative touches so rooms look lived-in. They never contradict the user's
 * furniture answers: small items only appear ON furniture that is present
 * (pillows on a sofa, a kettle on a counter), wall items (curtains, a picture,
 * a clock) imply no furniture, and anything that would collide with furniture
 * or a wall unit is left out. Gardens get planting and rocks, kept off the
 * path and away from where outdoor issue markers go.
 */

const FABRIC = "#c9b8a6";
const LEAF = "#5e8c61";
const STONE = "#7d7a70";
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
  const out: { decor: Box; anchor?: Box }[] = [];
  const add = (decor: Box, anchor?: Box) => out.push({ decor, anchor });

  if (type === "garden") {
    // Natural pieces at the edges: clear of the path (x -0.5..0.5) and of every outdoor issue spot.
    add(box("flower-bed", [2.35, 0.2, 2.2], [1.1, 0.4, 0.35], LEAF, { model: "flower-bed" }));
    add(box("rocks", [-2.3, 0.1, 2.15], [1.2, 0.2, 0.5], STONE, { model: "mossy-rocks" }));
    add(box("grass", [1.6, 0.05, -2.36], [1.3, 0.1, 0.1], LEAF, { model: "grass-tuft" }));
    add(box("wooden-bucket", [2.65, 0.175, -0.95], [0.35, 0.35, 0.35], "#a77b56", { model: "wooden-bucket" }));
  } else if (type !== "bathroom") {
    // Curtains either side of the back-wall window (every indoor room has it; not in bathrooms).
    add(box("curtain-l", [-0.32, 1.675, -2.43], [0.18, 1.25, 0.04], FABRIC, { support: "wall", radius: 0.02 }));
    add(box("curtain-r", [1.22, 1.675, -2.43], [0.18, 1.25, 0.04], FABRIC, { support: "wall", radius: 0.02 }));
  }

  if (type === "living_room") {
    add(box("picture", [-1.6, 1.75, -2.43], [0.75, 0.5, 0.04], "#ffffff", { model: "picture-frame", support: "wall" }));
    add(box("clock", [2.3, 1.95, -2.44], [0.32, 0.32, 0.05], "#ffffff", { model: "wall-clock", support: "wall" }));
    const sofa = find(furniture, ["sofa"], ["sofa"]);
    if (sofa) add(box("pillows", [sofa.position[0], 0.42 + 0.2, sofa.position[2] + 0.05], [0.9, 0.4, 0.42], FABRIC, { model: "throw-pillows" }), sofa);
    const table = find(furniture, ["coffee_table"], ["coffee-table"]);
    if (table) {
      add(onTop(table, "vase", 0.3, 0, [0.15, 0.3, 0.15], "#ffffff", { model: "vase" }), table);
      add(onTop(table, "laptop", -0.2, 0.02, [0.33, 0.28, 0.25], "#d8d4cc", { model: "laptop" }), table);
    }
    const shelves = find(furniture, ["shelves"], ["shelves"]);
    if (shelves) add(onTop(shelves, "books", 0, 0.25, [0.1, 0.15, 0.34], "#8b2e1f", { model: "books", rotationY: -QUARTER }), shelves);
  }
  if (type === "bedroom") {
    add(box("picture", [-1.3, 1.75, -2.43], [0.62, 0.48, 0.04], "#ffffff", { model: "fancy-frame", support: "wall" }));
    const side = find(furniture, ["side_tables"], ["nightstand"]);
    if (side) add(onTop(side, "alarm-clock", -0.16, 0.08, [0.13, 0.17, 0.07], "#4a7c6f", { model: "alarm-clock" }), side);
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
    // Only the full kitchen's long worktop has room for these.
    const worktop = find(furniture, [], ["worktop"]);
    if (worktop && worktop.size[0] > 3) {
      add(onTop(worktop, "microwave", -1.75, 0, [0.56, 0.3, 0.42], "#a6a6a6", { model: "microwave" }), worktop);
      add(onTop(worktop, "thermos", 0.3, 0.1, [0.15, 0.33, 0.12], "#2f6f9e", { model: "thermos" }), worktop);
    }
    // A pan and a pot on the hob, handles kept over the worktop (not sticking out over the edge).
    const hob = find(furniture, [], ["hob"]);
    if (hob) {
      add(onTop(hob, "pan", -0.14, -0.02, [0.2, 0.06, 0.45], "#b08d57", { model: "brass-pan" }), hob);
      add(onTop(hob, "brass-pot", 0.14, 0.05, [0.26, 0.25, 0.26], "#b08d57", { model: "brass-pot" }), hob);
    }
    const dining = find(furniture, ["dining_table"], ["dining-table"]);
    if (dining) {
      add(onTop(dining, "tea-set", -0.3, 0, [0.55, 0.1, 0.3], "#f1efea", { model: "tea-set" }), dining);
      add(onTop(dining, "pears", 0.4, 0, [0.13, 0.08, 0.17], "#b9b04a", { model: "pears" }), dining);
    }
  }
  if (type === "bathroom") {
    const toilet = find(furniture, ["toilet_western"], ["toilet"]);
    if (toilet) {
      add(box("paper-holder", [2.93, 0.65, toilet.position[2] + 0.55], [0.12, 0.16, 0.13], "#cccccc", { model: "toilet-paper-holder", rotationY: -QUARTER, support: "wall" }));
      // Tucked into the corner behind the toilet, out of the way.
      add(box("plunger", [2.55, 0.19, -2.3], [0.15, 0.38, 0.15], "#c0392b", { model: "plunger" }));
    }
    // Towels on the stool, or on a small wall shelf above the toilet.
    const stool = find(furniture, ["stool"], ["stool"]);
    if (stool) add(onTop(stool, "towels", 0, 0, [0.3, 0.16, 0.3], "#e8e2d6", { model: "towel-stack" }), stool);
    else if (toilet) {
      const shelf = box("towel-shelf", [toilet.position[0], 1.365, -2.3], [0.45, 0.03, 0.3], "#c9a27e", { support: "wall", radius: 0 });
      add(shelf);
      add(onTop(shelf, "towels", 0, 0, [0.3, 0.16, 0.3], "#e8e2d6", { model: "towel-stack" }), shelf);
    }
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
