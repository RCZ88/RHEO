import { useState, useRef, useEffect, useCallback } from 'react'
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force-3d'
import type { GraphNode, GraphLink } from '../context-graph/types'
import { TYPE_COLORS } from '../context-graph/types'

interface Props {
  nodes: GraphNode[]
  links: GraphLink[]
  width: number
  height: number
  onNodeHover?: (node: GraphNode | null) => void
  onNodeClick?: (node: GraphNode) => void
  hoveredNode?: GraphNode | null
  selectedNode?: GraphNode | null
  selectionSet?: Set<string>
}

export function CanvasGraph(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const frameRef = useRef<number>(0)
  const mousePosRef = useRef({ x: 0, y: 0 })

  const {
    nodes, links, width, height,
    onNodeHover, onNodeClick,
    hoveredNode, selectedNode, selectionSet,
  } = props

  // ── Sync node positions with d3 simulation ──
  useEffect(() => {
    if (!nodes.length) return

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(80)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-120).distanceMax(300))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => nodeRadius(d) + 6))
      .alphaDecay(0.025)
      .velocityDecay(0.35)

    sim.on('tick', () => {
      // positions are written directly into the nodes array by d3
    })

    simulationRef.current = sim

    return () => {
      sim.stop()
      simulationRef.current = null
    }
  }, [nodes.length, links.length]) // re-create sim when data changes

  // ── Resume gentle ambient drift when sim is settled ──
  useEffect(() => {
    if (!nodes.length || !simulationRef.current) return
    const sim = simulationRef.current
    // Reheat slightly every 8s to keep the graph breathing
    const interval = setInterval(() => {
      if (sim.alpha() < 0.02) sim.alpha(0.02).restart()
    }, 8000)
    return () => clearInterval(interval)
  }, [nodes.length])

  // ── Node radius from degree ──
  function nodeRadius(d: GraphNode) {
    return Math.max(4, Math.min(18, 4 + (d.degree || 0) * 1.8))
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
    ctx.scale(dpr, dpr)

    let raf: number
    function draw() {
      ctx.clearRect(0, 0, width, height)

      // ── Edge glow layer ──
      for (const link of links) {
        const src = nodes.find(n => n.id === link.source)
        const tgt = nodes.find(n => n.id === link.target)
        if (!src || !tgt || !src.x || !src.y || !tgt.x || !tgt.y) continue

        const isActive = selectedNode &&
          ((link.source as GraphNode).id === selectedNode.id || (link.target as GraphNode).id === selectedNode.id)

        // Edge position
        const x1 = src.x, y1 = src.y
        const x2 = tgt.x, y2 = tgt.y

        if (isActive) {
          // Selected edge glow
          const grad = ctx.createLinearGradient(x1, y1, x2, y2)
          grad.addColorStop(0, TYPE_COLORS[selectedNode.type] + '80')
          grad.addColorStop(1, TYPE_COLORS[selectedNode.type] + '80')
          ctx.strokeStyle = grad
          ctx.lineWidth = 2.5
          ctx.shadowColor = TYPE_COLORS[selectedNode.type]
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.shadowBlur = 0
        } else {
          // Dim edge
          ctx.strokeStyle = 'rgba(39,39,42,0.4)'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      }

      // ── Node glow layer (behind nodes) ──
      for (const node of nodes) {
        if (!node.x || !node.y) continue
        const r = nodeRadius(node)
        const color = TYPE_COLORS[node.type] || TYPE_COLORS.default
        const isActive = selectedNode && selectedNode.id === node.id
        const isHover = hoveredNode && hoveredNode.id === node.id
        const isInSelection = selectionSet && selectionSet.has(node.id)

        if (isActive || isInSelection) {
          // Glow halo
          const grad = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 4)
          grad.addColorStop(0, color + '60')
          grad.addColorStop(1, color + '00')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(node.x, node.y, r * 4, 0, Math.PI * 2)
          ctx.fill()
        } else if (isHover) {
          // Hover halo
          const grad = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 3)
          grad.addColorStop(0, color + '30')
          grad.addColorStop(1, color + '00')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(node.x, node.y, r * 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Nodes ──
      for (const node of nodes) {
        if (!node.x || !node.y) continue
        const r = nodeRadius(node)
        const color = TYPE_COLORS[node.type] || TYPE_COLORS.default
        const isActive = selectedNode && selectedNode.id === node.id
        const isInSelection = selectionSet && selectionSet.has(node.id)
        const isHover = hoveredNode && hoveredNode.id === node.id
        const isDimmed = selectedNode && !isActive && !isInSelection
          && !links.some(l =>
            ((l.source as GraphNode).id === selectedNode.id && (l.target as GraphNode).id === node.id) ||
            ((l.target as GraphNode).id === selectedNode.id && (l.source as GraphNode).id === node.id)
          )

        // Node circle
        ctx.shadowColor = isActive || isInSelection ? color : 'transparent'
        ctx.shadowBlur = isActive ? 16 : isInSelection ? 8 : 0

        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)

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
          // Active state node
          const baseColor = color
          const grad = ctx.createRadialGradient(
            node.x - r * 0.3, node.y - r * 0.3, r * 0.1,
            node.x, node.y, r
          )
          grad.addColorStop(0, '#fff')
          grad.addColorStop(0.3, baseColor)
          grad.addColorStop(1, baseColor + 'aa')
          ctx.fillStyle = grad
          ctx.fill()
        }

        ctx.shadowBlur = 0

        // ── Label ──
        if (!isDimmed || isActive) {
          const label = node.name.length > 16 ? node.name.slice(0, 14) + '…' : node.name
          ctx.font = '500 11px "Inter", system-ui, sans-serif'
          ctx.fillStyle = isActive || isInSelection ? '#fff' : '#a1a1aa'
          ctx.textAlign = 'center'
          ctx.fillText(label, node.x, node.y + r + 12)
          ctx.textAlign = 'start' // reset
        }
      }

      // ── Stats overlay (top-left) ──
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
      ctx.textAlign = 'start' // reset

      raf = requestAnimationFrame(draw)
      frameRef.current = raf
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [nodes, links, width, height, hoveredNode, selectedNode, selectionSet])

  // ── Mouse move for hover detection ──
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    // Find closest node within hit radius
    const HIT_RADIUS = 20
    let closest: GraphNode | null = null
    let closestDist = HIT_RADIUS
    for (const node of nodes) {
      if (!node.x || !node.y) continue
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

  const handleMouseLeave = useCallback(() => {
    onNodeHover?.(null)
  }, [onNodeHover])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    // Find clicked node
    for (const node of nodes) {
      if (!node.x || !node.y) continue
      const dx = cx - node.x
      const dy = cy - node.y
      if (Math.sqrt(dx * dx + dy * dy) < nodeRadius(node) + 6) {
        onNodeClick?.(node)
        return
      }
    }
    // Click on empty space → deselect
    onNodeClick?.(null as any)
  }, [nodes, onNodeClick])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    for (const node of nodes) {
      if (!node.x || !node.y) continue
      if (Math.sqrt((cx - node.x) ** 2 + (cy - node.y) ** 2) < nodeRadius(node) + 8) {
        e.preventDefault()
        const startX = e.clientX
        const startY = e.clientY
        const nodeStartX = node.x
        const nodeStartY = node.y

        const onMove = (ev: MouseEvent) => {
          const dx = ev.clientX - startX
          const dy = ev.clientY - startY
          node.x = Math.max(20, Math.min(width - 20, nodeStartX + dx))
          node.y = Math.max(20, Math.min(height - 20, nodeStartY + dy))
          if (simulationRef.current) {
            simulationRef.current.alpha(0.01).restart()
          }
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        break
      }
    }
  }, [nodes, width, height])

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
        onMouseDown={handleMouseDown}
      />
      {/* Loading overlay */}
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
