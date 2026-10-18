import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

const navigate = (hash: string) =>
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const check = (name: string | RegExp) => fireEvent.click(screen.getByRole("checkbox", { name }));

beforeEach(() => {
  window.scrollTo = () => {}; // not implemented in jsdom
  localStorage.clear();
  window.location.hash = "";
});
afterEach(cleanup);

describe("routing", () => {
  it("navigates between pages and marks the current link", () => {
    render(<App />);
    navigate("#/safety");
    expect(screen.getByRole("heading", { level: 1, name: "Safety principles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Safety" }).getAttribute("aria-current")).toBe("page");
    navigate("#/plan");
    expect(screen.getByRole("heading", { level: 1, name: "Home planner" })).toBeTruthy();
  });

  it("describes the 3D room view as built and illustrative, not to scale", () => {
    render(<App />);
    expect(screen.getByText(/interactive 3D view/).textContent).toMatch(/illustrative layout, not to scale/);
    expect(screen.queryByText(/not built yet/)).toBeNull();
  });
});

describe("planner workflow", () => {
  it("walks from household to a reuse-first plan and tracks progress", () => {
    render(<App />);
    navigate("#/plan");

    check("Wheelchair");
    click("Continue");

    const next = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    check("Bathroom");
    check("Living room");
    click("Continue");

    const bathroom = within(screen.getByRole("group", { name: "Bathroom" }));
    fireEvent.click(bathroom.getByRole("checkbox", { name: /No grab bar/ }));
    const living = within(screen.getByRole("group", { name: "Living room" }));
    fireEvent.click(living.getByRole("checkbox", { name: /Narrow path/ }));
    fireEvent.click(living.getByRole("checkbox", { name: /Dim lighting/ }));
    click("Build my plan");

    expect(screen.getByText("Rule-based checklist — not AI analysis.")).toBeTruthy();

    const groups = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent?.split(" ")[0]);
    expect(groups).toEqual(["Reuse", "Rearrange", "Purchase"]);

    // Wheelchair users get the turning-space suggestion.
    expect(screen.getByText("Create turning space")).toBeTruthy();
    // Support rails route to a professional purchase with a warning.
    expect(screen.getAllByText(/Never use towel rails/).length).toBeGreaterThan(0);

    const total = screen.getAllByRole("checkbox").length;
    expect(screen.getByText(`0 of ${total} done`)).toBeTruthy();
    check(/Move existing lamps/);
    expect(screen.getByText(`1 of ${total} done`)).toBeTruthy();
  });

  it("shows an empty state when nothing was observed", () => {
    render(<App />);
    navigate("#/plan");
    click("Continue");
    check("Kitchen");
    click("Continue");
    click("Build my plan");
    expect(screen.getByText(/nothing to plan yet/)).toBeTruthy();
  });

  it("restores a saved draft and can start over", () => {
    const { unmount } = render(<App />);
    navigate("#/plan");
    check("Walker / rollator");
    click("Continue");
    unmount();

    render(<App />);
    expect(screen.getByRole("heading", { name: "Which rooms should we plan?" })).toBeTruthy();
    click("Back");
    expect((screen.getByRole("checkbox", { name: "Walker / rollator" }) as HTMLInputElement).checked).toBe(true);

    click("Continue");
    check("Bedroom");
    click("Continue");
    click("Build my plan");
    click("Start over");
    expect(screen.getByRole("heading", { name: "Who are you preparing the home for?" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Walker / rollator" }) as HTMLInputElement).checked).toBe(false);
  });

  it("ignores a corrupted saved draft", () => {
    localStorage.setItem("nooksure.planner.v1", "{not json");
    render(<App />);
    navigate("#/plan");
    expect(screen.getByRole("heading", { name: "Who are you preparing the home for?" })).toBeTruthy();
  });
});
