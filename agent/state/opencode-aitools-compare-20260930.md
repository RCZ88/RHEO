<!-- SESSION: opencode-aitools-compare-20260930 -->
<!-- AGENT: opencode | TERMINAL: aitools-compare | PROJECT: App Tracker -->

# Agent State — opencode-aitools-compare-20260930

> **STATUS:** completed | **UPDATED:** 2026-10-01T23:25:00.000Z

---

## CURRENT CYCLE (2)
**ROLE:** C1 multi tool/model compare (PAINT); C2 hermes session messages; C3 timezone display
**STATUS:** completed
**IN FLIGHT:**
- (none — built; awaiting human relaunch + a Sync click)
**COMPLETED — C2 hermes messages (the "only 1 message" bug):**
- ROOT CAUSE: `get-ai-session-messages` had branches for claude-code / opencode /
  gemini / codex and **none for hermes**, so it always fell through to
  `return { success:true, data: [] }`. Zero messages, for any hermes session.
- Added a hermes branch reading the `messages` table of `~/.hermes/state.db`
  (NOT the request_dump files — those are failed requests). Verified against the
  real DB: session `20260829_002917_d24ba8` went from **0 -> 95 messages**
  (3 user / 45 assistant / 47 tool). `active = 1` filters rows superseded by
  compaction (state.db has _compressed_summary/compacted); `session_meta` skipped;
  tool payloads are raw JSON so they get a 1200-char cap vs 8000 for prose;
  ordered `id DESC LIMIT 400` then reversed, because one session has 3,583
  messages and ASC+LIMIT would silently drop the end of the conversation.
- `messages.token_count` is NULL for ALL 110,040 rows -> per-message token chips
  are intentionally left unset rather than invented. Session totals come from the
  sessions table via ai_usage.
- `ROLE_STYLES` only had user/assistant, so hermes `tool` rows fell through to the
  assistant style and every tool call was mislabelled "Assistant". Added a `tool`
  style (Wrench / "Tool").
**COMPLETED — C3 timezone (display-only, as the user specified):**
- ROOT CAUSE 1, measured on a real stored value `2026-08-28 17:26:03`:
  `new Date("2026-08-28 17:26:03")` -> `10:26:03Z`, i.e. SQLite's UTC text was
  re-read as LOCAL, landing **exactly 7 hours behind** in WIB — the reported
  symptom. A proper UTC parse gives `17:26:03Z`.
- ROOT CAUSE 2, worse and previously unnoticed: `ai_usage.created_at` is SQLite
  `CURRENT_TIMESTAMP` (UTC) and is the *ingest* time, never the session time. All
  2,205 opencode rows share `2026-08-28 17:26:03` while their real session days
  go back to 2026-04-02 — so every row in the history list rendered as the same
  "1 month ago". The row's primary label now shows the session's OWN day
  (`ai_usage.date`, already local-bucketed by `getLocalDateStr`); the recorded
  instant stays in the tooltip, correctly UTC-parsed.
- New `src/components/ai/lib/timeDisplay.ts`: `parseUtcInstant` (SQLite space-form
  pinned to UTC; bare `YYYY-MM-DD` anchored at LOCAL midnight so it cannot slip a
  day west of UTC; unix s vs ms heuristic), `toDisplayInstant`,
  formatRelativeTime / formatFullDateTime / formatDayLabel / formatOffsetLabel,
  offset clamped to ±16h, half-hour zones render (UTC+5:30).
- Preference `aiDisplayTimezoneOffsetMinutes` + `get/set-ai-display-timezone-offset`
  IPC + preload + d.ts. UI: a Globe button in the AI Tools toolbar showing the
  current label (amber when non-zero) that expands to -1h / -15m / +15m / +1h /
  Reset. Applied to the module store first so the list re-renders instantly;
  the preference write is persistence only.
- NOTHING on disk is rewritten: verified `parseUtcInstant(ca)` is byte-identical
  at every offset. Calendar-day labels are deliberately NOT offset-adjustable —
  shifting a day label would re-bucket data that is already correct.
**NOTES / TRAPS HIT THIS CYCLE:**
- `datetime.fromtimestamp(sa*1000)` in a throwaway python harness produced
  "year must be in 1..9999, not 58627" and looked like a corrupt-timestamp bug in
  my parser. It was the HARNESS: `fromtimestamp` takes seconds, the code
  (correctly) does `new Date(sa*1000)` because the Date ctor takes ms. hermes
  `started_at` is sane: 0 insane of 277. Don't "fix" the real code over this.
- Simulated the whole sync on a COPY of the live DB rather than guessing:
  274 hermes rows, date range 2026-08-29..2026-10-01, and the global dedup at
  main.ts ~1985 deleted **0** rows (I had flagged it as a data-loss risk last
  cycle — measured, it does not materialise on this data). byTool then shows
  hermes 498,368,919 tok / 274 sessions / 47,774 msgs / last=2026-10-01 /
  $0.00, ranking 3rd above gemini; 468M in the project-scoped view; 6 models;
  4,693,551,932 cache-read.
- The live DB still has **0 hermes rows** — the sync is user-triggered only. A
  relaunch + Sync is required; nothing can land rows without that.
- Build exit 3 = REFUSED (another agent held the lock); polled and retried.

---

## HISTORY (previous 1 cycle, oldest first)

### Cycle 1 — 2026-10-01
**ROLE:** Make the AI Tools detail view fully comparable in dropdown mode
**STATUS:** completed
**COMPLETED:** AgentComparePanel (Tools|Models, 4 metrics + All/In/Out, 7D/30D/All,
  multi-select chips, Combined|Split); modelDailyTotals cross-tool memo; seeding
  effect; shared 3-sigma outlier threshold across series; dropped backdrop-blur.
  BUILD OK, 0 new tsc errors vs baseline. Popup branch left intact.
**NEXT ACTION:** C2 (hermes messages) — which is this cycle.
