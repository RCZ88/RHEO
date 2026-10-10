import { useState, useCallback, useRef, useEffect } from "react"
import { History, Trash2, MessageSquare, X, Plus, Loader2, Pencil, Check } from "lucide-react"

export interface ChatThread {
  threadDate: string
  title?: string
  messageCount: number
  lastMessageAt?: number
  createdAt?: number
  preview?: string
}

interface ChatHistoryProps {
  open: boolean
  onClose: () => void
  threads: ChatThread[]
  currentThreadDate: string
  onLoadThread: (threadDate: string) => void
  onDeleteThread: (threadDate: string) => void
  onRenameThread: (threadDate: string, newTitle: string) => void
  onNewThread: () => void
  loading?: boolean
}

export function ChatHistory(props: ChatHistoryProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)
  const confirmTimer = useRef<number | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }, [])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleDelete = useCallback((date: string) => {
    if (confirmDelete === date) {
      props.onDeleteThread(date)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(date)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirmDelete(null), 3000)
    }
  }, [confirmDelete, props])

  const startRename = useCallback((thread: ChatThread) => {
    committedRef.current = null
    setEditingId(thread.threadDate)
    setEditValue(thread.title || formatDateFull(thread.threadDate))
  }, [])

  /* Enter and blur BOTH reach this. Without a guard the rename IPC fired twice
     per rename (Enter commits, then the input unmounts and blur commits again). */
  const committedRef = useRef<string | null>(null)
  const commitRename = useCallback(() => {
    if (!editingId) return
    if (committedRef.current === editingId) { setEditingId(null); return }
    committedRef.current = editingId
    if (editValue.trim()) props.onRenameThread(editingId, editValue.trim())
    setEditingId(null)
  }, [editingId, editValue, props])

  const formatDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00")
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    if (isToday) return "Today"
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  const formatDateFull = (iso: string) => {
    const d = new Date(iso + "T12:00:00")
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }

  const formatTime = (ts?: number) => {
    if (!ts) return ""
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  if (!props.open) return null;

  return (
    <div className="dk-modal-overlay" onClick={props.onClose}>
      <div className="dk-modal max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="dk-modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <History size={14} color="var(--tm)" />
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Chat History</h4>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={props.onNewThread}
              title="New thread"
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid var(--line)",
                background: "var(--surface-2)", color: "var(--ts)", display: "grid", placeItems: "center",
                cursor: "pointer", fontSize: 12,
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
                cursor: "pointer", fontSize: 12,
              }}
            >
              <X size={12} />
            </button>
          </div>
        </div>

        <div className="dk-modal-body" style={{ padding: "10px 16px" }}>
          {props.loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: 12 }}>
              <Loader2 size={16} className="spin" style={{ margin: "0 auto 8px" }} />
              Loading threads…
            </div>
          ) : props.threads.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: 12 }}>
              <MessageSquare size={20} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
              No conversations yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {props.threads.map((t) => (
                <div
                  key={t.threadDate}
                  className={`dk-history-item ${t.threadDate === props.currentThreadDate ? "active" : ""}`}
                  onClick={() => { if (editingId !== t.threadDate) props.onLoadThread(t.threadDate) }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    {editingId === t.threadDate ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null) }}
                          onBlur={commitRename}
                          onClick={e => e.stopPropagation()}
                          style={{
                            flex: 1, fontSize: 12, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                            border: "1px solid var(--cyan)", background: "var(--surface-2)", color: "var(--tp)",
                            outline: "none", fontFamily: "var(--sans)",
                          }}
                        />
                        <button
                          onClick={e => { e.stopPropagation(); commitRename() }}
                          style={{ color: "var(--emerald)", background: "none", border: "none", cursor: "pointer", padding: 2 }}
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="dk-h-date" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {t.title || formatDate(t.threadDate)}
                        <button
                          onClick={e => { e.stopPropagation(); startRename(t) }}
                          style={{ opacity: 0, background: "none", border: "none", cursor: "pointer", color: "var(--tm)", padding: 0, display: "inline-flex" }}
                          className="group-rename"
                          title="Rename session"
                        >
                          <Pencil size={10} />
                        </button>
                      </span>
                    )}
                    <span className="dk-h-meta">
                      {formatDate(t.threadDate)}
                      {t.createdAt ? ` · ${formatTime(t.createdAt)}` : ""}
                      {" · "}{t.messageCount} msg{t.messageCount !== 1 ? "s" : ""}
                      {t.preview ? ` · ${t.preview.slice(0, 20)}${t.preview.length > 20 ? "…" : ""}` : ""}
                    </span>
                  </div>
                  <div className="dk-h-actions">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.threadDate) }}
                      title={confirmDelete === t.threadDate ? "Click again to confirm" : "Delete thread"}
                      style={{
                        color: confirmDelete === t.threadDate ? "var(--red)" : undefined,
                        fontWeight: confirmDelete === t.threadDate ? 700 : undefined,
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
