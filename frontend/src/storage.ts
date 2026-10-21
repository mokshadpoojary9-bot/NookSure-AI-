import { z } from "zod";
import { HomeProfileSchema, legacyLayout, type HomeProfile } from "@nooksure/shared";

/** Planner steps: 0 Household, 1 Your home, 2 Rooms, 3 Observations, 4 Your plan. */
export const PLAN_STEP = 4;
const VERSION = 2; // v2 added the "Your home" step

/**
 * Planner draft saved in this browser. Signed-in users can additionally save
 * plans to their account (see lib/plans.ts); guests' data never leaves the device.
 */
export const PlannerStateSchema = z.object({
  /** Missing on drafts saved before the "Your home" step existed. */
  version: z.number().int().optional(),
  step: z.number().int().min(0).max(PLAN_STEP),
  profile: HomeProfileSchema,
  done: z.array(z.string()),
  /** Name used when saving to the account. */
  title: z.string().max(120).optional(),
  /** The Firestore plan this draft was saved as / opened from, and whose it is. */
  saved: z.object({ id: z.string(), uid: z.string() }).optional(),
});
export type PlannerState = z.infer<typeof PlannerStateSchema>;

const KEY = "nooksure.planner.v1";

export const emptyState = (): PlannerState => ({
  version: VERSION,
  step: 0,
  profile: { aids: [], rooms: [], concerns: {}, notes: "" },
  done: [],
});

/** Plans from before home layouts existed: a Custom home with exactly their rooms. */
export function withLayout(profile: HomeProfile): HomeProfile {
  return profile.layout || profile.rooms.length === 0 ? profile : { ...profile, layout: legacyLayout(profile.rooms) };
}

export function loadState(): PlannerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    // v1 drafts: steps after Household move up one to make room for "Your home".
    if (data && typeof data === "object" && data.version !== VERSION && typeof data.step === "number" && data.step >= 1) {
      data.step = Math.min(data.step + 1, PLAN_STEP);
    }
    const parsed = PlannerStateSchema.safeParse(data);
    if (!parsed.success) return emptyState();
    return { ...parsed.data, version: VERSION, profile: withLayout(parsed.data.profile) };
  } catch {
    return emptyState();
  }
}

export function saveState(state: PlannerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: VERSION }));
  } catch {
    // Storage can be unavailable (private mode, blocked); the planner still works.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
