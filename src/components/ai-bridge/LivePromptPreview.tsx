// LivePromptPreview — the UNIFORM live prompt viewer for the External AI Bridge.
//
// Design system applied (per frontend-design / impeccable / humancentred-UIUX /
// motion-alive / design-taste / ui-ux-pro-max / frontend-external-infra):
//  - Dark glass surface (zinc-950 base, zinc-900/50 glass, border brightness not shadow)
//  - Accent = amber (#f5c518) — the Content Engine surface convention (AmberButton)
//  - Tags each region DYNAMIC (field-driven) vs STATIC (constant rules)
//  - All 4 states covered: empty / loading / error / populated
//  - L1 motion only (opacity + transform micro-feedback); reduced-motion respected
//  - 8px grid spacing, rounded-xl max, focus rings, hover/active states

import { useState, useMemo } from 'react'
import { Eye, Code, Sparkles, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DynamicSectionDef {
  id: string
  label: string
  detect: 'linePrefix' | 'contains' | 'regex'
  match: string
  /** false => this region is "static" (not user-driven). Defaults to true. */
  dynamic?: boolean
  color: string
}

interface LivePromptPreviewProps {
  prompt: string
  dynamicSections?: DynamicSectionDef[]
  title?: string
  /** When true, show a loading skeleton (e.g. awaiting AI response). */
  loading?: boolean
  /** Optional error message to surface in the preview header. */
  error?: string | null
  className?: string
}

interface RenderedLine {
  text: string
  tag?: { label: string; color: string; dynamic: boolean }
}

function renderLines(prompt: string, sections: DynamicSectionDef[]): RenderedLine[] {
  const lines = prompt.split('\n')
  const out: RenderedLine[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const def = sections.find((d) => {
      if (d.detect === 'linePrefix') return line.startsWith(d.match)
      if (d.detect === 'contains') return line.includes(d.match)
      if (d.detect === 'regex') {
        try { return new RegExp(d.match).test(line) } catch { return false }
      }
      return false
    })
    if (def) {
      out.push({ text: line, tag: { label: def.label, color: def.color, dynamic: def.dynamic !== false } })
      i++
      continue
    }
    out.push({ text: line })
    i++
  }
  return out
}

export function LivePromptPreview({
  prompt,
  dynamicSections = [],
  title = 'Prompt the AI will send',
  loading = false,
  error = null,
  className,
}: LivePromptPreviewProps) {
  const [view, setView] = useState<'visual' | 'raw'>('visual')

  const rendered = useMemo(() => renderLines(prompt, dynamicSections), [prompt, dynamicSections])

  const activeDynamic = useMemo(() => {
    const seen = new Set<string>()
    const tags: { label: string; color: string }[] = []
    for (const l of rendered) {
      if (l.tag && l.tag.dynamic && !seen.has(l.tag.label)) {
        seen.add(l.tag.label)
        tags.push({ label: l.tag.label, color: l.tag.color })
      }
    }
    return tags
  }, [rendered])

  const staticCount = useMemo(
    () => dynamicSections.filter((d) => d.dynamic === false).length,
    [dynamicSections]
  )

  // ---- EMPTY STATE (humancentred-UIUX: never a blank box) ----
  if (!prompt && !loading) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] px-3 py-6 text-center',
          className
        )}
      >
        <Sparkles size={16} className="mx-auto mb-1.5 text-zinc-600" />
        <div className="text-[11px] text-zinc-500">
          The prompt appears here and updates live as you change fields.
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800">
        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={9} className="text-[#f5c518]" /> {title}
        </span>
        <div className="flex items-center gap-1">
          {!loading && (
            <>
              <span
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-semibold border border-[#f5c518]/30 text-[#f5c518]"
                title="Regions that change as you change fields"
              >
                <Sparkles size={7} /> {activeDynamic.length} dynamic
              </span>
              <span
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-semibold border border-zinc-600/40 text-zinc-400"
                title="Regions that are constant rules"
              >
                <Lock size={7} /> {staticCount} static
              </span>
            </>
          )}
          <div className="flex gap-0.5 p-0.5 rounded bg-zinc-800/60 ml-1">
            <button
              onClick={() => setView('visual')}
              className={cn(
                'h-4 px-1.5 rounded text-[8px] font-medium transition-colors',
                view === 'visual' ? 'bg-[#f5c518]/15 text-[#f5c518]' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Eye size={8} /> Live
            </button>
            <button
              onClick={() => setView('raw')}
              className={cn(
                'h-4 px-1.5 rounded text-[8px] font-medium transition-colors',
                view === 'raw' ? 'bg-[#f5c518]/15 text-[#f5c518]' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Code size={8} /> Raw
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-2.5 py-1 text-[10px] text-rose-400 bg-rose-500/10 border-b border-rose-500/20">
          {error}
        </div>
      )}

      {/* Dynamic tags row */}
      {view === 'visual' && !loading && activeDynamic.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pt-1.5 pb-1">
          {activeDynamic.map((t, idx) => (
            <span key={idx} className={cn('px-1 py-0.5 rounded border text-[7px] font-semibold leading-none', t.color)}>
              <Sparkles size={6} className="inline mr-0.5 -mt-0.5" />
              {t.label}
            </span>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="max-h-52 overflow-y-auto p-2 font-mono text-[9px] leading-relaxed">
        {loading ? (
          // ---- LOADING STATE (skeleton, shape-matched — impeccable) ----
          <div className="space-y-1.5 animate-pulse">
            {[80, 95, 60, 90, 70, 85, 50].map((w, i) => (
              <div key={i} className="h-2 rounded bg-zinc-800" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : view === 'raw' ? (
          <pre className="text-zinc-500 whitespace-pre-wrap">{prompt}</pre>
        ) : (
          <div className="space-y-0.5">
            {rendered.map((l, i) => (
              <div key={i} className="flex items-start gap-1">
                {l.tag ? (
                  <span
                    className={cn(
                      'shrink-0 px-1 py-0.5 rounded border text-[7px] font-semibold leading-none mt-0.5',
                      l.tag.color
                    )}
                  >
                    {l.tag.label}
                  </span>
                ) : (
                  <span className="shrink-0 w-1" />
                )}
                <pre className={cn('whitespace-pre-wrap flex-1 min-w-0', l.tag ? 'text-zinc-300' : 'text-zinc-500')}>
                  {l.text}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] text-[#f5c518] border-t border-zinc-800">
          <Loader2 size={11} className="animate-spin" /> Waiting for the AI response…
        </div>
      )}
    </div>
  )
}

export default LivePromptPreview
