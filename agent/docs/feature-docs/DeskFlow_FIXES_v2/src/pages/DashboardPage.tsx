import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from 'react';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { ChartContainer } from '../components/ChartContainer';
import { motion, AnimatePresence } from 'framer-motion';
import { Bar, Line } from 'react-chartjs-2';
import {
  BookOpen, Dumbbell, Activity, Moon,
  Utensils, Coffee, Bus, Book, Timer, Zap,
  Sun, Zap as ZapIcon, Focus, Clock, X,
  Edit3, Check, Plus, Minus, TrendingUp,
  Target, ZapCircle, RefreshCw, Clock3,
  ChevronLeft, ChevronRight, Maximize2, Minimize2,
  BarChart3, Sparkles, Ban, Pause, Play
} from 'lucide-react';
import { maxOf, maxBy } from '../utils/safeMath';
import { getDateRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';

const OrbitSystem = lazy(() => import('../components/OrbitSystem').then(module => ({ default: module.default })));
const DayDetailPopup = lazy(() => import('../components/DayDetailPopup').then(module => ({ default: module.DayDetailPopup })));


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
  type: 'stopwatch' | 'sleep' | 'checkin';
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

const ACTIVITY_ICONS: Record<string, any> = {
  BookOpen, Dumbbell, Activity, Moon, Utensils, Coffee, Bus, Book, Sun, Timer
};

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

function isAppMatchingBrowserDashboard(appName: string, browserName: string): boolean {
  if (!appName || !browserName) return false;
  const appLower = appName.toLowerCase().replace(/\.exe$/i, '');
  const browserLower = browserName.toLowerCase();
  const processNames = BROWSER_PROCESS_NAMES_DASHBOARD[browserLower] || [browserLower];
  return appLower.includes(browserLower) ||
    browserLower.includes(appLower) ||
    processNames.some(p => appLower.includes(p));
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
    if (typeof window === 'undefined') return { productiveMs: 0, startTime: 0, paused: false, lastTier: null, externalRunning: false, externalStart: null, externalElapsed: 0, selectedExternalActivity: null };
    try {
      const saved = localStorage.getItem('deskflow-timer-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only use localStorage if there's meaningful data
        if (parsed.externalRunning || parsed.externalElapsed > 0 || parsed.selectedExternalActivity) {
          return parsed;
        }
      }
    } catch (e) {}
    return { productiveMs: 0, startTime: 0, paused: false, lastTier: null, externalRunning: false, externalStart: null, externalElapsed: 0, selectedExternalActivity: null };
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
  const [isPaused, setIsPaused] = useState(persistedTimer.paused);
  const [lastTier, setLastTier] = useState<'productive' | 'neutral' | 'distracting' | null>(persistedTimer.lastTier);
  // Display helpers — directly reflect the current app's tier, not timerBehavior settings
  const isCurrentlyProductive = lastTier === 'productive' && !isPaused;
  const isDistracting = lastTier === 'distracting' && !isPaused;

  // Stopwatch refs - declared early to avoid TDZ issues
  const stopwatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopwatchAccumulatedRef = useRef(0); // tracks accumulated productive ms
  const stopwatchLastTickRef = useRef(0); // tracks last tick time
  const stopwatchActiveRef = useRef(false); // is timer actively running
  const stopwatchPausedRef = useRef(false); // is timer paused

  // Track productivity sessions for saving to database
  const productivitySessionStartRef = useRef<number | null>(null);
  const productivitySessionAppRef = useRef<string | null>(null);

  // Track last user interaction (mouse/keyboard) for idle detection
  const lastInteractionRef = useRef<number>(Date.now());

  // ── Debounce period switches (must be before fetchSessions) ──
  const [fetchPeriod, setFetchPeriod] = useState(selectedPeriod);
  const periodTimerRef = useRef<number | null>(null);
  const fetchReqId = useRef(0);

  // ── Focus Sessions state (extracted from IIFE for React hooks rules) ──
  const [sessionsData, setSessionsData] = useState<{ sessions: any[]; stats: { todayBest: number; weekBest: number; allTimeBest: number; todayTotal: number; weekTotal: number; longestStreak: number } }>({ sessions: [], stats: { todayBest: 0, weekBest: 0, allTimeBest: 0, todayTotal: 0, weekTotal: 0, longestStreak: 0 } });
  const [minDuration, setMinDuration] = useState(60);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  const fetchSessions = useCallback(() => {
    if (!window.deskflowAPI?.getProductivitySessions) return;
    const thisReq = ++fetchReqId.current;
    window.deskflowAPI.getProductivitySessions({ period: fetchPeriod, dateOffset, minDuration }).then((data: any) => {
      if (thisReq !== fetchReqId.current) return;
      setSessionsData(data || { sessions: [], stats: { todayBest: 0, weekBest: 0, allTimeBest: 0, todayTotal: 0, weekTotal: 0, longestStreak: 0 } });
    }).catch(() => {});
  }, [fetchPeriod, dateOffset, minDuration]);

  useEffect(() => { fetchSessions(); }, [fetchSessions, fetchKey]);
  useEffect(() => {
    const handler = () => setFetchKey(k => k + 1);
    window.addEventListener('focus-session-saved', handler);
    return () => window.removeEventListener('focus-session-saved', handler);
  }, []);
  useEffect(() => {
    const interval = setInterval(() => setFetchKey(k => k + 1), 5000);
    return () => clearInterval(interval);
  }, []);

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

  // Persist external stopwatch too
  // FIX: If session is running but start time is missing, recalculate from database
  const [externalSessionRunning, setExternalSessionRunning] = useState(persistedTimer.externalRunning);
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
          console.log('[Dashboard] Restored external session from DB:', session.name, 'elapsed:', Math.floor(elapsed/1000), 's');
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
const [pinnedActivitiesEditMode, setPinnedActivitiesEditMode] = useState(false);
  const [pinnedActivities, setPinnedActivities] = useState<ExternalActivity[]>([]);
  const [pinnedActivitiesExpanded, setPinnedActivitiesExpanded] = useState(true);
  const [addPinnedPicker, setAddPinnedPicker] = useState<ExternalActivity[]>([]);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [selectedAddActivities, setSelectedAddActivities] = useState<Set<number>>(new Set());
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
    } catch (e) {}
    return [];
  };
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>(getPersistedActivityFeed());
  const activityFeedRef = useRef<ActivityFeedItem[]>(getPersistedActivityFeed());

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

  // Gap/unfilled time indicator
  const [unfilledMinutes, setUnfilledMinutes] = useState(0);
  const [gapCount, setGapCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const thisReq = ++fetchReqId.current;
    (async () => {
      try {
        console.log('[FROZEN-DBG] Dashboard fetch START period=', fetchPeriod, 'dateOffset=', dateOffset, 'weekOffset=', weekOffset);
        const t0 = performance.now();
        const data = await window.deskflowAPI.getDashboardAggregates({
          period: fetchPeriod,
          dateOffset,
          weekOffset,
        });
        if (cancelled) return;
        if (thisReq !== fetchReqId.current) return;
        const t1 = performance.now();
        console.log('[FROZEN-DBG] Dashboard fetch DONE in', Math.round(t1 - t0), 'ms');
        if (data.error) { console.error('[Dashboard] Aggregate error:', data.error); return; }
        window.deskflowAPI.terminalLog('[FROZEN-DBG] Dashboard data received, setting state');
        setDashboardData(data);
        console.log('[FROZEN-DBG] Dashboard setDashboardData done');
      } catch (err) {
        if (!cancelled) console.error('[Dashboard] Failed to fetch aggregates:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchPeriod, dateOffset, weekOffset]);

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
        setActivityFeed(feedItems);
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
  }, [currentProductiveMs, isPaused, lastTier, externalSessionRunning, externalSessionStart, externalElapsedMs, selectedExternalActivity, onTimerStateChange]);

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
  const [currentApp, setCurrentApp] = useState<ForegroundData | null>(null);
  const [isInBrowser, setIsInBrowser] = useState(false); // Track if currently in tracking browser
  const [lastNonBrowserApp, setLastNonBrowserApp] = useState<ForegroundData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; value: number; productivity: number; deviceSeconds?: number; externalSeconds?: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<'device' | 'external' | 'combined'>('combined');
  const [externalHourlyData, setExternalHourlyData] = useState<Map<string, { externalSeconds: number; breakdown: Record<string, { seconds: number; color: string; icon: string }> }>>(new Map());
  const [externalSessions, setExternalSessions] = useState<any[]>([]);
  const [expandedModal, setExpandedModal] = useState<'heatmap' | 'solar' | null>(null);
  const [solarFullscreen, setSolarFullscreen] = useState(false);
  const [currentWebsite, setCurrentWebsite] = useState<{ title?: string; url?: string; category?: string; domain?: string } | null>(null);
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
    { id: 1, name: 'Study', type: 'stopwatch', color: '#10b981', icon: 'BookOpen', is_productive: true },
    { id: 2, name: 'Exercise', type: 'stopwatch', color: '#10b981', icon: 'Dumbbell', is_productive: true },
    { id: 3, name: 'Gym', type: 'stopwatch', color: '#10b981', icon: 'Activity', is_productive: true },
    { id: 4, name: 'Reading', type: 'stopwatch', color: '#10b981', icon: 'Book', is_productive: true },
    { id: 5, name: 'Sleep', type: 'sleep', color: '#6366f1', icon: 'Moon', is_productive: false },
    { id: 6, name: 'Eating', type: 'checkin', color: '#6366f1', icon: 'Utensils', is_productive: false },
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
  trackingBrowserRef.current = trackingBrowser;
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
      const isTrackingBrowser = !!tb && !!data.app && isAppMatchingBrowserDashboard(data.app, tb);
      
      // Check if this is Tracker app (DeskFlow/Electron)
      const isTrackerApp = data.app && (
        data.app.toLowerCase().includes('deskflow') ||
        data.app.toLowerCase().includes('electron')
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
      
      console.log('[Focus] Not tracking browser — tracking app:', data.app);
      setIsInBrowser(false);
      setCurrentWebsite(null);
      
      if (isTrackerApp) {
        if (tam === 'show-other') {
          setCurrentApp(lnb || null);
          return;
        } else if (tam === 'pause') {
          setCurrentApp(lnb || null);
          setIsPaused(true);
          setPausedByTrackerApp(true);
          return;
        }
      }
      
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
      setActivityFeed([...activityFeedRef.current]);
    });

    // Fetch current foreground app on mount (foreground-changed only fires on change)
    if (window.deskflowAPI?.getCurrentForeground) {
      window.deskflowAPI.getCurrentForeground().then((initialData: any) => {
        if (!initialData?.app) return;
        const tb = trackingBrowserRef.current;
        const tam = trackerAppModeRef.current;
        const lnb = lastNonBrowserAppRef.current;

        const isTrackingBrowser = !!tb && !!(initialData.app) && isAppMatchingBrowserDashboard(initialData.app, tb);
        const isTrackerApp = !!(initialData.app) && (initialData.app.toLowerCase().includes('deskflow') || initialData.app.toLowerCase().includes('electron'));

        if (isTrackingBrowser) { setIsInBrowser(true); setCurrentApp(lnb || null); return; }
        setIsInBrowser(false);
        setCurrentWebsite(null);

        if (isTrackerApp) {
          if (tam === 'show-other') { setCurrentApp(lnb || null); return; }
          else if (tam === 'pause') { setCurrentApp(lnb || null); setIsPaused(true); setPausedByTrackerApp(true); return; }
        }

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
      }).catch(() => {});
    }
    
    return () => {
      console.log('[Focus] Unsubscribing foreground listener');
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);
  
  // Periodic foreground refresh (every 30s) — recovers from missed foreground-changed events
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (!window.deskflowAPI?.getCurrentForeground) return;
      window.deskflowAPI.getCurrentForeground().then((data: any) => {
        if (!data?.app) return;
        const tb = trackingBrowserRef.current;
        const isTrackingBrowser = !!tb && isAppMatchingBrowserDashboard(data.app, tb);
        const isTrackerApp = data.app.toLowerCase().includes('deskflow') || data.app.toLowerCase().includes('electron');
        
        if (isTrackerApp) return; // don't overwrite with tracker app
        if (isTrackingBrowser) {
          setIsInBrowser(true);
          return;
        }
        // If we have a real non-browser app and currentApp is null or stale, refresh it
        setCurrentApp(prev => {
          if (!prev?.app || prev.app !== data.app) {
            console.log('[Focus] Periodic refresh: updating currentApp to', data.app);
            setLastNonBrowserApp(data);
            return data;
          }
          return prev;
        });
      }).catch(() => {});
    }, 30000);
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
        
        setCurrentWebsite({
          title: data.title,
          domain: data.domain,
          url: data.url,
          category: data.category
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
        setActivityFeed([...activityFeedRef.current]);
      }
    });
  }, []); // empty deps — register once, refs handle latest values

  // SIMPLE stopwatch - ALWAYS accumulates regardless of app tier
  // Tier behavior (pause/reset/ignore) only affects productivity session SAVING, not the timer
  // The timer only pauses when: manually paused, idle for 5+ minutes, or external session is running
  useEffect(() => {
    // Clear existing timer
    if (stopwatchTimerRef.current) {
      clearInterval(stopwatchTimerRef.current);
      stopwatchTimerRef.current = null;
    }

    const isExternal = externalSessionRunning && externalSessionStart;

    // Only accumulate when there's a real app to track (or external session)
    const hasRealApp = !!currentApp?.app || (isInBrowser && !!currentWebsite?.domain);
    const shouldAccumulate = !isPaused && (hasRealApp || isExternal);
    const shouldPause = isPaused;

    // Handle pause
    if (shouldPause && !isExternal) {
      console.log(`[Dashboard] Stopwatch: PAUSED (isPaused=${isPaused})`);
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
      console.log(`[Dashboard] Stopwatch: timer RUNNING (accumulated: ${Math.floor(stopwatchAccumulatedRef.current / 1000)}s)`);
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
        stopwatchAccumulatedRef.current += delta;
        setCurrentProductiveMs(stopwatchAccumulatedRef.current);
      }
    }, 1000);

    return () => {
      if (stopwatchTimerRef.current) {
        clearInterval(stopwatchTimerRef.current);
        stopwatchTimerRef.current = null;
      }
    };
  }, [currentApp, currentWebsite, isInBrowser, lastNonBrowserApp, isPaused, externalSessionRunning, externalSessionStart]);

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

  // Periodic session flush — saves every 60s so sessions appear during long productive streaks
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
        }).catch(() => {});
      }
      productivitySessionStartRef.current = Date.now();
    }, 60000);
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
                  existing.breakdown[activityName] = { seconds: 0, color: session.color || '#8b5cf6', icon: session.icon || '?' };
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

  // Adaptive display: show what's actually running
  const displayTime = useMemo(() => {
    // External takes priority (user wants to see it when running)
    if (externalSessionRunning && externalElapsedMs > 0) {
      return { ms: externalElapsedMs, label: `External: ${selectedExternalActivity?.name || 'Running'}` };
    }

    // Distracting app
    if (lastTier === 'distracting' && !isPaused) {
      return { ms: currentProductiveMs, label: 'Distracting' };
    }

    // Productive app
    if (lastTier === 'productive' && !isPaused) {
      return { ms: currentProductiveMs, label: 'Productive' };
    }

    // Neutral/idle
    return { ms: currentProductiveMs, label: isPaused ? 'Paused' : 'Idle' };
  }, [externalSessionRunning, externalElapsedMs, currentProductiveMs, selectedExternalActivity, lastTier, isPaused]);

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
    }, 5000);
    
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
      window.deskflowAPI.getLogs().then((logs:any[]) => {
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
      if (!cell) return 'rgba(55, 65, 81, 1)';
      
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
      
      if (valueToUse === 0) return 'rgba(55, 65, 81, 1)';
      
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
          ? { r: 239 - (239-234) * prod*2, g: 68 + (216-68) * prod*2, b: 68 + (8-68) * prod*2 }
          : { r: 234 + (34-234) * (prod-0.5)*2, g: 216 + (197-216) * (prod-0.5)*2, b: 8 + (94-8) * (prod-0.5)*2 };
        
        // Blend with purple (external) - 30% purple tint
        const purpleTint = 0.3;
        r = Math.round(deviceColor.r * (1 - purpleTint) + 99 * purpleTint);
        g = Math.round(deviceColor.g * (1 - purpleTint) + 102 * purpleTint);
        b = Math.round(deviceColor.b * (1 - purpleTint) + 236 * purpleTint);
      } else {
        // Pure device mode: red -> green gradient
        if (prod < 0.5) {
          r = Math.round(239 * (1 - prod*2) + 234 * prod*2);
          g = Math.round(68 * (1 - prod*2) + 216 * prod*2);
          b = Math.round(68 * (1 - prod*2) + 8 * prod*2);
        } else {
          r = Math.round(234 * (1 - (prod-0.5)*2) + 34 * (prod-0.5)*2);
          g = Math.round(216 * (1 - (prod-0.5)*2) + 197 * (prod-0.5)*2);
          b = Math.round(8 * (1 - (prod-0.5)*2) + 94 * (prod-0.5)*2);
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
              color: isBrowser ? '#10b981' : '#3b82f6',
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
              color: session.color || '#8b5cf6',
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
          <div className="w-full bg-zinc-950 rounded-xl border border-zinc-800 p-5">
            {/* Day Headers - aligned with grid */}
            <div className="flex items-center mb-3">
              <div className="w-14 flex-shrink-0"></div>
              <div className="flex-1 flex">
                {DAYS.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className={`flex-1 text-center text-sm font-semibold mx-px cursor-pointer hover:text-white transition ${dayIdx === currentDay ? 'text-emerald-400' : 'text-zinc-400'}`}
                    onClick={() => handleDayClick(dayIdx)}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Mode Toggle - below day headers */}
            <div className="flex justify-end mb-3">
              <div className="flex bg-zinc-800 rounded-lg p-1 gap-1">
                {(['device', 'external', 'combined'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setHeatmapMode(mode)}
                    className={`px-3 py-1.5 text-xs rounded-md transition capitalize ${heatmapMode === mode ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
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
                    <div className={`w-10 flex-shrink-0 pr-1 text-[10px] font-mono text-right text-zinc-500`}>
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
              className="absolute glass px-4 py-2.5 rounded-xl border border-zinc-700 z-50 pointer-events-none"
              style={{
                minWidth: '220px',
                left: '50%',
                transform: 'translateX(-50%)',
                top: `${(hoveredCell.hour * 26) + 50}px`
              }}
            >
              <div className="font-semibold text-white text-xs mb-2">
                {DAYS[hoveredCell.day]} • {hoveredCell.hour.toString().padStart(2, '0')}:00 – {(hoveredCell.hour + 1).toString().padStart(2, '0')}:00
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-zinc-400 text-xs">Device:</span>
                  <span className="font-mono text-sm text-emerald-400 tabular-nums">
                    {formatDuration((hoveredCell.deviceSeconds || 0) * 1000)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-zinc-400 text-xs">External:</span>
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
                className="mt-6 p-4 rounded-xl border border-zinc-700 bg-zinc-900/30 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">
                    {DAYS[clickedCell.day]} • {selectedCell.hour.toString().padStart(2, '0')}:00 – {(selectedCell.hour + 1).toString().padStart(2, '0')}:00
                  </div>
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="text-zinc-400 hover:text-zinc-300 transition-colors"
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
                      <div className="text-xs text-zinc-500 italic">No device activity this hour</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-zinc-400">Total Time:</span>
                          <span className="font-mono text-emerald-400">{formatDuration((clickedCell.deviceSeconds || 0) * 1000)}</span>
                        </div>
                        {(() => {
                          const breakdown = clickedCell.deviceBreakdown || {};
                          const apps = Object.entries(breakdown).sort((a, b) => b[1].seconds - a[1].seconds);
                          return apps.length > 0 ? (
                            <div className="space-y-1 border-t border-zinc-700 pt-2 mt-2">
                              {apps.map(([app, data]) => (
                                <div key={app} className="flex items-baseline justify-between text-xs">
                                  <span className="text-zinc-400 truncate flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: appColors[app] || '#6b7280' }} />
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
                      <div className="text-xs text-zinc-500 italic">No external activity this hour</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-zinc-400">Total Time:</span>
                          <span className="font-mono text-purple-400">{formatDuration((clickedCell.externalSeconds || 0) * 1000)}</span>
                        </div>
                        {(() => {
                          const breakdown = clickedCell.externalBreakdown || {};
                          const activities = Object.entries(breakdown).sort((a, b) => b[1].seconds - a[1].seconds);
                          
                          return activities.length > 0 ? (
                            <div className="space-y-1 border-t border-zinc-700 pt-2 mt-2">
                              {activities.map(([activity, data]: [string, any]) => (
                                <div key={activity} className="flex items-baseline justify-between text-xs">
                                  <span className="text-zinc-400 truncate flex items-center gap-1">
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
    ? 'rgba(139, 92, 246, 0.3)'  // Purple for external
    : isDistracting 
      ? 'rgba(239, 68, 68, 0.3)'  // Red for distracting
      : isCurrentlyProductive 
        ? 'rgba(16, 185, 129, 0.3)'  // Green for productive
        : 'rgba(107, 114, 128, 0.3)';  // Gray for idle

  // Compute stats from backend overview data
  const stats = useMemo(() => {
    const ov = dashboardData?.overview;
    const liveProductiveMs = (lastTier === 'productive' && !isPaused) ? currentProductiveMs : 0;
    const formatHours = (ms: number) => {
      const hours = ms / (1000 * 60 * 60);
      return hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(ms / (1000 * 60))}m`;
    };
    const longestFocusMs = sessionsData.sessions.length > 0
      ? maxBy(sessionsData.sessions, (s: any) => (s.duration_seconds || 0) * 1000)
      : 0;
    if (!ov) {
      if (liveProductiveMs > 0) {
        return { totalTime: formatHours(liveProductiveMs), totalTimeMs: liveProductiveMs, productiveTime: formatHours(liveProductiveMs), productiveTimeMs: liveProductiveMs, productivePercent: 100, longestFocus: formatHours(Math.max(liveProductiveMs, longestFocusMs)) };
      }
      return { totalTime: '0', totalTimeMs: 0, productiveTime: '0', productiveTimeMs: 0, productivePercent: 0, longestFocus: longestFocusMs > 0 ? formatHours(longestFocusMs) : 'N/A' };
    }
    const totalTimeMs = (ov.totalSeconds || 0) * 1000 + (liveProductiveMs > 0 ? liveProductiveMs : 0);
    const productiveTimeMs = (ov.productiveSeconds || 0) * 1000 + liveProductiveMs;
    const productivePercent = totalTimeMs > 0 ? Math.round((productiveTimeMs / totalTimeMs) * 100) : 0;
    return {
      totalTime: formatHours(totalTimeMs),
      totalTimeMs,
      productiveTime: formatHours(productiveTimeMs),
      productiveTimeMs,
      productivePercent,
      longestFocus: longestFocusMs > 0 ? formatHours(longestFocusMs) : 'N/A',
    };
  }, [dashboardData?.overview, currentProductiveMs, lastTier, isPaused, sessionsData]);

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
  useEffect(() => {
    if (window.deskflowAPI?.setPageVisibility) {
      window.deskflowAPI.setPageVisibility('dashboard', true);
    }
    return () => {
      if (window.deskflowAPI?.setPageVisibility) {
        window.deskflowAPI.setPageVisibility('dashboard', false);
      }
    };
  }, []);

  return (
    <PageShell page="dashboard" variant="dashboard" className="text-white bg-[#0a0a0a]">
      {/* Background grid effect */}
      <div 
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      <div className="relative z-10 p-5">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Focus className="w-8 h-8 text-emerald-400" />
                <h1 className="text-4xl font-bold tracking-tight">Lock-In</h1>
              </div>
              <div className="text-sm text-zinc-500">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </motion.div>

          {/* Main Timer Section - HERO */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            <div 
              className="rounded-xl p-5 sm:p-12 border backdrop-blur-sm bg-zinc-950/80"
              style={{
                borderColor,
                boxShadow: isCurrentlyProductive || externalSessionRunning ? `0 0 20px ${externalSessionRunning ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.1)'}` : 'none'
              }}
            >
              <div className="text-center space-y-6">
                {/* Status indicator - Adaptive: shows external if running */}
<motion.div
                  animate={{ opacity: (isCurrentlyProductive || externalSessionRunning || isDistracting) ? [1, 0.7, 1] : 1 }}
                  transition={{ duration: 2, repeat: (isCurrentlyProductive || externalSessionRunning || isDistracting) ? Infinity : 0 }}
                  className="flex items-center justify-center gap-3"
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: displayTime.label.includes('External')
                        ? '#8b5cf6'  // Purple for external
                        : isDistracting 
                          ? '#ef4444'  // Red for distracting
                          : isCurrentlyProductive 
                            ? '#10b981'  // Green for productive
                            : '#3b82f6'  // Blue for neutral/idle
                    }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                    {isPaused 
                      ? <><Pause className="w-3 h-3" /> Paused</>
                      : displayTime.label.includes('External')
                        ? displayTime.label
                          : isDistracting 
                          ? <><Ban className="w-3 h-3" /> Distracting</>
                          : isCurrentlyProductive 
                            ? <><Target className="w-3 h-3" /> Locked In</>
                            : <><Pause className="w-3 h-3" /> Idle</>}
                  </span>
                </motion.div>

                {/* Giant Timer - Adaptive: shows external if running, otherwise productive */}
                <motion.div
                  key={externalSessionRunning ? 'external' : 'productive'}
                  initial={{ scale: 0.95, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="font-mono font-bold"
                  style={{
                    fontSize: displayTime.label.includes('External') ? '80px' : '120px',
                    lineHeight: '1',
                    color: displayTime.label.includes('External') 
                      ? '#8b5cf6'  // Purple for external
                      : isDistracting 
                        ? '#ef4444'  // Red for distracting
                        : isCurrentlyProductive 
                          ? '#10b981'  // Green for productive
                          : '#3b82f6',  // Blue for neutral/idle
                    textShadow: !isPaused && (isCurrentlyProductive || externalSessionRunning || isDistracting) 
                      ? (displayTime.label.includes('External') 
                        ? '0 0 30px rgba(139, 92, 246, 0.3)' 
                        : isDistracting 
                          ? '0 0 30px rgba(239, 68, 68, 0.3)' 
                          : isCurrentlyProductive
                            ? '0 0 30px rgba(16, 185, 129, 0.3)'
                            : '0 0 30px rgba(59, 130, 246, 0.3)') 
                      : 'none',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {formatDuration(displayTime.ms)}
                </motion.div>
                
                {/* Show external activity name when running */}
                {externalSessionRunning && selectedExternalActivity && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-3"
                  >
                    <div className="text-zinc-400 text-sm uppercase tracking-wider">External Activity</div>
                    <div className="flex items-center justify-center gap-2">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-mono font-semibold"
                        style={{
                          backgroundColor: 'rgba(139, 92, 246, 0.2)',  // Purple
                          color: '#a78bfa'
                        }}
                      >
                        {selectedExternalActivity.name}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Current activity - always show when timer is active */}
                {!externalSessionRunning && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-3"
                  >
                    <div className="text-zinc-400 text-sm uppercase tracking-wider">{hasRealApp ? 'Currently tracking' : 'Waiting for app'}</div>
                    <div className="flex items-center justify-center gap-2">
                      {hasRealApp ? (
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-mono font-semibold"
                          style={{
                            backgroundColor: isDistracting 
                              ? 'rgba(239, 68, 68, 0.2)'  // Red for distracting
                              : isCurrentlyProductive 
                                ? 'rgba(16, 185, 129, 0.2)'  // Green for productive
                                : 'rgba(107, 114, 128, 0.2)',  // Gray for idle
                            color: isDistracting 
                              ? '#f87171'  // Red
                              : isCurrentlyProductive 
                                ? '#34d399'  // Green
                                : '#d1d5db'  // Gray
                          }}
                        >
                          {currentWebsite ? currentWebsite.category : (currentApp?.category || (isInBrowser ? 'Browser' : (lastTier ? lastTier.charAt(0).toUpperCase() + lastTier.slice(1) : 'Unknown')))}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-zinc-800 text-zinc-500">
                          No App
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-medium text-white">
                      {currentApp ? (currentApp.app || currentApp.title) : (currentWebsite?.title || currentWebsite?.domain || (isInBrowser ? 'Browsing...' : (lastTier && currentProductiveMs > 0 ? (lastTier === 'productive' ? 'Productive Session' : lastTier === 'distracting' ? 'Distracting Session' : 'Active Session') : 'Switch to another app to start tracking')))}
                    </div>
                  </motion.div>
                )}

                {/* Helpful message - Adaptive */}
                <div className="text-xs text-zinc-600 pt-4 border-t border-zinc-800">
                  {externalSessionRunning 
                    ? `External activity: ${selectedExternalActivity?.name}. Timer running.`
                    : (!hasRealApp
                      ? 'No app detected. Switch to a window to start tracking.'
                      : (isCurrentlyProductive 
                        ? 'Productive work detected. Timer running.'
                        : 'No productive activity detected. Open an IDE, editor, or learning tool to start.'))}
                </div>
                   </div>

{/* View Heatmap Button - REMOVED, now in Weekly Productivity section */}
                 </div>
          </motion.div>

          {/* Stats Cards Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12"
          >
            <StatCard label="Productive" value={stats.productiveTime} />
            <StatCard label="Total" value={stats.totalTime} />
            <StatCard label="% Productive" value={`${stats.productivePercent}%`} />
            <StatCard label="Longest Focus" value={stats.longestFocus} />
            <StatCard label="Resets Today" value={resetCount} />
            <StatCard
              label={displayTime.label.includes('External') ? 'External' : 'Productive'}
              value={formatDuration(displayTime.ms)}
            />
          </motion.div>

          {/* Pinned Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl p-5 border backdrop-blur-sm mb-12 bg-zinc-950/80 border-zinc-500/20"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setPinnedActivitiesExpanded(!pinnedActivitiesExpanded)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${pinnedActivitiesExpanded ? 'rotate-90' : ''}`} />
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Pinned Activities</h2>
                    <p className="text-xs text-zinc-600 mt-1">Quick manual tracking</p>
                  </div>
                </button>
                <button
                  onClick={() => setPinnedActivitiesEditMode(!pinnedActivitiesEditMode)}
                  className={`p-2 rounded-lg border transition-colors duration-150 ${
                    pinnedActivitiesEditMode
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-zinc-500/10 border-zinc-500/20'
                  }`}
                >
                  {pinnedActivitiesEditMode ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Edit3 className="w-4 h-4 text-zinc-400" />
                  )}
                </button>
              </div>

              {pinnedActivitiesExpanded && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {pinnedActivities.map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.icon] || Timer;
                  const isSelected = selectedExternalActivity?.id === activity.id;
                  
                  return (
                    <motion.div key={activity.id} className="relative">
                      <motion.button
                        onClick={() => {
                          if (pinnedActivitiesEditMode) {
                            setPinnedActivities(prev => prev.filter(a => a.id !== activity.id));
                          } else if (isSelected) {
                            setSelectedExternalActivity(null);
                          } else {
                            handleSelectExternalActivity(activity);
                          }
                        }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className={`w-full rounded-xl border transition-all duration-200 text-center overflow-hidden ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                            : 'bg-zinc-500/10 border-zinc-500/20 hover:border-zinc-500/30'
                        }`}
                        style={{ padding: isSelected ? '12px 12px 8px' : '16px 12px' }}
                      >
                        {isSelected && externalSessionRunning && (
                          <div className="flex items-center justify-center gap-1.5 mb-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">Tracking</span>
                          </div>
                        )}
                        <Icon
                          className={`w-6 h-6 mx-auto mb-1.5 transition-colors duration-200 ${
                            isSelected
                              ? 'text-emerald-400'
                              : activity.is_productive ? 'text-emerald-500' : 'text-indigo-500'
                          }`}
                        />
                        <div className={`text-xs font-semibold transition-colors duration-200 ${
                          isSelected ? 'text-emerald-300' : 'text-white'
                        }`}>{activity.name}</div>
                        {isSelected && externalSessionRunning && (
                          <div className="text-lg font-mono font-bold text-emerald-400 mt-1.5 tabular-nums">
                            {formatDuration(externalElapsedMs)}
                          </div>
                        )}
                        {isSelected && !externalSessionRunning && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartExternalSession();
                            }}
                            className="mt-2 mb-0.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/40 transition-all duration-150 cursor-pointer"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            Start
                          </button>
                        )}
                      </motion.button>
                      {isSelected && externalSessionRunning && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStopExternalSession();
                          }}
                          className="absolute -bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 px-3 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-semibold uppercase tracking-wider shadow-lg shadow-red-500/20 hover:bg-red-500 transition-colors duration-150 whitespace-nowrap"
                        >
                          Stop
                        </motion.button>
                      )}
                      {pinnedActivitiesEditMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedActivities(prev => prev.filter(a => a.id !== activity.id));
                          }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
                
                {/* Add activity button in edit mode */}
                {pinnedActivitiesEditMode && pinnedActivities.length < 6 && (
                  <motion.button
                    onClick={() => {
                      const available = activities.filter(a => !pinnedActivities.find(p => p.id === a.id));
                      if (available.length === 0) return;
                      if (available.length === 1) {
                        setPinnedActivities(prev => [...prev, available[0]]);
                      } else {
                        setAddPinnedPicker(available);
                        setSelectedAddActivities(new Set());
                        setShowAddActivityModal(true);
                      }
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full p-4 rounded-lg border border-dashed transition-colors duration-150 text-center"
                    style={{
                      backgroundColor: 'rgba(107, 114, 128, 0.05)',
                      borderColor: 'rgba(107, 114, 128, 0.3)'
                    }}
                  >
                    <Plus className="w-6 h-6 mx-auto mb-2 text-zinc-500" />
                    <div className="text-xs font-semibold text-zinc-500">Add</div>
                  </motion.button>
                )}
                
              </div>
            )}
            </div>
          </motion.div>

            {/* Add Activity Modal */}
           <AnimatePresence>
             {showAddActivityModal && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                 onClick={() => { setShowAddActivityModal(false); setAddPinnedPicker([]); setSelectedAddActivities(new Set()); }}
               >
                 <motion.div
                   initial={{ scale: 0.92, opacity: 0, y: 10 }}
                   animate={{ scale: 1, opacity: 1, y: 0 }}
                   exit={{ scale: 0.92, opacity: 0, y: 10 }}
                   className="rounded-xl border overflow-hidden w-full max-w-sm bg-zinc-950/98 border-zinc-500/15 shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
                   onClick={(e) => e.stopPropagation()}
                 >
                    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-500/10">
                     <div>
                       <h3 className="text-base font-semibold text-zinc-100">Pin Activities</h3>
                       <p className="text-xs text-zinc-500 mt-0.5">Select activities to add to dashboard</p>
                     </div>
                     <button
                       onClick={() => { setShowAddActivityModal(false); setAddPinnedPicker([]); setSelectedAddActivities(new Set()); }}
                       className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                     >
                       <X className="w-4 h-4 text-zinc-500" />
                     </button>
                   </div>

                   <div className="px-2 py-2 max-h-72 overflow-y-auto">
                     {addPinnedPicker.map(activity => {
                       const isSelected = selectedAddActivities.has(activity.id);
                       return (
                         <button
                           key={activity.id}
                           onClick={() => {
                             const next = new Set(selectedAddActivities);
                             if (isSelected) {
                               next.delete(activity.id);
                             } else {
                               next.add(activity.id);
                             }
                             setSelectedAddActivities(next);
                           }}
                           className={`w-full px-3 py-3 text-left text-sm rounded-xl flex items-center gap-3 transition-colors duration-150 ${
                             isSelected
                               ? 'bg-emerald-500/10'
                               : 'hover:bg-zinc-800/50'
                           }`}
                         >
                           <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                             isSelected
                               ? 'border-emerald-500 bg-emerald-500'
                               : 'border-zinc-600 bg-transparent'
                           }`}>
                             {isSelected && (
                               <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                               </svg>
                             )}
                           </div>
                           <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: activity.color }} />
                           <span className={`font-medium ${isSelected ? 'text-emerald-300' : 'text-zinc-300'}`}>
                             {activity.name}
                           </span>
                         </button>
                       );
                     })}
                   </div>

                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-500/10">
                     <button
                       onClick={() => { setShowAddActivityModal(false); setAddPinnedPicker([]); setSelectedAddActivities(new Set()); }}
                       className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors duration-150"
                     >
                       Cancel
                     </button>
                     <button
                       onClick={() => {
                         const selected = addPinnedPicker.filter(a => selectedAddActivities.has(a.id));
                         setPinnedActivities(prev => [...prev, ...selected]);
                         setShowAddActivityModal(false);
                         setAddPinnedPicker([]);
                         setSelectedAddActivities(new Set());
                       }}
                       disabled={selectedAddActivities.size === 0}
                        className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                          selectedAddActivities.size > 0
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                        }`}
                     >
                       {selectedAddActivities.size > 0
                         ? `Add (${selectedAddActivities.size})`
                         : 'Select activities'}
                     </button>
                   </div>
                 </motion.div>
               </motion.div>
              )}
</AnimatePresence>

            {/* ══════════════════════════════════════════════════════════════
                  PRODUCTIVITY SESSIONS - Best Time, History, Ranking
                  ══════════════════════════════════════════════════════════════ */}
              <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.23 }}
                  className="rounded-xl p-5 border backdrop-blur-sm mb-8 bg-zinc-950/80 border-emerald-500/20"
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-500">Focus Sessions</h2>
                        <p className="text-xs text-zinc-500 mt-1">Your best productivity times</p>
                      </div>
                      <button
                        onClick={() => setSessionsExpanded(!sessionsExpanded)}
                        className="text-xs px-3 py-1 rounded-lg border transition-colors bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                      >
                        {sessionsExpanded ? 'Hide' : 'Show'} History
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl p-4 text-center border bg-emerald-500/5 border-emerald-500/20">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Best Today</div>
                        <div className="text-2xl font-bold text-emerald-500">{fmtSec(sessionsData.stats.todayBest)}</div>
                        <div className="text-[10px] text-zinc-600 mt-1">of {fmtSec(sessionsData.stats.todayTotal)} total</div>
                      </div>
                      <div className="rounded-xl p-4 text-center border bg-amber-500/5 border-amber-500/20">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Best This Week</div>
                        <div className="text-2xl font-bold text-amber-500">{fmtSec(sessionsData.stats.weekBest)}</div>
                        <div className="text-[10px] text-zinc-600 mt-1">of {fmtSec(sessionsData.stats.weekTotal)} total</div>
                      </div>
                      <div className="rounded-xl p-4 text-center border bg-purple-500/5 border-purple-500/20">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">All-Time PB</div>
                        <div className="text-2xl font-bold text-purple-500">{fmtSec(sessionsData.stats.allTimeBest)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Min:</span>
                        <input
                          type="range"
                          min={60}
                          max={3600}
                          step={60}
                          value={minDuration}
                          onChange={e => setMinDuration(parseInt(e.target.value))}
                          className="w-24 h-1 rounded-lg appearance-none cursor-pointer"
                          style={{ accentColor: '#10b981' }}
                        />
                        <span className="text-xs" style={{ color: '#10b981' }}>{fmtSec(minDuration)}</span>
                      </div>
                    </div>

                    {sessionsExpanded && (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {sessionsData.sessions.length === 0 ? (
                          <div className="text-center py-6 text-zinc-500 text-sm">
                            No sessions found. Start working in a productive app to build your focus history.
                          </div>
                        ) : (
                          sessionsData.sessions.map((sess: any, idx: number) => {
                            const rank = idx + 1;
                            const isGold = rank === 1;
                            const isSilver = rank === 2;
                            const isBronze = rank === 3;
                            const started = new Date(sess.started_at);
                            const timeStr = started.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const dateStr = started.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                            return (
                              <div
                                key={sess.id || idx}
                                className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
                                style={{
                                  backgroundColor: isGold ? 'rgba(234, 179, 8, 0.08)' : isSilver ? 'rgba(148, 163, 184, 0.08)' : isBronze ? 'rgba(180, 83, 9, 0.08)' : 'rgba(107, 114, 128, 0.05)',
                                  borderColor: isGold ? 'rgba(234, 179, 8, 0.3)' : isSilver ? 'rgba(148, 163, 184, 0.3)' : isBronze ? 'rgba(180, 83, 9, 0.3)' : 'rgba(107, 114, 128, 0.15)'
                                }}
                              >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isGold ? 'text-amber-400' : isSilver ? 'text-zinc-400' : isBronze ? 'text-orange-400' : 'text-zinc-600'
                                }`} style={{
                                  backgroundColor: isGold ? 'rgba(234, 179, 8, 0.15)' : isSilver ? 'rgba(148, 163, 184, 0.15)' : isBronze ? 'rgba(180, 83, 9, 0.15)' : 'rgba(107, 114, 128, 0.1)'
                                }}>
                                  {rank}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-white">{fmtSec(sess.duration_seconds)}</div>
                                  <div className="text-xs text-zinc-500">{dateStr} · {timeStr}</div>
                                </div>
                                {rank <= 3 && (
                                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    isGold ? 'text-amber-400' : isSilver ? 'text-zinc-300' : 'text-orange-400'
                                  }`} style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                    Top {rank}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>

            {/* Two-Column Stats Section */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-12">
              {/* Weekly Heatmap */}
              <motion.div data-tutorial="dash.heatmap"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl p-5 border backdrop-blur-sm transition-colors bg-zinc-950/80 border-zinc-500/20"
               >
                   <div className="space-y-4">
                      <SectionHeader
                        title="Productivity"
                        icon={<BarChart3 className="w-5 h-5" />}
                        action={
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setExpandedModal('heatmap')}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors border border-zinc-700 hover:border-zinc-600"
                            >
                              View Heatmap
                            </button>
                          </div>
                        }
                      />
                     
                      {/* Date range label */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">
                          {computeChartDateRange(selectedPeriod, dateOffset).label}
                        </span>
                      </div>

                     {/* Total hours */}
                     <div className="text-lg font-bold text-emerald-400">
                       {chartBarsResult.chartBars.length > 0 ? (() => {
                         const total = chartBarsResult.chartBars.reduce((sum, bar) => sum + bar.productiveSeconds + bar.nonProductiveSeconds + bar.externalSeconds, 0);
                         return total > 0 ? `${(total / 3600).toFixed(1)}h` : '--';
                       })() : '--'}
                     </div>

                     {/* CHART */}
                      {chartBarsResult.chartBars.length === 0 ? (
                        <EmptyState
                          icon={<BarChart3 className="w-8 h-8 opacity-30" />}
                          title="No tracking data for this period"
                          description="Start using apps to see productivity data"
                        />
                      ) : (
                        <div data-tutorial="dash.weekly" className="h-72">
                          <Bar
                            data={{
                              labels: chartBarsResult.chartBars.map(b => b.label),
                              datasets: [
                                {
                                  label: 'Productive',
                                  data: chartBarsResult.chartBars.map(b => Math.round((b.productiveSeconds / 3600) * 100) / 100),
                                  backgroundColor: chartBarsResult.chartBars.map(b => b.isToday ? '#10b981' : 'rgba(16, 185, 129, 0.7)'),
                                  borderRadius: 4,
                                  borderSkipped: false,
                                },
                                {
                                  label: 'Other',
                                  data: chartBarsResult.chartBars.map(b => Math.round((b.nonProductiveSeconds / 3600) * 100) / 100),
                                  backgroundColor: chartBarsResult.chartBars.map(b => b.isToday ? '#f59e0b' : 'rgba(245, 158, 11, 0.7)'),
                                  borderRadius: 4,
                                  borderSkipped: false,
                                },
                                {
                                  label: 'External',
                                  data: chartBarsResult.chartBars.map(b => Math.round((b.externalSeconds / 3600) * 100) / 100),
                                  backgroundColor: chartBarsResult.chartBars.map(b => b.isToday ? '#6366f1' : 'rgba(99, 102, 241, 0.7)'),
                                  borderRadius: 4,
                                  borderSkipped: false,
                                },
                              ],
                            }}
                           options={{
                             responsive: true,
                             maintainAspectRatio: false,
                             plugins: {
                               legend: { display: true, position: 'bottom' as const, labels: { color: '#71717a', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 9 } } },
                               tooltip: {
                                 backgroundColor: 'rgba(39, 39, 42, 0.95)',
                                 borderColor: 'rgba(63, 63, 70, 0.5)',
                                 borderWidth: 1,
                                 titleColor: '#e4e4e7',
                                 bodyColor: '#a1a1aa',
                                 padding: 12,
                                 cornerRadius: 8,
                                 titleFont: { size: 10, weight: '600' },
                                 bodyFont: { size: 9 },
                                 displayColors: true,
                                 boxPadding: 4,
                                  callbacks: {
                                    title: (items: any[]) => items[0]?.label || '',
                                    label: (ctx: any) => {
                                      const hours = ctx.raw as number;
                                      if (hours === 0) return null;
                                      const h = Math.floor(hours);
                                      const m = Math.round((hours - h) * 60);
                                      const label = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
                                      return ` ${ctx.dataset.label}: ${label}`;
                                    },
                                  },
                               },
                             },
                             scales: {
                               x: {
                                 stacked: true,
                                 grid: { display: false },
                                 ticks: {
                                   color: '#71717a',
                                   font: { size: 9 },
                                   maxRotation: 0,
                                   autoSkip: true,
                                   maxTicksLimit: selectedPeriod === 'today' ? 12 : selectedPeriod === 'month' ? 10 : undefined,
                                 },
                               },
                               y: {
                                 stacked: true,
                                 grid: { color: '#27272a' },
                                 ticks: {
                                   color: '#71717a',
                                   font: { size: 9 },
                                   callback: (v: number) => {
                                     if (selectedPeriod === 'today') {
                                       const mins = Math.round(v * 60);
                                       return mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`;
                                     }
                                     if (selectedPeriod === 'all' && v >= 24) return `${(v / 24).toFixed(0)}d`;
                                     return `${v}h`;
                                   },
                                 },
                                 suggestedMax: yAxisTicks.niceMax,
                               },
                             },
                           }}
                         />
                       </div>
                     )}
                   </div>
                </motion.div>

                {/* App Usage Solar System */}
               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.3 }}
                className="rounded-xl p-5 border backdrop-blur-sm transition-colors bg-zinc-950/80 border-zinc-500/20"
              >
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <div>
                       <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">App Ecosystem</h2>
                       <p className="text-xs text-zinc-600 mt-1">Your top tools in orbit</p>
                     </div>
                     <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                       {/* Solar mode toggle */}
                       <button
                         onClick={(e) => { e.stopPropagation(); setSolarMode('apps'); }}
                         className={`px-2 py-1 text-xs rounded transition-colors ${solarMode === 'apps' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                       >
                         Apps
                       </button>
                       <button
                         onClick={(e) => { e.stopPropagation(); setSolarMode('websites'); }}
                         className={`px-2 py-1 text-xs rounded transition-colors ${solarMode === 'websites' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                       >
                         Websites
                       </button>
                       <div className="ml-2">
                         <span className="text-xs text-zinc-500">
                           {dateOffset === 0 && selectedPeriod === 'today' ? 'Today' : 
                            dateOffset === 0 && selectedPeriod === 'week' ? 'This Week' : 
                            dateOffset === 0 && selectedPeriod === 'month' ? 'This Month' :
                            dateOffset === 0 && selectedPeriod === 'all' ? 'All Time' :
                            `${selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'Week' : selectedPeriod === 'month' ? 'Month' : 'Period'} -${dateOffset}`}
                         </span>
                       </div>
                     </div>
                   </div>
<div className="relative h-64 flex items-center justify-center">
                      <div className="absolute w-12 h-12 rounded-full border border-zinc-700 flex items-center justify-center">
                        <Sun className="w-6 h-6 text-zinc-600" />
                      </div>
                      
                      {solar.slice(0, 5).map((app, i) => {
                       const size = Math.max(70, 24 + (app.usage_ms / maxUsage) * 48);
                       const angle = (i * 360) / Math.min(solar.length, 5);
                       const radius = 70 + (i % 2) * 35;
                       const rad = (angle * Math.PI) / 180;
                       const x = Math.cos(rad) * radius;
                       const y = Math.sin(rad) * radius;
                       
                       return (
                         <motion.div
                           key={app.name}
                           initial={{ scale: 0, x: 0, y: 0 }}
                           animate={{ scale: 1, x, y }}
                           transition={{ delay: 0.3 + i * 0.1 }}
                           className="absolute"
                           style={{ 
                             width: Math.max(size, 60),
                             height: Math.max(size, 60),
                           }}
                           title={`${app.name}: ${Math.round((app.usage_ms / 1000 / 3600) * 10) / 10}h`}
                         >
                           {/* Circle with text inside - NO truncation */}
                           <div 
                             className="w-full h-full rounded-full border border-zinc-700 hover:border-zinc-500 transition-colors flex flex-col items-center justify-center"
                             style={{ 
                               backgroundColor: 'rgba(24, 24, 27, 0.9)',
                               cursor: 'pointer'
                             }}
                           >
                             {/* App name - FULL name, no truncate */}
                             <div className="text-xs font-semibold text-zinc-300 px-2 text-center">
                               {app.name}
                             </div>
                             {/* Duration */}
                             <div className="text-[10px] text-zinc-500 mt-0.5">
                               {Math.round((app.usage_ms / 1000 / 3600) * 10) / 10}h
                             </div>
                           </div>
                         </motion.div>
                       );
                     })}
                  </div>

                  {/* View Solar System Button */}
                  <button
                    onClick={() => setExpandedModal('solar')}
                    className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white transition-colors border border-zinc-700 hover:border-zinc-600"
                  >
                    View Solar System
                  </button>
                 </div>
               </motion.div>
          </div>

{/* Expanded Heatmap Modal */}
           <AnimatePresence>
             {expandedModal === 'heatmap' && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                 onClick={() => setExpandedModal(null)}
               >
<motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="rounded-xl p-5 border max-w-4xl w-full max-h-[90vh] overflow-auto bg-zinc-950/95 border-zinc-500/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-semibold uppercase tracking-wider text-zinc-200">Activity Heatmap</h2>
                        <p className="text-xs text-zinc-600 mt-1">{heatmapWeekLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setWeekOffset(w => w - 1)}
                          className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
                          title="Previous week"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setWeekOffset(0)}
                          className="px-2 py-1 text-xs text-zinc-400 hover:text-white transition"
                        >
                          Today
                        </button>
                        <button
                          onClick={() => setWeekOffset(w => Math.min(w + 1, 0))}
                          disabled={weekOffset >= 0}
                          className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Next week"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedModal(null)}
                          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors ml-2"
                        >
                          <X className="w-5 h-5 text-zinc-400" />
                        </button>
                      </div>
                    </div>
                    
                    {renderHeatmap()}
                  </motion.div>
               </motion.div>
             )}
            </AnimatePresence>

{/* Day Detail Popup */}
            <Suspense fallback={null}>
              {dayDetailDate && (
                <DayDetailPopup
                  date={dayDetailDate}
                  items={dayDetailItems}
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
                          newItems.push({
                            id: `log-${log.id}`,
                            startHour,
                            endHour: Math.min(endHour, 24),
                            label,
                            category: isBrowser ? 'browser' : 'app',
                            color: isBrowser ? '#10b981' : '#3b82f6',
                            duration: Math.round(durationSec),
                            details: log.title,
                          });
                        });
                        (detail.externalSessions || []).forEach((session: any) => {
                          const startDate = new Date(session.started_at);
                          const endDate = session.ended_at ? new Date(session.ended_at) : new Date();
                          const sHour = startDate.getHours() + startDate.getMinutes() / 60;
                          const durSec = (endDate.getTime() - startDate.getTime()) / 1000;
                          const eHour = sHour + durSec / 3600;
                          newItems.push({
                            id: `ext-${session.id}`,
                            startHour: sHour,
                            endHour: Math.min(eHour, 24),
                            label: session.activity_name || 'External',
                            category: 'external',
                            color: session.color || '#8b5cf6',
                            duration: Math.round(durSec),
                          });
                        });
                        newItems.sort((a, b) => a.startHour - b.startHour);
                        setDayDetailItems(newItems);
                      });
                    }
                  }}
                />
              )}
            </Suspense>

{/* Expanded Solar System Modal */}
            <AnimatePresence>
              {expandedModal === 'solar' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setExpandedModal(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className={solarFullscreen ? "fixed inset-0 z-50 bg-black flex flex-col" : "rounded-xl p-5 border max-w-4xl w-full max-h-[90vh] overflow-hidden bg-zinc-950/95 border-zinc-500/20"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header with timeline selector */}
                    <div className={`flex items-center justify-between px-4 pt-4 ${solarFullscreen ? '' : 'mb-4'}`}>
                      <div>
                        <h2 className="text-lg font-semibold uppercase tracking-wider text-zinc-200">App Ecosystem</h2>
                        <p className="text-xs text-zinc-600 mt-1">Your top tools in orbit</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSolarFullscreen(!solarFullscreen)}
                          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                          title={solarFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        >
                          {solarFullscreen ? <Minimize2 className="w-5 h-5 text-zinc-400" /> : <Maximize2 className="w-5 h-5 text-zinc-400" />}
                        </button>
                        <button
                          onClick={() => { setExpandedModal(null); setSolarFullscreen(false); }}
                          className="p-2 hover:bg-red-900/50 rounded-lg transition-colors"
                          title="Close"
                        >
                          <X className="w-5 h-5 text-zinc-400" />
                        </button>
                      </div>
                    </div>
                    
                    {/* OrbitSystem container */}
                    <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingState variant="spinner" /></div>}>
                      <div data-tutorial="dash.orbit" className={solarFullscreen ? 'w-full h-screen' : 'h-[500px] w-full'}>
                        <OrbitSystem 
                          logs={orbitLogs}
                          websiteLogs={orbitWebsiteLogs}
                          appColors={appColors}
                          categoryOverrides={categoryOverrides}
                          selectedPeriod={selectedPeriod}
                          onPeriodChange={(p) => {
                            onSelectedPeriodChange?.(p as any);
                            onDateOffsetChange?.(0);
                          }}
                        />
                      </div>
                    </Suspense>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard data-tutorial="dash.sessions">
              <SectionHeader title="Recent Sessions" icon={<Clock className="w-5 h-5" />} />
              
<div className="space-y-2">
              {activityFeedWithElapsed.length === 0 ? (
                <EmptyState
                  title="No sessions tracked yet"
                  description="Start using your apps and websites to build a history."
                />
              ) : (
                [...activityFeedWithElapsed].reverse().map((item) => {
                  const tierColor = item.tier === 'productive' ? 'text-emerald-400' : 
                                   item.tier === 'distracting' ? 'text-red-400' : 'text-blue-400';
                  const bgColor = item.tier === 'productive' ? 'bg-emerald-500/10' : 
                                   item.tier === 'distracting' ? 'bg-red-500/10' : 'bg-blue-500/10';
                  const isActive = item.isActive;
                  const durationStr = isActive ? getElapsedDuration(item) : item.elapsedStr;
                  // For past items: show TIME SPENT, not "ago"
                  const statusLabel = isActive ? 'Active' : (item.elapsedStr ? item.elapsedStr : '');
                  
                  return (
                    <div key={item.id} className={`p-3 rounded-lg ${bgColor} border ${
                      item.tier === 'productive' ? 'border-emerald-500/20' : 
                      item.tier === 'distracting' ? 'border-red-500/20' : 'border-blue-500/20'
                    } flex items-center justify-between`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                          <span className="text-sm font-medium text-white">{item.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{item.category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${tierColor}`}>
                            {item.tier.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {isActive && durationStr ? (
                            <span className="font-mono text-emerald-400">{durationStr}</span>
                          ) : (
                            item.timestamp.toLocaleTimeString()
                          )} • {item.type === 'app' ? 'App' : 'Website'}{statusLabel ? ` • ${statusLabel}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
          </motion.div>
        </div>
      </div>
    </PageShell>
  );
}
