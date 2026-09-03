/**
 * Atlas data — the 14-instrument catalogue for RHEO section S9 "THE ATLAS".
 * Names, statuses, and one-liners are VERBATIM per spec; do not inflate a status.
 */

export type AtlasStatus = "SHIPPED" | "BETA" | "SOON" | "VISION";

export type AtlasInstrument = {
  id: string;
  index: number; // 1..14
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
  | "ide"
  | "session-search"
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
    index: 1,
    name: "External Tracking",
    status: "SHIPPED",
    oneLiner: "Real life gets logged too — manually, or captured live.",
    glyph: "external-tracking",
  },
  {
    id: "mobile-companion",
    index: 2,
    name: "Mobile Companion",
    status: "BETA",
    oneLiner: "Your record, glanceable away from the desk. In active build.",
    glyph: "mobile",
  },
  {
    id: "content-engine",
    index: 3,
    name: "Content Engine",
    status: "BETA",
    oneLiner: "Sessions become documentation, presentations, visual explainers.",
    glyph: "content-engine",
  },
  {
    id: "lyceum",
    index: 4,
    name: "Lyceum",
    status: "SHIPPED",
    oneLiner: "Sessions become lessons that redraw as you grow.",
    glyph: "lyceum",
  },
  {
    id: "ide-projects",
    index: 5,
    name: "IDE Projects",
    status: "SOON",
    oneLiner: "Agent sessions and coding time, organized per project.",
    glyph: "ide",
  },
  {
    id: "session-search",
    index: 6,
    name: "Gap Fill",
    status: "SHIPPED",
    oneLiner: "Fill untracked gaps with external sessions and activities.",
    glyph: "gap-fill",
  },
  {
    id: "conductor",
    index: 7,
    name: "Conductor",
    status: "BETA",
    oneLiner: "One brief in, parallel sub-agents out, full trace back.",
    glyph: "conductor",
  },
  {
    id: "trace",
    index: 8,
    name: "Trace",
    status: "SHIPPED",
    oneLiner: "Every agent decision recorded, replayable, scored.",
    glyph: "trace",
  },
  {
    id: "context-brain",
    index: 9,
    name: "Context Brain",
    status: "BETA",
    oneLiner: "A self-expanding memory graph your agents share.",
    glyph: "context-brain",
  },
  {
    id: "research-digest",
    index: 10,
    name: "Research Digest",
    status: "VISION",
    oneLiner: "Papers and feeds distilled into your knowledge base.",
    glyph: "research-digest",
  },
  {
    id: "resume",
    index: 11,
    name: "Resume",
    status: "SHIPPED",
    oneLiner: "Your tracked work becomes an honest resume.",
    glyph: "resume",
  },
  {
    id: "finance",
    index: 12,
    name: "Finance",
    status: "SHIPPED",
    oneLiner: "Cash flow and net worth, tracked automatically.",
    glyph: "finance",
  },
  {
    id: "life-phases",
    index: 13,
    name: "Life Phases",
    status: "SHIPPED",
    oneLiner: "Your months as visible phases, not blur.",
    glyph: "life-phases",
  },
  {
    id: "marketplace",
    index: 14,
    name: "Marketplace",
    status: "VISION",
    oneLiner: "Build instruments inside RHEO; ship them to everyone.",
    glyph: "marketplace",
  },
];
