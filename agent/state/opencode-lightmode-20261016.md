<!-- SESSION: opencode-lightmode-20261016 -->
<!-- AGENT: opencode | TERMINAL: lightmode | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-lightmode-20261016

> **STATUS:** completed | **UPDATED:** 2026-10-20T11:35Z

---

## CURRENT CYCLE (11)
**ROLE:** CZ, four reports after cycle 10's build: "the calendar stuff still doesn't show up properly",
"the size doesn't match the space it has which is the container behind it", "still unable to add a new schedule
for a specific day — when I select the day there's STILL no button", "the layout setting other than the default
today-first doesn't work". Found the root cause of each in source and proved every fix in a real Chromium.

**STATUS:** completed
**IN FLIGHT:** none
**COMPLETED — all five committed in `294e066`:**
- **Calendar width (the "size doesn't match the container" report).** `CalendarSidebar` still carried the Gold
  page's sidebar contract `min-w-[420px] max-w-[560px] lg:flex-1`. In the schedule shell it is a PANEL whose
  width is set by the preset: at 318px it forced 420px (month clipped), at 943px it capped at 560px and floated
  in the middle of its own panel (~385px of empty background behind it). Now `w-full h-full min-h-0`; measured
  aside width == panel clientWidth at 631/943/1438/998.
- **Only 2 of 6 weeks were visible.** `MonthWall` sized cells by WIDTH (`aspect-square`), so the month needed
  ~700px in a 403px panel. The wall is a flex column now (grid takes the remaining height,
  `gridTemplateRows: repeat(6, minmax(24px,1fr))`), and scrolls (`overflow-y-auto`) when a panel is genuinely
  too short instead of clipping. Removed 88px of redundant chrome above the grid: the wall's own "Month Wall"
  title + event caption (the panel already says "Calendar"), a SECOND arrow row, and the colour legend.
- **Weekday letters sat 10px left of their columns** (drift up to 9px at the edges): the tile grid is padded
  inline, the letter row was not. Padded inline (NOT a new arbitrary class — see below). Drift is now 0.0 at
  every width.
- **"No button to add a schedule".** The only add affordances were `emptyAction` (rendered only when the day is
  EMPTY) and the card FOOTER, which sits below a `min-h-[320px]` body inside a scrolling panel — so any day that
  already had a block showed no way to add another. An always-visible "Add block" row now sits at the top of the
  card; verified inside the panel without scrolling at 1440x900.
- **Presets.** `identity()` zipped `PANEL_IDS` (calendar first) onto every preset's slot names. Today first's
  `left` is the AGENDA's full-height column and Week first's `top` is the WEEK timeline, so both rendered the
  calendar in the wrong slot — Calendar first and Today first looked identical, Week first was a 1440px
  calendar. New `PRESET_PANELS` follows SCHEDULE-LAYOUT-SYSTEM.md §Presets. Measured: today-first calendar now
  at x=642 (agenda left, full height); week-first calendar bottom-left 473x296.
- **Tests:** `clamp a stored size` used slot `left` + `PANEL_META.calendar.max`; `left` now holds agenda, so the
  premise changed. Moved to `right-top` (today-first's calendar slot). **30/30 pass.**

**VERIFICATION METHOD (new, reusable):** RHEO cannot be launched by an agent (§0-0z, tracker daemon is the sole
live writer), and Probe MCP is not in this session's catalog. So the REAL components (`ScheduleLayoutShell` +
`CalendarSidebar` + `MonthWall` + `ScheduleCard`) were bundled with esbuild (`--alias:@=./src`) and rendered in
Playwright's Chromium against the REAL built stylesheet (`dist/assets/index.DaWmMZQp.css`). Harness lives in
`/tmp/opencode/sched-layout/` (entry3.tsx + final2.mjs). Measured: 31/31 month tiles fully visible in
today-first/calendar-first/focus, 0px column drift, 0 console/page errors, no page scroll, no duplicate mounts.

**GOTCHA worth keeping:** the harness loads the PREBUILT css, so any Tailwind class that is not already in
`dist/assets/*.css` is invisible to it. `px-[10px]` was missing; `text-[11px]`, `min-h-0`, `flex-1`, `h-full`,
`overflow-y-auto`, `ws-scroll` were present. Anything new that must hold without a rebuild has to be an inline
style. Audit new classes with `grep -cF 'class-\[…\]' dist/assets/*.css` (escape brackets as they appear in CSS).

**NEXT ACTION:** CZ builds (`npm run build`) and opens Life → Schedule. Expect: the whole month visible in the
default preset with the agenda on the LEFT and the calendar top-right; "Add block" at the top of the card on a
day that already has blocks; Week first with the week board on top and the calendar bottom-left; Calendar first
with the calendar left. Then decide the two widenings that are still unbuilt: (1) the Month/Week/Day view
toggle is decorative (`view` never reaches `renderPanel`; spec §55 never built); (2) schedule-block alarms need
`ALTER TABLE schedule_entries ADD COLUMN remind_min` + a ticker pass (schema change, needs permission).

**NOTES:** The calendar's side toggle is now visually inert (`poseY` is computed and never used; the shell's
presets decide the side). Reported, not removed. The always-visible Add button and the footer "+ Add entry" are
now two entry points to the same action — left both. `agent/MEMORY.md` still 23 entries vs a documented max of
10; nothing moved (zero-destruction).

**PROCESSES:** started ~10 short-lived (esbuild ×4, vite-node ×2, Playwright chromium ×4) | all closed by
`browser.close()` / process exit | net 0 | census 14 node / 0 electron before and after (app down).

---
## HISTORY
- **Cycle 10 — day control + duplication (COMMITTED `643d376`, built by CZ at 09:59, exit 0 / 192 s / 0.11 GB).**
  `WeekdayRail` was written, documented as the page's only day control, and never mounted; `hideDaySelector`
  suppressed the one ScheduleCard had. Mounted it above the card; an open add-form now follows `selectedDay`.
  Layout: `gridStyle` carried an inline `display:'grid'` that outranked `hidden`, so below 1100px BOTH the grid
  and the stacked copy were in flow — every panel twice. One container now, media variant picks the mode.
  Disproved (do not re-suspect): the `[@media(min-width:1100px)]:` variant DOES compile under Tailwind v4.2.1.
- **Cycle 9 — Life-page wipe contained (COMMITTED `bed15d0`).** Not layout: `/life` had no ErrorBoundary, the
  outer boundary keys on `location.pathname`, and `main.tsx:138` uses `HashRouter` so pathname is always `/`.
  Keyed the boundary on `${viewMode}:${pageTab}`; proved both directions against the repo's real boundary.
