<!-- SESSION: opencode-heatmap-accuracy-20261006 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: App Tracker -->

# Agent State — opencode-heatmap-accuracy-20261006

> **STATUS:** completed | **UPDATED:** 2026-10-06T14:25:00+07:00

---

## CURRENT CYCLE (1)
**ROLE:** Diagnose "dashboard heatmap doesn't match the Activity page" + fix the staleness
**STATUS:** completed
**IN FLIGHT:**
- (none)
**COMPLETED:**
- Read the LIVE database (not the stale `~/.config/RHEO` copy — see NOTES) and measured
  every window both surfaces claim to show.
- Root cause #1 FIXED: `DashboardPage`'s heatmap log load ran `useEffect(..., [])`, i.e.
  ONCE per mount, so `cells` was a snapshot frozen when the dashboard opened. App's
  `allLogs` (what the Activity page reads) is refreshed on every tracker event.
  Fix: `src/App.tsx` now passes `sharedLogs={allLogs}` (the prop DashboardPage:332 already
  declared and NOTHING ever passed) and the effect deps became `[usableShared]`.
- Verified: esbuild transform clean on both files; scoped `tsc` (files: DashboardPage +
  deskflow-api.d.ts, so it was NOT poisoned by the syntax errors) reports 0 errors in my
  edited range. Full-graph esbuild bundle cannot complete on Linux (case-sensitivity +
  `?raw` loaders) — environmental, pre-existing.
**NEXT ACTION:** CZ rebuilds, then confirms the heatmap's "This week" header reads the
  tracked total and that today's column grows while the app stays open.
**NOTES:**
- MEASURED 2026-10-06 14:20 WIB, live DB `…/Application Data/RHEO/deskflow-data.db`:
  heatmap week (Sun Oct 4 -> Sat Oct 10) = **16.27 h across 26 lit cells**;
  Activity `'week'` (Mon Oct 5 -> Sun Oct 11) = **8.38 h**; Activity `'7day'`
  (Sep 30 -> Oct 6) = **35.56 h**. Per-day `logs`: Oct 4 473.2m, Oct 5 312.2m, Oct 6 190.5m.
- **TWO DEFECTS FOUND, REPORTED, NOT FIXED** (both need a product decision and neither
  is verifiable without a build):
  1. **Three different "this week".** Heatmap is SUNDAY-start
     (`heatmapWeekDates`: `- weekStart.getDay()`); `lib/dateRange.ts` `'week'` is
     MONDAY-start (`day === 0 ? 6 : day - 1`); `'7day'` is rolling. So "This week" on
     two surfaces is two different 7-day sets — 16.3 h vs 8.4 h vs 35.6 h above.
  2. **The OTHER dashboard heatmap path is UTC-bucketed.** `stats_hourly`/`stats_daily`
     are filled by a trigger using `DATE(NEW.timestamp)` (UTC) while every renderer
     compares against a LOCAL `YYYY-MM-DD`. On UTC+7 that misattributes 00:00-07:00 to
     the previous day — measured 25 min skew on Oct 4. `weeklyHeatmap` /
     `hourlyHeatmap` / the timeline bars read those tables; the modal heatmap reads
     `logs` in local time. Fixing it means re-bucketing, i.e. invalidating every
     historical aggregate — CZ's call, not a silent renderer patch.
- The heatmap's own per-cell maths are CORRECT: no capped/zero/duplicate rows in this
  week (max row 33.6 min vs the 60 min cap), all 32863 timestamps well-formed ISO, cells
  bucketed by local `getDay()`/`getHours()`.
- `src/pages/SettingsPage.tsx` currently has 6 SYNTAX errors, which makes any repo-wide
  `tsc` report only those and suppress all semantic diagnostics. Not mine, not touched.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-10-06T13:40:00+07:00
**ROLE:** startup — read memory/state, register with coord.mjs, claim DashboardPage + App
**STATUS:** completed
**IN FLIGHT:**
- locating which surface the user meant and where its data comes from
**COMPLETED:**
- claimed `src/pages/DashboardPage.tsx`, `src/App.tsx`; traced the heatmap to
  `ProductivityHeatmap` + `DashboardPage.heatmapData`
**NEXT ACTION:** measure both windows against the real DB