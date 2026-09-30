# PROMPT — Dashboard Cards Redesign: 3 Prototype Designs

## Raw Request (verbatim)
"can you use all mcp and all skills to generate a prompt and like redesign the dashbaord CARDS PROPRLY EVERY WIDGET CARDS IS AI SLOP AN NO PROPER DESIGN AND LIKE ALL JUST BLAND AND GREY. FIX IT USING SOMETHING PROPERLY. GENERATE ME SOME MULTIPLE PROTOTYPES FOR ME TO CHOOSE FROM THAT INCLUDES ALL THE WIDGETS OPTIONS AND THE STOPWATCH N the tracking score thing and hte productivty chart. generate promp for that and hten try to do it ur self" — followed by "SO NO COMPROMISING THE DESIGN" and "THE MOTION SKILL OM THE @chartDASHBAORD SKILL THING AND THE OTHER NEW SKILL" and "LOOK AT THE 2 NEWEST SKILL" and "i forgot their names" and "i would like at least 3 protoype designs that IS FULL IN STYLE"

---

## What you are tasked to produce

**ONE response containing 3 complete, fully-detailed dashboard card redesign prototypes.** Each prototype must be a full visual spec — not a summary, not A/B/C bullet points. Each must include:

1. The widget card shell (how every card looks — borders, surfaces, padding, radius, typography, icon treatment)
2. The stopwatch/timer panel (full layout, timer display size/style, status indicator, action buttons, today's stats row)
3. The tracking score / momentum panel (full layout — gauge style or bar style, score display, trend, breakdown stats)
4. The productivity chart panel (full layout — chart type, colors, legend, period selector, stat row)
5. A representative sampling of the other widget types (Goals, Streak, Deadlines, Longest Focus, AI Usage, Schedule, Insights) so the user sees how the card shell applies across the board

The user will pick ONE of the 3 to implement. The other 2 are thrown away. So each must be complete enough to implement standalone.

---

## Context

See CONTEXT_BUNDLE.md for full codebase reference. Key facts:

### Stack (binding — from agent/docs/stack-setup.md + stack-usage-guide.md)
- React + TypeScript, Vite + Electron
- Tailwind CSS v4 (`@theme` in index.css, NO `@tailwind` directives)
- `motion` v12 (framer-motion) — primary animation engine
- GSAP via `src/services/design/MotionTemplates.ts` only — one engine per element
- chart.js for 2D charts (line/bar/doughnut). lightweight-charts for time-series
- lucide-react for icons. NEVER emoji as UI icons
- DO NOT install/use KokonutUI, Bklit UI, Anime.js — NOT in this project
- MCP: shadcn (`npx shadcn@latest mcp`) for primitives; reactbits for animated components
- The 2 newest skills: `ui-and-charts` (MCP-sourced shadcn/reactbits components + chart.js sourcing) and `motion-alive` (Liveliness Levels, motion taxonomy, recipes) + `animation-stack` (GSAP vs Anime.js selection)

### Design tokens (from src/index.css + frontend-design skill)
- Background: zinc-950 (base), zinc-900 (elevated)
- Primary accent: pink-500 (hover pink-400, active pink-600)
- Secondary: cyan-400 (info), emerald-400 (success), amber-400 (warning), rose-400 (error)
- Text: zinc-100 (primary), zinc-400 (secondary), zinc-600 (disabled/muted)
- Border: zinc-800 (subtle), zinc-700 (active)
- Per-page accent: Dashboard = pink-500 (`--page-accent`)
- Card padding: p-5 (20px) — NEVER p-6/p-8
- Border radius max: rounded-xl (12px) — NEVER rounded-2xl/3xl
- Fonts: Geist/Inter for UI, JetBrains Mono for numbers. NEVER font-thin on dark.
- Motion: 150-300ms, ease-out cubic-bezier(0.16, 1, 0.3, 1). transform+opacity only.
- MUST honor prefers-reduced-motion

### Timer/Stopwatch state (from DashboardPage.tsx)
- `currentProductiveMs` — accumulated productive milliseconds
- `currentDistractingMs` — accumulated distracting milliseconds
- `isPaused` — timer paused state
- `lastTier` — 'productive' | 'neutral' | 'distracting' | null
- `isCurrentlyProductive = lastTier === 'productive' && !isPaused`
- `isDistracting = lastTier === 'distracting' && !isPaused`
- `fmtSec(sec)` — formats seconds to h/m/s display
- Timer persisted to localStorage key `deskflow-timer-state`

### Tracking Score / Momentum (from types.ts + MomentumScore.tsx)
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
Scoring: completion 40%, focus/schedule 30%, streak 30%. Score color bands: >=80 emerald, >=60 sky, >=40 amber, >=20 orange, <20 red.

### Existing component inventory (real, in repo)
- `src/components/ui/magic-card.tsx` — Mouse-tracking gradient card
- `src/components/ui/border-beam.tsx` — Animated light on container border
- `src/components/ui/number-ticker.tsx` — Animated number count-up (spring)
- `src/components/ui/glare-hover.tsx` — Hover light glare
- `src/components/ui/animated-shiny-text.tsx` — Shiny gradient text
- `src/components/ui/confetti.tsx` — Confetti burst
- `src/components/ui/button.tsx`, `input.tsx`, `badge.tsx`, `select.tsx`, `card.tsx`, `skeleton.tsx`
- `src/components/dashboard/WidgetCard.tsx` — Base widget card wrapper (4 states)
- `src/components/dashboard/WidgetGrid.tsx` — Grid layout engine
- `src/components/dashboard/WidgetRegistry.ts` + `registerWidgets.ts` — Widget registration

### Widget registry (from registerWidgets.ts) — every widget that needs a card design
| ID | Name | Category |
|----|------|----------|
| status-band | Status Band (timer+score+streak) | productivity |
| schedule-hero | Schedule Hero | schedule |
| insight-strip | AI Insights | insights |
| goals-card | Goals | productivity |
| deadlines-card | Deadlines | schedule |
| focus-summary | Focus Summary | productivity |
| tier-breakdown | Tier Breakdown | analytics |
| pinned-activities | Pinned Activities | activity |
| productivity-chart | Productivity Chart | analytics |
| sleep-summary | Sleep Summary | health |
| mastery-summary | Mastery Summary | analytics |
| activity-feed | Activity Feed | activity |
| momentum-summary | Momentum Score | productivity |
| follow-through | Follow Through | productivity |
| calendar-summary | Calendar | schedule |
| ai-usage | AI Usage | ai |
| console-widget | Console | dev |
| finance-widget | Finance | finance |
| learn-widget | Learn | learning |
| browser-widget | Browser | browsing |
| brain-widget | Brain | insights |
| covenant-widget | Covenant | social |
| health-widget | Health | health |

### Anti-patterns (from frontend-design + impeccable skills)
- NEVER box-shadow elevation in dark themes (except neon glow as intentional accent)
- NEVER rounded-2xl/3xl — max rounded-xl
- NEVER pure black (#000) backgrounds
- NEVER spring physics in serious dev tools (except NumberTicker which already uses it)
- NEVER animate layout properties (width/height/top/left)
- NEVER >2 font families per view
- NEVER backdrop-blur on chrome/card surfaces UNLESS it's the NEON GLASS prototype's intentional glass-on-page-bg treatment
- NEVER emoji as UI icons
- NEVER flat wall of equally-weighted elements — need hierarchy
- NEVER design only happy path — must have empty/loading/error states

---

## THE MANDATE

Produce **3 distinct, fully-realized dashboard card redesign prototypes** in a single response. Each prototype is a complete visual language for the entire dashboard — every widget card follows the same design system within that prototype.

**Constraint: NO COMPROMISING. Each prototype must be a real, implementable design — not a half-baked concept.**

For each prototype, specify:
- **Name + one-line vibe descriptor**
- **Liveliness Level** (L1 Composed / L2 Responsive / L3 Expressive) — pick the right one for the vibe
- **Knobs:** DESIGN_VARIANCE (1-10), MOTION_INTENSITY (1-10), VISUAL_DENSITY (1-10)
- **Card surface treatment** — exact CSS classes / tokens for the card background, border, radius, padding
- **Category signal mechanism** — how does each widget type visually distinguish itself? (color coding, icon treatment, top-edge bar, border color, glow, etc.)
- **Typography hierarchy** — exact sizes/weights for: card title, kicker/eyebrow, stat values, labels, meta, display values (timer/score)
- **Stopwatch panel** — full layout spec: timer display (size, font, color), status indicator (dot/pill/ring, animated or static, labeled), action buttons (size, style, icon+label or icon-only), today's stats row (what stats, how displayed)
- **Tracking score panel** — full layout spec: score display mechanism (circular gauge / segmented bar / radial gauge / other), animation on score change, trend indicator, breakdown stats (what stats, how displayed)
- **Productivity chart panel** — full layout spec: chart type (bar/line/area/stacked), bar/line colors per category, grid treatment, axis labels, legend, period selector, stat row
- **Other widget types** — show how Goals, Streak, Deadlines, Longest Focus cards look in this prototype (card shell + content layout)
- **Motion treatment** — what animates, how (entrance stagger, hover feedback, state changes, ambient), durations, easing. Reference the motion-alive recipes where applicable.
- **Empty/loading/error states** — how each state looks for the stopwatch, score, and chart panels
- **Grid layout** — how cards arrange on the dashboard (columns, gaps, responsive behavior)

---

## The 3 prototypes must be visually distinct from each other

Do NOT produce 3 variants of the same thing (e.g., 3 slightly different grey card styles). Each prototype must have a fundamentally different visual language. Examples of distinct directions (you can use these or invent your own):

- **Direction 1: Solid signal panels** — each card is a solid surface with a colored top-edge bar indicating its category. Clean, purposeful, data-forward. Typography is Geist for labels + mono for numbers.
- **Direction 2: Terminal/dense mono** — flat dark panels, all numbers in JetBrains Mono, tight spacing, category signal = border color, dense data rows, technical feel.
- **Direction 3: Glass + neon** — dark glass surfaces (`bg-zinc-900/40 backdrop-blur-sm`) with neon-colored borders that brighten on hover + subtle glow shadows. Premium, polished, alive. (Note: glass on page background is allowed — glass on chrome is not.)

You may use these 3 or invent completely different ones, as long as they are visually distinct and each is a complete, implementable design. The user specifically said "FULL IN STYLE" — do not skimp.

---

## Output format

For each of the 3 prototypes, produce a section with this structure:

```
## PROTOTYPE N: [NAME] — [one-line vibe]

### Design language
[2-3 paragraphs describing the visual philosophy, what makes it distinct, what it feels like]

### Card shell
- Surface: [exact tokens/classes]
- Border: [exact tokens/classes]
- Radius: [exact value]
- Padding: [exact value]
- [any other card-level treatment]

### Category signal
[How each widget type is visually distinguished — table or list mapping widget types to their visual treatment]

### Typography
[Size/weight/color for each text role: title, kicker, stat value, label, meta, display]

### Stopwatch panel
[Full layout — every element, its size, style, position, color, animation]

### Tracking score panel
[Full layout — score display mechanism, animation, trend, breakdown]

### Productivity chart panel
[Full layout — chart type, colors, legend, controls, stats]

### Other widget examples
[Goals, Streak, Deadlines, Longest Focus — how they look in this prototype]

### Motion
[What animates, how, durations, easing. Reference motion-alive recipes.]

### States
[Empty + loading + error for stopwatch, score, chart]

### Grid layout
[Columns, gaps, responsive]
```

After all 3 prototypes, add a **comparison summary** — a short table or list that highlights the key differences between them so the user can make an informed choice. Not a recommendation — just clear contrast.

---

## What you are NOT doing

- You are NOT implementing any code. This is a design spec task.
- You are NOT producing 3 options for the user to pick from within a single design — you are producing 3 SEPARATE complete designs.
- You are NOT compromising on any prototype — each must be full and complete.
- You are NOT using KokonutUI, Bklit UI, or Anime.js — they are not in this project.
- You are NOT using spring physics on serious data display (NumberTicker is the exception — it already uses it).
- You are NOT designing only the happy path — every panel spec must include empty/loading/error states.

---

## The receiving AI must act as Lead Designer

You are the Lead Designer for the RHEO dashboard. Your job is to produce 3 complete, distinct, fully-detailed visual redesign specs for the dashboard card system. The user will pick one. Make each one good enough to implement directly. No filler. No AI slop. No bland grey cards.
