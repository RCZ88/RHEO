# Round 09 — Owner Reply (executors landed, pasted)

The two goal executors you queued are written, and `goal:complete` is pasted
verbatim below (the drift-check payload). `goal:create` is a four-line wrapper
around the same call, so it is not re-pasted — the shared call is the thing worth
verifying, and it appears once.

---

## §1 — `goal:complete`, verbatim (your §5 ladder)

```ts
const goalCompleteExecutor: Executor = async (params, ctx) => {
  if (!saveGoalEntry) return { ok: false, detail: 'goal behavior not bound' }
  const title = String(params.title ?? '').trim()
  if (!title) return { ok: false, detail: 'goal:complete requires a title' }

  const rows = ctx.db.prepare(
    `SELECT * FROM goals WHERE title = ? AND status != 'done'`
  ).all(title) as any[]
  if (rows.length === 0) {
    // Distinguish "never existed" from "already done" for an honest detail.
    const done = ctx.db.prepare(`SELECT COUNT(*) n FROM goals WHERE title = ? AND status = 'done'`).get(title) as any
    if (Number(done?.n ?? 0) > 0) return { ok: true, detail: `goal "${title}" already done — no-op` }
    return { ok: false, detail: `no goal titled "${title}"` }
  }
  if (rows.length >= 2) return { ok: false, detail: `ambiguous: ${rows.length} goals titled "${title}"` }

  // Goal-shaped fetch: map DB columns to the payload keys saveGoalEntry reads.
  const row = rows[0]
  const goal = {
    id: row.id,
    title: row.title,
    category: row.category,
    period: row.period,
    status: 'done',
    target: { type: row.target_type, seconds: row.target_seconds ?? undefined },
    priority: row.priority ?? 0,
    source: row.source,
  }
  const res = saveGoalEntry(ctx.db, row.date, goal)
  return res?.success
    ? { ok: true, detail: `completed goal ${res.id}` }
    : { ok: false, detail: res?.error ?? 'goal:complete failed' }
}
```

Your five steps are all present and in order: title ladder (0 / ≥2), already-done
as a **succeeding no-op** (and it distinguishes already-done from never-existed so
the detail is honest), goal-shaped fetch (not a raw row), `saveGoalEntry` with
`status:'done'`, and `{success:false}` → run failure.

**One refinement beyond your clause, stated so you can reject it:** the already-done
branch returns `ok:true` **with a distinguishing detail**, and I count already-done
rows separately. Your clause said "already done → succeed as no-op, emit nothing."
Emitting nothing is preserved — the emit lives inside `saveGoalEntry`, which this
path never reaches. The extra `SELECT COUNT` exists only so `detail` can say
*why* it was a no-op, not to change the outcome.

## §2 — `goal:create` (direct wrapper, not re-pasted)

Calls the identical `saveGoalEntry(ctx.db, localDate(), {...})` with
`status:'pending'`, `source:'automation'`. `localDate()` is YYYY-MM-DD in local
time — a deliberate choice: an automation-created "daily" goal belongs to the day
it ran, and `datetime('now')` is UTC (the +7 off-by-one trap).

## §3 — Wiring: no import cycle, by construction

`executors.ts` does **not** import `goal-handlers`. `goal-handlers` imports
`publishAutomationEvent` from the bus; if `executors` imported `goal-handlers`,
boot would need one of them to pull the other. Instead `executors.ts` holds a
module-level `saveGoalEntry` slot plus `bindGoalBehavior(fn)`, and `main.ts` wires
it once at boot inside the existing try/catch. If the bind fails, every goal
executor returns `{ok:false, detail:'goal behavior not bound'}` — a loud, clean
failure, not a silent no-op.

## §4 — Verification (positive evidence, scoped)

- All three edited files **parse clean** (`esbuild` per-file).
- `saveGoalEntry` is a real **top-level export**; the `require` path resolves (no
  resolution error naming it in the node-platform bundle).
- **Executor table keys match catalogue action ids exactly**: `notify`,
  `goal:create`, `goal:complete` present in both. `liveExecutors()` now returns 3.
- **Every column `goalComplete` reads exists in the `goals` schema** — `title`,
  `status`, `date`, `category`, `period`, `target_type`, `target_seconds`,
  `source` in the base DDL; `priority` via the existing `ALTER TABLE`.

## §5 — Honest status of the two open gates

- **Firing still UNWITNESSED** — unchanged and not claimable from source. The
  confirm-tier/review path and the whole witness story remain gated on a real run,
  which is what the boot `system.app.started` emit and these executors will
  produce first.
- **WF-H1 unchanged** — `tick()` body and main-process LLM loop still queued.

## §6 — One thing I did not do, so it isn't a surprise

I did **not** implement the two `planned` finance triggers
(`transaction.updated`, `account.created`). Your §3 contract says a trigger becomes
live by witnessed firing, not by code landing, and these are deliberately `planned`.
Adding emitters now would contradict that. Flagged in the Round-08 ledger, not
quietly built.
