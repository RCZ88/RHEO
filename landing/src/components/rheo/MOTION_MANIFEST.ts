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
    name: "hero-dayfield",
    tier: "AFFORDANCE",
    component: "Hero.tsx",
    description: "81 pillars, each one a slice of a real day. Pointer-reactive.",
    provenance: "TRUE — real day, bucketed into 81 pillars. It answers your pointer; the heights are your data's.",
    reducedMotion: "Static pillars at real heights. No pointer response.",
  },
  {
    name: "hero-screenshot",
    tier: "REAL",
    component: "Hero.tsx",
    description: "Translucent dashboard screenshot, masked on the left edge.",
    provenance: "Real capture: public/media/app-dashboard.png.",
    reducedMotion: "Static, no change.",
  },
  // hero-decrypted-text and hero-session-clock are inside child components
  // (DecryptedText, SessionClock) which do not accept data-motion. They are
  // declared here for completeness but have no DOM attribute yet.
  // TODO: add data-motion to those components' root elements.
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
  // act-record-playhead and act-record-blocks are inside SampleDayTimeline/ActRecord
  // and do not have data-motion attributes yet. TODO: add them.
];

// ── Gallery ───────────────────────────────────────────────────────────────
export const GALLERY_MOTION: MotionEntry[] = [
  {
    name: "gallery-header-reveal",
    tier: "TRUE",
    component: "Gallery.tsx",
    description: "Header fades in on scroll.",
    provenance: "useInView, opacity + y, once.",
    reducedMotion: "Instant.",
  },
  // gallery-rail uses native scroll-snap (no JS motion). Not in the DOM as
  // data-motion because it is not a motion element — it is scroll behavior.
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
  // console-thinking-dots is inside the Console component. TODO: add data-motion.
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
  {
    name: "vault-figure",
    tier: "AFFORDANCE",
    component: "Download.tsx",
    description: "Vault figure — dial and bolts, pointer-reactive.",
    provenance: "Figure: Vault. Locked by default; the combination is yours. It is not your data.",
    reducedMotion: "Static, no pointer response.",
  },
  {
    name: "exploded-figure",
    tier: "AFFORDANCE",
    component: "Download.tsx",
    description: "Exploded figure — four layers of the local stack.",
    provenance: "DIAGRAM — THE FOUR LAYERS: RENDERER · MAIN · SQLITE FILE · YOUR DISK. NO SERVER. NOT A CAPTURE.",
    reducedMotion: "Static, no pointer response.",
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

// ALL_MOTION is the union of all section manifests. It is the source of truth
// for the manifest-vs-DOM audit. Every entry here must have a matching
// data-motion attribute in the rendered DOM. If an entry is missing from the
// DOM, either add the attribute or remove the entry. Do not leave stale entries.
export const ALL_MOTION: MotionEntry[] = [
  ...HERO_MOTION,
  ...ACTRECORD_MOTION,
  ...GALLERY_MOTION,
  ...ACTUNDERSTAND_MOTION,
  ...DOWNLOAD_MOTION,
];