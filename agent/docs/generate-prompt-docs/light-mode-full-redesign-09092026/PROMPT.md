# Light Mode Full Redesign — Design Prompt

**Target AI:** Claude (or any capable design AI)
**Task:** Design a comprehensive light mode UI system for every element, card, page, subpage — per-element customization, not a global toggle.

---

## Raw Request

> "FULL light-mode redesign of every UI element, section card, page, subpage — per-element/per-card/per-page/per-subpage customization (fonts, colors, everything) for a 'tailored made for the light mode' look, NOT just a global theme toggle."

And:

> "every fucking card on every fucking page needs to look tailored for light mode — not just a dark card with white background slapped on"

And:

> "START FROM THE DASHBOARD. Make it look incredible in light mode."

---

## Context

This is a React + Electron productivity app (RHEO / DeskFlow) with ~35 pages and 30+ shared components. It currently has **NO light mode design**. The app is dark-mode-only by default.

**What exists:**
- `src/index.css` — Contains the `@theme` CSS block with design tokens. Currently **only dark mode values**. No light mode variables exist.
- `src/lib/theme.ts` — Theme engine that toggles `.light` / `.dark` class on `<html>` via `document.documentElement.classList`. Supports `light | dark | system` modes. Stores preference in `localStorage['df-theme']`. Dispatches `df-theme-change` custom event.
- `src/components/ThemeToggle.tsx` — Working toggle that cycles dark → light → system. Already has some `light:` Tailwind variants.
- `src/components/GlassCard.tsx` — Card component with variants (default, compact, subtle, notebook, bordered, elevated, interactive) and accent colors (pink, amber, emerald). Has partial `light:` variants.
- `src/components/EmptyState.tsx` — Empty state with icon, title, description, action button. Partial light mode.
- `src/components/LoadingState.tsx` — Spinner + skeleton variants. Partial light mode.
- `src/components/SectionHeader.tsx` — Section title with optional icon and action. Partial light mode.
- `src/components/PageShell.tsx` — Page wrapper with `data-page` attribute for page-specific accents.
- `src/components/ErrorBoundary.tsx` — Full dark-only error screen. No light mode at all.
- `src/pages/DashboardPage.tsx` — 2922 lines. Primary target. Contains HeroBand, SummaryStrip, PinnedActivities, ScheduleCard, StatusBand, GoalsCard, DeadlinesCard, LongestFocusCard, WidgetGrid, InsightStrip, MomentumHero, TierBreakdownStrip.
- `src/pages/dashboard/` — Dashboard sub-components.
- `src/components/dashboard/` — Reusable dashboard widgets (WidgetGrid, GoalsCard, DeadlinesCard, LongestFocusCard, MomentumHero).

**What the design tokens look like (dark mode only):**

```css
@theme {
  --ws-surface: #09090b;
  --ws-surface-raised: #18181b;
  --ws-border: rgb(39 39 42 / 0.6);
  --ws-border-strong: rgb(63 63 70 / 0.6);
  --ws-accent: #06b6d4;
  --font-serif: "Source Serif 4", Georgia, serif;
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
  --font-display: "Space Grotesk", ...;
  --resume-success: #22c55e;
  --resume-warning: #f59e0b;
  --resume-danger: #ef4444;
  --resume-info: #3b82f6;
}
```

Components reference these via `var(--color-card)`, `var(--text-primary)`, `var(--accent-primary)`, etc.

**Current light mode state:** Some components have `light:` Tailwind variants added (e.g., `light:bg-white/80`, `light:text-zinc-900`) but there is **no comprehensive light mode design**. The `@theme` block in `index.css` has **zero light mode CSS variable definitions**.

---

## The Mandate

Design a **complete, tailored light mode** for this application. This is NOT "invert the dark mode" — it is a completely separate design direction optimized for light backgrounds.

### Phase 1: CSS Design Token System (src/index.css)

Design the **full light mode CSS variable set** to add to the existing `@theme` block. This must include:

1. **Surface colors** — `--ws-surface`, `--ws-surface-raised` for light mode (not just white — think soft off-white, light gray elevations)
2. **Border colors** — `--ws-border`, `--ws-border-strong` for light mode (subtle, not harsh)
3. **Accent color** — `--ws-accent` for light mode (may differ from dark mode accent)
4. **All `--color-*` variables** — every color token needs a light mode value
5. **Font tokens** — may stay the same, but specify any light-mode adjustments
6. **Resume-specific tokens** — `--resume-*` colors for light mode

The light mode design should feel:
- Clean and airy, not sterile
- Professional but warm
- High readability with proper contrast ratios
- Not just "dark mode inverted"

### Phase 2: DashboardPage Redesign (src/pages/DashboardPage.tsx)

Design the **complete light mode redesign** of DashboardPage and all its sub-components. This is the FIRST priority.

For EACH component, specify:
1. **Exact background colors** — light mode card backgrounds (not just `bg-white` — think layered surfaces)
2. **Exact border colors and styles** — light mode borders (subtle, maybe colored accents)
3. **Exact text colors** — primary, secondary, muted, disabled for light mode
4. **Exact accent treatments** — how page-accent (`--page-accent`) shows in light mode
5. **Spacing adjustments** — does light mode need different padding/margins?
6. **Shadow/elevation** — light mode relies more on shadows than dark mode does
7. **Glass effects** — how `bg-glass` (`backdrop-blur` cards) work in light mode
8. **Interactive states** — hover, active, focus for light mode

**Components to redesign:**

1. **DashboardPage root** — page background, overall layout spacing
2. **HeroBand** — hero section styling
3. **SummaryStrip** — metrics strip
4. **PinnedActivities** — pinned activity cards
5. **ScheduleCard** — schedule display
6. **StatusBand** — status indicator
7. **GoalsCard** (673 lines) — goals list with add/edit/toggle/delete, categories, periods
8. **DeadlinesCard** (842 lines) — deadlines + reminders with priority colors, datetime inputs
9. **LongestFocusCard** (196 lines) — focus session rankings with number ticker
10. **WidgetGrid** (322 lines) — dynamic widget layout with drag-and-drop, edit mode, column/row config
11. **InsightStrip** — AI insights strip
12. **MomentumHero** (193 lines) — momentum score with radial gradient, number ticker, progress bars, streak flame
13. **TierBreakdownStrip** — productivity tier breakdown

### Phase 3: Shared Components Light Mode

Design light mode for each shared component:

1. **GlassCard** — all 7 variants (default, compact, subtle, notebook, bordered, elevated, interactive) × 3 accent colors (pink, amber, emerald). Each variant needs light mode treatment.

2. **EmptyState** — icon container, title, description, action button — all in light mode.

3. **LoadingState** — spinner (with accent color border) and skeleton rows in light mode.

4. **SectionHeader** — icon container, title, action area in light mode.

5. **PageShell** — page enter animation, background in light mode.

6. **ErrorBoundary** — COMPLETELY redesign for light mode. Currently `bg-[#0a0a0a]`, `bg-zinc-900`, `bg-zinc-800` buttons, `text-zinc-500/400/300` text. Needs full light mode equivalent.

7. **ThemeToggle** — already partially done, refine for light mode.

### Phase 4: Per-Element Customization Principles

Define the **design system rules** for light mode across the entire app:

1. **Card elevation system** — how many surface levels exist in light mode? (e.g., page bg → card bg → elevated card bg)
2. **Border hierarchy** — when to use borders vs shadows vs both in light mode
3. **Typography scale** — any light-mode-specific font size/weight adjustments?
4. **Accent usage** — how accented elements (buttons, icons, highlights) look in light mode
5. **Interactive states** — hover, active, focus, disabled in light mode
6. **Glass/morphism in light mode** — how translucent blurred surfaces work on light backgrounds
7. **Dark accents on light** — when to use dark text/icons vs colored ones

### Phase 5: Implementation Spec

For each change, provide:

1. **CSS variables to add** — exact `@theme` block additions for light mode
2. **Component changes** — exact class name changes needed (e.g., `bg-zinc-900/60` → `bg-white/80 light:bg-white/80`)
3. **Which components need new `light:` variants** and what they should be
4. **Any new utility classes needed**
5. **Design rationale** — why each choice was made

---

## Constraints

1. **Do NOT break dark mode** — dark mode must continue working exactly as it does now. Light mode is additive.
2. **Use CSS custom properties** (`var(--name)`) as the primary mechanism — components already reference these.
3. **Tailwind `light:` variant** is the secondary mechanism — for inline adjustments that don't belong in CSS variables.
4. **`data-page` attribute** on page root divs controls per-page accent colors — respect this system.
5. **Font family tokens** (`--font-serif`, `--font-sans`, `--font-mono`, `--font-display`, `--font-caslon`) should generally stay the same across modes.
6. **Existing color tokens** (`--color-clay-*`, `--color-sage-400`, `--color-amber-400`, `--color-sky-400`, `--color-glow`) — may need light mode values.
7. **Resume-specific tokens** (`--resume-*`) — need light mode values.
8. **The app uses `color-mix(in srgb, ...)` in several places** — these should work in both modes.

---

## Design Quality Bar

The light mode must feel like it was **designed for light backgrounds from the start**, not like a dark mode app with colors swapped. Specific expectations:

- **Cards** should have subtle borders or shadows that work on light backgrounds — not harsh black borders
- **Text** should have proper hierarchy — not everything in dark gray
- **Accents** should pop on light backgrounds without being garish
- **Empty states** should feel inviting in light mode
- **Loading states** should be calming in light mode
- **Error states** should be clear but not alarming in light mode
- **Interactive elements** should have clear hover/active states in light mode
- **Glass cards** should actually look glass-like on light backgrounds (not just semi-transparent white)

---

## Output Format

Provide your design as a **single comprehensive document** with:

1. **CSS Token Design** — the complete `@theme` block additions for light mode, with rationale for each color choice
2. **DashboardPage Redesign** — page-by-page, component-by-component light mode spec with exact colors, spacing, borders, shadows, states
3. **Shared Components Redesign** — each shared component's light mode treatment
4. **Per-Element Customization Rules** — the design system principles
5. **Implementation Checklist** — ordered list of what to change first, second, third
6. **Before/After Examples** — describe what a key component (e.g., GoalsCard) looks like in dark mode vs light mode

Do NOT provide multiple options. Design THE solution. Make definitive choices. Explain the reasoning briefly but focus on the spec.

---

## Files Referenced

- `src/index.css` — design tokens and global styles
- `src/lib/theme.ts` — theme engine
- `src/components/ThemeToggle.tsx` — theme toggle button
- `src/components/GlassCard.tsx` — card component (50 lines)
- `src/components/EmptyState.tsx` — empty state (39 lines)
- `src/components/LoadingState.tsx` — loading states (23 lines)
- `src/components/SectionHeader.tsx` — section header (23 lines)
- `src/components/PageShell.tsx` — page wrapper (25 lines)
- `src/components/ErrorBoundary.tsx` — error screen (223 lines)
- `src/pages/DashboardPage.tsx` — dashboard (2922 lines)
- `src/pages/dashboard/` — dashboard sub-components
- `src/components/dashboard/WidgetGrid.tsx` — widget grid (322 lines)
- `src/components/dashboard/MomentumHero.tsx` — momentum hero (193 lines)
- `src/components/dashboard/GoalsCard.tsx` — goals card (673 lines)
- `src/components/dashboard/DeadlinesCard.tsx` — deadlines card (842 lines)
- `src/components/dashboard/LongestFocusCard.tsx` — focus card (196 lines)

---

*Generated: 08092026 | Context bundle: CONTEXT_BUNDLE.md in same directory*
