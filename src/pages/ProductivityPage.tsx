import { useMemo, useEffect, useState, useCallback } from 'react';
import { tierColor as getTierColor } from '../lib/tierColors';
import { cssVar, hexA, monoStep, MONO_STEPS, formatClock } from '../lib/usageScale';
import {
  Target, TrendingUp, TrendingDown, Clock, Award, Zap,
  Monitor, Globe, BarChart3, Info, Timer, Eye, EyeOff,
  PieChart as PieChartIcon, ArrowUp, ArrowDown, Minus,
  ChevronRight, ChevronDown, ChevronLeft, Activity, Layers, ArrowLeftRight
} from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { format, eachDayOfInterval, startOfDay, isToday } from 'date-fns';
import { getDateRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { NumberTicker } from '../components/ui/number-ticker';
import { DotPattern } from '../components/ui/dot-pattern';
import { Badge } from '../components/ui/badge';
import { glassBackdrop, centerText, sharedTooltipStyle, barAnimation, pieAnimation } from '../lib/chart-plugins';
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

// NOTE: the old local formatHours() is gone. Every inline label now uses
// usageScale.formatClock(), which keeps sub-minute values ("40s") instead of
// collapsing them to "0m", and axis ticks format hours inline.

// ============================================================
// CHART COLOUR SYSTEM
//
// This file used to define its OWN 16-entry saturated category palette and
// feed it to inline styles. That is a straight LAMINAR §5 breach
// (src/lib/CategoryColors.ts is the only sanctioned source) and it was the
// single loudest thing on the page: with ~12 live web categories the
// Websites card rendered as a wall of unrelated hues, none of which meant
// anything at this level of the funnel.
//
// Two rules replace it:
//
// 1. HUE IS RESERVED FOR TIER. Productive / Neutral / Distracting is the
//    only dimension this page judges on, and those come from the
//    user-overridable --tier-* tokens (tierColor reads them live), so the
//    charts follow both the theme AND the user's Settings override.
//
// 2. NEUTRAL RECEDES, THE VERDICT DOES NOT. Productive and distracting
//    are the two buckets that carry a judgement, so they render loud.
//    Neutral is the filler bucket and drops back. One saturation story,
//    applied identically in the trend fill, the donut, the stacked bars
//    and the split bars — which is what makes four charts read as one
//    system instead of four.
//
// Chart.js resolves colours on a canvas and cannot parse CSS custom
// properties, so the live token values are read off :root here and the
// alpha is composited by hand (usageScale.hexA).
// ============================================================
const TIER_FILL_ALPHA = {
  productive: 0.85,
  neutral: 0.42,
  distracting: 0.85,
} as const;

type TierKey = keyof typeof TIER_FILL_ALPHA;

const tierHex = (tier: TierKey): string => getTierColor(tier);
const tierFill = (tier: TierKey): string => hexA(tierHex(tier), TIER_FILL_ALPHA[tier]);
const tierWash = (tier: TierKey): string => hexA(tierHex(tier), 0.14);

/**
 * DOM-side tier colour is the CSS custom property ITSELF, not a hex read
 * out of computed style. Three reasons, in order of importance:
 *   1. no raw hex lands in the DOM (LAMINAR §7 #7);
 *   2. `var(--tier-X)` re-resolves at paint time, so a Settings → Colors
 *      change updates the page without any re-render, whereas a hex
 *      captured during render goes stale;
 *   3. it follows the theme for free. Chart.js genuinely cannot do this —
 *      canvas does not parse var() — which is the only reason tierHex()
 *      still exists, and it is used ONLY for chart datasets.
 */
const tierVar = (tier: TierKey): string => `var(--tier-${tier})`;
const tierVarFill = (tier: TierKey): string =>
  `color-mix(in srgb, var(--tier-${tier}) ${Math.round(TIER_FILL_ALPHA[tier] * 100)}%, transparent)`;

/** Live value of any design token, for the bits Chart.js cannot read. */
const tok = (name: string, fallback: string): string => cssVar(name, fallback);

const chartSurface = (): string => tok('--color-card', '#18181b');
const chartMutedText = (): string => tok('--chart-text', '#a1a1aa');
const chartGrid = (): string => hexA(tok('--color-border', '#27272a'), 0.7);

/** Axis/label styling shared by every chart on the page (replaces the
 *  hardcoded grey tick/grid colours that each chart repeated).
 *
 *  These return `any` on purpose. Chart.js types `options` as a deeply-nested
 *  `_DeepPartialObject<...>` keyed by chart type, and it resolves the literal
 *  at compile time from JSX usage — a factory function can never satisfy it,
 *  so every shared helper in the file had to be inlined per chart instead
 *  (which is how the same six colours got copy-pasted four times in the
 *  first place). One shared, typed-as-any factory is the smaller trade. */
const chartScales = (): any => {
  const ticks = { color: chartMutedText(), font: { family: '"JetBrains Mono", monospace' as const, size: 11 } };
  const axis = { grid: { color: chartGrid() }, border: { display: false }, ticks };
  return { x: axis, y: axis };
};

const chartTooltip = (extra?: Record<string, unknown>): any => ({
  ...sharedTooltipStyle,
  backgroundColor: hexA(tok('--color-popover', '#18181b'), 0.96),
  borderColor: tok('--color-border', '#27272a'),
  titleColor: tok('--text-secondary', '#a1a1aa'),
  bodyColor: tok('--text-primary', '#fafafa'),
  ...extra,
});

const chartLegend = (position: 'top' | 'bottom' = 'bottom'): any => ({
  position,
  labels: {
    color: chartMutedText(),
    padding: 16,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    boxWidth: 6,
    boxHeight: 6,
    font: { family: '"JetBrains Mono", monospace' as const, size: 11 },
  },
});

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
  const trendChartData: any = {
    labels: dailyTrend.map(d => d.label),
    datasets: [{
      label: 'Productivity Score',
      data: dailyTrend.map(d => d.score),
      borderColor: tierHex('productive'),
      // Flat wash, NOT makeGradient(). The old full-height gradient put the
      // most saturated pixels at the very top of the plot, which is what made
      // this chart read as neon against an otherwise flat surface.
      backgroundColor: tierWash('productive'),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: tierHex('productive'),
      pointBorderColor: chartSurface(),
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: tierHex('productive'),
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
      backgroundColor: [tierFill('productive'), tierFill('neutral'), tierFill('distracting')],
      // Hairline in the surface colour rather than a hard black — the
      // segments read as one ring instead of three pasted-on discs.
      borderColor: chartSurface(),
      borderWidth: 2,
      hoverOffset: 3,
    }]
  };

  const distributionOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      centerText: { enabled: true },
      legend: chartLegend('bottom'),
      tooltip: chartTooltip({
        callbacks: {
          label: (ctx: any) => {
            const total = (ctx.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const val = ctx.parsed as number;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${formatDuration(val)} (${pct}%)`;
          }
        }
      })
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
        backgroundColor: tierFill('productive'),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Neutral',
        data: dailyTrend.map(d => d.neutral / 3600),
        backgroundColor: tierFill('neutral'),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Distracting',
        data: dailyTrend.map(d => d.distracting / 3600),
        backgroundColor: tierFill('distracting'),
        borderRadius: 4,
        borderSkipped: false,
      }
    ]
  };

  const timeBreakdownOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: chartLegend('top'),
      tooltip: chartTooltip({ callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}h` } })
    },
    scales: {
      ...chartScales(),
      x: { ...chartScales().x, stacked: true },
      y: { ...chartScales().y, stacked: true, ticks: { ...chartScales().y.ticks, callback: (v: any) => `${v}h` } },
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
        <div className="sticky top-0 z-30 -mx-5 px-5 bg-[var(--color-background)] border-b border-[var(--color-border)] py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg grid place-items-center bg-[var(--page-accent-12)] border border-[var(--page-accent)]/25">
                <Target className="w-4.5 h-4.5 text-[var(--page-accent)]" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Productivity</h1>
              <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">{getViewLabel()}</span>
            </div>
            <div className="flex items-center gap-2">
              {excludeExternal ? <EyeOff className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <Eye className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
              <span className="text-xs text-[var(--text-muted)]">External</span>
              <Switch checked={!excludeExternal} onCheckedChange={(v) => toggleExcludeExternal(!v)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Score Card. Was: a green→green gradient disc with a coloured
          drop shadow, an emerald→cyan animated-gradient heading, and a
          radial hover glow — three decorative layers (§7 #1/#6/#9) wrapped
          around one number. Now: a flat ring showing where the score sits
          against its own 0–100 scale, so the disc is informative rather
          than ornamental, and the hue comes from the tier it lands in. */}
      <GlassCard data-tutorial="prod.score" variant="notebook" className="border border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-muted)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={tierVar(productivityData.score >= 70 ? 'productive' : productivityData.score >= 40 ? 'neutral' : 'distracting')}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, Math.min(100, productivityData.score)) * 2.639} 263.9`}
                  className="motion-safe:transition-[stroke-dasharray] duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  <NumberTicker value={Math.round(productivityData.score)} />
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Productivity Score</h2>
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                {formatDuration(productivityData.totalSeconds)} of tracked activity
              </p>
            </div>
          </div>

          {comparison && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              comparison.direction === 'up'
                ? 'border-[var(--tier-productive)]/30 bg-[var(--tier-productive-10)] text-[var(--tier-productive)]'
                : comparison.direction === 'down'
                  ? 'border-[var(--tier-distracting)]/30 bg-[var(--tier-distracting-10)] text-[var(--tier-distracting)]'
                  : 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--text-secondary)]'
            }`}>
              {comparison.direction === 'up' && <ArrowUp className="w-4 h-4" />}
              {comparison.direction === 'down' && <ArrowDown className="w-4 h-4" />}
              {comparison.direction === 'neutral' && <Minus className="w-4 h-4" />}
              <span className="font-semibold font-mono tabular-nums">{comparison.diff.toFixed(1)}%</span>
              <span className="text-xs opacity-70">vs avg</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Source Breakdown + Day Utilization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Breakdown. The four sources were indigo / cyan / amber /
            violet — four decorative hues carrying no judgement. Now every
            bar is one monochrome ramp and identity is the icon + label. */}
        <GlassCard variant="notebook" className="border border-[var(--color-border)]">
          <SectionHeader title="Tracked Sources" icon={<Layers className="w-4.5 h-4.5" />} />
          <div className="space-y-3">
            {[
              { key: 'app', label: 'Desktop Apps', icon: Monitor, sec: productivityData.sources.app.totalSec, count: productivityData.sources.app.count },
              { key: 'website', label: 'Websites', icon: Globe, sec: productivityData.sources.website.totalSec, count: productivityData.sources.website.count },
              { key: 'external', label: 'External', icon: Activity, sec: productivityData.sources.external.totalSec, count: productivityData.sources.external.count, disabled: excludeExternal },
              { key: 'focus', label: 'Focus', icon: Zap, sec: productivityData.sources.focus.totalSec, count: productivityData.sources.focus.count },
            ].map((src, i) => {
              const Icon = src.icon;
              const pct = productivityData.totalSeconds > 0 ? (src.sec / productivityData.totalSeconds) * 100 : 0;
              return (
                <div key={src.key} className={`flex items-center gap-3 ${src.disabled ? 'opacity-40' : ''}`}>
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 text-[var(--text-secondary)]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm text-[var(--text-primary)] truncate">
                        {src.label}{src.disabled ? ' (excluded)' : ''}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                        {formatClock(src.sec)}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--color-muted)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full motion-safe:transition-[width] duration-500"
                        style={{ width: `${Math.min(100, pct)}%`, background: monoStep(i) }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[var(--text-muted)] w-10 text-right shrink-0">
                    {Math.round(pct)}%
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Day Utilization Ring. Was an emerald→cyan SVG gradient — two hues
            on one arc, meaning nothing. Utilization is a single magnitude,
            so it is now one hue: the surface accent, theme-aware. */}
        <GlassCard variant="notebook" className="border border-[var(--color-border)] flex flex-col">
          <SectionHeader title="Day Utilization" icon={<Clock className="w-4.5 h-4.5" />}
            action={<span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">{formatClock(productivityData.daySeconds)} / day avg</span>} />
          <div className="flex-1 flex items-center justify-center py-4">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-muted)" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="var(--page-accent)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, Math.min(100, productivityData.dayUtilization)) * 2.639} ${263.9 - Math.max(0, Math.min(100, productivityData.dayUtilization)) * 2.639}`}
                  className="motion-safe:transition-[stroke-dasharray] duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">{Math.round(productivityData.dayUtilization)}%</span>
                <span className="text-[11px] text-[var(--text-muted)] mt-0.5">of 24h tracked</span>
              </div>
            </div>
          </div>
          {/* Same alpha story as the charts: the two verdicts loud, the
              filler bucket quiet. */}
          <div className="grid grid-cols-3 gap-2 px-1 pb-1">
            {(['productive', 'neutral', 'distracting'] as const).map(t => (
              <div key={t} className="text-center">
                <div
                  className="text-sm font-semibold font-mono tabular-nums"
                  style={{ color: tierVar(t), opacity: t === 'neutral' ? 0.75 : 1 }}
                >
                  {formatClock(productivityData.tiers[t].seconds)}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] capitalize">{t}</div>
              </div>
            ))}
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
              {(['productive', 'neutral', 'distracting'] as const).map(t => {
                const sec = t === 'productive' ? filteredProductiveSec : t === 'neutral' ? filteredNeutralSec : filteredDistractingSec;
                return (
                  <GlassCard key={t} variant="notebook" className="border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: tierVar(t), opacity: t === 'neutral' ? 0.55 : 1 }}
                      />
                      <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--text-muted)]">
                        {t}
                      </span>
                    </div>
                    <div
                      className="text-2xl font-bold font-mono tabular-nums"
                      style={{ color: tierVar(t) }}
                    >
                      {formatClock(sec)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
                      {filteredTotalSec > 0 ? Math.round((sec / filteredTotalSec) * 100) : 0}% of time
                    </div>
                  </GlassCard>
                );
              })}

              {/* Total is the anchor, so it stays neutral chrome rather than
                  taking a fourth hue off the meaning budget. */}
              <GlassCard variant="notebook" className="border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[var(--page-accent)]" />
                  <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--text-muted)]">
                    Total Time
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[var(--text-primary)]">
                  {formatDuration(filteredTotalSec)}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                  {filteredAppCount} apps + {filteredWebCount} sites
                </div>
              </GlassCard>
            </div>
          );
        })()}

        {/* Apps vs Websites — THE SPLIT.
            It was two near-identical cards differing only by an indigo/cyan
            border and three bare 2px bars each. Two problems: the bars were
            scaled to each source's OWN total, so a 30%-productive hour of
            browsing drew the same-width bar as a 30%-productive 200-hour
            desktop session — the comparison the card exists to make was
            literally impossible to see. And each tier got its own row, so
            six bars fought for attention on a card with two subjects.

            Now: both sources share ONE width scale, each is a single
            stacked tier bar, so the split is legible in one glance and the
            hue budget is spent only on the tier dimension. */}
        <GlassCard variant="notebook" className="border border-[var(--color-border)]">
          <SectionHeader
            title="Applications vs Websites"
            icon={<ArrowLeftRight className="w-4.5 h-4.5" />}
            action={<span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
              {formatClock(productivityData.appVsWeb.app.totalSec + productivityData.appVsWeb.web.totalSec)} tracked
            </span>}
          />

          <div className="space-y-4">
            {([
              { key: 'app', label: 'Applications', icon: Monitor, data: productivityData.appVsWeb.app },
              { key: 'web', label: 'Websites', icon: Globe, data: productivityData.appVsWeb.web },
            ] as const).map(({ key, label, icon: Icon, data }) => {
              // One scale across both rows: 100% = whichever source has more
              // time. This is the comparison the card is named for.
              const scale = Math.max(productivityData.appVsWeb.app.totalSec, productivityData.appVsWeb.web.totalSec, 1);
              const widthPct = (data.totalSec / scale) * 100;
              const segments = (['productive', 'neutral', 'distracting'] as const).map(t => ({
                tier: t,
                sec: t === 'productive' ? data.productiveSec : t === 'neutral' ? data.neutralSec : data.distractingSec,
              }));
              const unit = key === 'app' ? 'apps' : 'sites';

              return (
                <div key={key}>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <Icon className="w-4 h-4 text-[var(--text-secondary)] self-center" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                      {formatClock(data.totalSec)}
                    </span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      {Math.round(data.score)}% productive
                    </span>
                  </div>

                  <div
                    className="h-2.5 w-full rounded-full bg-[var(--color-muted)] overflow-hidden"
                    role="img"
                    aria-label={`${label}: ${segments.map(s => `${s.tier} ${formatClock(s.sec)}`).join(', ')}`}
                  >
                    <div
                      className="h-full flex motion-safe:transition-[width] duration-500"
                      style={{ width: `${widthPct}%` }}
                    >
                      {segments.map(({ tier, sec }) =>
                        sec > 0 ? (
                          <div
                            key={tier}
                            className="h-full"
                            style={{
                              width: `${(sec / data.totalSec) * 100}%`,
                              background: tierVarFill(tier),
                            }}
                            title={`${label} · ${tier} — ${formatClock(sec)}`}
                          />
                        ) : null
                      )}
                    </div>
                  </div>

                  {/* Legend row: the numbers, not the colour, carry the read. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
                    {segments.map(({ tier, sec }) => (
                      <span key={tier} className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: tierVar(tier), opacity: tier === 'neutral' ? 0.55 : 1 }}
                        />
                        <span className="capitalize">{tier}</span>
                        <span className="text-[var(--text-secondary)]">{formatClock(sec)}</span>
                      </span>
                    ))}
                    <span className="ml-auto text-[var(--text-muted)]">
                      {data.count} {unit} · {Math.round((data.totalSec / (productivityData.appVsWeb.app.totalSec + productivityData.appVsWeb.web.totalSec || 1)) * 100)}% of tracked
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Trend */}
        <GlassCard data-tutorial="prod.trends" variant="notebook" className="border border-[var(--color-border)]">
          <SectionHeader title="Productivity Trend" icon={<TrendingUp className="w-4.5 h-4.5" />} />
          <div className="h-64">
            <Line
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: chartTooltip({ callbacks: { label: (ctx: any) => ` Score: ${ctx.parsed.y}%` } })
                },
                scales: {
                  ...chartScales(),
                  y: { ...chartScales().y, min: 0, max: 100, ticks: { ...chartScales().y.ticks, callback: (v: any) => `${v}%` } }
                },
                animation: barAnimation,
              }}
            />
          </div>
        </GlassCard>

        {/* Time Distribution */}
        <GlassCard variant="notebook" className="border border-[var(--color-border)]">
          <SectionHeader title="Time Distribution" icon={<PieChartIcon className="w-4.5 h-4.5" />} />
          <div className="h-72">
            <Pie
              data={distributionData}
              options={distributionOptions}
            />
          </div>
        </GlassCard>
      </div>

      {/* Horizontal Tier Filter */}
      <GlassCard variant="notebook" className="border border-[var(--color-border)]">
        <div className="flex items-center gap-2">
              <button onClick={() => setTierFilter('productive')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] ${tierFilter === 'productive'
                    ? 'bg-[var(--tier-productive-15)] text-[var(--tier-productive)] border border-[var(--tier-productive)]/40'
                    : 'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}>
                <div className="w-2 h-2 rounded-full bg-[var(--tier-productive)]" /> Productive
              </button>
              <button onClick={() => setTierFilter('neutral')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] ${tierFilter === 'neutral'
                    ? 'bg-[var(--tier-neutral-15)] text-[var(--tier-neutral)] border border-[var(--tier-neutral)]/40'
                    : 'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}>
                <div className="w-2 h-2 rounded-full bg-[var(--tier-neutral)]" /> Neutral
              </button>
              <button onClick={() => setTierFilter('distracting')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] ${tierFilter === 'distracting'
                    ? 'bg-[var(--tier-distracting-15)] text-[var(--tier-distracting)] border border-[var(--tier-distracting)]/40'
                    : 'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}>
            <div className="w-2 h-2 rounded-full bg-[var(--tier-distracting)]" /> Distracting
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
              <div className="ml-auto text-xs text-[var(--text-muted)] font-mono tabular-nums">
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
        <GlassCard variant="notebook" className="border border-[var(--color-border)]">
          <SectionHeader title="Desktop Apps" icon={<Monitor className="w-4.5 h-4.5" />}
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
                <div className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                  {formatDuration(totalSec)} ({filteredTotal > 0 ? Math.round((totalSec / filteredTotal) * 100) : 0}% of {tierFilter === 'all' ? 'total' : tierFilter})
                </div>
              );
            })()} />

          <div className="space-y-1">
            {(() => {
              // Select correct array based on tierFilter
              let sourceArray = productivityData.topProductive;
              if (tierFilter === 'neutral') sourceArray = productivityData.topNeutral;
              else if (tierFilter === 'distracting') sourceArray = productivityData.topDistracting;
              else if (tierFilter === 'all') sourceArray = [...productivityData.topProductive, ...productivityData.topNeutral, ...productivityData.topDistracting];

              const apps = sourceArray.filter(i => i.type === 'app').slice(0, 5);
              const max = Math.max(1, ...apps.map(i => i.duration_sec));

              return apps.length > 0 ? apps.map((item, idx) => {
                const itemTier = tierAssignments.productive.includes(item.category) ? 'productive' :
                  tierAssignments.distracting.includes(item.category) ? 'distracting' : 'neutral';

                return (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors duration-150">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: tierVar(itemTier), opacity: itemTier === 'neutral' ? 0.55 : 1 }}
                    />
                    <span className="text-sm text-[var(--text-primary)] truncate">{item.name}</span>
                    <span className="text-xs text-[var(--text-muted)] truncate hidden sm:inline">({item.category})</span>
                    <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
                      {/* Bar on the shared 0→max scale, so the top-5 actually
                          rank instead of five equal-length rows. */}
                      <div className="w-16 h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full motion-safe:transition-[width] duration-500"
                          style={{ width: `${(item.duration_sec / max) * 100}%`, background: monoStep(MONO_STEPS.length - 1 - Math.min(idx, MONO_STEPS.length - 1)) }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)] w-14 text-right">
                        {formatDuration(item.duration_sec)}
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No {tierFilter === 'all' ? '' : tierFilter} apps tracked in this period</p>
                  <p className="text-xs mt-1">Applications appear here once the tracker logs foreground time</p>
                </div>
              );
            })()}
          </div>
        </GlassCard>

        {/* Websites Breakdown. The category chips used to be inline
            `backgroundColor: ${hex}20` from this file's own 16-colour
            palette — ~12 live categories rendered as a rainbow wall. On
            this page the category is a label, not a judgement: the tier is
            what the filter and the score act on. So the tier dot carries
            the colour and the category is plain text. */}
        <GlassCard variant="notebook" className="border border-[var(--color-border)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] flex items-center gap-2.5">
              <Globe className="w-4.5 h-4.5 text-[var(--text-secondary)]" />
              {tierFilter === 'all' ? 'All Websites' : tierFilter === 'productive' ? 'Productive Websites' : tierFilter === 'neutral' ? 'Neutral Websites' : 'Distracting Websites'}
            </h2>
            <div className="text-xs text-[var(--text-muted)] font-mono tabular-nums shrink-0">
              {formatDuration(filteredWebsites.reduce((sum, d) => sum + d.totalSeconds, 0))} total
            </div>
          </div>

          <div className="space-y-1">
            {filteredWebsites.length > 0 ? (
              filteredWebsites.map((domainData) => {
                const isExpanded = expandedDomains.has(domainData.domain);
                const domainTier = tierAssignments.productive.includes(WEBSITE_CATEGORY_MAP[domainData.dominantCategory] || domainData.dominantCategory) ? 'productive'
                  : tierAssignments.distracting.includes(WEBSITE_CATEGORY_MAP[domainData.dominantCategory] || domainData.dominantCategory) ? 'distracting' : 'neutral';

                return (
                  <div key={domainData.domain} className="rounded-lg overflow-hidden">
                    {/* Domain Header Row */}
                    <button
                      onClick={() => toggleDomain(domainData.domain)}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] text-left"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        )}
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: tierVar(domainTier), opacity: domainTier === 'neutral' ? 0.55 : 1 }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-[var(--text-primary)] truncate">{domainData.domain}</div>
                          {domainData.hasKeywordRules && (
                            <span className="text-[11px] text-[var(--page-accent)]">Smart website</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-[var(--text-muted)] truncate max-w-[9rem] hidden md:inline">
                          {domainData.dominantCategory}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                          {formatDuration(domainData.totalSeconds)}
                        </span>
                      </div>
                    </button>

                    {/* Subpages (expanded) */}
                    {isExpanded && (
                      <div className="mt-1 ml-6 space-y-0.5 border-l border-[var(--color-border)] pl-3">
                        {domainData.logs.slice(0, 20).map((log: any, idx: number) => {
                          const logCategory = WEBSITE_CATEGORY_MAP[log.category] || log.category || 'Other';
                          const logTier = tierAssignments.productive.includes(logCategory) ? 'productive'
                            : tierAssignments.distracting.includes(logCategory) ? 'distracting' : 'neutral';
                          const logTitle = log.title || log.url || 'Unknown page';
                          // Truncate long titles
                          const displayTitle = logTitle.length > 60 ? logTitle.substring(0, 57) + '…' : logTitle;

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-[var(--color-muted)] transition-colors duration-150"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: tierVar(logTier), opacity: logTier === 'neutral' ? 0.5 : 1 }}
                                />
                                <span className="text-xs text-[var(--text-secondary)] truncate">{displayTitle}</span>
                              </div>
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <span className="text-xs text-[var(--text-muted)] truncate max-w-[8rem] hidden lg:inline">
                                  {logCategory}
                                </span>
                                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                                  {formatDuration(log.duration)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {domainData.logs.length > 20 && (
                          <div className="text-xs text-[var(--text-muted)] pl-2 py-1 font-mono">
                            +{domainData.logs.length - 20} more pages
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No {tierFilter === 'all' ? '' : tierFilter} website activity in this period</p>
                <p className="text-xs mt-1">Websites appear here once the tracking browser logs a visit</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Daily Stacked Bar Chart */}
      <GlassCard variant="notebook" className="border border-[var(--color-border)]">
        <SectionHeader title="Daily Activity Breakdown" icon={<BarChart3 className="w-4.5 h-4.5" />} />
        <div className="h-64">
          <Bar
            data={timeBreakdownData}
            options={timeBreakdownOptions}
          />
        </div>
      </GlassCard>

      {/* Top Distracting */}
      {productivityData.topDistracting.length > 0 && (
        <GlassCard variant="notebook" className="border border-[var(--color-border)]">
          <SectionHeader title="Areas to Improve" icon={<TrendingDown className="w-4.5 h-4.5" />}
            action={<span className="text-xs text-[var(--text-muted)]">Distracting activities that lowered your score</span>} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {productivityData.topDistracting.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--tier-distracting)]/[0.07] border border-[var(--tier-distracting)]/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--tier-distracting-12)] flex items-center justify-center flex-shrink-0 text-[var(--tier-distracting)]">
                    {item.type === 'app' ? (
                      <Monitor className="w-4 h-4" />
                    ) : item.type === 'website' ? (
                      <Globe className="w-4 h-4" />
                    ) : item.type === 'focus' ? (
                      <Timer className="w-4 h-4" />
                    ) : (
                      <Activity className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--text-primary)] truncate">{item.name}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{item.category}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold font-mono tabular-nums text-[var(--tier-distracting)]">
                    {formatDuration(item.duration_sec)}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
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
        <GlassCard variant="notebook" className="border border-[var(--color-border)]">
          <SectionHeader title="Peak Productivity Hours" icon={<Clock className="w-4.5 h-4.5" />}
            action={<span className="text-xs text-[var(--text-muted)]">Average across period</span>} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {([
              { key: 'most', label: 'Most Productive', data: peakHours.mostProductive, icon: TrendingUp, tier: 'productive' as const },
              { key: 'least', label: 'Least Productive', data: peakHours.leastProductive, icon: TrendingDown, tier: 'distracting' as const },
            ]).map(({ key, label, data, icon: Icon, tier }) => (
              <div key={key} className="rounded-lg p-4 bg-[var(--color-muted)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: tierVar(tier) }} />
                  <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums" style={{ color: tierVar(tier) }}>
                  {data.label}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1 font-mono tabular-nums">
                  {data.score}% score
                  <span className="ml-2" style={{ color: tierVar(tier) }}>
                    {data.diff > 0 ? `+${data.diff}%` : `${data.diff}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Hourly bar chart. Peak/valley keep the verdict hue; every other
              hour drops to a quiet step so the two extremes are the only
              saturated things in the row. */}
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
                    h.hour === peakHours.mostProductive.hour
                      ? tierHex('productive')
                      : h.hour === peakHours.leastProductive.hour
                        ? tierHex('distracting')
                        : hexA(tierHex('productive'), 0.34)
                  ),
                  borderRadius: 4
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: chartTooltip({
                    callbacks: {
                      title: (items: any[]) => items[0]?.label ?? '',
                      label: (ctx: any) => ` Score: ${ctx.parsed.y}%`,
                    }
                  })
                },
                scales: {
                  x: { grid: { display: false }, border: { display: false }, ticks: { color: chartMutedText(), font: { family: '"JetBrains Mono", monospace', size: 10 } } },
                  y: { display: false, min: 0, max: 100 }
                }
              }}
            />
          </div>
        </GlassCard>
      )}

      {/* Insights Card. Six tiles each with its OWN hover hue
          (emerald / emerald / indigo / cyan / amber / violet) plus
          backdrop-blur — the same information as the four tier tiles above,
          re-stated in six more colours. Flat surface, one hover hue for all
          six, numbers in the foreground ramp. */}
      <GlassCard variant="notebook" className="border border-[var(--color-border)]">
        <SectionHeader title="Insights" icon={<Info className="w-4.5 h-4.5" />} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {([
            { key: 'focus-time', label: 'Focus Time', icon: Zap, value: formatDuration(productivityData.tiers.productive.seconds), note: 'Time on productive activities' },
            { key: 'avg-trend', label: 'Avg Trend Score', icon: Award, value: `${trendAverageScore}%`, note: 'Average of daily trend scores' },
            { key: 'app-time', label: 'App Time', icon: Monitor, value: formatDuration(productivityData.sources.app.totalSec), note: `${Math.round(productivityData.appVsWeb.app.score)}% productive` },
            { key: 'site-time', label: 'Website Time', icon: Globe, value: formatDuration(productivityData.sources.website.totalSec), note: `${Math.round(productivityData.appVsWeb.web.score)}% productive` },
            { key: 'external', label: 'External', icon: Activity, value: formatDuration(productivityData.sources.external.totalSec), note: `${productivityData.sources.external.count} sessions` },
            { key: 'focus-sessions', label: 'Focus Sessions', icon: Timer, value: formatDuration(productivityData.sources.focus.totalSec), note: `${productivityData.sources.focus.count} sessions` },
          ]).map(({ key, label, icon: Icon, value, note }) => (
            <div
              key={key}
              className="p-3.5 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--page-accent)]/40 transition-colors duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--text-muted)] truncate">
                  {label}
                </span>
              </div>
              <div className="text-xl font-bold font-mono tabular-nums tracking-tight text-[var(--text-primary)]">
                {value}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">{note}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Calculation Explanation */}
      <details className="rounded-xl p-4 bg-[var(--color-card)] border border-[var(--color-border)]">
        <summary className="cursor-pointer text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] rounded">
          How is productivity calculated?
        </summary>
        <div className="mt-4 text-sm text-[var(--text-secondary)] space-y-3">
          <p><strong className="text-[var(--text-primary)]">Formula:</strong></p>
          <code className="block bg-[var(--color-muted)] p-2 rounded-lg border border-[var(--color-border)] font-mono text-xs text-[var(--text-primary)]">
            Score = (Productive + Neutral × 0.5) / Total × 100
          </code>
          <p><strong className="text-[var(--text-primary)]">Tier Weights:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            {(['productive', 'neutral', 'distracting'] as const).map(t => (
              <li key={t}>
                <span className="capitalize" style={{ color: tierVar(t) }}>{t}</span>
                {' = '}{t === 'productive' ? '100' : t === 'neutral' ? '50' : '0'}% credit (weight: {t === 'productive' ? '1.0' : t === 'neutral' ? '0.5' : '0.0'})
              </li>
            ))}
          </ul>
          <p><strong className="text-[var(--text-primary)]">Data Sources:</strong></p>
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