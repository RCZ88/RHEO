<!-- SESSION: opencode-stopwatch-sync-20261004 -->
<!-- AGENT: opencode | TERMINAL: 11537 | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-stopwatch-sync-20261004

> **STATUS:** completed | **UPDATED:** 2026-10-04T00:58:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Fix the sidebar-vs-dashboard stopwatch desync and the "sidebar resets for no reason" bug
**STATUS:** completed
**IN FLIGHT:**
- none
**COMPLETED:**
- ROOT CAUSE: two independent clocks. Sidebar rendered `App.tsx:elapsedTime` (SECONDS, per
  foreground window, zeroed by `onForegroundChange` at App.tsx:739). Dashboard hero rendered
  `lib/stopwatchStore` `productiveMs`/`distractingMs` (MILLISECONDS, day-scoped). Different
  unit, scope and formatter (`12m 30s` vs `HH:MM:SS`) — they could never agree.
- `stopwatchStore.ts`: snapshot gained `displayMs`/`displaySource`/`resetCount`/`externalLabel`;
  ONE `formatStopwatch()`; app-wide `startStopwatchDriver()`; `setTier`/`setHasRealApp`/
  `setExternalSession`; `shouldRun()`+`reconcile()`. Tier flip now BANKS the outgoing segment
  instead of ZEROING both totals.
- `Sidebar.tsx`: subscribes to the store, renders `formatStopwatch(snap.displayMs)`. `elapsedTime`
  prop removed. (Kept in App for activity-log durations — that is what it is for.)
- `App.tsx`: starts the driver once; heartbeat feeds `stopwatch.touch()` (presence, app-wide);
  `setHasRealApp(!!currentApp)`; no longer passes `elapsedTime` to Sidebar.
- `DashboardPage.tsx`: `displayTime.ms` ← `stopwatchSnap.displayMs`; tier effect hands the tier to
  the store (page-local interval + `activeRef` deleted); publishes the external session into the
  store; reset overlay now driven by `stopwatchSnap.resetCount`; another agent's
  `timerBehavior.neutralAction==='reset'` now calls `stopwatch.reset()` instead of bumping a
  counter that only played an animation.
- `StopwatchTimer.tsx`: local `formatDuration` replaced by the shared `formatStopwatch`.
**NEXT ACTION:** CZ builds (`npm run build`) and checks the sidebar timer against the dashboard
  hero. Runtime verification was NOT possible this cycle — no build, app not launched (§0-0).
**NOTES:**
- Probe `agent/logs`-adjacent: `/tmp/opencode/stopwatch-probe.mjs` (real bundled store, 19 checks,
  ALL PASS). Re-run: `npx esbuild src/lib/stopwatchStore.ts --bundle --format=esm
  --platform=node --outfile=/tmp/opencode/sw.mjs && node /tmp/opencode/stopwatch-probe.mjs`.
- NOT MY FIELD, left alone: `src/components/dashboard/widgetRegistry.tsx` has a broken
  `WidgetRegistry` export (whole-repo esbuild fails on it — another agent mid-refactor);
  `npm run validate:pages` reports `route "/agentic" has no manifest` (route added by someone
  else); `src/components/widgets/StatusBand.tsx` is a THIRD, prototype stopwatch (`tick()` says
  "Simulate tier change for prototype demo", `useState(0)`), only mounted by the demo
  `WidgetGrid.tsx` — not the user's timer, but it is a landmine.
- `scripts/zip-src.mjs` deliberately NOT run: 3+ other agents are editing `src/` right now, and
  packaging a tree mid-write produces a corrupt archive (MULTI_AGENT_PROTOCOL §F).

---

## HISTORY (previous 2 cycles, oldest first)

_(none — first cycle in this session)_