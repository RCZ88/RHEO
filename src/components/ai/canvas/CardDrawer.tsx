import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Calendar, TrendingUp, Newspaper, Plug, Clock,
  ListTodo, Bell, MessageSquare, Layers, ChevronRight, ChevronLeft,
  type LucideIcon,
} from 'lucide-react'
import type { CardType } from '../../../types/canvas'

interface CardDrawerProps {
  open: boolean
  onToggle: () => void
  onAddCard: (type: CardType) => void
}

interface CardTemplate {
  type: CardType
  label: string
  description: string
  icon: LucideIcon
  color: string
  category: 'core' | 'content' | 'tools' | 'special'
}

export const CARD_TEMPLATES: CardTemplate[] = [
  // Core cards
  { type: 'focus', label: 'Focus Goals', description: 'Daily goals and focus tracking', icon: Target, color: '#f472b6', category: 'core' },
  { type: 'plan', label: 'Long-term Plan', description: 'Long-term goals and planning notes', icon: TrendingUp, color: '#a78bfa', category: 'core' },
  { type: 'finance', label: 'Finance', description: 'Balance, income, and expenses', icon: TrendingUp, color: '#34d399', category: 'core' },
  { type: 'digest', label: 'Research Digest', description: 'Research topics and summaries', icon: Newspaper, color: '#22d3ee', category: 'core' },
  { type: 'reflect', label: 'Reflections', description: 'Daily reflection summaries', icon: Bell, color: '#c084fc', category: 'core' },

  // Content cards
  { type: 'response', label: 'AI Response', description: 'Text response from the AI', icon: MessageSquare, color: '#60a5fa', category: 'content' },
  { type: 'annotation', label: 'Annotation', description: 'Notes and reminders', icon: MessageSquare, color: '#fb923c', category: 'content' },

  // Tool cards
  { type: 'connectors', label: 'Connectors', description: 'Email and calendar integration', icon: Plug, color: '#2dd4bf', category: 'tools' },
  { type: 'schedule', label: 'Weekly Schedule', description: '7-day schedule overview', icon: Calendar, color: '#f87171', category: 'tools' },
  { type: 'deadlines', label: 'Deadlines', description: 'Deadline tracker', icon: Clock, color: '#f97316', category: 'tools' },
  { type: 'planner', label: 'Daily Planner', description: 'Timeline with goals and tasks', icon: ListTodo, color: '#38bdf8', category: 'tools' },

  // Special cards
  { type: 'group', label: 'Group', description: 'Container for grouped cards', icon: Layers, color: '#818cf8', category: 'special' },
]

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  content: 'Content',
  tools: 'Tools',
  special: 'Special',
}

const CATEGORY_ORDER = ['core', 'content', 'tools', 'special']

// ── Mini card previews ──
function MiniFocusPreview() {
  const goals = ['Review PR #42', 'Ship feature', 'Write docs']
  return (
    <div className="rounded-lg border border-pink-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Target size={9} className="text-pink-400 light:text-pink-500" />
        <span className="text-[8px] font-semibold text-pink-300 uppercase tracking-wider light:text-pink-600">Focus</span>
      </div>
      {goals.map((g, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full border border-zinc-600 light:border-zinc-300 flex items-center justify-center">
            {i === 0 && <div className="w-1.5 h-1.5 rounded-full bg-pink-400 light:bg-pink-500" />}
          </div>
          <span className="text-[8px] text-zinc-400 light:text-stone-600 truncate">{g}</span>
        </div>
      ))}
    </div>
  )
}

function MiniPlanPreview() {
  const items = [{ t: 'Learn Rust', c: 'work' }, { t: 'Run marathon', c: 'health' }, { t: 'Read 12 books', c: 'learning' }]
  return (
    <div className="rounded-lg border border-violet-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <TrendingUp size={9} className="text-violet-400 light:text-violet-500" />
        <span className="text-[8px] font-semibold text-violet-300 uppercase tracking-wider light:text-violet-600">Plan</span>
        <span className="text-[7px] text-zinc-600 light:text-stone-500 ml-auto">3 goals</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.c === 'work' ? '#ec4899' : item.c === 'health' ? '#34d399' : '#22d3ee' }} />
          <span className="text-[8px] text-zinc-400 light:text-stone-500 truncate">{item.t}</span>
        </div>
      ))}
    </div>
  )
}

function MiniFinancePreview() {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <TrendingUp size={9} className="text-emerald-400 light:text-emerald-500" />
        <span className="text-[8px] font-semibold text-emerald-300 uppercase tracking-wider light:text-emerald-600">Finance</span>
      </div>
      <div className="text-[11px] font-bold text-zinc-200 light:text-stone-800 font-mono">$12,450</div>
      <div className="flex gap-3 mt-1">
        <div><span className="text-[7px] text-zinc-600 light:text-stone-500">Income</span><div className="text-[8px] text-emerald-400 light:text-emerald-600 font-mono">$5,200</div></div>
        <div><span className="text-[7px] text-zinc-600 light:text-stone-500">Expense</span><div className="text-[8px] text-red-400 light:text-red-500 font-mono">$3,800</div></div>
      </div>
    </div>
  )
}

function MiniDigestPreview() {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Newspaper size={9} className="text-cyan-400 light:text-cyan-500" />
        <span className="text-[8px] font-semibold text-cyan-300 uppercase tracking-wider light:text-cyan-600">Digest</span>
      </div>
      <div className="space-y-1">
        {['AI trends', 'Web dev', 'DevOps'].map((t, i) => (
          <div key={i} className="text-[7px] text-zinc-500 light:text-stone-500 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-cyan-400 light:bg-cyan-500" />
            <span className="truncate">{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniReflectPreview() {
  return (
    <div className="rounded-lg border border-purple-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Bell size={9} className="text-purple-400 light:text-purple-500" />
        <span className="text-[8px] font-semibold text-purple-300 uppercase tracking-wider light:text-purple-600">Reflect</span>
      </div>
      <div className="text-[7px] text-zinc-500 light:text-stone-500 italic leading-relaxed">"Today I focused on..."</div>
    </div>
  )
}

function MiniResponsePreview() {
  return (
    <div className="rounded-lg border border-blue-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MessageSquare size={9} className="text-blue-400 light:text-blue-500" />
        <span className="text-[8px] font-semibold text-blue-300 uppercase tracking-wider light:text-blue-600">Response</span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 bg-zinc-700/50 light:bg-stone-200 rounded w-full" />
        <div className="h-1.5 bg-zinc-700/50 light:bg-stone-200 rounded w-4/5" />
        <div className="h-1.5 bg-zinc-700/50 light:bg-stone-200 rounded w-3/5" />
      </div>
    </div>
  )
}

function MiniAnnotationPreview() {
  return (
    <div className="rounded-lg border border-orange-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1">
        <MessageSquare size={9} className="text-orange-400 light:text-orange-500" />
        <span className="text-[8px] font-semibold text-orange-300 uppercase tracking-wider light:text-orange-600">Note</span>
      </div>
      <div className="text-[7px] text-zinc-500 light:text-stone-500">Reminder: Buy groceries</div>
    </div>
  )
}

function MiniConnectorsPreview() {
  return (
    <div className="rounded-lg border border-teal-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Plug size={9} className="text-teal-400 light:text-teal-500" />
        <span className="text-[8px] font-semibold text-teal-300 uppercase tracking-wider light:text-teal-600">Connectors</span>
      </div>
      <div className="space-y-1">
        {['Gmail', 'Calendar'].map((n, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 light:bg-emerald-500" />
            <span className="text-[7px] text-zinc-500 light:text-stone-500">{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniSchedulePreview() {
  return (
    <div className="rounded-lg border border-red-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Calendar size={9} className="text-red-400 light:text-red-500" />
        <span className="text-[8px] font-semibold text-red-300 uppercase tracking-wider light:text-red-600">Schedule</span>
      </div>
      <div className="flex gap-0.5">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="text-[6px] text-zinc-600 light:text-stone-500">{d}</div>
            <div className={`h-3 rounded-sm mt-0.5 ${i === 2 ? 'bg-red-400/30 light:bg-red-400/40' : 'bg-zinc-800/50 light:bg-stone-200'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniDeadlinesPreview() {
  return (
    <div className="rounded-lg border border-orange-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Clock size={9} className="text-orange-400 light:text-orange-500" />
        <span className="text-[8px] font-semibold text-orange-300 uppercase tracking-wider light:text-orange-600">Deadlines</span>
      </div>
      <div className="space-y-1">
        {['Report due', 'Tax filing'].map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5">
            <div className="w-1 h-1 rounded-full" style={{ background: i === 0 ? '#f87171' : '#fbbf24' }} />
            <span className="text-[7px] text-zinc-500 light:text-stone-500 truncate">{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniPlannerPreview() {
  return (
    <div className="rounded-lg border border-sky-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <ListTodo size={9} className="text-sky-400 light:text-sky-500" />
        <span className="text-[8px] font-semibold text-sky-300 uppercase tracking-wider light:text-sky-600">Planner</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="text-[7px] text-zinc-600 light:text-stone-500 font-mono">9:00</div>
        <div className="flex-1 h-1.5 rounded bg-sky-400/20 light:bg-sky-400/20" />
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <div className="text-[7px] text-zinc-600 light:text-stone-500 font-mono">14:00</div>
        <div className="flex-1 h-1.5 rounded bg-violet-400/20 light:bg-violet-400/20" />
      </div>
    </div>
  )
}

function MiniGroupPreview() {
  return (
    <div className="rounded-lg border border-indigo-500/20 bg-[rgba(24,24,27,0.8)] light:bg-white light:border-zinc-200/40 p-2 w-full">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Layers size={9} className="text-indigo-400 light:text-indigo-500" />
        <span className="text-[8px] font-semibold text-indigo-300 uppercase tracking-wider light:text-indigo-600">Group</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="h-4 rounded bg-zinc-800/60 light:bg-stone-200 border border-zinc-700/30 light:border-zinc-200/30" />
        <div className="h-4 rounded bg-zinc-800/60 light:bg-stone-200 border border-zinc-700/30 light:border-zinc-200/30" />
      </div>
    </div>
  )
}

const PREVIEW_MAP: Record<CardType, React.FC> = {
  focus: MiniFocusPreview,
  plan: MiniPlanPreview,
  finance: MiniFinancePreview,
  digest: MiniDigestPreview,
  reflect: MiniReflectPreview,
  response: MiniResponsePreview,
  annotation: MiniAnnotationPreview,
  connectors: MiniConnectorsPreview,
  schedule: MiniSchedulePreview,
  deadlines: MiniDeadlinesPreview,
  planner: MiniPlannerPreview,
  group: MiniGroupPreview,
  approval: MiniResponsePreview,
  transient: MiniResponsePreview,
  generated: MiniResponsePreview,
  automation: MiniConnectorsPreview,
}

export function CardDrawer({ open, onToggle, onAddCard }: CardDrawerProps) {
  const [hoveredType, setHoveredType] = useState<string | null>(null)

  const handleAdd = useCallback((type: CardType) => {
    onAddCard(type)
  }, [onAddCard])

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    cards: CARD_TEMPLATES.filter(t => t.category === cat),
  }))

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-black/30 backdrop-blur-sm"
            onClick={onToggle}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-[190] w-[380px] bg-[rgba(18,18,18,0.95)] backdrop-blur-xl border-l border-zinc-800/60 flex flex-col light:bg-white light:border-l-[var(--ws-border-strong)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 light:border-[var(--ws-border)]">
              <div>
                <h3 className="text-sm font-semibold text-white light:text-stone-900">Add Card</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5 light:text-stone-500">Click a card to add it to your canvas</p>
              </div>
              <button
                onClick={onToggle}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-colors light:hover:bg-stone-100 light:text-stone-500"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Card list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {grouped.map(({ category, label, cards }) => (
                <div key={category}>
                  <div className="px-1 mb-2">
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider light:text-stone-500">{label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cards.map(template => {
                      const Icon = template.icon
                      const isHovered = hoveredType === template.type
                      const Preview = PREVIEW_MAP[template.type]
                      return (
                        <button
                          key={template.type}
                          onClick={() => handleAdd(template.type)}
                          onMouseEnter={() => setHoveredType(template.type)}
                          onMouseLeave={() => setHoveredType(null)}
                          className="flex flex-col items-stretch rounded-xl text-left transition-all duration-200 overflow-hidden"
                          style={{
                            border: `1px solid ${isHovered ? template.color + '40' : 'rgba(63,63,70,0.3)'}`,
                            boxShadow: isHovered ? `0 0 20px ${template.color}15, 0 4px 12px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)',
                          }}
                        >
                          {/* Card preview — mock thumbnails stay dark-as-designed (thumbnail precedent) */}
                          <div className="p-2 light:bg-stone-100 light:rounded-t-xl">
                            {Preview ? <Preview /> : (
                              <div className="h-16 rounded-lg bg-zinc-800/40 light:bg-stone-100 flex items-center justify-center">
                                <Icon size={20} style={{ color: template.color, opacity: 0.4 }} />
                              </div>
                            )}
                          </div>
                          {/* Card label */}
                          <div className="px-2.5 py-1.5 border-t border-zinc-800/40 bg-[rgba(24,24,27,0.5)] light:bg-[var(--ws-surface-sunken)] light:border-[var(--ws-border)]">
                            <div className="flex items-center gap-1.5">
                              <Icon size={10} style={{ color: template.color }} />
                              <span className="text-[11px] font-medium text-zinc-300 light:text-stone-700">{template.label}</span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
