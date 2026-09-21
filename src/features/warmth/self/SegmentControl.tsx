import * as React from "react";
import { motion } from 'framer-motion'
import { cn } from '../../../lib/utils'

interface SegmentOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface SegmentControlProps {
  value: string
  onChange: (value: string) => void
  options: SegmentOption[]
}

export function SegmentControl({ value, onChange, options }: SegmentControlProps) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900/50 ring-1 ring-zinc-800/60">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors',
              active ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {active && (
              <motion.div
                layoutId="segment-bg"
                className="absolute inset-0 rounded-md bg-zinc-800/80"
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
