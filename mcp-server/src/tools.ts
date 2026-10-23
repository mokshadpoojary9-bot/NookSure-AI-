import { z } from "zod";
import {
  CONCERNS,
  ConcernSchema,
  CUSTOM_ROOM_CHOICES,
  FURNITURE_BY_ROOM,
  FURNITURE_LABELS,
  FurnitureItemSchema,
  GARDEN_TYPE_LABELS,
  GardenTypeSchema,
  HOME_TYPE_HINTS,
  HOME_TYPE_LABELS,
  HomeLayoutSchema,
  HomeProfileSchema,
  HomeTypeSchema,
  KIND_LABELS,
  KIND_ORDER,
  MOBILITY_AID_LABELS,
  MobilityAidSchema,
  ROOM_LABELS,
  RoomIdSchema,
  RoomTypeSchema,
  SAFETY_PRINCIPLES,
  choiceLabel,
  concernsFor,
  furnitureChoicesFor,
  generatePlan,
  generateRooms,
  type FurnitureItem,
  type HomeProfile,
  type PlanItem,
  type RoomSpace,
} from "@nooksure/shared";

/**
 * The MCP tools as plain functions. All planning logic lives in @nooksure/shared
 * (the same code the web app runs); this file only validates input and shapes output.
 */

const DISCLAIMER =
  "Rule-based checklist — not AI analysis. Planning guidance only, not a safety certification; it does not replace an occupational therapist, physiotherapist or qualified installer.";

/** Home layout answers: the web app's own layout schema (home type, door into living room, open kitchen, garden, ...). */
const layoutShape = HomeLayoutSchema.shape;

export const buildPlanShape = {
  ...layoutShape,
  mobilityAids: z.array(MobilityAidSchema).max(5).default([]).describe("Mobility aids used, e.g. [\"walker\"]. See list_options."),
  rooms: z
    .array(RoomIdSchema)
    .max(20)
    .optional()
    .describe("Room ids to plan (from this home's rooms, see list_options). Defaults to every room of the home."),
  furniture: z
    .record(RoomIdSchema, z.array(FurnitureItemSchema).max(40))
    .default({})
    .describe("Furniture the person already has, per room id, e.g. { \"living_room\": [\"sofa\", \"rug\"] }."),
  observations: z
    .record(RoomIdSchema, z.array(ConcernSchema).max(20))
    .default({})
    .describe("What was noticed, per room id, e.g. { \"living_room\": [\"loose_rugs\", \"poor_lighting\"] }."),
};
export const BuildPlanInputSchema = z.object(buildPlanShape);
export type BuildPlanInput = z.input<typeof BuildPlanInputSchema>;

export interface PlanStep {
  step: number;
  kind: PlanItem["kind"];
  kindLabel: string;
  roomId: string;
  room: string;
  concern: string;
  title: string;
  detail: string;
  safetyNote?: string;
  seekProfessional: boolean;
  aboutYourFurniture?: string;
}

export interface PlanResult {
  source: "rule-based";
  disclaimer: string;
  home: { type: string; rooms: { id: string; label: string }[] };
  order: string[];
  steps: PlanStep[];
  /** Input that was valid but ignored (e.g. an observation that doesn't apply to that room). */
  ignored: string[];
}

export class ToolInputError extends Error {}

/** build_home_safety_plan: the exact plan the web app's planner produces for these answers. */
export function buildHomeSafetyPlan(raw: BuildPlanInput): PlanResult {
  const input = BuildPlanInputSchema.parse(raw);
  const { mobilityAids, rooms: wanted, furniture, observations, ...layoutAnswers } = input;
  const layout = HomeLayoutSchema.parse(layoutAnswers);
  if (layout.homeType === "custom" && layout.customRooms.length === 0)
    throw new ToolInputError(`A custom home needs customRooms. Choose from: ${CUSTOM_ROOM_CHOICES.join(", ")}.`);

  const spaces = generateRooms(layout);
  const byId = new Map(spaces.map((s) => [s.id, s]));
  const rooms = wanted ?? spaces.map((s) => s.id);
  const valid = spaces.map((s) => `${s.id} (${s.label})`).join(", ");
  for (const id of [...rooms, ...Object.keys(furniture), ...Object.keys(observations)])
    if (!byId.has(id)) throw new ToolInputError(`"${id}" isn't a room in this home. This home's rooms: ${valid}.`);

  // Keep only what the web app would let someone choose for each room; report the rest.
  const ignored: string[] = [];
  const concerns: HomeProfile["concerns"] = {};
  const own: NonNullable<HomeProfile["furniture"]> = {};
  for (const id of rooms) {
    const space = byId.get(id)!;
    const applicable = concernsFor(space);
    const choices = furnitureChoicesFor(space);
    concerns[id] = [];
    for (const c of observations[id] ?? []) {
      if (applicable.includes(c)) concerns[id].push(c);
      else ignored.push(`Observation "${c}" doesn't apply to ${space.label}.`);
    }
    const items: FurnitureItem[] = [];
    for (const f of furniture[id] ?? []) {
      if (choices.includes(f)) items.push(f);
      else ignored.push(`Furniture "${f}" isn't an option for ${space.label}.`);
    }
    if (items.length) own[id] = { items, other: "", skipped: false };
  }
  for (const id of Object.keys(observations)) if (!rooms.includes(id)) ignored.push(`Observations for ${byId.get(id)!.label} ignored: that room isn't in "rooms".`);
  for (const id of Object.keys(furniture)) if (!rooms.includes(id)) ignored.push(`Furniture for ${byId.get(id)!.label} ignored: that room isn't in "rooms".`);

  const profile = HomeProfileSchema.parse({ aids: mobilityAids, rooms, concerns, notes: "", layout, furniture: own });
  const steps = generatePlan(profile).map((item, i): PlanStep => ({
    step: i + 1,
    kind: item.kind,
    kindLabel: KIND_LABELS[item.kind],
    roomId: item.room,
    room: byId.get(item.room)!.label,
    concern: CONCERNS[item.concern].label,
    title: item.title,
    detail: item.detail,
    ...(item.safetyNote ? { safetyNote: item.safetyNote } : {}),
    seekProfessional: item.seekProfessional,
    ...(item.furniture ? { aboutYourFurniture: FURNITURE_LABELS[item.furniture].label } : {}),
  }));

  return {
    source: "rule-based",
    disclaimer: DISCLAIMER,
    home: { type: HOME_TYPE_LABELS[layout.homeType], rooms: rooms.map((id) => ({ id, label: byId.get(id)!.label })) },
    order: KIND_ORDER.map((k) => KIND_LABELS[k]),
    steps,
    ignored,
  };
}

/** Readable version of a plan, for agents that only show text. */
export function planAsText(plan: PlanResult): string {
  const lines = [`Home safety plan — ${plan.home.type}: ${plan.home.rooms.map((r) => r.label).join(", ")}`, plan.disclaimer, ""];
  if (plan.steps.length === 0) lines.push("No observations were given for these rooms, so there is nothing to plan yet.");
  for (const kind of plan.order) {
    const steps = plan.steps.filter((s) => s.kindLabel === kind);
    if (!steps.length) continue;
    lines.push(`${kind}:`);
    for (const s of steps) {
      lines.push(`${s.step}. [${s.room}] ${s.title} — ${s.detail}`);
      if (s.safetyNote) lines.push(`   Safety: ${s.safetyNote}`);
      if (s.seekProfessional) lines.push("   Seek professional advice.");
    }
    lines.push("");
  }
  if (plan.ignored.length) lines.push("Ignored input:", ...plan.ignored.map((m) => `- ${m}`));
  return lines.join("\n").trim();
}

export const listOptionsShape = {
  homeType: HomeTypeSchema.optional().describe("Optional: also list this home's rooms with the furniture and observations that apply to each."),
  doorIntoLiving: z.boolean().optional(),
  openKitchen: z.boolean().optional(),
  bathrooms: z.number().int().min(1).max(3).optional(),
  attachedBathroom: z.boolean().optional(),
  balcony: z.boolean().optional(),
  customRooms: z.array(RoomIdSchema).optional(),
  garden: z.boolean().optional(),
  gardenType: GardenTypeSchema.optional(),
  gardenSteps: z.boolean().optional(),
};
const ListOptionsInputSchema = z.object(listOptionsShape);

const roomOptions = (space: RoomSpace) => ({
  id: space.id,
  label: space.label,
  furniture: furnitureChoicesFor(space).map((id) => ({ id, label: FURNITURE_LABELS[id].label })),
  observations: concernsFor(space).map((id) => ({ id, label: CONCERNS[id].label })),
});

/** list_options: every valid value, optionally with the rooms of one home layout. */
export function listOptions(raw: z.input<typeof ListOptionsInputSchema> = {}) {
  const input = ListOptionsInputSchema.parse(raw);
  const options = {
    homeTypes: HomeTypeSchema.options.map((id) => ({ id, label: HOME_TYPE_LABELS[id], hint: HOME_TYPE_HINTS[id] })),
    customRooms: CUSTOM_ROOM_CHOICES.map((id) => ({ id, label: choiceLabel(id) })),
    gardenTypes: GardenTypeSchema.options.map((id) => ({ id, label: GARDEN_TYPE_LABELS[id] })),
    roomTypes: RoomTypeSchema.options.map((id) => ({ id, label: ROOM_LABELS[id] })),
    mobilityAids: MobilityAidSchema.options.map((id) => ({ id, label: MOBILITY_AID_LABELS[id] })),
    furnitureByRoomType: Object.fromEntries(
      Object.entries(FURNITURE_BY_ROOM).map(([room, items]) => [room, items!.map((id) => ({ id, label: FURNITURE_LABELS[id].label }))]),
    ),
    observations: ConcernSchema.options.map((id) => ({ id, label: CONCERNS[id].label, roomTypes: [...CONCERNS[id].rooms] })),
    planOrder: KIND_ORDER.map((k) => KIND_LABELS[k]),
  };
  if (!input.homeType) return options;
  const { homeType, ...rest } = input;
  const layout = HomeLayoutSchema.parse({ homeType, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) });
  return { ...options, home: { type: HOME_TYPE_LABELS[homeType], rooms: generateRooms(layout).map(roomOptions) } };
}

/** get_safety_principles: the app's safety rules, exactly as in docs/safety.md. */
export function getSafetyPrinciples() {
  return SAFETY_PRINCIPLES;
}
