import { z } from "zod";
import { HomeProfileSchema } from "@nooksure/shared";

/**
 * Planner draft saved in this browser only. Firebase-backed persistence is a
 * later milestone; until then nothing leaves the device.
 */
export const PlannerStateSchema = z.object({
  step: z.number().int().min(0).max(3),
  profile: HomeProfileSchema,
  done: z.array(z.string()),
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
