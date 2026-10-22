import { m, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { lift, reveal } from "./motion";

export interface Feature {
  icon: string;
  title: string;
  text: string;
}

/**
 * Swipeable row of feature cards: native scroll-snap (touch swipe, trackpad, keyboard
 * arrows once focused) plus previous/next buttons. It never moves on its own, so there
 * is nothing to pause; the page itself never scrolls sideways.
 */
export function FeatureCarousel({ features, label }: { features: readonly Feature[]; label: string }) {
  const reduced = useReducedMotion();
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const go = (dir: -1 | 1) => {
    const el = track.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    el.scrollBy?.({ left: dir * (card.getBoundingClientRect().width + 16), behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="carousel">
      {/* Focusable so keyboard users can scroll it with the arrow keys. */}
      <ul className="feature-track" ref={track} onScroll={update} tabIndex={0} aria-label={label}>
        {features.map((f, i) => (
          <m.li key={f.title} className="card feature glow-card" {...reveal(i, reduced)} whileHover={lift(reduced)}>
            <span className="feature-icon" aria-hidden="true">
              {f.icon}
            </span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </m.li>
        ))}
      </ul>
      <div className="carousel-controls">
        <button type="button" className="carousel-btn" onClick={() => go(-1)} disabled={edges.start} aria-label="Previous features">
          <span aria-hidden="true">←</span>
        </button>
        <button type="button" className="carousel-btn" onClick={() => go(1)} disabled={edges.end} aria-label="Next features">
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
