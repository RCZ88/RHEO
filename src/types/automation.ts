import type { DataSourceName } from '../domains/compositions/compositionTypes'

// ─── Visual Builder State ──────────────────────────────────

export interface AutomationConfig {
  name: string
  description: string
  trigger: TriggerSelection
  conditions: ConditionRow[]
  conditionLogic: 'and' | 'or'
  action: ActionSelection
  actionParams: Record<string, string | number | boolean>
  lifecycle: 'forever' | 'once' | 'schedule' | 'manual'
  priority: number        // 1-1000, default 500
  category: string
  enabled: boolean
}

export interface TriggerSelection {
  source: DataSourceName
  event: string           // e.g. "transaction.created"
  // derived from registry:
  fields: TriggerField[]
}

export interface TriggerField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  label: string
}

export interface ConditionRow {
  id: string
  field: string
  operator: ConditionOperator
  value: string | number | boolean
}

export type ConditionOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'matches' | 'exists' | 'not_exists'

export interface ActionSelection {
  name: string            // e.g. "notify", "goal:create"
  params: ActionParam[]
}

export interface ActionParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'select'
  label: string
  required: boolean
  options?: string[]      // for select type
  placeholder?: string
}

// ─── Automation Card Data (stored in canvas) ───────────────

export interface AutomationCardData {
  id: string
  ruleId: string
  name: string
  triggerSource: DataSourceName
  triggerEvent: string
  triggerLabel: string     // human-readable: "New Email Received"
  actionName: string
  actionLabel: string      // human-readable: "Send Notification"
  summary: string          // "When transaction over $100 → Send notification"
  enabled: boolean
  lifecycle: string
  priority: number
  lastFired: string | null
  lastStatus: string | null
}

// ─── AI NL Parsing Result ──────────────────────────────────

export interface NlAutomationResult {
  intent: 'create-automation'
  config: AutomationConfig
  narration: string
}

// ─── Legacy types (older singular automation/ builder) ─────
// Kept for back-compat so `src/components/ai/automation/*` still compiles.

/** Back-compat alias (old operatorMap.ts imports this name). */
export type AutomationOperator = ConditionOperator

export type TriggerKind = 'event' | 'schedule'
export type ValueType = 'string' | 'number' | 'boolean'
export type ConditionJoin = 'and' | 'or'

export interface TriggerConfig {
  kind: TriggerKind
  source?: string
  event?: string
  interval?: number
  intervalUnit?: string
  timezone?: string
}

export interface ConditionConfig {
  id: string
  field: string
  operator: ConditionOperator
  value: string
  valueType: ValueType
  join: ConditionJoin
}

/** Legacy param shape used by the older singular automation builder (VisualBuilderModal). */
export interface ActionParamLegacy {
  key: string
  value: string
  valueType: ValueType
}

export interface ActionConfig {
  id: string
  name: string
  params: ActionParamLegacy[]
}

export interface AutomationDef {
  name: string
  category: string
  lifecycle: string
  priority: number
  enabled: boolean
  trigger: TriggerConfig
  conditions: ConditionConfig[]
  actions: ActionConfig[]
}

export function emptyAutomationDef(): AutomationDef {
  return {
    name: '',
    category: 'general',
    lifecycle: 'manual',
    priority: 500,
    enabled: true,
    trigger: { kind: 'event', source: 'finance', event: 'transaction.created' },
    conditions: [],
    actions: [{ id: crypto.randomUUID(), name: 'notify', params: [{ key: 'message', value: '', valueType: 'string' }] }],
  }
}