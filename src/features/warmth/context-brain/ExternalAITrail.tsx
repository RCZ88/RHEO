import { useState, useEffect, useCallback } from 'react'
import { Wireless, ExternalLink, Clock, ChevronRight, BookOpen, Zap, User, Brain, FileText } from 'lucide-react'

// ── Shared accents (mirrors ContextGraphView.tsx) ──
const ACCENTS = {
  purple:  '#8b5cf6',
  green:   '#22c55e',
  amber:   '#f59e0b',
  cyan:    '#06b6d4',
  rose:    '#f43f5e',
  slate:   '#71717a',
}

// ── Provider color map (matches brain entity types + AI providers) ──
const PROVIDER_COLORS: Record<string, string> = {
  chatgpt:   '#f97316',
  claude:    '#8b5cf6',
  gemini:    '#06b6d4',
  deepseek:  '#22c55e',
  copilot:   '#3b82f6',
  llama:     '#a78bfa',
  default:   '#71717a',
}

function providerColor(provider: string | undefined): string {
  if (!provider) return PROVIDER_COLORS.default
  const key = provider.toLowerCase().replace(/\s+/g, '')
  return PROVIDER_COLORS[key] || PROVIDER_COLORS.default
}

export function ExternalAITrail() {
  const [sessions, setSessions] = useState<
    Array<{
      id: string
      provider: string
      title: string
      timestamp: string
      entityCount: number
      factCount: number
      isActive: boolean
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      const api = (window as any).deskflowAPI
      if (api?.aiContextCaptures) {
        const data = await api.aiContextCaptures({ limit: 8, recentFirst: true })
        if (data?.sessions) {
          setSessions(data.sessions.map((s: any) => ({
            id: s.id || s.sessionId,
            provider: s.provider || 'Unknown',
            title: s.title || `${s.provider} session`,
            timestamp: s.timestamp || new Date().toISOString(),
            entityCount: s.entityCount || 0,
            factCount: s.factCount || 0,
            isActive: !!s.isActive,
          })))
        }
      } else {
        setError('AI context capture not available')
      }
    } catch (e) {
      console.error('[ExternalAITrail] Failed to load:', e)
      setError('Failed to load external AI sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => {
    const ref = setInterval(loadSessions, 60_000)
    return () => clearInterval(ref)
  }, [loadSessions])

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const emptyState = (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${ACCENTS.purple}12`, border: `1px solid ${ACCENTS.purple}20` }}>
        <Brain size={14} style={{ color: ACCENTS.purple }} />
      </div>
      <p className="text-[11px] text-zinc-500 text-center max-w-[200px]">
        No external AI sessions captured yet. Chat with the AI and the extension will track the session here.
      </p>
    </div>
  )

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm p-4 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-500 rounded-full animate-spin" />
          <span className="text-[11px] text-zinc-500">Loading external AI feed…</span>
        </div>
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || sessions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={13} style={{ color: ACCENTS.purple }} />
          <span className="text-[12px] font-semibold text-zinc-300">External AI Feed</span>
        </div>
        {emptyState}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${ACCENTS.cyan}15`, border: `1px solid ${ACCENTS.cyan}20` }}>
            <Brain size={12} style={{ color: ACCENTS.cyan }} />
          </div>
          <span className="text-[12px] font-semibold text-zinc-300">External AI Feed</span>
          {sessions.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${ACCENTS.cyan}10`, color: ACCENTS.cyan }}>
              {sessions.length}
            </span>
          )}
        </div>
        <button
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          onClick={loadSessions}
        >
          <RefreshCw size={10} className="animate-spin-slow" /> Refresh
        </button>
      </div>

      {/* Sessions list */}
      <div className="space-y-1.5">
        {sessions.map((sess, idx) => {
          const color = providerColor(sess.provider)
          const isNew = sess.isActive || idx < 2

          return (
            <div
              key={sess.id}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all cursor-default ${
                isNew ? 'bg-zinc-800/30 border border-zinc-700/40' : 'hover:bg-zinc-800/20'
              }`}
              style={
                isNew
                  ? { boxShadow: `0 0 0 1px ${color}15, 0 0 12px ${color}08` }
                  : undefined
              }
            >
              {/* Provider dot */}
              <div
                className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
              />

              {/* Provider icon wrapper */}
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${color}12`, border: `1px solid ${color}20` }}
              >
                <ExternalLink size={10} style={{ color }} />
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] truncate ${isNew ? 'font-medium text-zinc-200' : 'text-zinc-400'}`}>
                    {sess.title}
                  </span>
                  {isNew && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENTS.green, boxShadow: `0 0 4px ${ACCENTS.green}80` }} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-zinc-600 font-mono">{timeAgo(sess.timestamp)}</span>
                  <span className="text-[10px] text-zinc-600">·</span>
                  <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                    <Brain size={8} style={{ color: ACCENTS.purple }} />
                    {sess.entityCount} entities
                  </span>
                  {sess.factCount > 0 && (
                    <>
                      <span className="text-[10px] text-zinc-600">·</span>
                      <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                        <FileText size={8} style={{ color: ACCENTS.amber }} />
                        {sess.factCount} facts
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight size={12} className="text-zinc-600 shrink-0" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Simple refresh icon (animated spin when needed)
function RefreshCw({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}
