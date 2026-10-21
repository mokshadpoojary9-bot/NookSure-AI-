import type { FurnitureItem, RoomType } from "@nooksure/shared";
import type { Box, Vec3 } from "./sceneModel";

/**
 * Where each piece of the user's furniture goes, per base room layout.
 * Fixed, illustrative positions (not measurements). Every slot is placed so that
 * all items of a layout can appear together without overlapping each other,
 * the walls or the door gap (left wall, z 0.7–1.7) — see furnitureLayout.test.ts.
 * The living-room layout also holds entrance, open-kitchen and studio-bedroom
 * items, because those rooms merge into the living room.
 */

/** floor: stands on the floor; top: sits on another piece; wall: hung on a wall; flat: rugs and mats. */
export type Support = "floor" | "top" | "wall" | "flat";

export interface FurnitureBox extends Box {
  item: FurnitureItem;
  support: Support;
}

const QUARTER = Math.PI / 2;
const WOOD = "#a77b56";
const WOOD_LIGHT = "#c9a27e";
const DARK = "#4a525c";
const WORKTOP = "#d9d4ca";
const CERAMIC = "#fbfaf7";
const GLASS = "#cfe3ea";
const FRIDGE = "#e9ecef";
const RUG = "#b9785f";
const MAT = "#8c7a6b";
const LAMP = "#f3e3b5";

type Extra = Partial<Omit<FurnitureBox, "key" | "position" | "size" | "color" | "item">>;
const make = (item: FurnitureItem, key: string, x: number, y0: number, z: number, size: Vec3, color: string, extra: Extra = {}): FurnitureBox => ({
  key,
  item,
  position: [x, y0 + size[1] / 2, z],
  size,
  color,
  support: "floor",
  radius: 0.03,
  ...extra,
});

type Frame = Partial<Record<FurnitureItem, FurnitureBox[]>>;

const lamp = (x: number, z: number, y0 = 0.55): FurnitureBox[] => [
  make("bedside_lamp", "bedside-lamp", x, y0, z, [0.2, 0.38, 0.28], DARK, { model: "table-lamp", support: "top" }),
];
const lampStand = (x: number, z: number): FurnitureBox =>
  make("bedside_lamp", "lamp-stand", x, 0, z, [0.4, 0.55, 0.4], WOOD_LIGHT);

const LIVING: Frame = {
  sofa: [make("sofa", "sofa", -0.3, 0, -2.05, [1.9, 0.85, 0.8], "#7d8fa6", { model: "sofa" })],
  armchair: [make("armchair", "armchair", 1.5, 0, -0.6, [0.75, 1.0, 0.82], "#7d8fa6", { model: "armchair", rotationY: -QUARTER })],
  coffee_table: [make("coffee_table", "coffee-table", -0.3, 0, -0.9, [1.1, 0.42, 0.55], WOOD, { model: "coffee-table", rotationY: QUARTER })],
  tv_unit: [
    make("tv_unit", "tv-unit", -2.7, 0, -0.7, [0.45, 0.55, 1.8], WOOD_LIGHT),
    make("tv_unit", "television", -2.7, 0.55, -0.7, [0.36, 0.42, 0.42], "#1d2329", { model: "television", rotationY: QUARTER, support: "top" }),
  ],
  rug: [make("rug", "rug", -0.3, 0, -0.85, [2.2, 0.02, 1.5], RUG, { support: "flat", radius: 0 })],
  floor_lamp: [
    make("floor_lamp", "floor-lamp", -1.6, 0, -2.2, [0.05, 1.45, 0.05], DARK, { radius: 0 }),
    make("floor_lamp", "floor-lamp-shade", -1.6, 1.4, -2.2, [0.4, 0.3, 0.4], LAMP, { support: "top" }),
  ],
  plants: [make("plants", "plant", -2.6, 0, -2.15, [0.5, 1.1, 0.5], "#5e8c61", { model: "potted-plant" })],
  shelves: [make("shelves", "shelves", 2.725, 0, 0.6, [0.45, 1.6, 1.2], DARK, { model: "shelves", rotationY: -QUARTER })],
  // Open kitchen (back-right corner)
  counter_stove: [
    make("counter_stove", "counter", 1.95, 0, -2.2, [1.9, 0.88, 0.6], WOOD_LIGHT),
    make("counter_stove", "worktop", 1.95, 0.88, -2.2, [1.9, 0.04, 0.6], WORKTOP, { support: "top", radius: 0 }),
    make("counter_stove", "hob", 2.4, 0.92, -2.2, [0.55, 0.01, 0.45], DARK, { support: "top", radius: 0 }),
  ],
  fridge: [make("fridge", "fridge", 2.6, 0, -1.3, [0.7, 1.8, 0.7], FRIDGE, { radius: 0.05 })],
  storage_cabinets: [make("storage_cabinets", "wall-cabinets", 1.95, 1.45, -2.32, [1.9, 0.65, 0.35], WOOD_LIGHT, { support: "wall" })],
  dining_table: [make("dining_table", "dining-table", -0.6, 0, 1.3, [1.7, 0.75, 1.05], WOOD, { model: "dining-table" })],
  chairs: [
    make("chairs", "chair-1", -1.0, 0, 2.2, [0.45, 0.85, 0.5], DARK, { model: "school-chair", rotationY: Math.PI }),
    make("chairs", "chair-2", -0.2, 0, 2.2, [0.45, 0.85, 0.5], DARK, { model: "school-chair", rotationY: Math.PI }),
  ],
  // Studio sleeping area (front-right)
  bed: [make("bed", "bed", 0.95, 0, 1.5, [0.9, 0.95, 1.95], "#a3b2c4", { model: "day-bed", rotationY: QUARTER })],
  side_tables: [make("side_tables", "side-table", 1.75, 0, 2.1, [0.5, 0.55, 0.45], WOOD, { model: "side-table" })],
  bedside_lamp: lamp(1.75, 2.1),
  wardrobe: [make("wardrobe", "wardrobe", 2.65, 0, 1.85, [0.55, 0.9, 1.0], WOOD, { model: "drawer", rotationY: -QUARTER })],
  chair: [make("chair", "chair", -1.9, 0, 0.5, [0.55, 1.1, 0.55], WOOD, { model: "wooden-armchair", rotationY: QUARTER })],
  // Door opens into the room (front-left)
  shoe_rack: [make("shoe_rack", "shoe-rack", -2.75, 0, 2.15, [0.35, 0.5, 0.6], WOOD_LIGHT)],
  door_mat: [make("door_mat", "door-mat", -2.55, 0, 1.2, [0.6, 0.02, 0.9], MAT, { support: "flat", radius: 0 })],
  cabinet: [make("cabinet", "entry-cabinet", -2.0, 0, 2.25, [0.7, 0.8, 0.4], WOOD)],
};

const BEDROOM: Frame = {
  bed: [make("bed", "bed", 0.4, 0, -2.0, [2.0, 0.95, 0.9], "#a3b2c4", { model: "day-bed" })],
  side_tables: [make("side_tables", "side-table", 1.85, 0, -2.15, [0.5, 0.55, 0.45], WOOD, { model: "side-table" })],
  bedside_lamp: lamp(1.85, -2.15),
  wardrobe: [make("wardrobe", "wardrobe", -2.65, 0, -1.0, [0.55, 0.9, 1.0], WOOD, { model: "drawer", rotationY: QUARTER })],
  rug: [make("rug", "rug", 0.3, 0, -0.6, [1.8, 0.02, 1.2], RUG, { support: "flat", radius: 0 })],
  chair: [make("chair", "chair", 2.2, 0, 0.8, [0.55, 1.1, 0.55], WOOD, { model: "wooden-armchair", rotationY: -QUARTER })],
};

const KITCHEN: Frame = {
  counter_stove: [
    make("counter_stove", "counter", 0.3, 0, -2.2, [4.6, 0.88, 0.6], WOOD_LIGHT),
    make("counter_stove", "worktop", 0.3, 0.88, -2.2, [4.6, 0.04, 0.6], WORKTOP, { support: "top", radius: 0 }),
    make("counter_stove", "hob", 1.4, 0.92, -2.2, [0.6, 0.01, 0.45], DARK, { support: "top", radius: 0 }),
  ],
  fridge: [make("fridge", "fridge", 2.6, 0, -1.2, [0.7, 1.8, 0.7], FRIDGE, { radius: 0.05 })],
  storage_cabinets: [make("storage_cabinets", "cabinet", -2.65, 0, -0.6, [0.6, 1.9, 1.6], WOOD, { model: "vintage-cabinet", rotationY: QUARTER })],
  dining_table: [make("dining_table", "dining-table", -0.3, 0, 0.4, [1.7, 0.75, 1.05], WOOD, { model: "dining-table" })],
  chairs: [
    make("chairs", "chair-1", -0.7, 0, 1.3, [0.45, 0.85, 0.5], DARK, { model: "school-chair", rotationY: Math.PI }),
    make("chairs", "chair-2", 0.1, 0, 1.3, [0.45, 0.85, 0.5], DARK, { model: "school-chair", rotationY: Math.PI }),
  ],
};

const BATHROOM: Frame = {
  toilet_western: [make("toilet_western", "toilet", 1.9, 0, -2.0, [0.5, 0.78, 0.62], CERAMIC, { model: "toilet" })],
  // Indian-style (squat) toilet: a floor pan with foot rests — drawn as simple shapes.
  toilet_indian: [
    make("toilet_indian", "squat-pan", 0.95, 0, -1.95, [0.5, 0.08, 0.7], CERAMIC, { radius: 0.03 }),
    make("toilet_indian", "foot-rest-l", 0.8, 0.08, -1.75, [0.12, 0.02, 0.22], "#dcdad5", { support: "top", radius: 0 }),
    make("toilet_indian", "foot-rest-r", 1.1, 0.08, -1.75, [0.12, 0.02, 0.22], "#dcdad5", { support: "top", radius: 0 }),
  ],
  washbasin: [make("washbasin", "washbasin", -0.2, 0, -2.15, [0.82, 0.86, 0.65], CERAMIC, { model: "sink" })],
  mirror: [make("mirror", "mirror", -0.2, 1.15, -2.47, [0.6, 0.75, 0.03], GLASS, { support: "wall", radius: 0 })],
  shower: [
    make("shower", "shower-tray", -2.1, 0, -1.6, [1.6, 0.06, 1.6], "#f1efea"),
    make("shower", "shower-glass", -1.28, 0.06, -2.0, [0.03, 1.9, 0.8], GLASS, { opacity: 0.35, support: "top", radius: 0 }),
  ],
  bathtub: [make("bathtub", "bathtub", 2.55, 0, 0.9, [0.76, 0.62, 1.6], CERAMIC, { model: "bathtub", rotationY: -QUARTER })],
  bucket_mug: [
    make("bucket_mug", "bucket", -1.0, 0, -2.2, [0.42, 0.4, 0.42], "#c0392b", { model: "bucket" }),
    make("bucket_mug", "mug", -1.0, 0.4, -2.2, [0.1, 0.11, 0.1], "#2f6f9e", { support: "top", radius: 0.02 }),
  ],
  stool: [make("stool", "stool", -1.0, 0, -1.4, [0.35, 0.45, 0.35], "#5b9bd5")],
  towel_rail: [make("towel_rail", "towel-rail", 0.95, 0.9, -2.4, [0.93, 0.7, 0.2], "#cccccc", { model: "towel-rail", support: "wall", radius: 0 })],
  bath_mat: [make("bath_mat", "bath-mat", 0.4, 0, -1.2, [0.8, 0.02, 0.5], "#7fb3d5", { support: "flat", radius: 0 })],
};

const ENTRANCE: Frame = {
  shoe_rack: [
    make("shoe_rack", "shoe-rack", -1.6, 0, -2.15, [1.2, 0.6, 0.35], WOOD_LIGHT),
    make("shoe_rack", "shoe-rack-shelf", -1.6, 0.29, -1.96, [1.16, 0.02, 0.02], DARK, { support: "top", radius: 0 }),
  ],
  door_mat: [make("door_mat", "door-mat", -2.55, 0, 1.2, [0.6, 0.02, 0.9], MAT, { support: "flat", radius: 0 })],
  cabinet: [make("cabinet", "cabinet", 2.65, 0, -1.0, [0.6, 1.9, 1.6], WOOD, { model: "vintage-cabinet", rotationY: -QUARTER })],
};

export const FRAMES: Partial<Record<RoomType, Frame>> = {
  living_room: LIVING,
  bedroom: BEDROOM,
  kitchen: KITCHEN,
  bathroom: BATHROOM,
  entrance: ENTRANCE,
};

/**
 * The user's furniture placed in a room with the given base layout, or null when
 * this layout has no furniture slots (the default illustrative layout is used then).
 */
export function furnitureBoxes(type: RoomType, items: readonly FurnitureItem[]): FurnitureBox[] | null {
  const frame = FRAMES[type];
  if (!frame) return null;
  const boxes = items.flatMap((item) => frame[item] ?? []);
  // A bedside lamp needs something to stand on: add a small stand if there's no side table.
  if (items.includes("bedside_lamp") && !items.includes("side_tables")) {
    const l = frame.bedside_lamp?.[0];
    if (l) boxes.push(lampStand(l.position[0], l.position[2]));
  }
  return boxes;
}
