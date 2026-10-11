# Round 05 — Project Owner replies

> **I have to retract part of round 04 before anything else.** You were right to distrust
> my §3.1/§3.2, and your base-rate callout is accurate.

---

## 0. RETRACTION — round 04 §2 claimed a finding §3 never showed

Round 04 §2's table asserted:

> `goal:create` | `save-goal` | `main.ts` | in-place (i) | **1-line delegation**
> `goal:complete` | `complete-goal` | `main.ts` | in-place (i) | **1-line delegation**

And round 04 §3.1/§3.2 — the same document — literally said:

```
NOT FOUND as ipcMain.handle in main.ts (may live in infrastructure/ipc/*)
```

**I asserted the answer in the table while pasting the absence in the payload.** That is
exactly your §A worry, and it is worse than "asserted not pasted": it was
self-contradictory *within one file*. Note also that `complete-goal` **does not exist as a
channel at all** — I never checked; I inferred it from the action id.

Your tally stands: `email:send` wrong · "one delete" wrong · tool counts wrong ·
terminal-less refutation right. That is 3 wrong, 1 right, and I am not going to argue it.

---

## 1. THE ROSTER — now actually verified, and it dissolves WF-S1

You said WF-S1 was a *discovery* item because "no channel found behind those names is not
the same as no implementation." You were right, and the correct names are obvious once you
stop trusting my table:

```
$ grep -oE "handle\('[a-z-]*(schedule|deadline)[a-z-]*'" src/infrastructure/ipc/*.ts
  add-deadline            add-schedule-entry    apply-schedule-template
  delete-deadline         delete-schedule-entry get-deadlines
  get-schedule            get-schedule-templates parse-deadline
  parse-schedule          save-schedule-template snooze-deadline
  update-deadline         update-deadline-status update-schedule-entry
```

**All in `goal-handlers.ts`.** So:

| action | channel | file | class | status |
|---|---|---|---|---|
| `notify` | — (Electron `Notification`) | — | **ii** native | ✅ |
| `log` | `log-activity` | `main.ts` | **i-a** import | ✅ verbatim-confirmed |
| `goal:create` | `save-goal` → `upsertGoalRow` | `goal-handlers.ts` | **i-a** import | ✅ **now confirmed** |
| `goal:complete` | **`save-goal`** (same function, `status:'done'`) | `goal-handlers.ts` | **i-a** import | ✅ **there is no `complete-goal`** |
| `calendar:create` | `connectors:create-event` | `goal-handlers.ts` | **i-b** extract, 49 lines | ✅ |
| `email:send` | `connectors:send-email` | `goal-handlers.ts` | **i-b** extract, 29 lines | ✅ |
| `schedule:add` | **`add-schedule-entry`** | `goal-handlers.ts:2157` | **i-b** extract | ✅ **WF-S1 DISSOLVED** |
| `deadline:add` | **`add-deadline`** | `goal-handlers.ts:2197` | **i-b** extract | ✅ **WF-S1 DISSOLVED** |

**WF-S1 is closed.** Neither action is net-new. Both are ordinary extractions, and both
live in the same small modular handler file you proposed as the first-extraction probe —
which means your P2 is three extractions in one 2,700-line pure-handler module, not a
climb up `main.ts`.

`upsertGoalRow` is genuinely exported, which is what makes `goal:create` category (i-a):

```ts
// src/shared/goalUpsert.ts:170
export function upsertGoalRow(
  db: SqliteLike,
  id: string,
  goal: any,
  defaults: UpsertDefaults = {},
): 'created' | 'updated' {
  const cols = writableGoalColumns(db);
  const existed = !!db.prepare('SELECT 1 FROM goals WHERE id = ?').get(id);

  if (existed) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [col, read] of cols) {
      const v = read(goal);
      if (v === undefined) continue;              // not supplied → leave this column alone
      sets.push(`${col} = ?`);
      vals.push(v);
    }
    if (sets.length) db.prepare(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
```

One caveat against my own roster: `save-goal` is **not** a pure delegation. It also calls
`ensureGoalId(...)` and `episodeWriters.writeGoalEpisode(...)`. So `goal:create` is i-a for
the *upsert* and i-b for the *composition*. Your §B2 rule is what makes this tractable — the
whole composition becomes the shared function and the emit rides inside it. Without that,
importing `upsertGoalRow` alone would silently skip the episode write, which is
category-(iii) drift wearing an (i-a) badge.

---

## 2. §B2 ACCEPTED — and the audit says the gap is ALREADY LIVE

> The emit lives inside the shared function; one emit per behavior, at function level.

Accepted, and I checked rather than assumed. **`add-schedule-entry` and `add-deadline`
currently emit nothing:**

```
$ sed -n '2157,2185p' goal-handlers.ts | grep -c publishAutomationEvent   -> 0
$ sed -n '2197,2230p' goal-handlers.ts | grep -c publishAutomationEvent   -> 0
```

Consistent, because no `schedule.*` / `deadline.*` triggers exist in the canonical 16 yet.
But it means the **first time** those handlers are extracted, the emit must land with them
— or we build the loop guard around automations that cannot see their own writes.

---

## 3. §B3 LOOP GUARD ACCEPTED — and it is worse than "an infinite loop"

You framed it as `goals.goal.created → goal:create` looping. True, but the **confirm tier
makes it worse than a self-loop**: with `goal:create` at tier `confirm`, each iteration
parks in `awaiting-review`. A reviewer who approves one is now draining an unbounded queue,
and there is no UI for `awaiting-review` in P0.

Your three pieces are accepted as specified:
1. `AsyncLocalStorage` carrying the current run/automation id around executor invocation
2. `bus.emit()` stamps `causedBy` from that context onto the envelope
3. matcher skips when `causedBy.automationId === automation.id`, and skips chains at depth >= 2

I implemented P0 **without** the guard, because I did not know about it. That is a known
hole in what is currently in the tree, and I would rather name it than let P0 read finished.

---

## 4. §E CONFIRMED — the second legacy import is worse than a duplicate id

> `nlParser.ts:3` is `import { ACTION_DEFS } from './actionRegistry'` — the **legacy** action registry.

Confirmed. The legacy action registry carries **8** entries, and they are not the canonical 8:

```
legacy ACTION_DEFS:  notify  log  query  http  sleep  exec  trigger  transform
canonical ACTIONS:    notify  log  goal:create  goal:complete
                      schedule:add  deadline:add  calendar:create  email:send
```

**`exec`, `http`, `query` and `sleep` are in the live authoring path.** The NL parser can
build an automation that shells out or makes an HTTP request, from a file whose catalogue
is being deleted for exactly this reason. That is a larger finding than 22 orphan trigger
ids: orphan *triggers* fail closed (nothing emits them), whereas `exec` and `http` are
*actions* that would run. **WF-C1 now blocks the NL parser entirely** until both imports
are rewired — I will not ship the parser against either registry.

---

## 5. §C CONFIRMED — the connectorId param gap is real

> `connectors:send-email` *requires* `connectorId`, and the `email:send` ActionDef carries
> only `to/subject/body`.

Confirmed by signature:

```ts
sendEmail: (data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string })
```

Same for `createEvent`. So your re-scope stands: both ActionDefs gain a `connector` param
with `dynamicSource`, save-time validation that it exists, and a since-deleted connector is
a **loud run failure carrying the stored id** — never a silent skip.

Your `{success, error}` convention note is also accepted: executors treat `success: false`
as run failure uniformly.

---

## 6. YOUR BUG-LEDGER NOTE IS CONFIRMED — two of the 90 tools are dead

> `createScheduleFromEmail` and `createDeadlineFromEmail` call preload entries that don't exist.

```
$ grep -c createScheduleFromEmail src/preload.ts   -> 0
$ grep -c createDeadlineFromEmail src/preload.ts  -> 0
```

Confirmed. Two advertised tools have no preload binding, so calling them throws in the
renderer. Filing separately, per your "independent of this feature."

---

## 7. The REQUEST — everything you asked for, verbatim

### 7.1 `save-goal` — and note it is NOT a one-liner, contrary to my claim

```ts
('save-goal', async (_event, date: string, goal: any) => {
  try {
    const id = ensureGoalId(goal.id);
    // `date` arrives as its own argument and is authoritative for this write.
    const payload = { ...goal, date };
    const action = upsertGoalRow(db!, id, payload, {
      date,
      category: goal.category || 'work',
      targetType: goal.target?.type || 'time',
      status: goal.status || 'pending',
      period: goal.period || 'daily',
      source: goal.source || 'manual',
    });
    // Capture goal episode into context brain
    try { episodeWriters.writeGoalEpisode({ ...goal, id }, action === 'created' ? 'created' : (goal.status === 'done' ? 'completed' : 'updated')); } catch {}
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
})
```

The delegated function's export status:

```ts
// src/shared/goalUpsert.ts:170
export function upsertGoalRow(
  db: SqliteLike,
  id: string,
  goal: any,
  defaults: UpsertDefaults = {},
): 'created' | 'updated' {
  const cols = writableGoalColumns(db);
  const existed = !!db.prepare('SELECT 1 FROM goals WHERE id = ?').get(id);

  if (existed) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [col, read] of cols) {
      const v = read(goal);
      if (v === undefined) continue;              // not supplied → leave this column alone
      sets.push(`${col} = ?`);
      vals.push(v);
    }
    if (sets.length) db.prepare(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
```

Plus a local helper the closure also uses, which is **NOT exported** — so it must move with
the composition if the composition is extracted:

```ts
// src/infrastructure/ipc/goal-handlers.ts:155
function ensureGoalId(raw: any): string { /* pasted on request */ }
```

### 7.2 `goal:complete` — **there is no such channel.** Confirmed set:

```
$ grep -oE "handle\('(goal|save-goal)[a-z-]*'" src/infrastructure/ipc/goal-handlers.ts | sort -u
  save-goal  save-goal-review  save-goals-batch  save-goal-suggestion
```

So `goal:complete` is `save-goal` with `goal.status === 'done'`. **One function serves
both actions**, which also means the runner-side exact-match title resolution you specified
has no home: the id is not resolved by a channel name, it is resolved against
`upsertGoalRow`'s upsert semantics.

### 7.3 `add-schedule-entry` and `add-deadline` — the WF-S1 dissolve, verbatim

```ts
('add-schedule-entry', async (_event, entry: any) => {
  try {
    const id = 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    db!.prepare('INSERT INTO schedule_entries (id, title, location, day_of_week, start_time, end_time, category, color, goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, entry.title, entry.location || null, entry.day_of_week, entry.start_time, entry.end_time, entry.category || 'class', entry.color || '#22d3ee', entry.goal_id || null);
    return { success: true, id };
  } catch (err: any) { return { success: false, error: err.message }; }
})
```

```ts
('add-deadline', async (_event, dl: any) => {
  try {
    const id = 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    // Normalize ISO timestamps to YYYY-MM-DD so the calendar grid (keyed by date)
    // and daysUntil() line up. Raw timestamps previously produced NaN + never landed.
    const normDue = dl.due_date ? dl.due_date.slice(0, 10) : null;
    const normRemind = dl.remind_at ? dl.remind_at.slice(0, 10) : null;
    db!.prepare('INSERT INTO deadlines (id, title, course, due_date, priority, description, category, remind_at, goal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, dl.title, dl.course || null, normDue, dl.priority || 'medium', dl.description || null, dl.category || null, normRemind, dl.goal_id || null);
    return { success: true, id };
  } catch (err: any) { return { success: false, error: err.message }; }
})
```

Both carry **inline SQL** — no delegation, so both are category **(i-b)**.

---

## 8. What I need from you

1. **The phase rule now has a clean answer.** Under your rule — (ii) or (i-a) enters P0 —
   P0 = `notify` (ii) + `log`, `goal:create`, `goal:complete` (i-a) = **4 executors**, and
   the first (i-b) is `connectors:create-event` in P2, exactly as you proposed. **P1 retired.**
   Confirm, or tell me the rule needs one more clause now that `save-goal` is a composition
   rather than a delegation.
2. **`goal:complete` has no channel.** Your earlier contract had the runner resolve a title
   to an entity by exact match and fail loudly on no-match. With `save-goal` upserting on
   id, that contract needs restating: does the ActionDef carry a `goalId` instead of a
   `title`, or does the runner resolve title to id itself before calling the shared function?
   I will not guess, because exact-match-by-title was your §8 rule and I want to keep it.
3. **`exec`/`http` in the live NL path.** Beyond blocking WF-C1 — is there an argument for
   deleting `query`/`http`/`sleep`/`exec` from the codebase rather than from the registry?
   They are not in the canonical 8, nothing persists a reference, and `exec` in an
   automation is a capability I would rather not keep reachable from a text box.

Still queued, WF-H1 sizing only: `tick()` body; existence of a main-process LLM loop.
