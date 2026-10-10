import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Network, Brain, RefreshCw, ChevronDown,
  Zap, ExternalLink, MousePointerClick, Sparkles,
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

/* ═══════════════════════════════════════════════════════════════════════
   CARDS — the real primitive, not a hand-rolled box.

   This used to define its own `CARD_CLASS`:
     "rounded-xl border border-zinc-800/50 bg-zinc-900/60
      light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5"

   That class string is the single most recognisable piece of AI slop: a
   full-perimeter 1px border + a translucent fill + a blur + 20px padding,
   repeated N times down the page. It is what makes a screen read as "a stack of
   floating rectangles" instead of one surface with regions — which is verbatim
   the user's complaint ("everything is stacked on top of one another").

   `components/ui/card.tsx` is the house primitive and it does the opposite:
   `bg-[var(--bg-elevated)]`, a `border-T` hairline ONLY (no box), `rounded-lg`,
   and `--text-primary` / `--text-muted` for type. The top-rule-only detail is
   the whole difference — it reads as a panel that continues past its edges
   rather than a rectangle floating in front of a background. So the cards are no
   longer authored here at all; they are composed from the primitive.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * `prefers-reduced-motion` as a hook.
 *
 * It used to be `getReducedMotion()` called *during render*. That is an impure
 * read: it cannot be re-read when the OS setting changes, it re-runs the
 * matchMedia query on every single render of the page, and any consumer that
 * memoised on it got a new value only by accident. It is now a real
 * subscription, and it is STILL passed down and STILL gates the ambient layer
 * — that threading is load-bearing, not decorative.
 */
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

/** Entrance variant. Duration and easing come from the motion token set; no
 *  spring — this is an instrument surface. */
const fadeSlideUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

// ═══════════════════════════════════════════════════════════════════════
//  Stat tile
// ═══════════════════════════════════════════════════════════════════════
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
        {/*
          `tabular-nums` + a FIXED min-width. Without the fixed width the number
          ticks 0 -> 12 -> 148 and shoves the whole masthead sideways on every
          poll. During load this shows a skeleton of the same footprint rather
          than `0`, because a real 0 and a not-yet-known 0 must not look alike —
          that is the "partial" state, and it needs to be visibly partial.
        */}
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

// ═══════════════════════════════════════════════════════════════════════
//  SelfOrchestrator — the Self tab of the Life page
//
//  ── THE ORGANISING IDEA ──
//  "The brain is the page. Identity is its legend."
//
//  What is the Self page FOR? It is the only surface that can answer "who am
//  I, and how does what the app knows about me actually connect?" Covenant owns
//  commitments, Memories owns people and photos, Gold owns goals, Notes owns
//  prose. None of them can show topology. Identity is the key; the graph is the
//  territory.
//
//  Why the old layout failed at that job, specifically:
//
//   1. It put the key in the sidebar. A 340px rail holding Identity is a
//      thesis statement that identity is a caption on the graph rather than
//      the subject of the page.
//   2. It gave the thing that needs AREA the least of it. A force-directed
//      network is legible only in proportion to area; at ~940px it is a
//      hairball. Meanwhile a row of four static numbers got a full-width card
//      of its own.
//   3. It stole 288px for `ActivityFeed` — a readout OF the graph — reducing
//      the graph to describe the graph. A readout belongs docked to its
//      subject, not beside it as a peer.
//   4. It hardcoded `hideChrome` on the graph, so search, type legend, stats
//      and the activity chip were all suppressed. The only interactive
//      component on the page had zero controls.
//   5. The graph's layout was `Math.random()`, re-seeded inside a callback
//      that depended on the measured width — so it reshuffled on every resize.
//      "Jumbled" was literally, measurably true.
//
//  The replacement: ONE full-bleed graph that owns the whole viewport. The
//  identity rail becomes a LEGEND — who you are, plus what the colours mean
//  and what you are currently looking at. The avalanche readout becomes a
//  ticker docked to the graph. Governance becomes a drawer, because it is a
//  tool you open, not a view you stare at.
// ═══════════════════════════════════════════════════════════════════════
export function SelfOrchestrator() {
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)
  const [mgmtExpanded, setMgmtExpanded] = useState(false)

  const reducedMotion = useReducedMotion()

  // ── Graph data ──
  const [graphLoading, setGraphLoading] = useState(true)
  const [graphError, setGraphError] = useState(false)
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [activity, setActivity] = useState<BrainActivityEvent[]>([])

  /**
   * Ambient-field bias points. `x/y` come from the layout, which is why this
   * now has something to point at — the field is biased toward the real graph
   * rather than being independent decoration.
   */
  const flowDataPoints = useMemo(
    () => (graphNodes as any[])
      .filter(n => typeof n.x === 'number' && typeof n.y === 'number')
      .map(n => ({ x: n.x, y: n.y, strength: n.state === 'active' ? 0.5 : 0.1 })),
    [graphNodes],
  )

  // ── Graph canvas size (measured) ──
  // `graphContainerRef` is attached to the ELEMENT that actually contains the
  // canvas, so the measured size and the `width`/`height` handed to the
  // renderer describe the same box. Previously the ref sat on a wrapper whose
  // width included a gap and whose height was clamped, so the canvas was laid
  // out at one size and drawn at another — which is exactly the mismatch that
  // broke hit-testing.
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [graphW, setGraphW] = useState(960)
  const [graphH, setGraphH] = useState(560)

  useEffect(() => {
    const el = graphContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        // Guard against a collapsed parent reporting 0: handing 0 to the
        // renderer silently produces a blank canvas, which reads as "the graph
        // is broken" rather than "the layout collapsed".
        if (w > 2) setGraphW(Math.floor(w))
        if (h > 2) setGraphH(Math.floor(h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Load brain stats ──
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

  // ── Load graph data ──
  // NOTE the empty dependency array. The old version listed `graphW` and
  // `graphH`, which meant every single resize re-ran the whole fetch AND
  // re-randomised every node position. `graphW/graphH` are not needed here at
  // all — the renderer owns layout and reads them through the container.
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
          // degree is intentionally left at 0 — BrainGraph counts it from the
          // link set, because a producer-side count was never maintained.
          degree: 0,
          facts: [],
          source: entity.source || 'brain',
          // Placeholder only. The renderer seeds real positions deterministically
          // on its first frame; seeding randomly here is what made the graph
          // look like scattered dust.
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

  /* ── Activity events: diff the state field, don't read lastFiredAt ──
     `lastFiredAt` is a runtime-derived value that is never persisted, so the
     old code gated on it and the array was always empty. It also stamped
     `lastFiredAt` onto a freshly-fetched IPC object that was thrown away on the
     next line, so even the nodes that DID fire lit nothing up. Now the stamp
     lands on the node objects the renderer actually draws. */
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
            // Fire into the LIVE node the renderer is drawing, not the
            // throwaway object from IPC. This is the fix: it is why the
            // ambient activity finally shows up on the graph.
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

  // ── Node handlers ──
  const handleNodeHover = useCallback((node: GraphNode | null) => setHoveredNode(node), [])
  const handleNodeClick = useCallback((node: GraphNode | null) => {
    if (!node) { setSelectedNode(null); setSelectedNodeIds(new Set()); return }
    if (selectedNode?.id === node.id) { setSelectedNode(null); setSelectedNodeIds(new Set()) }
    else { setSelectedNode(node); setSelectedNodeIds(new Set([node.id])) }
  }, [selectedNode])

  /** Cascades the graph itself produced — the same events `ActivityFeed`
   *  renders, so clicking a node is visible in both windows. */
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

  /**
   * The graph's own state.
   *
   * It used to be `stats ? 'populated' : 'loading'`. `loadStats` only called
   * `setStats` `if (data)`, so a falsy `brainStats()` response left the page on
   * the loading spinner FOREVER and the graph never mounted — regardless of
   * whether there was a graph to show. Derived from the graph's own load state
   * instead, which is what the renderer actually depends on.
   */
  const graphState: 'empty' | 'loading' | 'error' | 'populated' =
    graphError ? 'error'
    : graphLoading && !hasGraph ? 'loading'
    : hasGraph ? 'populated'
    : 'empty'

  return (
    <SelfErrorBoundary>
      {/*
        ONE signal hue for the whole surface: `var(--page-accent)`, which is clay
        for `data-page="life"`. The previous version used FOUR different hues
        (violet masthead, amber identity, green empty-state, cyan management) —
        four signals on one page tells the eye nothing is more important than
        anything else, and it is the most reliable AI-slop tell there is. Amber
        survives in exactly ONE place: the avalanche readout, because there it
        means "an event is firing right now" and nothing else.
      */}
      <div className="relative w-full" data-section="life.self.brain">
        {/* Ambient layer — functional, gated on reducedMotion. */}
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

        {/* ═══════════════════════════════════════════════════════════════
            MASTHEAD — full width, one row, deliberately NOT a card.
            The old layout gave four static numbers a bordered card of their
            own, which asserted they were a peer of the graph. They are not: they
            are the graph's caption, so they sit above it at the same optical
            weight as the title.
            ═══════════════════════════════════════════════════════════════ */}
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

          {/* A failed read must never blank the number it belonged to — the
              caption survives the error, which is what makes it a caption. */}
          {statsError && (
            <p className="text-[11px] text-rose-400 mt-2" role="status">
              Totals unavailable — the graph below is still live.
            </p>
          )}
        </header>

        {/* ═══════════════════════════════════════════════════════════════
            THE STAGE — identity as legend (left) and the graph (centre) in one
            row, with the readout docked UNDER the graph. Nothing is stacked,
            and no column is narrower than its content.
            ═══════════════════════════════════════════════════════════════ */}
        <motion.div
          className="relative z-10 px-5 pb-5 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* ── IDENTITY AS LEGEND ──
              Same component, different job: no longer a rail that holds the
              centrepiece, but the key to the picture beside it. */}
          <motion.aside
            custom={0}
            variants={fadeSlideUp}
            data-section="life.self.identity"
            aria-label="Identity"
          >
            <Card className="gap-0 py-0">
              <CardHeader className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <User size={13} className="text-[var(--page-accent)]" aria-hidden="true" />
                  <CardTitle>Identity</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {/* Partial state is explicit: an unavailable profile must not
                    collapse the legend it belongs to. */}
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
                      {/* Colour PAIRED WITH A WORD, never colour alone (Gate D). */}
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
          </motion.aside>

          {/* ── THE GRAPH ── */}
          <motion.div
            custom={1}
            variants={fadeSlideUp}
            className="flex flex-col gap-5 min-w-0"
          >
            {/*
              Deliberately NOT wrapped in a card. The graph IS the surface —
              putting a bordered panel around a full-bleed canvas just adds a
              frame around the thing that was supposed to be the page, which is
              where the "floating boxes" reading came from.
            */}
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
                    {/* Says what WOULD be here, never "No data". */}
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Entities appear here automatically as you chat with the AI, complete goals,
                      and update life phases — then connect into the graph on the left.
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

            {/* ── THE READOUT ──
                Docked UNDER the graph. It is a readout OF this graph, so it
                belongs attached to it; as a 288px sibling column it stole a
                quarter of the network's width in order to describe it. */}
            <Card
              className="gap-0 py-0"
              data-section="life.self.activity"
              aria-label="Avalanche activity"
            >
              <CardHeader className="px-4 pt-3 pb-2 border-b border-[var(--ws-border)] grid-rows-[auto]">
                <div className="flex items-center gap-2">
                  {/* Amber is meaningful here and nowhere else on this page. */}
                  <Zap size={12} className="text-[var(--color-amber-400)]" aria-hidden="true" />
                  <CardTitle>Avalanche readout</CardTitle>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {activity.length > 0 ? `${activity.length} events` : 'no events yet'}
                  </span>
                </div>
              </CardHeader>
              {/* Fixed height with its own scroll, so a burst of activity cannot
                  push the page down while you are reading it. */}
              <div className="h-[132px] overflow-y-auto">
                <ActivityFeed
                  nodes={graphNodes}
                  activity={activity}
                  reducedMotion={reducedMotion}
                />
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════
            GOVERNANCE — a drawer.
            It was a full-width row of static numbers, which asserted it was a
            peer of the graph. It is not: you open it when you want to govern
            the graph and close it when you want to look at it.

            MOTION COMPLIANCE: this used to animate `height: 0 -> auto`, which
            PAINT Gate E bans outright ("never animate width/height/top/left/
            margin"). It now mounts and animates OPACITY + a transform only, so
            no layout property is animated anywhere on this page.
            ═══════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 px-5 pb-5">
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
        </div>
      </div>
    </SelfErrorBoundary>
  )
}
