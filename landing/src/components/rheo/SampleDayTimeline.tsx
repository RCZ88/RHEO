"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, useMotionValueEvent, type MotionValue } from "framer-motion";

export type Sample = { minute: number; intensity: number; category: string | null };

export type SampleDay = {
  provenance: { date: string; sample_count: number };
  summary: {
    top_category: string;
    top_category_minutes: number;
    deep_work_window: { start_minute: number; end_minute: number; minutes: number };
    minutes_with_activity: number;
  };
  samples: Sample[];
};

const CAT_BRIGHTNESS: Record<string, number> = {
  "IDE": 1.0, "AI Tools": 0.9, "Development": 0.85, "Education": 0.8,
  "Productivity": 0.7, "Communication": 0.55, "Browser": 0.45,
  "Uncategorized": 0.35, "Media": 0.3, "Entertainment": 0.2,
  "Gaming": 0.15, "Social Media": 0.12, "Web": 0.3,
};

function fmt(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = Math.round(minute % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function SampleDayTimeline({
  scrub,
  onProgress,
}: {
  scrub?: MotionValue<number>;
  onProgress?: (p: number) => void;
}) {
  const [data, setData] = useState<SampleDay | null>(null);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  useEffect(() => {
    fetch("/data/sample-day.json")
      .then((r) => r.json())
      .then((d: SampleDay) => { setData(d); setTimeout(() => setMounted(true), 100); })
      .catch(() => setData(null));
  }, []);

  const handleProgress = useCallback((p: number) => {
    const clamped = Math.min(Math.max(p, 0), 1);
    setProgress(clamped);
    onProgress?.(clamped);
  }, [onProgress]);

  const idleScrub = useMotionValue(0);
  useMotionValueEvent(scrub ?? idleScrub, "change", (v: number) => {
    if (!dragging && scrub) handleProgress(v);
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
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

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentMinute = Math.round(progress * 1439);
    const step = e.shiftKey ? 60 : 15;
    let delta = 0;
    if (e.key === "ArrowRight") delta = step;
    else if (e.key === "ArrowLeft") delta = -step;
    else if (e.key === "Home") { handleProgress(0); e.preventDefault(); return; }
    else if (e.key === "End") { handleProgress(1); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    const newMinute = Math.min(Math.max(currentMinute + delta, 0), 1439);
    handleProgress(newMinute / 1439);
  }, [handleProgress, progress]);

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

  const bars = samples.map((s) => ({
    minute: s.minute,
    height: Math.max(2, Math.min(1, s.intensity) * 100),
    brightness: s.category ? (CAT_BRIGHTNESS[s.category] ?? 0.3) : 0,
    category: s.category,
  }));

  return (
    <div data-motion="sample-day-timeline" style={{ width: "100%" }}>
      {/* Fused panel: timeline canvas + divider + ruler = one instrument */}
      <div
        ref={panelRef}
        onPointerDown={onPointerDown}
        role="slider"
        aria-label="Scrub the sample day"
        aria-valuemin={0}
        aria-valuemax={1439}
        aria-valuenow={activeMinute}
        aria-valuetext={`${String(Math.floor(activeMinute / 60)).padStart(2, "0")}:${String(activeMinute % 60).padStart(2, "0")} · ${activeSample?.category || "—"}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          background: "#050506",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          overflow: "hidden",
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
          height: 153,
        }}
      >
        {/* Timeline canvas — 120px */}
        <div style={{ position: "relative", height: 120, overflow: "hidden" }}>
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
              transition: dragging ? "none" : "transform 0.05s linear, opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: mounted ? 1 : 0,
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

          {/* Playhead — single element spanning the full 153px panel */}
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
              zIndex: 2,
            }}
          />

          {/* HUD — top 20px dead zone (bars never reach above y=20) */}
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 12,
              right: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <span className="mono" style={{ fontSize: 12, color: "#f4f4f5", letterSpacing: "0.04em" }}>
              {String(Math.floor(activeMinute / 60)).padStart(2, "0")}:{String(activeMinute % 60).padStart(2, "0")}
              <span style={{ color: "#63636b" }}> · </span>
              <span style={{ color: "#a1a1aa" }}>{activeSample?.category || "—"}</span>
            </span>
            <span className="mono" style={{ fontSize: 12, color: "#8a8a94" }}>
              intensity {activeSample?.intensity ?? 0}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Ruler — 32px, marginTop 0 (now behind divider) */}
        <div style={{ position: "relative", height: 32 }}>
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
        </div>
      </div>

      {/* Facts line — renders the previously-unused summary */}
      <div
        className="mono"
        style={{ marginTop: 12, fontSize: 11, color: "#8a8a94", lineHeight: 1.5 }}
      >
        {summary.top_category} · {summary.top_category_minutes} min ·
        deep work {fmt(summary.deep_work_window.start_minute)}–{fmt(summary.deep_work_window.end_minute)}
        ({summary.deep_work_window.minutes} min) ·
        {summary.minutes_with_activity}/{provenance.sample_count} min active
      </div>

      {/* Provenance line — unchanged text */}
      <p
        className="mono"
        style={{
          marginTop: 8,
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