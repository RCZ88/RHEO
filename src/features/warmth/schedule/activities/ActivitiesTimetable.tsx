import { useMemo } from 'react';
import { BookOpen, Users, Dumbbell, Circle, CalendarX } from 'lucide-react';
import type { ScheduleActivitySeries } from './ActivityTypes';

export const CATEGORY_ICON = {
  class: BookOpen,
  club: Users,
  sport: Dumbbell,
  other: Circle,
} as const;

export const CATEGORY_LABEL = {
  class: 'Class',
  club: 'Club',
  sport: 'Sport',
  other: 'Other',
} as const;

const DAYS = [
  { idx: 1, label: 'Mon' },
  { idx: 2, label: 'Tue' },
  { idx: 3, label: 'Wed' },
  { idx: 4, label: 'Thu' },
  { idx: 5, label: 'Fri' },
  { idx: 6, label: 'Sat' },
  { idx: 0, label: 'Sun' },
];

const toMin = (hhmm: string) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface Block {
  series: ScheduleActivitySeries;
  sessionId: string;
  dayIdx: number;
  startMin: number;
  endMin: number;
}

/**
 * Overlap layout — the one piece of real geometry in this file.
 *
 * A block is placed in the first COLUMN whose already-placed blocks all end
 * before it starts. That is a greedy column packer, not a true interval-graph
 * layout, and it is deliberate: it is stable, it is O(n) per column, and it
 * never produces a negative width. Every block in a column gets width
 * 1/columns so N overlapping blocks split the day exactly.
 */
function layoutDay(blocks: Block[]) {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const columnEnds: number[] = [];
  const placed = sorted.map(b => {
    let col = columnEnds.findIndex(end => end <= b.startMin);
    if (col === -1) { col = columnEnds.length; columnEnds.push(b.endMin); }
    else columnEnds[col] = b.endMin;
    return { ...b, col };
  });
  return { placed, columns: Math.max(columnEnds.length, 1) };
}

export function ActivitiesTimetable({
  series,
  onOpen,
  onError,
  loading,
}: {
  series: ScheduleActivitySeries[];
  onOpen: (s: ScheduleActivitySeries) => void;
  onError: () => void;
  loading: boolean;
}) {
  /* ── loading: a skeleton shaped like the GRID, not a spinner (UX §6) ── */
  if (loading) {
    return (
      <div className="flex gap-1.5" aria-hidden>
        {DAYS.map(d => (
          <div key={d.idx} className="flex-1 space-y-1.5">
            <div className="h-5 rounded bg-zinc-800/60 animate-pulse" />
            <div className="h-12 rounded bg-zinc-800/40 animate-pulse" />
            <div className="h-10 rounded bg-zinc-800/40 animate-pulse" />
            <div className="h-14 rounded bg-zinc-800/40 animate-pulse" />
          </div>
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

  const blocks: Block[] = series.flatMap(s =>
    s.sessions.map(sess => ({
      series: s,
      sessionId: sess.id,
      dayIdx: sess.dayOfWeek,
      startMin: toMin(sess.startTime),
      endMin: toMin(sess.endTime),
    })),
  );

  const byDay = useMemo(() => {
    const map = new Map<number, Block[]>();
    blocks.forEach(b => {
      if (!map.has(b.dayIdx)) map.set(b.dayIdx, []);
      map.get(b.dayIdx)!.push(b);
    });
    return map;
  }, [series]);

  /* Sat/Sun appear ONLY if something is scheduled on them — otherwise the
     week looks like it has no weekend, which is a claim, not a fact. */
  const visibleDays = DAYS.filter(d => d.idx <= 5 || (byDay.get(d.idx)?.length ?? 0) > 0);

  return (
    <div className="flex gap-1.5 min-h-0">
      {visibleDays.map(d => {
        const { placed, columns } = layoutDay(byDay.get(d.idx) ?? []);
        return (
          <div key={d.idx} className="flex-1 min-w-0 space-y-1">
            <div className="text-[10px] font-medium text-zinc-500 text-center pb-1 border-b border-zinc-800/40">
              {d.label}
            </div>
            <div className="space-y-1">
              {placed.map(b => {
                const Icon = CATEGORY_ICON[b.series.category] ?? CATEGORY_ICON.other;
                const label = CATEGORY_LABEL[b.series.category] ?? 'Other';
                return (
                  <button
                    key={b.sessionId}
                    type="button"
                    onClick={() => onOpen(b.series)}
                    title={`${b.series.title} — ${CATEGORY_LABEL[b.series.category]} ${b.series.startTime ?? ''}`}
                    className="w-full text-left px-1.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
                    style={{ marginLeft: `${(b.col / columns) * 100}%`, width: `${100 / columns}%` }}
                  >
                    <span className="flex items-center gap-1 min-w-0">
                      <Icon size={10} className="text-cyan-400 shrink-0" aria-hidden />
                      <span className="text-[10px] font-medium text-zinc-200 truncate">{b.series.title}</span>
                    </span>
                    <span className="block text-[9px] text-zinc-500 truncate">
                      {b.startMin}–{b.endMin}
                    </span>
                    <span className="sr-only">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}