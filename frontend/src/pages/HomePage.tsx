import { KIND_LABELS, KIND_ORDER } from "@nooksure/shared";
import { href } from "../router";

const KIND_BLURBS = {
  reuse: "Put things you already own to safer use — lamps, baskets, shelves.",
  rearrange: "Move furniture and everyday items to open routes and bring essentials within reach.",
  remove: "Take away trip hazards: loose rugs, clutter, trailing cables.",
  purchase: "Only then, buy purpose-built products — properly installed where they bear weight.",
} as const;

export function HomePage() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Home accessibility planning</p>
        <h1>NookSure AI</h1>
        <p className="tagline">Prepare thoughtfully. Reuse wisely.</p>
        <p className="lead">
          Plan a home for someone with mobility needs — starting with what you already have. Walk through each room,
          note what you see, and get a step-by-step checklist that reuses, rearranges, and removes before it ever
          suggests a purchase.
        </p>
        <div className="actions">
          <a className="button primary" href={href("/plan")}>
            Start planning
          </a>
          <a className="button" href={href("/assistant")}>
            Ask the assistant
          </a>
          <a className="button" href={href("/safety")}>
            Read our safety principles
          </a>
        </div>
      </section>

      <section aria-labelledby="order-heading">
        <h2 id="order-heading">The “Use What You Have” order</h2>
        <ol className="kind-steps">
          {KIND_ORDER.map((kind, i) => (
            <li key={kind} className={`kind-step kind-${kind}`}>
              <span className="kind-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{KIND_LABELS[kind]}</h3>
              <p>{KIND_BLURBS[kind]}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="how-heading" className="split">
        <div>
          <h2 id="how-heading">How the planner works</h2>
          <ol className="plain-list">
            <li>Tell us who the home is being prepared for and which mobility aids they use.</li>
            <li>Choose the rooms that matter most.</li>
            <li>Tick what you notice in each room — rugs, clutter, steps, lighting.</li>
            <li>Work through your checklist and mark items done as you go.</li>
          </ol>
        </div>
        <div className="card note">
          <h3>What this is — and isn’t</h3>
          <p>
            Today’s checklist comes from a reviewed set of rules, not AI analysis. It never suggests improvised
            grab bars or ramps: anything that bears weight or prevents falls points to a purpose-built product and
            professional advice.
          </p>
          <p>Your plan is saved in this browser only.</p>
        </div>
      </section>

      <section aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading">Coming next</h2>
        <ul className="roadmap">
          <li>
            <span className="badge">Planned</span> Interactive 3D room view (Three.js / React Three Fiber) — not built
            yet.
          </li>
          <li>
            <span className="badge">Planned</span> AI-assisted room analysis, always labeled live or sample.
          </li>
          <li>
            <span className="badge">Planned</span> Saved plans across devices with Firebase.
          </li>
        </ul>
      </section>
    </>
  );
}
