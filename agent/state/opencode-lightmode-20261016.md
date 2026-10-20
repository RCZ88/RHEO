<!-- SESSION: opencode-lightmode-20261016 -->
<!-- AGENT: opencode | TERMINAL: lightmode | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-lightmode-20261016

> **STATUS:** active | **UPDATED:** 2026-10-20T15:25Z

---

## CURRENT CYCLE (12)
**ROLE:** CZ asked whether the problems are known "clearly and in the most detail". Audited the three surfaces he
named against the real code and the live DB, and fixed two proven defects in the custom date picker.

**FIXED + VERIFIED (uncommitted at time of writing):**
- **Every deadline added through the form was saved ONE DAY EARLY.** `due_date` is a calendar DAY, but
  `DeadlinesCard.handleAdd` did `dueDate.toISOString()`: at UTC+7, picking 20 Oct stored
  `2026-10-19T17:00:00.000Z`. Live DB proves both shapes — 3 rows `YYYY-MM-DD`, 6 rows `...T17:00:00.000Z`.
  Canonical is date-only (`deadlineInstant` documents it, the AI tool schema says `YYYY-MM-DD`). New
  `localDayKey()` writes the picked day. Verified: `onApply` → local **2026-10-15 → 2026-10-20** (was 14 → 19).
- **A range could not be made by clicking.** `beginDrag` on pointerdown clobbered start/`selectingEnd` and `onClick`
  was skipped while dragging, so click 15 then 20 produced **20 → 20**. Now the pointerdown records an anchor only;
  the range moves after 10px; a `didDrag` ref stops the click from collapsing a drag; hover is inert
  (`e.buttons`); a window `pointerup` ends a drag released outside the grid. Verified in Chromium with the real
  component: two clicks 15 → 20; drag 15→29 = 15→29; backward 8→22; hover never moves the range; 0 errors.

**TWO THINGS I GOT WRONG THIS CYCLE (do not repeat):**
1. I called the drag "genuinely broken" from numbers taken with an **unlinked stylesheet**. The harness page linked
   the app CSS but not esbuild's `app5.css`, so the picker rendered unstyled at 15x20px/cell. With it linked:
   36x35 cells, popover 278x362, both drags exact, **0 px reflow** on selection. A component rendered without its
   stylesheet proves nothing about its geometry.
2. `9/2/2026` in one range was my selector: `text=/^29$/` matched BOTH Sept 29 (leading cell) and Oct 29. Pick
   picker days by `aria-label` ("October 29, 2026"), never by day number.

## THE THREE PROBLEMS CZ NAMED — STATUS
- **1a. Preset menu (Today first / Calendar first / Week first / Focus)** — source FIXED in `294e066`
  (`PRESET_PANELS` per spec §Presets; 4/4 panels measured in every preset). **Not in the running app**:
  `dist/index.html` is 09:59, the edits are 11:45–12:15, and `"Add block"` is absent from the bundle. Needs a build.
- **1b. Day / Week / Month toggle — INERT IN SOURCE, NOT FIXED.** `ScheduleLayoutShell.renderPanel(panel, slot)`
  has no `view`; `SchedulePage.tsx:271-273` admits it in a comment; `CalendarSidebar` receives no `view`. The
  spec's §55-67 calendar views were never built, so clicking only moves the highlight.
- **2. Custom pickers** — the two defects above are fixed. The other one, `DateTimePicker` (ReminderEditorSheet +
  DeadlinesCard), is UTC-safe: it emits local `YYYY-MM-DDTHH:mm` via `toLocalInput`. Remaining: the span modal's
  **"Done" closes without applying** a picked range.
- **3. UI cut off** — measured, two causes. (a) At 1366x768 the shell gets 638px after 130px Life chrome; the
  calendar cell is 309px and the wall's content is 343px, so it scrolls (343 vs 227 visible ≈ 3.5 weeks).
  (b) Fixable waste: `buildMonthGrid` pads to **42 cells** and the grid hardcodes `repeat(6, ...)`, but October
  2026 needs **5 rows** (Sep 27–Oct 31) — one empty row ≈ 17% of the wall. `buildCalendarDays` (picker) also pads
  to 42, and the popover is 362px tall. No page scroll at 1366/1280/1024/1440/1920; panels scroll internally (§17).

## TODO — ORDERED (work from this list)
1. **MonthWall: use 35 cells when the month fits** — drop a fully-empty trailing week and size
   `repeat(rows, minmax(24px,1fr))`. Direct cause of "cut off"; recovers ~17% height at every preset.
2. **Picker: 35 cells when the month fits** (`buildCalendarDays`) — one wasted row is where the bottom weeks are
   cut in a modal at 768px.
3. **Span modal "Done" must apply** (or be relabelled Cancel) — it discards a picked range today.
4. **Day/Week/Month toggle** — wire `view` into the calendar panel (month = MonthWall, week = selected-week
   strip, day = selected-day list), reusing existing primitives. Feature, not fix: needs CZ's go-ahead.
5. **Light-mode scheme** — 128 hardcoded `zinc-*`: MonthWall 65, ScheduleLayoutShell 49, CalendarSidebar 14
   (ScheduleCard 0). In light mode they paint dark greys on a light surface. Confirm CZ means the THEME before
   rewriting.
6. **CZ builds**, then re-check presets / Add block / month fit at his real window size.
7. Waiting on CZ: schedule-block alarms (`ALTER TABLE schedule_entries ADD COLUMN remind_min` + ticker);
   momentum adherence (`goals.linked_schedule_id` is never written by the schedule UI).

**NOT TESTED:** the app itself. No debug port (9222/9223/9229/8315 closed), Probe MCP absent from the catalog, and
launching would be a second writer on the live 122 MB profile while `rheo-tracker.service` is active.

**NEXT ACTION:** item 1 (MonthWall 35-cell months), then item 2, verified in the harness at 1366x768 / 1280x720 /
1440x900 with the real components and the real stylesheet.

**PROCESSES:** esbuild ×3 + Playwright chromium ×3, all short-lived and closed | net 0.

---
## HISTORY
- **Cycle 11 — calendar fit + presets + add button (COMMITTED `294e066`).** `CalendarSidebar`'s
  `min-w-[420px] max-w-[560px]` band → `w-full h-full`; MonthWall became a flex column sized by height, chrome
  reduced 88px, column drift 0.0; always-visible "Add block" row; `PRESET_PANELS` per spec; 30/30 tests.
- **Cycle 10 — day control + duplication (COMMITTED `643d376`, built 09:59).** `WeekdayRail` mounted; the open
  add-form follows `selectedDay`; one grid container (inline `display:grid` outranked `hidden`, mounting every
  panel twice below 1100px). Disproved: the `[@media(min-width:1100px)]:` variant DOES compile on Tailwind 4.2.1.
