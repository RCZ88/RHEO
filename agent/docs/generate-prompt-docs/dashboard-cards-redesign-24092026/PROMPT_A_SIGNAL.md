# PROMPT — Dashboard Cards Redesign: Prototype A — "SIGNAL"

## Raw Request (verbatim)
"can you use all mcp and all skills to generate a prompt and like redesign the dashboard CARDS PROPRLY EVERY WIDGET CARDS IS AI SLOP AN NO PROPER DESIGN AND LIKE ALL JUST BLAND AND GREY. FIX IT USING SOMETHING PROPERLY. GENERATE ME SOME MULTIPLE PROTOTYPES FOR ME TO CHOOSE FROM THAT INCLUDES ALL THE WIDGETS OPTIONS AND THE STOPWATCH N the tracking score thing and hte productivty chart. generate promp for that and hten try to do it ur self" — and "SO NO COMPROMISING THE DESIGN" — and "THE MOTION SKILL OM THE @chartDASHBAORD SKILL THING AND THE OTHER NEW SKILL" — and "LOOK AT THE 2 NEWEST SKILL" — and "i forgot their names" — and "i would like at least 3 protoype designs that IS FULL IN STYLE"

---

## Context
See CONTEXT_BUNDLE.md for full codebase reference. This prompt tasks the receiving AI with designing **Prototype A of 3** for the RHEO Dashboard page. All 3 prototypes share the same widget inventory and data wiring — they differ ONLY in visual language. User will pick one.

The 2 newest skills referenced are `ui-and-charts` (MCP-sourced shadcn/reactbits component + chart.js chart sourcing) and the motion stack (`motion-alive` + `animation-stack`). Both must be used.

---

## THE MANDATE

Design **Prototype A: "SIGNAL"** — a dashboard where every widget card has a distinct signal personality. The design language is **high-contrast data-radar**: each card communicates its category at a glance through a colored top-edge signal bar + an icon glyph that lives in a small squared container. No two widget types look the same. The stopwatch, tracking score, and productivity chart are the hero elements — they get the most visual weight and the most motion.

**Liveliness Level: L2 (Responsive)** — alive but focused. Micro-interactions + smooth transitions + one subtle ambient accent per card. Motion knob: 5-6.

**Knobs:** DESIGN_VARIANCE 6 (balanced-expressive), MOTION_INTENSITY 6 (moderate-dynamic), VISUAL_DENSITY 7 (dense — data-heavy dashboard).

---

## VISUAL LANGUAGE — "SIGNAL"

### Core principle
Every card is a solid signal panel: `bg-[var(--color-card)]` + a **top-edge accent bar** whose color = the card's category. The bar is 2px tall, full width, with a gradient that fades from the accent to transparent on the right. No backdrop-blur. No glass. Solid surfaces with purpose.

### Category → accent mapping (per card type)
| Widget type | Top-edge color | Icon container | Vibe |
|-------------|---------------|----------------|------|
| Stopwatch/Timer (status-band) | `pink-500` (brand) | Square, border glows on tick | Hero — most prominent |
| Tracking Score (momentum) | `emerald-400` (when high) / `amber-400` (when low) | Circular gauge + NumberTicker | Hero — gradient score ring |
| Productivity Chart | `cyan-400` | Line chart with gradient fill below | Hero — chart-forward |
| Goals | `violet-500` | Target icon, check buttons accent | Dense list |
| Streak | `orange-400/rose-500` | Flame icon, fire gradient ambient | Compact |
| Deadlines | `rose-400` | AlertCircle, urgency color-coded | List |
| Longest Focus | `sky-400` | Zap icon, session color bars | Compact list |
| AI Usage | `indigo-500` | Sparkles, usage bars | Compact |
| Schedule | `amber-400` | Calendar, timeline dots | Compact |
| Insights | `pink-400` | Sparkles strip, horizontal scroll | Strip |
| Browser/Console/Learn/Finance/Brain/Covenant/Health | per-domain accent | Domain icon | Compact |

### Card anatomy (all cards share this structure)
```
┌─────────────────────────────────────┐
│ ▲ TOP EDGE SIGNAL BAR (2px, category color) │
├─────────────────────────────────────┤
│  [icon box]  Title      [kicker]    │  ← header row, 44px min height
│                     [action btn]    │
├─────────────────────────────────────┤
│                                     │
│  CONTENT AREA                        │  ← p-5, data-dependent
│  (skeleton / empty / error /        │
│   populated)                         │
│                                     │
├─────────────────────────────────────┤
│  FOOTER (optional: meta + subtle)   │
└─────────────────────────────────────┘
```

### Card surface tokens
- Background: `bg-[var(--color-card)]` (NOT zinc-900 raw, NOT glass)
- Border: `border-zinc-800/50` default, `hover:border-zinc-700/60`
- Interactive cards: `hover:border-[var(--page-accent)]/30 cursor-pointer -translate-y-0.5 transition-all duration-200`
- Radius: `rounded-xl` (12px) — NEVER more
- Padding: `p-5` — NEVER p-6/p-8

### Typography per card
- Kicker (eyebrow): 10px/500 uppercase tracking-wider text-zinc-600 — above title
- Title: 13px/600 text-zinc-200 — the card's name
- Stat values: 14px/400 font-mono tabular-nums text-zinc-100
- Meta/labels: 11px/400 text-zinc-500
- Display values (timer, score): 36-48px/700 font-mono tabular-nums + color

---

## HERO 1 — STOPWATCH / TIMER (status-band widget)

This is the largest, most prominent card on the dashboard. It spans 2 columns. It is ALWAYS visible.

### Layout
```
┌─────────────────────────────────────────────────┐
│ ▲ PINK SIGNAL BAR (brand)                        │
├─────────────────────────────────────────────────┤
│  [◉]  STOPWATCH        [pause] [stop]  [reset]  │
├─────────────────────────────────────────────────┤
│                                                 │
│     01:23:45                                     │
│     1h 23m 45s                                  │
│     (monospace, 48px/700, pink-300)             │
│                                                 │
│     ● Productive session active                  │
│     (breathing green dot + "In focus" label)     │
│     or                                          │
│     ○ Paused                                    │
│     (static amber dot + "Take a break" label)   │
│     or                                          │
│     ○ Idle                                      │
│     (static zinc dot + "Not tracking" label)    │
│                                                 │
├─────────────────────────────────────────────────┤
│  Today: 2h 14m productive | 12m distracted       │
│  Streak: 7 days          Score: 72/100 →         │
└─────────────────────────────────────────────────┘
```

### Visual details
- Timer value: `font-mono text-[48px] font-bold tabular-nums text-zinc-100` — the largest text on the dashboard
- Below timer: `text-[14px] font-mono text-zinc-500` with the h/m/s breakdown
- Status dot: `w-2.5 h-2.5 rounded-full` — green `animate-pulse` when productive, amber static when paused, zinc static when idle. Label next to it in 11px.
- Buttons: `min-h-[40px] min-w-[40px]` (dense dashboard pair rule), icon + label, pink-500 hover ring
- Bottom meta row: two stat pills side by side — "Today: Xh Ym productive" and "Streak: N days" — each in a compact `bg-zinc-900/50 rounded-lg px-3 py-1.5` pill with mono values
- Score pill: arrow → pointing to the tracking score card (visual adjacency cue)

### Motion (L2)
- Timer digits: NumberTicker count-up on each second tick (spring, damping 60, stiffness 100 — from existing number-ticker.tsx)
- Status dot: `animate-pulse` only when productive (CSS, 2s ease-in-out infinite)
- Button press: `scale-[0.97]` tap feedback via motion/react whileTap
- Card entrance: stagger from top, fade + y-4 → y-0, 250ms ease-out
- On tier change (productive→distracting): border beam sweep (BorderBeam from existing ui/) — 1.5s one-shot from left to right in the new tier's color

### States
- **Loading**: Skeleton matching timer shape — 48px tall skeleton bar + 3 smaller skeleton rows
- **Empty**: "No active session" + a "Start tracking" button
- **Error**: "Timer failed to sync" + Retry button
- **Populated**: Above layout

---

## HERO 2 — TRACKING SCORE / MOMENTUM (momentum widget)

This is the score card. Spans 1-2 columns depending on layout. Gets a prominent circular gauge.

### Layout
```
┌─────────────────────────────────────┐
│ ▲ EMERALD SIGNAL BAR (score >= 60)  │
│   or AMBER (score < 60)             │
├─────────────────────────────────────┤
│  [◎]  TRACKING SCORE    [trend ▲]   │
│        TODAY              up         │
├─────────────────────────────────────┤
│                                     │
│           ╭───────────╮             │
│           │   72      │             │  ← SVG circular gauge,
│           │   /100    │  120px     │     animated strokeDashoffset,
│           │   ▲       │     ⭕     │     color = score band
│           ╰───────────╯             │
│                                     │
│  Streak: 7 days  │  72% done       │
│  Focus: 2.3h     │  68% schedule   │
│                                     │
└─────────────────────────────────────┘
```

### Visual details
- Top-edge color dynamic: emerald-400 when score >= 60, amber-400 when 40-59, rose-400 when < 40. This is the "signal" — the card tells you how you're doing at a glance.
- Circular gauge: SVG `w-30 h-30` (120px), stroke width 8, `-rotate-90`, animated `strokeDashoffset` from `motion/react` — 1.5s ease-out on score change. Background track = `zinc-800/50`.
- Score number inside gauge: `text-3xl font-bold font-mono` in score-band color, with NumberTicker count-up on change.
- Trend badge: small pill `bg-zinc-800/50 border-zinc-700/30` with arrow icon (TrendingUp colored emerald/rose/zinc) + "Up from yesterday" / "Down" / "Stable" label.
- Breakdown row: 2-column grid of mini-stat pills — each pill: `bg-zinc-900/30 rounded-lg p-2.5` with icon (Flame/Target/Clock) + label + value. Values in mono.

### Motion (L2)
- Gauge stroke: `motion.circle` with `strokeDashoffset` animate to target — 1.5s ease-out
- Score number: NumberTicker spring count-up
- Trend pill: subtle scale-105 on mount
- Card entrance: fade + y-6 → y-0, 300ms

### States
- **Loading**: Skeleton — circle skeleton (gauge shape) + 2 skeleton rows
- **Empty**: "No data yet today" + icon
- **Error**: "Score calculation failed" + Retry
- **Populated**: Above

---

## HERO 3 — PRODUCTIVITY CHART (productivity-chart widget)

Chart-forward card. Spans 2 columns. This is the data viz centerpiece.

### Layout
```
┌─────────────────────────────────────────────────┐
│ ▲ CYAN SIGNAL BAR                                 │
├─────────────────────────────────────────────────┤
│  [◇]  PRODUCTIVITY        [week ▼]  [view ▼]    │
│        THIS WEEK                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│    8h ┤      ████                                │
│    6h ┤  ██  ████  ██                            │
│    4h ┤  ██  ████  ██████  ██                    │
│    2h ┤  ██  ████  ██████  ██████                │
│    0h ┤──█──█──█──█──█──█──█──█───               │
│         Mon Tue Wed Thu Fri Sat Sun               │
│                                                 │
│    ████ = Productive (pink)                      │
│    ██   = Neutral (zinc)                         │
│    ██   = Distracting (rose)                    │
│                                                 │
│    Total this week: 18h 42m                      │
│    Best day: Wednesday — 4h 12m                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Visual details
- Chart: chart.js vertical stacked bar chart. Bar color stack: pink-500 (productive), zinc-600 (neutral), rose-400 (distracting). Rounded bar corners (chart.js `borderRadius` on dataset).
- Grid lines: `zinc-800/30` horizontal only. No vertical grid.
- Y-axis: hours 0-8h, labeled in zinc-500 10px.
- X-axis: day labels Mon-Sun, zinc-500 10px, underlined on hover.
- Legend: 3 pills below chart — colored dot + label + hours total for that category this period.
- Period selector: small dropdown `bg-zinc-900 border-zinc-800 rounded-lg` — week/month/day. Default: week.
- View toggle: "Hours" / "Focus sessions" — switches chart mode.
- Total + best day stat row: 2 compact stat pills at bottom.

### Motion (L2)
- Bars: chart.js built-in animation — `animation.duration: 800, easing: 'easeOutQuad'`
- Period change: chart animates to new data (morphing bars)
- Card entrance: fade + y-6, 300ms

### States
- **Loading**: Skeleton — chart area skeleton (wide rect) + stat row skeletons
- **Empty**: "No data for this period" + "Select a different period" link
- **Error**: "Chart data unavailable" + Retry
- **Populated**: Above

---

## ALL OTHER WIDGETS — "SIGNAL" treatment

Each non-hero widget gets the same card anatomy: top-edge signal bar (category color) + icon box + title + content. Here's the spec for each:

### Goals (goals-card) — violet signal
- Icon: `Target` in `w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20`
- Content: Vertical list of goal items, each = checkbox (custom, pink-accent on check) + title + category badge + time estimate. Checked items: strike-through + zinc-600 opacity.
- Add button: `+` icon button top-right, pink-accent on hover
- Empty: "No goals for today — add one to get started" + Add button
- Loading: Skeleton list (5 rows)
- Trend: completion % shown as a thin progress bar at card bottom

### Streak (streak-card) — orange/rose signal
- Icon: `Flame` in orange container
- Content: Big streak number (NumberTicker) + milestone badge (Flame/On Fire/Unstoppable/Legendary) + mini category streak bars
- Ambient: subtle fire-gradient radial glow behind the number (opacity 0.06, from orange-500)
- BorderBeam when streak >= 14 (existing component)
- Empty: "Start your first goal to build a streak"

### Deadlines (deadlines-card) — rose signal
- Icon: `AlertCircle` in rose container
- Content: List of upcoming deadlines sorted by urgency. Each row: title + due date (monospace) + urgency badge (Overdue=red, Soon=amber, OK=emerald) + category pill
- Overdue items: rose-400/10 bg highlight
- Empty: "No deadlines upcoming"

### Longest Focus (focus-summary) — sky signal
- Icon: `Zap` in sky container
- Content: Top 3 focus sessions, each = rank badge (#1 gold, #2 silver, #3 bronze) + app name + duration (monospace, colored by length: green >= 1h, teal >= 30m) + time range
- Tabs: Today / Week / Best (allTime) — pill toggle
- Empty: "No focus sessions yet"

### AI Usage (ai-usage) — indigo signal
- Icon: `Sparkles` in indigo container
- Content: Horizontal usage bars per AI provider — bar + label + token count (mono). Color per provider.
- Empty: "No AI usage recorded"

### Schedule (schedule-hero) — amber signal
- Icon: `Calendar` in amber container
- Content: Current schedule block (if active) — large title + time + category dot. Next up: mini timeline of next 2 blocks. If no schedule: "No scheduled blocks"
- Active block: amber-400 left border (2px) + subtle amber bg tint

### Insights (insight-strip) — pink signal
- Icon: `Sparkles` in pink container
- Content: Horizontal scrollable strip of insight cards (each = icon + one-line insight + timestamp). Scroll snap.
- Empty: "No insights yet"

### Browser / Console / Learn / Finance / Brain / Covenant / Health
Each gets: domain-appropriate icon + signal bar in domain accent + domain-specific content (existing component logic preserved). All follow the same card anatomy.

---

## DASHBOARD GRID LAYOUT (SIGNAL)

The dashboard grid uses `WidgetGrid.tsx` — preserve existing grid system. Card visual treatment changes, grid mechanics stay.

### Default layout (2-column on laptop, responsive)
```
Row 1: [Stopwatch (2col)] [Tracking Score (1col)] [Streak (1col)]  ← hero row
Row 2: [Productivity Chart (2col)] [Goals (1col)] [Deadlines (1col)]
Row 3: [Longest Focus (1col)] [AI Usage (1col)] [Schedule (1col)] [Insights (1col)]  ← scrollable
Row 4+: [Browser] [Console] [Learn] [Finance] [Brain] [Covenant] [Health] [Pinned Activities]  ← widget library
```

### Grid spacing
- `gap-2` (8px) between cards — dense but not cramped
- Cards: `h-full min-h-0 overflow-auto` within grid cells (existing CSS-only pattern)
- Container: `grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-2 gap-2 flex-1 min-h-0`

---

## IMPLEMENTATION NOTES

### What to change
1. **`WidgetCard.tsx`** — Add `signalBarColor` prop (default: `var(--page-accent)`). Render top-edge 2px signal bar from this color. Keep all 4 states (loading/error/empty/populated). Re-skin to tokens.
2. **Hero cards** — Rewrite `MomentumScore.tsx`, `MomentumHero.tsx` to match SIGNAL spec above. Keep `NumberTicker`, `BorderBeam`, `motion` imports. The stopwatch display is in `DashboardPage.tsx` — style the timer display area there per spec.
3. **Productivity chart** — Build/rebuild the chart widget using chart.js (already available). Stacked bar, period selector, legend, stat row. Wire to existing `ProductivityChartSummary` data.
4. **All other widget cards** — Apply card anatomy (signal bar + icon box + title row) to each. Preserve existing content logic. Minimal content changes — visual shell change only.
5. **Grid layout** — Minor CSS tweak to `WidgetGrid.tsx` for spacing. Keep grid mechanics.

### What NOT to change
- Timer logic (stopwatch refs, productiveMs accumulation, tier detection) — preserve exactly
- Momentum score calculation — preserve exactly
- Data fetching hooks (`useDashboardData.ts`) — preserve
- Widget registry / registration — preserve
- Grid drag-drop / resize mechanics — preserve

### Design token compliance
- All colors from CSS variables: `var(--color-card)`, `var(--text-primary)`, `var(--text-muted)`, `var(--page-accent)`
- Hex codes ONLY in the Signal bar gradient computation and chart.js color config — everything else token-resolved
- Radius: `rounded-xl` max. Padding: `p-5`.
- Fonts: Geist/Inter for UI, JetBrains Mono for numbers. NEVER font-thin on dark.
- Motion: `motion/react` (framer-motion v12) for enter/exit + gauge animation. CSS `animate-pulse` for status dot. NumberTicker for count-up. BorderBeam for tier-change sweep. All durations 150-300ms except gauge (1.5s). Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- MUST wrap all animations in `@media (prefers-reduced-motion: reduce)` — collapse to instant.

### Component sourcing (via MCP)
- **shadcn MCP**: `npx shadcn@latest search '@shadcn'` for primitives used (card, button, select, badge, skeleton, dropdown-menu for period selector)
- **reactbits MCP**: `npx shadcn@latest search '@react-bits'` — check for any animated text/number components that could replace hand-rolled NumberTicker
- **lucide-react**: all icons already in repo. No new icon installs needed.

### Anti-slop checklist (run before finishing)
- [ ] No two widget types have identical visual treatment (each has a signal bar color)
- [ ] No backdrop-blur on card surfaces (solid `bg-[var(--color-card)]` + border only)
- [ ] No box-shadow for elevation
- [ ] No rounded-2xl/3xl anywhere
- [ ] No font-thin on dark backgrounds
- [ ] No pure black (#000) backgrounds
- [ ] No spring physics on serious data display
- [ ] No emoji as UI icons
- [ ] Every widget has loading + empty + error states (not just happy path)
- [ ] Timer display is the largest text on the dashboard (48px mono)
- [ ] Score gauge is the second most prominent element
- [ ] Chart is readable — grid lines subdued, bars colored by category, legend clear
- [ ] Motion is purposeful (entrance, feedback, state change) — not decorative noise
- [ ] Reduced-motion fallback present

---

## OUTPUT FORMAT

The receiving AI must produce:
1. Updated `WidgetCard.tsx` with signal bar support + all 4 states
2. Rewritten `MomentumScore.tsx` matching SIGNAL hero spec
3. Rewritten or new productivity chart widget component (chart.js stacked bar)
4. Timer display area styling in `DashboardPage.tsx` (the stopwatch hero)
5. Updated visual shell for: StreakCard, GoalsCard, DeadlinesCard, LongestFocusCard, AI usage, Schedule, Insights, and all registered widgets — each with signal bar + icon box + title row
6. `README.md` in the generate-prompt-docs folder summarizing what changed and why (design decisions log)

Do NOT produce 3 options. This prompt is Prototype A only — produce ONE design, done properly. The user will compare A, B, and C after all three prompts are executed.
