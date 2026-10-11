<!-- SESSION: opencode-ide-ui-20261004 -->
<!-- AGENT: opencode | TERMINAL: ? | PROJECT: App Tracker -->

# Agent State — opencode-ide-ui-20261004

> **STATUS:** completed | **UPDATED:** 2026-10-07T05:05:00Z

---

## CURRENT CYCLE (5)
**ROLE:** Fix the Git timeline ("git timeline isn't synced up / new data isn't parsed")
**STATUS:** completed
**IN FLIGHT:**
- (none)
**COMPLETED:**
- **Root cause #1 — silent sync failure.** `sync-commits` (main.ts:19037) returns `{success:false, message}` as a RESOLVED promise; the renderer awaited it and ignored the result, so every failure rendered as success. `handleSyncGit` now checks `result.success`, distinguishes "parsed N new commits" from "up to date", and renders a `role="status"` notice (emerald / amber + icon). Previously an empty timeline was indistinguishable from "no commits yet".
- **Root cause #2 — hardcoded window.** The chart drew a last-30-days axis while `get-commit-history` returns the 50 NEWEST commits. Probe: `today=2026-10-07, newest commit=2026-06-30 → old window plots 0/4 commits` — an empty chart directly above a full commit list. Window now derives from the data; header states `{windowLabel} · {gmtLabel} · local days` and shows a "newest commit Nd ago" pill (99d here).
- **Root cause #3 — no auto-ingest.** Sync only ran on button click. Git tab now syncs once per project on open (guarded by `autoSyncedRef`, invoked via `handleSyncGitRef` because `handleSyncGit` is a later `const`).
- **I was wrong about #4 and the probe said so.** I claimed `%ai` was misparsed (not in the ECMA-262 grammar). Probe printed drift=0h for +0900/+0000/-0500 on this V8 — the hypothesis was wrong. Kept `%aI` anyway (spec-defined, engine-independent) but it was NOT the bug.
- Day-bucketing confirmed already-local (`format(new Date(iso))`) — added the explicit GMT label so it's unambiguous rather than changing the math.
- Robustness: `isNaN` guard in main ingest (an unreadable date aborted the whole sync mid-loop and logged the commit as an error) and in the renderer's day-bucket + `relativeDate` (an Invalid Date threw RangeError through `format()` and could take the tab down; future-dated commits rendered "-3h ago").
**NEXT ACTION:** CZ builds and opens the Git tab. It should now state its window + GMT offset, show staleness, and auto-sync instead of silently doing nothing.
**NOTES:**
- **`src/main.ts` diff is 2182 insertions — mine is ~15 lines.** Another agent is live-editing main.ts; coord warned my claim "protects nothing". My hunks verified present at 19050 (%aI) and 19101 (isNaN). Did NOT commit.
- Local `git log` sync CANNOT succeed on this box: all 5 project paths are `C:\Users\...`, so `execSync({cwd})` fails. The new notice will now say so instead of failing quietly. Real fix is re-adding projects with local paths (or a repository_url for the GitHub path, which is timezone-safe already).
- Verification: renderer esbuild parse clean, in-file tsc 44 → 38, no new error classes; main.ts syntax-only transform clean and zero tsc errors in my edited range (19050-19110).
- MEMORY.md now 262 entries vs the mandated max 10 — flagged twice, not bulk-archived (shared append target, live agents).