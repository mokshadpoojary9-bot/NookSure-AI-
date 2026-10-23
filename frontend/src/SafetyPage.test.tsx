import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SafetyPage } from "./pages/SafetyPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("safety page", () => {
  it("has the hero, five principles, do/don't, professional help and the two actions", () => {
    render(<SafetyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Safety first, always" })).toBeTruthy();
    expect(screen.getByText(/planning guidance, not a safety certificate/)).toBeTruthy();
    const principles = screen.getByRole("heading", { level: 2, name: "Our safety principles" }).closest("section")!;
    expect(within(principles).getAllByRole("heading", { level: 3 })).toHaveLength(5);
    expect(screen.getByRole("heading", { level: 3, name: /Do$/ })).toBeTruthy();
    expect(screen.getByText("Use a towel rail, sink, furniture or fixture as a grab bar or handhold.")).toBeTruthy();
    const chips = screen.getByRole("list", { name: "Get professional help with" });
    expect(within(chips).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Ramps",
      "Railings",
      "Grab bars",
      "Structural changes",
      "Electrical work",
      "Door widening",
    ]);
    expect(screen.getByRole("link", { name: "Build your plan" }).getAttribute("href")).toBe("#/plan");
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Print checklist" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("never claims a home is certified safe, and makes no unverifiable claims", () => {
    render(<SafetyPage />);
    const text = document.body.textContent ?? "";
    // "certified safe" only ever appears in the sentence saying we never use it.
    expect(text.match(/certified safe/g)).toHaveLength(2);
    expect(text).toMatch(/never describes a home as “certified safe”/);
    expect(text).not.toMatch(/\d+\s*%|\btestimonials?\b|★|\brated\b|\btrusted by\b/i);
  });

  it("room tabs follow the ARIA tabs pattern and work from the keyboard", () => {
    render(<SafetyPage />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Entrance", "Living room", "Bedroom", "Kitchen", "Bathroom", "Garden"]);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toMatch(/Clear the area around the step/);

    fireEvent.click(tabs[4]!);
    expect(screen.getByRole("tabpanel", { name: "Bathroom" }).textContent).toMatch(/Remove mats that slide/);
    fireEvent.keyDown(tabs[4]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[5]);
    expect(tabs[5]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[5]!, { key: "ArrowRight" }); // wraps around
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0]!, { key: "End" });
    expect(document.activeElement).toBe(tabs[5]);
    // Only the selected tab is in the tab order; each room shows 4 checks.
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(4);
  });

  it("uses the planner's own safety advice for every quick check", () => {
    render(<SafetyPage />);
    // Tests run from frontend/ (npm workspaces); also allow running from the repo root.
    const file = [resolve("../shared/src/planner.ts"), resolve("shared/src/planner.ts")].find((f) => {
      try {
        return readFileSync(f).length > 0;
      } catch {
        return false;
      }
    })!;
    const rules = readFileSync(file, "utf8");
    for (const tab of screen.getAllByRole("tab")) {
      fireEvent.click(tab);
      for (const li of within(screen.getByRole("tabpanel")).getAllByRole("listitem"))
        expect(rules.includes(`"${li.textContent}"`), `${tab.textContent}: ${li.textContent}`).toBe(true);
    }
  });
});
