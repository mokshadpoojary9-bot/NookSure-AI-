import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./components/ErrorBoundary";

afterEach(cleanup);

describe("ErrorBoundary", () => {
  it("shows a friendly message instead of a blank page, and retries", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    function Page() {
      if (broken) throw new Error("boom");
      return <p>Page content</p>;
    }
    render(
      <ErrorBoundary>
        <Page />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/Something went wrong on this page/);

    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Page content")).toBeTruthy();
    vi.restoreAllMocks();
  });
});
