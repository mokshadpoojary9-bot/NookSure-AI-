import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Never reached without WebGL; mocked so the test doesn't load all of three.js.
vi.mock("@react-three/fiber", () => ({ Canvas: () => null }));
vi.mock("@react-three/drei", () => ({ Html: () => null, OrbitControls: () => null }));

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

  it("says when a room has no issues", () => {
    render(<RoomView3D room="kitchen" profile={{ aids: [], rooms: ["kitchen"], concerns: {}, notes: "" }} done={[]} />);
    expect(screen.getByText("No issues were noted for the kitchen.")).toBeTruthy();
  });
});
