import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, TrendingUp, Zap, Calendar, BarChart3, X, Monitor,
  ChevronRight, ChevronLeft, Award, Activity, TrendingUp as TrendingUpIcon,
  Pencil, Trash2, Save, Terminal, Lock, Unlock
} from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { format, subDays, eachDayOfInterval, startOfWeek, addWeeks } from 'date-fns';
import { getDateRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

interface AppStat {
  app: string;
  category: string;
  total_ms: number;
  sessions: number;
  avg_session_ms: number;
  first_seen: string;
  last_seen: string;
}

interface StatsPageProps {
  appStats: AppStat[];
  logs: unknown[];
  allLogs?: unknown[];
  dailyStats?: unknown[];
  selectedPeriod?: Period;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  timeMode?: 'focus' | 'total';
  tierAssignments?: { productive: string[]; neutral: string[]; distracting: string[] };
  liveActivityLogs?: Array<{id: string; timestamp: number; type: 'app' | 'browser' | 'ide'; name: string; category?: string; title?: string; url?: string}>;
}

// Category color map
const CATEGORY_COLORS: Record<string, string> = {
  'IDE': '#6366f1',
  'AI Tools': '#8b5cf6',
  'Browser': '#3b82f6',
  'Entertainment': '#ec4899',
  'Communication': '#14b8a6',
  'Design': '#a855f7',
  'Productivity': '#10b981',
  'Tools': '#f59e0b',
  'Other': '#64748b',
};

// Format duration in seconds to human-readable string
function formatDuration(seconds: number): string {
  const s = Math.round(seconds * 100) / 100;
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const secs = Math.round(s % 60);
    return secs > 0 ? `${m}m ${secs}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function StatsPage({ appStats, logs, allLogs, selectedPeriod = 'week', dateOffset = 0, onDateOffsetChange, timeMode = 'total', tierAssignments, liveActivityLogs }: StatsPageProps) {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<Period>('week');
  const [detailDateOffset, setDetailDateOffset] = useState(0);
  const [timeLock, setTimeLock] = useState(() => localStorage.getItem('stats-time-lock') === 'true');
  const [hourlyChartMode, setHourlyChartMode] = useState<'bar' | 'line'>('bar');
  const [editingAppLogId, setEditingAppLogId] = useState<number | null>(null);
  const [editingAppLogTimes, setEditingAppLogTimes] = useState({ started_at: '', ended_at: '' });
  const [localAppLogs, setLocalAppLogs] = useState<any[]>([]);
  const [liveCurrentApp, setLiveCurrentApp] = useState<{ app: string; category: string; title?: string } | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveLogs, setLiveLogs] = useState<Array<{ id: string; timestamp: number; app: string; category: string; level: string }>>([]);
  const liveSessionStartRef = useRef<number>(Date.now());
  const scrollPosRef = useRef(0);

  // Save scroll position continuously
  useEffect(() => {
    const handleScroll = () => {
      scrollPosRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    localStorage.setItem('stats-time-lock', String(timeLock));
  }, [timeLock]);

  // Restore scroll position when selectedPeriod or dateOffset changes
  useLayoutEffect(() => {
    if (scrollPosRef.current > 0) {
      window.scrollTo(0, scrollPosRef.current);
    }
  }, [selectedPeriod, dateOffset]);
  const chartRefs = useRef<Record<string, ChartJS | null>>({});

  const viewLabel = useMemo(() => getDateRange(selectedPeriod, dateOffset).label, [selectedPeriod, dateOffset]);

  useEffect(() => {
    return () => {
      Object.values(chartRefs.current).forEach(chart => {
        if (chart) {
          chart.destroy();
        }
      });
      chartRefs.current = {};
    };
  }, []);

  // Logs are already period-filtered by parent (App.tsx filteredLogs)
  const filteredLogs = logs;

  // Filter and sort apps — use parent pre-computed appStats (already period-filtered)
  const sortedApps = useMemo(() => {
    const filtered = timeMode === 'focus'
      ? appStats.filter(app => tierAssignments?.productive.includes(app.category))
      : [...appStats];
    return filtered.sort((a, b) => b.total_ms - a.total_ms);
  }, [appStats, timeMode, tierAssignments]);

  // Aggregate stats - filtered by timeMode and filteredLogs
  const totals = useMemo(() => {
    const filteredApps = timeMode === 'focus'
      ? sortedApps.filter(app => tierAssignments?.productive.includes(app.category))
      : sortedApps;
    const totalTimeMs = filteredApps.reduce((sum, s) => sum + (s.total_ms || 0), 0);
    const totalSessions = filteredApps.reduce((sum, s) => sum + (s.sessions || 0), 0);
    const avgSession = totalSessions > 0 ? totalTimeMs / totalSessions : 0;
    const uniqueApps = filteredApps.length;
    return { totalTime: totalTimeMs, totalSessions, avgSession, uniqueApps };
  }, [sortedApps, timeMode, tierAssignments]);

  // Category breakdown - filtered by timeMode and filteredLogs
  const categoryBreakdown = useMemo(() => {
    const grouped: Record<string, number> = {};
    sortedApps.forEach(stat => {
      grouped[stat.category] = (grouped[stat.category] || 0) + stat.total_ms;
    });
    const filteredTotal = Object.values(grouped).reduce((sum, v) => sum + v, 0);
    return Object.entries(grouped)
      .map(([category, total_ms]) => ({ category, total_ms, pct: filteredTotal > 0 ? (total_ms / filteredTotal) * 100 : 0 }))
      .sort((a, b) => b.total_ms - a.total_ms);
  }, [sortedApps]);

  // Pie chart data for app distribution (from sortedApps)
  const pieData = useMemo(() => {
    return {
      labels: sortedApps.map(s => s.app),
      datasets: [{
        data: sortedApps.map(s => s.total_ms / 1000),
        backgroundColor: sortedApps.map((s, i) => {
          const catColor = CATEGORY_COLORS[s.category];
          if (catColor) return catColor + 'cc';
          const palette = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7'];
          return palette[i % palette.length] + 'cc';
        }),
        borderColor: '#0a0a0a',
        borderWidth: 2,
      }]
    };
  }, [sortedApps]);

  // Daily/hourly usage data based on selected period + dateOffset
  const dailyUsage = useMemo(() => {
    const now = new Date();

    if (selectedPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, () => 0);

      for (const log of (filteredLogs as any[])) {
        const sessionStart = new Date(log.timestamp).getTime();
        const sessionEnd = sessionStart + ((log.duration || 0) * 1000);

        let currentMs = sessionStart;
        while (currentMs < sessionEnd) {
          const hourStart = Math.floor(currentMs / 3600000) * 3600000;
          const hourEnd = hourStart + 3600000;
          const currentHour = new Date(hourStart).getHours();
          const segmentStart = Math.max(currentMs, hourStart);
          const segmentEnd = Math.min(sessionEnd, hourEnd);
          const segmentSeconds = Math.max(0, (segmentEnd - segmentStart) / 1000);

          if (segmentSeconds > 0 && currentHour >= 0 && currentHour < 24) {
            hourBuckets[currentHour] += segmentSeconds;
          }

          currentMs = hourEnd;
        }
      }

      return hourBuckets.map((minutes, i) => ({
        hour: i,
        label: `${i.toString().padStart(2, '0')}:00`,
        minutes
      }));
    }

    // Build date-keyed map once (single pass) for all multi-day periods
    const logsByDate = new Map<string, number>();
    for (const log of (filteredLogs as any[])) {
      const key = format(new Date(log.timestamp), 'yyyy-MM-dd');
      logsByDate.set(key, (logsByDate.get(key) || 0) + (log.duration || 0));
    }

    if (selectedPeriod === 'week') {
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      const targetWeekStart = new Date(currentWeekStart);
      targetWeekStart.setDate(targetWeekStart.getDate() - (dateOffset * 7));
      const daysInRange = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(targetWeekStart);
        d.setDate(d.getDate() + i);
        return d;
      });

      return daysInRange.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return { date: dayStr, label: format(day, 'EEE'), minutes: logsByDate.get(dayStr) || 0 };
      });
    }

    if (selectedPeriod === 'month') {
      const range = getDateRange('month', dateOffset);
      const days: { date: string; label: string; minutes: number }[] = [];
      const cursor = new Date(range.start);
      while (cursor < range.end) {
        const dayStr = format(cursor, 'yyyy-MM-dd');
        days.push({ date: dayStr, label: `${cursor.getDate()}`, minutes: logsByDate.get(dayStr) || 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }

    if (selectedPeriod === '7day') {
      const range = getDateRange('7day', dateOffset);
      const days: { date: string; label: string; minutes: number }[] = [];
      const cursor = new Date(range.start);
      while (cursor < range.end) {
        const dayStr = format(cursor, 'yyyy-MM-dd');
        days.push({ date: dayStr, label: format(cursor, 'EEE'), minutes: logsByDate.get(dayStr) || 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }

    if (selectedPeriod === '30day') {
      const range = getDateRange('30day', dateOffset);
      const days: { date: string; label: string; minutes: number }[] = [];
      const cursor = new Date(range.start);
      while (cursor < range.end) {
        const dayStr = format(cursor, 'yyyy-MM-dd');
        days.push({ date: dayStr, label: format(cursor, 'MMM dd'), minutes: logsByDate.get(dayStr) || 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }

    // 'all'
    const monthMap: Record<string, { total: number }> = {};
    (filteredLogs as any[]).forEach(log => {
      const key = format(new Date(log.timestamp), 'yyyy-MM');
      if (!monthMap[key]) monthMap[key] = { total: 0 };
      monthMap[key].total += log.duration || 0;
    });
    return Object.entries(monthMap).map(([key, val]) => ({
      date: key,
      label: format(new Date(key + '-01'), 'MMM yy'),
      minutes: val.total
    }));
  }, [filteredLogs, selectedPeriod, dateOffset]);

  // Hourly distribution — reuse dailyUsage's hour data when period is 'today' (saves a full O(N*M) while-loop)
  const hourlyDistribution = useMemo(() => {
    if (selectedPeriod === 'today') {
      return dailyUsage.map(d => ({ hour: d.hour, minutes: d.minutes }));
    }

    const hourBuckets = Array.from({ length: 24 }, () => 0);

    for (const log of (filteredLogs as any[])) {
      if (log.is_browser_tracking) continue;
      const sessionStart = new Date(log.timestamp).getTime();
      const sessionEnd = sessionStart + ((log.duration || 0) * 1000);

      let currentMs = sessionStart;
      while (currentMs < sessionEnd) {
        const hourStart = Math.floor(currentMs / 3600000) * 3600000;
        const hourEnd = hourStart + 3600000;
        const currentHour = new Date(hourStart).getHours();
        const segmentStart = Math.max(currentMs, hourStart);
        const segmentEnd = Math.min(sessionEnd, hourEnd);
        const segmentSeconds = Math.max(0, (segmentEnd - segmentStart) / 1000);

        if (segmentSeconds > 0 && currentHour >= 0 && currentHour < 24) {
          hourBuckets[currentHour] += segmentSeconds;
        }

        currentMs = hourEnd;
      }
    }

    return hourBuckets.map((minutes, hour) => ({ hour, minutes }));
  }, [filteredLogs, selectedPeriod, dailyUsage]);

  // Selected app detailed data
  const selectedAppData = useMemo(() => {
    if (!selectedApp) return null;
    const stat = appStats.find(s => s.app === selectedApp);
    if (!stat) return null;

    // Session timeline - filter filteredLogs for this app
    const appLogs = (filteredLogs as any[]).filter(log => log.app === selectedApp).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Daily breakdown for this app - ALWAYS 7 days (single-pass Map, no nested filter)
    const now = new Date();
    const startDate = subDays(now, 6);
    const daysInRange = eachDayOfInterval({ start: startDate, end: now });
    const logsByDayStr = new Map<string, { seconds: number; sessions: number }>();
    for (const log of appLogs) {
      const d = format(new Date(log.timestamp), 'yyyy-MM-dd');
      const cur = logsByDayStr.get(d);
      logsByDayStr.set(d, { seconds: (cur?.seconds || 0) + (log.duration || 0), sessions: (cur?.sessions || 0) + 1 });
    }
    const dailyBreakdown = daysInRange.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const val = logsByDayStr.get(dayStr);
      return { date: dayStr, label: format(day, 'MMM dd'), seconds: val?.seconds || 0, sessions: val?.sessions || 0 };
    });

    // Hourly distribution for this app — split duration across hours
    const hourlyDist = Array.from({ length: 24 }, () => ({ hour: 0, seconds: 0, sessions: 0 }));
    for (let i = 0; i < 24; i++) hourlyDist[i].hour = i;

    for (const log of (appLogs as any[])) {
      const sessionStart = new Date(log.timestamp).getTime();
      const sessionEnd = sessionStart + ((log.duration || 0) * 1000);

      let currentMs = sessionStart;
      while (currentMs < sessionEnd) {
        const hourStart = Math.floor(currentMs / 3600000) * 3600000;
        const hourEnd = hourStart + 3600000;
        const currentHour = new Date(hourStart).getHours();
        const segmentStart = Math.max(currentMs, hourStart);
        const segmentEnd = Math.min(sessionEnd, hourEnd);
        const segmentSeconds = Math.max(0, (segmentEnd - segmentStart) / 1000);

        if (segmentSeconds > 0 && currentHour >= 0 && currentHour < 24) {
          hourlyDist[currentHour].seconds += segmentSeconds;
        }

        currentMs = hourEnd;
      }
      hourlyDist[new Date(log.timestamp).getHours()].sessions += 1;
    }

    // Peak hours
    const peakHour = hourlyDist.reduce((max, h) => h.seconds > max.seconds ? h : max, hourlyDist[0]);

    // Longest session (in seconds) — avoid spread on large array
    let longestSession = 0;
    for (const log of appLogs) {
      if ((log.duration || 0) > longestSession) longestSession = log.duration || 0;
    }

    // Productivity estimate (based on category)
    const productiveCategories = ['IDE', 'AI Tools', 'Productivity', 'Tools'];
    // Deterministic score based on app name hash + category
    const baseScore = productiveCategories.includes(stat.category) ? 85 : 45;
    const hashVariation = (stat.app.charCodeAt(0) % 15);
    const productivityScore = baseScore + hashVariation;

    return {
      stat,
      appLogs,
      dailyBreakdown,
      hourlyDist,
      peakHour,
      longestSession,
      productivityScore,
      totalSessions: appLogs.length,
    };
  }, [selectedApp, appStats, filteredLogs]);

  // Detail view — app logs filtered by detail period/offset (independent of parent)
  const detailAppLogs = useMemo(() => {
    if (!selectedApp) return [];
    const sourceLogs = (allLogs || filteredLogs) as any[];
    const range = getDateRange(detailPeriod, detailDateOffset);
    return sourceLogs
      .filter(log => log.app === selectedApp && log.timestamp >= range.start && log.timestamp < range.end)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedApp, detailPeriod, detailDateOffset, allLogs, filteredLogs]);

  // Detail daily breakdown based on detail period
  const detailDailyBreakdown = useMemo(() => {
    if (detailPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, () => 0);
      for (const log of detailAppLogs) {
        const sessionStart = new Date(log.timestamp).getTime();
        const sessionEnd = sessionStart + ((log.duration || 0) * 1000);
        let currentMs = sessionStart;
        while (currentMs < sessionEnd) {
          const hourStart = Math.floor(currentMs / 3600000) * 3600000;
          const hourEnd = hourStart + 3600000;
          const currentHour = new Date(hourStart).getHours();
          const segmentStart = Math.max(currentMs, hourStart);
          const segmentEnd = Math.min(sessionEnd, hourEnd);
          if (segmentEnd > segmentStart && currentHour >= 0 && currentHour < 24) {
            hourBuckets[currentHour] += (segmentEnd - segmentStart) / 1000;
          }
          currentMs = hourEnd;
        }
      }
      return hourBuckets.map((seconds, i) => ({
        label: `${i.toString().padStart(2, '0')}:00`,
        seconds
      }));
    }

    const logsByDate = new Map<string, number>();
    for (const log of detailAppLogs) {
      const key = format(new Date(log.timestamp), 'yyyy-MM-dd');
      logsByDate.set(key, (logsByDate.get(key) || 0) + (log.duration || 0));
    }

    if (detailPeriod === 'all') {
      const monthMap = new Map<string, number>();
      for (const log of detailAppLogs) {
        const key = format(new Date(log.timestamp), 'yyyy-MM');
        monthMap.set(key, (monthMap.get(key) || 0) + (log.duration || 0));
      }
      return Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, seconds]) => ({
          label: format(new Date(key + '-01'), 'MMM yy'),
          seconds
        }));
    }

    const range = getDateRange(detailPeriod, detailDateOffset);
    const days: { label: string; seconds: number }[] = [];
    const cursor = new Date(range.start);
    while (cursor < range.end) {
      const dayStr = format(cursor, 'yyyy-MM-dd');
      const fmt = detailPeriod === 'week' || detailPeriod === '7day' ? 'EEE' : detailPeriod === 'month' ? `${cursor.getDate()}` : 'MMM dd';
      days.push({ label: format(cursor, fmt), seconds: logsByDate.get(dayStr) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [detailAppLogs, detailPeriod, detailDateOffset]);

  const detailHourlyDist = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, seconds: 0, sessions: 0 }));
    for (const log of detailAppLogs) {
      const sessionStart = new Date(log.timestamp).getTime();
      const sessionEnd = sessionStart + ((log.duration || 0) * 1000);
      let currentMs = sessionStart;
      while (currentMs < sessionEnd) {
        const hourStart = Math.floor(currentMs / 3600000) * 3600000;
        const hourEnd = hourStart + 3600000;
        const currentHour = new Date(hourStart).getHours();
        const segmentStart = Math.max(currentMs, hourStart);
        const segmentEnd = Math.min(sessionEnd, hourEnd);
        const segmentSeconds = Math.max(0, (segmentEnd - segmentStart) / 1000);
        if (segmentSeconds > 0 && currentHour >= 0 && currentHour < 24) {
          buckets[currentHour].seconds += segmentSeconds;
        }
        currentMs = hourEnd;
      }
      buckets[new Date(log.timestamp).getHours()].sessions += 1;
    }
    return buckets;
  }, [detailAppLogs]);

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: '7day', label: '7 Day' },
    { key: 'month', label: 'Month' },
    { key: '30day', label: '30 Day' },
    { key: 'all', label: 'All' },
  ];

  // Sync localAppLogs when selected app changes
  useEffect(() => {
    if (selectedAppData) {
      setLocalAppLogs(selectedAppData.appLogs);
    }
  }, [selectedApp]);

  // Live tracking — listen for foreground changes
  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (!api?.onForegroundChange) return;
    api.onForegroundChange((data: any) => {
      if (data.app && !data.app.toLowerCase().includes('deskflow') && !data.app.toLowerCase().includes('electron')) {
        setLiveCurrentApp({ app: data.app, category: data.category || 'Other', title: data.title });
        liveSessionStartRef.current = Date.now();
        setLiveElapsed(0);
      }
    });
  }, []);

  // Sync live logs from App.tsx (persists across page navigation)
  useEffect(() => {
    if (liveActivityLogs) {
      const appEntries = liveActivityLogs
        .filter(e => e.type === 'app')
        .map(e => ({ id: e.id, timestamp: e.timestamp, app: e.name, category: e.category || 'Other', level: 'info' as const }));
      setLiveLogs(appEntries);
    }
  }, [liveActivityLogs]);

  // 1-second timer for live elapsed
  useEffect(() => {
    if (!liveCurrentApp) return;
    const interval = setInterval(() => {
      setLiveElapsed(Math.floor((Date.now() - liveSessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [liveCurrentApp]);

  // Memoized chart data and options — prevents Chart.js re-renders from fresh object references
  const dailyChartData = useMemo(() => ({
    labels: dailyUsage.map(d => d.label),
    datasets: [{
      label: 'Daily Usage',
      data: dailyUsage.map(d => d.minutes),
      backgroundColor: 'rgba(99, 102, 241, 0.5)',
      borderColor: '#6366f1',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
    }]
  }), [dailyUsage]);

  const dailyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        titleColor: '#fff',
        bodyColor: '#a1a1aa',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}`,
        }
      }
    },
    scales: {
      x: {
        grid: { color: '#27272a' },
        ticks: { color: '#71717a', maxTicksLimit: 10 }
      },
      y: {
        grid: { color: '#27272a' },
        ticks: { color: '#71717a', callback: (v: any) => formatDuration(v) },
        beginAtZero: true,
      }
    },
  }), []);

  const hourlyChartData = useMemo(() => ({
    labels: hourlyDistribution.map(h => `${h.hour.toString().padStart(2, '0')}:00`),
    datasets: [{
      label: 'Minutes',
      data: hourlyDistribution.map(h => h.minutes),
      backgroundColor: hourlyDistribution.map((_, i) => {
        const currentHour = new Date().getHours();
        return i === currentHour ? '#10b981' : 'rgba(99, 102, 241, 0.6)';
      }),
      borderColor: hourlyDistribution.map((_, i) => {
        const currentHour = new Date().getHours();
        return i === currentHour ? '#059669' : '#6366f1';
      }),
      borderWidth: 1,
      borderRadius: 4,
    }]
  }), [hourlyDistribution]);

  const hourlyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        titleColor: '#fff',
        bodyColor: '#a1a1aa',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}`,
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717a', maxTicksLimit: 12 }
      },
      y: {
        grid: { color: '#27272a' },
        ticks: { color: '#71717a', callback: (v: any) => formatDuration(v) },
        beginAtZero: true,
      }
    },
  }), []);

  const hourlyLineChartData = useMemo(() => ({
    labels: hourlyDistribution.map(h => `${h.hour.toString().padStart(2, '0')}:00`),
    datasets: [{
      label: 'Minutes',
      data: hourlyDistribution.map(h => h.minutes),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      fill: true,
      tension: 0.3,
      pointBackgroundColor: hourlyDistribution.map((_, i) => {
        const currentHour = new Date().getHours();
        return i === currentHour ? '#10b981' : '#6366f1';
      }),
      pointBorderColor: hourlyDistribution.map((_, i) => {
        const currentHour = new Date().getHours();
        return i === currentHour ? '#059669' : '#6366f1';
      }),
      pointRadius: 4,
      pointHoverRadius: 6,
    }]
  }), [hourlyDistribution]);

  const hourlyLineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        titleColor: '#fff',
        bodyColor: '#a1a1aa',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}`,
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717a', maxTicksLimit: 12 }
      },
      y: {
        grid: { color: '#27272a' },
        ticks: { color: '#71717a', callback: (v: any) => formatDuration(v) },
        beginAtZero: true,
      }
    },
  }), []);

  // Memoized Pie chart options (was inline in JSX, causing re-renders)
  const pieChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { color: '#a1a1aa', padding: 18, usePointStyle: true } },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        titleColor: '#fff',
        bodyColor: '#a1a1aa',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx: any) => {
            const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const val = ctx.parsed as number;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${formatDuration(val)} (${pct}%)`;
          }
        }
      }
    }
  }), []);

  // Memoized summary cards — was inline array created every render
  // Memoized reversed live logs — avoiding slice().reverse() every render
  const reversedLiveLogs = useMemo(() => liveLogs.slice().reverse(), [liveLogs]);

  const summaryCards = useMemo(() => [
    { label: 'Total Time', value: `${Math.floor(totals.totalTime / 3600000)}h ${Math.floor((totals.totalTime % 3600000) / 60000)}m`, icon: Clock, color: 'text-emerald-400' },
    { label: 'Total Sessions', value: totals.totalSessions, icon: Activity, color: 'text-indigo-400' },
    { label: 'Avg Session', value: `${Math.floor(totals.avgSession / 60000)}m`, icon: TrendingUp, color: 'text-violet-400' },
    { label: 'Active Apps', value: totals.uniqueApps, icon: Monitor, color: 'text-amber-400' },
  ], [totals.totalTime, totals.totalSessions, totals.avgSession, totals.uniqueApps]);

  const effectivePeriod = timeLock ? 'all' : selectedPeriod;

  return (
    <PageShell page="stats">
    {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-zinc-500 mt-1">Track your application usage</p>
        </div>
        <div data-tutorial="stats.period" className="flex items-center gap-3">
          <button
            onClick={() => setTimeLock(!timeLock)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              timeLock
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700'
            }`}
            title={timeLock ? 'Unlock timeframe (use nav)' : 'Lock to All Time'}
          >
            {timeLock ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>All Time</span>
          </button>
          <span className="text-sm font-medium px-2 text-zinc-400">
            {timeLock ? 'All Time' : viewLabel}
          </span>
        </div>
      </div>

      {/* Live tracking indicator */}
      {liveCurrentApp && (
        <GlassCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse shadow-emerald-500/30" />
              <div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider">Currently Tracking</div>
                <div className="text-xl font-semibold text-white">{liveCurrentApp.app}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-emerald-400 tabular-nums">{formatDuration(liveElapsed)}</div>
              <div className="text-xs text-zinc-500 mt-1">{liveCurrentApp.category}</div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Live Detection Panel */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <span className="font-medium">Live Detection</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{liveLogs.length} events</span>
          </div>
        </div>
        <div className="bg-zinc-950 rounded-xl border border-zinc-800/50 p-3 h-48 overflow-y-auto font-mono text-xs">
          {liveLogs.length === 0 ? (
            <div className="text-zinc-500 text-center py-8">
              Waiting for app activity...
            </div>
          ) : (
            <div className="space-y-1">
              {reversedLiveLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-zinc-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    INFO
                  </span>
                  <span className="text-blue-400">{log.app}</span>
                  <span className="text-zinc-500 truncate">{log.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* App Time Distribution & Top Applications */}
      <div className="flex gap-5">
        <GlassCard className="w-full md:w-2/5">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="text-xl font-semibold">App Time Distribution</div>
              <div className="text-sm text-zinc-500">{viewLabel}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">
                {Math.floor(totals.totalTime / 3600000)}h {Math.floor((totals.totalTime % 3600000) / 60000)}m
              </div>
              <div className="text-xs text-zinc-500">Total Time</div>
            </div>
          </div>
          {sortedApps.length > 0 ? (
            <div className="chart-container h-64">
              <Pie data={pieData} options={pieChartOptions} />
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-500">
              No data available yet
            </div>
          )}
        </GlassCard>

        <div className="flex-1 space-y-4">
          <GlassCard>
            <div className="text-xl font-semibold mb-6">Top Applications</div>
            {sortedApps.slice(0, 6).map((app) => {
              const catColor = CATEGORY_COLORS[app.category] || '#64748b';
              const pct = totals.totalTime > 0 ? Math.round((app.total_ms / totals.totalTime) * 100) : 0;
              return (
                <div key={app.app} className="flex items-center py-4 border-b border-zinc-800 last:border-none">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: catColor + '22' }}>
                    <Monitor className="w-4 h-4" style={{ color: catColor }} />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="font-medium">{app.app}</div>
                    <div className="text-xs" style={{ color: catColor }}>{app.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono tabular-nums">
                      {Math.floor(app.total_ms / 3600000)}h {Math.floor((app.total_ms % 3600000) / 60000)}m
                    </div>
                    <div className="text-xs text-emerald-400">{pct}%</div>
                  </div>
                </div>
              );
            })}
            {sortedApps.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                No applications tracked yet
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryCards.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div className="text-xs text-zinc-500">LIVE</div>
              </div>
              <div className={`text-3xl font-semibold tabular-nums tracking-tight ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

{/* Hourly Distribution */}
      <GlassCard data-tutorial="stats.charts">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {hourlyChartMode === 'bar' ? (
              <BarChart3 className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingUpIcon className="w-5 h-5 text-indigo-400" />
            )}
            <div>
              <div className="text-xl font-semibold">
                {selectedPeriod === 'today' ? 'Hourly Activity' : 'Daily Usage Trend'}
              </div>
              <div className="text-sm text-zinc-500">
                {selectedPeriod === 'today' ? 'Activity by hour of day' : `${selectedPeriod === 'week' ? '7 days' : selectedPeriod === '7day' ? '7 days' : selectedPeriod === 'month' ? 'all days' : selectedPeriod === '30day' ? '30 days' : 'all time'} of activity`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg">
            <button
              onClick={() => setHourlyChartMode('bar')}
              className={`p-2 rounded-md transition-colors duration-150 ${
                hourlyChartMode === 'bar'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Bar Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setHourlyChartMode('line')}
              className={`p-2 rounded-md transition-colors duration-150 ${
                hourlyChartMode === 'line'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Line Chart"
            >
              <TrendingUpIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="h-56">
          {hourlyChartMode === 'bar' ? (
            selectedPeriod === 'today' ? (
              <Bar data={hourlyChartData} options={hourlyChartOptions} />
            ) : (
              <Bar data={dailyChartData} options={dailyChartOptions} />
            )
          ) : (
            selectedPeriod === 'today' ? (
              <Line data={hourlyLineChartData} options={hourlyLineChartOptions} />
            ) : (
              <Line data={dailyChartData} options={dailyChartOptions} />
            )
          )}
        </div>
      </GlassCard>

      {/* Category Breakdown */}
      <GlassCard>
        <h2 className="text-xl font-semibold mb-6">Category Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categoryBreakdown.map(({ category, total_ms, pct }) => (
            <div key={category} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[category] || '#64748b' }}
                />
                <span className="text-sm font-medium">{category}</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {Math.floor(total_ms / 60000)}m
              </div>
              <div className="text-xs text-zinc-500 mt-1">{pct.toFixed(1)}% of total</div>
              <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-colors duration-150"
                  style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[category] || '#64748b' }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Per-App Cards */}
      <GlassCard data-tutorial="stats.list">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Application Statistics</h2>
            <p className="text-sm text-zinc-500 mt-1">Click an app to view detailed stats</p>
          </div>
          <div className="text-xs text-zinc-500">{sortedApps.length} apps</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedApps.map((stat) => {
            const catColor = CATEGORY_COLORS[stat.category] || '#64748b';
            const isSelected = selectedApp === stat.app;
            return (
              <motion.div
                key={stat.app}
                className={`rounded-xl p-5 border cursor-pointer transition ${
                  isSelected
                    ? 'bg-zinc-800/80 border-indigo-500/50 shadow-indigo-500/10'
                    : 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700'
                }`}
                onClick={() => setSelectedApp(isSelected ? null : stat.app)}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: catColor + '22' }}
                    >
                      <Monitor className="w-5 h-5" style={{ color: catColor }} />
                    </div>
                    <div>
                      <div className="font-medium text-sm truncate max-w-[140px]" title={stat.app}>{stat.app}</div>
                      <div className="text-xs" style={{ color: catColor }}>{stat.category}</div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Time</span>
                    <span className="font-mono text-white">
                      {Math.floor(stat.total_ms / 3600000)}h {Math.floor((stat.total_ms % 3600000) / 60000)}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Sessions</span>
                    <span className="font-mono text-emerald-400">{stat.sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Avg Session</span>
                    <span className="font-mono text-zinc-300">{Math.floor(stat.avg_session_ms / 60000)}m</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {sortedApps.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
            <p>No statistics available yet. Start using your computer to collect data.</p>
          </div>
        )}
      </GlassCard>

      {/* Selected App Detail Modal */}
      <AnimatePresence>
        {selectedAppData && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-5"
            onClick={() => setSelectedApp(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[85vh] overflow-y-auto"
            >
              <GlassCard variant="elevated">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: (CATEGORY_COLORS[selectedAppData.stat.category] || '#64748b') + '22' }}
                  >
                    <Monitor
                      className="w-7 h-7"
                      style={{ color: CATEGORY_COLORS[selectedAppData.stat.category] || '#64748b' }}
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">{selectedAppData.stat.app}</h2>
                    <div className="text-sm" style={{ color: CATEGORY_COLORS[selectedAppData.stat.category] || '#64748b' }}>
                      {selectedAppData.stat.category}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedApp(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  {
                    label: 'Total Time',
                    value: `${Math.floor(selectedAppData.stat.total_ms / 3600000)}h ${Math.floor((selectedAppData.stat.total_ms % 3600000) / 60000)}m`,
                    icon: Clock,
                    color: 'text-emerald-400'
                  },
                  {
                    label: 'Sessions',
                    value: selectedAppData.totalSessions,
                    icon: Activity,
                    color: 'text-indigo-400'
                  },
                  {
                    label: 'Peak Hour',
                    value: `${selectedAppData.peakHour.hour.toString().padStart(2, '0')}:00`,
                    icon: Zap,
                    color: 'text-amber-400'
                  },
                  {
                    label: 'Longest Session',
                    value: formatDuration(selectedAppData.longestSession),
                    icon: Award,
                    color: 'text-violet-400'
                  },
                ].map((metric, idx) => (
                  <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                    <metric.icon className={`w-5 h-5 ${metric.color} mb-2`} />
                    <div className={`text-xl font-semibold tabular-nums ${metric.color}`}>{metric.value}</div>
                    <div className="text-xs text-zinc-500 mt-1">{metric.label}</div>
                  </div>
                ))}
              </div>

              {/* Period selector for detail popup */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const r = getDateRange(detailPeriod, detailDateOffset - 1); setDetailDateOffset(d => d - 1); }}
                    className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex gap-1">
                    {PERIOD_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setDetailPeriod(opt.key); setDetailDateOffset(0); }}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                          detailPeriod === opt.key
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setDetailDateOffset(d => d + 1)}
                    className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Daily Trend for This App */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Daily Usage</h3>
                <div className="h-48">
                  <Bar
                    data={{
                      labels: detailDailyBreakdown.map(d => d.label),
                      datasets: [{
                        label: 'Duration',
                        data: detailDailyBreakdown.map(d => d.seconds),
                        backgroundColor: (CATEGORY_COLORS[selectedAppData.stat.category] || '#6366f1') + '88',
                        borderColor: CATEGORY_COLORS[selectedAppData.stat.category] || '#6366f1',
                        borderWidth: 1,
                        borderRadius: 4,
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
                            label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}`,
                          }
                        }
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: '#71717a', maxTicksLimit: 10 } },
                        y: { 
                          grid: { color: '#27272a' }, 
                          ticks: { 
                            color: '#71717a',
                            callback: (v: any) => formatDuration(v),
                          }, 
                          beginAtZero: true 
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Hourly Distribution for This App */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Hourly Activity</h3>
                <div className="h-40">
                  <Bar
                    data={{
                      labels: detailHourlyDist.map(h => `${h.hour.toString().padStart(2, '0')}:00`),
                      datasets: [{
                        label: 'Duration',
                        data: detailHourlyDist.map(h => h.seconds),
                        backgroundColor: detailHourlyDist.map((h, i) => {
                          const currentHour = new Date().getHours();
                          return i === currentHour
                            ? (CATEGORY_COLORS[selectedAppData.stat.category] || '#10b981')
                            : (CATEGORY_COLORS[selectedAppData.stat.category] || '#6366f1') + '66';
                        }),
                        borderRadius: 4,
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
                            label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}`,
                          }
                        }
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: '#71717a', maxTicksLimit: 12 } },
                        y: { 
                          grid: { color: '#27272a' }, 
                          ticks: { 
                            color: '#71717a',
                            callback: (v: any) => formatDuration(v),
                          }, 
                          beginAtZero: true 
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                  <div className="text-sm text-zinc-500 mb-1">First Seen</div>
                  <div className="font-mono text-white">
                    {new Date(selectedAppData.stat.first_seen).toLocaleDateString('en-US', {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </div>
                </div>
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                  <div className="text-sm text-zinc-500 mb-1">Last Seen</div>
                  <div className="font-mono text-white">
                    {new Date(selectedAppData.stat.last_seen).toLocaleDateString('en-US', {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </div>
                </div>
              </div>

              {/* Productivity Score */}
              <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-400" />
                    <span className="font-medium">Productivity Estimate</span>
                  </div>
                  <span className="text-2xl font-semibold text-emerald-400">
                    {Math.round(selectedAppData.productivityScore)}/100
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-colors duration-150"
                    style={{ width: `${selectedAppData.productivityScore}%` }}
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-2">
                  Based on category classification. {selectedAppData.stat.category} is considered {selectedAppData.productivityScore > 70 ? 'highly' : 'moderately'} productive.
                </div>
              </div>

              {/* Sessions */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Sessions</h3>
                  <span className="text-xs text-zinc-500">{localAppLogs.length} total</span>
                </div>
                {localAppLogs.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 text-sm">No sessions found</div>
                ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {localAppLogs.slice(-20).reverse().map((log: any) => {
                    const isEditing = editingAppLogId === log.id;
                    const startDate = new Date(log.timestamp);
                    const durationMs = log.duration_ms || (log.duration || 0) * 1000;
                    const endDate = new Date(startDate.getTime() + durationMs);
                    return (
                      <div key={log.id} className="bg-zinc-800/30 rounded-lg px-3 py-2 text-sm group hover:bg-zinc-800/50 transition-colors">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-zinc-500">Start</label>
                                <input
                                  type="datetime-local"
                                  value={editingAppLogTimes.started_at}
                                  onChange={(e) => setEditingAppLogTimes(prev => ({ ...prev, started_at: e.target.value }))}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-500">End</label>
                                <input
                                  type="datetime-local"
                                  value={editingAppLogTimes.ended_at}
                                  onChange={(e) => setEditingAppLogTimes(prev => ({ ...prev, ended_at: e.target.value }))}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                                />
                              </div>
                            </div>
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={async () => {
                                  const newStart = new Date(editingAppLogTimes.started_at);
                                  const newEnd = new Date(editingAppLogTimes.ended_at);
                                  const durMs = Math.max(0, newEnd.getTime() - newStart.getTime());
                                  const res = await (window as any).deskflowAPI.updateAppLog(log.id, {
                                    timestamp: newStart.toISOString(),
                                    duration_ms: durMs,
                                  });
                                  if (res?.success) {
                                    setEditingAppLogId(null);
                                    setLocalAppLogs(prev => prev.map(l =>
                                      l.id === log.id ? { ...l, timestamp: newStart.toISOString(), duration_ms: durMs, duration: durMs / 1000 } : l
                                    ));
                                  }
                                }}
                                className="px-2 py-1 bg-emerald-600/50 hover:bg-emerald-600 rounded text-xs text-white"
                              >
                                <Save className="w-3 h-3 inline mr-1" />Save
                              </button>
                              <button
                                onClick={() => setEditingAppLogId(null)}
                                className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-zinc-400 flex-shrink-0">
                                {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-xs text-zinc-300 font-medium">
                                {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-zinc-600">→</span>
                              <span className="text-xs text-zinc-400">
                                {endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-zinc-400 font-medium">{formatDuration(durationMs / 1000)}</span>
                              <button
                                onClick={() => {
                                  const toLocal = (iso: string) => {
                                    const d = new Date(iso);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                  };
                                  setEditingAppLogId(log.id);
                                  setEditingAppLogTimes({
                                    started_at: toLocal(log.timestamp),
                                    ended_at: toLocal(endDate.toISOString()),
                                  });
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-zinc-700 transition-colors duration-150"
                              >
                                <Pencil className="w-3 h-3 text-zinc-500" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm('Delete this session?')) {
                                    const res = await (window as any).deskflowAPI.deleteAppLog(log.id);
                                    if (res?.success) {
                                      setLocalAppLogs(prev => prev.filter(l => l.id !== log.id));
                                    }
                                  }
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-900/50 transition-colors duration-150"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
