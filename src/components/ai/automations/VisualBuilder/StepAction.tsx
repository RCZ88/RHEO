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
              <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] text-zinc-500 light:text-stone-500">
                {action.params.length} param{action.params.length !== 1 ? 's' : ''}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}