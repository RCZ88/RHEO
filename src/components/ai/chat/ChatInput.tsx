import { useEffect, useRef, useState, useCallback } from "react"
import { Mic, Square, Send, Mail, Inbox, Calendar, ClipboardList, RefreshCw, Search, PenLine, Newspaper, Eye, Target, Zap, Paperclip, X, Rows3, Check } from "lucide-react"
import { SlashCommandPalette, type SlashCommand } from "./SlashCommandPalette"
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import { getAllCommands } from "../../../services/customSlashCommands"

export interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: (text: string, images?: string[]) => void
  onStop?: () => void
  streaming?: boolean
  listening?: boolean
  onToggleVoice?: () => void
  voiceSupported?: boolean
  userPrompts?: string[]
  onOpenCommands?: () => void
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: "unread", name: "/unread", desc: "Show unread emails", icon: <Mail size={14} />, category: "email" },
  { id: "inbox", name: "/inbox", desc: "Show recent emails", icon: <Inbox size={14} />, category: "email" },
  { id: "calendar", name: "/calendar", desc: "Show upcoming events", icon: <Calendar size={14} />, category: "calendar" },
  { id: "today", name: "/today", desc: "Today schedule + emails", icon: <ClipboardList size={14} />, category: "combined" },
  { id: "sync", name: "/sync", desc: "Sync all connectors", icon: <RefreshCw size={14} />, category: "action" },
  { id: "email", name: "/email", desc: "Search emails", icon: <Search size={14} />, category: "email" },
  { id: "plan", name: "/plan", desc: "Plan my day", icon: <PenLine size={14} />, category: "ai" },
  { id: "digest", name: "/digest", desc: "Generate digest", icon: <Newspaper size={14} />, category: "ai" },
  { id: "reflect", name: "/reflect", desc: "Reflect on today", icon: <Eye size={14} />, category: "ai" },
  { id: "focus", name: "/focus", desc: "Start focus session", icon: <Target size={14} />, category: "ai" },
]

/** Composer growth ceilings.
 *  `closed` is the default: a single closed line that does NOT grow as you
 *  type, so the composer stops eating the panel. `compact` is the old default
 *  (140) and stays reachable — it used to be the floor for everyone.
 *  Dragging writes a free-form px override that beats every preset until the
 *  user picks one again or hits Reset. */
export const GROW_CAPS = {
  closed: 44,
  compact: 140,
  comfortable: 320,
  full: 640,
} as const
export type GrowMode = keyof typeof GROW_CAPS
export const GROW_MIN = 44
export const GROW_MAX = 720

export const GROW_LABELS: Record<GrowMode, string> = {
  closed: 'Closed',
  compact: 'Compact',
  comfortable: 'Comfortable',
  full: 'Full',
}

const GROW_KEY = 'ai.composer.growMode'
const GROW_OVERRIDE_KEY = 'ai.composer.growPx'

function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeStored(key: string, val: string | null): void {
  try { if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val) } catch { /* private mode */ }
}

export function ChatInput(props: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>(SLASH_COMMANDS)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const historyIndexRef = useRef(-1)
  const draftRef = useRef("")

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

  /** Effective ceiling: a drag override wins over the named mode. */
  const cap = growOverride ?? GROW_CAPS[growMode]

  const setMode = useCallback((m: GrowMode) => {
    setGrowMode(m)
    setGrowOverride(null)
    writeStored(GROW_KEY, m)
    writeStored(GROW_OVERRIDE_KEY, null)
  }, [])

  /* Size picker popover. A drag writes a free-form px override that beats
     every preset, so the button has to admit that state and offer a way out —
     otherwise the presets silently stop working after the first drag. */
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false)
  const sizeBtnRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sizeMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (sizeBtnRef.current && !sizeBtnRef.current.contains(e.target as Node)) setSizeMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSizeMenuOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [sizeMenuOpen])

  // `cap` is a DEPENDENCY, not just props.value: without it a drag resize is
  // immediately overwritten the next time the value changes, and the two fight.
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, cap) + "px"
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden"
  }, [props.value, cap])

  /** Drag the bottom edge to set a free-form ceiling. Pointer capture so the drag
   *  survives the pointer leaving the handle. */
  const startDragResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startCap = cap
    const el = e.currentTarget
    try { el.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    setDragResizing(true)

    // Held outside React state so pointerup persists the FINAL value, not the
    // value at drag start — state updates here are async and batched.
    let latest = cap

    const onMove = (ev: PointerEvent) => {
      // The handle sits on the BOTTOM edge of the composer, so pulling DOWN
      // moves that edge away from the text and makes the box TALLER. This was
      // `startY - ev.clientY`, which inverted it: drag down shrank the box and
      // drag up grew it. Matches the canvas composer's top-edge handle, where
      // `ev.clientY - startY` is equally the natural direction.
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

  const canSend = (props.value.trim().length > 0 || pendingImages.length > 0) && !props.streaming

  const doSend = useCallback(() => {
    const text = props.value.trim()
    if (!text && pendingImages.length === 0) return
    props.onSend(text, pendingImages.length ? pendingImages : undefined)
    setPendingImages([])
  }, [props, pendingImages])

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPendingImages((prev) => [...prev, reader.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }, [])

  /* Global "/" jump-to-composer.
     The palette used to be unreachable unless you were ALREADY focused in the
     textarea and typed "/" — which defeats the point of a shortcut. Now `/`
     works from anywhere on the AI page: it focuses the composer, seeds a "/"
     (which opens the palette through the normal onChange path), and lets the
     user keep typing to filter. Only fires when focus is genuinely elsewhere,
     so it never steals a keystroke you meant for another field. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      // Already typing somewhere (composer, an input, a textarea, contenteditable)?
      // Then "/" is literal text and this shortcut must stay out of the way.
      const inEditable = !!el && (
        el.tagName === "TEXTAREA" ||
        el.tagName === "INPUT" ||
        el.isContentEditable
      )
      if (inEditable) return
      // A modal owns the keyboard while it is open. Chat History binds its own
      // "/" to focus its search box, and two handlers racing for one keystroke
      // is exactly the kind of thing that ends up focusing neither.
      if (document.querySelector("[data-dk-modal-open]")) return
      e.preventDefault()
      taRef.current?.focus()
      props.onChange("/")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [props.onChange])

  const removeImage = useCallback((idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (paletteOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setPaletteIndex(i => (i + 1) % filteredCommands.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setPaletteIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        const cmd = filteredCommands[paletteIndex]
        if (cmd) {
          props.onChange(cmd.name + " ")
          setPaletteOpen(false)
          taRef.current?.focus()
        }
        return
      }
      if (e.key === "Escape") {
        setPaletteOpen(false)
        return
      }
    }

    if (e.key === "ArrowUp" && !props.value.trim()) {
      e.preventDefault()
      const prompts = props.userPrompts || []
      if (prompts.length === 0) return
      if (historyIndexRef.current === -1) {
        draftRef.current = props.value
      }
      const nextIdx = historyIndexRef.current === -1
        ? prompts.length - 1
        : Math.max(0, historyIndexRef.current - 1)
      historyIndexRef.current = nextIdx
      props.onChange(prompts[nextIdx])
      return
    }

    if (e.key === "ArrowDown" && historyIndexRef.current >= 0) {
      e.preventDefault()
      const prompts = props.userPrompts || []
      const nextIdx = historyIndexRef.current + 1
      if (nextIdx >= prompts.length) {
        historyIndexRef.current = -1
        props.onChange(draftRef.current)
      } else {
        historyIndexRef.current = nextIdx
        props.onChange(prompts[nextIdx])
      }
      return
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      historyIndexRef.current = -1
      if (canSend) doSend()
    }
  }, [paletteOpen, filteredCommands, paletteIndex, canSend, doSend, props])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    props.onChange(val)

    if (val.startsWith("/") && !props.streaming) {
      const query = val.slice(1).toLowerCase()
      const builtIn = SLASH_COMMANDS.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.desc.toLowerCase().includes(query)
      )
      const custom = getAllCommands()
        .filter(c => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query))
        .map(c => ({ id: `custom-${c.id}`, name: `/${c.name}`, desc: c.description, icon: <Zap size={14} />, category: "custom" }))
      const filtered = [...builtIn, ...custom]
      setFilteredCommands(filtered.length > 0 ? filtered : SLASH_COMMANDS)
      setPaletteOpen(true)
      setPaletteIndex(0)
    } else {
      setPaletteOpen(false)
    }
  }, [props])

  const handleSelectCommand = useCallback((cmd: SlashCommand) => {
    props.onChange(cmd.name + " ")
    setPaletteOpen(false)
    taRef.current?.focus()
  }, [props])

  return (
    <div style={{ position: "relative" }}>
      {/* Slash Command Palette */}
      {paletteOpen && (
        <SlashCommandPalette
          commands={filteredCommands}
          activeIndex={paletteIndex}
          onSelect={handleSelectCommand}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      <div className="dk-input-wrap">
        {pendingImages.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "6px 8px 0" }}>
            {pendingImages.map((img, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <img
                  src={img}
                  alt="attachment"
                  style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", display: "block" }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="dk-iconbtn"
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, padding: 0, background: "var(--bg-elevated)", color: "var(--red)" }}
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <VoiceInputWrapper>
          <textarea
            ref={taRef}
            className="dk-textarea"
            rows={1}
            value={props.value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, type / for commands..."
            disabled={props.streaming}
            style={{ fontSize: 13, lineHeight: 1.5, fontFamily: 'var(--sans)' }}
          />
        </VoiceInputWrapper>
        <div
          onPointerDown={startDragResize}
          title="Drag to change the composer height"
          style={{
            height: 7,
            marginTop: -1,
            cursor: dragResizing ? 'ns-resize' : 'ns-resize',
            touchAction: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: dragResizing ? 0.9 : 0.35,
            transition: 'opacity 120ms ease-out',
          }}
        >
          <div
            style={{
              width: 34,
              height: 2,
              borderRadius: 2,
              background: 'var(--dk-chip-edge, currentColor)',
              opacity: 0.5,
            }}
          />
        </div>
        <div className="dk-input-tools">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFilePick}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="dk-iconbtn"
            title="Attach image (for vision models)"
          >
            <Paperclip size={14} />
          </button>
          {props.onOpenCommands && (
            <button
              type="button"
              onClick={props.onOpenCommands}
              className="dk-iconbtn"
              title="Manage slash commands"
            >
              <Zap size={14} />
            </button>
          )}
          {/* Composer size — presets + reset, and it admits a drag override */}
          <div ref={sizeBtnRef} style={{ position: "relative", display: "flex" }}>
            <button
              type="button"
              onClick={() => setSizeMenuOpen((v) => !v)}
              className="dk-iconbtn"
              aria-haspopup="menu"
              aria-expanded={sizeMenuOpen}
              title={`Composer size: ${growOverride ? `${growOverride}px (custom)` : GROW_LABELS[growMode]}`}
              style={growOverride ? { color: "var(--cyan)" } : undefined}
            >
              <Rows3 size={14} />
            </button>

            {sizeMenuOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  right: 0,
                  minWidth: 156,
                  padding: 4,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  zIndex: 40,
                  display: "flex",
                  flexDirection: "column",
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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "5px 7px",
                        borderRadius: 5,
                        border: "none",
                        background: active ? "var(--surface-2)" : "transparent",
                        color: "var(--tp)",
                        fontSize: 12,
                        fontFamily: "var(--sans)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <span>{GROW_LABELS[m]}</span>
                      <span style={{ fontSize: 10, color: "var(--tm)", fontVariantNumeric: "tabular-nums" }}>
                        {active ? <Check size={11} /> : `${GROW_CAPS[m]}`}
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
                      padding: "5px 7px",
                      borderRadius: 5,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--cyan)",
                      fontSize: 11,
                      fontFamily: "var(--sans)",
                      cursor: "pointer",
                    }}
                  >
                    Reset to {GROW_LABELS[growMode].toLowerCase()} ({growOverride}px)
                  </button>
                )}
              </div>
            )}
          </div>
          {props.onToggleVoice && (
            <button
              type="button"
              onClick={props.onToggleVoice}
              disabled={!props.voiceSupported}
              className="dk-iconbtn"
              style={props.listening ? { background: "rgba(236,72,153,.15)", color: "var(--pink)", borderColor: "transparent" } : undefined}
              title={props.listening ? "Stop voice input" : "Start voice input"}
            >
              <Mic size={14} />
            </button>
          )}
          {props.streaming ? (
            <button
              type="button"
              onClick={props.onStop}
              className="dk-iconbtn"
              style={{ color: "var(--red)" }}
              title="Stop generating"
            >
              <Square size={12} className="fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => canSend && doSend()}
              disabled={!canSend}
              className="dk-iconbtn dk-send"
              title="Send message"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
