"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/**
 * LaminarSpotlight — one shared cursor-follow white radial highlight.
 * - white radial ≤8% opacity, ~200px
 * - driven by CSS vars --mx/--my on the parent (pointer-move sets them)
 * - transform/opacity only; off on touch (hover:none) + reduced-motion
 *
 * Wrap: put <LaminarSpotlight /> inside any relatively-positioned card and
 * set --mx/--my via onMouseMove on the card (see useCardCursor hook below).
 */
export default function LaminarSpotlight() {
  return (
    <span
      aria-hidden
      className="laminar-spotlight"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(200px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.08), transparent 60%)",
        opacity: 0,
        transition: "opacity 0.25s cubic-bezier(0.16,1,0.3,1)",
        zIndex: 0,
      }}
    />
  );
}

/**
 * useCardCursor — returns onMouseMove + onMouseLeave handlers that set
 * --mx/--my on the target element. No-op on touch + reduced-motion.
 */
export function useCardCursor() {
  const reduced = usePrefersReducedMotion();
  const touch = useRef(false);

  useEffect(() => {
    touch.current = window.matchMedia("(hover: none)").matches;
  }, []);

  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reduced || touch.current) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    // reveal the spotlight
    el.classList.add("spotlight-on");
  };
  const onMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    el_removeClass(e.currentTarget, "spotlight-on");
  };
  return { onMouseMove, onMouseLeave };
}

// tiny helper to avoid optional-chaining on currentTarget in older targets
function el_removeClass(el: EventTarget & HTMLElement, cls: string) {
  el.classList.remove(cls);
}
