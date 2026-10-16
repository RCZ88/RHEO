/**
 * StatPill — one labelled number in a stat strip.
 *
 * ONE component. This existed twice (GoldPage, HabitsPage) with identical
 * bodies. The `accent` prop is a closed set of Tailwind TEXT classes only, so a
 * caller cannot smuggle a raw hex in through it (PAINT Gate C).
 *
 * Spec §3.4.
 */

import type { ReactNode } from 'react'

/** The closed accent set. Adding a hue here is a design decision, not a refactor. */
export type StatPillTone = 'amber' | 'violet' | 'emerald' | 'cyan' | 'rose' | 'muted'

const TONE: Record<StatPillTone, string> = {
  amber: 'text-amber-400',
  violet: 'text-violet-400',
  emerald: 'text-emerald-400',
  cyan: 'text-cyan-400',
  rose: 'text-rose-400',
  muted: 'text-zinc-500',
}

export interface StatPillProps {
  label: string
  value: string | number
  /** Hue of the VALUE only. The label stays muted — it is not data. */
  tone?: StatPillTone
  /** Optional leading glyph. */
  icon?: ReactNode
  className?: string
}

export function StatPill({ label, value, tone = 'muted', icon, className = '' }: StatPillProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className={`flex items-center gap-1 text-[14px] font-semibold tabular-nums ${TONE[tone]}`}>
        {icon}
        {value}
      </span>
      <span className="text-[10px] text-zinc-600">{label}</span>
    </div>
  )
}