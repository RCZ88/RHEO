import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, CheckCircle2, CalendarDays, Clock, Flame, FileText, Brain, X } from 'lucide-react';

interface HierarchyTreeProps {
  roots: Array<{
    type: 'goal' | 'habit' | 'deadline' | 'schedule' | 'todo';
    id: string;
    title: string;
    children?: any[];
  }>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (entity: { type: string; id: string }) => void;
  filter?: 'all' | 'goals' | 'todos' | 'deadlines' | 'schedule';
  onFilterChange?: (filter: HierarchyTreeProps['filter']) => void;
}

const ENTITY_COLORS: Record<string, { dot: string; text: string, bg: string }> = {
  goal: { dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10' },
  habit: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  deadline: { dot: 'bg-rose-400', text: 'text-rose-300', bg: 'bg-rose-500/10' },
  schedule: { dot: 'bg-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  todo: { dot: 'bg-violet-400', text: 'text-violet-300', bg: 'bg-violet-500/10' }
};

const TYPE_LABELS: Record<string, string> = {
  goal: 'Goal',
  habit: 'Habit',
  deadline: 'DL',
  schedule: 'S',
  todo: 'Todo'
};

const TYPE_ICON: Record<string, React.ElementType> = {
  goal: CheckCircle2,
  habit: Flame,
  deadline: CalendarDays,
  schedule: Clock,
  todo: CheckCircle2
};

interface TreeNodeProps {
  node: any;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (entity: { type: string; id: string }) => void;
  filter?: string;
  onFilterChange?: (filter: HierarchyTreeProps['filter']) => void;
}

function TreeNode({ node, depth, expanded, onToggle, onSelect, filter, onFilterChange }: TreeNodeProps) {
  const Icon = TYPE_ICON[node.type] || FileText;
  const colors = ENTITY_COLORS[node.type] || ENTITY_COLORS.todo;
  const hasChildren = node.children && node.children.length > 0;
  const normalizedFilter = filter === 'goals' ? 'goal' : filter === 'todos' ? 'todo' : filter;
  const isFiltered = normalizedFilter && normalizedFilter !== 'all' && normalizedFilter !== node.type;

  if (isFiltered) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="select-none"
    >
      <div
        onClick={() => onToggle(node.id)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-900/40 cursor-pointer transition-colors"
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className={`p-0.5 rounded hover:bg-zinc-800/50 transition-colors ${
              expanded.has(node.id) ? 'rotate-180' : ''
            }`}
          >
            <ChevronRight size={12} className="text-zinc-500" />
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Type indicator */}
        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />

        {/* Icon */}
        <Icon size={12} className={`shrink-0 ${colors.text}`} />

        {/* Title */}
        <span className={`text-[11px] ${colors.text} truncate flex-1`}>
          {node.title}
        </span>

        {/* Type label */}
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider whitespace-nowrap">
          {TYPE_LABELS[node.type] || '?'}
        </span>

        {/* Select button */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect({ type: node.type, id: node.id }); }}
          className="ml-auto p-0.5 text-zinc-600 hover:text-zinc-300 rounded hover:bg-zinc-800/50"
          aria-label={`Select ${node.title}`}
        >
          <X size={10} />
        </button>
      </div>

      {/* Children */}
      {hasChildren && expanded.has(node.id) && (
        <AnimatePresence>
          {node.children.map((child: any, i: number) => (
            <TreeNode
              key={child.id || i}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              filter={filter}
              onFilterChange={onFilterChange}
            />
          ))}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

export function HierarchyTree({ 
  roots, 
  expanded, 
  onToggle, 
  onSelect,
  filter = 'all',
  onFilterChange,
}: HierarchyTreeProps) {
  // Filter roots by type
  const visibleRoots = useMemo(() => {
    if (filter === 'all') return roots;
    const normalizedFilter = filter === 'goals' ? 'goal' : filter === 'todos' ? 'todo' : filter;
    return roots.filter(r => r.type === normalizedFilter);
  }, [roots, filter]);

  return (
    <div className="h-full flex flex-col">
      {/* Filter chips */}
      <div className="flex gap-1 p-2 border-b border-zinc-800/50 overflow-x-auto">
        {(['all', 'goals', 'todos', 'deadlines', 'schedule'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange?.(f)}
            className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
              filter === f
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {visibleRoots.length === 0 ? (
          <div className="text-center py-6 text-zinc-600">
            <Brain size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-[11px]">No items to display</p>
          </div>
        ) : (
          visibleRoots.map((root, i) => (
            <TreeNode
              key={root.id || i}
              node={root}
              depth={0}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              filter={filter}
              onFilterChange={onFilterChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
