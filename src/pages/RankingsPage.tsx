import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Trophy, Medal, Award, Target, Clock, TrendingUp, Flame, Zap, Brain,
  Moon, Search, BarChart3, Minus, Shield, Dumbbell, AlertCircle,
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
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

const METRICS: { key: Metric; label: string; desc: string; icon: any; color: string }[] = [
  { key: 'productivity', label: 'Productivity', desc: 'Composite score from productive vs distracting time', icon: TrendingUp, color: '#10b981' },
  { key: 'focus', label: 'Focus Sessions', desc: 'Deep focus sessions completed (not group usage)', icon: Target, color: '#8b5cf6' },
  { key: 'goals', label: 'Goals', desc: 'Goals marked done vs total set', icon: Zap, color: '#f59e0b' },
  { key: 'groups', label: 'Focus Groups', desc: 'Sessions run inside named focus groups', icon: Shield, color: '#6366f1' },
  { key: 'external', label: 'External', desc: 'Time logged in external activities', icon: Dumbbell, color: '#14b8a6' },
  { key: 'sleep', label: 'Sleep', desc: 'Average nightly sleep duration', icon: Moon, color: '#3b82f6' },
  { key: 'streak', label: 'Streaks', desc: 'Consecutive productive days (≥40% productive)', icon: Flame, color: '#ef4444' },
];

function fmt(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function fmtH(s: number): string { return s / 3600 < 1 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`; }

// ── L2 Motion variants ──────────────────────────────────────────
const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const itemVariant = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } } };

// ── Real MCP components used ────────────────────────────────────
function TierBar({ prod, neut, dist }: { prod: number; neut: number; dist: number }) {
  const t = prod + neut + dist;
  if (t === 0) return <div className="h-1.5 bg-zinc-800/40 rounded-full" />;
  return (
    <div className="flex rounded-full overflow-hidden h-1.5">
      {prod > 0 && <div className="bg-emerald-500/60 transition-all duration-300" style={{ width: `${(prod/t)*100}%` }} />}
      {neut > 0 && <div className="bg-blue-500/40 transition-all duration-300" style={{ width: `${(neut/t)*100}%` }} />}
      {dist > 0 && <div className="bg-red-500/50 transition-all duration-300" style={{ width: `${(dist/t)*100}%` }} />}
    </div>
  );
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-xl bg-amber-500/15 grid place-items-center shrink-0"><Trophy className="w-4 h-4 text-amber-400" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-xl bg-zinc-400/15 grid place-items-center shrink-0"><Medal className="w-4 h-4 text-zinc-300" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-xl bg-amber-700/15 grid place-items-center shrink-0"><Award className="w-4 h-4 text-amber-600" /></div>;
  return <div className="w-8 h-8 rounded-xl bg-zinc-800/50 grid place-items-center shrink-0"><span className="text-xs font-mono text-zinc-500">{rank}</span></div>;
}

// ── Metric-specific row renderers ──────────────────────────────
function ProductivityRow({ p }: { p: PeriodRank }) {
  return (
    <motion.div variants={itemVariant} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.02] transition-colors duration-150 group">
      <MedalIcon rank={p.rank} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate group-hover:translate-x-0.5 transition-transform duration-150">{p.label}</span>
          {p.rank === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">BEST</span>}
        </div>
        <TierBar prod={p.prodSec} neut={p.neutSec} dist={p.distSec} />
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-500 shrink-0">
        <span className="text-emerald-400">{p.prodPct}%</span>
        <span className="text-red-400">{p.distPct}%</span>
        <span className="font-mono w-14 text-right">{fmtH(p.totalSec)}</span>
      </div>
      <div className="text-right w-14 shrink-0">
        <div className="text-lg font-bold font-mono tabular-nums">{p.productivityScore}</div>
        <div className="text-[10px] text-zinc-600">score</div>
      </div>
    </motion.div>
  );
}

function FocusRow({ p }: { p: PeriodRank }) {
  return (
    <motion.div variants={itemVariant} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.02] transition-colors duration-150 group">
      <MedalIcon rank={p.rank} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm truncate block group-hover:translate-x-0.5 transition-transform duration-150">{p.label}</span>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1.5 flex-1 bg-zinc-800/60 rounded-full overflow-hidden">
            <motion.div className="h-full bg-violet-500/60 rounded-full" initial={{ width: 0 }} animate={{ width: `${p.focusRate}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <span className="text-[10px] text-zinc-600 shrink-0">{p.focusRate}%</span>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-500 shrink-0">
        <span className="text-emerald-400 font-mono">{p.focusCompleted}</span>
        <span className="text-red-400 font-mono">{p.focusFailed}</span>
        <span className="font-mono w-14 text-right">{fmt(p.focusSec)}</span>
      </div>
    </motion.div>
  );
}

function GoalsRow({ p }: { p: PeriodRank }) {
  return (
    <motion.div variants={itemVariant} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.02] transition-colors duration-150 group">
      <MedalIcon rank={p.rank} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm truncate block group-hover:translate-x-0.5 transition-transform duration-150">{p.label}</span>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1.5 flex-1 bg-zinc-800/60 rounded-full overflow-hidden">
            <motion.div className="h-full bg-amber-500/60 rounded-full" initial={{ width: 0 }} animate={{ width: `${p.goalRate}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <span className="text-[10px] text-zinc-600 shrink-0">{p.goalRate}%</span>
        </div>
      </div>
      <div className="text-right w-20 shrink-0">
        <span className="text-lg font-bold font-mono text-amber-400">{p.goalsDone}</span>
        <span className="text-xs text-zinc-600"> / {p.goalsAll}</span>
      </div>
    </motion.div>
  );
}

function GroupsRow({ p }: { p: PeriodRank }) {
  const groups = Object.entries(p.groupUsage).sort((a, b) => b[1].sessions - a[1].sessions);
  return (
    <motion.div variants={itemVariant} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.02] transition-colors duration-150 group">
      <MedalIcon rank={p.rank} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm truncate block group-hover:translate-x-0.5 transition-transform duration-150">{p.label}</span>
        {groups.length > 0 ? (
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {groups.slice(0, 3).map(([name, g]) => (
              <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">{name}: {g.sessions}</span>
            ))}
          </div>
        ) : <span className="text-[10px] text-zinc-600">No usage</span>}
      </div>
      <div className="text-right w-16 shrink-0">
        <div className="text-lg font-bold font-mono">{groups.reduce((s, [, g]) => s + g.sessions, 0)}</div>
        <div className="text-[10px] text-zinc-600">total</div>
      </div>
    </motion.div>
  );
}

function ExternalRow({ p }: { p: PeriodRank }) {
  const acts = Object.entries(p.extActivities).sort((a, b) => b[1] - a[1]);
  return (
    <motion.div variants={itemVariant} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.02] transition-colors duration-150 group">
      <MedalIcon rank={p.rank} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm truncate block group-hover:translate-x-0.5 transition-transform duration-150">{p.label}</span>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {acts.slice(0, 3).map(([name, sec]) => (
            <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400">{name}: {fmt(sec)}</span>
          ))}
        </div>
      </div>
      <div className="text-right w-16 shrink-0">
        <div className="text-lg font-bold font-mono">{fmtH(p.extTotal)}</div>
        <div className="text-[10px] text-zinc-600">tracked</div>
      </div>
    </motion.div>
  );
}

function SleepRow({ p }: { p: PeriodRank }) {
  const avg = p.sleepAvgMin;
  const quality = avg >= 480 ? 'Great' : avg >= 420 ? 'Good' : avg >= 360 ? 'Fair' : 'Low';
  const qColor = avg >= 480 ? 'text-emerald-400' : avg >= 420 ? 'text-blue-400' : avg >= 360 ? 'text-amber-400' : 'text-red-400';
  return (
    <motion.div variants={itemVariant} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.02] transition-colors duration-150 group">
      <MedalIcon rank={p.rank} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm truncate block group-hover:translate-x-0.5 transition-transform duration-150">{p.label}</span>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-600">
          <span>{p.sleepSessions} night{p.sleepSessions !== 1 ? 's' : ''}</span>
          {p.sleepDeficitMin > 0 && <span className="text-amber-500/80">-{p.sleepDeficitMin}m vs 8h</span>}
        </div>
      </div>
      <div className="text-right shrink-0 w-20">
        <div className="text-lg font-bold font-mono">{avg}m</div>
        <div className={`text-[10px] ${qColor}`}>{quality}</div>
      </div>
    </motion.div>
  );
}

function StreakRow({ p }: { p: PeriodRank }) {
  const isProd = p.prodPct >= 40 && p.totalSec > 600;
  return (
    <motion.div variants={itemVariant} className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/[0.02] transition-colors duration-150 group">
      <MedalIcon rank={p.rank} />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm truncate block group-hover:translate-x-0.5 transition-transform duration-150">{p.label}</span>
        <TierBar prod={p.prodSec} neut={p.neutSec} dist={p.distSec} />
      </div>
      <div className="flex items-center gap-3 text-xs shrink-0">
        {isProd ? (
          <span className="flex items-center gap-1 text-amber-400"><Flame className="w-3 h-3" /> Active</span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-600"><Minus className="w-3 h-3" /> Break</span>
        )}
        <span className="font-mono text-sm w-10 text-right">{p.prodPct}%</span>
      </div>
    </motion.div>
  );
}

// Primary value + secondary context for a period under a given metric (for the spine/apex)
function metricPrimary(p: PeriodRank, m: Metric): { num: number; display: string; secondary: string; intensity: number } {
  switch (m) {
    case 'productivity': return { num: p.productivityScore, display: String(p.productivityScore), secondary: `${p.prodPct}% productive`, intensity: p.productivityScore };
    case 'focus': return { num: p.focusCompleted, display: String(p.focusCompleted), secondary: `${p.focusRate}% success`, intensity: p.focusCompleted };
    case 'goals': return { num: p.goalsDone, display: String(p.goalsDone), secondary: `${p.goalRate}% done`, intensity: p.goalsDone };
    case 'groups': {
      const entries = Object.entries(p.groupUsage).sort((a, b) => b[1].sessions - a[1].sessions);
      const total = entries.reduce((s, [, g]) => s + g.sessions, 0);
      return { num: total, display: String(total), secondary: entries[0] ? entries[0][0] : 'no groups', intensity: total };
    }
    case 'external': return { num: p.extTotal, display: fmtH(p.extTotal), secondary: `${Object.keys(p.extActivities).length} activities`, intensity: p.extTotal };
    case 'sleep': return { num: p.sleepAvgMin, display: `${p.sleepAvgMin}m`, secondary: p.sleepSessions ? `${p.sleepSessions} nights` : 'no sleep', intensity: p.sleepAvgMin };
    case 'streak': return { num: p.prodPct, display: `${p.prodPct}%`, secondary: (p.prodPct >= 40 && p.totalSec > 600) ? 'productive' : 'break', intensity: p.prodPct };
  }
}

const ROW_RENDERERS: Record<Metric, React.FC<{ p: PeriodRank }>> = {
  productivity: ProductivityRow, focus: FocusRow, goals: GoalsRow,
  groups: GroupsRow, external: ExternalRow, sleep: SleepRow, streak: StreakRow,
};

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
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    // Rankings of weeks/months needs history — forcing 'all' so older periods load.
    // Only 'day' granularity respects the top-nav scope (Today/Week/Month).
    const effectivePeriod = granularity === 'day' ? selectedPeriod : 'all';
    (window as any).deskflowAPI?.getPeriodRankings?.({ period: effectivePeriod, dateOffset, granularity, metric })
      ?.then((r: any) => {
        if (cancel) return;
        if (r?.success && r.data) setData(r.data);
        else setError(r?.error || 'Failed to load rankings');
        setLoading(false);
      })
      ?.catch((e: any) => { if (!cancel) { setError(e?.message || 'Network error'); setLoading(false); } });
    return () => { cancel = true; };
  }, [selectedPeriod, dateOffset, granularity, metric]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search) return data.periods;
    const q = search.toLowerCase();
    return data.periods.filter(p => p.label.toLowerCase().includes(q));
  }, [data, search]);

  const periodLabel = ({ today: 'Today', week: 'This Week', '7day': 'Last 7 Days', month: 'This Month', '30day': 'Last 30 Days', all: 'All Time' } as Record<string, string>)[selectedPeriod] || selectedPeriod;

  // ── Summary cards per metric ──────────────────────────────────
  const summaryCards = useMemo(() => {
    if (!data) return [];
    const s = data.summary;
    const m = metric;
    if (m === 'productivity') return [
      { label: 'AVG SCORE', value: s.avgScore, icon: TrendingUp, color: '#10b981' },
      { label: 'BEST', value: s.bestPeriod?.productivityScore ?? 0, sub: s.bestPeriod?.label, icon: Trophy, color: '#f59e0b' },
      { label: 'PRODUCTIVE', value: fmt(s.totalProductiveSec), sub: `of ${fmt(s.totalSec)}`, icon: Clock, color: '#8b5cf6' },
      { label: 'NEEDS WORK', value: s.worstPeriod?.productivityScore ?? 0, sub: s.worstPeriod?.label, icon: Flame, color: '#ef4444' },
    ];
    if (m === 'focus') return [
      { label: 'AVG SUCCESS', value: `${filtered.length > 0 ? Math.round(filtered.reduce((a, p) => a + p.focusRate, 0) / filtered.length) : 0}%`, icon: Target, color: '#8b5cf6' },
      { label: 'TOTAL FOCUS', value: fmt(s.totalFocusSec), icon: Clock, color: '#10b981' },
      { label: 'BEST RATE', value: s.bestPeriod ? `${s.bestPeriod.focusRate}%` : '—', sub: s.bestPeriod?.label, icon: Trophy, color: '#f59e0b' },
      { label: 'SESSIONS', value: filtered.reduce((a, p) => a + p.focusCount, 0), icon: Shield, color: '#3b82f6' },
    ];
    if (m === 'goals') return [
      { label: 'TOTAL DONE', value: s.totalGoalsDone, icon: Zap, color: '#f59e0b' },
      { label: 'BEST', value: s.bestPeriod?.goalsDone ?? 0, sub: s.bestPeriod?.label, icon: Trophy, color: '#10b981' },
      { label: 'AVG RATE', value: `${filtered.length > 0 ? Math.round(filtered.reduce((a, p) => a + p.goalRate, 0) / filtered.length) : 0}%`, icon: TrendingUp, color: '#8b5cf6' },
      { label: 'WORST', value: s.worstPeriod?.goalsDone ?? 0, sub: s.worstPeriod?.label, icon: Flame, color: '#ef4444' },
    ];
    if (m === 'groups') return [
      { label: 'SESSIONS', value: filtered.reduce((a, p) => a + Object.values(p.groupUsage).reduce((s2, g) => s2 + g.sessions, 0), 0), icon: Shield, color: '#6366f1' },
      { label: 'GROUPS USED', value: new Set(filtered.flatMap(p => Object.keys(p.groupUsage))).size, icon: Target, color: '#8b5cf6' },
      { label: 'TOTAL TIME', value: fmtH(filtered.reduce((a, p) => a + Object.values(p.groupUsage).reduce((s2, g) => s2 + g.sec, 0), 0)), icon: Clock, color: '#10b981' },
      { label: 'AVG/PERIOD', value: Math.round(filtered.reduce((a, p) => a + Object.values(p.groupUsage).reduce((s2, g) => s2 + g.sessions, 0), 0) / (filtered.length || 1)), icon: BarChart3, color: '#f59e0b' },
    ];
    if (m === 'external') return [
      { label: 'TOTAL', value: fmtH(filtered.reduce((a, p) => a + p.extTotal, 0)), icon: Dumbbell, color: '#14b8a6' },
      { label: 'BEST', value: s.bestPeriod ? fmtH(s.bestPeriod.extTotal) : '—', sub: s.bestPeriod?.label, icon: Trophy, color: '#f59e0b' },
      { label: 'ACTIVITIES', value: new Set(filtered.flatMap(p => Object.keys(p.extActivities))).size, icon: Target, color: '#8b5cf6' },
      { label: 'WORST', value: s.worstPeriod ? fmtH(s.worstPeriod.extTotal) : '—', icon: Flame, color: '#ef4444' },
    ];
    if (m === 'sleep') return [
      { label: 'AVG', value: `${Math.round(filtered.reduce((a, p) => a + p.sleepAvgMin, 0) / (filtered.length || 1))}m`, icon: Moon, color: '#3b82f6' },
      { label: 'TOTAL', value: `${s.totalSleepMin}m`, icon: Clock, color: '#8b5cf6' },
      { label: 'BEST', value: s.bestPeriod ? `${s.bestPeriod.sleepAvgMin}m` : '—', sub: s.bestPeriod?.label, icon: Trophy, color: '#f59e0b' },
      { label: 'DEFICIT', value: `${Math.round(filtered.reduce((a, p) => a + p.sleepDeficitMin, 0) / (filtered.length || 1))}m`, icon: Flame, color: '#ef4444' },
    ];
    // streak
    return [
      { label: 'CURRENT', value: `${s.currentStreak}d`, icon: Flame, color: '#ef4444' },
      { label: 'LONGEST', value: `${s.longestStreak}d`, icon: Trophy, color: '#f59e0b' },
      { label: 'PRODUCTIVE', value: filtered.filter(p => p.prodPct >= 40 && p.totalSec > 600).length, sub: `of ${filtered.length}`, icon: TrendingUp, color: '#10b981' },
      { label: 'AVG PROD', value: `${Math.round(filtered.reduce((a, p) => a + p.prodPct, 0) / (filtered.length || 1))}%`, icon: Target, color: '#8b5cf6' },
    ];
  }, [data, metric, filtered]);

  return (
    <div className="space-y-5 p-5" style={{ '--page-accent': '#f59e0b' } as React.CSSProperties}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--page-accent)]/15 grid place-items-center">
          <Trophy className="w-4.5 h-4.5 text-[var(--page-accent)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Rankings</h1>
          <p className="text-xs text-zinc-500">{periodLabel} · {granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly'}</p>
        </div>
      </div>

      {/* Metric tabs — using real shadcn Tabs */}
      <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
        <TabsList className="bg-zinc-900/50 p-1 rounded-xl">
          {METRICS.map(m => {
            const Icon = m.icon;
            return (
              <TabsTrigger key={m.key} value={m.key}
                className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-500 hover:text-zinc-300 text-xs gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150">
                <Icon className="w-3.5 h-3.5" style={metric === m.key ? { color: m.color } : {}} />
                {m.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Granularity + Search */}
      <div className="flex items-center gap-3">
        <div className="flex bg-zinc-900/50 rounded-xl p-1 border border-zinc-800/30">
          {([['day', 'Days'], ['week', 'Weeks'], ['month', 'Months']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setGranularity(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                granularity === k ? 'bg-amber-500/15 text-amber-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}>{l}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input type="text" placeholder="Search periods..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-900/50 border border-zinc-800/30 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[var(--page-accent)]/30 focus:border-[var(--page-accent)]/30 transition-all duration-150" />
        </div>
      </div>

      {/* Loading state — skeleton pattern per Human-Centric UX */}
      {loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-zinc-900/40 animate-pulse" />)}
          </div>
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-zinc-900/40 animate-pulse" />)}
        </div>
      )}

      {/* Error state — Human-Centric UX pillar 4 */}
      {!loading && error && (
        <GlassCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-400/50 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Failed to load rankings</p>
            <p className="text-xs text-zinc-600">{error}</p>
          </div>
        </GlassCard>
      )}

      {/* Empty state — Human-Centric UX pillar 4 */}
      {!loading && !error && data && filtered.length === 0 && (
        <GlassCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">{search ? 'No periods match your search' : 'No data tracked in this period'}</p>
            <p className="text-xs text-zinc-600">{search ? 'Try a different search term' : 'Start tracking to see your rankings'}</p>
          </div>
        </GlassCard>
      )}

      {/* Populated state */}
      {!loading && !error && data && filtered.length > 0 && (() => {
        const apex = filtered[0];
        const ap = metricPrimary(apex, metric);
        const maxIntensity = Math.max(1, ...filtered.map(p => metricPrimary(p, metric).intensity));
        const isProductivity = metric === 'productivity';
        return (
        <>
          {/* Metric description — disambiguates what is being ranked */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 -mt-1">
            {METRICS.find(m => m.key === metric)?.desc}
          </div>

          {/* Apex — the #1 period, no trophy cliché. Amber = DeskFlow's signature heat. */}
          <GlassCard className={isProductivity ? 'relative overflow-hidden' : ''}>
            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-[var(--page-accent)]/10 blur-3xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-widest text-[var(--page-accent)]/80 font-semibold">Apex</span>
              <span className="text-xs text-zinc-500">· your strongest {granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month'}</span>
            </div>
            <div className="flex items-center gap-6">
              {isProductivity ? (
                <div className="relative w-28 h-28 shrink-0">
                  <AnimatedCircularProgressBar
                    value={ap.num} size={112} strokeWidth={9} gaugePrimaryColor="var(--page-accent)" gaugeSecondaryColor="rgba(245,158,11,0.12)" />
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="text-3xl font-bold font-mono tabular-nums">{ap.num}</span>
                  </div>
                </div>
              ) : (
                <div className="shrink-0 w-28 h-28 grid place-items-center">
                  <span className="text-4xl font-bold font-mono tabular-nums text-[var(--page-accent)]">
                    <NumberTicker value={ap.num} />
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold truncate">{apex.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{ap.secondary}</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-zinc-800/60 text-zinc-400">Rank #{apex.rank}</span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-zinc-800/60 text-zinc-400">{apex.days}d span</span>
                  {isProductivity && <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-zinc-800/60 text-zinc-400">{apex.prodPct}% productive</span>}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Summary strip — thin, not a 4-card cliché grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {summaryCards.slice(0, 4).map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/40 border border-zinc-800/30">
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold font-mono tabular-nums truncate">{c.value}</div>
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500 truncate">{c.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* The Momentum Spine — ranked vertical list, amber heat = standing */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-[var(--page-accent)]" />
              <h2 className="text-sm font-semibold">The Spine</h2>
              <span className="text-xs text-zinc-500 ml-auto">{filtered.length} ranked</span>
            </div>
            <motion.div variants={listVariants} initial={prefersReducedMotion ? false : "hidden"} animate="visible" className="space-y-1">
              {filtered.map((p) => {
                const mp = metricPrimary(p, metric);
                const heat = Math.round((mp.intensity / maxIntensity) * 100);
                const isApex = p.rank === 1;
                return (
                  <motion.div key={p.key} variants={itemVariant}>
                    <div className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors duration-150 ${
                      isApex ? 'border-[var(--page-accent)]/30 bg-[var(--page-accent)]/5' : 'border-zinc-800/30 bg-zinc-900/40 hover:bg-zinc-800/40'
                    }`}>
                      {/* Rank with amber heat for top 3 */}
                      <div className={`w-8 shrink-0 text-center font-mono font-bold tabular-nums text-sm ${
                        p.rank <= 3 ? 'text-[var(--page-accent)]' : 'text-zinc-600'
                      }`}>{p.rank}</div>
                      {/* Heat bar — width encodes relative standing */}
                      <div className="w-1.5 self-stretch rounded-full bg-zinc-800 overflow-hidden shrink-0">
                        <div className="w-full rounded-full bg-gradient-to-t from-[var(--page-accent)]/40 to-[var(--page-accent)]"
                          style={{ height: `${Math.max(8, heat)}%` }} />
                      </div>
                      {/* Label */}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate group-hover:text-white transition-colors">{p.label}</div>
                        <div className="text-[11px] text-zinc-500 truncate">{mp.secondary}</div>
                      </div>
                      {/* Primary value */}
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold font-mono tabular-nums">{mp.display}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </>
        );
      })()}
    </div>
  );
}
