import { describe, expect, it } from "vitest";
import { AnalysisModeSchema, HealthResponseSchema } from "./schemas";

describe("shared schemas", () => {
  it("accepts only known analysis modes", () => {
    expect(AnalysisModeSchema.parse("fixture")).toBe("fixture");
    expect(() => AnalysisModeSchema.parse("certified")).toThrow();
  });

  it("validates the health response shape", () => {
    const ok = { status: "ok", service: "nooksure-backend", analysisMode: "fixture" };
    expect(HealthResponseSchema.parse(ok)).toEqual(ok);
    expect(HealthResponseSchema.safeParse({ status: "ok" }).success).toBe(false);
  });
});
