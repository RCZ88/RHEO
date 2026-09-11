import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ChevronRight,
  User,
  Bot,
  Loader2,
  MessageSquare,
  Hash,
} from "lucide-react"
import { cn } from "./lib/cn"

interface AIMessage {
  role: string
  content: string
  model?: string
  tokens?: number
  timestamp?: string
  index: number
}

interface AISessionMessagesProps {
  sessionId: string
  tool: string
  color: string
}

const ROLE_STYLES: Record<string, { bg: string; border: string; icon: typeof User; label: string; iconColor: string }> = {
  user: {
    bg: "bg-blue-500/5",
    border: "border-blue-500/15",
    icon: User,
    label: "You",
    iconColor: "text-blue-400",
  },
  assistant: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/15",
    icon: Bot,
    label: "Assistant",
    iconColor: "text-emerald-400",
  },
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function truncateText(text: string, max: number): { display: string; truncated: boolean } {
  if (text.length <= max) return { display: text, truncated: false }
  return { display: text.slice(0, max) + "...", truncated: true }
}

export function AISessionMessages({ sessionId, tool, color }: AISessionMessagesProps) {
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!expanded || fetched) return
    setLoading(true)
    ;(window as any).deskflowAPI?.getAISessionMessages?.(sessionId, tool)
      ?.then((result: any) => {
        if (result?.success && result.data) {
          setMessages(result.data)
        }
        setFetched(true)
      })
      ?.catch(() => setFetched(true))
      ?.finally(() => setLoading(false))
  }, [expanded, fetched, sessionId, tool])

  return (
    <div className="border-t border-zinc-800/30 light:border-[var(--ws-border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-5 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20 light:hover:bg-stone-100 transition-colors duration-150"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <MessageSquare className="w-3 h-3" />
        <span>View Messages</span>
        {messages.length > 0 && (
          <span className="text-zinc-600 light:text-stone-500">({messages.length})</span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500 light:text-stone-500" />
                  <span className="text-[11px] text-zinc-500 light:text-stone-500">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-4">
                  <span className="text-[11px] text-zinc-600 light:text-stone-500">No messages found in source files</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const style = ROLE_STYLES[msg.role] || ROLE_STYLES.assistant
                  const Icon = style.icon
                  const { display, truncated } = truncateText(msg.content, 500)
                  return (
                    <div
                      key={msg.index}
                      className={cn(
                        "rounded-lg border p-3 text-[11px] leading-relaxed",
                        style.bg,
                        style.border
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className={cn("w-3 h-3", style.iconColor)} />
                        <span className={cn("font-medium", style.iconColor)}>
                          {style.label}
                        </span>
                        {msg.model && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                            style={{
                              backgroundColor: color + "15",
                              color: color,
                            }}
                          >
                            {msg.model}
                          </span>
                        )}
                        {msg.tokens ? (
                          <span className="flex items-center gap-0.5 text-zinc-600 light:text-stone-500">
                            <Hash className="w-2.5 h-2.5" />
                            {formatTokens(msg.tokens)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-zinc-300 light:text-stone-700 whitespace-pre-wrap break-words font-mono text-[10px] leading-[1.6]">
                        {display}
                        {truncated && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              // Re-render with full text by replacing content
                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.index === msg.index
                                    ? { ...m, content: m.content }
                                    : m
                                )
                              )
                            }}
                            className="ml-1 text-zinc-500 hover:text-zinc-300 light:text-stone-500 underline"
                          >
                            show all
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
