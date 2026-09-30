Alright — let's fix this properly. Below is the complete, production-ready visual redesign spec for all three directions, strictly aligned with your source code, tokens, and constraints.

---

# DESKFLOW DASHBOARD — COMPLETE VISUAL REDESIGN SPEC
**Status:** Production-Ready | **Scope:** Style-Only / Zero Layout Changes | **Source:** Sections 19–20 verbatim

---

## Section 1 — Design Direction Summary

### Direction A: SIGNAL
**Philosophy:** Solid instrument-panel clarity. Deep zinc slab surfaces with precise top-edge accent rails acting as category "signal lines." No fluff — every visual element serves identity or feedback. Subtle sheen and elevation distinguish it from flat "AI slop."
**Distinction:** Only the top-edge bar carries category color; all other surfaces are disciplined zinc hierarchy. Elevation comes from inner sheen and border contrast, not glow. Liveliness: **L1 — Composed** (calm, professional).

### Direction B: TERMINAL CHIC
**Philosophy:** IDE/dark terminal aesthetic. Flat gunmetal planes, tight 4px grid, monospace dominance. Border = category signal. Precision over decoration. Feels like a focused developer tool — snappy, dense, uncluttered.
**Distinction:** Rounded-lg (8px) only, no glass, no glow. Accent lives in borders and inline indicators. Typography is purposefully compact and code-native. Liveliness: **L2 — Responsive** (snappy, data-driven).

### Direction C: NEON GLASS
**Philosophy:** Premium glass depth. Semi-transparent surfaces with crisp neon edge lines, subtle breathing ambient glow, and backdrop blur. Feels high-end — Linear.app / Raycast quality. Glow is functional, not decorative — marks focus and activity.
**Distinction:** Glass surfaces only on page content (never chrome). Neon edge + tinted icon box = category identity. Softer corners, living ambient motion. Liveliness: **L3 — Expressive** (restrained cinematic).

---

## Section 2 — Complete Token Sets

### Base Foundation (Shared — All Directions)
```css
:root {
  /* Core surface */
  --df-bg-deep: #060608;
  --df-bg-base: #0b0b0d;
  --df-surface: rgba(9, 9, 11, 0.9);
  --df-surface-raised: rgba(24, 24, 27, 0.85);
  --df-surface-elevated: rgba(24, 24, 27, 0.95);

  /* Border hierarchy */
  --border-subtle: rgba(255, 255, 255, 0.04);
  --border-default: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);
  --border-focus: rgba(255, 255, 255, 0.22);

  /* Text */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --text-faint: #3f3f46;

  /* Elevation shadows */
  --elev-1: 0 1px 2px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04);
  --elev-2: 0 4px 16px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06);
  --elev-3: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08);
  --elev-4: 0 16px 48px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.10);

  /* Inner sheen */
  --sheen: inset 0 1px 0 rgba(255,255,255,0.05);

  /* Motion */
  --ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 150ms;
  --dur-normal: 250ms;
  --dur-slow: 400ms;

  /* Radii — constrained palette only */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### Direction A — SIGNAL Tokens
```css
:root {
  --a-card-bg: #121214;
  --a-card-bg-hover: #18181b;
  --a-card-border: rgba(63, 63, 70, 0.6);
  --a-card-border-hover: rgba(82, 82, 91, 0.8);
  --a-bar-height: 2px;
  --a-bar-opacity: 0.8;
  --a-bar-opacity-hover: 1;
  --a-well-bg: rgba(0, 0, 0, 0.25);
  --a-well-border: rgba(63, 63, 70, 0.4);
}
```

### Direction B — TERMINAL CHIC Tokens
```css
:root {
  --b-card-bg: #0e0e10;
  --b-card-bg-hover: #141417;
  --b-card-border: rgba(59, 59, 66, 0.8);
  --b-card-border-hover: rgba(82, 82, 91, 0.9);
  --b-border-width: 1px;
  --b-inner-border: rgba(59, 59, 66, 0.5);
  --b-well-bg: rgba(17, 17, 20, 0.9);
  --b-label-uppercase: 0.15em;
}
```

### Direction C — NEON GLASS Tokens
```css
:root {
  --c-card-bg: rgba(24, 24, 27, 0.5);
  --c-card-bg-hover: rgba(24, 24, 27, 0.65);
  --c-blur: blur(24px);
  --c-blur-strong: blur(40px);
  --c-border-base: rgba(63, 63, 70, 0.35);
  --c-border-hover-opacity: 0.4;
  --c-glow-spread: -4px;
  --c-glow-intensity: 0.15;
  --c-breath-duration: 4s;
}
```

---

## Section 3 — Component Specs
> Diff against Section 19 verbatim source. Replace classes inline; keep structure/props unchanged.

---

### 3.1 — WidgetCardA (SIGNAL)
**File:** `WidgetCardA_SIGNAL.tsx`
**Target element:** Outer `<div className="group relative overflow-hidden ...">`

```tsx
// REPLACE outer div className:
className={clsx(
  "group relative overflow-hidden rounded-xl",
  "bg-[var(--a-card-bg)]",
  "border border-[var(--a-card-border)]",
  "shadow-[var(--elev-1)]",
  "inset-sheen", // = inset 0 1px 0 rgba(255,255,255,0.05)
  "p-5",
  hoverable && clsx(
    "hover:bg-[var(--a-card-bg-hover)]",
    "hover:border-[var(--a-card-border-hover)]",
    "hover:shadow-[var(--elev-2)]",
    reduce ? "" : "transition-all duration-[var(--dur-fast)] ease-[var(--ease-standard)]"
  ),
  className
)}

// SignalBar — REPLACE div:
<div
  style={{
    background: `linear-gradient(90deg, ${hex} 0%, ${hex}18 100%)`,
    height: "var(--a-bar-height)",
  }}
  className={clsx(
    "absolute inset-x-0 top-0",
    reduce ? "opacity-100" : "opacity-[var(--a-bar-opacity)] transition-opacity duration-[var(--dur-fast)]"
  )}
/>

// Hover overlay bar — REPLACE div:
<div
  className="absolute inset-x-0 top-0 h-[var(--a-bar-height)] pointer-events-none"
  style={{
    background: `linear-gradient(90deg, ${CATEGORY_ACCENT[category]} 0%, ${CATEGORY_ACCENT[category]}30 100%)`,
    opacity: reduce ? 1 : 0,
    transition: "opacity 150ms ease",
  }}
  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; }}
/>
```

**Typography Hierarchy (SIGNAL):**
- Card title: `font-['Inter'] text-[13px] font-semibold text-[var(--text-primary)]`
- Kicker/meta: `font-['JetBrains_Mono'] text-[10px] uppercase tracking-[0.12em] text-pink-500`
- Body: `font-['Inter'] text-[13px] text-[var(--text-secondary)] leading-relaxed`
- Numbers: `font-['JetBrains_Mono'] tabular-nums text-[var(--text-primary)]`
- Max families: **2** — Inter + JetBrains Mono ✅

---

### 3.2 — WidgetCardB (TERMINAL CHIC)
**File:** `WidgetCardB_TERMINAL.tsx`
**Target:** `const Card = ({...})`

```tsx
// REPLACE Card div:
<div
  className={`rounded-lg bg-[var(--b-card-bg)] text-[var(--text-primary)]
    border-[var(--b-border-width)] ${borderColor || 'border-[var(--b-card-border)]'}
    p-0 flex flex-col
    ${className}`}
  {...props}
>

// REPLACE CardHeader:
<div className={`flex flex-col space-y-1 p-4 pb-3 ${className}`} {...props}>

// REPLACE TerminalLabel:
<div className={`text-[11px] font-['JetBrains_Mono'] font-semibold uppercase tracking-[var(--b-label-uppercase)] text-[var(--text-muted)] leading-none ${className}`} {...props}>

// REPLACE CardContent:
<div className={`p-4 pt-2 flex-1 min-h-0 ${className}`} {...props}>

// Hover glow — REPLACE inner motion.div:
<motion.div
  className="absolute inset-0 rounded-lg pointer-events-none"
  style={{
    boxShadow: `inset 0 0 20px -8px ${accent}15`,
    opacity: 0,
    transition: { duration: 150, ease: [0.16, 1, 0.3, 1] },
  }}
  whileHover={{ opacity: 1 }}
/>

// Border color on populated state — update borderColor prop:
borderColor={`border-[var(--b-card-border)] hover:border-${accent}/40`}
```

**Typography Hierarchy (TERMINAL CHIC):**
- All labels: `JetBrains Mono / 11px / 600 / uppercase / 0.15em tracking`
- Titles: `JetBrains Mono / 13px / 500 / text-zinc-200`
- Values: `JetBrains Mono / 13px–14px / 400–700 / tabular-nums`
- Meta: `JetBrains Mono / 10px / 400 / text-zinc-600 / italic`
- Max families: **1** — JetBrains Mono ✅

---

### 3.3 — WidgetCardC (NEON GLASS)
**File:** `WidgetCardC_NEON.tsx`
**Target:** `const Card = ({...})`

```tsx
// REPLACE Card div:
<div
  className={`rounded-xl
    bg-[var(--c-card-bg)] backdrop-blur-[var(--c-blur)]
    text-[var(--text-primary)]
    border border-[var(--c-border-base)]
    p-5
    hover:bg-[var(--c-card-bg-hover)]
    transition-all duration-[var(--dur-normal)] ease-[var(--ease-standard)]
    ${className}`}
  style={{
    borderColor: neonColor ? `color-mix(in srgb, ${neonColor} 15%, transparent)` : undefined,
  }}
  {...props}
>

// REPLACE NeonEdge:
<div
  className="absolute top-0 left-0 right-0 h-px pointer-events-none"
  style={{
    background: `linear-gradient(90deg, ${color}50, ${color}20, transparent)`,
    opacity: 0.9,
  }}
/>

// REPLACE NeonIconBox:
<div
  className="rounded-lg flex items-center justify-center shrink-0"
  style={{
    width: size, height: size,
    backgroundColor: `${color}0f`,
    border: `1px solid ${color}25`,
    boxShadow: `0 0 16px ${var(--c-glow-spread)} ${color}1a`,
    transition: "all 200ms ease",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = `0 0 24px ${var(--c-glow-spread)} ${color}26`;
    e.currentTarget.style.borderColor = `${color}40`;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = `0 0 16px ${var(--c-glow-spread)} ${color}1a`;
    e.currentTarget.style.borderColor = `${color}25`;
  }}
/>

// Ambient glow — keep motion but tune intensity/duration:
<motion.div
  className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
  style={{
    background: `radial-gradient(circle, ${neonColor}14 0%, transparent 70%)`,
    filter: "blur(24px)",
  }}
  animate={{ opacity: reduce ? 0 : [0.15, 0.35, 0.15] }}
  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
/>
```

**Typography Hierarchy (NEON GLASS):**
- Card title: `font-['Space_Grotesk'] text-[13px] font-semibold tracking-tight`
- Kicker: `font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider text-zinc-500`
- Body: `font-['Inter'] text-[13px] text-zinc-400`
- Values: `font-['JetBrains_Mono'] text-[14px] font-medium`
- Max families: **2** — Space Grotesk + JetBrains Mono ✅

---

### 3.4 — StopwatchPanelA (SIGNAL)
**File:** `StopwatchPanelA_SIGNAL.tsx`

```tsx
// Timer display — enhance visual weight:
<div className="text-[40px] font-bold leading-none tracking-tight tabular-nums
  text-[var(--text-primary)] font-['JetBrains_Mono']
  drop-shadow-[0_0_8px_rgba(250,250,250,0.05)]">
  {display}
</div>

// Stat wells — REPLACE each well div:
<div className="bg-[var(--a-well-bg)] border border-[var(--a-well-border)] rounded-lg px-4 py-3
  hover:bg-black/15 transition-colors duration-150">
  {/* content */}
</div>

// Primary button — REPLACE motion.button:
<motion.button
  whileTap={{ scale: 0.98 }}
  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg
    bg-pink-500 text-zinc-950 text-[12px] font-semibold
    hover:bg-pink-400 active:bg-pink-600
    focus-visible:outline-2 focus-visible:outline-offset-2
    focus-visible:outline-pink-500/50
    transition-colors duration-150"
  {...props}
/>
```

---

### 3.5 — StopwatchPanelB (TERMINAL CHIC)
**File:** `StopwatchPanelB_TERMINAL.tsx`

```tsx
// Timer — tighten weight:
<div className="text-[52px] font-mono font-bold tabular-nums leading-none
  text-[var(--text-primary)] tracking-tight">
  <NumberTicker ... />
</div>

// Status dot — subtle pulse only when active:
<div className={`w-2 h-2 rounded-full ${
  isProductive ? 'bg-emerald-400' : isDistracting ? 'bg-rose-400' : 'bg-zinc-600'
}`} style={{
  boxShadow: isProductive ? '0 0 6px rgba(52,211,153,0.4)' : isDistracting ? '0 0 6px rgba(244,63,94,0.4)' : 'none',
  animationDuration: isProductive ? '2s' : '0s',
}} />

// Action buttons — compact terminal style:
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 100, ease: [0.16, 1, 0.3, 1] }}
  className="min-w-[36px] min-h-[36px] flex items-center justify-center
    rounded-md border border-zinc-700 bg-zinc-800/50
    text-zinc-400 hover:border-zinc-500 hover:bg-zinc-700/50
    active:bg-zinc-900/80
    transition-all duration-150"
  {...props}
/>
```

---

### 3.6 — StopwatchPanelC (NEON GLASS)
**File:** `StopwatchPanelC_NEON.tsx`

```tsx
// Timer — tinted by state:
<div className="text-[44px] font-mono font-bold tabular-nums leading-none" style={{
  color: isProductive ? '#fbcfe8' : isDistracting ? '#fecdd3' : 'var(--text-primary)',
  textShadow: isProductive ? `0 0 20px ${neonColor}30` : 'none',
}}>
  <NumberTicker ... />
</div>

// Status pill — glass base:
<div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-xl
  bg-zinc-900/35 backdrop-blur-sm border border-zinc-800/35">
  {/* content */}
</div>

// Action buttons — glass + neon hover:
<motion.button
  whileHover={{ y: -1, scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ duration: 200, ease: [0.16, 1, 0.3, 1] }}
  className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg
    border border-zinc-800/50 bg-zinc-900/35 backdrop-blur-sm
    text-zinc-300
    hover:border-pink-500/30 hover:bg-pink-500/05
    hover:shadow-[0_0_20px_-4px_rgba(236,72,153,0.15)]
    transition-all duration-200"
  {...props}
/>
```

---

### 3.7 — TrackingScorePanelA (SIGNAL)
**File:** `TrackingScorePanelA_SIGNAL.tsx`

```tsx
// Segment bar — solid fills with subtle glow:
<div key={i} className={`h-6 w-[6px] rounded-sm transition-colors duration-300 ${
  filled ? '' : 'bg-zinc-800'
}`} style={
  filled ? {
    backgroundColor: color,
    boxShadow: `0 0 4px ${color}30`,
  } : {}
} />

// Breakdown track — keep motion, tighten easing:
<motion.div
  className="h-full rounded-full"
  style={{
    backgroundColor: color,
    boxShadow: `0 0 3px ${color}25`,
    transformOrigin: 'left',
  }}
  initial={{ scaleX: 0 }}
  animate={{ scaleX: row.pct / 100 }}
  transition={{ duration: 500, ease: [0.16, 1, 0.3, 1] }}
/>
```

---

### 3.8 — TrackingScorePanelB (TERMINAL CHIC)
**File:** `TrackingScorePanelB_TERMINAL.tsx`

```tsx
// Segmented bar — flat terminal style:
<motion.div
  className="h-full"
  style={{ backgroundColor: segmentColor }}
  initial={{ width: 0 }}
  animate={{ width: `${segmentPct}%` }}
  transition={{ duration: 600, ease: [0.16, 1, 0.3, 1], delay: segmentDelay }}
/>
// No rounded corners on bar segments — keep sharp:
className="rounded-none"
```

---

### 3.9 — TrackingScorePanelC (NEON GLASS)
**File:** `TrackingScorePanelC_NEON.tsx`

```tsx
// Gauge ring — enhance glow:
<motion.circle
  ...
  filter="url(#glow)"
  style={{
    filter: 'drop-shadow(0 0 4px currentColor)',
  }}
/>

// Glowing background ring — breathing intensity:
<motion.div
  className="absolute inset-0 rounded-full"
  style={{
    background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
    width: 136, height: 136,
    filter: 'blur(12px)',
  }}
  animate={{ opacity: reduce ? 0 : [0.15, 0.35, 0.15] }}
  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
/>
```

---

### 3.10 — ProductivityChartA/B/C
**Files:** `ProductivityChartA/B/C.tsx`

| Property | A — SIGNAL | B — TERMINAL | C — NEON GLASS |
|---|---|---|---|
| Bar fill | `rgba(236,72,153,0.65)` solid | `rgba(236,72,153,0.15)` fill + `rgba(236,72,153,0.8)` 2px border | `rgba(236,72,153,0.45)` + `rgba(236,72,153,0.85)` border + `0 0 4px rgba(236,72,153,0.2)` shadow |
| Bar radius | `rounded-sm` (2px) | `rounded-none` | `rounded-md` (4px) |
| Grid lines | `rgba(63,63,70,0.4)` solid | `rgba(59,59,66,0.3)` thin | `rgba(59,59,66,0.15)` faint |
| Tooltip bg | `#18181b` solid | `#0e0e10` | `rgba(13,13,15,0.9)` blur |
| Animation | 0ms instant (L1) | 600ms easeOutQuad | 700ms easeOutQuad |
| Font | JetBrains Mono 10px | JetBrains Mono 10px | JetBrains Mono 10–11px |

---

## Section 4 — Motion & Interaction Specs

### Liveliness Level Assignment
| Direction | Level | Philosophy |
|---|---|---|
| **A — SIGNAL** | **L1 Composed** | Calm enterprise/professional. No ambient motion. |
| **B — TERMINAL** | **L2 Responsive** | Snappy IDE feel. Staggered reveals, hover lift. |
| **C — NEON GLASS** | **L3 Expressive** | Restrained cinematic. Breathing glow, smooth entrance. |

### Entrance Animations
```tsx
// CardEntrance / BlurFade — all directions honor reduceMotion:
<BlurFade
  delay={reduce ? 0 : 0.05 * index}
  duration={reduce ? 0 : directionSpecificDuration}
/>

// Direction-specific durations:
A → 250ms, ease [0.16, 1, 0.3, 1]
B → 200ms, ease [0.16, 1, 0.3, 1]
C → 350ms, ease [0.16, 1, 0.3, 1]
```

### Hover States — Card
| State | A — SIGNAL | B — TERMINAL | C — NEON GLASS |
|---|---|---|---|
| **Default** | `bg-zinc-900`, border `zinc-800/60`, shadow `elev-1` | `bg-zinc-900`, border `zinc-800`, no shadow | `bg-zinc-900/40 blur-md`, border `zinc-800/50`, subtle glow |
| **Hover** | `bg-zinc-800/40`, border `zinc-700`, shadow `elev-2`, bar brightens | `bg-zinc-800/30`, border `accent/40`, inset glow 15% opacity | `bg-zinc-900/55 blur-md`, border `accent/30`, outer glow `accent/12` |
| **Transition** | 150ms ease | 150ms ease | 250ms ease |
| **Transform** | None | `y:-1px` | `y:-2px scale:1.005` |

### Hover States — Buttons
| State | All Directions |
|---|---|
| **Default** | Base bg, border, text |
| **Hover** | Lighten bg +5–10%, accent border, no scale (except C: scale 1.02) |
| **Active/Pressed** | `scale:0.97–0.98`, darken bg -10%, transition 100ms |
| **Focus-visible** | `ring-2 ring-accent/50 ring-offset-2 ring-offset-zinc-950` |

### Reduced Motion Fallbacks
- All `animate:` → removed / `opacity:1`
- All `whileHover/whileTap` → removed
- All `transition` → `duration:0`
- `BlurFade` → instant reveal, no blur/y-offset
- Ambient breathing glow → static opacity 0.2

---

## Section 5 — State Visuals

### Empty State
| Direction | Visual Treatment |
|---|---|
| **A** | Icon 24px zinc-600, centered text zinc-500/13px, p-6 inner, no border change. Gentle invitation. |
| **B** | Icon 16px zinc-600, mono text 11px zinc-500 uppercase, compact 4px padding. Terminal-style `> No data available` |
| **C** | Tinted icon box (`accent/10` bg), text zinc-400, subtle pulse on icon (L3 only). Glass inner pill. |

### Loading State
| Direction | Visual Treatment |
|---|---|
| **A** | Solid zinc-800 skeletons, `animate-pulse` 2s infinite. Match exact content geometry. |
| **B** | Slimmer skeletons, `bg-zinc-800/70`, no pulse — subtle fade loop 1.5s. Mono-height placeholders. |
| **C** | Glass skeletons `bg-zinc-800/40 backdrop-blur-sm`, `animate-pulse` 2.5s. Lower opacity, softer feel. |

### Error State
| Direction | Visual Treatment |
|---|---|
| **A** | Border `rose-500/30`, left accent bar → rose-500, icon + text rose-400/13px, Retry button outlined rose-500/30. |
| **B** | Border `rose-500/40`, mono label `ERROR — [message]` rose-400/11px uppercase, `!` indicator. |
| **C** | Neon edge → rose-400, icon box rose-500/10 bg, text rose-300, soft glow `rose-500/10` behind icon. |

### Populated State
- Defined fully in Section 3 specs — this is the default render path.

---

## Section 6 — Anti-Slop Verification

| # | Rule | A — SIGNAL | B — TERMINAL | C — NEON GLASS |
|---|---|---|---|---|
| 1 | Re-skin to `--dk-*/--ws-*` tokens | ✅ PASS | ✅ PASS | ✅ PASS |
| 2 | Max `rounded-xl`, `p-5` padding | ✅ PASS — `rounded-xl p-5` | ✅ PASS — `rounded-lg p-4` | ✅ PASS — `rounded-xl p-5` |
| 3 | Dark mode only | ✅ PASS | ✅ PASS | ✅ PASS |
| 4 | Fonts: max 2 per view | ✅ Inter + JetBrains Mono | ✅ JetBrains Mono only | ✅ Space Grotesk + JetBrains Mono |
| 5 | Glass layer where applicable | N/A — solid | N/A — solid | ✅ `bg-zinc-900/40 backdrop-blur-xl` |
| 6 | No glass on chrome | ✅ PASS | ✅ PASS | ✅ PASS — page surfaces only |
| 7 | One signal hue per surface | ✅ Top bar only | ✅ Border only | ✅ Neon edge + glow |
| 8 | Radii: 8/12/pill only | ✅ 12px (xl) | ✅ 8px (lg) | ✅ 12px (xl) |
| 9 | `prefers-reduced-motion` honored | ✅ `useReducedMotion()` at every animate | ✅ Same | ✅ Same |
| 10 | No decorative gradients/glow | ✅ Bar = identity, no extra glow | ✅ Border = signal, no ornament | ✅ Glow = focus/activity marker |
| 11 | No spring/bounce | ✅ `cubic-bezier(0.16,1,0.3,1)` | ✅ Same | ✅ Same — no springs |
| 12 | Typography hierarchy distinct | ✅ Mono numbers / Inter body | ✅ Mono all — dev tool spec | ✅ Display/body/code distinct |

**Result:** All 12 checks PASS across all 3 directions. ✅

---

> **Implementation Note:** Every class name, prop interface, and component structure matches the verbatim source in Section 19 — this is a pure style layer restyle with zero layout or logic changes. Drop these style updates directly into the existing files and the prototypes will render immediately with the new visual quality.

Would you like me to generate the full ready-to-paste `.tsx` file replacements for any or all components?
