// ============================================================
// RHEO — TodoMiniPage (pinned always-on-top popup window)
// Rendered standalone at hash route #/mini-todo inside a small
// frameless BrowserWindow. Same bundle, same preload, same IPC —
// talks to the REAL todos backend (todo:list/toggle/create/delete)
// so the popup stays live with zero extra backend work.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Pin, PinOff, X, Plus, Check, Trash2, ExternalLink, Minus } from 'lucide-react';

interface MiniTodo {
  id: string;
  text: string;
  done: boolean;
  due_date?: string | null;
  deadline_text?: string | null;
}

const api = () => (window as any).deskflowAPI;

// DB rows are snake_case with done as 0/1 — normalize once on load.
function normalize(rows: any[]): MiniTodo[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => ({
    id: String(r.id),
    text: String(r.text ?? ''),
    done: r.done === 1 || r.done === true || r.done === '1',
    due_date: r.due_date ?? r.dueDate ?? null,
    deadline_text: r.deadline_text ?? r.deadlineText ?? null,
  }));
}

function dueLabel(t: MiniTodo): { text: string; color: string } {
  if (t.deadline_text) return { text: t.deadline_text, color: 'text-white/40' };
  if (!t.due_date) return { text: '', color: '' };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(String(t.due_date).slice(0, 10) + 'T00:00:00');
  if (isNaN(due.getTime())) return { text: String(t.due_date), color: 'text-white/40' };
  const d = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (d < 0) return { text: `${-d}d overdue`, color: 'text-rose-400' };
  if (d === 0) return { text: 'today', color: 'text-rose-300' };
  if (d === 1) return { text: 'tomorrow', color: 'text-orange-300' };
  if (d <= 5) return { text: `${d}d left`, color: 'text-amber-300' };
  return { text: `${d}d left`, color: 'text-white/40' };
}

export function TodoMiniPage() {
  const [items, setItems] = useState<MiniTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState(true);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api()?.todoList?.();
      if (res?.success) {
        setItems(normalize(res.todos));
        setError(null);
      } else {
        setError(res?.error || 'Failed to load');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // stay fresh while pinned
    api()?.todoPopupGetState?.().then((s: any) => {
      if (typeof s?.pinned === 'boolean') setPinned(s.pinned);
    }).catch(() => {});
    const off = api()?.onTodoPopupState?.((s: any) => {
      if (typeof s?.pinned === 'boolean') setPinned(s.pinned);
    });
    return () => { clearInterval(t); if (typeof off === 'function') off(); };
  }, [load]);

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next); // optimistic
    try {
      await api()?.todoPopupSetPinned?.(next);
    } catch { setPinned(!next); }
  };

  const toggle = async (id: string) => {
    setItems(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t)); // optimistic
    try { await api()?.todoToggle?.(id); load(); }
    catch { load(); }
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(t => t.id !== id));
    try { await api()?.todoDelete?.(id); }
    catch { load(); }
  };

  const add = async () => {
    const v = text.trim();
    if (!v) return;
    setText(''); setDue(''); setAdding(false);
    try {
      await api()?.todoCreate?.({ text: v, dueDate: due || null });
      load();
    } catch { load(); }
  };

  const pending = items.filter(t => !t.done);
  const doneCount = items.length - pending.length;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#101012]/95 text-white overflow-hidden select-none">
      {/* Custom title bar — drag region (frameless window) */}
      <div
        className="flex items-center justify-between pl-3 pr-1.5 py-1.5 shrink-0 border-b border-white/10"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Todos · {pending.length}{doneCount > 0 ? ` (+${doneCount} done)` : ''}
        </div>
        <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={togglePin}
            title={pinned ? 'Unpin (allow other windows above)' : 'Pin on top of all windows'}
            className={`p-1.5 rounded-md transition-colors ${pinned ? 'text-cyan-300 bg-cyan-500/15' : 'text-white/40 hover:text-white/80 hover:bg-white/10'}`}
          >
            {pinned ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
          <button
            onClick={() => api()?.todoPopupFocusMain?.()}
            title="Open full app"
            className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={() => api()?.todoPopupMinimize?.()}
            title="Minimize"
            className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() => api()?.todoPopupClose?.()}
            title="Close popup"
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-rose-500/60 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="space-y-1.5 p-1">
            {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />)}
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-8">
            <p className="text-[12px] text-white/50">{error}</p>
            <button onClick={load} className="mt-2 text-[12px] text-cyan-300 hover:underline">Retry</button>
          </div>
        )}
        {!loading && !error && pending.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[13px] text-white/60 font-medium">All clear 🎉</p>
            <p className="text-[11px] text-white/40 mt-0.5">No pending todos</p>
          </div>
        )}
        {!loading && !error && pending.map(t => {
          const meta = dueLabel(t);
          return (
            <div key={t.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] transition-colors">
              <button
                onClick={() => toggle(t.id)}
                title="Mark done"
                className="w-5 h-5 shrink-0 rounded-full border border-white/25 hover:border-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center text-transparent hover:text-emerald-300 transition-colors"
              >
                <Check size={12} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] text-white/85 truncate leading-tight">{t.text}</p>
                {meta.text && <p className={`text-[10.5px] ${meta.color}`}>{meta.text}</p>}
              </div>
              <button
                onClick={() => remove(t.id)}
                title="Delete"
                className="p-1 rounded text-white/25 hover:text-rose-300 hover:bg-rose-500/15 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick add */}
      <div className="shrink-0 p-2 border-t border-white/10">
        {adding ? (
          <div className="space-y-1.5">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="What needs doing?"
              autoFocus
              className="w-full px-2 py-1.5 rounded-md bg-white/10 border border-white/15 text-[12px] placeholder:text-white/30 outline-none focus:border-cyan-400/50"
            />
            <div className="flex gap-1.5">
              <input
                type="date"
                value={due}
                onChange={e => setDue(e.target.value)}
                className="flex-1 px-2 py-1 rounded-md bg-white/10 border border-white/15 text-[11px] text-white/70 outline-none [color-scheme:dark]"
              />
              <button onClick={add} className="px-2.5 py-1 rounded-md bg-cyan-500/80 hover:bg-cyan-500 text-[11px] font-medium transition-colors">Add</button>
              <button onClick={() => setAdding(false)} className="px-2 py-1 rounded-md text-white/50 hover:text-white text-[11px]">✕</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] text-white/50 hover:text-white/85 hover:bg-white/[0.07] transition-colors"
          >
            <Plus size={13} /> Quick add
          </button>
        )}
      </div>
    </div>
  );
}
