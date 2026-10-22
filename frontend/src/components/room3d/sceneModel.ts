import {
  concernsFor,
  generatePlan,
  layoutOf,
  spaceOf,
  type Concern,
  type FurnitureItem,
  type HomeProfile,
  type RoomId,
  type RoomSpace,
  type RoomType,
} from "@nooksure/shared";
import manifest from "./models.manifest.json";
import { DEFAULT_ITEMS, MERGED_DEFAULT_ITEMS, furnitureBoxes } from "./furnitureLayout";
import { decorFor } from "./decor";

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
  /** The user's furniture item this box shows (furniture-driven layouts only). */
  item?: FurnitureItem;
  /** How it is supported: on the floor, on top of another piece, on a wall, or flat (rugs/mats). */
  support?: "floor" | "top" | "wall" | "flat";
}

/** Verified web-ready furniture models in /public/models. */
/** Id of a verified model in models.manifest.json (written by tools/blender/publish-models.mjs). */
export type ModelId = string;

const QUARTER = Math.PI / 2;

export interface ModelSpec {
  /** Path under the site root, e.g. "models/living/sofa.glb". */
  file: string;
  /** Verified bounds in metres: [width x, height y, depth z]. */
  size: Vec3;
  /** Bounding-box centre on x/z (published models are centred: [0, 0]). */
  center: [number, number];
  name: string;
  item: string;
  room: string;
}

/**
 * Verified web-ready furniture models (Poly Haven CC0, Sketchfab CC-BY — see Credits).
 * All are normalised: base at y = 0, centred, facing +z.
 */
export const MODELS: Record<ModelId, ModelSpec> = Object.fromEntries(
  manifest.models.map((m) => [
    m.id,
    { file: m.path, size: m.size as Vec3, center: [0, 0], name: m.name, item: m.item, room: m.room },
  ]),
);

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
  if (!spec) throw new Error(`Unknown model: ${id}`);
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
  room: RoomId;
  /** Base layout used for this space. */
  type: RoomType;
  /** e.g. "Living room + entrance". */
  label: string;
  width: number;
  depth: number;
  wallHeight: number;
  furniture: Box[];
  issues: IssueMarker[];
  /** In-scene labels (also listed as text for screen readers). */
  labels: SceneLabel[];
  /** True when the furniture comes from the user's answers rather than the default layout. */
  fromAnswers: boolean;
  /** Outdoor area (garden): open space with a house wall, door and path; steps if the user said so. */
  outdoor?: { steps: boolean };
  /** Bedroom with an attached bathroom: a doorway in the right wall. */
  attachedDoor?: { z: number; width: number };
}

/** Where the attached-bathroom doorway goes in the bedroom's right wall (kept clear of furniture slots). */
export const ATTACHED_DOOR = { z: -0.4, width: 1.0 };

/** Garden: door in the middle of the house wall (back), paved path from it to the front. */
export const GARDEN_PATH = { x: 0, width: 1.0 };
export const GARDEN_STEPS_DEPTH = 0.6;

export interface SceneLabel {
  id: string;
  /** info: describes the room itself (e.g. a doorway); not tied to a checklist item. */
  kind: "issue" | "furniture" | "info";
  text: string;
  at: Vec3;
  /** Selecting the label highlights this concern's checklist items (none for info labels). */
  concern?: Concern;
  status: IssueStatus;
}

/** What to do, shown at the spot in the 3D view (kept in step with the plan's suggestions). */
export const SCENE_TEXT: Record<Concern, string> = {
  loose_rugs: "Loose rug: roll it up and store it",
  clutter: "Clutter: keep this path clear",
  narrow_path: "Narrow path: keep this path clear",
  trailing_cables: "Trailing cable: run it along the wall",
  poor_lighting: "Dim lighting: add a night light here",
  out_of_reach: "Out of reach: move daily items lower",
  entry_step: "Step at door: purpose-built ramp (get advice)",
  no_support_rail: "Grab bar zone (install by a professional)",
  slippery_floor: "Slippery floor: add a non-slip mat here",
  uneven_ground: "Uneven ground: take the flattest route",
  steps_no_railing: "Handrail zone (install by a professional)",
  slippery_outdoor: "Slippery path: brush off moss and leaves",
  loose_gravel: "Loose gravel: use a firm route",
  low_branches: "Low branch: trim it back",
  path_clutter: "Keep this path clear",
};

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
  uneven_ground: "high",
  steps_no_railing: "high",
  slippery_outdoor: "high",
  loose_gravel: "medium",
  low_branches: "medium",
  path_clutter: "medium",
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
  uneven_ground: "Uneven ground",
  steps_no_railing: "Handrail needed",
  slippery_outdoor: "Slippery path",
  loose_gravel: "Loose gravel",
  low_branches: "Low branch",
  path_clutter: "Path clutter",
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
const DARK = "#4a525c";
const LEAF = "#5e8c61";

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
const round = { radius: 0.03 };

// Back wall is at z = -ROOM_D/2, side walls at x = ±ROOM_W/2. Front (z = +ROOM_D/2) is open.
// The door gap is in the left wall, near the front.
export const DOOR = { z: 1.2, width: 1 };

/**
 * Rooms without a furniture frame (see furnitureLayout.ts) keep a fixed illustrative layout.
 * Rooms with one show DEFAULT_ITEMS when the user hasn't told us their furniture.
 */
const FIXED_LAYOUTS: Partial<Record<RoomType, Box[]>> = {
  balcony: [
    // Folding table and two chairs, long side along the railing.
    onFloor("balcony-set", 0.8, -1.6, [1.75, 0.9, 0.8], WOOD, { model: "outdoor-set", rotationY: QUARTER }),
    onFloor("balcony-plant-1", -2.4, -2.1, [0.5, 1.0, 0.5], LEAF, { model: "potted-plant" }),
    onFloor("balcony-plant-2", 2.5, -2.1, [0.5, 1.0, 0.5], LEAF, { model: "potted-plant" }),
  ],
  hallway_stairs: [
    // Stairs up along the back wall, built from stepped boxes (illustration only).
    ...[0, 1, 2, 3, 4].map((i) => onFloor(`stair-${i}`, 1.6 - i * 0.4, -2.0, [0.4, 0.2 * (i + 1), 1], WOOD_LIGHT, round)),
    onFloor("side-table", 2.4, 0.4, [0.55, 0.55, 0.45], WOOD, { ...round, model: "side-table" }),
    onFloor("plant", -2.5, 2.1, [0.5, 1.0, 0.5], LEAF, { model: "potted-plant" }),
  ],
};

/** The illustrative furniture for a space when there are no answers: real models wherever a frame exists. */
function defaultFurniture(space: RoomSpace): Box[] {
  const items = [DEFAULT_ITEMS[space.type] ?? [], ...space.merged.map((t) => MERGED_DEFAULT_ITEMS[t] ?? [])].flat();
  return furnitureBoxes(space.type, [...new Set(items)]) ?? FIXED_LAYOUTS[space.type] ?? [];
}

const RED_ZONE_Y = 0.02; // floor patches sit just above the floor

/** Issue geometry per concern, placed sensibly for each room. */
function issueBoxes(concern: Concern, space: RoomSpace, color: string): { boxes: Box[]; labelAt: Vec3 } {
  const room = space.type;
  const has = (t: RoomType) => space.type === t || space.merged.includes(t);
  const doorX = -ROOM_W / 2;
  const lampX = space.merged.includes("bedroom") ? 1.3 : 2.4;
  if (room === "garden") {
    const outdoor = gardenIssueBoxes(concern, color);
    if (outdoor) return outdoor;
  }
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
          // Moved clear of a studio bed if there is one.
          box("lamp-stand", [lampX, 0.7, 1.6], [0.08, 1.4, 0.08], DARK),
          box("lamp-shade", [lampX, 1.5, 1.6], [0.45, 0.35, 0.45], color),
        ],
        labelAt: [lampX, 2.0, 1.6],
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
      const at: Vec3 = room === "bathroom" ? [ROOM_W / 2 - 0.03, 0.95, -1.9] : room === "entrance" ? [doorX + 0.03, 0.95, 0.2] : has("entrance") ? [doorX + 0.03, 0.95, 2.05] : [ROOM_W / 2 - 0.03, 0.95, -1.2];
      return { boxes: [box("support-zone", at, [0.04, 0.6, 0.9], color)], labelAt: [at[0] - 0.4, 1.5, at[2]] };
    }
    case "slippery_floor": {
      const at: Vec3 = room === "bathroom" ? [-1.0, RED_ZONE_Y, -1.0] : room === "kitchen" ? [0.3, RED_ZONE_Y, -1.4] : has("kitchen") ? [1.9, RED_ZONE_Y, -1.45] : [doorX + 0.9, RED_ZONE_Y, DOOR.z];
      return { boxes: [box("slip-zone", at, [1.3, 0.02, 1.1], color)], labelAt: [at[0], 0.5, at[2]] };
    }
    default:
      // Outdoor-only issues are placed by gardenIssueBoxes; anything else gets a floor marker.
      return { boxes: [box("issue-patch", [0, RED_ZONE_Y, 0.6], [1.0, 0.02, 1.0], color)], labelAt: [0, 0.5, 0.6] };
  }
}

const BARK = "#6b4f3a";
const CANOPY = "#4f7d4a";

/** Outdoor markers placed on or beside the garden path. */
function gardenIssueBoxes(concern: Concern, color: string): { boxes: Box[]; labelAt: Vec3 } | null {
  switch (concern) {
    case "uneven_ground":
      return { boxes: [box("uneven-patch", [0, 0.015, 0.4], [0.9, 0.03, 0.7], color)], labelAt: [0, 0.45, 0.4] };
    case "steps_no_railing":
      // Highlighted zone beside the steps where a handrail should be fitted — not drawn as a rail.
      return { boxes: [box("handrail-zone", [0.78, 0.5, -2.15], [0.04, 0.9, 0.7], color)], labelAt: [0.95, 1.3, -2.0] };
    case "slippery_outdoor":
      return { boxes: [box("slippery-path", [0, RED_ZONE_Y, -1.2], [0.9, 0.02, 0.8], color)], labelAt: [0, 0.45, -1.2] };
    case "loose_gravel":
      return { boxes: [box("gravel-patch", [-1.6, RED_ZONE_Y, 0.4], [1.2, 0.03, 0.8], color)], labelAt: [-1.6, 0.45, 0.4] };
    case "low_branches":
      return {
        boxes: [
          box("tree-trunk", [-1.6, 0.95, -0.8], [0.18, 1.9, 0.18], BARK),
          box("tree-canopy", [-1.6, 2.1, -0.8], [1.0, 0.6, 1.0], CANOPY, { radius: 0.25 }),
          // The branch reaches over the path at head height.
          box("low-branch", [-0.8, 1.65, -0.8], [1.6, 0.08, 0.08], color),
        ],
        labelAt: [-0.3, 1.95, -0.8],
      };
    case "path_clutter":
      return {
        boxes: [
          box("hose-on-path", [0.1, 0.02, 1.4], [0.5, 0.04, 0.5], color),
          box("pot-on-path", [-0.2, 0.15, 1.85], [0.3, 0.3, 0.3], color),
        ],
        labelAt: [0, 0.6, 1.6],
      };
    case "narrow_path":
      return { boxes: [box("path-strip", [0, 0.012, 1.0], [0.9, 0.02, 2.6], color)], labelAt: [0, 0.45, 1.0] };
    case "poor_lighting":
      return {
        boxes: [box("dark-post", [0.85, 0.45, -1.0], [0.08, 0.9, 0.08], DARK), box("dark-lamp", [0.85, 0.99, -1.0], [0.2, 0.18, 0.2], color)],
        labelAt: [0.85, 1.4, -1.0],
      };
    default:
      return null;
  }
}

/** Builds the scene for one room from the plan the app already produces. */
export function buildRoomScene(room: RoomId, profile: HomeProfile, done: readonly string[]): RoomScene {
  const space = spaceOf(profile, room);
  const items = generatePlan(profile);
  const doneSet = new Set(done);
  const applicable = concernsFor(space);
  const concerns = (profile.concerns[room] ?? []).filter((c) => applicable.includes(c));

  const issues = concerns.map((concern): IssueMarker => {
    const related = items.filter((i) => i.room === room && i.concern === concern);
    const allDone = related.length > 0 && related.every((i) => doneSet.has(i.id));
    const status: IssueStatus = allDone ? "done" : CONCERN_PRIORITY[concern];
    const color = STATUS_COLORS[status];
    const { boxes, labelAt } = issueBoxes(concern, space, color);
    return { concern, label: CONCERN_SHORT[concern], status, boxes, labelAt };
  });

  // The user's own furniture when they told us; otherwise the default illustrative layout.
  const own = profile.furniture?.[room];
  const fromAnswers = own && !own.skipped && own.items.length > 0 ? furnitureBoxes(space.type, own.items) : null;
  const base: Box[] = fromAnswers ?? defaultFurniture(space);
  // Decorative touches that never contradict the answers (only on furniture that's there).
  const furniture: Box[] = [...base, ...decorFor(space.type, base)];

  const layout = layoutOf(profile);
  const attached =
    room === "bedroom" && layout.attachedBathroom && layout.homeType !== "custom" && layout.homeType !== "studio";

  const labels: SceneLabel[] = issues.map((i) => ({
    id: `issue:${i.concern}`,
    kind: "issue",
    text: i.status === "done" ? `✓ Done — ${SCENE_TEXT[i.concern]}` : SCENE_TEXT[i.concern],
    at: i.labelAt,
    concern: i.concern,
    status: i.status,
  }));
  // One label per piece of the user's furniture that has advice in the plan, placed above it.
  const labelled = new Set<string>();
  for (const it of items) {
    if (it.room !== room || !it.furniture || labelled.has(it.furniture)) continue;
    const issue = issues.find((i) => i.concern === it.concern);
    const box = furniture.find((b) => b.item === it.furniture && b.support !== "top");
    if (!issue || !box) continue;
    labelled.add(it.furniture);
    labels.push({
      id: `furniture:${it.furniture}`,
      kind: "furniture",
      text: doneSet.has(it.id) ? `✓ Done — ${it.title}` : it.title,
      at: [box.position[0], Math.min(box.position[1] + box.size[1] / 2 + 0.3, WALL_H - 0.1), box.position[2]],
      concern: it.concern,
      status: doneSet.has(it.id) ? "done" : issue.status,
    });
  }

  if (attached) {
    labels.push({ id: "info:attached-door", kind: "info", text: "Door to attached bathroom", at: [ROOM_W / 2 - 0.3, 2.15, ATTACHED_DOOR.z], status: "medium" });
  }

  return {
    room,
    type: space.type,
    label: space.label,
    width: ROOM_W,
    depth: ROOM_D,
    wallHeight: WALL_H,
    furniture,
    issues,
    labels,
    fromAnswers: fromAnswers !== null,
    ...(space.type === "garden" ? { outdoor: { steps: layout.gardenSteps } } : {}),
    ...(attached ? { attachedDoor: { ...ATTACHED_DOOR } } : {}),
  };
}
