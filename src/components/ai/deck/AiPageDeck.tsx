import "./deck.css"
import { ChatPanel } from "../chat/ChatPanel"
import type { AgentStep } from "../chat/AgentProgressBar"
import type { ChatSuggestion } from "../chat/ChatEmptyState"
import type { ChatMessage } from "../chat/ChatPanel"
import type { CardAction } from "../chat/parsed"
import type { ReactNode } from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import {
  Newspaper, Plug, Target, Calendar, RefreshCw, ChevronDown,
  Inbox, Maximize2, Minimize2, X, Clock, AlertTriangle,
  Plus, Sparkles, ListTodo, BookOpen, Zap
} from "lucide-react"
import type { AccentKey } from "../tokens"
import { motion, AnimatePresence } from "framer-motion"

export interface DeckProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: (text: string) => void
  onStop?: () => void
  onReset?: () => void
  onCardAction?: (a: CardAction) => void
  streaming?: boolean
  thinking?: boolean
  connecting?: boolean
  provider?: string
  online?: boolean
  suggestions?: ChatSuggestion[]
  agentSteps?: AgentStep[]
  agentStatus?: string
  listening?: boolean
  onToggleVoice?: () => void
  voiceSupported?: boolean
  onOpenCommands?: () => void
  actionResults?: Record<string, "running" | "done" | "error">
  connectorSyncing?: Record<string, true>
  contextWarnings?: string[]
  dismissError?: (index: number) => void
  onModelChange?: (provider: string, model: string) => void
  modeLabel?: string
  glanceMetrics?: { label: string; value: string }[]
  connectorsSlot?: ReactNode
  focusSlot?: ReactNode
  planSlot?: ReactNode
  reflectSlot?: ReactNode
  digestSlot?: ReactNode
  historySlot?: ReactNode
  dailyPlannerSlot?: ReactNode
  scheduleSlot?: ReactNode
  deadlineSlot?: ReactNode
  automationsSlot?: ReactNode
  memoryChips?: { id: string; text: string }[]
  onNewThread?: () => void
  connectorStatus?: { unreadCount: number; todayEventCount: number; lastSyncTime?: string; syncing?: boolean }
  onExpandConnectors?: () => void
  onOpenSettings?: () => void
  onOpenHistory?: () => void
  expandedCardIds?: Set<string>
  onExpandedCardChange?: (ids: Set<string>) => void
  autoApprove?: boolean
  onToggleAutoApprove?: () => void
  onAddGoal?: () => void
  onAddSchedule?: () => void
  onAddDeadline?: () => void
  onAddReminder?: () => void
  onOpenFeatures?: () => void
}

interface ExpandableCardProps {
  id: string
  icon: ReactNode
  title: string
  summary: string
  accent: AccentKey
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
  loading?: boolean
  empty?: boolean
  onAdd?: () => void
  addLabel?: string
}

const accentMap: Record<string, { strip: string; icon: string; glow: string; bg: string; border: string }> = {
  cyan: { strip: "#22d3ee", icon: "text-cyan-400", glow: "rgba(34,211,238,0.12)", bg: "rgba(34,211,238,0.06)", border: "rgba(34,211,238,0.2)" },
  emerald: { strip: "#34d399", icon: "text-emerald-400", glow: "rgba(52,211,153,0.12)", bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.2)" },
  violet: { strip: "#a78bfa", icon: "text-violet-400", glow: "rgba(167,139,250,0.12)", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.2)" },
  amber: { strip: "#fbbf24", icon: "text-amber-400", glow: "rgba(251,191,36,0.12)", bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.2)" },
  pink: { strip: "#ec4899", icon: "text-pink-400", glow: "rgba(236,72,153,0.12)", bg: "rgba(236,72,153,0.06)", border: "rgba(236,72,153,0.2)" },
  rose: { strip: "#f43f5e", icon: "text-rose-400", glow: "rgba(244,63,94,0.12)", bg: "rgba(244,63,94,0.06)", border: "rgba(244,63,94,0.2)" },
  red: { strip: "#f87171", icon: "text-red-400", glow: "rgba(248,113,113,0.12)", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.2)" },
}

function ExpandableCard({
  id, icon, title, summary, accent, isExpanded, onToggle, children, loading, empty, onAdd, addLabel
}: ExpandableCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [spotlight, setSpotlight] = useState({ x: 50, y: 0, opacity: 0 })
  const [fullPageOpen, setFullPageOpen] = useState(false)

  useEffect(() => {
    if (!fullPageOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setFullPageOpen(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [fullPageOpen])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setSpotlight({ x, y, opacity: 1 })
  }, [])

  const handlePointerLeave = useCallback(() => {
    setSpotlight(s => ({ ...s, opacity: 0 }))
  }, [])

  const ac = accentMap[accent] || accentMap.cyan
  const showEmptyState = empty && !isExpanded

  return (
    <>
      <div
        ref={cardRef}
        id={`deck-card-${id}`}
        className="deck-glass-card group"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Spotlight hover glow */}
        <div
          className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-0"
          style={{
            background: `radial-gradient(600px circle at ${spotlight.x}% ${spotlight.y}%, ${ac.glow}, transparent 60%)`,
            opacity: spotlight.opacity * 0.5,
          }}
        />

        {/* Accent left strip */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-[3px] z-10 rounded-l-[inherit]"
          style={{ background: `linear-gradient(180deg, ${ac.strip}, ${ac.strip}99)` }}
        />

        {/* Top edge highlight line */}
        <div
          className="pointer-events-none absolute top-0 left-[3px] right-0 h-px z-10"
          style={{ background: `linear-gradient(90deg, transparent, ${ac.strip}33 30%, ${ac.strip}22 70%, transparent)` }}
        />

        {/* Header */}
        <div className="relative z-20 flex items-center gap-3 w-full p-5 text-left bg-transparent border-none">
          <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${ac.icon} transition-colors duration-150`}
            style={{ background: ac.bg }}>
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-zinc-100 leading-tight">{title}</div>
            {!isExpanded && (
              <div className="text-[11px] text-zinc-500 leading-tight truncate mt-0.5">
                {showEmptyState ? (addLabel || "No data yet") : summary}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFullPageOpen(true)}
            className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-800/60 text-zinc-600 hover:text-zinc-300 transition-all opacity-0 group-hover:opacity-100"
            title="Full page"
          >
            <Maximize2 size={12} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={`${id}-body`}
            className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 transition-all outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500/50"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>
        </div>

        {/* Collapsible body */}
        <div className={`relative z-20 grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden min-h-0">
            <div ref={bodyRef} className="p-5 pt-0">
              {loading ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-3 h-3 border-2 border-zinc-600/40 border-t-zinc-400 rounded-full animate-spin" />
                  <span className="text-xs text-zinc-500">Loading...</span>
                </div>
              ) : empty ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: ac.bg, border: `1px solid ${ac.border}` }}>
                    <Inbox size={20} className={ac.icon} style={{ opacity: 0.6 }} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 font-medium">Nothing here yet</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{addLabel || "Add data to see results"}</p>
                  </div>
                  {onAdd && (
                    <button
                      onClick={onAdd}
                      className="deck-add-btn"
                      style={{ '--btn-accent': ac.strip, '--btn-glow': ac.glow, '--btn-bg': ac.bg } as React.CSSProperties}
                    >
                      <Plus size={12} />
                      <span>{addLabel || "Add"}</span>
                    </button>
                  )}
                </div>
              ) : (
                children
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-page overlay */}
      {fullPageOpen && (
        <div className="absolute inset-0 z-[200] flex flex-col deck-fullpage-backdrop">
          <div className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-zinc-800/60 flex-none">
            <div className="flex items-center gap-4">
              <span className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: ac.bg }}>
                <span className={ac.icon}>{icon}</span>
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">{summary || "Full view"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFullPageOpen(false)}
                className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/80 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
              >
                <Minimize2 size={11} />
                <span className="hidden sm:inline">Close</span>
                <kbd className="hidden sm:inline text-[9px] text-zinc-600 border border-zinc-700/60 rounded px-1 py-0.5 ml-0.5">Esc</kbd>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 lg:p-10">
            <div className="max-w-5xl mx-auto">
              {empty ? (
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: ac.bg, border: `1px solid ${ac.border}` }}>
                    <Inbox size={28} className={ac.icon} style={{ opacity: 0.5 }} />
                  </div>
                  <p className="text-sm text-zinc-500 max-w-md">
                    {id === "digest" ? "No digest topics yet. Configure your interests to get started." :
                     id === "connectors" ? "No connectors configured. Add email or calendar to see items here." :
                     id === "schedule" ? "No schedule entries. Add your weekly schedule to see it here." :
                     id === "deadlines" ? "No upcoming deadlines. Add deadlines to track them here." :
                     id === "daily-planner" ? "No planner data. Add goals and schedule entries to fill your planner." :
                     "Nothing here yet."}
                  </p>
                  {onAdd && (
                    <button onClick={onAdd} className="deck-add-btn" style={{ '--btn-accent': ac.strip, '--btn-glow': ac.glow, '--btn-bg': ac.bg } as React.CSSProperties}>
                      <Plus size={14} />
                      <span>{addLabel || "Add"}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-[14px] leading-relaxed text-zinc-200 space-y-6
                  [&_.dk-card]:border-zinc-700/60 [&_.dk-card]:bg-zinc-900/60
                  [&_.dk-microlabel]:text-[10px] [&_.dk-microlabel]:text-zinc-400
                  [&_.dk-news-grid]:grid [&_.dk-news-grid]:grid-cols-1 [&_.dk-news-grid]:md:grid-cols-2 [&_.dk-news-grid]:gap-4
                  [&_.dk-empty]:py-12
                ">
                  {children}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function AiPageDeck(props: DeckProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (props.expandedCardIds) {
      setExpandedCards(props.expandedCardIds)
    }
  }, [props.expandedCardIds])

  const toggleCard = useCallback((id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      props.onExpandedCardChange?.(next)
      return next
    })
  }, [props.onExpandedCardChange])

  const handleExpandConnectors = useCallback(() => {
    setExpandedCards(new Set(["connectors"]))
    props.onExpandConnectors?.()
    requestAnimationFrame(() => {
      const el = document.getElementById("deck-card-connectors")
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }, [props.onExpandConnectors])

  const hasMetrics = !!(props.glanceMetrics && props.glanceMetrics.length > 0)
  const hasConnectorStatus = !!props.connectorStatus

  const digestSummary = props.glanceMetrics?.length
    ? `${props.glanceMetrics.length} topics`
    : undefined

  const connectorsSummary = props.connectorStatus
    ? `${props.connectorStatus.unreadCount} unread, ${props.connectorStatus.todayEventCount} today`
    : undefined

  const focusSummary = props.focusSlot ? "Active goals" : undefined
  const planSummary = props.planSlot ? "Long-term goals" : undefined
  const reflectSummary = props.reflectSlot ? "Daily reflections" : undefined
  const dailyPlannerSummary = props.dailyPlannerSlot ? "Today's schedule & goals" : undefined
  const scheduleSummary = props.scheduleSlot ? "Weekly schedule" : undefined
  const deadlineSummary = props.deadlineSlot ? "Upcoming deadlines" : undefined

  // ALL cards always visible — no filtering
  const cardDefs = [
    {
      id: "digest",
      icon: <Newspaper size={16} />,
      title: "Daily Digest",
      summary: digestSummary,
      accent: "cyan" as AccentKey,
      slot: props.digestSlot,
      loading: false,
      empty: !props.glanceMetrics?.length,
      onAdd: undefined,
      addLabel: "Configure interests to generate digests",
    },
    {
      id: "connectors",
      icon: <Plug size={16} />,
      title: "Connectors",
      summary: connectorsSummary,
      accent: "cyan" as AccentKey,
      slot: props.connectorsSlot,
      loading: false,
      empty: !props.connectorStatus,
      onAdd: () => props.onOpenSettings?.(),
      addLabel: "Connect email or calendar",
    },
    {
      id: "focus",
      icon: <Target size={16} />,
      title: "Focus",
      summary: focusSummary,
      accent: "emerald" as AccentKey,
      slot: props.focusSlot,
      loading: false,
      empty: !props.focusSlot,
      onAdd: props.onAddGoal,
      addLabel: "Add your first goal",
    },
    {
      id: "plan",
      icon: <BookOpen size={16} />,
      title: "Plan",
      summary: planSummary,
      accent: "violet" as AccentKey,
      slot: props.planSlot,
      loading: false,
      empty: !props.planSlot,
      onAdd: props.onAddGoal,
      addLabel: "Create long-term goals",
    },
    {
      id: "reflect",
      icon: <RefreshCw size={16} />,
      title: "Reflect",
      summary: reflectSummary,
      accent: "amber" as AccentKey,
      slot: props.reflectSlot,
      loading: false,
      empty: !props.reflectSlot,
      onAdd: undefined,
      addLabel: "Reflections appear after daily reviews",
    },
    {
      id: "daily-planner",
      icon: <Calendar size={16} />,
      title: "Daily Planner",
      summary: dailyPlannerSummary,
      accent: "emerald" as AccentKey,
      slot: props.dailyPlannerSlot,
      loading: false,
      empty: !props.dailyPlannerSlot,
      onAdd: props.onAddGoal,
      addLabel: "Plan your day with goals",
    },
    {
      id: "schedule",
      icon: <Clock size={16} />,
      title: "Schedule",
      summary: scheduleSummary,
      accent: "cyan" as AccentKey,
      slot: props.scheduleSlot,
      loading: false,
      empty: !props.scheduleSlot,
      onAdd: props.onAddSchedule,
      addLabel: "Add weekly schedule entries",
    },
    {
      id: "deadlines",
      icon: <AlertTriangle size={16} />,
      title: "Deadlines",
      summary: deadlineSummary,
      accent: "rose" as AccentKey,
      slot: props.deadlineSlot,
      loading: false,
      empty: !props.deadlineSlot,
      onAdd: props.onAddDeadline,
      addLabel: "Track upcoming deadlines",
    },
    {
      id: "automations",
      icon: <Zap size={16} />,
      title: "Automations",
      summary: undefined,
      accent: "violet" as AccentKey,
      slot: props.automationsSlot,
      loading: false,
      empty: false,
      onAdd: undefined,
      addLabel: "Create automations",
    },
  ]

  // Sort: expanded first, then by original order
  const sortedCards = [...cardDefs].sort((a, b) => {
    const aExp = expandedCards.has(a.id)
    const bExp = expandedCards.has(b.id)
    if (aExp && !bExp) return -1
    if (!aExp && bExp) return 1
    return 0
  })

  return (
    <>
      {/* Glance metrics bar */}
      {(hasMetrics || hasConnectorStatus) && (
        <div className="deck-metrics-bar">
          {(props.glanceMetrics ?? []).map((m, i) => (
            <div key={i} className="deck-metrics-item">
              <span className="deck-metrics-label">{m.label}</span>
              <span className="deck-metrics-value">{m.value}</span>
            </div>
          ))}
          {hasMetrics && hasConnectorStatus && <div className="w-px h-[14px] bg-zinc-800 flex-none" />}
          {props.connectorStatus && (
            <>
              <div className="deck-metrics-item cursor-pointer" onClick={handleExpandConnectors}>
                <span className={`w-[5px] h-[5px] rounded-full bg-emerald-400 flex-none ${props.connectorStatus.syncing ? "animate-pulse" : ""}`} />
                <span>{props.connectorStatus.unreadCount} unread</span>
              </div>
              <div className="deck-metrics-item cursor-pointer" onClick={handleExpandConnectors}>
                <span className="w-[5px] h-[5px] rounded-full bg-cyan-400 flex-none" />
                <span>{props.connectorStatus.todayEventCount} today</span>
              </div>
              {props.connectorStatus.lastSyncTime && (
                <div className="font-mono text-[10px] text-zinc-600">{props.connectorStatus.lastSyncTime}</div>
              )}
            </>
          )}
        </div>
      )}

      {props.historySlot}

      {/* Chat panel */}
      <div className="deck-chat-container">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[3px] z-[2] bg-gradient-to-b from-pink-500 to-pink-700" />
        <ChatPanel
          messages={props.messages}
          streaming={props.streaming}
          thinking={props.thinking}
          connecting={props.connecting}
          provider={props.provider}
          online={props.online}
          input={props.input}
          onInputChange={props.onInputChange}
          onSend={props.onSend}
          onStop={props.onStop}
          onReset={props.onReset}
          onCardAction={props.onCardAction}
          suggestions={props.suggestions}
          agentSteps={props.agentSteps}
          agentStatus={props.agentStatus}
          listening={props.listening}
          onToggleVoice={props.onToggleVoice}
          voiceSupported={props.voiceSupported}
          actionResults={props.actionResults}
          connectorSyncing={props.connectorSyncing}
          contextWarnings={props.contextWarnings}
          dismissError={props.dismissError}
          onModelChange={props.onModelChange}
          memoryChips={props.memoryChips}
          onNewThread={props.onNewThread}
          onOpenCommands={props.onOpenCommands}
          connectorStatus={props.connectorStatus}
          onExpandConnectors={props.onExpandConnectors}
          autoApprove={props.autoApprove}
          onToggleAutoApprove={props.onToggleAutoApprove}
        />
      </div>

      {/* Card grid — ALL cards always visible */}
      <motion.div
        layout
        className="deck-card-grid"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.05 } },
        }}
      >
        {sortedCards.map((card) => {
          const open = expandedCards.has(card.id)
          return (
            <motion.div
              key={card.id}
              className={open ? "col-span-full" : ""}
              variants={{
                hidden: { opacity: 0, y: 16, scale: 0.98 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              <ExpandableCard
                id={card.id}
                icon={card.icon}
                title={card.title}
                summary={card.summary}
                accent={card.accent}
                isExpanded={open}
                onToggle={() => toggleCard(card.id)}
                loading={card.loading}
                empty={card.empty}
                onAdd={card.onAdd}
                addLabel={card.addLabel}
              >
                {card.slot}
              </ExpandableCard>
            </motion.div>
          )
        })}
      </motion.div>
    </>
  )
}
