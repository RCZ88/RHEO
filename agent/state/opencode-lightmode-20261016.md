<!-- SESSION: opencode-lightmode-20261016 -->
<!-- AGENT: opencode | TERMINAL: lightmode | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-lightmode-20261016

> **STATUS:** completed | **UPDATED:** 2026-10-20T00:00Z

---

## CURRENT CYCLE (10)
**ROLE:** CZ, four messages: "where is the proper add-schedule feature", "I can only fill in schedules on the
day I don't have a schedule for", "no proper select day — why is it selected by the DATE", "still unable to set
up the alarm reminder", "the week/month/day switch does nothing", "where is the schedule's connection to the
rest", "the UI overflows and protrudes". Diagnosed all of them against source, fixed the three that were real
and unambiguous.

**STATUS:** completed
**IN FLIGHT:** none
**COMPLETED:**
- **No day control existed anywhere — verified, now fixed.** `WeekdayRail` (SchedulePage.tsx:85) was written for
  this page, its comment calls it "the page's only 'which day am I scheduling?' control", and it was **never
  rendered**. Its `blockCounts` half (line 448) was computed and unused. Meanwhile SchedulePage passed
  `hideDaySelector` (line 566), which suppresses the strip ScheduleCard already had (`ScheduleCard.tsx:222`).
  Net: zero day selectors, so `selectedDay` could only change by moving the DATE. Rail now mounted above the
  card whose title and form it drives; ScheduleCard's open add-form follows `selectedDay`.
- **Multiple blocks per day were never blocked** — checked the schema (`schedule_entries` has no unique
  constraint; `id TEXT PRIMARY KEY` only), the form (`handleSave` validates only title + `end > start`), and the
  handler (`goal-handlers.ts:2646` inserts a fresh row and returns `{success,id}`). The "only on an empty day"
  perception was the missing day control, not a write restriction.
- **LAYOUT ROOT CAUSE — the shell rendered every panel TWICE below 1100px.** `gridStyle` carried an **inline**
  `display:'grid'`, and an inline style outranks the `hidden` class, so the grid half was never hidden; the
  stacked half was only `hidden` ABOVE 1100px. Below 1100px both were in flow, the first still forced into its
  2–3 column template — duplication plus sideways overflow. Fixed: `display` removed from `gridStyle`, ONE
  container, media variant picks the mode, cells get `flex-1` so the narrow path fills height and scrolls
  inside. Also halves the mounts (calendar derives a month of events, 2 panels fetch, ScheduleCard runs a
  minute timer — all ran twice).
- **DISPROVED my own hypothesis, on purpose:** the `[@media(min-width:1100px)]:` arbitrary variant **does**
  compile under Tailwind **v4.2.1** (emits `@media (width >= 1100px)`; 3 rules in the built CSS, and every
  sibling shell class is present). Do not re-suspect it.
- **Alarm: the capability does not exist for schedule blocks.** Full column list has no reminder field; the
  ticker (`main/reminderTicker.ts`) reads ONLY `deadline_reminders` + `reminders`; `start_time` appears nowhere
  in it or in `notifications.ts`. The bell CZ clicks is a DEADLINE bell, and it silently no-ops when that
  deadline has no `due_date` (`DeadlinesCard.tsx:957` filters `&& d.due_date`, sheet returns `null`).
- **View toggle is decorative by construction:** `view` is used only for the button highlight and one dep
  array; `renderPanel(panel, slot)` never receives it. The page's own comment says `calendarView` is "a
  calendar view mode (spec §55)", and the spec's §5 says that calendar UI was **never built**.
- **COMMITTED `643d376`** on `wip/checkpoint-161026` — exactly 3 files. `src.zip` + `dist/src.zip` re-zipped
  (6.0 MB). Claim released.
  Scoped checks: esbuild transpile OK ×3; `TS2304` clean; **30/30** scheduleLayout tests; `validate:pages` =
  pre-existing `/agentic` only.

**NEXT ACTION:** CZ must **rebuild + relaunch** — `dist/index.html` is still the **2026-10-16 20:59** build and
`withPreset` is absent from it, so none of this is visible yet. `38123` = HTTP 000, app down.
Then decide the two widenings: (1) build the calendar's Month/Week/Day modes so the toggle is real;
(2) add a reminder column + ticker for schedule blocks (schema change).

**NOTES:** `agent/MEMORY.md` is now 23 entries against a documented max of 10 — appended one, moved nothing
(zero-destruction). Pre-existing, not mine: momentum's "schedule adherence" (30% weight, `main.ts:27524`) reads
`goals.linked_schedule_id`, which the schedule UI never writes (it writes `schedule_entries.goal_id`), so that
score cannot see a block created in the UI.

**PROCESSES:** started 0 long-lived | closed 0 | net 0 | census 14 node / 0 electron (peers exited; app down).

---
## HISTORY
- **Cycle 9 — Life-page wipe contained (COMMITTED `bed15d0`).** Not layout: `/life` boundary had no key, the
  other boundaries key by `location.pathname`, and `main.tsx:138` is `HashRouter` so pathname is always `/` —
  nothing could reset on a sub-tab switch, and `ErrorBoundary` renders `fixed inset-0 z-[9999]` over the whole
  viewport. Wrapped the content ternary in `<ErrorBoundary key={`${viewMode}:${pageTab}`}>`; proved both
  directions against the repo's real boundary. Also `AnimatePresence mode="wait"` ruled out.
- **Cycle 8 — light-mode fixes on CZ-named surfaces.** `.hue-*` nested inside `html.light {}` so dark painted
  nothing; MagicCard sheen tokenised; AIToolsTab usage panel tokenised. CZ's `kill_stale()` was killing builds.
