import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, CalendarDays, Clock, Flame, FileText, Brain, ArrowRight } from 'lucide-react';

interface ConnectionExplorerProps {
  entity: { type: 'goal' | 'todo' | 'deadline' | 'habit' | 'schedule'; id: string; title: string } | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ConnectionSection {
  title: string;
  icon: React.ElementType;
  items: any[];
  type: string;
}

const ENTITY_COLORS: Record<string, string> = {
  goal: 'text-amber-400',
  ltg: 'text-yellow-400',
  habit: 'text-emerald-400',
  deadline: 'text-rose-400',
  schedule: 'text-cyan-400',
  note: 'text-violet-400',
  todo: 'text-zinc-300'
};

const COLOR_BADGE: Record<string, string> = {
  goal: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  habit: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  deadline: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  schedule: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  todo: 'bg-violet-500/10 text-violet-300 border-violet-500/20'
};

export function ConnectionExplorer({ entity, isOpen, onClose }: ConnectionExplorerProps) {
  const [connections, setConnections] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const api = (window as any).deskflowAPI;

  useEffect(() => {
    if (isOpen && entity) {
      loadConnections();
    }
  }, [isOpen, entity]);

  const loadConnections = async () => {
    if (!api?.todoGetConnections && !api?.goalGetConnections) return;
    
    setLoading(true);
    try {
      const res = entity.type === 'goal'
        ? await (api.goalGetConnections?.(entity.id) || api.todoGetConnections?.(entity.type, entity.id))
        : await api.todoGetConnections(entity.type, entity.id);
      if (res?.success) {
        setConnections(res.connections || res);
      }
    } catch (e) {
      console.error('Failed to load connections:', e);
    } finally {
      setLoading(false);
    }
  };

  const EntityBadge = ({ child, type }: { child: any; type: string }) => {
    if (!child) return null;
    const ColorClass = ENTITY_COLORS[child.type] || 'text-zinc-400';
    
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/30 border border-zinc-800/30`}>
        <span className={`w-2 h-2 rounded-full ${ColorClass}`} />
        <span className={`text-[12px] text-zinc-300 truncate`}>
          {child.title || child.text || child.type}
        </span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-zinc-950/95 border-l border-zinc-800/50 backdrop-blur-xl shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
        <div>
          <h3 className="text-[13px] font-semibold text-zinc-200">Connections</h3>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {entity?.type} • {entity?.id.slice(0, 8)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-32 bg-zinc-700/50 rounded mb-2"></div>
                <div className="space-y-2">
                  {[...Array(2)].map((_, j) => (
                    <div key={j} className="h-8 w-full bg-zinc-700/30 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : connections ? (
          <div className="p-4 space-y-3">
            <div className="mb-3 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">{entity?.title}</div>
              <p className="text-[11px] text-zinc-500">Everything serving this entity is listed below.</p>
            </div>

            {/* Todos (if this entity has children or owns them) */}
            {connections.todos && connections.todos.length > 0 && (
              <ConnectionSection
                title="Todos"
                icon={CheckCircle2}
                items={connections.todos}
                type="todos"
              />
            )}

            {connections.children && connections.children.length > 0 && (
              <ConnectionSection title="Subtasks" icon={CheckCircle2} items={connections.children} type="todo" />
            )}

            {/* Schedule Blocks */}
            {(connections.scheduleBlocks || connections.schedules)?.length > 0 && (
              <ConnectionSection
                title="Schedule"
                icon={CalendarDays}
                items={connections.scheduleBlocks || connections.schedules}
                type="schedule"
              />
            )}

            {/* Deadlines */}
            {connections.deadlines && connections.deadlines.length > 0 && (
              <ConnectionSection
                title="Deadlines"
                icon={Clock}
                items={connections.deadlines}
                type="deadline"
              />
            )}

            {/* Parent Goal (for habits) */}
            {connections.parentLTG && (
              <ConnectionSection
                title="Parent"
                icon={ArrowRight}
                items={[connections.parentLTG]}
                type="parent"
              />
            )}

            {/* Linked Goal */}
            {connections.linkedGoal && (
              <ConnectionSection
                title="Linked Goal"
                icon={Flame}
                items={[connections.linkedGoal]}
                type="goal"
              />
            )}

            {/* Linked Habit */}
            {connections.linkedHabit && (
              <ConnectionSection
                title="Linked Habit"
                icon={Flame}
                items={[connections.linkedHabit]}
                type="habit"
              />
            )}

            {/* Empty state when no connections */}
            {!connections.todos?.length && !connections.children?.length &&
             !connections.scheduleBlocks?.length && !connections.schedules?.length &&
             !connections.deadlines?.length && 
             !connections.parentLTG && 
             !connections.linkedGoal && 
             !connections.linkedHabit && (
              <div className="text-center py-6 text-zinc-600">
                <Brain size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-[11px]">No connections yet</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-zinc-600">
            <p className="text-[11px]">Failed to load connections</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionSectionProps {
  title: string;
  icon: React.ElementType;
  items: any[];
  type: string;
}

function ConnectionSection({ title, icon: Icon, items, type }: ConnectionSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} className="text-zinc-500" />
        <span className="text-[11px] font-medium text-zinc-400">{title}</span>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => {
          const isHabit = item.is_habit === 1 || item.type === 'habit';
          const isGoal = ['work', 'personal', 'health', 'learning', 'finance', 'relationships', 'reflection'].includes(item.category);
          
          return (
            <motion.div
              key={item.id || i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/30 border border-zinc-800/30`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${COLOR_BADGE[type as keyof typeof COLOR_BADGE]?.split(' ')[0] || 'bg-zinc-600'}`} />
              <span className="text-[11px] text-zinc-300 truncate">{item.title || item.text}</span>
              {item.due_date && (
                <CalendarDays size={10} className="ml-auto text-zinc-500" title={item.due_date} />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
