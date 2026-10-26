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
import { HaloInAppMount } from './features/halo/HaloInAppMount';
import { FloatingDictation } from './features/stt/FloatingDictation';
import { useIslandLane } from './features/halo/islandFootprint';
import { format as dateFormat } from 'date-fns';
import SettingsPage from './pages/SettingsPage';
import TranscriptPage from './pages/TranscriptPage';
import StatsPage from './pages/StatsPage';
import BrowserActivityPage from './pages/BrowserActivityPage';
import ProductivityPage from './pages/ProductivityPage';
import ActivityPage from './pages/ActivityPage';
import ProfilerPage from './pages/ProfilerPage';
import IDEProjectsPage from './pages/IDEProjectsPage';
import IDEHelpPage from './pages/IDEHelpPage';
import TutorialPage from './pages/TutorialPage';
import { LearnPage } from './components/learn/LearnPage';
import GuidePage from './pages/GuidePage';
import GoalsPage from './pages/GoalsPage';
import GoldPage from './features/warmth/gold/GoldPage';
import LabsPage from './pages/LabsPage';
import TimeToolsPage from './pages/TimeToolsPage';
import PenguinConsole from './terminal/App';
import ExternalPage from './pages/ExternalPage';
import RankingsPage from './pages/RankingsPage';
import FocusPage from './pages/FocusPage';

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
import { locateHit } from './lib/findLocate';
import MissedTimePanel from './components/MissedTimePanel';
import { PairPhoneModal } from './components/PairPhoneModal';
import { VoiceProvider } from './context/VoiceContext';
import { getDateRange } from './lib/dateRange';
import type { Period } from './lib/dateRange';
import {
  getAfkPrefs,
  afkThresholdMs,
  shouldPromptForAbsence,
  absenceHasHeld,
  isPassiveCategory,
  defaultsToNotAfk,
  type AfkPrefs,
} from './lib/afk';
import { stopwatch, startStopwatchDriver } from './lib/stopwatchStore';
import { ClockDropdown } from './components/ClockDropdown';
import { useNow } from './lib/timeStore';
import {
  getSleepWindow,
  isWithinSleepWindow,
  shouldDeferToSleep,
  SLEEP_WINDOW_CHANGED_EVENT,
  type SleepWindowPrefs,
} from './lib/sleepWindow';
import GlobalSearchCommandPalette from './components/GlobalSearchCommandPalette';
const RewindNav = lazy(() => import('./features/rewind-nav/RewindNav'));
// Agent dashboard is disabled - file incomplete

// Lazy load OrbitSystem - it's heavy and should only load when needed
const OrbitSystem = lazy(() => import('./components/OrbitSystem').then(module => ({ default: module.default })));

// Life page combines Covenant (commitments/streaks) and Memories (photo/video
// collage) under a single tabbed page — warm clay/sage/amber/sky palette
const LifePage = lazy(() => import('./features/warmth/LifePage'));

// Agentic System page (agent comms + session groups + context brain)
const AgenticSystemPage = lazy(() => import('./pages/AgenticSystemPage'));

// Terminal Workspace + Simple Terminal.
//
// These were static imports, which meant ~5.6k lines of TerminalPage plus the
// ~4.6k-line workforce scene cluster were parsed and evaluated on EVERY app
// start, whether or not the user ever opened /terminal. That is the bulk of
// the "takes forever to open" symptom: the cost was being paid at boot, not at
// navigation. Lazy moves it to first navigation, behind a <Suspense> that
// already exists in this tree (every other lazy page above uses the same
// pattern), so the route now costs nothing until it is asked for.
const TerminalPage = lazy(() => import('./pages/TerminalPage'));
const SimpleTerminalPage = lazy(() => import('./pages/SimpleTerminalPage'));

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
import { TrackingTimeDialog } from './components/TrackingTimeDialog';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';

// DEBUG: Global hashchange listener
window.addEventListener('hashchange', (e) => {
  console.log('[HASHCHANGE]', e.oldURL, '?', e.newURL);
});

/* ── Top-bar pills: period + Focus/Total time mode ─────────────────────────
   Ten pills that used to be ten inline template strings, with three measured
   defects in light mode:

   1. The SELECTED pill was `bg-zinc-800`, which in light resolves to a fill
      the same colour as the card it sits on — measured 1.0:1, i.e. the user
      could not see which period was active.
   2. The unselected pills had no hover surface at all (background stayed
      `rgba(0,0,0,0)` on hover) and no focus ring.
   3. Focus/Total selected with `emerald` and `indigo` in the same control —
      green is a SEMANTIC slot in this system (LAMINAR §2: green is success,
      never an accent), so a two-hue toggle was both a palette violation and
      a contradiction of "one signal hue per surface".

   Selection is now the surface signal hue in both themes
   (`--page-accent-fill`/`--page-accent-on-fill` — the contrast-checked pair,
   white on every one of the 18 light fills). Hover steps are tokens too:
   `--ws-surface-recess-deep` is the only light surface that is a real step
   below the sunken track (the light theme's steps are ~1.07:1 apart, so
   `--ws-surface-hover` would be invisible on this track). */
const PILL_BASE =
  'px-3 py-1.5 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]';
const PILL_ON =
  'bg-zinc-800 text-white light:bg-[var(--page-accent-fill)] light:text-[var(--page-accent-on-fill)]';
const PILL_OFF =
  'text-zinc-400 hover:text-white hover:bg-zinc-800/50 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-surface-recess-deep)]';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, forceRender] = useState(0);
  const now = useNow(1000);

  // Global command palette — ⌘K / Ctrl+K navigation search (app-wide)
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Rewind overlay (film/classic). Lazily mounted; open is driven by the mode setting.
  const [rewindOpen, setRewindOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // The navigation-mode setting decides which overlay Ctrl+K opens. Reading
        // it here (not in state) means flipping the setting takes effect on the
        // very next keypress with no stale-mode window.
        let mode: string = 'classic'
        try { mode = JSON.parse(localStorage.getItem('rewind:prefs:v1') || '{}').mode || 'classic' } catch { mode = 'classic' }
        // MUTUALLY EXCLUSIVE. These used to be two independent toggles, so if the
        // classic palette was already open and you pressed Ctrl+K again in film
        // mode, Rewind opened ON TOP of the still-open palette and you saw both at
        // once. Whichever one we open, the other is force-closed.
        if (mode === 'film') {
          setRewindOpen(prev => !prev)
          setPaletteOpen(false)
          return
        }
        setPaletteOpen(prev => !prev)
        setRewindOpen(false)
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

  // Ctrl+F / ⌘F opens the find-in-page bar (subpage scope) anywhere in the app.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== 'f') return;
      const el = e.target as HTMLElement;
      // Only defer to the find bar's own input (where Ctrl+F refocuses the
      // existing bar). Everywhere else Ctrl+F must open the bar, even when
      // focus sits in a page input/textarea — otherwise it can never be
      // reopened once it has been closed.
      if (el?.dataset?.dfFindInput) return;
      e.preventDefault();
      setFindScope('subpage');
      setNativeFindOpen(true);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

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

  /**
   * Result click / Enter target.
   *
   * The previous version failed SILENTLY in three separate ways:
   *   1. it scrolled with scrollToSection(hit.section), which queries
   *      `[data-section="<value>"]` — but auto-indexed segments store a card
   *      TITLE in `section`, not an anchor value, so the query never matched;
   *   2. its same-page fallback used document.getElementById(hit.id), assuming
   *      segment ids were DOM ids. Auto ids look like `auto:settings:c:5`, so
   *      this was always null and same-page clicks did nothing at all;
   *   3. it only did anything for cross-page hits.
   *
   * locateHit finds the real element (data-df-locator -> text probe), scrolls it
   * to centre and flashes it, retrying while the target route mounts. NOTE:
   * another agent reverted this file once already and silently restored the old
   * handler, which is why clicks navigated but never scrolled — if that symptom
   * returns, check that `locateHit` is still imported and called here.
   */
  const handleSmartSearchSelect = useCallback((hit: SearchHit) => {
    if (hit.pageId !== currentPageId) {
      const route = resolvePageRoute(hit.pageId);
      // Never drop the click on the floor for an unregistered page id.
      navigateTo({ route: route?.route ?? `/${hit.pageId}`, tab: hit.section ? route?.tab : undefined }, navigate);
    }
    locateHit(hit);
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

  // ── The stopwatch driver ────────────────────────────────────────────────
  // The stopwatch is a MODULE-level store (lib/stopwatchStore.ts) and its
  // one-second republish interval used to live inside DashboardPage. Because
  // App.tsx renders `<Routes key={location.pathname}>`, leaving the dashboard
  // tore that interval down: the timer froze on every other route, and coming
  // back restarted it as if it were new. Starting it here — once, for the whole
  // app — is what makes the dashboard hero and the sidebar rail show the same
  // running number on every page.
  useEffect(() => startStopwatchDriver(), []);

  // Is there a foreground window to time? App owns the foreground app for the
  // app's whole lifetime (heartbeat + foreground-change), so it is the single
  // writer for this flag rather than the dashboard, which is not always mounted.
  useEffect(() => {
    stopwatch.setHasRealApp(!!currentApp);
  }, [currentApp]);
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
      window.deskflowAPI.getExternalActivities().then((activities: any) => {
        // Guard the ARRAY, not just the promise: this handler can resolve with a
        // non-array, and `.length`/`.map` on that throws inside a .then with no
        // .catch, which surfaces as an unhandled rejection rather than a stack.
        const rows: any[] = Array.isArray(activities) ? activities : [];
        console.log('[DeskFlow] Loaded external activities:', rows.length);
        // Map to expected format for DashboardPage
        const mapped = rows.map((a: any) => ({
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
        window.deskflowAPI.getExternalActivities().then((activities: any) => {
          const rows: any[] = Array.isArray(activities) ? activities : [];
          const mapped = rows.map((a: any) => ({
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

        // A window switch does NOT touch the stopwatch. It used to be a
        // one-line-looking `setElapsedTime(0)` here that the sidebar rendered
        // directly, which is exactly why "the sidebar just resets the stopwatch
        // for no reason": every alt-tab, every notification, every dev-tools
        // window. `elapsedTime` is still reset because it is the PER-WINDOW
        // session counter used for activity-log durations below — that is what
        // it is for. The number on screen comes from lib/stopwatchStore now.
        
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
          // The main process marks whether this number is real device input.
          // When it is, it is authoritative — including when it is 0.
          if (data.inputIdleAvailable === true) {
            systemInputIdleAvailableRef.current = true;
            systemInputIdleSecondsRef.current = data.systemIdleSeconds;
          } else {
            systemInputIdleAvailableRef.current = false;
          }
          // This heartbeat is the ONE signal that is alive for the whole app
          // lifetime, on every route. The stopwatch uses it as its presence
          // feed, so the timer advances identically no matter which page is
          // mounted — previously the republish interval lived in DashboardPage,
          // so the readout froze the moment you navigated away.
          // A changing foreground window title means the user is typing
          // SOMEWHERE, even if not here. Without this the renderer assumes
          // anyone working in another app is away.
          if (typeof data.foregroundIdleSeconds === 'number') {
            foregroundQuietRef.current = data.foregroundIdleSeconds;
          }
          // A changing foreground title is a WEAK activity signal and must NOT
          // reset the input clock — see lastForegroundActivityRef. Conflating
          // the two is what made AFK stop firing whenever a chat app or music
          // player rewrote its title.
          if (typeof data.foregroundTitle === 'string' && data.foregroundTitle !== lastForegroundTitleRef.current) {
            lastForegroundTitleRef.current = data.foregroundTitle;
            lastForegroundActivityRef.current = Date.now();
          }
          if (typeof data.foregroundActiveIdleSeconds === 'number') {
            lastForegroundActivityRef.current = Date.now() - data.foregroundActiveIdleSeconds * 1000;
          }
          if (data.systemIdleSeconds * 1000 < afkIdleMs) stopwatch.touch();
          // Auto-resume from idle if system idle drops below threshold (user resumed activity)
          if (idleRef.current && effectiveIdleSeconds() * 1000 < afkIdleMs) {
            console.log('[DeskFlow] System idle dropped - resuming tracking');
            setIsIdle(false);
            setIsTracking(true);
            setSessionStart(new Date());
            idleCooldownRef.current = Date.now() + 12000;
            // MUST tell the main process too. This path previously relied on
            // main's ungated auto-resume; now that only an AFK pause may be
            // auto-resumed, forgetting this call can leave main paused after
            // the renderer has already resumed.
            window.deskflowAPI?.setTracking?.(true).catch(console.error);
            idleReturnFnRef.current();
          }
        }
      });
    }

    // Listen for browser tracking live events
    if (window.deskflowAPI && typeof window.deskflowAPI.onBrowserTrackingEvent === 'function') {
      window.deskflowAPI.onBrowserTrackingEvent((data) => {
        // SIMPLE CHECK: Only track website if the current foreground app is the tracking browser
        const currentApp = currentForegroundAppRef.current;
        
        // If current app is NOT the tracking browser, skip
        // Uses process name mapping to handle brand-name vs executable-name mismatches
          // Test the FULL detected list. `isAppMatchingBrowserRenderer` already
          // accepts string | string[]; it was only ever handed the first entry, so a
          // second browser running the extension never matched.
          const candidates = trackingBrowsersRef.current;
          if (!candidates.length || !currentApp || !isAppMatchingBrowserRenderer(currentApp, candidates)) {
            return; // Not on a browser with the extension - don't log website
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
  // The full detected list. `trackingBrowser` is only browsersWithExtension[0],
  // so a second browser with the extension (e.g. Zen alongside Chrome) never
  // matched, and its websites were silently dropped.
  const trackingBrowsersRef = useRef<string[]>([]);
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
    trackingBrowsersRef.current = trackingBrowsers || [];
  }, [trackingBrowsers]);

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
  const [sleepFilledGapStarts, setSleepFilledGapStarts] = useState<string[]>([]);
  /**
   * ONE queue for every "explain this gap" prompt.
   *
   * There used to be four separate consumers of a gap-filling modal — the sleep
   * popup, the AFK prompt, a smart-fill path, and the External page — each with
   * its own target/queue/filled list and its own modal instance. They could
   * stack on top of each other at `z-[10000]` with no coordination, and the
   * modal they shared had no split-lock while the AFK prompt did.
   *
   * A gap is just an absence, and `AfkPromptModal` already knows how to explain
   * an absence, so every entry point now pushes onto this one queue and a single
   * `AfkPromptModal` in gap mode drains it.
   */
  interface GapFillRowShape {
    id: string;
    start: Date;
    end: Date;
    duration_seconds: number;
  }
  const [gapFillQueue, setGapFillQueue] = useState<Array<{
    id: string;
    start: Date;
    end: Date;
    duration_seconds: number;
  }>>([]);
  const [gapFillSource, setGapFillSource] = useState<'afk' | 'sleep' | 'external'>('external');
  const [gapFillActivities, setGapFillActivities] = useState<any[]>([]);

  /**
   * Normalise a gap into the ONE shape the rest of the app consumes.
   *
   * Producers disagree, and the disagreement was silently fatal:
   *   - computeAdjacentGaps returns ISO STRINGS and `durationSeconds`
   *   - the inject paths pass `new Date(...)` objects and `duration_seconds`
   * `gap.start.getTime()` therefore threw on the sleep path only, and
   * `duration_seconds` was `undefined` there, so even a non-crashing sleep gap
   * would have had no duration.
   *
   * Coercing HERE means no caller has to remember which convention it holds, and
   * the next producer cannot reintroduce it.
   */
  const enqueueGapFill = useCallback(
    (gaps: Array<{
      start: Date | string;
      end: Date | string;
      duration_seconds?: number;
      durationSeconds?: number;
    }>, source: 'afk' | 'sleep' | 'external') => {
      if (!gaps || gaps.length === 0) return;
      setGapFillSource(source);
      setGapFillQueue(prev => {
        const stamp = Date.now();
        const added = gaps.map((g, i) => {
          const start = g.start instanceof Date ? g.start : new Date(g.start);
          const end = g.end instanceof Date ? g.end : new Date(g.end);
          // Either key, and fall back to the span itself rather than `undefined`:
          // a gap with no duration cannot be rendered, saved or bulk-filled.
          const declared = g.duration_seconds ?? g.durationSeconds;
          const duration_seconds =
            typeof declared === 'number' && Number.isFinite(declared)
              ? declared
              : Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
          if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
            console.warn('[App] dropping unparseable gap', g);
            return null;
          }
          return { id: `${source}-gap-${stamp}-${i}`, start, end, duration_seconds };
        }).filter(Boolean) as GapFillRowShape[];
        if (added.length === 0) {
          console.warn(`[App] ${source}: all ${gaps.length} gap(s) were unusable`);
        }
        return [...prev, ...added];
      });
    },
    [],
  );
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
      // Reads the CONFIGURED window. This used to be `hour >= 21 || hour < 10`,
      // hardcoded, so a user who set 01:00 -> 09:00 still got night-time
      // behaviour on return at 23:00 — the setting looked broken from here.
      if (!isWithinSleepWindow(now)) return;
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

      // Fell asleep, NOT device-off. Recording the session from device-off made the app
      // measure the "before sleep" gap back to the laptop being put away — which IS
      // the last moment of use — so that gap was always 0-2 minutes while the real
      // one (last use -> actually falling asleep) ran 75-192 minutes and was never
      // offered. The device-off moment is not lost: it lives in
      // device_off_to_sleep_seconds.
      const sleepStartMs = fellAsleep.getTime();
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
              sleepStartIso: fellAsleep.toISOString(),
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
  // The AFK threshold used to be a bare `useState(5)` here, which meant the
  // detector that actually raises the "while you were away" prompt ignored the
  // AFK Behaviour setting completely — you could set 30 minutes in Settings and
  // still be asked after 5. These two are read from the same modules the
  // Settings page writes, and re-read whenever the user changes them.
  const [afkPrefs, setAfkPrefsState] = useState<AfkPrefs>(() => getAfkPrefs());
  const [sleepWindow, setSleepWindowState] = useState<SleepWindowPrefs>(() => getSleepWindow());
  // Infinity when AFK detection is switched off, so the comparison below reads
  // "never idle" without a second flag at every call site.
  const afkIdleMs = afkThresholdMs(afkPrefs);
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
  const [afkFilledGapStarts, setAfkFilledGapStarts] = useState<string[]>([]);
  const [showTrackingTime, setShowTrackingTime] = useState(false);
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
  const [timerBehavior, setTimerBehavior] = useState<{ neutralAction: 'pause' | 'reset' | 'ignore'; distractingAction: 'pause' | 'reset' | 'ignore' }>({ neutralAction: 'pause', distractingAction: 'reset' });
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
  
  /**
   * Put tracking back after the user tells us they were not actually away.
   *
   * AFK detection deliberately calls `setTracking(false)` so the absence becomes
   * a real hole in the logs that gap detection can find. Every path back out of
   * the prompt therefore has to undo it, otherwise one dismissal silently stops
   * all tracking. Declining ("I wasn't AFK") is the clearest case of that; this
   * is also called from the save and dismiss paths so no exit leaves it off.
   */
  const resumeTrackingAfterAfk = useCallback(() => {
    pendingIdleRangeRef.current = null;
    setIsIdle(false);
    setIsTracking(true);
    setSessionStart(new Date());
    idleCooldownRef.current = Date.now() + 12000;
    if (window.deskflowAPI?.setTracking) {
      window.deskflowAPI.setTracking(true).catch(err =>
        console.error('[DeskFlow] failed to resume tracking after AFK prompt:', err),
      );
    }
  }, []);

  const handleAfkConfirm = useCallback(async (segments: { activityId: string; startedAt: string; endedAt: string }[]): Promise<boolean> => {
    console.log('[DeskFlow] handleAfkConfirm called with', segments.length, 'segments');

    // Branch on the PAYLOAD, not on "it didn't throw".
    //
    // This handler used to `await` the write and then fall through, returning
    // `undefined`. The modal does `const ok = await onConfirm(result)` and treats
    // falsy as failure, so EVERY successful save rendered "Couldn't save. Your
    // answer was not recorded — try again." — and because that path returns
    // early, `setSaved(true)`, `resetAfterAfkFill()` and the adjacent-gaps panel
    // never ran either. Answering the prompt was effectively broken.
    //
    // `create-external-sessions-batch` also reports rejection by RETURNING
    // {success:false} rather than throwing, so a try/catch alone would still let
    // a rejected write claim success.
    if (segments.length === 0) {
      console.error('[DeskFlow] AFK save rejected: no segments');
      return false;
    }
    if (!window.deskflowAPI?.createExternalSessionsBatch) {
      console.error('[DeskFlow] AFK save rejected: createExternalSessionsBatch unavailable');
      return false;
    }
    try {
      const res: any = await window.deskflowAPI.createExternalSessionsBatch(segments);
      if (res && res.success === false) {
        console.error('[DeskFlow] AFK save rejected by main:', res.error ?? res);
        return false;
      }
    } catch (err) {
      console.error('[DeskFlow] createExternalSessionsBatch error:', err);
      return false;
    }

    pendingIdleRangeRef.current = null;
    // The user answered, so they were here. Resume tracking before anything else
    // so no exit path from this prompt can leave the app untracked.
    resumeTrackingAfterAfk();
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
    return true;
  }, [afkPromptQueue, externalActivities]);
  
  /**
   * Write ONE composition across many gaps, rescaled to each length.
   *
   * Rows are built here rather than by the modal so the timestamps are derived
   * once, from each gap's own start, with the cursor advancing across EVERY
   * segment. Skipping the cursor over a blank segment shifts every later segment
   * earlier and silently leaves the tail of the gap unfilled — which then shows
   * up again in gap detection as if it were never answered.
   */
  const handleBulkFill = useCallback(async (
    gaps: Array<{ start: string; end: string; duration_seconds: number }>,
    segments: Array<{ activityId: string; minutes: number }>,
  ): Promise<void> => {
    const filled = segments.filter((sg) => sg.activityId);
    if (!gaps.length || !filled.length || !window.deskflowAPI?.createExternalSessionsBatch) return;

    const rows: Array<{ activityId: string; startedAt: string; endedAt: string }> = [];
    for (const gap of gaps) {
      const gapEndMs = new Date(gap.end).getTime();
      let cursor = new Date(gap.start).getTime();
      for (const sg of filled) {
        const end = cursor + Math.max(60, Math.round(sg.minutes)) * 60_000;
        if (end > gapEndMs) break;                 // never spill past the gap
        rows.push({
          activityId: sg.activityId,
          startedAt: new Date(cursor).toISOString(),
          endedAt: new Date(end).toISOString(),
        });
        cursor = end;                              // advance for EVERY segment
      }
    }
    if (!rows.length) return;
    try {
      const res: any = await window.deskflowAPI.createExternalSessionsBatch(rows);
      if (res && res.success === false) {
        console.error('[DeskFlow] bulk fill rejected:', res.error);
        return;
      }
      console.log(`[DeskFlow] bulk filled ${rows.length} segments across ${gaps.length} gaps`);
    } catch (err) {
      console.error('[DeskFlow] bulk fill failed:', err);
      return;
    }
    // Mark them filled so the parent's list updates, then refresh the dashboard.
    setAfkFilledGapStarts(prev => [...prev, ...gaps.map((g) => g.start)]);
    window.dispatchEvent(new CustomEvent('external-data-changed'));
  }, []);

  const handleAfkDismiss = useCallback(() => {
    console.log('[DeskFlow] handleAfkDismiss called');
    resumeTrackingAfterAfk();
    setAfkPromptQueue(prev => prev.slice(1));
    window.dispatchEvent(new CustomEvent('external-data-changed'));
  }, [resumeTrackingAfterAfk]);


  // Persist AFK queue to disk so it survives app restart
  useEffect(() => {
    if (window.deskflowAPI?.saveAfkQueue) {
      window.deskflowAPI.saveAfkQueue(afkPromptQueue).catch(() => {});
    }
  }, [afkPromptQueue]);

  // Listen for gap-drawer open event — routes into the single gap-fill prompt
  useEffect(() => {
    const handler = async () => {
      try {
        const api = (window as any).deskflowAPI;
        const [gaps, ext] = await Promise.all([
          api?.detectUsageGaps?.({ period: 'week', minGapMinutes: 5 }) || [],
          api?.getExternalActivities?.() || [],
        ]);
        // Only REAL `external_activities` rows are offered.
        //
        // This used to synthesise `'app:'+name` and `'ext:'+id` ids for the
        // picker. Those strings were then written straight into
        // `external_sessions.activity_id`, which is an INTEGER column with a
        // foreign key — SQLite cannot convert them, so the rows joined to no
        // activity and vanished from every per-activity total. The `app:`
        // entries had no backing row at all.
        const activities = (Array.isArray(ext) ? ext : [])
          .filter((a: any) => a.type !== 'sleep')
          .map((a: any) => ({ ...a, id: String(a.id) }));
        const fillGaps = (Array.isArray(gaps) ? gaps : []).map((g: any, i: number) => ({
          id: `gap-${i}`,
          start: new Date(g.start),
          end: new Date(g.end),
          duration_seconds: g.durationSeconds,
        }));
        // Same queue as every other gap source.
        enqueueGapFill(fillGaps as any, 'external');
        setGapFillActivities(activities as any);
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

  // External page hands us the specific gap(s) the user picked, rather than
  // mounting a second gap UI of its own.
  useEffect(() => {
    const handler = async (e: Event) => {
      const gaps = (e as CustomEvent<{ gaps?: any[] }>).detail?.gaps;
      if (!Array.isArray(gaps) || gaps.length === 0) return;
      enqueueGapFill(gaps, 'external');
      try {
        const acts = await window.deskflowAPI?.getExternalActivities?.();
        setGapFillActivities((acts || []).filter((a: any) => a.type !== 'sleep'));
      } catch { /* the picker just shows fewer options */ }
    };
    window.addEventListener('enqueue-gap-fill', handler as EventListener);
    return () => window.removeEventListener('enqueue-gap-fill', handler as EventListener);
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
  /**
   * Last genuine pointer position, for AFK detection.
   *
   * THIS REF MUST LIVE AT COMPONENT SCOPE. It previously sat INSIDE the
   * activity-listener `useEffect`, which is an illegal hook call — React throws
   * "Minified React error #321 / Invalid hook call" and the whole screen fails to
   * mount. A `useRef` inside `useEffect` also has the wrong semantics even if it
   * were tolerated: it would be a fresh ref on every effect run, so the
   * stationary-cursor filter below would reset instead of remembering.
   */
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  // Use refs to track latest state values for the activity handler
  const idleRef = useRef(isIdle);
  const trackingRef = useRef(isTracking);
  const systemIdleSecondsRef = useRef(0); // OS-level idle seconds (from main process)
  // True when the heartbeat's idle value came from the Linux evdev watcher —
  // i.e. real device input, in every app — rather than from window focus or a
  // foreground-window guess. That distinction is the whole AFK fix: a value of
  // 0 from the input clock means "you just touched the machine", while a value
  // of 0 from the dead Linux OS API means "I cannot measure anything".
  const systemInputIdleAvailableRef = useRef(false);
  const systemInputIdleSecondsRef = useRef(0);

  /**
   * Fallback idle clock, measured from real input events in THIS window.
   *
   * `powerMonitor.getSystemIdleTime()` returns 0 FOREVER on Linux — verified by
   * running it against this box for 40 seconds of complete idleness and reading
   * 0 on every tick. Because the AFK detector compared `systemIdleSecondsRef`
   * against the threshold, `0 > 300000` was never true, so AFK could never be
   * detected no matter how long you were away. The whole prompt was dead code on
   * this platform, which is why none of the threshold fixes appeared to help.
   *
   * The renderer DOES receive real input events, so we derive idle from those and
   * take whichever clock reports MORE idleness. On macOS/Windows the OS value
   * wins and keeps working as before; on Linux this is the only signal there is.
   *
   * Known limitation: while DeskFlow is not focused it receives no input events,
   * so this can read as idle while you type in another app. That is precisely
   * the case the OS clock covers on the platforms where it works.
   */
  const lastUserInputAtRef = useRef<number>(Date.now());
  /* Declared here, next to the ref it is compared against. It was READ in four
     places (the powerMonitor foreground handler and two idle computations) but
     never declared anywhere in the tree, so the main process pushed a
     foreground-active heartbeat into a bare global and threw
     `ReferenceError: lastForegroundActivityRef is not defined` roughly every
     1.5s. That killed the whole renderer, not just the AFK clock. */
  const lastForegroundActivityRef = useRef<number>(Date.now());
  const lastForegroundTitleRef = useRef<string>('');
  // Seconds since the foreground window last changed, measured in main across
  // ALL windows. This is the only system-wide activity signal Linux gives us.
  const foregroundQuietRef = useRef<number>(0);
  const currentCategoryRef = useRef<string | null>(null); // Tracked app category for passive-active check
  const idleStartRef = useRef<number | null>(null); // When idle began (for AFK duration)
  const idleReturnFnRef = useRef<() => void>(() => {}); // Updated below to avoid stale closures
  
  // Update refs when state changes
  useEffect(() => {
    idleRef.current = isIdle;
    trackingRef.current = isTracking;
    // Tell main WHY tracking is paused. Only an AFK pause may be auto-resumed
    // when device input returns; a manual pause must stay paused. This is the
    // single place that owns the flag, so every resume path clears it and the
    // AFK entry sets it, without duplicating the call in a dozen handlers.
    try { window.deskflowAPI?.setAfkPaused?.(isIdle); } catch { /* preload older than this change */ }
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

  // Same trick for the AFK prefs. `idleReturnFnRef.current` is installed ONCE
  // with an empty dep array, so reading the `afkPrefs` state directly inside it
  // would pin the values that were current at mount — changing a setting in
  // Settings would save to localStorage and then keep using the old numbers
  // until the app restarted. That is the exact "the setting does nothing" bug
  // this whole feature kept hitting.
  const afkPrefsStateRef = useRef(afkPrefs);
  afkPrefsStateRef.current = afkPrefs;

  // Same reason: the sleep-handoff fallback below runs on a timer created inside
  // a `[]`-deps closure, so reading the state directly would compare against
  // mount-time values and the "has the sleep flow taken over?" test would always
  // answer "no" (or always "yes"), i.e. the safety net could not work.
  /**
   * Idle seconds, from whichever clock can actually SEE the user.
   *
   * The renderer only receives input addressed to its own window, so its own
   * clock keeps climbing while you type in a completely different app. Trusting
   * it alone produced a constant stream of false "you were away" prompts — the
   * bug that made AFK look broken in the other direction.
   *
   * Three rules, in order:
   *   1. If the OS clock works (macOS/Windows) it is authoritative.
   *   2. If our window is hidden we cannot observe input at all, so we report
   *      only what the OS says rather than inventing idleness.
   *   3. Otherwise use our own clock, but a change in the FOREGROUND WINDOW TITLE
   *      (published by main, and updated as you type in a browser/editor/terminal)
   *      counts as activity. That is what distinguishes "away from the desk" from
   *      "busy in another window" on Linux.
   */
  const effectiveIdleSeconds = useCallback((): number => {
    // DEVICE-WIDE INPUT IS AUTHORITATIVE WHEN AVAILABLE.
    //
    // Every signal below this line answers "has anything changed in a window I
    // can see?" — which is not the question. It made AFK fire while you worked
    // in a static window and refuse to clear until you clicked RHEO. The evdev
    // clock answers the real question: seconds since a human last touched the
    // keyboard, mouse, touchpad or touchscreen, anywhere. When it exists, use
    // it and nothing else.
    if (systemInputIdleAvailableRef.current) {
      return Math.max(0, systemInputIdleSecondsRef.current || 0);
    }
    const os = typeof systemIdleSecondsRef.current === 'number' ? systemIdleSecondsRef.current : 0;
    // A working OS clock is authoritative — macOS/Windows.
    if (os > 0) return os;
    // Hidden: we receive no input events at all, so we cannot claim idleness.
    if (typeof document !== 'undefined' && document.hidden) return 0;

    const renderer = Math.max(0, (Date.now() - lastUserInputAtRef.current) / 1000);
    // We have focus: our own clock sees every keystroke, so trust it fully. The
    // foreground signal is deliberately NOT consulted here, or a chat app
    // chattering in the background could hold AFK open forever.
    if (typeof document !== 'undefined' && document.hasFocus()) return renderer;

    // No focus — we are blind to input outside this window, so our own clock
    // would call you AFK for simply working in another app. CAP it by how long
    // the system as a whole has shown no sign of life. While anything is visibly
    // happening (app switch, title rewrite) we report near-zero idle; once the
    // machine stops moving, the cap opens and the threshold is reachable.
    const systemQuiet = Math.max(
      0,
      (Date.now() - Math.max(lastForegroundActivityRef.current, lastUserInputAtRef.current)) / 1000,
    );
    return Math.min(renderer, systemQuiet);
  }, []);

  const showSleepDetectionRef = useRef(showSleepDetection);
  showSleepDetectionRef.current = showSleepDetection;
  const afkPromptQueueRef = useRef(afkPromptQueue);
  afkPromptQueueRef.current = afkPromptQueue;

  // How long to give the sleep flow before raising the AFK prompt anyway.
  const SLEEP_HANDOFF_FALLBACK_MS = 20_000;
  
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

      // Below the configured floor: discard silently, no prompt. Was a
      // hardcoded `elapsedSec < 60` — now `Ask about absences over` in Settings.
      if (!shouldPromptForAbsence(elapsedSec, afkPrefsStateRef.current)) {
        pendingIdleRangeRef.current = null;
        return;
      }

      // If this absence actually overlapped the user's configured sleep window,
      // the SLEEP flow owns it — do not also raise "what were you doing?". The
      // two prompts used to be able to fire for the same hour, which is how the
      // feature came to feel broken. Outside the window this never triggers, so
      // a coffee break at 10am still gets the AFK prompt it deserves.
      if (idleStartMs && shouldDeferToSleep(idleStartMs, nowMs)) {
        console.warn(
          `[DeskFlow] AFK prompt deferred — absence of ${Math.round(elapsedSec / 60)}min is mostly bedtime (${sleepWindow.startHour}:00 → ${sleepWindow.endHour}:00), handing off to the sleep flow. If no sleep prompt appears in ${SLEEP_HANDOFF_FALLBACK_MS / 1000}s this absence will be queued anyway, so it can never be silently dropped.`,
        );
        pendingIdleRangeRef.current = null;
        // SAFETY NET. The sleep popup is raised by main-process events (screen
        // resume, window focus, poll-gap) rather than from here, so deferring on
        // the assumption that it "will take over" can leave the user with NO
        // prompt at all. That is exactly what happened: a 2-hour evening absence
        // deferred, the sleep flow never fired, and the absence vanished. An
        // un-asked question is much worse than a duplicate one, so if the sleep
        // flow has not taken over shortly, the AFK prompt is raised regardless.
        window.setTimeout(() => {
          if (showSleepDetectionRef.current) return;
          if (afkPromptQueueRef.current.some((q) => Math.abs((q.idleStartMs ?? 0) - (idleStartMs ?? -1)) < 1000)) {
            return; // already queued
          }
          console.warn('[DeskFlow] Sleep flow did not take over — raising the AFK prompt anyway.');
          setAfkPromptQueue(prev => [...prev, {
            id: afkQueueIdRef.current++,
            duration: `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`,
            idleStartMs,
            returnMs: nowMs,
            defaultNotAfk: false,
          }]);
        }, SLEEP_HANDOFF_FALLBACK_MS);
        return;
      }

      const duration = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
      const entry: AfkPromptEntry = {
        id: afkQueueIdRef.current++,
        duration,
        idleStartMs,
        returnMs: nowMs,
        // Req 4: moderate idle (1�15m) defaults to "I wasn't AFK"
        // Was hardcoded `elapsedSec <= 15 * 60` — now `Pre-select "I wasn't AFK"
        // for absences up to` in Settings.
        defaultNotAfk: defaultsToNotAfk(elapsedSec, afkPrefsStateRef.current),
      };
      setAfkPromptQueue(prev => [...prev, entry]);
    };
  }, []);
  
  // Set up activity listeners - stable across renders, cleaned up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Track actual user activity (mouse/keyboard) - ALWAYS active to detect return from idle
    /**
     * Mouse MOVEMENT only counts when the pointer genuinely moved.
     *
     * `mousemove` also fires when the element under a perfectly stationary cursor
     * is replaced — which in a live app happens constantly, because the sidebar
     * stopwatch ticks, logs stream in and charts repaint. Those synthetic events
     * refreshed the idle clock forever, so AFK could never be detected while
     * RHEO itself was the focused window. It worked in every OTHER app, which is
     * exactly the symptom: the phantom events come from our own DOM.
     */
    const POINTER_MOVE_MIN_PX = 3;
    const handlePointerMove = (e: MouseEvent) => {
      const last = lastPointerRef.current;
      if (
        last &&
        Math.abs(e.clientX - last.x) < POINTER_MOVE_MIN_PX &&
        Math.abs(e.clientY - last.y) < POINTER_MOVE_MIN_PX
      ) {
        return; // stationary cursor over a repainting DOM: not a person
      }
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      handleActivity();
    };

    const handleActivity = () => {
      if (!isMountedRef.current) return;
      lastUserInputAtRef.current = Date.now();
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
    window.addEventListener('mousemove', handlePointerMove, { capture: true });
    window.addEventListener('mousedown', handleActivity, { capture: true });
    window.addEventListener('keydown', handleActivity, { capture: true });
    window.addEventListener('touchstart', handleActivity, { capture: true });
    window.addEventListener('wheel', handleActivity, { capture: true });
    // 'scroll' DELIBERATELY NOT LISTENED TO. It fires for programmatic scrolling,
    // auto-scroll and scroll anchoring, so a live dashboard repainting under a
    // motionless cursor produced a steady stream of it and reset the idle clock
    // forever. That is why AFK worked in other apps but never while RHEO was the
    // focused window. `wheel` remains: a real scroll gesture is unambiguous.

    // Also listen for window focus/visibility to catch user returning to app
    const handleFocus = () => {
      if (!isMountedRef.current) return;
      lastUserInputAtRef.current = Date.now();
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
      // Coming back to the tab counts as presence, otherwise the very act of
      // alt-tabbing back would still read as idle.
      if (document.visibilityState === 'visible') lastUserInputAtRef.current = Date.now();
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
      window.removeEventListener('mousemove', handlePointerMove, { capture: true });
      window.removeEventListener('mousedown', handleActivity, { capture: true });
      window.removeEventListener('keydown', handleActivity, { capture: true });
      window.removeEventListener('touchstart', handleActivity, { capture: true });
      window.removeEventListener('wheel', handleActivity, { capture: true });
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      isMountedRef.current = false;
    };
  }, []); // Empty deps - this runs once on mount and cleans up on unmount

  /**
   * Live AFK diagnostics on `window.__afkDebug`, refreshed every second.
   *
   * AFK detection has been wrong in BOTH directions at different times: never
   * fired on Linux because the OS idle API returns 0, then fired constantly
   * because the fallback counted time spent in other apps. Guessing which
   * branch was live is what caused both, so the decision inputs are published
   * where they can be read rather than inferred.
   *
   *   console.table(window.__afkDebug())
   */
  useEffect(() => {
    const publish = () => {
      (window as any).__afkDebug = () => ({
        thresholdMinutes: afkPrefsStateRef.current.thresholdMinutes,
        thresholdMs: afkIdleMs,
        osIdleSeconds: systemIdleSecondsRef.current,
        osApiUsable: systemIdleSecondsRef.current > 0,
        // The clock that actually decides on this machine.
        inputIdleAvailable: systemInputIdleAvailableRef.current,
        inputIdleSeconds: systemInputIdleSecondsRef.current,
        rendererIdleSeconds: Math.round((Date.now() - lastUserInputAtRef.current) / 1000),
        foregroundQuietSeconds: foregroundQuietRef.current,
        systemQuietSeconds: Math.round(
          Math.max(0, (Date.now() - Math.max(lastForegroundActivityRef.current, lastUserInputAtRef.current)) / 1000),
        ),
        lastForegroundTitle: lastForegroundTitleRef.current,
        effectiveIdleSeconds: Math.round(effectiveIdleSeconds()),
        wouldFireNow: effectiveIdleSeconds() * 1000 > afkIdleMs,
        branch: typeof document !== 'undefined' && document.hidden
          ? 'hidden -> returns os only'
          : (typeof document !== 'undefined' && document.hasFocus())
            ? 'focused -> trusts renderer clock'
            : 'unfocused -> min(renderer, foregroundQuiet)',
        hasFocus: typeof document !== 'undefined' ? document.hasFocus() : null,
        hidden: typeof document !== 'undefined' ? document.hidden : null,
        isTracking,
        isIdle,
        focusedCategory: currentCategoryRef.current,
        pendingIdleRange: !!pendingIdleRangeRef.current,
      });
    };
    publish();
    const t = setInterval(publish, 1000);
    return () => clearInterval(t);
  });

  // Guard against re-triggering idle within N seconds of returning from idle
  // Prevents the stale heartbeat idle value from causing a second idle detection
  const idleCooldownRef = useRef(0);

  // Keep the detector in step with Settings WITHOUT a restart. Both modules
  // dispatch on write, so changing "Treat as AFK after" or the sleep window in
  // Settings takes effect on the next tick rather than the next launch.
  useEffect(() => {
    const onAfk = (e: Event) => setAfkPrefsState((e as CustomEvent<AfkPrefs>).detail ?? getAfkPrefs());
    const onSleep = (e: Event) =>
      setSleepWindowState((e as CustomEvent<SleepWindowPrefs>).detail ?? getSleepWindow());
    window.addEventListener('afk-prefs-changed', onAfk);
    window.addEventListener(SLEEP_WINDOW_CHANGED_EVENT, onSleep);
    return () => {
      window.removeEventListener('afk-prefs-changed', onAfk);
      window.removeEventListener(SLEEP_WINDOW_CHANGED_EVENT, onSleep);
    };
  }, []);

  // Poll daemon's AFK event queue and populate afkPromptQueue
  // The daemon writes AFK start/end events to ~/.config/RHEO/tracker-afk-events.jsonl
  // We poll this file and convert afk_end events to AfkPromptEntry
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let lastEventId = 0;

    const pollAfkEvents = async () => {
      if (!window.deskflowAPI?.readAfkEvents) return;
      
      try {
        const result = await window.deskflowAPI.readAfkEvents();
        if (!result?.events?.length) return;

        const newEvents = result.events.filter((e: any) => {
          // Simple deduplication by timestamp + type
          const eventId = `${e.type}_${e.timestamp}`;
          return eventId > lastEventId;
        });

        if (newEvents.length === 0) return;

        // Process afk_end events and add to afkPromptQueue
        for (const event of newEvents) {
          if (event.type === 'afk_end' && event.durationMs && event.durationMs >= 60000) {
            // Only prompt for AFK periods >= 1 minute
            const afkStartMs = event.afkStartMs;
            const afkEndMs = event.afkEndMs || event.timestamp ? new Date(event.timestamp).getTime() : Date.now();
            const durationMs = event.durationMs || (afkEndMs - afkStartMs);
            const durationSec = Math.max(1, Math.floor(durationMs / 1000));
            const duration = durationSec < 60 ? `${durationSec}s` : `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
            
            // Check if we already have an entry for this AFK period
            const alreadyQueued = afkPromptQueueRef.current.some((q) => 
              Math.abs((q.idleStartMs ?? 0) - (event.afkStartMs ?? 0)) < 1000
            );
            
            if (!alreadyQueued) {
              setAfkPromptQueue(prev => [...prev, {
                id: afkQueueIdRef.current++,
                duration: durationSec < 60 ? `${durationSec}s` : `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
                idleStartMs: event.afkStartMs,
                returnMs: event.afkEndMs || Date.now(),
                defaultNotAfk: durationSec <= 15 * 60, // default "not AFK" for <= 15 min
              }]);
            }
          }
        }

        // Update last processed event marker
        const maxEventId = newEvents.reduce((max: number, e: any) => {
          const id = `${e.type}_${e.timestamp}`;
          return id > max ? id : max;
        }, lastEventId);
        lastEventId = maxEventId;

        // Clear processed events from the queue to avoid reprocessing
        try {
          await window.deskflowAPI?.clearAfkEvents?.();
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn('[DeskFlow] Failed to poll AFK events:', err);
      }
    };

    interval = setInterval(pollAfkEvents, 5000); // poll every 5 seconds
    return () => clearInterval(interval);
  }, []); // empty deps - runs once on mount

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
        // Was a hardcoded `new Set(['Entertainment','Gaming'])`. Now the user's
        // own list, so "don't call me AFK for Netflix" is a setting.
        const isPassiveActive = isPassiveCategory(currentCategoryRef.current, afkPrefsStateRef.current);
        const idleMs = afkIdleMs; // from AFK Behaviour settings; Infinity when disabled
        const idleSec = effectiveIdleSeconds();
        // Two gates, both required: the absence must clear the threshold AND
        // hold for the configured time. The hold is re-evaluated every tick, so
        // moving the mouse at any point cancels it instantly rather than latching.
        if (!isPassiveActive && idleSec * 1000 > idleMs && absenceHasHeld(idleSec, afkPrefsStateRef.current)) {
          if (!pendingIdleRangeRef.current) {
            // The real start of the absence is `now - systemIdleSeconds`, which
            // the heartbeat already hands us on the line above. It used to be
            // `Date.now() - idleMs`, which BACK-COMPUTES the start from the
            // threshold — so stepping away for 45 minutes with a 5 minute
            // threshold recorded exactly 5 minutes, and the other 40 silently
            // became an untracked gap the user was never asked about.
            const trueIdleMs = Math.max(idleMs, idleSec * 1000);
            pendingIdleRangeRef.current = { idleStart: Date.now() - trueIdleMs, idleEnd: null };
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
  }, [isTracking, elapsedTime, currentApp, sessionStart, afkIdleMs, effectiveIdleSeconds]);

  /**
   * RETURN-FROM-AFK DETECTOR — must keep ticking while auto-tracking is paused.
   *
   * Input inside RHEO already resumes via the activity/focus listeners, and the
   * heartbeat has a best-effort resume path, but neither can see a keystroke in
   * another app when the foreground window never changes. So the AFK state
   * latched until the user clicked RHEO — the exact bug this effect removes.
   *
   * The device input clock drops to ~0 on ANY interaction anywhere, so this
   * one-second check ends the absence without requiring the user to visit the
   * app. `idleReturnFnRef` still decides whether the absence is worth a prompt.
   */
  useEffect(() => {
    if (!isIdle) return;
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      if (Date.now() < idleCooldownRef.current) return;
      // Without a reliable device clock, leave the older return paths intact
      // rather than resuming on a number we cannot trust.
      if (!systemInputIdleAvailableRef.current) return;
      const idleSec = effectiveIdleSeconds();
      if (idleSec * 1000 < afkIdleMs) {
        console.log('[DeskFlow] Device input detected while AFK — resuming without app focus');
        setIsIdle(false);
        setIsTracking(true);
        setSessionStart(new Date());
        idleCooldownRef.current = Date.now() + 12000;
        window.deskflowAPI?.setTracking?.(true).catch(console.error);
        idleReturnFnRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isIdle, afkIdleMs, effectiveIdleSeconds]);

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
    enqueueGapFill([{ start: new Date(now.getTime() - 30 * 60 * 1000), end: now, duration_seconds: 1800 }], 'sleep');
  };
  const devFireAfkGapFill = () => {
    const now = new Date();
    enqueueGapFill([{ start: new Date(now.getTime() - 30 * 60 * 1000), end: now, duration_seconds: 1800 }], 'afk');
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
         enqueueGapFill(fillGaps as any, 'external');
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
               sleepStartIso: fellAsleep.toISOString(), sleepEndIso: wokeUp.toISOString(),
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
       enqueueGapFill(gaps as any, 'sleep');
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
         enqueueGapFill(gaps as any, 'sleep');
       }).catch(() => {});
     }
   };

   const fillAfkGapsInject = () => {
     const entry = afkPromptQueue[0];
     if (entry?.idleStartMs && entry?.returnMs) {
       const gaps = [{ id: 'afk-gap', start: new Date(entry.idleStartMs), end: new Date(entry.returnMs), duration_seconds: Math.round((entry.returnMs - entry.idleStartMs) / 1000) }];
       enqueueGapFill(gaps as any, 'afk');
     }
   };

   const dismissAllDev = () => {
     setShowSleepDetection(false); setSleepDetectionData(null); setSleepModalStep('sleep');
     setSleepFillActivities(null); setSleepFillSessions(null);
     setSleepFilledGapStarts([]);
     setAfkPromptQueue([]); setAfkGapsData(null); setAfkFilledGapStarts([]);
     setGapFillQueue([]); setGapFillSource('external');
     setShowTrackingTime(false); setPairPhoneModal(null); setShowConfirmClear(false);
     setShowConfirmExport(null); setShowSummary(false); setNotifPanelOpen(false);
     setShowWorkspaceWarning(false); setShowUnsavedWarning(false);
     setPaletteOpen(false); setDevForceGapBannerMinutes(null);
     setDevDetectedGaps([]); setDevSleepDetectionResult(null); setDevPreviewGaps([]);
     setDevAfkQueueView([]); setShowGapDrawer(false); setDevTriggerOpen(false);
   };
  const devFireManualAssign = () => setShowTrackingTime(true);
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
  const devFireActivityLogs = () => navigate('/ai?tab=logs');
  const devFireReports = () => navigate('/reports');

  // Trigger definitions for DevTriggerPanel
  const devTriggers = [
    { id: 'sleep-detection', label: 'Sleep Detection Modal', icon: <Bed className="w-4 h-4" />, condition: 'On sleep cycle detection', fire: devFireSleepDetection },
    { id: 'afk-prompt', label: 'AFK Prompt', icon: <Clock className="w-4 h-4" />, condition: 'After AFK period', fire: devFireAfkPrompt },
    { id: 'sleep-gap-fill', label: 'Sleep Gap Fill', icon: <Zap className="w-4 h-4" />, condition: 'When sleep gap needs fill', fire: devFireSleepGapFill },
    { id: 'afk-gap-fill', label: 'AFK Gap Fill', icon: <Zap className="w-4 h-4" />, condition: 'When AFK gap detected', fire: devFireAfkGapFill },
    { id: 'smart-fill', label: 'Smart Fill (gap prompt)', icon: <Brain className="w-4 h-4" />, condition: 'Automatic gap detection', fire: devFireSmartFill },
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
    { id: 'activity-logs', label: 'Activity Logs Tab', icon: <BarChart3 className="w-4 h-4" />, condition: 'Navigate to logs', fire: devFireActivityLogs },
  ];

  /* THE ISLAND LANE — the top bar yields to the Halo pill instead of being covered by it.
   *
   * `useIslandLane` reports the pill's occluding rect as a three-column layout for the row
   * below: [left lane][hole][right lane]. See `features/halo/islandFootprint.ts` for why the
   * numbers come from main rather than from this renderer, and for the clamp that keeps a pill
   * wider than the bar from overflowing the grid.
   *
   * When there is no island, a hidden one, or one that does not overlap this row vertically,
   * the hook returns the IDENTITY layout — two equal lanes and a zero-width hole — which
   * reproduces the previous `justify-between` row exactly. So a user who turns the island off
   * sees the top bar they had before, and only a genuinely occluding pill changes anything. */
  const topbarRef = useRef<HTMLDivElement | null>(null);
  const islandLane = useIslandLane(topbarRef);

  return (
    <VoiceProvider>
    <TutorialProvider>
    {/* LIGHT MODE — was `bg-[#121212] text-white` (a literal arbitrary value that
        pins the app root to near-black in BOTH themes; everything sits on it).
        This fix was applied before and CLOBBERED by a concurrent App.tsx rewrite.
        If it regresses again, the app background will be black in light mode.
        Both halves read the token contract now. */}
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--ws-surface)] text-[var(--text-primary)]">
      <TitleBar />
      <AppBackground pathname={location.pathname} />
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
        <div
          ref={topbarRef}
          data-island-lane={islandLane.active ? islandLane.phase : 'none'}
          /* THREE COLUMNS, NOT `justify-between`.
           *
           * The middle column is the pill's HOLE and its width and position come from the
           * measured pill, so nothing can be placed under it. The bar is a SINGLE row (`h-16`,
           * `flex-nowrap`): clusters never wrap onto a second line. When a lane is genuinely
           * narrower than its contents the trailing items overflow the cell visibly rather than
           * wrapping — wrapping was tried first and CZ rejected it on sight ("since when is the
           * top nav two rows?"). The pill-detection still guarantees the tracked-time readout and
           * the Focus/Total switch are never painted under the pill.
           *
           * Horizontal padding moved onto the two clusters so the grid spans the full border
           * box: the hole is placed in border-box pixels, and a container `px-8` would shift
           * every column 32px away from the pill. */
          className="h-16 border-b border-zinc-800 grid items-center glass"
          style={{ gridTemplateColumns: islandLane.template }}
        >
          <div className="pl-8 flex items-center gap-x-4 min-w-0 flex-nowrap">
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

          {/* THE HOLE. Empty by construction — that is the entire point of the column. It is
              `aria-hidden` and has no pointer surface: it is space reserved for a different
              window's pixels, not a control. */}
          <div aria-hidden="true" />

          <div className="pr-8 flex items-center justify-end gap-x-4 min-w-0 flex-nowrap">
            {/* Time mode toggle: Focus vs Total */}
            <div className="flex bg-zinc-900 rounded-full p-1 flex-shrink-0 light:bg-[var(--ws-surface-sunken)]">
              <button
                onClick={() => setTimeMode('focus')}
                aria-pressed={timeMode === 'focus'}
                className={`${PILL_BASE} flex items-center gap-1.5 w-[72px] justify-center flex-shrink-0 text-xs ${timeMode === 'focus' ? PILL_ON : PILL_OFF}`}
                title="Focus Time: Productive apps only (websites belong to the tracking browser)"
              >
                <Zap className="w-3 h-3" />
                Focus
              </button>
              <button
                onClick={() => setTimeMode('total')}
                aria-pressed={timeMode === 'total'}
                className={`${PILL_BASE} flex items-center gap-1.5 w-[72px] justify-center flex-shrink-0 text-xs ${timeMode === 'total' ? PILL_ON : PILL_OFF}`}
                title="Total Time: Apps only (websites belong to the tracking browser)"
              >
                <Clock className="w-3 h-3" />
                Total
              </button>
            </div>

            {/* Tracked time readout — Focus or Total, per the toggle above */}
            <div
              className="text-sm font-mono font-semibold text-white tabular-nums flex items-center gap-2 cursor-help light:text-zinc-800"
              title={`Apps: ${formatDuration(timeBreakdown.apps)} | Websites: ${formatDuration(timeBreakdown.websites)}`}
            >
              {timeMode === 'focus' ? <Zap className="w-4 h-4 text-zinc-500" /> : <Clock className="w-4 h-4 text-zinc-500" />}
              {formatDuration(displayTime)}
            </div>

            <div className="flex bg-zinc-900 rounded-full p-1 text-xs light:bg-[var(--ws-surface-sunken)]">
              {/* Today */}
              <button
                onClick={() => { setExpandedPeriod(null); setSelectedPeriod('today'); }}
                aria-pressed={selectedPeriod === 'today'}
                className={`${PILL_BASE} ${selectedPeriod === 'today' ? PILL_ON : PILL_OFF}`}
              >
                Today
              </button>

              {/* Week / 7 Day */}
              <div className="relative flex">
                {expandedPeriod === 'week' ? (
                  <>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('week'); }}
                      aria-pressed={selectedPeriod === 'week'}
                      className={`${PILL_BASE} ${selectedPeriod === 'week' ? PILL_ON : PILL_OFF}`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('7day'); }}
                      aria-pressed={selectedPeriod === '7day'}
                      className={`${PILL_BASE} ${selectedPeriod === '7day' ? PILL_ON : PILL_OFF}`}
                    >
                      7 Day
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setExpandedPeriod('week')}
                    className={`${PILL_BASE} ${selectedPeriod === 'week' || selectedPeriod === '7day' ? PILL_ON : PILL_OFF}`}
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
                      aria-pressed={selectedPeriod === 'month'}
                      className={`${PILL_BASE} ${selectedPeriod === 'month' ? PILL_ON : PILL_OFF}`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('30day'); }}
                      aria-pressed={selectedPeriod === '30day'}
                      className={`${PILL_BASE} ${selectedPeriod === '30day' ? PILL_ON : PILL_OFF}`}
                    >
                      30d
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setExpandedPeriod('month')}
                    className={`${PILL_BASE} ${selectedPeriod === 'month' || selectedPeriod === '30day' ? PILL_ON : PILL_OFF}`}
                  >
                    {selectedPeriod === '30day' ? '30d' : 'Month'}
                  </button>
                )}
              </div>

              {/* All Time */}
              <button
                onClick={() => { setExpandedPeriod(null); setSelectedPeriod('all'); }}
                aria-pressed={selectedPeriod === 'all'}
                className={`${PILL_BASE} ${selectedPeriod === 'all' ? PILL_ON : PILL_OFF}`}
              >
                All Time
              </button>
            </div>

            {/* Timeline navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateOffset(o => o + 1)}
                className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] light:bg-[var(--ws-surface-sunken)] light:hover:bg-[var(--ws-surface-recess-deep)] light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)]"
                title="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-zinc-400 min-w-[80px] text-center select-none font-medium light:text-[var(--text-muted)]">
                {getDateRange(selectedPeriod, dateOffset).label}
              </span>
              <button
                onClick={() => setDateOffset(o => Math.max(0, o - 1))}
                disabled={dateOffset === 0}
                className={`p-1.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] ${
                  dateOffset === 0
                    ? 'bg-zinc-800/20 text-zinc-600 cursor-not-allowed light:bg-transparent light:text-[var(--text-disabled)]'
                    : 'bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white light:bg-[var(--ws-surface-sunken)] light:hover:bg-[var(--ws-surface-recess-deep)] light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)]'
                }`}
                title="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowTrackingTime(true)}
              title="Correct recorded time, fill gaps, or add manual time"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] light:bg-[var(--ws-surface-raised)] light:text-[var(--text-secondary)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-surface-hover)] light:ring-1 light:ring-[var(--ws-border-strong)]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Tracking time
            </button>

            <div className="flex items-center gap-3">
              {/* ClockDropdown renders the Clock icon itself — children is text only,
                  otherwise the button shows two icons side by side. */}
              <ClockDropdown label="Timers, stopwatch and alarms">
                <span className="text-sm text-zinc-400 light:text-zinc-500">
                  {format(new Date(), 'HH:mm')}
                </span>
              </ClockDropdown>
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
        {/* `/life` joins `/terminal` and `/database` as a route that OWNS its own
            scrolling.

            Every other route gets `overflow-auto` here, which makes the app-level
            page root a second scroller. That is invisible for a page that scrolls
            normally, but LifePage mounts `ScheduleLayoutShell`, whose entire
            design is "one screen, no page scroll; each panel scrolls inside
            itself" — so the root scroller and the shell scroller fought, the grid
            overflowed its box, and content appeared cropped behind the root
            scroller. The fix is not inside LifePage at all: the root has to stop
            scrolling for the route that declares it will not.

            The other Life tabs keep working because their own wrappers still
            scroll (`overflow-auto p-5` for pages mode, `ws-scroll` for the
            River) — this only removes the OUTER duplicate. */}
        <div data-page-root className={`flex-1 min-h-0 ${location.pathname === '/terminal' || location.pathname === '/database' || location.pathname === '/life' ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
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
                  sharedLogs={allLogs}
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
              <Route path="/labs" element={<LabsPage />} />
              <Route path="/goals" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Goals...</div>}><GoalsPage /></Suspense></ErrorBoundary>} />
              <Route path="/time-tools" element={<TimeToolsPage />} />

              <Route path="/compositions" element={<Navigate to="/ai" replace />} />

              <Route path="/life" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Life...</div>}><LifePage /></Suspense></ErrorBoundary>} />
              <Route path="/gold" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Gold...</div>}><GoldPage /></Suspense></ErrorBoundary>} />
              <Route path="/learn" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Learn...</div>}><LearnPage /></Suspense></ErrorBoundary>} />
              <Route path="/lecture/*" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Lecture...</div>}><LectureWorkspace /></Suspense></ErrorBoundary>} />
              <Route path="/conductor" element={<div className="flex items-center justify-center h-full text-zinc-500 text-sm">Conductor is now in the workspace sidebar</div>} />

              <Route path="/agentic" element={<ErrorBoundary><Suspense fallback={<div className="p-5 text-zinc-500 text-sm">Loading Agentic System...</div>}><AgenticSystemPage /></Suspense></ErrorBoundary>} />

              <Route path="/ide-help" element={<IDEHelpPage />} />

              {/* Lazy, so the <Suspense> + <ErrorBoundary> wrapper is REQUIRED --
                  without a Suspense ancestor a lazy() component that is still
                  loading has nothing to render into and React throws. The
                  fallback is deliberately terminal-shaped (dark, monospace)
                  rather than a spinner, because this route normally follows a
                  click on a running terminal and a spinner would read as a
                  stutter in the app it is supposed to feel continuous with. */}
              <Route path="/terminal" element={<ErrorBoundary><Suspense fallback={<div className="flex items-center justify-center h-full"><div className="font-mono text-[11px] text-zinc-600">starting terminal workspace…</div></div>}><TerminalPage /></Suspense></ErrorBoundary>} />
              <Route path="/simple-terminal" element={<ErrorBoundary><Suspense fallback={<div className="flex items-center justify-center h-full"><div className="font-mono text-[11px] text-zinc-600">starting terminal…</div></div>}><SimpleTerminalPage /></Suspense></ErrorBoundary>} />
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
              {/* Database is a Settings subpage now, not a top-level route. A
                  redirect rather than a delete keeps deep links / bookmarks alive. */}
              <Route path="/database" element={<Navigate to="/settings" replace />} />
              <Route path="/transcripts" element={<TranscriptPage />} />
              {/* App-wide performance profiler. Arms on demand; collects frame
                  time, blocking tasks, renderer heap and per-page cost. */}
              <Route path="/profiler" element={<ProfilerPage />} />
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
                  // Sleep gaps are absences too — they now go to the same single
                  // "While you were away" prompt as everything else, instead of
                  // opening a second, lock-less modal.
                  enqueueGapFill(gaps as any, 'sleep');
                }}
onFillGap={(gap) => {
                  enqueueGapFill([gap as any], 'sleep');
                }}
                filledGapStarts={sleepFilledGapStarts}
              />
            )}
          </AnimatePresence>

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
              <div className="fixed inset-0 bg-[var(--ws-modal-scrim)] backdrop-blur flex items-center justify-center z-[70]" onClick={() => setShowDatabase(false)}>
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
          <AnimatePresence>
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
                onNotAfk={() => {
                  // Declining the prompt means the user WAS here, so tracking has
                  // to come back. AFK detection turns tracking off (that is what
                  // creates the real gap in the logs); this handler used to just
                  // drop the queue entry, leaving the app silently untracked
                  // until some unrelated event happened to switch it back on.
                  resumeTrackingAfterAfk();
                  setAfkPromptQueue(prev => prev.slice(1));
                }}
                defaultNotAfk={entry.defaultNotAfk}
                adjacentGaps={afkGapsData?.gaps || []}
                onFillGapRequest={(gaps) => {
                  enqueueGapFill(gaps as any, 'afk');
                  setGapFillActivities(afkGapsData?.activities || []);
                }}
                filledGapStarts={afkFilledGapStarts}
                onBulkFill={handleBulkFill}
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
                      enqueueGapFill(fillGaps as any, 'afk');
                      setGapFillActivities(afkGapsData?.activities || []);
                    }
                  }}
                />
              </AfkPromptModal>
            );
          })()}
          </AnimatePresence>

          {/* -- Single gap-fill prompt (replaces three GapFillModal mounts) --
              Renders "While you were away" against whatever gap is at the head of
              the queue, so a sleep gap, an AFK gap, a smart-fill and an
              External-page gap all get the SAME UI — including the split-lock that
              the deleted modal never had. */}

          {/* ── Manual Time Assign Modal ── */}
          {gapFillQueue.length > 0 && (() => {
            const gap = gapFillQueue[0];
            // enqueueGapFill already normalises, so these ARE Dates. Coerce again
            // rather than trust it: this runs inside App's render, and an exception
            // here is caught by the root boundary, which unmounts the whole app
            // rather than one prompt. A malformed gap must cost you the gap, never
            // the screen.
            const gapStart = gap.start instanceof Date ? gap.start : new Date(gap.start);
            const gapEnd = gap.end instanceof Date ? gap.end : new Date(gap.end);
            const startMs = gapStart.getTime();
            const endMs = gapEnd.getTime();
            const durationSec = Math.max(60, Math.round((endMs - startMs) / 1000));
            const startKey = gapStart.toISOString();

            const advance = () => {
              if (gapFillSource === 'afk') setAfkFilledGapStarts(prev => [...prev, startKey]);
              else if (gapFillSource === 'sleep') setSleepFilledGapStarts(prev => [...prev, startKey]);
              setGapFillQueue(prev => prev.slice(1));
              window.dispatchEvent(new CustomEvent('external-data-changed'));
              fetchGaps();
            };

            return (
              <AfkPromptModal
                /* Fall back to the app-level list. `gapFillActivities` is only
                   filled by the paths that happen to fetch, and `afkGapsData` —
                   the other former source — is only set after an AFK prompt is
                   SAVED. So reaching "fill past gaps" without answering an AFK
                   prompt first handed this picker an empty array and it showed
                   nothing at all. */
                allActivities={gapFillActivities.length > 0 ? gapFillActivities : externalActivities}
                totalDurationSeconds={durationSec}
                periodStart={gapStart.toISOString()}
                periodEnd={gapEnd.toISOString()}
                idleStartMs={startMs}
                returnMs={endMs}
                queueRemaining={gapFillQueue.length - 1}
                defaultNotAfk={false}
                onConfirm={async (segments) => {
                  if (!segments.length || !window.deskflowAPI?.createExternalSessionsBatch) return false;
                  try {
                    // Forward the modal's rows VERBATIM. The modal already builds
                    // startedAt/endedAt by walking a cursor from periodStart, and it
                    // deliberately advances that cursor for SKIPPED segments too, so a
                    // blank middle slot shifts the later rows correctly. Rebuilding the
                    // rows here from the filled segments alone would throw those offsets
                    // away and corrupt the timeline exactly when the user was selective.
                    // Branch on the PAYLOAD, not on "it didn't throw". This
                    // handler reports rejection by returning {success:false},
                    // so a try/catch alone would render a lost answer as "Saved".
                    const res: any = await window.deskflowAPI.createExternalSessionsBatch(segments);
                    if (res && res.success === false) {
                      console.error('[DeskFlow] gap fill rejected:', res.error);
                      return false;
                    }
                  } catch (err) {
                    console.error('[DeskFlow] gap fill failed:', err);
                    return false;
                  }
                  advance();
                  return true;
                }}
                onDismiss={advance}
                onNotAfk={() => { advance(); resumeTrackingAfterAfk(); }}
              />
            );
          })()}

          {/* ── Unified Tracking Time dialog ── */}
          <TrackingTimeDialog
            open={showTrackingTime}
            onClose={() => setShowTrackingTime(false)}
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

          {/* Rewind overlay — film/classic navigation. Only mounted when open so
              the whole chunk (reels, previews, strip) stays off the idle path. */}
          {rewindOpen && <RewindNav open onClose={() => setRewindOpen(false)} />}

          {/* Global Command Palette — ⌘K / Ctrl+K navigation search */}
          <GlobalSearchCommandPalette
            isOpen={paletteOpen}
            onClose={() => { setPaletteOpen(false); setRewindOpen(false) }}
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
        {/* HALO IN-APP ISLAND.
         * Architect decision (generate-prompt-docs/halo-window-architecture-12102026/RESULT.md):
         * delete the Halo BrowserWindow and render inside this window. "No separate window" and
         * "visible over other apps" cannot both hold on Wayland - the second needs a
         * compositor-managed surface, which IS a window. The window wins; cross-app presence is
         * dropped from the requirements.
         * Wrapped in an ErrorBoundary deliberately: this mounts inside the app's root tree, so an
         * exception here would otherwise unmount the entire UI (AGENTS.md 8, black screen). */}
        <ErrorBoundary>
          <HaloInAppMount />
        </ErrorBoundary>
      <FloatingDictation />
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

