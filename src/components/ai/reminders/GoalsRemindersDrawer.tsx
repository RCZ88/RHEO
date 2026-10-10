import { useState, useCallback } from "react"
import { cn } from "../lib/cn"
import {
  X, Plus, Bell, CalendarDays, Target, Check, Trash2, Clock,
  AlertCircle, Loader2, History
} from "lucide-react"
import { Segmented } from "../primitives/Segmented"
import type { Goal, LongTermGoal } from "../types"

export interface CalendarEvent {
  id: string
  title: string
  date: string
  connectorName: string
  connectorId: string
}

export interface Reminder {
  id: string
  text: string
  dueDate?: string
  goalId?: string
  done: boolean
  createdAt: string
}

interface GoalsRemindersProps {
  open: boolean
  onClose: () => void
  goals: Goal[]
  longTermGoals: LongTermGoal[]
  events: CalendarEvent[]
  reminders: Reminder[]
  onToggleReminder: (id: string, done: boolean) => Promise<void>
  onCreateReminder: (text: string, dueDate?: string) => Promise<void>
  onDeleteReminder: (id: string) => Promise<void>
  onOpenGoal?: (goalId: string) => void
  onOpenEvent?: (eventId: string) => void
  onOpenHistory?: () => void
  loading?: boolean
  error?: string
}

export function GoalsRemindersDrawer(props: GoalsRemindersProps) {
  const [activeTab, setActiveTab] = useState<"events" | "goals" | "reminders">("events")
  const [newReminderText, setNewReminderText] = useState("")
  const [newReminderDate, setNewReminderDate] = useState("")
  const [creating, setCreating] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = useCallback(async () => {
    if (!newReminderText.trim()) return
    setCreating(true)
    try {
      await props.onCreateReminder(newReminderText.trim(), newReminderDate || undefined)
      setNewReminderText("")
      setNewReminderDate("")
    } finally {
      setCreating(false)
    }
  }, [newReminderText, newReminderDate, props.onCreateReminder])

  const handleToggle = useCallback(async (id: string, done: boolean) => {
    setTogglingId(id)
    try {
      await props.onToggleReminder(id, done)
    } finally {
      setTogglingId(null)
    }
  }, [props.onToggleReminder])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      await props.onDeleteReminder(id)
    } finally {
      setDeletingId(null)
    }
  }, [props.onDeleteReminder])

  // Group events by date
  const groupedEvents = props.events.reduce((acc, ev) => {
    const d = ev.date.split("T")[0]
    if (!acc[d]) acc[d] = []
    acc[d].push(ev)
    return acc
  }, {} as Record<string, CalendarEvent[]>)

  const eventDates = Object.keys(groupedEvents).sort()

  // Goals: overdue first, then upcoming
  const now = new Date().toISOString().split("T")[0]
  const overdueGoals = props.goals.filter(g =>
    g.status === "missed" || (g.date && g.date < now && g.status !== "done")
  )
  const upcomingGoals = props.goals.filter(g =>
    g.status === "active" && g.date && g.date >= now
  )

  const tabs = [
    { value: "events" as const, label: "Events", count: props.events.length },
    { value: "goals" as const, label: "Goals", count: overdueGoals.length + upcomingGoals.length },
    { value: "reminders" as const, label: "Reminders", count: props.reminders.filter(r => !r.done).length },
  ]

  const selectedTab = activeTab

  if (!props.open) return null;

  return (
    <div className="dk-modal-overlay" onClick={props.onClose}>
      <div className="dk-modal max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="dk-modal-head">
          <div className="flex items-center gap-2">
            <Bell size={14} color="var(--tm)" />
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Goals & Reminders</h4>
          </div>
          <div className="flex items-center gap-2">
            {props.onOpenHistory && (
              <button
                onClick={props.onOpenHistory}
                title="Chat History"
                className="h-[26px] w-[26px] rounded-md border border-zinc-800/60 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
              >
                <History size={12} />
              </button>
            )}
            <button
              onClick={props.onClose}
              title="Close"
              className="h-[26px] w-[26px] rounded-md border border-zinc-800/60 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        <div className="px-3 pt-2">
          <Segmented value={selectedTab} onChange={setActiveTab} options={tabs} aria-label="Goals & Reminders tabs" />
        </div>

        <div className="dk-modal-body">
        {props.loading ? (
          <div className="p-5 text-center text-zinc-500 text-[12px]">
            <Loader2 size={16} className="spin mx-auto mb-2" />
            Loading...
          </div>
        ) : props.error ? (
          <div className="p-5 text-center text-red-400 text-[12px]">
            <AlertCircle size={16} className="mx-auto mb-2" />
            {props.error}
          </div>
        ) : activeTab === "events" ? (
          props.events.length === 0 ? (
            <div className="p-5 text-center text-zinc-500 text-[12px]">
              <CalendarDays size={20} className="mx-auto mb-2 opacity-40" />
              No upcoming events.
              <p className="text-[11px] text-zinc-600 mt-1">Sync a calendar connector to see events.</p>
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {eventDates.map(date => (
                <div key={date}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2 sticky top-0 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur py-1">
                    {formatEventDate(date)}
                  </div>
                  <div className="space-y-1.5">
                    {groupedEvents[date].map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => props.onOpenEvent?.(ev.id)}
                        className="w-full text-left rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-2.5 ring-1 ring-zinc-800/50 hover:ring-zinc-700 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={11} className="text-cyan-400 shrink-0" />
                          <span className="text-[11px] text-zinc-500 font-mono shrink-0">
                            {formatEventTime(ev.date)}
                          </span>
                          <span className="text-[12px] text-zinc-200 truncate flex-1">{ev.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 pl-[22px]">
                          <span className="text-[10px] text-zinc-600">{ev.connectorName}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "goals" ? (
          overdueGoals.length === 0 && upcomingGoals.length === 0 ? (
            <div className="p-5 text-center text-zinc-500 text-[12px]">
              <Target size={20} className="mx-auto mb-2 opacity-40" />
              All goals on track.
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {overdueGoals.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-red-400 mb-2">Overdue</div>
                  <div className="space-y-1.5">
                    {overdueGoals.map(g => (
                      <GoalReminderRow
                        key={g.id}
                        title={g.title}
                        meta={`${g.category} · ${g.date}`}
                        accent="red"
                        onClick={() => props.onOpenGoal?.(g.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {upcomingGoals.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Upcoming</div>
                  <div className="space-y-1.5">
                    {upcomingGoals.map(g => (
                      <GoalReminderRow
                        key={g.id}
                        title={g.title}
                        meta={`${g.category} · ${g.date}`}
                        accent="emerald"
                        onClick={() => props.onOpenGoal?.(g.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="p-3 space-y-3">
            {props.reminders.length === 0 ? (
              <div className="p-5 text-center text-zinc-500 text-[12px]">
                <Bell size={20} className="mx-auto mb-2 opacity-40" />
                No reminders yet.
              </div>
            ) : (
              <div className="space-y-1">
                {props.reminders.map(r => (
                  <div
                    key={r.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-2.5 ring-1 ring-zinc-800/50 transition-all group",
                      r.done && "opacity-50"
                    )}
                  >
                    <button
                      onClick={() => handleToggle(r.id, !r.done)}
                      disabled={togglingId === r.id}
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        r.done
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                          : "border-zinc-700 hover:border-zinc-500"
                      )}
                    >
                      {r.done && <Check size={10} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-[12px] truncate", r.done ? "text-zinc-500 line-through" : "text-zinc-200")}>
                        {r.text}
                      </div>
                      {r.dueDate && (
                        <div className="text-[10px] text-zinc-600 font-mono">{r.dueDate}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="h-5 w-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Add */}
            <div className="rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-2.5 ring-1 ring-zinc-800/50 space-y-2">
              <input
                type="text"
                value={newReminderText}
                onChange={e => setNewReminderText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
                placeholder="Add a reminder..."
                className="w-full bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-600 outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newReminderDate}
                  onChange={e => setNewReminderDate(e.target.value)}
                  className="bg-transparent text-[11px] text-zinc-500 font-mono outline-none border-none"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newReminderText.trim()}
                  className="ml-auto rounded-md bg-violet-500/15 border border-violet-500/30 px-2.5 py-1 text-[11px] text-violet-300 hover:bg-violet-500/25 transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  {creating ? <Loader2 size={10} className="spin" /> : <Plus size={10} />}
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

  /* ─── Helpers ─── */

function GoalReminderRow({
  title,
  meta,
  accent,
  onClick,
}: {
  title: string
  meta: string
  accent: "red" | "emerald" | "amber" | "cyan"
  onClick?: () => void
}) {
  const dotColor = {
    red: "bg-red-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    cyan: "bg-cyan-400",
  }[accent]

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-2.5 ring-1 ring-zinc-800/50 hover:ring-zinc-700 transition-all"
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
        <span className="text-[12px] text-zinc-200 truncate flex-1">{title}</span>
      </div>
      <div className="text-[10px] text-zinc-600 mt-0.5 pl-3.5 font-mono">{meta}</div>
    </button>
  )
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
}
