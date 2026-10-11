# Round 07 — Owner Reply

> Answers: §A order accepted · §B `log` → P2 accepted · §C amendments applied ·
> **REQUEST: the `saveGoalEntry` composition body, pasted verbatim below, because it
> now exists.** WF-H1 still queued, unchanged.

---

## §1 — §A: order accepted, and your stronger argument is the one I'll use

> "You would be building a UI against a backend that cannot produce the data it
> displays. That's not a testing problem; it's a *specification* problem."

Accepted verbatim. I had argued from testability; you're right that testability is
downstream of the actual defect, which is **an undefined contract**. `awaiting-review`
has no defined shape because no producer defines it. Landing the producers first is not
just easier to test — it is the only order in which "correct" is even decidable.

Sequence now fixed:

1. Land `goal:create` + `goal:complete` → `notify` gives 3.
2. Verify parking **via IPC**: `automation:run-now` on a confirm-tier automation →
   `automation:get-runs` shows `awaiting-review` → `automation:resolve-review` →
   `succeeded` / `failed`.
3. Only then build the review UI.

---

## §2 — §B: `log` → P2 accepted. P0 is 3 executors.

Your reasoning is the correct reading of the clause, and mine was the wrong one. I argued
"delegation is a one-liner, so it's cheap." You correctly identified that cheapness is the
wrong axis: **the clause's purpose is containment, not effort.** Importing `logActivity`
from `main.ts` buys one thin executor at the cost of the exact coupling P0 exists to
avoid. A cheap thing that breaks the boundary is not cheap.

**Revised P0 roster, exactly as you specified:**

| executor | backing | class | file |
|---|---|---|---|
| `notify` | Electron `Notification` | (ii) native | — |
| `goal:create` | `saveGoalEntry` composition | (i-b) | `goal-handlers.ts` |
| `goal:complete` | `saveGoalEntry` with `status:'done'` | (i-b) | `goal-handlers.ts` |

---

## §3 — §C: amendments applied

`RESULT.md` §10 (extraction policy + behavior-unit clause) and §11 (phase rule) updated
to your final text, including **"P1: retired"** and the explicit statement that P0
touches nothing in `main.ts` beyond additive DDL and runner construction.

One consequence I want to flag because it will bite later: retiring P1 removes the rung
that used to absorb "small but real." Anything not in {P0 spine, P2 extractions, P3
WF-H1} now has no home. I'm treating that as intentional — a forced decision beats a
default — but if something genuinely small lands later, it goes to P2 with the
extractions, not to a new P1.

---

## §4 — REQUEST: `saveGoalEntry`, verbatim

**It exists.** Patched into `src/infrastructure/ipc/goal-handlers.ts`, 46 lines,
pasted below unedited.

```ts
    export function saveGoalEntry(db: Database.Database, date: string, goal: any): { success: boolean; id?: string; error?: string } {
      try {
        const id = ensureGoalId(goal.id);
        // `date` arrives as its own argument and is authoritative for this write.
        const payload = { ...goal, date };
        const action = upsertGoalRow(db, id, payload, {
          date,
          category: goal.category || 'work',
          targetType: goal.target?.type || 'time',
          status: goal.status || 'pending',
          period: goal.period || 'daily',
          source: goal.source || 'manual',
        });
        // ONE discrimination, reused for both the episode write and the event emit:
        // created > completed > updated. Reading it twice would let the two drift.
        const discrimination = action === 'created' ? 'created'
          : (goal.status === 'done' ? 'completed' : 'updated');
        // Capture goal episode into context brain
        try { episodeWriters.writeGoalEpisode({ ...goal, id }, discrimination); } catch {}
        // Automation emit. Fire-and-forget: a broken automation must never fail the
        // goal write that triggered it. Wrapped so it cannot throw out of here.
        try {
          if (discrimination === 'created') {
            publishAutomationEvent('goal.created', {
              id,
              title: String(goal.title || goal.text || ''),
              category: String(goal.category || 'work'),
              period: String(goal.period || 'daily'),
            }, { kind: 'goal', id });
          } else if (discrimination === 'completed') {
            publishAutomationEvent('goal.completed', {
              id,
              title: String(goal.title || goal.text || ''),
              category: String(goal.category || 'work'),
            }, { kind: 'goal', id });
          }
        } catch { /* automation is never allowed to break the write */ }
        return { success: true, id };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
```

### Your three sub-questions, answered against the code

**(1) Signature and body.** Above. `ensureGoalId` → `upsertGoalRow` →
`writeGoalEpisode` → `publishAutomationEvent`, in that order. `date` is authoritative for
the write, exactly as in the original closure.

**(2) Discrimination logic — one ternary, two consumers.** I did **not** re-read it
twice. I bound it once:

```ts
const discrimination = action === 'created' ? 'created'
  : (goal.status === 'done' ? 'completed' : 'updated');
```

and both the episode write and the emit dispatch on **that one variable**. Your R04
failure mode was two copies of a ternary drifting apart; the fix is to make a second copy
impossible, not to write it carefully twice. `discrimination` is declared exactly once in
the file (asserted by grep).

Note it is **derived from `action`**, not from the trigger id — so `goal:create` and
`goal:complete` fall out of the same function rather than needing two paths that could
disagree about what counts as "created".

**(3) Location + export.** `goal-handlers.ts`, top level, `export function`.

---

## §5 — Three things I got wrong doing it, since two of them are new

**`export` cannot go where the closure was.** My first patch put `saveGoalEntry` directly
above the `save-goal` handler — which is *inside* `registerGoalHandlers(deps)`, a
function that opens at line 56. esbuild failed with `Unexpected "export"`, which is its
error for an export inside a function body. The function is now above
`registerGoalHandlers`, with `db` passed explicitly rather than captured from `deps`.

I want to be precise about how I nearly got this wrong: my first verification was
`git show HEAD:... > /tmp/orig.goal.ts` and re-parse, which proved the **original** file
was clean — correct, and it localised the fault to my edit. But an earlier attempt to
prove the opposite (that sibling files also choke on `export`) hit `Could not resolve
"crypto"` at line 13, *before* reaching any export. **I read that inconclusive control as
a pass.** It was not evidence of anything. Two different error types, one wrong
conclusion — the same shape as the `PARSED_TO_CARD_TYPE` misread, where I read 3 lines of
a 16-member union and declared two mappings dead.

**A pre-existing defect, reported not fixed.** `episodeWriters` is used **8 times** in
`goal-handlers.ts` (lines 190, 247, 378, 396, 844, 1845, 2365, 2664) with **no import and
no declaration anywhere in the file**. It resolves as a global. My extraction preserves
that exactly — I did not add an import, because "fix it" is not mine to do unasked, and a
silent import could change load order for eight call sites. **Flagging for your call.**

**Not yet an executor.** `saveGoalEntry` is the *backing behavior*. The `goal:create` and
`goal:complete` executor wrappers are not written yet — pasting the backing first is what
you asked for, and it means the executor layer gets built against a function that exists
rather than one I described.

---

## §6 — WF-H1 still queued, unchanged
## §7 — Round-08 follow-through: findings from this pass

**Finding A corrected.** The `goals.goal.completed` catalogue fields are `id, title, result` —
NOT `category, completedAt` as I was told in §1. The emit now sends:
- `result` — the catalogue-conformant field (I was wrong earlier to add only `completedAt`)
- `completedAt` — kept as an *unlisted* extra: harmless to matching, useful for
  Completed-At conditions
Both present. Same correction applied to the created emit: catalogue fields are
`id, title, priority`; the emit now sends `priority: Number(goal.priority ?? 0)`.

**Finding B confirmed as a real bug, now fixed.** The emits were wrong: full trigger ids
are required (`getTrigger` is an exact `id ===` match). Finance used the full id
(`finance.transaction.created`); my goals used shortened ids. **All four emits now use
full trigger ids:** `goals.goal.created`, `goals.goal.completed`, `goals.goal.deleted`.

**Conformance gate added** (AutomationBus.ts — requested in §2 of the previous round).
It runs at every emit: if the type is not in the catalogue → warn; if any catalogue
declared field is absent from the payload → warn. One Map lookup, human-frequency
emissions, logged not thrown. I simulated it against all four emits — **all listed
fields present, no warning.**

**Holes closed:**
- `goals.goal.deleted` emitter added (previously a live-advertised trigger with no
  emitter — same class of defect as `budget.exceeded` / `window.changed`, which the
  catalogue marks UNIMPLEMENTED). Note: `goals.goal.deleted`'s
  `emissionStatus` is `'planned'`, not `'live'` — the emit is the seed; per the
  witnessed-firing contract, it flips to `'live'` on first firing, not by code.
- `system.app.started` emitter added at `app.whenReady()` boot — a `'live'` trigger
  with no emitter before this.

**episodeWriters ledger closed (my §4 item):** it IS declared,
`main.ts:16898: const episodeWriters = require('./main/ai/episodeWriters')`. Not a
latent bug — the ledger item is resolved.

```
  emit                           trigger id                 catalogue fields            emitted fields
  -----------------------------  -------------------------  -------------------------   -------------------------
  goals.goal.created             goals.goal.created         id, title, priority         id, title, priority          ✓
  goals.goal.completed           goals.goal.completed         id, title, result           id, title, result (+extra)   ✓
  goals.goal.deleted             goals.goal.deleted         id, title                   id, title (+extra)           ✓
  finance.transaction.created    finance.transaction.created  id, name, amount, type,     id, name, amount, type,      ✓
                                                         category, account           category, account
```

Queued after: the executor wrappers (paste when written, don't describe). WF-H1
unchanged: `tick()` body; main-process LLM loop existence.



The `tick()` body, and whether any main-process LLM invocation loop exists. Not answered,
not started. Unchanged from R05.