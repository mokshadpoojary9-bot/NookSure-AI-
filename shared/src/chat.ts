import { z } from "zod";
import { AnalysisModeSchema } from "./schemas";

export const CHAT_LIMITS = {
  /** Max messages of history sent per request (oldest are dropped client-side). */
  maxMessages: 20,
  /** Max characters per message. */
  maxChars: 2000,
} as const;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(CHAT_LIMITS.maxChars),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  messages: z
    .array(ChatMessageSchema)
    .min(1)
    .max(CHAT_LIMITS.maxMessages)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be from the user."),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  reply: z.string(),
  /** "fixture" means sample text, not Gemini output — the UI must label it. */
  analysisMode: AnalysisModeSchema,
  /** The user's message described a possible immediate hazard. */
  urgent: z.boolean(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
