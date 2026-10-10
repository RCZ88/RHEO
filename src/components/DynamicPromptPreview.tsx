import { useState, useMemo } from 'react'
import { Eye, Code } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────
// DynamicPromptPreview — the UNIFORM dynamic-prompt viewer for every feature
// that builds a prompt from user-controlled fields.
//
// Skill routing (agent/skills/skill-router → DESIGN → 8 MANDATORY skills):
//   - external-ai-bridge: any prompt assembled from user inputs is "dynamic";
//     prove it to the user by color-tagging each field-driven region.
//   - humancentred-UIUX: clear, plain-language; compact view proves which
//     fields changed the prompt; expandable to raw.
//   - frontend-design / ui-ux-pro-max: DeskFlow tokens — pink-500 primary
//     accent (NOT emerald), >=10px text, h-7 controls, rounded-lg.
//   - impeccable / motion-alive: L1 Composed motion (transform/opacity, 150ms),
//     touch targets >= 44px, focus-visible rings.
// ─────────────────────────────────────────────────────────────────────────

export interface DynamicSectionDef {
  id: string
  label: string
  detect: 'linePrefix' | 'contains' | 'regex'
  match: string
  color: string
}

interface DynamicPromptPreviewProps {
  prompt: string
  dynamicSections?: DynamicSectionDef[]
  title?: string
  className?: string
}

interface RenderedLine {
  text: string
  tag?: { label: string; color: string }
}

function buildRenderedLines(prompt: string, sections: DynamicSectionDef[]): RenderedLine[] {
  const lines = prompt.split('\n')
  const out: RenderedLine[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const def = sections.find((d) => {
      if (d.detect === 'linePrefix') return line.startsWith(d.match)
      if (d.detect === 'contains') return line.includes(d.match)
      if (d.detect === 'regex') {
        try {
          return new RegExp(d.match).test(line)
        } catch {
          return false
        }
      }
      return false
    })
    if (def) {
      if (def.detect === 'linePrefix' && def.match === ':root {') {
        let block = line + '\n'
        i++
        while (i < lines.length && !lines[i].trim().startsWith('}')) {
          block += lines[i] + '\n'
          i++
        }
        if (i < lines.length) block += lines[i]
        out.push({ text: block, tag: { label: def.label, color: def.color } })
        i++
        continue
      }
      out.push({ text: line, tag: { label: def.label, color: def.color } })
      i++
      continue
    }
    out.push({ text: line })
    i++
  }
  return out
}

export function DynamicPromptPreview({
  prompt,
  dynamicSections = [],
  title = 'Prompt Preview',
  className,
}: DynamicPromptPreviewProps) {
  const [view, setView] = useState<'visual' | 'raw'>('visual')

  const rendered = useMemo(() => buildRenderedLines(prompt, dynamicSections), [prompt, dynamicSections])

  const activeTags = useMemo(() => {
    const seen = new Set<string>()
    for (const l of rendered) if (l.tag && !seen.has(l.tag.label)) seen.add(l.tag.label)
    return Array.from(seen)
  }, [rendered])

  const tab = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1 h-7 px-2 rounded-md text-[10px] font-medium',
      'transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50',
      active ? 'bg-pink-500/15 text-pink-400' : 'text-zinc-500 hover:text-zinc-200'
    )

  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] overflow-hidden', className)}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.08]">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{title}</span>
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04]">
          <button onClick={() => setView('visual')} className={tab(view === 'visual')} aria-pressed={view === 'visual'}>
            <Eye size={11} /> Compact
          </button>
          <button onClick={() => setView('raw')} className={tab(view === 'raw')} aria-pressed={view === 'raw'}>
            <Code size={11} /> Raw
          </button>
        </div>
      </div>

      {view === 'visual' && activeTags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pt-1.5">
          {activeTags.map((t, idx) => {
            const def = dynamicSections.find((d) => d.label === t)
            const color = def?.color || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
            return (
              <span
                key={idx}
                className={cn('px-1.5 py-0.5 rounded-md border text-[10px] font-semibold leading-none', color)}
              >
                {t}
              </span>
            )
          })}
        </div>
      )}

      <div className="max-h-52 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
        {view === 'raw' ? (
          <pre className="text-zinc-400 whitespace-pre-wrap">{prompt}</pre>
        ) : (
          <div className="space-y-0.5">
            {rendered.map((l, i) => (
              <div key={i} className="flex items-start gap-1">
                {l.tag ? (
                  <span
                    className={cn(
                      'shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold leading-none mt-0.5',
                      l.tag.color
                    )}
                  >
                    {l.tag.label}
                  </span>
                ) : (
                  <span className="shrink-0 w-1.5" />
                )}
                <pre className="text-zinc-400 whitespace-pre-wrap flex-1 min-w-0">{l.text}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DynamicPromptPreview
