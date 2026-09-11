# Agent Topology Patterns

## Single Agent

Use when: one coherent task, one output, linear reasoning.

```
User Input → [Agent] → Structured Output → UI Card
```

Examples: email summarizer, quote of the day, spending alert.

## Conductor + Workers

Use when: multi-domain data, conditional branches, parallel sub-tasks.

```
User Input → [Conductor] → assigns to → [Worker A] → [Reducer] → Structured Output → UI Card
                      → assigns to → [Worker B] ──┘
                      → assigns to → [Worker C] ──┘
```

Conductor output must include:
- `workers`: array of `{worker_id, task, inputs}`
- `execution_mode`: `"sequential" | "parallel"`
- `dependencies`: map of worker_id → prerequisite worker_ids

Reducer output must include:
- `merged_sections`: array of worker outputs in display order
- `conflicts`: array of any contradictory data found
- `summary`: human-readable synthesis

Examples: weekly retrospective, multi-source briefing, complex planning assistant.

## Pipeline

Use when: sequential transformation where each step refines the previous.

```
User Input → [Agent A: Extract] → [Agent B: Transform] → [Agent C: Format] → Structured Output → UI Card
```

Each agent's output schema is the next agent's input schema.

Examples: raw data → cleaned data → insights → formatted report.

## Fan-out / Fan-in

Use when: multiple independent analyses that merge into a dashboard.

```
User Input → [Conductor] ─┬─→ [Worker: Finance] ─┐
                          ├─→ [Worker: Goals]    ─┼→ [Reducer] → Dashboard Output
                          ├─→ [Worker: Calendar]   ─┤
                          └─→ [Worker: Activity]   ─┘
```

All workers run in parallel. Reducer waits for all to complete.

Examples: personal dashboard, weekly scorecard, health overview.
