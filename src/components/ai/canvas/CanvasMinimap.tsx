import { useRef, useCallback, useState, useMemo } from 'react'
import type { CanvasCard, CardType } from '../../../types/canvas'

const CARD_TYPE_COLORS: Record<CardType, string> = {
  focus: '#f472b6',
  plan: '#a78bfa',
  reflect: '#c084fc',
  finance: '#34d399',
  digest: '#22d3ee',
  approval: '#fbbf24',
  transient: '#71717a',
  annotation: '#fb923c',
  response: '#60a5fa',
  group: '#818cf8',
  connectors: '#2dd4bf',
  schedule: '#f87171',
  deadlines: '#f97316',
  planner: '#38bdf8',
  generated: '#a78bfa',
  automation: '#34d399',
}

const MAP_W = 160
const MAP_H = 120
const PADDING = 200 // padding around card bounds in grid units

interface CanvasMinimapProps {
  cards: CanvasCard[]
  pan: { x: number; y: number }
  zoom: number
  viewportSize: { w: number; h: number }
  onPanChange: (pan: { x: number; y: number }) => void
}

export function CanvasMinimap({ cards, pan, zoom, viewportSize, onPanChange }: CanvasMinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Dynamically compute minimap bounds from card positions + viewport
  const { domain, scale } = useMemo(() => {
    if (cards.length === 0) {
      // No cards: show viewport centered at origin
      const vw = viewportSize.w / zoom
      const vh = viewportSize.h / zoom
      return {
        domain: { minX: -vw / 2, minY: -vh / 2, maxX: vw / 2, maxY: vh / 2 },
        scale: MAP_W / vw,
      }
    }

    // Bounding box of all cards in grid coordinates
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of cards) {
      minX = Math.min(minX, c.position.x)
      minY = Math.min(minY, c.position.y)
      maxX = Math.max(maxX, c.position.x + c.size.w * 40)
      maxY = Math.max(maxY, c.position.y + c.size.h * 40)
    }

    // Expand by padding
    minX -= PADDING
    minY -= PADDING
    maxX += PADDING
    maxY += PADDING

    // Include viewport in bounds so the viewport rect is always visible
    const vLeft = -pan.x / zoom
    const vTop = -pan.y / zoom
    const vRight = vLeft + viewportSize.w / zoom
    const vBottom = vTop + viewportSize.h / zoom
    minX = Math.min(minX, vLeft)
    minY = Math.min(minY, vTop)
    maxX = Math.max(maxX, vRight)
    maxY = Math.max(maxY, vBottom)

    const domainW = maxX - minX
    const domainH = maxY - minY

    // Maintain aspect ratio — fit into MAP_W × MAP_H
    const scaleX = MAP_W / domainW
    const scaleY = MAP_H / domainH
    const s = Math.min(scaleX, scaleY)

    return {
      domain: { minX, minY, maxX, maxY },
      scale: s,
    }
  }, [cards, pan, zoom, viewportSize])

  // Convert grid coordinates to minimap SVG coordinates
  const toMapX = (gridX: number) => (gridX - domain.minX) * scale
  const toMapY = (gridY: number) => (gridY - domain.minY) * scale

  // Viewport rect in minimap space
  const vLeft = -pan.x / zoom
  const vTop = -pan.y / zoom
  const viewX = toMapX(vLeft)
  const viewY = toMapY(vTop)
  const viewW = (viewportSize.w / zoom) * scale
  const viewH = (viewportSize.h / zoom) * scale

  // Convert minimap coordinates back to grid coordinates
  const toGridX = (mapX: number) => mapX / scale + domain.minX
  const toGridY = (mapY: number) => mapY / scale + domain.minY

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }, [pan])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    // Where is the pointer in SVG space?
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    // Convert to grid coordinates
    const gridX = toGridX(svgX)
    const gridY = toGridY(svgY)
    // Center viewport on this grid point
    onPanChange({
      x: viewportSize.w / 2 - gridX * zoom,
      y: viewportSize.h / 2 - gridY * zoom,
    })
  }, [isDragging, zoom, viewportSize, onPanChange, domain, scale])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    const gridX = toGridX(svgX)
    const gridY = toGridY(svgY)
    onPanChange({
      x: viewportSize.w / 2 - gridX * zoom,
      y: viewportSize.h / 2 - gridY * zoom,
    })
  }, [isDragging, viewportSize, zoom, onPanChange, domain, scale])

  return (
    <div className="dk-minimap">
      <svg
        ref={svgRef}
        width={MAP_W}
        height={MAP_H}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        {cards.map(card => (
          <rect
            key={card.id}
            x={toMapX(card.position.x)}
            y={toMapY(card.position.y)}
            width={Math.max(2, card.size.w * 40 * scale)}
            height={Math.max(2, card.size.h * 40 * scale)}
            fill={CARD_TYPE_COLORS[card.type] || 'var(--dk-accent)'}
            fillOpacity={0.7}
            rx={1}
          />
        ))}
        <rect
          x={viewX}
          y={viewY}
          width={viewW}
          height={viewH}
          fill="none"
          stroke="var(--dk-accent)"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      </svg>
    </div>
  )
}
