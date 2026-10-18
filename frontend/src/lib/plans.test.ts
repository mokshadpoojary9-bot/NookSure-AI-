import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeProfile } from "@nooksure/shared";

// --- Mocks: no real Firebase or network --------------------------------------
const state = vi.hoisted(() => ({ uid: "user-1" as string | null, configured: true }));

vi.mock("../auth/firebase", () => ({
  get isFirebaseConfigured() {
    return state.configured;
  },
  getFirebaseAuth: vi.fn(async () => ({ currentUser: state.uid ? { uid: state.uid } : null })),
  getFirebaseDb: vi.fn(async () => ({ db: true })),
}));

const fs = vi.hoisted(() => ({
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  collection: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  query: vi.fn((ref: unknown) => ref),
  orderBy: vi.fn(),
  limit: vi.fn(),
  addDoc: vi.fn(async () => ({ id: "new-plan" })),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock("firebase/firestore", () => fs);

import { PlanStoreError, deletePlan, getPlan, listPlans, savePlan } from "./plans";

const profile: HomeProfile = {
  aids: ["walker"],
  rooms: ["bathroom"],
  concerns: { bathroom: ["slippery_floor"] },
  notes: "",
};
const ts = (iso: string) => ({ toDate: () => new Date(iso) });

beforeEach(() => {
  state.uid = "user-1";
  state.configured = true;
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("savePlan", () => {
  it("creates users/{uid}/plans with server timestamps and no uid field", async () => {
    const id = await savePlan({ title: "  Mum's visit  ", profile, done: ["bathroom:slippery_floor:non-slip", "bogus"] });
    expect(id).toBe("new-plan");
    const [ref, data] = fs.addDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe("users/user-1/plans");
    expect(data).toMatchObject({ title: "Mum's visit", createdAt: "SERVER_TS", updatedAt: "SERVER_TS", appVersion: "0.1.0" });
    expect(data.done).toEqual(["bathroom:slippery_floor:non-slip"]); // unknown ids dropped
    expect((data.items as unknown[]).length).toBeGreaterThan(0);
    expect(Object.keys(data)).not.toContain("uid");
    expect(JSON.stringify(data)).not.toContain("user-1");
  });

  it("updates an existing plan without touching createdAt", async () => {
    await savePlan({ title: "Plan", profile, done: [] }, "plan-9");
    const [ref, data] = fs.updateDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>];
    expect(ref.path).toBe("users/user-1/plans/plan-9");
    expect(data.updatedAt).toBe("SERVER_TS");
    expect(data).not.toHaveProperty("createdAt");
    expect(fs.addDoc).not.toHaveBeenCalled();
  });

  it("validates the title before any Firestore call", async () => {
    await expect(savePlan({ title: "   ", profile, done: [] })).rejects.toThrow("Please give your plan a name.");
    await expect(savePlan({ title: "x".repeat(121), profile, done: [] })).rejects.toThrow(/up to 120/);
    expect(fs.addDoc).not.toHaveBeenCalled();
  });

  it("refuses guests and unconfigured Firebase without calling Firestore", async () => {
    state.uid = null;
    await expect(savePlan({ title: "Plan", profile, done: [] })).rejects.toThrow("Sign in with Google to save plans.");
    state.configured = false;
    await expect(listPlans()).rejects.toBeInstanceOf(PlanStoreError);
    expect(fs.addDoc).not.toHaveBeenCalled();
    expect(fs.getDocs).not.toHaveBeenCalled();
  });

  it("maps permission errors to a friendly message", async () => {
    fs.addDoc.mockRejectedValueOnce({ code: "permission-denied", message: "Missing or insufficient permissions." });
    await expect(savePlan({ title: "Plan", profile, done: [] })).rejects.toThrow(/don't have permission/);
  });

  it("reports offline instead of hanging when a write never confirms", async () => {
    vi.useFakeTimers();
    fs.addDoc.mockImplementationOnce(() => new Promise(() => {}));
    const pending = savePlan({ title: "Plan", profile, done: [] });
    const assertion = expect(pending).rejects.toThrow(/seem to be offline/);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});

describe("listPlans / getPlan / deletePlan", () => {
  it("lists the user's plans newest first", async () => {
    fs.getDocs.mockResolvedValueOnce({
      docs: [{ id: "a", data: () => ({ title: "Visit", items: [1, 2], updatedAt: ts("2026-10-18T10:00:00Z") }) }],
    });
    const plans = await listPlans();
    expect(plans).toEqual([{ id: "a", title: "Visit", itemCount: 2, updatedAt: new Date("2026-10-18T10:00:00Z") }]);
    expect((fs.collection.mock.calls[0] as unknown[]).slice(1)).toEqual(["users", "user-1", "plans"]);
    expect(fs.orderBy).toHaveBeenCalledWith("updatedAt", "desc");
  });

  it("loads a plan and returns null for missing or unreadable ones", async () => {
    fs.getDoc.mockResolvedValueOnce({
      id: "p1",
      exists: () => true,
      data: () => ({ title: "Visit", profile, done: [], items: [], createdAt: ts("2026-10-01T00:00:00Z"), updatedAt: null }),
    });
    expect(await getPlan("p1")).toMatchObject({ id: "p1", title: "Visit", profile, createdAt: new Date("2026-10-01T00:00:00Z") });

    fs.getDoc.mockResolvedValueOnce({ id: "gone", exists: () => false, data: () => undefined });
    expect(await getPlan("gone")).toBeNull();

    fs.getDoc.mockResolvedValueOnce({ id: "bad", exists: () => true, data: () => ({ title: 5 }) });
    expect(await getPlan("bad")).toBeNull();
  });

  it("deletes from the signed-in user's path", async () => {
    await deletePlan("p1");
    expect((fs.doc.mock.calls[0] as unknown[]).slice(1)).toEqual(["users", "user-1", "plans", "p1"]);
    expect(fs.deleteDoc).toHaveBeenCalledTimes(1);
  });

  it("maps offline read errors", async () => {
    fs.getDocs.mockRejectedValueOnce({ code: "unavailable" });
    await expect(listPlans()).rejects.toThrow(/seem to be offline/);
  });
});
