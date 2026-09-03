"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Interactive "Design your day" demo.
 * Users drag phase boundaries on a 24h bar; the timeline, phase stats,
 * and a generated insight redraw live as a pure function of the boundaries.
 *
 * State: an array of boundary hours (0..24). 4 phases → 5 boundaries fixed at
 * 0 and 24, with 3 draggable interior handles (start defaults: 6, 12, 19).
 */
type Phase = {
  key: string;
  from: number; // hour 0..24
  to: number;
};

const DEFAULTS = [0, 6, 12, 19, 24];
const LABELS = ["REST", "FOCUS", "MEETINGS", "LEARNING", "REST"];
const INTENSITY = [0.35, 0.95, 0.55, 0.78, 0.35];

export default function DesignYourDay() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px", once: true });
  const [bounds, setBounds] = useState<number[]>(DEFAULTS);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // On mount: read phase boundaries from URL hash (#d=6,12,19) if present
  useEffect(() => {
    const m = window.location.hash.match(/#d=([\d.,]+)/);
    if (m) {
      const parsed = m[1].split(",").map(Number);
      if (parsed.length === 3 && parsed.every((n) => !isNaN(n) && n >= 1 && n <= 23)) {
        // rebuild full bounds array with constraints
        const [a, b, c] = parsed;
        if (a < b && b < c) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBounds([0, a, b, c, 24]);
        }
      }
    }
  }, []);

  // On bounds change: update URL hash (debounced via rAF-free direct set; cheap)
  useEffect(() => {
    const interior = bounds.slice(1, -1); // [6, 12, 19]
    const hash = `#d=${interior.join(",")}`;
    if (window.location.hash !== hash && !dragIdx) {
      // only update hash when not actively dragging (avoid history spam)
      window.history.replaceState(null, "", hash);
    }
  }, [bounds, dragIdx]);

  const phases: Phase[] = bounds
    .slice(0, -1)
    .map((b, i) => ({ key: LABELS[i], from: b, to: bounds[i + 1] }));

  const totalFocus = phases
    .filter((p) => p.key === "FOCUS")
    .reduce((s, p) => s + (p.to - p.from), 0);

  // drag handlers (pointer-based for touch + mouse)
  const onPointerDown = useCallback(
    (e: React.PointerEvent, idx: number) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setDragIdx(idx);
    },
    []
  );

  const trackRef = useRef<HTMLDivElement>(null);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragIdx === null || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const hour = Math.max(0, Math.min(24, x * 24));
      // snap to 0.25h (15min)
      const snapped = Math.round(hour * 4) / 4;
      setBounds((prev) => {
        const next = [...prev];
        // constrain: must stay between neighbors (min 1h gap)
        const minGap = 1;
        const lo = prev[dragIdx - 1] + minGap;
        const hi = prev[dragIdx + 1] - minGap;
        next[dragIdx] = Math.max(lo, Math.min(hi, snapped));
        return next;
      });
    },
    [dragIdx]
  );

  const onPointerUp = useCallback(() => setDragIdx(null), []);

  useEffect(() => {
    if (dragIdx === null) return;
    const up = () => setDragIdx(null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [dragIdx]);

  // generated insight text — pure function of bounds
  const insight =
    totalFocus >= 5
      ? `A ${fmtH(totalFocus)} focus block is elite territory — guard it like a meeting with yourself.`
      : totalFocus >= 3
      ? `${fmtH(totalFocus)} of deep work is a solid, repeatable day. Protect the start time.`
      : `${fmtH(totalFocus)} of focus is a fragmented day. Batch one uninterrupted block before noon.`;

  return (
    <section ref={ref} id="design" className="relative surface-page py-24 sm:py-32">
      <div className="px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto">
        <div className="mb-10 sm:mb-14 max-w-[680px]">
          <p className="mono-label kicker-rise" style={{ fontSize: 11 }}>
            INTERACTIVE · DESIGN YOUR DAY
          </p>
          <h2 className="display-h2 mt-3 kicker-rise">
            Drag the day into shape.
          </h2>
          <p
            className="mt-5"
            style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}
          >
            RHEO lets you define the phases of your day — then watches how
            reality lines up. Grab a handle below and feel how the record
            rewrites itself as you redraw it.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="surface-panel sheen-top"
          style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 22 }}
        >
          {/* the track */}
          <div className="flex items-baseline justify-between" style={{ marginBottom: 14 }}>
            <p className="mono-label" style={{ fontSize: 10 }}>
              24H PHASE BAR · DRAG HANDLES
            </p>
            <span className="mono" style={{ fontSize: 10, color: "#63636b", letterSpacing: "0.08em" }}>
              snaps to 15min
            </span>
          </div>

          <div
            ref={trackRef}
            className="relative select-none"
            style={{
              height: 46,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              background: "#050506",
              overflow: "visible",
              touchAction: "none",
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* phase fills */}
            {phases.map((p, i) => {
              const left = (p.from / 24) * 100;
              const width = ((p.to - p.from) / 24) * 100;
              const active = INTENSITY[i];
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    width: `${width}%`,
                    top: 0,
                    bottom: 0,
                    background: `rgba(255,255,255,${active * 0.22})`,
                    borderRight: "1px solid rgba(255,255,255,0.16)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      position: "absolute",
                      left: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 9,
                      color: active > 0.6 ? "#f4f4f5" : "#a1a1aa",
                      letterSpacing: "0.1em",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    {p.key}
                  </span>
                </div>
              );
            })}

            {/* draggable handles (interior boundaries only) */}
            {bounds.map((b, i) => {
              if (i === 0 || i === bounds.length - 1) return null;
              return (
                <div
                  key={i}
                  className={`phase-handle ${dragIdx === i ? "dragging" : ""}`}
                  style={{ left: `${(b / 24) * 100}%` }}
                  onPointerDown={(e) => onPointerDown(e, i)}
                  role="slider"
                  aria-label={`Phase boundary ${i}`}
                  aria-valuemin={bounds[i - 1] + 1}
                  aria-valuemax={bounds[i + 1] - 1}
                  aria-valuenow={Math.round(b * 100) / 100}
                  tabIndex={0}
                />
              );
            })}
          </div>

          {/* hour ticks */}
          <div className="relative" style={{ height: 14, marginTop: 2 }}>
            {[0, 6, 12, 18, 24].map((t) => (
              <span
                key={t}
                className="mono"
                style={{
                  position: "absolute",
                  left: `${(t / 24) * 100}%`,
                  transform: "translateX(-50%)",
                  fontSize: 9,
                  color: "#63636b",
                  letterSpacing: "0.06em",
                }}
              >
                {String(t).padStart(2, "0")}
              </span>
            ))}
          </div>

          {/* live phase stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginTop: 22 }}>
            {phases.map((p, i) => (
              <PhaseStat key={i} phase={p} idx={i} />
            ))}
          </div>

          {/* generated insight */}
          <div
            style={{
              marginTop: 22,
              padding: "14px 16px",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 10,
              background: "#050506",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 11, color: "#ffffff", letterSpacing: "0.1em", flexShrink: 0, marginTop: 2 }}
            >
              RHEO →
            </span>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#f4f4f5" }}>
              {insight}
            </p>
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setBounds(DEFAULTS)}
              className="mono"
              style={{
                fontSize: 11,
                color: "#63636b",
                letterSpacing: "0.08em",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                padding: "8px 14px",
                cursor: "pointer",
                transition: "color 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s cubic-bezier(0.16,1,0.3,1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#f4f4f5";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#63636b";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              ↺ RESET TO DEFAULT
            </button>
            <button
              type="button"
              onClick={async () => {
                const url = window.location.href;
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  // clipboard may be unavailable
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="share-link-btn"
              data-copied={copied}
              aria-label="Copy a link to this day design"
            >
              {copied ? "✓ LINK COPIED" : "COPY LINK TO THIS DAY"}
            </button>
            <span className="mono tabular-nums" style={{ fontSize: 11, color: "#a1a1aa", marginLeft: "auto" }}>
              focus · {fmtH(totalFocus)}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PhaseStat({ phase, idx }: { phase: Phase; idx: number }) {
  const hours = phase.to - phase.from;
  const from = fmtClock(phase.from);
  const to = fmtClock(phase.to);
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 12,
        background: "#050506",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span
          className="mono"
          style={{ fontSize: 10, color: "#f4f4f5", letterSpacing: "0.1em" }}
        >
          {phase.key}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: `rgba(255,255,255,${INTENSITY[idx]})`,
            display: "inline-block",
          }}
        />
      </div>
      <div
        className="mono tabular-nums"
        style={{ fontSize: 18, color: "#ffffff", letterSpacing: "-0.01em" }}
      >
        {fmtH(hours)}
      </div>
      <div className="mono tabular-nums" style={{ fontSize: 9, color: "#63636b", marginTop: 2, letterSpacing: "0.06em" }}>
        {from} – {to}
      </div>
    </div>
  );
}

function fmtH(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
function fmtClock(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
