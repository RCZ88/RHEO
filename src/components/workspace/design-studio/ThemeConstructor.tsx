// ============================================================================
// Theme Constructor — Granular knobs for Fonts, Colors, Geometry, Motion
// Real-time preview updates as knobs change.
// ============================================================================
import React from 'react'
import { Type, Palette, Square, Sparkles } from 'lucide-react'
import { FONT_OPTIONS, EASING_OPTIONS } from '../../../lib/designPresets'

interface ConstructorProps {
  custom: {
    fontFamily: string
    fontSize: number
    accent: string
    bg: string
    radius: number
    padding: number
    duration: number
    easing: string
    glass: boolean
  }
  setCustom: (val: any) => void
}

export function ThemeConstructor({ custom, setCustom }: ConstructorProps) {
  const update = (key: string, value: any) => setCustom({ ...custom, [key]: value })

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 bg-zinc-950 light:bg-[var(--ws-surface)] text-white light:text-[var(--text-primary)] scrollbar-thin">
      {/* ── Typography ── */}
      <section>
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          <Type className="w-3.5 h-3.5" /> Typography
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Font Family</label>
            <select
              value={custom.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              className="w-full h-8 px-2 rounded-lg bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-800 text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-zinc-500">Base Size</label>
              <span className="text-[10px] text-purple-400 font-mono">{custom.fontSize}px</span>
            </div>
            <input
              type="range" min={12} max={18} step={1} value={custom.fontSize}
              onChange={(e) => update('fontSize', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
            />
          </div>
        </div>
      </section>

      {/* ── Colors ── */}
      <section>
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          <Palette className="w-3.5 h-3.5" /> Colors
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Accent</label>
            <div className="relative">
              <input
                type="color" value={custom.accent}
                onChange={(e) => update('accent', e.target.value)}
                className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-zinc-800"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Background</label>
            <input
              type="color" value={custom.bg}
              onChange={(e) => update('bg', e.target.value)}
              className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-zinc-800"
            />
          </div>
        </div>
      </section>

      {/* ── Geometry ── */}
      <section>
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          <Square className="w-3.5 h-3.5" /> Geometry
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-zinc-500">Border Radius</label>
              <span className="text-[10px] text-purple-400 font-mono">{custom.radius}px</span>
            </div>
            <input
              type="range" min={0} max={24} step={2} value={custom.radius}
              onChange={(e) => update('radius', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-zinc-500">Card Padding</label>
              <span className="text-[10px] text-purple-400 font-mono">{custom.padding}px</span>
            </div>
            <input
              type="range" min={8} max={32} step={4} value={custom.padding}
              onChange={(e) => update('padding', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
            />
          </div>
        </div>
      </section>

      {/* ── Motion & Effects ── */}
      <section>
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Motion & Effects
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-zinc-500">Duration</label>
              <span className="text-[10px] text-purple-400 font-mono">{custom.duration}ms</span>
            </div>
            <input
              type="range" min={0} max={500} step={50} value={custom.duration}
              onChange={(e) => update('duration', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Easing</label>
            <select
              value={custom.easing}
              onChange={(e) => update('easing', e.target.value)}
              className="w-full h-8 px-2 rounded-lg bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-800 text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
            >
              {EASING_OPTIONS.map((e) => (
                <option key={e.label} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-500">Glass Blur</label>
            <button
              onClick={() => update('glass', !custom.glass)}
              className="w-8 h-4 rounded-full relative transition-all"
              style={{ background: custom.glass ? '#8b5cf6' : '#3f3f46' }}
            >
              <span
                className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
                style={{ left: custom.glass ? '16px' : '2px' }}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
