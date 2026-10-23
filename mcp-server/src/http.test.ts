import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleMcpHttp } from "./http";

let server: Server;
let url: string;

beforeAll(async () => {
  server = createHttpServer((req, res) => void handleMcpHttp(req, res, undefined, { isAllowedOrigin: (o) => o === "https://allowed.example" }));
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
});
afterAll(async () => {
  await new Promise((ok) => server.close(ok));
});

const ACCEPT = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "1" } } };

describe("Streamable HTTP transport", () => {
  it("speaks MCP 2025-11-25 and serves the same three tools to the official client", async () => {
    expect(LATEST_PROTOCOL_VERSION).toBe("2025-11-25");
    const client = new Client({ name: "http-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url));
    await client.connect(transport);
    expect(transport.protocolVersion).toBe("2025-11-25");
    expect(client.getServerVersion()?.name).toBe("nooksure");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["build_home_safety_plan", "get_safety_principles", "list_options"]);
    const r = await client.callTool({
      name: "build_home_safety_plan",
      arguments: { homeType: "1bhk", rooms: ["living_room"], observations: { living_room: ["loose_rugs"] } },
    });
    expect((r.content as { text: string }[])[0]!.text).toMatch(/Take up loose rugs and mats/);
    await client.close();
  });

  it("needs no sign-in: no 401 and no WWW-Authenticate challenge", async () => {
    const res = await fetch(url, { method: "POST", headers: ACCEPT, body: JSON.stringify(initialize) });
    expect(res.status).toBe(200);
    expect(res.headers.get("www-authenticate")).toBeNull();
    expect(((await res.json()) as { result: { protocolVersion: string } }).result.protocolVersion).toBe("2025-11-25");
  });

  it("is stateless: GET and DELETE get 405 (no session stream to open or end)", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await fetch(url, { method, headers: ACCEPT });
      expect(res.status, method).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
    }
  });

  it("rejects requests from origins that aren't allowed (DNS-rebinding protection)", async () => {
    const bad = await fetch(url, { method: "POST", headers: { ...ACCEPT, Origin: "https://evil.example" }, body: JSON.stringify(initialize) });
    expect(bad.status).toBe(403);
    const ok = await fetch(url, { method: "POST", headers: { ...ACCEPT, Origin: "https://allowed.example" }, body: JSON.stringify(initialize) });
    expect(ok.status).toBe(200);
  });
});
