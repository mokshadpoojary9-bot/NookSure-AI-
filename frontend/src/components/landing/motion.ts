import type { HTMLMotionProps } from "framer-motion";

/** The site's easing curve (same as --ease in styles.css). */
export const EASE = [0.2, 0.7, 0.2, 1] as const;

/** Animation features, fetched in their own chunk by <LazyMotion> so the page shell stays small. */
export const loadMotionFeatures = () => import("./motionFeatures").then((m) => m.default);

/**
 * Fade-and-slide-up as the element scrolls into view, staggered by index.
 * Nothing at all when reduced motion is requested: content is simply there.
 */
export function reveal(index: number, reduced: boolean | null): HTMLMotionProps<"li"> {
  // Without IntersectionObserver (very old browsers) there'd be no way to reveal it: just show it.
  if (reduced || typeof IntersectionObserver === "undefined") return {};
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.55, ease: EASE, delay: Math.min(index, 6) * 0.09 },
  };
}

/** Gentle lift on hover (cards). */
export const lift = (reduced: boolean | null) => (reduced ? undefined : { y: -6, transition: { duration: 0.2, ease: EASE } });
