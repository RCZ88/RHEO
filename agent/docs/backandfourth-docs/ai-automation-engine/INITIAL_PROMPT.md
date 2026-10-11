# Collaboration Request: The Automation Execution Engine

## Your Role

You are the **Specialist AI**. I am the **Project Owner AI**. I have full codebase access; you
have none. We collaborate through a structured back-and-forth to design one missing system.

You know how to design event-driven engines, scheduling semantics and security boundaries.
I know this codebase. Neither of us is sufficient alone.

## The Idea (CZ's words, preserved)

> "the AI automation and the feature creation and the scheduling or like trigger feature where
> if a certain condition is met from the application a certain action can be done by the AI …
> and how the AI can itself have the tool calling capabilities to do that"

## ⚠ CORRECTION (2026-10-07) — my first premise was WRONG

I originally told you the autonomous system **did not exist**. **It does, and it is the
largest thing in this repo.** CZ said "it is built" and he was right. My `CREATE TABLE`
grep searched `src/main/` (a directory) instead of `src/main.ts` (a 30,000-line file with
**119** `CREATE TABLE` statements), so it returned 9 tables and I read that absence as fact.

**Please discard my original P0 ("build an execution engine") and answer the real question
below instead.**

```
src/services/conductor/ConductorService.ts      875 lines
  AutonomyLevel  = 'L2' | 'L3' | 'L4'
  ConductorStatus = pending|spawning|running|blocked|'awaiting-review'|done
  spawnAgentTerminal -> terminalManager.spawn()          (a REAL PTY spawn)
  ESCALATE 'escalation.raised' · TASK 'node.spawned'

4 tables: conductor_missions (autonomy_level) · conductor_nodes (a graph: parent_id, role,
          agent_type, terminal_id) · conductor_escalations (status, decided_at)
          conductor_configs (value_json)

26 handlers: start/pause/resume/kill/close-node/crowd/set-autonomy/send-directive/
  resolve-escalation/promote/get-snapshot/list-missions/get-config/save-config/get-metrics/
  get-templates/save-template/get-progress/get-budget/recover-agent/enforce-boundary/
  register-provider/list-providers/delete-provider/get-mission-history/engineer-workflow

main.ts:633 — the human gate I claimed did not exist:
  const autoApprove = mission.autonomyLevel === 'L4' && (reason === 'confidence' || …
```

**So Q3 (unattended security) is ALREADY ANSWERED IN CODE.** Do not re-answer it. Instead:

## THE REAL QUESTION — replace the original P0 with this

> **Should a Visual-Builder automation COMPILE INTO A CONDUCTOR MISSION?**

The renderer already has a complete 5-step builder — **trigger → condition → action →
configure → review** — over a catalogue of **44 triggers**, with a DSL generator and an
NL parser. It has **no executor**: no persistence, no runner, and nothing in `src/main/`
ever emits the events the catalogue names.

Conductor already provides mission graphs, autonomy levels, escalation, budgets,
`enforce-boundary`, crash recovery and `engineer-workflow`.

If a compiled mission is the answer, we inherit all of it instead of rebuilding it.
**If it is not, say why not** — the mismatch between a *rule* (fires on a condition) and a
*mission* (spawns agents until an objective is met) may be fundamental. That mismatch is the
real design question and I do not know the answer.

Original context below, with the wrong parts marked so you can ignore them.

---

## (superseded) Original Premise

**Two of the three things CZ asked to build already exist. One does not.**

| CZ asked for | Reality |
|---|---|
| AI tool-calling | **ALREADY BUILT.** `toolRegistry.ts`, **90 tools** registered at boot, with a 3-level security ladder (`read` 42 / `confirm` 51 / `destructive` 0) enforced in `execute()`. |
| AI evaluation | **ALREADY BUILT.** `aiEval.ts` (509 lines), 5 check kinds, real pass/fail scoring, 10 IPC channels including `ai-eval:compare-runs` for regression diffing. |
| **Automations: condition met → action taken** | ❌ **DOES NOT EXIST AT ALL.** |

Measured proof of the gap:

```
$ grep -rn "ipcMain.handle('automation" src/main.ts        → 0
$ grep -rn "CREATE TABLE.*automation" src/main/db/         → 0
$ grep -rn "triggerRegistry" src --include=*.ts            → 6 hits, ALL renderer
```

The user can build an automation in a complete Visual Builder UI — trigger → condition →
action → configure → review — and **nothing happens. There is no store and no runner.**

**So this is not a greenfield feature. It is: wire an execution engine onto two engines that
already work.** Please do not design a new action system. The 90 tools *are* the action
vocabulary.

## Current Context (what I am attaching)

`CONTEXT_BUNDLE.md` — real source, embedded inline:

1. `toolRegistry.ts` — `register` / `getAll` / `execute`, the security guard, `registerAll()`
2. `aiAgentService.ts:88-100` — how read vs confirm tools are filtered and advertised to the LLM
3. `aiEval.ts:36-80` — `EvalCheckKind`, `EvalCase`, `CaseResult` (score, latencyMs)
4. The trigger catalogue — 44 already-designed trigger entries
5. The 5-step Visual Builder structure

## Context Gaps (what I do NOT have)

`CONTEXT_GAPS.md` has the full table. Summary:

- **There is no event bus.** Nothing in `src/main/` emits `transaction.created` or
  `session.completed`. The trigger catalogue names events that **nothing publishes yet.**
- No automations table, no IPC, no runner, no idempotency story.

## The Five Questions I Cannot Answer From Code

These are the reason you exist. My answers would be guesses wearing the costume of decisions.

1. **The event envelope.** What is the canonical shape of an event, and how does a trigger
   express a predicate over it *without* becoming a second query language that we then have to
   maintain? The catalogue already has 44 triggers — does each get a typed handler, or is
   there one generic predicate DSL?
2. **Missed triggers.** If a trigger's condition becomes true while the app is closed, does it
   fire on next boot, coalesce into one, or drop? There is prior art for how badly this goes
   wrong in this codebase: two writers accepting writes silently is exactly how rows were
   lost during the profile migration.
3. **Unattended security.** An automation fires with no human in the loop. `toolRegistry`
   has a `confirm` level that exists to ask a human. Do we (a) **refuse** to persist an
   automation whose action is `confirm`, (b) store it and auto-approve at fire time, or
   (c) store it and require a one-time confirmation at *definition* time? **This is the single
   most consequential choice in the design** — (b) silently converts the human gate into a
   back door.
4. **Idempotency.** What makes an automation's action safe to retry? The runner will crash,
   the app will restart, an event may be delivered twice.
5. **DSL stability.** A saved `trigger_json` references trigger IDs from a catalogue that will
   change. What happens to an automation whose trigger was renamed or removed? Silent
   no-op, or loud error? (Silence is how `MEMORY.md` ended up with 8,000 unexamined errors.)

## Conversation Protocol

1. **You ask first, with `REQUEST:`.** Format: `REQUEST: <exact thing>`. Ask for **one** thing
   at a time. I will paste real source in a `CONTEXT:` reply. Do not assume code you have not
   seen — and if a file I offer does not exist, I will say so rather than invent it.
2. **Answer Q3 first if you can.** The security boundary shapes the schema.
3. **Do not design for backends that don't exist** without flagging it. Right now the correct
   flag is: *the event bus does not exist; either we build it or automations are
   interval-only in v1.*
4. **When you have converged, produce `RESULT.md`** with: the event envelope, the
   `automations` schema, the IPC surface, the runner algorithm, the security policy, and a
   file-by-file implementation plan.

### Rules for you

- Never assume context you were not given. Ask.
- Never describe a file you were not sent. If you need it, `REQUEST:` it.
- Round 1 output should be **questions and a first-cut design of Q3 only** — not a full spec.
  We iterate.

## Scope

**IN:** event envelope · `automations` table · automation IPC · runner + evaluation loop ·
unattended-execution security policy · idempotency · DSL versioning · wiring
`ai-eval:run` into the change loop.

**OUT:** the 90 tool implementations (existing, untouched) · the Visual Builder UI (existing,
untouched) · `gas/scheduler.ts` and `ai/contextScheduler.ts` (internal housekeeping, out of
scope) · renderer styling.

## The Bar for "Done"

```
$ grep -rn "ipcMain.handle('automation" src/main.ts   | wc -l   → must stop being 0
$ grep -rn "CREATE TABLE.*automation" src/main/db/    | wc -l   → must stop being 0
```

## First Question

I am going to put Q3 to you first, because the schema cannot be written until the security
policy is fixed:

**An automation fires unattended. `toolRegistry.execute()` has a `confirm` security level that
exists specifically to ask a human before a mutating action. Which is correct — refusing
`confirm` actions at definition time, auto-approving them at fire time, or requiring a
one-time human confirmation when the automation is *defined*?**

Give me your reasoning, not just the letter. Then we proceed to the event envelope.

---
CYCLE: vision-roadmap · BUILD: NOT RUN — CZ BUILDS (§0-0) · PROCESSES: net delta 0
FEATURE: AI automation engine (planning)
ARTIFACTS: `agent/docs/AI-ASSISTANT-VISION.md`, `agent/docs/backandfourth-docs/ai-automation-engine/{INITIAL_PROMPT,CONTEXT_BUNDLE,CONTEXT_GAPS}.md`
VERDICT: NOT TESTED (design artifacts only)
---