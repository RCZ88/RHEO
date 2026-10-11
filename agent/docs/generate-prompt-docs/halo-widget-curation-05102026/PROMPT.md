# PROMPT — Halo Island: decide which features get a slot

## Raw Request

> where did we do the plannings for like the widgets ont he halo? wheres the prompt for that?

> okay write it. make surfe to use teh @agent/skills/generate-prompt/SKILL.md for hte context bundle to include all of hte features that the app have fokr hte agent to decide which are the best ot inlcude on the halo

---

## Context

**Read `CONTEXT_BUNDLE.md` FIRST and treat it as the source of truth.** It contains the
verbatim source for the activity vocabulary, the priority table, the geometry budget, the
design tokens, the platform constraints, the 8 dashboard widget IPC contracts, and the
already-rejected list. You have no access to this codebase — the bundle replaces that gap.

DeskFlow (an Electron + React productivity tracker) has a working Halo / Dynamic-Island
overlay pinned to the top centre of the screen, expanding on hover. It is specified to
4,195 lines in `agent/docs/HALO_ISLAND.md`. It currently renders **two** things: a
stopwatch hero and a dictation island.

The island's **vocabulary was already built for a larger surface** — 17 activity kinds, a
12-tier priority table, a router, and a stable-id helper all exist. They shipped with only
two activities wired up, because `PRIORITY` selects exactly **one** winner and nothing
composites, slots, or rotates. **There is no widget layer, because there is no slot
model for one to occupy.**

**What you are deciding:** which of the app's features earn a place on the island, and —
more importantly — the compositing model that makes more than one thing possible at once.

---

## The Mandate

Act as **Lead Product Designer and Interaction Engineer** for the Halo. Design the
complete, production-ready **curation + slot model**: which activities are promoted, what
the compact and expanded surfaces show for each, how they share the fixed 520×300 canvas,
how they rotate when idle, and what each one does when clicked.

**Do not offer options.** No "Option A / B / C", no menu, no "here are three approaches
for you to choose". You own the decision. Produce **one** design, and defend it. Where
you reject something, state the rejection and its reason. Where you are uncertain, commit
to the answer you would ship and flag the residual risk in one line.

**The slot model is the deliverable that matters most.** A ranked list of nice-to-have
features is worthless without a rule for how they coexist inside 232×40 compact and a
520×300 canvas. Get that right and the feature selection follows from it.

---

## Requirement Checklist

### A. The slot model (highest priority)

1. **How many activities are visible simultaneously?** Compact is 232×40 — roughly an
   icon, a label, and a value. State the exact composition for 1, 2, and 3 concurrent.
2. **Zone assignment.** The type is `OverlayEdge = 'top' | 'left' | 'right'`. Which
   activities occupy the centre (the island proper) versus the left/right wings?
3. **Honour the two-lane split.** `stopwatch` is both `HERO_KIND` and ranked `500`. The
   codebase is explicit that *priority is an interruption policy and the hero accumulates,
   it does not interrupt*. Design persistent-resident and interrupting-toast as separate
   lanes that cannot evict each other.
4. **Eviction rules.** When a new activity arrives, what is queued, what is replaced, what
   is dropped, and what is never dropped.
5. **Use the hooks that exist.** `minimumDisplayMs` is declared on `IslandActivity` and
   **no publisher uses it** — it is the anti-yank guard for rotation. `replaceGroup`
   coalesces update bursts. Specify how your model uses both.

### B. Per-activity verdict — all 17 kinds

The 17 `ActivityKind` values in the bundle §2.1. For **every one**, give:
- **Verdict:** `keep` / `promote` / `reject`
- **Reason:** one line
- **If promoted:** the exact content of its compact (232×40) rendering and its expanded
  rendering, plus the target route on click.
- **If rejected:** which of the app's features it was standing in for, and why the island
  is the wrong surface for it.

Note in your verdict that `battery` and `download` are desktop-OS concerns on a Linux
Wayland Electron app. Reject them if you agree — but say so explicitly rather than
silently ignoring them.

### C. Rotation and dwell

1. **Carousel membership** — which activities participate when the island is otherwise
   idle.
2. **Dwell time** per card, in ms, as a real number.
3. **Interrupt precedence** — what preempts a rotation mid-cycle.
4. **Collapse interaction** — `stepHover` collapses the island on pointer-leave, and the
   main process polls at 120ms idle / 40ms expanded. A rotation must not be left in a
   broken half-state when the pointer leaves mid-turn. Specify the behaviour.

### D. Honesty and empty states — non-negotiable

This rule has **already been paid for in blood**. The Halo stopwatch ships a fixture, and
the honest version renders `No app detected` and `0:00:00` rather than a plausible-looking
fake.

For each promoted activity, specify the **exact literal string** rendered when its data is
absent, distinguishing:
- genuinely zero → render `0`
- unknown / not yet loaded → render the explicit sentence, never `0`

Also carry the dashboard's mandatory 4-state matrix: **loading** (shimmer-free skeleton),
**empty** (explicit sentence, styled as data state not error), **error** (message + retry,
never silently empty), **populated**.

### E. Backend audit — trace it, do not assume it

For each promoted activity, verify against `CONTEXT_BUNDLE.md` §4.1 and state:

| Activity | IPC channel | Real / Stub / Absent | Notes |
|---|---|---|---|

The bundle flags the dashboard widget payload shapes as `FILL FROM DUMP` — i.e.
**intended, not verified.** Where a shape is unverified, say so and require verification
before that activity ships. **Do not design a UI for a backend that does not exist**, and
do not invent IPC handlers.

### F. Pinning

`pinnedActivity` (priority 300) exists in the type with **no pinning UX specified**. Define
what pinning means, how a user pins, where the affordance lives, and how a pin interacts
with priority and with dismissal.

### G. Colour and domain discipline

Amber (`--halo-signal`) is the **time** domain; clay (`--halo-focus`) is the **speech**
domain. One signal hue per surface. For each promoted activity, assign it to an existing
domain or justify a new hue from the token set. **One hue per activity — not a rainbow.**

### H. Compact-is-not-a-card

State plainly what a 232×40 compact slot can and cannot hold. If a promoted activity cannot
survive at that size, either specify the truncated form honestly or reject it — do not
specify a dashboard card and hope.

---

## Skills — load these before designing

Per `generate-prompt` §A, for a UI/planning task of this kind:

1. **Frontend Design** — DeskFlow component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions, 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels (L1/L2/L3), motion taxonomy, recipes
5. **UI UX Pro Max** — industry rules for developer tools, AI/ML, analytics
6. **Design Taste System** — master aggregator, variance knobs, anti-repetition rules
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

**For this task specifically, #2 and #7 matter most.** The 4-state honesty rule (§D) and the
anti-slop rejections (§Anti-Slop below) are the two places this design is most likely to go
wrong.

### MCP note — query these yourself

The agent that generated this bundle **did not have MCP access**, so no component
inventory is asserted here. Fabricating one would produce exactly the "plausible-sounding
instead of correct" failure the skill warns about. **Query them yourself** before pulling
anything, and record what you actually found:

| Server | What to look for | Verdict prior |
|---|---|---|
| `shadcn` | slots, popover, tooltip, progress, toggle-group for slot chrome | likely useful |
| `magicui` | Animated Beam, Border Beam, Number Ticker | **Border Beam / Number Ticker already REJECTED** — do not re-propose |
| `lucide` | icon names per activity kind | needed — every activity needs an icon |
| `reactbits` | 135+ components | **decorative/loop-adjacent motion is banned** — expect rejection |
| `iconify` | 200k+ icons fallback | fallback only |

Record the real component names you find and what you used each for. If you pull nothing,
say so.

---

## Anti-Slop Checklist — apply after any MCP-sourced component

Already litigated in `RESULT_widgets.md` and binding here:

1. Re-skin to DeskFlow LAMINAR tokens — never a component's default palette
2. `rounded-xl` maximum on cards; island radii are **8 / 12 / pill only**
3. **No `backdrop-blur` glass chrome** — LAMINAR solid-surface law
4. **No `whileHover={{scale}}`** — hover-scale is banned; hairline brightening only
5. No spring, no bounce — `design/design.md` overrides the HALO spec's spring guidance
6. No animated counters, no decorative gradients
7. Max **2** font families in the expanded island
8. **No emoji** — lucide icons only
9. Honour `prefers-reduced-motion` (`IslandState.reducedMotion` already exists)

---

## Constraints

- **Hard limits only:** fixed 520×300 OS canvas; compact 232×40; no new IPC handlers and
  no `main.ts` edits (report gaps instead — that file is P0 and owned elsewhere).
- Reuse `ActivityKind` values as they exist. If you need a genuinely new activity, justify
  it against the 17 already present — adding a 18th is a last resort, not a shortcut.
- All ids derive from `stableId()` in `activityPriority.ts`.
- Everything lives in `src/shared/halo/` for pure logic; the renderer reads it from
  `src/features/halo/`.
- **Do not invent data.** Every number on the island must trace to a real IPC channel.

---

## Output Format

Markdown, with these sections in order:

1. **Slot Model** — zones, concurrency, lane separation, eviction
2. **Activity Verdicts** — a table for all 17 kinds, then detail per promoted kind
3. **Rotation & Dwell**
4. **Click-Through Contract** — table: kind → action → route
5. **Honest Empty States** — table: kind → exact literal string
6. **Backend Audit** — table: kind → channel → real/stub/absent
7. **Design Specification** — compact and expanded layouts, per promoted kind, with exact px
8. **Rejections** — every rejected kind and kept-off feature, with reasons
9. **Risks** — what breaks if this is wrong, ranked

Save the result as `RESULT.md` in this same folder, verbatim.

---

*Bundle: `agent/docs/generate-prompt-docs/halo-widget-curation-05102026/CONTEXT_BUNDLE.md`*