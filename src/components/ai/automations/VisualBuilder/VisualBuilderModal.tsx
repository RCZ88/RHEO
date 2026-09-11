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
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 light:text-stone-500 hover:text-zinc-300 light:text-stone-400 hover:bg-zinc-800 light:bg-stone-200 transition-colors">
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
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] text-zinc-400 light:text-stone-500 hover:text-zinc-200 hover:bg-zinc-800 light:bg-stone-200 transition-colors">
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] text-zinc-400 light:text-stone-500 hover:text-zinc-200 hover:bg-zinc-800 light:bg-stone-200 transition-colors">
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