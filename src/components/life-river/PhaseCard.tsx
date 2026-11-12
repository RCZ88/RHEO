"use client"

import * as React from 'react'
import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from 'framer-motion'

import { WarmCard } from '../../features/warmth/WarmCard'
import type { LoadedMemory } from '../../features/memories/useMemories'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import type { LongTermGoal } from '@/components/dashboard/types'
import {
  categoryOf,
  getContrastColor,
  phaseSpanLabel,
  type LifePhase,
} from '@/lib/riverMath'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Camera, Maximize2, Pencil, Plus, Sparkles, Quote, ChevronDown, ChevronUp } from 'lucide-react'
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper'
import { PhaseContextExpanded } from './PhaseContextExpanded'

import { PhaseFormDialog } from './phase-form-dialog'
import { PhaseCoverPicker } from './PhaseCoverPicker'
import { PhaseImage } from './PhaseImage'
import { MemoryLightbox } from './memory-lightbox'
import { ReflectionFlow, type AiReflectResult } from './reflection-flow'
import { ConnectionDataStrip } from './ConnectionDataStrip'
import type { LensId } from './RingCanvas'

const MOOD_COLORS: Record<number, string> = {
  [-3]: '#ef4444',
  [-2]: '#f97316',
  [-1]: '#eab308',
  [0]: '#a1a1aa',
  [1]: '#84cc16',
  [2]: '#22c55e',
  [3]: '#fbbf24',
}

/* Memory pebbles — four alternating organic stone shapes for the phase card's
   photo thumbs. This is shape, not chrome: LAMINAR's 8/12/pill law governs UI
   boxes, while a pebble is river imagery — identical rounding on every thumb
   would read as stickers on a grid rather than stones in a river. The slash
   syntax makes each stone asymmetric (rx / ry), which is the whole look. */
const PEBBLE_RADII = [
  '58% 42% 55% 45% / 48% 58% 42% 52%',
  '44% 56% 48% 52% / 56% 44% 58% 42%',
  '52% 48% 60% 40% / 44% 52% 48% 56%',
  '47% 53% 44% 56% / 58% 46% 54% 46%',
]

function moodPosition(val: number | null): number {
  if (val == null) return 50
  return ((val + 3) / 6) * 100
}

function Ring({ pct, size = 32 }: { pct: number; size?: number }) {
  return (
    <div className="relative shrink-0">
      <AnimatedCircularProgressBar
        value={Math.min(100, pct)}
        size={size}
        strokeWidth={3}
        gaugePrimaryColor="#fbbf24"
        gaugeSecondaryColor="color-mix(in srgb, var(--color-foreground) 14%, transparent)"
      />
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-zinc-300 tabular-nums">
        {Math.round(pct)}
      </span>
    </div>
  )
}

function getPhaseRange(phase: LifePhase) {
  const start = new Date(
    Date.UTC(phase.startYear, phase.startMonth - 1, 1)
  )
    .toISOString()
    .slice(0, 10)

  const end = phase.endYear
    ? new Date(
        Date.UTC(
          phase.endYear,
          (phase.endMonth ?? 12) - 1,
          28
        )
      )
        .toISOString()
        .slice(0, 10)
    : null

  return { start, end }
}

interface PhaseCardProps {
  phase: LifePhase
  active: boolean
  allPhases?: LifePhase[]
  memories: LoadedMemory[]
  memoriesLoading?: boolean
  onUploadMemory?: (files: File[]) => Promise<string[]>
  onBackfillThumbnails?: () => void
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
  longTermGoals: LongTermGoal[]
  covenant?: {
    commitments: { id: string }[]
    completions: { commitmentId: string; date: string }[]
  }
  onActiveChange: (id: string | null) => void
  onSave: (phase: LifePhase) => void
  onReflect: (phase: LifePhase, answers: string[], variation?: string, captions?: { headerImageCaption: string; photoCaptions: string[]; milestonePhotoCaptions: string[] }) => Promise<AiReflectResult | null>
  onKeepReflection: (phase: LifePhase, text: string) => void
  onOpenMemory: (memory: LoadedMemory) => void
  onJump?: (phaseId: string) => void
  lens: LensId
  onAddMemory?: () => void
  onAddGoal?: () => void
  onAddCovenant?: () => void
  onEditPhase?: () => void
  expanded?: boolean
  expandedMode?: 'system' | 'manual'
  onToggleExpand?: () => void
  onModeChange?: (mode: 'system' | 'manual') => void
  onAttachMemory?: (ids: string[]) => void
  onAttachGoal?: (ids: string[]) => void
  onCovenantSaved?: () => void
  onDetachMemory?: (id: string) => void
  onDetachGoal?: (id: string) => void
  onOpenPage?: (page: string) => void
}

export function PhaseCard({
  phase,
  active,
  allPhases = [],
  memories,
  memoriesLoading = false,
  onUploadMemory,
  onBackfillThumbnails,
  scrollContainerRef,
  longTermGoals,
  covenant,
  onActiveChange,
  onSave,
  onReflect,
  onKeepReflection,
  onOpenMemory,
  onJump,
  lens,
  onAddMemory,
  onAddGoal,
  onAddCovenant,
  onEditPhase,
  expanded = false,
  expandedMode = 'system',
  onToggleExpand,
  onModeChange,
  onAttachMemory,
  onAttachGoal,
  onCovenantSaved,
  onDetachMemory,
  onDetachGoal,
  onOpenPage,
}: PhaseCardProps) {
  const [editing, setEditing] = useState(false)
  const [reflecting, setReflecting] = useState(false)
  const [storyExpanded, setStoryExpanded] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [viewer, setViewer] = useState<{ items: LoadedMemory[]; index: number } | null>(null)
  const [expandedAttached, setExpandedAttached] = useState(false)
  const [expandedNearby, setExpandedNearby] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])
  const [keepUndo, setKeepUndo] = useState<{ prev: { reflection: string; reflectionTitle: string | null; reflectionSource: string | null } } | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const reduce = useReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const prevCover = useRef(phase.headerImageMemoryId)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  void onKeepReflection
  void onOpenMemory

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef ?? undefined,
    target: cardRef,
    offset: ['start end', 'end start'],
  })
  const photoY = useTransform(scrollYProgress, [0, 1], [-12, 12])

  React.useEffect(() => {
    if (phase.headerImageMemoryId && phase.headerImageMemoryId !== prevCover.current && !reduce) {
      setRipples(r => [...r, Date.now()])
    }
    prevCover.current = phase.headerImageMemoryId
  }, [phase.headerImageMemoryId, reduce])

  React.useEffect(() => {
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current) }
  }, [])

  const attached = useMemo(() => memories.filter(m => m.meta.phaseId === phase.id).slice().sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || '')), [memories, phase.id])
  const attachedIds = useMemo(() => new Set(attached.map(m => m.meta.id)), [attached])

  const color = phase.color || categoryOf(phase.category).color
  const contrast = getContrastColor(color)

  const { start, end } = useMemo(() => getPhaseRange(phase), [phase])

  const phaseMemories = useMemo(() => {
    return memories.filter((m) => {
      const date = m.meta.date
      return date >= start && (!end || date <= end)
    })
  }, [memories, start, end])

  const nearby = useMemo(() => phaseMemories.filter(m => !attachedIds.has(m.meta.id)).slice().sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || '')), [phaseMemories, attachedIds])

  const phaseLtgs = useMemo(() => {
    return longTermGoals.filter((ltg) => {
      const anyLtg = ltg as any

      if (anyLtg.phaseId && anyLtg.phaseId === phase.id) {
        return true
      }

      if (Array.isArray(anyLtg.links) && anyLtg.links.some((link: any) => link?.type === 'life-phase' && link?.id === phase.id)) {
        return true
      }

      const targetDate = anyLtg.targetDate ?? anyLtg.deadline ?? anyLtg.date
      if (targetDate && targetDate !== '2000-01-01') {
        return (
          targetDate >= start &&
          (!end || targetDate <= end)
        )
      }

      return false
    })
  }, [longTermGoals, phase.id, start, end])

  const covenantCompletions = useMemo(() => {
    if (!covenant?.completions) return []

    return covenant.completions.filter((c) => {
      return c.date >= start && (!end || c.date <= end)
    })
  }, [covenant, start, end])

  const handleSaveManual = (payload: { title: string | null; text: string }) => {
    onSave({ ...phase, reflection: payload.text, reflectionTitle: payload.title, reflectionSource: 'manual', reflectionGeneratedAt: new Date().toISOString() })
  }
  const handleSaveAnswers = (answers: string[]) => {
    onSave({ ...phase, reflectionAnswers: answers })
  }
  const handleKeep = (payload: { title: string | null; text: string; source: 'ai' | 'ai-edited'; answers: string[] }) => {
    const prev = { reflection: phase.reflection, reflectionTitle: phase.reflectionTitle ?? null, reflectionSource: phase.reflectionSource ?? null }
    setKeepUndo({ prev })
    onSave({ ...phase, reflection: payload.text, reflectionTitle: payload.title, reflectionAnswers: payload.answers, reflectionSource: payload.source, reflectionGeneratedAt: new Date().toISOString() })
    setReflecting(false)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setKeepUndo(null), 8000)
  }
  const handleUndoKeep = () => {
    if (!keepUndo) return
    onSave({ ...phase, reflection: keepUndo.prev.reflection, reflectionTitle: keepUndo.prev.reflectionTitle, reflectionSource: keepUndo.prev.reflectionSource as any })
    setKeepUndo(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }

  const people = phase.people || []
  const moodTags = phase.moodTags || []
  const milestones = phase.milestones || []

  const sectionOpacity = (sectionLens: LensId) => lens === 'phases' || lens === sectionLens ? 'opacity-100 transition-opacity duration-300' : 'opacity-30 transition-opacity duration-300'

  return (
    <motion.div
      data-lifephase="phase-card"
      data-phase-id={phase.id}
      className={cn(
        'overflow-hidden rounded-xl transition-shadow duration-300',
        active
          ? 'shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_25px_50px_-12px_rgba(0,0,0,0.7)]'
          : 'shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]',
        phase.status === 'draft' && 'opacity-60 border border-dashed border-zinc-600'
      )}
    >
      {/* ── Solid Era Monolith: h-64 color header ── */}
      <div className="group/band relative overflow-hidden rounded-t-xl">
        {ripples.map(id => (
          <motion.span
            key={id}
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white/70"
            initial={{ scale: 0, opacity: 0.7 }}
            animate={{ scale: 14, opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.19, 1, 0.22, 1] }}
            onAnimationComplete={() => setRipples(r => r.filter(x => x !== id))}
          />
        ))}
        <button
          onClick={() => onActiveChange(phase.id)}
          data-lifephase="phase-band"
          className="relative flex h-64 w-full items-end gap-4 rounded-t-xl p-6 text-left overflow-hidden"
          style={{
            backgroundColor: color,
            boxShadow: `0 25px 50px -12px ${color}40`,
          }}
        >
          {/* Photo layer (parallax) */}
          {phase.headerImageMemoryId && (
            <motion.div
              className="absolute -inset-y-6 inset-x-0 pointer-events-none"
              style={{ y: reduce ? 0 : photoY }}
            >
              <PhaseImage
                memoryId={phase.headerImageMemoryId}
                memories={memories}
                memoriesLoading={memoriesLoading}
                variant="full"
                className="h-full w-full object-cover mix-blend-luminosity opacity-60"
              />
            </motion.div>
          )}
          {/* Duotone color overlay at ~70% when a memory photo sits underneath */}
          {phase.headerImageMemoryId && (
            <motion.div
              key={phase.headerImageMemoryId}
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: color }}
              initial={{ opacity: reduce ? 0.7 : 1 }}
              animate={{ opacity: 0.7 }}
              transition={{ duration: 0.9, ease: [0.19, 1, 0.22, 1] }}
            />
          )}
          {/* Atmospheric gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)`,
            }}
          />
          {/* Scrim for text over photo */}
          {phase.headerImageMemoryId && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 to-transparent" />
          )}

          {/* Magnitude ghost number */}
          <span className="absolute right-5 top-16 font-display text-8xl text-black/[0.06] dark:text-white/10 select-none leading-none">
            {phase.magnitude}
          </span>

          <div className="relative z-10 flex-1 min-w-0">
            <h2
              className="warmth-serif text-3xl font-medium leading-tight truncate"
              style={{ color: contrast }}
            >
              {phase.title}
            </h2>
            <p
              className="font-mono text-sm mt-1.5 opacity-80"
              style={{ color: contrast }}
            >
              {phaseSpanLabel(phase)}
            </p>
          </div>
        </button>

        <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCoverPickerOpen(true) }}
            aria-label="Change cover photo"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/25 px-2 text-[11px] text-white/80 opacity-0 transition-opacity duration-150 hover:bg-black/40 group-hover/band:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Camera className="h-3.5 w-3.5" />
            Cover
          </button>
          {phase.headerImageMemoryId && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewer({ items: [memories.find(m => m.meta.id === phase.headerImageMemoryId)!], index: 0 }) }}
              aria-label="View cover photo"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/25 px-2 text-[11px] text-white/80 opacity-0 transition-opacity duration-150 hover:bg-black/40 group-hover/band:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              View
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditPhase?.() }}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/25 px-2 text-[11px] text-white/80 transition-colors hover:bg-black/40"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
        {!phase.headerImageMemoryId && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCoverPickerOpen(true) }}
            className="absolute left-6 top-4 z-20 flex items-center gap-1.5 rounded-lg bg-black/10 px-2.5 py-1.5 text-[12px] font-medium opacity-70 transition-opacity duration-150 hover:opacity-100"
            style={{ color: contrast }}
          >
            <Camera size={13} /> Add a cover photo
          </button>
        )}
      </div>

      {/* ── Dark glass body — 8 sections ── */}
      <WarmCard className="rounded-t-none border-t-0 relative overflow-hidden p-6 space-y-6">
        {/* Always-visible Covenant / Gold / Memories data strip */}
        <div className="px-5 pt-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {/* Covenant strip */}
            <div
              data-phase-covenant-strip
              className={sectionOpacity('covenant') + ' rounded-lg border border-rose-500/15 bg-rose-500/[0.04] p-3'}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-rose-300/80">
                  Covenant
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddCovenant?.()
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-rose-500/20 text-rose-300 hover:bg-rose-500/10"
                  aria-label="Add covenant"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-2 text-lg text-zinc-100">
                {covenantCompletions.length}
              </p>

              <p className="text-[11px] text-zinc-500">
                kept in this chapter
              </p>
            </div>

            {/* Gold strip */}
            <div
              data-phase-gold-strip
              className={sectionOpacity('gold') + ' rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-3'}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-amber-300/80">
                  Gold
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddGoal?.()
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/20 text-amber-300 hover:bg-amber-500/10"
                  aria-label="Add goal"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-2 text-lg text-zinc-100">
                {phaseLtgs.length}
              </p>

              <p className="text-[11px] text-zinc-500">
                branches in this chapter
              </p>
            </div>

            {/* Memories strip */}
            <div
              data-phase-memories-strip
              className={sectionOpacity('memories') + ' rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3'}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">
                  Memories
                </p>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddMemory?.()
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10"
                  aria-label="Add memory"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-2 text-lg text-zinc-100">
                {phaseMemories.length}
              </p>

              <p className="text-[11px] text-zinc-500">
                amber pockets
              </p>
            </div>
          </div>
        </div>

        {/* Reflection */}
        {reflecting ? (
          <ReflectionFlow
            phase={phase}
            onBack={() => setReflecting(false)}
            onSubmit={onReflect}
            onKeep={handleKeep}
            onSaveManual={handleSaveManual}
            onSaveAnswers={handleSaveAnswers}
            photoContext={{
              headerImageCaption: memories.find(m => m.meta.id === phase.headerImageMemoryId)?.meta.caption || '',
              photoCaptions: [...attached, ...nearby].map(m => m.meta.caption).filter(Boolean).slice(0, 12) as string[],
              milestonePhotoCaptions: (phase.milestones || []).map(m => {
                if (!m.photoMemoryId) return null
                const mem = memories.find(x => x.meta.id === m.photoMemoryId)
                const cap = mem?.meta.caption
                return cap ? `${m.label}: ${cap}` : null
              }).filter(Boolean) as string[],
            }}
          />
        ) : (
          phase.reflection && (
            <div className="space-y-3">
              {phase.reflectionTitle && <h3 className="warmth-serif text-base font-medium text-foreground">{phase.reflectionTitle}</h3>}
              <motion.blockquote className="warmth-serif relative border-l-0 pl-4 text-lg italic leading-relaxed text-foreground/90">
                <motion.span className="absolute bottom-0 left-0 top-0 w-0.5 origin-top bg-[var(--page-accent)]" initial={{ scaleY: reduce ? 1 : 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }} />
                {phase.reflection}
              </motion.blockquote>
              <p className="text-[11px] text-muted-foreground">
                {phase.reflectionSource === 'manual' ? 'Written by me' : phase.reflectionSource === 'ai' ? 'Written with AI' : phase.reflectionSource === 'ai-edited' ? 'Written with AI, edited by me' : ''}
              </p>
              {keepUndo && (
                <p className="text-[12px] text-muted-foreground">
                  Kept in this phase. <button className="text-[var(--page-accent)] underline" onClick={handleUndoKeep}>Undo</button>
                </p>
              )}
              {phase.reflection && (
                noteOpen ? (
                  <div className="space-y-2">
                    <VoiceInputWrapper>
                      <textarea value={noteText} onChange={e => setNoteText(e.target.value.slice(0, 2000))} rows={3} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground" placeholder="Add a note…" />
                    </VoiceInputWrapper>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setNoteOpen(false); setNoteText('') }}>Cancel</Button>
                      <Button variant="default" size="sm" disabled={!noteText.trim()} onClick={() => {
                        const entry = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), text: noteText.trim() }
                        onSave({ ...phase, reflectionEntries: [...(phase.reflectionEntries || []), entry] })
                        setNoteOpen(false)
                        setNoteText('')
                      }}>Add note</Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setNoteOpen(true)} className="text-[12px] text-[var(--page-accent)]">Add a note</button>
                )
              )}
            </div>
          )
        )}


        {/* 1. Memory Pebbles — attached + from this time */}
        {(attached.length > 0 || nearby.length > 0) && (
          <div className={sectionOpacity('memories') + ' space-y-3'}>
            {[
              { label: 'Attached', list: attached, action: 'detach' as const },
              { label: 'From this time', list: nearby, action: 'attach' as const },
            ].map(group => {
              if (group.list.length === 0) return null
              const expanded = group.action === 'detach' ? expandedAttached : expandedNearby
              const setExpanded = group.action === 'detach' ? setExpandedAttached : setExpandedNearby
              const visible = expanded ? group.list : group.list.slice(0, 12)
              return (
                <div key={group.label} className="space-y-2">
                  <p className="text-[12px] font-medium text-muted-foreground">{group.label} ({group.list.length})</p>
                  <div className={cn('flex snap-x gap-3 overflow-x-auto pb-2', expanded && 'flex-wrap')}>
                    {visible.map((m, i) => (
                      <div key={m.meta.id} className="group relative shrink-0 snap-start">
                        <motion.button
                          type="button"
                          layoutId={reduce ? undefined : `pebble-${m.meta.id}`}
                          onClick={() => setViewer({ items: group.list, index: i })}
                          aria-label={m.meta.caption || 'Open photo'}
                          className="block h-20 w-24 overflow-hidden border border-border transition-transform duration-[250ms] ease-[cubic-bezier(0.19,1,0.22,1)] hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                          style={{ borderRadius: PEBBLE_RADII[i % 4] }}
                        >
                          <PhaseImage memoryId={m.meta.id} memories={memories} memoriesLoading={memoriesLoading} variant="thumb" className="h-full w-full" />
                        </motion.button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (group.action === 'detach') onDetachMemory?.(m.meta.id)
                            else onAttachMemory?.([m.meta.id])
                          }}
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                        >
                          {group.action === 'detach' ? 'Detach' : 'Attach'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {group.list.length > 12 && (
                    <button type="button" onClick={() => setExpanded(e => !e)} className="text-[12px] text-[var(--page-accent)]">
                      {expanded ? 'Show fewer' : `Show all (${group.list.length})`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 2. Story */}
        {phase.description && (
          <div>
            <p className={cn(
              'warmth-serif text-base leading-relaxed text-zinc-300',
              !storyExpanded && 'line-clamp-5'
            )}>
              {phase.description}
            </p>
            {phase.description.length > 200 && (
              <button
                onClick={() => setStoryExpanded(!storyExpanded)}
                className="text-[12px] text-zinc-500 hover:text-zinc-300 mt-1 transition-colors"
              >
                {storyExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}

        {/* 3. Key Moments — vertical timeline */}
        {milestones.length > 0 && (
          <div>
            <p className="mb-2 text-[10.5px] uppercase tracking-wider text-zinc-600">Key Moments</p>
            <div className="border-l border-zinc-700 pl-4 space-y-3">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.id}
                  className="relative"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div
                    className="absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-zinc-800"
                    style={{ backgroundColor: color }}
                  />
                  <p className="font-mono text-xs text-zinc-500">{m.date}</p>
                  <p className="text-sm text-zinc-200">{m.label}</p>
                  {m.note && <p className="text-[12px] text-zinc-500 mt-0.5">{m.note}</p>}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* 4. People — avatar chips */}
        {people.length > 0 && (
          <div>
            <p className="mb-2 text-[10.5px] uppercase tracking-wider text-zinc-600">The People</p>
            <div className="flex flex-wrap gap-2">
              {people.map(p => (
                <div key={p.id} className="flex items-center gap-2 rounded-full bg-zinc-800/60 border border-zinc-700/50 px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-semibold text-zinc-300">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[12px] text-zinc-300">{p.name}</span>
                    <span className="text-[10px] text-zinc-500 ml-1">{p.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Mood — gradient bar + tags */}
        {(phase.moodStart != null || phase.moodEnd != null) && (
          <div>
            <p className="mb-2 text-[10.5px] uppercase tracking-wider text-zinc-600">Mood</p>
            <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="absolute h-full rounded-full"
                style={{
                  left: `${moodPosition(phase.moodStart)}%`,
                  width: `${Math.abs(moodPosition(phase.moodEnd) - moodPosition(phase.moodStart))}%`,
                  background: `linear-gradient(90deg, ${MOOD_COLORS[phase.moodStart ?? 0]}, ${MOOD_COLORS[phase.moodEnd ?? 0]})`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-zinc-600">Struggling</span>
              <span className="text-[9px] text-zinc-600">Thriving</span>
            </div>
            {moodTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {moodTags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-zinc-800/60 text-[10px] text-zinc-400 border border-zinc-700/50">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Lessons — pull-quote */}
        {phase.lessonsLearned && (
          <div className="relative">
            <Quote size={32} className="absolute -left-1 -top-1 text-zinc-800/40" />
            <blockquote className="warmth-serif italic text-xl text-zinc-300 leading-relaxed border-l-2 pl-6" style={{ borderColor: color }}>
              {phase.lessonsLearned}
            </blockquote>
          </div>
        )}

        {/* 7. Impact Notes */}
        {phase.impactNotes && (
          <div>
            <p className="mb-1 text-[10.5px] uppercase tracking-wider text-zinc-600">Impact</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed">{phase.impactNotes}</p>
          </div>
        )}

        {/* 8. Feelings */}
        {phase.feelingsNote && (
          <div>
            <p className="mb-1 text-[10.5px] uppercase tracking-wider text-zinc-600">How it felt</p>
            <p className="warmth-serif italic text-[13px] text-zinc-400 leading-relaxed">{phase.feelingsNote}</p>
          </div>
        )}

        {/* Long-term goals attached to this era */}
        {phaseLtgs.length > 0 && (
          <div className={sectionOpacity('gold')}>
            <p className="mb-2 text-[10.5px] uppercase tracking-wider text-zinc-600">Long-term goals</p>
            <ul className="space-y-1.5">
              {phaseLtgs.map(ltg => (
                <li key={ltg.id} className="flex items-center gap-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] px-2.5 py-2">
                  <Ring pct={ltg.progress ?? 0} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-300">{ltg.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Connections */}
        {phase.connections.length > 0 && (
          <div>
            <p className="mb-2 text-[10.5px] uppercase tracking-wider text-zinc-600">Connected to</p>
            <div className="flex flex-wrap gap-1.5">
              {phase.connections.map((conn, i) => {
                const target = allPhases.find(p => p.id === conn.targetPhaseId)
                return (
                  <button
                    key={i}
                    onClick={() => onJump?.(conn.targetPhaseId)}
                    data-lifephase="connection-chip"
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/60 text-[11px] text-zinc-300 border border-zinc-700/50 transition-colors hover:bg-zinc-800 hover:border-zinc-600 hover:ring-1 hover:ring-zinc-500"
                  >
                    → {target?.title ?? conn.targetPhaseId.slice(0, 8)}
                    {conn.note && <span className="text-zinc-500">({conn.note})</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 8. Connection strip (data) — collapsed by default */}
        <ConnectionDataStrip
          phaseId={phase.id}
          startYear={phase.startYear}
          endYear={phase.endYear}
          memories={memories}
        />

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-zinc-800/50 pt-4">
          <button
            onClick={() => setReflecting(true)}
            data-lifephase="reflect-phase"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 px-3 py-2 text-[12px] font-medium text-[var(--page-accent)] transition-colors hover:bg-[var(--page-accent)]/20"
          >
            <Sparkles size={13} /> {phase.reflection ? 'Reflect again' : 'Reflect'}
          </button>
          <button
            onClick={() => (onEditPhase ? onEditPhase() : setEditing(true))}
            data-lifephase="edit-phase"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-zinc-800/70"
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      </WarmCard>

      {/* Expanded Context Section */}
      <AnimatePresence initial={false}>
        {expanded && (
          <PhaseContextExpanded
            key={`ctx-${phase.id}`}
            phase={phase}
            expandedMode={expandedMode}
            onModeChange={onModeChange || (() => {})}
            memories={memories}
            longTermGoals={longTermGoals}
            covenant={covenant}
            onAddMemory={onAddMemory}
            onAddGoal={onAddGoal}
            onAddCovenant={onAddCovenant}
            onEditPhase={onEditPhase}
            onAttachMemory={onAttachMemory}
            onAttachGoal={onAttachGoal}
            onCovenantSaved={onCovenantSaved}
            onDetachMemory={onDetachMemory}
            onDetachGoal={onDetachGoal}
            onOpenPage={onOpenPage}
          />
        )}
      </AnimatePresence>

      {/* Expand/Collapse Toggle */}
      {onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800/50"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Collapse' : 'Context'}
        </button>
      )}

      <PhaseCoverPicker
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        memories={memories}
        memoriesLoading={memoriesLoading}
        rangeStart={phase.startDate || `${phase.startYear}-${String(phase.startMonth).padStart(2, '0')}-01`}
        rangeEnd={phase.endDate || (phase.endYear ? `${phase.endYear}-${String(phase.endMonth ?? 12).padStart(2, '0')}-28` : null)}
        currentId={phase.headerImageMemoryId ?? null}
        title="Cover photo"
        onPick={(id) => onSave({ ...phase, headerImageMemoryId: id })}
        onUpload={async (files) => (onUploadMemory ? onUploadMemory(files) : [])}
        onBackfill={onBackfillThumbnails}
      />

      {viewer && (
        <MemoryLightbox
          memory={viewer.items[viewer.index]}
          onClose={() => setViewer(null)}
          layoutId={`pebble-${viewer.items[viewer.index].meta.id}`}
          caption={viewer.items[viewer.index].meta.caption}
          dateLabel={new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(viewer.items[viewer.index].meta.date))}
          phaseTitle={phase.title}
          onPrev={viewer.index > 0 ? () => setViewer(v => v ? { ...v, index: v.index - 1 } : v) : undefined}
          onNext={viewer.index < viewer.items.length - 1 ? () => setViewer(v => v ? { ...v, index: v.index + 1 } : v) : undefined}
        />
      )}

      <PhaseFormDialog
        open={editing}
        onOpenChange={setEditing}
        initial={phase}
        allPhases={allPhases}
        memories={memories}
        memoriesLoading={memoriesLoading}
        onUploadMemory={onUploadMemory}
        onBackfillThumbnails={onBackfillThumbnails}
        onSave={p => {
          onSave(p)
          setEditing(false)
        }}
      />
    </motion.div>
  )
}
