"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a smoothed, capped absolute scroll velocity.
 * Returns velocity in px per frame (roughly), lerped toward 0 when idle.
 * Used to drive "turbulence" in the hero flow field + laminar/turbulent label.
 */
export function useScrollVelocity(
  onStateChange?: (turbulent: boolean) => void
) {
  // We keep this as a module-level mutable so consumers can read it per frame
  // without causing React re-renders.
  // Implemented as a singleton accessor.
  // For React ergonomics, also expose a turbulent state boolean.
  const [turbulent, setTurbulent] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = performance.now();
    let velocity = 0;
    let raf = 0;
    let running = true;
    let turbulentFlag = false;
    let stateTimer: number | undefined;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.max(1, now - lastT);
      lastT = now;
      const y = window.scrollY;
      const instant = Math.abs((y - lastY) / dt) * 16; // px per ~frame
      lastY = y;
      // lerp toward instant, with recovery toward 0 when idle
      if (instant > velocity) {
        velocity = velocity + (instant - velocity) * 0.5;
      } else {
        velocity = velocity + (instant - velocity) * 0.08; // ~1.2s recovery
      }
      velocity = Math.max(0, velocity);

      const isTurb = velocity > 2.2; // threshold
      if (isTurb !== turbulentFlag) {
        turbulentFlag = isTurb;
        setTurbulent(isTurb);
        onStateChange?.(isTurb);
      }

      // Performance: skip the next rAF when velocity is negligible AND the hero
      // is out of view (no work to do). Keep the document.hidden pause above.
      const heroInView =
        window.scrollY < window.innerHeight * 0.85;
      if (velocity < 0.01 && !heroInView) {
        raf = 0; // stop the loop; scroll/visibility handlers will resume it
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
      } else {
        running = true;
        lastT = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // resume the loop when the user scrolls again (the loop self-pauses when
    // velocity is negligible and the hero is offscreen)
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
      if (stateTimer) window.clearTimeout(stateTimer);
    };
  }, [onStateChange]);

  return turbulent;
}
