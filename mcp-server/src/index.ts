#!/usr/bin/env node
// NookSure MCP server over stdio. stdout carries the protocol, so nothing else may print there.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

await createServer().connect(new StdioServerTransport());
console.error("NookSure MCP server running on stdio");
