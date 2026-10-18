import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import type { HealthResponse } from "@nooksure/shared";
import { createProvider } from "./ai";
import type { AiProvider } from "./ai/provider";
import type { AppConfig } from "./config";
import { rateLimit } from "./rateLimit";
import { chatRouter } from "./routes/chat";

export interface AppDeps {
  provider?: AiProvider;
}

export function createApp(config: AppConfig, deps: AppDeps = {}) {
  const provider = deps.provider ?? createProvider(config);
  const app = express();
  app.disable("x-powered-by");
  // In production (Render) we sit behind one proxy hop; trust it so req.ip is the
  // real client and rate limits are per user. Locally, X-Forwarded-For is ignored.
  if (config.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/health", (_req, res) => {
    const body: HealthResponse = {
      status: "ok",
      service: "nooksure-backend",
      analysisMode: provider.mode,
    };
    res.json(body);
  });

  app.use(
    "/api/chat",
    rateLimit({ limit: config.CHAT_RATE_LIMIT_PER_MINUTE, windowMs: 60_000 }),
    chatRouter(provider),
  );

  // Malformed or oversized JSON bodies → clean 4xx without echoing input.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).json({
      error: { code: status === 500 ? "server_error" : "invalid_request", message: status === 500 ? "Something went wrong." : "Invalid request body." },
    });
  };
  app.use(onError);

  return app;
}
