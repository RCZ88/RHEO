import type { AutomationDef, ConditionConfig, ConditionOperator, TriggerConfig } from '../../../types/automation'
import { EVENT_SOURCES } from './triggerRegistry'
import { ACTION_DEFS } from './actionRegistry'

const OP_MAP: Record<string, ConditionOperator> = {
  '=': 'eq', '==': 'eq', equals: 'eq', equal: 'eq', 'is': 'eq',
  '!=': 'neq', 'not equal': 'neq', 'not equals': 'neq',
  '>': 'gt', 'greater than': 'gt', 'more than': 'gt', 'exceeds': 'gt',
  '>=': 'gte', 'at least': 'gte', '>= ': 'gte',
  '<': 'lt', 'less than': 'lt', 'under': 'lt', 'below': 'lt',
  '<=': 'lte', 'at most': 'lte', 'no more than': 'lte',
}

const WORD_TO_TOKEN: Record<string, ConditionOperator> = {
  equals: 'eq', equal: 'eq', 'is': 'eq',
  greater: 'gt', 'more': 'gt', exceeds: 'gt',
  'at least': 'gte',
  less: 'lt', under: 'lt', below: 'lt',
  'at most': 'lte',
}

const ACTION_KEYWORDS: { name: string; keywords: string[] }[] = [
  { name: 'notify', keywords: ['notify', 'alert', 'remind', 'tell me', 'message me', 'send a notification'] },
  { name: 'log', keywords: ['log', 'record', 'write down'] },
  { name: 'http', keywords: ['http', 'webhook', 'post to', 'request to'] },
  { name: 'query', keywords: ['query', 'look up', 'fetch'] },
  { name: 'exec', keywords: ['run command', 'execute', 'shell'] },
  { name: 'sleep', keywords: ['wait', 'sleep', 'delay'] },
]

function findSourceAndEvent(text: string): { source?: string; event?: string } {
  for (const src of EVENT_SOURCES) {
    if (text.toLowerCase().includes(src.label.toLowerCase()) || text.toLowerCase().includes(src.id)) {
      for (const evt of src.events) {
        const parts = evt.label.toLowerCase().split(' ')
        const hit = parts.length >= 2 && parts.every(p => text.toLowerCase().includes(p))
        if (hit) return { source: src.id, event: evt.id }
      }
      return { source: src.id, event: src.events[0]?.id }
    }
  }
  return {}
}

function parseSchedule(text: string): { interval?: number; unit?: string } {
  const m = text.match(/every\s+(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks)/i)
  if (m) {
    const unit = m[2].toLowerCase()
    const u = unit.endsWith('s') ? unit : `${unit}s`
    return { interval: parseInt(m[1]), unit: u }
  }
  if (/hourly|every hour/i.test(text)) return { interval: 1, unit: 'hours' }
  if (/daily|every day/i.test(text)) return { interval: 1, unit: 'days' }
  if (/weekly|every week/i.test(text)) return { interval: 1, unit: 'weeks' }
  if (/minute/i.test(text)) return { interval: 1, unit: 'minutes' }
  return { interval: 5, unit: 'minutes' }
}

function parseConditions(text: string): ConditionConfig[] {
  const out: ConditionConfig[] = []
  const clauses = text.split(/\b(?:and|then|also)\b/i).filter(Boolean)
  for (const clause of clauses) {
    const opMatch = clause.match(/(?:==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?|'[^']*'|"[^"]*")/g)
    if (!opMatch) {
      const wordOp = clause.match(/\b(is|equals?|greater than|more than|less than|at least|at most|exceeds?)\b/i)
      const numVal = clause.match(/(?:is|equals?|greater than|more than|less than|at least|at most|exceeds?)\s+(-?\d+(?:\.\d+)?)/i)
      if (wordOp && numVal) {
        const op = (WORD_TO_TOKEN[wordOp[1].toLowerCase()] || 'eq')
        const field = clause.replace(/\b(?:if|when|that|where|its?|the)\b/gi, '').match(/[a-z_]+/i)?.[0] || 'amount'
        out.push({ id: crypto.randomUUID(), field, operator: op, value: numVal[1], valueType: 'number', join: 'and' })
      }
      continue
    }
    for (const m of opMatch) {
      const rawOp = m.match(/==|!=|>=|<=|>|</)![0]
      const op = OP_MAP[rawOp] || 'eq'
      const valRaw = m.slice(rawOp.length).trim()
      const isQuoted = /^['"]/.test(valRaw)
      const value = isQuoted ? valRaw.replace(/['"]/g, '') : valRaw
      const field = clause.replace(m, '').replace(/\b(?:if|when|that|where|its?|the)\b/gi, '').match(/[a-z_]+/i)?.[0] || 'amount'
      out.push({
        id: crypto.randomUUID(), field, operator: op, value,
        valueType: isQuoted ? 'string' : 'number', join: 'and',
      })
    }
  }
  return out
}

function parseActions(text: string): { name: string; message?: string }[] {
  const actions: { name: string; message?: string }[] = []
  const clauses = text.split(/\b(?:and then|then|and)\b/i).filter(Boolean)
  for (const clause of clauses) {
    for (const a of ACTION_KEYWORDS) {
      if (a.keywords.some(k => clause.toLowerCase().includes(k))) {
        const msg = clause.replace(/\b(?:notify|alert|remind|tell me|message me|send a notification|log|record|write down|http|webhook|post to|request to)\b/gi, '').trim()
        actions.push({ name: a.name, message: msg || undefined })
        break
      }
    }
  }
  if (actions.length === 0) actions.push({ name: 'notify', message: text.trim() || 'Automation fired' })
  return actions
}

export function parseNaturalLanguage(input: string): AutomationDef {
  const text = input.trim()
  const isSchedule = /^(every|hourly|daily|weekly|monthly)\b/i.test(text) || /every\s+\d+\s+(minute|hour|day|week)/i.test(text)
  let trigger: TriggerConfig
  if (isSchedule) {
    const s = parseSchedule(text)
    trigger = { kind: 'schedule', interval: s.interval, intervalUnit: s.unit }
  } else {
    const src = findSourceAndEvent(text)
    trigger = { kind: 'event', source: src.source || 'system', event: src.event || 'app.launched' }
  }

  const conditions = trigger.kind === 'event' ? parseConditions(text) : []
  const actions = parseActions(text)

  return {
    name: '',
    category: 'general',
    lifecycle: 'manual',
    priority: 500,
    enabled: true,
    trigger,
    conditions,
    actions: actions.map(a => ({
      id: crypto.randomUUID(),
      name: a.name,
      params: [
        ...(a.message ? [{ key: 'message', value: a.message, valueType: 'string' as const }] : []),
        ...(ACTION_DEFS.find(d => d.id === a.name)?.params
          .filter(p => !p.key.startsWith('message'))
          .map(p => ({ key: p.key, value: '', valueType: (p.type === 'number' ? 'number' : p.type === 'boolean' ? 'boolean' : 'string') as const })) || []),
      ],
    })),
  }
}
