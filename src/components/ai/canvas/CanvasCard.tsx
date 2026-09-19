import { useRef, useState, useCallback, useEffect, Component, type ReactNode, type ErrorInfo } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { CanvasCardFallback } from './CanvasCardFallback'
import { FocusCard } from './cards/FocusCard'
import { PlanCard } from './cards/PlanCard'
import { FinanceCard } from './cards/FinanceCard'
import { DigestCard } from './cards/DigestCard'
import { ReflectCard } from './cards/ReflectCard'
import { ApprovalCard } from './cards/ApprovalCard'
import { AnnotationCard } from './cards/AnnotationCard'
import { ResponseCardContent } from './ResponseCardContent'
import { GroupCard } from './GroupCard'
import { ConnectorsCard } from './ConnectorsCard'
import { WeeklyScheduleCard } from './cards/WeeklyScheduleCard'
import { DeadlineTrackerCard } from './cards/DeadlineTrackerCard'
import { DailyPlannerCard } from './cards/DailyPlannerCard'
import { DynamicCard } from './cards/DynamicCard'
import { AutomationCard } from '../automations/AutomationCard'
import { CardFrame } from './shared/CardFrame'
import type { CanvasCard as CanvasCardType, CanvasGroup } from '../../../types/canvas'
import './cards/cards.css'

const CELL = 40

interface CardContentCtx {
  onUpdateCard?: (id: string, patch: Record<string, any>) => void
  onDismiss?: (id: string) => void
  groups?: Record<string, CanvasGroup>
  onUpdateGroup?: (groupId: string, patch: Partial<Pick<CanvasGroup, 'label' | 'colorId' | 'orientation' | 'ratio'>>) => void
  onUngroup?: (groupId: string, mode: 'restore' | 'scatter') => void
  onRemoveFromGroup?: (cardId: string, newPosition?: { x: number; y: number }) => void
}

function renderCardContent(card: CanvasCardType, ctx: CardContentCtx) {
  switch (card.type) {
    case 'focus': return <FocusCard card={card} goals={card.data?.goals} loading={card.status === 'loading'} />
    case 'plan': return <PlanCard card={card} goals={card.data?.goals} notes={card.data?.notes} loading={card.status === 'loading'} />
    case 'finance': return <FinanceCard card={card} summary={card.data?.summary} loading={card.status === 'loading'} />
    case 'digest': return <DigestCard card={card} topics={card.data?.topics} loading={card.status === 'loading'} error={card.data?.error} />
    case 'approval': return <ApprovalCard card={card} />
    case 'transient': return <div style={{ fontSize: 12, color: '#71717a' }}>{card.data?.text || card.data?.message || 'Transient card'}</div>
    case 'annotation': return <AnnotationCard card={card} />
    case 'response': return <ResponseCardContent content={card.data?.content || ''} isToolOutput={card.data?.isToolOutput} timestamp={card.data?.timestamp} isUserInput={card.data?.isUserInput} aiResponse={card.data?.aiResponse} aiTimestamp={card.data?.aiTimestamp} />
    case 'generated': return <DynamicCard card={card} onDismiss={ctx.onDismiss} />
    case 'group': {
      // Canonical group record lives in state.groups (label/colorId/cardIds);
      // card.data.groupId links the visual card to it. Fall back to data when
      // a group record is missing (e.g. hydrated from an old snapshot).
      const groupId = card.data?.groupId || card.id
      const canonical = ctx.groups?.[groupId]
      const groupObj: CanvasGroup = {
        id: groupId,
        label: canonical?.label || card.data?.label || 'Group',
        colorId: canonical?.colorId || card.data?.colorId || 'violet',
        cardIds: canonical?.cardIds || (card.data?.childCards || []).map((c: any) => c.id),
        position: canonical?.position || card.position,
        size: canonical?.size || card.size,
        createdAt: canonical?.createdAt || card.createdAt,
      }
      return (
        <GroupCard
          group={groupObj}
          cards={(card.data?.childCards || []).map((c: any) => ({
            ...c,
            position: c.position || { x: 0, y: 0 },
            zIndex: 0,
            groupId,
          }))}
          renderChild={(c) => renderCardContent(c, ctx)}
          onUpdateGroup={(patch) => ctx.onUpdateGroup?.(groupId, patch)}
          onUngroup={(mode) => ctx.onUngroup?.(groupId, mode)}
          onRemoveFromGroup={(cid, newPosition) => ctx.onRemoveFromGroup?.(cid, newPosition)}
        />
      )
    }
    case 'connectors': return <ConnectorsCard state={card.data?.state || 'loading'} connectors={card.data?.connectors || []} errorMessage={card.data?.errorMessage} onRetry={card.data?.onRetry} onAdd={card.data?.onAdd} onSync={card.data?.onSync} onRefresh={card.data?.onRefresh} syncing={card.data?.syncing} />
    case 'reflect': return <ReflectCard card={card} days={card.data?.days} loading={card.status === 'loading'} error={card.data?.error} />
    case 'schedule': return <WeeklyScheduleCard weekOffset={card.data?.weekOffset || 0} />
    case 'deadlines': return <DeadlineTrackerCard days={card.data?.days || 14} />
    case 'planner': return <DailyPlannerCard date={card.data?.date} />
    case 'automation': {
      const auto = card.data?.automation
      if (!auto) return <div style={{ fontSize: 12, color: '#52525b' }}>Automation</div>
      return (
        <AutomationCard
          data={auto}
          onEdit={card.data?.onEdit}
          onToggle={card.data?.onToggle}
          onDelete={card.data?.onDelete}
          onTestRun={card.data?.onTestRun}
          onDismiss={() => ctx.onDismiss?.(card.id)}
        />
      )
    }
    default: return <div style={{ fontSize: 12, color: '#52525b' }}>{card.type}</div>
  }
}

interface CanvasCardProps {
  card: CanvasCardType
  onDragEnd: (id: string, position: { x: number; y: number }) => void
  onDismiss: (id: string) => void
  onPin?: (id: string) => void
  onResize?: (id: string, size: { w: number; h: number }) => void
  onDragStart?: () => void
  onDragStop?: () => void
  onClick?: (id: string) => void
  onUpdateCard?: (id: string, patch: Record<string, any>) => void
  groups?: Record<string, CanvasGroup>
  onUpdateGroup?: (groupId: string, patch: Partial<Pick<CanvasGroup, 'label' | 'colorId' | 'orientation' | 'ratio'>>) => void
  onUngroup?: (groupId: string, mode: 'restore' | 'scatter') => void
  onRemoveFromGroup?: (cardId: string, newPosition?: { x: number; y: number }) => void
  zoom?: number
  isFocused?: boolean
  isDropTarget?: boolean
  onDropTarget?: (id: string | null) => void
}

interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class CardErrorBoundary extends Component<{ cardType: string; onRetry: () => void; onDismiss: () => void; children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`[CanvasCard] ${this.props.cardType} crashed:`, error, info.componentStack) }
  render() {
    if (this.state.hasError) return <CanvasCardFallback cardType={this.props.cardType} error={this.state.error?.message || 'Unknown error'} onRetry={() => this.setState({ hasError: false, error: null })} onDismiss={this.props.onDismiss} />
    return this.props.children
  }
}

export function CanvasCard({ card, onDragEnd, onDismiss, onPin, onResize, onDragStart, onDragStop, onClick, onUpdateCard, groups, onUpdateGroup, onUngroup, onRemoveFromGroup, zoom = 1, isFocused, isDropTarget, onDropTarget: _onDropTarget }: CanvasCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null)
  const isDraggingRef = useRef(false)
  const hasMovedRef = useRef(false)
  // A real drag ends with a pointerup that the browser ALSO turns into a click
  // on the same element. Without this flag, that click fires onClick → selects
  // the card → auto-focus pans the camera to the just-dropped card, making the
  // drag look like it "snapped back". Suppress the click after a real drag.
  const suppressClickRef = useRef(false)
  // Presses that land on form controls (input/button/select/link) must not
  // claim the pointer until the user actually drags — otherwise pointer
  // capture would swallow the control's click (dropdowns, toggles, caret).
  const interactiveStartRef = useRef(false)
  const dragEngagedRef = useRef(false)

  // ── Cancel any in-flight drag/resize and restore committed state ──
  const cleanupInteraction = useCallback(() => {
    const wasActive = dragRef.current || resizeRef.current
    const engaged = dragEngagedRef.current
    dragRef.current = null
    resizeRef.current = null
    isDraggingRef.current = false
    hasMovedRef.current = false
    interactiveStartRef.current = false
    dragEngagedRef.current = false
    if (cardRef.current) {
      cardRef.current.classList.remove('dragging')
      cardRef.current.style.zIndex = String(card.zIndex)
      cardRef.current.style.transform = `translate(${card.position.x}px, ${card.position.y}px)`
      cardRef.current.style.width = `${card.size.w * CELL}px`
      cardRef.current.style.height = `${card.size.h * CELL}px`
    }
    if (wasActive && engaged) {
      suppressClickRef.current = true
      onDragStop?.()
    }
  }, [card.zIndex, card.position.x, card.position.y, card.size.w, card.size.h, onDragStop])

  // Cleanup refs for window-level mouse listeners during drag/resize
  const dragCleanupRef = useRef<(() => void) | null>(null)

  // Ensure window listeners are cleaned up on unmount
  useEffect(() => {
    return () => { dragCleanupRef.current?.(); dragCleanupRef.current = null }
  }, [])

  // ── Engage drag: lift card visually and notify grid ──
  const engageDrag = useCallback(() => {
    if (dragEngagedRef.current || !cardRef.current) return
    dragEngagedRef.current = true
    cardRef.current.classList.add('dragging')
    cardRef.current.style.zIndex = '1000'
    const active = document.activeElement
    if (active && (active as HTMLElement).closest && (active as HTMLElement).closest('input, textarea, select')) {
      (active as HTMLElement).blur()
    }
    onDragStart?.()
  }, [onDragStart])

  // ── Mouse-down: start drag or resize, register window move/up ──
  // Uses mousedown instead of pointerdown to bypass third-party libraries
  // (dnd-kit, framer-motion) that intercept pointerdown in capture phase.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    suppressClickRef.current = false
    if ((e.target as HTMLElement).closest('.dk-canvas-resize-handle')) return

    let startX = card.position.x
    let startY = card.position.y
    if (cardRef.current) {
      const computed = getComputedStyle(cardRef.current).transform
      if (computed && computed !== 'none') {
        const m = new DOMMatrix(computed)
        startX = m.m41
        startY = m.m42
      }
    }

    interactiveStartRef.current = !!(e.target as HTMLElement).closest('button, input, textarea, select, a, [role="button"], [onClick]')
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: startX, origY: startY }
    isDraggingRef.current = true
    hasMovedRef.current = false
    if (!interactiveStartRef.current) engageDrag()

    // Window-level listeners replace setPointerCapture: receive move/up even
    // when the cursor leaves the card during a fast drag.
    const onMove = (me: MouseEvent) => {
      if (!dragRef.current || !cardRef.current) return
      const dx = me.clientX - dragRef.current.startX
      const dy = me.clientY - dragRef.current.startY
      if (!dragEngagedRef.current) {
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return
        engageDrag()
        hasMovedRef.current = true
      } else if (!hasMovedRef.current && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        hasMovedRef.current = true
      }
      const newX = dragRef.current.origX + dx / zoom
      const newY = dragRef.current.origY + dy / zoom
      cardRef.current.style.transform = `translate(${newX}px, ${newY}px)`
    }

    const onUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      dragCleanupRef.current = null

      if (!dragRef.current) return
      const engaged = dragEngagedRef.current
      if (engaged && hasMovedRef.current) {
        const dx = (me.clientX - dragRef.current.startX) / zoom
        const dy = (me.clientY - dragRef.current.startY) / zoom
        const rawX = dragRef.current.origX + dx
        const rawY = dragRef.current.origY + dy
        const snappedX = Math.round(rawX / CELL) * CELL
        const snappedY = Math.round(rawY / CELL) * CELL
        if (cardRef.current) {
          cardRef.current.style.transform = `translate(${snappedX}px, ${snappedY}px)`
        }
        onDragEnd(card.id, { x: snappedX, y: snappedY })
        suppressClickRef.current = true
      }
      dragRef.current = null
      isDraggingRef.current = false
      hasMovedRef.current = false
      interactiveStartRef.current = false
      dragEngagedRef.current = false
      if (engaged && cardRef.current) {
        cardRef.current.classList.remove('dragging')
        cardRef.current.style.zIndex = String(card.zIndex)
        onDragStop?.()
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [card.id, card.position.x, card.position.y, card.zIndex, onDragEnd, onDragStop, engageDrag, zoom])

  // ── Resize handle: mousedown starts resize, window move/up commits ──
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: card.size.w, origH: card.size.h }

    const onMove = (me: MouseEvent) => {
      if (!resizeRef.current || !cardRef.current) return
      hasMovedRef.current = true
      const dx = (me.clientX - resizeRef.current.startX) / zoom
      const dy = (me.clientY - resizeRef.current.startY) / zoom
      const newW = Math.max(4, Math.min(20, Math.round((resizeRef.current.origW * CELL + dx) / CELL)))
      const newH = Math.max(4, Math.min(20, Math.round((resizeRef.current.origH * CELL + dy) / CELL)))
      cardRef.current.style.width = `${newW * CELL}px`
      cardRef.current.style.height = `${newH * CELL}px`
    }

    const onUp = (me: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      dragCleanupRef.current = null

      if (!resizeRef.current || !cardRef.current) return
      const dx = (me.clientX - resizeRef.current.startX) / zoom
      const dy = (me.clientY - resizeRef.current.startY) / zoom
      const newW = Math.max(4, Math.min(20, Math.round((resizeRef.current.origW * CELL + dx) / CELL)))
      const newH = Math.max(4, Math.min(20, Math.round((resizeRef.current.origH * CELL + dy) / CELL)))
      resizeRef.current = null
      onResize?.(card.id, { w: newW, h: newH })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [card.id, card.size, onResize, zoom])

  // Safety net: if blur/pointercancel is ever lost (alt-tab, window blur,
  // card unmounted mid-drag), restore the card to its committed state.
  // NOTE: mouseup is NOT included here — the drag's own window mouseup
  // handler commits the position. Including mouseup here would fire
  // cleanupInteraction BEFORE the drag handler (safety net registered first),
  // resetting the transform before commit — the "snap-back" bug.
  useEffect(() => {
    const onWindow = () => {
      if (dragRef.current || resizeRef.current) {
        cleanupInteraction()
        dragCleanupRef.current?.()
        dragCleanupRef.current = null
      }
    }
    window.addEventListener('blur', onWindow)
    return () => {
      window.removeEventListener('blur', onWindow)
    }
  }, [cleanupInteraction])

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // A click that immediately follows a real drag must not select the card —
    // otherwise auto-focus pans the camera away from where the card was dropped.
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    // Only fire if not dragging or resizing
    if (dragRef.current || resizeRef.current) return
    // Don't fire on any interactive element (buttons, inputs, links, etc.)
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a, [role="button"], [onClick]')) return
    // Don't fire on header actions or resize handle
    if ((e.target as HTMLElement).closest('.dk-canvas-card-actions, .dk-canvas-resize-handle')) return
    onClick?.(card.id)
  }, [card.id, onClick])

  const isTransient = !card.pinned && card.source === 'ai'
  const isGroupCard = card.type === 'group'

  // Track whether this card was JUST created (for mount-only animation)
  const [isNew, setIsNew] = useState(true)
  useEffect(() => {
    // Clear the "new" flag after the animation completes so re-renders don't replay it
    const t = setTimeout(() => setIsNew(false), 350)
    return () => clearTimeout(t)
  }, [])

  return (
    <CardErrorBoundary cardType={card.type} onRetry={() => {}} onDismiss={() => onDismiss(card.id)}>
      <div
        ref={cardRef}
        className={`dk-canvas-card ${isTransient ? 'transient' : ''} ${isFocused ? 'focused' : ''} ${isDropTarget ? 'drop-target' : ''} status-${card.status}`}
        data-card-type={card.type}
        data-card-id={card.id}
        data-tutorial="ai.card-types"
        data-new={isNew ? 'true' : undefined}
        style={{
          position: 'absolute', left: 0, top: 0,
          width: card.size.w * CELL, height: card.size.h * CELL,
          transform: `translate(${card.position.x}px, ${card.position.y}px)`,
          zIndex: card.zIndex,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleCardClick}
      >
        <CardFrame
          type={card.type}
          pinned={card.pinned}
          onPin={onPin ? () => onPin(card.id) : undefined}
          onDismiss={isGroupCard ? undefined : () => onDismiss(card.id)}
          hideHeader={card.type === 'response'}
        >
          {renderCardContent(card, { onUpdateCard, onDismiss, groups, onUpdateGroup, onUngroup, onRemoveFromGroup })}
        </CardFrame>
        <div
          className="dk-canvas-resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
      </div>
    </CardErrorBoundary>
  )
}
