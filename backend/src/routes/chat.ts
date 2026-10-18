import { Router } from "express";
import { ChatRequestSchema, type ApiError, type ChatResponse } from "@nooksure/shared";
import { isUrgentHazard } from "../ai/hazard";
import { ProviderError, ProviderTimeoutError, type AiProvider } from "../ai/provider";

const fail = (code: string, message: string): ApiError => ({ error: { code, message } });

export function chatRouter(provider: AiProvider) {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(fail("invalid_request", "Please send a message between 1 and 2000 characters."));
      return;
    }

    const { messages } = parsed.data;
    const urgent = isUrgentHazard(messages.at(-1)!.content);

    try {
      const reply = await provider.chat(messages);
      const body: ChatResponse = { reply, analysisMode: provider.mode, urgent };
      res.json(body);
    } catch (err) {
      // Log only the error class and status — never message content or keys.
      const status = err instanceof ProviderError ? err.status : undefined;
      console.error(`[chat] ${provider.name} failed: ${(err as Error)?.name ?? "Error"}${status ? ` status=${status}` : ""}`);
      if (err instanceof ProviderTimeoutError) {
        res.status(504).json(fail("timeout", "The assistant took too long to respond. Please try again."));
        return;
      }
      res.status(502).json(fail("provider_error", "The assistant is unavailable right now. Please try again shortly."));
    }
  });

  return router;
}
