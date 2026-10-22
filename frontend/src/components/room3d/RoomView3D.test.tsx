import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Never reached without WebGL; mocked so the test doesn't load all of three.js.
vi.mock("@react-three/fiber", () => ({ Canvas: () => null }));
vi.mock("@react-three/drei", () => ({
  Html: () => null,
  OrbitControls: () => null,
  RoundedBox: () => null,
  ContactShadows: () => null,
  Environment: () => null,
  Lightformer: () => null,
  useGLTF: () => ({ scene: {} }),
}));

import RoomView3D from "./RoomView3D";

// jsdom has no WebGL: getContext returns null, so the component must fall back cleanly.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RoomView3D without WebGL", () => {
  it("explains the fallback and still lists the room's issues with the not-to-scale note", () => {
    render(
      <RoomView3D
        room="entrance"
        profile={{ aids: [], rooms: ["entrance"], concerns: { entrance: ["entry_step", "poor_lighting"] }, notes: "" }}
        done={[]}
      />,
    );
    expect(screen.getByText(/3D view isn't supported on this device./)).toBeTruthy();
    expect(screen.getByText("Illustrative layout, not to scale.")).toBeTruthy();
    const issues = screen.getByRole("list", { name: "Issues in the entrance" });
    expect(issues.textContent).toContain("Step at door — High priority");
    expect(screen.queryByText(/Drag to rotate/)).toBeNull(); // no 3D hints without 3D
    expect(issues.textContent).toContain("Dim lighting — Medium priority");
  });

  it("keeps a capped preview to a few pins, issues first, and says how many are left out", () => {
    render(
      <RoomView3D
        room="living_room"
        profile={{
          aids: [],
          rooms: ["living_room"],
          concerns: { living_room: ["narrow_path", "poor_lighting", "loose_rugs"] },
          furniture: { living_room: { items: ["sofa", "armchair", "coffee_table", "rug", "floor_lamp", "plants"], other: "", skipped: false } },
          notes: "",
        }}
        done={[]}
        maxPins={4}
      />,
    );
    const legend = screen.getByRole("list", { name: "All labels in this view" });
    const items = legend.querySelectorAll("li");
    expect(items.length).toBe(4);
    // All three issues make the cut, numbered in order.
    expect(legend.textContent).toContain("1Narrow path: keep this path clear");
    expect(legend.textContent).toContain("Dim lighting: add a night light here");
    expect(legend.textContent).toContain("Loose rug: roll it up and store it");
    expect(screen.getByText(/^Showing 4 of \d+ labels/)).toBeTruthy();
  });

  it("says when a room has no issues", () => {
    render(<RoomView3D room="kitchen" profile={{ aids: [], rooms: ["kitchen"], concerns: {}, notes: "" }} done={[]} />);
    expect(screen.getByText("No issues were noted for the kitchen.")).toBeTruthy();
  });
});
