"use client"

import * as React from 'react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
  SliderValue,
} from '@/components/ui/slider'

import {
  MAGNITUDE_LABELS,
  MONTHS,
  PHASE_CATEGORIES,
  PHASE_MOOD_TAGS,
  getContrastColor,
  lighten,
  sortPhases,
  uid,
  type LifePhase,
  type LifePhaseMilestone,
  type LifePhasePerson,
  type PhaseMoodTag,
} from '@/lib/riverMath'
import { cn } from '@/lib/utils'
import { LoaderCircle, Mic, Sparkles, X } from 'lucide-react'
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper'

const api = () => window.deskflowAPI

/* ── Draft state (useReducer) ─────────────────────────────── */

interface Draft extends Omit<LifePhase, 'id' | 'reflection' | 'eraTrends'> {
  reflection: string
  eraTrends: string
}

type Action =
  | { type: 'set'; patch: Partial<Draft> }
  | { type: 'addMilestone' }
  | { type: 'updateMilestone'; index: number; patch: Partial<LifePhaseMilestone> }
  | { type: 'removeMilestone'; index: number }
  | { type: 'addPerson' }
  | { type: 'updatePerson'; index: number; patch: Partial<LifePhasePerson> }
  | { type: 'removePerson'; index: number }
  | { type: 'toggleMoodTag'; tag: PhaseMoodTag }
  | { type: 'toggleConnection'; targetPhaseId: string }
  | { type: 'setConnectionNote'; targetPhaseId: string; note: string }
  | { type: 'reset'; draft: Draft }

function freshDraft(initial: LifePhase | null, now: Date): Draft {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 'growth',
    startMonth: initial?.startMonth ?? now.getMonth() + 1,
    startYear: initial?.startYear ?? now.getFullYear(),
    startDate: initial?.startDate ?? null,
    endMonth: initial?.endMonth ?? null,
    endYear: initial?.endYear ?? null,
    endDate: initial?.endDate ?? null,
    magnitude: initial?.magnitude ?? 50,
    color: initial?.color ?? null,
    reflection: initial?.reflection ?? '',
    eraTrends: initial?.eraTrends ?? '',
    impactNotes: initial?.impactNotes ?? '',
    milestones: initial?.milestones ?? [],
    connections: initial?.connections ?? [],
    people: initial?.people ?? [],
    moodStart: initial?.moodStart ?? null,
    moodEnd: initial?.moodEnd ?? null,
    moodTags: initial?.moodTags ?? [],
    feelingsNote: initial?.feelingsNote ?? null,
    lessonsLearned: initial?.lessonsLearned ?? null,
    headerImageMemoryId: initial?.headerImageMemoryId ?? null,
    colorSource: initial?.colorSource ?? 'category',
    reflectionSource: initial?.reflectionSource ?? null,
    reflectionGeneratedAt: initial?.reflectionGeneratedAt ?? null,
  }
}

function draftReducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch }
    case 'addMilestone':
      return {
        ...state,
        milestones: [...state.milestones, { id: uid('ms'), date: '', label: '', note: null, photoMemoryId: null }],
      }
    case 'updateMilestone':
      return {
        ...state,
        milestones: state.milestones.map((m, i) => (i === action.index ? { ...m, ...action.patch } : m)),
      }
    case 'removeMilestone':
      return { ...state, milestones: state.milestones.filter((_, i) => i !== action.index) }
    case 'addPerson':
      return {
        ...state,
        people: [...(state.people ?? []), { id: uid('person'), name: '', role: '' }],
      }
    case 'updatePerson':
      return {
        ...state,
        people: (state.people ?? []).map((p, i) => (i === action.index ? { ...p, ...action.patch } : p)),
      }
    case 'removePerson':
      return { ...state, people: (state.people ?? []).filter((_, i) => i !== action.index) }
    case 'toggleMoodTag':
      return {
        ...state,
        moodTags: state.moodTags?.includes(action.tag)
          ? state.moodTags.filter(t => t !== action.tag)
          : [...(state.moodTags ?? []), action.tag].slice(0, 5),
      }
    case 'toggleConnection': {
      const exists = state.connections.some(c => c.targetPhaseId === action.targetPhaseId)
      return {
        ...state,
        connections: exists
          ? state.connections.filter(c => c.targetPhaseId !== action.targetPhaseId)
          : [...state.connections, { targetPhaseId: action.targetPhaseId, note: null }],
      }
    }
    case 'setConnectionNote': {
      const note = action.note.trim() ? action.note : null
      return {
        ...state,
        connections: state.connections.map(c =>
          c.targetPhaseId === action.targetPhaseId ? { ...c, note } : c
        ),
      }
    }
    case 'reset':
      return action.draft
    default:
      return state
  }
}

/* ── Steps ────────────────────────────────────────────────── */

const STEPS = [
  { id: 'basics', label: 'The Chapter' },
  { id: 'story', label: 'The Story' },
  { id: 'moments', label: 'Key Moments' },
  { id: 'people', label: 'The People' },
  { id: 'feelings', label: 'Feelings & Mood' },
  { id: 'lessons', label: 'Lessons & Impact' },
  { id: 'color', label: 'Color & Preview' },
  { id: 'connections', label: 'Connections' },
  { id: 'review', label: 'Review & Reflect' },
] as const

type StepId = (typeof STEPS)[number]['id']

interface PhaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: LifePhase | null
  allPhases?: LifePhase[]
  onSave: (phase: LifePhase) => void
}

export function PhaseFormDialog({ open, onOpenChange, initial, allPhases = [], onSave }: PhaseFormDialogProps) {
  const [step, setStep] = useState<StepId>('basics')
  const [draft, dispatch] = useReducer(draftReducer, null, () => freshDraft(initial ?? null, new Date()))
  const [assistQuestions, setAssistQuestions] = useState<string[] | null>(null)
  const [assistLoading, setAssistLoading] = useState(false)
  const [reflectionLoading, setReflectionLoading] = useState(false)

  const otherPhases = useMemo(() => sortPhases(allPhases.filter(p => p.id !== initial?.id)), [allPhases, initial?.id])
  const stepIndex = STEPS.findIndex(s => s.id === step)
  const isLast = stepIndex === STEPS.length - 1

  useEffect(() => {
    if (!open) return
    dispatch({ type: 'reset', draft: freshDraft(initial ?? null, new Date()) })
    setStep('basics')
    setAssistQuestions(null)
  }, [open, initial])

  const yearNum = (s: string) => {
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : 0
  }
  const [syStr, setSyStr] = useState('')
  const [eyStr, setEyStr] = useState('')

  const color = draft.color || PHASE_CATEGORIES.find(c => c.id === draft.category)?.color || '#fbbf24'

  const stepValid = useMemo(() => {
    switch (step) {
      case 'basics': {
        const sy = draft.startYear
        const ey = draft.endYear
        if (!draft.title.trim() || sy < 1900 || sy > 2100) return false
        if (ey != null && ey > 0 && (ey < sy || ey > 2200)) return false
        return true
      }
      case 'moments':
        return draft.milestones.every(m => !(m.label.trim() && !m.date.trim()))
      default:
        return true
    }
  }, [step, draft])

  const canGoNext = stepValid
  const canGoBack = stepIndex > 0

  const next = () => {
    if (!canGoNext) return
    if (isLast) {
      saveNow('complete')
      return
    }
    setStep(STEPS[stepIndex + 1].id)
  }
  const back = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1].id)
  }

  const runAssist = async () => {
    setAssistLoading(true)
    setAssistQuestions(null)
    try {
      const res = await api().lifePhaseAiAssist({
        kind: 'lessons',
        context: {
          story: draft.description,
          feelingsNote: draft.feelingsNote ?? undefined,
          milestones: draft.milestones,
          people: draft.people,
          lessonsLearned: draft.lessonsLearned ?? undefined,
        },
      })
      setAssistQuestions(res.ok ? (res.data?.questions ?? []) : null)
    } catch {
      setAssistQuestions(null)
    } finally {
      setAssistLoading(false)
    }
  }

  const generateReflection = async () => {
    setReflectionLoading(true)
    try {
      const res = await api().lifePhaseAiReflect({
        phaseId: initial?.id ?? 'draft',
        title: draft.title,
        category: draft.category,
        story: draft.description,
        milestones: draft.milestones,
        people: draft.people,
        moodStart: draft.moodStart,
        moodEnd: draft.moodEnd,
        moodTags: draft.moodTags ?? [],
        feelingsNote: draft.feelingsNote,
        lessonsLearned: draft.lessonsLearned,
        impactNotes: draft.impactNotes,
      })
      if (res.ok && res.data?.reflection) {
        dispatch({ type: 'set', patch: { reflection: res.data.reflection, reflectionSource: 'ai', reflectionGeneratedAt: new Date().toISOString() } })
      }
    } catch {
      /* keep existing reflection */
    } finally {
      setReflectionLoading(false)
    }
  }

  const saveNow = (status: 'draft' | 'complete' = 'complete') => {
    const phase: LifePhase = {
      id: initial?.id ?? uid('phase'),
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      startMonth: draft.startMonth,
      startYear: draft.startYear,
      startDate: draft.startDate,
      endMonth: draft.endMonth,
      endYear: draft.endYear,
      endDate: draft.endDate,
      magnitude: draft.magnitude,
      color: draft.color,
      reflection: draft.reflection,
      eraTrends: draft.eraTrends || initial?.eraTrends || '',
      impactNotes: draft.impactNotes,
      milestones: draft.milestones,
      connections: draft.connections,
      people: draft.people,
      moodStart: draft.moodStart,
      moodEnd: draft.moodEnd,
      moodTags: draft.moodTags,
      feelingsNote: draft.feelingsNote,
      lessonsLearned: draft.lessonsLearned,
      headerImageMemoryId: draft.headerImageMemoryId,
      colorSource: draft.colorSource,
      reflectionSource: draft.reflectionSource,
      reflectionGeneratedAt: draft.reflectionGeneratedAt,
      status,
      updatedAt: new Date().toISOString(),
    }
    onSave(phase)
  }

  /* ── Per-step renderers ─────────────────────────────────── */

  const renderBasics = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fp-title">Title</Label>
        <VoiceInputWrapper>
          <Input
            id="fp-title"
            value={draft.title}
            onChange={e => dispatch({ type: 'set', patch: { title: e.target.value } })}
            placeholder="e.g. University, First startup, Parenthood"
            autoFocus
          />
        </VoiceInputWrapper>
      </div>

      <div className="space-y-1.5">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {PHASE_CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => dispatch({ type: 'set', patch: { category: c.id } })}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] transition-all',
                draft.category === c.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
              style={
                draft.category === c.id
                  ? { backgroundColor: `${c.color}26`, borderColor: `${c.color}66` }
                  : { borderColor: 'rgba(63,63,70,0.6)' }
              }
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Starts</Label>
          <div className="flex gap-1.5">
            <select
              value={draft.startMonth}
              onChange={e => dispatch({ type: 'set', patch: { startMonth: Number(e.target.value) } })}
              className="h-8 rounded-lg border border-border bg-background px-1.5 text-sm text-foreground outline-none"
              aria-label="Start month"
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <Input
              value={syStr || String(draft.startYear)}
              onChange={e => {
                setSyStr(e.target.value.replace(/[^\d]/g, ''))
                const n = parseInt(e.target.value.replace(/[^\d]/g, ''), 10)
                if (Number.isFinite(n)) dispatch({ type: 'set', patch: { startYear: n } })
              }}
              onBlur={() => setSyStr('')}
              inputMode="numeric"
              maxLength={4}
              className="w-20"
              aria-label="Start year"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Ends</Label>
          <div className="flex gap-1.5">
            <select
              value={draft.endMonth ?? 12}
              onChange={e => dispatch({ type: 'set', patch: { endMonth: Number(e.target.value) } })}
              disabled={!draft.endYear}
              className="h-8 rounded-lg border border-border bg-background px-1.5 text-sm text-foreground outline-none disabled:opacity-40"
              aria-label="End month"
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <Input
              value={eyStr || (draft.endYear ? String(draft.endYear) : '')}
              onChange={e => {
                setEyStr(e.target.value.replace(/[^\d]/g, ''))
                const n = parseInt(e.target.value.replace(/[^\d]/g, ''), 10)
                dispatch({ type: 'set', patch: { endYear: Number.isFinite(n) ? n : null } })
              }}
              onBlur={() => setEyStr('')}
              inputMode="numeric"
              maxLength={4}
              className="w-20"
              placeholder="Ongoing"
              aria-label="End year"
            />
          </div>
          <p className="text-[10.5px] text-zinc-600">Leave empty if this chapter is still open.</p>
        </div>
      </div>

      {/* Optional specific dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Start date <span className="text-zinc-500 font-normal">(optional)</span></Label>
          <Input
            value={draft.startDate ?? ''}
            onChange={e => dispatch({ type: 'set', patch: { startDate: e.target.value || null } })}
            placeholder="YYYY-MM-DD"
            className="w-full font-mono text-sm"
            inputMode="numeric"
            maxLength={10}
            aria-label="Start date (optional)"
          />
          <p className="text-[10.5px] text-zinc-600">Refines the month+year above with a day.</p>
        </div>
        <div className="space-y-1.5">
          <Label>End date <span className="text-zinc-500 font-normal">(optional)</span></Label>
          <Input
            value={draft.endDate ?? ''}
            onChange={e => dispatch({ type: 'set', patch: { endDate: e.target.value || null } })}
            placeholder="YYYY-MM-DD"
            disabled={!draft.endYear}
            className="w-full font-mono text-sm"
            inputMode="numeric"
            maxLength={10}
            aria-label="End date (optional)"
          />
          <p className="text-[10.5px] text-zinc-600">Only if you know the exact end day.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Magnitude — how much did this chapter reshape you?</Label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 pt-3 pb-2">
          <Slider
            value={draft.magnitude}
            onValueChange={v => dispatch({ type: 'set', patch: { magnitude: v } })}
            min={0}
            max={100}
            step={1}
            className="grow"
            aria-label="Magnitude"
          >
            <SliderControl>
              <SliderTrack>
                <SliderIndicator
                  className="transition-colors"
                  style={{ width: `${draft.magnitude}%`, backgroundColor: color }}
                />
              </SliderTrack>
              <SliderThumb />
            </SliderControl>
            <SliderValue />
          </Slider>
        </div>
        <p className="font-display text-[15px] text-amber-200/90">
          {(() => {
            const m10 = Math.max(1, Math.min(10, Math.round(draft.magnitude / 10)))
            const bucket = Math.ceil(m10 / 2)
            return MAGNITUDE_LABELS[`${bucket * 2 - 1}-${bucket * 2}`] ?? 'Quiet'
          })()}
        </p>
      </div>
    </div>
  )

  const renderStory = () => (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="fp-story">The story</Label>
        <VoiceInputWrapper>
          <Textarea
            id="fp-story"
            value={draft.description}
            onChange={e => dispatch({ type: 'set', patch: { description: e.target.value } })}
            placeholder="What was this time actually like? Where were you, who was around, what filled the days…"
            rows={6}
            autoFocus
          />
        </VoiceInputWrapper>
        <p className="text-[10.5px] text-zinc-600">Write it like you'd tell a friend who has an hour.</p>
      </div>
    </div>
  )

  const renderMoments = () => (
    <div className="space-y-3">
      <p className="text-[12px] text-zinc-500">A few dates that held the turning points.</p>
      {draft.milestones.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-[11.5px] italic text-zinc-600">
          Not every chapter has a clean list of dates. Skip this if it doesn't fit.
        </p>
      )}
      {draft.milestones.map((m, i) => (
        <div key={m.id} className="flex items-start gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-2.5">
          <div className="flex-1 space-y-1.5">
            <Input
              value={m.label}
              onChange={e => dispatch({ type: 'updateMilestone', index: i, patch: { label: e.target.value } })}
              placeholder="What happened?"
              className="text-[13px]"
            />
            <div className="flex items-center gap-2">
              <Input
                value={m.date}
                onChange={e => dispatch({ type: 'updateMilestone', index: i, patch: { date: e.target.value } })}
                placeholder="YYYY-MM or YYYY"
                className="w-32 font-mono text-[12px]"
              />
              <Input
                value={m.note ?? ''}
                onChange={e => dispatch({ type: 'updateMilestone', index: i, patch: { note: e.target.value } })}
                placeholder="Note (optional)"
                className="flex-1 text-[12px]"
              />
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'removeMilestone', index: i })}
            className="mt-1 rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Remove moment"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'addMilestone' })}>
        + Add a key moment
      </Button>
    </div>
  )

  const renderPeople = () => (
    <div className="space-y-3">
      {draft.people && draft.people.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {draft.people.map(p => (
            <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 px-2 py-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-semibold text-zinc-300">
                {p.name.charAt(0).toUpperCase() || '?'}
              </span>
              <span className="text-[11.5px] text-zinc-300">{p.name}</span>
              <span className="text-[10px] text-zinc-500">{p.role}</span>
              <button
                onClick={() => dispatch({ type: 'removePerson', index: draft.people!.indexOf(p) })}
                className="ml-0.5 text-zinc-600 hover:text-zinc-300"
                aria-label={`Remove ${p.name}`}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      {(draft.people ?? []).slice(0, 8).length < 8 && (
        <div className="space-y-2">
          <AddPersonForm
            onAdd={(name, role) => {
              if (!name.trim()) return
              dispatch({ type: 'addPerson' })
              const idx = (draft.people ?? []).length
              dispatch({ type: 'updatePerson', index: idx, patch: { name: name.trim(), role: role.trim() } })
            }}
          />
        </div>
      )}
      {draft.people && draft.people.length >= 8 && (
        <p className="text-[11px] text-zinc-600">Max 8 people per chapter.</p>
      )}
      <p className="text-[10.5px] text-zinc-600">People can repeat across chapters — that's the point.</p>
    </div>
  )

  const renderFeelings = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>How it felt at the start → how it felt at the end</Label>
        <MoodPair
          start={draft.moodStart}
          end={draft.moodEnd}
          onChange={(start, end) => dispatch({ type: 'set', patch: { moodStart: start, moodEnd: end } })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Mood tags (max 5)</Label>
        <div className="flex flex-wrap gap-1.5">
          {PHASE_MOOD_TAGS.map(tag => {
            const on = draft.moodTags?.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => dispatch({ type: 'toggleMoodTag', tag })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] transition-all',
                  on ? 'border-amber-400/50 bg-amber-400/10 text-amber-200' : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-feelings">Day to day…</Label>
        <VoiceInputWrapper>
          <Textarea
            id="fp-feelings"
            value={draft.feelingsNote ?? ''}
            onChange={e => dispatch({ type: 'set', patch: { feelingsNote: e.target.value } })}
            placeholder="How did this chapter actually feel, day to day?"
            rows={3}
          />
        </VoiceInputWrapper>
      </div>
    </div>
  )

  const renderLessons = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="fp-lessons">What did it teach you?</Label>
          <button
            onClick={runAssist}
            disabled={assistLoading}
            className="flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10.5px] text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {assistLoading ? <LoaderCircle size={11} className="animate-spin" /> : <Sparkles size={11} />}
            Help me find the words
          </button>
        </div>
        <VoiceInputWrapper>
          <Textarea
            id="fp-lessons"
            value={draft.lessonsLearned ?? ''}
            onChange={e => dispatch({ type: 'set', patch: { lessonsLearned: e.target.value } })}
            placeholder="A line or two that the younger you needed to hear…"
            rows={3}
          />
        </VoiceInputWrapper>
        {assistQuestions && assistQuestions.length > 0 && (
          <div className="mt-1 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-400/70">Try answering these:</p>
            {assistQuestions.map((q, i) => (
              <p key={i} className="text-[12px] italic text-amber-100/80">“{q}”</p>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fp-impact">How are you different now than before?</Label>
        <VoiceInputWrapper>
          <Textarea
            id="fp-impact"
            value={draft.impactNotes}
            onChange={e => dispatch({ type: 'set', patch: { impactNotes: e.target.value } })}
            placeholder="What did this chapter change about you?"
            rows={3}
          />
        </VoiceInputWrapper>
      </div>
    </div>
  )

  const renderColor = () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['category', 'custom'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => dispatch({ type: 'set', patch: { colorSource: mode } })}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-[12px] transition-colors',
              (draft.colorSource ?? 'category') === mode
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
            )}
          >
            {mode === 'category' ? 'Use category color' : 'Custom color'}
          </button>
        ))}
      </div>

      {draft.colorSource === 'custom' && (
        <div className="grid grid-cols-6 gap-2">
          {CUSTOM_SWATCHES.map(hex => (
            <button
              key={hex}
              onClick={() => dispatch({ type: 'set', patch: { color: hex } })}
              className={cn(
                'aspect-square rounded-lg transition-transform hover:scale-105',
                draft.color === hex && 'ring-2 ring-white/60'
              )}
              style={{ backgroundColor: hex }}
              aria-label={`Color ${hex}`}
            />
          ))}
        </div>
      )}

      <div>
        <Label>Live preview</Label>
        <div className="mt-1.5 origin-top-left scale-[0.62]">
          <PhaseCardPreview draft={draft} color={color} />
        </div>
      </div>
    </div>
  )

  const renderConnections = () => (
    <div className="space-y-3">
      {otherPhases.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-5 text-center text-[12px] text-zinc-600">
          This is your first chapter — nothing to connect to yet.
        </p>
      ) : (
        <>
          <p className="text-[12px] text-zinc-500">Which chapters did this one flow into?</p>
          <div className="max-h-56 space-y-1 overflow-auto ws-scroll pr-1">
            {otherPhases.map(op => {
              const conn = draft.connections.find(c => c.targetPhaseId === op.id)
              const opColor = op.color || PHASE_CATEGORIES.find(c => c.id === op.category)?.color || '#a1a1aa'
              return (
                <div key={op.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-2">
                  <button
                    onClick={() => dispatch({ type: 'toggleConnection', targetPhaseId: op.id })}
                    className="flex w-full items-center gap-2.5 text-left"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: opColor }} />
                    <span className="flex-1 truncate text-[12.5px] text-zinc-300">{op.title}</span>
                    <span className="text-[10px] text-zinc-600">{op.startYear}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] transition-colors',
                        conn ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                      )}
                    >
                      {conn ? 'Connected' : 'Connect'}
                    </span>
                  </button>
                  {conn && (
                    <Input
                      value={conn.note ?? ''}
                      onChange={e => dispatch({ type: 'setConnectionNote', targetPhaseId: op.id, note: e.target.value })}
                      placeholder="How does this connect? (optional)"
                      className="mt-1.5 ml-6 h-7 text-[11px]"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )

  const renderReview = () => (
    <div className="space-y-4">
      <div>
        <Label>Final preview</Label>
        <div className="mt-1.5 max-h-72 overflow-auto ws-scroll rounded-lg border border-zinc-800/60">
          <PhaseCardPreview draft={draft} color={color} full />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="fp-reflection">Reflection</Label>
          <button
            onClick={generateReflection}
            disabled={reflectionLoading}
            className="flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10.5px] text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {reflectionLoading ? <LoaderCircle size={11} className="animate-spin" /> : <Sparkles size={11} />}
            Generate reflection
          </button>
        </div>
        <VoiceInputWrapper>
          <Textarea
            id="fp-reflection"
            value={draft.reflection}
            onChange={e => dispatch({ type: 'set', patch: { reflection: e.target.value, reflectionSource: draft.reflectionSource === 'ai' ? 'ai-edited' : 'manual' } })}
            placeholder="A reflection will appear here — or write your own."
            rows={4}
          />
        </VoiceInputWrapper>
        <p className="text-[10.5px] text-zinc-600">AI frames with what you wrote. Accept it, edit it, or discard it.</p>
      </div>
    </div>
  )

  const renderStep = () => {
    switch (step) {
      case 'basics': return renderBasics()
      case 'story': return renderStory()
      case 'moments': return renderMoments()
      case 'people': return renderPeople()
      case 'feelings': return renderFeelings()
      case 'lessons': return renderLessons()
      case 'color': return renderColor()
      case 'connections': return renderConnections()
      case 'review': return renderReview()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-lifephase="phase-form-dialog" className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="font-display text-[15px] text-zinc-100">
              {initial ? 'Edit this chapter' : 'Add a chapter'}
            </DialogTitle>
            <span
              data-lifephase="voice-badge"
              className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
            >
              <Mic size={10} />
              Voice input ready
            </span>
          </div>
          <DialogDescription>
            {STEPS[stepIndex].label} · step {stepIndex + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => i <= stepIndex && setStep(s.id)}
              title={s.label}
              className={cn(
                'h-1 flex-1 rounded-full transition-all',
                i <= stepIndex ? 'bg-amber-400/80' : 'bg-white/10 hover:bg-white/20'
              )}
              disabled={i > stepIndex}
            />
          ))}
        </div>

        <div className="min-h-[320px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <DialogFooter className="mt-2">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {canGoBack && (
                <Button variant="ghost" size="sm" onClick={back}>
                  Back
                </Button>
              )}
              <DialogClose render={<Button variant="ghost" size="sm">Cancel</Button>} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => saveNow('draft')} data-lifephase="save-draft">
                Save as draft
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!canGoNext}
                onClick={next}
                data-lifephase="step-next"
              >
                {isLast ? 'Save this chapter' : 'Continue'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Sub-components ───────────────────────────────────────── */

const CUSTOM_SWATCHES = [
  '#6fb38f', '#38bdf8', '#f472b6', '#a1a1aa', '#fbbf24', '#a78bfa',
  '#2dd4bf', '#e8866b', '#f87171', '#4ade80', '#fb923c', '#818cf8',
]

function AddPersonForm({ onAdd }: { onAdd: (name: string, role: string) => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name"
        className="flex-1 text-[13px]"
      />
      <Input
        value={role}
        onChange={e => setRole(e.target.value)}
        placeholder="Role (mentor, partner…)"
        className="flex-1 text-[13px]"
      />
      <Button
        variant="outline"
        size="sm"
        disabled={!name.trim()}
        onClick={() => { onAdd(name, role); setName(''); setRole('') }}
      >
        + Add
      </Button>
    </div>
  )
}

function MoodPair({ start, end, onChange }: {
  start: number | null
  end: number | null
  onChange: (start: number | null, end: number | null) => void
}) {
  const moodVal = (v: number | null) => v ?? 0
  const barW = ((moodVal(end) - moodVal(start)) / 6) * 100
  const barLeft = ((moodVal(start) + 3) / 6) * 100
  return (
    <div className="space-y-2.5">
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-red-500/60 via-amber-400/60 to-emerald-400/60">
        <div
          className="absolute h-3 w-3 -top-[3px] rounded-full bg-white/90 shadow ring-2"
          style={{ left: `calc(${((moodVal(start) + 3) / 6) * 100}% - 6px)`, boxShadow: '0 0 8px rgba(255,255,255,0.4)' }}
        />
        <div
          className="absolute h-3 w-3 -top-[3px] rounded-full bg-white ring-2 ring-amber-300"
          style={{ left: `calc(${((moodVal(end) + 3) / 6) * 100}% - 6px)` }}
        />
        <div className="absolute -top-[2px] h-[2px] bg-white/70" style={{ left: `${barLeft}%`, width: `${barW}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Slider value={moodVal(start)} onValueChange={v => onChange(v, end)} min={-3} max={3} step={1} aria-label="Mood at start">
          <SliderControl>
            <SliderTrack>
              <SliderIndicator style={{ width: `${((moodVal(start) + 3) / 6) * 100}%` }} />
            </SliderTrack>
            <SliderThumb />
          </SliderControl>
        </Slider>
        <Slider value={moodVal(end)} onValueChange={v => onChange(start, v)} min={-3} max={3} step={1} aria-label="Mood at end">
          <SliderControl>
            <SliderTrack>
              <SliderIndicator style={{ width: `${((moodVal(end) + 3) / 6) * 100}%` }} />
            </SliderTrack>
            <SliderThumb />
          </SliderControl>
        </Slider>
      </div>
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>Struggling</span>
        <span>Thriving</span>
      </div>
    </div>
  )
}

/** Lightweight display-only card for in-form live preview (steps 7 & 9). */
function PhaseCardPreview({ draft, color, full = false }: { draft: Draft; color: string; full?: boolean }) {
  const contrast = getContrastColor(color)
  const moodBar = (start: number | null, end: number | null) => {
    if (start == null && end == null) return null
    const left = ((moodVal(start) + 3) / 6) * 100
    const width = Math.abs(((moodVal(end) ?? moodVal(start)) + 3) / 6 * 100 - left)
    return { left, width }
  }
  const moodVal = (v: number | null) => v ?? 0
  const span = draft.endYear
    ? `${MONTHS[(draft.startMonth || 1) - 1]} ${draft.startYear} – ${MONTHS[(draft.endMonth || 12) - 1]} ${draft.endYear}`
    : `${MONTHS[(draft.startMonth || 1) - 1]} ${draft.startYear} – present`
  const bar = moodBar(draft.moodStart, draft.moodEnd)

  return (
    <div className={cn('pointer-events-none w-[480px] overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/60', !full && 'scale-100')}>
      <div className="relative h-32 overflow-hidden" style={{ backgroundColor: color }}>
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 30% 30%, ${lighten(color, 20)}, transparent 60%)` }}
        />
        <span className="absolute right-4 top-2 font-display text-6xl text-white/10 select-none leading-none">{draft.magnitude}</span>
        <div className="absolute bottom-3 left-4">
          <h3 className="warmth-serif text-2xl" style={{ color: contrast }}>{draft.title || 'Untitled chapter'}</h3>
          <p className="font-mono text-[11px] opacity-80" style={{ color: contrast }}>{span}</p>
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        {draft.description && (
          <p className="warmth-serif text-[12.5px] leading-relaxed text-zinc-300 line-clamp-3">{draft.description}</p>
        )}
        {draft.milestones.length > 0 && (
          <div>
            <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Key Moments</p>
            {draft.milestones.slice(0, 2).map(m => (
              <p key={m.id} className="text-[11px] text-zinc-400">
                <span className="font-mono text-zinc-500">{m.date || '—'}</span> · {m.label || '(unnamed)'}
              </p>
            ))}
          </div>
        )}
        {draft.people && draft.people.length > 0 && (
          <p className="text-[11px] text-zinc-500">
            {draft.people.map(p => p.name).filter(Boolean).join(', ')}
          </p>
        )}
        {bar && (
          <div className="relative h-1 rounded-full bg-zinc-800">
            <div className="absolute h-full rounded-full bg-gradient-to-r from-red-500/70 to-emerald-400/70" style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
          </div>
        )}
        {draft.lessonsLearned && (
          <blockquote className="warmth-serif italic text-[12px] text-zinc-300 border-l-2 pl-3 line-clamp-2" style={{ borderColor: color }}>
            {draft.lessonsLearned}
          </blockquote>
        )}
      </div>
    </div>
  )
}
