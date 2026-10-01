# Goal-as-the-Hub — PAINT plan

> Problems **188**–**192** in `agent/problems.json`. Ordered by dependency, not by appeal.
> Each stage states its PAINT phase, the artifact it produces, and its gate.

---

## The thesis (P0)

The Life page is supposed to work like this: **a Goal is a container.** You open a goal, and
inside it live the tasks, the habits, the schedule blocks, the deadlines, the lessons, the
sleep debt — everything that serves that goal. Not five sibling pages that each own their own
copy of "today".

Right now the Life page is the opposite of that: **Schedule is its own page, Habits is its own
page, Gold is its own page**, and the thing that is supposed to tie them together — the goal —
is a read-only list you can't attach anything to.

### What I found (verified, not guessed)

| # | Finding | Evidence |
|---|---------|----------|
| 1 | 21 of 27 goals have `id = NULL` | `SELECT COUNT(*) FROM goals WHERE id IS NULL` → 21; with-id → 6 |
| 2 | `loadGoals` silently drops them | `GoldPage.tsx` `if (!g.id) continue;` |
| 3 | 11 more goals hidden by design | `GoldPage.tsx:1009` `g.status !== 'suggested'`, no "N suggested" affordance |
| 4 | Nothing ever sets `goal_id` | `goal_id set = 0` in todos, deadlines, schedule_entries, reminders |
| 5 | Response shape mismatch | handler returns `{parentLtgs, childGoals, schedules}`; explorer reads `res.connections.parentLTG / linkedGoal / scheduleBlocks` |
| 6 | Hub panel mounted in 1 of 3 pages | only `HabitsPage.tsx:910`, reachable only via HierarchyTree click |
| 7 | Hub scope is 7 sections, not 13 | `ConnectionExplorer` sections: Todos, Subtasks, Schedule, Deadlines, Parent, Linked Goal, Linked Habit |
| 8 | 3 of 13 hub loaders call non-existent preload methods | `CrossFeatureLinkPicker` calls `activityGoalGetAll`, `financeGoalGetAll`, `getIdeProjects` — **none exist in preload** (real: `getProjects`/`getAllProjects`) |
| 9 | Two schedule cards do the same job | `ScheduleCard` (interactive) + `ScheduleSyncCard` (read-only) both render the same day |
| 10 | 2–4 date navigators per page | Gold: `CalendarStrip` + `CalendarSidebar`. Schedule: `DeadlineRadar` + `CalendarSidebar` + BellBoard `quickDates` |

**Conclusion: the hub is ~90% built and 100% unreachable.** Five independent causes stack.
Fixing any one alone changes nothing visible — which is why it reads as "missing."

### Data reality check (do not build on empty tables)

| Hub target | Table | Rows | Verdict |
|---|---|---|---|
| Todos | `todos` | 0 | build, will populate via UI |
| Deadlines | `deadlines` | 6 | build |
| Schedule | `schedule_entries` | 2 | build |
| Reminders | `reminders` | 0 | build |
| Notes | `notes` | 6 | build |
| Learn | `learn_progress` | 1 | build, sparse |
| Finance | `finance_subscriptions` | 6 | build |
| IDE | via `get-projects` | — | **fix the broken method name first** |
| Focus | `focus_goal_config` | — | build |
| Brain | `brain_memories` | 0 | build, empty |
| **Sleep** | **NO TABLE** | — | **cannot build — the feature does not exist** |

> **Honest constraint:** you asked to connect to *sleep*. There is no sleep table and no sleep
> feature in the data model. I will wire the 10 targets that exist and leave Sleep visibly
> absent rather than inventing an empty section. Say the word if you want me to design it.

### Character (P1)

`variance=3, motion=5, density=7` — clamped low. LAMINAR is a hard contract on App UI, so no
variance games. This is a dense data tool, not a product page.

### Concept (P2)

**No signature element.** This surface prioritises density over delight. The one idea is
structural, not visual: *the goal is the folder, and everything else is a file inside it.*

---

## Stage 1 — Make the goals real (problems 188.1, 189)

*PAINT phases: P0, P5 only. Backend + states, no new visual design.*

**1a. `save-goal` must never write a NULL id.** Generate one when absent, mirroring the
existing `sch_`/`dl_`/`rem_` id scheme in the same file.

**1b. Backfill the 21 existing NULL ids.**
⚠️ **This is a DB write. I will back up `deskflow-data.db` first, show you the manifest, and
wait for your explicit OK before touching it.** (`db-guard.mjs backup`)

**1c. Surface the 11 `suggested` goals** in a collapsible "Suggested (11)" section with
Accept / Dismiss per row, instead of filtering them out permanently. This is where AI-suggested
goals were meant to be reviewed — the accept path is also missing.

**Gate:** `SELECT COUNT(*) FROM goals WHERE id IS NULL` → 0, and every goal renders on Gold.

---

## Stage 2 — Make the hub return something (problem 188.2)

*PAINT phases: P4 (tokens), P5 (states).*

**2a. Pick ONE response shape and align both sides.** The handler is already the source of
truth (it's a SQL query); the explorer is the thing that's wrong. Change the explorer to read
`parentLtgs`, `childGoals`, `todos`, `schedules`, `deadlines` directly — and add `children`
(the subtasks key it already looks for) as an alias of `childGoals` only if genuinely distinct.
No wrapper object.

**2b. Fix the 3 broken preload calls** in `CrossFeatureLinkPicker`:
`getIdeProjects` → `getProjects`; confirm real names for `activityGoalGetAll` /
`financeGoalGetAll` and map them, or drop those two options until they have a real API.

**2c. Extend `getGoalConnections` to all 10 live targets** — query todos, schedules, deadlines,
reminders, notes, learn, finance, ide, focus. Return real rows, not hardcoded `[]`.

**2d. Rebuild `ConnectionExplorer` as the hub panel** with all 5 states per section (empty with
a CTA, loading skeleton, error + retry, populated, overflow-truncated), each section a
disclosure, `role="alert"` on errors, focus rings on `var(--page-accent)`.

**Gate:** clicking any goal opens a panel listing its real linked entities. Empty ones explain
what *would* be there and offer the link control.

---

## Stage 3 — Make things linkable (problem 188.3)

*PAINT phases: P3 (source), P5 (states).*

The hub can only show links that exist. Every editor needs a way to create one:

- **Schedule block** — `ScheduleCard` already has a goal select ✓ (but it was writing a CSS var
  to the DB; already fixed)
- **Todo** — `LinkPicker` already handles goal/deadline/schedule/todo ✓
- **Deadline** — `DeadlinesCard` has no goal picker → add one
- **Reminder** — `BellBoard` has no goal picker → add one
- **Note / Learn / Finance** — reachable from the hub panel's own "+ link" per section

Reuse the existing `LinkPicker` and `CrossFeatureLinkPicker` components rather than
hand-rolling new ones (PAINT Gate B).

**Gate:** from a goal, link a todo and a schedule block; both appear in the hub panel and both
survive a reload.

---

## Stage 4 — Put the hub where it's used (problem 188.4)

*PAINT phases: P4, P5.*

Mount the hub panel on **GoldPage** and **SchedulePage**, not just Habits. Entry points:
a "Connections" affordance on every `GoalCard`, plus the existing HierarchyTree node click.

**Gate:** the hub opens from Gold and from Schedule, not only Habits.

---

## Stage 5 — Remove the duplication (problems 190, 191)

*PAINT phases: P0, P4, P7.*

**5a. Two schedule cards → one.** Keep `ScheduleCard` (it owns the only working add path);
delete `ScheduleSyncCard` and its render site.

**5b. Date navigators → one per page.** Collapse Gold's `CalendarStrip` + `CalendarSidebar`
and Schedule's `DeadlineRadar` + `CalendarSidebar` + BellBoard `quickDates` into a single
navigator per page. `DeadlineRadar`'s mark dots can stay *only* if it stops also being a
second way to change the date.

**Gate:** one way to do each job, verified by clicking.

---

## Stage 6 — Verify for real (problem 192)

Everything so far is static. `probe_discover` has found **0** Electron instances with a debug
port across three attempts this session, so I have never clicked any of it.

**This needs you to launch the app**, or explicitly approve me starting it:
`node agent-coordination/run-exclusive.mjs app --forbid build app -- npm start`

Then: add a goal → open hub → link a todo + a block → reload → confirm it persisted. And the
Stage-2 reminder date+time and the todo popup, which are also unrun.

---

## Order and rationale

`1 → 2 → 3 → 4 → 5 → 6`

You said pick. Here's why:

- **Stage 1 first** because 21 invisible goals make every later stage unverifiable — you
  literally cannot click a goal that isn't rendered.
- **Stage 2 before 3** because the response shape is a contract; building link *creators*
  against a broken *reader* means debugging two things at once.
- **Stage 5 last** because it's pure removal, it's safe to do at any time, and doing it first
  would churn the same files Stage 2–4 are editing.
- **Stage 6 is not optional** and I will not claim PASS without it.

## What I need from you

1. **OK to back up + backfill the NULL goal ids?** (a DB write; backup first, manifest shown)
2. **Launch the app at the end so I can verify**, or approve me starting it.
3. **Sleep**: no table exists. Skip it, or design the feature first?