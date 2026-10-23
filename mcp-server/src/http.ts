import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server";

/**
 * Streamable HTTP transport (MCP 2025-11-25), stateless: every POST gets a fresh server
 * and transport, so nothing is kept between requests. The tools are read-only and the
 * same for every user, so no session, sign-in or account linking is needed.
 */

const jsonRpcError = (res: ServerResponse, status: number, code: number, message: string, headers: Record<string, string> = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
};

export interface McpHttpOptions {
  /**
   * DNS-rebinding protection (required by the MCP spec): requests carrying an Origin
   * header must come from an allowed origin. Server-to-server clients send no Origin.
   */
  isAllowedOrigin?: (origin: string) => boolean;
}

/** Handles one HTTP request to the MCP endpoint. Pass `body` when it was already parsed (e.g. by express.json()). */
export async function handleMcpHttp(req: IncomingMessage, res: ServerResponse, body?: unknown, options: McpHttpOptions = {}): Promise<void> {
  const origin = req.headers.origin;
  if (origin && !(options.isAllowedOrigin?.(origin) ?? false)) {
    jsonRpcError(res, 403, -32000, "Origin not allowed.");
    return;
  }
  // No sessions: there is no server-to-client stream to open (GET) or session to end (DELETE).
  if (req.method !== "POST") {
    jsonRpcError(res, 405, -32000, "Method not allowed.", { Allow: "POST" });
    return;
  }

  const server = createServer();
  // JSON responses rather than an SSE stream: every tool answers at once.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch {
    if (!res.headersSent) jsonRpcError(res, 500, -32603, "Internal server error.");
  }
}
