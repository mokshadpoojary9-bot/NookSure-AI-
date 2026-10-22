import { GoogleGenAI } from "@google/genai";
import type { ChatMessage } from "@nooksure/shared";
import { SYSTEM_INSTRUCTION } from "./prompt";
import { ProviderError, ProviderTimeoutError, type AiProvider } from "./provider";

/** The subset of the SDK client this provider uses (lets tests inject a fake). */
export type GeminiClient = Pick<GoogleGenAI, "models">;

export interface GeminiOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** Pause before retrying a transient 503/504 from Gemini. */
  retryDelayMs?: number;
}

/** Gemini statuses that usually clear up on their own (overloaded / upstream timeout). */
const RETRYABLE_STATUSES = new Set([503, 504]);
const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

const statusOf = (err: unknown): number | undefined =>
  typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : undefined;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GeminiProvider implements AiProvider {
  readonly mode = "live" as const;
  readonly name = "gemini";
  private readonly client: GeminiClient;

  constructor(
    private readonly options: GeminiOptions,
    client?: GeminiClient,
  ) {
    this.client = client ?? new GoogleGenAI({ apiKey: options.apiKey });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.attempt(messages);
      } catch (err) {
        const retryable = err instanceof ProviderError && err.status !== undefined && RETRYABLE_STATUSES.has(err.status);
        if (!retryable || attempt >= MAX_RETRIES) throw err;
        await sleep(this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
      }
    }
  }

  /** One request, bounded by the configured timeout. */
  private async attempt(messages: ChatMessage[]): Promise<string> {
    const signal = AbortSignal.timeout(this.options.timeoutMs);
    try {
      const response = await this.client.models.generateContent({
        model: this.options.model,
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.4,
          maxOutputTokens: 1024,
          abortSignal: signal,
          httpOptions: { timeout: this.options.timeoutMs },
        },
      });
      const text = response.text?.trim();
      if (!text) throw new ProviderError("Gemini returned an empty response");
      return text;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (signal.aborted) throw new ProviderTimeoutError("Gemini request timed out");
      const status = statusOf(err);
      throw new ProviderError(`Gemini request failed${status ? ` (HTTP ${status})` : ""}`, status);
    }
  }
}
