"use client"

import * as React from 'react'
import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { WarmCard } from '@/features/warmth/WarmCard'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useLifePhases } from '@/hooks/useLifePhases'
import {
  categoryOf,
  magnitudeWords,
  phaseSpanLabel,
  type LifePhase,
} from '@/lib/riverMath'
import { RiverCanvas } from './river-canvas'
import { PhaseDrawer } from './phase-drawer'
import { PhaseFormDialog } from './phase-form-dialog'
import { EmptyRiver } from './empty-river'
import { Compass, Plus, RefreshCw, Sparkles } from 'lucide-react'

interface LifeRiverProps {
  className?: string
}

export function LifeRiver({ className }: LifeRiverProps) {
  const store = useLifePhases()
  const { phases, loading, error } = store

  const [drawerPhaseId, setDrawerPhaseId] = useState<string | null>(null)
  const [drawerInitialView, setDrawerInitialView] = useState<'detail' | 'reflect'>('detail')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LifePhase | null>(null)
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const drawerPhase = useMemo(
    () => phases.find(p => p.id === drawerPhaseId) ?? null,
    [phases, drawerPhaseId]
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const openDrawer = (id: string, view: 'detail' | 'reflect' = 'detail') => {
    setDrawerInitialView(view)
    setDrawerPhaseId(id)
  }

  const openForm = (initial: LifePhase | null = null) => {
    setEditing(initial)
    setFormOpen(true)
  }

  const handleSave = async (phase: LifePhase) => {
    const ok = await store.savePhase(phase)
    if (ok) showToast(phase.title ? `ΓÇ£${phase.title}ΓÇ¥ saved` : 'Phase saved')
  }

  const summarize = async () => {
    setSummaryBusy(true)
    const text = await store.summarize()
    setSummaryBusy(false)
    if (text) showToast('Journey summarized')
    else showToast('Summary failed ΓÇö check your AI provider')
  }

  return (
    <WarmCard className={className} data-lifephase="life-river">
      <div className="space-y-4">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[15px] font-medium tracking-wide text-zinc-100">
              The River of Years
            </h2>
            <p className="font-serif mt-0.5 text-[12.5px] text-zinc-500 italic">
              your life, flowing water ΓÇö each phase a reach of the river
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => openForm(null)}
            data-lifephase="add-phase"
          >
            <Plus size={13} /> Phase
          </Button>
        </div>

        {/* AI buttons */}
        <div className="flex flex-wrap items-center gap-2" data-lifephase="ai-actions">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm"><Sparkles size={13} /> Reflect on a phase</Button>}
            />
            <DropdownMenuContent align="start">
              {phases.length === 0 && <DropdownMenuItem disabled>No phases yet</DropdownMenuItem>}
              {phases.map(p => (
                <DropdownMenuItem key={p.id} onClick={() => openDrawer(p.id, 'reflect')}>
                  {p.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm"><Compass size={13} /> Era trends for this decade</Button>}
            />
            <DropdownMenuContent align="start">
              {phases.length === 0 && <DropdownMenuItem disabled>No phases yet</DropdownMenuItem>}
              {phases.map(p => (
                <DropdownMenuItem key={p.id} onClick={() => openDrawer(p.id, 'detail')}>
                  {p.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            disabled={summaryBusy || phases.length === 0}
            onClick={summarize}
            data-lifephase="summarize-journey"
          >
            {summaryBusy ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Summarize my journey
          </Button>
        </div>

        {/* journey summary */}
        <AnimatePresence>
          {store.summary && (
            <motion.blockquote
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-lifephase="journey-summary"
              className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-3"
            >
              <p className="font-serif text-[13px] leading-relaxed text-zinc-300 italic">{store.summary}</p>
              <footer className="mt-1.5 text-[10px] text-zinc-600">
                you, on your whole journey
              </footer>
            </motion.blockquote>
          )}
        </AnimatePresence>

        {/* canvas */}
        {loading ? (
          <Skeleton className="h-60 w-full rounded-xl" />
        ) : error ? (
          <p className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-3 py-4 text-center text-[12px] text-rose-300">
            Couldn't load your river: {error}
          </p>
        ) : phases.length === 0 ? (
          <EmptyRiver onAdd={() => openForm(null)} />
        ) : (
          <RiverCanvas
            phases={phases}
            selectedId={drawerPhaseId}
            onSelect={p => setDrawerPhaseId(p.id)}
          />
        )}

        {/* phase cards */}
        {!loading && !error && phases.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-lifephase="phase-cards">
            {phases.map(p => {
              const cat = categoryOf(p.category)
              const base = p.color || cat.color
              return (
                <button
                  key={p.id}
                  onClick={() => setDrawerPhaseId(p.id)}
                  className={cn(
                    'group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide uppercase"
                      style={{ borderColor: `${base}44`, color: base, background: `${base}10` }}
                    >
                      <span className="size-1 rounded-full" style={{ background: base }} />
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-zinc-600">{magnitudeWords(p.magnitude).split(' ')[0]}</span>
                  </div>
                  <p className="mt-2 truncate font-display text-[13px] font-medium text-zinc-100">{p.title}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">{phaseSpanLabel(p)}</p>
                  <div className="mt-2 h-1 w-full rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${p.magnitude}%`, background: base }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              aria-live="polite"
              data-lifephase="river-toast"
              className="fixed right-4 top-4 z-[120] rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-[12px] text-zinc-200 shadow-xl backdrop-blur"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* drawer + form */}
      <PhaseDrawer
        open={Boolean(drawerPhaseId)}
        onOpenChange={open => {
          if (!open) setDrawerPhaseId(null)
        }}
        phase={drawerPhase}
        phases={phases}
        initialView={drawerInitialView}
        onSave={handleSave}
        onDelete={async id => {
          await store.deletePhase(id)
          setDrawerPhaseId(null)
          showToast('Phase removed from the river')
        }}
        onReflect={async (phase, answers) => {
          const text = await store.reflect(phase, answers)
          if (text) showToast('Reflection written')
          return text
        }}
        onEraTrends={async phase => store.eraTrends(phase)}
        onRename={(id, title) => store.renameLocal(id, title)}
        onToast={showToast}
      />

      <PhaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSave={async phase => {
          await handleSave(phase)
          setFormOpen(false)
        }}
      />
    </WarmCard>
  )
}
