"use client"

import * as React from 'react'
import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { WarmCard } from '../../features/warmth/WarmCard'
import { useCovenant } from '../../features/covenant/useCovenant'
import { useMemories, type LoadedMemory } from '../../features/memories/useMemories'
import { MemoryCard } from '../../features/memories/MemoryCard'
import { NewCommitmentModal } from '../../features/covenant/NewCommitmentModal'
import { CriteriaBuilder } from '../../components/goals/CriteriaBuilder'
import type { CriteriaForm } from '../../components/goals/CriteriaBuilder'
import {
  CAT_META,
  PRIORITY_OPTIONS,
  criteriaToGoal,
  defaultCriteria,
  emptyLTGForm,
  type LTGForm,
} from '../../features/warmth/gold/GoldPage'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import type { Goal, LongTermGoal } from '@/components/dashboard/types'
import type { WarmColorKey } from '../../features/covenant/types'
import { cn } from '@/lib/utils'
import { Check, Flame, Images, Plus, Target, Upload } from 'lucide-react'

import { MemoryLightbox } from './memory-lightbox'

const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => toStr(new Date())

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toStr(d)
}

function covenantStreak(completions: { date: string }[]): number {
  const set = new Set([...new Set(completions.map(c => c.date))])
  if (set.size === 0) return 0
  let cursor = todayStr()
  if (!set.has(cursor)) cursor = addDaysStr(cursor, -1)
  let streak = 0
  while (set.has(cursor)) { streak += 1; cursor = addDaysStr(cursor, -1) }
  return streak
}

const isWeeklyish = (g: Goal) => !!g.isHabit || g.cadence === 'weekly' || g.period === 'weekly'

const WARM_DOT: Record<WarmColorKey, string> = {
  clay: '#e8866b',
  sage: '#6fb38f',
  amber: '#fbbf24',
  sky: '#38bdf8',
}

function Ring({ pct, size = 48 }: { pct: number; size?: number }) {
  return (
    <div className="relative shrink-0">
      <AnimatedCircularProgressBar
        value={Math.min(100, pct)}
        size={size}
        strokeWidth={4}
        gaugePrimaryColor="#fbbf24"
        gaugeSecondaryColor="rgba(63,63,70,0.5)"
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-zinc-300 tabular-nums">
        {Math.round(pct)}
      </span>
    </div>
  )
}

interface TodayTributaryProps {
  covenant: ReturnType<typeof useCovenant>
  memories: ReturnType<typeof useMemories>
  goals: Goal[]
  longTermGoals: LongTermGoal[]
  onToggleGoal: (goal: Goal) => void
  onAddGoal?: (goal: Goal) => void | Promise<void>
  onAddLTG?: (form: LTGForm) => Promise<boolean>
}

export function TodayTributary({ covenant, memories, goals, longTermGoals, onToggleGoal, onAddGoal, onAddLTG }: TodayTributaryProps) {
  const [viewing, setViewing] = useState<LoadedMemory | null>(null)
  const [showCommitment, setShowCommitment] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)
  const [newCriteria, setNewCriteria] = useState<CriteriaForm>(defaultCriteria)
  const [addingLTG, setAddingLTG] = useState(false)
  const [ltgForm, setLtgForm] = useState<LTGForm>(emptyLTGForm)
  const [savingLTG, setSavingLTG] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)

  const today = todayStr()

  const handleAddGoal = () => {
    if (!newCriteria.title.trim()) return
    const goal = criteriaToGoal(newCriteria, today)
    setAddingGoal(false)
    setNewCriteria(defaultCriteria)
    void onAddGoal?.(goal)
  }

  const handleLTGSubmit = async () => {
    if (!ltgForm.title.trim() || savingLTG) return
    setSavingLTG(true)
    const ok = await onAddLTG?.(ltgForm) ?? false
    setSavingLTG(false)
    if (ok) { setAddingLTG(false); setLtgForm(emptyLTGForm) }
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) void memories.upload(files)
    e.target.value = ''
  }

  const doneToday = useMemo(
    () => new Set(covenant.completions.filter(c => c.date === today).map(c => c.commitmentId)),
    [covenant.completions, today]
  )

  const dailies = useMemo(() => goals.filter(g => !isWeeklyish(g) && g.status !== 'suggested'), [goals])
  const doneDailies = dailies.filter(g => g.status === 'done').length
  const streak = useMemo(() => covenantStreak(covenant.completions), [covenant.completions])

  const vault = useMemo(
    () => [...longTermGoals].sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1)).slice(0, 4),
    [longTermGoals]
  )

  const dayNum = new Date().getDate()
  const monthName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long' })

  return (
    <WarmCard ambient data-lifephase="today-tributary" className="relative overflow-hidden p-0">
      {/* Warmth shimmer overlay */}
      <div className="absolute inset-0 rounded-xl opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(251,191,36,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(111,179,143,0.06) 0%, transparent 60%)',
        }}
      />

      <div className="relative p-6">
        {/* ── Header: The Confluence ── */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="warmth-serif text-2xl text-zinc-100 leading-tight">
              The Confluence
            </h2>
            <p className="font-mono text-[12px] text-zinc-500 mt-1">
              {monthName} <span className="font-display text-lg text-amber-400/80 tabular-nums">{dayNum}</span>
            </p>
          </div>
        </div>

        {/* ── Asymmetric organic layout ── */}
        <div className="flex flex-col md:flex-row gap-6">

          {/* ── Covenant (Left — Roots) ── */}
          <div className="md:w-[28%] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-amber-400/10">
                  <Flame size={14} className="text-amber-400" />
                </div>
                <h3 className="warmth-serif text-base text-amber-400/90">Current Vows</h3>
              </div>
              <button
                onClick={() => setShowCommitment(true)}
                title="Add commitment"
                data-lifephase="add-commitment"
                className="relative grid size-7 place-items-center rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400/70 transition-colors hover:border-amber-500/40 hover:text-amber-300"
              >
                <Plus size={13} />
                <span className="absolute inset-0 rounded-lg border border-amber-400/20 animate-pulse" />
              </button>
            </div>

            {streak > 0 && (
              <div className="flex items-baseline gap-1.5 px-1">
                <span className="font-display text-4xl text-amber-400 tabular-nums leading-none">{streak}</span>
                <span className="warmth-serif text-[11px] text-amber-400/60 italic">day streak</span>
              </div>
            )}

            {covenant.commitments.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-zinc-600 px-1">
                No commitments yet — tap + to set the river's current.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {covenant.commitments.slice(0, 6).map(c => {
                  const done = doneToday.has(c.id)
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => (done ? covenant.unmarkComplete(c.id) : covenant.markComplete(c.id))}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all duration-200',
                          done
                            ? 'border-amber-500/25 bg-amber-500/10 shadow-[0_0_12px_-4px_rgba(251,191,36,0.3)]'
                            : 'border-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] hover:border-zinc-700/70 hover:bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]'
                        )}
                        data-lifephase="covenant-toggle"
                      >
                        <span
                          className={cn(
                            'grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors',
                            done ? 'border-amber-400 bg-amber-400' : 'border-zinc-600'
                          )}
                        >
                          {done && <Check size={11} className="text-zinc-950" strokeWidth={3} />}
                        </span>
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: WARM_DOT[c.color] || '#fbbf24' }}
                        />
                        <span className={cn('flex-1 truncate text-[12.5px]', done ? 'text-zinc-500 line-through' : 'text-zinc-300')}>
                          {c.name}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* ── Gold (Center — Sails, largest) ── */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-amber-400/10">
                  <Target size={14} className="text-amber-400" />
                </div>
                <h3 className="warmth-serif text-base text-amber-400/90">Today's Seal</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {doneDailies}/{dailies.length}
                </span>
                <button
                  onClick={() => { setAddingGoal(true); setNewCriteria(defaultCriteria) }}
                  title="Add daily goal"
                  data-lifephase="add-goal"
                  className="grid size-7 place-items-center rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400/70 transition-colors hover:border-amber-500/40 hover:text-amber-300"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {addingGoal && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-amber-500/20 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-3 overflow-hidden"
                >
                  <CriteriaBuilder
                    value={newCriteria}
                    onChange={setNewCriteria}
                    onSave={handleAddGoal}
                    onCancel={() => { setAddingGoal(false); setNewCriteria(defaultCriteria) }}
                    longTermGoals={longTermGoals.map(l => ({ id: l.id, title: l.title }))}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {dailies.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-zinc-600 px-1">
                No daily goals today — tap + to add one and it will flow here.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dailies.slice(0, 8).map(g => {
                  const done = g.status === 'done'
                  return (
                    <li key={g.id}>
                      <button
                        onClick={() => onToggleGoal(g)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-200',
                          done
                            ? 'border-emerald-500/25 bg-emerald-500/10'
                            : 'border-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] hover:border-zinc-700/70 hover:bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]'
                        )}
                        data-lifephase="daily-toggle"
                      >
                        <span
                          className={cn(
                            'grid shrink-0 place-items-center rounded-full border transition-colors',
                            done ? 'border-emerald-400 bg-emerald-400' : 'border-zinc-600'
                          )}
                          style={{ width: 20, height: 20 }}
                        >
                          {done && <Check size={11} className="text-zinc-950" strokeWidth={3} />}
                        </span>
                        <span className={cn('flex-1 truncate text-[13px]', done ? 'text-zinc-500 line-through' : 'text-zinc-200')}>
                          {g.title}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* ── Vault (Right — Horizon, looming) ── */}
          <div className="md:w-[30%] hidden md:block space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-amber-400/10">
                  <Images size={14} className="text-amber-400" />
                </div>
                <h3 className="warmth-serif text-base text-amber-400/90">Horizon</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => uploadRef.current?.click()}
                  title="Upload memory"
                  data-lifephase="upload-memory"
                  className="grid size-7 place-items-center rounded-lg border border-zinc-700/60 bg-zinc-800/40 text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-300"
                >
                  <Upload size={13} />
                </button>
                <button
                  onClick={() => { setAddingLTG(true); setLtgForm(emptyLTGForm) }}
                  title="Add long-term goal"
                  data-lifephase="add-ltg"
                  className="grid size-7 place-items-center rounded-lg border border-zinc-700/60 bg-zinc-800/40 text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-300"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>

            <input
              ref={uploadRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />

            <AnimatePresence>
              {addingLTG && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 rounded-xl border border-amber-500/20 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-3 overflow-hidden"
                >
                  <input
                    autoFocus
                    value={ltgForm.title}
                    onChange={e => setLtgForm(f => ({ ...f, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && void handleLTGSubmit()}
                    placeholder="Long-term goal title…"
                    className="w-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                  />
                  <div className="flex gap-1.5">
                    <select
                      value={ltgForm.category}
                      onChange={e => setLtgForm(f => ({ ...f, category: e.target.value as LTGForm['category'] }))}
                      className="flex-1 min-w-0 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 transition-colors"
                    >
                      {Object.keys(CAT_META).map(k => (
                        <option key={k} value={k}>{CAT_META[k].label}</option>
                      ))}
                    </select>
                    <select
                      value={ltgForm.priority}
                      onChange={e => setLtgForm(f => ({ ...f, priority: Number(e.target.value) }))}
                      className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 transition-colors"
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="date"
                    value={ltgForm.deadline}
                    onChange={e => setLtgForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-amber-500/40 [color-scheme:dark] transition-colors"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => void handleLTGSubmit()}
                      disabled={!ltgForm.title.trim() || savingLTG}
                      data-lifephase="ltg-submit"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-medium transition-colors"
                    >
                      {savingLTG ? 'Saving…' : 'Add goal'}
                    </button>
                    <button
                      onClick={() => { setAddingLTG(false); setLtgForm(emptyLTGForm) }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 text-[11px] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {vault.length === 0 && (
              <p className="text-[12px] leading-relaxed text-zinc-600 px-1">
                No long-term goals yet — tap + to add one.
              </p>
            )}

            {vault.length > 0 && (
              <div className="space-y-2">
                {vault.map(ltg => {
                  const cat = CAT_META[ltg.category as keyof typeof CAT_META] || CAT_META.life
                  return (
                    <div
                      key={ltg.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-4 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]"
                      style={{ borderColor: cat.color, backgroundColor: `${cat.color}08` }}
                    >
                      <Ring pct={ltg.progress ?? 0} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] text-zinc-300 font-medium">{ltg.title}</p>
                        {ltg.deadline && (
                          <p className="font-mono text-[10.5px] text-zinc-600">
                            {new Date(ltg.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[10.5px] uppercase tracking-wider text-zinc-600">On this day</p>
              {memories.onThisDay.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-zinc-600">
                  No memories from this date — yet.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {memories.onThisDay.slice(0, 4).map(m => (
                    <MemoryCard key={m.meta.id} idPrefix="tributary" memory={m} onOpen={() => setViewing(m)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewing && <MemoryLightbox memory={viewing} onClose={() => setViewing(null)} />}

      {showCommitment && (
        <NewCommitmentModal
          onClose={() => setShowCommitment(false)}
          onCreate={input => { covenant.addCommitment(input); setShowCommitment(false) }}
        />
      )}
    </WarmCard>
  )
}
