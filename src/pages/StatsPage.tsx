import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import {
  Clock, Zap, BarChart3, X, Monitor,
  ChevronRight, ChevronLeft, ChevronDown, Award, Activity, TrendingUp as TrendingUpIcon,
  Pencil, Trash2, Save, Terminal, Lock, Unlock,
  MonitorSmartphone, Radio, ScrollText,
  Search, Filter, Trophy, AppWindow, Tags, FolderTree, Timer, LayoutGrid,
  ChartPie, LineChart, Globe, Flame, Hourglass, Gauge,
  Check, Layers, Repeat, ListOrdered
} from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { SectionState } from '../components/SectionState';
import { Input } from '../components/ui/input';
import { Select, SelectItem } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Toggle } from '../components/ui/toggle';
import { BorderBeam } from '../components/ui/border-beam';
import { NumberTicker } from '../components/ui/number-ticker';
import { DotPattern } from '../components/ui/dot-pattern';
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
import { glassBackdrop, centerText, makeGradient, sharedTooltipStyle, sharedScales, formatAxisTick, barAnimation, pieAnimation } from '../lib/chart-plugins';
import type { Period } from '../lib/dateRange';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderSignal } from '../lib/renderers/signal';
import { startPhaseClock } from '../lib/currentPhase';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler, glassBackdrop, centerText);

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
  embedded?: boolean;
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
  platformFilter?: string;
  compareMode?: boolean;
  availablePlatforms?: string[];
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

// Website category to app category mapping for productivity calculation
const WEBSITE_CATEGORY_MAP: Record<string, string> = {
  'Developer Tools': 'Tools',
  'AI Tools': 'AI Tools',
  'Social Media': 'Social Media',
  'Entertainment': 'Entertainment',
  'News': 'News',
  'Shopping': 'Shopping',
  'Productivity': 'Productivity',
  'Design': 'Design',
  'Search Engine': 'Productivity',
  'Communication': 'Communication',
  'Education': 'Education',
  'Uncategorized': 'Uncategorized',
  'Other': 'Other'
};

// A log counts as productive when its (mapped) category is in the productive tier.
// Website logs carry website categories, so they must be mapped first.
function isProductiveLog(log: any, tiers?: { productive: string[]; neutral: string[]; distracting: string[] }): boolean {
  const productive = tiers?.productive || [];
  const raw = log?.category || 'Uncategorized';
  const cat = log?.is_browser_tracking ? (WEBSITE_CATEGORY_MAP[raw] || raw) : raw;
  return productive.includes(cat);
}

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

export default function StatsPage({ embedded, appStats, logs, allLogs, selectedPeriod = 'week', dateOffset = 0, onDateOffsetChange, timeMode = 'total', tierAssignments, liveActivityLogs, platformFilter = 'all', compareMode = false, availablePlatforms = [] }: StatsPageProps) {
  useEffect(() => { startPhaseClock(); }, []);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<Period>('week');
  const [detailDateOffset, setDetailDateOffset] = useState(0);
  const [timeLock, setTimeLock] = useState(() => localStorage.getItem('stats-time-lock') === 'true');
  const [hourlyChartMode, setHourlyChartMode] = useState<'bar' | 'line'>('bar');
  const [showLiveDetection, setShowLiveDetection] = useState(false);
  const [editingAppLogId, setEditingAppLogId] = useState<number | null>(null);
  const [editingAppLogTimes, setEditingAppLogTimes] = useState({ started_at: '', ended_at: '' });
  const [localAppLogs, setLocalAppLogs] = useState<any[]>([]);
  const [liveCurrentApp, setLiveCurrentApp] = useState<{ app: string; category: string; title?: string } | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveLogs, setLiveLogs] = useState<Array<{ id: string; timestamp: number; app: string; category: string; level: string; appLevel?: string }>>([]);
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveLevelFilter, setLiveLevelFilter] = useState('all');
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

  // Platform-filtered logs (for OS split)
  const platformLogs = useMemo(() => {
    if (platformFilter === 'all') return filteredLogs as any[];
    return (filteredLogs as any[]).filter(l => l.platform === platformFilter);
  }, [filteredLogs, platformFilter]);

  // App-only logs (exclude browser/website tracking) — used for totals, hourly, daily charts
  // so they match the pie chart and top-apps which are apps-only from appStats
  const appLogs = useMemo(() => (platformLogs as any[] || []).filter(l => !l.is_browser_tracking), [platformLogs]);

  // Filter and sort apps — use parent pre-computed appStats (already period-filtered)
  const sortedApps = useMemo(() => {
    const filtered = timeMode === 'focus'
      ? appStats.filter(app => tierAssignments?.productive.includes(app.category))
      : [...appStats];
    return filtered.sort((a, b) => b.total_ms - a.total_ms);
  }, [appStats, timeMode, tierAssignments]);

  // Aggregate stats — apps-only (matches pie chart and top-apps breakdown)
  const totals = useMemo(() => {
    const scopedLogs = timeMode === 'focus'
      ? appLogs.filter(l => isProductiveLog(l, tierAssignments))
      : appLogs;
    const totalTimeMs = scopedLogs.reduce((sum, l) => sum + (l.duration || 0), 0) * 1000;
    const totalSessions = scopedLogs.length;
    const avgSession = totalSessions > 0 ? totalTimeMs / totalSessions : 0;
    const uniqueApps = sortedApps.length;
    return { totalTime: totalTimeMs, totalSessions, avgSession, uniqueApps };
  }, [sortedApps, timeMode, tierAssignments, appLogs]);

  // Apps-only denominator for Top Applications percentage bars (the pie is apps-only)
  const appsOnlyTotalMs = useMemo(() => sortedApps.reduce((s, a) => s + (a.total_ms || 0), 0), [sortedApps]);

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
    const colors = sortedApps.map((s, i) => {
      const catColor = CATEGORY_COLORS[s.category];
      if (catColor) return catColor + 'cc';
      const palette = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7'];
      return palette[i % palette.length] + 'cc';
    });
    return {
      labels: sortedApps.map(s => s.app),
      datasets: [{
        data: sortedApps.map(s => s.total_ms / 1000),
        backgroundColor: colors,
        hoverBackgroundColor: colors.map((c: string) => c.replace('cc', 'aa')),
        borderColor: '#0a0a0a',
        borderWidth: 2,
        hoverOffset: 6,
      }]
    };
  }, [sortedApps]);

  // Daily/hourly usage data based on selected period + dateOffset
  // In Focus mode only productive activity is included — matches the top-bar clock
  // and the summary cards in every mode. Uses app-only logs (no browser/website).
  const dailyUsage = useMemo(() => {
    const scopedLogs = timeMode === 'focus'
      ? appLogs.filter(l => isProductiveLog(l, tierAssignments))
      : appLogs;

    if (selectedPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, () => 0);

      for (const log of scopedLogs) {
        const sessionStart = log.timestamp.getTime();
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
    for (const log of scopedLogs) {
      const key = format(log.timestamp, 'yyyy-MM-dd');
      logsByDate.set(key, (logsByDate.get(key) || 0) + (log.duration || 0));
    }

    if (selectedPeriod === 'week') {
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));
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
    scopedLogs.forEach(log => {
      const key = format(log.timestamp, 'yyyy-MM');
      if (!monthMap[key]) monthMap[key] = { total: 0 };
      monthMap[key].total += log.duration || 0;
    });
    return Object.entries(monthMap).map(([key, val]) => ({
      date: key,
      label: format(new Date(key + '-01'), 'MMM yy'),
      minutes: val.total
    }));
  }, [appLogs, selectedPeriod, dateOffset, timeMode, tierAssignments]);

  // Hourly distribution — reuse dailyUsage's hour data when period is 'today' (saves a full O(N*M) while-loop)
  const hourlyDistribution = useMemo(() => {
    if (selectedPeriod === 'today') {
      return dailyUsage.map(d => ({ hour: d.hour, minutes: d.minutes }));
    }

    const hourBuckets = Array.from({ length: 24 }, () => 0);

    for (const log of appLogs) {
      if (timeMode === 'focus' && !isProductiveLog(log, tierAssignments)) continue;
      const sessionStart = log.timestamp.getTime();
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
  }, [appLogs, selectedPeriod, dailyUsage, timeMode, tierAssignments]);

  // Selected app detailed data
  const selectedAppData = useMemo(() => {
    if (!selectedApp) return null;
    const stat = appStats.find(s => s.app === selectedApp);
    if (!stat) return null;

    // Session timeline - filter app-only logs for this app
    const selectedAppLogs = (appLogs as any[]).filter(log => log.app === selectedApp).sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Daily breakdown for this app - ALWAYS 7 days (single-pass Map, no nested filter)
    const now = new Date();
    const startDate = subDays(now, 6);
    const daysInRange = eachDayOfInterval({ start: startDate, end: now });
    const logsByDayStr = new Map<string, { seconds: number; sessions: number }>();
    for (const log of selectedAppLogs) {
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

    for (const log of (selectedAppLogs as any[])) {
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
    for (const log of selectedAppLogs) {
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
      appLogs: selectedAppLogs,
      dailyBreakdown,
      hourlyDist,
      peakHour,
      longestSession,
      productivityScore,
      totalSessions: selectedAppLogs.length,
    };
  }, [selectedApp, appStats, appLogs]);

  // Detail view — app logs filtered by detail period/offset (independent of parent)
  const detailAppLogs = useMemo(() => {
    if (!selectedApp) return [];
    const sourceLogs = ((allLogs || appLogs) as any[]).filter(l => !l.is_browser_tracking);
    const range = getDateRange(detailPeriod, detailDateOffset);
    return sourceLogs
      .filter(log => log.app === selectedApp && log.timestamp >= range.start && log.timestamp < range.end)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedApp, detailPeriod, detailDateOffset, allLogs, appLogs]);

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
        .map(e => ({ id: e.id, timestamp: e.timestamp, app: e.name, category: e.category || 'Other', level: 'info' as const, appLevel: e.type as string }));
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
      backgroundColor: (ctx: any) => makeGradient(ctx, '#6366f1'),
      borderColor: '#6366f1',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      borderRadius: 6,
      borderSkipped: false,
      categoryPercentage: 0.7,
      barPercentage: 0.8,
    }]
  }), [dailyUsage]);

  const dailyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      glassBackdrop: true,
      legend: { display: false },
      tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}` } }
    },
    scales: {
      ...sharedScales,
      y: { ...sharedScales.y, ticks: { ...sharedScales.y.ticks, callback: (v: any) => formatAxisTick(v) } },
    },
    animation: barAnimation,
  }), []);

  const hourlyChartData = useMemo(() => ({
    labels: hourlyDistribution.map(h => `${h.hour.toString().padStart(2, '0')}:00`),
    datasets: [{
      label: 'Minutes',
      data: hourlyDistribution.map(h => h.minutes),
      backgroundColor: (ctx: any) => {
        const currentHour = new Date().getHours();
        return ctx.dataIndex === currentHour ? makeGradient(ctx, '#10b981') : makeGradient(ctx, '#6366f1');
      },
      borderColor: hourlyDistribution.map((_, i) => {
        const currentHour = new Date().getHours();
        return i === currentHour ? '#059669' : '#6366f1';
      }),
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
      categoryPercentage: 0.7,
      barPercentage: 0.8,
    }]
  }), [hourlyDistribution]);

  const hourlyChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      glassBackdrop: true,
      legend: { display: false },
      tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}` } }
    },
    scales: {
      ...sharedScales,
      y: { ...sharedScales.y, ticks: { ...sharedScales.y.ticks, callback: (v: any) => formatAxisTick(v) } },
    },
    animation: barAnimation,
  }), []);

  const hourlyLineChartData = useMemo(() => ({
    labels: hourlyDistribution.map(h => `${h.hour.toString().padStart(2, '0')}:00`),
    datasets: [{
      label: 'Minutes',
      data: hourlyDistribution.map(h => h.minutes),
      borderColor: '#6366f1',
      backgroundColor: (ctx: any) => makeGradient(ctx, '#6366f1'),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#6366f1',
      borderWidth: 2,
    }]
  }), [hourlyDistribution]);

  const hourlyLineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      glassBackdrop: true,
      legend: { display: false },
      tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => ` ${formatDuration(ctx.parsed.y)}` } }
    },
    scales: {
      ...sharedScales,
      y: { ...sharedScales.y, ticks: { ...sharedScales.y.ticks, callback: (v: any) => formatAxisTick(v) } },
    },
    animation: barAnimation,
  }), []);

  // Memoized Pie chart options (was inline in JSX, causing re-renders)
  const pieChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    plugins: {
      glassBackdrop: true,
      centerText: { enabled: true },
      legend: { position: 'bottom' as const, labels: { color: '#a1a1aa', padding: 18, usePointStyle: true } },
      tooltip: {
        ...sharedTooltipStyle,
        callbacks: {
          label: (ctx: any) => {
            const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const val = ctx.parsed as number;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${formatDuration(val)} (${pct}%)`;
          }
        }
      }
    },
    animation: pieAnimation,
    hover: {
      mode: 'index' as const,
      intersect: false,
    },
  }), []);

  // Memoized summary cards — was inline array created every render
  // Memoized reversed live logs — avoiding slice().reverse() every render
  const reversedLiveLogs = useMemo(() => liveLogs.slice().reverse(), [liveLogs]);

  // Filtered view for live detection panel
  const displayedLogs = useMemo(() => {
    let filtered = reversedLiveLogs;
    if (liveLevelFilter !== 'all') {
      filtered = filtered.filter(l => (l.appLevel || 'info') === liveLevelFilter);
    }
    if (liveSearchQuery.trim()) {
      const q = liveSearchQuery.toLowerCase();
      filtered = filtered.filter(l => l.app.toLowerCase().includes(q) || l.category.toLowerCase().includes(q));
    }
    return filtered;
  }, [reversedLiveLogs, liveLevelFilter, liveSearchQuery]);

  // Average of the visible bar-chart bars (dailyUsage holds seconds per bar, misnamed 'minutes')
  const avgBarSeconds = dailyUsage.length > 0 ? dailyUsage.reduce((s, d) => s + (d.minutes || 0), 0) / dailyUsage.length : 0;
  const avgBarLabel = selectedPeriod === 'today' ? 'Avg Hour' : selectedPeriod === 'all' ? 'Avg Month' : 'Avg Daily';

  const summaryCards = useMemo(() => [
    { label: 'Total Time', value: totals.totalTime, display: `${Math.floor(totals.totalTime / 3600000)}h ${Math.floor((totals.totalTime % 3600000) / 60000)}m`, numeric: false, icon: Clock, accentColor: 'indigo', chipBg: 'rgba(99,102,241,0.14)', iconColor: '#6366f1', gradientFrom: '#6366f1', gradientTo: '#a855f7' },
    { label: 'Total Sessions', value: totals.totalSessions, display: String(totals.totalSessions), numeric: true, icon: Activity, accentColor: 'blue', chipBg: 'rgba(59,130,246,0.14)', iconColor: '#3b82f6', gradientFrom: '#3b82f6', gradientTo: '#6366f1' },
    { label: avgBarLabel, value: formatDuration(avgBarSeconds), display: formatDuration(avgBarSeconds), numeric: false, icon: Timer, accentColor: 'violet', chipBg: 'rgba(139,92,246,0.14)', iconColor: '#8b5cf6', gradientFrom: '#8b5cf6', gradientTo: '#a78bfa' },
    { label: 'Active Apps', value: totals.uniqueApps, display: String(totals.uniqueApps), numeric: true, icon: LayoutGrid, accentColor: 'emerald', chipBg: 'rgba(16,185,129,0.14)', iconColor: '#10b981', gradientFrom: '#10b981', gradientTo: '#34d399' },
  ], [totals.totalTime, totals.totalSessions, totals.uniqueApps, avgBarSeconds, avgBarLabel]);

  const effectivePeriod = timeLock ? 'all' : selectedPeriod;

  const pageContent = (
    <div className={embedded ? 'space-y-6' : ''}>
      {!embedded && (
      <div className="sticky top-0 z-30 -mx-5 px-5 bg-zinc-900/20 backdrop-blur-md border-b border-zinc-800/50 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl grid place-items-center bg-[rgba(99,102,241,0.14)]">
              <Layers className="w-5 h-5 text-[#6366f1]" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
            <span className="text-sm text-zinc-500 font-mono tabular-nums">{timeLock ? 'All Time' : viewLabel}</span>
          </div>
          <div data-tutorial="stats.period" className="flex items-center gap-3">
            <motion.button
              onClick={() => setTimeLock(!timeLock)}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-xs font-medium transition-colors ${
                timeLock
                  ? 'bg-[rgba(99,102,241,0.14)] border border-[rgba(99,102,241,0.40)] text-indigo-300'
                  : 'bg-zinc-900/40 border border-zinc-800/50 text-zinc-400 hover:text-white'
              }`}
              title={timeLock ? 'Unlock timeframe (use nav)' : 'Lock to All Time'}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={timeLock ? 'lock' : 'unlock'}
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5"
                >
                  {timeLock ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>All Time</span>
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>
      )}

      {/* Live tracking indicator — now playing banner */}
      <AnimatePresence>
        {liveCurrentApp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassCard>
              <div className="relative pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-emerald-500" />
                <div className="absolute inset-0 rounded-xl opacity-[0.08] pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,#10b981,transparent_60%)]" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse shadow-emerald-500/30" />
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Now Tracking</div>
                      <div className="text-xl font-semibold text-white">{liveCurrentApp.app}</div>
                    </div>
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[liveCurrentApp.category] || '#64748b'}22`,
                        color: CATEGORY_COLORS[liveCurrentApp.category] || '#64748b',
                        borderColor: `${CATEGORY_COLORS[liveCurrentApp.category] || '#64748b'}40`,
                      }}
                    >
                      {liveCurrentApp.category}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-mono font-bold text-emerald-400 tabular-nums tracking-tight">{formatDuration(liveElapsed)}</div>
                    <div className="text-xs text-zinc-500 mt-1">elapsed</div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Usage Trend — hero chart on top for uniform layout */}
      <GlassCard data-tutorial="stats.charts">
        <DotPattern className="absolute inset-0 text-[var(--page-accent)]" opacity={0.05} radius={1} gap={26} />
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-3">
            {hourlyChartMode === 'bar' ? (
              <BarChart3 className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingUpIcon className="w-5 h-5 text-indigo-400" />
            )}
            <div>
              <div className="text-xl font-extrabold font-display tracking-tight text-white">
                {selectedPeriod === 'today' ? 'Hourly Activity' : 'Daily Usage Trend'}
              </div>
              <div className="text-sm text-zinc-500">
                {selectedPeriod === 'today' ? 'Activity by hour of day' : 'Activity over time'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg">
            <Toggle
              pressed={hourlyChartMode === 'bar'}
              onPressedChange={() => setHourlyChartMode('bar')}
              className={`${hourlyChartMode === 'bar' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}
              aria-label="Bar Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </Toggle>
            <Toggle
              pressed={hourlyChartMode === 'line'}
              onPressedChange={() => setHourlyChartMode('line')}
              className={`${hourlyChartMode === 'line' ? 'bg-indigo-500/20 text-indigo-400' : ''}`}
              aria-label="Line Chart"
            >
              <TrendingUpIcon className="w-4 h-4" />
            </Toggle>
          </div>
        </div>
        <div className="relative h-56">
          {hourlyChartMode === 'bar' ? (
            selectedPeriod === 'today' ? (
              hourlyChartData?.labels?.length ? (
                <Bar data={hourlyChartData} options={hourlyChartOptions} />
              ) : (
                <SectionState kind="empty" chart="bar" message="No hourly data yet" />
              )
            ) : (
              dailyChartData?.labels?.length ? (
                <Bar data={dailyChartData} options={dailyChartOptions} />
              ) : (
                <SectionState kind="empty" chart="bar" message="No daily data yet" />
              )
            )
          ) : (
            selectedPeriod === 'today' ? (
              hourlyLineChartData?.labels?.length ? (
                <Line data={hourlyLineChartData} options={hourlyLineChartOptions} />
              ) : (
                <SectionState kind="empty" chart="line" message="No hourly data yet" />
              )
            ) : (
              dailyChartData?.labels?.length ? (
                <Line data={dailyChartData} options={dailyChartOptions} />
              ) : (
                <SectionState kind="empty" chart="line" message="No daily data yet" />
              )
            )
          )}
        </div>
      </GlassCard>

      {/* Summary Cards — total time / total sessions / avg session / active apps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryCards.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <GlassCard className="h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: stat.chipBg }}>
                  <stat.icon className="w-4.5 h-4.5" style={{ color: stat.iconColor }} />
                </div>
              </div>
              <div className="text-3xl font-semibold tabular-nums tracking-tight text-white">
                {stat.numeric ? <NumberTicker value={stat.value as number} /> : stat.display}
              </div>
              <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500 mt-1">{stat.label}</div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

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
            <SectionState kind="empty" chart="pie" message="No usage recorded for this period" />
          )}
        </GlassCard>

        <div className="flex-1 space-y-4">
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[rgba(99,102,241,0.14)] grid place-items-center">
                  <ListOrdered className="w-4 h-4 text-[#6366f1]" />
                </div>
                <span className="text-xl font-semibold">Top Applications</span>
              </div>
            </div>
            {sortedApps.length > 0 ? (
              <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
                {sortedApps.slice(0, 6).map((app, idx) => {
                  const catColor = CATEGORY_COLORS[app.category] || '#64748b';
                  const pct = appsOnlyTotalMs > 0 ? Math.round((app.total_ms / appsOnlyTotalMs) * 100) : 0;
                  return (
                    <motion.div
                      key={app.app}
                      variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
                      className="group relative flex items-center py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(99,102,241,0.04),transparent_60%)]" />
                      <span className="w-6 font-mono text-xs text-zinc-600 shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: catColor + '22' }}>
                        <Monitor className="w-3.5 h-3.5" style={{ color: catColor }} />
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="font-medium text-sm truncate group-hover:translate-x-0.5 transition-transform duration-150">{app.app}</div>
                        <div className="text-xs" style={{ color: catColor }}>{app.category}</div>
                      </div>
                      <div className="relative ml-4 flex-1 max-w-[120px] self-center">
                        <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-transform duration-600"
                            style={{
                              transform: `scaleX(${pct / 100})`,
                              transformOrigin: 'left',
                              backgroundColor: catColor + '38',
                              borderRight: `1px solid ${catColor}`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className="font-mono text-sm tabular-nums text-white">
                          {Math.floor(app.total_ms / 3600000)}h {Math.floor((app.total_ms % 3600000) / 60000)}m
                        </div>
                        <div className="text-xs text-zinc-500">{pct}%</div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <SectionState kind="empty" message="No applications tracked yet" hint="Start using apps to see them here" />
            )}
          </GlassCard>
        </div>
      </div>

            {/* Category Breakdown */}
      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[rgba(99,102,241,0.14)] grid place-items-center">
              <Tags className="w-4 h-4 text-[#6366f1]" />
            </div>
            <div>
              <div className="text-xl font-semibold">Category Breakdown</div>
              <div className="text-sm text-zinc-500">{viewLabel}</div>
            </div>
          </div>
          <div className="text-xs text-zinc-500">{categoryBreakdown.length} categories</div>
        </div>
        {categoryBreakdown.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryBreakdown.map(({ category, total_ms, pct }) => {
              const catColor = CATEGORY_COLORS[category] || '#64748b';
              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <GlassCard className="group relative overflow-hidden">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(99,102,241,0.06),transparent_60%)]" />
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                    <span className="text-sm font-medium capitalize">{category}</span>
                  </div>
                  <div className="text-xl font-semibold tabular-nums text-white">
                    {Math.floor(total_ms / 60000)}m
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">{pct.toFixed(1)}% of total</div>
                  <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                      style={{ transform: `scaleX(${pct / 100})`, transformOrigin: 'left', backgroundColor: catColor }}
                    />
                  </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <SectionState kind="empty" message="No category data yet" hint="Categories appear once apps are tracked" />
        )}
      </GlassCard>

      {/* Per-App Cards */}
      <GlassCard data-tutorial="stats.list">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[rgba(99,102,241,0.14)] grid place-items-center">
              <AppWindow className="w-4 h-4 text-[#6366f1]" />
            </div>
            <div>
              <div className="text-xl font-semibold">Application Statistics</div>
              <div className="text-sm text-zinc-500">Click an app to view detailed stats</div>
            </div>
          </div>
          <div className="text-xs text-zinc-500">{sortedApps.length} apps</div>
        </div>

        {sortedApps.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
          >
            {sortedApps.map((stat) => {
              const catColor = CATEGORY_COLORS[stat.category] || '#64748b';
              const isSelected = selectedApp === stat.app;
              return (
                <motion.div
                  key={stat.app}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } } }}
                >
                  <GlassCard className={`group relative overflow-hidden cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-zinc-800/80 border-indigo-500/50'
                      : ''
                  }`}
                  onClick={() => setSelectedApp(isSelected ? null : stat.app)}
                  >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(99,102,241,0.06),transparent_60%)]" />
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: catColor + '22' }}
                      >
                        <Monitor className="w-5 h-5" style={{ color: catColor }} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate max-w-[120px]" title={stat.app}>{stat.app}</div>
                        <div className="text-xs" style={{ color: catColor }}>{stat.category}</div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 mt-1 shrink-0 transition-transform duration-200 ${isSelected ? 'rotate-90 text-indigo-400' : 'text-zinc-600'}`} />
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Total Time</span>
                      <span className="font-mono text-white tabular-nums">
                        {Math.floor(stat.total_ms / 3600000)}h {Math.floor((stat.total_ms % 3600000) / 60000)}m
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Sessions</span>
                      <span className="font-mono tabular-nums" style={{ color: catColor }}>{stat.sessions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Avg Session</span>
                      <span className="font-mono text-zinc-300 tabular-nums">{Math.floor(stat.avg_session_ms / 60000)}m</span>
                    </div>
                  </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <SectionState kind="empty" message="No application data yet" hint="Start using your computer to collect data" />
        )}
      </GlassCard>

      {/* Live Detection — collapsed by default, developer/debug tool */}
      <GlassCard>
        <button
          onClick={() => setShowLiveDetection(!showLiveDetection)}
          className="w-full flex items-center justify-between py-1 text-left group"
        >
          <div className="flex items-center gap-2">
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${showLiveDetection ? 'rotate-0' : '-rotate-90'}`} />
            <SectionHeader title="Live Detection" icon={<Terminal className="w-5 h-5 text-emerald-400" />}
              action={<div className="flex items-center gap-2"><span className="text-xs text-zinc-500">{liveLogs.length} events</span></div>}
            />
          </div>
        </button>
        <AnimatePresence>
          {showLiveDetection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <Input
                    value={liveSearchQuery}
                    onChange={e => setLiveSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="pl-8 text-xs"
                  />
                </div>
                <Select
                  value={liveLevelFilter}
                  onValueChange={(v: string) => setLiveLevelFilter(v)}
                >
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="app">App</SelectItem>
                  <SelectItem value="browser">Browser</SelectItem>
                  <SelectItem value="ide">IDE</SelectItem>
                </Select>
              </div>
              <div className="bg-zinc-950/60 rounded-xl border border-zinc-800/50 h-48 overflow-y-auto font-mono text-xs">
                {displayedLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-zinc-500">{liveLogs.length === 0 ? 'Waiting for activity...' : 'No matching logs'}</div>
                      {liveLogs.length === 0 && (
                        <div className="mt-2 text-zinc-600 animate-pulse">_</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {displayedLogs.map((log) => {
                      const levelColor = log.appLevel === 'app' ? '#6366f1' : log.appLevel === 'browser' ? '#3b82f6' : log.appLevel === 'ide' ? '#8b5cf6' : '#3b82f6';
                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, translateY: -6 }}
                          animate={{ opacity: 1, translateY: 0 }}
                          transition={{ duration: 0.2 }}
                          className="grid grid-cols-[auto_auto_1fr_auto] gap-3 items-start py-1.5 px-3 hover:bg-white/[0.02]"
                        >
                          <span className="text-zinc-600">
                            {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span
                            className="shrink-0 px-1.5 py-0.5 rounded font-sans text-[10px] font-medium"
                            style={{ backgroundColor: levelColor + '20', color: levelColor }}
                          >
                            {log.level}
                          </span>
                          <span className="text-blue-400 truncate">{log.app}</span>
                          <span className="text-zinc-600 truncate">{log.category}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
              <div className="relative overflow-hidden rounded-xl">
              <BorderBeam size={120} duration={8} colorFrom="#6366f1" colorTo="#8b5cf6" />
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
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[selectedAppData.stat.category] || '#64748b'}20`,
                        color: CATEGORY_COLORS[selectedAppData.stat.category] || '#64748b',
                        borderColor: `${CATEGORY_COLORS[selectedAppData.stat.category] || '#64748b'}40`,
                      }}
                    >
                      {selectedAppData.stat.category}
                    </Badge>
                  </div>
                </div>
                <button onClick={() => setSelectedApp(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Time', value: `${Math.floor(selectedAppData.stat.total_ms / 3600000)}h ${Math.floor((selectedAppData.stat.total_ms % 3600000) / 60000)}m`, icon: Clock, accentColor: 'indigo', chipBg: 'rgba(99,102,241,0.14)', iconColor: '#6366f1' },
                  { label: 'Sessions', value: selectedAppData.totalSessions, icon: Activity, accentColor: 'emerald', chipBg: 'rgba(16,185,129,0.14)', iconColor: '#10b981' },
                  { label: 'Peak Hour', value: `${selectedAppData.peakHour.hour.toString().padStart(2, '0')}:00`, icon: Zap, accentColor: 'amber', chipBg: 'rgba(245,158,11,0.14)', iconColor: '#f59e0b' },
                  { label: 'Longest Session', value: formatDuration(selectedAppData.longestSession), icon: Award, accentColor: 'violet', chipBg: 'rgba(139,92,246,0.14)', iconColor: '#8b5cf6' },
                ].map((metric, idx) => (
                  <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                    <div className="h-8 w-8 rounded-lg grid place-items-center mb-2.5" style={{ background: metric.chipBg }}>
                      <metric.icon className="w-4.5 h-4.5" style={{ color: metric.iconColor }} />
                    </div>
                    <div className="text-xl font-semibold tabular-nums text-white">{metric.value}</div>
                    <div className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500 mt-1">{metric.label}</div>
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
                                <VoiceInputWrapper>
                                  <input
                                    type="datetime-local"
                                    value={editingAppLogTimes.started_at}
                                    onChange={(e) => setEditingAppLogTimes(prev => ({ ...prev, started_at: e.target.value }))}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                                  />
                                </VoiceInputWrapper>
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-500">End</label>
                                <VoiceInputWrapper>
                                  <input
                                    type="datetime-local"
                                    value={editingAppLogTimes.ended_at}
                                    onChange={(e) => setEditingAppLogTimes(prev => ({ ...prev, ended_at: e.target.value }))}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                                  />
                                </VoiceInputWrapper>
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  if (embedded) return pageContent;
  return (
    <PageShell page="stats">
      <CurrentCanvas accent="#06b6d4" render={renderSignal} />
      <div className="relative z-10">
        {pageContent}
      </div>
    </PageShell>
  );
}
