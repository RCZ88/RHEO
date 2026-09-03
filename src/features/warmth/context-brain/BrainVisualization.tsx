import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Search, Network, Wifi } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrainGraph } from './BrainGraph'
import { NeuralFlow } from './NeuralFlow'
import { EntityDetailPanel } from '../context-graph/EntityDetailPanel'
import { NumberTicker } from '../../../components/ui/number-ticker'
import { DotPattern } from '../../../components/ui/dot-pattern'
import type { GraphNode, GraphLink } from '../context-graph/types'
import { TYPE_COLORS } from '../context-graph/types'
import { ACCENTS } from '../ContextGraphView'
import { computeCascade, shouldReheat, getNodeGlow } from './physics/avalanche'

const fadeSlideUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

export interface BrainVisualizationProps {
  nodes: GraphNode[]
  links: GraphLink[]
  activity?: { nodeId: string; magnitude: number; timestamp: number }[]
  width: number
  height: number
  state: 'empty' | 'loading' | 'error' | 'populated'
  livelinessLevel?: 'L1' | 'L2' | 'L3'
  reducedMotion?: boolean
  onNodeHover?: (node: GraphNode | null) => void
  onNodeClick?: (node: GraphNode | null) => void
  hoveredNode?: GraphNode | null
  selectedNode?: GraphNode | null
  selectionSet?: Set<string>
  hideChrome?: boolean
}

/**
 * BrainVisualization — orchestrator for the brain visualization.
 *
 * Owns the shared noise field and activity state, composes the ambient
 * (NeuralFlow) + graph (BrainGraph) layers, and exposes the public API.
 *
 * The two layers read the same noise field and activity state — this is
 * what makes them read as one organism, not two separate widgets.
 */
export function BrainVisualization(props: BrainVisualizationProps) {
  const {
    nodes, links, width, height, state,
    livelinessLevel = 'L2',
    reducedMotion = false,
    onNodeHover, onNodeClick,
    hoveredNode, selectedNode, selectionSet,
    hideChrome = false,
  } = props

  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [now, setNow] = useState(Date.now())

  // ── Avalanche state ──
  const lastCascadeRef = useRef({ magnitude: 0, time: Date.now() })
  const [activityNodes, setActivityNodes] = useState<Set<string>>(new Set())

  // ── Tick for time-based glow ──
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 50)
    return () => clearInterval(interval)
  }, [])

  // ── Compute data points for NeuralFlow bias ──
  const dataPoints = useMemo(() => {
    return nodes
      .filter(n => n.x != null && n.y != null)
      .map(n => ({
        x: n.x,
        y: n.y,
        strength: getNodeGlow(n, now) + (n.state === 'active' ? 0.5 : 0.1),
      }))
  }, [nodes, now])

  // ── Node handlers ──
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHovered(node)
    onNodeHover?.(node)
  }, [onNodeHover])

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    if (!node) {
      setSelected(null)
      setSelectedIds(new Set())
      onNodeClick?.(node)
      return
    }
    if (selected?.id === node.id) {
      setSelected(null)
      setSelectedIds(new Set())
    } else {
      setSelected(node)
      setSelectedIds(new Set([node.id]))
      // Trigger cascade on click
      const cascade = computeCascade(node.id, nodes, links, Date.now())
      lastCascadeRef.current = { magnitude: cascade.totalMagnitude, time: Date.now() }
      setActivityNodes(new Set(cascade.events.map(e => e.nodeId)))
    }
    onNodeClick?.(node)
  }, [selected, nodes, links, onNodeClick])

  // ── Filtered nodes/links ──
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes
    const q = searchQuery.toLowerCase()
    return nodes.filter(n =>
      n.name.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q)
    )
  }, [nodes, searchQuery])

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const filteredLinks = useMemo(() => {
    return links.filter(l => {
      const s = nodeMap.get(l.source as string)
      const t = nodeMap.get(l.target as string)
      return s && t
    })
  }, [links, nodeMap])

  // ── Entity types for legend ──
  const entityTypes = useMemo(() => Array.from(new Set(nodes.map(n => n.type))).sort(), [nodes])
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of nodes) c[n.type] = (c[n.type] || 0) + 1
    return c
  }, [nodes])

  // ── Render by state ──
  if (state === 'loading') {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: '#09090b' }}>
        <div className="absolute inset-0 z-0">
          <NeuralFlow opacity={0.3} dataPoints={[]} />
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-xs text-zinc-500">Building knowledge graph…</span>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: '#09090b' }}>
        <div className="absolute inset-0 z-0 opacity-30">
          <NeuralFlow opacity={0.15} dataPoints={[]} />
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${ACCENTS.slate}12`, border: `1px solid ${ACCENTS.slate}25` }}>
              <Network size={18} style={{ color: ACCENTS.slate }} />
            </div>
            <p className="text-sm font-medium text-zinc-400">Brain temporarily unavailable</p>
            <p className="text-xs text-zinc-600 max-w-xs">The network is quiet. Your data is safe.</p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: '#09090b' }}>
        <div className="absolute inset-0 z-0">
          <NeuralFlow opacity={0.25} dataPoints={[]} />
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${ACCENTS.green}12`, border: `1px solid ${ACCENTS.green}25` }}>
              <Network size={18} style={{ color: ACCENTS.green }} />
            </div>
            <p className="text-sm font-medium text-zinc-400">No knowledge yet</p>
            <p className="text-xs text-zinc-600 max-w-xs">
              Chat with the AI, complete goals, or update life phases — entities appear here automatically and connect into your brain graph.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Populated state ──
  return (
    <div className="relative">
      {/* Neural flow background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <NeuralFlow
          opacity={livelinessLevel === 'L3' ? 0.45 : livelinessLevel === 'L1' ? 0.2 : 0.32}
          dataPoints={dataPoints}
          respectReducedMotion={!reducedMotion}
        />
      </div>

      {/* Graph canvas */}
      <div
        className="relative z-10 w-full h-full rounded-xl overflow-hidden"
        style={{ background: '#09090b', border: ACCENTS.border }}
      >
        <div className="absolute inset-0 pointer-events-none z-0">
          <DotPattern opacity={0.015} radius={0.6} gap={28} className="text-[#8b5cf6]" />
        </div>

        <BrainGraph
          nodes={filteredNodes}
          links={filteredLinks}
          width={width}
          height={height}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          hoveredNode={hovered}
          selectedNode={selected}
          selectionSet={selectedIds}
          now={now}
        />

        {/* Search bar */}
        {!hideChrome && (
        <div className="absolute top-3 left-3 z-20">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: ACCENTS.surface, border: ACCENTS.border, backdropFilter: 'blur(12px)' }}>
            <Search size={11} className="shrink-0" style={{ color: '#52525b' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent outline-none text-zinc-300 placeholder-zinc-600 font-mono text-[11px]"
            />
          </div>
        </div>
        )}

        {/* Stats bar */}
        {!hideChrome && (
        <div className="absolute top-3 right-3 z-20">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px] font-mono" style={{ background: ACCENTS.surface, border: ACCENTS.border }}>
            <span className="text-zinc-500">
              <NumberTicker value={filteredNodes.length} /> nodes
            </span>
            <span className="text-zinc-600 mx-1">|</span>
            <span className="text-zinc-500">
              <NumberTicker value={filteredLinks.length} /> edges
            </span>
          </div>
        </div>
        )}

        {/* Type legend */}
        {!hideChrome && (
        <div className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-1.5">
          {entityTypes.map(type => {
            const color = TYPE_COLORS[type] || TYPE_COLORS.default
            return (
              <span
                key={type}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
                {type}
                <span className="text-zinc-600">{typeCounts[type] || 0}</span>
              </span>
            )
          })}
        </div>
        )}

        {/* AI Bridge chip */}
        {!hideChrome && (
        <div className="absolute bottom-3 z-20 flex items-center gap-2 px-2 py-1 rounded-md text-[10px]" style={{ background: 'rgba(9,9,11,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <Wifi size={10} style={{ color: ACCENTS.cyan }} />
          <span className="text-zinc-500">AI Bridge</span>
          <span className="text-zinc-600 mx-1">·</span>
          <span className="text-zinc-500">External sessions feed the brain</span>
        </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <EntityDetailPanel node={selected} onClose={() => { setSelected(null); setSelectedIds(new Set()) }} />
      )}
    </div>
  )
}
