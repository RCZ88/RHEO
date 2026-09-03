"use client";

import {
  AnimatePresence,
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Phase = {
  key: string;
  range: string;
  startH: number;
  endH: number; // may exceed 24 for wrap (REST)
  total: number; // minutes
  blurb: string;
};

const PHASES: Phase[] = [
  {
    key: "REST",
    range: "23–06",
    startH: 23,
    endH: 30, // wraps past 24 → 06
    total: 420,
    blurb: "Recovery is a phase, not a gap. RHEO guards it.",
  },
  {
    key: "DEEP WORK",
    range: "09–12",
    startH: 9,
    endH: 12,
    total: 180,
    blurb: "Unbroken focus. The record marks its depth, not just its length.",
  },
  {
    key: "MEETINGS",
    range: "12–14",
    startH: 12,
    endH: 14,
    total: 120,
    blurb: "Context switches, logged. Later you see what they cost.",
  },
  {
    key: "LEARNING",
    range: "19–21",
    startH: 19,
    endH: 21,
    total: 120,
    blurb: "Study compounds. The timeline remembers every session.",
  },
];

function activeIndexFromHour(h: number): number {
  if (h >= 9 && h < 12) return 1; // DEEP WORK
  if (h >= 12 && h < 14) return 2; // MEETINGS
  if (h >= 19 && h < 21) return 3; // LEARNING
  if (h >= 23 || h < 6) return 0; // REST
  return -1; // between
}

function fmtHM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function ActRecord() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress: raw } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const p = useSpring(raw, { stiffness: 120, damping: 25 });

  // playhead top on vertical timeline (0%..100%)
  const playheadTop = useTransform(p, [0, 1], ["0%", "100%"]);
  // mini timeline fill width
  const miniFill = useTransform(p, [0, 1], ["0%", "100%"]);
  // line chart path draw
  const pathLength = p;

  // refs for direct DOM text updates (no per-frame re-render)
  const hhmmRef = useRef<HTMLSpanElement>(null);
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const activeRef = useRef(0);

  const [active, setActive] = useState(1); // start in DEEP WORK mid-scrub? default -1

  useEffect(() => {
    const unsub = p.on("change", (v) => {
      const hour = v * 24;
      const hh = Math.floor(hour);
      const mm = Math.floor((hour - hh) * 60);
      if (hhmmRef.current) {
        hhmmRef.current.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }
      // update each phase counter = round(p * total)
      PHASES.forEach((ph, i) => {
        const el = counterRefs.current[i];
        if (el) {
          const val = Math.round(v * ph.total);
          el.textContent = fmtHM(val);
        }
      });
      const idx = activeIndexFromHour(hour);
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }
    });
    return () => unsub();
  }, [p]);

  // Reduced-motion: render a clean static stacked panel instead of the
  // 300vh scrub experience. All the same content, no scroll-binding.
  if (reduced) {
    return (
      <section id="act-record" className="relative surface-page py-20 sm:py-28">
        <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
          <div className="max-w-[560px] mb-10">
            <p className="mono-label" style={{ fontSize: 11 }}>
              SECTION 02 / RECORD
            </p>
            <h2 className="display-h2 mt-3">A DAY, REPLAYABLE.</h2>
            <p
              className="mt-4"
              style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}
            >
              This page is scrubbed, not played. Drag time backward. In life you
              can&apos;t. Here, you can.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_0.9fr] gap-6 items-start">
            {/* phase list */}
            <div className="flex flex-col gap-4">
              {PHASES.map((ph) => (
                <div
                  key={ph.key}
                  className="surface-panel"
                  style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 16 }}
                >
                  <p className="mono-label-strong" style={{ fontSize: 11, color: "#f4f4f5" }}>
                    {ph.key}
                  </p>
                  <p className="mono" style={{ fontSize: 10, color: "#63636b", marginTop: 3, letterSpacing: "0.08em" }}>
                    {ph.range}
                  </p>
                  <p style={{ fontSize: 14, lineHeight: 1.55, color: "#a1a1aa", marginTop: 8 }}>
                    {ph.blurb}
                  </p>
                  <p className="mono tabular-nums" style={{ fontSize: 13, color: "#ffffff", marginTop: 8 }}>
                    {fmtHM(ph.total)}
                  </p>
                </div>
              ))}
            </div>
            {/* static dashboard card */}
            <div
              className="surface-panel sheen-top"
              style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18 }}
            >
              <p className="mono" style={{ fontSize: 11, color: "#a1a1aa", letterSpacing: "0.08em", marginBottom: 12 }}>
                ● RHEO · TODAY · 12:00
              </p>
              <svg viewBox="0 0 400 160" width="100%" height="140" preserveAspectRatio="none" style={{ display: "block", marginBottom: 12 }} aria-hidden>
                {[40, 80, 120].map((y) => (
                  <line key={y} x1={0} x2={400} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                ))}
                <line x1={0} x2={400} y1={140} y2={140} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                <path d={AREA_PATH} fill="rgba(255,255,255,0.06)" />
                <path d={LINE_PATH} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex" style={{ gap: 4, height: 22, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden", background: "#050506", padding: "0 4px", alignItems: "center", justifyContent: "space-between" }}>
                {["00", "06", "12", "18", "24"].map((t) => (
                  <span key={t} className="mono" style={{ fontSize: 8, color: "#63636b" }}>{t}</span>
                ))}
              </div>
            </div>
            {/* timeline summary */}
            <div
              className="surface-panel"
              style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18 }}
            >
              <p className="mono-label" style={{ fontSize: 10, marginBottom: 12 }}>
                24H TIMELINE
              </p>
              <div className="flex flex-col gap-1.5">
                {PHASES.map((ph) => (
                  <div key={ph.key} className="flex items-center justify-between">
                    <span className="mono" style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.06em" }}>{ph.key}</span>
                    <span className="mono tabular-nums" style={{ fontSize: 10, color: "#63636b" }}>{ph.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="act-record"
      ref={ref}
      className="relative surface-page"
      style={{ height: reduced ? "auto" : "300vh" }}
    >
      {/* sticky inner viewport (or static under reduced-motion) */}
      <div
        className={reduced ? "relative" : "sticky top-0 overflow-hidden"}
        style={{ height: reduced ? "auto" : "100dvh" }}
      >
        <div className="relative h-full max-w-[1280px] mx-auto px-5 sm:px-10 lg:px-16 pt-20 pb-20">
          {/* top-left header */}
          <div className="absolute top-16 left-5 sm:left-10 lg:left-16 max-w-[420px]">
            <p className="mono-label" style={{ fontSize: 11 }}>
              SECTION 02 / RECORD
            </p>
            <h2 className="display-h2 mt-3">A DAY, REPLAYABLE.</h2>
            <p
              className="mt-4"
              style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", maxWidth: 340 }}
            >
              This page is scrubbed, not played. Drag time backward. In life you
              can&apos;t. Here, you can.
            </p>
          </div>

          {/* LEFT: per-phase text block (crossfade) */}
          <div
            className="absolute left-5 sm:left-10 lg:left-16"
            style={{ top: "44%", transform: "translateY(-50%)", maxWidth: 300 }}
          >
            <div className="relative" style={{ minHeight: 150 }}>
              <AnimatePresence mode="wait">
                {active >= 0 ? (
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p
                      className="mono-label-strong"
                      style={{ fontSize: 11, color: "#f4f4f5" }}
                    >
                      {PHASES[active].key}
                    </p>
                    <p
                      className="mono"
                      style={{ fontSize: 11, color: "#63636b", marginTop: 4 }}
                    >
                      {PHASES[active].range} · phase {active + 1}/4
                    </p>
                    <p
                      style={{
                        fontSize: 16,
                        lineHeight: 1.5,
                        color: "#f4f4f5",
                        marginTop: 12,
                      }}
                    >
                      {PHASES[active].blurb}
                    </p>
                    <div
                      className="mt-5 flex items-baseline gap-2"
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        paddingTop: 12,
                      }}
                    >
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: "#63636b" }}
                      >
                        recorded
                      </span>
                      <span
                        ref={(el) => {
                          counterRefs.current[active] = el;
                        }}
                        className="mono tabular-nums"
                        style={{ fontSize: 22, color: "#ffffff", letterSpacing: "-0.01em" }}
                      >
                        0h 00m
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="transition"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p
                      className="mono-label"
                      style={{ fontSize: 11, color: "#63636b" }}
                    >
                      BETWEEN PHASES
                    </p>
                    <p
                      style={{
                        fontSize: 16,
                        lineHeight: 1.5,
                        color: "#63636b",
                        marginTop: 12,
                      }}
                    >
                      Time between commitments — transitions, drift, the gaps
                      that hold a day together.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* all-phase counters list */}
            <div
              className="mt-8 hairline-t"
              style={{ borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 12 }}
            >
              {PHASES.map((ph, i) => (
                <div
                  key={ph.key}
                  className="flex items-center justify-between"
                  style={{ padding: "6px 0" }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: active === i ? "#f4f4f5" : "#63636b",
                      letterSpacing: "0.08em",
                      transition: "color 0.25s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    {ph.key}
                  </span>
                  <span
                    ref={(el) => {
                      counterRefs.current[i] = el;
                    }}
                    className="mono tabular-nums"
                    style={{
                      fontSize: 11,
                      color: active === i ? "#f4f4f5" : "#63636b",
                      transition: "color 0.25s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    0h 00m
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER: mock RHEO dashboard card */}
          <div
            className="absolute"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(440px, 80vw)",
            }}
          >
            <DashboardCard
              pathLength={pathLength}
              miniFill={miniFill}
              active={active}
            />
          </div>

          {/* RIGHT: vertical 24h timeline */}
          <div
            className="absolute right-4 lg:right-10"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: "min(62vh, 540px)",
              width: 96,
            }}
          >
            <TimelineTrack
              playheadTop={playheadTop}
              hhmmRef={hhmmRef}
            />
          </div>

          {/* progress scrub hint */}
          <div
            className="absolute bottom-6 left-5 sm:left-10 lg:left-16 right-5 sm:right-10 lg:right-16 flex items-center justify-between"
          >
            <span className="mono-label" style={{ fontSize: 10 }}>
              ← scrub time
            </span>
            <ScrubbyProgress p={p} />
            <span className="mono-label" style={{ fontSize: 10 }}>
              replay →
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Dashboard card ---------- */
function DashboardCard({
  pathLength,
  miniFill,
  active,
}: {
  pathLength: MotionValue<number>;
  miniFill: MotionValue<string>;
  active: number;
}) {
  const CHIPS = ["FOCUS", "MEETINGS", "LEARNING", "REST"];
  const chipIndex = active < 0 ? -1 : active;

  // leading-edge dot position, derived from path progress (pure function of p)
  const dotCx = useTransform(pathLength, (v) => 8 + v * 384);
  const dotCy = useTransform(pathLength, (v) => pointY(v));

  return (
    <div
      className="sheen-top surface-panel"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 18,
      }}
    >
      {/* header row */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#ffffff",
              display: "inline-block",
            }}
          />
          <span className="mono" style={{ fontSize: 11, color: "#a1a1aa", letterSpacing: "0.08em" }}>
            RHEO · TODAY
          </span>
        </div>
        <span className="mono-label" style={{ fontSize: 10 }}>
          live
        </span>
      </div>

      {/* SVG line chart */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          background: "#050506",
          padding: 10,
          marginBottom: 12,
        }}
      >
        <svg
          viewBox="0 0 400 160"
          width="100%"
          height="120"
          preserveAspectRatio="none"
          aria-hidden
          style={{ display: "block" }}
        >
          {/* gridlines */}
          {[40, 80, 120].map((y) => (
            <line
              key={y}
              x1={0}
              x2={400}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}
          {/* baseline */}
          <line
            x1={0}
            x2={400}
            y1={140}
            y2={140}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={1}
          />
          {/* area fill */}
          <motion.path
            d={AREA_PATH}
            fill="rgba(255,255,255,0.06)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          />
          {/* main line — drawn by scroll progress */}
          <motion.path
            d={LINE_PATH}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pathLength }}
          />
          {/* playhead dot at the line's leading edge — moves with p */}
          <motion.circle
            r={3}
            fill="#ffffff"
            style={{ cx: dotCx, cy: dotCy }}
          />
        </svg>
      </div>

      {/* stat chips */}
      <div className="grid grid-cols-4 gap-2" style={{ marginBottom: 12 }}>
        {CHIPS.map((c, i) => {
          const isActive = chipIndex === i;
          return (
            <div
              key={c}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "8px 6px",
                background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                transition:
                  "background 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s cubic-bezier(0.16,1,0.3,1)",
                borderColor: isActive
                  ? "rgba(255,255,255,0.16)"
                  : "rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: isActive ? "#f4f4f5" : "#63636b",
                  letterSpacing: "0.1em",
                  transition: "color 0.25s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                {c}
              </div>
              <div
                className="mono tabular-nums"
                style={{
                  fontSize: 13,
                  color: isActive ? "#ffffff" : "#a1a1aa",
                  marginTop: 4,
                  transition: "color 0.25s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                {chipIndex === i ? "▶" : ""}
                {chipIndex === i ? " now" : " ·"}
              </div>
            </div>
          );
        })}
      </div>

      {/* segmented mini timeline bar */}
      <div
        style={{
          position: "relative",
          height: 22,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          overflow: "hidden",
          background: "#050506",
        }}
      >
        {/* phase segments as hairline blocks */}
        <MiniTimelineSegments />
        {/* progress fill overlay */}
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: miniFill,
            background: "rgba(255,255,255,0.14)",
          }}
        />
        {/* hour ticks */}
        <div className="flex justify-between absolute inset-0 px-1 items-center pointer-events-none">
          {["00", "06", "12", "18", "24"].map((t) => (
            <span
              key={t}
              className="mono"
              style={{ fontSize: 8, color: "#63636b", letterSpacing: "0.06em" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* line chart path: a day-shaped flow curve (focus peaks ~midday) */
const LINE_PATH =
  "M 8 120 C 40 110, 70 60, 110 50 C 150 40, 180 70, 210 95 C 240 120, 270 130, 300 110 C 330 95, 360 70, 392 55";
const AREA_PATH =
  "M 8 120 C 40 110, 70 60, 110 50 C 150 40, 180 70, 210 95 C 240 120, 270 130, 300 110 C 330 95, 360 70, 392 55 L 392 140 L 8 140 Z";

// approximate y on the path for leading dot (t in 0..1)
function pointY(t: number): number {
  // sample the same cubic-ish curve via simple interpolation between known knots
  const knots: [number, number][] = [
    [0, 120],
    [0.27, 50],
    [0.52, 95],
    [0.75, 110],
    [1, 55],
  ];
  // find segment
  for (let i = 0; i < knots.length - 1; i++) {
    const [t0, y0] = knots[i];
    const [t1, y1] = knots[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0);
      const s = k * k * (3 - 2 * k); // smoothstep
      return y0 + (y1 - y0) * s;
    }
  }
  return 55;
}

function MiniTimelineSegments() {
  // phases on 0..24 → 0..100% of bar
  const segs = [
    { h0: 0, h1: 6, key: "REST" },
    { h0: 9, h1: 12, key: "DEEP WORK" },
    { h0: 12, h1: 14, key: "MEETINGS" },
    { h0: 19, h1: 21, key: "LEARNING" },
    { h0: 23, h1: 24, key: "REST" },
  ];
  return (
    <>
      {segs.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(s.h0 / 24) * 100}%`,
            width: `${((s.h1 - s.h0) / 24) * 100}%`,
            top: 0,
            bottom: 0,
            borderRight: "1px solid rgba(255,255,255,0.16)",
          }}
        />
      ))}
    </>
  );
}

/* ---------- Vertical 24h timeline track ---------- */
function TimelineTrack({
  playheadTop,
  hhmmRef,
}: {
  playheadTop: MotionValue<string>;
  hhmmRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const segments = [
    { h0: 0, h1: 6, key: "REST" },
    { h0: 9, h1: 12, key: "DEEP WORK" },
    { h0: 12, h1: 14, key: "MEETINGS" },
    { h0: 19, h1: 21, key: "LEARNING" },
    { h0: 23, h1: 24, key: "REST" },
  ];
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
      }}
    >
      {/* main vertical hairline */}
      <div
        style={{
          position: "absolute",
          left: 24,
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(255,255,255,0.08)",
        }}
      />
      {/* hour ticks */}
      {Array.from({ length: 25 }, (_, i) => i).map((t) => {
        const isLabel = [0, 6, 12, 18, 24].includes(t);
        return (
          <div
            key={t}
            style={{
              position: "absolute",
              left: isLabel ? 8 : 18,
              top: `${(t / 24) * 100}%`,
              width: isLabel ? 16 : 6,
              height: 1,
              background: isLabel
                ? "rgba(255,255,255,0.16)"
                : "rgba(255,255,255,0.08)",
              transform: "translateY(-0.5px)",
            }}
          />
        );
      })}
      {/* hour labels */}
      {[0, 6, 12, 18, 24].map((t) => (
        <span
          key={t}
          className="mono"
          style={{
            position: "absolute",
            left: 0,
            top: `${(t / 24) * 100}%`,
            transform: "translateY(-50%)",
            fontSize: 10,
            color: "#63636b",
            letterSpacing: "0.08em",
          }}
        >
          {String(t).padStart(2, "0")}
        </span>
      ))}

      {/* phase segment blocks (labeled) */}
      {segments.map((s, i) => {
        const top = (s.h0 / 24) * 100;
        const height = ((s.h1 - s.h0) / 24) * 100;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 30,
              top: `${top}%`,
              height: `${height}%`,
              width: 50,
              borderLeft: "1px solid rgba(255,255,255,0.16)",
              paddingLeft: 6,
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 9,
                color: "#63636b",
                letterSpacing: "0.1em",
                writingMode: "horizontal-tb",
              }}
            >
              {s.key}
            </span>
          </div>
        );
      })}

      {/* playhead dot */}
      <motion.div
        style={{
          position: "absolute",
          left: 18,
          top: playheadTop,
          transform: "translateY(-50%)",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 0 0 3px #050506",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            padding: "2px 6px",
            background: "#0a0a0c",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 4,
            whiteSpace: "nowrap",
          }}
        >
          <span
            ref={hhmmRef}
            className="mono tabular-nums"
            style={{ fontSize: 10, color: "#f4f4f5", letterSpacing: "0.06em" }}
          >
            00:00
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- small scrubby progress pill ---------- */
function ScrubbyProgress({ p }: { p: MotionValue<number> }) {
  const width = useTransform(p, [0, 1], ["0%", "100%"]);
  return (
    <div
      style={{
        position: "relative",
        width: "min(280px, 40vw)",
        height: 2,
        background: "rgba(255,255,255,0.08)",
        margin: "0 12px",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width,
          background: "#ffffff",
        }}
      />
    </div>
  );
}
