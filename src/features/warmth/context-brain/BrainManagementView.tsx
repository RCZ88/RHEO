/**
 * BrainManagementView — Full management UI for the Context Brain
 *
 * Spec §24: episodes, entities, facts, extraction jobs, manual entry,
 * stats, MCP status.
 *
 * v2.0 — MCP inventory pass: NumberTicker stats, Particles + DotPattern
 * backdrop, BlurFade lists, Skeleton loading states, and the missing
 * FACTS tab (Phase 6 #3 — Fact history via brainGetFacts).
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database, Search, Filter, ChevronDown, ChevronRight, RefreshCw,
  Clock, AlertCircle, CheckCircle2, SkipForward, RotateCcw,
  Plus, Send, Server, Zap, BookOpen, Tag, Hash, Activity,
  Brain, Link2, Sparkles,
} from 'lucide-react'
import { NumberTicker } from '../../../components/ui/number-ticker'
import { Particles } from '../../../components/ui/particles'
import { DotPattern } from '../../../components/ui/dot-pattern'
import { BlurFade } from '../../../components/ui/blur-fade'
import { Skeleton } from '../../../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs'

import { ACCENTS } from '../ContextGraphView'

const api = () => (window as any).deskflowAPI

const cardBg    = 'rgba(24,24,27,0.55)'
const cardBorder = '1px solid rgba(255,255,255,0.06)'
const inputBg   = 'rgba(24,24,27,0.6)'
const inputBorder = '1px solid rgba(255,255,255,0.08)'
const ACCENT    = ACCENTS.purple
const FAINT     = ACCENTS.slate
const SECONDARY = ACCENTS.secondary
const PRIMARY   = ACCENTS.primary
const MUTED     = ACCENTS.muted

// ═══ Stats Card (NumberTicker) ═══
function StatsBar({ stats, loading }: { stats: any; loading: boolean }) {
  const items = [
    { label: 'Episodes', value: stats?.episodes ?? 0, color: ACCENT },
    { label: 'Entities', value: stats?.entities ?? 0, color: '#22c55e' },
    { label: 'Current Facts', value: stats?.currentFacts ?? 0, color: '#eab308' },
    { label: 'Total Facts', value: stats?.facts ?? 0, color: '#06b6d4' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl p-4 relative overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
          <DotPattern opacity={0.06} radius={0.8} gap={16} className="text-current" />
          <div className="text-lg font-bold font-mono relative" style={{ color: it.color }}>
            {loading ? <Skeleton className="h-5 w-12" /> : <NumberTicker value={it.value} />}
          </div>
          <div className="text-[10px] uppercase tracking-wider mt-0.5 relative" style={{ color: FAINT }}>{it.label}</div>
        </div>
      ))}
    </div>
  )
}

// ═══ Episode List ═══
function EpisodeList() {
  const [episodes, setEpisodes] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api()?.brainGetEpisodes?.({ source: sourceFilter, search, limit, offset: page * limit })
    if (data) { setEpisodes(data.items || []); setTotal(data.total || 0) }
    setLoading(false)
  }, [sourceFilter, search, page])

  useEffect(() => { load() }, [load])

  const sources = ['all', 'goals', 'finance', 'deadlines', 'life_phase', 'connector', 'deskflow_ai', 'terminal', 'manual', 'external_ai']

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: FAINT }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search episodes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs"
            style={{ background: inputBg, border: inputBorder, color: PRIMARY }} />
        </div>
        <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(0) }}
          className="px-2 py-2 rounded-lg text-xs"
          style={{ background: inputBg, border: inputBorder, color: SECONDARY }}>
          {sources.map(s => <option key={s} value={s}>{s === 'all' ? 'All sources' : s}</option>)}
        </select>
      </div>
      <div className="text-[10px]" style={{ color: FAINT }}>{total} episodes total</div>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {loading && (
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        )}
        {!loading && episodes.length === 0 && (
          <div className="text-xs py-8 text-center" style={{ color: FAINT }}>
            <BookOpen size={16} className="mx-auto mb-2 opacity-40" />
            No episodes match your filters
          </div>
        )}
        {episodes.map((ep: any, i) => (
          <BlurFade key={ep.id} delay={Math.min(i * 0.03, 0.3)} duration={0.3} className="rounded-lg">
            <div className="rounded-lg p-2.5 transition-colors hover:border-white/10" style={{ background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <button onClick={() => setExpanded(p => { const n = new Set(p); n.has(ep.id) ? n.delete(ep.id) : n.add(ep.id); return n })} className="w-full flex items-center gap-2 text-left">
                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(139,92,246,0.15)', color: ACCENT }}>{ep.source}</span>
                <span className="text-xs flex-1 truncate" style={{ color: SECONDARY }}>{ep.content.slice(0, 100)}</span>
                {ep.extractionStatus === 'completed' && <CheckCircle2 size={11} style={{ color: '#22c55e' }} />}
                {ep.extractionStatus === 'failed' && <AlertCircle size={11} style={{ color: '#ef4444' }} />}
                {ep.extractionStatus === 'pending' && <Clock size={11} style={{ color: '#eab308' }} />}
                <span className="text-[10px] shrink-0" style={{ color: FAINT }}>{new Date(ep.occurredAt).toLocaleDateString()}</span>
              </button>
              <AnimatePresence>
                {expanded.has(ep.id) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                    <div className="mt-2 p-2 rounded text-[11px] whitespace-pre-wrap" style={{ background: 'rgba(0,0,0,0.2)', color: MUTED }}>{ep.content}</div>
                    <div className="mt-1 text-[10px]" style={{ color: FAINT }}>ID: {ep.id}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </BlurFade>
        ))}
      </div>
      {total > limit && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded text-[11px] transition-colors" style={{ background: 'rgba(255,255,255,0.05)', color: page === 0 ? FAINT : SECONDARY }}>Prev</button>
          <span className="text-[10px] py-1" style={{ color: FAINT }}>Page {page + 1} of {Math.ceil(total / limit)}</span>
          <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded text-[11px] transition-colors" style={{ background: 'rgba(255,255,255,0.05)', color: (page + 1) * limit >= total ? FAINT : SECONDARY }}>Next</button>
        </div>
      )}
    </div>
  )
}

// ═══ Entity List ═══
function EntityList() {
  const [entities, setEntities] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [related, setRelated] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const types = ['all', 'goal', 'project', 'deadline', 'person', 'tool', 'concept', 'life_phase', 'finance_item', 'application', 'connector', 'terminal_session']

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api()?.brainGetEntities?.({ type: typeFilter, search, limit: 50 })
    if (data) { setEntities(data.items || []); setTotal(data.total || 0) }
    setLoading(false)
  }, [typeFilter, search])

  useEffect(() => { load() }, [load])

  const selectEntity = async (e: any) => {
    setSelected(e)
    const rel = await api()?.brainGetEntityRelated?.(e.id)
    setRelated(rel || [])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: FAINT }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs"
            style={{ background: inputBg, border: inputBorder, color: PRIMARY }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-2 py-2 rounded-lg text-xs"
          style={{ background: inputBg, border: inputBorder, color: SECONDARY }}>
          {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
        </select>
      </div>
      <div className="text-[10px]" style={{ color: FAINT }}>{total} entities</div>
      {loading && <div className="grid grid-cols-2 gap-2"><Skeleton className="h-16 w-full rounded-lg" /><Skeleton className="h-16 w-full rounded-lg" /><Skeleton className="h-16 w-full rounded-lg" /><Skeleton className="h-16 w-full rounded-lg" /></div>}
      {!loading && entities.length === 0 && (
        <div className="text-xs py-8 text-center" style={{ color: FAINT }}>
          <Tag size={16} className="mx-auto mb-2 opacity-40" />
          No entities found
        </div>
      )}
      {!loading && (
        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {entities.map((e: any) => (
            <button key={e.id} onClick={() => selectEntity(e)}
              className="text-left p-2.5 rounded-lg transition-colors"
              style={{ background: selected?.id === e.id ? 'rgba(139,92,246,0.15)' : 'rgba(24,24,27,0.4)', border: `1px solid ${selected?.id === e.id ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.04)'}` }}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: FAINT }}>{e.type}</span>
                <span className="text-xs truncate" style={{ color: SECONDARY }}>{e.name}</span>
              </div>
              <div className="text-[10px] mt-1" style={{ color: FAINT }}>{e.factCount} facts · {e.aliases?.length || 0} aliases</div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="rounded-xl p-3" style={{ background: cardBg, border: cardBorder }}>
          <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: SECONDARY }}>
            <Link2 size={11} style={{ color: ACCENT }} /> Related Episodes
          </div>
          {related.length === 0 && <div className="text-[11px]" style={{ color: FAINT }}>No related episodes yet</div>}
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {related.map((ep: any) => (
              <div key={ep.id} className="text-[11px] p-2 rounded" style={{ background: 'rgba(0,0,0,0.15)', color: MUTED }}>
                <span className="text-[10px] mr-1.5" style={{ color: FAINT }}>{ep.source}</span>
                {ep.content.slice(0, 120)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ Facts Tab (Phase 6 #3 — Fact history) ═══
function FactsTab() {
  const [facts, setFacts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [currentOnly, setCurrentOnly] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api()?.brainGetFacts?.({
      currentOnly,
      subjectId: subjectFilter.trim() || undefined,
      limit,
      offset: page * limit,
    })
    if (data) { setFacts(data.items || []); setTotal(data.total || 0) }
    setLoading(false)
  }, [currentOnly, subjectFilter, page])

  useEffect(() => { load() }, [load])

  const confidenceColor = (c: number) =>
    c >= 0.8 ? '#22c55e' : c >= 0.5 ? '#eab308' : '#ef4444'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: FAINT }} />
          <input value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); setPage(0) }}
            placeholder="Filter by subject ID (e.g. ent_goal_fitness)..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs"
            style={{ background: inputBg, border: inputBorder, color: PRIMARY }} />
        </div>
        <button onClick={() => { setCurrentOnly(v => !v); setPage(0) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: currentOnly ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)',
            color: currentOnly ? '#06b6d4' : FAINT,
            border: `1px solid ${currentOnly ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.06)'}`,
          }}>
          <Activity size={11} /> {currentOnly ? 'Current only' : 'Full history'}
        </button>
      </div>
      <div className="text-[10px]" style={{ color: FAINT }}>
        {total} fact{total === 1 ? '' : 's'} · bitemporal {currentOnly ? '(superseded facts hidden)' : '(superseded facts included)'}
      </div>
      {loading && <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>}
      {!loading && facts.length === 0 && (
        <div className="text-xs py-8 text-center" style={{ color: FAINT }}>
          <Hash size={16} className="mx-auto mb-2 opacity-40" />
          No facts yet — they appear as LLM extraction processes your episodes
        </div>
      )}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {facts.map((f: any) => (
          <BlurFade key={f.id} duration={0.3} className="rounded-lg">
            <div className="rounded-lg p-2.5 transition-colors hover:border-white/10" style={{ background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <button onClick={() => setExpanded(p => { const n = new Set(p); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n })} className="w-full flex items-center gap-2 text-left">
                <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>{f.predicate}</span>
                <span className="text-xs flex-1 truncate" style={{ color: SECONDARY }}>
                  {f.subjectId} {f.predicate} {f.objectLiteral ?? f.objectId ?? '—'}
                </span>
                <span className="text-[10px] font-mono shrink-0" style={{ color: confidenceColor(f.confidence) }}>{Math.round(f.confidence * 100)}%</span>
                {f.validTo ? <Clock size={10} style={{ color: FAINT }} /> : <CheckCircle2 size={10} style={{ color: '#22c55e' }} />}
              </button>
              <AnimatePresence>
                {expanded.has(f.id) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]" style={{ color: FAINT }}>
                      <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Subject: <span className="font-mono">{f.subjectId}</span></div>
                      <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Object: <span className="font-mono">{f.objectLiteral ?? f.objectId ?? '—'}</span></div>
                      <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Valid from: {new Date(f.validFrom).toLocaleString()}</div>
                      <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>Valid to: {f.validTo ? new Date(f.validTo).toLocaleString() : 'current'}</div>
                      <div className="p-1.5 rounded col-span-2" style={{ background: 'rgba(0,0,0,0.2)' }}>Source episode: <span className="font-mono">{f.sourceEpisodeId}</span></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </BlurFade>
        ))}
      </div>
      {total > limit && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded text-[11px] transition-colors" style={{ background: 'rgba(255,255,255,0.05)', color: page === 0 ? FAINT : SECONDARY }}>Prev</button>
          <span className="text-[10px] py-1" style={{ color: FAINT }}>Page {page + 1} of {Math.ceil(total / limit)}</span>
          <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded text-[11px] transition-colors" style={{ background: 'rgba(255,255,255,0.05)', color: (page + 1) * limit >= total ? FAINT : SECONDARY }}>Next</button>
        </div>
      )}
    </div>
  )
}

// ═══ Extraction Jobs Panel ═══
function ExtractionJobsPanel() {
  const [jobs, setJobs] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [mcp, setMcp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api()?.brainGetJobs?.()
    if (data) { setJobs(data.jobs || []); setStats(data.stats || {}) }
    const m = await api()?.brainMcpStatus?.()
    setMcp(m)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleRetry = async (jobId: string) => {
    await api()?.brainRetryJob?.(jobId)
    load()
  }

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle2 size={11} style={{ color: '#22c55e' }} />
    if (s === 'failed') return <AlertCircle size={11} style={{ color: '#ef4444' }} />
    if (s === 'processing') return <Zap size={11} style={{ color: '#eab308' }} />
    if (s === 'skipped') return <SkipForward size={11} style={{ color: FAINT }} />
    return <Clock size={11} style={{ color: '#eab308' }} />
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
          <DotPattern opacity={0.06} radius={0.8} gap={16} />
          <div className="text-[10px] mb-1 uppercase tracking-wider" style={{ color: FAINT }}>MCP Server</div>
          {loading ? <Skeleton className="h-4 w-24" /> : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: mcp?.running ? '#22c55e' : '#ef4444', boxShadow: mcp?.running ? '0 0 8px rgba(34,197,94,0.6)' : 'none' }} />
              <span className="text-xs" style={{ color: SECONDARY }}>{mcp?.running ? `Port ${mcp.port}` : 'Offline'}</span>
            </div>
          )}
        </div>
        <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
          <DotPattern opacity={0.06} radius={0.8} gap={16} />
          <div className="text-[10px] mb-1 uppercase tracking-wider" style={{ color: FAINT }}>Job Queue</div>
          <div className="text-xs" style={{ color: SECONDARY }}>
            <span className="font-mono" style={{ color: '#eab308' }}>{stats.pending || 0}</span> pending ·
            <span className="font-mono ml-1" style={{ color: '#22c55e' }}>{stats.completed || 0}</span> done ·
            <span className="font-mono ml-1" style={{ color: '#ef4444' }}>{stats.failed || 0}</span> failed
          </div>
        </div>
      </div>
      {loading && <div className="space-y-1.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>}
      <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
        {jobs.slice(0, 30).map((j: any) => (
          <div key={j.id} className="flex items-center gap-2 p-2 rounded-lg transition-colors hover:border-white/10" style={{ background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
            {statusIcon(j.status)}
            <span className="text-[10px] flex-1 truncate font-mono" style={{ color: SECONDARY }}>{j.episodeId}</span>
            <span className="text-[10px]" style={{ color: FAINT }}>{j.status}</span>
            {j.status === 'failed' && (
              <button onClick={() => handleRetry(j.id)} className="p-1 rounded transition-colors hover:bg-red-500/20" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <RotateCcw size={10} style={{ color: '#ef4444' }} />
              </button>
            )}
          </div>
        ))}
        {!loading && jobs.length === 0 && (
          <div className="text-xs py-4 text-center" style={{ color: FAINT }}>
            <Sparkles size={16} className="mx-auto mb-2 opacity-40" />
            No extraction jobs yet
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ Manual Episode Form ═══
function ManualEpisodeForm({ onCreated }: { onCreated: () => void }) {
  const [source, setSource] = useState('manual')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSending(true)
    setResult(null)
    const res = await api()?.brainCreateEpisode?.({ source, content: content.trim() })
    setResult(res?.ok ? `Created: ${res.episodeId}` : 'Failed')
    setContent('')
    setSending(false)
    onCreated()
  }

  return (
    <div className="rounded-xl p-4 space-y-3 relative overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
      <DotPattern opacity={0.05} radius={0.8} gap={20} className="text-[#8b5cf6]" />
      <div className="flex items-center gap-2 relative">
        <Plus size={14} style={{ color: ACCENT }} />
        <span className="text-xs font-medium" style={{ color: SECONDARY }}>Manual Episode</span>
      </div>
      <div className="flex gap-2 relative">
        <select value={source} onChange={e => setSource(e.target.value)}
          className="px-2 py-2 rounded-lg text-xs"
          style={{ background: inputBg, border: inputBorder, color: SECONDARY }}>
          <option value="manual">manual</option>
          <option value="reflection">reflection</option>
          <option value="external_ai">external_ai</option>
          <option value="voice_note">voice_note</option>
        </select>
        <input value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="What happened? (will be queued for LLM extraction)"
          className="flex-1 px-3 py-2 rounded-lg text-xs"
          style={{ background: inputBg, border: inputBorder, color: PRIMARY }} />
        <button onClick={handleSubmit} disabled={sending || !content.trim()}
          className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          style={{ background: content.trim() ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)', color: content.trim() ? ACCENT : FAINT }}>
          <Send size={11} /> {sending ? '...' : 'Log'}
        </button>
      </div>
      {result && <div className="text-[10px] relative" style={{ color: result.startsWith('Created') ? '#22c55e' : '#ef4444' }}>{result}</div>}
    </div>
  )
}

// ═══ Main View ═══
export function BrainManagementView() {
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [tab, setTab] = useState<'episodes' | 'entities' | 'facts' | 'jobs'>('episodes')
  const [refreshKey, setRefreshKey] = useState(0)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    const s = await api()?.brainStats?.()
    setStats(s)
    setStatsLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats, refreshKey])

  const tabs = [
    { key: 'episodes', label: 'Episodes', icon: BookOpen },
    { key: 'entities', label: 'Entities', icon: Tag },
    { key: 'facts', label: 'Facts', icon: Hash },
    { key: 'jobs', label: 'Jobs & MCP', icon: Zap },
  ] as const

  return (
    <div className="space-y-4 relative">
      <div className="pointer-events-none absolute -top-10 -right-6 w-72 h-72 opacity-[0.07]" aria-hidden>
        <Particles quantity={22} color="#8b5cf6" opacity={0.9} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <Brain size={16} style={{ color: ACCENT }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: PRIMARY }}>Context Brain</h3>
            <div className="text-[10px]" style={{ color: FAINT }}>Episodes → entities → facts, with LLM extraction jobs & MCP bridge</div>
          </div>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[rgba(139,92,246,0.2)]" style={{ background: 'rgba(139,92,246,0.1)', color: ACCENT, border: '1px solid rgba(139,92,246,0.2)' }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      <StatsBar stats={stats} loading={statsLoading} />

      <ManualEpisodeForm onCreated={() => setRefreshKey(k => k + 1)} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {tabs.map(t => (
            <TabsTrigger key={t.key} value={t.key}>
              <t.icon size={12} /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div key={refreshKey}>
          <TabsContent value="episodes"><EpisodeList /></TabsContent>
          <TabsContent value="entities"><EntityList /></TabsContent>
          <TabsContent value="facts"><FactsTab /></TabsContent>
          <TabsContent value="jobs"><ExtractionJobsPanel /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
