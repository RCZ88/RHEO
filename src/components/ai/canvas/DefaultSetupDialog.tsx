import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, RefreshCcw, LayoutTemplate } from 'lucide-react'
import { CARD_TEMPLATES } from './CardDrawer'
import {
  loadDefaultSetup, saveDefaultSetup, clearDefaultSetup,
  BUILTIN_DEFAULT_SETUP,
} from '../../../services/canvasPersistence'
import type { DefaultSetupCard } from '../../../types/canvas'

interface DefaultSetupDialogProps {
  open: boolean
  onClose: () => void
}

const CATEGORY_ORDER = ['core', 'content', 'tools', 'special']
const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core', content: 'Content', tools: 'Tools', special: 'Special',
}

export function DefaultSetupDialog({ open, onClose }: DefaultSetupDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize from saved setup (or built-in defaults) when opened
  useEffect(() => {
    if (!open) return
    const setup = loadDefaultSetup()
    if (setup && setup.cards.length > 0) {
      setSelected(new Set(setup.cards.filter(c => c.enabled).map(c => c.type)))
    } else {
      setSelected(new Set(BUILTIN_DEFAULT_SETUP.filter(c => c.enabled).map(c => c.type)))
    }
    setSaved(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, selected])

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current) }
  }, [])

  const toggle = useCallback((type: string) => {
    setSaved(false)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const handleSave = useCallback(() => {
    if (selected.size === 0) return
    const order = CATEGORY_ORDER.flatMap(cat => CARD_TEMPLATES.filter(t => t.category === cat).map(t => t.type))
    const selectedTypes = order.filter(t => selected.has(t))
    const builtinMap = new Map(BUILTIN_DEFAULT_SETUP.map(d => [d.type, d]))
    const grid = { x: 40, y: 40 }
    const cards: DefaultSetupCard[] = selectedTypes.map((type, i) => {
      const builtin = builtinMap.get(type)
      // Smart layout: builtin positions where known, else a 4-col grid
      const position = builtin ? builtin.position : { x: grid.x + (i % 4) * 380, y: grid.y + Math.floor(i / 4) * 280 }
      const size = builtin ? builtin.size : { w: 6, h: 4 }
      return { type: type as any, enabled: true, defaultData: {}, position, size, pinned: true }
    })
    saveDefaultSetup(cards)
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2000)
  }, [selected])

  const handleReset = useCallback(() => {
    clearDefaultSetup()
    setSelected(new Set(BUILTIN_DEFAULT_SETUP.filter(c => c.enabled).map(c => c.type)))
    setSaved(false)
  }, [])

  const count = selected.size
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    cards: CARD_TEMPLATES.filter(t => t.category === cat),
  })).filter(g => g.cards.length > 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-[220] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-[520px] max-h-[80vh] flex flex-col rounded-xl border border-zinc-700/50 bg-[rgba(18,18,18,0.98)] backdrop-blur-xl shadow-2xl overflow-hidden light:bg-white light:border-[var(--ws-border-strong)]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-zinc-800/50 light:border-[var(--ws-border)]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                    <LayoutTemplate size={16} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-white light:text-stone-900">Default Canvas Setup</h3>
                    <p className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed max-w-[380px] light:text-stone-500">
                      Choose which cards appear on every <span className="text-zinc-200 light:text-stone-700">new blank canvas</span>.
                      Your saved setup becomes the default layout.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-colors shrink-0 light:hover:bg-stone-100"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>

              {/* Template list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {grouped.map(({ category, label, cards }) => (
                  <div key={category}>
                    <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2 light:text-stone-500">{label}</div>
                    <div className="space-y-1.5">
                      {cards.map(template => {
                        const isOn = selected.has(template.type)
                        return (
                          <button
                            key={template.type}
                            onClick={() => toggle(template.type)}
                            role="checkbox"
                            aria-checked={isOn}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dk-accent)] ${
                              isOn
                                ? 'border-sky-500/30 bg-sky-500/[0.06]'
                                : 'border-transparent bg-zinc-900/40 hover:bg-zinc-900/70 light:bg-stone-100 light:hover:bg-stone-200/70'
                            }`}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${template.color}15`, color: isOn ? template.color : '#52525b' }}
                            >
                              <template.icon size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-[13px] font-medium truncate ${isOn ? 'text-zinc-100 light:text-stone-900' : 'text-zinc-500 light:text-stone-500'}`}>
                                {template.label}
                              </div>
                              <div className={`text-[11px] truncate ${isOn ? 'text-zinc-500 light:text-stone-500' : 'text-zinc-600 light:text-stone-400'}`}>
                                {template.description}
                              </div>
                            </div>
                            <div
                              className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-all duration-150 shrink-0 ${
                                isOn ? 'bg-sky-500/80 border-sky-400' : 'border-zinc-700 bg-zinc-900 light:border-stone-300 light:bg-white'
                              }`}
                            >
                              {isOn && <Check size={12} className="text-white" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-zinc-500 leading-relaxed light:text-stone-500">
                  Cards you leave off can still be added anytime via the <span className="text-zinc-300 light:text-stone-700">+ Add Card</span> drawer.
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-zinc-800/50 light:border-[var(--ws-border)]">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors light:text-stone-500 light:hover:bg-stone-100"
                  title="Forget saved setup; new canvases use built-in defaults"
                >
                  <RefreshCcw size={13} />
                  Reset to built-in
                </button>
                <div className="flex items-center gap-2">
                  {saved && (
                    <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                      <Check size={12} /> Setup saved
                    </span>
                  )}
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors light:text-stone-500 light:hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={count === 0}
                    className="px-4 py-2 rounded-xl text-[12px] font-medium text-white bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Save Setup ({count})
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
