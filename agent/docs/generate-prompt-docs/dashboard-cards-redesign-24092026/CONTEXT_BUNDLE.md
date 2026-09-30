# CONTEXT_BUNDLE — Dashboard Cards Redesign (24092026)

## What this is
3 full visual-design prototype specs for the RHEO Dashboard page. Each prototype redesigns EVERY widget card properly — no bland grey AI slop. Includes: stopwatch/timer, tracking score (Momentum), productivity chart, goals, streak, deadlines, longest focus, AI usage, and all registered widgets. User picks one.

## Stack (binding — from agent/docs/stack-setup.md + stack-usage-guide.md)
- React + TypeScript, Vite + Electron
- Tailwind CSS v4 (NO `@tailwind` directives — use `@theme` in index.css)
- `motion` v12 (framer-motion) — primary animation engine
- GSAP via `src/services/design/MotionTemplates.ts` only — one engine per element
- chart.js for 2D charts (line/bar/doughnut). lightweight-charts for time-series
- lucide-react for icons. NEVER emoji as UI icons
- DO NOT install/use KokonutUI, Bklit UI, Anime.js — NOT in this project
- MCP: shadcn (`npx shadcn@latest mcp`) for primitives; reactbits for animated components

## Design tokens (from src/index.css + frontend-design skill)
### Colors
- Background: zinc-950 (base), zinc-900 (elevated)
- Primary accent: pink-500 (hover pink-400, active pink-600)
- Secondary: cyan-400 (info), emerald-400 (success), amber-400 (warning), rose-400 (error)
- Text: zinc-100 (primary), zinc-400 (secondary), zinc-600 (disabled/muted)
- Border: zinc-800 (subtle), zinc-700 (active)
- Per-page accent: Dashboard = pink-500 (`--page-accent: var(--pink-500)`)

### Typography
- Body: Geist/Inter 13px/400
- Body+: 14px/400 (stat values)
- Card title: 13px/600
- Section h2: 15px/600
- Page title: 18px/600
- Display (timer/score): 24-48px/700, monospace tabular-nums
- Mono: JetBrains Mono
- NEVER font-thin on dark backgrounds

### Spacing
- Card padding: p-5 (20px) — NEVER p-6/p-8
- Border radius max: rounded-xl (12px) — NEVER rounded-2xl/3xl
- 8px grid. Gaps: xs=4, sm=8, md=12, lg=16, xl=24

### Motion tokens
- fast: 150ms (hover/press)
- normal: 250ms (modals, tab swap)
- slow: 400ms (page transitions)
- ease-out: cubic-bezier(0.16, 1, 0.3, 1)
- NO spring physics in serious dev tools
- Animate transform + opacity ONLY. NEVER width/height/top/left
- MUST honor prefers-reduced-motion

### Card surface rules (LAMINAR §7 anti-slop)
- Solid card: `bg-[var(--color-card)]` + `border border-zinc-800/50`
- Glass on chrome = FORBIDDEN. No backdrop-blur on card surfaces.
- Hover: border brightens to `border-zinc-700/60` or accent/30 for interactive
- NO box-shadow for elevation in dark themes — use border brightness + glass layers

### Existing component inventory (real, in repo)
- `src/components/ui/magic-card.tsx` — Mouse-tracking gradient card (Motion template)
- `src/components/ui/border-beam.tsx` — Animated light on container border
- `src/components/ui/number-ticker.tsx` — Animated number count-up (spring)
- `src/components/ui/glare-hover.tsx` — Hover light glare effect
- `src/components/ui/animated-shiny-text.tsx` — Shiny gradient text animation
- `src/components/ui/confetti.tsx` — Confetti burst
- `src/components/ui/button.tsx`, `input.tsx`, `badge.tsx`, `select.tsx`, `card.tsx`, `skeleton.tsx`
- `src/components/dashboard/WidgetCard.tsx` — Base widget card wrapper (4 states: loading/error/empty/populated)
- `src/components/dashboard/WidgetGrid.tsx` — Grid layout engine (42KB)
- `src/components/dashboard/WidgetRegistry.ts` + `registerWidgets.ts` — Widget registration system

### Dashboard widget registry (from registerWidgets.ts)
| ID | Name | Category | Default size |
|----|------|----------|-------------|
| status-band | Status Band (timer+score+streak) | productivity | 2×1 |
| schedule-hero | Schedule Hero | schedule | 2×1 |
| insight-strip | AI Insights | insights | 2×1 |
| goals-card | Goals | productivity | 1×1 |
| deadlines-card | Deadlines | schedule | 1×1 |
| focus-summary | Focus Summary | productivity | 1×1 |
| tier-breakdown | Tier Breakdown | analytics | 1×1 |
| pinned-activities | Pinned Activities | activity | 1×1 |
| productivity-chart | Productivity Chart | analytics | 2×1 |
| sleep-summary | Sleep Summary | health | 1×1 |
| mastery-summary | Mastery Summary | analytics | 1×1 |
| activity-feed | Activity Feed | activity | 2×1 |
| momentum-summary | Momentum Score | productivity | 1×1 |
| follow-through | Follow Through | productivity | 1×1 |
| calendar-summary | Calendar | schedule | 1×1 |
| ai-usage | AI Usage | ai | 1×1 |
| console-widget | Console | dev | 1×1 |
| finance-widget | Finance | finance | 1×1 |
| learn-widget | Learn | learning | 1×1 |
| browser-widget | Browser | browsing | 1×1 |
| brain-widget | Brain | insights | 1×1 |
| covenant-widget | Covenant | social | 1×1 |
| health-widget | Health | health | 1×1 |

### Timer/Stopwatch state (from DashboardPage.tsx lines 290-370)
- `currentProductiveMs` — accumulated productive milliseconds (state + localStorage)
- `currentDistractingMs` — accumulated distracting milliseconds
- `isPaused` — timer paused state
- `lastTier` — 'productive' | 'neutral' | 'distracting' | null
- `isCurrentlyProductive = lastTier === 'productive' && !isPaused`
- `isDistracting = lastTier === 'distracting' && !isPaused`
- `distractions[]` — log of apps/sites that broke focus
- `productivitySessionStartRef`, `productivitySessionAppRef` — session tracking
- `fmtSec(sec)` — formats seconds to h/m/s display
- Timer persisted to localStorage key `deskflow-timer-state`
- Stopwatch refs: `stopwatchTimerRef`, `stopwatchAccumulatedRef`, `stopwatchLastTickRef`, `stopwatchActiveRef`, `stopwatchPausedRef`, `prevTierRef`

### Momentum Score (tracking score — from types.ts + MomentumScore.tsx)
```typescript
interface MomentumScore {
  score: number;        // 0-100
  streak: number;       // current day streak
  consistency: number;  // 0-100 weekly consistency
  trend: 'up' | 'down' | 'stable';
  completionRate: number;     // % goals done today
  scheduleAdherence: number;  // % time in scheduled blocks
}
```
Scoring weights: completion 40%, focus/schedule 30%, streak 30%. Score color bands: >=80 emerald, >=60 sky, >=40 amber, >=20 orange, <20 red.

### Existing card components (real files in dashboard/)
- `MomentumScore.tsx` — Circular progress gauge + breakdown bars (GlareHover wrap)
- `MomentumHero.tsx` — MagicCard + BorderBeam + NumberTicker hero (211 lines)
- `StreakCard.tsx` — Streak with milestone badges + category streaks (151 lines)
- `LongestFocusCard.tsx` — Focus sessions with today/week/allTime tabs (196 lines)
- `GoalsCard.tsx` — Full goals with checkboxes, LTG, suggestions, confetti (669 lines)
- `DeadlinesCard.tsx` — Deadline list with urgency
- `InsightsCard.tsx` — AI insight cards strip
- `FeatureCard.tsx` — Generic feature card
- `DrillDownCard.tsx` — Drill-down card
- `DailySurveyCard.tsx` — Daily survey
- `SpotlightCard.tsx` — Spotlight card
- `TimerResetOverlay.tsx` — Timer reset overlay
- `CardLibrary.tsx` — Card library (57KB)
- `LayoutEditor.tsx` — Layout editor (36KB)
- `WidgetLibraryPopup.tsx` — Widget picker popup (15KB)
- `WidgetSummaries.tsx` — Widget summary wrappers (32KB)
- `widgetTheme.ts` — Theme config (4KB)
- `useDashboardData.ts` — Data hook (11KB)
- `DashboardContext.tsx` — Context provider (2.6KB)

### Productivity chart context
- `ProductivityChartSummary` registered in WidgetRegistry
- Chart.js available for line/bar/doughnut charts
- Dashboard shows: weekly overview (stacked bar), heatmap (7×24 grid), focus sessions
- Period selector: day/week/month/allTime

### UI component sources available via MCP
- shadcn MCP: card, button, input, badge, select, skeleton, dialog, tabs, dropdown-menu, label, accordion, alert, alert-dialog, tooltip, popover, separator
- reactbits MCP: animated components (text animations, particle effects, hover effects)
- lucide-react: 1500+ icons (Target, Clock, Flame, TrendingUp, Zap, Activity, Calendar, Trophy, Monitor, AlertCircle, Sparkles, ArrowUp, ArrowDown, Minus, Check, Plus, X, Edit3, Trash2, ChevronDown, ChevronUp, RefreshCw, EyeOff, X, GripVertical)

### Anti-patterns (from frontend-design + impeccable skills)
- NEVER box-shadow elevation in dark themes
- NEVER rounded-2xl/3xl — max rounded-xl
- NEVER pure black (#000) backgrounds
- NEVER spring physics in serious tools
- NEVER animate layout properties
- NEVER >2 font families per view
- NEVER backdrop-blur on chrome/card surfaces
- NEVER emoji as UI icons
- NEVER flat wall of equally-weighted elements — need hierarchy
- NEVER design only happy path — must have empty/loading/error states

### Existing design refs (from agent/docs/)
- `agent/docs/motion_site_mechanics_10/` — 10 motion mechanics (Morphogen, Adjacent, Overpass, Nearside, Freeboard, Headway, Foreshock, Quorum, Harmonic, Deident)
- `agent/docs/backandfourth-docs/tugo-signature-motion/` — INITIAL_PROMPT.md + CONTEXT_BUNDLE.md for signature motion system
- Previous dashboard redesign attempts in `agent/docs/generate-prompt-docs/`: dashboard-redesign-27072026, dashboard-revamp-27072026, dashboard-ui-revamp-28072026, dashboard-glow-revamp-22092026, dashboard-widgets-22092026, dashboard-bottom-cards-deslop-12092026

### File paths for implementation
- Dashboard page: `src/pages/DashboardPage.tsx` (3109 lines)
- Widget components: `src/components/dashboard/*.tsx`
- UI primitives: `src/components/ui/*.tsx`
- Design tokens: `src/index.css` + `src/components/ai/design-tokens.css`
- Widget registry: `src/components/dashboard/WidgetRegistry.ts` + `registerWidgets.ts`
- Types: `src/components/dashboard/types.ts` + `src/types/goals.ts`

### What "properly designed" means here
Each widget card must have:
1. Distinct visual identity — not all the same grey box
2. Clear hierarchy — one focal point, muted metadata
3. Accent color usage — per-card accent from page token set, not random
4. Proper states — loading (skeleton), empty (icon + message + CTA), error (message + retry), populated
5. Motion that means something — entrance, hover feedback, state change — at L2 (Responsive) level
6. Real data display — no placeholder grey boxes in populated state
7. Interactive affordance — hover states, focus rings, clickable areas clearly indicated
