// Single source of truth for every number ActRecord renders.
// Build-time derivation via JSON import (bundled; no runtime fetch).
// Replaces: BLOCKS, BLOCKS_WITH_TEXT, LINE_PATH, AREA_PATH.

import raw from "../../public/data/sample-day.json";

export interface Sample {
  minute: number;           // 0..1439
  intensity: number;        // 0..1
  category: string | null;  // null = nothing recorded that minute
}

export const SAMPLES = raw.samples as Sample[];

const hasApp = (s: Sample) => s.category !== null;
const rankable = (s: Sample) => hasApp(s) && s.category !== "Uncategorized";

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ── cards ─────────────────────────────────────────────────────────────
export type DerivedCard = {
  id: string;
  label: string;
  minutes: number;
  shareOfActive: number;
  anchorStart: number;
  anchorEnd: number;
  anchorLabel: string;
  runs: number;
  detail: string;
};

interface CatStat { count: number; runs: number; bestStart: number; bestEnd: number; bestLen: number; curStart: number; curLen: number; }

export function deriveCards(samples: Sample[]): DerivedCard[] {
  const stats = new Map<string, CatStat>();
  let prevCat: string | null = null;
  for (const s of samples) {
    const cat = rankable(s) ? s.category : null;
    if (cat) {
      const st = stats.get(cat) ?? { count: 0, runs: 0, bestStart: 0, bestEnd: 0, bestLen: 0, curStart: s.minute, curLen: 0 };
      st.count += 1;
      if (prevCat !== cat) { st.runs += 1; st.curStart = s.minute; st.curLen = 0; }
      st.curLen += 1;
      if (st.curLen > st.bestLen) { st.bestLen = st.curLen; st.bestStart = st.curStart; st.bestEnd = s.minute + 1; }
      stats.set(cat, st);
    }
    prevCat = cat;
  }
  const ranked = [...stats.entries()].sort((a, b) => b[1].count - a[1].count || a[1].bestStart - b[1].bestStart);
  const recorded = samples.filter(hasApp).length;
  const quiet = longestNullRun(samples);
  const mk = (id: string, label: string, st: CatStat): DerivedCard => ({
    id, label, minutes: st.count,
    shareOfActive: recorded > 0 ? st.count / recorded : 0,
    anchorStart: st.bestStart, anchorEnd: st.bestEnd,
    anchorLabel: `${hhmm(st.bestStart)} → ${hhmm(st.bestEnd)}`,
    runs: st.runs,
    detail: `${label} — ${st.count} min across ${st.runs} session${st.runs === 1 ? "" : "s"} · longest stretch ${hhmm(st.bestStart)} → ${hhmm(st.bestEnd)}`,
  });
  const cards = ranked.slice(0, 3).map(([label, st], i) => mk(["top", "second", "third"][i], label, st));
  cards.push({
    id: "quiet", label: "QUIET", minutes: quiet.len, shareOfActive: 0,
    anchorStart: quiet.start, anchorEnd: quiet.end,
    anchorLabel: `${hhmm(quiet.start)} → ${hhmm(quiet.end)}`, runs: 1,
    detail: `No input recorded for ${quiet.len} min — ${hhmm(quiet.start)} → ${hhmm(quiet.end)}`,
  });
  return cards;
}

function longestNullRun(samples: Sample[]) {
  let best = { start: 0, end: 0, len: 0 }, curStart = -1;
  for (const s of samples) {
    if (!hasApp(s)) {
      if (curStart < 0) curStart = s.minute;
      const len = s.minute + 1 - curStart;
      if (len > best.len) best = { start: curStart, end: s.minute + 1, len };
    } else curStart = -1;
  }
  return best;
}

// ── line path ─────────────────────────────────────────────────────────
function deriveHourly(samples: Sample[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const s of samples) buckets[Math.floor(s.minute / 60)] += s.intensity;
  return buckets.map((v) => v / 60);
}

export function deriveLinePath(samples: Sample[], W: number, H: number): string {
  return deriveHourly(samples)
    .map((y, i) => `${i === 0 ? "M" : "L"} ${+(i * (W / 23)).toFixed(2)} ${+(H * (1 - y)).toFixed(2)}`)
    .join(" ");
}
export function deriveAreaPath(samples: Sample[], W: number, H: number): string {
  return `${deriveLinePath(samples, W, H)} L ${W} ${H} L 0 ${H} Z`;
}

// ── module-scope derived consts ──────────────────────────────────────
export const LINE_PATH = deriveLinePath(SAMPLES, 392, 140);
export const AREA_PATH = deriveAreaPath(SAMPLES, 392, 140);
export const DERIVED_CARDS = deriveCards(SAMPLES);

// ── realness probes (dev only) ────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const top = DERIVED_CARDS[0];
  console.assert(top.minutes === SAMPLES.filter((s) => s.category === top.label).length, "D6 probe: top card mismatch");
  console.assert(DERIVED_CARDS[0].minutes >= DERIVED_CARDS[1].minutes, "D6 probe: rank order broken");
  const q = DERIVED_CARDS[DERIVED_CARDS.length - 1];
  console.assert(q.anchorEnd - q.anchorStart === q.minutes, "D6 probe: quiet run length mismatch");
  console.assert((LINE_PATH.match(/L/g) ?? []).length === 23, "D6 probe: LINE_PATH ≠ 24 points");
}

export { hasApp, rankable, hhmm };
