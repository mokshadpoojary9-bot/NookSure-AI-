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
    const app = createApp(loadConfig({ AI_PROVIDER_API_KEY: "test-placeholder" }));
    const res = await request(app).get("/api/health");
    expect(res.body.analysisMode).toBe("live");
  });

  it("treats a whitespace-only key as unset", () => {
    expect(loadConfig({ AI_PROVIDER_API_KEY: "   " }).analysisMode).toBe("fixture");
  });
});
