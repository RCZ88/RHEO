import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Plus, X, Flame, Clock, Trash2, CalendarDays, Link2, Pin, PinOff } from 'lucide-react';
import { LinkPicker, type LinkValue } from './LinkPicker';
import { EntityChip } from './EntityChip';

interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string | null;
  goalId?: string | null;
  deadlineId?: string | null;
  scheduleId?: string | null;
  parentTodoId?: string | null;
  dueDate?: string | null;
  deadlineText?: string | null;
  reminder?: 'none' | '5min' | '15min' | '1hour' | '1day';
  sortOrder?: number;
}

interface GoalOption {
  id: string;
  title: string;
  category: string;
}

interface DeadlineOption {
  id: string;
  title: string;
  dueDate: string;
}

interface ScheduleOption {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface TodoListProps {
  // Data remains IPC-backed; option lists are supplied by the Gold hub.
  goalOptions?: GoalOption[];
  deadlineOptions?: DeadlineOption[];
  scheduleOptions?: ScheduleOption[];
}

export function TodoList({ goalOptions = [], deadlineOptions = [], scheduleOptions = [] }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  
  // Form state for linking
  const [linkedGoalId, setLinkedGoalId] = useState<string>('');
  const [linkedDeadlineId, setLinkedDeadlineId] = useState<string>('');
  const [linkedScheduleId, setLinkedScheduleId] = useState<string>('');
  const [linkedParentTodoId, setLinkedParentTodoId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [link, setLink] = useState<LinkValue>({ type: 'none' });
  // Pinned popup window state (always-on-top mini todolist)
  const [popupOpen, setPopupOpen] = useState(false);

  const api = (window as any).deskflowAPI;

  // Load todos on mount
  useEffect(() => {
    console.log('%c[TodoList] v2.0 loaded', 'color: #fbbf24; font-weight: bold');
    loadTodos();
  }, [api]);

  // Sync pinned-popup open state
  useEffect(() => {
    api?.todoPopupGetState?.().then((s: any) => {
      if (typeof s?.open === 'boolean') setPopupOpen(s.open);
    }).catch(() => {});
    const off = api?.onTodoPopupState?.((s: any) => {
      if (typeof s?.open === 'boolean') setPopupOpen(s.open);
    });
    return () => { if (typeof off === 'function') off(); };
  }, [api]);

  const loadTodos = async () => {
    setLoading(true);
    try {
      if (!api?.todoList) {
        setError('IPC not available');
        setTodos([]);
        return;
      }
      const res = await api.todoList();
      if (res?.success) {
        setTodos(res.todos || []);
      } else {
        setError(res?.error || 'Failed to load todos');
        setTodos([]);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load todos');
      setTodos([]);
    } finally {
      setLoading(false);
    }
  };

  const pending = useMemo(() => todos.filter(t => !t.done), [todos]);
  const done = useMemo(() => todos.filter(t => t.done), [todos]);
  const displayTodos = showAll ? todos : pending;

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      const res = await api.todoCreate({
        text: newText.trim(),
        goalId: link.type === 'goal' ? link.id : null,
        deadlineId: link.type === 'deadline' ? link.id : null,
        scheduleId: link.type === 'schedule' ? link.id : null,
        parentTodoId: link.type === 'todo' ? link.id : null,
        dueDate: dueDate || null,
      });
      if (res?.success) {
        const newTodo: Todo = {
          id: res.id,
          text: newText.trim(),
          done: false,
          createdAt: new Date().toISOString(),
          goalId: link.type === 'goal' ? link.id : null,
          deadlineId: link.type === 'deadline' ? link.id : null,
          scheduleId: link.type === 'schedule' ? link.id : null,
          parentTodoId: link.type === 'todo' ? link.id : null,
          dueDate: dueDate || null,
        };
        setTodos(prev => [...prev, newTodo]);
        setNewText('');
        setLinkedGoalId('');
        setLinkedDeadlineId('');
        setLinkedScheduleId('');
        setLinkedParentTodoId('');
        setDueDate('');
        setLink({ type: 'none' });
      }
    } catch (e) {
      console.error('Failed to create todo:', e);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.todoToggle(id);
      setTodos(prev => prev.map(t => 
        t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? null : new Date().toISOString() } : t
      ));
    } catch (e) {
      console.error('Failed to toggle todo:', e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.todoDelete(id);
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error('Failed to delete todo:', e);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Todo>) => {
    try {
      await api.todoUpdate(id, patch);
      setTodos(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    } catch (e) {
      console.error('Failed to update todo:', e);
    }
  };

  const clearForm = () => {
    setShowForm(false);
    setEditingTodo(null);
    setLinkedGoalId('');
    setLinkedDeadlineId('');
    setLinkedScheduleId('');
    setLinkedParentTodoId('');
    setDueDate('');
    setLink({ type: 'none' });
  };

  if (loading) {
    return (
      <div className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] rounded-xl p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-32 bg-zinc-700/50 rounded"></div>
          <div className="h-10 w-full bg-zinc-700/50 rounded"></div>
          <div className="space-y-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 w-full bg-zinc-700/50 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] rounded-xl p-4">
        <p className="text-[11px] text-rose-400 text-center">Error: {error}</p>
        <button
          onClick={loadTodos}
          className="mt-2 w-full text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-cyan-400" />
          <span className="text-[13px] font-semibold text-zinc-200">Interconnected Todos</span>
          <span className="text-[10px] text-zinc-500 tabular-nums">{pending.length} pending</span>
        </div>
        {done.length > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showAll ? 'Hide done' : `Show ${done.length} done`}
          </button>
        )}
        <button
          onClick={async () => {
            try {
              const res = await api?.todoPopupToggle?.();
              if (typeof res?.open === 'boolean') setPopupOpen(res.open);
            } catch {}
          }}
          title={popupOpen ? 'Close pinned todo popup' : 'Pop out as pinned window (stays on top of other apps)'}
          aria-label={popupOpen ? 'Close pinned todo popup' : 'Pop out pinned always-on-top todo window'}
          className={`p-1.5 rounded-md transition-colors ${popupOpen ? 'text-cyan-300 bg-cyan-500/15' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/10'}`}
        >
          {popupOpen ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-3 p-3 border border-zinc-800/50 rounded-xl bg-zinc-950/30">
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={editingTodo ? "Edit todo..." : "Add todo..."}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[12px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-cyan-500/50 mb-2"
          />
          
          <div className="mb-2">
            <LinkPicker value={link} onChange={setLink} goals={goalOptions} deadlines={deadlineOptions} schedules={scheduleOptions} todos={todos.map(t => ({ id: t.id, text: t.text }))} />
          </div>
          
          <div className="flex gap-2 justify-end">
            <button
              onClick={clearForm}
              className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newText.trim()}
              className="px-3 py-1 text-[11px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 rounded hover:bg-cyan-500/25 disabled:opacity-30"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-[11px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 mb-3"
        >
          <Plus size={12} />
          Add todo
        </button>
      )}

      {/* Todo list */}
      {displayTodos.length === 0 ? (
        <p className="text-[11px] text-zinc-600 text-center py-3">
          {todos.length === 0 ? 'No todos yet — add one above' : 'All done! Nice work.'}
        </p>
      ) : (
        <div className="space-y-1">
          <AnimatePresence>
            {displayTodos.map(todo => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors bg-zinc-900/30 border border-zinc-800/30 hover:border-zinc-700/40"
              >
                <button
                  onClick={() => handleToggle(todo.id)}
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    todo.done
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-zinc-600 hover:border-cyan-400/60'
                  }`}
                >
                  {todo.done && <CheckCircle2 size={10} className="text-white" />}
                </button>
                
                <span className={`flex-1 truncate text-[12px] ${
                  todo.done ? 'text-zinc-500 line-through' : 'text-zinc-300'
                }`}>
                  {todo.text}
                </span>
                
                {/* Link badges */}
                {todo.goalId && <EntityChip kind="goal" label={goalOptions.find(g => g.id === todo.goalId)?.title || 'Unlinked goal'} />}
                
                {todo.deadlineId && <EntityChip kind="deadline" label={deadlineOptions.find(d => d.id === todo.deadlineId)?.title || 'Unlinked deadline'} />}
                
                {todo.scheduleId && <EntityChip kind="schedule" label={scheduleOptions.find(s => s.id === todo.scheduleId)?.title || 'Unlinked schedule'} />}
                
                {todo.dueDate && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20" title={todo.dueDate}>
                    <CalendarDays size={8} />
                  </span>
                )}
                {!todo.goalId && !todo.scheduleId && !todo.parentTodoId && <EntityChip kind="todo" label="Unlinked" />}
                
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={10} />
                </button>
              </motion.div>
            ))}</AnimatePresence>
          </div>
        )}
    </div>
  );
}
