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
}

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
      const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : undefined;
      throw new ProviderError(`Gemini request failed${status ? ` (HTTP ${status})` : ""}`, status);
    }
  }
}
