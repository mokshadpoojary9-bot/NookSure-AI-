import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the product name and tagline", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "NookSure AI" })).toBeTruthy();
    expect(screen.getByText("Prepare thoughtfully. Reuse wisely.")).toBeTruthy();
  });
});
