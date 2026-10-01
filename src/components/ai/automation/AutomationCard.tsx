import { motion } from 'framer-motion'
import { Play, Pencil, Trash2, RotateCcw, Zap, CalendarClock, AlertCircle, Loader2, MessageSquare, ListTree, Network, Timer, Terminal } from 'lucide-react'
import type { CompositionRule, ExecutionStatus } from '../compositions/types'
import { lex } from '../../../domains/compositions/compositionLexer'
import { parse } from '../../../domains/compositions/compositionParser'
import { itemVariants } from '../lib/motion'

interface AutomationCardProps {
  rule: CompositionRule
  status?: ExecutionStatus
  isRunning?: boolean
  onEdit: () => void
  onEvaluate: () => void
  onDelete: () => void
  onHistory: () => void
  onToggle: (enabled: boolean) => void
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'text-zinc-400 bg-zinc-800',
  success: 'text-emerald-400 bg-emerald-500/10',
  failure: 'text-red-400 bg-red-500/10',
  error: 'text-red-400 bg-red-500/10',
  skipped: 'text-amber-400 bg-amber-500/10',
  running: 'text-blue-400 bg-blue-500/10',
  active: 'text-emerald-400 bg-emerald-500/10',
}

const ACTION_ICONS: Record<string, any> = {
  notify: MessageSquare, log: ListTree, query: Network, http: Zap, sleep: Timer, exec: Terminal,
}

function parseDsl(dsl: string): { trigger: string; conditions: string[]; actions: { name: string; params: string }[] } {
  try {
    const ast = parse(lex(dsl))
    const rule = ast[0] as any
    if (!rule) return { trigger: '—', conditions: [], actions: [] }
    let trigger = '—'
    if (rule.trigger) trigger = `on ${rule.trigger.source}.${rule.trigger.eventName}`
    else if (rule.schedule) trigger = `every ${rule.schedule.cron}`
    const conditions: string[] = []
    const nodeText = (n: any): string => {
      if (!n) return ''
      if (n.kind === 'identifier') return n.path ? n.path.join('.') : (n.name || '')
      if (n.kind === 'literal') return String(n.value)
      if (n.kind === 'expr') return `${nodeText(n.left)} ${n.operator} ${nodeText(n.right)}`
      return ''
    }
    const walk = (c: any) => {
      if (!c) return
      for (const op of c.operands || []) {
        if (op?.kind === 'condition') walk(op)
        else if (op?.kind === 'expr') conditions.push(nodeText(op))
      }
    }
    walk(rule.conditions)
    const actions = (rule.actions?.items || []).map((a: any) => {
      const params = Object.entries(a.params || {}).map(([k, v]: any) => `${k}=${nodeText(v)}`).join(', ')
      return { name: a.name, params }
    })
    return { trigger, conditions, actions }
  } catch {
    const evt = dsl.match(/on\s+([a-z.]+)/i)?.[1]
    const sch = dsl.match(/every\s+([\d\w ]+?)\s+do/i)?.[1]
    const trigger = evt ? `on ${evt}` : sch ? `every ${sch}` : '—'
    const conds = (dsl.match(/(?:^|\s)([a-z_]+)\s*(==|!=|>=|<=|>|<)\s*([^ ]+)/gi) || []).map(c => c.trim())
    const act = (dsl.match(/(?:^|\s)([a-z]+):/gi) || []).map(a => a.trim().slice(0, -1))
    return { trigger, conditions: conds, actions: act.map(name => ({ name, params: '' })) }
  }
}

export function AutomationCard({ rule, status, isRunning, onEdit, onEvaluate, onDelete, onHistory, onToggle }: AutomationCardProps) {
  const sc = STATUS_COLORS[status?.last_status || ''] || STATUS_COLORS.idle
  const parsed = parseDsl(rule.dsl_source)

  return (
    <motion.div
      layout
      variants={itemVariants}
      className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(34,211,238,0.10)] hover:border-[rgba(34,211,238,0.25)] rounded-xl p-5 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-sm font-medium text-white truncate">{rule.name || 'Untitled automation'}</h3>
            {status && <span className={`text-[10px] px-2 py-0.5 rounded-full ${sc}`}>{status.last_status}</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="flex items-center gap-1.5 text-[11px] text-cyan-300 bg-cyan-500/10 ring-1 ring-cyan-500/20 rounded-full px-2.5 py-1 font-mono">
              {rule.schedule_cron ? <CalendarClock className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {parsed.trigger}
            </span>
            {parsed.conditions.map((c, i) => (
              <span key={i} className="text-[11px] text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-full px-2.5 py-1 font-mono">
                {c}
              </span>
            ))}
            {parsed.actions.map((a, i) => {
              const Icon = ACTION_ICONS[a.name] || Zap
              return (
                <span key={i} className="flex items-center gap-1 text-[11px] text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/20 rounded-full px-2.5 py-1 font-mono">
                  <Icon className="w-3 h-3" />
                  {a.name}
                  {a.params ? <span className="text-violet-400/70">({a.params})</span> : null}
                </span>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-500 light:text-stone-500">
            <span>v{rule.version}</span>
            <span>{rule.category}</span>
            <span>{rule.lifecycle}</span>
            <span>Priority {rule.priority}</span>
            {status && status.consecutive_failures > 0 && (
              <span className="flex items-center gap-1 text-red-400"><AlertCircle className="w-3 h-3" />{status.consecutive_failures} failures</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-[10px] ${rule.enabled ? 'text-cyan-400' : 'text-zinc-600'}`}>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
            <button
              role="switch"
              aria-checked={!!rule.enabled}
              onClick={() => onToggle(!rule.enabled)}
              className={`w-8 h-[18px] rounded-full transition-colors relative ${rule.enabled ? 'bg-cyan-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-[2px] w-3.5 h-3.5 bg-white rounded-full transition-transform ${rule.enabled ? 'left-[16px]' : 'left-[2px]'}`} />
            </button>
          </label>
          <div className="flex items-center gap-1">
            <button onClick={onEvaluate} disabled={isRunning} className="p-2 rounded-lg text-zinc-400 light:text-stone-500 hover:text-white hover:bg-zinc-800 light:hover:bg-stone-200 transition-colors" title="Run now">
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onEdit} className="p-2 rounded-lg text-zinc-400 light:text-stone-500 hover:text-white hover:bg-zinc-800 light:hover:bg-stone-200 transition-colors" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onHistory} className="p-2 rounded-lg text-zinc-400 light:text-stone-500 hover:text-white hover:bg-zinc-800 light:hover:bg-stone-200 transition-colors" title="History">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg text-zinc-400 light:text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function AutomationListEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-500 light:text-stone-500 py-16">
      <div className="w-14 h-14 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 flex items-center justify-center mb-4">
        <Zap className="w-6 h-6 text-cyan-400" />
      </div>
      <p className="text-sm text-zinc-300 light:text-stone-400">No automations yet</p>
      <p className="text-xs mt-1 max-w-[260px] text-center">Build one visually, or describe it in plain language and the AI will wire it up.</p>
      <button onClick={onCreate} className="mt-5 flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm transition-colors">
        <Zap className="w-4 h-4" /> New Automation
      </button>
    </div>
  )
}
