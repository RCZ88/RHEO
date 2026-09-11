import type { AutomationDef, ConditionConfig, ConditionOperator, ValueType } from '../../../types/automation'

export const OPERATOR_TOKENS: Record<ConditionOperator, string> = {
  eq: '==', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
}

function quoteValue(value: string, type: ValueType): string {
  if (type === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? String(n) : `'${value}'`
  }
  if (type === 'boolean') return value === 'true' ? 'true' : 'false'
  return `'${value}'`
}

function emitConditions(conditions: ConditionConfig[]): string {
  if (conditions.length === 0) return ''
  return conditions.map(c => `${c.field} ${OPERATOR_TOKENS[c.operator]} ${quoteValue(c.value, c.valueType)}`).join(' and ')
}

function emitActions(def: AutomationDef): string {
  return def.actions
    .filter(a => a.name)
    .map(a => {
      const params = a.params
        .filter(p => p.key && p.value !== '')
        .map(p => `${p.key}=${quoteValue(p.value, p.valueType)}`)
        .join(', ')
      return params ? `${a.name}:${params}` : a.name
    })
    .join(' |> ')
}

/**
 * Emit DSL in the canonical grammar:
 *   event:    on <source>.<event> [if <conditions>] do <actions>
 *   schedule: every <interval> <unit> do <actions>
 * Conditions always precede `do`. Schedule triggers carry no conditions.
 */
export function toDsl(def: AutomationDef): string {
  const actions = emitActions(def)
  if (def.trigger.kind === 'schedule') {
    const i = def.trigger.interval || 5
    const u = def.trigger.intervalUnit || 'minutes'
    return `every ${i} ${u} do ${actions}`
  }
  const src = def.trigger.source || 'system'
  const evt = def.trigger.event || 'app.launched'
  const conds = emitConditions(def.conditions)
  return conds ? `on ${src}.${evt} if ${conds} do ${actions}` : `on ${src}.${evt} do ${actions}`
}
