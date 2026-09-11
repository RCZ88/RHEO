import { Check, Circle, Lock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

console.log('%c[ContentEngine] PhasePipeline v1.0 loaded', 'color:#f5c518;font-weight:bold')

const PHASES = [
  { id: 'idea', label: 'GREEN LIGHT', short: 'GL' },
  { id: 'script', label: 'BLUEPRINT', short: 'BP' },
  { id: 'capture', label: 'CAPTURE', short: 'CA' },
  { id: 'assemble', label: 'ASSEMBLE', short: 'AS' },
  { id: 'learn', label: 'LEARN', short: 'LR' },
] as const

type PhaseId = (typeof PHASES)[number]['id']

const PHASE_ORDER: PhaseId[] = ['idea', 'script', 'capture', 'assemble', 'learn']

const STATUS_TO_PHASE: Record<string, PhaseId> = {
  draft: 'idea',
  greenlit: 'script',
  scripted: 'script',
  captured: 'capture',
  filming: 'capture',
  assembled: 'assemble',
  gated: 'assemble',
  published: 'learn',
  learned: 'learn',
}

function resolvePhaseIndex(episodeStatus: string, currentPhase?: string): number {
  if (currentPhase) {
    const idx = PHASE_ORDER.indexOf(currentPhase as PhaseId)
    if (idx >= 0) return idx
  }
  const mapped = STATUS_TO_PHASE[episodeStatus]
  if (mapped) return PHASE_ORDER.indexOf(mapped)
  return 0
}

interface PhaseStepperProps {
  currentPhase: string
  onPhaseClick: (phase: string) => void
  episodeStatus: string
  gates?: any
  takeCount?: number
  evaluatedCount?: number
}

export function PhaseStepper({
  currentPhase,
  onPhaseClick,
  episodeStatus,
  gates,
  takeCount = 0,
  evaluatedCount = 0,
}: PhaseStepperProps) {
  const activeIdx = resolvePhaseIndex(episodeStatus, currentPhase)

  const stepStatus = (idx: number): 'completed' | 'active' | 'future' | 'locked' => {
    if (idx < activeIdx) return 'completed'
    if (idx === activeIdx) return 'active'
    if (idx === activeIdx + 1) return 'future'
    return 'locked'
  }

  const subtitleFor = (idx: number, status: ReturnType<typeof stepStatus>): string => {
    if (status === 'completed') {
      if (idx === 0) return gates?.overall === 'pass' ? 'GO' : 'Override'
      if (idx === 1) return 'Scripted'
      if (idx === 2) return `${takeCount} take${takeCount !== 1 ? 's' : ''}`
      if (idx === 3) return 'Assembled'
      return 'Learned'
    }
    if (status === 'active') {
      if (idx === 0) return 'Validating…'
      if (idx === 1) return 'Generating…'
      if (idx === 2) return evaluatedCount > 0 ? `${evaluatedCount} evaluated` : 'In progress'
      return 'In progress'
    }
    if (status === 'future') return 'Ready soon'
    return 'Locked'
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[rgba(24,24,27,0.60)] px-5 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-0 overflow-x-auto">
        {PHASES.map((phase, idx) => {
          const status = stepStatus(idx)
          const clickable = status !== 'locked'
          const dotColor =
            status === 'completed' ? 'bg-emerald-400' :
            status === 'active' ? 'bg-[#f5c518]' :
            status === 'future' ? 'bg-zinc-600' :
            'bg-zinc-700'
          const textColor =
            status === 'completed' ? 'text-emerald-400' :
            status === 'active' ? 'text-[#f5c518]' :
            status === 'future' ? 'text-zinc-400' :
            'text-zinc-600'
          const labelColor =
            status === 'active' ? 'text-zinc-100' :
            status === 'completed' ? 'text-zinc-200' :
            'text-zinc-500'

          return (
            <div key={phase.id} className="flex items-center flex-shrink-0">
              {/* Connector line */}
              {idx > 0 && (
                <div className={cn(
                  'mx-1 h-px w-6 flex-shrink-0 sm:w-10',
                  idx <= activeIdx ? 'bg-emerald-500/40' : 'bg-zinc-700/60',
                )} />
              )}

              {/* Step */}
              <button
                onClick={() => clickable && onPhaseClick(phase.id)}
                disabled={!clickable}
                className={cn(
                  'group flex flex-col items-center gap-1 rounded-lg px-2.5 py-1.5 transition-colors',
                  clickable ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-not-allowed',
                )}
              >
                {/* Dot */}
                <div className="relative flex items-center justify-center">
                  <div className={cn('h-3 w-3 rounded-full transition-colors', dotColor)} />
                  {status === 'active' && (
                    <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-[#f5c518]/30" />
                  )}
                  {status === 'completed' && (
                    <Check size={10} className="absolute text-white" />
                  )}
                  {status === 'locked' && (
                    <Lock size={8} className="absolute text-zinc-600" />
                  )}
                </div>

                {/* Label */}
                <span className={cn('text-[10px] font-semibold tracking-wider uppercase', labelColor)}>
                  <span className="hidden sm:inline">{phase.label}</span>
                  <span className="sm:hidden">{phase.short}</span>
                </span>

                {/* Subtitle */}
                <span className={cn('text-[9px]', textColor)}>
                  {subtitleFor(idx, status)}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
