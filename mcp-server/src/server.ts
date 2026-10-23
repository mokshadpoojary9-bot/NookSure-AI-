import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { SAFETY_PRINCIPLES } from "@nooksure/shared";
import { ToolInputError, buildHomeSafetyPlan, buildPlanShape, getSafetyPrinciples, listOptions, listOptionsShape, planAsText } from "./tools";

/** These tools only read the rule set: no side effects, no network, same answer every time. */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const json = (value: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });

/** Bad input becomes a tool error the agent can read and correct, never a crash. */
function safely(run: () => CallToolResult): CallToolResult {
  try {
    return run();
  } catch (err) {
    const message =
      err instanceof ToolInputError
        ? err.message
        : err instanceof ZodError
          ? err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")
          : "Something went wrong building the plan.";
    return { isError: true, content: [{ type: "text", text: message }] };
  }
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "nooksure", version: "0.1.0" },
    {
      instructions: [
        "NookSure AI plans home safety for people with mobility needs, using what they already have.",
        "Call list_options for valid ids, then build_home_safety_plan. Present the plan in its order: Reuse → Rearrange → Remove → Purchase.",
        `Always keep these rules: ${SAFETY_PRINCIPLES.disclaimer} Never suggest: ${SAFETY_PRINCIPLES.neverRecommend.join(" ")} ${SAFETY_PRINCIPLES.loadBearing}`,
      ].join("\n"),
    },
  );

  server.registerTool(
    "build_home_safety_plan",
    {
      title: "Build a home safety plan",
      description:
        "Builds the NookSure “Use What You Have” plan for a home: an ordered checklist (Reuse → Rearrange → Remove → Purchase) from the home layout, mobility aids, the furniture already in each room and what was noticed in each room. Same rule set as the NookSure web app; rule-based, not AI analysis. Use list_options for valid ids.",
      inputSchema: buildPlanShape,
      annotations: { title: "Build a home safety plan", ...READ_ONLY },
    },
    (args) =>
      safely(() => {
        const plan = buildHomeSafetyPlan(args);
        return { content: [{ type: "text", text: planAsText(plan) }, { type: "text", text: JSON.stringify(plan, null, 2) }] };
      }),
  );

  server.registerTool(
    "list_options",
    {
      title: "List planner options",
      description:
        "Lists the valid home types, rooms, mobility aids, furniture and observations for build_home_safety_plan. Pass a home type (and layout answers) to also get that home's room ids, with the furniture and observations that apply to each room.",
      inputSchema: listOptionsShape,
      annotations: { title: "List planner options", ...READ_ONLY },
    },
    (args) => safely(() => json(listOptions(args))),
  );

  server.registerTool(
    "get_safety_principles",
    {
      title: "Get NookSure's safety principles",
      description:
        "Returns NookSure's safety rules: guidance not certification; never furniture or fixtures as grab bars, never stacked objects as ramps, no improvised load-bearing or fall-protection fixes; grab bars, handrails and ramps only purpose-built and professionally installed.",
      annotations: { title: "Get NookSure's safety principles", ...READ_ONLY },
    },
    () => json(getSafetyPrinciples()),
  );

  return server;
}
