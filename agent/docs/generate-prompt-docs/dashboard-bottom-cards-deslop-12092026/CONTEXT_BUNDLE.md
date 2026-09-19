# CONTEXT_BUNDLE.md — Dashboard Bottom Cards De-Slop

**Created:** 2026-09-12
**Task:** Fix ScheduleCard, InsightStrip, ProductivityChart (row 6), ActivityFeed (row 7) — the cards below the 4-group row (Goals/Deadlines/Focus/Longest Focus) on the Dashboard.

---

## 1. Raw Request (Verbatim)

> all of the cards in the dashbaord looks like SUPER AI SLOP. ITS WORSE LOOKING THAAN THE WORSE AI SLOP. FIX IT
> USE MINIMAL OF 6 FRONTEND SKILL
> AND MINIMAL OF 3 MCP FOR THE SYTLES AND VERYTHING
> PLAN AND BRAINSTORM AND USE SUPER THINKING
> SKILL ROUTER SKILL
> GENERATEP ROMPT SKILL
> EVERRY AND ANYTHING YOU NEED
> the top color scnet is just absoloutely ridiculous
> HAVE YOU REVAMPED THE CARDS?
> WH DID YOU CHANGE THE FUCKING STOPWATCH THE EVERYTHING? I SAID ONLY THE CARDS THAT ARE BELOW THE 4 GROUP CARDS IDIOT
> NOW IT LOOKS EVEN WORSE IDIOT
> tHE CARDS YOU CHANGE LSO LOOKS FUCKING BAD
> CONTINUE FUCKASS WHAT ARE YOU DOING??????
> dCONTINUE
> @generateprompt skill to fix the bottom underth te 4 group cards and tfor the reSt on the dashboard, restore it to th rpeviosu version WITHOUT GIT COMMANDS THAT IS DESTRUCTIVE

**Clarified scope (from user corrections):**
- Scope = ONLY the cards **below** the 4-group row (Goals/Deadlines/Focus/LongestFocus). Specifically: ScheduleCard, InsightStrip, ProductivityChart, ActivityFeed.
- Restore the rest of the dashboard to the **previous version** (revert StatusBand, MomentumHero, TierBreakdownStrip changes which the user rejected).
- Do NOT use destructive git commands.

---

## 2. Slop Inventory (What's Wrong With Each Target)

### A. ScheduleCard (src/pages/dashboard/ScheduleCard.tsx, 480 lines)
- Raw hex `#f59e0b` / `#fbbf24` / `#34d399` / `#22d3ee` / `#8b5cf6` / `#fb7185` / `#60a5fa` hard-coded for block colors (violates LAMINAR §7: no raw hex in TSX).
- Amber glow `box-shadow` on current entry (line 203): `inset 0 0 0 1px ${ACCENT_BORDER}, 0 0 24px -6px ${ACCENT_SOFT}` — Impeccable forbids glow shadows.
- Stagger animation via `containerVariants` + `itemVariants` (lines 71-80, 352-477).
- Pulsing "NOW" dot (line 370-374) with infinite `animate` — violates L1 motion budget.
- Per-block colored left bars (lines 366, 418) — excessive visual weight.
- motion buttons with scale on hover (lines 313, 399-404, 449-453, 282-292).
- `border-t border-amber-500/30` hairlines (lines 176, 201) — decorative amber chrome.
- Color swatches for users to pick (COLORS array + color picker in form) — slop pattern.

### B. InsightStrip (src/pages/dashboard/InsightStrip.tsx, 90 lines)
- Wrapped in `<BlurFade delay={0.12} duration={0.4}>` (line 42) — BlurFade is a slop component.
- Per-domain accent map (lines 14-22): 7 different hue codes (pink, emerald, cyan, indigo, amber, sky, purple) for insight cards.
- Each insight card uses `${accent}18` bg, gradient hairline (line 60), domain icon — rainbow of cards.
- Staggered entrance per card (line 56-57): `delay: 0.16 + i * 0.1`.
- Hover lift `-translate-y-0.5` (line 58).

### C. ProductivityChart (DashboardPage.tsx:2677-2750)
- Wrapped in `<BlurFade delay={0.2} duration={0.4}>`.
- Emerald `<Particles quantity={30} color="#34d399">` (line 2680).
- `bg-zinc-900/50 backdrop-blur-xl border-zinc-800/60` — violates WidgetCard's no-blur LAMINAR rule.
- `border-t border-emerald-400/30` decorative hairline (line 2682).
- Three stacked datasets with gradient backgroundColor functions (emerald/amber/indigo) — rainbow.

### D. ActivityFeed (DashboardPage.tsx:2751-2784)
- Same blur/card styling as ProductivityChart.
- `border-t border-zinc-500/30` hairline (line 2753).
- Tier-colored dots: emerald/rose/amber per row (line 2766) — semantic but excessive when combined with badges.
- Tier-colored badge pills with `bg-${tier}-500/10 text-${tier}-400` (line 2774) — rainbow.

---

## 3. Reference Components (What Good Looks Like)

### WidgetCard (src/components/dashboard/WidgetCard.tsx, 273 lines)
The canonical card shell. LAMINAR-compliant: flat `rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)]`, no backdrop-blur, no box-shadow, `p-5`, no glow. Supports 4 states: loading/error/empty/populated. Accent token applied ONLY to icon tile + top hairline + hero numeral — one signal per card.

```tsx
// WidgetCard tokens used:
className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] text-[var(--text-primary)] ${className}`}
// Top hairline (gradient from transparent → accent → transparent):
style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
// Icon tile bg uses 15% opacity of accent:
style={{ backgroundColor: `${accent}15`, color: accent }}
```

### widgetTheme (src/components/dashboard/widgetTheme.ts, 149 lines)
Per-widget identity map. Kickers: NOW / SCHEDULE / AI INSIGHTS / TODAY / DUE SOON / DEEP WORK / TIME MIX / PINNED / TREND / RECOVERY / LEARNING / ECOSYSTEM / RECENT / MOMENTUM / MONEY / CALENDAR.

```tsx
// Relevant entries:
'schedule-hero': { kicker: 'SCHEDULE', accent: 'var(--color-amber-400)', tint: 'var(--warning-muted)' }
'insight-strip': { kicker: 'AI INSIGHTS', accent: 'var(--ws-accent)', tint: 'var(--info-muted)' }
```

### getWidgetTheme(id) fallback (line 139-149)
```tsx
export function getWidgetTheme(id: WidgetTheme) {
  return WIDGET_THEMES[id] ?? {
    kicker: 'WIDGET', accent: PAGE, tint: 'var(--accent-muted)',
    detailRoute: '/dashboard', detailLabel: 'Open details',
  };
}
```

---

## 4. Design Tokens (from index.css)

```css
:root {
  --color-card: #18181b;        /* zinc-900 — flat card bg */
  --border-subtle: #27272a;     /* zinc-800 */
  --text-primary: #f4f4f5;      /* zinc-100 */
  --text-secondary: #a1a1aa;    /* zinc-400 */
  --text-muted: #71717a;        /* zinc-500 */
  --page-accent: /* per-page, dashboard = pink-500 = #ec4899 */
  --accent-muted: /* 10% opacity of page-accent */
  --success: #34d399;           /* emerald-400 */
  --warning: #fbbf24;           /* amber-400 */
  --error: #f87171;             /* red-400 */
  --info: #22d3ee;              /* cyan-400 */
}
```

**LAMINAR §7:** No raw hex/rgba in TSX. All values must be `var()` refs.

---

## 5. Motion Rules (from motion-alive + frontend-design)

**Liveliness Level L1 COMPOSED** (developer data tool):
- Allowed: hover/focus/press feedback, fade/slide enter+exit, accordion, tab swap, skeleton→content, gentle number count-up.
- **Forbidden:** ambient/always-on motion, parallax, particles, spring physics, scroll choreography, infinite repeats, staggered entrances.
- Timing: 120-200ms, transform + opacity only, ease-out.
- Disabled buttons: `opacity-40 cursor-not-allowed`.

**Frontend Design anti-patterns:**
- NEVER use `box-shadow` for elevation in dark themes — use border brightness and glass layers instead.
- NEVER animate `width`, `height`, `top`, `left` — use transform and opacity only.
- NEVER use `transition: all 0.3s` — specify exact properties.
- NEVER use `rounded-2xl` (16px) or `rounded-3xl` (24px) — max is `rounded-xl` (12px).

---

## 6. File Paths

- ScheduleCard: `src/pages/dashboard/ScheduleCard.tsx`
- InsightStrip: `src/pages/dashboard/InsightStrip.tsx`
- ProductivityChart: `src/pages/DashboardPage.tsx` (lines 2677-2750, registered as 'productivity-chart' in widget map)
- ActivityFeed: `src/pages/DashboardPage.tsx` (lines 2751-2784, registered as 'activity-feed' in widget map)
- WidgetCard: `src/components/dashboard/WidgetCard.tsx`
- widgetTheme: `src/components/dashboard/widgetTheme.ts`
- DashboardPage main render: `src/pages/DashboardPage.tsx`

---

## 7. IPC / Backend Context

None of these cards require backend/IPC changes. ScheduleCard already has `onAdd/onUpdate/onDelete` callbacks wired to `window.deskflowAPI`. InsightStrip receives `insights` as a prop. ProductivityChart and ActivityFeed read from local component state (`chartBarsResult`, `activityFeedWithElapsed`).

---

## 8. What NOT to Touch

- `src/pages/DashboardPage.tsx` platform filter toggle (lines 2793-2820), manage dashboard button (2822-2831), CardLibrary modal (2833-2850) — CLEAN.
- `GoalsCard`, `DeadlinesCard`, `LongestFocusCard`, `QuickFocusCard`, `PinnedActivities`, `SummaryStrip` — CLEAN, do NOT modify.
- `HeroBand`, `StopwatchTimer` — CLEAN (top area, out of scope).
- `StatusBand`, `MomentumHero`, `TierBreakdownStrip` — **REVERTED** to previous version, do NOT touch.

---

## 9. Existing Patterns to Match

All target cards should follow the WidgetCard pattern:
1. Accept `widgetId`, `title`, `icon`, `accent`, `kicker` from `getWidgetTheme(id)`.
2. Use WidgetCard wrapper with all 4 states (loading/error/empty/populated).
3. Card chrome: `rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-5` — no blur, no glow, no decorative hairlines.
4. Accent applied ONLY to: icon tile, top hero numeral, status dot.
5. No per-item colored bars, no rainbow, no stagger, no infinite motion.
6. All colors via `var(--*)` tokens — zero raw hex in TSX.
