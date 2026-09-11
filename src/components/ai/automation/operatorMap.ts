/**
 * Operator map — the comparison operators the lexer/parser understand, mapped
 * to their DSL token. Kept as a registry so the builder, dslGenerator and
 * nlParser all agree.
 */

import type { AutomationOperator } from '../../../types/automation'

export interface OperatorDef {
  id: AutomationOperator
  label: string
  token: string
}

export const OPERATOR_MAP: OperatorDef[] = [
  { id: 'eq', label: 'equals', token: '==' },
  { id: 'neq', label: 'not equal', token: '!=' },
  { id: 'gt', label: 'greater than', token: '>' },
  { id: 'gte', label: 'at least', token: '>=' },
  { id: 'lt', label: 'less than', token: '<' },
  { id: 'lte', label: 'at most', token: '<=' },
]

export function operatorToken(op: AutomationOperator): string {
  return OPERATOR_MAP.find((o) => o.id === op)?.token || '=='
}

export function operatorFromToken(token: string): AutomationOperator | undefined {
  return OPERATOR_MAP.find((o) => o.token === token)?.id
}

/** Field label hints for common condition fields (used by the builder + nlParser). */
export const FIELD_LABELS: Record<string, string> = {
  amount: 'Amount',
  category: 'Category',
  duration: 'Duration',
  name: 'Name',
  status: 'Status',
  count: 'Count',
}
