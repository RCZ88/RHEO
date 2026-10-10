// ─── AUTOMATION CATALOGUE — the single source of truth (RESULT.md §2) ───
//
// NO React imports. Both the renderer registries and the main-process runner
// import this, so a preview and a real run evaluate the SAME predicate code.
// That is the whole point: a second query language is never created.
//
// WHY THIS FILE EXISTS (RESULT.md §2, §3.4)
// The builder already speaks a predicate language — `ConditionRow[]` plus the
// ten operators, emitted by `generateDsl` and already validated by the
// lex→parse→scope validator. `ConditionRow[]` + the operators + a validator ARE
// the DSL. So the matcher is ~60 lines, not 44 typed handlers. 44 handlers
// would be 44 specialised copies of those 60 lines, touched on every catalogue
// change — the second-copy evil.
//
// The 16 triggers and 8 actions below are transcribed from the renderer's
// canonical `automations/data/triggerRegistry.ts` and `actionRegistry.ts`, not
// invented. `emissionStatus` is the load-bearing field RESULT.md §2 asks for:
// the builder must not offer a trigger nothing emits.

export const CATALOGUE_VERSION = 1

export type EmissionStatus = 'planned' | 'landed' | 'live'
export type TriggerKind = 'edge' | 'level'
export type MissPolicy = 'replay' | 'scan' | 'drop'
export type FieldType = 'string' | 'number' | 'boolean' | 'date'
export type ActionTier = 'benign' | 'confirm' | 'external'
export type Lane = 'tool' | 'mission'

// ─── The event envelope (RESULT.md §3) ────────────────────────────────
// occurredAt vs emittedAt is the Q3 backbone: a replayed event carries the
// ORIGINAL row timestamp as occurredAt, so "what happened when" survives
// catch-up. emittedAt is when the bus saw it.

export interface DomainEventEnvelope {
  /** 'evt_...' — the dedupe key. UNIQUE against automation_runs. */
  id: string
  type: string
  /** when the fact happened */
  occurredAt: number
  /** when the bus saw it (≠ occurredAt for replay/derived) */
  emittedAt: number
  source: 'app' | 'detector' | 'replay' | 'tracker'
  payload: Record<string, string | number | boolean | null>
  entity?: { kind: string; id: string }
  /**
   * LOOP GUARD (RESULT.md round-06 §4 Patch 1). Set ONLY when the bus is reached
   * from inside an executor. A user action emits depth 0; automation A's writes
   * stamp depth 1; automation B may fire on depth 1 and stamps depth 2; nothing
   * fires on depth 2. Longest representable chain: two automations.
   * Replay-synthesised events carry none, so they are depth 0 and behave normally.
   */
  causedBy?: { automationId: string; runId: string; depth: number }
}

export interface TriggerFieldDef {
  name: string
  type: FieldType
  label: string
}

export interface TriggerDef {
  id: string
  source: string
  event: string
  label: string
  fields: TriggerFieldDef[]
  /** 'edge' = fires on the fact. 'level' = needs rising-edge state (reserved). */
  kind: TriggerKind
  missPolicy: MissPolicy
  /** 'live' only after a real emit() site exists. RESULT.md §3.3. */
  emissionStatus: EmissionStatus
}

export interface ActionDefLite {
  id: string
  label: string
  /** Lane is DECLARED here, never inferred at save time (RESULT.md round-02 §2). */
  lane: Lane
  tier: ActionTier
  /** true when the executor needs no closure extraction (category ii). */
  native: boolean
  params: Array<{ name: string; type: FieldType; label: string; required: boolean }>
}

const f = (name: string, type: FieldType, label: string): TriggerFieldDef => ({ name, type, label })

// ─── The canonical 16 (RESULT.md §3.3 emission classes) ───────────────
// finance ×3 + goals ×3 are WRITE-HOOKS; focus ×3, ide ×2, learning ×2 are
// DETECTORS; system ×3 are LIFECYCLE. Phase 1 ships the write-hooks plus
// system.app.started.

export const TRIGGERS: TriggerDef[] = [
  { id: 'finance.transaction.created', source: 'finance', event: 'transaction.created',
    label: 'Transaction added', kind: 'edge', missPolicy: 'scan', emissionStatus: 'landed',
    fields: [f('id', 'string', 'Transaction ID'), f('name', 'string', 'Name'), f('amount', 'number', 'Amount'),
             f('type', 'string', 'Type'), f('category', 'string', 'Category'), f('account', 'string', 'Account')] },
  { id: 'finance.transaction.updated', source: 'finance', event: 'transaction.updated',
    label: 'Transaction updated', kind: 'edge', missPolicy: 'scan', emissionStatus: 'planned',
    fields: [f('id', 'string', 'Transaction ID'), f('amount', 'number', 'Amount'), f('status', 'string', 'Status')] },
  { id: 'finance.account.created', source: 'finance', event: 'account.created',
    label: 'Account created', kind: 'edge', missPolicy: 'replay', emissionStatus: 'planned',
    fields: [f('id', 'string', 'Account ID'), f('name', 'string', 'Name'), f('type', 'string', 'Type')] },

  { id: 'goals.goal.created', source: 'goals', event: 'goal.created',
    label: 'Goal created', kind: 'edge', missPolicy: 'replay', emissionStatus: 'landed',
    fields: [f('id', 'string', 'Goal ID'), f('title', 'string', 'Title'), f('priority', 'number', 'Priority')] },
  { id: 'goals.goal.completed', source: 'goals', event: 'goal.completed',
    label: 'Goal completed', kind: 'edge', missPolicy: 'replay', emissionStatus: 'landed',
    fields: [f('id', 'string', 'Goal ID'), f('title', 'string', 'Title'), f('result', 'string', 'Result')] },
  { id: 'goals.goal.deleted', source: 'goals', event: 'goal.deleted',
    label: 'Goal deleted', kind: 'edge', missPolicy: 'drop', emissionStatus: 'landed',
    fields: [f('id', 'string', 'Goal ID'), f('title', 'string', 'Title')] },

  { id: 'focus.session.started', source: 'focus', event: 'session.started',
    label: 'Focus session started', kind: 'edge', missPolicy: 'replay', emissionStatus: 'planned',
    fields: [f('id', 'string', 'Session ID'), f('goalLabel', 'string', 'Goal')] },
  { id: 'focus.session.ended', source: 'focus', event: 'session.ended',
    label: 'Focus session ended', kind: 'edge', missPolicy: 'replay', emissionStatus: 'planned',
    fields: [f('id', 'string', 'Session ID'), f('goalLabel', 'string', 'Goal'),
             f('durationSec', 'number', 'Seconds'), f('outcome', 'string', 'Outcome')] },
  { id: 'focus.session.paused', source: 'focus', event: 'session.paused',
    label: 'Focus session paused', kind: 'edge', missPolicy: 'drop', emissionStatus: 'planned',
    fields: [f('id', 'string', 'Session ID')] },

  { id: 'learning.lesson.completed', source: 'learning', event: 'lesson.completed',
    label: 'Lesson completed', kind: 'edge', missPolicy: 'scan', emissionStatus: 'planned',
    fields: [f('id', 'string', 'Lesson ID'), f('topic', 'string', 'Topic'), f('score', 'number', 'Score')] },
  { id: 'learning.quiz.passed', source: 'learning', event: 'quiz.passed',
    label: 'Quiz passed', kind: 'edge', missPolicy: 'scan', emissionStatus: 'planned',
    fields: [f('id', 'string', 'Quiz ID'), f('score', 'number', 'Score')] },

  { id: 'ide.project.opened', source: 'ide', event: 'project.opened',
    label: 'Project opened', kind: 'edge', missPolicy: 'drop', emissionStatus: 'planned',
    fields: [f('projectId', 'string', 'Project'), f('path', 'string', 'Path')] },
  { id: 'ide.commit.made', source: 'ide', event: 'commit.made',
    label: 'Commit made', kind: 'edge', missPolicy: 'scan', emissionStatus: 'planned',
    fields: [f('projectId', 'string', 'Project'), f('branch', 'string', 'Branch'), f('message', 'string', 'Message')] },

  { id: 'system.app.started', source: 'system', event: 'app.started',
    label: 'App started', kind: 'edge', missPolicy: 'drop', emissionStatus: 'landed',
    fields: [f('version', 'string', 'Version')] },
]

// ─── The 8 actions (RESULT.md Appendix A, as amended in round 04) ─────
// lane and tier are DECLARED, never inferred. RESULT.md round-02 §2.

export const ACTIONS: ActionDefLite[] = [
  { id: 'notify', label: 'Send notification', lane: 'tool', tier: 'benign', native: true,
    params: [ { name: 'title', type: 'string', label: 'Title', required: true },
              { name: 'body',  type: 'string', label: 'Body',  required: false } ] },
  { id: 'log', label: 'Write to activity log', lane: 'tool', tier: 'benign', native: false,
    params: [ { name: 'action', type: 'string', label: 'Action', required: true },
              { name: 'entityType', type: 'string', label: 'Entity type', required: false },
              { name: 'entityId', type: 'string', label: 'Entity ID', required: false } ] },
  { id: 'goal:create', label: 'Create goal', lane: 'tool', tier: 'confirm', native: false,
    params: [ { name: 'title', type: 'string', label: 'Title', required: true },
              { name: 'priority', type: 'number', label: 'Priority', required: false } ] },
  { id: 'goal:complete', label: 'Complete goal', lane: 'tool', tier: 'confirm', native: false,
    params: [ { name: 'title', type: 'string', label: 'Goal title', required: true } ] },
  { id: 'schedule:add', label: 'Add to schedule', lane: 'tool', tier: 'confirm', native: false,
    params: [ { name: 'title', type: 'string', label: 'Title', required: true },
              { name: 'startTime', type: 'string', label: 'Start', required: true } ] },
  { id: 'deadline:add', label: 'Add deadline', lane: 'tool', tier: 'confirm', native: false,
    params: [ { name: 'title', type: 'string', label: 'Title', required: true },
              { name: 'dueDate', type: 'string', label: 'Due', required: true } ] },
  { id: 'calendar:create', label: 'Create calendar event', lane: 'tool', tier: 'confirm', native: false,
    params: [ { name: 'title', type: 'string', label: 'Title', required: true },
              { name: 'startTime', type: 'string', label: 'Start', required: true } ] },
  { id: 'email:send', label: 'Send email', lane: 'tool', tier: 'external', native: false,
    params: [ { name: 'to', type: 'string', label: 'To', required: true },
              { name: 'subject', type: 'string', label: 'Subject', required: true },
              { name: 'body', type: 'string', label: 'Body', required: true } ] },
]

// ─── Deprecation map (RESULT.md §2 / Q5) ──────────────────────────────
// Legacy ids from the OLD singular builder. Recorded honestly: where there IS a
// canonical equivalent we say so; where there is NOT we record it as
// unimplemented rather than mapping it to a lie.

export const DEPRECATED_TRIGGERS: Record<string, { mapsTo?: string; note: string }> = {
  'app.launched':        { mapsTo: 'system.app.started',  note: 'renamed in the new builder' },
  'session.started':     { mapsTo: 'focus.session.started', note: 'source renamed to focus' },
  'session.completed':   { mapsTo: 'focus.session.ended',   note: 'source renamed + event renamed' },
  'goal.created':        { mapsTo: 'goals.goal.created',    note: 'source renamed to goals' },
  'goal.completed':      { mapsTo: 'goals.goal.completed',  note: 'source renamed to goals' },
  'transaction.created': { mapsTo: 'finance.transaction.created', note: 'source renamed to finance' },
  'transaction.updated': { mapsTo: 'finance.transaction.updated', note: 'source renamed to finance' },
  'budget.exceeded':     { note: 'UNIMPLEMENTED — no finance budget emit site exists' },
  'window.changed':      { note: 'UNIMPLEMENTED — no window-change emit site exists' },
  'app.quit':            { note: 'UNIMPLEMENTED — nothing emits on quit' },
  'note.created':        { note: 'UNIMPLEMENTED — mission-lane candidate, no emitter' },
  'note.summarized':     { note: 'UNIMPLEMENTED — mission-lane candidate, no emitter' },
  'project.opened':      { mapsTo: 'ide.project.opened', note: 'source renamed to ide' },
  'build.completed':     { note: 'UNIMPLEMENTED — no build watcher' },
  'subscription.due':    { note: 'UNIMPLEMENTED — no subscription due emitter' },
}

export function getTrigger(id: string): TriggerDef | undefined {
  return TRIGGERS.find(t => t.id === id)
}
export function getAction(id: string): ActionDefLite | undefined {
  return ACTIONS.find(a => a.id === id)
}
/** The builder's offer-set. A trigger with no emitter is NOT selectable. */
export function selectableTriggers(): TriggerDef[] {
  return TRIGGERS.filter(t => t.emissionStatus === 'landed' || t.emissionStatus === 'live')
}
export function isValidAutomation(triggerId: string, actionId: string): { ok: boolean; reason?: string } {
  const t = getTrigger(triggerId)
  if (!t) return { ok: false, reason: `unknown trigger ${triggerId}` }
  if (t.emissionStatus === 'planned') return { ok: false, reason: `trigger ${triggerId} has no emitter yet` }
  const a = getAction(actionId)
  if (!a) return { ok: false, reason: `unknown action ${actionId}` }
  return { ok: true }
}

// ─── THE MATCHER (RESULT.md §3.4) ─────────────────────────────────────
// Pure. Same function serves BuilderPreview and the real runner, so what the
// user previews is what fires. ~60 lines by design — see the file header.

export type ConditionOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'matches' | 'exists' | 'not_exists'

export interface ConditionRow {
  id: string
  field: string
  operator: ConditionOperator
  value: string | number | boolean
}

function coerce(raw: unknown, type: FieldType): string | number | boolean | null {
  if (raw === null || raw === undefined) return null
  switch (type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw
      if (raw === 'true' || raw === '1') return true
      if (raw === 'false' || raw === '0') return false
      return null
    case 'date':
    case 'string':
      return typeof raw === 'string' ? raw : String(raw)
  }
}

/** Numeric compare that tolerates a date-ish string on either side. */
function toComparable(v: string | number | boolean | null, type: FieldType): number | null {
  if (v === null) return null
  if (typeof v === 'number') return v
  if (type === 'date') {
    const t = Date.parse(v as string)
    return Number.isFinite(t) ? t : null
  }
  const n = Number(v)
  return Number.isFinite(n) && v !== '' ? n : null
}

function evalOne(
  row: ConditionRow,
  payload: Record<string, string | number | boolean | null>,
  types: Record<string, FieldType>,
): boolean {
  const type = types[row.field] ?? 'string'
  const present = Object.prototype.hasOwnProperty.call(payload, row.field)
  const actual = coerce(payload[row.field], type)

  switch (row.operator) {
    case 'exists':    return present && actual !== null
    case 'not_exists': return !present || actual === null
    case 'eq':        return String(actual) === String(row.value)
    case 'neq':       return String(actual) !== String(row.value)
    case 'contains':  return typeof actual === 'string' && actual.toLowerCase().includes(String(row.value).toLowerCase())
    case 'matches': {
      if (typeof actual !== 'string') return false
      try { return new RegExp(String(row.value)).test(actual) }
      catch { return false }   // a bad regex must not throw into the bus
    }
    default: {
      const a = toComparable(actual, type)
      const b = toComparable(coerce(row.value, type), type)
      if (a === null || b === null) return false
      switch (row.operator) {
        case 'gt':  return a > b
        case 'gte': return a >= b
        case 'lt':  return a < b
        case 'lte': return a <= b
        default:    return false
      }
    }
  }
}

/**
 * Evaluate one automation's conditions against an envelope's payload.
 * Empty conditions = match (that is a plain trigger, not a broken one).
 */
export function matches(
  trigger: TriggerDef,
  payload: DomainEventEnvelope['payload'],
  conditions: ConditionRow[],
  logic: 'and' | 'or' = 'and',
): boolean {
  if (!conditions || conditions.length === 0) return true
  const types: Record<string, FieldType> = {}
  for (const fl of trigger.fields) types[fl.name] = fl.type
  const results = conditions.map(c => evalOne(c, payload, types))
  return logic === 'or' ? results.some(Boolean) : results.every(Boolean)
}

/**
 * Substitute event fields into frozen action params. Event-field substitution
 * is NOT judgement — it is why `goal:create` with title `{title}` stays in the
 * tool lane (RESULT.md round-02 §2).
 */
export function resolveParams(
  params: Record<string, string | number | boolean>,
  payload: DomainEventEnvelope['payload'],
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) {
    if (typeof v !== 'string') { out[k] = v; continue }
    const whole = v.match(/^\{(\w+)\}$/)
    if (whole && Object.prototype.hasOwnProperty.call(payload, whole[1])) {
      out[k] = payload[whole[1]] as string | number | boolean
    } else {
      out[k] = v.replace(/\{(\w+)\}/g, (m, name: string) =>
        Object.prototype.hasOwnProperty.call(payload, name) ? String(payload[name]) : m)
    }
  }
  return out
}

/** Newest-first ordering for the offer-set; deterministic for tests. */
export function capabilities() {
  return {
    catalogueVersion: CATALOGUE_VERSION,
    triggers: selectableTriggers(),
    actions: ACTIONS,
    deprecated: DEPRECATED_TRIGGERS,
  }
}
