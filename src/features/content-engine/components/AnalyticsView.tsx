import { useEffect, useState } from 'react'
import { BarChart3, Bot, ClipboardPaste, Eye, GraduationCap, Heart, MessageSquare, Plus, Sparkles, Target, Trash2, X } from 'lucide-react'
import { AmberButton, Card, Chip, ConfirmIconButton, EmptyState, ErrorState, FieldLabel, GhostButton, LoadingBlock, SectionHeader, SelectInput, TextInput, toast } from './ui'
import { RetentionCurveChart } from './SvgRetentionChart'
import { AnalyticsImportModal } from './AnalyticsImportModal'
import { BulkAIFill } from './BulkAIFill'
import { CalibrationView } from './CalibrationView'
import { ProcessSummaryCard } from './ProcessSummaryCard'
import { BlurFade, BentoCard, NumberTicker } from './ui-laminar'
import { cn } from '@/lib/utils'

const api = () => (window as any).deskflowAPI?.contentEngine

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'shorts', label: 'YouTube Shorts' },
  { id: 'instagram', label: 'Instagram Reels' },
  { id: 'reels', label: 'Reels' },
]

function fmt(n?: number) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function parseCsv(v?: string | null): number[] | null {
  if (!v) return null
  const nums = String(v).split(',').map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n))
  return nums.length > 0 ? nums : null
}

function VideoCard({ video, onChanged }: { video: any; onChanged: () => void }) {
  const [insight, setInsight] = useState<any>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<any[] | null>(null)
  const [reflections, setReflections] = useState<any[]>([])
  const [showReflections, setShowReflections] = useState(false)
  const retention = parseCsv(video.retention_csv) ?? parseCsv(video.retention) ?? null
  const likesRatio = video.views > 0 ? (video.likes / video.views) * 100 : 0

  const loadReflections = async () => {
    try { const res = await api()?.reflectionGet?.({ videoId: video.id }); if (Array.isArray(res)) setReflections(res.slice(-3)) } catch {}
  }

  useEffect(() => { if (showReflections && reflections.length === 0) loadReflections() }, [showReflections])

  const getInsight = async () => {
    if (insightLoading) return
    setInsightLoading(true)
    try { const res = await api()?.analyticsInsight({ videoId: video.id }); if (res?.ok) setInsight(res); else toast(res?.error || 'Insight generation failed', 'error') }
    catch (e: any) { toast(e?.message || 'Insight generation failed', 'error') }
    finally { setInsightLoading(false) }
  }

  const extract = async () => {
    if (extracting) return
    setExtracting(true)
    try { const res = await api()?.lessonExtract({ videoId: video.id }); if (res?.ok) { toast(`Extracted ${Array.isArray(res.lessons) ? res.lessons.length : 0} lessons`); setExtracted(Array.isArray(res.lessons) ? res.lessons : null) } else toast(res?.error || 'Lesson extraction failed', 'error') }
    catch (e: any) { toast(e?.message || 'Lesson extraction failed', 'error') }
    finally { setExtracting(false) }
  }

  const remove = async () => { try { await api()?.analyticsDeleteVideo(video.id); toast('Video removed'); onChanged() } catch (e: any) { toast(e?.message || 'Failed to remove video', 'error') } }

  return (
    <BentoCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-white/20" />
          <span className="truncate text-sm font-semibold text-zinc-100">{video.title || `Video #${video.id}`}</span>
        </div>
        <ConfirmIconButton onConfirm={remove} icon={<Trash2 size={12} />} label="Remove video" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
          <div className="flex items-center gap-1 text-[9px] tracking-wider text-zinc-500 uppercase"><Eye size={10} /> Views</div>
          <div className="mt-0.5 text-base font-bold text-zinc-100"><NumberTicker value={video.views} fontSize={16} /></div>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
          <div className="flex items-center gap-1 text-[9px] tracking-wider text-zinc-500 uppercase"><Heart size={10} /> Likes</div>
          <div className="mt-0.5 text-base font-bold text-zinc-100"><NumberTicker value={video.likes} fontSize={16} /></div>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
          <div className="flex items-center gap-1 text-[9px] tracking-wider text-zinc-500 uppercase"><MessageSquare size={10} /> Comments</div>
          <div className="mt-0.5 text-base font-bold text-zinc-100"><NumberTicker value={video.comments} fontSize={16} /></div>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9px] tracking-wider text-zinc-500 uppercase">Likes ratio</span>
          <span className="font-mono text-[10px] text-zinc-400">{likesRatio.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, likesRatio * 2)}%` }} />
        </div>
      </div>

      {retention && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="mb-1 text-[9px] tracking-wider text-zinc-500 uppercase">Retention curve</div>
          <RetentionCurveChart data={(retention || []).map((v: any, i: number) => ({ t: i, pct: v }))} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <GhostButton onClick={getInsight} disabled={insightLoading}><Sparkles size={13} /> {insightLoading ? 'Analyzing…' : 'Get AI Insight'}</GhostButton>
        <GhostButton onClick={extract} disabled={extracting}><GraduationCap size={13} /> {extracting ? 'Extracting…' : 'Extract Lessons'}</GhostButton>
      </div>

      {insight && (
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-[9px] tracking-wider text-amber-400 uppercase"><Bot size={10} /> AI Insights</div>
          {Array.isArray(insight.insights) && insight.insights.length > 0 ? (
            insight.insights.map((item: any, idx: number) => (
              <div key={idx} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-400">{item.metric}</span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-1">{item.observation}</p>
                <p className="text-[11px] text-zinc-300 mb-1">{item.interpretation}</p>
                <p className="text-[11px] font-medium text-amber-400">{item.action}</p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <p className="text-[11px] leading-relaxed text-zinc-300">{String(insight.insight ?? insight.summary ?? JSON.stringify(insight)).slice(0, 600)}</p>
            </div>
          )}
          {insight.verdict && (
            <div className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase', String(insight.verdict).toLowerCase().includes('fail') ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400')}>{insight.verdict}</div>
          )}
        </div>
      )}

      {extracted && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
          <div className="mb-1 text-[9px] tracking-wider text-cyan-400 uppercase">Extracted lessons</div>
          <ul className="space-y-1">{extracted.map((l: any, i: number) => <li key={i} className="text-[11px] text-zinc-300">{typeof l === 'string' ? l : String(l?.lesson ?? l?.title ?? JSON.stringify(l))}</li>)}</ul>
        </div>
      )}

      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3">
        <button onClick={() => setShowReflections((v) => !v)} className="flex w-full items-center justify-between">
          <span className="text-[9px] tracking-wider text-violet-400 uppercase">Human Reflection Layer</span>
          <span className="text-[10px] text-zinc-500">{showReflections ? 'Hide' : 'Show'}</span>
        </button>
        {showReflections && (
          <div className="mt-2 space-y-2">
            {reflections.length === 0 && <div className="text-[10px] text-zinc-500">No reflections recorded for this video.</div>}
            {reflections.map((r: any, i: number) => (
              <div key={r.id || i} className="space-y-1 rounded-md bg-white/[0.03] px-2.5 py-2">
                {r.analysis?.extracted_pattern && <div className="text-[10px] font-medium text-violet-400">Pattern: {r.analysis.extracted_pattern}</div>}
                {!r.analysis && r.reflection_text && <div className="text-[10px] text-zinc-400 italic line-clamp-2">{String(r.reflection_text).slice(0, 200)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </BentoCard>
  )
}

const emptyForm = () => ({ title: '', platform: 'tiktok', views: '', likes: '', comments: '', retention_csv: '', audience_ages: '', audience_countries: '' })

export function AnalyticsBody({ episodeId }: { episodeId?: number }) {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showCalibration, setShowCalibration] = useState(false)

  const load = async () => {
    setLoading(true); setError(null)
    try { const res = await api()?.analyticsGet({ episodeId }); setVideos(Array.isArray(res?.videos) ? res.videos : Array.isArray(res) ? res : []) }
    catch (e: any) { setError(e?.message || 'Failed to load analytics.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [episodeId])

  const addVideo = async () => {
    if (saving) return
    setSaving(true)
    try {
      const payload: any = { title: form.title.trim() || 'Untitled video', platform: form.platform, views: Number(form.views) || 0, likes: Number(form.likes) || 0, comments: Number(form.comments) || 0 }
      if (form.retention_csv.trim()) payload.retention_csv = form.retention_csv.trim()
      if (episodeId) payload.episode_id = episodeId
      const res = await api()?.analyticsUpsertVideo(payload)
      if (res?.ok) { toast('Video logged'); setShowForm(false); setForm(emptyForm()); load() }
      else toast(res?.error || 'Failed to save video', 'error')
    } catch (e: any) { toast(e?.message || 'Failed to save video', 'error') }
    finally { setSaving(false) }
  }

  const totals = {
    views: videos.reduce((a, v) => a + (Number(v.views) || 0), 0),
    likes: videos.reduce((a, v) => a + (Number(v.likes) || 0), 0),
    comments: videos.reduce((a, v) => a + (Number(v.comments) || 0), 0),
  }

  return (
    <section className="space-y-6">
      <SectionHeader label={episodeId ? 'Content Engine / Analytics · Episode' : 'Content Engine / 05'} title="Analytics" icon={<BarChart3 size={14} className="text-white/70" />}
        action={
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setShowImport(true)}><ClipboardPaste size={13} /> Import Raw</GhostButton>
            <AmberButton onClick={() => setShowForm((v) => !v)}>{showForm ? <X size={13} /> : <Plus size={13} />}{showForm ? 'Close' : 'Log Video'}</AmberButton>
          </div>
        }
      />

      {!loading && !error && videos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Videos', value: String(videos.length) },
            { label: 'Total views', value: fmt(totals.views) },
            { label: 'Avg views', value: fmt(Math.round(totals.views / videos.length)) },
          ].map((s) => (
            <BentoCard key={s.label} className="p-3">
              <div className="text-[9px] tracking-wider text-zinc-500 uppercase">{s.label}</div>
              <div className="mt-1 text-lg font-bold text-zinc-100">{s.value}</div>
            </BentoCard>
          ))}
        </div>
      )}

      {showForm && (
        <BentoCard className="border-amber-500/20">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-semibold tracking-wider text-amber-400 uppercase">Log video{episodeId ? ` for episode ${episodeId}` : ''}</div>
            <BulkAIFill
              fields={[
                { id: 'title', label: 'Video Title', value: form.title, placeholder: 'Video title' },
                { id: 'retention_csv', label: 'Retention Data', value: form.retention_csv, placeholder: '100,80,62,55,48' },
                { id: 'views', label: 'Views', value: form.views, placeholder: '0' },
                { id: 'likes', label: 'Likes', value: form.likes, placeholder: '0' },
                { id: 'comments', label: 'Comments', value: form.comments, placeholder: '0' },
              ]}
              onFill={(updates) => setForm({ ...form, ...updates })}
              category="content-engine"
              context="Help fill in video analytics data based on the conversation"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><FieldLabel>Title</FieldLabel><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Video title" /></div>
            <div><FieldLabel>Platform</FieldLabel><SelectInput value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</SelectInput></div>
            <div><FieldLabel>Retention CSV (comma-separated)</FieldLabel><TextInput value={form.retention_csv} onChange={(e) => setForm({ ...form, retention_csv: e.target.value })} placeholder="100,80,62,55,48" /></div>
            <div><FieldLabel>Views</FieldLabel><TextInput value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} placeholder="0" /></div>
            <div><FieldLabel>Likes</FieldLabel><TextInput value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} placeholder="0" /></div>
            <div><FieldLabel>Comments</FieldLabel><TextInput value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="0" /></div>
          </div>
          <div className="mt-3"><AmberButton onClick={addVideo} disabled={saving}>{saving ? 'Saving…' : 'Save Video'}</AmberButton></div>
        </BentoCard>
      )}

      {loading && <LoadingBlock label="Loading analytics…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && videos.length === 0 && <EmptyState icon={<BarChart3 size={28} />} title="No videos logged yet" hint="Log your first upload to start building retention intelligence." action={<AmberButton onClick={() => setShowForm(true)}><Plus size={13} /> Log Video</AmberButton>} />}

      {!loading && !error && videos.length > 0 && (
        <div className="grid grid-cols-2 gap-4">{videos.map((v) => <VideoCard key={v.id ?? v.title} video={v} onChanged={load} />)}</div>
      )}

      {episodeId && (
        <div className="border-t border-white/[0.08] pt-6">
          <button onClick={() => setShowCalibration((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] p-4 transition-colors hover:bg-white/[0.04]">
            <div className="flex items-center gap-2"><Target size={14} className="text-amber-400" /><span className="text-xs font-semibold text-zinc-100">Score Calibration</span><span className="text-[10px] text-zinc-500">— accuracy per criterion</span></div>
            <span className="text-[10px] text-zinc-500">{showCalibration ? 'Collapse' : 'Expand'}</span>
          </button>
          {showCalibration && <div className="mt-3"><CalibrationView episodeId={episodeId} /></div>}
        </div>
      )}

      {episodeId && <div className="border-t border-white/[0.08] pt-6"><ProcessSummaryCard episodeId={episodeId} /></div>}

      <AnalyticsImportModal episodeId={episodeId} open={showImport} onClose={() => setShowImport(false)} onImported={load} />
    </section>
  )
}

export function AnalyticsView() {
  return <AnalyticsBody />
}
