import { useState, type ComponentType, type CSSProperties } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Zap, Play, Pause, Pencil, Trash2, MoreHorizontal,
  DollarSign, Target, Clock, BookOpen, Code, Monitor,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { TEXT } from '../tokens'
import { cardEnterVariants } from '../lib/motion'
import { SOURCE_META } from './data/triggerRegistry'
import type { AutomationCardData } from '../../types/automation'
import type { DataSourceName } from '../../../domains/compositions/compositionTypes'

const SOURCE_ICONS: Record<DataSourceName, ComponentType<{ size?: number | string; style?: CSSProperties }>> = {
  finance: DollarSign,
  focus: Clock,
  goals: Target,
  learning: BookOpen,
  ide: Code,
  system: Monitor,
}

interface AutomationCardProps {
  data: AutomationCardData
  onEdit?: () => void
  onToggle?: () => void
  onDelete?: () => void
  onTestRun?: () => void
  onDismiss?: () => void
}

export function AutomationCard({ data, onEdit, onToggle, onDelete, onTestRun, onDismiss }: AutomationCardProps) {
  const reduce = useReducedMotion()
  const [showMenu, setShowMenu] = useState(false)
  const meta = SOURCE_META[data.triggerSource]
  const TriggerIcon = SOURCE_ICONS[data.triggerSource] ?? Zap

  const relativeTime = data.lastFired ? getRelativeTime(data.lastFired) : 'Never'

  return (
    <motion.div
      layout
      variants={reduce ? undefined : cardEnterVariants}
      initial="hidden" animate="show" exit="exit"
      className={cn(
        "group relative flex flex-col rounded-xl p-5 backdrop-blur-xl transition-all",
        "bg-[rgba(24,24,27,0.60)] ring-1 ring-zinc-800/60 hover:ring-zinc-700"
      )}
    >
      {/* Accent top bar */}
      <div className="absolute top-0 left-0 h-0.5 w-full rounded-t-xl" style={{ background: meta?.color ?? '#8b5cf6', opacity: 0.5 }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: (meta?.color ?? '#8b5cf6') + '18' }}>
            <TriggerIcon size={14} style={{ color: meta?.color ?? '#8b5cf6' }} />
          </div>
          <div>
            <h4 className={cn("text-[12px] font-semibold leading-tight", TEXT.primary)}>{data.name}</h4>
            <span className="text-[9px] text-zinc-600 light:text-stone-500">{data.triggerSource}</span>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(v => !v)} className="p-1 rounded-md text-zinc-500 light:text-stone-500 hover:text-zinc-300 light:text-stone-400 hover:bg-zinc-800 light:bg-stone-200 transition-colors">
            <MoreHorizontal size={14} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-7 z-20 w-36 rounded-lg bg-zinc-900 light:bg-white ring-1 ring-zinc-700/60 py-1 shadow-xl"
              >
                <button onClick={() => { onEdit?.(); setShowMenu(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-300 light:text-stone-400 hover:bg-zinc-800 light:bg-stone-200">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => { onTestRun?.(); setShowMenu(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-300 light:text-stone-400 hover:bg-zinc-800 light:bg-stone-200">
                  <Play size={12} /> Test Run
                </button>
                <button onClick={() => { onDelete?.(); setShowMenu(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10">
                  <Trash2 size={12} /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Summary */}
      <p className={cn("text-[11px] leading-relaxed mb-3", TEXT.secondary)}>{data.summary}</p>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-zinc-800/40 light:border-[var(--ws-border)] pt-3">
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <span className={cn("h-1.5 w-1.5 rounded-full", data.enabled ? "bg-emerald-400" : "bg-zinc-600")} />
          <span className="text-[9px] text-zinc-500 light:text-stone-500">{data.enabled ? 'Active' : 'Paused'}</span>
          <span className="text-[9px] text-zinc-700">·</span>
          <span className="text-[9px] text-zinc-600 light:text-stone-500">Last: {relativeTime}</span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <button onClick={() => onTestRun?.()} title="Test Run" className="p-1.5 rounded-md text-zinc-500 light:text-stone-500 hover:text-pink-300 hover:bg-pink-500/10 transition-colors">
            <Zap size={12} />
          </button>
          <button onClick={() => onToggle?.()} title={data.enabled ? 'Pause' : 'Enable'} className="p-1.5 rounded-md text-zinc-500 light:text-stone-500 hover:text-amber-300 hover:bg-amber-500/10 transition-colors">
            {data.enabled ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button onClick={() => onDismiss?.()} title="Dismiss" className="p-1.5 rounded-md text-zinc-500 light:text-stone-500 hover:text-zinc-300 light:text-stone-400 hover:bg-zinc-800 light:bg-stone-200 transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}