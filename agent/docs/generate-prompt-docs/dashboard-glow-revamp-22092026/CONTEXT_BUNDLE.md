# Dashboard Glow Revamp — Context Bundle

## Problem
Dashboard looks "too plain" with no good design. Stopwatch lacks neon glow effect, widgets are squished, spacing is wrong, and overall visual design is AI-slop quality.

## Changed Files (Current Session)

### 1. `src/pages/dashboard/StatusBand.tsx` — Full rewrite with neon glow
**Before:** Plain `div` with `text-[22px]` timer, no glow, no circular progress, no neon border
**After:** `NeonGradientCard` + `AnimatedCircularProgressBar` + `BlurFade` + `DotPattern` + `NumberTicker`
- `getAccentColor()` function returns neon glow colors per tier (productive=`#34d399`, distracting=`#fbbf24`, neutral=`#71717a`)
- `NeonGradientCard` with `borderSize={1}`, `borderRadius={16}`, `neonColors={{ firstColor, secondColor }}`
- `AnimatedCircularProgressBar` showing `focusPercent` (0-100) based on `totalMinutes / 240 * 100`
- `BlurFade` entrance animation
- `DotPattern` background texture
- `NumberTicker` for animated minute counter
- `Zap`, `Play`, `Globe`, `Monitor`, `Clock`, `Activity` icons
- Time display: `hours:minutes:seconds` in `[32px] font-mono font-bold`

### 2. `src/components/dashboard/MomentumHero.tsx` — Restored MagicCard + BorderBeam
**Before:** Plain `div` with `rounded-xl border border-zinc-800/50`, no glow
**After:** `MagicCard` + `BorderBeam` + `motion.div` pulsing glow
- `MagicCard` with `gradientFrom="#ec4899" gradientTo="#a855f7" gradientColor="rgba(236,72,153,0.06)"`
- `BorderBeam size={120} duration={8} colorFrom="#ec4899" colorTo="#f472b6"`
- `motion.div` with `animate={{ opacity: [0.3, 0.6, 0.3] }}` radial glow pulse
- `NumberTicker` for animated score
- `Flame`, `Target`, `Clock`, `Activity`, `ArrowUp`, `ArrowDown`, `Minus` icons
- Pink-violet gradient theme

### 3. `src/pages/DashboardPage.tsx` — Grid + spacing fixes
- `marginTop: '80px'` removed from widgets button
- Grid changed from `5fr_3fr` → `8fr_4fr` (wider stopwatch)
- `gap-0` → `gap-4` (proper column separation)
- `mb-4` → `mb-2` on all DeskFlowCardMotion rows
- `flex-1` added to parent containers for proper flex height chain

### 4. `src/components/PageShell.tsx` — Dashboard flex fix
- `dashboard: 'p-5 space-y-4'` → `'p-3 space-y-2 flex flex-col flex-1 min-h-0'`
- Fixes `flex-1` chain so DeskFlowCardMotion gets proper height

### 5. `src/components/dashboard/DeskFlowCard.tsx` — Already has proper glass styling
- `DeskFlowCardMotion`: `rounded-xl bg-zinc-900/80 backdrop-blur-xl` with hover glow

## Design Tokens (from frontend-design skill)
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
```

## Typography Scale
```
Badge:      11px/500
Meta:       12px/400
Body:       13px/400
Display:    24-32px/700  (timer values)
Page title: 18px/600
```

## Animation Stack (from animation-stack skill)
- **Neon glow pulse**: `motion.div` with `animate={{ opacity: [0.3, 0.6, 0.3] }}` + `filter: blur(20px)` — uses animejs-style easing
- **Border beam**: `BorderBeam` component with `duration={8}` — continuous rotation
- **Entrance**: `BlurFade` with `duration={0.3}` — 300ms ease-out
- **Progress bars**: `motion.div` with `initial={{ width: 0 }}` → `animate={{ width: ... }}`
- **Never animate** width/height/top/left — only transform and opacity
```
