import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Network, Brain, RefreshCw, ChevronDown,
  Zap, ExternalLink, MousePointerClick, Sparkles, Box, Layers,
} from 'lucide-react'
import { ProfileTab } from '../../../components/life/ProfileTab'
import { SelfErrorBoundary } from './SelfErrorBoundary'
import { DotPattern } from '../../../components/ui/dot-pattern'
import { NeuralFlow } from '../context-brain/NeuralFlow'
import { BrainVisualization } from '../context-brain/BrainVisualization'
import { ActivityFeed } from '../context-brain/ActivityFeed'
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card'
import { fireNode } from '../context-brain/physics/avalanche'
import type { BrainActivityEvent } from '../context-brain/BrainVisualization'
import type { GraphNode, GraphLink } from '../context-graph/types'
import { ContextGraph } from '../../../components/life/ContextGraph'
import { webglSupported } from '../../../lib/webgl'

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

  const reducedMotion = useReducedMotion()

  const [graphLoading, setGraphLoading] = useState(true)
  const [graphError, setGraphError] = useState(false)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [activity, setActivity] = useState<BrainActivityEvent[]>([])

  const [graphView, setGraphView] = useState<'2d' | '3d'>('2d')

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

      const nodeMap = new Map<string, GraphNode>()
      const edgeList: GraphLink[] = []

      const entityResult = await api.brainGetEntities?.({ limit: 300 })
      const entityItems = entityResult?.items || entityResult || []
      for (const entity of entityItems) {
        if (!entity?.id || nodeMap.has(entity.id)) continue
        nodeMap.set(entity.id, {
          id: entity.id,
          name: entity.name || entity.id,
          type: entity.type || 'concept',
          state: 'neutral',
          degree: 0,
          facts: [],
          source: entity.source || 'brain',
          x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        })
      }

      const factsResult = await api.brainGetFacts?.({ currentOnly: true, limit: 500 })
      const factItems = factsResult?.items || factsResult || []
      for (const fact of factItems) {
        const subjectId = fact?.subjectId
        if (!subjectId) continue
        if (!nodeMap.has(subjectId)) {
          nodeMap.set(subjectId, {
            id: subjectId,
            name: subjectId.replace('ent_', '').replace(/_/g, ' '),
            type: 'concept',
            state: fact.validTo ? 'neutral' : 'active',
            degree: 0, facts: [],
            source: 'brain',
            x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
          })
        }
        const node = nodeMap.get(subjectId)!
        node.facts.push({ predicate: fact.predicate, value: fact.objectLiteral || '' })
        if (!fact.validTo) node.state = 'active'

        if (fact.objectId && !nodeMap.has(fact.objectId)) {
          nodeMap.set(fact.objectId, {
            id: fact.objectId,
            name: fact.objectId.replace('ent_', '').replace(/_/g, ' '),
            type: 'concept',
            state: 'neutral',
            degree: 0, facts: [],
            source: 'brain',
            x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
          })
        }
        if (fact.objectId) {
          edgeList.push({ source: subjectId, target: fact.objectId, predicate: fact.predicate })
        }
      }

      try {
        const learnNodes = await api.learnGetNodes?.()
        if (learnNodes && Array.isArray(learnNodes)) {
          for (const ln of learnNodes.slice(0, 30)) {
            const id = `learn_${ln.id || ln.slug}`
            if (nodeMap.has(id)) continue
            nodeMap.set(id, {
              id,
              name: ln.title || ln.name || ln.slug || 'Lesson',
              type: 'concept',
              state: 'neutral',
              degree: 0,
              facts: [{ predicate: 'is_lesson', value: ln.part || 'general' }],
              source: 'workspace',
              x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
            })
          }
        }
      } catch { /* learn nodes are optional */ }

      setGraphNodes(Array.from(nodeMap.values()))
      setGraphLinks(edgeList)
      console.log(`[SelfOrchestrator] graph: ${nodeMap.size} entities, ${edgeList.length} facts`)
    } catch (e) {
      console.error('[SelfOrchestrator] graph load failed:', e)
      setGraphError(true)
    } finally {
      setGraphLoading(false)
    }
  }, [])

  useEffect(() => { loadGraphData() }, [loadGraphData])

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
    }, 1500)
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

  const graph3DData = useMemo(() => ({
    nodes: graphNodes.map(n => ({
      id: n.id,
      name: n.name,
      type: n.type,
      x: n.x ?? 0,
      y: n.y ?? 0,
      z: n.z ?? 0,
      facts: n.facts || [],
    })),
    edges: graphLinks.map(l => ({ from: l.source, to: l.target, predicate: l.predicate })),
  }), [graphNodes, graphLinks])

  const can3D = webglSupported()

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
        <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
          <DotPattern opacity={0.02} radius={0.8} gap={30} className="text-[var(--page-accent)]" />
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

        {/* Stage: graph (left, large) + identity/readout (right rail) */}
        <motion.div
          className="relative z-10 px-5 pb-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start"
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
            {/* View toggle */}
            <div className="flex items-center gap-2" data-section="life.self.viewToggle">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">View</span>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--ws-border)] p-0.5">
                <button
                  onClick={() => setGraphView('2d')}
                  aria-pressed={graphView === '2d'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none ${graphView === '2d' ? 'bg-[var(--ws-surface-raised)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  <Layers size={11} /> 2D
                </button>
                <button
                  onClick={() => setGraphView('3d')}
                  aria-pressed={graphView === '3d'}
                  disabled={!can3D}
                  title={can3D ? '3D view' : 'WebGL not available on this machine'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${graphView === '3d' ? 'bg-[var(--ws-surface-raised)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  <Box size={11} /> 3D
                </button>
              </div>
              {!can3D && (
                <span className="text-[10px] text-[var(--text-muted)]">3D unavailable (no WebGL)</span>
              )}
            </div>

            <div
              ref={graphContainerRef}
              className="relative rounded-xl overflow-hidden border-t border-[var(--ws-border)]"
              style={{ height: 'clamp(460px, 58vh, 720px)' }}
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
              {graphView === '2d' ? (
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
              ) : can3D ? (
                <div className="w-full h-full" style={{ background: 'var(--ws-surface-sunken)', borderRadius: 12, overflow: 'hidden' }}>
                  <ContextGraph data={graph3DData} onNodeClick={(n) => {
                    const node = graphNodes.find(g => g.id === n.id) || null
                    handleNodeClick(node)
                  }} />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[var(--text-muted)] text-xs">
                  3D view requires WebGL, which is unavailable here. Switch to 2D.
                </div>
              )}
            </div>

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
              <div className="h-[132px] overflow-y-auto">
                <ActivityFeed
                  nodes={graphNodes}
                  activity={activity}
                  reducedMotion={reducedMotion}
                />
              </div>
            </Card>
          </motion.div>

          {/* ── RIGHT RAIL: identity + legend + governance ── */}
          <motion.aside
            custom={1}
            variants={fadeSlideUp}
            data-section="life.self.identity"
            aria-label="Identity"
            className="flex flex-col gap-5 min-w-0"
          >
            <Card className="gap-0 py-0">
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

            {/* Governance drawer */}
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
                        {([
                          ['episodes', 'Episodes'],
                          ['entities', 'Entities'],
                          ['currentFacts', 'Active facts'],
                          ['facts', 'All-time facts'],
                        ] as const).map(([k, label]) => (
                          <div key={k} className="flex flex-col gap-0.5">
                            <span className="text-[18px] font-semibold font-mono tabular-nums text-[var(--text-primary)] min-w-[3ch]">
                              {statsLoading ? '—' : (stats?.[k] ?? 0)}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
                          </div>
                        ))}
                        <button
                          onClick={() => { window.location.hash = '#/ai' }}
                          className="ml-auto flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium text-[var(--text-primary)] hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none"
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
          </motion.aside>
        </motion.div>
      </div>
    </SelfErrorBoundary>
  )
}
