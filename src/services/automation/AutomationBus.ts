// ─── AUTOMATION BUS — WAL-then-dispatch (RESULT.md §4) ───────────────
//
// The ordering is the whole design: write the event row FIRST, then match,
// then enqueue, then wake the worker. An action NEVER runs on the emitter's
// stack — `email:send` must not block the save-transaction handler that
// emitted the event.
//
// Crash between INSERT and dispatch → boot replays `dispatched = 0` rows.
// `UNIQUE(automation_id, event_id)` on automation_runs makes redelivery
// harmless. **The event row is the unit of replay; the run row is the unit of
// dedupe.**

import {
  type DomainEventEnvelope,
  type ConditionRow,
  getTrigger,
  matches,
  isValidAutomation,
} from '../../shared/automationCatalogue'

/**
 * LOOP GUARD — the current executor's provenance, carried across the async call
 * so a write made INSIDE an executor can be attributed to it.
 *
 * The store wraps ONLY the executor call, never the dispatch loop. That is the
 * whole mechanism: `publishAutomationEvent` runs synchronously inside a write
 * the executor performed (e.g. inside `saveGoalEntry`), so it observes the
 * store and can stamp the envelope. A `test-fire` never calls an executor, so
 * it never enters the context and dry-runs stay pure.
 */
export interface RunContextStore {
  automationId: string
  runId: string
  depth: number
}
export interface RunContext {
  getStore(): RunContextStore | undefined
  run<T>(store: RunContextStore, fn: () => T): T
}

/**
 * Loop-guard context.
 *
 * AsyncLocalStorage is a NODE builtin, and the main bundle is built by Vite with
 * browser-external shims. A STATIC NAMED import of it fails the build with
 *     "AsyncLocalStorage" is not exported by "__vite-browser-external"
 * so it is resolved lazily here at first use instead. If it is unavailable
 * (renderer context, or any non-Node bundle) we degrade to a synchronous shim
 * rather than taking the app down -- the guard then covers the current tick
 * only, which is strictly weaker but never fatal.
 */
function createRunContext(): RunContext {
  try {
    const mod = require('node:async_hooks') as { AsyncLocalStorage?: new <T>() => RunContext }
    const ALS = mod?.AsyncLocalStorage
    if (!ALS) throw new Error('AsyncLocalStorage unavailable')
    return new ALS<RunContextStore>()
  } catch {
    let current: RunContextStore | undefined
    return {
      getStore: () => current,
      run: (store, fn) => {
        const prev = current
        current = store
        try { return fn() } finally { current = prev }
      },
    }
  }
}

export const runContext: RunContext = createRunContext()

export interface AutomationRow {
  id: string
  trigger_id: string
  conditions_json: string
  condition_logic: 'and' | 'or'
  action_id: string
  action_params_json: string
  action_tier: 'benign' | 'confirm' | 'external'
  unattended: number
  priority: number
  lifecycle: 'forever' | 'once' | 'manual' | 'schedule'
  status: 'active' | 'paused' | 'invalid' | 'exhausted'
  enabled: number
}

export interface AutomationBusDeps {
  db: any
  /** Wakes the serial worker. Called AFTER rows are committed. */
  wake: () => void
  onError?: (msg: string, err?: unknown) => void
}

let eventCounter = 0
/** Monotonic + random so a crash-restart cannot reuse an id within a ms. */
export function newEventId(): string {
  eventCounter = (eventCounter + 1) % 0xffff
  return `evt_${Date.now().toString(36)}_${eventCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export class AutomationBus {
  private readonly deps: AutomationBusDeps
  constructor(deps: AutomationBusDeps) { this.deps = deps }

  /**
   * Write the event to the WAL, then match + enqueue in the same transaction
   * so a failure leaves `dispatched = 0` and boot replays it.
   * Returns the number of runs enqueued (0 is normal, not an error).
   */
  emit(input: {
    type: string
    payload: DomainEventEnvelope['payload']
    entity?: { kind: string; id: string }
    occurredAt?: number
    source?: DomainEventEnvelope['source']
    /** Only for tests / replay synthesis. Normal emits stamp from runContext. */
    causedBy?: DomainEventEnvelope['causedBy']
  }): { eventId: string; enqueued: number } {
    const db = this.deps.db
    const now = Date.now()
    const env: DomainEventEnvelope = {
      id: newEventId(),
      type: input.type,
      // occurredAt defaults to now; a REPLAY must pass the ORIGINAL row ts.
      occurredAt: input.occurredAt ?? now,
      emittedAt: now,
      source: input.source ?? 'app',
      payload: input.payload ?? {},
      entity: input.entity,
      // Stamp provenance when we were reached from inside an executor.
      causedBy: input.causedBy ?? (() => { const c = runContext.getStore(); return c ? { ...c } : undefined })(),
    }

    const trigger = getTrigger(env.type)
    if (!trigger) {
      // Not a catalogue type. Still recorded, so a later catalogue addition can
      // be reasoned about — but never matched, because we cannot know its shape.
      this.insertEvent(env, true)
      return { eventId: env.id, enqueued: 0 }
    }

    const tx = db.transaction(() => {
      this.insertEvent(env, false)
      const enqueued = this.matchAndEnqueue(env, trigger.id)
      db.prepare('UPDATE automation_events SET dispatched = 1, dispatched_at = ? WHERE id = ?')
        .run(now, env.id)
      return enqueued
    })

    const enqueued = tx() as number
    if (enqueued > 0) this.deps.wake()
    return { eventId: env.id, enqueued }
  }

  private insertEvent(env: DomainEventEnvelope, dispatched: boolean): void {
    this.deps.db.prepare(`
      INSERT OR IGNORE INTO automation_events
        (id, type, occurred_at, emitted_at, source, payload_json, entity_kind, entity_id, dispatched)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      env.id, env.type, env.occurredAt, env.emittedAt, env.source,
      JSON.stringify(env.payload), env.entity?.kind ?? null, env.entity?.id ?? null,
      dispatched ? 1 : 0,
    )
  }

  private matchAndEnqueue(env: DomainEventEnvelope, triggerId: string): number {
    const rows = this.deps.db.prepare(`
      SELECT * FROM automations
      WHERE trigger_id = ? AND enabled = 1 AND status = 'active'
      ORDER BY priority ASC
    `).all(triggerId) as AutomationRow[]

    const trigger = getTrigger(triggerId)
    if (!trigger) return 0
    const insRun = this.deps.db.prepare(`
      INSERT OR IGNORE INTO automation_runs
        (id, automation_id, event_id, status, attempt, created_at)
      VALUES (?, ?, ?, 'pending', 0, ?)
    `)

    let n = 0
    for (const row of rows) {
      // Result.md §8: `once` is exhausted after its first success, and
      // `manual` only ever fires via run-now — so it must NOT be enqueued here.
      if (row.lifecycle === 'manual') continue

      let conditions: ConditionRow[] = []
      let logic: 'and' | 'or' = 'and'
      try {
        conditions = JSON.parse(row.conditions_json || '[]')
        logic = (row.condition_logic || 'and') === 'or' ? 'or' : 'and'
      } catch { conditions = [] }

      // ── LOOP GUARD ───────────────────────────────────────────────────────
      // 1. never let an automation re-trigger itself
      // 2. never chain more than two automations (depth >= 2 is refused)
      // The rate limit is a BACKSTOP; this is the guard.
      if (env.causedBy) {
        if (env.causedBy.automationId === row.id) continue
        if (env.causedBy.depth >= 2) continue
      }

      if (!matches(trigger, env.payload, conditions, logic)) continue

      // The UNIQUE(automation_id, event_id) spine: a duplicate insert is
      // ignored, so redelivering an event cannot double-fire. That is the
      // entire idempotency story for this layer (RESULT.md §7 / Q4).
      const res = insRun.run(`run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        row.id, env.id, Date.now())
      if (res && (res as any).changes > 0) n++
    }
    return n
  }

  /** RESULT.md §7 boot step 3 — replay anything the WAL never dispatched. */
  replayUndispatched(): number {
    const db = this.deps.db
    const rows = db.prepare('SELECT * FROM automation_events WHERE dispatched = 0 ORDER BY occurred_at ASC LIMIT 200')
      .all() as any[]
    let total = 0
    for (const r of rows) {
      try {
        const env: DomainEventEnvelope = {
          id: r.id, type: r.type, occurredAt: r.occurred_at, emittedAt: r.emitted_at,
          source: r.source, payload: JSON.parse(r.payload_json || '{}'),
          entity: r.entity_id ? { kind: r.entity_kind ?? '', id: r.entity_id } : undefined,
        }
        const trigger = getTrigger(env.type)
        const enqueued = trigger ? this.matchAndEnqueue(env, trigger.id) : 0
        db.prepare('UPDATE automation_events SET dispatched = 1, dispatched_at = ? WHERE id = ?')
          .run(Date.now(), r.id)
        total += enqueued
      } catch (err) {
        // Mark it handled anyway. A poison row must not wedge the replay loop
        // forever on every boot.
        db.prepare('UPDATE automation_events SET dispatched = 1, dispatched_at = ? WHERE id = ?')
          .run(Date.now(), r.id)
        this.deps.onError?.('[automation] replay skipped a malformed event', err)
      }
    }
    if (total > 0) this.deps.wake()
    return total
  }
}

/** RESULT.md §7 boot step 2 + §6 — the SAME validation runs at save and at boot. */
export function validateAutomation(row: Pick<AutomationRow, 'trigger_id' | 'action_id'>):
  { ok: boolean; reason?: string } {
  return isValidAutomation(row.trigger_id, row.action_id)
}

// ─── The emit bridge ────────────────────────────────────────────────────
// A handler module under src/infrastructure/ipc/ CANNOT import from main.ts
// (main.ts imports it — that would be a cycle). So the bus publishes itself
// into a module-level slot, and any write-hook calls `publishAutomationEvent`.
// This is how a handler emits without knowing a runner exists, which is what
// keeps RESULT.md's "additive, not extraction" promise true: adding an emit is
// one appended line inside an existing closure, not a refactor.

type PublishFn = (type: string, payload: Record<string, any>, entity?: { kind: string; id: string }) => void

let publisher: PublishFn | null = null

export function setAutomationPublisher(fn: PublishFn | null): void { publisher = fn }

/**
 * Fire-and-forget emit for write-hook call sites. NEVER throws — an automation
 * problem must not fail the domain write that triggered it.
 */
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
  // An unbound publisher means this emit is silently dropped — a swallowed-error
  // path that owes a witness (RESULT.md §12). Name the fault instead of dropping.
  if (!publisher) {
    console.warn(`[automation] emit '${type}' DROPPED — publisher unbound (boot order: emit fired before setAutomationPublisher?)`)
    return
  }
  try { publisher(type, payload, entity) }
  catch (err) { console.warn(`[automation] publish(${type}) failed:`, (err as any)?.message) }
}
