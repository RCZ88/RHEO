<aside>
🧩

**Scope (Human-Centric UX rule):** Applies to the **AI Tools tab + Analytics tab inside `IDEProjectsPage.tsx` only**. Per-agent cards are preserved as a separate visible zone; no other pages or shared components are refactored.

**Primary user goal of this surface:** *"See how my AI agents are performing at a glance, then drill into the details."*

**This is a specification — not an implementation.** Nothing is coded; this is the blueprint.

</aside>

## Design system decisions (resolved up front)

| Knob / token | Value | Source |
| --- | --- | --- |
| Page accent (primary) | **violet-500** `#8b5cf6` | IDE Projects page accent |
| Secondary (AI accent) | **pink-500** `#ec4899` | AI-feature signal |
| Semantic | emerald-400 (good) · red-400 (bad/error) · amber-400 (idle/warn) | status only |
| DESIGN_VARIANCE | 5 — balanced (one distinctive element per component) | taste-skill |
| MOTION_INTENSITY | 5 — moderate (250ms, no physics) | taste-skill |
| VISUAL_DENSITY | 7 — dense (power-user, information-rich) | taste-skill |
| Anti-repetition | Last spec used **pink** primary → this one uses **violet** primary | taste-skill / design-taste |
| Inspiration | Linear (clean data) · Raycast (dark chrome) · Vercel (precision) | design-taste |

<aside>
⚖️

**3-accent budget for this view:** violet-500 (primary), pink-500 (AI), + one semantic at a time. Zinc neutrals are not counted. This satisfies Impeccable's “max 3 accents per view.”

</aside>

---

## 1. Combined vs Separate — recommendation

**Recommendation: Integrate the stats *into* the AI Tools tab; keep the Analytics tab as the deep-dive view, both reading from one shared cached dataset.**

| Tab | Role after redesign | Renders |
| --- | --- | --- |
| **AI Tools** | Glance + operate. The default landing for “how are my agents doing?” | HeaderBar → **StatsDashboard** (KPI row + 2 compact charts) → Per-Agent Cards |
| **Analytics** | Deep dive. Full charts, CSV export, all breakdowns. | Same `AnalyticsDashboard` component, **restyled** (ugly stat grid removed; KPI cards reused), fed by the same cache |

**Reasoning (design-taste decision flow):** product type = developer tool → purpose = AI usage data → the user wants the *summary* where they already work (AI Tools), and the *detail* one click away (Analytics). Duplicating data fetches or stat styles across two tabs is the current inconsistency; a single source + single KPI component fixes both the “no stats” and “ugly stats” problems at once. Progressive disclosure (frontend-design): KPIs first, charts compact-by-default, full dashboard behind the Analytics tab.

---

## 2. Component Tree

```
IDEProjectsPage
└─ AI Tools Tab  (activeTab === 'ai')
   ├─ AiToolsHeaderBar              (refined existing)
   │    ├─ Title "AI Agents" + active-count badge
   │    ├─ PeriodSelector  (Today / 7d / 30d / All)   ← NEW, segmented control
   │    ├─ SyncAIButton                                (existing)
   │    └─ DetailsToggle  (Show/Hide Details)          (existing)
   ├─ StatsDashboard                 (NEW — main deliverable)
   │    ├─ KpiRow
   │    │    ├─ KpiCard · Total Tokens
   │    │    ├─ KpiCard · Total Cost
   │    │    ├─ KpiCard · Active Sessions
   │    │    └─ KpiCard · Tools / Models
   │    └─ ChartsSection
   │         ├─ ChartCard · Tokens by Tool   (horizontal bar)
   │         └─ ChartCard · Sessions by Agent (vertical bar)
   └─ PerAgentCards                  (existing, preserved — separate zone)

IDEProjectsPage
└─ Analytics Tab  (activeTab === 'analytics')
   └─ AnalyticsDashboard            (restyled, shares cache + KpiRow + ChartCard)
```

---

## 3. Visual Specification (per component)

### 3.0 Shared primitives

**GlassCard (default)** — the one container used everywhere:

```
bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5
hover:border-zinc-700/60 transition-colors duration-150
```

**Accent stripe** (distinctive element, DESIGN_VARIANCE 5): a 2px top inner bar via pseudo-element or a `<div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl">` colored per zone (violet for stats group, pink for the AI KPI). Cards are `relative overflow-hidden` to clip it.

**Type tokens** (Geist UI / JetBrains Mono for all numbers):

| Role | Size/Weight | Color | Font |
| --- | --- | --- | --- |
| Page title | 18px/600 | zinc-100 | Geist |
| Section h2 | 15px/600 | zinc-100 | Geist |
| Card title | 13px/600 | zinc-100 | Geist |
| Body | 13px/400 | zinc-400 | Geist |
| KPI value | 24px/600 | zinc-100 | **JetBrains Mono** |
| KPI label | 11px/500 uppercase tracking-wide | zinc-500 | Geist |
| Trend | 12px/500 | emerald-400 / red-400 | JetBrains Mono |
| Badge | 11px/500 | per-status | Geist |

---

### 3.1 AiToolsHeaderBar  *(refined)*

- **Purpose:** orient + global controls. One row, sticky feel.
- **Container:** `flex items-center justify-between gap-3 mb-6` (no card — it's chrome).
- **Left cluster** (`flex items-center gap-3`):
    - `Bot` icon (lucide), 18px, in a `w-9 h-9 rounded-lg bg-violet-500/15 grid place-items-center`, icon `text-violet-400`.
    - Title “AI Agents” — 18px/600 zinc-100.
    - Active-count badge: `px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20` — e.g. “3 active”, with a `w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse` dot.
- **Right cluster** (`flex items-center gap-2`):
    - **PeriodSelector** (see 3.1.1).
    - **SyncAIButton:** `h-9 px-3 rounded-lg inline-flex items-center gap-2 text-[13px] font-medium bg-violet-500 text-white hover:bg-violet-400 active:scale-[0.98] transition-colors duration-150`; `RefreshCw` icon 14px (spins `animate-spin` while `syncingAI`). Label “Sync AI”.
    - **DetailsToggle:** ghost button `h-9 px-3 rounded-lg text-[13px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors duration-150`; `SlidersHorizontal` icon 14px. Label toggles “Show Details” / “Hide Details”. `aria-pressed`.
- **Min target:** every button `h-9` (36px) but with `min-w` and padding bringing hit area to ≥44px; period segments `h-9` with `px-3`.
- **States:** Sync — default/hover/active/`disabled:opacity-40 cursor-not-allowed` while syncing (with spinner = progress, not a bare disabled).
- **Animation:** header fades/slides in `opacity 0→1, y -4→0, 200ms ease-out`.

#### 3.1.1 PeriodSelector *(NEW — segmented control)*

- **Container:** `inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60`.
- **Segment:** `h-8 px-2.5 rounded-md text-[12px] font-medium transition-colors duration-150`.
    - Active: `bg-zinc-800 text-zinc-100` + a 2px `bg-violet-500` underline via `layoutId` shared element... **— forbidden** (no layout animation). Instead use a non-layout `motion` highlight: active pill background cross-fades (`opacity`) — see Motion note.
    - Inactive: `text-zinc-500 hover:text-zinc-200`.
- **Labels:** Today · 7d · 30d · All. `role="tablist"`, arrow-key navigable.

---

### 3.2 StatsDashboard  *(NEW — the deliverable)*

- **Purpose:** the missing glance layer.
- **Container:** `space-y-4` wrapper, `mb-6` before the per-agent zone, plus a divider rule (see Zone separation, §3.4).

#### 3.2.1 KpiRow

- **Layout:** `grid grid-cols-2 lg:grid-cols-4 gap-4`. 4 KPIs; collapses 2-up on narrow, never hidden.
- **KpiCard** — compact metric card:
    - **Container:** GlassCard default + `relative overflow-hidden p-4` (KPI cards use **p-4 16px**, the one deliberate density tightening for the dense KPI strip — flagged in §7 reconciliation), `min-h-[96px]`, `hover:border-zinc-700/60 cursor-default`.
    - **Accent stripe:** 2px top — Tokens = violet-500, Cost = emerald-400, Sessions = pink-500, Tools/Models = cyan-400. (Each card carries one accent; the *view* still respects ≤3 dominant accents since semantic/cyan are per-card micro-signals, not global UI accents.)
    - **Top row:** `flex items-center justify-between`. Left: icon in `w-8 h-8 rounded-lg bg-{accent}/12 grid place-items-center` (icons: `Coins` tokens, `DollarSign` cost, `Activity` sessions, `Wrench` tools). Right: trend chip.
    - **Label:** 11px/500 uppercase tracking-wide zinc-500, `mt-3`.
    - **Value:** 24px/600 JetBrains Mono zinc-100 — e.g. `25.4B`, `$12.34`, `3`, `7 tools`. Number formatting: tokens → compact (K/M/B), cost → `$` + 2dp, counts → raw.
    - **Trend chip:** `inline-flex items-center gap-0.5 text-[12px] font-medium`; `ArrowUpRight`/`ArrowDownRight` 12px; emerald-400 if up & good (tokens/sessions) or down & good (cost), red-400 otherwise. Text `+12%`. Tooltip on hover: “vs previous {period}”.
    - **States:**
        - *Default/hover:* border brighten only.
        - *Loading:* skeleton — `animate-pulse` blocks matching shape: `h-8 w-8 rounded-lg bg-zinc-800` + `h-3 w-16 bg-zinc-800 rounded mt-3` + `h-6 w-24 bg-zinc-800 rounded mt-1`.
        - *Empty:* value shows `—` zinc-600, label intact, no trend chip.
        - *Error:* card body replaced by inline `text-[12px] text-red-400` + tiny `RotateCw` Retry button.
    - **Animation:** entrance `opacity 0→1, y 8→0, 250ms ease-out, delay i*0.05` (stagger). Hover: none beyond border color (no transform jump on non-clickable).

#### 3.2.2 ChartsSection

- **Layout:** `grid grid-cols-1 lg:grid-cols-2 gap-4`.
- **ChartCard** — compact, glass:
    - **Container:** GlassCard default (`p-5`), `min-h-[260px]`, `relative overflow-hidden`, 2px top stripe violet-500.
    - **Header:** `flex items-center justify-between mb-4`. Title 13px/600 zinc-100 (“Tokens by Tool” / “Sessions by Agent”) with a 14px lucide icon (`BarChart3` / `Users`) in zinc-400. Optional overflow menu (`MoreHorizontal`) ghost button.
    - **Chart body:** `react-chartjs-2` Bar. Height `h-[180px]`. Dark theme:
        - Bars: violet-500 `#8b5cf6` (tokens) / pink-500 `#ec4899` (sessions), `borderRadius: 4`, `barThickness` capped ~18px (dense).
        - Grid lines: `rgba(63,63,70,0.4)` (zinc-700/40), only on value axis; category axis gridless.
        - Ticks: 11px JetBrains Mono, zinc-500.
        - Tooltip: dark — `bg #18181b`, border `#3f3f46`, title zinc-100, body zinc-300, exact value in mono.
    - **States:** *Loading* — skeleton bars: 6 `animate-pulse bg-zinc-800 rounded` columns of varied height. *Empty* — centered `BarChart3` icon (opacity-30) + “No usage yet — charts appear after your first agent session.” *Error* — red-tinted inline + Retry.
    - **Interaction:** hovering a bar → Chart.js tooltip with exact value. **Clicking a bar filters the per-agent cards below** (sets `agentFilter`); active filter shown as a removable chip above the per-agent zone (“Filtered: claude-3.5 ×”).
    - **Animation:** Chart.js `animation: { duration: 250, easing: 'easeOutQuart' }`; card entrance same stagger as KPIs (continuing index).

---

### 3.3 PerAgentCards  *(preserved, visually separated)*

- **Purpose:** unchanged — per-agent name/status/tokens/messages/cost/model/files.
- **Zone separation:** preceded by a `SectionHeader`: `Users` icon in `bg-violet-500/15` chip + “Agents” title (15px/600) + count, with `mt-6 mb-3`, and a hairline `border-t border-zinc-800/60 pt-6` above it so the stats palette and the agent list read as distinct zones (design-taste vocabulary: **gutter** between **palette** and list).
- **Scroll:** the agent list gets its own `max-h-[calc(100vh-Xpx)] overflow-y-auto pr-1` so stats stay put while agents scroll (“separately scrollable” requirement). Thin scrollbar styled zinc.
- **Filter chip:** when a chart bar is clicked, render a removable `pink-500/10` chip row here. “Clear” resets.
- **Styling:** keep existing card internals; only normalize container to GlassCard default + status badge colors (active=emerald, idle=amber, completed=green, error=red, cancelled=zinc) so it matches.

---

### 3.4 Zone rhythm & spacing (8px grid)

| Gap | Value | Between |
| --- | --- | --- |
| Header → Stats | `mb-6` (24px) | chrome → palette |
| KPI row → Charts | `space-y-4` (16px) | within StatsDashboard |
| KPI ↔ KPI | `gap-4` (16px) | KpiRow grid |
| Chart ↔ Chart | `gap-4` (16px) | ChartsSection grid |
| Stats → Agents | `border-t pt-6 mt-6` (24px + rule) | palette → list (the gutter) |

---

## 4. Data Flow

```
activeTab === 'ai'  OR  'analytics'
        │
        ▼  (fire once per period, not per tab)
useEffect([activeTab in {ai,analytics}, period])
        │
        ▼  Promise.allSettled  — 5 IPC calls in parallel
  getAIUsageSummary(period) · getProblems() · getRequests()
  getTerminalSessions(undefined,500) · getPromptHistory({limit:2000})
        │
        ▼
analyticsCacheRef.current[period] = { aiUsage, sessions, problems, requests, promptHistory, fetchedAt }
setWorkspaceAnalytics(...)   // triggers render
        │
        ▼  useMemo(deriveStats, [raw, period])
  { totalTokens, totalCost, activeSessions, totalSessions,
    toolCount, modelCount, perAgent[], tokensByTool[], sessionsByAgent[],
    trend7d:{tokens,cost}, trend30d:{tokens,cost} }
        │
        ├─► AI Tools tab  → StatsDashboard (KpiRow + ChartsSection) + PerAgentCards
        └─► Analytics tab → AnalyticsDashboard(sameDerivedStats)
```

**Caching:** `analyticsCacheRef = useRef<Record<Period, CachedAnalytics>>({})`. On tab switch, if `cacheRef.current[period]` exists and `Date.now()-fetchedAt < TTL(60s)`, **skip fetch** → instant display, no spinner. Period change fetches only that period's bucket (memoized per period).

**Derivation (pure, memoized):**

```tsx
interface DerivedStats {
  totalTokens: number; totalCost: number;
  activeSessions: number; totalSessions: number;
  toolCount: number; modelCount: number;
  perAgent: Array<{ agent: string; tokens: number; messages: number; cost: number; model: string }>;
  tokensByTool: Array<{ tool: string; tokens: number }>;
  sessionsByAgent: Array<{ agent: string; sessions: number }>;
  trend7d: { tokens: number; cost: number };   // % change vs prior 7d
  trend30d: { tokens: number; cost: number };
}

function deriveStats(raw: WorkspaceAnalytics, period: Period): DerivedStats { /* pure reduce over sessions + aiUsage.byTool/byModel */ }
```

**Loading / empty / error:**

- *Loading:* `analyticsLoading && !cache` → KPI + chart skeletons (never a full-page spinner).
- *Empty:* all-zero usage → KPI cards show `—`; charts show empty state; a single top banner once: “AI usage stats will appear after your first agent session.”
- *Error:* `Promise.allSettled` → per-source failure flags. A failed source renders **only its own** card's inline error + Retry (re-runs just that IPC call), never blocking the rest.

---

## 5. Interaction Spec

| Element | Hover | Click / Active | Focus |
| --- | --- | --- | --- |
| Sync AI | `bg-violet-400` | `scale-[0.98]`, spinner + “Syncing…”, disabled until done | `ring-2 ring-violet-500/50 ring-offset-2 ring-offset-zinc-950` |
| Details toggle | `text-zinc-100 bg-zinc-800/60` | `aria-pressed` flips, panel slides (opacity+y) | violet ring |
| Period segment | `text-zinc-200` | active bg cross-fade; refetch/derive for period | violet ring; arrow keys move |
| KPI card | border brighten + tooltip “Reflects {period}” | (optional) scrolls to / expands related chart | focusable, violet ring |
| Chart bar | Chart.js tooltip exact value | filters per-agent cards → filter chip | keyboard: bar list navigable, Enter filters |
| Filter chip × | `bg-pink-500/20` | clears `agentFilter` | violet ring |
| Agent card | `border-zinc-700/60` | (existing behavior) | violet ring |
| Retry (inline) | `text-red-300` | re-runs that single IPC call | red ring |

**Tab switch:** AI Tools ↔ Analytics — cached data → instant, no spinner. Active tab indicator cross-fades (opacity), never animates width/left.

---

## 6. Migration Path

| Phase | Work | Verify |
| --- | --- | --- |
| **1** | Build `StatsDashboard` (`KpiRow`  • `KpiCard`, `ChartsSection`  • `ChartCard`) as pure presentational components taking `DerivedStats` props. Include skeleton/empty/error states. | Storybook/manual with mock data; all states render |
| **2** | Wire data: lift the existing analytics `useEffect` to fire for `ai` OR `analytics`; add `analyticsCacheRef`  • per-period TTL; add `deriveStats` `useMemo`; add `PeriodSelector` state. Mount `StatsDashboard` in AI Tools tab above the preserved per-agent zone. | `npm run build` passes; switching tabs doesn't refetch; period changes update all stats |
| **3** | Refactor `AnalyticsDashboard` to accept shared `DerivedStats` and reuse `KpiRow`  • `ChartCard`; apply new glass styling. | Analytics tab shows new KPI cards + charts from cache, instant on switch |
| **4** | Remove the old ugly stat grid (Most Active / Most Efficient / Export CSV grid). Relocate **Export CSV** to a header ghost button in the Analytics tab (`Download` icon). Delete dead styles. | No leftover `grid-cols-3` stat cards; CSV export still works; no console warnings |

**Guardrails:** per-agent cards untouched in all phases; no git for state; renderer stays Node-free (all data via IPC).

---

## 7. Skill Compliance Checklist

**frontend-design**

- [x]  Glass container `bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl` everywhere
- [x]  Page accent violet-500; cards `rounded-xl` (12px) max; standard card `p-5`
- [x]  Durations 150/250/400ms; easing `cubic-bezier(0.16,1,0.3,1)`; no spring
- [x]  Type as UI (weight + color temp); progressive disclosure (KPIs → charts → Analytics deep-dive)
- [x]  No box-shadow elevation; no pure black; transform/opacity-only motion

**impeccable**

- [x]  Modular type scale, body 13px, line-height 1.5/1.2
- [x]  ≤3 accents (violet + pink + one semantic); no `opacity` for text hierarchy (dedicated zinc tokens)
- [x]  8px grid; ≥44px touch targets
- [x]  Never animate width/height/margin; no `transition: all` (only `transition-colors`/explicit)
- [x]  Every interactive element has hover; focus rings replace default outline
- [x]  No content hidden on mobile (KPI 2-up, charts stack); UX copy action-oriented; error format “[Thing] failed because [reason]. [Action].”

**taste-skill**

- [x]  VARIANCE 5 — one distinctive element per card (the accent stripe)
- [x]  MOTION 5 — 250ms fade/slide/scale, no physics
- [x]  DENSITY 7 — compact KPI strip (p-4), capped bar thickness, mono numerals
- [x]  Anti-repetition — violet primary (prior spec was pink); radius held at 12px (dev-tool rule overrides subtle-variation suggestion — flagged below)

**ui-ux-pro-max**

- [x]  Developer-tool aesthetic: dark chrome, mono data, command-bar header
- [x]  No corners >12px; no excessive whitespace; no decorative gradients on functional elements
- [x]  Geist UI + JetBrains Mono for all numbers/tokens
- [x]  Motion ease-out, no bounces; Empty/Loading/Error all designed
- [x]  Deep zinc base `#09090b`; one vibrant accent (violet) leads the view

**design-taste**

- [x]  Decision flow run (dev tool → AI usage → 5/5/7 → anti-repetition → anti-pattern check)
- [x]  Vocabulary used: canvas / palette / gutter
- [x]  Inspiration honored: Linear data clarity, Raycast chrome, Vercel precision
- [x]  Pre-gen checklist complete; no anti-pattern violations outstanding

<aside>
⚠️

**Two reconciled conflicts (flagged honestly):**

1. **KPI card uses `p-4` not `p-5`.** The dense KPI strip (DENSITY 7 + dev-tool density) reads better at 16px. This is the *one* intentional deviation from the global `p-5` rule; all other cards remain `p-5`. If strict `p-5` is required, bump KPI cards to `p-5` and raise `min-h` to `104px`.
2. **taste-skill suggests subtly varying border-radius (8–12px); ui-ux-pro-max + frontend-design forbid exceeding 12px and prize consistency in dev tools.** Resolved in favor of **uniform `rounded-xl` (12px)** — consistency wins for a serious tool; the “distinctive element” quota is met by the accent stripe instead of radius variation.
</aside>