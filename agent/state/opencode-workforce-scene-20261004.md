<!-- SESSION: opencode-workforce-scene-20261004 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: App Tracker -->

# Agent State — opencode-workforce-scene-20261004

> **STATUS:** working | **UPDATED:** 2026-10-04T12:40:00Z

---

## CURRENT CYCLE (2)
**ROLE:** Implement "Connecting the Workforce Scene to the Terminal Infrastructure" (integration plan) against the RHEO Workforce visual reference, wired into the real PTY path.
**STATUS:** completed
**IN FLIGHT:**
- terminal problem list — 3 of 16 fixed, all awaiting CZ's build
**COMPLETED:**
- `src/shared/workforceActivity.ts` — the §2 contract + `classifyAction` + field extractors. Verified tool registry, not guessed.
- `src/main/workforceAdapters.ts` — per-session line buffer, per-agent line adapters, 100ms batched sender, §8.2 recorder.
- `src/main.ts` — hooked AFTER `parseAgentOutput` in `handleAgentOutputChunk`; `broadcast('workforce:event')`.
- `src/preload.ts` — `onWorkforceEvent(cb)` returning an unsubscriber.
- `workforceStore.ts` — §4 pure reducer + subscribe store + §5/§6 helpers.
- `workforceSceneModel.ts` — ActionKind→station→pose table, §8.8 corridor pathfinding, §8.3 timing machine.
- `WorkforceStations.tsx` (§8.10), `IsometricWorkforceScene.tsx`, `WorkforceInspector.tsx`, `useWorkforceFeed.ts`, `workforce-iso.css`.
- **CYCLE 1b — MOUNTED.** `WorkforcePanel.tsx` owns the whole integration; `TerminalPage.tsx:3364` mounts it, replacing `<AgentAmbientAnimation>`. Wired to the real calls: `setActiveTerminalId` + `focus-terminal` event, `closeTerminal`, `handleResumeSession`, `conductorCloseNode(..., {checkpointFirst:true})`.
- **216 assertions across 4 suites, all passing** (105 logic, 32 tool-coverage, 35 opencode-line fixture, 43 render). All 3 probes + extractor persisted in `agent/docs/workforce-fixtures/` (they used to live only in /tmp and a subagent's cleanup deleted one).
- `agent/SURFACES.md` + `agent/docs/workforce-fixtures/README.md` written by parallel subagents.
**CYCLE 2 — CZ-reported terminal bugs.** Created `agent/docs/TERMINAL_PROBLEMS.md` (16 items). Fixed 3:
- **ArchMapPage crash (P1)** — real IPC contract mismatch: main returns `{success,data:{nodes,edges,stats}}`, renderer stored the wrapper so `mapData.nodes` was always undefined. Page never worked. Normalised at the only write site. 10 assertions.
- **Workforce shows ~7 workers with 0 terminals (P1, mine)** — panel now filters to `w.open`.
- **Close worker dead (P1, mine)** — passed `conductor:<id>` instead of bare node id; now unwraps and REPORTS failure inline.
**NEXT ACTION:** next on CZ's list — AI Gateway (P0 #3/#4) and provider loading (P0 #5), or the terminal sidebar architecture proposal (P0 #7) which CZ said should be decided BEFORE the lag work.
**CYCLE 1c — THE PARSER WAS WRONG, now fixed from the binary.** opencode prints `Read src/main.ts`, NOT `Read(src/main.ts)`. The old `Name(arg)` regex matched **0 of 29** real lines while 181 assertions passed — every test fed my assumed format into my own parser. Extracted the real render templates from `~/.opencode/bin/opencode` via `grep -a` on the 185MB bun ELF and reimplemented `extractOpencodeAction`. That also surfaced 3 more bugs the green suite had missed: MCP tools render from `frame.state.title` so all 124 returned null; status glyphs listed as resultMarkers would have discarded every *completed* call; and extracted `result` was dropped when the event was built, so a failed call showed a healthy worker. New fixture `opencode-toolcall-lines.json` (29 rows, provenance from the binary) + `verify-opencode-lines.cjs` (35 assertions).
**NOTES:**
- Verification: 216 assertions / 4 suites. `tsc` scoped to my 9 workforce files = **0 errors**; TerminalPage errors attributable to the mount = **0** (99 there are pre-existing). `main.ts` syntax-only esbuild = OK.
- NOT MINE, left alone per §0a: `validate:pages` reports `/agentic` has no manifest; `workforce.css` + `conductorWorkforce.ts` have uncommitted diffs from another agent.
- `MEMORY.md` is at 254 entries vs its own 10-entry cap and is not date-sorted — flagged to CZ, not reorganised (§0.5).

---

## HISTORY (previous cycles, oldest first)
(none — first cycle for this session)
