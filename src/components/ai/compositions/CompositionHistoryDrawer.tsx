import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { dialogVariants } from '../lib/motion'
import type { ExecutionLog } from './types'

const STATUS_COLORS: Record<string, string> = {
  success: 'text-emerald-400 bg-emerald-500/10', failure: 'text-red-400 bg-red-500/10',
  error: 'text-red-400 bg-red-500/10', skipped: 'text-amber-400 bg-amber-500/10',
  running: 'text-blue-400 bg-blue-500/10', pending: 'text-[var(--text-muted)] bg-[var(--dk-bg-input)]',
}

interface CompositionHistoryDrawerProps {
  history: ExecutionLog[]
  onClose: () => void
}

export function CompositionHistoryDrawer({ history, onClose }: CompositionHistoryDrawerProps) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose} variants={dialogVariants} initial="hidden" animate="show" exit="exit">
      <div className="bg-[var(--dk-bg-surface)] backdrop-blur-xl border border-[var(--dk-border-default)] rounded-xl w-[600px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--dk-border-default)]">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Execution History</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--dk-bg-input)] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {history.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">No executions yet</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 50).map(h => (
                <div key={h.id} className="flex items-center justify-between bg-[var(--dk-bg-raised)] light:bg-[var(--ws-surface-raised)] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status] || STATUS_COLORS.pending}`}>{h.status}</span>
                    <span className="text-xs text-[var(--text-secondary)] font-mono">{h.action_name}</span>
                    {h.duration_ms != null && <span className="text-[10px] text-[var(--text-muted)]">{h.duration_ms}ms</span>}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">{h.started_at}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
