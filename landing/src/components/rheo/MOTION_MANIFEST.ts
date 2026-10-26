// landing/src/components/rheo/MOTION_MANIFEST.ts
//
// THE PROVENANCE LEDGER for every moving element on the landing page.
//
// RULE (round-05 §3.4, revised round-08): if it moves, it must be REAL, TRUE,
// or AFFORDANCE — and its caption must say which. This file makes that rule
// auditable instead of aspirational.
//
// SHAPE: per-component export. Each component that owns a moving element exports
// its own declaration (MOTION). A build-time script concatenates them. Adding a
// motion element without declaring it fails the build, not a quarterly audit.
//
// Tiers:
//   REAL        — the app's own component code, running unmodified in behavior
//   TRUE        — landing code rendering real exported data
//   AFFORDANCE  — an illustration standing for a meaning, and admitting it
//   EXAMPLE     — simulated output (the console answers are typed examples)

export type MotionTier = "REAL" | "TRUE" | "AFFORDANCE" | "EXAMPLE";

export type MotionEntry = {
  name: string;          // unique id, matches data-motion attribute in DOM
  tier: MotionTier;
  component: string;     // file that owns it
  description: string;  // one line: what it is
  provenance: string;    // the checkable claim
  reducedMotion: string; // what happens under prefers-reduced-motion
};

// ── Hero ──────────────────────────────────────────────────────────────────
export const HERO_MOTION: MotionEntry[] = [
  {
    name: "hero-flow-field",
    tier: "AFFORDANCE",
    component: "FlowFieldCanvas.tsx",
    description: "ASCII flow field that drifts and answers the pointer.",
    provenance: "Value noise + pointer repulsor. No data behind it. Captioned as atmosphere, not measurement.",
    reducedMotion: "Static frame, no pointer response.",
  },
  {
    name: "hero-screenshot",
    tier: "REAL",
    component: "Hero.tsx",
    description: "Translucent dashboard screenshot, masked on the left edge.",
    provenance: "Real capture: public/media/app-dashboard.png (2880x1800).",
    reducedMotion: "Static, no change.",
  },
  {
    name: "hero-decrypted-text",
    tier: "TRUE",
    component: "DecryptedText.tsx",
    description: "Kicker text that resolves from random glyphs on mount.",
    provenance: "Real component, no fabricated data.",
    reducedMotion: "Instant resolve, no animation.",
  },
  {
    name: "hero-session-clock",
    tier: "TRUE",
    component: "SessionClock.tsx",
    description: "Live elapsed time on this page.",
    provenance: "Real clock, counts from page load.",
    reducedMotion: "Still counts, no animation.",
  },
];

// ── ActRecord ─────────────────────────────────────────────────────────────
export const ACTRECORD_MOTION: MotionEntry[] = [
  {
    name: "sample-day-timeline",
    tier: "TRUE",
    component: "SampleDayTimeline.tsx",
    description: "24h timeline scrubbed by scroll and drag, rendered from real data.",
    provenance: "landing/data/sample-day.json — 1,440 minutes from the developer's RHEO DB, 2026-10-13. Every number binds to a value in that file.",
    reducedMotion: "Full timeline rendered statically. Drag still works (direct manipulation, not ambient).",
  },
  {
    name: "act-record-playhead",
    tier: "TRUE",
    component: "SampleDayTimeline.tsx",
    description: "1px playhead that moves with scroll and drag.",
    provenance: "Position = progress * 1439, quantized to whole minutes.",
    reducedMotion: "Position updates on scroll, no tween.",
  },
  {
    name: "act-record-blocks",
    tier: "REAL",
    component: "ActRecord.tsx",
    description: "Per-block counter that ticks up during scrub.",
    provenance: "BLOCKS_WITH_TEXT, blurb derived from total via fmtHM().",
    reducedMotion: "Instant jump to final value.",
  },
];

// ── Gallery ───────────────────────────────────────────────────────────────
export const GALLERY_MOTION: MotionEntry[] = [
  {
    name: "gallery-rail",
    tier: "REAL",
    component: "Gallery.tsx",
    description: "Horizontal scroll-snap rail of 17 real captures.",
    provenance: "Native scroll-snap, no carousel engine. Real screenshots.",
    reducedMotion: "Static, scroll still works.",
  },
  {
    name: "gallery-header-reveal",
    tier: "TRUE",
    component: "Gallery.tsx",
    description: "Header fades in on scroll.",
    provenance: "useInView, opacity + y, once.",
    reducedMotion: "Instant.",
  },
];

// ── ActUnderstand ─────────────────────────────────────────────────────────
export const ACTUNDERSTAND_MOTION: MotionEntry[] = [
  {
    name: "console-typing",
    tier: "EXAMPLE",
    component: "ActUnderstand.tsx",
    description: "Typed query + blinking cursor, cycling through 3 scenarios.",
    provenance: "Typed strings, not recordings. Labelled 'Example answers'.",
    reducedMotion: "Instant full text, no cursor blink.",
  },
  {
    name: "console-thinking-dots",
    tier: "EXAMPLE",
    component: "ActUnderstand.tsx",
    description: "Three animated dots + 'Thinking...' while answer loads.",
    provenance: "Matches the real panel: CanvasInput.tsx:173-181.",
    reducedMotion: "Static dots at 0.6 opacity.",
  },
];

// ── Download ──────────────────────────────────────────────────────────────
export const DOWNLOAD_MOTION: MotionEntry[] = [
  {
    name: "ledger-reveal",
    tier: "TRUE",
    component: "Ledger.tsx",
    description: "Three cells fade in on scroll, opacity + y only.",
    provenance: "FACTS array, each with a source code line.",
    reducedMotion: "Instant.",
  },
];

// ── Page-level ────────────────────────────────────────────────────────────
export const PAGE_MOTION: MotionEntry[] = [
  {
    name: "motion-config",
    tier: "REAL",
    component: "page.tsx",
    description: "MotionConfig reducedMotion='user' wraps everything.",
    provenance: "framer-motion v12.",
    reducedMotion: "Disables all framer-motion animations globally.",
  },
];

export const ALL_MOTION: MotionEntry[] = [
  ...HERO_MOTION,
  ...ACTRECORD_MOTION,
  ...GALLERY_MOTION,
  ...ACTUNDERSTAND_MOTION,
  ...DOWNLOAD_MOTION,
  ...PAGE_MOTION,
];