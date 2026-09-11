import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, CheckCircle2, Clock, Sparkles, X } from "lucide-react";
import type { ExternalActivity, ExternalSession } from "@/types/external";
import {
  suggestGapActivities,
  type Gap,
} from "@/lib/external/gaps";

export type Timeframe = "day" | "week" | "month" | "all";

const TIMEFRAME_OPTIONS: { key: Timeframe; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All Time" },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
  }

  return `${minutes}m`;
}

// Splits multi-day gaps (backend merges untracked spans across day boundaries
// into one contiguous gap) into one per-day segment, clipped at local midnights
// so each calendar day renders as its own row with its own duration.
function splitGapByDay(gap: Gap): Gap[] {
  const start = new Date(gap.start);
  const end = new Date(gap.end);

  if (start.toDateString() === end.toDateString()) return [gap];

  const result: Gap[] = [];
  let dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  while (dayStart.getTime() < end.getTime()) {
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);

    const segStart = start.getTime() > dayStart.getTime() ? start : dayStart;
    const segEnd = end.getTime() < nextDay.getTime() ? end : nextDay;

    if (segEnd.getTime() > segStart.getTime()) {
      result.push({
        id: `${gap.id}|${segStart.getTime()}-${segEnd.getTime()}`,
        start: segStart,
        end: segEnd,
        duration_seconds: Math.max(
          0,
          Math.round((segEnd.getTime() - segStart.getTime()) / 1000)
        ),
      });
    }
    dayStart = nextDay;
  }

  return result.length > 0 ? result : [gap];
}

function formatDay(date: Date): string {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function GapsListModal({
  open,
  activities,
  sessions,
  defaultTimeframe = "week",
  onClose,
  onPickGap,
  onFillGaps,
  onAssignTime,
}: {
  open: boolean;
  activities: ExternalActivity[];
  sessions: ExternalSession[];
  defaultTimeframe?: Timeframe;
  onClose: () => void;
  onPickGap: (gap: Gap) => void;
  onFillGaps?: (gaps: Gap[]) => void;
  onAssignTime?: (gap: Gap) => void;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>(defaultTimeframe);

  useEffect(() => {
    if (open) setTimeframe(defaultTimeframe);
  }, [open, defaultTimeframe]);

  const [gapsLoading, setGapsLoading] = useState(false);
  const [rawGaps, setRawGaps] = useState<Gap[] | null>(null);
  const [selected, setSelected] = useState<Map<string, Gap>>(new Map());

  const toggleGap = (gap: Gap) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(gap.id)) next.delete(gap.id);
      else next.set(gap.id, gap);
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGapsLoading(true);
    setRawGaps(null);
    setSelected(new Map());

    const period =
      timeframe === "day"
        ? "today"
        : timeframe === "all"
          ? "all"
          : timeframe;

    (window as any).deskflowAPI?.detectUsageGaps?.({ period, minGapMinutes: 5 })
      .then((list: any[]) => {
        if (cancelled) return;
        const mapped: Gap[] = (list || []).flatMap((gap: any) => {
          const base: Gap = {
            id: `${gap.start}-${gap.end}`,
            start: new Date(gap.start),
            end: new Date(gap.end),
            duration_seconds: Math.max(
              0,
              Math.floor((new Date(gap.end).getTime() - new Date(gap.start).getTime()) / 1000)
            ),
          };
          return splitGapByDay(base);
        });
        setRawGaps(mapped);
      })
      .catch(() => {
        if (!cancelled) setRawGaps([]);
      })
      .finally(() => {
        if (!cancelled) setGapsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, timeframe]);

  const allGaps = rawGaps ?? [];

  const totalMinutes = useMemo(() => {
    return allGaps.reduce((sum, gap) => sum + Math.round(gap.duration_seconds / 60), 0);
  }, [allGaps]);

  const selectedMinutes = useMemo(() => {
    let sum = 0;
    for (const gap of selected.values()) {
      sum += Math.round(gap.duration_seconds / 60);
    }
    return sum;
  }, [selected]);

  const groups = useMemo(() => {
    const sorted = [...allGaps].sort((a, b) => a.start.getTime() - b.start.getTime());

    const byDay = new Map<string, Gap[]>();

    for (const gap of sorted) {
      const key = gap.start.toDateString();
      const dayGaps = byDay.get(key) ?? [];
      dayGaps.push(gap);
      byDay.set(key, dayGaps);
    }

    return Array.from(byDay.entries()).map(([key, dayGaps]) => ({
      id: key,
      label: formatDay(dayGaps[0].start),
      gaps: dayGaps,
    }));
  }, [allGaps]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close gaps list"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative flex max-h-[75vh] w-full max-w-[560px] flex-col rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl"
          >
            <div className="border-b border-white/10 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-medium text-zinc-100">
                    Gaps
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                    <CalendarClock className="h-4 w-4 text-amber-400/80" />
                    {allGaps.length} gap{allGaps.length === 1 ? "" : "s"} • {formatMinutes(totalMinutes)} unfilled
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {TIMEFRAME_OPTIONS.map((option) => {
                  const active = timeframe === option.key;

                  return (
                    <button
                      key={option.key}
                      onClick={() => setTimeframe(option.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                        active
                          ? "border border-amber-500/30 bg-amber-500/15 text-amber-300"
                          : "border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {gapsLoading && allGaps.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                    <Clock className="h-6 w-6 text-zinc-500" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-zinc-400">
                    Loading gaps…
                  </div>
                </div>
              ) : allGaps.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400/80" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-zinc-300">
                    No gaps in this timeframe
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Every tracked moment is accounted for.
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {groups.map((group) => (
                    <div key={group.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                          {group.label}
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="text-[10px] text-zinc-600">
                          {group.gaps.length} gap{group.gaps.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {group.gaps.map((gap) => {
                          const suggested = suggestGapActivities(gap, sessions, activities, 1)[0];
                          const gapMinutes = Math.round(gap.duration_seconds / 60);

                          return (
                            <motion.div
                              key={gap.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-amber-400/30 hover:bg-white/[0.06]"
                            >
                              {onFillGaps && (
                                <button
                                  onClick={() => toggleGap(gap)}
                                  aria-pressed={selected.has(gap.id)}
                                  aria-label={`Select gap ${formatTime(gap.start)}`}
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                                    selected.has(gap.id)
                                      ? "border-amber-400/50 bg-amber-400/20 text-amber-300"
                                      : "border-white/15 text-transparent hover:border-white/30 hover:bg-white/[0.06]"
                                  }`}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                                <Clock className="h-5 w-5 text-amber-400" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm font-medium text-zinc-100">
                                    {formatTime(gap.start)} — {formatTime(gap.end)}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                                    {formatDay(gap.start)}
                                  </span>
                                </div>

                                {suggested ? (
                                  <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                                    <Sparkles className="h-3 w-3 text-violet-400/70" />
                                    <span>
                                      Try{" "}
                                      <span className="text-zinc-400">{suggested.name}</span>
                                    </span>
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs text-zinc-600">
                                    No activity suggested for this window.
                                  </div>
                                )}
                              </div>

                              <div className="flex shrink-0 items-center gap-3">
                                <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                                  {formatMinutes(gapMinutes)}
                                </span>

                                <button
                                  onClick={() => onPickGap(gap)}
                                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-amber-400"
                                >
                                  Fill
                                </button>

                                {onAssignTime && (
                                  <button
                                    onClick={() => onAssignTime(gap)}
                                    title="Assign manual time into this empty span"
                                    className="rounded-lg border border-violet-400/30 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-400/10"
                                  >
                                    Time
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {onFillGaps && selected.size > 0 && (
              <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-5 py-3">
                <span className="text-xs text-zinc-400">
                  {selected.size} selected • {formatMinutes(selectedMinutes)}
                </span>
                <div className="flex-1" />
                {selected.size < allGaps.length && (
                  <button
                    onClick={() => setSelected(new Map(allGaps.map((g) => [g.id, g])))}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
                  >
                    Select all
                  </button>
                )}
                <button
                  onClick={() => setSelected(new Map())}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
                >
                  Clear
                </button>
                <button
                  onClick={() => onFillGaps(Array.from(selected.values()))}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-medium text-zinc-950 transition hover:bg-amber-400"
                >
                  <Check className="h-3.5 w-3.5" />
                  Fill {selected.size} {selected.size === 1 ? "gap" : "gaps"}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
