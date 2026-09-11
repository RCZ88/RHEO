import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Clock,
  ChevronDown,
  Loader2,
  FolderOpen,
  Sparkles,
  Coins,
  Hash,
} from "lucide-react"
import { cn } from "./lib/cn"
import { MOTION, TEXT, SURFACE, RING } from "./tokens"
import { AISessionMessages } from "./AISessionMessages"

interface AISession {
  id: string
  tool: string
  date: string
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cost_usd: number
  message_count: number
  project_path: string
  created_at: string
}

const AGENT_META: Record<string, { name: string; color: string }> = {
  "claude-code": { name: "Claude Code", color: "#f97316" },
  cursor: { name: "Cursor AI", color: "#a855f7" },
  opencode: { name: "OpenCode", color: "#3b82f6" },
  gemini: { name: "Gemini CLI", color: "#22c55e" },
  codex: { name: "Codex CLI", color: "#10b981" },
  qwen: { name: "Qwen CLI", color: "#f59e0b" },
  aider: { name: "Aider", color: "#f59e0b" },
  kilocode: { name: "KiloCode", color: "#22c55e" },
}

const PAGE_SIZE = 10

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(2)}`
  return `$${n.toFixed(3)}`
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return dateStr
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function truncatePath(p: string): string {
  if (!p) return ""
  const parts = p.replace(/\\/g, "/").split("/")
  if (parts.length <= 3) return parts.join("/")
  return `\u2026/${parts.slice(-2).join("/")}`
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 animate-pulse">
      <div className="h-3 w-16 rounded bg-zinc-800 light:bg-stone-200" />
      <div className="h-3 w-24 rounded bg-zinc-800 light:bg-stone-200" />
      <div className="flex-1" />
      <div className="h-3 w-14 rounded bg-zinc-800 light:bg-stone-200" />
      <div className="h-3 w-12 rounded bg-zinc-800 light:bg-stone-200" />
    </div>
  )
}

export interface AISessionHistoryProps {
  activeToolIds: string[]
  selectedTool?: string
}

export function AISessionHistory({ activeToolIds, selectedTool }: AISessionHistoryProps) {
  const reduce = useReducedMotion()
  const [sessions, setSessions] = useState<AISession[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const prevToolRef = useRef<string>("")
  const prevIdsRef = useRef<string>("")

  const activeTool = selectedTool || activeToolIds[0] || null

  const fetchSessions = useCallback(
    async (tool: string, offset: number) => {
      setLoading(true)
      try {
        const result = await (window as any).deskflowAPI.getAISessionsPaginated(
          tool,
          PAGE_SIZE,
          offset
        )
        if (offset === 0) {
          setSessions(result.sessions)
        } else {
          setSessions((prev) => [...prev, ...result.sessions])
        }
        setTotal(result.total)
        setHasMore(result.hasMore)
      } catch {
        // keep previous state
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Reset and fetch when tool changes
  useEffect(() => {
    if (!activeTool) return
    if (activeTool === prevToolRef.current) return
    prevToolRef.current = activeTool
    setSessions([])
    setTotal(0)
    setHasMore(false)
    fetchSessions(activeTool, 0)
  }, [activeTool, fetchSessions])

  // Reset when activeToolIds changes (new sync)
  useEffect(() => {
    const idsKey = activeToolIds.join(",")
    if (idsKey === prevIdsRef.current) return
    prevIdsRef.current = idsKey
    if (activeTool) {
      prevToolRef.current = "" // force re-fetch
      fetchSessions(activeTool, 0)
    }
  }, [activeToolIds, activeTool, fetchSessions])

  if (activeToolIds.length === 0 || !activeTool) return null

  const meta = AGENT_META[activeTool] || { name: activeTool, color: "#a1a1aa" }
  const isEmpty = !loading && sessions.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION.normal,
        ease: MOTION.ease,
      }}
      className={cn(
        "rounded-xl border border-zinc-800/60 overflow-hidden",
        SURFACE.card,
        "light:border-[var(--ws-border)] light:bg-[var(--color-card)]"
      )}
    >
      {/* Tool header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/40 light:border-[var(--ws-border)]">
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-[13px] font-medium text-zinc-100 light:text-stone-800">
            {meta.name}
          </span>
          <span className="text-[11px] text-zinc-600 tabular-nums light:text-stone-500">
            {total} session{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Content */}
      <div>
        {loading && sessions.length === 0 ? (
          <div className="divide-y divide-zinc-800/40">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : isEmpty ? (
          <EmptyToolState tool={activeTool} />
        ) : (
          <>
            <div className="divide-y divide-zinc-800/40 light:divide-[var(--ws-border)]">
              <AnimatePresence initial={false}>
                {sessions.map((session, sIdx) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    color={meta.color}
                    index={sIdx}
                    reduce={reduce}
                    tool={activeTool}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            <div className="px-5 py-3 flex justify-center border-t border-zinc-800/30 light:border-[var(--ws-border)]">
              {loading ? (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 light:text-stone-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading...
                </div>
              ) : hasMore ? (
                <button
                  type="button"
                  onClick={() => fetchSessions(activeTool, sessions.length)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150",
                    "bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-200 light:hover:bg-stone-200 light:hover:text-stone-800 light:text-stone-500",
                    "ring-1 ring-zinc-700/60",
                    RING.focus
                  )}
                >
                  Load More
                </button>
              ) : (
                <span className="text-[10px] text-zinc-700 light:text-stone-500">
                  All {total} sessions shown
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

function SessionRow({
  session,
  color,
  index,
  reduce,
  tool,
}: {
  session: AISession
  color: string
  index: number
  reduce: boolean
  tool: string
}) {
  const [expanded, setExpanded] = useState(false)
  const totalTokens = session.input_tokens + session.output_tokens

  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: MOTION.fast,
        ease: MOTION.ease,
        delay: index * 0.03,
      }}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 group cursor-pointer",
          "hover:bg-zinc-800/20 light:hover:bg-stone-100",
          expanded && "bg-zinc-800/10 light:bg-stone-100"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand icon */}
        <div className="w-4 flex-shrink-0">
          <ChevronDown
            className={cn(
              "w-3 h-3 text-zinc-600 light:text-stone-500 transition-transform duration-150",
              expanded && "rotate-180"
            )}
          />
        </div>
      {/* Time */}
      <div className="flex items-center gap-1.5 min-w-[64px]">
        <Clock className="w-3 h-3 text-zinc-700 light:text-stone-500 shrink-0" />
        <span
          className="text-[11px] text-zinc-500 tabular-nums light:text-stone-500"
          title={formatFullDate(session.created_at || session.date)}
        >
          {formatTime(session.created_at || session.date)}
        </span>
      </div>

      {/* Model badge */}
      {session.model && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[140px]"
          style={{
            backgroundColor: color + "12",
            color: color,
            border: `1px solid ${color}20`,
          }}
        >
          {session.model}
        </span>
      )}

      {/* Project path */}
      {session.project_path && (
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <FolderOpen className="w-3 h-3 text-zinc-700 light:text-stone-500 shrink-0" />
          <span className="text-[11px] text-zinc-600 truncate light:text-stone-500">
            {truncatePath(session.project_path)}
          </span>
        </div>
      )}

      {!session.project_path && <span className="flex-1" />}

      {/* Tokens */}
      <div className="flex items-center gap-1 tabular-nums">
        <Hash className="w-3 h-3 text-zinc-700 light:text-stone-500" />
        <span className="text-[11px] text-zinc-400 font-medium light:text-stone-400">
          {formatTokenCount(totalTokens)}
        </span>
        <span className="text-[10px] text-zinc-700 light:text-stone-500">tok</span>
      </div>

      {/* Cost */}
      {session.cost_usd > 0 && (
        <div className="flex items-center gap-1 tabular-nums min-w-[52px] justify-end">
          <Coins className="w-3 h-3 text-zinc-700 light:text-stone-500" />
          <span className="text-[11px] text-emerald-400/80 font-medium">
            {formatCost(session.cost_usd)}
          </span>
        </div>
      )}
      </div>
      {expanded && (
        <AISessionMessages sessionId={session.id} tool={tool} color={color} />
      )}
    </motion.div>
  )
}

function EmptyToolState({ tool }: { tool: string }) {
  const meta = AGENT_META[tool]
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900/60 text-zinc-600 ring-1 ring-zinc-800/50 light:bg-stone-200 light:text-stone-500 light:ring-stone-300">
        <Sparkles className="w-4 h-4" />
      </span>
      <p className={cn("text-[13px] font-medium", TEXT.secondary)}>
        No sessions found for {meta?.name || tool}
      </p>
      <p className={cn("text-[11px]", TEXT.muted)}>
        Run Sync AI to import your usage data
      </p>
    </div>
  )
}
