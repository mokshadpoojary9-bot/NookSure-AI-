import { z } from "zod";
import { RecommendationKindSchema, type RecommendationKind } from "./schemas";
import { HomeLayoutSchema, RoomIdSchema, RoomTypeSchema, spaceOf, typesOf, type RoomSpace, type RoomType } from "./home";

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

export const CONCERNS: Record<Concern, { label: string; rooms: readonly RoomType[] }> = {
  loose_rugs: { label: "Loose rugs or mats on walking routes", rooms: ALL_ROOMS },
  clutter: { label: "Clutter on the floor or walkways", rooms: ALL_ROOMS },
  narrow_path: { label: "Narrow path between furniture", rooms: ["entrance", "living_room", "bedroom", "kitchen", "hallway_stairs", "balcony"] },
  trailing_cables: { label: "Trailing cables or extension cords", rooms: ["living_room", "bedroom", "kitchen", "hallway_stairs"] },
  poor_lighting: { label: "Dim lighting on routes or at night", rooms: ALL_ROOMS },
  out_of_reach: { label: "Everyday items stored too high or too low", rooms: ["bedroom", "bathroom", "kitchen", "living_room"] },
  entry_step: { label: "Step or raised threshold at a doorway", rooms: ["entrance", "bathroom", "hallway_stairs", "balcony"] },
  no_support_rail: { label: "No grab bar or handrail where support is needed", rooms: ["bathroom", "hallway_stairs", "entrance"] },
  slippery_floor: { label: "Slippery or wet floor", rooms: ["bathroom", "kitchen", "entrance", "balcony"] },
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
}

const NO_IMPROVISED_SUPPORT =
  "Never use towel rails, sinks, furniture, or other fixtures as handholds — they are not built to take a person's weight.";
const NO_STACKED_RAMPS =
  "Never build a ramp or step from stacked bricks, boards, boxes, or books — they can shift or collapse.";

export const SUGGESTIONS: Record<Concern, readonly Suggestion[]> = {
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
      kind: "reuse",
      title: "Move existing lamps onto the route",
      detail: "Reposition lamps you already own to light the path between bed, bathroom, and doors, with switches reachable before entering a dark area.",
    },
    {
      key: "night-lights",
      kind: "purchase",
      title: "Add plug-in or motion-sensor night lights",
      detail: "Low-cost night lights along the bed-to-bathroom route help at night without anyone searching for a switch.",
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
    for (const concern of profile.concerns[room] ?? []) {
      if (!applicable.includes(concern)) continue;
      for (const s of SUGGESTIONS[concern]) {
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
