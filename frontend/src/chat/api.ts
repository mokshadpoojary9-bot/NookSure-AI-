import { ApiErrorSchema, CHAT_LIMITS, ChatResponseSchema, type ChatMessage, type ChatResponse } from "@nooksure/shared";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3001").replace(/\/$/, "");

export const OFFLINE_MESSAGE = "Assistant is offline, please try again.";

export class ChatRequestError extends Error {
  override readonly name = "ChatRequestError";
}

/** Sends the conversation to the NookSure backend. The Gemini key never touches the browser. */
export async function sendChat(messages: ChatMessage[], signal?: AbortSignal): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-CHAT_LIMITS.maxMessages) }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ChatRequestError(OFFLINE_MESSAGE);
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    throw new ChatRequestError(parsed.success ? parsed.data.error.message : OFFLINE_MESSAGE);
  }
  const parsed = ChatResponseSchema.safeParse(body);
  if (!parsed.success) throw new ChatRequestError("The assistant sent an unexpected response.");
  return parsed.data;
}
