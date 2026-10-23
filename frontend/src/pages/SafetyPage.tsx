import { LazyMotion, MotionConfig, m, useReducedMotion } from "framer-motion";
import { useRef, useState, type KeyboardEvent } from "react";
import { lift, loadMotionFeatures, reveal } from "../components/landing/motion";
import { href } from "../router";

const PRINCIPLES = [
  {
    icon: "🚫",
    title: "No improvised ramps or load-bearing fixes",
    text: "Never stacked bricks, boxes, crates or books as ramps or steps, and nothing improvised that has to hold a person’s weight or stop a fall.",
  },
  {
    icon: "🛠️",
    title: "Grab bars installed only by professionals",
    text: "Grab bars, handrails and ramps are purpose-built products, correctly installed. Furniture, towel rails and sinks are never handholds.",
  },
  {
    icon: "♻️",
    title: "Reuse before buying",
    text: "Reuse, rearrange and remove first — lamps, shelves and baskets you already own — and only then purchase.",
  },
  {
    icon: "🏷️",
    title: "Never “certified safe”",
    text: "NookSure gives planning guidance. It never describes a home as “certified safe” or “fully accessible”, and AI replies are always labelled as live or sample.",
  },
  {
    icon: "🔒",
    title: "Your data stays private",
    text: "Your plan stays in this browser unless you sign in to save it to your own account. Assistant questions are sent to the server only to get a reply — leave out personal details.",
  },
];

/** Quick checks per room — the same advice the planner gives (see shared/src/planner.ts). */
const ROOM_CHECKS = [
  {
    id: "entrance",
    label: "Entrance",
    checks: [
      "Clear the area around the step",
      "Mark step and threshold edges with high-contrast tape",
      "Make sure your door mat lies flat and doesn't slide",
      "Use your shoe rack to keep shoes off the floor",
    ],
  },
  {
    id: "living",
    label: "Living room",
    checks: ["Take up loose rugs and mats", "Move furniture to widen the main route", "Re-route cables along walls", "Move existing lamps onto the route"],
  },
  {
    id: "bedroom",
    label: "Bedroom",
    checks: [
      "Keep your bedside lamp within reach of the bed",
      "Add plug-in or motion-sensor night lights",
      "Clear the main walking route",
      "Your wardrobe: keep everyday clothes at easy height",
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen",
    checks: [
      "Move everyday items to easy reach",
      "Keep daily kitchen items at the front of your counter",
      "Use non-slip mats or anti-slip floor treatment",
      "Your dining table: push it and the chairs to one side",
    ],
  },
  {
    id: "bathroom",
    label: "Bathroom",
    checks: [
      "Remove mats that slide",
      "Place essentials within reach of wet areas",
      "Keep your stool out of the wet area",
      "Have grab bars or a handrail professionally installed",
    ],
  },
  {
    id: "garden",
    label: "Garden",
    checks: [
      "Choose the flattest route and keep it clear",
      "Brush away moss, algae and wet leaves",
      "Trim low branches over the path",
      "Have a handrail professionally installed beside the steps",
    ],
  },
] as const;

const DOS = [
  "Remove loose rugs, clutter and trailing cables from walking routes.",
  "Rearrange furniture to widen paths and clear turning space.",
  "Move everyday items to easy reach, between waist and shoulder height.",
  "Move lamps you already have to light routes, steps and the way to the bathroom.",
];

const DONTS = [
  "Use a towel rail, sink, furniture or fixture as a grab bar or handhold.",
  "Stack bricks, boxes, crates or books as a ramp, step or platform.",
  "Improvise grab bars, ramps, transfer aids, bed rails or handrails.",
  "Remove or bypass safety devices.",
];

const PROFESSIONAL = ["Ramps", "Railings", "Grab bars", "Structural changes", "Electrical work", "Door widening"];

export function SafetyPage() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Safety />
      </MotionConfig>
    </LazyMotion>
  );
}

function Safety() {
  const reduced = useReducedMotion();
  return (
    <article className="safety-page">
      <header className="safety-hero">
        <div className="safety-glow" aria-hidden="true" />
        <p className="eyebrow">Safety principles</p>
        <h1>Safety first, always</h1>
        <p className="lead">
          NookSure gives planning guidance, not a safety certificate — it doesn’t replace an occupational therapist,
          physiotherapist or qualified installer.
        </p>
      </header>

      <section aria-labelledby="principles-heading">
        <h2 id="principles-heading" className="accent-heading">
          Our safety principles
        </h2>
        <ul className="principle-grid">
          {PRINCIPLES.map((p, i) => (
            <m.li key={p.title} className="principle glow-card" {...reveal(i, reduced)} whileHover={lift(reduced)}>
              <span className="principle-icon" aria-hidden="true">
                {p.icon}
              </span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </m.li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="accent-heading">
          Room-by-room quick checks
        </h2>
        <RoomTabs />
      </section>

      <section aria-labelledby="dodont-heading">
        <h2 id="dodont-heading" className="accent-heading">
          Do and don’t
        </h2>
        <ul className="dodont">
          <m.li className="dodont-card do" {...reveal(0, reduced)}>
            <h3>
              <span className="dodont-mark" aria-hidden="true">
                ✓
              </span>
              Do
            </h3>
            <ul>
              {DOS.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </m.li>
          <m.li className="dodont-card dont" {...reveal(1, reduced)}>
            <h3>
              <span className="dodont-mark" aria-hidden="true">
                ✕
              </span>
              Don’t
            </h3>
            <ul>
              {DONTS.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </m.li>
        </ul>
      </section>

      <section aria-labelledby="pro-heading">
        <h2 id="pro-heading" className="accent-heading">
          When to call a professional
        </h2>
        <p>
          For anything that bears weight or prevents falls, choose a purpose-built product, have it correctly installed,
          and ask a professional. Items in your plan marked <strong>Seek professional advice</strong> are a good place
          to start that conversation.
        </p>
        <ul className="pro-chips" aria-label="Get professional help with">
          {PROFESSIONAL.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <div className="safety-actions">
        <button type="button" className="button" onClick={() => window.print()}>
          Print checklist
        </button>
        <a className="button primary" href={href("/plan")}>
          Build your plan
        </a>
      </div>
    </article>
  );
}

/** WAI-ARIA tabs: arrow keys / Home / End move between rooms. Every room prints. */
function RoomTabs() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusTab = (i: number) => {
    const n = (i + ROOM_CHECKS.length) % ROOM_CHECKS.length;
    setActive(n);
    tabs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: ROOM_CHECKS.length - 1 };
    if (e.key in keys) {
      e.preventDefault();
      focusTab(keys[e.key]!);
    }
  };
  return (
    <div className="room-tabs">
      <div role="tablist" aria-label="Rooms" className="room-tablist" onKeyDown={onKey}>
        {ROOM_CHECKS.map((r, i) => (
          <button
            key={r.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${r.id}`}
            aria-selected={i === active}
            aria-controls={`panel-${r.id}`}
            tabIndex={i === active ? 0 : -1}
            className="room-tab"
            onClick={() => setActive(i)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {ROOM_CHECKS.map((r, i) => (
        <div key={r.id} role="tabpanel" id={`panel-${r.id}`} aria-labelledby={`tab-${r.id}`} tabIndex={0} hidden={i !== active} className="room-panel">
          <h3 className="print-only">{r.label}</h3>
          <ul className="check-list">
            {r.checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
