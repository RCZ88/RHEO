import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore, Suspense } from 'react';
import { AFK_TRIPPED_EVENT, shouldResetStreak, type AfkPrefs } from '../lib/afk';
import { getToastDurationMs, isSticky } from '../lib/toastDuration';
import { PageShell } from '../components/PageShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useScrollToSection } from '../lib/deepNav';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderStream } from '../lib/renderers/stream';
import { startPhaseClock } from '../lib/currentPhase';

import { TierBreakdownStrip } from './dashboard/TierBreakdownStrip';
import { PinnedActivities } from './dashboard/PinnedActivities';
import { QuickFocusCard } from '../components/focus/QuickFocusCard';
import { ScheduleCard } from './dashboard/ScheduleCard';
import { StatusBand } from './dashboard/StatusBand';

import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { GoalsCard } from '../components/dashboard/GoalsCard';
import { DeadlinesCard } from '../components/dashboard/DeadlinesCard';
import { LongestFocusCard } from '../components/dashboard/LongestFocusCard';
import { useDashboardData } from '../components/dashboard/useDashboardData';
import { InsightStrip } from './dashboard/InsightStrip';
import { useSmartSearch } from '../hooks/useSmartSearch';
import { MomentumHero } from '../components/dashboard/MomentumHero';

import { SectionHeader } from '../components/SectionHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { DayDetailPopup } from '../components/DayDetailPopup';
import {
  ProductivityHeatmap,
  type HeatmapCell,
  type HeatmapMode,
} from '../components/dashboard/ProductivityHeatmap';
import { DeskFlowCardMotion } from '../components/dashboard/DeskFlowCard';
import { WidgetJumpButton } from '../components/dashboard/WidgetJumpButton';
import OrbitSystem from '../components/OrbitSystem';
import { useHomeSummary } from '../hooks/useHomeSummary';
import { useDeepFocus } from '../hooks/useDeepFocus';
import { Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from "motion/react";

import { getDateRange } from '../lib/dateRange';
import { formatLocalDateKey } from '../lib/localDate';
import { stopwatch } from '../lib/stopwatchStore';
import type { Period } from '../lib/dateRange';
import { awaitApi } from '../lib/awaitApi';
import { TimerResetOverlay } from '../components/dashboard/TimerResetOverlay';
import { CardLibrary } from '../components/dashboard/CardLibrary';
import { LayoutGrid, Grid3X3, X, BarChart3, Clock, Terminal, Sun, Minimize2, Maximize2, Check, ChevronDown } from 'lucide-react';
import { maxBy } from '../utils/safeMath';

import { AiUsageWidget } from '../components/dashboard/AiUsageWidget';
import { ConsoleWidget } from '../components/dashboard/ConsoleWidget';
import { FinanceWidget } from '../components/dashboard/FinanceWidget';
import { LearnWidget } from '../components/dashboard/LearnWidget';
import { BrowserWidget } from '../components/dashboard/BrowserWidget';
import { BrainWidget } from '../components/dashboard/BrainWidget';
import { CovenantWidget } from '../components/dashboard/CovenantWidget';
import { HealthWidget } from '../components/dashboard/HealthWidget';
// Library-only opt-in widgets (see OPT_IN_WIDGETS in widgetRegistry.tsx).
// Each renders only when the user enables it from the Card Library.
import { DailySurveyCard } from '../components/dashboard/DailySurveyCard';
import { UnifiedGoalsCard } from '../components/dashboard/UnifiedGoalsCard';
import { StreakCard } from '../components/dashboard/StreakCard';
import { ScheduleSyncCard } from '../components/dashboard/ScheduleSyncCard';
import { DrillDownCard } from '../components/dashboard/DrillDownCard';
import { SpotlightCard } from '../components/dashboard/SpotlightCard';
import { MomentumOrb } from '../components/dashboard/MomentumOrb';
import { MomentumScore } from '../components/dashboard/MomentumScore';
import { buildDashboardData } from './dashboard/aggregateNormalizer';
import { useDashStats } from './dashboard/useDashStats';
import { useDashTheme } from './dashboard/useDashTheme';
import { chartTooltip, watchChartTokens } from '../components/finance/_fx/chartTokens';

interface ActivityFeedItem {
  id: string;
  timestamp: Date;
  startTime: number; // When this session started tracking
  type: 'app' | 'browser';
  name: string;
  category: string;
  tier: 'productive' | 'neutral' | 'distracting';
  isActive?: boolean; // Currently active session
  duration?: number; // Time spent in SECONDS (for completed sessions)
}

interface TimerBehavior {
  neutralAction: 'pause' | 'reset' | 'ignore';
  distractingAction: 'pause' | 'reset' | 'ignore';
}

interface DashboardPageProps {
  appColors?: Record<string, string>;
  categoryOverrides?: Record<string, string>;
  timerBehavior?: TimerBehavior;
  selectedPeriod?: Period;
  onSelectedPeriodChange?: (period: Period) => void;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  trackingBrowser?: string;
  trackingBrowsers?: string[];
  trackerAppMode?: 'show-other' | 'pause' | 'track';
  tierAssignments?: {
    productive: string[];
    neutral: string[];
    distracting: string[];
  };
  // Timer state from parent (persisted at App level)
  timerState?: {
    productiveMs: number;
    startTime: number;
    paused: boolean;
    lastTier: string | null;
    externalRunning: boolean;
    externalStart: number | null;
    externalElapsed: number;
  };
  onTimerStateChange?: (state: any) => void;
  // Activity feed from parent (use different name to avoid conflict)
  activityFeed?: any[];
  onActivityFeedChange?: (items: any[]) => void;
  externalActivities?: any[];
  externalWeeklyStats?: any;
}




interface ExternalActivity {
  id: number;
  name: string;
  type: 'stopwatch' | 'checkin';
  color: string;
  icon: string;
  is_productive: boolean;
}

interface HourlyHeatmapData {
  day: string;
  hours: number;
}

interface SolarSystemData {
  name: string;
  usage_ms: number;
  category: string;
}

interface TimelineItem {
  id: string;
  startHour: number;
  endHour: number;
  label: string;
  category: 'external' | 'app' | 'browser' | 'log';
  color: string;
  duration: number;
  details?: string;
  /** raw `logs.category` (or external session type) so the day page can tier it */
  categoryName?: string;
}

interface ForegroundData {
  app?: string;
  title?: string;
  category?: string;
  tier?: 'productive' | 'neutral' | 'distracting';
  isReal?: boolean;
}


/**
 * Fold a `get-day-detail` payload into the timeline shape DayDetailPopup renders.
 * Shared by the heatmap's day click and the popup's own prev/next-day navigation
 * so the two can never drift apart again.
 */
function buildDayTimelineItems(detail: { logs?: any[]; externalSessions?: any[] }): TimelineItem[] {
  const items: TimelineItem[] = [];

  (detail.logs || []).forEach((log: any) => {
    const logDate = new Date(log.timestamp);
    const startHour = logDate.getHours() + logDate.getMinutes() / 60;
    const durationSec = (log.duration_ms || 0) / 1000;
    if (durationSec <= 0) return;
    const isBrowser = !!log.is_browser_tracking;
    const label = isBrowser ? (log.domain || log.app) : log.app;
    items.push({
      id: `log-${log.id}`,
      startHour,
      endHour: Math.min(startHour + durationSec / 3600, 24),
      label: label || 'Unknown',
      category: isBrowser ? 'browser' : 'app',
      // Category is carried through so the popup can resolve a real tier instead
      // of treating every row as equally productive.
      color: isBrowser ? 'var(--tier-productive)' : 'var(--tier-neutral)',
      duration: Math.round(durationSec),
      details: log.title || log.category,
      categoryName: log.category,
    });
  });

  (detail.externalSessions || []).forEach((session: any) => {
    const startDate = new Date(session.started_at);
    const endDate = session.ended_at ? new Date(session.ended_at) : new Date();
    const startHour = startDate.getHours() + startDate.getMinutes() / 60;
    const durationSec = Math.max(0, (endDate.getTime() - startDate.getTime()) / 1000);
    if (durationSec <= 0) return;
    items.push({
      id: `ext-${session.id}`,
      startHour,
      endHour: Math.min(startHour + durationSec / 3600, 24),
      label: session.activity_name || 'External',
      category: 'external',
      color: 'var(--info)',
      duration: Math.round(durationSec),
      categoryName: session.type,
    });
  });

  return items.sort((a, b) => a.startHour - b.startHour);
}

// One source of truth for the productivity chart's three series. The bars
// hardcoded these hexes while the legend swatches read
// var(--success) / var(--warning) / var(--info). Those are identical in dark
// mode (#34d399 / #fbbf24 / #38bdf8), so the legend looked correct — but in
// LIGHT mode the tokens flip to #166534 / #92400e / #1d4ed8 while the bars
// stayed pastel, so the legend described colours the chart was not drawing.
// Canvas cannot resolve `var(--x)` in fillStyle, so the bars keep literals and
// the legend is bound to the same literals instead of diverging from them.
const PRODUCTIVITY_SERIES = {
  productive: '#34d399',
  other: '#fbbf24',
  external: '#38bdf8',
} as const;

// Tier assignments for categorizing productivity
const DEFAULT_TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other', 'Browser'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming']
};

// Website category to app category mapping — must match ProductivityPage
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

function formatDuration(ms: number): string {
  if (!ms || !isFinite(ms)) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

interface ActivityLog {
  id: number;
  timestamp: Date;
  app: string;
  category: string;
  duration: number;
  title?: string;
  project?: string;
  is_browser_tracking?: boolean;
}

interface TimerBehavior {
  neutralAction: 'pause' | 'reset' | 'ignore';
  distractingAction: 'pause' | 'reset' | 'ignore';
}

interface ActivityFeedItem {
  id: string;
  timestamp: Date;
  startTime: number; // When this session started tracking
  type: 'app' | 'browser';
  name: string;
  category: string;
  tier: 'productive' | 'neutral' | 'distracting';
  isActive?: boolean; // Currently active session
  duration?: number; // Time spent in SECONDS (for completed sessions)
}

interface DashboardPageProps {
  appColors?: Record<string, string>;
  categoryOverrides?: Record<string, string>;
  timerBehavior?: TimerBehavior;
  selectedPeriod?: Period;
  onSelectedPeriodChange?: (period: Period) => void;
  dateOffset?: number;
  onDateOffsetChange?: (offset: number) => void;
  trackingBrowser?: string;
  trackingBrowsers?: string[];
  trackerAppMode?: 'show-other' | 'pause' | 'track';
  tierAssignments?: {
    productive: string[];
    neutral: string[];
    distracting: string[];
  };
  // Timer state from parent (persisted at App level)
  timerState?: {
    productiveMs: number;
    startTime: number;
    paused: boolean;
    lastTier: string | null;
    externalRunning: boolean;
    externalStart: number | null;
    externalElapsed: number;
  };
  onTimerStateChange?: (state: any) => void;
  // Activity feed from parent (use different name to avoid conflict)
  activityFeed?: any[];
  onActivityFeedChange?: (items: any[]) => void;
  externalActivities?: any[];
  externalWeeklyStats?: any;
  /** Raw log rows, when the parent already has them. Lets the heatmap skip its own
   *  full-table fetch (~10 MB / 29k rows on every dashboard mount).
   *  Optional: with no prop supplied the original fetch path still runs. */
  sharedLogs?: any[] | null;
}

// Map browser brand names to OS process names (what active-win returns)
// Duplicated in App.tsx and main.ts — keep in sync
const BROWSER_PROCESS_NAMES_DASHBOARD: Record<string, string[]> = {
  'comet': ['chrome', 'comet', 'chromium'],
  'chrome': ['chrome', 'chromium'],
  'brave': ['brave', 'chrome'],
  'edge': ['msedge', 'edge'],
  'opera': ['opera'],
  'vivaldi': ['vivaldi'],
    // Zen/Floorp are Firefox-based: the extension reports browserName "Firefox",
  // but the FOREGROUND PROCESS is "zen". Without these aliases the comparison
  // was 'zen'.includes('firefox') -> false, so the website never replaced the
  // app name and the stopwatch just showed "zen".
  'firefox': ['firefox', 'firefox-esr', 'zen', 'zen-browser', 'zenbrowser', 'floorp'],
  'zen': ['zen', 'firefox', 'firefox-esr', 'zen-browser', 'zenbrowser', 'floorp'],
  'arc': ['arc'],
  'safari': ['safari'],
};

function isAppMatchingBrowserDashboard(appName: string, browserName: string | string[]): boolean {
  if (!appName || !browserName) return false;
  const appLower = appName.toLowerCase().replace(/\.exe$/i, '');
  const browsers = Array.isArray(browserName) ? browserName : [browserName];
  return browsers.some(b => {
    const browserLower = b.toLowerCase();
    const processNames = BROWSER_PROCESS_NAMES_DASHBOARD[browserLower] || [browserLower];
    return appLower.includes(browserLower) ||
      browserLower.includes(appLower) ||
      processNames.some(p => appLower.includes(p));
  });
}

export default function DashboardPage({
  externalActivities = [],
  appColors = {},
  categoryOverrides = {},
  // Default must MATCH App.tsx:1627, which always passes a real value —
  // this one was 'ignore'/'ignore' and silently contradicted it.
  timerBehavior = { neutralAction: 'pause', distractingAction: 'reset' },
  selectedPeriod = 'week',
  onSelectedPeriodChange,
  dateOffset = 0,
  onDateOffsetChange,
  trackingBrowser = '',
  trackingBrowsers = [],
  trackerAppMode = 'track',
  tierAssignments = { productive: ['IDE', 'AI Tools', 'Education', 'Productivity', 'Tools'], neutral: ['Browser', 'Communication', 'Design', 'News', 'Uncategorized', 'Other'], distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming'] },
  timerState = null,
  onTimerStateChange,
  activityFeed: feedFromParent = [],
  onActivityFeedChange,
  sharedLogs = null
}: DashboardPageProps) {
  const { isVisible, toggleVisible, moveCell, reset, orderedRow, hiddenCount } = useDashboardLayout();

  const getPersistedTimerState = () => {
    // Try parent state first - only if it has meaningful data
    if (timerState && typeof timerState === 'object' && (timerState as any).externalRunning === true) {
      return timerState;
    }
    // Fallback to localStorage - check for meaningful data
    if (typeof window === 'undefined') return { productiveMs: 0, distractingMs: 0, startTime: 0, paused: false, lastTier: null, externalRunning: false, externalStart: null, externalElapsed: 0, selectedExternalActivity: null };
    try {
      const saved = localStorage.getItem('deskflow-timer-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only use localStorage if there's meaningful data
        if (parsed.externalRunning || parsed.externalElapsed > 0 || parsed.selectedExternalActivity) {
          return parsed;
        }
      }
    } catch (e) { }
    return { productiveMs: 0, distractingMs: 0, startTime: 0, paused: false, lastTier: null, externalRunning: false, externalStart: null, externalElapsed: 0, selectedExternalActivity: null };
  };
  const persistedTimer = getPersistedTimerState();

  const [selectedExternalActivity, setSelectedExternalActivity] = useState<ExternalActivity | null>(() => {
    // Restore from persisted state if external session was running
    const saved = persistedTimer.selectedExternalActivity as { id: number; name: string } | null;
    if (persistedTimer.externalRunning && saved) {
      return { id: saved.id, name: saved.name, category: 'External' };
    }
    return null;
  });

  // Stopwatch readouts now come from a module-level store, NOT page-local state.
  // `App.tsx` renders `<Routes key={location.pathname}>`, which force-remounts the
  // page on every navigation — page-local accumulators died with it and the timer
  // restarted from 00:00 whenever the user left the dashboard. The store outlives
  // the component, so a remount re-reads the running value instead of resetting.
  const stopwatchSnap = useSyncExternalStore(stopwatch.subscribe, stopwatch.getSnapshot, stopwatch.getSnapshot);
  const currentProductiveMs = stopwatchSnap.productiveMs;
  const currentDistractingMs = stopwatchSnap.distractingMs;
  const isPaused = stopwatchSnap.paused;
  // Local setters now drive the store. `setIsPaused` writes through so every
  // existing call site (pause button, tracker auto-pause, resume) keeps working.
  const setIsPaused = useCallback((paused: boolean) => stopwatch.setPaused(paused), []);
  const [lastTier, setLastTier] = useState<'productive' | 'neutral' | 'distracting' | null>(persistedTimer.lastTier);
  // Display helpers — directly reflect the current app's tier, not timerBehavior settings
  const isCurrentlyProductive = lastTier === 'productive' && !isPaused;
  const isDistracting = lastTier === 'distracting' && !isPaused;

  // Distraction log — records which app/site broke the stopwatch
  const [distractions, setDistractions] = useState<Array<{ name: string; type: 'app' | 'website'; timestamp: number }>>([]);

  // When the current productive segment began. Persisted so the Longest Focus
  // card gets a real start/end pair instead of "now"/"now".
  const stopwatchAccumulatedStartRef = useRef<number>(0);
  // Last tier we handed the store, for transition logging only.
  const prevTierRef = useRef<'productive' | 'neutral' | 'distracting' | null>(null);


  // Track productivity sessions for saving to database
  const productivitySessionStartRef = useRef<number | null>(null);
  const productivitySessionAppRef = useRef<string | null>(null);

  // Track last user interaction (mouse/keyboard) for idle detection
  const lastInteractionRef = useRef<number>(Date.now());

  // ── Debounce period switches (must be before fetchSessions) ──
  const [fetchPeriod, setFetchPeriod] = useState(selectedPeriod);
  const periodTimerRef = useRef<number | null>(null);
  const fetchReqId = useRef(0);

  const fmtSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };


  // Global interaction listener — detects user activity for idle-aware session tracking
  useEffect(() => {
    const update = () => { lastInteractionRef.current = Date.now(); };
    window.addEventListener('mousemove', update, { passive: true });
    window.addEventListener('keydown', update, { passive: true });
    window.addEventListener('click', update, { passive: true });
    return () => {
      window.removeEventListener('mousemove', update);
      window.removeEventListener('keydown', update);
      window.removeEventListener('click', update);
    };
  }, []);

  // ── Smart search: register dashboard sections as searchable content ──────────
  const _smartSearchRegistered = useSmartSearch('dashboard', [
    { id: 'hero', pageId: 'dashboard', title: 'Welcome back', section: 'Hero', text: 'Your focus dashboard \u2014 see today\u2019s productivity at a glance, pick a task, and start focusing.', rank: 2.0 },
    { id: 'pinned', pageId: 'dashboard', title: 'Pinned Activities', section: 'Pinned', text: 'Activities you\u2019ve pinned to the dashboard for quick access. Pin any activity from the activity list.', rank: 1.2 },
    { id: 'quick-focus', pageId: 'dashboard', title: 'Quick Focus', section: 'Focus Start', text: 'Start a focused work session on a task. Track productive time and build streaks.', rank: 1.5 },
    { id: 'schedule', pageId: 'dashboard', title: 'Today\u2019s Schedule', section: 'Schedule', text: 'Your planned schedule for today \u2014 focus sessions, meetings, and planned work blocks.', rank: 1.2 },
    { id: 'goals', pageId: 'dashboard', title: 'Goals', section: 'Goals Card', text: 'Your active goals and progress toward each one. Set and track long-term objectives.', rank: 1.2 },
    { id: 'deadlines', pageId: 'dashboard', title: 'Deadlines', section: 'Deadlines Card', text: 'Upcoming deadlines from your tracked activities. Stay on top of due dates.', rank: 1.2 },
    { id: 'longest-focus', pageId: 'dashboard', title: 'Longest Focus Session', section: 'Longest Focus', text: 'Your longest uninterrupted focus session \u2014 track and beat your personal best.', rank: 1.0 },
    { id: 'insights', pageId: 'dashboard', title: 'Insights', section: 'Insight Strip', text: 'AI-powered insights and recommendations based on your focus patterns and productivity data.', rank: 1.0 },
    { id: 'momentum', pageId: 'dashboard', title: 'Momentum', section: 'Momentum Hero', text: 'Your momentum score \u2014 how consistently you\u2019re building productive habits over time.', rank: 0.8 },
    { id: 'tier-breakdown', pageId: 'dashboard', title: 'Tier Breakdown', section: 'Tier Breakdown', text: 'Breakdown of your time across productive, neutral, and distracting app categories.', rank: 0.8 },
  ]);

  // Persist external stopwatch too
  // FIX: If session is running but start time is missing, recalculate from database
  const [externalSessionRunning, setExternalSessionRunning] = useState(persistedTimer.externalRunning);

  // Home summary for cross-module strip
  useScrollToSection(); // Read deepNav sessionStorage hint and scroll on mount
  const homeSummary = useHomeSummary();
  const [externalSessionStart, setExternalSessionStart] = useState<Date | null>(null); // Will be set in useEffect
  const [externalElapsedMs, setExternalElapsedMs] = useState(0); // Will be calculated in useEffect

  // Restore external session on mount - fetch from database if running
  useEffect(() => {
    if (!externalSessionRunning) return;

    // Try to get active session from database
    if (window.deskflowAPI?.getActiveExternalSession) {
      window.deskflowAPI.getActiveExternalSession().then((session: any) => {
        if (session?.started_at) {
          const startTime = new Date(session.started_at);
          setExternalSessionStart(startTime);
          const elapsed = Date.now() - startTime.getTime();
          setExternalElapsedMs(elapsed);
          console.log('[Dashboard] Restored external session from DB:', session.name, 'elapsed:', Math.floor(elapsed / 1000), 's');
        } else {
          // Fallback to persisted values
          const fallbackStart = persistedTimer.externalStart ? new Date(persistedTimer.externalStart) : null;
          if (fallbackStart) {
            setExternalSessionStart(fallbackStart);
            setExternalElapsedMs(Date.now() - fallbackStart.getTime());
          }
        }
      }).catch(err => {
        console.error('[Dashboard] Failed to restore external session:', err);
        // Fallback to persisted values
        const fallbackStart = persistedTimer.externalStart ? new Date(persistedTimer.externalStart) : null;
        if (fallbackStart) {
          setExternalSessionStart(fallbackStart);
          setExternalElapsedMs(Date.now() - fallbackStart.getTime());
        }
      });
    } else {
      // No IPC available - use persisted values
      const fallbackStart = persistedTimer.externalStart ? new Date(persistedTimer.externalStart) : null;
      if (fallbackStart) {
        setExternalSessionStart(fallbackStart);
        setExternalElapsedMs(Date.now() - fallbackStart.getTime());
      }
    }
  }, [externalSessionRunning]);
  const [externalTrackingMode, setExternalTrackingMode] = useState<'immediate' | 'interaction'>('immediate');
  const [pinnedActivities, setPinnedActivities] = useState<ExternalActivity[]>([]);
  const [pausedByTrackerApp, setPausedByTrackerApp] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  // Load persisted activity feed from localStorage
  const getPersistedActivityFeed = (): ActivityFeedItem[] => {
    // Try parent activityFeed first
    if (feedFromParent && feedFromParent.length > 0) {
      return feedFromParent.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
        isActive: false // FIX: Clear active state on restore
      }));
    }
    // Fallback to localStorage
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('deskflow-activity-feed');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
          isActive: false // FIX: Clear active state on restore - prevents stale elapsed times
        }));
      }
    } catch (e) { }
    return [];
  };
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>(getPersistedActivityFeed());
  const activityFeedRef = useRef<ActivityFeedItem[]>(getPersistedActivityFeed());

  // Helper: update feed + propagate to parent so it stays in sync across re-mounts
  const updateFeed = useCallback((items: ActivityFeedItem[]) => {
    activityFeedRef.current = items;
    setActivityFeed(items);
    onActivityFeedChange?.(items);
  }, [onActivityFeedChange]);

  // Debounce period switches: UI responds immediately, but data fetches settle
  useEffect(() => {
    if (periodTimerRef.current) clearTimeout(periodTimerRef.current);
    periodTimerRef.current = window.setTimeout(() => {
      setFetchPeriod(selectedPeriod);
    }, 200);
    return () => {
      if (periodTimerRef.current) clearTimeout(periodTimerRef.current);
    };
  }, [selectedPeriod]);

  // Dashboard data from backend (replaces allLogs-based client-side computation)
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Follow Through finance data for dashboard card
  const [ftData, setFtData] = useState<{ totalExpense: number; breakdown: { label: string; total: number; count: number }[] } | null>(null);
  const [ftPersons, setFtPersons] = useState<{ id: number; name: string; balance?: number; wallet_id?: number | null }[]>([]);
  const [lastTxDate, setLastTxDate] = useState<{ lastUpdated: string; lastDate: string } | null>(null);

  // Per-app / per-domain tier overrides. These beat the category-derived tier in
  // getTierFromCategory, so a single app can be re-tiered without dragging every
  // other app in its category with it. Written by set-app-tier / set-domain-tier.
  const [appTierMap, setAppTierMap] = useState<Record<string, 'productive' | 'neutral' | 'distracting'>>({});
  const [domainTierMap, setDomainTierMap] = useState<Record<string, 'productive' | 'neutral' | 'distracting'>>({});

  useEffect(() => {
    let cancelled = false;
    const api = window.deskflowAPI as any;
    if (!api?.getAppTierMap) return;
    Promise.all([api.getAppTierMap?.(), api.getDomainTierMap?.()])
      .then(([apps, domains]: any[]) => {
        if (cancelled) return;
        if (apps && typeof apps === 'object') setAppTierMap(apps);
        if (domains && typeof domains === 'object') setDomainTierMap(domains);
      })
      .catch(() => { /* non-fatal — fall back to category-derived tiers */ });
    return () => { cancelled = true; };
  }, []);

  // Gap/unfilled time indicator
  const [unfilledMinutes, setUnfilledMinutes] = useState(0);
  const [gapCount, setGapCount] = useState(0);

  // Dashboard data via unified hook (goals, deadlines, schedule, suggestions, insights)
  const {
    goals, deadlines, reminders, schedule, longTermGoals, suggestions, insights: dashInsights,
    momentum,
    loading: dashLoading, error: dashError, lastUpdated,
    addGoal, updateGoal, deleteGoal, toggleGoal,
    addDeadline, updateDeadline, deleteDeadline, completeDeadline,
    addScheduleEntry, updateScheduleEntry, deleteScheduleEntry,
    generateSuggestions, acceptSuggestion, dismissSuggestion,
    refresh: refreshDashboard,
  } = useDashboardData();

  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];

  const [masteryMastered, setMasteryMastered] = useState(0);
  const [masteryTotal, setMasteryTotal] = useState(0);
  const [streak, setStreak] = useState(0);

  // AFK action "reset streak" / "reset both": the stopwatch store owns the timer
  // side of this, the streak lives here, so the two halves meet on one event.
  useEffect(() => {
    const onAfk = (e: Event) => {
      const p = (e as CustomEvent).detail as AfkPrefs | undefined;
      if (p && shouldResetStreak(p)) {
        setStreak(0);
        console.log('[AFK] streak reset — user was away');
      }
    };
    window.addEventListener(AFK_TRIPPED_EVENT, onAfk);
    return () => window.removeEventListener(AFK_TRIPPED_EVENT, onAfk);
  }, []);
  const [bestDay, setBestDay] = useState('--');
  const [productivityScore, setProductivityScore] = useState(0);
  const [longestFocus, setLongestFocus] = useState<any>({ today: [], week: [], allTime: [] });
  const [longestFocusLoading, setLongestFocusLoading] = useState(true);

  // Merge hook insights with page-computed streak/productivityScore
  const dashboardInsights = useMemo(() => ({
    streak: streak || dashInsights.streak || 0,
    completionRate: dashInsights.completionRate || 0,
    momentum: productivityScore || dashInsights.momentum || 0,
    longestStreak: dashInsights.longestStreak || 0,
    categoryBalance: dashInsights.categoryBalance || [],
    urgentDeadlines: dashInsights.urgentDeadlines || 0,
    focusTimeMinutes: dashInsights.focusTimeMinutes || 0,
    aiSuggestionCount: dashInsights.aiSuggestionCount || 0,
  }), [streak, productivityScore, dashInsights]);

  // ── Foreground state (hoisted: widgetData below reads these) ──
  const [currentApp, setCurrentApp] = useState<ForegroundData | null>(null);
  const [isInBrowser, setIsInBrowser] = useState(false); // Track if currently in tracking browser
  const [currentWebsite, setCurrentWebsite] = useState<{ title?: string; url?: string; category?: string; domain?: string; browserName?: string; profileName?: string; profileId?: string } | null>(null);

  // ── Live current website ────────────────────────────────────────────────────
  // THE BUG: setCurrentWebsite was declared here and then called with `null` from
  // four separate places, but NO path ever supplied a real value. So
  // currentWebsite was permanently null, and although StatusBand was already
  // wired to receive `currentWebsite.title` / `.domain` / `.category` whenever
  // isInBrowser was true, every one of those resolved to undefined and the band
  // silently fell back to the app name. The website never appeared.
  //
  // The desktop main process now emits a `live-site` browser-tracking-event on
  // every ACCEPTED /browser-data payload (and a null-domain one when the browser
  // is no longer foreground). Accepting is exactly the condition "a browser that
  // has the extension is the foreground app", so no extra check is needed.
  // When the extension last reported a live site. The foreground poll runs about
  // once a second and used to wipe `currentWebsite` whenever it saw a non-browser
  // app or a momentary null read — which on this machine happens often enough to
  // win the race against the site event, leaving the band on "No site tracked"
  // while real data was already flowing. A site we heard about moments ago is
  // better evidence than a poll sample, so it wins for a short grace window.
  const liveSiteAtRef = useRef(0);
  const LIVE_SITE_GRACE_MS = 12000;
  const clearWebsiteUnlessLive = () => {
    if (Date.now() - liveSiteAtRef.current < LIVE_SITE_GRACE_MS) return;
    liveSiteAtRef.current = 0;
    setCurrentWebsite(null);
  };

  useEffect(() => {
    if (!window.deskflowAPI?.onBrowserTrackingEvent) return;
    const unsub = window.deskflowAPI.onBrowserTrackingEvent((d: any) => {
      if (!d || d.type !== 'live-site') return;
      if (!d.domain) { liveSiteAtRef.current = 0; setCurrentWebsite(null); return; }
      liveSiteAtRef.current = Date.now();
      setCurrentWebsite({
        domain: d.domain,
        url: d.url,
        title: d.title || d.domain,
        browserName: d.browser || undefined,
      });
      // Deliberately NOT calling setIsInBrowser(true) here. I did, and it
      // paused the stopwatch: the foreground poll owns that flag, and
      // forcing it from a 30s cadence event desynced the tier logic that
      // decides productive vs distracting. This handler's only job is to
      // carry WHAT the site is. The poll already decides THAT a browser is up.
    });
    return () => { unsub && unsub(); };
  }, []);

  // ── Adaptive display time (hoisted: widgetData below reads displayTime) ──
  // Adaptive display: show what's actually running
  //
  // The NUMBER is `stopwatchSnap.displayMs` — decided once, in the store, and
  // rendered by the sidebar rail from the same field. This used to reimplement
  // the choice here from four different conditions, which is how the hero and
  // the sidebar ended up showing two unrelated clocks. Only the LABEL is
  // composed here, because it needs the app/site name the store does not know.
  const displayTime = useMemo(() => {
    const source = stopwatchSnap.displaySource;
    if (source === 'external') {
      return { ms: stopwatchSnap.displayMs, label: `External: ${stopwatchSnap.externalLabel || selectedExternalActivity?.name || 'Running'}` };
    }
    if (source === 'distracting') {
      const appName = currentApp?.app || currentWebsite?.title || currentWebsite?.domain || 'Unknown';
      return { ms: stopwatchSnap.displayMs, label: `Distracting: ${appName}` };
    }
    if (source === 'productive') {
      return { ms: stopwatchSnap.displayMs, label: 'Productive' };
    }
    return { ms: stopwatchSnap.displayMs, label: isPaused ? 'Paused' : 'Idle' };
  }, [stopwatchSnap.displayMs, stopwatchSnap.displaySource, stopwatchSnap.externalLabel, selectedExternalActivity, currentApp, currentWebsite, isPaused]);

  // ── Live focus session for the Longest Focus widget ──────────────────────
  //
  // `get-longest-focus` derives sessions from `logs` rows, and a row is only
  // written once its window closes. So the session you are IN right now was
  // never in the data: the widget could never show it, and — the actual bug —
  // it could never overtake the day's stored best even after running past it.
  // That is why "max focus session of the day" looked wrong while productive.
  //
  // The live session is therefore built here from timer state and merged into
  // the fetched lists, where it competes on equal terms by duration. It is
  // flagged `live` so the card can mark it as still-running rather than
  // presenting an unfinished session as a completed record.
  const liveFocusSession = useMemo(() => {
    // Gate on the STOPWATCH, not on `lastTier`.
    //
    // `lastTier` describes the foreground app right now and flips the moment you
    // alt-tab, while the productive total keeps accruing across that. Gating on it
    // meant a running session vanished from the card the instant focus moved, so
    // "longest today" kept showing the last *persisted* row (a 2-minute terminal
    // stint) while the stopwatch showed 7+ minutes. The stopwatch's own tier is
    // the thing that actually accumulated this time.
    const storeTier = stopwatchSnap.activeTier;
    const hasRealTime = (currentProductiveMs || currentDistractingMs || 0) >= 1000;
    if (isPaused || !hasRealTime) return null;
    if (storeTier !== 'productive' && lastTier !== 'productive') return null;

    const isWeb = isInBrowser;
    const name = isWeb
      ? (currentWebsite?.title || currentWebsite?.domain || 'Browser')
      : (currentApp?.app || currentApp?.title || 'Current session');
    const endMs = Date.now();
    const startMs = stopwatchAccumulatedStartRef.current || (endMs - currentProductiveMs);
    const seconds = Math.floor((storeTier === 'distracting' ? currentDistractingMs : currentProductiveMs) / 1000);
    return {
      apps: [name],
      app: name,
      category: (isWeb ? currentWebsite?.category : currentApp?.category) || 'Other',
      title: isWeb ? (currentWebsite?.title || '') : '',
      durationSeconds: seconds,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      live: true,
    };
    // currentProductiveMs ticks each second, so this recomputes each second —
    // which is what makes the widget climb in real time.
  }, [lastTier, isPaused, stopwatchSnap.activeTier, currentProductiveMs, currentDistractingMs, isInBrowser, currentApp, currentWebsite]);

  // Merge the live session into today's and this week's lists, re-sorted so a
  // running session that has passed the stored best becomes the new #1.
  const longestFocusWithLive = useMemo(() => {
    if (!liveFocusSession) return longestFocus;
    const merge = (list: any[]) =>
      [...(Array.isArray(list) ? list : []), liveFocusSession]
        .sort((a: any, b: any) => (b?.durationSeconds || 0) - (a?.durationSeconds || 0));
    return {
      ...longestFocus,
      today: merge(longestFocus?.today),
      week: merge(longestFocus?.week),
      // The live session was NOT merged here before, so on the "Best" (allTime)
      // tab a running session could never win — "max focus time" looked stuck
      // even after you focused for longer than the stored record.
      allTime: merge(longestFocus?.allTime),
    };
  }, [longestFocus, liveFocusSession]);

  // ── Widget Data (collected for widget system) ──
  // Real data for the 8 stat widgets. Each fetch is independently guarded inside
  // the hook, so one failing endpoint never blanks another widget.
  const dashStats = useDashStats({ enabled: true });
  const { theme: dashTheme, toggle: toggleDashTheme } = useDashTheme();
  /* A <canvas> cannot recompute its own colours, so this observer is what
     makes the Dashboard chart tooltip re-skin when the theme flips. */
  useEffect(() => watchChartTokens(), []);

  const widgetData = useMemo(() => ({
    goals,
    longTermGoals,
    suggestions,
    insights: dashboardInsights,
    streak,
    productivityScore,
    deadlines,
    reminders,
    schedule,
    overview: dashboardData?.overview || null,
    recentSessions: dashboardData?.recentSessions || [],
    activityFeed,
    focusMinutes: dashboardData?.focusMinutes || 0,
    focusProgress: dashboardData?.focusProgress || 0,
    isPaused,
    isCurrentlyProductive,
    isDistracting,
    displayTimeMs: displayTime?.ms || 0,
    totalFocusedMs: (dashboardData?.overview?.productiveSeconds || 0) * 1000,
    currentAppName: isInBrowser
      ? (currentWebsite?.title || currentWebsite?.domain || '')
      : (currentApp?.app || currentApp?.title || ''),
    sleepData: dashboardData?.sleepData || [],
    avgSleep: dashboardData?.avgSleep || 0,
    sleepDebt: dashboardData?.sleepDebt || 0,
    masteryMastered,
    masteryTotal,
    ftData: null,
    ftPersons: [],
    lastTxDate: null,
    dashboardCurrency: 'USD',
    weeklyHeatmap: dashboardData?.weeklyHeatmap || [],
    // The SAME arrays the 3D Orbit modal is handed at :3408. Previously absent
    // from the context, which is why the app-ecosystem grid slot rendered null
    // and why any widget needing this data had to re-fetch it independently.
    appStats: dashboardData?.appStats || [],
    websiteStats: dashboardData?.websiteStats || [],
    aiInsights,
    momentum: null,
    unfilledMinutes: 0,
    gapCount: 0,
    loading: dashLoading,
    error: dashError,
    // ── previously never supplied → every one of these rendered a permanent zero ──
    aiUsage: dashStats.aiUsage,
    financeSummary: dashStats.financeSummary,
    learnStats: dashStats.learnStats,
    browserStats: dashStats.browserStats,
    brainStats: dashStats.brainStats,
    consoleStats: dashStats.consoleStats,
    covenantStats: dashStats.covenantStats,
    sleepStats: dashStats.sleepStats,
  }), [goals, longTermGoals, suggestions, dashboardInsights, streak, productivityScore,
       deadlines, reminders, schedule, dashboardData, activityFeed, isPaused,
       isCurrentlyProductive, isDistracting, displayTime, currentApp, currentWebsite,
       isInBrowser, masteryMastered, masteryTotal,
       aiInsights, dashLoading, dashError, dashStats]);

  // Fetch non-dashboard data (sleep, etc.)
  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (!api) return;

    // AI Insights
    api.getInsightStrip?.({ period: 'today' })?.then((res: any) => {
      try {
        if (Array.isArray(res?.insights)) setAiInsights(res.insights.slice(0, 3));
        else if (Array.isArray(res)) setAiInsights(res.slice(0, 3));
      } catch { /* ignore */ }
    }).catch(() => {});

    // Mastery — skip if learnGetProfile requires { key } and handler may not exist
    // Will show 0/0 mastery gracefully
  }, []);
  useEffect(() => {
    let cancelled = false;
    const thisReq = ++fetchReqId.current;
    (async () => {
      try {
        const api = await awaitApi();
        console.log('[FROZEN-DBG] Dashboard fetch START period=', fetchPeriod, 'dateOffset=', dateOffset);
        const t0 = performance.now();
        // NOTE: `weekOffset` is deliberately NOT sent. The heatmap owns its own week
        // cursor (see ProductivityHeatmap) and `get-dashboard-aggregates` ignores the
        // field anyway — sending it only forced a redundant full re-fetch of every
        // widget on the page each time the user paged the heatmap.
        const data = await api.getDashboardAggregates({
          period: fetchPeriod,
          dateOffset,
          platform: platformFilter === 'all' ? undefined : platformFilter,
        });
        if (cancelled) return;
        if (thisReq !== fetchReqId.current) return;
        const t1 = performance.now();
        console.log('[FROZEN-DBG] Dashboard fetch DONE in', Math.round(t1 - t0), 'ms');
        if (data.error) { console.error('[Dashboard] Aggregate error:', data.error); return; }
        api.terminalLog?.('[FROZEN-DBG] Dashboard data received, setting state');
        // The IPC returns raw rows; the page expects a normalized shape.
        // See src/pages/dashboard/aggregateNormalizer.ts — `productiveSeconds` and
        // `weeklyHeatmap` were never produced by any handler, so every read below
        // silently resolved to 0. Normalizing here fixes the whole contract at once.
        const normalized = buildDashboardData({ raw: data });
        setDashboardData(normalized as any);

        // Compute productivity score, streak, best day
        if (normalized.overview) {
          const total = normalized.overview.totalSeconds || 1;
          const prod = normalized.overview.productiveSeconds || 0;
          setProductivityScore(Math.round((prod / total) * 100));
        }
        if (normalized.weeklyHeatmap) {
          // Streak: consecutive days with productive time > 30min
          let s = 0;
          const today = new Date();
          for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayData = normalized.weeklyHeatmap.find((w: any) => w.date === dateStr);
            if (dayData && dayData.productiveHours > 0.5) s++;
            else break;
          }
          setStreak(s);

          // Best day of week
          const dayTotals: Record<string, number> = {};
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          normalized.weeklyHeatmap.forEach((w: any) => {
            const d = new Date(w.date);
            const dayName = dayNames[d.getDay()];
            dayTotals[dayName] = (dayTotals[dayName] || 0) + (w.productiveHours || 0);
          });
          const best = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];
          if (best) setBestDay(best[0]);
        }
        console.log('[FROZEN-DBG] Dashboard setDashboardData done');
      } catch (err) {
        if (!cancelled) console.error('[Dashboard] Failed to fetch aggregates:', err);
      }
    })();
    return () => { cancelled = true; };
    // `weekOffset` intentionally absent — see the note above. The heatmap's week
    // cursor must never drag the rest of the dashboard along with it.
  }, [fetchPeriod, dateOffset]);

  // Fetch longest focus data.
  //
  // This used to run ONCE on mount (`[]`), so the widget was frozen for as long
  // as the dashboard stayed open: a session that overtook the day's best after
  // mount could never appear, and a session that closed was never picked up.
  // It now re-polls.
  //
  // 60s rather than anything tighter because get-longest-focus scans the whole
  // `logs` table with no LIMIT (this box has ~30k rows) to compute the all-time
  // top 3. The part the user actually watches — the running session — is
  // computed locally from the timer below, so it ticks every second regardless
  // of this poll; the poll only refreshes what has been persisted.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const api = await awaitApi();
        const data = await api.getLongestFocus();
        if (!cancelled) {
          setLongestFocus(data);
          setLongestFocusLoading(false);
        }
      } catch (_e) {
        if (!cancelled) setLongestFocusLoading(false);
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Fetch today's gap data for unfilled time indicator
  useEffect(() => {
    (async () => {
      try {
        const gaps = await (window as any).deskflowAPI?.detectUsageGaps({ period: 'today', minGapMinutes: 5 });
        if (gaps && gaps.length > 0) {
          const totalMinutes = gaps.reduce((sum: number, g: any) => sum + Math.round(g.durationSeconds / 60), 0);
          setUnfilledMinutes(totalMinutes);
          setGapCount(gaps.length);
        } else {
          setUnfilledMinutes(0);
          setGapCount(0);
        }
      } catch (_e) {
        setUnfilledMinutes(0);
        setGapCount(0);
      }
    })();
  }, []);

  const [dashboardCurrency, setDashboardCurrency] = useState('USD');

  // Load Follow Through data for dashboard card
  useEffect(() => {
    (async () => {
      try {
        const currencyResult = await (window as any).deskflowAPI?.financeGetDisplayCurrency?.();
        if (currencyResult?.currency) setDashboardCurrency(currencyResult.currency);
      } catch {}
    })();
    (async () => {
      try {
        const result = await (window as any).deskflowAPI?.financeGetOnBehalfOfSummary();
        if (result) setFtData(result);
      } catch {}
    })();
    (async () => {
      try {
        const persons = await (window as any).deskflowAPI?.financeGetFtPersons?.();
        if (Array.isArray(persons)) setFtPersons(persons);
      } catch {}
    })();
    (async () => {
      try {
        const lastTx = await (window as any).deskflowAPI?.financeLastTransactionDate?.();
        if (lastTx) setLastTxDate(lastTx);
      } catch {}
    })();
  }, []);

  // Reset pausedByTrackerApp when mode changes from 'pause' to something else
  useEffect(() => {
    if (trackerAppMode !== 'pause' && pausedByTrackerApp) {
      setPausedByTrackerApp(false);
    }
  }, [trackerAppMode, pausedByTrackerApp]);

  // Initialize activity feed from backend recent sessions (if localStorage is empty)
  useEffect(() => {
    if (activityFeed.length === 0 && dashboardData?.recentSessions?.length > 0) {
      const feedItems: ActivityFeedItem[] = dashboardData.recentSessions.slice(0, 15).map((s: any, idx: number) => {
        const timestamp = new Date(s.timestamp);
        return {
          id: `init-${idx}-${Date.now()}`,
          timestamp,
          startTime: timestamp.getTime(),
          type: (s.isBrowser || s.is_browser_tracking) ? 'browser' as const : 'app' as const,
          name: s.app || s.title || s.domain || 'Unknown',
          category: s.category || 'Unknown',
          tier: getTierFromCategory(s.category),
          isActive: false,
          duration: s.durationSeconds || Math.round((s.duration_ms || 0) / 1000),
        };
      });
      if (feedItems.length > 0) {
        activityFeedRef.current = feedItems;
        updateFeed(feedItems);
      }
    }
  }, [dashboardData?.recentSessions, activityFeed.length]);

  // Persist activity feed to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('deskflow-activity-feed', JSON.stringify(activityFeed));
  }, [activityFeed]);

  // Persist timer state to parent and localStorage
  useEffect(() => {
    // The persisted `startTime` must be the current SEGMENT's start, not the
    // last tick (which moves every second) and not "now". Derive it from the
    // authoritative stopwatch total: the current segment started this long ago.
    const stopwatchStartedAt = (isPaused || !lastTier || !currentProductiveMs)
      ? (stopwatchAccumulatedStartRef.current || Date.now())
      : (Date.now() - currentProductiveMs);
    stopwatchAccumulatedStartRef.current = stopwatchStartedAt;

    const newState = {
      productiveMs: currentProductiveMs,
      distractingMs: currentDistractingMs,
      startTime: stopwatchStartedAt,
      paused: isPaused,
      lastTier: lastTier,
      externalRunning: externalSessionRunning,
      externalStart: externalSessionStart?.getTime() || null,
      externalElapsed: externalElapsedMs,
      selectedExternalActivity: selectedExternalActivity ? { id: selectedExternalActivity.id, name: selectedExternalActivity.name } : null
    };
    // Update parent state
    if (onTimerStateChange) {
      onTimerStateChange(newState);
    }
    // Also persist to localStorage as backup
    if (typeof window === 'undefined') return;
    localStorage.setItem('deskflow-timer-state', JSON.stringify(newState));
  }, [currentProductiveMs, currentDistractingMs, isPaused, lastTier, externalSessionRunning, externalSessionStart, externalElapsedMs, selectedExternalActivity, onTimerStateChange]);

  // Sync timer state from parent prop (e.g., when ExternalPage starts/stops a stopwatch)
  const prevTimerStateRef = useRef(timerState);
  useEffect(() => {
    if (!timerState) return;
    if (timerState === prevTimerStateRef.current) return;
    prevTimerStateRef.current = timerState;

    const extRunning = !!(timerState as any).externalRunning;
    const extActivity = (timerState as any).selectedExternalActivity;
    const extStart = (timerState as any).externalStart;

    if (extRunning !== externalSessionRunning) {
      setExternalSessionRunning(extRunning);
      if (extRunning && extActivity) {
        setSelectedExternalActivity({ id: extActivity.id, name: extActivity.name, category: 'External' });
        if (extStart) {
          setExternalSessionStart(new Date(extStart));
          setExternalElapsedMs(Date.now() - new Date(extStart).getTime());
        }
      } else if (!extRunning) {
        setSelectedExternalActivity(null);
        setExternalSessionStart(null);
        setExternalElapsedMs(0);
      }
    }
  }, [timerState, externalSessionRunning]);

  // The RESET overlay is driven by the store's real reset counter, not by tier
  // changes. It used to be bumped on every productive<->distracting flip, which
  // announced a reset that (correctly) no longer happens — and which made the
  // stopwatch look like it was being wiped at random.
  const resetTrigger = stopwatchSnap.resetCount;
  // (currentApp/isInBrowser/currentWebsite hoisted above widgetData)
  const [lastNonBrowserApp, setLastNonBrowserApp] = useState<ForegroundData | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('combined');
  const [externalHourlyData, setExternalHourlyData] = useState<Map<string, { externalSeconds: number; breakdown: Record<string, { seconds: number; color: string; icon: string }> }>>(new Map());
  const [externalSessions, setExternalSessions] = useState<any[]>([]);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const handleScheduleDayChange = useCallback((day: number) => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + day); setCalendarDate(d);
  }, []);
  const [expandedModal, setExpandedModalRaw] = useState<'heatmap' | 'solar' | null>(null);
  const setExpandedModal = useCallback((val: 'heatmap' | 'solar' | null) => {
    setExpandedModalRaw(val);
    window.dispatchEvent(new CustomEvent('solar-overlay-change', { detail: { active: val === 'solar' } }));
  }, []);
  const deepFocus = useDeepFocus();
  //const homeSummary = useHomeSummary();
  const [solarFullscreen, setSolarFullscreen] = useState(false);
  const setSolarFullscreenWithEvent = useCallback((val: boolean) => {
    setSolarFullscreen(val);
    window.dispatchEvent(new CustomEvent('solar-fullscreen-change', { detail: { fullscreen: val } }));
  }, []);
  const hasRealApp = !!currentApp?.app || (isInBrowser && !!currentWebsite?.domain);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [dayDetailItems, setDayDetailItems] = useState<TimelineItem[]>([]);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);
  const computeChartDateRange = (period: string, offset: number): { start: Date; end: Date; label: string } =>
    getDateRange(period, offset);

  // ── Aggregate external sessions for chart overlay ──
  const chartExternalData = useMemo(() => {
    const data = new Map<string, number>();
    if (!externalSessions || externalSessions.length === 0) return data;

    const range = computeChartDateRange(selectedPeriod, dateOffset);

    for (const session of externalSessions) {
      const sStart = new Date(session.started_at).getTime();
      const sEnd = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
      if (sStart >= range.end || sEnd < range.start) continue;

      let cur = Math.max(sStart, range.start.getTime());
      const ceiling = Math.min(sEnd, range.end.getTime());
      let iterations = 0;
      while (cur < ceiling && iterations < 10000) {
        iterations++;
        const hourFloor = Math.floor(cur / 3600000) * 3600000;
        const hourEndMs = hourFloor + 3600000;
        const segEnd = Math.min(ceiling, hourEndMs);
        const segSec = (segEnd - cur) / 1000;
        if (segSec > 0) {
          const d = new Date(cur);
          const hourKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getHours()}`;
          const existing = data.get(hourKey) || 0;
          data.set(hourKey, Math.min(existing + segSec, 3600));
        }
        cur = segEnd;
      }
    }

    const finalData = new Map<string, number>();
    for (const [hourKey, sec] of data) {
      const parts = hourKey.split('-');
      const dateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
      const hour = parseInt(parts[3]);
      let key: string;
      if (selectedPeriod === 'today') key = `${hour}`;
      else if (selectedPeriod === 'week' || selectedPeriod === 'month' || selectedPeriod === '7day' || selectedPeriod === '30day') key = dateStr;
      else key = `${parts[0]}-${parts[1]}`;
      finalData.set(key, (finalData.get(key) || 0) + sec);
    }

    return finalData;
  }, [externalSessions, selectedPeriod, dateOffset]);

  // Helper: aggregate hourlyHeatmap for a date → { prod, nonProd }
  const aggregateHourlyForDate = (dateStr: string) => {
    const dayHours = dashboardData?.hourlyHeatmap?.[dateStr] || {};
    let totalProd = 0, totalNonProd = 0;
    // Keys are HOUR STRINGS ('0'..'23'), so the loop must read the string key.
    // The old `dayHours[h]` numeric index never matched anything and returned 0.
    for (let h = 0; h < 24; h++) {
      const secs = (dayHours as any)[String(h)];
      if (!secs) continue;
      totalProd += secs;
      totalNonProd += 0; // hour rows carry no tier split; treat the fallback as neutral
    }
    return { prod: totalProd, nonProd: totalNonProd };
  };

  // Map backend data → chartBars for the weekly productivity chart
  const chartBars = useMemo(() => {
    const bars: { label: string; productiveSeconds: number; nonProductiveSeconds: number; externalSeconds: number; isToday?: boolean }[] = [];
    const now = new Date();
    const range = computeChartDateRange(selectedPeriod, dateOffset);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getBarData = (dateStr: string) => {
      const bar = dashboardData?.weeklyHeatmap?.find((d: any) => d.date === dateStr);
      if (bar) {
        // Guard every term: a missing field used to produce `undefined + undefined`
        // = NaN, and Chart.js silently drops NaN points — so the bars simply did not
        // render, with no error anywhere. Coerce to a finite number instead.
        const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
        return {
          productiveSeconds: num(bar.productiveHours) * 3600,
          nonProductiveSeconds: (num(bar.neutralHours) + num(bar.distractingHours)) * 3600,
        };
      }
      // Fallback: aggregate from hourlyHeatmap
      const hourly = aggregateHourlyForDate(dateStr);
      return { productiveSeconds: hourly.prod, nonProductiveSeconds: hourly.nonProd };
    };

    switch (selectedPeriod) {
      case 'today': {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayHours = dashboardData?.hourlyHeatmap?.[todayStr] || {};
        for (let h = 0; h < 24; h++) {
          // Keyed by HOUR STRING now that hourlyHeatmap is a per-date map.
          const secs = (todayHours as any)[String(h)];
          const totalSec = typeof secs === 'number' && Number.isFinite(secs) ? secs : 0;
          // Hour rows carry no tier split, so everything tracked counts as
          // non-productive here. Guessing otherwise would overstate focus.
          const nonProdSec = totalSec;
          const extSec = chartExternalData.get(`${h}`) || 0;
          const totalWithExt = nonProdSec + extSec;
          let finalNonProd = nonProdSec, finalExt = extSec;
          if (totalWithExt > 3600) {
            const scale = 3600 / totalWithExt;
            finalNonProd = Math.round(nonProdSec * scale);
            finalExt = Math.round(extSec * scale);
          }
          bars.push({
            label: h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`,
            productiveSeconds: 0,
            nonProductiveSeconds: finalNonProd,
            externalSeconds: finalExt,
            isToday: now.getHours() === h,
          });
        }
        break;
      }
      case 'week': {
        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(range.start);
          dayDate.setDate(dayDate.getDate() + i);
          const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
          const data = getBarData(dateStr);
          const extSec = chartExternalData.get(dateStr) || 0;
          bars.push({
            label: dayNames[dayDate.getDay()],
            productiveSeconds: data.productiveSeconds,
            nonProductiveSeconds: data.nonProductiveSeconds,
            externalSeconds: extSec,
            isToday: dayDate.getFullYear() === now.getFullYear() && dayDate.getMonth() === now.getMonth() && dayDate.getDate() === now.getDate(),
          });
        }
        break;
      }
      case 'month': {
        const current = new Date(range.start);
        while (current < range.end) {
          const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
          const data = getBarData(dateStr);
          const extSec = chartExternalData.get(dateStr) || 0;
          bars.push({
            label: `${current.getDate()}`,
            productiveSeconds: data.productiveSeconds,
            nonProductiveSeconds: data.nonProductiveSeconds,
            externalSeconds: extSec,
            isToday: current.getFullYear() === now.getFullYear() && current.getMonth() === now.getMonth() && current.getDate() === now.getDate(),
          });
          current.setDate(current.getDate() + 1);
        }
        break;
      }
      case '7day': {
        const current7 = new Date(range.start);
        for (let i = 0; i < 7; i++) {
          const dateStr = `${current7.getFullYear()}-${String(current7.getMonth() + 1).padStart(2, '0')}-${String(current7.getDate()).padStart(2, '0')}`;
          const data = getBarData(dateStr);
          const extSec = chartExternalData.get(dateStr) || 0;
          bars.push({
            label: dayNames[current7.getDay()],
            productiveSeconds: data.productiveSeconds,
            nonProductiveSeconds: data.nonProductiveSeconds,
            externalSeconds: extSec,
            isToday: current7.getFullYear() === now.getFullYear() && current7.getMonth() === now.getMonth() && current7.getDate() === now.getDate(),
          });
          current7.setDate(current7.getDate() + 1);
        }
        break;
      }
      case '30day': {
        const current30 = new Date(range.start);
        for (let i = 0; i < 30; i++) {
          const dateStr = `${current30.getFullYear()}-${String(current30.getMonth() + 1).padStart(2, '0')}-${String(current30.getDate()).padStart(2, '0')}`;
          const data = getBarData(dateStr);
          const extSec = chartExternalData.get(dateStr) || 0;
          bars.push({
            label: `${current30.getDate()}`,
            productiveSeconds: data.productiveSeconds,
            nonProductiveSeconds: data.nonProductiveSeconds,
            externalSeconds: extSec,
            isToday: current30.getFullYear() === now.getFullYear() && current30.getMonth() === now.getMonth() && current30.getDate() === now.getDate(),
          });
          current30.setDate(current30.getDate() + 1);
        }
        break;
      }
      case 'all': {
        const current = new Date(range.start);
        let lastKey = '';
        while (current < range.end) {
          const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
          const data = getBarData(dateStr);
          const key = dateStr;
          if (key !== lastKey) {
            const extSec = chartExternalData.get(key) || 0;
            bars.push({
              label: current.toLocaleDateString([], { month: 'short', year: '2-digit' }),
              productiveSeconds: data.productiveSeconds,
              nonProductiveSeconds: data.nonProductiveSeconds,
              externalSeconds: extSec,
              isToday: current.getFullYear() === now.getFullYear() && current.getMonth() === now.getMonth(),
            });
            lastKey = key;
          }
          current.setMonth(current.getMonth() + 1);
        }
        break;
      }
    }
    return bars;
  }, [dashboardData?.weeklyHeatmap, dashboardData?.hourlyHeatmap, chartExternalData, selectedPeriod, dateOffset]);

  // Recompute chartBarsResult for backward compat with existing render
  const chartBarsResult = useMemo(() => {
    const max = Math.max(1, ...chartBars.map(b => b.productiveSeconds + b.nonProductiveSeconds + b.externalSeconds));
    return { chartBars, maxBarSeconds: max };
  }, [chartBars]);

  const DEFAULT_ACTIVITIES: ExternalActivity[] = [
    { id: 1, name: 'Study', type: 'stopwatch', color: 'var(--success)', icon: 'BookOpen', is_productive: true },
    { id: 2, name: 'Exercise', type: 'stopwatch', color: 'var(--success)', icon: 'Dumbbell', is_productive: true },
    { id: 3, name: 'Gym', type: 'stopwatch', color: 'var(--success)', icon: 'Activity', is_productive: true },
    { id: 4, name: 'Reading', type: 'stopwatch', color: 'var(--success)', icon: 'Book', is_productive: true },
    { id: 5, name: 'Eating', type: 'checkin', color: 'var(--page-accent)', icon: 'Utensils', is_productive: false },
  ];

  const activities = useMemo(() => externalActivities.length > 0 ? externalActivities : DEFAULT_ACTIVITIES, [externalActivities]);

  // Initialize pinned activities from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dashboard-pinned-activities');
        if (saved) {
          const parsed: ExternalActivity[] = JSON.parse(saved);
          if (parsed.some(a => a.name === 'Family Time')) {
            localStorage.removeItem('dashboard-pinned-activities');
            setPinnedActivities(DEFAULT_ACTIVITIES.slice(0, 5));
          } else {
            setPinnedActivities(parsed);
          }
        } else {
          setPinnedActivities(DEFAULT_ACTIVITIES.slice(0, 5));
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Save pinned activities to localStorage when changed
  useEffect(() => {
    if (pinnedActivities.length > 0) {
      localStorage.setItem('dashboard-pinned-activities', JSON.stringify(pinnedActivities));
    }
  }, [pinnedActivities]);

  // Determine tier from category
  /**
   * Resolve an app's tier.
   *
   * A per-app override (categoryConfig.appTierMap, written by the set-app-tier
   * handler) always wins over the category-derived tier. Without this, "make this
   * one app neutral" was impossible: an app's tier came only from its CATEGORY,
   * so moving it also moved every other app in that category.
   */
  /**
   * Re-tier the app/site the stopwatch is currently timing, then confirm with a
   * toast whose lifetime comes from Settings → General → Notification Duration.
   * Persisted via set-app-tier into categoryConfig.appTierMap, which wins over
   * the category-derived tier on the next foreground event.
   */
  const [tierToast, setTierToast] = useState<{ id: string; text: string } | null>(null);
  const changeTrackedTier = useCallback(async (
    name: string,
    tier: 'productive' | 'neutral' | 'distracting',
  ) => {
    const api = window.deskflowAPI as any;
    const isSite = !!currentWebsite?.domain && name === (currentWebsite?.title || currentWebsite?.domain);
    const key = isSite ? (currentWebsite?.domain ?? name) : name;
    const ok = isSite
      ? await api?.setDomainTier?.(key, tier)
      : await api?.setAppTier?.(key, tier);
    if (!ok) return;

    // Reflect it locally right away — waiting for the next foreground event
    // would leave the stopwatch showing the old colour for up to a minute.
    if (isSite) setDomainTierMap(p => ({ ...p, [key]: tier }));
    else setAppTierMap(p => ({ ...p, [key]: tier }));

    const id = crypto.randomUUID();
    const text = `${key} is now ${tier}`;
    setTierToast({ id, text });
    const ms = getToastDurationMs();
    if (!isSticky(ms)) window.setTimeout(() => setTierToast(t => (t?.id === id ? null : t)), ms);
  }, [currentWebsite]);

  const getTierFromCategory = (category?: string, appOrDomain?: string): 'productive' | 'neutral' | 'distracting' => {
    // The CATEGORY decides. The per-app/domain map is only a fallback for an app
    // with NO category. It used to be checked FIRST, so a single per-app entry
    // could re-tier a whole category — which is why a category appeared to shift
    // tier depending on which app was focused.
    const tiers = tierAssignments || DEFAULT_TIER_ASSIGNMENTS;
    if (category) {
      if (tiers.productive.includes(category)) return 'productive';
      if (tiers.distracting.includes(category)) return 'distracting';
      return 'neutral';
    }
    if (appOrDomain) {
      const o = appTierMap?.[appOrDomain] ?? domainTierMap?.[appOrDomain];
      if (o === 'productive' || o === 'neutral' || o === 'distracting') return o;
    }
    return 'neutral';
  };

  // Refs for values the foreground listener needs without stale closures
  const trackingBrowserRef = useRef(trackingBrowser);
  const trackingBrowsersRef = useRef(trackingBrowsers);
  // These checks used to be gated on `!!tb` — the SINGULAR trackingBrowser. When
  // that was empty the whole expression was false even with a populated detected
  // list, so the website never replaced the app name. Whichever list we actually
  // have is what should decide.
  const browserListFor = (tb?: string): string[] =>
    (trackingBrowsersRef.current && trackingBrowsersRef.current.length > 0)
      ? trackingBrowsersRef.current
      : (tb ? [tb] : []);
  trackingBrowserRef.current = trackingBrowser;
  trackingBrowsersRef.current = trackingBrowsers;
  const trackerAppModeRef = useRef(trackerAppMode);
  trackerAppModeRef.current = trackerAppMode;
  const lastNonBrowserAppRef = useRef(lastNonBrowserApp);
  lastNonBrowserAppRef.current = lastNonBrowserApp;
  const tierAssignmentsRef = useRef(tierAssignments);
  tierAssignmentsRef.current = tierAssignments;
  const timerBehaviorRef = useRef(timerBehavior);
  timerBehaviorRef.current = timerBehavior;

  // Listen for foreground window changes — register ONCE, read from refs
  useEffect(() => {
    if (!window.deskflowAPI?.onForegroundChange) {
      console.log('[Focus] No onForegroundChange API');
      return;
    }

    console.log('[Focus] Registering foreground listener');

    const unsubscribe = window.deskflowAPI.onForegroundChange((data: ForegroundData) => {
      const tb = trackingBrowserRef.current;
      const tam = trackerAppModeRef.current;
      const lnb = lastNonBrowserAppRef.current;
      const ta = tierAssignmentsRef.current;
      const tbv = timerBehaviorRef.current;
      console.log('[Focus] Foreground change:', data.app, '| category:', data.category);

      // Check if this is the tracking browser
      const isTrackingBrowser = !!data.app && browserListFor(tb).length > 0
        && isAppMatchingBrowserDashboard(data.app, browserListFor(tb));

      // Check if this is Tracker app (DeskFlow/Electron/RHEO)
      const isTrackerApp = data.app && (
        data.app.toLowerCase() === 'deskflow' ||
        data.app.toLowerCase() === 'electron' ||
        data.app.toLowerCase() === 'rheo'
      );

      if (isTrackingBrowser) {
        console.log('[Focus] Browser detected — isInBrowser=true, preserving lastNonBrowserApp as currentApp');
        setIsInBrowser(true);
        // Keep lastNonBrowserApp as currentApp fallback so timer doesn't freeze on "No App"
        setCurrentApp(lnb || null);
        return;
      }

      // No real app detected — keep last known app as fallback to avoid "No App" freeze
      if (!data.app || data.isReal === false) {
        console.log('[Focus] No real app — keeping last known app, isInBrowser=false');
        setIsInBrowser(false);
        clearWebsiteUnlessLive();
        setCurrentApp(lnb || null);
        return;
      }

      // Tracker app (DeskFlow/Electron) in show-other/pause mode:
      // keep the currently displayed website/app visible — never jump to the
      // last non-browser app (that caused the Browsing → VS Code flip and the
      // "Waiting for app" freeze). Only pause updates the paused flag.
      if (isTrackerApp && tam !== 'track') {
        console.log('[Focus] Tracker app foreground, mode', tam, '— keeping current website/app visible');
        if (tam === 'pause') {
          setIsPaused(true);
          setPausedByTrackerApp(true);
        }
        return;
      }

      console.log('[Focus] Not tracking browser — tracking app:', data.app);
      setIsInBrowser(false);
      clearWebsiteUnlessLive();

      console.log('[Focus] Setting currentApp:', data.app, '| category:', data.category);
      setLastNonBrowserApp(data);
      setCurrentApp(data);
      setIsPaused(false);
      setPausedByTrackerApp(false);

      // Track in activity feed
      const lastItem = activityFeedRef.current[activityFeedRef.current.length - 1];
      const newAppName = data.app || data.title || 'Unknown';

      if (lastItem && lastItem.type === 'app' && lastItem.name === newAppName) {
        return;
      }

      const getTier = (cat?: string): 'productive' | 'neutral' | 'distracting' => {
        if (!cat) return 'neutral';
        const tiers = ta || DEFAULT_TIER_ASSIGNMENTS;
        if (tiers.productive.includes(cat)) return 'productive';
        if (tiers.distracting.includes(cat)) return 'distracting';
        return 'neutral';
      };
      const tier = getTier(data.category);
      setLastTier(tier);
      if (tier === 'distracting') {
        setDistractions(prev => [...prev.slice(-49), { name: newAppName, type: 'app', timestamp: now }]);
      }
      const now = Date.now();

      const newItem: ActivityFeedItem = {
        id: `${now}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(now),
        startTime: now,
        type: 'app',
        name: newAppName,
        category: data.category || 'Unknown',
        tier,
        isActive: true
      };
      activityFeedRef.current = activityFeedRef.current.map((item) => {
        if (item.isActive) {
          const durationMs = now - item.startTime;
          return { ...item, isActive: false, duration: Math.floor(durationMs / 1000) };
        }
        return item;
      });
      activityFeedRef.current = [...activityFeedRef.current.slice(-9), newItem];
      updateFeed([...activityFeedRef.current]);
    });

    // Fetch current foreground app on mount (foreground-changed only fires on change)
    if (window.deskflowAPI?.getCurrentForeground) {
      window.deskflowAPI.getCurrentForeground().then((initialData: any) => {
    if (!initialData || !initialData.isReal) return;
        const tb = trackingBrowserRef.current;
        const tam = trackerAppModeRef.current;
        const lnb = lastNonBrowserAppRef.current;

        const isTrackingBrowser = !!initialData.app && browserListFor(tb).length > 0
          && isAppMatchingBrowserDashboard(initialData.app, browserListFor(tb));
        const isTrackerApp = !!(initialData.app) && (initialData.app.toLowerCase() === 'deskflow' || initialData.app.toLowerCase() === 'electron' || initialData.app.toLowerCase() === 'rheo');

        if (isTrackingBrowser) { setIsInBrowser(true); setCurrentApp(lnb || null); return; }

        if (isTrackerApp) {
          if (tam === 'show-other') { return; }
          else if (tam === 'pause') { setIsPaused(true); setPausedByTrackerApp(true); return; }
        }
        setIsInBrowser(false);
        clearWebsiteUnlessLive();

        console.log('[Focus] Initial foreground:', initialData.app, '| category:', initialData.category);
        setLastNonBrowserApp(initialData);
        setCurrentApp(initialData);
        const initialTa = tierAssignmentsRef.current;
        const initialGetTier = (cat?: string): 'productive' | 'neutral' | 'distracting' => {
          if (!cat) return 'neutral';
          const tiers = initialTa || DEFAULT_TIER_ASSIGNMENTS;
          if (tiers.productive.includes(cat)) return 'productive';
          if (tiers.distracting.includes(cat)) return 'distracting';
          return 'neutral';
        };
        setLastTier(initialGetTier(initialData.category));

        // Create an active feed item for the current foreground app
        const initialTier = initialGetTier(initialData.category);
        const initNow = Date.now();
        const initItem: ActivityFeedItem = {
          id: `${initNow}-init`,
          timestamp: new Date(initNow),
          startTime: initNow,
          type: 'app',
          name: initialData.app || initialData.title || 'Unknown',
          category: initialData.category || 'Unknown',
          tier: initialTier,
          isActive: true
        };
        // Mark any previously active items as inactive
        activityFeedRef.current = activityFeedRef.current.map(item =>
          item.isActive ? { ...item, isActive: false, duration: Math.floor((initNow - item.startTime) / 1000) } : item
        );
        // Only add if the last item isn't already this app
        const lastInit = activityFeedRef.current[activityFeedRef.current.length - 1];
        if (!lastInit || lastInit.name !== initItem.name) {
          activityFeedRef.current = [...activityFeedRef.current.slice(-9), initItem];
        } else {
          // Same app — just make sure it's marked active
          activityFeedRef.current = activityFeedRef.current.map(item =>
            item.name === initItem.name ? { ...item, isActive: true, startTime: initNow } : item
          );
        }
        updateFeed([...activityFeedRef.current]);
      }).catch(() => { });
    }

    return () => {
      console.log('[Focus] Unsubscribing foreground listener');
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Safety-net foreground refresh (every 5min) — recovers from missed foreground-changed events
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (!window.deskflowAPI?.getCurrentForeground) return;
       window.deskflowAPI.getCurrentForeground().then((data: any) => {
         if (!data || !data.isReal) return;
        const tb = trackingBrowserRef.current;
        const isTrackingBrowser = browserListFor(tb).length > 0
          && isAppMatchingBrowserDashboard(data.app, browserListFor(tb));
        const isTrackerApp = data.app.toLowerCase() === 'deskflow' || data.app.toLowerCase() === 'electron' || data.app.toLowerCase() === 'rheo';

        if (isTrackerApp) return; // don't overwrite with tracker app
        if (isTrackingBrowser) {
          setIsInBrowser(true);
          return;
        }
        // A real non-browser app is foreground — make sure we're NOT stuck in website mode.
        // (Previously this only refreshed currentApp; a stale isInBrowser/currentWebsite would
        // keep the dashboard showing the last website instead of the real app.)
        setIsInBrowser(false);
        clearWebsiteUnlessLive();
        // If we have a real non-browser app and currentApp is null or stale, refresh it
        setCurrentApp(prev => {
          if (!prev?.app || prev.app !== data.app) {
            console.log('[Focus] Periodic refresh: updating currentApp to', data.app);
            setLastNonBrowserApp(data);
            return data;
          }
          return prev;
        });
      }).catch(() => { });
    }, 300000); // 5 minutes (safety net, primary path is event-driven)
    return () => clearInterval(refreshInterval);
  }, []);

  const isInBrowserRef = useRef(isInBrowser);
  isInBrowserRef.current = isInBrowser;

  // Listen for browser tracking events (website changes) — register ONCE, read from refs
  useEffect(() => {
    if (!window.deskflowAPI?.onBrowserTrackingEvent) {
      console.log('[Dashboard] No onBrowserTrackingEvent API');
      return;
    }

    console.log('[Dashboard] Listening for browser events');

    window.deskflowAPI.onBrowserTrackingEvent((data: any) => {
      const iib = isInBrowserRef.current;
      const tb = trackingBrowserRef.current;
      const ta = tierAssignmentsRef.current;
      const tbv = timerBehaviorRef.current;
      const getTier = (cat?: string): 'productive' | 'neutral' | 'distracting' => {
        if (!cat) return 'neutral';
        const tiers = ta || DEFAULT_TIER_ASSIGNMENTS;
        if (tiers.productive.includes(cat)) return 'productive';
        if (tiers.distracting.includes(cat)) return 'distracting';
        return 'neutral';
      };
      console.log('[Dashboard] Browser event:', data.type, 'domain:', data.domain, 'isInBrowser:', iib);

      // Main process rejected website data (browser no longer foreground / non-browser app
      // detected). Exit website mode immediately so the dashboard tracks the real app again
      // instead of staying "stuck" on the last website.
      if (data.type === 'clear') {
        console.log('[Dashboard] Clearing website — browser no longer foreground');
        setIsInBrowser(false);
        liveSiteAtRef.current = 0;
        setCurrentWebsite(null);
        activityFeedRef.current = activityFeedRef.current.filter((item) => item.type !== 'browser' || !item.isActive);
        updateFeed([...activityFeedRef.current]);
        return;
      }

      if (data.type === 'browser-data' || data.type === 'live-log') {
        // Only track if we're in the tracking browser
        if (!iib || !tb) {
          console.log('[Dashboard] Skipping - not in browser');
          return;
        }

        // Extra guard: skip if extension reports browser not focused
        // (handles race condition between 2s foreground poll and extension data)
        if (data.is_browser_focused === false) {
          console.log('[Dashboard] Skipping - browser not focused per extension');
          return;
        }

        console.log('[Dashboard] Processing website:', data.domain, 'category:', data.category);

        const websiteTier = getTier(data.category || 'Uncategorized');
        setLastTier(websiteTier);
        if (websiteTier === 'distracting') {
          setDistractions(prev => [...prev.slice(-49), { name: data.domain || data.title || 'Unknown', type: 'website', timestamp: Date.now() }]);
        }

        setCurrentWebsite({
          title: data.title,
          domain: data.domain,
          url: data.url,
          category: data.category,
          browserName: data.browser_name || undefined,
          profileName: data.profileName || data.profile_name || undefined,
          profileId: data.browser_profile_id || undefined,
        });
        // Clear any tracker-app pause since user is actively using the browser
        setIsPaused(false);
        setPausedByTrackerApp(false);

        const lastItem = activityFeedRef.current[activityFeedRef.current.length - 1];
        const newDomain = data.domain || data.title || 'Unknown';

        if (lastItem && lastItem.type === 'browser' && lastItem.name === newDomain) {
          return;
        }

        const now = Date.now();
        const newItem: ActivityFeedItem = {
          id: `${now}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(now),
          startTime: now,
          type: 'browser',
          name: newDomain,
          category: data.category || 'Uncategorized',
          tier: websiteTier,
          isActive: true
        };
        activityFeedRef.current = activityFeedRef.current.map((item) => {
          if (item.isActive) {
            const durationMs = now - item.startTime;
            return { ...item, isActive: false, duration: Math.floor(durationMs / 1000) };
          }
          return item;
        });
        activityFeedRef.current = [...activityFeedRef.current.slice(-9), newItem];
        updateFeed([...activityFeedRef.current]);
      }
    });
  }, []); // empty deps — register once, refs handle latest values

  // Stopwatch — dual timer: productive and distracting accumulate independently.
  // Switching between productive ↔ distracting resets the outgoing timer to 0.
  // Neutral tiers just pause (no reset).
  useEffect(() => {
    // Determine current tier
    const currentCategory = isInBrowser
      ? (currentWebsite?.category || lastNonBrowserApp?.category)
      : currentApp?.category;
    const tier = getTierFromCategory(currentCategory || '', currentApp?.app || currentApp?.title || undefined);

    // Tier transition: log it, but do NOT reset anything. This used to zero both
    // totals (and fire the RESET overlay) on every productive↔distracting flip,
    // so alt-tabbing between two windows threw the reading away — and because
    // the "is it running" flag below was page-local, simply REMOUNTING this page
    // re-ran the same code path and wiped the day a second time. A tier change
    // is a change of attribution; the store banks the outgoing segment under the
    // old tier and keeps both totals.
    const prevTier = prevTierRef.current;
    // NEUTRAL honours timerBehavior.neutralAction. Only productive <-> distracting
    // was handled in this effect, so 'pause' in Settings did nothing for neutral:
    // the timer kept running and the time banked as focus.
    if (tier === 'neutral' && prevTier && prevTier !== 'neutral') {
      const action = timerBehavior.neutralAction;
      if (action === 'pause') {
        console.log('[Dashboard] Stopwatch: NEUTRAL -> PAUSE (timerBehavior)');
        setIsPaused(true);
      } else if (action === 'reset') {
        console.log('[Dashboard] Stopwatch: NEUTRAL -> RESET (timerBehavior)');
        // Reset the STORE, not just an overlay counter. This used to bump
        // `setResetTrigger`, which only played the "timer reset" animation —
        // the totals carried on, so the overlay was announcing something that
        // never happened. `stopwatch.reset()` zeroes the accumulators and bumps
        // the same counter the overlay reads.
        stopwatch.reset();
      }
    }
    if (prevTier && prevTier !== tier) {
      console.log(`[Dashboard] Stopwatch: tier ${prevTier} → ${tier} (totals kept)`);
    }
    prevTierRef.current = tier;

    const isExternal = externalSessionRunning && !!externalSessionStart;

    // Hand the tier to the store and let IT own the clock. This page used to
    // keep a 1s interval and an `activeRef` to decide whether to call
    // run()/halt(); both were torn down by `<Routes key={pathname}>` on every
    // navigation, which is why the timer froze off-dashboard and restarted on
    // return. The interval now lives in lib/stopwatchStore.ts and runs for the
    // whole app lifetime.
    stopwatch.setTier(tier === 'distracting' ? 'distracting' : 'productive');

    // Publish the external session so the sidebar rail shows the same clock
    // during one. The DB session stays owned by this page; only the readout is
    // shared.
    if (isExternal && externalSessionStart) {
      stopwatch.setExternalSession({
        running: true,
        startedAtMs: externalSessionStart.getTime(),
        label: selectedExternalActivity?.name || 'Running',
      });
    } else {
      stopwatch.setExternalSession({ running: false });
    }
  }, [currentApp, currentWebsite, isInBrowser, lastNonBrowserApp, externalSessionRunning, externalSessionStart, selectedExternalActivity, timerBehavior]);

  // Track and save productivity sessions — respects timerBehavior settings
  useEffect(() => {
    const currentCategory = isInBrowser
      ? (currentWebsite?.category || lastNonBrowserApp?.category)
      : currentApp?.category;
    const tier = getTierFromCategory(currentCategory || '', currentApp?.app || currentApp?.title || undefined);
    const appName = currentApp?.app || currentWebsite?.title || currentWebsite?.domain || lastNonBrowserApp?.app || 'Unknown';

    // Don't start a session on mount when no real app is active
    const hasRealApp = !!currentApp?.app || (isInBrowser && !!currentWebsite?.domain);
    console.log('[Focus] Session check — app:', appName, '| category:', currentCategory, '| tier:', tier, '| hasRealApp:', hasRealApp, '| ref set:', !!productivitySessionStartRef.current);

    const shouldCountSession = (() => {
      if (isPaused) return false;
      if (!hasRealApp && !productivitySessionStartRef.current) return false; // Don't start bogus session on mount
      if (tier === 'productive') return true;
      if (tier === 'neutral') {
        return timerBehavior.neutralAction === 'ignore';
      }
      if (tier === 'distracting') {
        return timerBehavior.distractingAction === 'ignore';
      }
      return false;
    })();

    if (shouldCountSession) {
      if (!productivitySessionStartRef.current) {
        productivitySessionStartRef.current = Date.now();
        productivitySessionAppRef.current = appName;
        console.log('[Focus] Session STARTED:', appName, '| tier:', tier);
      }
    } else {
      if (productivitySessionStartRef.current && productivitySessionAppRef.current) {
        const effectiveEnd = Math.min(Date.now(), lastInteractionRef.current + 300000);
        const durationMs = Math.max(0, effectiveEnd - productivitySessionStartRef.current);
        const durationSec = Math.floor(durationMs / 1000);

        console.log('[Focus] Session ENDING — app:', productivitySessionAppRef.current, '| duration:', durationSec + 's', '| min threshold: 60s');

        if (durationSec >= 60) {
          const session = {
            started_at: new Date(productivitySessionStartRef.current).toISOString(),
            ended_at: new Date().toISOString(),
            duration_seconds: durationSec,
            app_name: productivitySessionAppRef.current,
            category: currentCategory || 'Unknown'
          };

          if (window.deskflowAPI?.saveProductivitySession) {
            window.deskflowAPI.saveProductivitySession(session).then((result: any) => {
              console.log('[Focus] Session SAVED:', productivitySessionAppRef.current, durationSec + 's', '| result:', result);
              window.dispatchEvent(new CustomEvent('focus-session-saved'));
            }).catch(err => {
              console.error('[Focus] Session save FAILED:', err);
            });
          }
        } else {
          console.log('[Focus] Session too short, discarding');
        }

        productivitySessionStartRef.current = null;
        productivitySessionAppRef.current = null;
      }
    }
  }, [currentApp, currentWebsite, isInBrowser, lastNonBrowserApp, isPaused, timerBehavior, tierAssignments]);

  // Periodic session flush — saves every 5min so sessions appear during long productive streaks
  useEffect(() => {
    const interval = setInterval(() => {
      if (!productivitySessionStartRef.current || !productivitySessionAppRef.current) return;
      const effectiveEnd = Math.min(Date.now(), lastInteractionRef.current + 300000);
      const durationMs = Math.max(0, effectiveEnd - productivitySessionStartRef.current);
      const durationSec = Math.floor(durationMs / 1000);
      if (durationSec < 60) return;
      const session = {
        started_at: new Date(productivitySessionStartRef.current).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: durationSec,
        app_name: productivitySessionAppRef.current,
        category: ''
      };
      if (window.deskflowAPI?.saveProductivitySession) {
        window.deskflowAPI.saveProductivitySession(session).then(() => {
          console.log('[Dashboard] Periodic session flush:', durationSec, 'seconds');
          window.dispatchEvent(new CustomEvent('focus-session-saved'));
        }).catch(() => { });
      }
      productivitySessionStartRef.current = Date.now();
    }, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // External activity manual stopwatch
  useEffect(() => {
    const loadExternalData = async () => {
      if (!window.deskflowAPI?.getExternalSessions) {
        console.log('[Dashboard] getExternalSessions API not available');
        return;
      }

      try {
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);
        const targetWeekStart = new Date(currentWeekStart.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000));
        const targetWeekEnd = new Date(targetWeekStart.getTime() + (7 * 24 * 60 * 60 * 1000));

        const sessions = await window.deskflowAPI.getExternalSessions('all');
        console.log('[Dashboard] Loaded external sessions:', sessions?.length || 0);

        const newExternalHourlyData = new Map<string, { externalSeconds: number; breakdown: Record<string, { seconds: number; color: string; icon: string }> }>();

        (sessions || []).forEach((session: any) => {
          const startMs = new Date(session.started_at).getTime();
          const endMs = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
          const durationSec = (endMs - startMs) / 1000;

          if (startMs >= targetWeekEnd || endMs < targetWeekStart) return;

          let currentMs = startMs;
          while (currentMs < endMs) {
            const currentDate = new Date(currentMs);
            const currentDay = currentDate.getDay();
            const currentHour = currentDate.getHours();
            const calendarHourStart = new Date(currentDate);
            calendarHourStart.setMinutes(0, 0, 0);
            const hourStartMs = calendarHourStart.getTime();
            const hourEndMs = hourStartMs + 3600000;

            if (currentDate >= targetWeekStart && currentDate < targetWeekEnd) {
              const segmentStart = Math.max(currentMs, hourStartMs);
              const segmentEnd = Math.min(endMs, hourEndMs);
              const segmentSeconds = Math.max(0, (segmentEnd - segmentStart) / 1000);

              if (segmentSeconds > 0) {
                const key = `${currentDay}-${currentHour}`;
                const existing = newExternalHourlyData.get(key) || { externalSeconds: 0, breakdown: {} };
                existing.externalSeconds = Math.min(existing.externalSeconds + segmentSeconds, 3600);

                const activityName = session.activity_name || 'Unknown';
                if (!existing.breakdown[activityName]) {
                  existing.breakdown[activityName] = { seconds: 0, color: session.color || 'var(--page-accent)', icon: session.icon || '?' };
                }
                existing.breakdown[activityName].seconds += segmentSeconds;

                newExternalHourlyData.set(key, existing);
              }
            }
            currentMs = hourEndMs;
          }
        });

        setExternalHourlyData(newExternalHourlyData);
      } catch (err) {
        console.error('[Dashboard] Error loading external sessions:', err);
      }
    };

    loadExternalData();
  }, [weekOffset]);

  // Load all external sessions once (used by chart aggregation below)
  useEffect(() => {
    if (!window.deskflowAPI?.getExternalSessions) return;
    window.deskflowAPI.getExternalSessions('all').then(setExternalSessions).catch(err => console.error('[Dashboard] Error loading external sessions:', err));
  }, []);

  // ── (chartInternalData + chartBarsResult replaced by backend weeklyHeatmap via dashboardData) ──

  // Y-axis tick computation for productivity chart
  const yAxisTicks = useMemo(() => {
    const maxHours = chartBarsResult.maxBarSeconds / 3600;
    const tickCount = 4;
    const ticks: number[] = [];

    let niceMax: number;
    if (selectedPeriod === 'all') {
      // Monthly totals can exceed 24h — auto-scale
      if (maxHours <= 24) {
        niceMax = Math.ceil(maxHours / 4) * 4 || 4;
      } else if (maxHours <= 100) {
        niceMax = Math.ceil(maxHours / 20) * 20 || 20;
      } else {
        niceMax = Math.ceil(maxHours / 50) * 50 || 50;
      }
    } else if (selectedPeriod === 'today') {
      niceMax = 1; // Max 1h per hour slot
    } else {
      const niceSteps = [1, 2, 4, 6, 8, 10, 12, 16, 20, 24];
      const rawMax = niceSteps.find(s => s >= maxHours) || Math.ceil(maxHours / 4) * 4;
      niceMax = Math.min(rawMax, 24);
    }

    const step = niceMax / tickCount;
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(Math.round(step * i * 10) / 10);
    }
    return { ticks, niceMax, step };
  }, [chartBarsResult.maxBarSeconds, selectedPeriod]);

  // External activity stopwatch - adaptive: shows external activity if running
  const stopwatchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stopwatch interval - only runs when external session is active
  useEffect(() => {
    // Clear any existing interval
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }

    if (!externalSessionRunning || !externalSessionStart) {
      return;
    }

    console.log('[Dashboard] Stopwatch started, startTime:', externalSessionStart.getTime());

    // Calculate and set initial elapsed immediately
    const now = Date.now();
    const initialElapsed = now - externalSessionStart.getTime();
    setExternalElapsedMs(initialElapsed);

    // Start interval
    stopwatchIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - externalSessionStart.getTime();
      setExternalElapsedMs(elapsed);
    }, 1000);

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    };
  }, [externalSessionRunning, externalSessionStart]);

  const handleSelectExternalActivity = useCallback((activity: ExternalActivity) => {
    setSelectedExternalActivity(activity);
  }, []);

  // Interaction detection for external activity
  useEffect(() => {
    if (!externalSessionRunning || externalTrackingMode !== 'interaction') return;

    let lastInteraction = Date.now();
    const checkIdle = setInterval(() => {
      const idleTime = Date.now() - lastInteraction;
      // If idle for more than 2 minutes, pause the timer
      if (idleTime > 120000) {
        setExternalSessionRunning(false);
      }
    }, 30000);

    const handleInteraction = () => {
      lastInteraction = Date.now();
      // Resume if was paused due to idle
      if (!externalSessionRunning && selectedExternalActivity) {
        setExternalSessionRunning(true);
      }
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);

    return () => {
      clearInterval(checkIdle);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [externalSessionRunning, externalTrackingMode, selectedExternalActivity]);

  const handleStartExternalSession = useCallback(async () => {
    if (!selectedExternalActivity) return;

    // Save to database via IPC
    if (window.deskflowAPI?.startExternalSession) {
      try {
        const sessionId = await window.deskflowAPI.startExternalSession(selectedExternalActivity.id);
        console.log('[Dashboard] Started external session:', selectedExternalActivity.name, 'ID:', sessionId);
      } catch (err) {
        console.error('[Dashboard] Failed to start external session:', err);
      }
    }

    const now = new Date();
    setExternalSessionStart(now);
    setExternalSessionRunning(true);
    setExternalElapsedMs(0);
    console.log('[Dashboard] Stopwatch started manually, startTime:', now.getTime());
  }, [selectedExternalActivity]);

  const handleStopExternalSession = useCallback(async () => {
    // Save to database via IPC
    if (window.deskflowAPI?.stopExternalSession && selectedExternalActivity) {
      try {
        // Get the active session first to get its ID
        const activeSession = await window.deskflowAPI.getActiveExternalSession();
        if (activeSession?.id) {
          await window.deskflowAPI.stopExternalSession(activeSession.id, new Date().toISOString());
          console.log('[Dashboard] Stopped external session:', selectedExternalActivity.name);
        }
      } catch (err) {
        console.error('[Dashboard] Failed to stop external session:', err);
      }
    }

    setExternalSessionRunning(false);
    setExternalSessionStart(null);
    setExternalElapsedMs(0);
  }, [selectedExternalActivity]);

  // Keyboard shortcuts - ALWAYS ACTIVE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to SELECT external activity (same as clicking on it)
      if (e.key === 'Enter') {
        console.log('[Dashboard] Enter key pressed!');

        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();

        // Find first available activity and select it
        if (activities.length > 0 && !selectedExternalActivity) {
          const firstActivity = activities[0];
          setSelectedExternalActivity(firstActivity);
          console.log('[Dashboard] Enter: Selected activity:', firstActivity.name);
        }
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        if (selectedExternalActivity) {
          setSelectedExternalActivity(null);
        }
      }
    };

    // Add to document with capture to ensure we get it
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activities, selectedExternalActivity]);

  // Load all logs for heatmap calculations
  const [allLogs, setAllLogs] = useState<any[]>([]);
  // A dedicated flag, NOT `allLogs.length === 0`: a user who has never tracked
  // anything would leave allLogs empty forever and the heatmap would spin on its
  // skeleton indefinitely instead of showing the empty state.
  const [logsLoaded, setLogsLoaded] = useState(false);
  // Reuse the parent's already-loaded rows when we have them. App's loadData
  // pulls the same full table (~10 MB / 29k rows) on startup, so fetching a third
  // copy here was pure duplication. This was the LAST of three full-table reads
  // before first paint.
  const usableShared = Array.isArray(sharedLogs) && sharedLogs.length > 0 ? sharedLogs : null;
  useEffect(() => {
    // `category` MUST be carried through: it is the only thing that lets the
    // heatmap resolve a productivity tier per log. It was being dropped here, so
    // every cell fell back to the neutral tier and the red→green ramp collapsed
    // to a single flat colour.
    const format = (rows: any[]) => rows.map(l => ({
      timestamp: l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp),
      app: l.app,
      category: l.category,
      is_browser_tracking: l.is_browser_tracking === 1 || l.is_browser_tracking === true,
      domain: l.domain,
      // App's ActivityLog carries `duration` in SECONDS; the raw row carries
      // `duration_ms`. Normalise to ms so the heatmap maths below is unchanged.
      duration_ms: l.duration_ms ?? (typeof l.duration === 'number' ? l.duration * 1000 : 0),
    }));

    if (usableShared) {
      setAllLogs(format(usableShared));
      setLogsLoaded(true);
      return;
    }

    if (window.deskflowAPI?.getLogs) {
      window.deskflowAPI.getLogs().then((logs: any[]) => {
        setAllLogs(format(logs));
      }).catch(e => console.warn('[Dashboard] Failed to load all logs', e))
        .finally(() => setLogsLoaded(true));
    } else {
      setLogsLoaded(true);
    }
    // `usableShared`, NOT `[]`. With an empty dep list this effect ran ONCE per
    // mount, so `allLogs` was a snapshot frozen at the moment the dashboard was
    // opened: the heatmap never saw a single row recorded after that, while the
    // Activity page — fed by App's live `allLogs` — kept counting. That is the
    // whole "the heatmap is empty but the activity page is full" report.
    // `usableShared` is `sharedLogs` itself (or a stable `null`), so App's
    // fingerprint-guarded refresh re-runs this and the heatmap tracks the tracker.
    // The no-prop fallback above still fetches exactly once.
  }, [usableShared]);

  // The 7 local-midnight Dates of the loaded week. Built with setDate (not
  // toISOString) on purpose — see heatmapWeekDates usage in openHeatmapDay.
  const heatmapWeekDates = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + weekOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  // Compute heatmap data for the selected week (respecting weekOffset)
  const heatmapData = useMemo<HeatmapCell[]>(() => {
    const weekStart = heatmapWeekDates[0];
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    interface Acc {
      deviceSeconds: number;
      /** seconds spent in productive-tier sources — the numerator of `productivity` */
      productiveSeconds: number;
      appSeconds: number;
      domainSeconds: number;
      appBreakdown: Record<string, { seconds: number; category: string }>;
      appCount: number;
      segmentCount: number;
    }
    const cellMap = new Map<string, Acc>();
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        cellMap.set(`${d}-${h}`, {
          deviceSeconds: 0, productiveSeconds: 0, appSeconds: 0, domainSeconds: 0,
          appBreakdown: {}, appCount: 0, segmentCount: 0,
        });
      }
    }

    // Read the tier assignment through a ref: getTierFromCategory is a fresh
    // closure on every render, so depending on it would recompute 168 cells at
    // mouse-event frequency for no reason.
    const tiers = tierAssignmentsRef.current || DEFAULT_TIER_ASSIGNMENTS;
    const tierOf = (category?: string): 'productive' | 'neutral' | 'distracting' => {
      if (!category) return 'neutral';
      if (tiers.productive.includes(category)) return 'productive';
      if (tiers.distracting.includes(category)) return 'distracting';
      return 'neutral';
    };

    for (const log of allLogs) {
      const ts = new Date(log.timestamp);
      if (ts < weekStart || ts >= weekEnd) continue;
      const day = ts.getDay();
      const hour = ts.getHours();
      const entry = cellMap.get(`${day}-${hour}`);
      if (!entry) continue;
      const secs = (log.duration_ms || 0) / 1000;
      if (secs <= 0) continue;

      entry.segmentCount += 1;
      // Only TRACKED time counts toward the productivity ratio. Previously every
      // log — browser rows included — was added to both `seconds` and
      // `productive`, which made the ratio >= 1 for any cell with browser
      // activity; the `Math.min(1, …)` clamp then pinned every cell to 1.0 and the
      // entire red→amber→green ramp was dead code.
      if (log.is_browser_tracking) {
        entry.deviceSeconds += secs;
        entry.domainSeconds += secs;
        const key = log.domain || log.app;
        if (key && !entry.appBreakdown[key]) {
          entry.appBreakdown[key] = { seconds: 0, category: log.category || 'Browser' };
          entry.appCount += 1;
        }
        if (key) entry.appBreakdown[key].seconds += secs;
        if (tierOf(log.category) === 'productive') entry.productiveSeconds += secs;
      } else {
        entry.deviceSeconds += secs;
        entry.appSeconds += secs;
        const appName = log.app;
        if (appName) {
          if (!entry.appBreakdown[appName]) {
            entry.appBreakdown[appName] = { seconds: 0, category: log.category || 'Uncategorized' };
            entry.appCount += 1;
          }
          entry.appBreakdown[appName].seconds += secs;
        }
        if (tierOf(log.category) === 'productive') entry.productiveSeconds += secs;
      }
    }

    const result: HeatmapCell[] = [];
    cellMap.forEach((v, key) => {
      const [dayStr, hourStr] = key.split('-');
      const extData = externalHourlyData.get(key);
      result.push({
        day: Number(dayStr),
        hour: Number(hourStr),
        value: v.deviceSeconds,
        // denominator = tracked time only, so 0 means "nothing tracked", not NaN
        productivity: v.deviceSeconds > 0 ? v.productiveSeconds / v.deviceSeconds : 0,
        deviceSeconds: v.deviceSeconds,
        externalSeconds: extData?.externalSeconds || 0,
        deviceBreakdown: v.appBreakdown,
        externalBreakdown: extData?.breakdown || {},
        appCount: v.appCount,
        segmentCount: v.segmentCount,
      });
    });
    return result;
  }, [allLogs, heatmapWeekDates, externalHourlyData]);

  const heatmapWeekLabel = useMemo(() => {
    const a = heatmapWeekDates[0];
    const b = heatmapWeekDates[6];
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const sameMonth = a.getMonth() === b.getMonth();
    return sameMonth
      ? `${fmt(a)} – ${b.getDate()}, ${b.getFullYear()}`
      : `${fmt(a)} – ${fmt(b)}, ${b.getFullYear()}`;
  }, [heatmapWeekDates]);

  /**
   * Open the day-detail page for a day-of-week index in the loaded week.
   *
   * The date string is formatted from the LOCAL Date fields. The old code did
   * `toISOString().split('T')[0]`, and because `timestamp` is stored as UTC ISO,
   * a local midnight in any timezone east of UTC (UTC+7 here) serialised to the
   * PREVIOUS day — so every one of the 7 columns opened the wrong date.
   */
  const openHeatmapDay = useCallback((dayIdx: number) => {
    const targetDate = heatmapWeekDates[dayIdx];
    if (!targetDate) return;
    const dateStr = formatLocalDateKey(targetDate);

    if (!window.deskflowAPI?.getDayDetail) return;
    setDayDetailDate(dateStr);
    setDayDetailItems([]);
    setDayDetailLoading(true);
    window.deskflowAPI.getDayDetail(dateStr)
      .then(detail => { if (detail) setDayDetailItems(buildDayTimelineItems(detail)); })
      .catch(err => console.error('[Dashboard] getDayDetail failed:', err))
      .finally(() => setDayDetailLoading(false));
  }, [heatmapWeekDates]);

  // Compute website data from allLogs (filtered by selectedPeriod + dateOffset)
  // Toggle for App/Website view in solar system
  const [solarMode, setSolarMode] = useState<'apps' | 'websites'>('apps');

  // Solar data from backend (replaces allLogs-based computation)
  const computedWebsiteData = useMemo(() => {
    if (!dashboardData?.websiteStats) return [] as SolarSystemData[];
    return dashboardData.websiteStats.map((d: any) => ({
      name: d.domain,
      usage_ms: (d.totalSeconds || 0) * 1000,
      category: d.category || 'Website',
    }));
  }, [dashboardData?.websiteStats]);

  const computedSolarData = useMemo(() => {
    if (!dashboardData?.appStats) return [] as SolarSystemData[];
    return dashboardData.appStats.map((d: any) => ({
      name: d.app,
      usage_ms: (d.totalSeconds || 0) * 1000,
      category: d.category || 'App',
    }));
  }, [dashboardData?.appStats]);

  const solarData = solarMode === 'websites' ? computedWebsiteData : computedSolarData;

  const defaultSolarData: SolarSystemData[] = [
    { name: 'VS Code', usage_ms: 7200000, category: 'Tools' },
    { name: 'Chrome', usage_ms: 3600000, category: 'Browser' },
    { name: 'Antigravity', usage_ms: 1800000, category: 'IDE' },
  ];

  const solar = solarMode === 'websites'
    ? (computedWebsiteData.length > 0 ? computedWebsiteData : defaultSolarData)
    : (computedSolarData.length > 0 ? computedSolarData : defaultSolarData);
  const maxUsage = maxBy(solar, d => d.usage_ms, 1);

  // Border colors for different states
  const borderColor = externalSessionRunning
    ? 'var(--page-accent)'  // Purple for external
    : isDistracting
      ? 'var(--error)'  // Red for distracting
      : isCurrentlyProductive
        ? 'var(--success)'  // Green for productive
        : 'var(--muted-foreground)';  // Gray for idle

  // Need state for live tick
  const [tick, setTick] = useState(0);

  // Live timer tick
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate active session elapsed time with live updates
  const getElapsedDuration = (item: ActivityFeedItem): string => {
    if (!item.isActive || !item.startTime) return '';
    const elapsedMs = Date.now() - item.startTime;
    // SAFETY: Cap at 24 hours to prevent showing insane durations from bad startTime
    const cappedMs = Math.min(elapsedMs, 86400000); // 24 hours max
    const elapsedSec = Math.floor(cappedMs / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    const elapsedHr = Math.floor(elapsedMin / 60);

    if (elapsedHr > 0) return `${elapsedHr}:${(elapsedMin % 60).toString().padStart(2, '0')}:${(elapsedSec % 60).toString().padStart(2, '0')}`;
    return `${elapsedMin}:${(elapsedSec % 60).toString().padStart(2, '0')}`;
  };

  // Static elapsed times (for completed sessions - DURATION spent, not time ago)
  // Only re-calculate when activityFeed CHANGES, NOT on every tick
  const activityFeedWithElapsed = useMemo(() => {
    return activityFeed.slice(0, 10).map((item, index) => {
      // For completed sessions, use the DURATION from the log (seconds)
      // For active sessions (no duration yet), calculate elapsed time
      let durationSec: number;

      if (item.isActive) {
        // Active session - calculate time elapsed since start
        durationSec = Math.floor((Date.now() - item.startTime) / 1000);
      } else if (item.duration && item.duration > 0) {
        // Completed session with stored duration
        durationSec = item.duration;
      } else {
        // Fallback: calculate time from timestamp to next item (if exists)
        const nextItem = activityFeed[index + 1];
        if (nextItem) {
          const currentTime = new Date(item.timestamp).getTime();
          const nextTime = new Date(nextItem.timestamp).getTime();
          durationSec = Math.floor((nextTime - currentTime) / 1000);
        } else {
          durationSec = 0;
        }
      }

      const elapsedMin = Math.floor(durationSec / 60);
      const elapsedHr = Math.floor(elapsedMin / 60);

      let durationStr = '';
      if (elapsedHr > 0) durationStr = `${elapsedHr}h ${elapsedMin % 60}m`;
      else if (elapsedMin > 0) durationStr = `${elapsedMin}m`;
      else if (durationSec > 0) durationStr = `${durationSec}s`;
      else durationStr = '';

      const result = { ...item };
      result.elapsedStr = durationStr;
      result.isTop = index === 0;
      return result;
    });
  }, [activityFeed]);

  // Transform dashboardData.appStats/websiteStats → ActivityLog[] for OrbitSystem
  //
  // NORMALIZER CONTRACT: `appStats` rows are `{ app, category, seconds }` and
  // `websiteStats` rows are `{ domain, seconds }` (aggregateNormalizer.ts:75).
  // These adapters used to read `s.totalSeconds` — a field that only exists on
  // `overview`. On appStats/websiteStats it is `undefined`, so `|| 0` silently
  // gave EVERY app a duration of 0; computePlanets then dropped every planet
  // below MIN_PLANET_TIME_SECONDS and the solar system rendered with zero
  // systems. A missing field on an aggregate is indistinguishable from "no time
  // spent", so the whole view was empty rather than erroring.
  //
  // Accept every spelling the aggregates have used, in ms-aware order, so a
  // future rename degrades to "still renders" instead of "silently empty".
  const orbitSeconds = (s: any): number => {
    const candidates = [s?.seconds, s?.totalSeconds, s?.duration];
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c) && c > 0) return Math.round(c);
    }
    const ms = [s?.total_ms, s?.duration_ms].find(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
    return ms ? Math.round(ms / 1000) : 0;
  };

  const orbitLogs = useMemo(() => {
    if (!dashboardData?.appStats) return [];
    return dashboardData.appStats.map((s: any, i: number) => ({
      id: i,
      timestamp: new Date(),
      app: s.app || s.app_name || '',
      category: s.category || 'Other',
      duration: orbitSeconds(s),
    })).filter((l: any) => l.app);
  }, [dashboardData?.appStats]);

  const orbitWebsiteLogs = useMemo(() => {
    if (!dashboardData?.websiteStats) return [];
    return dashboardData.websiteStats.map((s: any, i: number) => ({
      id: i,
      timestamp: new Date(),
      app: s.domain || s.app_name || '',
      category: s.category || 'Other',
      duration: orbitSeconds(s),
      domain: s.domain || s.app_name || '',
    })).filter((l: any) => l.app);
  }, [dashboardData?.websiteStats]);

  // Notify backend when dashboard is visible/hidden for on-view recording mode
  // Also restart tracking if the interval died (safety net for long-running sessions)
  useEffect(() => {
    if (window.deskflowAPI?.setPageVisibility) {
      window.deskflowAPI.setPageVisibility('dashboard', true);
    }
    if (window.deskflowAPI?.restartTracking) {
      window.deskflowAPI.restartTracking();
    }
    return () => {
      if (window.deskflowAPI?.setPageVisibility) {
        window.deskflowAPI.setPageVisibility('dashboard', false);
      }
    };
  }, []);

  // Start the global phase clock (idempotent — safe to call multiple times)
  useEffect(() => { startPhaseClock(); }, []);

  // ── Platform filter state ──
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const [showCardLibrary, setShowCardLibrary] = useState(false);

  // ── Signals disclosure ────────────────────────────────────────────────
  // The 8 cross-domain stat tiles (AI / Console / Finance / Learn / Browser /
  // Brain / Covenant / Health) used to render as a full-width 4-across grid
  // directly under the day's primary cards, so eight small readouts competed
  // with Goals, Deadlines and the productivity chart for the same attention.
  // They are secondary signals — reference, not briefing — so they collapse
  // behind one control and the day reads top-down. Collapsed by default.
  const SIGNALS_KEY = 'deskflow-signals-open';
  const [signalsOpen, setSignalsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(SIGNALS_KEY) === 'true'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem(SIGNALS_KEY, String(signalsOpen)); } catch {} }, [signalsOpen]);

  // ── Card layering: z-index + pinning ──
  const Z_KEY = 'deskflow-widget-zindices';
  const PIN_KEY = 'deskflow-pinned-widgets';
  const [widgetZIndices, setWidgetZIndices] = useState<Record<string, number>>(() => {
    try { const saved = localStorage.getItem(Z_KEY); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
  });
  const [pinnedWidgets, setPinnedWidgets] = useState<Set<string>>(() => {
    try { const saved = localStorage.getItem(PIN_KEY); return saved ? new Set(JSON.parse(saved)) : new Set(); } catch { return new Set(); }
  });

  useEffect(() => { try { localStorage.setItem(Z_KEY, JSON.stringify(widgetZIndices)); } catch {} }, [widgetZIndices]);
  useEffect(() => { try { localStorage.setItem(PIN_KEY, JSON.stringify([...pinnedWidgets])); } catch {} }, [pinnedWidgets]);

  const baseZ = 10;
  const getZIndex = useCallback((widgetId: string) => {
    if (pinnedWidgets.has(widgetId)) return 1000;
    return widgetZIndices[widgetId] ?? baseZ;
  }, [widgetZIndices, pinnedWidgets]);

  const bringToFront = useCallback((widgetId: string) => {
    setWidgetZIndices(prev => {
      const max = Object.values(prev).reduce((a, b) => Math.max(a, b), baseZ);
      const next = { ...prev, [widgetId]: max + 1 };
      // Remove non-pinned entries to keep it clean (only track recently elevated)
      const cleaned: Record<string, number> = {};
      for (const [id, z] of Object.entries(next)) {
        if (pinnedWidgets.has(id) || z > baseZ) cleaned[id] = z;
      }
      return cleaned;
    });
  }, [pinnedWidgets]);

  const togglePin = useCallback((widgetId: string) => {
    setPinnedWidgets(prev => {
      const next = new Set(prev);
      if (next.has(widgetId)) next.delete(widgetId); else next.add(widgetId);
      return next;
    });
  }, []);

  // Fetch available platforms on mount
  useEffect(() => {
    (async () => {
      try {
        const api = await awaitApi();
        const platforms = await api.getPlatforms?.();
        if (platforms && platforms.length > 0) {
          setAvailablePlatforms(platforms);
        }
      } catch (_e) { /* platforms not available */ }
    })();
  }, []);


  return (
    <PageShell page="dashboard" variant="dashboard" className="text-white dash-root">
      {/* Canvas accent follows [data-page="dashboard"] --page-accent (#ec4899).
          It was hardcoded emerald #34d399, so the ambient canvas stream ran in
          a different hue from every accent-linked element on the page. */}
      <CurrentCanvas accent="#ec4899" render={renderStream} />
      <TimerResetOverlay trigger={resetTrigger} />

      {/* Card Library */}
      <AnimatePresence>
        {showCardLibrary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={() => setShowCardLibrary(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-xl border border-zinc-700/50 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] max-w-7xl w-full max-h-[88vh] overflow-auto p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[var(--page-accent)]/15 border border-[var(--page-accent)]/20 flex items-center justify-center">
                    <Grid3X3 className="w-4 h-4 text-[var(--page-accent)]" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-100">Widget Library</h2>
                    <p className="text-[11px] text-zinc-500">Select which cards appear on your dashboard</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCardLibrary(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors light:hover:bg-[var(--ws-surface-hover)]"
                >
                  <X size={16} />
                </button>
              </div>
              <CardLibrary
                onChanged={(layout) => {
                  console.log('[Dashboard] Layout updated:', layout);
                  setShowCardLibrary(false);
                }}
                onSaved={() => {
                  console.log('[Dashboard] Layout saved');
                  setShowCardLibrary(false);
                }}
                onClose={() => setShowCardLibrary(false)}
                data={widgetData}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Utility bar ──────────────────────────────────────────────────
          This used to be THREE stacked rows above the fold — an OS filter, a
          right-aligned pair of heavy elevated buttons, and a debug readout
          reading "Layers: / PINNED: / Click any card to bring it to front".
          So the first screen of the dashboard contained no dashboard: it was
          configuration, styled louder than the data, plus a debug string.
          Two problems beyond the clutter:
            1. The debug line instructed a gesture that does nothing. Cards sit
               in normal flow with position:relative, so bringToFront()'s
               z-index has no stacking conflict to resolve. It was scaffolding
               shipped as product. Pinning still works from the Card Library —
               it just no longer narrates itself in the page body.
            2. "Theme" and "Widgets" carried bg-elevated + shadow-lg + an
               accent border, i.e. the visual weight of a primary CTA, while
               the day's actual content had none. Accent on a control should
               mean "this is the action", and the action here is reading the
               day, not restyling it.
          One row now: the two drill-down destinations (the most distinctive
          surfaces on the page, previously buried as pale ghost buttons at the
          bottom of the chart card) lead on the left as the only emphasised
          pair; the OS filter and the two settings controls sit quiet on the
          right as hairline ghost buttons. */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpandedModal('heatmap')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--page-accent)]/40 bg-[var(--page-accent)]/[0.08] text-[12px] font-semibold text-[var(--page-accent)] hover:bg-[var(--page-accent)]/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 transition-colors duration-200"
          >
            <Clock size={14} />
            Review the week
          </button>
          <button
            onClick={() => setExpandedModal('solar')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--page-accent)]/40 bg-[var(--page-accent)]/[0.08] text-[12px] font-semibold text-[var(--page-accent)] hover:bg-[var(--page-accent)]/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 transition-colors duration-200"
          >
            <Sun size={14} />
            App ecosystem
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {availablePlatforms.length > 0 && (
            <>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium mr-0.5">Source</span>
              <button
                onClick={() => setPlatformFilter('all')}
                aria-pressed={platformFilter === 'all'}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 ${
                  platformFilter === 'all'
                    ? 'border-[var(--page-accent)]/40 text-[var(--page-accent)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                }`}
              >
                All
              </button>
              {availablePlatforms.map(p => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  aria-pressed={platformFilter === p}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 ${
                    platformFilter === p
                      ? 'border-[var(--page-accent)]/40 text-[var(--page-accent)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  {p === 'win32' ? 'Windows' : p === 'darwin' ? 'macOS' : p}
                </button>
              ))}
              <span className="w-px h-4 bg-[var(--border-subtle)] mx-1" aria-hidden="true" />
            </>
          )}

          {/* Theme toggle: CURRENT (default) <-> TERMINAL. Applies a
              [data-dash-theme] attribute on <html>; with it absent the dashboard
              is byte-for-byte the current design. */}
          <button
            onClick={toggleDashTheme}
            data-dash-theme-toggle
            aria-pressed={dashTheme === 'terminal'}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--page-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 transition-colors duration-200"
            title={dashTheme === 'terminal'
              ? 'Terminal theme is ON — click to switch back to the current theme'
              : 'Current theme — click to switch to the Terminal theme'}
          >
            <Terminal size={13} />
            {dashTheme === 'terminal' ? 'Terminal' : 'Current'}
          </button>
          <button
            onClick={() => setShowCardLibrary(v => !v)}
            aria-expanded={showCardLibrary}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--page-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 transition-colors duration-200"
            title="Choose which cards appear on your dashboard"
          >
            {showCardLibrary ? <X size={13} /> : <LayoutGrid size={13} />}
            {showCardLibrary ? 'Close' : 'Widgets'}
          </button>
        </div>
      </div>

<div className="relative z-10 flex flex-col flex-1 min-h-0 w-full">
           <div className="mx-auto px-4 lg:px-6 flex flex-col flex-1 min-h-0 w-full">

           {/* ── Band: NOW ────────────────────────────────────────────────
               The dashboard answers three questions in order — what am I
               doing, is today on track, what needs me. This band is the
               first. Labelled rather than free-floating so the wall of cards
               below reads as a briefing with sections instead of 15 boxes
               competing at equal weight. */}
           <div className="flex items-center gap-2 mb-2 px-1">
             <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--page-accent)]/80">Now</h2>
             <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden="true" />
           </div>

{/* Row 1: HeroBand (Stopwatch) + Momentum Hero */}
{(isVisible('status-band') || isVisible('momentum')) && (
<DeskFlowCardMotion className="mb-2" zIndex={getZIndex('status-band')} onClick={() => bringToFront('status-band')} pinned={pinnedWidgets.has('status-band')}>
              <div className="grid grid-cols-1 md:grid-cols-[8fr_4fr] gap-3 items-stretch w-full">
                {isVisible('status-band') && (
                <div data-section="Hero" className="relative min-w-0 flex-1">
                <div className="absolute top-2 right-2 z-40"><WidgetJumpButton widgetId="status-band" iconOnly /></div>
                <StatusBand
                 displayTimeMs={displayTime?.ms || 0}
                 isCurrentlyProductive={isCurrentlyProductive}
                 isDistracting={isDistracting}
                 currentAppName={isInBrowser
                   ? (currentWebsite?.title || currentWebsite?.domain || '')
                   : (currentApp?.app || currentApp?.title || '')}
                 isReal={currentApp?.isReal}
                                 totalFocusedMs={currentProductiveMs}
                                 /* was (dashboardData?.overview?.productiveSeconds || 0) * 1000 —
                                    a DB snapshot refreshed only on data reload, while the timer
                                    beside it read the live store. The ring could therefore show a
                                    different number than the timer it was tracking. */
                                 dailyFocusTarget={240}
                                 isInBrowser={isInBrowser}
                 isPaused={isPaused}
                 onChangeTier={changeTrackedTier}
                 websiteTitle={currentWebsite?.title}
                 websiteDomain={currentWebsite?.domain}
                 websiteUrl={currentWebsite?.url}
                 websiteCategory={currentWebsite?.category}
                 appCategory={currentApp?.category}
               />

               {/* Confirmation that the re-tier was saved. Its display time is
                   Settings → General → Notification Duration. */}
               <AnimatePresence>
                 {tierToast && (
                   <motion.div
                     key={tierToast.id}
                     initial={{ opacity: 0, y: 8, scale: 0.97 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: -6, scale: 0.97 }}
                     transition={{ duration: 0.18 }}
                     className="absolute z-50 bottom-3 right-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-700/60 bg-zinc-900/98 light:bg-[var(--ws-surface-raised)] light:bg-white shadow-xl"
                   >
                     <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                     <span className="text-[12px] text-zinc-200 light:text-zinc-800">{tierToast.text}</span>
                     <button
                       onClick={() => setTierToast(null)}
                       className="ml-1 text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
                       aria-label="Dismiss"
                     >
                       <X className="w-3 h-3" />
                     </button>
                   </motion.div>
                 )}
               </AnimatePresence>
               </div>
               )}
{isVisible('momentum') && (
                 <div data-section="Momentum Hero" className="relative min-w-0 flex-1 pl-5 ml-1 border-l border-dashed border-[var(--border-subtle)] self-stretch">
                <div className="absolute top-2 right-2 z-40"><WidgetJumpButton widgetId="momentum" iconOnly /></div>
                <MomentumHero
                  momentum={
                    momentum
                      ? { ...momentum, hasGoals: (goals?.length ?? 0) > 0, hasSchedule: (schedule?.length ?? 0) > 0 }
                      : null
                  }
                  loading={dashLoading}
                  isCurrentlyProductive={isCurrentlyProductive}
                  isDistracting={isDistracting}
                />
                </div>
                )}
             </div>
             </DeskFlowCardMotion>
            )}

{/* Row 2: Tier Breakdown Strip */}
            {isVisible('tier-breakdown') && (
<DeskFlowCardMotion className="mb-2" zIndex={getZIndex('tier-breakdown')} onClick={() => bringToFront('tier-breakdown')} pinned={pinnedWidgets.has('tier-breakdown')} jumpWidgetId="tier-breakdown">
              <div data-section="Tier Breakdown" className="w-full">
             <TierBreakdownStrip
             productiveHours={dashboardData?.overview?.productiveSeconds ? Math.round(dashboardData.overview.productiveSeconds / 3600 * 10) / 10 : 0}
             neutralHours={dashboardData?.overview?.neutralSeconds ? Math.round(dashboardData.overview.neutralSeconds / 3600 * 10) / 10 : 0}
             distractingHours={dashboardData?.overview?.distractingSeconds ? Math.round(dashboardData.overview.distractingSeconds / 3600 * 10) / 10 : 0}
             totalHours={dashboardData?.overview?.totalSeconds ? Math.round(dashboardData.overview.totalSeconds / 3600 * 10) / 10 : 0}
           />
           </div>
          </DeskFlowCardMotion>
          )}

{/* Row 3: Pinned Activities */}
           {isVisible('pinned-activities') && (
           <DeskFlowCardMotion className="mb-2" zIndex={getZIndex('pinned-activities')} onClick={() => bringToFront('pinned-activities')} pinned={pinnedWidgets.has('pinned-activities')} jumpWidgetId="pinned-activities">
             <div data-section="Pinned" className="w-full">
            <PinnedActivities
              pinnedActivities={pinnedActivities}
              setPinnedActivities={setPinnedActivities}
              activities={activities}
              selectedExternalActivity={selectedExternalActivity}
              setSelectedExternalActivity={setSelectedExternalActivity}
              handleSelectExternalActivity={handleSelectExternalActivity}
              externalSessionRunning={externalSessionRunning}
              formatDuration={formatDuration}
              externalElapsedMs={externalElapsedMs}
              handleStartExternalSession={handleStartExternalSession}
              handleStopExternalSession={handleStopExternalSession}
              collapsible
            />
           </div>
          </DeskFlowCardMotion>
          )}

{/* ── Band: TODAY ──────────────────────────────────────────────────
          Second question: is the day on track, and what does it still need?
          Sits below the NOW band so the two are read as distinct registers —
          live state first, the day's commitments second. */}
           <div className="flex items-center gap-2 mb-2 mt-4 px-1">
             <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--page-accent)]/80">Today</h2>
             <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden="true" />
           </div>

{/* Row 4: Quadruple Column — Goals + Deadlines + Focus + Longest Focus */}
{(isVisible('goals') || isVisible('quick-focus') || isVisible('deadlines')) && (
<DeskFlowCardMotion className="mb-2" zIndex={getZIndex('goals')} onClick={() => bringToFront('goals')} pinned={pinnedWidgets.has('goals')}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 w-full">
                 {isVisible('goals') && (
                 <div data-section="Goals Card" className="relative w-full">
                  <div className="absolute top-2 right-2 z-40"><WidgetJumpButton widgetId="goals" iconOnly /></div>
                 <GoalsCard
                   goals={goals}
                   longTermGoals={longTermGoals}
                   suggestions={suggestions}
                   insights={dashboardInsights}
                   loading={dashLoading}
                   error={dashError}
                   onToggle={toggleGoal}
                   onAdd={addGoal}
                   onDelete={deleteGoal}
                   onUpdate={updateGoal}
                   onAcceptSuggestion={acceptSuggestion}
                   onDismissSuggestion={dismissSuggestion}
                   onGenerateSuggestions={generateSuggestions}
                 />
                 </div>
                 )}
{isVisible('quick-focus') && (
                  <div data-section="Focus Start" className="relative w-full">
                  <div className="absolute top-2 right-2 z-40"><WidgetJumpButton widgetId="quick-focus" iconOnly /></div>
                 <QuickFocusCard
                   state={deepFocus.state}
                   onStart={deepFocus.start}
                   onEnd={deepFocus.end}
                 />
                 </div>
                 )}
                 {isVisible('deadlines') && (
                 <div data-section="Deadlines Card" className="relative w-full">
                  <div className="absolute top-2 right-2 z-40"><WidgetJumpButton widgetId="deadlines" iconOnly /></div>
                 <DeadlinesCard
                   deadlines={deadlines}
                   reminders={reminders}
                   loading={dashLoading}
                   error={dashError}
                   onAdd={addDeadline}
                   onDelete={deleteDeadline}
                   onUpdate={updateDeadline}
                   onComplete={completeDeadline}
                   onToggleReminder={async (id, done) => {
                     try { await (window as any).deskflowAPI.toggleReminder(id, done); refreshDashboard(); } catch {}
                   }}
                   onDeleteReminder={async (id) => {
                     try { await (window as any).deskflowAPI.deleteReminder(id); refreshDashboard(); } catch {}
                   }}
                 />
                 </div>
                 )}
{isVisible('longest-focus') && (
               <div data-section="Longest Focus" className="relative w-full">
                <div className="absolute top-2 right-2 z-40"><WidgetJumpButton widgetId="longest-focus" iconOnly /></div>
               <LongestFocusCard data={longestFocusWithLive} loading={longestFocusLoading} />
              </div>
              )}
              </div>
            </DeskFlowCardMotion>
            )}

            {/* Row 5: Schedule */}
            {isVisible('schedule') && (
             <DeskFlowCardMotion className="mb-2" zIndex={getZIndex('schedule')} onClick={() => bringToFront('schedule')} pinned={pinnedWidgets.has('schedule')} jumpWidgetId="schedule">
                <div data-section="Schedule" className="w-full">
                <ScheduleCard
                   entries={schedule}
                   loading={dashLoading}
                   error={dashError}
                   onAdd={addScheduleEntry}
                   onUpdate={updateScheduleEntry}
                   onDelete={deleteScheduleEntry}
                   onDayChange={handleScheduleDayChange}
                 />
               </div>
            </DeskFlowCardMotion>
            )}

             {/* AI Insights Strip */}
            {isVisible('insights') && (
             <DeskFlowCardMotion className="mb-2" zIndex={getZIndex('insights')} onClick={() => bringToFront('insights')} pinned={pinnedWidgets.has('insights')} jumpWidgetId="insights">
             <div data-section="Insight Strip" className="w-full">
            <InsightStrip insights={aiInsights} />
            </div>
            </DeskFlowCardMotion>
            )}

           {/* Row 6: Productivity Chart */}
           {isVisible('productivity-chart') && (
              <DeskFlowCardMotion className="mb-2" zIndex={getZIndex('productivity-chart')} onClick={() => bringToFront('productivity-chart')} pinned={pinnedWidgets.has('productivity-chart')} jumpWidgetId="productivity-chart">
              <div className="p-5">
               <div>
               <SectionHeader title="Productivity" icon={<BarChart3 size={14} />} />
               <div className="h-52 mt-2">
                 {chartBarsResult.chartBars.length === 0 ||
                  chartBarsResult.maxBarSeconds <= 1 ? (
                   <EmptyState icon={<BarChart3 className="w-8 h-8 opacity-30" />} title="No tracked time in this range" description="Switch period, or start tracking — this chart fills in as the tracker records activity." />
                 ) : (
                   <Bar data={{
                     labels: chartBarsResult.chartBars.map(b => b.label),
                     datasets: [
                       {
label: 'Productive',
                          data: chartBarsResult.chartBars.map(b => Math.round(b.productiveSeconds / 3600 * 100) / 100),
                          backgroundColor: PRODUCTIVITY_SERIES.productive,
                         borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7
                       },
                       {
label: 'Other',
                          data: chartBarsResult.chartBars.map(b => Math.round(b.nonProductiveSeconds / 3600 * 100) / 100),
                          backgroundColor: PRODUCTIVITY_SERIES.other,
                         borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7
                       },
                       {
label: 'External',
                          data: chartBarsResult.chartBars.map(b => Math.round(b.externalSeconds / 3600 * 100) / 100),
                          backgroundColor: PRODUCTIVITY_SERIES.external,
                         borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7
                       },
                     ],
                   }} options={{
                     responsive: true, maintainAspectRatio: false,
                     plugins: { legend: { display: false }, tooltip: {
                      /* Hardcoded #18181b dark tooltip. This is the FOURTH one: the three
                         ProductivityChart* components were tokenised earlier and this one
                         lives on the page itself, so it was missed. A canvas tooltip is
                         painted from JS, so no CSS override can reach it. */
                      ...chartTooltip(),yColor: '#a1a1aa', borderColor: '#3f3f46', borderWidth: 1, cornerRadius: 8, padding: 10 } },
                     scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#71717a', font: { size: 11 } } }, y: { stacked: true, grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 11 } } } },
                   }} />
                 )}
               </div>
{/* Custom legend — swatches bound to the same literals the bars
                    use, so a legend can never describe a colour that isn't
                    drawn. See PRODUCTIVITY_SERIES. */}
                <div className="flex items-center gap-4 mt-4 text-[11px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: PRODUCTIVITY_SERIES.productive }}></span> Productive
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: PRODUCTIVITY_SERIES.other }}></span> Other
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: PRODUCTIVITY_SERIES.external }}></span> External
                  </div>
                </div>
{/* The "Review the week" / "App ecosystem" pair used to live here as two pale
                    ghost buttons at the very bottom of the chart card — the most
                    distinctive surfaces on the page were the least findable, and
                    styled quieter than the config buttons above the fold. They
                    now lead the utility bar as the only emphasised controls. */}
                </div>
             </div>
             </DeskFlowCardMotion>
           )}

          {/* Row 7: Activity Feed */}
          {isVisible('recent-sessions') && (
           <DeskFlowCardMotion className="mb-2" zIndex={getZIndex('recent-sessions')} onClick={() => bringToFront('recent-sessions')} pinned={pinnedWidgets.has('recent-sessions')} jumpWidgetId="recent-sessions">
              <div className="p-5">
               <SectionHeader title="Recent Sessions" icon={<Clock size={14} />} />
             <div className="space-y-0.5 mt-3">
               {activityFeedWithElapsed.length === 0 ? (
                 <EmptyState icon={<Clock size={20} />} title="No sessions yet" description="Start an activity to see it here" />
               ) : (
                 [...activityFeedWithElapsed].reverse().slice(0, 10).map((item) => {
                   const isActive = item.isActive;
                   const durationStr = isActive ? getElapsedDuration(item) : item.elapsedStr;
                   return (
                     <div key={item.id}
                       className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group cursor-pointer light:hover:bg-[var(--ws-surface-hover)]"
                     >
                       <div className="flex items-center gap-3 min-w-0">
                         <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                           item.tier === 'productive' ? 'bg-[var(--tier-productive)]' :
                           item.tier === 'distracting' ? 'bg-[var(--tier-distracting)]' :
                           'bg-[var(--tier-neutral)]'
                         }`} />
                         <div className="min-w-0">
                           <div className="text-[13px] text-[var(--text-primary)] truncate">{item.name}</div>
                           <div className="text-[11px] text-[var(--text-muted)] truncate">{item.category} • {item.timestamp.toLocaleTimeString()}</div>
                         </div>
                       </div>
                       <div className="text-right shrink-0 ml-3">
                       <div className="text-[13px] font-mono text-[var(--text-muted)]">{isActive && durationStr ? durationStr : item.elapsedStr}</div>
                       <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border border-zinc-800/50 text-[var(--text-secondary)]">
                           {item.tier}
                         </span>
                       </div>
                     </div>
                   );
                 })
               )}
             </div>
             </div>
             </DeskFlowCardMotion>
           )}

        </div>
      </div>

        {/* ── Band: SIGNALS ────────────────────────────────────────────
            BUG FIX (preserved): these 8 stat widgets used to render inside 2
            grouped `isVisible()` gates, so hiding ONE of them (e.g. learn-widget)
            also hid the two widgets sharing its grid — their layout-editor
            toggles did nothing and their jump buttons vanished with them. Every
            widget still carries its own gate and the grid reflows around the
            visible ones.

            What changed is WHERE they sit. Eight same-scale tiles directly
            under the day's primary cards meant Goals, Deadlines and the
            productivity chart had to share attention with a wall of small
            readouts, and nothing on the page had a clear entry point. These are
            secondary signals — reference, not briefing — so they collapse
            behind one control (remembered in localStorage) and the day reads
            top-down. Collapsed state still names what is inside, so the
            disclosure is honest rather than a hidden drawer. */}
        {(isVisible('ai-usage') || isVisible('console-widget') || isVisible('finance-widget')
          || isVisible('learn-widget') || isVisible('browser-widget') || isVisible('brain-widget')
          || isVisible('covenant-widget') || isVisible('health-widget')) && (
          <div className="mt-4">
            <button
              onClick={() => setSignalsOpen(v => !v)}
              aria-expanded={signalsOpen}
              className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60"
            >
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--page-accent)]/80">Signals</h2>
              <span className="h-px flex-1 bg-[var(--border-subtle)] group-hover:bg-[var(--page-accent)]/30 transition-colors" aria-hidden="true" />
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] group-hover:text-[var(--page-accent)] transition-colors">
                {[
                  isVisible('ai-usage') && 'AI',
                  isVisible('console-widget') && 'Console',
                  isVisible('finance-widget') && 'Finance',
                  isVisible('learn-widget') && 'Learn',
                  isVisible('browser-widget') && 'Browser',
                  isVisible('brain-widget') && 'Brain',
                  isVisible('covenant-widget') && 'Covenant',
                  isVisible('health-widget') && 'Health',
                ].filter(Boolean).join(' · ')}
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${signalsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </span>
            </button>

            {signalsOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
            {isVisible('ai-usage') && (
              <AiUsageWidget usage={widgetData?.aiUsage} />
            )}
            {isVisible('console-widget') && (
              <ConsoleWidget stats={widgetData?.consoleStats} />
            )}
            {isVisible('finance-widget') && (
              <FinanceWidget summary={widgetData?.financeSummary} />
            )}
            {isVisible('learn-widget') && (
              <LearnWidget stats={widgetData?.learnStats} />
            )}
            {isVisible('browser-widget') && (
              <BrowserWidget stats={widgetData?.browserStats} />
            )}
            {isVisible('brain-widget') && (
              <BrainWidget stats={widgetData?.brainStats} />
            )}
            {isVisible('covenant-widget') && (
              <CovenantWidget stats={widgetData?.covenantStats} />
            )}
            {isVisible('health-widget') && (
              <HealthWidget stats={widgetData?.sleepStats} />
            )}
              </div>
            )}
          </div>
        )}

      {/* ── Library-only opt-in widgets ──────────────────────────────────────
          These 8 have no default row. They render ONLY when switched on from the
          Card Library, so the dashboard never shows anything uninvited. */}
      {(isVisible('daily-survey') || isVisible('unified-goals') || isVisible('streak')
        || isVisible('schedule-sync') || isVisible('drilldown') || isVisible('spotlight')
        || isVisible('momentum-orb') || isVisible('momentum-score')) && (
        <div className="grid grid-cols-12 gap-4 w-full">
          {isVisible('daily-survey') && (
            <div className="col-span-12 md:col-span-6 lg:col-span-4">
              <DailySurveyCard goals={goals} />
            </div>
          )}

          {isVisible('unified-goals') && (
            <div className="col-span-12 lg:col-span-8">
              <UnifiedGoalsCard
                goals={goals}
                longTermGoals={longTermGoals}
                schedule={schedule}
                onToggle={() => {}}
                onAdd={() => {}}
                onDelete={() => {}}
                onUpdate={() => {}}
                onGenerate={() => {}}
                onAcceptSuggestion={() => {}}
                onDismissSuggestion={() => {}}
                suggestions={suggestions ?? []}
              />
            </div>
          )}

          {isVisible('streak') && (
            <div className="col-span-12 md:col-span-6 lg:col-span-4">
              <StreakCard goals={goals} />
            </div>
          )}

          {isVisible('schedule-sync') && (
            <div className="col-span-12 lg:col-span-8">
              <ScheduleSyncCard schedule={schedule} goals={goals} />
            </div>
          )}

          {isVisible('drilldown') && (
            <div className="col-span-12 md:col-span-6 lg:col-span-4">
              <DrillDownCard
                kind="heatmap"
                title="Activity Heatmap"
                subtitle="Where your time went"
                onView={() => setExpandedModal('heatmap')}
              />
            </div>
          )}

          {isVisible('spotlight') && (
            <div className="col-span-12 md:col-span-6 lg:col-span-4">
              <SpotlightCard>
                <div className="p-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Spotlight</div>
                  <div className="mt-1 text-sm text-[var(--text-primary)]">Pin a card here to keep it in view.</div>
                </div>
              </SpotlightCard>
            </div>
          )}

          {isVisible('momentum-orb') && (
            <div className="col-span-12 md:col-span-6 lg:col-span-4 flex justify-center py-2">
              <MomentumOrb momentum={productivityScore ?? 0} streak={streak ?? 0} />
            </div>
          )}

          {isVisible('momentum-score') && (
            <div className="col-span-12 md:col-span-6 lg:col-span-4">
              <MomentumScore
                goals={goals}
                focusTimeMs={(dashboardData?.overview?.productiveSeconds || 0) * 1000}
              />
            </div>
          )}
        </div>
      )}

      {/* Productivity heatmap — full surface, own week cursor, own selection state. */}
      <ProductivityHeatmap
        open={expandedModal === 'heatmap'}
        onClose={() => setExpandedModal(null)}
        cells={heatmapData}
        weekOffset={weekOffset}
        onWeekOffsetChange={setWeekOffset}
        weekLabel={heatmapWeekLabel}
        mode={heatmapMode}
        onModeChange={setHeatmapMode}
        onDayClick={openHeatmapDay}
        getAppColor={(app) => appColors[app]}
        isLoading={!logsLoaded}
      />

      <Suspense fallback={null}>
        {dayDetailDate && (
          <DayDetailPopup
            date={dayDetailDate}
            items={dayDetailItems}
            isLoading={dayDetailLoading}
            // The page's own tier resolver, so a day uses exactly the same
            // productive/neutral/distracting assignments as the heatmap cells.
            getTier={getTierFromCategory}
            onClose={() => { setDayDetailDate(null); setDayDetailItems([]); setDayDetailLoading(false); }}
            onDateChange={(newDate) => {
              setDayDetailDate(newDate);
              if (!window.deskflowAPI?.getDayDetail) return;
              setDayDetailLoading(true);
              window.deskflowAPI.getDayDetail(newDate)
                .then(detail => {
                  if (detail) setDayDetailItems(buildDayTimelineItems(detail));
                })
                .catch(err => console.error('[Dashboard] getDayDetail failed:', err))
                .finally(() => setDayDetailLoading(false));
            }}
          />
        )}
      </Suspense>

      <AnimatePresence>
        {expandedModal === 'solar' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setExpandedModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={solarFullscreen ? "fixed inset-0 z-50 bg-black flex flex-col" : "relative rounded-xl p-5 border max-w-7xl w-full max-h-[90vh] overflow-hidden light:bg-white light:border-[var(--ws-border-strong)]"}
              onClick={(e) => e.stopPropagation()}>
              {!solarFullscreen && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/30 via-indigo-500/10 to-transparent" />}
              <div className={`flex items-center justify-between px-4 pt-4 ${solarFullscreen ? '' : 'mb-4'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold light:text-[var(--text-primary)]">App Ecosystem</h2>
                    <p className="text-[11px] light:text-[var(--text-muted)]">Your top tools in orbit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSolarFullscreenWithEvent(!solarFullscreen)} className="p-2 hover:bg-zinc-800/60 rounded-lg transition-colors duration-150 border border-transparent hover:border-zinc-700/50 light:hover:bg-[var(--ws-surface-hover)] light:hover:border-[var(--ws-border)]"
                    title={solarFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                    {solarFullscreen ? <Minimize2 className="w-5 h-5 light:text-[var(--text-muted)]" /> : <Maximize2 className="w-5 h-5 text-zinc-400" />}
                  </button>
                  <button onClick={() => { setExpandedModal(null); setSolarFullscreenWithEvent(false); }} className="p-2 hover:bg-red-900/50 rounded-lg transition-colors duration-150 border border-transparent hover:border-red-500/30" title="Close">
                    <X className="w-5 h-5 light:text-[var(--text-muted)]" />
                  </button>
                </div>
              </div>
              <ErrorBoundary>
              <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingState variant="spinner" /></div>}>
                <div className={solarFullscreen ? 'w-full h-screen' : 'h-[500px] w-full'}>
                  <OrbitSystem logs={orbitLogs} websiteLogs={orbitWebsiteLogs} appColors={appColors} categoryOverrides={categoryOverrides} selectedPeriod={selectedPeriod}
                    onPeriodChange={(p) => { onSelectedPeriodChange?.(p as any); onDateOffsetChange?.(0); }} />
                </div>
              </Suspense>
              </ErrorBoundary>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>


      </PageShell>
  );
}
