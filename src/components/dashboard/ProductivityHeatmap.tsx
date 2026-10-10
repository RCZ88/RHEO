/**
 * ProductivityHeatmap — the dashboard's 7×24 time surface.
 *
 * DESIGN INTENT (see agent/skills/paint/SKILL.md §0.3)
 *   Idea: "the heatmap is a wall, not a card." A dense instrument panel that reads
 *   as one fixed architectural surface — which is why every cell is separated by a
 *   real hairline instead of floating in a gap. 168 loose squares are noise; 168
 *   squares inside a grid are a chart.
 *
 *   Channel discipline (this is the load-bearing decision):
 *     HUE   = tier        "was it worth it"   (productive / neutral / distracting)
 *     ALPHA = volume      "how much of it"    (quantised into 5 readable buckets)
 *   Conflating the two, or letting hue vary continuously, is what makes most
 *   heatmaps unreadable. Two orthogonal channels, one glance.
 *
 *   LAMINAR §2: the tier ramp is SEMANTIC data-viz (allowed as distinct from a
 *   surface hue). The only chrome accent is --page-accent (dashboard pink). No
 *   decorative gradients, no spring, no emoji, no raw hex — every colour is a
 *   token reference or a color-mix() built from tokens.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  X,
  Monitor,
  Timer,
  Layers,
  MousePointerClick,
  CalendarX,
} from 'lucide-react';
import { humanDuration } from '../../lib/duration';

/* ─────────────────────────────── types ─────────────────────────────── */

export interface HeatmapBreakdownEntry {
  seconds: number;
  category?: string;
  color?: string;
  icon?: string;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  /** @deprecated kept for callers that still read it; `deviceSeconds` is authoritative */
  value: number;
  /** 0..1 share of tracked time spent in productive-tier apps. NaN-safe: 0 when empty. */
  productivity: number;
  deviceSeconds: number;
  externalSeconds: number;
  /** app (or domain) -> seconds. Sorted for display by the component. */
  deviceBreakdown: Record<string, HeatmapBreakdownEntry>;
  /** external activity name -> seconds */
  externalBreakdown: Record<string, HeatmapBreakdownEntry>;
  /** count of distinct apps/sites seen this hour */
  appCount: number;
  /** count of raw log rows folded into this cell */
  segmentCount: number;
}

export type HeatmapMode = 'device' | 'external' | 'combined';

export interface ProductivityHeatmapProps {
  open: boolean;
  onClose: () => void;
  cells: HeatmapCell[];
  /** which week is loaded, 0 = current */
  weekOffset: number;
  /** called with the new offset; clamped by the caller or here via maxFutureWeeks */
  onWeekOffsetChange: (next: number) => void;
  weekLabel: string;
  mode: HeatmapMode;
  onModeChange: (mode: HeatmapMode) => void;
  /** opens the day-detail page for this day-of-week index in the loaded week */
  onDayClick: (dayIndex: number) => void;
  /** app name -> colour, from the dashboard's existing appColors map */
  getAppColor?: (app: string) => string | undefined;
  isLoading?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/* ─────────────────────────────── helpers ─────────────────────────────── */

/** Five-step quantisation. Continuous alpha on a 168-cell grid reads as noise. */
const BUCKETS = [22, 36, 52, 70, 88] as const;

function bucketAlpha(seconds: number, ceiling: number): number {
  if (seconds <= 0) return 0;
  const t = Math.min(1, seconds / ceiling);
  return BUCKETS[Math.min(BUCKETS.length - 1, Math.floor(t * BUCKETS.length))];
}

type Tier = 'empty' | 'productive' | 'neutral' | 'distracting' | 'external';

/** Which recording channel actually produced data for a cell. */
type Source = 'none' | 'device' | 'external';

const TIER_TOKEN: Record<Tier, string> = {
  empty: 'var(--bg-secondary)',
  productive: 'var(--tier-productive)',
  neutral: 'var(--tier-neutral)',
  distracting: 'var(--tier-distracting)',
  external: 'var(--info)',
};

/** Opaque cell colour, mixed from tokens only — never a raw hex or rgba. */
function cellColor(tier: Tier, alpha: number): string {
  if (tier === 'empty' || alpha === 0) return 'var(--bg-secondary)';
  return `color-mix(in srgb, ${TIER_TOKEN[tier]} ${alpha}%, var(--bg-secondary))`;
}

/**
 * Resolve WHICH SOURCE a cell is drawing from. Deliberately does NOT return a
 * tier: hue comes from the productivity band and alpha comes from volume, and
 * conflating the two in one return value is how the original ramp collapsed.
 */
function resolveSource(cell: HeatmapCell | undefined, mode: HeatmapMode) {
  const device = cell?.deviceSeconds ?? 0;
  const external = cell?.externalSeconds ?? 0;

  if (mode === 'device') {
    return { source: (device > 0 ? 'device' : 'none') as Source, seconds: device, ceiling: 3600 };
  }
  if (mode === 'external') {
    return { source: (external > 0 ? 'external' : 'none') as Source, seconds: external, ceiling: 1800 };
  }
  // combined — the channel with actual data wins; device takes precedence so a
  // cell with both reads as tracked time (external is still reported separately)
  if (device > 0) return { source: 'device' as Source, seconds: device, ceiling: 3600 };
  if (external > 0) return { source: 'external' as Source, seconds: external, ceiling: 3600 };
  return { source: 'none' as Source, seconds: 0, ceiling: 3600 };
}

function topEntries(
  breakdown: Record<string, HeatmapBreakdownEntry> | undefined,
  limit = 4,
): Array<[string, HeatmapBreakdownEntry]> {
  if (!breakdown) return [];
  return Object.entries(breakdown)
    .filter(([, v]) => (v?.seconds ?? 0) > 0)
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, limit);
}

/* ─────────────────────────────── component ─────────────────────────────── */

export function ProductivityHeatmap({
  open,
  onClose,
  cells,
  weekOffset,
  onWeekOffsetChange,
  weekLabel,
  mode,
  onModeChange,
  onDayClick,
  getAppColor,
  isLoading = false,
}: ProductivityHeatmapProps) {
  const reduce = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ day: number; hour: number; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<{ day: number; hour: number } | null>(null);

  // A new week invalidates every selection — never leave a rail describing last week.
  useEffect(() => {
    setSelected(null);
    setHovered(null);
  }, [weekOffset]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setHovered(null);
    }
  }, [open]);

  // Escape closes; arrows page weeks while the surface has focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onWeekOffsetChange(weekOffset - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (weekOffset < 0) onWeekOffsetChange(weekOffset + 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, weekOffset, onClose, onWeekOffsetChange]);

  const index = useMemo(() => {
    const m = new Map<string, HeatmapCell>();
    for (const c of cells) m.set(`${c.day}-${c.hour}`, c);
    return m;
  }, [cells]);

  const today = useMemo(() => new Date(), []);
  const currentDay = today.getDay();
  const currentHour = today.getHours();
  const isCurrentWeek = weekOffset === 0;

  const hasAnyData = useMemo(
    () => cells.some(c => (c.deviceSeconds ?? 0) > 0 || (c.externalSeconds ?? 0) > 0),
    [cells],
  );

  const weekTotals = useMemo(() => {
    let device = 0;
    let external = 0;
    let productiveSeconds = 0;
    for (const c of cells) {
      device += c.deviceSeconds ?? 0;
      external += c.externalSeconds ?? 0;
      productiveSeconds += (c.productivity ?? 0) * (c.deviceSeconds ?? 0);
    }
    const tracked = device + external;
    return {
      tracked,
      productiveSeconds,
      share: tracked > 0 ? Math.round((productiveSeconds / Math.max(device, 1)) * 100) : 0,
    };
  }, [cells]);

  const selectedCell = selected ? index.get(`${selected.day}-${selected.hour}`) : undefined;

  const trackPointer = useCallback((day: number, hour: number, e: React.MouseEvent) => {
    const host = gridRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    setHovered({ day, hour, x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  if (!open) return null;

  const hoveredCell = hovered ? index.get(`${hovered.day}-${hovered.hour}`) : undefined;
  const hoverResolved = hoveredCell ? resolveSource(hoveredCell, mode) : null;
  const hoverTop = hoveredCell
    ? mode === 'external'
      ? topEntries(hoveredCell.externalBreakdown)
      : topEntries(hoveredCell.deviceBreakdown)
    : [];

  /* ---- empty state: the week has no tracked time at all ---- */
  if (!isLoading && !hasAnyData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-[var(--ws-border-strong)] bg-[var(--bg-primary)] p-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--ws-border)] bg-[var(--bg-secondary)]">
            <CalendarX className="h-5 w-5 text-[var(--text-muted)]" />
          </div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Nothing tracked this week</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">
            The heatmap fills in as the tracker records foreground apps, browser domains and
            external sessions. Pick a previous week, or start tracking to populate this one.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => onWeekOffsetChange(weekOffset - 1)}
              className="rounded-lg border border-[var(--ws-border-strong)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--page-accent)]"
            >
              Try last week
            </button>
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--page-accent)]"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Productivity heatmap"
        initial={{ opacity: 0, y: reduce ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--ws-border-strong)] bg-[var(--bg-primary)]"
      >
        {/* ── header ── */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--ws-border)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ws-border)] bg-[var(--bg-secondary)]">
              <BarChart3 className="h-4 w-4" style={{ color: 'var(--page-accent)' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Productivity Heatmap</h2>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {weekLabel}
                <span className="mx-1.5 text-[var(--text-disabled)]">·</span>
                {humanDuration(weekTotals.tracked)} tracked
                <span className="mx-1.5 text-[var(--text-disabled)]">·</span>
                {weekTotals.share}% productive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* week pager — fully independent of the dashboard's period filter */}
            <div className="flex items-center rounded-lg border border-[var(--ws-border)]">
              <button
                onClick={() => onWeekOffsetChange(weekOffset - 1)}
                aria-label="Previous week"
                title="Previous week (←)"
                className="px-2 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onWeekOffsetChange(0)}
                disabled={isCurrentWeek}
                title="Jump to this week"
                className="min-w-[92px] border-x border-[var(--ws-border)] px-2 py-2 text-center font-mono text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
              >
                {isCurrentWeek ? 'This week' : `${Math.abs(weekOffset)}w ago`}
              </button>
              <button
                onClick={() => onWeekOffsetChange(weekOffset + 1)}
                disabled={weekOffset >= 0}
                aria-label="Next week"
                title="Next week (→)"
                className="px-2 py-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Close heatmap"
              className="ml-1 rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── legend + mode ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--ws-border)] px-4 py-2 sm:px-5">
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            <span className="font-medium uppercase tracking-wider">Volume</span>
            <div className="flex items-center gap-px overflow-hidden rounded border border-[var(--ws-border)]">
              {[0, 22, 36, 52, 70, 88].map((a, i) => (
                <span
                  key={i}
                  className="h-3 w-4 first:rounded-l-sm last:rounded-r-sm"
                  style={{
                    backgroundColor:
                      a === 0 ? 'var(--bg-secondary)' : `color-mix(in srgb, var(--tier-neutral) ${a}%, var(--bg-secondary))`,
                  }}
                />
              ))}
            </div>
            <span className="hidden sm:inline">less → more</span>
          </div>

          <div
            role="radiogroup"
            aria-label="Activity source"
            className="flex items-center gap-0.5 rounded-lg border border-[var(--ws-border)] bg-[var(--bg-secondary)] p-0.5"
          >
            {([
              { id: 'device', label: 'Tracked', Icon: Monitor },
              { id: 'external', label: 'External', Icon: Timer },
              { id: 'combined', label: 'Both', Icon: Layers },
            ] as const).map(({ id, label, Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onModeChange(id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-[var(--page-accent)] ${
                    active
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--ws-border-strong)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── grid (scrolls internally; the rail below never leaves the viewport) ── */}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
          {isLoading ? (
            <div className="min-w-[560px]" aria-busy="true" aria-label="Loading week">
              <div className="grid grid-cols-7 gap-px pb-px">
                <div className="pr-2" />
                {DAYS.map(d => (
                  <div key={d} className="py-1.5 text-center text-[11px] text-[var(--text-disabled)]">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-[var(--ws-border)]">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="contents">
                    <div className="flex items-center justify-end bg-[var(--bg-primary)] pr-1.5 font-mono text-[9px] text-[var(--text-disabled)]" style={{ height: 22 }}>
                      {hour.toString().padStart(2, '0')}
                    </div>
                    {DAYS.map(d => (
                      <div
                        key={d}
                        className="animate-pulse bg-[var(--bg-secondary)]"
                        style={{ height: 22, animationDelay: `${(hour * 7) % 14}00ms` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div className="min-w-[560px]">
            {/* day header row — also the "open this day" control */}
            <div className="grid grid-cols-7 gap-px pb-px">
              <div className="pr-2" />
              {DAYS.map((d, i) => {
                const isToday = isCurrentWeek && i === currentDay;
                return (
                  <button
                    key={d}
                    onClick={() => onDayClick(i)}
                    title={`Open ${DAY_LONG[i]} detail`}
                    className={`rounded px-1 py-1.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)] ${
                      isToday ? 'text-[var(--page-accent)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    <span className="block">{d}</span>
                    {isToday && <span className="block text-[9px] font-normal opacity-70">today</span>}
                  </button>
                );
              })}
            </div>

            {/* THE WALL — gap-px over a hairline background = a real grid, outer edge included */}
            <div
              ref={gridRef}
              onMouseLeave={() => setHovered(null)}
              className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-[var(--ws-border)]"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="contents">
                  <div
                    className="flex items-center justify-end bg-[var(--bg-primary)] pr-1.5 font-mono text-[9px] tabular-nums text-[var(--text-disabled)]"
                    style={{ height: 22 }}
                  >
                    {hour.toString().padStart(2, '0')}
                  </div>
                  {DAYS.map((_, day) => {
                    const cell = index.get(`${day}-${hour}`);
                    const { source, seconds, ceiling } = resolveSource(cell, mode);
                    const alpha = bucketAlpha(seconds, ceiling);
                    const isSelected = selected?.day === day && selected?.hour === hour;
                    const isTodayHour = isCurrentWeek && day === currentDay && hour === currentHour;

                    return (
                      <button
                        key={day}
                        type="button"
                        aria-label={`${DAY_LONG[day]} ${hour.toString().padStart(2, '0')}:00 — ${
                          seconds > 0 ? humanDuration(seconds) : 'no activity'
                        }`}
                        aria-pressed={isSelected}
                        onMouseEnter={e => trackPointer(day, hour, e)}
                        onFocus={e => {
                          const host = gridRef.current;
                          if (!host) return;
                          const r = host.getBoundingClientRect();
                          setHovered({ day, hour, x: r.width / 2, y: e.currentTarget.offsetTop + 8 });
                        }}
                        onBlur={() => setHovered(null)}
                        onClick={() => {
                          const same = isSelected;
                          setSelected(same ? null : { day, hour });
                          setHovered(null);
                        }}
                        onDoubleClick={() => onDayClick(day)}
                        className="relative transition-[transform,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:z-10 hover:scale-[1.18] hover:brightness-125 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
                        style={{
                          height: 22,
                          backgroundColor: cellColor(cellTier(cell, source, mode), alpha),
                          transform: isSelected ? 'scale(1.1)' : undefined,
                          zIndex: isSelected ? 5 : undefined,
                        }}
                      >
                        {isSelected && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-[3px]"
                            style={{ boxShadow: 'inset 0 0 0 2px var(--page-accent)' }}
                          />
                        )}
                        {isTodayHour && !isSelected && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-[3px]"
                            style={{ boxShadow: 'inset 0 0 0 1px var(--page-accent)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
              <MousePointerClick className="h-3 w-3" />
              Click a cell for its breakdown · click a day name to open that day · double-click a
              column to open it · ← → to page weeks
            </p>
          </div>
          )}
        </div>

        {/* ── cursor tooltip ── */}
        <AnimatePresence>
          {hovered && hoveredCell && (
            <motion.div
              key={`${hovered.day}-${hovered.hour}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.12 }}
              className="pointer-events-none fixed z-[60] w-60 rounded-lg border border-[var(--ws-border-strong)] bg-[var(--bg-primary)] p-2.5 shadow-xl"
              style={{
                left: Math.min(Math.max(hovered.x + 14, 8), (typeof window !== 'undefined' ? window.innerWidth : 1920) - 250),
                top: Math.max(hovered.y - 8, 8),
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                  {DAY_LONG[hovered.day]}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                  {hovered.hour.toString().padStart(2, '0')}:00–{(hovered.hour + 1).toString().padStart(2, '0')}:00
                </span>
              </div>

              <div className="mt-2 space-y-1">
                <Row
                  label={mode === 'external' ? 'External' : 'Tracked'}
                  value={humanDuration(hoverResolved?.seconds ?? 0)}
                  color={hoverResolved?.source === 'external' ? 'var(--info)' : 'var(--text-primary)'}
                />
                {mode !== 'external' && hoveredCell.deviceSeconds > 0 && (
                  <Row
                    label="Productive"
                    value={`${Math.round((hoveredCell.productivity ?? 0) * 100)}%`}
                    color="var(--tier-productive)"
                  />
                )}
                {mode !== 'device' && hoveredCell.externalSeconds > 0 && (
                  <Row label="External" value={humanDuration(hoveredCell.externalSeconds)} color="var(--info)" />
                )}
              </div>

              {hoverTop.length > 0 && (
                <div className="mt-2 border-t border-[var(--ws-border)] pt-2">
                  <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Top usage
                  </div>
                  <div className="space-y-1">
                    {hoverTop.map(([name, data]) => (
                      <div key={name} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: getAppColor?.(name) ?? 'var(--muted-foreground)' }}
                          />
                          <span className="truncate text-[10px] text-[var(--text-secondary)]">{name}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                          {humanDuration(data.seconds)}
                        </span>
                      </div>
                    ))}
                    {(hoveredCell.appCount ?? 0) > hoverTop.length && (
                      <div className="text-[9px] text-[var(--text-muted)]">
                        +{(hoveredCell.appCount ?? 0) - hoverTop.length} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {secondsIsZero(hoverResolved?.seconds) && (
                <p className="mt-2 border-t border-[var(--ws-border)] pt-2 text-[10px] italic text-[var(--text-muted)]">
                  Nothing recorded this hour.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── selected-cell rail: the detail stays on screen with the cell ── */}
        <AnimatePresence initial={false}>
          {selected && (
            <motion.div
              key={selected.day + '-' + selected.hour}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="shrink-0 overflow-hidden border-t border-[var(--ws-border)] bg-[var(--bg-secondary)]"
            >
              <CellRail
                cell={selectedCell}
                day={selected.day}
                hour={selected.hour}
                mode={mode}
                getAppColor={getAppColor}
                onClose={() => setSelected(null)}
                onOpenDay={() => onDayClick(selected.day)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────── sub-views ─────────────────────────────── */

function secondsIsZero(s: number | undefined) {
  return !s || s <= 0;
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
      <span className="font-mono text-[11px] font-medium tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/**
 * HUE = tier. Tracked cells are banded by their productivity ratio; external-only
 * cells get the one non-tier signal hue so the two channels stay distinguishable.
 */
function cellTier(cell: HeatmapCell | undefined, source: Source, mode: HeatmapMode): Tier {
  if (source === 'none') return 'empty';
  if (source === 'external' || mode === 'external') return 'external';
  return productivityTier(cell);
}

/** Device cells are banded by the productivity ratio. */
function productivityTier(cell: HeatmapCell | undefined): Tier {
  if (!cell) return 'empty';
  if ((cell.deviceSeconds ?? 0) <= 0) return 'empty';
  const p = cell.productivity ?? 0;
  if (p >= 0.66) return 'productive';
  if (p >= 0.34) return 'neutral';
  return 'distracting';
}

function CellRail({
  cell,
  day,
  hour,
  mode,
  getAppColor,
  onClose,
  onOpenDay,
}: {
  cell: HeatmapCell | undefined;
  day: number;
  hour: number;
  mode: HeatmapMode;
  getAppColor?: (app: string) => string | undefined;
  onClose: () => void;
  onOpenDay: () => void;
}) {
  const apps = topEntries(cell?.deviceBreakdown, 6);
  const external = topEntries(cell?.externalBreakdown, 6);
  const total = (cell?.deviceSeconds ?? 0) + (cell?.externalSeconds ?? 0);
  const productivePct = Math.round((cell?.productivity ?? 0) * 100);

  return (
    <div className="max-h-[38vh] overflow-auto px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
              {DAY_LONG[day]} {hour.toString().padStart(2, '0')}:00–{(hour + 1).toString().padStart(2, '0')}:00
            </h3>
            <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
              {humanDuration(total)} total
            </span>
            {mode !== 'external' && total > 0 && (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                style={{
                  color: 'var(--tier-productive)',
                  backgroundColor: 'var(--tier-productive-muted)',
                }}
              >
                {productivePct}% productive
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
            {cell && cell.segmentCount > 0
              ? `${cell.segmentCount} recorded segment${cell.segmentCount === 1 ? '' : 's'} across ${cell.appCount} source${cell.appCount === 1 ? '' : 's'}`
              : 'No segments recorded in this hour'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onOpenDay}
            className="rounded-lg border border-[var(--ws-border-strong)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
          >
            Open full day
          </button>
          <button
            onClick={onClose}
            aria-label="Clear selection"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--page-accent)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {total <= 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--ws-border)] px-3 py-4 text-center text-[11px] text-[var(--text-muted)]">
          Nothing was recorded during this hour. Cells fill in as the tracker logs foreground
          apps, browser domains and external sessions.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {mode !== 'external' && (
            <BreakdownColumn
              title="Tracked"
              emptyLabel="No tracked apps this hour"
              rows={apps.map(([name, d]) => ({ name, seconds: d.seconds, color: getAppColor?.(name) }))}
              totalSeconds={cell?.deviceSeconds ?? 0}
              tokenColor="var(--tier-productive)"
            />
          )}
          {mode !== 'device' && (
            <BreakdownColumn
              title="External"
              emptyLabel="No external sessions this hour"
              rows={external.map(([name, d]) => ({ name, seconds: d.seconds, color: d.color }))}
              totalSeconds={cell?.externalSeconds ?? 0}
              tokenColor="var(--info)"
            />
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownColumn({
  title,
  rows,
  totalSeconds,
  tokenColor,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ name: string; seconds: number; color?: string }>;
  totalSeconds: number;
  tokenColor: string;
  emptyLabel: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </span>
        <span className="font-mono text-[11px] font-medium tabular-nums" style={{ color: tokenColor }}>
          {humanDuration(totalSeconds)}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[10px] italic text-[var(--text-muted)]">{emptyLabel}</p>
      ) : (
        <div className="space-y-1">
          {rows.map(r => {
            const pct = totalSeconds > 0 ? Math.round((r.seconds / totalSeconds) * 100) : 0;
            return (
              <div key={r.name} className="group">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color ?? tokenColor }}
                    />
                    <span className="truncate text-[11px] text-[var(--text-secondary)]">{r.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                    {humanDuration(r.seconds)}
                    <span className="ml-1 opacity-60">{pct}%</span>
                  </span>
                </div>
                <div className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-[var(--bg-primary)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: r.color ?? tokenColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
