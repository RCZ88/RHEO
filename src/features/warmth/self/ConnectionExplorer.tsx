import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Target, AlertTriangle, FileText, Brain, Link2, ChevronRight } from 'lucide-react'
import { ACCENT, TEXT, MOTION, type AccentKey } from '../../../components/ai/tokens'
import type { LifeGraphNode, LifeGraphEdge } from './useLifeGraph'

const TYPE_ACCENT: Record<string, AccentKey> = {
  schedule: 'cyan', goal: 'emerald', deadline: 'amber', note: 'violet', entity: 'pink',
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  schedule: <Clock size={16} />, goal: <Target size={16} />, deadline: <AlertTriangle size={16} />,
  note: <FileText size={16} />, entity: <Brain size={16} />,
}

const TYPE_LABEL: Record<string, string> = {
  schedule: 'Schedule Block', goal: 'Goal', deadline: 'Deadline', note: 'Note', entity: 'Knowledge',
}

interface ConnectionExplorerProps {
  node: LifeGraphNode | null
  connections: LifeGraphNode[]
  onClose: () => void
  onNodeClick: (node: LifeGraphNode) => void
}

export function ConnectionExplorer({ node, connections, onClose, onNodeClick }: ConnectionExplorerProps) {
  const accent = node ? TYPE_ACCENT[node.type] || 'pink' : 'pink'
  const a = ACCENT[accent]

  const groupedConnections = useMemo(() => {
    const groups: Record<string, LifeGraphNode[]> = {}
    for (const conn of connections) {
      const key = conn.type
      if (!groups[key]) groups[key] = []
      groups[key].push(conn)
    }
    return groups
  }, [connections])

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: MOTION.normal, ease: MOTION.ease }}
            className="fixed right-0 top-0 bottom-0 w-[380px] max-w-[90vw] z-50 bg-zinc-950 light:bg-[var(--ws-surface)]/95 backdrop-blur-xl border-l border-zinc-800/60 overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-zinc-950 light:bg-[var(--ws-surface)]/90 backdrop-blur-xl border-b border-zinc-800/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className={`h-8 w-8 flex items-center justify-center rounded-lg ${a.pill}`}>
                    {TYPE_ICON[node.type]}
                  </span>
                  <div>
                    <div className={`text-[13px] font-semibold ${TEXT.primary}`}>{node.title}</div>
                    <div className="text-[10px] text-zinc-500">{TYPE_LABEL[node.type]}</div>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors">
                  <X size={16} className="text-zinc-500" />
                </button>
              </div>

              {/* Metadata chips */}
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(node.metadata).filter(([_, v]) => v != null && v !== '').slice(0, 6).map(([key, val]) => (
                  <span key={key} className="px-2 py-0.5 rounded text-[10px] bg-zinc-800/60 text-zinc-400">
                    {key}: {String(val)}
                  </span>
                ))}
              </div>
            </div>

            {/* Connections */}
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Link2 size={12} />
                <span>{connections.length} connection{connections.length !== 1 ? 's' : ''}</span>
              </div>

              {connections.length === 0 && (
                <div className="text-center py-8 text-[12px] text-zinc-600">
                  No connections yet. Link this item to goals, deadlines, or notes.
                </div>
              )}

              {Object.entries(groupedConnections).map(([type, nodes]) => {
                const groupAccent = TYPE_ACCENT[type] || 'pink'
                const ga = ACCENT[groupAccent]
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${ga.dot}`} />
                      <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{TYPE_LABEL[type] || type}</span>
                      <span className="text-[10px] text-zinc-600">{nodes.length}</span>
                    </div>
                    <div className="space-y-1">
                      {nodes.map(conn => (
                        <button
                          key={conn.id}
                          onClick={() => onNodeClick(conn)}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/50 text-left transition-all hover:ring-zinc-700 hover:bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]"
                        >
                          <span className={`h-6 w-6 flex items-center justify-center rounded-md text-[10px] ${ga.pill}`}>
                            {TYPE_ICON[conn.type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[12px] font-medium ${TEXT.primary} truncate`}>{conn.title}</div>
                          </div>
                          <ChevronRight size={12} className="text-zinc-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
