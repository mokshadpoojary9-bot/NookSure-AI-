import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No WebGL in jsdom: replace the canvas with a stub and skip loading three.js internals.
const canvas = vi.hoisted(() => ({ throwOnRender: false }));
vi.mock("@react-three/fiber", () => ({
  Canvas: () => {
    if (canvas.throwOnRender) throw new Error("WebGL context lost");
    return <div data-testid="r3f-canvas" />;
  },
}));
vi.mock("@react-three/drei", () => ({
  Html: () => null,
  OrbitControls: () => null,
  RoundedBox: () => null,
  ContactShadows: () => null,
  Environment: () => null,
  Lightformer: () => null,
  useGLTF: () => ({ scene: {} }),
}));

import { App } from "./App";

const webgl = (available: boolean) =>
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue((available ? {} : null) as never);

const seedPlan = () =>
  localStorage.setItem(
    "nooksure.planner.v1",
    JSON.stringify({
      step: 3,
      profile: {
        aids: [],
        rooms: ["bathroom", "living_room"],
        concerns: { bathroom: ["slippery_floor"], living_room: ["poor_lighting"] },
        notes: "",
      },
      done: [],
    }),
  );

async function openPlanWith3D() {
  render(<App />);
  act(() => {
    window.location.hash = "#/plan";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  const toggle = screen.getByRole("button", { name: "Show 3D view" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByRole("button", { name: "Hide 3D view" }).getAttribute("aria-expanded")).toBe("true");
}

beforeEach(() => {
  window.scrollTo = () => {};
  localStorage.clear();
  window.location.hash = "";
  canvas.throwOnRender = false;
  seedPlan();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("3D room view — home layouts", () => {
  it("shows merged spaces as one room with a clear label, and only this home's rooms", async () => {
    localStorage.setItem(
      "nooksure.planner.v1",
      JSON.stringify({
        version: 2,
        step: 4,
        profile: {
          aids: [],
          layout: { homeType: "1bhk", doorIntoLiving: true, openKitchen: true, bathrooms: 1, attachedBathroom: false, balcony: false, customRooms: [] },
          rooms: ["living_room", "bathroom"],
          concerns: { living_room: ["entry_step", "slippery_floor"], bathroom: ["slippery_floor"] },
          notes: "",
        },
        done: [],
      }),
    );
    webgl(true);
    await openPlanWith3D();
    const picker = await screen.findByRole("group", { name: "Room to show in 3D" });
    expect(within(picker).getAllByRole("button").map((b) => b.textContent)).toEqual(["Living room + entrance + open kitchen", "Bathroom"]);
    const issues = await screen.findByRole("list", { name: "Issues in the living room + entrance + open kitchen" });
    expect(issues.textContent).toMatch(/Step at door/); // from the merged entrance
    expect(issues.textContent).toMatch(/Slippery floor/); // from the open kitchen
    // The checklist badge uses the same label.
    expect(screen.getAllByText("Living room + entrance + open kitchen").length).toBeGreaterThan(1);
  });
});

describe("3D room view — furniture and labels", () => {
  it("lists every in-scene label as text, selects its checklist items, and can hide labels", async () => {
    localStorage.setItem(
      "nooksure.planner.v1",
      JSON.stringify({
        version: 3,
        step: 5,
        profile: {
          aids: [],
          rooms: ["living_room"],
          concerns: { living_room: ["narrow_path"] },
          furniture: { living_room: { items: ["sofa"], other: "", skipped: false } },
          notes: "",
        },
        done: [],
      }),
    );
    webgl(true);
    await openPlanWith3D();
    const toggle = await screen.findByRole("button", { name: "Hide labels" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Shows the furniture you told us about/)).toBeTruthy();

    const list = within(screen.getByRole("list", { name: "All labels in this view" }));
    expect(list.getByText("Room: Living room")).toBeTruthy();
    expect(list.getByRole("button", { name: "Narrow path: keep this path clear" })).toBeTruthy();
    fireEvent.click(list.getByRole("button", { name: "Your sofa: move it back to widen the path" }));
    // Selecting a label highlights its checklist items.
    expect(document.querySelectorAll("li.plan-item[data-selected]").length).toBeGreaterThan(0);

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show labels" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("3D room view", () => {
  it("is off by default and the toggle lazy-loads the 3D component", async () => {
    webgl(true);
    await openPlanWith3D();
    expect(await screen.findByTestId("r3f-canvas")).toBeTruthy();
    expect(screen.getByText("Illustrative layout, not to scale.")).toBeTruthy();
    // The checklist is still there for keyboard and screen-reader users.
    expect(screen.getByRole("checkbox", { name: /Remove mats that slide/ })).toBeTruthy();
  });

  it("falls back to the checklist when WebGL is unavailable", async () => {
    webgl(false);
    await openPlanWith3D();
    expect((await screen.findByText(/3D view isn't supported on this device\./)).textContent).toMatch(/checklist below/);
    expect(screen.queryByTestId("r3f-canvas")).toBeNull();
    expect(screen.getByRole("checkbox", { name: /Remove mats that slide/ })).toBeTruthy();
  });

  it("falls back via the error boundary when the scene throws", async () => {
    webgl(true);
    canvas.throwOnRender = true;
    // The thrown error is expected and caught by the boundary; keep React/jsdom from logging it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener("error", swallow);
    try {
      await openPlanWith3D();
      expect(await screen.findByText(/3D view isn't supported on this device\./)).toBeTruthy();
      expect(screen.getByRole("checkbox", { name: /Remove mats that slide/ })).toBeTruthy();
    } finally {
      window.removeEventListener("error", swallow);
    }
  });

  it("room picker switches rooms", async () => {
    webgl(true);
    await openPlanWith3D();
    const picker = await screen.findByRole("group", { name: "Room to show in 3D" });
    expect(within(picker).getByRole("button", { name: "Bathroom" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("list", { name: "Issues in the bathroom" }).textContent).toMatch(/Slippery floor/);

    fireEvent.click(within(picker).getByRole("button", { name: "Living room" }));
    expect(within(picker).getByRole("button", { name: "Living room" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("list", { name: "Issues in the living room" }).textContent).toMatch(/Dim lighting/);
  });

  it("selecting an issue highlights its checklist items, and clicking an item selects it in 3D", async () => {
    webgl(true);
    await openPlanWith3D();
    const issue = await screen.findByRole("button", { name: "Slippery floor — High priority" });
    fireEvent.click(issue);
    expect(issue.getAttribute("aria-pressed")).toBe("true");
    const highlighted = document.querySelectorAll("li.plan-item[data-selected]");
    expect(highlighted.length).toBe(3); // remove mats, rearrange toiletries, non-slip
    expect(screen.getByText(/Slippery or wet floor in the bathroom: 3 checklist items highlighted/)).toBeTruthy();

    // List → 3D: clicking a living-room item switches the 3D room and selects its issue.
    fireEvent.click(screen.getByText("Move existing lamps onto the route"));
    const picker = screen.getByRole("group", { name: "Room to show in 3D" });
    expect(within(picker).getByRole("button", { name: "Living room" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Dim lighting — Medium priority" }).getAttribute("aria-pressed")).toBe("true");
  });
});
