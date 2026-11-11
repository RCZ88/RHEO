# RESULT.md — landing-actrecord-rhythm-09112026 (v1.0)

Implements RESULT v3.0 §3 (D6 fabrication fix) + page rhythm. Scope unchanged: IN = ActRecord derivations, page rhythm; OUT = DB, IPC, Netlify.

## §0 — First Question, answered

1. **Counters do not break — the hour-index does.** Every derived card has exactly one scalar: its `minutes`. The per-frame `counterRefs` mechanic only ever needed a target number; change the target source (`BLOCKS[i].total` → `cards[i].minutes`), keep the machinery. The real casualty is `activeIndexFromHour()` — delete it and map scrub progress to the index directly (§1.3).
2. **LINE_PATH: none of (a)/(b)/(c) — keep it a module-level const and derive its right-hand side.** (b) is possible: `getStaticProps` is Pages-Router legacy and irrelevant in App Router; a JSON `import` is bundled at build time in client components — no fetch, no state, no `useEffect`, no loading states. The const keeps its identifier; only the value changes (§2).
3. **Rhythm: audit all five sections, one pass, one rule set.** Three values are already divergent (ActRecord `pt-12/pb-12`, Download `pt-24 sm:pt-32`, tokens 96/128) with two unknowns — you cannot define the rule from a partial vector, and the marginal cost of the full pass is zero (§4).

## §1 — D6a: derived cards

### 1.1 Schema

```ts
export type DerivedCard = {
  id: string;              // 'top' | 'second' | 'third' | 'quiet'
  label: string;           // 'IDE' | 'BROWSER' | 'AI TOOLS' | 'QUIET'
  minutes: number;         // counter target
  shareOfActive: number;   // 0..1 — of recorded activity (derived denominator)
  anchorStart: number;     // minute-of-day, linear (no wrap)
  anchorEnd: number;       // exclusive end
  anchorLabel: string;     // '09:12 → 10:03'
  runs: number;            // contiguous sessions (category cards)
  detail: string;          // templated blurb, real numbers only
};
```

### 1.2 Derivation rules

1. **Ranking** over samples with recorded activity, **excluding `Uncategorized`** (unmapped noise — same ruling as the facts line). Expected on current data: IDE 187 → Browser 111 → AI Tools 99.
2. **minutes** = sample count in category (1,440 samples/day = 1 sample = 1 min). QUIET **minutes** = length of the longest contiguous null run. The asymmetry is intentional and must stay copy-explicit.
3. **anchor** (category cards) = bounds of that category's **longest contiguous run** (ties → earliest).
4. **QUIET** = longest run of consecutive samples with nothing recorded (`app === null`), **linear scan, no midnight wrap** — the record is one linear day; 00:00–06:00 and 23:00–24:00 nulls are separate runs in-record. Ties → earliest.
5. **Order**: rank desc by minutes, **QUIET pinned last as the coda** — its length would otherwise sort first and destroy the "three acts, then silence" shape.
6. **Copy honesty rule**: headline counter = total minutes; the range line is the longest run, always prefixed *"longest stretch"*. QUIET renders the bare range. **Never render an unlabeled range + total pair** — that juxtaposition implies continuity, which is the fabrication being removed.

### 1.3 Scrub mapping (replaces `activeIndexFromHour`)

```ts
const beats = DERIVED_CARDS.length;   // +1 if the dashboard is its own crossfade beat [VERIFY R1]; if so, dashboard goes LAST as the summary beat
const activeIndex = Math.min(beats - 1, Math.floor(progress * beats));
```

The scrub already produces `progress ∈ [0,1]`; the hour lookup was a BLOCKS-era indirection. Cutting it removes a coupling rather than adding one. The 300vh/sticky geometry is untouched.

### 1.4 Counters

- Target = `card.minutes`. Secondary stat = `(card.shareOfActive * 100).toFixed(0)` labeled *"of recorded activity"* (denominator = derived non-null count — **never `summary.*`**; expected 187/515 = 36%, 111/515 = 22%, 99/515 = 19%).
- prm (`prefers-reduced-motion`): counters set their final value immediately, no rAF ramp. [VERIFY R1: reuse the file's existing prm check if present; else `matchMedia`]

### 1.5 Optional anchor band [OPTIONAL — strip for a minimal diff; recommended]

With ranked cards the chart loses its chronological link to the cards. One overlay div over the plot area, retargeted on index change:

```tsx
<div aria-hidden
  className="anchor-band"
  style={{ transform: `translateX(${card.anchorStart / 14.4}%) scaleX(${(card.anchorEnd - card.anchorStart) / 1440})` }} />
```

```css
.anchor-band {
  position: absolute; inset: 0; transform-origin: 0 50%;
  background: rgba(255,255,255,0.04);
  transition: transform 400ms cubic-bezier(0.16,1,0.3,1);
}
@media (prefers-color-scheme: dark) { .anchor-band { background: rgba(0,0,0,0.24); } }
@media (prefers-reduced-motion: reduce) { .anchor-band { transition: none; } }
```

Same transform list interpolates per-component → the band slides and stretches, transform-only. **Fill only, no hairline borders** — 1px borders inside a `scaleX(0.035)` element compress to invisibility; do not add them back. Linear-only anchors ⇒ always exactly one band. The div needs a `position:relative` wrapper around the chart [VERIFY R1: dashboard card structure].

## §2 — D6b: `landing/src/lib/day.ts` (paste-ready)

```ts
// Single source of truth for every number ActRecord renders.
// Build-time derivation via JSON import (bundled; no runtime fetch).
// Replaces: BLOCKS, BLOCKS_WITH_TEXT, LINE_PATH, AREA_PATH.
import raw from "../../public/data/sample-day.json";

export interface Sample {
  // [VERIFY R4a/R4b] Align field names with the real JSON.
  minute: number;           // 0..1439
  app: string | null;       // null = nothing recorded that minute
  category: string | null;  // 'IDE' | 'Browser' | ... | 'Uncategorized' | null
  intensity: number;        // 0..1 — if absent, switch the one marked line in deriveHourly()
}
export const SAMPLES = raw.samples as Sample[]; // [VERIFY R4d: top-level key]

const hasApp = (s: Sample) => s.app !== null;                  // recorded activity (incl. Uncategorized)
const rankable = (s: Sample) => hasApp(s) && s.category !== "Uncategorized";
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// ── cards ─────────────────────────────────────────────────────────────
export type DerivedCard = { /* §1.1 fields */ } ;

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
    prevCat = cat; // non-rankable samples break runs
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
  return best; // linear, no midnight wrap; ties → earliest
}

// ── line path ─────────────────────────────────────────────────────────
function deriveHourly(samples: Sample[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const s of samples) buckets[Math.floor(s.minute / 60)] += s.intensity ?? 0; // ← if no intensity field: count hasApp per bucket instead
  return buckets.map((v) => v / 60); // both formulas live in 0..1
}

export function deriveLinePath(samples: Sample[], W: number, H: number): string {
  return deriveHourly(samples)
    .map((y, i) => `${i === 0 ? "M" : "L"} ${+(i * (W / 23)).toFixed(2)} ${+(H * (1 - y)).toFixed(2)}`)
    .join(" ");
}
export function deriveAreaPath(samples: Sample[], W: number, H: number): string {
  return `${deriveLinePath(samples, W, H)} L ${W} ${H} L 0 ${H} Z`;
}

// ── module-scope derived consts (build time; identifiers match the old
//    hardcoded consts so the ActRecord diff stays minimal) ─────────────
export const LINE_PATH = deriveLinePath(SAMPLES, 1000, 320);      // [VERIFY R1: W/H = current dashboard viewBox]
export const AREA_PATH = deriveAreaPath(SAMPLES, 1000, 320);
export const DERIVED_CARDS = deriveCards(SAMPLES);
export const TOP_CATEGORY = { label: DERIVED_CARDS[0]?.label ?? "—", minutes: DERIVED_CARDS[0]?.minutes ?? 0 };

// ── realness probes (dev only) ────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const top = DERIVED_CARDS[0];
  console.assert(top.minutes === SAMPLES.filter((s) => s.category === top.label).length, "D6 probe: top card mismatch");
  console.assert(DERIVED_CARDS[0].minutes >= DERIVED_CARDS[1].minutes, "D6 probe: rank order broken");
  const q = DERIVED_CARDS[DERIVED_CARDS.length - 1];
  console.assert(q.anchorEnd - q.anchorStart === q.minutes, "D6 probe: quiet run length mismatch");
  console.assert((LINE_PATH.match(/L/g) ?? []).length === 23, "D6 probe: LINE_PATH ≠ 24 points");
}
```

Notes:
- Fixed scale `y ∈ [0,1]`, no per-day normalization — normalization rescales per dataset and buys shape drama over truth.
- Plain polyline, `stroke-linejoin: round`. Catmull-Rom through the same 24 points is *permitted* if the polyline reads jagged — rendering choice, not fabrication (CZ visual call).
- `resolveJsonModule` is on in Next's default tsconfig — one-line add if missing. Import path `../../public/data/sample-day.json` keeps **one file**; it is still served at `/data/sample-day.json` for runtime consumers. ES imports dedupe: everyone imports from `day.ts`, one bundled copy.
- The probes deliberately never read `summary.*` — recorded count (515) vs `summary.minutes_with_activity` (321) stays on the data-source ledger, not this thread.

## §3 — ActRecord.tsx edit list (symbol-keyed)

- **E1** Delete `BLOCKS` and `BLOCKS_WITH_TEXT` consts entirely. [VERIFY: definition lines]
- **E2** Add `import { LINE_PATH, AREA_PATH, DERIVED_CARDS } from "@/lib/day";` (or relative path per repo convention [VERIFY R2]). JSX identifiers unchanged.
- **E3** Delete `activeIndexFromHour` and every hour-derived helper that only served it; insert §1.3 mapping at its call site(s). [VERIFY: all references]
- **E4** Counter loop: target `card.minutes`; secondary `shareOfActive`; prm per §1.4. [VERIFY: counterRefs loop shape]
- **E5** Card JSX binds `label / minutes / anchorLabel / detail`; copy rule §1.2.6.
- **E6** Section wrapper `pt-12 pb-12` → `pt-0 pb-0` (scrub sections carry no vertical padding — §4).
- **E7** [OPTIONAL] Anchor band per §1.5.
- **E8** Fabrication sweep after E1–E5: `rg -n 'BLOCKS|DEEP WORK|MEETINGS|LEARNING' landing/src/components/rheo/ActRecord.tsx` → **0 hits**.

## §4 — RR: page rhythm

**Rule set** (adopt existing tokens; no new tokens):

| Section | Type | padding-top | padding-bottom | margins |
|---|---|---|---|---|
| Hero | flow (exempt if full-viewport opener — min-height governs [VERIFY R3]) | `var(--section-pt)` / lg `--section-pt-lg`, unless exempt | 0 | none |
| ActRecord | scrub | **0** | **0** | none |
| Gallery | flow | token 96 / lg 128 | 0 | none |
| ActUnderstand | flow | token 96 / lg 128 | 0 | none |
| Download | flow (last) | token 96 / lg 128 | `var(--section-pt)` closing — or 0 if a footer follows [VERIFY R2] | none |

Gap between neighbors = the following section's pt, paid exactly once, never doubled. All spacing via padding; **section margins forbidden**.

- **ActRecord 0/0 [VERIFY]**: visual check on sticky engage/release after zeroing; if engage feels abrupt, a single 24px lead-in is the sanctioned, documented exception — nothing ad-hoc.
- Horizontal: audit only — confirm all five content containers share one max-width + horizontal padding pair; no changes expected.

**Adjacent finding (separate commit, not rhythm)**: globals.css radius tokens read **6/10/16** but the current LAMINAR package spec is **8/12/16**, and `Download.tsx` stage already hardcodes `borderRadius: 12` — the migration is half-landed and the codebase is mixed-scale, which is worse than either. Fix: tokens 6→8, 10→12 (16 unchanged); sweep `rg -n 'rounded-(sm|md)\b|borderRadius:\s*(6|10)\b' landing/src`. [CONFIRM-CZ: 8/12/16 stands per the accepted latest package]

## §5 — Acceptance gates

- **A1** Protocol: `tsc --noEmit` + esbuild pass.
- **A2** `next dev`: all four D6 probes silent in console.
- **A3** Scrub walkthrough (300vh): crossfades at quarters; counters tick 0→187 / 111 / 99 / quiet-len; band retargets (if E7); chart draws; sticky engage/release clean after E6.
- **A4** Negative test (two-step): in a dev copy, null out three IDE samples → top card reads 184 with recomputed runs/anchor; restore → 187. Distinguishes derivation from hardcode.
- **A5** prm: counters land instantly; band static; no new motion paths.
- **A6** NOT-list regression: no auto-advance, no springs, transform/opacity only (counters are text content — exempt).
- **A7** E8 sweep returns 0 hits.

## §6 — Ledger (out of scope, carried)

- `summary.top_category = "Uncategorized"` / `top_category_minutes = 3987` — export script bug, CZ data-source ledger.
- Recorded-sample count 515 vs `summary.minutes_with_activity` 321 — unresolved; this thread derives its own denominator and never reads `summary.*`.
- `bug_reports` ↔ feedback bridge — deferred, DB/app changes out of scope.

## §7 — Open gates → resolvers

| Gate | Resolves | Via |
|---|---|---|
| [VERIFY R1] ActRecord internals: BLOCKS lines, counterRefs loop, activeIndexFromHour call sites, dashboard beat structure + viewBox, existing prm check | E1–E7 anchors, beats N, W/H | CONTEXT (full file) or CZ in-editor |
| [VERIFY R2] page.tsx + footer presence | RR table Download row | CONTEXT or CZ |
| [VERIFY R3] Hero/Gallery/ActUnderstand/Download roots | RR table + Hero exemption | CONTEXT or CZ |
| [VERIFY R4] sample shape (null representation, intensity field, top-level keys), runtime-fetch grep | Sample interface, deriveHourly formula line | CONTEXT or CZ |

`day.ts` is fully specified and buildable now — CZ can start there immediately; nothing above can change its structure except the R4 field names.
