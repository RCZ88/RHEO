"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { Images, Layers, Map, BookOpen, Plus, X, ChevronDown, Target, Sparkles, User, Calendar, Activity} from 'lucide-react'


import { cn } from '@/lib/utils'

import { RiverMap } from '@/components/life-river/RiverMap'
import { TimelineView } from '@/components/life-river/TimelineView'
import { CoreSample } from '@/components/life-river/CoreSample'
import { TodayTributary } from '@/components/life-river/TodayTributary'
import { PhaseCard } from '@/components/life-river/PhaseCard'
import { PhaseFormDialog } from '@/components/life-river/phase-form-dialog'
import { MemoryLightbox } from '@/components/life-river/memory-lightbox'
import { NotesTab } from '@/components/life-river/NotesTab'
import { LivingSubstrate } from '@/components/life-river/LivingSubstrate'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { LensId } from '@/components/life-river/RingCanvas'
import { categoryOf, phaseSpanLabel, type LifePhase } from '@/lib/riverMath'
import { ENTITY_COLORS } from '@/lib/CategoryColors'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { DraftCard } from '@/components/life-river/NotesTab'
import lifePage from '@/pages/registry/pages/life'
import { usePageSurface } from '@/pages/registry'
import MemoriesPage from '../../features/memories/MemoriesPage'
import GoldPage from '../../features/warmth/gold/GoldPage'
import { SchedulePage } from '../../features/warmth/schedule/SchedulePage'
import { TrainingPage } from '../../features/warmth/training/TrainingPage'

import { SelfOrchestrator } from './self/SelfOrchestrator'
import { TimePanel } from '@/components/TimePanel'
import { confetti } from '../../components/ui/confetti'


import { useLifePhases } from '@/hooks/useLifePhases'
import { useCovenant } from '../../features/covenant/useCovenant'
import { useMemories, type LoadedMemory } from '../../features/memories/useMemories'

import type { Goal, LongTermGoal } from '../../components/dashboard/types'
import type { LTGForm } from '../warmth/gold/GoldPage'
import { CurrentCanvas } from '../../components/CurrentCanvas'
import { renderNetwork } from '../../lib/renderers/network'
import { startPhaseClock } from '../../lib/currentPhase'

/* §7b version stamp — proves the bundle carrying the covenant→Labs move is live. */
console.log('%c[LifePage] v2.2 loaded (river revamp: switcher + peek + drafts pocket)', 'color: #fbbf24; font-weight: bold')

const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => toStr(new Date())

type ViewMode = 'pages' | 'river'
/* Covenant moved to Labs (CZ 2026-11-14) — demoted from the rail because Gold
   already carries the goals + streak surfaces it duplicated. The tab id is
   retired here; the persisted value resolves via the manifest tabAlias and
   deep links redirect at the shell. The feature lives at /labs. */
type PageTab = 'memories' | 'gold' | 'notes' | 'schedule' | 'training' | 'self'

const PAGE_TABS: { key: PageTab; label: string; icon: typeof Images; accent: string }[] = [
  { key: 'memories', label: 'Memories', icon: Images, accent: 'var(--color-mem-400)' },
  /* Label is 'Goals' to match `pages/registry/pages/life.ts` and RESULT.md §1.2.
   * They disagreed: the palette said 'Goals', the rendered tab bar said 'Gold',
   * so the same tab carried two names depending on how you reached it. The KEY
   * stays 'gold' — that is the bookmarked/persisted identity. */
  { key: 'gold', label: 'Goals', icon: Layers, accent: 'var(--color-amber-400)' },
  { key: 'notes', label: 'Notes', icon: BookOpen, accent: 'var(--color-violet-400)' },
  { key: 'schedule', label: 'Schedule', icon: Calendar, accent: 'var(--color-pink-400)' },
  // `var(--page-accent)` rather than a literal: the sibling tabs hardcode hex, but
  // Training IS the Life signal hue, and `html.light[data-page="life"]` deliberately
  // darkens it (#93331d) for contrast on cream. Following the token keeps the tab
  // icon legible in both themes without adding a 6th hue.
  { key: 'training', label: 'Training', icon: Activity, accent: 'var(--page-accent)' },
  { key: 'self', label: 'Self', icon: User, accent: 'var(--color-violet-400)' },
]

const crossfade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
}

const pillTransition = { duration: 0.25, ease: [0.19, 1, 0.22, 1] as [number, number, number, number] }


/** §3.7 — payload of a cross-page entity deep-link (rheo:navigate). */
export interface LifeDeepLink {
  tab?: string;
  noteId?: string;
  goalId?: string;
  phaseId?: string;
}

export interface LifePageProps {
  initialTab?: PageTab;
  /** Entity payload forwarded by the shell's rheo:navigate listener. */
  deepLink?: LifeDeepLink;
  /** Called once the link has been routed into local state. */
  onDeepLinkConsumed?: () => void;
}
export default function LifePage({ initialTab, deepLink, onDeepLinkConsumed }: LifePageProps = {}) {
  useEffect(() => { startPhaseClock(); }, [])
  const navigate = useNavigate()
  const { phases, loading, error, savePhase, deletePhase, reflect } = useLifePhases()
  const covenant = useCovenant()
  const memories = useMemories()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('life-view-mode') as ViewMode) || 'river' } catch { return 'river' }
  })
  const [pageTab, setPageTab] = useState<PageTab>(() => {
    try {
      const v = localStorage.getItem('life-page-tab') as PageTab | null
      const valid = ['memories','gold','notes','schedule','training','self'] as PageTab[]
      return v && valid.includes(v) ? v : 'gold'
    } catch { return 'gold' }
  })
  useEffect(() => {
    try { localStorage.setItem('life-page-tab', pageTab) } catch { /* ignore */ }
  }, [pageTab])

  // Deep-nav landing, delegated to the page registry.
  //
  // This used to be a hand-rolled 30-line effect that read the hash query and
  // localStorage and nothing else. It therefore never read
  // `location.state.tab` — which is the channel a SAME-SESSION jump uses —
  // so pressing Ctrl+K and choosing `Life -> Notes` navigated to /life and
  // silently stayed on whatever tab was open. Combined with the palette having
  // no `notes` row at all, Notes had no working deep-nav path from anywhere.
  //
  // `onTabRequest` fires once per navigation (keyed on `location.key`), which
  // matters because /life -> /life does not change the pathname, so this
  // component does not remount and a `useEffect([])` would never re-run.
  // River mode has to be forced off: the seven tabs only render in `pages`
  // mode, so arriving on a tab while the River is open would leave the tab
  // set but nothing on screen.
  usePageSurface(lifePage, {
    onTabRequest: (tab) => {
      setPageTab(tab as PageTab);
      setViewMode('pages');
    },
  });

  // Deep-nav from rheo:navigate (shell-level listener routes here via props).
  useEffect(() => {
    // Validate against PAGE_TABS on read — a bogus tab must never reach state
    // (§3.1 of the Life revamp spec; guards against renamed tabs).
    if (initialTab && PAGE_TABS.some(t => t.key === initialTab)) {
      setPageTab(initialTab);
      setViewMode('pages');
    }
  }, [initialTab]);

  // §3.7 — entity deep-links. A chip used to carry only the tab, so "jump to
  // goal X" landed on the Goals tab and nowhere near goal X. The shell now
  // forwards the whole payload; it is COPIED into local state (and consumption
  // reported) immediately, because the shell clears its copy right after this
  // effect — the child tabs below must keep reading a value that survives
  // until THEY have consumed their own field.
  const [pendingLink, setPendingLink] = useState<LifeDeepLink | null>(null);
  useEffect(() => {
    if (!deepLink) return;
    setPendingLink(deepLink);
    if (deepLink.tab && PAGE_TABS.some(t => t.key === deepLink.tab)) {
      setPageTab(deepLink.tab as PageTab);
      setViewMode('pages');
    }
    if (deepLink.phaseId) {
      // A phase lives in the river view (CoreSample/RiverMap); the Self tab
      // shows reflection meta, not the phase entity. This is the same jump
      // GoldPage.onManagePhases already performs for phase management.
      setViewMode('river');
      setLens('phases');
    }
    onDeepLinkConsumed?.();
    // onDeepLinkConsumed only clears the shell copy (idempotent); excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const consumeLinkField = useCallback((field: 'noteId' | 'goalId') => {
    setPendingLink(p => (p ? { ...p, [field]: undefined } : p));
  }, []);
  const onNoteLinkConsumed = useCallback(() => consumeLinkField('noteId'), [consumeLinkField]);
  const onGoalLinkConsumed = useCallback(() => consumeLinkField('goalId'), [consumeLinkField]);

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
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null)
  const [expandedMode, setExpandedMode] = useState<'system' | 'manual'>('system')

  const togglePhaseContext = useCallback((phaseId: string) => {
    setExpandedPhaseId(current => current === phaseId ? null : phaseId)
    setExpandedMode('system')
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
  }, [ltgs])

  const setMode = useCallback((m: ViewMode) => {
    setViewMode(m)
    try { localStorage.setItem('life-view-mode', m) } catch { /* ignore */ }
  }, [])

  const handleOpenPage = useCallback((page: string) => {
    /* Covenant moved to Labs (CZ 2026-11-14): the name resolves to the parked
       page instead of a tab that no longer exists. */
    if (page === 'covenant') {
      navigate('/labs#covenant')
      return
    }
    const tabMap: Record<string, PageTab> = { memories: 'memories', gold: 'gold', profile: 'self', graph: 'self', brain: 'self', schedule: 'schedule', habits: 'gold' }
    if (tabMap[page]) {
      setPageTab(tabMap[page])
      setMode('pages')
    }
  }, [setMode, navigate])

  const feedRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll({ container: scrollRef })
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
    /* Covenant moved to Labs (CZ 2026-11-14): with the tab gone from the rail,
       the covenant lens's redirect hands off to the parked page instead — and
       the ?add intent opens its form, same contract the old tab honoured. */
    if (lens === 'covenant') {
      navigate('/labs?add=covenant#covenant')
      return
    }
    const tabMap: Record<string, PageTab> = { gold: 'gold', memories: 'memories', profile: 'self', graph: 'self', brain: 'self', schedule: 'schedule', habits: 'gold' }
    const tab = tabMap[lens]
    if (tab) {
      setPageTab(tab)
      setMode('pages')
    }
  }, [setMode, navigate])

  // §3.6 quick-add honesty — the handoff. Quick-add navigates into the target
  // tab AND marks the pending add; the tab consumes the signal by opening (and
  // autofocusing) its own add form. Navigation, not a second writer.
  const [pendingAdd, setPendingAdd] = useState<LensId | null>(null)

  /* §4.2 — in-flow peek: LTG chips inspect without leaving the river. Same
     grammar as NoteDetailView's chips: inspecting deliberately does not
     navigate (leaving the river for a goal title is a bigger interruption
     than the one asked for) — navigating is offered inside the peek. */
  type PeekTarget = { phaseId: string; kind: 'ltg'; id: string; label: string }
  const [peek, setPeek] = useState<PeekTarget | null>(null)
  const handleInspect = useCallback((t: PeekTarget) => {
    setPeek(prev => prev && prev.phaseId === t.phaseId && prev.id === t.id ? null : t)
  }, [])
  const openPeekPage = useCallback((t: PeekTarget) => {
    window.dispatchEvent(new CustomEvent('rheo:navigate', { detail: { path: '/life', tab: 'gold', goalId: t.id } }))
    setPeek(null)
  }, [])

  /* §4.3 — drafts fold into one amber pocket after the flow (§9.2: D5-amber
     when the Settings toggle is on, neutral zinc when off). */
  const [draftsOpen, setDraftsOpen] = useState(false)
  const draftAccent = useMemo(() => {
    try {
      const raw = localStorage.getItem('deskflow-life-draft-accent')
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p?.enabled === 'boolean') return p.enabled as boolean
      }
    } catch { /* default on */ }
    return true
  }, [])

  const redirectToPageForAdd = useCallback((type: 'covenant' | 'gold' | 'memory') => {
    /* §3.7 — the Instant/Confirm toggle died; adds redirect instantly.
       Covenant hands off to Labs (the tab is parked there since 2026-11-14),
       with the ?add intent opening its form, same contract the tab honoured. */
    if (type === 'covenant') {
      navigate('/labs?add=covenant#covenant')
      return
    }
    const lens: LensId = type === 'gold' ? 'gold' : 'memories'
    setLens(lens)
    redirectToPage(lens)
    setPendingAdd(lens)
  }, [navigate, redirectToPage])

  const openAddForLens = useCallback((nextLens: LensId) => {
    setLens(nextLens)
    if (nextLens === 'phases') {
      setAdding(true)
      return
    }
    /* §3.7 — instant-only: the toggle and its confirm dialog died with it. */
    redirectToPage(nextLens)
    if (nextLens !== 'covenant') setPendingAdd(nextLens)
  }, [redirectToPage])

  /* §4.1/§9.1 — the lens hue law: a lens's color IS its LENS_META entry, no
     second list. light: steps added per §9.1's ink rule (raw -100 text on
     cream is unreadable; the ink step carries both themes). ADD_NOUN feeds the
     + quick-add chips (§3.7: the quick-add row died, its labels survive here). */
  const ADD_NOUN: Record<LensId, string> = { phases: 'Phase', covenant: 'Covenant', gold: 'Goal', memories: 'Memory' }

  const LENS_META: Record<
    LensId,
    {
      label: string
      icon: typeof Layers
      activeClass: string
    }
  > = {
    phases: {
      label: 'Phases',
      icon: Layers,
      activeClass: 'border-amber-400/40 bg-amber-400/10 text-amber-100 light:border-amber-500/40 light:bg-amber-500/10 light:text-amber-700',
    },
    covenant: {
      label: 'Covenant',
      icon: Sparkles,
      activeClass: 'border-rose-400/40 bg-rose-500/10 text-rose-100 light:border-rose-500/40 light:bg-rose-500/10 light:text-rose-700',
    },
    gold: {
      label: 'Gold',
      icon: Target,
      activeClass: 'border-amber-400/40 bg-amber-500/10 text-amber-100 light:border-amber-500/40 light:bg-amber-500/10 light:text-amber-700',
    },
    memories: {
      label: 'Memories',
      icon: Images,
      activeClass: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100 light:border-emerald-500/40 light:bg-emerald-500/10 light:text-emerald-700',
    },
  }

  const drafts = useMemo(() => {
    return (phases ?? [])
      .filter((p) => p.status === 'draft')
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  }, [phases])

  /* §3.7 — the preview cards died; these count memos were their only readers.
     `todayStr()` remains in use by the goal loaders below. */

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

  // §3.7 — scroll the deep-linked phase into view once the river has rendered
  // it. Depends on `phases` so a landing that beats the fetch still scrolls
  // when the data arrives. scrollToPhase already selects + highlights the card.
  useEffect(() => {
    const phaseId = pendingLink?.phaseId;
    if (!phaseId || phases.length === 0) return;
    const t = window.setTimeout(() => {
      scrollToPhase(phaseId);
      setPendingLink(p => (p ? { ...p, phaseId: undefined } : p));
    }, 250);
    return () => window.clearTimeout(t);
  }, [pendingLink, phases.length, scrollToPhase]);

  const toggleGoal = useCallback(
    async (goal: Goal) => {
      const newStatus = goal.status === 'done' ? 'active' : 'done'
      const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined
      setGoals(prev => prev.map(g => (g.id === goal.id ? { ...g, status: newStatus as any, completedAt } : g)))
      if (newStatus === 'done') confetti({ particleCount: 60, spread: 90, startVelocity: 40, colors: ['var(--color-violet-400)', 'var(--color-violet-300)', 'var(--color-emerald-400)', 'var(--color-amber-400)'] })
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
        confetti({ particleCount: 50, spread: 80, startVelocity: 35, colors: ['var(--color-amber-400)', 'var(--color-amber-300)', 'var(--color-emerald-400)', 'var(--color-violet-300)'] })
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
        <div className="h-64 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]" />
        <div className="h-40 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]" />
        <div className="h-40 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]" />
      </div>
    )
  }

  if (error && phases.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center" data-page="life">
        <p className="text-[13px] text-zinc-400 light:text-[var(--text-muted)]">Could not load the river.</p>
        <p className="text-[12px] text-zinc-500 light:text-[var(--text-primary)]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-raised)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--ws-surface-hover)]"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-page="life">
      <CurrentCanvas accent="var(--color-amber-400)" render={renderNetwork} />
      {/* THE HEIGHT CHAIN. This wrapper holds the sticky header AND the content
          box, so it has to be the flex child that consumes the remaining height.

          It was `relative z-10` alone — no `flex-1 min-h-0`. A flex item with
          auto basis in a `flex-col h-full` parent sizes to its CONTENT, so the
          content box's own `flex-1` had no definite height to divide, and every
          descendant that relies on `height:100%` — ScheduleLayoutShell's grid,
          which scrolls each panel internally — resolved against `auto`. The grid
          then overflowed its box and the page grew a second scroller on top of
          the shell, which is the "something is covering the schedule" report.

          `flex-1` gives it the leftover height; `min-h-0` lets it actually shrink
          below its content's intrinsic size instead of being floored by it.
          `flex flex-col` makes the content box a real child that can flex. */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
      {/* ── Mode Toggle ── */}
      {/* `shrink-0` so the header cannot be squeezed out of existence now that this
          column is a real flex child — previously it was floored at its content
          height only because the parent was auto-sized. `relative` rather than
          `sticky`: with the Schedule shell scrolling its own panels there is no
          page scroller for sticky to track, and a z-40 sticky header sat over the
          top of that scroller on every tab that does scroll. */}
      <div className="relative shrink-0 -mx-5 px-5 bg-zinc-900/20 light:bg-[var(--ws-surface-raised)] border-b border-zinc-800/50">
        <div className="flex items-center gap-2 py-2">
          <span className="text-[15px] font-semibold mr-2 text-[var(--text-primary)]">Life</span>

          {/* View mode toggle */}
          <div className="flex gap-1 bg-zinc-800/50 p-0.5 rounded-lg" data-section="life.view-switch" data-tutorial="life.view-switch">
            {([
              { key: 'pages' as ViewMode, label: 'Pages', icon: Map },
              { key: 'river' as ViewMode, label: 'River', icon: Layers },
            ]).map(mode => (
              <button
                key={mode.key}
                onClick={() => setMode(mode.key)}
                className={`relative px-3 py-1.5 text-xs rounded-md transition-colors min-h-[36px] flex items-center gap-1.5 ${
                  viewMode === mode.key ? 'text-white' : 'text-zinc-500 light:text-[var(--text-muted)] hover:text-zinc-300 light:hover:text-[var(--text-primary)]'
                }`}
              >
                {viewMode === mode.key && (
                  <motion.div
                    layoutId="life-mode-pill"
                    className="absolute inset-0 rounded-md bg-zinc-700/80 light:bg-[var(--ws-surface-sunken)] border border-white/10 light:border-[var(--ws-border)]"
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
              className="flex gap-1 ml-2 bg-zinc-800/50 light:bg-[var(--ws-surface-sunken)] p-0.5 rounded-lg"
              data-section="life.tabs"
              data-tutorial="life.tabs"
            >
              {PAGE_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setPageTab(tab.key)}
                  className={`relative px-3 py-1.5 text-xs rounded-md transition-colors min-h-[36px] flex items-center gap-1.5 ${
                    pageTab === tab.key ? 'text-white' : 'text-zinc-500 light:text-[var(--text-muted)] hover:text-zinc-300 light:hover:text-[var(--text-primary)]'
                  }`}
                >
                  {pageTab === tab.key && (
                    <motion.div
                      layoutId="life-page-pill"
                      className="absolute inset-0 rounded-md"
                      style={{ background: `color-mix(in srgb, ${tab.accent} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${tab.accent} 40%, transparent)` }}
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
      {/* Containment, keyed by tab.
          The route boundary in App.tsx is `key={location.pathname}`, and a Life
          sub-tab switch is internal state — the pathname does not change. So a
          boundary that trips on ONE tab never resets when you click to another,
          and its fallback is `fixed inset-0 z-[9999]`: measured against the built
          bundle, that replaces the entire viewport including the sidebar, so
          every subpage looks dead until a real route change. Keying a boundary
          on the tab makes one tab's crash cost exactly that tab.
          ErrorBoundary renders its child directly when healthy, so this adds no
          DOM node and no layout box.
          Ruled out while finding this, recorded so nobody re-suspects it:
          `mode="wait"` does NOT stall on the schedule tab's non-motion wrapper.
          framer-motion's PresenceChild auto-completes an exit only when no motion
          descendant registered, and the wrapper's motion child does register
          through context and does fire its exit. */}
      <ErrorBoundary key={`${viewMode}:${pageTab}`}>
      <div className="flex-1 min-h-0 flex flex-col">
      {viewMode === 'pages' ? (
        /* ═══ OLD 3-TAB MODE ═══ */
        /* Schedule is full-bleed: its shell owns the whole content box and
           scrolls each panel internally. Every other tab keeps the page scroller
           plus padding. */
        <div className={`flex-1 min-h-0 ${pageTab === 'schedule' ? 'overflow-hidden' : 'overflow-auto p-5'}`}>
          <AnimatePresence mode="wait">
            {pageTab === 'memories' && (
              <motion.div key="memories" {...crossfade} className="w-full" data-section="life.memories">
                <MemoriesPage embedded addRequest={pendingAdd === 'memories'} onAddConsumed={() => setPendingAdd(null)} />
              </motion.div>
            )}
            {pageTab === 'gold' && (
              <motion.div key="gold" {...crossfade} className="w-full" data-section="life.gold">
                {/* Phases live in River (RESULT.md §2.1), so Gold only navigates
                    there. The handler is a prop because Gold also mounts standalone
                    at `/gold`, where no River exists — and because a window event
                    this page would have to listen for was the kind of channel that
                    silently does nothing when one half is renamed. */}
                <GoldPage onManagePhases={() => { setViewMode('river'); setLens('phases') }} vaultAddRequest={pendingAdd === 'gold'} onVaultAddConsumed={() => setPendingAdd(null)} focusGoalId={pendingLink?.goalId ?? null} onFocusConsumed={onGoalLinkConsumed} />
              </motion.div>
            )}
            {pageTab === 'notes' && (
              <motion.div key="notes" {...crossfade} className="w-full" data-section="life.notes" data-tutorial="life.notes">
                <NotesTab focusNoteId={pendingLink?.noteId ?? null} onFocusConsumed={onNoteLinkConsumed} />
              </motion.div>
            )}
            {pageTab === 'schedule' && (
              /* The schedule shell owns exactly one screen: its grid is 100% of
                 whatever box it is given and each panel scrolls INSIDE itself
                 (§17). Wrapping it in the tab area's `p-5` + `overflow-auto`
                 made the shell 100% of a padded, scrollable box — so the grid
                 overflowed by the padding and the outer scroller scrolled a
                 second time. That is the "something is covering the schedule
                 page" report. Full bleed + overflow-hidden here, so the shell
                 gets the whole content box and nothing clips. */
              <div className="h-full min-h-0 overflow-hidden">
                <motion.div key="schedule" {...crossfade} className="w-full h-full min-h-0" data-section="life.schedule">
                  <SchedulePage embedded />
                </motion.div>
              </div>
            )}
            {/* Training carries NO inline --page-accent override, deliberately. The
                `data-page="life"` key in src/index.css already defines that custom
                property, and it defines a DIFFERENT (darker) value under
                `html.light[data-page="life"]` so the hue keeps contrast on the cream
                light surface. Setting it inline here forced the dark-theme value onto
                the light theme — which is exactly how a token gets defeated by a
                literal that looks correct in the one theme you happen to be viewing. */}
            {pageTab === 'training' && (
              <motion.div key="training" {...crossfade} className="w-full relative" data-section="life.training">
                <TrainingPage />
              </motion.div>
            )}
            {pageTab === 'self' && (
              <motion.div key="self" {...crossfade} className="w-full relative" data-section="life.self" style={{ ['--page-accent' as string]: 'var(--color-violet-400)' }}>
                <SelfOrchestrator />
              </motion.div>
            )}
            {pageTab === 'self' && (
              <motion.div key="time" {...crossfade} className="w-full mt-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 light:bg-[var(--ws-surface-raised)] light:border-[var(--ws-border)]" data-section="life.time">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)] mb-2">Time — timers, stopwatches & alarms</div>
                <TimePanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ═══ NEW RIVER MODE ═══ */
        <div className="flex flex-1 min-h-0 relative gap-6" ref={feedRef} data-section="life.river">
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

          <div ref={scrollRef} className="flex-1 min-w-0 min-h-0 overflow-auto pl-5 pr-0 ws-scroll relative z-10">
            <div className="w-full space-y-8">
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

              {/* River controls — §4.1: the lens switcher is the river's single
                  persistent control. §3.7 retired the indicator card, the
                  quick-add row, the Instant/Confirm toggle, the preview cards
                  and the draft shelf; the quick-add labels survive as the +
                  half of each lens chip. */}
              <section data-river-controls="always-visible" className="mt-6">
                <div
                  data-section="life.lenses"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {(Object.keys(LENS_META) as LensId[]).map((key) => {
                    const Meta = LENS_META[key]
                    const Icon = Meta.icon
                    const active = lens === key

                    return (
                      <div
                        key={key}
                        className={`inline-flex h-8 items-stretch overflow-hidden rounded-lg border transition-colors ${
                          active
                            ? Meta.activeClass
                            : 'border-zinc-800 bg-zinc-950 light:bg-[var(--ws-surface-40)] text-zinc-500 light:text-[var(--text-muted)]'
                        }`}
                      >
                        <button
                          onClick={() => setLens(key)}
                          aria-pressed={active}
                          className="inline-flex items-center gap-1.5 px-2.5 text-[11px] transition-colors hover:text-zinc-200 light:hover:text-[var(--text-primary)]"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {Meta.label}
                        </button>
                        <button
                          onClick={() => openAddForLens(key)}
                          aria-label={`New ${ADD_NOUN[key]}`}
                          className="inline-flex items-center border-l border-black/10 px-1.5 transition-colors hover:bg-black/[0.06] hover:text-zinc-200 light:border-white/10 light:hover:bg-white/10 light:hover:text-[var(--text-primary)]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>

              {phases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 light:border-[var(--ws-border)] py-10 text-center">
                  <p className="text-[12.5px] text-zinc-500 light:text-[var(--text-muted)]">
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
                      memoriesLoading={memories.loading}
                      onUploadMemory={memories.upload}
                      onBackfillThumbnails={memories.backfillThumbnails}
                      scrollContainerRef={scrollRef}
                      longTermGoals={ltgs}
                      onActiveChange={setActivePhaseId}
                      onSave={p => { savePhase(p) }}
                      onReflect={(p, answers, variation, captions) => reflect(p, answers, variation, captions)}
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
                      onInspect={handleInspect}
                    />
                    </div>
                    <AnimatePresence>
                      {peek && peek.phaseId === phase.id && (
                        <motion.div
                          key="peek"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                          role="region"
                          aria-label={`Peek: ${peek.label}`}
                          className={`mt-3 flex items-start gap-3 rounded-xl border p-3 ${ENTITY_COLORS.ltg.border} ${ENTITY_COLORS.ltg.bg} ${ENTITY_COLORS.ltg.lightBorder} ${ENTITY_COLORS.ltg.lightBg}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`text-[10px] uppercase tracking-wider ${ENTITY_COLORS.ltg.text} ${ENTITY_COLORS.ltg.lightText}`}>Long-term goal</p>
                            <p className="truncate text-[13px] text-zinc-200 light:text-[var(--text-primary)]">{peek.label}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => openPeekPage(peek)}
                              className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] transition-colors hover:bg-black/[0.05] light:hover:bg-black/[0.03] ${ENTITY_COLORS.ltg.lightBorder} ${ENTITY_COLORS.ltg.text} ${ENTITY_COLORS.ltg.lightText}`}
                            >
                              Open full page
                            </button>
                            <button
                              onClick={() => setPeek(null)}
                              aria-label="Close peek"
                              className="-m-1 rounded p-1 text-zinc-500 light:text-[var(--text-muted)] transition-colors hover:text-zinc-200 light:hover:text-[var(--text-primary)]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
              {/* §4.3 — drafts fold into one amber pocket AFTER the flow, not a
                  shelf above it (D5: accent follows the Settings toggle). */}
              {drafts.length > 0 && (
                <Collapsible
                  open={draftsOpen}
                  onOpenChange={setDraftsOpen}
                  data-section="life.drafts"
                  className={draftAccent ? 'rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.04]' : 'rounded-xl border border-dashed border-zinc-700/50 bg-zinc-800/20'}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-black/[0.04]">
                    <span className={`text-[12px] font-medium ${draftAccent ? 'text-amber-300' : 'text-zinc-300 light:text-[var(--text-primary)]'}`}>
                      Drafts ({drafts.length})
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 ${draftAccent ? 'text-amber-400/70' : 'text-zinc-500'} transition-transform duration-200 ${draftsOpen ? 'rotate-180' : ''}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                      {drafts.map((d) => (
                        <DraftCard
                          key={d.id}
                          note={{ id: d.id, title: d.title || 'Untitled draft', content: '', updated_at: d.updatedAt }}
                          meta={[categoryOf(d.category).label, phaseSpanLabel(d)].filter(Boolean).join(' · ')}
                          onResume={() => { setEditingPhase(d); setPeek(null) }}
                          onDiscard={(id) => deletePhase(id)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
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
        </div>
      )}
      </div>
      </ErrorBoundary>
      </div>
    </div>
  )
}
