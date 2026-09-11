"use client"

import * as React from 'react'
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import type { LifePhase } from '@/lib/riverMath'
import type { LongTermGoal } from '@/components/dashboard/types'
import { RingCanvas, type LensId } from './RingCanvas'
import { cn } from '@/lib/utils'
import { Images, Layers, Sparkles, Target } from 'lucide-react'

const LENSES: { id: LensId; label: string; icon: typeof Layers; blurb: string }[] = [
  { id: 'phases', label: 'Phases', icon: Layers, blurb: 'Each ring is a chapter — oldest at the center.' },
  { id: 'covenant', label: 'Covenant', icon: Sparkles, blurb: 'Grain is practice kept. Today\'s edge hardens with every completion.' },
  { id: 'gold', label: 'Gold', icon: Target, blurb: 'Branches reach toward long-term goals. Hover a bud for progress.' },
  { id: 'memories', label: 'Memories', icon: Images, blurb: 'Amber pockets hold what you kept of that time.' },
]

interface CoreSampleProps {
  phases: LifePhase[]
  covenant: {
    completions: { commitmentId: string; date: string }[]
    commitments: { id: string }[]
  }
  memoriesByPhase: Record<string, number>
  ltgsByPhase: Record<string, LongTermGoal[]>
  selectedPhaseId: string | null
  onPhaseClick: (phaseId: string) => void
  onOpenMemories: (phaseId: string) => void
  lens: LensId
  onLensChange: (lens: LensId) => void
}

export function CoreSample({
  phases,
  covenant,
  memoriesByPhase,
  ltgsByPhase,
  selectedPhaseId,
  onPhaseClick,
  onOpenMemories,
  lens,
  onLensChange,
}: CoreSampleProps) {

  const grainByPhase = useMemo(() => {
    const out: Record<string, number> = {}
    const now = new Date().getFullYear()
    for (const p of phases) {
      const start = `${p.startYear}-01-01`
      const endY = p.endYear && p.endYear > 0 ? p.endYear : now
      const end = `${endY}-12-31`
      const inRange = covenant.completions.filter(c => c.date >= start && c.date <= end)
      const days = new Set(inRange.map(c => c.date)).size
      const possible = covenant.commitments.length
      out[p.id] = possible === 0 || days === 0 ? 0 : Math.min(1, inRange.length / (possible * days))
    }
    return out
  }, [phases, covenant.completions, covenant.commitments])

  const todayCompletions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return covenant.completions.filter(c => c.date === today).length
  }, [covenant.completions])

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/75 backdrop-blur-xl" data-lifephase="core-sample">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(251,191,36,0.08), transparent 60%)' }} />

      <div className="flex flex-col items-center px-6 pb-6 pt-6">
        <div data-core-sample-stage className="relative h-72 w-72 sm:h-[420px] sm:w-[420px] lg:h-[460px] lg:w-[460px]">
          {/* RingCanvas */}
          <div className="relative z-10 h-full w-full">
            <RingCanvas
              phases={phases}
              lens={lens}
              grainByPhase={grainByPhase}
              todayCompletions={todayCompletions}
              memoriesByPhase={memoriesByPhase}
              ltgsByPhase={ltgsByPhase}
              selectedPhaseId={selectedPhaseId}
              onPhaseClick={onPhaseClick}
              onOpenMemory={onOpenMemories}
            />
          </div>
        </div>

        {/* Lens switcher */}
        <div data-lens-switcher className="mt-4 flex flex-wrap items-center justify-center gap-1 rounded-lg bg-zinc-800/50 p-0.5">
          {LENSES.map(l => (
            <button
              key={l.id}
              onClick={() => onLensChange(l.id)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors min-h-[30px]',
                lens === l.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {lens === l.id && (
                <motion.div
                  layoutId="core-sample-lens"
                  className="absolute inset-0 rounded-md bg-zinc-700/80 border border-white/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <l.icon className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10 font-medium">{l.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={lens}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-2.5 max-w-md text-center font-serif text-[12.5px] italic text-zinc-500"
          >
            {LENSES.find(l => l.id === lens)?.blurb}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
