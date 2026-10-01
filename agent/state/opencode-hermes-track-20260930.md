<!-- SESSION: opencode-hermes-track-20260930 -->
<!-- AGENT: opencode | TERMINAL: hermes-track | PROJECT: App Tracker -->

# Agent State — opencode-hermes-track-20260930

> **STATUS:** completed | **UPDATED:** 2026-10-01T00:55:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Fix AI usage tracking for the Hermes tool + make resync survive path/OS changes
**STATUS:** completed
**IN FLIGHT:**
- (none — awaiting a human relaunch for runtime verification)
**COMPLETED:**
- ROOT CAUSE: HermesPlugin parsed `~/.hermes/sessions/request_dump_*.json`. All 252
  files are FAILED-request dumps (429 / APIConnectionError, no `response.usage`),
  so the plugin could only ever ingest 231 zero-token rows -> 55 junk rows after
  the global dedup. `ai_usage` held 0 hermes rows. Real usage = `~/.hermes/state.db`
  table `sessions` (273 sessions, 478M in / 20M out / 4.69B cache-read).
- A: HermesPlugin now reads state.db via `parseSQLite` (cwd -> projectPath so it
  appears in project/IDE views; unix-float `started_at`; billing_provider; reported
  cost). Dropped the error-dump dirs. `getHermesStateDbPaths()` resolves .db / dir /
  parent-dir / custom path.
- A4: `isFreeTierModel` + `FREE_MODEL_PRICING` stop `:free` models falling through
  to 'default' ($2/$10). `calculateCost` now trusts a positive plugin-reported cost.
  Verified numerically: 6 of 7 hermes models were priced as paid; paid models unchanged.
- B: `resyncAgentAfterPathChange()` invalidates an agent's cache and re-syncs just
  that agent — wired into `set-ai-agent-custom-path` + `set-hermes-sessions-path`,
  which previously only wrote config and left the UI stale.
- B: sync state v3 adds `hostKey` (platform|hostname|homedir) -> OS/user/machine
  change discards path state. Stale path keys are pruned.
- B: removed the dead `syncState.fileEntries` guard (read at 2 sites, never written,
  so the mtime cache could never skip) and replaced it with a real `dbRowCount`
  guard: if `ai_usage` holds FEWER rows for a tool than after the last sync, every
  path for that tool is force re-read. This activates the mtime cache safely.
- Custom paths now honoured CENTRALLY (`getAgentCustomPath` in the sync loop +
  debug handler) so all 9 agents support an override — only gemini/codex/kilocode
  did before, so the picker would have silently no-opped.
- UI: "Hermes Setup" -> **"Tools Config"**; modal now lists ALL agents with
  detected/not-detected, resolved paths, file counts, and per-agent Change Path /
  Auto (which re-sync + refresh the cards).
- `forceSyncAIUsage` preload bridge + `deskflow-api.d.ts` decl (the dedicated
  `force-sync-ai-usage` handler had no bridge; the UI's "Force Resync" button
  already worked via clearAISyncState).
- hermes added to SUPPORTED_AGENTS in NewSessionDialog (was unselectable).
**NEXT ACTION:** Human relaunches the app and presses Sync (or Force Resync) —
  runtime verification was NOT possible: the app was already running old code and
  I will not kill a process I did not start. Expect hermes ~273 rows.
**NOTES:** My own `scripts/build.mjs` run OOM-killed (7818 modules transformed ->
  "rendering chunks" -> fail, no file/line named = OOM signature; swap was 100%
  full with ~10 opencode procs + another agent's 8GB vite build). A concurrent
  agent's build then produced valid dist at 00:46 FROM MY SOURCE — verified all
  my markers present in dist-electron/main.cjs + preload.cjs + the hashed
  renderer chunk, and every artifact newer than its source. `dist/assets/index.js`
  does not exist by design — assets are hashed (`index.DQf61Sug.js`).

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-09-30
**ROLE:** investigation
**STATUS:** completed
**IN FLIGHT:** — none
**COMPLETED:** Root-caused hermes tracking; wrote plan; user approved.
**NEXT ACTION:** implement
