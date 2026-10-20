<!-- SESSION: opencode-lightmode-20261016 -->
<!-- AGENT: opencode | TERMINAL: lightmode | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-lightmode-20261016

> **STATUS:** active | **UPDATED:** 2026-10-20T16:10Z

---

## CURRENT CYCLE (12)
**ROLE:** CZ: "no u haven't finished" + "the layout fix and everything?" + "the connections with the alarm stuff?".
Stopped reporting and shipped the fixes that do not need a schema change. Every number below is measured in
Chromium with the REAL components and the REAL stylesheet (`app4.css`/`app5.css` linked — see GOTCHA).

**DONE + MEASURED (this cycle):**
- **Month wall fits.** Three separate causes, all fixed: (a) `buildMonthGrid` padded every month to 42 cells and the
  grid hardcoded `repeat(6, …)` — October 2026 needs 5 rows, so an empty row burned 39px; (b) gaps 10→4 and
  padding 10→4 (the documented 24px tile minimum); (c) the wall's own `p-5` + `nav mb-3` = 48px of chrome →
  `padding: 4px 8px`, `marginBottom: 4`. Result at 1366x768: **wall 229px, content 228px, `wallScrolls: false`,
  31/31 tiles visible**, screenshot confirms the 25-31 row. 1440x900 and 1920x1080 also fit. 1280x720 still
  scrolls 24px (228 in 204) — the last row is reachable, not clipped.
- **The calendar panel was clipping its own content.** `CalendarSidebar`'s aside had `overflow-y-auto`, which makes
  a `flex-1` child size to CONTENT; the wall was laid out to y=530 inside a cell ending at y=481, so the last week
  was outside the cell (24/31 tiles). Now `overflow-hidden`; the wall is the only scroller. Measured: aside 265 in
  265, wall box inside the cell.
- **Picker: 35 cells** when the trailing week holds no day of the month. Popover 362 → 324px. Two-click range
  still 15→20 with the real CSS.
- **The span is no longer lost on "Done".** `DateTimeRangePicker` gained `onChange` (fires on every selection
  change); `DeadlinesCard.applySpan` is wired to BOTH `onApply` and `onChange`, so the modal always holds the
  current range.
- **Goals ↔ schedule are now reciprocal.** `schedule_entries.goal_id` was written; `goals.linked_schedule_id` —
  the pointer momentum's 30%-weight "schedule adherence" reads — never was, so its `linkedGoals` filter was
  permanently empty and adherence was pinned at the neutral 50. `add/update/delete-schedule-entry` now keep the
  goal's pointer in sync (clear old, set new, clear on delete).

**STILL OPEN (needs CZ's word):**
- **Day / Week / Month toggle is INERT.** `renderPanel(panel, slot)` gets no `view`; `CalendarSidebar` receives no
  `view`; `SchedulePage.tsx:271-273` admits it. Building the three views is a feature, not a fix.
- **Schedule-block alarms do not exist.** `schedule_entries` has no remind column; needs
  `ALTER TABLE schedule_entries ADD COLUMN remind_min` + a ticker pass + a form field. Schema change → permission.
  (Deadline reminders ARE real: own table, relative+absolute, ticker in `deadlineReminders.ts`.)
- **Light-mode scheme.** 128 hardcoded `zinc-*`: MonthWall 65, ScheduleLayoutShell 49, CalendarSidebar 14.
  Confirm CZ means the THEME.

**NEXT:** CZ builds (`npm run build`) — the running `dist` is 09:59 and none of this is in it. Then re-check
presets / Add block / month fit at his real window size.

**GOTCHA (cost a full pass):** the harness page must link BOTH `app.css` (the app's built CSS) and esbuild's
`appN.css` (component CSS such as `DateTimeRangePicker.css`). Without the second, `.dt-day` was unstyled at
15x20px and every geometry/drag conclusion drawn from it was false. Component day cells are selected by
`aria-label` ("October 29, 2026"), never `/^29$/` — leading-month cells duplicate the number.

**PROCESSES:** esbuild ×6 + Playwright chromium ×5, all short-lived and closed | net 0.

---
## HISTORY
- **Cycle 11 — calendar fit + presets + add button (COMMITTED `294e066`).** `CalendarSidebar` width band →
  `w-full h-full`; MonthWall flex column; always-visible "Add block"; `PRESET_PANELS` per spec; 30/30 tests.
- **Cycle 10 — day control + duplication (COMMITTED `643d376`, built 09:59).** `WeekdayRail` mounted; the open
  add-form follows `selectedDay`; one grid container (inline `display:grid` outranked `hidden` below 1100px).
  Disproved: the `[@media(min-width:1100px)]:` variant DOES compile on Tailwind 4.2.1.
