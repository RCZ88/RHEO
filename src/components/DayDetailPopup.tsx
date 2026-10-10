/**
 * DayDetailPopup — the forensic read of ONE day, reached from the heatmap.
 *
 * DESIGN INTENT (agent/skills/paint/SKILL.md §0.3)
 *   Idea: a day is a NARRATIVE, and this page reads top-to-bottom in that order —
 *   the headline verdict (how much of the day went to productive work), then the
 *   SHAPE of the day (rhythm), then the EVIDENCE (who and what). Five charts used
 *   to sit in an undifferentiated 2×2 pile with no hierarchy; now each answers one
 *   question and the order is the argument.
 *
 *   Every chart is kept — they were good — but they are unified into one language:
 *   monochrome zinc surfaces, ONE hairline system, and tier colours used ONLY where
 *   they carry meaning. No raw hex, no emoji, no backdrop-blur on chrome (LAMINAR §7).
 *
 * BUGS FIXED HERE (all were live, none were cosmetic):
 *   1. The `day | week | month` toggle set `period` and NEVER READ IT. 100% dead
 *      control — every mode rendered identical day-only content. Removed.
 *   2. `focusPercent = (external + app + browser) / total`. The caller never emits
 *      `log`-category items, so the numerator equalled the total and the "Focus"
 *      stat read a flat 100% on every day that had any data. Now computed from real
 *      per-item tiers.
 *   3. `new Date('YYYY-MM-DD')` is UTC midnight per spec, and prev/next used
 *      `toISOString()`, so in any timezone east of UTC every date step landed one
 *      day early. Now uses src/lib/localDate.ts throughout.
 *   4. Hourly and time-block totals added an item's FULL duration to every bucket
 *      its start-hour touched, so a 90-minute log inflated three hourly bars by
 *      90m each. Items are now split at hour boundaries.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  Monitor,
  Timer,
  Sparkles,
  Flame,
  Trophy,
  CalendarDays,
  ArrowLeft,
} from 'lucide-react';
import { humanDuration, percent, formatHourLabel } from '../lib/duration';
import { formatLocalDateKey, parseLocalDateKey, addDaysLocal } from '../lib/localDate';

export interface DayTimelineItem {
  id: string;
  startHour: number;
  endHour: number;
  label: string;
  category: 'external' | 'app' | 'browser' | 'log';
  color: string;
  duration: number;
  details?: string;
  /** raw `logs.category` or external session type — the input to the tier resolver */
  categoryName?: string;
}

export type Tier = 'productive' | 'neutral' | 'distracting';

const DEFAULT_TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other', 'Browser'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming'],
};

export interface DayDetailPopupProps {
  /** `YYYY-MM-DD`, interpreted as a LOCAL day */
  date: string;
  items: DayTimelineItem[];
  onClose: () => void;
  onDateChange?: (date: string) => void;
  /** resolves a raw category name to a tier; falls back to the defaults above */
  getTier?: (categoryName?: string) => Tier;
  isLoading?: boolean;
}

const TIER_TOKEN: Record<Tier, string> = {
  productive: 'var(--tier-productive)',
  neutral: 'var(--tier-neutral)',
  distracting: 'var(--tier-distracting)',
};
const TIER_LABEL: Record<Tier, string> = {
  productive: 'Productive',
  neutral: 'Neutral',
  distracting: 'Distracting',
};
const EXTERNAL_TOKEN = 'var(--info)';

const TIME_BLOCKS = [
  { label: 'Night', start: 0, end: 6 },
  { label: 'Morning', start: 6, end: 12 },
  { label: 'Afternoon', start: 12, end: 18 },
  { label: 'Evening', start: 18, end: 24 },
] as const;

/* ─────────────────────────── hour-accurate splitting ─────────────────────────── */

interface Slice {
  hour: number;
  seconds: number;
}

/**
 * Split a timeline item into per-HOUR slices of its REAL duration.
 *
 * The old code tested only whether an item *overlapped* an hour and then added its
 * entire duration, so a 09:30→11:00 log was counted as 90 minutes in hour 9, 90 in
 * hour 10 AND 90 in hour 11 — inflating the hourly chart by up to 3×.
 */
function sliceIntoHours(startHour: number, durationSeconds: number): Slice[] {
  const out: Slice[] = [];
  let remaining = Math.max(0, durationSeconds);
  let cursor = Math.max(0, startHour);
  let guard = 0;
  while (remaining > 0.5 && cursor < 24 && guard++ < 48) {
    const hour = Math.min(23, Math.floor(cursor));
    const hourEnd = hour + 1;
    const available = (hourEnd - cursor) * 3600;
    const take = Math.min(remaining, available);
    out.push({ hour, seconds: take });
    remaining -= take;
    cursor = hourEnd;
  }
  return out;
}

/* ─────────────────────────────── component ─────────────────────────────── */

export function DayDetailPopup({
  date,
  items,
  onClose,
  onDateChange,
  getTier,
  isLoading = false,
}: DayDetailPopupProps) {
  const reduce = useReducedMotion();
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const tierOf = useCallback(
    (item: DayTimelineItem): Tier => {
      if (item.category === 'external') return 'productive';
      if (getTier) return getTier(item.categoryName);
      const c = item.categoryName;
      if (!c) return 'neutral';
      if (DEFAULT_TIER_ASSIGNMENTS.productive.includes(c)) return 'productive';
      if (DEFAULT_TIER_ASSIGNMENTS.distracting.includes(c)) return 'distracting';
      return 'neutral';
    },
    [getTier],
  );

  const dateObj = useMemo(() => parseLocalDateKey(date), [date]);
  const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
  const dateStr = dateObj.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const isToday = formatLocalDateKey(new Date()) === date;
  const isFuture = dateObj.getTime() > new Date().setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const byTier: Record<Tier, number> = { productive: 0, neutral: 0, distracting: 0 };
    let external = 0;
    let tracked = 0;
    for (const item of items) {
      if (item.category === 'external') {
        external += item.duration;
        continue;
      }
      tracked += item.duration;
      byTier[tierOf(item)] += item.duration;
    }
    const total = tracked + external;
    const productiveAll = byTier.productive + external;
    return {
      byTier,
      external,
      tracked,
      total,
      // REAL ratio now — external is counted as intentional, non-device time
      productiveShare: total > 0 ? productiveAll / total : 0,
    };
  }, [items, tierOf]);

  /** Per-hour, hour-accurate, split by tier + external. */
  const hourly = useMemo(() => {
    const rows = Array.from({ length: 24 }, () => ({
      hour: 0,
      productive: 0,
      neutral: 0,
      distracting: 0,
      external: 0,
      total: 0,
    }));
    rows.forEach((r, h) => (r.hour = h));
    for (const item of items) {
      const bucket = item.category === 'external' ? 'external' : tierOf(item);
      for (const slice of sliceIntoHours(item.startHour, item.duration)) {
        rows[slice.hour][bucket] += slice.seconds;
        rows[slice.hour].total += slice.seconds;
      }
    }
    return rows;
  }, [items, tierOf]);

  const hourlyMax = hourly.reduce((m, r) => Math.max(m, r.total), 0);

  const peakHour = useMemo(() => {
    let best = -1;
    let bestVal = 0;
    hourly.forEach(r => {
      if (r.total > bestVal) {
        bestVal = r.total;
        best = r.hour;
      }
    });
    return { hour: best, seconds: bestVal };
  }, [hourly]);

  const timeBlocks = useMemo(
    () =>
      TIME_BLOCKS.map(block => {
        const rows = hourly.slice(block.start, block.end);
        const sums = rows.reduce(
          (acc, r) => {
            acc.productive += r.productive;
            acc.neutral += r.neutral;
            acc.distracting += r.distracting;
            acc.external += r.external;
            acc.total += r.total;
            return acc;
          },
          { productive: 0, neutral: 0, distracting: 0, external: 0, total: 0 },
        );
        const active = rows.filter(r => r.total > 0);
        const peak = active.length
          ? active.reduce((m, r) => (r.total > m.total ? r : m), active[0])
          : null;
        return { ...block, ...sums, peakHour: peak?.hour ?? null, peakSeconds: peak?.total ?? 0 };
      }),
    [hourly],
  );

  /** Ranked usage — the "what did I actually do" list. */
  const topUsage = useMemo(() => {
    const map = new Map<string, { seconds: number; tier: Tier | 'external'; segments: number }>();
    for (const item of items) {
      if (item.duration <= 0) continue;
      const key = item.label || 'Unknown';
      const tier = item.category === 'external' ? 'external' : tierOf(item);
      const prev = map.get(key);
      if (prev) {
        prev.seconds += item.duration;
        prev.segments += 1;
      } else {
        map.set(key, { seconds: item.duration, tier, segments: 1 });
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 10);
  }, [items, tierOf]);

  const topApp = topUsage.find(u => u.tier !== 'external') ?? topUsage[0];
  const donutTotal = stats.byTier.productive + stats.byTier.neutral + stats.byTier.distracting + stats.external;

  const handlePrevDay = () => onDateChange?.(formatLocalDateKey(addDaysLocal(dateObj, -1)));
  const handleNextDay = () => {
    if (isFuture) return;
    onDateChange?.(formatLocalDateKey(addDaysLocal(dateObj, 1)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevDay();
      } else if (e.key === 'ArrowRight' && !isFuture) {
        e.preventDefault();
        handleNextDay();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const tiles = [
    {
      id: 'total',
      label: 'Tracked',
      value: humanDuration(stats.total),
      sub: stats.total > 0 ? `${items.length} segments` : 'nothing recorded',
      color: 'var(--text-primary)',
      Icon: Clock,
    },
    {
      id: 'productive',
      label: 'Productive',
      value: `${percent(stats.productiveShare)}%`,
      sub: humanDuration(stats.byTier.productive + stats.external),
      color: TIER_TOKEN.productive,
      Icon: Sparkles,
    },
    {
      id: 'top',
      label: 'Top app',
      value: topApp ? topApp.name : '—',
      sub: topApp ? humanDuration(topApp.seconds) : 'no data',
      color: 'var(--page-accent)',
      Icon: Trophy,
    },
    {
      id: 'peak',
      label: 'Peak hour',
      value: peakHour.hour >= 0 ? formatHourLabel(peakHour.hour) : '—',
      sub: peakHour.hour >= 0 ? humanDuration(peakHour.seconds) : 'no data',
      color: 'var(--text-primary)',
      Icon: Flame,
    },
    {
      id: 'external',
      label: 'External',
      value: humanDuration(stats.external),
      sub: stats.total > 0 ? `${percent(stats.external / stats.total)}% of day` : 'none',
      color: EXTERNAL_TOKEN,
      Icon: Timer,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.15 }}
      className="fixed inset-0 z-[70] flex flex-col bg-[var(--bg-primary)]"
    >
      {/* ── header ── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--ws-border)] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to heatmap
          </button>
          <div className="h-5 w-px bg-[var(--ws-border)]" />
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevDay}
              aria-label="Previous day"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[170px] px-1 text-center">
              <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {dayName}
                {isToday && (
                  <span
                    className="ml-1.5 align-middle text-[9px] font-medium uppercase tracking-wider"
                    style={{ color: 'var(--page-accent)' }}
                  >
                    today
                  </span>
                )}
              </h2>
              <p className="truncate text-[11px] text-[var(--text-muted)]">{dateStr}</p>
            </div>
            <button
              onClick={handleNextDay}
              disabled={isFuture}
              aria-label="Next day"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[10px] text-[var(--text-muted)] sm:flex">
            <CalendarDays className="h-3 w-3" />
            ← → to step days
          </span>
          <button
            onClick={onClose}
            aria-label="Close day detail"
            className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {isLoading ? (
          <DaySkeleton />
        ) : items.length === 0 ? (
          <EmptyDay dateStr={dateStr} onPrev={handlePrevDay} />
        ) : (
          <div className="mx-auto max-w-6xl space-y-4">
            {/* ── the verdict ── */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {tiles.map(t => (
                <div
                  key={t.id}
                  className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-secondary)] px-3 py-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <t.Icon className="h-3 w-3 shrink-0" style={{ color: t.color }} />
                    <span className="truncate text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      {t.label}
                    </span>
                  </div>
                  <div
                    className="mt-1 truncate font-mono text-lg font-semibold leading-tight tabular-nums"
                    style={{ color: t.color }}
                    title={t.value}
                  >
                    {t.value}
                  </div>
                  <div className="truncate text-[10px] text-[var(--text-muted)]">{t.sub}</div>
                </div>
              ))}
            </div>

            {/* ── the shape: hour-by-hour, stacked by tier ── */}
            <Panel title="Hour by hour" hint="Split at hour boundaries — a 90-minute session is not counted three times.">
              <HourlyStackedBars rows={hourly} max={hourlyMax} />
            </Panel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Where the time went" hint="Productive work versus everything else.">
                <TierDonut
                  values={{
                    productive: stats.byTier.productive,
                    neutral: stats.byTier.neutral,
                    distracting: stats.byTier.distracting,
                    external: stats.external,
                  }}
                  total={donutTotal}
                />
              </Panel>

              <Panel title="Time of day" hint="Each block totals only the minutes actually inside it.">
                <TimeOfDay rows={timeBlocks} expanded={expandedBlock} onToggle={setExpandedBlock} hourly={hourly} />
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Daily rhythm" hint="Distance from centre is minutes tracked in that hour.">
                <RhythmChart rows={hourly} />
              </Panel>

              <Panel title="Top usage" hint="Every app, site and external session, ranked.">
                <UsageRanking rows={topUsage} total={stats.total} />
              </Panel>
            </div>

            <Panel title="Activity timeline" hint="Device, browser and external tracks against the clock.">
              <DayTimeline items={items} />
            </Panel>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────── panels ─────────────────────────────── */

function Panel({
  title,
  hint,
  children,
  className = '',
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[var(--ws-border)] bg-[var(--bg-secondary)] ${className}`}>
      <div className="border-b border-[var(--ws-border)] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ─────────────────────────────── charts ─────────────────────────────── */

function HourlyStackedBars({
  rows,
  max,
}: {
  rows: Array<{ hour: number; productive: number; neutral: number; distracting: number; external: number; total: number }>;
  max: number;
}) {
  const keys = ['productive', 'neutral', 'distracting', 'external'] as const;
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {rows.map(r => (
          <div key={r.hour} className="group relative flex flex-1 flex-col justify-end gap-px" style={{ height: '100%' }}>
            <div
              className="flex w-full flex-col-reverse justify-end overflow-hidden rounded-[2px] transition-[filter] duration-150 group-hover:brightness-125"
              style={{
                height: max > 0 ? `${Math.max(2, (r.total / max) * 100)}%` : '2px',
                opacity: r.total > 0 ? 1 : 0.35,
              }}
            >
              {keys
                .filter(k => r[k] > 0)
                .map(k => (
                  <div
                    key={k}
                    style={{
                      height: `${(r[k] / r.total) * 100}%`,
                      backgroundColor: k === 'external' ? EXTERNAL_TOKEN : TIER_TOKEN[k],
                    }}
                  />
                ))}
            </div>
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--ws-border-strong)] bg-[var(--bg-primary)] px-2 py-1 text-[10px] text-[var(--text-primary)] shadow-lg group-hover:block">
              {formatHourLabel(r.hour)} · {humanDuration(r.total)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] text-[var(--text-disabled)]">
        {['12am', '6am', '12pm', '6pm', '11pm'].map(l => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1">
        {keys.map(k => (
          <div key={k} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span
              aria-hidden
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: k === 'external' ? EXTERNAL_TOKEN : TIER_TOKEN[k] }}
            />
            {k === 'external' ? 'External' : TIER_LABEL[k]}
          </div>
        ))}
      </div>
    </div>
  );
}

function TierDonut({
  values,
  total,
}: {
  values: { productive: number; neutral: number; distracting: number; external: number };
  total: number;
}) {
  const reduce = useReducedMotion();
  const size = 132;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const segments = (
    [
      { key: 'productive', v: values.productive, color: TIER_TOKEN.productive },
      { key: 'neutral', v: values.neutral, color: TIER_TOKEN.neutral },
      { key: 'distracting', v: values.distracting, color: TIER_TOKEN.distracting },
      { key: 'external', v: values.external, color: EXTERNAL_TOKEN },
    ] as const
  ).filter(s => s.v > 0);

  let acc = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative shrink-0">
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Tier breakdown">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-primary)" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const frac = total > 0 ? s.v / total : 0;
            const dash = frac * circumference;
            const offset = -acc * circumference;
            acc += frac;
            return (
              <motion.circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : i * 0.06 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-semibold tabular-nums text-[var(--text-primary)]">
            {humanDuration(total)}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">total</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {segments.length === 0 && (
          <p className="text-[11px] text-[var(--text-muted)]">No time recorded.</p>
        )}
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-secondary)]">
              {s.key === 'external' ? 'External' : TIER_LABEL[s.key]}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
              {percent(total > 0 ? s.v / total : 0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeOfDay({
  rows,
  expanded,
  onToggle,
  hourly,
}: {
  rows: Array<{
    label: string;
    start: number;
    end: number;
    productive: number;
    neutral: number;
    distracting: number;
    external: number;
    total: number;
    peakHour: number | null;
    peakSeconds: number;
  }>;
  expanded: string | null;
  onToggle: (label: string) => void;
  hourly: Array<{ hour: number; total: number }>;
}) {
  const keys = ['productive', 'neutral', 'distracting', 'external'] as const;
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);

  return (
    <div className="space-y-1.5">
      {rows.map(row => {
        const open = expanded === row.label;
        return (
          <div key={row.label} className="overflow-hidden rounded-lg border border-[var(--ws-border)]">
            <button
              onClick={() => onToggle(open ? null as unknown as string : row.label)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
            >
              <span className="w-20 shrink-0 text-[11px] font-medium text-[var(--text-primary)]">{row.label}</span>
              <span className="hidden w-24 shrink-0 font-mono text-[10px] text-[var(--text-muted)] sm:block">
                {formatHourLabel(row.start)}–{formatHourLabel(row.end === 24 ? 23 : row.end)}
              </span>
              <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                {keys
                  .filter(k => row[k] > 0)
                  .map(k => (
                    <span
                      key={k}
                      style={{
                        width: `${max > 0 ? (row[k] / max) * 100 : 0}%`,
                        backgroundColor: k === 'external' ? EXTERNAL_TOKEN : TIER_TOKEN[k],
                      }}
                    />
                  ))}
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                {humanDuration(row.total)}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-t border-[var(--ws-border)]"
                >
                  <div className="space-y-0.5 px-3 py-2">
                    {row.peakHour === null ? (
                      <p className="py-1 text-[10px] italic text-[var(--text-muted)]">
                        Nothing recorded in this block.
                      </p>
                    ) : (
                      hourly.slice(row.start, row.end).map(h => (
                        <div key={h.hour} className="flex items-center gap-2">
                          <span className="w-12 shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                            {formatHourLabel(h.hour)}
                          </span>
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${row.peakSeconds > 0 ? (h.total / row.peakSeconds) * 100 : 0}%`,
                                backgroundColor: h.total > 0 ? 'var(--page-accent)' : 'transparent',
                              }}
                            />
                          </span>
                          <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                            {humanDuration(h.total)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function RhythmChart({ rows }: { rows: Array<{ hour: number; total: number }> }) {
  const size = 190;
  const c = size / 2;
  const maxR = size / 2 - 22;
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);

  if (max <= 0) {
    return <p className="py-8 text-center text-[11px] text-[var(--text-muted)]">No time recorded.</p>;
  }

  const points = rows.map(r => {
    const angle = (r.hour / 24) * Math.PI * 2 - Math.PI / 2;
    const radius = Math.max(r.total > 0 ? 3 : 0, (r.total / max) * maxR);
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle), total: r.total, hour: r.hour };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <svg width={size} height={size} role="img" aria-label="Activity rhythm across 24 hours" className="shrink-0">
        {rings.map(f => (
          <circle
            key={f}
            cx={c}
            cy={c}
            r={maxR * f}
            fill="none"
            stroke="var(--ws-border)"
            strokeWidth={1}
          />
        ))}
        {[0, 6, 12, 18].map(h => {
          const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={h}
              x1={c}
              y1={c}
              x2={c + maxR * Math.cos(angle)}
              y2={c + maxR * Math.sin(angle)}
              stroke="var(--ws-border)"
              strokeWidth={1}
            />
          );
        })}
        <path d={path} fill="var(--tier-productive-muted)" stroke="var(--tier-productive)" strokeWidth={1.5} />
        {points.map(p =>
          p.total > 0 ? (
            <circle
              key={p.hour}
              cx={p.x}
              cy={p.y}
              r={2}
              fill="var(--tier-productive)"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          ) : null,
        )}
        {[0, 6, 12, 18].map(h => {
          const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
          const lr = maxR + 13;
          return (
            <text
              key={h}
              x={c + lr * Math.cos(angle)}
              y={c + lr * Math.sin(angle)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={9}
            >
              {formatHourLabel(h)}
            </text>
          );
        })}
      </svg>
      <p className="max-w-[150px] text-[10px] leading-relaxed text-[var(--text-muted)] sm:max-w-none">
        Hours run clockwise from midnight. A spike means an hour you actually sat down for; the gap
        opposite it is the honest answer about the rest of the day.
      </p>
    </div>
  );
}

function UsageRanking({
  rows,
  total,
}: {
  rows: Array<{ name: string; seconds: number; tier: Tier | 'external'; segments: number }>;
  total: number;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-[11px] text-[var(--text-muted)]">No usage recorded.</p>;
  }
  const max = rows[0].seconds;
  return (
    <div className="space-y-1.5">
      {rows.map(r => {
        const color = r.tier === 'external' ? EXTERNAL_TOKEN : TIER_TOKEN[r.tier];
        return (
          <div key={r.name} className="group">
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-secondary)]" title={r.name}>
                {r.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                {r.segments > 1 ? `${r.segments}× · ` : ''}
                {percent(total > 0 ? r.seconds / total : 0)}%
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
                {humanDuration(r.seconds)}
              </span>
            </div>
            <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-[var(--bg-primary)]">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${max > 0 ? (r.seconds / max) * 100 : 0}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────── timeline ─────────────────────────────── */

const TRACKS = [
  { key: 'app', label: 'Apps', color: 'var(--tier-neutral)', cat: 'app' },
  { key: 'browser', label: 'Browser', color: 'var(--tier-productive)', cat: 'browser' },
  { key: 'external', label: 'External', color: 'var(--info)', cat: 'external' },
] as const;

function DayTimeline({ items }: { items: DayTimelineItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, DayTimelineItem[]> = { app: [], browser: [], external: [] };
    for (const i of items) {
      if (map[i.category]) map[i.category].push(i);
      else map.app.push(i);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.startHour - b.startHour);
    }
    return map;
  }, [items]);

  const startHour = 0;
  const span = 24;
  const pct = (h: number) => Math.max(0, Math.min(100, ((h - startHour) / span) * 100));

  return (
    <div className="space-y-3">
      <div className="flex justify-between font-mono text-[9px] text-[var(--text-disabled)]">
        {['12am', '4am', '8am', '12pm', '4pm', '8pm', '11pm'].map(l => (
          <span key={l}>{l}</span>
        ))}
      </div>

      {TRACKS.map(track => {
        const rows = grouped[track.key] ?? [];
        const total = rows.reduce((s, r) => s + r.duration, 0);
        if (rows.length === 0) return null;
        const isOpen = expanded === track.key;

        return (
          <div key={track.key}>
            <button
              onClick={() => setExpanded(isOpen ? null : track.key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-[var(--bg-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
            >
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: track.color }} />
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">{track.label}</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">({rows.length})</span>
              <span className="flex-1" />
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
                {humanDuration(total)}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div className="relative mt-1 h-9 rounded bg-[var(--bg-primary)]">
              {rows.map((r, i) => {
                const left = pct(r.startHour);
                const width = Math.max(0.6, pct(r.endHour) - left);
                return (
                  <div
                    key={r.id}
                    title={`${r.label} · ${formatHourLabel(r.startHour)}–${formatHourLabel(r.endHour)} · ${humanDuration(r.duration)}`}
                    className="group absolute top-1 h-7 overflow-hidden rounded-[3px] transition-[filter] duration-150 hover:brightness-125"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: track.color,
                      opacity: 0.34 + (i % 3) * 0.1,
                      zIndex: 1,
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-[2px]"
                      style={{ backgroundColor: track.color }}
                    />
                    {width > 6 && (
                      <span className="block truncate px-1.5 py-1 text-[9px] leading-tight text-[var(--text-primary)]">
                        {r.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-[var(--ws-border)]"
                >
                  {rows.map(r => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 border-b border-[var(--ws-border)] px-2.5 py-1.5 last:border-0"
                      style={{ borderLeft: `2px solid ${track.color}` }}
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-secondary)]">
                        {r.label}
                        {r.details && (
                          <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">· {r.details}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                        {formatHourLabel(r.startHour)}–{formatHourLabel(Math.min(r.endHour, 23.99))}
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
                        {humanDuration(r.duration)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────── states ─────────────────────────────── */

function EmptyDay({ dateStr, onPrev }: { dateStr: string; onPrev: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-[var(--ws-border)] bg-[var(--bg-secondary)] px-6 py-10 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--ws-border)] bg-[var(--bg-primary)]">
        <Monitor className="h-5 w-5 text-[var(--text-muted)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Nothing tracked on {dateStr}</h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
        There are no app, browser or external sessions recorded for this day. Tracking resumes
        automatically whenever the app is running and the tracker sees foreground activity.
      </p>
      <button
        onClick={onPrev}
        className="mt-5 flex items-center gap-1.5 rounded-lg border border-[var(--ws-border-strong)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Check the previous day
      </button>
    </div>
  );
}

function DaySkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true" aria-label="Loading day detail">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-[68px] animate-pulse rounded-lg bg-[var(--bg-secondary)]" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-secondary)]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-[var(--bg-secondary)]" />
        <div className="h-56 animate-pulse rounded-xl bg-[var(--bg-secondary)]" />
      </div>
    </div>
  );
}

/* ─────────────────────────── legacy adapters ───────────────────────────
   These two exports are consumed elsewhere in the app. They keep working, but
   note they do NOT carry `categoryName`, so a caller using them will get the
   default tier fallback. Prefer passing real logs to `DayDetailPopup`. */

export function sessionsToTimelineItems(
  externalSessions: any[],
  appSessions: any[],
  browserSessions: any[],
  logs: any[] = [],
): DayTimelineItem[] {
  const items: DayTimelineItem[] = [];

  externalSessions.forEach((session: any) => {
    const start = new Date(session.started_at);
    const end = session.ended_at ? new Date(session.ended_at) : new Date();
    items.push({
      id: `ext-${session.id}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: Math.min(end.getHours() + end.getMinutes() / 60, 24),
      label: session.activity_name || session.name,
      category: 'external',
      color: 'var(--info)',
      duration: session.duration_seconds || Math.round((end.getTime() - start.getTime()) / 1000),
      categoryName: session.type,
    });
  });

  appSessions.forEach((session: any) => {
    const start = new Date(session.start_time);
    const end = session.end_time ? new Date(session.end_time) : new Date();
    items.push({
      id: `app-${session.id ?? Math.random()}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: Math.min(end.getHours() + end.getMinutes() / 60, 24),
      label: session.app,
      category: 'app',
      color: 'var(--tier-neutral)',
      duration: session.duration_sec ?? Math.floor((end.getTime() - start.getTime()) / 1000),
      details: session.domain || session.title,
      categoryName: session.category,
    });
  });

  browserSessions.forEach((session: any) => {
    const end = session.end_time ? new Date(session.end_time) : new Date();
    const start = session.start_time
      ? new Date(session.start_time)
      : new Date(end.getTime() - (session.total_sec || 0) * 1000);
    items.push({
      id: `browser-${session.id ?? Math.random()}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: Math.min(end.getHours() + end.getMinutes() / 60, 24),
      label: session.domain || session.app,
      category: 'browser',
      color: 'var(--tier-productive)',
      duration: session.total_sec || 0,
      categoryName: session.category,
    });
  });

  logs.forEach((log: any) => {
    const start = new Date(log.timestamp);
    const durationSec = Math.floor((log.duration_ms || 0) / 1000);
    if (durationSec <= 0) return;
    items.push({
      id: `log-${log.id ?? Math.random()}`,
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour: Math.min(start.getHours() + start.getMinutes() / 60 + durationSec / 3600, 24),
      label: log.app,
      category: 'log',
      color: 'var(--tier-neutral)',
      duration: durationSec,
      details: log.title || log.domain,
      categoryName: log.category,
    });
  });

  return items.sort((a, b) => a.startHour - b.startHour);
}

export function logsToTimelineItems(logs: any[]): DayTimelineItem[] {
  return sessionsToTimelineItems([], [], [], logs);
}
