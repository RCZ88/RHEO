import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Network, Brain, RefreshCw, ChevronDown,
  Zap, ExternalLink, MousePointerClick, Sparkles,
} from 'lucide-react'
import { ProfileTab } from '../../../components/life/ProfileTab'
import { useLifePhases } from '../../../hooks/useLifePhases'
import { SelfErrorBoundary } from './SelfErrorBoundary'
import { NeuralFlow } from '../context-brain/NeuralFlow'
import { BrainVisualization } from '../context-brain/BrainVisualization'
import { ActivityFeed } from '../context-brain/ActivityFeed'
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card'
import { fireNode } from '../context-brain/physics/avalanche'
import type { BrainActivityEvent } from '../context-brain/BrainVisualization'
import type { GraphNode, GraphLink } from '../context-graph/types'

/* reducedMotion hook */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  })
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** D3 — "Reflected today / yesterday / N days ago / <date>" for the reflection
 *  meta line. Delta-based (one clock: Date.now()) so no UTC day arithmetic. */
function relativeDay(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 'earlier'
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const fadeSlideUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

interface StatTileProps {
  label: string
  value: number
  loading?: boolean
  errored?: boolean
  icon: React.ReactNode
}

function StatTile({ label, value, loading, errored, icon }: StatTileProps) {
  return (
    <div className="flex items-center gap-2 min-w-0" data-stat={label.toLowerCase()}>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[var(--text-muted)]"
        aria-hidden="true"
      >
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 13 })
          : null}
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-4 w-10 rounded bg-zinc-800/60 animate-pulse" aria-hidden="true" />
        ) : (
          <div
            className="text-[15px] leading-none font-mono font-semibold tabular-nums text-[var(--text-primary)] min-w-[2ch]"
            aria-live={errored ? 'polite' : 'off'}
          >
            {value}
          </div>
        )}
        <div className="text-[10px] text-[var(--text-muted)] truncate">{label}</div>
      </div>
    </div>
  )
}

export function SelfOrchestrator() {
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)
  const [mgmtExpanded, setMgmtExpanded] = useState(false)
  const lifePhases = useLifePhases()

  const reducedMotion = useReducedMotion()

  const [graphLoading, setGraphLoading] = useState(true)
  const [graphError, setGraphError] = useState(false)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [activity, setActivity] = useState<BrainActivityEvent[]>([])

  const flowDataPoints = useMemo(
    () => (graphNodes as any[])
      .filter(n => typeof n.x === 'number' && typeof n.y === 'number')
      .map(n => ({ x: n.x, y: n.y, strength: n.state === 'active' ? 0.5 : 0.1 })),
    [graphNodes],
  )

  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [graphW, setGraphW] = useState(960)
  const [graphH, setGraphH] = useState(560)

  useEffect(() => {
    const el = graphContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 2) setGraphW(Math.floor(w))
        if (h > 2) setGraphH(Math.floor(h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(false)
    try {
      const api = (window as any).deskflowAPI
      const data = await api?.brainStats?.()
      if (data) setStats(data)
      else setStatsError(true)
    } catch {
      setStatsError(true)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const loadGraphData = useCallback(async () => {
    try {
      setGraphLoading(true)
      setGraphError(false)
      const api = (window as any).deskflowAPI
      if (!api) { setGraphLoading(false); return }

      const result = await api.brainGetGraph?.({ maxNodes: 300, maxFacts: 500 })
      if (!result || result.status === 'error') {
        setGraphError(true)
        setGraphLoading(false)
        return
      }

      const nodes = (result.nodes || []).map((n: any) => ({
        id: n.id,
        name: n.name || n.id,
        type: n.type || 'concept',
        state: n.state || 'neutral',
        degree: n.degree || 0,
        facts: n.facts || [],
        source: n.source || 'brain',
        x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0,
        vx: n.vx ?? 0, vy: n.vy ?? 0, vz: n.vz ?? 0,
        lastFiredAt: n.lastFiredAt,
        lastFiredPeak: n.lastFiredPeak,
      }))
      const links = (result.links || []).map((l: any) => ({
        source: l.source,
        target: l.target,
        predicate: l.predicate || 'relates',
      }))

      setGraphNodes(nodes)
      setGraphLinks(links)
      console.log(`[SelfOrchestrator] graph: ${nodes.length} entities, ${links.length} links, status=${result.status}`)
      return
    } catch (e) {
      console.error('[SelfOrchestrator] graph load failed:', e)
      setGraphError(true)
    } finally {
      setGraphLoading(false)
    }
  }, [])

  useEffect(() => { loadGraphData() }, [loadGraphData])

  useEffect(() => {
    const unsub = (window as any).deskflowAPI?.onAiContextCaptured?.(() => { loadGraphData() })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [loadGraphData])

  const prevStatesRef = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.brainGetEntities) return
    let mounted = true
    const interval = setInterval(async () => {
      try {
        const entities = await api.brainGetEntities({ limit: 300 })
        if (!mounted) return
        const items = (entities?.items || entities || []) as any[]
        const now = Date.now()
        const prev = prevStatesRef.current
        if (prev === null) {
          prevStatesRef.current = new Map(items.map(e => [e.id, e.state]))
          return
        }
        const next = new Map<string, string>()
        const fired: BrainActivityEvent[] = []
        for (const e of items) {
          if (!e?.id) continue
          const was = prev.get(e.id)
          next.set(e.id, e.state)
          if (e.state === 'active' && was !== 'active') {
            fired.push({ nodeId: e.id, magnitude: 1, timestamp: now, depth: 0 })
            const live = graphNodes.find(n => n.id === e.id)
            if (live) fireNode(live as any, now, 1)
          }
        }
        prevStatesRef.current = next
        if (fired.length > 0) {
          setActivity(prevAct => [...fired, ...prevAct].slice(0, 50))
          window.dispatchEvent(new Event('braingraph:fire'))
        }
      } catch { /* a failed poll must not tear the page down */ }
    }, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [graphNodes])

  const handleNodeHover = useCallback((node: GraphNode | null) => setHoveredNode(node), [])
  const handleNodeClick = useCallback((node: GraphNode | null) => {
    if (!node) { setSelectedNode(null); setSelectedNodeIds(new Set()); return }
    if (selectedNode?.id === node.id) { setSelectedNode(null); setSelectedNodeIds(new Set()) }
    else { setSelectedNode(node); setSelectedNodeIds(new Set([node.id])) }
  }, [selectedNode])

  const handleActivity = useCallback((events: BrainActivityEvent[]) => {
    setActivity(prev => [...events, ...prev].slice(0, 50))
  }, [])

  const statItems = [
    { label: 'Episodes',  value: stats?.episodes     ?? 0, icon: <Brain size={13} /> },
    { label: 'Entities',  value: stats?.entities     ?? 0, icon: <Network size={13} /> },
    { label: 'Facts',     value: stats?.currentFacts ?? 0, icon: <Zap size={13} /> },
    { label: 'All-time',  value: stats?.facts        ?? 0, icon: <Sparkles size={13} /> },
  ]

  const hasGraph = graphNodes.length > 0

  const graphState: 'empty' | 'loading' | 'error' | 'populated' =
    graphError ? 'error'
    : graphLoading && !hasGraph ? 'loading'
    : hasGraph ? 'populated'
    : 'empty'

  return (
    <SelfErrorBoundary>
      <div className="relative w-full" data-section="life.self.brain">
        {/* Ambient layer */}
        <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
          <NeuralFlow
            opacity={reducedMotion ? 0.16 : 0.28}
            dataPoints={flowDataPoints}
            respectReducedMotion={!reducedMotion}
          />
        </div>

        {/* Masthead */}
        <header className="relative z-10 px-5 pt-5 pb-3">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[var(--page-accent)]"
                aria-hidden="true"
              >
                <Brain size={15} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] leading-none">
                  Context Brain
                </h2>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  {graphState === 'populated'
                    ? `${graphNodes.length} entities · ${graphLinks.length} connections`
                    : graphState === 'loading'
                      ? 'reading your knowledge graph'
                      : 'your knowledge graph'}
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-5 flex-wrap"
              data-section="life.self.signals"
              role="group"
              aria-label="Context Brain totals"
            >
              {statItems.map(s => (
                <StatTile key={s.label} {...s} loading={statsLoading} errored={statsError} />
              ))}
              <button
                onClick={() => { loadStats(); loadGraphData() }}
                aria-label="Refresh Context Brain"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none"
              >
                <RefreshCw size={11} className={graphLoading || statsLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
          {statsError && (
            <p className="text-[11px] text-rose-400 mt-2" role="status">
              Totals unavailable — the graph below is still live.
            </p>
          )}
        </header>

        {/* Stage: graph takes the FULL width (no side panel squishing it). */}
        <motion.div
          className="relative z-10 px-5 pb-5 flex flex-col gap-5"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* ── THE GRAPH (main) ── */}
          <motion.div
            custom={0}
            variants={fadeSlideUp}
            className="flex flex-col gap-5 min-w-0"
          >
            <div
              ref={graphContainerRef}
              className="relative rounded-xl overflow-hidden border-t border-[var(--ws-border)]"
              style={{ height: 'clamp(320px, 52vh, 420px)' }}
              data-section="life.self.graph"
            >
              {graphState === 'empty' && (
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <div className="flex flex-col items-center gap-3 text-center max-w-sm">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--page-accent)]"
                      aria-hidden="true"
                    >
                      <Network size={18} />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Your brain is empty</p>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Entities appear here automatically as you chat with the AI, complete goals,
                      and update life phases — then connect into the graph.
                    </p>
                    <button
                      onClick={loadGraphData}
                      className="mt-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-t border-[var(--ws-border)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none"
                    >
                      <RefreshCw size={11} /> Check again
                    </button>
                  </div>
                </div>
              )}
              <BrainVisualization
                nodes={graphNodes}
                links={graphLinks}
                width={graphW}
                height={graphH}
                state={graphState}
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
                onActivity={handleActivity}
                hoveredNode={hoveredNode}
                selectedNode={selectedNode}
                selectionSet={selectedNodeIds}
                reducedMotion={reducedMotion}
              />
            </div>

            {/* Reflection (below the brain visualization) */}
            <Card className="gap-0 py-0" data-section="life.self.reflection" aria-label="Reflection">
              <CardHeader className="px-4 pt-3 pb-2 border-b border-[var(--ws-border)] grid-rows-[auto]">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-[var(--page-accent)]" aria-hidden="true" />
                  <CardTitle>Reflection</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-3">
                {lifePhases.summary ? (
                  <>
                    <p className="warmth-serif text-[14px] leading-relaxed text-foreground/90 italic">{lifePhases.summary}</p>
                    {/* D3: reflection meta — when it was written and against how
                        many phases. Only shown when the payload carries it. */}
                    {(lifePhases.summaryUpdatedAt || lifePhases.summaryPhaseCount != null) && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {lifePhases.summaryUpdatedAt
                          ? `Reflected ${relativeDay(lifePhases.summaryUpdatedAt)}`
                          : 'Reflected earlier'}
                        {lifePhases.summaryPhaseCount != null ? ` · ${lifePhases.summaryPhaseCount} ${lifePhases.summaryPhaseCount === 1 ? 'phase' : 'phases'}` : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[12px] text-muted-foreground">No reflection yet.</p>
                )}
                <button
                  type="button"
                  onClick={() => lifePhases.summarize()}
                  disabled={lifePhases.loading}
                  className="mt-2 text-[12px] text-[var(--page-accent)]"
                >
                  {lifePhases.loading ? 'Reflecting…' : 'Reflect on my phases'}
                </button>
              </CardContent>
            </Card>

            {/* Avalanche readout */}
            <Card
              className="gap-0 py-0"
              data-section="life.self.activity"
              aria-label="Avalanche activity"
            >
              <CardHeader className="px-4 pt-3 pb-2 border-b border-[var(--ws-border)] grid-rows-[auto]">
                <div className="flex items-center gap-2">
                  <Zap size={12} className="text-[var(--color-amber-400)]" aria-hidden="true" />
                  <CardTitle>Avalanche readout</CardTitle>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {activity.length > 0 ? `${activity.length} events` : 'no events yet'}
                  </span>
                </div>
              </CardHeader>
              <div className="h-[220px] overflow-y-auto">
                <ActivityFeed
                  nodes={graphNodes}
                  activity={activity}
                  reducedMotion={reducedMotion}
                  onReplay={(originId) => {
                    const node = graphNodes.find(n => n.id === originId) || null
                    if (node) handleNodeClick(node)
                  }}
                />
              </div>
            </Card>
          </motion.div>

          {/* ── Identity (full width below the graph) ── */}
          <Card className="gap-0 py-0" data-section="life.self.identity">
            <CardHeader className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <User size={13} className="text-[var(--page-accent)]" aria-hidden="true" />
                <CardTitle>Identity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="min-w-0">
                <ProfileTab />
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--ws-border)]" data-section="life.self.legend">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium mb-2">
                  Reading the graph
                </p>
                <dl className="flex flex-col gap-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">Selected</dt>
                    <dd className="text-[var(--text-primary)] truncate font-mono min-w-0" data-selection-name="">
                      {selectedNode ? selectedNode.name : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">Connections</dt>
                    <dd className="text-[var(--text-primary)] font-mono tabular-nums">
                      {selectedNode ? (selectedNode.degree || 0) : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">Activity</dt>
                    <dd
                      className="font-mono tabular-nums"
                      style={{ color: hoveredNode ? 'var(--color-amber-400)' : undefined }}
                      data-avalanche-state={hoveredNode ? 'firing' : 'rest'}
                    >
                      {hoveredNode ? 'firing' : 'at rest'}
                    </dd>
                  </div>
                </dl>
                <p className="text-[10px] text-[var(--text-muted)] mt-3 leading-relaxed">
                  Amber means an event is firing right now. Drag a node to rearrange;
                  arrow keys move between them.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Governance (full width below) ── */}
          <Card className="gap-0 py-0" data-section="life.self.governance">
              <button
                onClick={() => setMgmtExpanded(v => !v)}
                aria-expanded={mgmtExpanded}
                className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MousePointerClick size={13} className="text-[var(--page-accent)] shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
                      Memory &amp; Brain Management
                    </span>
                    <span className="block text-[10px] text-[var(--text-muted)] font-mono">
                      episodes · entities · facts · retrieval
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-secondary)] tabular-nums">
                    <span>{statsLoading ? '—' : (stats?.episodes ?? 0)} ep</span>
                    <span>{statsLoading ? '—' : (stats?.entities ?? 0)} ent</span>
                    <span>{statsLoading ? '—' : (stats?.currentFacts ?? 0)} facts</span>
                  </span>
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className="text-[var(--text-muted)] transition-transform"
                    style={{ transform: mgmtExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  />
                </span>
              </button>

              <AnimatePresence initial={false}>
                {mgmtExpanded && (
                  <motion.div
                    key="mgmt-panel"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="border-t border-[var(--ws-border)]"
                  >
                    <CardContent className="px-4 py-4 pt-3">
                      <div className="flex items-center gap-4 flex-wrap">
                        <button
                          onClick={() => { window.location.hash = '#/ai' }}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium text-[var(--text-primary)] hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none"
                          style={{ borderTop: '1px solid var(--page-accent)' }}
                        >
                          <Brain size={12} /> Open in AI Assistant
                          <ExternalLink size={11} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-3 max-w-2xl leading-relaxed">
                        The knowledge graph, retrieval search, and external-AI trail also live on AI
                        Assistant, where they can be queried directly. This page keeps the identity
                        view and the live graph.
                      </p>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
        </motion.div>
      </div>
    </SelfErrorBoundary>
  )
}
