<!-- SESSION: opencode-trackadjust-20261016 -->
<!-- AGENT: opencode | TERMINAL: trackadjust | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-trackadjust-20261016

> **STATUS:** in-progress | **UPDATED:** 2026-10-24T15:00Z

---

## CURRENT CYCLE (2)
**ROLE:** Fix the TWO fabricated-time writers (not just one) and the browser write
amplification, so suspend stops being tracked and browser day-totals stop being impossible.
**STATUS:** in-progress — both fixes applied and probe-proven; UI work not started.
**IN FLIGHT:**
- Needs CZ to build: the `src/main.ts` writer fix is statically + SQL verified, NOT runtime
  verified (no build = no runtime).
**COMPLETED:**
- **Writer 1 — the daemon.** Fixed `feed()`/`flush()` in
  `~/.local/share/rheo-tracker/daemon.mjs`: split `lastPollMs` into an ATTEMPT clock and a
  SUCCESS clock, gave `flush()` an explicit endpoint clamped to the success clock, and made
  `tick()` report `{ok:false}` instead of swallowing failures. 60-min cap retired
  (`MAX_WRITE_MS = MAX_SESSION_MS`). Service RESTARTED twice (pid 1432→144655→168428).
- **Writer 2 — the app.** `src/main.ts` `handleBrowserData` (23136-23480). Fixed a real
  latent crash: `newSessionDuration` was read at 23284 but declared at 23303 → a `let` in the
  temporal dead zone → ReferenceError whenever the dedup branch ran.
- **Root-caused the 139 h day.** Not suspend, not duplicate profiles: **write amplification.**
  `git`-measured in the live DB — 133 of 140 rows at exactly 3_600_000 ms are
  `is_browser_tracking=1` browser rows; 59 of them share ONE timestamp
  (`2026-10-13T16:15:10.675Z`, obsidianui.dev) with only `id` and a CUMULATIVE `duration_ms`
  growing ~30 s per row. Cause: the extension sends TWO payload shapes and both writers ran
  `delta_ms || active_duration_ms`, conflating a periodic DELTA with a tab-switch session
  TOTAL, and the insert path then overwrote the periodic branch with
  `Math.min(sessionDuration, 1h)`.
- **Both writers made idempotent.** Session identity = (browser, domain, session-start). A
  periodic delta ADDS (capped by the delta cap); a tab-switch snapshot may only RAISE
  (capped by the session ceiling, NOT the delta cap — a 3 h session must not truncate to
  10 min). The DB is now the session registry, so a restart or an evicted in-memory map can
  no longer append a twin. Deltas find their row via a bounded merge window because their
  `timestamp` is the SYNC time, not the session start.
- **Browser attribution fixed at the root:** the daemon's `addLog` INSERT had **no
  `browser_name`/`profile_id` columns at all** — that is why 5,835 of 6,345 browser rows are
  unattributed. Added the columns; normalised `app` to the domain so both writers emit one
  row shape.
- **Unified TrackingTimeDialog (started).** Created `src/components/TrackingTimeDialog.tsx` with 3 tabs
  (Correct recorded time / Fill gaps / Add manual time), a slider + exact HH:MM:SS input,
  preview diff, and commit via `update-app-log` (proportional session scaling). Wired into
  App.tsx (header button renamed Smart Fill → Tracking time) and ActivityPage (two buttons
  → one dialog). Consolidated entry points. Commit `831ffd3` + `dceb955`.
- **Two probes, both differential (new code vs the pre-fix backup):**
  `tracking-sleep-daemon.probe.mjs` **12/12** — 3 h suspend credits 1000 ms fixed vs
  `[1000, 3600000]` pre-fix. `tracking-browser-idempotency.probe.mjs` **14/14** — one
  session: **1 row / 31.5 min** fixed vs **60 rows / 16.8 h** pre-fix.
- Deleted the 3 approved dead components (zero import statements; the 5 "importers" were
  prose comments).
- Verified: `node --check` on the daemon, scoped `tsc` (0 semantic TS2xxx in my regions),
  `esbuild` parse, and every new SQL statement run read-only against the real DB.
**NEXT ACTION:** the slider-based adjustment UI for ALREADY-RECORDED time, consolidating the
two "Smart Fill" buttons into one surface. **Before it:** decide whether suppressing the
generic browser app row must be paired with counting website rows in
`daily_stats`/`daily_aggregates` (see NOTES — doing only half loses the browser's total).
**NOTES:**
- **The invariant is preserved by an explicit clamp, not by a handler.** No `suspend`/
  `shutdown` `powerMonitor` subscriptions were added, deliberately: the app already credits
  ZERO during sleep by clamping to `lastSuccessfulObservationTime`. Adding a flush-on-suspend
  on top of the post-wake gap flush risks double-crediting the same seconds.
- **The canonical-timeline change is a PAIR, and only half of it is safe.** Suppressing the
  `zen` app row while the bridge reports removes it from `daily_stats`/`sessions`/
  `daily_aggregates`, because `updateAggregates` deliberately excludes website rows. So the
  suppression alone would make the browser's time vanish from those tables; it must ship with
  the `isWebsiteRow` exclusion being lifted. Not shipped unverified — it changes aggregate
  semantics for all future rows and cannot be checked without a build.
- `is_browser_tracking=1 AND domain IS NULL` is **0 rows**, so the dedup branch at 23256 can
  never match. Dead code, left alone.
- `src/main.ts` `before-quit` (27422) flushes the final session, but its comment claims it
  filters browsers and the condition does not — one row per quit can still overlap a browser
  session. Reported, not changed.
- Daemon changes live OUTSIDE git. The only restore path is
  `agent/backups/20261016-1330-daemon-sleepfix-pre/`.
- `src/main.ts` carries ~460 lines of an EARLIER session's uncommitted work (599-line
  diff vs HEAD; mine is 139 across 5 hunks). Committed as a `wip:` save point.

---

## HISTORY
### CYCLE (1) — completed 2026-10-16T04:05Z
Authored the Architect brief in `agent/docs/generate-prompt-docs/tracking-time-adjustment-16102026/`
(`prompt-copy` **ID 246**, left uncopied — clipboard is contended). Root-caused the sleep
fabrication to `feed()` advancing `lastPollMs` before `flush()` read it. Mapped the UI
duplication: 3 dead GapFillModal-family components, 2 live buttons both labelled "Smart Fill",
`predict-day-gaps` + `useGapPredictions.ts` built but imported nowhere, and no slider editor
for recorded time. Confirmed `slider.tsx` + `@radix-ui/react-slider` are already installed.
