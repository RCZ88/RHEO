import { useEffect, useState } from 'react'
import { useContentEngine } from '../ContentEngineContext'
import { BarChart3, Bot, CheckCircle2, ChevronLeft, Clapperboard, FileSearch, FileText, Film, Plus, RefreshCw, Search, ShieldCheck, ShieldX, Sparkles, Trash2, TrendingUp, Wand2, X, ExternalLink, ClipboardPaste, Check, Zap, Route } from 'lucide-react'
import type { ScriptFrame, ScoringSchemeInfo, FrameScoreBreakdown } from '@/types/deskflow-api'
import { AmberButton, Card, Chip, ConfirmIconButton, EmptyState, ErrorState, FieldLabel, GhostButton, LoadingBlock, SectionHeader, SelectInput, StatusChip, TextArea, TextInput, toast } from './ui'
import { BridgeField } from '@/components/ai-bridge/BridgeField'
import { RetentionPanel } from './RetentionPanel'
import { RetentionCurveChart } from './SvgRetentionChart'
import { AnalyticsBody } from './AnalyticsView'
import { ScriptProofCard } from './ScriptProofCard'
import { EpisodeScoreSummary } from './EpisodeScoreSummary'
import { PhaseStepper } from './PhaseStepper'
import { GreenLightPanel } from './GreenLightPanel'
import { CaptureView } from './CaptureView'
import { AssembleView } from './AssembleView'
import { LearnView } from './LearnView'
import { OverlayAssignmentPanel } from './OverlayAssignmentPanel'
import { TemplateSelector } from './TemplateSelector'
import { PipelineView } from './PipelineView'
import { HookStackDisplay } from './HookStackDisplay'
import { CuriosityGapBridge } from './CuriosityGapBridge'
import { KeywordSEOPanel } from './KeywordSEOPanel'
import { PlanningModeSelector } from './PlanningModeSelector'
import { PromptBuilder } from './PromptBuilder'
import { DynamicPipeline } from './DynamicPipeline'
import { BlurFade, BentoCard, StatusChip as StatusChipL } from './ui-laminar'
import { cn } from '@/lib/utils'

const api = () => (window as any).deskflowAPI?.contentEngine

const TABS = [
  { id: 'script', label: 'Script', Icon: FileText },
  { id: 'pipeline', label: 'Pipeline', Icon: Route },
  { id: 'seo', label: 'SEO', Icon: FileSearch },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { id: 'assets', label: 'Assets', Icon: Film },
  { id: 'metrics', label: 'Metrics', Icon: TrendingUp },
] as const

type TabId = (typeof TABS)[number]['id']

const FRAME_TYPE_COLORS: Record<string, string> = {
  hook: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  value: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-400',
  transition: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
  call_to_action: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  visual_only: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
}

function fmtSec(s?: number | null) {
  if (s == null || !Number.isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function frameCurve(retention: any): Array<{ t: number; pct: number }> | null {
  if (!retention) return null
  if (Array.isArray(retention.curve)) return retention.curve.filter((p: any) => p && typeof p.t === 'number' && typeof p.pct === 'number')
  if (Array.isArray(retention.csv)) return retention.csv.map((v: any, i: number) => ({ t: i, pct: Number(v) }))
  return null
}

function FrameCard({ frame, index, epId, onRegenerated }: { frame: any; index: number; epId: number; onRegenerated: (frame: any) => void }) {
  const [regenMode, setRegenMode] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [regenLoading, setRegenLoading] = useState(false)
  const [proving, setProving] = useState(false)
  const [proveResult, setProveResult] = useState<any>(null)
  const frameType = frame.frame_type || 'value'
  const curve = frameCurve(frame.retention)

  const regenerate = async () => {
    if (regenLoading) return
    setRegenLoading(true)
    try {
      const res = await api()?.scriptRegenerateLine({ episodeId: epId, frameIndex: index, instruction: instruction.trim() })
      if (res?.ok) { const next = res.frame ?? res.line ?? res; toast(`Frame ${index + 1} regenerated`); onRegenerated(next); setRegenMode(false); setInstruction('') }
      else toast(res?.error || 'Regeneration failed', 'error')
    } catch (e: any) { toast(e?.message || 'Regeneration failed', 'error') }
    finally { setRegenLoading(false) }
  }

  const prove = async () => {
    if (proving) return
    setProving(true); setProveResult(null)
    try {
      const res = await api()?.validateScriptEvidence({ episodeId: epId })
      const list = Array.isArray(res?.results) ? res.results : Array.isArray(res?.validations) ? res.validations : []
      const mine = list.find((r: any) => (r.frame_index ?? r.frameIndex) === index) ?? list[index]
      setProveResult(mine ? { pass: mine.pass ?? mine.valid, reasons: mine.reasons ?? mine.reason, score: mine.score, evidence: mine.evidence } : null)
      if (!mine) toast('No per-frame verdict returned — check the batch result below', 'error')
    } catch (e: any) { toast(e?.message || 'Validation failed', 'error') }
    finally { setProving(false) }
  }

  return (
    <BentoCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{index + 1}</span>
          <span className="font-mono text-[10px] text-zinc-500">{fmtSec(frame.duration_seconds ?? frame.duration)}</span>
          <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase', FRAME_TYPE_COLORS[frameType] || FRAME_TYPE_COLORS.value)}>{frameType}</span>
        </div>
        <div className="flex items-center gap-1">
          <GhostButton className="h-6 px-1.5 text-[10px]" onClick={() => setRegenMode((v) => !v)}><RefreshCw size={11} /> {regenMode ? 'Cancel' : 'Regenerate'}</GhostButton>
          <GhostButton className="h-6 px-1.5 text-[10px]" onClick={prove} disabled={proving}><Bot size={11} /> {proving ? '…' : 'AI Prove it'}</GhostButton>
        </div>
      </div>
      {frame.visual && <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5"><span className="text-[9px] font-medium tracking-wider text-cyan-400 uppercase">Visual</span><p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">{frame.visual}</p></div>}
      <p className="text-sm leading-relaxed text-zinc-100">{frame.text}</p>
      {regenMode && <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3"><div className="flex items-center gap-2"><FieldLabel>Regeneration instruction</FieldLabel><CopyPromptButton fieldKey="episode-frame" /></div><TextArea rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Make it punchier, cut 3 words, open with a question…" /><div className="mt-2"><AmberButton onClick={regenerate} disabled={regenLoading || !instruction.trim()}><Wand2 size={13} /> {regenLoading ? 'Rewriting…' : 'Rewrite Frame'}</AmberButton></div></div>}
      {proveResult && <div className={cn('rounded-lg border p-3', proveResult.pass ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-rose-500/20 bg-rose-500/[0.04]')}><div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">{proveResult.pass ? <CheckCircle2 size={12} className="text-emerald-400" /> : <X size={12} className="text-rose-400" />}<span className={proveResult.pass ? 'text-emerald-400' : 'text-rose-400'}>{proveResult.pass ? 'Evidence passes' : 'Evidence fails'}</span>{proveResult.score != null && <span className="ml-auto font-mono text-zinc-500">{Math.round(proveResult.score * 100)}%</span>}</div></div>}
      <RetentionPanel retention={frame.retention} />
      {curve && <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"><div className="mb-1 text-[9px] tracking-wider text-zinc-500 uppercase">Expected retention</div><RetentionCurveChart data={curve} height={110} /></div>}
    </BentoCard>
  )
}

function EpisodeDetail({ ep, onBack, onChanged }: { ep: any; onBack: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<TabId>('script')
  const [frames, setFrames] = useState<ScriptFrame[]>(Array.isArray(ep.script?.frames) ? ep.script.frames : [])
  const [scriptText, setScriptText] = useState<string>(typeof ep.script === 'string' ? ep.script : '')
  const [themes, setThemes] = useState<any[]>([])
  const [themeId, setThemeId] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validateResults, setValidateResults] = useState<any[] | null>(null)
  const [seo, setSeo] = useState<any>(ep.seo ?? null)
  const [injecting, setInjecting] = useState(false)
  const [override, setOverride] = useState(!!ep.gate_override)
  const [savingOverride, setSavingOverride] = useState(false)
  const [title, setTitle] = useState(ep.title || '')
  const [currentPhase, setCurrentPhase] = useState<string>(ep.phase || ep.status || 'draft')
  const [takeCount, setTakeCount] = useState(0)
  const [evaluatedCount, setEvaluatedCount] = useState(0)
  const [scoringScheme, setScoringScheme] = useState<ScoringSchemeInfo | null>(null)
  const [scoringBreakdown, setScoringBreakdown] = useState<FrameScoreBreakdown[]>([])
  const [scoringAverage, setScoringAverage] = useState(0)
  const [scoringThreshold, setScoringThreshold] = useState(0.6)
  const [scoringVersion, setScoringVersion] = useState('1.0.0')
  const [scoringLoading, setScoringLoading] = useState(false)
  const [rejectedFrames, setRejectedFrames] = useState<Set<number>>(new Set())
  const [seriesInfo, setSeriesInfo] = useState<any>(null)
  const [externalMode, setExternalMode] = useState(false)
  const [externalPrompt, setExternalPrompt] = useState('')
  const [externalPaste, setExternalPaste] = useState('')
  const [externalImporting, setExternalImporting] = useState(false)
  const [externalSending, setExternalSending] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [frameMode, setFrameMode] = useState<'strict' | 'flexible'>('strict')

  useEffect(() => { if (!ep.series_id) { setSeriesInfo(null); return } api()?.seriesGet?.(ep.series_id).then((s: any) => setSeriesInfo(s)).catch(() => setSeriesInfo(null)) }, [ep.series_id])

  const handlePhaseChange = (phase: string) => { setCurrentPhase(phase); onChanged() }
  const handlePhaseClick = (phase: string) => { setCurrentPhase(phase) }

  useEffect(() => { if (frames.length === 0) { setScoringScheme(null); setScoringBreakdown([]); return } let cancelled = false; const loadScoring = async () => { setScoringLoading(true); try { const res = await api()?.scoringCurrent({ episodeId: ep.id }); if (cancelled) return; if (res?.ok) { setScoringScheme(res.scheme ?? null); setScoringBreakdown(Array.isArray(res.breakdown) ? res.breakdown : []); setScoringAverage(res.average ?? 0); setScoringThreshold(res.threshold ?? 0.6); setScoringVersion(res.version ?? '1.0.0') } } catch {} finally { if (!cancelled) setScoringLoading(false) } }; loadScoring(); return () => { cancelled = true } }, [ep.id, frames.length])

  const saveTitle = async () => { if (!title.trim()) return; try { const res = await api()?.episodeSave({ ...ep, title: title.trim() }); if (res?.ok) { toast('Episode renamed'); onChanged() } else toast(res?.error || 'Failed to rename episode', 'error') } catch (e: any) { toast(e?.message || 'Failed to rename episode', 'error') } }
  const applyTheme = async () => { if (!themeId) return; try { const res = await api()?.themesApply({ themeId, episodeId: ep.id }); if (res?.ok) { toast('Theme applied to episode'); onChanged() } else toast(res?.error || 'Failed to apply theme', 'error') } catch (e: any) { toast(e?.message || 'Failed to apply theme', 'error') } }
  const generate = async () => { if (generating) return; setGenerating(true); try { const res = await api()?.scriptGenerate({ episodeId: ep.id }); if (res?.ok) { if (Array.isArray(res.frames)) setFrames(res.frames); if (typeof res.script === 'string') setScriptText(res.script); toast('Script generated'); onChanged() } else toast(res?.error || 'Script generation failed', 'error') } catch (e: any) { toast(e?.message || 'Script generation failed', 'error') } finally { setGenerating(false) } }
  const sendToExternalAI = async () => { setExternalSending(true); try { const res = await api()?.externalBuildScriptPrompt({ episodeId: ep.id, templateIds: selectedTemplates, frameMode }); if (res?.ok && res.prompt) { setExternalPrompt(res.prompt); setExternalMode(true); await navigator.clipboard.writeText(res.prompt); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 2000); window.open('https://chatgpt.com', '_blank'); toast('Prompt copied — paste it into ChatGPT/Claude') } else toast(res?.error || 'Failed to build prompt', 'error') } catch (e: any) { toast(e?.message || 'Failed to build prompt', 'error') } finally { setExternalSending(false) } }
  const copyPromptOnly = async () => { try { const res = await api()?.externalBuildScriptPrompt({ episodeId: ep.id, templateIds: selectedTemplates, frameMode }); if (res?.ok && res.prompt) { setExternalPrompt(res.prompt); setExternalMode(true); await navigator.clipboard.writeText(res.prompt); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 2000); toast('Prompt copied — paste it into any AI, then paste the response below') } else toast(res?.error || 'Failed to build prompt', 'error') } catch (e: any) { toast(e?.message || 'Failed to build prompt', 'error') } }
  const importExternalScript = async () => { if (!externalPaste.trim()) { toast('Paste the AI response first', 'error'); return } setExternalImporting(true); try { const res = await api()?.externalImportScript({ episodeId: ep.id, rawJson: externalPaste.trim() }); if (res?.ok) { if (Array.isArray(res.frames)) setFrames(res.frames); toast(`Imported ${res.frames?.length || 0} frames from external AI`); setExternalMode(false); setExternalPaste(''); setExternalPrompt(''); onChanged() } else toast(res?.error || 'Import failed', 'error') } catch (e: any) { toast(e?.message || 'Import failed', 'error') } finally { setExternalImporting(false) } }
  const validateBatch = async () => { if (validating) return; setValidating(true); setValidateResults(null); try { const res = await api()?.validateScriptEvidence({ episodeId: ep.id }); const list = Array.isArray(res?.results) ? res.results : Array.isArray(res?.validations) ? res.validations : null; setValidateResults(list); if (!list) toast('Validation returned nothing — is the script generated?', 'error'); else { const fails = list.filter((r: any) => !(r.pass ?? r.valid)); toast(fails.length === 0 ? 'All frames pass evidence checks' : `${fails.length} frame(s) need attention`, fails.length === 0 ? 'success' : 'error') } } catch (e: any) { toast(e?.message || 'Validation failed', 'error') } finally { setValidating(false) } }
  const toggleOverride = async (v: boolean) => { if (savingOverride) return; setSavingOverride(true); try { const res = await api()?.gateOverride({ episodeId: ep.id, override: v }); if (res?.ok) { setOverride(v); toast(v ? 'Gates overridden — episode can proceed' : 'Gate override removed'); onChanged() } else toast(res?.error || 'Failed to update gate override', 'error') } catch (e: any) { toast(e?.message || 'Failed to update gate override', 'error') } finally { setSavingOverride(false) } }
  const inject = async () => { if (injecting) return; setInjecting(true); try { const res = await api()?.injectSeo({ episodeId: ep.id, niche: ep.niche ?? undefined }); if (res?.ok) { setSeo(res.seo ?? res); toast('SEO injected') } else toast(res?.error || 'SEO injection failed', 'error') } catch (e: any) { toast(e?.message || 'SEO injection failed', 'error') } finally { setInjecting(false) } }

  const gates = ep.gates ?? (Array.isArray(validateResults) ? null : null)
  const gateItems = gates ? [{ key: 'scroll_stop', label: 'Scroll Stop', check: gates.scroll_stop }, { key: 'hard_cut', label: 'Hard Cut', check: gates.hard_cut }, { key: 'asset_ready', label: 'Asset Ready', check: gates.asset_ready }] : []
  const seoPositions = seo ? [{ key: 'title', label: 'Title', value: seo.title }, { key: 'first_line', label: 'First Line', value: seo.first_line }, { key: 'text_overlay', label: 'Text Overlay', value: seo.text_overlay }, { key: 'caption', label: 'Caption', value: seo.caption }] : []

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <GhostButton className="h-7 px-2" onClick={onBack}><ChevronLeft size={14} /> Back</GhostButton>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input className="w-full max-w-md rounded-md border border-transparent bg-transparent px-1 py-0.5 text-lg font-bold text-zinc-100 outline-none transition-colors hover:border-white/[0.08] focus:border-amber-500/40" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} />
            <StatusChipL status={ep.status} />
          </div>
          {ep.niche && <div className="mt-0.5 px-1 text-[11px] text-zinc-500">Niche · {ep.niche}</div>}
        </div>
        <div className="flex items-center gap-2">
          <SelectInput className="w-56" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
            <option value="">Theme (optional)</option>
            {themes.some((t: any) => t.is_builtin) && <optgroup label="Built-in Themes">{themes.filter((t: any) => t.is_builtin).map((t: any) => <option key={t.id ?? t.name} value={t.id}>{t.name} — {t.font_display || t.accent_color || ''}</option>)}</optgroup>}
            {themes.some((t: any) => !t.is_builtin) && <optgroup label="Custom Themes">{themes.filter((t: any) => !t.is_builtin).map((t: any) => <option key={t.id ?? t.name} value={t.id}>{t.name}</option>)}</optgroup>}
          </SelectInput>
          <GhostButton onClick={applyTheme} disabled={!themeId}><Sparkles size={13} /> Apply</GhostButton>
        </div>
      </div>

      <PhaseStepper currentPhase={currentPhase} onPhaseClick={handlePhaseClick} episodeStatus={ep.status} gates={gates} takeCount={takeCount} evaluatedCount={evaluatedCount} />

      {currentPhase === 'idea' && <GreenLightPanel episodeId={ep.id} gates={gates} onPhaseChange={handlePhaseChange} validating={validating} onValidate={validateBatch} />}
      {currentPhase === 'capture' && <CaptureView episodeId={ep.id} onPhaseChange={handlePhaseChange} />}
      {currentPhase === 'assemble' && <AssembleView episodeId={ep.id} episodeTitle={ep.title} episodeNiche={ep.niche} />}
      {currentPhase === 'learn' && <LearnView episodeId={ep.id} onPhaseChange={handlePhaseChange} />}

      <div className="flex items-center gap-1 border-b border-white/[0.08] pb-2">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={cn('inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition-colors', tab === id ? 'bg-white/[0.06] text-zinc-100' : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300')}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {tab === 'script' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <AmberButton onClick={generate} disabled={generating}><Wand2 size={13} /> {generating ? 'Generating…' : frames.length > 0 ? 'Regenerate Script' : 'Generate Script'}</AmberButton>
            <GhostButton onClick={copyPromptOnly} disabled={externalSending}><ClipboardPaste size={13} /> Copy Prompt</GhostButton>
            <GhostButton onClick={sendToExternalAI} disabled={externalSending}>{externalSending ? <Zap size={13} className="animate-pulse" /> : <ExternalLink size={13} />} {externalSending ? 'Building…' : 'External AI'}</GhostButton>
            <GhostButton onClick={validateBatch} disabled={validating}><Search size={13} /> {validating ? 'Validating…' : 'Validate Evidence (AI)'}</GhostButton>
          </div>
          <DynamicPipeline episodeId={ep.id} onStepResult={() => { load(); onChanged() }} />
          <TemplateSelector selected={selectedTemplates} onChange={setSelectedTemplates} />
          <PlanningModeSelector episodeId={ep.id} onPlanGenerated={() => { load(); onChanged() }} />
          <HookStackDisplay episode={ep} />
          {frames.length > 0 && <EpisodeScoreSummary scheme={scoringScheme} breakdown={scoringBreakdown} average={scoringAverage} threshold={scoringThreshold} rubricVersion={scoringVersion} totalFrames={frames.length} loading={scoringLoading} />}
          <KeywordSEOPanel episode={ep} />
          {(ep as any).caption || (ep as any).pinned_comment || (ep as any).caption_track ? (
            <BentoCard className="p-5">
              <SectionHeader label="CAPTION" title="Post Copy" icon={<FileText size={14} className="text-amber-400" />} action={(ep as any).caption_track ? <GhostButton className="h-6 px-2 text-[10px]" onClick={() => { const track = (ep as any).caption_track; const srt = (track.lines as any[]).map((l: any, i: number) => { const f = (t: number) => { const m = Math.floor(t / 60); const s = (t % 60).toFixed(2).padStart(5, '0'); return `${String(m).padStart(2, '0')}:${s.replace('.', ',')}`; }; return `${i + 1}\n${f(l.start)} --> ${f(l.end)}\n${l.text}`; }).join('\n\n'); navigator.clipboard?.writeText(srt); toast('Caption .srt copied to clipboard', 'success'); }}>Export .srt</GhostButton> : null} />
              {(ep as any).caption_track && <div className="mt-3"><div className="mb-1 text-[9px] tracking-wider text-zinc-500 uppercase">Caption Track ({((ep as any).caption_track.lines || []).length} lines)</div><div className="space-y-1">{((ep as any).caption_track.lines as any[]).map((l: any) => <div key={l.id} className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1"><span className="font-mono text-[10px] text-zinc-500">{fmtSec(l.start)}–{fmtSec(l.end)}</span><span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{l.text}</span></div>)}</div></div>}
            </BentoCard>
          ) : null}
        </div>
      )}

      {tab === 'pipeline' && <PipelineView episodeId={ep.id} onStepComplete={() => onChanged()} />}
      {tab === 'seo' && <div className="space-y-4"><div className="flex items-center gap-2"><AmberButton onClick={inject} disabled={injecting}><FileSearch size={13} /> {injecting ? 'Injecting…' : 'Inject SEO'}</AmberButton>{ep.niche && <Chip>Niche: {ep.niche}</Chip>}</div>{seoPositions.length === 0 && !injecting && <EmptyState icon={<FileSearch size={28} />} title="No SEO injected yet" hint="Injection writes the search-optimized title, first line, overlay text, and caption for this episode." />}<div className="grid grid-cols-2 gap-3">{seoPositions.map((p) => <BentoCard key={p.key} className="p-4"><div className="mb-1 text-[9px] tracking-wider text-amber-400 uppercase">{p.label}</div><p className="text-xs leading-relaxed text-zinc-300">{String(p.value ?? '')}</p></BentoCard>)}</div></div>}
      {tab === 'analytics' && <AnalyticsBody episodeId={ep.id} />}
      {tab === 'assets' && (
        <div className="space-y-4">
          <SectionHeader label="Content Engine / Assets" title="Assets" action={<Chip className="border-cyan-500/25 bg-cyan-500/10 text-cyan-400">Episode media</Chip>} />
          {!ep.caption_track && !ep.overlay_session_id && <EmptyState icon={<Film size={28} />} title="No assets yet" hint="Generate captions from your transcript (Script tab) and hand off the overlay plan to Overlay Studio to populate this library." />}
          {ep.caption_track && <BentoCard className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText size={13} className="text-amber-400" /><span className="text-[10px] tracking-wider text-zinc-500 uppercase">Caption Track</span></div><Chip className="font-mono">{((ep.caption_track as any).lines || []).length} lines</Chip></div></BentoCard>}
          <OverlayAssignmentPanel episodeId={ep.id} episodeTitle={ep.title} seriesId={ep.series_id} seriesStyle={seriesInfo ? { visual_style: seriesInfo.visual_style, tone: seriesInfo.tone, pacing: seriesInfo.pacing, frame_mode: seriesInfo.frame_mode } : null} />
          {ep.overlay_session_id && <BentoCard className="p-4"><div className="flex items-center gap-2"><Sparkles size={13} className="text-pink-400" /><span className="text-[10px] tracking-wider text-zinc-500 uppercase">Linked Overlay Studio Session</span><span className="ml-auto font-mono text-[11px] text-zinc-300">{String(ep.overlay_session_id)}</span></div></BentoCard>}
        </div>
      )}
      {tab === 'metrics' && <EmptyState icon={<TrendingUp size={28} />} title="Metrics coming soon" hint="Post-publish performance tracking for this episode will live here." />}
    </section>
  )
}

export function EpisodesView() {
  const [episodes, setEpisodes] = useState<any[]>([])
  const [approvedIdeas, setApprovedIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState('')
  const [ideaTitle, setIdeaTitle] = useState('')
  const { openEpisodeId, clearOpenEpisode } = useContentEngine()

  const load = async () => { setLoading(true); setError(null); try { const list = await api()?.episodesList(); setEpisodes(Array.isArray(list) ? list : []) } catch (e: any) { setError(e?.message || 'Failed to load episodes.') } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const open = async (id: number) => { try { const ep = await api()?.episodeGet(id); if (ep) { setDetail(ep); setSelectedId(id) } else toast('Could not load episode', 'error') } catch (e: any) { toast(e?.message || 'Could not load episode', 'error') } }
  useEffect(() => { if (openEpisodeId != null) { void open(openEpisodeId); clearOpenEpisode() } }, [openEpisodeId])

  const toggleCreate = async () => { const next = !creating; setCreating(next); if (next) { try { const list = await api()?.ideasList(); setApprovedIdeas(Array.isArray(list) ? list.filter((i) => i.status === 'approved') : []) } catch { setApprovedIdeas([]) } } }
  const create = async () => { if (!selectedIdea && !ideaTitle.trim()) return; try { const res = await api()?.episodeSave({ idea_id: selectedIdea ? Number(selectedIdea) : undefined, title: ideaTitle.trim() || 'Untitled episode', status: 'draft' }); if (res?.ok) { toast('Episode created'); setCreating(false); setIdeaTitle(''); load() } else toast(res?.error || 'Failed to create episode', 'error') } catch (e: any) { toast(e?.message || 'Failed to create episode', 'error') } }
  const remove = async (id: number) => { try { await api()?.episodeDelete(id); toast('Episode deleted'); load() } catch (e: any) { toast(e?.message || 'Failed to delete episode', 'error') } }

  if (selectedId !== null && detail) {
    return <EpisodeDetail ep={detail} onBack={() => { setSelectedId(null); setDetail(null); load() }} onChanged={load} />
  }

  return (
    <section className="space-y-6 p-6">
      <SectionHeader label="Content Engine / 03" title="Episodes" icon={<Clapperboard size={14} className="text-white/70" />}
        action={<AmberButton onClick={toggleCreate}>{creating ? <X size={13} /> : <Plus size={13} />}{creating ? 'Close' : 'New Episode'}</AmberButton>}
      />

      {creating && (
        <BentoCard className="border-amber-500/20">
          <div className="mb-3 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">New Episode</div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <div><FieldLabel>From approved idea</FieldLabel><SelectInput value={selectedIdea} onChange={(e) => setSelectedIdea(e.target.value)}><option value="">— choose an approved idea —</option>{approvedIdeas.map((i) => <option key={i.id ?? i.title} value={i.id}>{i.title}</option>)}</SelectInput></div>
            <div><FieldLabel>Or title it manually</FieldLabel><BridgeField def={{ key: 'title', label: 'Episode Title', placeholder: 'Episode title' }} value={ideaTitle} onChange={(_k, v) => setIdeaTitle(v)} allValues={{ title: ideaTitle }} category="content-engine" context="Generate a compelling episode title based on the conversation" /></div>
            <AmberButton onClick={create} disabled={!selectedIdea && !ideaTitle.trim()}>Create</AmberButton>
          </div>
        </BentoCard>
      )}

      {loading && <LoadingBlock label="Loading episodes…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && episodes.length === 0 && <EmptyState icon={<Clapperboard size={28} />} title="No episodes yet" hint="Create one from an approved idea and start scripting." action={<AmberButton onClick={toggleCreate}><Plus size={13} /> New Episode</AmberButton>} />}

      {!loading && !error && episodes.length > 0 && (
        <div className="space-y-2">
          {episodes.map((ep) => (
            <BentoCard key={ep.id} className="flex cursor-pointer items-center gap-3 p-3.5" onClick={() => open(ep.id)}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-zinc-100">{ep.title}</span><StatusChipL status={ep.status} /></div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">{ep.niche && <span>Niche · {ep.niche}</span>}{Array.isArray(ep.script?.frames) && <span>{ep.script.frames.length} frames</span>}{ep.gates?.overall && <span>Gates · {ep.gates.overall}</span>}</div>
              </div>
              <ConfirmIconButton onConfirm={(e?: any) => { e?.stopPropagation?.(); remove(ep.id) }} icon={<Trash2 size={12} />} label="Delete episode" />
            </BentoCard>
          ))}
        </div>
      )}
    </section>
  )
}
