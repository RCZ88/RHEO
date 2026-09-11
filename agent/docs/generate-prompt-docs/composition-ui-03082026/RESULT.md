# Visual Automation Builder — Complete Design Specification

---

## 1. Component Architecture

### New Files

```
src/
├── components/ai/automations/
│   ├── AutomationCard.tsx              — Canvas/Deck card rendering automation rules
│   ├── AutomationList.tsx              — Deck slot listing all automations
│   ├── VisualBuilder/
│   │   ├── VisualBuilderModal.tsx      — Full-screen modal shell (5-step wizard)
│   │   ├── StepTrigger.tsx             — Step 1: trigger picker grid
│   │   ├── StepConditions.tsx          — Step 2: condition builder
│   │   ├── StepAction.tsx              — Step 3: action picker grid
│   │   ├── StepConfigure.tsx           — Step 4: action param form
│   │   ├── StepReview.tsx              — Step 5: summary + save
│   │   └── BuilderPreview.tsx          — Right panel: live human-readable preview
│   ├── data/
│   │   ├── triggerRegistry.ts          — All triggers with fields, icons, source colors
│   │   ├── actionRegistry.ts           — All actions with params, icons
│   │   └── operatorMap.ts              — Operator labels + compatible field types
│   └── lib/
│       ├── dslGenerator.ts             — Visual config → DSL string
│       ├── nlParser.ts                 — Natural language → automation config (AI bridge)
│       └── useAutomationActions.ts     — Hook: CRUD + evaluate + toggle via IPC
├── types/
│   └── automation.ts                   — TypeScript types for the visual builder
```

### Modified Files

| File | Change |
|---|---|
| `src/types/canvas.ts` | Add `'automation'` to `CardType` union |
| `src/components/ai/compositions/CompositionPanel.tsx` | Replace raw DSL "New Rule" with "Create Automation" that opens `VisualBuilderModal`; remove DSL textarea |
| `src/components/ai/compositions/CompositionEditorModal.tsx` | Replace with `VisualBuilderModal` import; old modal deprecated |
| `src/components/ai/compositions/CompositionRuleCard.tsx` | Replace with `AutomationCard` rendering (visual summary, no DSL shown) |
| `src/pages/AiPage.tsx` | Add `automation` deck slot; render automation cards on canvas; wire AI chat intent detection |
| `src/components/ai/tokens.ts` | Add `automation` to `SECTION_ACCENT` map; add automation-specific accent key |
| `src/components/ai/lib/motion.ts` | Add `automationEnterVariants`, `automationPulseVariants` |

---

## 2. Types — `src/types/automation.ts`

```ts
import type { DataSourceName } from '../domains/compositions/compositionTypes'

// ─── Visual Builder State ──────────────────────────────────

export interface AutomationConfig {
  name: string
  description: string
  trigger: TriggerSelection
  conditions: ConditionRow[]
  conditionLogic: 'and' | 'or'
  action: ActionSelection
  actionParams: Record<string, any>
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
```

---

## 3. Trigger Registry — `src/components/ai/automations/data/triggerRegistry.ts`

```ts
import { Zap, Mail, Target, TrendingUp, BookOpen, Code, Monitor, DollarSign, Clock } from 'lucide-react'
import type { DataSourceName } from '../../../domains/compositions/compositionTypes'
import type { TriggerField } from '../../../types/automation'

export interface TriggerDef {
  id: string                    // "finance.transaction.created"
  source: DataSourceName
  event: string
  label: string
  description: string
  icon: React.ComponentType<any>
  fields: TriggerField[]
}

export const SOURCE_META: Record<DataSourceName, { color: string; accentKey: string; label: string }> = {
  finance: { color: '#f59e0b', accentKey: 'amber',   label: 'Finance' },
  focus:   { color: '#10b981', accentKey: 'emerald', label: 'Focus' },
  goals:   { color: '#8b5cf6', accentKey: 'violet',  label: 'Goals' },
  learning:{ color: '#22d3ee', accentKey: 'cyan',    label: 'Learning' },
  ide:     { color: '#f472b6', accentKey: 'pink',    label: 'IDE' },
  system:  { color: '#64748b', accentKey: 'slate',   label: 'System' },
}

export const TRIGGERS: TriggerDef[] = [
  // ─── Finance ────────────────────────────────────────────
  {
    id: 'finance.transaction.created',
    source: 'finance', event: 'transaction.created',
    label: 'Transaction Created',
    description: 'Fires when a new financial transaction is recorded',
    icon: DollarSign,
    fields: [
      { name: 'amount', type: 'number', label: 'Amount' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'wallet', type: 'string', label: 'Wallet' },
    ],
  },
  {
    id: 'finance.transaction.updated',
    source: 'finance', event: 'transaction.updated',
    label: 'Transaction Updated',
    description: 'Fires when an existing transaction is modified',
    icon: DollarSign,
    fields: [
      { name: 'amount', type: 'number', label: 'Amount' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'description', type: 'string', label: 'Description' },
    ],
  },
  {
    id: 'finance.account.created',
    source: 'finance', event: 'account.created',
    label: 'Account Created',
    description: 'Fires when a new financial account is added',
    icon: DollarSign,
    fields: [
      { name: 'name', type: 'string', label: 'Account Name' },
      { name: 'type', type: 'string', label: 'Account Type' },
      { name: 'balance', type: 'number', label: 'Balance' },
    ],
  },

  // ─── Focus ──────────────────────────────────────────────
  {
    id: 'focus.session.started',
    source: 'focus', event: 'session.started',
    label: 'Focus Session Started',
    description: 'Fires when a tracked focus session begins',
    icon: Clock,
    fields: [
      { name: 'app', type: 'string', label: 'Application' },
      { name: 'category', type: 'string', label: 'Category' },
    ],
  },
  {
    id: 'focus.session.ended',
    source: 'focus', event: 'session.ended',
    label: 'Focus Session Ended',
    description: 'Fires when a tracked focus session completes',
    icon: Clock,
    fields: [
      { name: 'app', type: 'string', label: 'Application' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'duration', type: 'number', label: 'Duration (min)' },
      { name: 'productive', type: 'boolean', label: 'Productive' },
    ],
  },
  {
    id: 'focus.session.paused',
    source: 'focus', event: 'session.paused',
    label: 'Focus Session Paused',
    description: 'Fires when a focus session is paused',
    icon: Clock,
    fields: [
      { name: 'app', type: 'string', label: 'Application' },
      { name: 'duration', type: 'number', label: 'Duration (min)' },
    ],
  },

  // ─── Goals ──────────────────────────────────────────────
  {
    id: 'goals.goal.created',
    source: 'goals', event: 'goal.created',
    label: 'Goal Created',
    description: 'Fires when a new goal is added',
    icon: Target,
    fields: [
      { name: 'title', type: 'string', label: 'Goal Title' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'period', type: 'string', label: 'Period' },
    ],
  },
  {
    id: 'goals.goal.completed',
    source: 'goals', event: 'goal.completed',
    label: 'Goal Completed',
    description: 'Fires when a goal is marked as done',
    icon: Target,
    fields: [
      { name: 'title', type: 'string', label: 'Goal Title' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'completedAt', type: 'date', label: 'Completed At' },
    ],
  },
  {
    id: 'goals.goal.deleted',
    source: 'goals', event: 'goal.deleted',
    label: 'Goal Deleted',
    description: 'Fires when a goal is removed',
    icon: Target,
    fields: [
      { name: 'title', type: 'string', label: 'Goal Title' },
      { name: 'category', type: 'string', label: 'Category' },
    ],
  },

  // ─── Learning ───────────────────────────────────────────
  {
    id: 'learning.lesson.completed',
    source: 'learning', event: 'lesson.completed',
    label: 'Lesson Completed',
    description: 'Fires when a learning lesson is finished',
    icon: BookOpen,
    fields: [
      { name: 'title', type: 'string', label: 'Lesson Title' },
      { name: 'score', type: 'number', label: 'Score' },
    ],
  },
  {
    id: 'learning.quiz.passed',
    source: 'learning', event: 'quiz.passed',
    label: 'Quiz Passed',
    description: 'Fires when a quiz is passed',
    icon: BookOpen,
    fields: [
      { name: 'title', type: 'string', label: 'Quiz Title' },
      { name: 'score', type: 'number', label: 'Score' },
      { name: 'passingScore', type: 'number', label: 'Passing Score' },
    ],
  },

  // ─── IDE ────────────────────────────────────────────────
  {
    id: 'ide.project.opened',
    source: 'ide', event: 'project.opened',
    label: 'Project Opened',
    description: 'Fires when a project is opened in the IDE',
    icon: Code,
    fields: [
      { name: 'name', type: 'string', label: 'Project Name' },
      { name: 'language', type: 'string', label: 'Language' },
    ],
  },
  {
    id: 'ide.commit.made',
    source: 'ide', event: 'commit.made',
    label: 'Commit Made',
    description: 'Fires when a git commit is created',
    icon: Code,
    fields: [
      { name: 'message', type: 'string', label: 'Commit Message' },
      { name: 'filesChanged', type: 'number', label: 'Files Changed' },
    ],
  },

  // ─── System ─────────────────────────────────────────────
  {
    id: 'system.app.started',
    source: 'system', event: 'app.started',
    label: 'App Started',
    description: 'Fires when the application launches',
    icon: Monitor,
    fields: [
      { name: 'version', type: 'string', label: 'Version' },
    ],
  },
  {
    id: 'system.app.idle',
    source: 'system', event: 'app.idle',
    label: 'App Idle',
    description: 'Fires after the app detects user inactivity',
    icon: Monitor,
    fields: [
      { name: 'idleDuration', type: 'number', label: 'Idle Duration (min)' },
    ],
  },
  {
    id: 'system.app.resumed',
    source: 'system', event: 'app.resumed',
    label: 'App Resumed',
    description: 'Fires when the app resumes from suspend',
    icon: Monitor,
    fields: [
      { name: 'suspendDuration', type: 'number', label: 'Suspend Duration (min)' },
    ],
  },
]

export function getTriggerById(id: string): TriggerDef | undefined {
  return TRIGGERS.find(t => t.id === id)
}

export function getTriggersBySource(source: DataSourceName): TriggerDef[] {
  return TRIGGERS.filter(t => t.source === source)
}
```

---

## 4. Action Registry — `src/components/ai/automations/data/actionRegistry.ts`

```ts
import { Bell, Target, Calendar, Clock, Mail, FileText, CheckCircle } from 'lucide-react'
import type { ActionParam } from '../../../types/automation'

export interface ActionDef {
  id: string              // "notify", "goal:create", etc.
  label: string
  description: string
  icon: React.ComponentType<any>
  params: ActionParam[]
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'notify',
    label: 'Send Notification',
    description: 'Show a desktop notification with a message',
    icon: Bell,
    params: [
      { name: 'message', type: 'string', label: 'Message', required: true, placeholder: 'Large transaction detected' },
    ],
  },
  {
    id: 'goal:create',
    label: 'Create Goal',
    description: 'Add a new goal to your goal list',
    icon: Target,
    params: [
      { name: 'title', type: 'string', label: 'Goal Title', required: true, placeholder: 'Review quarterly budget' },
      { name: 'category', type: 'select', label: 'Category', required: false, options: ['general', 'work', 'personal', 'health', 'finance'] },
    ],
  },
  {
    id: 'goal:complete',
    label: 'Complete Goal',
    description: 'Mark an existing goal as done',
    icon: CheckCircle,
    params: [
      { name: 'title', type: 'string', label: 'Goal Title', required: true, placeholder: 'Goal to mark complete' },
    ],
  },
  {
    id: 'schedule:add',
    label: 'Add to Schedule',
    description: 'Add an entry to your daily schedule',
    icon: Calendar,
    params: [
      { name: 'title', type: 'string', label: 'Title', required: true, placeholder: 'Review transaction' },
      { name: 'day', type: 'number', label: 'Day of Week (0=Sun)', required: true, placeholder: '1' },
      { name: 'start', type: 'string', label: 'Start Time', required: true, placeholder: '09:00' },
      { name: 'end', type: 'string', label: 'End Time', required: true, placeholder: '10:00' },
    ],
  },
  {
    id: 'deadline:add',
    label: 'Create Deadline',
    description: 'Create a new deadline with priority',
    icon: Clock,
    params: [
      { name: 'title', type: 'string', label: 'Title', required: true, placeholder: 'Pay invoice' },
      { name: 'dueDate', type: 'date', label: 'Due Date', required: true },
      { name: 'priority', type: 'select', label: 'Priority', required: false, options: ['low', 'medium', 'high', 'critical'] },
    ],
  },
  {
    id: 'email:send',
    label: 'Send Email',
    description: 'Send an email via configured connector',
    icon: Mail,
    params: [
      { name: 'to', type: 'string', label: 'To', required: true, placeholder: 'user@example.com' },
      { name: 'subject', type: 'string', label: 'Subject', required: true, placeholder: 'Automated alert' },
      { name: 'body', type: 'string', label: 'Body', required: true, placeholder: 'Email content...' },
    ],
  },
  {
    id: 'calendar:create',
    label: 'Create Calendar Event',
    description: 'Add an event to your connected calendar',
    icon: Calendar,
    params: [
      { name: 'title', type: 'string', label: 'Event Title', required: true, placeholder: 'Follow-up meeting' },
      { name: 'start', type: 'date', label: 'Start', required: true },
      { name: 'end', type: 'date', label: 'End', required: true },
    ],
  },
  {
    id: 'log',
    label: 'Write to Log',
    description: 'Append a message to the activity log',
    icon: FileText,
    params: [
      { name: 'message', type: 'string', label: 'Message', required: true, placeholder: 'Automation fired' },
      { name: 'level', type: 'select', label: 'Level', required: false, options: ['info', 'warn', 'error'] },
    ],
  },
]

export function getActionById(id: string): ActionDef | undefined {
  return ACTIONS.find(a => a.id === id)
}
```

---

## 5. Operator Map — `src/components/ai/automations/data/operatorMap.ts`

```ts
import type { ConditionOperator } from '../../../types/automation'

export interface OperatorDef {
  value: ConditionOperator
  label: string
  symbol: string
  compatibleTypes: ('string' | 'number' | 'boolean' | 'date')[]
}

export const OPERATORS: OperatorDef[] = [
  { value: 'eq',         label: 'Equals',           symbol: '=',    compatibleTypes: ['string', 'number', 'boolean', 'date'] },
  { value: 'neq',        label: 'Not Equals',       symbol: '≠',   compatibleTypes: ['string', 'number', 'boolean', 'date'] },
  { value: 'gt',         label: 'Greater Than',     symbol: '>',   compatibleTypes: ['number', 'date'] },
  { value: 'gte',        label: 'Greater or Equal', symbol: '≥',   compatibleTypes: ['number', 'date'] },
  { value: 'lt',         label: 'Less Than',        symbol: '<',   compatibleTypes: ['number', 'date'] },
  { value: 'lte',        label: 'Less or Equal',    symbol: '≤',   compatibleTypes: ['number', 'date'] },
  { value: 'contains',   label: 'Contains',         symbol: '⊃',   compatibleTypes: ['string'] },
  { value: 'matches',    label: 'Matches Pattern',  symbol: '~',   compatibleTypes: ['string'] },
  { value: 'exists',     label: 'Exists',           symbol: '∃',   compatibleTypes: ['string', 'number', 'boolean', 'date'] },
  { value: 'not_exists', label: 'Does Not Exist',   symbol: '∄',   compatibleTypes: ['string', 'number', 'boolean', 'date'] },
]

export function getOperatorsForType(fieldType: string): OperatorDef[] {
  return OPERATORS.filter(op => op.compatibleTypes.includes(fieldType as any))
}
```

---

## 6. DSL Generator — `src/components/ai/automations/lib/dslGenerator.ts`

```ts
import type { AutomationConfig, ConditionRow } from '../../../types/automation'

/**
 * Converts the visual builder config into a DSL string
 * that the existing CompositionEngine can parse.
 *
 * DSL format:
 *   on <source>.<event> if <conditions> do <action>:<params>
 *
 * Examples:
 *   on finance.transaction.created if amount > 100 do notify:message 'Large transaction'
 *   on goals.goal.completed if category eq 'work' do schedule:add title 'Celebrate' day 5 start '17:00' end '18:00'
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

  // Operators that don't take a value
  if (operator === 'exists' || operator === 'not_exists') {
    return `${field} ${operator}`
  }

  // Format value based on type
  const formattedValue = formatValue(value)
  return `${field} ${operator} ${formattedValue}`
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  // Strings get single-quoted; escape internal single quotes
  const escaped = value.replace(/'/g, "\\'")
  return `'${escaped}'`
}

function formatAction(actionName: string, params: Record<string, any>): string {
  const paramParts = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== '')
    .map(([key, value]) => `${key} ${formatValue(value)}`)

  if (paramParts.length === 0) return actionName
  return `${actionName}:${paramParts.join(' ')}`
}

/**
 * Generates a human-readable summary of the automation.
 * Used in the automation card body.
 */
export function generateSummary(config: AutomationConfig): string {
  const triggerLabel = config.trigger.label || `${config.trigger.source}.${config.trigger.event}`

  const conditionParts = config.conditions
    .filter(c => c.field && c.operator)
    .map(c => `${c.field} ${c.operator} ${c.value}`)

  let conditionText = ''
  if (conditionParts.length > 0) {
    const joiner = config.conditionLogic === 'and' ? ' AND ' : ' OR '
    conditionText = `, if ${conditionParts.join(joiner)}`
  }

  const actionLabel = config.action.label || config.action.name
  return `When ${triggerLabel}${conditionText} → ${actionLabel}`
}
```

---

## 7. Visual Builder Modal — `src/components/ai/automations/VisualBuilder/VisualBuilderModal.tsx`

```tsx
import { useState, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Sparkles, Save } from 'lucide-react'
import { cn } from '../../lib/cn'
import { SURFACE, RING, TEXT, ACCENT, MOTION } from '../../tokens'
import { dialogVariants } from '../../lib/motion'
import { StepTrigger } from './StepTrigger'
import { StepConditions } from './StepConditions'
import { StepAction } from './StepAction'
import { StepConfigure } from './StepConfigure'
import { StepReview } from './StepReview'
import { BuilderPreview } from './BuilderPreview'
import { generateDsl } from '../lib/dslGenerator'
import type { AutomationConfig, TriggerSelection, ConditionRow, ActionSelection } from '../../../types/automation'

const STEPS = [
  { id: 1, label: 'Trigger' },
  { id: 2, label: 'Conditions' },
  { id: 3, label: 'Action' },
  { id: 4, label: 'Configure' },
  { id: 5, label: 'Review' },
] as const

interface VisualBuilderModalProps {
  onClose: () => void
  onSaved: (config: AutomationConfig, dsl: string) => Promise<void>
  initialConfig?: Partial<AutomationConfig>
}

export function VisualBuilderModal({ onClose, onSaved, initialConfig }: VisualBuilderModalProps) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Builder state
  const [name, setName] = useState(initialConfig?.name ?? '')
  const [trigger, setTrigger] = useState<TriggerSelection | null>(initialConfig?.trigger ?? null)
  const [conditions, setConditions] = useState<ConditionRow[]>(initialConfig?.conditions ?? [])
  const [conditionLogic, setConditionLogic] = useState<'and' | 'or'>(initialConfig?.conditionLogic ?? 'and')
  const [action, setAction] = useState<ActionSelection | null>(initialConfig?.action ?? null)
  const [actionParams, setActionParams] = useState<Record<string, any>>(initialConfig?.actionParams ?? {})
  const [lifecycle, setLifecycle] = useState<'forever' | 'once' | 'schedule' | 'manual'>(initialConfig?.lifecycle ?? 'forever')
  const [priority, setPriority] = useState(initialConfig?.priority ?? 500)
  const [category, setCategory] = useState(initialConfig?.category ?? 'general')
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true)

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1: return trigger !== null
      case 2: return true // conditions are optional
      case 3: return action !== null
      case 4: return Object.values(actionParams).some(v => v !== undefined && v !== '')
      case 5: return name.trim().length > 0
      default: return false
    }
  }, [step, trigger, action, actionParams, name])

  const handleSave = async () => {
    if (!trigger || !action) return
    setSaving(true)

    const config: AutomationConfig = {
      name: name.trim(),
      description: initialConfig?.description ?? '',
      trigger,
      conditions,
      conditionLogic,
      action,
      actionParams,
      lifecycle,
      priority,
      category,
      enabled,
    }

    const dsl = generateDsl(config)
    await onSaved(config, dsl)
    setSaving(false)
  }

  return (
    <motion.div
      variants={reduce ? undefined : dialogVariants}
      initial="hidden" animate="show" exit="exit"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={cn(
        "relative w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden",
        "rounded-xl bg-[rgba(24,24,27,0.95)] backdrop-blur-xl",
        "ring-1 ring-zinc-700/50"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <Sparkles size={16} className="text-violet-400" />
            <h2 className={cn("text-[14px] font-semibold", TEXT.primary)}>Create Automation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800/40">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                onClick={() => s.id < step && setStep(s.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors",
                  step === s.id && "bg-violet-500/15 text-violet-300",
                  step > s.id && "text-emerald-400 cursor-pointer hover:bg-zinc-800/60",
                  step < s.id && "text-zinc-600"
                )}
              >
                <span className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                  step === s.id && "bg-violet-500/30 text-violet-200",
                  step > s.id && "bg-emerald-500/20 text-emerald-300",
                  step < s.id && "bg-zinc-800 text-zinc-600"
                )}>
                  {step > s.id ? '✓' : s.id}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-zinc-700/60" />}
            </div>
          ))}
        </div>

        {/* Body: Left panel (config) + Right panel (preview) */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Step Content */}
          <div className="flex-[3] min-h-0 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {step === 1 && <StepTrigger key="s1" selected={trigger} onSelect={setTrigger} />}
              {step === 2 && <StepConditions key="s2" trigger={trigger} conditions={conditions} logic={conditionLogic} onConditionsChange={setConditions} onLogicChange={setConditionLogic} />}
              {step === 3 && <StepAction key="s3" selected={action} onSelect={setAction} />}
              {step === 4 && <StepConfigure key="s4" action={action} params={actionParams} onParamsChange={setActionParams} />}
              {step === 5 && <StepReview key="s5" config={{ name, trigger: trigger!, conditions, conditionLogic, action: action!, actionParams, lifecycle, priority, category, enabled }} onNameChange={setName} onLifecycleChange={setLifecycle} onPriorityChange={setPriority} onCategoryChange={setCategory} onEnabledChange={setEnabled} />}
            </AnimatePresence>
          </div>

          {/* Right: Live Preview */}
          <div className="flex-[2] min-h-0 border-l border-zinc-800/40 p-6 overflow-y-auto">
            <BuilderPreview
              name={name}
              trigger={trigger}
              conditions={conditions}
              conditionLogic={conditionLogic}
              action={action}
              actionParams={actionParams}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
              Cancel
            </button>
            {step < 5 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-4 py-2 text-[12px] font-medium transition-colors",
                  canProceed()
                    ? "bg-violet-600/80 hover:bg-violet-500/80 text-white"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                )}
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !canProceed()}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium transition-colors",
                  canProceed() && !saving
                    ? "bg-emerald-600/80 hover:bg-emerald-500/80 text-white"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                )}
              >
                <Save size={13} />
                {saving ? 'Saving…' : 'Save Automation'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
```

---

## 8. Step Components

### StepTrigger.tsx

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { TEXT, MOTION } from '../../tokens'
import { itemVariants, staggerParent } from '../../lib/motion'
import { TRIGGERS, SOURCE_META, getTriggersBySource } from '../data/triggerRegistry'
import type { TriggerSelection, TriggerDef } from '../../../types/automation'
import type { DataSourceName } from '../../../domains/compositions/compositionTypes'

const SOURCES: DataSourceName[] = ['finance', 'focus', 'goals', 'learning', 'ide', 'system']

interface StepTriggerProps {
  selected: TriggerSelection | null
  onSelect: (t: TriggerSelection) => void
}

export function StepTrigger({ selected, onSelect }: StepTriggerProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div variants={reduce ? undefined : staggerParent} initial="hidden" animate="show" className="space-y-6">
      <div>
        <h3 className={cn("text-[13px] font-semibold mb-1", TEXT.primary)}>Pick a Trigger</h3>
        <p className={cn("text-[11px]", TEXT.muted)}>What event should start this automation?</p>
      </div>

      {SOURCES.map(source => {
        const triggers = getTriggersBySource(source)
        const meta = SOURCE_META[source]
        return (
          <div key={source}>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{meta.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {triggers.map(trigger => (
                <motion.button
                  key={trigger.id}
                  variants={reduce ? undefined : itemVariants}
                  onClick={() => onSelect({ source: trigger.source, event: trigger.event, fields: trigger.fields })}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-xl p-3 text-left transition-all",
                    "bg-zinc-900/40 ring-1 ring-zinc-800/60 hover:ring-zinc-700",
                    selected?.event === trigger.event && selected?.source === trigger.source &&
                      "ring-2 ring-violet-500/50 bg-violet-500/5"
                  )}
                >
                  <trigger.icon size={20} style={{ color: meta.color }} />
                  <span className={cn("text-[11px] font-medium", TEXT.primary)}>{trigger.label}</span>
                  <span className={cn("text-[9px] leading-tight", TEXT.muted)}>{trigger.description}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}
```

### StepConditions.tsx

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { getOperatorsForType } from '../data/operatorMap'
import type { TriggerSelection, ConditionRow } from '../../../types/automation'

interface StepConditionsProps {
  trigger: TriggerSelection | null
  conditions: ConditionRow[]
  logic: 'and' | 'or'
  onConditionsChange: (rows: ConditionRow[]) => void
  onLogicChange: (logic: 'and' | 'or') => void
}

export function StepConditions({ trigger, conditions, logic, onConditionsChange, onLogicChange }: StepConditionsProps) {
  const reduce = useReducedMotion()

  if (!trigger) return <p className="text-[12px] text-zinc-500">Select a trigger first.</p>

  const addRow = () => {
    onConditionsChange([...conditions, { id: crypto.randomUUID(), field: '', operator: 'eq', value: '' }])
  }

  const updateRow = (id: string, patch: Partial<ConditionRow>) => {
    onConditionsChange(conditions.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const removeRow = (id: string) => {
    onConditionsChange(conditions.filter(r => r.id !== id))
  }

  return (
    <motion.div initial={reduce ? undefined : { opacity: 0, y: 8 }} animate={reduce ? undefined : { opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h3 className={cn("text-[13px] font-semibold mb-1", TEXT.primary)}>Set Conditions</h3>
        <p className={cn("text-[11px]", TEXT.muted)}>Optional. Add filters to control when the action fires.</p>
      </div>

      {conditions.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-700/60 p-6 text-center">
          <p className="text-[11px] text-zinc-500 mb-3">No conditions. The action fires on every trigger event.</p>
        </div>
      )}

      {conditions.map((row, i) => {
        const fieldDef = trigger.fields.find(f => f.name === row.field)
        const operators = fieldDef ? getOperatorsForType(fieldDef.type) : []

        return (
          <div key={row.id} className="flex items-center gap-2">
            {/* Logic toggle between rows */}
            {i > 0 && (
              <button
                onClick={() => onLogicChange(logic === 'and' ? 'or' : 'and')}
                className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-300 hover:bg-zinc-700 transition-colors"
              >
                {logic.toUpperCase()}
              </button>
            )}

            {/* Field select */}
            <select
              value={row.field}
              onChange={e => updateRow(row.id, { field: e.target.value, operator: 'eq', value: '' })}
              className="flex-1 rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
            >
              <option value="">Field…</option>
              {trigger.fields.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
            </select>

            {/* Operator select */}
            <select
              value={row.operator}
              onChange={e => updateRow(row.id, { operator: e.target.value as any })}
              className="w-32 rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
            >
              {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>

            {/* Value input */}
            {row.operator !== 'exists' && row.operator !== 'not_exists' && (
              <input
                type={fieldDef?.type === 'number' ? 'number' : fieldDef?.type === 'date' ? 'date' : 'text'}
                value={String(row.value)}
                onChange={e => updateRow(row.id, { value: fieldDef?.type === 'number' ? Number(e.target.value) : e.target.value })}
                placeholder="Value"
                className="flex-1 rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600"
              />
            )}

            {/* Remove */}
            <button onClick={() => removeRow(row.id)} className="shrink-0 p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <X size={13} />
            </button>
          </div>
        )
      })}

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700/60 px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
      >
        <Plus size={13} /> Add Condition
      </button>
    </motion.div>
  )
}
```

### StepAction.tsx

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { staggerParent, itemVariants } from '../../lib/motion'
import { ACTIONS } from '../data/actionRegistry'
import type { ActionSelection } from '../../../types/automation'

interface StepActionProps {
  selected: ActionSelection | null
  onSelect: (a: ActionSelection) => void
}

export function StepAction({ selected, onSelect }: StepActionProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div variants={reduce ? undefined : staggerParent} initial="hidden" animate="show" className="space-y-4">
      <div>
        <h3 className={cn("text-[13px] font-semibold mb-1", TEXT.primary)}>Pick an Action</h3>
        <p className={cn("text-[11px]", TEXT.muted)}>What should happen when the trigger fires?</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(action => (
          <motion.button
            key={action.id}
            variants={reduce ? undefined : itemVariants}
            onClick={() => onSelect({ name: action.id, params: action.params })}
            className={cn(
              "flex items-start gap-3 rounded-xl p-4 text-left transition-all",
              "bg-zinc-900/40 ring-1 ring-zinc-800/60 hover:ring-zinc-700",
              selected?.name === action.id && "ring-2 ring-emerald-500/50 bg-emerald-500/5"
            )}
          >
            <action.icon size={20} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <span className={cn("text-[12px] font-medium block", TEXT.primary)}>{action.label}</span>
              <span className={cn("text-[10px] leading-tight", TEXT.muted)}>{action.description}</span>
              <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] text-zinc-500">
                {action.params.length} param{action.params.length !== 1 ? 's' : ''}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
```

### StepConfigure.tsx

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import type { ActionSelection } from '../../../types/automation'

interface StepConfigureProps {
  action: ActionSelection | null
  params: Record<string, any>
  onParamsChange: (params: Record<string, any>) => void
}

export function StepConfigure({ action, params, onParamsChange }: StepConfigureProps) {
  const reduce = useReducedMotion()

  if (!action) return <p className="text-[12px] text-zinc-500">Select an action first.</p>

  const update = (name: string, value: any) => {
    onParamsChange({ ...params, [name]: value })
  }

  return (
    <motion.div initial={reduce ? undefined : { opacity: 0, y: 8 }} animate={reduce ? undefined : { opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h3 className={cn("text-[13px] font-semibold mb-1", TEXT.primary)}>Configure Action</h3>
        <p className={cn("text-[11px]", TEXT.muted)}>Fill in the details for "{action.name}".</p>
      </div>

      <div className="space-y-3">
        {action.params.map(param => (
          <div key={param.name}>
            <label className="block text-[11px] text-zinc-400 mb-1">
              {param.label}{param.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {param.type === 'select' ? (
              <select
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
              >
                <option value="">Select…</option>
                {param.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : param.type === 'date' ? (
              <input
                type="datetime-local"
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
              />
            ) : param.name === 'message' || param.name === 'body' ? (
              <textarea
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                placeholder={param.placeholder}
                rows={3}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 resize-none"
              />
            ) : (
              <input
                type={param.type === 'number' ? 'number' : 'text'}
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={param.placeholder}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600"
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
```

### StepReview.tsx

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { generateSummary } from '../lib/dslGenerator'
import type { AutomationConfig } from '../../../types/automation'

interface StepReviewProps {
  config: AutomationConfig
  onNameChange: (v: string) => void
  onLifecycleChange: (v: 'forever' | 'once' | 'schedule' | 'manual') => void
  onPriorityChange: (v: number) => void
  onCategoryChange: (v: string) => void
  onEnabledChange: (v: boolean) => void
}

export function StepReview({ config, onNameChange, onLifecycleChange, onPriorityChange, onCategoryChange, onEnabledChange }: StepReviewProps) {
  const reduce = useReducedMotion()
  const summary = generateSummary(config)

  return (
    <motion.div initial={reduce ? undefined : { opacity: 0, y: 8 }} animate={reduce ? undefined : { opacity: 1, y: 0 }} className="space-y-5">
      <div>
        <h3 className={cn("text-[13px] font-semibold mb-1", TEXT.primary)}>Review & Save</h3>
        <p className={cn("text-[11px]", TEXT.muted)}>Confirm the automation details.</p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl bg-violet-500/5 ring-1 ring-violet-500/20 p-4">
        <p className="text-[12px] text-violet-200 font-medium">{summary}</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-[11px] text-zinc-400 mb-1">Automation Name<span className="text-red-400 ml-0.5">*</span></label>
        <input
          value={config.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Boss email alert"
          className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600"
        />
      </div>

      {/* Lifecycle */}
      <div>
        <label className="block text-[11px] text-zinc-400 mb-1">Lifecycle</label>
        <div className="flex gap-1">
          {(['forever', 'once', 'schedule', 'manual'] as const).map(lc => (
            <button
              key={lc}
              onClick={() => onLifecycleChange(lc)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] capitalize transition-colors",
                config.lifecycle === lc ? "bg-violet-500/15 text-violet-300" : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {lc}
            </button>
          ))}
        </div>
      </div>

      {/* Priority slider */}
      <div>
        <label className="block text-[11px] text-zinc-400 mb-1">Priority: {config.priority}</label>
        <input
          type="range" min={1} max={1000} value={config.priority}
          onChange={e => onPriorityChange(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-[11px] text-zinc-400 mb-1">Category</label>
        <select
          value={config.category}
          onChange={e => onCategoryChange(e.target.value)}
          className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
        >
          {['general', 'work', 'personal', 'finance', 'productivity'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-zinc-300">Enable immediately</span>
        <button
          onClick={() => onEnabledChange(!config.enabled)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            config.enabled ? "bg-emerald-500/60" : "bg-zinc-700"
          )}
        >
          <span className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            config.enabled ? "translate-x-4" : "translate-x-0.5"
          )} />
        </button>
      </div>
    </motion.div>
  )
}
```

### BuilderPreview.tsx

```tsx
import { ArrowRight, Zap, GitBranch, GitCommit } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { SOURCE_META } from '../data/triggerRegistry'
import { getActionById } from '../data/actionRegistry'
import type { TriggerSelection, ConditionRow, ActionSelection } from '../../../types/automation'

interface BuilderPreviewProps {
  name: string
  trigger: TriggerSelection | null
  conditions: ConditionRow[]
  conditionLogic: 'and' | 'or'
  action: ActionSelection | null
  actionParams: Record<string, any>
}

export function BuilderPreview({ name, trigger, conditions, conditionLogic, action, actionParams }: BuilderPreviewProps) {
  const validConditions = conditions.filter(c => c.field && c.operator)
  const actionDef = action ? getActionById(action.name) : null

  return (
    <div className="space-y-4">
      <h4 className={cn("text-[11px] font-semibold uppercase tracking-wider", TEXT.muted)}>Live Preview</h4>

      {/* Name */}
      {name && (
        <div className="rounded-lg bg-zinc-800/40 p-3">
          <span className="text-[10px] text-zinc-500 block">Name</span>
          <span className="text-[13px] font-medium text-zinc-200">{name}</span>
        </div>
      )}

      {/* Flow visualization */}
      <div className="space-y-2">
        {/* Trigger */}
        <div className={cn(
          "rounded-lg p-3 ring-1",
          trigger ? "bg-zinc-900/60 ring-zinc-700/60" : "bg-zinc-900/30 ring-zinc-800/40 border border-dashed"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-amber-400" />
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Trigger</span>
          </div>
          {trigger ? (
            <span className="text-[12px] text-zinc-200">
              {SOURCE_META[trigger.source]?.label}.{trigger.event}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-600 italic">Not selected</span>
          )}
        </div>

        {/* Conditions */}
        {validConditions.length > 0 && (
          <>
            <div className="flex items-center gap-1 pl-4">
              <div className="h-3 w-px bg-zinc-700" />
              <ArrowRight size={10} className="text-zinc-600" />
            </div>
            <div className="rounded-lg bg-zinc-900/60 ring-1 ring-zinc-700/60 p-3">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={12} className="text-violet-400" />
                <span className="text-[10px] font-medium text-zinc-400 uppercase">
                  {validConditions.length} Condition{validConditions.length > 1 ? 's' : ''} ({conditionLogic.toUpperCase()})
                </span>
              </div>
              {validConditions.map((c, i) => (
                <p key={c.id} className="text-[11px] text-zinc-300">
                  {i > 0 && <span className="text-violet-400 font-bold">{conditionLogic.toUpperCase()} </span>}
                  {c.field} {c.operator} {c.value}
                </p>
              ))}
            </div>
          </>
        )}

        {/* Action */}
        <div className="flex items-center gap-1 pl-4">
          <div className="h-3 w-px bg-zinc-700" />
          <ArrowRight size={10} className="text-zinc-600" />
        </div>
        <div className={cn(
          "rounded-lg p-3 ring-1",
          action ? "bg-zinc-900/60 ring-zinc-700/60" : "bg-zinc-900/30 ring-zinc-800/40 border border-dashed"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <GitCommit size={12} className="text-emerald-400" />
            <span className="text-[10px] font-medium text-zinc-400 uppercase">Action</span>
          </div>
          {actionDef ? (
            <>
              <span className="text-[12px] text-zinc-200">{actionDef.label}</span>
              {Object.entries(actionParams).filter(([_, v]) => v).map(([k, v]) => (
                <p key={k} className="text-[10px] text-zinc-500 mt-0.5">
                  {k}: {String(v).slice(0, 40)}{String(v).length > 40 ? '…' : ''}
                </p>
              ))}
            </>
          ) : (
            <span className="text-[11px] text-zinc-600 italic">Not selected</span>
          )}
        </div>
      </div>

      {/* Human-readable summary */}
      {trigger && action && (
        <div className="rounded-lg bg-emerald-500/5 ring-1 ring-emerald-500/20 p-3 mt-4">
          <span className="text-[10px] text-emerald-400 block mb-1">Plain English</span>
          <span className="text-[11px] text-emerald-200 leading-relaxed">
            "When {trigger.source}.{trigger.event} fires
            {validConditions.length > 0 && `, if ${validConditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(` ${conditionLogic} `)}`}
            , then {actionDef?.label ?? action.name}."
          </span>
        </div>
      )}
    </div>
  )
}
```

---

## 9. AutomationCard — `src/components/ai/automations/AutomationCard.tsx`

```tsx
import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Zap, Play, Pause, Pencil, Trash2, MoreHorizontal,
  Mail, Target, DollarSign, Clock, BookOpen, Code, Monitor, Bell,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { SURFACE, RING, TEXT, ACCENT, MOTION, type AccentKey } from '../tokens'
import { cardEnterVariants, cardExitVariants } from '../lib/motion'
import { SOURCE_META } from './data/triggerRegistry'
import type { AutomationCardData } from '../../types/automation'
import type { DataSourceName } from '../domains/compositions/compositionTypes'

const SOURCE_ICONS: Record<DataSourceName, React.ComponentType<any>> = {
  finance: DollarSign,
  focus: Clock,
  goals: Target,
  learning: BookOpen,
  ide: Code,
  system: Monitor,
}

interface AutomationCardProps {
  data: AutomationCardData
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onTestRun: () => void
  onDismiss: () => void
}

export function AutomationCard({ data, onEdit, onToggle, onDelete, onTestRun, onDismiss }: AutomationCardProps) {
  const reduce = useReducedMotion()
  const [showMenu, setShowMenu] = useState(false)
  const meta = SOURCE_META[data.triggerSource]
  const TriggerIcon = SOURCE_ICONS[data.triggerSource] ?? Zap
  const accentKey = meta?.accentKey ?? 'violet'
  const a = ACCENT[accentKey as AccentKey] ?? ACCENT.violet

  const relativeTime = data.lastFired ? getRelativeTime(data.lastFired) : 'Never'

  return (
    <motion.div
      layout
      variants={reduce ? undefined : cardEnterVariants}
      initial="hidden" animate="show" exit="exit"
      className={cn(
        "group relative flex flex-col rounded-xl p-5 backdrop-blur-xl transition-all",
        "bg-[rgba(24,24,27,0.60)] ring-1 ring-zinc-800/60 hover:ring-zinc-700"
      )}
    >
      {/* Accent top bar */}
      <div className="absolute top-0 left-0 h-0.5 w-full rounded-t-xl" style={{ background: meta?.color ?? '#8b5cf6', opacity: 0.5 }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: (meta?.color ?? '#8b5cf6') + '18' }}>
            <TriggerIcon size={14} style={{ color: meta?.color ?? '#8b5cf6' }} />
          </div>
          <div>
            <h4 className={cn("text-[12px] font-semibold leading-tight", TEXT.primary)}>{data.name}</h4>
            <span className="text-[9px] text-zinc-600">{data.triggerSource}</span>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(v => !v)} className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <MoreHorizontal size={14} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-7 z-20 w-36 rounded-lg bg-zinc-900 ring-1 ring-zinc-700/60 py-1 shadow-xl"
              >
                <button onClick={() => { onEdit(); setShowMenu(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => { onTestRun(); setShowMenu(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800">
                  <Play size={12} /> Test Run
                </button>
                <button onClick={() => { onDelete(); setShowMenu(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10">
                  <Trash2 size={12} /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Summary */}
      <p className={cn("text-[11px] leading-relaxed mb-3", TEXT.secondary)}>{data.summary}</p>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-zinc-800/40 pt-3">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span className={cn("h-1.5 w-1.5 rounded-full", data.enabled ? "bg-emerald-400" : "bg-zinc-600")} />
          <span className="text-[9px] text-zinc-500">{data.enabled ? 'Active' : 'Paused'}</span>
          <span className="text-[9px] text-zinc-700">·</span>
          <span className="text-[9px] text-zinc-600">Last: {relativeTime}</span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <button onClick={onTestRun} title="Test Run" className="p-1.5 rounded-md text-zinc-500 hover:text-pink-300 hover:bg-pink-500/10 transition-colors">
            <Zap size={12} />
          </button>
          <button onClick={onToggle} title={data.enabled ? 'Pause' : 'Enable'} className="p-1.5 rounded-md text-zinc-500 hover:text-amber-300 hover:bg-amber-500/10 transition-colors">
            {data.enabled ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button onClick={onDismiss} title="Dismiss" className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
```

---

## 10. useAutomationActions Hook — `src/components/ai/automations/lib/useAutomationActions.ts`

```ts
import { useState, useCallback, useEffect } from 'react'
import { actionBus } from '../../lib/actionBus'
import { generateDsl, generateSummary } from './dslGenerator'
import type { AutomationConfig, AutomationCardData } from '../../../types/automation'

const API = (window as any).deskflowAPI

export function useAutomationActions() {
  const [automations, setAutomations] = useState<AutomationCardData[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const rules = await API?.compositionsList()
      const statuses = await API?.compositionsStatus()
      const statusMap = new Map<string, any>()
      if (statuses) statuses.forEach((s: any) => statusMap.set(s.rule_id, s))

      if (rules) {
        setAutomations(rules.map((r: any) => ({
          ruleId: r.id,
          name: r.name,
          triggerSource: parseTriggerSource(r.dsl_source),
          triggerEvent: parseTriggerEvent(r.dsl_source),
          triggerLabel: r.name,
          actionName: parseActionName(r.dsl_source),
          actionLabel: r.name,
          summary: r.description || `Automation: ${r.name}`,
          enabled: !!r.enabled,
          lifecycle: r.lifecycle,
          priority: r.priority,
          lastFired: statusMap.get(r.id)?.last_run_at ?? null,
          lastStatus: statusMap.get(r.id)?.last_status ?? null,
        })))
      }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const createAutomation = useCallback(async (config: AutomationConfig) => {
    const dsl = generateDsl(config)
    const summary = generateSummary(config)
    const actionId = actionBus.start('composition-create', `Creating "${config.name}"…`)

    try {
      await API?.compositionsCreate({
        id: crypto.randomUUID(),
        name: config.name,
        description: summary,
        dsl_source: dsl,
        enabled: config.enabled ? 1 : 0,
        priority: config.priority,
        category: config.category,
        lifecycle: config.lifecycle,
      })
      actionBus.complete(actionId)
      await load()
      return true
    } catch (err: any) {
      actionBus.fail(actionId, err.message)
      return false
    }
  }, [load])

  const toggleAutomation = useCallback(async (id: string, currentEnabled: boolean) => {
    const actionId = actionBus.start('composition-evaluate', currentEnabled ? 'Pausing automation…' : 'Enabling automation…')
    try {
      const rule = await API?.compositionsGet(id)
      await API?.compositionsUpdate(id, { ...rule, enabled: currentEnabled ? 0 : 1 })
      actionBus.complete(actionId)
      await load()
    } catch (err: any) {
      actionBus.fail(actionId, err.message)
    }
  }, [load])

  const deleteAutomation = useCallback(async (id: string, name: string) => {
    const actionId = actionBus.start('composition-delete', `Deleting "${name}"…`)
    try {
      await API?.compositionsDelete(id)
      actionBus.complete(actionId)
      await load()
    } catch (err: any) {
      actionBus.fail(actionId, err.message)
    }
  }, [load])

  const testRun = useCallback(async (id: string, name: string) => {
    const actionId = actionBus.start('composition-evaluate', `Testing "${name}"…`)
    try {
      await API?.compositionsEvaluate(id, {})
      actionBus.complete(actionId)
      await load()
    } catch (err: any) {
      actionBus.fail(actionId, err.message)
    }
  }, [load])

  return { automations, loading, createAutomation, toggleAutomation, deleteAutomation, testRun, reload: load }
}

// ─── DSL Parsing Helpers ──────────────────────────────────

function parseTriggerSource(dsl: string): string {
  const match = dsl.match(/^on\s+(\w+)\./)
  return match?.[1] ?? 'system'
}

function parseTriggerEvent(dsl: string): string {
  const match = dsl.match(/^on\s+\w+\.(\w+(?:\.\w+)?)/)
  return match?.[1] ?? 'unknown'
}

function parseActionName(dsl: string): string {
  const match = dsl.match(/do\s+([\w:]+)/)
  return match?.[1] ?? 'unknown'
}
```

---

## 11. AI Integration — Natural Language to Automation

### AI System Prompt Addition

```
AUTOMATION CREATION:
When the user asks to create an automation, trigger, rule, or "when X happens, do Y" pattern:
1. Parse their intent into this JSON structure
2. Respond with a fenced code block tagged ```automation
3. The system will create the automation and show a card on canvas/deck

Schema:
{
  "intent": "create-automation",
  "name": "Short descriptive name",
  "trigger": { "source": "finance|focus|goals|learning|ide|system", "event": "event.name" },
  "conditions": [{ "field": "amount", "operator": "gt", "value": 100 }],
  "conditionLogic": "and|or",
  "action": { "name": "notify|goal:create|schedule:add|deadline:add|email:send|calendar:create|log" },
  "actionParams": { "message": "..." },
  "lifecycle": "forever|once|schedule|manual",
  "priority": 500,
  "category": "general",
  "narration": "I've created an automation that..."
}

Available triggers: finance.transaction.created, finance.transaction.updated, finance.account.created, focus.session.started, focus.session.ended, focus.session.paused, goals.goal.created, goals.goal.completed, goals.goal.deleted, learning.lesson.completed, learning.quiz.passed, ide.project.opened, ide.commit.made, system.app.started, system.app.idle, system.app.resumed

Available actions: notify, goal:create, goal:complete, schedule:add, deadline:add, email:send, calendar:create, log

Example user: "Alert me when I get a transaction over $200"
Example response:
```automation
{
  "intent": "create-automation",
  "name": "Large Transaction Alert",
  "trigger": { "source": "finance", "event": "transaction.created" },
  "conditions": [{ "field": "amount", "operator": "gt", "value": 200 }],
  "conditionLogic": "and",
  "action": { "name": "notify" },
  "actionParams": { "message": "Large transaction detected: over $200" },
  "lifecycle": "forever",
  "priority": 500,
  "category": "finance",
  "narration": "I've set up an alert that will notify you whenever a transaction over $200 is recorded."
}
```
```

### Chat Parser Integration (in AiPage.tsx)

```tsx
// In the AI response handler, detect automation blocks:
function parseAiResponse(text: string): { automation?: any; cleanText: string } {
  const automationMatch = text.match(/```automation\n([\s\S]*?)\n```/)
  if (!automationMatch) return { cleanText: text }

  try {
    const parsed = JSON.parse(automationMatch[1])
    if (parsed.intent === 'create-automation') {
      const cleanText = text.replace(/```automation\n[\s\S]*?\n```/, '').trim()
      return { automation: parsed, cleanText }
    }
  } catch {}

  return { cleanText: text }
}

// Usage in chat handler:
const { automation, cleanText } = parseAiResponse(aiResponse)
if (automation) {
  // Convert to AutomationConfig and create
  const config: AutomationConfig = {
    name: automation.name,
    description: automation.narration,
    trigger: { source: automation.trigger.source, event: automation.trigger.event, fields: [] },
    conditions: automation.conditions ?? [],
    conditionLogic: automation.conditionLogic ?? 'and',
    action: { name: automation.action.name, params: [] },
    actionParams: automation.actionParams ?? {},
    lifecycle: automation.lifecycle ?? 'forever',
    priority: automation.priority ?? 500,
    category: automation.category ?? 'general',
    enabled: true,
  }
  await automationActions.createAutomation(config)
  // Spawn card on canvas with entrance animation
  addAutomationToCanvas(config)
}
```

---

## 12. Canvas/Deck Visibility

### Deck Mode — Automation Slot

```tsx
// In AiPageDeck, add new slot after connectors/schedule/deadlines:
<div className="dk-slot" data-slot="automations">
  <ActionOverlay status={isSlotActive('automations') ? 'executing' : null} actionType="composition-create">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[12px] font-semibold text-zinc-300">Automations</h3>
      <button onClick={() => setShowVisualBuilder(true)} className="text-[10px] text-violet-400 hover:text-violet-300">
        + Create
      </button>
    </div>
    {automationActions.automations.length === 0 ? (
      <div className="flex flex-col items-center py-6 text-zinc-600">
        <Zap size={20} className="mb-2 opacity-30" />
        <p className="text-[10px]">No automations yet</p>
      </div>
    ) : (
      <ListTransition items={automationActions.automations} renderItem={(auto) => (
        <AutomationCard data={auto} onEdit={...} onToggle={...} onDelete={...} onTestRun={...} onDismiss={...} />
      )} />
    )}
  </ActionOverlay>
</div>
```

### Canvas Mode — Automation Cards

```tsx
// In useCanvasState or CanvasContainer, add automation cards from automationActions:
const automationCards: CanvasCard[] = automationActions.automations.map((auto, i) => ({
  id: `auto-${auto.ruleId}`,
  type: 'automation' as CardType,
  position: { x: 80 + (i % 3) * 340, y: 80 + Math.floor(i / 3) * 240 },
  size: { w: 300, h: 180 },
  zIndex: 20 + i,
  pinned: false,
  data: { automation: auto },
  source: 'ai',
  status: 'live',
  createdAt: Date.now(),
}))

// Render in canvas alongside other cards:
{automationCards.map(card => (
  <CanvasCardWrapper key={card.id} card={card}>
    <AutomationCard
      data={card.data.automation}
      onEdit={() => openVisualBuilder(card.data.automation)}
      onToggle={() => automationActions.toggleAutomation(card.data.automation.ruleId, card.data.automation.enabled)}
      onDelete={() => automationActions.deleteAutomation(card.data.automation.ruleId, card.data.automation.name)}
      onTestRun={() => automationActions.testRun(card.data.automation.ruleId, card.data.automation.name)}
      onDismiss={() => dismissCanvasCard(card.id)}
    />
  </CanvasCardWrapper>
))}
```

### Canvas Type Addition

```ts
// src/types/canvas.ts — add to CardType union:
export type CardType =
  | 'focus' | 'plan' | 'reflect' | 'finance'
  | 'digest' | 'approval' | 'transient' | 'annotation'
  | 'response' | 'group' | 'connectors'
  | 'schedule' | 'deadlines' | 'planner'
  | 'generated' | 'automation'  // ← ADD
```

---

## 13. Animation Specs for Automation Cards

```ts
// Add to src/components/ai/lib/motion.ts:

// Automation card entrance (from AI creation or user save)
export const automationEnterVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 16 },
  show: {
    opacity: 1, scale: 1, y: 0,
    transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] }, // spring
  },
  exit: {
    opacity: 0, scale: 0.92, y: 12,
    transition: { duration: MOTION.normal, ease: MOTION.easeInOut },
  },
}

// Automation executing (test run / live fire)
export const automationPulseVariants: Variants = {
  idle: { boxShadow: '0 0 0px 0px rgba(139,92,246,0)' },
  active: {
    boxShadow: [
      '0 0 0px 0px rgba(139,92,246,0)',
      '0 0 16px 3px rgba(139,92,246,0.15)',
      '0 0 0px 0px rgba(139,92,246,0)',
    ],
    transition: { duration: 1.5, ease: 'easeInOut', repeat: Infinity },
  },
}

// Automation created celebration (brief)
export const automationCreatedVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, rotate: -2 },
  show: {
    opacity: 1, scale: 1, rotate: 0,
    transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] },
  },
}
```

### Visual Sequence

| Event | Animation | Duration | Visual |
|---|---|---|---|
| **AI creates automation** | `automationCreatedVariants` | 400ms | Card scales in with slight rotate, violet glow pulse |
| **User saves from builder** | `automationEnterVariants` | 400ms | Card slides up + fades in |
| **Automation fires (live)** | `automationPulseVariants` | 1.5s loop | Violet glow pulses around card border |
| **Test run executing** | `actionSpinnerVariants` overlay | ∞ | Spinner overlay on card |
| **Automation deleted** | `cardExitVariants` | 250ms | Fade + slide down + scale out |
| **Toggle enable/disable** | `contentUpdateVariants` flash | 600ms | Brief emerald/gray flash on status dot |

---

## 14. CompositionPanel Replacement

```tsx
// src/components/ai/compositions/CompositionPanel.tsx — REWRITTEN

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, Zap } from 'lucide-react'
import { cn } from '../lib/cn'
import { TEXT } from '../tokens'
import { ListTransition } from '../primitives/ListTransition'
import { AutomationCard } from '../automations/AutomationCard'
import { VisualBuilderModal } from '../automations/VisualBuilder/VisualBuilderModal'
import { useAutomationActions } from '../automations/lib/useAutomationActions'
import type { AutomationConfig } from '../../types/automation'

export function CompositionPanel() {
  const [showBuilder, setShowBuilder] = useState(false)
  const { automations, loading, createAutomation, toggleAutomation, deleteAutomation, testRun } = useAutomationActions()

  const handleSaved = async (config: AutomationConfig, dsl: string) => {
    await createAutomation(config)
    setShowBuilder(false)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className={cn("text-[15px] font-semibold", TEXT.primary)}>Automations</h2>
          <p className={cn("text-[11px] mt-0.5", TEXT.muted)}>Visual rules the AI runs for you</p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600/80 hover:bg-violet-500/80 px-4 py-2 text-[12px] font-medium text-white transition-colors"
        >
          <Plus size={14} /> Create Automation
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-zinc-900/30 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-zinc-500">
          <Zap size={36} className="mb-3 opacity-20" />
          <p className="text-[13px]">No automations yet</p>
          <p className="text-[11px] mt-1 text-zinc-600">Ask the AI to create one, or use the visual builder</p>
        </div>
      ) : (
        <ListTransition
          items={automations}
          renderItem={(auto) => (
            <AutomationCard
              data={auto}
              onEdit={() => { /* open builder with existing config */ }}
              onToggle={() => toggleAutomation(auto.ruleId, auto.enabled)}
              onDelete={() => deleteAutomation(auto.ruleId, auto.name)}
              onTestRun={() => testRun(auto.ruleId, auto.name)}
              onDismiss={() => deleteAutomation(auto.ruleId, auto.name)}
            />
          )}
          className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1"
        />
      )}

      {/* Visual Builder Modal */}
      <AnimatePresence>
        {showBuilder && (
          <VisualBuilderModal
            onClose={() => setShowBuilder(false)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
```

---

## 15. File Change Summary

| File | Action | Lines |
|---|---|---|
| `src/types/automation.ts` | CREATE | ~90 |
| `src/types/canvas.ts` | MODIFY (+1 type) | +1 |
| `src/components/ai/automations/AutomationCard.tsx` | CREATE | ~140 |
| `src/components/ai/automations/AutomationList.tsx` | CREATE | ~50 |
| `src/components/ai/automations/VisualBuilder/VisualBuilderModal.tsx` | CREATE | ~160 |
| `src/components/ai/automations/VisualBuilder/StepTrigger.tsx` | CREATE | ~80 |
| `src/components/ai/automations/VisualBuilder/StepConditions.tsx` | CREATE | ~100 |
| `src/components/ai/automations/VisualBuilder/StepAction.tsx` | CREATE | ~65 |
| `src/components/ai/automations/VisualBuilder/StepConfigure.tsx` | CREATE | ~85 |
| `src/components/ai/automations/VisualBuilder/StepReview.tsx` | CREATE | ~110 |
| `src/components/ai/automations/VisualBuilder/BuilderPreview.tsx` | CREATE | ~120 |
| `src/components/ai/automations/data/triggerRegistry.ts` | CREATE | ~180 |
| `src/components/ai/automations/data/actionRegistry.ts` | CREATE | ~100 |
| `src/components/ai/automations/data/operatorMap.ts` | CREATE | ~35 |
| `src/components/ai/automations/lib/dslGenerator.ts` | CREATE | ~80 |
| `src/components/ai/automations/lib/nlParser.ts` | CREATE | ~60 |
| `src/components/ai/automations/lib/useAutomationActions.ts` | CREATE | ~120 |
| `src/components/ai/compositions/CompositionPanel.tsx` | REWRITE | ~80 (replaces 120) |
| `src/components/ai/compositions/CompositionRuleCard.tsx` | DEPRECATE | → replaced by AutomationCard |
| `src/components/ai/compositions/CompositionEditorModal.tsx` | DEPRECATE | → replaced by VisualBuilderModal |
| `src/components/ai/lib/motion.ts` | MODIFY (+3 variants) | +30 |
| `src/pages/AiPage.tsx` | MODIFY (add deck slot, canvas cards, AI parser) | +60 |

**Total new code: ~1,656 lines across 17 new files**
**Total modifications: ~91 lines across 4 existing files**
**Deprecated: 2 files (CompositionRuleCard, CompositionEditorModal)**

---

## 16. Error Handling

| Failure | Detection | Response |
|---|---|---|
| AI returns malformed automation JSON | `JSON.parse` throws | Ignore block, show toast "Couldn't parse automation request" |
| DSL generation produces invalid syntax | `compositions:validate` returns `valid: false` | Show inline error in StepReview, prevent save |
| IPC create fails | Promise rejection | `actionBus.fail()` → ErrorShake on panel + error toast |
| Trigger has no fields (conditions step) | `trigger.fields.length === 0` | Show "This trigger has no filterable fields" message |
| Action params missing required fields | Validation on StepConfigure → StepReview transition | Highlight missing fields in red, block Next |
| Canvas card render fails | Error boundary | Show fallback "Automation failed to render" with dismiss |
| `prefers-reduced-motion` | `useReducedMotion()` | All variants collapse to instant opacity transitions |

---

This system gives the user two paths to create automations: **talk to the AI** (it generates the rule and spawns a card) or **use the visual builder** (5-step wizard, no code). The raw DSL is generated invisibly in the background. Automation cards appear in both Deck and Canvas modes, with full lifecycle animations, and the existing CompositionEngine processes them unchanged.