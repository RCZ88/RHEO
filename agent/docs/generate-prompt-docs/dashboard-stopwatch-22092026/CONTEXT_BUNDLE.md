# DeskFlow Dashboard — Stopwatch Design Options

> **Generated:** 2026-09-22
> **Task:** 3 distinct StatusBand/stopwatch designs for user selection
> **Date:** 22092026

---

## Design Options Overview

Three distinct visual designs for the StatusBand (stopwatch) widget. Each includes daily momentum tracking. User selects one.

### Design A — "Clean Minimal" (from commit `513db2d`)
**Source:** `git show 513db2d:src/pages/dashboard/StatusBand.tsx`
- `BlurFade` wrapper
- `NumberTicker` animated numbers
- `AnimatedCircularProgressBar`
- Plain shadcn `Button`
- Green/amber/zinc accents (no neon, no glow)
- Clean, functional, no decoration
- **Border:** Subtle `border-t border-[var(--ws-border)]` on cards
- **Motion:** `motion/react` with `BlurFade` entrance
- **Accent:** Emerald green for productive, amber for distracting, zinc for idle

### Design B — "Neon Glow" (from commit `e6139aa`)
**Source:** `git show e6139aa:src/pages/dashboard/StatusBand.tsx`
- `NeonGradientCard` with gradient border glow
- `DotPattern` background decoration
- `BlurFade` wrapper
- `NumberTicker` animated numbers
- `AnimatedCircularProgressBar`
- Neon emerald/blue gradient borders
- **Border:** `NeonGradientCard` with `borderSize` prop
- **Motion:** Same `motion/react` + `BlurFade`
- **Accent:** Emerald `#34d399` → blue `#3b82f6` gradient neon glow

### Design C — "Glass Surface" (current, FIXED)
**Source:** `src/pages/dashboard/StatusBand.tsx` (after pink accent removal)
- `GlassCard` variant="elevated" (no accent)
- `AnimatedCircularProgressBar`
- `NumberTicker`
- Plain `Button`
- Solid zinc surfaces, no neon, no gradient
- **Border:** `border border-zinc-700/50` hairline
- **Motion:** `motion/react` with `AnimatePresence`
- **Accent:** Clean zinc, emerald green for productive, amber for distracting

### Common Elements (ALL designs include):
- Daily momentum progress ring
- Today's date
- Focus minutes counter
- Current app name
- Tracking status (Idle/Locked In/Distracting)
- Start Focus button
- 4-state coverage (loading/empty/error/populated)
- `motion/react` only
- `rounded-[10px]` max
- DeskFlow tokens (`--ws-surface`, `--ws-surface-raised`, etc.)

---

## Component References

| Component | File | Use |
|-----------|------|-----|
| `BlurFade` | `src/components/ui/blur-fade.tsx` | Entrance animation (Designs A & B) |
| `NeonGradientCard` | `src/components/ui/neon-gradient-card.tsx` | Glowing gradient border (Design B) |
| `BorderBeam` | `src/components/ui/border-beam.tsx` | Animated border light (Design B) |
| `DotPattern` | `src/components/ui/dot-pattern.tsx` | Background pattern (Design B) |
| `AnimatedCircularProgressBar` | `src/components/ui/animated-circular-progress-bar.tsx` | Progress ring (ALL) |
| `NumberTicker` | `src/components/ui/number-ticker.tsx` | Animated time display (ALL) |
| `GlassCard` | `src/components/GlassCard.tsx` | Card wrapper (Design C) |
| `Button` | `src/components/ui/button.tsx` | CTA button (ALL) |
| `Card` | `src/components/ui/card.tsx` | shadcn Card (Design A) |

---

## Daily Momentum Inclusion

All 3 designs MUST include a daily momentum section:
- Progress ring showing today's focus vs target (240 min)
- Momentum score display
- Streak counter
- Weekly trend sparkline

---

## CardLibrary Widget Button

The dashboard has a "Widgets" floating action button (top-right) that opens the CardLibrary modal. This works via:
- `showCardLibrary` state in `DashboardPage.tsx`
- `CardLibrary` component from `src/components/dashboard/CardLibrary.tsx`
- AnimatePresence modal overlay

---

## Implementation Notes

- `useDashboardDataContext()` for data access
- `window.deskflowAPI` for IPC calls
- `useNavigate()` for click-to-navigate
- `motion/react` for ALL animations
- NO `framer-motion` direct imports
- NO `whileHover` scale (hover = hairline brightening only)
- NO `box-shadow` for elevation
- NO decorative gradients on chrome (except Design B's neon border which IS the feature)
- `prefers-reduced-motion` respected
