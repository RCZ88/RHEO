# PROMPT.md — Dashboard Bottom Cards De-Slop

**Target AI:** Claude (or equivalent)
**Task Type:** Design + Engineering (refactor existing components)
**Scope:** Dashboard cards below the 4-group row ONLY: ScheduleCard, InsightStrip, ProductivityChart, ActivityFeed.

---

## Raw Request (Verbatim)

> all of the cards in the dashbaord looks like SUPER AI SLOP. ITS WORSE LOOKING THAAN THE WORSE AI SLOP. FIX IT
> the top color scnet is just absoloutely ridiculous
> WH DID YOU CHANGE THE FUCKING STOPWATCH THE EVERYTHING? I SAID ONLY THE CARDS THAT ARE BELOW THE 4 GROUP CARDS IDIOT
> NOW IT LOOKS EVEN WORSE IDIOT
> tHE CARDS YOU CHANGE LSO LOOKS FUCKING BAD
> @generateprompt skill to fix the bottom underth te 4 group cards and tfor the reSt on the dashboard, restore it to th rpeviosu version WITHOUT GIT COMMANDS THAT IS DESTRUCTIVE

---

## Problem Statement

The dashboard cards below the 4-group row (Goals/Deadlines/Focus/LongestFocus) look like "AI slop" — excessive rainbow colors, glow shadows, animated particles, staggered entrances, decorative hairlines, and raw hex values everywhere. The user wants them to look like a professional developer data tool: flat, single-hue chrome, token-only colors, no ambient motion.

The previous attempt also modified cards OUTSIDE scope (StatusBand, MomentumHero, TierBreakdownStrip) and made things worse. Those have been reverted. Do NOT touch them.

---

## Context Bundle

Read `CONTEXT_BUNDLE.md` in this folder first. It contains:
- Full slop inventory per card
- Reference components (WidgetCard, widgetTheme)
- Design tokens
- Motion rules (L1 COMPOSED)
- File paths
- What NOT to touch

---

## Engineering Task

Refactor these 4 cards to match the WidgetCard pattern:

### 1. ScheduleCard (src/pages/dashboard/ScheduleCard.tsx)
- Remove all raw hex colors. Use `var(--color-amber-400)` for schedule accent (from widgetTheme), `var(--border-subtle)`, `var(--color-card)`, `var(--text-primary/secondary/muted)`.
- Remove amber glow `box-shadow` on current entry. Use a simple left border or background tint instead.
- Remove `containerVariants` / `itemVariants` stagger. Render list statically.
- Remove pulsing "NOW" dot animation. Use a static dot or text label.
- Remove per-block colored left bars. Use a single flat border or no border.
- Remove motion buttons with scale. Use plain buttons with `transition-colors` only.
- Remove decorative `border-t` hairlines.
- Remove color swatches / color picker from form. Use a fixed accent color.
- Wrap in WidgetCard with kicker "SCHEDULE" from `getWidgetTheme('schedule-hero')`.
- Preserve all functionality: add/edit/delete form, day selector, current/upcoming/past sections, linked goals.

### 2. InsightStrip (src/pages/dashboard/InsightStrip.tsx)
- Remove `<BlurFade>` wrapper.
- Remove per-domain accent map. Use a single accent (page-accent or `var(--info)`) for all insight cards.
- Remove gradient hairline per card.
- Remove staggered entrance per card.
- Remove hover lift `-translate-y-0.5`.
- Use flat card style: `rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-4`.
- Icon tile uses `var(--accent-muted)` bg + accent color.
- Domain label is muted text, not colored.

### 3. ProductivityChart (DashboardPage.tsx, 'productivity-chart' widget)
- Remove `<BlurFade>` wrapper.
- Remove `<Particles>` component.
- Remove `bg-zinc-900/50 backdrop-blur-xl` card styling. Use `bg-[var(--color-card)] border-[var(--border-subtle)]`.
- Remove decorative `border-t border-emerald-400/30` hairline.
- Chart datasets: use `var(--success)` for Productive, `var(--warning)` for Other, `var(--info)` for External — flat fills, no gradient functions.
- Chart tooltip: use `var(--color-card)` bg, `var(--text-primary)` text, `var(--border-subtle)` border.
- Legend: flat squares using `var(--success)`, `var(--warning)`, `var(--info)`.

### 4. ActivityFeed (DashboardPage.tsx, 'activity-feed' widget)
- Remove `<BlurFade>` wrapper.
- Remove `bg-zinc-900/50 backdrop-blur-xl` card styling. Use `bg-[var(--color-card)] border-[var(--border-subtle)]`.
- Remove decorative `border-t border-zinc-500/30` hairline.
- Tier dots: keep semantic colors (`var(--success)`, `var(--error)`, `var(--warning)`) but make them 6px dots, no pulse animation.
- Tier badges: use `var(--border-subtle)` border + `var(--text-secondary)` text, no colored bg pills.
- Session name: `var(--text-primary)`, category/timestamp: `var(--text-muted)`.
- Hover: `bg-[var(--border-subtle)]/20` subtle highlight only.

---

## Design Constraints

1. **LAMINAR §7:** No raw hex/rgba in TSX. All colors via `var(--*)` tokens.
2. **L1 COMPOSED motion:** No stagger, no infinite animation, no particles, no spring physics. Hover/press feedback only (150ms, transform + opacity).
3. **Impeccable:** No `box-shadow` for elevation. No `rounded-2xl/3xl`. No `transition: all`.
4. **WidgetCard pattern:** Use `getWidgetTheme(id)` for kicker/accent/tint. Wrap in WidgetCard for loading/error/empty/populated states.
5. **Single-hue chrome:** Page accent (pink-500) is the primary signal. Semantic colors (success/warning/error/info) ONLY for status indicators, not decoration.
6. **Dark mode only:** Strip any `light:` variants if they exist (or keep minimal if the project convention requires them, but prefer dark-only).

---

## Output Requirements

For each of the 4 cards, provide:
1. Full refactored source code (complete file or targeted diff).
2. Confirm zero raw hex values remain.
3. Confirm no BlurFade/Particles/NeonGradientCard/DotPattern/NumberTicker/AnimatedCircularProgressBar imports.
4. Confirm all 4 WidgetCard states are handled (loading/error/empty/populated).

---

## What NOT to Touch

- `src/pages/dashboard/StatusBand.tsx` — REVERTED, do NOT modify.
- `src/components/dashboard/MomentumHero.tsx` — REVERTED, do NOT modify.
- `src/pages/dashboard/TierBreakdownStrip.tsx` — REVERTED, do NOT modify.
- `src/components/dashboard/GoalsCard.tsx`, `DeadlinesCard.tsx`, `LongestFocusCard.tsx`, `QuickFocusCard.tsx` — CLEAN, do NOT modify.
- `src/components/dashboard/PinnedActivities.tsx`, `SummaryStrip.tsx`, `HeroBand.tsx`, `StopwatchTimer.tsx` — CLEAN, do NOT modify.
- `src/components/dashboard/WidgetCard.tsx`, `widgetTheme.ts` — CLEAN, do NOT modify.
- DashboardPage platform filter, manage button, CardLibrary modal — CLEAN, do NOT modify.

---

## Verification

After implementation:
1. `grep -c "raw hex pattern"` should return 0 for all modified files.
2. `grep -c "BlurFade\|Particles\|NeonGradientCard"` should return 0 for all modified files.
3. `npm run build` should pass.
4. Visually: flat cards, single-hue, no glow, no rainbow, no motion slop.
