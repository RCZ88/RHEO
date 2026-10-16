// ============================================================================
// Design Studio Tab — 3-column grid: Gallery | Rich Preview | Theme Constructor
// Users browse styles, see rich interactive preview, customize with knobs.
// ============================================================================
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { UI_STYLES, getStyleById } from '../../lib/designPresets'
import { compileDesignDirective } from '../../lib/aiPromptCompiler'
import { RichPreviewCanvas } from './design-studio/RichPreviewCanvas'
import { ThemeConstructor } from './design-studio/ThemeConstructor'

const DEFAULT_CUSTOM = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  accent: '#8b5cf6',
  bg: '#1e1b4b',
  radius: 12,
  padding: 16,
  duration: 200,
  easing: 'linear',
  glass: true,
}

export function DesignStudioTab() {
  const [activeStyleId, setActiveStyleId] = useState('glassmorphism')
  const [custom, setCustom] = useState(DEFAULT_CUSTOM)
  const [applied, setApplied] = useState(false)

  const activeStyle = getStyleById(activeStyleId) || UI_STYLES[0]

  // Construct live tokens from base style + custom knobs
  const liveTokens: Record<string, string> = {
    ...activeStyle.tokens,
    '--bg-primary': custom.bg,
    '--accent-primary': custom.accent,
    '--radius-base': `${custom.radius}px`,
    '--blur-base': custom.glass ? '16px' : '0px',
  }

  // Apply tokens to workspace root
  useEffect(() => {
    const root = document.querySelector('[data-workspace-root]') as HTMLElement
    if (root) {
      Object.entries(liveTokens).forEach(([key, value]) => {
        root.style.setProperty(key, value)
      })
    }
  }, [liveTokens])

  // Generate design directive
  const designDirective = compileDesignDirective(activeStyle, custom, liveTokens)

  const handleStyleSelect = (styleId: string) => {
    setActiveStyleId(styleId)
    const style = getStyleById(styleId)
    if (style) {
      setCustom(prev => ({
        ...prev,
        accent: style.tokens['--accent-primary'] || prev.accent,
        bg: style.tokens['--bg-primary'] || prev.bg,
        radius: parseInt(style.tokens['--radius-base']) || prev.radius,
        glass: style.tokens['--blur-base'] !== '0px',
      }))
    }
  }

  const handleApply = () => {
    localStorage.setItem('workspace-design-style', JSON.stringify({
      styleId: activeStyleId,
      custom,
    }))
    setApplied(true)
    setTimeout(() => setApplied(false), 2000)
  }

  // Load saved style on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workspace-design-style') || '{}')
      if (saved.styleId) {
        setActiveStyleId(saved.styleId)
        if (saved.custom) setCustom(saved.custom)
      }
    } catch {}
  }, [])

  return (
    <div className="h-full w-full grid grid-cols-12 gap-0 bg-zinc-950 light:bg-[var(--ws-surface)] text-white light:text-[var(--text-primary)] overflow-hidden">

      {/* ── Column 1: Style Gallery (3/12) ── */}
      <div className="col-span-3 border-r border-zinc-800 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        <h2 className="text-[13px] font-bold text-zinc-200 mb-2">Design Languages</h2>
        <div className="space-y-2">
          {UI_STYLES.map((style) => {
            const isActive = activeStyleId === style.id
            const styleTokens = style.tokens
            return (
              <motion.button
                key={style.id}
                onClick={() => handleStyleSelect(style.id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left p-3 rounded-xl transition-all relative border ${
                  isActive
                    ? 'border-purple-500/60 bg-purple-500/10'
                    : 'border-zinc-800/60 hover:border-zinc-700/60 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]'
                }`}
              >
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </motion.div>
                )}

                {/* Color swatches */}
                <div className="flex gap-1 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ background: styleTokens['--bg-primary'] }} />
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: styleTokens['--accent-primary'] }} />
                  <div className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ background: styleTokens['--text-primary'] }} />
                </div>

                <h3 className="text-[12px] font-semibold text-zinc-200 mb-0.5">{style.name}</h3>
                <p className="text-[10px] text-zinc-500 leading-tight">{style.description}</p>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* ── Column 2: Rich Preview Canvas (5/12) ── */}
      <div className="col-span-5 flex flex-col bg-zinc-950 light:bg-[var(--ws-surface)] overflow-hidden">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <h2 className="text-[13px] font-bold text-zinc-200">Live Preview</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">{activeStyle.name} — interactive miniature workspace</p>
        </div>

        {/* Preview Canvas */}
        <div className="flex-1 mx-4 mb-3 rounded-xl overflow-hidden border border-zinc-800/60 min-h-0">
          <RichPreviewCanvas tokens={liveTokens} styleId={activeStyleId} custom={{
            fontFamily: custom.fontFamily,
            fontSize: custom.fontSize,
            cardPadding: `${custom.padding}px`,
            duration: custom.duration,
          }} />
        </div>

        {/* Apply Button */}
        <div className="px-4 pb-3 shrink-0">
          <button
            onClick={handleApply}
            className="w-full py-2 rounded-xl text-[12px] font-semibold transition-all duration-150"
            style={{
              background: applied ? '#34d399' : liveTokens['--accent-primary'],
              color: liveTokens['--bg-primary'],
            }}
          >
            {applied ? '✓ Applied' : 'Apply Design'}
          </button>
        </div>

        {/* Design Directive Preview */}
        <div className="px-4 pb-4 shrink-0">
          <div className="p-3 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] rounded-xl border border-zinc-800/40 max-h-28 overflow-y-auto scrollbar-thin">
            <p className="text-[9px] font-semibold text-purple-400 uppercase tracking-wider mb-1">AI Design Directive</p>
            <pre className="text-[9px] text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed">{designDirective}</pre>
          </div>
        </div>
      </div>

      {/* ── Column 3: Theme Constructor (4/12) ── */}
      <div className="col-span-4 border-l border-zinc-800 overflow-hidden">
        <ThemeConstructor custom={custom} setCustom={setCustom} />
      </div>
    </div>
  )
}
