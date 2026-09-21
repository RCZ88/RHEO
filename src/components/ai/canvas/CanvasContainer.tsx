import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { CanvasGrid } from './CanvasGrid'
import { CanvasInput } from './CanvasInput'
import { SaveIndicator } from './SaveIndicator'
import { CanvasMinimap } from './CanvasMinimap'
import { FindCardsArrow } from './FindCardsArrow'
import { CanvasManagerPanel } from './CanvasManagerPanel'
import { CardDrawer } from './CardDrawer'
import { CustomConfirmDialog } from './CustomConfirmDialog'
import { DefaultSetupDialog } from './DefaultSetupDialog'
import { autoArrange } from '../../../lib/autoArrange'
import { loadCanvasLayout } from '../../../services/canvasPersistence'
import type { CanvasCard, CanvasGroup } from '../../../types/canvas'
import type { CardType } from '../../../types/canvas'
import type { CanvasSnapshot } from '../../../services/canvasPersistence'

const PAN_STORAGE_KEY = 'rheo-canvas-pan-zoom'

export function getSpawnPosition(): { x: number; y: number } {
  const container = document.querySelector('.dk-canvas-container')
  if (!container) return { x: 100, y: 100 }

  const { width, height } = container.getBoundingClientRect()
  const centerX = width / 2 - 160
  const centerY = height / 2 - 100

  const offsetX = (Math.random() - 0.5) * 100
  const offsetY = (Math.random() - 0.5) * 100

  return {
    x: Math.max(0, Math.min(width - 320, centerX + offsetX)),
    y: Math.max(0, Math.min(height - 200, centerY + offsetY))
  }
}

interface CanvasContainerProps {
  cards: CanvasCard[]
  onMoveCard: (id: string, pos: { x: number; y: number }) => void
  onDismissCard: (id: string) => void
  onArrangeCards: (positions: Record<string, { x: number; y: number }>) => void
  onPinCard?: (id: string) => void
  onResizeCard?: (id: string, size: { w: number; h: number }) => void
  onCardClick?: (id: string) => void
  onUpdateCard?: (id: string, patch: Record<string, any>) => void
  groups?: Record<string, CanvasGroup>
  onUpdateGroup?: (groupId: string, patch: Partial<Pick<CanvasGroup, 'label' | 'colorId' | 'orientation' | 'ratio'>>) => void
  onUngroup?: (groupId: string, mode: 'restore' | 'scatter') => void
  onRemoveFromGroup?: (cardId: string, newPosition?: { x: number; y: number }) => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onSaveCanvas?: () => void
  onSend: (text: string) => void
  onStop: () => void
  streaming: boolean
  thinking?: boolean
  connecting?: boolean
  focusedCardId?: string | null
  autoFocus?: boolean
  onToggleAutoFocus?: () => void
  onOpenPalette?: () => void
  onGroupCards?: (cardIds: string[]) => void
  canvasList?: CanvasSnapshot[]
  activeCanvasId?: string | null
  onLoadCanvas?: (id: string) => void
  onRenameCanvas?: (id: string, name: string) => void
  onDeleteCanvas?: (id: string) => void
  onSaveAs?: (name: string) => void
  onSetPanZoom?: (pan: { x: number; y: number }, zoom: number) => void
  onNewCanvas?: () => void
  onAddCard?: (type: CardType) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export function CanvasContainer({
  cards, onMoveCard, onDismissCard, onArrangeCards, onPinCard, onResizeCard, onCardClick, onUpdateCard,
  groups, onUpdateGroup, onUngroup, onRemoveFromGroup,
  saveStatus, onSaveCanvas, onSend, onStop, streaming, thinking, connecting, focusedCardId, autoFocus, onToggleAutoFocus,
  onOpenPalette, onGroupCards,   canvasList, activeCanvasId, onLoadCanvas, onRenameCanvas, onDeleteCanvas, onSaveAs,
  onSetPanZoom, onNewCanvas, onAddCard, onUndo, onRedo, canUndo, canRedo,
}: CanvasContainerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showManager, setShowManager] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [confirmNewCanvas, setConfirmNewCanvas] = useState(false)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [pan, setPan] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(PAN_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
      }
    } catch { /* ignore */ }
    return { x: 0, y: 0 }
  })
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(PAN_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.zoom === 'number') return parsed.zoom
      }
    } catch { /* ignore */ }
    return 1
  })
  const [isPanning, setIsPanning] = useState(false)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const hasAutoCentered = useRef(false)
  const lastCenteredViewport = useRef({ w: 0, h: 0 })

  // Save pan/zoom to localStorage and sync to canvas state on change
  useEffect(() => {
    try {
      localStorage.setItem(PAN_STORAGE_KEY, JSON.stringify({ x: pan.x, y: pan.y, zoom }))
    } catch { /* ignore */ }
    onSetPanZoom?.(pan, zoom)
  }, [pan.x, pan.y, zoom])

  // Measure viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const cr = entries[0].contentRect
      setViewportSize({ w: cr.width, h: cr.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Auto-center on populated area on mount (when cards loaded from storage or
  // freshly seeded). Seeding happens in AiPage's effect, which runs AFTER this
  // child effect, so on the first frame cards may still be empty — wait for
  // them instead of locking the camera to a far-off empty spot (which made a
  // freshly seeded canvas appear blank forever).
  //
  // Viewport size itself can also arrive late: the canvas pane may briefly
  // measure ~0 height while the layout settles, so the first ResizeObserver
  // callback can fire with a collapsed viewport. Re-centering against that
  // collapsed size locks the camera off-screen. So we track the viewport we
  // centered against and re-center whenever it grows meaningfully.
  useEffect(() => {
    if (viewportSize.w === 0 || viewportSize.h === 0) return
    if (cards.length === 0) return

    // Honor a saved pan/zoom only when it actually keeps at least one card on
    // screen. A stale saved pan (e.g. saved while the canvas was empty, or from
    // an earlier buggy session) falls through and re-centers onto the cards.
    const raw = localStorage.getItem(PAN_STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number' && typeof parsed.zoom === 'number') {
          const z = parsed.zoom
          const anyVisible = cards.some(c => {
            const l = c.position.x * z + parsed.x
            const t = c.position.y * z + parsed.y
            const r = l + c.size.w * 40 * z
            const b = t + c.size.h * 40 * z
            return r > 0 && l < viewportSize.w && b > 0 && t < viewportSize.h
          })
          if (anyVisible && (viewportSize.w <= lastCenteredViewport.current.w + 1 && viewportSize.h <= lastCenteredViewport.current.h + 1)) {
            hasAutoCentered.current = true
            return
          }
        }
      } catch { /* fall through to auto-center */ }
    }

    const bounds = computeCardBounds(cards)
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const z = zoom
    setPan({
      x: viewportSize.w / 2 - centerX * z,
      y: viewportSize.h / 2 - centerY * z,
    })
    lastCenteredViewport.current = { w: viewportSize.w, h: viewportSize.h }
    hasAutoCentered.current = true
  }, [cards, viewportSize])

  const handleArrange = useCallback(() => {
    if (cards.length === 0) return
    const positions = autoArrange(cards)
    onArrangeCards(positions)
  }, [cards, onArrangeCards])

  const handleFocus = useCallback(() => {
    if (cards.length === 0) return
    const bounds = computeCardBounds(cards)
    const contentW = bounds.maxX - bounds.minX + 200
    const contentH = bounds.maxY - bounds.minY + 200
    const fitZoom = Math.min(viewportSize.w / contentW, viewportSize.h / contentH, 1.5)
    // Floor raised from 0.3 → 0.6 so "fit" never shrinks cards to specks
    const clampedZoom = Math.max(0.6, Math.min(1.5, fitZoom))
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    setZoom(clampedZoom)
    setPan({
      x: viewportSize.w / 2 - centerX * clampedZoom,
      y: viewportSize.h / 2 - centerY * clampedZoom,
    })
  }, [cards, viewportSize])

  const handleRecenter = useCallback(() => {
    if (cards.length === 0) return
    const bounds = computeCardBounds(cards)
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    setPan({
      x: viewportSize.w / 2 - centerX,
      y: viewportSize.h / 2 - centerY,
    })
  }, [cards, viewportSize])

  const handleMinimapPan = useCallback((newPan: { x: number; y: number }) => {
    setPan(newPan)
  }, [])

  const handleZoomChange = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    setZoom(newZoom)
    setPan(newPan)
  }, [])

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(3.0, zoom * 1.2)
    setZoom(newZoom)
  }, [zoom])

  const handleZoomOut = useCallback(() => {
    // Floor raised from 0.15 → 0.5 so users cannot zoom the canvas into tiny specks
    const newZoom = Math.max(0.5, zoom / 1.2)
    setZoom(newZoom)
  }, [zoom])

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const isMod = e.ctrlKey || e.metaKey
      if (!isMod) return

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo?.()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        onRedo?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onUndo, onRedo])

  // Auto-pan to focused card ONLY when the AI actually updates its content or a
  // different card becomes focused. NEVER fight the user: skip while a card is
  // being dragged (mid-drag re-renders must not shift the camera), and never
  // re-pan when the focused card's position changed without its content changing
  // (that is the user moving it — a pan back would make the drag appear broken).
  const draggingRef = useRef(false)
  const panStateRef = useRef<{ id: string | null; contentKey: string }>({ id: null, contentKey: '' })
  useEffect(() => {
    if (!autoFocus || !focusedCardId || viewportSize.w === 0) return
    if (draggingRef.current) return
    const card = cards.find(c => c.id === focusedCardId)
    if (!card) return

    const contentKey = typeof card.data?.content === 'string' ? card.data.content : ''
    const prev = panStateRef.current
    const contentChanged = prev.id !== focusedCardId || prev.contentKey !== contentKey
    if (!contentChanged) return
    panStateRef.current = { id: focusedCardId, contentKey }

    const cardCenterX = card.position.x + (card.size.w * 40) / 2
    const cardCenterY = card.position.y + (card.size.h * 40) / 2
    setPan({
      x: viewportSize.w / 2 - cardCenterX * zoom,
      y: viewportSize.h / 2 - cardCenterY * zoom,
    })
  }, [focusedCardId, autoFocus, cards, viewportSize, zoom])

  // Persist pan/zoom to localStorage
  const panZoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (panZoomTimer.current) clearTimeout(panZoomTimer.current)
    panZoomTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(PAN_STORAGE_KEY, JSON.stringify({ x: pan.x, y: pan.y, zoom }))
      } catch {}
    }, 300)
    return () => {
      if (panZoomTimer.current) clearTimeout(panZoomTimer.current)
    }
  }, [pan, zoom])

  // Check if any card is visible (accounting for zoom)
  const anyCardVisible = useMemo(() => {
    if (viewportSize.w === 0) return true
    // Viewport bounds in grid coordinates
    const vLeft = -pan.x / zoom
    const vTop = -pan.y / zoom
    const vRight = vLeft + viewportSize.w / zoom
    const vBottom = vTop + viewportSize.h / zoom
    return cards.some(c => {
      const cLeft = c.position.x
      const cTop = c.position.y
      const cRight = cLeft + c.size.w * 40
      const cBottom = cTop + c.size.h * 40
      return cLeft < vRight && cRight > vLeft && cTop < vBottom && cBottom > vTop
    })
  }, [cards, pan, zoom, viewportSize])

  // Compute card cluster center for arrow
  const clusterCenter = useMemo(() => {
    if (cards.length === 0) return null
    const bounds = computeCardBounds(cards)
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    }
  }, [cards])

  const isCentered = useMemo(() => {
    if (cards.length === 0 || !clusterCenter || viewportSize.w === 0) return true
    const targetPan = {
      x: viewportSize.w / 2 - clusterCenter.x,
      y: viewportSize.h / 2 - clusterCenter.y,
    }
    return Math.abs(pan.x - targetPan.x) < 10 && Math.abs(pan.y - targetPan.y) < 10
  }, [cards, clusterCenter, pan, viewportSize])

  return (
    <div ref={containerRef} className={`dk-canvas-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <SaveIndicator status={saveStatus} />

      {showManager && onLoadCanvas && (
        <CanvasManagerPanel
          canvases={canvasList || []}
          activeId={activeCanvasId || null}
          onLoad={(id) => { onLoadCanvas(id); setShowManager(false) }}
          onRename={(id, name) => onRenameCanvas?.(id, name)}
          onDelete={(id) => onDeleteCanvas?.(id)}
          onSave={(name) => { onSaveAs?.(name); setShowManager(false) }}
          onClose={() => setShowManager(false)}
        />
      )}

      <div className="dk-canvas-toolbar" data-tutorial="ai.auto-arrange">
        <button onClick={() => setShowManager(v => !v)} title="Canvas manager — save/load canvases">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button onClick={() => setShowSetup(true)} title="Default canvas setup — choose cards for new canvases"
          style={{ color: 'var(--dk-text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <div className="dk-canvas-toolbar-separator" />
        <button onClick={handleArrange} title="Arrange cards neatly">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x1="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
        <button onClick={() => setShowDrawer(true)} title="Add card to canvas"
          className="text-emerald-400 hover:text-emerald-300"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button onClick={handleFocus} title="Focus — bring camera to cards">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
        <div className="dk-canvas-toolbar-separator" />
        <button onClick={handleZoomOut} title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <span className="dk-canvas-zoom-label">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
        <div className="dk-canvas-toolbar-separator" />
        <button
          onClick={onToggleAutoFocus}
          title={autoFocus ? "Auto-focus: ON — canvas follows AI activity" : "Auto-focus: OFF — manual navigation"}
          style={{ color: autoFocus ? 'var(--dk-accent)' : 'var(--dk-text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
        <div className="dk-canvas-toolbar-separator" />
        <button onClick={onSaveCanvas}
          title="Save canvas layout"
          style={{ color: saveStatus === 'saved' ? 'var(--dk-accent)' : 'var(--dk-text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" />
            <polyline points="7,3 7,8 15,8" />
          </svg>
        </button>
        <div className="dk-canvas-toolbar-separator" />
        <button onClick={onUndo} title="Undo (Ctrl+Z)" disabled={!canUndo}
          style={{ color: canUndo ? 'var(--dk-text-muted)' : 'var(--dk-text-faint)', opacity: canUndo ? 1 : 0.35, cursor: canUndo ? 'pointer' : 'not-allowed' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button onClick={onRedo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}
          style={{ color: canRedo ? 'var(--dk-text-muted)' : 'var(--dk-text-faint)', opacity: canRedo ? 1 : 0.35, cursor: canRedo ? 'pointer' : 'not-allowed' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
          </svg>
        </button>
        <div className="dk-canvas-toolbar-separator" />
        <button onClick={() => setConfirmNewCanvas(true)}
          title="New canvas"
          style={{ color: 'var(--dk-text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <div className="dk-canvas-toolbar-separator" />
        <button onClick={() => setIsFullscreen(v => !v)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      </div>

      <CanvasGrid
        cards={cards}
        pan={pan}
        onPanChange={setPan}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onMoveCard={onMoveCard}
        onDismissCard={onDismissCard}
        onPinCard={onPinCard}
        onResizeCard={onResizeCard}
        onCardClick={onCardClick}
        onUpdateCard={onUpdateCard}
        groups={groups}
        onUpdateGroup={onUpdateGroup}
        onUngroup={onUngroup}
        onRemoveFromGroup={onRemoveFromGroup}
        isPanning={isPanning}
        setIsPanning={setIsPanning}
        focusedCardId={focusedCardId}
        onGroupCards={onGroupCards}
        onDraggingChange={(v) => { draggingRef.current = v }}
      />

      {!anyCardVisible && clusterCenter && viewportSize.w > 0 && (
        <FindCardsArrow
          viewportSize={viewportSize}
          pan={pan}
          clusterCenter={clusterCenter}
          onRecenter={handleRecenter}
        />
      )}

      {viewportSize.w > 0 && (
        <div data-tutorial="ai.minimap">
          <CanvasMinimap
            cards={cards}
            pan={pan}
            zoom={zoom}
            viewportSize={viewportSize}
            onPanChange={handleMinimapPan}
          />
        </div>
      )}

      <div data-tutorial="ai.input">
        <CanvasInput onSend={onSend} onStop={onStop} streaming={streaming} thinking={thinking} connecting={connecting} onOpenPalette={onOpenPalette} />
      </div>

      <CardDrawer
        open={showDrawer}
        onToggle={() => setShowDrawer(false)}
        onAddCard={(type) => { onAddCard?.(type); setShowDrawer(false) }}
      />

      <DefaultSetupDialog open={showSetup} onClose={() => setShowSetup(false)} />

      <CustomConfirmDialog
        open={confirmNewCanvas}
        title="Start New Canvas?"
        message="This will save your current layout as a named canvas, then start with a blank canvas. Your cards are not deleted."
        confirmLabel="New Canvas"
        cancelLabel="Keep Current"
        variant="warning"
        onConfirm={() => { onSaveCanvas?.(); onNewCanvas?.(); setConfirmNewCanvas(false) }}
        onCancel={() => setConfirmNewCanvas(false)}
      />

      {/* Save As Dialog */}
      {showSaveAs && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSaveAs(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed inset-0 z-[210] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-[380px] rounded-2xl border border-zinc-700/50 bg-[rgba(18,18,18,0.98)] backdrop-blur-xl shadow-2xl p-5 light:bg-white light:border-[var(--ws-border-strong)]" onClick={e => e.stopPropagation()}>
              <h3 className="text-[14px] font-semibold text-white mb-1 light:text-stone-900">Save Canvas As</h3>
              <p className="text-[12px] text-zinc-400 mb-4 light:text-stone-500">Create a new canvas with this layout.</p>
              <input
                type="text"
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && saveAsName.trim()) { onSaveAs?.(saveAsName.trim()); setShowSaveAs(false) } }}
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-700/50 text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors mb-4 light:bg-[var(--ws-surface-sunken)] light:text-stone-900 light:placeholder-stone-400 light:border-[var(--ws-border)]"
                placeholder="Canvas name..."
              />
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setShowSaveAs(false)} className="px-4 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors light:text-stone-500 light:hover:bg-stone-100">Cancel</button>
                <button
                  onClick={() => { if (saveAsName.trim()) { onSaveAs?.(saveAsName.trim()); setShowSaveAs(false) } }}
                  disabled={!saveAsName.trim()}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium text-white bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >Save</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}

function computeCardBounds(cards: CanvasCard[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of cards) {
    minX = Math.min(minX, c.position.x)
    minY = Math.min(minY, c.position.y)
    maxX = Math.max(maxX, c.position.x + c.size.w * 40)
    maxY = Math.max(maxY, c.position.y + c.size.h * 40)
  }
  return { minX, minY, maxX, maxY }
}
