"use client"

import * as React from 'react'
import { useMemo, useState } from 'react'

import { phaseSpanLabel, sortPhases, type LifePhase } from '@/lib/riverMath'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface TimelineViewProps {
  phases: LifePhase[]
  onJump: (phaseId: string) => void
}

interface Block {
  id: string
  kind: 'phase' | 'gap'
  phase?: LifePhase
  startX: number
  widthPx: number
  title?: string
}

const MIN_BLOCK_W = 36
const PPY_ZOOMED = 36 // "By year": 36px per year → readable month ticks

export function TimelineView({ phases, onJump }: TimelineViewProps) {
  const [zoom, setZoom] = useState<'all' | 'year'>('all')

  const { blocks, nowOffsetPx, minYear, maxYear, spanYears } = useMemo(() => {
    const sorted = sortPhases(phases)
    const today = new Date()
    const nowYear = today.getFullYear() + (today.getMonth() + 1) / 12

    if (sorted.length === 0) {
      return { blocks: [] as Block[], nowOffsetPx: 0, minYear: nowYear, maxYear: nowYear, spanYears: 1 }
    }

    const minYear = Math.floor(Math.min(...sorted.map(p => p.startYear), nowYear))
    const maxYear = Math.ceil(Math.max(...sorted.map(p => (p.endYear && p.endYear > 0 ? p.endYear : nowYear)), nowYear))
    const spanYears = Math.max(1, maxYear - minYear)

    // "All time": fit the full span into a comfortable fixed strip (~1400px).
    const ppy = zoom === 'year' ? PPY_ZOOMED : Math.max(24, Math.min(140, 1400 / spanYears))

    const yearX = (year: number, month = 1) => (year + (month - 1) / 12 - minYear) * ppy
    const totalW = spanYears * ppy

    const b: Block[] = []
    let cursorX = 0
    for (const p of sorted) {
      const x0 = yearX(p.startYear, p.startMonth || 1)
      const x1 = p.endYear && p.endYear > 0
        ? yearX(p.endYear, p.endMonth || 12)
        : Math.max(x0 + ppy, yearX(nowYear, today.getMonth() + 1))
      const w = Math.max(MIN_BLOCK_W, x1 - x0)
      if (x0 > cursorX + 1) {
        b.push({ id: `gap-${p.id}`, kind: 'gap', startX: cursorX, widthPx: x0 - cursorX })
      }
      b.push({ id: p.id, kind: 'phase', phase: p, startX: x0, widthPx: w, title: p.title })
      cursorX = Math.max(cursorX, x0 + w)
    }
    if (cursorX < totalW) {
      b.push({ id: 'gap-end', kind: 'gap', startX: cursorX, widthPx: totalW - cursorX })
    }

    return {
      blocks: b,
      nowOffsetPx: yearX(nowYear, today.getMonth() + 1),
      minYear,
      maxYear,
      spanYears,
    }
  }, [phases, zoom])

  const totalW = useMemo(() => spanYears * (zoom === 'year' ? PPY_ZOOMED : Math.max(24, Math.min(140, 1400 / spanYears))), [zoom, spanYears])

  if (phases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center" data-lifephase="timeline-view">
        <p className="text-[12.5px] text-zinc-600">
          The timeline is empty — add a phase and it will appear here as a block.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2" data-lifephase="timeline-view">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] uppercase tracking-wider text-zinc-600">Timeline</p>
        <div className="flex gap-1">
          {(['all', 'year'] as const).map(m => (
            <button
              key={m}
              onClick={() => setZoom(m)}
              className={cn(
                'rounded-md px-2 py-1 text-[10.5px] transition-colors',
                zoom === m ? 'bg-zinc-700/70 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {m === 'all' ? 'All time' : 'By year'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div
          data-timeline-track
          className="relative flex h-24 min-h-[96px] gap-1 overflow-x-auto ws-scroll rounded-lg border border-zinc-800/60 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] p-2.5 snap-x snap-proximity"
        >
          {zoom === 'year' && (
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: Math.floor(maxYear) - Math.floor(minYear) + 2 }).map((_, i) => {
                const y = Math.floor(minYear) + i
                return (
                  <div key={y} className="absolute top-0 bottom-0 border-l border-white/[0.04]" style={{ left: (y - minYear) * PPY_ZOOMED + 10 }}>
                    <span className="absolute top-0.5 left-1 text-[9px] text-zinc-700">{y}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="relative flex shrink-0" style={{ width: totalW }}>
            {blocks.map(block =>
              block.kind === 'gap' ? (
                <div
                  key={block.id}
                  className="snap-start shrink-0 border-b-2 border-dashed border-zinc-800"
                  style={{ width: Math.max(8, block.widthPx) }}
                  title="Life continued here, just not logged yet."
                />
              ) : (
                <button
                  key={block.id}
                  onClick={() => onJump(block.id)}
                  title={`${block.title} — ${phaseSpanLabel(block.phase!)}`}
                  className="snap-start shrink-0 rounded-md flex items-end p-2 transition-transform hover:-translate-y-1"
                  style={{ width: Math.max(MIN_BLOCK_W, block.widthPx), backgroundColor: block.phase!.color }}
                  data-lifephase="timeline-block"
                >
                  <span className="truncate font-mono text-xs text-white/90 text-left sm:text-sm">{block.title}</span>
                </button>
              )
            )}

            {/* Now marker */}
            <div
              className="absolute top-0 bottom-0 z-10 pointer-events-none"
              style={{ left: nowOffsetPx + 10 }}
            >
              <span className="relative flex h-full items-center">
                <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
              </span>
            </div>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between font-mono text-[9.5px] text-zinc-700">
          <span>{minYear}</span>
          <button
            onClick={() => setZoom(zoom === 'all' ? 'year' : 'all')}
            className="flex items-center gap-0.5 text-zinc-700 transition-colors hover:text-zinc-500"
          >
            {zoom === 'all' ? (
              <><ChevronDown size={10} /> zoom into years</>
            ) : (
              <><ChevronUp size={10} /> zoom out</>
            )}
          </button>
          <span>{Math.floor(maxYear)}</span>
        </div>
      </div>
    </div>
  )
}
