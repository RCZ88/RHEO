# DeskFlow Dashboard Style Spec (SIGNAL / TERMINAL CHIC / NEON GLASS)

Style only. Same layout, same props, same names, same files. Every "Was" below is quoted from Section 19 of the bundle.

---

## 0. Read this first: 12 bugs in the current source that hurt the look

Fix these while restyling. Most are why the cards look dead.

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | WidgetCardA | `import { clsx } from "react"` does not exist | `import { cn } from "@/lib/utils"` and use `cn(...)` |
| 2 | WidgetCardA | Hover bar layer has `pointer-events-none` plus `onMouseEnter`. It never fires | Use `group-hover:opacity-100` (see A card) |
| 3 | WidgetCardB | Card has no `group` class, so `group-hover` on the drag grip never works | Add `group` |
| 4 | WidgetCardB | Hover glow is `whileHover` on a child of a `pointer-events-none` wrapper. Never fires | Removed (it was decorative anyway) |
| 5 | WidgetCardB / C | Collapse: collapsed branch animates `height: 0` but still renders children, exit is `height: auto`. Also collapse icon is `AlertTriangle` | Unmount when collapsed. Icon is `ChevronUp` / `ChevronDown` |
| 6 | WidgetCardC | `hover:border-[${neon}]/40` is built at runtime. Tailwind cannot see it, so the hover never works | Set `--page-accent` inline, use a static class |
| 7 | WidgetCardC | `${color}60` string concat breaks when `color` is `var(--page-accent)` (the default). `color="rose-400"` is not a CSS color | Use `mix()` helper (section 2) and `var(--dk-danger)` |
| 8 | StopwatchPanelC | Pulse ring is `absolute inset-2` on a 10px dot, so it is 0px wide. Invisible | `-inset-1` |
| 9 | TrackingScoreA | Empty segment has class `bg-zinc-800` but inline `#3f3f46` wins. Track fill uses `row.pct` (the weight) instead of `row.value` (the score). The bars show 40/30/30, not 72/55/80 | Use `--dk-border-strong`, animate to `row.value / 100` |
| 10 | TrackingScoreC | `colorCss.replace('400','300')` builds a dynamic Tailwind class. Never generated | `style={{ color }}` |
| 11 | ProductivityChartB / C | `max: 8` clips any day over 8h. `pointRadius` on bar datasets does nothing. Period pills change nothing | `suggestedMax: 8`. Drop `pointRadius`. Pills stay as style only |
| 12 | BlurFade | Caps duration at 0.2s. `CardEntrance duration={0.25}` is silently 0.2 | Set 0.2 so the code says what it does |

Non-style things I noticed and did **not** change: Stopwatch A `onClick={isPaused ? onStop : onPauseToggle}` means Resume calls `onStop`. `lastTier === "paused"` can never be true (type excludes it). TrackingScoreB label "Trend" shows the score. Reset has no confirm step. Error states have no retry prop.

---

## 1. Direction summary

**A. SIGNAL (Inter + JetBrains Mono, L1 Composed).** Solid instrument panel. Zinc everywhere. The only color is the top wire: a short lit segment on the left, dim wire after it, like an indicator lamp. Numbers sit in recessed wells. No glass, no glow, no lift. Feels like a hardware dial.

**B. TERMINAL CHIC (JetBrains Mono only, L1 Composed).** A terminal window. Flat, darkest surface, 8px corners, no shadows. The border carries the category color at low alpha. Hierarchy comes from color, weight and dashed dividers, not from size. Title is bright accent, data is white, labels are muted lowercase. No more wall of 11px caps.

**C. NEON GLASS (Space Grotesk + JetBrains Mono, L2 Responsive).** The only glass direction. `bg-zinc-900/80 backdrop-blur-xl`, real elevation, a 1px neon edge, one glow that breathes slowly and changes color with state. Blur is used once per card (the card). Everything inside is a flat well, so it stays cheap and readable.

Distinct on purpose: A is solid with a top wire. B is flat with a colored border. C is glass with an edge and a lit corner. Different font pairs, different radius use, different accent channel.

---

## 2. Token sets (no new tokens)

Only existing `--dk-*`, `--ws-*`, `--page-accent`, Tailwind palette. Below is which token plays which role.

| Role | A SIGNAL | B TERMINAL | C NEON GLASS |
|------|----------|------------|--------------|
| Card fill | `--ws-surface-raised` (solid) | `--dk-bg-base` (solid) | `bg-zinc-900/80` + `backdrop-blur-xl` |
| Well fill | `--dk-bg-deep` | `--dk-bg-deep` | `--dk-bg-deep` at 60% |
| Card border rest | `--dk-border-subtle` | accent 28% | `--dk-border-default` |
| Card border hover | `--dk-border-strong` | accent 55% | accent 45% |
| Accent channel | top wire + kicker text | border + title + icon | top edge + icon box + corner glow |
| Depth | `--dk-sheen` only | none (flat) | `--dk-elev-2` + `--dk-sheen`, hover `--dk-elev-3` |
| Text primary / secondary / muted | `--dk-text-primary` / `-secondary` / `-muted` | same | same |
| Success / warn / danger | `--dk-success` / `--dk-warning` / `--dk-danger` | success / danger | success / danger |
| Focus | `ring-2 ring-pink-500/50 ring-offset-2 ring-offset-zinc-950` | `ring-2 ring-[var(--page-accent)] ring-offset-1 ring-offset-[var(--dk-bg-base)]` | `ring-2 ring-[var(--page-accent)]/50 ring-offset-2 ring-offset-zinc-950` |

Score bands (replace the hex in all three tracking panels):

```ts
const BAND_VAR = {           // was #34d399 #38bdf8/#22d3ee #fbbf24 #f97316 #f87171
  emerald: "var(--dk-success)",
  sky:     "var(--dk-type-planner)",
  amber:   "var(--dk-warning)",
  orange:  "var(--dk-type-annotation)",
  red:     "var(--dk-danger)",
} as const;
```

Shared helpers (put once, e.g. in `WidgetCardA_SIGNAL.tsx`, import elsewhere):

```ts
export const EASE = [0.16, 1, 0.3, 1] as const;
// works for hex AND var(): fixes bug 7
export const mix = (c: string, pct: number) =>
  `color-mix(in srgb, ${c} ${pct}%, transparent)`;
// 44px hit area for small controls (28px box + 8px each side)
export const HIT = "relative after:absolute after:-inset-2 after:content-['']";
// Chart.js cannot read var(). Resolve once on mount.
export const cssVar = (n: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim();
```

Rules used everywhere:
- Radii: cards 12 (`rounded-xl`), everything inside 8 (`rounded-lg`), dots and pills `rounded-full`. Chart bar marks keep their canvas radius (marks are not containers).
- Padding: cards `p-5` (A, C), `p-4` (B, dense). Grid 8px, 4px only for micro gaps.
- Never `transition-all`. Name the properties.
- CSS-only motion also gets `motion-reduce:transition-none motion-reduce:transform-none`. `motion/react` gets `useReducedMotion()`.
- Only one accent hue per surface. Success/warn/danger are semantic, not accents.

---

## 3. Component specs

### 3.1 WidgetCardA (SIGNAL)

**Was:** `group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 p-5` + `hover:border-zinc-700` + two stacked 2px bars, gradient `${hex} 0% -> ${hex}20 100%`.

**Now:**

```tsx
// card
cn("group relative overflow-hidden rounded-xl border border-[var(--dk-border-subtle)]",
   "bg-[var(--ws-surface-raised)] p-5 shadow-[var(--dk-sheen)]",
   hoverable && "hover:border-[var(--dk-border-strong)] transition-colors duration-150 motion-reduce:transition-none",
   className)

// SignalBar: dim wire always on, lit lamp always on, bright wire on hover
<div aria-hidden className="absolute inset-x-0 top-0 h-[2px] pointer-events-none">
  <div className="absolute inset-0" style={{ background: mix(hex, 20) }} />
  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 motion-reduce:transition-none"
       style={{ background: mix(hex, 45) }} />
  <div className="absolute left-0 top-0 h-full w-8" style={{ background: hex }} />   {/* the lamp */}
</div>
```

Delete the second overlay div (bug 2). Children wrapper stays `relative`. No lift, no glow, no elevation change.

**Kicker** (used by all A panels): `text-[11px] font-semibold uppercase tracking-[0.12em] ${CATEGORY_CLASS[category]}` (was hard-coded `text-pink-500` / `text-cyan-400`).

**Well** (used by all A panels): `rounded-lg border border-[var(--dk-border-subtle)] bg-[var(--dk-bg-deep)] px-4 py-3`. Label `text-[11px] font-medium text-[var(--dk-text-muted)]`. Value `mt-1 text-[14px] font-semibold tabular-nums font-mono text-[var(--dk-text-primary)]`. Empty value `--` gets `text-[var(--dk-text-muted)]`.

### 3.2 WidgetCardB (TERMINAL CHIC)

**Was:** `rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800`, header `p-4 pb-0`, label `text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-zinc-500`.

**Now** (JetBrains Mono only, `leading-[1.6]`):

```tsx
// Card: set the accent locally so children can use var(--page-accent)
<div style={{ "--page-accent": accent } as React.CSSProperties}
  className={`group relative rounded-lg bg-[var(--dk-bg-base)] text-[var(--dk-text-primary)] font-mono
    border border-[color-mix(in_srgb,var(--page-accent)_28%,transparent)]
    hover:border-[color-mix(in_srgb,var(--page-accent)_55%,transparent)]
    transition-colors duration-100 motion-reduce:transition-none ${className}`}>
```
Drop the `borderColor` prop path and the inner glow wrapper (bug 4). No shadow. Remove `overflow-hidden` only if a child needs it.

| Part | Now |
|------|-----|
| CardHeader | `relative flex flex-col gap-0.5 px-3 pt-2.5 pb-2 border-b border-dashed border-[var(--dk-border-subtle)]` |
| TerminalLabel (title) | `text-[11px] font-semibold uppercase tracking-[0.12em] leading-none text-[var(--page-accent)]` |
| Icon | `mr-2 text-[var(--page-accent)]`, size 12, stroke 1.5 |
| Kicker | `ml-2 font-normal normal-case tracking-normal text-[var(--dk-text-muted)]` text `// {kicker}` (was `— kicker`) |
| Description | `text-[12px] font-normal text-[var(--dk-text-muted)]` (was 10px italic) |
| Actions row | `absolute right-2 top-2 flex items-center gap-0.5` |
| CardContent | `px-3 py-3` |
| CardFooter | `flex items-center px-3 py-2 border-t border-dashed border-[var(--dk-border-subtle)]` |

Action buttons (Remove, Collapse), 28px box, 44px hit:
`${HIT} h-7 w-7 rounded-lg text-[var(--dk-text-muted)] hover:text-[var(--dk-text-primary)] hover:bg-[var(--dk-bg-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] transition-colors duration-100`. Keep both `aria-label`s. Add `title` with the same text. Icon size 12. Collapse icon: `collapsed ? ChevronDown : ChevronUp`.

Drag: card gets `cursor-grab active:cursor-grabbing active:border-[color-mix(in_srgb,var(--page-accent)_70%,transparent)]`. Grip moves to `absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[var(--dk-text-muted)]`, size 12.

### 3.3 WidgetCardC (NEON GLASS)

**Was:** `rounded-xl bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 ... transition-all duration-300`, `NeonEdge` `${color}60,${color}30,transparent`, `NeonIconBox` with `boxShadow 0 0 12px -4px`, blob `${neonColor}20` blur 24 pulsing `[0.2,0.4,0.2]` 4s.

**Now:**

```tsx
<div style={{ "--page-accent": neonColor } as React.CSSProperties}
  className={`group relative rounded-xl text-[var(--dk-text-primary)]
    bg-zinc-900/80 backdrop-blur-xl
    border border-[var(--dk-border-default)]
    shadow-[var(--dk-elev-2),var(--dk-sheen)]
    hover:border-[color-mix(in_srgb,var(--page-accent)_45%,transparent)]
    hover:-translate-y-0.5
    transition-[border-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
    motion-reduce:transition-none motion-reduce:hover:translate-y-0
    before:pointer-events-none before:absolute before:inset-0 before:rounded-xl
    before:shadow-[var(--dk-elev-3)] before:opacity-0 hover:before:opacity-100
    before:transition-opacity before:duration-200 motion-reduce:before:transition-none ${className}`}>
  {/* clip layer: edge + glow live here so the card can keep its outer shadow */}
  <div aria-hidden className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
    <NeonEdge color={neonColor} />
    <CornerGlow color={neonColor} />
  </div>
  ...header/content/footer with relative z-10
```
(The card no longer has `overflow-hidden`. The clip layer does that job. Same children, same order.)

**NeonEdge:** `absolute inset-x-0 top-0 h-px`, `background: linear-gradient(90deg, ${mix(color,70)}, ${mix(color,20)} 60%, transparent)`.

**NeonIconBox:** `rounded-lg` 28px, `background: mix(color,12)`, `border: 1px solid ${mix(color,28)}`, `boxShadow: var(--dk-sheen)`. Delete the glow shadow. Icon 14px, stroke 2, `color`.

**CornerGlow (the one ambient layer).** Why it exists: `backdrop-blur` only shows if something is behind the glass. This gives it something, and it shows state (color changes with `neonColor`).
```tsx
const reduce = useReducedMotion();
<motion.div className="absolute -top-10 -right-10 h-40 w-40 rounded-full"
  style={{ background: `radial-gradient(circle, ${mix(color,30)} 0%, transparent 70%)`, filter: "blur(24px)" }}
  animate={reduce ? { opacity: 0.16 } : { opacity: [0.1, 0.22, 0.1] }}
  transition={reduce ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: "easeInOut" }} />
```
This is the only looping animation allowed per card in C. Nothing else inside a C card may loop.

| Part | Now |
|------|-----|
| CardHeader | `flex flex-col gap-1 p-5 pb-0` |
| CardTitle | `flex items-center gap-3 font-display text-[13px] font-semibold tracking-tight` |
| Kicker | `font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--dk-text-muted)]` (was 10px, `-mt-0.5`) |
| CardDescription | `font-display text-[12px] text-[var(--dk-text-secondary)]` |
| CardContent | `p-5 pt-4` |
| CardFooter | `flex items-center p-5 pt-3 border-t border-[var(--dk-border-subtle)]` |
| Action buttons | same as B but `h-7 w-7`, icon 14, hover `bg-[var(--dk-accent-dim)]`, focus ring C |
| Drag grip | `absolute bottom-2 right-2`, `group-hover:opacity-100`, size 12 |
| Drag state | `active:border-[color-mix(in_srgb,var(--page-accent)_60%,transparent)] active:translate-y-0` |

### 3.4 StopwatchPanelA

Grid `grid-cols-[auto_1fr] gap-6` unchanged. Add `const reduce = useReducedMotion()`.

| Element | Was | Now |
|---------|-----|-----|
| Kicker | `text-[10px] ... text-pink-500` | shared A kicker, `CATEGORY_CLASS.productivity` |
| Timer | `text-[40px] font-bold ... font-['JetBrains_Mono']` | `text-[40px] font-bold leading-none tracking-tight tabular-nums font-mono text-[var(--dk-text-primary)]`. Split `display` on `:`, render colons as `<span className="text-[var(--dk-text-muted)]">:</span>` |
| Status dot | `bg-emerald-500 / bg-amber-500 / bg-zinc-500 / bg-zinc-600` | `bg-[var(--dk-success)] / bg-[var(--dk-warning)] / bg-[var(--dk-text-muted)] / bg-[var(--dk-text-faint)]`, still `h-2 w-2 rounded-full` |
| Status label | `text-[12px] font-medium text-zinc-400` | `text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dk-text-secondary)]` |
| Primary button | `h-9 px-4 rounded-lg bg-pink-500 ... focus-visible:outline-2 ...` | `h-11 px-5 rounded-lg bg-pink-500 text-zinc-950 text-[13px] font-semibold hover:bg-pink-400 active:bg-pink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150` |
| whileTap | `{ scale: 0.98 }` | `reduce ? undefined : { scale: 0.98 }` |
| Reset button | `h-9 px-3 ... border-zinc-700 text-zinc-400` | `h-11 px-4 rounded-lg border border-[var(--dk-border-default)] text-[13px] font-medium text-[var(--dk-text-secondary)] hover:text-[var(--dk-text-primary)] hover:border-[var(--dk-border-strong)] hover:bg-[var(--dk-accent-dim)] active:scale-[0.98] motion-reduce:active:scale-100 focus ring A transition-colors duration-150` |
| Wells | `bg-zinc-950/60 border-zinc-800/50` | shared A well. "Distracted" value turns `text-[var(--dk-warning)]` only when `> 0` |

`font-['JetBrains_Mono']` becomes `font-mono` everywhere (token, not a string).

### 3.5 StopwatchPanelB

Pass `accent` from state instead of stuffing `borderColor` into `className`:
`accent={isDistracting ? "var(--dk-danger)" : isProductive ? "var(--dk-type-focus)" : "var(--dk-text-muted)"}`. Remove `${borderColor} transition-colors` from `className`.

| Element | Was | Now |
|---------|-----|-----|
| Timer | `text-[52px] font-mono font-bold ...` | keep size. `text-[var(--dk-text-primary)]`. NumberTicker `duration={300}` (was 600) |
| Sub-time | `text-[14px] ... text-zinc-500 mt-1` | `text-[12px] text-[var(--dk-text-muted)] mt-1 tabular-nums` |
| Status row | `border-t border-zinc-800/30`, dot `animate-pulse` 2s | `border-t border-dashed border-[var(--dk-border-subtle)]`, static dot (L1 has no ambient loops) |
| Status dot colors | `bg-emerald-400 / bg-rose-400 / bg-zinc-600` | `bg-[var(--dk-success)] / bg-[var(--dk-danger)] / bg-[var(--dk-text-faint)]` |
| Status text | inline hex `#34d399 #f43f5e #71717a`, `— ` separator | state word `font-semibold` in `var(--dk-success)` / `var(--dk-danger)` / `var(--dk-text-muted)`, then ` / ` and the message in `text-[var(--dk-text-muted)]`. `text-[11px] uppercase tracking-[0.08em]` on the word only |
| Icon buttons | `min-w-[36px] min-h-[36px] rounded-md border-zinc-700 bg-zinc-800/50 ... transition-all` + `whileHover scale 1.05` | `${HIT} h-9 w-9 rounded-lg border border-[var(--dk-border-default)] bg-[var(--dk-bg-deep)] text-[var(--dk-text-secondary)] hover:border-[var(--dk-border-strong)] hover:text-[var(--dk-text-primary)] focus ring B transition-colors duration-100`. Remove `whileHover`. `whileTap={reduce ? undefined : { scale: 0.98 }}`. Add `title` |
| Resume button | `border-pink-500/30 bg-pink-500/5 text-pink-400` | `border-[color-mix(in_srgb,var(--page-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--page-accent)_8%,transparent)] text-[var(--page-accent)] hover:bg-[color-mix(in_srgb,var(--page-accent)_14%,transparent)]` |
| Meta labels | `text-[10px] uppercase tracking-wider text-zinc-600` | `text-[11px] normal-case text-[var(--dk-text-muted)]` |
| Meta values | `13px text-zinc-300`, Distracted `rose-400/70`, Streak `orange-400/80`, Score `pink-400/80` | `text-[14px] font-medium tabular-nums text-[var(--dk-text-primary)]`. Only Distracted is `text-[var(--dk-danger)]`. Score is `text-[var(--page-accent)]`. Streak stays primary |
| Meta divider | `border-t border-zinc-800/30` | `border-t border-dashed border-[var(--dk-border-subtle)]` |

### 3.6 StopwatchPanelC

Color inputs (was hex): `neonColor = isDistracting ? "var(--dk-danger)" : "var(--dk-type-focus)"`. `timerTextColor` becomes a class: `isProductive ? "text-[var(--page-accent)]" : "text-[var(--dk-text-primary)]"`.

| Element | Was | Now |
|---------|-----|-----|
| Timer | `text-[44px] font-mono font-bold ... style color` | keep size, use the class above. NumberTicker `duration={500}` |
| Sub-time | `13px text-zinc-500` | `text-[12px] font-mono text-[var(--dk-text-muted)]` |
| Status pill | `rounded-xl bg-zinc-900/40 backdrop-blur-sm border-zinc-800/50 px-4 py-2` | `rounded-full border border-[var(--dk-border-subtle)] bg-[var(--dk-bg-deep)]/60 px-3 py-1.5` (no nested blur) |
| Status dot | 10px, `motion.div` ring `inset-2`, pulses | 8px dot. Ring is static: `absolute -inset-1 rounded-full ring-1 ring-[color-mix(in_srgb,currentColor_35%,transparent)]`. No loop (card glow is the one loop) |
| Status text | mono caps 11px, hex colors, `— ` | `font-display text-[12px] font-medium`, word in state token color, message `text-[var(--dk-text-secondary)]`, joined with ` / ` |
| Buttons | `min-h-[40px] ... bg-zinc-900/40 backdrop-blur-sm ... hover:shadow-[glow] transition-all duration-300` | `${HIT} min-h-[44px] px-3 gap-1.5 rounded-lg border border-[var(--dk-border-default)] bg-[var(--dk-bg-raised)] font-display text-[12px] font-medium text-[var(--dk-text-secondary)] hover:text-[var(--dk-text-primary)] hover:bg-[var(--dk-accent-dim)] hover:border-[color-mix(in_srgb,var(--page-accent)_40%,transparent)] focus ring C transition-[border-color,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]`. Labels are "Pause" / "Stop" / "Resume" / "Reset" in normal case. Add `aria-label` (C had none). Stop hovers to `var(--dk-danger)` |
| Motion props | `whileHover { y:-1, scale:1.02 } whileTap { scale:.97 }` | `whileHover={reduce ? undefined : { y: -1 }}` `whileTap={reduce ? undefined : { scale: 0.98 }}` |
| Resume | `border-pink-500/30 bg-pink-500/5 text-pink-300` | `border-[color-mix(in_srgb,var(--page-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--page-accent)_10%,transparent)] text-[var(--page-accent)]` |
| Meta pills | `rounded-lg bg-zinc-900/30 backdrop-blur-sm border-zinc-800/30 p-3` | shared C well: `rounded-lg border border-[var(--dk-border-subtle)] bg-[var(--dk-bg-deep)]/60 p-3`. Heading `font-display text-[11px] font-medium text-[var(--dk-text-muted)] mb-1` (was mono caps). Row label `font-display text-[12px] text-[var(--dk-text-secondary)]`. Row value `font-mono text-[13px] font-semibold tabular-nums` |
| Row value colors | emerald / rose / orange / pink-300 | Productive and Streak: primary. Distracted: `var(--dk-danger)`. Score: `var(--page-accent)`. Flame icon `text-[var(--dk-text-muted)]` |
| BorderBeam | shown when productive | **Remove.** Second ambient loop, purely decorative |

### 3.7 TrackingScorePanelA

Color: `const color = BAND_VAR[band]`.

| Element | Was | Now |
|---------|-----|-----|
| Segments | `h-6 w-[6px] rounded-sm`, filled `boxShadow 0 0 6px ${color}40`, empty inline `#3f3f46` | `h-6 w-[6px] rounded-full transition-colors duration-150`. Filled: `style={{ backgroundColor: color }}`, no shadow. Empty: `bg-[var(--dk-border-strong)]` |
| Score | `text-[40px] ... font-['JetBrains_Mono']` | `text-[40px] font-bold leading-none tracking-tight tabular-nums font-mono text-[var(--dk-text-primary)]` |
| "/100" | `13px font-medium text-zinc-500` | `text-[13px] font-medium text-[var(--dk-text-muted)]` |
| Trend | `text-emerald-400 / red-400 / zinc-500`, 11px | `text-[var(--dk-success)] / var(--dk-danger) / var(--dk-text-muted)`, `text-[11px] font-medium` |
| Row label | `11px font-medium text-zinc-400 w-[80px]` | `text-[12px] font-medium text-[var(--dk-text-secondary)] w-[80px]` |
| Track | `h-[2px] bg-zinc-800 rounded-full` | `h-1 rounded-full bg-[var(--dk-border-default)] overflow-hidden` |
| Fill | `boxShadow 0 0 4px`, `scaleX: row.pct/100`, `0.5s` | `backgroundColor: color`, no shadow, `animate={{ scaleX: row.value / 100 }}` (bug 9), `transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }}`, `initial={reduce ? false : { scaleX: 0 }}` |
| Row value | `13px semibold font-['JetBrains_Mono'] w-[40px]` | `text-[14px] font-semibold tabular-nums font-mono text-[var(--dk-text-primary)] w-[40px] text-right` |
| Legend | `10px uppercase tracking-wider text-zinc-600`, `border-zinc-800/50` | `text-[11px] uppercase tracking-[0.08em] text-[var(--dk-text-muted)]`, `border-[var(--dk-border-subtle)]` |

### 3.8 TrackingScorePanelB

Card `accent={color}` where `color` uses `BAND_VAR` (replace `getScoreColor`).

| Element | Was | Now |
|---------|-----|-----|
| Score | `text-[28px] font-mono font-bold text-zinc-100` | same size, `text-[var(--dk-text-primary)]`. NumberTicker `duration={300}` |
| "/ 100" | `11px text-zinc-600 tracking-wider` | `text-[12px] text-[var(--dk-text-muted)]` |
| Bar wrapper | `flex rounded-none h-5 bg-zinc-800` | `flex h-4 gap-px rounded-lg overflow-hidden bg-[var(--dk-border-default)]` |
| Segments | `#fbbf24 / #34d399 / #22d3ee`, animate `width` | One hue, three steps: `color-mix(in srgb, var(--page-accent) 100% / 60% / 30%, transparent)` for Streak / Done / Focus. Fixed `style={{ width: X% }}`, animate `scaleX` 0 to 1, `transformOrigin: "left"`, `duration 0.2`, delays `0 / 0.04 / 0.08`, `ease EASE`. Reduced: `initial={false}` |
| Legend swatch | `w-1.5 h-1.5 rounded-sm` hex | `h-2 w-2 rounded-full` same three mixes |
| Legend text | `10px mono uppercase text-zinc-500` | `text-[11px] normal-case text-[var(--dk-text-muted)]` |
| Trend pill | `rounded-md bg-zinc-800 border-zinc-700`, `10px caps` | `rounded-lg border border-[var(--dk-border-default)] bg-[var(--dk-bg-deep)] px-2 py-1`, text `text-[11px] text-[var(--dk-text-secondary)]` |
| Trend icon colors | `emerald-400 / rose-400 / zinc-500` | `var(--dk-success) / var(--dk-danger) / var(--dk-text-muted)` |
| Meta | same recipe as 3.5 | same recipe as 3.5 |

### 3.9 TrackingScorePanelC

| Element | Was | Now |
|---------|-----|-----|
| neonColor | `getScoreColor` hex | `BAND_VAR[band]` |
| Outer breathing ring | `motion.div` blur, `[0.2,0.5,0.2]` 3s | **Remove.** Card corner glow is the one loop |
| Arc filter | `filter="url(#glow)"` + `<defs>` | **Remove** (decorative) |
| Track | `stroke="rgba(59,59,66,0.5)"` | `stroke="var(--dk-border-default)"` |
| Arc | `stroke={color}`, `1.5s` | same, `transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}`, `initial={reduce ? false : {...}}` |
| Score | `text-3xl font-bold font-mono style color` | `font-mono text-[30px] font-bold leading-none tabular-nums`, `style={{ color }}`. NumberTicker `duration={500}` |
| "/ 100" | `10px text-zinc-500 -mt-1` | `mt-1 font-display text-[11px] text-[var(--dk-text-muted)]` |
| Trend badge | `rounded-full bg-zinc-900/40 backdrop-blur-sm ...`, text colored by band | `rounded-full border border-[var(--dk-border-subtle)] bg-[var(--dk-bg-deep)]/60 px-2.5 py-1`, `font-display text-[11px] font-medium`, color: success / danger / muted by trend |
| Four wells | `bg-zinc-900/30 backdrop-blur-sm border-zinc-800/30 p-3`, icons orange/violet/cyan | shared C well. Heading `font-display text-[11px] font-medium text-[var(--dk-text-muted)]`. Icons `text-[var(--dk-text-muted)]` size 12. Value `font-mono text-[14px] font-semibold tabular-nums text-[var(--dk-text-primary)]`. Score value `style={{ color }}` (bug 10) |

### 3.10 ProductivityChartA

Resolve tokens once: `const t = useMemo(() => ({ grid: cssVar("--dk-border-subtle"), tick: cssVar("--dk-text-muted"), tipBg: cssVar("--dk-bg-base"), tipBorder: cssVar("--dk-border-default"), tipTitle: cssVar("--dk-text-primary"), tipBody: cssVar("--dk-text-secondary") }), [])`.

One hue rule: card is analytics (cyan), so Focus is cyan and Distracted is zinc.

```ts
const COLORS = {
  productive:  `${CATEGORY_ACCENT.analytics}B3`,   // was rgba(236,72,153,0.7) pink
  distracting: t.tick,                               // was rgba(251,191,36,0.55) amber
};
```

| Element | Was | Now |
|---------|-----|-----|
| Dataset radius | `borderRadius: 2` | keep |
| animation | `{ duration: 0 }` | `reduce ? { duration: 0 } : { duration: 200, easing: "easeOutQuart" }` |
| Tooltip | `#18181b / #fafafa / #a1a1aa / #3f3f46`, padding 8 | `t.tipBg / t.tipTitle / t.tipBody / t.tipBorder`, `padding: 8`, fonts JetBrains Mono 11 |
| Grid / ticks | `rgba(63,63,70,0.4)`, `#a1a1aa`, size 10 | `t.grid` (horizontal only, x grid off), `t.tick`, size 11 |
| Title | `text-[13px] font-semibold text-zinc-100 mb-4` | `text-[13px] font-semibold text-[var(--dk-text-primary)] mb-4` |
| Period buttons | `h-7 px-2.5 rounded-md text-[11px]`, active `bg-zinc-800 text-zinc-100` | `${HIT} h-7 px-3 rounded-lg border text-[11px] font-medium transition-colors duration-150 focus ring A`. Active: `bg-[var(--dk-accent-dim)] border-[var(--dk-border-default)] text-[var(--dk-text-primary)]`. Rest: `border-transparent text-[var(--dk-text-muted)] hover:text-[var(--dk-text-secondary)]`. Keep `aria-pressed` |
| Legend chips | `h-2.5 w-2.5 rounded-sm`, `11px text-zinc-400` | `h-2 w-2 rounded-full`, `text-[11px] font-medium text-[var(--dk-text-secondary)]` |
| Stat wells | same as 3.1 well | shared A well |

### 3.11 ProductivityChartB

Series (keep wireframe: `borderWidth: 2`, `borderRadius: 0`, `barPercentage: 0.6`). Delete `pointRadius`, `pointBackgroundColor`, `pointBorderColor`, `pointBorderWidth`.

| Series | Border | Fill |
|--------|--------|------|
| Productive | `cssVar("--dk-type-digest")` + `E6` | same + `26` |
| Neutral | `cssVar("--dk-text-muted")` + `B3` | same + `1A` |
| Distracting | `cssVar("--dk-danger")` + `CC` | same + `26` |

| Element | Was | Now |
|---------|-----|-----|
| Axis | `max: 8`, ticks `#52525b` 10px, grid `rgba(59,59,66,0.3)` | `suggestedMax: 8`, ticks `t.tick` 11px, grid `t.grid`, x grid off, `callback: v => v + "h"` kept |
| Animation | `600 easeOutQuad` | `reduce ? 0 : 200`, `easeOutQuart` |
| Tooltip | `#18181b / #71717a / #a1a1aa`, padding 6 | `t.tipBg / t.tipTitle / t.tipBody / t.tipBorder`, padding 8, mono 11 |
| Period buttons | `px-1.5 py-0.5 rounded text-[10px] uppercase`, active `bg-zinc-800 border-zinc-600` | `${HIT} h-6 px-2 rounded-lg border text-[11px] lowercase`. Active: `border-[color-mix(in_srgb,var(--page-accent)_40%,transparent)] bg-[var(--dk-bg-raised)] text-[var(--page-accent)]`. Rest: `border-transparent text-[var(--dk-text-muted)] hover:text-[var(--dk-text-secondary)]` |
| Legend swatch | `w-2 h-2 rounded-sm` rgba | `h-2 w-2 rounded-full`, same three colors |
| Legend text | `10px caps text-zinc-500` + `10px text-zinc-400` | label `text-[11px] text-[var(--dk-text-muted)]`, value `text-[11px] font-medium tabular-nums text-[var(--dk-text-primary)]` |
| Bottom stats | `border-zinc-800/30`, Best `emerald-400/70` | `border-t border-dashed border-[var(--dk-border-subtle)]`, Best `text-[var(--page-accent)]`, values `14px font-medium` |
| Loading bar | `h-3 w-40 rounded bg-zinc-800 animate-pulse` | `h-3 w-40 rounded-lg bg-[var(--dk-bg-raised)] animate-pulse` |

### 3.12 ProductivityChartC

| Series | Border | Fill |
|--------|--------|------|
| Productive | `cssVar("--dk-type-digest")` + `E6` | same + `8C` (was pink) |
| Neutral | `cssVar("--dk-text-muted")` + `99` | same + `59` |
| Distracting | `cssVar("--dk-danger")` + `E6` | same + `8C` |

Keep `borderWidth: 1`, `borderRadius: 4`, `barPercentage: 0.7`.

| Element | Was | Now |
|---------|-----|-----|
| Animation | `700 easeOutQuad` | `reduce ? 0 : 300`, `easeOutQuart` |
| Grid / ticks | `rgba(59,59,66,0.15)`, `#71717a / #52525b` | `t.grid`, `t.tick`, 11px |
| Tooltip | `rgba(13,13,13,0.95)` ... padding 8 | `t.tipBg`, border `t.tipBorder`, title `t.tipTitle` 11, body `t.tipBody` 12, padding 8 |
| Period buttons | `px-2 py-0.5 rounded-md text-[10px]`, active cyan/10 + `hover:shadow` glow | `${HIT} h-7 px-2.5 rounded-lg border font-mono text-[11px] uppercase tracking-[0.06em] transition-[background-color,border-color,color] duration-200`. Active: `bg-[color-mix(in_srgb,var(--page-accent)_12%,transparent)] border-[color-mix(in_srgb,var(--page-accent)_28%,transparent)] text-[var(--page-accent)]`. No glow shadow |
| Chart box | `h-40 rounded-lg bg-zinc-900/30 backdrop-blur-sm border-zinc-800/30 p-2` | `h-40 w-full rounded-lg border border-[var(--dk-border-subtle)] bg-[var(--dk-bg-deep)]/60 p-2` |
| Legend chips | `rounded-md bg-zinc-900/30 backdrop-blur-sm ...`, swatch `boxShadow` glow | `rounded-lg border border-[var(--dk-border-subtle)] bg-[var(--dk-bg-deep)]/60 px-2 py-1`, swatch `h-2 w-2 rounded-full`, no glow. Label `font-display text-[11px] text-[var(--dk-text-secondary)]` (not caps), value `font-mono text-[11px] font-medium tabular-nums text-[var(--dk-text-primary)]` |
| Bottom stats | glass pills, Best `emerald-400` | same well recipe, label `font-display text-[11px] text-[var(--dk-text-muted)]`, value `font-mono text-[14px] font-semibold text-[var(--dk-text-primary)]`, Best in `text-[var(--page-accent)]` |

### 3.13 CardEntrance and other entrance motion

`BlurFade` stays. Only delay and duration change.

```tsx
// A (exported, wraps all three A panels)
<BlurFade delay={reduce ? 0 : 0.04 * index} duration={reduce ? 0 : 0.2}>
```
BlurFade already returns a plain div when `useReducedMotion()` is true, so this is safe. B and C cards are not wrapped by `CardEntrance`, so they animate their own content:

| | Was | Now |
|---|-----|-----|
| B expanded | `initial { opacity:0, x:-4 }`, exit `x:4`, `0.15` | `initial { opacity: 0 }` `animate { opacity: 1 }` `exit { opacity: 0 }`, `duration: 0.1`, ease `EASE` (no slide: a terminal prints, it does not glide) |
| B collapsed | `height` animation (banned) | Content unmounted. `AnimatePresence` fades out `0.1s`. No height animation |
| C expanded | `initial { opacity:0, y:6, scale:0.98 }`, `0.3` | `initial { opacity: 0, y: 6 }` `animate { opacity: 1, y: 0 }` `exit { opacity: 0, y: -6 }`, `duration: 0.2`, ease `EASE`. Drop `scale` |
| C collapsed | `height` animation | Same as B, `0.15s` |
| Both | none | `const reduce = useReducedMotion()`. If true: `initial={false}`, `transition={{ duration: 0 }}` |

### 3.14 Preview page (layout unchanged, style only)

Keep every width and flex class. Restyle only: page bg `bg-[var(--dk-bg-deep)]`, section title `font-display text-[18px] font-semibold` (drop the third font `Geist` fallback so the page uses Inter), dot before section title uses each direction's own accent, `gap-2` stays, `mb-8` stays. Tab buttons `transition-all` becomes `transition-colors duration-150`.

---

## 4. Motion and interaction

| | A SIGNAL (L1) | B TERMINAL (L1) | C NEON GLASS (L2) |
|---|---|---|---|
| Card hover | border to `--dk-border-strong` (150ms), wire brightens 20% to 45% | border alpha 28% to 55% (100ms) | border alpha to 45%, `translateY(-2px)`, elev-3 fades in via `::before` opacity (200ms) |
| Button hover | color / border only | color / border only | color / border + `y:-1` (motion) |
| Pressed | `scale 0.98`, bg `pink-600` | `scale 0.98` | `scale 0.98` |
| Focus visible | pink ring 50%, offset 2 | accent ring, offset 1 | accent ring 50%, offset 2 |
| Ambient loops | none | none | one: corner glow, 8s, opacity 0.10 to 0.22 |
| Durations | 150 / 200 | 100 | 200 / 300 max |
| Ease | `cubic-bezier(0.16,1,0.3,1)` | same | same |
| Stagger | `0.04 * index` | none | none |
| Reduced motion | no `whileTap`, no delay, BlurFade is static, chart animation 0 | same | glow static at 0.16, no lift, no `whileHover`, arc and bars jump to end |

Config to paste:
```ts
const EASE = [0.16, 1, 0.3, 1] as const;
const tBase   = (r: boolean, d = 0.15) => r ? { duration: 0 } : { duration: d, ease: EASE };
const tapProp = (r: boolean) => r ? undefined : { scale: 0.98 };
const liftProp = (r: boolean) => r ? undefined : { y: -1 };
```

Drag cue: A has no drag prop. B: `cursor-grab`, grip icon fades in at bottom-right, border goes to 70% accent while grabbed. C: same grip, border to 60% accent, lift cancelled while grabbed.

---

## 5. Depth (z-planes)

| Plane | A | B | C |
|-------|---|---|---|
| Page (z 0) | `--dk-bg-deep` | `--dk-bg-deep` | `--dk-bg-deep` |
| Card | solid raised, sheen only, sits flat | solid darker than page, sits flat | glass floats: elev-2, blur-xl, 80% |
| Inside card | wells recessed (`bg-deep`, darker than card) | dashed dividers, no wells | wells recessed at 60%, **no blur** |
| Hover | wire brightens | border brightens | lifts 2px, elev-3 |
| Overlay | tooltips `--dk-bg-base` | same | same |

Blur budget: `backdrop-blur-xl` on the card only. `sm` and `md` are not used. Nested blur is removed everywhere in C.

---

## 6. States

| State | A SIGNAL | B TERMINAL | C NEON GLASS |
|-------|----------|-----------|--------------|
| **Populated** | as specified above | as specified | as specified |
| **Empty** | Wells show `--` in muted. 20 segments all `--dk-border-strong`. Copy: keep "NO ACTIVITY DETECTED" / add "Press Resume to start" in `text-[12px] text-[var(--dk-text-muted)]` | Dashed inner box: `rounded-lg border border-dashed border-[var(--dk-border-default)] p-4`, icon 16 stroke 1.5 in `--dk-text-muted`, message `text-[13px] text-[var(--dk-text-secondary)]` with a static `_` after it. Keep existing `emptyMessage` strings (they already tell the user the next step) | Icon box (28px) in header stays lit. Body: `font-display text-[13px] text-[var(--dk-text-secondary)]`, icon 24 `text-[var(--dk-text-muted)]`. Glow at fixed 0.10 (no loop) |
| **Loading** | Parent renders `animate-pulse rounded-lg bg-[var(--dk-bg-deep)]` blocks: timer `h-10 w-44`, wells `h-16` x3. Wire stays lit | Skeleton `rounded-lg`, matching shape: label `h-3 w-24`, rows `h-8 w-full` x2, `h-8 w-2/3`. Dashed border unchanged | Skeleton `rounded-lg bg-[var(--dk-bg-raised)]`: `h-4 w-24`, rows `h-10` x2, `h-10 w-3/4`. Edge stays at 70%. Glow static |
| **Error** | Wire and kicker switch to `var(--dk-danger)`. Message `text-[13px] text-[var(--dk-danger)]` + AlertTriangle 14 | `border-[color-mix(in_srgb,var(--dk-danger)_35%,transparent)]`, `--page-accent` set to `var(--dk-danger)`, message `text-[13px] text-[var(--dk-danger)]` | `neonColor="var(--dk-danger)"` (was `"rose-400"`, bug 7). Icon box in danger. Border `mix(danger, 30)`. Glow turns danger color |
| **Disabled** | `opacity-50 cursor-not-allowed` on buttons | same | same |

Error copy stays plain language. A real Retry button needs an `onRetry` prop, which is out of scope. Flag it for the next pass.

---

## 7. Anti-slop audit

| # | Rule | A | B | C | Note |
|---|------|---|---|---|------|
| 1 | Tokens, no stray hex | PASS | PASS | PASS | Only `CATEGORY_ACCENT` hex + hex-alpha suffixes and `mix()` remain. `bg-pink-500` etc. are Tailwind palette |
| 2 | Max `rounded-xl`, `p-5` | PASS | PASS | PASS | B uses `p-4` / `px-3` |
| 3 | Dark only | PASS | PASS | PASS | |
| 4 | Max 2 fonts per view | PASS | PASS | PASS | A: Inter + Mono. B: Mono only. C: Space Grotesk + Mono. Preview page drops Geist |
| 5 | Glass where applicable | PASS (N/A, solid by design) | PASS (N/A, flat by design) | PASS | `bg-zinc-900/80 backdrop-blur-xl` |
| 6 | No glass on chrome | PASS | PASS | PASS | Widgets only |
| 7 | One signal hue | PASS | PASS | PASS | Pink/amber/emerald mix in charts and bars removed. Semantic success/danger only |
| 8 | Radii 8 / 12 / pill | PASS | PASS | PASS | `rounded-sm`, `rounded-md`, `rounded` all removed. Chart marks are canvas, not containers |
| 9 | Reduced motion | PASS | PASS | PASS | Hook on JS motion, `motion-reduce:` on CSS |
| 10 | No decorative glow | PASS | PASS | PASS | All box-shadow glows, gauge filter, BorderBeam, extra rings removed. C keeps one corner glow with a stated job (gives blur something to blur, shows state) |
| 11 | No spring, no `transition-all` | PASS | PASS | PASS | All named properties, one ease |
| 12 | Type hierarchy | PASS | PASS | PASS | B gets hierarchy from color, weight and case, not size |

Known trade-offs: (1) Hover and border color changes use `transition-colors`, as the repo already does. Shadow changes go through `::before` opacity to stay inside the transform/opacity rule. (2) Collapse no longer animates height. Layout jumps instantly. That is the price of the motion rule. (3) `Reset` still has no confirm. Behavior change, not style.

**Goal check:** three different objects. A is a dial. B is a terminal. C is a lit glass panel. Same tokens underneath.
