import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// All available prompt sections — each can be toggled on/off
const PROMPT_SECTIONS = [
  { id: 'retention', label: 'Retention Rules', description: 'Attention anchors, curiosity gaps, pattern interrupts', defaultOn: true },
  { id: 'visual', label: 'Visual Dynamics', description: 'Shot descriptions, camera movements, visual pacing', defaultOn: false },
  { id: 'sound', label: 'Sound Design', description: 'Music cues, sound effects, audio transitions', defaultOn: false },
  { id: 'hooks', label: 'Hook Frameworks', description: 'First 3 seconds, scroll-stopping patterns', defaultOn: true },
  { id: 'seo', label: 'SEO Keywords', description: 'Hidden keyword phrases for discoverability', defaultOn: false },
  { id: 'scoring', label: 'Scoring Weights', description: 'How to weight different quality criteria', defaultOn: false },
  { id: 'frameworks', label: 'Framework Rules', description: 'Your established content framework constraints', defaultOn: true },
  { id: 'lessons', label: 'Lessons Learned', description: 'Past performance insights to apply', defaultOn: true },
  { id: 'reflection', label: 'Reflection Layer', description: 'Creator intuition vs data analysis', defaultOn: false },
  { id: 'series', label: 'Series Context', description: 'Rules if content belongs to a series', defaultOn: false },
  { id: 'niche', label: 'Niche Guidelines', description: 'Niche-specific tone and content rules', defaultOn: false },
  { id: 'format', label: 'Output Format', description: 'JSON schema, field requirements, strictness', defaultOn: true },
]

/** Shape of one toggleable prompt section. */
export type PromptSection = (typeof PROMPT_SECTIONS)[number]

/**
 * Which sections apply to a given prompt type.
 *
 * PromptBuilder calls this on every render and maps `defaultEnabled`, so each
 * entry must expose that flag. Only the sections that genuinely apply to the
 * prompt are returned — 'format' is universal, the rest are picked per type.
 */
const SECTIONS_BY_PROMPT_TYPE: Record<string, string[]> = {
  classify: ['format'],
  synthesize: ['hooks', 'niche', 'format'],
  script: ['retention', 'visual', 'sound', 'hooks', 'format'],
  gates: ['scoring', 'format'],
  seo: ['seo', 'format'],
  analytics: ['scoring', 'format'],
  lessons: ['lessons', 'reflection', 'format'],
  reflection: ['reflection', 'format'],
  frameworks: ['frameworks', 'format'],
}

export function getSectionsForPromptType(promptType: string): (PromptSection & { defaultEnabled: boolean })[] {
  const ids = SECTIONS_BY_PROMPT_TYPE[promptType]
  if (!ids) return []
  return PROMPT_SECTIONS.filter((s) => ids.includes(s.id)).map((s) => ({ ...s, defaultEnabled: s.defaultOn }))
}

// Style templates — injected as directives in the prompt
const STYLE_TEMPLATES = [
  { id: 'punchy', label: 'Punchy Short', directive: 'TONE: Conversational, punchy, zero filler. Every sentence earns its place.' },
  { id: 'storyteller', label: 'Storyteller', directive: 'TONE: Narrative, warm, emotionally engaged. Draw the viewer in.' },
  { id: 'data-nerd', label: 'Data Nerd', directive: 'TONE: Analytical, precise, authority-building. Back every claim.' },
  { id: 'cinematic', label: 'Cinematic', directive: 'VISUAL: Every frame has a full shot description. Think in cuts.' },
  { id: 'deep-dive', label: 'Deep Dive', directive: 'EVIDENCE: Full evidence chain: criterion -> wording -> mechanism.' },
  { id: 'casual', label: 'Casual', directive: 'TONE: Relaxed, conversational, like talking to a friend.' },
]

interface PromptSectionToggleProps {
  promptType: string
  enabledSections: string[]
  onSectionsChange: (sections: string[]) => void
  selectedStyle: string
  onStyleChange: (style: string) => void
  frameMode: 'strict' | 'flexible'
  onFrameModeChange: (mode: 'strict' | 'flexible') => void
  className?: string
}

export function PromptSectionToggle({
  promptType,
  enabledSections,
  onSectionsChange,
  selectedStyle,
  onStyleChange,
  frameMode,
  onFrameModeChange,
  className
}: PromptSectionToggleProps) {
  const [expanded, setExpanded] = useState(false)

  const toggleSection = (id: string) => {
    const next = enabledSections.includes(id)
      ? enabledSections.filter(s => s !== id)
      : [...enabledSections, id]
    onSectionsChange(next)
  }

  const enabledCount = enabledSections.length
  const totalCount = PROMPT_SECTIONS.length

  return (
    <div className={cn('rounded-lg border border-white/[0.06] bg-white/[0.02]', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-zinc-300">
            Prompt Sections
          </span>
          <span className="text-[9px] text-zinc-500">
            {enabledCount}/{totalCount} active
          </span>
        </div>
        {expanded ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] px-3 py-2 space-y-3">
          {/* Frame mode toggle */}
          <div>
            <div className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase mb-1.5">
              Frame Mode
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onFrameModeChange('strict')}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors',
                  frameMode === 'strict'
                    ? 'bg-white/[0.08] text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                Strict
              </button>
              <button
                onClick={() => onFrameModeChange('flexible')}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors',
                  frameMode === 'flexible'
                    ? 'bg-white/[0.08] text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                Flexible
              </button>
            </div>
          </div>

          {/* Style template selector */}
          <div>
            <div className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase mb-1.5">
              Style Template
            </div>
            <div className="flex flex-wrap gap-1">
              {STYLE_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => onStyleChange(selectedStyle === t.id ? '' : t.id)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                    selectedStyle === t.id
                      ? 'bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/30'
                      : 'bg-white/[0.04] text-zinc-400 border border-transparent hover:bg-white/[0.06]'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section toggles */}
          <div>
            <div className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase mb-1.5">
              Include Sections
            </div>
            <div className="space-y-1">
              {PROMPT_SECTIONS.map(s => {
                const on = enabledSections.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSection(s.id)}
                    className={cn(
                      'flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors',
                      on ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                    )}
                  >
                    <div className={cn(
                      'w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors',
                      on ? 'bg-[#f5c518] border-[#f5c518]' : 'border-zinc-600'
                    )}>
                      {on && <Check size={9} className="text-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-zinc-300">{s.label}</div>
                      <div className="text-[9px] text-zinc-600 truncate">{s.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { PROMPT_SECTIONS, STYLE_TEMPLATES }
