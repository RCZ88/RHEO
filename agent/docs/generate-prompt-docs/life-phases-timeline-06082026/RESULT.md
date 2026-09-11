# LIFE PHASES TIMELINE — Design & Implementation Spec
**Gold Page · `src/features/warmth/gold/` · component family: `LifeRiver`**

> **Build note (sourcing honesty):** This session has no live MCP tool channel, so every component below is pinned to the **verified inventory in CONTEXT_BUNDLE §9** — nothing is assigned that isn't on those lists. The implementing agent must still *fetch real registry source* via the `shadcn` / `magicui` / `reactbits` MCP servers before coding, and verify every icon name via `lucide` search. The color scheme in §3 is specified as the exact **seed + expected output** for `google-design → generate_color_scheme` (run it once at build time; the hex below are the accepted result).

---

## 1 · DELIVERABLE #1 — THE CONCEPT

### **The River of Years** *(component name: `LifeRiver`)*

One continuous river flows left → right across the Gold page. Each life phase is a **reach** of water: its **length is its duration** (months × px/month — honest, zoomable), its **width is its magnitude**. Reaches join at glowing junctions; tributary threads arc between non-adjacent phases that shaped each other; the current reach dissolves into **open water** — the unwritten future.

**Why this metaphor and no other:** the app is literally called *RHEO / DeskFlow* — from *rheo*, "to flow." Water is the one substance that makes "nothing is permanent" physically true: every reach is the same river and never the same water. Duration and magnitude map to the two spatial dimensions of a river (length, width) with zero abstraction, so *area = duration × magnitude* falls out for free. Causality is literal hydrology — upstream feeds downstream. And a river has a natural way to face the future: it doesn't end at a wall, it opens into a sea. Mountains encode height-as-importance (a rank tier in disguise); orreries destroy the shared time axis the future app-history layer needs; the river keeps a single linear time axis — which is exactly what the second data layer (usage-time, feature launches) will plot against.

**Requirement → physics:**

| Requirement | River physics |
|---|---|
| Duration | reach length = `months × pxPerMonth` |
| Magnitude | reach width = `28 + (magnitude/100) × 84` px |
| Finite / impermanent | every reach ends at an **Amber Seam**; fill fades at the edges |
| Interconnection | seams (adjacent hand-off) + **Tributary threads** (annotated influence, `connections[]`) |
| Open future | current reach dissolves past *now* into dashed coastline + empty dark ("open water") |

**Layout diagram:**

```
THE RIVER OF YEARS — full-width glass panel, sibling of TheVault
┌──────────────────────────────────────────────────────────────────────────────┐
│ ① SUMMARY STRIP:  serif-italic one-paragraph life story …          [⟳]      │
│                  Phases 7   Years flowed 24   Day 213 of "The Climb"        │
├──────────────────────────────────────────────────────────────────────────────┤
│        width ∝ magnitude                  length ∝ months                    │
│                                                                              │
│          ╭──────────╮   ╭──────────────────────────╮   ╭─────────╮          │
│  source ●≈┤ Childhood ├──◤AMBER SEAM◥─┤  The Long Study ├─◤SEAM◥─┤ NOW ▸▸▸ ┊ ┊ ┊ │
│          ╰──────────╯   ╰──────────────────────────╯   ╰─────────╯          │
│             ╰─── tributary thread (arc, gradient stroke) ───╯                │
│  ●  ● milestones sit inside the water as glow-points                         │
│  ─2001───2005────2010────2015────2020────2025──▶  mono time ruler      ┊=open│
│  [ZoomOut −] [ZoomIn +] [Fit all ⌖] [Scroll-to-Now ◎]                        │
└──────────────────────────────────────────────────────────────────────────────┘
   horizontal scroll · zoom = decades ↔ months · future layer slots below river
```

---

## 2 · DELIVERABLE #2 — THE TEN UI SURFACES

### 2.1 The Timeline hero — `RiverCanvas` *(the ONE custom primitive)*
- Full-width glass panel (`bg-zinc-900/50 backdrop-blur-xl border-zinc-800/50 rounded-xl p-5`), horizontally scrollable SVG, height ≈ 300px.
- **Zoom:** four stops — `FIT` (auto px/month clamped 0.6–3), `YEAR` (~2.5px/mo), `SEASON` (~6), `MONTH` (~14). Buttons: `shadcn button ghost icon` + `lucide ZoomOut / ZoomIn / Maximize2 / Compass` (scroll-to-now). Zoom keeps *now* anchored (recompute `scrollLeft`).
- **Ruler:** decade ticks always; year ticks at `pxPerYear ≥ 40`; month ticks in MONTH zoom. Labels JetBrains Mono 11px `#a1a1aa`.
- **Now marker:** vertical amber hairline + pulsing dot (opacity keyframe) at current month.
- **Future layer slot (design-aware):** SVG reserves a `<SedimentBand y=riverBottom+8>` group; `riverMath.timeToX(date)` is shared so app-history markers + usage-time heat drop in later with zero rebuild. Not built now.
- Entrance: `reactbits ScrollReveal` (translate-y 12px + opacity, 400ms). Ambient background: `reactbits Aurora` at **≤ 6% opacity**, warmth hues only, disabled under reduced motion.
- Keyboard/reduced-motion: `←/→` scroll, `+/−` zoom; all pulses off under `prefers-reduced-motion`.

### 2.2 Phase node (inline, at rest + hover)
- **At rest:** glass pill label above (or inside, if reach is tall) each reach — title (Space Grotesk 500 13px), date range `MMM YYYY → MMM YYYY` (JetBrains Mono 11px). Magnitude is *already* visible as width; no redundant badge. Milestones render as glow-dots inside the water.
- **Hover/focus:** an overlay highlight layer fades in (opacity only) brightening the reach; `shadcn tooltip` shows: title, exact range, computed duration ("4 yrs 3 mo"), magnitude word (Quiet/Steady/Defining/Seismic), category.
- The whole reach is a focusable `role="button"` (`tabIndex=0`, Enter opens drawer); invisible hit-rect guarantees ≥ 44px tap height even on thin reaches.

### 2.3 Phase detail view — **right side-drawer** (justification)
A drawer keeps the river visible, so the user never loses the spatial context of the chapter they're reading — a modal would sever the metaphor. Built from `shadcn sheet` (fetch from registry; fallback: `shadcn dialog` primitives re-anchored right). Slide = transform 300ms; overlay `zinc-950/60`.
Content, top → bottom, separated by `shadcn separator`:
1. **Header:** title (Space Grotesk 600 18px), `shadcn badge` in category tone, mono date range, duration line.
2. **Magnitude meter:** 0–100 bar in category ramp + word label.
3. **Description** (Inter 14px/1.55).
4. **Milestones:** list, mono dates; inline add.
5. **AI Reflection card** (§2.4).
6. **Era Trends card** (§2.5).
7. **Tributaries:** "flows into →" chips of connected phases + `shadcn select` to add/remove links; renders/updates threads on the canvas.
8. **Actions:** Edit (opens §2.7 dialog), Delete — **two-step arm, 3s**, identical pattern to TheVault.

### 2.4 AI Reflection panel — guided flow
`reactbits Stepper` (3 steps) inside the drawer card:
- Steps 1–3: one question each, generated client-side from category templates, e.g. *"What did this chapter carry into the next one?"* — answers in `shadcn textarea` (fetch from registry).
- Step 4: **Weave** — `magicui shimmer-button` (small container only, respects border-beam warning) → calls `lifePhase:aiReflect`.
- **Loading:** `shadcn skeleton` paragraph + pulsing `lucide Sparkles` (sky accent).
- **Result:** first-person narrative, Source Serif 4 italic 15px/1.65, ends with a forward line tying into the next phase. Autosaves to `reflection`.
- **Error:** `shadcn alert` (clay border), keep answers, `Retry` + `lucide RefreshCw` regenerate always available.

### 2.5 Era Trends sidecard
Lives in the drawer (and a mini version in the canvas tooltip: top single trend). Three rows with icons (verified lucide): `History` → **World**, `Feather` → **Culture**, `TrendingUp` → **Your field**. Two one-line items each, JSON from `lifePhase:aiEraTrends`. Loading: 3 skeleton rows. Error: clay alert + retry. Header row carries `lucide Sparkles` in sky = "AI voice" marker (consistent AI accent everywhere).

### 2.6 Timeline Summary header
- Left: one-paragraph AI life story in **Source Serif 4 italic**, max ~80 words, from `lifePhase:aiSummarize`; fallback before first run: *"— your story, as it's flowing now."*
- Right: stat block — **Phases**, **Years flowed**, **Day N of current phase** — using `magicui number-ticker` (or `reactbits CountUp`).
- `RefreshCw` regenerate button (spins while loading, 3 skeleton lines beneath during generation, clay alert on failure, last-good text retained).

### 2.7 Add/Edit phase flow — `shadcn dialog`
Fields: Title (`input`) · Category (`select` with tone swatch dots) · Start month/year (`select` ×2) · **Ongoing** (`switch`) or End month/year (`select` ×2) · **Magnitude slider** (`shadcn slider`, fetch from registry; 0–100 with live word: Quiet / Steady / Defining / Seismic) · Description (`textarea`) · Milestones inline add.
Validation: end ≥ start; only one ongoing phase allowed (the latest) — otherwise inline error text, dialog stays open. On save: dialog closes, new reach **flows in** (scale-x from seam + opacity, 400ms) and **The Breath** (§3.3) ripples downstream.

### 2.8 Empty state — `EmptyRiver`
A faint dashed riverbed crosses the panel; at the left, a small pulsing source — `reactbits Orb` (or `magicui particles`, tiny container). Serif italic caption: **"Every river begins as a spring."** Primary CTA: `magicui shimmer-button` *"Spring your first phase"* → opens §2.7. No fake data, no decoration beyond this.

### 2.9 Loading states (every async surface)
| Surface | Skeleton |
|---|---|
| Initial phase fetch | `shadcn skeleton` bars shaped like a river silhouette (varying widths/heights) + ruler strip |
| Summary generation | 3 text-line skeletons |
| Reflection weave | paragraph skeleton + Sparkles pulse |
| Era trends | 3 row skeletons |
| Save in flight | button spinner state (`lucide RefreshCw` spin) |

### 2.10 Error states
- **AI failure** (any of 3 endpoints): clay-toned `alert`, message in plain words, `Retry` — last-good content kept.
- **Save/delete failure:** inline alert inside dialog/drawer; form state preserved; nothing optimistic is lost.
- **Initial fetch failure:** section-level `alert` + `lucide RefreshCw` reload button; the rest of Gold page unaffected.
- Contract everywhere: `{ ok: true, data } | { ok: false, error }` — renderer branches on `ok`.

---

## 3 · DELIVERABLE #3 — COLOR SCHEME & SIGNATURE

### 3.1 Scheme (seeded into `google-design.generate_color_scheme`)
**Seed input:** `#fbbf24, #e8866b, #6fb38f, #5ab0c9, #f7f3ee` on `#09090b`. Accepted output:

**Base**
| Token | Hex | Use |
|---|---|---|
| Background | `#09090b` | page |
| Raised surface | `#18181b` | chips, meters |
| Panel | `zinc-900/50` + blur | glass recipe |
| Border | `rgb(39 39 42 / .6)` | glass edges |
| Text primary | `#f7f3ee` (glow) | headings, body |
| Text secondary | `#a1a1aa` | captions ≥ 4.5:1 |
| Riverbed | `#101013` | channel behind reaches |

**Category → warmth tone**
| Category | Tone | Hex |
|---|---|---|
| Foundations (family, childhood) | Clay | `#e8866b` |
| Growth (learning, education) | Sage | `#6fb38f` |
| Craft (work, ambition) | Amber | `#fbbf24` |
| People (relationships) | Sky | `#5ab0c9` |
| Self (health, inner life) | Pearl | `#f7f3ee` (rendered ~85%) |
| Threshold (liminal/transitions) | Ash | `#71717a` |

**Magnitude intensity ramp** — per category, 3 stops; reach fill interpolates by magnitude (bigger = brighter/warmer):
| Category | m 0–24 | m 25–74 | m 75–100 |
|---|---|---|---|
| Amber | `#6b5313` | `#fbbf24` | `#fac44a` |
| Clay | `#7a4636` | `#e8866b` | `#f2a98f` |
| Sage | `#3a5d4a` | `#6fb38f` | `#93c9ab` |
| Sky | `#2f5a68` | `#5ab0c9` | `#83c6d9` |
| Pearl | `#6e6a63` | `#cfc9bf` | `#f7f3ee` |

**Special roles**
- **Current phase:** amber core `#fbbf24`, shoreline dissolve `#fbbf24 → transparent`, coastline dashes `#f7f3ee` @ 50%.
- **Interconnection:** seam gradient `#fbbf24 → #f7f3ee`; tributary stroke = source-tone @ 45% → target-tone @ 45%.
- **AI accent:** Sky `#5ab0c9` (Sparkles icons, reflection card border, shimmer) — the cool "machine voice" inside the warm water.
- **Error tone:** Clay `#d96846` borders on `alert`.

### 3.2 Typography scale (3 families + app's existing mono utility)
| Role | Family | Size/leading |
|---|---|---|
| Section title | Space Grotesk 600 | 20px / 1.3 |
| Stat numbers | Space Grotesk 600 (tabular) | 26px |
| Reach label | Space Grotesk 500 | 13–14px |
| Body / forms | Inter | 14px / 1.55 |
| Caption + AI narrative | Source Serif 4 *italic* | 13.5–15px / 1.65 |
| Dates, ticks | JetBrains Mono (utility token already in app) | 11–12px, `#a1a1aa` |

### 3.3 Signature elements (the screenshot moments) — named
1. **The Amber Seam** — a glowing `#fbbf24→#f7f3ee` hairline with a tiny downstream ripple at every junction. Finiteness and hand-off in one mark.
2. **The Magnitude Wake** — a soft radial glow beneath each reach, radius ∝ magnitude (SVG blur, low opacity — *not* box-shadow).
3. **The Breath** — on every save, a one-time opacity/spacing pulse ripples downstream through all reaches (400ms, transform/opacity only). The timeline visibly *inhales* when your life changes.
4. **Open Water** — the current reach dissolves past *now* into animated dashed coastline facing right; the future is dark, gridded (faint `reactbits DotGrid`), unwritten.
5. **Tributaries** — arcing gradient threads for user-annotated causality.

---

## 4 · MCP SOURCING TABLE (element → server → component)

| UI element | Server | Component | Notes |
|---|---|---|---|
| River geometry | — | **custom SVG (`riverMath`)** | the one allowed custom primitive |
| Panel chrome | shadcn | `card` (re-skinned glass) | |
| Detail drawer | shadcn | `sheet` (fetch; fallback `dialog`) | |
| Add/Edit dialog | shadcn | `dialog`, `input`, `select`, `switch`, `textarea`, `slider`, `button`, `label` | textarea+slider fetched |
| Reach tooltip | shadcn | `tooltip` | |
| Category chips | shadcn | `badge` | |
| Drawer sections | shadcn | `separator`, `collapsible` (milestones) | |
| Loading everywhere | shadcn | `skeleton` | |
| Errors everywhere | shadcn | `alert` | clay re-skin |
| Milestone/tributary pickers | shadcn | `select` | |
| Stat numbers | magicui | `number-ticker` | |
| Primary CTAs ("Spring", "Weave") | magicui | `shimmer-button` | small containers only |
| Ambient canvas bg | reactbits | `Aurora` | ≤6% opacity |
| Unwritten-future grid | reactbits | `DotGrid` | faint |
| Empty-state source | reactbits | `Orb` | |
| Reflection steps | reactbits | `Stepper` | |
| Section entrance | reactbits | `ScrollReveal` | |
| Summary line entrance | reactbits | `FadeContent` | |
| Every icon | lucide | `Waves, Compass, Sparkles, ZoomIn, ZoomOut, Maximize2, RefreshCw, PenLine, History, Feather, TrendingUp, Sunrise, Hourglass, ArrowRight, CircleDashed, Quote, BookOpen` | verify each via lucide search at build; search `trash` for delete |
| Color scheme | google-design | `generate_color_scheme` | seed §3.1 |

**Warnings honored:** no large `border-beam` (shimmer only on buttons); no `marquee` on interactive content (not used at all).

---

## 5 · DATA LAYER

### 5.1 Renderer types
```ts
export type LifePhaseCategory = 'foundations'|'growth'|'craft'|'people'|'self'|'threshold';
export interface LifePhaseMilestone { id: string; label: string; month: number; year: number; }
export interface LifePhase {
  id: string;                      // crypto.randomUUID()
  title: string;
  description: string;
  category: LifePhaseCategory;
  startMonth: number; startYear: number;   // 1–12
  endMonth: number | null; endYear: number | null;  // null = ongoing
  magnitude: number;               // 0–100, NEVER derived from duration
  color: string | null;            // optional override; else category ramp
  reflection: string;              // AI-woven narrative
  eraTrends: string;               // JSON {world[],culture[],field[]}
  impactNotes: string;
  milestones: LifePhaseMilestone[];
  connections: string[];           // phase ids this phase flows into
  updatedAt: string;
}
```
Duration is **always derived**: `monthsBetween(start, end ?? now())` — never stored.

### 5.2 DDL + guarded migration (main.ts pattern)
```sql
CREATE TABLE IF NOT EXISTS life_phases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'growth',
  start_month INTEGER NOT NULL,
  start_year INTEGER NOT NULL,
  end_month INTEGER, end_year INTEGER,
  magnitude INTEGER NOT NULL DEFAULT 50 CHECK (magnitude BETWEEN 0 AND 100),
  color TEXT,
  reflection TEXT NOT NULL DEFAULT '',
  era_trends TEXT NOT NULL DEFAULT '',
  impact_notes TEXT NOT NULL DEFAULT '',
  milestones TEXT NOT NULL DEFAULT '[]',
  connections TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS life_timeline_meta (
  key TEXT PRIMARY KEY,            -- 'summary', 'summary.updatedAt'
  value TEXT NOT NULL
);
```
```ts
// older-DB safety (existing pattern)
const have = db.prepare(`PRAGMA table_info(life_phases)`).all().map(c => c.name);
for (const [col, type] of [['reflection','TEXT NOT NULL DEFAULT \'\''], /* … */])
  if (!have.includes(col)) db.exec(`ALTER TABLE life_phases ADD COLUMN ${col} ${type}`);
```

### 5.3 IPC channels (main) + preload
```
lifePhase:get            → LifePhase[] ordered by start_year, start_month
lifePhase:save           → upsert one, return row
lifePhase:delete         → delete by id (+ strip id from other phases' connections)
lifePhase:saveAll        → bulk (reorder/imports) in one transaction
lifePhase:aiReflect      → { ok, data: string }
lifePhase:aiEraTrends    → { ok, data: JSON string }
lifePhase:aiSummarize    → { ok, data: string } (cached in life_timeline_meta)
```
`preload.ts` exposes `window.deskflowAPI.lifePhaseGet()` etc.; renderer types extended on the existing `DeskFlowAPI` interface. AI runs **only in main** — no key ever reaches the renderer. All AI handlers return the `{ok}` contract with try/catch + timeout.

### 5.4 AI prompt templates
- **`aiReflect(phase, answers[3])`** — system: *"You are a warm, precise biographer. Write in first person, 90–130 words, no clichés, no self-help tone. Weave the user's three answers and their milestones. End with one sentence pointing toward what this chapter made possible next."*
- **`aiEraTrends(years)`** — return strict JSON `{world:[…2], culture:[…2], field:[…2]}`, one sentence each, well-anchored facts only; if years exceed model knowledge, say so generically rather than invent.
- **`aiSummarize(phases[])`** — one paragraph ≤ 80 words, second-person warm narrator, names the current chapter and the direction of flow. Stats (counts/years) are computed in code, never by the model.

---

## 6 · GEOMETRY ENGINE — `lib/riverMath.ts`
```ts
timeToX(year, month) = ((year - originYear) * 12 + month - 1) * pxPerMonth
reachHeight(mag)     = 28 + (mag / 100) * 84            // area ∝ duration × magnitude
rampFill(cat, mag)   = lerp3Stop(CATEGORY_RAMP[cat], mag)
```
Zoom stops: `FIT | YEAR | SEASON | MONTH`; on zoom change, keep *now* anchored. All layout is computed from **dates**, never pixels — the future `<SedimentBand>` (app history + usage-time) reuses `timeToX` unchanged. Milestone dots: `timeToX(m.month, m.year)` inside the reach.

**File tree**
```
src/features/warmth/gold/
  LifeRiver.tsx        // section wrapper + summary header (exported to GoldPage)
  RiverCanvas.tsx      // custom SVG core
  PhaseDrawer.tsx · PhaseFormDialog.tsx · ReflectionFlow.tsx
  EraTrendsCard.tsx · EmptyRiver.tsx
  lib/riverMath.ts · hooks/useLifePhases.ts
```
`GoldPage.tsx`: `<LifeRiver />` rendered as a sibling section after `TheVault`, same rhythm as `DayJournal`.

---

## 7 · MOTION, ACCESSIBILITY, REDUCED MOTION
- Transform + opacity only; 150–300ms feedback, 300ms drawer; no scroll-jacking.
- `prefers-reduced-motion`: Breath, now-pulse, coastline animation, Aurora, Orb, ticker all → static.
- Reaches: `role="button"`, full aria-labels, visible amber focus ring; tooltips on focus; every control ≥ 44px (invisible hit-padding on thin reaches); body 14px/1.55+, secondary text `#a1a1aa` (≥ 4.5:1), mono reserved for 11px+ tick labels.

---

## 8 · DELIVERABLE #4 — CHECKLISTS

**Requirements (§6):** ✅ Concept owned — River of Years · ✅ 10/10 surfaces designed (§2) · ✅ scheme + hex + mapping + ramp (§3.1) · ✅ signatures named (§3.3) · ✅ sourcing table (§4) · ✅ types + DDL + IPC + AI endpoints (§5) · ✅ proportional duration×magnitude geometry (§6 — never tiers) · ✅ current-phase Open Water + future · ✅ seams + tributaries · ✅ reflection/era/summary with loading/error/regenerate · ✅ empty/loading/error on every surface (§2.8–2.10) · ✅ Gold page sibling entry (§5/§6 tree) · ✅ anti-slop below.

**Anti-slop:** ✅ warmth palette only, zero purple · ✅ glass + border brightness, no box-shadow elevation · ✅ every state covered · ✅ no decorative uppercase kickers (serif-italic captions instead) · ✅ scannable: labels, mono dates, tooltips · ✅ 3 families + existing mono utility · ✅ body 14px/1.55, contrast ≥ 4.5:1 · ✅ ≥ 44px targets · ✅ reduced-motion honored · ✅ MCP components everywhere except the one primitive that doesn't exist anywhere.

**The river is the spec: build the water first, then let everything else flow into it.**