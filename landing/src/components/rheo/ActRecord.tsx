"use client";

import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useShouldAnimate } from "./use-motion-preference";
import {
  LINE_PATH,
  AREA_PATH,
  DERIVED_CARDS,
  SAMPLES,
  CHART_W,
  CHART_H,
  hasApp,
  hhmm,
} from "@/lib/day";
import SampleDayTimeline from "./SampleDayTimeline";

/**
 * "a day, replayable" — V1–V6 single instrument stack (GLM round 03).
 * Panes are gone. One vertically centered stack in the 300vh sticky:
 * meta row → headline → chart panel (line + area + anchor band + playhead
 * + readout) → readings index → active card (crossfade + scroll-bound
 * counter) → scroll hint. SampleDayTimeline (the category-segment
 * instrument, GLM V3: "SampleDayTimeline already owns the category-segment
 * instrument") stays mounted under the chart panel.
 *
 * Every rendered number derives from @/lib/day — no typed literals.
 * Scrub mapping (RESULT-actrecord-rhythm §1.3 + V3):
 *   active = floor((p + 0.03) * beats)   — the index leads the card at b−0.03
 *   counter lerps cards[i-1]→cards[i] inside the b±0.03 boundary zone.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const ZONE = 0.03; // boundary zone ±0.03 in scrub-progress space
const fmtInt = (n: number) => n.toLocaleString("en-US");

const RECORDED = SAMPLES.filter(hasApp).length;
const NULLS = SAMPLES.length - RECORDED;

export default function ActRecord() {
  const ref = useRef<HTMLElement>(null);
  const shouldAnimate = useShouldAnimate();
  const prm = !shouldAnimate;
  const { scrollYProgress: raw } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  // Raw scroll progress (house decision, kept from the previous cycle:
  // the spring governed itself; raw lets the house easing apply per-transform).
  const p = raw;

  // line chart draw — full-drawn in the reduced-motion static branch
  const draw: MotionValue<number> | 1 = shouldAnimate ? p : 1;

  // refs for direct DOM updates (no per-frame re-render)
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(0);

  const [active, setActive] = useState(0);

  // measured plot width → playhead translateX per frame (transform, not left)
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotW, setPlotW] = useState(0);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setPlotW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const playheadX = useTransform(p, (v) => v * plotW);

  useEffect(() => {
    const apply = () => {
      const v = p.get();
      const beats = DERIVED_CARDS.length;

      // active index leads the card: switch at b−0.03
      const idx = Math.min(
        beats - 1,
        Math.max(0, Math.floor((v + ZONE) * beats)),
      );

      // scroll-bound counter: exact minutes outside boundary zones;
      // inside, lerp cards[idx-1] → cards[idx] (direction-aware by construction)
      let minutes = DERIVED_CARDS[idx].minutes;
      if (idx > 0) {
        const bd = idx / beats;
        // epsilon: at exactly v = bd−ZONE the lerp starts (t=0, outgoing's value);
        // without it the float in (v + ZONE) can flip idx while v ≤ bd−ZONE and
        // the counter jumps cards[idx-1]→cards[idx] with no lerp (probe-caught).
        if (v > bd - ZONE - 1e-9) {
          const t = Math.min(1, Math.max(0, (v - (bd - ZONE)) / (ZONE * 2)));
          minutes = Math.round(
            DERIVED_CARDS[idx - 1].minutes +
              (DERIVED_CARDS[idx].minutes - DERIVED_CARDS[idx - 1].minutes) * t,
          );
        }
      }
      const cel = counterRefs.current[idx];
      if (cel) cel.textContent = `${minutes}`;

      // readout — the "replayable" promise made literal (V1):
      // hhmm(m) · SAMPLES[m].category ?? 'NULL'
      const m = Math.min(SAMPLES.length - 1, Math.floor(v * SAMPLES.length));
      const rel = readoutRef.current;
      if (rel) {
        const cat = SAMPLES[m]?.category;
        rel.textContent = `${hhmm(m)} · ${cat ?? "NULL"}`;
      }

      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }
    };
    apply();
    const unsub = p.on("change", apply);
    return () => unsub();
  }, [p]);

  // Jump the scrub so the requested reading is mid-beat by construction (V2).
  const jumpToReading = (i: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const beats = DERIVED_CARDS.length;
    window.scrollTo({
      top:
        window.scrollY +
        r.top +
        ((i + 0.5) / beats) * (r.height - window.innerHeight),
      behavior: prm ? "auto" : "smooth",
    });
  };

  const transition = { duration: prm ? 0 : 0.22, ease: EASE };

  return (
    <section
      id="act-record"
      ref={ref}
      className="relative surface-page"
      style={{ height: shouldAnimate ? "300vh" : "auto" }}
    >
      <div className={shouldAnimate ? "sticky top-0 overflow-hidden ar-sticky" : ""}>
        <div className="ar-sticky-inner relative mx-auto flex h-full max-w-[1280px] flex-col items-start justify-center px-5 sm:px-10 lg:px-16">
          {/* meta row — every number derived at render (V1) */}
          <div
            className="mono flex w-full items-center justify-between"
            style={{ fontSize: 11, color: "#8a8a94", letterSpacing: "0.08em" }}
          >
            <span>ACTRECORD · {fmtInt(SAMPLES.length)} MIN</span>
            <span>
              {fmtInt(RECORDED)} RECORDED · {fmtInt(NULLS)} NULL
            </span>
          </div>

          {/* headline — the fixed frame (V1 pairing) */}
          <h2
            className="display-h2 ar-h2 mt-3"
            style={{ color: "#f4f4f5", fontWeight: 500 }}
          >
            A DAY, REPLAYABLE.
          </h2>

          {/* chart panel — full container width */}
          <div
            className="w-full"
            style={{
              marginTop: 32,
              marginBottom: 16,
              borderRadius: "var(--panel-radius)",
              border: "1px solid rgba(138,138,148,0.16)",
              background: "rgba(255,255,255,0.02)",
              padding: "12px 10px",
            }}
          >
            {/* plot area */}
            <div ref={plotRef} className="ar-chart relative w-full">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                aria-hidden
                style={{ display: "block", position: "absolute", inset: 0 }}
              >
                {[40, 80, 120].map((y) => (
                  <line
                    key={y}
                    x1={0}
                    x2={CHART_W}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                  />
                ))}
                <line
                  x1={0}
                  x2={CHART_W}
                  y1={CHART_H}
                  y2={CHART_H}
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth={1}
                />
                <motion.path
                  d={AREA_PATH}
                  fill="rgba(255,255,255,0.04)"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                />
                <motion.path
                  d={LINE_PATH}
                  fill="none"
                  stroke="#f4f4f5"
                  strokeOpacity={0.9}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pathLength: draw }}
                />
              </svg>

              {/* anchor band — active card's real time range (V3: band + playhead suffice) */}
              <div
                aria-hidden
                className="anchor-band"
                style={{
                  position: "absolute",
                  inset: 0,
                  transformOrigin: "0 50%",
                  background: "rgba(255,255,255,0.04)",
                  transform: `translateX(${((DERIVED_CARDS[active]?.anchorStart ?? 0) / 1440) * 100}%) scaleX(${((DERIVED_CARDS[active]?.anchorEnd ?? 0) - (DERIVED_CARDS[active]?.anchorStart ?? 0)) / 1440})`,
                  transition: prm ? "none" : "transform 400ms cubic-bezier(0.16,1,0.3,1)",
                  pointerEvents: "none",
                }}
              />

              {/* playhead — 2px full plot height, scroll-bound, no transition (V1) */}
              <motion.div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "rgba(244,244,245,0.9)",
                  x: playheadX,
                  pointerEvents: "none",
                }}
              />

              {/* readout — sample truth at the playhead (V1) */}
              <span
                ref={readoutRef}
                className="mono"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  fontSize: 10,
                  color: "#a1a1aa",
                  letterSpacing: "0.08em",
                  pointerEvents: "none",
                }}
              >
                00:00 · NULL
              </span>
            </div>

            {/* axis */}
            <div
              className="flex w-full items-center justify-between"
              style={{ marginTop: 6 }}
            >
              {["00", "06", "12", "18", "24"].map((t) => (
                <span
                  key={t}
                  className="mono"
                  style={{ fontSize: 9, color: "#8a8a94", letterSpacing: "0.06em" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* the category-segment instrument — GLM V3 keeps it as the owner of
              minute-resolution category rects; this chart stays hourly. */}
          <div className="w-full" style={{ marginBottom: 24 }}>
            <SampleDayTimeline scrub={p} />
          </div>

          {/* readings index — derived labels, clickable, mid-beat scroll (V2) */}
          <nav
            aria-label="readings"
            className="ar-index flex w-full items-center"
            style={{ marginBottom: 24 }}
          >
            {DERIVED_CARDS.map((c, i) => (
              <div key={c.id} className="flex items-center">
                {i > 0 && (
                  <span
                    className="mono"
                    aria-hidden
                    style={{ fontSize: 11, color: "#63636b", paddingRight: 24 }}
                  >
                    ·
                  </span>
                )}
                <button
                  type="button"
                  className="mono-label instrument"
                  aria-current={active === i ? "true" : undefined}
                  onClick={() => jumpToReading(i)}
                  style={{
                    fontSize: 11,
                    color: "#f4f4f5",
                    opacity: active === i ? 1 : 0.45,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                    transition: prm ? "none" : "opacity 200ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  {c.label}
                </button>
              </div>
            ))}
          </nav>

          {/* active card — crossfade zone (V1/V3) */}
          <div className="ar-cardzone relative w-full" style={{ marginTop: 24 }}>
            <AnimatePresence initial={false}>
              {shouldAnimate ? (
                <motion.div
                  key={active}
                  className="ar-card-fade absolute inset-0"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <ActiveCard idx={active} counterRefs={counterRefs} />
                </motion.div>
              ) : (
                /* reduced-motion static branch: all four readings in flow,
                   counters at their exact minutes — nothing scroll-bound */
                <div className="flex w-full flex-col" style={{ gap: 16 }}>
                  {DERIVED_CARDS.map((c, i) => (
                    <ActiveCard
                      key={c.id}
                      idx={i}
                      staticMinutes={c.minutes}
                      counterRefs={counterRefs}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* scroll hint (V1) */}
          <p
            className="mono"
            style={{
              marginTop: 24,
              fontSize: 10,
              color: "#63636b",
              letterSpacing: "0.1em",
            }}
          >
            SCROLL · {DERIVED_CARDS.length} READINGS
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- active reading card ---------- */
function ActiveCard({
  idx,
  counterRefs,
  staticMinutes,
}: {
  idx: number;
  counterRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;
  /** reduced-motion branch: exact minutes as initial content, never scrubbed */
  staticMinutes?: number;
}) {
  const card = DERIVED_CARDS[idx] ?? DERIVED_CARDS[0];
  const isQuiet = card.id === "quiet";
  const share = Math.round(card.shareOfActive * 100);

  return (
    <div>
      {/* per-beat display line — the label is the card's headline (V1 pairing) */}
      <p
        className="display-h2 ar-label"
        style={{ color: "#f4f4f5", textTransform: "uppercase", fontWeight: 500 }}
      >
        {card.label}
      </p>

      {/* counter — the card's hero: scroll-bound integer + mono suffixes (V1/V3) */}
      <div className="flex items-baseline" style={{ gap: 10, marginTop: 6 }}>
        <span
          ref={(el) => {
            counterRefs.current[idx] = el;
          }}
          className="mono ar-counter tabular-nums"
          style={{ color: "#f4f4f5", letterSpacing: "-0.01em", lineHeight: 1 }}
        >
          {staticMinutes ?? card.minutes}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "#8a8a94" }}>
          MIN
        </span>
        {!isQuiet && (
          <span className="mono" style={{ fontSize: 11, color: "#8a8a94" }}>
            · {share}% OF RECORDED
          </span>
        )}
      </div>

      {/* anchor line — copy honesty rule: labeled range, never bare (§1.2.6) */}
      <p
        className="mono"
        style={{ fontSize: 11, color: "#8a8a94", marginTop: 10, letterSpacing: "0.08em" }}
      >
        {isQuiet
          ? `NO INPUT — ${card.anchorLabel}`
          : `LONGEST STRETCH ${card.anchorLabel} · ${card.runs} ${card.runs === 1 ? "SESSION" : "SESSIONS"}`}
      </p>
    </div>
  );
}
