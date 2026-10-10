import { useState, useEffect, useCallback } from 'react';
import {
  X, CheckCircle2, CalendarDays, Clock, Flame, ArrowRight, Brain, BookOpen,
  DollarSign, Code, Moon, Layers, Target, Bell, Plus, RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/button';

/* ──────────────────────────────────────────────────────────────────────────
 * Goal hub panel.
 *
 * This is the "a goal is a container" surface: everything serving one goal,
 * in one place. It was written against a response shape (`res.connections.*`)
 * that the backend never returned, so it always rendered empty. The backend is
 * the source of truth now — see getGoalConnections in goal-handlers.ts — and
 * this reads exactly those keys.
 * ────────────────────────────────────────────────────────────────────────── */

interface HubItem { id: string; title?: string; text?: string; name?: string; done?: boolean | number; [k: string]: any }

interface HubConnections {
  goal?: { id: string; title: string; category?: string; is_habit?: number };
  parentLtgs?: HubItem[];
  childGoals?: HubItem[];
  todos?: HubItem[];
  schedules?: HubItem[];
  deadlines?: HubItem[];
  reminders?: HubItem[];
  notes?: HubItem[];
  learn?: HubItem[];
  finance?: HubItem[];
  ide?: HubItem[];
  brain?: HubItem[];
}

interface ConnectionExplorerProps {
  entity: { type: 'goal' | 'todo' | 'deadline' | 'habit' | 'schedule'; id: string; title: string } | null;
  isOpen: boolean;
  onClose: () => void;
}

const api = () => (window as any).deskflowAPI;

/* One row of one section. */
function HubRow({ item, onNavigate }: { item: HubItem; onNavigate?: (item: HubItem) => void }) {
  const label = item.title || item.text || item.name || item.id;
  const done = item.done === true || item.done === 1;
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(item)}
      disabled={!onNavigate}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border border-zinc-800/30 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 disabled:hover:border-zinc-800/30"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-zinc-700' : 'bg-[var(--page-accent)]'}`} />
      <span className={`text-[12px] truncate flex-1 ${done ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{label}</span>
    </button>
  );
}

/* One collapsible section. Renders NOTHING when empty unless `hint` says
 * otherwise — an empty "Todos" heading on every goal is noise. */
function HubSection({
  title, icon: Icon, items, emptyHint, onNavigate, defaultOpen = false,
}: {
  title: string;
  icon: typeof Target;
  items?: HubItem[];
  emptyHint?: string;
  onNavigate?: (item: HubItem) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const list = items || [];
  if (list.length === 0 && !emptyHint) return null;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        disabled={list.length === 0}
        className="w-full flex items-center gap-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 rounded-md disabled:cursor-default"
      >
        <Icon size={13} className="shrink-0" style={{ color: 'var(--page-accent)' }} aria-hidden />
        <span className="text-[12px] font-medium text-zinc-300 flex-1">{title}</span>
        <span className="text-[10px] tabular-nums text-zinc-600">
          {list.length > 0 ? list.length : 'none'}
        </span>
      </button>
      {open && (
        <div className="space-y-1 pb-1 pl-1">
          {list.length > 0
            ? list.map(it => <HubRow key={it.id} item={it} onNavigate={onNavigate} />)
            : <p className="text-[11px] text-zinc-600 px-2 py-1">{emptyHint}</p>}
        </div>
      )}
    </section>
  );
}

export function ConnectionExplorer({ entity, isOpen, onClose }: ConnectionExplorerProps) {
  const [connections, setConnections] = useState<HubConnections | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entity?.id) return;
    setLoading(true); setError(null);
    try {
      const res = entity.type === 'goal' || entity.type === 'habit'
        ? await api().goalGetConnections?.(entity.id)
        : await api().todoGetConnections?.(entity.type, entity.id);
      if (!res) throw new Error('No connection API available.');
      if (res.success === false) throw new Error(res.error || 'Could not load connections.');
      setConnections(res);
    } catch (e: any) {
      setError(e?.message || 'Could not load connections.');
      setConnections(null);
    } finally { setLoading(false); }
  }, [entity]);

  useEffect(() => { if (isOpen) load(); else { setConnections(null); setError(null); } }, [isOpen, load]);

  // Escape closes — nothing here is mouse-only (PAINT Gate D).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const total = connections
    ? ['todos', 'schedules', 'deadlines', 'reminders', 'notes', 'learn', 'finance', 'ide', 'brain']
      .reduce((n, k) => n + ((connections as any)[k]?.length || 0), 0)
    : 0;

  return (
    <div
      role="dialog"
      aria-label="Goal connections"
      className="fixed right-0 top-0 h-full w-88 max-w-full bg-card border-l border-border z-30 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-4 border-b border-border shrink-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-foreground truncate">
            {connections?.goal?.title || entity?.title || 'Connections'}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {loading ? 'Loading…' : error ? 'Unavailable' : `${total} linked ${total === 1 ? 'item' : 'items'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close connections"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {/* Body — 4 states: loading, error+retry, empty, populated */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading connections">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
                <div className="h-7 w-full rounded-lg bg-zinc-800/60 animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[12px]" style={{ color: 'var(--error)' }}>{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
              <RefreshCw size={12} aria-hidden />
              Retry
            </Button>
          </div>
        ) : !connections || total === 0 ? (
          <div className="py-10 text-center">
            <Target size={22} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--page-accent)' }} aria-hidden />
            <p className="text-[12px] text-foreground">Nothing linked yet</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px] mx-auto">
              Attach todos, schedule blocks, deadlines and notes to this goal and they
              will all show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <HubSection title="Todos" icon={CheckCircle2} items={connections.todos} defaultOpen
              emptyHint="No todos attached yet." />
            <HubSection title="Schedule" icon={CalendarDays} items={connections.schedules} defaultOpen
              emptyHint="No schedule blocks attached yet." />
            <HubSection title="Deadlines" icon={Clock} items={connections.deadlines}
              emptyHint="No deadlines attached yet." />
            <HubSection title="Reminders" icon={Bell} items={connections.reminders}
              emptyHint="No reminders attached yet." />
            <HubSection title="Notes" icon={BookOpen} items={connections.notes}
              emptyHint="No notes attached yet." />
            <HubSection title="Sub-goals" icon={Layers} items={connections.childGoals}
              emptyHint="No sub-goals attached yet." />
            <HubSection title="Long-term goals" icon={Flame} items={connections.parentLtgs}
              emptyHint="Not part of a long-term goal." />
            <HubSection title="Learning" icon={BookOpen} items={connections.learn}
              emptyHint="No lessons attached yet." />
            <HubSection title="Finance" icon={DollarSign} items={connections.finance}
              emptyHint="Nothing tracked in Finance for this goal." />
            <HubSection title="Projects" icon={Code} items={connections.ide}
              emptyHint="No IDE projects attached yet." />
            <HubSection title="Brain" icon={Brain} items={connections.brain}
              emptyHint="No context-brain entries attached yet." />
          </div>
        )}
      </div>

      {/* Footer — the CTA that makes the hub useful rather than read-only */}
      {!loading && !error && total > 0 && (
        <div className="p-3 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground mb-2">
            Add more from the editors — schedule blocks, deadlines and reminders all
            have a goal picker.
          </p>
        </div>
      )}
    </div>
  );
}

export default ConnectionExplorer;