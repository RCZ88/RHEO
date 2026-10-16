# Work list — 2026-10-14

## The 3 specs — status

### 1. Schedule layout (`agent/docs/SCHEDULE-LAYOUT-SYSTEM.md`)
- ✅ Engine `layout.ts` — 27 tests pass
- ✅ Shell `ScheduleLayoutShell.tsx` built **and mounted**
- ✅ 3 real bugs fixed on wiring: `r.width`→`r.extent` (drag was dead),
  aria-label used the imported *function* not the local bool, missing import/state
- 🟡 4 unused vars remain (`PANEL_IDS`, `CELL_SPANS`, `visible`, `isDrawerSlot`)

### 2. Life page dedup (`.../life-habits-gold-dedup-13102026/`) — Claude's spec
- ✅ **Step 1 DONE** — 3 shared modules, all 9 helpers deduped, longterm bug fixed
- ⬜ Step 2 — shared UI (StatPill, DayRing, WeekReview) → `src/components/goals/`, CAT_META → tokens
- ⬜ Step 3 — split GoldPage into 5 files, ≤500 lines each
- ⬜ Step 4 — move habits to Gold>Today, remove Habits tab, **both** deep-nav maps,
  registry, redirect old `habits` links
- ⬜ Step 5 — phases: one create path in Gold>Phases, River read-only
- ⬜ Step 6 — Training: reconcile PhaseCard / WeeklyReview
- ⬜ Step 7 — ASK before deleting `Todos.tsx.backup`

### 3. Activities (`.../recurring-commitments-activity-system-13102026/`)
- ✅ Built: migration + 8 IPC + preload + 5 components + header button
- 🔴 **BUG 1** semester never persists — `goal-handlers.ts:2486,2495` call
  `(global as any).deskflowAPI`, a RENDERER object. Must query `composition_settings`
  directly (`src/domains/compositions/compositionSchema.ts:130`)
- 🔴 **BUG 2** `goal-handlers.ts:2479` `endSeries` sets `archived=1` → hides instead of
  ending. Spec says end KEEPS past occurrences, distinct from Archive
- 🔴 **BUG 3** `updateSeries` DELETE sits OUTSIDE the `db.transaction` → can leave a
  series with rows deleted and none inserted. `createSeries` IS correct
- ⬜ Missing: block menu (Edit/Skip this day/End on date/Archive) + confirms
- ⬜ Missing: toast **with Undo**
- ⬜ Missing: phase chip on list cards, "+ Add" in empty state

---

## Open bug — Monday Oct 5 shows 3 blocks for one class

`schedule_entries` has **3 rows, all Mon 09:20–11:00**, entered by hand weeks apart:

| Entered | Title | id |
|---|---|---|
| 2026-08-26 | Campus | `sch_1787756892803_1ksuzy` |
| 2026-09-20 | AlgoProg | `sch_9920926237_q7ke5x` |
| 2026-10-09 | ALGO PROG | `sch_1791535136816_w8wk5z` |

Entries are weekly-recurring by `day_of_week`, so all 3 render every Monday.

- ❌ **They do NOT appear in the Schedule day sheet** — user cannot see or delete them there
- ✅ They DO appear on the calendar
- 🔎 Filter is `ScheduleCard.tsx:119` — `showAll ? true : e.day_of_week === selectedDay`
- 🔎 `deleteScheduleEntry` exists (`SchedulePage.tsx:409`) and ScheduleCard has a
  Trash2 button (line 379, two-click confirm)
- ❓ **UNVERIFIED:** whether the Agenda panel is simply hidden by the active layout
  preset, or whether the filter is actually dropping them. Did not confirm.

**Blocker:** the user needs to SEE them in the Schedule so they can delete them.
If the panel is hidden, that is the bug. If the filter drops them, that is the bug.

---

## Also done this session (not in any spec)
- ✅ Donut track colour — was hardcoded `rgba()` at 14 call sites, so dark border on
  light + invisible white track. Now `color-mix(… var(--color-foreground) 14% …)`.
  Zero literals left.
- ✅ `spec-copy` clipboard helper + both skills updated to require it
- ✅ `agent/docs/SPECS-INDEX.md` — one place to find all 3 specs

## Needs CZ
`npm run build` — applies the 8 Activities column migrations and the Step 1
helpers. Agents don't build (§0-0). Nothing is runtime-verified.