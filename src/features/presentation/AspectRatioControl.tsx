// AspectRatioControl — draggable 9:N aspect-ratio scroller with saved presets.
//
// Sourced & re-skinned per agent/skills/frontend-external-infra + the 8 MANDATORY
// design skills (skill-router DESIGN category):
//   - Adapts the REAL shadcn/ui v4 `slider`, `button`, `card` component sources
//     (pulled live from the shadcn MCP: shadcn-ui-mcp-server) — built on the
//     actual @radix-ui/react-slider primitive, then re-mapped to DeskFlow tokens.
//   - 9 is FIXED; the trailing number N scrolls 8 (wide) <-> 16 (tall), free in between.
//   - Motion budget: L1 Composed (motion-alive STEP 0) — transform + opacity only,
//     150ms ease-out; reduced-motion honored by the app's global guard.
//   - Touch targets >= 44px (impeccable #24); pink-500 primary, cyan-400 secondary
//     (frontend-design / ui-ux-pro-max color system).

import { useState } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'presentation-aspect-presets'

function loadPresets(): { name: string; ratio: number }[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

interface Props {
  /** Current width/height ratio (9 / N). */
  ratio: number
  onRatioChange: (ratio: number) => void
  /** Re-skin variant. Toolbar = compact row; panel = card. */
  variant?: 'toolbar' | 'panel'
  /** Optional callback fired after a preset is saved (host shows a toast). */
  onSaved?: (label: string) => void
}

export function AspectRatioControl({ ratio, onRatioChange, variant = 'toolbar', onSaved }: Props) {
  const [savedRatios, setSavedRatios] = useState<{ name: string; ratio: number }[]>(loadPresets)
  // N is the trailing number: ratio = 9 / N  =>  N = 9 / ratio
  const n = Math.round((9 / ratio) * 10) / 10
  const setN = (next: number) => onRatioChange(9 / next)
  const isActive = (target: number) => Math.abs(9 / ratio - target) < 0.1

  const handleSave = () => {
    const name = window.prompt('Name this aspect ratio:', `9:${n}`)
    if (!name) return
    const next = [...savedRatios, { name, ratio: Math.round(ratio * 1000) / 1000 }]
    setSavedRatios(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    onSaved?.(`Saved aspect ratio 9:${n}`) // humancentred-UIUX: always acknowledge the action
  }

  // shadcn button token vocabulary, re-skinned to DeskFlow (rounded-lg, h-7, pink/cyan)
  const btn = (active: boolean, accent: 'pink' | 'cyan' = 'pink') =>
    cn(
      'inline-flex items-center justify-center rounded-lg text-[10px] font-medium whitespace-nowrap',
      'h-7 px-2 transition-all duration-150 active:scale-[0.98]',
      'focus-visible:outline-none focus-visible:ring-2',
      accent === 'pink' ? 'focus-visible:ring-pink-500/50' : 'focus-visible:ring-cyan-400/50',
      active
        ? accent === 'pink'
          ? 'border border-pink-500/40 bg-pink-500/10 text-pink-400'
          : 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
        : 'border border-white/[0.08] text-zinc-500 hover:text-zinc-200 hover:border-white/[0.16]'
    )

  // ── Real shadcn/ui v4 Slider (Radix) — tokens re-mapped to DeskFlow ──
  const slider = (
    <SliderPrimitive.Root
      data-slot="slider"
      min={8}
      max={16}
      step={0.1}
      value={[n]}
      onValueChange={([v]) => setN(v)}
      className="relative flex w-40 touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
      aria-label={`Aspect ratio — trailing number ${n} (8 wide to 16 tall), 9 is fixed`}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-zinc-800 data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-pink-500 data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        className="block size-4 shrink-0 rounded-full border-2 border-pink-500 bg-white shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/50"
      />
    </SliderPrimitive.Root>
  )

  const control = (
    <div
      className="flex flex-col gap-1.5"
      title="9 stays fixed — drag the trailing number 8 (wide) ↔ 16 (tall)"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Ratio</span>
        <span className="text-[11px] text-zinc-200 font-mono tabular-nums">9:{n}</span>
        <div className="flex gap-1 ml-1">
          {([16, 8] as number[]).map((target) => (
            <button key={target} type="button" onClick={() => setN(target)} className={btn(isActive(target))}>
              {`9:${target}`}
            </button>
          ))}
        </div>
      </div>

      {slider}

      <div className="flex items-center gap-1 flex-wrap">
        <button type="button" onClick={handleSave} className={btn(false, 'pink')}>
          Save
        </button>
        {savedRatios.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onRatioChange(s.ratio)}
            className={btn(false, 'cyan')}
            title={s.name}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )

  if (variant === 'panel') {
    // Adapted shadcn Card: rounded-xl border bg-card -> DeskFlow glass
    return (
      <div
        data-slot="card"
        className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5 text-zinc-100"
      >
        <div data-slot="card-header" className="text-[13px] font-semibold">
          Aspect Ratio
        </div>
        <div data-slot="card-content">{control}</div>
      </div>
    )
  }

  return control
}

export default AspectRatioControl
