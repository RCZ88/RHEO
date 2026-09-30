# PROMPT — Dashboard Cards Redesign: Prototype B — "TERMINAL CHIC"

## Raw Request (verbatim)
"can you use all mcp and all skills to generate a prompt and like redesign the dashboard CARDS PROPRLY EVERY WIDGET CARDS IS AI SLOP AN NO PROPER DESIGN AND LIKE ALL JUST BLAND AND GREY. FIX IT USING SOMETHING PROPERLY. GENERATE ME SOME MULTIPLE PROTOTYPES FOR ME TO CHOOSE FROM THAT INCLUDES ALL THE WIDGETS OPTIONS AND THE STOPWATCH N the tracking score thing and hte productivty chart. generate promp for that and hten try to do it ur self" — and "SO NO COMPROMISING THE DESIGN" — and "THE MOTION SKILL OM THE @chartDASHBAORD SKILL THING AND THE OTHER NEW SKILL" — and "LOOK AT THE 2 NEWEST SKILL" — and "i forgot their names" — and "i would like at least 3 protoype designs that IS FULL IN STYLE"

---

## Context
See CONTEXT_BUNDLE.md for full codebase reference. This prompt tasks the receiving AI with designing **Prototype B of 3** for the RHEO Dashboard page. All 3 prototypes share the same widget inventory and data wiring — they differ ONLY in visual language. User will pick one.

The 2 newest skills referenced are `ui-and-charts` (MCP-sourced shadcn/reactbits component + chart.js chart sourcing) and the motion stack (`motion-alive` + `animation-stack`). Both must be used.

---

## THE MANDATE

Design **Prototype B: "TERMINAL CHIC"** — a dashboard that feels like a premium terminal/gunmetal control panel. The aesthetic is **dark chrome + syntax-highlighted data**: cards are gunmetal panels with thin bright borders, monospace numbers everywhere, and data that reads like a terminal output — structured, aligned, dense. The stopwatch is a large monospace timer in a bordered panel. The tracking score is a segmented bar (not a circle). The productivity chart is a wire-frame style chart with grid lines and dot markers.

**Liveliness Level: L2 (Responsive)** — snappy, no fluff. Motion knob: 5. Fast hover states, slide transitions, one subtle ambient accent (a slow gradient sweep on the hero timer panel).

**Knobs:** DESIGN_VARIANCE 5 (balanced — professional dev tool with personality), MOTION_INTENSITY 5 (moderate — snappy transitions, no physics), VISUAL_DENSITY 8 (dense — terminal-style information density).

---

## VISUAL LANGUAGE — "TERMINAL CHIC"

### Core principle
Dark gunmetal surfaces. Thin bright borders (1px). Tight spacing. Monospace for all numbers and labels. Data reads top-to-bottom, aligned to an 8px grid. Cards look like terminal panes — bordered, flat, information-forward. No gradients on card surfaces. No rounded corners on data rows. Maximum 12px radius on card containers only.

### Color palette (gunmetal + syntax)
| Role | Token | Hex equivalent |
|------|-------|----------------|
| Card background | `bg-zinc-900` (slightly lighter than page bg) | #18181b |
| Card border | `border-zinc-700` | #3f3f46 |
| Border bright (hover/active) | `border-zinc-500` | #71717a |
| Accent bright (interactive) | `border-pink-500/50` | #ec4899/50 |
| Text primary | `text-zinc-100` | #fafafa |
| Text secondary | `text-zinc-400` | #a1a1aa |
| Text muted | `text-zinc-600` | #52525b |
| Productive green | `text-emerald-400` | #34d399 |
| Distracting red | `text-rose-400` | #f43f5e |
| Neutral | `text-zinc-500` | #71717a |
| Score high | `text-emerald-400` | #34d399 |
| Score mid | `text-amber-400` | #fbbf24 |
| Score low | `text-rose-400` | #f43f5e |

### Typography — ALL MONO for data
- **Display timer**: `font-mono text-[52px] font-bold tabular-nums tracking-tight` — the hero
- **Score / stats**: `font-mono text-[24px] font-bold tabular-nums`
- **Labels**: `font-mono text-[11px] uppercase tracking-[0.15em] text-zinc-500` — terminal-style headers
- **Body/values**: `font-mono text-[13px] tabular-nums text-zinc-300`
- **Meta**: `font-mono text-[10px] text-zinc-600`
- UI font (card titles only): Geist/Inter `text-[13px] font-semibold text-zinc-200` — sparingly used
- Monospace font: JetBrains Mono (`font-mono`). This is a terminal aesthetic — numbers must feel like code.

### Card anatomy (terminal panel)
```
┌──────────────────────────────────────────────┐
│  ┌─ LABEL ───────────────────────────────┐   │  ← 11px uppercase mono, zinc-500
│  │                                        │   │
│  │  DATA AREA                              │   │  ← monospace, aligned, sparse
│  │  (timer / score / chart / list)        │   │
│  │                                        │   │
│  │                                        │   │
│  └────────────────────────────────────────┘   │
│  ┌─ META ────────────────────────────────┐   │  ← bottom row, zinc-600 mono 10px
└──────────────────────────────────────────────┘
```

### Card surface tokens
- Background: `bg-zinc-900` — flat, no gradient, no glass
- Border: `border-zinc-800` default, `hover:border-zinc-600 transition-colors duration-150`
- Interactive: `hover:border-pink-500/40 hover:bg-zinc-800/50 cursor-pointer`
- Radius: `rounded-lg` (8px) — slightly tighter than SIGNAL. NEVER rounded-xl on data rows.
- Padding: `p-4` (16px) — tighter than other prototypes for density
- No shadow. No backdrop-blur.

### Internal data row styling
- Data rows: `flex items-center gap-3` with mono values
- Mini-pills (stat pills): `bg-zinc-800/50 border-zinc-700/30 rounded-md px-2.5 py-1.5`
- Progress bars: `h-1 rounded-none bg-zinc-800 overflow-hidden` — flat, no rounding
- Badges: `px-1.5 py-0.5 rounded border border-zinc-700 text-[10px] font-mono uppercase`

---

## HERO 1 — STOPWATCH / TIMER (terminal panel)

The stopwatch is a large bordered terminal pane. It's the dominant element. The timer value is huge monospace text. The panel has a thin pink accent border when actively tracking productive time.

### Layout
```
┌─────────────────────────────────────────────────────┐
│  ┌─ SESSION TIMER ────────────────────────────────┐  │
│  │                                                   │  │
│  │              01:23:45                             │  │  ← 52px mono bold,
│  │              1h 23m 45s                          │  │     pink-300 when productive
│  │                                                   │  │     zinc-100 when idle
│  │                                                   │  │
│  │    ● RUNNING  —  In focus session               │  │  ← status line, mono 11px
│  │    ○ PAUSED   —  Take a break                   │  │
│  │    ○ IDLE     —  Not tracking                    │  │
│  │                                                   │  │
│  │  [▶ Resume]  [⏸ Pause]  [⏹ Stop]  [↺ Reset]   │  │  ← icon + label buttons,
│  │                                                   │  │     40px min, border-zinc-700
│  └───────────────────────────────────────────────────┘  │
│  ┌─ TODAY ─────────────────────────────────────────┐  │
│  │  Productive:  02h 14m  │  Distracting:  00h 12m  │  │  ← mono, aligned columns
│  │  Streak:  007 days     │  Score:  072 / 100     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Visual details
- Timer panel border: `border-zinc-700` default, `border-pink-500/50` when `isCurrentlyProductive`, `border-rose-500/50` when `isDistracting` — the border IS the signal (no top-edge bar in this prototype; the border carries the category color)
- Timer value: `font-mono text-[52px] font-bold tabular-nums leading-none tracking-tight` — the largest element on the dashboard. Color = pink-300 when productive, zinc-100 when idle/paused.
- Breakdown line below timer: `font-mono text-[14px] text-zinc-500`
- Status line: `font-mono text-[11px] uppercase tracking-wider` with a dot (●/○) + state label. Dot color = green/amber/zinc.
- Buttons: `min-h-[36px] min-w-[36px]` (compact terminal), icon-only with `aria-label`, `border-zinc-700 rounded-md px-2 py-1 hover:border-zinc-500 hover:bg-zinc-800/50 active:scale-[0.97]`
- Bottom meta: 2-column mono layout, aligned with `justify-between`. Each stat: label (zinc-600, 10px uppercase) + value (zinc-300, 13px mono).

### Motion (L2 — snappy)
- Timer digits: NumberTicker count-up each second (spring damping 80, stiffness 120 — slightly snappier than SIGNAL for terminal feel)
- Status change: text swap with 150ms fade (opacity 0→1)
- Button press: `scale-[0.97]` tap, 100ms
- Card entrance: fade + x-4 → x-0, 200ms (terminal = horizontal slide)
- Border color change on tier switch: 200ms color transition (CSS `transition: border-color 200ms`)
- Active tracking: subtle pulse on the border (CSS `animate-pulse` on border color, 2s) — just the border, not the whole card

### States
- **Loading**: Skeleton — wide skeleton bar (timer shape) + 3 shorter skeleton lines
- **Empty**: "No session active — click Resume to start" centered mono text
- **Error**: "Timer sync error" + Retry button
- **Populated**: Above

---

## HERO 2 — TRACKING SCORE / MOMENTUM (segmented bar)

The score is a horizontal segmented progress bar — NOT a circle. Terminal aesthetic = linear, aligned, readable. The bar is divided into 3 segments (streak 30% / completion 40% / focus 30%) with labels.

### Layout
```
┌──────────────────────────────────────────────┐
│  ┌─ TRACKING SCORE ────────────────────────┐ │
│  │                                          │ │
│  │  72 / 100                                │ │  ← big mono, centered
│  │  [████████████████████░░░░░░░░░░░░]     │ │  ← full-width segmented bar
│  │   30% streak  │  40% done  │  30% focus  │ │  ← segment labels below
│  │                                          │ │
│  │  ▲ Up from yesterday                     │ │  ← trend pill, mono 10px
│  │                                          │ │
│  │  Streak: 007 days  │  72% complete       │ │  ← meta row
│  │  Focus time: 02.3h  │  68% schedule       │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Visual details
- Score display: `font-mono text-[28px] font-bold tabular-nums` — large but not as dominant as the timer
- Segmented bar: full width, `h-5` (20px tall), flat `rounded-none`. 3 segments side by side, each width = score% * segmentWeight. Colors: streak segment = amber-400, completion segment = emerald-400, focus segment = cyan-400. Empty portion: `bg-zinc-800`.
- Bar animation: each segment width animates from 0 to target on score change (motion/react `animate: { width: 'X%' }` — 800ms ease-out, stagger 100ms between segments)
- Segment labels: 3 columns below bar, `font-mono text-[10px] uppercase text-zinc-500` + colored dot
- Trend pill: `bg-zinc-800 border-zinc-700 rounded-md px-2 py-1 text-[10px] font-mono uppercase` with arrow icon
- Meta row: 2-column grid of mono stat pills

### Motion (L2 — snappy)
- Bar segments: `motion.div` width animate 0→target, 800ms ease-out, staggered 100ms
- Score number: NumberTicker spring (damping 80, stiffness 120)
- Trend pill: fade in 200ms
- Card entrance: fade + x-4, 200ms

### States
- **Loading**: Skeleton bar (wide rect) + skeleton number + skeleton meta
- **Empty**: "No score data today" + mono text
- **Error**: "Score unavailable" + Retry
- **Populated**: Above

---

## HERO 3 — PRODUCTIVITY CHART (wire-frame chart)

The chart is a wireframe / dot-plot style chart — thin lines, dot markers, grid. Terminal aesthetic = technical, precise, not colorful. Productive bars in pink, neutral in zinc, distracting in rose — but thin (2px bars) with dot markers on top.

### Layout
```
┌─────────────────────────────────────────────────┐
│  ┌─ PRODUCTIVITY ─ WEEK ──────────────────────┐ │
│  │                                             │ │
│  │   8h ┤          ●                          │ │
│   6h ┤    ●       ●          ●                │ │
│   4h ┤    ●       ●    ●     ●       ●       │ │
│   2h ┤    ●    ●  ●    ●     ●    ●    ●    │ │
│   0h ┤──●───●───●───●───●───●───●───●───●── │ │
│       └─┴───┴───┴───┴───┴───┴───┴───┴───┴─► │ │
│        Mon Tue Wed Thu Fri Sat Sun             │ │
│                                                 │ │
│  ● pink = productive  ● zinc = neutral         │ │
│  ● rose = distracting                           │ │
│                                                 │ │
│  Total: 18h 42m  │  Best: Wed 4h 12m          │ │
│                                                 │ │
│  [week ▼]  [hours ▼]                           │ │
└─────────────────────────────────────────────────┘
```

### Visual details
- Chart: chart.js line chart with `stepped` or bar with `borderWidth: 2, borderRadius: 0, pointRadius: 4, pointBackgroundColor: colored`. Bars are thin (2px), no fill or 10% fill. Dot markers on each data point.
- Grid: thin `zinc-800` horizontal lines, 1px. Y-axis labels in mono 10px zinc-600.
- X-axis: day labels in mono 10px zinc-500.
- Legend: 3 items — colored dot + mono label. Not pills — just dot + text.
- Period selector: small dropdown, `bg-zinc-900 border-zinc-700 rounded text-zinc-300 text-[11px] font-mono`
- Total + Best stat row: mono, aligned, 2 columns

### Motion (L2 — snappy)
- Chart: chart.js animation 600ms ease-out (slightly faster than SIGNAL for snappy feel)
- Period change: chart morphs 600ms
- Card entrance: fade + x-4, 200ms

### States
- **Loading**: Skeleton wide rect + skeleton stat row
- **Empty**: "No data for this period" mono text
- **Error**: "Chart data error" + Retry
- **Populated**: Above

---

## ALL OTHER WIDGETS — "TERMINAL CHIC" treatment

Every widget is a terminal panel: flat `bg-zinc-900` + `border-zinc-800` + tight `p-4` + monospace data. Card titles are 11px uppercase mono labels. No icon containers — just a small mono label and the data.

### Goals (goals-card)
- Header: `GOALS` label (11px mono uppercase zinc-500) + "Today" sublabel
- List: each goal = checkbox (custom square, pink border when unchecked, pink fill when checked) + title (mono 13px zinc-200) + category badge (mono 10px, colored border) + time (mono 11px zinc-500)
- Checked: `text-zinc-600 line-through`
- Add: `+` button top-right, mono `+ Add goal` label
- Empty: "No goals — add one"

### Streak (streak-card)
- Header: `STREAK` + milestone label
- Big number: `font-mono text-[36px] font-bold tabular-nums` in orange-300/rose-300 based on streak length
- Mini bars: horizontal category bars below, thin, colored by category
- Empty: "Complete a goal to start a streak"

### Deadlines (deadlines-card)
- Header: `DEADLINES` + count
- List: each = title (mono 13px) + due date (mono 11px, colored by urgency: red=overdue, amber=soon, zinc=ok) + category (mono 10px)
- Overdue: `text-rose-400` + `bg-rose-500/5` row highlight
- Empty: "No deadlines"

### Longest Focus (focus-summary)
- Header: `FOCUS SESSIONS` + tab pills (Today / Week / Best — mono 10px pills)
- Top session: rank badge (`#1` gold mono) + app (mono 13px) + duration (mono 14px bold, green if >= 1h) + time range (mono 10px zinc-500)
- Below: list of next 2 sessions, same style but smaller

### AI Usage (ai-usage)
- Header: `AI USAGE`
- Bars: horizontal, thin, labeled by provider (mono 11px) + bar (2px height, colored) + token count (mono 11px zinc-300)

### Schedule (schedule-hero)
- Header: `SCHEDULE`
- Active block: large mono title + time range + category dot
- Next blocks: timeline list, mono, dot + time + title

### Insights (insight-strip)
- Header: `AI INSIGHTS`
- Strip: horizontal scroll, each insight = mono one-liner + timestamp (mono 10px zinc-600)
- No cards — just a scrollable text strip. Terminal aesthetic = text-forward.

### Browser / Console / Learn / Finance / Brain / Covenant / Health
Each = terminal panel with domain label + mono data display. Icon = small inline mono character or lucide icon at 12px, no container.

---

## DASHBOARD GRID LAYOUT (TERMINAL CHIC)

Same grid system (`WidgetGrid.tsx`) — preserve mechanics. Card visual treatment = terminal panels. Layout:

```
Row 1: [Stopwatch (2col)] [Tracking Score (1col)] [Streak (1col)]
Row 2: [Productivity Chart (2col)] [Goals (1col)] [Deadlines (1col)]
Row 3: [Longest Focus (1col)] [AI Usage (1col)] [Schedule (1col)] [Insights (1col)]
Row 4+: [Browser] [Console] [Learn] [Finance] [Brain] [Covenant] [Health]
```

### Grid spacing
- `gap-2` (8px) — tight, terminal density
- Cards: `h-full min-h-0 overflow-auto`
- Container: same CSS grid as existing

---

## IMPLEMENTATION NOTES

### What to change
1. **`WidgetCard.tsx`** — Re-skin to terminal panel: `bg-zinc-900` + `border-zinc-800` + `p-4` + `rounded-lg`. Keep all 4 states. Remove signal bar (terminal uses border color for category). Add `borderColor` prop for category-specific border.
2. **Hero cards** — Rewrite stopwatch display area in `DashboardPage.tsx` to terminal panel spec. Rewrite `MomentumScore.tsx` to segmented bar (not circle). Build productivity chart widget with wire-frame chart.js style.
3. **All other widget cards** — Apply terminal panel shell. Keep content logic. Mono-ize labels and values.
4. **Grid** — preserve. Maybe tighten `gap-2` to `gap-1.5` for extra density (6px).

### What NOT to change
- Timer logic, momentum calculation, data hooks, widget registry — all preserve
- Motion engine: `motion/react` for enter/exit + bar animation. NumberTicker for count-up. CSS `animate-pulse` for border pulse. All 150-250ms. No spring on serious data.

### Design token compliance
- Monospace (JetBrains Mono) for ALL numbers, labels, meta. Geist/Inter only for card titles (sparingly).
- Flat `bg-zinc-900` surfaces. No gradients on cards. No glass. No backdrop-blur.
- `border-zinc-800` default, brightens on hover. Category signal = border color, not top bar.
- `rounded-lg` (8px) on cards. `rounded-none` on data bars/rows.
- `p-4` (16px) card padding — dense.
- Colors: zinc-900/800/700/600/500/400/300/200/100 scale primarily. Accent colors (pink/emerald/amber/rose/cyan) used SPARINGLY for data meaning (productive/distracting/score bands) — not decoration.
- Motion: 150-250ms. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`. Reduced-motion fallback.
- MUST wrap all animations in `@media (prefers-reduced-motion: reduce)`.

### Component sourcing (via MCP)
- **shadcn MCP**: search for `tabs` (for focus session tabs), `dropdown-menu` (period selector), `badge` (deadline urgency)
- **reactbits MCP**: check for terminal-style components or mono data displays that could be adapted
- **lucide-react**: all icons exist. Use at 12-14px, no container.

### Anti-slop checklist
- [ ] Every card is a flat terminal panel — no glass, no gradient, no shadow
- [ ] All numbers in mono (JetBrains Mono) — no sans-serif numbers
- [ ] Timer is the largest element on the dashboard (52px mono)
- [ ] Score is a segmented bar, not a circle (terminal aesthetic)
- [ ] Chart is wireframe style — thin bars, dot markers, grid lines
- [ ] Category signal = border color, not duplicate top-edge bars
- [ ] No two cards have the same exact treatment (each has distinct content layout)
- [ ] Labels are 11px uppercase mono — terminal style
- [ ] Spacing is tight (p-4, gap-2, 8px grid) — dense but readable
- [ ] Every widget has loading + empty + error states
- [ ] Motion is snappy (150-250ms) — no slow fades, no spring on data
- [ ] Reduced-motion fallback present
- [ ] No emoji as UI icons

---

## OUTPUT FORMAT

The receiving AI must produce:
1. Updated `WidgetCard.tsx` — terminal panel shell (bg-zinc-900, border-zinc-800, p-4, rounded-lg, borderColor prop)
2. Stopwatch hero panel in `DashboardPage.tsx` — terminal timer pane with 52px mono timer, status line, 40px buttons, bottom meta row
3. Rewritten `MomentumScore.tsx` — segmented bar (3 segments, animated width, score number above, trend pill, meta row)
4. New or rebuilt productivity chart widget — wire-frame chart.js (thin bars, dot markers, grid, mono labels, legend, period selector)
5. Visual shell updates for ALL widget cards — Goals, Streak, Deadlines, Longest Focus, AI Usage, Schedule, Insights, Browser, Console, Learn, Finance, Brain, Covenant, Health — each a terminal panel with mono data
6. `README.md` in the generate-prompt-docs folder with design decisions log

Do NOT produce 3 options. This prompt is Prototype B only — produce ONE design, done properly.
