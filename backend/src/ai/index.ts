import type { AppConfig } from "../config";
import { FixtureProvider } from "./fixture";
import { GeminiProvider } from "./gemini";
import type { AiProvider } from "./provider";

export function createProvider(config: AppConfig): AiProvider {
  const apiKey = config.GEMINI_API_KEY?.trim();
  if (!apiKey) return new FixtureProvider();
  return new GeminiProvider({ apiKey, model: config.GEMINI_MODEL, timeoutMs: config.GEMINI_TIMEOUT_MS });
}
