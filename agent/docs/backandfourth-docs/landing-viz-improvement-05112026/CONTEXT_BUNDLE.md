# CONTEXT BUNDLE: Landing Page Visualization Improvement

## Problem
Two visualization sections on the RHEO landing page need improvement:

1. **SampleDayTimeline (ActRecord section)** — The 24-hour tracking visualization has too much empty gap space between the timeline and the readout. The layout is not well portioned. The visualization feels vague and doesn't show the "real thing" well.

2. **Vault/Exploded figures (Download/Proof section)** — The two hairline figures (Vault + Exploded) are side by side but have missing interactive elements. The section feels under-designed compared to the rest of the page.

## User's Verbatim Request
"also, wheres the fix for the second portion which is like the timeline showing? liek the showing visauzaition of the timelien tracking system? why is there so many empty gap space htat is like not well portioned nor designed. also like the visualzation animation thing with the vault stuff on the bottom section can be improved because like there are view elements that are missing frmo the visual interatactables."

## Current State
- Landing page is Next.js in `landing/` directory
- Dark mode only, LAMINAR design system
- SampleDayTimeline renders a 24h timeline from real data (1,440 minute samples)
- Download section has Vault + Exploded figures side by side
- Both sections have "empty gap" issues

---

## FILE 1: landing/src/components/rheo/SampleDayTimeline.tsx (312 lines)

```typescript
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
  const rulerRef = useRef<HTMLDivElement>(null);
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

  const bars = samples.map((s) => ({
    minute: s.minute,
    height: Math.max(2, s.intensity * 100),
    brightness: s.category ? (CAT_BRIGHTNESS[s.category] ?? 0.3) : 0,
    category: s.category,
  }));

  return (
    <div data-motion="sample-day-timeline" style={{ width: "100%" }}>
      {/* The timeline. Two layers: underlay (full day, dim) + fill (scaled by progress). */}
      <div style={{ position: "relative", height: 120, background: "#050506", borderRadius: 8, overflow: "hidden" }}>
        {/* Underlay: every minute, dim */}
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {bars.map((b) => (
            <rect key={b.minute} x={b.minute} y={120 - b.height} width={1} height={b.height}
              fill={`rgba(255,255,255,${0.06 + b.brightness * 0.12})`} />
          ))}
        </svg>

        {/* Fill layer: scaled by progress, brighter */}
        <div style={{
          position: "absolute", inset: 0,
          transform: `scaleX(${progress})`,
          transformOrigin: "left",
          transition: dragging ? "none" : "transform 0.05s linear, opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: mounted ? 1 : 0,
        }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}>
            {bars.map((b) => (
              <rect key={b.minute} x={b.minute} y={120 - b.height} width={1} height={b.height}
                fill={`rgba(255,255,255,${0.25 + b.brightness * 0.5})`} />
            ))}
          </svg>
        </div>

        {/* Playhead */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${progress * 100}%`, width: 1,
          background: "#ffffff", opacity: 0.8, pointerEvents: "none",
        }} />
      </div>

      {/* Ruler — draggable */}
      <div ref={rulerRef} onPointerDown={onPointerDown}
        style={{ position: "relative", height: 32, marginTop: 8, cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}
        role="slider" aria-label="Scrub the sample day" aria-valuemin={0} aria-valuemax={1439} aria-valuenow={activeMinute} tabIndex={0}>
        {/* Hour marks */}
        {Array.from({ length: 25 }, (_, i) => (
          <div key={i} style={{
            position: "absolute", left: `${(i / 24) * 100}%`, top: 0, bottom: 0, width: 1,
            background: i % 6 === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
          }} />
        ))}
        {/* Hour labels */}
        {Array.from({ length: 5 }, (_, i) => {
          const h = i * 6;
          return (
            <span key={h} className="mono" style={{
              position: "absolute", left: `${(h / 24) * 100}%`, top: 18,
              fontSize: 9, color: "#8a8a94", transform: "translateX(-50%)",
            }}>
              {String(h).padStart(2, "0")}:00
            </span>
          );
        })}
        {/* Draggable playhead handle */}
        <div style={{
          position: "absolute", left: `${progress * 100}%`, top: 0, bottom: 0, width: 3,
          background: "#ffffff", transform: "translateX(-50%)", borderRadius: 2, pointerEvents: "none",
        }} />
      </div>

      {/* Readout */}
      <div className="mono" style={{ marginTop: 16, fontSize: 12, color: "#a1a1aa", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><span style={{ color: "#8a8a94" }}>time </span>{String(Math.floor(activeMinute / 60)).padStart(2, "0")}:{String(activeMinute % 60).padStart(2, "0")}</span>
        <span><span style={{ color: "#8a8a94" }}>category </span>{activeSample?.category || "—"}</span>
        <span><span style={{ color: "#8a8a94" }}>intensity </span>{activeSample?.intensity ?? 0}</span>
      </div>

      {/* Provenance line */}
      <p className="mono" style={{ marginTop: 16, fontSize: 10, color: "#63636b", letterSpacing: "0.08em", lineHeight: 1.5 }}>
        REAL EXPORT — {provenance.date} · {provenance.sample_count} minute samples ·
        landing/data/sample-day.json · every number above is a value from that file
      </p>
    </div>
  );
}
```

---

## FILE 2: landing/src/components/rheo/Download.tsx (356 lines)

[Already included above — see the file content from the read tool output]

Key sections:
- Lines 40-55: Radial bloom background
- Lines 57-83: Header (kicker + h2 "OWN YOUR HOURS.")
- Lines 85-89: Ledger (3 sourced claims)
- Lines 91-153: Vault + Exploded figures side by side (flex row, gap-8)
- Lines 155-173: Proof link to /docs/network
- Lines 175-185: "Not released yet. v0.2.0, pre-release."
- Lines 187-204: Mailto link
- Lines 213-324: OS cards (3 platform cards with download buttons)
- Lines 326-355: Version divider

---

## FILE 3: landing/src/components/rheo/Hero.tsx (209 lines)

```typescript
"use client";

import { motion, useInView } from "framer-motion";
import { useShouldAnimate } from "./use-motion-preference";
import { useEffect, useRef } from "react";
import DecryptedText from "./DecryptedText";
import { SessionClock } from "./SessionClock";
import Dayfield from "./Dayfield";

export default function Hero() {
  const rm = !useShouldAnimate();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px", once: true });

  return (
    <section id="hero" ref={ref} className="relative surface-page pt-24 sm:pt-32">
      {/* white 8% radial bloom */}
      <div aria-hidden style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(620px, 90vw)", height: "min(620px, 90vw)",
        background: "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="relative px-5 sm:px-10 lg:px-16 max-w-[1280px] mx-auto text-center">
        <div className="mx-auto max-w-[760px]">
          <motion.p className="mono-label" style={{ fontSize: 11 }}
            initial={{ opacity: rm ? 1 : 0, y: rm ? 0 : 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <DecryptedText text="SECTION 01 / HERO" speed={28} maxIterations={6} />
          </motion.p>

          <motion.h1 className="display-h1 mt-4"
            initial={{ opacity: rm ? 1 : 0, y: rm ? 0 : 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}>
            YOUR TIME. YOUR MACHINE. YOURS.
          </motion.h1>

          {/* plain sentence added per round-07 */}
          <motion.p style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa", marginTop: 16 }}
            initial={{ opacity: rm ? 1 : 0, y: rm ? 0 : 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
            RHEO tracks where your hours go — every app, every site, every minute —
            and keeps the whole record on your own machine. No account. No cloud. No
            subscription.
          </motion.p>

          {/* Dayfield — 81 pillars at real data heights */}
          <div aria-hidden data-motion="hero-dayfield" className="absolute inset-0 pointer-events-auto" style={{ opacity: 0.6 }}>
            <Dayfield label="Eighty-one pillars, each one a slice of a real day" />
          </div>

          {/* hero screenshot */}
          <div data-motion="hero-screenshot" className="hidden lg:block absolute top-1/2 -translate-y-1/2 right-6 w-[42%] z-5 pointer-events-none">
            <div className="relative">
              <img src="/media/app-dashboard.png" alt="..." style={{ opacity: 0.7, maskImage: "linear-gradient(to right, transparent 0%, black 8%)" }} />
            </div>
          </div>

          {/* Session clock */}
          <div className="mt-8">
            <SessionClock />
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

## Design System (LAMINAR)

- **Colors**: Monochrome zinc. Background #050506. Text #f4f4f5 (hi), #a1a1aa (mid), #8a8a94 (lo), #63636b (dim).
- **Signal hue**: ONE per surface. Download uses white (#ffffff) as signal.
- **Radii**: 6px, 10px, 16px only. Pill for tags.
- **Spacing**: 4px base. Sections: pt-24 sm:pt-32. Cards: p-5. Gaps: gap-3, gap-5, gap-8.
- **Typography**: Inter (body), JetBrains Mono (mono labels/data), Space Grotesk (display, max 2 per view).
- **Motion**: Single easing [0.16, 1, 0.3, 1]. 160ms for micro-interactions. Opacity + transform only (no layout properties).
- **No**: glassmorphism on chrome, decorative glow, gradients, spring/bounce, emoji icons.
- **reduced-motion**: All animations gated. Static fallback always.

## User's Specific Complaints

1. **SampleDayTimeline empty gaps**: "why is there so many empty gap space that is like not well portioned nor designed"
   - The timeline is 120px tall with 32px ruler + 16px readout + 16px provenance = ~184px total
   - But the section around it (ActRecord) has large vertical gaps
   - The readout (time/category/intensity) feels disconnected from the timeline
   - The provenance line is far from the visualization

2. **Vault/Exploded missing interactivity**: "the visualzation animation thing with the vault stuff on the bottom section can be improved because like there are view elements that are missing frmo the visual interatactables"
   - Vault and Exploded are hairline figures (pointer-reactive)
   - They're at 0.4/0.45 opacity — very dim
   - They have small caption labels ("FIGURE — VAULT", "DIAGRAM — THE FOUR LAYERS")
   - The OS cards below them are large and prominent
   - There's a lot of vertical space between the figures and the OS cards

## What We Want From GLM

1. **Layout improvements** for SampleDayTimeline — better spacing, more cohesive readout, less empty space
2. **Visual improvements** for the Vault/Exploded section — better integration, more interactive feel
3. **Overall section flow** — how the elements within each section should be composed
4. **Specific CSS/layout changes** — exact values, not vague suggestions

## Files to Modify
- landing/src/components/rheo/SampleDayTimeline.tsx
- landing/src/components/rheo/Download.tsx
- landing/src/components/rheo/ActRecord.tsx (the parent that renders SampleDayTimeline)
- landing/src/components/rheo/Hero.tsx (Dayfield placement)

## Constraints
- Must use LAMINAR design tokens (monochrome, radii 6/10/16, single easing)
- Must not introduce new dependencies
- Must keep reduced-motion support
- Must keep all data real (no fabrications)
- Must not remove existing interactive elements (drag, scroll-scrub)
EOF
echo "Context bundle written"