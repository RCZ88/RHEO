"use client"

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { HeartHandshake, Images, Layers, Map, BookOpen, Plus, FileClock, Pencil, Mic, Target, Sparkles, User, Network, Brain, RefreshCw, Calendar } from 'lucide-react'


import { cn } from '@/lib/utils'

import { RiverMap } from '@/components/life-river/RiverMap'
import { TimelineView } from '@/components/life-river/TimelineView'
import { CoreSample } from '@/components/life-river/CoreSample'
import { TodayTributary } from '@/components/life-river/TodayTributary'
import { PhaseCard } from '@/components/life-river/PhaseCard'
import { PhaseFormDialog } from '@/components/life-river/phase-form-dialog'
import { MemoryLightbox } from '@/components/life-river/memory-lightbox'
import { LifeRiver } from '@/components/life-river/river'
import { NotesTab } from '@/components/life-river/NotesTab'
import { ScheduleTab } from '@/components/life-river/ScheduleTab'
import { LivingSubstrate } from '@/components/life-river/LivingSubstrate'
import type { LensId } from '@/components/life-river/RingCanvas'
import type { LifePhase } from '@/lib/riverMath'
import CovenantPage from '../../features/covenant/CovenantPage'
import MemoriesPage from '../../features/memories/MemoriesPage'
import GoldPage from '../../features/warmth/gold/GoldPage'
import { ProfileTab } from '../../components/life/ProfileTab'
import { ContextGraphView } from './ContextGraphView'
import { BrainManagementView } from './context-brain/BrainManagementView'
import { NeuralFlow } from './context-brain/NeuralFlow'
import { SelfOrchestrator } from './self/SelfOrchestrator'
import { confetti } from '../../components/ui/confetti'
import { NumberTicker } from '../../components/ui/number-ticker'
import { DotPattern } from '../../components/ui/dot-pattern'
import { Skeleton } from '../../components/ui/skeleton'
import { SectionHeader } from '../../components/SectionHeader'
import { useLifePhases } from '@/hooks/useLifePhases'
import { useCovenant } from '../../features/covenant/useCovenant'
import { useMemories, type LoadedMemory } from '../../features/memories/useMemories'

import type { Goal, LongTermGoal } from '../../components/dashboard/types'
import type { LTGForm } from '../warmth/gold/GoldPage'
import { CurrentCanvas } from '../../components/CurrentCanvas'
import { renderNetwork } from '../../lib/renderers/network'
import { startPhaseClock } from '../../lib/currentPhase'

const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => toStr(new Date())

type ViewMode = 'pages' | 'river'
type PageTab = 'covenant' | 'memories' | 'gold' | 'notes' | 'schedule' | 'habits' | 'self'

const PAGE_TABS: { key: PageTab; label: string; icon: typeof HeartHandshake; accent: string }[] = [
  { key: 'covenant', label: 'Covenant', icon: HeartHandshake, accent: '#e8866b' },
  { key: 'memories', label: 'Memories', icon: Images, accent: '#6fb38f' },
  { key: 'gold', label: 'Gold', icon: Layers, accent: '#fbbf24' },
  { key: 'notes', label: 'Notes', icon: BookOpen, accent: '#a78bfa' },
  { key: 'schedule', label: 'Schedule', icon: Calendar, accent: '#ec4899' },
  { key: 'self', label: 'Self', icon: User, accent: '#8b5cf6' },
]

const crossfade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
}

const pillTransition = { type: 'spring' as const, stiffness: 400, damping: 32 }

const SELF_CARD_CLASS = "rounded-xl border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl p-6 shadow-2xl shadow-black/20"

function SelfStatStrip() {
  const [stats, setStats] = useState<{ episodes: number; entities: number; currentFacts: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await (window as any).deskflowAPI?.brainStats?.()
        if (!cancelled && data) {
          setStats({ episodes: data.episodes ?? 0, entities: data.entities ?? 0, currentFacts: data.currentFacts ?? 0 })
        }
      } catch { /* non-critical */ }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const items = [
    { label: 'Episodes', sublabel: 'Brain', value: stats?.episodes ?? 0, icon: Brain, color: '#8b5cf6' },
    { label: 'Entities', sublabel: 'Network', value: stats?.entities ?? 0, icon: Network, color: '#22c55e' },
    { label: 'Current Facts', sublabel: 'Active', value: stats?.currentFacts ?? 0, icon: Sparkles, color: '#eab308' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 min-h-[120px]">
      {items.map(it => (
        <div key={it.label} className={`${SELF_CARD_CLASS} relative overflow-hidden`}>
          <DotPattern opacity={0.05} radius={0.8} gap={16} className="absolute inset-0 text-[#8b5cf6]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <it.icon className="w-4 h-4" style={{ color: it.color }} />
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">{it.sublabel}</span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: it.color }}>
              {loading ? <Skeleton className="h-6 w-16" /> : <NumberTicker value={it.value} />}
            </div>
            <div className="text-[12px] text-zinc-400 mt-1">{it.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LifePage() {
  useEffect(() => { startPhaseClock(); }, [])
  const { phases, loading, error, savePhase, reflect } = useLifePhases()
  const covenant = useCovenant()
  const memories = useMemories()

  console.log('%c[LifePage] v2.0 loaded', 'color: #fbbf24; font-weight: bold')

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('life-view-mode') as ViewMode) || 'river' } catch { return 'river' }
  })
  const [pageTab, setPageTab] = useState<PageTab>('covenant')

  const [lens, setLens] = useState<LensId>('phases')
  const [zoomStop, setZoomStop] = useState('Life')
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingPhase, setEditingPhase] = useState<LifePhase | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [ltgs, setLtgs] = useState<LongTermGoal[]>([])
  const [viewing, setViewing] = useState<LoadedMemory | null>(null)
  const [redirectMode, setRedirectMode] = useState<'instant' | 'confirm'>(() => {
    try { return (localStorage.getItem('life-redirect-mode') as 'instant' | 'confirm') || 'instant' } catch { return 'instant' }
  })
  const [confirmRedirect, setConfirmRedirect] = useState<{ lens: LensId; label: string } | null>(null)
  const [goldVersion, setGoldVersion] = useState(0)
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null)
  const [expandedMode, setExpandedMode] = useState<'system' | 'manual'>('system')

  const togglePhaseContext = useCallback((phaseId: string) => {
    setExpandedPhaseId(current => current === phaseId ? null : phaseId)
    setExpandedMode('system')
  }, [])

  const toggleRedirectMode = useCallback(() => {
    setRedirectMode(prev => {
      const next = prev === 'instant' ? 'confirm' : 'instant'
      try { localStorage.setItem('life-redirect-mode', next) } catch { /* ignore */ }
      return next
    })
  }, [])

  const handleAttachMemory = useCallback(async (memoryIds: string[], phaseId: string) => {
    for (const id of memoryIds) {
      const mem = memories.items.find(m => m.meta.id === id)
      if (mem) {
        await memories.updateMeta(id, { phaseId } as any)
      }
    }
  }, [memories])

  const handleAttachGoal = useCallback(async (goalIds: string[], phaseId: string) => {
    const api = (window as any).deskflowAPI
    for (const id of goalIds) {
      const goal = ltgs.find(g => g.id === id)
      if (goal) {
        const links = [...((goal as any).links || []), { type: 'life-phase', id: phaseId }]
        await api.saveGoalsBatch([{ ...goal, links }])
      }
    }
    setGoldVersion(v => v + 1)
  }, [ltgs])

  const handleDetachMemory = useCallback(async (memoryId: string) => {
    await memories.updateMeta(memoryId, { phaseId: undefined } as any)
  }, [memories])

  const handleDetachGoal = useCallback(async (goalId: string) => {
    const api = (window as any).deskflowAPI
    const goal = ltgs.find(g => g.id === goalId)
    if (goal) {
      const links = ((goal as any).links || []).filter((l: any) => l?.type !== 'life-phase')
      await api.saveGoalsBatch([{ ...goal, links }])
    }
    setGoldVersion(v => v + 1)
  }, [ltgs])

  const setMode = useCallback((m: ViewMode) => {
    setViewMode(m)
    try { localStorage.setItem('life-view-mode', m) } catch { /* ignore */ }
  }, [])

  const handleOpenPage = useCallback((page: string) => {
    const tabMap: Record<string, PageTab> = { memories: 'memories', gold: 'gold', covenant: 'covenant', profile: 'self', graph: 'self', brain: 'self', schedule: 'schedule', habits: 'habits' }
    if (tabMap[page]) {
      setPageTab(tabMap[page])
      setMode('pages')
    }
  }, [setMode])

  const feedRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll({ container: feedRef })
  const mapOpacity = useTransform(scrollY, [0, 200], [1, 0.85])
  const mapScale = useTransform(scrollY, [0, 300], [1, 0.97])

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
  }, [])

  const reloadGoals = useCallback(async () => {
    try {
      const gRes = await (window as any).deskflowAPI.getGoals(todayStr())
      if (gRes?.goals) setGoals(gRes.goals)
    } catch { /* non-critical */ }
  }, [])

  const reloadLtgs = useCallback(async () => {
    try {
      const lRes = await (window as any).deskflowAPI.getLongtermGoals()
      if (lRes?.goals) setLtgs(lRes.goals)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [gRes, lRes] = await Promise.all([
          (window as any).deskflowAPI.getGoals(todayStr()),
          (window as any).deskflowAPI.getLongtermGoals(),
        ])
        if (cancelled) return
        if (gRes?.goals) setGoals(gRes.goals)
        if (lRes?.goals) setLtgs(lRes.goals)
      } catch { /* non-critical */ }
    })()
    return () => { cancelled = true }
  }, [])

  const redirectToPage = useCallback((lens: LensId) => {
    const tabMap: Record<string, PageTab> = { covenant: 'covenant', gold: 'gold', memories: 'memories', profile: 'self', graph: 'self', brain: 'self', schedule: 'schedule', habits: 'habits' }
    const tab = tabMap[lens]
    if (tab) {
      setPageTab(tab)
      setMode('pages')
    }
  }, [setMode])

  const redirectToPageForAdd = useCallback((type: 'covenant' | 'gold' | 'memory') => {
    const lensMap: Record<string, LensId> = { covenant: 'covenant', gold: 'gold', memory: 'memories' }
    setLens(lensMap[type] || 'phases')
    if (redirectMode === 'instant') {
      redirectToPage(type)
    } else {
      const labelMap: Record<string, string> = { covenant: 'Covenant', gold: 'Goal', memory: 'Memory' }
      setConfirmRedirect({ lens: type, label: labelMap[type] || type })
    }
  }, [redirectMode, redirectToPage])

  const openAddForLens = useCallback((nextLens: LensId) => {
    setLens(nextLens)
    if (nextLens === 'phases') {
      setAdding(true)
      return
    }
    if (redirectMode === 'instant') {
      redirectToPage(nextLens)
    } else {
      const labelMap: Record<string, string> = { covenant: 'Covenant', gold: 'Goal', memories: 'Memory' }
      setConfirmRedirect({ lens: nextLens, label: labelMap[nextLens] || nextLens })
    }
  }, [redirectMode, redirectToPage])

  const LENS_META: Record<
    LensId,
    {
      label: string
      icon: typeof Layers
      blurb: string
      activeClass: string
    }
  > = {
    phases: {
      label: 'Phases',
      icon: Layers,
      blurb: 'The full cross-section — every chapter and every layer visible together.',
      activeClass: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
    },
    covenant: {
      label: 'Covenant',
      icon: Sparkles,
      blurb: 'The grain brightens — daily promises become texture in the ring.',
      activeClass: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
    },
    gold: {
      label: 'Gold',
      icon: Target,
      blurb: 'The branches brighten — long-term goals become visible.',
      activeClass: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
    },
    memories: {
      label: 'Memories',
      icon: Images,
      blurb: 'The amber pockets brighten — kept moments become visible.',
      activeClass: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
    },
  }

  const LensIcon = LENS_META[lens].icon

  const drafts = useMemo(() => {
    return (phases ?? [])
      .filter((p) => p.status === 'draft')
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  }, [phases])

  const todayISO = new Date().toISOString().slice(0, 10)

  const covenantCount = covenant.commitments?.length ?? 0
  const covenantCompletionsToday =
    covenant.completions?.filter((c) => c.date === todayISO).length ?? 0

  const goldCount = goals.length + ltgs.length
  const memoryCount = memories.items.length

  const scrollToPhase = useCallback((id: string) => {
    setActivePhaseId(id)
    setHighlightId(id)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 900)
    try {
      document.getElementById(`phase-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch { /* ignore */ }
  }, [])

  const handleRingClick = useCallback((id: string) => {
    const phase = phases.find(p => p.id === id)
    if (phase) {
      setEditingPhase(phase)
      scrollToPhase(id)
    }
  }, [phases, scrollToPhase])

  const toggleGoal = useCallback(
    async (goal: Goal) => {
      const newStatus = goal.status === 'done' ? 'active' : 'done'
      const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined
      setGoals(prev => prev.map(g => (g.id === goal.id ? { ...g, status: newStatus as any, completedAt } : g)))
      if (newStatus === 'done') confetti({ particleCount: 60, spread: 90, startVelocity: 40, colors: ['#8b5cf6', '#a78bfa', '#34d399', '#fbbf24'] })
      try {
        await (window as any).deskflowAPI.saveGoal(todayStr(), { ...goal, status: newStatus, completedAt })
      } catch {
        setGoals(prev => prev.map(g => (g.id === goal.id ? goal : g)))
      }
    },
    []
  )

  const handleAddGoal = useCallback(
    async (goal: Goal) => {
      setGoals(prev => [...prev, goal])
      try {
        await (window as any).deskflowAPI.saveGoal(todayStr(), goal)
        confetti({ particleCount: 50, spread: 80, startVelocity: 35, colors: ['#fbbf24', '#f59e0b', '#34d399', '#a78bfa'] })
        await reloadGoals()
      } catch {
        setGoals(prev => prev.filter(g => g.id !== goal.id))
      }
    },
    [reloadGoals]
  )

  const handleAddLTG = useCallback(
    async (form: LTGForm): Promise<boolean> => {
      try {
        const res = await (window as any).deskflowAPI.saveGoalsBatch([{
          id: `ltg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category,
          priority: form.priority,
          deadline: form.deadline || null,
          status: 'active',
          period: 'longterm',
          date: '2000-01-01',
          source: 'manual',
          links: [],
        }])
        if (res?.success) { await reloadLtgs(); return true }
        return false
      } catch { return false }
    },
    [reloadLtgs]
  )

  const handleKeepReflection = useCallback(
    (phase: Parameters<typeof reflect>[0], text: string) => {
      savePhase({ ...phase, reflection: text }, { silent: true })
    },
    [savePhase]
  )

  // Per-phase aggregates for the Ring & Grain hero.
  const nowYear = new Date().getFullYear()
  const memoriesByPhase = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of phases) {
      const endY = p.endYear && p.endYear > 0 ? p.endYear : nowYear
      map[p.id] = memories.items.filter(m => {
        const y = parseInt((m.meta.date || '').slice(0, 4), 10)
        return Number.isFinite(y) && y >= p.startYear && y <= endY
      }).length
    }
    return map
  }, [phases, memories.items, nowYear])

  const ltgsByPhase = useMemo(() => {
    const map: Record<string, LongTermGoal[]> = {}
    const yearOf = (s?: string | null) => {
      if (!s) return NaN
      const y = parseInt(String(s).slice(0, 4), 10)
      return Number.isFinite(y) ? y : NaN
    }
    for (const p of phases) {
      const endY = p.endYear && p.endYear > 0 ? p.endYear : nowYear
      map[p.id] = ltgs.filter(ltg => {
        const y = yearOf(ltg.deadline) || yearOf(ltg.createdAt)
        return Number.isFinite(y) && y >= p.startYear && y <= endY
      })
    }
    return map
  }, [phases, ltgs, nowYear])

  if (loading && phases.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-5" data-page="life">
        <div className="h-64 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/40" />
        <div className="h-40 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/40" />
        <div className="h-40 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/40" />
      </div>
    )
  }

  if (error && phases.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center" data-page="life">
        <p className="text-[13px] text-zinc-400">Could not load the river.</p>
        <p className="text-[12px] text-zinc-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-800/70"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-page="life">
      <CurrentCanvas accent="#fbbf24" render={renderNetwork} />
      <div className="relative z-10">
      {/* ── Mode Toggle ── */}
      <div className="sticky top-0 z-40 -mx-5 px-5 bg-zinc-900/20 backdrop-blur-md border-b border-zinc-800/50">
        <div className="flex items-center gap-2 py-2">
          <span className="text-[15px] font-semibold mr-2 text-[var(--text-primary)]">Life</span>

          {/* View mode toggle */}
          <div className="flex gap-1 bg-zinc-800/50 p-0.5 rounded-lg">
            {([
              { key: 'pages' as ViewMode, label: 'Pages', icon: Map },
              { key: 'river' as ViewMode, label: 'River', icon: Layers },
            ]).map(mode => (
              <button
                key={mode.key}
                onClick={() => setMode(mode.key)}
                className={`relative px-3 py-1.5 text-xs rounded-md transition-colors min-h-[36px] flex items-center gap-1.5 ${
                  viewMode === mode.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {viewMode === mode.key && (
                  <motion.div
                    layoutId="life-mode-pill"
                    className="absolute inset-0 rounded-md bg-zinc-700/80 border border-white/10"
                    transition={pillTransition}
                  />
                )}
                <mode.icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10 font-medium">{mode.label}</span>
              </button>
            ))}
          </div>

          {/* Page sub-tabs (only in pages mode) */}
          {viewMode === 'pages' && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-1 ml-2 bg-zinc-800/50 p-0.5 rounded-lg"
            >
              {PAGE_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setPageTab(tab.key)}
                  className={`relative px-3 py-1.5 text-xs rounded-md transition-colors min-h-[36px] flex items-center gap-1.5 ${
                    pageTab === tab.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {pageTab === tab.key && (
                    <motion.div
                      layoutId="life-page-pill"
                      className="absolute inset-0 rounded-md"
                      style={{ background: `${tab.accent}22`, border: `1px solid ${tab.accent}40` }}
                      transition={pillTransition}
                    />
                  )}
                  <tab.icon className="w-3.5 h-3.5 relative z-10" style={pageTab === tab.key ? { color: tab.accent } : undefined} />
                  <span className="relative z-10 font-medium">{tab.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {viewMode === 'pages' ? (
        /* ═══ OLD 3-TAB MODE ═══ */
        <div className="flex-1 min-h-0 overflow-auto p-5">
          <AnimatePresence mode="wait">
            {pageTab === 'covenant' && (
              <motion.div key="covenant" {...crossfade} className="max-w-3xl mx-auto">
                <CovenantPage embedded />
              </motion.div>
            )}
            {pageTab === 'memories' && (
              <motion.div key="memories" {...crossfade} className="max-w-4xl mx-auto">
                <MemoriesPage embedded />
              </motion.div>
            )}
            {pageTab === 'gold' && (
              <motion.div key="gold" {...crossfade} className="w-full">
                <GoldPage />
              </motion.div>
            )}
            {pageTab === 'notes' && (
              <motion.div key="notes" {...crossfade} className="max-w-5xl mx-auto">
                <NotesTab />
              </motion.div>
            )}
            {pageTab === 'schedule' && (
              <motion.div key="schedule" {...crossfade} className="max-w-5xl mx-auto">
                <SchedulePage />
              </motion.div>
            )}
            {pageTab === 'habits' && (
              <motion.div key="habits" {...crossfade} className="max-w-5xl mx-auto">
                <HabitsPage />
              </motion.div>
            )}
            {pageTab === 'self' && (
              <motion.div key="self" {...crossfade} className="max-w-5xl mx-auto relative" style={{ ['--page-accent' as string]: '#8b5cf6' }}>
                <SelfOrchestrator />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ═══ NEW RIVER MODE ═══ */
        <div className="flex flex-1 min-h-0 relative gap-6" ref={feedRef}>
          {/* Living substrate — full-bleed Aether background */}
          <LivingSubstrate />

          {/* Vital Thread — continuous glowing line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 pointer-events-none z-[1]"
            style={{
              background: 'linear-gradient(to bottom, rgba(251,191,36,0.25) 0%, rgba(111,179,143,0.2) 40%, rgba(56,189,248,0.15) 80%, transparent 100%)',
              filter: 'blur(0.5px)',
            }}
          />

          {/* Apex Map (sticky with scroll parallax) */}
          <motion.div
            style={{ opacity: mapOpacity, scale: mapScale }}
            className="sticky top-0 z-[5] w-[440px] max-w-[92vw] shrink-0 max-h-full overflow-y-auto ws-scroll space-y-3"
          >
            <CoreSample
              phases={phases}
              covenant={{ completions: covenant.completions, commitments: covenant.commitments }}
              memoriesByPhase={memoriesByPhase}
              ltgsByPhase={ltgsByPhase}
              selectedPhaseId={activePhaseId}
              onPhaseClick={handleRingClick}
              lens={lens}
              onLensChange={setLens}
              onOpenMemories={(phaseId) => {
                setActivePhaseId(phaseId)
                setLens('memories')
              }}
            />
            {phases.length > 0 && (
              <TimelineView phases={phases} onJump={scrollToPhase} />
            )}
            <RiverMap
              phases={phases}
              zoomStop={zoomStop}
              onZoomChange={setZoomStop}
              activePhaseId={activePhaseId}
              onPhaseClick={scrollToPhase}
              onAddPhase={() => setAdding(true)}
            />
          </motion.div>

          <div className="flex-1 min-w-0 min-h-0 overflow-auto p-5 ws-scroll relative z-10">
            <div className="mx-auto max-w-5xl space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <TodayTributary
                  covenant={covenant}
                  memories={memories}
                  goals={goals}
                  longTermGoals={ltgs}
                  onToggleGoal={toggleGoal}
                  onAddGoal={handleAddGoal}
                  onAddLTG={handleAddLTG}
                />
              </motion.div>

              {/* River controls — always visible */}
              <section
                data-river-controls="always-visible"
                className="mt-6 space-y-4"
              >
                {/* Lens indicator — always visible */}
                <div
                  data-lens-indicator
                  className={`flex flex-col gap-3 rounded-xl border bg-zinc-900/75 backdrop-blur-xl px-5 py-4 md:flex-row md:items-center md:justify-between ${LENS_META[lens].activeClass}`}
                >
                  <div className="flex items-center gap-3">
                    <LensIcon className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">
                        {LENS_META[lens].label} lens active
                      </p>
                      <p className="text-[12px] text-zinc-400">
                        {LENS_META[lens].blurb}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(LENS_META) as LensId[]).map((key) => {
                      const Meta = LENS_META[key]
                      const Icon = Meta.icon

                      return (
                        <button
                          key={key}
                          onClick={() => setLens(key)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors ${
                            lens === key
                              ? Meta.activeClass
                              : 'border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {Meta.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Quick-add toolbar — always visible */}
                <div
                  data-quick-add
                  className="grid grid-cols-2 gap-2 lg:grid-cols-4"
                >
                  <button
                    onClick={() => openAddForLens('phases')}
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      lens === 'phases'
                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                        : 'border-zinc-800 bg-zinc-900/75 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      New Phase
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-1 text-[10px] text-amber-300">
                      <Mic className="h-3 w-3" />
                      voice
                    </span>
                  </button>

                  <button
                    onClick={() => openAddForLens('covenant')}
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      lens === 'covenant'
                        ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                        : 'border-zinc-800 bg-zinc-900/75 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      New Covenant
                    </span>

                    <Plus className="h-4 w-4 text-zinc-500" />
                  </button>

                  <button
                    onClick={() => openAddForLens('gold')}
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      lens === 'gold'
                        ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                        : 'border-zinc-800 bg-zinc-900/75 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      New Goal
                    </span>

                    <Plus className="h-4 w-4 text-zinc-500" />
                  </button>

                  <button
                    onClick={() => openAddForLens('memories')}
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      lens === 'memories'
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                        : 'border-zinc-800 bg-zinc-900/75 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Images className="h-4 w-4" />
                      New Memory
                    </span>

                    <Plus className="h-4 w-4 text-zinc-500" />
                  </button>
                </div>

                {/* Redirect mode toggle */}
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[11px] text-zinc-500">Add mode:</span>
                  <button
                    onClick={toggleRedirectMode}
                    className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/40 px-2 text-[10px] text-zinc-400 hover:text-zinc-300 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${redirectMode === 'instant' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {redirectMode === 'instant' ? 'Instant' : 'Confirm'}
                  </button>
                </div>

                {/* Data preview cards — always visible */}
                <div
                  data-preview-cards
                  className="grid gap-2 md:grid-cols-3"
                >
                  <button
                    onClick={() => setLens('covenant')}
                    className={`rounded-xl border p-5 text-left transition-colors ${
                      lens === 'covenant'
                        ? 'border-rose-400/40 bg-rose-500/10'
                        : 'border-zinc-800 bg-zinc-900/75 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-rose-300">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-[11px] uppercase tracking-wider">
                        Covenant
                      </span>
                    </div>

                    <p className="mt-3 text-2xl text-zinc-100">
                      {covenantCount}
                    </p>

                    <p className="text-[12px] text-zinc-500">
                      commitments · {covenantCompletionsToday} kept today
                    </p>
                  </button>

                  <button
                    onClick={() => setLens('gold')}
                    className={`rounded-xl border p-5 text-left transition-colors ${
                      lens === 'gold'
                        ? 'border-amber-400/40 bg-amber-500/10'
                        : 'border-zinc-800 bg-zinc-900/75 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-amber-300">
                      <Target className="h-4 w-4" />
                      <span className="text-[11px] uppercase tracking-wider">
                        Gold
                      </span>
                    </div>

                    <p className="mt-3 text-2xl text-zinc-100">
                      {goldCount}
                    </p>

                    <p className="text-[12px] text-zinc-500">
                      goals and long-term branches
                    </p>
                  </button>

                  <button
                    onClick={() => setLens('memories')}
                    className={`rounded-xl border p-5 text-left transition-colors ${
                      lens === 'memories'
                        ? 'border-emerald-400/40 bg-emerald-500/10'
                        : 'border-zinc-800 bg-zinc-900/75 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-emerald-300">
                      <Images className="h-4 w-4" />
                      <span className="text-[11px] uppercase tracking-wider">
                        Memories
                      </span>
                    </div>

                    <p className="mt-3 text-2xl text-zinc-100">
                      {memoryCount}
                    </p>

                    <p className="text-[12px] text-zinc-500">
                      amber pockets kept
                    </p>
                  </button>
                </div>

                {/* Draft shelf — always visible */}
                <div
                  data-drafts-shelf
                  className="rounded-xl border border-zinc-800 bg-zinc-900/75 backdrop-blur-xl p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileClock className="h-4 w-4 text-amber-300" />
                      <h3 className="text-sm font-medium text-zinc-100">
                        Draft chapters
                      </h3>
                    </div>

                    <span className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
                      {drafts.length}
                    </span>
                  </div>

                  {drafts.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-zinc-800 p-4">
                      <p className="text-[13px] text-zinc-500">
                        No saved drafts yet. Start a chapter and choose
                        “Save as draft” — it will appear here so you can return to it.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {drafts.map((draft) => (
                        <div
                          key={draft.id}
                          className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-zinc-200">
                              {draft.title || 'Untitled draft'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              {draft.category}
                              {draft.updatedAt
                                ? ` · updated ${new Date(draft.updatedAt).toLocaleString()}`
                                : ''}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => setEditingPhase(draft)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 text-[11px] text-amber-200 hover:bg-amber-400/15"
                            >
                              <Pencil className="h-3 w-3" />
                              Resume
                            </button>

                            <button
                              onClick={() =>
                                savePhase({
                                  ...draft,
                                  status: 'complete',
                                  updatedAt: new Date().toISOString(),
                                })
                              }
                              className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-2.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                            >
                              Mark complete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {phases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center">
                  <p className="text-[12.5px] text-zinc-600">
                    Add your first phase above and it will flow into the river.
                  </p>
                </div>
              ) : (
                phases.map((phase, i) => (
                  <motion.div
                    key={phase.id}
                    id={`phase-card-${phase.id}`}
                    className="scroll-mt-28"
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div
                      className={cn(
                        'rounded-xl transition-shadow duration-300',
                        highlightId === phase.id && 'ring-2 ring-amber-400/80 shadow-[0_0_30px_rgba(251,191,36,0.35)]'
                      )}
                    >
                    <PhaseCard
                      phase={phase}
                      active={activePhaseId === phase.id}
                      allPhases={phases}
                      covenant={{ commitments: covenant.commitments, completions: covenant.completions }}
                      memories={memories.items}
                      longTermGoals={ltgs}
                      onActiveChange={setActivePhaseId}
                      onSave={p => { savePhase(p) }}
                      onReflect={(p, answers, variation) => reflect(p, answers, variation)}
                      onKeepReflection={handleKeepReflection}
                      onOpenMemory={setViewing}
                      onJump={scrollToPhase}
                      lens={lens}
                      onAddMemory={() => redirectToPageForAdd('memory')}
                      onAddGoal={() => redirectToPageForAdd('gold')}
                      onAddCovenant={() => redirectToPageForAdd('covenant')}
                      onEditPhase={() => setEditingPhase(phase)}
                      expanded={expandedPhaseId === phase.id}
                      expandedMode={expandedMode}
                      onToggleExpand={() => togglePhaseContext(phase.id)}
                      onModeChange={setExpandedMode}
                      onAttachMemory={(ids) => handleAttachMemory(ids, phase.id)}
                      onAttachGoal={(ids) => handleAttachGoal(ids, phase.id)}
                      onCovenantSaved={() => {/* covenant saved via localStorage */}}
                      onDetachMemory={handleDetachMemory}
                      onDetachGoal={handleDetachGoal}
                      onOpenPage={handleOpenPage}
                    />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <PhaseFormDialog
            open={adding}
            onOpenChange={setAdding}
            allPhases={phases}
            onSave={p => {
              savePhase(p)
              setAdding(false)
            }}
          />

          <PhaseFormDialog
            open={!!editingPhase}
            onOpenChange={o => { if (!o) setEditingPhase(null) }}
            initial={editingPhase}
            allPhases={phases}
            onSave={p => {
              savePhase(p)
              setEditingPhase(null)
            }}
          />

          {viewing && <MemoryLightbox memory={viewing} onClose={() => setViewing(null)} />}

          {/* Confirm Redirect Dialog */}
          {confirmRedirect && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirmRedirect(null)}>
              <div className="w-full max-w-sm bg-zinc-900/95 border border-zinc-700 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-semibold text-zinc-100 mb-2">Switch to Pages mode?</h3>
                <p className="text-[13px] text-zinc-400 mb-5">
                  Open the {confirmRedirect.label} page to create with all available fields.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmRedirect(null)}
                    className="h-9 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { redirectToPage(confirmRedirect.lens); setConfirmRedirect(null) }}
                    className="h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 px-4 text-sm text-amber-100 hover:bg-amber-400/25 transition-colors"
                  >
                    Go to page
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
