# Round 02 — Project Owner replies

> Your Q1 analysis is **accepted as correct**, and it changed the plan. Replies below,
> then the REQUEST payload verbatim. You were right to challenge the tool counts.

---

## 0. Q1 — accepted: *rules fire missions*

**Your synthesis is the answer.** "Rules are not missions. Rules fire missions."

I had been treating compile-to-mission as a wholesale alternative. Your point 1 kills that:
*a mission cannot notice that `budget.exceeded` became true.* Something must detect the edge
and decide to fire — that something is the rule engine, and it is Q2's full infrastructure
regardless of what the action lane is. So the rule runner is unavoidable; the only real
decision is its **action executor**. That reframe is correct and I am adopting it.

Your three supporting arguments all land, and one of them is now **empirically decisive** —
see §3.

---

## 1. Your questions, answered

### Q1 — runner location / tool dispatch

**Worse than you assumed, and this is the single most important fact in this round.**

```ts
// src/services/ai/toolRegistry.ts:4
const api = (window as any).deskflowAPI
```

The tool registry is **hard-wired to the renderer's `window` object**. Every one of the 90
tool handlers is a thin wrapper that calls `api.*`:

```ts
r('getGoals', 'Get goals for a specific date', { date: p('string', …) }, 'read', 'goals',
  async () => {
    const gate = await checkAccess('goals');
    if (!gate.allowed) return { _privacy: true, message: gate.message };
    return api.getGoals(p.date);          // <-- window.deskflowAPI
  })
```

and that resolves through preload to IPC:

```ts
// src/preload.ts:1508
getGoals: (date: string) => ipcRenderer.invoke('get-goals', date),
```

**Answer to your actual question: the main-side handler bodies are inline `ipcMain.handle`
closures — 629 of them in `src/main.ts`. There are zero extracted `handleGetGoals`-style
functions** (I checked for `^function handleGetGoals` / `^const handleGetGoals` /
`^async function handleGetGoals`: 0 hits).

**Consequence, and it is the one I need you to design around:**

A main-process automation runner **cannot call `toolRegistry.execute()` at all** — it would
throw on `window is not defined`. And it cannot reach the main-side implementations through
the registry, because they do not exist as callable units; they are closure bodies.

So the tool lane has exactly three real options, and this is now the pivotal fork:

- **(a) Extract.** Mechanically pull handler bodies out of the 629 closures into named
  functions, have `ipcMain.handle` reference them, and give the runner a dispatch table.
  Cost: a large, risky, cross-cutting refactor of `src/main.ts` (31k lines).
- **(b) Mirror.** Give the runner its own dispatch table for the 8 actions the catalogue
  actually has (§3). Cheap, but duplicates logic and can drift from the closures.
- **(c) Route through IPC.** Impossible when no renderer exists — which is precisely the
  always-on case `rheo-tracker` exists to cover.

Which do you want, and does it change your lane split?

### Q2 — the counts. **You were right, and my number was wrong.**

Re-counted properly, matching each `r('name', …)` call site to the first
`'read'|'confirm'|'destructive'` before the next call site:

```
registration call sites : 90
unique names            : 90
duplicated names        : none
with a securityLevel    : 90
    confirm             : 49
    read                : 41
    destructive         :  0
```

**The `42 / 51` I gave you was wrong.** Those were raw string occurrences in the file
*including comments and prose* — not registration records. The real distribution is
**41 read / 49 confirm / 0 destructive**. Good catch; a security policy built on my number
would have been built on noise.

### Q3 — is there compilation precedent? **Yes. This is the most useful thing you learned.**

`conductor:engineer-workflow` already performs the compile step you want:

```ts
ipcMain.handle('conductor:engineer-workflow', async (_event, objective: string, templateId?: string) => {
  const template = templateId ? db?.prepare('SELECT * FROM conductor_templates WHERE id = ?').get(templateId) : null;
  const defaultRoles = [
    { role: 'director', canSpawnChildren: true,  maxDepth: 2, maxChildren: 3, fileAccess: 'read',  terminalAccess: … },
    { role: 'planner',  canSpawnChildren: false, maxDepth: 0, maxChildren: 0, fileAccess: 'read',  terminalAccess: … },
    { role: 'worker',   canSpawnChildren: false, maxDepth: 0, maxChildren: 0, fileAccess: 'write', terminalAccess: … },
    { role: 'worker',   canSpawnChildren: false, maxDepth: 0, maxChildren: 0, fileAccess: 'write', terminalAccess: … },
    { role: 'qa',       canSpawnChildren: false, maxDepth: 0, maxChildren: 0, fileAccess: 'read',  terminalAccess: … },
  ];
  let boundaries = ['src/**/*', 'tests/**/*', 'package.json'];
  if (template) {
    roles      = JSON.parse(template.roles_json      || '[]').map(…);
    boundaries = JSON.parse(template.boundaries_json || '[]');
  }
  roles = roles.map((r) => ({
    ...r,
    budgetTokens:    r.budgetTokens    || 50000,
    customName:      r.customName      || r.role,
    canSpawnChildren:r.canSpawnChildren?? (r.role === 'director'),
    fileAccess:      r.fileAccess      || (r.role === 'worker' ? 'write' : 'read'),
    …
  }));
  …
})
```

So: **objective + template → role graph → `conductor:start`.** Your mission-lane compiler
has an in-repo pattern to imitate rather than invent. Note what it does *not* do: it does not
decide autonomy from the objective, and it does not gate unattended approval. Both of those
remain yours to design.

---

## 2. One correction to your Q2 lean

You wrote that emission should be typed (~15–20 events). I agree — and there is a precedent
you should have: the trigger catalogue's `id`s are **not** all domain events. My earlier
paste conflated three different namespaces, which you correctly flagged. Disambiguation is
in §3.

---

## 3. The action catalogue — 8 actions, and they decide your lane split

The action side of the builder is `src/components/ai/automations/data/actionRegistry.ts`:

```ts
export interface ActionDef {
  id: string          // "notify", "goal:create", etc.
  label: string
  description: string
  icon: ComponentType<{ size?: number | string; style?: CSSProperties }>
  params: ActionParam[]
}
```

**Complete inventory — all 8:**

```
notify          goal:create      goal:complete   schedule:add
deadline:add    email:send       calendar:create  log
```

Every one is a **single, fully-bound call**: the params are declared in the catalogue and
frozen at design time. There is not one objective-shaped action.

**Therefore: today the lane split is 8/0 — 100% tool lane, 0% mission lane.** Your
degenerate-mission argument applies to the *entire current catalogue*. The mission lane only
earns its keep for actions CZ has not specified yet (`note.created → summarize and link to
relevant goals`), which is exactly what CZ's sentence describes.

That also means your rising-edge insight in Q2 is the live one: if the lane is all-bound
calls, then matching is the whole problem, and threshold predicates
(`goal.progress gt 50`) need persisted previous-satisfaction state or they fire on every
event while the level holds.

---

## 4. The REQUEST — verbatim

You asked for one thing and I am sending only that.

### `StepAction.tsx`

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
              "bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 hover:ring-zinc-700",
              selected?.name === action.id && "ring-2 ring-emerald-500/50 bg-emerald-500/5"
            )}
          >
            <action.icon size={20} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <span className={cn("text-[12px] font-medium block", TEXT.primary)}>{action.label}</span>
              <span className={cn("text-[10px] leading-tight", TEXT.muted)}>{action.description}</span>
              <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] text-zinc-500 light:text-[var(--text-muted)]">
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

### `StepConfigure.tsx`

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import type { ActionSelection } from '../../../types/automation'

interface StepConfigureProps {
  action: ActionSelection | null
  params: Record<string, string | number | boolean>
  onParamsChange: (params: Record<string, string | number | boolean>) => void
}

export function StepConfigure({ action, params, onParamsChange }: StepConfigureProps) {
  const reduce = useReducedMotion()

  if (!action) return <p className="text-[12px] text-zinc-500 light:text-[var(--text-muted)]">Select an action first.</p>

  const update = (name: string, value: string | number | boolean) => {
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
            <label className="block text-[11px] text-zinc-400 light:text-[var(--text-muted)] mb-1">
              {param.label}{param.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {param.type === 'select' ? (
              <select
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 light:text-[var(--text-secondary)] ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
              >
                <option value="">Select…</option>
                {param.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : param.type === 'date' ? (
              <input
                type="datetime-local"
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 light:text-[var(--text-secondary)] ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
              />
            ) : param.name === 'message' || param.name === 'body' ? (
              <textarea
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                placeholder={param.placeholder}
                rows={3}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 light:text-[var(--text-muted)] resize-none"
              />
            ) : (
              <input
                type={param.type === 'number' ? 'number' : 'text'}
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={param.placeholder}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 light:text-[var(--text-muted)]"
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
```

### `StepReview.tsx`

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
  validationErrors?: string[]
}

export function StepReview({ config, onNameChange, onLifecycleChange, onPriorityChange, onCategoryChange, onEnabledChange, validationErrors }: StepReviewProps) {
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

      {/* Validation errors (from the engine's lex → parse → scope chain) */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/30 p-4 space-y-1">
          <p className="text-[11px] font-semibold text-red-300">The rule could not be validated — fix the settings below and try saving again:</p>
          {validationErrors.map((err, i) => (
            <p key={i} className="text-[11px] text-red-300/80 font-mono break-words">{err}</p>
          ))}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-[11px] text-zinc-400 light:text-[var(--text-muted)] mb-1">Automation Name<span className="text-red-400 ml-0.5">*</span></label>
        <input
          value={config.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Boss email alert"
          className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 light:text-[var(--text-muted)]"
        />
      </div>

      {/* Lifecycle */}
      <div>
        <label className="block text-[11px] text-zinc-400 light:text-[var(--text-muted)] mb-1">Lifecycle</label>
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
        <label className="block text-[11px] text-zinc-400 light:text-[var(--text-muted)] mb-1">Priority: {config.priority}</label>
        <input
          type="range" min={1} max={1000} value={config.priority}
          onChange={e => onPriorityChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-[11px] text-zinc-400 light:text-[var(--text-muted)] mb-1">Category</label>
        <select
          value={config.category}
          onChange={e => onCategoryChange(e.target.value)}
          className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 light:text-[var(--text-secondary)] ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
        >
          {['general', 'work', 'personal', 'finance', 'productivity'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-zinc-300 light:text-[var(--text-secondary)]">Enable immediately</span>
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

### `actionRegistry.ts`

```ts
import { Bell, Target, Calendar, Clock, Mail, FileText, CheckCircle } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { ActionParam } from '../../../types/automation'

export interface ActionDef {
  id: string              // "notify", "goal:create", etc.
  label: string
  description: string
  icon: ComponentType<{ size?: number | string; style?: CSSProperties }>
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

### `triggerRegistry.ts`

```ts
import { BookOpen, Code, Monitor, DollarSign, Clock, Target } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { TriggerField } from '../../../types/automation'
import type { DataSourceName } from '../../../domains/compositions/compositionTypes'

export interface TriggerDef {
  id: string                    // "finance.transaction.created"
  source: DataSourceName
  event: string
  label: string
  description: string
  icon: ComponentType<{ size?: number | string; style?: CSSProperties }>
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

### `types-automation.ts`

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
```

### `VisualBuilderModal.tsx`

```tsx
import { useState, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Sparkles, Save } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { dialogVariants } from '../../lib/motion'
import { StepTrigger } from './StepTrigger'
import { StepConditions } from './StepConditions'
import { StepAction } from './StepAction'
import { StepConfigure } from './StepConfigure'
import { StepReview } from './StepReview'
import { BuilderPreview } from './BuilderPreview'
import { generateDsl } from '../lib/dslGenerator'
import { validateDsl } from '../lib/useAutomationActions'
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
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Builder state
  const [name, setName] = useState(initialConfig?.name ?? '')
  const [trigger, setTrigger] = useState<TriggerSelection | null>(initialConfig?.trigger ?? null)
  const [conditions, setConditions] = useState<ConditionRow[]>(initialConfig?.conditions ?? [])
  const [conditionLogic, setConditionLogic] = useState<'and' | 'or'>(initialConfig?.conditionLogic ?? 'and')
  const [action, setAction] = useState<ActionSelection | null>(initialConfig?.action ?? null)
  const [actionParams, setActionParams] = useState<Record<string, string | number | boolean>>(initialConfig?.actionParams ?? {})
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
    setValidationErrors([])

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

    // Gate the save on the engine's own validation chain (lex → parse → scope).
    const report = await validateDsl(dsl, config.name)
    if (!report.valid) {
      setValidationErrors(report.errors.length > 0 ? report.errors : ['The generated rule could not be validated.'])
      setSaving(false)
      return
    }

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 light:border-[var(--ws-border)]">
          <div className="flex items-center gap-3">
            <Sparkles size={16} className="text-violet-400" />
            <h2 className={cn("text-[14px] font-semibold", TEXT.primary)}>Create Automation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 light:text-[var(--text-muted)] hover:text-zinc-300 light:text-[var(--text-secondary)] hover:bg-zinc-800 light:bg-[var(--ws-surface-sunken)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800/40 light:border-[var(--ws-border)]">
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
              {step === 5 && <StepReview key="s5" config={{ name, trigger: trigger!, conditions, conditionLogic, action: action!, actionParams, lifecycle, priority, category, enabled }} onNameChange={setName} onLifecycleChange={setLifecycle} onPriorityChange={setPriority} onCategoryChange={setCategory} onEnabledChange={setEnabled} validationErrors={validationErrors} />}
            </AnimatePresence>
          </div>

          {/* Right: Live Preview */}
          <div className="flex-[2] min-h-0 border-l border-zinc-800/40 light:border-[var(--ws-border)] p-6 overflow-y-auto">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/60 light:border-[var(--ws-border)]">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] text-zinc-400 light:text-[var(--text-muted)] hover:text-zinc-200 hover:bg-zinc-800 light:bg-[var(--ws-surface-sunken)] transition-colors">
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] text-zinc-400 light:text-[var(--text-muted)] hover:text-zinc-200 hover:bg-zinc-800 light:bg-[var(--ws-surface-sunken)] transition-colors">
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

### `legacy-triggerRegistry.ts`

```ts
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
```

---

## 5. What I need next

1. **Your verdict on §1 Q1's fork** — extract (a), mirror (b), or something else. This is
   now the pivotal decision and it is yours.
2. **The lane-split criterion**, pinned to the 8 real ids in §3.
3. Full Q2 design, now that you know emission is typed and matching is generic.

Still queued, not yet requested — say when you want them:

- `ConductorService.start()` + the Mission / SessionSpec / template shapes, to confirm a
  **single-node, terminal-less** mission is representable. Your single-node claim depends on
  this and I have not confirmed it.
- `conductor:set-autonomy` handler, to establish **what L2 actually gates** — you flagged
  this yourself and I still owe you the answer.
- The NL parser, for authoring ergonomics only.
