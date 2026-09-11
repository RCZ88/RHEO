import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { Globe, BarChart3, Clock, TrendingUp, AlertCircle, RefreshCw, X, ChevronLeft, ChevronRight, Activity, Terminal, Save, Play, Pause, TrendingUp as TrendingUpIcon } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { format as dateFormat } from 'date-fns';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { getDateRange, isInRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

// Category colors matching the app's planet color system
const CATEGORY_COLORS: Record<string, string> = {
  'Developer Tools': '#10b981',
  'AI Tools': '#8b5cf6',
  'Social Media': '#f97316',
  'Entertainment': '#ef4444',
  'News': '#eab308',
  'Shopping': '#ec4899',
  'Productivity': '#3b82f6',
  'Design': '#a855f7',
  'Search Engine': '#64748b',
  'Communication': '#14b8a6',
  'Education': '#06b6d4',
  'Uncategorized': '#78716c',
  'Other': '#78716c'
};

const CATEGORIES = ['Developer Tools', 'AI Tools', 'Social Media', 'Entertainment', 'News', 'Shopping', 'Productivity', 'Design', 'Search Engine', 'Communication', 'Education', 'Uncategorized', 'Other'];

function formatDuration(ms: number): string {
  if (ms < 60000) {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  }
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

interface BrowserActivityPageProps {
  selectedPeriod?: Period;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  timeMode?: 'focus' | 'total';
  tierAssignments?: { productive: string[]; neutral: string[]; distracting: string[] };
  allLogs?: unknown[];
}

export default function BrowserActivityPage({ selectedPeriod = 'week', dateOffset = 0, onDateOffsetChange, timeMode = 'total', tierAssignments: tierAssignmentsProp, allLogs }: BrowserActivityPageProps) {
  const [domainStats, setDomainStats] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [browserLogs, setBrowserLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDomainDetail, setSelectedDomainDetail] = useState<any>(null);
  const [detailPeriod, setDetailPeriod] = useState<Period>('week');
  const [detailDateOffset, setDetailDateOffset] = useState(0);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [liveLogs, setLiveLogs] = useState<Array<{id: string; timestamp: number; domain: string; url?: string; title?: string; type: string; level?: string}>>([]);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [mainBrowser, setMainBrowser] = useState<string>('');
  const [availableBrowsers, setAvailableBrowsers] = useState<string[]>([]);
  const [extensionBrowser, setExtensionBrowser] = useState<string>('');
  const [hourlyChartMode, setHourlyChartMode] = useState<'bar' | 'line'>('bar');
  const scrollPosRef = useRef(0);

  // Save scroll position continuously
  useEffect(() => {
    const handleScroll = () => {
      scrollPosRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position when selectedPeriod or dateOffset changes
  useLayoutEffect(() => {
    if (scrollPosRef.current > 0) {
      window.scrollTo(0, scrollPosRef.current);
    }
  }, [selectedPeriod, dateOffset]);

  const currentRange = useMemo(() =>
    getDateRange(selectedPeriod, dateOffset),
    [selectedPeriod, dateOffset]
  );

  const getViewLabel = () => currentRange.label;

  // Detect browsers and load tracking browser preference
  useEffect(() => {
    const init = async () => {
      console.log('[BrowserActivity] Initializing browser tracking...');
      try {
        // Load browser with extension from preferences first
        let extBrowser = '';
        if (window.deskflowAPI?.getPreferences) {
          const prefs = await window.deskflowAPI.getPreferences();
          console.log('[BrowserActivity] Preferences loaded: {browserWithExtension:', prefs?.browserWithExtension, '}');
          if (prefs?.browserWithExtension) {
            extBrowser = prefs.browserWithExtension;
            setExtensionBrowser(extBrowser);
            setMainBrowser(extBrowser);
            console.log('[BrowserActivity] Extension browser from prefs:', extBrowser);
          }
        } else {
          console.log('[BrowserActivity] No getPreferences API');
        }
        
        // Load available browsers from DB only - ONLY show browsers user actually has
        if (window.deskflowAPI?.getTrackedBrowsers) {
          const tracked = await window.deskflowAPI.getTrackedBrowsers();
          console.log('[BrowserActivity] Tracked browsers from DB (user has these):', tracked);
          
          if (tracked && tracked.length > 0) {
            // Remove duplicates (case-insensitive)
            const seen = new Set<string>();
            const uniqueBrowsers = tracked.filter(b => {
              const key = b.toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            
            console.log('[BrowserActivity] User browser apps:', uniqueBrowsers);
            setAvailableBrowsers(uniqueBrowsers);
            
            // If no extension browser set, use first browser from user's list
            if (!extBrowser && uniqueBrowsers.length > 0) {
              setMainBrowser(uniqueBrowsers[0]);
              console.log('[BrowserActivity] Set main browser to:', uniqueBrowsers[0]);
            }
          } else {
            console.log('[BrowserActivity] No browser apps found in DB');
            setAvailableBrowsers([]);
          }
        } else {
          console.log('[BrowserActivity] No getTrackedBrowsers API');
        }
      } catch (err) {
        console.error('[BrowserActivity] Error initializing browser tracking:', err);
      }
    };
    init();
  }, []);
  
  // Set page visibility for on-view recording mode
  useEffect(() => {
    if (window.deskflowAPI?.setPageVisibility) {
      window.deskflowAPI.setPageVisibility('browser', true);
    }
    return () => {
      if (window.deskflowAPI?.setPageVisibility) {
        window.deskflowAPI.setPageVisibility('browser', false);
      }
    };
  }, []);
  
  // Ref to track if component is still mounted - prevents state updates after unmount
  const isMountedRef = useRef(true);
  const liveLogsRef = useRef<Array<{id: string; timestamp: number; domain: string; url?: string; title?: string; type: string; level?: string}>>([]);

  // Listen for live browser tracking events
  useEffect(() => {
    if (!isLiveMode || !window.deskflowAPI?.onBrowserTrackingEvent) return;

    const handleEvent = (data: any) => {
      if (!isMountedRef.current) return;
      
      const newLog = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: data.timestamp || Date.now(),
        domain: data.domain || data.message?.split(' ')[0] || 'unknown',
        url: data.url,
        title: data.title,
        type: data.type,
        level: data.level
      };
      
      // Keep last 50 logs only
      liveLogsRef.current = [...liveLogsRef.current.slice(-49), newLog];
      setLiveLogs([...liveLogsRef.current]);
    };

    window.deskflowAPI.onBrowserTrackingEvent(handleEvent);
  }, [isLiveMode]);

  const handleSaveLogs = () => {
    const content = liveLogs
      .map(log => `[${dateFormat(new Date(log.timestamp), 'HH:mm:ss.SSS')}] ${log.level || 'INFO'}: ${log.domain} ${log.url ? `(${log.url})` : ''} ${log.title ? `- ${log.title}` : ''}`)
      .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `browser-tracking-logs-${dateFormat(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpanded = (domain: string) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      return newSet;
    });
  };

  // Aggregate browser logs by domain
  const aggregatedLogs = useMemo(() => {
    const grouped: Record<string, { sessions: any[]; totalDuration: number }> = {};
    
    browserLogs.forEach(log => {
      const domain = log.domain;
      if (!grouped[domain]) {
        grouped[domain] = { sessions: [], totalDuration: 0 };
      }
      grouped[domain].sessions.push(log);
      grouped[domain].totalDuration += log.duration_ms || 0;
    });
    
    return Object.entries(grouped)
      .map(([domain, data]) => ({
        domain,
        sessions: data.sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        totalDuration: data.totalDuration,
        category: data.sessions[0]?.category || 'Other'
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration);
  }, [browserLogs]);

  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    setError(null);
    try {
      if (!window.deskflowAPI) {
        if (!isMountedRef.current) return;
        setError('DeskFlow API not available');
        setLoading(false);
        return;
      }

      const [domains, categories, logs] = await Promise.all([
        window.deskflowAPI!.getBrowserDomainStats(selectedPeriod, dateOffset),
        window.deskflowAPI!.getBrowserCategoryStats(selectedPeriod, dateOffset),
        window.deskflowAPI!.getBrowserLogs(selectedPeriod, dateOffset)
      ]);

      if (!isMountedRef.current) return;
      setDomainStats(domains || []);
      setCategoryStats(categories || []);
      setBrowserLogs(logs || []);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[BrowserActivity] Error fetching data:', err);
      setError(err.message || 'Failed to load browser data');
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
    }
  }, [selectedPeriod, dateOffset]);

  // Fetch data on mount and when period or dateOffset changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    
    // Auto-refresh every 10 seconds (skip for 'all' to avoid heavy re-fetches)
    const interval = setInterval(() => {
      if (isMountedRef.current && !loading && selectedPeriod !== 'all') {
        fetchData();
      }
    }, 10000);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData, selectedPeriod]);

  const handleCategoryChange = async (domain: string, category: string) => {
    try {
      if (window.deskflowAPI?.setDomainCategory) {
        await window.deskflowAPI.setDomainCategory(domain, category);
        console.log(`[BrowserActivity] Updated ${domain} to ${category}`);
        // Refresh data to see changes
        fetchData();
      }
    } catch (err) {
      console.error('[BrowserActivity] Failed to update category:', err);
    }
    setEditingDomain(null);
    setSelectedCategory('');
  };

  const startEditCategory = (domain: string, currentCategory: string) => {
    setEditingDomain(domain);
    setSelectedCategory(currentCategory);
  };

  // Domain breakdown chart data
  const domainChartData = useMemo(() => {
    const top10 = domainStats.slice(0, 10);
    return {
      labels: top10.map(d => d.domain),
      datasets: [{
        label: 'Time Spent',
        data: top10.map(d => Math.round(d.total_ms / 60000)), // Convert to minutes
        backgroundColor: top10.map(d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']),
        borderColor: top10.map(d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']),
        borderWidth: 1,
        borderRadius: 6
      }]
    };
  }, [domainStats]);

  // Category pie chart data
  const categoryChartData = useMemo(() => {
    return {
      labels: categoryStats.map(c => c.category),
      datasets: [{
        data: categoryStats.map(c => c.total_ms),
        backgroundColor: categoryStats.map(c => CATEGORY_COLORS[c.category] || CATEGORY_COLORS['Other']),
        borderColor: '#18181b',
        borderWidth: 2
      }]
    };
  }, [categoryStats]);

  const domainBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${formatDuration(ctx.raw * 60000)}`,
          title: (items: any) => items[0]?.label || ''
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#71717a',
          callback: (value: any) => `${value}m`
        },
        grid: { color: '#27272a' }
      },
      x: {
        ticks: { color: '#a1a1aa', maxRotation: 45 },
        grid: { display: false }
      }
    }
  };

  const categoryPieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#d4d4d8',
          padding: 15,
          font: { size: 12, family: 'system-ui' },
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const value = data.datasets[0].data[i];
                return {
                  text: `${label}: ${formatDuration(value)}`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor,
                  lineWidth: 2,
                  hidden: false,
                  index: i,
                  fontColor: '#d4d4d8',
                  textStrokeColor: '#d4d4d8'
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        bodyColor: '#d4d4d8',
        titleColor: '#d4d4d8',
        backgroundColor: 'rgba(24, 24, 27, 0.9)',
        titleFont: { color: '#d4d4d8' },
        bodyFont: { color: '#d4d4d8' },
        borderColor: '#27272a',
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => ` ${formatDuration(ctx.raw)}`
        }
      }
    }
  };

  // Hourly/daily distribution computed from browserLogs based on selectedPeriod
  const hourlyDistribution = useMemo(() => {
    const now = new Date();
    const range = currentRange;
    const filteredLogs = (browserLogs as any[]).filter((log: any) =>
      isInRange(log.timestamp, range)
    );

    if (selectedPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, () => 0);
      for (const log of filteredLogs) {
        const sessionStart = new Date(log.timestamp).getTime();
        const sessionEnd = sessionStart + (log.duration_ms || 0);
        let currentMs = sessionStart;
        while (currentMs < sessionEnd) {
          const currentHour = new Date(currentMs).getHours();
          const currentDate = new Date(currentMs);
          const hourStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour).getTime();
          const hourEnd = hourStart + 3600000;
          const segmentStart = Math.max(currentMs, hourStart);
          const segmentEnd = Math.min(sessionEnd, hourEnd);
          const segmentMs = Math.max(0, segmentEnd - segmentStart);
          if (segmentMs > 0 && currentHour >= 0 && currentHour < 24) {
            hourBuckets[currentHour] += segmentMs;
          }
          currentMs = hourStart + 3600000;
        }
      }
      return hourBuckets.map((ms, hour) => ({
        label: `${hour.toString().padStart(2, '0')}:00`,
        ms
      }));
    }

    // For 'all', aggregate by month
    if (selectedPeriod === 'all') {
      const monthBuckets = new Map<string, number>();
      for (const log of filteredLogs) {
        const d = new Date(log.timestamp);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthBuckets.set(monthKey, (monthBuckets.get(monthKey) || 0) + (log.duration_ms || 0));
      }
      return Array.from(monthBuckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, ms]) => {
          const [y, m] = monthKey.split('-');
          const d = new Date(parseInt(y), parseInt(m) - 1);
          return { label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), ms };
        });
    }

    const buckets = new Map<string, number>();
    for (const log of filteredLogs) {
      const dayStr = new Date(log.timestamp).toISOString().split('T')[0];
      buckets.set(dayStr, (buckets.get(dayStr) || 0) + (log.duration_ms || 0));
    }

    const totalDays = Math.round((range.end.getTime() - range.start.getTime()) / 86400000);
    const daysBack = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? totalDays : 90;
    const result: { label: string; ms: number }[] = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(range.start.getTime() + i * 86400000);
      const dayStr = d.toISOString().split('T')[0];
      result.push({
        label: d.toLocaleDateString('en-US', selectedPeriod === 'week' ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
        ms: buckets.get(dayStr) || 0,
      });
    }
    return result;
  }, [browserLogs, selectedPeriod, currentRange]);

  // Bar chart data
  const hourlyChartData = {
    labels: hourlyDistribution.map(h => h.label),
    datasets: [{
      label: 'Duration',
      data: hourlyDistribution.map(h => h.ms),
      backgroundColor: hourlyDistribution.map((_, i) => {
        if (selectedPeriod === 'today') {
          const currentHour = new Date().getHours();
          return i === currentHour ? '#10b981' : 'rgba(99, 102, 241, 0.6)';
        }
        return 'rgba(99, 102, 241, 0.6)';
      }),
      borderColor: hourlyDistribution.map((_, i) => {
        if (selectedPeriod === 'today') {
          const currentHour = new Date().getHours();
          return i === currentHour ? '#059669' : '#6366f1';
        }
        return '#6366f1';
      }),
      borderWidth: 1,
      borderRadius: 4,
    }]
  };

  const hourlyChartOptions = {
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
        ticks: { color: '#71717a', maxTicksLimit: selectedPeriod === 'today' ? 12 : selectedPeriod === 'week' ? 7 : selectedPeriod === 'all' ? 24 : 15 }
      },
      y: {
        grid: { color: '#27272a' },
        ticks: {
          color: '#71717a',
          callback: (v: any) => formatDuration(v),
        },
        beginAtZero: true,
      }
    },
  };

  // Line chart version
  const hourlyLineChartData = {
    labels: hourlyDistribution.map(h => h.label),
    datasets: [{
      label: 'Duration',
      data: hourlyDistribution.map(h => h.ms),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      fill: true,
      tension: 0.3,
      pointBackgroundColor: hourlyDistribution.map((_, i) => {
        if (selectedPeriod === 'today') {
          const currentHour = new Date().getHours();
          return i === currentHour ? '#10b981' : '#6366f1';
        }
        return '#6366f1';
      }),
      pointBorderColor: hourlyDistribution.map((_, i) => {
        if (selectedPeriod === 'today') {
          const currentHour = new Date().getHours();
          return i === currentHour ? '#059669' : '#6366f1';
        }
        return '#6366f1';
      }),
      pointRadius: selectedPeriod === 'today' ? 4 : 2,
      pointHoverRadius: 6,
    }]
  };

  // Total browser time
  const totalBrowserTime = domainStats.reduce((sum, d) => sum + d.total_ms, 0);
  const totalSessions = domainStats.reduce((sum, d) => sum + d.sessions, 0);

  // Detail daily breakdown for selected domain
  const selectedDomainName = selectedDomainDetail?.domain || '';
  const detailDomainLogs = useMemo(() => {
    if (!selectedDomainName) return [];
    const source = (allLogs as any[]) || [];
    const range = getDateRange(detailPeriod, detailDateOffset);
    return source
      .filter((log: any) => {
        const name = log.app || log.domain || log.title || '';
        return name.toLowerCase().includes(selectedDomainName.toLowerCase())
          && log.timestamp >= range.start && log.timestamp < range.end;
      })
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedDomainName, detailPeriod, detailDateOffset, allLogs]);

  const detailDailyChart = useMemo(() => {
    if (!selectedDomainName || detailDomainLogs.length === 0) return null;
    const logsByDate = new Map<string, number>();
    for (const log of detailDomainLogs) {
      const key = format(new Date(log.timestamp), 'yyyy-MM-dd');
      logsByDate.set(key, (logsByDate.get(key) || 0) + (log.duration || 0));
    }

    if (detailPeriod === 'all') {
      const monthMap = new Map<string, number>();
      for (const log of detailDomainLogs) {
        const key = format(new Date(log.timestamp), 'yyyy-MM');
        monthMap.set(key, (monthMap.get(key) || 0) + (log.duration || 0));
      }
      const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      return { labels: sorted.map(([k]) => format(new Date(k + '-01'), 'MMM yy')), data: sorted.map(([, v]) => v * 1000) };
    }

    if (detailPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, () => 0);
      for (const log of detailDomainLogs) {
        const sessionStart = new Date(log.timestamp).getTime();
        const sessionEnd = sessionStart + ((log.duration || 0) * 1000);
        let currentMs = sessionStart;
        while (currentMs < sessionEnd) {
          const hourStart = Math.floor(currentMs / 3600000) * 3600000;
          const hourEnd = hourStart + 3600000;
          const currentHour = new Date(hourStart).getHours();
          const segStart = Math.max(currentMs, hourStart);
          const segEnd = Math.min(sessionEnd, hourEnd);
          if (segEnd > segStart && currentHour >= 0 && currentHour < 24) {
            hourBuckets[currentHour] += (segEnd - segStart);
          }
          currentMs = hourEnd;
        }
      }
      return { labels: hourBuckets.map((_, i) => `${i.toString().padStart(2, '0')}:00`), data: hourBuckets };
    }

    const range = getDateRange(detailPeriod, detailDateOffset);
    const labels: string[] = [];
    const data: number[] = [];
    const cursor = new Date(range.start);
    while (cursor < range.end) {
      const dayStr = format(cursor, 'yyyy-MM-dd');
      labels.push(detailPeriod === 'week' || detailPeriod === '7day' ? format(cursor, 'EEE') : format(cursor, 'MMM dd'));
      data.push((logsByDate.get(dayStr) || 0) * 1000);
      cursor.setDate(cursor.getDate() + 1);
    }
    return { labels, data };
  }, [selectedDomainName, detailDomainLogs, detailPeriod, detailDateOffset]);

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: '7day', label: '7 Day' },
    { key: 'month', label: 'Month' },
    { key: '30day', label: '30 Day' },
    { key: 'all', label: 'All' },
  ];

  if (loading) {
    return <PageShell page="browser"><LoadingState variant="spinner" className="py-24" /></PageShell>;
  }

  if (error) {
    return (
      <PageShell page="browser">
        <GlassCard>
          <div className="text-center py-8">
            <AlertCircle className="mx-auto w-12 h-12 mb-4 text-red-500" />
            <div className="text-red-400 font-medium">Error loading browser data</div>
            <div className="text-sm text-zinc-500 mt-2">{error}</div>
            <button onClick={fetchData} className="mt-4 px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-sm transition">Retry</button>
          </div>
        </GlassCard>
      </PageShell>
    );
  }

  return (
    <PageShell page="browser">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Globe className="text-blue-500" />
            Browser Activity
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Track your browsing habits by domain and category</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period label */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium px-2 min-w-[80px] text-center text-zinc-400">
              {getViewLabel()}
            </span>
          </div>

          {/* Main Browser Config */}
              <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-400" />
                <span className="text-sm text-zinc-300">Tracking Browser</span>
              </div>
              <select data-tutorial="browser.selector"
                value={mainBrowser}
                onChange={async (e) => {
                  const newBrowser = e.target.value;
                  setMainBrowser(newBrowser);
                  if (window.deskflowAPI?.setBrowserWithExtension) {
                    await window.deskflowAPI.setBrowserWithExtension(newBrowser);
                    setExtensionBrowser(newBrowser);
                    console.log('[BrowserActivity] Saved extension browser:', newBrowser);
                  }
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {availableBrowsers.length === 0 ? (
                  <option value="">No browsers found</option>
                ) : (
                  availableBrowsers.map(browser => {
                    const isExtensionBrowser = browser.toLowerCase() === extensionBrowser.toLowerCase();
                    console.log('[BrowserActivity] Rendering option:', browser, 'isExtension?', isExtensionBrowser);
                    return (
                      <option key={browser} value={browser}>
                        {browser.charAt(0).toUpperCase() + browser.slice(1)}{isExtensionBrowser ? ' ★ (with extension)' : ''}
                      </option>
                    );
                  })
                )}
              </select>
              <span className="text-xs text-zinc-500 ml-2">
                {mainBrowser ? `Excludes ${mainBrowser.charAt(0).toUpperCase() + mainBrowser.slice(1)} browsing time from stats (tracked via extension instead)` : 'Loading...'}
              </span>
            </div>
          </GlassCard>

          <button
            onClick={fetchData}
            className="px-4 py-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 text-sm flex items-center gap-2 transition"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Clock className="text-blue-500" size={20} />
            <span className="text-sm text-zinc-400">Total Browsing Time</span>
          </div>
          <div className="text-3xl font-bold font-mono">{formatDuration(totalBrowserTime)}</div>
          <div className="text-xs text-zinc-500 mt-1">Across all sessions</div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <Globe className="text-emerald-500" size={20} />
            <span className="text-sm text-zinc-400">Unique Domains</span>
          </div>
          <div className="text-3xl font-bold font-mono">{domainStats.length}</div>
          <div className="text-xs text-zinc-500 mt-1">Different websites visited</div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="text-purple-500" size={20} />
            <span className="text-sm text-zinc-400">Browsing Sessions</span>
          </div>
          <div className="text-3xl font-bold font-mono">{totalSessions}</div>
        </GlassCard>
      </div>

       {/* Live Logs Panel */}
       <GlassCard>
         <SectionHeader title="Live Detection" icon={<Terminal className="w-5 h-5" />}
           action={
             <div className="flex items-center gap-2">
               <span className="text-xs text-zinc-500">{liveLogs.length} events</span>
               <button onClick={handleSaveLogs} disabled={liveLogs.length === 0}
                 className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-xs flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed">
                 <Save size={12} /> Save
               </button>
             </div>
           } />

         <div className="bg-zinc-950 rounded-xl border border-zinc-800/50 p-3 h-48 overflow-y-auto font-mono text-xs">
           {liveLogs.length === 0 ? (
             <div className="text-zinc-500 text-center py-8">Live detection paused</div>
           ) : (
             <div className="space-y-1">
               {liveLogs.slice().reverse().map((log) => (
                 <div key={log.id} className="flex items-start gap-2">
                   <span className="text-zinc-600 shrink-0">
                     {dateFormat(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                   </span>
                   <span className={`shrink-0 px-1.5 py-0.5 rounded ${
                     log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                     log.level === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                     'bg-emerald-500/20 text-emerald-400'
                   }`}>
                     {log.level || 'INFO'}
                   </span>
                   <span className="text-blue-400">{log.domain}</span>
                   {log.title && <span className="text-zinc-500 truncate">{log.title}</span>}
                 </div>
               ))}
             </div>
           )}
         </div>
       </GlassCard>

      {/* Hourly Activity Chart */}
      <GlassCard>
        <SectionHeader title={selectedPeriod === 'today' ? 'Hourly Activity' : 'Daily Usage Trend'}
          icon={hourlyChartMode === 'bar' ? <BarChart3 className="w-5 h-5" /> : <TrendingUpIcon className="w-5 h-5" />}
          action={
            <div data-tutorial="browser.toggle" className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg">
              <button onClick={() => setHourlyChartMode('bar')}
                className={`p-2 rounded-md transition-colors duration-150 ${hourlyChartMode === 'bar' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
                title="Bar Chart"><BarChart3 className="w-4 h-4" /></button>
              <button onClick={() => setHourlyChartMode('line')}
                className={`p-2 rounded-md transition-colors duration-150 ${hourlyChartMode === 'line' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-400 hover:text-white'}`}
                title="Line Chart"><TrendingUpIcon className="w-4 h-4" /></button>
            </div>
          } />
        <p className="text-xs text-zinc-500 mb-4">
          {selectedPeriod === 'today' ? 'Activity by hour of day' : selectedPeriod === 'all' ? 'All time activity by month' : `${selectedPeriod === 'week' ? '7 days' : selectedPeriod === 'month' ? '30 days' : '90 days'} of activity`}
        </p>
        <div className="h-56">
          {hourlyChartMode === 'bar' ? <Bar data={hourlyChartData} options={hourlyChartOptions} /> : <Line data={hourlyLineChartData} options={hourlyChartOptions} />}
        </div>
      </GlassCard>

      {/* Charts Row */}
      {categoryStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard>
            <SectionHeader title="Time by Category" icon={<BarChart3 className="w-5 h-5" />} />
            <div className="h-72">
              <Pie data={categoryChartData} options={categoryPieOptions} />
            </div>
          </GlassCard>

          <GlassCard>
            <SectionHeader title="Top Domains" icon={<TrendingUp className="w-5 h-5" />} />
            <div className="h-72">
              <Bar data={domainChartData} options={domainBarOptions} />
            </div>
          </GlassCard>
        </div>
      )}

      {/* Recent Activity - Aggregated by domain with dropdown */}
      <GlassCard>
        <SectionHeader title="Recent Activity"
          action={aggregatedLogs.length > 0 && <span className="text-xs text-zinc-500">{aggregatedLogs.length} sites</span>} />
        {aggregatedLogs.length === 0 ? (
          <div className="text-center py-4 text-zinc-500">
            No recent browsing activity
          </div>
        ) : (
          <div className="space-y-2">
            {aggregatedLogs.slice(0, 6).map((item, idx) => {
              const isExpanded = expandedDomains.has(item.domain);
              return (
                <div
                  key={item.domain}
                  className="bg-zinc-900/50 rounded-xl hover:bg-zinc-800/50 transition"
                >
                  <div 
                    className="flex items-center justify-between py-2 px-4 cursor-pointer"
                    onClick={() => toggleExpanded(item.domain)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Other'] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{item.domain}</div>
                        {item.sessions.length > 1 && (
                          <div className="text-xs text-zinc-500">{item.sessions.length} sessions</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4 flex items-center gap-3">
                      <div>
                        <div className="text-sm font-mono text-white">{formatDuration(item.totalDuration)}</div>
                        <div className="text-xs text-zinc-500">
                          {format(new Date(item.sessions[0]?.timestamp || Date.now()), 'HH:mm')}
                        </div>
                      </div>
                      <ChevronRight 
                        className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                      />
                    </div>
                  </div>
                  {isExpanded && item.sessions.length > 1 && (
                    <div className="px-4 pb-3 border-t border-zinc-800/50">
                      <div className="pt-2 space-y-1">
                        {item.sessions.slice(0, 5).map((session, sidx) => (
                          <div key={sidx} className="flex items-center justify-between text-xs">
                            <div className="text-zinc-400 truncate max-w-[200px]">
                              {session.title || session.url || session.domain}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-zinc-300">{formatDuration(session.duration_ms)}</span>
                              <span className="text-zinc-600">
                                {format(new Date(session.timestamp), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                        ))}
                        {item.sessions.length > 5 && (
                          <div className="text-xs text-zinc-500 pt-1">
                            +{item.sessions.length - 5} more sessions
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Domain Breakdown - Grid Layout */}
      <GlassCard data-tutorial="browser.domains">
                <SectionHeader title="Domain Breakdown" />
        {domainStats.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Globe className="mx-auto w-12 h-12 mb-3 text-zinc-700" />
            <div>{timeMode === 'focus' ? 'No productive browsing data' : 'No browsing data yet'}</div>
            <div className="text-xs mt-1">{timeMode === 'focus' ? 'Switch to Total mode to see all websites' : 'Install the browser extension and start browsing to see data here'}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {domainStats.map((d, i) => (
              <div
                key={d.domain}
                className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50 hover:border-zinc-700 cursor-pointer transition"
                onClick={() => setSelectedDomainDetail(d)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other'] }}
                    />
                    <div className="font-medium text-white truncate">{d.domain}</div>
                  </div>
                  <div
                    className="px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']}20`,
                      color: CATEGORY_COLORS[d.category] || CATEGORY_COLORS['Other']
                    }}
                  >
                    {d.category}
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Time</span>
                    <span className="font-mono text-white">{formatDuration(d.total_ms)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Sessions</span>
                    <span className="font-mono text-emerald-400">{d.sessions}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Domain Detail Modal */}
      {selectedDomainDetail && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-5"
            onClick={() => setSelectedDomainDetail(null)}
          >
            <GlassCard variant="elevated" className="w-full max-w-3xl max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: (CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other']) + '22' }}
                  >
                    <Globe
                      className="w-7 h-7"
                      style={{ color: CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other'] }}
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold">{selectedDomainDetail.domain}</h2>
                    <div className="text-sm" style={{ color: CATEGORY_COLORS[selectedDomainDetail.category] || CATEGORY_COLORS['Other'] }}>
                      {selectedDomainDetail.category}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedDomainDetail(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Time', value: formatDuration(selectedDomainDetail.total_ms), icon: Clock, color: 'text-emerald-400' },
                  { label: 'Sessions', value: selectedDomainDetail.sessions, icon: Activity, color: 'text-indigo-400' },
                  { label: 'Avg Session', value: formatDuration(selectedDomainDetail.total_ms / selectedDomainDetail.sessions), icon: TrendingUp, color: 'text-amber-400' },
                  { label: 'First Seen', value: selectedDomainDetail.first_seen ? format(new Date(selectedDomainDetail.first_seen), 'MMM dd') : 'N/A', icon: BarChart3, color: 'text-violet-400' },
                ].map((metric, idx) => (
                  <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                    <metric.icon className={`w-5 h-5 ${metric.color} mb-2`} />
                    <div className={`text-xl font-semibold tabular-nums ${metric.color}`}>{metric.value}</div>
                    <div className="text-xs text-zinc-500 mt-1">{metric.label}</div>
                  </div>
                ))}
              </div>

              {/* Period selector + daily chart */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailDateOffset(d => d - 1)}
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

              {detailDailyChart && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Daily Usage</h3>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels: detailDailyChart.labels,
                        datasets: [{
                          label: 'Duration',
                          data: detailDailyChart.data,
                          backgroundColor: (CATEGORY_COLORS[selectedDomainDetail.category] || '#6366f1') + '88',
                          borderColor: CATEGORY_COLORS[selectedDomainDetail.category] || '#6366f1',
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
                            ticks: { color: '#71717a', callback: (v: any) => formatDuration(v) },
                            beginAtZero: true
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        )}
    </PageShell>
  );
}
