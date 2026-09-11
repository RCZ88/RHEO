import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import {
  Clock, Play, Pause, Square, Moon, Sun, BookOpen, Dumbbell, Activity,
  Bus, Book, Utensils, Coffee, Plus, X, AlertTriangle, Trash2, Save,
  TrendingUp, TrendingDown, Minus, Lightbulb, Zap, Heart, Brain,
  Code, Laptop, Wrench, Cog, Music, Gamepad2, Footprints, Droplets,
  Wind, Flame, Backpack, Dribbble, Palette, Edit3, Pencil,
  ChevronLeft, ChevronRight, GripVertical,
  ArrowRightLeft,
  Calendar,
   PieChart as PieChartIcon, BarChart3, LayoutGrid, Timer, CalendarDays, Sparkles,
   Target
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { format, subDays, addDays } from 'date-fns';
import { DurationPicker, LatencyPicker } from '../components/DurationPicker';
import { getDateRange, isInRange } from '../lib/dateRange';
import type { Period } from '../lib/dateRange';

import { maxOf, maxBy } from '../utils/safeMath';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { MagicCard } from '../components/ui/magic-card';
import { BorderBeam } from '../components/ui/border-beam';
import { NumberTicker } from '../components/ui/number-ticker';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import TransferSessionModal from '../components/TransferSessionModal';
import { EmptyState } from '../components/EmptyState';
import { computeActivityGridLayout } from '@/lib/external/grid';
import { fillGapWithSegments, type Gap } from '@/lib/external/gaps';
import { buildDailyTimeline, buildWeeklyTimeline, buildMonthlyTimeline } from '@/lib/external/timelines';
import { ActivityMosaic } from '@/components/external/ActivityMosaic';
import { DailyTimeline } from '@/components/external/DailyTimeline';
import { WeeklyTimeline } from '@/components/external/WeeklyTimeline';
import { MonthlyTimeline } from '@/components/external/MonthlyTimeline';
import { GapFillModal } from '@/components/external/GapFillModal';
import { GapsListModal } from '@/components/external/GapsListModal';
import { ManualAssignModal } from '@/components/external/ManualAssignModal';
import { ActivitySelectionOverlay } from '@/components/external/ActivitySelectionOverlay';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderInflow } from '../lib/renderers/inflow';
import { startPhaseClock } from '../lib/currentPhase';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);

interface ExternalActivity {
  id: number;
  name: string;
  type: 'stopwatch' | 'sleep' | 'checkin';
  color: string;
  icon: string;
  default_duration: number;
  is_default: number;
  is_visible: number;
  sort_order: number;
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
  daily: Array<{ date: string; sleep_seconds: number; deficit_seconds: number; pre_sleep_seconds: number; post_wake_seconds: number; bedtime_minutes: number; waketime_minutes: number; was_shifted?: boolean }>;
  average_bedtime: string;
  average_wake_time: string;
  average_sleep_duration: number;
  average_latency: number;
  average_wake_latency: number;
}

interface ActivityStats {
  today_seconds: number;
  week_seconds: number;
  month_seconds: number;
  session_count: number;
}

const ICON_MAP: Record<string, any> = {
  Clock,
  Moon,
  Sun,
  BookOpen,
  Dumbbell,
  Activity,
  Bus,
  Book,
  Utensils,
  Coffee,
  Lightbulb,
  Zap,
  Heart,
  Brain,
  Code,
  Laptop,
  Wrench,
  Cog,
  Music,
  Gamepad2,
  Footprints,
  Droplets,
  Wind,
  Flame,
  Backpack,
  Dribbble,
  Palette,
};

const AVAILABLE_ICONS = [
  { name: 'Clock', icon: Clock },
  { name: 'Moon', icon: Moon },
  { name: 'Sun', icon: Sun },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'Activity', icon: Activity },
  { name: 'Bus', icon: Bus },
  { name: 'Book', icon: Book },
  { name: 'Utensils', icon: Utensils },
  { name: 'Coffee', icon: Coffee },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Zap', icon: Zap },
  { name: 'Heart', icon: Heart },
  { name: 'Brain', icon: Brain },
  { name: 'Code', icon: Code },
  { name: 'Laptop', icon: Laptop },
  { name: 'Wrench', icon: Wrench },
  { name: 'Cog', icon: Cog },
  { name: 'Music', icon: Music },
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Footprints', icon: Footprints },
  { name: 'Droplets', icon: Droplets },
  { name: 'Wind', icon: Wind },
  { name: 'Flame', icon: Flame },
  { name: 'Backpack', icon: Backpack },
  { name: 'Dribbble', icon: Dribbble },
  { name: 'Palette', icon: Palette },
];

const ACTIVITY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
];

function getIcon(iconName: string) {
  return ICON_MAP[iconName] || Clock;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function calculateSleepDuration(start: Date, end: Date): number {
  let endMs = end.getTime();
  const startMs = start.getTime();
  if (endMs < startMs) {
    endMs += 24 * 60 * 60 * 1000;
  }
  return Math.min(endMs - startMs, 24 * 60 * 60 * 1000);
}

function formatBedtime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function ExternalPage({ selectedPeriod = 'week', dateOffset = 0, onDateOffsetChange }: { selectedPeriod?: Period; dateOffset?: number; onDateOffsetChange?: (offset: number) => void }) {
  useEffect(() => { startPhaseClock(); }, []);
  const [activities, setActivities] = useState<ExternalActivity[]>([]);
  const [orderedActivities, setOrderedActivities] = useState<ExternalActivity[]>([]);
  const dragIndex = useRef<number | null>(null);
  useEffect(() => { setOrderedActivities(activities.filter(a => a.type !== 'sleep')); }, [activities]);
  const [stats, setStats] = useState<ExternalStats>({ byActivity: {}, total_seconds: 0, sleep_deficit_seconds: 0, average_sleep_hours: 0 });
  const [consistency, setConsistency] = useState<ConsistencyData>({ score: 0, weekly_comparison: [] });
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [sleepTrends, setSleepTrends] = useState<SleepTrend>({ daily: [], average_bedtime: '', average_wake_time: '' });
  const [activeSession, setActiveSession] = useState<{ sessionId: string; activityId: string; activity: ExternalActivity; startTime: Date } | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ExternalActivity | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedDuration, setPausedDuration] = useState(0);
  const pausedAtRef = useRef<number | null>(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [wakeTime, setWakeTime] = useState({ hours: 7, minutes: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState({ name: '', type: 'stopwatch' as const, color: '#6366f1', icon: 'Clock', default_duration: 30 });
  const [activityGoals, setActivityGoals] = useState<any[]>([]);

  function formatElapsedShort(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  const [viewingActivity, setViewingActivity] = useState<ExternalActivity | null>(null);
  const [viewingActivityStats, setViewingActivityStats] = useState<any>(null);
  const [viewingActivitySessions, setViewingActivitySessions] = useState<any[]>([]);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoverySession, setRecoverySession] = useState<{ sessionId: string; activityId: string; activity: ExternalActivity; startTime: Date } | null>(null);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [addActivityError, setAddActivityError] = useState<string | null>(null);
  const [addActivitySuccess, setAddActivitySuccess] = useState(false);
  const [manualSessionActivity, setManualSessionActivity] = useState<ExternalActivity | null>(null);
  const [manualSessionHours, setManualSessionHours] = useState(0);
  const [manualSessionMinutes, setManualSessionMinutes] = useState(30);
  const [manualSessionDate, setManualSessionDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [manualSessionStartHours, setManualSessionStartHours] = useState(() => { const n = new Date(); n.setMinutes(n.getMinutes() - 30); return n.getHours(); });
  const [manualSessionStartMinutes, setManualSessionStartMinutes] = useState(() => { const n = new Date(); n.setMinutes(n.getMinutes() - 30); return n.getMinutes(); });
const [sleepDebugData, setSleepDebugData] = useState<any>(null);
  const [sleepFixResult, setSleepFixResult] = useState<{ fixed: number; problems?: number; message: string; updates?: Array<{ id: number; oldStart: string; newStart: string; oldDuration: number; newDuration: number; reason?: string }>; problems_found?: Array<{ id: number; started_at: string; ended_at: string; duration_seconds: number; pre_sleep: number; issue: string; fixed: boolean }> } | null>(null);
  const [showSleepFixModal, setShowSleepFixModal] = useState(false);
   const dateInputRef = useRef<HTMLInputElement>(null);

   const prevDay = () => {
     const d = new Date(manualSessionDate);
     d.setDate(d.getDate() - 1);
     setManualSessionDate(format(d, "yyyy-MM-dd"));
   };
   const nextDay = () => {
     const d = new Date(manualSessionDate);
     d.setDate(d.getDate() + 1);
     setManualSessionDate(format(d, "yyyy-MM-dd"));
   };

   const formattedDate = format(new Date(manualSessionDate), "PPP");
   const dayName = format(new Date(manualSessionDate), "EEEE");

   // Sync timer state to the shared deskflow-timer-state so Dashboard picks it up
  const syncTimerStateToDashboard = useCallback((running: boolean, activity?: ExternalActivity | null, startTime?: Date | null) => {
    const state = {
      productiveMs: 0,
      startTime: 0,
      paused: false,
      lastTier: null,
      externalRunning: running,
      externalStart: running && startTime ? startTime.getTime() : null,
      externalElapsed: 0,
      selectedExternalActivity: running && activity ? { id: activity.id, name: activity.name } : null
    };
    try {
      localStorage.setItem('deskflow-timer-state', JSON.stringify(state));
      window.dispatchEvent(new Event('timer-sync'));
    } catch (e) {
      console.error('[ExternalPage] Failed to sync timer state:', e);
    }
  }, []);
  const [editingActivity, setEditingActivity] = useState<ExternalActivity | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editActivityError, setEditActivityError] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editingSessionTimes, setEditingSessionTimes] = useState({ started_at: '', ended_at: '' });
  const [transferSession, setTransferSession] = useState<any | null>(null);
  const [showPastSleepModal, setShowPastSleepModal] = useState(false);
  const [pastDeviceOff, setPastDeviceOff] = useState({ hours: 22, minutes: 0 });
  const [pastWakeupTime, setPastWakeupTime] = useState({ hours: 7, minutes: 0 });
  const [pastDeviceOn, setPastDeviceOn] = useState({ hours: 7, minutes: 30 });
  const [pastFellAsleepAt, setPastFellAsleepAt] = useState({ hours: 22, minutes: 30 });
  const [pastSleepError, setPastSleepError] = useState<string | null>(null);
  const [pastSleepSuccess, setPastSleepSuccess] = useState(false);
  const localDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [pastSleepDate, setPastSleepDate] = useState(() => {
    try { return localStorage.getItem('external-sleep-date') || localDateStr(new Date()); }
    catch { return localDateStr(new Date()); }
  });
  // Persist sleep date selection
  useEffect(() => {
    try { localStorage.setItem('external-sleep-date', pastSleepDate); } catch {}
  }, [pastSleepDate]);
  const [pastWakeupDate, setPastWakeupDate] = useState<string | null>(null);
  const [pastSleepSessionId, setPastSleepSessionId] = useState<string | null>(null);
  const [pastOriginalStartedAt, setPastOriginalStartedAt] = useState<string | null>(null);
  const [showMorningPrompt, setShowMorningPrompt] = useState(false);
  const [dragSourceDate, setDragSourceDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const dragDidFireRef = useRef(false);
  const [morningPromptData, setMorningPromptData] = useState<{ lastCloseTime: number; lastCloseType: string } | null>(null);
  const [sleepLatencyMinutes, setSleepLatencyMinutes] = useState(15);
  const [wakeUpMinutes, setWakeUpMinutes] = useState(5);
  const [vizTab, setVizTab] = useState<'grid' | 'daily' | 'weekly' | 'monthly'>('grid');
  const [gapTarget, setGapTarget] = useState<{ id: string; start: Date; end: Date; duration_seconds: number } | null>(null);
  const [gapTargets, setGapTargets] = useState<Gap[]>([]);
  const [showGapsList, setShowGapsList] = useState(false);
  const [showManualAssign, setShowManualAssign] = useState(false);
  const [manualAssignGap, setManualAssignGap] = useState<{ start: Date; end: Date } | null>(null);
  const [manualAssignDate, setManualAssignDate] = useState<Date | null>(null);
  const [manualVersion, setManualVersion] = useState(0);
  const [viewDate, setViewDate] = useState<Date | null>(null);

  // Load existing sleep data when date changes in the modal (add mode only)
  useEffect(() => {
    if (!showPastSleepModal || !pastSleepDate || !window.deskflowAPI?.getSleepForDate) return;
    // In edit mode (pastSleepSessionId set), don't reload — date change is a MOVE, not a search
    if (pastSleepSessionId) return;
    (async () => {
      try {
        const existing = await window.deskflowAPI.getSleepForDate!(pastSleepDate);
        if (existing) {
          setPastSleepSessionId(existing.id);
          setPastOriginalStartedAt(existing.started_at);
          const startD = new Date(existing.started_at);
          // Resync the search box to the date the sleep BELONGS to: bedtime past
          // midnight (before 12:00) belongs to the PREVIOUS day's sleep (e.g.,
          // 3:03 AM on Aug 12 = Aug 11's sleep). Keeps the belonging date visible
          // and guarantees saving never shifts the actual stored dates.
          if (startD.getHours() < 12) {
            const groupD = new Date(startD);
            groupD.setDate(groupD.getDate() - 1);
            setPastSleepDate(localDateStr(groupD));
          }
          const endD = new Date(existing.ended_at);
          setPastDeviceOff({ hours: startD.getHours(), minutes: startD.getMinutes() });
          // fell asleep = device off + pre-sleep latency
          const fellAt = new Date(startD.getTime() + (existing.device_off_to_sleep_seconds || 0) * 1000);
          setPastFellAsleepAt({ hours: fellAt.getHours(), minutes: fellAt.getMinutes() });
          setPastWakeupTime({ hours: endD.getHours(), minutes: endD.getMinutes() });
          // device on = wake up + post-wake latency
          const onAt = new Date(endD.getTime() + (existing.wake_up_to_app_seconds || 0) * 1000);
          setPastDeviceOn({ hours: onAt.getHours(), minutes: onAt.getMinutes() });
          setPastWakeupDate(localDateStr(endD));
        } else {
          setPastSleepSessionId(null);
          setPastOriginalStartedAt(null);
          setPastDeviceOff({ hours: 22, minutes: 0 });
          setPastFellAsleepAt({ hours: 22, minutes: 30 });
          setPastWakeupTime({ hours: 7, minutes: 0 });
          setPastDeviceOn({ hours: 7, minutes: 30 });
          setPastWakeupDate(null);
        }
      } catch {}
    })();
  }, [pastSleepDate, showPastSleepModal]);

  // Load activities and check for active session on mount
  useEffect(() => {
    console.log('[ExternalPage] Mounting, loading...');
    
    // Check for morning prompt
    if (window.deskflowAPI?.getMorningPrompt) {
      window.deskflowAPI.getMorningPrompt().then((data) => {
        if (data && data.show) {
          console.log('[ExternalPage] Morning prompt available:', data);
          setMorningPromptData(data);
          setShowMorningPrompt(true);
        }
      });
    }
    
    // First, load activities
    if (window.deskflowAPI?.getExternalActivities) {
      window.deskflowAPI.getExternalActivities().then((data) => {
        console.log('[ExternalPage] Loaded activities:', data.length);
        setActivities(data);
        
        // Load activity goals
        if (window.deskflowAPI?.activityGoalGetAll) {
          window.deskflowAPI.activityGoalGetAll().then((goals) => {
            setActivityGoals(goals);
          }).catch(() => {});
        }
        
        // After activities load, check for active session
        if (window.deskflowAPI?.getActiveExternalSession) {
          window.deskflowAPI.getActiveExternalSession().then((session) => {
            console.log('[ExternalPage] Checked active session:', session);
            if (session) {
              const activity = data.find((a: any) => a.id === session.activity_id);
              if (activity) {
                handleRestoreSession(session, activity);
              } else {
                console.log('[ExternalPage] Activity not found for session:', session.activity_id);
              }
            }
          }).catch(err => console.error('[ExternalPage] Failed to get active session:', err));
        }
      }).catch(err => console.error('[ExternalPage] Failed to load activities:', err));
    }
  }, []);

  // Enter key to start selected activity, ESC to unselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedActivity && !activeSession) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[ExternalPage] Enter: Starting activity:', selectedActivity.name);
        startActivity(selectedActivity);
        setSelectedActivity(null);
      } else if (e.key === 'Escape' && selectedActivity && !activeSession) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[ExternalPage] ESC: Unselecting activity');
        setSelectedActivity(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedActivity, activeSession]);

  const handleRestoreSession = (session: any, activity: any) => {
    const startTime = new Date(session.started_at);
    const now = new Date();
    const durationHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const startHour = startTime.getHours();
    
    const isNightSleep = startHour >= 22 || startHour <= 4;
    const isLongSession = durationHours >= 3;
    
    if (isLongSession || isNightSleep) {
      setRecoverySession({
        sessionId: session.id.toString(),
        activityId: session.activity_id.toString(),
        activity: activity,
        startTime,
      });
      setShowRecoveryModal(true);
    } else {
      // For short sessions, just resume directly
      setActiveSession({
        sessionId: session.id.toString(),
        activityId: session.activity_id.toString(),
        activity: activity,
        startTime: startTime,
      });
      syncTimerStateToDashboard(true, activity, startTime);
    }
  };

  // Load stats
  const currentRange = useMemo(() =>
    getDateRange(selectedPeriod, dateOffset),
    [selectedPeriod, dateOffset]
  );

  useEffect(() => {
    if (window.deskflowAPI?.getExternalStats) {
      window.deskflowAPI.getExternalStats(selectedPeriod).then(setStats);
    }
    if (window.deskflowAPI?.getExternalSessions) {
      window.deskflowAPI.getExternalSessions('all').then(setAllSessions);
    }
    if (window.deskflowAPI?.getConsistencyScore) {
      window.deskflowAPI.getConsistencyScore(selectedPeriod === 'week' || selectedPeriod === '7day' || selectedPeriod === 'today' ? 'week' : 'month').then(setConsistency);
    }
    if (window.deskflowAPI?.getSleepTrends) {
      window.deskflowAPI.getSleepTrends(selectedPeriod, dateOffset).then(setSleepTrends);
    }
  }, [selectedPeriod, dateOffset]);

  // Load ALL sessions for the viewing activity (client-side period/offset filtering)
  useEffect(() => {
    if (viewingActivity && window.deskflowAPI?.getExternalSessions) {
      window.deskflowAPI.getExternalSessions('all').then((sessions: any) => {
        setViewingActivitySessions(sessions.filter((s: any) => s.activity_id === viewingActivity.id));
      });
    }
  }, [viewingActivity]);

  // Reload viewing activity sessions after data changes (sleep add/edit)
  useEffect(() => {
    if (viewingActivity && window.deskflowAPI?.getExternalSessions) {
      window.deskflowAPI.getExternalSessions('all').then((sessions: any) => {
        setViewingActivitySessions(sessions.filter((s: any) => s.activity_id === viewingActivity.id));
      });
    }
  }, [viewingActivity, allSessions]);

  // Filter sessions by selected period + offset + range mode
  const filteredViewSessions = useMemo(() => {
    const range = getDateRange(selectedPeriod, dateOffset);
    return viewingActivitySessions.filter((s: any) => isInRange(s.started_at, range));
  }, [viewingActivitySessions, selectedPeriod, dateOffset]);

  // Timer interval
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0);
      setPausedDuration(0);
      setIsPaused(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (isPaused) return;
      const totalPausedMs = pausedDuration + (pausedAtRef.current !== null ? now - pausedAtRef.current : 0);
      const elapsed = Math.floor((now - activeSession.startTime.getTime() - totalPausedMs) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, isPaused, pausedDuration]);

  // Start activity
  const startActivity = useCallback(async (activity: ExternalActivity) => {
    if (window.deskflowAPI?.getActivityStats) {
      window.deskflowAPI.getActivityStats(activity.id.toString()).then(setActivityStats);
    }
    const now = new Date();
    if (activity.type === 'sleep') {
      if (window.deskflowAPI?.startExternalSession) {
        const result = await window.deskflowAPI.startExternalSession(activity.id.toString());
        if (result.success) {
          setActiveSession({
            sessionId: result.sessionId,
            activityId: activity.id.toString(),
            activity,
            startTime: now,
          });
          syncTimerStateToDashboard(true, activity, now);
        }
      }
    } else if (activity.type === 'stopwatch') {
      // Save to database first, then set active session
      if (window.deskflowAPI?.startExternalSession) {
        const result = await window.deskflowAPI.startExternalSession(activity.id.toString());
        if (result.success) {
          setActiveSession({
            sessionId: result.sessionId,
            activityId: activity.id.toString(),
            activity,
            startTime: now,
          });
          syncTimerStateToDashboard(true, activity, now);
        }
      } else {
        // Fallback for web mode
        setActiveSession({
          sessionId: 'temp-' + Date.now(),
          activityId: activity.id.toString(),
          activity,
          startTime: now,
        });
        syncTimerStateToDashboard(true, activity, now);
      }
    } else if (activity.type === 'checkin') {
      if (window.deskflowAPI?.startExternalSession && window.deskflowAPI?.stopExternalSession) {
        const startResult = await window.deskflowAPI.startExternalSession(activity.id.toString());
        if (startResult.success) {
          const durationMs = ((activity.default_duration || 30) * 60 * 1000);
          const endTime = new Date(Date.now() + durationMs);
          await window.deskflowAPI.stopExternalSession(startResult.sessionId, endTime.toISOString());
          refreshStats();
        }
      }
    }
  }, []);

  const refreshStats = useCallback(() => {
    const p = selectedPeriod;
    const off = dateOffset;
    if (window.deskflowAPI?.getExternalStats) {
      window.deskflowAPI.getExternalStats(p).then(setStats);
    }
    if (window.deskflowAPI?.getExternalSessions) {
      window.deskflowAPI.getExternalSessions('all').then(setAllSessions);
    }
    if (window.deskflowAPI?.getConsistencyScore) {
      window.deskflowAPI.getConsistencyScore(p === 'week' || p === '7day' || p === 'today' ? 'week' : 'month').then(setConsistency);
    }
    if (window.deskflowAPI?.getSleepTrends) {
      window.deskflowAPI.getSleepTrends(p, off).then(setSleepTrends);
    }
  }, [selectedPeriod, dateOffset]);

  const handleDropSleep = useCallback(async (sourceDate: string, targetDate: string) => {
    if (sourceDate === targetDate) return;
    try {
      const existing = await (window as any).deskflowAPI?.getSleepForDate?.(sourceDate);
      if (!existing?.id) return;
      const startMs = new Date(existing.started_at).getTime();
      const preSleep = existing.device_off_to_sleep_seconds || 0;
      const postWake = existing.wake_up_to_app_seconds || 0;
      const srcDay = new Date(sourceDate + 'T00:00:00');
      const tgtDay = new Date(targetDate + 'T00:00:00');
      const shiftMs = tgtDay.getTime() - srcDay.getTime();
      const newStart = new Date(startMs + shiftMs);
      const newEndMs = new Date(existing.ended_at).getTime() + shiftMs;
      await (window as any).deskflowAPI?.updateManualSleep?.(String(existing.id), {
        started_at: newStart.toISOString(),
        ended_at: new Date(newEndMs).toISOString(),
        device_off_to_sleep_seconds: preSleep,
        wake_up_to_app_seconds: postWake,
      });
      window.dispatchEvent(new CustomEvent('external-data-changed'));
      refreshStats();
    } catch (e) {
      console.error('[ExternalPage] Failed to move sleep:', e);
    }
  }, [refreshStats]);

  // Listen for sleep-confirmed event from Sleep Detection modal
  useEffect(() => {
    const handleSleepConfirmed = () => {
      refreshStats();
      if (window.deskflowAPI?.getExternalActivities) {
        window.deskflowAPI.getExternalActivities().then((data: any[]) => setActivities(data));
      }
    };
    window.addEventListener('sleep-confirmed', handleSleepConfirmed);
    return () => window.removeEventListener('sleep-confirmed', handleSleepConfirmed);
  }, [refreshStats]);

  // Listen for external-data-changed event from AFK prompt (App.tsx)
  useEffect(() => {
    const handleExternalDataChanged = () => {
      refreshStats();
      if (window.deskflowAPI?.getExternalActivities) {
        window.deskflowAPI.getExternalActivities().then((data: any[]) => setActivities(data));
      }
    };
    window.addEventListener('external-data-changed', handleExternalDataChanged);
    return () => window.removeEventListener('external-data-changed', handleExternalDataChanged);
  }, [refreshStats]);

  // Pause activity
  const pauseActivity = useCallback(() => {
    pausedAtRef.current = Date.now();
    setIsPaused(true);
  }, []);

  // Resume activity
  const resumeActivity = useCallback(() => {
    if (pausedAtRef.current !== null) {
      setPausedDuration(prev => prev + (Date.now() - pausedAtRef.current!));
      pausedAtRef.current = null;
    }
    setIsPaused(false);
  }, []);

  // Stop activity
  const stopActivity = useCallback(async () => {
    if (!activeSession) return;

    if (activeSession.activity.type === 'sleep') {
      setShowSleepModal(true);
    } else {
      if (activeSession.activity.type === 'stopwatch') {
        if (activeSession.sessionId.startsWith('temp-')) {
          console.log('[ExternalPage] Stopping local session');
        } else if (window.deskflowAPI?.stopExternalSession) {
          const adjustedEnd = new Date(activeSession.startTime.getTime() + elapsedSeconds * 1000);
          console.log('[ExternalPage] Stopping DB session:', activeSession.sessionId);
          await window.deskflowAPI.stopExternalSession(activeSession.sessionId, adjustedEnd.toISOString());
        }
      }
      setActiveSession(null);
      setIsPaused(false);
      setPausedDuration(0);
      pausedAtRef.current = null;
      setElapsedSeconds(0);
      syncTimerStateToDashboard(false);
      refreshStats();
    }
  }, [activeSession, elapsedSeconds, refreshStats, syncTimerStateToDashboard]);

  // Confirm wake up
  const confirmWakeUp = useCallback(async () => {
    if (!activeSession || activeSession.activity.type !== 'sleep') return;

    const now = new Date();
    const wakeDate = new Date();
    wakeDate.setHours(wakeTime.hours, wakeTime.minutes, 0, 0);

    const startDate = activeSession.startTime;
    const startMs = startDate.getTime();
    const wakeMs = wakeDate.getTime();

    if (wakeMs < startMs) {
      wakeDate.setDate(wakeDate.getDate() + 1);
    }

    if (window.deskflowAPI?.stopExternalSession) {
      await window.deskflowAPI.stopExternalSession(
        activeSession.sessionId,
        wakeDate.toISOString(),
        sleepLatencyMinutes * 60,
        wakeUpMinutes * 60
      );
    }

    setShowSleepModal(false);
    setActiveSession(null);
    setIsPaused(false);
    setPausedDuration(0);
    pausedAtRef.current = null;
    setElapsedSeconds(0);
    syncTimerStateToDashboard(false);
    refreshStats();
  }, [activeSession, wakeTime, sleepLatencyMinutes, wakeUpMinutes, refreshStats, syncTimerStateToDashboard]);

  // Cancel sleep
  const cancelSleep = useCallback(async () => {
    if (!activeSession) return;
    setActiveSession(null);
    setIsPaused(false);
    setPausedDuration(0);
    pausedAtRef.current = null;
    setElapsedSeconds(0);
    setShowSleepModal(false);
    syncTimerStateToDashboard(false);
  }, [activeSession, syncTimerStateToDashboard]);

  // Save custom activity
  const saveCustomActivity = useCallback(async () => {
    if (!newActivity.name.trim()) {
      setAddActivityError('Activity name cannot be empty');
      return;
    }

    try {
      setAddActivityError(null);
      setAddActivitySuccess(false);

      if (window.deskflowAPI?.addExternalActivity) {
        const result = await window.deskflowAPI.addExternalActivity({
          name: newActivity.name,
          type: newActivity.type,
          color: newActivity.color,
          icon: newActivity.icon,
          default_duration: newActivity.default_duration,
        });
        
        if (!result) {
          throw new Error('Failed to create activity');
        }

        // Reload activities
        if (window.deskflowAPI?.getExternalActivities) {
          const updated = await window.deskflowAPI.getExternalActivities();
          setActivities(updated);
        }

        setAddActivitySuccess(true);
        setShowAddModal(false);
        setNewActivity({ name: '', type: 'stopwatch', color: '#6366f1', icon: 'Clock', default_duration: 30 });
        
        // Clear success message after 3 seconds
        setTimeout(() => setAddActivitySuccess(false), 3000);
      } else {
        throw new Error('API not available');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setAddActivityError(errorMsg);
      console.error('[ExternalPage] Error adding activity:', err);
    }
  }, [newActivity]);

  // Activity breakdown chart data
  const breakdownData = useMemo(() => {
    const labels = Object.keys(stats.byActivity);
    const data = labels.map(name => (stats.byActivity[name]?.total_seconds || 0) / 3600);
    const colors = labels.map(name => {
      const activity = activities.find(a => a.name === name);
      return activity?.color || '#6366f1';
    });

    return { labels, data, colors };
  }, [stats, activities]);

  // Period + range-mode responsive trend chart data
  const trendChartData = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const range = currentRange;
    const bars: { label: string; hours: number }[] = [];

    if (selectedPeriod === 'today') {
      const rangeSessions = allSessions.filter((s: any) => isInRange(s.started_at, range));
      for (let h = 0; h < 24; h++) {
        const hourStart = new Date(range.start);
        hourStart.setHours(h);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(h + 1);
        let sec = 0;
        rangeSessions.forEach((s: any) => {
          const sStart = new Date(s.started_at);
          const sEnd = s.ended_at ? new Date(s.ended_at) : new Date(sStart.getTime() + (s.duration_seconds || 0) * 1000);
          const oStart = sStart > hourStart ? sStart : hourStart;
          const oEnd = sEnd < hourEnd ? sEnd : hourEnd;
          if (oStart < oEnd) sec += (oEnd.getTime() - oStart.getTime()) / 1000;
        });
        bars.push({ label: `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`, hours: sec / 3600 });
      }
    } else if (selectedPeriod === 'week' || selectedPeriod === '7day') {
      for (let i = 0; i < 7; i++) {
        const d = new Date(range.start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const daySec = allSessions
          .filter((s: any) => isInRange(s.started_at, range) && s.started_at?.split('T')[0] === dateStr)
          .reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
        bars.push({ label: dayNames[d.getDay()], hours: daySec / 3600 });
      }
    } else if (selectedPeriod === 'month' || selectedPeriod === '30day') {
      const daysInRange = Math.round((range.end.getTime() - range.start.getTime()) / 86400000);
      for (let i = 0; i < daysInRange; i++) {
        const d = new Date(range.start.getTime() + i * 86400000);
        const dateStr = d.toISOString().split('T')[0];
        const daySec = allSessions
          .filter((s: any) => s.started_at?.split('T')[0] === dateStr)
          .reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
        bars.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), hours: daySec / 3600 });
      }
    } else {
      const monthMap: Record<string, { label: string; seconds: number }> = {};
      allSessions.forEach((s: any) => {
        if (!s.started_at) return;
        const d = new Date(s.started_at);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthMap[key]) monthMap[key] = { label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), seconds: 0 };
        monthMap[key].seconds += s.duration_seconds || 0;
      });
      Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([, v]) => {
        bars.push({ label: v.label, hours: v.seconds / 3600 });
      });
    }

    return { labels: bars.map(b => b.label), data: bars.map(b => b.hours) };
  }, [allSessions, selectedPeriod, currentRange]);

  // Activity grid layout via squarified treemap
  const gridLayout = useMemo(() => {
    return computeActivityGridLayout({
      activities: orderedActivities,
      stats,
      aspect: 16 / 9,
      width: 1200,
    });
  }, [orderedActivities, stats]);

  // Usage-based gaps (holes where NO app/browser/external activity was tracked) —
  // the OLD detect-usage-gaps logic; feeds timeline gap blocks.
  const [usageGaps, setUsageGaps] = useState<Gap[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUsageGaps(null);

    const period =
      selectedPeriod === 'today'
        ? 'today'
        : selectedPeriod === 'month' || selectedPeriod === '30day'
          ? 'month'
          : selectedPeriod === 'all'
            ? 'all'
            : 'week';

    (window as any).deskflowAPI?.detectUsageGaps?.({ period, minGapMinutes: 5 })
      .then((list: any[]) => {
        if (cancelled) return;
        const mapped: Gap[] = (list || []).map((gap: any) => ({
          id: `${gap.start}-${gap.end}`,
          start: new Date(gap.start),
          end: new Date(gap.end),
          duration_seconds: Math.max(
            0,
            Math.floor((new Date(gap.end).getTime() - new Date(gap.start).getTime()) / 1000)
          ),
        }));
        setUsageGaps(mapped);
      })
      .catch(() => {
        if (!cancelled) setUsageGaps([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPeriod, dateOffset, manualVersion]);

  // Timeline data via new modules
  const dailyData = useMemo(() => {
    return buildDailyTimeline({
      date: viewDate ?? new Date(),
      sessions: allSessions,
      activities: orderedActivities,
      usageGaps,
    });
  }, [allSessions, orderedActivities, viewDate, usageGaps]);

  const weeklyData = useMemo(() => {
    const range = getDateRange('week', dateOffset);
    return buildWeeklyTimeline({
      date: range.start,
      sessions: allSessions,
      activities: orderedActivities,
      usageGaps,
    });
  }, [allSessions, orderedActivities, dateOffset, usageGaps]);

  const monthlyData = useMemo(() => {
    const range = getDateRange('month', dateOffset);
    return buildMonthlyTimeline({
      date: range.start,
      sessions: allSessions,
      activities: orderedActivities,
      usageGaps,
    });
  }, [allSessions, orderedActivities, dateOffset, usageGaps]);

  // Timeframe the Gaps list should open on, mirroring the selected period
  const gapsDefaultTimeframe = useMemo(() => {
    if (selectedPeriod === 'today') return 'day' as const;
    if (selectedPeriod === 'month' || selectedPeriod === '30day') return 'month' as const;
    if (selectedPeriod === 'all') return 'all' as const;
    return 'week' as const;
  }, [selectedPeriod]);

  // Drill-down to a specific day resets when the period/offset changes
  useEffect(() => {
    setViewDate(null);
  }, [selectedPeriod, dateOffset]);

  // Load viewing activity data
  const handleLoadViewingActivity = useCallback(async (activity: ExternalActivity) => {
    setViewingActivity(activity);
    setViewingActivityStats(null);
    setViewingActivitySessions([]);
    if (window.deskflowAPI?.getExternalSessions) {
      const sessions = await window.deskflowAPI.getExternalSessions(selectedPeriod);
      setViewingActivitySessions(sessions.filter((s: any) => s.activity_id === activity.id));
    }
  }, [selectedPeriod]);

  // Beautiful-charts (Hyper Charts) helpers: soft gradient bar fills, neon caps, glass tooltips
  const hexWithAlpha = (color: string, alpha: string) =>
    /^#[0-9a-fA-F]{6}$/.test(color) ? color + alpha : color;
  const barGradient = (color: string) => (ctx: any) => {
    const area = ctx.chart?.chartArea;
    if (!area) return color;
    const g = ctx.chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
    g.addColorStop(0, hexWithAlpha(color, '22'));
    g.addColorStop(1, hexWithAlpha(color, 'E6'));
    return g;
  };
  const glassTooltip = {
    backgroundColor: 'rgba(20, 22, 30, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 10,
    titleColor: '#ffffff',
    bodyColor: '#a1a1aa',
    displayColors: false,
    boxPadding: 4,
  };

  return (
    <PageShell page="external" variant="sticky-header">
      <CurrentCanvas accent="#f59e0b" render={renderInflow} />
      <div className="relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.dispatchEvent(new Event('open-gap-drawer'))}
            title="Fill gaps with tracked apps, websites, or external activities"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-400 hover:text-indigo-300 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Smart Fill
          </button>
          <button onClick={() => setShowGapsList(true)} className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition">Gaps</button>
          <button onClick={() => setShowPastSleepModal(true)} className="px-3 py-1.5 rounded-lg text-sm text-amber-400 hover:text-amber-300 transition">+ Sleep</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-5">
        {/* Active Timer View */}
        <AnimatePresence>
          {activeSession && (
            <motion.div
              data-tutorial="external.timer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8"
            >
              <div className="relative overflow-hidden rounded-xl">
                <div className="absolute -inset-1 opacity-15 blur-2xl rounded-xl" style={{ background: `radial-gradient(ellipse at center, ${activeSession.activity.color} 0%, transparent 70%)` }} />
                <div className="relative rounded-xl bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 p-5 flex flex-col items-center">
                  {activeSession.activity.type === 'sleep' ? (
                    <div className="text-center">
                      <div className="text-6xl mb-4">😴</div>
                      <div className="text-2xl font-bold text-zinc-100 mb-2">Sleeping</div>
                      <div className="text-xl text-zinc-300">Since {formatBedtime(activeSession.startTime)}</div>
                      
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <MagicCard gradientFrom="#f59e0b" gradientTo="#d97706" gradientSize={200} className="rounded-xl p-3 text-center">
                          <div className="text-xs text-zinc-400">Bedtime</div>
                          <div className="text-lg font-bold text-amber-400">{formatBedtime(activeSession.startTime)}</div>
                        </MagicCard>
                        <MagicCard gradientFrom="#3b82f6" gradientTo="#6366f1" gradientSize={200} className="rounded-xl p-3 text-center">
                          <div className="text-xs text-zinc-400">Elapsed</div>
                          <div className="text-lg font-bold text-zinc-100">{formatDuration(elapsedSeconds)}</div>
                        </MagicCard>
                      </div>
                      
                      <div className="mt-4 text-sm text-zinc-500">
                        Target: 8h • {Math.round(elapsedSeconds / 3600 * 10) / 10}h logged
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center w-full">
                      <div className="flex items-center gap-3 mb-2 self-start">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center">
                          {(() => { const Icon = getIcon(activeSession.activity.icon); return <Icon className="w-5 h-5" style={{ color: activeSession.activity.color }} />; })()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-zinc-100">{activeSession.activity.name}</div>
                          {isPaused ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Paused
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Tracking
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="my-8">
                        {(() => {
                          const h = Math.floor(elapsedSeconds / 3600);
                          const m = Math.floor((elapsedSeconds % 3600) / 60);
                          const s = elapsedSeconds % 60;
                          const pad = (n: number) => String(n).padStart(2, '0');
                          return (
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex flex-col items-center min-w-[76px]">
                                <div className="text-6xl font-mono font-bold tracking-tight text-white tabular-nums leading-none">
                                  {pad(h)}
                                </div>
                                <span className="text-[9px] uppercase tracking-[0.25em] text-zinc-600 mt-2 font-medium">HR</span>
                              </div>
                              <span className="text-4xl font-light text-zinc-700 mt-4">:</span>
                              <div className="flex flex-col items-center min-w-[76px]">
                                <div className="text-6xl font-mono font-bold tracking-tight text-white tabular-nums leading-none">
                                  {pad(m)}
                                </div>
                                <span className="text-[9px] uppercase tracking-[0.25em] text-zinc-600 mt-2 font-medium">MIN</span>
                              </div>
                              <span className="text-4xl font-light text-zinc-700 mt-4">:</span>
                              <div className="flex flex-col items-center min-w-[76px]">
                                <div className="text-6xl font-mono font-bold tracking-tight text-white tabular-nums leading-none">
                                  {pad(s)}
                                </div>
                                <span className="text-[9px] uppercase tracking-[0.25em] text-zinc-600 mt-2 font-medium">SEC</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-8">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        Started {formatBedtime(activeSession.startTime)}
                      </div>

                      <div className="flex items-center gap-3">
                        {isPaused ? (
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={resumeActivity}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
                                       bg-emerald-500/10 text-emerald-400 border border-emerald-500/25
                                       hover:bg-emerald-500/20 hover:border-emerald-400/40
                                       transition-colors duration-150 duration-200"
                          >
                            <Play className="w-4 h-4" />
                            Resume
                          </motion.button>
                        ) : (
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={pauseActivity}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
                                       bg-amber-500/10 text-amber-400 border border-amber-500/25
                                       hover:bg-amber-500/20 hover:border-amber-400/40
                                       transition-colors duration-150 duration-200"
                          >
                            <Pause className="w-4 h-4" />
                            Pause
                          </motion.button>
                        )}
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={stopActivity}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium
                                     bg-red-500/10 text-red-400 border border-red-500/25
                                     hover:bg-red-500/20 hover:border-red-400/40
                                     transition-colors duration-150 duration-200"
                        >
                          <Square className="w-4 h-4" />
                          Stop
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>

        {/* Inline Activity Detail View */}
        {viewingActivity && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: viewingActivity.color }}>{(() => { const Icon = getIcon(viewingActivity.icon); return <Icon className="w-6 h-6 text-white" />; })()}</div>
                <div>
                  <div className="text-xl font-semibold">{viewingActivity.name}</div>
                  <div className="text-sm text-zinc-500">Activity details</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Period label */}
                <span className="text-xs text-zinc-500 select-none">
                  {getDateRange(selectedPeriod, dateOffset).label}
                </span>
                <button onClick={() => setViewingActivity(null)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {(() => {
              const filtered = filteredViewSessions;
              const barChartHeight = 100;
              const barChartMaxHeight = 140;
              const hourChartHeight = 60;
              const hourChartMaxHeight = 80;
              const getNiceMax = (maxSec: number) => {
                const maxHours = maxSec / 3600;
                if (maxHours <= 0.5) return 0.5;
                if (maxHours <= 1) return 1;
                if (maxHours <= 2) return 2;
                if (maxHours <= 4) return 4;
                if (maxHours <= 6) return 6;
                if (maxHours <= 8) return 8;
                return Math.ceil(maxHours / 4) * 4;
              };

              return (
                <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <MagicCard gradientFrom="#a855f7" gradientTo="#6366f1" gradientSize={200} className="rounded-xl text-center">
                <div className="p-3">
                  <div className="text-xs text-zinc-400">Avg Session</div>
                  <div className="text-lg font-bold text-zinc-100">{filtered.length > 0 ? (() => { const total = filtered.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0); return formatHours(total / filtered.length); })() : '--'}</div>
                </div>
              </MagicCard>
              <MagicCard gradientFrom="#10b981" gradientTo="#34d399" gradientSize={200} className="rounded-xl text-center">
                <div className="p-3">
                  <div className="text-xs text-zinc-400">Sessions</div>
                  <div className="text-lg font-bold text-zinc-100"><NumberTicker value={filtered.length} /></div>
                </div>
              </MagicCard>
              <MagicCard gradientFrom="#f59e0b" gradientTo="#fbbf24" gradientSize={200} className="rounded-xl text-center">
                <div className="p-3">
                  <div className="text-xs text-zinc-400">Active Days</div>
                  <div className="text-lg font-bold text-zinc-100"><NumberTicker value={new Set(filtered.map((s: any) => s.started_at?.split('T')[0])).size} /></div>
                </div>
              </MagicCard>
            </div>
            {filtered.length > 0 && (
              <div className="mb-4">
                <div className="flex mt-2 mb-3">
                  {/* Daily Activity */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-end justify-between mb-1">
                      <div className="text-sm font-medium text-zinc-400">
                        {selectedPeriod === 'today' ? 'Hourly Activity' : selectedPeriod === 'week' || selectedPeriod === '7day' ? 'Daily Activity' : selectedPeriod === 'month' || selectedPeriod === '30day' ? 'Daily Activity' : 'Monthly Activity'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {/* Y-Axis */}
                      <div className="flex flex-col justify-between items-end text-[9px] font-medium text-zinc-600 pr-1 flex-shrink-0 select-none leading-none" style={{ height: `${barChartMaxHeight}px` }}>
                        {(() => {
                          const maxSec = maxOf((() => {
                            if (selectedPeriod === 'today') {
                              const now = new Date();
                              const todayStart = new Date(now);
                              todayStart.setDate(todayStart.getDate() - dateOffset);
                              todayStart.setHours(0, 0, 0, 0);
                              const bars: number[] = [];
                              for (let h = 0; h < 24; h++) {
                                const hourStart = new Date(todayStart);
                                hourStart.setHours(h);
                                const hourEnd = new Date(hourStart);
                                hourEnd.setHours(h + 1);
                                let sec = 0;
                                filtered.forEach((s: any) => {
                                  const sStart = new Date(s.started_at);
                                  const sEnd = s.ended_at ? new Date(s.ended_at) : new Date(sStart.getTime() + (s.duration_seconds || 0) * 1000);
                                  const overlapStart = sStart > hourStart ? sStart : hourStart;
                                  const overlapEnd = sEnd < hourEnd ? sEnd : hourEnd;
                                  if (overlapStart < overlapEnd) sec += (overlapEnd.getTime() - overlapStart.getTime()) / 1000;
                                });
                                bars.push(sec);
                              }
                              return bars;
                            } else if (selectedPeriod === 'week' || selectedPeriod === '7day') {
                              const now = new Date();
                              const weekStart = new Date(now);
                              const day = weekStart.getDay();
                              const diff = day === 0 ? 6 : day - 1;
                              weekStart.setDate(weekStart.getDate() - diff - dateOffset * 7);
                              weekStart.setHours(0, 0, 0, 0);
                              const bars: number[] = [];
                              for (let i = 0; i < 7; i++) {
                                const d = new Date(weekStart);
                                d.setDate(d.getDate() + i);
                                const dateStr = d.toISOString().split('T')[0];
                                bars.push(filtered.filter((s: any) => s.started_at?.split('T')[0] === dateStr).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0));
                              }
                              return bars;
                            } else if (selectedPeriod === 'month' || selectedPeriod === '30day') {
                              const targetMonth = new Date(new Date().getFullYear(), new Date().getMonth() - dateOffset, 1);
                              const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
                              const bars: number[] = [];
                              for (let day = 1; day <= daysInMonth; day++) {
                                const d = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
                                const dateStr = d.toISOString().split('T')[0];
                                bars.push(filtered.filter((s: any) => s.started_at?.split('T')[0] === dateStr).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0));
                              }
                              return bars;
                            } else {
                              const monthMap: Record<string, number> = {};
                              filtered.forEach((s: any) => {
                                const d = new Date(s.started_at);
                                const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
                                if (!monthMap[key]) monthMap[key] = 0;
                                monthMap[key] += s.duration_seconds || 0;
                              });
                              return Object.values(monthMap);
                            }
                          })(), 1);
                          const niceMax = getNiceMax(maxSec);
                          const step = niceMax / 4;
                          const ticks: number[] = [];
                          for (let i = 0; i <= 4; i++) ticks.push(Math.round(step * i * 10) / 10);
                          return ticks.slice().reverse().map((tick, i) => (
                            <span key={i} className="-translate-y-1/2">{tick}{tick > 0 ? 'h' : ''}</span>
                          ));
                        })()}
                      </div>
                      {/* Chart */}
                      <div className="flex-1 relative min-w-0">
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ paddingBottom: '14px' }}>
                          {[0, 1, 2, 3, 4].map(i => <div key={i} className="border-t border-zinc-800/30 w-full" />)}
                        </div>
                        <div className="flex items-end justify-between gap-1 relative z-10" style={{ height: `${barChartMaxHeight}px` }}>
                          {(() => {
                            const bars: { label: string; seconds: number }[] = [];
                            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                            if (selectedPeriod === 'today') {
                              const now = new Date();
                              const todayStart = new Date(now);
                              todayStart.setDate(todayStart.getDate() - dateOffset);
                              todayStart.setHours(0, 0, 0, 0);
                              for (let h = 0; h < 24; h++) {
                                const hourStart = new Date(todayStart);
                                hourStart.setHours(h);
                                const hourEnd = new Date(hourStart);
                                hourEnd.setHours(h + 1);
                                let sec = 0;
                                filtered.forEach((s: any) => {
                                  const sStart = new Date(s.started_at);
                                  const sEnd = s.ended_at ? new Date(s.ended_at) : new Date(sStart.getTime() + (s.duration_seconds || 0) * 1000);
                                  const overlapStart = sStart > hourStart ? sStart : hourStart;
                                  const overlapEnd = sEnd < hourEnd ? sEnd : hourEnd;
                                  if (overlapStart < overlapEnd) sec += (overlapEnd.getTime() - overlapStart.getTime()) / 1000;
                                });
                                bars.push({ label: `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`, seconds: sec });
                              }
                            } else if (selectedPeriod === 'week' || selectedPeriod === '7day') {
                              const now = new Date();
                              const weekStart = new Date(now);
                              const day = weekStart.getDay();
                              const diff = day === 0 ? 6 : day - 1;
                              weekStart.setDate(weekStart.getDate() - diff - dateOffset * 7);
                              weekStart.setHours(0, 0, 0, 0);
                              for (let i = 0; i < 7; i++) {
                                const d = new Date(weekStart);
                                d.setDate(d.getDate() + i);
                                const dateStr = d.toISOString().split('T')[0];
                                bars.push({ label: dayNames[d.getDay()], seconds: filtered.filter((s: any) => s.started_at?.split('T')[0] === dateStr).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) });
                              }
                            } else if (selectedPeriod === 'month' || selectedPeriod === '30day') {
                              const targetMonth = new Date(new Date().getFullYear(), new Date().getMonth() - dateOffset, 1);
                              const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
                              for (let day = 1; day <= daysInMonth; day++) {
                                const d = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
                                bars.push({ label: `${day}`, seconds: filtered.filter((s: any) => s.started_at?.split('T')[0] === d.toISOString().split('T')[0]).reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) });
                              }
                            } else {
                              const monthMap: Record<string, number> = {};
                              filtered.forEach((s: any) => {
                                const d = new Date(s.started_at);
                                const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
                                if (!monthMap[key]) monthMap[key] = 0;
                                monthMap[key] += s.duration_seconds || 0;
                              });
                              Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, sec]) => {
                                const [yr, mo] = key.split('-');
                                bars.push({ label: new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), seconds: sec });
                              });
                            }

                            const maxSec = maxBy(bars, b => b.seconds, 1);
                            const niceMax = getNiceMax(maxSec);
                            return bars.map((bar, idx) => {
                              const h = (bar.seconds / (niceMax * 3600)) * barChartMaxHeight;
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-0.5 group relative" style={{ minWidth: selectedPeriod === 'month' || selectedPeriod === '30day' ? '16px' : selectedPeriod === 'week' || selectedPeriod === '7day' ? '28px' : '20px' }}>
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-zinc-900/95 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] text-zinc-300 whitespace-nowrap z-20 backdrop-blur-sm pointer-events-none">
                                    {bar.label}: {formatHours(bar.seconds)}
                                  </div>
                                  {/* Bar */}
                                  {bar.seconds > 0 ? (
                                    <div className="w-full flex flex-col justify-end" style={{ height: `${barChartMaxHeight}px` }}>
                                      <div
                                        className="w-full rounded-t transition-colors duration-150 duration-300 ease-out"
                                        style={{
                                          height: `${Math.max(2, h)}px`,
                                          background: h > 16
                                            ? `linear-gradient(to top, ${viewingActivity.color}dd, ${viewingActivity.color})`
                                            : viewingActivity.color,
                                          boxShadow: `0 0 6px ${viewingActivity.color}66`,
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-full" style={{ height: `${barChartMaxHeight}px` }} />
                                  )}
                                  <div className="text-[9px] text-zinc-500">{bar.label}</div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hourly Pattern */}
                <div className="mt-3">
                  <div className="flex gap-2">
                    {/* Y-Axis */}
                    <div className="flex flex-col justify-between items-end text-[9px] font-medium text-zinc-600 pr-1 flex-shrink-0 select-none leading-none" style={{ height: `${hourChartMaxHeight}px` }}>
                      {(() => {
                        const hourCounts = new Array(24).fill(0);
                        filtered.forEach((s: any) => { const h = new Date(s.started_at).getHours(); hourCounts[h] += s.duration_seconds || 0; });
                        const maxHour = maxOf(hourCounts, 1);
                        const niceMax = getNiceMax(maxHour);
                        const step = niceMax / 4;
                        const ticks: number[] = [];
                        for (let i = 0; i <= 4; i++) ticks.push(Math.round(step * i * 10) / 10);
                        return ticks.slice().reverse().map((tick, i) => (
                          <span key={i} className="-translate-y-1/2">{tick}{tick > 0 ? 'h' : ''}</span>
                        ));
                      })()}
                    </div>
                    {/* Chart */}
                    <div className="flex-1 relative min-w-0">
                      <div className="text-[10px] font-medium text-zinc-500 mb-0.5">Hourly Pattern</div>
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ paddingBottom: '0px' }}>
                        {[0, 1, 2, 3, 4].map(i => <div key={i} className="border-t border-zinc-800/25 w-full" />)}
                      </div>
                      <div className="flex items-end justify-between gap-px relative z-10" style={{ height: `${hourChartMaxHeight}px` }}>
                        {(() => {
                          const hourCounts = new Array(24).fill(0);
                          filtered.forEach((s: any) => { const h = new Date(s.started_at).getHours(); hourCounts[h] += s.duration_seconds || 0; });
                          const maxHour = maxOf(hourCounts, 1);
                          const niceMax = getNiceMax(maxHour);
                          return hourCounts.map((sec, h) => {
                            const height = (sec / (niceMax * 3600)) * hourChartMaxHeight;
                            return (
                              <div key={h} className="flex-1 flex flex-col items-center group relative">
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-zinc-900/95 border border-zinc-700 rounded px-1.5 py-0.5 text-[9px] text-zinc-300 whitespace-nowrap z-20 pointer-events-none">
                                  {h % 12 || 12}{h < 12 ? 'a' : 'p'}: {formatHours(sec)}
                                </div>
                                {sec > 0 ? (
                                  <div className="w-full flex flex-col justify-end" style={{ height: `${hourChartMaxHeight}px` }}>
                                    <div
                                      className="w-full rounded-t transition-colors duration-150 duration-300 ease-out"
                                      style={{
                                        height: `${Math.max(1, height)}px`,
                                        background: height > 12 ? `linear-gradient(to top, ${viewingActivity.color}bb, ${viewingActivity.color})` : viewingActivity.color,
                                        opacity: h >= 6 && h < 22 ? 0.85 : 0.35,
                                        boxShadow: `0 0 4px ${viewingActivity.color}44`,
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full" style={{ height: `${hourChartMaxHeight}px` }} />
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {filtered.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-400">Sessions</span>
                  <span className="text-xs text-zinc-600">{filtered.length} total</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filtered.slice(0, 20).map((s: any) => {
                    const isEditing = editingSession?.id === s.id;
                    const startDate = new Date(s.started_at);
                    const endDate = s.ended_at ? new Date(s.ended_at) : null;
                    return (
                      <div key={s.id} className="bg-zinc-800/30 rounded-lg px-3 py-2 text-sm group hover:bg-zinc-800/50 transition-colors">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-zinc-500">Start</label>
                                <input
                                  type="datetime-local"
                                  value={editingSessionTimes.started_at}
                                  onChange={(e) => setEditingSessionTimes(prev => ({ ...prev, started_at: e.target.value }))}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-500">End</label>
                                <input
                                  type="datetime-local"
                                  value={editingSessionTimes.ended_at}
                                  onChange={(e) => setEditingSessionTimes(prev => ({ ...prev, ended_at: e.target.value }))}
                                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                                />
                              </div>
                            </div>
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={async () => {
                                  if (window.deskflowAPI?.updateExternalSession) {
                                    const newStart = new Date(editingSessionTimes.started_at);
                                    const newEnd = new Date(editingSessionTimes.ended_at);
                                    const durSec = Math.floor((newEnd.getTime() - newStart.getTime()) / 1000);
                                    await window.deskflowAPI.updateExternalSession(s.id, {
                                      started_at: newStart.toISOString(),
                                      ended_at: newEnd.toISOString(),
                                      duration_seconds: Math.max(0, durSec),
                                    });
                                    setEditingSession(null);
                                    if (window.deskflowAPI?.getExternalSessions && viewingActivity) {
                                      const updated = await window.deskflowAPI.getExternalSessions('all');
                                      setViewingActivitySessions(updated.filter((x: any) => x.activity_id === viewingActivity.id));
                                    }
                                  }
                                }}
                                className="px-2 py-1 bg-emerald-600/50 hover:bg-emerald-600 rounded text-xs text-white"
                              >
                                <Save className="w-3 h-3 inline mr-1" />Save
                              </button>
                              <button
                                onClick={() => setEditingSession(null)}
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
                                {endDate ? endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'now'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-zinc-400 font-medium">{formatHours(s.duration_seconds || 0)}</span>
                              <button
                                onClick={() => {
                                  const toLocal = (iso: string) => {
                                    const d = new Date(iso);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                  };
                                  setEditingSession(s);
                                  setEditingSessionTimes({
                                    started_at: toLocal(s.started_at),
                                    ended_at: s.ended_at ? toLocal(s.ended_at) : toLocal(new Date().toISOString()),
                                  });
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-zinc-700 transition-colors duration-150"
                              >
                                <Pencil className="w-3 h-3 text-zinc-500" />
                              </button>
                              <button
                                onClick={() => setTransferSession(s)}
                                className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-amber-900/50 transition-colors duration-150"
                                title="Transfer to another activity"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.deskflowAPI?.deleteExternalSession) {
                                    await window.deskflowAPI.deleteExternalSession(s.id);
                                    if (window.deskflowAPI?.getExternalSessions && viewingActivity) {
                                      const updated = await window.deskflowAPI.getExternalSessions('all');
                                      setViewingActivitySessions(updated.filter((x: any) => x.activity_id === viewingActivity.id));
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
              </div>
            )}
                </>
              );
            })()}
          </motion.div>
        )}

        {/* ── Activity Goals Progress ── */}
        {activityGoals.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              Daily Goals
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {activityGoals.filter((g: any) => g.goal_enabled).map((goal: any) => {
                const pct = goal.daily_target_minutes > 0
                  ? Math.min(100, Math.round((goal.today_seconds / (goal.daily_target_minutes * 60)) * 100))
                  : 0;
                const achieved = goal.today_seconds >= (goal.daily_target_minutes || 0) * 60;
                return (
                  <div key={goal.id} className={`p-3 rounded-xl border transition-colors ${
                    achieved
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-zinc-800/50 border-zinc-700/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                      <span className="text-xs font-medium text-zinc-200 truncate">{goal.name}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-lg font-bold tabular-nums text-zinc-100">
                        {formatElapsedShort(goal.today_seconds)}
                      </span>
                      <span className={`text-[10px] font-medium ${achieved ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: achieved ? '#10b981' : goal.color,
                        }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-600">
                      {goal.daily_target_minutes}min target
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity Grid — Squarified Treemap */}
          <div data-tutorial="external.grid" className="relative mb-8">
            <ActivityMosaic
              activities={orderedActivities}
              stats={stats}
              sessions={allSessions}
              getIcon={getIcon}
              selectedActivityId={selectedActivity?.id}
              onSelectActivity={setSelectedActivity}
            />
          </div>

        {/* Selection Overlay with View Data */}
        {selectedActivity && !activeSession && (
          <ActivitySelectionOverlay
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
            onViewData={(activity) => {
              handleLoadViewingActivity(activity);
              setSelectedActivity(null);
            }}
            onStart={(activity) => {
              startActivity(activity);
              setSelectedActivity(null);
            }}
            onAddSession={(activity) => {
              const n = new Date();
              n.setMinutes(n.getMinutes() - 30);
              setManualSessionHours(0);
              setManualSessionMinutes(30);
              const d2 = new Date();
              setManualSessionDate(`${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`);
              setManualSessionStartHours(n.getHours());
              setManualSessionStartMinutes(n.getMinutes());
              setManualSessionActivity(activity);
              setSelectedActivity(null);
            }}
          />
        )}

        {/* Manual Session Modal */}
        <AnimatePresence>
          {manualSessionActivity && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setManualSessionActivity(null)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-zinc-800 rounded-xl p-5 border border-zinc-700 min-w-72"
                style={{ borderColor: manualSessionActivity.color + '60' }}>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: manualSessionActivity.color }}>{(() => { const Icon = getIcon(manualSessionActivity.icon); return <Icon className="w-6 h-6 text-white" />; })()}</div>
                  <div className="text-lg font-semibold text-zinc-100">{manualSessionActivity.name}</div>
                  <div className="text-sm text-zinc-400 mt-1">Log a past session</div>
                </div>
<div className="mb-4">
  <label className="block text-xs text-zinc-500 mb-1.5">Date</label>
  <div className="relative">
    <button
      onClick={prevDay}
      className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/30 rounded-l-lg"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
     <button
       className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 text-center"
     >
       {formattedDate}
     </button>
    <button
      onClick={nextDay}
      className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/30 rounded-r-lg"
    >
      <ChevronRight className="w-4 h-4" />
    </button>
      <input
        type="date"
        ref={dateInputRef}
        className="absolute inset-y-0 left-10 right-10 opacity-0 cursor-pointer"
        value={manualSessionDate}
        onChange={(e) => setManualSessionDate(e.target.value)}
      />
  </div>
  <div className="text-xs text-zinc-500 mt-1 text-center">
    {dayName}
  </div>
</div>
                <div className="flex items-center justify-center gap-6 mb-5">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 text-center">Start Time</label>
                    <DurationPicker
                      hours={manualSessionStartHours}
                      minutes={manualSessionStartMinutes}
                      onHoursChange={setManualSessionStartHours}
                      onMinutesChange={setManualSessionStartMinutes}
                      maxHours={23}
                      hourLabel="Hr"
                      minuteLabel="Min"
                      wrap={true}
                    />
                  </div>
                  <div className="text-zinc-500 text-lg pt-6">→</div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 text-center">Duration <span className="text-zinc-600">(not end time)</span></label>
                    <DurationPicker
                      hours={manualSessionHours}
                      minutes={manualSessionMinutes}
                      onHoursChange={setManualSessionHours}
                      onMinutesChange={setManualSessionMinutes}
                      maxHours={23}
                      hourLabel="Hr"
                      minuteLabel="Min"
                    />
                  </div>
                </div>
                <div className="text-center text-xs text-zinc-500 mb-5">
                  Session: <span className="text-zinc-300 font-mono">
                    {String(manualSessionStartHours).padStart(2,'0')}:{String(manualSessionStartMinutes).padStart(2,'0')}
                  </span>
                  {' → '}
                  <span className="text-zinc-300 font-mono">
                    {(() => {
                      const totalMin = manualSessionHours * 60 + manualSessionMinutes;
                      if (totalMin <= 0) return '--:--';
                      const endH = (manualSessionStartHours + manualSessionHours + Math.floor((manualSessionStartMinutes + manualSessionMinutes) / 60)) % 24;
                      const endM = (manualSessionStartMinutes + manualSessionMinutes) % 60;
                      return `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
                    })()}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      const totalMinutes = manualSessionHours * 60 + manualSessionMinutes;
                      if (totalMinutes <= 0) return;
                      if (window.deskflowAPI?.addExternalTime) {
                        const baseDate = new Date(manualSessionDate + 'T00:00:00');
                        const startedAt = new Date(baseDate);
                        startedAt.setHours(manualSessionStartHours, manualSessionStartMinutes, 0, 0);
                        const endedAt = new Date(startedAt.getTime() + totalMinutes * 60 * 1000);
                        const r = await window.deskflowAPI.addExternalTime(
                          manualSessionActivity.id.toString(),
                          totalMinutes,
                          startedAt.toISOString(),
                          endedAt.toISOString()
                        );
                        if (r?.success) {
                          setManualSessionActivity(null);
                          refreshStats();
                          if (window.deskflowAPI?.getExternalActivities) {
                            window.deskflowAPI.getExternalActivities().then((data: any[]) => setActivities(data));
                          }
                        }
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors text-white font-medium"
                  >
                    Save Session
                  </button>
                  <button onClick={() => setManualSessionActivity(null)} className="w-full px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-xl transition-colors text-zinc-300">Cancel</button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

{/* Sleep Trends - Time-based chart */}
{sleepTrends.daily.length > 0 && (
          <GlassCard data-tutorial="external.sleep" className="mb-8 !overflow-visible">
            <SectionHeader title="Sleep Patterns" action={
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-zinc-500">Pre-sleep delay</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-zinc-500">Sleep Window</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-zinc-500">Post-wake delay</span>
                </div>
              </div>
            } />
            <p className="text-[10px] text-zinc-600 -mt-2 mb-3">Each bar = one night's sleep. Date = evening you went to bed. Bar spans into next morning (wake-up day separate). Hover a bar or click to edit.</p>
            
            <div className="flex">
              {/* Y-axis: Time labels (6PM→6PM) */}
              <div className="flex flex-col justify-between pr-3 text-[10px] text-zinc-600 font-mono w-14">
                <span>6 PM</span>
                <span>9 PM</span>
                <span>12 AM</span>
                <span>3 AM</span>
                <span>6 AM</span>
                <span>9 AM</span>
                <span>12 PM</span>
                <span>3 PM</span>
                <span>6 PM</span>
              </div>
              
              {/* Chart area */}
              <div className="flex-1 relative">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0,1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="h-px bg-zinc-800/60" />
                  ))}
                </div>
                
                {/* Bars for each day */}
                <div className="flex gap-2 relative">
                  {(() => {
                    const range = getDateRange(selectedPeriod, dateOffset);
                    const days: any[] = [];
                    // Start one day earlier so AM bedtimes grouped to previous day are visible
                    let curr = new Date(range.start);
                    curr.setDate(curr.getDate() - 1);
                    // Safeguard for infinite loop
                    let safety = 0;
                    while (curr < range.end && safety < 400) {
                      const ds = localDateStr(curr);
                      const existing = sleepTrends.daily.find(d => d.date === ds);
                      if (existing) {
                        days.push(existing);
                      } else {
                        days.push({
                          date: ds,
                          sleep_seconds: 0,
                          deficit_seconds: 0,
                          pre_sleep_seconds: 0,
                          post_wake_seconds: 0,
                          bedtime_minutes: 0,
                          waketime_minutes: 0
                        });
                      }
                      curr.setDate(curr.getDate() + 1);
                      safety++;
                    }
                    return days;
                  })().map((day, idx) => {
                    const appExitMin = day.bedtime_minutes; // raw app exit time (when user stopped using device)
                    const preSleepMin = Math.round(day.pre_sleep_seconds / 60);
                    const postWakeMin = Math.round(day.post_wake_seconds / 60);
                    const wakeMin = day.waketime_minutes;
                    
                    const sleepStartMin = (appExitMin + preSleepMin) % 1440; // when user actually fell asleep
                    const appOpenMin = (wakeMin + postWakeMin) % 1440; // when user opened app
                    
                    const hasPreSleep = preSleepMin > 0;
                    const hasPostWake = postWakeMin > 0;
                    
                    const dateObj = new Date(day.date + 'T00:00:00');
                    const nowLocal = new Date();
                    const todayLocal = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
                    const isToday = day.date === todayLocal;
                    
                    const mapTime = (mins: number) => {
                      const normalized = ((mins - 1080) % 1440 + 1440) % 1440;
                      return (normalized / 1440) * 100;
                    };
                    
                    const formatTime = (mins: number) => {
                      const h24 = Math.floor(mins / 60);
                      const m = Math.floor(mins % 60);
                      const ampm = h24 >= 12 ? 'PM' : 'AM';
                      const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                    };
                    
                    const colors = {
                      preSleep: '#f59e0b',
                      sleep: '#6366f1',
                      postWake: '#e11d48',
                    };
                    
                    const Seg = ({ start, end, color, topRound, bottomRound }: { start: number; end: number; color: string; topRound: boolean; bottomRound: boolean }) => {
                      const t = mapTime(start);
                      const b = mapTime(end);
                      const crosses = t > b;
                      const rounding = topRound && bottomRound ? 'rounded-md' : topRound ? 'rounded-t-md' : bottomRound ? 'rounded-b-md' : '';
                      if (crosses) {
                        return (<>
                          <div className={`absolute left-1 right-1 ${topRound ? 'rounded-t-md' : ''} transition-colors duration-150 duration-300`} style={{ top: `${t}%`, bottom: 0, backgroundColor: color, opacity: 0.8, boxShadow: `0 0 6px ${color}4D` }} />
                          <div className={`absolute left-1 right-1 ${bottomRound ? 'rounded-b-md' : ''} transition-colors duration-150 duration-300`} style={{ top: 0, bottom: `${100 - b}%`, backgroundColor: color, opacity: 0.8, boxShadow: `0 0 6px ${color}4D` }} />
                        </>);
                      }
                      return <div className={`absolute left-1 right-1 ${rounding} transition-colors duration-150 duration-300`} style={{ top: `${t}%`, bottom: `${100 - b}%`, backgroundColor: color, opacity: 0.8, boxShadow: `0 0 6px ${color}4D` }} />;
                    };
                    
                    const hasSleepData = day.sleep_seconds > 0 || appExitMin > 0;
                    const wasShifted = day.was_shifted || false;
                    
                    // Helper: resolve the actual calendar date for this bar's sleep
                    // day.date is ALREADY the grouped bedtime date (shifted if needed)
                    // was_shifted = raw started_at was on the NEXT calendar day, so the
                    // actual bedtime date = day.date + 1 (dates shown in tooltip are actual,
                    // while the bar position + popup date selection stay on the grouped date)
                    const resolveDate = (offsetDays: number = 0) => {
                      const d = new Date(day.date + 'T00:00:00');
                      if (offsetDays) d.setDate(d.getDate() + offsetDays);
                      return d;
                    };
                    
                    return (
                      <div
                        key={idx}
                        className={`flex-1 flex flex-col items-center group relative min-w-[40px] cursor-pointer transition-colors ${dragOverDate === day.date ? 'bg-indigo-500/20 ring-1 ring-indigo-500/40 rounded-lg' : ''}`}
                        draggable={hasSleepData}
                        onDragStart={hasSleepData ? (e) => { e.stopPropagation(); setDragSourceDate(day.date); dragDidFireRef.current = true; e.dataTransfer.effectAllowed = 'move'; } : undefined}
                        onDragOver={(e) => { e.preventDefault(); if (dragSourceDate && dragSourceDate !== day.date) { e.dataTransfer.dropEffect = 'move'; setDragOverDate(day.date); }}}
                        onDragLeave={() => setDragOverDate(null)}
                        onDrop={(e) => { e.preventDefault(); setDragOverDate(null); dragDidFireRef.current = true; if (dragSourceDate) { handleDropSleep(dragSourceDate, day.date); setDragSourceDate(null); }}}
                        onClick={() => { if (dragDidFireRef.current) { dragDidFireRef.current = false; return; } if (!hasSleepData) return; setPastSleepDate(day.date); setShowPastSleepModal(true); }}
                      >
                        {/* 3-segment sleep bar: amber pre-sleep → indigo sleep → rose post-wake */}
                        <div className="relative w-full h-72">
                          {/* Tooltip - positioned at bottom of bar area */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2 text-[10px] text-zinc-300 whitespace-nowrap z-[100] pointer-events-none shadow-xl" style={{ transform: 'translate(-50%, 0)' }}>
                            {!hasSleepData ? (
                              <div className="text-center py-1">
                                <div className="text-zinc-500 font-medium mb-0.5">No sleep logged</div>
                                <div className="text-[9px] text-zinc-600">Click to add sleep for this day</div>
                              </div>
                            ) : (
                              <>
                <div className="font-medium text-white text-center mb-1">
                                   {(() => {
                                     const bedtimeDate = wasShifted ? resolveDate(1) : resolveDate();
                                     const bedHour = Math.floor(appExitMin / 60);
                                     const wakeHour = Math.floor(wakeMin / 60);
                                     const isCrossMidnight = wakeHour < bedHour;
                                     if (isCrossMidnight) {
                                       const wakeDate = new Date(bedtimeDate);
                                       wakeDate.setDate(wakeDate.getDate() + 1);
                                       return <>🛏️ {bedtimeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}<span className="text-zinc-500"> → </span>🌅 {wakeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>;
                                     } else {
                                       return <>🛏️ {bedtimeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}<span className="text-zinc-500"> → </span>🌅 {bedtimeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>;
                                     }
                                   })()}
                                 </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>App Exit: {formatTime(appExitMin)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>Pre-sleep: {formatHours(day.pre_sleep_seconds)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                  <span>Fell asleep: {formatTime(sleepStartMin)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                  <span>Woke up: {formatTime(wakeMin)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span>Post-wake: {formatHours(day.post_wake_seconds)}</span>
                                </div>
                                                <div className="mt-1 pt-1 border-t border-zinc-700 text-indigo-400">Sleep: {formatHours(day.sleep_seconds)}</div>
                                <div className="mt-1 text-[9px] text-zinc-600">Drag to move to another date</div>
                              </>
                            )}
                          </div>
                          {hasSleepData && hasPreSleep && (
                            <Seg start={appExitMin} end={sleepStartMin} color={colors.preSleep} topRound={true} bottomRound={!hasPostWake && sleepStartMin >= wakeMin} />
                          )}
                          {hasSleepData && <Seg start={sleepStartMin} end={wakeMin} color={colors.sleep} topRound={!hasPreSleep} bottomRound={!hasPostWake} />}
                          {hasSleepData && hasPostWake && (
                            <Seg start={wakeMin} end={appOpenMin} color={colors.postWake} topRound={false} bottomRound={true} />
                          )}
                        </div>
                        
                        {/* Time labels — hidden for empty days */}
                        {hasSleepData ? (
                          <>
                            <div className="text-[9px] text-amber-400 font-medium">{formatTime(appExitMin)}</div>
                            <div className="text-[9px] text-rose-400 font-medium">{formatTime(wakeMin)}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-[9px] text-zinc-700 font-medium">—</div>
                            <div className="text-[9px] text-zinc-700 font-medium">—</div>
                          </>
                        )}
                        
                        {/* Day label — shows the grouped bedtime date (not the wake date) */}
                        <div className={`text-[11px] font-medium mt-1 text-center ${isToday ? 'text-indigo-400' : 'text-zinc-400'}`}>
                          <div>{isToday ? 'Today' : (() => { const d = new Date(day.date + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short' }); })()}</div>
                          {!isToday && <div className="text-[10px] text-zinc-500 font-normal">{(() => { const d = new Date(day.date + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })()}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Summary stats */}
            <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-zinc-800">
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Pre-Sleep</div>
                <div className="text-lg font-semibold text-amber-400">{formatHours(Math.round(sleepTrends.average_latency || 0))}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Post-Wake</div>
                <div className="text-lg font-semibold text-rose-400">{formatHours(Math.round(sleepTrends.average_wake_latency || 0))}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Sleep</div>
                <div className="text-lg font-semibold text-indigo-400">{formatHours(Math.round(sleepTrends.average_sleep_duration || 0))}</div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Sleep Data Fix */}
        <div className="mb-4 flex gap-3">
          <button onClick={async () => {
            if (sleepDebugData) { setSleepDebugData(null); return; }
            const data = await window.deskflowAPI?.getSleepDebug?.(selectedPeriod, dateOffset);
            setSleepDebugData(data || null);
          }} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition font-mono">
            {sleepDebugData ? 'Hide Sleep Debug' : 'Sleep Debug'}
          </button>
          <button onClick={async () => {
            const result = await window.deskflowAPI?.fixSleepDates?.();
            if (result) {
              setSleepFixResult(result);
              setShowSleepFixModal(true);
              refreshStats();
            }
          }} className="text-[10px] text-amber-600 hover:text-amber-400 transition font-mono border border-amber-600/30 hover:border-amber-400/50 rounded px-2 py-0.5">
            Fix Sleep Dates
          </button>
          {sleepDebugData && (
            <div className="text-[10px] font-mono text-zinc-500 bg-zinc-900/50 rounded-xl p-4 mt-1 overflow-auto max-h-96 space-y-2">
              <div className="font-semibold text-zinc-400">Query Filter: {sleepDebugData.queryRange?.dateFilter || 'none'}</div>
              <div className="font-semibold text-zinc-400">All Sleep Sessions ({sleepDebugData.sessions?.length || 0})</div>
              {sleepDebugData.sessions?.map((s: any) => (
                <div key={s.id} className="border-l-2 border-zinc-700 pl-2 py-1">
                  <div>ID: {s.id} | Activity: {s.name} ({s.type})</div>
                  <div>Started: {s.started_at}</div>
                  <div>Ended: {s.ended_at || 'NULL'}</div>
                  <div>Duration: {s.duration_seconds}s ({Math.round((s.duration_seconds||0)/3600*10)/10}h)</div>
                  <div>device_off_to_sleep: {s.device_off_to_sleep_seconds}s | wake_up_to_app: {s.wake_up_to_app_seconds}s</div>
                  {(() => {
                    const start = new Date(s.started_at);
                    const end = s.ended_at ? new Date(s.ended_at) : null;
                    const bedMin = start.getHours() * 60 + start.getMinutes();
                    const wakeMin = end ? end.getHours() * 60 + end.getMinutes() : 0;
                    const preSleep = s.device_off_to_sleep_seconds || 0;
                    const actualSleepSec = Math.max(0, (s.duration_seconds||0) - preSleep);
                    return (
                      <div>
                        <div>Bedtime: {Math.floor(bedMin/60)}:{String(bedMin%60).padStart(2,'0')} | Waketime: {Math.floor(wakeMin/60)}:{String(wakeMin%60).padStart(2,'0')}</div>
                        <div>preSleep: {preSleep}s | actualSleep: {actualSleepSec}s ({Math.round(actualSleepSec/36)/100}h)</div>
                      </div>
                    );
                  })()}
                </div>
              ))}
              <div className="font-semibold text-zinc-400 mt-3">Trends Raw Sessions ({sleepDebugData.trendsRaw?.length || 0}) — feeds getSleepTrends</div>
              {sleepDebugData.trendsRaw?.map((s: any) => (
                <div key={s.id} className="border-l-2 border-indigo-700/50 pl-2 py-1">
                  <div>ID: {s.id} | {s.started_at} → {s.ended_at}</div>
                  <div>Duration: {s.duration_seconds}s | preSleep: {s.device_off_to_sleep_seconds}s | postWake: {s.wake_up_to_app_seconds}s</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline Visualization */}
          <div data-tutorial="external.streak" className="mb-8">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl p-1 mb-6 border border-zinc-800/50">
              {[
                { key: 'grid' as const, label: 'Overview', icon: LayoutGrid },
                { key: 'daily' as const, label: 'Daily', icon: Timer },
                { key: 'weekly' as const, label: 'Weekly', icon: CalendarDays },
                { key: 'monthly' as const, label: 'Monthly', icon: Calendar },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setVizTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    vizTab === tab.key
                      ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Overview (original charts) */}
            {vizTab === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard>
                  <SectionHeader titleClassName="font-display font-extrabold tracking-tight" title="Daily Usage Trend" />
                  <div className="h-48">
                    {breakdownData.labels.length > 0 ? (
                      <Bar data={{
                        labels: breakdownData.labels,
                        datasets: [{
                          label: 'Hours',
                          data: breakdownData.data,
                          backgroundColor: (ctx: any) => barGradient(breakdownData.colors[ctx.dataIndex])(ctx),
                          borderColor: (ctx: any) => hexWithAlpha(breakdownData.colors[ctx.dataIndex], '66'),
                          borderWidth: 1,
                          borderSkipped: false,
                          borderRadius: { topLeft: 6, topRight: 6 },
                        }]
                      }} options={{
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        animation: { duration: 600, easing: 'easeOutQuart' },
                        plugins: { legend: { display: false }, tooltip: glassTooltip },
                        scales: { x: { grid: { color: '#3f3f46' }, ticks: { color: '#a1a1aa' } }, y: { grid: { color: '#3f3f46' }, ticks: { color: '#a1a1aa' } } }
                      }} />
                    ) : (
                      <EmptyState title="No data yet" />
                    )}
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionHeader title="Activity Distribution" />
                  <div className="flex items-center justify-center h-36">
                    {breakdownData.labels.length > 0 ? (() => {
                      const total = breakdownData.data.reduce((a, b) => a + b, 0);
                      let conicStr = '';
                      let currentPct = 0;
                      breakdownData.labels.forEach((name, i) => {
                        const pct = total > 0 ? (breakdownData.data[i] / total) * 100 : 0;
                        const start = currentPct;
                        const end = currentPct + pct;
                        conicStr += `${breakdownData.colors[i]} ${start}% ${end}%`;
                        if (i < breakdownData.labels.length - 1) conicStr += ', ';
                        currentPct = end;
                      });
                      return (
                        <div className="relative w-32 h-32">
                          <div className="w-full h-full rounded-full ring-1 ring-white/10" style={{ background: `conic-gradient(${conicStr})`, filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.06)) drop-shadow(0 0 24px rgba(0,0,0,0.4))' }}>
                            <div className="absolute inset-3 rounded-full bg-zinc-900 flex items-center justify-center">
                              <span className="font-display text-lg font-bold text-zinc-100">{Math.round(total)}h</span>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <EmptyState title="No data yet" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 justify-center">
                    {breakdownData.labels.slice(0, 6).map((name, i) => (
                      <div key={name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: breakdownData.colors[i], boxShadow: `0 0 6px ${hexWithAlpha(breakdownData.colors[i], '66')}` }} />
                        <span className="text-zinc-400 truncate max-w-24">{name}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard>
                  <SectionHeader title={selectedPeriod === 'today' ? 'Hourly Trend' : selectedPeriod === 'week' || selectedPeriod === '7day' ? 'Weekly Trend' : selectedPeriod === 'month' || selectedPeriod === '30day' ? 'Monthly Trend' : 'All Time Trend'} />
                  <div className="h-48">
                    {trendChartData.labels.length > 0 ? (
                      <Bar data={{
                        labels: trendChartData.labels,
                        datasets: [{
                          label: 'Hours',
                          data: trendChartData.data,
                          backgroundColor: barGradient('#8b5cf6'),
                          borderColor: 'rgba(139, 92, 246, 0.6)',
                          borderWidth: 1,
                          borderSkipped: false,
                          borderRadius: { topLeft: 6, topRight: 6 },
                        }]
                      }} options={{
                        responsive: true, maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        animation: { duration: 600, easing: 'easeOutQuart' },
                        plugins: { legend: { display: false }, tooltip: glassTooltip },
                        scales: { x: { grid: { display: false }, ticks: { color: '#a1a1aa' } }, y: { grid: { color: '#3f3f46' }, ticks: { color: '#a1a1aa' } } }
                      }} />
                    ) : (
                      <EmptyState title="No data yet" />
                    )}
                  </div>
                </GlassCard>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={vizTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
            {/* Tab: Daily */}
            {vizTab === 'daily' && (
              <DailyTimeline
                data={dailyData}
                onGapClick={(gapBlock) => {
                  setGapTarget({
                    id: gapBlock.id,
                    start: gapBlock.start,
                    end: gapBlock.end,
                    duration_seconds: gapBlock.durationSeconds,
                  });
                }}
              />
            )}

            {/* Tab: Weekly */}
            {vizTab === 'weekly' && (
              <WeeklyTimeline
                days={weeklyData}
                onGapClick={(gapBlock) => {
                  setGapTarget({
                    id: gapBlock.id,
                    start: gapBlock.start,
                    end: gapBlock.end,
                    duration_seconds: gapBlock.durationSeconds,
                  });
                }}
              />
            )}

            {/* Tab: Monthly */}
            {vizTab === 'monthly' && (
              <MonthlyTimeline
                days={monthlyData.days}
                summary={monthlyData.summary}
                onDayClick={(day) => {
                  setViewDate(day.date);
                  setVizTab('daily');
                }}
              />
            )}
              </motion.div>
            </AnimatePresence>
          </div>
      </div>

      {/* Recovery Modal */}
      <AnimatePresence>
        {showRecoveryModal && recoverySession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-md w-full mx-4"
            >
              <div className="text-center mb-6">
                {recoverySession.activity.type === 'sleep' ? (
                  <>
                    <div className="text-6xl mb-4">😴</div>
                    <h2 className="text-xl font-semibold text-zinc-100">You were sleeping!</h2>
                    <p className="text-zinc-400 mt-2">Sleeping since {formatBedtime(recoverySession.startTime)}</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">⏱️</div>
                    <h2 className="text-xl font-semibold text-zinc-100">Active Session Found</h2>
                    <p className="text-zinc-400 mt-2">{recoverySession.activity.name} started at {formatBedtime(recoverySession.startTime)}</p>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (window.deskflowAPI?.stopExternalSession) {
                      await window.deskflowAPI.stopExternalSession(recoverySession.sessionId);
                      refreshStats();
                    }
                    setShowRecoveryModal(false);
                    setRecoverySession(null);
                    syncTimerStateToDashboard(false);
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={() => {
                    setActiveSession(recoverySession);
                    setShowRecoveryModal(false);
                    syncTimerStateToDashboard(true, recoverySession.activity, recoverySession.startTime);
                  }}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors"
                >
                  Resume
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleep Wake Up Modal */}
      <AnimatePresence>
        {showSleepModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => setShowSleepModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <Moon className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-zinc-100">Wake Up</h2>
                <p className="text-zinc-400 mt-2">When did you wake up?</p>
              </div>

              <div className="flex items-center justify-center gap-2 mb-6">
                <DurationPicker
                  hours={wakeTime.hours}
                  minutes={wakeTime.minutes}
                  onChange={(h, m) => setWakeTime({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hour"
                  minuteLabel="Min"
                  wrap={true}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <LatencyPicker
                  totalMinutes={sleepLatencyMinutes}
                  onChange={setSleepLatencyMinutes}
                  label="Fell asleep after device off"
                  maxHours={4}
                />
                <LatencyPicker
                  totalMinutes={wakeUpMinutes}
                  onChange={setWakeUpMinutes}
                  label="Woke up before opening app"
                  maxHours={4}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSleepModal(false)}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmWakeUp}
                  className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl transition-colors"
                >
                  Confirm Wake Up
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Custom Activity Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-zinc-100">Add Custom Activity</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Error Message */}
              {addActivityError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{addActivityError}</p>
                </div>
              )}

              {/* Success Message */}
              {addActivitySuccess && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-sm text-emerald-400">Activity created successfully!</p>
                </div>
              )}

              {/* Activity Name */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Name</label>
                <VoiceInputWrapper>
                  <input
                    type="text"
                    value={newActivity.name}
                    onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                    placeholder="e.g., Yoga, Meditation"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100"
                  />
                </VoiceInputWrapper>
              </div>

              {/* Activity Type */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Type</label>
                <select
                  value={newActivity.type}
                  onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value as any })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100"
                >
                  <option value="stopwatch">Stopwatch (timed)</option>
                  <option value="sleep">Sleep</option>
                  <option value="checkin">Check-in (quick)</option>
                </select>
              </div>

              {/* Icon Selection */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      onClick={() => setNewActivity({ ...newActivity, icon: name })}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                        newActivity.icon === name 
                          ? 'bg-emerald-500/20 ring-2 ring-emerald-500' 
                          : 'bg-zinc-800 hover:bg-zinc-700'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-zinc-300" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selection */}
              <div className="mb-6">
                <label className="block text-sm text-zinc-400 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewActivity({ ...newActivity, color })}
                      className={`w-8 h-8 rounded-full transition ${
                        newActivity.color === color ? 'ring-2 ring-white' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Default Duration (for check-in) */}
              {newActivity.type === 'checkin' && (
                <div className="mb-4">
                  <label className="block text-sm text-zinc-400 mb-2">Default Duration (minutes)</label>
                  <select
                    value={newActivity.default_duration}
                    onChange={(e) => setNewActivity({ ...newActivity, default_duration: parseInt(e.target.value) })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCustomActivity}
                  disabled={!newActivity.name.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Activity
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Activity Modal */}
      <AnimatePresence>
        {editingActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => setEditingActivity(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-zinc-100">Edit Activity</h2>
                <button
                  onClick={() => setEditingActivity(null)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {editActivityError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{editActivityError}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Name</label>
                <VoiceInputWrapper>
                  <input
                    type="text"
                    value={editingActivity.name}
                    onChange={(e) => setEditingActivity({ ...editingActivity, name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100"
                  />
                </VoiceInputWrapper>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Type</label>
                <select
                  value={editingActivity.type}
                  onChange={(e) => setEditingActivity({ ...editingActivity, type: e.target.value as any })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100"
                >
                  <option value="stopwatch">Stopwatch (timed)</option>
                  <option value="sleep">Sleep</option>
                  <option value="checkin">Check-in (quick)</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      onClick={() => setEditingActivity({ ...editingActivity, icon: name })}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                        editingActivity.icon === name 
                          ? 'bg-emerald-500/20 ring-2 ring-emerald-500' 
                          : 'bg-zinc-800 hover:bg-zinc-700'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-zinc-300" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-zinc-400 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingActivity({ ...editingActivity, color })}
                      className={`w-8 h-8 rounded-full transition ${
                        editingActivity.color === color ? 'ring-2 ring-white' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* ── Goal Settings ── */}
              <div className="mb-6 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-zinc-200">Goal Settings</span>
                  </div>
                  <button
                    onClick={() => {
                      const enabled = !(editingActivity as any).goal_enabled;
                      setEditingActivity({ ...editingActivity, goal_enabled: enabled ? 1 : 0 } as any);
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      (editingActivity as any).goal_enabled ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      (editingActivity as any).goal_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                {(editingActivity as any).goal_enabled === 1 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Daily Target (minutes)</label>
                      <input
                        type="number"
                        min={1}
                        max={480}
                        value={(editingActivity as any).daily_target_minutes || ''}
                        onChange={(e) => setEditingActivity({
                          ...editingActivity,
                          daily_target_minutes: parseInt(e.target.value) || null
                        } as any)}
                        placeholder="e.g. 60"
                        className="w-full bg-zinc-900/60 border border-zinc-700/30 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Weekly Target (days)</label>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={(editingActivity as any).weekly_target_days || ''}
                        onChange={(e) => setEditingActivity({
                          ...editingActivity,
                          weekly_target_days: parseInt(e.target.value) || null
                        } as any)}
                        placeholder="e.g. 5"
                        className="w-full bg-zinc-900/60 border border-zinc-700/30 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Reminder</span>
                      <button
                        onClick={() => setEditingActivity({
                          ...editingActivity,
                          reminder_enabled: (editingActivity as any).reminder_enabled ? 0 : 1
                        } as any)}
                        className={`relative w-8 h-4 rounded-full transition-colors ${
                          (editingActivity as any).reminder_enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          (editingActivity as any).reminder_enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 px-4 py-3 bg-red-600/50 hover:bg-red-600 text-white rounded-xl transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={async () => {
                    if (window.deskflowAPI?.updateExternalActivity) {
                      try {
                        await window.deskflowAPI.updateExternalActivity(editingActivity.id, {
                          name: editingActivity.name,
                          type: editingActivity.type,
                          color: editingActivity.color,
                          icon: editingActivity.icon
                        });
                        // Save goal settings separately
                        if (window.deskflowAPI?.activityGoalSave) {
                          await window.deskflowAPI.activityGoalSave(editingActivity.id, {
                            goal_enabled: (editingActivity as any).goal_enabled === 1,
                            daily_target_minutes: (editingActivity as any).daily_target_minutes || undefined,
                            weekly_target_days: (editingActivity as any).weekly_target_days || undefined,
                            reminder_enabled: (editingActivity as any).reminder_enabled === 1,
                            reminder_time: (editingActivity as any).reminder_time || undefined,
                          });
                        }
                        const updated = await window.deskflowAPI.getExternalActivities();
                        setActivities(updated);
                        setEditingActivity(null);
                      } catch (err) {
                        setEditActivityError('Failed to update activity');
                      }
                    }
                  }}
                  disabled={!editingActivity.name.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Activity Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && editingActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">Delete Activity?</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Are you sure you want to delete <span className="text-zinc-200 font-medium">{editingActivity.name}</span>? All its sessions will be permanently removed.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (window.deskflowAPI?.deleteExternalActivity) {
                      try {
                        const ok = await window.deskflowAPI.deleteExternalActivity(editingActivity.id);
                        if (!ok) {
                          setEditActivityError('Delete failed — activity may be a default that cannot be removed');
                          setShowDeleteConfirm(false);
                          return;
                        }
                        const updated = await window.deskflowAPI.getExternalActivities();
                        setActivities(updated);
                        setEditingActivity(null);
                        setShowDeleteConfirm(false);
                      } catch (err) {
                        setEditActivityError('Failed to delete activity');
                        setShowDeleteConfirm(false);
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm text-white font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Morning Sleep Prompt Modal */}
      <AnimatePresence>
        {showMorningPrompt && morningPromptData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-md w-full mx-4"
            >
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🌤️</div>
                <h2 className="text-xl font-semibold text-zinc-100">Good Morning!</h2>
                <p className="text-zinc-400 mt-2">It looks like you slept last night. Want to track your sleep?</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <LatencyPicker
                  totalMinutes={sleepLatencyMinutes}
                  onChange={setSleepLatencyMinutes}
                  label="Fell asleep after closing app"
                  maxHours={4}
                />
                <LatencyPicker
                  totalMinutes={wakeUpMinutes}
                  onChange={setWakeUpMinutes}
                  label="Woke up before opening app"
                  maxHours={4}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (window.deskflowAPI?.dismissMorningPrompt) {
                      await window.deskflowAPI.dismissMorningPrompt();
                    }
                    setShowMorningPrompt(false);
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={async () => {
                    if (!morningPromptData) return;
                    
                    const lastClose = new Date(morningPromptData.lastCloseTime);
                    const now = new Date();
                    // Wake up time = now - time spent awake before opening app
                    const wakeUp = new Date(now.getTime() - wakeUpMinutes * 60 * 1000);
                    
                    // Set base date to the bedtime date (lastClose), not today — so cross-midnight
                    // sleeps register on the correct day (e.g., bedtime 11PM June 16 → June 16, not June 17)
                    setPastSleepDate(localDateStr(lastClose));
                    setPastOriginalStartedAt(null);
                    
                    const offH = lastClose.getHours(), offM = lastClose.getMinutes();
                    setPastDeviceOff({ hours: offH, minutes: offM });
                    const fellAsleepM = offM + sleepLatencyMinutes;
                    setPastFellAsleepAt({ hours: (offH + Math.floor(fellAsleepM / 60)) % 24, minutes: fellAsleepM % 60 });
                    setPastWakeupTime({ hours: wakeUp.getHours(), minutes: wakeUp.getMinutes() });
                    setPastDeviceOn({ hours: now.getHours(), minutes: now.getMinutes() });
                    setShowMorningPrompt(false);
                    setShowPastSleepModal(true);
                    
                    if (window.deskflowAPI?.dismissMorningPrompt) {
                      await window.deskflowAPI.dismissMorningPrompt();
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl transition-colors"
                >
                  Add Sleep
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleep Fix Result Modal */}
      <AnimatePresence>
        {showSleepFixModal && sleepFixResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => setShowSleepFixModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className={`text-4xl mb-3 ${sleepFixResult.fixed > 0 ? 'text-emerald-400' : sleepFixResult.problems_found && sleepFixResult.problems_found.length > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {sleepFixResult.fixed > 0 ? '✓' : sleepFixResult.problems_found && sleepFixResult.problems_found.length > 0 ? '⚠' : '—'}
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  {sleepFixResult.fixed > 0 ? `Fixed ${sleepFixResult.fixed} Session(s)` : sleepFixResult.problems_found && sleepFixResult.problems_found.length > 0 ? `${sleepFixResult.problems_found.length} Problem(s) Found` : 'All Sessions OK'}
                </h3>
              </div>

              {sleepFixResult.fixed > 0 ? (
                <div className="space-y-3 mb-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-sm text-emerald-400 text-center font-medium">
                      Fixed {sleepFixResult.fixed} session{sleepFixResult.fixed !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {sleepFixResult.updates && sleepFixResult.updates.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {sleepFixResult.updates.map((u) => {
                        const oldDate = new Date(u.oldStart)
                        const newDate = new Date(u.newStart)
                        const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        const oldDurH = Math.floor(u.oldDuration / 3600)
                        const oldDurM = Math.round((u.oldDuration % 3600) / 60)
                        const newDurH = Math.floor(u.newDuration / 3600)
                        const newDurM = Math.round((u.newDuration % 3600) / 60)
                        return (
                          <div key={u.id} className="bg-zinc-800/60 rounded-lg px-3 py-2 text-[11px]">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <span className="text-red-400/80 line-through">{fmt(oldDate)}</span>
                              <span className="text-zinc-600">→</span>
                              <span className="text-emerald-400">{fmt(newDate)}</span>
                            </div>
                            <div className="text-zinc-500 mt-0.5">
                              Duration: {oldDurH}h {oldDurM}m → {newDurH}h {newDurM}m
                            </div>
                            {u.reason && <div className="text-amber-400/80 mt-0.5 text-[10px]">{u.reason}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : sleepFixResult.problems_found && sleepFixResult.problems_found.length > 0 ? (
                <div className="space-y-3 mb-4">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-sm text-amber-400 text-center font-medium">
                      Found {sleepFixResult.problems_found.length} problem(s) — none auto-fixable
                    </p>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {sleepFixResult.problems_found.map((p: any) => {
                      const fmt = (iso: string) => {
                        const d = new Date(iso)
                        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      }
                      const durH = (p.duration_seconds / 3600).toFixed(1)
                      return (
                        <div key={p.id} className="bg-zinc-800/60 rounded-lg px-3 py-2 text-[11px]">
                          <div className="text-zinc-400">{fmt(p.started_at)} → {fmt(p.ended_at)}</div>
                          <div className="text-zinc-500">Duration: {durH}h</div>
                          <div className="text-red-400/80 mt-0.5">{p.issue}</div>
                          <div className="text-zinc-600 text-[10px] mt-0.5">ID: {p.id} — edit manually to fix</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-zinc-400 text-center">
                    All sleep sessions look good — nothing to fix.
                  </p>
                </div>
              )}

              <button
                onClick={() => setShowSleepFixModal(false)}
                className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors text-sm text-zinc-300"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Past Sleep Modal */}
      <AnimatePresence>
        {showPastSleepModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => { setShowPastSleepModal(false); setPastSleepError(null); setPastSleepSuccess(false); }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl p-5 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-zinc-100">Past Sleep</h2>
                <button
                  onClick={() => { setShowPastSleepModal(false); setPastSleepError(null); setPastSleepSuccess(false); }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Mode badge */}
              <div className={`mb-4 px-3 py-2 rounded-lg text-center text-sm font-bold uppercase tracking-wider ${pastSleepSessionId ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                {pastSleepSessionId ? '✎ Editing Existing Sleep' : '＋ Adding New Sleep'}
              </div>

              {pastSleepError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{pastSleepError}</p>
                </div>
              )}

              {pastSleepSuccess && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-sm text-emerald-400">{pastSleepSessionId ? 'Sleep updated successfully!' : 'Sleep added successfully!'}</p>
                </div>
              )}

              {/* Sleep period banner — shown when existing data loaded */}
              {pastWakeupDate && pastSleepSessionId && (
                <div className="bg-zinc-800/50 rounded-xl px-4 py-3 mb-4">
                  <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-3">
                    {(() => {
                      // The date this sleep BELONGS to: bedtime past midnight (before 12:00)
                      // belongs to the PREVIOUS day's sleep (3:03 AM Aug 12 = Aug 11's sleep).
                      const raw = pastOriginalStartedAt ? new Date(pastOriginalStartedAt) : null;
                      const d = raw ? new Date(raw) : new Date(pastSleepDate + 'T00:00:00');
                      if (raw && raw.getHours() < 12) d.setDate(d.getDate() - 1);
                      return `Sleep of ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
                    })()}
                  </div>
                  <div className="flex items-center justify-center gap-3 text-sm">
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">🛏️ Bedtime</div>
                      <div className="font-medium text-zinc-200">{(() => {
                        const d = pastOriginalStartedAt ? new Date(pastOriginalStartedAt) : new Date(pastSleepDate + 'T00:00:00');
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      })()}</div>
                      <div className="text-[11px] text-zinc-400">{((h) => { const ampm = h.hours >= 12 ? 'PM' : 'AM'; const h12 = h.hours === 0 ? 12 : h.hours > 12 ? h.hours - 12 : h.hours; return `${h12}:${String(h.minutes).padStart(2, '0')} ${ampm}`; })(pastDeviceOff)}</div>
                    </div>
                    <div className="text-zinc-700 text-lg">→</div>
                    <div className="text-center">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">🌅 Wake-up</div>
                      <div className="font-medium text-zinc-200">{(() => {
                        const d = new Date(pastWakeupDate + 'T00:00:00');
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      })()}</div>
                      <div className="text-[11px] text-zinc-400">{((h) => { const ampm = h.hours >= 12 ? 'PM' : 'AM'; const h12 = h.hours === 0 ? 12 : h.hours > 12 ? h.hours - 12 : h.hours; return `${h12}:${String(h.minutes).padStart(2, '0')} ${ampm}`; })(pastWakeupTime)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* No-data banner */}
              {!pastSleepSessionId && pastWakeupDate === null && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4 text-center">
                  <p className="text-xs text-amber-400">No sleep data for this date</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Search by bedtime evening or wake-up morning to find your sleep</p>
                </div>
              )}

              {/* Date selector with day navigation */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-1 text-center">{pastSleepSessionId ? 'Move sleep to date' : 'Search by date'}</label>
                <p className="text-[10px] text-zinc-600 text-center mb-2">{pastSleepSessionId ? 'Change the date this sleep belongs to' : 'Works for both bedtime and wake-up dates'}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const d = new Date(pastSleepDate + 'T00:00:00');
                      d.setDate(d.getDate() - 1);
                      setPastSleepDate(localDateStr(d));
                    }}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={pastSleepDate}
                    onChange={(e) => setPastSleepDate(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 text-center"
                  />
                  <button
                    onClick={() => {
                      const d = new Date(pastSleepDate + 'T00:00:00');
                      d.setDate(d.getDate() + 1);
                      setPastSleepDate(localDateStr(d));
                    }}
                    disabled={pastSleepDate === localDateStr(new Date())}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mini sleep bar visualization */}
              {(() => {
                const off = pastDeviceOff.hours * 60 + pastDeviceOff.minutes;
                const asleep = pastFellAsleepAt.hours * 60 + pastFellAsleepAt.minutes;
                const wake = pastWakeupTime.hours * 60 + pastWakeupTime.minutes;
                const on = pastDeviceOn.hours * 60 + pastDeviceOn.minutes;
                let preSleep = asleep - off;
                if (preSleep < 0) preSleep += 24 * 60;
                let postWake = on - wake;
                if (postWake < 0) postWake += 24 * 60;
                const sleepStart = (off + preSleep) % 1440;
                const appOpen = (wake + postWake) % 1440;
                const mapTime = (mins: number) => {
                  const normalized = ((mins - 1080) % 1440 + 1440) % 1440;
                  return (normalized / 1440) * 100;
                };
                const hasPre = preSleep > 0;
                const hasPost = postWake > 0;
                const Seg = ({ start, end, color, topRound, bottomRound }: { start: number; end: number; color: string; topRound: boolean; bottomRound: boolean }) => {
                  const t = mapTime(start);
                  const b = mapTime(end);
                  if (t > b) return (
                    <>
                      <div className={`absolute left-0 right-0 ${topRound ? 'rounded-t-sm' : ''}`} style={{ top: `${t}%`, bottom: 0, backgroundColor: color, opacity: 0.8 }} />
                      <div className={`absolute left-0 right-0 ${bottomRound ? 'rounded-b-sm' : ''}`} style={{ top: 0, bottom: `${100 - b}%`, backgroundColor: color, opacity: 0.8 }} />
                    </>
                  );
                  const rounding = topRound && bottomRound ? 'rounded-sm' : topRound ? 'rounded-t-sm' : bottomRound ? 'rounded-b-sm' : '';
                  return <div className={`absolute left-0 right-0 ${rounding}`} style={{ top: `${t}%`, bottom: `${100 - b}%`, backgroundColor: color, opacity: 0.8 }} />;
                };
                return (
                  <div className="bg-zinc-800/50 rounded-xl p-4 mb-5">
                    <div className="flex items-start gap-5">
                      <div className="flex-shrink-0 w-12 flex flex-col items-center">
                        <span className="text-[9px] text-zinc-500 mb-1">6PM</span>
                        <div className="relative w-7 h-40">
                          <Seg start={off} end={sleepStart} color="#f59e0b" topRound={true} bottomRound={!hasPost && sleepStart >= wake} />
                          <Seg start={sleepStart} end={wake} color="#6366f1" topRound={!hasPre} bottomRound={!hasPost} />
                          {hasPost && <Seg start={wake} end={appOpen} color="#e11d48" topRound={false} bottomRound={true} />}
                        </div>
                        <span className="text-[9px] text-zinc-500 mt-1">6PM</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-zinc-400">Device Off</span><span className="text-zinc-200 font-medium">{((h) => { const ampm = h.hours >= 12 ? 'PM' : 'AM'; const h12 = h.hours === 0 ? 12 : h.hours > 12 ? h.hours - 12 : h.hours; return `${h12}:${String(h.minutes).padStart(2, '0')} ${ampm}`; })(pastDeviceOff)}</span></div>
                        <div className="flex justify-between"><span className="text-amber-400/80">Fell asleep</span><span className="text-zinc-200 font-medium">{((h) => { const ampm = h.hours >= 12 ? 'PM' : 'AM'; const h12 = h.hours === 0 ? 12 : h.hours > 12 ? h.hours - 12 : h.hours; return `${h12}:${String(h.minutes).padStart(2, '0')} ${ampm}`; })(pastFellAsleepAt)}</span></div>
                        <div className="text-[10px] text-amber-500/60 pl-2">+{preSleep}m pre-sleep</div>
                        <div className="flex justify-between"><span className="text-zinc-400">Woke up</span><span className="text-zinc-200 font-medium">{((h) => { const ampm = h.hours >= 12 ? 'PM' : 'AM'; const h12 = h.hours === 0 ? 12 : h.hours > 12 ? h.hours - 12 : h.hours; return `${h12}:${String(h.minutes).padStart(2, '0')} ${ampm}`; })(pastWakeupTime)}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Device On</span><span className="text-zinc-200 font-medium">{((h) => { const ampm = h.hours >= 12 ? 'PM' : 'AM'; const h12 = h.hours === 0 ? 12 : h.hours > 12 ? h.hours - 12 : h.hours; return `${h12}:${String(h.minutes).padStart(2, '0')} ${ampm}`; })(pastDeviceOn)}</span></div>
                        <div className="flex justify-between border-t border-zinc-700/50 pt-1.5"><span className="text-indigo-400 font-medium">Sleep</span><span className="text-indigo-400 font-semibold">{((s, w) => { let d = w - s; if (d < 0) d += 24 * 60; return `${Math.floor(d / 60)}h ${d % 60}m`; })(sleepStart, wake)}</span></div>
                        <div className="flex justify-between"><span className="text-emerald-400">Total (Off→On)</span><span className="text-emerald-400 font-semibold">{((o, n) => { let d = n - o; if (d < 0) d += 24 * 60; return `${Math.floor(d / 60)}h ${d % 60}m`; })(off, on)}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })()}



              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2 text-center">Device Off</label>
                <DurationPicker
                  hours={pastDeviceOff.hours}
                  minutes={pastDeviceOff.minutes}
                  onChange={(h, m) => setPastDeviceOff({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap={true}
                />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2 text-center">Fell asleep at</label>
                <DurationPicker
                  hours={pastFellAsleepAt.hours}
                  minutes={pastFellAsleepAt.minutes}
                  onChange={(h, m) => setPastFellAsleepAt({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap={true}
                />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2 text-center">Wake up</label>
                <DurationPicker
                  hours={pastWakeupTime.hours}
                  minutes={pastWakeupTime.minutes}
                  onChange={(h, m) => setPastWakeupTime({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap={true}
                />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2 text-center">Device On</label>
                <DurationPicker
                  hours={pastDeviceOn.hours}
                  minutes={pastDeviceOn.minutes}
                  onChange={(h, m) => setPastDeviceOn({ hours: h, minutes: m })}
                  maxHours={23}
                  hourLabel="Hr"
                  minuteLabel="Min"
                  wrap={true}
                />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPastSleepModal(false); setPastSleepError(null); setPastSleepSuccess(false); }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      setPastSleepError(null);
                      setPastSleepSuccess(false);

const selectedSleepDay = new Date(pastSleepDate + 'T00:00:00');
                      // pastSleepDate = the evening the sleep BELONGS to. Bedtime past
                      // midnight (before 12:00) belongs to this evening, so the raw
                      // timestamp lands on the NEXT calendar day (e.g., Aug 11's sleep
                      // at 3:03 AM = raw Aug 12 03:03). The next-day date applies to the
                      // sleep/wake-up labels only, never to the belonging date.
                      const buildTimestampForSleepDay = (time: { hours: number; minutes: number }) => {
                        const d = new Date(selectedSleepDay);
                        d.setHours(time.hours, time.minutes, 0, 0);
                        if (time.hours < 12) d.setDate(d.getDate() + 1);
                        return d;
                      };

                      const deviceOffDate = buildTimestampForSleepDay(pastDeviceOff);
                      const fellAsleepDate = buildTimestampForSleepDay(pastFellAsleepAt);
                      const wakeupDate = buildTimestampForSleepDay(pastWakeupTime);
                      const deviceOnDate = buildTimestampForSleepDay(pastDeviceOn);

                      // If wakeup is before device off, it's next day
                      // DO NOT advance fellAsleepDate here — it's typically on the SAME evening
                      // as device off (e.g., device off 23:00, fell asleep 23:30).
                      // Advancing it would create a 24h+ device_off_to_sleep_seconds delta,
                      // making actualSleepSeconds compute to 0 in get-sleep-trends.
                      if (wakeupDate <= deviceOffDate) {
                        wakeupDate.setDate(wakeupDate.getDate() + 1);
                        deviceOnDate.setDate(deviceOnDate.getDate() + 1);
                      }
                      // If fellAsleep is before device off by 10+ hours, it crossed midnight
                      // (e.g., device off 23:00, fell asleep 01:00 next day)
                      // If the gap is small (e.g., 22:00 vs 23:00), user fell asleep before device off — same day
                      if (fellAsleepDate <= deviceOffDate) {
                        const offMin = deviceOffDate.getHours() * 60 + deviceOffDate.getMinutes();
                        const sleepMin = fellAsleepDate.getHours() * 60 + fellAsleepDate.getMinutes();
                        if (offMin - sleepMin >= 600 || sleepMin > offMin) {
                          fellAsleepDate.setDate(fellAsleepDate.getDate() + 1);
                        }
                      }
                      // If device on is before wakeup, it's same day as wakeup
                      if (deviceOnDate <= wakeupDate) {
                        deviceOnDate.setDate(deviceOnDate.getDate() + 1);
                      }

                      const wakeUpToAppSec = Math.max(0, Math.round((deviceOnDate.getTime() - wakeupDate.getTime()) / 1000));
                      const deviceOffToSleepSec = Math.max(0, Math.round((fellAsleepDate.getTime() - deviceOffDate.getTime()) / 1000));
                      const sleepPayload = {
                        started_at: deviceOffDate.toISOString(),
                        ended_at: wakeupDate.toISOString(),
                        device_off_to_sleep_seconds: deviceOffToSleepSec,
                        wake_up_to_app_seconds: wakeUpToAppSec
                      };

                      if (pastSleepSessionId && window.deskflowAPI?.updateManualSleep) {
                        const result = await window.deskflowAPI.updateManualSleep(pastSleepSessionId, sleepPayload);
                        if (result.success) {
                          setPastSleepSuccess(true);
                          refreshStats();
                          setTimeout(() => setShowPastSleepModal(false), 1500);
                        } else {
                          setPastSleepError(result.error || 'Failed to update sleep');
                        }
                      } else if (window.deskflowAPI?.addManualSleep) {
                        const result = await window.deskflowAPI.addManualSleep(sleepPayload);
                        if (result.success) {
                          setPastSleepSuccess(true);
                          setPastSleepSessionId(null);
                          setPastOriginalStartedAt(null);
                          setPastDeviceOff({ hours: 22, minutes: 0 });
                          setPastFellAsleepAt({ hours: 22, minutes: 30 });
                          setPastWakeupTime({ hours: 7, minutes: 0 });
                          setPastDeviceOn({ hours: 7, minutes: 30 });
                          setPastSleepDate(localDateStr(new Date()));
                          refreshStats();
                          setTimeout(() => setShowPastSleepModal(false), 1500);
                        } else {
                          setPastSleepError(result.error || 'Failed to add sleep');
                        }
                      } else {
                        setPastSleepError('API not available');
                      }
                    } catch (err) {
                      setPastSleepError('Failed to save sleep');
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl transition-colors"
                >
                  {pastSleepSessionId ? 'Update Sleep' : 'Add Sleep'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* Gaps List */}
        <GapsListModal
          open={showGapsList}
          activities={activities}
          sessions={allSessions}
          defaultTimeframe={gapsDefaultTimeframe}
          onClose={() => setShowGapsList(false)}
          onPickGap={(gap) => {
            setGapTarget(gap);
            setShowGapsList(false);
          }}
          onFillGaps={(gaps) => {
            setGapTargets(gaps);
            setShowGapsList(false);
          }}
          onAssignTime={(gap) => {
            setManualAssignDate(gap.start);
            setManualAssignGap({ start: gap.start, end: gap.end });
            setShowGapsList(false);
            setShowManualAssign(true);
          }}
        />
        {/* Manual Time Assignment */}
        <ManualAssignModal
          open={showManualAssign}
          initialDate={manualAssignDate ?? undefined}
          initialGap={manualAssignGap}
          onClose={() => {
            setShowManualAssign(false);
            setManualAssignGap(null);
          }}
          onChanged={() => setManualVersion((v) => v + 1)}
        />
        {/* Gap Fill Modal */}
        <GapFillModal
          open={!!gapTarget || gapTargets.length > 0}
          gap={gapTarget as any}
          multiGaps={gapTargets.length > 0 ? gapTargets : undefined}
          activities={activities}
          sessions={allSessions}
          onClose={() => {
            setGapTarget(null);
            setGapTargets([]);
          }}
          onFillGap={async (gap, segments) => {
            await fillGapWithSegments(
              gap,
              segments,
              async (activityId, minutes, startedAt, endedAt) => {
                await window.deskflowAPI?.addExternalTime(activityId, minutes, startedAt, endedAt);
              }
            );
            refreshStats();
            if (window.deskflowAPI?.getExternalActivities) {
              window.deskflowAPI.getExternalActivities().then((data: any[]) => setActivities(data));
            }
          }}
        />
        {transferSession && (
          <TransferSessionModal
            open={!!transferSession}
            session={transferSession}
            activities={activities.filter(a => a.type !== 'sleep')}
            onClose={() => setTransferSession(null)}
            onTransferred={async () => {
              if (window.deskflowAPI?.getExternalSessions && viewingActivity) {
                const updated = await window.deskflowAPI.getExternalSessions('all');
                setViewingActivitySessions(updated.filter((x: any) => x.activity_id === viewingActivity.id));
              }
            }}
          />
        )}
      </AnimatePresence>
      </div>
    </PageShell>
  );
}
