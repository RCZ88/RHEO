import { useState, useEffect, useCallback } from 'react'
import { X, Check, Trash2, Clock, AlertTriangle, CheckCircle, Info, Bell } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotifItem {
  id: string
  kind: string
  title: string
  body: string
  tier: 'info' | 'warn' | 'success' | 'error'
  read: number
  created_at: number
  data?: Record<string, any>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_ICON: Record<string, typeof Info> = {
  info:    Info,
  warn:    AlertTriangle,
  success: CheckCircle,
  error:   AlertTriangle,
}

const TIER_COLOR: Record<string, string> = {
  info:    '#6366f1', // indigo-500
  warn:    '#f59e0b', // amber-500
  success: '#22c55e', // green-500
  error:   '#ef4444', // red-500
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotifPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function NotifPanel({ isOpen, onClose }: NotifPanelProps) {
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!window.deskflowAPI) return
    try {
      const res = await window.deskflowAPI.notificationsGet()
      if (res) setItems((res.notifications as any[]) ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    refresh()
    const id = setInterval(refresh, 12_000)
    return () => clearInterval(id)
  }, [isOpen, refresh])

  const markRead = async (id: string) => {
    await window.deskflowAPI?.notificationsMarkRead?.(id)
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
  }

  const dismiss = async (id: string) => {
    await window.deskflowAPI?.notificationsDismiss?.(id)
    setItems(prev => prev.filter(n => n.id !== id))
  }

  const dismissAll = async () => {
    for (const n of items) await dismiss(n.id)
  }

  const unread = items.filter(n => !n.read).length

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop — clicking outside closes */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
      >
        {/* Panel */}
        <div
          className="relative w-[360px] max-h-[calc(100vh-4rem)] bg-[#18181b] border border-white/10 shadow-2xl rounded-t-xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
          style={{
            boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-white/10"
            style={{ background: '#1a1a1a' }}
          >
            <div className="flex items-center gap-2">
              <Bell size={16} style={{ color: '#a1a1aa' }} strokeWidth={1.5} />
              <span className="text-sm font-medium text-[#a1a1aa]">Notifications</span>
              {unread > 0 && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(99,102,241,0.2)',
                    color: '#a5b4fc',
                  }}
                >
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markRead.bind(null, items.filter(n => !n.read).map(n => n.id).join(','))}
                  className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                  title="Mark all read"
                >
                  <Check size={14} style={{ color: '#71717a' }} strokeWidth={1.5} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                title="Close"
              >
                <X size={14} style={{ color: '#71717a' }} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-sm text-[#71717a]">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-sm text-[#71717a] gap-1">
                <Bell size={24} strokeWidth={1} style={{ color: '#3f3f46' }} />
                <span>Nothing here yet</span>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {items.map(n => {
                  const Icon = TIER_ICON[n.tier] ?? Info
                  const color = TIER_COLOR[n.tier] ?? '#6366f1'
                  return (
                    <li
                      key={n.id}
                      className={`group relative flex gap-3 px-4 py-3 transition-colors cursor-default
                        ${n.read ? 'opacity-60' : 'bg-white/[0.03]'}`}
                      onClick={() => markRead(n.id)}
                    >
                      {/* Tier dot */}
                      <div
                        className="mt-0.5 shrink-0"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: color,
                          boxShadow: `0 0 8px ${color}40`,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: n.read ? '#71717a' : '#e4e4e7' }}
                          >
                            {n.title}
                          </p>
                          <span className="text-[11px] shrink-0 text-[#52525b]">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: '#71717a' }}
                        >
                          {n.body}
                        </p>
                        {/* Tier tag */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Icon size={11} style={{ color }} strokeWidth={2} />
                          <span
                            className="text-[10px] uppercase tracking-wider font-medium"
                            style={{ color: color + 'cc' }}
                          >
                            {n.tier}
                          </span>
                        </div>
                      </div>
                      {/* Dismiss */}
                      <button
                        onClick={e => { e.stopPropagation(); dismiss(n.id) }}
                        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
                      >
                        <Trash2 size={13} style={{ color: '#52525b' }} strokeWidth={1.5} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2 shrink-0 border-t border-white/10"
              style={{ background: '#1a1a1a' }}
            >
              <span className="text-[11px] text-[#52525b]">
                {items.length} notification{items.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={dismissAll}
                className="text-[11px] text-[#71717a] hover:text-[#a1a1aa] transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
