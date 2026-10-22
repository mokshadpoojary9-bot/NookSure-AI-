import { m, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { EASE, reveal } from "./motion";

interface Props {
  index: number;
  className?: string;
  /** Used in the flip button's accessible name, e.g. "Show example: Reuse". */
  title: string;
  front: ReactNode;
  back: ReactNode;
}

/**
 * A flashcard: the step on the front, a short example on the back. Flips on hover,
 * and on click/tap/Enter/Space via a button covering the card. Both faces stay in the
 * accessibility tree, so screen-reader users get the step and its example either way.
 */
export function FlipCard({ index, className = "", title, front, back }: Props) {
  const reduced = useReducedMotion();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const flipped = pinned || hovered;
  return (
    <m.li
      className={`flip-card ${className}${flipped ? " flipped" : ""}`}
      {...reveal(index, reduced)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <m.div
        className="flip-inner"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.6, ease: EASE }}
      >
        <div className="flip-face flip-front">{front}</div>
        <div className="flip-face flip-back">{back}</div>
      </m.div>
      <button
        type="button"
        className="flip-toggle"
        aria-pressed={flipped}
        onClick={() => {
          // A click decides the side outright, whatever hovering did.
          setPinned(!flipped);
          setHovered(false);
        }}
      >
        <span className="visually-hidden">Show example: {title}</span>
      </button>
    </m.li>
  );
}
