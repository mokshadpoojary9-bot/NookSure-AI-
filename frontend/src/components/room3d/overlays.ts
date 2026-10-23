import { DOOR, GARDEN_PATH, GARDEN_STEPS_DEPTH, ROOM_D, ROOM_W, type Box, type RoomScene, type Vec3 } from "./sceneModel";

/**
 * Accessibility overlays, built in code (not models). Illustrative — sizes follow
 * common planning figures (a 1.5 m turning circle, a ~0.9 m clear route) but the
 * room itself is not to scale, so they are a guide, not a measurement.
 */

export const TURNING_DIAMETER = 1.5;
export const PATH_WIDTH = 0.9;
/** Height of the shower cabin's tray, where its non-slip zone is drawn. */
const SHOWER_FLOOR_Y = 0.13;

export interface WallZone {
  key: string;
  position: Vec3;
  size: Vec3;
  label: string;
}

export interface Overlays {
  /** Centre of a clear 1.5 m circle on the floor, or null when no spot is clear. */
  turningCircle: { center: [number, number]; radius: number } | null;
  /** Route from the door; blockedBy lists furniture keys in the way. */
  walkingPath: { from: [number, number]; to: [number, number]; width: number; blockedBy: string[] };
  /** Wall areas where purpose-built grab bars could be installed (never drawn as bars). */
  grabZones: WallZone[];
  /** Floor areas that would benefit from a non-slip mat or surface. */
  nonSlipZones: WallZone[];
  /** Low night-light points from the bed towards the door (bedrooms and studio rooms). */
  nightLights: Vec3[];
}

/** Boxes that take up floor space (rugs, mats and wall items don't). */
function floorBoxes(scene: RoomScene): Box[] {
  return scene.furniture.filter((b) => {
    if (b.support === "top" || b.support === "wall" || b.support === "flat") return false;
    const bottom = b.position[1] - b.size[1] / 2;
    return bottom < 0.05 && b.size[1] > 0.03;
  });
}

/** Distance from a point to a box's footprint (0 if inside). */
function distToFootprint(x: number, z: number, b: Box): number {
  const dx = Math.max(Math.abs(x - b.position[0]) - b.size[0] / 2, 0);
  const dz = Math.max(Math.abs(z - b.position[2]) - b.size[2] / 2, 0);
  return Math.hypot(dx, dz);
}

export function findTurningCircle(scene: RoomScene): Overlays["turningCircle"] {
  const r = TURNING_DIAMETER / 2;
  const blockers = floorBoxes(scene);
  const candidates: [number, number][] = [];
  for (let x = -ROOM_W / 2 + r; x <= ROOM_W / 2 - r + 1e-9; x += 0.25)
    for (let z = -ROOM_D / 2 + r; z <= ROOM_D / 2 - r + 1e-9; z += 0.25) candidates.push([x, z]);
  // Prefer spots near the middle of the room.
  candidates.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  const free = candidates.find(([x, z]) => blockers.every((b) => distToFootprint(x, z, b) >= r));
  return free ? { center: [Number(free[0].toFixed(2)), Number(free[1].toFixed(2))], radius: r } : null;
}

function routeBlockers(scene: RoomScene, from: [number, number], to: [number, number]): string[] {
  const half = PATH_WIDTH / 2;
  const hits = new Set<string>();
  const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[1] + (to[1] - from[1]) * t;
    for (const b of floorBoxes(scene)) if (distToFootprint(x, z, b) < half) hits.add(b.key);
  }
  return [...hits];
}

export function computeOverlays(scene: RoomScene): Overlays {
  const turningCircle = scene.outdoor ? null : findTurningCircle(scene);

  // Walking path: from the door into the room (garden: from the house door down the path).
  const from: [number, number] = scene.outdoor
    ? [GARDEN_PATH.x, -ROOM_D / 2 + (scene.outdoor.steps ? GARDEN_STEPS_DEPTH : 0) + 0.15]
    : [-ROOM_W / 2 + 0.35, DOOR.z];
  const to: [number, number] = scene.outdoor ? [GARDEN_PATH.x, ROOM_D / 2 - 0.3] : turningCircle?.center ?? [0, 0];
  const walkingPath = { from, to, width: PATH_WIDTH, blockedBy: routeBlockers(scene, from, to) };

  const grabZones: WallZone[] = [];
  const nonSlipZones: WallZone[] = [];
  const has = (key: string) => scene.furniture.some((b) => b.key === key || b.key.startsWith(`${key}-`));
  const types = [scene.type];
  const label = "Grab bar zone (install by a professional)";

  if (types.includes("bathroom")) {
    if (has("toilet") || has("squat-pan")) grabZones.push({ key: "grab-toilet", position: [ROOM_W / 2 - 0.03, 0.95, -1.9], size: [0.04, 0.6, 0.9], label });
    if (has("shower")) {
      // Inside the shower cabin (back-left corner): its back wall and its floor.
      grabZones.push({ key: "grab-shower", position: [-2.3, 1.1, -ROOM_D / 2 + 0.07], size: [0.8, 0.6, 0.04], label });
      nonSlipZones.push({ key: "non-slip-shower", position: [-2.3, SHOWER_FLOOR_Y, -1.95], size: [1.0, 0.01, 0.8], label: "Non-slip zone: shower floor" });
    }
    if (has("bathtub")) {
      grabZones.push({ key: "grab-bath", position: [ROOM_W / 2 - 0.03, 0.85, 0.9], size: [0.04, 0.5, 1.0], label });
      nonSlipZones.push({ key: "non-slip-bath", position: [1.85, 0.01, 0.9], size: [0.55, 0.01, 1.3], label: "Non-slip zone: beside the bath" });
    }
    nonSlipZones.push({ key: "non-slip-basin", position: [-0.2, 0.01, -1.5], size: [0.8, 0.01, 0.5], label: "Non-slip zone: in front of the basin" });
  }
  if (scene.type === "entrance" || scene.label.includes("entrance")) {
    grabZones.push({ key: "grab-door", position: [-ROOM_W / 2 + 0.03, 0.95, DOOR.z + DOOR.width / 2 + 0.35], size: [0.04, 0.7, 0.6], label });
  }
  if (scene.type === "hallway_stairs") {
    grabZones.push({ key: "grab-stairs", position: [0.8, 1.0, -ROOM_D / 2 + 0.03], size: [2.0, 0.3, 0.04], label: "Handrail zone (install by a professional)" });
  }
  if (scene.outdoor?.steps) {
    grabZones.push({ key: "grab-steps", position: [0.78, 0.5, -2.15], size: [0.04, 0.9, 0.7], label: "Handrail zone (install by a professional)" });
  }

  // Night lights: bed → door (or to the attached bathroom door when there is one).
  const nightLights: Vec3[] = [];
  const bed = scene.furniture.find((b) => b.item === "bed" || b.key === "bed" || b.key === "studio-bed");
  if (bed) {
    const start: [number, number] = [bed.position[0] - bed.size[0] / 2 - 0.25, bed.position[2] + bed.size[2] / 2 - 0.2];
    const end: [number, number] = scene.attachedDoor ? [ROOM_W / 2 - 0.4, scene.attachedDoor.z] : [-ROOM_W / 2 + 0.3, DOOR.z];
    const n = Math.max(2, Math.round(Math.hypot(end[0] - start[0], end[1] - start[1]) / 0.9));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      nightLights.push([start[0] + (end[0] - start[0]) * t, 0.08, start[1] + (end[1] - start[1]) * t]);
    }
  }

  return { turningCircle, walkingPath, grabZones, nonSlipZones, nightLights };
}
