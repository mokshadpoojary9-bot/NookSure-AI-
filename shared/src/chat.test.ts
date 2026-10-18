import { describe, expect, it } from "vitest";
import { CHAT_LIMITS, ChatRequestSchema } from "./chat";

const user = (content: string) => ({ role: "user" as const, content });

describe("ChatRequestSchema", () => {
  it("accepts a short conversation ending with the user", () => {
    const req = { messages: [user("Hi"), { role: "assistant", content: "Hello" }, user("Rugs?")] };
    expect(ChatRequestSchema.safeParse(req).success).toBe(true);
  });

  it("rejects empty, oversized, too-long, or assistant-last requests", () => {
    expect(ChatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [user("   ")] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [user("x".repeat(CHAT_LIMITS.maxChars + 1))] }).success).toBe(false);
    const many = Array.from({ length: CHAT_LIMITS.maxMessages + 1 }, () => user("hi"));
    expect(ChatRequestSchema.safeParse({ messages: many }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [{ role: "assistant", content: "hi" }] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [{ role: "system", content: "hi" }] }).success).toBe(false);
  });
});
