# AI Systems — Consulting & Improvement Register

> **Purpose:** a single, correct inventory of the AI systems that exist, what each one is
> *actually* good at, what is measurably missing, and how to route an improvement proposal
> to the right external specialist. Created after I wrongly reported three of these as
> non-existent — the correction rule is in §6 and it governs every claim here.

---

## 1. Inventory — verified 2026-10-07

Every row was confirmed by reading the file or counting the registration, not inferred.

| system | source | size | entry point | status |
|---|---|---|---|---|
| **Conductor** | `src/services/conductor/ConductorService.ts` | **875** lines | `conductor:*` — **26** IPC handlers | ✅ live on `/terminal` |
| **Tool registry** | `src/services/ai/toolRegistry.ts` | 638 lines | **90 tools**, `registerAll()` at boot | ✅ live |
| **AI agent loop** | `src/services/ai/aiAgentService.ts` | — | `maxToolCallsPerRound: 8` | ✅ live |
| **AI eval** | `src/services/aiEval.ts` | **509** lines | `ai-eval:*` — **10** handlers | ✅ live |
| **AI Gateway** | `aigateway_providers/sessions/runs` | 3 tables | — | ⚠️ unverified |
| **Background tracker** | `rheo-tracker/` | 8 files | systemd user service | ✅ live (`rheo-tracker.service`) |
| **Automation builder** | `src/components/ai/automations/` | 44 triggers | Visual Builder 5 steps | ⚠️ **no executor** |
| **ConductorPage** | `src/pages/ConductorPage.tsx` | 483 lines | `/conductor` | ❌ **dead duplicate** |

---

## 2. What each system is genuinely good at — and where it stops

### 2.1 Conductor — the strongest thing here

```
AutonomyLevel  = 'L2' | 'L3' | 'L4'
ConductorStatus = pending | spawning | running | blocked | 'awaiting-review' | done
spawnAgentTerminal → terminalManager.spawn()      (a REAL PTY spawn, not a simulation)
events: ESCALATE 'escalation.raised' · TASK 'node.spawned'
```

- **Already has** what most agent frameworks lack: an explicit human gate
  (`ConductorService.ts:633` — `autoApprove` only at `L4` and only for certain reasons),
  budget ceilings (`conductor:get-budget`), a hard safety boundary
  (`conductor:enforce-boundary`), and crash recovery (`conductor:recover-agent`).
- **Live:** `TerminalPage.tsx:4555` mounts `ConductorWorkspaceTab`, which mounts
  `MissionWizard`; `TerminalPage.tsx:898-934` polls snapshots and subscribes to
  `onConductorSnapshot` to drive the workforce scene.
- **Weakest point:** the orphan `/conductor` route (`App.tsx:3815`) renders a placeholder
  while `ConductorPage.tsx` (483 lines) sits with **zero importers**, duplicating the live
  tab. Two front-ends, one backend, one of them unreachable.

### 2.2 Tool registry — broad, and the natural action vocabulary

- **90 tools**, `read` 42 / `confirm` 51 / `destructive` **0**.
- `execute()` is guarded by `securityGuard.isLevelAllowed()` — throws otherwise.
- **This is why an automation engine should NOT invent its own action type.** An automation
  action and an AI tool have identical shape: name, typed params, security level. Reusing
  the registry means an automation can never do something the AI could not.
- **Weakest point:** `destructive` is unused, so there is no tier *above* `confirm` for
  genuinely irreversible operations (delete-project exists but sits at `confirm`).

### 2.3 AI eval — the only measurement system, and it is not automated

- 5 check kinds: `contains · not_contains · json_field · max_latency_ms · regex`.
- Real scoring: `CaseResult.score` (0..1, fraction passed) + `latencyMs`.
- `ai-eval:compare-runs` diffs a run against a previous one — a **regression gate exists**.
- Its own header states: *"A scorer that cannot fail is theatre."*
- **Weakest point: nothing triggers it.** No CI, no pre-commit, no scheduled run.
  `ai-eval:run` exists and is never called except by hand from the panel. **This is the
  single cheapest, highest-value improvement in the whole set** — one hook turns a dashboard
  into a gate.

### 2.4 Automation builder — the one genuine gap

Complete 5-step UI (trigger → condition → action → configure → review) over **44
triggers**, with a DSL generator and an NL parser. **No table, no IPC, no runner, and
nothing in `src/main/` emits the events the catalogue names.** Build it and nothing happens.

---

## 3. The routing table — send each proposal to the right specialist

| proposal | route to | why |
|---|---|---|
| "improve the agent's reasoning / prompts" | AI/ML architecture specialist | system prompt + tool selection, not UI |
| "make the AI safer" | systems/security specialist | `securityLevel` ladder, `enforce-boundary` |
| "the Conductor UI is wrong / two front-ends" | **me + CZ only** | dead code removal is a repo decision, not a design question |
| "eval should gate merges" | **me, same day** | it is one hook; no consultation needed |
| "automation → mission, or its own engine?" | AI architecture + infra | the rule-vs-mission mismatch is the real question |
| "the nav / canvas / cards look wrong" | **design specialist, via PAINT** | §5 |

---

## 4. How a consulting round actually runs

This is the `ai-collaboration-bridge` flow, already instantiated at
`agent/docs/backandfourth-docs/ai-automation-engine/`.

```
CZ  ──verbatim──►  external Specialist
 ▲                    │
 │                    │  REQUEST: <one specific thing>
 │                    ▼
 └──── CONTEXT: <real source> ──── me (full codebase access)
```

**Rules that made it work, and that must not be relaxed:**

1. **All source is embedded inline.** The Specialist has zero file access. A file path
   without the code is useless to it.
2. **One `REQUEST` at a time.** Ten files at once produces a confident, wrong answer.
3. **If a file does not exist, I say so.** Never invent code for a Specialist to build on.
4. **Round 1 output is questions, not answers.** A monolithic first reply is the failure
   mode this skill exists to prevent.
5. **CZ relays verbatim.** Any summarising loses technical precision.
6. **I must never claim something is absent without proving the query can see it** — see §6.

---

## 5. Design work goes through PAINT, not through this register

If a proposal touches pixels, it is a **design task**, and it runs
`agent/skills/paint/SKILL.md`: intent → character → concept → **source (MCP)** → tokens →
states → motion → audit → **prove-it**.

The gate that catches most of what has gone wrong this session:

> **P8 — artifact freshness and mount chain.** A correct fix inside a stale bundle is a
> false claim, and an exported component with zero importers is dead code, not a late task.

Both fired here: I reported a fixed rail that was not in `dist/`, and I reported a live
`ConductorPage` that nothing imports.

---

## 6. The correction rule — binding on every claim in this file

I wrongly reported three things as non-existent in one session. All three were the same
error:

| claim | what the query actually proved |
|---|---|
| "no tables" | grepped the **directory** `src/main/` → 9 of **119** |
| "no autonomous system" | never grepped for `conductor` at all |
| "this page is dead" | checked **one file's** importers, not the subsystem's |

> **A query that has not been shown to find something known to exist cannot be cited as
> evidence that something is absent.** Before reporting absence: run the query against a
> positive control. If it cannot find the 119-table schema, the 90 tools, or the 26
> handlers, it cannot prove a negative either.

This is why §1 is a table of **verified counts** rather than a narrative. A count can be
re-run. An impression cannot.

---

## 7. Immediate improvements, ranked by value ÷ effort

| # | improvement | effort | why now |
|---|---|---|---|
| 1 | **Call `ai-eval:run` on prompt/model change** | hours | turns an existing dashboard into a regression gate |
| 2 | **Delete or redirect `ConductorPage.tsx`** | minutes | 483 dead lines duplicating a live tab |
| 3 | Surface `ai-eval:stats` next to the AI page's own output | hours | measurement next to the thing measured |
| 4 | Define the `destructive` tier or delete the name | hours | `destructive` is declared and never used |
| 5 | Route `/conductor` → `ConductorWorkspaceTab` | minutes | makes the existing feature findable |
| 6 | Automation → Conductor mission compile target | days | needs §4 consultation first |

**1, 2 and 5 need no consultation.** They are mechanical, and they are the difference
between "this exists" and "I can use this".

---
BUILD: NOT RUN — CZ BUILDS (§0-0) · PROCESSES: net delta 0
ARTIFACTS: this file · `AI-ASSISTANT-VISION.md` · `backandfourth-docs/ai-automation-engine/`
VERDICT: inventory only — no code changed
---