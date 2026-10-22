import { useReducedMotion } from "framer-motion";
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";

// three.js + R3F load only after the page is idle, keeping the first paint fast.
const HeroScene = lazy(() => import("./HeroScene"));

/** Kept local (not imported from the 3D code) so this file never pulls three.js into the main bundle. */
function webglAvailable(): boolean {
  if (typeof WebGLRenderingContext === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const saveData = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

/** A decoration only: if it can't load, the soft backdrop stays. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function LazyHeroScene() {
  const still = useReducedMotion() ?? false;
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);

  // Start loading once the browser is idle, and only where WebGL works and data isn't being saved.
  useEffect(() => {
    if (!webglAvailable() || saveData()) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(t);
  }, []);

  // Stop rendering frames while the hero is scrolled out of view.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(Boolean(e?.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="hero-stage" ref={box} aria-hidden="true">
      <div className="hero-backdrop" />
      {ready && (
        <Quiet>
          <Suspense fallback={null}>
            <HeroScene still={still} active={onScreen} />
          </Suspense>
        </Quiet>
      )}
    </div>
  );
}
