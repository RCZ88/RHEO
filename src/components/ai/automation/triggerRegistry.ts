import type { TriggerKind } from '../../../types/automation'

export interface EventOption {
  id: string
  label: string
  hint: string
}

export interface SourceOption {
  id: string
  label: string
  events: EventOption[]
}

export const EVENT_SOURCES: SourceOption[] = [
  {
    id: 'finance', label: 'Finance',
    events: [
      { id: 'transaction.created', label: 'Transaction created', hint: 'New transaction recorded' },
      { id: 'transaction.updated', label: 'Transaction updated', hint: 'Transaction modified' },
      { id: 'budget.exceeded', label: 'Budget exceeded', hint: 'Spending passed the budget' },
      { id: 'subscription.due', label: 'Subscription due', hint: 'Renewal is approaching' },
    ],
  },
  {
    id: 'focus', label: 'Focus',
    events: [
      { id: 'session.started', label: 'Focus session started', hint: 'Entered focus mode' },
      { id: 'session.completed', label: 'Focus session completed', hint: 'Finished a focus block' },
    ],
  },
  {
    id: 'goals', label: 'Goals',
    events: [
      { id: 'goal.created', label: 'Goal created', hint: 'New goal added' },
      { id: 'goal.completed', label: 'Goal completed', hint: 'Goal marked done' },
      { id: 'goal.progress', label: 'Goal progress', hint: 'Progress updated' },
    ],
  },
  {
    id: 'learning', label: 'Learning',
    events: [
      { id: 'note.created', label: 'Note created', hint: 'New note saved' },
      { id: 'note.summarized', label: 'Note summarized', hint: 'AI summary generated' },
    ],
  },
  {
    id: 'ide', label: 'IDE',
    events: [
      { id: 'project.opened', label: 'Project opened', hint: 'IDE project detected' },
      { id: 'build.completed', label: 'Build completed', hint: 'Build finished' },
    ],
  },
  {
    id: 'system', label: 'System',
    events: [
      { id: 'app.launched', label: 'App launched', hint: 'RHEO started' },
      { id: 'app.quit', label: 'App quit', hint: 'RHEO closed' },
    ],
  },
  {
    id: 'tracking', label: 'Tracking',
    events: [
      { id: 'window.changed', label: 'Active window changed', hint: 'Foreground app switched' },
    ],
  },
]

export const INTERVAL_UNITS = ['minutes', 'hours', 'days', 'weeks'] as const

export interface FieldOption {
  id: string
  label: string
  type: 'number' | 'string' | 'boolean'
}

export const FIELD_OPTIONS: Record<string, FieldOption[]> = {
  finance: [
    { id: 'amount', label: 'Amount', type: 'number' },
    { id: 'category', label: 'Category', type: 'string' },
    { id: 'status', label: 'Status', type: 'string' },
    { id: 'account', label: 'Account', type: 'string' },
  ],
  focus: [
    { id: 'duration', label: 'Duration (min)', type: 'number' },
    { id: 'category', label: 'Category', type: 'string' },
  ],
  goals: [
    { id: 'progress', label: 'Progress (%)', type: 'number' },
    { id: 'status', label: 'Status', type: 'string' },
  ],
  learning: [
    { id: 'note_count', label: 'Note count', type: 'number' },
    { id: 'status', label: 'Status', type: 'string' },
  ],
  ide: [
    { id: 'project', label: 'Project', type: 'string' },
    { id: 'duration', label: 'Duration (min)', type: 'number' },
  ],
  system: [
    { id: 'status', label: 'Status', type: 'string' },
  ],
  tracking: [
    { id: 'app', label: 'App', type: 'string' },
    { id: 'category', label: 'Category', type: 'string' },
  ],
}

export const OPERATOR_OPTIONS: { id: string; label: string; token: string }[] = [
  { id: 'eq', label: 'equals', token: '==' },
  { id: 'neq', label: 'not equals', token: '!=' },
  { id: 'gt', label: 'greater than', token: '>' },
  { id: 'gte', label: 'at least', token: '>=' },
  { id: 'lt', label: 'less than', token: '<' },
  { id: 'lte', label: 'at most', token: '<=' },
]

export function triggerLabel(kind: TriggerKind, source?: string, event?: string, interval?: number, unit?: string): string {
  if (kind === 'schedule') {
    const i = interval || 5
    const u = unit || 'minutes'
    return `every ${i} ${u}`
  }
  return `on ${source}.${event}`
}
