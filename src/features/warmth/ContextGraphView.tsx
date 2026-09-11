import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { RefreshCw, Search, X, Network, Wifi } from 'lucide-react'
import { CanvasGraph } from './context-brain/CanvasGraph'
import { EntityDetailPanel } from './context-graph/EntityDetailPanel'
import { NumberTicker } from '../../components/ui/number-ticker'
import type { GraphNode, GraphLink } from './context-graph/types'
import { BrainManagementView } from './context-brain/BrainManagementView'
import { NeuralFlow } from './context-brain/NeuralFlow'
import { DotPattern } from '../../components/ui/dot-pattern'
import { Skeleton } from '../../components/ui/skeleton'
import { ExternalAITrail } from './context-brain/ExternalAITrail'

// ── Shared accent palette (single source of truth) ──
export const ACCENTS = {
  purple:  '#8b5cf6',
  green:   '#22c55e',
  amber:   '#f59e0b',
  cyan:    '#06b6d4',
  rose:    '#f43f5e',
  slate:   '#71717a',
  surface: 'rgba(24,24,27,0.65)',
  border:  'rgba(255,255,255,0.06)',
}

// ── Loading skeleton ──
function LoadingGraph() {
  return (
    <div className="flex items-center justify-center h-72 rounded-xl" style={{ background: ACCENTS.surface, border: ACCENTS.border }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-zinc-700 border-t-zinc-500 rounded-full animate-spin" />
        <span className="text-xs text-zinc-500 font-mono">Building knowledge graph…</span>
      </div>
    </div>
  )
}

// ── Type legend ──
function TypeLegend({ entityTypes, typeCounts, hiddenTypes, onToggle }: {
  entityTypes: string[]
  typeCounts: Record<string, number>
  hiddenTypes: Set<string>
  onToggle: (type: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {entityTypes.map(type => {
        const color = TYPE_COLORS[type] || TYPE_COLORS.default
        const hidden = hiddenTypes.has(type)
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] transition-all ${
              hidden ? 'opacity-30' : 'hover:opacity-80'
            }`}
            style={{
              background: hidden ? 'transparent' : `${color}10`,
              border: `1px solid ${color}25`,
              color: hidden ? '#52525b' : color,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
            />
            {type}
            <span className="text-zinc-600" style={{ marginLeft: 2 }}>{typeCounts[type] || 0}</span>
            {hidden && <X size={9} className="ml-0.5" style={{ color: '#52525b' }} />}
          </button>
        )
      })}
    </div>
  )
}

// ── Stats bar ──
function StatsBar({ stats, filteredNodes, filteredLinks }: {
  stats: { episodes: number; entities: number; facts: number; currentFacts: number } | null
  filteredNodes: GraphNode[]
  filteredLinks: GraphLink[]
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px] font-mono" style={{ background: ACCENTS.surface, border: ACCENTS.border }}>
      {stats && (
        <>
          <span className="text-zinc-500">
            <NumberTicker value={filteredNodes.length} /> nodes
          </span>
          <span className="text-zinc-600 mx-1">|</span>
          <span className="text-zinc-500">
            <NumberTicker value={filteredLinks.length} /> edges
          </span>
          <span className="text-zinc-600 mx-1">|</span>
          <span className="text-zinc-500">
            <NumberTicker value={stats.episodes} /> episodes
          </span>
          <span className="text-zinc-600 mx-1">|</span>
          <span style={{ color: ACCENTS.purple }}>
            <NumberTicker value={stats.currentFacts} /> facts
          </span>
        </>
      )}
      {(!stats) && (
        <span className="text-zinc-600">loading…</span>
      )}
    </div>
  )
}

// ── Main View ──
export function ContextGraphView() {
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(500)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Graph data state ──
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes] = useState<(GraphNode & { x: number; y: number; vx?: number; vy?: number })[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [stats, setStats] = useState<{ episodes: number; entities: number; facts: number; currentFacts: number } | null>(null)

  // ── Interaction state ──
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)

  // ── Container resize observer ──
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        setWidth(Math.floor(w))
        setHeight(Math.floor(h))
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // ── Load graph data ──
  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true)
      const api = (window as any).deskflowAPI
      if (!api) return

      const brainStats = await api.brainStats()
      setStats(brainStats)

      const nodeMap = new Map<string, GraphNode & { x: number; y: number }>()
      const edgeList: GraphLink[] = []

      // Load entities
      const entityResult = await api.brainGetEntities({ limit: 300 })
      const entityItems = entityResult?.items || entityResult || []
      for (const entity of entityItems) {
        if (!nodeMap.has(entity.id)) {
          nodeMap.set(entity.id, {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            state: 'neutral',
            degree: 0,
            facts: [],
            source: entity.source || 'brain',
            x: width / 2 + (Math.random() - 0.5) * width * 0.6,
            y: height / 2 + (Math.random() - 0.5) * height * 0.6,
          })
        }
      }

      // Load facts and build edges
      const factsResult = await api.brainGetFacts({ currentOnly: true, limit: 500 })
      const factItems = factsResult?.items || factsResult || []
      for (const fact of factItems) {
        const subjectId = fact.subjectId
        if (!nodeMap.has(subjectId)) {
          nodeMap.set(subjectId, {
            id: subjectId,
            name: subjectId.replace('ent_', '').replace(/_/g, ' '),
            type: 'concept',
            state: fact.validTo ? 'neutral' : 'active',
            degree: 0,
            facts: [],
            x: width / 2 + (Math.random() - 0.5) * width * 0.6,
            y: height / 2 + (Math.random() - 0.5) * height * 0.6,
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
            degree: 0,
            facts: [],
            x: width / 2 + (Math.random() - 0.5) * width * 0.6,
            y: height / 2 + (Math.random() - 0.5) * height * 0.6,
          })
        }
        if (fact.objectId) {
          edgeList.push({ source: subjectId, target: fact.objectId, predicate: fact.predicate })
        }
      }

      // Add learn nodes
      try {
        const learnNodes = await api.learnGetNodes?.()
        if (learnNodes && Array.isArray(learnNodes)) {
          for (const ln of learnNodes.slice(0, 30)) {
            const id = `learn_${ln.id || ln.slug}`
            if (!nodeMap.has(id)) {
              nodeMap.set(id, {
                id,
                name: ln.title || ln.name || ln.slug || 'Lesson',
                type: 'concept',
                state: 'neutral',
                degree: 0,
                facts: [{ predicate: 'is_lesson', value: ln.part || 'general' }],
                source: 'workspace',
                x: width / 2 + (Math.random() - 0.5) * width * 0.6,
                y: height / 2 + (Math.random() - 0.5) * height * 0.6,
              })
            }
          }
        }
      } catch { /* learn nodes not available */ }

      const nodeList = Array.from(nodeMap.values())
      console.log(`[ContextGraph] Loaded ${nodeList.length} nodes, ${edgeList.length} edges`)
      setNodes(nodeList)
      setLinks(edgeList)
    } catch (e) {
      console.error('[ContextGraph] Load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [width, height])

  useEffect(() => { loadGraphData() }, [loadGraphData])

  // ── Filtered nodes/links ──
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const filteredNodes = useMemo(() =>
    nodes.filter(n =>
      !hiddenTypes.has(n.type) &&
      (!searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [nodes, hiddenTypes, searchQuery])
  const filteredLinks = useMemo(() =>
    links.filter(l => {
      const s = nodeMap.get(l.source as string)
      const t = nodeMap.get(l.target as string)
      return s && t &&
        !hiddenTypes.has(s.type) &&
        !hiddenTypes.has(t.type) &&
        (!searchQuery ||
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }), [links, nodeMap, hiddenTypes, searchQuery])

  // ── Entity types for legend ──
  const entityTypes = useMemo(() => Array.from(new Set(nodes.map(n => n.type))).sort(), [nodes])
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of nodes) c[n.type] = (c[n.type] || 0) + 1
    return c
  }, [nodes])

  // ── Node hover handler ──
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node)
  }, [])

  // ── Node click handler ──
  const handleNodeClick = useCallback((node: GraphNode | null) => {
    if (!node) {
      setSelectedNode(null)
      setSelectedNodeIds(new Set())
      return
    }
    if (selectedNode?.id === node.id) {
      setSelectedNode(null)
      setSelectedNodeIds(new Set())
    } else {
      setSelectedNode(node)
      setSelectedNodeIds(new Set([node.id]))
    }
  }, [selectedNode])

  // ── No data state ──
  if (loading && nodes.length === 0) {
    return <LoadingGraph />
  }

  if (nodes.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center py-12 rounded-xl" style={{ background: ACCENTS.surface, border: ACCENTS.border, gap: 12 }}>
        <Network size={32} style={{ color: '#3f3f46' }} />
        <p className="text-sm font-medium text-zinc-400">No entities yet</p>
        <p className="text-xs text-zinc-600 text-center max-w-xs">
          Chat with the AI, complete goals, or update life phases — entities appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* ── Neural flow background (visible!) ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <NeuralFlow opacity={0.5} />
      </div>

      {/* ── Graph canvas ── */}
      <div
        ref={containerRef}
        className="relative z-10 w-full h-full rounded-xl overflow-hidden"
        style={{ background: '#09090b', border: ACCENTS.border }}
      >
        {/* Subtle dot pattern overlay */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <DotPattern opacity={0.015} radius={0.6} gap={28} className="text-[#8b5cf6]" />
        </div>

        <CanvasGraph
          nodes={filteredNodes as GraphNode[]}
          links={filteredLinks as GraphLink[]}
          width={width}
          height={height}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          hoveredNode={hoveredNode}
          selectedNode={selectedNode}
          selectionSet={selectedNodeIds}
        />

        {/* ── Search bar ── */}
        <div className="absolute top-3 left-3 z-20">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: ACCENTS.surface, border: ACCENTS.border, backdropFilter: 'blur(12px)' }}>
            <Search size={11} className="shrink-0" style={{ color: '#52525b' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent outline-none text-zinc-300 placeholder-zinc-600 font-mono text-[11px]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="shrink-0 text-zinc-600 hover:text-zinc-400">
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="absolute top-3 right-3 z-20">
          <StatsBar stats={stats} filteredNodes={filteredNodes} filteredLinks={filteredLinks} />
        </div>

        {/* ── Type legend ── */}
        <div className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-1.5">
          <TypeLegend
            entityTypes={entityTypes}
            typeCounts={typeCounts}
            hiddenTypes={hiddenTypes}
        onToggle={(type) => setHiddenTypes(prev => {
              const next = new Set(prev)
              if (next.has(type)) next.delete(type); else next.add(type)
              return next
            })}
          />
        </div>

        {/* ── Empty hint ── */}
        {nodes.length > 0 && !selectedNode && !hoveredNode && (
          <div className="absolute bottom-3 right-3 z-20 text-[10px] text-zinc-600 font-mono">
            Click a node to inspect · drag to rearrange
          </div>
        )}

        {/* ── External AI Trail chip ── */}
        <div className="absolute bottom-3 z-20 flex items-center gap-2 px-2 py-1 rounded-md text-[10px]" style={{ background: 'rgba(9,9,11,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <Wifi size={10} style={{ color: ACCENTS.cyan }} />
          <span className="text-zinc-500">AI Bridge</span>
          <span className="text-zinc-600 mx-1">·</span>
          <span className="text-zinc-500">External sessions feed the brain</span>
        </div>
      </div>

      {/* ── Detail panel for selected node ── */}
      {selectedNode && (
        <EntityDetailPanel node={selectedNode} onClose={() => { setSelectedNode(null); setSelectedNodeIds(new Set()) }} />
      )}

      {/* ── Side panel: External AI trail + management ── */}
      <div className="flex flex-col gap-4 mt-4">
        <ExternalAITrail />
        <BrainManagementView />
      </div>
    </div>
  )
}
