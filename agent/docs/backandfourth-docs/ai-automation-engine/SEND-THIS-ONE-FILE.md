# Collaboration Request: Automations — should they compile into Conductor missions?

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


*(Everything the earlier drafts asked you to open in a separate file is folded into
Parts 2-4 below, with the source quoted inline. This document is all you need.)*

---
# PART 2 — THE EXISTING IMPLEMENTATION (all of it, inline)

You have no file access. Everything below is quoted verbatim from the tree on
2026-10-07. Where something does **not** exist it says so explicitly.

## 2.1 What this application IS

DeskFlow / RHEO — Electron + React + better-sqlite3 desktop productivity tracker.
`src/main.ts` is a ~31,000-line main process; SQLite for storage.

- Routes: **35**
- Database: **114 tables in src/main.ts, grouped:**
- IPC: **570 ipcMain.handle channels. Groups:**

### Routes
```text
/
/activity
/agentic
/ai
/browser
/compositions
/conductor
/database
/external
/finance
/guide
/ide
/ide-help
/labs
/learn
/lecture/*
/life
/old-dashboard
/penguin-console
/pricing
/productivity
/profiler
/rankings
/reports
/resume
/resume/build
/resume/export
/resume/import
/resume/preview
/settings
/simple-terminal
/stats
/studio
/terminal
/transcripts
```

### The AI assistant lives at `/ai`. Its five rail destinations (real source):
```ts
c
o
n
s
t
 
A
I
_
S
U
R
F
A
C
E
S
 
=
 
[


 
 
{
 
i
d
:
 
'
b
r
a
i
n
'
,
 
 
 
l
a
b
e
l
:
 
'
C
o
n
t
e
x
t
 
B
r
a
i
n
'
,
 
s
h
o
r
t
:
 
'
B
r
a
i
n
'
,
 
 
 
i
c
o
n
:
 
B
r
a
i
n
,
 
 
 
 
 
 
 
 
h
i
n
t
:
 
'
w
h
a
t
 
t
h
e
 
a
s
s
i
s
t
a
n
t
 
k
n
o
w
s
'
 
}
,


 
 
{
 
i
d
:
 
'
c
o
n
t
e
x
t
'
,
 
l
a
b
e
l
:
 
'
C
o
n
t
e
x
t
'
,
 
 
 
 
 
 
 
s
h
o
r
t
:
 
'
C
o
n
t
e
x
t
'
,
 
i
c
o
n
:
 
M
e
s
s
a
g
e
S
q
u
a
r
e
,
 
h
i
n
t
:
 
'
p
i
n
n
e
d
 
m
a
t
e
r
i
a
l
'
 
}
,


 
 
{
 
i
d
:
 
'
v
a
u
l
t
'
,
 
 
 
l
a
b
e
l
:
 
'
D
e
b
u
g
 
V
a
u
l
t
'
,
 
 
 
s
h
o
r
t
:
 
'
V
a
u
l
t
'
,
 
 
 
i
c
o
n
:
 
B
u
g
,
 
 
 
 
 
 
 
 
 
 
h
i
n
t
:
 
'
e
v
e
r
y
 
A
I
 
c
a
l
l
,
 
w
i
t
h
 
c
o
s
t
'
 
}
,


 
 
{
 
i
d
:
 
'
e
v
a
l
s
'
,
 
 
 
l
a
b
e
l
:
 
'
A
I
 
E
v
a
l
'
,
 
 
 
 
 
 
 
s
h
o
r
t
:
 
'
E
v
a
l
'
,
 
 
 
 
i
c
o
n
:
 
F
l
a
s
k
C
o
n
i
c
a
l
,
 
h
i
n
t
:
 
'
r
e
g
r
e
s
s
i
o
n
 
c
h
e
c
k
s
'
 
}
,


 
 
{
 
i
d
:
 
'
r
o
u
t
e
r
'
,
 
 
l
a
b
e
l
:
 
'
A
I
 
R
o
u
t
e
r
'
,
 
 
 
 
 
s
h
o
r
t
:
 
'
R
o
u
t
e
r
'
,
 
 
i
c
o
n
:
 
P
l
u
g
,
 
 
 
 
 
 
 
 
 
h
i
n
t
:
 
'
p
r
o
v
i
d
e
r
s
 
a
n
d
 
f
a
l
l
b
a
c
k
s
'
 
}
,


]
 
a
s
 
c
o
n
s
t
;
```

### The AI surface
```text
121 .tsx under src/components/ai/:
  automation               2 files
  automations              2 files
  automations/VisualBuilder   7 files
  canvas                  18 files
  canvas/cards            19 files
  canvas/shared            2 files
  chat                    19 files
  chat/renderers          10 files
  compositions             5 files
  connectors               2 files
  deck                     1 files
  digest                   1 files
  focus                    2 files
  plan                     2 files
  primitives              11 files
  reflect                  1 files
  reminders                1 files
  src/components/ai       15 files
  summary                  1 files
```

### All 90 AI tools
Each is `r(name, description, parameters, securityLevel, category, handler)`.
securityLevel string counts: {'read': 42, 'confirm': 51}


```text
90 registered tools (name, description, params, level, category):
  getGoals
  getGoalsBatch
  getLongtermGoals
  saveLongtermGoal
  deleteLongtermGoal
  saveGoal
  deleteGoal
  saveGoalReview
  getGoalContext
  getGoal
  getChildGoals
  decomposeGoal
  linkGoalToProblem
  linkGoalToRequest
  unlinkGoalFromProblem
  unlinkGoalFromRequest
  getProjects
  getAllProjects
  getProjectDetails
  addProject
  updateProject
  deleteProject
  restoreProject
  openProject
  calculateProjectHealth
  getCommitStats
  getExternalActivities
  addExternalActivity
  updateExternalActivity
  deleteExternalActivity
  startExternalSession
  stopExternalSession
  getExternalSessions
  getExternalStats
  addExternalTime
  getActiveExternalSession
  getSleepForDate
  addManualSleep
  updateManualSleep
  getSleepTrends
  getPreferences
  setPreference
  getExternalSettings
  setExternalSettings
  getCategoryConfig
  getTierAssignments
  setAppCategory
  setDomainCategory
  setAppTier
  setDomainTier
  setTierAssignments
  getIDEProjectsOverview
  getTerminalSessions
  getProblems
  updateProblemStatus
  deleteProblem
  getRecordingModes
  setRecordingMode
  getBrowserCategoryStats
  getAiContext
  getRequests
  getAIUsageSummary
  getDashboardAggregates
  getInterestTopics
  addInterestTopic
  removeInterestTopic
  addProblemCheck
  addRequestCheck
  completeCheck
  getProblemChecks
  getRequestChecks
  getWorkspaceState
  getTerminalSessionsRich
  getTerminalMessages
  getTutorialStatus
  startFeatureTutorial
  getPrompts
  createPrompt
  updatePrompt
  getConnectors
  getConnectorItems
  replyToEmail
  createCalendarEvent
  updateCalendarEvent
  deleteCalendarEvent
  markEmailRead
  createScheduleFromEmail
  createDeadlineFromEmail
  createDashboardCard
  navigateToPage
```

### AI-domain tables
```text
AI-domain tables:
  ai_usage
  ai_briefs
  ai_interests
  ai_feature_usage
  ai_attribution
  ai_chat_messages
  ai_chat_threads
  ai_chat_memories
  ai_context_captures
  ai_context_groups
  ai_memory_context
```

### IPC channels, grouped
```text
570 ipcMain.handle channels. Groups:
  get              136
  ai               29
  conductor        26
  set              21
  stt              19
  update           17
  save             17
  terminal         16
  brain            15
  delete           14
  aigateway        11
  add              11
  design           9
  agent            9
  context          9
  chat             9
  backup           7
  read             7
  clear            6
  memory           6
  todo             6
  detect           5
```

---

## 2.2 THE TOOL REGISTRY — how an action is expressed

`src/services/ai/toolRegistry.ts`. This is the **action vocabulary of the whole app**.
An AI tool and an automation action are the same shape, so an automation can never be
able to do something the AI could not.

```ts
import type { AiTool, ToolParameter } from './types'
import { securityGuard } from './securityGuard'

const api = (window as any).deskflowAPI

function p(type: ToolParameter['type'], description: string, extra?: Partial<ToolParameter>): ToolParameter {
  return { type, description, ...extra }
}

export class ToolRegistry {
  private tools = new Map<string, AiTool>()

  register(tool: AiTool) {
    this.tools.set(tool.name, tool)
  }

  get(name: string): AiTool | undefined {
    return this.tools.get(name)
  }

  getAll(): AiTool[] {
    return Array.from(this.tools.values())
  }

  getByCategory(category: string): AiTool[] {
    return this.getAll().filter(t => t.category === category)
  }

  getOpenAISpecs(): Array<{
    type: 'function'
    function: { name: string; description: string; parameters: any }
  }> {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.toOpenAIProps(tool.parameters),
          required: Object.entries(tool.parameters)
            .filter(([_, p]) => p.required)
            .map(([k, _]) => k),
        },
      },
    }))
  }

  async execute(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)

    if (!securityGuard.isLevelAllowed(tool.securityLevel)) {
      throw new Error(`Tool ${name} requires ${tool.securityLevel} access`)
    }

    const rateCheck = securityGuard.checkRateLimit()
    if (!rateCheck.allowed) throw new Error(rateCheck.reason)

    const validation = securityGuard.validateParams(args, tool.parameters)
    if (!validation.valid) throw new Error(validation.error)

    return securityGuard.audited(name, args, () => tool.handler(args))
  }

  private toOpenAIProps(params: Record<string, ToolParameter>): Record<string, any> {
    const props: Record<string, any> = {}
    for (const [key, def] of Object.entries(params)) {
      props[key] = {
        type: def.type,
        description: def.description,
        ...(def.enum ? { enum: def.enum } : {}),
        ...(def.properties ? { properties: this.toOpenAIProps(def.properties) } : {}),
        ...(def.items ? { items: { type: def.items.type, description: def.items.description } } : {}),
      }
    }
    return props
  }
}
```

Registration at the bottom of the file:
```ts
success: true,
      data: { message: `Added ${params.type} card to dashboard`, cardId: params.id }
    };
  })
  }

  registerAll()
```

### A `read` tool in full
```ts
NOT FOUND
```

### A `confirm` (mutating) tool in full
```ts
NOT FOUND
```

### How the agent advertises them to the model
```ts
return [...this.conversationHistory]
  }

  getSystemPrompt() {
    const tools = toolRegistry.getAll()
    const readTools = tools.filter(t => t.securityLevel === 'read')
    const writeTools = tools.filter(t => t.securityLevel === 'confirm')

    return `${SYSTEM_PROMPT_BASE}

Available tools (${tools.length} total):
- READ only (${readTools.length}): ${readTools.map(t => t.name).join(', ')}
- WRITE/DELETE (${writeTools.length}, require confirmation): ${writeTools.map(t => t.name).join(', ')}

Security: ${JSON.stringify(securityGuard.getStats())}`
  }

  async getSystemPromptAsync(): Promise<string> {
    const basePrompt = this.getSystemPrompt()
    const connectorContext = await this.buildConnectorContext()
```

### The agent loop consuming `tool_calls`
```ts
return fallback
      }

      const message = response.choices[0].message
      const toolCalls = message.tool_calls

      if (!toolCalls || toolCalls.length === 0) {
        console.log(`[AiAgent] Round ${round}: no tool calls, content="${(message.content || '').slice(0, 80)}"`)
        this.conversationHistory.push({ role: 'assistant', content: message.content || '' })
        finalResponse = message.content || 'Done.'
        this.progressCallback?.({ round, totalRounds: this.config.maxRounds, status: 'completed', message: 'AI response generated' })
        break
      }

      console.log(`[AiAgent] Round ${round}: ${toolCalls.length} tool call(s): ${toolCalls.map((tc: any) => tc.function.name).join(', ')}`)
      this.conversationHistory.push({
        role: 'assistant',
        content: message.content || `[Using ${toolCalls.length} tool(s)...]`,
        toolCalls: toolCalls.map((tc: any) => ({
```

---

## 2.3 CONDUCTOR — the autonomous system (875 lines, fully live)

Reached from `/terminal` -> `ConductorWorkspaceTab` -> `MissionWizard`.
`TerminalPage.tsx:898-934` polls snapshots and subscribes to `onConductorSnapshot`.

### Status and autonomy types
```ts
export type ConductorStatus = 'pending' | 'spawning' | 'running' | 'blocked' | 'awaiting-review' | 'done' | 'failed' | 'killed';
export type AutonomyLevel = 'L2' | 'L3' | 'L4';
export type EscalationReason = 'policy' | 'budget' | 'confidence' | 'blast-radius' | 'merge-conflict' | 'goal-proposal';
export type EscalationDecision = 'approved' | 'rejected';

export interface SessionSpec {
  session_id: string;
  parent: string | null;
  scope: { type: 'mission' | 'subtask'; page: string; tab: string };
  objective: string;
  output_contract: string;
  tools: string[];
  boundaries: string[];
  budget: { tokens: number; wall_clock_min: number; max_retries: number };
  recursion: { can_spawn_child
```

### The mission node — the unit of work
```ts
export interface ConductorNode {
  id: string;
  missionId: string;
  parentId: string | null;
  role: ConductorRole;
  agentType: string;
  terminalId: string;
  worktreePath: string;
  branch: string;
  objective: string;
  status: ConductorStatus;
  depth: number;
  retries: number;
  boundaries: string[];
  createdAt: number;
  lastActivityAt: number;
  budgetWarned?: boolean;
}

export interface ConductorMessage {
  id: string;
  missionId: string;
  ts: number;
  from: string;
  to: string;
  type: 'TASK' | 'REPORT' | 'ESCALATE' | 'DIRECTIVE' | 'MERGE_OK' | 'MERGE_CONFLICT' | 'INFO';
  summary: string;
  payload?: any;
}

export interface EscalationItem {
  id: string;
  missionId: string;
  nodeId: string | null;
  reason: EscalationReason;
  detail: string;
  status: 'pending' | 'approved' | 'rejected';
  creat
```

### THE HUMAN GATE — already implemented, at ConductorService.ts:633
```ts
const autoApprove = mission.autonomyLevel === 'L4' && (reason === 'confidence' || reason === 'goal-proposal');
    const esc: EscalationItem = {
      id: nowId('esc'),
      missionId: mission.id,
      nodeId,
      reason,
      detail,
      status: autoApprove ? 'approved' : 'pending',
      createdAt: Date.now(),
    };
    mission.escalations.push(esc);
    this.msg(mission, nodeId || 'conductor', 'boss', 'ESCALATE', detail);
    if (autoApprove) this.applyEscalationDecision(mission, esc);
  }

  private proposeGoal(mission: Mission, fromNode: ConductorNode, goal: string) {
    this.raiseEscalation(mission, fromNode.id, 'goal-proposal', goal);
  }

  private applyEscalationDecision(mission: Mission, esc
```

### Storage — 4 tables, quoted from src/main.ts
```sql
-- conductor_missions: NOT FOUND

-- conductor_nodes: NOT FOUND

-- conductor_escalations: NOT FOUND

-- conductor_configs: NOT FOUND
```

### Its 26 IPC channels
```text
conductor:close-node
conductor:crowd
conductor:delete-provider
conductor:enforce-boundary
conductor:engineer-workflow
conductor:get-budget
conductor:get-config
conductor:get-metrics
conductor:get-mission-history
conductor:get-progress
conductor:get-snapshot
conductor:get-templates
conductor:kill
conductor:list-missions
conductor:list-providers
conductor:pause
conductor:promote
conductor:recover-agent
conductor:register-provider
conductor:resolve-escalation
conductor:resume
conductor:save-config
conductor:save-template
conductor:send-directive
conductor:set-autonomy
conductor:start
```

---

## 2.4 AI EVAL — the measurement harness (509 lines)

```ts
export type EvalCheckKind = 'contains' | 'not_contains' | 'json_field' | 'max_latency_ms' | 'regex';

export interface EvalCheck {
  kind: EvalCheckKind;
  /** For contains / not_contains / json_field / regex */
  value?: string;
  /** For json_field: dotted path, e.g. "summary" or "items.0.title" */
  path?: string;
  /** For max_latency_ms */
  ms?: number;
  /** Human label shown in the UI when
```
```ts
export interface CaseResult {
  id: string;
  name: string;
  feature: string;
  status: 'pass' | 'fail' | 'error';
  score: number;               // 0..1, fraction of checks passed
  latencyMs: number | null;
  costUsd: number | null;
  provider: string | null;
  model: string | null;
  output: string;
  /** One entry per check. Empty array means the case had no assertions. */
  failures: string[];
  error?: string;
  at: number;
}

export interface EvalRun {
  id: string;
  label: string;
  startedAt: number;
  finishedAt: number | null;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  meanScore
```
```ts
export interface RunOptions {
  label?: string;
  feature?: string;
  caseIds?: string[];
  /** Providers state. Supplied by main.ts, which owns userPreferences. */
  providersState: AiProvidersState;
  /** Structural-only today. Reserved so a judge can be added without a
   *  signature change; ignored rather than silently pretending to run. */
  judge?: 'structural' | 'llm';
}

export async function runEval(opts: RunOptions): Promise<EvalRun & { results: CaseResult[] }> {
  const runId = `run_${Date.now().toString(36)}_${
```

### Its 10 channels
```text
ai-eval:list-cases
ai-eval:save-case
ai-eval:delete-case
ai-eval:seed-cases
ai-eval:run
ai-eval:list-runs
ai-eval:get-run
ai-eval:compare-runs
ai-eval:delete-run
ai-eval:stats
```

---

## 2.5 AUTOMATIONS — the one genuine gap

### The trigger catalogue
```text
44 trigger ids:
  finance
  transaction.created
  transaction.updated
  budget.exceeded
  subscription.due
  focus
  session.started
  session.completed
  goals
  goal.created
  goal.completed
  goal.progress
  learning
  note.created
  note.summarized
  ide
  project.opened
  build.completed
  system
  app.launched
  app.quit
  tracking
  window.changed
  amount
  category
  status
  account
  duration
  category
  progress
  status
  note_count
  status
  project
  duration
  status
  app
  category
  eq
  neq
  gt
  gte
  lt
  lte

distinct sources: []
```

### The Visual Builder, which is complete
```text
builder step components:
  BuilderPreview.tsx
  StepAction.tsx
  StepConditions.tsx
  StepConfigure.tsx
  StepReview.tsx
  StepTrigger.tsx
  VisualBuilderModal.tsx
```

**MISSING:** no `automations` table, no `automation:*` IPC, no runner, and nothing in
`src/main/` emits the events this catalogue names. Build one and nothing fires.

---

## 2.6 The always-on background tracker (`rheo-tracker/`)

A standalone systemd --user service that tracks foreground app time when the app is
NOT running. It writes to the same `logs` table and stands down whenever the Electron
app is live (single-writer ownership).

```text
rheo-tracker/src/browserServer.ts
rheo-tracker/src/categories.ts
rheo-tracker/src/config.ts
rheo-tracker/src/db.ts
rheo-tracker/src/index.ts
rheo-tracker/src/ownership.ts
rheo-tracker/src/session.ts
rheo-tracker/src/userdata.ts
```

---

# PART 3 — WHAT YOU MUST ANSWER

Everything above is context. **Your output is design, not code.**

## Q1 (BLOCKING) — rule vs. mission

A Visual-Builder automation is a **rule**: *when C holds, do A.*
A Conductor mission is a **mission**: *spawn agents until objective O is met.*

Should a rule **compile into** a mission? If yes we inherit mission graphs, L2/L3/L4
autonomy, the escalation gate above, budget ceilings, `enforce-boundary` and
`recover-agent`. **If no, say why not.** I suspect a genuine ontological mismatch and I
am not confident enough to settle it myself. Give reasoning, not a verdict.

## Q2 — the event bus

Nothing in `src/main/` emits `transaction.created` or `session.completed` — the trigger
catalogue names events **that do not exist**. Design the canonical event envelope, and
say whether a trigger should get a typed handler each (44) or ONE generic predicate DSL.
A predicate DSL is a second query language we then maintain; 44 typed handlers is a lot
of code. Which is the lesser evil?

## Q3 — missed triggers

If a condition becomes true while the app is closed: fire on next boot, coalesce, or
drop? Prior art in this repo — two writers accepting writes silently is exactly how rows
were lost in the 2026-10 profile migration.

## Q4 — idempotency

The runner will crash, the app restarts, an event may be delivered twice. What makes an
automation's action safe to retry?

## Q5 — DSL stability

A saved `trigger_json` references trigger ids from a catalogue that will change under it.
Rename a trigger — what happens to automations that used it? Silent no-op, or loud error?

---

# PART 4 — HOW WE COMMUNICATE

```
External AI  <--verbatim--  CZ (human relay)  <--verbatim--  opencode (me)
```

**You:** ask first, `REQUEST: <exact thing>`, **one at a time**. Never assume context you
were not given. Never describe a file you were not sent. Round 1 = your reading of Q1
plus questions, **not** a full spec.

**Me:** I paste real source in reply. If a file does not exist I say so, not invent it.

**CZ:** relays verbatim, never summarises.

When Q1-Q5 are answered with reasoning, produce `RESULT.md`: event envelope ·
`automations` schema · IPC surface · runner algorithm · security policy ·
file-by-file implementation plan.

## The bar for done

```
$ grep -rn "ipcMain.handle('automation" src/main.ts | wc -l   # currently 0
$ grep -rn "CREATE TABLE.*automation"  src/main.ts | wc -l   # currently 0
```
Those counts stop being 0. That is the definition of done.
