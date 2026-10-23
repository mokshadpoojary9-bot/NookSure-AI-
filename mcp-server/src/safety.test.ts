import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SAFETY_PRINCIPLES } from "@nooksure/shared";

// Tests run from mcp-server/ (npm workspaces); also allow running from the repo root.
const doc = [resolve("../docs/safety.md"), resolve("docs/safety.md")]
  .map((f) => {
    try {
      return readFileSync(f, "utf8");
    } catch {
      return "";
    }
  })
  .find(Boolean)!;
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

describe("safety principles", () => {
  it("state exactly what docs/safety.md says", () => {
    const text = flat(doc);
    expect(text).toContain(SAFETY_PRINCIPLES.disclaimer);
    expect(text).toContain(SAFETY_PRINCIPLES.loadBearing);
    for (const line of [...SAFETY_PRINCIPLES.neverRecommend, ...SAFETY_PRINCIPLES.safeIdeas]) expect(text, line).toContain(`- ${line}`);
  });

  it("never describe a home as certified safe except to forbid it", () => {
    const all = JSON.stringify(SAFETY_PRINCIPLES);
    expect(all.match(/certified safe/g)).toHaveLength(1);
    expect(all).toMatch(/Never state or imply a home is “certified safe”/);
  });
});
