# PROMPT — Halo Island: DATA CONTRACT + IMPLEMENTATION PLAN

> **Generated:** 2026-10-05 · **Supersedes nothing.** This is a *companion* to
> `halo-widget-curation-05102026/RESULT.md`, which remains the design authority.
> **Read both, plus this file. Where they conflict, they do not: RESULT decides
> *how it looks*, this file decides *where the numbers come from*.**

---

## 0. WHY THIS PROMPT EXISTS

The curation RESULT is an excellent **design** spec and a **deliberately incomplete data** spec.

Measured, not assumed:

```
RESULT.md  CREATE TABLE / ALTER TABLE mentions : 0
RESULT.md  IPC channel names                    : 0
RESULT.md  real table names cited               : deadlines (prose only)
§2 verdict states                             : "payload unverified"
```

§6 of that RESULT explicitly punts on data sourcing. So the spec tells us *exactly what a
`nextDeadline` card must contain* and *nothing about which table holds a deadline*. An
implementation agent is therefore forced to either **invent a channel** or **ship a card
that never populates**. Both happened.

This prompt closes that gap. It requires a **verified data contract** for every promoted
kind: the real table, the real columns, the real IPC channel, the real null semantics.

---

## 1. READ FIRST (in this order — do not skip, the order encodes precedence)

1. `agent/docs/generate-prompt-docs/halo-widget-curation-05102026/RESULT.md` — **design authority.** §7.1–§7.22 are binding laws, §2.3–§2.10 are per-kind binding content specs.
2. `agent/docs/generate-prompt-docs/halo-widget-curation-05102026/result.md` (lowercase) — geometry/lane authority where it is more specific than GPT's.
3. `agent/docs/HALO_ISLAND.md` — original Halo behaviour.
4. `design/design.md` — **LAMINAR. Overrides all of the above on any styling conflict.**
5. `agent/skills/paint/SKILL.md` — mandatory design pipeline.
6. `CONTEXT_BUNDLE.md` (same directory) — the app context this prompt is bound to.

**Precedence:** `design/design.md` → this file (data) → `RESULT.md` §7 (design laws) → everything else.

---

## 2. THE FAILURE THIS PROMPT MUST FIX (read carefully — this is the whole point)

The previous implementation cycle produced **green test suites and a broken product.**

What was claimed: *"static skeletons and error+Retry"*, *"all four states covered"*,
*"`aiUsage` + `hud` producers wired"*, *"19/19 browser assertions"*.

What was measured, on arrival:

```
AmbientCard.tsx   skeleton elements : 0
                 aria-busy        : 0
                 role=alert/err   : 0
slotModel.ts      `critical` lane  : resident   ← §7.14 FORBIDS this
RESULT §2.3–2.13  focus, nextDeadline, critical expanded views : never implemented
runtime           halo window visible to the user               : never verified
```

Three root causes. Each one is now a hard requirement below.

### 2.1 Root cause — tests validated the implementation, never the spec

The probe suite asserted that `slotModel.ts` behaved as `slotModel.ts` was written to
behave. It contained **no assertion derived from a numbered spec law.** A model that is
wrong in a self-consistent way passes 100% of those tests.

> **REQUIREMENT 2.1 — EVERY spec clause gets its own named assertion.**
> Each assertion MUST carry the clause id it enforces, e.g. `§7.16.loading` , `§7.14.rail.forbidden`.
> A test file that contains zero spec-clause ids is **not evidence of compliance** and must be rejected in review.

### 2.2 Root cause — design prose was read once and paraphrased, not enumerated

22 sections were summarised into a paragraph. Enumeration is the only defence.

> **REQUIREMENT 2.2 — DELIVER A CLAUSE LEDGER BEFORE ANY CODE.**
> Your first deliverable is a table: one row per spec clause, with
> `clause-id | verbatim requirement (quoted) | file:line | verified by which assertion`.
> Any clause you cannot map to code MUST be listed as `UNIMPLEMENTED` with a reason.
> **`UNIMPLEMENTED` is an acceptable deliverable. A silent omission is not.**

### 2.3 Root cause — runtime was never observed, so failures were invented

The stopwatch "works in source" conclusion was reached without ever reading the live
renderer's console, the Halo window's visibility, or the served bundle hash. Three claims
in one cycle were later shown false by direct measurement.

> **REQUIREMENT 2.3 — NO CLAIM WITHOUT A NAMED MEASUREMENT.**
> For every feature you report as working, your report MUST include the command or
> assertion that produced the evidence, and its raw output. "Should work", "should render",
> and "verified in source" are **not** acceptable verification language.
> If you cannot measure something, write `NOT VERIFIED` and name who must verify it.

---

## 3. HARD CONSTRAINTS (violating any of these fails the deliverable)

1. **Never fabricate a measurement.** A card with no data source renders its `unknown_literal` from §5.2. It does not render a plausible number. This is RESULT §5.3 and it is non-negotiable.
2. **`null` and `0` are different answers.** `null` = no row exists = unknown. `0` = a row exists and sums to zero. Collapsing them manufactures false data.
3. **Never invent a table, column, or IPC channel.** If the data does not exist, either (a) find the real source, or (b) return `null` and say the card needs a new producer. An invented column is worse than an honest empty card.
4. **No new IPC channel without a real table behind it** (except `focus` — see §5).
5. **Never write zeros in a fallback path to "be safe."** A crash in main is worse than an unknown value.
6. **Respect `useJson`** (`src/main.ts:2298`) — this app can run on a JSON store with no SQLite file at all. Every stat handler must early-return unknown when `useJson || !db`.
7. **Design laws are binding.** No spring/bounce, no hover-scale, no glass chrome, no decorative loops, radii ∈ `{8px, 12px, pill}`, max 2 font families, `prefers-reduced-motion` honoured.
8. **Do not delete or rebuild `dist/`** — it *is* the running application.

---

## 4. THE DATA CONTRACT — every promoted kind, one row, verified

For **each** kind in RESULT §2.3–§2.10, produce one row of this table. Fill it from
**reading the real code and the real schema.** If you cannot find a source, write
`NONE` — do not invent one.

| kind | real source (table/file) | exact columns read | IPC channel | null semantics | honest-empty literal (§5.2) |
|---|---|---|---|---|---|
| `stopwatch` | `src/lib/stopwatchStore.ts` | `productiveMs`,`distractingMs`,`activeTier`,`hasRealApp`,`runningSince` | none — renderer reads the shared store directly | `hasRealApp:false` ⇒ `No app detected` | quote from §5.2 |
| `dictation` | renderer-local `useSttFloat()` | — | none — `DictationIsland` owns the mic | idle ⇒ card absent | quote from §5.2 |
| `focus` | **TO BE DETERMINED** (see §5) | | | | |
| `now` | derived from `nowIso`/clock | — | none | | |
| `nextDeadline` | `deadlines` table **exists** — verify its columns | | | | |
| `aiUsage` | `ai_usage` table **exists** | `input_tokens`,`output_tokens`,`message_count`,`model`,`date` | `halo:get-ai-usage` | no row today ⇒ `null` | |
| `hud` | `terminal_sessions` **exists** | `updated_at` | `halo:get-terminal-usage` | | |
| `critical` | **NONE** — needs a producer | | | | |

### 4.1 Facts already established — verify, do not re-derive

```
ai_usage            EXISTS  input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
                           cost_usd, model, message_count, project_path, language,
                           avg_response_time_ms, date, tool, project_id
terminal_sessions   EXISTS  id, preset_id, project_id, agent, resume_id, topic,
                           working_directory, terminal_id, total_tokens, total_cost,
                           created_at, updated_at
deadlines           EXISTS  ← columns NOT yet verified; §4 requires you to verify them
reminders           EXISTS
schedule_entries    EXISTS
focus_sessions      DOES NOT EXIST  → see §5
tracking-heartbeat  EXISTS  safeSend(mainWindow, 'tracking-heartbeat',
                                    { isTracking, currentApp, uptime })
stopwatchStore      EXISTS  but main.ts pushes `stopwatch: null` to the Halo snapshot —
                           the renderer MUST read the shared store, not that field
```

**`deadlines` and `reminders` already exist** — so `nextDeadline` is a *read*, not a build.
**No focus table exists** — so `focus` is the one kind that may need a new producer (§5).

---

## 5. THE ONE GENUINE BUILD DECISION — `focus`

`focus` has no table. You must choose and justify one of:

- **(A) READ** an existing source of focus/ Pomodoro state if one exists anywhere in the app (search before concluding).
- **(B) BUILD** a minimal `focus_sessions` table + writer + reader, matching how the app already persists other per-day aggregates.
- **(C) CUT** the `focus` card and document the removal.

**Default if you do not have a strong reason: (A), then (C).** Do **not** default to (B) —
inventing a producer for a card is scope the user did not ask for. State your recommendation
in one line and implement it.

The same logic applies to `critical`: it has no producer at all. Recommend (C) unless a
real source exists, since a "critical" card with no way to ever be critical is dead weight.

---

## 6. IMPLEMENTATION PLAN — deliver these, in order

### Phase 0 — Clause ledger (§2.2)
The spec-id → code → assertion table. **Blocks all later phases.** No feature code before it.

### Phase 1 — Fix what is already broken
1. **`critical` is in the `resident` lane.** RESULT §7.14 `forbidden:` lists `critical` for the side rail. Move it to the transient lane.
2. **`AmbientCard` has no loading/error/empty states** (0 skeletons, 0 `aria-busy`, 0 `role="alert"`). Implement RESULT §7.16 (static blocks, `shimmer: false`) and §7.17 (message + Retry) using the exact literals from §5.2.
3. **Verify the stopwatch end-to-end.** The user's report is that it is not working. Establish the actual failure before changing anything — read the live renderer console, confirm the served bundle hash matches `dist/`, and confirm which store the Halo window actually reads. Do not assume the cause.

### Phase 2 — Real producers for the kinds that have sources
One handler per kind that has a real source. Each handler must:
- early-return `unknown` on `useJson || !db`
- use only verified columns
- distinguish `null` (no row) from `0` (row summing to zero)
- be wrapped so a throw can never take down the main process
- be exposed on **`haloBridge`**, not `deskflowAPI` — the Halo window loads `halo.html` and has **no** `deskflowAPI` at all. This is an easy and fatal mistake.

### Phase 3 — Wire cards to producers
Every card that has a producer renders it. Every card that does not renders its `unknown_literal`. A card must never be visible-but-empty: if it has no producer, either wire one or remove it from the roster.

### Phase 4 — Verify, and show the evidence
- Every spec clause has a named assertion (§2.1).
- The live Halo window has been observed rendering, with the served bundle hash printed.
- The stopwatch visibly ticks, and its value **equals** the dashboard's value at the same instant.
- A screenshot or DOM dump of the expanded shell at each state (loading/empty/error/populated).

---

## 7. DELIVERABLE FORMAT

```
1. CLAUSE LEDGER          — clause-id | verbatim quote | file:line | assertion name | status
2. DATA CONTRACT          — the §4 table, filled, with NONE where no source exists
3. FOCUS DECISION         — (A)/(B)/(C) + one-line justification
4. CHANGESET              — file:line per change, grouped by phase
5. EVIDENCE               — for each claim: the command run + its raw output
6. KNOWN GAPS             — what is still unwired and exactly why, each with an owner
```

**An honest `KNOWN GAPS` section is worth more than a complete-looking table.**
A fabricated row in the data contract is a worse failure than a missing one, because it
will be trusted.

---

## 8. WHAT THE USER ACTUALLY ASKED FOR (verbatim intent)

> *"implement the UI properly and good design and stuff, also fix whatever is broken"*
> *"make sure that all the features are implemented"*
> *"the stopwatch itself on the halo is not working"*

**So: the Halo must be VISIBLE, the STOPWATCH must TICK, and the design must match the
RESULT.** Not "the source looks right." Not "the tests pass." Visible, ticking, correct.
