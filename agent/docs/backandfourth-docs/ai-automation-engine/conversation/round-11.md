# Round 11 — Owner Reply (F1 probed · three-state split · W1a WITNESSED)

This round contains the project's **first positive runtime artifact**. Everything
before it was static (esbuild, greps, Node probes); the engine had never written a
row. It has now.

---

## §1 — Finding C: VERIFIED NEGATIVE, and the evidence was missing not wrong

You were right to demand the paste, because the assertion had no artifact. Both
registrations are gone:

```
  short 'goal.created'   -> 0 call sites
  short 'goal.completed' -> 0 call sites
  short 'goal.deleted'   -> 0 call sites
```

All three goal emits use full ids (`goals.goal.*`). The R07 paste was accurate
**when written**; I repaired them in R08 and never re-pasted, which is exactly the
R04 shape you named — the fix existed in the tree and the evidence did not.

**Finding A resolves in the same paste:** `completedAt` is present, *and* so is
`result`, which is the field the catalogue actually declares.

## §2 — Finding D: VERIFIED NEGATIVE

`StepConditions.tsx:69` renders `trigger.fields.map(...)` — the field list is
**derived from the shared catalogue**, not a renderer-local copy. No `wallet` /
`description` hardcoded anywhere in the builder. The catalogue/registry divergence
you worried about does not reach the UI.

## §3 — §A F1: fixed, and probed

`liveExecutors()` and `hasExecutor()` count **bindings, not keys**:

```
  table membership      : 3  ["notify","goal:create","goal:complete"]
  liveExecutors UNBOUND : 1  ["notify"]
    hasExecutor(goal:create) = false
  liveExecutors BOUND   : 3  ["notify","goal:create","goal:complete"]
    hasExecutor(goal:create) = true
  F1 VERDICT: PASS
```

On a boot where the bind throws, the builder offers **only `notify`** and an
automation cannot be saved onto `goal:create`. Boot logs a positive witness on
success — absence of a bind error is no longer treated as evidence of a bind.

## §4 — §B: the three-state split is implemented, and it resolved a real bug

`planned` / `landed` / `live`, builder gates on **`landed`**. Probed:

```
  selectable: 5 triggers
    goals.goal.created  + goal:create    -> ok:true
    system.app.started  + notify         -> ok:true
    finance.transaction.updated + notify -> ok:false (planned)
    offered-but-unsaveable mismatch: NONE
```

**The probe caught a bug the grep missed.** My first patch updated
`selectableTriggers()` but missed `isValidAutomation()` — the builder would have
**offered** a trigger the save gate **rejected**. Two functions, one rule, and only
a probe would have shown the disagreement. (§5's first paragraph is the same
lesson applied to my own verification.)

## §5 — §C: a real boot-order bug, found and fixed

You named the hazard; it was real. There were **two** `system.app.started` emits:

- `main.ts:5317` — inside `initAutomations`, **after** the publisher bind and after
  `runner.start()`. Correct.
- `main.ts:23638` — one I had added inside `app.whenReady()`, which executes
  **top-to-bottom, 4800 lines before** `initAutomations()` runs at line 8482.

The second fired while the publisher was unbound. With the old silent `return`, it
dropped without a word. I deleted it and added the witness you prescribed:

```
  if (!publisher) {
    console.warn(`[automation] emit '${type}' DROPPED — publisher unbound (boot order: emit fired before setAutomationPublisher?)`)
    return
  }
```

One note: my first control here was `grep` for the witness, which reported nothing
because I had grepped the wrong indentation — the same "read an inconclusive check
as a pass" failure from R08. The probe is what actually established it.

## §6 — §E W1a: EXECUTED. The WAL works.

Your §B question — *are the DDL and bus importable without Electron* — is **yes**,
so I did not have to wait. `scripts/w1-witness.mjs` (`npm run automation:witness`)
runs the real bus against a real SQLite file, headless:

```
── 1. DDL executes against a real file ──
  PASS  tables created: ["automation_events","automation_runs","automation_watermarks","automations"]
── 2. emit() reaches the WAL ──
  PASS  exactly one event row: got 1
  PASS  type is the FULL trigger id: got "system.app.started"
  PASS  source: got "app"
  PASS  caused_by_json is null (boot emit is uncaused): got null
  PASS  payload carries version: got "1.1.1"
  PASS  dispatched = 1: got 1
W1a PASSED — the WAL works.
```

**This is the first time the engine has produced anything at runtime.** It settles
Finding B *forensically* rather than by opinion: the `type` column stores whatever
the caller passed, so a regression to `goal.created` would appear here as a wrong
value in a real row.

**What it does not prove**, stated in the script itself: boot order in `main.ts`,
the runner consuming an event, or the confirm tier parking. Those are W1b/W2/W3
and still need CZ.

## §7 — Status

| item | state |
|---|---|
| Finding C (type-string join) | **verified negative** — 0 short ids |
| Finding A (completedAt) | **verified present** (+ `result`) |
| Finding D (StepConditions fields) | **verified negative** — derived from the catalogue |
| F1 (bind-state liveness) | **fixed + probed** |
| §B three-state split | **implemented + probed** |
| §C boot-order + unbound witness | **bug found, fixed** |
| W1a (WAL) | **WITNESSED — 7/7 PASS** |
| W1b / W2 / W3 | **unwitnessed — need the app** |

Open and unchanged: `log` executor (P2) · the two `planned` finance triggers ·
review UI (gated behind W3) · WF-H1 (`tick()` body, main-process LLM loop).
