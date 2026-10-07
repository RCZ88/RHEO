/**
 * orbit-layout.ts — PURE geometry for SurfaceOrbit. No React, no DOM.
 *
 * Ported from `agent/docs/21st-dev-prompts/Orbit Flip Slider/PROMPT.md`
 * (21st.dev / @hyperiux), whose layout math was already dependency-free
 * trigonometry; only its GSAP animation layer needed replacing.
 *
 * Kept in its own module so it can be probed in plain node
 * (`landing/scripts/probe-orbit.mjs`) without React or JSX. An agent may not
 * run a build (AGENTS.md §0-0), so this probe is the ONLY way to verify the
 * geometry is sane — reading the code cannot tell you that 17 cards land
 * off-screen.
 */

export type OrbitMode = "flat" | "tilt" | "ring" | "gallery";

export type CardBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

/**
 * Two card sizes, and the reason there are two.
 *
 * MEASURED (scripts/probe-orbit.mjs, 17 captures, stage 1280x620):
 *
 *   ring cards @560x350 -> overflows the stage by 1276px. Cannot fit.
 *   ring cards @200x125 -> fits, 44px margin.
 *
 * 17 x 560px = 9,520px of card edge has to close into a loop, so the ring's
 * circumference cannot shrink without the cards shrinking. At 560px the ring
 * simply does not fit any screen. The source component dodged this by
 * defaulting to 140x200 cards — too small to read a 2880x1800 capture.
 *
 * So: the RING holds thumbnails small enough that all seventeen are visible at
 * once (that is the "the whole app" claim, made visible in one glance), and
 * the card you actually READ is rendered separately at full size beside it.
 * One glance for breadth, one honest full-size view for detail.
 */

/** Ring thumbnails. 200x125 keeps aspect 1.6 and fits 1280x620 with margin. */
export const THUMB_W = 200;
export const THUMB_H = 125;

/**
 * The front card, rendered OUTSIDE the ring, at a size you can read.
 *
 * Declared before CARD_ASPECT because that is a module-level `const`
 * initialised from these — referencing it earlier is a temporal dead zone
 * error at import time, which neither tsc nor esbuild flags because both
 * treat module-level consts as safely ordered. Only RUNNING the module throws
 * `ReferenceError: Cannot access 'CARD_W' before initialization`.
 */
export const CARD_W = 560;
export const CARD_H = 350;

/** Every card keeps the captures' 1.6 landscape aspect, at any size. */
export const CARD_ASPECT = CARD_W / CARD_H;

/**
 * The largest card size that fits this stage for this mode, capped at `max`.
 *
 * Needed because the ring's radius is derived from card size, so a fixed 200px
 * overflows on mobile (measured 489-645px across all four modes at 390x460).
 * Solving for size per-stage is what makes the ring responsive without four
 * separate hand-tuned layouts.
 *
 * Found by BISECTION against real layout() output rather than by algebra:
 * overflow is monotonic in card size, so a doubling search converges in ~7
 * steps and always terminates on a measurable answer.
 */
export type CardFit = {
  /** thumbnail width in px, already aspect-corrected for height */
  size: number;
  height: number;
  /** true when even the floor size overflows — the caller should fall back to
   *  a flat grid, because a clipped ring is worse than a stacked list */
  overflows: boolean;
};

/**
 * As fitCardSize, but REPORTS whether it could not achieve a fit.
 *
 * `fitCardSize` alone would return its floor size and look like a success.
 * Measured: at 390x460 with 17 cards, `tilt` and `ring` still overflow even at
 * the floor — a 17-card loop has nowhere to go on a phone. The caller needs to
 * know that so it can swap to a non-circular layout instead of shipping a ring
 * with cards hanging off the edges.
 */
export function fitCard(
  mode: OrbitMode,
  count: number,
  containerW: number,
  containerH: number,
  max: number,
  bleed = 8
): CardFit {
  const FLOOR_CARD = 32;
  const overflows = (w: number) => {
    const h = Math.round(w / CARD_ASPECT);
    const boxes = buildLayout(mode, count, containerW, containerH, 0, w, h);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const b of boxes) {
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.width);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
    }
    return Math.max(-minX, maxX - containerW, -minY, maxY - containerH) > bleed;
  };

  const size = fitCardSize(mode, count, containerW, containerH, max, bleed);
  return { size, height: Math.round(size / CARD_ASPECT), overflows: overflows(size) };
}

export function fitCardSize(
  mode: OrbitMode,
  count: number,
  containerW: number,
  containerH: number,
  max: number,
  bleed = 8
): number {
  // Below this a thumbnail is not a thumbnail, it is a smudge.
  const FLOOR_CARD = 32;
  const overflows = (w: number) => {
    const h = Math.round(w / CARD_ASPECT);
    const boxes = buildLayout(mode, count, containerW, containerH, 0, w, h);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const b of boxes) {
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.width);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
    }
    return (
      Math.max(-minX, maxX - containerW, -minY, maxY - containerH) > bleed
    );
  };

  if (!overflows(max)) return max;

  // Bisect for the largest size that fits. Overflow is monotonic in card size,
  // so this always converges — and because `overflows` is measured against the
  // real layout() output rather than solved algebraically, it accounts for the
  // Z-rotation in `ring` mode, which widens the bounding box in a way the
  // radius maths alone does not predict.
  //
  // If even the floor cannot fit (measured: mobile 390x460 in `tilt` mode,
  // where a 17-card loop around a 390px-wide stage has nowhere to go), return
  // the floor AND let the caller know. Silently returning a size that still
  // overflows would hand the component a card it cannot place — the bug this
  // whole function exists to prevent.
  let lo = FLOOR_CARD;
  let hi = max;
  if (overflows(lo)) return lo;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (overflows(mid)) hi = mid;
    else lo = mid;
  }
  return Math.floor(lo);
}

/**
 * The source component hardcoded `MOBILE_BREAKPOINT` and just shrank the ring's
 * radius by a flat factor on narrow viewports (0.55-0.6). That was a guess.
 *
 * Kept as the single number the component uses to choose BETWEEN the ring and
 * the grid fallback — it is not used to scale anything, because fitCard() solves
 * the size from real layout output instead.
 */
export const MOBILE_BREAKPOINT = 768;

/**
 * A ring of every capture, as one grid.
 *
 * When `fitCard` reports that even a 32px card cannot close a loop on this
 * stage, an orbiting ring is the wrong shape — the cards would hang off every
 * edge. A plain grid says "here is the whole app" just as honestly, and it is
 * readable, which an orbiting ring of 17px smudges is not.
 *
 * `cols` is passed by the caller from the real measured width, so this adapts
 * to the container instead of assuming a breakpoint.
 */
export function gridCols(containerW: number, minCard: number, gap: number, count: number): number {
  if (containerW <= 0 || count <= 0) return 1;
  const fit = Math.max(1, Math.floor((containerW + gap) / (minCard + gap)));
  return Math.max(1, Math.min(count, fit));
}

export function getBaseOrbitRadius(
  count: number,
  cardWidth: number,
  cardHeight: number,
  imageGap: number
): number {
  const baseSpan = Math.max(cardWidth, cardHeight) + imageGap;
  return Math.max((count * baseSpan) / (2 * Math.PI) * 0.62, baseSpan * 0.9);
}

type CoverflowParams = {
  radius: number;
  tiltDeg: number;
  camDistFactor: number;
  offsetDeg: number;
  anchorY: number;
  positionScaleStrength: number;
  sizeScaleStrength: number;
};

/**
 * Cards stay flat and forward-facing (billboarded) wherever they sit on the
 * ring — only position and depth-driven scale + z-index change. Verbatim from
 * the source component.
 */
export function buildCoverflowLayout(
  count: number,
  containerW: number,
  containerH: number,
  sizes: { w: number; h: number }[],
  params: CoverflowParams
): CardBox[] {
  const cx = containerW / 2;
  const camDist = params.radius * params.camDistFactor;
  const tilt = (params.tiltDeg * Math.PI) / 180;

  return sizes.map((size, i) => {
    const theta = ((params.offsetDeg + (i / count) * 360) * Math.PI) / 180;
    const px = params.radius * Math.sin(theta);
    const pz0 = -params.radius * Math.cos(theta);
    const py = -pz0 * Math.sin(tilt);
    const pz = pz0 * Math.cos(tilt);
    const scale = Math.max(camDist / (camDist + pz), 0.05);
    const positionScale = 1 + (scale - 1) * params.positionScaleStrength;
    const sizeScale = 1 + (scale - 1) * params.sizeScaleStrength;

    return {
      x: cx + px * positionScale,
      y: containerH * params.anchorY + py * positionScale,
      width: size.w * sizeScale,
      height: size.h * sizeScale,
      zIndex: Math.round(scale * 1000) + 1,
    };
  });
}

export function applyUniformScale(
  boxes: CardBox[],
  cx: number,
  cy: number,
  scale: number
): CardBox[] {
  if (scale === 1) return boxes;
  return boxes.map((b) => ({
    ...b,
    x: cx + (b.x - cx) * scale,
    y: cy + (b.y - cy) * scale,
    width: b.width * scale,
    height: b.height * scale,
  }));
}

export function applyZRotation(
  boxes: CardBox[],
  cx: number,
  cy: number,
  zDeg: number
): CardBox[] {
  if (!zDeg) return boxes;
  const rad = (zDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return boxes.map((b) => {
    const dx = b.x - cx;
    const dy = b.y - cy;
    return { ...b, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

export function applyRadiusScale(
  boxes: CardBox[],
  cx: number,
  cy: number,
  baseRadius: number,
  radiusX: number,
  radiusY: number
): CardBox[] {
  const sx = radiusX / baseRadius;
  const sy = radiusY / baseRadius;
  if (sx === 1 && sy === 1) return boxes;
  return boxes.map((b) => ({
    ...b,
    x: cx + (b.x - cx) * sx,
    y: cy + (b.y - cy) * sy,
  }));
}

/**
 * The ring, projected four ways. `flat` is a screen-on circle; `ring` is a
 * tilted ring; `tilt` is a steep coverflow where cards ride over each other;
 * `gallery` is a shallow, wide, low-angle one.
 */
export function buildLayout(
  mode: OrbitMode,
  count: number,
  containerW: number,
  containerH: number,
  offsetDeg: number,
  cardW: number = CARD_W,
  cardH: number = CARD_H
): CardBox[] {
  const cx = containerW / 2;
  const cy = containerH / 2;
  const sizes = Array.from({ length: count }, () => ({ w: cardW, h: cardH }));
  const baseRadius = getBaseOrbitRadius(count, cardW, cardH, 0);

  if (mode === "flat") {
    // A circle seen head-on. radiusY < radiusX flattens it into an ellipse so
    // it fits a wide stage instead of a square one.
    const rx = baseRadius * 1.45;
    const ry = baseRadius * 0.62;
    return sizes.map((_, i) => {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2 + (offsetDeg * Math.PI) / 180;
      return {
        x: cx + rx * Math.cos(a),
        y: cy + ry * Math.sin(a),
        width: cardW,
        height: cardH,
        zIndex: i + 1,
      };
    });
  }

  if (mode === "gallery") {
    const radius = baseRadius * 1.55;
    const boxes = buildCoverflowLayout(count, containerW, containerH, sizes, {
      radius,
      tiltDeg: 10,
      camDistFactor: 1.55,
      offsetDeg: -90 + offsetDeg,
      anchorY: 0.5,
      positionScaleStrength: 0.28,
      sizeScaleStrength: 0.16,
    });
    return applyUniformScale(
      applyRadiusScale(boxes, cx, cy, radius, radius * 1.05, radius * 0.5),
      cx,
      cy,
      1.15
    );
  }

  if (mode === "ring") {
    const radius = baseRadius * 1.12;
    const boxes = buildCoverflowLayout(count, containerW, containerH, sizes, {
      radius,
      tiltDeg: 31,
      camDistFactor: 1.75,
      offsetDeg: -90 + offsetDeg,
      anchorY: 0.5,
      positionScaleStrength: 0.45,
      sizeScaleStrength: 0.42,
    });
    const stretched = applyRadiusScale(boxes, cx, cy, radius, radius * 1.5, radius * 0.65);
    return applyZRotation(applyUniformScale(stretched, cx, cy, 0.62), cx, cy, -25);
  }

  // tilt — steep, cards stack over one another
  const radius = baseRadius * 1.12;
  const boxes = buildCoverflowLayout(count, containerW, containerH, sizes, {
    radius,
    tiltDeg: 70,
    camDistFactor: 1.75,
    offsetDeg: -90 + offsetDeg,
    anchorY: 0.5,
    positionScaleStrength: 0.45,
    sizeScaleStrength: 0.42,
  });
  return applyUniformScale(
    applyRadiusScale(boxes, cx, cy, radius, radius * 1.2, radius),
    cx,
    cy,
    0.95
  );
}

/**
 * The index whose card is nearest the camera, i.e. the readable one.
 * For the billboarded coverflow modes the highest zIndex is the front card;
 * for `flat` every card is z-ordered by array position, so front is defined as
 * the card nearest the horizontal centre of the stage.
 */
export function frontIndex(
  mode: OrbitMode,
  boxes: CardBox[],
  containerW: number,
  containerH: number
): number {
  if (!boxes.length) return -1;
  if (mode === "flat") {
    let best = 0;
    let bestD = Infinity;
    boxes.forEach((b, i) => {
      const d = Math.hypot(b.x - containerW / 2, b.y - containerH / 2);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
  let best = 0;
  let maxZ = -Infinity;
  boxes.forEach((b, i) => {
    if (b.zIndex > maxZ) {
      maxZ = b.zIndex;
      best = i;
    }
  });
  return best;
}

/** Degrees per card — one notch of the ring. */
export function stepFor(count: number): number {
  return 360 / Math.max(1, count);
}

/** Nearest notch to an arbitrary offset, so a flung ring settles on a card. */
export function snapOffset(offset: number, count: number): number {
  const step = stepFor(count);
  return Math.round(offset / step) * step;
}