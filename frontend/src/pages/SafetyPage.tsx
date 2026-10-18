import { href } from "../router";

export function SafetyPage() {
  return (
    <article className="prose">
      <h1>Safety principles</h1>
      <p className="lead">
        NookSure offers planning guidance for preparing a home for someone with mobility needs. It is not a safety
        certification and does not replace an occupational therapist, physiotherapist, or qualified installer.
      </p>

      <h2>We never recommend</h2>
      <ul>
        <li>Furniture, towel rails, sinks, or fixtures used as grab bars or handholds.</li>
        <li>Stacked objects — bricks, boxes, crates, books — as ramps, steps, or platforms.</li>
        <li>Improvised solutions for anything load-bearing or fall-protective: grab bars, ramps, transfer aids, bed rails, handrails.</li>
        <li>Removing or bypassing safety devices.</li>
      </ul>

      <h2>Safe “Use What You Have” ideas</h2>
      <ul>
        <li>Rearranging furniture to widen pathways and clear turning space.</li>
        <li>Removing loose rugs, clutter, and trailing cables.</li>
        <li>Moving frequently used items to reachable heights.</li>
        <li>Repositioning existing lamps to light routes and stairs.</li>
      </ul>

      <h2>When to get help</h2>
      <p>
        For anything that bears weight or prevents falls, choose a purpose-built product, have it correctly installed,
        and ask a professional where appropriate. Items in your plan marked <strong>Seek professional advice</strong>{" "}
        are a good place to start that conversation.
      </p>

      <h2>Honesty</h2>
      <p>
        We never describe a home as “certified safe” or “fully accessible”. When AI analysis arrives, every result
        will be labeled as live analysis or sample data.
      </p>

      <p>
        <a className="button primary" href={href("/plan")}>
          Go to the planner
        </a>
      </p>
    </article>
  );
}
