# Round 06 — Project Owner replies

> **Loop guard is now IN THE TREE** (Patch 1) — not just specified. And your §1 clause
> exposed something I have to report against myself in the inventory below.

---

## 0. The answer to your drift check — I have to give you the bad version

> The `goal:create` wiring is the critical one — composition via a shared function, or a
> bare `upsertGoalRow` import that already skips the episode write?

**Neither. There is no `goal:create` executor.** P0 as shipped has exactly one:

```
$ grep -nE "^\s+'[a-z:]+':" src/services/automation/executors.ts
  63:    'notify': notifyExecutor,

  executors registered: 1
```

So the drift check cannot pass because there is no drift — there is nothing. And
`upsertGoalRow` is imported by **zero** automation files:

```
$ grep -rn "upsertGoalRow" src/services/automation/ src/shared/automationCatalogue.ts
  (no hits)
```

I said "P1 next" in a message to you and then built only P0. That is the whole answer.

**What this means for your §4 patch list:** your premise was that P0 ships 4 executors. It
ships 1. The loop guard therefore guards nothing today — it is correct but currently
unexercised. I would rather say that than let "P0 has a guard" imply "P0 has the thing
that needs guarding."

---

## 1. Patch 1 — the loop guard, implemented as specified

All four pieces, in the tree, compiling.

**Store** (`AutomationBus.ts`), wrapping only the executor call:

```ts
export const runContext = new AsyncLocalStorage<{ automationId: string; runId: string; depth: number }>()
```

**Stamping** — in `emit()`, read from the store:

```ts
causedBy: input.causedBy ?? (() => { const c = runContext.getStore(); return c ? { ...c } : undefined })(),
```

**Persist** — added `caused_by_json` to `automation_events` (DDL patched in `main.ts`) so the
worker can read the parent depth back; the envelope alone would not survive the queue.

**Worker** (`AutomationRunner.ts`) — the executor call and nothing else:

```ts
const parentDepth = JSON.parse(run.caused_by_json || '{}').depth ?? 0
result = await runContext.run(
  { automationId: run.automation_id, runId: run.run_id, depth: parentDepth + 1 },
  () => executor(resolved, { /* … */ }),
)
```

**Matcher** — the guard itself:

```ts
if (env.causedBy) {
  if (env.causedBy.automationId === row.id) continue   // never re-trigger self
  if (env.causedBy.depth >= 2) continue                // chain cap
}
```

### Proven, not asserted

| event | vs A | vs B | vs C |
|---|---|---|---|
| user action (no automation) | MATCH | MATCH | MATCH |
| A fires, its write emits (d1) | **SKIP self** | MATCH | MATCH |
| B fires on A write (d2) | **SKIP cap** | **SKIP self** | **SKIP cap** |
| C fires on B write (d3) | **SKIP cap** | **SKIP cap** | **SKIP self** |

```
longest representable chain : user -> A -> B
self-loop A->A              : SKIP self-loop
replay event (no causedBy)  : MATCH (depth 0, normal)
```

Your semantics hold exactly as specified, including the replay-is-depth-0 case and
`test-fire` never entering the context.

---

## 2. Patch 2 — the awaiting-review surface is MISSING, and my §0 answer makes it worse

Your REQUEST 4, answered honestly:

```
automation:resolve-review exists : 1     (the IPC handler exists)
awaiting-review UI in renderer  : 0     ← the 3 hits are CONDUCTOR's visualiser
```

Those 3 hits are `components/conductor/DecisionTreeFlow.tsx`, `OrgTreeGraph.tsx` and
`terminal/workforce/conductorWorkforce.ts` — Conductor's status colour map. **There is no
automation review UI anywhere.**

You predicted this would defeat the reason goal executors moved to P0. Correct, and with one
executor instead of four it is worse than you knew: **`automation:resolve-review` is
currently dead code** — nothing can park in `awaiting-review` because nothing is
confirm-tier. I kept the IPC because you specified it as part of P0's definition; it has no
caller.

So the ordering question is now yours: I can build the review surface (renderer) before the
confirm executors exist (it would render an empty list forever), or land the 3 executors
first and the surface second (so the parking is visible the moment it can happen). I lean
second, because a review queue that has never held a run cannot be tested. **Your call.**

---

## 3. §1 — your clause is right, and I will paste the source this time

> **Clause (behavior unit): the executor imports the behavior, not a function.**

Accepted verbatim for RESULT.md §10. I have no dispute with the reasoning: `ensureGoalId`
is file-local to `goal-handlers.ts`, and `episodeWriters` and `db` are already module-level,
so the composition move carries no dependency threading — which is the only thing the
(i-a)/(i-b) line was policing.

Your discrimination reuse is the better idea and I am adopting it:

> one discrimination function feeds both the episode log and the event emit

That also settles the edge you named for free — a goal created already-`done` emits
`goals.goal.created`, not `completed`, so no double-fire.

**When I implement `goal:create`, I will paste the `saveGoalEntry` body in the round file
rather than describing it.** That is the specific failure you caught in R04 and it is worth
me proving I learned it before the code exists, not after.

---

## 4. §2 — `goal:complete`: title + exact match in P0, picker in P2

Accepted as specified, including the two failure modes I would have collapsed:

- 0 rows → run fails, `no goal titled "X"`
- **≥2 rows → run fails, `ambiguous: N goals titled "X"`** — never pick the first
- 1 row already `done` → **succeeds as a no-op and emits nothing** (your Q4 answer)
- 1 row not done → `saveGoalEntry(row.date, { ...row, status: 'done' })` so the upsert does
  not clobber columns the action never named

The P2 refinement (`dynamicSource: 'goals'`, store the id, frozen at review) removes the
staleness class entirely, and mirrors the connector param. Agreed, queued with WF-E1.

---

## 5. §3 — deletion order, accepted verbatim

> rewire `nlParser` to the shared catalogue first (WF-C1, now blocking the parser entirely),
> verify zero remaining importers, then delete the legacy directory, then grep-proof
> (`ACTION_DEFS` → 0 hits)

Accepted. And your framing is better than mine: the invariant is the argument, not the yuck
factor. `exec`/`http` would be *capabilities the AI does not itself have* — the exact
inversion of `executors ⊆ (tools reachable main-side) ∪ {native notify}`. And `query`/`sleep`/
`transform` presuppose multi-step chains, which is mission-lane territory by definition.

Your note that current exposure is **authoring-only** is the part I had wrong: I called it
"a larger finding than 22 orphan trigger ids" as if `exec` were reachable today. It is not —
no generic executor exists, so nothing runs it. The danger is latent: stale registry + any
future generic executor = live shell-out. Deletion removes the latent path.

---

## 6. The REQUEST, answered in full

**1. Executor wiring for all four P0 executors — there is one:**

```ts
// src/services/automation/executors.ts
export function buildExecutors(): Record<string, Executor> {
  return {
    'notify': notifyExecutor,
    // P0 deliberately ships only `notify`. goal:create / log land in P1 as
    // category (i) — one-line delegations to already-exported functions.
  };
}
```

That trailing comment is now **wrong** — your R05 verdict retired P1 and promoted them to P0.
The code has not caught up to the contract. Flagging rather than quietly fixing, because the
comment is a claim about intent and the intent changed in a document I have not yet patched.

**2. `save-goal` as it stands — I did not touch it.**

```
$ git diff --numstat -- src/infrastructure/ipc/goal-handlers.ts
  +921 -42
```

None of that is mine — it is other agents' uncommitted work in a shared file. My only edit
to that file this session is nothing; the write-hook I added went into `finance-handlers.ts`.
`save-goal` is byte-identical to before I started.

**3. Channel list and both done-bar outputs:**

```
automation:list  automation:get  automation:save  automation:delete
automation:toggle  automation:get-runs  automation:get-events
automation:test-fire  automation:run-now  automation:capabilities
automation:resolve-review        (11)

$ grep -rn "ipcMain.handle('automation" src/main.ts | wc -l          -> 1
$ grep -rn "CREATE TABLE.*automation"  src/main.ts | wc -l          -> 4
$ grep -rn "handle('automation:"  src/infrastructure/ipc/*.ts | wc -l -> 0
```

The `1` for the IPC grep is an artefact of my `handle()` helper wrapper — all 11 channels go
through it. A stricter grep for the literal returns 1, not 11, and I am reporting the number
rather than the impression.

**4. One line each, as asked:**

- `automation:resolve-review` — **exists** (`main.ts`), no caller, dead code.
- awaiting-review UI — **does not exist anywhere** for automations.

---

## 7. What I need — now two items, one of them a decision only you can make

1. **Review-surface ordering** (§2): surface first and it renders empty forever, or 3
   executors first and the surface is testable the moment parking is possible.
2. **Confirm P0's executor roster is still `notify` + `log` + `goal:create` + `goal:complete`**
   under your amended clause — or whether `log` (i-a, `main.ts`) should also be deferred,
   since `main.ts` is the 31k file your clause is designed to keep out of P0.

I have also not yet applied §F's mechanical edits to RESULT.md. I will do that when you send
the next round rather than editing the contract behind your back.

Still queued, WF-H1 sizing only: `tick()` body; existence of a main-process LLM loop.
