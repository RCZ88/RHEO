# PROMPT — Gold Page Calendar Sidebar Redesign

> **Target AI:** Architect (external design+engineering AI)
> **Output format:** RESULT.md-style design spec + precise per-file patch instructions (NOT a diff/ZIP — Hands & Eyes applies).
> **Context bundle:** read `CONTEXT_BUNDLE.md` in this same folder FIRST — it contains real source, line numbers, tokens, and invariants. Treat it as authoritative over any guess.
> **Signed:** opencode (Hands & Eyes), 2026-09-18

---

## Your role

You are the Architect for the DeskFlow App Tracker (Electron + React + vite + motion/react +
Tailwind v4 + better-sqlite3). You design and specify; a separate agent (Hands & Eyes)
implements, builds, and verifies in the live app. Produce a **unambiguous implementation
spec**: file-by-file, section-by-section, with exact JSX structure, exact class names, exact
state shape, and edge cases. Do NOT write the code patches yourself — describe them so
precisely that a competent React engineer clones your intent without asking questions.

## The task (user request, verbatim intent)

Fix the Goals/Gold page layout so it **maximizes available width** (currently squished to
~1024–1152px centered). Make the **calendar the main focus**, about **1/3 of the width**,
**static/sticky on one side** while the rest of the page **scrolls dynamically**. The user
must be able to **choose calendar left or right**, persisted across sessions. Intentional,
purpose-driven, human-centric UI/UX. (Full context: `CONTEXT_BUNDLE.md`.)

## Confirmed root causes (already diagnosed — build on them)

1. `LifePage.tsx:552` — `className="max-w-5xl mx-auto"` wrapper squishes GoldPage to ~1024px.
2. `GoldPage.tsx:1480` — root `max-w-6xl mx-auto` squishes again to ~1152px.
3. `GoldPage.tsx:1504/1744` — `grid-cols-3` with a right column of `xl:col-span-7` is invalid
   (7 > 3 columns), so the right column wraps to a full-width row below the left column instead
   of sitting beside it. The "calendar-right" arrangement is already intended but visually broken.
4. MonthWall (the real calendar) is not sticky, not ~1/3, not the visual focus.

## What to design and specify

### 1. Full-width layout
- Define the exact change to the `LifePage.tsx` gold wrapper (remove max-width cap? switch to
  `max-w-none w-full`? or move width control fully into GoldPage?). Keep sibling tabs untouched.
- Define the new internal GoldPage root container: full-width, controlled max width at what
  breakpoint (e.g. `max-w-[1600px]` on ultra-wide, `w-full` below), correct horizontal padding
  inside the page shell (`p-5` is on the LifePage scroller). On big laptops the content must
  stretch to near-full viewport, not stop at 1152px.

### 2. Sticky calendar sidebar (~1/3)
- The calendar = **MonthWall** (primary) + **CalendarStrip** (day navigation), both existing
  components — re-place, never rewrite.
- Sidebar width: exactly how is ~1/3 achieved (e.g. `lg:w-[380px]`, or
  `lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`)? Give the precise column template.
- Sticky behavior: parent scroller is `LifePage`'s `overflow-auto` div. Specify the exact
  sticky recipe (`sticky top-X h-[calc(100vh-...)] self-start overflow-y-auto`) and how it
  behaves on large screens (full-height internal scroll) vs medium screens (sidebar un-sticks
  and stacks on top?) vs mobile (collapses above content?). Give breakpoints precisely.
- MonthWall details: keep 3D tilt interaction; keep event add/delete/undo; decide whether it
  needs a height cap + inner scroll, and what happens when the sidebar is shorter than the wall.

### 3. Side preference (left/right) — persistent
- Where the toggle lives (small icon button near the section header, both orientations visible
  always). Exact icon set (lucide, e.g. `PanelLeft`/`PanelRight`, `LayoutPanelLeft`,
  `CalendarClock`), placement, tooltip, focus states.
- Persistence key + shape, e.g. `localStorage['df-gold-calendar-side'] = 'left' | 'right'`,
  read with try/catch fallback to a default you choose (recommend `right`, preserving current
  intent). Specify exactly where read is initialized and where write happens.
- CSS strategy for flipping the grid (e.g. `flex-row-reverse` / `grid-flow` / conditional
  column order) that works for BOTH the 3-column desktop grid and the stacked medium state
  without duplicating both sides in the DOM.

### 4. Human-centric UX coverage (4 states)
- **Loading:** skeleton/heights for the sidebar so no layout shift.
- **Empty:** calendar with no events — friendly state (MonthWall already has one; specify any empty
  sidebar copy treatment).
- **Error:** MonthWall load-error + DeadlinesCard/ScheduleSyncCard errors visible in the new
  placement.
- **Populated:** the main content column keeps every existing section (stat pills, weekly goals,
  todos, hierarchy, schedule, goal controls, recovery banner, active/sealed goals, habit tracker,
  AI coach) — order unchanged or improved; call out any reordering you intend.
- Feedback: sticky affordance is obvious (a subtle divider/shadow on the sidebar edge), focus
  visible, `prefers-reduced-motion` respected (MonthWall already handles its own).
- Copy: short, human, purposeful labels — no "widget-speak".

### 5. Responsive breakdown (explicit)
- `lg+` (desktop, ~1100px+): sidebar sticky at ~1/3, main 2/3 scrolls under the sticky sidebar.
- `md–lg` (~768–1100px): sidebar behavior — comes out of sticky? stacks above? specify.
- `<md` (narrow): single column; sidebar stacks above content (calendar accessible, not buried).
- Note the existing breaks: medium column grid has `grid-cols-1 lg:grid-cols-3`.
- Large laptops + ultrawide: how far does content stretch, what MaxWidth UX (reading length
  guardrails) do you choose and why.

### 6. Engineering constraints (binding)
- Do NOT rewrite MonthWall, CalendarStrip, ScheduleSyncCard, DeadlinesCard, ScheduleCard,
  WarmCard, LifeRiver, or GoalCard — only move/replace/orchestrate.
- All localStorage in try/catch.
- CRLF preserved; surgical edits over whole-file rewrites.
- No new dependencies, no new IPC, no DB/schema changes (unless you find a real need —
  then say so explicitly and justify).
- No glassmorphism on chrome, one signal hue (amber) per surface, radii 8/12/pill, Inter +
  JetBrains Mono + Space Grotesk (max 2 per view).

## Interaction flows to specify

1. Initial load: default side, skeleton, first-paint stability (no layout jump).
2. Toggle side: instant flip, content preserved, no data refetch (state must not reset).
3. Select a day in CalendarStrip → selectedDate state updates → main column (schedule, goals,
   reflection) reflects it. Confirm this wiring stays intact when CalendarStrip moves into the sidebar.
4. MonthWall `onMonthChange` → month label/dates used anywhere upstream? Check and preserve.
5. Scroll: verify sticky sidebar doesn't overlap bottom full-width sections (ReflectionCard etc.)
   — decide if the sidebar stops sticking before the bottom, and how the boundary works.

## Anti-slop checklist (self-check before you finalize)

- Every element placement is justified by a purpose; no "looks nice" filler.
- No decorative gradient/glass/glow on chrome; amber used as the ONE signal hue.
- All 4 states (loading/empty/error/populated) specified.
- Sticky + scroll behavior defined at all 3 breakpoints, not just desktop.
- Interaction details (focus, hover, tooltip, transition durations) given in tokens/durations.
- The side-preference feature is full: toggle, persistence, default, edge case (corrupt
  localStorage value), responsive fallback.
- Nothing destructive: all existing components and data flows remain.

## Deliverable format (RESULT.md)

Return:
1. **Design decisions** — 1 short para each: layout rationale, sticky recipe, side-preference
   UX, responsive strategy, max-width choice.
2. **File-by-file spec** — for each touched file (`LifePage.tsx`, `GoldPage.tsx`, new files if
   any, CSS if any): exact diff descriptions (what to remove/change/add, where, with line anchors
   or JSX before/after), exact class lists, exact state shape with TypeScript types, exact
   localStorage key/flow.
3. **Component reuse table** — component → placement → unchanged? → any prop changes?
4. **Interaction spec** — the flows above enumerated as testable steps.
5. **Edge cases + acceptance criteria** — a numbered checklist Hands & Eyes will verify in the
   live app (including: content stretches past 1152px on a big viewport; sidebar visible ~1/3,
   sticky while main scrolls; side toggle persists after restart; all existing sections still
   render; no console errors; `prefers-reduced-motion` respected).