import type { RequestHandler } from "express";

/**
 * Small fixed-window, in-memory, per-IP limiter to protect the paid AI key from
 * casual abuse. Single-instance only; swap for a shared store if we scale out.
 */
export function rateLimit({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const t = now();
    const key = req.ip ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }

    if (entry.count > limit) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - t) / 1000));
      res.status(429).json({ error: { code: "rate_limited", message: "Too many messages. Please wait a minute and try again." } });
      return;
    }
    next();
  };
}
