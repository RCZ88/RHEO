<aside>
🧭

**Scope (Human-Centric UX rule):** This spec applies to the **AI Assistant page (`AiPage.tsx`) layout only**. No features are removed, no other pages or shared components are refactored. Surrounding code is treated as fixed context to match.

**Primary user goal of this surface:** *"Decide what to do today, track it, and reflect on it"* — so the layout must put today's plan first, make context glanceable, and keep planning + history one scan away.

</aside>

## Skills applied

This revamp was generated using the **generate-prompt** meta-skill to orchestrate the following design skills. Each card and layout decision below is traceable to a rule in one of them.

| Skill | Role in this revamp | Hard rules enforced |
| --- | --- | --- |
| **Frontend Design** | Visual tokens, glass structure, page accent, layout patterns | pink-500 accent · `p-5` · `rounded-xl` max · 8px grid · no `box-shadow` elevation · transform/opacity-only motion |
| **Impeccable** | Typography scale, spatial/z-index discipline, motion durations, anti-patterns | No `transition: all` · no animating width/height · 44px targets · ≤3 accents · contrast ≥4.5:1 · no arbitrary z-index |
| **Human-Centric UX** | Comprehension filter: hierarchy, complete states, feedback, scope | One focal point · Empty/Loading/Error for every data card · plain-language copy · hover/focus/active/disabled everywhere |

<aside>
⚖️

**Conflict resolution:** When skills disagree, **human comprehension wins** (per Human-Centric UX activation notes), then Frontend Design tokens, then Impeccable refinements.

</aside>

---

## 1. The diagnosis — why it feels "all on the side"

The current layout is a single `lg:grid-cols-3` row with a **2:1 split**:

```tsx
// CURRENT — AiPage.tsx lines 277-329
<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
  <div className="lg:col-span-2">   {/* LEFT: 2 cards */}
    <DailyPlanCard />
    <TopicDigestCard />
  </div>
  <div className="lg:col-span-1">   {/* RIGHT: 4 cards crammed */}
    <MyPlanCard />
    <LongTermPlanCard />
    <GoalHistoryCard />
    <ContextSummaryCard />
  </div>
</div>
```

**Root causes of the imbalance:**

1. **Card-count asymmetry, not just width asymmetry.** The left column holds 2 cards in a 2/3-wide lane; the right holds **4 cards stacked in a 1/3-wide lane**. The right rail becomes a tall, cramped "junk drawer" — this is the literal "all on the side" complaint.
2. **Unequal vertical rhythm.** Left lane runs short, right lane runs very long → the page bottom is ragged and the eye has no anchor.
3. **Width starves content.** `MyPlanCard` (a markdown editor) and `LongTermPlanCard` need horizontal room to be readable; squeezing them into ~320px breaks Impeccable's 45–75ch measure rule.
4. **No workflow priority.** Morning-planning, in-progress-tracking, and review cards all sit at the same visual weight — violating Human-Centric UX *Visual Hierarchy* (one focal point per view).
5. **Wasted real estate on wide screens.** `max-w-6xl` + a 2:1 split leaves the dense right cards pinched while the left has slack.

---

## 2. Layout Structure Proposal — "Workflow Command Center"

Replace the two-rail split with a **priority-zoned 12-column grid** across three balanced rows. This rebalances both sides, gives the focal card dominance, and gives editors the width they need.

```
┌───────────────────────────────────────────────────────────────┐
│  HEADER  ✦ AI Assistant · "Plan with purpose" · ● via OpenRouter │
├───────────────────────────────────────────────────────────────┤
│  [ Provider Banner — only if 0 providers enabled ]              │
├───────────────────────────────────────────────────────────────┤
│  ROW 1 · FOCUS          (today's action — highest priority)     │
│  ┌─────────────────────────────────┐ ┌───────────────────────┐ │
│  │  DailyPlanCard      col-span-8  │ │ ContextSummaryCard    │ │
│  │  (mode-aware focal point)       │ │   col-span-4 (glance) │ │
│  └─────────────────────────────────┘ └───────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  ROW 2 · PLAN           (the inputs that feed the AI)           │
│  ┌─────────────────────────┐ ┌───────────────────────────────┐ │
│  │  MyPlanCard  col-span-6 │ │  LongTermPlanCard  col-span-6 │ │
│  │  (planning.md editor)   │ │  (extended goals)             │ │
│  └─────────────────────────┘ └───────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  ROW 3 · REFLECT        (insight + memory)                      │
│  ┌─────────────────────────────────┐ ┌───────────────────────┐ │
│  │  TopicDigestCard    col-span-8  │ │  GoalHistoryCard      │ │
│  │  (daily insights)               │ │   col-span-4          │ │
│  └─────────────────────────────────┘ └───────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Why this works:**

- **Equal card distribution** (2 / 2 / 2) kills the lopsided rail.
- **Three named zones** map 1:1 to the user's workflow (Focus → Plan → Reflect), satisfying Human-Centric UX hierarchy.
- **The 8/4 rhythm repeats** in rows 1 and 3, so the eye locks onto a consistent vertical edge at the 8-col gutter — the page reads as *designed*, not stacked.
- **Row 2's 6/6** gives both editors a readable measure.

### Container + grid (exact classes)

```tsx
// NEW — AiPage.tsx root
<div className="mx-auto w-full max-w-7xl px-6 py-6 space-y-6">
  {/* Header + conditional ProviderBanner go here (space-y-6) */}

  {/* ROW 1 · FOCUS */}
  <section aria-label="Today" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch">
    <div className="md:col-span-2 xl:col-span-8"><DailyPlanCard /></div>
    <div className="md:col-span-2 xl:col-span-4"><ContextSummaryCard /></div>
  </section>

  {/* ROW 2 · PLAN */}
  <section aria-label="Plans" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch">
    <div className="xl:col-span-6"><MyPlanCard /></div>
    <div className="xl:col-span-6"><LongTermPlanCard /></div>
  </section>

  {/* ROW 3 · REFLECT */}
  <section aria-label="Insights" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch">
    <div className="md:col-span-2 xl:col-span-8"><TopicDigestCard /></div>
    <div className="md:col-span-2 xl:col-span-4"><GoalHistoryCard /></div>
  </section>
</div>
```

<aside>
📐

`max-w-6xl` → **`max-w-7xl` (1280px)**. The extra 128px is spent on the editors in Row 2, not on stretching the focal card. Beyond `2xl` the container caps so text never exceeds a comfortable measure.

</aside>

---

## 3. Detailed Spacing & Dimension Specifications

All values are multiples of the 8px grid (4px micro-adjust only).

| Token | Value | Applied to |
| --- | --- | --- |
| Page padding | `px-6 py-6` (24px) | Root container — `xl` page-section spacing |
| Row gap (vertical) | `space-y-6` (24px) | Between Header / Row1 / Row2 / Row3 |
| Grid gap | `gap-5` (20px) | Between cards within a row |
| Card padding | `p-5` (20px) | **Every** card — Frontend Design standard |
| Card radius | `rounded-xl` (12px) | **Every** card — never exceed |
| In-card section gap | `space-y-4` (16px) | Header → body → footer inside a card |
| List-item gap | `space-y-2` (8px) | Goal rows, history rows (dense zone) |
| Inline/icon gap | `gap-2` (8px) / `gap-1` (4px) | Icon+label, badge clusters |

### Column ratios (the proportion fix)

| Row | Desktop (`xl`) | Tablet (`md`) | Mobile |
| --- | --- | --- | --- |
| Focus | 8 / 4 (2:1) | full / full | stack |
| Plan | 6 / 6 (1:1) | 1 / 1 | stack |
| Reflect | 8 / 4 (2:1) | full / full | stack |

### Card min-heights (prevents collapse + ragged bottoms)

- Use **`h-full`** on every card so paired cards in a row stretch to equal height (`items-stretch` on the grid).
- Set content-driven **`min-h-*`** floors so empty/loading states don't collapse:
    - DailyPlanCard: `min-h-[420px]`
    - ContextSummaryCard: `min-h-[420px]` (matches DailyPlan in Row 1)
    - MyPlanCard / LongTermPlanCard: `min-h-[320px]`
    - TopicDigestCard: `min-h-[280px]`
    - GoalHistoryCard: `min-h-[280px]` (matches TopicDigest in Row 3)
- **Never set fixed `height`** — only `min-h` + `h-full`. Content overflow scrolls internally (`overflow-y-auto`) so the page itself never thrashes.

---

## 4. Visual Hierarchy & Priority Guidelines

Hierarchy is built with **weight, color temperature, and spacing — not size alone** (Impeccable + Human-Centric UX).

| Tier | Card | Treatment |
| --- | --- | --- |
| **1 — Focal** | DailyPlanCard | Widest span (8). Pink 2px top accent stripe (`bg-pink-500`). Card title `15px/600`. The only card with mode pills + primary CTA buttons. |
| **2 — Supporting** | ContextSummaryCard, MyPlanCard, LongTermPlanCard | Standard glass. Subtle accent only on hover (`hover:border-zinc-700`). Title `13px/600`. Secondary actions. |
| **3 — Reference** | TopicDigestCard, GoalHistoryCard | Quietest. No accent stripe. Muted metadata in `zinc-400`. Read-mostly. |

**Mode-driven emphasis (DailyPlanCard):** the focal card's *internal* accent shifts with mode, but it always stays the single focal point:

- **Morning** → amber-400 mode pill (planning/suggestions)
- **In Progress** → emerald-400 mode pill (tracking)
- **Review** → pink-500 mode pill (reflection)

This respects the ≤3-accent rule: pink (page) + one mode color + zinc neutrals = never more than 3 in view.

---

## 5. Responsive Breakpoint Definitions

Mobile-first, 3 meaningful layouts. **Primary content is never hidden** — only reflowed (Impeccable anti-pattern #25).

| Range | Grid | Behavior |
| --- | --- | --- |
| **Mobile** `< 768px` | `grid-cols-1` | Single stack in priority order (see below). Each card full-width, `min-h` relaxed. |
| **Tablet** `md 768–1279px` | `md:grid-cols-2` | Two-up. Focus & Reflect: focal card `md:col-span-2` (full row), companion drops below full-width. Plan row: true 1:1. |
| **Desktop** `xl ≥ 1280px` | `xl:grid-cols-12` | Full Command Center (8/4 · 6/6 · 8/4). |

**Mobile DOM/visual priority order** (also the keyboard tab order):

`DailyPlanCard → ContextSummaryCard → MyPlanCard → LongTermPlanCard → TopicDigestCard → GoalHistoryCard`

<aside>
💡

The `lg` (1024px) breakpoint is intentionally skipped for the grid jump: laptops in the 1024–1279 band render the **tablet** 2-up, which keeps the editors readable. The 12-col layout only engages once there's genuinely enough width (`xl`) to avoid re-cramping.

</aside>

---

## 6. Component-Specific Scaling Rules

How each card adapts to **content load** (few vs many goals, short vs long text):

```tsx
// Shared adaptive-density helper — drives internal spacing by item count
function listDensity(count: number): { gap: string; pad: string } {
  if (count <= 4)  return { gap: 'space-y-3', pad: 'py-2.5' }; // roomy
  if (count <= 10) return { gap: 'space-y-2', pad: 'py-2'   }; // standard (Dense/7)
  return            { gap: 'space-y-1.5', pad: 'py-1.5' };      // compact + scroll
}
```

- **DailyPlanCard** — Few goals: roomy rows. Many (>10): compact rows + `max-h-[480px] overflow-y-auto` on the list region only (header/feedback input stay pinned). Long titles: `truncate` with `title` attr tooltip; descriptions `line-clamp-2`.
- **ContextSummaryCard** — Fixed stat rows (2–3). Token-usage line wraps to 2 lines max (`line-clamp-2`). Scales by staying compact — it's the "glance" card.
- **MyPlanCard** — Editor textarea grows with `field-sizing-content` (capped `max-h-[60vh]`, then scroll). Preview renders full markdown with internal scroll. Empty → default template placeholder.
- **LongTermPlanCard** — Long goal lists paginate to first 5 + "Show all (N)" disclosure (progressive disclosure, Human-Centric UX).
- **TopicDigestCard** — Topics wrap as a responsive flow; >6 topics collapse behind "+N more".
- **GoalHistoryCard** — Virtualize/limit to last 14 days visible; older behind "Load more". Each day row click-expands (accordion) — collapsed by default to control density.

---

## 7. Motion & Interaction Specifications

Moderate intensity (Frontend Design `normal` = 250ms, `ease-out` = `cubic-bezier(0.16, 1, 0.3, 1)`). **Only `transform` + `opacity`** animate.

```tsx
const EASE = [0.16, 1, 0.3, 1] as const;

// Row/card entrance — staggered by zone
const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.25, ease: EASE, delay: i * 0.05 },
  }),
};

// Goal-row entrance inside DailyPlanCard
const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE, delay: i * 0.04 } }),
};
```

| Interaction | Spec |
| --- | --- |
| Card entrance | `opacity 0→1`, `y: 8→0`, 250ms, staggered `delay: index*0.05` |
| Card hover (Tier 2/3) | `hover:border-zinc-700 transition-colors duration-150` — color only, no transform jump |
| Mode switch (DailyPlan) | `AnimatePresence` cross-fade: `opacity 0→1`, `y: -4→0`, 250ms |
| Checkbox toggle | Scale bounce `scale 1 → 1.1 → 1`, 200ms — `transform` only |
| Progress bar fill | Inner bar `scaleX` 0→1 (transform-origin left), 250ms ease-out — **not** width (see callout) |
| Button press | `active:scale-[0.98]` |
| Provider status dot | `animate-pulse` (subtle) |
| Save flash (MyPlan) | Indicator text fades emerald-400 → zinc-500 over 400ms |

<aside>
📊

**Progress bars use `scaleX`, not `width`.** Impeccable forbids animating `width` (layout thrash in Electron). Implement the fill as a full-width inner div with `origin-left` and animate `transform: scaleX()`. Track: `h-1.5 rounded-full bg-zinc-800 overflow-hidden`; fill: `h-full rounded-full bg-emerald-400 origin-left`.

</aside>

```tsx
// Reduced-motion fallback (Impeccable anti-pattern #19) — wrap globally
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 8. Accessibility Considerations

- **Landmarks:** each row is a `<section aria-label="Today | Plans | Insights">` so screen readers can jump between zones. Page wrapped in `<main>`.
- **Heading order:** Page `<h1>` "AI Assistant" → each card title `<h2>` → in-card groupings `<h3>`. No skipped levels.
- **Focus order = visual order = DOM order** (the mobile priority order). Grid uses `order` only where it does not desync from DOM, to keep tab order intact.
- **Focus rings:** replace browser default with `focus-visible:ring-2 focus-visible:ring-pink-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950` on all interactive elements.
- **Touch targets ≥ 44×44px** for every button, checkbox, mode pill, and drag handle.
- **Contrast:** `zinc-100` on `zinc-900/50` ≈ 13:1; `zinc-400` body ≥ 4.5:1. Never use `opacity` for text hierarchy — use color tokens.
- **Color never sole signal:** goal status pairs color **and** text/icon (e.g. emerald check + "Done", amber clock + "Slipped").
- **Live regions:** suggestion results, save confirmations, and feedback-loop replies announce via `aria-live="polite"`.
- **Keyboard reorder:** drag-to-reorder checklist items must also support `↑/↓` when a row is focused (drag is mouse-only otherwise — Human-Centric UX forbids mouse-only primary actions).

---

## 9. Complete State Coverage (per card)

Human-Centric UX's #1 anti-slop rule: **every data card defines Empty / Loading / Error**, not just the happy path.

| Card | Loading | Empty | Error |
| --- | --- | --- | --- |
| DailyPlanCard | 3 skeleton goal rows (`animate-pulse bg-zinc-800 rounded h-10`) | Icon + "No goals yet. Let's plan your day." + **Suggest Goals** / **Add manually** | Red-tinted body + "Couldn't load goals because the AI provider didn't respond. Retry." |
| ContextSummaryCard | 2 skeleton stat rows | "No history yet — context builds as you complete goals." | Inline "Stats unavailable. Retry." |
| MyPlanCard | Skeleton textarea block | Default template placeholder shown in editor | "Couldn't read planning.md because the file is missing. Create one?" |
| LongTermPlanCard | 3 skeleton rows | "No long-term goals yet. Add one." | "Couldn't load long-term goals. Retry." |
| TopicDigestCard | Skeleton chips | "No digest yet. Generate today's insights." | "Digest failed because all providers are unavailable. Retry." |
| GoalHistoryCard | 4 skeleton day rows | "No goal history yet." | "Couldn't load history. Retry." |

**Page-level edge cases:**

- **0 providers enabled** → conditional Provider Banner above Row 1: glass card, "Connect an AI provider to enable goals & digest." + **Open Settings**. Cards below render in their empty state.
- **All providers failed** → DailyPlan + Digest show error state with shared Retry.
- **planning.md missing** → MyPlanCard shows default template (not an error).

Error copy follows Impeccable's format: *"[Thing] [verb] because [reason]. [Action]"* — no "Oops, something went wrong."

---

## 10. UX / Interaction Flow

1. **Default state (open):** Header resolves provider chip (● via OpenRouter). Row 1 loads first (goals + context skeletons → content). If morning & no goals → DailyPlan empty state invites **Suggest Goals**.
2. **Goal interaction:** Each goal row — checkbox (toggle complete, scale-bounce + emerald), inline **Edit**, **Dismiss** (with undo toast). New goal via **Add manually** opens an inline composer row, not a modal (lower friction).
3. **Suggestion flow:** Morning mode lists AI suggestions with staggered entrance; per row **Accept** (promotes to active goal), **Edit** (inline), **Dismiss**. Accepting animates the row into the active list.
4. **Review process:** Evening → mode pill flips to **Review** (pink). Two-column Accomplished (emerald) / Slipped (amber) + a textarea for the written review; **Save review** → flash confirm, persists via `saveGoalReview`.
5. **Planning integration:** `MyPlanCard` checklist items (`- [ ]`) surface as "From your plan" proposed goals in DailyPlanCard; checking a box ↔ completing the goal stays in sync; editing planning.md invalidates today's suggestion cache.
6. **Error states:** as in §9 — always plain language + recovery action; user input is never wiped on error.
7. **Micro-interactions:** see §7 (hover border-shift, press scale, checkbox bounce, save flash, pulse dot).
8. **Keyboard navigation:** Tab follows the priority order; mode pills are a roving-tabindex group; checklist rows reorder with `↑/↓`; `focus-visible` pink ring throughout.

---

## 11. Implementation Notes for Engineers

- **Touch only `AiPage.tsx`'s grid wrapper** and per-card container `className`s. The 6 child components' internals stay as-is except for the shared `h-full` + `min-h-*` and the state-coverage additions in §9. (Scope discipline.)
- Swap the single `lg:grid-cols-3` block for the **three `<section>` grids** in §2. Delete the old left/right wrapper `<div>`s.
- Add `h-full` to each card's root and the `min-h-*` floors from §3.
- Bump container `max-w-6xl` → `max-w-7xl`.
- Keep all existing IPC calls and the `IPC → state → props → UI` flow untouched — this is **layout + state-coverage only**, no data-flow changes.
- Wrap entrance animations in the shared `cardVariants`; pass `custom={index}` for stagger.
- Add the `prefers-reduced-motion` global fallback if not already present.
- **Verification:** `npm run build` (renderer + electron) passes; AiPage renders the 3-zone grid at `xl`, 2-up at `md`, single stack on mobile; every card shows correct Empty/Loading/Error; tab order matches visual order; no horizontal scroll on the page; no console warnings.

### Pre-return checklist (Human-Centric UX)

- [x]  Scope stated (AiPage layout only).
- [x]  Primary action obvious in <1s (DailyPlanCard is the focal point).
- [x]  No raw tokens/enums/stack traces in user-facing copy.
- [x]  Empty / Loading / Error defined for every data card.
- [x]  One focal point, muted metadata, named zones.
- [x]  Secondary complexity behind disclosure (history accordion, "show all").
- [x]  Hover / focus / active / disabled on all interactive elements.
- [x]  State changes animate 150–300ms, transform/opacity only.
- [x]  Save/destructive actions give feedback / undo.
- [x]  Plain-language copy throughout.
- [x]  Meaning never by color alone; focus rings + keyboard nav work.
- [x]  Targets ≥ 44px; nothing mouse-only.
- [x]  No effect harms clarity or Electron performance.