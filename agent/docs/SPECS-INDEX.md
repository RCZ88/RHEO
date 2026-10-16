# SPECS INDEX — the three big Life/Schedule adjustments

> **START HERE.** One entry point for every feature spec in this repo, with status.
> If you are handing a spec to Claude/GPT, the full paths are in the table.

Last updated: 2026-10-14

---

## The three specs

| # | Feature | Spec file | Code status |
|---|---|---|---|
| **1** | **Schedule layout system** (4 presets, swap, hide, resize) | `agent/docs/SCHEDULE-LAYOUT-SYSTEM.md` | ✅ Functionally complete |
| **2** | **Life page consolidation** (8→7 tabs, Gold sub-views) | `agent/docs/generate-prompt-docs/life-habits-gold-dedup-13102026/PROMPT.md` | ❌ **0% — not started** |
| **3** | **Recurring Activities** (classes, clubs, series) | `agent/docs/generate-prompt-docs/recurring-commitments-activity-system-13102026/PROMPT.md` | ⚠️ Built, 2 bugs open |

### Full paths to hand to Claude

```
agent/docs/SCHEDULE-LAYOUT-SYSTEM.md

agent/docs/generate-prompt-docs/life-habits-gold-dedup-13102026/PROMPT.md
agent/docs/generate-prompt-docs/life-habits-gold-dedup-13102026/CONTEXT_BUNDLE.md

agent/docs/generate-prompt-docs/recurring-commitments-activity-system-13102026/PROMPT.md
agent/docs/generate-prompt-docs/recurring-commitments-activity-system-13102026/CONTEXT_BUNDLE.md
```

---

## ⚠️ READ THIS BEFORE SENDING ANY PROMPT

**Specs 2 and 3 have no `RESULT.md`.** They contain only `PROMPT.md` +
`CONTEXT_BUNDLE.md`, which per the `generate-prompt` skill are:

| File | Direction | Author |
|---|---|---|
| `PROMPT.md` | input — **to** Claude/GPT | opencode (me) |
| `CONTEXT_BUNDLE.md` | reference — code excerpts | opencode (me) |
| `RESULT.md` | output — **from** Claude/GPT | **does not exist** |

So there is **no Claude-authored design spec** for #2 or #3. The design
decisions you see in those prompts came from **you**, pasted directly into chat,
and were never written back into a file.

**Practical consequence:** if you send `PROMPT.md` to Claude, Claude gets an
*instruction set*, not a *draft*. That is fine — it is how the skill is meant to
be used — but expect Claude to produce a `RESULT.md` this time. Save it in the
same folder as `RESULT.md` so the next session can implement against it.

---

## Spec 2 — Life page consolidation (the one that is 0%)

### Decision record (your words, 2026-10-13, never written to a file until now)

- Tabs 8 → 7. Remove **Habits**. Keep Covenant, Memories, Gold, Notes, Schedule, Training, Self.
- Gold gets a segmented control, 4 sub-views, remembers the last one, default **Today**:
  - **Today** — daily goals, habits (HabitTracker), suggested queue, MissedGoalRecoveryBanner
  - **Vault** — long-term goals, HierarchyTree, ConnectionExplorer
  - **Phases** — phase list, create + edit (**ONE** `PhaseFormDialog`)
  - **Review** — WeekReview, ReflectionCard
- Habits render **only** in Gold > Today.
- `period === 'longterm'` **never** in the routines list. Use Gold's correct `isWeeklyish`.
- Phases have **one** create path in Gold > Phases. River is read-only + a "Manage in Gold" link.
- Training stays a tab. Reuse shared PhaseCard/WeeklyReview, or rename and say so.

### Build order (from the spec — Step 1 is safe and non-visual)

1. **Shared helpers** — `src/lib/goalDates.ts`, `goalSpecies.ts`, `goalReflection.ts`.
   Replace every local copy in HabitsPage / GoldPage / TrainingPage.
   *This alone fixes the live longterm-duplicate bug.*
2. **Shared UI** — StatPill, DayRing, WeekReview into `src/components/goals/`.
   Move `CAT_META` into `CategoryColors.ts`. Four states each.
3. **Split GoldPage** — `GoldPage.tsx` (shell) + `GoldToday/Vault/Phases/Review.tsx`, ≤500 lines each.
4. **Remove the Habits tab** — `PageTab`, `PAGE_TABS`, **both** deep-nav maps
   (`handleOpenPage` ~line 246, `redirectToPage` ~line 293), registry entry.
5. **Phases** — drop Gold's duplicate list, make River read-only.
6. **Training** — reconcile PhaseCard / WeeklyReview.
7. Ask before deleting `src/features/warmth/schedule/Todos.tsx.backup`.

### Step 0 — the answers (asked 2026-10-13, never delivered until now)

**a) HabitsPage-only capabilities** — imported by HabitsPage, not GoldPage:
- `HabitTracker` — the habit streak widget. **GoldPage does not import it.**
  → must move to Gold > Today (it is the reason the Habits tab exists).
- `HierarchyTree` — **GoldPage does not import it either.** It belongs to Vault per the decision.
- `LifeRiver` — HabitsPage embeds a river instance.
- `confetti` — celebration effect on completion.

HabitsPage-local components: `DayRing`, `StatPill`, `WeekReview` — **all three already exist in GoldPage too**, so deleting the local copies is safe.

**b) River's phase create/edit vs Gold's** — NOT yet verified. Still open.

**c) Is Training's `PhaseCard` the same concept as a life phase** — NOT yet verified. Still open.

**d) Where the last-open tab is saved, and every `'habits'` consumer** — NOT yet verified. Still open.

> These three are the remaining Step 0 items. Say the word and I'll finish them.

---

## Spec 3 — Recurring Activities

Built: DB migration (`series_id`, `exceptions`, `archived`, `instructor`,
`linked_phase_id`, `linked_goal_ids`, `start_date`, `end_date`), 8 IPC handlers,
preload bindings, and 5 components in `src/features/warmth/schedule/activities/`.

### Open bugs — fix before trusting it

1. **Semester never persists.** `goal-handlers.ts:2486,2495` call
   `(global as any).deskflowAPI`, which is a **renderer** object and does not
   exist in the main process. Must query the `composition_settings` table directly
   (see `src/domains/compositions/compositionSchema.ts:130`).
2. **"End on date" hides instead of ends.** `goal-handlers.ts:2479` sets
   `archived = 1` alongside `end_date`. Spec says end **keeps past occurrences**
   and is distinct from Archive.
3. **`updateSeries` is not transactional.** The `DELETE FROM schedule_entries`
   sits *outside* the `db.transaction`, so a mid-swap failure can leave a series
   with rows deleted and none inserted. `createSeries` *is* correctly transactional.

### Spec gaps not yet implemented

- Block menu (Edit / Skip this day / End on date / Archive) + confirms
- Toast **with Undo**
- Phase chip on list cards
- "+ Add" button inside the empty state

---

## Spec 1 — Schedule layout

Complete and **mounted**. Engine `layout.ts` (27 tests), shell
`ScheduleLayoutShell.tsx`, wired into `SchedulePage.tsx` with all 4 panels.

Follows `SCHEDULE-LAYOUT-SYSTEM.md` build order 1–5. Known cosmetic debt: 4 unused
variables in the shell (`PANEL_IDS`, `CELL_SPANS`, `visible`, `isDrawerSlot`).

---

## House rules for this work

- **Only CZ builds.** `npm run build` is CZ's alone (AGENTS.md §0-0). An agent
  verifies with scoped `tsc`, scoped `esbuild`, and `npm run validate:pages`.
- `npm run validate:pages` currently reports 2 **pre-existing** failures —
  `/time-tools` and `/agentic` have no manifest. Not caused by this work.
- **No new IPC, no DB migration, no `Goal` interface change, no data deletion**
  for the Life dedup work.
- Anything removed gets listed back to CZ for confirmation before deletion.