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

type Segment = { start: number; end: number; category: string | null; meanIntensity: number };

function deriveSegments(samples: Sample[]): Segment[] {
  const segs: Segment[] = [];
  let i = 0;
  while (i < samples.length) {
    const cat = samples[i].category;
    let j = i;
    let sumI = 0;
    while (j < samples.length && samples[j].category === cat) {
      sumI += samples[j].intensity;
      j++;
    }
    segs.push({ start: i, end: j, category: cat, meanIntensity: (j - i) > 0 ? sumI / (j - i) : 0 });
    i = j;
  }
  return segs;
}

export default function SampleDayTimeline({
  scrub,
  onProgress,
}: {
  scrub?: MotionValue<number>;
  onProgress?: (p: number) => void;
}) {
  const [data, setData] = useState<SampleDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoverMinute, setHoverMinute] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  useEffect(() => {
    let cancelled = false;
    const load = (attempt = 0) => {
      fetch("/data/sample-day.json")
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((d: SampleDay) => {
          if (cancelled) return;
          setData(d);
          setTimeout(() => setMounted(true), 100);
        })
        .catch((err) => {
          if (cancelled) return;
          if (attempt < 2) {
            setTimeout(() => load(attempt + 1), 1000 * (attempt + 1));
          } else {
            console.error("SampleDayTimeline: failed to load sample-day.json", err);
            setError(err.message);
          }
        });
    };
    load();
    return () => { cancelled = true; };
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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    const minute = Math.round(Math.min(Math.max(p, 0), 1) * 1439);
    setHoverMinute(minute);
  }, []);

  const onPointerLeave = useCallback(() => {
    setHoverMinute(null);
  }, []);

  if (error) {
    return (
      <div className="mono" style={{ fontSize: 12, color: "#ef4444" }}>
        Failed to load sample day: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mono" style={{ fontSize: 12, color: "#8a8a94" }}>
        Loading sample day…
      </div>
    );
  }

  const { samples, provenance } = data;
  const activeMinute = Math.round(progress * 1439);
  const activeSample = samples[activeMinute];
  const segments = deriveSegments(samples);

  // Client-side histogram
  const hist: Record<string, number> = {};
  let logged = 0;
  for (const s of samples) {
    if (s.category) {
      hist[s.category] = (hist[s.category] || 0) + 1;
      logged++;
    }
  }
  const topCats = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const factsText = topCats.map(([cat, mins]) => `${cat} ${mins}`).join(" · ") + ` · ${logged}/1,440 min logged`;

  const W = 1000;
  const CANVAS_H = 120;
  const RULER_H = 20;
  const PANEL_H = CANVAS_H + 1 + RULER_H; // 141

  return (
    <div data-motion="sample-day-timeline" style={{ width: "100%" }}>
      <div
        ref={panelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
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
          height: PANEL_H,
        }}
        className="instrument"
      >
        {/* Canvas — 120px */}
        <div style={{ position: "relative", height: CANVAS_H, overflow: "hidden" }}>
          {/* Bright layer (bottom): all segments at full brightness, static */}
          <svg
            viewBox={`0 0 ${W} ${CANVAS_H}`}
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            {segments.map((seg, idx) => {
              const brightness = seg.category ? (CAT_BRIGHTNESS[seg.category] ?? 0.3) : 0;
              const x = (seg.start / 1440) * W;
              const w = ((seg.end - seg.start) / 1440) * W;
              const h = Math.max(8, (seg.category ? seg.meanIntensity : 0) * 100);
              const fill = seg.category
                ? `rgba(255,255,255,${0.25 + brightness * 0.5})`
                : `rgba(255,255,255,0.03)`;
              return (
                <rect
                  key={`bright-${idx}`}
                  x={x}
                  y={CANVAS_H - h}
                  width={Math.max(1, w - 1)}
                  height={h}
                  fill={fill}
                  style={{
                    transformOrigin: "bottom",
                    transform: mounted && !reduced ? "scaleY(1)" : "scaleY(1)",
                    opacity: mounted ? 1 : 0,
                    transition: mounted && !reduced
                      ? `transform 0.4s cubic-bezier(0.16,1,0.3,1) ${Math.min(idx * 20, 600)}ms, opacity 0.3s ease`
                      : "none",
                  }}
                />
              );
            })}
          </svg>

          {/* Dim layer (top): segments in overflow:hidden wrapper, translated by progress */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              transform: `translateX(${progress * 100}%)`,
              transition: dragging ? "none" : "transform 0.05s linear",
            }}
          >
            <svg
              viewBox={`0 0 ${W} ${CANVAS_H}`}
              preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
              {segments.map((seg, idx) => {
                const brightness = seg.category ? (CAT_BRIGHTNESS[seg.category] ?? 0.3) : 0;
                const x = (seg.start / 1440) * W;
                const w = ((seg.end - seg.start) / 1440) * W;
                const h = Math.max(8, (seg.category ? seg.meanIntensity : 0) * 100);
                const fill = seg.category
                  ? `rgba(255,255,255,${0.06 + brightness * 0.12})`
                  : `rgba(255,255,255,0.02)`;
                return (
                  <rect
                    key={`dim-${idx}`}
                    x={x}
                    y={CANVAS_H - h}
                    width={Math.max(1, w - 1)}
                    height={h}
                    fill={fill}
                  />
                );
              })}
            </svg>
          </div>

          {/* Playhead — 2px, spans full panel */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${progress * 100}%`,
              width: 2,
              background: "#ffffff",
              opacity: 0.9,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {/* HUD — top 5px dead zone */}
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
              {String(Math.floor((hoverMinute ?? activeMinute) / 60)).padStart(2, "0")}:{String((hoverMinute ?? activeMinute) % 60).padStart(2, "0")}
              <span style={{ color: "#63636b" }}> · </span>
              <span style={{ color: "#a1a1aa" }}>{(hoverMinute !== null ? samples[hoverMinute] : activeSample)?.category || "—"}</span>
            </span>
            <span className="mono" style={{ fontSize: 12, color: "#8a8a94" }}>
              intensity {(hoverMinute !== null ? samples[hoverMinute] : activeSample)?.intensity ?? 0}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Ruler — 20px */}
        <div style={{ position: "relative", height: RULER_H }}>
          {Array.from({ length: 25 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i / 24) * 100}%`,
                top: 0,
                bottom: RULER_H - 6,
                width: 1,
                background: i % 6 === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
              }}
            />
          ))}
          {Array.from({ length: 5 }, (_, i) => {
            const h = i * 6;
            return (
              <span
                key={h}
                className="mono"
                style={{
                  position: "absolute",
                  left: `${(h / 24) * 100}%`,
                  top: 9,
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

      {/* Facts line — derived histogram */}
      <div
        className="mono"
        style={{ marginTop: 12, fontSize: 11, color: "#8a8a94", lineHeight: 1.5 }}
      >
        {factsText}
      </div>

      {/* Provenance line */}
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
        landing/data/sample-day.json · every number above is a value from that file · derived from the same file
      </p>
    </div>
  );
}
