import { getToastDurationMs, isSticky } from '../../../lib/toastDuration';
import { useEffect, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { LoaderCircle, TriangleAlert, Check, X, ClipboardCopy } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'info'
type ToastMsg = { id: number; text: string; kind: ToastKind }
let toastSeq = 1
const toastListeners = new Set<(t: ToastMsg) => void>()

export function toast(text: string, kind: ToastKind = 'success') {
  const msg = { id: toastSeq++, text, kind }
  toastListeners.forEach((l) => l(msg))
}

export function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(() => {
    const fn = (t: ToastMsg) => {
      setItems((prev) => [...prev.slice(-3), t])
      const ms = getToastDurationMs()
      if (!isSticky(ms)) window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), ms)
    }
    toastListeners.add(fn)
    return () => { toastListeners.delete(fn) }
  }, [])
  if (items.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-xl',
          t.kind === 'success' && 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200',
          t.kind === 'error' && 'border-rose-500/30 bg-rose-950/90 text-rose-200',
          t.kind === 'info' && 'border-white/[0.08] bg-[#141419]/95 text-zinc-200',
        )}>
          {t.kind === 'success' && <Check size={12} className="shrink-0 text-emerald-400" />}
          {t.kind === 'error' && <X size={12} className="shrink-0 text-rose-400" />}
          {t.kind === 'info' && <LoaderCircle size={12} className="shrink-0 animate-spin text-[#f5c518]" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-white/[0.06] bg-[rgba(24,24,27,0.60)] p-5 backdrop-blur-xl', className)}>
      {children}
    </div>
  )
}

export function SectionHeader({ label, title, action }: { label: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] tracking-wide text-zinc-500 uppercase">{label}</div>
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300', className)}>
      {children}
    </span>
  )
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={cn('animate-spin text-[#f5c518]', className)} />
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-zinc-400">
      <Spinner size={20} />
      <span className="text-xs">{label}</span>
    </div>
  )
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
      <div className="text-zinc-600">{icon}</div>
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      {hint && <div className="max-w-sm text-xs text-zinc-500">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-rose-400" />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-rose-300">Something went wrong</div>
        <div className="mt-0.5 text-xs break-words text-rose-200/70">{message}</div>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 h-7 rounded-md bg-rose-500/15 px-2.5 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/25">
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
export function AmberButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#f5c518] px-3 text-xs font-semibold text-black transition-all hover:brightness-110 active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function GhostButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ConfirmIconButton({ onConfirm, icon, label, confirmLabel = 'Confirm', className }: { onConfirm: () => void; icon: ReactNode; label: string; confirmLabel?: string; className?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (armed) { setArmed(false); onConfirm() } else setArmed(true)
      }}
      title={label}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium transition-colors',
        armed ? 'bg-rose-500/15 text-rose-300' : 'text-zinc-500 hover:bg-white/[0.06] hover:text-rose-300',
        className,
      )}
    >
      {armed ? <Check size={11} /> : icon}
      {armed && <span>{confirmLabel}</span>}
    </button>
  )
}

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(1, score)) * 100
  const color = score < 0.6 ? 'bg-rose-500' : score <= 0.8 ? 'bg-[#f5c518]' : 'bg-emerald-500'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
  scripted: 'border-[#f5c518]/25 bg-[#f5c518]/10 text-[#f5c518]',
  gated: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
  filming: 'border-[#00d4ff]/25 bg-[#00d4ff]/10 text-[#00d4ff]',
  published: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  raw: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
  refined: 'border-[#00d4ff]/25 bg-[#00d4ff]/10 text-[#00d4ff]',
  approved: 'border-[#f5c518]/25 bg-[#f5c518]/10 text-[#f5c518]',
  used: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  active: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  applied: 'border-[#00d4ff]/25 bg-[#00d4ff]/10 text-[#00d4ff]',
  dismissed: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
}

export function StatusChip({ status }: { status?: string }) {
  const s = String(status ?? '')
  const color = STATUS_COLORS[s] || 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400'
  return (
    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase', color)}>
      {s || 'unknown'}
    </span>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-[#f5c518]/50',
        className,
      )}
      {...rest}
    />
  )
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-[#f5c518]/50',
        className,
      )}
      {...rest}
    />
  )
}

export function SelectInput({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-8 w-full rounded-lg border border-white/[0.08] bg-[#1a1a20] px-2 text-xs text-zinc-100 outline-none transition-colors focus:border-[#f5c518]/50',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-[9px] font-medium tracking-wider text-zinc-500 uppercase">{children}</label>
}

// ═══════════════════════════════════════════════
// Field Prompt System — static prompts for external AI
// ═══════════════════════════════════════════════

export const FIELD_PROMPTS: Record<string, string> = {
  // Brainstorm
  'brainstorm-idea': `You are a content strategist. Generate 5 specific video/content ideas about the topic below. Each idea must be: (1) a concrete, filmable concept (not abstract), (2) have a clear hook in the title, (3) be suitable for a 5-15 minute video.

Output as a numbered list, one idea per line. Each line: "Title — one-sentence concept"

Topic:`,

  // Themes
  'theme-name': `You are a content brand strategist. Given a topic or niche, output EXACTLY ONE theme/series name (2-5 words) that is catchy, memorable, and describes a content series.

Rules: Output ONLY the name. No quotes, no explanation. Must work as a series title.

Topic:`,

  'theme-description': `You are a content strategist. Write a 1-2 sentence description for a content series about the topic below. The description should explain what the series covers and who it's for.

Rules: 20-40 words max. Be specific, not generic. No "welcome to" or "this series is about" filler.

Topic:`,

  // Episodes
  'episode-title': `You are a YouTube content planner. Given a topic, output EXACTLY ONE episode title (5-10 words) that creates curiosity and promises value. Use patterns like "How X does Y", "Why X fails at Y", "X vs Y: the real difference".

Rules: Output ONLY the title. No quotes, no numbering. Must make someone want to click.

Topic:`,

  'episode-hook': `You are a script writer. Write a 2-3 sentence opening hook for a video about the topic below. The hook must: (1) state a surprising fact or bold claim, (2) create a curiosity gap, (3) make the viewer want to keep watching.

Rules: 30-50 words max. Start with the most attention-grabbing part. No "Hey guys" or "In today's video" openers.

Topic:`,

  'episode-frame': `You are a video script writer. Write ONE script frame (bullet point) for a video about the topic below. Each frame is 1-2 sentences that the narrator would say. Be specific, use examples, avoid vague statements.

Rules: Output ONLY the frame text. No numbering, no labels. 15-25 words.

Topic:`,

  // Series
  'series-name': `You are a content brand strategist. Generate a content series name (2-5 words) that is: memorable, describes the niche, and works as a hashtag.

Rules: Output ONLY the name. No quotes. Must be unique and brandable.

Niche:`,

  'series-description': `You are a content strategist. Write a 2-sentence description for a content series. First sentence: what the series covers. Second sentence: who it's for and what they'll gain.

Rules: 30-50 words max. Be specific about the value proposition.

Niche:`,

  'series-niche': `You are a content strategist. Given a broad topic, output 3-5 specific niche keywords (comma-separated) that define the content focus area. Be specific — not "technology" but "AI coding tools for solo developers".

Rules: Output ONLY the comma-separated keywords. 3-5 words each.

Topic:`,

  'series-tone': `You are a content strategist. Suggest a content tone/voice (2-4 adjectives) for a series about the topic below. Consider: audience age, platform, competition, and what tone would stand out.

Rules: Output ONLY the tone adjectives, comma-separated. e.g. "conversational, witty, fast-paced"

Topic:`,

  'series-visual-style': `You are a video producer. Suggest a visual style (2-4 descriptors) for a content series about the topic below. Consider: brand identity, thumbnail appeal, visual consistency.

Rules: Output ONLY the style descriptors, comma-separated. e.g. "clean, minimal, bold text overlays"

Topic:`,

  'series-pacing': `You are a video editor. Suggest a pacing style for a content series about the topic below. Consider: content density, audience retention patterns, platform norms.

Rules: Output ONLY the pacing description, 3-6 words. e.g. "fast cuts, 2s per beat"

Topic:`,

  // Reflection
  'reflection': `You are a content creator reflecting on a video/project. Write a reflection covering: (1) What went well, (2) What surprised you, (3) What the data says vs your gut feeling, (4) One thing you'd do differently.

Rules: 100-200 words. Be honest and specific. Use "I" statements. Reference concrete moments, not generalizations.

Project:`,

  // Framework explanation
  'framework-description': `You are a content strategy consultant. Write the one-paragraph explanation for a reusable content framework — the thing a creator reads BEFORE using it.

Cover: (1) what problem this framework solves, (2) when to reach for it, (3) what outcome it guarantees. Two sentences maximum. No rules here — the rules are a separate field.

Framework name:`,

  // Framework rules
  'framework-rules': `You are a content strategy consultant. Write 5-8 production rules/guidelines for a content creator. Each rule should be: (1) specific and actionable, (2) based on best practices, (3) enforceable (not vague "do your best").

Format: One rule per line. Start each with a verb. Be direct.

Content type:`,

  // Analytics
  'retention-csv': `You are a YouTube analytics expert. Given a video topic and description, predict a realistic retention curve as comma-separated percentages (10 values, representing 10% intervals from 0% to 90% of the video).

Rules: Start at 100%, end between 30-60%. Include a dip in the first 10% (hook test), a plateau in the middle, and a possible uptick near the end. Be realistic, not optimistic.

Video description:`,

  // Regeneration instruction
  'regen-instruction': `You are a script editor. Given the current script frame text below, output a specific editing instruction to improve it. The instruction should be: (1) one clear action, (2) concrete ("cut 3 words" not "make it better"), (3) focused on one improvement.

Rules: Output ONLY the instruction. 5-15 words. Start with a verb.

Current text:`,
}

export function CopyPromptButton({ fieldKey, label, className }: { fieldKey: string; label?: string; className?: string }) {
  const handleCopy = async () => {
    const prompt = FIELD_PROMPTS[fieldKey]
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      toast(`Prompt copied — paste into your AI`, 'success')
    } catch {
      toast('Failed to copy', 'error')
    }
  }
  const prompt = FIELD_PROMPTS[fieldKey]
  if (!prompt) return null
  return (
    <button
      onClick={handleCopy}
      title={label || `Copy prompt for this field`}
      className={cn('inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[8px] font-medium text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/20 hover:bg-[#a855f7]/20 transition-colors shrink-0', className)}
    >
      <ClipboardCopy size={9} />
      {label || 'AI prompt'}
    </button>
  )
}