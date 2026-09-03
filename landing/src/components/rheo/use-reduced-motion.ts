"use client";

import { useMemo } from "react";
import { useShouldAnimate } from "./use-motion-preference";

/**
 * Backward-compatible wrapper for components still using `usePrefersReducedMotion`.
 * New code should use `useMotionPreference` / `useShouldAnimate` directly.
 */
export function usePrefersReducedMotion(): boolean {
  // We memoize to avoid flipping during a render; the underlying hook
  // handles live-listening.
  const shouldAnimate = useShouldAnimate();
  return useMemo(() => !shouldAnimate, [shouldAnimate]);
}
