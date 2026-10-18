import { z } from "zod";
import { HomeProfileSchema } from "@nooksure/shared";

/**
 * Planner draft saved in this browser. Signed-in users can additionally save
 * plans to their account (see lib/plans.ts); guests' data never leaves the device.
 */
export const PlannerStateSchema = z.object({
  step: z.number().int().min(0).max(3),
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
  step: 0,
  profile: { aids: [], rooms: [], concerns: {}, notes: "" },
  done: [],
});

export function loadState(): PlannerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = PlannerStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: PlannerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
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
