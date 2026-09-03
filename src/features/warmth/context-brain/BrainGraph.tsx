import { useRef, useEffect, useCallback } from 'react'
import type { GraphNode, GraphLink } from '../context-graph/types'
import { TYPE_COLORS } from '../context-graph/types'
import { getNodeGlow, getEdgeSignal } from './physics/avalanche'

const SPIKE_COLOR = '#f59e0b' // amber — reserved exclusively for firing events

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
  /** Current time in ms for glow calculations. Defaults to Date.now(). */
  now?: number
}

/**
 * BrainGraph — the *suprathreshold* regime of the brain visualization.
 *
 * Renders the knowledge graph as a living neural network. When a node fires
 * (state flips to `active`, a fact is queried, an episode lands), a signal
 * propagates outward along edges as an action potential — fast rise, slow decay.
 *
 * Visual language:
 * - Resting nodes: flat colored circles with subtle depth (z-coordinate)
 * - Firing nodes: amber glow halo + brightened core (additive bloom)
 * - Edges: tapering Cajal-style lines, signal propagation as amber pulse
 * - Depth: z-coordinate maps to size + opacity (closer = larger/brighter)
 *
 * Rendering: Canvas2D with half-resolution glow layer, box-blur, additive composite.
 * Zero new dependencies.
 */
export function BrainGraph(props: BrainGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)
  const mousePosRef = useRef({ x: 0, y: 0 })

  const {
    nodes, links, width, height,
    onNodeHover, onNodeClick,
    hoveredNode, selectedNode, selectionSet,
    now,
  } = props

  // ── Node radius from degree ──
  function nodeRadius(d: GraphNode): number {
    return Math.max(4, Math.min(18, 4 + (d.degree || 0) * 1.8))
  }

  // ── Depth factor from z-coordinate (-1..1 → 0.5..1.2) ──
  function depthFactor(d: GraphNode): number {
    // z is roughly -1..1 from d3-force-3d; map to a depth scale
    const z = d.z || 0
    return 0.7 + (z + 1) * 0.25 // 0.7..1.2
  }

  // ── Draw loop ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Glow layer (half resolution for performance + soft blur)
    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = Math.floor(width / 2)
    glowCanvas.height = Math.floor(height / 2)
    const glowCtx = glowCanvas.getContext('2d')!

    const currentTime = now ?? Date.now()

    function draw() {
      ctx.clearRect(0, 0, width, height)
      glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height)

      const scale = 0.5
      glowCtx.setTransform(scale, 0, 0, scale, 0, 0)

      // ── Edges ──
      for (const link of links) {
        const src = nodes.find(n => n.id === link.source)
        const tgt = nodes.find(n => n.id === link.target)
        if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue

        const isSelected = selectedNode &&
          ((link.source as string) === selectedNode.id || (link.target as string) === selectedNode.id)

        const signal = getEdgeSignal(link, nodes, currentTime)

        if (isSelected && selectedNode) {
          // Selected edge: gradient glow
          const grad = ctx.createLinearGradient(src.x, src.y, tgt.x, tgt.y)
          grad.addColorStop(0, TYPE_COLORS[selectedNode.type] + '80')
          grad.addColorStop(1, TYPE_COLORS[selectedNode.type] + '80')
          ctx.strokeStyle = grad
          ctx.lineWidth = 2.5
          ctx.shadowColor = TYPE_COLORS[selectedNode.type]
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.moveTo(src.x, src.y)
          ctx.lineTo(tgt.x, tgt.y)
          ctx.stroke()
          ctx.shadowBlur = 0
        } else if (signal > 0.01) {
          // Signal propagation: amber pulse traveling along edge
          const alpha = signal * 0.8
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`
          ctx.lineWidth = 1 + signal * 2
          ctx.shadowColor = SPIKE_COLOR
          ctx.shadowBlur = signal * 15
          ctx.beginPath()
          ctx.moveTo(src.x, src.y)
          ctx.lineTo(tgt.x, tgt.y)
          ctx.stroke()
          ctx.shadowBlur = 0

          // Dim base edge underneath
          ctx.strokeStyle = 'rgba(39,39,42,0.2)'
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(src.x, src.y)
          ctx.lineTo(tgt.x, tgt.y)
          ctx.stroke()
        } else {
          // Dim resting edge
          ctx.strokeStyle = 'rgba(39,39,42,0.4)'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(src.x, src.y)
          ctx.lineTo(tgt.x, tgt.y)
          ctx.stroke()
        }
      }

      // ── Nodes ──
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue
        const r = nodeRadius(node)
        const color = TYPE_COLORS[node.type] || TYPE_COLORS.default
        const isActive = selectedNode && selectedNode.id === node.id
        const isHover = hoveredNode && hoveredNode.id === node.id
        const isInSelection = selectionSet && selectionSet.has(node.id)
        const isDimmed = selectedNode && !isActive && !isInSelection
          && !links.some(l =>
            ((l.source as string) === selectedNode.id && (l.target as string) === node.id) ||
            ((l.target as string) === selectedNode.id && (l.source as string) === node.id)
          )
        const glow = getNodeGlow(node, currentTime)
        const depth = depthFactor(node)

        // Glow halo (rendered on glow layer)
        if (glow > 0.01 || isActive || isInSelection) {
          const glowR = r * (3 + glow * 3)
          const glowAlpha = Math.max(glow * 0.6, isActive ? 0.4 : 0.2)
          const grad = glowCtx.createRadialGradient(node.x, node.y, r * 0.3, node.x, node.y, glowR)
          grad.addColorStop(0, (glow > 0 ? SPIKE_COLOR : color) + Math.round(glowAlpha * 255).toString(16).padStart(2, '0'))
          grad.addColorStop(1, (glow > 0 ? SPIKE_COLOR : color) + '00')
          glowCtx.fillStyle = grad
          glowCtx.beginPath()
          glowCtx.arc(node.x, node.y, glowR, 0, Math.PI * 2)
          glowCtx.fill()
        }

        // Node circle
        ctx.shadowColor = isActive || isInSelection ? color : 'transparent'
        ctx.shadowBlur = isActive ? 16 : isInSelection ? 8 : 0

        ctx.beginPath()
        ctx.arc(node.x, node.y, r * depth, 0, Math.PI * 2)

        if (isActive) {
          ctx.fillStyle = color
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
        } else if (isInSelection) {
          ctx.fillStyle = color + 'cc'
          ctx.fill()
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.stroke()
        } else if (isHover) {
          ctx.fillStyle = color
          ctx.fill()
        } else if (isDimmed) {
          ctx.fillStyle = color + '25'
          ctx.fill()
        } else {
          // Resting node with depth-based gradient
          const baseColor = color
          const grad = ctx.createRadialGradient(
            node.x - r * 0.3, node.y - r * 0.3, r * 0.1,
            node.x, node.y, r * depth
          )
          grad.addColorStop(0, '#fff')
          grad.addColorStop(0.3, baseColor)
          grad.addColorStop(1, baseColor + 'aa')
          ctx.fillStyle = grad
          ctx.fill()
        }

        ctx.shadowBlur = 0

        // Label
        if (!isDimmed || isActive) {
          const label = node.name.length > 16 ? node.name.slice(0, 14) + '…' : node.name
          ctx.font = '500 11px "Inter", system-ui, sans-serif'
          ctx.fillStyle = isActive || isInSelection ? '#fff' : '#a1a1aa'
          ctx.textAlign = 'center'
          ctx.fillText(label, node.x, node.y + r * depth + 12)
          ctx.textAlign = 'start'
        }
      }

      // ── Composite glow layer onto main canvas ──
      ctx.drawImage(glowCanvas, 0, 0, width, height)

      // ── Stats overlay ──
      ctx.font = '400 10px "JetBrains Mono", monospace'
      ctx.fillStyle = '#52525b'
      ctx.textAlign = 'left'
      const statsText = `${nodes.length} nodes · ${links.length} edges`
      if (hoveredNode) {
        const nameText = hoveredNode.name.length > 24 ? hoveredNode.name.slice(0, 22) + '…' : hoveredNode.name
        ctx.font = '600 12px "Inter", system-ui, sans-serif'
        ctx.fillStyle = TYPE_COLORS[hoveredNode.type] || TYPE_COLORS.default
        ctx.fillText(nameText, 14, 32)
        ctx.font = '400 10px "JetBrains Mono", monospace'
        ctx.fillStyle = '#52525b'
        ctx.fillText(`${hoveredNode.degree || 0} connections · ${hoveredNode.facts?.length || 0} facts`, 14, 48)
      } else {
        ctx.fillText(statsText, 14, 24)
      }

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [nodes, links, width, height, hoveredNode, selectedNode, selectionSet, now])

  // ── Mouse handlers ──
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const HIT_RADIUS = 20
    let closest: GraphNode | null = null
    let closestDist = HIT_RADIUS
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue
      const dx = mousePosRef.current.x - node.x
      const dy = mousePosRef.current.y - node.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const r = nodeRadius(node)
      if (dist < r + 8 && dist < closestDist) {
        closest = node
        closestDist = dist
      }
    }
    onNodeHover?.(closest)
  }, [nodes, onNodeHover])

  const handleMouseLeave = useCallback(() => { onNodeHover?.(null) }, [onNodeHover])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue
      const dx = cx - node.x
      const dy = cy - node.y
      if (Math.sqrt(dx * dx + dy * dy) < nodeRadius(node) + 6) {
        onNodeClick?.(node)
        return
      }
    }
    onNodeClick?.(null as any)
  }, [nodes, onNodeClick])

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-xl">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {!nodes.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm rounded-xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-xs text-zinc-500">Building knowledge graph…</span>
          </div>
        </div>
      )}
    </div>
  )
}
