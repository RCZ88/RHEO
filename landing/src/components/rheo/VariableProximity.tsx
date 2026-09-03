"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/**
 * VariableProximity — per-letter spans whose font-weight eases 500→700 by
 * cursor distance, spring-smoothed (stiffness ~150, damping ~20).
 * RM = static weight 700. Nothing else moves.
 *
 * Usage: <VariableProximity text="RHEO" className="display-h1" />
 */
export default function VariableProximity({
  text,
  className,
  baseWeight = 500,
  peakWeight = 700,
  radius = 180,
}: {
  text: string;
  className?: string;
  baseWeight?: number;
  peakWeight?: number;
  radius?: number;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();
  const [weights, setWeights] = useState<number[]>(
    () => text.split("").map(() => (reduced ? peakWeight : baseWeight))
  );

  useEffect(() => {
    if (reduced) return;
    const touch = window.matchMedia("(hover: none)").matches;
    if (touch) return;

    // spring state per letter
    const cur = new Array(text.length).fill(baseWeight);
    const target = new Array(text.length).fill(baseWeight);
    let raf = 0;

    const tick = () => {
      let moved = false;
      for (let i = 0; i < cur.length; i++) {
        const diff = target[i] - cur[i];
        if (Math.abs(diff) > 0.1) {
          cur[i] += diff * 0.18; // spring step
          moved = true;
        } else {
          cur[i] = target[i];
        }
      }
      if (moved) {
        setWeights(cur.map((w) => Math.round(w)));
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      for (let i = 0; i < letterRefs.current.length; i++) {
        const el = letterRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius) {
          const k = 1 - dist / radius;
          target[i] = baseWeight + (peakWeight - baseWeight) * k;
        } else {
          target[i] = baseWeight;
        }
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      for (let i = 0; i < target.length; i++) target[i] = baseWeight;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [reduced, text, baseWeight, peakWeight, radius]);

  return (
    <span ref={containerRef} className={className} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          ref={(el) => {
            letterRefs.current[i] = el;
          }}
          style={{
            display: "inline-block",
            fontWeight: weights[i] ?? baseWeight,
            transition: "font-weight 0.1s linear",
          }}
          aria-hidden
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
