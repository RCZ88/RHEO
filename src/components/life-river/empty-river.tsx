"use client"

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text'
import { categoryOf, MONTHS } from '@/lib/riverMath'
import { Droplets, Plus } from 'lucide-react'

const EXAMPLE_PLAN = [
  { title: 'University', startMonth: 9, startYear: 2018, endMonth: 6, endYear: 2022, category: 'growth' },
  { title: 'First job', startMonth: 7, startYear: 2022, endMonth: null, endYear: null, category: 'career' },
  { title: 'Parenthood', startMonth: 3, startYear: 2025, endMonth: null, endYear: null, category: 'love' },
]

interface EmptyRiverProps {
  onAdd: () => void
}

export function EmptyRiver({ onAdd }: EmptyRiverProps) {
  return (
    <div
      data-lifephase="empty-river"
      className="flex flex-col items-center gap-4 rounded-xl border border-zinc-800/70 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] px-6 py-8 text-center backdrop-blur-sm"
    >
      <div className="flex size-10 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10">
        <Droplets size={18} className="text-amber-300" />
      </div>
      <div>
        <p className="font-display text-[15px] text-zinc-100">
          <AnimatedShinyText shimmerWidth={90}>Your river is empty</AnimatedShinyText>
        </p>
        <p className="mt-1 max-w-md text-[12px] leading-relaxed text-zinc-500">
          Add the phases of your life — school, work, relationships, moves — and watch them
          flow from past to present. Here is an example of how a river could start:
        </p>
      </div>

      <div className="flex w-full max-w-lg items-stretch gap-2" data-lifephase="example-plan">
        {EXAMPLE_PLAN.map((e, i) => {
          const cat = categoryOf(e.category)
          const span = e.endYear
            ? `${MONTHS[e.startMonth - 1]} ${e.startYear} → ${MONTHS[(e.endMonth ?? 12) - 1]} ${e.endYear}`
            : `${MONTHS[e.startMonth - 1]} ${e.startYear} → present`
          return (
            <div key={e.title} className="flex-1">
              <div className="relative flex h-14 items-center justify-center overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)]">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-b-lg"
                  style={{ height: '58%', background: cat.color, opacity: 0.6 }}
                />
                <span className="relative text-[11px] font-medium text-zinc-100">{e.title}</span>
                {i < EXAMPLE_PLAN.length - 1 && (
                  <span className="absolute -right-1.5 top-1/2 z-10 size-3 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-amber-400" />
                )}
              </div>
              <p className="mt-1 text-[9.5px] text-zinc-600">{span}</p>
            </div>
          )
        })}
      </div>

      <Button variant="default" size="sm" onClick={onAdd} data-lifephase="add-first-phase">
        <Plus size={13} /> Add your first phase
      </Button>
    </div>
  )
}
