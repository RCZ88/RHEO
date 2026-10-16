import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  CornerDownRight,
  History,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

export interface ChatThread {
  threadDate: string
  title?: string
  messageCount: number
  lastMessageAt?: number
  createdAt?: number
  preview?: string
  workspaceName?: string
  canvasName?: string
}

interface PreviewMessage {
  role: string
  content: string
}

interface ChatHistoryProps {
  open: boolean
  onClose: () => void
  threads: ChatThread[]
  currentThreadDate: string
  /** ONLY thing that switches the live canvas chat. Wired to the explicit button. */
  onLoadThread: (threadDate: string) => void
  onDeleteThread: (threadDate: string) => void
  onRenameThread: (threadDate: string, newTitle: string) => void
  onNewThread: () => void
  loading?: boolean
}

/* ------------------------------------------------------------------ dates -- */

function dateKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "Today"
  const yest = new Date(today)
  yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return "Yesterday"
  const days = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" })
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" })
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function fullDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function clockTime(ts?: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/* ---------------------------------------------------------------- helpers -- */

function originLabel(t: ChatThread): string {
  const parts = [t.workspaceName, t.canvasName].filter(Boolean) as string[]
  return parts.length ? parts.join(" / ") : "Unsorted"
}

function matches(t: ChatThread, q: string): boolean {
  if (!q) return true
  const hay = [t.title, t.preview, t.workspaceName, t.canvasName, t.threadDate]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return hay.includes(q)
}

/* ------------------------------------------------------------- components -- */

function RowSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "2px 4px" }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 9, width: "58%", borderRadius: 4, background: "var(--surface-2)" }} />
          <div style={{ height: 7, width: "82%", borderRadius: 4, background: "var(--surface-2)", opacity: 0.6 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ searching, onNewThread }: { searching: boolean; onNewThread: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "36px 20px",
        textAlign: "center",
      }}
    >
      <MessageSquare size={20} style={{ color: "var(--tm)", opacity: 0.35 }} />
      <p style={{ margin: 0, fontSize: 12, color: "var(--tm)", lineHeight: 1.5 }}>
        {searching ? "No conversation matches that search." : "No conversations yet."}
      </p>
      {!searching && (
        <button
          onClick={onNewThread}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 26,
            padding: "0 10px",
            borderRadius: 6,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: "var(--tp)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          <Plus size={11} /> Start one
        </button>
      )}
    </div>
  )
}

function PreviewPane({
  thread,
  messages,
  loading,
  isLive,
  onOpen,
}: {
  thread: ChatThread | null
  messages: PreviewMessage[]
  loading: boolean
  isLive: boolean
  onOpen: () => void
}) {
  if (!thread) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 11, color: "var(--tm)", opacity: 0.7, lineHeight: 1.6 }}>
          Select a conversation to read it here.
          <br />
          Nothing loads into the canvas until you choose to.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--tp)",
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {thread.title || fullDate(thread.threadDate)}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              color: "var(--tm)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
                maxWidth: 190,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={originLabel(thread)}
            >
              {originLabel(thread)}
            </span>
            <span>
              {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
            </span>
            {thread.lastMessageAt ? <span>· {clockTime(thread.lastMessageAt)}</span> : null}
          </div>
        </div>

        {isLive ? (
          <span
            style={{
              flexShrink: 0,
              alignSelf: "center",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              fontSize: 10,
              color: "var(--tm)",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "var(--emerald)",
                flexShrink: 0,
              }}
            />
            In canvas
          </span>
        ) : (
          <button
            onClick={onOpen}
            style={{
              flexShrink: 0,
              alignSelf: "center",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 26,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid var(--cyan)",
              background: "var(--surface-2)",
              color: "var(--tp)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Load this conversation into the live canvas"
          >
            <CornerDownRight size={11} /> Open in canvas
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 0", color: "var(--tm)", fontSize: 11 }}>
            <Loader2 size={12} className="spin" /> Reading conversation…
          </div>
        ) : messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: 11, color: "var(--tm)", opacity: 0.7 }}>
            This conversation has no readable messages.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => {
              const isUser = m.role === "user"
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    alignItems: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--tm)",
                      opacity: 0.75,
                    }}
                  >
                    {isUser ? "You" : m.role === "assistant" ? "Assistant" : m.role}
                  </span>
                  <div
                    style={{
                      maxWidth: "92%",
                      padding: "7px 10px",
                      borderRadius: 8,
                      fontSize: 11.5,
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      color: "var(--tp)",
                      background: isUser ? "var(--surface-2)" : "transparent",
                      border: isUser ? "1px solid var(--line)" : "1px solid transparent",
                      borderLeft: isUser ? "1px solid var(--line)" : "2px solid var(--line)",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- main -- */

export function ChatHistory(props: ChatHistoryProps) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewMessage[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef<string | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }, [])

  useEffect(() => {
    if (!props.open) {
      setQuery("")
      setSelected(null)
      setPreview([])
      setEditingId(null)
      setConfirmDelete(null)
    }
  }, [props.open])

  // Keep a valid selection: prefer the explicit pick, else the live canvas
  // thread, else the newest row. Never leave the preview pane stranded.
  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => props.threads.filter(t => matches(t, q)), [props.threads, q])

  const groups = useMemo(() => {
    const out: Array<{ key: string; rows: ChatThread[] }> = []
    const index = new Map<string, number>()
    for (const t of filtered) {
      const key = dateKey(t.threadDate)
      const at = index.get(key)
      if (at === undefined) {
        index.set(key, out.length)
        out.push({ key, rows: [t] })
      } else {
        out[at].rows.push(t)
      }
    }
    return out
  }, [filtered])

  const selectedThread = useMemo(
    () => filtered.find(t => t.threadDate === selected) || null,
    [filtered, selected],
  )

  useEffect(() => {
    if (selectedThread || filtered.length === 0) return
    const live = filtered.find(t => t.threadDate === props.currentThreadDate)
    setSelected((live || filtered[0]).threadDate)
  }, [filtered, selectedThread, props.currentThreadDate])

  // Preview load. Deliberately does NOT touch live chat state — it reads the
  // transcript for display only. `onLoadThread` remains the sole canvas switch.
  useEffect(() => {
    const date = selected
    if (!date) { setPreview([]); return }
    const api = (window as unknown as { deskflowAPI?: { aiChatLoad?: (d: string) => Promise<unknown> } }).deskflowAPI
    if (typeof api?.aiChatLoad !== 'function') { console.warn('[ChatHistory] aiChatLoad not available'); setPreview([]); return }
    let live = true
    setPreviewLoading(true)
    api.aiChatLoad(date)
      .then((res: any) => {
        if (!live) return
        if (!res?.success) {
          console.warn('[ChatHistory] load failed:', res?.error)
          setPreview([])
          return
        }
        const msgs = Array.isArray(res.messages) ? res.messages : []
        console.log('[ChatHistory] loaded', msgs.length, 'messages for', date)
        setPreview(msgs)
      })
      .catch((err) => { if (live) { console.error('[ChatHistory] load error:', err); setPreview([]) } })
      .finally(() => { if (live) setPreviewLoading(false) })
    return () => { live = false }
  }, [selected])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const startRename = useCallback((t: ChatThread) => {
    committedRef.current = null
    setEditingId(t.threadDate)
    setEditValue(t.title || fullDate(t.threadDate))
  }, [])

  /* Enter and blur BOTH reach this. Without the guard the rename IPC fires twice. */
  const commitRename = useCallback(() => {
    if (!editingId) return
    if (committedRef.current === editingId) { setEditingId(null); return }
    committedRef.current = editingId
    const next = editValue.trim()
    if (next) props.onRenameThread(editingId, next)
    setEditingId(null)
  }, [editingId, editValue, props])

  const handleDelete = useCallback(
    (date: string) => {
      if (confirmDelete === date) {
        props.onDeleteThread(date)
        setConfirmDelete(null)
        if (selected === date) setSelected(null)
      } else {
        setConfirmDelete(date)
        if (confirmTimer.current) clearTimeout(confirmTimer.current)
        confirmTimer.current = setTimeout(() => setConfirmDelete(null), 3000)
      }
    },
    [confirmDelete, props, selected],
  )

  const openInCanvas = useCallback(() => {
    if (!selected) return
    props.onLoadThread(selected)
  }, [selected, props])

  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingId) { props.onClose(); return }
      // "/" jumps to search from anywhere in the modal, matching the composer.
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !editingId) {
        const el = document.activeElement as HTMLElement | null
        const inEditable = !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable)
        if (inEditable) return
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [props.open, props, editingId])

  if (!props.open) return null

  const isLive = selectedThread?.threadDate === props.currentThreadDate

  return (
    <div className="dk-modal-overlay" onClick={props.onClose}>
      <div
        className="dk-modal"
        data-dk-modal-open="chat-history"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 92vw)",
          maxWidth: "920px",
          height: "min(560px, 86vh)",
          display: "flex",
          flexDirection: "column",
          padding: 0,
        }}
      >
        {/* head */}
        <div
          className="dk-modal-head"
          style={{ borderBottom: "1px solid var(--line)", flexShrink: 0, gap: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <History size={14} color="var(--tm)" />
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Chat History</h4>
            <span style={{ fontSize: 10, color: "var(--tm)", opacity: 0.7 }}>
              {props.threads.length}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <Search
              size={11}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--tm)",
                opacity: 0.6,
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…  /"
              style={{
                width: "100%",
                height: 30,
                padding: "0 10px 0 26px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
                color: "var(--tp)",
                fontSize: 13,
                lineHeight: 1.4,
                fontFamily: "var(--sans)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={props.onNewThread}
              title="New thread"
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line)",
                background: "var(--surface-2)", color: "var(--ts)", display: "grid", placeItems: "center",
                cursor: "pointer",
              }}
            >
              <Plus size={12} />
            </button>
            <button
              onClick={props.onClose}
              title="Close"
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line)",
                background: "var(--surface-2)", color: "var(--ts)", display: "grid", placeItems: "center",
                cursor: "pointer",
              }}
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* body: list | preview */}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <div
            style={{
              width: 268,
              flexShrink: 0,
              borderRight: "1px solid var(--line)",
              overflowY: "auto",
              padding: 6,
            }}
          >
            {props.loading ? (
              <RowSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState searching={q.length > 0} onNewThread={props.onNewThread} />
            ) : (
              groups.map((g) => (
                <div key={g.key} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 6px 5px",
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "var(--tm)",
                      opacity: 0.75,
                    }}
                  >
                    <span style={{ whiteSpace: "nowrap" }}>{g.key}</span>
                    <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{g.rows.length}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {g.rows.map((t) => {
                      const isSelected = t.threadDate === selected
                      const isCurrent = t.threadDate === props.currentThreadDate
                      const isEditing = editingId === t.threadDate

                      return (
                        <div
                          key={t.threadDate}
                          onClick={() => {
                            if (!isEditing) setSelected(t.threadDate)
                          }}
                          title={t.title || fullDate(t.threadDate)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 7px",
                            borderRadius: 6,
                            cursor: "pointer",
                            background: isSelected ? "var(--surface-2)" : "transparent",
                            borderLeft: isCurrent
                              ? "2px solid var(--cyan)"
                              : "2px solid transparent",
                            opacity: isSelected ? 1 : 0.82,
                          }}
                          className="dk-history-item"
                        >
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                            {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  ref={editInputRef}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitRename()
                                    if (e.key === "Escape") setEditingId(null)
                                  }}
                                  onBlur={commitRename}
                                  style={{
                                    flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, padding: "4px 7px",
                                    borderRadius: 4, border: "1px solid var(--cyan)", background: "var(--surface-1)",
                                    color: "var(--tp)", outline: "none", fontFamily: "var(--sans)",
                                  }}
                                />
                                <button
                                  onClick={commitRename}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--emerald)", display: "grid" }}
                                >
                                  <Check size={11} />
                                </button>
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  color: "var(--tp)",
                                  lineHeight: 1.3,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {t.title || fullDate(t.threadDate)}
                              </span>
                            )}

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: 9.5,
                                color: "var(--tm)",
                                opacity: 0.8,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  maxWidth: 104,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  padding: "0 4px",
                                  borderRadius: 3,
                                  background: "var(--surface-2)",
                                }}
                                title={originLabel(t)}
                              >
                                {originLabel(t)}
                              </span>
                              <span style={{ flexShrink: 0 }}>{t.messageCount}m</span>
                              {t.lastMessageAt ? (
                                <span style={{ flexShrink: 0 }}>· {clockTime(t.lastMessageAt)}</span>
                              ) : null}
                            </div>
                          </div>

                          {!isEditing && (
                            <div
                              className="dk-h-actions"
                              style={{ display: "flex", gap: 1, flexShrink: 0, opacity: isSelected ? 1 : 0 }}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); startRename(t) }}
                                title="Rename"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tm)", padding: 2, display: "grid" }}
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(t.threadDate) }}
                                title={confirmDelete === t.threadDate ? "Click again to confirm" : "Delete"}
                                style={{
                                  background: "none", border: "none", cursor: "pointer", padding: 2, display: "grid",
                                  color: confirmDelete === t.threadDate ? "var(--red)" : "var(--tm)",
                                  fontWeight: confirmDelete === t.threadDate ? 700 : undefined,
                                }}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <PreviewPane
              thread={selectedThread}
              messages={preview}
              loading={previewLoading}
              isLive={!!isLive}
              onOpen={openInCanvas}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatHistory