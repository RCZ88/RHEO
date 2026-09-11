"use client"

import * as React from 'react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectItem } from '@/components/ui/select'
import {
  categoryOf,
  magnitudeGradient,
  magnitudeWords,
  phaseAgeLabel,
  phaseSpanLabel,
  uid,
  MONTHS,
  type LifePhase,
  type LifePhaseMilestone,
} from '@/lib/riverMath'
import { cn } from '@/lib/utils'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { ReflectionFlow } from './reflection-flow'
import { EraTrendsCard } from './era-trends-card'

const COLOR_CHOICES = ['#fbbf24', '#6fb38f', '#38bdf8', '#a78bfa', '#f472b6', '#e8866b']

interface PhaseDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  phase: LifePhase | null
  phases: LifePhase[]
  initialView?: 'detail' | 'reflect'
  onSave: (phase: LifePhase) => void
  onDelete: (phaseId: string) => void
  onReflect: (phase: LifePhase, answers: string[]) => Promise<string | null>
  onEraTrends: (phase: LifePhase) => Promise<string | null>
  onRename: (phaseId: string, title: string) => void
  onToast: (message: string) => void
}

export function PhaseDrawer({
  open,
  onOpenChange,
  phase,
  phases,
  initialView = 'detail',
  onSave,
  onDelete,
  onReflect,
  onEraTrends,
  onRename,
  onToast,
}: PhaseDrawerProps) {
  const [view, setView] = useState<'detail' | 'reflect'>('detail')
  const [draft, setDraft] = useState<LifePhase | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleText, setTitleText] = useState('')
  const [armDelete, setArmDelete] = useState(false)
  const [linkValue, setLinkValue] = useState('')

  useEffect(() => {
    if (open) {
      setDraft(phase ? { ...phase } : null)
      setView(initialView)
      setEditingTitle(false)
      setArmDelete(false)
      setLinkValue('')
    }
  }, [open, phase, initialView])

  if (!draft) return <Sheet open={open} onOpenChange={onOpenChange} />

  const cat = categoryOf(draft.category)
  const base = draft.color || cat.color
  const unlinked = phases.filter(p => p.id !== draft.id && !draft.connections.includes(p.id))

  const commit = (next: LifePhase) => {
    setDraft(next)
    onSave(next)
  }

  const updateMilestone = (id: string, patch: Partial<LifePhaseMilestone>) => {
    commit({
      ...draft,
      milestones: draft.milestones.map(m => (m.id === id ? { ...m, ...patch } : m)),
    })
  }

  const addMilestone = () => {
    commit({
      ...draft,
      milestones: [
        ...draft.milestones,
        { id: uid('ms'), month: 1, year: draft.startYear, label: '' },
      ],
    })
  }

  const addConnection = (id: string) => {
    commit({ ...draft, connections: [...draft.connections, id] })
    setLinkValue('')
  }

  const commitTitle = () => {
    setEditingTitle(false)
    const t = titleText.trim()
    if (!t || t === draft.title) return
    onRename(draft.id, t)
    commit({ ...draft, title: t })
    onToast(`Phase renamed to ΓÇ£${t}ΓÇ¥`)
  }

  const handleDelete = () => {
    if (!armDelete) {
      setArmDelete(true)
      setTimeout(() => setArmDelete(false), 3000)
      return
    }
    onDelete(draft.id)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px]">
        <AnimatePresence mode="wait">
          {view === 'reflect' ? (
            <motion.div
              key="reflect"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <SheetHeader>
                <SheetTitle className="text-[13px] text-amber-300">
                  Reflect on ΓÇ£{draft.title}ΓÇ¥
                </SheetTitle>
                <SheetDescription>Three questions. One honest paragraph.</SheetDescription>
              </SheetHeader>
              <div className="pt-2">
                <ReflectionFlow
                  onBack={() => setView('detail')}
                  onSubmit={answers => onReflect(draft, answers)}
                  onKeep={text => {
                    commit({ ...draft, reflection: text })
                    setView('detail')
                  }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col gap-4"
            >
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                    style={{ borderColor: `${base}55`, color: base, background: `${base}14` }}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: base }} />
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-zinc-500">{phaseSpanLabel(draft)}</span>
                </div>
                <div data-lifephase="phase-title">
                  {editingTitle ? (
                    <input
                      autoFocus
                      value={titleText}
                      onChange={e => setTitleText(e.target.value)}
                      onBlur={commitTitle}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitTitle()
                        if (e.key === 'Escape') {
                          setEditingTitle(false)
                          setTitleText(draft.title)
                        }
                      }}
                      className="w-full rounded-md border border-amber-400/40 bg-transparent px-1 font-display text-[17px] font-medium text-zinc-50 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30"
                      aria-label="Phase title"
                    />
                  ) : (
                    <SheetTitle className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setTitleText(draft.title)
                          setEditingTitle(true)
                        }}
                        className="group/title cursor-text text-left underline decoration-amber-400/30 decoration-dotted underline-offset-4 hover:decoration-amber-400/80"
                        title="Click to rename"
                      >
                        {draft.title}
                      </button>
                    </SheetTitle>
                  )}
                </div>
                <SheetDescription>
                  {phaseAgeLabel(draft)} long ┬╖ {magnitudeWords(draft.magnitude)}
                </SheetDescription>
              </SheetHeader>

              {/* magnitude */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10.5px] text-zinc-500">
                  <span>Magnitude</span>
                  <span className="text-zinc-400">{draft.magnitude}/100</span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full"
                  style={{ background: magnitudeGradient(draft.magnitude) }}
                />
              </div>

              {/* description */}
              {draft.description && (
                <p className="font-serif text-[13.5px] leading-relaxed text-zinc-300 italic">
                  {draft.description}
                </p>
              )}

              {/* reflection */}
              {draft.reflection && (
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
                  <p className="mb-1 text-[10px] tracking-wide text-amber-300/70 uppercase">Reflection</p>
                  <p className="font-serif text-[13px] leading-relaxed text-zinc-300 italic">
                    {draft.reflection}
                  </p>
                </div>
              )}

              <EraTrendsCard
                phase={draft}
                onGenerate={() => onEraTrends(draft)}
                onSave={commit}
              />

              {/* milestones */}
              <div className="space-y-2">
                <p className="text-[10px] tracking-wide text-zinc-500 uppercase">Milestones</p>
                <div className="space-y-1.5" data-lifephase="milestones">
                  {draft.milestones.map(m => (
                    <div key={m.id} className="flex items-center gap-1.5">
                      <select
                        value={m.month ?? 1}
                        onChange={e => updateMilestone(m.id, { month: Number(e.target.value) })}
                        className="h-7 w-16 rounded-md border border-border bg-background px-1 text-[11px] text-foreground outline-none"
                        aria-label="Milestone month"
                      >
                        {MONTHS.map((mo, i) => (
                          <option key={mo} value={i + 1}>{mo}</option>
                        ))}
                      </select>
                      <input
                        value={m.year}
                        onChange={e => updateMilestone(m.id, { year: parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0 })}
                        className="h-7 w-16 rounded-md border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus-visible:border-ring"
                        placeholder="Year"
                        aria-label="Milestone year"
                      />
                      <input
                        value={m.label}
                        onChange={e => updateMilestone(m.id, { label: e.target.value })}
                        className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus-visible:border-ring"
                        placeholder="What happened?"
                        aria-label="Milestone label"
                      />
                      <button
                        onClick={() => commit({ ...draft, milestones: draft.milestones.filter(x => x.id !== m.id) })}
                        className="text-zinc-600 transition-colors hover:text-rose-400"
                        aria-label="Remove milestone"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addMilestone}
                    className="flex items-center gap-1 text-[11px] text-amber-300/80 transition-colors hover:text-amber-300"
                  >
                    <Plus size={11} /> Milestone
                  </button>
                </div>
              </div>

              {/* connections */}
              <div className="space-y-2">
                <p className="text-[10px] tracking-wide text-zinc-500 uppercase">Connected phases</p>
                <div className="flex flex-wrap gap-1.5" data-lifephase="connections">
                  {draft.connections.map(id => {
                    const target = phases.find(p => p.id === id)
                    if (!target) return null
                    const tcat = categoryOf(target.category)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
                        style={{ borderColor: `${tcat.color}44`, color: tcat.color, background: `${tcat.color}10` }}
                      >
                        {target.title}
                        <button
                          onClick={() => commit({ ...draft, connections: draft.connections.filter(c => c !== id) })}
                          className="opacity-60 transition-opacity hover:opacity-100"
                          aria-label={`Unlink ${target.title}`}
                        >
                          ├ù
                        </button>
                      </span>
                    )
                  })}
                  {unlinked.length > 0 && (
                    <Select
                      value={linkValue}
                      onValueChange={addConnection}
                      valueLabel={Object.fromEntries(unlinked.map(p => [p.id, p.title]))}
                    >
                      {unlinked.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              {/* color */}
              <div className="space-y-1.5">
                <p className="text-[10px] tracking-wide text-zinc-500 uppercase">Reach color</p>
                <div className="flex gap-2">
                  {COLOR_CHOICES.map(c => (
                    <button
                      key={c}
                      onClick={() => commit({ ...draft, color: c })}
                      className={cn(
                        'size-5 rounded-full border-2 transition-transform hover:scale-110',
                        base === c ? 'border-white/80' : 'border-transparent'
                      )}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  <button
                    onClick={() => commit({ ...draft, color: null })}
                    className={cn(
                      'size-5 rounded-full border border-dashed text-[9px] leading-none text-zinc-500',
                      !draft.color && 'border-amber-400/70 text-amber-300'
                    )}
                    title="Category default"
                  >
                    auto
                  </button>
                </div>
              </div>

              {/* impact notes */}
              <div className="space-y-1.5">
                <p className="text-[10px] tracking-wide text-zinc-500 uppercase">Impact notes</p>
                <Textarea
                  value={draft.impactNotes}
                  onChange={e => commit({ ...draft, impactNotes: e.target.value })}
                  placeholder="How is this phase still shaping you today?"
                  rows={2}
                />
              </div>

              <SheetFooter>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('reflect')}
                  data-lifephase="open-reflection"
                >
                  <Sparkles size={13} /> Reflect
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-rose-300/80 hover:bg-rose-500/10 hover:text-rose-300',
                    armDelete && '!bg-rose-500/25 !text-rose-200 ring-1 ring-rose-400/50'
                  )}
                  onClick={handleDelete}
                  data-lifephase="delete-phase"
                >
                  <Trash2 size={13} /> {armDelete ? 'Tap again to confirm' : 'Delete'}
                </Button>
                <SheetClose render={<Button variant="outline" size="sm">Close</Button>} />
              </SheetFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}
