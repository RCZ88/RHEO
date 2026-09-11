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
  | "resume"
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
    id: "resume",
    name: "Resume",
    status: "SHIPPED",
    oneLiner: "Your tracked work becomes an honest resume.",
    glyph: "resume",
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
