import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the product name and tagline", async () => {
    render(<App />);
    // The landing page is its own lazily loaded chunk.
    expect(await screen.findByRole("heading", { name: "NookSure AI" }, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText("Prepare thoughtfully. Reuse wisely.")).toBeTruthy();
  });
});
