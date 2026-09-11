# CONTEXT BUNDLE — Composition UI Redesign

> Target AI: The existing Compositions system has a DSL engine but no human-friendly UI.
> Design a visual, AI-native automation builder that replaces the raw DSL editor.

---

## 1. DSL Engine Types (EXACT SOURCE)

### `src/domains/compositions/compositionTypes.ts` (lines 1-190)

```ts
export interface CompositionManifest {
  id: string; name: string; description?: string; version: number; enabled: boolean;
  priority: number; category: string; tags: string[];
  lifecycle: 'forever' | 'once' | 'schedule' | 'manual';
  schedule?: string; conditions?: ComposedCondition; actions: ComposedAction[];
  metadata?: Record<string, string>; createdAt: string; updatedAt: string;
}
export interface ComposedCondition { operator: 'and' | 'or' | 'not'; conditions: (ComposedCondition | AtomicCondition)[] }
export interface AtomicCondition { type: string; field: string; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'matches' | 'exists' | 'not_exists'; value: any }
export interface ComposedAction { id: string; action: string; params: Record<string, any>; fallback?: ComposedAction[]; errorHandling?: 'abort' | 'continue' | 'fallback' }
export type TokenType = 'WHEN' | 'IF' | 'THEN' | 'ELSE' | 'AND' | 'OR' | 'NOT' | 'ON' | 'EVERY' | 'DO' | 'LET' | 'AS' | 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DOT' | 'COMMA' | 'COLON' | 'ARROW' | 'PIPE' | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET' | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'NEWLINE' | 'EOF' | 'ERROR'
export interface Token { type: TokenType; value: string; line: number; col: number }
export type ASTNode = CompositionRule | ConditionClause | ActionBlock | EventPattern | SchedulePattern | BindingDeclaration | ExpressionNode | LiteralNode | IdentifierNode
export interface CompositionRule { kind: 'rule'; trigger?: EventPattern; schedule?: SchedulePattern; conditions: ConditionClause; actions: ActionBlock; bindings?: BindingDeclaration[] }
export interface EventPattern { kind: 'event'; source: string; eventName: string; filters?: ConditionClause }
export interface SchedulePattern { kind: 'schedule'; cron: string; timezone?: string }
export interface ConditionClause { kind: 'condition'; operator: 'and' | 'or' | 'not'; operands: (ConditionClause | ExpressionNode)[] }
export interface ActionBlock { kind: 'actions'; items: ActionItem[] }
export interface ActionItem { kind: 'action'; name: string; params: Record<string, ExpressionNode>; fallback?: ActionItem[] }
export interface BindingDeclaration { kind: 'binding'; name: string; source: string; transform?: string }
export interface ExpressionNode { kind: 'expr'; operator: string; left: ExpressionNode | LiteralNode | IdentifierNode; right: ExpressionNode | LiteralNode | IdentifierNode }
export interface LiteralNode { kind: 'literal'; type: 'string' | 'number' | 'boolean' | 'null'; value: any }
export interface IdentifierNode { kind: 'identifier'; name: string; path?: string[] }
export interface EventBusEvent { topic: string; source: string; payload: any; timestamp: string; dedupeKey?: string; ttlMs?: number }
export interface SafeQuery { table: string; columns: string[]; where?: Record<string, any>; orderBy?: { column: string; dir: 'ASC' | 'DESC' }; limit?: number }
export interface ScopeReport { manifestId: string; valid: boolean; errors: ScopeError[]; warnings: ScopeWarning[]; suggestedFix?: string }
export interface ScopeError { line: number; col: number; message: string; code: string }
export interface ScopeWarning { line: number; col: number; message: string }
export interface ExecutionResult { ruleId: string; actionId: string; action: string; status: 'pending' | 'running' | 'success' | 'failure' | 'skipped' | 'error'; startedAt: string; completedAt?: string; durationMs?: number; result?: any; error?: string }
export type DataSourceName = 'finance' | 'focus' | 'goals' | 'learning' | 'ide' | 'system'
export interface DataAdapter { name: DataSourceName; safeQuery: (query: SafeQuery) => any[]; listEvents: () => string[]; subscribe: (topic: string, handler: (event: EventBusEvent) => void) => () => void }
```

---

## 2. Current Composition Panel (EXACT SOURCE)

### `src/components/ai/compositions/CompositionPanel.tsx` (120 lines)

```tsx
import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus, FileCode } from 'lucide-react'
import type { CompositionRule, ExecutionStatus, ExecutionLog } from './types'
import { CompositionRuleCard } from './CompositionRuleCard'
import { CompositionEditorModal } from './CompositionEditorModal'
import { CompositionHistoryDrawer } from './CompositionHistoryDrawer'
import { actionBus } from '../lib/actionBus'

const API = (window as any).deskflowAPI

export function CompositionPanel() {
  const [rules, setRules] = useState<CompositionRule[]>([])
  const [statuses, setStatuses] = useState<Map<string, ExecutionStatus>>(new Map())
  const [history, setHistory] = useState<ExecutionLog[]>([])
  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<CompositionRule | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([API?.compositionsList(), API?.compositionsStatus()])
      if (r) setRules(r)
      if (s) { const m = new Map<string, ExecutionStatus>(); s.forEach((row: any) => m.set(row.rule_id, row)); setStatuses(m) }
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const loadHistory = async (ruleId?: string) => {
    try { const h = await API?.compositionsHistory(ruleId || null, 50); if (h) setHistory(h) } catch { setHistory([]) }
  }

  const evaluate = async (id: string) => {
    const actionId = `comp-eval-${id}`
    actionBus.start(actionId, 'composition-evaluate', 'Evaluating rule')
    setRunningId(id)
    try { await API?.compositionsEvaluate(id, {}); await loadHistory(id); await load(); actionBus.complete(actionId) }
    catch (e: any) { actionBus.fail(actionId, e.message) }
    setRunningId(null)
  }

  const remove = async (id: string) => {
    const actionId = `comp-del-${id}`
    actionBus.start(actionId, 'composition-delete', 'Deleting rule')
    try { await API?.compositionsDelete(id); await load(); actionBus.complete(actionId) }
    catch { actionBus.fail(actionId) }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-medium text-white">Compositions</h1>
          <p className="text-sm text-zinc-500 mt-0.5">DSL-driven automation rules</p>
        </div>
        <button onClick={() => { setEditingRule(null); setShowEditor(true) }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <FileCode className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No composition rules yet</p>
            <p className="text-xs mt-1">Create rules with the DSL engine to automate workflows</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <CompositionRuleCard key={rule.id} rule={rule} status={statuses.get(rule.id)} isRunning={runningId === rule.id}
                onEdit={() => { setEditingRule(rule); setShowEditor(true) }} onEvaluate={() => evaluate(rule.id)}
                onDelete={() => remove(rule.id)} onHistory={() => { loadHistory(rule.id); setShowHistory(true) }} />
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {showEditor && <CompositionEditorModal rule={editingRule} onClose={() => setShowEditor(false)} onSaved={() => { setShowEditor(false); load() }} />}
      </AnimatePresence>
      <AnimatePresence>
        {showHistory && <CompositionHistoryDrawer history={history} onClose={() => setShowHistory(false)} />}
      </AnimatePresence>
    </div>
  )
}
```

---

## 3. Current Rule Card (EXACT SOURCE)

### `src/components/ai/compositions/CompositionRuleCard.tsx` (81 lines)

```tsx
import { motion } from 'framer-motion'
import { Play, Pencil, Trash2, RotateCcw, AlertCircle, Loader2 } from 'lucide-react'
import type { CompositionRule, ExecutionStatus } from './types'
import { statusBadgePulse, compositionExecuteVariants } from '../lib/motion'
import { useReducedMotion } from 'framer-motion'

interface CompositionRuleCardProps {
  rule: CompositionRule; status?: ExecutionStatus; isRunning?: boolean
  onEdit: () => void; onEvaluate: () => void; onDelete: () => void; onHistory: () => void
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-zinc-400 bg-zinc-800', success: 'text-emerald-400 bg-emerald-500/10',
  failure: 'text-red-400 bg-red-500/10', error: 'text-red-400 bg-red-500/10',
  skipped: 'text-amber-400 bg-amber-500/10', running: 'text-blue-400 bg-blue-500/10',
  active: 'text-emerald-400 bg-emerald-500/10',
}

export function CompositionRuleCard({ rule, status, isRunning, onEdit, onEvaluate, onDelete, onHistory }: CompositionRuleCardProps) {
  const reduce = useReducedMotion()
  const sc = STATUS_COLORS[status?.last_status || ''] || STATUS_COLORS.idle
  return (
    <motion.div layout variants={compositionExecuteVariants} initial="idle" animate={isRunning ? 'execute' : 'idle'}
      className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-white truncate">{rule.name}</h3>
            {status && <motion.span variants={statusBadgePulse} animate={reduce ? {} : 'pulse'} className={`text-xs px-2 py-0.5 rounded-full ${sc}`}>{status.last_status}</motion.span>}
            {rule.enabled ? <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Enabled</span> : <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">Disabled</span>}
          </div>
          {rule.description && <p className="text-xs text-zinc-500 mt-1 truncate">{rule.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
            <span>v{rule.version}</span><span>{rule.category}</span><span>{rule.lifecycle}</span>
            {rule.schedule_cron && <span className="font-mono">{rule.schedule_cron}</span>}<span>Priority: {rule.priority}</span>
          </div>
          {status && status.consecutive_failures > 0 && <div className="flex items-center gap-1 mt-1 text-[10px] text-red-400"><AlertCircle className="w-3 h-3" />{status.consecutive_failures} failure(s)</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-4">
          <button onClick={onEvaluate} disabled={isRunning} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">{isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}</button>
          <button onClick={onEdit} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onHistory} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </motion.div>
  )
}
```

---

## 4. Composition Types (for panel)

### `src/components/ai/compositions/types.ts`

```ts
export interface CompositionRule {
  id: string; name: string; description: string | null; dsl_source: string;
  version: number; enabled: number; priority: number; category: string;
  lifecycle: string; schedule_cron: string | null; created_at: string; updated_at: string;
}
export interface ExecutionStatus {
  rule_id: string; last_status: string; last_error: string | null;
  consecutive_failures: number; last_run_at: string | null;
}
export interface ExecutionLog {
  id: number; rule_id: string; action_name: string; status: string;
  result: string | null; error: string | null; duration_ms: number | null;
  started_at: string; completed_at: string | null;
}
```

---

## 5. Canvas Types (for automation card)

### `src/types/canvas.ts` (lines 1-80)

```ts
export type CardType =
  | 'focus' | 'plan' | 'reflect' | 'finance'
  | 'digest' | 'approval' | 'transient' | 'annotation'
  | 'response' | 'group' | 'connectors'
  | 'schedule' | 'deadlines' | 'planner'
  | 'generated'

export type CardStatus = 'live' | 'stale' | 'error' | 'loading'

export const GROUP_COLORS = [
  { id: 'violet', label: 'Violet', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', accent: '#8b5cf6' },
  { id: 'blue', label: 'Blue', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', accent: '#3b82f6' },
  { id: 'emerald', label: 'Emerald', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', accent: '#10b981' },
  { id: 'amber', label: 'Amber', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', accent: '#f59e0b' },
  { id: 'rose', label: 'Rose', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.35)', accent: '#f43f5e' },
  { id: 'cyan', label: 'Cyan', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.35)', accent: '#06b6d4' },
  { id: 'pink', label: 'Pink', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.35)', accent: '#ec4899' },
  { id: 'slate', label: 'Slate', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.35)', accent: '#64748b' },
] as const

export interface CanvasCard {
  id: string; type: CardType; position: { x: number; y: number }; size: { w: number; h: number };
  zIndex: number; pinned: boolean; data: Record<string, any>; source: 'ai' | 'user' | 'system';
  status: CardStatus; createdAt: number; dismissedAt?: number; groupId?: string
}

export interface CanvasGroup {
  id: string; label: string; colorId: typeof GROUP_COLORS[number]['id']; cardIds: string[];
  position: { x: number; y: number }; size: { w: number; h: number }; createdAt: number;
  orientation?: 'vertical' | 'horizontal'; ratio?: number
}

export interface CanvasState {
  cards: Record<string, CanvasCard>; groups: Record<string, CanvasGroup>;
  nextZIndex: number; pan: { x: number; y: number }; zoom: number
}
```

---

## 6. IPC Endpoints (already exist)

### Preload bridge
```ts
compositionsList: () => ipcRenderer.invoke('compositions:list'),
compositionsGet: (id: string) => ipcRenderer.invoke('compositions:get', id),
compositionsCreate: (data: any) => ipcRenderer.invoke('compositions:create', data),
compositionsUpdate: (id: string, data: any) => ipcRenderer.invoke('compositions:update', id, data),
compositionsDelete: (id: string) => ipcRenderer.invoke('compositions:delete', id),
compositionsCompile: (id: string) => ipcRenderer.invoke('compositions:compile', id),
compositionsValidate: (dsl: string, name: string) => ipcRenderer.invoke('compositions:validate', dsl, name),
compositionsEvaluate: (id: string, ctx: any) => ipcRenderer.invoke('compositions:evaluate', id, ctx),
compositionsHistory: (id: string | null, limit: number) => ipcRenderer.invoke('compositions:history', id, limit),
compositionsStatus: () => ipcRenderer.invoke('compositions:status'),
```

### Backend handlers (main.ts)
```ts
ipcMain.handle('compositions:list', () => db.prepare('SELECT * FROM composition_rules ORDER BY priority ASC').all())
ipcMain.handle('compositions:create', (_e, data) => { /* INSERT INTO composition_rules */ })
ipcMain.handle('compositions:update', (_e, id, data) => { /* UPDATE composition_rules */ })
ipcMain.handle('compositions:delete', (_e, id) => { /* DELETE FROM composition_rules */ })
ipcMain.handle('compositions:validate', (_e, dsl, name) => { /* lex → parse → scopeCheck */ })
ipcMain.handle('compositions:evaluate', async (_e, id, ctx) => { /* service.evaluateRule */ })
```

---

## 7. Design Tokens

### `src/components/ai/tokens.ts` (lines 91-109)

```ts
export const MOTION = {
  fast: 0.15, normal: 0.25, slow: 0.4,
  ease: [0.16, 1, 0.3, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
  stagger: 0.05,
} as const

export const ACCENT = {
  pink:    { hex: '#f472b6', text: 'text-pink-300', pill: 'bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20' },
  emerald: { hex: '#10b981', text: 'text-emerald-300', pill: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20' },
  amber:   { hex: '#f59e0b', text: 'text-amber-300', pill: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20' },
  violet:  { hex: '#a78bfa', text: 'text-violet-300', pill: 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20' },
  red:     { hex: '#f87171', text: 'text-red-300', pill: 'bg-red-500/10 text-red-300 ring-1 ring-red-500/20' },
  cyan:    { hex: '#22d3ee', text: 'text-cyan-300', pill: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20' },
}

export type ActionType = 'goal-toggle' | 'goal-add' | 'schedule-add' | 'deadline-add' | 'email-send' | 'composition-create' | 'composition-evaluate' | 'ai-generate'
```

---

## 8. AiPage Integration Points

### Top bar mode toggle (AiPage.tsx lines 1256-1265)
```tsx
<button onClick={() => setCanvasMode(v => v === 'canvas' ? 'deck' : v === 'deck' ? 'compositions' : 'canvas')}>
  {canvasMode === 'canvas' ? 'CANVAS' : canvasMode === 'deck' ? 'DECK' : 'COMPS'}
</button>
```

### Conditional render (AiPage.tsx lines 1302-1306)
```tsx
{canvasMode === 'compositions' ? (
  <div style={{ flex: 1, minHeight: 0, padding: 20 }}>
    <CompositionPanel />
  </div>
) : canvasMode === 'deck' ? (
  <AiPageDeck ... />
) : (
  <div ...><CanvasContainer ... /></div>
)}
```

---

## 9. Available Triggers (from data adapters)

### Finance Adapter
- `transaction.created` — fields: amount, category, description, wallet
- `transaction.updated` — fields: amount, category, description
- `account.created` — fields: name, type, balance

### Focus Adapter
- `session.started` — fields: app, category
- `session.ended` — fields: app, category, duration, productive
- `session.paused` — fields: app, duration

### Goals Adapter
- `goal.created` — fields: title, category, period
- `goal.completed` — fields: title, category, completedAt
- `goal.deleted` — fields: title, category

### Learning Adapter
- `lesson.completed` — fields: title, score
- `quiz.passed` — fields: title, score, passingScore

### IDE Adapter
- `project.opened` — fields: name, language
- `commit.made` — fields: message, filesChanged

### System Adapter
- `app.started` — fields: version
- `app.idle` — fields: idleDuration
- `app.resumed` — fields: suspendDuration

---

## 10. Available Actions (from composition engine + toolRegistry)

| Action | Params | Description |
|--------|--------|-------------|
| `notify` | message: string | Show desktop notification |
| `goal:create` | title: string, category: string | Create a new goal |
| `goal:complete` | title: string | Mark a goal as done |
| `schedule:add` | title: string, day: number, start: string, end: string | Add schedule entry |
| `deadline:add` | title: string, dueDate: string, priority: string | Create deadline |
| `email:send` | to: string, subject: string, body: string | Send email |
| `calendar:create` | title: string, start: string, end: string | Create calendar event |
| `log` | message: string, level: string | Write to log |
