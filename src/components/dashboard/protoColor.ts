// Shared helpers for the 3 dashboard prototype directions (SIGNAL / TERMINAL CHIC / NEON GLASS).
// Spec: agent/docs/generate-prompt-docs/dashboard-style-redesign-28092026/RESULT_CLAUDE.md §2
//
// One accent hue per surface, no new tokens — everything routes through the existing
// --dk-* / --ws-* / --page-accent custom properties or the Tailwind palette.

/** The single ease curve used by every direction. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Alpha helper that works for BOTH a hex string and a CSS var() reference.
 * `color-mix()` accepts a var() as its color argument, unlike hex-alpha concatenation
 * (`var(--page-accent)25` is invalid and silently drops the whole declaration).
 * The old approach of appending a hex suffix to an unvalidated string was bug 7.
 */
export const mix = (c: string, pct: number) =>
  `color-mix(in srgb, ${c} ${pct}%, transparent)`;

/** 44px hit area for small controls (28px box + 8px each side). */
export const HIT = "relative after:absolute after:-inset-2 after:content-['']";

/** Chart.js cannot read var(). Resolve once on mount. */
export const cssVar = (n: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Score band → token. Replaces the hard-coded hexes in all three tracking panels. */
export const BAND_VAR = {
  emerald: "var(--dk-success)",
  sky: "var(--dk-type-planner)",
  amber: "var(--dk-warning)",
  orange: "var(--dk-type-annotation)",
  red: "var(--dk-danger)",
} as const;

/** Motion config helpers — reduced-motion aware. */
export const tBase = (r: boolean, d = 0.15) =>
  r ? { duration: 0 } : { duration: d, ease: EASE };
export const tapProp = (r: boolean) => (r ? undefined : { scale: 0.98 });
export const liftProp = (r: boolean) => (r ? undefined : { y: -1 });

/**
 * Focus rings per direction (spec §2 "Focus" row).
 * These are STATIC class strings — Tailwind can see them. The color arrives via
 * the `--page-accent` custom property set on the card, never via interpolation.
 */
export const FOCUS_A =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";
export const FOCUS_B =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--dk-bg-base)]";
export const FOCUS_C =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";
