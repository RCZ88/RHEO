import { useEffect, useState } from 'react'
import { Layers, Lock, Pencil, Plus, RotateCcw, Save, FileCode2 } from 'lucide-react'
import { AmberButton, Card, Chip, CopyPromptButton, EmptyState, ErrorState, FieldLabel, GhostButton, LoadingBlock, SectionHeader, SelectInput, TextArea, TextInput, toast } from './ui'
import { BlurFade, BentoCard, StatusChip } from './ui-laminar'

const api = () => (window as any).deskflowAPI?.contentEngine

function ruleText(r: any) {
  if (typeof r === 'string') return r
  if (r && typeof r === 'object' && 'rule' in r) return String(r.rule)
  return String(r ?? '')
}

function ruleReasoning(r: any): string | null {
  if (typeof r === 'string') return null
  if (r && typeof r === 'object' && 'reasoning' in r && r.reasoning) return String(r.reasoning)
  return null
}

function FrameworkCard({ fw, onChanged }: { fw: any; onChanged: () => void }) {
  const [draft, setDraft] = useState<string>(Array.isArray(fw.rules) ? fw.rules.map(ruleText).join('\n') : '')
  const [descDraft, setDescDraft] = useState<string>(String(fw.description ?? ''))
  const [rollbackV, setRollbackV] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [editing, setEditing] = useState(false)

  const saveVersion = async () => {
    if (saving) return
    const lines = draft.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) { toast('Enter at least one rule before saving', 'error'); return }
    setSaving(true)
    try {
      const res = await api()?.frameworkSave({ ...fw, description: descDraft, rules: lines.map((rule, i) => ({ id: String(i + 1), rule })) })
      if (res?.ok) { toast(`New version ${res.version ?? ''} saved`.trim()); onChanged() }
      else toast(res?.error || 'Failed to save version', 'error')
    } catch (e: any) { toast(e?.message || 'Failed to save version', 'error') }
    finally { setSaving(false) }
  }

  const rollback = async () => {
    if (!rollbackV || rolling) return
    setRolling(true)
    try {
      const res = await api()?.frameworkRollback({ id: fw.id, version: Number(rollbackV) })
      if (res?.ok) { toast(`Rolled back to v${rollbackV}`); onChanged() }
      else toast(res?.error || 'Rollback failed', 'error')
    } catch (e: any) { toast(e?.message || 'Rollback failed', 'error') }
    finally { setRolling(false) }
  }

  return (
    <BentoCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">{fw.name}</span>
          <Chip className="border-amber-500/25 bg-amber-500/10 text-amber-400">v{fw.version ?? 1}</Chip>
          {fw.is_builtin && <Chip className="border-zinc-500/20 text-zinc-400"><Lock size={9} /> Built-in</Chip>}
        </div>
        <FileCode2 size={13} className="shrink-0 text-zinc-600" />
      </div>

      {fw.description && <p className="text-xs leading-relaxed text-zinc-400">{fw.description}</p>}

      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
        <div className="mb-1.5 text-[9px] tracking-wider text-zinc-500 uppercase">Rules</div>
        {Array.isArray(fw.rules) && fw.rules.length > 0 ? (
          <ol className="space-y-2">
            {fw.rules.map((r: any, i: number) => (
              <li key={i} className="text-[11px] text-zinc-300">
                <div className="flex items-start gap-2">
                  <span className="mt-px font-mono text-[10px] text-zinc-600">{i + 1}.</span>
                  <span className="break-words">{ruleText(r)}</span>
                </div>
                {ruleReasoning(r) && <div className="ml-5 mt-0.5 text-[10px] italic text-zinc-500">{ruleReasoning(r)}</div>}
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-[11px] text-zinc-600">No rules on this version.</div>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={() => setEditing(true)}><Pencil size={13} /> Edit description &amp; rules</GhostButton>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-2">
              <FieldLabel>Explanation — what this framework is for</FieldLabel>
              <CopyPromptButton fieldKey="framework-description" />
            </div>
            <TextArea
              rows={2}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="One or two sentences: when to reach for this framework and what it guarantees."
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <FieldLabel>Edit rules — one per line</FieldLabel>
              <CopyPromptButton fieldKey="framework-rules" />
            </div>
            <TextArea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={'Start every hook with a curiosity gap…\nNever exceed 8 words per frame…'} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AmberButton onClick={saveVersion} disabled={saving}><Save size={13} /> {saving ? 'Saving…' : 'Save New Version'}</AmberButton>
            <GhostButton onClick={() => { setEditing(false); setDescDraft(String(fw.description ?? '')); setDraft(Array.isArray(fw.rules) ? fw.rules.map(ruleText).join('\n') : '') }}>Cancel</GhostButton>
            {Array.isArray(fw.history) && fw.history.length > 0 && (
              <>
                <SelectInput className="w-32" value={rollbackV} onChange={(e) => setRollbackV(e.target.value)}>
                  <option value="">Rollback to…</option>
                  {[...fw.history].sort((a: any, b: any) => b.version - a.version).map((h: any) => (
                    <option key={h.version} value={h.version}>v{h.version} · {String(h.saved_at ?? '').slice(0, 10) || 'saved'}</option>
                  ))}
                </SelectInput>
                <GhostButton onClick={rollback} disabled={!rollbackV || rolling}><RotateCcw size={13} /> {rolling ? 'Rolling…' : 'Rollback'}</GhostButton>
              </>
            )}
          </div>
        </>
      )}
    </BentoCard>
  )
}

function CreateFrameworkCard({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [rules, setRules] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (saving) return
    const trimmed = name.trim()
    if (!trimmed) { setError('Give the framework a name.'); return }
    const lines = rules.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) { setError('Add at least one rule — one per line.'); return }
    setSaving(true); setError(null)
    try {
      const res = await api()?.frameworkSave({ name: trimmed, description: desc.trim(), rules: lines.map((rule, i) => ({ id: String(i + 1), rule })) })
      if (res?.ok) { toast(`“${trimmed}” created`); setName(''); setDesc(''); setRules(''); onCreated() }
      else setError(res?.error || 'Failed to create framework')
    } catch (e: any) { setError(e?.message || 'Failed to create framework') }
    finally { setSaving(false) }
  }

  return (
    <BentoCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">New framework</span>
          <Chip className="border-amber-500/25 bg-amber-500/10 text-amber-400">Draft</Chip>
        </div>
        <Plus size={13} className="shrink-0 text-zinc-600" />
      </div>

      <div>
        <FieldLabel>Name</FieldLabel>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold Open Contract" />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <FieldLabel>Explanation — what this framework is for</FieldLabel>
          <CopyPromptButton fieldKey="framework-description" />
        </div>
        <TextArea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="When to reach for this framework and what it guarantees." />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <FieldLabel>Rules — one per line</FieldLabel>
          <CopyPromptButton fieldKey="framework-rules" />
        </div>
        <TextArea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={'The first payoff lands within 8 seconds\nCTA only after the final payoff'} />
      </div>

      {error && <div role="alert" className="text-[11px] text-red-400">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <AmberButton onClick={create} disabled={saving}><Plus size={13} /> {saving ? 'Creating…' : 'Create framework'}</AmberButton>
      </div>
    </BentoCard>
  )
}

export function FrameworksView() {
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)

  const load = async () => {
    setLoading(true); setError(null)
    try { const list = await api()?.frameworksList(); setFrameworks(Array.isArray(list) ? list : []) }
    catch (e: any) { setError(e?.message || 'Failed to load frameworks.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <section className="space-y-6 p-6">
      <SectionHeader
        label="Content Engine / 07"
        title="Frameworks"
        icon={<Layers size={14} className="text-white/70" />}
        action={
          <div className="flex items-center gap-2">
            <Chip>Versioned prompt frameworks</Chip>
            <AmberButton onClick={() => setComposing((c) => !c)}>
              <Plus size={13} /> {composing ? 'Close editor' : 'New framework'}
            </AmberButton>
          </div>
        }
      />

      {loading && <LoadingBlock label="Loading frameworks…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && frameworks.length === 0 && !composing && (
        <EmptyState
          icon={<Layers size={28} />}
          title="No frameworks yet"
          hint="Frameworks package your winning rules into reusable, versioned prompts for script generation."
          action={<AmberButton onClick={() => setComposing(true)}><Plus size={13} /> Create your first framework</AmberButton>}
        />
      )}

      {!loading && !error && (frameworks.length > 0 || composing) && (
        <div className="grid grid-cols-2 gap-4">
          {composing && <CreateFrameworkCard onCreated={load} />}
          {frameworks.map((fw) => <FrameworkCard key={fw.id ?? fw.name} fw={fw} onChanged={load} />)}
        </div>
      )}
    </section>
  )
}
