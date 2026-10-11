# AI Assistant — Capability Audit & Build Roadmap

> **Created:** 2026-10-07 | **Owner:** opencode | **Method:** every number below is a
> `grep`/read of the tree, not an impression. Where something does not exist it says
> **DOES NOT EXIST** rather than being described vaguely.

---

## 0. The headline: two of your three wishes already exist

You asked to build *evaluation*, *automation*, *feature creation*, *scheduling/triggers*,
and *AI tool-calling*. Measured state:

| capability | state | evidence |
|---|---|---|
| **AI tool calling** | ✅ **BUILT** | `src/services/ai/toolRegistry.ts` — **90 tools** registered, `registerAll()` at module load (`:638`) |
| **AI evaluation** | ✅ **BUILT** | `src/services/aiEval.ts` (509 lines) + 10 IPC handlers in `aiEval-handlers.ts` |
| **Automation triggers** | ❌ **UI ONLY** | renderer has the builder; **no table, no IPC, no runner anywhere in `src/main/`** |

So this is not "build it all". It is **"wire the automation engine to the two engines that
already work"** — which is a much smaller and much more valuable job.

---

## 1. What already works (do not rebuild)

### 1.1 Tool calling — 90 tools, with a security ladder

```
src/services/ai/toolRegistry.ts          638 lines
  class ToolRegistry { register / getAll / getByCategory / toOpenAIFunctions / execute }
  execute() is GUARDED:  securityGuard.isLevelAllowed(tool.securityLevel)
                         else throw `Tool X requires <level> access`
  export const toolRegistry = new ToolRegistry()
  registerAll()                            <- called at module load, :638
```

Registered levels: **`read` 42 · `confirm` 51 · `destructive` 0**

`aiAgentService.ts` consumes them and *tells the model about them*:

```
:90   const tools = toolRegistry.getAll()
:91   const readTools   = tools.filter(t => t.securityLevel === 'read')
:92   const writeTools  = tools.filter(t => t.securityLevel === 'confirm')
:96   `Available tools (${tools.length} total):`
:55   maxToolCallsPerRound: 8
:164  const toolCalls = message.tool_calls
:185  Math.min(toolCalls.length, this.config.maxToolCallsPerRound)
```

Tool names include `getGoals`, `decomposeGoal`, `linkGoalToProblem`, `getAllProjects`,
`addProject`, `updateProject`, `deleteProject`, `restoreProject`, `openProject`, …

**Why this matters for your trigger idea:** an automation action and an AI tool are the
*same shape* — a named function with typed params and a security level. The trigger engine
should therefore **reuse `toolRegistry`**, not invent a parallel action system. See §3.

### 1.2 AI evaluation — real scoring, not a progress bar

```
src/services/aiEval.ts                  509 lines
  EvalCheckKind = 'contains' | 'not_contains' | 'json_field' | 'max_latency_ms' | 'regex'
  CaseResult.score   : number   // 0..1, fraction of checks passed
  CaseResult.latencyMs: number | null
```

Its own header states the design intent, including two rules worth keeping:

> 1. …because every judge call costs money and adds latency; a harness that …
> 2. **A scorer that cannot fail is theatre.** Every check returns pass/fail …

IPC surface (`src/infrastructure/ipc/aiEval-handlers.ts`):

```
ai-eval:list-cases   ai-eval:save-case    ai-eval:delete-case   ai-eval:seed-cases
ai-eval:run          ai-eval:list-runs    ai-eval:get-run       ai-eval:compare-runs
ai-eval:delete-run   ai-eval:stats
```

`ai-eval:compare-runs` is the one that matters for continuous improvement: it diffs a run
against a previous one. `AiEvalPanel.tsx` already calls it and holds
`deltaPassRate`. **That is the regression gate you want — it exists and is not wired to CI
or to anything automatic.**

---

## 2. The actual gap: automations have no engine

Measured, exhaustively:

| probe | result |
|---|---|
| `triggerRegistry` consumers | **all renderer** — `nlParser`, `VisualBuilderModal`, `AutomationCard`, `dslGenerator`, `StepTrigger`, `BuilderPreview` |
| `CREATE TABLE … automation` in `src/main/db` | **NONE** |
| `ipcMain.handle('automation…')` | **NONE** |
| automation persistence | **NONE** — `aiAgentService.ts` never mentions it |
| executor / rule evaluator / timer | **NONE** |

**Reading:** you can build an automation in the Visual Builder, and then nothing happens.
There is no store and no runner. The UI is complete and inert.

### 2.1 What exists to build on (renderer side)

```
src/components/ai/automation/triggerRegistry.ts      EVENT_SOURCES
src/components/ai/automations/data/triggerRegistry    getTriggerById, SOURCE_META
src/components/ai/automations/VisualBuilder/         StepTrigger · StepConditions ·
                                                      StepAction · StepConfigure ·
                                                      StepReview · BuilderPreview
src/components/ai/automations/lib/dslGenerator.ts     DSL emission
src/components/ai/automation/nlParser.ts             natural-language → rule
```

The builder already has the five canonical steps (trigger → condition → action → configure
→ review). **The data model is designed; only persistence and execution are missing.**

---

## 3. Build order — deliberately dependency-ordered

### P0 — the execution engine *(the only genuinely missing thing)*

1. **Schema.** `CREATE TABLE automations (id, name, enabled, trigger_json, conditions_json,
   action_json, tool_name, tool_args, created_at, updated_at, last_fired_at, fire_count)`.
   Index on `(enabled)`.
2. **IPC.** `automation:list / save / delete / toggle / fire-now / history`.
3. **Runner.** One `setInterval` in main that reads enabled automations and evaluates
   `trigger_json` against a live event bus.
4. **Event bus.** This is the part with no precedent in the tree, so it must be designed
   with the external AI (see §5). Candidate sources: the 90 `toolRegistry` tools, the PTY
   stream, `logs` inserts, timer fire.
5. **Execution = `toolRegistry.execute(name, args)`.** Same security ladder as the AI. An
   automation must not be able to do something the AI could not, or it becomes a back door
   around `confirm`.

> **Design constraint I am stating up front:** an automation that fires unattended must be
> **restricted to `read` + `confirm` at definition time**, because there is no human in the
> loop when it fires. Whether `confirm` should be *demoted to auto-approve* or *refused*
> is a decision for the external AI — it is the single most consequential choice in this
> roadmap.

### P1 — close the evaluation loop

6. **Schedule `ai-eval:run`** on every merge of a prompt/system-prompt/model change.
   `ai-eval:compare-runs` already computes the delta; surface it as a gate.
7. **Wire `ai-eval:stats` into the AI page** so pass-rate and latency are visible next to
   the thing they measure, not only inside the Eval panel.

### P2 — scheduling that a human can reason about

8. `src/main/gas/scheduler.ts` and `src/main/ai/contextScheduler.ts` are **internal
   housekeeping**, not user-facing automations. Leave them alone; they are not the feature.
9. User-facing "run at 09:00 daily" becomes a `trigger_json` of kind `cron` **inside** the
   automation table — one scheduling mechanism, not two competing ones.

### P3 — feature creation

10. Let the AI propose an automation: the agent already emits `canvas_action` and the page
    already parses it (`intentParser.ts`, `planningParser.ts`). Add one intent type,
    `automation_propose`, that renders the Visual Builder pre-filled. This reuses
    `nlParser`/`dslGenerator` rather than adding a second authoring path.

---

## 4. What I did NOT verify, and why that matters

| claim | status |
|---|---|
| "the automation builder produces valid DSL" | **NOT VERIFIED** — I never rendered the Visual Builder |
| "the 90 tools all work" | **NOT VERIFIED** — count is real, behaviour is not tested |
| "ai-eval:run actually calls the provider chain" | **NOT VERIFIED** — code claims it, nothing has run it |
| automation UI is reachable | `AiPage.tsx:1861` mounts `AiEvalPanel`; the automations route is a **separate** question I did not trace |

**Per AGENTS.md §0-0 I cannot build**, so none of the above can be settled by me at runtime.
Every one needs CZ to build and click.

---

## 5. What goes to the external AI

The genuinely open design questions — the ones a codebase read cannot answer:

1. **Event bus shape.** What is the canonical event envelope, and how does a trigger
   express a predicate over it without becoming a second query language?
2. **Missing-trigger handling.** If a trigger fires while the app is closed, does it run on
   next boot, coalesce, or drop? (Cf. `MEMORY.md`'s tracking-migration lesson: two writers
   accepting writes silently is how data was lost.)
3. **Security level of unattended actions** (above).
4. **Idempotency.** What makes an automation action safe to retry?
5. **DSL stability.** How does a saved `trigger_json` survive the trigger catalogue changing
   underneath it?

Those five, plus the embedded source, are the subject of
`agent/docs/backandfourth-docs/ai-automation-engine/`.

---

## 6. Verification commands (no build required)

```bash
# tool registry really has 90 tools and is registered at boot
grep -cE "^\s*r\('[a-zA-Z]+'" src/services/ai/toolRegistry.ts    # 90
grep -n "registerAll()" src/services/ai/toolRegistry.ts         # :638

# the automation engine does NOT exist yet  <- this is the whole roadmap
grep -rn "ipcMain.handle('automation" src/main.ts | wc -l         # 0
grep -rn "CREATE TABLE.*automation" src/main/db/ | wc -l          # 0
```

When P0 lands, those two counts stop being 0. **That is the definition of done.**
---

## 7. CORRECTION (2026-10-07) — I was wrong about the autonomous system

CZ pushed back: *"it is built, we have the system."* He was right. My audit was invalid.

### What I got wrong

I ran `CREATE TABLE` against `src/main/` — a **directory glob that returned 9 tables** —
and concluded from that absence that no automation/scheduling storage existed. The real
schema is **119 `CREATE TABLE` statements inside `src/main.ts`**, a 30,000-line file I never
searched. **A grep that cannot see the thing must not be cited as evidence that the thing is
absent.** That is the same error class as MEMORY's "a validator with an unused parameter is a
bug report": an empty result from a broken query is not a finding.

I also never mentioned **Conductor** at all. It is the largest autonomous system in the repo.

### The system that exists and works

```
src/services/conductor/ConductorService.ts      875 lines
  AutonomyLevel  = 'L2' | 'L3' | 'L4'
  ConductorStatus = pending | spawning | running | blocked | awaiting-review | done
  spawnNode() -> spawnAgentTerminal -> terminalManager.spawn()   (REAL PTY spawn)
  events: ESCALATE 'escalation.raised', TASK 'node.spawned'
```

Storage — **4 tables in `main.ts`**, all present:
`conductor_missions` (with `autonomy_level`, `status`, `template_id`),
`conductor_nodes` (a mission is a graph: `parent_id`, `role`, `agent_type`, `terminal_id`),
`conductor_escalations` (`status:'pending'`, `decided_at` — the human gate),
`conductor_configs` (`value_json`).

**26 IPC handlers**, all registered and reachable:
`conductor:start · pause · resume · kill · close-node · crowd · set-autonomy ·
send-directive · resolve-escalation · promote · get-snapshot · list-missions · get-config ·
save-config · get-metrics · get-templates · save-template · get-progress · get-budget ·
recover-agent · enforce-boundary · register-provider · list-providers · delete-provider ·
get-mission-history · engineer-workflow`

`getConductorService()` (`main.ts:22855`) instantiates it lazily with **live dependencies**:
`spawnAgentTerminal` really calls `terminalManager.spawn()` and broadcasts
`terminal:spawn-for-conductor` to every window. This is not a stub.

**The human-in-the-loop gate I claimed did not exist** — `ConductorService.ts:633`:

```ts
const autoApprove = mission.autonomyLevel === 'L4' && (reason === 'confidence' || …
```

### The only real break: the UI is orphaned

| layer | state |
|---|---|
| `ConductorService.ts` (875 lines) | ✅ real |
| 26 `conductor:*` handlers | ✅ registered in `main.ts`, exposed in `preload.ts` |
| 4 `conductor_*` tables | ✅ in schema |
| `App.tsx:3815` | ❌ `element={<div …>Conductor…}` — **a placeholder string** |
| `ConductorPage.tsx` (483 lines) | ❌ **zero importers** |
| `ConductorPanel.tsx` | ❌ **zero importers** |

```
$ grep -rn "ConductorPage" src --include=*.tsx | grep -v ConductorPage.tsx
  (zero results)
```

**Nothing is missing except one route element.** The backend can already run autonomous
missions with autonomy levels, escalation, budgets and agent recovery — you cannot reach it.

### This changes the roadmap's central question

§3 P0 asked "build an automation executor". The better question is now:

> **Should a Visual-Builder automation COMPILE INTO A CONDUCTOR MISSION?**

If yes, we inherit mission graphs, L2/L3/L4 autonomy, escalation, budget ceilings,
`enforce-boundary`, agent crash recovery and `engineer-workflow` — none of which we would
otherwise build. The Visual Builder's five steps map onto a mission: trigger → mission
start, condition → node predicate, action → node/agent task, review → `awaiting-review`.

That is a **compile target**, not an executor. `INITIAL_PROMPT.md` has been updated with it.

### Also found, and NOT previously mentioned

- `schedule_entries` / `schedule_templates` — a recurring **timetable**
  (`day_of_week`, `start_time`, `end_time`, `recurrence`), synced to the phone by
  `src/main/syncAgent.ts`. This is the Learn module's calendar, **not** a user automation
  scheduler. Two meanings of "schedule" in one repo — worth disambiguating in the dictionary.
- `tools` table — a **different** tools concept from `toolRegistry`: detected external/MCP
  tools (`install_path`, `detection_method`). Do not conflate them.

### CORRECTION TO THE CORRECTION — the conductor is LIVE, not orphaned

I then claimed the UI was orphaned because `ConductorPage.tsx` has zero importers.
**That was wrong too, and it is the third time in one hour I asserted absence from a single
grep without tracing the subsystem.**

```
TerminalPage.tsx:4555   <ConductorWorkspaceTab activeTab={sub} .../>   ← MOUNTED at /terminal
ConductorWorkspaceTab:249  <MissionWizard .../>                          ← MOUNTED
TerminalPage.tsx:898-934  polls conductorListMissions + conductorGetSnapshot
                          and subscribes to onConductorSnapshot            ← LIVE PUSH
```

The conductor **drives the isometric workforce scene on `/terminal` with live node
snapshots.** It is running. Mission creation is reachable. Nothing is missing.

The ONLY true orphan is `/conductor` (`App.tsx:3815`), a placeholder route pointing at
`ConductorPage.tsx` — **483 lines that duplicate what `ConductorWorkspaceTab` already does
and which nothing imports.** That is dead code to delete or redirect, not a feature to build.

### The transferable lesson (this is the third time today)

| what I asserted | what one grep actually proved |
|---|---|
| "no tables" | a directory glob returned 9 of **119** |
| "no autonomous system" | I never grepped for "conductor" |
| "UI is orphaned" | I checked **one file's** importers, not the subsystem's |

**A grep that has not been shown to be able to see the thing cannot be cited as evidence
that the thing is absent.** Before reporting absence, prove the query works by showing it
finds something that *is* known to exist — the 119-table schema, the 90 tools, the 26
handlers. All three were findable in one command, and I did not run it.
