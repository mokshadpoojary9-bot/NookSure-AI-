/**
 * Deterministic check for messages describing a possible immediate hazard.
 * Runs regardless of provider so the urgent notice never depends on the model.
 */
const URGENT_PATTERNS: readonly RegExp[] = [
  /\b(smell(s|ing)? (of )?gas|gas leak)\b/i,
  /\b(fire|smoke|burning smell|on fire)\b/i,
  /\b(spark(s|ing)?|exposed wir(e|es|ing)|electric(al)? shock)\b/i,
  /\b(has fallen|fell down|can'?t get up|cannot get up|unconscious|not breathing|bleeding)\b/i,
  /\b(ceiling|floor|wall|stairs?|balcony) (is )?(collaps|caving|giving way)/i,
];

export function isUrgentHazard(text: string): boolean {
  return URGENT_PATTERNS.some((p) => p.test(text));
}
