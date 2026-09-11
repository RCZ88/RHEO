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
        <label className="block text-[11px] text-zinc-400 light:text-stone-500 mb-1">Automation Name<span className="text-red-400 ml-0.5">*</span></label>
        <input
          value={config.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Boss email alert"
          className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 light:text-stone-500"
        />
      </div>

      {/* Lifecycle */}
      <div>
        <label className="block text-[11px] text-zinc-400 light:text-stone-500 mb-1">Lifecycle</label>
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
        <label className="block text-[11px] text-zinc-400 light:text-stone-500 mb-1">Priority: {config.priority}</label>
        <input
          type="range" min={1} max={1000} value={config.priority}
          onChange={e => onPriorityChange(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-[11px] text-zinc-400 light:text-stone-500 mb-1">Category</label>
        <select
          value={config.category}
          onChange={e => onCategoryChange(e.target.value)}
          className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 light:text-stone-400 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
        >
          {['general', 'work', 'personal', 'finance', 'productivity'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-zinc-300 light:text-stone-400">Enable immediately</span>
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