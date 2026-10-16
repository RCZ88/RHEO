import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Loader2, Rows3, Check } from 'lucide-react'
import { VoiceInputWrapper } from '../../../components/VoiceInputWrapper'
import './canvas.css'

interface CanvasInputProps {
  onSend: (text: string) => void
  onStop?: () => void
  streaming?: boolean
  thinking?: boolean
  connecting?: boolean
  onOpenPalette?: () => void
}

/* Composer growth ceilings. `closed` is the default: a single line that does
   NOT grow as you type, so the composer stops covering the canvas. Dragging
   writes a free-form px override that beats every preset until the user picks
   one again or hits Reset. */
/* Heights INCLUDE the textarea's 10px top+bottom padding (see canvas.css):
     one line is 22.5px of text + 20px padding = 42.5px, so `closed` is 46 to
     leave a little slack rather than clipping the line box. Set these below 46
     and the first row gets cut off. */
const GROW_CAPS = { closed: 46, compact: 124, comfortable: 284, full: 560 } as const
type GrowMode = keyof typeof GROW_CAPS
const GROW_MIN = 46
const GROW_MAX = 640
const GROW_LABELS: Record<GrowMode, string> = {
  closed: 'Closed', compact: 'Compact', comfortable: 'Comfortable', full: 'Full',
}
const GROW_KEY = 'ai.canvasComposer.growMode'
const GROW_OVERRIDE_KEY = 'ai.canvasComposer.growPx'

function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeStored(key: string, val: string | null): void {
  try {
    if (val === null) localStorage.removeItem(key)
    else localStorage.setItem(key, val)
  } catch { /* private mode */ }
}

export function CanvasInput({ onSend, onStop, streaming, thinking, connecting, onOpenPalette }: CanvasInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [growMode, setGrowMode] = useState<GrowMode>(() => {
    const v = readStored(GROW_KEY)
    return v && v in GROW_CAPS ? (v as GrowMode) : 'closed'
  })
  const [growOverride, setGrowOverride] = useState<number | null>(() => {
    const v = readStored(GROW_OVERRIDE_KEY)
    const n = v ? parseInt(v, 10) : NaN
    return Number.isFinite(n) ? Math.min(Math.max(n, GROW_MIN), GROW_MAX) : null
  })
  const [dragResizing, setDragResizing] = useState(false)
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false)
  const sizeBtnRef = useRef<HTMLDivElement>(null)

  const cap = growOverride ?? GROW_CAPS[growMode]

  const canSend = text.trim().length > 0 && !streaming

  const handleSubmit = useCallback(() => {
    if (!canSend) return
    onSend(text.trim())
    setText('')
    inputRef.current?.focus()
  }, [text, canSend, onSend])

  /* Height model. `closed` is the only mode that HUGS content: the box grows
     with what you type and never exceeds the cap, so a 10-line paste stays a
     one-line pill with the text scrolling inside. Every other size is a FIXED
     box — you picked a height, so the box is that height and short text leaves
     empty room rather than collapsing the control you just resized.

     This was `Math.min(el.scrollHeight, cap)` for everything, which made every
     non-closed size completely inert: one line of text is ~24px, so dragging
     to 280 still produced 24px and the control looked frozen. */
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const content = el.scrollHeight
    const target = growOverride !== null ? growOverride
      : growMode === 'closed' ? Math.min(content, GROW_CAPS.closed)
      : GROW_CAPS[growMode]
    el.style.height = target + 'px'
    el.style.overflowY = content > target ? 'auto' : 'hidden'
  }, [text, cap, growMode, growOverride])

  /* Drag the top edge to set a free-form ceiling. Pointer capture so the drag
     survives the pointer leaving the handle. */
  const startDragResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startCap = cap
    const el = e.currentTarget
    try { el.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    setDragResizing(true)
    let latest = cap
    const onMove = (ev: PointerEvent) => {
      // dragging DOWN (larger clientY) makes the box TALLER, because the handle
      // sits on the TOP edge of a composer anchored to the bottom of the canvas.
      latest = Math.min(Math.max(startCap + (ev.clientY - startY), GROW_MIN), GROW_MAX)
      setGrowOverride(latest)
    }
    const onUp = () => {
      setDragResizing(false)
      writeStored(GROW_OVERRIDE_KEY, String(latest))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [cap])

  const setMode = useCallback((m: GrowMode) => {
    setGrowMode(m)
    setGrowOverride(null)
    writeStored(GROW_KEY, m)
    writeStored(GROW_OVERRIDE_KEY, null)
  }, [])

  useEffect(() => {
    if (!sizeMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (sizeBtnRef.current && !sizeBtnRef.current.contains(e.target as Node)) setSizeMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSizeMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [sizeMenuOpen])

  /* Global "/" jumps to the composer from anywhere on the canvas, but never
     steals a keystroke from a field you are already typing in. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      const inEditable = !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)
      if (inEditable) return
      if (document.querySelector('[data-dk-modal-open]')) return
      e.preventDefault()
      inputRef.current?.focus()
      setText('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.startsWith('/') && onOpenPalette) {
        onOpenPalette()
        return
      }
      handleSubmit()
    }
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onOpenPalette?.()
    }
  }, [handleSubmit, text, onOpenPalette])

  return (
    <div className="dk-canvas-input-bar" data-dk-composer="canvas">
      <div className="dk-canvas-input-inner" data-cap={cap}>
        {thinking && (
          <div className="dk-canvas-input-thinking">
            <Loader2 size={14} className="animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        {!thinking && connecting && (
          <div className="dk-canvas-input-thinking">
            <Loader2 size={14} className="animate-spin" />
            <span>Connecting to AI...</span>
          </div>
        )}

        {/* drag handle — top edge, because the bar is anchored to the bottom */}
        <div
          onPointerDown={startDragResize}
          title="Drag to change the composer height"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: -1,
            height: 8,
            cursor: 'ns-resize',
            touchAction: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: dragResizing ? 0.9 : 0.3,
            transition: 'opacity 120ms ease-out',
          }}
        >
          <div style={{ width: 34, height: 2, borderRadius: 2, background: 'currentColor', opacity: 0.5 }} />
        </div>

        <VoiceInputWrapper>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, or type / for commands..."
            className="dk-canvas-input"
            rows={1}
            disabled={streaming}
            spellCheck={false}
          />
        </VoiceInputWrapper>

        <div className="dk-canvas-input-actions">
          <div ref={sizeBtnRef} style={{ position: 'relative', display: 'flex' }}>
            <button
              type="button"
              onClick={() => setSizeMenuOpen((v) => !v)}
              className="dk-canvas-input-btn"
              aria-haspopup="menu"
              aria-expanded={sizeMenuOpen}
              title={`Composer size: ${growOverride ? `${growOverride}px (custom)` : GROW_LABELS[growMode]}`}
              style={growOverride ? { color: 'var(--page-accent)' } : undefined}
            >
              <Rows3 size={15} />
            </button>
            {sizeMenuOpen && (
              <div
                role="menu"
                className="dk-composer-size-menu"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: 156,
                  padding: 4,
                  borderRadius: 8,
                  border: '1px solid var(--ws-border, var(--dk-border-default))',
                  background: 'var(--bg-elevated, var(--ws-surface-raised, rgba(11,11,13,0.97)))',
                  color: 'var(--text-primary, var(--dk-text-primary))',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {(Object.keys(GROW_CAPS) as GrowMode[]).map((m) => {
                  const active = growOverride === null && growMode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => { setMode(m); setSizeMenuOpen(false) }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 5,
                        border: 'none',
                        background: active ? 'var(--ws-surface-2, rgba(255,255,255,0.08))' : 'transparent',
                        color: 'var(--text-primary, var(--dk-text-primary))',
                        fontSize: 13,
                        fontFamily: 'var(--dk-sans)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{GROW_LABELS[m]}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted, var(--dk-text-muted))', fontVariantNumeric: 'tabular-nums' }}>
                        {active ? <Check size={12} /> : GROW_CAPS[m]}
                      </span>
                    </button>
                  )
                })}
                {growOverride !== null && (
                  <button
                    type="button"
                    onClick={() => { setMode(growMode); setSizeMenuOpen(false) }}
                    style={{
                      marginTop: 3,
                      padding: '6px 8px',
                      borderRadius: 5,
                      border: '1px solid var(--ws-border, var(--dk-border-default))',
                      background: 'transparent',
                      color: 'var(--page-accent)',
                      fontSize: 12,
                      fontFamily: 'var(--dk-sans)',
                      cursor: 'pointer',
                    }}
                  >
                    Reset to {GROW_LABELS[growMode].toLowerCase()} ({growOverride}px)
                  </button>
                )}
              </div>
            )}
          </div>

          {streaming ? (
            <button onClick={onStop} className="dk-canvas-input-btn stop" title="Stop generating">
              <span className="dk-canvas-stop-icon">■</span>
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canSend} className="dk-canvas-input-btn send" title="Send">
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="dk-canvas-input-hints">
        <span>Ctrl+K commands</span>
        <span>Enter send · Shift+Enter newline</span>
        <span>Drag top edge to resize</span>
      </div>
    </div>
  )
}