# W-RUNBOOK — the two witnesses that need the real app

> **For CZ.** ~5 minutes, app launchable. Everything before this was static or
> headless; `npm run automation:witness` (W1a) already passes headlessly. These two
> steps are the only things left that require the actual Electron app.
>
> **Paste every output verbatim.** The witness artifacts are the evidence, and
> evidence is the only thing this phase is short of.

---

## STEP 0 — control for the negative witness (app CLOSED)

W1a ran against a temp DB. Before trusting any real-DB result, confirm the path is
the one the app actually writes:

```bash
sqlite3 ~/.config/RHEO/deskflow-data.db ".tables" | grep -c goals
sqlite3 ~/.config/RHEO/deskflow-data.db "SELECT name FROM sqlite_master WHERE name LIKE 'automation%';"
```

- **PASS**: first prints `>= 1`, second prints **nothing** (the DDL has never run
  on this profile — this is expected and correct before the first launch).
- **FAIL**: if `goals` is absent you have the wrong path. Stop and report the real
  `userData` path.

---

## STEP 1 — W1b: does the app's own boot emit land?

Launch the app from a terminal so the console is visible. Wait ~30 s. Quit.

```bash
sqlite3 ~/.config/RHEO/deskflow-data.db "SELECT type, source, caused_by_json, payload_json, dispatched FROM automation_events;"
```

**EXPECT:** exactly **1** row.

| column | expected |
|---|---|
| `type` | `system.app.started` |
| `source` | `app` |
| `caused_by_json` | `NULL` |
| `payload_json` | carries `version` |
| `dispatched` | `1` |

Also paste any console lines beginning `[automation]`.

**Reading the failures — each names its own cause:**

| what you see | what it means |
|---|---|
| **no row, no warning** | the emit was dropped silently → the unbound-publisher witness should have fired; if it didn't, the emit never ran |
| **no row, a warning** | the warning text names the fault directly — paste it verbatim |
| **row, wrong `type`** | emit-convention fault (a short id) |
| **`dispatched = 0`** | a finding about the flag, **not** a failed W1 |

---

## STEP 2 — W2: does an automation actually fire?

1. With the app open: save an automation — trigger **App Started**, **no
   conditions**; action **notify**, message `W2 witness`; defaults elsewhere.
2. Quit. Relaunch. Wait ~30 s. Quit.
3. Run both queries:

```bash
sqlite3 ~/.config/RHEO/deskflow-data.db "SELECT id,type,source FROM automation_events ORDER BY occurred_at;"
sqlite3 ~/.config/RHEO/deskflow-data.db "SELECT id,automation_id,event_id,status,attempt,error,result_json,finished_at FROM automation_runs;"
```

**EXPECT:**

- a **2nd** event row (`system.app.started`)
- exactly **1** run row, `status = succeeded`
- `run.event_id` = the 2nd event's `id`
- one desktop notification at boot

Each later relaunch adds one event + one run — per-event dedupe, so that is
expected, not a bug.

**If the builder refuses to save**, report the exact error. That would mean a
`planned` trigger is still being offered, which contradicts §13 — and it is the
bootstrap-deadlock regression, so it matters.

---

## STEP 3 — only after STEP 1 and STEP 2 pass (W3)

The confirm tier. Cheapest confirm automation is
**`goals.goal.created` → `goal:create`**. Run it, approve, and three inspectable
facts should hold:

1. the run transitions `awaiting-review` → `succeeded`
2. the composition emits a `goals.goal.created` event row stamped
   `causedBy = { automationId: <itself>, depth: 1 }`
3. **no second run row appears** — the self-loop skip worked

Fact 3 is an *absence*, which is exactly what a guard witness is. Its one
caveat, from your own analysis: it is only evidence if this automation is the
sole consumer of `goals.goal.created` at the time of the test. If something else
is also subscribed, a missing second run is ambiguous — say so in the report rather
than counting it as a pass.

**The review UI is built after W3 passes, not before.**