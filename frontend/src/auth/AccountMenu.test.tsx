import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { AuthService, AuthUser } from "./authService";

const USER: AuthUser = { uid: "u1", displayName: "Asha", email: "asha@example.com", photoURL: null };

function fakeService(overrides: Partial<AuthService> = {}) {
  let listener: ((u: AuthUser | null) => void) | null = null;
  const service: AuthService = {
    configured: true,
    onChange: (cb) => {
      listener = cb;
      return () => (listener = null);
    },
    signInWithGoogle: vi.fn(async () => listener?.(USER)),
    signOut: vi.fn(async () => listener?.(null)),
    ...overrides,
  };
  return { service, emit: (u: AuthUser | null) => act(() => listener?.(u)) };
}

beforeEach(() => {
  window.scrollTo = () => {};
  localStorage.clear();
  window.location.hash = "";
});
afterEach(cleanup);

describe("Google sign-in", () => {
  it("runs as a guest when Firebase isn't configured", async () => {
    render(<App />);
    expect(screen.getByText("Guest mode")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sign in/ })).toBeNull();
    // Existing pages still work without signing in (the landing page loads as its own chunk).
    expect(await screen.findByRole("link", { name: "Start planning" }, { timeout: 5000 })).toBeTruthy();
  });

  it("goes from loading to signed-out to signed-in and back", async () => {
    const { service, emit } = fakeService();
    render(<App authService={service} />);
    expect(screen.getByText("Checking sign-in…")).toBeTruthy();

    emit(null);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" })));
    expect(service.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Signed in as Asha")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
  });

  it("shows a signing-in state and a helpful error", async () => {
    let reject!: (e: unknown) => void;
    const { service, emit } = fakeService({
      signInWithGoogle: () => new Promise<void>((_, r) => (reject = r)),
    });
    render(<App authService={service} />);
    emit(null);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));
    expect((screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => reject({ code: "auth/unauthorized-domain" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Authorized domains/);
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeTruthy();
  });

  it("stays quiet when the user closes the popup", async () => {
    const { service, emit } = fakeService({
      signInWithGoogle: vi.fn(async () => Promise.reject({ code: "auth/popup-closed-by-user" })),
    });
    render(<App authService={service} />);
    emit(null);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign in with Google" })));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
