import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef, type ReactNode } from 'react';
import { GlareHover } from '../components/ui/glare-hover';
import { PageShell } from '../components/PageShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useNavigate } from 'react-router-dom';
import { useScrollToSection } from '../lib/deepNav';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderStream } from '../lib/renderers/stream';
import { startPhaseClock } from '../lib/currentPhase';

import { SummaryStrip } from './dashboard/SummaryStrip';
import { PinnedActivities } from './dashboard/PinnedActivities';
import { QuickFocusCard } from '../components/focus/QuickFocusCard';
import { ScheduleCard } from './dashboard/ScheduleCard';
import { StatusBand } from './dashboard/StatusBand';
import { GoalsCard } from '../components/dashboard/GoalsCard';
import { DeadlinesCard } from '../components/dashboard/DeadlinesCard';
import { LongestFocusCard } from '../components/dashboard/LongestFocusCard';
import { useDashboardData } from '../components/dashboard/useDashboardData';
import { InsightStrip } from './dashboard/InsightStrip';
import { useSmartSearch } from '../hooks/useSmartSearch';
import type { SearchableSegment } from '../services/search/index';
import { MomentumHero } from '../components/dashboard/MomentumHero';
import { TierBreakdownStrip } from './dashboard/TierBreakdownStrip';



import { VCalendar } from '../components/ui/v-calendar';

import { SectionHeader } from '../components/SectionHeader';
import { GlassCard } from '../components/GlassCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { DayDetailPopup } from '../components/DayDetailPopup';
import { DeskFlowCardMotion } from '../components/dashboard/DeskFlowCard';
import OrbitSystem from '../components/OrbitSystem';
import { useHomeSummary } from '../hooks/useHomeSummary';
import { useDeepFocus } from '../hooks/useDeepFocus';
import { Bar, Line } from 'react-chartjs-2';
import { motion, AnimatePresence } from "motion/react";

import {
  BookOpen, Dumbbell, Activity,
  Utensils, Coffee, Bus, Book, Timer, Zap,
  Sun, Zap as ZapIcon, Focus, Clock, X,
  Edit3, Check, Plus, Minus, TrendingUp,
  Target, ZapCircle, RefreshCw, Clock3,
  ChevronLeft, ChevronRight, Maximize2, Minimize2,
  BarChart3, Bot, Sparkles, ArrowRight, GripVertical, MousePointer2, Zap as ZapIcon2
} from 'lucide-react';
import { maxOf, maxBy } from '../utils/safeMath';
import { getDateRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';
import { awaitApi } from '../lib/awaitApi';
import { TimerResetOverlay } from '../components/dashboard/TimerResetOverlay';

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
}




interface HeatmapCell {
  hour: number;
  day: number;
  value: number;
  productivity: number;
  deviceSeconds?: number;
  externalSeconds?: number;
  deviceBreakdown?: Record<string, { seconds: number; category: string }>;
  externalBreakdown?: Record<string, { seconds: number; color: string; icon: string }>;
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
}

interface ForegroundData {
  app?: string;
  title?: string;
  category?: string;
  tier?: 'productive' | 'neutral' | 'distracting';
  isReal?: boolean;
}


const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  'firefox': ['firefox'],
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
  hourlyHeatmap = [],
  solarSystemData = [],
  productiveTimeMs = 0,
  appColors = {},
  categoryOverrides = {},
  timerBehavior = { neutralAction: 'ignore', distractingAction: 'ignore' },
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
  onActivityFeedChange
}: DashboardPageProps) {
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

  const [currentProductiveMs, setCurrentProductiveMs] = useState(persistedTimer.productiveMs);
  const [currentDistractingMs, setCurrentDistractingMs] = useState(persistedTimer.distractingMs || 0);
  const [isPaused, setIsPaused] = useState(persistedTimer.paused);
  const [lastTier, setLastTier] = useState<'productive' | 'neutral' | 'distracting' | null>(persistedTimer.lastTier);
  // Display helpers — directly reflect the current app's tier, not timerBehavior settings
  const isCurrentlyProductive = lastTier === 'productive' && !isPaused;
  const isDistracting = lastTier === 'distracting' && !isPaused;

  // Distraction log — records which app/site broke the stopwatch
  const [distractions, setDistractions] = useState<Array<{ name: string; type: 'app' | 'website'; timestamp: number }>>([]);

  // Stopwatch refs - declared early to avoid TDZ issues
  const stopwatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopwatchAccumulatedRef = useRef(0); // tracks accumulated productive ms
  const distractingAccumulatedRef = useRef(0); // tracks accumulated distracting ms
  const stopwatchLastTickRef = useRef(0); // tracks last tick time
  const stopwatchActiveRef = useRef(false); // is timer actively running
  const stopwatchPausedRef = useRef(false); // is timer paused
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

  // ── Adaptive display time (hoisted: widgetData below reads displayTime) ──
  // Adaptive display: show what's actually running
  const displayTime = useMemo(() => {
    // External takes priority (user wants to see it when running)
    if (externalSessionRunning && externalElapsedMs > 0) {
      return { ms: externalElapsedMs, label: `External: ${selectedExternalActivity?.name || 'Running'}` };
    }

    // Distracting app — show distracting timer with app name
    if (lastTier === 'distracting' && !isPaused) {
      const appName = currentApp?.app || currentWebsite?.title || currentWebsite?.domain || 'Unknown';
      return { ms: currentDistractingMs, label: `Distracting: ${appName}` };
    }

    // Productive app — show productive timer
    if (lastTier === 'productive' && !isPaused) {
      return { ms: currentProductiveMs, label: 'Productive' };
    }

    // Neutral/idle — show whichever timer was last active
    return { ms: currentProductiveMs, label: isPaused ? 'Paused' : 'Idle' };
  }, [externalSessionRunning, externalElapsedMs, currentProductiveMs, currentDistractingMs, selectedExternalActivity, lastTier, isPaused, currentApp, currentWebsite]);

  // ── Widget Data (collected for widget system) ──
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
    aiInsights,
    momentum: null,
    unfilledMinutes: 0,
    gapCount: 0,
    loading: dashLoading,
    error: dashError,
  }), [goals, longTermGoals, suggestions, dashboardInsights, streak, productivityScore,
       deadlines, reminders, schedule, dashboardData, activityFeed, isPaused,
       isCurrentlyProductive, isDistracting, displayTime, currentApp, currentWebsite,
       isInBrowser, masteryMastered, masteryTotal,
       aiInsights, dashLoading, dashError]);

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
        console.log('[FROZEN-DBG] Dashboard fetch START period=', fetchPeriod, 'dateOffset=', dateOffset, 'weekOffset=', weekOffset);
        const t0 = performance.now();
        const data = await api.getDashboardAggregates({
          period: fetchPeriod,
          dateOffset,
          weekOffset,
          platform: platformFilter === 'all' ? undefined : platformFilter,
        });
        if (cancelled) return;
        if (thisReq !== fetchReqId.current) return;
        const t1 = performance.now();
        console.log('[FROZEN-DBG] Dashboard fetch DONE in', Math.round(t1 - t0), 'ms');
        if (data.error) { console.error('[Dashboard] Aggregate error:', data.error); return; }
        api.terminalLog?.('[FROZEN-DBG] Dashboard data received, setting state');
        setDashboardData(data);

        // Compute productivity score, streak, best day
        if (data?.overview) {
          const total = data.overview.totalSeconds || 1;
          const prod = data.overview.productiveSeconds || 0;
          setProductivityScore(Math.round((prod / total) * 100));
        }
        if (data?.weeklyHeatmap) {
          // Streak: consecutive days with productive time > 30min
          let s = 0;
          const today = new Date();
          for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayData = data.weeklyHeatmap.find((w: any) => w.date === dateStr);
            if (dayData && dayData.productiveHours > 0.5) s++;
            else break;
          }
          setStreak(s);

          // Best day of week
          const dayTotals: Record<string, number> = {};
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          data.weeklyHeatmap.forEach((w: any) => {
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
  }, [fetchPeriod, dateOffset, weekOffset]);

  // Fetch longest focus data
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
    })();
    return () => { cancelled = true; };
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

  // Sync weekOffset for heatmap when selectedPeriod changes
  useEffect(() => {
    setWeekOffset(0);
  }, [selectedPeriod]);

  // Persist timer state to parent and localStorage
  useEffect(() => {
    const newState = {
      productiveMs: currentProductiveMs,
      distractingMs: currentDistractingMs,
      startTime: stopwatchLastTickRef.current || Date.now(),
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

  const [resetCount, setResetCount] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);
  // (currentApp/isInBrowser/currentWebsite hoisted above widgetData)
  const [lastNonBrowserApp, setLastNonBrowserApp] = useState<ForegroundData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; value: number; productivity: number; deviceSeconds?: number; externalSeconds?: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<'device' | 'external' | 'combined'>('combined');
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
    for (let h = 0; h < 24; h++) {
      const cell = (dayHours as any)[h];
      if (!cell) continue;
      totalProd += (cell.productive || 0);
      totalNonProd += (cell.neutral || 0) + (cell.distracting || 0);
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
        return {
          productiveSeconds: bar.productiveHours * 3600,
          nonProductiveSeconds: (bar.neutralHours + bar.distractingHours) * 3600,
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
          const cell = (todayHours as any)[h];
          const totalSec = cell ? ((cell.appSeconds || 0) + (cell.domainSeconds || 0)) : 0;
          const prodSec = cell ? (cell.productive || 0) : 0;
          const nonProdSec = totalSec - prodSec;
          const extSec = chartExternalData.get(`${h}`) || 0;
          const totalWithExt = prodSec + nonProdSec + extSec;
          let finalProd = prodSec, finalNonProd = nonProdSec, finalExt = extSec;
          if (totalWithExt > 3600) {
            const scale = 3600 / totalWithExt;
            finalProd = Math.round(prodSec * scale);
            finalNonProd = Math.round(nonProdSec * scale);
            finalExt = Math.round(extSec * scale);
          }
          bars.push({
            label: h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`,
            productiveSeconds: finalProd,
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

  // Count resets today
  useEffect(() => {
    const count = activityFeed.filter(item =>
      item.tier === 'distracting' &&
      new Date(item.timestamp).toDateString() === new Date().toDateString()
    ).length;
    setResetCount(count);
  }, [activityFeed]);

  // Determine tier from category
  const getTierFromCategory = (category?: string): 'productive' | 'neutral' | 'distracting' => {
    if (!category) return 'neutral';
    const tiers = tierAssignments || DEFAULT_TIER_ASSIGNMENTS;
    if (tiers.productive.includes(category)) return 'productive';
    if (tiers.distracting.includes(category)) return 'distracting';
    return 'neutral';
  };

  // Refs for values the foreground listener needs without stale closures
  const trackingBrowserRef = useRef(trackingBrowser);
  const trackingBrowsersRef = useRef(trackingBrowsers);
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
      const isTrackingBrowser = !!tb && !!data.app && isAppMatchingBrowserDashboard(data.app, trackingBrowsersRef.current.length > 0 ? trackingBrowsersRef.current : tb);

      // Check if this is Tracker app (DeskFlow/Electron/RHEO)
      const isTrackerApp = data.app && (
        data.app.toLowerCase().includes('deskflow') ||
        data.app.toLowerCase().includes('electron') ||
        data.app.toLowerCase().includes('rheo')
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
        setCurrentWebsite(null);
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
      setCurrentWebsite(null);

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

        const isTrackingBrowser = !!tb && !!(initialData.app) && isAppMatchingBrowserDashboard(initialData.app, trackingBrowsersRef.current.length > 0 ? trackingBrowsersRef.current : tb);
        const isTrackerApp = !!(initialData.app) && (initialData.app.toLowerCase().includes('deskflow') || initialData.app.toLowerCase().includes('electron') || initialData.app.toLowerCase().includes('rheo'));

        if (isTrackingBrowser) { setIsInBrowser(true); setCurrentApp(lnb || null); return; }

        if (isTrackerApp) {
          if (tam === 'show-other') { return; }
          else if (tam === 'pause') { setIsPaused(true); setPausedByTrackerApp(true); return; }
        }
        setIsInBrowser(false);
        setCurrentWebsite(null);

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
        const isTrackingBrowser = !!tb && isAppMatchingBrowserDashboard(data.app, trackingBrowsersRef.current.length > 0 ? trackingBrowsersRef.current : tb);
        const isTrackerApp = data.app.toLowerCase().includes('deskflow') || data.app.toLowerCase().includes('electron') || data.app.toLowerCase().includes('rheo');

        if (isTrackerApp) return; // don't overwrite with tracker app
        if (isTrackingBrowser) {
          setIsInBrowser(true);
          return;
        }
        // A real non-browser app is foreground — make sure we're NOT stuck in website mode.
        // (Previously this only refreshed currentApp; a stale isInBrowser/currentWebsite would
        // keep the dashboard showing the last website instead of the real app.)
        setIsInBrowser(false);
        setCurrentWebsite(null);
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
    const tier = getTierFromCategory(currentCategory || '');
    const prevTier = prevTierRef.current;

    // Tier transition: reset the OUTGOING tier's timer when switching productive ↔ distracting
    if (prevTier && prevTier !== tier) {
      const switchingProductiveToDistracting = prevTier === 'productive' && tier === 'distracting';
      const switchingDistractingToProductive = prevTier === 'distracting' && tier === 'productive';

      if (switchingProductiveToDistracting) {
        console.log(`[Dashboard] Stopwatch: RESET productive (productive → distracting)`);
        stopwatchAccumulatedRef.current = 0;
        setCurrentProductiveMs(0);
        setResetTrigger(prev => prev + 1);
      } else if (switchingDistractingToProductive) {
        console.log(`[Dashboard] Stopwatch: RESET distracting (distracting → productive)`);
        distractingAccumulatedRef.current = 0;
        setCurrentDistractingMs(0);
        setResetTrigger(prev => prev + 1);
      }
      stopwatchLastTickRef.current = Date.now();
    }
    prevTierRef.current = tier;

    // Clear existing timer
    if (stopwatchTimerRef.current) {
      clearInterval(stopwatchTimerRef.current);
      stopwatchTimerRef.current = null;
    }

    const isExternal = externalSessionRunning && externalSessionStart;

    // Only accumulate when there's a real app to track (or external session)
    const hasRealApp = !!currentApp?.app || (isInBrowser && !!currentWebsite?.domain);

    // Always accumulate when there's a real app — tier only affects labeling/color, not whether timer runs.
    // Neutral apps no longer pause the stopwatch.
    const shouldAccumulate = !isPaused && (hasRealApp || isExternal);
    const shouldPause = isPaused || (!shouldAccumulate && hasRealApp && !isExternal);

    // Handle pause
    if (shouldPause) {
      console.log(`[Dashboard] Stopwatch: PAUSED (tier=${tier}, isPaused=${isPaused})`);
      stopwatchActiveRef.current = false;
      stopwatchPausedRef.current = true;
      return;
    }

    // Resume or start timer
    const now = Date.now();
    if (!stopwatchActiveRef.current) {
      stopwatchLastTickRef.current = now;
      stopwatchActiveRef.current = true;
      stopwatchPausedRef.current = false;
    }

    if (shouldAccumulate || isExternal) {
      const accMs = tier === 'distracting' ? distractingAccumulatedRef.current : stopwatchAccumulatedRef.current;
      console.log(`[Dashboard] Stopwatch: timer RUNNING (tier: ${tier}, accumulated: ${Math.floor(accMs / 1000)}s)`);
    }

    stopwatchTimerRef.current = setInterval(() => {
      const tickNow = Date.now();
      // Don't accumulate during idle periods (no interaction for 5+ minutes)
      if (tickNow - lastInteractionRef.current > 300000) {
        stopwatchLastTickRef.current = tickNow;
        return;
      }
      const delta = tickNow - stopwatchLastTickRef.current;
      stopwatchLastTickRef.current = tickNow;

      if (isExternal) {
        setExternalElapsedMs(prev => prev + delta);
      } else if (shouldAccumulate) {
        if (tier === 'distracting') {
          distractingAccumulatedRef.current += delta;
          setCurrentDistractingMs(distractingAccumulatedRef.current);
        } else {
          stopwatchAccumulatedRef.current += delta;
          setCurrentProductiveMs(stopwatchAccumulatedRef.current);
        }
      }
    }, 1000);

    return () => {
      if (stopwatchTimerRef.current) {
        clearInterval(stopwatchTimerRef.current);
        stopwatchTimerRef.current = null;
      }
    };
  }, [currentApp, currentWebsite, isInBrowser, lastNonBrowserApp, isPaused, externalSessionRunning, externalSessionStart, timerBehavior]);

  // Track and save productivity sessions — respects timerBehavior settings
  useEffect(() => {
    const currentCategory = isInBrowser
      ? (currentWebsite?.category || lastNonBrowserApp?.category)
      : currentApp?.category;
    const tier = getTierFromCategory(currentCategory || '');
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
  useEffect(() => {
    if (window.deskflowAPI?.getLogs) {
      window.deskflowAPI.getLogs().then((logs: any[]) => {
        const formatted = logs.map(l => ({
          timestamp: new Date(l.timestamp),
          app: l.app,
          is_browser_tracking: l.is_browser_tracking === 1 || l.is_browser_tracking === true,
          domain: l.domain,
          duration_ms: l.duration_ms,
        }));
        setAllLogs(formatted);
      }).catch(e => console.warn('[Dashboard] Failed to load all logs', e));
    }
  }, []);

  // Compute heatmap data for the selected week (respecting weekOffset)
  const heatmapData = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + weekOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const cellMap = new Map<string, { seconds: number; productive: number; appBreakdown: Record<string, { seconds: number; category: string }>; appSeconds: number; domainSeconds: number }>();
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        cellMap.set(`${d}-${h}`, { seconds: 0, productive: 0, appBreakdown: {}, appSeconds: 0, domainSeconds: 0 });
      }
    }

    allLogs.forEach(log => {
      const ts = new Date(log.timestamp);
      if (ts < weekStart || ts >= weekEnd) return;
      const day = ts.getDay();
      const hour = ts.getHours();
      const key = `${day}-${hour}`;
      const entry = cellMap.get(key);
      if (!entry) return;
      const secs = (log.duration_ms || 0) / 1000;
      entry.seconds += secs;
      entry.productive += secs;
      if (log.is_browser_tracking) {
        entry.domainSeconds += secs;
      } else {
        entry.appSeconds += secs;
        const appName = log.app;
        if (!entry.appBreakdown[appName]) {
          entry.appBreakdown[appName] = { seconds: 0, category: log.category || 'app' };
        }
        entry.appBreakdown[appName].seconds += secs;
      }
    });

    const result: HeatmapCell[] = [];
    cellMap.forEach((v, key) => {
      const [dayStr, hourStr] = key.split('-');
      const day = Number(dayStr);
      const hour = Number(hourStr);
      const productivity = v.appSeconds > 0 ? v.productive / v.appSeconds : 0;
      const extData = externalHourlyData.get(key);
      result.push({
        day,
        hour,
        value: v.appSeconds,
        productivity,
        deviceSeconds: v.appSeconds,
        externalSeconds: extData?.externalSeconds || 0,
        deviceBreakdown: v.appBreakdown,
        externalBreakdown: extData?.breakdown || {},
      });
    });
    return result;
  }, [allLogs, weekOffset, externalHourlyData]);

  const heatmapWeekLabel = useMemo(() => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    const targetWeekStart = new Date(currentWeekStart.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000));
    const targetWeekEnd = new Date(targetWeekStart.getTime() + (6 * 24 * 60 * 60 * 1000));
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(targetWeekStart)} - ${formatDate(targetWeekEnd)}`;
  }, [weekOffset]);

  const renderHeatmap = () => {
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    const getHeatColor = (cell: HeatmapCell | undefined) => {
      if (!cell) return 'var(--border)';

      let valueToUse = 0;
      let productivityToUse = 0;
      let isExternalOnly = false;
      let hasBoth = false;

      if (heatmapMode === 'device') {
        valueToUse = cell.deviceSeconds || cell.value || 0;
        productivityToUse = cell.productivity || 0;
      } else if (heatmapMode === 'external') {
        valueToUse = cell.externalSeconds || 0;
        productivityToUse = valueToUse > 0 ? 1 : 0;
        isExternalOnly = valueToUse > 0;
      } else {
        // Combined mode
        const hasExternal = (cell.externalSeconds || 0) > 0;
        const hasDevice = (cell.deviceSeconds || cell.value || 0) > 0;

        if (hasExternal && !hasDevice) {
          valueToUse = cell.externalSeconds || 0;
          productivityToUse = 1;
          isExternalOnly = true;
        } else if (!hasExternal && hasDevice) {
          valueToUse = cell.deviceSeconds || cell.value || 0;
          productivityToUse = cell.productivity || 0;
        } else {
          hasBoth = true;
          valueToUse = Math.max(cell.deviceSeconds || 0, cell.externalSeconds || 0);
          const deviceProd = cell.productivity || 0;
          const externalProd = (cell.externalSeconds || 0) > 0 ? 1 : 0;
          productivityToUse = (deviceProd + externalProd) / 2;
        }
      }

      if (valueToUse === 0) return 'var(--border)';

      // Intensity based on usage: max 1 hour = full opacity, more = saturated
      const maxSeconds = heatmapMode === 'external' ? 3600 : 7200; // External max 1h, device max 2h
      const intensity = Math.min(1, valueToUse / maxSeconds);
      const opacity = 0.2 + intensity * 0.8; // Range: 0.2 - 1.0

      // External color scheme (distinct purple)
      if (isExternalOnly || (heatmapMode === 'combined' && (cell.externalSeconds || 0) > (cell.deviceSeconds || 0))) {
        // Purple gradient: light purple = low usage, deep purple = high usage
        const r = Math.round(147 + (99 - 147) * intensity);
        const g = Math.round(51 + (102 - 51) * intensity);
        const b = Math.round(234 + (236 - 234) * intensity);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }

      // Device color scheme (red -> yellow -> green based on productivity)
      // Also used for "both" in combined mode
      const prod = Math.max(0, Math.min(1, productivityToUse));
      let r, g, b;

      if (hasBoth) {
        // "Both" mode: mix green (device) + purple (external) tints
        const deviceColor = prod < 0.5
          ? { r: 239 - (239 - 234) * prod * 2, g: 68 + (216 - 68) * prod * 2, b: 68 + (8 - 68) * prod * 2 }
          : { r: 234 + (34 - 234) * (prod - 0.5) * 2, g: 216 + (197 - 216) * (prod - 0.5) * 2, b: 8 + (94 - 8) * (prod - 0.5) * 2 };

        // Blend with purple (external) - 30% purple tint
        const purpleTint = 0.3;
        r = Math.round(deviceColor.r * (1 - purpleTint) + 99 * purpleTint);
        g = Math.round(deviceColor.g * (1 - purpleTint) + 102 * purpleTint);
        b = Math.round(deviceColor.b * (1 - purpleTint) + 236 * purpleTint);
      } else {
        // Pure device mode: red -> green gradient
        if (prod < 0.5) {
          r = Math.round(239 * (1 - prod * 2) + 234 * prod * 2);
          g = Math.round(68 * (1 - prod * 2) + 216 * prod * 2);
          b = Math.round(68 * (1 - prod * 2) + 8 * prod * 2);
        } else {
          r = Math.round(234 * (1 - (prod - 0.5) * 2) + 34 * (prod - 0.5) * 2);
          g = Math.round(216 * (1 - (prod - 0.5) * 2) + 197 * (prod - 0.5) * 2);
          b = Math.round(8 * (1 - (prod - 0.5) * 2) + 94 * (prod - 0.5) * 2);
        }
      }

      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${opacity})`;
    };

    const handleDayClick = (dayIdx: number) => {
      console.log('[Dashboard] Day clicked:', dayIdx, 'weekOffset:', weekOffset);
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      const targetWeekStart = new Date(currentWeekStart.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000));
      const targetDate = new Date(targetWeekStart);
      targetDate.setDate(targetDate.getDate() + dayIdx);
      const dateStr = targetDate.toISOString().split('T')[0];
      console.log('[Dashboard] Day click date:', dateStr);
      setSelectedCell(null);

      if (window.deskflowAPI?.getDayDetail) {
        window.deskflowAPI.getDayDetail(dateStr).then(detail => {
          if (!detail) return;
          const items: TimelineItem[] = [];

          // Transform logs into timeline items
          (detail.logs || []).forEach((log: any) => {
            const logDate = new Date(log.timestamp);
            const startHour = logDate.getHours() + logDate.getMinutes() / 60;
            const durationSec = (log.duration_ms || 0) / 1000;
            const endHour = startHour + durationSec / 3600;
            const isBrowser = log.is_browser_tracking;
            const label = isBrowser ? (log.domain || log.app) : log.app;
            items.push({
              id: `log-${log.id}`,
              startHour,
              endHour: Math.min(endHour, 24),
              label,
              category: isBrowser ? 'browser' : 'app',
              color: isBrowser ? 'var(--success)' : 'var(--info)',
              duration: Math.round(durationSec),
              details: log.title
            });
          });

          // Transform external sessions into timeline items
          (detail.externalSessions || []).forEach((session: any) => {
            const startDate = new Date(session.started_at);
            const endDate = session.ended_at ? new Date(session.ended_at) : new Date();
            const startHour = startDate.getHours() + startDate.getMinutes() / 60;
            const durationSec = (endDate.getTime() - startDate.getTime()) / 1000;
            const endHour = startHour + durationSec / 3600;
            items.push({
              id: `ext-${session.id}`,
              startHour,
              endHour: Math.min(endHour, 24),
              label: session.activity_name || 'External',
              category: 'external',
              color: session.color || 'var(--page-accent)',
              duration: Math.round(durationSec)
            });
          });

          items.sort((a, b) => a.startHour - b.startHour);
          setDayDetailDate(dateStr);
          setDayDetailItems(items);
        });
      }
    };

    return (
      <div className="relative w-full">
        <div className="overflow-x-auto">
          <div className="w-full bg-zinc-900/60 backdrop-blur-xl rounded-xl border border-zinc-800/50 p-5 light:bg-white/85 light:border-[var(--ws-border)]">
            <VCalendar
              selected={calendarDate}
              onSelect={(d) => { if (d && !Array.isArray(d)) setCalendarDate(d); }}
            />
            {/* Day Headers - aligned with grid */}
            <div className="flex items-center mb-3">
              <div className="w-14 flex-shrink-0"></div>
              <div className="flex-1 flex">
                {DAYS.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className={`flex-1 text-center text-sm font-semibold mx-px cursor-pointer hover:text-white transition ${dayIdx === currentDay ? 'text-emerald-400' : 'text-zinc-400'} light:text-[var(--text-secondary)]`}
                    onClick={() => handleDayClick(dayIdx)}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            {/* Mode Toggle - below day headers */}
            <div className="flex justify-end mb-3">
              <div className="flex bg-zinc-800 rounded-lg p-1 gap-1 light:bg-[var(--ws-surface-sunken)]">
                {(['device', 'external', 'combined'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setHeatmapMode(mode)}
                    className={`px-3 py-1.5 text-xs rounded-md transition capitalize ${heatmapMode === mode ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'} light:${heatmapMode === mode ? 'bg-white text-stone-900 border border-[var(--ws-border-strong)]' : 'text-stone-600 hover:text-stone-900'}`}
                  >
                    {mode === 'device' ? 'Device' : mode === 'external' ? 'External' : 'Combined'}
                  </button>
                ))}
              </div>
            </div>

            {Array.from({ length: 24 }, (_, hourIdx) => {
              const hourStr = hourIdx.toString().padStart(2, '0');
              return (
                <div key={hourIdx} className="flex items-center py-[1px]">
                  <div className={`w-10 flex-shrink-0 pr-1 text-[10px] font-mono text-right text-zinc-500 light:text-[var(--text-muted)]`}>
                    {hourStr}
                  </div>
                  {DAYS.map((_, dayIdx) => {
                    const actualHour = hourIdx;
                    const cell = heatmapData.find(c => c.day === dayIdx && c.hour === actualHour);
                    if (!cell) return <div key={dayIdx} className="flex-1 h-6 mx-px" />;

                    const bgColor = getHeatColor(cell);
                    const isToday = dayIdx === currentDay;
                    const isCurrentHour = actualHour === currentHour;

                    const rgbaMatch = bgColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
                    const glowRgb = rgbaMatch ? `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}` : '34, 197, 94';

                    return (
                      <motion.div
                        key={dayIdx}
                        className="flex-1 h-6 mx-px rounded-md cursor-pointer relative min-w-[28px]"
                        style={{
                          backgroundColor: bgColor,
                          boxShadow: (cell.deviceSeconds || cell.externalSeconds || 0) > 70 ? `0 0 12px rgba(${glowRgb}, 0.5)` : 'inset 0 0 2px rgba(255,255,255,0.08)'
                        }}
                        onClick={() => {
                          const sameCell = selectedCell?.day === dayIdx && selectedCell?.hour === actualHour;
                          setSelectedCell(sameCell ? null : { day: dayIdx, hour: actualHour });
                          setHoveredCell({
                            day: dayIdx,
                            hour: actualHour,
                            value: cell.value,
                            productivity: cell.productivity,
                            deviceSeconds: cell.deviceSeconds,
                            externalSeconds: cell.externalSeconds
                          });
                        }}
                        onMouseEnter={() => setHoveredCell({
                          day: dayIdx,
                          hour: actualHour,
                          value: cell.value,
                          productivity: cell.productivity,
                          deviceSeconds: cell.deviceSeconds,
                          externalSeconds: cell.externalSeconds
                        })}
                        onMouseLeave={() => setHoveredCell(null)}
                        whileHover={{ scale: 1.08, zIndex: 20 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      >
                        {isCurrentHour && isToday && (
                          <div className="absolute inset-0 rounded-md ring-2 ring-emerald-400 ring-offset-1 ring-offset-zinc-950" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover Tooltip */}
        <AnimatePresence>
          {hoveredCell && !selectedCell && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute glass px-4 py-2.5 rounded-xl border border-zinc-700 z-50 pointer-events-none light:bg-white light:border-[var(--ws-border-strong)]"
              style={{
                minWidth: '220px',
                left: '50%',
                transform: 'translateX(-50%)',
                top: `${(hoveredCell.hour * 26) + 50}px`
              }}
            >
              <div className="font-semibold text-white text-xs mb-2 light:text-stone-900">
                {DAYS[hoveredCell.day]} • {hoveredCell.hour.toString().padStart(2, '0')}:00 – {(hoveredCell.hour + 1).toString().padStart(2, '0')}:00
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-zinc-400 text-xs light:text-stone-500">Device:</span>
                  <span className="font-mono text-sm text-emerald-400 tabular-nums">
                    {formatDuration((hoveredCell.deviceSeconds || 0) * 1000)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-zinc-400 text-xs light:text-stone-500">External:</span>
                  <span className="font-mono text-sm text-purple-400 tabular-nums">
                    {formatDuration((hoveredCell.externalSeconds || 0) * 1000)}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click Detail Panel */}
        <AnimatePresence>
          {selectedCell !== null && (() => {
            const clickedCell = heatmapData.find(c => c.day === selectedCell.day && c.hour === selectedCell.hour);
            if (!clickedCell) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 20, height: 0 }}
                className="mt-6 p-4 rounded-xl border border-zinc-700 bg-zinc-900/30 space-y-4 light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-900"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">
                    {DAYS[clickedCell.day]} • {selectedCell.hour.toString().padStart(2, '0')}:00 – {(selectedCell.hour + 1).toString().padStart(2, '0')}:00
                  </div>
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="light:text-stone-500 light:hover:text-stone-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Device Column */}
                  <div className="space-y-3">
                    <div className="font-semibold text-emerald-400 text-sm flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                      Device Activity
                    </div>
                    {clickedCell.deviceSeconds === 0 ? (
                      <div className="text-xs light:text-stone-500 italic">No device activity this hour</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="light:text-stone-500">Total Time:</span>
                          <span className="font-mono text-emerald-400">{formatDuration((clickedCell.deviceSeconds || 0) * 1000)}</span>
                        </div>
                        {(() => {
                          const breakdown = clickedCell.deviceBreakdown || {};
                          const apps = Object.entries(breakdown).sort((a, b) => b[1].seconds - a[1].seconds);
                          return apps.length > 0 ? (
                            <div className="space-y-1 border-t border-zinc-700 pt-2 mt-2 light:border-[var(--ws-border)]">
                              {apps.map(([app, data]) => (
                                <div key={app} className="flex items-baseline justify-between text-xs">
                                  <span className="text-zinc-400 truncate flex items-center gap-1 light:text-stone-500">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: appColors[app] || 'var(--muted-foreground)' }} />
                                    {app}:
                                  </span>
                                  <span className="font-mono text-emerald-400 ml-2 flex-shrink-0">{formatDuration(data.seconds * 1000)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* External Column */}
                  <div className="space-y-3">
                    <div className="font-semibold text-purple-400 text-sm flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-400" />
                      External Activity
                    </div>
                    {clickedCell.externalSeconds === 0 ? (
                      <div className="text-xs light:text-stone-500 italic">No external activity this hour</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="light:text-stone-500">Total Time:</span>
                          <span className="font-mono text-purple-400">{formatDuration((clickedCell.externalSeconds || 0) * 1000)}</span>
                        </div>
                        {(() => {
                          const breakdown = clickedCell.externalBreakdown || {};
                          const activities = Object.entries(breakdown).sort((a, b) => b[1].seconds - a[1].seconds);

                          return activities.length > 0 ? (
                            <div className="space-y-1 border-t border-zinc-700 pt-2 mt-2">
                                {activities.map(([activity, data]) => (
                                  <div key={activity} className="flex items-baseline justify-between text-xs">
                                    <span className="text-zinc-400 truncate flex items-center gap-1 light:text-stone-500">
                                    {data.icon || '?'} {activity}:
                                  </span>
                                  <span className="font-mono text-purple-300 ml-2 flex-shrink-0">{formatDuration(data.seconds * 1000)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    );
  };

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
  const orbitLogs = useMemo(() => {
    if (!dashboardData?.appStats) return [];
    return dashboardData.appStats.map((s: any, i: number) => ({
      id: i,
      timestamp: new Date(),
      app: s.app || s.app_name || '',
      category: s.category || 'Other',
      duration: Math.round(s.totalSeconds || 0),
    })).filter((l: any) => l.app);
  }, [dashboardData?.appStats]);

  const orbitWebsiteLogs = useMemo(() => {
    if (!dashboardData?.websiteStats) return [];
    return dashboardData.websiteStats.map((s: any, i: number) => ({
      id: i,
      timestamp: new Date(),
      app: s.domain || s.app_name || '',
      category: s.category || 'Other',
      duration: Math.round(s.totalSeconds || 0),
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
    <PageShell page="dashboard" variant="dashboard" className="text-white">
      <CurrentCanvas accent="#34d399" render={renderStream} />
      <TimerResetOverlay trigger={resetTrigger} />

      {/* Platform Filter Toggle */}
      {availablePlatforms.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-medium">OS</span>
          <button
            onClick={() => setPlatformFilter('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              platformFilter === 'all'
                ? 'border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            All
          </button>
          {availablePlatforms.map(p => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                platformFilter === p
                  ? 'border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {p === 'win32' ? 'Windows' : p === 'darwin' ? 'macOS' : p}
            </button>
          ))}
        </div>
      )}
<div className="relative z-10">
        <div className="mx-auto px-5" style={{ maxWidth: '1400px' }}>

          {/* Row 1: HeroBand (Stopwatch) + Momentum Hero */}
           {(isCardVisible('status-band') || isCardVisible('momentum-hero')) && (
           <DeskFlowCardMotion className="mb-4">
           <div className="grid grid-cols-1 md:grid-cols-[5fr_3fr] gap-0 items-stretch">
              {isCardVisible('status-band') && (
              <div data-section="Hero">
              <StatusBand
                displayTimeMs={displayTime?.ms || 0}
                isCurrentlyProductive={isCurrentlyProductive}
                isDistracting={isDistracting}
                currentAppName={isInBrowser
                  ? (currentWebsite?.title || currentWebsite?.domain || '')
                  : (currentApp?.app || currentApp?.title || '')}
                isReal={currentApp?.isReal}
                totalFocusedMs={(dashboardData?.overview?.productiveSeconds || 0) * 1000}
                browserName={currentWebsite?.browserName}
                isInBrowser={isInBrowser}
                isPaused={isPaused}
                websiteTitle={currentWebsite?.title}
                websiteDomain={currentWebsite?.domain}
                websiteCategory={currentWebsite?.category}
              />
              </div>
              )}
             {isCardVisible('momentum-hero') && (
             <div data-section="Momentum Hero">
             <MomentumHero momentum={momentum} loading={dashLoading} />
             </div>
             )}
           </div>
           </DeskFlowCardMotion>
           )}

          {/* Row 2: Tier Breakdown Strip */}
          {isCardVisible('tier-breakdown') && (
          <DeskFlowCardMotion className="mb-4">
           <div data-section="Tier Breakdown">
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
          {isCardVisible('pinned-activities') && (
          <DeskFlowCardMotion className="mb-4">
            <div data-section="Pinned">
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

            {/* Row 4: Quadruple Column — Goals + Deadlines + Focus + Longest Focus */}
            {(isCardVisible('goals-card') || isCardVisible('focus-card') || isCardVisible('deadlines-card')) && (
            <DeskFlowCardMotion className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1 min-h-0">
                 {isCardVisible('goals-card') && (
                 <div data-section="Goals Card">
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
                 {isCardVisible('focus-card') && (
                 <div data-section="Focus Start">
                 <QuickFocusCard
                   state={deepFocus.state}
                   onStart={deepFocus.start}
                   onEnd={deepFocus.end}
                 />
                 </div>
                 )}
                 {isCardVisible('deadlines-card') && (
                 <div data-section="Deadlines Card">
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
              {isCardVisible('focus-card') && (
              <div data-section="Longest Focus">
               <LongestFocusCard data={longestFocus} loading={longestFocusLoading} />
              </div>
              )}
              </div>
            </DeskFlowCardMotion>
            )}

            {/* Row 5: Schedule */}
            {isCardVisible('schedule-hero') && (
            <DeskFlowCardMotion className="mb-4">
               <div data-section="Schedule">
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
            {isCardVisible('insight-strip') && (
            <DeskFlowCardMotion className="mb-4">
            <div data-section="Insight Strip">
            <InsightStrip insights={aiInsights} />
            </div>
            </DeskFlowCardMotion>
            )}

           {/* Row 6: Productivity Chart */}
           {isCardVisible('productivity-chart') && (
             <DeskFlowCardMotion className="mb-4">
             <div className="p-5">
               <div>
               <SectionHeader title="Productivity" icon={<BarChart3 size={14} />} />
               <div className="h-52 mt-2">
                 {chartBarsResult.chartBars.length === 0 ? (
                   <EmptyState icon={<BarChart3 className="w-8 h-8 opacity-30" />} title="No data yet" description="Start tracking to see productivity" />
                 ) : (
                   <Bar data={{
                     labels: chartBarsResult.chartBars.map(b => b.label),
                     datasets: [
                       {
                         label: 'Productive',
                         data: chartBarsResult.chartBars.map(b => Math.round(b.productiveSeconds / 3600 * 100) / 100),
                         backgroundColor: '#34d399',
                         borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7
                       },
                       {
                         label: 'Other',
                         data: chartBarsResult.chartBars.map(b => Math.round(b.nonProductiveSeconds / 3600 * 100) / 100),
                         backgroundColor: '#fbbf24',
                         borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7
                       },
                       {
                         label: 'External',
                         data: chartBarsResult.chartBars.map(b => Math.round(b.externalSeconds / 3600 * 100) / 100),
                         backgroundColor: '#38bdf8',
                         borderRadius: 6, borderSkipped: false, barPercentage: 0.6, categoryPercentage: 0.7
                       },
                     ],
                   }} options={{
                     responsive: true, maintainAspectRatio: false,
                     plugins: { legend: { display: false }, tooltip: { backgroundColor: '#18181b', titleColor: '#fafafa', bodyColor: '#a1a1aa', borderColor: '#3f3f46', borderWidth: 1, cornerRadius: 8, padding: 10 } },
                     scales: { x: { stacked: true, grid: { display: false }, ticks: { color: '#71717a', font: { size: 11 } } }, y: { stacked: true, grid: { color: '#27272a' }, ticks: { color: '#71717a', font: { size: 11 } } } },
                   }} />
                 )}
               </div>
               {/* Custom Legend */}
               <div className="flex items-center gap-4 mt-4 text-[11px] text-[var(--text-muted)]">
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--success)' }}></span> Productive
                 </div>
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--warning)' }}></span> Other
                 </div>
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--info)' }}></span> External
                 </div>
               </div>
               <div className="flex gap-3 mt-4">
                 <button onClick={() => setExpandedModal('heatmap')}
                   className="flex-1 py-2.5 rounded-lg text-[12px] font-medium light:text-stone-500 border border-[var(--ws-border)] hover:border-pink-500/50 hover:text-pink-400 transition-all duration-200">
                   View Heatmap
                 </button>
                 <button onClick={() => setExpandedModal('solar')}
                   className="flex-1 py-2.5 rounded-lg text-[12px] font-medium light:text-stone-500 border border-[var(--ws-border)] hover:border-indigo-500/50 hover:text-indigo-400 transition-all duration-200">
                   View Solar System
                 </button>
               </div>
               </div>
             </div>
             </DeskFlowCardMotion>
           )}

          {/* Row 7: Activity Feed */}
          {isCardVisible('activity-feed') && (
          <DeskFlowCardMotion className="mb-4">
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
                       className="flex items-center justify-between p-3 rounded-lg border border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                     >
                       <div className="flex items-center gap-3 min-w-0">
                         <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                           item.tier === 'productive' ? 'bg-[var(--success)]' :
                           item.tier === 'distracting' ? 'bg-[var(--error)]' :
                           'bg-[var(--warning)]'
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
      {/* Modals — UNCHANGED */}
      <AnimatePresence>
        {expandedModal === 'heatmap' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setExpandedModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative rounded-xl p-5 border max-w-4xl w-full max-h-[90vh] overflow-auto bg-zinc-900/95 backdrop-blur-xl border-zinc-800/60 light:bg-white light:border-[var(--ws-border-strong)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-pink-500/30 via-pink-500/10 to-transparent" />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-pink-400" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-zinc-100 light:text-stone-900">Activity Heatmap</h2>
                    <p className="text-[11px] text-zinc-500 light:text-stone-500">{heatmapWeekLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/80 text-zinc-400 hover:text-white transition-all duration-150 border border-zinc-700/30 hover:border-zinc-600/60 light:bg-white light:text-stone-900 light:hover:bg-stone-100 light:border-[var(--ws-border)]" title="Previous week">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setWeekOffset(0)} className="px-2 py-1 text-xs text-zinc-400 hover:text-white transition-all duration-150 rounded hover:bg-zinc-800/40 light:text-stone-900 light:hover:bg-stone-100">Today</button>
                  <button onClick={() => setWeekOffset(w => Math.min(w + 1, 0))} disabled={weekOffset >= 0}
                    className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/80 text-zinc-400 hover:text-white transition-all duration-150 border border-zinc-700/30 hover:border-zinc-600/60 disabled:opacity-30 disabled:cursor-not-allowed light:bg-white light:text-stone-900 light:hover:bg-stone-100 light:border-[var(--ws-border)] light:disabled:opacity-30 light:disabled:cursor-not-allowed" title="Next week">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => setExpandedModal(null)} className="p-2 hover:bg-zinc-800/60 rounded-lg transition-all duration-150 border border-transparent hover:border-zinc-700/50 ml-2 light:hover:bg-stone-100 light:hover:border-[var(--ws-border)]">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              </div>
              {renderHeatmap()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        {dayDetailDate && (
          <DayDetailPopup date={dayDetailDate} items={dayDetailItems}
            onClose={() => { setDayDetailDate(null); setDayDetailItems([]); }}
            onDateChange={(newDate) => {
              setDayDetailDate(newDate);
              if (window.deskflowAPI?.getDayDetail) {
                window.deskflowAPI.getDayDetail(newDate).then(detail => {
                  if (!detail) return;
                  const newItems: TimelineItem[] = [];
                  (detail.logs || []).forEach((log: any) => {
                    const logDate = new Date(log.timestamp);
                    const startHour = logDate.getHours() + logDate.getMinutes() / 60;
                    const durationSec = (log.duration_ms || 0) / 1000;
                    const endHour = startHour + durationSec / 3600;
                    const isBrowser = log.is_browser_tracking;
                    const label = isBrowser ? (log.domain || log.app) : log.app;
                    newItems.push({ id: `log-${log.id}`, startHour, endHour: Math.min(endHour, 24), label, category: isBrowser ? 'browser' : 'app', color: isBrowser ? 'var(--success)' : 'var(--info)', duration: Math.round(durationSec), details: log.title });
                  });
                  (detail.externalSessions || []).forEach((session: any) => {
                    const startDate = new Date(session.started_at);
                    const endDate = session.ended_at ? new Date(session.ended_at) : new Date();
                    const sHour = startDate.getHours() + startDate.getMinutes() / 60;
                    const durSec = (endDate.getTime() - startDate.getTime()) / 1000;
                    const eHour = sHour + durSec / 3600;
                    newItems.push({ id: `ext-${session.id}`, startHour: sHour, endHour: Math.min(eHour, 24), label: session.activity_name || 'External', category: 'external', color: session.color || 'var(--page-accent)', duration: Math.round(durSec) });
                  });
                  newItems.sort((a, b) => a.startHour - b.startHour);
                  setDayDetailItems(newItems);
                });
              }
            }} />
        )}
      </Suspense>

      <AnimatePresence>
        {expandedModal === 'solar' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setExpandedModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={solarFullscreen ? "fixed inset-0 z-50 bg-black flex flex-col" : "relative rounded-xl p-5 border max-w-4xl w-full max-h-[90vh] overflow-hidden light:bg-white light:border-[var(--ws-border-strong)]"}
              onClick={(e) => e.stopPropagation()}>
              {!solarFullscreen && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-indigo-500/30 via-indigo-500/10 to-transparent" />}
              <div className={`flex items-center justify-between px-4 pt-4 ${solarFullscreen ? '' : 'mb-4'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold light:text-stone-900">App Ecosystem</h2>
                    <p className="text-[11px] light:text-stone-500">Your top tools in orbit</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSolarFullscreenWithEvent(!solarFullscreen)} className="p-2 hover:bg-zinc-800/60 rounded-lg transition-all duration-150 border border-transparent hover:border-zinc-700/50 light:hover:bg-stone-100 light:hover:border-[var(--ws-border)]"
                    title={solarFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                    {solarFullscreen ? <Minimize2 className="w-5 h-5 light:text-stone-500" /> : <Maximize2 className="w-5 h-5 text-zinc-400" />}
                  </button>
                  <button onClick={() => { setExpandedModal(null); setSolarFullscreenWithEvent(false); }} className="p-2 hover:bg-red-900/50 rounded-lg transition-all duration-150 border border-transparent hover:border-red-500/30" title="Close">
                    <X className="w-5 h-5 light:text-stone-500" />
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
