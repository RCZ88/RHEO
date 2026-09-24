# Dashboard Glow Revamp — Design Prompt

## Raw Request
"the dashboard is lacking any good design at all. its TO PLAIN theres NO GOOD DESIGN AT ALL. widgets still touching the stopwatch and still too far from the top bar. whats the revamp for the stopwatch? why is the dashboard cards still so thin? why are the dashboard cards still so ugly? cant u maximize the space properly. it has so much width but ur not using it. all these four cards looks fucking ugly and looks like ai slop. WHERE IS THE GLOW ON THE STOPWATCH? WHY YOU KEEP CHANGING IT? THE PREVIOUS VERSIONS WAS VERY GOOD LOOKING. LOOK AT THE PREVIOUS DESIGN OF THE FUCKING STOPWATCH."

## Problem Statement
The dashboard page (`src/pages/DashboardPage.tsx`) lost its neon glow aesthetic. The `StatusBand` stopwatch component was stripped of its `NeonGradientCard`, `AnimatedCircularProgressBar`, `BlurFade`, `DotPattern`, and `NumberTicker` components. The `MomentumHero` lost its `MagicCard`, `BorderBeam`, and pulsing radial gradient glow. The `DeskFlowCardMotion` wrapper lacks proper `flex-1 min-h-0` causing widget height to collapse. The grid uses `5fr_3fr` instead of `8fr_4fr`, and the widgets button has `margin-top: 80px`. Spacing is excessive (`p-5 space-y-4`, `mb-4` rows).

## Context Bundle Reference
`CONTEXT_BUNDLE.md` in this folder contains the full source code of all changed files from commit `ec849f3` (the last good neon-glow version).

## A. List ALL Frontend Design Skills (MANDATORY)
1. **Frontend Design** — DeskFlow-specific component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions (typography, color, spatial, motion, interaction, responsive, UX writing), 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels (L1 Composed / L2 Responsive / L3 Expressive), motion taxonomy, recipes
5. **UI UX Pro Max** — industry-specific design rules (dev tools, AI/ML, financial), style library
6. **Design Taste System** — master aggregator, design variance knobs, anti-repetition rules
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

## B. MCP Server Inventory (MANDATORY)
| Component | Source | Use for |
|-----------|--------|---------|
| NeonGradientCard | `src/components/ui/neon-gradient-card.tsx` | Neon glow border card |
| AnimatedCircularProgressBar | `src/components/ui/animated-circular-progress-bar.tsx` | Animated progress ring |
| BlurFade | `src/components/ui/blur-fade.tsx` | Entrance animation |
| DotPattern | `src/components/ui/dot-pattern.tsx` | Background texture |
| NumberTicker | `src/components/ui/number-ticker.tsx` | Animated number counter |
| MagicCard | `src/components/ui/magic-card.tsx` | Gradient card with glow |
| BorderBeam | `src/components/ui/border-beam.tsx` | Rotating border glow |
| DeskFlowCardMotion | `src/components/dashboard/DeskFlowCard.tsx` | Glass card wrapper with hover lift |
| LayoutGrid | `lucide-react` | Widgets customization button icon |

## C. Anti-Slop Checklist
- [ ] No pure black (`#000`) backgrounds — always `zinc-950` or `zinc-900`
- [ ] No more than 3 accent colors in a single view
- [ ] No `opacity-50` on text — use dedicated color tokens
- [ ] No `rounded-2xl` or `rounded-3xl` — max `rounded-xl`
- [ ] No `box-shadow` for elevation — use border brightness and glass layers
- [ ] No `font-thin` on dark backgrounds — min weight 400
- [ ] No `transition: all` — specify exact properties
- [ ] No `margin-top: 80px` inline styles
- [ ] No flat gray cards without glass styling
- [ ] No template layouts without visual hierarchy
- [ ] No hidden content on mobile — reorganize instead
- [ ] Touch targets >= 44px even on desktop
- [ ] Visible focus rings (`ring-2 ring-pink-500/50`)
- [ ] All interactive elements have hover/focus/active/disabled states
- [ ] State changes animate 150-300ms, nothing snaps

## D. Source Code: Previous Version StatusBand (commit ec849f3)
### File: `src/pages/dashboard/StatusBand.tsx` (271 lines)
```tsx
import { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { BlurFade } from '../../components/ui/blur-fade';
import { NumberTicker } from '../../components/ui/number-ticker';
import { NeonGradientCard } from '../../components/ui/neon-gradient-card';
import { AnimatedCircularProgressBar } from '../../components/ui/animated-circular-progress-bar';
import { DotPattern } from '../../components/ui/dot-pattern';
import { Zap, Play, Globe, Monitor, Clock, ArrowUp, Activity } from 'lucide-react';

function formatTime(ms: number): string {
  if (!ms || !isFinite(ms)) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDate(): string {
  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayNames[now.getDay()]} ${monthNames[now.getMonth()]} ${now.getDate()}`;
}

interface StatusBandProps {
  displayTimeMs: number;
  isCurrentlyProductive: boolean;
  isDistracting: boolean;
  currentAppName: string;
  totalFocusedMs: number;
  browserName?: string;
  isInBrowser?: boolean;
  onStartFocus?: () => void;
  isPaused?: boolean;
  websiteTitle?: string;
  websiteDomain?: string;
  websiteCategory?: string;
}

function getAccentColor(state: 'productive' | 'neutral' | 'distracting') {
  switch (state) {
    case 'productive': return { dot: '#34d399', neonFirst: 'rgba(16,185,129,0.2)', neonSecond: 'rgba(59,130,246,0.15)', arc: '#34d399', dotBg: 'bg-emerald-500/15 text-emerald-400' };
    case 'distracting': return { dot: '#fbbf24', neonFirst: 'rgba(245,158,11,0.15)', neonSecond: 'rgba(239,68,68,0.12)', arc: '#fbbf24', dotBg: 'bg-amber-500/15 text-amber-400' };
    default: return { dot: '#71717a', neonFirst: 'rgba(99,102,241,0.1)', neonSecond: 'rgba(139,92,246,0.08)', arc: '#71717a', dotBg: 'bg-zinc-500/15 text-zinc-400' };
  }
}
```
Key implementation pattern:
- `NeonGradientCard` with `borderSize={1}`, `borderRadius={16}`, `neonColors={{ firstColor, secondColor }}`
- `AnimatedCircularProgressBar` showing `focusPercent` with `gaugePrimaryColor={accent.arc}`
- `BlurFade delay={0} duration={0.3}` entrance
- `DotPattern opacity={0.03} radius={1} gap={20}` background
- `NumberTicker value={totalMinutes} suffix="m" delay={300} duration={1200}`
- `motion.div` with `animate={{ opacity: [0.4, 1, 0.4] }}` for pulsing status dot
- `prevTierRef`, `transitions`, `setTransitions`, `transitionIdRef`, `showRecap`, `hideTimerRef`, `now`, `useMemo` for `recapLines`, `useEffect` for tier transitions and interval

## E. Source Code: Previous Version MomentumHero (commit ec849f3)
### File: `src/components/dashboard/MomentumHero.tsx` (198 lines)
```tsx
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Activity, ArrowUp, ArrowDown, Minus, Target, Clock, Zap } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import { BorderBeam } from '../ui/border-beam';
import { MagicCard } from '../ui/magic-card';
import type { MomentumScore } from './types';

export function MomentumHero({ momentum, loading = false }: MomentumHeroProps) {
  const score = momentum?.score ?? 0;
  const streak = momentum?.streak ?? 0;
  const consistency = momentum?.consistency ?? 0;
  const trend = momentum?.trend ?? 'stable';
  const completionRate = momentum?.completionRate ?? 0;
  const scheduleAdherence = momentum?.scheduleAdherence ?? 0;
  const trendInfo = trendConfig[trend];
  const TrendIcon = trendInfo.icon;
  const isActive = streak > 0 || score > 30;

  return (
    <MagicCard className="rounded-xl" gradientFrom="#ec4899" gradientTo="#a855f7" gradientColor="rgba(236,72,153,0.06)">
      <div className="relative p-5 min-h-[200px] flex flex-col bg-[rgba(24,24,27,0.60)] rounded-xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-pink-500/30 via-pink-500/10 to-transparent" />
        {isActive && <BorderBeam size={120} duration={8} colorFrom="#ec4899" colorTo="#f472b6" />}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-0 right-0 w-32 h-32 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 70%)', filter: 'blur(20px)' }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="relative z-10 flex flex-col flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 font-sans">Daily Momentum</span>
          <div className="flex items-baseline gap-2">
            <span className={`font-mono text-[40px] font-bold leading-none tracking-tight tabular-nums ${getScoreColor(score)}`}>
              <NumberTicker value={score} delay={200} duration={800} />
            </span>
            <span className="text-[13px] text-zinc-500 font-sans">/100</span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              <Flame size={12} className="text-pink-400" />
              <span className="text-[11px] text-zinc-400 font-sans">{streak} day streak</span>
            </div>
          )}
          <div className="mt-auto pt-3 border-t border-zinc-800/50 space-y-2 px-5 pb-5">
            <div className="flex items-center gap-2"><Target size={10} className="text-violet-400/70 shrink-0" />...</div>
            <div className="flex items-center gap-2"><Clock size={10} className="text-sky-400/70 shrink-0" />...</div>
            <div className="flex items-center gap-2"><Activity size={10} className="text-cyan-400/70 shrink-0" />...</div>
            <div className="flex items-center gap-2"><Flame size={10} className="text-amber-400/70 shrink-0" />...</div>
          </div>
        </div>
      </div>
    </MagicCard>
  );
}
```
Key implementation pattern:
- `MagicCard` with `gradientFrom="#ec4899" gradientTo="#a855f7" gradientColor="rgba(236,72,153,0.06)"`
- `BorderBeam size={120} duration={8} colorFrom="#ec4899" colorTo="#f472b6"`
- `motion.div` with `animate={{ opacity: [0.3, 0.6, 0.3] }}` + `filter: blur(20px)` for pulsing radial glow
- `NumberTicker value={score} delay={200} duration={800}`
- 4 breakdown rows: Goals (Target), Time (Clock), Consistency (Activity), Streak (Flame)
- Progress bars with `motion.div` `initial={{ width: 0 }}` → `animate={{ width: ... }}`

## F2. REDESIGN ALL 4 DASHBOARD CARDS WITH NEON GLOW
The PROMPT must instruct the target AI to redesign ALL 4 dashboard cards, not just StatusBand and MomentumHero. Every card inside DeskFlowCardMotion must have proper neon glow design.

### Card 1: StatusBand (Hero Stopwatch)
- NeonGradientCard with borderSize={1}, borderRadius={16}
- AnimatedCircularProgressBar with focusPercent gauge
- BlurFade entrance, DotPattern background, NumberTicker for minutes
- getAccentColor() returning neon colors per tier (productive=#34d399, distracting=#fbbf24, neutral=#71717a)
- motion.div pulsing status dot animate={{ opacity: [0.4, 1, 0.4] }}
- Focus button as <motion.button>, NOT <Button> from ui/button
- Header has bg-black/20 border border-white/[0.03] rounded-lg px-3 py-2
- Use <motion.button> for all interactive elements

### Card 2: MomentumHero (Momentum Score)
- MagicCard with gradientFrom="#ec4899" gradientTo="#a855f7" gradientColor="rgba(236,72,153,0.06)"
- BorderBeam size={120} duration={8} colorFrom="#ec4899" colorTo="#f472b6"
- motion.div pulsing radial glow animate={{ opacity: [0.3, 0.6, 0.3] }} + filter: blur(20px)
- NumberTicker for animated score display
- 4 breakdown rows (Goals/Target, Time/Clock, Consistency/Activity, Streak/Flame) with motion.progress bars
- Loading state: MagicCard with animate-pulse skeleton
- Inner content uses bg-[rgba(24,24,27,0.60)] rounded-xl

### Card 3: TierBreakdownStrip
- NeonGradientCard or MagicCard wrapper with pink-violet gradient
- AnimatedCircularProgressBar or custom progress bars per tier
- Neon border glow using neonColors matching tier (productive/emerald, distracting/amber, neutral/indigo)
- DotPattern background texture
- NumberTicker for hour counts
- BlurFade entrance animation
- Each tier row has colored neon accent bar (left border) matching tier color
- Progress bars use motion.div with initial={{ width: 0 }} → animate={{ width: ... }}

### Card 4: Activity Cards (PinnedActivities, GoalsCard, ScheduleCard, InsightStrip, QuickFocusCard, DeadlinesCard, LongestFocusCard)
- All wrapped in DeskFlowCardMotion with glass styling (rounded-xl bg-zinc-900/80 backdrop-blur-xl)
- Each card has neon border glow on hover using hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]
- SectionHeader with neon accent color
- Icons use lucide-react with proper neon colors
- Progress bars and metrics use NumberTicker and motion.progress bars
- Card titles use font-mono font-bold with neon accent
- QuickFocusCard has neon glow border when active
- GoalsCard uses NeonGradientCard with productive/neutral/distracting tier colors
- ScheduleCard uses MagicCard with pink-violet gradient
- InsightStrip uses NeonGradientCard with cyan/indigo gradient
- DeadlinesCard uses neon border accent
- LongestFocusCard uses neon glow

### DeskFlowCardMotion (wrapper for ALL cards)
- Must have flex-1 min-h-0 in base className
- rounded-xl bg-zinc-900/80 backdrop-blur-xl overflow-hidden
- hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]
- whileHover: { y: -2, scale: 1.005 }
- whileTap: { scale: 0.98 }

## F3. Source Code: DeskFlowCardMotion Fix
### File: `src/components/dashboard/DeskFlowCard.tsx`
```tsx
export function DeskFlowCardMotion({
  className,
  children,
  ...props
}: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "rounded-xl bg-zinc-900/80 backdrop-blur-xl overflow-hidden transition-colors duration-200 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)] flex-1 min-h-0",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}
```
Fix: Added `flex-1 min-h-0` to base className so the flex height chain works properly.

## G. Design Tokens (from frontend-design skill)
```
Background:     zinc-950 (base), zinc-900 (elevated), zinc-900/50 (glass)
Primary:        pink-500 (accent), pink-400 (hover), pink-600 (active)
Secondary:      cyan-400 (info), emerald-400 (success), amber-400 (warning)
Text:           zinc-100 (primary), zinc-400 (secondary), zinc-600 (disabled)
Border:         zinc-800 (subtle), zinc-700 (active), zinc-600/50 (glass edge)
Card padding:   p-5 (20px) — NEVER p-6 or p-8
Max border-radius: rounded-xl (12px) — NEVER rounded-2xl or rounded-3xl
No box-shadow for elevation — use border brightness and glass layers
8px grid — all spacing multiples of 8px
Typography Scale: Badge 11px/500, Meta 12px/400, Body 13px/400, Display 24-32px/700, Page title 18px/600
Font: Geist (display), JetBrains Mono (code) — max 2 families
```

## H. Animation Tokens (from animation-stack skill)
```
Neon glow pulse: motion.div with animate={{ opacity: [0.3, 0.6, 0.3] }} + filter: blur(20px)
Border beam: BorderBeam duration={8} continuous rotation
Entrance: BlurFade duration={0.3} — 300ms ease-out
Progress bars: motion.div initial={{ width: 0 }} → animate={{ width: ... }} with ease [0.16, 1, 0.3, 1]
Never animate width/height/top/left — only transform and opacity
```

## Engineering Task
1. **Restore StatusBand neon glow**: `NeonGradientCard` + `AnimatedCircularProgressBar` + `BlurFade` + `DotPattern` + `NumberTicker` + `getAccentColor()`. `prevTierRef`, `transitions`, `setTransitions`, `showRecap`, `hideTimerRef`, `now`, `useMemo` for `recapLines`. `motion.div` with `animate={{ opacity: [0.4, 1, 0.4] }}` for pulsing status dot.
2. **Restore MomentumHero glow**: `MagicCard` (pink-violet gradient) + `BorderBeam` + `motion.div` pulsing radial glow. `NumberTicker` for score. 4 breakdown rows with progress bars.
3. **Fix DeskFlowCardMotion height**: Add `flex-1 min-h-0` to base className so `flex-1` prop actually works.
4. **Fix grid width**: `grid-cols-[8fr_4fr]` with `gap-4`. StatusBand uses 67% of width.
5. **Fix widgets button**: Remove `style={{ marginTop: '80px' }}`. Use `sticky top-4 right-4` only.
6. **Fix spacing**: PageShell `p-3 space-y-2`, DeskFlowCardMotion `mb-2`, StatusBand `mb-1` header, `mt-1 pt-1` tracking info.
7. **Fix flex height chain**: PageShell dashboard = `flex flex-col flex-1 min-h-0`, DashboardPage content = `flex flex-col flex-1 min-h-0`.

## Design Task
The dashboard must match the previous neon-glow aesthetic from commit `ec849f3`. StatusBand uses `NeonGradientCard` with per-tier neon colors (productive=`rgba(16,185,129,0.2)/rgba(59,130,246,0.15)`, distracting=`rgba(245,158,11,0.15)/rgba(239,68,68,0.12)`, neutral=`rgba(99,102,241,0.1)/rgba(139,92,246,0.08)`). MomentumHero uses `MagicCard` with pink-violet gradient and `BorderBeam`. All glass cards use `bg-zinc-900/80 backdrop-blur-xl rounded-xl`. No box-shadow for elevation. 8px grid. Max 2 font families.

## UX Task
- Every data element has Empty/Loading/Error states
- Primary action (Focus button) is obvious within 1 second
- Hover/focus/active/disabled states on all interactive elements
- 150-300ms transitions on all state changes
- No AI slop — no flat gray cards, no generic padding, no template layouts
- Visual hierarchy: timer is the focal point (largest, highest contrast), status metadata is muted

## Constraints
- Must work with existing `DeskFlowCardMotion` wrapper
- Must not break `StatusBandProps` interface
- `MomentumHero` must accept `momentum: MomentumScore | null` and `loading?: boolean`
- All `lucide-react` icons already imported
- `NeonGradientCard`, `AnimatedCircularProgressBar`, `BlurFade`, `DotPattern`, `NumberTicker`, `MagicCard`, `BorderBeam` all exist and are importable
- Must use `git show ec849f3:src/pages/dashboard/StatusBand.tsx` to verify the previous implementation

## Output Format
The receiving AI must return a `RESULT.md` with:
1. Complete source code for every modified file
2. Design token specifications
3. Animation curve specifications
4. Verification steps
5. Any backend/IPC concerns
