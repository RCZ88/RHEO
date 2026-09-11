import type { AutomationConfig, NlAutomationResult, ConditionRow, ConditionOperator } from '../../../types/automation'
import type { DataSourceName } from '../../../domains/compositions/compositionTypes'

const SOURCES: DataSourceName[] = ['finance', 'focus', 'goals', 'learning', 'ide', 'system']
const OPERATORS: ConditionOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'matches', 'exists', 'not_exists']
const LIFECYCLES = ['forever', 'once', 'schedule', 'manual'] as const

/**
 * Parses an AI-emitted fenced ```automation block (JSON) into an
 * NlAutomationResult. Returns null when the text contains no automation block
 * or the block cannot be parsed/validated.
 */
export function parseNlAutomation(text: string): NlAutomationResult | null {
  const match = text.match(/```automation\n([\s\S]*?)\n```/)
  if (!match) return null

  try {
    const raw = JSON.parse(match[1])
    if (!raw || raw.intent !== 'create-automation') return null

    const config: AutomationConfig = {
      name: String(raw.name ?? 'New Automation').trim() || 'New Automation',
      description: String(raw.description ?? raw.narration ?? ''),
      trigger: {
        source: normalizeSource(raw.trigger?.source),
        event: String(raw.trigger?.event ?? 'trigger'),
        fields: Array.isArray(raw.trigger?.fields) ? raw.trigger.fields : [],
      },
      conditions: mapConditions(raw.conditions),
      conditionLogic: raw.conditionLogic === 'or' ? 'or' : 'and',
      action: {
        name: String(raw.action?.name ?? 'notify'),
        params: [],
      },
      actionParams: raw.actionParams && typeof raw.actionParams === 'object' ? raw.actionParams : {},
      lifecycle: LIFECYCLES.includes(raw.lifecycle) ? raw.lifecycle : 'forever',
      priority: typeof raw.priority === 'number' ? raw.priority : 500,
      category: raw.category ?? 'general',
      enabled: true,
    }

    return {
      intent: 'create-automation',
      config,
      narration: String(raw.narration ?? `I've created the automation "${config.name}".`),
    }
  } catch {
    return null
  }
}

/** Removes any fenced ```automation blocks from the AI response text. */
export function stripAutomationBlock(text: string): string {
  return text.replace(/```automation\n[\s\S]*?\n```/g, '').trim()
}

function mapConditions(raw: unknown): ConditionRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c: unknown): c is Record<string, unknown> =>
      c != null && typeof c === 'object' && typeof (c as Record<string, unknown>).field === 'string')
    .map((c: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      field: String(c.field),
      operator: OPERATORS.includes(c.operator as ConditionOperator) ? (c.operator as ConditionOperator) : 'eq',
      value: normalizeValue(c.value),
    }))
}

function normalizeValue(v: unknown): string | number | boolean {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  return String(v)
}

function normalizeSource(s: unknown): DataSourceName {
  return SOURCES.includes(s as DataSourceName) ? (s as DataSourceName) : 'system'
}