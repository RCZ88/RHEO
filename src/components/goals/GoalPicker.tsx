import { useState, useEffect, useRef } from 'react';
import { Target, ChevronDown, X, Loader2 } from 'lucide-react';

/**
 * Goal picker — attach any entity (deadline, reminder, note, …) to a goal.
 *
 * Reused rather than hand-rolled per editor (PAINT Gate B): the DeadlinesCard
 * and the BellBoard both lacked a way to set `goal_id`, which is why
 * `getGoalConnections` always returned zero links.
 *
 * Goals come from getGoalsBatch over a wide window (same approach as
 * GoldPage.loadGoals) because routines are not tied to the selected day.
 */

interface GoalOption { id: string; title: string; status?: string }

interface GoalPickerProps {
  /** Current goal id, or null when the entity is not attached to a goal. */
  value: string | null;
  onChange: (goalId: string | null) => void;
  label?: string;
  /** Optional: show which goals already exist for context. */
  size?: 'sm' | 'md';
}

const api = () => (window as any).deskflowAPI;

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function GoalPicker({ value, onChange, label = 'Goal', size = 'sm' }: GoalPickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const res = await api()?.getGoalsBatch?.('2000-01-01', addDaysStr(todayStr, 120));
        const map = new Map<string, GoalOption>();
        for (const d of (res?.days || []) as any[]) {
          for (const g of (d.goals || []) as any[]) {
            if (!g?.id) continue;                       // skip NULL-id orphans
            if (g.status === 'suggested') continue;     // not yet accepted
            map.set(g.id, { id: g.id, title: g.title, status: g.status });
          }
        }
        if (alive) setGoals([...map.values()].filter(g => g.status !== 'done'));
      } catch { if (alive) setGoals([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = goals.find(g => g.id === value);
  const fallbackLabel = value
    ? (selected?.title || 'Attached goal')
    : 'No goal';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${fallbackLabel}. Change`}
        className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-8 px-2.5 text-[12px]'} rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 ${
          value
            ? 'text-[var(--page-accent)]'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        style={value ? {
          backgroundColor: 'color-mix(in srgb, var(--page-accent) 12%, transparent)',
          borderColor: 'color-mix(in srgb, var(--page-accent) 28%, transparent)',
        } : { borderColor: 'var(--color-border)', borderStyle: 'dashed' }}
      >
        <Target size={11} aria-hidden />
        <span className="max-w-[110px] truncate">{fallbackLabel}</span>
        <ChevronDown size={11} aria-hidden className="opacity-60" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 left-0 w-64 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-1"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 ${!value ? 'text-[var(--page-accent)]' : 'text-muted-foreground'}`}
          >
            <X size={11} aria-hidden />
            No goal
          </button>

          {loading ? (
            <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground" aria-busy="true">
              <Loader2 size={11} className="animate-spin" aria-hidden /> Loading goals…
            </div>
          ) : goals.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">
              No goals yet. Add one on the Gold tab, then attach it here.
            </p>
          ) : (
            goals.map(g => (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={g.id === value}
                onClick={() => { onChange(g.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 ${
                  g.id === value ? 'text-[var(--page-accent)]' : 'text-zinc-300'
                }`}
              >
                <Target size={11} aria-hidden className="shrink-0 opacity-60" />
                <span className="truncate">{g.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default GoalPicker;