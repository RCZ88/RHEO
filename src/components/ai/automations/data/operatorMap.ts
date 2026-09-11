import type { ConditionOperator } from '../../../types/automation'

export interface OperatorDef {
  value: ConditionOperator
  label: string
  symbol: string
  /** Lexical token emitted into the composition DSL (engine grammar). */
  dsl: string
  compatibleTypes: ('string' | 'number' | 'boolean' | 'date')[]
}

export const OPERATORS: OperatorDef[] = [
  { value: 'eq',         label: 'Equals',           symbol: '=',    dsl: '=',        compatibleTypes: ['string', 'number', 'boolean', 'date'] },
  { value: 'neq',        label: 'Not Equals',       symbol: '≠',   dsl: '!=',       compatibleTypes: ['string', 'number', 'boolean', 'date'] },
  { value: 'gt',         label: 'Greater Than',     symbol: '>',   dsl: '>',        compatibleTypes: ['number', 'date'] },
  { value: 'gte',        label: 'Greater or Equal', symbol: '≥',   dsl: '>=',       compatibleTypes: ['number', 'date'] },
  { value: 'lt',         label: 'Less Than',        symbol: '<',   dsl: '<',        compatibleTypes: ['number', 'date'] },
  { value: 'lte',        label: 'Less or Equal',    symbol: '≤',   dsl: '<=',       compatibleTypes: ['number', 'date'] },
  { value: 'contains',   label: 'Contains',         symbol: '⊃',   dsl: 'contains', compatibleTypes: ['string'] },
  { value: 'matches',    label: 'Matches Pattern',  symbol: '~',   dsl: 'matches',  compatibleTypes: ['string'] },
  { value: 'exists',     label: 'Exists',           symbol: '∃',   dsl: 'exists',   compatibleTypes: ['string', 'number', 'boolean', 'date'] },
  { value: 'not_exists', label: 'Does Not Exist',   symbol: '∄',   dsl: 'not_exists', compatibleTypes: ['string', 'number', 'boolean', 'date'] },
]

export function getOperatorsForType(fieldType: string): OperatorDef[] {
  return OPERATORS.filter(op => op.compatibleTypes.includes(fieldType as OperatorDef['compatibleTypes'][number]))
}

export function getOperatorDslToken(operator: ConditionOperator): string {
  return OPERATORS.find(op => op.value === operator)?.dsl ?? '='
}