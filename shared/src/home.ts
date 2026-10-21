import { z } from "zod";

/**
 * Home layout → the list of rooms ("spaces") a home actually has.
 *
 * A space has an id like "bedroom" or "bedroom_2" (a second room of the same
 * type), a base type used for rules and the 3D layout, and the types merged
 * into it (e.g. a living room the front door opens into also covers the
 * entrance). Plain ids ("bedroom") are exactly the ids older plans use, so
 * existing plans keep working unchanged.
 */

export const RoomTypeSchema = z.enum(["entrance", "living_room", "bedroom", "bathroom", "kitchen", "hallway_stairs", "balcony"]);
export type RoomType = z.infer<typeof RoomTypeSchema>;

export const ROOM_LABELS: Record<RoomType, string> = {
  entrance: "Entrance",
  living_room: "Living room",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  kitchen: "Kitchen",
  hallway_stairs: "Hallway & stairs",
  balcony: "Balcony",
};

const ROOM_ID_RE = new RegExp(`^(${RoomTypeSchema.options.join("|")})(?:_([2-9]))?$`);
export const RoomIdSchema = z.string().regex(ROOM_ID_RE, "Unknown room");
/** "bedroom", "bedroom_2", … */
export type RoomId = string;

export function roomTypeOf(id: RoomId): RoomType {
  const m = ROOM_ID_RE.exec(id);
  if (!m) throw new Error(`Unknown room id: ${id}`);
  return m[1] as RoomType;
}
const instanceOf = (id: RoomId) => Number(ROOM_ID_RE.exec(id)?.[2] ?? 1);

export const HomeTypeSchema = z.enum(["studio", "1bhk", "2bhk", "3bhk", "custom"]);
export type HomeType = z.infer<typeof HomeTypeSchema>;

export const HOME_TYPE_LABELS: Record<HomeType, string> = {
  studio: "Studio / 1RK",
  "1bhk": "1BHK",
  "2bhk": "2BHK",
  "3bhk": "3BHK",
  custom: "Custom",
};

export const HOME_TYPE_HINTS: Record<HomeType, string> = {
  studio: "One main room for living and sleeping, plus a kitchen and bathroom",
  "1bhk": "1 bedroom, a living room (hall) and a kitchen",
  "2bhk": "2 bedrooms, a living room (hall) and a kitchen",
  "3bhk": "3 bedrooms, a living room (hall) and a kitchen",
  custom: "Choose your rooms yourself",
};

const BEDROOMS: Record<Exclude<HomeType, "custom">, number> = { studio: 0, "1bhk": 1, "2bhk": 2, "3bhk": 3 };

export const HomeLayoutSchema = z.object({
  homeType: HomeTypeSchema,
  /** The main door opens straight into the living room (no separate entrance). */
  doorIntoLiving: z.boolean().default(false),
  /** The kitchen is open to the living room (one combined space). */
  openKitchen: z.boolean().default(false),
  bathrooms: z.number().int().min(1).max(3).default(1),
  /** A bathroom is attached to a bedroom (en-suite). */
  attachedBathroom: z.boolean().default(false),
  balcony: z.boolean().default(false),
  /** Custom homes only: the rooms the user picked. */
  customRooms: z.array(RoomIdSchema).default([]),
});
export type HomeLayout = z.infer<typeof HomeLayoutSchema>;

/** Rooms a Custom home can include, in display order. */
export const CUSTOM_ROOM_CHOICES: readonly RoomId[] = [
  "entrance",
  "living_room",
  "bedroom",
  "bedroom_2",
  "bedroom_3",
  "kitchen",
  "bathroom",
  "bathroom_2",
  "bathroom_3",
  "hallway_stairs",
  "balcony",
];

/** Label for a room in the Custom checklist ("Bedroom 1", "Bedroom 2", "Kitchen"). */
export function choiceLabel(id: RoomId): string {
  const type = roomTypeOf(id);
  const numbered = CUSTOM_ROOM_CHOICES.some((c) => c !== id && roomTypeOf(c) === type);
  return numbered ? `${ROOM_LABELS[type]} ${instanceOf(id)}` : ROOM_LABELS[type];
}

export interface RoomSpace {
  id: RoomId;
  /** Base type: decides the 3D layout and which rules apply first. */
  type: RoomType;
  label: string;
  /** Other room types merged into this space. */
  merged: RoomType[];
}

const ORDER = new Map(CUSTOM_ROOM_CHOICES.map((id, i) => [id, i]));
const ids = (type: RoomType, n: number): RoomId[] => Array.from({ length: n }, (_, i) => (i === 0 ? type : `${type}_${i + 1}`));

/** Turns layout answers into this home's rooms. */
export function generateRooms(layout: HomeLayout): RoomSpace[] {
  const custom = layout.homeType === "custom";
  const studio = layout.homeType === "studio";
  let list: RoomId[] = custom
    ? [...new Set(layout.customRooms)].filter((id) => ORDER.has(id)).sort((a, b) => ORDER.get(a)! - ORDER.get(b)!)
    : [
        "entrance",
        "living_room",
        ...ids("bedroom", BEDROOMS[layout.homeType as Exclude<HomeType, "custom">]),
        "kitchen",
        ...ids("bathroom", layout.bathrooms),
        ...(layout.balcony ? ["balcony"] : []),
      ];

  // Merge into the living room / main room.
  const merged: RoomType[] = studio ? ["bedroom"] : [];
  if (list.includes("living_room")) {
    if (layout.doorIntoLiving && list.includes("entrance")) merged.push("entrance");
    if (layout.openKitchen && list.includes("kitchen")) merged.push("kitchen");
  }
  list = list.filter((id) => !(id !== "living_room" && merged.includes(id as RoomType) && list.includes("living_room")));

  const count = (t: RoomType) => list.filter((id) => roomTypeOf(id) === t).length;
  const bedrooms = count("bedroom");

  return list.map((id): RoomSpace => {
    const type = roomTypeOf(id);
    let label = count(type) > 1 ? `${ROOM_LABELS[type]} ${instanceOf(id)}` : ROOM_LABELS[type];
    if (id === "living_room") {
      if (studio) {
        const parts = ["living", "sleeping", ...(merged.includes("entrance") ? ["entrance"] : []), ...(merged.includes("kitchen") ? ["kitchenette"] : [])];
        label = `Main room (${parts.join(" + ")})`;
      } else {
        if (merged.includes("entrance")) label += " + entrance";
        if (merged.includes("kitchen")) label += " + open kitchen";
      }
    }
    if (id === "bathroom" && !custom && layout.attachedBathroom && bedrooms > 0) {
      label += bedrooms > 1 ? " (attached to Bedroom 1)" : " (attached to bedroom)";
    }
    return { id, type, label, merged: id === "living_room" ? merged : [] };
  });
}

/** Older plans have no layout: treat them as a Custom home with exactly their rooms. */
export function legacyLayout(rooms: readonly RoomId[]): HomeLayout {
  return HomeLayoutSchema.parse({ homeType: "custom", customRooms: rooms.filter((r) => ROOM_ID_RE.test(r)) });
}

interface HasLayout {
  rooms: RoomId[];
  layout?: HomeLayout;
}

export const layoutOf = (p: HasLayout): HomeLayout => p.layout ?? legacyLayout(p.rooms);
export const spacesOf = (p: HasLayout): RoomSpace[] => generateRooms(layoutOf(p));

export function spaceOf(p: HasLayout, id: RoomId): RoomSpace {
  return (
    spacesOf(p).find((s) => s.id === id) ?? {
      id,
      type: roomTypeOf(id),
      label: instanceOf(id) > 1 ? `${ROOM_LABELS[roomTypeOf(id)]} ${instanceOf(id)}` : ROOM_LABELS[roomTypeOf(id)],
      merged: [],
    }
  );
}

/** All room types a space covers (its own plus merged ones). */
export const typesOf = (s: RoomSpace): RoomType[] => [s.type, ...s.merged];

/**
 * Switch a profile to a new layout, keeping what still applies: selected rooms
 * that still exist stay selected; observations and done items of a room that
 * gets merged (e.g. entrance → living room) move onto the merged space.
 */
export function applyLayout<C extends string, P extends HasLayout & { concerns: Partial<Record<string, C[]>> }>(
  profile: P,
  done: readonly string[],
  layout: HomeLayout,
): { profile: P; done: string[] } {
  const spaces = generateRooms(layout);
  const exists = new Set(spaces.map((s) => s.id));
  const into = new Map<RoomId, RoomId>(); // old standalone id → space it merged into
  for (const s of spaces) for (const t of s.merged) if (!exists.has(t)) into.set(t, s.id);

  const concerns: Partial<Record<string, C[]>> = { ...profile.concerns };
  for (const [from, to] of into) {
    if (!concerns[from]) continue;
    concerns[to] = [...new Set([...(concerns[to] ?? []), ...concerns[from]!])];
    delete concerns[from];
  }
  const rooms = [...new Set(profile.rooms.map((r) => into.get(r) ?? r).filter((r) => exists.has(r)))];
  const moved = done.map((id) => {
    const [room, ...rest] = id.split(":");
    const to = room ? into.get(room) : undefined;
    return to ? [to, ...rest].join(":") : id;
  });
  return { profile: { ...profile, layout, rooms, concerns }, done: [...new Set(moved)] };
}
