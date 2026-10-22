import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { AuthService } from "./auth/authService";
import type { RecognitionLike } from "./speech/useSpeechRecognition";

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const input = () => screen.getByRole("textbox", { name: "Your question" }) as HTMLTextAreaElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });

let fetchMock: ReturnType<typeof vi.fn>;
let lastRecognition: (RecognitionLike & { started: boolean }) | null;

function installRecognition() {
  class FakeRecognition {
    lang = "";
    interimResults = false;
    continuous = false;
    started = false;
    onresult: RecognitionLike["onresult"] = null;
    onerror: RecognitionLike["onerror"] = null;
    onend: RecognitionLike["onend"] = null;
    constructor() {
      lastRecognition = this as unknown as RecognitionLike & { started: boolean };
    }
    start() {
      this.started = true;
    }
    stop() {
      this.onend?.();
    }
    abort() {}
  }
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
}

function installSynthesis() {
  const speak = vi.fn();
  const cancel = vi.fn();
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak, cancel };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    lang = "";
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  };
  return { speak, cancel };
}

beforeEach(() => {
  window.scrollTo = () => {};
  localStorage.clear();
  window.location.hash = "#/assistant";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  lastRecognition = null;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
  delete (globalThis as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
});

describe("assistant chat", () => {
  it("sends typed text to the backend and labels sample replies", async () => {
    fetchMock.mockReturnValue(reply({ reply: "Roll up loose rugs.", analysisMode: "fixture", urgent: false }));
    render(<App />);
    type("Any tips for rugs?");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Roll up loose rugs.")).toBeTruthy();
    expect(screen.getByText("Sample reply")).toBeTruthy();
    expect(screen.getByText(/Sample mode — not AI analysis/)).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/chat");
    expect(JSON.parse(init.body as string)).toEqual({ messages: [{ role: "user", content: "Any tips for rugs?" }] });
    expect(JSON.stringify(init)).not.toMatch(/GEMINI|key/i);
    expect(input().value).toBe("");
  });

  it("labels live replies and shows an urgent-hazard notice", async () => {
    fetchMock.mockReturnValue(reply({ reply: "Leave the room now.", analysisMode: "live", urgent: true }));
    render(<App />);
    type("I smell gas");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(await screen.findByText("Leave the room now.")).toBeTruthy();
    expect(screen.getByText("Gemini AI · guidance only")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/contact emergency services/);
    expect(screen.queryByText(/Sample mode/)).toBeNull();
  });

  it("shows server errors and restores the unsent text", async () => {
    fetchMock.mockReturnValue(reply({ error: { code: "timeout", message: "The assistant took too long to respond." } }, 504));
    render(<App />);
    type("Bathroom ideas?");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The assistant took too long to respond.");
    expect(input().value).toBe("Bathroom ideas?");
  });

  it("explains when the backend can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<App />);
    type("Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Assistant is offline, please try again/);
  });

  it("says the assistant is offline when something other than the API answers", async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response("<html>Bad Gateway</html>", { status: 502 })));
    render(<App />);
    type("Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Assistant is offline, please try again.");
  });

  it("works the same for a signed-in user", async () => {
    const user = { uid: "u1", displayName: "Asha", email: "asha@example.com", photoURL: null };
    const service: AuthService = {
      configured: true,
      onChange: (cb) => {
        cb(user);
        return () => {};
      },
      signInWithGoogle: async () => {},
      signOut: async () => {},
    };
    fetchMock.mockReturnValue(reply({ reply: "Add a night light.", analysisMode: "live", urgent: false }));
    render(<App authService={service} />);
    expect(screen.getByText("Signed in as Asha")).toBeTruthy();
    type("Night-time tips?");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Add a night light.")).toBeTruthy();
  });

  // Regression: Chrome 140+ returns a Promise from scrollIntoView; returning it from an
  // effect made React call it as a cleanup ("destroy is not a function") and blanked the app.
  it("survives browsers where scrollIntoView returns a Promise", async () => {
    const proto = Element.prototype as unknown as { scrollIntoView?: unknown };
    const original = proto.scrollIntoView;
    proto.scrollIntoView = () => Promise.resolve();
    try {
      fetchMock.mockReturnValue(reply({ reply: "Clear the hallway.", analysisMode: "live", urgent: false }));
      const view = render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
      type("Hallway?");
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(await screen.findByText("Clear the hallway.")).toBeTruthy();
      expect(() => view.unmount()).not.toThrow();
    } finally {
      proto.scrollIntoView = original;
    }
  });
});

describe("voice input", () => {
  it("is clearly unavailable when the browser lacks speech recognition, while typing still works", () => {
    render(<App />);
    expect((screen.getByRole("button", { name: /Speak/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Voice input isn’t available in this browser/)).toBeTruthy();
    type("typed");
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("puts the recognized transcript in the editable box without sending it", () => {
    installRecognition();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Speak/ }));
    expect(lastRecognition?.started).toBe(true);
    expect(screen.getByText(/Listening…/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Stop listening/ }).getAttribute("aria-pressed")).toBe("true");

    act(() =>
      lastRecognition!.onresult!({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: "how wide should a hallway be" } } },
      }),
    );
    act(() => lastRecognition!.onend!());

    expect(input().value).toBe("how wide should a hallway be");
    expect(screen.getByText(/Stopped listening\. Check or edit the text/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    type("how wide should a hallway be for a walker");
    expect(input().value).toBe("how wide should a hallway be for a walker");
  });

  it("explains a blocked microphone", () => {
    installRecognition();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Speak/ }));
    act(() => lastRecognition!.onerror!({ error: "not-allowed" }));
    act(() => lastRecognition!.onend!());
    expect(screen.getByText(/Microphone access was blocked/)).toBeTruthy();
  });
});

describe("read aloud", () => {
  it("reads a reply and can stop playback", async () => {
    const { speak, cancel } = installSynthesis();
    fetchMock.mockReturnValue(reply({ reply: "- Move the lamp.", analysisMode: "live", urgent: false }));
    render(<App />);
    type("Lighting?");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("- Move the lamp.");

    fireEvent.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect((speak.mock.calls[0]?.[0] as { text: string }).text).toBe("Move the lamp.");

    fireEvent.click(screen.getByRole("button", { name: "Stop speaking" }));
    expect(cancel).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop speaking" })).toBeNull());
  });

  it("says when read-aloud is unsupported", () => {
    render(<App />);
    expect(screen.getByText("Read-aloud isn’t available in this browser.")).toBeTruthy();
  });
});
