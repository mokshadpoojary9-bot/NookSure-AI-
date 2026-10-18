import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createOriginCheck, parseOrigins } from "./cors";

const allowOrigin = async (env: Record<string, string>, origin: string) => {
  const res = await request(createApp(loadConfig(env))).get("/api/health").set("Origin", origin);
  return res.headers["access-control-allow-origin"];
};

describe("parseOrigins", () => {
  it("splits, trims, drops trailing slashes, and ignores wildcards", () => {
    expect(parseOrigins(" https://a.vercel.app/ ,https://b.example.com,*,, ")).toEqual([
      "https://a.vercel.app",
      "https://b.example.com",
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe("CORS in development", () => {
  it("allows localhost on any port (local behaviour unchanged)", async () => {
    expect(await allowOrigin({}, "http://localhost:5173")).toBe("http://localhost:5173");
    expect(await allowOrigin({}, "http://127.0.0.1:4173")).toBe("http://127.0.0.1:4173");
  });

  it("blocks other origins", async () => {
    expect(await allowOrigin({}, "https://evil.example.com")).toBeUndefined();
    expect(await allowOrigin({}, "http://localhost.evil.com")).toBeUndefined();
  });
});

describe("CORS in production", () => {
  const prod = { NODE_ENV: "production", FRONTEND_ORIGIN: "https://nooksure.vercel.app/, https://www.example.org" };

  it("allows only origins listed in FRONTEND_ORIGIN", async () => {
    expect(await allowOrigin(prod, "https://nooksure.vercel.app")).toBe("https://nooksure.vercel.app");
    expect(await allowOrigin(prod, "https://www.example.org")).toBe("https://www.example.org");
    expect(await allowOrigin(prod, "https://other.vercel.app")).toBeUndefined();
  });

  it("does not allow localhost or CORS_ORIGIN in production", async () => {
    expect(await allowOrigin({ ...prod, CORS_ORIGIN: "http://localhost:5173" }, "http://localhost:5173")).toBeUndefined();
  });

  it("never becomes a wildcard, even if FRONTEND_ORIGIN is '*'", async () => {
    const env = { NODE_ENV: "production", FRONTEND_ORIGIN: "*" };
    expect(createOriginCheck(loadConfig(env))("https://anything.example")).toBe(false);
    expect(await allowOrigin(env, "https://anything.example")).toBeUndefined();
  });

  it("answers the chat preflight for an allowed origin", async () => {
    const res = await request(createApp(loadConfig(prod)))
      .options("/api/chat")
      .set("Origin", "https://nooksure.vercel.app")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://nooksure.vercel.app");
  });

  it("still serves the health check without an Origin header (Render)", async () => {
    const res = await request(createApp(loadConfig(prod))).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("reads PORT from the environment", () => {
    expect(loadConfig({ PORT: "10000" }).PORT).toBe(10000);
    expect(loadConfig({}).PORT).toBe(3001);
  });
});
