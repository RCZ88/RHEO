/** @jsxImportSource react */
/** @jsxFrag React.Fragment */
/** @jsxRuntime classic */

/** Atlas data — the 16-instrument catalogue for RHEO section S5 "THE ATLAS".
 * Names, statuses, and one-liners are VERBATIM per spec; do not inflate a status.
 * Placement: provisional per P-1 (dossier-amendment task owns final grouping).
 *
 * NOTE: no stored index field — render order derives from array position,
 * never a stored number. Index displayed in UI is derived at render time.
 */

export type AtlasStatus = "SHIPPED" | "BETA" | "SOON" | "VISION";

export type AtlasInstrument = {
  id: string;
  name: string;
  status: AtlasStatus;
  oneLiner: string;
  glyph: AtlasGlyph;
};

/**
 * A REAL screenshot of the shipping app, per instrument.
 *
 * The Atlas modal used to render an abstract SVG glyph only — it was the one
 * section on the page with no real footage, so "16 instruments" read as a
 * promise rather than a product. Every path here points at a capture that
 * actually exists in `public/media/`. Instruments with no shipped surface
 * (marketplace, research-digest, trace, conductor) fall back to `null` and the
 * modal keeps the glyph, because showing a wrong screenshot is worse than
 * showing an honest glyph.
 */
export const ATLAS_MEDIA: Record<
  string,
  { src: string; alt: string; kind: "shot" } | null
> = {
  "external-tracking": {
    src: "/media/app-activity.png",
    alt: "The Activity record — every app and site, logged",
    kind: "shot",
  },
  screenshots: {
    src: "/media/app-console.png",
    alt: "A real session with its captured screenshots filed alongside",
    kind: "shot",
  },
  "mobile-companion": {
    src: "/media/app-mobile.png",
    alt: "The record on a phone-sized viewport",
    kind: "shot",
  },
  "content-engine": {
    src: "/media/app-studio.png",
    alt: "The Overlay Studio content engine",
    kind: "shot",
  },
  lyceum: {
    src: "/media/app-learn.png",
    alt: "A lesson open in Lyceum",
    kind: "shot",
  },
  "ide-projects": {
    src: "/media/app-ide.png",
    alt: "IDE Projects tracking real work",
    kind: "shot",
  },
  "session-search": {
    src: "/media/app-database.png",
    alt: "The local-first database browser, searching every session",
    kind: "shot",
  },
  conductor: null,
  trace: {
    src: "/media/app-profiler.png",
    alt: "The in-app profiler tracing real frames",
    kind: "shot",
  },
  recordings: {
    src: "/media/app-console.png",
    alt: "A recorded terminal session",
    kind: "shot",
  },
  "context-brain": {
    src: "/media/app-ai.png",
    alt: "The AI Assistant reading the real tracked record",
    kind: "shot",
  },
  "research-digest": null,
  finance: {
    src: "/media/app-finance.png",
    alt: "Finance with real transactions",
    kind: "shot",
  },
  "life-phases": {
    src: "/media/app-life.png",
    alt: "Life — the week, with phases derived from the record",
    kind: "shot",
  },
  marketplace: null,
};

export type AtlasGlyph =
  | "external-tracking"
  | "mobile"
  | "content-engine"
  | "lyceum"
  | "recordings"
  | "screenshots"
  | "ide"
  | "gap-fill"
  | "conductor"
  | "trace"
  | "context-brain"
  | "research-digest"
  | "finance"
  | "life-phases"
  | "marketplace";

export const ATLAS: AtlasInstrument[] = [
  {
    id: "external-tracking",
    name: "External Tracking",
    status: "SHIPPED",
    oneLiner: "Real life gets logged too — manually, or captured live.",
    glyph: "external-tracking",
  },
  {
    id: "screenshots",
    name: "Screenshots",
    status: "SHIPPED",
    oneLiner: "Periodic screenshots filed to sessions, private to the user.",
    glyph: "screenshots",
  },
  {
    id: "mobile-companion",
    name: "Mobile Companion",
    status: "BETA",
    oneLiner: "Your record, glanceable away from the desk. In active build.",
    glyph: "mobile",
  },
  {
    id: "content-engine",
    name: "Content Engine",
    status: "BETA",
    oneLiner: "Sessions become documentation, presentations, visual explainers.",
    glyph: "content-engine",
  },
  {
    id: "lyceum",
    name: "Lyceum",
    status: "SHIPPED",
    oneLiner: "Sessions become lessons that redraw as you grow.",
    glyph: "lyceum",
  },
  {
    id: "ide-projects",
    name: "IDE Projects",
    status: "SOON",
    oneLiner: "Agent sessions and coding time, organized per project.",
    glyph: "ide",
  },
  {
    id: "session-search",
    name: "Gap Fill",
    status: "SHIPPED",
    oneLiner: "Fill untracked gaps with external sessions and activities.",
    glyph: "gap-fill",
  },
  {
    id: "conductor",
    name: "Conductor",
    status: "BETA",
    oneLiner: "One brief in, parallel sub-agents out, full trace back.",
    glyph: "conductor",
  },
  {
    id: "trace",
    name: "Trace",
    status: "SHIPPED",
    oneLiner: "Every agent decision recorded, replayable, scored.",
    glyph: "trace",
  },
  {
    id: "recordings",
    name: "Recordings",
    status: "SHIPPED",
    oneLiner: "Auto-captured session recordings. Filed to their sessions, private to the user.",
    glyph: "recordings",
  },
  {
    id: "context-brain",
    name: "Context Brain",
    status: "BETA",
    oneLiner: "A self-expanding memory graph your agents share.",
    glyph: "context-brain",
  },
  {
    id: "research-digest",
    name: "Research Digest",
    status: "VISION",
    oneLiner: "Papers and feeds distilled into your knowledge base.",
    glyph: "research-digest",
  },
  {
    id: "finance",
    name: "Finance",
    status: "SHIPPED",
    oneLiner: "Cash flow and net worth, tracked automatically.",
    glyph: "finance",
  },
  {
    id: "life-phases",
    name: "Life Phases",
    status: "SHIPPED",
    oneLiner: "Your months as visible phases, not blur.",
    glyph: "life-phases",
  },
  {
    id: "marketplace",
    name: "Marketplace",
    status: "VISION",
    oneLiner: "Build instruments inside RHEO; ship them to everyone.",
    glyph: "marketplace",
  },
];
