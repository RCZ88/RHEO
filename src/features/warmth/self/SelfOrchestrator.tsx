import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Network, Brain, RefreshCw, ChevronDown, ChevronRight,
  Sparkles, Zap, ExternalLink, MousePointerClick,
} from 'lucide-react'
import { ProfileTab } from '../../../components/life/ProfileTab'
import { BrainManagementView } from '../context-brain/BrainManagementView'
import { SelfErrorBoundary } from './SelfErrorBoundary'
import { DotPattern } from '../../../components/ui/dot-pattern'
import { NeuralFlow } from '../context-brain/NeuralFlow'
import { BrainVisualization } from '../context-brain/BrainVisualization'
import { ActivityFeed } from '../context-brain/ActivityFeed'
import { ACCENTS } from '../ContextGraphView'
import type { GraphNode, GraphLink } from '../context-graph/types'

// ── Layout tokens ──
const CARD_CLASS = "rounded-xl border border-zinc-800/50 bg-zinc-900/60 backdrop-blur-xl p-5"

// ── Reduced-motion helper ──
function getReducedMotion(): boolean {
  const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined
  return !!(mq?.matches ?? false)
}

// ── Entrance variant ──
const fadeSlideUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

// ── Stagger container ──
const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 }
  },
}

// ═══════════════════════════════════════════════════════════════
//  Stat pill (reusable)
// ═══════════════════════════════════════════════════════════════
interface StatPillProps {
  label: string
  sublabel: string
  value: number
  icon: React.ReactNode
  color: string
}

function StatPill({ label, sublabel, value, icon, color }: StatPillProps) {
  return (
    <div className="relative flex flex-col gap-1.5 min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}12`, border: `1px solid ${color}25` }}
        >
          {(() => {
            const el = icon as React.ReactElement
            // Clone without relying on a global `React` reference at runtime
            // (production JSX compiled by vite does not necessarily expose global React)
            return {
              ...el.props,
              size: 13,
              style: { color, ...el.props.style },
              children: (el.props && (el.props as any).children) ?? undefined,
            } as any
          })()}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{sublabel}</span>
      </div>
      <div className="text-xl leading-none font-bold font-mono tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-zinc-400 truncate">{label}</div>
      {/* Subtle glow dot */}
      <div
        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}80`, opacity: 0.6 }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  SelfOrchestrator — the Self tab of the Life page
//
//  Reading top-to-bottom:
//    Row 1  → Identity (who you are) + Context Brain stats (what the AI knows about you)
//    Row 2  → Context Brain — the living web of that knowledge (centerpiece)
//    Row 3  → Management (govern it)
// ═══════════════════════════════════════════════════════════════
export function SelfOrchestrator() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [graphExpanded, setGraphExpanded] = useState(true)
  const [mgmtExpanded, setMgmtExpanded] = useState(false)

  // ── Reduced motion ──
  const reducedMotion = getReducedMotion()

  // ── Graph data ──
  const [graphLoading, setGraphLoading] = useState(true)
  const [graphNodes, setGraphNodes] = useState<(GraphNode & { x: number; y: number; vx?: number; vy?: number })[]>([])
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [activity, setActivity] = useState<{ nodeId: string; magnitude: number; timestamp: number }[]>([])

  // ── Graph canvas size (measured) ──
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [graphW, setGraphW] = useState(800)
  const [graphH, setGraphH] = useState(440)

  useEffect(() => {
    const el = graphContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 0) setGraphW(Math.floor(w))
        if (h > 0) setGraphH(Math.floor(h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Load brain stats ──
  const loadStats = useCallback(async () => {
    try {
      const api = (window as any).deskflowAPI
      const data = await api?.brainStats?.()
      if (data) setStats(data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // ── Load graph data (canonical pattern from ContextGraphView) ──
  const loadGraphData = useCallback(async () => {
    try {
      setGraphLoading(true)
      const api = (window as any).deskflowAPI
      if (!api) return

      const nodeMap = new Map<string, GraphNode & { x: number; y: number }>()
      const edgeList: GraphLink[] = []
      const seedX = (id: string) => graphW / 2 + (Math.random() - 0.5) * graphW * 0.6
      const seedY = (id: string) => graphH / 2 + (Math.random() - 0.5) * graphH * 0.6

      // Entities
      const entityResult = await api.brainGetEntities?.({ limit: 300 })
      const entityItems = entityResult?.items || entityResult || []
      for (const entity of entityItems) {
        if (!nodeMap.has(entity.id)) {
          nodeMap.set(entity.id, {
            id: entity.id, name: entity.name, type: entity.type,
            state: 'neutral', degree: 0, facts: [],
            source: entity.source || 'brain',
            x: seedX(entity.id), y: seedY(entity.id),
            z: 0, vx: 0, vy: 0, vz: 0,
          })
        }
      }

      // Facts → edges
      const factsResult = await api.brainGetFacts?.({ currentOnly: true, limit: 500 })
      const factItems = factsResult?.items || factsResult || []
      for (const fact of factItems) {
        const subjectId = fact.subjectId
        if (!nodeMap.has(subjectId)) {
          nodeMap.set(subjectId, {
            id: subjectId, name: subjectId.replace('ent_', '').replace(/_/g, ' '),
            type: 'concept', state: fact.validTo ? 'neutral' : 'active', degree: 0, facts: [],
            x: seedX(subjectId), y: seedY(subjectId), z: 0, vx: 0, vy: 0, vz: 0,
          })
        }
        const node = nodeMap.get(subjectId)!
        node.facts.push({ predicate: fact.predicate, value: fact.objectLiteral || '' })
        if (!fact.validTo) node.state = 'active'

        if (fact.objectId && !nodeMap.has(fact.objectId)) {
          nodeMap.set(fact.objectId, {
            id: fact.objectId, name: fact.objectId.replace('ent_', '').replace(/_/g, ' '),
            type: 'concept', state: 'neutral', degree: 0, facts: [],
            x: seedX(fact.objectId), y: seedY(fact.objectId), z: 0, vx: 0, vy: 0, vz: 0,
          })
        }
        if (fact.objectId) edgeList.push({ source: subjectId, target: fact.objectId, predicate: fact.predicate })
      }

      // Learn nodes
      try {
        const learnNodes = await api.learnGetNodes?.()
        if (learnNodes && Array.isArray(learnNodes)) {
          for (const ln of learnNodes.slice(0, 30)) {
            const id = `learn_${ln.id || ln.slug}`
            if (!nodeMap.has(id)) {
              nodeMap.set(id, {
                id, name: ln.title || ln.name || ln.slug || 'Lesson',
                type: 'concept', state: 'neutral', degree: 0,
                facts: [{ predicate: 'is_lesson', value: ln.part || 'general' }],
                source: 'workspace',
                x: seedX(id), y: seedY(id), z: 0, vx: 0, vy: 0, vz: 0,
              })
            }
          }
        }
      } catch {}

      setGraphNodes(Array.from(nodeMap.values()))
      setGraphLinks(edgeList)
    } catch (e) {
      console.error('[SelfOrchestrator] graph load failed:', e)
    } finally {
      setGraphLoading(false)
    }
  }, [graphW, graphH])

  useEffect(() => { loadGraphData() }, [loadGraphData])

  // ── Track state transitions for activity events ──
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api) return
    let mounted = true
    const interval = setInterval(async () => {
      try {
        const entities = await api.brainGetEntities?.({ limit: 300 })
        if (!mounted) return
        const items = entities?.items || entities || []
        const now = Date.now()
        const newActivity: { nodeId: string; magnitude: number; timestamp: number }[] = []
        for (const entity of items) {
          if (entity.state === 'active' && entity.lastFiredAt && (now - entity.lastFiredAt < 3000)) {
            newActivity.push({ nodeId: entity.id, magnitude: 1.0, timestamp: entity.lastFiredAt })
          }
        }
        if (newActivity.length > 0) {
          setActivity(prev => [...newActivity, ...prev].slice(0, 50))
        }
      } catch {}
    }, 2000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  // ── Node handlers ──
  const handleNodeHover = useCallback((node: GraphNode | null) => setHoveredNode(node), [])
  const handleNodeClick = useCallback((node: GraphNode | null) => {
    if (!node) { setSelectedNode(null); setSelectedNodeIds(new Set()); return }
    if (selectedNode?.id === node.id) { setSelectedNode(null); setSelectedNodeIds(new Set()) }
    else { setSelectedNode(node); setSelectedNodeIds(new Set([node.id])) }
  }, [selectedNode])

  // ── Stat items ──
  const statItems = [
    { label: 'Episodes',  sublabel: 'Memory',   value: stats?.episodes     ?? 0, icon: <Brain size={13} />,    color: ACCENTS.purple },
    { label: 'Entities',  sublabel: 'Knowledge', value: stats?.entities     ?? 0, icon: <Network size={13} />,  color: ACCENTS.green  },
    { label: 'Facts',     sublabel: 'Active',    value: stats?.currentFacts ?? 0, icon: <Zap size={13} />,      color: ACCENTS.amber  },
    { label: 'All-Time',  sublabel: 'History',   value: stats?.facts        ?? 0, icon: <Sparkles size={13} />, color: ACCENTS.cyan   },
  ]

  const hasGraph = graphNodes.length > 0

  // ── Empty graph state ──
  const emptyGraph = (
    <div className="flex flex-col items-center justify-center gap-3 h-[360px] text-center">
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${ACCENTS.green}12`, border: `1px solid ${ACCENTS.green}25` }}>
        <Network size={18} style={{ color: ACCENTS.green }} />
      </div>
      <p className="text-sm font-medium text-zinc-400">No knowledge yet</p>
      <p className="text-xs text-zinc-600 max-w-xs">
        Chat with the AI, complete goals, or update life phases — entities appear here automatically and connect into your brain graph.
      </p>
    </div>
  )

  return (
    <SelfErrorBoundary>
      {/* ── Full-height ambient canvas (NeuralFlow = RHEO's "Current") ── */}
      <div className="relative w-full min-h-[640px] overflow-hidden rounded-xl">
        {/* NeuralFlow ambient background — the breathing violet/cyan flow field */}
        <div className="absolute inset-0 z-0">
          <NeuralFlow opacity={0.32} />
        </div>

        {/* Subtle dot-grid texture overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <DotPattern opacity={0.025} radius={0.8} gap={28} className="text-[#8b5cf6]" />
        </div>

        {/* ── Content stack with stagger entrance ── */}
        <div className="relative z-10 p-5 flex flex-col gap-5 min-h-[640px]">

          {/* ── Row 1: Identity (left) + Brain stats (right) ── */}
          <motion.div
            custom={0}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start"
          >
            {/* Identity card */}
            <motion.div custom={0} variants={fadeSlideUp} initial="hidden" animate="visible" className={CARD_CLASS}>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${ACCENTS.amber}12`, border: `1px solid ${ACCENTS.amber}25` }}
                >
                  <User size={13} style={{ color: ACCENTS.amber }} />
                </div>
                <h2 className="text-[13px] font-semibold text-zinc-200">Identity</h2>
              </div>
              <ProfileTab />
            </motion.div>

            {/* Brain header + stat pills */}
            <motion.div custom={1} variants={fadeSlideUp} initial="hidden" animate="visible" className="flex flex-col gap-4 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${ACCENTS.purple}12`, border: `1px solid ${ACCENTS.purple}25` }}
                  >
                    <Brain size={13} style={{ color: ACCENTS.purple }} />
                  </div>
                  <h2 className="text-[13px] font-semibold text-zinc-200">
                    Context Brain <span className="text-[10px] text-zinc-600 font-mono ml-1">v3</span>
                  </h2>
                </div>
                <button
                  onClick={loadStats}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RefreshCw size={10} className="animate-spin-slow" /> Refresh
                </button>
              </div>
              <div className={`${CARD_CLASS} flex items-center gap-3`}>
                {statItems.map((s, i) => (
                  <StatPill key={s.label} {...s} />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* ── Row 2: Knowledge Graph (dominant, centerpiece) ── */}
          <motion.div
            custom={2}
            variants={fadeSlideUp}
            initial="hidden"
            animate="visible"
            className={`${CARD_CLASS} overflow-hidden flex flex-col`}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${ACCENTS.green}12`, border: `1px solid ${ACCENTS.green}25` }}
                >
                  <Network size={13} style={{ color: ACCENTS.green }} />
                </div>
                <h2 className="text-[13px] font-semibold text-zinc-200">Context Brain</h2>
                <span className="text-[10px] text-zinc-600 font-mono">network at criticality</span>
                {hasGraph && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                        style={{ background: `${ACCENTS.green}10`, color: ACCENTS.green }}>
                    {graphNodes.length} nodes · {graphLinks.length} edges
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadGraphData}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RefreshCw size={10} className="animate-spin-slow" /> Reload
                </button>
                <button
                  onClick={() => setGraphExpanded(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {graphExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {graphExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {graphExpanded && (
                <motion.div
                  key="graph-panel"
                  variants={fadeSlideUp}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="flex-1 min-h-0 px-5 pb-5"
                >
                  {graphLoading && !hasGraph ? (
                    <div className="flex items-center justify-center gap-3 h-[360px]">
                      <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                      <span className="text-xs text-zinc-500">Building knowledge graph…</span>
                    </div>
                  ) : !hasGraph ? (
                    emptyGraph
                  ) : (
                    <div className="flex gap-4 h-[420px]">
                      {/* BrainVisualization — the one generative system with two windows */}
                      <div className="flex-1 min-w-0 h-full">
                        <BrainVisualization
                          nodes={graphNodes as GraphNode[]}
                          links={graphLinks as GraphLink[]}
                          width={graphW}
                          height={graphH}
                          state={stats ? 'populated' : 'loading'}
                          onNodeHover={handleNodeHover}
                          onNodeClick={handleNodeClick}
                          hoveredNode={hoveredNode}
                          selectedNode={selectedNode}
                          selectionSet={selectedNodeIds}
                          hideChrome
                          reducedMotion={reducedMotion}
                        />
                      </div>
                      {/* ActivityFeed — the suprathreshold avalanche readout */}
                      <div className="w-72 shrink-0 h-full">
                        <ActivityFeed
                          nodes={graphNodes as GraphNode[]}
                          activity={activity}
                          reducedMotion={reducedMotion}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Row 3: Brain Management (single column, cleaner) ── */}
          <motion.div
            custom={3}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-5 items-start"
          >
            {/* Memory & Brain Management (collapsible) */}
            <motion.div custom={4} variants={fadeSlideUp} initial="hidden" animate="visible" className={`${CARD_CLASS} overflow-hidden`}>
              <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0 -mx-5 -mt-5 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${ACCENTS.cyan}12`, border: `1px solid ${ACCENTS.cyan}25` }}
                  >
                    <MousePointerClick size={13} style={{ color: ACCENTS.cyan }} />
                  </div>
                  <h2 className="text-[13px] font-semibold text-zinc-200">Memory & Brain Management</h2>
                  <span className="text-[10px] text-zinc-600 font-mono">episodes · entities · facts · jobs</span>
                </div>
                <button
                  onClick={() => setMgmtExpanded(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {mgmtExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {mgmtExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {mgmtExpanded && (
                  <motion.div
                    key="mgmt-panel"
                    variants={fadeSlideUp}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 -mx-5 -mb-5">
                      <BrainManagementView />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

        </div>
      </div>

      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 1.2s linear infinite;
        }
      `}</style>
    </SelfErrorBoundary>
  )
}
