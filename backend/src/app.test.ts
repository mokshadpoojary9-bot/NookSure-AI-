import request from "supertest";
import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "@nooksure/shared";
import { createApp } from "./app";
import { loadConfig } from "./config";

describe("GET /api/health", () => {
  it("reports fixture mode when no AI key is configured", async () => {
    const app = createApp(loadConfig({}));
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(HealthResponseSchema.parse(res.body).analysisMode).toBe("fixture");
  });

  it("reports live mode when an AI key is configured", async () => {
    const app = createApp(loadConfig({ GEMINI_API_KEY: "test-placeholder" }));
    const res = await request(app).get("/api/health");
    expect(res.body.analysisMode).toBe("live");
  });

  it("treats a whitespace-only key as unset", () => {
    expect(loadConfig({ GEMINI_API_KEY: "   " }).analysisMode).toBe("fixture");
  });

  it("applies defaults for empty optional values from .env", () => {
    const config = loadConfig({ GEMINI_MODEL: "", GEMINI_TIMEOUT_MS: "", CHAT_RATE_LIMIT_PER_MINUTE: "" });
    expect(config.GEMINI_MODEL).toBe("gemini-flash-latest");
    expect(config.GEMINI_TIMEOUT_MS).toBe(20000);
    expect(config.CHAT_RATE_LIMIT_PER_MINUTE).toBe(20);
  });
});
