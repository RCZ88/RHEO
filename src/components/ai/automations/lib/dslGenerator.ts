import type { AutomationConfig, ConditionRow } from '../../../types/automation'
import { getTriggerById } from '../data/triggerRegistry'
import { getActionById } from '../data/actionRegistry'
import { getOperatorDslToken } from '../data/operatorMap'

/**
 * Converts the visual builder config into a DSL string
 * that the existing CompositionEngine can parse.
 *
 * DSL format (engine grammar — compositionLexer/parser):
 *   on <source>.<event> [if <field> <op> <value> [and|or <field> <op> <value>]] do <action>[:<key> = <value>, ...]
 *
 * Examples:
 *   on finance.transaction.created if amount > 100 do notify:message = 'Large transaction', level = 'info'
 *   on goals.goal.completed if category = 'work' do log:level = 'info', message = 'Goal completed'
 *
 * Operators are emitted as native tokens: =, !=, >, >=, <, <=
 * plus the word operators contains / matches / exists / not_exists
 * (which the lexer now tokenizes and the parser maps to engine ops).
 */
export function generateDsl(config: AutomationConfig): string {
  const { trigger, conditions, conditionLogic, action, actionParams } = config

  // Trigger clause
  const triggerClause = `on ${trigger.source}.${trigger.event}`

  // Conditions clause (optional)
  let conditionClause = ''
  const validConditions = conditions.filter(c => c.field && c.operator && c.value !== undefined && c.value !== '')
  if (validConditions.length > 0) {
    const parts = validConditions.map(c => formatCondition(c))
    const joiner = conditionLogic === 'and' ? ' and ' : ' or '
    conditionClause = ` if ${parts.join(joiner)}`
  }

  // Action clause
  const actionClause = formatAction(action.name, actionParams)

  return `${triggerClause}${conditionClause} do ${actionClause}`
}

function formatCondition(row: ConditionRow): string {
  const { field, operator, value } = row
  const token = getOperatorDslToken(operator)

  // Unary operators take no value
  if (operator === 'exists' || operator === 'not_exists') {
    return `${field} ${token}`
  }

  const formattedValue = formatValue(value)
  return `${field} ${token} ${formattedValue}`
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  // Strings get single-quoted; escape internal single quotes
  const escaped = value.replace(/'/g, "\\'")
  return `'${escaped}'`
}

function formatAction(actionName: string, params: Record<string, string | number | boolean>): string {
  const paramParts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([key, value]) => `${key} = ${formatValue(value)}`)

  if (paramParts.length === 0) return actionName
  return `${actionName}:${paramParts.join(', ')}`
}

/**
 * Generates a human-readable summary of the automation.
 * Used in the automation card body.
 */
export function generateSummary(config: AutomationConfig): string {
  const triggerLabel = getTriggerById(`${config.trigger.source}.${config.trigger.event}`)?.label
    ?? `${config.trigger.source}.${config.trigger.event}`

  const conditionParts = config.conditions
    .filter(c => c.field && c.operator)
    .map(c => `${c.field} ${c.operator} ${c.value}`)

  let conditionText = ''
  if (conditionParts.length > 0) {
    const joiner = config.conditionLogic === 'and' ? ' AND ' : ' OR '
    conditionText = `, if ${conditionParts.join(joiner)}`
  }

  const actionLabel = getActionById(config.action.name)?.label ?? config.action.name
  return `When ${triggerLabel}${conditionText} → ${actionLabel}`
}