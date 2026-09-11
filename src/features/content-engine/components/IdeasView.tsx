import { useEffect, useState } from 'react'
import { Lightbulb, Star, ChevronRight, Trash2, Sparkles, CheckCircle2, SlidersHorizontal, ShieldCheck, ShieldX, Clapperboard, ExternalLink, ClipboardPaste, Check, Zap, BrainCircuit, ArrowRight } from 'lucide-react'
import { AmberButton, CopyPromptButton, GhostButton, Card, Chip, ConfirmIconButton, EmptyState, ErrorState, LoadingBlock, SectionHeader, TextInput, TextArea, toast } from './ui'
import { cn } from '@/lib/utils'
import { useContentEngine } from '../ContentEngineContext'
import { BlurFade, BentoCard, StatusChip } from './ui-laminar'
import { GlareHover } from '@/components/ui/glare-hover'
import { NeonGradientCard } from '@/components/ui/neon-gradient-card'
import { ShinyButton } from '@/components/ui/shiny-button'

const api = () => (window as any).deskflowAPI?.contentEngine

const COLUMNS = [
  { id: 'raw', label: 'Raw' },
  { id: 'refined', label: 'Refined' },
  { id: 'approved', label: 'Approved' },
  { id: 'used', label: 'Used' },
]

const NEXT_STATUS: Record<string, string> = { raw: 'refined', refined: 'approved', approved: 'used' }

function GateChip({ gates }: { gates?: any }) {
  const overall = gates?.overall
  if (!overall) return <Chip><Shield size={10} /> No gates</Chip>
  if (overall === 'pass') return <Chip className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400"><ShieldCheck size={10} /> Gate pass</Chip>
  return <Chip className="border-rose-500/25 bg-rose-500/10 text-rose-400"><ShieldX size={10} /> Gate fail</Chip>
}

function IdeaCard({ idea, onSaved, onDeleted }: { idea: any; onSaved: () => void; onDeleted: () => void }) {
  const [saving, setSaving] = useState(false)
  const [creatingEp, setCreatingEp] = useState(false)
  const { requestOpenEpisode } = useContentEngine()
  const priority = idea.priority ?? 1

  const createEpisode = async () => {
    if (creatingEp) return
    setCreatingEp(true)
    try {
      const res = await api()?.episodeSave({ idea_id: idea.id ? Number(idea.id) : undefined, title: idea.title, status: 'draft' })
      if (res?.ok) { toast('Episode created from idea'); requestOpenEpisode(res.id) }
      else toast(res?.error || 'Failed to create episode', 'error')
    } catch (e: any) { toast(e?.message || 'Failed to create episode', 'error') }
    finally { setCreatingEp(false) }
  }

  const save = async (patch: any) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await api()?.ideaSave({ ...idea, ...patch })
      if (res?.ok) { toast('Idea updated'); onSaved() }
      else toast(res?.error || 'Failed to update idea', 'error')
    } catch (e: any) { toast(e?.message || 'Failed to update idea', 'error') }
    finally { setSaving(false) }
  }

  return (
    <GlareHover className="flex flex-col gap-2.5" background="rgba(24,24,27,0.6)">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-100">{idea.title}</div>
          {idea.hook && <div className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">{idea.hook}</div>}
        </div>
        <ConfirmIconButton onConfirm={onDeleted} icon={<Trash2 size={12} />} label="Delete idea" className="shrink-0" />
      </div>
      {Array.isArray(idea.frames) && idea.frames.length > 0 && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
          <div className="mb-1 text-[9px] tracking-wider text-zinc-500 uppercase">Frames preview</div>
          {idea.frames.slice(0, 3).map((f: any, i: number) => (
            <div key={i} className="truncate text-[11px] text-zinc-400"><span className="text-zinc-600">{i + 1}.</span> {String(f.text ?? f).slice(0, 90)}</div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {idea.format_type && <Chip className="border-white/[0.08] text-zinc-300">{idea.format_type}</Chip>}
        {idea.niche && <Chip>{idea.niche}</Chip>}
        {idea.series && <Chip>Series · {idea.series}</Chip>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <GateChip gates={idea.gates} />
        <div className="flex items-center gap-0.5" title={`Priority ${priority}/5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} disabled={saving} onClick={() => save({ priority: i })} className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50">
              <Star size={12} className={cn(i <= priority ? 'fill-amber-400 text-amber-400' : 'text-zinc-600')} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-white/[0.08] pt-2.5">
        {idea.status !== 'approved' && idea.status !== 'used' && (
          <button onClick={() => save({ status: 'approved' })} disabled={saving}
            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400">
            <CheckCircle2 size={11} /> Approve
          </button>
        )}
        {idea.status !== 'refined' && idea.status !== 'used' && (
          <button onClick={() => save({ status: 'refined' })} disabled={saving}
            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-amber-500/10 hover:text-amber-400">
            <SlidersHorizontal size={11} /> Refine
          </button>
        )}
        <button onClick={createEpisode} disabled={creatingEp}
          className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
          <Clapperboard size={11} /> {creatingEp ? 'Creating…' : 'Episode'}
        </button>
        {idea.status !== 'used' && NEXT_STATUS[idea.status] && (
          <button onClick={() => save({ status: NEXT_STATUS[idea.status] })} disabled={saving}
            className="ml-auto inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
            <ChevronRight size={12} /> {NEXT_STATUS[idea.status]}
          </button>
        )}
      </div>
    </GlareHover>
  )
}

export function IdeasView() {
  const [ideas, setIdeas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [synthNote, setSynthNote] = useState('')
  const [synthesizing, setSynthesizing] = useState(false)
  const [captureThought, setCaptureThought] = useState('')
  const [classifying, setClassifying] = useState(false)
  const [classifyResult, setClassifyResult] = useState<any>(null)
  const [classifyError, setClassifyError] = useState<string | null>(null)
  const [routing, setRouting] = useState(false)
  const [externalMode, setExternalMode] = useState(false)
  const [externalPrompt, setExternalPrompt] = useState('')
  const [externalPaste, setExternalPaste] = useState('')
  const [externalImporting, setExternalImporting] = useState(false)
  const [externalSending, setExternalSending] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [frameMode, setFrameMode] = useState<'strict' | 'flexible'>('strict')

  const load = async () => {
    setLoading(true); setError(null)
    try { const list = await api()?.ideasList(); setIdeas(Array.isArray(list) ? list : []) }
    catch (e: any) { setError(e?.message || 'Failed to load ideas.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const synthesize = async () => {
    if (synthesizing) return
    setSynthesizing(true)
    try {
      const res = await api()?.synthesizeIdeas({ note: synthNote.trim() || undefined, count: 3 })
      if (res?.ok) { toast('3 new ideas synthesized'); setSynthNote(''); load() }
      else toast(res?.error || 'Synthesis failed', 'error')
    } catch (e: any) { toast(e?.message || 'Synthesis failed', 'error') }
    finally { setSynthesizing(false) }
  }

  const remove = async (id?: number) => {
    if (!id) return
    try { await api()?.ideaDelete(id); toast('Idea deleted'); load() }
    catch (e: any) { toast(e?.message || 'Failed to delete idea', 'error') }
  }

  const classifyThought = async () => {
    if (!captureThought.trim() || classifying) return
    setClassifying(true); setClassifyError(null); setClassifyResult(null)
    try {
      const res = await api()?.brainstormClassify({ thought: captureThought.trim() })
      if (res?.ok && res.category) setClassifyResult(res)
      else setClassifyError(res?.error || 'Classification failed')
    } catch (e: any) { setClassifyError(e?.message || 'Unexpected error') }
    finally { setClassifying(false) }
  }

  const routeClassified = async () => {
    if (!classifyResult || routing) return
    setRouting(true)
    try {
      const cat = classifyResult.category
      if (cat === 'content_idea') {
        await api()?.ideaSave({ title: classifyResult.suggested_title || captureThought.trim().slice(0, 80), hook: captureThought.trim(), status: 'raw', format_type: classifyResult.format_type, niche: classifyResult.niche_hint || null })
        toast('Routed to Ideas', 'success')
      } else if (cat === 'framework_update') {
        await api()?.frameworkSave({ name: classifyResult.suggested_title || captureThought.trim().slice(0, 40), rules: [{ id: 'rule-1', rule: captureThought.trim() }], description: classifyResult.reason || '' })
        toast('Routed to Frameworks', 'success')
      } else {
        await api()?.lessonSave({ lesson: captureThought.trim(), applies_to: 'general', confidence: 0.7, status: 'active' })
        toast('Routed to Lessons', 'success')
      }
      setCaptureThought(''); setClassifyResult(null); load()
    } catch (e: any) { toast(e?.message || 'Routing failed', 'error') }
    finally { setRouting(false) }
  }

  return (
    <section className="space-y-6 p-6">
      <SectionHeader label="Content Engine / 02" title="Ideas" icon={<Lightbulb size={14} className="text-white/70" />}
        action={
          <div className="flex items-center gap-2">
            <TextInput className="w-52" placeholder="Context note (optional)" value={synthNote} onChange={(e) => setSynthNote(e.target.value)} />
            <ShinyButton onClick={synthesize} disabled={synthesizing} className="h-8 text-xs">
              <Sparkles size={13} /> {synthesizing ? 'Synthesizing…' : 'Synthesize 3'}
            </ShinyButton>
          </div>
        }
      />

      <BentoCard className="border-violet-500/20">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit size={14} className="text-violet-400" />
          <span className="text-[10px] font-semibold tracking-wider text-violet-400 uppercase">Quick Capture</span>
          <span className="text-[9px] text-zinc-500">— dump a thought, AI classifies and routes it</span>
        </div>
        <div className="flex gap-2">
          <TextArea className="flex-1" rows={2} placeholder="A video idea, a question, a half-formed thought..." value={captureThought} onChange={(e) => setCaptureThought(e.target.value)} />
          <div className="flex flex-col gap-1.5 shrink-0">
            <AmberButton onClick={classifyThought} disabled={!captureThought.trim() || classifying} className="h-8">
              <BrainCircuit size={13} /> {classifying ? 'Classifying…' : 'Classify'}
            </AmberButton>
          </div>
        </div>
        {classifyResult && (
          <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Chip className="border-violet-500/25 bg-violet-500/10 text-violet-400">{classifyResult.category}</Chip>
              {classifyResult.suggested_title && <span className="text-[11px] text-zinc-300 font-medium">{classifyResult.suggested_title}</span>}
            </div>
            <AmberButton onClick={routeClassified} disabled={routing} className="h-7">
              <ArrowRight size={12} /> {routing ? 'Routing…' : `Route to ${classifyResult.category === 'content_idea' ? 'Ideas' : classifyResult.category === 'framework_update' ? 'Frameworks' : 'Lessons'}`}
            </AmberButton>
          </div>
        )}
      </BentoCard>

      {loading && <LoadingBlock label="Loading ideas…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const items = ideas.filter((i) => (i.status || 'raw') === col.id)
            return (
              <div key={col.id} className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">{col.label}</span>
                  <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-500">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-8 text-center text-[11px] text-zinc-600">Nothing here yet</div>
                ) : (
                  items.map((idea) => <IdeaCard key={idea.id ?? idea.title} idea={idea} onSaved={load} onDeleted={() => remove(idea.id)} />)
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && !error && ideas.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <NeonGradientCard className="w-full max-w-sm p-5 text-center">
            <Lightbulb size={28} className="mx-auto mb-2 text-zinc-500" />
            <div className="text-sm font-medium text-zinc-300">No ideas in the funnel yet</div>
            <div className="mt-1 text-xs text-zinc-500">Use Quick Capture above to classify a thought, or hit Synthesize 3.</div>
            <div className="mt-3">
              <AmberButton onClick={synthesize} disabled={synthesizing} className="w-full">
                <Sparkles size={13} /> {synthesizing ? 'Synthesizing…' : 'Synthesize 3'}
              </AmberButton>
            </div>
          </NeonGradientCard>
        </div>
      )}
    </section>
  )
}
