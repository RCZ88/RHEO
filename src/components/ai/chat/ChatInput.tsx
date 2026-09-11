import { useEffect, useRef, useState, useCallback } from "react"
import { Mic, Square, Send, Mail, Inbox, Calendar, ClipboardList, RefreshCw, Search, PenLine, Newspaper, Eye, Target, Zap, Paperclip, X } from "lucide-react"
import { SlashCommandPalette } from "./SlashCommandPalette"
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

const SLASH_COMMANDS = [
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

export function ChatInput(props: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const historyIndexRef = useRef(-1)
  const draftRef = useRef("")

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 140) + "px"
  }, [props.value])

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

  const handleSelectCommand = useCallback((cmd: typeof SLASH_COMMANDS[0]) => {
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
          />
        </VoiceInputWrapper>
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
