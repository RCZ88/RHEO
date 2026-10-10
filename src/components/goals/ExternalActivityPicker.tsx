import { useEffect, useState } from 'react';
import { Activity, Check, LoaderCircle, RefreshCw } from 'lucide-react';

export interface ExternalActivityOption {
  id: number;
  name: string;
  type?: string;
  color?: string;
  icon?: string;
  today_seconds?: number;
}

interface ExternalActivityPickerProps {
  value: number | null;
  onChange: (activityId: number | null) => void;
}

function formatMinutes(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes < 60 ? `${minutes}m today` : `${Math.floor(minutes / 60)}h ${minutes % 60}m today`;
}

export function ExternalActivityPicker({ value, onChange }: ExternalActivityPickerProps) {
  const [activities, setActivities] = useState<ExternalActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('%c[ExternalActivityPicker] v1.0 loaded', 'color: #fbbf24; font-weight: bold');
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const api = (window as any).deskflowAPI;
        const rows = await api?.activityGoalGetAll?.();
        if (mounted) setActivities(Array.isArray(rows) ? rows : []);
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Could not load external activities.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2" aria-live="polite">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500"><LoaderCircle size={13} className="animate-spin" /> Loading external activities...</div>
        <div className="h-12 rounded-xl bg-zinc-800/40 animate-pulse" />
        <div className="h-12 rounded-xl bg-zinc-800/40 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[11px] text-rose-300">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-rose-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60">
          <RefreshCw size={12} /> Reload activities
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] text-center">
        <Activity size={20} className="mx-auto mb-2 text-zinc-600" />
        <p className="text-[12px] text-zinc-400">No external activities yet</p>
        <p className="mt-1 text-[10px] text-zinc-600">Create one on the External page first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-zinc-500">Choose the activity this goal should measure.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
        {activities.map(activity => {
          const selected = value === activity.id;
          return (
            <button
              type="button"
              key={activity.id}
              onClick={() => onChange(selected ? null : activity.id)}
              aria-pressed={selected}
              className={`min-h-11 flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${selected ? 'border-violet-500/50 bg-violet-500/10' : 'border-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] hover:border-zinc-700 hover:bg-zinc-800/50'}`}
            >
              <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${activity.color || '#f59e0b'}22`, color: activity.color || '#f59e0b' }}>
                <Activity size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-zinc-200">{activity.name}</span>
                <span className="block text-[10px] text-zinc-600">{formatMinutes(Number(activity.today_seconds) || 0)}</span>
              </span>
              {selected && <Check size={14} className="shrink-0 text-violet-300" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
