import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "./config";

const production = () => createApp(loadConfig({ NODE_ENV: "production", FRONTEND_ORIGIN: "https://nooksure-ai.vercel.app" }));
const rpc = (method: string, params: Record<string, unknown> = {}, id = 1) => ({ jsonrpc: "2.0", id, method, params });
const post = (app: ReturnType<typeof createApp>, body: object) =>
  request(app).post("/mcp").set("Content-Type", "application/json").set("Accept", "application/json, text/event-stream").send(body);

describe("POST /mcp (Streamable HTTP MCP endpoint)", () => {
  it("initializes with protocol 2025-11-25 and needs no sign-in", async () => {
    const res = await post(production(), rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "alexa-test", version: "1" } }));
    expect(res.status).toBe(200);
    expect(res.headers["www-authenticate"]).toBeUndefined();
    expect(res.body.result.protocolVersion).toBe("2025-11-25");
    expect(res.body.result.serverInfo.name).toBe("nooksure");
  });

  it("lists and runs the same three tools as the stdio server", async () => {
    const app = production();
    const list = await post(app, rpc("tools/list"));
    expect(list.body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["build_home_safety_plan", "get_safety_principles", "list_options"]);

    const call = await post(
      app,
      rpc("tools/call", {
        name: "build_home_safety_plan",
        arguments: { homeType: "1bhk", mobilityAids: ["walker"], rooms: ["bathroom"], observations: { bathroom: ["no_support_rail"] } },
      }),
    );
    const plan = JSON.parse(call.body.result.content[1].text);
    expect(plan.source).toBe("rule-based");
    expect(plan.steps.find((s: { title: string }) => /grab bars/i.test(s.title))).toMatchObject({ kind: "purchase", seekProfessional: true });
  });

  it("returns tool errors for bad input instead of failing the request", async () => {
    const res = await post(production(), rpc("tools/call", { name: "build_home_safety_plan", arguments: { homeType: "castle" } }));
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBe(true);
  });

  it("answers server-to-server calls (no Origin) and the web app's origin, and blocks others", async () => {
    const app = production();
    const init = rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "1" } });
    expect((await post(app, init).set("Origin", "https://nooksure-ai.vercel.app")).status).toBe(200);
    expect((await post(app, init).set("Origin", "https://evil.example")).status).toBe(403);
  });

  it("allows only POST", async () => {
    const res = await request(production()).get("/mcp").set("Accept", "text/event-stream");
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });

  it("publishes no OAuth metadata, since no sign-in is involved", async () => {
    const app = production();
    expect((await request(app).get("/.well-known/oauth-protected-resource")).status).toBe(404);
    expect((await request(app).get("/.well-known/oauth-authorization-server")).status).toBe(404);
  });

  it("is rate limited per client", async () => {
    const app = production();
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await post(app, rpc("tools/list", {}, i))).status;
    expect(last).toBe(429);
  });

  it("leaves the existing API unchanged", async () => {
    const res = await request(production()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("nooksure-backend");
  });
});
