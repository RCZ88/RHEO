import * as React from "react";
// Shared LAMINAR components for Content Engine
// BlurFade + NumberTicker already exist in overlay-studio/components/ui.tsx

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// — BentoCard —
interface BentoCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function BentoCard({ children, className, onClick }: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-white/[0.08] bg-zinc-900/80 p-4 transition-all duration-200',
        onClick && 'cursor-pointer hover:border-white/[0.15] hover:bg-zinc-900',
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// — SectionHeader —
interface SectionHeaderProps {
  label: string
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function SectionHeader({ label, title, icon, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {icon}
          {label}
        </div>
        <h2 className="text-[14px] font-semibold text-zinc-100 mt-0.5">{title}</h2>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

// — StatusChip —
interface StatusChipProps {
  status: string
  className?: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700/30 text-zinc-400',
  active: 'bg-emerald-500/15 text-emerald-400',
  applied: 'bg-emerald-500/15 text-emerald-400',
  dismissed: 'bg-zinc-700/30 text-zinc-500',
  ready: 'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  error: 'bg-rose-500/15 text-rose-400',
  linked: 'bg-white/[0.08] text-zinc-300',
  transcribing: 'bg-amber-500/15 text-amber-400',
  transcript_ready: 'bg-emerald-500/15 text-emerald-400',
  cut_plan_ready: 'bg-emerald-500/15 text-emerald-400',
  scene_plan_ready: 'bg-emerald-500/15 text-emerald-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  published: 'bg-emerald-500/15 text-emerald-400',
  raw: 'bg-zinc-700/30 text-zinc-400',
  refined: 'bg-amber-500/15 text-amber-400',
  used: 'bg-zinc-700/30 text-zinc-500',
}

export function StatusChip({ status, className }: StatusChipProps) {
  const colorClass = STATUS_COLORS[status] || 'bg-zinc-700/30 text-zinc-400'
  return (
    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', colorClass, className)}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// — NumberTicker (re-export from overlay-studio) —
export { BlurFade, NumberTicker } from '../../overlay-studio/components/ui'
