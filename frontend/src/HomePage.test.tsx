import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", () => ({ Canvas: () => <div data-testid="r3f-canvas" /> }));
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

beforeEach(() => {
  window.scrollTo = () => {};
  window.location.hash = "";
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("landing page", () => {
  it("has the hero, how it works, key features, who it's for, a safety note and a credits link", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "NookSure AI" })).toBeTruthy();
    expect(screen.getByText("Make your home safer for mobility needs — using what you already have.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start planning" }).getAttribute("href")).toBe("#/plan");

    const how = screen.getByRole("heading", { level: 2, name: "How it works" }).closest("section")!;
    expect(within(how).getAllByRole("listitem").slice(0, 3).map((li) => li.querySelector("h3")?.textContent)).toEqual([
      "Tell us your home",
      "Pick needs, furniture and issues",
      "Get an ordered plan and a labelled 3D view",
    ]);
    const features = screen.getByRole("heading", { level: 2, name: "Key features" }).closest("section")!;
    expect(within(features).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Home layout setup",
      "Furniture-aware, reuse-first plan",
      "Labelled 3D view with overlays",
      "Garden and outdoor areas",
      "AI assistant",
      "Saved plans",
    ]);
    const audience = screen.getByRole("heading", { level: 2, name: "Who it’s for" }).closest("section")!;
    expect(within(audience).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Walker users",
      "Wheelchair users",
      "Older adults",
      "Caregivers",
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "A note on safety" }).closest("section")!.textContent).toMatch(
      /planning guidance, not a safety certificate/,
    );
    expect(screen.getByRole("link", { name: "Credits" })).toBeTruthy();
  });

  it("makes no unverifiable claims (no stats, testimonials or ratings)", () => {
    render(<App />);
    const text = document.querySelector("main")!.textContent ?? "";
    expect(text).not.toMatch(/\d+\s*%|\b\d[\d,]*\+?\s*(users|homes|families|people)\b|\btestimonials?\b|★|\brated\b|\btrusted by\b/i);
  });

  it("'See how it works' moves focus to that section without changing the page", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "See how it works" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "How it works" }).closest("section"));
    expect(window.location.hash).toBe("");
  });

  it("loads the live 3D example only on request, clearly labelled as an example", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    render(<App />);
    expect(screen.queryByTestId("r3f-canvas")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show a live 3D example" }));
    expect(screen.getByText("Example room — not your home")).toBeTruthy();
    expect(await screen.findByTestId("r3f-canvas")).toBeTruthy();
    expect(screen.getByText("Illustrative layout, not to scale.")).toBeTruthy();
  });
});
