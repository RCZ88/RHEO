"use client";

import { useEffect, useRef } from "react";

/**
 * useScrollVelocityValue — returns a ref holding the smoothed absolute scroll
 * velocity (px per ~frame). Updates every rAF via direct mutation; consumers
 * read velocityRef.current per frame in their own rAF loop. No re-renders.
 *
 * Skips rAF work when |velocity| < 0.01 AND the hero is offscreen (Item 9).
 * Keeps the document.hidden pause.
 */
export function useScrollVelocityValue() {
  const velocityRef = useRef(0);

  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = performance.now();
    let velocity = 0;
    let raf = 0;
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.max(1, now - lastT);
      lastT = now;
      const y = window.scrollY;
      const instant = Math.abs((y - lastY) / dt) * 16; // px per ~frame
      lastY = y;
      if (instant > velocity) {
        velocity = velocity + (instant - velocity) * 0.5;
      } else {
        velocity = velocity + (instant - velocity) * 0.08; // ~1.2s recovery
      }
      velocity = Math.max(0, velocity);
      velocityRef.current = velocity;

      // Item 9: skip rAF when |velocity| < 0.01 AND hero offscreen
      const heroInView = window.scrollY < window.innerHeight * 0.85;
      if (velocity < 0.01 && !heroInView) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
        velocity = 0;
        velocityRef.current = 0;
      } else {
        running = true;
        lastT = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const onScroll = () => {
      if (!running) return;
      if (!raf) {
        lastT = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(loop);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return velocityRef;
}
