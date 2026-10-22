import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatResponseSchema, type ChatMessage } from "@nooksure/shared";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { GeminiProvider, type GeminiClient } from "./ai/gemini";
import { ProviderError, ProviderTimeoutError, type AiProvider } from "./ai/provider";
import { isUrgentHazard } from "./ai/hazard";

const msg = (content: string) => ({ messages: [{ role: "user", content }] });

const fakeProvider = (chat: AiProvider["chat"]): AiProvider => ({ mode: "live", name: "fake", chat });

afterEach(() => vi.restoreAllMocks());

describe("POST /api/chat", () => {
  it("returns labeled sample replies when GEMINI_API_KEY is missing", async () => {
    const app = createApp(loadConfig({}));
    const res = await request(app).post("/api/chat").send(msg("How do I deal with loose rugs?"));
    expect(res.status).toBe(200);
    const body = ChatResponseSchema.parse(res.body);
    expect(body.analysisMode).toBe("fixture");
    expect(body.reply).toMatch(/rug/i);
  });

  it("passes validated history to the provider and returns its reply", async () => {
    const chat = vi.fn(async (_m: ChatMessage[]) => "Clear the hallway.");
    const app = createApp(loadConfig({}), { provider: fakeProvider(chat) });
    const messages = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "  Hallway tips?  " },
    ];
    const res = await request(app).post("/api/chat").send({ messages });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "Clear the hallway.", analysisMode: "live", urgent: false });
    expect(chat.mock.calls[0]?.[0].at(-1)).toEqual({ role: "user", content: "Hallway tips?" });
  });

  it("never passes client-supplied identity fields to the provider", async () => {
    const chat = vi.fn(async (_m: ChatMessage[]) => "ok");
    const app = createApp(loadConfig({}), { provider: fakeProvider(chat) });
    const res = await request(app)
      .post("/api/chat")
      .send({ uid: "attacker", email: "x@example.com", messages: [{ role: "user", content: "hi", uid: "attacker" }] });
    expect(res.status).toBe(200);
    expect(chat.mock.calls[0]?.[0]).toEqual([{ role: "user", content: "hi" }]);
  });

  it.each([
    ["empty body", {}],
    ["empty message", msg("")],
    ["blank message", msg("   ")],
    ["too long", msg("x".repeat(2001))],
    ["non-string content", { messages: [{ role: "user", content: 123 }] }],
    ["messages not an array", { messages: "hi" }],
    ["assistant last", { messages: [{ role: "assistant", content: "hi" }] }],
  ])("rejects invalid requests (%s)", async (_label, body) => {
    const chat = vi.fn();
    const app = createApp(loadConfig({}), { provider: fakeProvider(chat) });
    const res = await request(app).post("/api/chat").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_request");
    expect(chat).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without echoing it", async () => {
    const app = createApp(loadConfig({}));
    const res = await request(app).post("/api/chat").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain("bad");
  });

  it("hides provider error details from the client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp(loadConfig({}), {
      provider: fakeProvider(async () => {
        throw new ProviderError("upstream said: key=SECRET-VALUE", 403);
      }),
    });
    const res = await request(app).post("/api/chat").send(msg("hi"));
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("SECRET");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("SECRET");
  });

  it("returns a safe 502 when the Gemini SDK fails, leaking no key, stack, or raw error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = Object.assign(new Error("API key not valid: AIzaFAKE-planted-key-0000000000000000"), { status: 400 });
    const client = { models: { generateContent: vi.fn(async () => Promise.reject(raw)) } } as unknown as GeminiClient;
    const provider = new GeminiProvider({ apiKey: "AIzaFAKE-planted-key", model: "m", timeoutMs: 5000 }, client);
    const app = createApp(loadConfig({}), { provider });

    const res = await request(app).post("/api/chat").send(msg("hi"));
    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      error: { code: "provider_error", message: "The assistant is unavailable right now. Please try again shortly." },
    });
    const exposed = JSON.stringify(res.body) + res.text + JSON.stringify(log.mock.calls);
    for (const leak of ["AIza", "planted", "API key not valid", "at ", ".ts:"]) expect(exposed).not.toContain(leak);
  });

  it("maps provider timeouts to 504", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp(loadConfig({}), {
      provider: fakeProvider(async () => {
        throw new ProviderTimeoutError("slow");
      }),
    });
    const res = await request(app).post("/api/chat").send(msg("hi"));
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe("timeout");
  });

  it("flags messages describing an immediate hazard", async () => {
    const app = createApp(loadConfig({}));
    const res = await request(app).post("/api/chat").send(msg("I can smell gas in the kitchen"));
    expect(res.body.urgent).toBe(true);
  });

  it("rate limits per client", async () => {
    const app = createApp(loadConfig({ CHAT_RATE_LIMIT_PER_MINUTE: "2" }));
    await request(app).post("/api/chat").send(msg("a"));
    await request(app).post("/api/chat").send(msg("b"));
    const res = await request(app).post("/api/chat").send(msg("c"));
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("locally, ignores X-Forwarded-For so it can't be spoofed to dodge the limit", async () => {
    const app = createApp(loadConfig({ CHAT_RATE_LIMIT_PER_MINUTE: "1" }));
    expect(app.get("trust proxy")).toBe(false);
    await request(app).post("/api/chat").set("X-Forwarded-For", "1.1.1.1").send(msg("a"));
    const res = await request(app).post("/api/chat").set("X-Forwarded-For", "2.2.2.2").send(msg("b"));
    expect(res.status).toBe(429);
  });

  it("in production, trusts one proxy hop so each client gets its own limit", async () => {
    const app = createApp(loadConfig({ NODE_ENV: "production", CHAT_RATE_LIMIT_PER_MINUTE: "1" }));
    expect(app.get("trust proxy")).toBe(1);
    const a1 = await request(app).post("/api/chat").set("X-Forwarded-For", "1.1.1.1").send(msg("a"));
    const b1 = await request(app).post("/api/chat").set("X-Forwarded-For", "2.2.2.2").send(msg("b"));
    const a2 = await request(app).post("/api/chat").set("X-Forwarded-For", "1.1.1.1").send(msg("c"));
    expect([a1.status, b1.status, a2.status]).toEqual([200, 200, 429]);
  });
});

describe("isUrgentHazard", () => {
  it("detects emergencies but not ordinary questions", () => {
    expect(isUrgentHazard("There are sparking wires near the bed")).toBe(true);
    expect(isUrgentHazard("My dad has fallen and can't get up")).toBe(true);
    expect(isUrgentHazard("How wide should a hallway be for a walker?")).toBe(false);
    expect(isUrgentHazard("Best lighting for the stairs?")).toBe(false);
  });
});

describe("GeminiProvider", () => {
  const options = { apiKey: "test-placeholder", model: "test-model", timeoutMs: 5000 };

  it("maps roles, sends the system instruction, and returns text", async () => {
    const generateContent = vi.fn(async () => ({ text: "  Move the lamp.  " }));
    const client = { models: { generateContent } } as unknown as GeminiClient;
    const provider = new GeminiProvider(options, client);
    const reply = await provider.chat([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Lighting?" },
    ]);
    expect(reply).toBe("Move the lamp.");
    const call = (generateContent.mock.calls[0] as unknown[])[0] as {
      model: string;
      contents: { role: string }[];
      config: { systemInstruction: string; httpOptions: { timeout: number } };
    };
    expect(call.model).toBe("test-model");
    expect(call.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(call.config.systemInstruction).toMatch(/Never recommend furniture/);
    expect(call.config.httpOptions.timeout).toBe(5000);
  });

  it("wraps SDK failures without leaking their message", async () => {
    const client = {
      models: { generateContent: vi.fn(async () => Promise.reject(Object.assign(new Error("raw upstream text"), { status: 429 }))) },
    } as unknown as GeminiClient;
    const err = await new GeminiProvider(options, client).chat([{ role: "user", content: "hi" }]).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.status).toBe(429);
    expect(err.message).not.toContain("raw upstream text");
  });

  it("retries a 503/504 up to twice, then succeeds", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("overloaded"), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error("deadline"), { status: 504 }))
      .mockResolvedValueOnce({ text: "Third time lucky." });
    const client = { models: { generateContent } } as unknown as GeminiClient;
    const reply = await new GeminiProvider({ ...options, retryDelayMs: 1 }, client).chat([{ role: "user", content: "hi" }]);
    expect(reply).toBe("Third time lucky.");
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("gives up after 2 retries of a persistent 503", async () => {
    const generateContent = vi.fn(async () => Promise.reject(Object.assign(new Error("overloaded"), { status: 503 })));
    const client = { models: { generateContent } } as unknown as GeminiClient;
    const err = await new GeminiProvider({ ...options, retryDelayMs: 1 }, client).chat([{ role: "user", content: "hi" }]).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.status).toBe(503);
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-transient errors", async () => {
    const generateContent = vi.fn(async () => Promise.reject(Object.assign(new Error("bad key"), { status: 400 })));
    const client = { models: { generateContent } } as unknown as GeminiClient;
    await new GeminiProvider({ ...options, retryDelayMs: 1 }, client).chat([{ role: "user", content: "hi" }]).catch(() => {});
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("turns a timed-out request into ProviderTimeoutError", async () => {
    const generateContent = vi.fn(
      ({ config }: { config: { abortSignal: AbortSignal } }) =>
        new Promise((_, reject) => config.abortSignal.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    const client = { models: { generateContent } } as unknown as GeminiClient;
    const provider = new GeminiProvider({ ...options, timeoutMs: 20 }, client);
    await expect(provider.chat([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it("treats an empty response as a provider error", async () => {
    const client = { models: { generateContent: vi.fn(async () => ({ text: "" })) } } as unknown as GeminiClient;
    await expect(new GeminiProvider(options, client).chat([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(ProviderError);
  });
});
