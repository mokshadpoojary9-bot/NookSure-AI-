import type { AnalysisMode, ChatMessage } from "@nooksure/shared";

/**
 * Server-side AI provider adapter. Concrete providers (and the fixture
 * provider used when no API key is configured) implement this interface so
 * routes never talk to a vendor SDK directly.
 */
export interface AiProvider {
  readonly mode: AnalysisMode;
  readonly name: string;
  /** Returns the assistant's reply to the conversation (last message is the user's). */
  chat(messages: ChatMessage[]): Promise<string>;
}

/** The provider did not answer within the configured timeout. */
export class ProviderTimeoutError extends Error {
  override readonly name = "ProviderTimeoutError";
}

/** The provider failed. `message` is for server logs only — never send it to clients. */
export class ProviderError extends Error {
  override readonly name = "ProviderError";
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
