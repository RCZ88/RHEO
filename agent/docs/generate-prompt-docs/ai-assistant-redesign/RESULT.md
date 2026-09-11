<aside>
🎯

**Scope:** Frontend-only visual overhaul of the AI Assistant page (`src/pages/AiPage.tsx`) and its card system. No IPC/backend changes, no new files, additive edits only, must pass `npm run build`. Theme stays on the dark dev-tool aesthetic using the existing **pink / amber / emerald / zinc** palette.

</aside>

## Executive Summary

The AI Assistant page currently fails on four fronts: cards share near-identical visual weight despite different purposes, section differentiation relies only on numbering, hover/interaction feedback is minimal, and `MarkdownPreview` headings clash with their host card's accent (the purple-in-emerald problem). This specification resolves all of it through **one organizing idea: a per-section accent system**.

Each of the three zones owns an accent that propagates through its header, cards, badges, and markdown headings:

| Zone | Accent | Intent |
| --- | --- | --- |
| **01 FOCUS** | pink | Urgent, attention-now |
| **02 PLAN** | emerald | Constructive, forward-looking |
| **03 REFLECT** | amber | Calm, retrospective |
| Chrome / neutral | zinc | Structure & body text |

Layered on top: **seven genuinely distinct `GlassCard` variants**, a **coherent h1–h4 type scale**, **GPU-friendly micro-interactions** (`transform`/`opacity` only, with reduced-motion fallbacks), and a **mode-aware sticky header**. Every change maps to an existing file and an existing IPC channel — there are **no backend gaps**.

---

## Section 1: Visual Hierarchy

The page reads top-to-bottom as three clearly separated zones. Hierarchy is established by **accent color + numbered index + typographic weight + spacing**, not numbering alone.

### Section header anatomy

Each zone opens with a header block built from four parts:

1. **Numbered index** — oversized, `tabular-nums`, in the zone accent (`text-4xl font-bold`).
2. **Eyebrow label** — uppercase, wide tracking (`text-xs tracking-[0.2em]`).
3. **Subtitle** — one-line description in muted zinc (`text-sm text-zinc-500`).
4. **Status badge** — right-aligned pill reflecting live data (e.g. `3 goals`, `Active`, `Updated 2h ago`).

```tsx
// Section header pattern (per zone, accent from SECTION_ACCENTS)
<header className="flex items-end justify-between mb-6">
  <div className="flex items-center gap-3">
    <span className={`text-4xl font-bold tabular-nums ${a.index}`}>01</span>
    <div>
      <p className={`text-xs font-medium uppercase tracking-[0.2em] ${a.label}`}>
        Focus
      </p>
      <p className="text-sm text-zinc-500">What needs your attention today</p>
    </div>
  </div>
  <StatusBadge accent={a} label={`${goals.length} goals`} />
</header>
```

### Status badge

```tsx
<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
  text-xs font-medium ${a.badgeBg} ${a.badgeText} ring-1 ${a.badgeRing}`}>
  <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
  {label}
</span>
```

### Spacing rhythm

| Relationship | Token |
| --- | --- |
| Between zones | `mb-12` |
| Header → cards within a zone | `mb-6` |
| Card-to-card grid gap | `gap-6` |
| Sub-grids inside a card | `gap-5` |

---

## Section 2: Card Component Variations

`GlassCard` already exposes seven variants and a `'pink' | 'amber' | 'emerald' | 'none'` accent prop. This refactors the variant logic into a single `variantStyles` lookup so each variant has an unmistakable identity. **The prop API is unchanged** — purely additive.

| Variant | Background | Blur | Border | Shadow | Distinctive trait |
| --- | --- | --- | --- | --- | --- |
| `default` | `zinc-900/60` | `blur-xl` | `zinc-700/40` | `shadow-lg` | Baseline glass |
| `compact` | `zinc-900/50` | `blur-md` | `zinc-700/30` | `shadow-sm` | Tighter `p-3` |
| `subtle` | `zinc-900/30` | `blur-sm` | transparent | none | Low-emphasis, borderless |
| `notebook` | `zinc-950/70` | `blur-lg` | `border-l-2` accent rule | inset | Document / lined feel |
| `bordered` | transparent | none | `1.5px {accent}/30` | none | Outline-first |
| `elevated` | `zinc-800/70` | `blur-2xl` | `zinc-600/40` | `shadow-2xl`  • accent glow | Highest emphasis |
| `interactive` | `zinc-900/60` | `blur-xl` | `{accent}/20` | `shadow-lg` | Pointer + lift on hover |

### Variant lookup pattern

```tsx
const variantStyles: Record<Variant, string> = {
  default:     "bg-zinc-900/60 backdrop-blur-xl border border-zinc-700/40 shadow-lg",
  compact:     "bg-zinc-900/50 backdrop-blur-md border border-zinc-700/30 shadow-sm p-3",
  subtle:      "bg-zinc-900/30 backdrop-blur-sm border border-transparent",
  notebook:    "bg-zinc-950/70 backdrop-blur-lg border-l-2 shadow-inner",
  bordered:    "bg-transparent border-[1.5px]",
  elevated:    "bg-zinc-800/70 backdrop-blur-2xl border border-zinc-600/40 shadow-2xl",
  interactive: "bg-zinc-900/60 backdrop-blur-xl border shadow-lg cursor-pointer",
}

// accent edge applied for notebook / bordered / interactive / elevated
const accentEdge: Record<Accent, string> = {
  pink:    "border-pink-500/30",
  emerald: "border-emerald-500/30",
  amber:   "border-amber-500/30",
  none:    "border-zinc-700/40",
}
```

### Card → variant assignment (existing components)

| Component | Zone | Variant | Accent |
| --- | --- | --- | --- |
| `DailyPlanCard` | Focus | `elevated` | pink |
| `ContextSummaryCard` | Focus | `compact` | pink |
| `MyPlanCard` | Plan | `notebook` | emerald |
| `LongTermPlanCard` | Plan | `subtle` | emerald |
| `TopicDigestCard` | Reflect | `bordered` | amber |
| `GoalHistoryCard` | Reflect | `interactive` | amber |

<aside>
⚠️

`LongTermPlanCard` currently uses `accent="pink"` — switch to `emerald` so it matches its Plan zone. Same for any Reflect-zone card still passing `pink`. Accent must follow the zone, not be hardcoded per card.

</aside>

---

## Section 3: Typography System

A single scale governs every text element. Headings inherit zone accent; body and meta stay zinc for readability.

| Level | Size / weight | Tracking | Color | Use |
| --- | --- | --- | --- | --- |
| h1 | `text-2xl font-semibold` | `-0.01em` | `text-white` | Mode-aware header title |
| h2 | `text-lg font-semibold` | normal | accent-200 | Card titles |
| h3 | `text-base font-medium` | normal | accent-200 | Sub-card titles |
| h4 | `text-sm font-medium uppercase` | `0.1em` | `text-zinc-400` | Eyebrow labels |
| body | `text-sm leading-relaxed` | normal | `text-zinc-300` | Content |
| meta | `text-xs` | normal | `text-zinc-500` | Timestamps, counts |
- Use `tabular-nums` on every numeric index, count, and timestamp to prevent width jitter.
- Maximum two heading levels visible inside any single card to keep scanning easy.

---

## Section 4: Color System

### The `SECTION_ACCENTS` map

Define once, inline in `AiPage.tsx`. Every zone-scoped color derives from it.

```tsx
const SECTION_ACCENTS = {
  focus: {
    index: "text-pink-400",   label: "text-pink-300",
    heading: "text-pink-200", border: "border-pink-500/20",
    glow: "shadow-pink-500/10",
    badgeBg: "bg-pink-500/10", badgeText: "text-pink-300",
    badgeRing: "ring-pink-500/20", dot: "bg-pink-400",
    ring: "focus-visible:ring-pink-400/60",
  },
  plan: {
    index: "text-emerald-400",   label: "text-emerald-300",
    heading: "text-emerald-200", border: "border-emerald-500/20",
    glow: "shadow-emerald-500/10",
    badgeBg: "bg-emerald-500/10", badgeText: "text-emerald-300",
    badgeRing: "ring-emerald-500/20", dot: "bg-emerald-400",
    ring: "focus-visible:ring-emerald-400/60",
  },
  reflect: {
    index: "text-amber-400",   label: "text-amber-300",
    heading: "text-amber-200", border: "border-amber-500/20",
    glow: "shadow-amber-500/10",
    badgeBg: "bg-amber-500/10", badgeText: "text-amber-300",
    badgeRing: "ring-amber-500/20", dot: "bg-amber-400",
    ring: "focus-visible:ring-amber-400/60",
  },
} as const
```

### Fixing the purple-heading clash

`MarkdownPreview.tsx` already accepts an `accent` prop (replacing the old hardcoded `text-purple-400`). The fix is to ensure every caller passes the **host card's** accent and that the prop fully drives heading color:

```tsx
// MarkdownPreview heading mapping
const headingColor: Record<Accent, string> = {
  pink: "text-pink-200", emerald: "text-emerald-200",
  amber: "text-amber-200", none: "text-zinc-100",
}
// h1–h3 use headingColor[accent]; links/bullets use the -400 tint of the same accent
```

Since `MyPlanCard` lives in the Plan zone and passes `accent="emerald"`, its markdown headings render `emerald-200` — no more purple inside an emerald card.

### Contrast

All accent-200 text on `zinc-900/zinc-950` backgrounds clears **WCAG AA (≥ 4.5:1)** for body and **AA large** for headings. Body copy uses `text-zinc-300` (not `400/500`) wherever it carries primary meaning.

---

## Section 5: Interaction Design

All motion uses **`transform` and `opacity` only** — no animating `width`, `filter`, `box-shadow` geometry, or layout properties.

| Element | Resting | Hover / Active | Transition |
| --- | --- | --- | --- |
| `interactive` / `elevated` card | border `{accent}/20` | `-translate-y-0.5`, border `{accent}/40`, soft accent glow | `transition-all duration-200 ease-out` |
| CTA buttons (suggest / refresh) | accent-tinted | accent-filled hover, `active:scale-[0.98]` | `duration-150` |
| Badges / chips | static | subtle `opacity` lift | `duration-150` |

### Focus, loading, error, entrance

- **Focus:** every interactive element gets `focus-visible:ring-2 ${a.ring} ring-offset-2 ring-offset-zinc-950`.
- **Loading:** zinc shimmer skeletons sized to the real content footprint (no layout shift on data arrival).
- **Error:** inline `rose`/`amber` callout row with a retry affordance, scoped to the failing card — never blanks the whole page.
- **Entrance:** staggered `opacity` + `translate-y-1` fade-in per zone (≤ 60 ms stagger).

```css
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; transform: none !important; }
}
```

---

## Section 6: Layout and Grid

A 12-column responsive grid with `gap-6`; zones separated by `mb-12`.

| Breakpoint | Behavior |
| --- | --- |
| Mobile (base) | Single column, cards stack full-width |
| Tablet (`md`) | 6 / 6 split for paired cards |
| Desktop (`xl`) | Purpose-driven spans on `xl:grid-cols-12` |

```tsx
<section className="mb-12">
  {/* header ... */}
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
    <DailyPlanCard       className="xl:col-span-8" />
    <ContextSummaryCard  className="xl:col-span-4" />
  </div>
</section>
```

Suggested spans per zone:

- **Focus:** `DailyPlanCard` `col-span-8` + `ContextSummaryCard` `col-span-4`
- **Plan:** `MyPlanCard` `col-span-7` + `LongTermPlanCard` `col-span-5`
- **Reflect:** `TopicDigestCard` `col-span-6` + `GoalHistoryCard` `col-span-6`

Cards align to equal height per row via grid stretch; internal padding stays consistent (`p-5` default, `p-3` for `compact`).

---

## Section 7: Header Design

A sticky, mode-aware header at the top of `AiPage`. Title, accent, and subtitle swap based on the active mode pulled from `SECTION_ACCENTS`.

```tsx
<header className="sticky top-0 z-10 -mx-4 px-4 py-4 mb-8
  bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60
  flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className={`grid place-items-center h-9 w-9 rounded-xl
      ${mode.badgeBg} ring-1 ${mode.badgeRing}`}>
      <Icon className={mode.heading} />
    </div>
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-white">
        {title}
      </h1>
      <p className="text-sm text-zinc-500">{subtitle}</p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <RefreshButton /> <SuggestButton accent={mode} />
  </div>
</header>
```

- **Left:** accent icon chip + title + subtitle.
- **Right:** action area (`refresh`, `suggest goals`).
- **Responsive:** subtitle hides and actions condense to icon-only below `md`.

---

## Section 8: Implementation Details

All edits land in **existing files** (per the context bundle). No new files or directories.

| File | Change |
| --- | --- |
| `src/pages/AiPage.tsx` | Add `SECTION_ACCENTS` map; rebuild section headers with index + badge; mode-aware sticky header; grid `col-span` assignments; pass zone accent into each card |
| `src/components/GlassCard.tsx` | Refactor variants into `variantStyles`  • `accentEdge` lookups; add hover/lift + focus-ring classes; keep prop API identical |
| `src/components/MarkdownPreview.tsx` | Map `accent` → `headingColor`; remove any residual `text-purple-400`; tint links/bullets with accent-400 |
| `src/components/MyPlanCard.tsx` | Confirm `variant="notebook"`  • `accent="emerald"` passed through to `MarkdownPreview` |
| `src/components/ContextSummaryCard.tsx` | `variant="compact"`, pink accent, badge styling |
| `src/components/LongTermPlanCard.tsx` | Switch accent `pink → emerald`; `variant="subtle"` |
| `src/components/TopicDigestCard.tsx` | `variant="bordered"`, amber accent |
| `src/components/GoalHistoryCard.tsx` | `variant="interactive"`, amber accent, hover lift |
| Global CSS / Tailwind layer | Add `prefers-reduced-motion` block; remove any animated `filter`/`backdrop-filter` causing decorator jitter |

<aside>
🧷

**Jitter root cause & fix:** the section decorator currently animates a `filter`/`backdrop-filter`, which forces sub-pixel repaints. Replace it with a static accent gradient divider and, where a decorator must move, animate `transform` only with `will-change: transform` and `translateZ(0)` to promote it to its own layer.

</aside>

### Tailwind safelist note

Because accent classes are composed dynamically from `SECTION_ACCENTS`, ensure the pink/emerald/amber `text-*-200/300/400`, `bg-*-500/10`, `ring-*-500/20`, and `border-*-500/20|30|40` utilities are present in the build (reference them statically in the map, not via string interpolation, so Tailwind's scanner keeps them).

---

## Section 9: Testing Strategy

Manual verification — no backend test changes needed.

- [ ]  `npm run build` passes with zero TypeScript / lint errors (strict mode satisfied).
- [ ]  Each of the seven variants is visually distinguishable side by side.
- [ ]  No purple headings anywhere; `MyPlanCard` headings render emerald.
- [ ]  Section decorators are stable — no jitter on scroll or hover.
- [ ]  Resize sweep: mobile (1-col), tablet (`md` 6/6), desktop (`xl` spans) all hold.
- [ ]  Keyboard-only pass: every actionable element reachable, visible accent focus ring.
- [ ]  `prefers-reduced-motion: reduce` disables all transforms/transitions.
- [ ]  Data states verified against live IPC: `getGoals`, `readPlanningMd`, `getTopicDigest`, `getGoalContext`, `suggestGoals`, `getLongtermGoals` — loading skeletons, populated, and error rows all render.

---

## Section 10: Performance Considerations

- Animate only `transform` / `opacity`; never layout or paint-heavy properties.
- Cap blur tiers per variant (`blur-sm` → `blur-2xl`) to limit overdraw — avoid stacking multiple `blur-2xl` cards in one viewport.
- Promote only actively animating decorators to their own layer (`will-change: transform`); remove `will-change` at rest.
- Memoize card lists and derive `SECTION_ACCENTS` lookups outside render to avoid re-allocation.
- No new npm dependencies; bundle size unchanged.

---

## Section 11: Accessibility Compliance

| WCAG criterion | How it's met |
| --- | --- |
| 1.4.3 Contrast (AA) | accent-200 headings & `zinc-300` body clear 4.5:1 on `zinc-900/950` |
| 1.4.11 Non-text contrast | Card borders & badge rings meet 3:1 against background |
| 2.1.1 Keyboard | All interactive cards/buttons focusable and operable via keyboard |
| 2.4.7 Focus Visible | `focus-visible:ring-2` accent ring with `ring-offset` on every control |
| 2.3.3 Animation from interactions | `prefers-reduced-motion` removes all motion |
| 4.1.2 Name, Role, Value | Status badges carry text labels; icon-only buttons get `aria-label` |

<aside>
✅

**Backend verified:** all six IPC channels (`getGoals`, `readPlanningMd`, `getTopicDigest`, `getGoalContext`, `suggestGoals`, `getLongtermGoals`) are already functional. This redesign is purely frontend with **no backend gaps**.

</aside>