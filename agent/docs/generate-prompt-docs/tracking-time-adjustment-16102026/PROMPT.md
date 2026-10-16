# TRACKING TIME ADJUSTMENT — Correction, Sleep Exclusion & UI Consolidation

> **You are the Lead Designer and Engineer for this entire feature.**
> Read `CONTEXT_BUNDLE.md` first — it is the source of truth for every code
> shape, schema, token and IPC channel referenced below. You have no access to
> the codebase; that file replaces it.
>
> **Deliver ONE comprehensive solution. Do not return Options A/B/C.**

---

## RAW REQUEST (VERBATIM — copied exactly, do not reinterpret)

> make suer theres no error or bugs comming from when like i suspend my laptop or sleep or shutdown or msht becasue like its not supposed to track it when its in those state. i wouldl ike so that im able to manually, and safely, from the app, be able to edit those, like adjust using some sort of sliders. properly. for each app .and it shold have a smart design system that is able to adjust the points aas accurate as possible somehow. so like its meant to predict the usages absed on the data that is error so it knows how to split the knewly adjusted total time into multiple session. this should be a feature of the app tracking too. but the problem is that we already have this like filling gpas feature, and like its a good one but i havent tried it yet bcs its like complex. so like @agent/skills/generate-prompt/ skill to adjust these stuff and like make the fill range and like the manual time button problem (which is that htey popup a same feature but different ui) make sure theres only 1 and like if htey are different feature which is lookks like they have hte fsam feature. make suret those are properly handled with alongisde the added feature that i requested which is those mnually eadjusted exisitng data aside from just adding new one

---

## CONTEXT

**The product.** RHEO is an Electron + React + TypeScript desktop time tracker
(SQLite, better-sqlite3). It records which app or website was foreground, for how
long, into a single `logs` table, and renders dashboards, timelines and per-app
breakdowns from it.

**The problem, in the user's terms.** Three distinct failures:

1. **Suspend/sleep/shutdown is being tracked as usage.** Source is proven, not
   suspected — see `CONTEXT_BUNDLE.md` §2. A daemon computes a sleep gap's
   duration *after* advancing its own clock, so the entire suspend span is
   credited to the last foreground app, truncated only by a 60-minute cap. The
   live database contains days claiming **139 hours** and **108 hours**. 133 rows
   carry an identical `duration_ms` of exactly 3600000 across just 9 timestamps.

2. **There is no way to correct recorded time.** The app can *add* manual spans
   (`manual-assign:*`) and can edit a single row through text `datetime-local`
   inputs in StatsPage — but there is **no slider-based editor for existing
   data**, and no ability to reflow a corrected total back into realistic
   multiple sessions. The user explicitly wants to fix *already recorded* data,
   not only add new data.

3. **Two UI families overlap and confuse.** There are **two different buttons
   both labelled exactly "Smart Fill"** that do different things, and the app
   header's tooltip describes the *other* button's behaviour. Three
   `GapFillModal`-family components are dead code that call IPC channels which do
   not exist. "Manual time" and "Fill a range" on ActivityPage are two UX fronts
   for the same `manual-assign:*` write path. Meanwhile `predict-day-gaps` — the
   closest thing to the user's requested "smart prediction" — is fully built and
   completely unreachable.

**Why it matters.** The tracker's numbers are its entire value. A day that
claims 139 hours is not a cosmetic bug; it destroys trust in every other number
in the app, and the user currently has no in-app way to repair it.

---

## THE MANDATE

Design the complete solution for **correction of recorded tracking time**,
delivered as one coherent feature:

> **A user can open any day, select any app or website, drag a slider to correct
> the recorded total, and have the app intelligently reflow that corrected total
> back into a realistic set of sessions — safely, reversibly, and without ever
> counting suspended time.**

…**and**, in the same design, consolidate the existing gap-fill / manual-time
surfaces into one unambiguous system, and close the sleep/suspend leak in both
writers.

---

## PART 1 — ENGINEERING TASK: THE DATA PROCESSING PIPELINE

Design the actual logic. Write the math. Do not describe it — specify it.

### 1.1 Close the sleep/suspend leak in BOTH writers

`CONTEXT_BUNDLE.md` §1 establishes there are **two writers** to the same table:
the Electron app, and the `rheo-tracker` daemon which owns the bridge port when
the app is closed. The app is already correct (§3); **the daemon is not** (§2).

- Specify the exact fix to the daemon's `flush()` / `feed()` ordering defect.
- The daemon must end a session at the **last successful observation**, never at
  `Date.now()`. Specify what state that requires (the daemon has no
  `lastSuccessfulObservationMs` variable today) and every place it must be updated.
- Specify the suspend/shutdown coverage gap: `powerMonitor` handles only
  `resume` and `unlock-screen`. Design what should happen on `suspend`,
  `shutdown`, and `lock-screen`, and state honestly which of those Electron
  actually guarantees to deliver on Linux/Wayland before the power is cut.
- Account for the **hard platform constraint**: `powerMonitor.getSystemIdleTime()`
  always returns `0` on Linux, so no design may depend on OS-native idle time.
- State the invariant that must hold so this cannot regress: *for every `logs`
  row, `timestamp + duration_ms` must not overlap the next row, and the sum of
  durations for any local day must never exceed 86400000 ms.*

### 1.2 The correction model

- Choose how a correction is represented so it is **distinguishable from
  fabricated `auto` data** and **reversible**. Justify the choice against the
  alternatives (new `source` value vs. ledger table vs. `corrected_from` column).
- Specify the migration: the `logs` table already has `source TEXT NOT NULL
  DEFAULT 'auto'` and triggers `trg_update_hourly` / `trg_update_daily` firing
  `AFTER INSERT`. Corrections are **UPDATEs**, so specify how the aggregates are
  recomputed after an update — the triggers will not fire for you.
- Specify the write path. Follow the two-table convention in §6b
  (`logs` row + `manual_time_assignments` row linked by `log_id`).

### 1.3 The prediction engine — "smart" splitting

This is the core intellectual work. The user's words: *"its meant to predict the
usages absed on the data that is error so it knows how to split the knewly
adjusted total time into multiple session."*

Given (a) a corrected total for an app on a day, and (b) the surviving uncorrupted
sessions for that same app across other days, **specify the algorithm** that
reflows that total into a plausible set of sessions:

- What is the input distribution, and how is it derived — session-length
  histogram? inter-session gap distribution? per-app per-hour-of-day weighting?
- Write the actual allocation math (weights, normalisation, rounding, and how the
  remainder is distributed so the sum matches the target **exactly**).
- Define a **confidence** measure for the prediction and specify how it is
  surfaced. With no history for an app, what happens? (The app must degrade to a
  defensible default, not to nonsense.)
- Specify bounds: no session may overlap another, none may extend outside the
  day, and the day total may not exceed 24 h.
- Note that `predict-day-gaps` (`main.ts:31473`), `useGapPredictions.ts` and
  `detect-usage-gaps` / `compute-adjacent-gaps` already exist. Say explicitly
  which to **reuse**, which to **extend**, and which to **retire** — and why.

### 1.4 Safety and reversibility

The user asked for this to be *"manual, and safely."* Define:

- The **undo** mechanism and its granularity.
- Whether corrections are previewed before commit, and what the preview shows.
- What protects a user from silently destroying real data.
- What happens to a correction when the underlying raw session is later deleted.

---

## PART 2 — DESIGN TASK: HIGH-FIDELITY VISUAL SPECIFICATION

Give **exact** values, not adjectives. This is a dark-only developer tool.

- **Layout** of the correction surface: dimensions, grid, spacing scale, what sits
  where, and the information hierarchy at a glance.
- **The slider itself**: track height, thumb size, handle visuals, filled vs
  unfilled treatment, tick marks, snap behaviour, the numeric readout, and the
  live delta indicator (original → corrected). Specify how multiple concurrent
  handles (per session) look and how they avoid colliding when sessions are short.
- **The prediction overlay**: how the predicted split is shown *before* commit so
  the user can judge it. How confidence is encoded without relying on colour alone.
- **Exact colour values** from the token set in `CONTEXT_BUNDLE.md` §8. One signal
  hue per surface. Remember the constitution in §11: radii **8/12/pill only**; no
  glassmorphism on chrome; no decorative glow or gradients; dark mode only.
- **Typography**: which of Inter / JetBrains Mono / Space Grotesk, at what sizes,
  weights and line-heights, and which numbers are monospaced.
- **Motion**: engine is `motion` v12 only — GSAP/Anime.js are not dependencies.
  Specify durations and easings using the `--ws-dur` / `--ws-ease` tokens, and
  specify the `prefers-reduced-motion` fallback. No spring/bounce on data surfaces.
- **States**: empty, loading, error, populated, and *prediction-unavailable*.

---

## PART 3 — UX TASK: INTERACTION FLOW, AND CONSOLIDATION

### 3.1 Consolidation — the user's explicit complaint

*"make the fill range and like the manual time button problem (which is that htey
popup a same feature but different ui) make sure theres only 1"*

Design the single unified surface. You must resolve, concretely:

- The two identical **"Smart Fill"** labels (`App.tsx:3787-3794` and
  `ExternalPage.tsx:1016-1023`) that do different things, including the tooltip
  that describes the wrong one.
- `ManualAssignModal` (1067 ln) and `ManualFillModal` (757 ln) — the two fronts to
  the same `manual-assign:*` IPC. Merge, or keep both with an unambiguous split?
  Decide, and justify from user intent rather than from file structure.
- `GapsListModal`, `AfkPromptModal` gap mode, `MissedTimePanel`,
  `SleepDetectionModal` — how do these relate to the unified surface?
- The three dead components (`GapFillModal.tsx`, `external/GapFillModal.tsx`,
  `GapFillDrawer.tsx`) call IPC channels that **do not exist**. State plainly what
  should happen to them.
- `TrackingCoverage`'s "Fill now" (`ActivityPage.tsx:152`) currently lands in
  `ManualFillModal`, bypassing the gap-fill queue. Where should it go?

⚠️ **Anything you propose to REMOVE must be called out explicitly in a
`## REMOVALS` section**, one line each, with the reason. Removal is a
user-approval gate; the implementer is forbidden from deleting without it.

### 3.2 The correction flow

Specify the complete interaction:

- **Entry points**, and how the user discovers this feature without being told.
- **What happens on hover, on click, on drag, on drag-release, on cancel.**
- **The per-app granularity** the user asked for (*"for each app"*): how does one
  select an app, and how does the UI scale from one app to a whole day?
- **Keyboard and accessibility**: focus order, arrow-key nudging of the slider,
  ARIA roles for a multi-handle control, screen-reader announcements of the
  corrected value, and a non-drag path to the same result.
- **State coverage**: empty day, a day with one session, a day with 200 sessions,
  a day mid-correction, a failed write.

---

## CONSTRAINTS (hard limits)

1. **Do not remove any existing user-facing feature without listing it under
   `## REMOVALS`.** The implementer is forbidden from deleting unlisted items.
2. **`src/components/ui/slider.tsx` already exists and `@radix-ui/react-slider`
   is installed.** Build on them. Do not add a new slider dependency.
3. **`logs.timestamp` is TEXT in ISO-8601** (`2026-10-14T15:52:46.375Z`), as is
   `manual_time_assignments.started_at`. Not a number, not unix seconds. Any
   date-bucketing SQL must use `substr(timestamp,1,10)`, **not**
   `date(timestamp,'unixepoch')`, which returns blank on these values.
4. **The `AFTER INSERT` triggers `trg_update_hourly` / `trg_update_daily`
   maintain the aggregates.** Your correction path uses UPDATE, so you must
   specify the recomputation explicitly.
5. **Both writers must be fixed.** A change that only fixes the app leaves the bug
   alive whenever the daemon owns the port.
6. **`powerMonitor.getSystemIdleTime()` returns 0 on Linux.** No design may depend
   on it. The machine is native Wayland / KDE Plasma.
7. **Dark mode only.** Radii 8/12/pill only. One signal hue per surface. No
   glassmorphism on chrome. No decorative glow/gradients. No spring/bounce.
8. **`motion` v12 is the only animation engine.** GSAP and Anime.js are not
   dependencies — do not import them.
9. **No hand-rolled Recharts.** Charts and data-viz come from `@bklit` only.
10. **All IPC handlers return the app's existing result/error wrapper shape.**
    Read §6a for the convention; match it.

---

## WHAT TO REUSE (do not reinvent — all verified present)

| Component | Source | Use for |
|---|---|---|
| `slider` | `@shadcn` (already local at `src/components/ui/slider.tsx`) | the correction control |
| `dialog` | `@shadcn` | correction modal shell |
| `drawer` | `@shadcn` | bottom-sheet variant for narrow windows |
| `alert-dialog` | `@shadcn` | destructive-action confirmation |
| `badge` | `@shadcn` | `source='auto'` vs `'manual'` vs `'corrected'` chips |
| `progress` | `@shadcn` | coverage / confidence bar |
| `tooltip` | `@shadcn` | explain the prediction |
| `tabs` | `@shadcn` | per-app / per-day switching |
| `scroll-area` | `@shadcn` | long session lists |
| `empty` | `@shadcn` | empty states |
| `chart-utils` | `@bklit` | Intl formatters + time-series decimation |
| `chart-parent-size` | `@bklit` | responsive chart wrapper |
| `chart-animation` | `@bklit` | enter transitions, clip reveals |
| `reference-area` | `@bklit` | shaded target ranges on time-series |
| `shimmering-text` | `@bklit` | loading labels |

---

## SKILLS TO APPLY

These are the design skills available in this project. Apply them; do not
enumerate them back:

1. **Frontend Design** — RHEO component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty / loading / error / populated states, progressive disclosure, hierarchy, feedback
3. **Impeccable** — typography, colour, spatial, motion, interaction, responsive, UX writing; 27 anti-patterns
4. **Motion — Bring the UI Alive** — liveliness levels (L1/L2/L3), motion taxonomy, recipes, reduced-motion fallback
5. **UI UX Pro Max** — industry design rules for developer tools and analytics surfaces
6. **Design Taste System** — variance knobs, anti-repetition rules
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist
8. **Taste Skill** — variance / motion / density knobs, aesthetic variant matrix

---

## ANTI-SLOP CHECKLIST (mandatory before you return)

For every component you specify:

1. Re-skin to RHEO tokens (`--ws-*`, `--color-*` from §8). No raw hex outside that set.
2. Max `rounded-xl`; max `p-5` padding.
3. Dark mode only.
4. Fonts: Inter + JetBrains Mono + Space Grotesk — **max two per view**.
5. Honours `prefers-reduced-motion`.
6. No glassmorphism on chrome, no decorative glow, no gradients.
7. No spring or bounce on data surfaces.
8. Every state covered: empty, loading, error, populated, prediction-unavailable.
9. Every proposed removal listed under `## REMOVALS`.

---

## OUTPUT FORMAT

Return a single Markdown specification, organised as:

```
# Tracking Time Adjustment — Design & Engineering Specification

## 1. Root Cause Summary
## 2. Data Model & Migration
## 3. The Prediction Algorithm  (with the actual math)
## 4. Safety, Undo & Reversibility
## 5. Sleep / Suspend / Shutdown Handling  (both writers)
## 6. The Consolidated UI  (component tree, exact tokens, exact values)
## 7. The Correction Flow  (step by step, incl. keyboard + a11y)
## 8. Backend Specification  (IPC channels, handler signatures, SQL)
## 9. REMOVALS  (one line each — user-approval gate)
## 10. Open Risks & Assumptions
```

Omit no section. Where you are uncertain, state the uncertainty and the
assumption you are proceeding under — do not silently guess.
