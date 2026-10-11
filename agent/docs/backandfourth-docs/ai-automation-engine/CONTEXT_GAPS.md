# CONTEXT GAPS — AI Automation Engine

> What the external AI does **not** have, and how to get it. Measured 2026-10-08.

## What I HAVE and am embedding in CONTEXT_BUNDLE.md

| context | status | source |
|---|---|---|
| Tool registry + security ladder | ✅ have | `src/services/ai/toolRegistry.ts` (638 lines, `register()`/`getAll()`/`execute()`) |
| Agent tool handoff to the LLM | ✅ have | `src/services/ai/aiAgentService.ts:88-100` |
| Eval check kinds + result shape | ✅ have | `src/services/aiEval.ts:36-80` |
| Eval IPC surface (10 channels) | ✅ have | `src/infrastructure/ipc/aiEval-handlers.ts` |
| Trigger catalogue (44 entries) | ✅ have | `src/components/ai/automation/triggerRegistry.ts` |
| Visual Builder 5-step model | ✅ have | `src/components/ai/automations/VisualBuilder/` |

## What is MISSING — the whole point of this collaboration

| context needed | status | how to obtain |
|---|---|---|
| **Any event bus** | ❌ **DOES NOT EXIST** | Nothing emits `transaction.created` etc. anywhere in `src/main/`. Ask me to trace a candidate emitter. |
| **Automations table** | ❌ **DOES NOT EXIST** | `grep -rn 'CREATE TABLE.*automation' src/main/db` → 0. I will design it; you review it. |
| **Automation IPC** | ❌ **DOES NOT EXIST** | `grep "ipcMain.handle('automation"` → 0. |
| **Runner / rule evaluator** | ❌ **DOES NOT EXIST** | No timer reads automations. |
| DB conventions (migration style) | ⚠️ partial | Ask: "REQUEST: an existing CREATE TABLE + its migration for a config-shaped table" |
| How a PTY/tool event could be published | ❌ missing | Ask: "REQUEST: the emitter behind one existing `read` tool" |

## Deliberately NOT asked for

- The 90 tool *implementations* — they are 400-line API wrappers and would blow the token budget. Ask for one representative if you need the calling convention.
- Renderer styling — not relevant to an engine design.
