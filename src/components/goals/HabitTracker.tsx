import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';

interface Habit {
  id: string;
  title: string;
  category: string;
  period: string;
  date: string;
  status: string;
  cadenceConfig?: { type: string; fixedDays: number[]; rollingTarget: number; flexibleWindowDays: number };
}

interface HabitDay {
  date: string;
  completed: boolean;
}

interface HabitWithProgress extends Habit {
  weekProgress: HabitDay[];
}

interface HabitTrackerProps {
  currentDate: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  work: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  personal: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  health: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  learning: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  finance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  relationships: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

function getWeekDays(currentDate: string): string[] {
  const d = new Date(currentDate + 'T12:00:00');
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(start);
    dd.setDate(dd.getDate() + i);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
  });
}

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export function HabitTracker({ currentDate }: HabitTrackerProps) {
  const [habits, setHabits] = useState<HabitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekDays = getWeekDays(currentDate);

  useEffect(() => {
    console.log('%c[HabitTracker] v1.0 loaded', 'color: #fbbf24; font-weight: bold');
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const api = (window as any).deskflowAPI;
        const start = weekDays[0];
        const end = weekDays[6];
        const result = await api?.getHabits?.(start, end);
        if (mounted && result?.habits) {
          const habitsWithProgress: HabitWithProgress[] = result.habits.map((h: Habit) => ({
            ...h,
            weekProgress: weekDays.map(d => ({ date: d, completed: h.date === d && h.status === 'done' })),
          }));
          setHabits(habitsWithProgress);
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Could not load habits');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [currentDate]);

  const toggleDay = async (habitId: string, date: string, currentStatus: boolean) => {
    try {
      const api = (window as any).deskflowAPI;
      await api?.toggleHabitDay?.(habitId, date, !currentStatus);
      setHabits(prev => prev.map(h => {
        if (h.id !== habitId) return h;
        return {
          ...h,
          weekProgress: h.weekProgress.map(d =>
            d.date === date ? { ...d, completed: !currentStatus } : d
          ),
        };
      }));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500"><LoaderCircle size={13} className="animate-spin" /> Loading habits...</div>
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-zinc-800/30 animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[11px] text-rose-300">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 inline-flex items-center gap-1.5 text-rose-200 hover:text-white">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="p-6 text-center">
        <Target size={24} className="mx-auto mb-2 text-zinc-600" />
        <p className="text-[13px] text-zinc-400">No habits yet</p>
        <p className="text-[11px] text-zinc-600 mt-1">Create one with "habit" target type in the goal form.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-2">
        <Flame size={13} className="text-amber-400" /> Weekly habit grid
      </div>

      {/* Day headers */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `1fr repeat(7, 36px)` }}>
        <div />
        {weekDays.map(d => (
          <div key={d} className={`text-center text-[10px] font-medium ${d === currentDate ? 'text-amber-400' : 'text-zinc-500'}`}>
            {formatDayLabel(d)}
          </div>
        ))}
      </div>

      {/* Habit rows */}
      {habits.map(habit => {
        const completedCount = habit.weekProgress.filter(d => d.completed).length;
        const colorClass = CATEGORY_COLORS[habit.category] || CATEGORY_COLORS.work;
        return (
          <div key={habit.id} className="grid gap-1 items-center" style={{ gridTemplateColumns: `1fr repeat(7, 36px)` }}>
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="text-[12px] text-zinc-300 truncate">{habit.title}</span>
              {completedCount > 0 && (
                <span className="text-[9px] text-amber-400/80 shrink-0 flex items-center gap-0.5">
                  <Flame size={8} />{completedCount}
                </span>
              )}
            </div>
            {habit.weekProgress.map(day => (
              <motion.button
                key={day.date}
                type="button"
                whileTap={{ scale: 0.85 }}
                onClick={() => toggleDay(habit.id, day.date, day.completed)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  day.completed
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : day.date === currentDate
                      ? 'bg-zinc-800/60 border-zinc-600/50 text-zinc-400 hover:border-zinc-500'
                      : 'bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border-zinc-800/40 text-zinc-600 hover:border-zinc-700'
                }`}
              >
                {day.completed && <CheckCircle2 size={14} />}
              </motion.button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
