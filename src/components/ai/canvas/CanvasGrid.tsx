import { useRef, useCallback, useState, useEffect } from 'react'
import { CanvasCard } from './CanvasCard'
import type { CanvasCard as CanvasCardType, CanvasGroup } from '../../../types/canvas'
import './canvas.css'

interface CanvasGridProps {
  cards: CanvasCardType[]
  pan: { x: number; y: number }
  onPanChange: (pan: { x: number; y: number }) => void
  zoom: number
  onZoomChange: (zoom: number, pan: { x: number; y: number }) => void
  onMoveCard: (id: string, position: { x: number; y: number }) => void
  onDismissCard: (id: string) => void
  onPinCard?: (id: string) => void
  onResizeCard?: (id: string, size: { w: number; h: number }) => void
  onCardClick?: (id: string) => void
  onUpdateCard?: (id: string, patch: Record<string, any>) => void
  groups?: Record<string, CanvasGroup>
  onUpdateGroup?: (groupId: string, patch: Partial<Pick<CanvasGroup, 'label' | 'colorId' | 'orientation' | 'ratio'>>) => void
  onUngroup?: (groupId: string, mode: 'restore' | 'scatter') => void
  onRemoveFromGroup?: (cardId: string, newPosition?: { x: number; y: number }) => void
  isPanning: boolean
  setIsPanning: (v: boolean) => void
  focusedCardId?: string | null
  onGroupCards?: (cardIds: string[]) => void
  onDraggingChange?: (dragging: boolean) => void
}

const MIN_ZOOM = 0.15
const MAX_ZOOM = 3.0
const ZOOM_STEP = 0.08
const CELL = 40

export function CanvasGrid({
  cards, pan, onPanChange, zoom, onZoomChange, onMoveCard, onDismissCard,
  onPinCard, onResizeCard, onCardClick, onUpdateCard, groups, onUpdateGroup, onUngroup, onRemoveFromGroup,
  isPanning, setIsPanning, focusedCardId, onGroupCards, onDraggingChange,
}: CanvasGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const gridLayerRef = useRef<HTMLDivElement>(null)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const draggingCardId = useRef<string | null>(null)
  const dropTargetRef = useRef<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  panRef.current = pan
  zoomRef.current = zoom

  // Refs for cards so the global pointermove handler always reads latest
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  // Global pointermove for drop-target detection — throttled via rAF to avoid
  // running the full card-scan on every sub-frame mouse event.
  useEffect(() => {
    let rafId = 0
    let pending = false
    const handler = (e: PointerEvent) => {
      if (pending) return
      pending = true
      rafId = requestAnimationFrame(() => {
        pending = false
        const draggingId = draggingCardId.current
        if (!draggingId) {
          if (dropTargetRef.current) {
            dropTargetRef.current = null
            setDropTargetId(null)
          }
          return
        }

        const currentCards = cardsRef.current

        // Read the dragged card's visual position from the DOM
        const draggedEl = document.querySelector(`[data-card-id="${draggingId}"]`) as HTMLElement | null
        let dragCX: number, dragCY: number
        let visX = 0, visY = 0
        let draggedCardSize = { w: 4, h: 3 }
        if (draggedEl) {
          const computed = getComputedStyle(draggedEl).transform
          if (computed && computed !== 'none') {
            const m = new DOMMatrix(computed)
            visX = m.m41
            visY = m.m42
          }
          const draggedCard = currentCards.find(c => c.id === draggingId)
          draggedCardSize = { w: draggedCard?.size.w || 4, h: draggedCard?.size.h || 3 }
          dragCX = visX + draggedCardSize.w * CELL / 2
          dragCY = visY + draggedCardSize.h * CELL / 2
        } else {
          draggingCardId.current = null
          dropTargetRef.current = null
          setDropTargetId(null)
          gridLayerRef.current?.removeAttribute('data-card-dragging')
          return
        }

        // Grouping rules:
        // 1. Only non-group cards can be grouped (dragging a group onto a card
        //    does NOT absorb the card).
        // 2. Require >= 30% area overlap to prevent "magnetic" grouping.
        const draggedCard = currentCards.find(c => c.id === draggingId)
        const isDraggedGroup = draggedCard?.type === 'group'
        const dragLeft = visX
        const dragTop = visY
        const dragRight = visX + draggedCardSize.w * CELL
        const dragBottom = visY + draggedCardSize.h * CELL
        const dragArea = (dragRight - dragLeft) * (dragBottom - dragTop)
        const MIN_OVERLAP = 0.3

        const targetCard = currentCards.find(c => {
          if (c.id === draggingId) return false
          if (isDraggedGroup) return false
          if (c.type === 'group') return false
          const tLeft = c.position.x
          const tTop = c.position.y
          const tRight = tLeft + c.size.w * CELL
          const tBottom = tTop + c.size.h * CELL
          const ixLeft = Math.max(dragLeft, tLeft)
          const ixTop = Math.max(dragTop, tTop)
          const ixRight = Math.min(dragRight, tRight)
          const ixBottom = Math.min(dragBottom, tBottom)
          if (ixRight <= ixLeft || ixBottom <= ixTop) return false
          const overlapArea = (ixRight - ixLeft) * (ixBottom - ixTop)
          return overlapArea >= dragArea * MIN_OVERLAP
        })

        const targetId = targetCard?.id || null
        if (targetId !== dropTargetRef.current) {
          dropTargetRef.current = targetId
          setDropTargetId(targetId)
        }
      })
    }

    window.addEventListener('pointermove', handler)
    return () => { window.removeEventListener('pointermove', handler); cancelAnimationFrame(rafId) }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.dk-canvas-card')) return
    if ((e.target as HTMLElement).closest('.dk-minimap')) return
    if ((e.target as HTMLElement).closest('.dk-find-arrow')) return
    setIsPanning(true)
    const p = panRef.current
    panStart.current = { x: e.clientX, y: e.clientY, panX: p.x, panY: p.y }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }, [setIsPanning])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    const newPan = { x: panStart.current.panX + dx, y: panStart.current.panY + dy }
    onPanChange(newPan)
  }, [isPanning, onPanChange])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsPanning(false)
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }, [setIsPanning])

  // Native wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const p = panRef.current
      const z = zoomRef.current
      const gridX = (cursorX - p.x) / z
      const gridY = (cursorY - p.y) / z
      const direction = e.deltaY < 0 ? 1 : -1
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + direction * ZOOM_STEP * z))
      const newPanX = cursorX - gridX * newZoom
      const newPanY = cursorY - gridY * newZoom
      onZoomChange(newZoom, { x: newPanX, y: newPanY })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [onZoomChange])

  const bgStyle = {
    backgroundPosition: `${pan.x}px ${pan.y}px`,
    backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
  }

  const handleCardDragStart = useCallback((cardId: string) => {
    draggingCardId.current = cardId
    onDraggingChange?.(true)
    gridLayerRef.current?.setAttribute('data-card-dragging', 'true')
  }, [onDraggingChange])

  const handleCardDragStop = useCallback((cardId: string) => {
    const targetId = dropTargetRef.current
    if (targetId && targetId !== cardId && onGroupCards) {
      onGroupCards([cardId, targetId])
    }
    draggingCardId.current = null
    dropTargetRef.current = null
    setDropTargetId(null)
    onDraggingChange?.(false)
    gridLayerRef.current?.removeAttribute('data-card-dragging')
  }, [onGroupCards, onDraggingChange])

  const handleDropTarget = useCallback((targetId: string | null) => {
    // Ignore self-targeting
    if (targetId === draggingCardId.current) {
      setDropTargetId(null)
      return
    }
    setDropTargetId(targetId)
  }, [])

  return (
    <div
      ref={viewportRef}
      className={`dk-canvas-viewport ${isPanning ? 'panning' : ''}`}
      style={bgStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        ref={gridLayerRef}
        className="dk-canvas-grid-layer"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {cards.length === 0 && (
          <div className="dk-canvas-empty" style={{ left: 0, top: 0 }}>
            <div className="dk-canvas-empty-inner">
              <div className="dk-canvas-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <div className="dk-canvas-empty-title">Empty canvas</div>
              <div className="dk-canvas-empty-hint">Cards will appear here as you interact with the AI</div>
            </div>
          </div>
        )}
        {cards
          .filter(card => !card.groupId)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map(card => (
          <CanvasCard
            key={card.id}
            card={card}
            onDragEnd={(id, pos) => onMoveCard(id, pos)}
            onDismiss={onDismissCard}
            onPin={onPinCard}
            onResize={onResizeCard}
            onClick={onCardClick}
            onUpdateCard={onUpdateCard}
            groups={groups}
            onUpdateGroup={onUpdateGroup}
            onUngroup={onUngroup}
            onRemoveFromGroup={onRemoveFromGroup}
            onDragStart={() => handleCardDragStart(card.id)}
            onDragStop={() => handleCardDragStop(card.id)}
            zoom={zoom}
            isFocused={card.id === focusedCardId}
            isDropTarget={card.id === dropTargetId}
            onDropTarget={handleDropTarget}
          />
        ))}
      </div>
    </div>
  )
}
