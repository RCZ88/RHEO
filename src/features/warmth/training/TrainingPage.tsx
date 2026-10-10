/**
 * TRAINING — the training log (Life → Training)
 *
 * WHY A LOG AND NOT A DASHBOARD. Every other surface here answers "what
 * happened". This one answers "am I getting better". That difference decides the
 * layout: no grid of equal-weight KPI tiles, because tiles make you compare
 * yourself to an abstraction. Instead a QUEUE (what is due, in what order), a
 * LEDGER (what landed, newest first, immutable), and exactly ONE thing the app
 * wants this week. Three objects, one of which is a question.
 *
 * ── PROVENANCE: PAINT P3 (SOURCING) — what was pulled, and what was refused ──
 *
 * MCP calls made (Gate B): shadcn registry lookup, `@kokonutui` search,
 * `@kokonutui/apple-activity-card` source read, `@shadcn` search,
 * `@shadcn/toggle-group` demo read.
 *
 * `apple-activity-card` was read in full and then REFUSED, three times over:
 *   · `rounded-3xl` — Gate C caps radii at 8 / 12 / pill.
 *   · three separate hardcoded accent hues (red / lime / cyan) — Gate C allows
 *     ONE signal hue per surface. It is an Apple-Fitness mimic whose whole point
 *     is three categorical colours.
 *   · linearGradient + drop-shadow glow — banned in App UI.
 * What was KEPT is the technique: an animated `strokeDashoffset` over a
 * `strokeDasharray` circumference. The repo already ships that as
 * `ui/animated-circular-progress-bar.tsx`, so nothing needed pulling for it.
 *
 * A ring is also the WRONG ENCODING for this score. "5 of 7 days" is seven
 * DISCRETE things, and a ring collapses them into one ratio — you can see that
 * you missed two days but never WHICH, which is the only part you can act on.
 * Hence seven cells, not one circle.
 *
 * Components consumed from the repo's own registry: `ui/card` (Card family),
 * `ui/skeleton` (loading). Deliberately NOT consumed:
 *   · `ui/progress` — its fill is hardcoded `bg-pink-500`, the exact token-law
 *     violation that makes pink illegal on the Life page. Importing it would
 *     have smuggled a hardcoded hue in through a shared primitive.
 *   · `ui/toggle-group` — does not exist locally; adding a Radix dependency for
 *     a three-button row would cost more than the row itself. The row below is
 *     a `radiogroup` with real ARIA semantics instead, which is what the
 *     primitive would have delegated to anyway.
 *
 * ── TOKENS (Gate C, read live from src/index.css — never copied from a skill) ──
 *   surface          var(--ws-surface) / var(--ws-surface-raised)
 *   hairline         zinc-800 dark / zinc-200 light (paired for both themes)
 *   signal           var(--page-accent)   <- `data-page="life"` defines it, and
 *                        defines a DIFFERENT (darker) value in light mode for
 *                        contrast on cream. This file holds no literal for it.
 *   danger           var(--error)        <- never a literal
 *   radii            rounded-lg (8) / rounded-xl (12) / rounded-full (pill)
 *   type             Inter (UI) + JetBrains Mono (numbers only) — 2 families
 */


import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Activity, AlertTriangle, ArrowRight, Ban, CalendarClock, Check, ClipboardPaste,
  Copy, Dumbbell, Flame, Inbox, Loader2, Lock, Pencil, Plus, RotateCcw, Sparkles,
  Target, TrendingUp, Trophy, Undo2, X,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { parseCaptureLine, PATTERNS, type CaptureParse } from '../../../shared/captureParse'
import type { Rating } from '../../../shared/srs'

/* ────────────────────────────────────────────────────────────────────────────
 * Panel — the one component that owns the five states.
 * ──────────────────────────────────────────────────────────────────────── */

type PanelState = 'loading' | 'empty' | 'error' | 'ready'

function Panel({
  id, title, hint, state, error, emptyTitle, emptyBody, emptyAction, children, aside,
}: {
  id: string
  title: string
  hint?: string
  state: PanelState
  error?: string | null
  emptyTitle?: string
  emptyBody?: string
  emptyAction?: React.ReactNode
  children?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <Card
      data-section={`life.training.${id}`}
      className="gap-0 rounded-xl border-zinc-800/60 bg-zinc-900/40 p-4 light:border-zinc-200 light:bg-white/60"
    >
      <CardHeader className="flex-row items-start justify-between gap-3 p-0 mb-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold text-zinc-100 light:text-zinc-900">{title}</CardTitle>
          {hint && (
            <CardDescription className="text-xs text-zinc-500 light:text-zinc-600 mt-0.5">{hint}</CardDescription>
          )}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </CardHeader>
      <CardContent className="p-0">

      {/* loading: a skeleton the same height as the content, so nothing jumps
          when data lands. A centred spinner reserves no space and moves the
          layout the instant it is replaced. */}
      {state === 'loading' && (
        <div className="space-y-2" aria-busy="true" aria-label={`Loading ${title}`}>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              className="h-8 w-full rounded-lg bg-zinc-800/50 light:bg-zinc-100"
              style={{ opacity: 1 - i * 0.22 }}
            />
          ))}
        </div>
      )}

      {/* error: the CAUSE, then the way out. `role="alert"` so a screen reader
          announces it without moving focus. */}
      {state === 'error' && (
        <div role="alert" className="rounded-lg border border-[color:var(--error-muted)] bg-[color:var(--error-muted)] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[color:var(--error)] shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[color:var(--error)]">
                {title} could not load
              </p>
              <p className="text-xs text-zinc-400 light:text-zinc-600 mt-1 break-words">
                {error || 'The app could not reach its local database.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 light:border-zinc-300 light:text-zinc-700 light:hover:bg-zinc-100"
              >
                <RotateCcw className="w-3 h-3" aria-hidden /> Reload the app
              </button>
            </div>
          </div>
        </div>
      )}

      {/* empty: an invitation with the action INLINE. "No data" + a button
          elsewhere is the single most common empty-state failure. */}
      {state === 'empty' && (
        <div className="rounded-lg border border-dashed border-zinc-700/70 p-4 text-center light:border-zinc-300">
          <p className="text-sm text-zinc-300 light:text-zinc-700">{emptyTitle}</p>
          {emptyBody && (
            <p className="text-xs text-zinc-500 light:text-zinc-500 mt-1 max-w-sm mx-auto">{emptyBody}</p>
          )}
          {emptyAction && <div className="mt-3 flex justify-center">{emptyAction}</div>}
        </div>
      )}

      {state === 'ready' && children}
      </CardContent>
    </Card>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Shared bits
 * ──────────────────────────────────────────────────────────────────────── */

// PAINT Gate C: no literal, and no fallback hex. `data-page="life"` always
// defines --page-accent for both themes, so a fallback would only ever mask
// the case where the token is missing.
const ACCENT = 'var(--page-accent)'

const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      style={{ background: 'var(--page-accent)', ...(rest.style || {}) }}
      className={`${btn} hover:opacity-90 ${rest.className || ''}`}
    >
      {children}
    </button>
  )
}

function GhostButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${btn} border border-zinc-700 text-zinc-300 hover:bg-zinc-800 light:border-zinc-300 light:text-zinc-700 light:hover:bg-zinc-100 ${rest.className || ''}`}
    >
      {children}
    </button>
  )
}

const dstr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function mondayOf(d: Date): string {
  const m = new Date(d)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return dstr(m)
}

/* ────────────────────────────────────────────────────────────────────────────
 * F1 · QUICK CAPTURE
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * The whole feature is "type one line, press enter, done". So the box is ONE
 * line by default. Fields appear UNDERNEATH it only once something was
 * recognised, and anything the parser guessed is shown amber with a one-tap
 * correction — never silently written.
 *
 * The parser runs LOCALLY on every keystroke (debounced) rather than over IPC on
 * each character: a round trip per keystroke for a string under 200 chars is
 * latency with no benefit, and it would make the box feel laggy on the one path
 * that must feel instant.
 */
function QuickCapture({ onCommitted }: { onCommitted: () => void }) {
  const [text, setText] = useState('')
  const [parse, setParse] = useState<CaptureParse | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [minutes, setMinutes] = useState('')
  const [result, setResult] = useState<'solved' | 'stuck' | 'reading'>('solved')
  const [pattern, setPattern] = useState('')
  const [busy, setBusy] = useState(false)
  const [undo, setUndo] = useState<{ text: string; at: number } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const p = parseCaptureLine(text, new Date().getHours() * 60 + new Date().getMinutes())
      setParse(p)
      if (p.minutes !== null) setMinutes(String(p.minutes))
      if (p.result) setResult(p.result as typeof result)
      if (p.pattern) setPattern(p.pattern)
      if (!p.empty) setExpanded(true)
    }, 120)
    return () => clearTimeout(t)
  }, [text])

  // The hotkey. Focus is moved AND the field selected, so typing replaces the
  // previous line instead of appending to it -- the commonest way a one-line
  // box gets a one-line-plus-stale-text entry.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const off = window.deskflowAPI?.onFocusCapture?.(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return typeof off === 'function' ? off : undefined
  }, [])

  const canSave = !!parse && !parse.empty && !busy

  const commit = async () => {
    if (!canSave || !parse) return
    setBusy(true)
    const snapshot = text
    try {
      const res: any = await window.deskflowAPI?.captureCommit?.({
        count: parse.count ?? undefined,
        minutes: minutes === '' ? null : Number(minutes),
        pattern: pattern || null,
        result,
        topic: parse.topic || undefined,
      })
      if (res?.success) {
        // UNDO. A capture that cannot be taken back is a capture CZ will stop
        // using the moment it misfires. The box keeps the text for 8 seconds so
        // the mistake can be corrected rather than retyped.
        setUndo({ text: snapshot, at: Date.now() })
        setTimeout(() => setUndo((u) => (u && Date.now() - u.at >= 8000 ? null : u)), 8300)
        setText(''); setParse(null); setExpanded(false); setMinutes(''); setPattern('')
        onCommitted()
      }
    } finally { setBusy(false) }
  }

  return (
    <Panel
      id="capture"
      title="Log a session"
      hint="One line. Anything the parser is unsure about is flagged for you, not decided for you."
      state="ready"
      aside={
        <kbd className="hidden sm:inline rounded-md border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 light:border-zinc-300">
          Ctrl ⇧ Space
        </kbd>
      }
    >
      <label htmlFor="df-capture" className="sr-only">
        Log a training session in one line
      </label>
      <div className="flex gap-2">
        <input
          id="df-capture"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          placeholder="2 leetcode, hash map, got stuck on prefix sum"
          disabled={busy}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 light:border-zinc-300 light:bg-white light:text-zinc-900"
          style={{ borderColor: 'var(--page-accent)' }}
          aria-describedby="df-capture-help"
        />
        <PrimaryButton onClick={commit} disabled={!canSave} aria-busy={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Check className="w-3.5 h-3.5" aria-hidden />}
          Log it
        </PrimaryButton>
      </div>

      <p id="df-capture-help" className="mt-1.5 text-[11px] text-zinc-500 light:text-zinc-500">
        Recognised: <span className="font-mono text-zinc-400 light:text-zinc-600">{PATTERNS.slice(0, 4).join(' · ')}</span>
      </p>

      {expanded && parse && !parse.empty && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.18 }}
          className="mt-3 grid gap-2 sm:grid-cols-3"
        >
          <div>
            <label htmlFor="df-cap-min" className="block text-[11px] text-zinc-500 mb-1">Minutes</label>
            <input id="df-cap-min" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm light:border-zinc-300 light:bg-white" />
          </div>
          <div>
            <label htmlFor="df-cap-res" className="block text-[11px] text-zinc-500 mb-1">How it went</label>
            <select id="df-cap-res" value={result} onChange={(e) => setResult(e.target.value as typeof result)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm light:border-zinc-300 light:bg-white">
              <option value="solved">Solved it cold</option>
              <option value="stuck">Got stuck</option>
              <option value="reading">Read / watched</option>
            </select>
          </div>
          <div>
            <label htmlFor="df-cap-pat" className="block text-[11px] text-zinc-500 mb-1">Pattern</label>
            <select id="df-cap-pat" value={pattern} onChange={(e) => setPattern(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm light:border-zinc-300 light:bg-white">
              <option value="">Not tagged</option>
              {PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </motion.div>
      )}

      {parse && parse.ambiguities.length > 0 && (
        <ul className="mt-3 space-y-1" aria-live="polite">
          {parse.ambiguities.map((a, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-[color:var(--error-muted)] px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[color:var(--error)] shrink-0 mt-0.5" aria-hidden />
              <p className="text-[11px] text-[color:var(--error)]">{a.question}</p>
            </li>
          ))}
        </ul>
      )}

      {undo && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-700 px-2.5 py-1.5" role="status">
          <Check className="w-3.5 h-3.5" style={{ color: ACCENT }} aria-hidden />
          <span className="text-[11px] text-zinc-400 flex-1">Logged.</span>
          <GhostButton onClick={() => { setText(undo.text); setUndo(null) }}>
            <Undo2 className="w-3 h-3" aria-hidden /> Undo
          </GhostButton>
        </div>
      )}
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * F3 · THE QUEUE + THE LEDGER
 * ──────────────────────────────────────────────────────────────────────── */

interface QueueCard { id: string; pattern: string; title: string; due: string | null; hint?: string | null }

function ReviewQueue() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [cards, setCards] = useState<QueueCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading'); setError(null)
    try {
      const r: any = await window.deskflowAPI?.trainingCardsDue?.()
      if (r?.success) { setCards(r.cards || []); setState('ready') }
      else { setError(r?.error); setState('error') }
    } catch (e: any) { setError(e.message); setState('error') }
  }, [])

  useEffect(() => { load() }, [load])

  const rate = async (card: QueueCard, rating: Rating) => {
    setPending(card.id)                      // pending state: the row stays visible,
    const r: any = await window.deskflowAPI?.trainingCardReview?.({ cardId: card.id, rating })  // disabled
    setPending(null)                         // — hiding it invites double submits
    if (r?.success) setCards((c) => c.filter((x) => x.id !== card.id))
  }

  return (
    <Panel
      id="queue"
      title="Due for review"
      hint="Day 3, then day 10. Only things you solved cold go in here."
      state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : cards.length === 0 ? 'empty' : 'ready'}
      error={error}
      emptyTitle="Nothing due"
      emptyBody="Solve something cold and it will show up here three days later. An empty queue is the goal, not a gap."
    >
      <ul className="space-y-2">
        {cards.map((c) => (
          <li key={c.id} className="rounded-lg border border-zinc-800 light:border-zinc-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-100 light:text-zinc-900 truncate">{c.title}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                  {c.pattern || 'untagged'} · {c.hint || 'new'}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex gap-1.5" role="group" aria-label={`Recall ${c.title}`}>
              {([['recalled', 'Got it'], ['partial', 'Partly'], ['forgotten', 'No']] as const).map(([v, lbl]) => (
                <button
                  key={v} disabled={pending === c.id} onClick={() => rate(c, v)}
                  className={`${btn} flex-1 border ${v === 'recalled'
                    ? 'border-emerald-600/50 text-emerald-300 hover:bg-emerald-500/10'
                    : v === 'partial' ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-800'
                    : 'border-rose-600/40 text-rose-300 hover:bg-rose-500/10'}`}
                  style={{ borderColor: v === 'recalled' ? undefined : undefined }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

interface Outcome {
  id: string; date: string; kind: string; title: string; count: number;
  cold: boolean | null; pattern: string | null
}

const KIND_LABEL: Record<string, string> = {
  problem_solved: 'Problem', pr_opened: 'PR opened', pr_merged: 'PR merged', contest: 'Contest',
}

function Ledger() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [rows, setRows] = useState<Outcome[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState('pr_opened')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState('loading'); setError(null)
    const from = mondayOf(new Date()); const to = dstr(new Date(Date.now() + 6 * 864e5))
    try {
      const r: any = await window.deskflowAPI?.trainingOutcomesList?.(from, to)
      if (r?.success) { setRows(r.outcomes || []); setState('ready') }
      else { setError(r?.error); setState('error') }
    } catch (e: any) { setError(e.message); setState('error') }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    const r: any = await window.deskflowAPI?.captureCommit?.({ topic: title.trim(), count: 1, result: null })
    setBusy(false)
    if (r?.success) { setTitle(''); setAdding(false); load() }
  }

  const cold = rows.filter((r) => r.cold === true).length

  return (
    <Panel
      id="ledger"
      title="What landed"
      hint="Immutable. A correction is a new row, so March stays answerable."
      state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
      error={error}
      emptyTitle="Nothing logged this week"
      emptyBody="Problems, PRs and contests all land here. Nothing is ever edited in place."
      emptyAction={<PrimaryButton onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" aria-hidden /> Add a PR or contest</PrimaryButton>}
      aside={
        <div className="flex items-center gap-2">
          {cold > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 light:border-zinc-300 light:text-zinc-700">
              <Trophy className="w-3 h-3" style={{ color: ACCENT }} aria-hidden /> {cold} cold
            </span>
          )}
          <GhostButton onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            <Plus className="w-3 h-3" aria-hidden /> Add
          </GhostButton>
        </div>
      }
    >
      {adding && (
        <div className="mb-3 flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Outcome type"
            className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm light:border-zinc-300 light:bg-white">
            <option value="pr_opened">PR opened</option>
            <option value="pr_merged">PR merged</option>
            <option value="contest">Contest</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
            aria-label="Outcome title"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm light:border-zinc-300 light:bg-white" />
          <PrimaryButton onClick={add} disabled={!title.trim() || busy}>Save</PrimaryButton>
        </div>
      )}

      <ul className="divide-y divide-zinc-800/70 light:divide-zinc-200">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-zinc-500">{r.date.slice(5)}</span>
            <span className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 shrink-0 light:border-zinc-300 light:text-zinc-600">
              {KIND_LABEL[r.kind] || r.kind}
            </span>
            <span className="flex-1 min-w-0 truncate text-sm text-zinc-200 light:text-zinc-800">
              {r.count > 1 && <span className="font-mono text-zinc-500 mr-1.5">×{r.count}</span>}
              {r.title}
            </span>
            {r.cold === true && <span className="text-[10px] font-mono shrink-0" style={{ color: ACCENT }}>COLD</span>}
            {r.cold === false && <span className="text-[10px] text-zinc-500 shrink-0">with help</span>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * F4 · THE WEEK
 * ──────────────────────────────────────────────────────────────────────── */

function WeekStrip() {
  // Gate E: the strip animates on mount via CSS transition. Under
  // prefers-reduced-motion the bars must simply be there — an animated bar chart
  // is not decorative, but its ENTRANCE is, and motion that carries no
  // information is exactly what the setting is asking us to drop.
  const reduceMotion = useReducedMotion()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [score, setScore] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setState('loading')
      try {
        const r: any = await window.deskflowAPI?.trainingWeekScore?.(mondayOf(new Date()))
        if (r?.success) { setScore(r.score); setState('ready') } else { setError(r?.error); setState('error') }
      } catch (e: any) { setError(e.message); setState('error') }
    })()
  }, [])

  if (state === 'error') {
    return <Panel id="week" title="This week" state="error" error={error} />
  }

  const days = score?.days ?? []
  const done = score?.daysHit ?? 0

  return (
    <Panel
      id="week"
      title="This week"
      hint="Not a streak. Five days is a win — a bad week resets the count, not the year."
      state={state === 'loading' ? 'loading' : 'ready'}
      aside={
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-lg text-zinc-100 light:text-zinc-900">{done}</span>
          <span className="font-mono text-xs text-zinc-500">/ {score?.goalDays ?? 5}</span>
        </div>
      }
    >
      {state === 'loading' ? null : (
        <>
          {/* Seven equal cells. The bars are a PROPORTION OF THE GOAL, not of the
              best day — so a 40-minute day next to a 200-minute day does not read
              as a failure. Absolute height against a fixed max would. */}
          <div className="flex items-end gap-1.5 h-16" role="img"
            aria-label={`${done} of ${score?.goalDays ?? 5} days met the minimum`}>
            {days.map((d: any) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${Math.max(4, Math.min(100, (d.minutes / Math.max(20, score?.goalMinutes ?? 60)) * 100))}%`,
                    // Unmet days are a NEUTRAL, not a dimmed accent: a day you missed is information,
                    // not a dimmer version of a day you hit.
                    background: d.metMinimum ? ACCENT : 'var(--ws-surface-hover)',
                    // Gate E: animate `height` only when motion is welcome. `height` is
                    // on PAINT's do-not-animate list, so when motion IS allowed we
                    // animate it deliberately and at a single fixed duration — the
                    // alternative (animating a transform-scaled child) would need a
                    // wrapper per bar for no perceptual gain at this size.
                    transition: reduceMotion ? 'none' : 'height 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <span className="font-mono text-[9px] text-zinc-600">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400 light:text-zinc-600">{score?.copy?.headline}</p>
          {score?.copy?.body && (
            <p className="mt-1 text-[11px] text-zinc-500 light:text-zinc-500">{score.copy.body}</p>
          )}
        </>
      )}
    </Panel>
  )
}


/* ────────────────────────────────────────────────────────────────────────────
 * F4 · THE RULES — the two numbers, editable where you read them
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * PROGRESSIVE DISCLOSURE, and a correctness requirement at the same time.
 * `training_minimum_day_minutes` and `training_weekly_win_days` were both READ by
 * the weekly-score handler and written by NOTHING, so "configurable minimum day"
 * and "5/7 win" were decorative — the numbers silently fell back to defaults
 * forever. A read with no writer is a lie no test can see.
 *
 * They live HERE rather than in Settings for a reason that is about honesty
 * rather than convenience: these two numbers only mean anything next to the
 * week strip that applies them. Putting them in Settings would make them real
 * *and* put them two screens away from their only use. The rules for the score
 * are part of reading the score.
 */
function TrainingRules({ onChanged }: { onChanged: () => void }) {
  const [min, setMin] = useState<number | null>(null)
  const [win, setWin] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    (async () => {
      const r: any = await window.deskflowAPI?.trainingGetPrefs?.()
      if (r) { setMin(r.minimumDayMinutes); setWin(r.weeklyWinDays) }
    })()
  }, [])

  if (min === null || win === null) return null

  const save = async (patch: { minimumDayMinutes?: number; weeklyWinDays?: number }) => {
    setSaving(true); setSaved(false)
    const r: any = await window.deskflowAPI?.trainingSetPrefs?.(patch)
    setSaving(false)
    if (r) {
      setMin(r.minimumDayMinutes); setWin(r.weeklyWinDays)
      setSaved(true)
      onChanged()
      // Clear the confirmation so it does not become permanent chrome.
      setTimeout(() => setSaved(false), 2200)
    }
  }

  return (
    <Panel
      id="rules"
      title="The rules"
      hint="A day counts once it clears the minimum. The win line is what counts as a good week."
      state="ready"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="df-min-mins" className="block text-[11px] text-zinc-500 mb-1">
            Minimum for a day to count
          </label>
          <div className="flex items-center gap-2">
            <input
              id="df-min-mins" type="number" min={5} max={600} step={5} value={min}
              disabled={saving}
              onChange={(e) => setMin(Math.max(5, Math.min(600, Number(e.target.value) || 5)))}
              onBlur={() => min !== undefined && save({ minimumDayMinutes: min })}
              className="w-24 rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm font-mono light:border-zinc-300 light:bg-white"
            />
            <span className="text-xs text-zinc-500">minutes</span>
          </div>
        </div>
        <div>
          <label htmlFor="df-win-days" className="block text-[11px] text-zinc-500 mb-1">
            Days that make a good week
          </label>
          <select
            id="df-win-days" value={win} disabled={saving}
            onChange={(e) => save({ weeklyWinDays: Number(e.target.value) })}
            className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1.5 text-sm font-mono light:border-zinc-300 light:bg-white"
          >
            {[3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} of 7</option>)}
          </select>
        </div>
      </div>
      <p aria-live="polite" className="mt-2 h-4 text-[11px] text-zinc-500">
        {saved ? 'Saved.' : ''}
      </p>
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * F5 · PHASE  +  F7 · PLAN MODE
 * ──────────────────────────────────────────────────────────────────────── */

function PhaseCard() {
  const [phase, setPhase] = useState<any>(null)
  const [label, setLabel] = useState('')
  const [summary, setSummary] = useState('')
  const [rules, setRules] = useState<any>(null)
  const [drift, setDrift] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<any>(null)

  const load = useCallback(async () => {
    const r: any = await window.deskflowAPI?.trainingPhaseCurrent?.()
    if (r?.success) {
      setPhase(r.phase); setLabel(r.label); setSummary(r.summary); setRules(r.rules); setDrift(r.driftQuestion)
    }
    const p: any = await window.deskflowAPI?.planModeStatus?.({})
    if (p?.success) setPlan(p)
  }, [])
  useEffect(() => { load() }, [load])

  const answer = async (a: 'yes' | 'not_now' | 'no') => {
    setBusy(true); await window.deskflowAPI?.trainingPhaseAnswerDrift?.({ answer: a }); setDrift(null); setBusy(false)
  }

  const flip = async () => {
    if (!phase) return
    setBusy(true)
    const r: any = await window.deskflowAPI?.trainingPhaseSetMode?.({
      phaseId: phase.id, mode: phase.mode === 'learn' ? 'burn_down' : 'learn',
    })
    setBusy(false)
    if (r?.success) { setPhase((p: any) => ({ ...p, mode: r.mode, checklist: r.checklist })); setSummary(r.summary) }
  }

  const breakIt = async () => {
    const phrase = window.prompt(`Type "${'break the block'}" to confirm. This week’s review will name it.`)
    if (!phrase) return
    const r: any = await window.deskflowAPI?.planModeBreak?.({ phrase })
    if (r?.success) setPlan((p: any) => ({ ...p, breaksThisWeek: r.breaksThisWeek, warning: r.warning }))
  }

  return (
    <Panel
      id="phase"
      title={label || 'Phase'}
      hint={summary}
      state="ready"
      aside={phase ? (
        <GhostButton onClick={flip} disabled={busy} aria-busy={busy}>
          <RotateCcw className="w-3 h-3" aria-hidden /> Switch phase
        </GhostButton>
      ) : undefined}
    >
      {!phase ? (
        <p className="text-xs text-zinc-500 light:text-zinc-500">
          No phase is running. Start one on the River to get rules and a checklist here.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {(phase.checklist ?? []).map((c: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-200 light:text-zinc-800">
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: ACCENT }} aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          {rules && (
            <p className="mt-3 text-[11px] text-zinc-500 light:text-zinc-500 font-mono">
              floor {rules.reviewFloorMinutes}m · {rules.newTopicsAllowed ? 'new topics open' : 'no new topics'}
            </p>
          )}
        </>
      )}

      {drift && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-lg border border-[color:var(--error-muted)] bg-[color:var(--error-muted)] p-3" role="group" aria-label="Phase drift">
          <p className="text-xs text-[color:var(--error)] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span><strong className="font-semibold">{drift.question}</strong> {drift.why}</span>
          </p>
          <div className="mt-2 flex gap-1.5">
            {([['yes', 'Yes, new phase'], ['not_now', 'Not now'], ['no', 'No']] as const).map(([v, l]) => (
              <GhostButton key={v} onClick={() => answer(v)} disabled={busy}>{l}</GhostButton>
            ))}
          </div>
        </motion.div>
      )}

      {plan?.verdict?.locked && (
        <div className="mt-3 rounded-lg border border-zinc-700 p-3">
          <p className="text-xs text-zinc-300 light:text-zinc-700 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>{plan.verdict.reason}</span>
          </p>
          {plan.breaksThisWeek > 0 && (
            <p className="mt-1.5 text-[11px] text-zinc-500">Broken {plan.breaksThisWeek}× this week.</p>
          )}
          <GhostButton className="mt-2" onClick={breakIt}>
            <Ban className="w-3 h-3" aria-hidden /> Change the plan anyway
          </GhostButton>
        </div>
      )}
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * F6 · THE WEEKLY REVIEW
 * ──────────────────────────────────────────────────────────────────────── */

/** ONE proposal. The copy says so explicitly, because "one change" is the
 *  difference between a coach and a to-do generator. */
function WeeklyReview() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [review, setReview] = useState<any>(null)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('loading'); setError(null)
    try {
      const r: any = await window.deskflowAPI?.trainingReviewWeekly?.(mondayOf(new Date()))
      if (r?.success) { setReview(r.review); setAccepted(!!r.accepted); setState('ready') }
      else { setError(r?.error); setState('error') }
    } catch (e: any) { setError(e.message); setState('error') }
  }, [])
  useEffect(() => { load() }, [load])

  const accept = async () => {
    if (!review) return
    await window.deskflowAPI?.trainingReviewAccept?.({ weekKey: review.weekKey, text: review.proposal?.text })
    setAccepted(true)
  }

  return (
    <Panel
      id="review"
      title="Weekly review"
      hint="One thing to change. Not a list."
      state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'ready'}
      error={error}
    >
      {state !== 'ready' ? null : review?.allClear ? (
        <p className="text-sm text-zinc-300 light:text-zinc-700">
          Nothing to fix this week. That is a good week, not a missing feature.
        </p>
      ) : review?.proposal ? (
        <div className="rounded-lg border p-3" style={{ borderColor: ACCENT }}>
          <p className="text-sm text-zinc-100 light:text-zinc-900">{review.proposal.text}</p>
          {review.proposal.why && (
            <p className="mt-1.5 text-[11px] text-zinc-500 light:text-zinc-500">{review.proposal.why}</p>
          )}
          {accepted ? (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <Check className="w-3.5 h-3.5" style={{ color: ACCENT }} aria-hidden /> Accepted
            </p>
          ) : (
            <PrimaryButton className="mt-2.5" onClick={accept}>Accept this one change</PrimaryButton>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400 light:text-zinc-600">Nothing stood out. Carry on.</p>
      )}

      {review && (
        <p className="mt-3 font-mono text-[11px] text-zinc-500">
          {review.done}/{review.planned} planned · {review.headline}
        </p>
      )}
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * F2 · THE AI BRIDGE
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Parse → validate → DIFF → apply. The apply button does not exist until the
 * diff does. That is the entire safety property of the feature expressed in one
 * conditional, and it is why the renderer cannot shortcut it: `commit` re-parses
 * server-side and refuses an invalid plan regardless of what the UI did.
 */
function AiBridge() {
  const [raw, setRaw] = useState('')
  const [prepared, setPrepared] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState<any>(null)
  const [promptText, setPromptText] = useState<string | null>(null)

  const validate = async () => {
    if (!raw.trim()) return
    setBusy(true); setApplied(null)
    const r: any = await window.deskflowAPI?.trainingPlanPrepare?.(raw)
    setBusy(false)
    if (r?.success) setPrepared(r)
  }

  const apply = async () => {
    setBusy(true)
    const r: any = await window.deskflowAPI?.trainingPlanCommit?.(raw)
    setBusy(false)
    if (r?.success) { setApplied(r.applied); setRaw(''); setPrepared(null) }
  }

  const grabPrompt = async () => {
    const r: any = await window.deskflowAPI?.trainingPlanPrompt?.()
    if (r?.success) {
      setPromptText(r.prompt)
      try { await navigator.clipboard.writeText(r.prompt) } catch { /* clipboard may be blocked */ }
    }
  }

  const ok = prepared?.ok

  return (
    <Panel
      id="ai"
      title="Coach’s plan"
      hint="Paste a reply from any assistant. Nothing is applied until you have read the diff."
      state="ready"
      aside={<GhostButton onClick={grabPrompt}><Copy className="w-3 h-3" aria-hidden /> Copy the prompt</GhostButton>}
    >
      {promptText && (
        <details className="mb-3 rounded-lg border border-zinc-700 p-2.5">
          <summary className="cursor-pointer text-[11px] text-zinc-400">Prompt copied to your clipboard</summary>
          <pre className="mt-2 max-h-40 overflow-auto font-mono text-[10px] text-zinc-500 whitespace-pre-wrap">{promptText}</pre>
        </details>
      )}

      <label htmlFor="df-ai-raw" className="sr-only">Paste the assistant’s JSON reply</label>
      <textarea
        id="df-ai-raw" value={raw} onChange={(e) => setRaw(e.target.value)} rows={4}
        placeholder={'{"schemaVersion":"1.0.0","tasks":[…],"outcomes":[…],"deadlineMoves":[…]}'}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950/60 px-2.5 py-2 font-mono text-[11px] text-zinc-100 light:border-zinc-300 light:bg-white light:text-zinc-900"
      />

      <div className="mt-2 flex gap-1.5">
        <GhostButton onClick={validate} disabled={!raw.trim() || busy} aria-busy={busy}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <ClipboardPaste className="w-3 h-3" aria-hidden />}
          Check it
        </GhostButton>
      </div>

      {prepared && !ok && (
        <div role="alert" className="mt-3 rounded-lg border border-[color:var(--error-muted)] bg-[color:var(--error-muted)] p-3">
          <p className="text-xs font-medium text-[color:var(--error)]">
            {prepared.report.issues.length} thing{prepared.report.issues.length === 1 ? '' : 's'} to fix
          </p>
          <ul className="mt-1.5 space-y-1">
            {prepared.report.issues.map((i: any, k: number) => (
              <li key={k} className="font-mono text-[10px] text-[color:var(--error)]">
                {i.path}: {i.problem}
              </li>
            ))}
          </ul>
          {prepared.repairPrompt && (
            <>
              <p className="mt-2 text-[10px] text-zinc-500 uppercase tracking-wider">Repair prompt</p>
              <pre className="mt-1 max-h-32 overflow-auto rounded bg-zinc-950/60 p-2 font-mono text-[10px] text-zinc-400 whitespace-pre-wrap light:bg-zinc-50">
                {prepared.repairPrompt}
              </pre>
              <GhostButton className="mt-2"
                onClick={async () => { try { await navigator.clipboard.writeText(prepared.repairPrompt!) } catch { /* blocked */ } }}>
                <Copy className="w-3 h-3" aria-hidden /> Copy repair prompt
              </GhostButton>
            </>
          )}
        </div>
      )}

      {prepared && ok && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: ACCENT }}>
          <p className="text-xs font-semibold text-zinc-100 light:text-zinc-900">
            {prepared.diff.length} change{prepared.diff.length === 1 ? '' : 's'} — nothing applied yet
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {prepared.diff.map((d: string, i: number) => (
              <li key={i} className="font-mono text-[10px] text-zinc-400 light:text-zinc-600">+ {d}</li>
            ))}
          </ul>
          <PrimaryButton className="mt-2.5" onClick={apply} disabled={busy}>
            <Check className="w-3.5 h-3.5" aria-hidden /> Apply all {prepared.diff.length}
          </PrimaryButton>
        </div>
      )}

      {applied && (
        <p role="status" className="mt-3 text-xs text-zinc-400">
          Applied: {applied.tasks} task{applied.tasks === 1 ? '' : 's'}, {applied.outcomes} outcome
          {applied.outcomes === 1 ? '' : 's'}{applied.moved ? `, ${applied.moved} deadline moved` : ''}.
        </p>
      )}
    </Panel>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * The page
 * ──────────────────────────────────────────────────────────────────────── */

// Named export, matching `export { SchedulePage }`. The previous `export default`
// compiled perfectly in isolation and then FAILED the moment LifePage imported it
// as a named binding -- so the version that matters was never the file that
// imported it. Any new surface needs its importer in the resolve check.
export function TrainingPage() {
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  return (
    <div className="w-full space-y-4 pb-8" data-section="life.training" key={nonce}>
      <header>
        <h2 className="text-lg font-semibold text-zinc-100 light:text-zinc-900">Training</h2>
        <p className="text-xs text-zinc-500 light:text-zinc-500 mt-0.5 max-w-xl">
          What you solved, what is due, and one thing to change. Hours are not the score.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4"><QuickCapture onCommitted={refresh} /></div>
        <div className="space-y-4">
          <WeekStrip key={`week-${nonce}`} />
          <TrainingRules onChanged={refresh} />
        </div>
        <div className="space-y-4"><PhaseCard /></div>
        <div className="space-y-4"><WeeklyReview /></div>
        <div className="space-y-4 lg:col-span-2"><ReviewQueue /></div>
        <div className="space-y-4 lg:col-span-2"><Ledger /></div>
        <div className="space-y-4 lg:col-span-2"><AiBridge /></div>
      </div>
    </div>
  )
}