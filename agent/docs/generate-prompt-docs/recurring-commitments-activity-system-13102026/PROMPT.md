# PROMPT — Recurring Commitments / Activity System (Schedule Sheet)

> **Read `CONTEXT_BUNDLE.md` in this same folder FIRST.** It is the source of truth
> for file paths, line numbers, types, IPC endpoints and design tokens. Do not
> guess at code you have not read there.

---

## Raw Request (Verbatim)

> "like i would like to hae like lessons or like occuring stuff. its like part and similar to a phase, butl like its specific more like the clubs that we joined , the classes that we take, etc"

---

## The Mandate

You are the **Lead Designer and Engineer** for this feature. Own the entire
solution: data model, backend, component architecture, visual spec, interaction
design. **Do not present options.** Produce one design and justify it. Where a
choice is a judgement call, state the choice and its reason.

**Design a complete "Activities" system for clubs, classes, lessons,
and recurring commitments** — specific scheduled commitments managed in a
sheet on the **Schedule page**, backed by `schedule_entries` with a `series_id`.

---

## Scope (Human-Centric UX)

**Activities sheet and Add form only.** Do not touch other Schedule panels or the
4 layout presets.

**Primary goals:**
1. Get a full semester in during one sitting
2. See all commitments for a month or semester at a glance

---

## CHANGES THAT OVERRIDE THE EARLIER PROMPT

### 1. HOME
Not Gold > Phases. Add an **"Activities" button in the Schedule page header**.
It opens a **sheet that slides in from the right, ~60% width**.

- **Gold > Today** stays read-only (shows today's occurrences only).
- **Phase cards** show linked activity chips only (read-only).

### 2. SEVERAL TIMES PER ACTIVITY (Series)
- Add **`series_id TEXT` (nullable)** to `schedule_entries`.
  - Rows with the same `series_id` are **ONE activity**, one session per row.
  - `NULL series_id` = an activity with one session (all old rows remain unchanged).
- The form **edits the whole series**. Title, category, dates, location, phase and goal link are written to **every row of the series**.
  - Each row keeps its own `day_of_week`, `start_time`, `end_time`.
- **"Skip this day"** only affects the one session row (its `exceptions` list).
- The **list and timetable** show **one activity with its sessions**, not many separate rows.

### 3. SEMESTER SETTING
- Store `{ name, startDate, endDate }` in the **existing settings storage** (same place as the schedule layout — `compositionsSettingsGet/Set` with key `schedule:layout:v1` or a new key). **No new table**.
- New activities **copy these dates** into their `start_date` and `end_date` (or the equivalent fields on schedule_entries). Show **"(semester)"** next to them in the form.
- Changing the semester later does **NOT** change old activities.
- **First time with no semester set**: show a small skippable card **"Set your semester dates"** in the sheet. Until it is set, the **"This semester" filter is disabled** with a tooltip that says why.

### 4. THE SHEET
**Header:** range chip `[This month | This semester | All]`, segmented `[Timetable | List]`, primary button **"+ Add"**.

- **Timetable:**
  - Columns: Mon–Fri (Sat/Sun **only if** something is on them).
  - Rows: time.
  - Blocks use `ENTITY_COLORS.schedule`.
  - Show **category as a Lucide icon plus text**, never color only.
  - **Overlapping blocks split the column width**.
  - Click a block → open the form.
  - Block menu: **Edit, Skip this day, End on date, Archive**.

- **List:**
  - Grouped by category.
  - Each card shows: title, times, recurrence pill, place, phase chip.

- **Past activities are hidden.** A **"Show ended" toggle** at the bottom shows them.

- **Range rules:**
  - **This month** = has an occurrence this month.
  - **This semester** = active inside the semester dates.
  - **All** = everything not archived.

### 5. THE ADD FORM
- **Up front:** title, type chips (Class, Club, Sport, Other), days, start and end time.
- **"+ Add another time"** adds a second session (days + time).
- **Live line under the times:** `"Next: Mon 12, Wed 14, Mon 19 Oct"` (next 3 occurrences).
- **Dates line:** `"Runs: <start> to <end> (semester)"`. Click to change.
- **Overlap check:** if any session overlaps another activity, show an **amber line** `"Overlaps: <title>, <day> <time>"`. It **never blocks saving**.
- **"More details" (collapsed):** place, teacher, phase, goal, notes.
- **Buttons:**
  - **"Save and add another"** (keeps the form open, clears the title only, keeps type and dates).
  - **"Save"** (primary).
- Do **not** clear the form on an error.
- Warn if the user closes with unsaved changes.
- After save: **toast "Added <title>" with Undo**.
- **Confirm before "End on date" and "Archive".**
  - "End on date" is the main action and **keeps past occurrences**.
  - "Archive" hides everything.

### 6. STATES (all of them, for the sheet, timetable and list)
- **Empty:** icon + `"No activities yet. Add a class or a club you go to every week."` + `"+ Add"` button.
- **Loading:** skeleton shaped like the timetable grid and the list cards.
- **Error:** `"Couldn't load your activities."` + Retry button. No raw errors.
- **Partial:** long titles truncate with a tooltip. Many activities in one cell use `"+N more"`.

### 7. UX CHECKS
- All targets **at least 44px**.
- Hover, focus, active and disabled states on everything clickable.
- Transitions **150–300ms**.
- Keyboard works: **Enter saves, Esc closes** (with the unsaved warning), **Tab order follows the form top to bottom**.
- After the work, run the skill's **pre-return checklist** and send me a **short UX decision log** (scope, primary action, states added, what is hidden behind disclosure).

---

## ADD TO STEP 0 (Required Confirmations)

**f)** Where is the settings storage that holds the schedule layout?
**g)** Show how the form would write a series (several rows) in **ONE transaction** so a failed save cannot leave half an activity.

---

## Required Design

### A. Data Model — `schedule_entries` with `series_id`

**Migration (in `src/main.ts`):**
```sql
-- Add series_id and exceptions columns to existing schedule_entries
ALTER TABLE schedule_entries ADD COLUMN series_id TEXT;
ALTER TABLE schedule_entries ADD COLUMN exceptions TEXT DEFAULT '[]';  -- JSON array of skipped dates (YYYY-MM-DD)
CREATE INDEX IF NOT EXISTS idx_schedule_entries_series ON schedule_entries(series_id);
```

**TypeScript types:**
```ts
// src/types/schedule-activity.ts
export interface ScheduleActivitySeries {
  seriesId: string;                    // the series_id value
  title: string;
  category: 'class' | 'club' | 'sport' | 'other';
  sessions: ScheduleSession[];         // all rows sharing this series_id
  startDate: string;                   // earliest session start_date
  endDate: string | null;              // latest session end_date (or null)
  location?: string;
  instructor?: string;
  linkedPhaseId?: string;
  linkedGoalIds?: string[];
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSession {
  id: string;                          // row id
  dayOfWeek: number;                   // 0=Sun..6=Sat
  startTime: string;                   // HH:MM
  endTime: string;                     // HH:MM
  exceptions: string[];                // skipped dates (YYYY-MM-DD)
}
```

**No new table.** Everything lives in `schedule_entries`. The series is a virtual grouping by `series_id`.

---

### B. Backend (DB + IPC)

**IPC handlers** (`src/infrastructure/ipc/goal-handlers.ts`):

| Handler | Purpose |
|---|---|
| `scheduleActivity:listSeries` | Returns grouped series for the sheet (filters: range chip, archived, category) |
| `scheduleActivity:getSeries` | One series by series_id |
| `scheduleActivity:createSeries` | **Transactional** — inserts N rows with same `series_id` |
| `scheduleActivity:updateSeries` | Updates all rows of a series (title, category, dates, links, location) |
| `scheduleActivity:deleteSeries` | Soft: set `archived=1` on all rows (or new `archived` column) |
| `scheduleActivity:skipOccurrence` | Adds a date to `exceptions` on ONE row |
| `scheduleActivity:endSeries` | Sets `end_date` on all rows (keeps past occurrences) |
| `scheduleActivity:setSemester` / `scheduleActivity:getSemester` | Settings storage |

**Transaction pattern for create/update (MUST use):**
```ts
const createSeries = async (series: Omit<ScheduleActivitySeries, 'seriesId'>) => {
  const seriesId = 'ser_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const stmt = db.prepare(`
    INSERT INTO schedule_entries (id, series_id, title, day_of_week, start_time, end_time, category, location, instructor, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((sessions) => {
    sessions.forEach(s => stmt.run(
      'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      seriesId,
      series.title,
      s.dayOfWeek,
      s.startTime,
      s.endTime,
      series.category,
      series.location || null,
      series.instructor || null,
      series.startDate,
      series.endDate
    ));
  });
  tx(series.sessions);
  return { success: true, seriesId };
};
```

**Preload** (`src/preload.ts`): expose all above.

---

### C. Calendar Integration (Read-Only)

**MonthWall** and **WeekBoard** render sessions from `schedule_entries` where `series_id IS NOT NULL` exactly like existing entries — **no new render logic needed**. They already read `schedule_entries`.

**WeekBoard** (`src/features/warmth/schedule/WeekBoard.tsx`) already renders schedule entries as time blocks.

**SchedulePage presets** — activities appear in "Upcoming" and "Agenda" via existing data flow.

**Gold > Today** shows today's occurrences (filter `schedule_entries` by date).

**Phase cards** show linked activity chips (read `series_id` → filter by `linkedPhaseId` on the series).

---

### D. UI Components

**New component folder**: `src/features/warmth/schedule/activities/`

| Component | Responsibility |
|---|---|
| `ActivitiesSheet` | Right slide-in sheet (~60%), header with range chips + view toggle + Add button |
| `ActivitiesTimetable` | Mon–Fri grid, overlapping blocks split width, click→form, block menu |
| `ActivitiesList` | Grouped by category, cards with title, times, recurrence pill, place, phase chip |
| `ActivityForm` | Create/edit series (type chips, days, times, +Add another time, live next-occurrences, overlap check, More details) |
| `SemesterCard` | Skippable card when no semester set |

**Reuse existing patterns:**
- `WarmCard` shell
- `ENTITY_COLORS.schedule` for timetable blocks
- `EntityChip` for category/phase/goal links
- `LinkPicker` for phase/goal linking
- `PhaseFormDialog` pattern for form (modal-like, validation, save/delete)
- `ScheduleLayoutShell` header pattern for the Activities button

---

### E. Semester Setting

**Storage:** `compositionsSettingsGet('schedule:semester')` / `compositionsSettingsSet('schedule:semester', { name, startDate, endDate })`

**First-time flow:** If no semester set, sheet shows skippable `SemesterCard` at top. "This semester" range chip disabled with tooltip `"Set your semester dates to use this filter"`.

---

### F. Visual Specs

- **Category icons + text** (never color-only):
  - class: `<BookOpen />` "Class"
  - club: `<Users />` "Club"
  - sport: `<Dumbbell />` "Sport"
  - other: `<Circle />` "Other"

- **Timetable blocks**: `ENTITY_COLORS.schedule` background, split width on overlap.

- **Recurrence pill**: "Mon/Wed 18:30–20:00" format.

- **Phase chip**: `EntityChip kind="phase"`.

- **Empty state**: icon + "No activities yet. Add a class or a club you go to every week." + "+ Add" button.

- **Spacing**: 4 / 8 / 12 / 16 / 24. Radius: up to `rounded-xl`.

- **Light/dark**: use `ENTITY_COLORS.schedule.light` variant.

---

### G. Constraints (Hard)

- **No new table.** Uses `schedule_entries` + `series_id`.
- **No change to `Goal` or `life_phases` schema.**
- **No new IPC beyond what's listed.**
- **Activities are NOT goals** — no `done`, `progress`, `target`.
- **Linking is bidirectional** — phase knows its activities via `linkedPhaseId` on series.
- **Archived = soft delete** — never hard delete user data.
- **Tailwind v4** — only valid classes.

---

## Output Format

Produce a single technical specification containing:

1. **Complete TypeScript types** — `ScheduleActivitySeries`, `ScheduleSession`
2. **DB migration SQL** — exact `ALTER TABLE` + index matching `src/main.ts` pattern
3. **IPC handler implementations** — all 8 handlers with exact signatures + **transactional create/update**
4. **Preload additions** — exact lines to add to `src/preload.ts`
5. **Component source** — full `ActivitiesSheet`, `ActivitiesTimetable`, `ActivitiesList`, `ActivityForm`, `SemesterCard` with all 4 states
6. **Calendar integration notes** — confirm existing render works, no changes needed
7. **Semester setting** — exact settings key and first-time flow
8. **Migration order** — step-by-step where each step leaves app working
9. **Explicit removal list** — none expected (additive only)
10. **Verification plan** — what to check after each step
11. **UX decision log** — scope, primary action, states added, what is hidden behind disclosure

---

## Available Skills & Components

Load these before designing:
1. **Frontend Design** — DeskFlow component patterns, tokens, glass cards
2. **Human-Centric UX** — 4 states (empty/loading/error/populated), progressive disclosure
3. **Impeccable** — 27 anti-patterns, color/typography/space/motion
4. **Motion** — L1: Composed (slide-in sheet, 200ms, no bounce)
5. **UI UX Pro Max** — personal productivity rules
6. **Design Taste System** — variance/motion/density knobs
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

**Reuse, don't rebuild:** `WarmCard`, `EntityChip`, `LinkPicker`, `ENTITY_COLORS`, `ScheduleLayoutShell` header button pattern, `compositionsSettingsGet/Set`.
---

> **Spec index:** `agent/docs/SPECS-INDEX.md`
