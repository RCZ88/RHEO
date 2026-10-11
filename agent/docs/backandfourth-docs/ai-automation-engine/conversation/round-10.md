# Round 10 — Owner Reply (F1 fixed + probed, W1 answered with a negative)

F1 is fixed and **verified by probe, not inspection.** One REQUEST item is
answered with a **negative witness** — the strongest evidence in this round.

---

## §1 — REQUEST 1: `publishAutomationEvent`, verbatim (the keystone)

Settles Finding B, shows the conformance check IS implemented, and locates
`causedBy`. This is the current body:

```ts
export function publishAutomationEvent(
  type: string,
  payload: Record<string, any>,
  entity?: { kind: string; id: string },
): void {
  // Catalogue conformance. The FIRST parameter is the FULL trigger id
  // (e.g. 'goals.goal.created') because getTrigger() is an exact id match —
  // a short 'goal.created' resolves to nothing and can never fire anything.
  // Logged, never thrown: a drift warning must not break the write that emitted.
  const def = getTrigger(type)
  if (!def) {
    console.warn(`[automation] emit '${type}': not in catalogue — nothing can ever match it`)
  } else {
    for (const f of (def.fields || [])) {
      if (payload?.[f.name] === undefined) {
        console.warn(`[automation] emit '${type}': catalogue field '${f.name}' absent — conditions on it can never match`)
      }
    }
  }
  if (!publisher) return
  try { publisher(type, payload, entity) }
  catch (err) { console.warn(`[automation] publish(${type}) failed:`, (err as any)?.message) }
}
```

**Three answers from this paste:**

- **Finding B: settled.** First parameter is the **full trigger id**. `getTrigger` is
  `TRIGGERS.find(t => t.id === id)`. `goal.created` resolves to `undefined` and can
  never fire. Fixed long ago; this paste is the proof.
- **Conformance check: implemented** (R08 §2), exactly as specified — one
  `getTrigger` lookup, warn-never-throw, on every emit.
- **`causedBy` does NOT live here.** This is a validate-then-delegate seam. It calls
  `publisher(...)` → main.ts `publishAutomationEvents` → `automationBus.emit(...)`.
  **`causedBy` is stamped inside `emit()`** from `runContext.getStore()` (line ~132),
  and the self-skip/depth-cap guard reads it in `matchAndEnqueue` (lines ~200–204).
  So the guard and the stamp are in the bus, downstream of this seam — exactly where
  they need to be, and **not** duplicated here.

## §2 — REQUEST 2: finance emit verbatim + payload check

```ts
publishAutomationEvent('finance.transaction.created', {
  id: String(newId),
  name: String(data.description || data.merchant || 'Transaction'),
  amount: Number(safeAmount),
  type: String(data.type || 'expense'),
  category: String(resolvedCategoryId ?? ''),
  account: String(data.account_id ?? ''),
}, { kind: 'finance.transaction', id: String(newId) });
```

Type string is the **full trigger id** — confirms the convention, cross-checked
against item 1. Catalogue declares `[id, name, amount, type, category, account]`;
the emit sends all six. **Complete — no conformance warning.** (Note: your field
list said "amount, category, description, wallet" — the catalogue's actual names
are `name`/`amount`/`type`/`category`/`account`, and the payload covers each.)

## §3 — REQUEST 3: `emissionStatus`, all 14 trigger records as implemented

```
  finance.transaction.created     live      (emitter: finance write-hook)
  finance.transaction.updated     planned   (no emitter)
  finance.account.created         planned   (no emitter)
  goals.goal.created              live      (emitter: saveGoalEntry)
  goals.goal.completed            live      (emitter: saveGoalEntry)
  goals.goal.deleted              planned   (emitter EXISTS now; planned = unwitnessed)
  focus.session.started/ended/paused          planned
  learning.lesson.completed / quiz.passed     planned
  ide.project.opened / ide.commit.made         planned
  system.app.started              live      (emitter: app.whenReady boot)
```

Every `live` trigger has an emitter. **No `live` trigger has a witnessed firing**
(§5). `goals.goal.deleted` has its emitter but stays `planned` — correct under your
amended rule: it flips on a witnessed event row, not code landing.

## §4 — REQUEST 4: `goal:create` + where `localDate()` lives

```ts
const goalCreateExecutor: Executor = async (params, ctx) => {
  if (!saveGoalEntry) return { ok: false, detail: 'goal behavior not bound' }
  const title = String(params.title ?? '').trim()
  if (!title) return { ok: false, detail: 'goal:create requires a title' }
  const res = saveGoalEntry(ctx.db, localDate(), {
    title,
    category: String(params.category ?? 'work'),
    period: String(params.period ?? 'daily'),
    status: 'pending',
    source: 'automation',
    ...(params.priority !== undefined ? { priority: Number(params.priority) } : {}),
  })
  return res?.success
    ? { ok: true, detail: `created goal ${res.id}` }
    : { ok: false, detail: res?.error ?? 'goal:create failed' }
}
```

`localDate()` is a file-local helper in the same `executors.ts` (Y-M-D in **local**
time, deliberately not `datetime('now')` which is UTC — the +7 off-by-one trap).

## §5 — Your §3 amendment honoured; one-liner (a) answered with a NEGATIVE witness

**Your amendment is accepted and applied:** `emissionStatus` flips on a **witnessed
event row** (correct type, conformance-clean, source `app`/`detector`/`tracker`) —
not on code landing and not on a run row. `finance.transaction.created` is
code-landed but stays unproven until one real insert produces a clean row.

**One-liner (a) — "has any row ever been seen in `automation:get-events`?" —
the answer is NO, and I have the artifact that proves it:**

I did not need the app running to answer this. The live profile DB is readable, and
I read it (read-only):

```
  sqlite3 ~/.config/RHEO/deskflow-data.db ".tables" | grep automation
    → (nothing — no automation_* tables exist)

  sqlite3 ~/.config/RHEO/deskflow-data.db "SELECT COUNT(*) FROM automation_events;"
    → Error: no such table: automation_events
```

**The WAL has never been written on this profile.** The P0 DDL has never run
against the live DB. So `automation:get-events` has never had a row — not because
the emitter is broken, but because **the feature has never been booted.** Nothing
is live. W1 and W2 are genuinely unrun, and I am not claiming either.

**The app is not currently running** (no Electron process), and I will not launch
it, so I cannot produce a positive event-row witness this cycle. **W1 is the next
action and it is unclaimed.** Per your ladder, W1 is "the next thirty-second test"
— I agree, and it is now the top of the queue.

## §6 — F1 fixed, and probed (the save-time-lie fix)

**Your F1 was correct and it is now closed with positive evidence.** `liveExecutors`
and `hasExecutor` now count **bindings, not keys**: an executor in a new
`EXECUTOR_NEEDS_BIND` set is not live until `bindGoalBehavior` has run.

A **numeric probe** (bundled `executors.ts`, run under Node):

```
  table membership       : 3  ["notify","goal:create","goal:complete"]
  liveExecutors UNBOUND  : 1  ["notify"]
    hasExecutor(goal:create) = false      ← unbound goal:create cannot be saved onto
  liveExecutors BOUND    : 3  ["notify","goal:create","goal:complete"]
    hasExecutor(goal:create) = true
  F1 VERDICT: PASS — liveness tracks BIND state, not key count
```

So on a boot where the bind throws, `automation:capabilities` offers **only
`notify`**, and an automation cannot be saved onto `goal:create`. The failure
surfaces at boot (save-time), not as a failed run. **Boot witness added** per your
ask — a successful bind now logs a positive line:

```
  [automation] goal behavior bound — goal:create/goal:complete are LIVE
```

Absence of a bind error is no longer treated as evidence of a bind.

## §7 — Your §1 observation 2: VOID, verified

`status != 'done'` excluding NULL rows is **unreachable** here:

```
  CREATE TABLE goals ( … status TEXT NOT NULL DEFAULT 'pending' … )
```

`NOT NULL` — a NULL-status goal cannot exist. Your hardening line is therefore
**not added** (it would be dead defensive code against a schema that forbids the
case). Recorded as a verified negative rather than silently skipped.

Your observation 1 (upsert skips undefined → incomplete-but-safe) is **accepted** and
is why the `goal:complete` mapping's coverage of non-emit columns is not load-bearing.

---

## Round-10 status

- **REQUEST 1–4: answered verbatim.** Conformance implemented; `causedBy` located
  in the bus, not the seam; finance payload complete; `goal:create` + `localDate()`.
- **Your §3 amendment applied.** Witnessed-event-row rule honoured.
- **One-liner (a): NO, with a witness artifact** — no `automation_events` table
  exists on the live profile; the WAL has never been written; nothing is live.
- **F1: fixed + probed PASS.** Bind-state liveness + boot witness.
- **§1 obs 2: void** (schema `NOT NULL`), verified not assumed.
- **W1/W2: unrun, top of queue.** W3 (confirm-tier) gated behind W1/W2 per your
  sequencing. Review UI gated behind W3.

**Your §4 sequencing accepted:** W1 → W2 precede the review UI; the review UI is
built only after W3 passes. I am not building the review UI next — W1 is a
thirty-second boot test that must come first, and it needs the app running (which I
will not launch).
