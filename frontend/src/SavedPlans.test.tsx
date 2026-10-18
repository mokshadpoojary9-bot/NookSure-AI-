import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthService, AuthUser } from "./auth/authService";

const plans = vi.hoisted(() => ({
  savePlan: vi.fn(),
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  deletePlan: vi.fn(),
}));
vi.mock("./lib/plans", async (importActual) => ({ ...(await importActual<typeof import("./lib/plans")>()), ...plans }));

import { App } from "./App";
import { PlanStoreError } from "./lib/plans";

const USER: AuthUser = { uid: "u1", displayName: "Asha", email: null, photoURL: null };

/** Fake auth that starts signed in (or signed out) without touching Firebase. */
function authAs(user: AuthUser | null): AuthService {
  return {
    configured: true,
    onChange: (cb) => {
      queueMicrotask(() => cb(user));
      return () => {};
    },
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };
}

const navigate = (hash: string) =>
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

/** Seeds a finished plan so the planner opens on the plan step. */
const seedPlan = () =>
  localStorage.setItem(
    "nooksure.planner.v1",
    JSON.stringify({
      step: 3,
      profile: { aids: ["walker"], rooms: ["living_room"], concerns: { living_room: ["clutter"] }, notes: "" },
      done: [],
    }),
  );

beforeEach(() => {
  window.scrollTo = () => {};
  localStorage.clear();
  window.location.hash = "";
  Object.values(plans).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe("guests", () => {
  it("in guest mode (no Firebase) the plan view is unchanged and nothing is saved", () => {
    seedPlan();
    render(<App />);
    navigate("#/plan");
    expect(screen.getByRole("heading", { name: /Your “Use What You Have” plan/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
    expect(screen.queryByText(/to save plans/)).toBeNull();
    expect(screen.queryByRole("link", { name: "My saved plans" })).toBeNull();
    expect(plans.savePlan).not.toHaveBeenCalled();
  });

  it("signed-out users see a sign-in hint and never call Firestore", async () => {
    seedPlan();
    render(<App authService={authAs(null)} />);
    navigate("#/plan");
    expect(await screen.findByText("Sign in with Google to save plans.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Save plan/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "My saved plans" })).toBeNull();
    navigate("#/saved");
    expect(screen.getByText(/Sign in with Google to see and save your plans/)).toBeTruthy();
    expect(Object.values(plans).every((f) => f.mock.calls.length === 0)).toBe(true);
  });
});

describe("Save plan button", () => {
  it("goes saving → saved, ignores double clicks, then offers 'Save changes'", async () => {
    let resolve!: (id: string) => void;
    plans.savePlan.mockImplementationOnce(() => new Promise<string>((r) => (resolve = r)));
    seedPlan();
    render(<App authService={authAs(USER)} />);
    navigate("#/plan");

    fireEvent.change(await screen.findByRole("textbox", { name: "Plan name" }), { target: { value: "Dad's visit" } });
    const button = screen.getByRole("button", { name: "Save plan" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(plans.savePlan).toHaveBeenCalledTimes(1);
    expect(plans.savePlan.mock.calls[0]).toEqual([
      expect.objectContaining({ title: "Dad's visit", done: [] }),
      undefined,
    ]);

    await act(async () => resolve("plan-1"));
    expect(screen.getByText("Saved to your account ✓")).toBeTruthy();

    // Editing clears "saved"; the next save updates the same plan.
    plans.savePlan.mockResolvedValueOnce("plan-1");
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    expect(screen.queryByText("Saved to your account ✓")).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save changes" })));
    expect(plans.savePlan.mock.calls[1]?.[1]).toBe("plan-1");
  });

  it("shows a friendly error and lets the user retry", async () => {
    plans.savePlan.mockRejectedValueOnce(new PlanStoreError("You seem to be offline. Check your connection and try again."));
    seedPlan();
    render(<App authService={authAs(USER)} />);
    navigate("#/plan");
    // Role-by-name queries are slow on the large plan page; wait for the input first.
    await screen.findByRole("textbox", { name: "Plan name" });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save plan" })));
    expect(screen.getByRole("alert").textContent).toMatch(/seem to be offline/);
    expect((screen.getByRole("button", { name: "Save plan" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("My saved plans", () => {
  it("shows the empty state", async () => {
    plans.listPlans.mockResolvedValueOnce([]);
    render(<App authService={authAs(USER)} />);
    await screen.findByRole("link", { name: "My saved plans" });
    navigate("#/saved");
    expect(await screen.findByText("No saved plans yet")).toBeTruthy();
  });

  it("lists plans, opens one into the planner, and deletes only after confirmation", async () => {
    plans.listPlans.mockResolvedValueOnce([
      { id: "p2", title: "Newer", itemCount: 3, updatedAt: new Date("2026-10-18T10:00:00Z") },
      { id: "p1", title: "Older", itemCount: 1, updatedAt: new Date("2026-10-01T10:00:00Z") },
    ]);
    render(<App authService={authAs(USER)} />);
    await screen.findByRole("link", { name: "My saved plans" });
    navigate("#/saved");

    const items = await screen.findAllByRole("heading", { level: 2 });
    expect(items.map((h) => h.textContent)).toEqual(["Newer", "Older"]);

    // Delete asks first; Cancel keeps it.
    fireEvent.click(screen.getByRole("button", { name: "Delete Older" }));
    const confirm = screen.getByRole("group", { name: "Confirm deleting Older" });
    expect(within(confirm).getByText(/can’t be undone/)).toBeTruthy();
    expect(document.activeElement?.textContent).toBe("Yes, delete");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(plans.deletePlan).not.toHaveBeenCalled();

    plans.deletePlan.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Delete Older" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Yes, delete" })));
    expect(plans.deletePlan).toHaveBeenCalledWith("p1");
    expect(screen.queryByText("Older")).toBeNull();

    // Open loads it into the existing plan view.
    plans.getPlan.mockResolvedValueOnce({
      id: "p2",
      title: "Newer",
      profile: { aids: [], rooms: ["kitchen"], concerns: { kitchen: ["poor_lighting"] }, notes: "" },
      done: [],
      items: [],
      createdAt: null,
      updatedAt: null,
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open Newer" })));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Home planner" })).toBeTruthy());
    expect(screen.getByText("Move existing lamps onto the route")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Plan name" }) as HTMLInputElement).value).toBe("Newer");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });
});
