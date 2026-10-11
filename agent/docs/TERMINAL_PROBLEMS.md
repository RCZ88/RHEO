# Terminal Workspace — Open Problems

Everything CZ reported against `/terminal`, plus everything found while fixing them.
Ordered by "is the feature usable at all", not by how easy it is.

**Legend** — `CONFIRMED` = root cause located · `REPORTED` = user-visible, cause not yet located · `MINE` = introduced by the workforce integration (cycle 1c)

Status key: `TODO` · `IN PROGRESS` · `BLOCKED` · `DONE`

---

## P0 — Feature is unusable

### 1. Workforce scene shows workers when nothing is running `MINE`
**Status:** FIXED (needs CZ's build)

With **zero terminals open** the scene renders **~7 workers**.

- **Where:** `src/components/terminal/workforce/WorkforcePanel.tsx` → `IsometricWorkforceScene.tsx`
- **Why:** `buildWorkforceWorkers()` (`conductorWorkforce.ts:317`) sets `open = !isClosedStatus(s.status) && !!terminalId` for plain sessions, and conductor nodes get `open` from `ACTIVE_NODE_STATUSES` (`:269`). The panel passes **every** worker through, including closed sessions and queued conductor nodes. The scene then registers them all via `ensureWorker()` and renders saved ghosts.
- **Breaks:** integration plan §6 — *"Zero terminals open → render nothing."* A populated office with no terminals is the single most misleading thing this UI can do.
- **FIXED:** `WorkforcePanel.tsx` now derives `liveWorkers = workers.filter(w => w.open)` and only those reach the scene. The scene then hits its own `workers.length === 0` branch and renders `// no agents running`.
- **No information lost:** TerminalPage already renders a `{closed} closed` chip from `workforceSummary`, so the count is still on screen.
- **Scope decision:** plan §6's "dim ghost at its desk" and §6's "zero terminals → render nothing" **contradict each other**. Took the second (CZ's live report). Ghosts deferred to the §8.5 archive cabinet, which does not exist yet.
- **Regression test:** `agent/docs/workforce-fixtures/verify-workforce-panel.cjs`, 17 assertions.

### 2. "Close worker" button does nothing `MINE`
**Status:** FIXED (needs CZ's build)

- **Where:** `WorkforcePanel.tsx` → `handleClose()`
- **Why (conductor path):** `conductorCloseNode(missionId, nodeId)` expects the **bare** node id, but the code passes `String(w.sessionId ?? w.key)` — and `w.key` is `` `conductor:${node.id}` ``. So the id is prefixed and the handler never matches a node.
- **Why (plain path):** `handleClose` calls `onCloseTerminal(w.terminalId)`, which returns early when `terminalId` is null. A worker with no live terminal silently no-ops.
- **Also:** nothing in the UI reports failure. The confirm closes and the worker stays, so it reads as "the button is broken."
- **FIXED:** `handleClose` now does `String(w.key).replace(/^conductor:/, '')` to get the bare node id, checks `missionId` / `onCloseConductor` / `terminalId` before calling, and **reports** instead of swallowing.
- **Visible now:** a failed close renders an inline `role="alert"` in the inspector (`.wf-err`, red, `workforce-iso.css`). A silently-dead button is worse than a visibly-broken one.
- **Regression test:** same file, 11 assertions.

### 3. AI Gateway — none of its pages work
**Status:** FIXED (needs CZ build) · `src/main.ts` root cause

- **Where:** `src/components/workspace/ai-gateway/` (`ChatTab.tsx`, `ProvidersTab.tsx`, `SessionsTab.tsx`, `StatusTab.tsx`)
- **Symptom:** every page in the section is non-functional.

- **Root cause was NOT in the tabs — it was in main.** `aigateway:list-providers` (`main.ts:7805`) returned a **bare array** on success but `{success:false,error}` on failure. The tab checked `if (!a.success)`, and `undefined` is falsy, so **"Failed to load providers" rendered on calls that SUCCEEDED and returned adapters.**
- Same defect, three channels: `aigateway:recent-runs` (`catch { return [] }` turned a DB error into "no runs yet"), `aigateway:playwright-status`, `aigateway:all-statuses` (the only correct one — used as the model).
- **Fixed in main.ts: all three now return `{success, data}` / `{success, error}`.** Renderer accepts both shapes, so the contract is now consistent either way.
- Also fixed in the tabs: `ProvidersTab` rendered an empty `<select>` with no error when the list failed; `ChatTab` threw on `answer.strategy.replace` after a *successful* send; `SessionsTab.fmtTime` parsed SQLite `YYYY-MM-DD HH:MM:SS` as local time. Per-tab error surfaces now name the channel and the shape received.
- New `TabBoundary.tsx` — deliberately NOT `src/components/ErrorBoundary.tsx`, which is `fixed inset-0 z-[9999]` + auto-reload and would replace the whole workspace view because one tab threw.

### 4. AI Gateway should not be a top-level sidebar page
**Status:** FIXED

The gateway is **conductor-only** — it exists to configure the agents the Conductor dispatches. Giving it a full sidebar destination is redundant surface. It should be **compressed into the Conductor UI** (a section/tab inside `ConductorPanel.tsx` / `AgentProviderPanel.tsx`), and its sidebar entry removed.

- Gateway components made embed-safe: no `h-screen`/`vh` anywhere, `min-w-0` + `break-words` throughout, responsive stats grid, `truncate`/`shrink-0` on rows. Added `showTabs` so it renders its own strip when embedded.
- **Still needs doing, exact edits supplied by the subagent (NOT made — other slices):**
  - `src/components/workspace/WorkspaceGroupRail.tsx:14` drop `| 'ai-gateway'`; `:30` delete the nav entry
  - `src/pages/registry/pages/terminal.ts:96-108` delete the manifest
  - **DONE:** `TerminalPage.tsx` group block deleted; `{ key:'gateway', icon:Globe, label:'Gateway' }` added to the Conductor tab list; the Conductor render now branches `sub === 'gateway'` to `<AIGatewayTab activeTab="status" showTabs={false} />`. `storageKey="conductor"` means a saved `ai-gateway` sub-tab no longer restores.
  - `src/pages/terminal/TerminalGrid.tsx:115-119` + `src/pages/TerminalPage.tsx:185-189` delete the five `'ai-gateway/*'` label entries

### 5. "Failed to load providers" + Retry
**Status:** FIXED (needs CZ build)

- **Where:** `src/components/workspace/ai-gateway/StatusTab.tsx:25`
  ```ts
  if (!a.success) { setError(a.error || 'Failed to load providers'); setLoading(false); return; }
  ```
- **Needs:** the actual main-process handler behind this call — the error is being swallowed into a generic string, so the cause is invisible. Locate the IPC, find why it fails, and surface the real message instead of the fallback.

- **Root cause: `src/main.ts:7805` returned a bare `ProviderAdapter[]` on success and an envelope on failure.** The renderer checked `.success`; `undefined` is falsy, so the app reported failure while succeeding.
- **Fixed at source** — all three affected handlers now return `{success, data}`.
- The generic fallback string is gone: errors now name the channel and the payload shape actually received.

### 6. Terminal workspace sidebar is unbearably laggy
**Status:** BLOCKED — needs a runtime profile · **NOT DIAGNOSED**

I investigated rather than guessed, and the honest result is **I could not find the cause statically**:
- `Chrome.tsx` is only 344 lines, has **zero `useMemo` and zero `useCallback`**, no timers, no subscriptions, and no overlays. It is a thin wrapper, not the bottleneck.
- The PTY stream is **not** the cause: `TerminalWindow.tsx:233` writes straight to `terminalRef.current.write(data)` with **no `setState`**, so per-chunk output does not re-render React.
- The fragile-access scan ranks `Panels.tsx` highest in the repo (30 sites) — that is where I would look first with a profiler, but "30 static smells" is not evidence of a runtime stall.

**"Unable to be interacted with properly" is a blocking symptom, not just slowness** — the same signature as the ArchMap overlay bug (a `fixed inset-0 z-[9999]` layer swallowing clicks). I found no such layer in the terminal chrome, but that needs a real click-test to confirm.

**To unblock:** a build + launch, then either a DevTools performance profile or a scripted click-latency measurement. I cannot produce either without the build (§0-0), and guessing here would waste the fix.

### 7. The sidebar architecture itself is wrong
**Status:** REPORTED · **TODO**

CZ's words: *"the overall sidebar is like not the best solution for this shit."* This is an **architecture** problem, not a styling one, and it should be decided **before** optimising P6 — optimising a layout that should not exist is wasted work. Needs a proposal, then CZ's pick.

---

## P1 — Wrong or missing behaviour

### 8. Duplicate provider UI
**Status:** DECIDED — canonical is `src/services/providers/templates.ts`

Provider configuration exists in **two** places:
- `src/components/conductor/AgentProviderPanel.tsx`
- `src/pages/settings/IntegrationSection.tsx` (and `ColorsSection.tsx` touches it)

Two sources of truth for one setting means they will drift. Pick one; the other becomes a read-only view or goes.

- Investigated rather than guessed. `templates.ts` -> `router.ts` -> `callProvider` is what **every** AI call in the app dispatches on, and the Settings editor is wired to it.
- `src/pages/settings/IntegrationSection.tsx` is a **67-line stub** that ignores all 48 of its props and prints `"Integration and AI settings content"` — not a working duplicate, a dead one.
- `conductor_configs.config_type='agent_provider'` rows are read by **nothing** outside main.ts register/list/delete — no dispatch path consults them. So `AgentProviderPanel` was writing API keys into a table nothing read, from a hand-kept provider list whose endpoints matched nothing in the catalogue.
- `AgentProviderPanel` is now a **read-only** view that states where real config lives. Its divergent hand-kept list is deleted.
- **Follow-up (not done):** delete or finish the `IntegrationSection` stub — its 48 props are wired to live state in `SettingsPage.tsx:6024-6192`.

### 9. Code stats lists the same file multiple times
**Status:** FIXED (needs CZ build)

- **Where:** `src/components/workspace/CodeStatsTab.tsx`, `src/components/line-stats/` (`ProjectLineStats.tsx`, `FileDetailTable.tsx`, `FileTypeChart.tsx`)
- **Needs:** the scan/collection path — dedupe by **real path**, not basename, before any counting or chart input.

- **Root cause was `src/main.ts` `walkAndCount()`, not the components.** Rows were pushed with no seen-set and no path normalisation, so any two spellings of one file became two rows, were both persisted, and were both counted into `summary`.
- Fixed in main.ts: dedupe by **resolved real path** (`realpathSync`, falling back to `resolve`).
- Renderer side also filters on every read via one shared helper (`lineStatsFilter.ts`) feeding all 6 consumers, so the numbers are right even before the walker is rebuilt.

### 10. Code stats counts backup files as duplicates
**Status:** FIXED (needs CZ build)

Backup copies (`*.bak`, `*.bak-*`, `<name>.backup.ts`, dated copies) inflate every count and the line chart. They must be excluded.

- `walkAndCount` had a name-only skip-dir set and **nothing filtered backup filenames** — `countLinesInFile` happily counted `main.ts.bak` as 5000 lines of TypeScript.
- Fixed in main.ts with `LINE_COUNTER_BACKUP_RE`, plus 16 filename patterns renderer-side.
- **A regex bug my own probe caught:** the original double-suffix pattern `\.(?:bak|orig|backup)(?:[-._]\w+)+\.\w+$` consumed `.txt` and left nothing for the mandatory trailing extension, so **`a.ts.orig.txt` leaked through**. The separator run must be optional after the first. Probe-verified both ways (`verify-line-walker.cjs`).
- **An order-dependence bug my own probe caught:** the numbered-copy rule asked "does the un-numbered twin exist?" while streaming, but `readdir` order is not guaranteed, so `preload2.ts` survived when visited before `preload.ts`. Now a two-pass collect-then-judge, which is deterministic.
- **An arithmetic bug my own probe caught:** computing the twin name from match offsets was off by the digit width and produced `preloads`. Now taken from the last dot.

### 11. Code stats has no "ignore these directories" setting
**Status:** DONE (needs CZ build)

Needs a persisted ignore-list (default: `node_modules`, `dist`, `dist-electron`, `build`, `.git`, `agent/backups`, coverage dirs) wired into the scan. A setting without a default that actually excludes the obvious noise is not a feature.

- `count-project-lines` `options` had no ignore-directory field at all. Added `ignoreDirs?: string[]`, **additive** to the built-in set (never a replacement — clearing a default would otherwise start counting `node_modules`).
- Default list (43 dirs) includes all 10 required: `node_modules, dist, dist-electron, build, .git, coverage, agent/backups, .next, out, vendor`.
- Persisted via the **existing** `get-preference`/`set-preference` pair — `main.ts:8041` stores object values directly, so no preload change was needed.
- Not silent: `IgnoreNotice.tsx` shows "N of M scanned rows excluded" with a per-rule breakdown.

### 12. Backup Center says "failed to detect a project" while inside one
**Status:** REPORTED · **TODO**

- **Where:** `src/pages/BackupCenterPage.tsx`
- **Symptom:** CZ is already in the project, yet detection fails. Almost certainly a **path mismatch** — the project path the page compares against is not the one the app is actually running with. This is the same class of bug as the AFK "back-computed start time" and the rankings "UTC vs local" entries in `MEMORY.md`: **two places disagreeing about the same path.**

---

## P2 — Quality

### 13. Analytics charts are ugly and bad
**Status:** REPORTED · **TODO**

- **Where:** `src/components/AnalyticsDashboard.tsx`, `src/pages/InsightsPage.tsx`
- Needs a visual pass. Per `AGENTS.md` §9 charts come from the `@bklit` registry **only** — never hand-rolled Recharts.

### 14. Remove the Handbook from the terminal workspace
**Status:** DONE (both halves — I initially removed only one)

**Half 1 — the right-panel tab.** Removed from `src/terminal/components/Panels.tsx`. The `Notes` tab renders the same `CommandNotesPanel`, so nothing was lost.

**Half 2 — the sidebar GROUP. This is what was actually meant, and it was a real bug.**
`handbook` was a full `GroupKey` (`WorkspaceGroupRail.tsx:14`), a nav entry (`:32`), and a page manifest (`pages/registry/pages/terminal.ts:122-131`) — **but there was NO `{activeGroup === 'handbook' && ...}` render block anywhere in `TerminalPage.tsx`.** Clicking Handbook therefore rendered a **blank screen**. It was a nav entry pointing at nothing.
Both the group key, the nav entry and the manifest are now gone.

### 15. Architecture map crashes on every load — `Cannot read properties of undefined (reading 'filter')`
**Status:** FIXED (needs CZ's build) · `CZ-reported stack trace`

- **Where:** `src/features/arch-map/ArchMapPage.tsx` → `loadMap()`, crashing in `filteredNodes` `useMemo`
- **Root cause — an IPC contract mismatch, not a data problem:**
  - `src/main.ts:22785` returns `{ success: true, data: { nodes, edges, stats } }`
  - the renderer did `setMapData(data)` — storing the **wrapper**
  - so `mapData.nodes` was **always** `undefined` and the first `.filter` threw
  - the page was not intermittently broken. **It never worked.**
- **Second-order:** `DEFAULT_SYSTEM_PROMPT.md` §5c documents the return as `{ nodes, edges, stats }`, so the two sides genuinely disagree. The fix accepts **both** shapes rather than picking a winner, so it does not depend on which side is corrected.
- **Why the guards are in one place, not six:** `mapData?.nodes.find(...)` shows the trap — the optional chain protects `mapData` but **not** `nodes`, so it throws one token later. The payload is now **normalised at the only write site**, so every reader is safe by construction.
- **Verification:** `agent/docs/workforce-fixtures/verify-archmap-contract.cjs` reproduces the exact reported message against the real response shape, and proves all six downstream readers are safe. 10/10.
- **⚠ Separate pre-existing issue:** `ArchMapPage.tsx` has 7 `TS6133` dead variables (`viewMode`, `setViewMode`, `setShowEdges`, `svgRef`, `features`, `getConnectedNodes`, `ExternalLink`) — someone started a graph view and did not finish. **Not mine, not fixed** (AGENTS.md §0a). The page may still be half-built underneath this fix.

---

## A. Standing work

### 16. Full audit of the terminal workspace
**Status:** TODO

CZ's ask: *"evaluate everything and see the mount of errors and missing stuff, missing logic, missing code."* Not a single bug — a sweep. Scope: `/terminal` and everything it mounts. Deliverable: a list of what is broken vs merely missing, so fixes can be ordered.

---

## Notes for whoever picks these up

- **Do not fix 6 before 7.** Performance work on a layout that should be replaced is wasted effort.
- **P1/P2 items 9, 10, 11 share one code path.** Fix the file-collection function once; all three fall out of it.
- **Two of these are mine (1, 2).** They shipped because every automated check I wrote fed my own assumptions back into my own parser — the suites were a closed loop. The replacement fixture (`agent/docs/workforce-fixtures/opencode-toolcall-lines.json`) is extracted from the shipped binary instead. See `MEMORY.md`, 2026-10-04.
- **Many files in this area have uncommitted changes from other agents.** Claim before editing (`agent-coordination/coord.mjs`); a `DENIED` claim is a hard stop.
