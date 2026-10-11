<!-- SESSION: opencode-undef-fix-20261001 -->
<!-- AGENT: opencode | TERMINAL: (unset) | PROJECT: App Tracker -->

# Agent State — opencode-undef-fix-20261001

> **STATUS:** completed | **UPDATED:** 2026-10-02T23:58:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** App-wide lag diagnosis + crash-class repair, driven by the `063cdf0` code-review audit
**STATUS:** completed
**IN FLIGHT:**
- nothing — all work shipped and built
**COMPLETED:**
- Physical backup on the 752G disk: `agent/backups/20261002-233111-pre-dbguard-build` (2698 files)
- Audited the review spec: 5 of 12 items were already fixed (F3 alias, F4 Navigate, F5 ZapCircle,
  F10 scrollbars, F11 index.css). Re-ranked the rest by real-bug risk instead of error count.
- **Crash class** TS2304/2305/2724 fixed across 13 files (~78 latent `ReferenceError`s), incl.
  two LIVE ones: `GapBanner onOpenDrawer` and `OrbitSystem`'s missing `THREE` import.
- **Lag root causes found and fixed (all measured, see MEMORY.md):**
  1. `App.tsx` `lastActivity` was write-only state written on every mousemove → `useRef`.
  2. Sidebar memo-busters (inline arrow props) + a `useEffect` that rebuilt its own interval
     every second because it depended on the state it set.
  3. TitleBar: 2 IPC round-trips every 500 ms forever on every route.
  4. `get-logs` shipped the whole table (29,149 rows / 10.19 MB / ~500 ms) on every alt-tab and
     on a 30 s timer, then discarded it. Added `get-logs-version` (MAX(id), 1.3 ms) + a guard.
     20 alt-tabs → 0 full fetches.
  5. Startup pulled the full table three times (87,447 rows). Now once (29,149 rows, −67%).
  6. Sidebar red needle was React state at mousemove frequency, and `mouseY` was threaded into
     every `<NodeDot>` **without being read**, which defeated their `memo()`. Now an rAF +
     direct `transform` write.
- Coordination interview protocol executed: `RESULT.md` + `SCORECARD.md` Cycle 1.
**NEXT ACTION:** nothing pending. The Lenis scroll fix is written and shipped but **could not be
  runtime-verified** (see HISTORY note) — CZ should confirm scrolling inside a panel.
**NOTES:**
- **RETRACTED:** I claimed `logs(duration_ms)` needed an index. Wrong — that 5.26 ms COUNT is a
  one-time startup backfill, not a hot path. No schema write was performed.
- **`/tmp/opencode` is tmpfs and was wiped mid-session.** Backups now go to
  `agent/backups/` only. This bit me once already.

---

## HISTORY (previous cycles, oldest first)

### Cycle 0 — 2026-10-01/02
**ROLE:** Audit `docs/code_review_063cdf0.md`, classify F1–F12 before executing
**STATUS:** completed
**IN FLIGHT:** — none
**COMPLETED:**
- Verified every claim empirically instead of trusting the report; full `tsc` baseline 6,873 errors.
- Found the report ~40% stale and mis-ranked (it counted 2,505 `TS6133` "unused" errors as
  the problem; those are lint noise with zero runtime impact).
- Identified the real crash class hiding underneath the noise: undefined names and bad exports.
**NEXT ACTION:** Execute the crash fixes — became Cycle 1.

### Session note — why the scroll fix is unverified
`smooth-scroll.tsx` (Lenis) now binds to the scroller **under the pointer** instead of the
largest pane on the page, and the dead `[data-sf-routed-content]` selector was corrected to
`[data-page-root]`. Headless Chromium could not exercise it: `electron-web` mode shims
`window.deskflowAPI`, the shim inevitably trips an ErrorBoundary, and Lenis never mounts.
Needs the real Electron app on a route with nested scrollers.
