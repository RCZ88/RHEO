import { useEffect, useRef, useState } from "react"
import { Trash2, Sparkles, Shield, ShieldOff } from "lucide-react"
import { MessageBubble } from "./MessageBubble"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { AgentProgressBar, type AgentStep } from "./AgentProgressBar"
import { ChatEmptyState, type ChatSuggestion } from "./ChatEmptyState"
import { ChatInput } from "./ChatInput"
import type { CardAction, ParsedMessage } from "./parsed"
import type { ReactNode } from "react"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp?: string
  parsed?: ParsedMessage
}

export interface ChatPanelProps {
  messages: ChatMessage[]
  streaming?: boolean
  thinking?: boolean
  connecting?: boolean
  agentSteps?: AgentStep[]
  agentStatus?: string
  suggestions?: ChatSuggestion[]
  provider?: string
  online?: boolean
  input?: string
  onInputChange?: (v: string) => void
  onSend: (text: string, images?: string[]) => void
  onStop?: () => void
  onReset?: () => void
  listening?: boolean
  onToggleVoice?: () => void
  voiceSupported?: boolean
  onCardAction?: (a: CardAction) => void
  actionResults?: Record<string, "running" | "done" | "error">
  connectorSyncing?: Record<string, true>
  contextWarnings?: string[]
  dismissError?: (index: number) => void
  onModelChange?: (provider: string, model: string) => void
  historySlot?: ReactNode
  memoryChips?: { id: string; text: string }[]
  onNewThread?: () => void
  onOpenCommands?: () => void
  connectorStatus?: { unreadCount: number; todayEventCount: number; lastSyncTime?: string; syncing?: boolean }
  onExpandConnectors?: () => void
  autoApprove?: boolean
  onToggleAutoApprove?: () => void
}

export function ChatPanel({
  messages,
  streaming,
  thinking,
  connecting,
  agentSteps,
  agentStatus,
  suggestions,
  provider,
  online = true,
  input,
  onInputChange,
  onSend,
  onStop,
  onReset,
  listening,
  onToggleVoice,
  voiceSupported,
  onCardAction,
  actionResults,
  connectorSyncing,
  contextWarnings,
  dismissError,
  onModelChange,
  historySlot,
  memoryChips,
  onNewThread,
  onOpenCommands,
  connectorStatus,
  onExpandConnectors,
  autoApprove = false,
  onToggleAutoApprove,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const lastAssistant = [...messages].reverse().find((mm) => mm.role === "assistant")
  const [empty, setEmpty] = useState(messages.length === 0)

  useEffect(() => {
    setEmpty(messages.length === 0)
  }, [messages.length])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages, thinking, streaming, connecting])

  // Auto-scroll during TypewriterText growth (MutationObserver)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new MutationObserver(() => {
      if (pinnedRef.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="dk-chat-inner">
      {/* History Drawer Overlay */}
      {historySlot}

      <div className="dk-deckhead">
        <div className="dk-t">
          <span className="dk-deck-ic"><Sparkles size={14} /></span>
          DeskFlow Assistant
          <span className="dk-deck-meta">{provider ? "via " + provider : "copilot"}</span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleAutoApprove && (
            <button
              type="button"
              onClick={onToggleAutoApprove}
              title={autoApprove ? "Auto-approve ON — actions execute without confirmation" : "Auto-approve OFF — actions require confirmation"}
              className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[11px] transition-colors"
              style={{
                background: autoApprove ? "rgba(251,191,36,.12)" : "rgba(255,255,255,.04)",
                color: autoApprove ? "#fbbf24" : "var(--tm)",
                border: `1px solid ${autoApprove ? "rgba(251,191,36,.25)" : "var(--line)"}`,
              }}
            >
              {autoApprove ? <Shield size={12} /> : <ShieldOff size={12} />}
              <span style={{ fontFamily: "var(--mono)" }}>{autoApprove ? "Auto" : "Manual"}</span>
            </button>
          )}
          <span className={"dk-chip" + (online ? " dk-live" : "")} style={{ height: 26, fontSize: 11, padding: "0 10px" }}>
            <span className="dk-dot" />
            {online ? "Online" : "Offline"}
          </span>
          {onReset && !empty ? (
            <button
              type="button"
              onClick={onReset}
              aria-label="Clear conversation"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {contextWarnings && contextWarnings.length > 0 && (
        <div className="mx-3 mb-1 space-y-1">
          {contextWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300 ring-1 ring-amber-500/15">
              <span className="flex-1">{w}</span>
              {dismissError && <button className="mt-0.5 text-amber-400 hover:text-amber-200" onClick={() => dismissError(i)}>×</button>}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className={`dk-stream${empty ? " dk-stream--empty" : ""}`}>
        {empty ? (
          <ChatEmptyState suggestions={suggestions} onPick={(p) => onInputChange?.(p)} onNewThread={onNewThread} />
        ) : (
          messages.map((mm) => (
            <MessageBubble
              key={mm.id}
              role={mm.role}
              content={mm.content}
              timestamp={mm.timestamp}
              parsed={mm.parsed}
              onAction={onCardAction}
              actionResults={actionResults}
              connectorSyncing={connectorSyncing}
              streaming={Boolean(streaming) && mm.id === lastAssistant?.id}
              autoApprove={autoApprove}
            />
          ))
        )}
        {thinking ? <ThinkingIndicator variant="thinking" /> : connecting ? <ThinkingIndicator variant="connecting" /> : null}
      </div>

      {/* Memory Chips (NEW) */}
      {memoryChips && memoryChips.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--tm)", fontFamily: "var(--mono)" }}>Memories</span>
          {memoryChips.map((chip) => (
            <span key={chip.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(167,139,250,.10)", border: "1px solid rgba(167,139,250,.16)", color: "var(--violet)", fontFamily: "var(--mono)" }} title={chip.text}>
              {chip.text.length > 28 ? chip.text.slice(0, 28) + "…" : chip.text}
            </span>
          ))}
        </div>
      )}

      <div className="dk-cmdbar">
        <AgentProgressBar
          visible={Boolean(agentSteps?.length) || Boolean(agentStatus)}
          steps={agentSteps}
          statusText={agentStatus}
        />
        <ChatInput
          onSend={onSend}
          onStop={onStop}
          streaming={streaming}
          value={input}
          onChange={onInputChange}
          listening={listening}
          onToggleVoice={onToggleVoice}
          voiceSupported={voiceSupported}
          userPrompts={messages.filter(m => m.role === "user").map(m => m.content)}
          onOpenCommands={onOpenCommands}
        />
      </div>
    </div>
  )
}
