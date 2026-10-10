import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Target, AlertTriangle, FileText, Brain, ChevronRight, Zap, TrendingUp } from 'lucide-react'
import { GlassCard } from '../../../components/ai/GlassCard'
import { SectionHead } from '../../../components/ai/SectionHead'
import { StateShell, EmptyState } from '../../../components/ai/StateShell'
import { useMotionProps } from '../../../components/ai/lib/motion'
import { ACCENT, TEXT, type AccentKey } from '../../../components/ai/tokens'
import type { TodayContext, LifeGraphNode, ProfileSignal } from './useLifeGraph'

const TYPE_ACCENT: Record<string, AccentKey> = {
  schedule: 'cyan', goal: 'emerald', deadline: 'amber', note: 'violet', entity: 'pink', ltg: 'emerald',
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  schedule: <Clock size={14} />, goal: <Target size={14} />, deadline: <AlertTriangle size={14} />,
  note: <FileText size={14} />, entity: <Brain size={14} />, ltg: <Target size={14} />,
}

interface TodayDashboardProps {
  today: TodayContext | null
  graph: { nodes: LifeGraphNode[] } | null
  profileSignals: ProfileSignal[]
  loading: boolean
  error: string | null
  onNodeClick: (node: LifeGraphNode) => void
}

export function TodayDashboard({ today, graph, profileSignals, loading, error, onNodeClick }: TodayDashboardProps) {
  const m = useMotionProps()
  const state = loading ? 'loading' : error ? 'error' : !today ? 'empty' : 'ready' as const

  const nodeMap = useMemo(() => {
    if (!graph) return new Map()
    return new Map(graph.nodes.map(n => [n.id, n]))
  }, [graph])

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const resolveNode = (id: string, prefix: string) => nodeMap.get(`${prefix}_${id}`) || null

  return (
    <StateShell
      state={state}
      error={error}
      loading={
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 animate-pulse" />
          ))}
        </div>
      }
      empty={
        <EmptyState
          icon={<Zap size={20} />}
          title="Your day is a blank canvas"
          message="Add schedule blocks, goals, or deadlines to see how they connect."
        />
      }
    >
      {today && (
      <motion.div variants={m.parent} initial="hidden" animate="show" className="space-y-3">
        {/* Active Schedule Block */}
        {today!.activeScheduleId && (() => {
          const node = resolveNode(today!.activeScheduleId, 'sched')
          if (!node) return null
          return (
            <motion.div variants={m.item}>
              <GlassCard accent="cyan" bar>
                <SectionHead accent="cyan" icon={<Clock size={16} />} title="Active Now" desc="Current schedule block" />
                <button
                  onClick={() => onNodeClick(node)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 ring-1 ring-zinc-800/50 text-left transition-all hover:ring-cyan-500/30 hover:bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]"
                >
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-medium ${TEXT.primary}`}>{node.title}</div>
                    <div className={`text-[11px] ${TEXT.muted}`}>
                      {formatTime(node.metadata.startTime)} – {formatTime(node.metadata.endTime)}
                      {node.metadata.category && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300">{node.metadata.category}</span>}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                </button>
              </GlassCard>
            </motion.div>
          )
        })()}

        {/* Today's Goals */}
        {today!.todaysGoalIds.length > 0 && (
          <motion.div variants={m.item}>
            <GlassCard accent="emerald" bar>
              <SectionHead accent="emerald" icon={<Target size={16} />} title="Today's Goals" desc={`${today!.todaysGoalIds.length} goals`} />
              <div className="space-y-2">
                {today!.todaysGoalIds.map(goalId => {
                  const node = resolveNode(goalId, 'goal')
                  if (!node) return null
                  const pct = node.metadata.target > 0
                    ? Math.min(100, Math.round(((node.metadata.progress || 0) / node.metadata.target) * 100))
                    : node.metadata.status === 'completed' ? 100 : 0
                  return (
                    <button
                      key={goalId}
                      onClick={() => onNodeClick(node)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 ring-1 ring-zinc-800/50 text-left transition-all hover:ring-emerald-500/30"
                    >
                      <span className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${node.metadata.status === 'completed' ? 'border-emerald-400 bg-emerald-400/20' : 'border-zinc-600'}`}>
                        {node.metadata.status === 'completed' && <span className="text-[8px] text-emerald-400">✓</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-medium ${node.metadata.status === 'completed' ? 'text-zinc-500 line-through' : TEXT.primary}`}>{node.title}</div>
                        {node.metadata.target > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="h-1 w-16 rounded-full bg-zinc-800 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] tabular-nums text-zinc-500">{pct}%</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Approaching Deadlines */}
        {today!.approachingDeadlineIds.length > 0 && (
          <motion.div variants={m.item}>
            <GlassCard accent="amber" bar>
              <SectionHead accent="amber" icon={<AlertTriangle size={16} />} title="Deadlines" desc={`${today!.approachingDeadlineIds.length} approaching`} />
              <div className="space-y-1.5">
                {today!.approachingDeadlineIds.map(dlId => {
                  const node = resolveNode(dlId, 'deadline')
                  if (!node) return null
                  const due = new Date(node.metadata.dueDate);
                  const daysLeft = !isNaN(due.getTime()) ? Math.ceil((due.getTime() - Date.now()) / 86400000) : NaN;
                  const priorityColor = node.metadata.priority === 'urgent' ? 'text-red-400' : node.metadata.priority === 'high' ? 'text-amber-400' : 'text-zinc-400';
                  return (
                    <button
                      key={dlId}
                      onClick={() => onNodeClick(node)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 ring-1 ring-zinc-800/50 text-left transition-all hover:ring-amber-500/30"
                    >
                      <span className={`text-[11px] font-mono tabular-nums shrink-0 ${priorityColor}`}>
                        {isNaN(daysLeft) ? 'TBD' : daysLeft <= 0 ? 'TODAY' : daysLeft === 1 ? '1d' : `${daysLeft}d`}
                      </span>
                      <span className={`text-[13px] flex-1 min-w-0 truncate ${TEXT.primary}`}>{node.title}</span>
                      {node.metadata.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 shrink-0">{node.metadata.category}</span>}
                      <ChevronRight size={14} className="text-zinc-600 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Relevant Notes */}
        {today!.relevantNoteIds.length > 0 && (
          <motion.div variants={m.item}>
            <GlassCard accent="violet">
              <SectionHead accent="violet" icon={<FileText size={16} />} title="Relevant Notes" />
              <div className="flex flex-wrap gap-1.5">
                {today!.relevantNoteIds.map(noteId => {
                  const node = resolveNode(noteId, 'note')
                  if (!node) return null
                  return (
                    <button
                      key={noteId}
                      onClick={() => onNodeClick(node)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20 transition-all hover:ring-violet-500/40 text-left"
                    >
                      {node.title}
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Profile Signals */}
        {profileSignals.length > 0 && (
          <motion.div variants={m.item}>
            <GlassCard accent="pink" bar>
              <SectionHead accent="pink" icon={<TrendingUp size={16} />} title="Identity Signals" desc="Patterns from your connections" />
              <div className="space-y-2">
                {profileSignals.map(sig => (
                  <div key={sig.trait} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/40 ring-1 ring-zinc-800/50">
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] font-medium ${TEXT.primary}`}>{sig.trait}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${sig.value}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums font-mono text-pink-300 w-8 text-right">{sig.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </motion.div>
      )}
    </StateShell>
  )
}
