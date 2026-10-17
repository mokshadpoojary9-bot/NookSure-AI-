import { z } from "zod";
import type { AnalysisMode } from "@nooksure/shared";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  AI_PROVIDER: z.string().default("anthropic"),
  AI_PROVIDER_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof EnvSchema> & { analysisMode: AnalysisMode };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  // No key means fixture mode: we must never pretend AI analysis happened.
  const analysisMode: AnalysisMode = parsed.AI_PROVIDER_API_KEY?.trim() ? "live" : "fixture";
  return { ...parsed, analysisMode };
}
