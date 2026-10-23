/**
 * NookSure's safety principles as data, so tools outside the web app (the MCP server)
 * state them exactly. Mirrors docs/safety.md — a test keeps the two in step.
 */
export const SAFETY_PRINCIPLES = {
  disclaimer:
    "NookSure AI offers planning guidance for preparing a home for someone with mobility needs. It is not a safety certification and does not replace an occupational therapist, physiotherapist, or qualified installer.",
  neverRecommend: [
    "Furniture, towel rails, sinks, or fixtures used as grab bars or handholds.",
    "Stacked objects (bricks, boxes, books, crates) as ramps, steps, or platforms.",
    "Improvised solutions for anything load-bearing or fall-protective: grab bars, ramps, transfer aids, bed rails, handrails.",
    "Removing or bypassing safety devices.",
  ],
  safeIdeas: [
    "Rearranging furniture to widen pathways and clear turning space.",
    "Removing loose rugs, clutter, and trailing cables.",
    "Moving frequently used items to reachable heights.",
    "Repurposing existing lamps for better lighting on routes and stairs.",
  ],
  loadBearing:
    "Load-bearing or fall-protection needs → recommend a purpose-built product, correctly installed, and professional advice where appropriate.",
  professionalInstallation: [
    "Grab bars, handrails and ramps are purpose-built products installed by a professional — never improvised.",
    "Get professional help with ramps, railings, grab bars, structural changes, electrical work and door widening.",
  ],
  honesty: [
    "Never state or imply a home is “certified safe” or “fully accessible”.",
    "The plan is a reviewed, rule-based checklist — not AI analysis — and nothing can see or inspect the home.",
  ],
  order: "Reuse what you have → Rearrange → Remove hazards → Purchase purpose-built products last.",
} as const;
