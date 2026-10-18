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

const WOOD = "#b08968";
const FABRIC = "#8a9bb0";
const WHITE = "#e8e6e1";
const DARK = "#5b6470";

const box = (key: string, position: Vec3, size: Vec3, color: string): Box => ({ key, position, size, color });
/** Box sitting on the floor: y is derived from its height. */
const onFloor = (key: string, x: number, z: number, size: Vec3, color: string): Box =>
  box(key, [x, size[1] / 2, z], size, color);

// Back wall is at z = -ROOM_D/2, side walls at x = ±ROOM_W/2. Front (z = +ROOM_D/2) is open.
// The door gap is in the left wall, near the front.
export const DOOR = { z: 1.2, width: 1 };

const FURNITURE: Record<RoomType, Box[]> = {
  entrance: [
    onFloor("bench", 1.8, -1.9, [1.6, 0.45, 0.45], WOOD),
    onFloor("shoe-rack", -1.6, -2.05, [1.2, 0.6, 0.35], DARK),
    box("coat-hooks", [1.8, 1.7, -2.45], [1.2, 0.08, 0.08], DARK),
  ],
  living_room: [
    onFloor("sofa", 0, -1.9, [2.4, 0.8, 0.9], FABRIC),
    onFloor("armchair", 2.1, -0.4, [0.9, 0.8, 0.9], FABRIC),
    onFloor("coffee-table", 0, -0.5, [1.2, 0.4, 0.6], WOOD),
    onFloor("tv-unit", -2.6, -0.6, [0.45, 0.5, 1.6], DARK),
  ],
  bedroom: [
    onFloor("bed", 0.6, -1.4, [1.6, 0.55, 2.1], FABRIC),
    onFloor("pillow", 0.6, -2.25, [1.3, 0.7, 0.3], WHITE),
    onFloor("nightstand", 1.85, -2.1, [0.5, 0.55, 0.45], WOOD),
    onFloor("wardrobe", -2.45, -1.6, [0.6, 2, 1.4], WOOD),
  ],
  bathroom: [
    onFloor("toilet", 1.9, -2.0, [0.45, 0.45, 0.7], WHITE),
    onFloor("sink", -0.2, -2.25, [0.8, 0.85, 0.5], WHITE),
    onFloor("shower-tray", -2.1, -1.6, [1.6, 0.06, 1.6], WHITE),
  ],
  kitchen: [
    onFloor("counter-back", 0.3, -2.2, [4.6, 0.9, 0.6], WOOD),
    onFloor("counter-side", 2.7, -0.9, [0.6, 0.9, 2.0], WOOD),
    onFloor("table", -0.6, 0.3, [1.2, 0.75, 0.8], WOOD),
    onFloor("chair", -0.6, 1.0, [0.45, 0.9, 0.45], DARK),
  ],
  hallway_stairs: [
    // Stairs up along the back wall, built from stepped boxes (illustration only).
    ...[0, 1, 2, 3, 4].map((i) => onFloor(`stair-${i}`, 1.6 - i * 0.4, -2.0, [0.4, 0.2 * (i + 1), 1], WHITE)),
    onFloor("side-table", 2.4, 0.4, [0.5, 0.75, 0.5], WOOD),
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
