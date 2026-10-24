import { afterEach, describe, expect, it, vi } from "vitest";

// API_BASE_URL is computed when the module loads, so re-import it per case.
async function baseUrlWith(value: string) {
  vi.stubEnv("VITE_API_BASE_URL", value);
  vi.resetModules();
  return (await import("./api")).API_BASE_URL;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("VITE_API_BASE_URL", () => {
  it("uses the local backend when empty (local behaviour unchanged)", async () => {
    expect(await baseUrlWith("")).toBe("http://localhost:3001");
  });

  it("uses the deployed backend URL and drops a trailing slash", async () => {
    expect(await baseUrlWith("https://YOUR_RENDER_URL.onrender.com/")).toBe("https://YOUR_RENDER_URL.onrender.com");
  });

  it("ignores stray spaces and line breaks around the URL", async () => {
    expect(await baseUrlWith(" https://backend.example.com/\n")).toBe("https://backend.example.com");
    expect(await baseUrlWith("\n")).toBe("http://localhost:3001");
  });

  it("sends chat requests to <base>/api/chat", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://backend.example.com");
    vi.resetModules();
    const { sendChat } = await import("./api");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ reply: "ok", analysisMode: "live", urgent: false })));
    vi.stubGlobal("fetch", fetchMock);
    await sendChat([{ role: "user", content: "hi" }]);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://backend.example.com/api/chat");
    vi.unstubAllGlobals();
  });
});
