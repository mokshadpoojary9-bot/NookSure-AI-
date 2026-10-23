import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

beforeEach(() => {
  window.scrollTo = () => {};
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const open = (hash: string) => {
  window.location.hash = hash;
  render(<App />);
  return document.querySelector("main")!.textContent ?? "";
};

describe("privacy and terms pages", () => {
  it("are linked in the footer of every page", () => {
    open("#/plan");
    const footer = document.querySelector(".site-footer")!;
    expect(footer.querySelector('a[href="#/privacy"]')?.textContent).toBe("Privacy");
    expect(footer.querySelector('a[href="#/terms"]')?.textContent).toBe("Terms");
  });

  it("the privacy policy describes what is actually stored and sent", () => {
    const text = open("#/privacy");
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    expect(text).toMatch(/saved only in your own browser’s local storage/);
    expect(text).toMatch(/Firebase Authentication/);
    expect(text).toMatch(/only you read, change or delete your saved plans/);
    expect(text).toMatch(/Gemini/);
    expect(text).toMatch(/NookSure doesn’t store your messages/);
    expect(text).toMatch(/No analytics, advertising or tracking cookies/);
    expect(text).toMatch(/MCP/);
  });

  it("the terms say guidance, not certification, and professional installation", () => {
    const text = open("#/terms");
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeTruthy();
    expect(text).toMatch(/never\s+certifies a home as safe/);
    expect(text).toMatch(/correctly installed by a qualified professional/);
    expect(text).toMatch(/Never improvise these/);
    expect(text).not.toMatch(/\bcertified safe\b/i);
  });
});
