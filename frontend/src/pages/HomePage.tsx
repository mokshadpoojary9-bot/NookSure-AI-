import { LazyMotion, MotionConfig, m, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { HomeLayoutSchema, KIND_LABELS, KIND_ORDER, type HomeProfile } from "@nooksure/shared";
import { FeatureCarousel } from "../components/landing/FeatureCarousel";
import { FlipCard } from "../components/landing/FlipCard";
import { LazyHeroScene } from "../components/landing/LazyHeroScene";
import { lift, loadMotionFeatures, reveal } from "../components/landing/motion";
import { LazyRoomView3D } from "../components/room3d/LazyRoomView3D";
import { href } from "../router";

const KIND_BLURBS = {
  reuse: "Put things you already own to safer use — lamps, baskets, shelves.",
  rearrange: "Move furniture and everyday items to open routes and bring essentials within reach.",
  remove: "Take away trip hazards: loose rugs, clutter, trailing cables.",
  purchase: "Only then, buy purpose-built products — properly installed where they bear weight.",
} as const;

/** Back of each "Use What You Have" card: one concrete example. */
const KIND_EXAMPLES = {
  reuse: { icon: "♻️", text: "Move a lamp you already own so it lights the route from the bed to the bathroom." },
  rearrange: { icon: "🔀", text: "Push the armchair back against the wall so the walking route stays clear." },
  remove: { icon: "🧹", text: "Roll up the loose rug and store it — one less thing to catch a walker or a foot." },
  purchase: { icon: "🛒", text: "A grab bar beside the toilet, installed by a professional — never a towel rail or furniture." },
} as const;

const STEPS = [
  {
    icon: "🏠",
    title: "Tell us your home",
    text: "Pick your home type — Studio, 1BHK, 2BHK, 3BHK or custom — and a few layout details, including any garden.",
    example: "A 1BHK with an open kitchen and the front door into the living room becomes one “Living room + entrance + open kitchen” space, a bedroom and a bathroom.",
  },
  {
    icon: "📝",
    title: "Pick needs, furniture and issues",
    text: "Choose the mobility aids, tick the furniture you already have, and note what you see in each room.",
    example: "A walker; in the living room you tick a sofa, a rug and a floor lamp, and note a loose rug and dim lighting.",
  },
  {
    icon: "🧊",
    title: "Get an ordered plan and a labelled 3D view",
    text: "A checklist that reuses before it buys, and a 3D view of each room with your issues marked where they are.",
    example: "“Roll up your rug and store it” comes before anything to buy, and the 3D view pins the rug where it lies.",
  },
];

const FEATURES = [
  { icon: "🏠", title: "Home layout setup", text: "Rooms generated from your home type, with merged spaces like an open kitchen handled for you." },
  { icon: "♻️", title: "Furniture-aware, reuse-first plan", text: "Advice about your own sofa, lamps and mats first — reuse, rearrange, remove, then purchase." },
  { icon: "🧊", title: "Labelled 3D view with overlays", text: "See issues where they are, plus a turning circle, walking path, grab bar zones and night-light route." },
  { icon: "🌿", title: "Garden and outdoor areas", text: "Paths, steps, gravel, moss and lighting outside the front or back door." },
  { icon: "💬", title: "AI assistant", text: "Ask questions by typing or speaking, and hear answers read aloud. Guidance only, never an inspection." },
  { icon: "💾", title: "Saved plans", text: "Sign in with Google to keep plans in your account. Guests can still plan in the browser." },
];

const AUDIENCE = [
  { title: "Walker users", text: "Wider routes, fewer trip hazards, essentials at easy height." },
  { title: "Wheelchair users", text: "Turning space, clear paths and step-free thinking." },
  { title: "Older adults", text: "Better lighting, safer bathrooms and fewer slips." },
  { title: "Caregivers", text: "A shared, ordered checklist when preparing for someone coming home." },
];

/** Example used only for the live preview on this page — not anyone's real home. */
const EXAMPLE: HomeProfile = {
  aids: ["walker"],
  notes: "",
  layout: HomeLayoutSchema.parse({ homeType: "1bhk", doorIntoLiving: true }),
  rooms: ["living_room"],
  concerns: { living_room: ["narrow_path", "poor_lighting", "loose_rugs"] },
  furniture: { living_room: { items: ["sofa", "armchair", "coffee_table", "rug", "floor_lamp", "plants", "shoe_rack"], other: "", skipped: false } },
};

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HomePage() {
  return (
    // Animation code arrives in its own chunk; `strict` keeps heavy `motion.*` components out.
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <Landing />
      </MotionConfig>
    </LazyMotion>
  );
}

function Landing() {
  const howRef = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState(false);
  const reduced = useReducedMotion();
  // In-page jump without touching the hash router.
  const showHow = () => {
    howRef.current?.scrollIntoView?.({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    howRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <section className="hero hero-split">
        <div className="hero-copy">
          <p className="eyebrow">Home accessibility planning</p>
          <h1>NookSure AI</h1>
          <p className="hero-headline">Make your home safer for mobility needs — using what you already have.</p>
          <p className="tagline">Prepare thoughtfully. Reuse wisely.</p>
          <p className="lead">
            Plan for a walker, wheelchair or unsteady feet room by room. NookSure turns what you notice into an ordered
            checklist that reuses, rearranges and removes before it ever suggests a purchase.
          </p>
          <div className="actions">
            <a className="button primary" href={href("/plan")}>
              Start planning
            </a>
            <button type="button" className="button" onClick={showHow}>
              See how it works
            </button>
          </div>
        </div>
        <LazyHeroScene />
      </section>

      <section aria-labelledby="preview-heading" className="preview">
        <div className="preview-text">
          <h2 id="preview-heading" className="accent-heading">
            See a room in 3D
          </h2>
          <p>
            Every plan comes with an interactive 3D view of each room — an illustrative layout, not to scale — with your
            issues and furniture labelled, and optional overlays for turning space, walking paths and grab bar zones.
          </p>
          {!preview && (
            <button type="button" className="button" onClick={() => setPreview(true)}>
              Show a live 3D example
            </button>
          )}
        </div>
        <div className="preview-stage">
          {preview ? (
            <>
              <p className="badge">Example room — not your home</p>
              <LazyRoomView3D room="living_room" profile={EXAMPLE} done={[]} maxPins={4} />
            </>
          ) : (
            <div className="preview-placeholder" aria-hidden="true">
              <span>🛋️</span>
              <span>💡</span>
              <span>🪴</span>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="how-heading" ref={howRef} tabIndex={-1} className="how">
        <h2 id="how-heading" className="accent-heading">
          How it works
        </h2>
        <p className="flip-hint">Hover over a card, or select it, to see an example.</p>
        <ol className="how-steps">
          {STEPS.map((s, i) => (
            <FlipCard
              key={s.title}
              index={i}
              className="card how-step"
              title={s.title}
              front={
                <>
                  <div className="flip-top">
                    <span className="how-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="flip-icon" aria-hidden="true">
                      {s.icon}
                    </span>
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </>
              }
              back={
                <>
                  <p className="flip-label">Example</p>
                  <p>{s.example}</p>
                </>
              }
            />
          ))}
        </ol>
        <h3 className="order-title">The “Use What You Have” order</h3>
        <ol className="kind-steps">
          {KIND_ORDER.map((kind, i) => (
            <FlipCard
              key={kind}
              index={i}
              className={`kind-step kind-${kind}`}
              title={KIND_LABELS[kind]}
              front={
                <>
                  <div className="flip-top">
                    <span className="kind-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="flip-icon" aria-hidden="true">
                      {KIND_EXAMPLES[kind].icon}
                    </span>
                  </div>
                  <h3>{KIND_LABELS[kind]}</h3>
                  <p>{KIND_BLURBS[kind]}</p>
                </>
              }
              back={
                <>
                  <p className="flip-label">Example</p>
                  <p>{KIND_EXAMPLES[kind].text}</p>
                </>
              }
            />
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="accent-heading">
          Key features
        </h2>
        <FeatureCarousel features={FEATURES} label="Key features (scroll sideways for more)" />
      </section>

      <section aria-labelledby="audience-heading">
        <h2 id="audience-heading" className="accent-heading">
          Who it’s for
        </h2>
        <ul className="audience-grid">
          {AUDIENCE.map((a, i) => (
            <m.li key={a.title} className="audience glow-card" {...reveal(i, reduced)} whileHover={lift(reduced)}>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </m.li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="safety-heading" className="card safety-callout">
        <h2 id="safety-heading">A note on safety</h2>
        <p>
          NookSure gives planning guidance, not a safety certificate. It never suggests improvised grab bars or ramps:
          anything that bears weight or prevents falls points to a purpose-built product and professional advice. For
          health questions or installations, consult an occupational therapist, physiotherapist or qualified installer.
        </p>
        <p>
          <a href={href("/safety")}>Read our safety principles</a> · Your plan is saved in this browser; sign in with
          Google to also save it to your account.
        </p>
      </section>
    </>
  );
}
