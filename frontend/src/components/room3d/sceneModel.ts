import { CONCERNS, generatePlan, type Concern, type HomeProfile, type RoomType } from "@nooksure/shared";

/**
 * Pure description of the illustrative 3D room — no three.js here, so it can be
 * unit-tested without WebGL. Units are abstract scene units, NOT real
 * measurements: every layout is a fixed illustration, not to scale.
 */

export type Vec3 = [number, number, number];
export type IssueStatus = "high" | "medium" | "done";

export interface Box {
  key: string;
  position: Vec3; // centre
  size: Vec3;
  color: string;
  /** Corner rounding for a softer look (scene units). */
  radius?: number;
  /** 0–1; glass and similar. */
  opacity?: number;
  /** Render this real 3D model, fitted into this box (the box is the fallback). */
  model?: ModelId;
  /** Model turn about the vertical axis, radians (models face +z by default). */
  rotationY?: number;
}

/** Verified web-ready furniture models in /public/models. */
export type ModelId = "coffee-table" | "armchair" | "dining-table" | "side-table" | "cabinet";

const QUARTER = Math.PI / 2;

/**
 * Real furniture models (downloaded assets; textures downscaled to 1k) in /public/models.
 * size/center are the verified native bounds (metres, Y-up; center = bbox centre on x/z).
 * All face +z natively; each layout box sets rotationY. tools/blender/ re-creates the .glb files.
 */
export const MODELS: Record<ModelId, { file: string; size: Vec3; center: [number, number] }> = {
  "coffee-table": { file: "coffee-table/coffee_table.gltf", size: [0.6, 0.39, 1.202], center: [0, 0] },
  armchair: { file: "armchair.glb", size: [0.85, 1.07, 0.77], center: [0, -0.03] },
  "dining-table": { file: "dining-table.glb", size: [2.26, 0.88, 1.39], center: [0, 0.02] },
  "side-table": { file: "side-table.glb", size: [0.55, 0.55, 0.45], center: [0, 0] },
  cabinet: { file: "cabinet.glb", size: [2.44, 0.68, 0.52], center: [0, -0.01] },
};

export interface ModelFit {
  position: Vec3;
  rotationY: number;
  scale: number;
  /** Resulting world-space size after rotation and scaling. */
  size: Vec3;
}

/** Uniform scale that fits the model inside its layout box, centred, standing on the box's floor. */
export function fitModel(b: Box, id: ModelId): ModelFit {
  const spec = MODELS[id];
  const rot = b.rotationY ?? 0;
  const sideways = Math.abs(Math.round(rot / (Math.PI / 2))) % 2 === 1;
  const [mx, my, mz] = spec.size;
  const w = sideways ? mz : mx;
  const d = sideways ? mx : mz;
  const s = Math.min(b.size[0] / w, b.size[1] / my, b.size[2] / d);
  // Rotate the model's own centre offset so the result is centred in the box.
  const [cx, cz] = spec.center;
  const ox = cx * Math.cos(rot) + cz * Math.sin(rot);
  const oz = -cx * Math.sin(rot) + cz * Math.cos(rot);
  const floorY = b.position[1] - b.size[1] / 2;
  return { position: [b.position[0] - s * ox, floorY, b.position[2] - s * oz], rotationY: rot, scale: s, size: [w * s, my * s, d * s] };
}

export interface IssueMarker {
  concern: Concern;
  label: string;
  status: IssueStatus;
  boxes: Box[];
  /** Where the floating label sits. */
  labelAt: Vec3;
}

export interface RoomScene {
  room: RoomType;
  width: number;
  depth: number;
  wallHeight: number;
  furniture: Box[];
  issues: IssueMarker[];
}

export const ROOM_W = 6;
export const ROOM_D = 5;
export const WALL_H = 2.6;

/** Fall hazards and load-bearing needs come first. A visual grouping only. */
export const CONCERN_PRIORITY: Record<Concern, Exclude<IssueStatus, "done">> = {
  entry_step: "high",
  no_support_rail: "high",
  slippery_floor: "high",
  loose_rugs: "high",
  clutter: "medium",
  narrow_path: "medium",
  trailing_cables: "medium",
  poor_lighting: "medium",
  out_of_reach: "medium",
};

export const CONCERN_SHORT: Record<Concern, string> = {
  loose_rugs: "Loose rug",
  clutter: "Clutter",
  narrow_path: "Narrow path",
  trailing_cables: "Trailing cable",
  poor_lighting: "Dim lighting",
  out_of_reach: "Out of reach",
  entry_step: "Step at door",
  no_support_rail: "Support needed",
  slippery_floor: "Slippery floor",
};

export const STATUS_COLORS: Record<IssueStatus, string> = {
  high: "#d64545",
  medium: "#e0a030",
  done: "#3a9a5b",
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
  high: "High priority",
  medium: "Medium priority",
  done: "Done",
};

const WOOD = "#a77b56";
const WOOD_LIGHT = "#c9a27e";
const FABRIC = "#7d8fa6";
const FABRIC_LIGHT = "#a3b2c4";
const LINEN = "#efe9df";
const WHITE = "#f1efea";
const CERAMIC = "#fbfaf7";
const DARK = "#4a525c";
const GLASS = "#cfe3ea";

const box = (key: string, position: Vec3, size: Vec3, color: string, extra: Partial<Box> = {}): Box => ({
  key,
  position,
  size,
  color,
  ...extra,
});
/** Box sitting on the floor: y is derived from its height. */
const onFloor = (key: string, x: number, z: number, size: Vec3, color: string, extra: Partial<Box> = {}): Box =>
  box(key, [x, size[1] / 2, z], size, color, extra);
/** Box whose bottom sits at height `y0`. */
const at = (key: string, x: number, y0: number, z: number, size: Vec3, color: string, extra: Partial<Box> = {}): Box =>
  box(key, [x, y0 + size[1] / 2, z], size, color, extra);
/** Four square legs under a top of size (w, d), inset slightly. */
const legs = (key: string, x: number, z: number, w: number, d: number, h: number, color: string): Box[] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz], i) => onFloor(`${key}-leg-${i}`, x + sx! * (w / 2 - 0.06), z + sz! * (d / 2 - 0.06), [0.06, h, 0.06], color));
const soft = { radius: 0.06 };
const round = { radius: 0.03 };

// Back wall is at z = -ROOM_D/2, side walls at x = ±ROOM_W/2. Front (z = +ROOM_D/2) is open.
// The door gap is in the left wall, near the front.
export const DOOR = { z: 1.2, width: 1 };

const WORKTOP = "#d9d4ca";
const POT = "#b5735a";
const LEAF = "#5e8c61";

const FURNITURE: Record<RoomType, Box[]> = {
  entrance: [
    at("bench-seat", 1.8, 0.38, -1.95, [1.6, 0.07, 0.45], WOOD, round),
    ...legs("bench", 1.8, -1.95, 1.6, 0.45, 0.38, DARK),
    onFloor("shoe-rack", -1.6, -2.1, [1.2, 0.6, 0.35], WOOD_LIGHT, round),
    at("shoe-rack-shelf", -1.6, 0.29, -1.92, [1.16, 0.02, 0.02], DARK),
    box("coat-hooks", [1.8, 1.7, -2.45], [1.2, 0.06, 0.06], DARK),
    at("hall-mirror", 2.96, 0.8, -0.6, [0.02, 0.9, 0.6], GLASS),
  ],
  living_room: [
    onFloor("sofa", 0, -1.9, [2.4, 0.42, 0.9], FABRIC, soft),
    at("sofa-back", 0, 0.3, -2.24, [2.4, 0.6, 0.22], FABRIC, soft),
    at("sofa-arm-l", -1.09, 0.3, -1.9, [0.22, 0.32, 0.9], FABRIC, soft),
    at("sofa-arm-r", 1.09, 0.3, -1.9, [0.22, 0.32, 0.9], FABRIC, soft),
    ...[-0.65, 0, 0.65].map((x, i) => at(`sofa-cushion-${i}`, x, 0.42, -1.82, [0.62, 0.12, 0.6], FABRIC_LIGHT, round)),
    // Faces the room (-x).
    onFloor("armchair", 2.1, -0.4, [0.75, 1.0, 0.82], FABRIC, { ...soft, model: "armchair", rotationY: -QUARTER }),
    // Real 3D model in the browser; this box is the fallback if it can't load.
    onFloor("coffee-table", 0, -0.5, [1.2, 0.4, 0.6], WOOD, { ...round, model: "coffee-table", rotationY: QUARTER }),
    // Low cabinet as the TV unit, doors facing the room (+x).
    onFloor("tv-unit", -2.6, -0.6, [0.45, 0.6, 2.1], WOOD_LIGHT, { ...round, model: "cabinet", rotationY: QUARTER }),
    at("tv", -2.72, 0.6, -0.6, [0.05, 0.62, 1.1], "#1d2329", round),
    onFloor("plant-pot", -2.6, -2.15, [0.32, 0.36, 0.32], POT, round),
    at("plant", -2.6, 0.36, -2.15, [0.44, 0.5, 0.44], LEAF, { radius: 0.18 }),
  ],
  bedroom: [
    onFloor("bed", 0.6, -1.4, [1.7, 0.3, 2.15], WOOD, round),
    at("mattress", 0.6, 0.3, -1.38, [1.6, 0.22, 2.0], LINEN, soft),
    at("headboard", 0.6, 0.3, -2.42, [1.7, 0.9, 0.1], WOOD, round),
    at("pillow-l", 0.22, 0.52, -2.1, [0.62, 0.13, 0.34], WHITE, soft),
    at("pillow-r", 0.98, 0.52, -2.1, [0.62, 0.13, 0.34], WHITE, soft),
    at("blanket", 0.6, 0.52, -0.95, [1.64, 0.05, 1.15], FABRIC_LIGHT, round),
    onFloor("nightstand", 1.85, -2.1, [0.5, 0.55, 0.45], WOOD_LIGHT, { ...round, model: "side-table" }),
    onFloor("wardrobe", -2.45, -1.6, [0.6, 2, 1.4], WOOD, round),
    at("wardrobe-split", -2.14, 0.1, -1.6, [0.01, 1.8, 0.01], DARK),
    at("wardrobe-handle-l", -2.13, 0.95, -1.7, [0.02, 0.18, 0.03], DARK),
    at("wardrobe-handle-r", -2.13, 0.95, -1.5, [0.02, 0.18, 0.03], DARK),
  ],
  bathroom: [
    onFloor("toilet", 1.9, -1.95, [0.4, 0.4, 0.55], CERAMIC, soft),
    at("toilet-tank", 1.9, 0.4, -2.33, [0.46, 0.4, 0.18], CERAMIC, round),
    onFloor("vanity", -0.2, -2.25, [0.8, 0.75, 0.5], WOOD_LIGHT, round),
    at("sink", -0.2, 0.75, -2.23, [0.84, 0.1, 0.52], CERAMIC, round),
    at("mirror", -0.2, 1.15, -2.47, [0.7, 0.8, 0.03], GLASS),
    onFloor("shower-tray", -2.1, -1.6, [1.6, 0.06, 1.6], WHITE, round),
    at("shower-glass", -1.28, 0.06, -2.0, [0.03, 1.9, 0.8], GLASS, { opacity: 0.35 }),
  ],
  kitchen: [
    onFloor("counter-back", 0.3, -2.2, [4.6, 0.86, 0.6], WOOD_LIGHT, round),
    at("worktop-back", 0.3, 0.86, -2.2, [4.64, 0.05, 0.6], WORKTOP),
    at("hob", 1.4, 0.91, -2.2, [0.6, 0.01, 0.45], DARK),
    onFloor("counter-side", 2.7, -0.9, [0.6, 0.86, 2.0], WOOD_LIGHT, round),
    at("worktop-side", 2.7, 0.86, -0.9, [0.6, 0.05, 2.0], WORKTOP),
    onFloor("table", -0.4, 0.2, [1.8, 0.7, 1.11], WOOD, { ...round, model: "dining-table" }),
    at("chair", -0.4, 0.42, 1.0, [0.45, 0.05, 0.45], DARK, round),
    ...legs("chair", -0.4, 1.0, 0.45, 0.45, 0.42, DARK),
    at("chair-back", -0.4, 0.47, 1.2, [0.45, 0.45, 0.05], DARK, round),
  ],
  hallway_stairs: [
    // Stairs up along the back wall, built from stepped boxes (illustration only).
    ...[0, 1, 2, 3, 4].map((i) => onFloor(`stair-${i}`, 1.6 - i * 0.4, -2.0, [0.4, 0.2 * (i + 1), 1], WOOD_LIGHT, round)),
    onFloor("side-table", 2.4, 0.4, [0.55, 0.55, 0.45], WOOD, { ...round, model: "side-table" }),
    onFloor("plant-pot", -2.5, 2.1, [0.32, 0.36, 0.32], POT, round),
    at("plant", -2.5, 0.36, 2.1, [0.44, 0.5, 0.44], LEAF, { radius: 0.18 }),
  ],
};

const RED_ZONE_Y = 0.02; // floor patches sit just above the floor

/** Issue geometry per concern, placed sensibly for each room. */
function issueBoxes(concern: Concern, room: RoomType, color: string): { boxes: Box[]; labelAt: Vec3 } {
  const doorX = -ROOM_W / 2;
  switch (concern) {
    case "loose_rugs":
      return { boxes: [box("rug", [0.2, RED_ZONE_Y, 0.9], [1.8, 0.03, 1.1], color)], labelAt: [0.2, 0.5, 0.9] };
    case "clutter":
      return {
        boxes: [
          box("clutter-1", [-0.8, 0.12, 1.6], [0.35, 0.24, 0.3], color),
          box("clutter-2", [-0.35, 0.09, 1.9], [0.3, 0.18, 0.25], color),
          box("clutter-3", [-1.1, 0.07, 2.0], [0.25, 0.14, 0.4], color),
        ],
        labelAt: [-0.75, 0.7, 1.8],
      };
    case "narrow_path":
      return { boxes: [box("path", [-1.2, RED_ZONE_Y, 0.2], [0.7, 0.02, 3.2], color)], labelAt: [-1.2, 0.5, -0.2] };
    case "trailing_cables":
      return {
        boxes: [
          box("cable-a", [-1.6, 0.03, 0.4], [2.4, 0.04, 0.04], color),
          box("cable-b", [-0.4, 0.03, -0.3], [0.04, 0.04, 1.4], color),
        ],
        labelAt: [-1.2, 0.45, 0.4],
      };
    case "poor_lighting":
      return {
        boxes: [
          box("lamp-stand", [2.4, 0.7, 1.6], [0.08, 1.4, 0.08], DARK),
          box("lamp-shade", [2.4, 1.5, 1.6], [0.45, 0.35, 0.45], color),
        ],
        labelAt: [2.4, 2.0, 1.6],
      };
    case "out_of_reach": {
      const z = -ROOM_D / 2 + 0.2;
      return { boxes: [box("high-shelf", [-0.9, 2.15, z], [1.4, 0.06, 0.35], color)], labelAt: [-0.9, 2.45, z + 0.2] };
    }
    case "entry_step":
      return {
        boxes: [box("door-step", [doorX + 0.25, 0.09, DOOR.z], [0.5, 0.18, DOOR.width], color)],
        labelAt: [doorX + 0.4, 0.6, DOOR.z],
      };
    case "no_support_rail": {
      // A highlighted wall zone where purpose-built support should be installed —
      // deliberately NOT drawn as a rail or handle.
      const at: Vec3 = room === "bathroom" ? [ROOM_W / 2 - 0.03, 0.95, -1.9] : room === "entrance" ? [doorX + 0.03, 0.95, 0.2] : [ROOM_W / 2 - 0.03, 0.95, -1.2];
      return { boxes: [box("support-zone", at, [0.04, 0.6, 0.9], color)], labelAt: [at[0] - 0.4, 1.5, at[2]] };
    }
    case "slippery_floor": {
      const at: Vec3 = room === "bathroom" ? [-1.0, RED_ZONE_Y, -1.0] : room === "kitchen" ? [0.3, RED_ZONE_Y, -1.4] : [doorX + 0.9, RED_ZONE_Y, DOOR.z];
      return { boxes: [box("slip-zone", at, [1.3, 0.02, 1.1], color)], labelAt: [at[0], 0.5, at[2]] };
    }
  }
}

/** Builds the scene for one room from the plan the app already produces. */
export function buildRoomScene(room: RoomType, profile: HomeProfile, done: readonly string[]): RoomScene {
  const items = generatePlan(profile);
  const doneSet = new Set(done);
  const concerns = (profile.concerns[room] ?? []).filter((c) => CONCERNS[c].rooms.includes(room));

  const issues = concerns.map((concern): IssueMarker => {
    const related = items.filter((i) => i.room === room && i.concern === concern);
    const allDone = related.length > 0 && related.every((i) => doneSet.has(i.id));
    const status: IssueStatus = allDone ? "done" : CONCERN_PRIORITY[concern];
    const color = STATUS_COLORS[status];
    const { boxes, labelAt } = issueBoxes(concern, room, color);
    return { concern, label: CONCERN_SHORT[concern], status, boxes, labelAt };
  });

  return { room, width: ROOM_W, depth: ROOM_D, wallHeight: WALL_H, furniture: FURNITURE[room], issues };
}
