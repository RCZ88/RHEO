# RESULT.md — Automations: rules fire missions

> **Saved verbatim from the Specialist, 2026-10-07.** Do not edit in place — corrections
> live in `conversation/round-04.md` as amendments. See §11 for what round 4 changed.

## 0. Thesis

Rules are not missions; **rules fire missions.** An automation compiles to a dispatch descriptor owned by a main-process rule runner. Only objective-shaped actions compile further into Conductor mission templates. Today's catalogue is 8/0 tool-lane — so Phase 1 is entirely tool-lane; the mission lane is designed, priced (§9), and gated behind a named prerequisite rather than assumed.

**Q1 (rule vs. mission):** compiling wholesale fails three ways — it presupposes the rule engine anyway, it degenerates one-call actions into LLM+PTY+worktree missions, and it inverts retry safety. **Q2 (bus):** typed emission over the canonical 16, one generic matcher over the builder's existing predicate language — a second query language is never created because `ConditionRow[]` + 10 operators + the lex→parse→scope validator already are one. **Q3 (missed):** per-trigger miss policy + boot-time watermark scan, runner reads domain rows but never writes them. **Q4 (idempotency):** the event row is the unit of replay; the run row (`UNIQUE(automation_id, event_id)`) is the unit of dedupe. **Q5 (stability):** trigger ids immutable; renames mint new ids + deprecation map; boot validation marks orphans `invalid` with a loud banner — never a silent no-op.

## 1. Architecture

```
domain write sites ──emit──▶ AutomationBus (WAL: automation_events)
                                   │  synchronous pure matcher (shared catalogue)
                                   ▼
                          automation_runs (UNIQUE spine)
                                   │  serial worker: priority DESC, occurredAt ASC
                                   ▼
                    executors (tool lane)  │  conductor:start (mission lane, P3)
```

## 2. Shared catalogue — `src/shared/automationCatalogue.ts` (new)

No React imports; renderer registries re-export it and attach icons/labels. Holds: canonical 16 triggers (source, event, `fields[]`, `kind: 'edge' | 'level'`, `missPolicy`, `emissionStatus`), 8 action defs (`lane`, `tier`, params), operator set, the matcher, param substitution, envelope types, catalogue version, deprecation map. **The renderer's offer-set derives from live `emissionStatus` + live executors — a catalogue entry with no emission or no executor is unselectable, making the void structurally unshippable.**

Catalogue-merge outcome: canonical = `automations/data/triggerRegistry.ts` (16); legacy `automation/triggerRegistry.ts` is deleted; **`nlParser.ts` is rewired to the shared catalogue and constrained to live triggers** (§C — without this the NL path manufactures Q5 violations on day one). Deprecation map records legacy→canonical equivalents where they exist (`session.completed`→`focus.session.ended`, `app.launched`→`system.app.started`); legacy-only ids (`budget.exceeded`, `window.changed`, …) are recorded as *unimplemented*, not mapped to lies.

Emission classes: **write-hook** (finance ×3, goals ×3 — `bus.emit()` appended inside the closure after the mutation; *additive*, not extraction), **detector** (focus ×3, ide ×2, learning ×2 — poll-diff watchers), **lifecycle** (system ×3 — boot / idle detector / powerMonitor). Phase 1 ships write-hooks + `system.app.started` (7 live); detectors P2.

## 3. Event envelope

```ts
interface DomainEventEnvelope {
  id: string          // 'evt_...' — dedupe key
  type: DomainEventType            // 16-member union, e.g. 'finance.transaction.created'
  occurredAt: number  // when the fact happened (row timestamp for replay)
  emittedAt: number   // when the bus saw it (≠ occurredAt for replay/derived)
  source: 'app' | 'detector' | 'replay' | 'tracker'
  payload: Record<string, string | number | boolean | null>  // exactly the catalogue's fields + entity id
  entity?: { kind: string; id: string }  // enables *.created dedupe
}
```

## 4. Bus — WAL-then-dispatch

`emit()`: INSERT event row (unique id) → synchronous matcher pass over enabled automations with that trigger → INSERT run rows (UNIQUE; conflict = skip) → mark event dispatched → wake worker. Actions never execute on the emitter's stack. Queue order: `priority DESC, occurredAt ASC` — this is what the 1–1000 slider is for. **Per-automation serialization:** one in-flight run per automation. Crash between insert and dispatch → boot replays `dispatched = 0` rows; the UNIQUE spine makes redelivery harmless. Events WAL is pruned (dispatched, older than N days); runs are not.

**Edge vs. level:** all 16 canonical triggers are edge facts — per-event evaluation is sound with zero persisted state. Level triggers (none canonical yet) require rising-edge detection with persisted `last_satisfied_at`; the catalogue field, the column, and a matcher branch are *reserved* and unbuilt until the first level trigger enters the catalogue.

## 5. Schema (three tables + watermarks kv)

```sql
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
  trigger_id TEXT NOT NULL, catalogue_version INTEGER NOT NULL,
  conditions_json TEXT NOT NULL DEFAULT '[]', condition_logic TEXT NOT NULL DEFAULT 'and',
  action_id TEXT NOT NULL, action_params_json TEXT NOT NULL,
  lane TEXT NOT NULL DEFAULT 'tool', mission_template_id TEXT,
  action_tier TEXT NOT NULL,                 -- benign | confirm | external
  unattended INTEGER NOT NULL DEFAULT 0,     -- review-time opt-in
  on_miss TEXT NOT NULL DEFAULT 'fire',      -- fire | digest | hold
  lifecycle TEXT NOT NULL DEFAULT 'forever', -- forever | once | manual | schedule(≡manual, deprecatedPending:'time-triggers')
  priority INTEGER NOT NULL DEFAULT 500, category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active',     -- active | paused | invalid | exhausted
  status_reason TEXT, last_satisfied_at INTEGER,   -- reserved: level triggers
  enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_events (
  id TEXT PRIMARY KEY, type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL, emitted_at INTEGER NOT NULL,
  source TEXT NOT NULL, payload_json TEXT NOT NULL,
  entity_kind TEXT, entity_id TEXT,
  dispatched INTEGER NOT NULL DEFAULT 0, dispatched_at INTEGER
);
CREATE INDEX idx_autoevents_undispatched ON automation_events(dispatched) WHERE dispatched = 0;

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY, automation_id TEXT NOT NULL REFERENCES automations(id),
  event_id TEXT NOT NULL REFERENCES automation_events(id),
  status TEXT NOT NULL,          -- pending | running | awaiting-review | succeeded | failed | skipped
  attempt INTEGER NOT NULL DEFAULT 0, attempts_json TEXT,   -- audit trail per attempt
  error TEXT, result_json TEXT, digested_into TEXT,
  created_at INTEGER NOT NULL, finished_at INTEGER,
  UNIQUE(automation_id, event_id)                             -- THE dedupe spine
);

CREATE TABLE IF NOT EXISTS automation_watermarks (event_type TEXT PRIMARY KEY, watermark INTEGER NOT NULL);
```

## 6. IPC surface

`automation:list · get · save · delete · toggle · get-runs · get-events · test-fire · run-now · capabilities · resolve-review`, plus push channel `automation:changed` (webContents.send, mirroring `conductor:signal`). `save` runs the same validation the boot check runs (shared function) — an automation cannot be *saved* invalid; it can only become invalid when the catalogue shifts under it (Q5 path). `test-fire` feeds a synthetic envelope through matcher + param substitution in pure dry-run — matched?, resolved params — no enqueue, no executor; surfaced as a Test button in Review.

## 7. Runner algorithm

**Boot:** (1) idempotent DDL; (2) validate every active automation — trigger_id ∈ catalogue ∧ emission live ∧ action has executor, else `status='invalid'` + reason + banner push; (3) crash recovery: replay `dispatched=0` events, reset `running` runs → `failed('crashed')`; (4) missed-trigger scan: for `missPolicy='scan'` triggers, SELECT domain rows `> watermark` (read-only), synthesize envelopes with `occurredAt` = row timestamp, `source='replay'`, bump watermark — tracker-written `logs` rows are consumed this way for focus events; (5) start serial worker; register emitters.

**Dispatch loop:** pop highest-priority pending run (automation enabled, not in-flight) → `running` → resolve params (event-field substitution only) → tier policy (§8) → execute → record → `succeeded|failed|awaiting-review`. Digest: replay bursts match N times → N run rows (spine intact); the executor coalesces pending runs of one automation into a single firing, siblings → `skipped` with `digested_into`. Retries: benign → bounded auto-retry (attempt++, backoff); confirm → park `awaiting-review` on failure; external → never auto-retry; mission lane → never retry (recovery is Conductor's job). Lifecycle: `once` → `exhausted` after first success; `manual` → armed, fires only via `run-now`.

## 8. Security policy

**Tiers:** benign = `notify`, `log`; confirm = `goal:create`, `goal:complete`, `schedule:add`, `deadline:add`, `calendar:create`; external = `email:send`. **Unattended:** benign → yes; confirm → only via review-time "runs unattended" opt-in (default off → parks `awaiting-review`, reusing the ConductorStatus vocabulary); external → never unattended in v1 (also has no main-side send path — see WF-E1). **Review-time authorization is the second, stronger gate:** parameters frozen at save; only event fields substitute; `goal:complete` resolves titles by exact match, no-match → run fails loudly — fuzzy matching is judgment and belongs in the mission lane, not the tool lane. Rate limiting main-side (per-automation fires/hour at enqueue; digest as pressure valve). **Automation-fired git missions** (mission-git, optional early subtype): forced L2 regardless of config — L4's `autoApprove` pre-approves runtime judgment, which adds risk without value when design-time review already froze the plan — plus explicit review opt-in and micro-budget. Blast-radius invariant: **executors ⊆ (tools reachable main-side) ∪ {native notify}** — an automation can never do something the AI could not.

## 9. Named work items

- **WF-H1 — Headless mission mode (P3, prerequisite for mission-headless).** Type widenings + mode branch + guards (~150–250 lines, medium risk, confined to ConductorService + tab) **plus the net-new main-process headless agent runtime (~300–500 lines + provider wiring)** — the majority cost. Open sizing dependencies: `tick()` body; existence of a main-side LLM invocation loop. *Mission-git needs none of this and is available under §8 gating.*
- **WF-E1 — email:send connector send path.** Only action with no existing implementation to extract; connector-level work, strictly gated (external tier), may slip past P2 without blocking anything else.
- **WF-C1 — Catalogue consolidation.** Shared module, legacy delete, **nlParser rewire to live triggers**, deprecation map, capabilities channel.

## 10. Extraction policy — (d), verbatim

> **One behavior, one function.** An executor is exactly one of: **(ii) native** — a
main-process capability with no IPC counterpart; **(i-a) import** — a named, exported
function an IPC closure already delegates to; **(i-b) extract** — an inline closure body
moved verbatim to an exported function in the same handler module; **net-new** —
functionality existing nowhere. **(iii) — re-implementation — is forbidden.**

**Clause (behavior unit):** the executor imports the behavior, not a function. Where the
backing closure composes several units, the shared thing is the composed whole. A
composition move within one **infrastructure handler file** is P0-eligible; the first
cross-concern (i-b) probe remains P2's `connectors:create-event`. **P0 touches nothing in
`main.ts` except additive DDL and runner construction.**

## 11. File-by-file plan

- **P0 — spine, zero extraction:** new `src/shared/automationCatalogue.ts`; new `src/services/automation/{AutomationBus,AutomationRunner,executors}.ts` (executors = `notify` only, Electron-native); main.ts: DDL, runner construction with injected executors, `automation:*` IPC, write-hook `emit()` in the 7 phase-1 closures, `system.app.started` emission; renderer: registries import shared catalogue, capabilities gating, save path → IPC; **nlParser rewire (WF-C1)**. *Done-bar greps go green here — and the bar is necessary-not-sufficient: the proof is a `notify` run in `automation:get-runs` fired by a real `transaction.created`.*
- **P1 — first extraction:** `goal:create` (extract goal-save closure in-place), `log` executor, review UI (unattended toggle, on-miss selector, test-fire), `AutomationCardData.lastFired/lastStatus` wired to real runs — those fields were designed for a runner that never existed.
- **P2 — remaining executors + detectors:** `goal:complete`, `schedule:add`, `deadline:add`, `calendar:create` per Appendix A; focus/ide/learning/idle/resumed detectors; WF-E1 if connector work lands.
- **P3 — WF-H1 + mission lane:** headless mode, headless runtime, mission-lane `ActionDef` support, mission-git subtype optionally earlier under §8 gating.

## Appendix A — executor mapping

| action | backing | extraction | status |
|---|---|---|---|
| `notify` | Electron `Notification` | none — native (ii) | confirmed |
| `goal:create` | save-goal-family closure | in-place (i) | likely — closure pending |
| `goal:complete` | goal check-off channel | (i) | ? |
| `schedule:add` | behind `createScheduleFromEmail` | (i) | ? |
| `deadline:add` | behind `createDeadlineFromEmail` | (i) | ? |
| `email:send` | none (WF-E1) | — | confirmed gap |
| `calendar:create` | behind `createCalendarEvent` | (i) | ? |
| `log` | activity-log append | (i) or (ii) | ? |

---

## AMENDMENTS — round 04 (Project Owner, verified against source)

Appended rather than edited in place, per the skill's anti-pattern on losing state.

### A1. §9 WF-E1 is largely wrong — `email:send` IS implemented

I told the Specialist "only `replyToEmail` exists." That was false.

```ts
// src/preload.ts:1720
sendEmail: (data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string })
  => ipcRenderer.invoke('connectors:send-email', data)
```

`connectors:send-email` is a **29-line handler already written**, in
`src/infrastructure/ipc/goal-handlers.ts:2684`. So `email:send` is category **(i)**
in-place extraction, not a net-new capability. The `external` tier and its
never-unattended policy are unchanged — only the implementation-gap framing is wrong.

### A2. `calendar:create` is also already backed — 49 lines exist

`connectors:create-event` in the same file, driven by `createEvent` in preload. Category
**(i)**.

### A3. Two actions genuinely have NO backing: `schedule:add`, `deadline:add`

`createScheduleFromEmail` / `createDeadlineFromEmail` exist **only inside
`toolRegistry.ts`** — they are tool *names*, not IPC channels. No `ipcMain.handle` and no
preload entry exists for either. **New work item WF-S1**, same class as the old WF-E1.

### A4. §10 — the extraction surface is 913 closures, not 629

```
src/main.ts                            : 629 ipcMain.handle closures
src/infrastructure/ipc/*.ts (9 files)  : 284 ipcMain.handle closures
                                        ---
                                        913 total
```

**All 12 `connectors:*` channels live in `src/infrastructure/ipc/goal-handlers.ts`** (a
2,700-line modular handler file), not `main.ts`. Phase-1/P2 extractions therefore land in
small handler-shaped files where the (d) "in-place, same file" property is nearly free.

### A5. §2 / WF-C1 is a correctness gate, and the numbers are worse

The legacy registry has **38 ids**, not 16. Only 16 are canonical; **22 have no canonical
equivalent**, including `note.created`, `goal.created`, `session.completed`,
`goal.progress`, `transaction.created`. `nlParser.ts:2` imports `EVENT_SOURCES` from the
**legacy** registry and is a live authoring path. Deleting the legacy registry without
rewiring the parser leaves it emitting 22 permanently-unmatchable ids — a Q5 violation
manufactured on day one by the tool the original brief names as half the input surface.

### A6. Appendix A — resolved

| action | backing | file | extraction | status |
|---|---|---|---|---|
| `notify` | Electron `Notification` | — | none — native (ii) | confirmed |
| `goal:create` | `save-goal` | `main.ts` | in-place (i) | **1-line delegation** |
| `goal:complete` | `complete-goal` | `main.ts` | in-place (i) | **1-line delegation** |
| `log` | `log-activity` | `main.ts` | in-place (i) | resolved (7 lines) |
| `calendar:create` | `connectors:create-event` | `goal-handlers.ts` | in-place (i) | **49 lines exist** |
| `email:send` | `connectors:send-email` | `goal-handlers.ts` | in-place (i) | **29 lines exist** |
| `schedule:add` | none | — | — | **WF-S1 — no implementation** |
| `deadline:add` | none | — | — | **WF-S1 — no implementation** |

**Open question put to the Specialist (round 04 §4):** `save-goal` and `complete-goal` are
one-line delegations to already-exported functions, so category (i) is *free* for them. If
so, is any extraction left in P1 — or does **P0 become spine + 4 executors with zero
extraction**, and every real extraction move to P2?
---

## §12 — Emission liveness is empirical (round 08 addition)

> **`emissionStatus` flips to live by witnessed firing, never by code landing.**
> A trigger's liveness is an empirical fact about the running system. First firing
> witnessed in `automation:get-runs` → live; until then, the builder does not offer it.

Two consequences this codebase now holds itself to:

1. **Every swallowed-error path owes a witness.** Silence converts "broken" and
   "working" into the same observable state; only a positive end-to-end firing
   distinguishes them. A `try {} catch {}` around an emit is a promise that
   something will eventually *prove* it fired.
2. **`publishAutomationEvent` is the single seam where payload drift becomes
   visible.** It performs one catalogue lookup per emit and warns (never throws)
   when the type is unknown or a declared field is absent — so a wrong-id join or
   a missing field is caught at its **first firing**, not at a user's first
   condition.

### Emission ledger (round 08, verified by grep)

| trigger | emitter | firing |
|---|---|---|
| `goals.goal.created` | `saveGoalEntry` | unwitnessed |
| `goals.goal.completed` | `saveGoalEntry` | unwitnessed |
| `goals.goal.deleted` | `delete-goal` | unwitnessed |
| `finance.transaction.created` | finance write-hook | unwitnessed |
| `system.app.started` | `app.whenReady()` boot | unwitnessed |
| `finance.transaction.updated` | **none** | correctly `planned` |
| `finance.account.created` | **none** | correctly `planned` |

Every `live` trigger now has an emitter. **None has a witnessed firing yet** —
that is the open gate, named honestly rather than marked green.

---

## §13 — Three-state emission (round 11; supersedes the R09 amendment)

The R09 amendment tightened `live` to mean *witnessed event row* while §3's builder
gate still required `live`. Composed, those **deadlock**: nothing is live until
witnessed → witnessing needs a saved automation → the builder will not offer an
unwitnessed trigger → nothing can ever be saved.

Resolved by splitting the flag. The definitions stand; only the gate moves:

> **`planned`** — no emitter.
> **`landed`** — an emitter exists in the tree, unwitnessed. **The builder gate.**
> **`live`** — a witnessed event row: correct type, conformance-clean, real source.
> Display badge only.

`selectableTriggers()` and `isValidAutomation()` both gate on **not-planned**, so a
`landed` trigger is offered *and* saveable. Probed: 5 selectable, 5 saveable,
zero offered-but-unsaveable, `planned` still rejected.

**Bonus:** a trigger that stays `landed` across N boots without ever reaching `live`
is a self-diagnosing **emitter-health signal** — it would have surfaced Finding C
(a wrong type-string join) with no paste required.

### Emission ledger (verified by grep, round 11)

| trigger | emitter | state |
|---|---|---|
| `finance.transaction.created` | finance write-hook | landed |
| `goals.goal.created` | `saveGoalEntry` | landed |
| `goals.goal.completed` | `saveGoalEntry` | landed |
| `goals.goal.deleted` | `delete-goal` | landed |
| `system.app.started` | `initAutomations` boot | landed |
| all others (9) | — | planned |

Zero `live`. Nothing has a witnessed firing **in the app** — but see §14.

## §14 — W1a: the first positive runtime witness (round 11)

Everything before this was static. `scripts/w1-witness.mjs` (run:
`npm run automation:witness`) is the **first artifact produced by running the real
`AutomationBus` against a real SQLite file**, headless, no Electron.

It proves three things and states what it does not:

1. **The four `CREATE TABLE` statements execute** against a real database.
2. **`emit()` reaches the WAL** — a real `automation_events` row lands with
   `type='system.app.started'`, `source='app'`, `caused_by_json=NULL`, a
   `payload.version`, and `dispatched=1`.
3. **The emit convention is observable in the persisted row** — this is the
   forensic evidence that settles Finding B. The `type` column stores whatever the
   caller passed, so a regression to a short id (`goal.created`) would be visible
   here as a wrong value in a real row, not a matter of opinion.

It does **not** prove boot order in `main.ts`, the runner consuming an event, or
the confirm tier parking in `awaiting-review`. Those remain W1b/W2/W3 and need the
real app.
