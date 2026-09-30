# Dashboard Cards Redesign — 3 Prototype Designs (24092026)

## What's in this folder
3 full visual-design prototype specs + the skeleton React component implementations for each.

## Prototypes

### A — "SIGNAL" (`WidgetCardA_SIGNAL.tsx`, `StopwatchPanelA_SIGNAL.tsx`, `TrackingScorePanelA_SIGNAL.tsx`, `ProductivityChartA_SIGNAL.tsx`)
**Visual language:** Solid signal panels. Each widget type has a distinct top-edge accent bar (category color). No two widgets look the same. Clean, purposeful, data-forward.

**Key traits:**
- Top-edge 2px signal bar per widget type (pink for stopwatch, emerald/sky/amber for score, cyan for chart, violet for goals, orange for streak, etc.)
- Solid `bg-[var(--color-card)]` surfaces — no glass, no shadow
- 48px mono timer (largest text on dashboard)
- Circular SVG gauge with animated stroke for tracking score
- Chart.js stacked bar with rounded corners + colored segments
- NumberTicker count-up on all numeric values
- BorderBeam sweep on tier change
- Ambient glow behind content (subtle, breathing)

**WidgetCardA API:**
```tsx
<WidgetCardA
  widgetId="..."
  title="..."
  icon={LucideIcon}
  accent="#hexOrCssVar"     // top-edge + icon box color
  kicker="TODAY"            // eyebrow label
  collapsible
  removable
  draggable
  children
  loading / error / empty
/>
```

### B — "TERMINAL CHIC" (`WidgetCardB_TERMINAL.tsx`, `StopwatchPanelB_TERMINAL.tsx`, `TrackingScorePanelB_TERMINAL.tsx`, `ProductivityChartB_TERMINAL.tsx`)
**Visual language:** Flat gunmetal panels. All mono. Terminal aesthetic. Tight spacing, dense data. Category signal = border color, not top edge.

**Key traits:**
- Flat `bg-zinc-900` surfaces, `border-zinc-800` default
- 52px mono timer (largest text on dashboard)
- Segmented horizontal bar for tracking score (3 colored segments: amber/emerald/cyan)
- Chart.js wire-frame style — thin 2px bars, dot markers, no fill, minimal grid
- 11px uppercase mono labels everywhere (terminal style)
- `p-4` card padding — dense
- `transition: border-color` on tier change
- Button press: `scale-[0.97]`, 150ms
- Entrance: fade + x-4 slide, 200ms

**WidgetCardB API:**
```tsx
<WidgetCardB
  widgetId="..."
  title="..."              // rendered as 11px uppercase mono label
  icon={LucideIcon}        // small 12px, inline left of label
  accent="#hexOrCssVar"    // border color on hover
  collapsible
  removable
  draggable
  children
  loading / error / empty
/>
```

### C — "NEON GLASS" (`WidgetCardC_NEON.tsx`, `StopwatchPanelC_NEON.tsx`, `TrackingScorePanelC_NEON.tsx`, `ProductivityChartC_NEON.tsx`)
**Visual language:** Dark glass panels with neon edge accents. Premium, polished, alive. Glass surface (`bg-zinc-900/40 backdrop-blur-sm`) on dark page bg — LAMINAR-compliant.

**Key traits:**
- Glass surface: `bg-zinc-900/40 backdrop-blur-sm` + `border-zinc-800/50` default
- Neon border on hover: `hover:border-[neonColor]/40`
- Neon glow shadow on hover: `hover:shadow-[0_0_24px_-8px_<neon>/12]`
- 44px pink-tinted mono timer (glass aesthetic = tinted colors, not full saturation)
- Pulsing status ring (motion.div opacity loop) when active
- Glowing radial gauge with outer breathing glow ring (opacity loop) + SVG glow filter
- Chart.js neon bars (55% opacity, rounded, subtle colored shadow glow on each bar)
- 300-350ms entrances (scale 0.98→1, fade, y-6)
- Motion: `whileHover: { y: -1, scale: 1.02 }` + glow on buttons
- NumberTicker spring count-up (damping 50, stiffness 90)

**WidgetCardC API:**
```tsx
<WidgetCardC
  widgetId="..."
  title="..."
  icon={LucideIcon}
  neonColor="#hexOrCssVar"  // neon accent (border hover + glow shadow + top edge)
  kicker="TODAY"
  collapsible
  removable
  draggable
  children
  loading / error / empty
/>
```

## Shared dependencies (all 3 prototypes)
- `motion/react` (framer-motion v12) — enter/exit, hover, gauge animation
- `NumberTicker` from `../ui/number-ticker` — spring count-up
- `BorderBeam` from `../ui/border-beam` — tier-change sweep (SIGNAL + NEON only)
- `Chart` + `registerables` from `chart.js` — productivity chart (all 3)
- `Lucide` icons — all widget icons
- `WidgetCard` base props interface — identical across all 3 variants

## Data shape (all 3 use the same data)
```typescript
// Stopwatch
{ productiveMs: number, distractingMs: number, isPaused: boolean, lastTier: 'productive' | 'neutral' | 'distracting' | null }

// Tracking score
{ score: number (0-100), streak: number, completionRate: number (0-100), focusHours: number, trend: 'up' | 'down' | 'stable' }

// Productivity chart
{ data: { day: string, productive: number (hours), neutral: number, distracting: number }[], period: 'day' | 'week' | 'month' }
```

## Build
```bash
cd /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App\ Tracker
npm run build
```

All files are new (`.tsx` files in `src/components/dashboard/`) — no existing files modified. Build should pass if chart.js and all UI primitives are installed.

## How to choose
1. Read the 3 PROMPT_*.md files for full design details (this README is the summary)
2. The `.tsx` files are working skeleton implementations — import them and drop into the dashboard to see each prototype live
3. Pick the visual language that matches what you want the dashboard to feel like:
   - **SIGNAL** — clear, purposeful, every widget has a distinct identity
   - **TERMINAL CHIC** — dense, mono, technical, snappy
   - **NEON GLASS** — premium, polished, alive, glowing

## Files created
```
src/components/dashboard/
  WidgetCardA_SIGNAL.tsx         (9504 bytes)
  WidgetCardB_TERMINAL.tsx      (8176 bytes)
  WidgetCardC_NEON.tsx          (10042 bytes)
  StopwatchPanelA_SIGNAL.tsx    (8368 bytes)
  StopwatchPanelB_TERMINAL.tsx  (7086 bytes)
  StopwatchPanelC_NEON.tsx      (8757 bytes)
  TrackingScorePanelA_SIGNAL.tsx (6875 bytes)
  TrackingScorePanelB_TERMINAL.tsx (6591 bytes)
  TrackingScorePanelC_NEON.tsx  (7256 bytes)
  ProductivityChartA_SIGNAL.tsx (9003 bytes)
  ProductivityChartB_TERMINAL.tsx (8537 bytes)
  ProductivityChartC_NEON.tsx   (8813 bytes)

agent/docs/generate-prompt-docs/dashboard-cards-redesign-24092026/
  CONTEXT_BUNDLE.md             (10272 bytes)
  PROMPT_A_SIGNAL.md            (22436 bytes)
  PROMPT_B_TERMINAL_CHIC.md     (22499 bytes)
  PROMPT_C_NEON_GLASS.md        (24597 bytes)
```
