import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { itemVariants, staggerParent } from '../../lib/motion'
import { SOURCE_META, getTriggersBySource } from '../data/triggerRegistry'
import type { TriggerSelection } from '../../../types/automation'
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
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 light:text-stone-500">{meta.label}</span>
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