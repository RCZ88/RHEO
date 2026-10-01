import { useState, useEffect, useCallback } from 'react'
import { Shield, Search, Eye, X, Clock, Wallet, ArrowUpRight, RefreshCw, Users, Bell, Tag } from 'lucide-react'
import type { AuditLogEntry } from './finance-types'

const EVENT_ICONS: Record<string, React.ReactNode> = {
  account_created: <Wallet className="w-3 h-3 text-emerald-400" />,
  wallet_created: <Wallet className="w-3 h-3 text-emerald-400" />,
  wallet_updated: <RefreshCw className="w-3 h-3 text-blue-400" />,
  wallet_archived: <Wallet className="w-3 h-3 text-amber-400" />,
  wallet_deleted: <X className="w-3 h-3 text-red-400" />,
  wallet_fee_updated: <RefreshCw className="w-3 h-3 text-amber-400" />,
  transaction_created: <ArrowUpRight className="w-3 h-3 text-blue-400" />,
  transaction_updated: <RefreshCw className="w-3 h-3 text-amber-400" />,
  transaction_deleted: <X className="w-3 h-3 text-red-400" />,
  transfer_created: <ArrowUpRight className="w-3 h-3 text-purple-400" />,
  balance_adjusted: <RefreshCw className="w-3 h-3 text-amber-400" />,
  balance_recalculated: <RefreshCw className="w-3 h-3 text-amber-400" />,
  all_balances_recalculated: <RefreshCw className="w-3 h-3 text-amber-400" />,
  subscription_created: <Bell className="w-3 h-3 text-emerald-400" />,
  subscription_updated: <RefreshCw className="w-3 h-3 text-amber-400" />,
  subscription_deleted: <X className="w-3 h-3 text-red-400" />,
  ft_person_created: <Users className="w-3 h-3 text-emerald-400" />,
  category_created: <Tag className="w-3 h-3 text-emerald-400" />,
  category_updated: <RefreshCw className="w-3 h-3 text-amber-400" />,
}

export function AuditLogTab({ displayCurrency }: { displayCurrency: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [detailData, setDetailData] = useState<Record<string, any> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [entityFilter, setEntityFilter] = useState<string>('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 30
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const opts: any = { limit: PAGE_SIZE, offset: page * PAGE_SIZE }
      if (entityFilter) {
        opts.entity_type = entityFilter
      }
      const result = await (window as any).deskflowAPI?.auditList(opts) ?? { rows: [], total: 0 }
      setLogs(result?.rows ?? [])
      setTotalCount(result?.total ?? 0)
    } catch { setLogs([]) }
    finally { setLoading(false) }
  }, [page, entityFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handleViewDetail = async (log: AuditLogEntry) => {
    setSelectedLog(log)
    setDetailLoading(true)
    setDetailData(null)
    try {
      const full = await (window as any).deskflowAPI?.auditGet(log.id)
      if (full?.decrypted_data) setDetailData(full.decrypted_data)
    } catch {}
    finally { setDetailLoading(false) }
  }

  const formatTime = (s: string) => {
    try { return new Date(s.replace(' ', 'T') + 'Z').toLocaleString() } catch { return s }
  }

  const getBadgeColor = (eventType: string) => {
    if (eventType.includes('created')) return 'bg-emerald-500/10 text-emerald-400'
    if (eventType.includes('deleted')) return 'bg-red-500/10 text-red-400'
    if (eventType.includes('updated') || eventType.includes('adjusted') || eventType.includes('recalculated')) return 'bg-amber-500/10 text-amber-400'
    return 'bg-zinc-500/10 text-zinc-400'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium">Security Event Log</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={e => { setEntityFilter(e.target.value); setPage(0) }}
            className="bg-zinc-800 text-xs text-zinc-300 rounded-lg border border-white/10 px-2 py-1.5 outline-none"
          >
            <option value="">All events</option>
            <option value="account">Accounts</option>
            <option value="wallet">Wallets</option>
            <option value="transaction">Transactions</option>
            <option value="transfer">Transfers</option>
          </select>
          <button onClick={() => { setPage(0); fetchLogs() }}
            className="text-[10px] px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-zinc-600 text-xs">No audit events recorded yet</div>
      ) : (
        <div className="space-y-1">
          {logs.map(log => (
            <div key={log.id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer"
              onClick={() => handleViewDetail(log)}>
              <div className="shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                {EVENT_ICONS[log.event_type] || <Shield className="w-3 h-3 text-zinc-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getBadgeColor(log.event_type)}`}>
                    {log.event_type}
                  </span>
                  <span className="text-xs text-zinc-300 truncate">{log.description}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-zinc-600" />
                  <span className="text-[10px] text-zinc-600">{formatTime(log.created_at)}</span>
                  {log.entity_type && (
                    <span className="text-[10px] text-zinc-700">{log.entity_type}#{log.entity_id}</span>
                  )}
                </div>
              </div>
              <Eye className="w-3 h-3 text-zinc-600 shrink-0" />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-30">
          Previous
        </button>
        <span className="text-[10px] text-zinc-600">Page {page + 1} of {Math.max(1, totalPages)}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
          className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-30">
          Next
        </button>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedLog(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-5 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-zinc-200 font-medium">{selectedLog.event_type}</span>
              <button onClick={() => setSelectedLog(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-4">{selectedLog.description}</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <span className="text-[10px] text-zinc-600">Entity</span>
                <p className="text-xs text-zinc-300">{selectedLog.entity_type} #{selectedLog.entity_id}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-600">Timestamp</span>
                <p className="text-xs text-zinc-300">{formatTime(selectedLog.created_at)}</p>
              </div>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            ) : detailData ? (
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Encrypted Payload</span>
                <div className="bg-black/30 rounded-xl p-3 max-h-60 overflow-y-auto">
                  {Object.entries(detailData).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2 py-0.5">
                      <span className="text-[10px] text-zinc-500 shrink-0 min-w-[24px]">{key}</span>
                      <span className="text-[10px] text-zinc-300 break-all font-mono">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-600 italic">No encrypted payload for this event</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}