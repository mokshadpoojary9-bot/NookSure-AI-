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
/** "Your home" step: pick a home type (defaults for the other answers), then continue. */
const chooseHome = (type: RegExp = /^1BHK/) => {
  fireEvent.click(screen.getByRole("radio", { name: type }));
  click("Continue");
};

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
    chooseHome();

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
    chooseHome();
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
    expect(screen.getByRole("heading", { name: "Tell us about your home" })).toBeTruthy();
    click("Back");
    expect((screen.getByRole("checkbox", { name: "Walker / rollator" }) as HTMLInputElement).checked).toBe(true);

    click("Continue");
    chooseHome();
    check("Bedroom");
    click("Continue");
    click("Build my plan");
    click("Start over");
    expect(screen.getByRole("heading", { name: "Who are you preparing the home for?" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Walker / rollator" }) as HTMLInputElement).checked).toBe(false);
  });

  it("Your home: Continue waits for a home type; layout answers shape the room list", () => {
    render(<App />);
    navigate("#/plan");
    click("Continue");
    expect(screen.getByRole("group", { name: "What kind of home is it?" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Choose your type of home to continue.")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /^1BHK/ }));
    const door = within(screen.getByRole("group", { name: /main door open straight into the living room/ }));
    fireEvent.click(door.getByRole("radio", { name: "Yes" }));
    expect(screen.getByText(/Your rooms:/).parentElement?.textContent).toContain("Living room + entrance, Bedroom, Kitchen, Bathroom");
    click("Continue");

    // Only this home's rooms are offered.
    const rooms = within(screen.getByRole("group", { name: "Rooms in your home" }));
    expect(rooms.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent)).toEqual([
      "Living room + entrance",
      "Bedroom",
      "Kitchen",
      "Bathroom",
    ]);
  });

  it("2BHK with two bathrooms lists numbered rooms", () => {
    render(<App />);
    navigate("#/plan");
    click("Continue");
    fireEvent.click(screen.getByRole("radio", { name: /^2BHK/ }));
    fireEvent.click(within(screen.getByRole("group", { name: "How many bathrooms?" })).getByRole("radio", { name: "2" }));
    click("Continue");
    const labels = within(screen.getByRole("group", { name: "Rooms in your home" }))
      .getAllByRole("checkbox")
      .map((c) => c.closest("label")?.textContent);
    expect(labels).toEqual(["Entrance", "Living room", "Bedroom 1", "Bedroom 2", "Kitchen", "Bathroom 1", "Bathroom 2"]);
  });

  it("editing the home layout keeps room choices and observations that still apply", () => {
    render(<App />);
    navigate("#/plan");
    click("Continue");
    chooseHome();
    check("Entrance");
    check("Bedroom");
    click("Continue");
    fireEvent.click(within(screen.getByRole("group", { name: "Entrance" })).getByRole("checkbox", { name: /Step or raised threshold/ }));

    // Back to "Your home": the door opens into the living room after all.
    click("Back");
    click("Back");
    fireEvent.click(
      within(screen.getByRole("group", { name: /main door open straight into the living room/ })).getByRole("radio", { name: "Yes" }),
    );
    click("Continue");
    expect((screen.getByRole("checkbox", { name: "Living room + entrance" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Bedroom" }) as HTMLInputElement).checked).toBe(true);
    click("Continue");
    const living = within(screen.getByRole("group", { name: "Living room + entrance" }));
    expect((living.getByRole("checkbox", { name: /Step or raised threshold/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("opens a draft saved before home layouts existed at the same step, as a Custom home", () => {
    localStorage.setItem(
      "nooksure.planner.v1",
      JSON.stringify({ step: 2, profile: { aids: [], rooms: ["kitchen"], concerns: {}, notes: "" }, done: [] }),
    );
    render(<App />);
    navigate("#/plan");
    expect(screen.getByRole("heading", { name: "What do you notice in each room?" })).toBeTruthy();
    click("Back");
    click("Back");
    expect((screen.getByRole("radio", { name: /^Custom/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Kitchen" }) as HTMLInputElement).checked).toBe(true);
  });

  it("ignores a corrupted saved draft", () => {
    localStorage.setItem("nooksure.planner.v1", "{not json");
    render(<App />);
    navigate("#/plan");
    expect(screen.getByRole("heading", { name: "Who are you preparing the home for?" })).toBeTruthy();
  });
});
