# PROMPT — Self Page Redesign

> **Copy everything below this line into another agent and send it.**
> A `CONTEXT_BUNDLE.md` sits next to this file. Attach it — the quotes in it are
> load-bearing and come from the real file.

---

## Role

You are a **Lead Designer and Engineer** for a personal-knowledge desktop app
(Electron + React + TypeScript + Tailwind). The Self page is the weakest screen
in the product. Redesign it properly.

Work in the repository. Read the files, change the code, build, and report what
you actually changed.

## The brief

`Life → Self` is meant to be the user's own model of themselves: **identity**,
plus the **Context Brain** — a knowledge graph of entities and facts that grows
as they use the app.

The user has said, across several sessions, in escalating terms:

> "the self page, still a mess"
>
> "it's like the self page is a fucking mess"
>
> "everything is stacked on top of one another"
>
> "why is everything so jumbled and broken"
>
> "use the horizontal space"

A previous agent already removed a `max-w-5xl` cap that was suppressing the
page's own `xl:` breakpoints. That was a genuine bug and it is fixed. **The
complaint survived the fix, so the cap was not the current cause.** Do not
re-diagnose it as a width problem and stop there.

## What you are working with

Read `CONTEXT_BUNDLE.md` §2 first. In short: `SelfOrchestrator.tsx` is 569 lines
and currently renders, inside one `xl:grid-cols-[340px_minmax(0,1fr)]` grid:

- **Left rail (340px):** Identity (`<ProfileTab />`) stacked above a card of
  brain `<StatPill>`s.
- **Right main (1fr):** the Knowledge Graph card (`<BrainVisualization>` +
  `<ActivityFeed>` in a `h-[clamp(420px,52vh,620px)]` row), then a collapsible
  "Memory & Brain Management" card.

There are **no `data-section` anchors** in the file, so deep links and the page
registry have nothing to bind to.

## Your job

**Design one replacement layout and implement it.**

Start by answering, in your own words and before you write any markup:

1. **What is the Self page for?** Not "show the brain". What does someone come
   here to do that no other tab does?
2. **Why does the current layout fail at that job?** Be specific and unflinching.
   A left rail of 340px holding the centrepiece of the product is a thesis
   statement about what the designer thought mattered.
3. **What is the ONE organising idea** that replaces "identity on the left,
   graph on the right"? Name it.

Then design against that idea, and **build it**.

## Non-negotiable constraints

These are not preferences. Breaking any of them regresses the app.

- **`reducedMotion` threading is load-bearing.** It is read once via
  `getReducedMotion()` and passed down. The ambient `NeuralFlow` layer must stay
  gated on it. Do not "simplify" it away.
- **Do not mount any R3F `<Canvas>`.** This machine has no GPU;
  `new WebGLRenderer()` throws inside a commit-phase effect and unmounts the
  subtree. If you ever need one, guard it with `webglSupported()` from
  `src/lib/webgl.ts`. The existing graph is Canvas2D — keep it that way.
- **Do not remove** `BrainVisualization`, `NeuralFlow`, or `ActivityFeed`. They
  are wired to real IPC data and to real physics.
- **The graph is sized by `width`/`height` props**, so its container must give
  it real pixels. A collapsed or zero-height parent silently produces a blank
  canvas — that is the most likely way you will think you "broke" it.
- **LAMINAR binds this surface:** one signal hue via `var(--page-accent)`;
  radii ∈ {8, 12, pill}; max 2 font families; **no `backdrop-blur` on chrome**
  (the current `CARD_CLASS` violates this — do not inherit it); no
  spring/bounce; no raw hex or `rgba()` in a `.tsx`; `lucide-react` only, never
  emoji; no decorative infinite loops in App UI.
- **No new runtime dependencies.** The project is on `motion` v12.
- Do not change the route or the tab id — a page-manifest validator checks them.
- Self owns **identity + the brain graph only**. It must not duplicate Covenant,
  Memories, Gold, Notes, Schedule or Habits. See `CONTEXT_BUNDLE.md` §7.

## What I expect you to add

**`data-section` anchors.** The file has none. Every section you create should
carry one, following the `data-section="life.<name>"` convention used by the
sibling tabs, so deep links and the page registry can bind to it. State the full
list of section ids you introduce.

## States — all of them, explicitly

The graph already handles empty / loading / error / populated. For **every other
element you add or move**, specify all five: empty, loading, error, populated,
partial. Plus hover, focus-visible, active, disabled on every interactive
element; ≥44px targets; keyboard navigation; and never losing a caption or a
stat on a failed write.

Remember this environment has an **empty database** in most test runs. An empty
state is not an edge case here, it is the default first impression. The current
page is mostly empty states stacked on top of each other — which is a large part
of why it reads as a mess.

## Motion

State a liveliness level with justification, a per-element inventory
(reactive / transitional / ambient), and the reduced-motion fallback. This is a
developer-facing tool surface: no bouncy springs, no ambient loops next to text
someone is reading.

## How to work

1. Read the files in `CONTEXT_BUNDLE.md` §9.
2. Answer the three questions above.
3. Plan the layout, then implement it in `SelfOrchestrator.tsx`.
4. Build with the project's coordinated wrapper — **never** plain
   `npm run build`:
   ```bash
   node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/run-exclusive.mjs build --forbid app -- npx vite build
   ```
   If the build dies silently during "rendering chunks", that is the OOM killer,
   not a code error. Re-run with a cap that fits the free memory:
   ```bash
   NODE_OPTIONS=--max-old-space-size=6144 node agent/.../run-exclusive.mjs build --forbid app -- npx vite build
   ```
5. Do not stop at "it compiles". Check the layout at **three widths** — 1280,
   1600 and 2048 — and report the measured column widths. A two-column layout
   that collapses to one stacked column at 1280 is exactly the bug that started
   this.
6. List what you tested and what you could not verify.

## Flag anything you had to guess

If you were unsure about a product decision — is the Identity card primary or
secondary? should the graph own the full width? does Memory & Brain Management
deserve its own row or belong inside the graph card? — say so explicitly rather
than silently choosing. Those are the user's calls, not yours.

## Definition of done

- The page has a clear organising idea you can state in one sentence.
- At 1280 / 1600 / 2048 the layout uses the horizontal space and nothing is
  collapsed to zero height.
- Every new section has a `data-section` anchor.
- All five states exist for every data-driven element.
- `reducedMotion` still gates the ambient layer.
- LAMINAR gates pass: no `backdrop-blur` on chrome, no raw hex in `.tsx`,
  radii within {8, 12, pill}, no spring.
- The build is green and you report the measured widths.

Do not write a design document instead of code. The bundle already has the
context. Build it.