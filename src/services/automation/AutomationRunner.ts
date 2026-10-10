// ─── AUTOMATION RUNNER — the serial worker (RESULT.md §7) ─────────────
//
// One in-flight run PER AUTOMATION, so a tracker burst cannot pile up twelve
// sends. Queue order: priority DESC, occurredAt ASC — priority is the 1-1000
// slider, and DESC because a higher number means "do me sooner".
//
// Per-automation serialization is the reason this is a single loop rather than
// a promise pool: it is the only way to guarantee no two runs of the same
// automation overlap without a per-automation lock table.

import { resolveParams, getAction, type ConditionRow } from '../../shared/automationCatalogue'
import { AutomationBus, runContext, validateAutomation, type AutomationRow } from './AutomationBus'
import { buildExecutors, hasExecutor, type Executor } from './executors'

export interface RunnerDeps {
  db: any
  executors: Record<string, Executor>
  log?: (msg: string) => void
  warn?: (msg: string) => void
  /** Broadcast so the renderer can update. */
  notifyChanged?: () => void
}

const POLL_MS = 400
const MAX_BACKOFF_MS = 30_000

export class AutomationRunner {
  private readonly deps: RunnerDeps
  private bus: AutomationBus | null = null
  private running = false
  private loopHandle: ReturnType<typeof setTimeout> | null = null
  private inFlight = new Set<string>()
  private attempts = new Map<string, number>()

  constructor(deps: RunnerDeps) { this.deps = deps }

  /** Bus needs to call back into `wake`, so it is wired after construction. */
  attachBus(bus: AutomationBus): void { this.bus = bus }

  /**
   * RESULT.md §7 boot step 2. Marks every active automation the catalogue can
   * no longer honour as `invalid` WITH a reason — never a silent no-op (Q5).
   */
  validateAll(): { valid: number; invalid: number } {
    const db = this.deps.db
    const rows = db.prepare("SELECT id, trigger_id, action_id, status FROM automations WHERE status = 'active'")
      .all() as Array<{ id: string; trigger_id: string; action_id: string; status: string }>
    let valid = 0, invalid = 0
    const mark = db.prepare("UPDATE automations SET status = 'invalid', status_reason = ? WHERE id = ?")
    for (const r of rows) {
      const v = validateAutomation(r)
      const noExec = v.ok && !hasExecutor(r.action_id)
      if (v.ok && !noExec) { valid++; continue }
      invalid++
      const reason = noExec
        ? `action ${r.action_id} has no executor registered yet`
        : (v.reason ?? 'invalid')
      mark.run(reason, r.id)
      this.deps.warn?.(`[automation] ${r.id} -> invalid: ${reason}`)
    }
    if (invalid > 0) this.deps.notifyChanged?.()
    return { valid, invalid }
  }

  /** RESULT.md §7 boot step 3 — crashed runs cannot stay `running` forever. */
  recoverCrashedRuns(): number {
    const res = this.deps.db.prepare(
      "UPDATE automation_runs SET status = 'failed', error = 'crashed', finished_at = ? WHERE status = 'running'",
    ).run(Date.now())
    const n = (res as any)?.changes ?? 0
    if (n > 0) this.deps.warn?.(`[automation] recovered ${n} crashed run(s)`)
    return n
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.schedule(0)
  }

  stop(): void {
    this.running = false
    if (this.loopHandle) { clearTimeout(this.loopHandle); this.loopHandle = null }
  }

  private schedule(ms: number): void {
    if (!this.running) return
    if (this.loopHandle) clearTimeout(this.loopHandle)
    this.loopHandle = setTimeout(() => { void this.tick() }, ms)
  }

  private async tick(): Promise<void> {
    if (!this.running) return
    try {
      const did = await this.step()
      this.schedule(did ? 0 : POLL_MS)
    } catch (err: any) {
      // The loop must survive ANY throw. A dead runner is a silent no-op, which
      // is the exact failure mode Q5 forbids.
      this.deps.warn?.(`[automation] runner tick failed: ${err?.message}`)
      this.schedule(MAX_BACKOFF_MS)
    }
  }

  /** Pop and run at most one run. Returns true when work was done. */
  private async step(): Promise<boolean> {
    const db = this.deps.db
    const rows = db.prepare(`
      SELECT r.id AS run_id, r.automation_id, r.event_id, r.attempt,
             a.action_id, a.action_params_json, a.action_tier, a.unattended,
             a.lifecycle, a.priority, a.enabled, a.status AS auto_status,
             e.type AS event_type, e.payload_json, e.caused_by_json
      FROM automation_runs r
      JOIN automations a ON a.id = r.automation_id
      JOIN automation_events e ON e.id = r.event_id
      WHERE r.status = 'pending'
      ORDER BY a.priority DESC, e.occurred_at ASC
      LIMIT 25
    `).all() as any[]

    for (const run of rows) {
      if (this.inFlight.has(run.automation_id)) continue      // per-automation lock
      if (run.enabled !== 1 || run.auto_status !== 'active') {
        db.prepare("UPDATE automation_runs SET status = 'skipped', error = ?, finished_at = ? WHERE id = ?")
          .run('automation disabled', Date.now(), run.run_id)
        continue
      }
      await this.execute(run)
      return true
    }
    return false
  }

  private async execute(run: any): Promise<void> {
    const db = this.deps.db
    this.inFlight.add(run.automation_id)
    db.prepare("UPDATE automation_runs SET status = 'running', attempt = attempt + 1 WHERE id = ?").run(run.run_id)
    const attempt = (run.attempt ?? 0) + 1

    let params: Record<string, string | number | boolean> = {}
    let payload: Record<string, any> = {}
    try { params = JSON.parse(run.action_params_json || '{}') } catch {}
    try { payload = JSON.parse(run.payload_json || '{}') } catch {}

    // Event-field substitution only. This is not judgement — it is why
    // goal:create with title `{title}` legitimately stays in the tool lane.
    const resolved = resolveParams(params, payload)

    const executor = this.deps.executors[run.action_id]
    if (!executor) {
      db.prepare("UPDATE automation_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?")
        .run(`no executor for ${run.action_id}`, Date.now(), run.run_id)
      this.inFlight.delete(run.automation_id)
      return
    }

    // RESULT.md §8 tier policy. unattended defaults to 0, so a `confirm` action
    // parks for review unless the user explicitly opted in at review time.
    const unattended = run.unattended === 1
    if (run.action_tier !== 'benign' && !unattended) {
      db.prepare("UPDATE automation_runs SET status = 'awaiting-review', error = NULL WHERE id = ?")
        .run(run.run_id)
      this.deps.log?.(`[automation] ${run.automation_id} parked: ${run.action_tier} needs review opt-in`)
      this.inFlight.delete(run.automation_id)
      this.attempts.delete(run.run_id)
      this.notifyChanged()
      return
    }

    // Depth of the event being handled is the parent depth for anything this
    // executor writes: user action 0 -> A's writes 1 -> B's writes 2.
    let parentDepth = 0
    try { parentDepth = JSON.parse(run.caused_by_json || '{}').depth ?? 0 } catch {}

    let result: { ok: boolean; detail?: string; needsReview?: string }
    try {
      // THE LOOP GUARD'S ENTRY POINT. Only the executor call is wrapped — never
      // the dispatch loop — so a write performed synchronously inside the
      // executor observes the store and gets its envelope stamped.
      result = await runContext.run(
        { automationId: run.automation_id, runId: run.run_id, depth: parentDepth + 1 },
        () => executor(resolved, {
          automationId: run.automation_id, runId: run.run_id, eventId: run.event_id,
          eventType: run.event_type, payload, db,
        }),
      )
    } catch (err: any) {
      result = { ok: false, detail: err?.message ?? 'executor threw' }
    }

    const now = Date.now()
    if (result.ok) {
      db.prepare("UPDATE automation_runs SET status = 'succeeded', result_json = ?, finished_at = ? WHERE id = ?")
        .run(JSON.stringify({ detail: result.detail ?? null }), now, run.run_id)
      // `once` is exhausted after its first success.
      if (run.lifecycle === 'once') {
        db.prepare("UPDATE automations SET status = 'exhausted' WHERE id = ?").run(run.automation_id)
      }
      this.attempts.delete(run.run_id)
    } else {
      // benign → bounded auto-retry. confirm/external never auto-retry:
      // re-running a mutating or outbound action without a human is exactly
      // the risk RESULT.md §8 is written to prevent.
      const retryable = run.action_tier === 'benign' && attempt < 3
      if (retryable) {
        db.prepare("UPDATE automation_runs SET status = 'pending', error = ? WHERE id = ?")
          .run(result.detail ?? 'failed', run.run_id)
      } else {
        db.prepare("UPDATE automation_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?")
          .run(result.detail ?? 'failed', now, run.run_id)
      }
    }
    this.inFlight.delete(run.automation_id)
    this.notifyChanged()
  }

  private notifyChanged(): void {
    this.deps.notifyChanged?.()
    this.bus?.replayUndispatched?.bind?.(null)   // no-op guard; kept for clarity
  }
}

/** Build the runner with its bus wired both ways (RESULT.md §11 P0). */
export function createAutomationRunner(
  db: any,
  executors: Record<string, Executor>,
  opts: { log?: (m: string) => void; warn?: (m: string) => void; notifyChanged?: () => void } = {},
): { runner: AutomationRunner; bus: AutomationBus } {
  const runner = new AutomationRunner({ db, executors, ...opts })
  const bus = new AutomationBus({
    db,
    wake: () => runner.start(),
    onError: (m, e) => opts.warn?.(`${m}${e ? ': ' + String(e) : ''}`),
  })
  runner.attachBus(bus)
  return { runner, bus }
}

/** Convenience for the IPC surface: does this action id have an executor? */
export function runnerExecutors(): Record<string, Executor> {
  return buildExecutors()
}
