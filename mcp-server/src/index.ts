#!/usr/bin/env node
// NookSure MCP server.
//   stdio (default):  node dist/index.js       — stdout carries the protocol, so nothing else may print there.
//   Streamable HTTP:  node dist/index.js --http — serves POST /mcp on PORT (default 3002), for local testing.
//                     In production the Express backend serves the same endpoint at /mcp.
import { createServer as createHttpServer } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { handleMcpHttp } from "./http";
import { createServer } from "./server";

if (process.argv.includes("--http")) {
  const port = Number(process.env.PORT) || 3002;
  const localhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  createHttpServer((req, res) => {
    if (new URL(req.url ?? "/", "http://localhost").pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Not found. The MCP endpoint is /mcp." }));
      return;
    }
    void handleMcpHttp(req, res, undefined, { isAllowedOrigin: (o) => localhost.test(o) });
  }).listen(port, "127.0.0.1", () => console.error(`NookSure MCP server (Streamable HTTP) on http://127.0.0.1:${port}/mcp`));
} else {
  await createServer().connect(new StdioServerTransport());
  console.error("NookSure MCP server running on stdio");
}
