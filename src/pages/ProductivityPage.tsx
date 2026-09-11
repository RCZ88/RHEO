import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Target, TrendingUp, TrendingDown, Clock, Award, Zap,
  Monitor, Globe, BarChart3, Info, Timer, Eye, EyeOff,
  PieChart as PieChartIcon, ArrowUp, ArrowDown, Minus,
  ChevronRight, ChevronDown, ChevronLeft, Activity, Layers
} from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { format, eachDayOfInterval, startOfDay, isToday } from 'date-fns';
import { getDateRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { MagicCard } from '../components/ui/magic-card';
import { SectionHeader } from '../components/SectionHeader';
import { NumberTicker } from '../components/ui/number-ticker';
import { DotPattern } from '../components/ui/dot-pattern';
import { AnimatedGradientText } from '../components/ui/animated-gradient-text';
import { Badge } from '../components/ui/badge';
import { glassBackdrop, centerText, makeGradient, sharedTooltipStyle, sharedScales, barAnimation, pieAnimation } from '../lib/chart-plugins';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler, glassBackdrop, centerText);

// Website category to app category mapping
const WEBSITE_CATEGORY_MAP: Record<string, string> = {
  'Developer Tools': 'Tools', // Map to Tools for productive tier
  'AI Tools': 'AI Tools',
  'Social Media': 'Social Media',
  'Entertainment': 'Entertainment',
  'News': 'News',
  'Shopping': 'Shopping',
  'Productivity': 'Productivity',
  'Design': 'Design',
  'Search Engine': 'Productivity', // Search engines can be productive
  'Communication': 'Communication',
  'Education': 'Education',
  'Uncategorized': 'Uncategorized',
  'Other': 'Other'
};

// Default tier assignments (must match actual app categories + website categories)
const DEFAULT_TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Browser', 'Communication', 'Design', 'News', 'Search Engine', 'Uncategorized', 'Other'],
  distracting: ['Entertainment', 'Social Media', 'Shopping']
};

// Tier weights for productivity calculation
const TIER_WEIGHTS = {
  productive: 1.0,
  neutral: 0.5,
  distracting: 0.0
};

interface AppStat {
  app: string;
  category: string;
  total_ms: number;
  sessions: number;
  avg_session_ms: number;
}

interface BrowserStat {
  domain: string;
  category: string;
  total_ms: number;
  sessions: number;
}

interface ExternalSession {
  id: number;
  activity_id: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  activity_name: string;
  type: string;
  color: string;
}

interface FocusSession {
  id: number;
  started_at: string;
  ended_at: string | null;
  planned_sec: number;
  actual_sec: number | null;
  outcome: string;
  strictness: string;
  broke_on_type: string | null;
  broke_on_name: string | null;
}

interface ProductivityPageProps {
  embedded?: boolean;
  appStats?: AppStat[];
  browserStats?: BrowserStat[];
  logs?: unknown[];
  browserLogs?: unknown[];
  tierAssignments?: typeof DEFAULT_TIER_ASSIGNMENTS;
  selectedPeriod?: Period;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  domainKeywordRules?: Record<string, string[]>;
  timeMode?: 'focus' | 'total';
  externalActivities?: { id: number; name: string; type: string; is_productive: boolean }[];
  externalActivityTiers?: Record<number, string>;
  platformFilter?: string;
  compareMode?: boolean;
  availablePlatforms?: string[];
}

interface AppStat {
  app: string;
  category: string;
  total_ms: number;
  sessions: number;
  avg_session_ms: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHours(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = (seconds / 3600).toFixed(1);
  return `${h}h`;
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'IDE': '#6366f1',
    'AI Tools': '#8b5cf6',
    'Education': '#10b981',
    'Productivity': '#14b8a6',
    'Tools': '#f59e0b',
    'Browser': '#3b82f6',
    'Communication': '#14b8a6',
    'Design': '#ec4899',
    'News': '#f97316',
    'Search Engine': '#3b82f6',
    'Entertainment': '#ef4444',
    'Social Media': '#64748b',
    'Shopping': '#f97316',
    'Uncategorized': '#71717a',
    'Other': '#71717a',
    'Developer Tools': '#6366f1'
  };
  return colors[category] || '#71717a';
}

export default function ProductivityPage({
  embedded,
  appStats = [],
  logs = [],
  browserLogs: browserLogsProp = [],
  tierAssignments = DEFAULT_TIER_ASSIGNMENTS,
  selectedPeriod = 'week',
  dateOffset = 0,
  onDateOffsetChange,
  domainKeywordRules = {},
  timeMode = 'total',
  externalActivities = [],
  externalActivityTiers = {},
  platformFilter = 'all',
  compareMode = false,
  availablePlatforms = []
}: ProductivityPageProps) {
  // Cleanup Chart.js instances on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Chart instances are automatically destroyed by react-chartjs-2 on unmount
      // but we clear any global references
      console.log('[ProductivityPage] Cleaning up on unmount');
    };
  }, []);

  const getViewLabel = () => getDateRange(selectedPeriod, dateOffset).label;

  // Persisted expand state for website domains
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('productivity-expanded-domains');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // Tier filter state - to show apps/websites by productivity category
  const [tierFilter, setTierFilter] = useState<'all' | 'productive' | 'neutral' | 'distracting'>('all');

  // External sessions state
  const [allExternalSessions, setAllExternalSessions] = useState<ExternalSession[]>([]);

  // Focus sessions state
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);

  // Exclude external toggle (localStorage-backed)
  const [excludeExternal, setExcludeExternal] = useState<boolean>(() => {
    try { return localStorage.getItem('productivity-exclude-external') === 'true'; }
    catch { return false; }
  });

  const toggleExcludeExternal = useCallback((checked: boolean) => {
    setExcludeExternal(checked);
    try { localStorage.setItem('productivity-exclude-external', String(checked)); } catch {}
  }, []);

  // Load external sessions
  useEffect(() => {
    if (window.deskflowAPI?.getExternalSessions) {
      window.deskflowAPI.getExternalSessions('all').then(setAllExternalSessions);
    }
    const handleRefresh = () => {
      if (window.deskflowAPI?.getExternalSessions) {
        window.deskflowAPI.getExternalSessions('all').then(setAllExternalSessions);
      }
    };
    window.addEventListener('external-data-changed', handleRefresh);
    return () => window.removeEventListener('external-data-changed', handleRefresh);
  }, []);

  // Load focus sessions
  useEffect(() => {
    if (window.deskflowAPI?.focus?.history) {
      window.deskflowAPI.focus.history({ limit: 500 }).then((data: any[]) => {
        setFocusSessions((data || []).filter((s: any) => s.ended_at));
      });
    }
  }, []);

  // Map external activity id → configured tier (productive/neutral/distracting)
  const externalTierMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const act of externalActivities) {
      map[act.id] = externalActivityTiers[act.id] || 'neutral';
    }
    return map;
  }, [externalActivities, externalActivityTiers]);

  // Platform-filtered logs
  const platformLogs = useMemo(() => {
    if (platformFilter === 'all') return (logs as any[]);
    return (logs as any[]).filter(l => l.platform === platformFilter);
  }, [logs, platformFilter]);

  const platformBrowserLogs = useMemo(() => {
    if (platformFilter === 'all') return (browserLogsProp as any[]);
    return (browserLogsProp as any[]).filter(l => l.platform === platformFilter);
  }, [browserLogsProp, platformFilter]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      localStorage.setItem('productivity-expanded-domains', JSON.stringify([...newSet]));
      return newSet;
    });
  };

  // Compute browserStats from browserLogs prop (passed from parent App.tsx)
  const browserStats = useMemo(() => {
    const grouped: Record<string, { domain: string; category: string; total_ms: number; sessions: number; avg_session_ms: number }> = {};
    for (const log of browserLogsProp) {
      const domain = (log as any).domain || 'Unknown';
      const category = (log as any).category || 'Uncategorized';
      const duration_ms = ((log as any).duration || 0) * 1000;

      if (!grouped[domain]) {
        grouped[domain] = { domain, category, total_ms: 0, sessions: 0, avg_session_ms: 0 };
      }
      grouped[domain].total_ms += duration_ms;
      grouped[domain].sessions += 1;
    }

    const stats = Object.values(grouped);
    for (const stat of stats) {
      stat.avg_session_ms = stat.sessions > 0 ? stat.total_ms / stat.sessions : 0;
    }
    return stats;
  }, [browserLogsProp]);

  // Compute all websites grouped by domain for the websites section
  const allWebsites = useMemo(() => {
    const range = getDateRange(selectedPeriod, dateOffset);
    const allLogs = (platformBrowserLogs as any[]).filter((log: any) => {
      const t = new Date(log.timestamp || log.start_time).getTime();
      return t >= range.start.getTime() && t < range.end.getTime();
    });

    // Group by domain
    const grouped: Record<string, any[]> = {};
    for (const log of allLogs) {
      const domain = (log as any).domain || 'Unknown';
      if (!grouped[domain]) {
        grouped[domain] = [];
      }
      grouped[domain].push(log);
    }

    // Create domain stats
    const domainStats = Object.entries(grouped).map(([domain, logs]) => {
      const totalSeconds = logs.reduce((sum, log) => sum + ((log as any).duration || 0), 0);

      // Calculate dominant category for the domain
      const categoryDurations: Record<string, number> = {};
      for (const log of logs) {
        const cat = WEBSITE_CATEGORY_MAP[(log as any).category] || (log as any).category || 'Other';
        categoryDurations[cat] = (categoryDurations[cat] || 0) + ((log as any).duration || 0);
      }

      // Find dominant category (highest duration)
      const dominantCategory = Object.entries(categoryDurations)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Other';

      // Sort logs by duration (highest first)
      const sortedLogs = [...logs].sort((a, b) => (b as any).duration - (a as any).duration);

      return {
        domain,
        totalSeconds,
        dominantCategory,
        logs: sortedLogs,
        hasKeywordRules: !!domainKeywordRules[domain]
      };
    });

    // Sort domains by total time (highest first)
    return domainStats.sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [browserLogsProp, selectedPeriod, dateOffset, tierAssignments, domainKeywordRules]);

  // Filtered websites based on tier filter
  const filteredWebsites = useMemo(() => {
    return allWebsites.filter(site => {
      const siteTier = tierAssignments.productive.includes(site.dominantCategory) ? 'productive' :
        tierAssignments.distracting.includes(site.dominantCategory) ? 'distracting' : 'neutral';
      return tierFilter === 'all' || siteTier === tierFilter;
    });
  }, [allWebsites, tierFilter, tierAssignments]);

  // Calculate combined productivity data
  const productivityData = useMemo(() => {
    const range = getDateRange(selectedPeriod, dateOffset);

    // Filter raw logs by date range
    const filteredLogs = (platformLogs as any[]).filter((log: any) => {
      const t = new Date(log.timestamp || log.start_time).getTime();
      return t >= range.start.getTime() && t < range.end.getTime();
    });
    const filteredBrowserLogs = (platformBrowserLogs as any[]).filter((log: any) => {
      const t = new Date(log.timestamp || log.start_time).getTime();
      return t >= range.start.getTime() && t < range.end.getTime();
    });

    // Compute app items from filtered raw logs
    const appMap: Record<string, { total_ms: number; category: string }> = {};
    filteredLogs.forEach((log: any) => {
      if (log.is_browser_tracking) return;
      const name = log.app || 'Unknown';
      if (!appMap[name]) appMap[name] = { total_ms: 0, category: log.category || 'Other' };
      appMap[name].total_ms += log.duration_ms || ((log.duration || 0) * 1000);
    });
    const appItems = Object.entries(appMap).map(([name, data]) => ({
      name, category: data.category, type: 'app' as const, duration_sec: data.total_ms / 1000
    }));

    // Compute browser items from filtered raw logs
    const browserMap: Record<string, { total_ms: number; category: string }> = {};
    filteredBrowserLogs.forEach((log: any) => {
      const name = log.domain || 'Unknown';
      if (!browserMap[name]) browserMap[name] = { total_ms: 0, category: log.category || 'Other' };
      browserMap[name].total_ms += log.duration_ms || ((log.duration || 0) * 1000);
    });
    const browserItems = Object.entries(browserMap).map(([name, data]) => ({
      name, category: WEBSITE_CATEGORY_MAP[data.category] || 'Other', originalCategory: data.category, type: 'website' as const, duration_sec: data.total_ms / 1000
    }));

    // Compute external items from filtered external sessions
    const filteredExtSessions = (allExternalSessions || []).filter((session: any) => {
      const t = new Date(session.started_at).getTime();
      return t >= range.start.getTime() && t < range.end.getTime();
    });

    const externalItems = filteredExtSessions.map((session: any) => {
      return {
        name: session.activity_name || 'Unknown',
        category: session.activity_name || 'Other',
        type: 'external' as const,
        activity_id: session.activity_id,
        duration_sec: session.duration_seconds || 0,
      };
    });

    // Compute focus items from filtered focus sessions
    const filteredFocusSessions = (focusSessions || []).filter((session: any) => {
      const t = new Date(session.started_at).getTime();
      return t >= range.start.getTime() && t < range.end.getTime();
    });

    const focusItems = filteredFocusSessions.map((session: any) => {
      const dur = session.actual_sec || 0;
      return {
        name: session.strictness === 'non_allowed' ? 'Deep Focus' : 'Focus Session',
        category: session.outcome === 'completed' ? 'Productivity' : session.outcome === 'failed' ? 'Entertainment' : 'Other',
        type: 'focus' as const,
        activity_id: -1,
        duration_sec: dur,
        _outcome: session.outcome,
      };
    });

    // Combine all items - exclude external if toggle is off
    const allItems = [...appItems, ...browserItems, ...(excludeExternal ? [] : externalItems), ...focusItems];

    // Calculate totals by tier
    const tierTotals = {
      productive: { seconds: 0, items: [] as typeof allItems },
      neutral: { seconds: 0, items: [] as typeof allItems },
      distracting: { seconds: 0, items: [] as typeof allItems }
    };

    for (const item of allItems) {
      let assignedTier: 'productive' | 'neutral' | 'distracting' | null = null;

      if (item.type === 'focus') {
        // Focus: completed=productive, failed/aborted=distracting, active=neutral
        const outcome = (item as any)._outcome;
        assignedTier = outcome === 'completed' ? 'productive' : outcome === 'failed' ? 'distracting' : 'neutral';
      } else if (item.type === 'external') {
        assignedTier = (externalTierMap[(item as any).activity_id] || 'neutral') as 'productive' | 'neutral' | 'distracting';
      } else if (tierAssignments.productive.includes(item.category)) {
        assignedTier = 'productive';
      } else if (tierAssignments.neutral.includes(item.category)) {
        assignedTier = 'neutral';
      } else if (tierAssignments.distracting.includes(item.category)) {
        assignedTier = 'distracting';
      } else {
        assignedTier = 'neutral';
      }

      tierTotals[assignedTier].seconds += item.duration_sec;
      tierTotals[assignedTier].items.push(item);
    }

    // Calculate weighted score
    const totalSeconds = tierTotals.productive.seconds + tierTotals.neutral.seconds + tierTotals.distracting.seconds;
    const weightedSeconds =
      tierTotals.productive.seconds * TIER_WEIGHTS.productive +
      tierTotals.neutral.seconds * TIER_WEIGHTS.neutral +
      tierTotals.distracting.seconds * TIER_WEIGHTS.distracting;

    const productivityScore = totalSeconds > 0 ? (weightedSeconds / totalSeconds) * 100 : 0;

    // Calculate app vs website breakdown
    const appTotalSec = appItems.reduce((sum, a) => sum + a.duration_sec, 0);
    const websiteTotalSec = browserItems.reduce((sum, b) => sum + b.duration_sec, 0);

    // App vs Website productivity breakdown
    const appProductiveSec = appItems.filter(i => tierAssignments.productive.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
    const appNeutralSec = appItems.filter(i => tierAssignments.neutral.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
    const appDistractingSec = appItems.filter(i => tierAssignments.distracting.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
    const webProductiveSec = browserItems.filter(i => tierAssignments.productive.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
    const webNeutralSec = browserItems.filter(i => tierAssignments.neutral.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
    const webDistractingSec = browserItems.filter(i => tierAssignments.distracting.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);

    const appScore = appTotalSec > 0 ? ((appProductiveSec * 1.0 + appNeutralSec * 0.5) / appTotalSec) * 100 : 0;
    const webScore = websiteTotalSec > 0 ? ((webProductiveSec * 1.0 + webNeutralSec * 0.5) / websiteTotalSec) * 100 : 0;

    // Top items by tier (sorted by duration)
    const topProductive = [...tierTotals.productive.items]
      .sort((a, b) => b.duration_sec - a.duration_sec)
      .slice(0, 10);

    const topNeutral = [...tierTotals.neutral.items]
      .sort((a, b) => b.duration_sec - a.duration_sec)
      .slice(0, 10);

    const topDistracting = [...tierTotals.distracting.items]
      .sort((a, b) => b.duration_sec - a.duration_sec)
      .slice(0, 10);

    // Calculate sum of displayed items (for accurate header display)
    const displayedAppItems = topProductive.filter(i => i.type === 'app');
    const displayedWebsiteItems = topProductive.filter(i => i.type === 'website');
    const displayedAppTotalSec = displayedAppItems.reduce((sum, a) => sum + a.duration_sec, 0);
    const displayedWebsiteTotalSec = displayedWebsiteItems.reduce((sum, b) => sum + b.duration_sec, 0);

    // Source breakdown
    const extTotalSec = externalItems.reduce((sum, e) => sum + e.duration_sec, 0);
    const focusTotalSec = focusItems.reduce((sum, f) => sum + f.duration_sec, 0);

    // Day utilization (for 'today' view: tracked / 24h, for ranges: avg daily / 24h)
    const rangeDays = selectedPeriod === 'today' ? 1
      : selectedPeriod === 'week' || selectedPeriod === '7day' ? 7
      : selectedPeriod === 'month' || selectedPeriod === '30day' ? 30
      : selectedPeriod === 'all' ? Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 3600000)))
      : 7;
    const daySeconds = rangeDays > 0 ? totalSeconds / rangeDays : totalSeconds;
    const dayUtilization = Math.min(100, (daySeconds / (24 * 3600)) * 100);

    return {
      score: productivityScore,
      totalSeconds,
      weightedSeconds,
      appSeconds: appTotalSec,
      websiteSeconds: websiteTotalSec,
      externalSeconds: extTotalSec,
      focusSeconds: focusTotalSec,
      displayedAppSeconds: displayedAppTotalSec,
      displayedWebsiteSeconds: displayedWebsiteTotalSec,
      dayUtilization,
      daySeconds,
      rangeDays,
      sources: {
        app: { totalSec: appTotalSec, count: appItems.length },
        website: { totalSec: websiteTotalSec, count: browserItems.length },
        external: { totalSec: extTotalSec, count: externalItems.length },
        focus: { totalSec: focusTotalSec, count: focusItems.length },
      },
      appVsWeb: {
        app: { totalSec: appTotalSec, productiveSec: appProductiveSec, neutralSec: appNeutralSec, distractingSec: appDistractingSec, score: appScore, count: appItems.length },
        web: { totalSec: websiteTotalSec, productiveSec: webProductiveSec, neutralSec: webNeutralSec, distractingSec: webDistractingSec, score: webScore, count: browserItems.length }
      },
      tiers: {
        productive: { seconds: tierTotals.productive.seconds, count: tierTotals.productive.items.length },
        neutral: { seconds: tierTotals.neutral.seconds, count: tierTotals.neutral.items.length },
        distracting: { seconds: tierTotals.distracting.seconds, count: tierTotals.distracting.items.length }
      },
      topProductive,
      topNeutral,
      topDistracting,
      items: allItems
    };
  }, [logs, browserLogsProp, selectedPeriod, dateOffset, tierAssignments, allExternalSessions, externalTierMap, focusSessions, excludeExternal]);

  // Calculate daily trend data
  const dailyTrend = useMemo(() => {
    const now = new Date();
    const range = getDateRange(selectedPeriod, dateOffset);

    // Convert external sessions to log-like objects for trend processing
    const externalTrendLogs = (allExternalSessions || [])
      .filter((s: any) => {
        const t = new Date(s.started_at).getTime();
        return t >= range.start.getTime() && t < range.end.getTime();
      })
      .map((s: any) => {
        const tier = externalTierMap[s.activity_id] || 'neutral';
        const category = tier === 'productive' ? 'Productivity' : tier === 'distracting' ? 'Entertainment' : 'Other';
        return {
          timestamp: s.started_at,
          start_time: s.started_at,
          duration: s.duration_seconds || 0,
          duration_ms: (s.duration_seconds || 0) * 1000,
          category,
        };
      });

    // For 'today', show hourly breakdown with 24 separate hour columns
    if (selectedPeriod === 'today') {
      const hourBuckets = Array.from({ length: 24 }, (_, hour) => {
        const hourStart = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), hour);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        const hourLogs = [...(platformLogs as any[]), ...(platformBrowserLogs as any[]), ...externalTrendLogs].filter(log => {
          const logTime = new Date(log.timestamp || log.start_time);
          return logTime >= hourStart && logTime < hourEnd;
        });

        let productive = 0, neutral = 0, distracting = 0;

        for (const log of hourLogs) {
          const sessionStart = new Date(log.timestamp || log.start_time).getTime();
          const sessionEnd = sessionStart + ((log.duration_ms || (log.duration || 0) * 1000));

          let currentMs = sessionStart;
          while (currentMs < sessionEnd) {
            const currentHour = new Date(currentMs).getHours();
            const segmentHourStart = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), currentHour).getTime();
            const segmentHourEnd = segmentHourStart + 3600000;
            const segmentStart = Math.max(currentMs, segmentHourStart);
            const segmentEnd = Math.min(sessionEnd, segmentHourEnd);
            const segmentSeconds = Math.max(0, (segmentEnd - segmentStart) / 1000);

            if (segmentSeconds > 0 && currentHour === hour) {
              const category = WEBSITE_CATEGORY_MAP[log.category] || log.category || 'Other';
              if (tierAssignments.productive.includes(category)) {
                productive += segmentSeconds;
              } else if (tierAssignments.distracting.includes(category)) {
                distracting += segmentSeconds;
              } else {
                neutral += segmentSeconds;
              }
            }
            currentMs = Math.min(currentMs + 3600000, sessionEnd);
          }
        }

        const total = productive + neutral + distracting;
        const weighted = productive + (neutral * 0.5);
        const score = total > 0 ? (weighted / total) * 100 : 0;

        const isToday = dateOffset === 0;
        return {
          date: format(hourStart, 'yyyy-MM-dd-HH'),
          label: format(hourStart, 'HH:mm'),
          hour: hour,
          score: Math.round(score),
          productive: Math.round(productive),
          neutral: Math.round(neutral),
          distracting: Math.round(distracting),
          total: Math.round(total),
          isToday: isToday,
          isCurrentHour: isToday && hour === now.getHours()
        };
      });

      return hourBuckets;
    }

    // For 'all', aggregate by month to avoid freeze and show readable chart
    if (selectedPeriod === 'all') {
      const allLogs = [...(platformLogs as any[]), ...(platformBrowserLogs as any[]), ...externalTrendLogs];
      if (allLogs.length === 0) return [];

      // Single-pass month bucketing
      const monthMap: Record<string, { productive: number; neutral: number; distracting: number }> = {};
      for (const log of allLogs) {
        const logTime = new Date(log.timestamp || log.start_time);
        const monthKey = `${logTime.getFullYear()}-${String(logTime.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[monthKey]) monthMap[monthKey] = { productive: 0, neutral: 0, distracting: 0 };
        const duration_sec = log.duration_ms ? log.duration_ms / 1000 : (log.duration || 0);
        const category = WEBSITE_CATEGORY_MAP[log.category] || log.category || 'Other';
        if (tierAssignments.productive.includes(category)) monthMap[monthKey].productive += duration_sec;
        else if (tierAssignments.distracting.includes(category)) monthMap[monthKey].distracting += duration_sec;
        else monthMap[monthKey].neutral += duration_sec;
      }

      return Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([monthKey, data]) => {
        const total = data.productive + data.neutral + data.distracting;
        const weighted = data.productive + (data.neutral * 0.5);
        const score = total > 0 ? (weighted / total) * 100 : 0;
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          date: monthKey,
          label: format(date, 'MMM yyyy'),
          score: Math.round(score),
          productive: Math.round(data.productive),
          neutral: Math.round(data.neutral),
          distracting: Math.round(data.distracting),
          total: Math.round(total),
          isToday: false,
          isCurrentHour: false,
        };
      });
    }

    // For week/month, show daily breakdown
    const endDate = new Date(range.end);
    if (selectedPeriod !== '7day' && selectedPeriod !== '30day') {
      endDate.setDate(endDate.getDate() - 1);
    }
    const dayStartDate = new Date(range.start);
    const daysInRange = eachDayOfInterval({ start: dayStartDate, end: endDate });

    return daysInRange.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayLogs = [...(platformLogs as any[]), ...(platformBrowserLogs as any[]), ...externalTrendLogs].filter(log => {
        const logTime = new Date(log.timestamp || log.start_time);
        return logTime >= dayStart && logTime < dayEnd;
      });

      let productive = 0, neutral = 0, distracting = 0;
      for (const log of dayLogs) {
        const duration_sec = log.duration_ms ? log.duration_ms / 1000 : (log.duration || 0);
        const category = WEBSITE_CATEGORY_MAP[log.category] || log.category || 'Other';
        if (tierAssignments.productive.includes(category)) productive += duration_sec;
        else if (tierAssignments.distracting.includes(category)) distracting += duration_sec;
        else neutral += duration_sec;
      }

      const total = productive + neutral + distracting;
      const weighted = productive + (neutral * 0.5);
      const score = total > 0 ? (weighted / total) * 100 : 0;

      return {
        date: format(day, 'yyyy-MM-dd'),
        label: format(day, selectedPeriod === 'week' || selectedPeriod === '7day' ? 'EEE' : 'MMM d'),
        score: Math.round(score),
        productive: Math.round(productive),
        neutral: Math.round(neutral),
        distracting: Math.round(distracting),
        total: Math.round(total),
        isToday: isToday(day),
        isCurrentHour: false,
      };
    });
  }, [platformLogs, platformBrowserLogs, selectedPeriod, tierAssignments, dateOffset, allExternalSessions, externalTierMap]);

  // Average of daily trend scores (matches what the trend line shows)
  const trendAverageScore = useMemo(() => {
    if (dailyTrend.length === 0) return 0;
    return Math.round(dailyTrend.reduce((sum, d) => sum + d.score, 0) / dailyTrend.length);
  }, [dailyTrend]);

  // Calculate comparison with previous period
  const comparison = useMemo(() => {
    if (dailyTrend.length < 2) return null;

    const currentScore = trendAverageScore;
    const previousTrend = dailyTrend.slice(0, -1);
    const previousAvg = previousTrend.length > 0
      ? previousTrend.reduce((sum, d) => sum + d.score, 0) / previousTrend.length
      : currentScore;

    const diff = currentScore - previousAvg;
    const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';

    return {
      current: currentScore,
      previous: previousAvg,
      diff: Math.abs(diff),
      direction
    };
  }, [dailyTrend, trendAverageScore]);

  // Peak hours calculation (average across all days in period)
  const peakHours = useMemo(() => {
    if (dailyTrend.length === 0) return null;

    // Group by hour of day (0-23) and calculate averages
    const hourTotals: Record<number, { productive: number; neutral: number; distracting: number; count: number }> = {};

    // For 'today', use the hourly data directly
    if (selectedPeriod === 'today') {
      dailyTrend.forEach((d: any) => {
        if (d.hour !== undefined) {
          hourTotals[d.hour] = {
            productive: d.productive,
            neutral: d.neutral,
            distracting: d.distracting,
            count: 1
          };
        }
      });
    } else {
      // Use the shared date range utility (respects dateOffset and new period types)
      const range = getDateRange(selectedPeriod, dateOffset);

      // Aggregate by hour
      const allLogs = [...(logs as any[]), ...(browserLogsProp as any[])];
      allLogs.forEach((log: any) => {
        const logTime = new Date(log.timestamp || log.start_time);
        if (logTime >= range.start && logTime < range.end) {
          const hour = logTime.getHours();
          const duration = (log.duration || 0);
          const category = tierAssignments.productive.includes(log.category) ? 'productive' :
            tierAssignments.distracting.includes(log.category) ? 'distracting' : 'neutral';

          if (!hourTotals[hour]) {
            hourTotals[hour] = { productive: 0, neutral: 0, distracting: 0, count: 0 };
          }
          if (category === 'productive') hourTotals[hour].productive += duration;
          else if (category === 'distracting') hourTotals[hour].distracting += duration;
          else hourTotals[hour].neutral += duration;
        }
      });
    }

    // Calculate scores for each hour
    const hourScores = Object.entries(hourTotals).map(([hour, data]) => {
      const total = data.productive + data.neutral + data.distracting;
      const weighted = data.productive + (data.neutral * 0.5);
      const score = total > 0 ? (weighted / total) * 100 : 0;
      return {
        hour: parseInt(hour),
        score,
        productive: data.productive,
        neutral: data.neutral,
        distracting: data.distracting,
        total
      };
    }).sort((a, b) => b.score - a.score);

    if (hourScores.length === 0) return null;

    const mostProductive = hourScores[0];
    const leastProductive = hourScores[hourScores.length - 1];
    const avgScore = hourScores.reduce((sum, h) => sum + h.score, 0) / hourScores.length;

    // Format hour to 12h format
    const formatHour = (h: number) => {
      const suffix = h >= 12 ? 'PM' : 'AM';
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hour12}:00 ${suffix}`;
    };

    return {
      mostProductive: { hour: mostProductive.hour, label: formatHour(mostProductive.hour), score: Math.round(mostProductive.score), diff: Math.round(mostProductive.score - avgScore) },
      leastProductive: { hour: leastProductive.hour, label: formatHour(leastProductive.hour), score: Math.round(leastProductive.score), diff: Math.round(leastProductive.score - avgScore) },
      avgScore: Math.round(avgScore),
      hourlyData: hourScores.sort((a, b) => a.hour - b.hour)
    };
  }, [dailyTrend, selectedPeriod, logs, browserLogsProp, tierAssignments]);

  // Chart data for daily trend
  const trendChartData = {
    labels: dailyTrend.map(d => d.label),
    datasets: [{
      label: 'Productivity Score',
      data: dailyTrend.map(d => d.score),
      borderColor: '#10b981',
      backgroundColor: (ctx: any) => makeGradient(ctx, '#10b981'),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#10b981',
      borderWidth: 2,
    }]
  };

  // Distribution chart (pie)
  const distributionData = {
    labels: ['Productive', 'Neutral', 'Distracting'],
    datasets: [{
      data: [
        productivityData.tiers.productive.seconds,
        productivityData.tiers.neutral.seconds,
        productivityData.tiers.distracting.seconds
      ],
      backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(239, 68, 68, 0.8)'],
      borderColor: '#0a0a0a',
      borderWidth: 2,
      hoverOffset: 6,
    }]
  };

  const distributionOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    plugins: {
      glassBackdrop: true,
      centerText: { enabled: true },
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#a1a1aa',
          padding: 18,
          usePointStyle: true,
          font: { family: '"JetBrains Mono", monospace', size: 11 },
        }
      },
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
  };

  // Time breakdown bar chart - convert to hours
  const timeBreakdownData = {
    labels: dailyTrend.map(d => d.label),
    datasets: [
      {
        label: 'Productive',
        data: dailyTrend.map(d => d.productive / 3600),
        backgroundColor: (ctx: any) => makeGradient(ctx, '#10b981'),
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Neutral',
        data: dailyTrend.map(d => d.neutral / 3600),
        backgroundColor: (ctx: any) => makeGradient(ctx, '#3b82f6'),
        borderRadius: 6,
        borderSkipped: false,
      },
      {
        label: 'Distracting',
        data: dailyTrend.map(d => d.distracting / 3600),
        backgroundColor: (ctx: any) => makeGradient(ctx, '#ef4444'),
        borderRadius: 6,
        borderSkipped: false,
      }
    ]
  };

  const timeBreakdownOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      glassBackdrop: true,
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#a1a1aa',
          padding: 15,
          usePointStyle: true,
          font: { family: '"JetBrains Mono", monospace', size: 11 },
        }
      },
      tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}h` } }
    },
    scales: {
      ...sharedScales,
      x: { ...sharedScales.x, stacked: true },
      y: { ...sharedScales.y, stacked: true, ticks: { ...sharedScales.y.ticks, callback: (v: any) => `${v}h` } },
    },
    animation: barAnimation,
  };

  // Build sessions list from logs (app sessions) and browserLogs (website sessions)
  const sessions = useMemo(() => {
    const range = getDateRange(selectedPeriod, dateOffset);
    const getTier = (category: string): 'productive' | 'neutral' | 'distracting' => {
      if (tierAssignments.productive.includes(category)) return 'productive';
      if (tierAssignments.distracting.includes(category)) return 'distracting';
      return 'neutral';
    };

    const filteredLogs = (logs as any[] || []).filter((log: any) => {
      const t = new Date(log.timestamp || log.start_time).getTime();
      return t >= range.start.getTime() && t < range.end.getTime();
    });
    const filteredBrowserLogs = (browserLogsProp as any[] || []).filter((log: any) => {
      const t = new Date(log.timestamp || log.start_time).getTime();
      return t >= range.start.getTime() && t < range.end.getTime();
    });

    const appSessions = filteredLogs.map(log => ({
      type: 'app',
      name: log.app || 'Unknown',
      category: log.category || 'Other',
      duration_ms: (log.duration || 0) * 1000,
      timestamp: new Date(log.timestamp || Date.now()),
      tier: getTier(log.category)
    }));

    const websiteSessions = filteredBrowserLogs.map(log => ({
      type: 'website',
      name: log.domain || 'Unknown',
      category: WEBSITE_CATEGORY_MAP[log.category] || 'Other',
      duration_ms: (log.duration || 0) * 1000,
      timestamp: new Date(log.start_time || Date.now()),
      tier: getTier(WEBSITE_CATEGORY_MAP[log.category] || log.category)
    }));

    return [...appSessions, ...websiteSessions]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);
  }, [logs, browserLogsProp, selectedPeriod, dateOffset, tierAssignments]);

  const wrapPage = (content: React.ReactNode) => {
    if (embedded) return <>{content}</>;
    return <PageShell page="productivity"><DotPattern className="z-0" opacity={0.04} /><div className="relative z-1">{content}</div></PageShell>;
  };

  const pageContent = (
    <div className={embedded ? 'space-y-6' : ''}>
      {!embedded && (
        <div className="sticky top-0 z-30 -mx-5 px-5 bg-zinc-900/20 backdrop-blur-md border-b border-zinc-800/50 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl grid place-items-center bg-[rgba(16,185,129,0.14)]">
                <Target className="w-5 h-5 text-[#10b981]" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Productivity</h1>
              <span className="text-sm text-zinc-500 font-mono tabular-nums">{getViewLabel()}</span>
            </div>
            <div className="flex items-center gap-2">
              {excludeExternal ? <EyeOff className="w-3.5 h-3.5 text-zinc-500" /> : <Eye className="w-3.5 h-3.5 text-zinc-500" />}
              <span className="text-xs text-zinc-500">External</span>
              <Switch checked={!excludeExternal} onCheckedChange={(v) => toggleExcludeExternal(!v)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Score Card */}
      <GlassCard data-tutorial="prod.score" className="group relative overflow-hidden border-zinc-800/50 hover:border-zinc-700/80 transition-colors duration-300">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-emerald-500/30">
                <span className="text-3xl font-bold font-mono tabular-nums text-white">
                  <NumberTicker value={Math.round(productivityData.score)} />
                </span>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  <AnimatedGradientText colorFrom="#10b981" colorTo="#06b6d4">Productivity Score</AnimatedGradientText>
                </div>
                <div className="text-sm text-zinc-500 font-mono">
                  Based on {formatDuration(productivityData.totalSeconds)} of tracked activity
                </div>
              </div>
            </div>

            {comparison && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${comparison.direction === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
                  comparison.direction === 'down' ? 'bg-red-500/20 text-red-400' :
                    'bg-zinc-800 text-zinc-400'
                }`}>
                {comparison.direction === 'up' && <ArrowUp className="w-5 h-5" />}
                {comparison.direction === 'down' && <ArrowDown className="w-5 h-5" />}
                {comparison.direction === 'neutral' && <Minus className="w-5 h-5" />}
                <span className="font-semibold font-mono tabular-nums">{comparison.diff.toFixed(1)}%</span>
                <span className="text-sm opacity-70">vs avg</span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Source Breakdown + Day Utilization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Breakdown */}
        <GlassCard className="group relative overflow-hidden border-zinc-800/50">
          <SectionHeader title="Tracked Sources" icon={<Layers className="w-5 h-5 text-zinc-400" />} />
          <div className="space-y-3">
            {[
              { key: 'app', label: 'Desktop Apps', icon: Monitor, bgClass: 'bg-indigo-500/15', iconClass: 'text-indigo-400', barClass: 'bg-indigo-400', sec: productivityData.sources.app.totalSec, count: productivityData.sources.app.count },
              { key: 'website', label: 'Websites', icon: Globe, bgClass: 'bg-cyan-500/15', iconClass: 'text-cyan-400', barClass: 'bg-cyan-400', sec: productivityData.sources.website.totalSec, count: productivityData.sources.website.count },
              { key: 'external', label: 'External', icon: Activity, bgClass: 'bg-amber-500/15', iconClass: 'text-amber-400', barClass: 'bg-amber-400', sec: productivityData.sources.external.totalSec, count: productivityData.sources.external.count, disabled: excludeExternal },
              { key: 'focus', label: 'Focus', icon: Zap, bgClass: 'bg-violet-500/15', iconClass: 'text-violet-400', barClass: 'bg-violet-400', sec: productivityData.sources.focus.totalSec, count: productivityData.sources.focus.count },
            ].map(src => {
              const Icon = src.icon;
              const pct = productivityData.totalSeconds > 0 ? (src.sec / productivityData.totalSeconds) * 100 : 0;
              return (
                <div key={src.key} className={`flex items-center gap-3 p-2 rounded-lg ${src.disabled ? 'opacity-40' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg ${src.bgClass} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${src.iconClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-300">{src.label}{src.disabled ? ' (excluded)' : ''}</span>
                      <span className="text-xs font-mono text-zinc-400">{formatHours(src.sec)}</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${src.barClass} transition-all duration-500`}
                        style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 w-12 text-right font-mono">{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Day Utilization Ring */}
        <GlassCard className="group relative overflow-hidden border-zinc-800/50 flex flex-col">
          <SectionHeader title="Day Utilization" icon={<Clock className="w-5 h-5 text-zinc-400" />}
            action={<span className="text-xs text-zinc-500">{formatHours(productivityData.daySeconds)} / day avg</span>} />
          <div className="flex-1 flex items-center justify-center py-4">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(39,39,42,0.8)" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#dayGrad)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${productivityData.dayUtilization * 2.639} ${263.9 - productivityData.dayUtilization * 2.639}`}
                  className="transition-all duration-1000" />
                <defs>
                  <linearGradient id="dayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-mono tabular-nums text-white">{Math.round(productivityData.dayUtilization)}%</span>
                <span className="text-xs text-zinc-500 mt-0.5">of 24h tracked</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            <div className="text-center">
              <div className="text-sm font-semibold font-mono text-emerald-400">{formatHours(productivityData.tiers.productive.seconds)}</div>
              <div className="text-[10px] text-zinc-500">Productive</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold font-mono text-blue-400">{formatHours(productivityData.tiers.neutral.seconds)}</div>
              <div className="text-[10px] text-zinc-500">Neutral</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold font-mono text-red-400">{formatHours(productivityData.tiers.distracting.seconds)}</div>
              <div className="text-[10px] text-zinc-500">Distracting</div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="space-y-4">
        {/* Time Breakdown - based on tierFilter */}
        {(() => {
          let filteredItems = productivityData.items;
          if (tierFilter !== 'all') {
            filteredItems = productivityData.items.filter(item => {
              const itemTier = tierAssignments.productive.includes(item.category) ? 'productive' :
                tierAssignments.distracting.includes(item.category) ? 'distracting' : 'neutral';
              return itemTier === tierFilter;
            });
          }

          const filteredProductiveSec = filteredItems.filter(i => tierAssignments.productive.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
          const filteredNeutralSec = filteredItems.filter(i => tierAssignments.neutral.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
          const filteredDistractingSec = filteredItems.filter(i => tierAssignments.distracting.includes(i.category)).reduce((s, i) => s + i.duration_sec, 0);
          const filteredTotalSec = filteredProductiveSec + filteredNeutralSec + filteredDistractingSec;
          const filteredAppCount = filteredItems.filter(i => i.type === 'app').length;
          const filteredWebCount = filteredItems.filter(i => i.type === 'website').length;

          return (
            <div data-tutorial="prod.breakdown" className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <GlassCard className="group relative overflow-hidden hover:border-emerald-500/30">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(16,185,129,0.12),transparent_60%)]" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Productive</span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{formatHours(filteredProductiveSec)}</div>
                  <div className="text-xs text-zinc-500 mt-1 font-mono">
                    {filteredTotalSec > 0
                      ? Math.round((filteredProductiveSec / filteredTotalSec) * 100)
                      : 0}% of time
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="group relative overflow-hidden hover:border-blue-500/30">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(59,130,246,0.12),transparent_60%)]" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Neutral</span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-blue-400">{formatHours(filteredNeutralSec)}</div>
                  <div className="text-xs text-zinc-500 mt-1 font-mono">
                    {filteredTotalSec > 0
                      ? Math.round((filteredNeutralSec / filteredTotalSec) * 100)
                      : 0}% of time
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="group relative overflow-hidden hover:border-red-500/30">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(239,68,68,0.12),transparent_60%)]" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Distracting</span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-red-400">{formatHours(filteredDistractingSec)}</div>
                  <div className="text-xs text-zinc-500 mt-1 font-mono">
                    {filteredTotalSec > 0
                      ? Math.round((filteredDistractingSec / filteredTotalSec) * 100)
                      : 0}% of time
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="group relative overflow-hidden hover:border-purple-500/30">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(168,85,247,0.12),transparent_60%)]" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-purple-400" />
                    <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Total Time</span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-purple-400">{formatDuration(filteredTotalSec)}</div>
                  <div className="text-xs text-zinc-500 mt-1 font-mono">
                    {filteredAppCount} apps + {filteredWebCount} sites
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })()}

        {/* Apps vs Websites Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-indigo-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-zinc-300">Applications</span>
              </div>
              <span className="text-lg font-bold text-indigo-400">{Math.round(productivityData.appVsWeb.app.score)}%</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-400">Productive</span>
                <span className="text-zinc-400">{formatDuration(productivityData.appVsWeb.app.productiveSec)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-emerald-400 h-2 rounded-full transition-colors duration-150" style={{ width: `${productivityData.appVsWeb.app.totalSec > 0 ? (productivityData.appVsWeb.app.productiveSec / productivityData.appVsWeb.app.totalSec) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-400">Neutral</span>
                <span className="text-zinc-400">{formatDuration(productivityData.appVsWeb.app.neutralSec)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full transition-colors duration-150" style={{ width: `${productivityData.appVsWeb.app.totalSec > 0 ? (productivityData.appVsWeb.app.neutralSec / productivityData.appVsWeb.app.totalSec) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-400">Distracting</span>
                <span className="text-zinc-400">{formatDuration(productivityData.appVsWeb.app.distractingSec)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-red-400 h-2 rounded-full transition-colors duration-150" style={{ width: `${productivityData.appVsWeb.app.totalSec > 0 ? (productivityData.appVsWeb.app.distractingSec / productivityData.appVsWeb.app.totalSec) * 100 : 0}%` }} />
              </div>
              <div className="pt-1 border-t border-zinc-800 flex justify-between text-xs">
                <span className="text-zinc-500">Total</span>
                <span className="text-zinc-300 font-medium">{formatDuration(productivityData.appVsWeb.app.totalSec)}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-xl p-4 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-zinc-300">Websites</span>
              </div>
              <span className="text-lg font-bold text-cyan-400">{Math.round(productivityData.appVsWeb.web.score)}%</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-400">Productive</span>
                <span className="text-zinc-400">{formatDuration(productivityData.appVsWeb.web.productiveSec)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-emerald-400 h-2 rounded-full transition-colors duration-150" style={{ width: `${productivityData.appVsWeb.web.totalSec > 0 ? (productivityData.appVsWeb.web.productiveSec / productivityData.appVsWeb.web.totalSec) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-400">Neutral</span>
                <span className="text-zinc-400">{formatDuration(productivityData.appVsWeb.web.neutralSec)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full transition-colors duration-150" style={{ width: `${productivityData.appVsWeb.web.totalSec > 0 ? (productivityData.appVsWeb.web.neutralSec / productivityData.appVsWeb.web.totalSec) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-red-400">Distracting</span>
                <span className="text-zinc-400">{formatDuration(productivityData.appVsWeb.web.distractingSec)}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-red-400 h-2 rounded-full transition-colors duration-150" style={{ width: `${productivityData.appVsWeb.web.totalSec > 0 ? (productivityData.appVsWeb.web.distractingSec / productivityData.appVsWeb.web.totalSec) * 100 : 0}%` }} />
              </div>
              <div className="pt-1 border-t border-zinc-800 flex justify-between text-xs">
                <span className="text-zinc-500">Total</span>
                <span className="text-zinc-300 font-medium">{formatDuration(productivityData.appVsWeb.web.totalSec)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Trend */}
        <GlassCard data-tutorial="prod.trends" className="group relative overflow-hidden border-zinc-800/50 hover:border-zinc-700/80 transition-colors duration-300">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(16,185,129,0.06),transparent_60%)]" />
          <div className="relative">
            <SectionHeader title="Productivity Trend" icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} />
            <div className="h-64">
              <Line
                data={trendChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    glassBackdrop: true,
                    legend: { display: false },
                    tooltip: { ...sharedTooltipStyle, callbacks: { label: (ctx: any) => ` Score: ${ctx.parsed.y}%` } }
                  },
                  scales: {
                    ...sharedScales,
                    y: { ...sharedScales.y, min: 0, max: 100, ticks: { ...sharedScales.y.ticks, callback: (v: any) => `${v}%` } }
                  },
                  animation: barAnimation,
                }}
              />
            </div>
          </div>
        </GlassCard>

        {/* Time Distribution */}
        <GlassCard className="group relative overflow-hidden border-zinc-800/50 hover:border-zinc-700/80 transition-colors duration-300">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_0%,rgba(16,185,129,0.06),transparent_60%)]" />
          <div className="relative">
            <SectionHeader title="Time Distribution" icon={<PieChartIcon className="w-5 h-5 text-emerald-400" />} />
            <div className="h-80 flex items-center justify-center">
              <Pie
                data={distributionData}
                options={distributionOptions}
              />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Horizontal Tier Filter */}
      <GlassCard>
        <div className="flex items-center gap-2">
          <button onClick={() => setTierFilter('productive')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2 ${tierFilter === 'productive'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}>
            <div className="w-2 h-2 rounded-full bg-emerald-400" /> Productive
          </button>
          <button onClick={() => setTierFilter('neutral')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2 ${tierFilter === 'neutral'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}>
            <div className="w-2 h-2 rounded-full bg-blue-400" /> Neutral
          </button>
          <button onClick={() => setTierFilter('distracting')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2 ${tierFilter === 'distracting'
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}>
            <div className="w-2 h-2 rounded-full bg-red-400" /> Distracting
          </button>
          {(() => {
            let totalItems = productivityData.items;
            if (tierFilter !== 'all') {
              totalItems = productivityData.items.filter(item => {
                if (item.type === 'external') {
                  const t = (externalTierMap[(item as any).activity_id] || 'neutral');
                  return t === tierFilter;
                }
                if (item.type === 'focus') {
                  const outcome = (item as any)._outcome;
                  const t = outcome === 'completed' ? 'productive' : outcome === 'failed' ? 'distracting' : 'neutral';
                  return t === tierFilter;
                }
                const itemTier = tierAssignments.productive.includes(item.category) ? 'productive' :
                  tierAssignments.distracting.includes(item.category) ? 'distracting' : 'neutral';
                return itemTier === tierFilter;
              });
            }
            const appCount = totalItems.filter(i => i.type === 'app').length;
            const webCount = totalItems.filter(i => i.type === 'website').length;
            const extCount = totalItems.filter(i => i.type === 'external').length;
            const focusCount = totalItems.filter(i => i.type === 'focus').length;
            return (
              <div className="ml-auto text-xs text-zinc-500">
                {tierFilter === 'all'
                  ? `${appCount + webCount + extCount + focusCount} items`
                  : `${totalItems.length} items in ${tierFilter}`
                }
              </div>
            );
          })()}
        </div>
      </GlassCard>

      {/* Apps vs Websites Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Apps Breakdown */}
        <GlassCard>
          <SectionHeader title="Desktop Apps" icon={<Monitor className="w-5 h-5" />}
            action={(() => {
              let sourceArray = productivityData.topProductive;
              if (tierFilter === 'neutral') sourceArray = productivityData.topNeutral;
              else if (tierFilter === 'distracting') sourceArray = productivityData.topDistracting;
              else if (tierFilter === 'all') sourceArray = [...productivityData.topProductive, ...productivityData.topNeutral, ...productivityData.topDistracting];
              const apps = sourceArray.filter(i => i.type === 'app');
              const totalSec = apps.reduce((sum, i) => sum + i.duration_sec, 0);
              const filteredTotal = tierFilter === 'all' ? productivityData.totalSeconds :
                (tierFilter === 'productive' ? productivityData.tiers.productive.seconds :
                  tierFilter === 'neutral' ? productivityData.tiers.neutral.seconds :
                    productivityData.tiers.distracting.seconds);
              return (
                <div className="text-sm text-zinc-500">
                  {formatDuration(totalSec)} ({filteredTotal > 0 ? Math.round((totalSec / filteredTotal) * 100) : 0}% of {tierFilter === 'all' ? 'total' : tierFilter})
                </div>
              );
            })()} />

          <div className="space-y-3">
            {(() => {
              // Select correct array based on tierFilter
              let sourceArray = productivityData.topProductive;
              if (tierFilter === 'neutral') sourceArray = productivityData.topNeutral;
              else if (tierFilter === 'distracting') sourceArray = productivityData.topDistracting;
              else if (tierFilter === 'all') sourceArray = [...productivityData.topProductive, ...productivityData.topNeutral, ...productivityData.topDistracting];

              const apps = sourceArray.filter(i => i.type === 'app').slice(0, 5);

              return apps.length > 0 ? apps.map((item, idx) => {
                const itemTier = tierAssignments.productive.includes(item.category) ? 'productive' :
                  tierAssignments.distracting.includes(item.category) ? 'distracting' : 'neutral';
                const tierColor = itemTier === 'productive' ? '#22c55e' : itemTier === 'distracting' ? '#ef4444' : '#3b82f6';

                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tierColor }} />
                      <span className="text-sm font-medium text-white">{item.name}</span>
                      <span className="text-xs text-zinc-500">({item.category})</span>
                    </div>
                    <div className="text-sm text-zinc-400">{formatDuration(item.duration_sec)}</div>
                  </div>
                );
              }) : (
                <div className="text-center py-8 text-zinc-500">
                  <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No {tierFilter === 'all' ? '' : tierFilter} apps in this period</p>
                </div>
              );
            })()}
          </div>
        </GlassCard>

        {/* Websites Breakdown */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              {tierFilter === 'all' ? 'All Websites' : tierFilter === 'productive' ? 'Productive Websites' : tierFilter === 'neutral' ? 'Neutral Websites' : 'Distracting Websites'}
            </h2>
            <div className="text-sm text-zinc-500">
              {formatDuration(filteredWebsites.reduce((sum, d) => sum + d.totalSeconds, 0))} total
            </div>
          </div>

          <div className="space-y-2">
            {filteredWebsites.length > 0 ? (
              filteredWebsites.map((domainData) => {
                const isExpanded = expandedDomains.has(domainData.domain);
                const domainColor = getCategoryColor(domainData.dominantCategory);

                return (
                  <div key={domainData.domain} className="rounded-xl overflow-hidden">
                    {/* Domain Header Row */}
                    <button
                      onClick={() => toggleDomain(domainData.domain)}
                      className="w-full flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-800/70 transition-colors duration-150 rounded-xl"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{domainData.domain}</div>
                          {domainData.hasKeywordRules && (
                            <span className="text-xs text-emerald-400">Smart website</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${domainColor}20`, color: domainColor }}
                        >
                          {domainData.dominantCategory}
                        </span>
                        <span className="text-sm text-zinc-400">{formatDuration(domainData.totalSeconds)}</span>
                      </div>
                    </button>

                    {/* Subpages (expanded) */}
                    {isExpanded && (
                      <div className="mt-1 ml-6 space-y-1 border-l-2 border-zinc-700/50 pl-4">
                        {domainData.logs.slice(0, 20).map((log: any, idx: number) => {
                          const logCategory = WEBSITE_CATEGORY_MAP[log.category] || log.category || 'Other';
                          const logColor = getCategoryColor(logCategory);
                          const logTitle = log.title || log.url || 'Unknown page';
                          // Truncate long titles
                          const displayTitle = logTitle.length > 60 ? logTitle.substring(0, 57) + '...' : logTitle;

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-800/30 transition-colors duration-150"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: logColor }}
                                />
                                <span className="text-xs text-zinc-300 truncate">{displayTitle}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${logColor}15`, color: logColor }}
                                >
                                  {logCategory}
                                </span>
                                <span className="text-xs text-zinc-500">{formatDuration(log.duration)}</span>
                              </div>
                            </div>
                          );
                        })}
                        {domainData.logs.length > 20 && (
                          <div className="text-xs text-zinc-500 text-center py-1">
                            +{domainData.logs.length - 20} more pages
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No productive website data</p>
                <p className="text-xs mt-1">Configure smart websites in Settings to track productivity</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Daily Stacked Bar Chart */}
      <GlassCard>
        <SectionHeader title="Daily Activity Breakdown" icon={<BarChart3 className="w-5 h-5" />} />
        <div className="h-64">
          <Bar
            data={timeBreakdownData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { color: '#a1a1aa', padding: 20 }
                },
                tooltip: {
                  backgroundColor: '#18181b',
                  borderColor: '#3f3f46',
                  borderWidth: 1,
                  titleColor: '#e4e4e7',
                  bodyColor: '#a1a1aa',
                  padding: 10,
                  cornerRadius: 8,
                  callbacks: {
                    label: (ctx) => {
                      const label = ctx.dataset.label || '';
                      return ` ${label}: ${formatDuration((ctx.raw as number) * 3600)}`;
                    }
                  }
                }
              },
              scales: {
                x: {
                  stacked: true,
                  grid: { display: false },
                  ticks: { color: '#71717a' }
                },
                y: {
                  stacked: true,
                  grid: { color: '#27272a' },
                  ticks: {
                    color: '#71717a',
                    callback: (v: number) => formatHours(v * 3600) // convert back to seconds for formatting
                  }
                }
              }
            }}
          />
        </div>
      </GlassCard>

      {/* Top Distracting */}
      {productivityData.topDistracting.length > 0 && (
        <GlassCard>
          <SectionHeader title="Areas to Improve" icon={<TrendingDown className="w-5 h-5" />}
            action={<span className="text-sm text-zinc-500">Distracting activities that reduced your score</span>} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productivityData.topDistracting.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    {item.type === 'app' ? (
                      <Monitor className="w-4 h-4 text-red-400" />
                    ) : item.type === 'website' ? (
                      <Globe className="w-4 h-4 text-red-400" />
                    ) : item.type === 'focus' ? (
                      <Timer className="w-4 h-4 text-red-400" />
                    ) : (
                      <Activity className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-zinc-500">{item.category}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-red-400">{formatDuration(item.duration_sec)}</div>
                  <div className="text-xs text-zinc-500">
                    {productivityData.totalSeconds > 0
                      ? Math.round((item.duration_sec / productivityData.totalSeconds) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Peak Productivity Hours */}
      {peakHours && (
        <GlassCard>
          <SectionHeader title="Peak Productivity Hours" icon={<Clock className="w-5 h-5" />}
            action={<span className="text-xs text-zinc-500">Average across period</span>} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Most Productive Hour */}
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-zinc-400">Most Productive</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{peakHours.mostProductive.label}</div>
              <div className="text-sm text-zinc-400 mt-1">
                {peakHours.mostProductive.score}% score
                <span className="ml-2 text-emerald-400">
                  {peakHours.mostProductive.diff > 0 ? `+${peakHours.mostProductive.diff}%` : `${peakHours.mostProductive.diff}%`}
                </span>
              </div>
            </div>

            {/* Least Productive Hour */}
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-sm text-zinc-400">Least Productive</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-400">{peakHours.leastProductive.label}</div>
              <div className="text-sm text-zinc-400 mt-1">
                {peakHours.leastProductive.score}% score
                <span className="ml-2 text-red-400">
                  {peakHours.leastProductive.diff > 0 ? `+${peakHours.leastProductive.diff}%` : `${peakHours.leastProductive.diff}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Hourly bar chart */}
          <div className="h-32">
            <Bar
              data={{
                labels: peakHours.hourlyData.map(h => {
                  const suffix = h.hour >= 12 ? 'p' : 'a';
                  const hour12 = h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour;
                  return `${hour12}${suffix}`;
                }),
                datasets: [{
                  label: 'Productivity Score',
                  data: peakHours.hourlyData.map(h => h.score),
                  backgroundColor: peakHours.hourlyData.map(h =>
                    h.hour === peakHours.mostProductive.hour ? '#22c55e' :
                      h.hour === peakHours.leastProductive.hour ? '#ef4444' : 'rgba(34, 197, 94, 0.5)'
                  ),
                  borderRadius: 4
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1, titleColor: '#e4e4e7', bodyColor: '#a1a1aa', padding: 10, cornerRadius: 8 } },
                scales: {
                  x: { display: true, grid: { display: false }, ticks: { color: '#71717a', font: { size: 10 } } },
                  y: { display: false, min: 0, max: 100 }
                }
              }}
            />
          </div>
        </GlassCard>
      )}

      {/* Insights Card */}
      <GlassCard>
        <SectionHeader title="Insights" icon={<Info className="w-5 h-5" />} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="group relative overflow-hidden p-5 bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/50 hover:border-emerald-500/40 transition-colors duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Focus Time</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-white">
              {formatDuration(productivityData.tiers.productive.seconds)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Time spent on productive activities
            </div>
          </div>

          <div className="group relative overflow-hidden p-5 bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/50 hover:border-emerald-500/40 transition-colors duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-purple-400" />
              <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Avg Trend Score</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-white">
              {trendAverageScore}%
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Average of daily trend scores
            </div>
          </div>

          <div className="group relative overflow-hidden p-5 bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/50 hover:border-indigo-500/40 transition-colors duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-4 h-4 text-indigo-400" />
              <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">App Time</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-white">
              {formatDuration(productivityData.sources.app.totalSec)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {Math.round(productivityData.appVsWeb.app.score)}% productive
            </div>
          </div>

          <div className="group relative overflow-hidden p-5 bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/50 hover:border-cyan-500/40 transition-colors duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Website Time</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-white">
              {formatDuration(productivityData.sources.website.totalSec)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {Math.round(productivityData.appVsWeb.web.score)}% productive
            </div>
          </div>

          <div className="group relative overflow-hidden p-5 bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/50 hover:border-amber-500/40 transition-colors duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">External</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-white">
              {formatDuration(productivityData.sources.external.totalSec)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {productivityData.sources.external.count} sessions
            </div>
          </div>

          <div className="group relative overflow-hidden p-5 bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/50 hover:border-violet-500/40 transition-colors duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-violet-400" />
              <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-zinc-500">Focus Sessions</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-white">
              {formatDuration(productivityData.sources.focus.totalSec)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {productivityData.sources.focus.count} sessions
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Calculation Explanation */}
      <details className="rounded-xl p-5 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60">
        <summary className="cursor-pointer text-sm text-zinc-400 hover:text-white">
          How is productivity calculated?
        </summary>
        <div className="mt-4 group relative overflow-hidden p-5 bg-zinc-900/30 backdrop-blur-xl rounded-xl border border-zinc-800/50 hover:border-emerald-500/40 transition-colors duration-200 text-sm text-zinc-300 space-y-2">
          <p><strong>Formula:</strong></p>
          <code className="block bg-zinc-800 p-2 rounded text-emerald-400">
            Score = (Productive + Neutral × 0.5) / Total × 100
          </code>
          <p className="mt-4"><strong>Tier Weights:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li><span className="text-emerald-400">Productive</span> = 100% credit (weight: 1.0)</li>
            <li><span className="text-blue-400">Neutral</span> = 50% credit (weight: 0.5)</li>
            <li><span className="text-red-400">Distracting</span> = 0% credit (weight: 0.0)</li>
          </ul>
          <p className="mt-4"><strong>Data Sources:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Desktop apps from activity tracking</li>
            <li>Websites from browser activity tracking</li>
            <li>External activities (exercise, reading, etc.) — toggleable</li>
            <li>Deep Focus sessions (completed = productive, failed = distracting)</li>
            <li>Day utilization = tracked time / 24 hours</li>
            <li>Categories mapped using tier assignments from Settings</li>
          </ul>
        </div>
      </details>
    </div>
  );

  return wrapPage(pageContent);
}