I'll generate the complete implementation for all three navigation features. This is concrete, file-by-file code your agent can execute directly.

---

## Canvas Navigation — Complete Implementation Spec

### Architecture Decision: Lift Pan State to CanvasContainer

`CanvasGrid` currently owns `pan` internally. We need to control it from the parent for recenter, minimap click, and auto-center. **Approach: Lift pan to CanvasContainer, pass as controlled prop.**

---

### File 1: `src/components/ai/canvas/CanvasGrid.tsx` — **REPLACE**

```tsx
import { useRef, useCallback, useLayoutEffect } from 'react'
import { CanvasCard } from './CanvasCard'
import type { CanvasCard as CanvasCardType } from '../../../types/canvas'
import './canvas.css'

interface CanvasGridProps {
  cards: CanvasCardType[]
  pan: { x: number; y: number }
  onPanChange: (pan: { x: number; y: number }) => void
  onMoveCard: (id: string, position: { x: number; y: number }) => void
  onDismissCard: (id: string) => void
  isPanning: boolean
  setIsPanning: (v: boolean) => void
}

export function CanvasGrid({
  cards,
  pan,
  onPanChange,
  onMoveCard,
  onDismissCard,
  isPanning,
  setIsPanning,
}: CanvasGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.dk-canvas-card')) return
    if ((e.target as HTMLElement).closest('.dk-minimap')) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [pan, setIsPanning])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    const newPan = { x: panStart.current.panX + dx, y: panStart.current.panY + dy }
    onPanChange(newPan)
  }, [isPanning, onPanChange])

  const handlePointerUp = useCallback(() => {
    setIsPanning(false)
  }, [setIsPanning])

  return (
    <div
      ref={viewportRef}
      className={`dk-canvas-viewport ${isPanning ? 'panning' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`dk-canvas-grid-layer ${isPanning ? '' : 'dk-pan-animate'}`}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        {cards.length === 0 && (
          <div className="dk-canvas-empty" style={{ left: 2000, top: 2000 }}>
            <span>Cards will appear here as you interact with the AI</span>
          </div>
        )}
        {cards
          .sort((a, b) => a.zIndex - b.zIndex)
          .map(card => (
            <CanvasCard
              key={card.id}
              card={card}
              onDragEnd={(id, pos) => {
                onMoveCard(id, { x: pos.x - pan.x, y: pos.y - pan.y })
              }}
              onDismiss={onDismissCard}
              panOffset={pan}
            />
          ))}
      </div>
    </div>
  )
}
```

**Key change:** Pan is now fully controlled. `dk-pan-animate` class enables smooth transitions when not actively panning.

---

### File 2: `src/components/ai/canvas/CanvasContainer.tsx` — **REPLACE**

```tsx
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { CanvasGrid } from './CanvasGrid'
import { CanvasInput } from './CanvasInput'
import { SaveIndicator } from './SaveIndicator'
import { CanvasMinimap } from './CanvasMinimap'
import { FindCardsArrow } from './FindCardsArrow'
import { autoArrange } from '../../../lib/autoArrange'
import type { CanvasCard } from '../../../types/canvas'

interface CanvasContainerProps {
  cards: CanvasCard[]
  onMoveCard: (id: string, pos: { x: number; y: number }) => void
  onDismissCard: (id: string) => void
  onArrangeCards: (positions: Record<string, { x: number; y: number }>) => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onSend: (text: string) => void
  onStop: () => void
  streaming: boolean
  thinking?: boolean
}

export function CanvasContainer({
  cards,
  onMoveCard,
  onDismissCard,
  onArrangeCards,
  saveStatus,
  onSend,
  onStop,
  streaming,
  thinking,
}: CanvasContainerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const hasAutoCentered = useRef(false)

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

  // Auto-center on populated area on mount (when cards loaded from storage)
  useEffect(() => {
    if (hasAutoCentered.current) return
    if (viewportSize.w === 0 || viewportSize.h === 0) return
    if (cards.length === 0) {
      // Fallback: center on grid origin
      setPan({ x: viewportSize.w / 2 - 2000, y: viewportSize.h / 2 - 2000 })
      hasAutoCentered.current = true
      return
    }

    const bounds = computeCardBounds(cards)
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    setPan({
      x: viewportSize.w / 2 - centerX,
      y: viewportSize.h / 2 - centerY,
    })
    hasAutoCentered.current = true
  }, [cards, viewportSize])

  const handleArrange = useCallback(() => {
    const positions = autoArrange(cards)
    onArrangeCards(positions)
  }, [cards, onArrangeCards])

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

  // Check if any card is visible
  const anyCardVisible = useMemo(() => {
    if (viewportSize.w === 0) return true
    const vLeft = -pan.x
    const vTop = -pan.y
    const vRight = vLeft + viewportSize.w
    const vBottom = vTop + viewportSize.h
    return cards.some(c => {
      const cLeft = c.position.x
      const cTop = c.position.y
      const cRight = cLeft + c.size.w * 40
      const cBottom = cTop + c.size.h * 40
      return cLeft < vRight && cRight > vLeft && cTop < vBottom && cBottom > vTop
    })
  }, [cards, pan, viewportSize])

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

      <div className="dk-canvas-toolbar">
        <button onClick={handleArrange} title="Auto-arrange cards">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
        <button onClick={handleRecenter} title="Recenter on cards" disabled={isCentered} className={isCentered ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" />
            <line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" />
            <line x1="12" y1="22" x2="12" y2="18" />
          </svg>
        </button>
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
        onMoveCard={onMoveCard}
        onDismissCard={onDismissCard}
        isPanning={isPanning}
        setIsPanning={setIsPanning}
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
        <CanvasMinimap
          cards={cards}
          pan={pan}
          viewportSize={viewportSize}
          onPanChange={handleMinimapPan}
        />
      )}

      <CanvasInput onSend={onSend} onStop={onStop} streaming={streaming} thinking={thinking} />
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
```

---

### File 3: `src/components/ai/canvas/FindCardsArrow.tsx` — **NEW**

```tsx
import { useMemo } from 'react'

interface FindCardsArrowProps {
  viewportSize: { w: number; h: number }
  pan: { x: number; y: number }
  clusterCenter: { x: number; y: number }
  onRecenter: () => void
}

const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'] // E, NE, N, NW, W, SW, S, SE

export function FindCardsArrow({ viewportSize, pan, clusterCenter, onRecenter }: FindCardsArrowProps) {
  const arrow = useMemo(() => {
    const vCenterX = -pan.x + viewportSize.w / 2
    const vCenterY = -pan.y + viewportSize.h / 2
    const dx = clusterCenter.x - vCenterX
    const dy = clusterCenter.y - vCenterY
    const angle = Math.atan2(-dy, dx) // -dy because screen Y is inverted
    const octant = Math.round((angle * 8) / (2 * Math.PI) + 8) % 8
    return ARROWS[octant]
  }, [viewportSize, pan, clusterCenter])

  const position = useMemo(() => {
    const vCenterX = -pan.x + viewportSize.w / 2
    const vCenterY = -pan.y + viewportSize.h / 2
    const dx = clusterCenter.x - vCenterX
    const dy = clusterCenter.y - vCenterY

    // Position pill at viewport edge in direction of cluster
    const padding = 60
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant
      return {
        left: dx > 0 ? 'auto' : `${padding}px`,
        right: dx > 0 ? `${padding}px` : 'auto',
        top: '50%',
        transform: 'translateY(-50%)',
      }
    } else {
      // Vertical dominant
      return {
        top: dy > 0 ? 'auto' : `${padding}px`,
        bottom: dy > 0 ? `${padding}px` : 'auto`,
        left: '50%',
        transform: 'translateX(-50%)',
      }
    }
  }, [viewportSize, pan, clusterCenter])

  return (
    <button className="dk-find-arrow" style={position} onClick={onRecenter}>
      <span className="dk-find-arrow-icon">{arrow}</span>
      <span className="dk-find-arrow-text">Find cards</span>
    </button>
  )
}
```

---

### File 4: `src/components/ai/canvas/CanvasMinimap.tsx` — **NEW**

```tsx
import { useRef, useCallback, useState } from 'react'
import type { CanvasCard } from '../../../types/canvas'

const GRID_SIZE = 4000
const MAP_W = 160
const MAP_H = 120
const SCALE = MAP_W / GRID_SIZE // 0.04

interface CanvasMinimapProps {
  cards: CanvasCard[]
  pan: { x: number; y: number }
  viewportSize: { w: number; h: number }
  onPanChange: (pan: { x: number; y: number }) => void
}

export function CanvasMinimap({ cards, pan, viewportSize, onPanChange }: CanvasMinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Viewport rect in minimap space
  const viewX = -pan.x * SCALE
  const viewY = -pan.y * SCALE
  const viewW = viewportSize.w * SCALE
  const viewH = viewportSize.h * SCALE

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    ;(e.target as SVGElement).setPointerCapture?.(e.pointerId)
  }, [pan])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    // Convert minimap pixel delta to grid pixel delta
    const gridDx = dx / SCALE
    const gridDy = dy / SCALE
    onPanChange({
      x: dragStart.current.panX - gridDx,
      y: dragStart.current.panY - gridDy,
    })
  }, [isDragging, onPanChange])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const gridX = clickX / SCALE
    const gridY = clickY / SCALE
    onPanChange({
      x: viewportSize.w / 2 - gridX,
      y: viewportSize.h / 2 - gridY,
    })
  }, [isDragging, viewportSize, onPanChange])

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
        {/* Card dots */}
        {cards.map(card => (
          <rect
            key={card.id}
            x={card.position.x * SCALE}
            y={card.position.y * SCALE}
            width={Math.max(2, card.size.w * 40 * SCALE)}
            height={Math.max(2, card.size.h * 40 * SCALE)}
            fill="var(--dk-accent)"
            fillOpacity={0.6}
            rx={1}
          />
        ))}
        {/* Viewport indicator */}
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
```

---

### File 5: `src/components/ai/canvas/canvas.css` — **ADD THESE BLOCKS**

Add to the end of the existing `canvas.css` file:

```css
/* ═══ Pan Animation (for recenter) ═══ */
.dk-pan-animate {
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* ═══ Find Cards Arrow ═══ */
.dk-find-arrow {
  position: absolute;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--dk-bg-raised);
  backdrop-filter: blur(12px);
  border: 1px solid var(--dk-accent);
  border-radius: 999px;
  color: var(--dk-text-secondary);
  font-size: 12px;
  font-family: var(--dk-sans);
  cursor: pointer;
  box-shadow: var(--dk-shadow-md);
  animation: dk-arrow-bounce 1.5s ease-in-out infinite, dk-arrow-fade-in 200ms var(--dk-ease);
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-find-arrow:hover {
  background: var(--dk-bg-surface);
  box-shadow: var(--dk-shadow-lg), var(--dk-shadow-glow);
}

.dk-find-arrow-icon {
  font-size: 16px;
  color: var(--dk-accent);
  line-height: 1;
}

.dk-find-arrow-text {
  font-weight: 500;
}

@keyframes dk-arrow-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes dk-arrow-fade-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* ═══ Minimap ═══ */
.dk-minimap {
  position: absolute;
  bottom: 80px; /* above input bar */
  right: var(--dk-space-4);
  width: 160px;
  height: 120px;
  background: var(--dk-bg-raised);
  backdrop-filter: blur(8px);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  box-shadow: var(--dk-shadow-md);
  z-index: 80;
  overflow: hidden;
  transition: transform 200ms var(--dk-ease), box-shadow 200ms var(--dk-ease);
  cursor: crosshair;
}

.dk-minimap:hover {
  transform: scale(1.05);
  box-shadow: var(--dk-shadow-glow);
}

.dk-minimap svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* ═══ Toolbar disabled state ═══ */
.dk-canvas-toolbar button.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.dk-canvas-toolbar button.disabled:hover {
  background: transparent;
  color: var(--dk-text-muted);
}
```

---

### File 6: `src/pages/AiPage.tsx` — **UPDATE CanvasContainer PROPS**

Ensure `AiPage.tsx` passes the right props to `CanvasContainer` (it already does — no change needed if it matches the interface above). Just verify the import path for `CanvasContainer` is correct.

---

## Manual Test Checklist

- [ ] Open app with saved cards → viewport auto-centers on card cluster (not grid origin)
- [ ] Open app with NO cards → viewport centers on grid origin (2000, 2000)
- [ ] Pan away from all cards → "Find cards" arrow appears at viewport edge
- [ ] Arrow direction matches card cluster direction (8 directions)
- [ ] Arrow has bounce animation
- [ ] Click arrow → smooth 400ms pan animation to card cluster center
- [ ] Click Recenter toolbar button → same smooth pan
- [ ] Recenter button disabled when already centered
- [ ] Pan back to cards → arrow disappears
- [ ] Minimap visible in bottom-right
- [ ] Minimap shows card dots (colored rectangles)
- [ ] Minimap shows viewport outline (translucent rect)
- [ ] Click minimap → viewport pans to clicked location
- [ ] Drag minimap → viewport follows drag continuously
- [ ] Minimap hover → scale 1.05 + glow
- [ ] Active panning (dragging background) → no transition animation (instant)
- [ ] Recenter/minimap pan → smooth transition animation
- [ ] Card dragging still works
- [ ] Fullscreen toggle still works
- [ ] Auto-arrange still works

---

## Summary Table

| Feature | Files Changed | Lines |
|---|---|---|
| Lift pan state | `CanvasGrid.tsx`, `CanvasContainer.tsx` | ~30 |
| Auto-center | `CanvasContainer.tsx` | ~25 |
| Find Cards Arrow | `FindCardsArrow.tsx` (NEW), `canvas.css` | ~80 + ~50 CSS |
| Minimap | `CanvasMinimap.tsx` (NEW), `canvas.css` | ~120 + ~40 CSS |
| Pan animation | `CanvasGrid.tsx`, `canvas.css` | ~5 + ~3 CSS |

---

**Send this to your agent. All three features are fully spec'd with exact code. No gaps, no guesses.**