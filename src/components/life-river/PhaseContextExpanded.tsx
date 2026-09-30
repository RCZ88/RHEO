import { useMemo, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Target, Images, HeartHandshake, Moon, Brain, Code, Folder, CreditCard, Globe, Pencil, Plus, Check, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { usePeriodContext, type PhasePeriodContext } from '@/hooks/usePeriodContext'
import type { LifePhase } from '@/lib/riverMath'
import type { LoadedMemory } from '@/features/memories/useMemories'
import type { LongTermGoal } from '@/components/dashboard/types'
import { cn } from '@/lib/utils'

function formatMs(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── CategoryBar (horizontal stacked bar) ──
function CategoryBar({ segments }: { segments: { label: string; value: number; className: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800/60">
      {segments.map(seg => (
        <div
          key={seg.label}
          title={`${seg.label}: ${formatMs(seg.value)}`}
          className={cn('h-full transition-all', seg.className)}
          style={{ width: `${(seg.value / total) * 100}%` }}
        />
      ))}
    </div>
  )
}

// ── MiniStat ──
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-sm text-zinc-100">{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  )
}

// ── Summary Chips ──
function SummaryChip({ label, value, accent }: { label: string; value: string; accent: 'amber' | 'sky' | 'emerald' | 'rose' | 'violet' }) {
  const colors = {
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    sky: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    violet: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]', colors[accent])}>
      <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </span>
  )
}

// ── Density Heatmap ──
function DensityHeatmap({ phase, context }: { phase: LifePhase; context: PhasePeriodContext | null }) {
  const buckets = useMemo(() => {
    const start = new Date(Date.UTC(phase.startYear, phase.startMonth - 1, 1))
    const end = phase.endYear ? new Date(Date.UTC(phase.endYear, (phase.endMonth ?? 12) - 1, 28)) : new Date()
    const daySpan = Math.ceil((end.getTime() - start.getTime()) / 86400000)

    let bucketCount: number
    let labelFn: (d: Date) => string
    if (daySpan <= 62) { bucketCount = daySpan; labelFn = (d) => d.toISOString().slice(0, 10) }
    else if (daySpan <= 365) { bucketCount = Math.ceil(daySpan / 7); labelFn = (d) => `W${Math.ceil((d.getDate()) / 7)}` }
    else { bucketCount = Math.ceil(daySpan / 30); labelFn = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

    if (bucketCount <= 0) bucketCount = 1
    if (bucketCount > 60) bucketCount = 60

    const msPerBucket = (end.getTime() - start.getTime()) / bucketCount
    const result: { label: string; intensity: number }[] = []

    for (let i = 0; i < bucketCount; i++) {
      const bStart = new Date(start.getTime() + i * msPerBucket)
      result.push({ label: labelFn(bStart), intensity: 0 })
    }

    if (context) {
      const appMs = context.appUsage?.totalMs || 0
      const focusMs = context.focus?.totalMs || 0
      const finTxns = context.finance ? (context.finance.incomeTotal + context.finance.expenseTotal) : 0
      const aiReqs = context.ai?.totalRequests || 0
      const codeEvts = context.code?.totalEvents || 0
      const sleepMin = context.sleep?.totalMinutes || 0
      const total = appMs + focusMs + finTxns + aiReqs + codeEvts + sleepMin
      if (total > 0) {
        const intensity = Math.min(1, (appMs + focusMs) / Math.max(total, 1))
        result.forEach(b => { b.intensity = 0.08 + intensity * 0.85 })
      }
    }

    return result
  }, [phase, context])

  if (buckets.every(b => b.intensity <= 0.08)) {
    return (
      <div className="text-[12px] text-zinc-500 py-2">
        {phase.endYear ? 'This chapter pre DeskFlow tracking.' : 'No activity density recorded for this chapter yet.'}
      </div>
    )
  }

  return (
    <div className="flex h-10 items-end gap-px overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-1.5" title="Activity density across this chapter">
      {buckets.map((b, i) => (
        <div
          key={i}
          title={b.label}
          className="h-full flex-1 rounded-sm bg-amber-400 transition-opacity"
          style={{ opacity: b.intensity }}
        />
      ))}
    </div>
  )
}

// ── Sticky Context Toolbar ──
function ContextToolbar({ mode, onModeChange, onEdit, onAddAttachment, phaseId }: {
  mode: 'system' | 'manual'; onModeChange: (m: 'system' | 'manual') => void
  onEdit: () => void; onAddAttachment: () => void; phaseId: string
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-xl px-4 py-2.5">
      <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950/50 p-0.5">
        {(['system', 'manual'] as const).map(m => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={cn(
              'relative flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] transition-colors',
              mode === m ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {mode === m && (
              <motion.div
                layoutId={`phase-context-mode-${phaseId}`}
                className="absolute inset-0 rounded-md border border-white/10 bg-zinc-700/80"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10 capitalize">{m}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors">
          <Pencil size={12} /> Edit
        </button>
        <button onClick={onAddAttachment} className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300 hover:bg-amber-500/20 transition-colors">
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  )
}

// ── System Panels ──
function AppUsagePanel({ data }: { data: NonNullable<PhasePeriodContext['appUsage']> }) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? data.topApps : data.topApps.slice(0, 3)
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">App Usage</h4><BarChart3 className="h-4 w-4 text-sky-400/70" /></header>
      <div className="font-mono text-2xl text-zinc-100">{formatMs(data.totalMs)}</div>
      <div className="text-[12px] text-zinc-500">tracked across this chapter</div>
      <div className="mt-4"><CategoryBar segments={[{ label: 'Productive', value: data.productiveMs, className: 'bg-[var(--tier-productive)]/70' }, { label: 'Neutral', value: data.neutralMs, className: 'bg-[var(--tier-neutral)]/70' }, { label: 'Distracting', value: data.distractingMs, className: 'bg-[var(--tier-distracting)]/70' }]} /></div>
      {shown.length > 0 && <ul className="mt-4 space-y-2">{shown.map(app => <li key={app.name} className="flex items-center justify-between gap-3"><span className="truncate text-[12px] text-zinc-300">{app.name}</span><span className="font-mono text-[11px] text-zinc-500">{formatMs(app.totalMs)}</span></li>)}</ul>}
      {data.topApps.length > 3 && <button onClick={() => setShowAll(!showAll)} className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300">{showAll ? 'Show less' : `Show more (${data.topApps.length - 3})`}</button>}
    </section>
  )
}

function FocusPanel({ data }: { data: NonNullable<PhasePeriodContext['focus']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Deep Focus</h4><Brain className="h-4 w-4 text-sky-400/70" /></header>
      <div className="font-mono text-2xl text-zinc-100">{formatMs(data.totalMs)}</div>
      <div className="text-[12px] text-zinc-500">total focus time</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Sessions" value={String(data.sessionCount)} />
        <MiniStat label="Avg" value={formatMs(data.averageSessionMs)} />
        <MiniStat label="Groups" value={String(data.groups.length)} />
      </div>
      {data.strictness.length > 0 && (
        <div className="mt-4">
          <CategoryBar segments={data.strictness.map(s => ({ label: s.label, value: s.totalMs, className: s.label === 'strict' ? 'bg-sky-400/70' : s.label === 'lenient' ? 'bg-emerald-400/70' : 'bg-zinc-500/60' }))} />
          <div className="flex gap-3 mt-2">{data.strictness.map(s => <div key={s.label} className="flex items-center gap-1 text-[10px] text-zinc-500"><span className={cn('w-2 h-2 rounded-full', s.label === 'strict' ? 'bg-sky-400' : s.label === 'lenient' ? 'bg-emerald-400' : 'bg-zinc-500')} />{s.label} {formatMs(s.totalMs)}</div>)}</div>
        </div>
      )}
      {data.groups.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{data.groups.map(g => <span key={g.name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] bg-zinc-800/60 text-zinc-300"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />{g.name} {formatMs(g.totalMs)}</span>)}</div>}
    </section>
  )
}

function FinancePanel({ data }: { data: NonNullable<PhasePeriodContext['finance']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Finance</h4><CreditCard className="h-3.5 w-3.5 text-zinc-600" /></header>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-[10px] uppercase text-emerald-500">Income</div><div className="font-mono text-lg font-semibold text-emerald-400">{formatMoney(data.incomeTotal)}</div></div>
        <div><div className="text-[10px] uppercase text-rose-500">Expense</div><div className="font-mono text-lg font-semibold text-rose-400">{formatMoney(data.expenseTotal)}</div></div>
        <div><div className="text-[10px] uppercase text-zinc-500">Net</div><div className={cn('font-mono text-lg font-semibold', data.net >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{formatMoney(data.net)}</div></div>
      </div>
      {data.topCategories.length > 0 && <div className="mt-3 space-y-1">{data.topCategories.slice(0, 4).map(c => <div key={c.label} className="flex items-center justify-between text-[12px]"><span className="text-zinc-300">{c.label}</span><span className="text-zinc-500">{formatMoney(c.total)}</span></div>)}</div>}
    </section>
  )
}

function SubscriptionsPanel({ data }: { data: NonNullable<PhasePeriodContext['subscriptions']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Subscriptions</h4><CreditCard className="h-3.5 w-3.5 text-zinc-600" /></header>
      <div className="font-mono text-2xl text-zinc-100">{formatMoney(data.estimatedMonthlyBurn)}<span className="text-[12px] text-zinc-500 font-sans">/mo</span></div>
      {data.activeDuringPhase.length > 0 && <div className="mt-3 space-y-1">{data.activeDuringPhase.slice(0, 5).map(s => <div key={s.id} className="flex items-center justify-between text-[12px]"><span className="text-zinc-300">{s.name}</span><span className="text-zinc-500">{formatMoney(s.amount)}/{s.billingCycle}</span></div>)}</div>}
    </section>
  )
}

function SleepPanel({ data }: { data: NonNullable<PhasePeriodContext['sleep']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Sleep</h4><Moon className="h-3.5 w-3.5 text-zinc-600" /></header>
      <div className="font-mono text-2xl text-zinc-100">{data.averageMinutes}m</div>
      <div className="text-[12px] text-zinc-500 mt-1">avg per night · {data.sessionCount} nights</div>
    </section>
  )
}

function AiPanel({ data }: { data: NonNullable<PhasePeriodContext['ai']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">AI Usage</h4><Brain className="h-3.5 w-3.5 text-zinc-600" /></header>
      <div className="font-mono text-2xl text-zinc-100">{data.totalRequests}<span className="text-[12px] text-zinc-500 font-sans"> calls</span></div>
      <div className="text-[12px] text-zinc-500 mt-1">${formatMoney(data.totalCost)} · {formatMs(data.totalTokensIn * 4)} tokens</div>
      {data.topTools.length > 0 && <div className="mt-3 space-y-1">{data.topTools.slice(0, 3).map(t => <div key={t.tool} className="flex items-center justify-between text-[12px]"><span className="text-zinc-300">{t.tool}</span><span className="text-zinc-500">{t.count} calls</span></div>)}</div>}
    </section>
  )
}

function CodePanel({ data }: { data: NonNullable<PhasePeriodContext['code']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Code Activity</h4><Code className="h-3.5 w-3.5 text-zinc-600" /></header>
      <div className="font-mono text-2xl text-zinc-100">{data.totalEvents}<span className="text-[12px] text-zinc-500 font-sans"> edits</span></div>
      <div className="text-[12px] text-zinc-500 mt-1">+{data.linesAdded} / -{data.linesRemoved} lines</div>
      {data.topFiles.length > 0 && <div className="mt-3 space-y-1">{data.topFiles.slice(0, 3).map(f => <div key={f.filePath} className="flex items-center justify-between text-[12px]"><span className="text-zinc-300 truncate">{f.filePath.split('/').pop()}</span><span className="text-zinc-500">{f.events}</span></div>)}</div>}
    </section>
  )
}

function ProjectsPanel({ data }: { data: NonNullable<PhasePeriodContext['projects']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">IDE Projects</h4><Folder className="h-3.5 w-3.5 text-zinc-600" /></header>
      {data.activeProjects.length > 0 && <div className="space-y-1.5">{data.activeProjects.slice(0, 5).map(p => <div key={p.id} className="flex items-center justify-between text-[12px]"><span className="text-zinc-300">{p.name}</span><span className="text-zinc-500">active</span></div>)}</div>}
    </section>
  )
}

function BrowserPanel({ data }: { data: NonNullable<PhasePeriodContext['browser']> }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
      <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-zinc-500">Browser</h4><Globe className="h-3.5 w-3.5 text-zinc-600" /></header>
      <div className="font-mono text-2xl text-zinc-100">{formatMs(data.totalMs)}</div>
      {data.topDomains.length > 0 && <div className="mt-3 space-y-1">{data.topDomains.slice(0, 5).map(d => <div key={d.domain} className="flex items-center justify-between text-[12px]"><span className="text-zinc-300 truncate">{d.domain}</span><span className="text-zinc-500">{formatMs(d.totalMs)}</span></div>)}</div>}
    </section>
  )
}

// ── Manual View ──
function ManualView({ phase, memories, longTermGoals, covenant, onAddMemory, onAddGoal, onAddCovenant, onDetachMemory, onDetachGoal }: {
  phase: LifePhase; memories: LoadedMemory[]; longTermGoals: LongTermGoal[]
  covenant?: { commitments: { id: string }[]; completions: { commitmentId: string; date: string }[] }
  onAddMemory?: () => void; onAddGoal?: () => void; onAddCovenant?: () => void
  onDetachMemory?: (id: string) => void; onDetachGoal?: (id: string) => void
}) {
  const { start, end } = useMemo(() => {
    const s = new Date(Date.UTC(phase.startYear, phase.startMonth - 1, 1)).toISOString().slice(0, 10)
    const e = phase.endYear ? new Date(Date.UTC(phase.endYear, (phase.endMonth ?? 12) - 1, 28)).toISOString().slice(0, 10) : null
    return { start: s, end: e }
  }, [phase])

  const phaseMemories = useMemo(() => memories.filter(m => m.meta.date >= start && (!end || m.meta.date <= end)), [memories, start, end])
  const attachedMemories = useMemo(() => memories.filter(m => m.meta.phaseId === phase.id), [memories, phase.id])
  const phaseGoals = useMemo(() => longTermGoals.filter(g => {
    const dl = (g as any).deadline || (g as any).targetDate || (g as any).date
    const links = (g as any).links || []
    const hasPhaseLink = links.some((l: any) => l?.type === 'life-phase' && l?.id === phase.id)
    return hasPhaseLink || (dl && dl !== '2000-01-01' && dl >= start && (!end || dl <= end))
  }), [longTermGoals, start, end, phase.id])

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
        <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-emerald-500">Memories</h4><button onClick={onAddMemory} className="text-[10px] text-amber-400 hover:text-amber-300">+ Attach</button></header>
        {attachedMemories.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] uppercase text-emerald-500/70 mb-2">Attached manually</p>
            <div className="grid grid-cols-4 gap-2">{attachedMemories.slice(0, 8).map(m => (
              <div key={m.meta.id} className="relative group aspect-square rounded-lg bg-zinc-800/50 border border-emerald-500/30 overflow-hidden">
                <img src={m.url} alt="" className="w-full h-full object-cover" />
                {onDetachMemory && <button onClick={() => onDetachMemory(m.meta.id)} className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3 text-zinc-300" /></button>}
              </div>
            ))}</div>
          </div>
        )}
        {phaseMemories.length > 0 ? (
          <div>
            <p className="text-[10px] uppercase text-zinc-500 mb-2">Happened during this chapter</p>
            <div className="grid grid-cols-4 gap-2">{phaseMemories.filter(m => m.meta.phaseId !== phase.id).slice(0, 8).map(m => <div key={m.meta.id} className="aspect-square rounded-lg bg-zinc-800/50 border border-zinc-700/30 overflow-hidden"><img src={m.url} alt="" className="w-full h-full object-cover" /></div>)}</div>
          </div>
        ) : attachedMemories.length === 0 ? <p className="text-[12px] text-zinc-500">No memories attached yet.</p> : null}
      </section>
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
        <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-amber-500">Goals</h4><button onClick={onAddGoal} className="text-[10px] text-amber-400 hover:text-amber-300">+ Link</button></header>
        {phaseGoals.length > 0 ? <div className="space-y-1.5">{phaseGoals.map(g => <div key={g.id} className="flex items-center justify-between text-[12px] group"><span className="text-zinc-300">{g.title}</span><div className="flex items-center gap-2"><span className="text-zinc-500">{g.status || 'active'}</span>{onDetachGoal && <button onClick={() => onDetachGoal(g.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3 text-zinc-500 hover:text-rose-400" /></button>}</div></div>)}</div> : <p className="text-[12px] text-zinc-500">No goals linked yet.</p>}
      </section>
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl">
        <header className="flex items-center justify-between mb-3"><h4 className="text-[11px] uppercase tracking-wider text-rose-500">Covenants</h4><button onClick={onAddCovenant} className="text-[10px] text-amber-400 hover:text-amber-300">+ Create</button></header>
        <p className="text-[12px] text-zinc-500">{(covenant?.completions?.length || 0)} commitment completions during this chapter.</p>
      </section>
    </div>
  )
}

// ── Memory Picker ──
function MemoryPicker({ memories, phaseId, onSelect, onClose }: {
  memories: LoadedMemory[]; phaseId: string; onSelect: (ids: string[]) => void; onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = useCallback((id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next }), [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-zinc-900/95 border border-zinc-700 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-100 mb-4">Attach memories</h3>
        <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto">
          {memories.slice(0, 20).map(m => (
            <button key={m.meta.id} onClick={() => toggle(m.meta.id)} className={cn('relative h-24 overflow-hidden rounded-lg border transition-colors', selected.has(m.meta.id) ? 'border-emerald-400/70' : 'border-zinc-800 hover:border-zinc-600')}>
              <img src={m.url} alt="" className="h-full w-full object-cover" />
              {selected.has(m.meta.id) && <span className="absolute right-2 top-2 rounded-full bg-emerald-400/90 p-1 text-zinc-950"><Check className="h-3 w-3" /></span>}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button onClick={() => { onSelect(Array.from(selected)); onClose() }} disabled={selected.size === 0} className="h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 px-4 text-sm text-amber-100 disabled:opacity-50">Attach {selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </div>
    </div>
  )
}

// ── Goal Picker ──
function GoalPicker({ goals, phaseId, onSelect, onClose }: {
  goals: LongTermGoal[]; phaseId: string; onSelect: (ids: string[]) => void; onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggle = useCallback((id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next }), [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-zinc-900/95 border border-zinc-700 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-100 mb-4">Link goals to this chapter</h3>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {goals.length === 0 ? (
            <p className="text-[13px] text-zinc-500 py-4 text-center">No goals available. Create goals in the Gold page first.</p>
          ) : goals.map(g => (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className={cn(
                'w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                selected.has(g.id) ? 'border-amber-400/70 bg-amber-400/10' : 'border-zinc-800 hover:border-zinc-600'
              )}
            >
              <div>
                <p className="text-sm text-zinc-200">{g.title}</p>
                <p className="text-[11px] text-zinc-500">{g.category} · {g.status || 'active'}</p>
              </div>
              {selected.has(g.id) && <Check className="h-4 w-4 text-amber-400" />}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button onClick={() => { onSelect(Array.from(selected)); onClose() }} disabled={selected.size === 0} className="h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 px-4 text-sm text-amber-100 disabled:opacity-50">Link {selected.size > 0 ? `(${selected.size})` : ''}</button>
        </div>
      </div>
    </div>
  )
}

// ── Covenant Quick Create ──
function CovenantQuickCreate({ phaseId, onClose, onSave }: {
  phaseId: string; onClose: () => void; onSave: (commitment: { title: string; category: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('personal')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-zinc-900/95 border border-zinc-700 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-100 mb-4">New commitment</h3>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Commitment</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="I will..."
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-rose-500/40"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {['personal', 'relational', 'spiritual', 'professional'].map(c => (
                <button key={c} onClick={() => setCategory(c)} className={cn('px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize', category === c ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300')}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="h-9 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button
            onClick={() => { if (title.trim()) { onSave({ title: title.trim(), category }); onClose() } }}
            disabled={!title.trim()}
            className="h-9 rounded-lg bg-rose-500/15 border border-rose-500/30 px-4 text-sm text-rose-300 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Export ──
export function PhaseContextExpanded({
  phase, expandedMode, onModeChange, memories, longTermGoals, covenant,
  onAddMemory, onAddGoal, onAddCovenant, onEditPhase,
  onAttachMemory, onAttachGoal, onCovenantSaved, onDetachMemory, onDetachGoal,
  onOpenPage,
}: {
  phase: LifePhase; expandedMode: 'system' | 'manual'; onModeChange: (mode: 'system' | 'manual') => void
  memories: LoadedMemory[]; longTermGoals: LongTermGoal[]
  covenant?: { commitments: { id: string }[]; completions: { commitmentId: string; date: string }[] }
  onAddMemory?: () => void; onAddGoal?: () => void; onAddCovenant?: () => void; onEditPhase?: () => void
  onAttachMemory?: (ids: string[]) => void; onAttachGoal?: (ids: string[]) => void; onCovenantSaved?: () => void
  onDetachMemory?: (id: string) => void; onDetachGoal?: (id: string) => void
  onOpenPage?: (page: string) => void
}) {
  const [showMemoryPicker, setShowMemoryPicker] = useState(false)
  const [showGoalPicker, setShowGoalPicker] = useState(false)
  const [showCovenantCreate, setShowCovenantCreate] = useState(false)

  const { context, loading } = usePeriodContext(phase.id, phase, expandedMode === 'system')

  // Auto-switch to manual if no system data
  useEffect(() => {
    if (expandedMode === 'system' && context && !loading) {
      if (!context.appUsage && !context.browser && !context.focus && !context.finance && !context.sleep && !context.ai && !context.code) {
        onModeChange('manual')
      }
    }
  }, [context, loading, expandedMode, onModeChange])

  const chips = useMemo(() => {
    if (!context) return []
    const c: { label: string; value: string; accent: 'amber' | 'sky' | 'emerald' | 'rose' | 'violet' }[] = []
    if (context.summary.productiveMs > 0) c.push({ label: 'Productive', value: formatMs(context.summary.productiveMs), accent: 'amber' })
    if (context.summary.focusMs > 0) c.push({ label: 'Focus', value: formatMs(context.summary.focusMs), accent: 'sky' })
    if (context.summary.netFinance !== 0) c.push({ label: 'Net', value: `${context.summary.netFinance >= 0 ? '+' : ''}${formatMoney(context.summary.netFinance)}`, accent: 'emerald' })
    if (context.summary.sleepAvgMinutes > 0) c.push({ label: 'Sleep', value: `${context.summary.sleepAvgMinutes}m`, accent: 'violet' })
    if (context.summary.aiCost > 0) c.push({ label: 'AI cost', value: `$${formatMoney(context.summary.aiCost)}`, accent: 'violet' })
    if (context.summary.covenantCompletionCount > 0) c.push({ label: 'Covenant', value: `${context.summary.covenantCompletionCount} kept`, accent: 'rose' })
    return c.slice(0, 6)
  }, [context])

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden border-t border-zinc-800/60"
    >
      <div className="space-y-4 p-5">
        <ContextToolbar mode={expandedMode} onModeChange={onModeChange} onEdit={() => onEditPhase?.()} onAddAttachment={() => {
          if (expandedMode === 'manual') {
            setShowGoalPicker(true)
          } else {
            onAddMemory?.()
          }
        }} phaseId={phase.id} />

        {expandedMode === 'system' && <DensityHeatmap phase={phase} context={context} />}

        {expandedMode === 'system' && chips.length > 0 && (
          <div className="flex flex-wrap gap-2">{chips.map(c => <SummaryChip key={c.label} {...c} />)}</div>
        )}

        {expandedMode === 'system' ? (
          loading ? (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="animate-pulse rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5"><div className="h-3 w-20 rounded bg-zinc-800" /><div className="mt-4 h-7 w-28 rounded bg-zinc-800" /><div className="mt-3 space-y-2"><div className="h-2.5 w-full rounded bg-zinc-800/60" /><div className="h-2.5 w-4/5 rounded bg-zinc-800/60" /></div></div>)}
            </div>
          ) : context ? (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {context.appUsage && <AppUsagePanel data={context.appUsage} />}
              {context.focus && <FocusPanel data={context.focus} />}
              {context.finance && <FinancePanel data={context.finance} />}
              {context.subscriptions && <SubscriptionsPanel data={context.subscriptions} />}
              {context.sleep && <SleepPanel data={context.sleep} />}
              {context.ai && <AiPanel data={context.ai} />}
              {context.code && <CodePanel data={context.code} />}
              {context.projects && <ProjectsPanel data={context.projects} />}
              {context.browser && <BrowserPanel data={context.browser} />}
              {!context.appUsage && !context.focus && !context.finance && !context.sleep && !context.ai && !context.code && (
                <div className="lg:col-span-2 xl:col-span-3 text-center py-8"><p className="text-[13px] text-zinc-500">This chapter may predate DeskFlow tracking.</p></div>
              )}
            </div>
          ) : null
        ) : (
          <>
            <ManualView
              phase={phase} memories={memories} longTermGoals={longTermGoals} covenant={covenant}
              onAddMemory={() => setShowMemoryPicker(true)}
              onAddGoal={() => setShowGoalPicker(true)}
              onAddCovenant={() => setShowCovenantCreate(true)}
              onDetachMemory={onDetachMemory}
              onDetachGoal={onDetachGoal}
            />
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/50">
              {onOpenPage && (
                <>
                  <button onClick={() => onOpenPage('memories')} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"><ExternalLink size={11} /> Open Memories page</button>
                  <button onClick={() => onOpenPage('gold')} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"><ExternalLink size={11} /> Open Gold page</button>
                  <button onClick={() => onOpenPage('covenant')} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"><ExternalLink size={11} /> Open Covenant page</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showMemoryPicker && <MemoryPicker memories={memories} phaseId={phase.id} onSelect={(ids) => onAttachMemory?.(ids)} onClose={() => setShowMemoryPicker(false)} />}
      {showGoalPicker && <GoalPicker goals={longTermGoals} phaseId={phase.id} onSelect={(ids) => onAttachGoal?.(ids)} onClose={() => setShowGoalPicker(false)} />}
      {showCovenantCreate && <CovenantQuickCreate phaseId={phase.id} onClose={() => setShowCovenantCreate(false)} onSave={(c) => { onCovenantSaved?.(); setShowCovenantCreate(false) }} />}
    </motion.div>
  )
}
