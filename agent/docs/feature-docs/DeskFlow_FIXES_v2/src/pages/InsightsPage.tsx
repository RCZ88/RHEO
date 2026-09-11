import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { subDays, format } from 'date-fns';
import type { Period } from '../lib/dateRange';
import { getDateRange } from '../lib/dateRange';
import { BarChart3, Clock, Target, Moon, TrendingUp, TrendingDown, Activity, Zap, Sun, Globe, Monitor, PieChart, AlertTriangle, Info } from 'lucide-react';
import { maxOf, maxBy } from '../utils/safeMath';
import { motion } from 'framer-motion';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

interface ExternalStats {
  byActivity: Record<string, { total_seconds: number; session_count: number }>;
  total_seconds: number;
  sleep_deficit_seconds: number;
  average_sleep_hours: number;
}

interface ConsistencyData {
  score: number;
  weekly_comparison: Array<{ week: string; total_seconds: number }>;
}

interface SleepTrend {
  daily: Array<{ date: string; sleep_seconds: number; deficit_seconds: number }>;
  average_bedtime: string;
  average_wake_time: string;
}

interface ActivityBucket {
  activity: string;
  seconds: number;
  percentage: number;
  color: string;
}

interface HourCell {
  activities: ActivityBucket[];
  totalSeconds: number;
  dominantActivity: string;
  hasExternal: boolean;
  hasDevice: boolean;
}

interface TypicalDayData {
  grid: HourCell[][];
  legend: Array<{ activity: string; color: string; totalSeconds: number }>;
  stats: {
    totalHours: number;
    mostActiveHour: { hour: number; day: number };
    mostActiveDay: number;
    activityBreakdown: Record<string, number>;
  };
  generatedAt: string;
  daysCovered: number;
}

interface AppStat {
  app: string;
  category: string;
  total_ms: number;
  sessions: number;
}

interface InsightsPageProps {
  logs?: any[];
  browserLogs?: any[];
  appStats?: AppStat[];
  selectedPeriod?: Period;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  tierAssignments?: { productive: string[]; neutral: string[]; distracting: string[] };
}

function periodToDays(period: Period): number {
  if (period === 'today') return 7;
  if (period === 'week' || period === '7day') return 7;
  if (period === 'month' || period === '30day') return 30;
  return 365;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_COLORS: Record<string, string> = {
  'IDE': '#6366f1',
  'AI Tools': '#8b5cf6',
  'Browser': '#3b82f6',
  'Entertainment': '#ec4899',
  'Communication': '#14b8a6',
  'Design': '#a855f7',
  'Productivity': '#10b981',
  'Tools': '#f59e0b',
  'Developer Tools': '#10b981',
  'Social Media': '#f97316',
  'News': '#eab308',
  'Shopping': '#ec4899',
  'Education': '#06b6d4',
  'Uncategorized': '#78716c',
  'Other': '#64748b',
};

function resolveActivityColor(name: string): string {
  const saved = localStorage.getItem(`deskflow-category-color-${name}`);
  if (saved) return saved;
  return CATEGORY_COLORS[name] || '#6b7280';
}

const hourLabels = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return '12 AM';
  if (i < 12) return `${i} AM`;
  if (i === 12) return '12 PM';
  return `${i - 12} PM`;
});

export default function InsightsPage({
  logs = [],
  browserLogs = [],
  appStats = [],
  selectedPeriod: parentPeriod = 'week',
  dateOffset = 0,
  onDateOffsetChange,
  tierAssignments = { productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'], neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other', 'Browser'], distracting: ['Entertainment', 'Social Media', 'Shopping'] },
}: InsightsPageProps) {
  const [stats, setStats] = useState<ExternalStats>({ byActivity: {}, total_seconds: 0, sleep_deficit_seconds: 0, average_sleep_hours: 0 });
  const [consistency, setConsistency] = useState<ConsistencyData & { this_week: number; last_week: number; trend: string; streak: number }>({ score: 0, weekly_comparison: [], this_week: 0, last_week: 0, trend: 'stable', streak: 0 });
  const [sleepTrends, setSleepTrends] = useState<SleepTrend>({ daily: [], average_bedtime: '', average_wake_time: '' });
  const [bestDays, setBestDays] = useState<{ bestDay: string; worstDay: string; averages: Record<string, number> }>({ bestDay: 'Mon', worstDay: 'Sun', averages: {} });
  const [typicalDayData, setTypicalDayData] = useState<TypicalDayData | null>(null);
  const [tooltip, setTooltip] = useState<{ day: number; hour: number; x: number; y: number; side: string } | null>(null);
  const [typicalError, setTypicalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'typical' | 'weekly' | 'activities'>('typical');
  const [typicalMode, setTypicalMode] = useState<'smooth' | 'original'>('smooth');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const location = useLocation();
  useEffect(() => {
    const tab = (location.state as any)?.tab;
    if (tab) setActiveTab(tab);
  }, []);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  useEffect(() => {
    const statsPeriod = parentPeriod === 'today' ? 'week' : parentPeriod === '7day' ? 'week' : parentPeriod === '30day' ? 'month' : parentPeriod === 'all' ? 'month' : parentPeriod;
    window.deskflowAPI?.getExternalStats(parentPeriod).then(setStats);
    window.deskflowAPI?.getConsistencyScore(statsPeriod as 'week' | 'month').then(setConsistency);
    window.deskflowAPI?.getSleepTrends(parentPeriod, dateOffset).then(setSleepTrends);
    window.deskflowAPI?.getBestDays().then(setBestDays);
    window.deskflowAPI?.getDailyStats?.(statsPeriod as 'week' | 'month' | 'all').then((data: any) => setDailyStats(Array.isArray(data) ? data : []));
  }, [parentPeriod, dateOffset]);

  useEffect(() => {
    const fetchTypicalDay = () => {
      const days = periodToDays(parentPeriod);
      window.deskflowAPI?.getTypicalDay(days, dateOffset).then((result: any) => {
        if (result?.grid) { setTypicalDayData(result as TypicalDayData); setTypicalError(null); }
        else if (!result) setTypicalError('No data available for this period');
      }).catch((err: any) => setTypicalError(err?.message || 'Failed to load typical day data'));
    };
    fetchTypicalDay();
    const interval = setInterval(fetchTypicalDay, 60000);
    return () => clearInterval(interval);
  }, [parentPeriod, dateOffset]);

  const sleepTrendData = useMemo(() => {
    const labels: string[] = [];
    const sleepData: number[] = [];
    const deficitData: number[] = [];
    if (parentPeriod === 'week' || parentPeriod === '7day') {
      const range = getDateRange(parentPeriod === '7day' ? '7day' : 'week', dateOffset);
      let curr = new Date(range.start);
      while (curr < range.end) {
        labels.push(format(curr, 'MMM d'));
        const dayStr = format(curr, 'yyyy-MM-dd');
        const dayData = sleepTrends.daily.find(d => d.date === dayStr);
        sleepData.push((dayData?.sleep_seconds || 0) / 3600);
        deficitData.push((dayData?.deficit_seconds || 0) / 3600);
        curr.setDate(curr.getDate() + 1);
      }
    } else {
      const days = parentPeriod === 'today' ? 7 : parentPeriod === 'all' ? 90 : 30;
      const offsetDays = dateOffset * (parentPeriod === 'today' ? 1 : parentPeriod === 'all' ? 365 : 30);
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i + offsetDays);
        labels.push(format(date, 'MMM d'));
        const dayStr = format(date, 'yyyy-MM-dd');
        const dayData = sleepTrends.daily.find(d => d.date === dayStr);
        sleepData.push((dayData?.sleep_seconds || 0) / 3600);
        deficitData.push((dayData?.deficit_seconds || 0) / 3600);
      }
    }
    return { labels, sleepData, deficitData };
  }, [sleepTrends, parentPeriod, dateOffset]);

  const weeklyData = useMemo(() => {
    const labels = consistency.weekly_comparison.map(w => w.week.slice(5));
    const data = consistency.weekly_comparison.map(w => w.total_seconds / 3600);
    return { labels, data };
  }, [consistency]);

  const dayOfWeekData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = days.map(d => bestDays.averages[d] || 0);
    const max = maxOf(data, 1);
    return { labels: days, data, max };
  }, [bestDays]);

  const breakdownColors = useMemo(() => {
    const labels = Object.keys(stats.byActivity);
    return labels.map((_, i) => {
      const colors = ['#22c55e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7'];
      return colors[i % colors.length];
    });
  }, [stats]);

  const trend = useMemo(() => {
    if (!consistency.trend) return { icon: Activity, color: 'text-zinc-400', text: 'Stable' };
    if (consistency.trend === 'up') return { icon: TrendingUp, color: 'text-emerald-400', text: 'Improving' };
    if (consistency.trend === 'down') return { icon: TrendingDown, color: 'text-red-400', text: 'Declining' };
    return { icon: Activity, color: 'text-zinc-400', text: 'Stable' };
  }, [consistency]);

  const patchedTypicalDay = useMemo(() => {
    if (!typicalDayData) return null;
    const grid = typicalDayData.grid.map(dayRow =>
      dayRow.map(cell => ({
        ...cell,
        activities: cell.activities.map(a => ({
          ...a,
          color: a.color || resolveActivityColor(a.activity)
        }))
      }))
    );
    const legend = typicalDayData.legend.map(item => ({
      ...item,
      color: item.color || resolveActivityColor(item.activity)
    }));
    return { ...typicalDayData, grid, legend };
  }, [typicalDayData]);

  // --- Original mode: compute actual hourly data from raw logs ---
  interface HourlySlot {
    hour: number;
    primaryActivity: string;
    totalSeconds: number;
    activities: Array<{ name: string; seconds: number; color: string }>;
  }

  const originalDayData = useMemo(() => {
    const dailyHours: Record<string, Record<number, Record<string, number>>> = {};
    const dates = new Set<string>();

    const addToDateHour = (timeStr: string, activity: string, duration: number) => {
      const d = new Date(timeStr);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const hour = d.getHours();
      dates.add(dateKey);
      if (!dailyHours[dateKey]) dailyHours[dateKey] = {};
      if (!dailyHours[dateKey][hour]) dailyHours[dateKey][hour] = {};
      dailyHours[dateKey][hour][activity] = (dailyHours[dateKey][hour][activity] || 0) + duration;
    };

    for (const log of logs) {
      if (log.is_browser_tracking || !log.start_time) continue;
      addToDateHour(log.start_time, log.app || 'Unknown', log.duration || 0);
    }
    for (const log of browserLogs) {
      if (!log.start_time) continue;
      addToDateHour(log.start_time, log.domain || log.app || 'Unknown', log.duration || 0);
    }

    const dayCount = Math.max(dates.size, 1);

    const hourly: Record<number, Record<string, number>> = {};
    for (let h = 0; h < 24; h++) hourly[h] = {};

    for (const dateKey of dates) {
      for (let h = 0; h < 24; h++) {
        const apps = dailyHours[dateKey]?.[h];
        if (!apps) continue;
        for (const [app, secs] of Object.entries(apps)) {
          hourly[h][app] = (hourly[h][app] || 0) + secs;
        }
      }
    }

    const slots: HourlySlot[] = Array.from({ length: 24 }, (_, h) => {
      const entries = Object.entries(hourly[h]).sort((a, b) => b[1] - a[1]);
      const rawSeconds = entries.reduce((s, [, sec]) => s + sec, 0);
      const avgSeconds = Math.round(rawSeconds / dayCount);
      const activities = entries.map(([name, seconds]) => ({
        name,
        seconds: Math.round(seconds / dayCount),
        color: resolveActivityColor(name),
      })).filter(a => a.seconds > 0);
      const totalSeconds = activities.reduce((s, a) => s + a.seconds, 0);
      const primaryActivity = activities[0]?.name || 'none';
      return { hour: h, primaryActivity, totalSeconds, activities };
    });

    const maxSeconds = Math.max(...slots.map(s => s.totalSeconds), 1);
    const topActivities = slots
      .flatMap(s => s.activities)
      .reduce<Record<string, number>>((acc, a) => {
        acc[a.name] = (acc[a.name] || 0) + a.seconds;
        return acc;
      }, {});

    const legend = Object.entries(topActivities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([activity, totalSeconds]) => ({
        activity,
        color: resolveActivityColor(activity),
        totalSeconds,
      }));

    const totalHours = +(slots.reduce((s, slot) => s + slot.totalSeconds, 0) / 3600).toFixed(1);
    const mostActiveHour = slots.reduce((best, slot) => slot.totalSeconds > best.totalSeconds ? slot : best, slots[0]);

    return { slots, maxSeconds, legend, stats: { totalHours, mostActiveHour: { hour: mostActiveHour.hour, day: 0 }, mostActiveDay: 0, activityBreakdown: topActivities }, dayCount };
  }, [logs, browserLogs]);

  const selectedHourData = hoveredHour !== null ? originalDayData.slots.find(s => s.hour === hoveredHour) : null;

  // --- Core tracking data computations (from new props) ---

  const appUsageBreakdown = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const log of logs) {
      if (log.is_browser_tracking) continue;
      const app = log.app || 'Unknown';
      usage[app] = (usage[app] || 0) + (log.duration || 0);
    }
    for (const log of browserLogs) {
      const domain = log.domain || log.app || 'Unknown';
      usage[domain] = (usage[domain] || 0) + (log.duration || 0);
    }
    return Object.entries(usage)
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [logs, browserLogs]);

  const topApps = useMemo(() => {
    return appUsageBreakdown.slice(0, 5);
  }, [appUsageBreakdown]);

  const leastUsedApps = useMemo(() => {
    return appUsageBreakdown.filter(a => a.seconds > 60).slice(-5).reverse();
  }, [appUsageBreakdown]);

  const browserCategoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    for (const log of browserLogs) {
      const cat = log.category || 'Other';
      categories[cat] = (categories[cat] || 0) + ((log.duration || 0) * 1000);
    }
    const sorted = Object.entries(categories)
      .map(([category, total_ms]) => ({ category, total_ms }))
      .sort((a, b) => b.total_ms - a.total_ms);
    const totalBrowserTime = sorted.reduce((s, c) => s + c.total_ms, 0);
    return { data: sorted, totalBrowserTime };
  }, [browserLogs]);

  const tierDistribution = useMemo(() => {
    const tiers = { productive: 0, neutral: 0, distracting: 0 };
    for (const stat of appStats) {
      const cat = stat.category;
      if (tierAssignments.productive.includes(cat)) tiers.productive += stat.total_ms;
      else if (tierAssignments.distracting.includes(cat)) tiers.distracting += stat.total_ms;
      else tiers.neutral += stat.total_ms;
    }
    for (const log of browserLogs) {
      const cat = log.category || 'Other';
      const ms = (log.duration || 0) * 1000;
      if (tierAssignments.productive.includes(cat)) tiers.productive += ms;
      else if (tierAssignments.distracting.includes(cat)) tiers.distracting += ms;
      else tiers.neutral += ms;
    }
    const total = tiers.productive + tiers.neutral + tiers.distracting;
    const weighted = tiers.productive + (tiers.neutral * 0.5);
    const score = total > 0 ? (weighted / total) * 100 : 0;
    return { ...tiers, total, score };
  }, [appStats, browserLogs, tierAssignments]);

  const timeSplit = useMemo(() => {
    const deviceSec = logs.reduce((s, l) => s + (l.duration || 0), 0) +
      browserLogs.reduce((s, l) => s + (l.duration || 0), 0);
    const externalSec = stats.total_seconds;
    return { deviceSec, externalSec, total: deviceSec + externalSec };
  }, [logs, browserLogs, stats.total_seconds]);

  const dailyTrend = useMemo(() => {
    if (!dailyStats?.length) return { labels: [], values: [] };
    const dayTotals: Record<string, number> = {};
    for (const stat of dailyStats) {
      const day = stat.day || stat.date;
      if (!day) continue;
      dayTotals[day] = (dayTotals[day] || 0) + (stat.total_sec || stat.total_ms / 1000 || 0);
    }
    const sorted = Object.keys(dayTotals).sort();
    return {
      labels: sorted.map(d => { try { return format(new Date(d + 'T00:00:00'), 'MMM d'); } catch { return d; } }),
      values: sorted.map(d => +(dayTotals[d] / 3600).toFixed(2)),
    };
  }, [dailyStats]);

  const activityCategoryDist = useMemo(() => {
    if (!appStats?.length) return { labels: [], values: [] };
    const totals: Record<string, number> = {};
    for (const stat of appStats) {
      const cat = stat.category || 'Other';
      totals[cat] = (totals[cat] || 0) + (stat.total_ms || 0);
    }
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(e => e[0]), values: entries.map(e => Math.round(e[1] / 3600000 * 100) / 100) };
  }, [appStats]);

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(24, 24, 27, 0.95)', titleColor: '#e4e4e7', bodyColor: '#a1a1aa', borderColor: 'rgba(63, 63, 70, 0.5)', borderWidth: 1, cornerRadius: 8, padding: 10 } },
    scales: {
      x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { color: 'rgba(113,113,122,0.08)' }, border: { color: 'rgba(113,113,122,0.15)' } },
      y: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { color: 'rgba(113,113,122,0.08)' }, border: { color: 'rgba(113,113,122,0.15)' }, title: { display: true, text: 'Hours', color: '#71717a', font: { size: 10 } } },
    },
  };

  const chartColors = ['rgba(168, 85, 247, 0.8)', 'rgba(34, 211, 238, 0.8)', 'rgba(52, 211, 153, 0.8)', 'rgba(251, 113, 133, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(96, 165, 250, 0.8)', 'rgba(129, 140, 248, 0.8)', 'rgba(251, 146, 60, 0.8)'];

  return (
    <PageShell page="insights" variant="sticky-header" className="bg-[#0a0a0f]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Insights</h1>
            <p className="text-xs text-zinc-500">Deep dive into your productivity patterns</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-700/50">
            {(['typical', 'weekly', 'activities'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 ${
                  activeTab === tab
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {tab === 'typical' ? 'Day' : tab === 'weekly' ? 'Weekly' : 'Activity'}
              </button>
            ))}
          </div>
          <div className="text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5">
            {dateOffset === 0
              ? parentPeriod === 'today' ? 'Today' : parentPeriod === 'week' ? 'This Week' : parentPeriod === '7day' ? 'Last 7 Days' : parentPeriod === 'month' ? 'This Month' : parentPeriod === '30day' ? 'Last 30 Days' : 'All Time'
              : `${parentPeriod.charAt(0).toUpperCase() + parentPeriod.slice(1)} -${dateOffset}`}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative">
        <div className="p-5 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-5 gap-4"
        >
          {[
            { icon: Clock, label: 'Total Time', value: formatHours(stats.total_seconds), color: 'text-emerald-400', bg: 'bg-emerald-500/10', sub: `${Object.keys(stats.byActivity).length} activities` },
            { icon: Target, label: 'Consistency', value: `${consistency.score}%`, color: consistency.score >= 70 ? 'text-emerald-400' : consistency.score >= 40 ? 'text-amber-400' : 'text-red-400', bg: 'bg-zinc-800/60', sub: trend.text, subIcon: trend.icon },
            { icon: Zap, label: 'Streak', value: `🔥 ${consistency.streak}w`, color: 'text-amber-400', bg: 'bg-zinc-800/60', sub: `${formatHours(consistency.this_week || 0)} this week` },
            { icon: Sun, label: 'Best Day', value: bestDays.bestDay, color: 'text-emerald-400', bg: 'bg-zinc-800/60', sub: `Worst: ${bestDays.worstDay}` },
            { icon: Moon, label: 'Sleep Deficit', value: stats.sleep_deficit_seconds < 0 ? '-' + formatHours(Math.abs(stats.sleep_deficit_seconds)) : formatHours(stats.sleep_deficit_seconds), color: stats.sleep_deficit_seconds < 0 ? 'text-red-400' : stats.sleep_deficit_seconds > 0 ? 'text-emerald-400' : 'text-zinc-400', bg: 'bg-zinc-800/60', sub: `${stats.average_sleep_hours?.toFixed(1) || '?'}h avg` },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/0 to-zinc-800/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-4 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/3 to-transparent rounded-bl-full" />
                <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
                  <card.icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium tracking-wide uppercase">{card.label}</span>
                </div>
                <div className={`text-xl font-bold ${card.color} tracking-tight`}>{card.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {'subIcon' in card && card.subIcon ? <card.subIcon className="w-3 h-3 text-zinc-500" /> : null}
                  <span className="text-[11px] text-zinc-600">{card.sub}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {activeTab === 'typical' && (
          <motion.div
            data-section="insights.day"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <SectionHeader
                title="Typical Day"
                action={typicalDayData && typicalMode === 'original' && <div className="text-xs text-zinc-600">Updated {new Date(typicalDayData.generatedAt).toLocaleTimeString()}</div>}
              />
              <div className="flex bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-700/50 ml-4">
                <button
                  onClick={() => setTypicalMode('original')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 ${
                    typicalMode === 'original'
                      ? 'bg-pink-500/15 text-pink-300 border border-pink-500/20'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => setTypicalMode('smooth')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 ${
                    typicalMode === 'smooth'
                      ? 'bg-pink-500/15 text-pink-300 border border-pink-500/20'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  Smooth
                </button>
              </div>
            </div>

            {typicalMode === 'original' && typicalDayData && (
              <p className="text-xs text-zinc-500 mt-0.5 mb-4">
                Multi-activity composition across {typicalDayData.daysCovered} days — each cell shows gradient splits per activity
                {parentPeriod === 'today' && <span className="text-zinc-600"> — minimum 7 days needed for pattern</span>}
              </p>
            )}
            {typicalMode === 'smooth' && (
              <p className="text-xs text-zinc-500 mt-0.5 mb-4">
                Daily average across {originalDayData.dayCount} tracked days — single-color intensity per hour, hover for details
              </p>
            )}

            {/* --- ORIGINAL MODE: 7-day × 24-hour multi-activity heatmap --- */}
            {typicalMode === 'original' && patchedTypicalDay ? (() => {
              const data = patchedTypicalDay;

              const fmt = (s: number) => {
                if (s < 60) return `${s}s`;
                if (s < 3600) return `${Math.round(s / 60)}m`;
                return `${(s / 3600).toFixed(1)}h`;
              };

              const cellBg = (cell: HourCell) => {
                if (cell.activities.length === 0) return 'rgba(39, 39, 42, 0.5)';
                if (cell.activities.length === 1) {
                  const secs = cell.totalSeconds;
                  if (secs >= 2700) return 'rgba(16, 185, 129, 0.9)';
                  if (secs >= 1200) return 'rgba(16, 185, 129, 0.6)';
                  if (secs >= 300) return 'rgba(16, 185, 129, 0.35)';
                  return 'rgba(16, 185, 129, 0.15)';
                }
                const segments = cell.activities.map((a, i) => {
                  const start = cell.activities.slice(0, i).reduce((s, x) => s + x.percentage, 0);
                  return `${a.color} ${start}% ${start + a.percentage}%`;
                });
                return `linear-gradient(90deg, ${segments.join(', ')})`;
              };

              const consistencyMap: { day: number; hour: number; score: number }[] = [];
              let totalConsistency = 0;
              let countConsistency = 0;
              for (let d = 0; d < data.grid.length; d++) {
                for (let h = 0; h < data.grid[d].length; h++) {
                  const c = data.grid[d][h];
                  const score = c.activities[0]?.percentage ?? 0;
                  consistencyMap.push({ day: d, hour: h, score });
                  if (c.totalSeconds > 0) { totalConsistency += score; countConsistency++; }
                }
              }
              const avgConsistency = countConsistency > 0 ? Math.round(totalConsistency / countConsistency) : 0;

              const consistencyColor = (score: number) => {
                if (score >= 80) return 'bg-emerald-400';
                if (score >= 60) return 'bg-emerald-500';
                if (score >= 40) return 'bg-amber-500';
                if (score >= 20) return 'bg-orange-500';
                return 'bg-red-500';
              };

              const gridVariants = {
                hidden: {},
                visible: { transition: { staggerChildren: 0.015 } }
              };
              const rowVariants = {
                hidden: { opacity: 0, x: -8 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } }
              };

              return (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <GlassCard variant="compact" accent="pink">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Total Hours</div>
                      <div className="text-xl font-bold text-zinc-100 mt-0.5">{data.stats.totalHours}h</div>
                      <div className="text-[10px] text-zinc-600">avg per day</div>
                    </GlassCard>
                    <GlassCard variant="compact" accent="pink">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Most Active</div>
                      <div className="text-xl font-bold text-zinc-100 mt-0.5">{DAY_LABELS[data.stats.mostActiveDay]}</div>
                      <div className="text-[10px] text-zinc-600">day of week</div>
                    </GlassCard>
                    <GlassCard variant="compact" accent="pink">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Peak Hour</div>
                      <div className="text-xl font-bold text-zinc-100 mt-0.5">{hourLabels[data.stats.mostActiveHour.hour]}</div>
                      <div className="text-[10px] text-zinc-600">{DAY_LABELS[data.stats.mostActiveHour.day]}</div>
                    </GlassCard>
                  </div>

                  {/* Schedule consistency summary */}
                  <div className="flex items-center gap-4 mb-3 px-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-[11px] text-zinc-400">
                        Schedule Consistency: <span className="text-zinc-200 font-semibold">{avgConsistency}%</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                      <span className="inline-block w-2 h-2 rounded-sm bg-red-500" /><span>low</span>
                      <span className="inline-block w-2 h-2 rounded-sm bg-amber-500" /><span>med</span>
                      <span className="inline-block w-2 h-2 rounded-sm bg-emerald-400" /><span>high</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    {/* Hour labels */}
                    <div className="flex ml-7 mb-0.5 gap-0">
                      {hourLabels.map((l, i) => (
                        <div key={i} className="flex-1 text-[9px] text-zinc-600 text-center leading-none pb-0.5" style={{ visibility: i % 6 === 0 ? 'visible' : 'hidden' }}>
                          {l}
                        </div>
                      ))}
                    </div>

                    {/* 7-day × 24-hour grid */}
                    <motion.div className="space-y-0" variants={gridVariants} initial="hidden" animate="visible">
                      {data.grid.map((dayData, dayIdx) => (
                        <motion.div key={dayIdx} className="flex items-center" variants={rowVariants}>
                          <div className="w-7 text-[10px] text-zinc-500 text-right pr-1 flex-shrink-0 leading-none">{DAY_LABELS[dayIdx]}</div>
                          <div className="flex flex-1 gap-0">
                            {dayData.map((cell, hourIdx) => {
                              const cons = consistencyMap.find(c => c.day === dayIdx && c.hour === hourIdx);
                              const consScore = cons?.score ?? 0;
                              const dominantActivity = cell.activities[0]?.activity || '';
                              return (
                                <div
                                  key={hourIdx}
                                  onMouseEnter={(e) => {
                                    const tipW = 220, tipH = 180, gap = 4, pad = 8;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    let tx = rect.left, ty = rect.bottom + gap;
                                    if (ty + tipH > window.innerHeight - pad) ty = rect.top - tipH - gap;
                                    if (tx + tipW > window.innerWidth - pad) tx = rect.right - tipW;
                                    tx = Math.max(pad, Math.min(tx, window.innerWidth - tipW - pad));
                                    ty = Math.max(pad, Math.min(ty, window.innerHeight - tipH - pad));
                                    setTooltip({ day: dayIdx, hour: hourIdx, x: tx, y: ty, side: 'bottom' });
                                  }}
                                  onMouseLeave={() => setTooltip(null)}
                                  className="flex-1 min-h-[32px] cursor-pointer transition-all duration-150 hover:brightness-125 hover:z-10 hover:ring-1 hover:ring-pink-400/40 hover:scale-[1.02] relative flex items-center justify-center"
                                  style={{
                                    background: cellBg(cell),
                                    borderRight: '1px solid rgba(39,39,42,0.3)',
                                    borderBottom: '1px solid rgba(39,39,42,0.3)',
                                    outline: tooltip?.day === dayIdx && tooltip?.hour === hourIdx ? '1.5px solid rgba(236,72,153,0.5)' : 'none',
                                    outlineOffset: '-1px',
                                  }}
                                >
                                  {dominantActivity && (
                                    <span
                                      className="text-[8px] font-medium truncate px-0.5 leading-none"
                                      style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.5)', maxWidth: '100%' }}
                                      title={dominantActivity}
                                    >
                                      {dominantActivity.length > 8 ? dominantActivity.slice(0, 8) + '…' : dominantActivity}
                                    </span>
                                  )}
                                  <div className="absolute bottom-0 left-0 right-0 h-[3px]">
                                    <div className={`h-full ${consistencyColor(consScore)} transition-opacity`} style={{ width: `${consScore}%`, opacity: 0.8 }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>

                  {/* Rich hover tooltip */}
                    {tooltip && data.grid[tooltip.day]?.[tooltip.hour] && (() => {
                    const activeCell = data.grid[tooltip.day][tooltip.hour];
                    const activeCons = consistencyMap.find(c => c.day === tooltip.day && c.hour === tooltip.hour)?.score ?? 0;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed z-50 bg-zinc-900/95 border border-zinc-700 rounded-lg p-3 min-w-[200px] backdrop-blur-sm"
                        style={{ left: tooltip.x, top: tooltip.y }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-zinc-200">{DAY_LABELS[tooltip.day]} {hourLabels[tooltip.hour]}</span>
                          <span className={`text-[10px] font-medium ${activeCons >= 60 ? 'text-emerald-400' : activeCons >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                            {activeCons}% consistent
                          </span>
                        </div>
                        <div className="space-y-1">
                          {activeCell.activities.map((a, i) => (
                            <div key={i} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: a.color }} />
                                <span className="text-[11px] text-zinc-300 truncate">{a.activity}</span>
                              </div>
                              <span className="text-[11px] text-zinc-400 flex-shrink-0">{fmt(a.seconds)} ({a.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-zinc-800 flex justify-between">
                          <span className="text-[10px] text-zinc-500">Total</span>
                          <span className="text-[10px] text-zinc-400">{fmt(activeCell.totalSeconds)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {activeCell.hasExternal && <span className="text-[9px] px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded">External</span>}
                          {activeCell.hasDevice && <span className="text-[9px] px-1 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">Device</span>}
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* Legend */}
                  {data.legend.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      {data.legend.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-[11px] text-zinc-400">{item.activity}</span>
                          <span className="text-[10px] text-zinc-600">{fmt(item.totalSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Intensity legend */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600">Less</span>
                    {['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.35)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.9)'].map((c, i) => (
                      <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: c }} />
                    ))}
                    <span className="text-[10px] text-zinc-600">More</span>
                  </div>
                </>
              );
            })() : (
              typicalMode === 'original' && (
                typicalError ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                    <p className="text-sm text-zinc-400 font-medium">Could not load typical day data</p>
                    <p className="text-xs text-zinc-600 text-center max-w-xs">{typicalError}</p>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center">
                    <div className="animate-pulse">
                      <div className="h-4 bg-zinc-800 rounded w-40 mb-3" />
                      <div className="h-24 bg-zinc-800 rounded" />
                    </div>
                  </div>
                )
              )
            )}

            {/* --- SMOOTH MODE: single-day simple heatmap --- */}
            {typicalMode === 'smooth' && (() => {
              const { slots, maxSeconds, legend, stats: dayStats } = originalDayData;

              const getHeatColor = (seconds: number, max: number): string => {
                if (seconds === 0) return 'bg-zinc-800/30';
                const ratio = seconds / max;
                if (ratio > 0.75) return 'bg-emerald-500/90';
                if (ratio > 0.5) return 'bg-emerald-500/65';
                if (ratio > 0.25) return 'bg-emerald-500/40';
                return 'bg-emerald-500/20';
              };

              const getGradient = (activity: string): string => {
                const gradients: Record<string, string> = {
                  'code': 'from-emerald-500 to-emerald-600', 'coding': 'from-emerald-500 to-emerald-600',
                  'browser': 'from-sky-500 to-sky-600', 'chrome': 'from-sky-500 to-sky-600',
                  'terminal': 'from-violet-500 to-violet-600', 'discord': 'from-indigo-500 to-indigo-600',
                  'slack': 'from-purple-500 to-purple-600', 'figma': 'from-pink-500 to-pink-600',
                  'vscode': 'from-emerald-500 to-emerald-600', 'notion': 'from-zinc-400 to-zinc-500',
                  'excel': 'from-green-500 to-green-600', 'word': 'from-blue-500 to-blue-600',
                };
                const key = Object.keys(gradients).find(k => activity.toLowerCase().includes(k));
                return key ? gradients[key] : 'from-teal-500 to-teal-600';
              };

              const hasData = slots.some(s => s.totalSeconds > 0);

              if (!hasData) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Clock className="w-10 h-10 text-zinc-600" />
                    <p className="text-sm text-zinc-400 font-medium">No tracking data yet</p>
                    <p className="text-xs text-zinc-600 text-center max-w-xs">Track some activity today to see your hourly patterns here</p>
                  </div>
                );
              }

              return (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <GlassCard variant="compact" accent="pink">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Total Hours</div>
                      <div className="text-xl font-bold text-zinc-100 mt-0.5">{dayStats.totalHours}h</div>
                      <div className="text-[10px] text-zinc-600">avg / day</div>
                    </GlassCard>
                    <GlassCard variant="compact" accent="pink">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Peak Hour</div>
                      <div className="text-xl font-bold text-zinc-100 mt-0.5">{hourLabels[dayStats.mostActiveHour.hour]}</div>
                      <div className="text-[10px] text-zinc-600">{formatHours(slots[dayStats.mostActiveHour.hour]?.totalSeconds || 0)}</div>
                    </GlassCard>
                    <GlassCard variant="compact" accent="pink">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Activities</div>
                      <div className="text-xl font-bold text-zinc-100 mt-0.5">{Object.keys(dayStats.activityBreakdown).length}</div>
                      <div className="text-[10px] text-zinc-600">unique / day</div>
                    </GlassCard>
                  </div>

                  <div className="flex gap-4">
                    {/* Heatmap grid */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-7" />
                        <div className="flex flex-1 gap-[3px]">
                          {Array.from({ length: 24 }).map((_, h) => (
                            <div key={h} className="flex-1 text-[9px] text-zinc-600 text-center leading-none" style={{ visibility: h % 3 === 0 ? 'visible' : 'hidden' }}>
                              {hourLabels[h]}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-7 text-[10px] text-zinc-500 text-right pr-1 flex-shrink-0">Today</div>
                        <div className="flex flex-1 gap-[3px]">
                          {slots.map((slot) => (
                            <div
                              key={slot.hour}
                              onMouseEnter={() => setHoveredHour(slot.hour)}
                              onMouseLeave={() => setHoveredHour(null)}
                              className={`w-[22px] h-[22px] rounded-sm cursor-pointer transition-all duration-150 ${
                                getHeatColor(slot.totalSeconds, maxSeconds)
                              } ${
                                hoveredHour === slot.hour ? 'ring-2 ring-emerald-400/60 scale-110 z-10 relative' : ''
                              }`}
                              title={`${slot.hour}:00 - ${slot.totalSeconds > 0 ? formatHours(slot.totalSeconds) : 'No activity'}${slot.primaryActivity && slot.primaryActivity !== 'none' ? ` - ${slot.primaryActivity}` : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Detail panel */}
                    {selectedHourData && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-52 flex-shrink-0 bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/40"
                      >
                        <div className="text-xs text-zinc-400 mb-1">{selectedHourData.hour}:00 — {(selectedHourData.hour + 1) % 24 || 24}:00</div>
                        <div className="text-lg font-bold text-zinc-200">{formatHours(selectedHourData.totalSeconds)}</div>
                        {selectedHourData.activities.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {selectedHourData.activities.slice(0, 5).map((a, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: a.color }} />
                                  <span className="text-[11px] text-zinc-300 truncate">{a.name}</span>
                                </div>
                                <span className="text-[10px] text-zinc-500 flex-shrink-0">{formatHours(a.seconds)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-600 mt-1">No activity</div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Activity chips */}
                  <div className="flex items-start gap-6 mt-5 pt-4 border-t border-zinc-800/50">
                    <div className="flex-1">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Hourly Breakdown</div>
                      <div className="flex flex-wrap gap-2">
                        {slots.filter(s => s.primaryActivity !== 'none' && s.totalSeconds > 0).map((slot) => (
                          <div
                            key={slot.hour}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                              hoveredHour === slot.hour
                                ? 'bg-zinc-700/60 ring-1 ring-emerald-400/30'
                                : 'bg-zinc-800/40 hover:bg-zinc-700/30'
                            }`}
                            onMouseEnter={() => setHoveredHour(slot.hour)}
                            onMouseLeave={() => setHoveredHour(null)}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${getGradient(slot.primaryActivity)}`} />
                            <span className="text-zinc-300 font-medium">{slot.hour}:00</span>
                            <span className="text-zinc-500">-</span>
                            <span className="text-zinc-400">{slot.primaryActivity.length > 14 ? slot.primaryActivity.slice(0, 14) + '…' : slot.primaryActivity}</span>
                            <span className="text-zinc-600 ml-auto">{formatHours(slot.totalSeconds)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  {legend.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-zinc-800/30">
                      {legend.map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-[11px] text-zinc-400">{item.activity}</span>
                          <span className="text-[10px] text-zinc-600">{formatHours(item.totalSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Intensity legend */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600">Less</span>
                    {['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.35)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.9)'].map((c, i) => (
                      <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: c }} />
                    ))}
                    <span className="text-[10px] text-zinc-600">More</span>
                  </div>
                </>
              );
            })()}
          </GlassCard>
          </motion.div>
        )}

        {activeTab === 'weekly' && (
          <motion.div
            data-section="insights.weekly"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Weekly hours + Day score row */}
            <div className="grid grid-cols-2 gap-6">
              <GlassCard>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1">Hours Per Week</h3>
                <p className="text-xs text-zinc-500 mb-4">Total active hours tracked per week. The dashed line shows your 30h target.</p>
                <div className="h-56">
                  {weeklyData.labels.length > 0 ? (
                    <Line
                      data={{
                        labels: weeklyData.labels,
                        datasets: [{
                          label: 'Hours',
                          data: weeklyData.data,
                          borderColor: '#22c55e',
                          backgroundColor: (ctx) => {
                            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
                            g.addColorStop(0, '#22c55e40');
                            g.addColorStop(1, '#22c55e00');
                            return g;
                          },
                          fill: true,
                          tension: 0.4,
                          pointRadius: 3,
                          pointHoverRadius: 5,
                          pointBackgroundColor: '#22c55e',
                          pointHoverBackgroundColor: '#34d399',
                        }, {
                          label: 'Target (30h)',
                          data: weeklyData.data.map(() => 30),
                          borderColor: '#6366f1',
                          borderDash: [6, 4],
                          pointRadius: 0,
                          fill: false,
                          borderWidth: 1.5,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { intersect: false, mode: 'index' },
                        plugins: {
                          legend: { display: true, labels: { color: '#a1a1aa', usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } },
                          tooltip: {
                            backgroundColor: '#18181b',
                            borderColor: '#3f3f46',
                            borderWidth: 1,
                            titleColor: '#e4e4e7',
                            bodyColor: '#a1a1aa',
                            padding: 10,
                            cornerRadius: 8,
                          }
                        },
                        scales: {
                          x: { grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 10 } } },
                          y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 10 } }, suggestedMax: 40 },
                        }
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 text-sm">No data yet</div>
                  )}
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="text-sm font-semibold text-zinc-200 mb-1">Day of Week Performance</h3>
                <p className="text-xs text-zinc-500 mb-4">Average active hours per day of the week. Higher bars show your most productive days.</p>
                <div className="h-56">
                  <Bar
                    data={{
                      labels: dayOfWeekData.labels,
                      datasets: [{
                        label: 'Hours',
                        data: dayOfWeekData.data,
                        backgroundColor: dayOfWeekData.labels.map((_, i) => {
                          const colors = ['#22c55e60', '#0ea5e960', '#8b5cf660', '#f59e0b60', '#ec489960', '#6366f160', '#14b8a660'];
                          return colors[i % colors.length];
                        }),
                        borderColor: dayOfWeekData.labels.map((_, i) => {
                          const colors = ['#22c55e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];
                          return colors[i % colors.length];
                        }),
                        borderWidth: 1.5,
                        borderRadius: 4,
                        borderSkipped: false,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: '#18181b',
                          borderColor: '#3f3f46',
                          borderWidth: 1,
                          titleColor: '#e4e4e7',
                          bodyColor: '#a1a1aa',
                          padding: 10,
                          cornerRadius: 8,
                          callbacks: {
                            label: (ctx) => `${parseFloat(ctx.raw as string).toFixed(1)}h`,
                          }
                        }
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 11 } } },
                        y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 10 } } },
                      }
                    }}
                  />
                </div>
              </GlassCard>
            </div>

            {/* Core tracking data row: Top apps + Browser categories */}
            <div className="grid grid-cols-2 gap-6">
              <GlassCard>
                <SectionHeader title="Most Used" icon={<Monitor className="w-5 h-5" />} />
                <p className="text-xs text-zinc-500 mb-3">Top apps and websites by time spent</p>
                {topApps.length > 0 ? (
                  <div className="space-y-2">
                    {topApps.map((app, i) => {
                      const maxSec = topApps[0]?.seconds || 1;
                      const pct = (app.seconds / maxSec) * 100;
                      const catColor = CATEGORY_COLORS[app.name] || '#6366f1';
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-500 w-5 text-right">{i + 1}</span>
                          <div className="flex-1 h-5 bg-zinc-800/60 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: catColor + '88' }}
                            />
                          </div>
                          <span className="text-xs text-zinc-300 w-24 truncate text-right">{app.name}</span>
                          <span className="text-[11px] text-zinc-500 w-14 text-right">{formatDuration(app.seconds)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600 py-4 text-center">No app data available</div>
                )}
              </GlassCard>

              <GlassCard>
                <SectionHeader title="Browser Activity" icon={<Globe className="w-5 h-5" />} />
                <p className="text-xs text-zinc-500 mb-3">Website categories by time spent</p>
                {browserCategoryData.data.length > 0 ? (
                  <div className="space-y-2">
                    {browserCategoryData.data.slice(0, 6).map((cat, i) => {
                      const maxMs = browserCategoryData.data[0]?.total_ms || 1;
                      const widthPct = (cat.total_ms / maxMs) * 100;
                      const catColor = CATEGORY_COLORS[cat.category] || '#64748b';
                      const hours = cat.total_ms / 3600000;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                          <span className="text-xs text-zinc-300 w-24 truncate">{cat.category}</span>
                          <div className="flex-1 h-4 bg-zinc-800/60 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: catColor + '88' }}
                            />
                          </div>
                          <span className="text-[11px] text-zinc-500 w-12 text-right">{hours.toFixed(1)}h</span>
                        </div>
                      );
                    })}
                    <div className="text-[10px] text-zinc-600 pt-1 text-right">
                      {browserCategoryData.totalBrowserTime > 0
                        ? `${browserCategoryData.data.length} categories`
                        : 'No browser data'}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600 py-4 text-center">No browser data available</div>
                )}
              </GlassCard>
            </div>

            {/* Sleep + Time Split row */}
            <div className="grid grid-cols-2 gap-6">
              <GlassCard>
                <h3 className="text-sm font-semibold text-zinc-200 mb-4">Sleep & Recovery</h3>
                <div className="h-48">
                  {sleepTrendData.labels.length > 0 ? (
                    <Bar
                      data={{
                        labels: sleepTrendData.labels,
                        datasets: [
                          {
                            label: 'Sleep (h)',
                            data: sleepTrendData.sleepData,
                            backgroundColor: '#6366f160',
                            borderColor: '#6366f1',
                            borderWidth: 1,
                            borderRadius: 3,
                            borderSkipped: false,
                            order: 2,
                          },
                          {
                            label: 'Deficit (h)',
                            data: sleepTrendData.deficitData,
                            backgroundColor: '#f43f5e40',
                            borderColor: '#f43f5e',
                            borderWidth: 1,
                            borderRadius: 3,
                            borderSkipped: false,
                            order: 1,
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: true, labels: { color: '#a1a1aa', usePointStyle: true, pointStyle: 'rectRounded', padding: 12, font: { size: 11 } } },
                          tooltip: {
                            backgroundColor: '#18181b',
                            borderColor: '#3f3f46',
                            borderWidth: 1,
                            titleColor: '#e4e4e7',
                            bodyColor: '#a1a1aa',
                            padding: 10,
                            cornerRadius: 8,
                          }
                        },
                        scales: {
                          x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 10 } } },
                          y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 10 } }, beginAtZero: true },
                        }
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 text-sm">No sleep data yet</div>
                  )}
                </div>
                {(sleepTrends.average_bedtime || sleepTrends.average_wake_time) && (
                  <div className="flex gap-6 mt-4 pt-3 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Avg Bedtime</span>
                      <span className="text-sm font-medium text-zinc-300">{sleepTrends.average_bedtime || '--'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Avg Wake</span>
                      <span className="text-sm font-medium text-zinc-300">{sleepTrends.average_wake_time || '--'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Avg Sleep</span>
                      <span className="text-sm font-medium text-zinc-300">{stats.average_sleep_hours?.toFixed(1) || '--'}h</span>
                    </div>
                  </div>
                )}
              </GlassCard>

              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Time Distribution</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Device vs external activity split</p>
                  </div>
                </div>

                {timeSplit.total > 0 ? (
                  <>
                    {/* Animated split bar with glass texture */}
                    <div className="relative mb-6">
                      <div className="flex h-11 rounded-xl overflow-hidden bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/40 shadow-inner">
                        <motion.div
          key={`device-${timeSplit.deviceSec}`}
          initial={{ width: 0 }}
          animate={{ width: `${timeSplit.total > 0 ? (timeSplit.deviceSec / timeSplit.total) * 100 : 0}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex items-center justify-center relative overflow-hidden"
        >
                          <div className="absolute inset-0 bg-gradient-to-r from-teal-600/90 to-teal-500/80" />
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.03)_8px,rgba(255,255,255,0.03)_16px)]" />
                          {timeSplit.deviceSec / timeSplit.total > 0.12 && (
                            <span className="relative text-xs font-bold text-white drop-shadow-sm">
                              {Math.round((timeSplit.deviceSec / timeSplit.total) * 100)}%
                            </span>
                          )}
                        </motion.div>
                        <motion.div
          key={`external-${timeSplit.externalSec}`}
          initial={{ width: 0 }}
          animate={{ width: `${timeSplit.total > 0 ? (timeSplit.externalSec / timeSplit.total) * 100 : 0}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          className="flex items-center justify-center relative overflow-hidden"
        >
                          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/90 to-violet-500/80" />
                          <div className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(255,255,255,0.03)_8px,rgba(255,255,255,0.03)_16px)]" />
                          {timeSplit.externalSec / timeSplit.total > 0.12 && (
                            <span className="relative text-xs font-bold text-white drop-shadow-sm">
                              {Math.round((timeSplit.externalSec / timeSplit.total) * 100)}%
                            </span>
                          )}
                        </motion.div>
                      </div>
                      <div className="flex items-center justify-center gap-5 mt-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.3)]" />
                          <span className="text-[11px] text-zinc-500">Device</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.3)]" />
                          <span className="text-[11px] text-zinc-500">External</span>
                        </div>
                      </div>
                    </div>

                    {/* Glass stat cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative group"
        >
                          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="relative bg-zinc-900/40 backdrop-blur-xl rounded-xl p-4 border border-zinc-800/40 hover:border-teal-500/20 transition-colors duration-300">
                            <div className="flex items-center gap-2.5 mb-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500/15 to-teal-500/5 border border-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/5">
                                <Monitor className="w-4 h-4 text-teal-300" />
                              </div>
                              <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">Device Time</span>
                            </div>
                            <div className="text-2xl font-bold text-teal-200 tabular-nums tracking-tight">
                              {formatHours(timeSplit.deviceSec)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="h-1 flex-1 bg-zinc-800/60 rounded-full overflow-hidden">
                                <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
          style={{ width: `${timeSplit.total > 0 ? (timeSplit.deviceSec / timeSplit.total) * 100 : 0}%` }}
        />
                              </div>
                              <span className="text-[10px] text-zinc-600 tabular-nums">
                                {timeSplit.total > 0 ? Math.round((timeSplit.deviceSec / timeSplit.total) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                        </motion.div>

                      <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative group"
        >
                          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          <div className="relative bg-zinc-900/40 backdrop-blur-xl rounded-xl p-4 border border-zinc-800/40 hover:border-violet-500/20 transition-colors duration-300">
                            <div className="flex items-center gap-2.5 mb-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/15 to-violet-500/5 border border-violet-500/20 flex items-center justify-center shadow-lg shadow-violet-500/5">
                                <Globe className="w-4 h-4 text-violet-300" />
                              </div>
                              <span className="text-[11px] text-zinc-400 font-medium tracking-wide uppercase">External Time</span>
                            </div>
                            <div className="text-2xl font-bold text-violet-200 tabular-nums tracking-tight">
                              {formatHours(timeSplit.externalSec)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="h-1 flex-1 bg-zinc-800/60 rounded-full overflow-hidden">
                                <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
          style={{ width: `${timeSplit.total > 0 ? (timeSplit.externalSec / timeSplit.total) * 100 : 0}%` }}
        />
                              </div>
                              <span className="text-[10px] text-zinc-600 tabular-nums">
                                {timeSplit.total > 0 ? Math.round((timeSplit.externalSec / timeSplit.total) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                        </motion.div>
                    </div>

                    {/* Productivity breakdown with circular gauge */}
                    <div className="border-t border-zinc-700/30 pt-5">
                      <div className="flex items-center justify-center gap-8 mb-4">
                        {/* Circular gauge */}
                        <div className="relative" style={{ width: 110, height: 110 }}>
                          <svg width={110} height={110} className="transform -rotate-90">
                            <defs>
                              <linearGradient id="scoreGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f43f5e" />
                                <stop offset="50%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#10b981" />
                              </linearGradient>
                            </defs>
                            <circle cx={55} cy={55} r={47} stroke="rgba(39,39,42,0.6)" strokeWidth={8} fill="none" />
                            <motion.circle
          key={`gauge-${Math.round(tierDistribution.score)}`}
          cx={55} cy={55} r={47}
          stroke="url(#scoreGaugeGrad)"
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={295.31}
          initial={{ strokeDashoffset: 295.31 }}
          animate={{ strokeDashoffset: 295.31 - (tierDistribution.score / 100) * 295.31 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-xl font-bold ${tierDistribution.score >= 70 ? 'text-emerald-300' : tierDistribution.score >= 40 ? 'text-amber-300' : 'text-rose-300'}`}>
                              {Math.round(tierDistribution.score)}%
                            </span>
                            <span className="text-[9px] text-zinc-600 mt-0.5">score</span>
                          </div>
                        </div>

                        {/* Tier list */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.3)]" />
                            <span className="text-xs text-zinc-400 w-20">Productive</span>
                            <span className="text-xs font-medium text-emerald-300 tabular-nums w-14 text-right">
                              {formatDuration(tierDistribution.productive / 1000)}
                            </span>
                            <span className="text-[10px] text-zinc-600 w-8 text-right">
                              {tierDistribution.total > 0 ? Math.round((tierDistribution.productive / tierDistribution.total) * 100) : 0}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.3)]" />
                            <span className="text-xs text-zinc-400 w-20">Neutral</span>
                            <span className="text-xs font-medium text-blue-300 tabular-nums w-14 text-right">
                              {formatDuration(tierDistribution.neutral / 1000)}
                            </span>
                            <span className="text-[10px] text-zinc-600 w-8 text-right">
                              {tierDistribution.total > 0 ? Math.round((tierDistribution.neutral / tierDistribution.total) * 100) : 0}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.3)]" />
                            <span className="text-xs text-zinc-400 w-20">Distracting</span>
                            <span className="text-xs font-medium text-rose-300 tabular-nums w-14 text-right">
                              {formatDuration(tierDistribution.distracting / 1000)}
                            </span>
                            <span className="text-[10px] text-zinc-600 w-8 text-right">
                              {tierDistribution.total > 0 ? Math.round((tierDistribution.distracting / tierDistribution.total) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800/50 flex items-center justify-center">
                        <PieChart className="w-5 h-5 text-zinc-600" />
                      </div>
                      <div className="text-xs text-zinc-600">No tracking data yet</div>
                      <div className="text-[10px] text-zinc-700 mt-1">Start tracking to see your time split</div>
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          </motion.div>
        )}

        {activeTab === 'activities' && (
          <motion.div
            data-section="insights.activities"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard>
                <SectionHeader title="Daily Activity Trend" icon={<TrendingUp className="w-5 h-5" />} />
                <p className="text-[11px] text-zinc-600 mb-3">Hours tracked per day</p>
                <div className="relative" style={{ height: 240 }}>
                  {dailyTrend.values.length > 0 ? (
                    <Bar data={{
                      labels: dailyTrend.labels,
                      datasets: [{ data: dailyTrend.values, backgroundColor: 'rgba(168, 85, 247, 0.6)', borderColor: 'rgba(168, 85, 247, 1)', borderWidth: 1, borderRadius: 6, barPercentage: 0.7 }]
                    }} options={barOptions} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                      <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                      <span className="text-xs">No daily activity data available</span>
                    </div>
                  )}
                </div>
              </GlassCard>
              <GlassCard>
                <SectionHeader title="Activity by Category" icon={<PieChart className="w-5 h-5" />} />
                <p className="text-[11px] text-zinc-600 mb-3">Tracked time by activity type</p>
                <div className="relative" style={{ height: 240 }}>
                  {activityCategoryDist.values.length > 0 ? (
                    <Doughnut data={{
                      labels: activityCategoryDist.labels,
                      datasets: [{ data: activityCategoryDist.values, backgroundColor: activityCategoryDist.labels.map((_, i) => chartColors[i % chartColors.length]), borderColor: activityCategoryDist.labels.map((_, i) => chartColors[i % chartColors.length].replace('0.8)', '1)')), borderWidth: 1.5 }]
                    }} options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right' as const, labels: { color: '#a1a1aa', font: { size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } },
                        tooltip: { backgroundColor: 'rgba(24, 24, 27, 0.95)', titleColor: '#e4e4e7', bodyColor: '#a1a1aa', borderColor: 'rgba(63, 63, 70, 0.5)', borderWidth: 1, cornerRadius: 8, padding: 10 },
                      },
                    }} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                      <PieChart className="w-8 h-8 mb-2 opacity-30" />
                      <span className="text-xs">No activity data available</span>
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* External Activities */}
            <GlassCard>
              <h3 className="text-sm font-semibold text-zinc-200 mb-4">External Activity Breakdown</h3>
              {Object.keys(stats.byActivity).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.byActivity)
                    .sort(([, a], [, b]) => b.total_seconds - a.total_seconds)
                    .map(([name, data], i) => {
                      const maxSeconds = maxBy(Object.values(stats.byActivity), v => v.total_seconds, 1);
                      const pct = (data.total_seconds / stats.total_seconds) * 100;
                      const widthPct = (data.total_seconds / maxSeconds) * 100;
                      return (
                        <motion.div
                          key={name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="group"
                        >
                          <div className="flex items-center gap-3 py-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: breakdownColors[i % breakdownColors.length] }} />
                            <span className="text-sm text-zinc-300 w-32 truncate flex-shrink-0">{name}</span>
                            <div className="flex-1 h-5 bg-zinc-800/60 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPct}%` }}
                                transition={{ duration: 0.6, delay: i * 0.03, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: breakdownColors[i % breakdownColors.length] }}
                              />
                            </div>
                            <span className="text-sm font-medium text-zinc-300 w-16 text-right">{formatHours(data.total_seconds)}</span>
                            <span className="text-xs text-zinc-500 w-10 text-right">{pct.toFixed(0)}%</span>
                            <span className="text-xs text-zinc-600 w-12 text-right">{data.session_count} ses</span>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No activity data yet</div>
              )}
              </GlassCard>

            {/* Device App Breakdown */}
            <div className="grid grid-cols-2 gap-6">
              <GlassCard>
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">App Usage (Device Tracking)</h3>
                <p className="text-xs text-zinc-500 mb-3">All apps and websites tracked by the system</p>
                {appUsageBreakdown.length > 0 ? (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {appUsageBreakdown.map((item, i) => {
                      const maxSec = appUsageBreakdown[0]?.seconds || 1;
                      const widthPct = (item.seconds / maxSec) * 100;
                      return (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <span className="text-[10px] text-zinc-600 w-4 text-right">{i + 1}</span>
                          <div className="flex-1 h-4 bg-zinc-800/60 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.5, delay: i * 0.02 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: '#6366f188' }}
                            />
                          </div>
                          <span className="text-[11px] text-zinc-300 w-28 truncate text-right">{item.name}</span>
                          <span className="text-[10px] text-zinc-500 w-14 text-right">{formatDuration(item.seconds)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600 py-8 text-center">No device data available</div>
                )}
              </GlassCard>

              {/* Least used apps */}
              <GlassCard>
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Least Used</h3>
                <p className="text-xs text-zinc-500 mb-3">Apps and sites with the least tracked time</p>
                {leastUsedApps.length > 0 ? (
                  <div className="space-y-1.5">
                    {leastUsedApps.map((item, i) => {
                      const maxSec = leastUsedApps[leastUsedApps.length - 1]?.seconds || 1;
                      const widthPct = (item.seconds / maxSec) * 100;
                      return (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <div className="flex-1 h-4 bg-zinc-800/60 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.5, delay: i * 0.02 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: '#f43f5e66' }}
                            />
                          </div>
                          <span className="text-[11px] text-zinc-300 w-28 truncate text-left">{item.name}</span>
                          <span className="text-[10px] text-zinc-500 w-14 text-right">{formatDuration(item.seconds)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600 py-8 text-center">No data available</div>
                )}
              </GlassCard>
            </div>
          </motion.div>
        )}
      </div>
      </div>
    </PageShell>
  );
}
