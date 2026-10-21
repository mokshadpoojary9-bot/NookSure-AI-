import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import manifest from "./components/room3d/models.manifest.json";

beforeEach(() => {
  window.scrollTo = () => {};
  window.location.hash = "";
});
afterEach(cleanup);

describe("Credits", () => {
  it("is linked from the footer and credits every CC BY model with author and licence", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "Credits" }).getAttribute("href")).toBe("#/credits");
    act(() => {
      window.location.hash = "#/credits";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("heading", { level: 1, name: "Credits" })).toBeTruthy();
    const attribution = manifest.models.filter((m) => m.license === "CC-BY-4.0");
    expect(attribution.length).toBeGreaterThan(0);
    const text = document.body.textContent ?? "";
    for (const m of attribution) {
      expect(text).toContain(m.name);
      expect(text).toContain(m.author);
    }
    expect(screen.getAllByRole("link", { name: "CC-BY-4.0" }).length).toBe(attribution.length);
  });
});
