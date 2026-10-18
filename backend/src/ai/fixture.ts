import type { ChatMessage } from "@nooksure/shared";
import type { AiProvider } from "./provider";

const SAMPLES: { match: RegExp; reply: string }[] = [
  {
    match: /\b(rug|mat|carpet|trip)/i,
    reply:
      "Loose rugs and mats are a common trip hazard.\n\n- Roll up and store rugs on the main walking routes.\n- Keep the bed-to-bathroom route clear of shoes and bags.\n- If a mat is needed in a wet area, choose one designed to be non-slip.",
  },
  {
    match: /\b(bath(room)?|shower|toilet|grab ?bar)/i,
    reply:
      "For a bathroom:\n\n- Move toiletries and towels within easy reach so no one stretches across a wet floor.\n- Remove mats that slide.\n- If support is needed, have purpose-built grab bars professionally installed — never rely on towel rails or sinks as handholds.",
  },
  {
    match: /\b(step|stairs?|ramp|threshold)/i,
    reply:
      "For steps and thresholds:\n\n- Keep the area before and after the step clear and well lit.\n- For a ramp, use a purpose-built one rated for the person and their mobility aid, and get advice on slope and installation.\n- Never build a ramp from stacked bricks, boards, or boxes.",
  },
  {
    match: /\b(light|dark|night|lamp)/i,
    reply:
      "For lighting:\n\n- Move lamps you already own to light the route between bed, bathroom, and doors.\n- Plug-in or motion-sensor night lights are a low-cost addition.\n- Make sure switches can be reached before entering a dark area.",
  },
];

const DEFAULT_REPLY =
  "Here are good first steps for most homes:\n\n- Clear the main walking routes of rugs, clutter, and cables.\n- Rearrange furniture to widen paths for the mobility aid.\n- Move everyday items to easy reach.\n- Light the route from bed to bathroom.\n\nTell me which room you're working on and who is visiting, and I can be more specific.";

/**
 * Used when GEMINI_API_KEY is not set. Returns canned sample guidance — the
 * response is marked analysisMode "fixture" and the UI labels it as sample text.
 */
export class FixtureProvider implements AiProvider {
  readonly mode = "fixture" as const;
  readonly name = "fixture";

  async chat(messages: ChatMessage[]): Promise<string> {
    const last = messages.at(-1)?.content ?? "";
    return SAMPLES.find((s) => s.match.test(last))?.reply ?? DEFAULT_REPLY;
  }
}
