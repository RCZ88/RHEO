import { useMemo } from 'react';
import { BookOpen, Users, Dumbbell, Circle, CalendarX, MapPin, Clock } from 'lucide-react';
import type { ScheduleActivitySeries } from './ActivityTypes';
import { CATEGORY_ICON, CATEGORY_LABEL } from './ActivitiesTimetable';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon/Wed 18:30" — the recurrence pill. Sessions are grouped by identical
 *  times so one class with a Mon+Wed pair reads as ONE pill, not two. */
function recurrencePill(series: ScheduleActivitySeries): string {
  const byTime = new Map<string, number[]>();
  series.sessions.forEach(s => {
    const key = `${s.startTime}-${s.endTime}`;
    if (!byTime.has(key)) byTime.set(key, []);
    byTime.get(key)!.push(s.dayOfWeek);
  });
  return [...byTime.entries()].map(([time, days]) => {
    const [st, et] = time.split('-');
    return `${days.slice().sort().map(d => DAY_SHORT[d]).join('/')} ${st}-${et}`;
  }).join(' · ');
}

export function ActivitiesList({
  series,
  onOpen,
  loading,
}: {
  series: ScheduleActivitySeries[];
  onOpen: (s: ScheduleActivitySeries) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-hidden>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 rounded-lg bg-zinc-800/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
          <CalendarX size={20} className="text-zinc-500" />
        </div>
        <p className="text-[12px] text-zinc-400">
          No activities yet. Add a class or a club you go to every week.
        </p>
      </div>
    );
  }

  const grouped = series.reduce<Record<string, ScheduleActivitySeries[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([cat, items]) => {
        const Icon = CATEGORY_ICON[cat as keyof typeof CATEGORY_ICON] ?? CATEGORY_ICON.other;
        const label = CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? 'Other';
        return (
          <section key={cat}>
            <h3 className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-2">
              <Icon size={12} aria-hidden />
              {label}
              <span className="text-[10px] text-zinc-600 tabular-nums">{items.length}</span>
            </h3>
            <div className="space-y-1.5">
              {items.map(s => (
                <button
                  key={s.seriesId}
                  type="button"
                  onClick={() => onOpen(s)}
                  className="w-full text-left rounded-lg bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/60 p-2.5 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-medium text-zinc-200 truncate" title={s.title}>
                        {s.title}
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-300">
                        <Clock size={8} aria-hidden />
                        {recurrencePill(s)}
                      </span>
                    </span>
                  </div>
                  {s.location && (
                    <span className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                      <MapPin size={9} aria-hidden /> {s.location}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}