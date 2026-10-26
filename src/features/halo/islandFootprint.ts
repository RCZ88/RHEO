/**
 * ISLAND FOOTPRINT — where the Halo pill actually is, seen from inside the app.
 *
 * THE PROBLEM THIS EXISTS TO SOLVE
 * --------------------------------
 * The island is a separate always-on-top window parked at the top of the display. RHEO's top
 * bar is drawn underneath it by a different window entirely, so the two overlap with neither
 * knowing about the other. On a 2048-wide display the compact pill (198x32) occupies display
 * x 925..1123 while the top bar's right-hand cluster begins around window x 846: 198px of
 * toolbar — the Focus/Total switch and the tracked-time readout — sat permanently under the
 * pill. That is a layout collision, not a z-index mistake, and no amount of `z-index` can fix
 * it. The bar has to MOVE.
 *
 * THE MODEL: THE PILL IS A NOTCH, THE TOP BAR IS A LANE
 * ----------------------------------------------------
 * A notch does not "cover" content; content is laid out around it. So the top bar stops being
 * one `justify-between` row and becomes three columns —
 *
 *     [ left lane ][ hole ][ right lane ]
 *
 * — where `hole` is the pill plus its clearance and is positioned exactly where the pill is,
 * and the two lanes are the space that is left. Anything in a lane is guaranteed visible;
 * anything in the hole would be hidden, so nothing is put there. This is `paint`'s
 * "occlusion-not-eviction" lane model applied to the app side of the island: content yields,
 * it is never dropped.
 *
 * WHY THE NUMBERS COME FROM MAIN AND NOT FROM THE DOM
 * --------------------------------------------------
 * The island is a different WINDOW in the default path (`createHaloIsland` -> a real
 * `BrowserWindow`); there is no DOM node here to measure, and `window.screenX` is not
 * dependable under Wayland. So main computes the pill's rect from `computeSurfaceRect` — the
 * same function that shapes the click region and positions the hot zone, so the lane can never
 * drift from the rectangle the user can actually click — and publishes it already translated
 * into this window's viewport coordinates.
 *
 * The in-app mount (`HaloInAppMount`) is the other path, and there the pill IS a DOM node, so
 * it publishes its own measured rect through `publishInAppFootprint` below. Exactly one of the
 * two producers is live in any given session, so they cannot disagree.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * -----------------------------------------
 * It does not decide the layout, hide anything, or clamp what you put in a lane. It reports
 * three widths; the consumer brings its own flex behaviour. A hook that also chose what to
 * drop would be the eviction half of the model that the curation RESULT forbids.
 */

import { useEffect, useMemo, useState, useSyncExternalStore, type RefObject } from 'react';

/** The island's occluding rect, in this window's viewport pixels. */
export interface IslandFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
  /** `compact` is the resident pill; `expanded` is the hovered/pinned panel. */
  phase: 'compact' | 'expanded';
  /** False while nothing is painted — island off, `resident: 'off'`, or `resident: 'hover'` away. */
  visible: boolean;
}

/**
 * Breathing room between the pill's edge and the nearest control.
 *
 * 12px: it is on LAMINAR's 4px rhythm, it matches the island's own card padding at the Medium
 * preset, and it is wide enough that a control touching it does not read as part of the pill.
 * A cosmetic constant rather than a token because it is a distance between two unrelated
 * surfaces, not a member of either one's scale.
 */
const CLEARANCE = 12;

let current: IslandFootprint | null = null;
const listeners = new Set<() => void>();

/**
 * Publish a new footprint. Compares field by field rather than by identity: every push is a
 * fresh object off IPC, and the island pushes on every phase flip and preference change — a
 * layout pass per identical payload would be pure waste, and a store that notifies on no-op
 * writes is how a hover turns into a render storm.
 */
function publish(next: IslandFootprint | null): void {
  const a = current;
  if (a === next) return;
  if (
    a && next &&
    a.x === next.x && a.y === next.y &&
    a.width === next.width && a.height === next.height &&
    a.phase === next.phase && a.visible === next.visible
  ) return;
  current = next;
  for (const l of listeners) l();
}

/**
 * The in-app producer. Called by `OverlayRoot` with the painted surface element.
 *
 * Returns a cleanup that clears the lane, so unmounting the in-app island collapses the hole
 * rather than leaving the toolbar indented around a pill that is gone.
 */
export function publishInAppFootprint(el: HTMLElement, phase: 'compact' | 'expanded', visible: boolean): () => void {
  const read = () => {
    try {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      publish({ x: r.left, y: r.top, width: r.width, height: r.height, phase, visible });
    } catch {
      /* a detached node mid-teardown; the cleanup below clears the lane anyway */
    }
  };
  read();
  let ro: ResizeObserver | null = null;
  try {
    ro = new ResizeObserver(read);
    ro.observe(el);
  } catch {
    /* no ResizeObserver: the initial read plus the phase change still covers the common case */
  }
  return () => {
    try { ro?.disconnect(); } catch { /* already gone */ }
    publish(null);
  };
}

/* ---------------------------------------------------------------------------------------------
 * THE IPC PRODUCER — the default path (the island is its own window).
 * ------------------------------------------------------------------------------------------- */

let bridgeReady = false;

/**
 * Register the push listener exactly once for the whole renderer.
 *
 * Module-scoped rather than per-hook: the top bar and the terminal header both consume the
 * lane, and a per-hook `ipcRenderer.on` would leave a dead listener behind on every unmount
 * until the process died. `preload.ts` removes the listener it hands back, but only the caller
 * it handed it to can do that, and this store outlives every caller.
 */
function ensureBridge(): void {
  if (bridgeReady) return;
  if (typeof window === 'undefined') return;
  const bridge = (window as unknown as {
    haloBridge?: {
      onFootprint?: (cb: (f: IslandFootprint) => void) => () => void;
      getFootprint?: () => Promise<IslandFootprint | null>;
    };
  }).haloBridge;
  if (!bridge?.onFootprint) return;
  bridgeReady = true;
  try {
    bridge.onFootprint((f) => {
      // Defensive reads: this arrives over IPC from another process and a malformed payload
      // must collapse the lane, not poison the layout with NaN.
      if (!f || typeof f.x !== 'number' || typeof f.width !== 'number' || typeof f.height !== 'number') {
        publish(null);
        return;
      }
      publish({
        x: f.x,
        y: typeof f.y === 'number' ? f.y : 0,
        width: f.width,
        height: f.height,
        phase: f.phase === 'expanded' ? 'expanded' : 'compact',
        visible: f.visible !== false,
      });
    });
  } catch {
    bridgeReady = false;
  }
}

/**
 * Catch up on mount.
 *
 * Both launch orders are real: the main window is normally created BEFORE the island, so this
 * renderer mounts first and would reserve nothing until the first hover; after a renderer
 * reload it mounts long after the last push. Neither is covered by the push alone, so the
 * pull is not an optimisation — it is half the contract.
 */
function pullFootprint(): void {
  const bridge = (window as unknown as { haloBridge?: { getFootprint?: () => Promise<IslandFootprint | null> } }).haloBridge;
  if (!bridge?.getFootprint) return;
  try {
    void bridge.getFootprint().then((f) => {
      if (!f) { publish(null); return; }
      publish({
        x: f.x, y: f.y, width: f.width, height: f.height,
        phase: f.phase === 'expanded' ? 'expanded' : 'compact',
        visible: f.visible !== false,
      });
    }).catch(() => { /* no island, or IPC not up yet — an empty lane is the honest answer */ });
  } catch {
    /* preload absent (a test harness); the lane simply stays empty */
  }
}

function subscribe(cb: () => void): () => void {
  ensureBridge();
  if (listeners.size === 0) pullFootprint();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** The raw footprint for consumers that want to reason about the pill themselves. */
export function useIslandFootprint(): IslandFootprint | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

/* ---------------------------------------------------------------------------------------------
 * THE LANE
 * ------------------------------------------------------------------------------------------- */

/** A 3-column layout description: two usable lanes around the pill's hole. */
export interface IslandLane {
  /** True when a painted pill genuinely overlaps the element and the hole is reserved. */
  active: boolean;
  /** The hole's left edge, in the element's own border-box pixels. */
  left: number;
  /** The hole's width — the pill plus `CLEARANCE` on each side. Zero when inactive. */
  hole: number;
  /** The remaining width to the right of the hole. */
  right: number;
  /** Ready-made `grid-template-columns` for a 3-column lane. */
  template: string;
  phase: 'compact' | 'expanded' | null;
}

/**
 * The identity layout: two equal flexible lanes and no hole.
 *
 * This is not a neutral placeholder — it reproduces the existing `justify-between` row exactly
 * (left cluster flushed left, right cluster flushed right, nothing in between), so a consumer
 * that renders its normal markup inside these three columns gets the pre-island top bar when
 * there is no island. That property is what keeps this change from being visible at all to
 * anyone who turns the island off.
 */
const EMPTY_TEMPLATE = 'minmax(0, 1fr) 0px minmax(0, 1fr)';
const EMPTY_LANE: IslandLane = { active: false, left: 0, hole: 0, right: 0, template: EMPTY_TEMPLATE, phase: null };

interface Box { left: number; top: number; width: number; height: number }

function computeLane(box: Box | null, island: IslandFootprint | null): IslandLane {
  if (!box || !island || !island.visible) return EMPTY_LANE;
  const W = box.width;
  if (!(W > 0) || !(island.width > 0) || !(island.height > 0)) return EMPTY_LANE;

  /* VERTICAL OVERLAP IS TESTED FIRST, AND IT IS NOT A FORMALITY. `gapPx` lets the user float the
   * island up to 64px below the top edge, which on a short bar puts the pill entirely BELOW the
   * toolbar. Reserving a lane then would indent the bar around a pill it never touches. */
  const boxTop = box.top;
  const boxBottom = box.top + box.height;
  const pillTop = island.y;
  const pillBottom = island.y + island.height;
  if (pillBottom <= boxTop || pillTop >= boxBottom) return EMPTY_LANE;

  // The pill's horizontal span, translated into this element's own coordinate space. The two
  // boxes share the viewport origin, so this is a straight subtraction — no screen-origin
  // arithmetic, which is exactly the part that is unreliable under Wayland.
  const pillLeft = island.x - box.left;
  const pillRight = pillLeft + island.width;
  if (pillRight <= 0 || pillLeft >= W) return EMPTY_LANE;

  /* THE HOLE IS CLAMPED TO THE ELEMENT, NOT TO A MINIMUM LANE SIZE.
   *
   * A degenerate case exists: a Large pill at 1.6 scale on a narrow window is wider than the
   * whole top bar. Clamping to a minimum lane would push the columns past the container and
   * overflow it; clamping to the container keeps the grid valid and lets the consumer's own
   * wrapping deal with the leftover, which is the honest degradation — at that width there is
   * genuinely nowhere to put anything, and a bar that overflows its own box would be worse
   * than a bar whose contents wrap. */
  const holeLeft = Math.max(0, Math.min(W, pillLeft - CLEARANCE));
  const holeRight = Math.max(0, Math.min(W, pillRight + CLEARANCE));
  const hole = Math.max(0, holeRight - holeLeft);
  if (hole <= 0) return EMPTY_LANE;

  const left = holeLeft;
  const right = Math.max(0, W - holeLeft - hole);

  return {
    active: true,
    left,
    hole,
    right,
    /* `minmax(0, Npx)` on the lanes, not a bare `Npx`: a bare fixed track cannot shrink, so a
     * 1px measurement difference between the island's rect and this element's box would push
     * the row 1px wider than its container and produce a horizontal scrollbar on the whole app.
     * The minmax lets the track absorb the rounding while its MAXIMUM stays exactly the lane
     * width, which is what keeps `hole` aligned to the pill. */
    template: `minmax(0, ${left}px) ${hole}px minmax(0, ${right}px)`,
    phase: island.phase,
  };
}

/**
 * Track the pill against an element and return the lane to lay out inside.
 *
 * Returns the identity layout when the island is absent, hidden, elsewhere, or vertically
 * clear of the element — so the ONLY time a consumer's layout differs from its pre-island form
 * is when the pill would genuinely have covered something.
 */
export function useIslandLane(ref: RefObject<HTMLElement | null>): IslandLane {
  const island = useIslandFootprint();
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      try {
        const r = el.getBoundingClientRect();
        setBox((prev) =>
          prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height
            ? prev
            : { left: r.left, top: r.top, width: r.width, height: r.height },
        );
      } catch {
        /* detached mid-teardown */
      }
    };
    read();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(read);
      ro.observe(el);
    } catch {
      /* no ResizeObserver: the window resize listener below still covers a window resize, and
       * a 0-height fallback means no lane, which is safe. */
    }
    window.addEventListener('resize', read);
    return () => {
      try { ro?.disconnect(); } catch { /* already gone */ }
      window.removeEventListener('resize', read);
    };
  }, [ref]);

  return useMemo(() => computeLane(box, island), [box, island]);
}
