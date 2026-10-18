import { z } from "zod";
import type { AnalysisMode } from "@nooksure/shared";

// Treat "KEY=" lines in .env as unset so defaults apply.
const unsetIfEmpty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const EnvSchema = z.object({
  NODE_ENV: z.preprocess(unsetIfEmpty, z.string().default("development")),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Comma-separated frontend origins allowed by CORS (e.g. the Vercel URL). In production
  // these are the ONLY allowed origins; in development localhost is allowed as well.
  FRONTEND_ORIGIN: z.preprocess(unsetIfEmpty, z.string().optional()),
  // Server-only secret. Never expose through a VITE_ variable.
  GEMINI_API_KEY: z.string().optional(),
  // Alias documented by the @google/genai SDK; override to pin a specific model.
  GEMINI_MODEL: z.preprocess(unsetIfEmpty, z.string().trim().default("gemini-flash-latest")),
  GEMINI_TIMEOUT_MS: z.preprocess(unsetIfEmpty, z.coerce.number().int().min(1000).max(60000).default(20000)),
  CHAT_RATE_LIMIT_PER_MINUTE: z.preprocess(unsetIfEmpty, z.coerce.number().int().positive().default(20)),
});

export type AppConfig = z.infer<typeof EnvSchema> & { analysisMode: AnalysisMode };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  // No key means fixture mode: we must never pretend AI analysis happened.
  const analysisMode: AnalysisMode = parsed.GEMINI_API_KEY?.trim() ? "live" : "fixture";
  return { ...parsed, analysisMode };
}
