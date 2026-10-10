/**
 * Rankings — /rankings
 *
 * DESIGN IDEA: rankings are a LADDER, not a list. Comparison across time is
 * vertical — standing is height. So the page reads top-down as an ascent:
 * the podium at the summit, then the trend line, then every rung below.
 *
 * The apex is resolved by `rank === 1`, NOT by array position: `periods` is
 * sorted newest-first, so `filtered[0]` is the most RECENT period. The old
 * hero read `filtered[0]` and captioned it "your strongest day", which put
 * the newest day under a trophy no matter how it ranked.
 *
 * Tokens only. The surface signal hue is `var(--page-accent)`, which the
 * router sets via `data-page="rankings"` (see index.css). This file used to
 * hardcode an amber hex inline as `--page-accent`, which silently overrode
 * both the dark and the light accent ramp. Do not reintroduce an inline hue:
 * add a `[data-page="rankings"]` entry in index.css instead.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Trophy, Medal, Award, Target, Clock, TrendingUp, Flame, Zap,
  Moon, Search, BarChart3, Shield, Dumbbell, AlertCircle, RotateCw, ChevronDown,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AnimatedCircularProgressBar } from '../components/ui/animated-circular-progress-bar';
import { NumberTicker } from '../components/ui/number-ticker';

type Metric = 'productivity' | 'focus' | 'goals' | 'groups' | 'external' | 'sleep' | 'streak';
type Granularity = 'day' | 'week' | 'month';

interface PeriodRank {
  key: string; label: string; start: string; end: string; days: number; rank: number;
  productivityScore: number; prodPct: number; distPct: number;
  prodSec: number; neutSec: number; distSec: number; totalSec: number; sessions: number;
  focusCount: number; focusCompleted: number; focusFailed: number; focusSec: number; focusRate: number;
  goalsDone: number; goalsAll: number; goalRate: number;
  extTotal: number; extActivities: Record<string, number>; extTypes: Record<string, number>;
  sleepSec: number; sleepSessions: number; sleepAvgMin: number; sleepDeficitMin: number;
  groupUsage: Record<string, { sessions: number; sec: number }>;
}

interface RankingsData {
  periods: PeriodRank[];
  summary: {
    avgScore: number; bestPeriod: PeriodRank | null; worstPeriod: PeriodRank | null;
    totalProductiveSec: number; totalSec: number; totalFocusSec: number;
    totalGoalsDone: number; totalSleepMin: number;
    periodCount: number; granularity: string; metric: string;
    currentStreak: number; longestStreak: number;
  };
}

/* ── Semantic tone map ────────────────────────────────────────────────
 * LAMINAR §2: emerald is SUCCESS-state only, rose is DESTRUCTIVE only.
 * Everything else is the page's single signal hue or muted ink. These are
 * Tailwind utilities, so they carry no raw hex (LAMINAR §7.7 grep gate). */
const TONE = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-rose-400',
  accent: 'text-[var(--page-accent)]',
  ink: 'text-[var(--color-muted-foreground)]',
} as const;

const METRICS: { key: Metric; label: string; desc: string; icon: any; unit: string }[] = [
  { key: 'productivity', label: 'Productivity', desc: 'Composite score from productive vs distracting time', icon: TrendingUp, unit: 'score' },
  { key: 'focus', label: 'Focus', desc: 'Deep focus sessions completed, and how many finished', icon: Target, unit: 'sessions' },
  { key: 'goals', label: 'Goals', desc: 'Goals marked done vs total set for the period', icon: Zap, unit: 'done' },
  { key: 'groups', label: 'Groups', desc: 'Sessions run inside named focus groups', icon: Shield, unit: 'sessions' },
  { key: 'external', label: 'External', desc: 'Time logged in external activities', icon: Dumbbell, unit: 'time' },
  { key: 'sleep', label: 'Sleep', desc: 'Average nightly sleep duration', icon: Moon, unit: 'minutes' },
  { key: 'streak', label: 'Streaks', desc: 'Consecutive productive periods (≥40% productive)', icon: Flame, unit: '% prod' },
];

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Days' },
  { key: 'week', label: 'Weeks' },
  { key: 'month', label: 'Months' },
];

/** Beyond this the list stops being scannable — see the "+N more" footer. */
const SPINE_CAP = 30;

function fmt(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return '0s';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function fmtH(s: number): string { return s / 3600 < 1 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`; }

/* ── L2 Motion (dashboards / dev tools default) ──────────────────────────
 * transform + opacity only, sanctioned easing, no spring, no bounce.
 * Inventory: B transitional (list stagger, chart grow) and A reactive
 * (row hover). NO ambient loops — LAMINAR §6 bans decorative loops in App UI. */
const EASE = [0.16, 1, 0.3, 1] as const;
const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.035 } } };
const itemVariant = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
};

/** Proportional split of a period's tracked time. Labelled, never colour-alone. */
function TierBar({ prod, neut, dist }: { prod: number; neut: number; dist: number }) {
  const t = prod + neut + dist;
  if (t <= 0) return <div className="h-1.5 rounded-full bg-[var(--color-border)]" />;
  const pct = (n: number) => `${(n / t) * 100}%`;
  return (
    <>
      <div className="flex h-1.5 overflow-hidden rounded-full" role="img"
        aria-label={`${Math.round((prod / t) * 100)}% productive, ${Math.round((dist / t) * 100)}% distracting`}>
        {prod > 0 && <div className="bg-emerald-500/70" style={{ width: pct(prod) }} />}
        {neut > 0 && <div className="bg-[var(--color-muted-foreground)]/25" style={{ width: pct(neut) }} />}
        {dist > 0 && <div className="bg-rose-500/60" style={{ width: pct(dist) }} />}
      </div>
    </>
  );
}

function RankChip({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--page-accent)]/15" title="1st">
      <Trophy className="h-4 w-4 text-[var(--page-accent)]" aria-hidden />
      <span className="sr-only">Rank 1</span>
    </div>
  );
  if (rank === 2) return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--color-muted-foreground)]/10" title="2nd">
      <Medal className="h-4 w-4 text-[var(--color-muted-foreground)]" aria-hidden />
      <span className="sr-only">Rank 2</span>
    </div>
  );
  if (rank === 3) return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--color-muted-foreground)]/10" title="3rd">
      <Award className="h-4 w-4 text-[var(--color-muted-foreground)]" aria-hidden />
      <span className="sr-only">Rank 3</span>
    </div>
  );
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] font-mono text-xs text-[var(--color-muted-foreground)]">
      {rank}
    </div>
  );
}

/** Primary value + secondary context for a period under a given metric. */
function metricPrimary(p: PeriodRank, m: Metric): { num: number; display: string; secondary: string; intensity: number } {
  switch (m) {
    case 'productivity': return { num: p.productivityScore, display: String(p.productivityScore), secondary: `${p.prodPct}% productive`, intensity: p.productivityScore };
    case 'focus': return { num: p.focusCompleted, display: String(p.focusCompleted), secondary: `${p.focusRate}% finished`, intensity: p.focusCompleted };
    case 'goals': return { num: p.goalsDone, display: String(p.goalsDone), secondary: `${p.goalRate}% of ${p.goalsAll} set`, intensity: p.goalsDone };
    case 'groups': {
      const entries = Object.entries(p.groupUsage).sort((a, b) => b[1].sessions - a[1].sessions);
      const total = entries.reduce((s, [, g]) => s + g.sessions, 0);
      return { num: total, display: String(total), secondary: entries[0] ? `most: ${entries[0][0]}` : 'no groups used', intensity: total };
    }
    case 'external': return { num: p.extTotal, display: fmtH(p.extTotal), secondary: `${Object.keys(p.extActivities).length} activities`, intensity: p.extTotal };
    case 'sleep': return { num: p.sleepAvgMin, display: `${p.sleepAvgMin}m`, secondary: p.sleepSessions ? `${p.sleepSessions} night${p.sleepSessions === 1 ? '' : 's'}` : 'no sleep logged', intensity: p.sleepAvgMin };
    case 'streak': return { num: p.prodPct, display: `${p.prodPct}%`, secondary: (p.prodPct >= 40 && p.totalSec > 600) ? 'productive period' : 'break', intensity: p.prodPct };
  }
}

/** Chart tooltip — tokens only, no inline hex. */
function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; rank: number; value: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs">
      <div className="font-medium">{d.label}</div>
      <div className="font-mono text-[var(--color-muted-foreground)]">rank #{d.rank} · {d.value}</div>
    </div>
  );
}

interface RankingsPageProps {
  selectedPeriod: string; dateOffset: number;
  onDateOffsetChange?: (o: number) => void;
  tierAssignments?: { productive: string[]; neutral: string[]; distracting: string[] };
}

export default function RankingsPage({ selectedPeriod, dateOffset }: RankingsPageProps) {
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('productivity');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const retry = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    // Rankings of weeks/months needs history — forcing 'all' so older periods load.
    // Only 'day' granularity respects the top-nav scope (Today/Week/Month).
    const effectivePeriod = granularity === 'day' ? selectedPeriod : 'all';
    const api = (window as any).deskflowAPI;
    if (!api?.getPeriodRankings) {
      setError('Rankings are unavailable in this build.');
      setLoading(false);
      return;
    }
    api.getPeriodRankings({ period: effectivePeriod, dateOffset, granularity, metric })
      .then((r: any) => {
        if (cancel) return;
        if (r?.success && r.data) setData(r.data);
        else setError(r?.error || 'Rankings could not be computed.');
        setLoading(false);
      })
      .catch((e: any) => { if (!cancel) { setError(e?.message || 'The rankings request failed.'); setLoading(false); } });
    return () => { cancel = true; };
  }, [selectedPeriod, dateOffset, granularity, metric, reloadKey]);

  // Search narrows the ladder; changing the metric re-ranks, so the "show all"
  // overflow has to be re-armed or a stale flag hides rows in the new metric.
  useEffect(() => { setShowAll(false); }, [metric, granularity, search]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.periods;
    const q = search.trim().toLowerCase();
    return data.periods.filter(p => p.label.toLowerCase().includes(q));
  }, [data, search]);

  /** Newest-first from the main process; the ladder re-sorts by rank. */
  const ladder = useMemo(() => [...filtered].sort((a, b) => a.rank - b.rank), [filtered]);

  /** The apex is the RANK-1 period, never `filtered[0]` (which is the newest). */
  const apex = useMemo(() => ladder.find(p => p.rank === 1) ?? null, [ladder]);
  const podium = useMemo(() => ladder.slice(0, 3), [ladder]);

  const periodLabel = ({ today: 'Today', week: 'This Week', '7day': 'Last 7 Days', month: 'This Month', '30day': 'Last 30 Days', all: 'All Time' } as Record<string, string>)[selectedPeriod] || selectedPeriod;
  const granLabel = granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly';
  const activeMetric = METRICS.find(m => m.key === metric)!;

  /** How the top period compares with the most recent one — "am I improving?" */
  const momentum = useMemo(() => {
    if (!apex || filtered.length < 2) return null;
    const newest = filtered[0];
    if (newest.rank === apex.rank) return null;
    const a = metricPrimary(apex, metric).intensity;
    const n = metricPrimary(newest, metric).intensity;
    return { delta: a - n, newest };
  }, [apex, filtered, metric]);

  const chartData = useMemo(
    () => [...filtered].reverse().map(p => ({ key: p.key, label: p.label, rank: p.rank, value: metricPrimary(p, metric).intensity })),
    [filtered, metric],
  );

  const summaryCards = useMemo(() => {
    if (!data) return [];
    const s = data.summary;
    const m = metric;
    const avg = (f: (p: PeriodRank) => number) =>
      filtered.length ? Math.round(filtered.reduce((a, p) => a + f(p), 0) / filtered.length) : 0;
    if (m === 'productivity') return [
      { label: 'AVG SCORE', value: String(s.avgScore), tone: TONE.accent, icon: TrendingUp },
      { label: 'BEST', value: String(s.bestPeriod?.productivityScore ?? 0), sub: s.bestPeriod?.label, tone: TONE.accent, icon: Trophy },
      { label: 'PRODUCTIVE', value: fmt(s.totalProductiveSec), sub: `of ${fmt(s.totalSec)}`, tone: TONE.good, icon: Clock },
      { label: 'WEAKEST', value: String(s.worstPeriod?.productivityScore ?? 0), sub: s.worstPeriod?.label, tone: TONE.warn, icon: Flame },
    ];
    if (m === 'focus') return [
      { label: 'AVG SUCCESS', value: `${avg(p => p.focusRate)}%`, tone: TONE.accent, icon: Target },
      { label: 'TOTAL FOCUS', value: fmt(s.totalFocusSec), tone: TONE.good, icon: Clock },
      { label: 'BEST RATE', value: s.bestPeriod ? `${s.bestPeriod.focusRate}%` : '—', sub: s.bestPeriod?.label, tone: TONE.accent, icon: Trophy },
      { label: 'SESSIONS', value: String(avg(p => p.focusCount)), tone: TONE.ink, icon: Shield },
    ];
    if (m === 'goals') return [
      { label: 'TOTAL DONE', value: String(s.totalGoalsDone), tone: TONE.good, icon: Zap },
      { label: 'BEST', value: String(s.bestPeriod?.goalsDone ?? 0), sub: s.bestPeriod?.label, tone: TONE.accent, icon: Trophy },
      { label: 'AVG RATE', value: `${avg(p => p.goalRate)}%`, tone: TONE.accent, icon: TrendingUp },
      { label: 'WEAKEST', value: String(s.worstPeriod?.goalsDone ?? 0), sub: s.worstPeriod?.label, tone: TONE.warn, icon: Flame },
    ];
    if (m === 'groups') {
      const sess = (p: PeriodRank) => Object.values(p.groupUsage).reduce((a, g) => a + g.sessions, 0);
      return [
        { label: 'SESSIONS', value: String(filtered.reduce((a, p) => a + sess(p), 0)), tone: TONE.accent, icon: Shield },
        { label: 'GROUPS USED', value: String(new Set(filtered.flatMap(p => Object.keys(p.groupUsage))).size), tone: TONE.ink, icon: Target },
        { label: 'TOTAL TIME', value: fmtH(filtered.reduce((a, p) => a + Object.values(p.groupUsage).reduce((a2, g) => a2 + g.sec, 0), 0)), tone: TONE.good, icon: Clock },
        { label: 'AVG / PERIOD', value: String(Math.round(filtered.reduce((a, p) => a + sess(p), 0) / (filtered.length || 1))), tone: TONE.ink, icon: BarChart3 },
      ];
    }
    if (m === 'external') return [
      { label: 'TOTAL', value: fmtH(filtered.reduce((a, p) => a + p.extTotal, 0)), tone: TONE.accent, icon: Dumbbell },
      { label: 'BEST', value: s.bestPeriod ? fmtH(s.bestPeriod.extTotal) : '—', sub: s.bestPeriod?.label, tone: TONE.accent, icon: Trophy },
      { label: 'ACTIVITIES', value: String(new Set(filtered.flatMap(p => Object.keys(p.extActivities))).size), tone: TONE.ink, icon: Target },
      { label: 'WEAKEST', value: s.worstPeriod ? fmtH(s.worstPeriod.extTotal) : '—', sub: s.worstPeriod?.label, tone: TONE.warn, icon: Flame },
    ];
    if (m === 'sleep') return [
      { label: 'AVG', value: `${avg(p => p.sleepAvgMin)}m`, tone: TONE.accent, icon: Moon },
      { label: 'TOTAL', value: `${s.totalSleepMin}m`, tone: TONE.ink, icon: Clock },
      { label: 'BEST', value: s.bestPeriod ? `${s.bestPeriod.sleepAvgMin}m` : '—', sub: s.bestPeriod?.label, tone: TONE.good, icon: Trophy },
      { label: 'DEFICIT', value: `${avg(p => p.sleepDeficitMin)}m`, tone: TONE.warn, icon: Flame },
    ];
    return [
      { label: 'CURRENT', value: `${s.currentStreak}d`, tone: TONE.bad, icon: Flame },
      { label: 'LONGEST', value: `${s.longestStreak}d`, tone: TONE.accent, icon: Trophy },
      { label: 'PRODUCTIVE', value: String(filtered.filter(p => p.prodPct >= 40 && p.totalSec > 600).length), sub: `of ${filtered.length}`, tone: TONE.good, icon: TrendingUp },
      { label: 'AVG PROD', value: `${avg(p => p.prodPct)}%`, tone: TONE.ink, icon: Target },
    ];
  }, [data, metric, filtered]);

  const visibleSpine = showAll ? ladder : ladder.slice(0, SPINE_CAP);
  const hiddenCount = ladder.length - visibleSpine.length;

  return (
    <div className="space-y-5 p-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--page-accent)]/10">
          <Trophy className="h-4 w-4 text-[var(--page-accent)]" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Rankings</h1>
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">{periodLabel} · {granLabel}</p>
        </div>
      </div>

      {/* ── Metric tabs (real shadcn Tabs) ─────────────────────── */}
      <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
        <TabsList className="flex-wrap gap-1 rounded-xl bg-[var(--color-card)] p-1">
          {METRICS.map(m => {
            const Icon = m.icon;
            const active = metric === m.key;
            return (
              <TabsTrigger key={m.key} value={m.key}
                aria-current={active ? 'true' : undefined}
                className={`gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 ${
                  active
                    ? 'bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted-foreground)]/10 hover:text-[var(--color-foreground)]'
                }`}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {m.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* ── Granularity + search ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1" role="group" aria-label="Period length">
          {GRANULARITIES.map(g => (
            <button key={g.key} type="button" onClick={() => setGranularity(g.key)}
              aria-pressed={granularity === g.key}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50 ${
                granularity === g.key
                  ? 'bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted-foreground)]/10 hover:text-[var(--color-foreground)]'
              }`}>{g.label}</button>
          ))}
        </div>
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]" aria-hidden />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter periods…" aria-label="Filter periods"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50" />
        </div>
      </div>

      {/* ── LOADING — skeleton shaped like the real content ────── */}
      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading rankings">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--color-card)]" />)}
          </div>
          <div className="h-40 animate-pulse rounded-xl bg-[var(--color-card)]" />
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-card)]" />)}
        </div>
      )}

      {/* ── ERROR — cause + a real recovery action ─────────────── */}
      {!loading && error && (
        <GlassCard variant="notebook">
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <AlertCircle className="mb-1 h-8 w-8 text-rose-400/60" aria-hidden />
            <div>
              <p className="text-sm font-medium">Rankings could not load</p>
              <p className="mt-1 max-w-sm text-xs text-[var(--color-muted-foreground)]">
                {error} Your tracked history is untouched — retrying re-reads the same data.
              </p>
            </div>
            <button type="button" onClick={retry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium transition-colors duration-150 hover:bg-[var(--color-muted-foreground)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              Retry rankings
            </button>
          </div>
        </GlassCard>
      )}

      {/* ── EMPTY — says what WOULD be here, and offers the fix ── */}
      {!loading && !error && data && filtered.length === 0 && (
        <GlassCard variant="notebook">
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <BarChart3 className="mb-1 h-8 w-8 text-[var(--color-muted-foreground)]/40" aria-hidden />
            <div>
              <p className="text-sm font-medium">
                {search ? `No period matches “${search.trim()}”` : `No ${granLabel.toLowerCase()} of tracked time in ${periodLabel.toLowerCase()}`}
              </p>
              <p className="mt-1 max-w-sm text-xs text-[var(--color-muted-foreground)]">
                {search
                  ? 'Clear the filter to see every ranked period.'
                  : 'Rankings appear once an app, site, or session has been tracked for a whole period. Open the app for a few minutes, then reload.'}
              </p>
            </div>
            {search
              ? <button type="button" onClick={() => setSearch('')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium transition-colors duration-150 hover:bg-[var(--color-muted-foreground)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
                <RotateCw className="h-3.5 w-3.5" aria-hidden />Clear filter
              </button>
              : <button type="button" onClick={retry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium transition-colors duration-150 hover:bg-[var(--color-muted-foreground)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
                <RotateCw className="h-3.5 w-3.5" aria-hidden />Reload rankings
              </button>}
          </div>
        </GlassCard>
      )}

      {/* ── POPULATED — the ladder ─────────────────────────────── */}
      {!loading && !error && data && filtered.length > 0 && (
        <>
          <p className="-mt-1 text-xs text-[var(--color-muted-foreground)]">{activeMetric.desc}</p>

          {/* Podium — the summit. rank 1 is genuinely rank 1. */}
          <GlassCard variant="notebook" className="relative overflow-hidden">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--page-accent)]">Apex</span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                · your strongest {granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month'}
              </span>
            </div>

            {apex ? (
              <div className="flex flex-wrap items-center gap-6">
                {metric === 'productivity' ? (
                  <div className="relative h-28 w-28 shrink-0">
                    <AnimatedCircularProgressBar value={apex.productivityScore} size={112} strokeWidth={9} gaugePrimaryColor="var(--page-accent)" />
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="font-mono text-3xl font-bold tabular-nums">{apex.productivityScore}</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-28 w-28 shrink-0 place-items-center">
                    <span className="font-mono text-4xl font-bold tabular-nums text-[var(--page-accent)]">
                      <NumberTicker value={metricPrimary(apex, metric).num} />
                    </span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold">{apex.label}</div>
                  <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">{metricPrimary(apex, metric).secondary}</div>

                  {/* Momentum: apex vs the newest period — "am I improving?" */}
                  {momentum && (
                    <div className="mt-2 text-xs">
                      <span className={momentum.delta >= 0 ? TONE.good : TONE.warn}>
                        {momentum.delta >= 0 ? '+' : ''}{momentum.delta} {activeMetric.unit}
                      </span>
                      <span className="text-[var(--color-muted-foreground)]"> vs {momentum.newest.label}</span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-[var(--color-muted-foreground)]/10 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">Rank #1</span>
                    <span className="rounded-lg bg-[var(--color-muted-foreground)]/10 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">{apex.days}d span</span>
                    <span className="rounded-lg bg-[var(--color-muted-foreground)]/10 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">{fmtH(apex.totalSec)} tracked</span>
                  </div>
                </div>

                {/* Runners-up, so the summit has a shape. */}
                {podium.length > 1 && (
                  <div className="flex shrink-0 flex-col gap-2">
                    {podium.slice(1).map(p => (
                      <div key={p.key} className="flex min-w-[132px] items-center gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5">
                        <RankChip rank={p.rank} />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">{p.label}</div>
                          <div className="truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">{metricPrimary(p, metric).display}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-[var(--color-muted-foreground)]">
                No period could be scored for {activeMetric.unit} in this range.
              </p>
            )}
          </GlassCard>

          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summaryCards.slice(0, 4).map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${c.tone}`} aria-hidden />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-semibold tabular-nums">{c.value}</div>
                    <div className="truncate text-[9px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      {c.label}{c.sub ? ` · ${c.sub}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* The trend — a ladder needs a direction, not just rungs. */}
          {chartData.length > 1 && (
            <GlassCard variant="notebook">
              <div className="mb-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--page-accent)]" aria-hidden />
                <h2 className="text-sm font-semibold">Trend</h2>
                <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">{activeMetric.unit}</span>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd"
                      tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} width={44}
                      tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }} />
                    <Tooltip content={<TrendTooltip />} cursor={{ fill: 'var(--color-muted-foreground)' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion}
                      animationDuration={400} animationEasing="ease-out">
                      {chartData.map(d => (
                        <Cell key={d.key}
                          fill={d.rank === 1 ? 'var(--page-accent)' : 'var(--color-muted-foreground)'}
                          fillOpacity={d.rank === 1 ? 0.95 : 0.3} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}

          {/* The Spine — every rung, best first. */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--page-accent)]" aria-hidden />
              <h2 className="text-sm font-semibold">The Spine</h2>
              <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">{ladder.length} ranked</span>
            </div>

            <motion.div variants={listVariants} initial={prefersReducedMotion ? false : 'hidden'} animate="visible" className="space-y-1">
              {visibleSpine.map(p => {
                const mp = metricPrimary(p, metric);
                const isApex = p.rank === 1;
                return (
                  <motion.div key={p.key} variants={itemVariant}>
                    <div className={`group flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150 ${
                      isApex
                        ? 'border-[var(--page-accent)]/30 bg-[var(--page-accent)]/[0.06]'
                        : 'border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted-foreground)]/[0.06]'
                    }`}>
                      <RankChip rank={p.rank} />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.label}</div>
                        <div className="truncate text-[11px] text-[var(--color-muted-foreground)]">{mp.secondary}</div>
                      </div>

                      {/* Time split only where it is the ranked story. */}
                      {(metric === 'productivity' || metric === 'streak') && (
                        <div className="hidden w-24 shrink-0 sm:block">
                          <TierBar prod={p.prodSec} neut={p.neutSec} dist={p.distSec} />
                        </div>
                      )}

                      <div className="w-16 shrink-0 text-right">
                        <div className="font-mono text-base font-bold tabular-nums">{mp.display}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {hiddenCount > 0 && (
              <button type="button" onClick={() => setShowAll(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-muted-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted-foreground)]/[0.06] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50">
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                Show {hiddenCount} more period{hiddenCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}