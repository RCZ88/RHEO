import { motion } from 'framer-motion'
import { Play, Pencil, Trash2, RotateCcw, AlertCircle, Loader2 } from 'lucide-react'
import type { CompositionRule, ExecutionStatus } from './types'
import { statusBadgePulse, compositionExecuteVariants } from '../lib/motion'
import { useReducedMotion } from 'framer-motion'

interface CompositionRuleCardProps {
  rule: CompositionRule
  status?: ExecutionStatus
  isRunning?: boolean
  onEdit: () => void
  onEvaluate: () => void
  onDelete: () => void
  onHistory: () => void
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

export function CompositionRuleCard({ rule, status, isRunning, onEdit, onEvaluate, onDelete, onHistory }: CompositionRuleCardProps) {
  const reduce = useReducedMotion()
  const sc = STATUS_COLORS[status?.last_status || ''] || STATUS_COLORS.idle

  return (
    <motion.div
      layout
      variants={compositionExecuteVariants}
      initial="idle"
      animate={isRunning ? 'execute' : 'idle'}
      className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl p-5"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-white truncate">{rule.name}</h3>
            {status && (
              <motion.span variants={statusBadgePulse} animate={reduce ? {} : 'pulse'} className={`text-xs px-2 py-0.5 rounded-full ${sc}`}>
                {status.last_status}
              </motion.span>
            )}
            {rule.enabled
              ? <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Enabled</span>
              : <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">Disabled</span>}
          </div>
          {rule.description && <p className="text-xs text-zinc-500 mt-1 truncate">{rule.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
            <span>v{rule.version}</span><span>{rule.category}</span><span>{rule.lifecycle}</span>
            {rule.schedule_cron && <span className="font-mono">{rule.schedule_cron}</span>}
            <span>Priority: {rule.priority}</span>
          </div>
          {status && status.consecutive_failures > 0 && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-red-400">
              <AlertCircle className="w-3 h-3" />{status.consecutive_failures} consecutive failure{status.consecutive_failures > 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-4">
          <button onClick={onEvaluate} disabled={isRunning} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Evaluate">
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onHistory} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors" title="History">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
