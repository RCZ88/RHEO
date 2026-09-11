import { useState, useEffect, useCallback } from "react"
import {
  Mail, CalendarDays, RefreshCw, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Search, X, Plus, Plug, Circle, Check
} from "lucide-react"
import type { ConnectorConfig, ConnectorItem } from "../../../types/connectors"
import { useConnectorItems } from "../../../hooks/useConnectorItems"
import { ConnectorItemModal } from "./ConnectorItemModal"

export interface Connector {
  id: string
  name: string
  status: "ready" | "busy" | "error" | "idle"
  detail?: string
  itemCount?: number
  iconUrl?: string
  type?: string
}

interface ConnectorsPanelProps {
  // From AiPage.tsx — THESE ARE THE CANONICAL PROP NAMES
  state?: "loading" | "error" | "empty" | "ready"
  connectors: Connector[]
  errorMessage?: string
  onRetry?: () => void
  onAdd?: () => void
  onSync?: (id: string) => void | Promise<void>
  onToast?: (msg: string, type?: "success" | "error" | "info") => void
  onRefresh?: () => void
  onReply?: (connectorId: string, itemId: string, draft: string) => Promise<void>
  onMarkRead?: (connectorId: string, itemId: string, read: boolean) => Promise<void>
  onDelete?: (connectorId: string) => Promise<void>
  onAddToSchedule?: (connectorId: string, data: { title: string; day_of_week: number; start_time: string; end_time: string }) => Promise<void>
  onCreateDeadline?: (connectorId: string, data: { title: string; due_date: string; priority: string }) => Promise<void>
  onTest?: (id: string) => Promise<{ success: boolean; message: string }>
  onSyncAll?: () => Promise<void>
}

export function ConnectorsPanel(props: ConnectorsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "email" | "calendar">("all")
  const [syncingAll, setSyncingAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<{ item: ConnectorItem; type: "email" | "calendar"; connectorId: string } | null>(null)

  const handleSyncAll = useCallback(async () => {
    if (!props.onSync) return
    setSyncingAll(true)
    try {
      for (const c of props.connectors) {
        if (c.status === "ready" || c.status === "idle") {
          await props.onSync(c.id)
        }
      }
      props.onRefresh?.()
      props.onToast?.("All connectors synced", "success")
    } catch (e: any) {
      props.onToast?.(e.message || "Sync failed", "error")
    } finally {
      setSyncingAll(false)
    }
  }, [props.onSync, props.connectors, props.onRefresh, props.onToast])

  const filteredConnectors = props.connectors.filter(c => {
    if (filterType === "all") return true
    return c.type === filterType
  })

  if (props.state === "loading") {
    return (
      <div className="dk-card dk-acc dk-cyan" style={{ minHeight: 180 }}>
        <div className="dk-microlabel" style={{ marginBottom: 12 }}>Connectors</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              height: 44, borderRadius: 10, background: "var(--surface-2)",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      </div>
    )
  }

  if (props.state === "error" || props.errorMessage) {
    return (
      <div className="dk-card dk-acc dk-cyan">
        <div className="dk-microlabel" style={{ marginBottom: 10 }}>Connectors</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--red)", marginBottom: 10 }}>
          <AlertCircle size={14} />
          {props.errorMessage}
        </div>
        {props.onRetry && (
          <button onClick={props.onRetry} className="dk-topbar-btn">
            Retry
          </button>
        )}
      </div>
    )
  }

  if (props.state === "empty" || filteredConnectors.length === 0) {
    return (
      <div className="dk-card dk-acc dk-cyan">
        <div className="dk-microlabel" style={{ marginBottom: 10 }}>Connectors</div>
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <Plug size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
          <div style={{ fontSize: 12, color: "var(--tm)", marginBottom: 4 }}>No connectors configured</div>
          <div style={{ fontSize: 11, color: "var(--tm)", opacity: 0.7 }}>Add email or calendar in Settings</div>
          {props.onAdd && (
            <button
              onClick={props.onAdd}
              style={{
                marginTop: 10, fontSize: 11, padding: "6px 14px", borderRadius: 8,
                border: "1px solid var(--cyan)", background: "rgba(34,211,238,.12)",
                color: "var(--cyan)", cursor: "pointer", fontFamily: "var(--mono)",
              }}
            >
              <Plus size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Add your first connector
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="dk-card dk-acc dk-cyan">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="dk-microlabel">Connectors</div>
          <div style={{ display: "flex", gap: 6 }}>
            {props.onRefresh && (
              <button onClick={props.onRefresh} className="dk-topbar-btn" style={{ height: 26, padding: "0 10px" }}>
                <RefreshCw size={11} />
                Refresh
              </button>
            )}
            {props.onAdd && (
              <button onClick={props.onAdd} className="dk-topbar-btn" style={{ height: 26, padding: "0 10px" }}>
                <Plus size={11} />
                Add
              </button>
            )}
            {props.onSync && (
              <button
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="dk-topbar-btn"
                style={{ height: 26, padding: "0 10px" }}
              >
                {syncingAll ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}
                Sync All
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6,
            background: "var(--surface-2)", border: "1px solid var(--line)",
            borderRadius: 8, padding: "6px 10px",
          }}>
            <Search size={12} color="var(--tm)" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "var(--tp)", fontSize: 12, fontFamily: "var(--sans)",
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tm)" }}>
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--line)",
              borderRadius: 8, color: "var(--ts)", fontSize: 11,
              fontFamily: "var(--mono)", padding: "6px 10px", cursor: "pointer",
            }}
          >
            <option value="all">All</option>
            <option value="email">Email</option>
            <option value="calendar">Calendar</option>
          </select>
        </div>

        {/* Connector Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredConnectors.map(connector => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              isExpanded={expandedId === connector.id}
              onToggle={() => setExpandedId(expandedId === connector.id ? null : connector.id)}
              onSync={props.onSync ? () => props.onSync!(connector.id) : undefined}
              onDelete={props.onDelete ? async () => {
                setDeletingId(connector.id)
                await props.onDelete!(connector.id)
                setDeletingId(null)
              } : undefined}
              onTest={props.onTest ? () => props.onTest!(connector.id) : undefined}
              searchQuery={searchQuery}
              isDeleting={deletingId === connector.id}
              onItemClick={(item) => setModalItem({ item, type: connector.type === "email" ? "email" : "calendar", connectorId: connector.id })}
            />
          ))}
        </div>
      </div>

      {/* Full-View Modal */}
      {modalItem && (
        <ConnectorItemModal
          item={modalItem.item}
          connectorType={modalItem.type}
          onClose={() => setModalItem(null)}
          onReply={props.onReply ? (itemId, draft) => props.onReply!(modalItem.connectorId, itemId, draft) : undefined}
          onMarkRead={props.onMarkRead ? (itemId, read) => props.onMarkRead!(modalItem.connectorId, itemId, read) : undefined}
          onDelete={props.onDelete ? () => props.onDelete!(modalItem.connectorId) : undefined}
          onAddToSchedule={props.onAddToSchedule ? (data) => props.onAddToSchedule!(modalItem.connectorId, data) : undefined}
          onCreateDeadline={props.onCreateDeadline ? (data) => props.onCreateDeadline!(modalItem.connectorId, data) : undefined}
        />
      )}
    </>
  )
}

// --- Connector Card ---
interface ConnectorCardProps {
  connector: Connector
  isExpanded: boolean
  onToggle: () => void
  onSync?: () => void | Promise<void>
  onDelete?: () => void | Promise<void>
  onTest?: () => Promise<{ success: boolean; message: string }>
  searchQuery: string
  isDeleting: boolean
  onItemClick: (item: ConnectorItem) => void
}

function ConnectorCard(props: ConnectorCardProps) {
  const { connector, isExpanded } = props
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const itemsHook = useConnectorItems(connector.id)

  useEffect(() => {
    if (testResult) {
      const t = setTimeout(() => setTestResult(null), 5000)
      return () => clearTimeout(t)
    }
  }, [testResult])

  const isEmail = connector.type === "email"
  const statusColor = connector.status === "ready" ? "var(--emerald)" : connector.status === "error" ? "var(--red)" : "var(--tm)"

  useEffect(() => {
    if (isExpanded) {
      itemsHook.invalidate()
      itemsHook.load({ search: props.searchQuery || undefined, limit: 10 })
    }
  }, [isExpanded, props.searchQuery])

  const handleSync = useCallback(async () => {
    if (!props.onSync) return
    setSyncing(true)
    try {
      await props.onSync()
      itemsHook.invalidate()
      if (isExpanded) itemsHook.load({ search: props.searchQuery || undefined, limit: 10 })
    } finally {
      setSyncing(false)
    }
  }, [props.onSync, isExpanded, props.searchQuery])

  const handleTest = useCallback(async () => {
    if (!props.onTest) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await props.onTest()
      setTestResult(result || { success: true, message: 'Connected' })
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Test failed' })
    } finally {
      setTesting(false)
    }
  }, [props.onTest])

  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid var(--line)",
      background: "var(--surface-2)",
      overflow: "hidden",
      transition: "border-color 0.2s ease",
    }}>
      {/* Card Header */}
      <div
        onClick={props.onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: isEmail ? "rgba(236,72,153,.12)" : "rgba(34,211,238,.12)",
          border: `1px solid ${isEmail ? "rgba(236,72,153,.2)" : "rgba(34,211,238,.2)"}`,
          display: "grid", placeItems: "center",
        }}>
          {isEmail ? <Mail size={13} color="var(--pink)" /> : <CalendarDays size={13} color="var(--cyan)" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tp)", lineHeight: 1.3 }}>
            {connector.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--tm)", fontFamily: "var(--mono)", display: "flex", gap: 8, marginTop: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: statusColor }}><Circle size={6} fill={statusColor} />{connector.status}</span>
            {connector.itemCount != null && <span>{connector.itemCount} items</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {props.onSync && (
            <button onClick={(e) => { e.stopPropagation(); handleSync() }} disabled={syncing}
              className="dk-iconbtn" style={{ width: 24, height: 24 }} title="Sync">
              {syncing ? <Loader2 size={11} className="spin" /> : <RefreshCw size={11} />}
            </button>
          )}
          {props.onTest && (
            <button onClick={(e) => { e.stopPropagation(); handleTest() }} disabled={testing}
              className="dk-iconbtn" style={{
                width: 24, height: 24,
                background: testResult ? (testResult.success ? "rgba(52,211,153,.15)" : "rgba(248,113,113,.15)") : undefined,
                borderColor: testResult ? (testResult.success ? "rgba(52,211,153,.3)" : "rgba(248,113,113,.3)") : undefined,
              }} title={testResult ? testResult.message : "Test connection"}>
              {testing ? <Loader2 size={11} className="spin" /> :
               testResult?.success ? <Check size={11} color="var(--emerald)" /> :
               testResult ? <X size={11} color="var(--red)" /> :
               <AlertCircle size={11} />}
            </button>
          )}
          {props.onDelete && (
            <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }} disabled={props.isDeleting}
              className="dk-iconbtn" style={{ width: 24, height: 24 }} title="Delete">
              {props.isDeleting ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
            </button>
          )}
          {isExpanded ? <ChevronUp size={14} color="var(--tm)" /> : <ChevronDown size={14} color="var(--tm)" />}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div style={{
          padding: "8px 12px", background: "rgba(248,113,113,.06)",
          borderTop: "1px solid rgba(248,113,113,.12)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ fontSize: 11, color: "var(--red)" }}>Delete this connector?</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowDeleteConfirm(false)} className="dk-topbar-btn" style={{ height: 26, padding: "0 10px" }}>
              Cancel
            </button>
            <button onClick={() => { setShowDeleteConfirm(false); props.onDelete!() }}
              className="dk-topbar-btn" style={{ height: 26, padding: "0 10px", color: "var(--red)", borderColor: "rgba(248,113,113,.3)" }}>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Expanded Items */}
      {isExpanded && (
        <div style={{
          borderTop: "1px solid var(--line)",
          maxHeight: 320, overflowY: "auto",
          padding: "8px 0",
        }}>
          {itemsHook.state.status === "loading" ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <Loader2 size={16} color="var(--tm)" className="spin" />
            </div>
          ) : itemsHook.state.status === "error" ? (
            <div style={{ padding: 12, fontSize: 11, color: "var(--red)", textAlign: "center" }}>
              {"message" in itemsHook.state ? itemsHook.state.message : "Error"}
            </div>
          ) : itemsHook.state.status === "ready" && itemsHook.state.data.items.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "var(--tm)" }}>
              No items found. Try syncing.
            </div>
          ) : itemsHook.state.status === "ready" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {itemsHook.state.data.items.map((item: ConnectorItem) => (
                <ConnectorItemRow key={item.id} item={item} onClick={() => props.onItemClick(item)} />
              ))}
              {itemsHook.state.data.hasMore && (
                <button
                  onClick={() => itemsHook.load({ offset: itemsHook.state.data.offset, limit: 10 })}
                  style={{
                    margin: "8px auto 4px", fontSize: 10, padding: "4px 12px",
                    borderRadius: 6, border: "1px solid var(--line)",
                    background: "transparent", color: "var(--tm)",
                    cursor: "pointer", fontFamily: "var(--mono)",
                  }}
                >
                  Load more
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// --- Connector Item Row ---
function ConnectorItemRow({ item, onClick }: { item: ConnectorItem; onClick: () => void }) {
  const isEmail = item.itemType === "email"
  const isUnread = item.read === false
  const dateStr = item.date ? timeAgo(new Date(item.date)) : ""
  const fromAddr = item.metadata?.from ? ` — ${item.metadata.from}` : ""

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "8px 12px", borderRadius: 6,
        transition: "background 0.15s ease",
        cursor: "pointer",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--raised)" }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: "50%", marginTop: 5,
        background: isUnread ? "var(--pink)" : "transparent",
        flex: "none",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11.5, fontWeight: isUnread ? 600 : 400,
          color: isUnread ? "var(--tp)" : "var(--ts)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {item.subject || item.summary || "(no subject)"}
        </div>
        {item.summary && (
          <div style={{
            fontSize: 10.5, color: "var(--tm)", marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {item.summary.slice(0, 80)}{item.summary.length > 80 ? "..." : ""}
            {fromAddr}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 9.5, color: "var(--tm)", fontFamily: "var(--mono)",
        flex: "none", whiteSpace: "nowrap",
      }}>
        {dateStr}
      </div>
    </div>
  )
}

// --- Time Ago Helper ---
function timeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
