<aside>
⚠️

Status: all six rounds are **diagnosed only** — nothing has been applied to the codebase yet. This page is a memory of every expected fix, mapped to the workspace part and exact code location. Update the Testing Log as you apply and verify each fix.

</aside>

## Two systemic root causes

Fix these and most symptoms collapse.

<aside>
1️⃣

**Scaffolding never writes the `agent/` tree** (origin: Round 1). `runInitAll` creates directories but never writes the files the app later reads — `RULES_COMPACT.md`, `state.md`, `patterns.md`, `problems.json`, 18× `SKILL.md`, `graph.json`, `*.qmd`, `agent/context/`. Confirmed downstream in Round 6: context assembly and skills silently return empty, so agents launch blind with **no error**.

</aside>

<aside>
2️⃣

**Raw `terminalWrite` fragmentation** (recurs in R2, R4, R5, R6). Multi-line content written to a raw PTY submits each embedded newline as its own line. Affects init content, `/sync` summaries, and routed sends. Fix class: route multi-line payloads through `agentSend` / bracketed paste — never raw `terminalWrite`.

</aside>

## Per-area expected fixes

### R1 — Initialize / Provisioning · CRITICAL

Workspace part: project bootstrap, InitializeProgressModal, IDEProjectsPage.

- Make `runInitAll` (main.ts:14230-15645) actually **write** every file, not just create empty dirs.
- Fix baseDir cwd-fallback bug (main.ts:15651-15658) so files land in the real project path.
- Implement `tracker-mind-generate` (TODO at main.ts:15647).

### R2 — Terminal spawn + agent readiness · HIGH

Workspace part: `spawnTerminal`, `initializeTerminal`, agent status machine.

- `spawnTerminal` wrapper drops the 3rd arg `agentType` (TerminalPage.tsx:1442) → `agentStates` seeds `'opencode'` → wrong `readyRegex`. Forward `agentType`.
- No init timeout on `initializeTerminal` → hangs forever. Add a timeout.
- `terminal:exit` name mismatch in preload (preload.ts:276 `'terminal-exit'`).
- Fake `terminal:ready` fires before the agent is actually ready.

### R3 — Save/Load workspace + configs + move-to-group · HIGH

Workspace part: `workspace:save/load`, `terminal_layouts`, MiniMap.

- `workspace:save` drops 5/10 fields (main.ts:8527): layout, openFiles, activeTerminalId, todos, presets.
- `handleLoadWorkspace` (TerminalPage.tsx:1397) ignores terminal tabs/layout.
- Empty catch swallows save errors (TerminalPage.tsx:1383).
- MiniMap cross-group move missing (TerminalMiniMap.tsx:120).
- DB: add `state_json TEXT` to `workspace_state`.

### R4 — Compose / Quick Send → agent routing · HIGH

Workspace part: send pipeline, `agent:send` queue, completion detection.

- Inconsistent channels: @mention/default use `terminalWrite` (1137); only auto-assign uses `agentSend`. Unify on `agentSend`.
- Double `\r\n` on queued old-format sends.
- `failPendingWrites` only fails the newest row (main.ts:8003, `LIMIT 1` bug).
- `markTaskCompleted` all-or-nothing (7507/7511).
- Completion gated on `promptSeen` can stick forever (7847).
- `handleInstructionPanelSend` ignores the panel agent (914).

### R5 — Sessions tab + cross-session sync · LOW–MED

Workspace part: `terminal_sessions`, `/sync`, resume, delete.

- **PRIMARY:** `/sync` writes multi-line markdown via `terminalWrite` (TerminalPage.tsx:863) → fragmentation. Route via `agentSend`. *(Root 2)*
- No cascade delete (main.ts:8296): orphans `terminal_messages`, `terminal_bindings`, `session_parsed_items`. Add cascade.
- Resume inherits the R2 agentType bug + unverified `resumeId` (saved as `openCodeSessionId` at init:1682). Validate before `${agent} -s ${resumeId}`.
- No restart reconstruction / no drift reconciliation (ties to R3).
- Perf: `auto_tags` regenerated on every send (main.ts:7486).

### R6 — Context assembly + Skills + Files · PRIMARY symptom HIGH

Workspace part: ContextService, Skills tab, Files tab.

- **A:** Scaffolding (Root 1 dependency) — write the files `assembleContext` reads.
- **B:** `assembleContext` (ContextService.ts:128-216) should return `missingLayers` and warn visibly instead of launching blind.
- **C:** Init content injected via `agentSend`, not `terminalWrite` (TerminalPage.tsx:3911). *(Root 2)*
- **D:** Compose skill picker is a no-op (833-963) — concatenate `composeSkills` `SKILL.md` content like `handleUse` (4941-4960).
- **E:** Cache `assembleContext` (no cache today); invalidate on `write-project-file` + `setPreference`.
- **F:** Files tab `projectPath`/selector + load-error surfacing (PROBLEMS.md:239-244).

## Recommended fix sequence

1. **Root 1** — R1 scaffolding + baseDir (unblocks context + skills).
2. **Root 2** — replace raw `terminalWrite` with `agentSend` everywhere multi-line content is sent: R6 init (3911), R5 `/sync` (863), R4 routed sends (1137).
3. R2 spawn/readiness (agentType forward + init timeout + exit name + real ready).
4. R4 routing correctness (queue, `failPendingWrites`, completion gating).
5. R3 save/load (`state_json`, restore tabs/layout).
6. R5 cascade delete + resume validation + reconciliation.
7. R6 B/D/E/F (completeness warning, skill picker, cache, Files tab).

## Verification checklist

- [ ]  Fresh provision writes real files (RULES_COMPACT, state, patterns, problems.json, SKILL.md × N, graph.json, *.qmd).
- [ ]  `assembleContext` returns a non-empty multi-layer string; `missingLayers` empty.
- [ ]  Init content arrives as ONE message (no fragmented lines in PTY).
- [ ]  Non-opencode agents reach `ready` (no wrong readyRegex).
- [ ]  `initializeTerminal` times out instead of hanging.
- [ ]  Save then Load restores tabs + layout + open files.
- [ ]  @mention/default sends use `agentSend`; no double newlines.
- [ ]  `/sync` arrives as one message to the right terminal.
- [ ]  Deleting a session removes its messages/bindings/parsed items.
- [ ]  Compose-picked skills appear in the sent prompt.
- [ ]  Repeated sends do not re-read the whole `agent/` tree.
- [ ]  Files tab lists real files; clear message when no project selected.

## Testing log

Fill this in after applying fixes and report back.

| Round / Fix | Applied? | Works? | Remaining problem |
| --- | --- | --- | --- |
| R1 — Scaffolding |  |  |  |
| R2 — Spawn/readiness |  |  |  |
| R3 — Save/Load |  |  |  |
| R4 — Routing |  |  |  |
| R5 — Sessions/sync |  |  |  |
| R6 — Context/Skills/Files |  |  |  |

<aside>
📁

Full per-round fix specs live in the downloadable `Q&A/` folder: `02-terminal-spawn-agent-readiness.md`, `03-workspace-save-load-configs-move.md`, `04-compose-quicksend-routing.md`, `05-sessions-cross-session-sync.md`, `06-context-skills-files.md`, plus this `00-SUMMARY.md`. Round 1 was diagnosed in chat; ask to backfill `01-initialize.md` if you want the complete set.

</aside>