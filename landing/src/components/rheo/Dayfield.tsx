"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SampleDay } from "./SampleDayTimeline";

/**
 * Dayfield — the data-driven figure.
 *
 * 81 pillars whose standing heights ARE one real day's activity, bucketed
 * from landing/data/sample-day.json. The pointer still raises neighbors —
 * your hand lights up your actual day.
 *
 * This is NOT a hairline figure (the library's kernel is internal and not
 * exported). It is a React component rendering SVG, using the same visual
 * vocabulary: monochrome zinc, opacity-only motion, reduced-motion aware.
 *
 * Caption (TRUE tier): "Real heights: one real day, bucketed into 81 pillars.
 * It answers your pointer; the heights are your data's."
 */

type Bucket = { height: number; category: string | null };

export default function Dayfield({
  label = "Eighty-one pillars, each one a slice of a real day",
}: {
  label?: string;
}) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [pointer, setPointer] = useState<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // Load sample day and bucket into 81 slices.
  useEffect(() => {
    fetch("/data/sample-day.json")
      .then((r) => r.json())
      .then((d: SampleDay) => {
        const N = 81;
        const perBucket = 1440 / N; // ~17.78 minutes per bucket
        const buckets: Bucket[] = [];
        for (let i = 0; i < N; i++) {
          const start = Math.floor(i * perBucket);
          const end = Math.floor((i + 1) * perBucket);
          let sum = 0;
          let count = 0;
          const cats = new Map<string, number>();
          for (let m = start; m < end && m < 1440; m++) {
            const s = d.samples[m];
            if (s && s.intensity > 0) {
              sum += s.intensity;
              count++;
              if (s.category) cats.set(s.category, (cats.get(s.category) || 0) + 1);
            }
          }
          const height = count > 0 ? sum / count : 0;
          // dominant category
          let domCat: string | null = null;
          let maxCount = 0;
          for (const [cat, c] of cats) {
            if (c > maxCount) { maxCount = c; domCat = cat; }
          }
          buckets.push({ height, category: domCat });
        }
        setBuckets(buckets);
      })
      .catch(() => setBuckets([]));
  }, []);

  // Pointer tracking.
  const onMove = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
  }, []);
  const onLeave = useCallback(() => {
    setPointer({ x: -9999, y: -9999, active: false });
  }, []);

  if (buckets.length === 0) {
    return (
      <div className="mono" style={{ fontSize: 12, color: "#8a8a94" }}>
        Loading day…
      </div>
    );
  }

  const N = buckets.length;
  const W = 400;
  const H = 160;
  const cellW = W / N;
  const maxH = H * 0.85;

  // Category -> brightness (monochrome)
  const CAT_BRIGHTNESS: Record<string, number> = {
    "IDE": 1.0, "AI Tools": 0.9, "Development": 0.85, "Education": 0.8,
    "Productivity": 0.7, "Communication": 0.55, "Browser": 0.45,
    "Uncategorized": 0.35, "Media": 0.3, "Entertainment": 0.2,
    "Gaming": 0.15, "Social Media": 0.12, "Web": 0.3,
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      role="img"
      aria-label={label}
      style={{ width: "100%", aspectRatio: "5 / 4", position: "relative" }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* Plinth */}
        <rect x={0} y={H - 4} width={W} height={4} fill="rgba(255,255,255,0.06)" />

        {/* Pillars */}
        {buckets.map((b, i) => {
          const cx = i * cellW + cellW / 2;
          const h = Math.max(1, b.height * maxH);
          const y = H - 4 - h;
          const brightness = b.category ? (CAT_BRIGHTNESS[b.category] ?? 0.3) : 0.1;

          // Pointer lift
          let lift = 0;
          if (pointer.active) {
            const px = (pointer.x / (containerRef.current?.clientWidth || W)) * W;
            const dist = Math.abs(cx - px);
            if (dist < 60) {
              lift = (1 - dist / 60) * 12;
            }
          }

          const opacity = 0.25 + brightness * 0.5 + (pointer.active && Math.abs(cx - (pointer.x / (containerRef.current?.clientWidth || W)) * W) < 60 ? 0.2 : 0);

          return (
            <rect
              key={i}
              x={cx - cellW * 0.35}
              y={y - lift}
              width={cellW * 0.7}
              height={h + lift}
              fill={`rgba(255,255,255,${Math.min(0.9, opacity)})`}
              style={{
                transition: reduced ? "none" : "y 0.15s cubic-bezier(0.16,1,0.3,1), height 0.15s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          );
        })}
      </svg>

      {/* Provenance */}
      <div
        className="mono"
        style={{
          position: "absolute",
          bottom: 4,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 9,
          color: "#63636b",
          letterSpacing: "0.08em",
        }}
      >
        TRUE — real day, bucketed into 81 pillars · data/sample-day.json
      </div>
    </div>
  );
}