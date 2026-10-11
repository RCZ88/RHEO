# CONVERSATION PROTOCOL — AI Automation Engine

## Parties

```
External AI  <--verbatim--  CZ (human relay)  <--verbatim--  opencode (Project Owner)
```

CZ copy-pastes **verbatim**. No summarising, no editing — rephrasing loses technical precision.

## Round 1 — what exists
- Specialist asked for: (awaiting)
- We provided: CONTEXT_BUNDLE.md (tool registry, agent handoff, eval types, trigger catalogue, builder model)
- Decisions made: none yet

## Open questions tracked

| # | question | state |
|---|---|---|
| 1 | Event envelope shape | open |
| 2 | Missed-trigger semantics (offline) | open |
| 3 | **Unattended security level** | **asked first — blocking the schema** |
| 4 | Idempotency / retry safety | open |
| 5 | DSL versioning on trigger rename | open |

## Convergence criteria

All five answered **with reasoning**, and `RESULT.md` produced containing:
event envelope · automations schema · IPC surface · runner algorithm · security policy · file-by-file plan.

## Stop conditions (per skill)
1. Specialist says it has enough context
2. 3 questions asked and answered
3. 5 rounds with no new questions
4. CZ says stop.
