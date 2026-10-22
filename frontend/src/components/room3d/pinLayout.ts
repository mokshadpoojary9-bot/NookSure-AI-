/**
 * Screen-space placement for the numbered pins over the 3D view. Pure (no three.js)
 * so it can be unit-tested. Each pin wants to sit on its anchor (the projected
 * label point); when that would overlap a pin already placed, it moves to the
 * nearest free spot and a leader line joins it back to the anchor.
 */

export interface Anchor {
  x: number;
  y: number;
  /** False when the point is behind the camera. */
  visible: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placement {
  /** Pin centre in pixels. */
  x: number;
  y: number;
  visible: boolean;
  /** True when the pin was pushed off its anchor (draw a leader line). */
  moved: boolean;
}

export interface PinLayoutOptions {
  width: number;
  height: number;
  /** Pin radius in pixels. */
  radius: number;
  /** Minimum space between two pins. */
  gap: number;
  /** Areas pins must stay out of (e.g. the room-name chip). */
  avoid?: readonly Rect[];
}

export interface PinSource {
  kind: string;
  status: "high" | "medium" | "done";
}

const STATUS_RANK = { high: 0, medium: 1, done: 2 } as const;
const KIND_RANK: Record<string, number> = { issue: 0, overlay: 1, furniture: 2, info: 3 };

/** At most `max` pins: issues first, then by priority. Keeps the original order (and so the numbering). */
export function choosePins<T extends PinSource>(labels: readonly T[], max?: number): T[] {
  if (max === undefined || labels.length <= max) return [...labels];
  const rank = (l: T) => (KIND_RANK[l.kind] ?? 9) * 10 + STATUS_RANK[l.status];
  const keep = new Set(
    labels
      .map((l, i) => ({ l, i }))
      .sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i)
      .slice(0, max)
      .map((x) => x.l),
  );
  return labels.filter((l) => keep.has(l));
}

const ANGLES = Array.from({ length: 12 }, (_, i) => -Math.PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6));

/** Places pins in the given order (earlier pins keep their anchors first); no two placed pins overlap. */
export function placePins(anchors: readonly Anchor[], o: PinLayoutOptions): Placement[] {
  const { width, height, radius: r, gap } = o;
  const step = 2 * r + gap;
  const placed: { x: number; y: number }[] = [];
  const inside = (x: number, y: number) => x >= r && x <= width - r && y >= r && y <= height - r;
  const clear = (x: number, y: number) =>
    placed.every((p) => Math.hypot(p.x - x, p.y - y) >= step - 1e-6) &&
    (o.avoid ?? []).every((a) => x + r <= a.x || x - r >= a.x + a.w || y + r <= a.y || y - r >= a.y + a.h);

  return anchors.map((a) => {
    if (!a.visible) return { x: a.x, y: a.y, visible: false, moved: false };
    const ax = Math.min(Math.max(a.x, r), width - r);
    const ay = Math.min(Math.max(a.y, r), height - r);
    let spot: { x: number; y: number } | null = null;
    if (clear(ax, ay)) spot = { x: ax, y: ay };
    // Rings of candidate spots around the anchor, nearest first, preferring "above".
    for (let ring = 1; !spot && ring <= 8; ring++) {
      for (const t of ANGLES) {
        const x = ax + Math.cos(t) * step * ring;
        const y = ay + Math.sin(t) * step * ring;
        if (inside(x, y) && clear(x, y)) {
          spot = { x, y };
          break;
        }
      }
    }
    // Last resort: the free grid cell nearest the anchor (the view is always big enough for a few pins).
    if (!spot) {
      let best = Infinity;
      for (let y = r; y <= height - r; y += step)
        for (let x = r; x <= width - r; x += step) {
          const d = Math.hypot(x - ax, y - ay);
          if (d < best && clear(x, y)) {
            best = d;
            spot = { x, y };
          }
        }
    }
    if (!spot) return { x: ax, y: ay, visible: false, moved: false };
    placed.push(spot);
    return { ...spot, visible: true, moved: Math.hypot(spot.x - a.x, spot.y - a.y) > r };
  });
}
