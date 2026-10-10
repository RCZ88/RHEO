// ─── EXECUTORS (RESULT.md §10 — the extraction policy) ──────────────
//
// > One behavior, one function. Every executor is either (i) a named function
// > the corresponding IPC handler also calls, or (ii) a native main-process
// > capability with no IPC counterpart. Category (iii) — logic re-implemented
// > from a closure — is forbidden; a future action needing it extracts that
// > closure first.
//
// P0 ships THREE executors (RESULT.md §11, round 07):
//   • `notify`       — (ii) native, Electron Notification, nothing to extract.
//   • `goal:create`  — (i-b) extract, wraps the exported `saveGoalEntry` so the
//                      write is the SAME function the `save-goal` IPC uses.
//   • `goal:complete`— (i-b) extract, resolves by title then calls saveGoalEntry
//                      with status 'done'. No raw-row clobber (round 08 §5).

import { getAction } from '../../shared/automationCatalogue'

export interface ExecutorContext {
  automationId: string
  runId: string
  eventId: string
  eventType: string
  payload: Record<string, string | number | boolean | null>
  db: any
}

export interface ExecutorResult {
  ok: boolean
  detail?: string
  /** When set, the run parks in `awaiting-review` instead of failing. */
  needsReview?: string
}

export type Executor = (
  params: Record<string, string | number | boolean>,
  ctx: ExecutorContext,
) => Promise<ExecutorResult> | ExecutorResult

/** Category (ii): native main-process capability, no IPC counterpart. */
const notifyExecutor: Executor = async (params, ctx) => {
  const title = String(params.title ?? 'Automation')
  const body = String(params.body ?? `${ctx.eventType}`)
  try {
    const { Notification } = require('electron')
    if (!Notification.isSupported?.()) {
      // No notifier on this box (headless Linux). NOT a failure — the run
      // succeeded, there was simply nobody to tell. Failing here would make
      // every notify automation look broken on headless systems.
      return { ok: true, detail: 'notifications unsupported on this host' }
    }
    new Notification({ title, body }).show()
    return { ok: true }
  } catch (err: any) {
    return { ok: false, detail: err?.message ?? 'notify failed' }
  }
}

// The two goal executors delegate to the SAME exported behavior the `save-goal`
// IPC handler calls (goal-handlers.ts `saveGoalEntry`). Injected by main.ts so
// this module stays free of a goal-handlers import cycle.
type SaveGoalEntry = (db: any, date: string, goal: any) => { success: boolean; id?: string; error?: string }
let saveGoalEntry: SaveGoalEntry | null = null
/** Wired once at boot by main.ts. */
export function bindGoalBehavior(fn: SaveGoalEntry): void { saveGoalEntry = fn }

/** Today's local date, matching the app's own `getLocalDateStr` semantics. */
function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * (i-b) `goal:create` — the direct wrapper. Requires a title; delegates to the
 * same saveGoalEntry the UI path uses, so an automation-created goal and a
 * UI-created goal are literally the same write.
 */
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

/**
 * (i-b) `goal:complete` — title ladder per round 08 §5:
 *   (1) 0 rows → fail `no goal titled "X"`;  ≥2 → fail `ambiguous: N`.
 *   (2) already done → succeed as a no-op, emitting nothing.
 *   (3) fetch goal-SHAPED (payload keys the save path reads), NOT a raw row.
 *   (4) saveGoalEntry(status:'done'); (5) {success:false} → run failure.
 */
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

/**
 * The injected executor table. Built by main.ts (delivery by construction —
 * no exports, no import cycles). Anything not in here has NO executor, and the
 * catalogue gate makes such an automation unsaveable rather than silently inert.
 */
export function buildExecutors(): Record<string, Executor> {
  return {
    'notify': notifyExecutor,
    'goal:create': goalCreateExecutor,
    'goal:complete': goalCompleteExecutor,
  }
}

/**
 * Which executors depend on the `saveGoalEntry` behavior slot. An executor in
 * this set is not live until `bindGoalBehavior` has run (F1). `notify` is
 * absent — it is self-contained, so it stays live with no bind.
 */
const EXECUTOR_NEEDS_BIND: Partial<Record<Executor, true>> = (() => {
  const t = buildExecutors()
  return {
    [t['goal:create']]: true,
    [t['goal:complete']]: true,
  }
})()

/** Which action ids can actually run right now. Feeds `automation:capabilities`.
 *
 *  F1 (round 10): an executor whose behavior slot is UNBOUND is NOT live.
 *  Reporting table membership instead would be a save-time lie on the exact
 *  channel that exists to prevent save-time lies: a boot where bindGoalBehavior
 *  threw would still offer goal:create, and the user's first evidence would be a
 *  failed run. We count BINDINGS, not keys. */
export function liveExecutors(): string[] {
  return Object.entries(buildExecutors())
    .filter(([, ex]) => !EXECUTOR_NEEDS_BIND[ex] || saveGoalEntry !== null)
    .map(([id]) => id)
}

/** Does this action have a registered executor? The other half of the gate.
 *  Unbound goal executors report false, so an automation cannot be saved onto an
 *  executor that would fail on first fire. */
export function hasExecutor(actionId: string): boolean {
  if (!getAction(actionId)) return false
  const ex = buildExecutors()[actionId]
  if (!ex) return false
  return !EXECUTOR_NEEDS_BIND[ex] || saveGoalEntry !== null
}
