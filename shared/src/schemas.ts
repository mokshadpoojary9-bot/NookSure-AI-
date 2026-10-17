import { z } from "zod";

/**
 * How a result was produced. "fixture" means canned sample data was returned
 * because no AI provider is configured — the UI must label it as such and must
 * never present it as real AI analysis.
 */
export const AnalysisModeSchema = z.enum(["live", "fixture"]);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("nooksure-backend"),
  analysisMode: AnalysisModeSchema,
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * "Use What You Have" (Jugaad Planner) recommendation kinds, in preference
 * order: reuse, rearrange, or remove existing items before suggesting a purchase.
 */
export const RecommendationKindSchema = z.enum(["reuse", "rearrange", "remove", "purchase"]);
export type RecommendationKind = z.infer<typeof RecommendationKindSchema>;
