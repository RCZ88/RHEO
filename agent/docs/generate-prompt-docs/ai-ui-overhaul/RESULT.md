I'll generate the complete implementation spec. This is a full UI overhaul — let me make it concrete and executable.

---

## AI Page UI Overhaul — Complete Implementation Spec

### Part 1: Unified Design Token System

**File:** `src/components/ai/design-tokens.css` (NEW)

```css
/* ═══════════════════════════════════════════════════════════════
   UNIFIED DESIGN TOKENS — Canvas + Deck
   Import this at the top of both canvas.css and deck.css
   ═══════════════════════════════════════════════════════════════ */

:root {
  /* Backgrounds */
  --dk-bg-deep: #09090b;
  --dk-bg-base: #111118;
  --dk-bg-surface: rgba(20, 20, 25, 0.92);
  --dk-bg-raised: rgba(30, 30, 35, 0.95);
  --dk-bg-input: rgba(24, 24, 27, 0.9);

  /* Text */
  --dk-text-primary: #f4f4f5;
  --dk-text-secondary: #d4d4d8;
  --dk-text-muted: #a1a1aa;
  --dk-text-faint: #71717a;
  --dk-text-placeholder: #52525b;

  /* Borders */
  --dk-border-subtle: rgba(63, 63, 70, 0.25);
  --dk-border-default: rgba(63, 63, 70, 0.5);
  --dk-border-strong: rgba(63, 63, 70, 0.7);
  --dk-border-focus: rgba(161, 161, 170, 0.4);

  /* Accents — single cyan, use sparingly */
  --dk-accent: #22d3ee;
  --dk-accent-dim: rgba(34, 211, 238, 0.15);
  --dk-success: #4ade80;
  --dk-warning: #fbbf24;
  --dk-danger: #f87171;

  /* Shadows */
  --dk-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --dk-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --dk-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --dk-shadow-glow: 0 0 30px rgba(34, 211, 238, 0.06);

  /* Spacing */
  --dk-space-1: 4px;
  --dk-space-2: 8px;
  --dk-space-3: 12px;
  --dk-space-4: 16px;
  --dk-space-5: 20px;
  --dk-space-6: 24px;

  /* Radius */
  --dk-radius-sm: 6px;
  --dk-radius-md: 10px;
  --dk-radius-lg: 12px;

  /* Grid */
  --dk-cell: 40px;

  /* Animation */
  --dk-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --dk-fast: 150ms;
  --dk-normal: 250ms;
  --dk-slow: 400ms;

  /* Fonts */
  --dk-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --dk-mono: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
}
```

---

### Part 2: Canvas CSS Overhaul

**File:** `src/components/ai/canvas/canvas.css` — **REPLACE ENTIRE FILE**

```css
@import '../design-tokens.css';

/* ═══ Canvas Container ═══ */
.dk-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--dk-bg-base);
  border-radius: var(--dk-radius-lg);
  border: 1px solid var(--dk-border-default);
}

.dk-canvas-container.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  border-radius: 0;
  border: none;
}

/* ═══ Viewport (pannable area) ═══ */
.dk-canvas-viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
}

.dk-canvas-viewport.panning {
  cursor: grabbing;
}

/* ═══ Grid Layer (infinite, transformed) ═══ */
.dk-canvas-grid-layer {
  position: absolute;
  width: 4000px;
  height: 4000px;
  background-color: var(--dk-bg-base);
  background-image:
    linear-gradient(var(--dk-border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--dk-border-subtle) 1px, transparent 1px);
  background-size: var(--dk-cell) var(--dk-cell);
  background-position: 0 0;
  transform-origin: 0 0;
  will-change: transform;
}

/* ═══ Empty State ═══ */
.dk-canvas-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--dk-text-faint);
  font-size: 14px;
  pointer-events: none;
}

/* ═══ Toolbar ═══ */
.dk-canvas-toolbar {
  position: absolute;
  top: var(--dk-space-3);
  right: var(--dk-space-3);
  display: flex;
  gap: var(--dk-space-2);
  z-index: 50;
  background: var(--dk-bg-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  padding: var(--dk-space-2);
  box-shadow: var(--dk-shadow-md);
}

.dk-canvas-toolbar button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--dk-radius-sm);
  background: transparent;
  border: none;
  color: var(--dk-text-muted);
  cursor: pointer;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-canvas-toolbar button:hover {
  background: var(--dk-bg-raised);
  color: var(--dk-text-secondary);
}

.dk-canvas-toolbar button:active {
  transform: scale(0.95);
}

/* ═══ Save Indicator ═══ */
.dk-save-indicator {
  position: absolute;
  top: var(--dk-space-3);
  left: var(--dk-space-3);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--dk-bg-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: var(--dk-text-faint);
  z-index: 50;
  opacity: 0;
  transform: translateY(-8px);
  transition: all var(--dk-fast) var(--dk-ease);
  pointer-events: none;
}

.dk-save-indicator.visible {
  opacity: 1;
  transform: translateY(0);
}

.dk-save-indicator.saving { color: var(--dk-accent); }
.dk-save-indicator.saved { color: var(--dk-success); }
.dk-save-indicator.error { color: var(--dk-danger); }

/* ═══ Cards ═══ */
.dk-canvas-card {
  position: absolute;
  background: var(--dk-bg-surface);
  backdrop-filter: blur(16px);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-lg);
  box-shadow: var(--dk-shadow-sm);
  cursor: grab;
  user-select: none;
  transition: box-shadow var(--dk-fast) var(--dk-ease), border-color var(--dk-fast) var(--dk-ease);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dk-canvas-card:hover {
  border-color: var(--dk-border-strong);
  box-shadow: var(--dk-shadow-md), var(--dk-shadow-glow);
}

.dk-canvas-card.dragging {
  cursor: grabbing;
  border-color: var(--dk-accent);
  box-shadow: var(--dk-shadow-lg), 0 0 40px rgba(34, 211, 238, 0.1);
  z-index: 1000 !important;
}

.dk-canvas-card.pinned::after {
  content: '';
  position: absolute;
  top: 8px;
  right: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dk-accent);
  box-shadow: 0 0 6px var(--dk-accent);
}

.dk-canvas-card.transient {
  opacity: 0.85;
  border-style: dashed;
}

/* ═══ Card Header ═══ */
.dk-canvas-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dk-border-subtle);
  background: var(--dk-bg-raised);
  flex-shrink: 0;
}

.dk-canvas-card-type {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dk-text-faint);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dk-canvas-card-actions {
  display: flex;
  gap: 4px;
}

.dk-canvas-card-actions button {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--dk-radius-sm);
  background: transparent;
  border: none;
  color: var(--dk-text-faint);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-canvas-card-actions button:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--dk-text-secondary);
}

/* ═══ Card Body ═══ */
.dk-canvas-card-body {
  flex: 1;
  padding: 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dk-text-secondary);
  overflow: auto;
  min-height: 0;
}

/* ═══ Card Footer (for approval cards etc) ═══ */
.dk-canvas-card-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--dk-border-subtle);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* ═══ Input Bar ═══ */
.dk-canvas-input-bar {
  position: absolute;
  bottom: var(--dk-space-4);
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  max-width: 90vw;
  z-index: 100;
}

.dk-canvas-input-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--dk-bg-raised);
  backdrop-filter: blur(16px);
  border: 1px solid var(--dk-border-strong);
  border-radius: var(--dk-radius-lg);
  box-shadow: var(--dk-shadow-lg);
  transition: border-color var(--dk-fast) var(--dk-ease), box-shadow var(--dk-fast) var(--dk-ease);
}

.dk-canvas-input-inner:focus-within {
  border-color: var(--dk-accent);
  box-shadow: var(--dk-shadow-lg), 0 0 0 3px var(--dk-accent-dim);
}

.dk-canvas-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--dk-text-primary);
  font-family: var(--dk-sans);
  font-size: 14px;
  line-height: 1.5;
}

.dk-canvas-input::placeholder {
  color: var(--dk-text-placeholder);
}

.dk-canvas-input-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--dk-radius-sm);
  background: transparent;
  border: none;
  color: var(--dk-text-muted);
  cursor: pointer;
  transition: all var(--dk-fast) var(--dk-ease);
  flex-shrink: 0;
}

.dk-canvas-input-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--dk-text-secondary);
}

.dk-canvas-input-btn.send {
  background: var(--dk-accent);
  color: var(--dk-bg-deep);
}

.dk-canvas-input-btn.send:hover {
  background: #67e8f9;
}

.dk-canvas-input-hints {
  display: flex;
  justify-content: center;
  gap: var(--dk-space-4);
  margin-top: var(--dk-space-2);
  font-size: 11px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-canvas-input-hints span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dk-canvas-input-hints kbd {
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  color: var(--dk-text-muted);
}

/* ═══ Transcript Rail (Deck mode only) ═══ */
.dk-transcript-rail {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  max-width: 90vw;
  height: 100vh;
  background: var(--dk-bg-base);
  border-left: 1px solid var(--dk-border-default);
  display: flex;
  flex-direction: column;
  z-index: 200;
  animation: slideIn var(--dk-normal) var(--dk-ease);
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.dk-transcript-rail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--dk-border-default);
  flex-shrink: 0;
}

.dk-transcript-rail-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--dk-text-primary);
}

.dk-transcript-rail-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--dk-radius-sm);
  background: transparent;
  border: none;
  color: var(--dk-text-faint);
  cursor: pointer;
  font-size: 16px;
}

.dk-transcript-rail-close:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--dk-text-secondary);
}

.dk-transcript-rail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ═══ Rail Messages ═══ */
.dk-rail-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dk-rail-msg-user {
  align-items: flex-end;
}

.dk-rail-msg-ai {
  align-items: flex-start;
}

.dk-rail-msg-bubble {
  max-width: 90%;
  padding: 10px 14px;
  border-radius: var(--dk-radius-lg);
  font-size: 13px;
  line-height: 1.6;
}

.dk-rail-msg-user .dk-rail-msg-bubble {
  background: var(--dk-bg-raised);
  color: var(--dk-text-primary);
  border-bottom-right-radius: var(--dk-space-1);
}

.dk-rail-msg-ai .dk-rail-msg-bubble {
  background: var(--dk-bg-surface);
  color: var(--dk-text-secondary);
  border: 1px solid var(--dk-border-default);
  border-bottom-left-radius: var(--dk-space-1);
}

.dk-rail-msg-meta {
  font-size: 10px;
  color: var(--dk-text-faint);
  display: flex;
  gap: 8px;
}

/* ═══ Rail Input ═══ */
.dk-rail-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--dk-border-default);
  flex-shrink: 0;
}

.dk-rail-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.dk-rail-textarea {
  flex: 1;
  background: var(--dk-bg-input);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  padding: 10px 12px;
  color: var(--dk-text-primary);
  font-size: 13px;
  font-family: var(--dk-sans);
  resize: none;
  outline: none;
  min-height: 40px;
  max-height: 120px;
  line-height: 1.5;
}

.dk-rail-textarea:focus {
  border-color: var(--dk-accent);
}

.dk-rail-send {
  width: 36px;
  height: 36px;
  border-radius: var(--dk-radius-md);
  background: var(--dk-accent);
  color: var(--dk-bg-deep);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--dk-fast) var(--dk-ease);
}

.dk-rail-send:hover {
  background: #67e8f9;
}

/* ═══ Error Boundary Fallback ═══ */
.dk-card-error {
  padding: 20px;
  text-align: center;
  color: var(--dk-text-muted);
}

.dk-card-error-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-danger);
  margin-bottom: 8px;
}

.dk-card-error-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}

/* ═══ Animations ═══ */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.dk-canvas-card {
  animation: fadeIn var(--dk-fast) var(--dk-ease);
}

/* ═══ Scrollbars ═══ */
.dk-canvas-card-body::-webkit-scrollbar,
.dk-transcript-rail-body::-webkit-scrollbar {
  width: 4px;
}

.dk-canvas-card-body::-webkit-scrollbar-thumb,
.dk-transcript-rail-body::-webkit-scrollbar-thumb {
  background: var(--dk-border-default);
  border-radius: 2px;
}
```

---

### Part 3: Deck CSS Overhaul

**File:** `src/components/ai/deck/deck.css` — **REPLACE ROOT VARIABLES + KEY SECTIONS**

Keep all existing component CSS but replace the `:root` block and these specific sections:

```css
@import '../design-tokens.css';

/* Override deck-specific tokens on top of unified system */
:root {
  --canvas: var(--dk-bg-deep);
  --surface: var(--dk-bg-surface);
  --surface-2: var(--dk-bg-raised);
  --surface-3: var(--dk-bg-input);
  --raised: var(--dk-bg-raised);
  --line: var(--dk-border-subtle);
  --line-2: var(--dk-border-default);
  --line-3: var(--dk-border-strong);
  --tp: var(--dk-text-primary);
  --ts: var(--dk-text-secondary);
  --tm: var(--dk-text-muted);
  --sans: var(--dk-sans);
  --mono: var(--dk-mono);
  --radius-lg: var(--dk-radius-lg);
}

/* ═══ Input Fix ═══ */
.dk-input-wrap {
  background: var(--surface-2);
  border: 1px solid var(--line-2);  /* was --line (too faint) */
  border-radius: var(--radius-lg);
  padding: 10px 14px;
  transition: border-color var(--dk-fast) var(--dk-ease), box-shadow var(--dk-fast) var(--dk-ease);
}

.dk-input-wrap:focus-within {
  border-color: var(--dk-accent);  /* was var(--zm) — BROKEN */
  box-shadow: 0 0 0 3px var(--dk-accent-dim);
}

.dk-textarea {
  color: var(--tp);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  resize: none;
}

.dk-textarea::placeholder {
  color: var(--dk-text-placeholder);  /* was var(--tm) — too faint */
}

/* ═══ Chat Card — Flex instead of magic height ═══ */
.dk-chat-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  flex: 1;  /* was height: calc(100vh - 200px) */
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ═══ Send Button — Use accent instead of pink ═══ */
.dk-send {
  background: var(--dk-accent);  /* was var(--pink) */
  color: var(--dk-bg-deep);
  border: none;
  border-radius: var(--dk-radius-md);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--dk-fast) var(--dk-ease);
}

.dk-send:hover {
  background: #67e8f9;
}

/* ═══ Wrap — Remove max-width constraint in canvas mode ═══ */
.dk-wrap {
  padding: 20px 32px 32px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ═══ Message bubbles — Better contrast ═══ */
.dk-msg-ai {
  background: var(--dk-bg-surface);
  border: 1px solid var(--dk-border-default);
  color: var(--dk-text-secondary);
  border-radius: var(--dk-radius-lg);
  border-bottom-left-radius: var(--dk-space-1);
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
}

.dk-msg-user {
  background: var(--dk-bg-raised);
  color: var(--dk-text-primary);
  border-radius: var(--dk-radius-lg);
  border-bottom-right-radius: var(--dk-space-1);
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
}
```

---

### Part 4: CanvasGrid Component — Infinite Pan

**File:** `src/components/ai/canvas/CanvasGrid.tsx` — **REPLACE**

```tsx
import { useRef, useState, useCallback, useEffect } from 'react'
import { CanvasCard } from './CanvasCard'
import type { CanvasCard as CanvasCardType } from '../../../types/canvas'
import './canvas.css'

interface CanvasGridProps {
  cards: CanvasCardType[]
  onMoveCard: (id: string, position: { x: number; y: number }) => void
  onDismissCard: (id: string) => void
  onPanChange?: (pan: { x: number; y: number }) => void
  initialPan?: { x: number; y: number }
}

export function CanvasGrid({ cards, onMoveCard, onDismissCard, onPanChange, initialPan }: CanvasGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState(initialPan || { x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Background pan handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only pan if clicking the background (not a card)
    if ((e.target as HTMLElement).closest('.dk-canvas-card')) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [pan])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    const newPan = {
      x: panStart.current.panX + dx,
      y: panStart.current.panY + dy,
    }
    setPan(newPan)
    onPanChange?.(newPan)
  }, [isPanning, onPanChange])

  const handlePointerUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Center the grid initially
  useEffect(() => {
    if (!viewportRef.current || initialPan) return
    const rect = viewportRef.current.getBoundingClientRect()
    setPan({
      x: rect.width / 2 - 2000,  // Center the 4000px grid
      y: rect.height / 2 - 2000,
    })
  }, [initialPan])

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
        className="dk-canvas-grid-layer"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
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
                // Adjust for pan offset when saving position
                onMoveCard(id, {
                  x: pos.x - pan.x,
                  y: pos.y - pan.y,
                })
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

---

### Part 5: CanvasCard — Updated for Pan Offset

**File:** `src/components/ai/canvas/CanvasCard.tsx` — **MODIFY POSITION CALCULATION**

```tsx
interface CanvasCardProps {
  card: CanvasCardType
  onDragEnd: (id: string, position: { x: number; y: number }) => void
  onDismiss: (id: string) => void
  panOffset: { x: number; y: number }  // NEW
}

// In the component, when calculating position:
const style = {
  transform: `translate(${card.position.x + panOffset.x}px, ${card.position.y + panOffset.y}px)`,
  width: card.size.w * CELL,
  height: card.size.h * CELL,
  zIndex: card.zIndex,
}
```

---

### Part 6: Canvas Save Indicator

**File:** `src/components/ai/canvas/SaveIndicator.tsx` (NEW)

```tsx
interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export function SaveIndicator({ status }: SaveIndicatorProps) {
  if (status === 'idle') return null

  const icons = {
    saving: '◌',
    saved: '✓',
    error: '✕',
  }

  const labels = {
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Save failed',
  }

  return (
    <div className={`dk-save-indicator visible ${status}`}>
      <span>{icons[status]}</span>
      <span>{labels[status]}</span>
    </div>
  )
}
```

---

### Part 7: Auto-Arrange Algorithm

**File:** `src/lib/autoArrange.ts` (NEW)

```ts
import type { CanvasCard } from '../types/canvas'

const GAP = 40
const START_X = 2000  // Center of 4000px grid
const START_Y = 2000

export function autoArrange(cards: CanvasCard[]): Record<string, { x: number; y: number }> {
  // Sort by type then by creation time
  const sorted = [...cards].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type)
    return (a.createdAt || 0) - (b.createdAt || 0)
  })

  const positions: Record<string, { x: number; y: number }> = {}
  let currentX = START_X
  let currentY = START_Y
  let rowHeight = 0
  const rowCards: CanvasCard[] = []

  for (const card of sorted) {
    const cardWidth = card.size.w * 40 + GAP
    const cardHeight = card.size.h * 40 + GAP

    // Start new row if this card won't fit (rough heuristic: 800px row width)
    if (rowCards.length > 0 && currentX + cardWidth > START_X + 800) {
      currentX = START_X
      currentY += rowHeight + GAP
      rowHeight = 0
      rowCards.length = 0
    }

    positions[card.id] = { x: currentX, y: currentY }
    currentX += cardWidth
    rowHeight = Math.max(rowHeight, cardHeight)
    rowCards.push(card)
  }

  return positions
}
```

---

### Part 8: Canvas Container + Toolbar + Fullscreen

**File:** `src/components/ai/canvas/CanvasContainer.tsx` (NEW — wraps everything)

```tsx
import { useState, useCallback } from 'react'
import { CanvasGrid } from './CanvasGrid'
import { CanvasInput } from './CanvasInput'
import { SaveIndicator } from './SaveIndicator'
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
}: CanvasContainerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const handleArrange = useCallback(() => {
    const positions = autoArrange(cards)
    onArrangeCards(positions)
  }, [cards, onArrangeCards])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(v => !v)
  }, [])

  return (
    <div className={`dk-canvas-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <SaveIndicator status={saveStatus} />
      
      <div className="dk-canvas-toolbar">
        <button onClick={handleArrange} title="Auto-arrange cards">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>
        <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
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
        onMoveCard={onMoveCard}
        onDismissCard={onDismissCard}
        onPanChange={setPan}
      />

      <CanvasInput
        onSend={onSend}
        onStop={onStop}
        streaming={streaming}
      />
    </div>
  )
}
```

---

### Part 9: useCanvasState — Add Save Status + Arrange

**File:** `src/hooks/useCanvasState.ts` — **ADD TO REDUCER**

```ts
// Add to state:
interface CanvasState {
  // ... existing
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
}

// Add to initialState:
saveStatus: 'idle',

// Add action:
| { type: 'SET_SAVE_STATUS'; status: 'idle' | 'saving' | 'saved' | 'error' }
| { type: 'ARRANGE_CARDS'; positions: Record<string, { x: number; y: number }> }

// In reducer:
case 'SET_SAVE_STATUS':
  return { ...state, saveStatus: action.status }

case 'ARRANGE_CARDS':
  const arrangedCards = { ...state.cards }
  for (const [id, pos] of Object.entries(action.positions)) {
    if (arrangedCards[id]) {
      arrangedCards[id] = { ...arrangedCards[id], position: pos }
    }
  }
  return { ...state, cards: arrangedCards }
```

**In the save effect, add status updates:**

```ts
useEffect(() => {
  const timeout = setTimeout(() => {
    dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' })
    try {
      saveCanvasLayout(state)
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' })
      // Reset to idle after 2 seconds
      setTimeout(() => {
        dispatch({ type: 'SET_SAVE_STATUS', status: 'idle' })
      }, 2000)
    } catch (e) {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'error' })
    }
  }, 500)
  return () => clearTimeout(timeout)
}, [state.cards])
```

---

### Part 10: AiPage.tsx Integration

**File:** `src/pages/AiPage.tsx` — **CANVAS MODE BLOCK**

Replace the canvas mode render block with:

```tsx
{canvasMode ? (
  <CanvasContainer
    cards={canvas.cards}
    onMoveCard={canvas.moveCard}
    onDismissCard={canvas.dismissCard}
    onArrangeCards={(positions) => {
      for (const [id, pos] of Object.entries(positions)) {
        canvas.moveCard(id, pos)
      }
    }}
    saveStatus={canvas.saveStatus}
    onSend={handleSend}
    onStop={chat.stop}
    streaming={chat.streaming}
  />
) : (
  <AiPageDeck ... />
)}
```

**Remove from AiPage.tsx:**
- The `dk-rail-toggle` button and its state
- The `TranscriptRail` from canvas mode (keep it in Deck mode only)
- Any `max-width` constraints on the canvas container

---

### Part 11: Canvas ↔ Deck Sync

**File:** `src/pages/AiPage.tsx` — **SHARED CARD STATE**

Ensure both modes read from the same `useCanvasState` hook. In Deck mode, render canvas cards as a scrollable list or grid below the chat:

```tsx
// In Deck mode, add below the chat card:
<div className="dk-deck-cards">
  <div className="dk-deck-cards-header">
    <span>Cards</span>
    <span>{canvas.cards.length} items</span>
  </div>
  <div className="dk-deck-cards-list">
    {canvas.cards.map(card => (
      <div key={card.id} className="dk-deck-card-item">
        <span className="dk-deck-card-type">{card.type}</span>
        <span className="dk-deck-card-pos">{card.position.x}, {card.position.y}</span>
        <button onClick={() => canvas.dismissCard(card.id)}>×</button>
      </div>
    ))}
  </div>
</div>
```

**CSS for Deck cards list:**

```css
.dk-deck-cards {
  margin-top: 16px;
  background: var(--dk-bg-surface);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-lg);
  padding: 16px;
}

.dk-deck-cards-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
}

.dk-deck-cards-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dk-deck-card-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
}

.dk-deck-card-type {
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--dk-text-faint);
  width: 80px;
}

.dk-deck-card-pos {
  font-family: var(--dk-mono);
  color: var(--dk-text-muted);
  flex: 1;
}
```

---

### Part 12: Dead CSS Cleanup

Remove from `canvas.css`:
- `.dk-rail-toggle` (entire block)
- `.dk-rail-badge` (entire block)
- Duplicate `.dk-transcript-rail` definitions
- Duplicate `.dk-rail` definitions

---

## Summary: Files Changed

| File | Action | Lines |
|---|---|---|
| `src/components/ai/design-tokens.css` | **NEW** | ~80 |
| `src/components/ai/canvas/canvas.css` | **REPLACE** | ~500 |
| `src/components/ai/deck/deck.css` | **EDIT** (root + input + chat-card + send + wrap + msg) | ~50 lines changed |
| `src/components/ai/canvas/CanvasGrid.tsx` | **REPLACE** | ~120 |
| `src/components/ai/canvas/CanvasCard.tsx` | **EDIT** (add panOffset prop) | ~5 lines |
| `src/components/ai/canvas/CanvasContainer.tsx` | **NEW** | ~90 |
| `src/components/ai/canvas/SaveIndicator.tsx` | **NEW** | ~30 |
| `src/components/ai/canvas/CanvasInput.tsx` | **EDIT** (placeholder color, hint visibility) | ~10 lines |
| `src/lib/autoArrange.ts` | **NEW** | ~40 |
| `src/hooks/useCanvasState.ts` | **EDIT** (saveStatus + ARRANGE_CARDS) | ~30 lines |
| `src/pages/AiPage.tsx` | **EDIT** (CanvasContainer, remove rail toggle) | ~40 lines |

---

## Manual Test Checklist

- [ ] Canvas background is `#111118` (visible, not near-black)
- [ ] Card backgrounds are opaque and readable
- [ ] Card borders are visible
- [ ] Card body text is `#d4d4d8` (readable)
- [ ] Input placeholder is `#52525b` (visible)
- [ ] Input hints are visible below the input bar
- [ ] Click fullscreen button → canvas fills entire screen
- [ ] Press F11 → toggles fullscreen
- [ ] Drag canvas background → pans in all directions
- [ ] Cards can be dragged beyond viewport bounds
- [ ] Auto-arrange button → cards animate to organized grid
- [ ] Move a card → "Saving..." appears top-left → "Saved ✓" appears → fades out
- [ ] No floating chat bubble button in canvas mode
- [ ] Deck mode: input border is visible
- [ ] Deck mode: focus ring appears on input focus (cyan glow)
- [ ] Deck mode: chat card uses flex layout (no magic height)
- [ ] Deck mode: AI message text is readable
- [ ] Deck mode: cards list appears below chat
- [ ] Card created in Canvas appears in Deck cards list
- [ ] Card dismissed in Deck disappears from Canvas

---

**Send this entire spec to your agent. It's concrete, file-by-file, with exact CSS values and component code. No guessing needed.**