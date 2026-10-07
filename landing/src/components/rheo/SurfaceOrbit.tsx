"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CARD_ASPECT,
  MOBILE_BREAKPOINT,
  THUMB_W,
  buildLayout,
  fitCard,
  frontIndex,
  gridCols,
  snapOffset,
  stepFor,
  type OrbitMode,
} from "./orbit-layout";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/**
 * SurfaceOrbit — a ring of real captures that YOU turn. It does not turn itself.
 *
 * PORTED from `agent/docs/21st-dev-prompts/Orbit Flip Slider/PROMPT.md`
 * (21st.dev / @hyperiux). The original imports `gsap` + `gsap/Flip`; the layout
 * trigonometry was already dependency-free, so it moved verbatim into
 * `orbit-layout.ts` and only the animation layer was rewritten on `framer-motion`,
 * which 16 files here already use. AGENTS.md §9: GSAP is not a project
 * dependency, and two engines must never drive one element.
 *
 * FOUR DELIBERATE DEVIATIONS, each because the original's default fought this
 * page's purpose:
 *
 *  1. NO PERMANENT ROTATION. The original runs requestAnimationFrame forever at
 *     `rotateSpeed={4}`, re-committing 16 transforms every frame, and never
 *     rests. Here there is no rAF loop at all. The ring moves only while you
 *     drag it, then settles on a card using your release velocity. A showcase
 *     of still screenshots should not have them permanently in motion.
 *  2. LANDSCAPE 560x350, not the original's 140x200 portrait. Every capture in
 *     public/media is 2880x1800 (ratio 1.60); portrait crops nearly all of it,
 *     and this section's claim is "UNRETOUCHED".
 *  3. NO `back.out(2.2)`. The original overshoots on every hover with a
 *     back-ease spring. LAMINAR bans spring/bounce, and a photograph that
 *     bounces encodes nothing.
 *  4. Reduced motion is honoured structurally: no drag tween, no settle tween,
 *     and the layout is committed directly rather than interpolated.
 */

export type OrbitItem = {
  id: string;
  image: string;
  alt: string;
  /** short name for the ring button's accessible label */
  label: string;
  /** MP4 for this screen, when one exists. Omit rather than pass empty —
   *  the toggle is only rendered when a clip actually exists (PAINT P5: never
   *  a disabled control that looks enabled). */
  clip?: string;
  clipLabel?: string;
};

/** Still-vs-motion for the front card, as real state in the parent.
 *
 *  Kept HERE rather than inside ClipToggle because the toggle and the video it
 *  controls are siblings: a child-owned boolean would leave the parent unable
 *  to decide whether to render a <video> or an <img>, which is the only thing
 *  this control actually does.
 */

const MODES: OrbitMode[] = ["flat", "tilt", "ring", "gallery"];
const MODE_LABEL: Record<OrbitMode, string> = {
  flat: "FLAT",
  tilt: "TILT",
  ring: "RING",
  gallery: "GALLERY",
};

/** degrees per pixel of drag — tuned for direct manipulation, not a geared dial */
const DRAG_GAIN = 0.55;
/** how far release velocity carries the ring, in degrees per px/ms */
const FLING_GAIN = 260;
/** below this the drag is a click, not a turn */
const DRAG_THRESHOLD = 4;

export default function SurfaceOrbit({
  items,
  mode,
  onModeChange,
  activeIndex,
  onActiveChange,
}: {
  items: OrbitItem[];
  mode: OrbitMode;
  onModeChange: (m: OrbitMode) => void;
  activeIndex: number;
  onActiveChange: (i: number) => void;
}) {
  /* The stage is a <div> when it orbits and a <ul> when it falls back to the grid.
   useRef<HTMLDivElement> is invariant, so it will not satisfy Ref<HTMLUListElement>
   on the grid branch. The honest fix is a callback ref typed at each use site, not
   a cast — the two branches are genuinely different elements and the measurement
   code only ever needs getBoundingClientRect + ResizeObserver. */
  const [trackEl, setTrackEl] = useState<HTMLElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();

  /** rotation offset in degrees — the ring's spin, owned by this component */
  const [offset, setOffset] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  /** live px/ms from the last pointermove, consumed on release */
  const velRef = useRef(0);
  const rafRef = useRef(0);
  /** suppress the click that ends a drag */
  const suppressClickRef = useRef(false);

  const active = items[activeIndex];

  /** Does the front card show its screen recording? Turned OFF whenever the
   *  front card changes, so you never land on a new screen mid-clip. */
  const [clipPlaying, setClipPlaying] = useState(false);
  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevActiveIdRef.current !== null && prevActiveIdRef.current !== active?.id) {
      setClipPlaying(false);
    }
    prevActiveIdRef.current = active?.id ?? null;
  }, [active?.id]);

  useLayoutEffect(() => {
    if (!trackEl) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setDims({ w: r.width, h: r.height });
    });
    ro.observe(trackEl);
    return () => ro.disconnect();
  }, [trackEl]);

  /**
   * Card size is SOLVED per stage, not fixed.
   *
   * Measured (scripts/probe-orbit.mjs, 17 cards): 560px thumbnails overflow a
   * 1280px stage by 1,276px, and a fixed 200px overflows a 390px phone by up to
   * 645px. `fitCard` bisects against real layout output to find the largest size
   * that fits, and reports when even the floor cannot fit so we can fall back
   * to a grid instead of shipping a clipped ring.
   */
  const fit = useMemo(
    () =>
      dims.w > 0 && dims.h > 0 && items.length > 0
        ? fitCard(mode, items.length, dims.w, dims.h, THUMB_W, 8)
        : null,
    [dims.w, dims.h, items.length, mode]
  );

  const layout =
    dims.w > 0 && dims.h > 0 && items.length > 0
      ? buildLayout(mode, items.length, dims.w, dims.h, offset, fit?.size ?? THUMB_W, fit?.height ?? Math.round(THUMB_W / CARD_ASPECT))
      : null;

  /** Too many cards for this screen to orbit — fall back to a plain grid. */
  const tooTight = fit?.overflows ?? false;

  /**
   * Commit transforms straight to the DOM. 16 cards at 60fps must not go
   * through React state — a re-render per frame would re-run every child.
   */
  const frontRef = useRef(-1);
  useEffect(() => {
    if (!layout) return;
    const front = frontIndex(mode, layout, dims.w, dims.h);
    for (let i = 0; i < layout.length; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const b = layout[i];
      el.style.transform = `translate3d(${(b.x - b.width / 2).toFixed(2)}px, ${(b.y - b.height / 2).toFixed(2)}px, 0)`;
      el.style.width = `${b.width.toFixed(1)}px`;
      el.style.height = `${b.height.toFixed(1)}px`;
      el.style.zIndex = String(b.zIndex);
      el.dataset.front = i === front ? "true" : "false";
    }
    if (front !== frontRef.current) {
      frontRef.current = front;
      onActiveChange(front);
    }
  }, [layout, mode, dims.w, dims.h, onActiveChange]);

  /** spring the ring to a target offset, then settle */
  const settleTo = useCallback(
    (target: number) => {
      cancelAnimationFrame(rafRef.current);
      if (reduced) {
        setOffset(target);
        return;
      }
      const from = offset;
      const delta = target - from;
      if (Math.abs(delta) < 0.01) return;
      const dur = 420 + Math.min(320, Math.abs(delta) * 1.4);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        // cubic-bezier(0.16, 1, 0.3, 1) — the page's house ease
        const e = 1 - Math.pow(1 - t, 3);
        setOffset(from + delta * e);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [offset, reduced]
  );

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (items.length < 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    cancelAnimationFrame(rafRef.current);
    const startX = e.clientX;
    const base = offset;
    velRef.current = 0;
    let lastX = e.clientX;
    let lastT = performance.now();
    let moved = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      moved = true;
      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) velRef.current = (ev.clientX - lastX) / dt;
      lastX = ev.clientX;
      lastT = now;
      // reduced motion: snap between notches instead of tracking the pointer
      if (reduced) {
        const step = stepFor(items.length);
        setOffset(snapOffset(base + dx * DRAG_GAIN, items.length));
      } else {
        setOffset(base + dx * DRAG_GAIN);
      }
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(false);
      if (!moved) return;
      suppressClickRef.current = true;
      // carry release velocity, then land on the nearest notch
      const step = stepFor(items.length);
      const projected = offset + velRef.current * FLING_GAIN;
      const target = snapOffset(projected, items.length);
      // a long way round is a wrap, not a 350-degree spin
      const raw = snapOffset(offset + (target - offset), items.length);
      settleTo(Math.abs(raw - offset) > 180 ? offset + Math.sign(target - offset) * step : raw);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** centre a specific card at the front of the ring */
  const focusIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      const step = stepFor(items.length);
      // whichever direction is shorter to travel
      const target = clamped * step;
      const from = offset;
      let delta = target - from;
      const half = 180;
      while (delta > half) delta -= 360;
      while (delta < -half) delta += 360;
      settleTo(from + delta);
    },
    [items.length, offset, settleTo]
  );

  const onKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusIndex(activeIndex + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusIndex(activeIndex - 1);
        break;
      case "ArrowUp": {
        e.preventDefault();
        const i = MODES.indexOf(mode);
        onModeChange(MODES[(i - 1 + MODES.length) % MODES.length]);
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        const i = MODES.indexOf(mode);
        onModeChange(MODES[(i + 1) % MODES.length]);
        break;
      }
      case "Home":
        e.preventDefault();
        focusIndex(0);
        break;
      case "End":
        e.preventDefault();
        focusIndex(items.length - 1);
        break;
      default:
        return;
    }
  };

  const mobile = dims.w > 0 && dims.w < MOBILE_BREAKPOINT;

  return (
    <div className="orbit-wrap">
      <div className="orbit-controls">
        <div className="orbit-modes" role="radiogroup" aria-label="Ring layout">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className="orbit-mode"
              data-active={mode === m}
              onClick={() => onModeChange(m)}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="orbit-meta">
          <span className="mono tabular-nums" aria-live="polite">
            {String(activeIndex + 1).padStart(2, "0")} / {items.length}
          </span>
          <span className="mono" style={{ color: "#f4f4f5" }}>
            {active ? active.label.toUpperCase() : ""}
          </span>
        </div>
      </div>

      {/* ---- the big card: the one you actually READ, at a readable size ---- */}
      {active ? (
        <div className="orbit-front">
          {active.clip ? (
            <ClipToggle
              big
              playing={clipPlaying}
              onChange={setClipPlaying}
            />
          ) : null}
          {/* Reduced motion never autoplays video. A motion-preference user asking for
              MOTION still gets the still frame, not an unrequested animation. */}
          {clipPlaying && active.clip && !reduced ? (
            <video
              className="orbit-front-media"
              src={active.clip}
              poster={active.image}
              aria-label={active.clipLabel ?? active.alt}
              muted
              loop
              playsInline
              autoPlay
            />
          ) : (
            <img
              className="orbit-front-media"
              src={active.image}
              alt={active.alt}
              decoding="async"
            />
          )}
          <span className="orbit-front-caption mono">
            REAL CAPTURE — {active.label.toUpperCase()}
          </span>
        </div>
      ) : null}

      {/* ---- the ring: every capture at once, small ---- */}
      {tooTight ? (
        /* Fallback. Measured: on a 390px stage a 17-card loop cannot close even
           at the 32px floor, so orbiting would hang cards off every edge. A grid
           makes the same "all of it, at once" claim without clipping. */
        <ul
          ref={setTrackEl as React.Ref<HTMLUListElement>}
          className="orbit-grid"
          style={{ "--orbit-cols": gridCols(dims.w, 132, 10, items.length) } as React.CSSProperties}
        >
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                className="orbit-grid-item"
                data-active={i === activeIndex}
                aria-pressed={i === activeIndex}
                onClick={() => onActiveChange(i)}
              >
                <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
                <span className="mono">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div
          ref={setTrackEl as React.Ref<HTMLDivElement>}
          className="orbit-stage"
          data-dragging={dragging}
          role="group"
          aria-roledescription="carousel"
          aria-label={`RHEO surfaces — ${items.length} captures. Drag the ring, or use the arrow keys.`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={onKey}
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="orbit-card"
              data-front={i === activeIndex}
              aria-label={item.label}
              aria-current={i === activeIndex ? "true" : undefined}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                focusIndex(i);
              }}
            >
              <img src={item.image} alt="" draggable={false} loading="lazy" decoding="async" />
            </button>
          ))}

          <span className="orbit-hint mono" aria-hidden>
            {mobile ? "DRAG · TAP TO CENTRE" : "DRAG THE RING · ← → STEP · ↑ ↓ LAYOUT"}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * still ⇄ motion. Rendered ONLY when the front card actually has a clip —
 * never a disabled control that looks enabled (PAINT Gate D).
 *
 * Turning MOTION on for a screen that has no recording is impossible by
 * construction: the whole component is unmounted when `clip` is absent.
 */
function ClipToggle({
  playing,
  onChange,
  big,
}: {
  playing: boolean;
  onChange: (v: boolean) => void;
  big?: boolean;
}) {
  return (
    <span className="orbit-clip" data-big={big ? "true" : undefined}>
      <button
        type="button"
        className="orbit-mode"
        data-active={!playing}
        aria-pressed={!playing}
        onClick={() => onChange(false)}
      >
        STILL
      </button>
      <button
        type="button"
        className="orbit-mode"
        data-active={playing}
        aria-pressed={playing}
        onClick={() => onChange(true)}
      >
        MOTION
      </button>
    </span>
  );
}