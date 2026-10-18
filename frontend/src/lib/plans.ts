import { z } from "zod";
import { HomeProfileSchema, PlanItemSchema, generatePlan, type HomeProfile, type PlanItem } from "@nooksure/shared";
import { version as appVersion } from "../../package.json";
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "../auth/firebase";

/**
 * Saved plans in Firestore at users/{uid}/plans/{planId}. The uid always comes
 * from the signed-in Firebase user (and the path), never from a document field.
 * Guests never reach this module: callers only use it when signed in.
 * Rules: see firestore.rules at the repo root.
 */

export const PLAN_TITLE_MAX = 120;
const MAX_DOC_BYTES = 200_000; // far below Firestore's 1 MiB limit
const TIMEOUT_MS = 15_000;
const LIST_LIMIT = 50;

export interface PlanInput {
  title: string;
  profile: HomeProfile;
  /** Ids of checklist items marked done. */
  done: string[];
}

export interface SavedPlan extends PlanInput {
  id: string;
  items: PlanItem[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PlanSummary {
  id: string;
  title: string;
  itemCount: number;
  updatedAt: Date | null;
}

export class PlanStoreError extends Error {
  override readonly name = "PlanStoreError";
  constructor(
    message: string,
    /** Firestore error code when there was one, e.g. "not-found". */
    readonly code?: string,
  ) {
    super(message);
  }
}

const StoredPlanSchema = z.object({
  title: z.string(),
  profile: HomeProfileSchema,
  done: z.array(z.string()).default([]),
  items: z.array(PlanItemSchema).default([]),
});

function friendlyMessage(err: unknown): string {
  switch ((err as { code?: string })?.code) {
    case "permission-denied":
      return "You don't have permission to access this plan. Try signing out and in again.";
    case "unauthenticated":
      return "Please sign in again to use saved plans.";
    case "unavailable":
    case "deadline-exceeded":
      return "You seem to be offline. Check your connection and try again.";
    case "not-found":
      return "That plan no longer exists.";
    case "resource-exhausted":
      return "Too many requests right now. Please wait a moment and try again.";
    default:
      return "Something went wrong with saved plans. Please try again.";
  }
}

/** Firestore writes wait silently while offline, so bound every call. */
async function run<T>(op: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "deadline-exceeded" })), TIMEOUT_MS);
  });
  try {
    return await Promise.race([op(), timeout]);
  } catch (err) {
    if (err instanceof PlanStoreError) throw err;
    throw new PlanStoreError(friendlyMessage(err), (err as { code?: string })?.code);
  } finally {
    clearTimeout(timer);
  }
}

async function currentUid(): Promise<string> {
  if (!isFirebaseConfigured) throw new PlanStoreError("Saved plans need Firebase to be configured.");
  const uid = (await getFirebaseAuth()).currentUser?.uid;
  if (!uid) throw new PlanStoreError("Sign in with Google to save plans.");
  return uid;
}

async function firestore() {
  const [db, fs] = await Promise.all([getFirebaseDb(), import("firebase/firestore")]);
  return { db, fs };
}

const toDate = (v: unknown): Date | null =>
  v && typeof (v as { toDate?: unknown }).toDate === "function" ? (v as { toDate(): Date }).toDate() : null;

function validate(input: PlanInput) {
  const title = input.title.trim();
  if (!title) throw new PlanStoreError("Please give your plan a name.");
  if (title.length > PLAN_TITLE_MAX) throw new PlanStoreError(`Plan names can be up to ${PLAN_TITLE_MAX} characters.`);
  const profile = HomeProfileSchema.parse(input.profile);
  const items = generatePlan(profile);
  const ids = new Set(items.map((i) => i.id));
  const data = { title, profile, done: input.done.filter((id) => ids.has(id)), items, appVersion };
  if (JSON.stringify(data).length > MAX_DOC_BYTES) throw new PlanStoreError("This plan is too large to save.");
  return data;
}

/** Creates a plan, or updates it when `planId` is given. Returns the plan id. */
export async function savePlan(input: PlanInput, planId?: string): Promise<string> {
  const data = validate(input);
  const uid = await currentUid();
  return run(async () => {
    const { db, fs } = await firestore();
    if (planId) {
      await fs.updateDoc(fs.doc(db, "users", uid, "plans", planId), { ...data, updatedAt: fs.serverTimestamp() });
      return planId;
    }
    const ref = await fs.addDoc(fs.collection(db, "users", uid, "plans"), {
      ...data,
      createdAt: fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp(),
    });
    return ref.id;
  });
}

/** The signed-in user's plans, most recently updated first. */
export async function listPlans(): Promise<PlanSummary[]> {
  const uid = await currentUid();
  return run(async () => {
    const { db, fs } = await firestore();
    const snap = await fs.getDocs(
      fs.query(fs.collection(db, "users", uid, "plans"), fs.orderBy("updatedAt", "desc"), fs.limit(LIST_LIMIT)),
    );
    return snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id,
        title: typeof v.title === "string" ? v.title : "Untitled plan",
        itemCount: Array.isArray(v.items) ? v.items.length : 0,
        updatedAt: toDate(v.updatedAt),
      };
    });
  });
}

/** One plan, or null if it doesn't exist or can't be read by this app version. */
export async function getPlan(planId: string): Promise<SavedPlan | null> {
  const uid = await currentUid();
  return run(async () => {
    const { db, fs } = await firestore();
    const snap = await fs.getDoc(fs.doc(db, "users", uid, "plans", planId));
    if (!snap.exists()) return null;
    const raw = snap.data();
    const parsed = StoredPlanSchema.safeParse(raw);
    if (!parsed.success) return null;
    return { id: snap.id, ...parsed.data, createdAt: toDate(raw.createdAt), updatedAt: toDate(raw.updatedAt) };
  });
}

export async function deletePlan(planId: string): Promise<void> {
  const uid = await currentUid();
  await run(async () => {
    const { db, fs } = await firestore();
    await fs.deleteDoc(fs.doc(db, "users", uid, "plans", planId));
  });
}
