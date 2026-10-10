import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import type { GraphNode, GraphLink } from '../context-graph/types'
import { TYPE_COLORS } from '../context-graph/types'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  forceZ,
  type Simulation,
  type SimulationLinkDatum,
} from 'd3-force-3d'
import { getNodeGlow, GLOW_DECAY_MS, buildNodeIndex } from './physics/avalanche'
import { graphPaint, rgb, mix, darken, typeRGB } from './graphTokens'

/** Golden angle — used for deterministic initial placement. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * Minimum pointer target, in graph units, for a node. A node's drawn radius is
 * 4–20px, but a 8px dot is not a target. Everything smaller than this is
 * inflated to it so the canvas honours the same 44px guidance as the rest of
 * the app (radius 22 == a 44px diameter).
 */
const MIN_HIT_RADIUS = 22

/** Ticks run synchronously once so the first painted frame is already laid
 *  out. Without this the user watches a random scatter reorganise itself. */
const INITIAL_TICKS = 140
/** Extra ticks used when there is no animation budget (reduced motion), where
 *  a half-settled layout is worse than a fully-settled static one. */
const REDUCED_MOTION_TICKS = 320

/** A node the simulation owns. Extends GraphNode with the pinning fields d3
 *  uses during a drag, plus a cached draw radius derived from the REAL degree
 *  (see `radiusForDegree`). The firing fields are inherited from GraphNode. */
interface SimNode extends GraphNode {
  fx?: number | null
  fy?: number | null
  /** Cached draw radius — recomputed whenever degree changes. */
  r: number
}

/** A link as the simulation sees it — always object-resolved by d3. */
type SimLink = SimulationLinkDatum<SimNode>

export interface BrainGraphProps {
  nodes: GraphNode[]
  links: GraphLink[]
  width: number
  height: number
  onNodeHover?: (node: GraphNode | null) => void
  onNodeClick?: (node: GraphNode | null) => void
  hoveredNode?: GraphNode | null
  selectedNode?: GraphNode | null
  selectionSet?: Set<string>
  /** Accepted for API compatibility. NOT used as the animation clock.
   *  The draw loop samples `Date.now()` itself every frame; see the note on
   *  `timeSourceRef` below for why binding the clock to a prop was a bug. */
  now?: number
  reducedMotion?: boolean
  /** Skip the ambient drift entirely and render a settled static layout. */
  staticLayout?: boolean
  /** Fired from inside the renderer when the layout first settles. */
  onLayoutSettled?: (alpha: number) => void
}

/**
 * Draw radius from degree.
 *
 * NOTE the sqrt. The old formula was `4 + degree * 1.8` linear, and *every*
 * producer of nodes in this app sets `degree: 0` because nothing ever counts
 * the edges — `SelfOrchestrator` and `ContextGraphView` both hardcode
 * `degree: 0`. So the old radius was a flat 4px for the entire graph: eight
 * pixel dots, a 12px hit box, and a network that reads as dust. Degree is now
 * computed from the link set in this component (see `countDegrees`), so the
 * size range is real.
 */
function radiusForDegree(degree: number): number {
  return Math.max(5, Math.min(20, 4 + Math.sqrt(degree) * 2.6))
}

/** Deterministic initial placement — a golden-angle phyllotaxis disc. Chosen
 *  over `Math.random()` (which both producers used) because a random seed
 *  produced a different scatter on every load AND on every resize, since the
 *  loaders re-seed inside a callback that depends on the measured width. */
function seedPosition(i: number, total: number, w: number, h: number) {
  const r = Math.sqrt((i + 0.5) / Math.max(1, total)) * Math.min(w, h) * 0.44
  const a = i * GOLDEN_ANGLE
  return { x: w / 2 + r * Math.cos(a), y: h / 2 + r * Math.sin(a) }
}

/** Breadth-first neighbourhood of an id, out to `depth` hops. Used to highlight
 *  what a selection actually touches, so selecting a node answers "what is this
 *  connected to" without the user having to hover every edge. */
function neighbourhood(links: GraphLink[], id: string, depth: number): Set<string> {
  const adj = new Map<string, string[]>()
  for (const l of links) {
    const s = l.source as string
    const t = l.target as string
    if (!adj.has(s)) adj.set(s, [])
    if (!adj.has(t)) adj.set(t, [])
    adj.get(s)!.push(t)
    adj.get(t)!.push(s)
  }
  const seen = new Set<string>([id])
  let frontier = [id]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const cur of frontier) {
      for (const nb of adj.get(cur) || []) {
        if (seen.has(nb)) continue
        seen.add(nb)
        next.push(nb)
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return seen
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>()

/**
 * BrainGraph — the *suprathreshold* regime of the brain visualization.
 *
 * Renders the knowledge graph as a living neural network. When a node fires, a
 * signal propagates outward along edges as an action potential — fast rise,
 * slow decay.
 *
 * ── Why this component was rewritten ──
 * Four defects made it inert, and all four are structural rather than cosmetic:
 *
 *  1. THERE WAS NO FORCE LAYOUT. This component only ever *read* `node.x/y`.
 *     Nothing computed them, so the layout was whatever `Math.random()` put
 *     there — a random scatter that re-randomised on every window resize. A
 *     force-directed graph with no force is exactly the "jumbled" complaint.
 *
 *  2. THE DRAW LOOP TORN ITSELF DOWN ON EVERY HOVER. The effect's dependency
 *     list included `hoveredNode` and `now`. `hoveredNode` changes on every
 *     mouse-move pixel and `now` was a 100ms interval in the parent, so ten
 *     times a second the effect re-ran: `canvas.width = …` (which clears the
 *     canvas), a fresh offscreen glow canvas, `cancelAnimationFrame`, then
 *     re-request. The result was constant flicker and a simulation that never
 *     got to settle. The loop is now created once and reads props through refs.
 *
 *  3. TIME WAS CAPTURED OUTSIDE THE DRAW CALLBACK, so the decay curve was
 *     sampled once per effect run rather than per frame — a staircase, not a
 *     fade.
 *
 *  4. HIT TESTING IGNORED THE CSS/CANVAS SCALE. `clientX - rect.left` is in CSS
 *     pixels; the node coordinates are in the `width`/`height` prop space. If
 *     those differ, every click landed in the wrong place. It is now scaled.
 *
 * Rendering is Canvas2D with a half-resolution additive glow layer. No WebGL,
 * no new dependencies.
 */
export function BrainGraph(props: BrainGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  /** The current paint function. Set by the draw-loop effect and called by the
   *  reduced-motion path, which has no ambient rAF loop to repaint on its own. */
  const drawRef = useRef<(() => void) | null>(null)

  /** Nodes the simulation owns. Stable object identity across data refreshes so
   *  a re-fetch moves the existing graph instead of rebuilding it. */
  const simNodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const simRef = useRef<Simulation<SimNode> | null>(null)
  const draggingRef = useRef<string | null>(null)

  /**
   * Everything the draw loop needs to read without re-subscribing. Assigning
   * refs during render (not in an effect with deps) is what makes "one loop,
   * no flicker" possible: the loop body closes over stable refs, so no prop
   * change can restart it.
   */
  const viewRef = useRef({
    width: 0,
    height: 0,
    hoveredId: null as string | null,
    selectedId: null as string | null,
    selectionIds: null as Set<string> | null,
    nearIds: new Set<string>() as ReadonlySet<string>,
    reducedMotion: false,
    staticLayout: false,
  })
  const focusIdRef = useRef<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [keyboardActive, setKeyboardActive] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const {
    nodes, links, width, height,
    onNodeHover, onNodeClick,
    hoveredNode, selectedNode, selectionSet,
    reducedMotion = false,
    staticLayout = false,
    onLayoutSettled,
  } = props

  // ── Count degrees from the link set ──
  // The producers of these nodes all hardcode `degree: 0`, so node size and
  // the avalanche branch probability (which reads `degree`) were both dead.
  const degreeMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of links) {
      const s = l.source as string
      const t = l.target as string
      m.set(s, (m.get(s) || 0) + 1)
      m.set(t, (m.get(t) || 0) + 1)
    }
    return m
  }, [links])

  // ── Upsert nodes, preserving positions and firing state ──
  useEffect(() => {
    const prev = new Map(simNodesRef.current.map(n => [n.id, n]))
    const next: SimNode[] = nodes.map((n, i) => {
      const degree = degreeMap.get(n.id) ?? n.degree ?? 0
      const existing = prev.get(n.id)
      if (existing) {
        // Refresh the descriptive fields, keep everything physical. Otherwise a
        // 1.5s poll that returns fresh objects would teleport the whole graph.
        existing.name = n.name
        existing.type = n.type
        existing.state = n.state
        existing.facts = n.facts
        existing.source = n.source
        existing.degree = degree
        existing.r = radiusForDegree(degree)
        return existing
      }
      const pos = seedPosition(i, nodes.length, width, height)
      return {
        ...n,
        x: pos.x,
        y: pos.y,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        degree,
        r: radiusForDegree(degree),
      } as SimNode
    })
    simNodesRef.current = next
    linksRef.current = links
    // Only when it actually changes, so a 1.5s poll returning the same node
    // count does not re-run the simulation effect at all.
    setNodeCount(c => (c === next.length ? c : next.length))
  }, [nodes, links, degreeMap, width, height])

  /**
   * A node-count in STATE, not a ref, so the simulation effect can depend on it.
   *
   * The original dependency was `simNodesRef.current.length` — a REF read during
   * render. The ref is only written inside an effect, so during the render where
   * the data arrives it still holds the PREVIOUS count, and the effect compares
   * old-vs-old. It only ever rebuilt by accident, because `links.length`
   * happened to change in the same commit.
   */
  const [nodeCount, setNodeCount] = useState(0)

  // ── Build / rebuild the simulation ──
  useEffect(() => {
    const simNodes = simNodesRef.current
    if (simNodes.length === 0) {
      // Stop the old simulation. Returning early WITHOUT stopping left a live
      // rAF-driven integrator mutating nodes that are no longer on screen —
      // invisible work, and it kept a d3 timer alive for an empty graph.
      simRef.current?.stop()
      simRef.current = null
      return
    }
    if (width <= 0 || height <= 0) return

    const live = viewRef.current
    const still = live.reducedMotion || live.staticLayout

    simRef.current?.stop()

    // Hand d3 a CLONE of the links. `forceLink` rewrites `source`/`target`
    // from ids into node objects, in place. The caller keeps passing ids (and
    // `getEdgeSignal` matches on ids), so mutating the caller's array in place
    // is what used to make every edge fail its lookup and silently vanish.
    const simLinks: SimLink[] = linksRef.current.map(l => ({
      source: l.source as string,
      target: l.target as string,
    }))

    const cx = width / 2
    const cy = height / 2

    // `forceLink`'s `distance`/`strength` accessors are handed the LINK, not the
    // node, so the degree has to be looked up by endpoint id. Reading
    // `link.degree` compiles and yields `undefined` at runtime, which silently
    // flattens every edge to the same length.
    const degreeById = new Map<string, number>()
    for (const n of simNodes) degreeById.set(n.id, n.degree || 0)
    const endpointDegree = (e: SimNode | string | number): number =>
      degreeById.get(typeof e === 'object' ? e.id : String(e)) ?? 0

    const sim = forceSimulation<SimNode>(simNodes, 2)
      .force('link', forceLink<SimNode, SimLink>(simLinks)
        .id(d => d.id)
        // Short edges between hubs, longer for leaf pairs — gives the graph
        // visible community structure instead of one uniform hairball.
        .distance(l => 68 + Math.min(60, Math.max(
          endpointDegree(l.source),
          endpointDegree(l.target),
        ) * 6))
        .strength(l => 0.55 / (1 + Math.max(
          endpointDegree(l.source),
          endpointDegree(l.target),
        ) * 0.25)))
      .force('charge', forceManyBody<SimNode>()
        .strength(d => -140 - Math.min(320, (d.degree || 0) * 22))
        .distanceMax(340))
      .force('collide', forceCollide<SimNode>().radius(d => d.r + 7).strength(0.85))
      .force('center', forceCenter<SimNode>(cx, cy))
      // Explicit centring plus a soft positional pull, so the graph stays
      // framed whatever aspect ratio the layout gives it instead of drifting
      // into a corner and leaving a third of the canvas empty.
      .force('x', forceX<SimNode>(cx).strength(0.055))
      .force('y', forceY<SimNode>(cy).strength(0.075))
      .force('z', forceZ<SimNode>(0).strength(1))
      .alphaDecay(0.028)
      .velocityDecay(0.42)

    let settled = false
    sim.on('tick', () => {
      // Clamp into the canvas. d3 has no notion of a viewport, so un-clamped
      // nodes drift off-frame and the user sees a graph with pieces missing.
      const pad = 28
      for (const n of simNodes) {
        n.x = Math.max(pad, Math.min(width - pad, n.x))
        n.y = Math.max(pad, Math.min(height - pad, n.y))
        n.z = 0
      }
      if (!settled && sim.alpha() < sim.alphaMin()) {
        settled = true
        onLayoutSettled?.(sim.alpha())
      }
    })

    // Settle synchronously. Painting an unorganised scatter first and then
    // animating to the layout is the "jumbled" first impression.
    sim.tick(still ? REDUCED_MOTION_TICKS : INITIAL_TICKS)
    for (const n of simNodes) {
      n.x = Math.max(28, Math.min(width - 28, n.x))
      n.y = Math.max(28, Math.min(height - 28, n.y))
    }

    simRef.current = sim

    if (still) {
      // Fully static: alpha below alphaMin with no target means no ticks.
      sim.alpha(0).stop()
      onLayoutSettled?.(0)
    } else {
      // Ambient drift. The layout is never truly frozen — this is the "living"
      // quality — but the amplitude is small enough that the network reads as
      // breathing rather than jittering.
      sim.alpha(0.999)
      sim.alphaTarget(0.028)
      sim.restart()
    }

    return () => {
      sim.on('tick', null)
      sim.stop()
    }
    // `still` is read from a ref so that toggling reduced-motion does not
    // rebuild the whole simulation; a dedicated effect handles that below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeCount, links.length, width, height])

  // ── Reduced-motion / static switch ──
  useEffect(() => {
    viewRef.current.reducedMotion = reducedMotion
    viewRef.current.staticLayout = staticLayout
    const sim = simRef.current
    if (!sim) return
    if (reducedMotion || staticLayout) {
      sim.alphaTarget(0)
      sim.stop()
      // Converge hard to a clean static layout instead of freezing mid-drift.
      sim.alpha(1).tick(REDUCED_MOTION_TICKS).alpha(0).stop()
    } else {
      sim.alphaTarget(0.028)
      sim.alpha(Math.max(sim.alpha(), 0.02))
      sim.restart()
    }
  }, [reducedMotion, staticLayout])

  // ── Push prop state into the ref the draw loop reads ──
  viewRef.current.width = width
  viewRef.current.height = height
  viewRef.current.hoveredId = hoveredNode?.id ?? null
  viewRef.current.selectedId = selectedNode?.id ?? null
  viewRef.current.selectionIds = selectionSet ?? null
  viewRef.current.nearIds = selectedNode
    ? neighbourhood(linksRef.current, selectedNode.id, 2)
    : EMPTY_SET

  // ── Kick the layout when something fires ──
  // A cascade should visibly *move* the network, not just light it up.
  useEffect(() => {
    const handler = () => {
      const sim = simRef.current
      const v = viewRef.current
      if (!sim) return
      if (v.reducedMotion || v.staticLayout) {
        // No motion budget: repaint the single static frame so the firing node
        // still reads as fired.
        drawRef.current?.()
        return
      }
      sim.alpha(Math.max(sim.alpha(), 0.16)).restart()
    }
    window.addEventListener('braingraph:fire', handler)
    return () => window.removeEventListener('braingraph:fire', handler)
  }, [])

  // ── THE draw loop ──
  // Created once. Reads everything through refs. Nothing in its dependency
  // list can change, so no prop update can cancel or restart it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const glowCanvas = document.createElement('canvas')
    const glowCtx = glowCanvas.getContext('2d')
    if (!glowCtx) return

    let lastW = -1
    let lastH = -1

    function ensureSize(w: number, h: number) {
      if (w <= 0 || h <= 0) return false
      const dpr = window.devicePixelRatio || 1
      if (lastW === w && lastH === h) return true
      lastW = w
      lastH = h
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      glowCanvas!.width = Math.max(1, Math.floor(w / 2))
      glowCanvas!.height = Math.max(1, Math.floor(h / 2))
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      glowCtx!.setTransform(0.5, 0, 0, 0.5, 0, 0)
      return true
    }

    function draw() {
      const v = viewRef.current
      const w = v.width
      const h = v.height
      if (!ensureSize(w, h)) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const simNodes = simNodesRef.current
      const simLinks = linksRef.current
      // Resolve the palette from live CSS once per frame. This is what lets the
      // canvas follow the app theme and the `data-page` accent instead of
      // freezing a palette at module load.
      const P = graphPaint(containerRef.current)
      const SPIKE = rgb(P.spike)
      // Sampled INSIDE the loop. Capturing it outside meant the glow curve was
      // resampled once per effect run rather than once per frame.
      const now = Date.now()
      const index = buildNodeIndex(simNodes)

      ctx!.clearRect(0, 0, w, h)
      glowCtx!.clearRect(0, 0, glowCanvas!.width, glowCanvas!.height)

      const selId = v.selectedId
      const hoverId = v.hoveredId
      const selSet = v.selectionIds
      const near = v.nearIds
      const focusId = focusIdRef.current

      const isDimmed = (n: SimNode) =>
        !!selId && n.id !== selId && !near.has(n.id) && !(selSet?.has(n.id) ?? false)

      // ── Edges ──
      for (const link of simLinks) {
        const src = index.get(link.source as string)
        const tgt = index.get(link.target as string)
        if (!src || !tgt) continue

        const touchesSelection = !!selId && (src.id === selId || tgt.id === selId)
        const touchesHover = !!hoverId && (src.id === hoverId || tgt.id === hoverId)
        // Edge signal is the SOURCE node's glow, so a pulse visibly travels
        // outward from the node that fired.
        const srcGlow = getNodeGlow(src, now)
        const tgtGlow = getNodeGlow(tgt, now)
        const signal = Math.max(srcGlow, tgtGlow)

        if (touchesSelection) {
          const col = rgb(typeRGB(src.type, TYPE_COLORS))
          const grad = ctx!.createLinearGradient(src.x, src.y, tgt.x, tgt.y)
          grad.addColorStop(0, rgb(typeRGB(src.type, TYPE_COLORS), 0.6))
          grad.addColorStop(1, rgb(typeRGB(src.type, TYPE_COLORS), 0.4))
          ctx!.strokeStyle = grad
          ctx!.lineWidth = 2
          ctx!.shadowColor = col
          ctx!.shadowBlur = 10
          ctx!.beginPath()
          ctx!.moveTo(src.x, src.y)
          ctx!.lineTo(tgt.x, tgt.y)
          ctx!.stroke()
          ctx!.shadowBlur = 0
          continue
        }

        if (touchesHover) {
          ctx!.strokeStyle = rgb(P.label, 0.34)
          ctx!.lineWidth = 1.4
          ctx!.beginPath()
          ctx!.moveTo(src.x, src.y)
          ctx!.lineTo(tgt.x, tgt.y)
          ctx!.stroke()
          continue
        }

        if (signal > 0.01) {
          // Action potential: bright amber pulse, thickest at the firing end.
          const grad = ctx!.createLinearGradient(src.x, src.y, tgt.x, tgt.y)
          grad.addColorStop(0, rgb(P.spike, Math.min(1, signal * 0.95)))
          grad.addColorStop(1, rgb(P.spike, Math.min(1, signal * 0.35)))
          ctx!.strokeStyle = grad
          ctx!.lineWidth = 1 + signal * 2.4
          ctx!.shadowColor = SPIKE
          ctx!.shadowBlur = signal * 14
          ctx!.beginPath()
          ctx!.moveTo(src.x, src.y)
          ctx!.lineTo(tgt.x, tgt.y)
          ctx!.stroke()
          ctx!.shadowBlur = 0
          continue
        }

        // Resting edge: tapered, so structure reads as depth not uniform wire.
        const base = isDimmed(src) && isDimmed(tgt) ? 0.05 : 0.3
        const hot = mix(P.edge, P.accent, 0.35)
        const cold = darken(P.edge, 0.45)
        const grad = ctx!.createLinearGradient(src.x, src.y, tgt.x, tgt.y)
        grad.addColorStop(0, rgb(hot, base))
        grad.addColorStop(1, rgb(cold, base * 0.45))
        ctx!.strokeStyle = grad
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.moveTo(src.x, src.y)
        ctx!.lineTo(tgt.x, tgt.y)
        ctx!.stroke()
      }

      // ── Nodes ──
      for (const node of simNodes) {
        const r = node.r
        const tint = typeRGB(node.type, TYPE_COLORS)
        const isSelected = node.id === selId
        const isHover = node.id === hoverId
        const isFocused = node.id === focusId
        const isInSelection = !!selSet?.has(node.id)
        const dim = isDimmed(node)
        const glow = getNodeGlow(node, now)

        // Under reduced motion there is no decay to watch, so a firing node is
        // shown at a static, clearly-legible peak for the same window instead.
        const shownGlow = v.reducedMotion
          ? (node.lastFiredAt && now - node.lastFiredAt < GLOW_DECAY_MS ? 1 : 0)
          : glow

        if (shownGlow > 0.01 || isSelected) {
          const glowR = r * (2.6 + shownGlow * 3.4)
          const halo = shownGlow > 0 ? P.spike : tint
          const a = Math.max(shownGlow * 0.55, isSelected ? 0.42 : 0)
          const grad = glowCtx!.createRadialGradient(node.x, node.y, r * 0.3, node.x, node.y, glowR)
          grad.addColorStop(0, rgb(halo, Math.min(1, a)))
          grad.addColorStop(1, rgb(halo, 0))
          glowCtx!.fillStyle = grad
          glowCtx!.beginPath()
          glowCtx!.arc(node.x, node.y, glowR, 0, Math.PI * 2)
          glowCtx!.fill()
        }

        // Hover ring lives on the glow layer so it never muddies the body.
        if (isHover || isFocused) {
          const ringR = r + (isFocused ? 9 : 6)
          glowCtx!.strokeStyle = isFocused ? rgb(P.labelStrong, 0.85) : rgb(P.labelHover, 0.45)
          glowCtx!.lineWidth = isFocused ? 2 : 1.25
          glowCtx!.beginPath()
          glowCtx!.arc(node.x, node.y, ringR, 0, Math.PI * 2)
          glowCtx!.stroke()
        }

        const nr = isHover || isFocused ? r * 1.18 : r
        ctx!.globalAlpha = dim ? 0.2 : 1

        // One shaded fill for every state. Branching fillStyle per state is
        // what flattened this back into a 1900s plotting tool.
        const body = ctx!.createRadialGradient(
          node.x - nr * 0.35, node.y - nr * 0.4, nr * 0.1,
          node.x, node.y, nr,
        )
        body.addColorStop(0, rgb(mix(tint, P.highlight, 0.82)))
        body.addColorStop(0.28, rgb(tint))
        body.addColorStop(1, rgb(darken(tint, 0.38)))
        ctx!.fillStyle = body
        ctx!.beginPath()
        ctx!.arc(node.x, node.y, nr, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.globalAlpha = 1

        if (isSelected || shownGlow > 0.02) {
          ctx!.strokeStyle = shownGlow > 0.02 ? rgb(P.spike) : rgb(tint)
          ctx!.lineWidth = isSelected ? 2 : 1.5
          ctx!.stroke()
        } else if (isInSelection) {
          ctx!.strokeStyle = rgb(tint)
          ctx!.lineWidth = 1.25
          ctx!.stroke()
        }

        // Label. Hidden when dimmed, and hidden entirely once the graph is
        // dense enough that labels would be an unreadable mat.
        if (!dim && simNodes.length <= 90) {
          const label = node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name
          ctx!.font = isSelected ? '600 11px "Inter", system-ui, sans-serif' : '500 11px "Inter", system-ui, sans-serif'
          ctx!.fillStyle = isSelected ? rgb(P.labelStrong)
            : (isHover || isFocused) ? rgb(P.labelHover)
            : rgb(P.label)
          ctx!.textAlign = 'center'
          ctx!.fillText(label, node.x, node.y + r + 13)
          ctx!.textAlign = 'start'
        }
      }

      // ── Composite the glow additively ──
      // `source-over` (the implicit default) just paints the halo over the
      // scene, which reads as a grey smear. The glow layer only ever contains
      // light, so it wants `lighter`.
      ctx!.save()
      ctx!.globalCompositeOperation = 'lighter'
      ctx!.drawImage(glowCanvas!, 0, 0, w, h)
      ctx!.restore()
    }

    const tick = () => {
      draw()
      rafRef.current = requestAnimationFrame(tick)
    }

    drawRef.current = draw

    if (viewRef.current.reducedMotion || viewRef.current.staticLayout) {
      // No ambient loop at all under reduced motion: exactly one frame. Every
      // later visual state change is pushed through `drawRef` by the effects
      // that depend on it.
      draw()
    } else {
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      drawRef.current = null
    }
  }, [])

  // ── Repaint on state change when there is no ambient loop ──
  useEffect(() => {
    if (!reducedMotion && !staticLayout) return
    // Draw order matters: the sim must already have the new positions, and the
    // view ref the new hover/selection, before the frame is painted. Both are
    // assigned during render, so this effect is the right place.
    drawRef.current?.()
  }, [reducedMotion, staticLayout, hoveredNode, selectedNode, selectionSet, nodes, links, width, height])

  // ── Coordinate helper: CSS pixels → graph space ──
  const toGraphCoords = useCallback((clientX: number, clientY: number) => {
    const c = canvasRef.current
    const v = viewRef.current
    if (!c) return { x: 0, y: 0 }
    const rect = c.getBoundingClientRect()
    // The canvas element is `w-full h-full` but its drawing surface is the
    // `width`/`height` props. If those disagree the naive subtraction is wrong
    // by the scale factor — which is why clicks used to miss their nodes.
    const sx = rect.width > 0 ? v.width / rect.width : 1
    const sy = rect.height > 0 ? v.height / rect.height : 1
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy }
  }, [])

  /** Nearest node to a point, honouring the 44px minimum target. */
  const hitTest = useCallback((gx: number, gy: number): SimNode | null => {
    const simNodes = simNodesRef.current
    let best: SimNode | null = null
    let bestD = Infinity
    for (const n of simNodes) {
      const dx = gx - n.x
      const dy = gy - n.y
      const d2 = dx * dx + dy * dy
      const hit = Math.max(n.r + 8, MIN_HIT_RADIUS)
      if (d2 < hit * hit && d2 < bestD) {
        bestD = d2
        best = n
      }
    }
    return best
  }, [])

  // ── Pointer interaction ──
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = toGraphCoords(e.clientX, e.clientY)

    // Drag takes precedence over hover so the node under the cursor keeps its
    // highlight while it is being moved.
    const draggingId = draggingRef.current
    if (draggingId) {
      const n = simNodesRef.current.find(x => x.id === draggingId)
      if (n) {
        const v = viewRef.current
        const pad = 28
        n.fx = Math.max(pad, Math.min(v.width - pad, g.x))
        n.fy = Math.max(pad, Math.min(v.height - pad, g.y))
        simRef.current?.alpha(0.06).restart()
      }
      return
    }

    const hit = hitTest(g.x, g.y)
    onNodeHover?.(hit ?? null)
  }, [hitTest, onNodeHover, toGraphCoords])

  const handlePointerLeave = useCallback(() => {
    if (draggingRef.current) return
    onNodeHover?.(null)
  }, [onNodeHover])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = toGraphCoords(e.clientX, e.clientY)
    const hit = hitTest(g.x, g.y)
    if (!hit) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    draggingRef.current = hit.id
    hit.fx = hit.x
    hit.fy = hit.y
    simRef.current?.alpha(0.08).restart()
  }, [hitTest, toGraphCoords])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const id = draggingRef.current
    if (!id) return
    draggingRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const n = simNodesRef.current.find(x => x.id === id)
    if (n) {
      // Release the pin but leave the layout warm, so neighbours relax around
      // the new position instead of snapping back.
      n.fx = null
      n.fy = null
      const sim = simRef.current
      if (sim && !viewRef.current.reducedMotion && !viewRef.current.staticLayout) {
        sim.alpha(0.12).restart()
      }
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = toGraphCoords(e.clientX, e.clientY)
    const hit = hitTest(g.x, g.y)
    onNodeClick?.(hit ?? null)
  }, [hitTest, onNodeClick, toGraphCoords])

  // ── Keyboard interaction ──
  // A canvas has no accessible children, so without this the entire graph is
  // invisible to keyboard users and to screen readers. Arrow keys move to the
  // nearest node in that direction, Enter/Space select, Escape clears.
  const focusNodeById = useCallback((id: string | null) => {
    focusIdRef.current = id
    setFocusId(id)
    const n = id ? simNodesRef.current.find(x => x.id === id) : null
    if (n) {
      setAnnouncement(`${n.name}, ${n.type}, ${n.degree} connections`)
    } else {
      setAnnouncement('')
    }
  }, [])

  const stepFocus = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    const simNodes = simNodesRef.current
    if (simNodes.length === 0) return
    const currentId = focusIdRef.current
    let from: SimNode | undefined = simNodes.find(n => n.id === currentId)
    if (!from) {
      // No focus yet: enter the layout from the centre outward.
      from = simNodes.reduce((best, n) =>
        !best || Math.hypot(n.x - viewRef.current.width / 2, n.y - viewRef.current.height / 2)
          < Math.hypot(best.x - viewRef.current.width / 2, best.y - viewRef.current.height / 2)
          ? n : best, undefined as SimNode | undefined)
      if (from) focusNodeById(from.id)
      return
    }

    const vx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0
    const vy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
    let best: SimNode | null = null
    let bestScore = Infinity
    for (const n of simNodes) {
      if (n.id === from.id) continue
      const dx = n.x - from.x
      const dy = n.y - from.y
      const along = dx * vx + dy * vy
      if (along <= 2) continue // must be in the direction pressed
      const lateral = Math.abs(dx * vy - dy * vx) // perpendicular distance
      // Heavily prefer travelling straight, so arrow keys feel directional.
      const score = along + lateral * 2.4
      if (score < bestScore) {
        bestScore = score
        best = n
      }
    }
    if (best) {
      focusNodeById(best.id)
      onNodeHover?.(best)
    }
  }, [focusNodeById, onNodeHover])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    setKeyboardActive(true)
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); stepFocus('left'); return
      case 'ArrowRight': e.preventDefault(); stepFocus('right'); return
      case 'ArrowUp': e.preventDefault(); stepFocus('up'); return
      case 'ArrowDown': e.preventDefault(); stepFocus('down'); return
      case 'Home': {
        e.preventDefault()
        const first = simNodesRef.current[0]
        if (first) focusNodeById(first.id)
        return
      }
      case 'End': {
        e.preventDefault()
        const last = simNodesRef.current[simNodesRef.current.length - 1]
        if (last) focusNodeById(last.id)
        return
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        const n = focusIdRef.current
          ? simNodesRef.current.find(x => x.id === focusIdRef.current) ?? null
          : null
        if (n) {
          onNodeClick?.(n)
          setAnnouncement(`${n.name} selected`)
        }
        return
      }
      case 'Escape': {
        e.preventDefault()
        focusNodeById(null)
        onNodeClick?.(null)
        return
      }
      default:
    }
  }, [focusNodeById, onNodeClick, stepFocus])

  const isEmpty = nodes.length === 0

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      data-focused-node={focusId ?? ''}
      data-braingraph-count={nodes.length}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        tabIndex={0}
        role="application"
        aria-roledescription="knowledge graph"
        aria-label={`Context Brain graph: ${nodes.length} entities, ${links.length} connections. Use arrow keys to move between entities, Enter to inspect, Escape to clear.`}
        aria-describedby="braingraph-help"
        data-braingraph-canvas=""
        data-node-count={nodes.length}
        data-edge-count={links.length}
        className={`w-full h-full outline-none touch-none ${
          keyboardActive ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        } focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ws-surface)] rounded-xl`}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onBlur={() => { setKeyboardActive(false); focusNodeById(null) }}
      />

      {/* Keyboard instructions, visually hidden but read by assistive tech. */}
      <p id="braingraph-help" className="sr-only">
        Arrow keys move between entities. Enter opens the focused entity. Escape clears the
        selection. Entities can also be dragged to rearrange the graph.
      </p>

      {/* Screen-reader live region for the keyboard cursor. */}
      <div aria-live="polite" className="sr-only" data-braingraph-announcer="">{announcement}</div>

      {isEmpty && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{ background: 'var(--ws-surface)' }}
          data-braingraph-empty=""
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-xs text-zinc-500">Building knowledge graph…</span>
          </div>
        </div>
      )}
    </div>
  )
}