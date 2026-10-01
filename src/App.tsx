import { useState, useEffect, useMemo, useRef, useCallback, memo, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ServerErrorBanner } from './components/ServerErrorBanner';
import { PageTitle } from './components/PageTitle';
import confetti from 'canvas-confetti';
import { navigateTo, scrollToSection } from './lib/deepNav';
import { resolvePageRoute } from './lib/smartSearchPages';
import Sidebar, { SIDEBAR_ITEMS } from './components/Sidebar';
import {
  Code2, BarChart3, Settings, Play, Pause, Clock,
  Download, Trash2, Zap, Database, AlertTriangle,
  Shield, Folder,
  ChevronLeft, ChevronRight, Save,
  Wallet, GraduationCap, Activity, Smartphone, Brain, HeartHandshake, Sparkles, Trophy,
  Bed, UserCheck, Bell, Command, LayoutDashboard, AlertCircle, RotateCcw, Bug,
} from 'lucide-react';
import SleepDetectionModal, { type AdjacentSleepGap } from './components/SleepDetectionModal';
import DevTriggerPanel from './components/DevTriggerPanel';
import { format as dateFormat } from 'date-fns';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import BrowserActivityPage from './pages/BrowserActivityPage';
import ProductivityPage from './pages/ProductivityPage';
import ActivityPage from './pages/ActivityPage';
import DatabasePage from './pages/DatabasePage';
import IDEProjectsPage from './pages/IDEProjectsPage';
import IDEHelpPage from './pages/IDEHelpPage';
import TutorialPage from './pages/TutorialPage';
import { LearnPage } from './components/learn/LearnPage';
import GuidePage from './pages/GuidePage';
import TerminalPage from './pages/TerminalPage';
import SimpleTerminalPage from './pages/SimpleTerminalPage';
import PenguinConsole from './terminal/App';
import ExternalPage from './pages/ExternalPage';
import RankingsPage from './pages/RankingsPage';
import FocusPage from './pages/FocusPage';
import ConductorPage from './pages/ConductorPage';

import { AiPage } from './pages/AiPage';
// TEMP-DISABLED-BY-AGENT: their NEON WIP has unresolved imports (withAlpha/resolveColor)
import { FeatureStudioPage } from './features/overlay-studio/OverlayStudioPage';
import { AppBackground } from './components/AppBackground';
import { ThemeToggle } from './components/ThemeToggle';
import TitleBar from './components/TitleBar';

import InsightsPage from './pages/InsightsPage';
import { FinancePage } from './pages/FinancePage';
import ResumePage from './pages/ResumePage';
import ResumeBuilderPage from './pages/ResumeBuilderPage';
import ResumePreviewPage from './pages/ResumePreviewPage';
import ResumeImportPage from './pages/ResumeImportPage';
import ResumeExportPage from './pages/ResumeExportPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import FeatureSpecViewer from './components/FeatureSpecViewer';
import AfkPromptModal from './components/AfkPromptModal';
import NativeFindOverlay from './components/NativeFindOverlay';
// The All/Page/Section scope UI that used to live in its own overlay now lives
// inside NativeFindOverlay, on the same surface as the Ctrl+F shortcut that
// people actually press. See NativeFindOverlay's header.
import type { SearchHit } from './services/search/index';
import { usePageSearchIndex } from './hooks/usePageSearchIndex';
import MissedTimePanel from './components/MissedTimePanel';
import { PairPhoneModal } from './components/PairPhoneModal';
import { VoiceProvider } from './context/VoiceContext';
import { getDateRange } from './lib/dateRange';
import type { Period } from './lib/dateRange';
import GlobalSearchCommandPalette from './components/GlobalSearchCommandPalette';
// Agent dashboard is disabled - file incomplete

// Lazy load OrbitSystem - it's heavy and should only load when needed
const OrbitSystem = lazy(() => import('./components/OrbitSystem').then(module => ({ default: module.default })));

// Life page combines Covenant (commitments/streaks) and Memories (photo/video
// collage) under a single tabbed page — warm clay/sage/amber/sky palette
const LifePage = lazy(() => import('./features/warmth/LifePage'));

// Agentic System page (agent comms + session groups + context brain)
const AgenticSystemPage = lazy(() => import('./pages/AgenticSystemPage'));

// SlideMind lecture workspace (ported lecturer-feature) — nested routes under /lecture
const LectureWorkspace = lazy(() => import('./features/lecture/LectureWorkspace'));


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

const OrbitSystemWrapper = memo(function OrbitSystemWrapper({
  logs,
  browserLogs,
  appColors,
  categoryOverrides,
}: {
  logs: ActivityLog[];
  browserLogs: ActivityLog[];
  appColors?: Record<string, string>;
  categoryOverrides?: Record<string, string>;
}) {
  // Force re-render when logs change - use logs length + first app name as key
  const logsCount = logs?.length || 0;
  const firstApp = logs?.[0]?.app || 'none';
  const periodKey = `${logsCount}-${firstApp}`;

  return (
    <Suspense fallback={<div className="h-[600px] flex items-center justify-center"><div className="text-zinc-400">Loading 3D visualization...</div></div>}>
      <OrbitSystem 
        key={periodKey}
        logs={logs} 
        websiteLogs={browserLogs}
        appColors={appColors}
        categoryOverrides={categoryOverrides}
      />
    </Suspense>
  );
});
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { format } from 'date-fns';

// Electron API types � see src/types/deskflow-api.d.ts for the Window interface

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface ActivityLog {
  id: number;
  timestamp: Date;
  app: string;
  category: string;
  duration: number; // seconds (NOT minutes — stores exact seconds for sub-minute precision)
  title?: string;
  project?: string;
  is_browser_tracking?: boolean;
  domain?: string;
  url?: string;
  platform?: string;
}

interface HeatmapCell {
  hour: number;
  day: number;
  value: number;
}

const APP_CATEGORIES = {
  'VS Code': { cat: 'IDE', color: '#4f46e5' },
  'PyCharm': { cat: 'IDE', color: '#10b981' },
  'IntelliJ IDEA': { cat: 'IDE', color: '#10b981' },
  'Obsidian': { cat: 'IDE', color: '#7c3aed' },
  'Claude': { cat: 'AI Tools', color: '#8b5cf6' },
  'ChatGPT': { cat: 'AI Tools', color: '#8b5cf6' },
  'Chrome': { cat: 'Browser', color: '#3b82f6' },
  'Firefox': { cat: 'Browser', color: '#f97316' },
  'YouTube': { cat: 'Entertainment', color: '#ef4444' },
  'Slack': { cat: 'Communication', color: '#14b8a6' },
  'Figma': { cat: 'Design', color: '#a855f7' },
  'Terminal': { cat: 'Productivity', color: '#64748b' },
  'Wispr Flow': { cat: 'Tools', color: '#f59e0b' },
  'Google Chrome': { cat: 'Browser', color: '#3b82f6' },
  'Windows Explorer': { cat: 'Productivity', color: '#64748b' },
  'Microsoft Edge': { cat: 'Browser', color: '#3b82f6' },
  'Notion': { cat: 'Productivity', color: '#10b981' },
  'Discord': { cat: 'Communication', color: '#14b8a6' },
  'Spotify': { cat: 'Entertainment', color: '#ec4899' },
  'Netflix': { cat: 'Entertainment', color: '#ef4444' },
};

// Productivity tier assignments for combined apps + websites calculation
const DEFAULT_TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other', 'Browser'],
  distracting: ['Entertainment', 'Social Media', 'Shopping']
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

const SIMULATED_APPS = Object.keys(APP_CATEGORIES);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate distinct colors using golden angle distribution
function generateDistinctColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle
    const saturation = 65 + (i % 3) * 10; // Vary saturation slightly
    const lightness = 50 + (i % 2) * 10; // Vary lightness slightly
    colors.push(`hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
}

// Convert HSL to hex for storage
function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if (!match) return '#888888';
  const [, h, s, l] = match;
  const H = parseFloat(h) / 360;
  const S = parseFloat(s) / 100;
  const L = parseFloat(l) / 100;

  if (S === 0) {
    const v = Math.round(L * 255);
    return `#${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`;
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const r = Math.round(hue2rgb(p, q, H + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, H) * 255);
  const b = Math.round(hue2rgb(p, q, H - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Map browser brand names to OS process names (what active-win returns)
// Duplicated in DashboardPage.tsx and main.ts — keep in sync
const BROWSER_PROCESS_NAMES_RENDERER: Record<string, string[]> = {
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

function isAppMatchingBrowserRenderer(appName: string, browserName: string | string[]): boolean {
  if (!appName || !browserName) return false;
  const appLower = appName.toLowerCase().replace(/\.exe$/i, '');
  const browsers = Array.isArray(browserName) ? browserName : [browserName];
  return browsers.some(b => {
    const browserLower = b.toLowerCase();
    const processNames = BROWSER_PROCESS_NAMES_RENDERER[browserLower] || [browserLower];
    return appLower.includes(browserLower) ||
      browserLower.includes(appLower) ||
      processNames.some(p => appLower.includes(p));
  });
}

import { GapBanner } from './components/GapBanner';
import { TodoMiniPage } from './features/todo/TodoMiniPage';
import { GapFillModal } from './components/external/GapFillModal';
import { ManualAssignModal } from './components/external/ManualAssignModal';
import { fillGapWithSegments } from './lib/external/gaps';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';

// DEBUG: Global hashchange listener
window.addEventListener('hashchange', (e) => {
  console.log('[HASHCHANGE]', e.oldURL, '?', e.newURL);
});

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, forceRender] = useState(0);

  // Global command palette — ⌘K / Ctrl+K navigation search (app-wide)
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Current page id derived from route — used by smart search scoping
  const currentPageId = location.pathname === '/' ? 'dashboard'
    : location.pathname.replace('/', '') || 'dashboard';

  // Index the rendered page so the find bar's All / Section scopes have
  // something real to search on every route, not just the dashboard.
  usePageSearchIndex(currentPageId);

  // Find bar — one surface, two scopes (see NativeFindOverlay).
  //   Ctrl+F            → 'subpage' (live find on what is on screen right now)
  //   sidebar magnifier → 'app'     (indexed search across every route)
  // Ctrl+K is handled separately by GlobalSearchCommandPalette.
  const [nativeFindOpen, setNativeFindOpen] = useState(false);
  const [findScope, setFindScope] = useState<'subpage' | 'app'>('subpage');

  const openFind = useCallback((scope: 'subpage' | 'app') => {
    setFindScope(scope);
    setNativeFindOpen(true);
  }, []);

  // The three sidebar "Smart search" buttons dispatch `smart-search:open`.
  // Nothing in the app ever listened for it — the only listeners lived in
  // useAppSmartSearch, which is never called — so those buttons were no-ops and
  // the All/Section scope feature had no reachable entry point at all.
  useEffect(() => {
    const onSmart = () => openFind('app');
    const onNative = () => openFind('subpage');
    window.addEventListener('smart-search:open', onSmart);
    window.addEventListener('native-find:open', onNative);
    return () => {
      window.removeEventListener('smart-search:open', onSmart);
      window.removeEventListener('native-find:open', onNative);
    };
  }, [openFind]);

  const handleSmartSearchSelect = useCallback((hit: SearchHit) => {
    console.debug('[SmartSearch] selected:', hit);
    // If the hit is on a different page, navigate there and scroll to section
    if (hit.pageId !== currentPageId) {
      console.debug('[SmartSearch] navigating to different page:', hit.pageId);
      const route = resolvePageRoute(hit.pageId);
      console.debug('[SmartSearch] resolved route:', route);
      if (route) {
        console.debug('[SmartSearch] navigating to:', route.route);
        navigateTo({ route: route.route, tab: hit.section ? route.tab : undefined }, navigate);
        if (hit.section) {
          console.debug('[SmartSearch] will scroll to section:', hit.section);
          setTimeout(() => {
            const ok = scrollToSection(hit.section);
            console.debug('[SmartSearch] scrollToSection result:', ok, 'section:', hit.section);
          }, 300);
        }
      }
    } else {
      console.debug('[SmartSearch] same page, scrolling to section:', hit.section);
      // Same page — just scroll to the section without navigating away
      if (hit.section) {
        const ok = scrollToSection(hit.section);
        console.debug('[SmartSearch] scrollToSection result:', ok, 'section:', hit.section);
      } else {
        // No section specified; try scrolling to the title element
        const el = document.getElementById(hit.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentPageId, navigate]);

  // Keyboard shortcut: Ctrl+F / ⌘F — open the find-in-page bar.
  // Ctrl+K opens the command palette separately.
  //
  // Electron has NO browser find bar, so if we do not open our own, Ctrl+F is
  // a literal no-op. That is why this handler is unconditional: it fires even
  // when a text field has focus (Chrome does the same), and it captures the
  // event so no other Ctrl+F handler can swallow it.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() !== 'f') return;
      e.preventDefault();
      openFind('subpage');
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [openFind]);

  // Fallback: poll hash and force re-render if React Router misses the change
  const lastHashRef = useRef(window.location.hash);
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.location.hash !== lastHashRef.current) {
        lastHashRef.current = window.location.hash;
        forceRender(n => n + 1);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const page = location.pathname === '/' ? 'dashboard'
      : location.pathname.replace('/', '') || 'dashboard';
    document.documentElement.setAttribute('data-page', page);
    // The primary scroller is re-picked per route by components/ui/smooth-scroll.
    // HashRouter fires no popstate for an in-app navigation, so the module needs
    // this signal to hand the lerp to whichever pane the new page actually
    // scrolls. Fired after paint so that pane exists.
    window.dispatchEvent(new CustomEvent('deskflow:route', { detail: { page } }));
  }, [location.pathname]);

  useEffect(() => {
    // Selection engine activated via UI button, not keyboard shortcut
  }, []);

  // Theme is auto-initialized by src/lib/theme.ts at module load (line 94-96).
  // No additional useEffect needed here — adding one causes a flash by fighting the module init.

  const [isTracking, setIsTracking] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);
  const [currentApp, setCurrentApp] = useState('VS Code');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [sessionStart, setSessionStart] = useState(new Date());
  const [logs, setLogs] = useState<ActivityLog[]>([]); // Display logs (filtered by period)
  const [planetColors, setPlanetColors] = useState<Record<string, string>>({});
  const [showCustomization, setShowCustomization] = useState(false);
  const [storageStatus, setStorageStatus] = useState<{
    type: 'sqlite' | 'json' | 'none';
    working: boolean;
    path: string;
    error?: string;
    logCount: number;
  }>({ type: 'none', working: false, path: '', logCount: 0 });
  const [showStorageDetails, setShowStorageDetails] = useState(false);
  const [terminalProjectsetTerminalProjectInfo] = useState<{ name: string; path: string }>({ name: '', path: '' });
  const [provisionStatus, setProvisionStatus] = useState<'idle' | 'provisioning' | 'provisioned'>('idle');

  // Gap Indicator Banner State
  const [unfilledMinutes, setUnfilledMinutes] = useState(0);
  const [gapCount, setGapCount] = useState(0);
  const [showGapBannerSetting, setShowGapBannerSetting] = useState(true);

  // Sidebar collapse state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('df-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [solarOverlayActive, setSolarOverlayActive] = useState(false);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('df-sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  // Sidebar width (persisted, ignored while collapsed). Clamp on read too — a
  // hand-edited or stale localStorage value must not escape the range.
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const raw = Number(localStorage.getItem('df-sidebar-width'));
      return Number.isFinite(raw) && raw >= 208 && raw <= 520 ? raw : 224;
    } catch { return 224; }
  });
  const resizeSidebar = useCallback((w: number) => {
    setSidebarWidth(w);
    try { localStorage.setItem('df-sidebar-width', String(w)); } catch {}
  }, []);

  // Hide sidebar when solar overlay is active (fullscreen or modal)
  useEffect(() => {
    const onSolarOverlay = (e: CustomEvent<{ active: boolean }>) => setSolarOverlayActive(e.detail.active);
    const onSolarFullscreen = (e: CustomEvent<{ fullscreen: boolean }>) => setSolarOverlayActive(e.detail.fullscreen);
    window.addEventListener('solar-overlay-change', onSolarOverlay as EventListener);
    window.addEventListener('solar-fullscreen-change', onSolarFullscreen as EventListener);
    return () => {
      window.removeEventListener('solar-overlay-change', onSolarOverlay as EventListener);
      window.removeEventListener('solar-fullscreen-change', onSolarFullscreen as EventListener);
    };
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent<{ name: string; path: string }>) => setTerminalProjectInfo(e.detail);
    window.addEventListener('terminal-project-info', handler as EventListener);
    return () => window.removeEventListener('terminal-project-info', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent<{ status: 'idle' | 'provisioning' | 'provisioned' }>) => setProvisionStatus(e.detail.status);
    window.addEventListener('provision-status-changed', handler as EventListener);
    return () => window.removeEventListener('provision-status-changed', handler as EventListener);
  }, []);

  // State used by loadInitialData effect
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const [expandedPeriod, setExpandedPeriod] = useState<'week' | 'month' | null>(null);
  const [dateOffset, setDateOffset] = useState(0);
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]); // ALL logs - never changes (for heatmap)
  
  const allLogsFingerprintRef = useRef<string>('');
  // Reset dateOffset when period changes
  useEffect(() => {
    setDateOffset(0);
  }, [selectedPeriod]);
  
  // Computed filtered logs from allLogs based on selectedPeriod and dateOffset
  const filteredLogs = useMemo(() => {
    if (selectedPeriod === 'all') return allLogs;
    const range = getDateRange(selectedPeriod, dateOffset);
    return allLogs.filter(log => log.timestamp >= range.start && log.timestamp < range.end);
  }, [allLogs, selectedPeriod, dateOffset]);

  // Platform filter state for ActivityPage OS split feature
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const availablePlatforms = Array.from(new Set(allLogs.map((l: any) => l.platform).filter(Boolean)));

  const platformFilteredLogs = useMemo(() => {
    if (platformFilter === 'all') return filteredLogs;
    return filteredLogs.filter((log: any) => log.platform === platformFilter);
  }, [filteredLogs, platformFilter]);

  // Track filteredLogs fingerprint to avoid unnecessary logs sync
  const prevFilteredFingerprint = useRef('');
  useEffect(() => {
    const fp = filteredLogs.length + '|' + (filteredLogs[0]?.timestamp || '');
    if (fp !== prevFilteredFingerprint.current) {
      prevFilteredFingerprint.current = fp;
      setLogs(filteredLogs);
    }
  }, [filteredLogs]);

  const [browserCategoryStats, setBrowserCategoryStats] = useState<any[]>([]); // Browser domain/category stats
  const [browserLogs, setBrowserLogs] = useState<ActivityLog[]>([]); // Browser tracking logs (website data)
  const [allWebsiteStats, setAllWebsiteStats] = useState<any[]>([]); // All time website stats for Settings

  // Live activity logs for dashboard
  const [liveActivityLogs, setLiveActivityLogs] = useState<Array<{id: string; timestamp: number; type: 'app' | 'browser' | 'ide'; name: string; category?: string; title?: string; url?: string}>>([]);
  const liveActivityLogsRef = useRef<Array<{id: string; timestamp: number; type: 'app' | 'browser' | 'ide'; name: string; category?: string; title?: string; url?: string}>>([]);

  // Reusable function to load data from Electron/SQLite
  const loadData = async () => {
    if (window.deskflowAPI) {
      try {
        const status = await window.deskflowAPI.getStorageStatus();
        setStorageStatus(status);

        // Get ALL logs (not filtered)
        const electronLogs = await window.deskflowAPI.getLogs();

        const formattedLogs: ActivityLog[] = electronLogs.map((log: any) => ({
          id: log.id,
          timestamp: new Date(log.timestamp),
          app: log.app,
          category: log.category || 'Other',
          duration: Math.round(log.duration_ms / 1000),
          title: log.title,
          project: log.project,
          is_browser_tracking: log.is_browser_tracking === 1 || log.is_browser_tracking === true,
          domain: log.domain,
          url: log.url,
          platform: log.platform,
        }));

        // Set BOTH to all data - heatmap needs allLogs, display will filter
        setAllLogs(formattedLogs);
        setLogs(formattedLogs);
        
        // Debug: Log timestamp range
        if (formattedLogs.length > 0) {
          const dates = formattedLogs.map(l => l.timestamp.getTime());
          const minDate = new Date(dates.reduce((a, b) => Math.min(a, b), Infinity));
          const maxDate = new Date(dates.reduce((a, b) => Math.max(a, b), -Infinity));
          console.log('[DeskFlow] Loaded logs:', formattedLogs.length, '| Date range:', minDate.toLocaleDateString(), 'to', maxDate.toLocaleDateString());
        }
        console.log('[DeskFlow] Loaded logs:', formattedLogs.length, 'entries', formattedLogs.map(l => l.app).filter((v, i, a) => a.indexOf(v) === i));
        // Also fetch pre-computed dashboard data (if available)
        try {
          const dashData = await window.deskflowAPI.getDashboardData({ period: selectedPeriod });
          if (dashData?.success) {
            console.log('[DeskFlow] Pre-computed dashboard data loaded:', 
              { hourly: dashData.data.hourly?.length, daily: dashData.data.daily?.length, 
                topApps: dashData.data.topApps?.length, recentSessions: dashData.data.recentSessions?.length });
          }
        } catch (e) {
          console.log('[DeskFlow] Pre-computed data not available (non-SQLite mode)');
        }
      } catch (err) {
        console.error('[DeskFlow] Failed to load logs:', err);
      }
    } else {
      // Fallback for web version - define inline
      const fallbackLogs = [
        { id: 1, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), app: 'VS Code', category: 'IDE', duration: 142, title: 'DeskFlow.tsx', project: 'DeskFlow' },
        { id: 2, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), app: 'Claude', category: 'AI Tools', duration: 47, title: 'Productivity', project: undefined },
        { id: 3, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), app: 'Chrome', category: 'Browser', duration: 29, title: 'youtube.com', project: undefined },
        { id: 4, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5), app: 'PyCharm', category: 'IDE', duration: 88, title: 'main.py', project: 'EcomAPI' },
        { id: 5, timestamp: new Date(Date.now() - 1000 * 60 * 40), app: 'YouTube', category: 'Entertainment', duration: 22, title: 'TypeScript', project: undefined },
        { id: 6, timestamp: new Date(Date.now() - 1000 * 60 * 20), app: 'Slack', category: 'Communication', duration: 15, title: 'Team Sync', project: undefined },
      ];
      setLogs(fallbackLogs);
      setAllLogs(fallbackLogs);
    }
  };

  // Load real logs from Electron/SQLite on mount
  useEffect(() => {
    loadData().finally(() => {
      window.dispatchEvent(new Event('rheo:boot-ready'));
    });
  }, []);

  // Load auto-start status on mount
  useEffect(() => {
    if (window.deskflowAPI?.getAutoStartStatus) {
      window.deskflowAPI.getAutoStartStatus().then((enabled: boolean) => {
        setAutoStartEnabled(enabled);
        console.log('[DeskFlow] Auto-start status:', enabled);
      }).catch(err => console.warn('[DeskFlow] Failed to get auto-start status:', err));
    }
  }, []);

  // Load external activities from database on mount
  useEffect(() => {
    if (window.deskflowAPI?.getExternalActivities) {
      window.deskflowAPI.getExternalActivities().then((activities: any[]) => {
        console.log('[DeskFlow] Loaded external activities:', activities.length);
        // Map to expected format for DashboardPage
        const mapped = activities.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type || 'stopwatch',
          color: a.color || '#10b981',
          icon: a.icon || 'Activity',
          is_productive: a.is_productive !== false
        }));
        setExternalActivities(mapped);
      }).catch(err => console.warn('[DeskFlow] Failed to load external activities:', err));
    }
    
    // Check for active external session in database - restore if exists
    if (window.deskflowAPI?.getActiveExternalSession) {
      window.deskflowAPI.getActiveExternalSession().then((session: any) => {
        if (session && session.id) {
          console.log('[DeskFlow] Found active external session in DB:', session);
          // Restore the timer state from database
          const startTime = new Date(session.started_at).getTime();
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          
          // Update timerState with active session
          const restoredState = {
            productiveMs: 0,
            startTime: startTime,
            paused: false,
            lastTier: null,
            externalRunning: true,
            externalStart: startTime,
            externalElapsed: elapsedSeconds * 1000,
            selectedExternalActivity: { 
              id: session.activity_id, 
              name: session.name 
            }
          };
          setTimerState(restoredState);
          localStorage.setItem('deskflow-timer-state', JSON.stringify(restoredState));
        }
      }).catch(err => console.warn('[DeskFlow] Failed to get active session:', err));
    }
  }, []);

  // Refresh external activities when external-data-changed event fires
  useEffect(() => {
    const refreshActivities = () => {
      if (window.deskflowAPI?.getExternalActivities) {
        window.deskflowAPI.getExternalActivities().then((activities: any[]) => {
          const mapped = activities.map((a: any) => ({
            id: a.id,
            name: a.name,
            type: a.type || 'stopwatch',
            color: a.color || '#10b981',
            icon: a.icon || 'Activity',
            is_productive: a.is_productive !== false
          }));
          setExternalActivities(mapped);
        }).catch((err: any) => console.warn('[DeskFlow] Failed to refresh external activities:', err));
      }
    };
    window.addEventListener('external-data-changed', refreshActivities);
    return () => window.removeEventListener('external-data-changed', refreshActivities);
  }, []);

  // Listen for real foreground changes from Electron
  useEffect(() => {
    if (window.deskflowAPI && typeof window.deskflowAPI.onForegroundChange === 'function') {
      window.deskflowAPI.onForegroundChange((data) => {
        console.log('[DeskFlow] Foreground changed:', data.app, data.category);
        
        // Track the current foreground app
        currentForegroundAppRef.current = data.app || '';
        
        setCurrentApp(data.app);
        setSessionStart(new Date(data.timestamp));
        setElapsedTime(0);
        
        // Add to live activity logs
        const newLog = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          type: 'app' as const,
          name: data.app,
          category: data.category,
          title: data.title
        };
        liveActivityLogsRef.current = [...liveActivityLogsRef.current.slice(-49), newLog];
        setLiveActivityLogs([...liveActivityLogsRef.current]);
        
        // Refresh logs - only update allLogs if data actually changed (avoids cascading useMemo recomputation)
        window.deskflowAPI?.getLogs().then(electronLogs => {
          const formattedLogs: ActivityLog[] = electronLogs.map((log: any) => ({
            id: log.id,
            timestamp: new Date(log.timestamp),
            app: log.app,
            category: log.category || 'Other',
            duration: Math.round(log.duration_ms / 1000), // ms to seconds
            title: log.title,
            project: log.project,
            is_browser_tracking: log.is_browser_tracking === 1 || log.is_browser_tracking === true,
            domain: log.domain,
            url: log.url,
            platform: log.platform,
          }));
          // Fingerprint: compare by count + first/last ID to skip no-op updates
          const fp = formattedLogs.length + ':' + (formattedLogs.length > 0 ? formattedLogs[0].id + '-' + formattedLogs[formattedLogs.length - 1].id : 'empty');
          if (fp !== allLogsFingerprintRef.current) {
            allLogsFingerprintRef.current = fp;
            setAllLogs(formattedLogs);
          }
          // Don't setLogs here - the useEffect will handle filtering based on selectedPeriod
        });
      });
    }

    // Listen for tracking heartbeat from main process
    // Only update currentApp from heartbeat, NOT isTracking (to prevent overriding user's manual toggle or idle pause)
    if (window.deskflowAPI && typeof window.deskflowAPI.onTrackingHeartbeat === 'function') {
      window.deskflowAPI.onTrackingHeartbeat((data) => {
        // Don't update isTracking from heartbeat - let user control it
        if (data.currentApp) {
          setCurrentApp(data.currentApp);
          currentForegroundAppRef.current = data.currentApp;
        }
        // Store category for passive-active idle guard
        if (data.currentCategory) currentCategoryRef.current = data.currentCategory;
        // Store OS-level idle seconds for idle detection
        if (typeof data.systemIdleSeconds === 'number') {
          systemIdleSecondsRef.current = data.systemIdleSeconds;
          // Auto-resume from idle if system idle drops below threshold (user resumed activity)
          if (idleRef.current && data.systemIdleSeconds * 1000 < idleThreshold * 60 * 1000) {
            console.log('[DeskFlow] System idle dropped - resuming tracking');
            setIsIdle(false);
            setIsTracking(true);
            setSessionStart(new Date());
            idleReturnFnRef.current();
          }
        }
      });
    }

    // Listen for browser tracking live events
    if (window.deskflowAPI && typeof window.deskflowAPI.onBrowserTrackingEvent === 'function') {
      window.deskflowAPI.onBrowserTrackingEvent((data) => {
        // SIMPLE CHECK: Only track website if the current foreground app is the tracking browser
        const trackingBrowser = trackingBrowserRef.current;
        const currentApp = currentForegroundAppRef.current;
        
        // If current app is NOT the tracking browser, skip
        // Uses process name mapping to handle brand-name vs executable-name mismatches
        if (!trackingBrowser || !currentApp || !isAppMatchingBrowserRenderer(currentApp, trackingBrowser)) {
          return; // Not on browser - don't log website
        }
        
        if (data.type === 'browser-data' || data.type === 'live-log') {
          // Deduplication: Only add if it's a DIFFERENT website from the last log entry
          const lastLog = liveActivityLogsRef.current[liveActivityLogsRef.current.length - 1];
          const newDomain = data.domain || data.title || 'Unknown';
          
          // Skip if the same domain is already the last entry (prevent duplicates)
          if (lastLog && lastLog.type === 'browser' && lastLog.name === newDomain) {
            return;
          }
          
          const newLog = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: data.timestamp || Date.now(),
            type: 'browser' as const,
            name: newDomain,
            title: data.title,
            url: data.url,
            elapsed_seconds: 0,
          };
          liveActivityLogsRef.current = [...liveActivityLogsRef.current.slice(-49), newLog];
          setLiveActivityLogs([...liveActivityLogsRef.current]);
        }
      });
    }
  }, []);

  // Periodic data refresh to recover from stale DB connection after system sleep/idle
  useEffect(() => {
    let reconnectAttempts = 0;
    const refresh = async () => {
      const api = (window as any).deskflowAPI;
      if (!api) return;
      try {
        const status = await api.getStorageStatus();
        setStorageStatus(status);
        if (status.working) {
          setDbConnected(true);
          reconnectAttempts = 0;
          const electronLogs = await api.getLogs();
          const formattedLogs: ActivityLog[] = electronLogs.map((log: any) => ({
            id: log.id,
            timestamp: new Date(log.timestamp),
            app: log.app,
            category: log.category || 'Other',
            duration: Math.round(log.duration_ms / 1000),
            title: log.title,
            project: log.project,
            is_browser_tracking: log.is_browser_tracking === 1 || log.is_browser_tracking === true,
            domain: log.domain,
            url: log.url,
          }));
          const fp = formattedLogs.length + ':' + (formattedLogs.length > 0 ? formattedLogs[0].id + '-' + formattedLogs[formattedLogs.length - 1].id : 'empty');
          if (fp !== allLogsFingerprintRef.current) {
            allLogsFingerprintRef.current = fp;
            setAllLogs(formattedLogs);
            setLogs(formattedLogs);
          }
        } else {
          setDbConnected(false);
        }
      } catch (err) {
        console.error('[App] Storage refresh error (bridge or DB):', err);
        if (api === undefined) return;
        reconnectAttempts++;
        if (reconnectAttempts >= 5) setDbConnected(false);
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Load saved planet colors or generate new ones
  // Read saved colors once on mount, persist passively
  const [savedColorMap, setSavedColorMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('deskflow-planet-colors');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const appColors = useMemo(() => {
    const uniqueApps = Array.from(new Set(logs.map(log => log.app)));
    const colorMap = { ...savedColorMap };
    const appsNeedingColors = uniqueApps.filter(app => !colorMap[app]);
    if (appsNeedingColors.length > 0) {
      const newColors = generateDistinctColors(appsNeedingColors.length);
      appsNeedingColors.forEach((app, i) => {
        colorMap[app] = hslToHex(newColors[i]);
      });
      // Defer the persist to effect below
    }
    return colorMap;
  }, [logs, savedColorMap]);

  // Passive persist: save when colorMap grows
  useEffect(() => {
    localStorage.setItem('deskflow-planet-colors', JSON.stringify(appColors));
  }, [appColors]);

  // Ref to track tracking browser without causing re-renders in useEffect dependencies
  const trackingBrowserRef = useRef<string>('');
  const currentForegroundAppRef = useRef<string>('');

  // Load category overrides from localStorage AND categoryConfig on mount
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [domainKeywordRules, setDomainKeywordRules] = useState<Record<string, string[]>>({});
  const [trackingBrowser, setTrackingBrowser] = useState<string>('');
  const [trackingBrowsers, setTrackingBrowsers] = useState<string[]>([]);

  // Update ref when trackingBrowser state changes
  useEffect(() => {
    trackingBrowserRef.current = trackingBrowser;
  }, [trackingBrowser]);

  useEffect(() => {
    const loadTrackingBrowser = async () => {
      try {
        if (window.deskflowAPI?.getPreferences) {
          const prefs = await window.deskflowAPI.getPreferences();
          // Load array of browsers with extension
          if (prefs?.browsersWithExtension && Array.isArray(prefs.browsersWithExtension) && prefs.browsersWithExtension.length > 0) {
            setTrackingBrowsers(prefs.browsersWithExtension);
            setTrackingBrowser(prefs.browsersWithExtension[0] || '');
          } else if (prefs?.browserWithExtension) {
            setTrackingBrowser(prefs.browserWithExtension.toLowerCase());
            setTrackingBrowsers([prefs.browserWithExtension.toLowerCase()]);
          }
          if (prefs?.timerBehavior) {
            setTimerBehavior(prefs.timerBehavior);
          }
          if (prefs?.trackerAppMode) {
            setTrackerAppMode(prefs.trackerAppMode);
          }
          if (prefs?.showGapBannerSetting !== undefined) {
            setShowGapBannerSetting(prefs.showGapBannerSetting);
          }
        }
      } catch { /* ignore */ }
    };
    loadTrackingBrowser();
    const interval = setInterval(loadTrackingBrowser, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's gap data for the global banner
  const fetchGaps = async () => {
    try {
      if ((window as any).deskflowAPI?.detectUsageGaps) {
        const gaps = await (window as any).deskflowAPI.detectUsageGaps({ period: 'today', minGapMinutes: 5 });
        if (gaps && gaps.length > 0) {
          const totalMinutes = gaps.reduce((sum: number, g: any) => sum + Math.round(g.durationSeconds / 60), 0);
          setUnfilledMinutes(totalMinutes);
          setGapCount(gaps.length);
        } else {
          setUnfilledMinutes(0);
          setGapCount(0);
        }
      }
    } catch (_e) {
      setUnfilledMinutes(0);
      setGapCount(0);
    }
  };

  useEffect(() => {
    fetchGaps();
    const interval = setInterval(fetchGaps, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Sleep detection - tracks gaps in window focus
  const [showSleepDetection, setShowSleepDetection] = useState(false);
  const [sleepDetectionData, setSleepDetectionData] = useState<{
    gapMinutes: number;
    suggestedBedtime: string;
    suggestedWakeTime: string;
    adjacentGaps?: AdjacentSleepGap[];
  } | null>(null);
  const [sleepModalStep, setSleepModalStep] = useState<'sleep' | 'gaps'>('sleep');
  const [sleepFillActivities, setSleepFillActivities] = useState<any[] | null>(null);
  const [sleepFillSessions, setSleepFillSessions] = useState<any[] | null>(null);
  const [sleepGapFillTarget, setSleepGapFillTarget] = useState<any>(null);
  const [sleepGapQueue, setSleepGapQueue] = useState<any[]>([]);
  const [sleepFilledGapStarts, setSleepFilledGapStarts] = useState<string[]>([]);
  const [sleepDetectCustomBedtime, setSleepDetectCustomBedtime] = useState({ hours: 22, minutes: 0 });
  const [sleepDetectCustomWaketime, setSleepDetectCustomWaketime] = useState({ hours: 7, minutes: 0 });
  const [sleepDetectFellAsleepAt, setSleepDetectFellAsleepAt] = useState({ hours: 22, minutes: 15 });
  const [sleepDetectWakeUpAt, setSleepDetectWakeUpAt] = useState({ hours: 6, minutes: 55 });
  const [sleepDetectDate, setSleepDetectDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // On mount, check if there's a pending sleep detection
  useEffect(() => {
    const checkSleepDetect = async () => {
      try {
        if (window.deskflowAPI?.checkSleepDetection) {
          const data = await window.deskflowAPI.checkSleepDetection();
          if (data?.detected) {
            setSleepDetectionData(data);
            const bed = new Date(data.suggestedBedtime);
            const wake = new Date(data.suggestedWakeTime);
            setSleepDetectCustomBedtime({ hours: bed.getHours(), minutes: bed.getMinutes() });
            setSleepDetectCustomWaketime({ hours: wake.getHours(), minutes: wake.getMinutes() });
            setSleepDetectFellAsleepAt({ hours: bed.getHours(), minutes: (bed.getMinutes() + 15) % 60 });
            setSleepDetectWakeUpAt({ hours: wake.getHours(), minutes: Math.max(0, wake.getMinutes() - 5) });
            const bd = new Date(bed);
            if (bd.getHours() < 12) bd.setDate(bd.getDate() - 1);
            setSleepDetectDate(`${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`);
            setSleepModalStep('sleep');
            setShowSleepDetection(true);
          }
        }
      } catch { /* ignore */ }
    };
    checkSleepDetect();
  }, []);

  // On mount, restore persisted AFK queue (survives app restart)
  useEffect(() => {
    const loadPersistedAfk = async () => {
      try {
        if (window.deskflowAPI?.loadAfkQueue) {
          const persisted = await window.deskflowAPI.loadAfkQueue();
          if (Array.isArray(persisted) && persisted.length > 0) {
            // Validate entries � only restore those that aren't stale (>2 hours old)
            const now = Date.now();
            const MAX_AGE_MS = 2 * 60 * 60 * 1000;
            const fresh = persisted.filter((e: any) => e.returnMs && (now - e.returnMs) < MAX_AGE_MS);
            if (fresh.length > 0) {
              setAfkPromptQueue(fresh);
              afkQueueIdRef.current = Math.max(...fresh.map((e: any) => e.id || 0)) + 1;
              console.log(`[DeskFlow] Restored ${fresh.length} persisted AFK prompt(s)`);
            }
          }
        }
      } catch { /* ignore */ }
    };
    loadPersistedAfk();
  }, []);

  // Listen for real-time sleep detection from main process
  useEffect(() => {
    if (window.deskflowAPI?.onSleepDetection) {
      window.deskflowAPI.onSleepDetection(async (data: any) => {
        // data comes directly from the 'sleep-detection' IPC event sent by checkSleepGap.
        // It carries { gapStart, gapEnd, gapMinutes } — use it directly instead of
        // re-reading the JSON file via checkSleepDetection() (which adds latency and a
        // second failure point if the file was already cleared by a stale-file guard).
        if (data?.gapMinutes >= 45) {
          sleepActiveRef.current = true;
          // Keep existing AFK prompts — sleep and AFK can coexist
          // AFK duration will be reduced by sleep period automatically
          setSleepDetectionData({
            gapMinutes: data.gapMinutes,
            suggestedBedtime: new Date(data.gapStart).toISOString(),
            suggestedWakeTime: new Date(data.gapEnd).toISOString(),
          });
          const bed = new Date(data.gapStart);
          const wake = new Date(data.gapEnd);
          setSleepDetectCustomBedtime({ hours: bed.getHours(), minutes: bed.getMinutes() });
          setSleepDetectCustomWaketime({ hours: wake.getHours(), minutes: wake.getMinutes() });
          setSleepDetectFellAsleepAt({ hours: bed.getHours(), minutes: (bed.getMinutes() + 15) % 60 });
          setSleepDetectWakeUpAt({ hours: wake.getHours(), minutes: Math.max(0, wake.getMinutes() - 5) });
          const bd = new Date(bed);
          if (bd.getHours() < 12) bd.setDate(bd.getDate() - 1);
          setSleepDetectDate(`${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`);
          setSleepModalStep('sleep');
          setShowSleepDetection(true);
        }
      });
    }
  }, []);

  // Foreground sleep detection: check for overnight gaps when user returns to app
  const lastVisibilityCheckRef = useRef(Date.now());
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const gapMs = now - lastVisibilityCheckRef.current;
      lastVisibilityCheckRef.current = now;
      // If app was hidden for >45 minutes and it's sleep hours, check for sleep
      if (gapMs < 45 * 60 * 1000) return;
      const hour = new Date().getHours();
      const isSleepHours = hour >= 21 || hour < 10;
      if (!isSleepHours) return;
      try {
        const detResult = await window.deskflowAPI?.checkSleepDetection?.();
        if (detResult?.detected && !showSleepDetection) {
          setSleepDetectionData(detResult);
          const bed = new Date(detResult.suggestedBedtime);
          const wake = new Date(detResult.suggestedWakeTime);
          setSleepDetectCustomBedtime({ hours: bed.getHours(), minutes: bed.getMinutes() });
          setSleepDetectCustomWaketime({ hours: wake.getHours(), minutes: wake.getMinutes() });
          setSleepDetectFellAsleepAt({ hours: bed.getHours(), minutes: (bed.getMinutes() + 15) % 60 });
          setSleepDetectWakeUpAt({ hours: wake.getHours(), minutes: Math.max(0, wake.getMinutes() - 5) });
          const bd = new Date(bed);
          if (bd.getHours() < 12) bd.setDate(bd.getDate() - 1);
          setSleepDetectDate(`${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`);
          setSleepModalStep('sleep');
          setShowSleepDetection(true);
        }
      } catch { /* ignore */ }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Also check on window focus (Electron sometimes doesn't fire visibilitychange)
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissSleepDetection = async () => {
    sleepActiveRef.current = false;
    sleepPeriodRef.current = null;
    setSleepModalStep('sleep');
    setShowSleepDetection(false);
    setSleepDetectionData(null);
    setSleepFillActivities(null);
    setSleepFillSessions(null);
    setSleepGapFillTarget(null);
    setSleepGapQueue([]);
    setSleepFilledGapStarts([]);
    try {
      if (window.deskflowAPI?.dismissSleepDetection) {
        await window.deskflowAPI.dismissSleepDetection();
      }
    } catch { /* ignore */ }
  };

  function adjustAfkForSleep(queue: AfkPromptEntry[], sleepStartMs: number, sleepEndMs: number): AfkPromptEntry[] {
    if (queue.length === 0) return queue;
    const entry = queue[0];
    if (!entry.idleStartMs) return queue;
    const totalMs = entry.returnMs - entry.idleStartMs;
    const overlapStart = Math.max(entry.idleStartMs, sleepStartMs);
    const overlapEnd = Math.min(entry.returnMs, sleepEndMs);
    const overlapMs = Math.max(0, overlapEnd - overlapStart);
    const remainingMs = Math.max(0, totalMs - overlapMs);
    if (remainingMs < 60000) return queue.slice(1);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    const newDuration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    return [{ ...entry, duration: newDuration }, ...queue.slice(1)];
  }

  const confirmSleepDetection = async () => {
    if (!sleepDetectionData) return;
    try {
      const sleepDay = new Date(sleepDetectDate + 'T00:00:00');

      const deviceOff = new Date(sleepDay);
      deviceOff.setHours(sleepDetectCustomBedtime.hours, sleepDetectCustomBedtime.minutes, 0, 0);
      if (sleepDetectCustomBedtime.hours < 12) deviceOff.setDate(deviceOff.getDate() + 1);

      const fellAsleep = new Date(sleepDay);
      fellAsleep.setHours(sleepDetectFellAsleepAt.hours, sleepDetectFellAsleepAt.minutes, 0, 0);
      if (sleepDetectFellAsleepAt.hours < 12) fellAsleep.setDate(fellAsleep.getDate() + 1);

      const wokeUp = new Date(sleepDay);
      wokeUp.setHours(sleepDetectWakeUpAt.hours, sleepDetectWakeUpAt.minutes, 0, 0);
      if (sleepDetectWakeUpAt.hours < 12) wokeUp.setDate(wokeUp.getDate() + 1);

      const deviceOn = new Date(sleepDay);
      deviceOn.setHours(sleepDetectCustomWaketime.hours, sleepDetectCustomWaketime.minutes, 0, 0);
      if (sleepDetectCustomWaketime.hours < 12) deviceOn.setDate(deviceOn.getDate() + 1);

      // Handle midnight crossing: wake time must be after device off
      if (wokeUp <= deviceOff) {
        wokeUp.setDate(wokeUp.getDate() + 1);
        deviceOn.setDate(deviceOn.getDate() + 1);
      }
      if (deviceOn <= wokeUp) deviceOn.setDate(deviceOn.getDate() + 1);

      const deviceOffToSleepSec = Math.max(0, Math.round((fellAsleep.getTime() - deviceOff.getTime()) / 1000));
      const wakeUpToAppSec = Math.max(0, Math.round((deviceOn.getTime() - wokeUp.getTime()) / 1000));

      const sleepStartMs = deviceOff.getTime();
      const sleepEndMs = wokeUp.getTime();
      sleepPeriodRef.current = { startMs: sleepStartMs, endMs: sleepEndMs };

      // Adjust existing AFK queue � subtract sleep overlap instead of clearing
      setAfkPromptQueue(prev => adjustAfkForSleep(prev, sleepStartMs, sleepEndMs));

      if (window.deskflowAPI?.confirmSleep) {
        const result = await window.deskflowAPI.confirmSleep({
          started_at: deviceOff.toISOString(),
          ended_at: wokeUp.toISOString(),
          device_off_to_sleep_seconds: deviceOffToSleepSec,
          wake_up_to_app_seconds: wakeUpToAppSec,
        });
        if (result?.success) {
          window.dispatchEvent(new CustomEvent('sleep-confirmed'));
          window.dispatchEvent(new CustomEvent('external-data-changed'));
          // Recompute adjacent gaps using USER-ADJUSTED times.
          // Do NOT fall back to sleepDetectionData.adjacentGaps — those were computed
          // from the initial auto-detected times, not the user's manual 4-value selection.
          // The user confirmed Device Off / Fell Asleep / Woke Up / Device On; the result
          // from computeAdjacentGaps is the authoritative gap list for those times.
          let gaps: any[] = [];
          try {
            const gapResult = await (window as any).deskflowAPI?.computeAdjacentGaps?.({
              sleepStartIso: deviceOff.toISOString(),
              sleepEndIso: wokeUp.toISOString(),
            });
            gaps = gapResult?.gaps || [];
            console.log(`[App] Recomputed adjacent gaps: ${gaps.length} gap(s)`);
          } catch { /* leave gaps empty — no backend = no gaps to offer */ }
          sleepActiveRef.current = false;
          if (gaps.length > 0) {
            // Load activities/sessions, then transition to gaps step INSIDE the popup
            try {
              const [acts, sess] = await Promise.all([
                window.deskflowAPI?.getExternalActivities?.(),
                window.deskflowAPI?.getExternalSessions?.('all'),
              ]);
              setSleepFillActivities(acts || []);
              setSleepFillSessions(sess || []);
            } catch { /* non-fatal */ }
            setSleepDetectionData(prev => prev ? { ...prev, adjacentGaps: gaps } : prev);
            setSleepModalStep('gaps');
          } else {
            dismissSleepDetection();
          }
          return;
        }
      }
    } catch (err) {
      console.error('[App] Failed to confirm sleep:', err);
    }
    sleepActiveRef.current = false;
    dismissSleepDetection();
  };

  useEffect(() => {
    const loadOverrides = async () => {
      const overrides: Record<string, string> = {};
      
      // First load from localStorage
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('deskflow-app-category-overrides');
          if (saved) Object.assign(overrides, JSON.parse(saved));
        } catch { /* ignore */ }
      }
      
      // Also load from categoryConfig for persistence across restarts
      if (window.deskflowAPI?.getCategoryConfig) {
        try {
          const config = await window.deskflowAPI.getCategoryConfig();
          if (config?.appCategoryMap) {
            Object.assign(overrides, config.appCategoryMap);
          }
          // Load domain keyword rules
          if (config?.domainKeywordRules) {
            setDomainKeywordRules(config.domainKeywordRules);
          }
        } catch { /* ignore */ }
      }
      
      setCategoryOverrides(overrides);
    };
    loadOverrides();
  }, []);

  // Reload category overrides when settings page saves
  useEffect(() => {
    const reloadOverrides = () => {
      try {
        const saved = localStorage.getItem('deskflow-app-category-overrides');
        if (saved) {
          const newOverrides = JSON.parse(saved);
          setCategoryOverrides((prev: Record<string, string>) => {
            const prevStr = JSON.stringify(prev);
            const newStr = JSON.stringify(newOverrides);
            if (prevStr !== newStr) {
              console.log('[DeskFlow] Reloaded category overrides:', newOverrides);
              return newOverrides;
            }
            return prev;
          });
        }
      } catch { /* ignore */ }
    };

    // Listen for storage changes (when settings saves to localStorage)
    const handleStorage = () => reloadOverrides();
    window.addEventListener('storage', handleStorage);

    // Also poll periodically since storage event only fires across tabs
    const interval = setInterval(reloadOverrides, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const [showSettings, setShowSettings] = useState(false);

  // Compute app stats - filtered by selectedPeriod (for display pages)
  const [computedAppStats, setComputedAppStats] = useState({
    totalTimeMs: 0,
    productiveTimeMs: 0,
    productivePercent: 0,
    categories: {} as Record<string, number>,
    appBreakdown: [] as Array<{ app: string; category: string; durationMs: number; percentage: number }>
  });

  // External weekly stats for DashboardPage Weekly Overview
  const [externalWeeklyStats, setExternalWeeklyStats] = useState<{
    byDay: Record<string, number>;
    total_seconds: number;
  } | null>(null);

  // Fetch external stats for ALL time - weekly overview will filter by weekOffset
  useEffect(() => {
    if (window.deskflowAPI?.getExternalStats) {
      window.deskflowAPI.getExternalStats('all').then((stats: any) => {
        console.log('[App] Got external stats (all):', stats);
        console.log('[App] byDay keys:', Object.keys(stats?.byDay || {}));
        console.log('[App] byDay sample:', JSON.stringify(stats?.byDay));
        setExternalWeeklyStats({
          byDay: stats?.byDay || {},
          total_seconds: stats?.total_seconds || 0
        });
      }).catch(err => console.error('[App] Failed to get external stats:', err));
    }
  }, []); // Load once on mount - weekly overview filters by weekOffset

  // Compute period-filtered app stats (for StatsPage)
  const appStats = useMemo(() => {
    if (filteredLogs.length === 0 && allLogs.length > 0) return [];

    const getCategory = (app: string, defaultCategory: string) => {
      const override = categoryOverrides[app.toLowerCase()];
      return override || defaultCategory;
    };

    const grouped: Record<string, { total_ms: number; sessions: number; first_seen: number; last_seen: number; category: string }> = {};
    for (const log of filteredLogs) {
      if (log.is_browser_tracking) continue;
      const app = log.app;
      const category = getCategory(app, log.category || 'Other');
      const t = log.timestamp.getTime();
      if (!grouped[app]) {
        grouped[app] = { total_ms: 0, sessions: 0, first_seen: t, last_seen: t, category };
      }
      grouped[app].total_ms += log.duration * 1000;
      grouped[app].sessions += 1;
      if (t < grouped[app].first_seen) grouped[app].first_seen = t;
      if (t > grouped[app].last_seen) grouped[app].last_seen = t;
    }

    const stats = Object.entries(grouped).map(([app, data]) => ({
      app,
      total_ms: data.total_ms,
      sessions: data.sessions,
      first_seen: new Date(data.first_seen).toISOString(),
      last_seen: new Date(data.last_seen).toISOString(),
      category: data.category,
      avg_session_ms: data.sessions > 0 ? data.total_ms / data.sessions : 0
    }));

    return stats.sort((a, b) => b.total_ms - a.total_ms);
  }, [filteredLogs, categoryOverrides]);

  // Compute ALL TIME app stats - no filtering by period (for Settings page)
  const allTimeAppStats = useMemo(() => {
    const getCategory = (app: string, defaultCategory: string) => {
      const override = categoryOverrides[app.toLowerCase()];
      return override || defaultCategory;
    };

    const grouped: Record<string, { total_ms: number; sessions: number; first_seen: number; last_seen: number; category: string }> = {};
    for (const log of allLogs) {
      if (log.is_browser_tracking) continue;
      const app = log.app;
      const category = getCategory(app, log.category || 'Other');
      const t = log.timestamp.getTime();
      if (!grouped[app]) {
        grouped[app] = { total_ms: 0, sessions: 0, first_seen: t, last_seen: t, category };
      }
      grouped[app].total_ms += log.duration * 1000;
      grouped[app].sessions += 1;
      if (t < grouped[app].first_seen) grouped[app].first_seen = t;
      if (t > grouped[app].last_seen) grouped[app].last_seen = t;
    }

    const stats = Object.entries(grouped).map(([app, data]) => ({
      app,
      total_ms: data.total_ms,
      sessions: data.sessions,
      first_seen: new Date(data.first_seen).toISOString(),
      last_seen: new Date(data.last_seen).toISOString(),
      category: data.category,
      avg_session_ms: data.sessions > 0 ? data.total_ms / data.sessions : 0
    }));

    return stats.sort((a, b) => b.total_ms - a.total_ms);
  }, [allLogs, categoryOverrides]);

  // Compute ALL TIME website stats from allWebsiteStats (loaded once, no time filter)
  const allTimeWebsiteStats = useMemo(() => {
    // Group by domain - allWebsiteStats already has aggregated data
    const grouped: Record<string, { total_ms: number; sessions: number; category: string; title?: string }> = {};
    for (const stat of allWebsiteStats) {
      const domain = stat.domain;
      const category = categoryOverrides[domain?.toLowerCase()] || stat.category || 'Other';
      if (!grouped[domain]) {
        grouped[domain] = { 
          total_ms: stat.total_ms || 0, 
          sessions: stat.sessions || 0, 
          category,
          title: stat.title 
        };
      }
    }

    // Convert to array
    const stats = Object.entries(grouped).map(([domain, data]) => ({
      app: domain,
      domain,
      ...data,
      avg_session_ms: data.sessions > 0 ? data.total_ms / data.sessions : 0
    }));

    return stats.sort((a, b) => b.total_ms - a.total_ms);
  }, [allWebsiteStats, categoryOverrides]);

  // NO separate logs loading - we filter allLogs locally for display
  // allLogs is set once on mount and never changes (preserves heatmap)

  // Load browser logs (website data) when period OR dateOffset changes
  useEffect(() => {
    if (window.deskflowAPI?.getBrowserLogs) {
      window.deskflowAPI.getBrowserLogs(selectedPeriod, dateOffset).then(electronLogs => {
        const formattedLogs: ActivityLog[] = electronLogs.map((log: any) => ({
          id: log.id,
          timestamp: new Date(log.timestamp),
          app: log.app,
          category: log.category || 'Uncategorized',
          duration: Math.round(log.duration_ms / 1000),
          title: log.title,
          project: log.project,
          is_browser_tracking: true,
          domain: log.domain,
          url: log.url,
        }));
        setBrowserLogs(formattedLogs);
        console.log('[DeskFlow] Loaded browser logs for period:', selectedPeriod, 'dateOffset:', dateOffset, 'count:', formattedLogs.length);
      }).catch(err => console.warn('[DeskFlow] Failed to load browser logs:', err));
    }
  }, [selectedPeriod, dateOffset]);

  // Load ALL website stats (no time filter) for Settings page
  useEffect(() => {
    if (window.deskflowAPI?.getAllBrowserDomainStats) {
      window.deskflowAPI.getAllBrowserDomainStats().then(stats => {
        setAllWebsiteStats(stats);
        console.log('[DeskFlow] Loaded all website stats:', stats.length, 'sites');
      }).catch(err => console.warn('[DeskFlow] Failed to load all website stats:', err));
    }
  }, []);

  // Load tier assignments on mount
  const [tierAssignments, setTierAssignments] = useState<{ productive: string[]; neutral: string[]; distracting: string[] } | null>(null);

  const loadTierAssignments = useCallback(async () => {
    if (!window.deskflowAPI?.getTierAssignments) return;
    try {
      const assignments = await window.deskflowAPI.getTierAssignments();
      setTierAssignments(prev => {
        const prevStr = JSON.stringify(prev);
        const newStr = JSON.stringify(assignments);
        if (prevStr !== newStr) {
          console.log('[DeskFlow] Refreshed tier assignments:', assignments);
          return assignments;
        }
        return prev;
      });
    } catch (err) {
      console.warn('[DeskFlow] Failed to load tier assignments:', err);
    }
  }, []);

  useEffect(() => {
    loadTierAssignments();
  }, [loadTierAssignments]);

  // Poll for tier assignment changes (settings page writes to main process + localStorage)
  useEffect(() => {
    const reloadTiers = () => {
      try {
        const saved = localStorage.getItem('deskflow-tier-assignments');
        if (saved) {
          const parsed = JSON.parse(saved);
          setTierAssignments((prev: typeof parsed) => {
            const prevStr = JSON.stringify(prev);
            if (prevStr !== saved) {
              console.log('[DeskFlow] Reloaded tier assignments from localStorage');
              return parsed;
            }
            return prev;
          });
        }
      } catch { /* ignore */ }
    };

    const handleStorage = () => reloadTiers();
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(reloadTiers, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const [showSummary, setShowSummary] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [pairPhoneModal, setPairPhoneModal] = useState<{ terminalId: string; label: string } | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmExport, setShowConfirmExport] = useState<'csv' | 'json' | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [devTriggerOpen, setDevTriggerOpen] = useState(false);
  const DEV_TRIGGER_ENABLED = true;

  // ── Dev Inject State ────────────────────────────────────────────────
  const [devSleepInject, setDevSleepInject] = useState({
    bedtime: { hours: 22, minutes: 0 },
    waketime: { hours: 7, minutes: 0 },
    fellAsleepAt: { hours: 22, minutes: 15 },
    wakeUpAt: { hours: 6, minutes: 55 },
    date: '',
  });
  const [devSleepDetectionResult, setDevSleepDetectionResult] = useState<{
    gapMinutes: number; suggestedBedtime: string; suggestedWakeTime: string; adjacentGaps?: AdjacentSleepGap[];
  } | null>(null);
  const [devPreviewGaps, setDevPreviewGaps] = useState<AdjacentSleepGap[]>([]);
  const [devDetectedGaps, setDevDetectedGaps] = useState<any[]>([]);
  const [devAfkInject, setDevAfkInject] = useState({ idleMinutes: 10, defaultNotAfk: true });
  const [devGapsInject, setDevGapsInject] = useState({ period: 'today' as const, minGapMinutes: 5 });
  const [devAfkQueueView, setDevAfkQueueView] = useState<any[]>([]);
  const [settingsHasChanges, setSettingsHasChanges] = useState(false);
  const settingsSaveFnRef = useRef<(() => void) | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; value: number } | null>(null);
  const [vizMode, setVizMode] = useState<'heatmap' | 'solar'>('heatmap');
  const [weekOffset, setWeekOffset] = useState(0);
  const [lastActivity, setLastActivity] = useState<number>(() => Date.now());
  const [isIdle, setIsIdle] = useState(false);
  const [idleThreshold, setIdleThreshold] = useState(5); // minutes
  const [autoDetect, setAutoDetect] = useState(true);
  interface AfkPromptEntry {
    id: number;
    duration: string;
    idleStartMs: number | null;
    returnMs: number;
    defaultNotAfk: boolean;
  }
  const [afkPromptQueue, setAfkPromptQueue] = useState<AfkPromptEntry[]>([]);
  const [afkGapsData, setAfkGapsData] = useState<{ gaps: any[]; activities: any[]; sessions: any[] } | null>(null);
  const [afkGapFillTarget, setAfkGapFillTarget] = useState<any>(null);
  const [afkGapQueue, setAfkGapQueue] = useState<any[]>([]);
  const [afkFilledGapStarts, setAfkFilledGapStarts] = useState<string[]>([]);
  const [smartFillGaps, setSmartFillGaps] = useState<Array<{ id: string; start: Date; end: Date; duration_seconds: number }> | null>(null);
  const [smartFillActivities, setSmartFillActivities] = useState<any[]>([]);
  const [smartFillSessions, setSmartFillSessions] = useState<any[]>([]);
  const [smartFillSource, setSmartFillSource] = useState<'afk' | 'sleep' | 'external' | null>(null);
  const [showManualAssign, setShowManualAssign] = useState(false);
  const afkQueueIdRef = useRef(0);
  const afkPromptShownRef = useRef(false);
  const pendingIdleRangeRef = useRef<{ idleStart: number; idleEnd: number | null } | null>(null);
  const sleepDetectionPendingRef = useRef(false);
  const sleepActiveRef = useRef(false);
  const sleepPeriodRef = useRef<{ startMs: number; endMs: number } | null>(null);

  const [autoExport, setAutoExport] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [externalActivities, setExternalActivities] = useState<any[]>([]);
  const [externalActivityTiers, setExternalActivityTiers] = useState<Record<number, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-external-activity-tiers');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return {};
  });
  const [timerBehavior, setTimerBehavior] = useState<{ neutralAction: 'pause' | 'reset' | 'ignore'; distractingAction: 'pause' | 'reset' | 'ignore' }>({ neutralAction: 'ignore', distractingAction: 'reset' });
  const [trackerAppMode, setTrackerAppMode] = useState<'show-other' | 'pause' | 'track'>('track');
  const [timerState, setTimerState] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-timer-state');
      if (saved) return JSON.parse(saved);
    }
    return { productiveMs: 0, startTime: 0, paused: false, lastTier: null, externalRunning: false, externalStart: null, externalElapsed: 0, selectedExternalActivity: null };
  });

// Sync timerState when localStorage changes from other sources (e.g., ExternalPage)
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('deskflow-timer-state');
      if (saved) {
        setTimerState(JSON.parse(saved));
      }
    };
    // Listen for storage changes (cross-tab)
    window.addEventListener('storage', handleStorageChange);
    // Listen for custom timer-sync event (same-tab, from ExternalPage)
    const handleTimerSync = () => {
      const saved = localStorage.getItem('deskflow-timer-state');
      if (saved) {
        setTimerState(JSON.parse(saved));
      }
    };
    window.addEventListener('timer-sync', handleTimerSync);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('timer-sync', handleTimerSync);
    };
  }, []);
  
  // Activity feed - persisted at App level to survive tab switches
  const [activityFeed, setActivityFeed] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-activity-feed');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    }
    return [];
  });
  
  const handleActivityFeedChange = useCallback((newItems: any[]) => {
    setActivityFeed(newItems);
    localStorage.setItem('deskflow-activity-feed', JSON.stringify(newItems));
  }, []);
  
  const handleAfkConfirm = useCallback(async (segments: { activityId: string; startedAt: string; endedAt: string }[]) => {
    console.log('[DeskFlow] handleAfkConfirm called with', segments.length, 'segments');
    if (segments.length > 0 && window.deskflowAPI?.createExternalSessionsBatch) {
      try {
        await window.deskflowAPI.createExternalSessionsBatch(segments);
      } catch (err) { console.error('[DeskFlow] createExternalSessionsBatch error:', err); }
    }
    pendingIdleRangeRef.current = null;
    window.dispatchEvent(new CustomEvent('external-data-changed'));
    // Compute adjacent gaps around the AFK period — keep popup open, pass gaps to it
    const entry = afkPromptQueue[0];
    if (entry?.idleStartMs && entry?.returnMs) {
      try {
        const gapResult = await (window as any).deskflowAPI?.computeAdjacentGaps?.({
          sleepStartIso: new Date(entry.idleStartMs).toISOString(),
          sleepEndIso: new Date(entry.returnMs).toISOString(),
        });
        const gaps = gapResult?.gaps || [];
        if (gaps.length > 0) {
          let acts: any[] = externalActivities;
          let sess: any[] = [];
          try {
            const [a, s] = await Promise.all([
              window.deskflowAPI?.getExternalActivities?.(),
              window.deskflowAPI?.getExternalSessions?.('all'),
            ]);
            acts = a || externalActivities;
            sess = s || [];
          } catch {}
          setAfkGapsData({ gaps, activities: acts, sessions: sess });
        }
      } catch {}
    }
    // DO NOT remove from queue — popup stays open
  }, [afkPromptQueue, externalActivities]);
  
  const handleAfkDismiss = useCallback(() => {
    console.log('[DeskFlow] handleAfkDismiss called');
    pendingIdleRangeRef.current = null;
    setAfkPromptQueue(prev => prev.slice(1));
    window.dispatchEvent(new CustomEvent('external-data-changed'));
  }, []);

  // Persist AFK queue to disk so it survives app restart
  useEffect(() => {
    if (window.deskflowAPI?.saveAfkQueue) {
      window.deskflowAPI.saveAfkQueue(afkPromptQueue).catch(() => {});
    }
  }, [afkPromptQueue]);

  // Listen for gap-drawer open event — now opens the new GapFillModal
  useEffect(() => {
    const handler = async () => {
      try {
        const api = (window as any).deskflowAPI;
        const [gaps, apps, ext] = await Promise.all([
          api?.detectUsageGaps?.({ period: 'week', minGapMinutes: 5 }) || [],
          api?.getKnownApps?.() || [],
          api?.getExternalActivities?.() || [],
        ]);
        const activities = [
          ...((apps || []).map((a: any) => ({ id: 'app:' + a.app, name: a.app, category: a.category || 'Other', color: '#6366f1', type: 'app' as const }))),
          ...((ext || []).filter((a: any) => a.name !== 'AFK' && a.type !== 'sleep').map((a: any) => ({ id: 'ext:' + a.id, name: a.name, category: 'External', color: a.color || '#6b7280', type: 'external' as const }))),
        ];
        const fillGaps = (Array.isArray(gaps) ? gaps : []).map((g: any, i: number) => ({
          id: `gap-${i}`,
          start: new Date(g.start),
          end: new Date(g.end),
          duration_seconds: g.durationSeconds,
        }));
        setSmartFillGaps(fillGaps.length > 0 ? fillGaps : null);
        setSmartFillActivities(activities);
      } catch (err) {
        console.error('[App] Failed to detect gaps for smart fill:', err);
      }
    };
    window.addEventListener('open-gap-panel', handler);
    window.addEventListener('open-gap-drawer', handler);
    return () => {
      window.removeEventListener('open-gap-panel', handler);
      window.removeEventListener('open-gap-drawer', handler);
    };
  }, []);

  // Global listener for pair-phone modal (open from any page)
  useEffect(() => {
    const handler = (e: CustomEvent<{ terminalId: string; label: string }>) => {
      setPairPhoneModal(e.detail);
    };
    window.addEventListener('open-pair-modal', handler as EventListener);
    return () => window.removeEventListener('open-pair-modal', handler as EventListener);
  }, []);
  
  const [foregroundApps, setForegroundApps] = useState<string[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-category-order');
      if (saved) return JSON.parse(saved);
    }
    return ['IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication', 'Design', 'Productivity', 'Tools', 'Other'];
  }); // Simulated open apps (background)

  // Database page state
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [dbSelectedTable, setDbSelectedTable] = useState<string>('');
  const [dbTableData, setDbTableData] = useState<any[]>([]);
  const [dbSchema, setDbSchema] = useState<any[]>([]);

  // Load database tables
  const loadDbTables = async () => {
    if (window.deskflowAPI?.getDatabaseTables) {
      const result = await window.deskflowAPI.getDatabaseTables();
      if (result.tables && result.tables.length > 0) {
        setDbTables(result.tables);
        if (!dbSelectedTable) {
          setDbSelectedTable(result.tables[0]);
        }
      }
    }
  };

  // Load table data when selected table changes
  useEffect(() => {
    if (dbSelectedTable && window.deskflowAPI?.getTableData) {
      window.deskflowAPI.getTableData(dbSelectedTable, 50).then(data => {
        if (Array.isArray(data)) {
          setDbTableData(data);
        }
      });
      window.deskflowAPI.getTableSchema(dbSelectedTable).then(schema => {
        if (Array.isArray(schema)) {
          setDbSchema(schema);
        }
      });
    }
  }, [dbSelectedTable]);

  // Load db tables on mount
  useEffect(() => {
    loadDbTables();
  }, []);

  // Generate heatmap from ALL logs data + current active session
  // Supports week navigation via weekOffset (0 = current week, -1 = previous week, etc.)
  const heatmap = useMemo(() => {
    const now = new Date();
    
    // Calculate the start of the target week based on weekOffset (midnight Sunday)
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    const targetWeekStart = new Date(currentWeekStart.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000));
    const targetWeekEnd = new Date(targetWeekStart.getTime() + (7 * 24 * 60 * 60 * 1000));

    // Initialize heatmap cells for the target week
    const cellMap = new Map<string, number>();
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const date = new Date(targetWeekStart);
      date.setDate(date.getDate() + dayOffset);
      const day = date.getDay();
      for (let hour = 0; hour < 24; hour++) {
        cellMap.set(`${day}-${hour}`, 0);
      }
    }

    // Helper to add a session's duration to the heatmap cells
    const addSession = (startMs: number, durationSec: number) => {
      const endMs = startMs + durationSec * 1000;
      if (startMs >= targetWeekEnd || endMs < targetWeekStart) return;
      let currentMs = startMs;
      while (currentMs < endMs) {
        const currentDate = new Date(currentMs);
        const currentDay = currentDate.getDay();
        const currentHour = currentDate.getHours();
        const hourStart = currentDate.getTime();
        const hourEnd = hourStart + 3600000;
        if (currentDate >= targetWeekStart && currentDate < targetWeekEnd) {
          const segmentStart = Math.max(currentMs, hourStart);
          const segmentEnd = Math.min(endMs, hourEnd);
          const segmentSeconds = Math.max(0, (segmentEnd - segmentStart) / 1000);
          if (segmentSeconds > 0) {
            const key = `${currentDay}-${currentHour}`;
            const currentValue = cellMap.get(key) || 0;
            cellMap.set(key, Math.min(currentValue + segmentSeconds, 3600));
          }
        }
        currentMs = hourEnd;
      }
    };

    // Add completed sessions from logs
    for (const log of allLogs) {
      const sessionStartMs = new Date(log.timestamp).getTime();
      addSession(sessionStartMs, log.duration);
    }

    // Add the CURRENT active session (not yet logged to database)
    if (isTracking && currentApp && elapsedTime > 0 && weekOffset === 0) {
      const activeStartMs = sessionStart.getTime();
      addSession(activeStartMs, elapsedTime);
    }

    // Convert map back to array
    const heatmapData: HeatmapCell[] = [];
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const date = new Date(targetWeekStart);
      date.setDate(date.getDate() + dayOffset);
      const day = date.getDay();
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({ day, hour, value: cellMap.get(`${day}-${hour}`) || 0 });
      }
    }

    return heatmapData;
  }, [allLogs, weekOffset, isTracking, currentApp, elapsedTime, sessionStart]);
  
  // Get the date range label for the current heatmap week
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

  // Compute background apps from logs (apps used but not currently active)
  const backgroundApps = useMemo(() => {
    const appSet = new Set<string>();
    logs.forEach(log => {
      if (log.app !== currentApp) {
        appSet.add(log.app);
      }
    });
    return Array.from(appSet).slice(0, 5); // Show up to 5 background apps
  }, [logs, currentApp]);

  // Auto-Detect Polling (simulates active-win 1-2s polling)
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>;
    if (autoDetect && isTracking) {
      pollInterval = setInterval(() => {
        // Simulate foreground window change (like active-win polling)
        const randomApp = SIMULATED_APPS[Math.floor(Math.random() * SIMULATED_APPS.length)];

        if (randomApp !== currentApp) {
          // Log previous session
          if (elapsedTime > 10) { // Only log if meaningful time
            const catInfo = APP_CATEGORIES[currentApp as keyof typeof APP_CATEGORIES] || { cat: 'Other', color: '#888888' };
            const cat = catInfo.cat || 'Other';
            const newLog: ActivityLog = {
              id: Date.now(),
              timestamp: sessionStart,
              app: currentApp,
              category: cat,
              duration: Math.floor(elapsedTime), // seconds (elapsedTime is already in seconds)
              title: `${currentApp} - Auto-detected window`,
              project: cat === 'IDE' ? ['DeskFlow', 'EcomAPI', 'Analytics'][Math.floor(Math.random() * 3)] : undefined
            };
            setLogs(prev => [newLog, ...prev].slice(0, 25));
          }
          // Switch to new foreground
          setCurrentApp(randomApp);
          setElapsedTime(0);
          setSessionStart(new Date());
          setLastActivity(Date.now());
          setIsIdle(false);
        }
      }, 2500); // 2.5s polling interval (realistic active-win)
    }
    return () => clearInterval(pollInterval);
  }, [autoDetect, isTracking, currentApp, elapsedTime, sessionStart]);

  // Track mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Use refs to track latest state values for the activity handler
  const idleRef = useRef(isIdle);
  const trackingRef = useRef(isTracking);
  const systemIdleSecondsRef = useRef(0); // OS-level idle seconds (from main process)
  const currentCategoryRef = useRef<string | null>(null); // Tracked app category for passive-active check
  const idleStartRef = useRef<number | null>(null); // When idle began (for AFK duration)
  const idleReturnFnRef = useRef<() => void>(() => {}); // Updated below to avoid stale closures
  
  // Update refs when state changes
  useEffect(() => {
    idleRef.current = isIdle;
    trackingRef.current = isTracking;
  }, [isIdle, isTracking]);

  useEffect(() => {
    sleepDetectionPendingRef.current = showSleepDetection;
  }, [showSleepDetection]);
  
  // Ref to latest externalActivities for the idle return handler
  const externalActivitiesRef = useRef(externalActivities);
  externalActivitiesRef.current = externalActivities;

  // Ref to latest timerState so idle detector can check externalRunning
  const timerStateRef = useRef(timerState);
  timerStateRef.current = timerState;
  
  // Keep idleReturnFnRef.current updated with the actual handler
  useEffect(() => {
    idleReturnFnRef.current = async () => {
      if (afkPromptShownRef.current) return;
      // Skip AFK prompt if user already has an external activity running � they're not AFK
      if (timerStateRef.current?.externalRunning) {
        pendingIdleRangeRef.current = null;
        return;
      }
      afkPromptShownRef.current = true;

      const range = pendingIdleRangeRef.current;
      const idleStartMs = range?.idleStart ?? idleStartRef.current;
      const nowMs = Date.now();
      if (range) range.idleEnd = nowMs;
      let elapsedSec = idleStartMs ? Math.floor((nowMs - idleStartMs) / 1000) : 0;

      // Subtract any confirmed sleep period from AFK duration
      if (sleepPeriodRef.current && idleStartMs) {
        const overlapStart = Math.max(idleStartMs, sleepPeriodRef.current.startMs);
        const overlapEnd = Math.min(nowMs, sleepPeriodRef.current.endMs);
        const sleepOverlap = Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
        elapsedSec = Math.max(0, elapsedSec - sleepOverlap);
      }

      // Req 4: tiny idle ? silent discard, no prompt
      if (elapsedSec < 60) { pendingIdleRangeRef.current = null; return; }

      const duration = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
      const entry: AfkPromptEntry = {
        id: afkQueueIdRef.current++,
        duration,
        idleStartMs,
        returnMs: nowMs,
        // Req 4: moderate idle (1�15m) defaults to "I wasn't AFK"
        defaultNotAfk: elapsedSec <= 15 * 60,
      };
      setAfkPromptQueue(prev => [...prev, entry]);
    };
  }, []);
  
  // Set up activity listeners - stable across renders, cleaned up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Track actual user activity (mouse/keyboard) - ALWAYS active to detect return from idle
    const handleActivity = () => {
      if (!isMountedRef.current) return;
      setLastActivity(Date.now());
      if (idleRef.current) {
        // Immediately resume tracking when user returns from idle
        console.log('[DeskFlow] Activity detected - resuming tracking');
        setIsIdle(false);
        setIsTracking(true);
        setSessionStart(new Date());
        // Cooldown: skip idle checks for 12s to let heartbeat update with low idle time
        idleCooldownRef.current = Date.now() + 12000;
        // Resume main process tracking
        if (window.deskflowAPI?.setTracking) {
          window.deskflowAPI.setTracking(true).catch(console.error);
        }
        // Show AFK prompt (guard prevents duplicates from focus/visibility events)
        idleReturnFnRef.current();
      }
    };

    // Always listen for activity (even when tracking is paused)
    // Use capture phase so xterm.js (or other libs) calling stopPropagation doesn't block it
    window.addEventListener('mousemove', handleActivity, { capture: true });
    window.addEventListener('mousedown', handleActivity, { capture: true });
    window.addEventListener('keydown', handleActivity, { capture: true });
    window.addEventListener('touchstart', handleActivity, { capture: true });
    window.addEventListener('scroll', handleActivity, { capture: true });
    window.addEventListener('wheel', handleActivity, { capture: true });

    // Also listen for window focus/visibility to catch user returning to app
    const handleFocus = () => {
      if (!isMountedRef.current) return;
      if (idleRef.current) {
        console.log('[DeskFlow] Window focused - resuming tracking');
        setIsIdle(false);
        setIsTracking(true);
        setSessionStart(new Date());
        idleCooldownRef.current = Date.now() + 12000;
        if (window.deskflowAPI?.setTracking) {
          window.deskflowAPI.setTracking(true).catch(console.error);
        }
        idleReturnFnRef.current();
      }
    };

    const handleVisibilityChange = () => {
      if (!isMountedRef.current) return;
      if (document.visibilityState === 'visible' && idleRef.current) {
        console.log('[DeskFlow] Window visible - resuming tracking');
        setIsIdle(false);
        setIsTracking(true);
        setSessionStart(new Date());
        idleCooldownRef.current = Date.now() + 12000;
        if (window.deskflowAPI?.setTracking) {
          window.deskflowAPI.setTracking(true).catch(console.error);
        }
        idleReturnFnRef.current();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Cleanup: remove all activity listeners on unmount
      window.removeEventListener('mousemove', handleActivity, { capture: true });
      window.removeEventListener('mousedown', handleActivity, { capture: true });
      window.removeEventListener('keydown', handleActivity, { capture: true });
      window.removeEventListener('touchstart', handleActivity, { capture: true });
      window.removeEventListener('scroll', handleActivity, { capture: true });
      window.removeEventListener('wheel', handleActivity, { capture: true });
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      isMountedRef.current = false;
    };
  }, []); // Empty deps - this runs once on mount and cleans up on unmount

  // Guard against re-triggering idle within N seconds of returning from idle
  // Prevents the stale heartbeat idle value from causing a second idle detection
  const idleCooldownRef = useRef(0);

  // Live tracking timer with OS-level idle detection
  // Uses powerMonitor.getSystemIdleTime() from main process (via heartbeat)
  // which detects actual user input idle (keyboard/mouse) regardless of window focus
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isTracking) {
      interval = setInterval(() => {
        if (!isMountedRef.current) return;
        
        const now = Date.now();

        // Skip idle check during cooldown (prevents re-idle from stale heartbeat after return)
        if (now < idleCooldownRef.current) return;

        // Idle check: Use OS-level system idle time (from main process heartbeat)
        // This correctly detects idle even when DeskFlow is in the background
        // Skip idle check for entertainment/gaming (YouTube, Netflix, games � user is watching, not AFK)
        const PASSIVE_ACTIVE = new Set(['Entertainment', 'Gaming']);
        const isPassiveActive = currentCategoryRef.current && PASSIVE_ACTIVE.has(currentCategoryRef.current);
        const idleMs = idleThreshold * 60 * 1000; // Convert minutes to ms
        if (!isPassiveActive && systemIdleSecondsRef.current * 1000 > idleMs) {
          if (!pendingIdleRangeRef.current) {
            pendingIdleRangeRef.current = { idleStart: Date.now() - idleMs, idleEnd: null };
            idleStartRef.current = pendingIdleRangeRef.current.idleStart;
            setIsIdle(true);
            afkPromptShownRef.current = false;
            // Pause main process tracking so pollForeground stops creating log entries
            // during AFK. This creates a real gap in the logs table that gap-detection
            // can find. When the user returns, setTracking(true) resumes and the gap
            // detection code in pollForeground naturally handles the gap.
            if (window.deskflowAPI?.setTracking) {
              window.deskflowAPI.setTracking(false).catch(console.error);
            }
          }
          setElapsedTime(prev => prev + 1);
          return;
        }

        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      clearInterval(interval);
    };
  }, [isTracking, elapsedTime, currentApp, sessionStart, idleThreshold]);

  // Switch app simulation
  const switchApp = (newApp: string) => {
    if (newApp === currentApp) return;

    // Log the previous session
    if (elapsedTime > 0) {
      const catInfo = APP_CATEGORIES[currentApp as keyof typeof APP_CATEGORIES] || { cat: 'Other', color: '#888888' };
      const cat = catInfo.cat || 'Other';
      const newLog: ActivityLog = {
        id: Date.now(),
        timestamp: sessionStart,
        app: currentApp,
        category: cat,
        duration: Math.floor(elapsedTime), // seconds
        title: currentApp === 'Chrome' ? 'github.com/deskflow' : undefined,
        project: cat === 'IDE' ? ['DeskFlow', 'EcomAPI', 'Analytics'][Math.floor(Math.random() * 3)] : undefined
      };
      setLogs(prev => [newLog, ...prev].slice(0, 20));
    }

    // Start new session
    setCurrentApp(newApp);
    setElapsedTime(0);
    setSessionStart(new Date());
    setLastActivity(Date.now());
    setIsIdle(false);
  };

  // Toggle tracking
  const toggleTracking = async () => {
    console.log('[App] toggleTracking called, current isTracking:', isTracking);
    if (window.deskflowAPI) {
      // Use Electron API
      const newState = await window.deskflowAPI.toggleTracking();
      console.log('[App] toggleTracking result from API:', newState);
      setIsTracking(newState);
    } else {
      // Fallback for web version
      if (isTracking && elapsedTime > 0) {
        // Log current session
        const catInfo = APP_CATEGORIES[currentApp as keyof typeof APP_CATEGORIES] || { cat: 'Other', color: '#888888' };
        const cat = catInfo.cat || 'Other';
        const newLog: ActivityLog = {
          id: Date.now(),
          timestamp: sessionStart,
          app: currentApp,
          category: cat,
          duration: Math.floor(elapsedTime), // seconds
          title: currentApp.includes('Chrome') ? 'Productivity Tools' : undefined
        };
        setLogs(prev => [newLog, ...prev].slice(0, 20));
      }
      const newTracking = !isTracking;
      setIsTracking(newTracking);
      setIsIdle(false);
      setLastActivity(Date.now());
      if (newTracking) {
        setElapsedTime(0);
        setSessionStart(new Date());
      } else {
        setElapsedTime(0);
      }
    }
  };

  // Clear only today's corrupted data
  const clearToday = async () => {
    if (window.deskflowAPI && window.deskflowAPI.clearToday) {
      const success = await window.deskflowAPI.clearToday();
      if (success) {
        // Reload logs
        const electronLogs = await window.deskflowAPI.getLogs();
        const formattedLogs: ActivityLog[] = electronLogs.map((log: any) => ({
          id: log.id,
          timestamp: new Date(log.timestamp),
          app: log.app,
          category: log.category || 'Other',
          duration: Math.floor(log.duration_ms / 1000),
          title: log.title,
          project: log.project,
          is_browser_tracking: log.is_browser_tracking === 1 || log.is_browser_tracking === true,
          domain: log.domain,
          url: log.url,
        }));
        setAllLogs(formattedLogs);
        setLogs(formattedLogs);
        console.log('[DeskFlow] Today\'s corrupted data cleared');
      }
    }
  };

  // Clean all corrupted data (entries with duration > 1 hour)
  const cleanCorruptedData = async () => {
    if (window.deskflowAPI && window.deskflowAPI.cleanCorruptedData) {
      const result = await window.deskflowAPI.cleanCorruptedData();
      if (result.success && result.deletedCount > 0) {
        // Reload logs
        const electronLogs = await window.deskflowAPI.getLogs();
        const formattedLogs: ActivityLog[] = electronLogs.map((log: any) => ({
          id: log.id,
          timestamp: new Date(log.timestamp),
          app: log.app,
          category: log.category || 'Other',
          duration: Math.floor(log.duration_ms / 1000),
          title: log.title,
          project: log.project,
          is_browser_tracking: log.is_browser_tracking === 1 || log.is_browser_tracking === true,
          domain: log.domain,
          url: log.url,
        }));
        setAllLogs(formattedLogs);
        setLogs(formattedLogs);
        console.log(`[DeskFlow] Cleaned ${result.deletedCount} corrupted entries`);
        alert(`Cleaned ${result.deletedCount} corrupted entries!`);
      } else {
        alert('No corrupted data found or cleanup failed.');
      }
    }
  };

  // Calculate totals - filters allLogs by period locally
  const getTotalTime = (period: Period) => {
    const now = new Date();

    // Filter allLogs by period
    let filtered = allLogs;
    if (period === 'today') {
      filtered = allLogs.filter(log =>
        log.timestamp.getDate() === now.getDate() &&
        log.timestamp.getMonth() === now.getMonth() &&
        log.timestamp.getFullYear() === now.getFullYear()
      );
    } else if (period === 'week' || period === '7day') {
      const range = getDateRange(period, 0);
      filtered = allLogs.filter(log => log.timestamp >= range.start && log.timestamp < range.end);
    } else if (period === 'month' || period === '30day') {
      const range = getDateRange(period, 0);
      filtered = allLogs.filter(log => log.timestamp >= range.start && log.timestamp < range.end);
    }
    // 'all' uses allLogs as-is

    // Apps only: website rows belong to the tracking browser (Comet) which is
    // already logged as an app row (is_browser_tracking=0), so adding website
    // time on top double-counts it.
    const totalSeconds = filtered.filter(l => !l.is_browser_tracking).reduce((sum, log) => sum + log.duration, 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMins = Math.floor((totalSeconds % 3600) / 60);
    const totalSecs = totalSeconds % 60;
    return { hours: totalHours, mins: totalMins, secs: totalSecs, total: totalSeconds };
  };

  const currentTotals = getTotalTime(selectedPeriod);

  // Phase 3: Focus Time vs Total Time
  // Focus = productive categories only, Total = all categories
  const [timeMode, setTimeMode] = useState<'focus' | 'total'>('total');
  const [focusMode, setFocusMode] = useState(false);

  // Total time by category (apps + all websites, used for score calculation)
   const timeByCategory = useMemo(() => {
     const categoryTime: Record<string, number> = {};
     
     // Desktop apps - include ALL apps, apply category overrides
     filteredLogs.forEach(log => {
       if (log.is_browser_tracking) return;
       const cat = categoryOverrides[log.app.toLowerCase()] || log.category || 'Uncategorized';
       categoryTime[cat] = (categoryTime[cat] || 0) + log.duration;
     });
     
     // Websites - map to app categories for productivity calculation
     browserLogs.forEach(log => {
       const domain = (log as any).domain || 'Unknown';
       const websiteCategory = (log as any).category || 'Uncategorized';
       const mappedCategory = WEBSITE_CATEGORY_MAP[websiteCategory] || 'Other';
       categoryTime[mappedCategory] = (categoryTime[mappedCategory] || 0) + log.duration;
     });
     
     return categoryTime;
   }, [filteredLogs, browserLogs, categoryOverrides]);

  // Compute productivity score - same algorithm as ProductivityPage
  const TIER_WEIGHTS = { productive: 1.0, neutral: 0.5, distracting: 0 };
  const productivityScore = useMemo(() => {
    let productiveSec = 0;
    let neutralSec = 0;
    let distractingSec = 0;

    Object.entries(timeByCategory).forEach(([category, duration]) => {
      if (tierAssignments?.productive.includes(category)) {
        productiveSec += duration;
      } else if (tierAssignments?.distracting.includes(category)) {
        distractingSec += duration;
      } else {
        neutralSec += duration;
      }
    });

    const total = productiveSec + neutralSec + distractingSec;
    if (total === 0) return 0;

    const weighted = (productiveSec * TIER_WEIGHTS.productive) + 
                    (neutralSec * TIER_WEIGHTS.neutral) + 
                    (distractingSec * TIER_WEIGHTS.distracting);
    return (weighted / total) * 100;
  }, [timeByCategory, tierAssignments]);

  // Compute focus time vs total time
  // Total = ALL tracked activity for the period (apps + websites) � same source as the
  //         activity chart, so the top-bar clock always matches the chart.
  // Focus = productive tier only (apps + websites mapped via WEBSITE_CATEGORY_MAP)
  const focusAndTotalTime = useMemo(() => {
    // Apps only: website rows belong to the tracking browser (Comet) which is
    // already logged as an app row (is_browser_tracking=0), so adding website
    // time on top double-counts it.
    const totalTime = filteredLogs.filter(l => !l.is_browser_tracking).reduce((sum, log) => sum + (log.duration || 0), 0);

    // Focus time = productive categories only (timeByCategory already merges apps +
    // websites mapped through WEBSITE_CATEGORY_MAP)
    let productiveTime = 0;
    Object.entries(timeByCategory).forEach(([category, duration]) => {
      if (tierAssignments?.productive.includes(category)) {
        productiveTime += duration;
      }
    });

    return { focus: productiveTime, total: totalTime };
  }, [filteredLogs, timeByCategory, tierAssignments]);
  
  // Compute breakdown for display (apps vs websites)
  // Excludes browser tracking (is_browser_tracking) from apps
  const timeBreakdown = useMemo(() => {
    const appsTime = filteredLogs.filter(l => !l.is_browser_tracking).reduce((sum, l) => sum + l.duration, 0);
    const websitesTime = filteredLogs.filter(l => l.is_browser_tracking).reduce((sum, l) => sum + l.duration, 0);
    return { apps: appsTime, websites: websitesTime };
  }, [filteredLogs]);

  // Display time based on mode
  const displayTime = timeMode === 'focus' ? Math.floor(focusAndTotalTime.focus) : Math.floor(focusAndTotalTime.total);

  const idleTime = 0;

  // Aggregate for charts (floor all durations to remove decimals)
  // Filter by Focus/Total mode - Focus = only productive categories
  // Excludes browser tracking (is_browser_tracking) to match Stats page behavior
  const getAppDistribution = () => {
    const grouped: Record<string, number> = {};
    // Use trackingBrowser state instead of prefs (which is not available in this scope)
    const selectedBrowser = trackingBrowser?.toLowerCase() || '';
    
    filteredLogs.forEach(log => {
      // Skip browser tracking data (website visits) - only count desktop apps
      if (log.is_browser_tracking) return;
      
      // Skip ONLY the selected tracking browser (e.g., Comet), not all browsers
      // This keeps Chrome/Firefox etc showing in app list
      const appLower = (log.app || '').toLowerCase();
      if (selectedBrowser && appLower.includes(selectedBrowser)) return;
      
      // Filter by mode: Focus only includes productive categories
      if (timeMode === 'focus') {
        const category = categoryOverrides[log.app.toLowerCase()] || log.category || 'Uncategorized';
        if (!tierAssignments?.productive.includes(category)) {
          return; // Skip non-productive categories in Focus mode
        }
      }
      grouped[log.app] = (grouped[log.app] || 0) + Math.floor(log.duration);
    });
    return Object.entries(grouped).map(([name, duration]) => ({ name, duration: Math.floor(duration) }));
  };

  const appData = getAppDistribution();
  const pieData = {
    labels: appData.map(d => d.name),
    datasets: [{
      data: appData.map(d => d.duration),
      backgroundColor: appData.map((d, i) => {
        // Generate unique color per app using golden angle for good distribution
        const hue = (i * 137.5) % 360;
        return `hsl(${hue}, 65%, 55%)`;
      }),
      borderColor: '#0a0a0a',
      borderWidth: 2,
    }]
  };

  const weeklyData = useMemo(() => {
    // Calculate actual weekly productivity from logs
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sunday
    
    // Get start of the week (Monday)
    const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    // Initialize data for Sun-Sat
    const weekData: Record<string, { productive: number; neutral: number; distracting: number }> = {};
    dayNames.forEach(day => { weekData[day] = { productive: 0, neutral: 0, distracting: 0 }; });
    
    // Process logs from this week
    filteredLogs.forEach(log => {
      const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
      // Only include logs from this week
      if (logDate >= weekStart && logDate <= today) {
        const dayName = dayNames[logDate.getDay()];
        const hours = log.duration / 3600; // convert seconds to hours
        const category = categoryOverrides[log.app.toLowerCase()] || log.category || 'Uncategorized';
        
        if (tierAssignments?.productive.includes(category)) {
          weekData[dayName].productive += hours;
        } else if (tierAssignments?.distracting.includes(category)) {
          weekData[dayName].distracting += hours;
        } else {
          weekData[dayName].neutral += hours;
        }
      }
    });
    
    return {
      labels: dayNames,
      datasets: [
        {
          label: 'Productive',
          data: dayNames.map(day => parseFloat(weekData[day].productive.toFixed(1))),
          backgroundColor: '#10b981', // green
        },
        {
          label: 'Neutral',
          data: dayNames.map(day => parseFloat(weekData[day].neutral.toFixed(1))),
          backgroundColor: '#f59e0b', // yellow/amber
        },
        {
          label: 'Distracting',
          data: dayNames.map(day => parseFloat(weekData[day].distracting.toFixed(1))),
          backgroundColor: '#ef4444', // red
        },
      ]
    };
  }, [filteredLogs, tierAssignments, categoryOverrides]);

  // Generate AI Summary
  const generateAISummary = () => {
    const totalMin = currentTotals.total;
    const codingTime = logs
      .filter(l => ['IDE', 'Productivity'].includes(l.category))
      .reduce((sum, l) => sum + l.duration, 0);
    const aiTime = logs
      .filter(l => l.category === 'AI Tools')
      .reduce((sum, l) => sum + l.duration, 0);
    const distTime = logs
      .filter(l => l.category === 'Entertainment')
      .reduce((sum, l) => sum + l.duration, 0);

    const codingPct = totalMin > 0 ? Math.round((codingTime / totalMin) * 100) : 65;
    const aiPct = totalMin > 0 ? Math.round((aiTime / totalMin) * 100) : 22;
    const distPct = totalMin > 0 ? Math.round((distTime / totalMin) * 100) : 13;

    const topProject = logs.find(l => l.project)?.project || 'DeskFlow';
    const peakHour = '10:30 AM - 12:15 PM';

    const summary = `Stats DeskFlow AI Analysis for ${format(new Date(), 'MMMM dd')}

Hot Focus Summary: ${Math.floor(totalMin / 60)}h ${totalMin % 60}m tracked today
   � Coding: ${codingPct}% (${codingTime}min) � Top Project: ${topProject}
   � AI Tools: ${aiPct}% (${aiTime}min) � Smart prompting on Claude & ChatGPT
   � Distractions: ${distPct}% � Minimal YouTube/Entertainment

? Peak Productivity Window: ${peakHour}
   You averaged 92% focus during this window.

Tip Insights:
   � 87% of IDE time spent on actual editing (vs. idle)
   � You completed 3 major tasks in PyCharm
   � Browser time was 68% productive (docs, GitHub)
   � Productivity Score: ${Math.floor(Math.random() * 15) + 83}/100

Trend: +14% vs. yesterday. Keep it up!`;

    setAiSummary(summary);
    setShowSummary(true);
  };

  // Export data
  const exportData = async (formatType: 'csv' | 'json') => {
    const exportLogs = logs.map(log => ({
      date: format(log.timestamp, 'yyyy-MM-dd HH:mm'),
      app: log.app,
      category: log.category,
      duration_min: log.duration,
      project: log.project || '',
      title: log.title || ''
    }));

    if (formatType === 'json') {
      const dataStr = JSON.stringify(exportLogs, null, 2);
      const filename = `deskflow-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
      if (window.deskflowAPI?.saveFile) {
        const result = await window.deskflowAPI.saveFile({ content: dataStr, filename, fileType: 'application/json' });
        if (result.success) {
          console.log('[DeskFlow] Exported to:', result.path);
        } else {
          console.error('[DeskFlow] Export failed:', result.message);
        }
      } else {
        // Fallback for web version
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      }
    } else {
      const headers = ['Date', 'App', 'Category', 'Duration (min)', 'Project', 'Title'];
      const csvContent = [
        headers.join(','),
        ...exportLogs.map(row =>
          [row.date, row.app, row.category, row.duration_min, row.project, row.title]
            .map(v => `"${v}"`).join(',')
        )
      ].join('\n');

      const filename = `deskflow-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      if (window.deskflowAPI?.saveFile) {
        const result = await window.deskflowAPI.saveFile({ content: csvContent, filename, fileType: 'text/csv' });
        if (result.success) {
          console.log('[DeskFlow] Exported to:', result.path);
        } else {
          console.error('[DeskFlow] Export failed:', result.message);
        }
      } else {
        // Fallback for web version
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      }
    }

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Clear data - now with confirmation
  const clearData = async () => {
    if (window.deskflowAPI) {
      await window.deskflowAPI.clearData();
      setAllLogs([]);
      setLogs([]);
    } else {
      setAllLogs([]);
      setLogs([]);
    }
    setElapsedTime(0);
    setShowConfirmClear(false);
    setShowSettings(false);
    // Refresh storage status
    if (window.deskflowAPI) {
      try {
        const status = await window.deskflowAPI.getStorageStatus();
        setStorageStatus(status);
      } catch { /* ignore */ }
    }
  };

  const currentCategory = APP_CATEGORIES[currentApp as keyof typeof APP_CATEGORIES] || { cat: 'Other', color: '#888888' };

  // Handle navigation with unsaved changes check
  const handleSettingsNavigate = useCallback((path: string, hasUnsaved: boolean) => {
    if (hasUnsaved) {
      setPendingNavigation(path);
      setShowUnsavedWarning(true);
    } else {
    navigate(path);
    console.log('[NAV] navigate called � path:', path, 'window.location.hash:', window.location.hash, 'window.location.href:', window.location.href);
    }
  }, [navigate]);

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedWarning(false);
    setSettingsHasChanges(false); // Clear the flag
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [navigate, pendingNavigation]);

  const handleWorkspaceSaveAndNavigate = useCallback(async () => {
    const saveFn = (window as any).__workspaceSave;
    if (saveFn) await saveFn();
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [navigate, pendingNavigation]);

  const handleWorkspaceDiscardChanges = useCallback(() => {
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [navigate, pendingNavigation]);

  const handleSaveAndNavigate = useCallback(() => {
    setShowUnsavedWarning(false);
    // Trigger save from settings via the stored ref
    if (settingsSaveFnRef.current) {
      settingsSaveFnRef.current();
    }
    setSettingsHasChanges(false); // Clear the flag
    if (pendingNavigation) {
      // Small delay to ensure save completes
      setTimeout(() => {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }, 50);
    }
  }, [navigate, pendingNavigation]);

  // Stable callback for SettingsPage to register its save function
  const handleRegisterSave = useCallback((saveFn: () => void) => {
    settingsSaveFnRef.current = saveFn;
  }, []);

  // Handle sidebar navigation with unsaved changes check

  // Listen for main process requesting save on window close
  // (removed - close is always allowed now)

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format duration in seconds to human-readable string
  // < 60s → "45s", 60s-3600s → "2m 15s", ≥ 3600s → "1h 23m"
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };


  // ── Dev Trigger Panel Handlers (Task 2) ─────────────────────────────────────
  // Fire handlers - trigger each modal to open
  const devFireSleepDetection = async () => {
    if (!sleepDetectionData) {
      try {
        const data = await window.deskflowAPI?.checkSleepDetection?.();
        if (data?.detected) {
          setSleepDetectionData(data);
          const bed = new Date(data.suggestedBedtime);
          const wake = new Date(data.suggestedWakeTime);
          setSleepDetectCustomBedtime({ hours: bed.getHours(), minutes: bed.getMinutes() });
          setSleepDetectCustomWaketime({ hours: wake.getHours(), minutes: wake.getMinutes() });
          setSleepDetectFellAsleepAt({ hours: bed.getHours(), minutes: (bed.getMinutes() + 15) % 60 });
          setSleepDetectWakeUpAt({ hours: wake.getHours(), minutes: Math.max(0, wake.getMinutes() - 5) });
          const bd = new Date(bed);
          if (bd.getHours() < 12) bd.setDate(bd.getDate() - 1);
          setSleepDetectDate(`${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`);
          setSleepModalStep('sleep');
        } else {
          // No real detection — create synthetic data so the modal opens for dev testing
          const now = new Date();
          const bedOff = new Date(now.getTime() - 8 * 3600000);
          const wokeUp = new Date(now.getTime() - 7 * 3600000);
          setSleepDetectionData({
            gapMinutes: 60,
            suggestedBedtime: bedOff.toISOString(),
            suggestedWakeTime: wokeUp.toISOString(),
          });
          setSleepDetectCustomBedtime({ hours: bedOff.getHours(), minutes: bedOff.getMinutes() });
          setSleepDetectCustomWaketime({ hours: wokeUp.getHours(), minutes: wokeUp.getMinutes() });
          setSleepDetectFellAsleepAt({ hours: bedOff.getHours(), minutes: (bedOff.getMinutes() + 15) % 60 });
          setSleepDetectWakeUpAt({ hours: wokeUp.getHours(), minutes: Math.max(0, wokeUp.getMinutes() - 5) });
          const bd = new Date(bedOff);
          if (bd.getHours() < 12) bd.setDate(bd.getDate() - 1);
          setSleepDetectDate(`${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`);
          setSleepModalStep('sleep');
        }
      } catch { /* ignore */ }
    }
    setShowSleepDetection(true);
  };
  const devFireAfkPrompt = () => {
    const nowMs = Date.now();
    const entry: AfkPromptEntry = {
      id: afkQueueIdRef.current++,
      duration: '5m',
      idleStartMs: nowMs - 5 * 60 * 1000,
      returnMs: nowMs,
      defaultNotAfk: true,
    };
    setAfkPromptQueue(prev => [...prev, entry]);
    afkPromptShownRef.current = false;
  };
  const devFireSleepGapFill = () => {
    const now = new Date();
    setSleepGapFillTarget({
      start: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      end: now.toISOString(),
      duration_seconds: 1800,
    });
  };
  const devFireAfkGapFill = () => {
    const now = new Date();
    setAfkGapFillTarget({
      start: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      end: now.toISOString(),
      duration_seconds: 1800,
    });
  };
const devFireSmartFill = async () => {
     try {
       const gaps = await (window as any).deskflowAPI?.detectUsageGaps?.({ period: 'today', minGapMinutes: 5 });
       if (Array.isArray(gaps) && gaps.length > 0) {
         const fillGaps = gaps.map((g: any, i: number) => ({
           id: `gap-${i}`,
           start: new Date(g.start),
           end: new Date(g.end),
           duration_seconds: g.durationSeconds,
         }));
         setSmartFillGaps(fillGaps);
         setSmartFillSource('external');
       }
     } catch (err) {
       console.error('[DevTrigger] Failed to detect gaps for smart fill:', err);
     }
   };

   // ── Dev Inject Handlers ───────────────────────────────────────
   const runSleepDetectionInject = async () => {
     try {
       const data = await (window as any).deskflowAPI?.checkSleepDetection?.();
       if (data?.detected) {
         setDevSleepDetectionResult(data);
         const bed = new Date(data.suggestedBedtime);
         const wake = new Date(data.suggestedWakeTime);
         setDevSleepInject(prev => ({
           ...prev,
           bedtime: { hours: bed.getHours(), minutes: bed.getMinutes() },
           waketime: { hours: wake.getHours(), minutes: wake.getMinutes() },
           date: '',
         }));
         const bd = new Date(bed);
         if (bd.getHours() < 12) bd.setDate(bd.getDate() - 1);
         setDevSleepInject(prev => ({ ...prev, date: `${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,'0')}-${String(bd.getDate()).padStart(2,'0')}` }));
       }
     } catch { /* ignore */ }
   };

   const previewAdjacentGapsInject = async () => {
     try {
       const bedtime = new Date(devSleepInject.date + 'T00:00:00');
       const deviceOff = new Date(bedtime);
       deviceOff.setHours(devSleepInject.bedtime.hours, devSleepInject.bedtime.minutes, 0, 0);
       if (devSleepInject.bedtime.hours < 12) deviceOff.setDate(deviceOff.getDate() + 1);
       const deviceOn = new Date(bedtime);
       deviceOn.setHours(devSleepInject.waketime.hours, devSleepInject.waketime.minutes, 0, 0);
       if (devSleepInject.waketime.hours < 12) deviceOn.setDate(deviceOn.getDate() + 1);
       if (deviceOn <= deviceOff) deviceOn.setDate(deviceOn.getDate() + 1);
       const result = await (window as any).deskflowAPI?.computeAdjacentGaps?.({
         sleepStartIso: deviceOff.toISOString(),
         sleepEndIso: deviceOn.toISOString(),
       });
       const gaps = result?.gaps || [];
       setDevPreviewGaps(gaps);
     } catch { /* ignore */ }
   };

   const confirmSleepInject = async () => {
     try {
       const bedtime = new Date(devSleepInject.date + 'T00:00:00');
       const deviceOff = new Date(bedtime);
       deviceOff.setHours(devSleepInject.bedtime.hours, devSleepInject.bedtime.minutes, 0, 0);
       if (devSleepInject.bedtime.hours < 12) deviceOff.setDate(deviceOff.getDate() + 1);
       const fellAsleep = new Date(bedtime);
       fellAsleep.setHours(devSleepInject.fellAsleepAt.hours, devSleepInject.fellAsleepAt.minutes, 0, 0);
       if (devSleepInject.fellAsleepAt.hours < 12) fellAsleep.setDate(fellAsleep.getDate() + 1);
       const wokeUp = new Date(bedtime);
       wokeUp.setHours(devSleepInject.wakeUpAt.hours, devSleepInject.wakeUpAt.minutes, 0, 0);
       if (devSleepInject.wakeUpAt.hours < 12) wokeUp.setDate(wokeUp.getDate() + 1);
       const deviceOn = new Date(bedtime);
       deviceOn.setHours(devSleepInject.waketime.hours, devSleepInject.waketime.minutes, 0, 0);
       if (devSleepInject.waketime.hours < 12) deviceOn.setDate(deviceOn.getDate() + 1);
       if (wokeUp <= deviceOff) { wokeUp.setDate(wokeUp.getDate() + 1); deviceOn.setDate(deviceOn.getDate() + 1); }
       if (deviceOn <= wokeUp) deviceOn.setDate(deviceOn.getDate() + 1);
       const deviceOffToSleepSec = Math.max(0, Math.round((fellAsleep.getTime() - deviceOff.getTime()) / 1000));
       const wakeUpToAppSec = Math.max(0, Math.round((deviceOn.getTime() - wokeUp.getTime()) / 1000));
       if (window.deskflowAPI?.confirmSleep) {
         const result = await window.deskflowAPI.confirmSleep({
           started_at: deviceOff.toISOString(), ended_at: wokeUp.toISOString(),
           device_off_to_sleep_seconds: deviceOffToSleepSec, wake_up_to_app_seconds: wakeUpToAppSec,
         });
         if (result?.success) {
           window.dispatchEvent(new CustomEvent('sleep-confirmed'));
           window.dispatchEvent(new CustomEvent('external-data-changed'));
           let gaps: any[] = [];
           try {
             const gapResult = await (window as any).deskflowAPI?.computeAdjacentGaps?.({
               sleepStartIso: deviceOff.toISOString(), sleepEndIso: wokeUp.toISOString(),
             });
             gaps = gapResult?.gaps || [];
           } catch {}
           if (gaps.length === 0) gaps = devSleepDetectionResult?.adjacentGaps || [];
           setDevSleepDetectionResult(prev => prev ? { ...prev, adjacentGaps: gaps } : prev);
           setDevPreviewGaps(gaps);
           setSleepModalStep('gaps');
           setShowSleepDetection(true);
           return;
         }
       }
     } catch (err) { console.error('[App] confirmSleepInject failed:', err); }
     setShowSleepDetection(false);
   };

   const injectAfkEntry = () => {
     const nowMs = Date.now();
     const entry: AfkPromptEntry = {
       id: afkQueueIdRef.current++,
       duration: `${devAfkInject.idleMinutes}m`,
       idleStartMs: nowMs - devAfkInject.idleMinutes * 60 * 1000,
       returnMs: nowMs,
       defaultNotAfk: devAfkInject.defaultNotAfk,
     };
     setAfkPromptQueue(prev => {
       setDevAfkQueueView([...prev, entry]);
       return [...prev, entry];
     });
     afkPromptShownRef.current = false;
   };

   const detectGapsInject = async () => {
     try {
       const gaps = await (window as any).deskflowAPI?.detectUsageGaps?.({ period: devGapsInject.period, minGapMinutes: devGapsInject.minGapMinutes });
       if (Array.isArray(gaps)) setDevDetectedGaps(gaps);
     } catch { /* ignore */ }
   };

   const fillSleepGapsInject = () => {
     if (sleepDetectionData?.adjacentGaps?.length) {
       const gaps = sleepDetectionData.adjacentGaps.map((g, i) => ({
         id: `sleep-gap-${i}`, start: new Date(g.start), end: new Date(g.end), duration_seconds: g.durationSeconds,
       }));
       setSmartFillGaps(gaps);
       setSmartFillSource('sleep');
     } else {
       // Fallback: detect gaps around a synthetic sleep window
       const now = new Date();
       const sleepStart = new Date(now.getTime() - 8 * 3600000);
       const sleepEnd = new Date(now.getTime() - 7 * 3600000);
       (window as any).deskflowAPI?.computeAdjacentGaps?.({
         sleepStartIso: sleepStart.toISOString(), sleepEndIso: sleepEnd.toISOString(),
       }).then((r: any) => {
         const gaps = (r?.gaps || []).map((g: any, i: number) => ({
           id: `auto-sleep-gap-${i}`, start: new Date(g.start), end: new Date(g.end), duration_seconds: g.durationSeconds,
         }));
         setSmartFillGaps(gaps);
         setSmartFillSource('sleep');
       }).catch(() => {});
     }
   };

   const fillAfkGapsInject = () => {
     const entry = afkPromptQueue[0];
     if (entry?.idleStartMs && entry?.returnMs) {
       const gaps = [{ id: 'afk-gap', start: new Date(entry.idleStartMs), end: new Date(entry.returnMs), duration_seconds: Math.round((entry.returnMs - entry.idleStartMs) / 1000) }];
       setSmartFillGaps(gaps);
       setSmartFillSource('afk');
     }
   };

   const dismissAllDev = () => {
     setShowSleepDetection(false); setSleepDetectionData(null); setSleepModalStep('sleep');
     setSleepFillActivities(null); setSleepFillSessions(null); setSleepGapFillTarget(null);
     setSleepGapQueue([]); setSleepFilledGapStarts([]);
     setAfkPromptQueue([]); setAfkGapsData(null); setAfkGapFillTarget(null);
     setAfkGapQueue([]); setAfkFilledGapStarts([]);
     setSmartFillGaps(null); setSmartFillSource(null);
     setShowManualAssign(false); setPairPhoneModal(null); setShowConfirmClear(false);
     setShowConfirmExport(null); setShowSummary(false); setNotifPanelOpen(false);
     setShowWorkspaceWarning(false); setShowUnsavedWarning(false);
     setPaletteOpen(false); setDevForceGapBannerMinutes(null);
     setDevDetectedGaps([]); setDevSleepDetectionResult(null); setDevPreviewGaps([]);
     setDevAfkQueueView([]); setShowGapDrawer(false); setDevTriggerOpen(false);
   };
  const devFireManualAssign = () => setShowManualAssign(true);
  const devFirePairPhone = () => setPairPhoneModal({ terminalId: 'test-terminal', label: 'Test Device' });
  const devFireConfirmExportCsv = () => setShowConfirmExport('csv');
  const devFireConfirmExportJson = () => setShowConfirmExport('json');
  const devFireConfirmClear = () => setShowConfirmClear(true);
  const devFireAiSummary = () => setShowSummary(true);
  const [devForceGapBannerMinutes, setDevForceGapBannerMinutes] = useState<number | null>(null);
  const devForceGapBanner = () => setDevForceGapBannerMinutes(45);
  const devFireNotifPanel = () => setNotifPanelOpen(true);
  const devFireCommandPalette = () => setPaletteOpen(true);
  const devFireWorkspaceWarning = () => {};
  const devFireUnsavedWarning = () => setShowUnsavedWarning(true);
  const devFireGapDrawer = () => window.dispatchEvent(new CustomEvent('open-gap-drawer'));
  const devFireGapBannerSetting = () => {
    setShowGapBanner(true);
    setGapBannerMinutes(15);
  };
  const devFireDatabasePage = () => navigate('/database');
  const devFireActivityLogs = () => navigate('/ai?tab=logs');
  const devFireReports = () => navigate('/reports');

  // Trigger definitions for DevTriggerPanel
  const devTriggers = [
    { id: 'sleep-detection', label: 'Sleep Detection Modal', icon: <Bed className="w-4 h-4" />, condition: 'On sleep cycle detection', fire: devFireSleepDetection },
    { id: 'afk-prompt', label: 'AFK Prompt', icon: <Clock className="w-4 h-4" />, condition: 'After AFK period', fire: devFireAfkPrompt },
    { id: 'sleep-gap-fill', label: 'Sleep Gap Fill', icon: <Zap className="w-4 h-4" />, condition: 'When sleep gap needs fill', fire: devFireSleepGapFill },
    { id: 'afk-gap-fill', label: 'AFK Gap Fill', icon: <Zap className="w-4 h-4" />, condition: 'When AFK gap detected', fire: devFireAfkGapFill },
    { id: 'smart-fill', label: 'Smart Fill Modal', icon: <Brain className="w-4 h-4" />, condition: 'Automatic gap detection', fire: devFireSmartFill },
    { id: 'manual-assign', label: 'Manual Assign Modal', icon: <UserCheck className="w-4 h-4" />, condition: 'Manual time assignment', fire: devFireManualAssign },
    { id: 'pair-phone', label: 'Pair Phone Modal', icon: <Smartphone className="w-4 h-4" />, condition: 'Device pairing', fire: devFirePairPhone },
    { id: 'confirm-export', label: 'Confirm Export Modal', icon: <Download className="w-4 h-4" />, condition: 'Before data export', fire: devFireConfirmExportCsv, prepAndFire: devFireConfirmExportCsv, hasPrep: () => false, prepLabel: () => 'CSV | JSON' },
    { id: 'confirm-clear', label: 'Confirm Clear Modal', icon: <Trash2 className="w-4 h-4" />, condition: 'Before clearing data', fire: devFireConfirmClear },
    { id: 'ai-summary', label: 'AI Summary Modal', icon: <Brain className="w-4 h-4" />, condition: 'Productivity summary', fire: devFireAiSummary },
    { id: 'gap-banner', label: 'Gap Banner', icon: <AlertCircle className="w-4 h-4" />, condition: 'Large unfilled gap', fire: devForceGapBanner },
    { id: 'notif-panel', label: 'Notification Panel', icon: <Bell className="w-4 h-4" />, condition: 'New notification', fire: devFireNotifPanel },
    { id: 'command-palette', label: 'Command Palette', icon: <Command className="w-4 h-4" />, condition: 'Keyboard shortcut ⌘K', fire: devFireCommandPalette },
    { id: 'workspace-warning', label: 'Workspace Warning', icon: <Folder className="w-4 h-4" />, condition: 'Unsaved workspace changes', fire: devFireWorkspaceWarning },
    { id: 'unsaved-warning', label: 'Unsaved Warning', icon: <Save className="w-4 h-4" />, condition: 'Unsaved settings', fire: devFireUnsavedWarning },
    { id: 'gap-drawer', label: 'Gap Drawer', icon: <LayoutDashboard className="w-4 h-4" />, condition: 'Open gap drawer', fire: devFireGapDrawer },
    { id: 'settings-warning', label: 'Settings Warning', icon: <Settings className="w-4 h-4" />, condition: 'Unsaved settings', fire: devFireGapBannerSetting },
    { id: 'database-page', label: 'Database Page', icon: <Database className="w-4 h-4" />, condition: 'Navigate to database', fire: devFireDatabasePage },
    { id: 'activity-logs', label: 'Activity Logs Tab', icon: <BarChart3 className="w-4 h-4" />, condition: 'Navigate to logs', fire: devFireActivityLogs },
  ];

  return (
    <VoiceProvider>
    <TutorialProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-[#121212] text-white">
      <TitleBar />
      <AppBackground />
      <ServerErrorBanner />
      <div className="flex flex-1 min-h-0 relative">
      {/* Sidebar hidden on workspace (/terminal) and during solar overlay */}
      {location.pathname !== '/terminal' && !solarOverlayActive && (
        <Sidebar
          collapsed={sidebarCollapsed}
          width={sidebarWidth}
          onResize={resizeSidebar}
          onToggle={toggleSidebar}
          pathname={location.pathname}
          isTracking={isTracking}
          elapsedTime={elapsedTime}
          onToggleTracking={toggleTracking}
          onQuickLog={() => {}}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Gap Banner */}
        <AnimatePresence>
          {showGapBannerSetting && unfilledMinutes > 0 && (
            <GapBanner
              unfilledMinutes={unfilledMinutes}
              gapCount={gapCount}
              onOpenDrawer={() => setShowGapDrawer(true)}
              onDismissForever={() => {
                window.deskflowAPI?.setPreference('showGapBannerSetting', false);
                setShowGapBannerSetting(false);
              }}
            />
          )}
        </AnimatePresence>
        {/* Top Bar � workspace (/terminal) and solar overlay render their own headers */}
        {location.pathname !== '/terminal' && !solarOverlayActive && (
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 glass">
          <div className="flex items-center gap-4">
            {(() => {
              const match = SIDEBAR_ITEMS.find(i => i.path === location.pathname);
              return match ? (
                <PageTitle key={location.key} icon={match.icon} label={match.label} path={match.path} />
              ) : (
                <div className="text-lg font-semibold tracking-tight">{location.pathname}</div>
              );
            })()}
            <div className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              LIVE
            </div>
            {!dbConnected && (
              <div className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                Reconnecting...
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Time mode toggle: Focus vs Total */}
            <div className="flex bg-zinc-900 rounded-full p-1 flex-shrink-0 light:bg-zinc-100">
              <button
                onClick={() => setTimeMode('focus')}
                className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 w-[72px] justify-center flex-shrink-0 text-xs ${timeMode === 'focus' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                title="Focus Time: Productive apps only (websites belong to the tracking browser)"
              >
                <Zap className="w-3 h-3" />
                Focus
              </button>
              <button
                onClick={() => setTimeMode('total')}
                className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 w-[72px] justify-center flex-shrink-0 text-xs ${timeMode === 'total' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                title="Total Time: Apps only (websites belong to the tracking browser)"
              >
                <Clock className="w-3 h-3" />
                Total
              </button>
            </div>

            {/* Display current time */}
            <div
              className="text-sm font-mono font-semibold text-white tabular-nums flex items-center gap-2 cursor-help"
              title={`Apps: ${formatDuration(timeBreakdown.apps)} | Websites: ${formatDuration(timeBreakdown.websites)}`}
            >
              <Clock className="w-4 h-4 text-zinc-500" />
              {formatDuration(displayTime)}
            </div>

            <div className="flex bg-zinc-900 rounded-full p-1 text-xs light:bg-zinc-100">
              {/* Today */}
              <button
                onClick={() => { setExpandedPeriod(null); setSelectedPeriod('today'); }}
                className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'today' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
              >
                Today
              </button>

              {/* Week / 7 Day */}
              <div className="relative flex">
                {expandedPeriod === 'week' ? (
                  <>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('week'); }}
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'week' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('7day'); }}
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === '7day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                    >
                      7 Day
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setExpandedPeriod('week')}
                    className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'week' || selectedPeriod === '7day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                  >
                    {selectedPeriod === '7day' ? '7 Day' : 'Week'}
                  </button>
                )}
              </div>

              {/* Month / 30 Day */}
              <div className="relative flex">
                {expandedPeriod === 'month' ? (
                  <>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('month'); }}
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('30day'); }}
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === '30day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                    >
                      30d
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setExpandedPeriod('month')}
                    className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'month' || selectedPeriod === '30day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
                  >
                    {selectedPeriod === '30day' ? '30d' : 'Month'}
                  </button>
                )}
              </div>

              {/* All Time */}
              <button
                onClick={() => { setExpandedPeriod(null); setSelectedPeriod('all'); }}
                className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700'}`}
              >
                All Time
              </button>
            </div>

            {/* Timeline navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateOffset(o => o + 1)}
                className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition light:bg-zinc-200/50 light:hover:bg-zinc-300/50 light:text-zinc-500 light:hover:text-zinc-700"
                title="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-zinc-400 min-w-[80px] text-center select-none font-medium light:text-zinc-500">
                {getDateRange(selectedPeriod, dateOffset).label}
              </span>
              <button
                onClick={() => setDateOffset(o => Math.max(0, o - 1))}
                disabled={dateOffset === 0}
                className={`p-1.5 rounded-lg transition ${
                  dateOffset === 0
                    ? 'bg-zinc-800/20 text-zinc-600 cursor-not-allowed light:bg-zinc-200/20 light:text-zinc-400'
                    : 'bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white light:bg-zinc-200/50 light:hover:bg-zinc-300/50 light:text-zinc-500 light:hover:text-zinc-700'
                }`}
                title="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowManualAssign(true)}
              title="Fill gaps with tracked apps, websites, or external activities"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Smart Fill
            </button>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400 light:text-zinc-500">
                <Clock className="w-4 h-4" />
                {format(new Date(), 'HH:mm')}
              </div>
              {isIdle && (
                <div className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs flex items-center gap-1 light:bg-amber-50/50 light:text-amber-600">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" /> IDLE
                </div>
              )}
            </div>

            <button
              onClick={() => (window as any).deskflowAPI?.restartApp?.() ?? window.location.reload()}
              title="Restart app (full reload including main process)"
              className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition light:bg-zinc-200/50 light:hover:bg-zinc-300/50 light:text-zinc-500 light:hover:text-zinc-700"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

<motion.button
               onClick={toggleTracking}
               className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition ${isTracking
                 ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                 : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                 }`}
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
             >
               {isTracking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
               {isTracking ? 'Pause Tracking' : 'Resume Tracking'}
             </motion.button>
             {DEV_TRIGGER_ENABLED && (
               <button
                 onClick={() => setDevTriggerOpen(true)}
                 title="DevTrigger Panel"
                 className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition"
               >
                 <Bug className="w-4 h-4" />
               </button>
             )}
           </div>
         </div>
         )}

        {/* Main Scroll Area — also the root the find bar's All/Section scopes
            index, so that app-wide search covers whatever is actually rendered. */}
        <div data-page-root className={`flex-1 min-h-0 ${location.pathname === '/terminal' || location.pathname === '/database' ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
          <ErrorBoundary key={location.pathname}>
            <Routes key={location.pathname}>
              {/* Dashboard */}
              <Route path="/" element={
                <DashboardPage 
                  appColors={appColors} 
                  categoryOverrides={categoryOverrides} 
                  timerBehavior={timerBehavior} 
                  selectedPeriod={selectedPeriod}
                  onSelectedPeriodChange={setSelectedPeriod}
                  dateOffset={dateOffset}
                  onDateOffsetChange={setDateOffset}
                  trackingBrowser={trackingBrowser}
                  trackingBrowsers={trackingBrowsers}
                  trackerAppMode={trackerAppMode} 
                  tierAssignments={tierAssignments || DEFAULT_TIER_ASSIGNMENTS} 
                  timerState={timerState} 
                  onTimerStateChange={setTimerState} 
                  activityFeed={activityFeed} 
                  onActivityFeedChange={handleActivityFeedChange} 
                  externalActivities={externalActivities} 
                  externalWeeklyStats={externalWeeklyStats}
                />
              } />
              {/* Stats Page */}
              {/* Activity Page — unified Apps/Websites/Productivity */}
              <Route path="/activity" element={<ActivityPage appStats={appStats} logs={platformFilter === 'all' ? filteredLogs : filteredLogs.filter((l: any) => l.platform === platformFilter)} allLogs={allLogs} browserLogs={browserLogs} selectedPeriod={selectedPeriod} dateOffset={dateOffset} onDateOffsetChange={setDateOffset} timeMode={timeMode} tierAssignments={tierAssignments || DEFAULT_TIER_ASSIGNMENTS} liveActivityLogs={liveActivityLogs} domainKeywordRules={domainKeywordRules} externalActivities={externalActivities} externalActivityTiers={externalActivityTiers} platformFilter={platformFilter} availablePlatforms={availablePlatforms} onPlatformFilterChange={setPlatformFilter} />} />
              {/* Rankings Page */}
              <Route path="/rankings" element={<RankingsPage selectedPeriod={selectedPeriod} dateOffset={dateOffset} onDateOffsetChange={setDateOffset} tierAssignments={tierAssignments || DEFAULT_TIER_ASSIGNMENTS} />} />
              {/* Legacy routes � redirect to unified Activity page */}
              <Route path="/stats" element={<Navigate to="/activity?tab=apps" replace />} />
              <Route path="/productivity" element={<Navigate to="/activity?tab=productivity" replace />} />
              <Route path="/browser" element={<Navigate to="/activity?tab=websites" replace />} />
              {/* IDE Page */}
              <Route path="/ide" element={<IDEProjectsPage selectedPeriod={selectedPeriod} dateOffset={dateOffset} />} />

              <Route path="/external" element={<ExternalPage selectedPeriod={selectedPeriod} dateOffset={dateOffset} onDateOffsetChange={setDateOffset} />} />

              <Route path="/ai" element={<AiPage />} />
              
              <Route path="/studio" element={<FeatureStudioPage />} />
              <Route path="/finance" element={<FinancePage />} />
              {/* Resume Builder */}
              <Route path="/resume" element={<ResumePage />} />
              <Route path="/resume/build" element={<ResumeBuilderPage />} />
              <Route path="/resume/preview" element={<ResumePreviewPage />} />
              <Route path="/resume/import" element={<ResumeImportPage />} />
              <Route path="/resume/export" element={<ResumeExportPage />} />
               {/* Legacy routes — kept as redirect for any bookmarked URLs */}
               <Route path="/old-dashboard" element={<Navigate to="/external" replace />} />

              <Route path="/guide" element={<GuidePage />} />
              <Route path="/compositions" element={<Navigate to="/ai" replace />} />

              <Route path="/life" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Life...</div>}><LifePage /></Suspense></ErrorBoundary>} />

              <Route path="/learn" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Learn...</div>}><LearnPage /></Suspense></ErrorBoundary>} />
              <Route path="/lecture/*" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Lecture...</div>}><LectureWorkspace /></Suspense></ErrorBoundary>} />
              <Route path="/conductor" element={<div className="flex items-center justify-center h-full text-zinc-500 text-sm">Conductor is now in the workspace sidebar</div>} />

              <Route path="/agentic" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Agentic System...</div>}><AgenticSystemPage /></Suspense></ErrorBoundary>} />

              <Route path="/ide-help" element={<IDEHelpPage />} />

              <Route path="/terminal" element={<TerminalPage />} />
              <Route path="/simple-terminal" element={<SimpleTerminalPage />} />
              <Route path="/penguin-console" element={<PenguinConsole />} />
              {/* Reports/Insights Page */}
              <Route path="/reports" element={<InsightsPage
                logs={allLogs}
                browserLogs={browserLogs}
                appStats={appStats}
                selectedPeriod={selectedPeriod}
                dateOffset={dateOffset}
                onDateOffsetChange={setDateOffset}
                tierAssignments={tierAssignments || DEFAULT_TIER_ASSIGNMENTS}
              />} />
              {/* Database Page */}
              <Route path="/database" element={<DatabasePage />} />
              {/* Backup Center */}
              {/* Pricing Page */}
              <Route path="/pricing" element={<div className="glass rounded-xl p-8 flex items-center justify-center h-96"><div className="text-center text-zinc-400"><div className="text-4xl mb-4">!</div><div className="text-lg font-medium">Not Yet Added Feature</div><div className="text-sm text-zinc-500 mt-1">Pricing plans are coming soon</div></div></div>} />
              {/* Settings Page */}
<Route path="/settings" element={<SettingsPage logs={logs} appStats={allTimeAppStats} websiteStats={allTimeWebsiteStats} onRegisterSave={handleRegisterSave} onReloadData={loadData} onCategoryOverridesChange={setCategoryOverrides} onHasChangesChange={setSettingsHasChanges} timerBehavior={timerBehavior} setTimerBehavior={setTimerBehavior} trackerAppMode={trackerAppMode} setTrackerAppMode={setTrackerAppMode} externalActivities={externalActivities} externalActivityTiers={externalActivityTiers} onExternalActivityTiersChange={setExternalActivityTiers} showGapBannerSetting={showGapBannerSetting} setShowGapBannerSetting={setShowGapBannerSetting} />} />
              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>

          {/* -- Unsaved Changes Warning Modal -- */}
          <AnimatePresence>
            {showUnsavedWarning && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[65]" onClick={() => setShowUnsavedWarning(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="glass rounded-xl p-8 w-full max-w-sm"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">Unsaved Changes</div>
                      <div className="text-xs text-zinc-400">You have unsaved settings.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 mb-6 space-y-1">
                    <p>⚠ Your category assignments and color customizations</p>
                    <p>⚠ will be lost if you navigate away without saving</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSaveAndNavigate}
                      className="w-full py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition text-sm font-medium border border-emerald-500/30 light:bg-emerald-50/50 light:text-emerald-600 light:border-emerald-200/30"
                    >
                      Save & Navigate
                    </button>
                    <button
                      onClick={handleDiscardChanges}
                      className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-sm font-medium light:bg-white light:text-zinc-700 light:hover:bg-zinc-100"
                    >
                      Discard Changes
                    </button>
                    <button
                      onClick={() => { setShowUnsavedWarning(false); setPendingNavigation(null); }}
                      className="w-full py-2 rounded-xl text-zinc-500 hover:text-zinc-400 transition text-xs light:text-zinc-400 light:hover:text-zinc-600"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* -- Workspace Unsaved Warning Modal (removed - close always allowed) -- */}

          {/* -- Sleep Detection Modal -- */}
          <AnimatePresence>
            {showSleepDetection && sleepDetectionData && (
               <SleepDetectionModal
                data={sleepDetectionData}
                customBedtime={sleepDetectCustomBedtime}
                customWaketime={sleepDetectCustomWaketime}
                fellAsleepAt={sleepDetectFellAsleepAt}
                wakeUpAt={sleepDetectWakeUpAt}
                onBedtimeChange={setSleepDetectCustomBedtime}
                onWaketimeChange={setSleepDetectCustomWaketime}
                onFellAsleepAtChange={setSleepDetectFellAsleepAt}
                onWakeUpAtChange={setSleepDetectWakeUpAt}
                sleepDate={sleepDetectDate}
                onSleepDateChange={setSleepDetectDate}
                onConfirm={confirmSleepDetection}
                onDismiss={dismissSleepDetection}
                adjacentGaps={sleepDetectionData.adjacentGaps || []}
                step={sleepModalStep}
                activities={sleepFillActivities || []}
                sessions={sleepFillSessions || []}
                onDone={dismissSleepDetection}
                onFillGapRequest={(gaps) => {
                  if (gaps.length === 1) {
                    setSleepGapFillTarget(gaps[0]);
                  } else if (gaps.length > 1) {
                    setSmartFillSource('sleep');
                    setSmartFillGaps(gaps.map((g, i) => ({ id: `sleep-gap-${i}`, start: g.start, end: g.end, duration_seconds: g.duration_seconds })));
                    setSmartFillActivities(sleepFillActivities || []);
                    setSmartFillSessions(sleepFillSessions || []);
                  }
                }}
                filledGapStarts={sleepFilledGapStarts}
              />
            )}
          </AnimatePresence>

          {/* -- Sleep Gap Fill Modal (reuses external GapFillModal) -- */}
          <GapFillModal
            open={!!sleepGapFillTarget}
            gap={sleepGapFillTarget ? {
              start: new Date(sleepGapFillTarget.start),
              end: new Date(sleepGapFillTarget.end),
              duration_seconds: sleepGapFillTarget.duration_seconds,
            } : null}
            activities={sleepFillActivities || []}
            sessions={sleepFillSessions || []}
            onClose={() => {
              // Skip this gap, move to next in queue
              const startKey = sleepGapFillTarget ? (typeof sleepGapFillTarget.start === 'string' ? sleepGapFillTarget.start : sleepGapFillTarget.start?.toISOString?.()) : null;
              if (startKey) setSleepFilledGapStarts(prev => [...prev, startKey]);
              if (sleepGapQueue.length > 0) {
                setSleepGapFillTarget(sleepGapQueue[0]);
                setSleepGapQueue(q => q.slice(1));
              } else {
                setSleepGapFillTarget(null);
                setSleepGapQueue([]);
              }
            }}
            onFillGap={async (gap, segments) => {
              await fillGapWithSegments(
                gap,
                segments,
                async (activityId, minutes, startedAt, endedAt) => {
                  await window.deskflowAPI?.addExternalTime(activityId, minutes, startedAt, endedAt);
                }
              );
              const startKey = sleepGapFillTarget ? (typeof sleepGapFillTarget.start === 'string' ? sleepGapFillTarget.start : sleepGapFillTarget.start?.toISOString?.()) : null;
              if (startKey) setSleepFilledGapStarts(prev => [...prev, startKey]);
              window.dispatchEvent(new CustomEvent('external-data-changed'));
              // Move to next gap in queue
              if (sleepGapQueue.length > 0) {
                setSleepGapFillTarget(sleepGapQueue[0]);
                setSleepGapQueue(q => q.slice(1));
              } else {
                setSleepGapFillTarget(null);
                setSleepGapQueue([]);
              }
            }}
            zClass="z-[10000]"
          />

          {/* Confirm Export Modal */}
          <AnimatePresence>
            {showConfirmExport && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[60]" onClick={() => setShowConfirmExport(null)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="glass rounded-xl p-8 w-full max-w-sm"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">Export Data?</div>
                      <div className="text-xs text-zinc-400">Download your activity log</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-700 text-xs text-zinc-400 mb-6 light:bg-zinc-100/50 light:border-zinc-300 light:text-zinc-500">
                    <p>⚠ {logs.length} activity records will be exported</p>
                    <p>⚠ File format: <span className="text-zinc-200 uppercase light:text-zinc-700">{showConfirmExport}</span></p>
                    <p>⚠ File stays on your device</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirmExport(null)}
                      className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-sm font-medium light:bg-white light:text-zinc-700 light:hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        exportData(showConfirmExport);
                        setShowConfirmExport(null);
                      }}
                      className="flex-1 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition text-sm font-medium border border-emerald-500/30 light:bg-emerald-50/50 light:text-emerald-600 light:border-emerald-200/30"
                    >
                      Export {showConfirmExport?.toUpperCase()}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* SQLite Database Modal */}
          <AnimatePresence>
            {showDatabase && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-[70]" onClick={() => setShowDatabase(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="glass rounded-xl p-8 w-full max-w-4xl max-h-[85vh] flex flex-col"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Code2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-xl">SQLite Activity Logs</div>
                        <div className="text-xs text-zinc-500">TABLE: activity_logs · {allLogs.length} rows · SQLite database</div>
                      </div>
                    </div>
                    <button onClick={() => setShowDatabase(false)} className="text-zinc-400 hover:text-white text-xl">?</button>
                  </div>

                  {/* Schema Info */}
                  <div className="mb-4 text-xs font-mono bg-zinc-950 rounded-lg p-4 border border-zinc-800 overflow-x-auto light:bg-zinc-900/90 light:border-zinc-200">
                    <span className="text-emerald-400">CREATE TABLE</span> activity_logs (<br />
                    &nbsp;&nbsp;id <span className="text-amber-400">INTEGER PRIMARY KEY</span>,<br />
                    &nbsp;&nbsp;timestamp <span className="text-amber-400">DATETIME</span>,<br />
                    &nbsp;&nbsp;app <span className="text-amber-400">TEXT</span>,<br />
                    &nbsp;&nbsp;category <span className="text-amber-400">TEXT</span>,<br />
                    &nbsp;&nbsp;duration_ms <span className="text-amber-400">INTEGER</span>,<br />
                    &nbsp;&nbsp;title <span className="text-amber-400">TEXT NULL</span>,<br />
                    &nbsp;&nbsp;project <span className="text-amber-400">TEXT NULL</span><br />
                    );
                  </div>

                  {/* Data Table */}
                  <div className="flex-1 overflow-auto border border-zinc-800 rounded-xl bg-zinc-950 light:bg-zinc-900/90 light:border-zinc-200">
                    <table className="w-full text-sm font-mono">
                      <thead className="sticky top-0 bg-zinc-900 z-10 light:bg-zinc-100">
                        <tr className="border-b border-zinc-800 text-left text-zinc-400 light:border-zinc-300 light:text-zinc-600">
                          <th className="px-4 py-3 font-medium">ID</th>
                          <th className="px-4 py-3 font-medium">Timestamp</th>
                          <th className="px-4 py-3 font-medium">App</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Duration</th>
                          <th className="px-4 py-3 font-medium text-left text-zinc-400 light:text-zinc-600">Project</th>
                          <th className="px-4 py-3 font-medium text-left text-zinc-400 light:text-zinc-600">Title</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 light:divide-zinc-200">
                        {allLogs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-zinc-500 light:text-zinc-400">
                              No records yet. Start tracking to populate the database.
                            </td>
                          </tr>
                        ) : (
                          allLogs.slice(0, 50).map((log, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/50 transition light:hover:bg-zinc-100/50">
                              <td className="px-4 py-3 text-emerald-400">#{log.id}</td>
                              <td className="px-4 py-3 text-zinc-400 light:text-zinc-500">{format(log.timestamp, 'yyyy-MM-dd HH:mm:ss')}</td>
                              <td className="px-4 py-3 text-white font-medium light:text-zinc-900">{log.app}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-xs"
                                  style={{
                                    backgroundColor: APP_CATEGORIES[log.app as keyof typeof APP_CATEGORIES]?.color + '22',
                                    color: APP_CATEGORIES[log.app as keyof typeof APP_CATEGORIES]?.color
                                  }}>
                                  {log.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 tabular-nums text-white light:text-zinc-900">{log.duration} min</td>
                              <td className="px-4 py-3 text-zinc-400 light:text-zinc-500">{log.project || ''}</td>
                              <td className="px-4 py-3 text-zinc-400 truncate max-w-[200px] light:text-zinc-500">{log.title || ''}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 light:text-zinc-400">
                    <div>Showing {Math.min(50, allLogs.length)} of {allLogs.length} records · Data persists in SQLite database</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const sql = `SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50;`;
                          alert(`Simulated Query:\n\n${sql}\n\n${allLogs.length} rows returned`);
                        }}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded light:bg-zinc-200 light:text-zinc-700 light:hover:bg-zinc-300"
                      >
                        Run Query
                      </button>
                      <button
                        onClick={() => exportData('json')}
                        className="px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded light:bg-emerald-50/50 light:text-emerald-600"
                      >
                        Export Table
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* AI Summary Modal */}
          <AnimatePresence>
            {showSummary && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-[60] light:bg-black/30" onClick={() => setShowSummary(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass rounded-xl p-8 w-full max-w-xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold">AI Productivity Summary</div>
                        <div className="text-xs text-emerald-400 light:text-emerald-600">Generated using local heuristics</div>
                      </div>
                    </div>
                    <button onClick={() => setShowSummary(false)} className="text-zinc-400 hover:text-white light:text-zinc-500 light:hover:text-zinc-700">?</button>
                  </div>

                  <div className="font-mono text-sm whitespace-pre-wrap bg-zinc-950 p-6 rounded-xl leading-relaxed border border-zinc-800 light:bg-zinc-900/90 light:border-zinc-200">
                    {aiSummary}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiSummary);
                        alert('Summary copied to clipboard');
                      }}
                      className="flex-1 py-3 rounded-xl border border-zinc-700 hover:bg-zinc-900 text-zinc-300 light:border-zinc-300 light:hover:bg-zinc-100 light:text-zinc-700"
                    >
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => exportData('json')}
                      className="flex-1 py-3 rounded-xl bg-white text-black font-medium light:bg-zinc-100 light:text-zinc-900"
                    >
                      Export Full Data
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* -- AFK Activity Prompt -- */}
          {afkPromptQueue.length > 0 && (() => {
            const entry = afkPromptQueue[0];
            const periodStart = entry.idleStartMs ? new Date(entry.idleStartMs).toISOString() : new Date(entry.returnMs - 90000).toISOString();
            const periodEnd = new Date(entry.returnMs).toISOString();
            const totalDurationSeconds = Math.max(1, Math.floor((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 1000));
            return (
              <AfkPromptModal
                key={entry.id}
                allActivities={externalActivities}
                totalDurationSeconds={totalDurationSeconds}
                periodStart={periodStart}
                periodEnd={periodEnd}
                idleStartMs={entry.idleStartMs}
                returnMs={entry.returnMs}
                queueRemaining={afkPromptQueue.length - 1}
                onConfirm={handleAfkConfirm}
                onDismiss={handleAfkDismiss}
                onNotAfk={() => { pendingIdleRangeRef.current = null; setAfkPromptQueue(prev => prev.slice(1)); }}
                defaultNotAfk={entry.defaultNotAfk}
                adjacentGaps={afkGapsData?.gaps || []}
                onFillGapRequest={(gaps) => {
                  if (gaps.length === 1) {
                    setAfkGapFillTarget(gaps[0]);
                  } else if (gaps.length > 1) {
                    setSmartFillSource('afk');
                    setSmartFillGaps(gaps.map((g, i) => ({ id: `afk-gap-${i}`, start: g.start, end: g.end, duration_seconds: g.duration_seconds })));
                    setSmartFillActivities(afkGapsData?.activities || []);
                    setSmartFillSessions(afkGapsData?.sessions || []);
                  }
                }}
                filledGapStarts={afkFilledGapStarts}
                onGapsDone={() => { setAfkGapsData(null); setAfkPromptQueue(prev => prev.slice(1)); }}
              >
                <MissedTimePanel
                  onFillNow={async () => {
                    // Use detectUsageGaps to get ALL of today's unfilled gaps,
                    // not just the 1-2 adjacent gaps from computeAdjacentGaps.
                    const allGaps = await (window as any).deskflowAPI?.detectUsageGaps?.({ period: 'today', minGapMinutes: 5 });
                    const gaps = Array.isArray(allGaps) ? allGaps : [];
                    if (gaps.length > 0) {
                      const fillGaps = gaps.map((g: any, i: number) => ({
                        id: `afk-gap-${i}`,
                        start: new Date(g.start),
                        end: new Date(g.end),
                        duration_seconds: g.durationSeconds,
                      }));
                      setSmartFillGaps(fillGaps);
                      setSmartFillActivities(afkGapsData?.activities || []);
                      setSmartFillSessions(afkGapsData?.sessions || []);
                    }
                  }}
                />
              </AfkPromptModal>
            );
          })()}

          {/* -- AFK Gap Fill Modal -- */}
          <GapFillModal
            open={!!afkGapFillTarget}
            gap={afkGapFillTarget ? { start: new Date(afkGapFillTarget.start), end: new Date(afkGapFillTarget.end), duration_seconds: afkGapFillTarget.duration_seconds } : null}
            activities={afkGapsData?.activities || []}
            sessions={afkGapsData?.sessions || []}
            onClose={() => {
              setAfkFilledGapStarts(prev => afkGapFillTarget ? [...prev, afkGapFillTarget.start] : prev);
              if (afkGapQueue.length > 0) {
                setAfkGapFillTarget(afkGapQueue[0]);
                setAfkGapQueue(q => q.slice(1));
              } else {
                setAfkGapFillTarget(null);
                setAfkGapQueue([]);
              }
            }}
            onFillGap={async (gap, segments) => {
              await fillGapWithSegments(gap, segments, async (activityId, minutes, startedAt, endedAt) => {
                await window.deskflowAPI?.addExternalTime(activityId, minutes, startedAt, endedAt);
              });
              setAfkFilledGapStarts(prev => [...prev, afkGapFillTarget.start]);
              window.dispatchEvent(new CustomEvent('external-data-changed'));
              if (afkGapQueue.length > 0) {
                setAfkGapFillTarget(afkGapQueue[0]);
                setAfkGapQueue(q => q.slice(1));
              } else {
                setAfkGapFillTarget(null);
                setAfkGapQueue([]);
              }
            }}
            zClass="z-[10000]"
          />

          {/* ── Smart Fill Modal (replaces old GapFillDrawer) ── */}
          <GapFillModal
            open={!!smartFillGaps && smartFillGaps.length > 0}
            gap={smartFillGaps && smartFillGaps.length === 1 ? smartFillGaps[0] : null}
            multiGaps={smartFillGaps && smartFillGaps.length > 1 ? smartFillGaps : undefined}
            activities={smartFillActivities}
            sessions={smartFillSessions}
            onClose={() => { setSmartFillGaps(null); }}
            onFillGap={async (gap, segments) => {
              await fillGapWithSegments(
                gap,
                segments,
                async (activityId, minutes, startedAt, endedAt) => {
                  await window.deskflowAPI?.addExternalTime(activityId, minutes, startedAt, endedAt);
                }
              );
              // Mark **only the gap that just got filled** (not the whole smartFillGaps list)
              const startKey = gap.start.toISOString();
              if (smartFillSource === 'afk') {
                setAfkFilledGapStarts(prev => [...prev, startKey]);
              } else if (smartFillSource === 'sleep') {
                setSleepFilledGapStarts(prev => [...prev, startKey]);
              }
              window.dispatchEvent(new CustomEvent('external-data-changed'));
              fetchGaps();
            }}
            zClass="z-[10000]"
          />

          {/* ── Manual Time Assign Modal ── */}
          <ManualAssignModal
            open={showManualAssign}
            onClose={() => setShowManualAssign(false)}
            onChanged={() => { fetchGaps(); }}
          />

          {/* Global Pair Phone Modal (accessible from any page) */}
          {pairPhoneModal && (
            <PairPhoneModal
              terminalId={pairPhoneModal.terminalId}
              terminalLabel={pairPhoneModal.label}
              onClose={() => setPairPhoneModal(null)}
            />
          )}

          {/* Global Command Palette — ⌘K / Ctrl+K navigation search */}
          <GlobalSearchCommandPalette
            isOpen={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onNavigate={(item) => {
              setPaletteOpen(false);
              // Title bar settings — fire a custom event for the TitleBar component to pick up
              if (item.id === 'titlebar-settings') {
                window.dispatchEvent(new CustomEvent('open-titlebar-settings'));
                return;
              }
              // Use deepNav so sub-tabs switch and the page scrolls to the exact section.
              navigateTo(
                { route: item.route, tab: item.tab, section: item.section },
                navigate,
              );
              // After navigation + tab switch, scroll to the anchored section.
              if (item.section) {
                const tryScroll = (attempts: number) => {
                  if (attempts <= 0) return;
                  if (!scrollToSection(item.section!)) {
                    setTimeout(() => tryScroll(attempts - 1), 200);
                  }
                };
                setTimeout(() => tryScroll(8), 250);
              }
            }}
          />

          {/* Find & Scope bar — Ctrl+F / ⌘F (page scope) or the sidebar
              magnifier (all scope). Live find + indexed search, user-placed. */}
          <NativeFindOverlay
            open={nativeFindOpen}
            onClose={() => setNativeFindOpen(false)}
            initialScope={findScope}
            currentPageId={currentPageId}
            onSelect={handleSmartSearchSelect}
          />
          {DEV_TRIGGER_ENABLED && (
            <DevTriggerPanel
              open={devTriggerOpen}
              onClose={() => setDevTriggerOpen(false)}
              triggers={devTriggers}
              onFire={(id) => { const t = devTriggers.find(x => x.id === id); t?.fire?.(); }}
              onPrepAndFire={(id) => { const t = devTriggers.find(x => x.id === id); t?.prepAndFire?.(); }}
              hasPrep={(id) => !!devTriggers.find(x => x.id === id)?.prepAndFire}
              prepLabel={(id) => devTriggers.find(x => x.id === id)?.prepLabel?.() || 'Prep+Fire'}
              devSleepInject={devSleepInject}
              setDevSleepInject={setDevSleepInject}
              devSleepDetectionResult={devSleepDetectionResult}
              devPreviewGaps={devPreviewGaps}
              devDetectedGaps={devDetectedGaps}
              devAfkInject={devAfkInject}
              setDevAfkInject={setDevAfkInject}
              devGapsInject={devGapsInject}
              setDevGapsInject={setDevGapsInject}
              devAfkQueueView={devAfkQueueView}
              runSleepDetectionInject={runSleepDetectionInject}
              previewAdjacentGapsInject={previewAdjacentGapsInject}
              confirmSleepInject={confirmSleepInject}
              injectAfkEntry={injectAfkEntry}
              detectGapsInject={detectGapsInject}
              fillSleepGapsInject={fillSleepGapsInject}
              fillAfkGapsInject={fillAfkGapsInject}
              dismissAllDev={dismissAllDev}
            />
          )}
        </div>
      </div>
      </div>
      <TutorialOverlay />
    </div>
    </TutorialProvider>
    </VoiceProvider>
  );
}

// Pinned todo popup entry: the popup window loads the same bundle at
// hash route #/mini-todo. Branch here — before App's hooks run — so the
// popup renders ONLY the mini page (no shell, sidebar, or data polling).
function AppRoot() {
  if (typeof window !== 'undefined' && window.location.hash.startsWith('#/mini-todo')) {
    return <TodoMiniPage />;
  }
  return <App />;
}

export default AppRoot;

