# PROMPT — Dashboard Cards Redesign: Prototype C — "NEON GLASS"

## Raw Request (verbatim)
"can you use all mcp and all skills to generate a prompt and like redesign the dashboard CARDS PROPRLY EVERY WIDGET CARDS IS AI SLOP AN NO PROPER DESIGN AND LIKE ALL JUST BLAND AND GREY. FIX IT USING SOMETHING PROPERLY. GENERATE ME SOME MULTIPLE PROTOTYPES FOR ME TO CHOOSE FROM THAT INCLUDES ALL THE WIDGETS OPTIONS AND THE STOPWATCH N the tracking score thing and hte productivty chart. generate promp for that and hten try to do it ur self" — and "SO NO COMPROMISING THE DESIGN" — and "THE MOTION SKILL OM THE @chartDASHBAORD SKILL THING AND THE OTHER NEW SKILL" — and "LOOK AT THE 2 NEWEST SKILL" — and "i forgot their names" — and "i would like at least 3 protoype designs that IS FULL IN STYLE"

---

## Context
See CONTEXT_BUNDLE.md for full codebase reference. This prompt tasks the receiving AI with designing **Prototype C of 3** for the RHEO Dashboard page. All 3 prototypes share the same widget inventory and data wiring — they differ ONLY in visual language. User will pick one.

The 2 newest skills referenced are `ui-and-charts` (MCP-sourced shadcn/reactbits component + chart.js chart sourcing) and the motion stack (`motion-alive` + `animation-stack`). Both must be used.

---

## THE MANDATE

Design **Prototype C: "NEON GLASS"** — a dashboard that feels premium, alive, and polished. The aesthetic is **dark glass panels with neon edge lighting**: each card has a subtle glass surface (`bg-zinc-900/40` with a 1px bright border), a colored neon edge glow that responds to hover, and data that feels like it's glowing from within. The stopwatch is a large neon-bordered timer with a pulsing status ring. The tracking score is a glowing radial gauge with an animated outer ring. The productivity chart has neon-colored bars with glow effects.

**Liveliness Level: L2 (Responsive)** — alive but focused. Micro-interactions + smooth transitions + one restrained ambient accent per card (neon glow on hover, subtle pulse on active elements). Motion knob: 6.

**Knobs:** DESIGN_VARIANCE 7 (expressive — bold personality, custom animations), MOTION_INTENSITY 6 (moderate-dynamic — glow, hover lift, smooth transitions), VISUAL_DENSITY 6 (balanced — comfortable for extended use).

---

## VISUAL LANGUAGE — "NEON GLASS"

### Core principle
Cards are dark glass panels: `bg-zinc-900/40 backdrop-blur-sm` (NOT theLAMINAR-banned glass-on-chrome — this is glass on the dark page background, which is allowed). Each card has a **1px border in its category color at 30% opacity**, which brightens to 60% on hover and gets a subtle `box-shadow` glow in the category color. The neon is restrained — it's an accent, not a rave. Data is clean, readable, and well-spaced.

### Color palette (dark glass + neon accent)
| Role | Token | Notes |
|------|-------|-------|
| Card surface | `bg-zinc-900/40 backdrop-blur-sm` | Glass on dark page |
| Card border default | `border-zinc-800/50` | Subtle edge |
| Card border hover | `border-[var(--page-accent)]/40` | Neon accent on hover |
| Card glow hover | `shadow-[0_0_20px_-5px_rgba(236,72,153,0.15)]` | Subtle neon glow |
| Text primary | `text-zinc-100` | Clean white |
| Text secondary | `text-zinc-400` | Muted |
| Text muted | `text-zinc-600` | Labels |
| **Stopwatch neon** | `pink-400 / pink-500` | Brand neon |
| **Score neon** | `emerald-400` (high) / `amber-400` (mid) / `rose-400` (low) | Score-reactive |
| **Chart neon** | `cyan-400` | Data neon |
| Productive | `emerald-400` | Positive |
| Distracting | `rose-400` | Negative |
| Neutral | `zinc-500` | Neutral |

### Neon edge lighting (per card type)
The neon is a CSS `box-shadow` glow in the card's category color, at low opacity. It's NOT a full glow around the card — it's a subtle edge hint that brightens on hover.

| Widget type | Neon color | Glow treatment |
|-------------|-----------|----------------|
| Stopwatch (status-band) | `pink-500` | Pink glow on hover + pulsing pink ring when active |
| Tracking Score (momentum) | Dynamic: emerald/amber/rose based on score | Colored glow matching score band |
| Productivity Chart | `cyan-400` | Cyan edge glow on hover |
| Goals | `violet-500` | Violet edge on hover + check glow |
| Streak | `orange-400` | Orange ambient glow behind number |
| Deadlines | `rose-400` | Rose edge, overdue items get stronger rose highlight |
| Longest Focus | `sky-400` | Sky glow on hover |
| AI Usage | `indigo-400` | Indigo edge |
| Schedule | `amber-400` | Amber glow on active block |
| Insights | `pink-400` | Pink edge on scrollable cards |
| Others | domain color | Subtle edge glow per domain |

### Card anatomy (neon glass panel)
```
┌─────────────────────────────────────┐
│  ┌─ TOP ACCENT LINE (2px, category neon) │  ← subtle, not dominant
├─────────────────────────────────────┤
│  [icon]  Title         [kicker]     │  ← header: glass surface, mono/Geist mix
│                                      │
│  CONTENT AREA                         │  ← glass surface, data display
│  (glowing numbers, neon bars,        │
│   clean typography)                   │
│                                      │
├─────────────────────────────────────┤
│  FOOTER (optional)                    │
└─────────────────────────────────────┘
```

### Card surface tokens
- Surface: `bg-zinc-900/40 backdrop-blur-sm` — glass panel on dark page (allowed: glass on chrome background, not on another glass layer)
- Border default: `border-zinc-800/50` — subtle edge
- Border hover: `border-[var(--page-accent)]/40` — neon accent appears on hover
- Glow hover: `shadow-[0_0_24px_-8px_rgba(236,72,153,0.12)]` — subtle neon halo (per-card color)
- Radius: `rounded-xl` (12px) — premium feel
- Padding: `p-5` (20px) — comfortable, not cramped

### Typography
- Kicker: `text-[10px] font-semibold uppercase tracking-wider text-zinc-600` — above title
- Title: `text-[13px] font-semibold text-zinc-200` — Geist/Inter, not mono (glass aesthetic = clean sans)
- Stat values: `font-mono text-[14px] font-medium tabular-nums text-zinc-100` — mono for numbers only
- Meta/labels: `text-[11px] text-zinc-500` — Geist
- Display values (timer, score): `font-mono text-[40-48px] font-bold tabular-nums` + neon color
- The glass aesthetic uses Geist for labels and mono for numbers — clean contrast

---

## HERO 1 — STOPWATCH / TIMER (neon glass panel)

The stopwatch is a prominent neon-bordered panel. It's the most visually striking card. When actively tracking productive time, it gets a pulsing pink ring around the timer value.

### Layout
```
┌─────────────────────────────────────────────────┐
│  ┌─ TOP PINK ACCENT LINE ─────────────────────┐ │
├─────────────────────────────────────────────────┤
│  [◉]  STOPWATCH        [⏸ Pause]  [⏹ Stop]   │
│        SESSION TIMER         [↺ Reset]         │
├─────────────────────────────────────────────────┤
│                                                 │
│           01:23:45                               │
│           1h 23m 45s                            │
│           (monospace, 44px/700, pink-300)       │
│                                                 │
│         ╭──────────────────────────╮             │
│         │  ●  RUNNING — In focus   │             │  ← pulsing pink ring when active
│         │  ○  PAUSED — Take a break│             │  ← static ring when paused
│         ╰──────────────────────────╯             │
│                                                 │
│  Today:  2h 14m productive    Streak: 7 days   │
│  Score:  72/100  →                               │
└─────────────────────────────────────────────────┘
```

### Visual details
- Timer panel: glass surface (`bg-zinc-900/40 backdrop-blur-sm`) + `border-pink-500/20` default border + `hover:border-pink-400/50 hover:shadow-[0_0_24px_-8px_rgba(236,72,153,0.15)]` — the pink neon appears on hover
- Timer value: `font-mono text-[44px] font-bold tabular-nums text-pink-300` — large, pink-tinted (not full pink — glass aesthetic uses tinted colors)
- Below: `font-mono text-[13px] text-zinc-500` breakdown
- Status pill: `bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-4 py-2` with status dot + label. The dot has a **ring** around it: `ring-2 ring-pink-500/30` when active (pulsing via CSS `animate-pulse` on the ring), `ring-amber-500/20` when paused, `ring-zinc-600/20` when idle
- Buttons: icon + label, `min-h-[40px]`, `border-zinc-800/50 rounded-lg hover:border-pink-500/30 hover:bg-pink-500/5 active:scale-[0.98]` — pink hint on hover
- Bottom meta: 2-column row of glass pills — `bg-zinc-900/30 border-zinc-800/30 rounded-lg px-3 py-2` with mono labels + values
- Score pill: arrow `→` pointing to score card (visual adjacency)

### Motion (L2 — alive, polished)
- Timer digits: NumberTicker count-up each second (spring damping 50, stiffness 90 — smooth, not snappy)
- Status ring pulse: `animate-pulse` on the ring element (2s ease-in-out infinite) — only when active
- Button hover: `whileHover: { y: -1, scale: 1.02 }` + border brightens + glow shadow appears (motion/react)
- Button tap: `whileTap: { scale: 0.97 }` — tactile
- Card entrance: stagger fade + y-6 → y-0 + scale 0.98→1, 300ms ease-out (slightly more dramatic than other prototypes for the "premium" feel)
- On tier change: BorderBeam sweep (existing component) in the new tier color — 2s one-shot
- Ambient: subtle pink radial glow behind timer value, `opacity: [0.15, 0.25, 0.15]` 4s loop (existing pattern from MomentumHero)

### States
- **Loading**: Skeleton — wide skeleton bar (44px) + skeleton status pill + skeleton meta row
- **Empty**: "No active session" + "Start tracking" button in glass pill
- **Error**: "Timer sync failed" + Retry button
- **Populated**: Above

---

## HERO 2 — TRACKING SCORE / MOMENTUM (glowing radial gauge)

The score is a premium radial gauge with a glowing outer ring. The ring color = score band. The gauge sits in a glass panel with a neon edge that matches the score color.

### Layout
```
┌─────────────────────────────────────┐
│  ┌─ TOP ACCENT LINE (score color) ──┘ │
├─────────────────────────────────────┤
│  [◎]  TRACKING SCORE    [▲ Up]      │
│        TODAY               from yest. │
├─────────────────────────────────────┤
│                                     │
│      ╭─────────────────────────╮    │
│      │   ╭───────────────╮     │    │  ← outer glow ring (animated,
│      │   │   72          │     │    │     color = score band)
│      │   │   / 100       │     │    │
│      │   │   ─ ─ ─ ─ ─ ─ │     │    │  ← SVG gauge, animated stroke
│      │   ╰───────────────╯     │    │
│      ╰─────────────────────────╯    │
│                                     │
│  Streak: 7 days    72% complete     │
│  Focus: 2.3h       68% schedule     │
│                                     │
└─────────────────────────────────────┘
```

### Visual details
- Top-edge line color: dynamic — emerald-400 when score >= 60, amber-400 when 40-59, rose-400 when < 40. The card's neon edge also shifts to match.
- Gauge: SVG `w-28 h-28` (112px), `rotate-[-90deg]`. Track circle: `stroke-zinc-800/50 stroke-width-8`. Progress circle: `motion.circle` with `strokeDashoffset` animated to target (1.5s ease-out). Color = score band.
- Outer glow ring: a second SVG circle behind the gauge, `stroke-[scoreColor] stroke-width-2 opacity-30 blur(4px)` — gives the neon glow effect. Animates opacity subtly.
- Score number inside: `text-3xl font-bold font-mono` in score band color. NumberTicker count-up on change.
- Trend badge: glass pill `bg-zinc-900/40 border-zinc-800/50 rounded-full px-2.5 py-1` with arrow icon + "Up from yesterday" / "Down" / "Stable" in 10px mono.
- Breakdown row: 2-column grid of glass mini-pills — `bg-zinc-900/30 border-zinc-800/30 rounded-lg p-2.5` with icon + label + value. Values in mono, colored by category.

### Motion (L2 — alive, polished)
- Gauge stroke: `motion.circle` strokeDashoffset animate 1.5s ease-out
- Outer glow ring: opacity animate `[0.2, 0.4, 0.2]` 3s loop — subtle breathing glow
- Score number: NumberTicker spring (damping 50, stiffness 90)
- Trend badge: scale-105 mount, 200ms
- Card entrance: fade + y-6 + scale 0.98, 350ms (premium entrance)

### States
- **Loading**: Skeleton — circle skeleton (gauge shape) + skeleton number + skeleton rows
- **Empty**: "No score data today" + icon in glass circle
- **Error**: "Score unavailable" + Retry
- **Populated**: Above

---

## HERO 3 — PRODUCTIVITY CHART (neon bars with glow)

The chart has neon-colored bars with subtle glow effects. The bars are rounded, colored by category, and the chart panel has a cyan neon edge.

### Layout
```
┌─────────────────────────────────────────────────┐
│  ┌─ TOP CYAN ACCENT LINE ─────────────────────┐ │
├─────────────────────────────────────────────────┤
│  [◇]  PRODUCTIVITY        [week ▼]  [hours ▼]  │
│        THIS WEEK                                │
├─────────────────────────────────────────────────┤
│                                                 │
│    8h ┤      ████                                │
│    6h ┤  ██  ████  ██                            │
│    4h ┤  ██  ████  ██████  ██                    │
│    2h ┤  ██  ████  ██████  ██████                │
│    0h ┤──█──█──█──█──█──█──█──█───                │
│         Mon Tue Wed Thu Fri Sat Sun               │
│                                                 │
│    ████  Productive   12h 14m                    │
│    ██    Neutral      4h 23m                     │
│    ██    Distracting  2h 05m                     │
│                                                 │
│  Total: 18h 42m    Best day: Wednesday 4h 12m   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Visual details
- Chart: chart.js vertical bar chart. Bars: `border-radius: 4px`, colored by category (pink-500 productive, zinc-600 neutral, rose-400 distracting). Bar glow: `shadow-[0_0_8px_-2px_<categoryColor>]` on each bar (subtle).
- Grid: `zinc-800/20` horizontal lines, very subtle. Y-axis: mono 10px zinc-600.
- X-axis: day labels, mono 10px zinc-500, hoverunderline.
- Legend: 3 items below chart — colored dot (with subtle glow) + label + hours. Each in a glass pill.
- Period selector: glass dropdown `bg-zinc-900/60 backdrop-blur-sm border-zinc-800/50 rounded-lg`
- Total + Best stat row: 2 glass pills side by side.

### Motion (L2 — alive, polished)
- Bars: chart.js animation 700ms ease-out (slightly slower than terminal for premium feel)
- Period change: chart morphs 700ms
- Legend items: stagger fade-in 150ms each on mount
- Card entrance: fade + y-6 + scale 0.98, 350ms

### States
- **Loading**: Skeleton wide rect (chart area) + skeleton legend + skeleton stat row
- **Empty**: "No data this period" + "Try a different period" link
- **Error**: "Chart unavailable" + Retry
- **Populated**: Above

---

## ALL OTHER WIDGETS — "NEON GLASS" treatment

Each widget is a glass panel with a category-colored top edge line + neon border on hover + clean data display. The glass surface is `bg-zinc-900/40 backdrop-blur-sm`.

### Goals (goals-card) — violet neon
- Top edge: violet-400/30 line
- Border hover: `border-violet-400/30`
- Icon: `Target` in `bg-violet-500/10 border border-violet-500/20 rounded-lg`
- Content: goal list with custom checkboxes. Unchecked: `border-violet-400/30`. Checked: `bg-emerald-500/20 border-emerald-500/30` + check icon glow.
- Add button: `+` icon, `hover:border-violet-400/40 hover:shadow-[0_0_12px_-4px_rgba(139,92,246,0.2)]`

### Streak (streak-card) — orange neon
- Top edge: orange-400/30 line
- Big streak number: `font-mono text-[36px] font-bold` with subtle orange text shadow (`text-shadow: 0 0 20px rgba(251,146,60,0.3)`)
- Ambient: radial orange glow behind number, `opacity: [0.08, 0.15, 0.08]` 4s loop
- BorderBeam when streak >= 14 (existing)
- Milestone badge: glass pill with flame icon + label

### Deadlines (deadlines-card) — rose neon
- Top edge: rose-400/30 line
- List: each deadline = glass row with title + date + urgency badge. Overdue: `bg-rose-500/5 border-l-rose-400/40` — left edge rose highlight
- Urgency badges: glass pills with colored text

### Longest Focus (focus-summary) — sky neon
- Top edge: sky-400/30 line
- Tabs: glass pill toggle (Today/Week/Best)
- Top session: rank badge (gold/silver/bronze glass pills) + app + duration (colored by length with subtle glow)

### AI Usage (ai-usage) — indigo neon
- Top edge: indigo-400/30 line
- Usage bars: horizontal, rounded, colored by provider, subtle glow on each bar

### Schedule (schedule-hero) — amber neon
- Top edge: amber-400/30 line
- Active block: glass panel with amber left edge highlight + amber glow on the time

### Insights (insight-strip) — pink neon
- Top edge: pink-400/30 line
- Strip: horizontal scroll of glass insight cards, each with pink left edge + icon + text

### Browser / Console / Learn / Finance / Brain / Covenant / Health
Each = glass panel with domain top edge + domain icon + domain data. Neon edge on hover.

---

## DASHBOARD GRID LAYOUT (NEON GLASS)

Same grid system (`WidgetGrid.tsx`). Card treatment = glass panels with neon accents.

```
Row 1: [Stopwatch (2col)] [Tracking Score (1col)] [Streak (1col)]   ← hero row, most prominent
Row 2: [Productivity Chart (2col)] [Goals (1col)] [Deadlines (1col)]
Row 3: [Longest Focus (1col)] [AI Usage (1col)] [Schedule (1col)] [Insights (1col)]
Row 4+: [Browser] [Console] [Learn] [Finance] [Brain] [Covenant] [Health] [Pinned Activities]
```

### Grid spacing
- `gap-3` (12px) — slightly more breathing room than other prototypes for the premium feel
- Cards: `h-full min-h-0 overflow-auto`
- Container: same CSS grid as existing

---

## IMPLEMENTATION NOTES

### What to change
1. **`WidgetCard.tsx`** — Add glass surface support: `bg-zinc-900/40 backdrop-blur-sm` + `border-zinc-800/50` + hover neon border (`border-[accent]/40`) + hover glow shadow. Add `neonColor` prop for per-card accent. Keep all 4 states. Glass surface ONLY on the page background — NOT on another glass layer (LAMINAR compliant: glass on chrome is banned, glass on dark page bg is fine).
2. **Hero cards** — Rewrite stopwatch display in `DashboardPage.tsx` to neon glass panel spec. Rewrite `MomentumScore.tsx` to glowing radial gauge. Build productivity chart with neon bar style (chart.js + bar glow).
3. **All other widget cards** — Apply glass panel shell + category top edge + neon hover. Keep content logic.
4. **Grid** — `gap-3` for premium breathing room.

### What NOT to change
- Timer logic, momentum calculation, data hooks, widget registry — preserve
- Motion engine: `motion/react` for enter/exit + gauge + hover effects. NumberTicker for count-up. BorderBeam for tier sweep. CSS `animate-pulse` for status ring. All 200-350ms. Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- The neon glow is CSS `box-shadow` + SVG blur — NOT backdrop-blur on the card itself (card surface is glass on page bg, which is fine).

### Design token compliance
- Card surface: `bg-zinc-900/40 backdrop-blur-sm` — glass on dark page (allowed)
- Border: `border-zinc-800/50` default, neon color on hover
- Radius: `rounded-xl` (12px)
- Padding: `p-5`
- Colors: neon accents from CSS variable set + per-card neonColor prop. Text: zinc-100/400/600 scale. Mono for numbers, Geist for labels.
- Motion: 200-350ms. Ease-out cubic-bezier. Reduced-motion fallback.
- NO glass-on-glass layering (LAMINAR §7). Glass panels sit on the dark page background only.
- NO box-shadow for elevation — box-shadow is ONLY used for the neon glow effect (colored, low opacity), not for generic elevation.
- MUST wrap all animations in `@media (prefers-reduced-motion: reduce)`.

### Component sourcing (via MCP)
- **shadcn MCP**: `npx shadcn@latest search '@shadcn'` — check for `dropdown-menu` (period selector), `tabs` (focus tabs), `popover` (any hover previews)
- **reactbits MCP**: `npx shadcn@latest search '@react-bits'` — check for glass-effect components or glow components that could enhance the neon aesthetic
- **lucide-react**: all icons exist. Use at 14-16px for neon aesthetic (slightly larger than other prototypes for the premium feel).

### Anti-slop checklist
- [ ] Every card is a glass panel with a distinct neon accent color — no two look identical
- [ ] Glass surface is `bg-zinc-900/40 backdrop-blur-sm` on dark page — NOT glass-on-glass
- [ ] Neon glow is restrained — `box-shadow` at 12-15% opacity, not a blinding halo
- [ ] Timer has a pulsing ring when active — the ring is the signal, not a flat dot
- [ ] Score gauge has an outer glow ring that breathes (opacity loop) — premium feel
- [ ] Chart bars have subtle category-colored glow — not flat colored bars
- [ ] No two cards have identical treatment (each has distinct content layout + accent color)
- [ ] Typography: Geist for labels, mono for numbers — clean contrast, not all-mono
- [ ] Every widget has loading + empty + error states
- [ ] Motion is polished (300-350ms entrances, spring count-up, breathing glow) — not flat
- [ ] Reduced-motion fallback present
- [ ] No emoji as UI icons
- [ ] No pure black (#000) surfaces — all glass on zinc-900/40
- [ ] Radius: rounded-xl max. No rounded-2xl/3xl

---

## OUTPUT FORMAT

The receiving AI must produce:
1. Updated `WidgetCard.tsx` — glass surface + neon border + hover glow + `neonColor` prop + all 4 states
2. Stopwatch hero panel in `DashboardPage.tsx` — neon glass timer panel with 44px pink-tinted mono timer, pulsing status ring, glass pill meta row
3. Rewritten `MomentumScore.tsx` — glowing radial gauge with outer glow ring (breathing opacity) + score-reactive top edge + glass breakdown pills
4. New or rebuilt productivity chart widget — chart.js neon bars (rounded, colored with subtle glow) + glass legend pills + glass period selector + glass stat row
5. Visual shell updates for ALL widget cards — each a glass panel with category top edge + neon hover + domain data
6. `README.md` in the generate-prompt-docs folder with design decisions log

Do NOT produce 3 options. This prompt is Prototype C only — produce ONE design, done properly.
