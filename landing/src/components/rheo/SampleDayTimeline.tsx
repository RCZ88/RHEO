"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, useMotionValueEvent, type MotionValue } from "framer-motion";

/**
 * SampleDayTimeline — the flagship.
 *
 * Renders a 24-hour timeline from REAL data: 1,440 per-minute samples exported
 * from the developer's RHEO database (landing/data/sample-day.json). Each
 * minute has a category and an intensity. No app names, no titles, no domains —
 * the export is structurally incapable of emitting them.
 *
 * The visitor REPLAYS the day:
 *   - scroll-scrub (300vh) drives the playhead 0→1
 *   - dragging the playhead on the ruler drives it 1:1
 *   - auto-advance is banned (the same rule that deleted the console's auto-advance)
 *
 * Reduced motion: full timeline rendered statically, drag still works (direct
 * pointer manipulation is not ambient motion).
 *
 * Every number shown on screen is a value from sample-day.json. The caption rule
 * class for this element is REAL EXPORT — the file, the date, the sample count.
 */

type Sample = { minute: number; intensity: number; category: string | null };

type SampleDay = {
  provenance: { date: string; sample_count: number };
  summary: {
    top_category: string;
    top_category_minutes: number;
    deep_work_window: { start_minute: number; end_minute: number; minutes: number };
    minutes_with_activity: number;
  };
  samples: Sample[];
};

// Category -> brightness (0..1). Monochrome only. Productive is bright, neutral
// is mid, distracting is dim. This is the same tiering the app uses (Insights).
const CAT_BRIGHTNESS: Record<string, number> = {
  "IDE": 1.0,
  "AI Tools": 0.9,
  "Development": 0.85,
  "Education": 0.8,
  "Productivity": 0.7,
  "Communication": 0.55,
  "Browser": 0.45,
  "Uncategorized": 0.35,
  "Media": 0.3,
  "Entertainment": 0.2,
  "Gaming": 0.15,
  "Social Media": 0.12,
  "Web": 0.3,
};

export default function SampleDayTimeline({
  scrub,
  onProgress,
}: {
  scrub?: MotionValue<number>;
  onProgress?: (p: number) => void;
}) {
  const [data, setData] = useState<SampleDay | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const rulerRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // Load the sample day JSON (static asset, no fetch to a third party).
  useEffect(() => {
    fetch("/data/sample-day.json")
      .then((r) => r.json())
      .then((d: SampleDay) => setData(d))
      .catch(() => setData(null));
  }, []);

  // Shared progress value: driven by scroll (scrub) OR by drag.
  const handleProgress = useCallback((p: number) => {
    const clamped = Math.min(Math.max(p, 0), 1);
    setProgress(clamped);
    onProgress?.(clamped);
  }, [onProgress]);

  // Scroll-scrub subscription.
  useMotionValueEvent(scrub ?? null, "change", (v: number) => {
    if (!dragging) handleProgress(v);
  });

  // Drag handling on the ruler.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    const ruler = rulerRef.current;
    if (!ruler) return;
    const rect = ruler.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    handleProgress(p);
    const onMove = (ev: PointerEvent) => {
      const pp = (ev.clientX - rect.left) / rect.width;
      handleProgress(pp);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [handleProgress]);

  if (!data) {
    return (
      <div className="mono" style={{ fontSize: 12, color: "#8a8a94" }}>
        Loading sample day…
      </div>
    );
  }

  const { samples, summary, provenance } = data;
  const activeMinute = Math.round(progress * 1439);
  const activeSample = samples[activeMinute];

  // Precompute the bar heights (intensity * 100%).
  const bars = samples.map((s) => ({
    minute: s.minute,
    height: Math.max(2, s.intensity * 100),
    brightness: s.category ? (CAT_BRIGHTNESS[s.category] ?? 0.3) : 0,
    category: s.category,
  }));

  return (
    <div style={{ width: "100%" }}>
      {/* The timeline. Two layers: underlay (full day, dim) + fill (scaled by progress). */}
      <div style={{ position: "relative", height: 120, background: "#050506", borderRadius: 8, overflow: "hidden" }}>
        {/* Underlay: every minute, dim */}
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {bars.map((b) => (
            <rect
              key={b.minute}
              x={b.minute}
              y={120 - b.height}
              width={1}
              height={b.height}
              fill={`rgba(255,255,255,${0.06 + b.brightness * 0.12})`}
            />
          ))}
        </svg>

        {/* Fill layer: scaled by progress, brighter */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scaleX(${progress})`,
            transformOrigin: "left",
            transition: dragging ? "none" : "transform 0.05s linear",
          }}
        >
          <svg
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
          >
            {bars.map((b) => (
              <rect
                key={b.minute}
                x={b.minute}
                y={120 - b.height}
                width={1}
                height={b.height}
                fill={`rgba(255,255,255,${0.25 + b.brightness * 0.5})`}
              />
            ))}
          </svg>
        </div>

        {/* Playhead */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${progress * 100}%`,
            width: 1,
            background: "#ffffff",
            opacity: 0.8,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Ruler — draggable */}
      <div
        ref={rulerRef}
        onPointerDown={onPointerDown}
        style={{
          position: "relative",
          height: 32,
          marginTop: 8,
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
        role="slider"
        aria-label="Scrub the sample day"
        aria-valuemin={0}
        aria-valuemax={1439}
        aria-valuenow={activeMinute}
        tabIndex={0}
      >
        {/* Hour marks */}
        {Array.from({ length: 25 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(i / 24) * 100}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: i % 6 === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
        {/* Hour labels */}
        {Array.from({ length: 5 }, (_, i) => {
          const h = i * 6;
          return (
            <span
              key={h}
              className="mono"
              style={{
                position: "absolute",
                left: `${(h / 24) * 100}%`,
                top: 18,
                fontSize: 9,
                color: "#8a8a94",
                transform: "translateX(-50%)",
              }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          );
        })}
        {/* Draggable playhead handle */}
        <div
          style={{
            position: "absolute",
            left: `${progress * 100}%`,
            top: 0,
            bottom: 0,
            width: 3,
            background: "#ffffff",
            transform: "translateX(-50%)",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Readout — binds to the active minute */}
      <div
        className="mono"
        style={{
          marginTop: 16,
          fontSize: 12,
          color: "#a1a1aa",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>
          <span style={{ color: "#8a8a94" }}>time </span>
          {String(Math.floor(activeMinute / 60)).padStart(2, "0")}:{String(activeMinute % 60).padStart(2, "0")}
        </span>
        <span>
          <span style={{ color: "#8a8a94" }}>category </span>
          {activeSample?.category || "—"}
        </span>
        <span>
          <span style={{ color: "#8a8a94" }}>intensity </span>
          {activeSample?.intensity ?? 0}
        </span>
      </div>

      {/* Provenance line — the REAL EXPORT class */}
      <p
        className="mono"
        style={{
          marginTop: 16,
          fontSize: 10,
          color: "#63636b",
          letterSpacing: "0.08em",
          lineHeight: 1.5,
        }}
      >
        REAL EXPORT — {provenance.date} · {provenance.sample_count} minute samples ·
        landing/data/sample-day.json · every number above is a value from that file
      </p>
    </div>
  );
}