import { z } from "zod";
import { RecommendationKindSchema, type RecommendationKind } from "./schemas";
import { HomeLayoutSchema, RoomIdSchema, RoomTypeSchema, spaceOf, typesOf, type RoomSpace, type RoomType } from "./home";
import { FurnitureItemSchema, RoomFurnitureSchema, type FurnitureItem } from "./furniture";

/**
 * Deterministic, rule-based planning catalog for the "Use What You Have"
 * (Jugaad) Planner. This is NOT AI analysis — it is a reviewed checklist that
 * maps observed concerns to safe suggestions. Every entry must follow
 * docs/safety.md: no furniture as grab bars, no stacked objects as ramps or
 * steps, no improvised load-bearing or fall-protection solutions.
 */

export const KIND_ORDER: readonly RecommendationKind[] = RecommendationKindSchema.options;

export const MobilityAidSchema = z.enum(["wheelchair", "walker", "cane", "low_vision", "fall_risk"]);
export type MobilityAid = z.infer<typeof MobilityAidSchema>;


export const ConcernSchema = z.enum([
  "loose_rugs",
  "clutter",
  "narrow_path",
  "trailing_cables",
  "poor_lighting",
  "out_of_reach",
  "entry_step",
  "no_support_rail",
  "slippery_floor",
  // outdoor
  "uneven_ground",
  "steps_no_railing",
  "slippery_outdoor",
  "loose_gravel",
  "low_branches",
  "path_clutter",
]);
export type Concern = z.infer<typeof ConcernSchema>;

export const HomeProfileSchema = z.object({
  aids: z.array(MobilityAidSchema),
  /** Rooms selected for planning (ids from the home layout, e.g. "bedroom_2"). */
  rooms: z.array(RoomIdSchema),
  concerns: z.record(RoomIdSchema, z.array(ConcernSchema)).default({}),
  notes: z.string().max(1000).default(""),
  /** Older plans have none; see legacyLayout(). */
  layout: HomeLayoutSchema.optional(),
  /** What the user already has, per room. Older plans have none. */
  furniture: z.record(RoomIdSchema, RoomFurnitureSchema).optional(),
});
export type HomeProfile = z.infer<typeof HomeProfileSchema>;

export const PlanItemSchema = z.object({
  id: z.string(),
  room: RoomIdSchema,
  concern: ConcernSchema,
  kind: RecommendationKindSchema,
  title: z.string(),
  detail: z.string(),
  safetyNote: z.string().optional(),
  seekProfessional: z.boolean(),
  /** Set when the suggestion is about furniture the user said they have. */
  furniture: FurnitureItemSchema.optional(),
});
export type PlanItem = z.infer<typeof PlanItemSchema>;

export const MOBILITY_AID_LABELS: Record<MobilityAid, string> = {
  wheelchair: "Wheelchair",
  walker: "Walker / rollator",
  cane: "Cane or walking stick",
  low_vision: "Low vision",
  fall_risk: "Balance or fall risk",
};

export const KIND_LABELS: Record<RecommendationKind, string> = {
  reuse: "Reuse",
  rearrange: "Rearrange",
  remove: "Remove",
  purchase: "Purchase",
};

const ALL_ROOMS = RoomTypeSchema.options;
const INDOOR = ALL_ROOMS.filter((r) => r !== "garden");
const OUTDOOR: readonly RoomType[] = ["garden"];

export const CONCERNS: Record<Concern, { label: string; rooms: readonly RoomType[] }> = {
  loose_rugs: { label: "Loose rugs or mats on walking routes", rooms: INDOOR },
  clutter: { label: "Clutter on the floor or walkways", rooms: INDOOR },
  narrow_path: { label: "Narrow path between furniture", rooms: ["entrance", "living_room", "bedroom", "kitchen", "hallway_stairs", "balcony", "garden"] },
  trailing_cables: { label: "Trailing cables or extension cords", rooms: ["living_room", "bedroom", "kitchen", "hallway_stairs"] },
  poor_lighting: { label: "Dim lighting on routes or at night", rooms: ALL_ROOMS },
  out_of_reach: { label: "Everyday items stored too high or too low", rooms: ["bedroom", "bathroom", "kitchen", "living_room"] },
  entry_step: { label: "Step or raised threshold at a doorway", rooms: ["entrance", "bathroom", "hallway_stairs", "balcony"] },
  no_support_rail: { label: "No grab bar or handrail where support is needed", rooms: ["bathroom", "hallway_stairs", "entrance"] },
  slippery_floor: { label: "Slippery or wet floor", rooms: ["bathroom", "kitchen", "entrance", "balcony"] },
  uneven_ground: { label: "Uneven ground or paving", rooms: OUTDOOR },
  steps_no_railing: { label: "Steps without a handrail", rooms: OUTDOOR },
  slippery_outdoor: { label: "Slippery tiles, moss or wet leaves", rooms: OUTDOOR },
  loose_gravel: { label: "Loose stones or gravel on the path", rooms: OUTDOOR },
  low_branches: { label: "Low branches over the path", rooms: OUTDOOR },
  path_clutter: { label: "Hoses, pots or tools on the path", rooms: OUTDOOR },
};

interface Suggestion {
  key: string;
  kind: RecommendationKind;
  title: string;
  detail: string;
  safetyNote?: string;
  seekProfessional?: boolean;
  /** Only include for these aids; omit to always include. */
  aids?: readonly MobilityAid[];
  /** Only for spaces covering one of these room types; omit for any. */
  rooms?: readonly RoomType[];
}

const NO_IMPROVISED_SUPPORT =
  "Never use towel rails, sinks, furniture, or other fixtures as handholds — they are not built to take a person's weight.";
const NO_STACKED_RAMPS =
  "Never build a ramp or step from stacked bricks, boards, boxes, or books — they can shift or collapse.";

interface FurnitureSuggestion extends Omit<Suggestion, "aids"> {
  /** Shown only when the user has this item in the room. */
  requires: FurnitureItem;
  /** Generic suggestion key this one replaces (same advice, about their own item). */
  replaces?: string;
}

/**
 * Furniture-aware suggestions: reuse/rearrange/remove what the user already has.
 * Same safety rules as SUGGESTIONS — furniture is never suggested as support,
 * a seat in a wet area, a step or a ramp.
 */
export const FURNITURE_SUGGESTIONS: Partial<Record<Concern, readonly FurnitureSuggestion[]>> = {
  path_clutter: [
    { key: "f-hose", requires: "hose", kind: "reuse", title: "Coil your hose on its reel or a hook after use", detail: "So it never lies across the path." },
  ],
  loose_rugs: [
    { key: "f-rug", requires: "rug", replaces: "remove-rugs", kind: "remove", title: "Roll up your rug and store it", detail: "Take your rug off the walking route; curled edges and sliding rugs are common trip hazards." },
  ],
  clutter: [
    { key: "f-shoe-rack", requires: "shoe_rack", kind: "reuse", title: "Use your shoe rack to keep shoes off the floor", detail: "Put shoes on your shoe rack as soon as they come off, so the doorway stays clear." },
    { key: "f-shelves", requires: "shelves", kind: "reuse", title: "Use your shelves to get things off the floor", detail: "Move floor clutter onto your shelves at an easy height.", safetyNote: "Never climb shelves or stand on furniture to reach them." },
    { key: "f-cabinet", requires: "cabinet", kind: "reuse", title: "Store loose items in your cabinet", detail: "Bags, keys and post can go in your cabinet instead of on the floor." },
    { key: "f-storage", requires: "storage_cabinets", kind: "reuse", title: "Use your storage cabinets for floor items", detail: "Move items off the floor into your cabinets, keeping heavy things low." },
  ],
  narrow_path: [
    { key: "f-sofa", requires: "sofa", kind: "rearrange", title: "Your sofa: move it back to widen the path", detail: "Push your sofa back against the wall so the main route is straight and clear for the mobility aid." },
    { key: "f-armchair", requires: "armchair", kind: "rearrange", title: "Your armchair: move it out of the walking route", detail: "Place your armchair to the side so nobody has to squeeze past it." },
    { key: "f-coffee-table", requires: "coffee_table", kind: "rearrange", title: "Your coffee table: move it to the side", detail: "A low table in the middle of a route is easy to walk into; move it beside the sofa instead." },
    { key: "f-dining", requires: "dining_table", kind: "rearrange", title: "Your dining table: push it and the chairs to one side", detail: "Keep a clear route past the table, and tuck chairs in after use." },
    { key: "f-plants", requires: "plants", kind: "rearrange", title: "Your plants: move the pots off the walking route", detail: "Put plant pots against the walls or on shelves at a safe height." },
    { key: "f-pots", requires: "plant_pots", kind: "rearrange", title: "Your plant pots: move them off the path", detail: "Group pots at the edges of the garden so the path stays wide and clear." },
  ],
  trailing_cables: [
    { key: "f-tv-cables", requires: "tv_unit", kind: "rearrange", title: "Tidy the cables behind your TV unit", detail: "Run TV and charger cables behind your TV unit and along the wall so none cross the floor." },
  ],
  poor_lighting: [
    { key: "f-floor-lamp", requires: "floor_lamp", replaces: "reuse-lamps", kind: "reuse", title: "Move your floor lamp to light the route", detail: "Stand your floor lamp where it lights the path between seats, doors and the bathroom, with its switch easy to reach." },
    { key: "f-garden-lights", requires: "garden_lights", replaces: "outdoor-lights", kind: "reuse", title: "Point your garden lights at the path and steps", detail: "Aim the lights you have along the route from the door, and at any steps or level changes." },
    { key: "f-bedside-lamp", requires: "bedside_lamp", kind: "reuse", title: "Keep your bedside lamp within reach of the bed", detail: "So the light can be switched on before getting up at night." },
  ],
  out_of_reach: [
    { key: "f-shelves-reach", requires: "shelves", kind: "rearrange", title: "Your shelves: keep daily items on the middle shelves", detail: "Between waist and shoulder height, so nobody stretches or bends low.", safetyNote: "Never stand on a chair or stool to reach high shelves." },
    { key: "f-wardrobe", requires: "wardrobe", kind: "rearrange", title: "Your wardrobe: keep everyday clothes at easy height", detail: "Move daily clothes to the middle rails and drawers; store seasonal items higher." },
    { key: "f-counter", requires: "counter_stove", kind: "rearrange", title: "Keep daily kitchen items at the front of your counter", detail: "Cups, kettle and everyday pans where they can be reached without stretching." },
  ],
  entry_step: [
    { key: "f-mat-step", requires: "door_mat", kind: "remove", title: "Move your door mat away from the step edge", detail: "A mat near a step edge can slide or catch a foot or wheel." },
  ],
  no_support_rail: [
    { key: "f-towel-rail", requires: "towel_rail", kind: "rearrange", title: "Your towel rail: use it for towels only", detail: "Don't lean on it or hold it for balance — it isn't built to take a person's weight.", safetyNote: NO_IMPROVISED_SUPPORT },
    { key: "f-basin", requires: "washbasin", kind: "rearrange", title: "Your washbasin: don't lean on it for support", detail: "Basins can crack or come away from the wall under a person's weight.", safetyNote: NO_IMPROVISED_SUPPORT },
  ],
  slippery_floor: [
    { key: "f-bath-mat", requires: "bath_mat", replaces: "remove-slip-mats", kind: "remove", title: "Check your bath mat grips — remove it if it slides", detail: "A mat with a rubber backing that stays put can stay; one that moves underfoot should go." },
    { key: "f-door-mat", requires: "door_mat", kind: "remove", title: "Make sure your door mat lies flat and doesn't slide", detail: "Replace or remove a mat that curls at the edges or moves when stepped on." },
    { key: "f-bucket", requires: "bucket_mug", kind: "rearrange", title: "Keep your bucket and mug within easy reach", detail: "Place them where they can be reached without bending far or stretching across a wet floor." },
    { key: "f-stool", requires: "stool", kind: "rearrange", title: "Keep your stool out of the wet area", detail: "An ordinary stool can slip or tip on a wet floor. Don't use it to sit on while showering.", safetyNote: "For sitting while showering, use a purpose-made shower chair or stool with non-slip feet." },
    { key: "f-shower-chair", requires: "stool", kind: "purchase", title: "Consider a purpose-made shower chair", detail: "Shower chairs have non-slip feet and are rated for a person's weight. An occupational therapist can advise on the right type.", seekProfessional: true },
  ],
};

const NO_IMPROVISED_HANDHOLD =
  "Never use plant pots, garden furniture, a wall edge or a fence as a handhold — they are not built to take a person's weight.";

export const SUGGESTIONS: Record<Concern, readonly Suggestion[]> = {
  uneven_ground: [
    {
      key: "flattest-route",
      kind: "rearrange",
      title: "Choose the flattest route and keep it clear",
      detail: "Use the smoothest way between the door and where people sit, and keep it free of pots and tools so it's easy to follow.",
    },
    {
      key: "level-paving",
      kind: "purchase",
      title: "Have uneven paving professionally levelled or repaired",
      detail: "Lifted slabs, holes and sunken patches are trip hazards for walkers, canes and wheelchairs.",
      seekProfessional: true,
    },
  ],
  steps_no_railing: [
    {
      key: "steps-clear-lit",
      kind: "rearrange",
      title: "Keep the steps clear and well lit",
      detail: "Until a handrail is fitted, keep the steps free of pots and leaves, light them at night, and have someone nearby when they're used.",
      safetyNote: NO_IMPROVISED_HANDHOLD,
    },
    {
      key: "installed-handrail",
      kind: "purchase",
      title: "Have a handrail professionally installed beside the steps",
      detail: "A purpose-built handrail, securely fixed by a qualified installer. Ask about the right height and length.",
      safetyNote: NO_IMPROVISED_HANDHOLD,
      seekProfessional: true,
    },
    {
      key: "garden-ramp",
      kind: "purchase",
      title: "For step-free access, ask about a purpose-built ramp",
      detail: "A ramp made for the purpose, rated for the user and their mobility aid, with advice on slope and installation.",
      safetyNote: NO_STACKED_RAMPS,
      seekProfessional: true,
    },
  ],
  slippery_outdoor: [
    {
      key: "brush-moss",
      kind: "remove",
      title: "Brush away moss, algae and wet leaves",
      detail: "Clear the main path and steps regularly with a stiff brush, especially in shady spots and after rain.",
    },
    {
      key: "outdoor-anti-slip",
      kind: "purchase",
      title: "Use an anti-slip treatment or grip strips on outdoor tiles",
      detail: "Choose products made for outdoor use and wet weather.",
    },
  ],
  loose_gravel: [
    {
      key: "firm-route",
      kind: "rearrange",
      title: "Use a firm route around gravel areas",
      detail: "Loose gravel is hard going for wheels, walker feet and canes; plan the route over firm, level ground where possible.",
    },
    {
      key: "firm-path",
      kind: "purchase",
      title: "Ask about a firm, level path through the gravel",
      detail: "Paving or a stabilised path makes the route usable with a mobility aid.",
      seekProfessional: true,
    },
  ],
  low_branches: [
    {
      key: "trim-branches",
      kind: "remove",
      title: "Trim low branches over the path",
      detail: "Cut back branches and plants so the path is clear at head height and wide enough for a mobility aid.",
      safetyNote: "For large branches, or anything that needs a ladder, use a professional.",
    },
  ],
  path_clutter: [
    {
      key: "clear-path",
      kind: "remove",
      title: "Clear hoses, pots and tools off the path",
      detail: "Keep the route from the door free of anything that could catch a foot or a wheel.",
    },
  ],
  loose_rugs: [
    {
      key: "remove-rugs",
      kind: "remove",
      title: "Take up loose rugs and mats",
      detail: "Roll up and store rugs and mats that sit on walking routes. Curled edges and sliding mats are common trip hazards.",
    },
  ],
  clutter: [
    {
      key: "reuse-baskets",
      kind: "reuse",
      title: "Use existing baskets or boxes for storage",
      detail: "Gather floor items into baskets or boxes you already own and place them beside furniture, off the walking route.",
      safetyNote: "Use them for storage only — never stand on or step onto them.",
    },
    {
      key: "remove-clutter",
      kind: "remove",
      title: "Clear the main walking route",
      detail: "Remove shoes, bags, and other items from the floor along the routes used most, especially bed to bathroom.",
    },
  ],
  narrow_path: [
    {
      key: "rearrange-furniture",
      kind: "rearrange",
      title: "Move furniture to widen the main route",
      detail: "Push furniture toward walls to create a straight, clear path. Measure the mobility aid's width and leave extra room for hands and elbows.",
    },
    {
      key: "turning-space",
      kind: "rearrange",
      title: "Create turning space",
      detail: "Clear an open area where the wheelchair or walker can turn around. An occupational therapist can advise on the space needed.",
      aids: ["wheelchair", "walker"],
      seekProfessional: true,
    },
  ],
  trailing_cables: [
    {
      key: "reroute-cables",
      kind: "rearrange",
      title: "Re-route cables along walls",
      detail: "Run cables along walls or behind furniture so none cross a walking route. Move lamps or devices closer to sockets if needed.",
    },
    {
      key: "reuse-ties",
      kind: "reuse",
      title: "Bundle cables with ties you already have",
      detail: "Use existing twist ties, velcro straps, or clips to keep loose cable lengths tidy and off the floor.",
    },
  ],
  poor_lighting: [
    {
      key: "reuse-lamps",
      rooms: INDOOR,
      kind: "reuse",
      title: "Move existing lamps onto the route",
      detail: "Reposition lamps you already own to light the path between bed, bathroom, and doors, with switches reachable before entering a dark area.",
    },
    {
      key: "night-lights",
      rooms: INDOOR,
      kind: "purchase",
      title: "Add plug-in or motion-sensor night lights",
      detail: "Low-cost night lights along the bed-to-bathroom route help at night without anyone searching for a switch.",
    },
    {
      key: "outdoor-lights",
      rooms: OUTDOOR,
      kind: "purchase",
      title: "Add solar or motion-sensor path lights",
      detail: "Low path lights along the route from the door, and at any steps, help at dusk and at night.",
    },
    {
      key: "contrast-edges",
      kind: "purchase",
      title: "Mark step and threshold edges with high-contrast tape",
      detail: "Anti-slip, high-contrast tape on step edges makes level changes easier to see.",
      aids: ["low_vision"],
    },
  ],
  out_of_reach: [
    {
      key: "rearrange-reach",
      kind: "rearrange",
      title: "Move everyday items to easy reach",
      detail: "Store daily-use items between waist and shoulder height, or within seated reach for a wheelchair user, so no one has to stretch, bend low, or climb.",
    },
    {
      key: "reuse-shelves",
      kind: "reuse",
      title: "Repurpose lower shelves and drawers",
      detail: "Swap rarely used items onto high shelves and bring everyday items down to existing shelves and drawers at an accessible height.",
      safetyNote: "Never stand on a chair or stool to reach high storage.",
    },
  ],
  entry_step: [
    {
      key: "clear-step-area",
      kind: "remove",
      title: "Clear the area around the step",
      detail: "Keep the area before and after the step free of mats, shoes, and clutter so the level change is clear.",
    },
    {
      key: "purpose-built-ramp",
      kind: "purchase",
      title: "Get a purpose-built ramp or threshold ramp",
      detail: "Choose a ramp made for the purpose, rated for the user's and the mobility aid's combined weight, and sized for the step height. Seek advice on slope and installation.",
      safetyNote: NO_STACKED_RAMPS,
      seekProfessional: true,
    },
  ],
  no_support_rail: [
    {
      key: "rearrange-route",
      kind: "rearrange",
      title: "Keep the route to this spot clear and well lit",
      detail: "Until proper support is installed, keep the approach clear and lit, and plan for someone to be nearby when this area is used.",
      safetyNote: NO_IMPROVISED_SUPPORT,
    },
    {
      key: "installed-support",
      kind: "purchase",
      title: "Have grab bars or a handrail professionally installed",
      detail: "Use purpose-built grab bars or handrails, fixed securely into a suitable wall by a qualified installer. An occupational therapist can advise on position.",
      safetyNote: NO_IMPROVISED_SUPPORT,
      seekProfessional: true,
    },
  ],
  slippery_floor: [
    {
      key: "remove-slip-mats",
      kind: "remove",
      title: "Remove mats that slide",
      detail: "Take out bath mats or kitchen mats that move underfoot, and wipe up water promptly.",
    },
    {
      key: "rearrange-toiletries",
      kind: "rearrange",
      title: "Place essentials within reach of wet areas",
      detail: "Keep towels and toiletries reachable from the shower or bath so no one has to step or stretch across a wet floor.",
    },
    {
      key: "non-slip",
      kind: "purchase",
      title: "Use non-slip mats or anti-slip floor treatment",
      detail: "Choose products designed for wet areas, such as a suction-backed bath mat or anti-slip floor treatment.",
    },
  ],
};

/**
 * Build a plan from a home profile. Items are ordered reuse → rearrange →
 * remove → purchase, then by the order the rooms were chosen.
 */
/** Concerns that can apply to a space (any of its own or merged room types). */
export function concernsFor(space: RoomSpace): Concern[] {
  const types = typesOf(space);
  return (Object.keys(CONCERNS) as Concern[]).filter((c) => CONCERNS[c].rooms.some((t) => types.includes(t)));
}

export function generatePlan(profile: HomeProfile): PlanItem[] {
  const items: PlanItem[] = [];
  for (const room of profile.rooms) {
    const applicable = concernsFor(spaceOf(profile, room));
    const has = new Set(profile.furniture?.[room]?.items ?? []);
    for (const concern of profile.concerns[room] ?? []) {
      if (!applicable.includes(concern)) continue;
      // Advice about the user's own furniture comes first (within each kind, after sorting).
      const own = (FURNITURE_SUGGESTIONS[concern] ?? []).filter((f) => has.has(f.requires));
      const replaced = new Set(own.map((f) => f.replaces).filter(Boolean));
      for (const f of own) {
        items.push({
          id: `${room}:${concern}:${f.key}`,
          room,
          concern,
          kind: f.kind,
          title: f.title,
          detail: f.detail,
          safetyNote: f.safetyNote,
          seekProfessional: f.seekProfessional ?? false,
          furniture: f.requires,
        });
      }
      const types = typesOf(spaceOf(profile, room));
      for (const s of SUGGESTIONS[concern]) {
        if (replaced.has(s.key)) continue;
        if (s.rooms && !s.rooms.some((t) => types.includes(t))) continue;
        if (s.aids && !s.aids.some((aid) => profile.aids.includes(aid))) continue;
        items.push({
          id: `${room}:${concern}:${s.key}`,
          room,
          concern,
          kind: s.kind,
          title: s.title,
          detail: s.detail,
          safetyNote: s.safetyNote,
          seekProfessional: s.seekProfessional ?? false,
        });
      }
    }
  }
  // Array.prototype.sort is stable, so room order is kept within each kind.
  return items.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}
