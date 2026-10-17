import cors from "cors";
import express from "express";
import type { HealthResponse } from "@nooksure/shared";
import type { AppConfig } from "./config";

export function createApp(config: AppConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    const body: HealthResponse = {
      status: "ok",
      service: "nooksure-backend",
      analysisMode: config.analysisMode,
    };
    res.json(body);
  });

  return app;
}
