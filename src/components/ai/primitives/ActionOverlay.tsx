import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { CheckDraw } from './CheckDraw'
import { ACCENT, ACTION_ACCENT, type ActionType, type AccentKey } from '../tokens'
import { actionSpinnerVariants, completionBurstVariants, glowPulseVariants } from '../lib/motion'
import { cn } from '../lib/cn'

interface ActionOverlayProps {
  status: 'executing' | 'complete' | 'error' | null
  actionType?: ActionType
  label?: string
  className?: string
  children: ReactNode
}

export function ActionOverlay({ status, actionType, label, className, children }: ActionOverlayProps) {
  const reduce = useReducedMotion()
  const accent: AccentKey = actionType ? (ACTION_ACCENT[actionType] || 'violet') : 'violet'
  const accentHex = ACCENT[accent]?.hex || '#a78bfa'

  return (
    <div className={cn('relative', className)}>
      {children}
      <AnimatePresence>
        {status === 'executing' && (
          <motion.div
            key="action-spinner"
            variants={actionSpinnerVariants}
            initial="hidden" animate="show" exit="exit"
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm z-10"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700/50">
              <Loader2 size={14} className="animate-spin" style={{ color: accentHex }} />
              {label && <span className="text-xs font-medium" style={{ color: accentHex }}>{label}</span>}
            </div>
          </motion.div>
        )}
        {status === 'complete' && !reduce && (
          <motion.div
            key="action-complete"
            variants={completionBurstVariants}
            initial="hidden" animate="show" exit="exit"
            className="absolute inset-0 flex items-center justify-center rounded-xl z-10 pointer-events-none"
          >
            <motion.div
              variants={glowPulseVariants}
              initial="idle" animate="glow"
              className="absolute inset-0 rounded-xl"
            />
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckDraw done={true} accent="emerald" size={16} reduce={reduce} />
              {label && <span className="text-xs font-medium text-emerald-400">{label}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
