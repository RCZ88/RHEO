# CONTEXT_BUNDLE.md — Dashboard Style Redesign 28092026

> All source code paths relative to repo root: `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/`
>
> This bundle is SELF-CONTAINED. The receiving AI does NOT have access to any external tools, skill files, MCP servers, or the project codebase. Everything it needs is in this file.

---

## 1. Project Context

DeskFlow is an Electron + React + better-sqlite3 desktop productivity tracker. The dashboard has 3 prototype design directions rendered on a standalone `/prototype-preview` page:

- **Prototype A — SIGNAL**: Solid zinc-900 slabs with 2px category top-edge bars
- **Prototype B — TERMINAL CHIC**: Flat gunmetal panels, all mono, terminal aesthetic
- **Prototype C — NEON GLASS**: Dark glass panels with neon edge accents + ambient glow

**Task: STYLE ONLY. No layout changes. No prop changes. No file structure changes.** The prototypes currently look like generic "AI slop" — flat, indistinguishable surfaces with no visual depth or cohesive design language.

---

## 2. Available Shadcn UI Components (already installed in the project)

These components exist in `src/components/ui/` and can be used in any redesign:

accordion, alert, alert-dialog, badge, blur-fade, border-beam, button, calendar, card, collapsible, dialog, dropdown-menu, input, label, marquee, magic-card, neon-gradient-card, number-ticker, particles, popover, progress, scroll-area, select, separator, sheet, skeleton, slider, switch, tabs, textarea, toggle, tooltip

Plus custom: `ambient-patterns`, `animated-circular-progress-bar`, `animated-gradient-text`, `animated-grid-pattern`, `animated-shiny-text`, `aurora-text`, `dot-pattern`, `glare-hover`, `gradient-shimmer`, `light-rays`, `shiny-button`, `v-calendar`

**Third-party registries** (configured in `components.json`): `@kokonutui` (general UI), `@bklit` (charts/data-viz), `@react-bits` (animated components)

---

## 3. Design Tokens (exact values)

### From `src/index.css` lines 8-44 (`@theme` block):

```css
--ws-surface: #09090b;
--ws-surface-raised: #18181b;
--ws-border: rgb(39 39 42 / 0.6);
--ws-border-strong: rgb(63 63 70 / 0.6);
--ws-accent: #06b6d4;
--ws-radius-card: 0.5rem;
--ws-dur: 150ms;
--ws-ease: cubic-bezier(0.2, 0, 0, 1);
--color-clay-300: #f0a892; --color-clay-400: #e8866b; --color-clay-500: #d96846; --color-clay-600: #c2553a;
--color-sage-400: #6fb38f;
--color-amber-400: #fbbf24;
--color-sky-400: #5ab0c9;
--color-glow: #f7f3ee;
--font-serif: "Source Serif 4", Georgia, serif;
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", monospace;
--font-display: "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-caslon: "Libre Caslon Text", Georgia, "Times New Roman", serif;
--resume-success: #22c55e; --resume-warning: #f59e0b; --resume-danger: #ef4444; --resume-info: #3b82f6;
--resume-score-high: #16a34a; --resume-score-mid: #ca8a04; --resume-score-low: #dc2626;
```

### From `src/components/ai/design-tokens.css` (`:root` block):

```css
--dk-bg-deep: #060608; --dk-bg-base: #0b0b0d; --dk-bg-surface: rgba(11, 11, 13, 0.88); --dk-bg-raised: rgba(24, 24, 27, 0.65); --dk-bg-input: rgba(24, 24, 27, 0.85);
--dk-aurora: rgba(90, 120, 255, 0.035);
--dk-elev-1: 0 1px 2px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04);
--dk-elev-2: 0 4px 16px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06);
--dk-elev-3: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08);
--dk-elev-4: 0 16px 48px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.10);
--dk-sheen: inset 0 1px 0 rgba(255,255,255,0.05);
--dk-text-primary: #fafafa; --dk-text-secondary: #a1a1aa; --dk-text-muted: #71717a; --dk-text-faint: #3f3f46; --dk-text-placeholder: #27272a;
--dk-border-subtle: rgba(255,255,255,0.06); --dk-border-default: rgba(255,255,255,0.09); --dk-border-strong: rgba(255,255,255,0.14); --dk-border-focus: rgba(255,255,255,0.22);
--dk-accent: #fafafa; --dk-accent-dim: rgba(255,255,255,0.06); --dk-success: #22c55e; --dk-warning: #eab308; --dk-danger: #ef4444;
--dk-type-focus: #f472b6; --dk-type-plan: #a78bfa; --dk-type-finance: #34d399; --dk-type-digest: #22d3ee; --dk-type-reflect: #c084fc; --dk-type-approval: #fbbf24; --dk-type-annotation: #fb923c; --dk-type-response: #60a5fa; --dk-type-schedule: #f87171; --dk-type-deadlines: #fb923c; --dk-type-planner: #38bdf8; --dk-type-dynamic: #71717a; --dk-type-automation: #e879f9; --dk-type-group: rgba(255,255,255,0.45); --dk-type-connectors: rgba(139,92,246,0.65);
--dk-blur-sm: blur(12px); --dk-blur-md: blur(24px); --dk-blur-lg: blur(40px);
```

### Category Accent Colors (from `WidgetCardA_SIGNAL.tsx`):

```ts
productivity: "#ec4899" (pink-500), analytics: "#22d3ee" (cyan), schedule: "#a78bfa" (violet),
insight: "#34d399" (emerald), activity: "#fbbf24" (amber), health: "#38bdf8" (sky),
ai: "#fb7185" (rose), dev: "#a1a1aa" (zinc), finance: "#10b981" (emerald),
learning: "#fb923c" (orange), browsing: "#60a5fa" (blue), social: "#e879f9" (fuchsia)
```

---

## 4. Typography Rules (must follow ALL of these)

### Font Stack
- **Display/Headings**: `Space Grotesk` (font-display)
- **Body/UI**: `Inter` (font-sans)
- **Code/Numbers**: `JetBrains Mono` (font-mono)
- **Max 2 font families per view** (e.g., Space Grotesk + JetBrains Mono = OK; Inter + Space Grotesk + JetBrains Mono = 3, NOT OK)

### Typography Scale (from `frontend-design` skill)
```
Badge:      11px / 500     — status badges, category pills
Meta:       12px / 400     — timestamps, secondary info
Body:       13px / 400     — default body text
Body+:      14px / 400     — stat values, card content
Card title: 13px / 600     — section headings within cards
Section h2: 15px / 600     — section titles
Page title: 18px / 600     — h1 titles
Display:    24-32px / 700  — timer values, hero score badges
```

### Typography Rules from `impeccable` skill
- **Scale**: Modular scale 1.25 ratio: 12, 15, 18.75, 23.44, 29.3, 36.6px
- **Line height**: 1.5 body, 1.2 headings, 1.6 terminal/code
- **Measure**: 45-75 chars per line
- **Weight hierarchy**: 400 (body), 500 (labels), 600 (headings), 700 (hero). NEVER use 100-300 on dark backgrounds
- **Anti-pattern**: `font-thin` (100-200) on dark zinc backgrounds becomes illegible

### Typography Anti-Patterns
1. More than 2 font families in one view
2. Body text below 14px on desktop
3. Line height below 1.4 for body text
4. `font-thin` (100-200) on dark backgrounds
5. Inconsistent font weights across similar elements

---

## 5. Color Rules (must follow ALL of these)

### Color System
```
Background:     zinc-950 (#09090b) base, zinc-900 (#18181b) elevated, zinc-900/50 glass
Primary:        pink-500 (#ec4899) accent, pink-400 hover, pink-600 active
Secondary:      cyan-400 (info), emerald-400 (success), amber-400 (warning)
Text:           zinc-100 (primary), zinc-400 (secondary), zinc-600 (disabled)
Border:         zinc-800 (subtle), zinc-700 (active), zinc-600/50 (glass edge)
```

### Color Rules from `impeccable` skill
- **HSL over hex**: Use `hsl()` for systematic dark theme adjustments. Shift lightness ±5% for hover
- **Opacity layers**: Build depth through `bg-pink-500/10` + `border-pink-500/20`, not new hex values
- **Accent discipline**: ONE primary accent (pink-500), ONE secondary (cyan-400), ONE semantic (emerald/amber/red). NEVER exceed 3 accent colors in a view
- **Contrast ratios**: Minimum 4.5:1 for body text, 3:1 for large text/UI components
- **Anti-patterns**:
  - `opacity-50` on text (reduces contrast unpredictably) — use dedicated text color tokens
  - Pure black (`#000`) backgrounds — always zinc-950 or slate-950
  - More than 3 accent colors in a single view
  - Gradients spanning more than 45° or using more than 3 color stops

---

## 6. Motion & Animation Rules

### Liveliness Levels (from `motion-alive` skill)

**LEVEL 1 — COMPOSED** (professional/calm):
- Allowed: hover/focus/press feedback, fade/slide enter+exit, skeleton→content
- Forbidden: ambient/always-on motion, particles, spring physics, scroll choreography
- Timing: 120-200ms, transform + opacity only, ease-out. Reduced-motion = instant
- Motion knob: 2-3. Use for: finance, banking, enterprise tools

**LEVEL 2 — RESPONSIVE** (alive but focused) ← DEFAULT for DeskFlow:
- Everything in L1 PLUS: list stagger, layout animations, AnimatePresence enter/exit, hover lift+glow, drag reordering, ONE restrained ambient accent
- Forbidden: multiple competing ambient layers, heavy particle systems
- Timing: 150-300ms, ease cubic-bezier(0.16,1,0.3,1); springs stiffness 300-500/damping 30+
- Motion knob: 5-6. Use for: SaaS, productivity, dashboards

**LEVEL 3 — EXPRESSIVE** (cinematic/playful):
- Everything in L2 PLUS: scroll-reveal, parallax, ambient backgrounds, magnetic/tilt, page transitions
- Forbidden: motion that blocks input, more than 2-3 ambient layers
- Timing: 200-600ms choreography; springs welcome; ambient loops 8-30s
- Motion knob: 8-10. Use for: marketing pages, creative tools, data-art visualizations

### Duration Scale (from `impeccable` skill)
- Micro (0-100ms): color changes, opacity toggles
- Fast (100-200ms): hover states, button presses
- Normal (200-300ms): dropdowns, accordions
- Slow (300-500ms): modals, page transitions
- Dramatic (500-800ms): onboarding, celebratory

### Easing Library
- `ease-out`: UI feedback (buttons, toggles)
- `ease-in-out`: Symmetric animations (modals, drawers)
- `linear`: Continuous motion (spinners, progress)
- **Standard motion**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out)
- **NEVER** use `spring` physics in serious developer tools
- **NEVER** use `transition: all 0.3s` — specify exact properties

### Hard Motion Rules (from `impeccable` skill)
1. Only animate `transform` and `opacity`
2. NEVER animate `width`, `height`, `top`, `left`, `margin`, `padding`
3. Anti-pattern: `transition: all 0.3s`
4. Duration > 500ms for UI feedback = anti-pattern
5. No reduced-motion fallback = anti-pattern
6. Parallax/scroll-jacking in productivity tools = anti-pattern

---

## 7. Spatial & Layout Rules

### 8px Grid (from `impeccable` skill)
- All spacing must be multiples of 8px (4px for micro-adjustments only)
- **Density zones**:
  - High density (terminal, data tables): 4-8px gaps, compact padding
  - Medium density (forms, lists): 12-16px gaps
  - Low density (hero, empty states): 24-48px gaps

### Z-Index Scale (from `frontend-design` skill)
```
--z-base: 0 (page content)
--z-elevated: 10 (elevated cards, sticky headers)
--z-dropdown: 20 (dropdowns, tooltips, popovers)
--z-modal: 30 (modals, dialogs)
--z-toast: 40 (toasts, notifications)
--z-overlay: 50 (backdrops, overlays)
--z-max: 100 (AfkPromptModal)
```

### Spacing Scale (from `frontend-design` skill)
```
xs: 4px   (icon padding, tight inline)
sm: 8px   (component internal padding)
md: 12px  (card padding, list items)
lg: 16px  (section gaps)
xl: 24px  (page sections)
2xl: 32px (major divisions)
```

### Card Padding Standard
- ALL card padding → `p-5` (20px). Never `p-6` or `p-8`
- ALL cards, modals, containers → `rounded-xl` (12px). Never `rounded-2xl` or `rounded-3xl`

---

## 8. Interaction Rules (from `impeccable` skill)

### Hover States
- Every interactive element MUST have a hover state. Minimum: `opacity-80` or `brightness-110`
- Hover: `border-zinc-700` or `bg-zinc-800/50` or shadow change

### Active/Pressed States
- Pressed state should be 10% darker/lighter than hover
- Use `scale-[0.98]` for tactile feedback
- `whileTap={{ scale: 0.98 }}` in motion/react

### Focus Visible
- Replace default outline with `ring-2 ring-pink-500/50 ring-offset-2 ring-offset-zinc-950`
- NEVER use default browser focus rings

### Touch Targets
- Minimum 44×44px for all interactive elements, even on desktop
- Anti-pattern: Disabled buttons that look like enabled (`opacity-40` + `cursor-not-allowed`)

### Loading States
- Never show a disabled button without a spinner
- Use `opacity-50 cursor-wait` + spinner for loading
- Skeleton pattern: `animate-pulse bg-zinc-800 rounded` matching content shape

### Anti-Patterns (Interaction)
- Disabled buttons that look like enabled
- Missing focus indicators on interactive elements
- Hover states missing on clickable elements
- Loading spinners without progress indication for >3s operations

---

## 9. UX Rules (from `humancentred-UIUX` skill — 6 Pillars)

### 1. Clarity Over Cleverness
- Every label, button, tooltip, placeholder, error is plain human language
- Primary action obvious within 1 second
- Icons never used alone for non-universal actions — pair with label or tooltip

### 2. Progressive Disclosure
- Show what matters now; hide complexity until needed
- Default to common case; make rare case reachable, not omnipresent
- A screen answers ONE primary question

### 3. Visual Hierarchy
- Establish hierarchy with weight, color temperature, and spacing — not size alone
- Most important element = highest contrast. Metadata = muted
- One clear focal point per view
- Group related items; separate unrelated items with deliberate whitespace

### 4. Complete State Coverage (#1 anti-slop rule)
- **Empty**: icon + friendly one-line explanation + clear call-to-action. Never a blank box
- **Loading**: skeleton placeholders matching content shape (not just a spinner)
- **Error**: plain-language cause + recovery action (Retry/Fix). Never raw JSON
- **Populated**: the primary visual state
- **Disabled**: `opacity-50 cursor-not-allowed`

### 5. Forgiveness
- Undo on every destructive action
- Confirmation on every irreversible action
- Recoverable states for everything

### 6. Accessibility
- Sufficient contrast ratios (4.5:1 minimum)
- `prefers-reduced-motion` respected
- Keyboard navigable with visible focus indicators
- Screen reader friendly labels

---

## 10. Developer Tools Design Rules (from `ui-ux-pro-max` skill)

DeskFlow is a **Developer Tools** product:
- **Aesthetic**: Dark chrome, monospace dominance, high information density, command palette patterns
- **Color**: Deep slate/zinc base, ONE vibrant accent (pink/cyan/emerald), syntax-highlighted code blocks
- **Typography**: Geist or Inter for UI, JetBrains Mono for code. 13-14px base, tight line height (1.4)
- **Spacing**: 4-8px grid. Minimal padding inside data cells, generous between sections
- **Motion**: Fast (100-150ms), linear or ease-out. No bounces in serious tools
- **Patterns**: Tree views, split panes, tab bars, status bars, command palettes, inline editing
- **Anti-pattern**: Rounded corners > 8px on terminal/code elements. Shadows on code blocks

---

## 11. Taste & Anti-Repetition Rules (from `taste-skill`)

### Current Configuration
```
DESIGN_VARIANCE:   5 (Balanced — professional dev tool with personality)
MOTION_INTENSITY:  5 (Moderate — responsive but not distracting)
VISUAL_DENSITY:    7 (Dense — data-heavy dashboard with terminal integration)
```

### Anti-Repetition Rules
1. **Font Rotation**: If last 3 components used Geist, switch to Inter or Space Grotesk
2. **Color Shift**: If last design used pink accent, try cyan or emerald for the next
3. **Shape Variation**: Alternate between sharp corners (0px), subtle rounding (4-6px), heavy rounding (12-16px)
4. **Pattern Break**: Every 5th component breaks ONE convention from previous 4
5. **Contextual Memory**: Check "What was last accent color? Last border radius? Last animation style?" — then consciously vary

---

## 12. Glass System Rules (from `frontend-design` skill)

### GlassCard Variants
**Default**: `bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5`
- `hover:border-zinc-700/60 transition-colors duration-150`

**Elevated**: `bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5`
- `shadow-[0_0_30px_rgba(0,0,0,0.3)]`

**Interactive**: `DEFAULT + hover:border-accent-primary/30 + cursor-pointer`

### Glass Rules
- Use `backdrop-filter: blur()` as SPATIAL DEPTH CUES, not decoration
- Glass is ONLY for page bg surfaces — NEVER for app shell/sidebar
- Glass layer = `bg-zinc-900/80 backdrop-blur-xl`
- Anti-pattern: glassmorphism on chrome/app shell

---

## 13. Animation Tokens (from `frontend-design` skill)

```
fast:    150ms (hover states, toggles)
normal:  250ms (modals, dropdowns)
slow:    400ms (page transitions)
ease-out: cubic-bezier(0.16, 1, 0.3, 1) (standard motion)
```

---

## 14. Component Index (summaries only — REAL SOURCE IS IN SECTION 19)

> ⚠️ **This section is a navigational index, not the source.** Every line below is a
> one-line summary. The **verbatim, unedited source for all 15 prototype files** is in
> **Section 19**. When you write a spec, read Section 19 and diff against the real
> classes — do not spec from these summaries or from assumptions about structure.

### `src/components/dashboard/WidgetCardA_SIGNAL.tsx`

(148 lines — see Section 19 for full source):
- `WidgetCategory` type: `productivity | analytics | schedule | insight | activity | health | ai | dev | finance | learning | browsing | social`
- `CATEGORY_ACCENT`: Maps category → hex color (see Section 3)
- `WidgetCardA({ category, children, className, hoverable })`: `bg-zinc-900 p-5 rounded-xl border border-zinc-800/60`
- `SignalBar({ category })`: 2px top-edge bar with `linear-gradient(90deg, ${hex} 0%, ${hex}20 100%)`
- `CardEntrance({ children, index })`: Wraps in `BlurFade` with `delay: 0.05 * index`, `duration: 0.25`

### `src/components/dashboard/WidgetCardB_TERMINAL.tsx`

See Section 19 for full source:
- `WidgetCardB({ widgetId, title, icon, accent, kicker, ... })`: `rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800`
- `TerminalLabel`: `text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-zinc-500`
- States: loading (skeleton), error (rose border), empty, populated (with `AnimatePresence`)
- Collapse animation: `initial: { height: 0, opacity: 0 }`, `animate: { height: 0, opacity: 0 }`, `ease: [0.16, 1, 0.3, 1]`
- Expand animation: `initial: { opacity: 0, x: -4 }`, `animate: { opacity: 1, x: 0 }`

### `src/components/dashboard/WidgetCardC_NEON.tsx`

See Section 19 for full source:
- `WidgetCardC({ widgetId, title, icon, neonColor, ... })`: `rounded-xl bg-zinc-900/40 backdrop-blur-sm text-zinc-100 border border-zinc-800/50`
- `NeonEdge`: `absolute top-0 left-0 right-0 h-px` with gradient from neonColor
- `NeonIconBox`: `backgroundColor: ${color}10`, `border: 1px solid ${color}25`, `boxShadow: 0 0 12px -4px ${color}20`
- Ambient glow: `radial-gradient(circle, ${neonColor}20 0%, transparent 70%)`, `filter: blur(24px)`, `animate: opacity: [0.2, 0.4, 0.2]`, `duration: 4, repeat: Infinity`
- Expand animation: `initial: { opacity: 0, y: 6, scale: 0.98 }`, `animate: { opacity: 1, y: 0, scale: 1 }`, `ease: [0.16, 1, 0.3, 1]`

### `src/components/dashboard/DeskFlowCard.tsx`

Reference component (already polished):
- `DeskFlowCard`: `relative overflow-hidden rounded-xl transition-colors duration-200`, `motion.div`, `whileHover: { y: -2, scale: 1.005 }`, `whileTap: { scale: 0.98 }`, `boxShadow: 0 0 20px rgba(244, 63, 94, 0.12)`
- `DeskFlowCardMotion`: `rounded-xl bg-zinc-900/80 overflow-hidden transition-colors duration-200 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)] flex-1 min-h-0 cursor-pointer`
- `accentColors`: pink/amber/emerald with rail, border, bg variants

### `src/components/dashboard/StopwatchPanelA_SIGNAL.tsx`

See Section 19 for full source:
- 2-col grid: timer (40px mono) | 3 stat wells
- Timer: `text-[40px] font-bold font-['JetBrains_Mono'] text-zinc-100`
- Status: 8px dot + `text-[12px] text-zinc-400`
- Actions: `bg-pink-500 text-zinc-950 text-[12px] font-semibold` button + `border-zinc-700` reset button
- Stats wells: `bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3`

### `src/components/dashboard/PrototypePreview.tsx`

See Section 19 for full source:
- Tab filtering: `all/A/B/C`
- Each prototype section has `PreviewSection` wrapper with separator lines
- Mock data: `MOCK_PRODUCTIVE_MS`, `MOCK_DISTRACTING_MS`, `MOCK_STREAK`, `MOCK_SCORE`, `MOCK_CHART_DATA`

### `src/pages/DashboardPage.tsx`

Main dashboard page (3145 lines). Uses `DeskFlowCardMotion`, `DeskFlowCard`, `WidgetLibraryPopup`, various widget components. Currently does NOT use the prototype components directly.

---

## 15. Architecture Notes

- **Data flow**: DashboardPage → `useDashboardLayout` hook → widget components
- **State**: Widget visibility persisted via `useDashboardLayout` (localStorage with sanitized self-healing)
- **Styling**: Tailwind CSS v4 with CSS custom properties via `@theme` block in `src/index.css`
- **Motion**: `motion/react` (framer-motion v12), `BlurFade` component for entrance animations
- **Icons**: `lucide-react`
- **Buttons**: `@/components/ui/button` (shadcn Button)
- **Skeletons**: `src/components/ui/skeleton`
- **Build**: `npx vite build` → `dist/`, `node scripts/build.mjs` → `dist-electron/`

---

## 16. Current Visual Problems

The prototype components look like "AI slop" because:
1. **SIGNAL**: Too plain, `bg-zinc-900 p-5` is generic, `SignalBar` is just a 2px line — needs more visual identity
2. **TERMINAL CHIC**: Flat gunmetal, all 11px uppercase mono everywhere — too monolithic, needs breathing room and visual hierarchy
3. **NEON GLASS**: Glass opacity (`bg-zinc-900/40`) feels weak, ambient glow looks artificial — needs stronger surface definition and more purposeful motion
4. **All three**: Missing LAMINAR design system cohesion — inconsistent token usage, missing state coverage, no visual depth hierarchy

---

## 17. ANTI-SLOP CHECKLIST (12 items — every one must PASS)

Self-audit every component against all 12. This is the gate.

1. **Re-skin to project tokens** — All colors use `--dk-*`, `--ws-*`, `--color-*`, or `var(--page-accent)`. NO hardcoded hex except inside `CATEGORY_ACCENT` mappings and hex-alpha suffixes derived from the category color (e.g. `${cat}14`, `${cat}40`) — this matches the existing code pattern.
2. **Max `rounded-xl`, `p-5` padding** — No `rounded-2xl`, no `rounded-3xl`, no `p-6`/`p-8`. Radii ∈ {8, 12, pill}.
3. **Dark mode only** — No light-mode variants needed.
4. **Fonts: max 2 per view** — `Inter` (body), `Space Grotesk` (display/hero), `JetBrains Mono` (code/numbers). Pick 2 per view, never 3.
5. **Glass layer where applicable** — `bg-zinc-900/80 backdrop-blur-xl` quality. A direction may legitimately be solid/flat (then glass is N/A and must be stated).
6. **No glassmorphism on chrome** — Glass is ONLY for page/widget surfaces, never the app shell or sidebar.
7. **One signal hue per surface** — Each widget has exactly ONE accent color from `CATEGORY_ACCENT`.
8. **Radii: 8 / 12 / pill only** — No arbitrary border-radius values.
9. **`prefers-reduced-motion` honored** — Every animation checks `useReducedMotion()` and degrades to a static equivalent.
10. **No decorative glow/gradients** — Every gradient/glow serves a functional purpose (signal identity, hover feedback, elevation). Nothing purely ornamental.
11. **No spring/bounce** — `cubic-bezier(0.16, 1, 0.3, 1)` only. Never `transition: all`.
12. **Typography hierarchy** — Display numbers in Space Grotesk/mono, body in Inter, code/data in JetBrains Mono. Never a wall of 11px mono.

---

## 18. Constraints

- **DO NOT CHANGE LAYOUT** — same grid, same component structure, same prop interfaces, same file paths
- Keep all existing TypeScript interfaces (`WidgetCardProps`, `StopwatchPanelProps`, `WidgetCategory`)
- Keep all existing component names (`WidgetCardA`, `WidgetCardB`, `WidgetCardC`, `StopwatchPanelA`, `CardEntrance`, `SignalBar`, `NeonEdge`, `NeonIconBox`)
- Keep `BlurFade` entrance system — do not replace it
- Keep `motion/react` as animation engine — do not switch to GSAP/Anime.js/CSS-only
- Must use `useReducedMotion()` — all motion components must check for reduced motion
- No new npm dependencies — only what's already installed
- Dark mode only
- Preserve all `aria-label` and `focus-visible` attributes
- Each direction must feel DISTINCT
- All design decisions must pass every rule in this bundle

---

## 19. FULL SOURCE — EVERY PROTOTYPE COMPONENT

Everything below is **verbatim, unedited source**. Spec against the real classes,
real prop interfaces, and real element structure. Do NOT spec from "structural
hooks" or assumptions — the source you need is here.

**Note:** `WidgetSummaries.tsx` and `DashboardPage.tsx` are intentionally omitted —
they are consumers, not style targets. The 15 files below are the complete set of
files you are restyling.

### `src/components/dashboard/WidgetCardA_SIGNAL.tsx` (149 lines)
```tsx
// ============================================================
// RHEO Dashboard — WidgetCard PROTOTYPE A: "SIGNAL"
// Solid signal panels with category top-edge bars (2px).
// L1 composed. No glass, no glow, no tricks.
// Spec-compliant rewrite. Drop-in replacement for existing A_SIGNAL.
// ============================================================

import { clsx, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BlurFade } from "../ui/blur-fade";

// ── Category → accent mapping ──────────────────────────
export type WidgetCategory =
  | "productivity"
  | "analytics"
  | "schedule"
  | "insight"
  | "activity"
  | "health"
  | "ai"
  | "dev"
  | "finance"
  | "learning"
  | "browsing"
  | "social";

export const CATEGORY_ACCENT: Record<WidgetCategory, string> = {
  productivity: "#ec4899",
  analytics: "#22d3ee",
  schedule: "#a78bfa",
  insight: "#34d399",
  activity: "#fbbf24",
  health: "#38bdf8",
  ai: "#fb7185",
  dev: "#a1a1aa",
  finance: "#10b981",
  learning: "#fb923c",
  browsing: "#60a5fa",
  social: "#e879f9",
};

export const CATEGORY_CLASS: Record<WidgetCategory, string> = {
  productivity: "text-pink-500",
  analytics: "text-cyan-400",
  schedule: "text-violet-400",
  insight: "text-emerald-400",
  activity: "text-amber-400",
  health: "text-sky-400",
  ai: "text-rose-400",
  dev: "text-zinc-400",
  finance: "text-emerald-500",
  learning: "text-orange-400",
  browsing: "text-blue-400",
  social: "text-fuchsia-400",
};

export function categoryBarStyle(cat: WidgetCategory): React.CSSProperties {
  const hex = CATEGORY_ACCENT[cat];
  return {
    background: `linear-gradient(90deg, ${hex} 0%, ${hex}20 100%)`,
  };
}

// ── Signal bar (2px top edge, category color) ──────────
export function SignalBar({ category }: { category: WidgetCategory }) {
  const reduce = useReducedMotion();
  return (
    <div
      style={categoryBarStyle(category)}
      className={clsx(
        "absolute inset-x-0 top-0 h-[2px]",
        reduce ? "opacity-100" : "opacity-80 transition-opacity duration-200"
      )}
    />
  );
}

// ── Widget Card Props (spec-compliant flat API) ────────
export interface WidgetCardProps {
  category: WidgetCategory;
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

/** Spec-compliant: solid zinc-900 slab, 2px category top-edge bar, no glass. */
export function WidgetCardA({
  category,
  children,
  className = "",
  hoverable = true,
}: WidgetCardProps) {
  const reduce = useReducedMotion();

  return (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900 p-5",
        hoverable && clsx(
          "hover:border-zinc-700",
          reduce ? "" : "transition-colors duration-200"
        ),
        className
      )}
    >
      {/* Category top-edge bar — primary signal */}
      <SignalBar category={category} />

      {/* Hover: brighten bar via inline style transition */}
      {hoverable && (
        <div
          className="absolute inset-x-0 top-0 h-[2px] pointer-events-none transition-opacity duration-200"
          style={{
            background: `linear-gradient(90deg, ${CATEGORY_ACCENT[category]} 0%, ${CATEGORY_ACCENT[category]}40 100%)`,
            opacity: reduce ? 1 : 0.8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.8";
          }}
        />
      )}

      <div className="relative">{children}</div>
    </div>
  );
}

// ── Entrance animation wrapper (BlurFade, L1) ─────────
export function CardEntrance({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
}) {
  const reduce = useReducedMotion();
  return (
    <BlurFade
      delay={reduce ? 0 : 0.05 * index}
      duration={reduce ? 0 : 0.25}
    >
      {children}
    </BlurFade>
  );
}
```

### `src/components/dashboard/WidgetCardB_TERMINAL.tsx` (251 lines)
```tsx
// ============================================================
// RHEO Dashboard — WidgetCard PROTOTYPE B: "TERMINAL CHIC"
// Flat gunmetal panels. All mono. Tight spacing. Terminal aesthetic.
// Category signal = border color, not top-edge bar.
// ============================================================

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GripVertical, EyeOff, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';

const MotionBtn = motion(Button);

// ── Card primitives (TERMINAL CHIC: flat bg-zinc-900, tight p-4, rounded-lg) ──
const Card = ({ className = '', children, borderColor, ...props }: React.HTMLAttributes<HTMLDivElement> & { borderColor?: string }) => (
  <div
    className={`rounded-lg bg-zinc-900 text-zinc-100 border ${borderColor || 'border-zinc-800'} ${className}`}
    {...props}
  >
    {children}
  </div>
);

const CardHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1 p-4 pb-0 ${className}`} {...props}>
    {children}
  </div>
);

// Terminal label: 11px uppercase mono
const TerminalLabel = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`text-[11px] font-mono font-semibold uppercase tracking-[0.15em] text-zinc-500 leading-none ${className}`} {...props}>
    {children}
  </div>
);

const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-4 pt-3 ${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center p-4 pt-0 border-t border-zinc-800/50 ${className}`} {...props}>
    {children}
  </div>
);

// ── Widget Card Props ──
export interface WidgetCardProps {
  widgetId: string;
  title: string;           // Used as terminal label (uppercase mono)
  icon: any;
  accent?: string;         // border color when active/hover
  kicker?: string;
  description?: string;
  collapsible?: boolean;
  removable?: boolean;
  draggable?: boolean;
  hidden?: boolean;
  onToggleVisibility?: () => void;
  onRemove?: () => void;
  children: ReactNode;
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  empty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * TERMINAL CHIC prototype: flat gunmetal panel.
 * All numbers in mono (JetBrains Mono). Labels in 11px uppercase mono.
 * Category signal = border color. No top-edge bars.
 */
export function WidgetCardB({
  widgetId,
  title,
  icon: Icon,
  accent = 'var(--page-accent)',
  kicker,
  description,
  collapsible = false,
  removable = false,
  draggable = false,
  hidden = false,
  onToggleVisibility,
  onRemove,
  children,
  loading = false,
  error = false,
  errorMessage = 'Failed to load widget data',
  empty = false,
  emptyMessage = 'No data available',
  emptyIcon,
  footer,
  className = '',
}: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  // ── Loading ──
  if (loading) {
    return (
      <Card className={`h-full relative overflow-hidden ${className}`} data-widget-id={widgetId} data-state="loading">
        <CardHeader>
          <TerminalLabel>
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-20 ml-2" />
          </TerminalLabel>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <Card className={`h-full border-rose-500/20 relative overflow-hidden ${className}`} data-widget-id={widgetId} data-state="error">
        <CardContent>
          <div className="flex items-center gap-2 text-rose-400 text-[13px] font-mono">
            <AlertTriangle size={14} />
            <span>{errorMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty ──
  if (empty) {
    return (
      <Card className={`h-full relative overflow-hidden ${className}`} data-widget-id={widgetId} data-state="empty">
        <CardHeader>
          <TerminalLabel>{title}</TerminalLabel>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500 text-[13px] font-mono">
            {emptyIcon && <div className="opacity-30">{emptyIcon}</div>}
            <span>{emptyMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Populated ──
  return (
    <Card
      className={`h-full relative overflow-hidden ${className} ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      borderColor={`border-zinc-800 hover:border-zinc-600 ${draggable ? 'cursor-grab' : ''}`}
      data-widget-id={widgetId}
      data-state="populated"
    >
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-200" style={{ opacity: 0 }}>
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{
            boxShadow: `inset 0 0 30px -10px ${accent}20`,
          }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <CardHeader>
        <TerminalLabel>
          {Icon && <span className="mr-2 text-zinc-600"><Icon size={12} strokeWidth={1.5} /></span>}
          {title.toUpperCase()}
          {kicker && <span className="ml-2 text-zinc-600">— {kicker}</span>}
        </TerminalLabel>
        {description && (
          <div className="text-[10px] font-mono text-zinc-600 italic">{description}</div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {removable && (
            <MotionBtn
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 rounded"
              aria-label="Remove widget"
            >
              <X size={12} />
            </MotionBtn>
          )}
          {collapsible && (
            <MotionBtn
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 rounded"
              aria-label={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <EyeOff size={12} /> : <AlertTriangle size={12} />}
            </MotionBtn>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {collapsed ? (
            <motion.div
              key="collapsed"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 0, opacity: 0 }}
              exit={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.15 }}
              style={{ overflow: 'hidden' }}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {footer && <CardFooter>{footer}</CardFooter>}

      {draggable && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical size={10} className="text-zinc-600" />
        </div>
      )}
    </Card>
  );
}
```

### `src/components/dashboard/WidgetCardC_NEON.tsx` (303 lines)
```tsx
// ============================================================
// RHEO Dashboard — WidgetCard PROTOTYPE C: "NEON GLASS"
// Dark glass panels with neon edge accents.
// Glass surface on dark page bg (LAMINAR-compliant: glass on chrome is banned,
// glass on page bg is fine). Neon glow on hover. Premium feel.
// ============================================================

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GripVertical, EyeOff, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';

const MotionBtn = motion(Button);

// ── Card primitives (NEON GLASS: glass surface + neon border + hover glow) ──
const Card = ({ className = '', children, neonColor, ...props }: React.HTMLAttributes<HTMLDivElement> & { neonColor?: string }) => {
  const neon = neonColor || 'var(--page-accent)';
  return (
    <div
      className={`rounded-xl bg-zinc-900/40 backdrop-blur-sm text-zinc-100 border border-zinc-800/50 hover:border-[${neon}]/40 hover:shadow-[0_0_24px_-8px_${neon}/12] transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 p-5 pb-0 ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center gap-2.5 text-[13px] font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </div>
);

const CardDescription = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`text-[12px] text-zinc-500 ${className}`} {...props}>
    {children}
  </div>
);

const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pt-3 ${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex items-center p-5 pt-0 border-t border-zinc-800/30 ${className}`} {...props}>
    {children}
  </div>
);

// ── Neon top edge (2px line, category color, subtle) ──
function NeonEdge({ color = 'var(--page-accent)' }: { color?: string }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 h-px rounded-none"
      style={{
        background: `linear-gradient(to right, ${color}60, ${color}30, transparent)`,
      }}
    />
  );
}

// ── Icon box (glass-like, tinted bg + accent border) ──
function NeonIconBox({ icon: Icon, color = 'var(--page-accent)', size = 30 }: {
  icon: any; color?: string; size?: number;
}) {
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: `${color}10`,
        border: `1px solid ${color}25`,
        boxShadow: `0 0 12px -4px ${color}20`,
      }}
    >
      {Icon && <Icon size={size * 0.5} style={{ color }} strokeWidth={2} />}
    </div>
  );
}

// ── Widget Card Props ──
export interface WidgetCardProps {
  widgetId: string;
  title: string;
  icon: any;
  neonColor?: string;      // neon accent color (hex or CSS var)
  kicker?: string;
  description?: string;
  collapsible?: boolean;
  removable?: boolean;
  draggable?: boolean;
  hidden?: boolean;
  onToggleVisibility?: () => void;
  onRemove?: () => void;
  children: ReactNode;
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  empty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * NEON GLASS prototype: dark glass panel with neon edge accent.
 * Hover brightens neon border + reveals subtle glow shadow.
 * Premium, polished, alive. LAMINAR-compliant: glass on page bg only.
 */
export function WidgetCardC({
  widgetId,
  title,
  icon: Icon,
  neonColor = 'var(--page-accent)',
  kicker,
  description,
  collapsible = false,
  removable = false,
  draggable = false,
  hidden = false,
  onToggleVisibility,
  onRemove,
  children,
  loading = false,
  error = false,
  errorMessage = 'Failed to load widget data',
  empty = false,
  emptyMessage = 'No data available',
  emptyIcon,
  footer,
  className = '',
}: WidgetCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  // ── Loading ──
  if (loading) {
    return (
      <Card className={`h-full relative overflow-hidden ${className}`} neonColor={neonColor} data-widget-id={widgetId} data-state="loading">
        <NeonEdge color={neonColor} />
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <Card className={`h-full border-rose-500/20 relative overflow-hidden ${className}`} neonColor="rose-400" data-widget-id={widgetId} data-state="error">
        <NeonEdge color="rose-400" />
        <CardContent>
          <div className="flex items-center gap-2 text-rose-400 text-[13px]">
            <AlertTriangle size={14} />
            <span>{errorMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty ──
  if (empty) {
    return (
      <Card className={`h-full relative overflow-hidden ${className}`} neonColor={neonColor} data-widget-id={widgetId} data-state="empty">
        <NeonEdge color={neonColor} />
        <CardHeader>
          <CardTitle>
            <NeonIconBox icon={emptyIcon || Icon} color={neonColor} size={28} />
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500 text-[13px]">
            {emptyIcon && <div className="opacity-30">{emptyIcon}</div>}
            <span>{emptyMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Populated ──
  return (
    <Card
      className={`h-full relative overflow-hidden ${className} ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      neonColor={neonColor}
      data-widget-id={widgetId}
      data-state="populated"
    >
      {/* Neon top edge — category identity */}
      <NeonEdge color={neonColor} />

      {/* Ambient glow behind content (subtle breathing) */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-0 right-0 w-40 h-40 rounded-full"
          style={{
            background: `radial-gradient(circle, ${neonColor}20 0%, transparent 70%)`,
            filter: 'blur(24px)',
          }}
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <CardHeader>
        <CardTitle>
          <NeonIconBox icon={Icon} color={neonColor} size={28} />
          <span className="flex flex-col">
            <span>{kicker && <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 -mt-0.5">{kicker}</span>}</span>
            <span>{title}</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            {removable && (
              <MotionBtn
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded-lg"
                aria-label="Remove widget"
              >
                <X size={14} />
              </MotionBtn>
            )}
            {collapsible && (
              <MotionBtn
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 rounded-lg"
                aria-label={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? <EyeOff size={14} /> : <AlertTriangle size={14} />}
              </MotionBtn>
            )}
          </div>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {collapsed ? (
            <motion.div
              key="collapsed"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 0, opacity: 0 }}
              exit={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>

      {footer && <CardFooter>{footer}</CardFooter>}

      {/* Drag handle */}
      {draggable && (
        <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical size={12} className="text-zinc-600" />
        </div>
      )}
    </Card>
  );
}
```

### `src/components/dashboard/StopwatchPanelA_SIGNAL.tsx` (150 lines)
```tsx
// ============================================================
// RHEO Dashboard — Stopwatch Panel PROTOTYPE A: "SIGNAL"
// Spec-compliant rewrite: 40px mono timer, 2-col grid,
// status dot + label, 3 stat wells, Start/Pause + Reset.
// L1 composed. NO NumberTicker, NO BorderBeam, NO pulsing.
// ============================================================

import { useMemo } from "react";
import { motion } from "motion/react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { WidgetCardA, type WidgetCategory, CardEntrance } from "./WidgetCardA_SIGNAL";

const CATEGORY: WidgetCategory = "productivity";

// ── Format ms → hh:mm:ss ───────────────────────────────
function fmtSec(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Status config ───────────────────────────────────────
const STATUS_CONFIG = {
  productive: { dot: "bg-emerald-500", label: "PRODUCTIVE" },
  distracting: { dot: "bg-amber-500", label: "DISTRACTING" },
  neutral: { dot: "bg-zinc-500", label: "IDLE" },
  paused: { dot: "bg-zinc-600", label: "PAUSED" },
  idle: { dot: "bg-zinc-600", label: "NO ACTIVITY DETECTED" },
};

// ── Props ───────────────────────────────────────────────
interface StopwatchPanelProps {
  productiveMs: number;
  distractingMs: number;
  isPaused: boolean;
  lastTier: "productive" | "neutral" | "distracting" | null;
  onPauseToggle: () => void;
  onStop: () => void;
  onReset: () => void;
  streak: number;
  score: number;
  className?: string;
}

// ── Panel ───────────────────────────────────────────────
export function StopwatchPanelA({
  productiveMs,
  distractingMs,
  isPaused,
  lastTier,
  onPauseToggle,
  onStop,
  onReset,
  streak,
  score,
  className = "",
}: StopwatchPanelProps) {
  const display = fmtSec(productiveMs);
  const status = lastTier ? STATUS_CONFIG[lastTier] : STATUS_CONFIG.idle;

  return (
    <CardEntrance index={0}>
      <WidgetCardA category={CATEGORY} className="xl:col-span-2">
        <div className="grid grid-cols-[auto_1fr] gap-6">
          {/* LEFT: Timer block */}
          <div className="flex flex-col">
            {/* Kicker — only place besides bar where category color appears as text */}
            <div className="mb-3">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-500">
                SESSION
              </span>
            </div>

            {/* Timer display — 40px mono, colons static, digits zinc-100 */}
            <div className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {display}
            </div>

            {/* Status line — 8px dot + label */}
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${status.dot}`}
                aria-label={status.label}
              />
              <span className="text-[12px] font-medium text-zinc-400">
                {status.label}
              </span>
              {lastTier === "paused" && (
                <Pause className="ml-auto text-[12px] text-zinc-600" size={12} />
              )}
            </div>

            {/* Actions — bottom-right of left column */}
            <div className="mt-6 flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-pink-500 text-zinc-950 text-[12px] font-semibold hover:bg-pink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500/50 transition-colors duration-150"
                onClick={isPaused ? onStop : onPauseToggle}
                aria-label={isPaused ? "Resume session" : "Pause session"}
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                {isPaused ? "Resume" : "Pause"}
              </motion.button>

              <button
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-zinc-700 text-zinc-400 text-[12px] hover:text-zinc-100 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500/50 transition-colors duration-150"
                onClick={onReset}
                aria-label="Reset session"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>

          {/* RIGHT: Today's stats — three inner wells */}
          <div className="grid grid-cols-3 gap-3">
            {/* Focused */}
            <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
              <div className="text-[11px] font-medium text-zinc-500">Focused</div>
              <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
                {productiveMs > 0 ? fmtSec(productiveMs) : "--"}
              </div>
            </div>

            {/* Distracted */}
            <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
              <div className="text-[11px] font-medium text-zinc-500">Distracted</div>
              <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
                {distractingMs > 0 ? fmtSec(distractingMs) : "--"}
              </div>
            </div>

            {/* Sessions */}
            <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
              <div className="text-[11px] font-medium text-zinc-500">Sessions</div>
              <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
                {streak > 0 ? streak : "--"}
              </div>
            </div>
          </div>
        </div>
      </WidgetCardA>
    </CardEntrance>
  );
}
```

### `src/components/dashboard/StopwatchPanelB_TERMINAL.tsx` (161 lines)
```tsx
// ============================================================
// RHEO Dashboard — Stopwatch Panel PROTOTYPE B: "TERMINAL CHIC"
// Flat gunmetal panel. 52px mono timer. Terminal aesthetic.
// Border color = category signal (pink when productive, rose when distracted).
// ============================================================

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Square, RotateCw, Flame, Zap } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { WidgetCardProps } from './WidgetCardB_TERMINAL';
import { WidgetCardB } from './WidgetCardB_TERMINAL';

interface StopwatchPanelProps {
  productiveMs: number;
  distractingMs: number;
  isPaused: boolean;
  lastTier: 'productive' | 'neutral' | 'distracting' | null;
  onPauseToggle: () => void;
  onStop: () => void;
  onReset: () => void;
  streak: number;
  score: number;
  className?: string;
}

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtShort(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StopwatchPanelB({
  productiveMs,
  distractingMs,
  isPaused,
  lastTier,
  onPauseToggle,
  onStop,
  onReset,
  streak,
  score,
  className = '',
}: StopwatchPanelProps) {
  const isProductive = lastTier === 'productive' && !isPaused;
  const isDistracting = lastTier === 'distracting' && !isPaused;
  const borderColor = isDistracting ? 'border-rose-500/50' : isProductive ? 'border-pink-500/50' : 'border-zinc-700';

  return (
    <WidgetCardB
      widgetId="status-band"
      title="Session Timer"
      icon={Zap}
      accent="#ec4899"
      className={`${className} ${borderColor} transition-colors duration-200`}
      empty={productiveMs === 0 && distractingMs === 0}
      emptyMessage="No session active — click Resume to start"
      emptyIcon={<Zap size={16} />}
    >
      {/* Timer — 52px mono, largest element */}
      <div className="text-center py-2">
        <div className="text-[52px] font-mono font-bold tabular-nums leading-none tracking-tight text-zinc-100">
          <NumberTicker value={productiveMs} formatter={fmtTime} delay={0} duration={600} />
        </div>
        <div className="text-[14px] font-mono text-zinc-500 mt-1 tabular-nums">
          {fmtShort(productiveMs)}
        </div>
      </div>

      {/* Status line — mono uppercase */}
      <div className="flex items-center justify-center gap-2 py-2 border-t border-zinc-800/30">
        <div className={`w-2 h-2 rounded-full ${isProductive ? 'bg-emerald-400 animate-pulse' : isDistracting ? 'bg-rose-400' : 'bg-zinc-600'}`} style={{ animationDuration: isProductive ? '2s' : '0' }} />
        <span className="text-[11px] font-mono uppercase tracking-wider" style={{
          color: isProductive ? '#34d399' : isDistracting ? '#f43f5e' : '#71717a'
        }}>
          {isProductive ? 'RUNNING — In focus session' : isDistracting ? 'DISTRACTED — Switch away' : isPaused ? 'PAUSED — Take a break' : 'IDLE — Not tracking'}
        </span>
      </div>

      {/* Buttons — compact 36px, icon-only with aria-label */}
      <div className="flex items-center justify-center gap-1 mt-3">
        {!isPaused && lastTier !== null ? (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPauseToggle}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-700/50 active:scale-[0.97] transition-all duration-150"
              aria-label="Pause timer"
            >
              <Pause size={14} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStop}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-700/50 active:scale-[0.97] transition-all duration-150"
              aria-label="Stop timer"
            >
              <Square size={14} />
            </motion.button>
          </>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPauseToggle}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-pink-500/30 bg-pink-500/5 text-pink-400 hover:bg-pink-500/10 hover:border-pink-400/50 active:scale-[0.97] transition-all duration-150"
            aria-label="Resume timer"
          >
            <Play size={14} />
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-600 hover:border-zinc-500 hover:bg-zinc-700/50 active:scale-[0.97] transition-all duration-150"
          aria-label="Reset timer"
        >
          <RotateCw size={14} />
        </motion.button>
      </div>

      {/* Bottom meta — 2-column mono, aligned */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-3 mt-2">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Productive</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{fmtShort(productiveMs)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Distracted</span>
            <span className="text-[13px] font-mono text-rose-400/70 tabular-nums">{fmtShort(distractingMs)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Streak</span>
            <span className="text-[13px] font-mono text-orange-400/80 tabular-nums">{streak}d</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Score</span>
            <span className="text-[13px] font-mono text-pink-400/80 tabular-nums">{score}/100</span>
          </div>
        </div>
      </div>
    </WidgetCardB>
  );
}
```

### `src/components/dashboard/StopwatchPanelC_NEON.tsx` (189 lines)
```tsx
// ============================================================
// RHEO Dashboard — Stopwatch Panel PROTOTYPE C: "NEON GLASS"
// Dark glass panel. 44px pink-tinted mono timer.
// Pulsing status ring when active. Neon border on hover.
// ============================================================

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Square, RotateCw, Flame, Zap } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import { BorderBeam } from '../ui/border-beam';
import type { WidgetCardProps } from './WidgetCardC_NEON';
import { WidgetCardC } from './WidgetCardC_NEON';

interface StopwatchPanelProps {
  productiveMs: number;
  distractingMs: number;
  isPaused: boolean;
  lastTier: 'productive' | 'neutral' | 'distracting' | null;
  onPauseToggle: () => void;
  onStop: () => void;
  onReset: () => void;
  streak: number;
  score: number;
  className?: string;
}

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtShort(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StopwatchPanelC({
  productiveMs,
  distractingMs,
  isPaused,
  lastTier,
  onPauseToggle,
  onStop,
  onReset,
  streak,
  score,
  className = '',
}: StopwatchPanelProps) {
  const isProductive = lastTier === 'productive' && !isPaused;
  const isDistracting = lastTier === 'distracting' && !isPaused;
  const neonColor = isDistracting ? '#f43f5e' : isProductive ? '#ec4899' : '#ec4899';
  const timerTextColor = isProductive ? '#f9a8d4' : '#fafafa';

  return (
    <WidgetCardC
      widgetId="status-band"
      title="Stopwatch"
      icon={Zap}
      neonColor={neonColor}
      kicker="SESSION TIMER"
      className={className}
      empty={productiveMs === 0 && distractingMs === 0}
      emptyMessage="No active session — click Resume to start tracking"
      emptyIcon={<Zap size={24} />}
    >
      {/* Timer — 44px mono, pink-tinted when productive */}
      <div className="text-center mb-4">
        <div className="text-[44px] font-mono font-bold tabular-nums leading-none tracking-tight" style={{ color: timerTextColor }}>
          <NumberTicker value={productiveMs} formatter={fmtTime} delay={0} duration={800} />
        </div>
        <div className="text-[13px] font-mono text-zinc-500 mt-1 tabular-nums">
          {fmtShort(productiveMs)}
        </div>
      </div>

      {/* Status pill with pulsing ring */}
      <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-xl bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50">
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${isProductive ? 'bg-emerald-400' : isDistracting ? 'bg-rose-400' : 'bg-zinc-600'}`} />
          {isProductive && (
            <motion.div
              className="absolute inset-2 rounded-full border-2"
              style={{ borderColor: 'rgba(52, 211, 153, 0.3)' }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {isDistracting && (
            <motion.div
              className="absolute inset-2 rounded-full border-2"
              style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
        <span className="text-[11px] font-mono uppercase tracking-wider" style={{
          color: isProductive ? '#34d399' : isDistracting ? '#f43f5e' : '#71717a'
        }}>
          {isProductive ? 'RUNNING — In focus' : isDistracting ? 'DISTRACTED — Switch apps' : isPaused ? 'PAUSED — Take a break' : 'IDLE — Not tracking'}
        </span>
      </div>

      {/* Action buttons — glass style with neon hover */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {!isPaused && lastTier !== null ? (
          <>
            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onPauseToggle}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm text-zinc-300 hover:border-pink-500/30 hover:bg-pink-500/5 hover:shadow-[0_0_16px_-4px_rgba(236,72,153,0.15)] transition-all duration-300"
            >
              <Pause size={14} />
              <span className="text-[11px] font-mono uppercase">Pause</span>
            </motion.button>
            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStop}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm text-zinc-300 hover:border-rose-500/30 hover:bg-rose-500/5 hover:shadow-[0_0_16px_-4px_rgba(244,63,94,0.15)] transition-all duration-300"
            >
              <Square size={14} />
              <span className="text-[11px] font-mono uppercase">Stop</span>
            </motion.button>
          </>
        ) : (
          <motion.button
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onPauseToggle}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/5 text-pink-300 hover:bg-pink-500/10 hover:border-pink-400/50 hover:shadow-[0_0_20px_-4px_rgba(236,72,153,0.2)] transition-all duration-300"
          >
            <Play size={14} />
            <span className="text-[11px] font-mono uppercase">Resume</span>
          </motion.button>
        )}
        <motion.button
          whileHover={{ y: -1, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onReset}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm text-zinc-500 hover:border-zinc-600 hover:shadow-[0_0_12px_-4px_rgba(113,113,122,0.1)] transition-all duration-300"
        >
          <RotateCw size={14} />
          <span className="text-[11px] font-mono uppercase">Reset</span>
        </motion.button>
      </div>

      {/* Bottom meta — glass pills */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Today</div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-500">Productive</span>
            <span className="text-[13px] font-mono font-medium text-emerald-400 tabular-nums">{fmtShort(productiveMs)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-mono text-zinc-500">Distracted</span>
            <span className="text-[13px] font-mono font-medium text-rose-400 tabular-nums">{fmtShort(distractingMs)}</span>
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Tracked</div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
              <Flame size={10} className="text-orange-400" /> Streak
            </span>
            <span className="text-[13px] font-mono font-medium text-orange-400 tabular-nums">{streak} days</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-mono text-zinc-500">Score</span>
            <span className="text-[13px] font-mono font-medium text-pink-300 tabular-nums">{score}/100</span>
          </div>
        </div>
      </div>

      {/* BorderBeam on productive */}
      {isProductive && <BorderBeam size={120} duration={8} colorFrom="#ec4899" colorTo="#f472b6" />}
    </WidgetCardC>
  );
}
```

### `src/components/dashboard/TrackingScorePanelA_SIGNAL.tsx` (162 lines)
```tsx
// ============================================================
// RHEO Dashboard — Tracking Score Panel PROTOTYPE A: "SIGNAL"
// Spec-compliant rewrite: 20-segment bar (NOT circular gauge),
// 40px mono score + /100, trend arrow, 3 breakdown rows
// with animated scaleX tracks. L1 composed.
// ============================================================

import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { WidgetCardA, type WidgetCategory, CardEntrance } from "./WidgetCardA_SIGNAL";

const CATEGORY: WidgetCategory = "productivity";

interface MomentumScoreData {
  score: number;
  trend: "up" | "down" | "stable";
}

const BAND_COLORS = {
  emerald: "#34d399",
  sky: "#38bdf8",
  amber: "#fbbf24",
  orange: "#f97316",
  red: "#f87171",
};

function bandForScore(score: number): keyof typeof BAND_COLORS {
  if (score >= 80) return "emerald";
  if (score >= 60) return "sky";
  if (score >= 40) return "amber";
  if (score >= 20) return "orange";
  return "red";
}

export function TrackingScorePanelA({
  data,
  className = "",
}: {
  data: MomentumScoreData | null;
  className?: string;
}) {
  const score = data?.score ?? 0;
  const trend = data?.trend ?? "stable";
  const band = bandForScore(score);
  const color = BAND_COLORS[band];
  const filledSegments = Math.round((score / 100) * 20);

  const breakdown = [
    { label: "Goals", pct: 40, value: 72 },
    { label: "Schedule", pct: 30, value: 55 },
    { label: "Streak", pct: 30, value: 80 },
  ];

  return (
    <CardEntrance index={1}>
      <WidgetCardA category={CATEGORY} className="xl:col-span-2">
        {/* Kicker */}
        <div className="mb-4">
          <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-500">
            MOMENTUM
          </span>
        </div>

        {/* Score + 20-segment bar */}
        <div className="flex items-center gap-4 mb-5">
          {/* 20-segment bar */}
          <div className="flex gap-[3px] h-6">
            {Array.from({ length: 20 }).map((_, i) => {
              const filled = i < filledSegments;
              return (
                <div
                  key={i}
                  className={`h-6 w-[6px] rounded-sm transition-colors duration-300 ${
                    filled ? "" : "bg-zinc-800"
                  }`}
                  style={
                    filled
                      ? {
                          backgroundColor: color,
                          boxShadow: `0 0 6px ${color}40`,
                        }
                      : { backgroundColor: "#3f3f46" }
                  }
                />
              );
            })}
          </div>

          {/* Score number */}
          <div className="flex items-baseline gap-1">
            <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {score}
            </span>
            <span className="text-[13px] font-medium text-zinc-500">/100</span>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-2 mb-5">
          {trend === "up" && (
            <>
              <TrendingUp className="text-emerald-400" size={12} />
              <span className="text-[11px] font-medium text-emerald-400">+8 vs yesterday</span>
            </>
          )}
          {trend === "down" && (
            <>
              <TrendingDown className="text-red-400" size={12} />
              <span className="text-[11px] font-medium text-red-400">-3 vs yesterday</span>
            </>
          )}
          {trend === "stable" && (
            <>
              <Minus className="text-zinc-500" size={12} />
              <span className="text-[11px] font-medium text-zinc-500">flat</span>
            </>
          )}
        </div>

        {/* Breakdown rows */}
        <div className="space-y-3">
          {breakdown.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-zinc-400 w-[80px]">
                {row.label}
              </span>

              {/* Mini track bar — animates scaleX on mount */}
              <div className="flex-1 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 4px ${color}40`,
                    transformOrigin: "left",
                  }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: row.pct / 100 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              <span className="text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono'] w-[40px] text-right">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Weight legend */}
        <div className="mt-4 pt-3 border-t border-zinc-800/50">
          <div className="flex items-center gap-4 text-[10px] text-zinc-600 uppercase tracking-wider">
            <span>Goals 40%</span>
            <span>Schedule 30%</span>
            <span>Streak 30%</span>
          </div>
        </div>
      </WidgetCardA>
    </CardEntrance>
  );
}
```

### `src/components/dashboard/TrackingScorePanelB_TERMINAL.tsx` (162 lines)
```tsx
// ============================================================
// RHEO Dashboard — Tracking Score PROTOTYPE B: "TERMINAL CHIC"
// Segmented horizontal bar (3 segments: streak/completion/focus).
// Flat bg-zinc-900 panel. All mono. Linear, aligned, terminal style.
// ============================================================

import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, Flame, Target, Clock } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { WidgetCardProps } from './WidgetCardB_TERMINAL';
import { WidgetCardB } from './WidgetCardB_TERMINAL';

interface MomentumScoreData {
  score: number;
  streak: number;
  completionRate: number;
  focusHours: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrackingScorePanelProps {
  data: MomentumScoreData | null;
  loading?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#22d3ee';
  if (score >= 40) return '#fbbf24';
  if (score >= 20) return '#f97316';
  return '#f87171';
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': return <TrendingUp size={10} className="text-emerald-400" />;
    case 'down': return <TrendingDown size={10} className="text-rose-400" />;
    default: return <Minus size={10} className="text-zinc-500" />;
  }
}

export function TrackingScorePanelB({
  data,
  loading = false,
  className = '',
}: TrackingScorePanelProps) {
  const score = data?.score ?? 0;
  const streak = data?.streak ?? 0;
  const completionRate = data?.completionRate ?? 0;
  const focusHours = data?.focusHours ?? 0;
  const trend = data?.trend ?? 'stable';
  const color = getScoreColor(score);

  // Segment weights: streak 30%, completion 40%, focus 30%
  const streakPct = Math.min(30, streak * 3);
  const completionPct = (completionRate / 100) * 40;
  const focusPct = Math.min(30, focusHours * 3);
  const totalScore = Math.min(100, streakPct + completionPct + focusPct);

  return (
    <WidgetCardB
      widgetId="momentum-summary"
      title="Tracking Score"
      icon={Target}
      accent={color}
      className={className}
      loading={loading}
      empty={!data}
      emptyMessage="No score data today"
      emptyIcon={<Target size={16} />}
    >
      {/* Score number — large mono, centered */}
      <div className="text-center mb-3">
        <div className="text-[28px] font-mono font-bold tabular-nums text-zinc-100">
          <NumberTicker value={score} delay={200} duration={800} />
        </div>
        <div className="text-[11px] font-mono text-zinc-600 mt-1 tracking-wider">/ 100</div>
      </div>

      {/* Segmented bar — 3 segments side by side */}
      <div className="mb-3">
        <div className="flex rounded-none h-5 bg-zinc-800 overflow-hidden">
          {/* Streak segment (30%) — amber */}
          <motion.div
            className="h-full"
            style={{ backgroundColor: '#fbbf24' }}
            initial={{ width: 0 }}
            animate={{ width: `${streakPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0 }}
          />
          {/* Completion segment (40%) — emerald */}
          <motion.div
            className="h-full"
            style={{ backgroundColor: '#34d399' }}
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          />
          {/* Focus segment (30%) — cyan */}
          <motion.div
            className="h-full"
            style={{ backgroundColor: '#22d3ee' }}
            initial={{ width: 0 }}
            animate={{ width: `${focusPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
          {/* Empty remainder */}
          <div className="h-full bg-zinc-800" style={{ width: `${100 - Math.min(100, totalScore)}%` }} />
        </div>
        {/* Segment labels below */}
        <div className="flex justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#fbbf24' }} />
            <span className="text-[10px] font-mono uppercase text-zinc-500">Streak 30%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#34d399' }} />
            <span className="text-[10px] font-mono uppercase text-zinc-500">Done 40%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#22d3ee' }} />
            <span className="text-[10px] font-mono uppercase text-zinc-500">Focus 30%</span>
          </div>
        </div>
      </div>

      {/* Trend pill */}
      <div className="flex items-center justify-center gap-1 mb-3 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700">
        {getTrendIcon(trend)}
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
          {trend === 'up' ? 'UP from yesterday' : trend === 'down' ? 'DOWN from yesterday' : 'STABLE'}
        </span>
      </div>

      {/* Meta row — 2-column mono stats */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Streak</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{streak} days</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Done</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{completionRate}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Focus</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{focusHours}h</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-zinc-600">Trend</span>
            <span className="text-[13px] font-mono" style={{ color }}>{score}/100</span>
          </div>
        </div>
      </div>
    </WidgetCardB>
  );
}
```

### `src/components/dashboard/TrackingScorePanelC_NEON.tsx` (185 lines)
```tsx
// ============================================================
// RHEO Dashboard — Tracking Score PROTOTYPE C: "NEON GLASS"
// Glowing radial gauge with breathing outer glow ring.
// Glass card with neon top edge (score-reactive color).
// Score band: emerald >= 60, amber 40-59, rose < 40.
// ============================================================

import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, Flame, Target, Clock } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { WidgetCardProps } from './WidgetCardC_NEON';
import { WidgetCardC } from './WidgetCardC_NEON';

interface MomentumScoreData {
  score: number;
  streak: number;
  completionRate: number;
  focusHours: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrackingScorePanelProps {
  data: MomentumScoreData | null;
  loading?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#22d3ee';
  if (score >= 40) return '#fbbf24';
  if (score >= 20) return '#f97316';
  return '#f87171';
}

function getScoreColorCss(score: number): string {
  if (score >= 80) return 'emerald-400';
  if (score >= 60) return 'sky-400';
  if (score >= 40) return 'amber-400';
  if (score >= 20) return 'orange-400';
  return 'rose-400';
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': return <TrendingUp size={10} className="text-emerald-400" />;
    case 'down': return <TrendingDown size={10} className="text-rose-400" />;
    default: return <Minus size={10} className="text-zinc-500" />;
  }
}

export function TrackingScorePanelC({
  data,
  loading = false,
  className = '',
}: TrackingScorePanelProps) {
  const score = data?.score ?? 0;
  const streak = data?.streak ?? 0;
  const completionRate = data?.completionRate ?? 0;
  const focusHours = data?.focusHours ?? 0;
  const trend = data?.trend ?? 'stable';
  const color = getScoreColor(score);
  const colorCss = getScoreColorCss(score);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <WidgetCardC
      widgetId="momentum-summary"
      title="Tracking Score"
      icon={Target}
      neonColor={color}
      kicker="TODAY"
      className={className}
      loading={loading}
      empty={!data}
      emptyMessage="No score data yet today"
      emptyIcon={<Target size={24} />}
    >
      {/* Glowing radial gauge with breathing outer ring */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative inline-block">
          {/* Breathing outer glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              width: 136, height: 136,
              background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
              filter: 'blur(10px)',
            }}
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* SVG gauge */}
          <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="rgba(59,59,66,0.5)"
              strokeWidth="8"
            />
            {/* Animated progress with glow */}
            <motion.circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              filter="url(#glow)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Glow filter */}
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          {/* Score number — neon-tinted */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono" style={{ color }}>
                <NumberTicker value={score} delay={200} duration={1200} />
              </div>
              <p className="text-[10px] text-zinc-500 -mt-1">/ 100</p>
            </div>
          </div>
        </div>

        {/* Trend badge — glass pill */}
        <div className="flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50">
          {getTrendIcon(trend)}
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color }}>
            {trend === 'up' ? 'Up from yesterday' : trend === 'down' ? 'Down from yesterday' : 'Same as yesterday'}
          </span>
        </div>
      </div>

      {/* Breakdown — glass mini-pills */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={10} className="text-orange-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Streak</span>
          </div>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{streak} days</span>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={10} className="text-violet-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Done</span>
          </div>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{completionRate}%</span>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={10} className="text-cyan-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Focus</span>
          </div>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{focusHours}h</span>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Score</span>
          </div>
          <span className={`text-[13px] font-mono font-medium tabular-nums ${colorCss.replace('400', '300')}`}>
            {score}/100
          </span>
        </div>
      </div>
    </WidgetCardC>
  );
}
```

### `src/components/dashboard/ProductivityChartA_SIGNAL.tsx` (195 lines)
```tsx
// ============================================================
// RHEO Dashboard — Productivity Chart PROTOTYPE A: "SIGNAL"
// Spec-compliant rewrite: chart.js GROUPED BARS (productive
// vs distracting only), 7/14/30 period selector, custom
// legend chips, stat row. L1 composed.
// ============================================================

import { useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";
import { WidgetCardA, type WidgetCategory, CardEntrance } from "./WidgetCardA_SIGNAL";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CATEGORY: WidgetCategory = "analytics";

type Period = "7" | "14" | "30";

const PERIOD_OPTIONS: Record<Period, { label: string; days: number }> = {
  "7": { label: "7D", days: 7 },
  "14": { label: "14D", days: 14 },
  "30": { label: "30D", days: 30 },
};

interface DataPoint {
  date: string;
  productive: number;
  distracting: number;
}

const COLORS = {
  productive: "rgba(236,72,153,0.7)",
  distracting: "rgba(251,191,36,0.55)",
  grid: "rgba(63,63,70,0.4)",
  text: "#a1a1aa",
};

export function ProductivityChartA({
  data,
  className = "",
}: {
  data: DataPoint[];
  className?: string;
}) {
  const [period, setPeriod] = useState<Period>("7");

  const sliced = data.slice(0, PERIOD_OPTIONS[period].days);
  const labels = sliced.map((d) => d.date);
  const productive = sliced.map((d) => d.productive);
  const distracting = sliced.map((d) => d.distracting);

  const totalFocus = productive.reduce((a, b) => a + b, 0);
  const dailyAvg = totalFocus / Math.max(labels.length, 1);
  const bestDay = Math.max(...productive, 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Focus",
        data: productive,
        backgroundColor: COLORS.productive,
        borderColor: "transparent",
        borderWidth: 0,
        borderRadius: 2,
      },
      {
        label: "Distracted",
        data: distracting,
        backgroundColor: COLORS.distracting,
        borderColor: "transparent",
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "#18181b",
        titleColor: "#fafafa",
        bodyColor: "#a1a1aa",
        borderColor: "#3f3f46",
        borderWidth: 1,
        padding: 8,
        titleFont: { family: "JetBrains Mono", size: 11 },
        bodyFont: { family: "JetBrains Mono", size: 11 },
        displayColors: true,
        boxPadding: 4,
      },
      title: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: COLORS.text,
          font: { family: "JetBrains Mono", size: 10 },
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        grid: { color: COLORS.grid, drawBorder: false },
        ticks: {
          color: COLORS.text,
          font: { family: "JetBrains Mono", size: 10 },
          padding: 4,
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  return (
    <CardEntrance index={2}>
      <WidgetCardA category={CATEGORY} className="xl:col-span-2">
        {/* Kicker */}
        <div className="mb-4">
          <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-400">
            ANALYTICS
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[13px] font-semibold text-zinc-100 mb-4">Focus Distribution</h3>

        {/* Period selector — segmented control */}
        <div className="flex gap-1 mb-4">
          {(["7", "14", "30"] as Period[]).map((p) => (
            <button
              key={p}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors duration-150 ${
                period === p
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
            >
              {PERIOD_OPTIONS[p].label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-[160px] mb-4">
          <Bar data={chartData} options={options} />
        </div>

        {/* Custom legend — HTML chips, not chart.js default */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.productive }} />
            <span className="text-[11px] text-zinc-400">Focus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.distracting }} />
            <span className="text-[11px] text-zinc-400">Distracted</span>
          </div>
        </div>

        {/* Stat row — inner-well treatment */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
            <div className="text-[11px] font-medium text-zinc-500">Total Focus</div>
            <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {Math.round(totalFocus)}m
            </div>
          </div>
          <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
            <div className="text-[11px] font-medium text-zinc-500">Daily Avg</div>
            <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {Math.round(dailyAvg)}m
            </div>
          </div>
          <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
            <div className="text-[11px] font-medium text-zinc-500">Best Day</div>
            <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {Math.round(bestDay)}m
            </div>
          </div>
        </div>
      </WidgetCardA>
    </CardEntrance>
  );
}
```

### `src/components/dashboard/ProductivityChartB_TERMINAL.tsx` (250 lines)
```tsx
// ============================================================
// RHEO Dashboard — Productivity Chart PROTOTYPE B: "TERMINAL CHIC"
// Chart.js wire-frame style. Thin 2px bars, dot markers, no fill.
// Flat bg-zinc-900 panel. Mono labels. Terminal aesthetic.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, BarChart3 } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import type { WidgetCardProps } from './WidgetCardB_TERMINAL';
import { WidgetCardB } from './WidgetCardB_TERMINAL';

Chart.register(...registerables);

interface ProductivityDataPoint {
  day: string;
  productive: number;
  neutral: number;
  distracting: number;
}

interface ProductivityChartProps {
  data: ProductivityDataPoint[];
  loading?: boolean;
  className?: string;
}

const PERIOD_OPTIONS = ['day', 'week', 'month'] as const;
type Period = typeof PERIOD_OPTIONS[number];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatHours(h: number): string {
  const hInt = Math.floor(h);
  const m = Math.round((h - hInt) * 60);
  if (hInt > 0) return `${hInt}h ${m}m`;
  return `${m}m`;
}

export function ProductivityChartB({
  data,
  loading = false,
  className = '',
}: ProductivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [period, setPeriod] = useState<Period>('week');

  const totalProductive = data.reduce((s, d) => s + d.productive, 0);
  const totalNeutral = data.reduce((s, d) => s + d.neutral, 0);
  const totalDistracting = data.reduce((s, d) => s + d.distracting, 0);
  const totalAll = totalProductive + totalNeutral + totalDistracting;
  const bestDay = data.length > 0
    ? data.reduce((best, d) => (d.productive > (best?.productive ?? 0) ? d : best), data[0])
    : null;

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, [data]);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.day),
        datasets: [
          {
            label: 'Productive',
            data: data.map(d => d.productive),
            backgroundColor: 'rgba(236, 72, 153, 0.15)',
            borderColor: 'rgba(236, 72, 153, 0.9)',
            borderWidth: 2,
            borderRadius: 0,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(236, 72, 153, 0.9)',
            pointBorderColor: '#18181b',
            pointBorderWidth: 1,
            barPercentage: 0.6,
          },
          {
            label: 'Neutral',
            data: data.map(d => d.neutral),
            backgroundColor: 'rgba(113, 113, 122, 0.1)',
            borderColor: 'rgba(113, 113, 122, 0.7)',
            borderWidth: 2,
            borderRadius: 0,
            pointRadius: 3,
            pointBackgroundColor: 'rgba(113, 113, 122, 0.7)',
            pointBorderColor: '#18181b',
            pointBorderWidth: 1,
            barPercentage: 0.6,
          },
          {
            label: 'Distracting',
            data: data.map(d => d.distracting),
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            borderColor: 'rgba(244, 63, 94, 0.8)',
            borderWidth: 2,
            borderRadius: 0,
            pointRadius: 3,
            pointBackgroundColor: 'rgba(244, 63, 94, 0.8)',
            pointBorderColor: '#18181b',
            pointBorderWidth: 1,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600,
          easing: 'easeOutQuad',
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#52525b',
              font: { size: 10, family: 'JetBrains Mono, monospace' },
            },
          },
          y: {
            beginAtZero: true,
            max: 8,
            grid: {
              color: 'rgba(59, 59, 66, 0.3)',
              drawBorder: false,
              lineWidth: 1,
            },
            ticks: {
              color: '#52525b',
              font: { size: 10, family: 'JetBrains Mono, monospace' },
              callback: (v) => `${v}h`,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleColor: '#71717a',
            bodyColor: '#a1a1aa',
            borderColor: '#3f3f46',
            borderWidth: 1,
            padding: 6,
            titleFont: { size: 10, family: 'JetBrains Mono, monospace' },
            bodyFont: { size: 11, family: 'JetBrains Mono, monospace' },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatHours(ctx.parsed.y)}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data]);

  return (
    <WidgetCardB
      widgetId="productivity-chart"
      title="Productivity"
      icon={BarChart3}
      accent="#22d3ee"
      className={className}
      loading={loading}
      empty={!data.length}
      emptyMessage="No data for this period"
      emptyIcon={<BarChart3 size={16} />}
    >
      {/* Controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                period === p
                  ? 'bg-zinc-800 text-zinc-200 border border-zinc-600'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-36 w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-3 w-40 rounded bg-zinc-800 animate-pulse" />
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>

      {/* Legend — dot + mono label, no pills */}
      <div className="flex items-center gap-3 mt-1 mb-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(236, 72, 153, 0.8)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">productive</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalProductive)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(113, 113, 122, 0.6)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">neutral</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalNeutral)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(244, 63, 94, 0.8)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">distracting</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalDistracting)}</span>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Total</span>
          <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{formatHours(totalAll)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Best</span>
          <span className="text-[13px] font-mono text-emerald-400/70 tabular-nums">
            {bestDay ? `${bestDay.day} ${formatHours(bestDay.productive)}` : '—'}
          </span>
        </div>
      </div>
    </WidgetCardB>
  );
}
```

### `src/components/dashboard/ProductivityChartC_NEON.tsx` (237 lines)
```tsx
// ============================================================
// RHEO Dashboard — Productivity Chart PROTOTYPE C: "NEON GLASS"
// Chart.js neon bars with glow. Glass panel with cyan edge.
// Rounded bars with subtle category-colored shadow glow.
// Glass legend pills + glass period selector.
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, BarChart3 } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import type { WidgetCardProps } from './WidgetCardC_NEON';
import { WidgetCardC } from './WidgetCardC_NEON';

Chart.register(...registerables);

interface ProductivityDataPoint {
  day: string;
  productive: number;
  neutral: number;
  distracting: number;
}

interface ProductivityChartProps {
  data: ProductivityDataPoint[];
  loading?: boolean;
  className?: string;
}

const PERIOD_OPTIONS = ['day', 'week', 'month'] as const;
type Period = typeof PERIOD_OPTIONS[number];

function formatHours(h: number): string {
  const hInt = Math.floor(h);
  const m = Math.round((h - hInt) * 60);
  if (hInt > 0) return `${hInt}h ${m}m`;
  return `${m}m`;
}

export function ProductivityChartC({
  data,
  loading = false,
  className = '',
}: ProductivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [period, setPeriod] = useState<Period>('week');

  const totalProductive = data.reduce((s, d) => s + d.productive, 0);
  const totalNeutral = data.reduce((s, d) => s + d.neutral, 0);
  const totalDistracting = data.reduce((s, d) => s + d.distracting, 0);
  const totalAll = totalProductive + totalNeutral + totalDistracting;
  const bestDay = data.length > 0
    ? data.reduce((best, d) => (d.productive > (best?.productive ?? 0) ? d : best), data[0])
    : null;

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  }, [data]);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.day),
        datasets: [
          {
            label: 'Productive',
            data: data.map(d => d.productive),
            backgroundColor: 'rgba(236, 72, 153, 0.55)',
            borderColor: 'rgba(236, 72, 153, 0.9)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
          {
            label: 'Neutral',
            data: data.map(d => d.neutral),
            backgroundColor: 'rgba(113, 113, 122, 0.35)',
            borderColor: 'rgba(113, 113, 122, 0.6)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
          {
            label: 'Distracting',
            data: data.map(d => d.distracting),
            backgroundColor: 'rgba(244, 63, 94, 0.55)',
            borderColor: 'rgba(244, 63, 94, 0.9)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 700,
          easing: 'easeOutQuad',
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#71717a',
              font: { size: 10, family: 'JetBrains Mono, monospace' },
            },
          },
          y: {
            beginAtZero: true,
            max: 8,
            grid: {
              color: 'rgba(59, 59, 66, 0.15)',
              drawBorder: false,
            },
            ticks: {
              color: '#52525b',
              font: { size: 10, family: 'JetBrains Mono, monospace' },
              callback: (v) => `${v}h`,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            titleColor: '#fafafa',
            bodyColor: '#a1a1aa',
            borderColor: 'rgba(59, 59, 66, 0.5)',
            borderWidth: 1,
            padding: 8,
            titleFont: { size: 11, family: 'JetBrains Mono, monospace' },
            bodyFont: { size: 12, family: 'JetBrains Mono, monospace' },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatHours(ctx.parsed.y)}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data]);

  return (
    <WidgetCardC
      widgetId="productivity-chart"
      title="Productivity"
      icon={BarChart3}
      neonColor="#22d3ee"
      kicker={`THIS ${period.toUpperCase()}`}
      className={className}
      loading={loading}
      empty={!data.length}
      emptyMessage="No data for this period"
      emptyIcon={<BarChart3 size={24} />}
    >
      {/* Controls — glass dropdown */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase transition-all duration-200 ${
                period === p
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:shadow-[0_0_12px_-4px_rgba(34,211,238,0.15)]'
                  : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area — glass bordered */}
      <div className="h-40 w-full rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-2">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-4 w-48 rounded bg-zinc-800/50 animate-pulse" />
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>

      {/* Legend — glass pills with subtle glow */}
      <div className="flex items-center gap-3 mt-2 mb-3">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(236, 72, 153, 0.8)', boxShadow: '0 0 6px -2px rgba(236,72,153,0.4)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">Productive</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalProductive)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(113, 113, 122, 0.6)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">Neutral</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalNeutral)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'rgba(244, 63, 94, 0.8)', boxShadow: '0 0 6px -2px rgba(244,63,94,0.4)' }} />
          <span className="text-[10px] font-mono uppercase text-zinc-500">Distracting</span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{formatHours(totalDistracting)}</span>
        </div>
      </div>

      {/* Bottom stats — glass pills */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-2">
        <div className="flex flex-col px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Total</span>
          <span className="text-[13px] font-mono font-medium text-zinc-200 tabular-nums">{formatHours(totalAll)}</span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
          <span className="text-[10px] font-mono uppercase text-zinc-600">Best day</span>
          <span className="text-[13px] font-mono font-medium text-emerald-400 tabular-nums">
            {bestDay ? `${bestDay.day} — ${formatHours(bestDay.productive)}` : '—'}
          </span>
        </div>
      </div>
    </WidgetCardC>
  );
}
```

### `src/components/dashboard/prototypeA.ts` (13 lines)
```ts
// ============================================================
// RHEO Dashboard — PROTOTYPE A: "SIGNAL" — Barrel Export
// Spec-compliant: 20-segment bar score, grouped bars chart,
// flat category-bar card shell. L1 composed.
// ============================================================

export { WidgetCardA, SignalBar, type WidgetCategory, CATEGORY_ACCENT, CardEntrance } from './WidgetCardA_SIGNAL';
export type { WidgetCardProps } from './WidgetCardA_SIGNAL';

export { StopwatchPanelA } from './StopwatchPanelA_SIGNAL';
export { TrackingScorePanelA } from './TrackingScorePanelA_SIGNAL';
export { ProductivityChartA } from './ProductivityChartA_SIGNAL';
```

### `src/components/dashboard/prototypeB.ts` (14 lines)
```ts
// ============================================================
// RHEO Dashboard — PROTOTYPE B: "TERMINAL CHIC" — Barrel Export
// Single import point for all PROTOTYPE B components.
// Import this file to use TERMINAL CHIC styling across the dashboard.
// Does NOT touch any existing dashboard files.
// ============================================================

export { WidgetCardB } from './WidgetCardB_TERMINAL';
export type { WidgetCardProps as WidgetCardBProps } from './WidgetCardB_TERMINAL';

export { StopwatchPanelB } from './StopwatchPanelB_TERMINAL';
export { TrackingScorePanelB } from './TrackingScorePanelB_TERMINAL';
export { ProductivityChartB } from './ProductivityChartB_TERMINAL';
```

### `src/components/dashboard/prototypeC.ts` (14 lines)
```ts
// ============================================================
// RHEO Dashboard — PROTOTYPE C: "NEON GLASS" — Barrel Export
// Single import point for all PROTOTYPE C components.
// Import this file to use NEON GLASS styling across the dashboard.
// Does NOT touch any existing dashboard files.
// ============================================================

export { WidgetCardC } from './WidgetCardC_NEON';
export type { WidgetCardProps as WidgetCardCProps } from './WidgetCardC_NEON';

export { StopwatchPanelC } from './StopwatchPanelC_NEON';
export { TrackingScorePanelC } from './TrackingScorePanelC_NEON';
export { ProductivityChartC } from './ProductivityChartC_NEON';
```

---

## 20. REFERENCE + PRIMITIVE SOURCE

These are the files you **diff against** rather than rewrite. `DeskFlowCard` is the
quality bar. `blur-fade` and `card` are primitives the prototypes import — restyle the
prototypes around them, do not fork them.

### `src/components/dashboard/DeskFlowCard.tsx` (144 lines) — REFERENCE — the already-polished card. Every restyle must be at least this good.
```tsx
import * as React from "react";
"use client"

import { motion, type HTMLMotionProps } from "motion/react"
import { cn } from "@/lib/utils"
import { Pin } from "lucide-react"
import { WidgetJumpButton } from "./WidgetJumpButton"
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

const accentColors = {
  pink:   { rail: "bg-pink-500/60",   border: "border-l-pink-500/20 hover:border-l-pink-500/30",   bg: "bg-pink-500/[0.02]",  edge: "border-pink-500/30", railLight: "bg-pink-500/40", borderLight: "border-l-pink-400/30", bgLight: "bg-pink-500/[0.04]" },
  amber:  { rail: "bg-amber-500/60",  border: "border-l-amber-500/20 hover:border-l-amber-500/30", bg: "bg-amber-500/[0.02]", edge: "border-amber-500/30", railLight: "bg-amber-500/40", borderLight: "border-l-amber-400/30", bgLight: "bg-amber-500/[0.04]" },
  emerald:{ rail: "bg-emerald-500/60",border: "border-l-emerald-500/20 hover:border-l-emerald-500/30", bg: "bg-emerald-500/[0.02]", edge: "border-emerald-500/30", railLight: "bg-emerald-500/40", borderLight: "border-l-emerald-400/30", bgLight: "bg-emerald-500/[0.04]" },
  none:   null,
}

const hoverLift = {
  whileHover: { y: -2, scale: 1.005, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
}

const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 20px rgba(244, 63, 94, 0.12), 0 0 60px rgba(244, 63, 94, 0.06)",
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
}

interface DeskFlowCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  variant?: 'default' | 'elevated' | 'subtle' | 'accent'
  accent?: 'pink' | 'amber' | 'emerald' | 'none'
  title?: string
  description?: string
  headerAction?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  noMotion?: boolean
}

export function DeskFlowCard({
  variant = 'default',
  accent = 'none',
  title,
  description,
  headerAction,
  footer,
  children,
  className,
  noMotion = false,
  ...props
}: DeskFlowCardProps) {
  const ac = accent !== 'none' ? accentColors[accent] : null
  const Comp = noMotion ? 'div' : motion.div as any

  return (
    <Comp
      data-slot="deskflow-card"
      className={cn(
        "relative overflow-hidden rounded-xl transition-colors duration-200",
        hoverGlow.whileHover,
        className,
      )}
      {...(noMotion ? {} : hoverLift)}
      {...props}
    >
      {ac && (
        <>
          <div className={`absolute top-0 left-0 bottom-0 w-0.5 ${ac.rail} ${ac.railLight}`} />
          <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${ac.bg} ${ac.bgLight}`} />
        </>
      )}
      <div className="relative z-0 flex flex-col min-h-0 flex-1">
        {(title || description || headerAction) && (
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {title && <CardTitle>{title}</CardTitle>}
                {description && <CardDescription>{description}</CardDescription>}
              </div>
              {headerAction && <CardAction>{headerAction}</CardAction>}
            </div>
          </CardHeader>
        )}
        <CardContent className="px-4 pt-2 flex-1 min-h-0">
          {children}
        </CardContent>
        {footer && (
          <CardFooter className="px-4 pt-0 pb-4">{footer}</CardFooter>
        )}
      </div>
    </Comp>
  )
}

export function DeskFlowCardMotion({
  className,
  children,
  zIndex,
  onClick,
  pinned,
  jumpWidgetId,
  ...props
}: { className?: string; children: React.ReactNode; zIndex?: number; onClick?: () => void; pinned?: boolean; jumpWidgetId?: string }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ zIndex, position: 'relative' }}
      className={cn(
        "rounded-xl bg-zinc-900/80 overflow-hidden transition-colors duration-200 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)] flex-1 min-h-0 cursor-pointer",
        pinned ? "ring-1 ring-amber-500/30" : "",
        className,
      )}
      {...props}
    >
      {pinned && (
        <div className="absolute top-2 left-2 z-50 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono pointer-events-none">
          <Pin size={10} /> PINNED
        </div>
      )}
      {/* Jump-to-source button: the ONLY control in this card that navigates away
          from the dashboard. Always visible (never hover-only), top-right, and
          self-stop-propagating so the card's bringToFront click never fires. */}
      {jumpWidgetId && (
        <div className="absolute top-2 right-2 z-50">
          <WidgetJumpButton widgetId={jumpWidgetId} iconOnly />
        </div>
      )}
      {children}
    </motion.div>
  );
}
```

### `src/components/dashboard/PrototypePreview.tsx` (349 lines) — REFERENCE — the /prototype-preview page that renders all 3 directions. Do not change its layout.
```tsx
// ============================================================
// RHEO Dashboard — Prototype Preview Page
// Standalone page that renders all 3 prototype designs side-by-side
// with mock data. No changes to existing dashboard files.
// Access at: /prototype-preview
// ============================================================

import { useState } from 'react';
import { Target, Zap, BarChart3, Flame, TrendingUp } from 'lucide-react';
import { WidgetCardA, StopwatchPanelA, TrackingScorePanelA, ProductivityChartA } from './prototypeA';
import { WidgetCardB, StopwatchPanelB, TrackingScorePanelB, ProductivityChartB } from './prototypeB';
import { WidgetCardC, StopwatchPanelC, TrackingScorePanelC, ProductivityChartC } from './prototypeC';
import type { WidgetCategory } from './WidgetCardA_SIGNAL';

// ── Mock data ──
const MOCK_GOALS = [];
const MOCK_DEADLINES = [];
const MOCK_SCHEDULE = [];

const MOCK_PRODUCTIVE_MS = 5432000; // 1h 30m 32s
const MOCK_DISTRACTING_MS = 720000;  // 12m
const MOCK_IS_PAUSED = false;
const MOCK_LAST_TIER: 'productive' | 'neutral' | 'distracting' = 'productive';
const MOCK_STREAK = 7;
const MOCK_SCORE = 72;

const MOCK_MOMENTUM = {
  score: 72,
  streak: 7,
  completionRate: 72,
  focusHours: 2.3,
  trend: 'up' as const,
};

const MOCK_CHART_DATA = [
  { day: 'Mon', productive: 2.5, neutral: 1.0, distracting: 0.5 },
  { day: 'Tue', productive: 3.0, neutral: 0.5, distracting: 1.0 },
  { day: 'Wed', productive: 4.2, neutral: 1.5, distracting: 0.3 },
  { day: 'Thu', productive: 2.0, neutral: 2.0, distracting: 1.5 },
  { day: 'Fri', productive: 3.5, neutral: 1.0, distracting: 0.8 },
  { day: 'Sat', productive: 1.5, neutral: 3.0, distracting: 2.0 },
  { day: 'Sun', productive: 0.8, neutral: 2.5, distracting: 1.2 },
];

// ── Preview card wrapper ──
function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 flex items-center gap-2">
        <div className="h-px flex-1 bg-zinc-800" />
        {title}
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ── Main preview page ──
export function PrototypePreview() {
  const [activeTab, setActiveTab] = useState<'all' | 'A' | 'B' | 'C'>('all');

  const showAll = activeTab === 'all';
  const showA = activeTab === 'all' || activeTab === 'A';
  const showB = activeTab === 'all' || activeTab === 'B';
  const showC = activeTab === 'all' || activeTab === 'C';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100" style={{ fontFamily: "var(--dk-sans, 'Geist', sans-serif)" }}>
          Dashboard Prototype Preview
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          3 design directions — pick one to implement. Mock data only.
        </p>
      </div>

      {/* Tab filter */}
      <div className="flex items-center gap-2 mb-6">
        {(['all', 'A', 'B', 'C'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-mono uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {tab === 'all' ? 'ALL' : `P${tab}`}
          </button>
        ))}
      </div>

      {/* ── PROTOTYPE A: SIGNAL ── */}
      {showA && (
        <div className="mb-8">
          <div className="text-lg font-semibold text-zinc-100 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-pink-500" />
            PROTOTYPE A — SIGNAL
          </div>
          <p className="text-zinc-500 text-sm mb-4">
            Solid signal panels. Each widget has a distinct top-edge accent bar. Clean, purposeful.
          </p>

          <PreviewSection title="STOPWATCH">
            <div className="w-[320px]">
              <StopwatchPanelA
                productiveMs={MOCK_PRODUCTIVE_MS}
                distractingMs={MOCK_DISTRACTING_MS}
                isPaused={MOCK_IS_PAUSED}
                lastTier={MOCK_LAST_TIER}
                onPauseToggle={() => {}}
                onStop={() => {}}
                onReset={() => {}}
                streak={MOCK_STREAK}
                score={MOCK_SCORE}
              />
            </div>
          </PreviewSection>

          <PreviewSection title="TRACKING SCORE">
            <div className="w-[280px]">
              <TrackingScorePanelA data={MOCK_MOMENTUM} />
            </div>
          </PreviewSection>

          <PreviewSection title="PRODUCTIVITY CHART">
            <div className="w-full max-w-[560px]">
              <ProductivityChartA data={MOCK_CHART_DATA} />
            </div>
          </PreviewSection>

          <PreviewSection title="WIDGET SHELL EXAMPLES">
            <div className="w-[240px]">
<WidgetCardA category="productivity">
                  <div className="text-zinc-400 text-sm flex flex-col gap-1">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30">
                      <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                      <span className="text-zinc-300 text-xs">Complete 3 goals today</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30">
                      <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                      <span className="text-zinc-300 text-xs">Write 500 words</span>
                    </div>
                  </div>
                </WidgetCardA>
            </div>
            <div className="w-[240px]">
              <WidgetCardA category="productivity">
                <div className="text-center py-2">
                  <div className="text-3xl font-mono font-bold text-orange-400">{MOCK_STREAK}</div>
                  <div className="text-zinc-500 text-xs mt-1">day streak</div>
                </div>
              </WidgetCardA>
            </div>
            <div className="w-[240px]">
<WidgetCardA category="productivity">
                  <div className="text-zinc-400 text-sm">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 mb-1">
                      <span className="text-xs text-zinc-300">Project submission</span>
                      <span className="text-xs font-mono text-rose-400">2d left</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30">
                      <span className="text-xs text-zinc-300">Review draft</span>
                      <span className="text-xs font-mono text-amber-400">5d left</span>
                    </div>
                  </div>
                </WidgetCardA>
            </div>
          </PreviewSection>
        </div>
      )}

      {/* ── PROTOTYPE B: TERMINAL CHIC ── */}
      {showB && (
        <div className="mb-8">
          <div className="text-lg font-semibold text-zinc-100 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            PROTOTYPE B — TERMINAL CHIC
          </div>
          <p className="text-zinc-500 text-sm mb-4">
            Flat gunmetal panels. All mono. Dense, technical, snappy.
          </p>

          <PreviewSection title="STOPWATCH">
            <div className="w-[320px]">
              <StopwatchPanelB
                productiveMs={MOCK_PRODUCTIVE_MS}
                distractingMs={MOCK_DISTRACTING_MS}
                isPaused={MOCK_IS_PAUSED}
                lastTier={MOCK_LAST_TIER}
                onPauseToggle={() => {}}
                onStop={() => {}}
                onReset={() => {}}
                streak={MOCK_STREAK}
                score={MOCK_SCORE}
              />
            </div>
          </PreviewSection>

          <PreviewSection title="TRACKING SCORE">
            <div className="w-[280px]">
              <TrackingScorePanelB data={MOCK_MOMENTUM} />
            </div>
          </PreviewSection>

          <PreviewSection title="PRODUCTIVITY CHART">
            <div className="w-full max-w-[560px]">
              <ProductivityChartB data={MOCK_CHART_DATA} />
            </div>
          </PreviewSection>

          <PreviewSection title="WIDGET SHELL EXAMPLES">
            <div className="w-[240px]">
              <WidgetCardB widgetId="test-goals-b" title="Goals" icon={Target} accent="#8b5cf6">
                <div className="text-zinc-400 text-sm font-mono flex flex-col gap-1">
                  <div className="flex items-center gap-2 py-1 border-b border-zinc-800/30">
                    <div className="w-3 h-3 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Complete 3 goals today</span>
                  </div>
                  <div className="flex items-center gap-2 py-1 border-b border-zinc-800/30">
                    <div className="w-3 h-3 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Write 500 words</span>
                  </div>
                </div>
              </WidgetCardB>
            </div>
            <div className="w-[240px]">
              <WidgetCardB widgetId="test-streak-b" title="Streak" icon={Flame} accent="#f97316">
                <div className="text-center py-2">
                  <div className="text-3xl font-mono font-bold text-orange-400">{MOCK_STREAK}</div>
                  <div className="text-zinc-600 text-xs mt-1 uppercase tracking-wider">DAYS</div>
                </div>
              </WidgetCardB>
            </div>
            <div className="w-[240px]">
              <WidgetCardB widgetId="test-deadlines-b" title="Deadlines" icon={Target} accent="#f43f5e">
                <div className="text-zinc-400 text-sm font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/30">
                    <span className="text-xs text-zinc-300">Project submission</span>
                    <span className="text-xs font-mono text-rose-400">2d</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/30">
                    <span className="text-xs text-zinc-300">Review draft</span>
                    <span className="text-xs font-mono text-amber-400">5d</span>
                  </div>
                </div>
              </WidgetCardB>
            </div>
          </PreviewSection>
        </div>
      )}

      {/* ── PROTOTYPE C: NEON GLASS ── */}
      {showC && (
        <div className="mb-8">
          <div className="text-lg font-semibold text-zinc-100 mb-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400" />
            PROTOTYPE C — NEON GLASS
          </div>
          <p className="text-zinc-500 text-sm mb-4">
            Dark glass panels with neon edge accents. Premium, polished, alive.
          </p>

          <PreviewSection title="STOPWATCH">
            <div className="w-[320px]">
              <StopwatchPanelC
                productiveMs={MOCK_PRODUCTIVE_MS}
                distractingMs={MOCK_DISTRACTING_MS}
                isPaused={MOCK_IS_PAUSED}
                lastTier={MOCK_LAST_TIER}
                onPauseToggle={() => {}}
                onStop={() => {}}
                onReset={() => {}}
                streak={MOCK_STREAK}
                score={MOCK_SCORE}
              />
            </div>
          </PreviewSection>

          <PreviewSection title="TRACKING SCORE">
            <div className="w-[280px]">
              <TrackingScorePanelC data={MOCK_MOMENTUM} />
            </div>
          </PreviewSection>

          <PreviewSection title="PRODUCTIVITY CHART">
            <div className="w-full max-w-[560px]">
              <ProductivityChartC data={MOCK_CHART_DATA} />
            </div>
          </PreviewSection>

          <PreviewSection title="WIDGET SHELL EXAMPLES">
            <div className="w-[240px]">
              <WidgetCardC widgetId="test-goals-c" title="Goals" icon={Target} neonColor="#8b5cf6" kicker="TODAY">
                <div className="text-zinc-400 text-sm flex flex-col gap-1">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
                    <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Complete 3 goals today</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
                    <div className="w-4 h-4 rounded border-2 border-violet-400/50" />
                    <span className="text-zinc-300 text-xs">Write 500 words</span>
                  </div>
                </div>
              </WidgetCardC>
            </div>
            <div className="w-[240px]">
              <WidgetCardC widgetId="test-streak-c" title="Streak" icon={Flame} neonColor="#f97316" kicker="CURRENT">
                <div className="text-center py-2">
                  <div className="text-3xl font-mono font-bold text-orange-400">{MOCK_STREAK}</div>
                  <div className="text-zinc-500 text-xs mt-1">day streak</div>
                </div>
              </WidgetCardC>
            </div>
            <div className="w-[240px]">
              <WidgetCardC widgetId="test-deadlines-c" title="Deadlines" icon={Target} neonColor="#f43f5e" kicker="UPCOMING">
                <div className="text-zinc-400 text-sm">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 mb-1">
                    <span className="text-xs text-zinc-300">Project submission</span>
                    <span className="text-xs font-mono text-rose-400">2d left</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30">
                    <span className="text-xs text-zinc-300">Review draft</span>
                    <span className="text-xs font-mono text-amber-400">5d left</span>
                  </div>
                </div>
              </WidgetCardC>
            </div>
          </PreviewSection>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-zinc-800/50">
        <p className="text-zinc-600 text-xs font-mono">
          Preview page — mock data. Not connected to live state.
          Component sources: prototypeA.ts, prototypeB.ts, prototypeC.ts
        </p>
      </div>
    </div>
  );
}

export default PrototypePreview;
```

### `src/components/ui/blur-fade.tsx` (106 lines) — PRIMITIVE — the entrance animation wrapper. Keep it; tune delay/duration only.
```tsx
"use client"

import { useRef } from "react"
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  type MotionProps,
  type UseInViewOptions,
  type Variants,
} from "framer-motion"

type MarginType = UseInViewOptions["margin"]

interface BlurFadeProps extends MotionProps {
  children: React.ReactNode
  className?: string
  variant?: {
    hidden: { y: number; opacity?: number }
    visible: { y: number; opacity?: number }
  }
  duration?: number
  delay?: number
  offset?: number
  direction?: "up" | "down" | "left" | "right"
  inView?: boolean
  inViewMargin?: MarginType
  blur?: string
}

const getFilter = (v: Variants[string]) =>
  typeof v === "function" ? undefined : v.filter

export function BlurFade({
  children,
  className,
  variant,
  duration = 0.15,
  delay = 0,
  offset = 8,
  direction = "up",
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
  ...props
}: BlurFadeProps) {
  const ref = useRef(null)
  const shouldReduceMotion = useReducedMotion()
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin })
  const isInView = !inView || inViewResult

  const defaultVariants: Variants = {
    hidden: {
      [direction === "left" || direction === "right" ? "x" : "y"]:
        direction === "right" || direction === "down" ? -offset : offset,
      opacity: 0,
      filter: `blur(${blur})`,
    },
    visible: {
      [direction === "left" || direction === "right" ? "x" : "y"]: 0,
      opacity: 1,
      filter: `blur(0px)`,
    },
  }

  const combinedVariants = variant ?? defaultVariants
  const hiddenFilter = getFilter(combinedVariants.hidden)
  const visibleFilter = getFilter(combinedVariants.visible)

  const shouldTransitionFilter =
    hiddenFilter != null &&
    visibleFilter != null &&
    hiddenFilter !== visibleFilter

  if (shouldReduceMotion) {
    return (
      <div className={className} ref={ref}>
        {children}
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: 0.02 + delay,
          duration: Math.min(duration, 0.2),
          ease: [0.16, 1, 0.3, 1],
          ...(shouldTransitionFilter ? { filter: { duration: Math.min(duration, 0.2) } } : {}),
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### `src/components/ui/card.tsx` (92 lines) — PRIMITIVE — shadcn Card, already re-skinned. Do not regress it.
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-4 rounded-[10px] bg-[var(--bg-elevated)] py-4 text-card-foreground border-t border-[var(--ws-border)]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-[13px] leading-none font-semibold text-[var(--text-primary)]", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[12px] text-[var(--text-muted)]", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 pt-3 flex-1", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-4 pt-0 pb-4", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
```
