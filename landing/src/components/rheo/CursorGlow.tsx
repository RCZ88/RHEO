"use client";

import { useEffect, useRef } from "react";
import { useShouldAnimate } from "./use-motion-preference";

/**
 * Subtle white radial glow that follows the pointer.
 * - Transform-only motion (rAF-throttled translate3d, no re-renders)
 * - White radial at 8% opacity — the maximum allowed by the LAMINAR contract
 * - Scoped to the hero: only active while the first viewport is in view
 * - Fades out when the pointer leaves or the user scrolls past the hero
 * - Disabled under prefers-reduced-motion
 */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const shouldAnimate = useShouldAnimate();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!shouldAnimate) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let visible = false;

    const setVisible = (v: boolean) => {
      if (v === visible) return;
      visible = v;
      el.style.opacity = v ? "1" : "0";
    };

    const inHero = () => window.scrollY < window.innerHeight * 0.85;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible && inHero()) {
        curX = targetX;
        curY = targetY;
        setVisible(true);
      }
      if (visible && !raf) {
        raf = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (!inHero()) setVisible(false);
    };

    const onLeave = () => setVisible(false);

    const tick = () => {
      // lerp for smooth trailing
      curX += (targetX - curX) * 0.12;
      curY += (targetY - curY) * 0.12;
      el.style.transform = `translate3d(${curX - 300}px, ${curY - 300}px, 0)`;
      if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 1,
        opacity: 0,
        background:
          "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 35%, transparent 70%)",
        transition: "opacity 0.6s cubic-bezier(0.16,1,0.3,1)",
        willChange: "transform",
      }}
    />
  );
}
