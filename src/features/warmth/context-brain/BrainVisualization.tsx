import { useState, useCallback, useEffect, useMemo } from 'react'
import { Search, Network, Wifi, X } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { BrainGraph } from './BrainGraph'
import { NeuralFlow } from './NeuralFlow'
import { EntityDetailPanel } from '../context-graph/EntityDetailPanel'
import { NumberTicker } from '../../../components/ui/number-ticker'
import { DotPattern } from '../../../components/ui/dot-pattern'
import type { GraphNode, GraphLink } from '../context-graph/types'
import { TYPE_COLORS } from '../context-graph/types'
import { computeCascade, getNodeGlow, fireNode } from './physics/avalanche'
import { hexRGB, rgb } from './graphTokens'

/**
 * One firing event. `depth` is hops from the avalanche origin — it is what the
 * readout sorts and colours by, so dropping it makes every event look like it
 * came from the node you clicked.
 */
export interface BrainActivityEvent {
  nodeId: string
  magnitude: number
  timestamp: number
  depth: number
}

/** Inline chrome used by several states. Tokens only — no raw hex. */
const SURFACE = 'var(--ws-surface)'
const RAISED = 'var(--ws-surface-raised)'
const HAIRLINE = '1px solid var(--ws-border)'
const ACCENT = 'var(--page-accent)'
/** Amber is SEMANTIC here: "an event is firing right now". Nothing else. */
const FIRING = 'var(--color-amber-400)'

export interface BrainVisualizationProps {
  nodes: GraphNode[]
  links: GraphLink[]
  activity?: BrainActivityEvent[]
  width: number
  height: number
  state: 'empty' | 'loading' | 'error' | 'populated'
  livelinessLevel?: 'L1' | 'L2' | 'L3'
  reducedMotion?: boolean
  onNodeHover?: (n: GraphNode | null) => void
  onNodeClick?: (n: GraphNode | null) => void
  /**
   * Selection is CONTROLLED when this prop is present (i.e. `!== undefined`).
   *
   * It used to be accepted and then completely ignored: the component ran its
   * own parallel `selected`/`selectedIds` state and passed THAT to `BrainGraph`,
   * so the parent and the renderer disagreed about what was selected and the
   * parent's selection never dimmed anything. Every caller in this app passes a
   * real value (starting at `null`), so they are all controlled and now all work.
   */
  hoveredNode?: GraphNode | null
  selectedNode?: GraphNode | null
  selectionSet?: Set<string>
  hideChrome?: boolean
  /** Every avalanche event, so a readout can share this one system. */
  onActivity?: (events: BrainActivityEvent[]) => void
}

/** Shared shell for the three non-populated states. */
function StateShell({
  state, children, opacity = 1,
}: { state: string; children: React.ReactNode; opacity?: number }) {
  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{ background: SURFACE }}
      data-braingraph-state={state}
    >
      <div className="absolute inset-0 z-0" style={{ opacity }} aria-hidden="true">
        <NeuralFlow opacity={0.24} dataPoints={[]} respectReducedMotion={false} />
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center">{children}</div>
    </div>
  )
}

/**
 * BrainVisualization — orchestrator for the brain visualization.
 *
 * Owns the shared activity state, composes the ambient (NeuralFlow) + graph
 * (BrainGraph) layers, and exposes the public API.
 *
 * ── Why the cascade wiring here matters ──
 * `handleNodeClick` used to call `computeCascade(...)`, stash the result in
 * `setActivityNodes(...)`, and then never read that state again. The cascade
 * engine ran, produced a correct list of fired nodes, and was discarded — so
 * clicking a node animated exactly nothing. It now (a) stamps `lastFiredAt` on
 * the real node objects via `fireNode`, which is what `getNodeGlow` reads,
 * (b) tells the layout to react via a `braingraph:fire` event, and (c) hands the
 * events up through `onActivity` so `ActivityFeed` and the graph show the same
 * firing. One generative system, two windows — actually true this time.
 */
export function BrainVisualization(props: BrainVisualizationProps) {
  const {
    nodes, links, width, height, state,
    livelinessLevel = 'L2',
    reducedMotion = false,
    onNodeHover, onNodeClick, onActivity,
    hoveredNode, selectedNode, selectionSet,
    hideChrome = false,
  } = props

  const isControlled = selectedNode !== undefined || hoveredNode !== undefined

  const [internalSelected, setInternalSelected] = useState<GraphNode | null>(null)
  const [internalSelectionIds, setInternalSelectionIds] = useState<Set<string>>(new Set())
  const [internalHovered, setInternalHovered] = useState<GraphNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())

  const hovered = isControlled && hoveredNode !== undefined ? hoveredNode : internalHovered
  const selected = isControlled && selectedNode !== undefined ? selectedNode : internalSelected
  const activeSelection = selectionSet ?? internalSelectionIds

  /**
   * Decay tick.
   *
   * It is deliberately NOT handed to the render loop as a dependency. That was
   * the original bug: the parent's 100ms `now` was in `BrainGraph`'s draw-effect
   * dependency list, so ten times a second the effect tore down, cleared the
   * canvas and restarted rAF. The graph samples its own clock per frame; this
   * tick exists only so the ambient field's node bias stays current.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (reducedMotion) {
      setNow(Date.now())
      return
    }
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [reducedMotion])

  // ── Node handlers ──
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    if (!isControlled) setInternalHovered(node)
    onNodeHover?.(node)
  }, [isControlled, onNodeHover])

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    if (!node) {
      if (!isControlled) {
        setInternalSelected(null)
        setInternalSelectionIds(new Set())
      }
      onNodeClick?.(null)
      return
    }

    const wasSelected = selected?.id === node.id
    if (!isControlled) {
      setInternalSelected(wasSelected ? null : node)
      setInternalSelectionIds(wasSelected ? new Set() : new Set([node.id]))
    }

    if (!wasSelected) {
      // Run the avalanche from the clicked node. `computeCascade` writes
      // `lastFiredAt` onto the node objects it is handed, which is the ONLY
      // thing that makes `getNodeGlow` non-zero and therefore the only reason
      // the firing animation renders at all.
      const nowMs = Date.now()
      const cascade = computeCascade(node.id, nodes as any, links, nowMs)
      if (cascade.events.length > 0) {
        // Safety net: the origin always fires, even if it was inside its
        // refractory window from a previous click.
        fireNode(node as any, nowMs, 1)
        onActivity?.(cascade.events)
        // Let the layout react — an avalanche should MOVE the network, not only
        // light it up.
        window.dispatchEvent(new Event('braingraph:fire'))
      }
    }

    onNodeClick?.(wasSelected ? null : node)
  }, [isControlled, links, nodes, onActivity, onNodeClick, selected])

  // ── Filtering ──
  // The old `filteredLinks` only checked that both endpoints EXISTED in the
  // UNFILTERED set, so typing in the search box hid nodes while their edges
  // stayed on screen pointing at nothing.
  const query = searchQuery.trim().toLowerCase()
  const matches = useCallback((n: GraphNode) => {
    if (hiddenTypes.has(n.type)) return false
    if (!query) return true
    return n.name.toLowerCase().includes(query) || n.type.toLowerCase().includes(query)
  }, [hiddenTypes, query])

  const filteredNodes = useMemo(() => nodes.filter(matches), [nodes, matches])

  const visibleIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])

  const filteredLinks = useMemo(
    () => links.filter(l => {
      const s = l.source as string
      const t = l.target as string
      return visibleIds.has(s) && visibleIds.has(t)
    }),
    [links, visibleIds],
  )

  // ── Legend data ──
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of nodes) c[n.type] = (c[n.type] || 0) + 1
    return c
  }, [nodes])

  const entityTypes = useMemo(
    () => Array.from(new Set(nodes.map(n => n.type))).sort(),
    [nodes],
  )

  const toggleType = useCallback((type: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  /** Is anything actually firing right now? Drives the readout honestly. */
  const hottestGlow = useMemo(() => {
    let max = 0
    for (const n of nodes) {
      const g = getNodeGlow(n, now)
      if (g > max) max = g
    }
    return max
  }, [nodes, now])

  // ══════════════════════════════════════════════════════════════════
  //  States. Every one is explicit, and the DOM shape is stable across
  //  them so nothing reflows when the data lands.
  // ══════════════════════════════════════════════════════════════════
  if (state === 'loading') {
    return (
      <StateShell state="loading" opacity={0.6}>
        <div className="flex flex-col items-center gap-4 px-8" role="status" aria-live="polite">
          {/* Skeleton, not a bare spinner (PAINT Gate D): the loading state
              matches the SHAPE of what is arriving, so nothing jumps when the
              graph replaces it. */}
          <div className="w-full max-w-[420px] space-y-3" aria-hidden="true">
            <div className="h-3 w-1/3 rounded bg-zinc-800/60 animate-pulse" />
            <div className="h-2 w-2/3 rounded bg-zinc-800/40 animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-zinc-800/40 animate-pulse" />
          </div>
          <span className="text-xs text-[var(--text-muted)]">Building knowledge graph…</span>
        </div>
      </StateShell>
    )
  }

  if (state === 'error') {
    return (
      <StateShell state="error" opacity={0.3}>
        <div className="flex flex-col items-center gap-3 text-center px-8" role="alert">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: RAISED, border: HAIRLINE }}
          >
            <Network size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Brain temporarily unavailable</p>
          {/* "[Thing] because [reason]. [Action to fix]." — and it reassures,
              because an empty brain and a broken brain look identical otherwise. */}
          <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
            The graph could not be read because the last request failed. Your data is safe —
            the next poll will pick it up, or press Refresh to retry now.
          </p>
        </div>
      </StateShell>
    )
  }

  if (state === 'empty') {
    return (
      <StateShell state="empty" opacity={0.5}>
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: RAISED, border: HAIRLINE }}
          >
            <Network size={18} style={{ color: ACCENT }} aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">No knowledge yet</p>
          {/* Says what WOULD be here, never "No data". */}
          <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
            Chat with the AI, complete goals, or update life phases — entities appear here
            automatically and connect into your brain graph.
          </p>
        </div>
      </StateShell>
    )
  }

  // ── Populated ──
  const isFiltered = query.length > 0 || hiddenTypes.size > 0

  return (
    <div className="relative w-full h-full" data-braingraph-state="populated">
      {/* Ambient layer, gated on reducedMotion — this is the one piece of
          decorative motion on the surface and it stays gated. */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
        <NeuralFlow
          opacity={reducedMotion
            ? 0.18
            : livelinessLevel === 'L3' ? 0.4 : livelinessLevel === 'L1' ? 0.18 : 0.28}
          dataPoints={reducedMotion ? [] : nodes
            .filter(n => n.x != null && n.y != null)
            .map(n => ({
              x: n.x,
              y: n.y,
              strength: getNodeGlow(n, now) + (n.state === 'active' ? 0.5 : 0.1),
            }))}
          respectReducedMotion={!reducedMotion}
        />
      </div>

      <div
        className="relative z-10 w-full h-full rounded-xl overflow-hidden"
        style={{ background: SURFACE, border: HAIRLINE }}
      >
        <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
          <DotPattern opacity={0.015} radius={0.6} gap={28} className="text-[var(--page-accent)]" />
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
          selectionSet={activeSelection}
          reducedMotion={reducedMotion}
        />

        {/* ── Search ── */}
        {!hideChrome && (
          <div className="absolute top-3 left-3 z-20">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
              style={{ background: RAISED, border: HAIRLINE }}
            >
              <Search size={11} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entities…"
                aria-label="Search entities in the knowledge graph"
                className="flex-1 w-32 bg-transparent outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono text-[11px] focus-visible:ring-1 focus-visible:ring-[var(--page-accent)] rounded"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Stats ──
            This is the ONLY stats readout. `BrainGraph` used to paint
            "N nodes · M edges" onto the canvas as well, underneath this bar,
            so every frame had two of everything. */}
        {!hideChrome && (
          <div
            className="absolute top-3 right-3 z-20 flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px] font-mono"
            style={{ background: RAISED, border: HAIRLINE }}
            data-braingraph-stats=""
          >
            <span className="text-[var(--text-muted)]">
              <NumberTicker value={filteredNodes.length} /> nodes
            </span>
            <span className="text-[var(--text-muted)] opacity-50" aria-hidden="true">|</span>
            <span className="text-[var(--text-muted)]">
              <NumberTicker value={filteredLinks.length} /> edges
            </span>
            <span className="text-[var(--text-muted)] opacity-50" aria-hidden="true">|</span>
            {/* Colour PAIRED WITH A WORD, never colour alone (Gate D). The value
                is the real glow sum, so this can no longer claim "at rest"
                while the graph is visibly firing. */}
            <span
              className="text-[var(--text-muted)]"
              style={{ color: hottestGlow > 0.02 ? FIRING : undefined }}
              data-braingraph-criticality={hottestGlow > 0.02 ? 'propagating' : 'rest'}
            >
              {hottestGlow > 0.02 ? 'propagating' : 'at rest'}
            </span>
          </div>
        )}

        {/* ── Type legend: a real filter, not decoration ── */}
        {!hideChrome && entityTypes.length > 0 && (
          <div
            className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter entities by type"
          >
            {entityTypes.map(type => {
              const color = TYPE_COLORS[type] || TYPE_COLORS.default
              const hidden = hiddenTypes.has(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  aria-pressed={!hidden}
                  title={hidden ? `Show ${type}` : `Hide ${type}`}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] transition-opacity ${
                    hidden ? 'opacity-40' : 'hover:opacity-80'
                  } focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:outline-none`}
                  style={{
                    // Alpha derived through the token module rather than by
                    // concatenating a hex with an offset string.
                    background: hidden ? 'transparent' : rgb(hexRGB(color), 0.06),
                    border: hidden ? HAIRLINE : rgb(hexRGB(color), 0.15),
                    color: hidden ? 'var(--text-muted)' : color,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: hidden ? 'var(--text-muted)' : color }}
                  />
                  {type}
                  <span className="opacity-60">{typeCounts[type] || 0}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Hint ── */}
        {!hideChrome && (
          <div className="absolute bottom-3 right-3 z-20 text-[10px] text-[var(--text-muted)] font-mono pointer-events-none">
            {isFiltered
              ? `${filteredNodes.length} of ${nodes.length} shown`
              : 'Click to inspect · drag to rearrange · arrows to navigate'}
          </div>
        )}

        {/* AI Bridge chip */}
        {!hideChrome && (
          <div
            className="absolute bottom-10 right-3 z-20 flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] pointer-events-none"
            style={{ background: RAISED, border: HAIRLINE }}
          >
            <Wifi size={10} className="text-[var(--page-accent)]" aria-hidden="true" />
            <span className="text-[var(--text-muted)]">AI Bridge</span>
            <span className="text-[var(--text-muted)] opacity-50" aria-hidden="true">·</span>
            <span className="text-[var(--text-muted)]">External sessions feed the brain</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <EntityDetailPanel
            key={selected.id}
            node={selected}
            onClose={() => {
              if (!isControlled) {
                setInternalSelected(null)
                setInternalSelectionIds(new Set())
              }
              onNodeClick?.(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}