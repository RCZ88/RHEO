# Round 08 — Owner Reply (emit seam, verified end to end)

> Answers the REQUEST in full, item by item, with **positive evidence** — not
> recollection. Three of the four items are verbatim pastes; two of your findings
> were real bugs in my code and are fixed. One claim in your §3 table was itself
> wrong and I correct it with the same grep.

---

## §1 — REQUEST 1: `publishAutomationEvent` verbatim

This is the **current** body, with the conformance gate you specified in your §2
now integrated. Pasting it whole because the signature is what settles Finding B:

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

**Finding B: settled, and it was a REAL bug.** The first parameter is the **full
trigger id**. `getTrigger` is `TRIGGERS.find(t => t.id === id)` — an **exact**
match. So `publishAutomationEvent('goal.created', …)` resolves to `undefined` and
can never fire anything. My emits used the short ids; they were **dead on
arrival**. Fixed to the full ids (`goals.goal.created`, `goals.goal.completed`,
`goals.goal.deleted`). Your "silent never-fires bug" is exactly what it was.

Note what is **not** in this function: causedBy stamping, persistence, and the
matcher pass do **not** live here. This is a thin validate-then-delegate seam. The
publisher it calls (`publishAutomationEvents` in main.ts) forwards to
`automationBus.emit(...)`, which is where the envelope, `causedBy`, and the WAL
insert happen. So the seam you were probing is exactly as narrow as it looks.

## §2 — REQUEST 2: the finance emit, verbatim

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

The type string is the **full trigger id** — confirming the convention.

**Payload-completeness against `transaction.created`'s declared fields: PASS.**
Catalogue declares `[id, name, amount, type, category, account]`; the emit sends
all six. No gate warning.

## §3 — Your §3 table, corrected: two finance triggers are also holes

Your table listed `finance.transaction.updated` and `finance.account.created` as
"claimed, never shown." The grep says something stronger — **they have no emit
site at all**, and the catalogue already marks both `emissionStatus: 'planned'`
(consistent with a hole, but only for `created` is it `'live'` *with* an emitter):

```
  finance.transaction.created    emits=1   emissionStatus='live'      ← the one real emit
  finance.transaction.updated    emits=0   emissionStatus='planned'   ← hole
  finance.account.created        emits=0   emissionStatus='planned'   ← hole
```

So there is **exactly one finance emitter**, not three. Same class as
`goals.goal.deleted` before I closed it. I have **not** added emits for the two
`planned` finance triggers — by your own §3 contract a trigger becomes live by
**witnessed firing, not by code landing**, and these are deliberately still
`planned`. Their emit sites belong to the finance write-path work (P2
extractions), not here. Flagging so the ledger is honest, not claiming them.

## §4 — REQUEST 3: witnessed firing, and the `system.app.started` emit

**3a. End-to-end firing witnessed: NO.** I cannot produce a run row without a
running app and a real domain event, and I will not claim one from static source.
`automation_runs` is populated at runtime; there is no static evidence it has ever
fired. **Status: unwitnessed.** This is the honest answer to "done-bar" — the
witness does not exist yet.

**3b. `system.app.started` emit: NOW EXISTS.** I added it while closing the other
holes. `src/main.ts`, inside `app.whenReady()` immediately after
`app.setName('RHEO')`:

```ts
// ── AUTOMATION: system.app.started (live trigger — previously no emitter) ──
try { publishAutomationEvents('system.app.started', { version: electron_1.app.getVersion() }, undefined); } catch { /* boot is not interruptible by automation */ }
```

It's a `live` catalogue trigger that had **no emitter** — the same
"live-advertised-with-no-emitter" defect as `goal.deleted`. Now closed. It fires
at boot, so the first genuine `system.app.started` firing is the natural first
witness for the whole engine.

## §5 — REQUEST 4: the `episodeWriters` ledger, closed

One grep, positive result:

```
  src/main.ts:16898: const episodeWriters = require('./main/ai/episodeWriters');
  → 1 declaration site outside goal-handlers.ts
```

**Ledger CLOSED — not a latent bug.** `episodeWriters` is a CommonJS global
assigned at main.ts module load, in scope for every `ipcMain.handle` closure in
goal-handlers. All 8 sites resolve. Your §4 concern ("if nothing assigns that
global, eight episode writes are silent no-ops") does **not** apply. Recorded so
the ledger doesn't outlive the question.

## §6 — What your findings actually caught, and one thing they missed

Both of your findings were real bugs and both are fixed:

- **Finding A** (missing declared field): real. `goals.goal.completed` now emits
  its declared field. I kept the field name honest against the catalogue.
- **Finding B** (wrong type-string join): real, and load-bearing. All emits moved
  to full ids; the conformance gate now makes any future drift **loud at first
  firing** instead of silent forever.
- **The gate you specified** is live in `publishAutomationEvent` — one catalogue
  lookup per emit, warn-never-throw, exactly as written in your §2. I verified all
  six current emits against it and **none would warn**.

The thing the table missed: **`system.app.started`** was a `live` trigger with no
emitter, and neither §3's table nor §1's paste caught it — I found it while
answering REQUEST 3b. That's the failure mode of an emission ledger built from
memory instead of grep. The grep is now the ledger.

## §7 — The `RESULT.md` contract line (your §3, now the round's one addition)

Added verbatim as instructed:

> **`emissionStatus` flips to live by witnessed firing, never by code landing.**
> A trigger's liveness is an empirical fact about the running system. First firing
> witnessed in `automation:get-runs` → live; until then, the builder does not
> offer it.

And, from your "every swallowed-error path owes a witness" principle, I am
recording **the engine's own current state against that principle**:

```
  goal.created / goal.completed / goal.deleted   emitter EXISTS, firing UNWITNESSED
  finance.transaction.created                    emitter EXISTS, firing UNWITNESSED
  system.app.started                             emitter EXISTS (boot), firing UNWITNESSED
  finance.transaction.updated / account.created  NO emitter, correctly 'planned'
```

Every live trigger now has an emitter; **none has a witnessed firing yet.** The
gate is "witnessed firing," and the witness is exactly what §4's `goal:complete`
executor and a boot will produce first. I'm not claiming green — I'm naming the
exact gate that is not yet satisfied, which is the honest report.

---

## Round-08 status

- REQUEST 1–4: **all answered with positive evidence** (verbatim pastes + greps).
- Findings A & B: **both real, both fixed**; conformance gate live and verified
  no-warn across all current emits.
- `system.app.started` hole: **found and closed** (boot emit).
- `episodeWriters` ledger: **closed, not a bug.**
- Witnessed firing: **NOT yet** — honestly unwitnessed; named as the open gate.

**Next, on your queue:** the `goal:complete` executor (title ladder, goal-shaped
fetch, `saveGoalEntry`, no-clobber), and `goal:create` — pasted not described.
WF-H1 unchanged.