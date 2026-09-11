import { useState, useEffect, useMemo, useRef, useCallback, memo, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Home, Monitor, Globe, Code2, BarChart3, Settings, Play, Pause, Clock,
  Download, Trash2, Award, Zap, Users, Info, Database, CheckCircle, XCircle, AlertTriangle,
  Shield, ShieldAlert, ToggleLeft, ToggleRight, PieChart, CreditCard, Target,
  ChevronLeft, ChevronRight, Calendar, Terminal, Save, Clock4,
  X,   FolderTree, Bot, Minus, HelpCircle, Settings2, Moon, FileText, BookOpen, Wallet, GraduationCap, Activity
} from 'lucide-react';
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
import ExternalPage from './pages/ExternalPage';
import { AiPage } from './pages/AiPage';
import { DurationPicker, LatencyPicker } from './components/DurationPicker';
import InsightsPage from './pages/InsightsPage';
import { FinancePage } from './pages/FinancePage';
import DashboardPage from './pages/DashboardPage';
import FeatureSpecViewer from './components/FeatureSpecViewer';
import AfkPromptModal from './components/AfkPromptModal';
import { getDateRange } from './lib/dateRange';
import type { Period } from './lib/dateRange';
// Agent dashboard is disabled - file incomplete

// Lazy load OrbitSystem - it's heavy and should only load when needed
const OrbitSystem = lazy(() => import('./components/OrbitSystem').then(module => ({ default: module.default })));

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

// Electron API types
declare global {
  interface Window {
    deskflowAPI?: {
      onForegroundChange: (cb: (data: any) => void) => () => void;
      onTrackingHeartbeat: (cb: (data: any) => void) => () => void;
      onBrowserTrackingEvent: (cb: (data: any) => void) => () => void;
      onTrackerMindInitProgress: (cb: (data: any) => void) => () => void;
      getLogs: () => Promise<any[]>;
      getLogsByPeriod: (params: { period: 'today' | 'week' | 'month' | 'all'; dateOffset?: number }) => Promise<any[]>;
      getDashboardData: (params: { period: string; dateOffset?: number }) => Promise<{ success: boolean; data?: any; error?: string }>;
      getPageStats: (params: { page: string; period: string; dateOffset?: number }) => Promise<{ success: boolean; data?: any; error?: string }>;
      backfillAggregations: () => Promise<{ success: boolean; message?: string }>;
      getStats: () => Promise<any[]>;
      getAppStats: (period?: 'today' | 'week' | 'month' | 'all') => Promise<any[]>;
      getDailyStats: (period: 'week' | 'month' | 'all') => Promise<any>;
      toggleTracking: () => Promise<boolean>;
      setTracking: (enabled: boolean) => Promise<boolean>;
      clearData: () => Promise<boolean>;
      clearToday: () => Promise<boolean>;
      getDbPath: () => Promise<string>;
      getStorageStatus: () => Promise<{
        type: 'sqlite' | 'json' | 'none';
        working: boolean;
        path: string;
        error?: string;
        logCount: number;
      }>;
      getPreferences: () => Promise<Record<string, any>>;
      setPreference: (key: string, value: any) => Promise<boolean>;
      // Browser tracking
      getBrowserLogs: () => Promise<any[]>;
      getBrowserDomainStats: () => Promise<any[]>;
      getAllBrowserDomainStats: () => Promise<any[]>;
      getBrowserCategoryStats: () => Promise<any[]>;
      setBrowserTracking: (enabled: boolean) => Promise<boolean>;
      getBrowserTrackingStatus: () => Promise<{
        enabled: boolean;
        serverRunning: boolean;
        port: number;
        excludedDomains: string[];
      }>;
      setBrowserExcludedDomains: (domains: string[]) => Promise<boolean>;
      setRecordingMode: (type: 'browser' | 'app', mode: 'always' | 'on-view') => Promise<boolean>;
      getRecordingModes: () => Promise<{
        browser: string;
        app: string;
        browserPageVisible: boolean;
        dashboardPageVisible: boolean;
      }>;
      setPageVisibility: (page: 'browser' | 'dashboard', visible: boolean) => Promise<boolean>;
      // Productivity tracking
      getDailyProductivity: (date: string) => Promise<any>;
      getProductivityRange: (startDate: string, endDate: string) => Promise<any[]>;
      saveProductivitySession: (session: any) => Promise<any>;
      getProductivitySessions: (opts?: any) => Promise<any>;
      clearProductivitySessions: () => Promise<void>;
      getCurrentForeground: () => Promise<any>;
      // Clean corrupted data
      cleanCorruptedData: () => Promise<{ success: boolean; deletedCount: number; error?: string }>;
      // Deep cleanup and rebuild
      deepCleanAndRebuild: () => Promise<{ success: boolean; logsCleared?: number; aggregatesCleared?: number; message?: string }>;
      // Database schema and table management
      migrateToAggregates: () => Promise<{ success: boolean; aggregatesUpdated?: number; browserAggregatesUpdated?: number; message?: string }>;
      getDailyAggregates: () => Promise<any[]>;
      getBrowserSessions: () => Promise<any[]>;
      getSessions: () => Promise<any[]>;
      getTableSchema: (tableName: string) => Promise<any>;
      getDatabaseTables: () => Promise<{ tables: string[]; type: string; error?: string }>;
      getTableData: (tableName: string, limit?: number) => Promise<any[] | { error: string }>;
      updateCategoriesFromOverrides: (appOverrides: Record<string, string>, domainOverrides: Record<string, string>) => Promise<{ success: boolean; updatedCount: number; error?: string }>;
      // File operations
      saveFile: (options: { content: string; filename: string; fileType: string }) => Promise<{ success: boolean; path?: string; message?: string }>;
      pickFolder: () => Promise<{ success: boolean; path: string | null }>;
      scanCustomDirectory: (rootDir: string) => Promise<{ success: boolean; projects: any[] }>;
      getCustomScanDirs: () => Promise<string[]>;
      saveCustomScanDirs: (dirs: string[]) => Promise<{ success: boolean }>;
      // IDE Projects
      detectIDEs: () => Promise<any[]>;
      getIDEs: () => Promise<any[]>;
      getExtensions: (ideId?: string) => Promise<any[]>;
      scanTools: () => Promise<any[]>;
      getTools: (category?: string) => Promise<any[]>;
      getToolCategories: () => Promise<{ category: string }[]>;
      resetTools: () => Promise<{ success: boolean; message: string }>;
      addProject: (data: { name: string; path: string; repositoryUrl?: string; vcsType?: string; primaryLanguage?: string; defaultIde?: string }) => Promise<{ success: boolean; id?: string; name?: string; message?: string }>;
      getProjects: () => Promise<any[]>;
      getProjectTools: (projectId: string) => Promise<any[]>;
      removeProject: (projectId: string) => Promise<{ success: boolean }>;
      openProject: (projectId: string, ideId?: string) => Promise<{ success: boolean; ide?: string; message?: string }>;
      getAIUsageSummary: (period?: string, dateOffset?: number, projectId?: string) => Promise<any>;
      getCommitStats: (projectId?: string, period?: string) => Promise<any>;
      getIDEProjectsOverview: (period?: string, dateOffset?: number) => Promise<any>;
      scanIdeDefaultProjects: () => Promise<{ ide: string; projects: { name: string; path: string }[] }[]>;
      // Run Project Feature
      detectProjectScripts: (projectPath: string) => Promise<any>;
      getProjectRunConfig: (projectId: string) => Promise<any>;
      saveProjectRunConfig: (projectId: string, config: any) => Promise<any>;
      runProject: (projectId: string, config: any) => Promise<any>;
      executeProjectCommand: (terminalId: string, command: string) => Promise<any>;
      stopProject: (terminalId: string) => Promise<any>;
      getRunningProjects: () => Promise<any>;
      openUrl: (url: string) => Promise<any>;
      syncAIUsage: () => Promise<{ success: boolean; [key: string]: number | boolean | string }>;
      onAISyncProgress: (callback: (data: any) => void) => () => void;
      debugAIAgents: () => Promise<Record<string, { detected: boolean; paths: string[] }>>;
      // Git & DORA Metrics
      syncCommits: (projectId: string, repoPath?: string) => Promise<{ success: boolean; count: number }>;
      syncGitHubCommits: (projectId: string, owner: string, repo: string, token?: string) => Promise<{ success: boolean; count: number }>;
      getDORAMetrics: (projectId: string, period?: 'week' | 'month') => Promise<any>;
      getCommitHistory: (projectId: string, limit?: number) => Promise<any[]>;
      getContributorStats: (projectId: string) => Promise<any>;
      // Terminal Window
      createTerminalWindow: () => Promise<boolean>;
      spawnTerminal: (terminalId: string, cwd?: string, agentType?: string, cols?: number, rows?: number) => Promise<boolean>;
      writeTerminal: (terminalId: string, data: string) => Promise<boolean>;
      resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<boolean>;
      killTerminal: (terminalId: string) => Promise<boolean>;
      onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => void;
      onTerminalExit: (callback: (data: { terminalId: string; exitCode: number; signal: number }) => void) => void;
      // Terminal Presets
      getTerminalPresets: (projectId?: string) => Promise<any[]>;
      addTerminalPreset: (preset: { projectId?: string; name: string; command: string; workingDirectory?: string; category?: string }) => Promise<{ success: boolean; id?: string; message?: string }>;
      removeTerminalPreset: (presetId: string) => Promise<{ success: boolean; message?: string }>;
      executeTerminalPreset: (presetId: string, terminalId?: string) => Promise<{ success: boolean; command?: string; terminalId?: string; message?: string }>;
      // Terminal Layouts
      saveTerminalLayout: (layout: { id?: string; name: string; layoutData: string; isActive?: boolean }) => Promise<{ success: boolean; id?: string; message?: string }>;
      getTerminalLayouts: (projectId?: string) => Promise<any[]>;
      deleteTerminalLayout: (layoutId: string) => Promise<{ success: boolean; message?: string }>;
      setActiveTerminalLayout: (layoutId: string) => Promise<{ success: boolean; message?: string }>;
      // Terminal Sessions
      saveTerminalSession: (session: { projectId?: string; agent: string; resumeId?: string; topic?: string; workingDirectory?: string; totalTokens?: number; totalCost?: number; category?: string; status?: string; productArea?: string; description?: string; autoTags?: string[]; categoryConfirmed?: boolean }) => Promise<{ success: boolean; id?: string }>;
      getTerminalSessions: (projectId?: string, limit?: number) => Promise<any[]>;
      getTerminalSessionResumeId: (sessionId: string) => Promise<string | null>;
      deleteTerminalSession: (sessionId: string) => Promise<{ success: boolean }>;
      getSessionMessages: (sessionId: string, agentType?: string) => Promise<{ success: boolean; data: any[] }>;
      saveTerminalMessage: (data: { sessionId: string; role: string; content: string }) => Promise<{ success: boolean; id?: any }>;
      getPromptHistory: (opts?: { projectId?: string; limit?: number }) => Promise<{ success: boolean; data: any[]; error?: string }>;
      deleteTerminalMessage: (id: number) => Promise<{ success: boolean; error?: string }>;
      getPromptStatus: () => Promise<{ success: boolean; data: any[] }>;
      aiTaskAdd: (data: { terminalId: string; prompt: string; agent: string; sessionId: string; projectPath: string }) => void;
      aiTaskWatch: (projectPath: string) => Promise<any>;
      aiTaskStopWatch: (projectPath: string) => Promise<any>;
      onAiTaskUpdated: (callback: (data: any) => void) => () => void;
      onAiTaskFileChanged: (callback: (data: any) => void) => () => void;
      // Session Categorization
      updateSessionCategory: (data: { sessionId: string; category?: string; productArea?: string; description?: string; status?: string; tags?: string[]; categoryConfirmed?: boolean }) => Promise<{ success: boolean }>;
      getParsedSessionItems: (sessionId: string) => Promise<{ success: boolean; data: any[] }>;
      analyzeSessionCategory: (sessionId: string) => Promise<{ success: boolean; category: string; confidence: number; tags: string[]; productArea: string }>;
      saveSessionConfig: (sessionId: string, config: any, projectPath?: string) => Promise<{ success: boolean; error?: string }>;
      loadSessionConfig: (sessionId: string, projectPath?: string) => Promise<{ success: boolean; data: any; error?: string }>;
      listInitFiles: (projectPath?: string) => Promise<{ success: boolean; data: string[] }>;
      // @mention Routing
      resolveAtMention: (data: { input: string; terminalTabs: Array<{ id: string; name: string }> }) => Promise<{ terminalId: string | null; message: string; resolved: boolean }>;
      getAISyncStatus: () => Promise<{ lastRunAt: string | null; agentLastRun: Record<string, string>; paths: Record<string, any> }>;
      // Project Health
      calculateProjectHealth: (projectId: string) => Promise<{ healthScore: number; activityLevel: string; aiSessions: number; commits: number }>;
      getProjectDetails: (projectId: string) => Promise<{ project: any; tools: any[]; sessions: any[]; health: any; presets: any[]; aiUsage: any }>;
      // Model Improvement Dashboard
      getModelImprovementStats: (opts?: { terminalId?: string }) => Promise<{ messageCounts: Record<string, number>; reinjectionCount: number; threshold: number; actionsAttempted: number; actionsFailed: number } | null>;
      setReinjectThreshold: (payload: { threshold: number }) => Promise<{ success: boolean; error?: string }>;
      setModelDebug: (payload: { enabled: boolean }) => Promise<{ success: boolean; error?: string }>;
      readActionsErrorLog: () => Promise<{ entries: string[]; exists: boolean }>;
      // Auto-Assign Routing
      routePrompt: (request: { prompt: string; projectPath?: string }) => Promise<{ action: string; sessionId?: string; sessionName?: string; terminalId?: string; confidence?: number; suggestedName?: string; suggestedSummary?: string; reason?: string }>;
      updateSessionSummary: (request: { sessionId: string; force?: boolean }) => Promise<{ success: boolean; skipped?: boolean; summary?: string; topic?: string; autoNamed?: boolean; reason?: string; error?: string }>;
      getRoutingCosts: () => Promise<{ today: any; week: any; month: any; total: any; byType: any[] }>;
      resetRoutingCosts: () => Promise<{ success: boolean }>;
      getAutoAssignConfig: () => Promise<any>;
      saveAutoAssignConfig: (config: any) => Promise<{ success: boolean }>;
      // Cross-Session Sync
      lockFile: (filePath: string, terminalId: string, sessionId?: string | null, action?: string) => Promise<{ acquired: boolean; heldBy?: string }>;
      releaseFileLock: (filePath: string, terminalId: string) => Promise<{ success: boolean }>;
      getFileLocks: () => Promise<Array<{ filePath: string; terminalId: string; sessionId: string | null; timestamp: number; action: string }>>;
      getLocksForTerminal: (terminalId: string) => Promise<Array<{ filePath: string; terminalId: string; sessionId: string | null; timestamp: number; action: string }>>;
      getTouchedFiles: (opts?: { terminalId?: string; filePath?: string; limit?: number }) => Promise<{ success: boolean; data: any[]; error?: string }>;
      compileSyncSummary: (terminalId: string) => Promise<{ success: boolean; summary: string; error?: string }>;
      broadcastContextDelta: (data: { terminalId: string; type: string; payload: any }) => Promise<{ success: boolean; sentCount: number }>;
      onFileConflict: (callback: (data: { filePath: string; requestingTerminal: string; lockingTerminal: string; sessionId: string | null; timestamp: number }) => void) => () => void;
      getCrossSessionSyncConfig: () => Promise<{ enabled: boolean; lockTTL: number; contextBroadcast: boolean; conflictWarningMode: string; syncCommand: boolean }>;
      setCrossSessionSyncConfig: (config: any) => Promise<{ success: boolean }>;
      executeCommand: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; error?: string }>;
      // AI Digest & Config
       getTopicDigest: () => Promise<{ success: boolean; topics?: any[]; error?: string }>;
       saveAiConfig: (config: any) => Promise<{ success: boolean }>;
       getAiConfig: () => Promise<any>;
       getAiProviders: () => Promise<any>;
       saveAiProviders: (state: any) => Promise<{ success: boolean }>;
       testAiProvider: (providerId: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        getInterestTopics: () => Promise<string[]>;
       addInterestTopic: (topic: string) => Promise<{ success: boolean }>;
       removeInterestTopic: (topic: string) => Promise<{ success: boolean }>;
      // Planning.md
      readPlanningMd: () => Promise<{ content: string; error?: string }>;
      writePlanningMd: (content: string) => Promise<{ success: boolean; error?: string }>;
      writeFeatureSpecFile: (content: string) => Promise<{ success: boolean; error?: string }>;
      getGoalContext: () => Promise<{ success: boolean; last7dByCategory?: any[]; yesterday?: any; error?: string }>;
      parseGoalFeedback: (data: { message: string; goals: string[] }) => Promise<{ completed: string[]; added: any[]; note: string }>;
      // Connectors
      connectors: {
        list: () => Promise<{ success: boolean; connectors: any[]; error?: string }>;
        add: (connector: { type: string; provider: string; displayName: string; config: any }) => Promise<{ success: boolean; connector?: any; error?: string }>;
        remove: (id: string) => Promise<{ success: boolean; error?: string }>;
        test: (id: string) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
        sync: (id: string) => Promise<{ success: boolean; itemsAdded: number; itemsUpdated: number; error?: string }>;
        items: (id: string, opts?: { type?: string; limit?: number }) => Promise<{ success: boolean; items: any[]; error?: string }>;
        status: (id: string) => Promise<{ success: boolean; status: string; lastSync?: string; errorMessage?: string }>;
      };
      // Design Library Integration
      mcpListTools: (serverId: string) => Promise<{ success: boolean; tools: any[]; error?: string }>;
      mcpCallTool: (serverId: string, toolName: string, args: Record<string, any>) => Promise<{ success: boolean; result: any; error?: string }>;
      mcpServerStatus: (serverId: string) => Promise<{ status: string; toolCount?: number; uptime?: number }>;
      mcpStartServer: (serverId: string) => Promise<{ success: boolean; tools?: any[]; error?: string }>;
      mcpStopServer: (serverId: string) => Promise<{ success: boolean; error?: string }>;
      aceternityFetchRegistry: () => Promise<{ success: boolean; components: any[]; total: number; error?: string }>;
      aceternityFetchComponent: (slug: string) => Promise<{ success: boolean; component?: any; error?: string }>;
      aceternityInstallComponent: (slug: string, cwd: string) => Promise<{ success: boolean; filesWritten?: string[]; error?: string }>;
      fetchReferoCatalog: (forceRefresh?: boolean, query?: string) => Promise<{ success: boolean; systems: any[]; total: number; error?: string }>;
      fetchReferoSystem: (slug: string) => Promise<{ success: boolean; system?: any; error?: string }>;
      searchReferoSystems: (query: string) => Promise<{ success: boolean; systems: any[]; total: number; error?: string }>;
      getDesignLibraryConfig: () => Promise<any>;
      setDesignLibraryConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
      getDesignCachedData: (key: string) => Promise<{ success: boolean; data?: any; timestamp?: number; stale?: boolean }>;
      testDesignLibraryConnection: (serverId: string) => Promise<{ success: boolean; latency?: number; toolCount?: number; error?: string }>;
      // Finance Page
      financeGetAccounts: () => Promise<any[]>;
      financeCreateAccount: (data: any) => Promise<any>;
      financeUpdateAccount: (data: any) => Promise<any>;
      financeArchiveAccount: (id: number) => Promise<any>;
      financeGetWallets: (accountId?: number) => Promise<any[]>;
      financeCreateWallet: (data: any) => Promise<any>;
      financeUpdateWallet: (data: any) => Promise<any>;
      financeAdjustBalance: (id: number, newBalance: number) => Promise<any>;
      financeGetCategories: () => Promise<any[]>;
      financeCreateCategory: (data: any) => Promise<any>;
      financeUpdateCategory: (data: any) => Promise<any>;
      financeGetTransactions: (filters?: any) => Promise<any[]>;
      financeCreateTransaction: (data: any) => Promise<any>;
      financeUpdateTransaction: (data: any) => Promise<any>;
      financeDeleteTransaction: (id: number) => Promise<any>;
      financeBatchUpdateCategory: (ids: number[], categoryId: number) => Promise<{ success: boolean; updated?: number; error?: string }>;
      financeGetSummary: () => Promise<any>;
      financeGetSpendingByCategory: () => Promise<any[]>;
      financeGetMonthlyTrends: () => Promise<any[]>;
      financeIsLocked: () => Promise<any>;
      financeGetLockState: () => Promise<any>;
      financeUnlock: (password: string) => Promise<any>;
      financeLock: () => Promise<any>;
      financeSetPassword: (password: string) => Promise<any>;
      financeChangePassword: (currentPassword: string, nextPassword: string) => Promise<any>;
      financeCheckPasswordSetup: () => Promise<any>;
      financeSetRememberDevice: (remember: boolean, days: number) => Promise<any>;
      financeSetLockTimeout: (timeoutMs: number) => Promise<any>;
      financeGetSecuritySettings: () => Promise<any>;
      financeCheckPageAccess: () => Promise<any>;
      financeBiometricUnlock: () => Promise<any>;
      financeGetWebAuthnCredential: () => Promise<any>;
      financeStoreWebAuthnCredential: (credentialId: string) => Promise<any>;
      financeGetDisplayCurrency: () => Promise<{ currency: string }>;
      financeSetDisplayCurrency: (currency: string) => Promise<{ success: boolean }>;
    };
  }
}

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface ActivityLog {
  id: number;
  timestamp: Date;
  app: string;
  category: string;
  duration: number; // seconds (NOT minutes â€” stores exact seconds for sub-minute precision)
  title?: string;
  project?: string;
  is_browser_tracking?: boolean;
  domain?: string;
  url?: string;
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
// Duplicated in DashboardPage.tsx and main.ts â€” keep in sync
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

function isAppMatchingBrowserRenderer(appName: string, browserName: string): boolean {
  if (!appName || !browserName) return false;
  const appLower = appName.toLowerCase().replace(/\.exe$/i, '');
  const browserLower = browserName.toLowerCase();
  const processNames = BROWSER_PROCESS_NAMES_RENDERER[browserLower] || [browserLower];
  return appLower.includes(browserLower) ||
    browserLower.includes(appLower) ||
    processNames.some(p => appLower.includes(p));
}

import { GapBanner } from './components/GapBanner';
import { GapFillDrawer } from './components/GapFillDrawer';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const page = location.pathname === '/' ? 'dashboard'
      : location.pathname.replace('/', '') || 'dashboard';
    document.documentElement.setAttribute('data-page', page);
  }, [location.pathname]);

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
  const [terminalProjectInfo, setTerminalProjectInfo] = useState<{ name: string; path: string }>({ name: '', path: '' });
  const [provisionStatus, setProvisionStatus] = useState<'idle' | 'provisioning' | 'provisioned'>('idle');

  // Gap Indicator Banner State
  const [unfilledMinutes, setUnfilledMinutes] = useState(0);
  const [gapCount, setGapCount] = useState(0);
  const [showGapBannerSetting, setShowGapBannerSetting] = useState(true);

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
    const range = getDateRange(selectedPeriod, dateOffset);
    return allLogs.filter(log => log.timestamp >= range.start && log.timestamp < range.end);
  }, [allLogs, selectedPeriod, dateOffset]);
  
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
    loadData();
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
            url: log.url
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
    if (!window.deskflowAPI) return;
    let reconnectAttempts = 0;
    const refresh = async () => {
      try {
        const status = await window.deskflowAPI!.getStorageStatus();
        setStorageStatus(status);
        if (status.working) {
          setDbConnected(true);
          reconnectAttempts = 0;
          const electronLogs = await window.deskflowAPI!.getLogs();
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
      } catch {
        reconnectAttempts++;
        if (reconnectAttempts >= 3) setDbConnected(false);
      }
    };
    const interval = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
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

  // Update ref when trackingBrowser state changes
  useEffect(() => {
    trackingBrowserRef.current = trackingBrowser;
  }, [trackingBrowser]);

  useEffect(() => {
    const loadTrackingBrowser = async () => {
      try {
        if (window.deskflowAPI?.getPreferences) {
          const prefs = await window.deskflowAPI.getPreferences();
          if (prefs?.browserWithExtension) {
            setTrackingBrowser(prefs.browserWithExtension.toLowerCase());
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
  } | null>(null);
  const [sleepDetectCustomBedtime, setSleepDetectCustomBedtime] = useState({ hours: 22, minutes: 0 });
  const [sleepDetectCustomWaketime, setSleepDetectCustomWaketime] = useState({ hours: 7, minutes: 0 });
  const [sleepDetectFellAsleepAt, setSleepDetectFellAsleepAt] = useState({ hours: 22, minutes: 15 });
  const [sleepDetectWakeUpAt, setSleepDetectWakeUpAt] = useState({ hours: 6, minutes: 55 });

  // On mount, check if there's a pending sleep detection
  useEffect(() => {
    const checkSleepDetect = async () => {
      try {
        if (window.deskflowAPI?.checkSleepDetection) {
          const data = await window.deskflowAPI.checkSleepDetection();
          if (data?.detected) {
            setSleepDetectionData(data);
            // Pre-fill custom times
            const bed = new Date(data.suggestedBedtime);
            const wake = new Date(data.suggestedWakeTime);
            setSleepDetectCustomBedtime({ hours: bed.getHours(), minutes: bed.getMinutes() });
            setSleepDetectCustomWaketime({ hours: wake.getHours(), minutes: wake.getMinutes() });
            setSleepDetectFellAsleepAt({ hours: bed.getHours(), minutes: (bed.getMinutes() + 15) % 60 });
            setSleepDetectWakeUpAt({ hours: wake.getHours(), minutes: Math.max(0, wake.getMinutes() - 5) });
            setShowSleepDetection(true);
          }
        }
      } catch { /* ignore */ }
    };
    checkSleepDetect();
  }, []);

  // Listen for real-time sleep detection from main process
  useEffect(() => {
    if (window.deskflowAPI?.onSleepDetection) {
      window.deskflowAPI.onSleepDetection(async (data: any) => {
        if (data?.gapMinutes >= 45) {
          sleepActiveRef.current = true;
          // Dismiss any open AFK prompts â€” sleep takes priority
          setAfkPromptQueue([]);
          afkPromptShownRef.current = true;
          const detResult = await window.deskflowAPI?.checkSleepDetection?.();
          if (detResult?.detected) {
            setSleepDetectionData(detResult);
            const bed = new Date(detResult.suggestedBedtime);
            const wake = new Date(detResult.suggestedWakeTime);
            setSleepDetectCustomBedtime({ hours: bed.getHours(), minutes: bed.getMinutes() });
            setSleepDetectCustomWaketime({ hours: wake.getHours(), minutes: wake.getMinutes() });
            setSleepDetectFellAsleepAt({ hours: bed.getHours(), minutes: (bed.getMinutes() + 15) % 60 });
            setSleepDetectWakeUpAt({ hours: wake.getHours(), minutes: Math.max(0, wake.getMinutes() - 5) });
            setShowSleepDetection(true);
          }
        }
      });
    }
  }, []);

  const dismissSleepDetection = async () => {
    sleepActiveRef.current = false;
    setShowSleepDetection(false);
    setSleepDetectionData(null);
    try {
      if (window.deskflowAPI?.dismissSleepDetection) {
        await window.deskflowAPI.dismissSleepDetection();
      }
    } catch { /* ignore */ }
  };

  const confirmSleepDetection = async () => {
    if (!sleepDetectionData) return;
    sleepActiveRef.current = false;
    try {
      const now = new Date();
      const deviceOff = new Date(now);
      deviceOff.setHours(sleepDetectCustomBedtime.hours, sleepDetectCustomBedtime.minutes, 0, 0);

      const fellAsleep = new Date(now);
      fellAsleep.setHours(sleepDetectFellAsleepAt.hours, sleepDetectFellAsleepAt.minutes, 0, 0);

      const wokeUp = new Date(now);
      wokeUp.setHours(sleepDetectWakeUpAt.hours, sleepDetectWakeUpAt.minutes, 0, 0);

      const deviceOn = new Date(now);
      deviceOn.setHours(sleepDetectCustomWaketime.hours, sleepDetectCustomWaketime.minutes, 0, 0);

                      // Handle midnight crossing
                      // DO NOT advance fellAsleep here â€” it's typically on the SAME evening
                      // as device off. Advancing it would inflate device_off_to_sleep_seconds
                      // to 24h+, making actualSleepSeconds compute to 0 in get-sleep-trends.
                      if (wokeUp <= deviceOff) {
                        wokeUp.setDate(wokeUp.getDate() + 1);
                        deviceOn.setDate(deviceOn.getDate() + 1);
                      }
                      // If fellAsleep is before device off by 10+ hours, it crossed midnight
                      // (e.g., device off 23:00, fell asleep 01:00 next day)
                      if (fellAsleep <= deviceOff) {
                        const offMin = deviceOff.getHours() * 60 + deviceOff.getMinutes();
                        const sleepMin = fellAsleep.getHours() * 60 + fellAsleep.getMinutes();
                        if (offMin - sleepMin >= 600) {
                          fellAsleep.setDate(fellAsleep.getDate() + 1);
                        }
                      }
      if (deviceOn <= wokeUp) deviceOn.setDate(deviceOn.getDate() + 1);

      const deviceOffToSleepSec = Math.max(0, Math.round((fellAsleep.getTime() - deviceOff.getTime()) / 1000));
      const wakeUpToAppSec = Math.max(0, Math.round((deviceOn.getTime() - wokeUp.getTime()) / 1000));

      // Clear any queued AFK prompts since sleep covers this period
      setAfkPromptQueue([]);
      afkPromptShownRef.current = true;

      if (window.deskflowAPI?.confirmSleep) {
        const result = await window.deskflowAPI.confirmSleep({
          started_at: deviceOff.toISOString(),
          ended_at: wokeUp.toISOString(),
          device_off_to_sleep_seconds: deviceOffToSleepSec,
          wake_up_to_app_seconds: wakeUpToAppSec,
        });
        if (result?.success) {
          window.dispatchEvent(new CustomEvent('sleep-confirmed'));
        }
      }
    } catch (err) {
      console.error('[App] Failed to confirm sleep:', err);
    }
    dismissSleepDetection();
  };

  function formatTimeFromHours(h: number, m: number): string {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function customDurationMinutes(): number {
    const bed = sleepDetectCustomBedtime.hours * 60 + sleepDetectCustomBedtime.minutes;
    let wake = sleepDetectCustomWaketime.hours * 60 + sleepDetectCustomWaketime.minutes;
    if (wake <= bed) wake += 24 * 60;
    return wake - bed;
  }

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

    const grouped: Record<string, { total_ms: number; sessions: number; first_seen: string; last_seen: string; category: string }> = {};
    for (const log of filteredLogs) {
      if (log.is_browser_tracking) continue;
      const app = log.app;
      const category = getCategory(app, log.category || 'Other');
      if (!grouped[app]) {
        grouped[app] = { total_ms: 0, sessions: 0, first_seen: log.timestamp.toISOString(), last_seen: log.timestamp.toISOString(), category };
      }
      grouped[app].total_ms += log.duration * 1000;
      grouped[app].sessions += 1;
      if (log.timestamp.toISOString() < grouped[app].first_seen) grouped[app].first_seen = log.timestamp.toISOString();
      if (log.timestamp.toISOString() > grouped[app].last_seen) grouped[app].last_seen = log.timestamp.toISOString();
    }

    const stats = Object.entries(grouped).map(([app, data]) => ({
      app,
      ...data,
      avg_session_ms: data.sessions > 0 ? data.total_ms / data.sessions : 0
    }));

    return stats.sort((a, b) => b.total_ms - a.total_ms);
  }, [filteredLogs, categoryOverrides]);

  // Compute ALL TIME app stats - no filtering by period (for Settings page)
  const allTimeAppStats = useMemo(() => {
    // Include ALL logs regardless of selectedPeriod
    const appLogs = [...allLogs];

    // Apply category overrides
    const getCategory = (app: string, defaultCategory: string) => {
      const override = categoryOverrides[app.toLowerCase()];
      return override || defaultCategory;
    };

    // Group by app
    const grouped: Record<string, { total_ms: number; sessions: number; first_seen: string; last_seen: string; category: string }> = {};
    for (const log of appLogs) {
      if (log.is_browser_tracking) continue;
      const app = log.app;
      const category = getCategory(app, log.category || 'Other');
      if (!grouped[app]) {
        grouped[app] = { total_ms: 0, sessions: 0, first_seen: log.timestamp.toISOString(), last_seen: log.timestamp.toISOString(), category };
      }
      grouped[app].total_ms += log.duration * 1000;
      grouped[app].sessions += 1;
      if (log.timestamp.toISOString() < grouped[app].first_seen) grouped[app].first_seen = log.timestamp.toISOString();
      if (log.timestamp.toISOString() > grouped[app].last_seen) grouped[app].last_seen = log.timestamp.toISOString();
    }

    // Convert to array
    const stats = Object.entries(grouped).map(([app, data]) => ({
      app,
      ...data,
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

  useEffect(() => {
    if (window.deskflowAPI?.getTierAssignments) {
      window.deskflowAPI.getTierAssignments().then(assignments => {
        setTierAssignments(assignments);
        console.log('[DeskFlow] Loaded tier assignments:', assignments);
      }).catch(err => console.warn('[DeskFlow] Failed to load tier assignments:', err));
    }
  }, []);

  const [showSummary, setShowSummary] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmExport, setShowConfirmExport] = useState<'csv' | 'json' | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showWorkspaceWarning, setShowWorkspaceWarning] = useState(false);
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
  const [showGapDrawer, setShowGapDrawer] = useState(false);
  const afkQueueIdRef = useRef(0);
  const afkPromptShownRef = useRef(false);
  const pendingIdleRangeRef = useRef<{ idleStart: number; idleEnd: number | null } | null>(null);
  const sleepDetectionPendingRef = useRef(false);
  const sleepActiveRef = useRef(false);

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
    setAfkPromptQueue(prev => prev.slice(1));
    window.dispatchEvent(new CustomEvent('external-data-changed'));
  }, []);
  
  const handleAfkDismiss = useCallback(() => {
    console.log('[DeskFlow] handleAfkDismiss called');
    pendingIdleRangeRef.current = null;
    setAfkPromptQueue(prev => prev.slice(1));
    window.dispatchEvent(new CustomEvent('external-data-changed'));
  }, []);

  // Listen for gap-drawer open event
  useEffect(() => {
    const handler = () => setShowGapDrawer(true);
    window.addEventListener('open-gap-panel', handler);
    window.addEventListener('open-gap-drawer', handler);
    return () => {
      window.removeEventListener('open-gap-panel', handler);
      window.removeEventListener('open-gap-drawer', handler);
    };
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
  
  // Keep idleReturnFnRef.current updated with the actual handler
  useEffect(() => {
    idleReturnFnRef.current = async () => {
      if (sleepActiveRef.current || sleepDetectionPendingRef.current) { afkPromptShownRef.current = true; return; }
      if (afkPromptShownRef.current) return;
      afkPromptShownRef.current = true;

      const range = pendingIdleRangeRef.current;
      const idleStartMs = range?.idleStart ?? idleStartRef.current;
      const nowMs = Date.now();
      if (range) range.idleEnd = nowMs;
      const elapsedSec = idleStartMs ? Math.floor((nowMs - idleStartMs) / 1000) : 0;

      // Req 4: tiny idle → silent discard, no prompt
      if (elapsedSec < 60) { pendingIdleRangeRef.current = null; return; }

      const duration = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
      const entry: AfkPromptEntry = {
        id: afkQueueIdRef.current++,
        duration,
        idleStartMs,
        returnMs: nowMs,
        // Req 4: moderate idle (1–15m) defaults to "I wasn't AFK"
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
        // Skip idle check for entertainment/gaming (YouTube, Netflix, games — user is watching, not AFK)
        const PASSIVE_ACTIVE = new Set(['Entertainment', 'Gaming']);
        const isPassiveActive = currentCategoryRef.current && PASSIVE_ACTIVE.has(currentCategoryRef.current);
        const idleMs = idleThreshold * 60 * 1000; // Convert minutes to ms
        if (!isPassiveActive && systemIdleSecondsRef.current * 1000 > idleMs) {
          if (!pendingIdleRangeRef.current) {
            pendingIdleRangeRef.current = { idleStart: Date.now() - idleMs, idleEnd: null };
            idleStartRef.current = pendingIdleRangeRef.current.idleStart;
            setIsIdle(true);
            afkPromptShownRef.current = false;
          }
          // DO NOT pause tracking and DO NOT discard the session — keep counting.
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

    const totalSeconds = filtered.reduce((sum, log) => sum + log.duration, 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMins = Math.floor((totalSeconds % 3600) / 60);
    const totalSecs = totalSeconds % 60;
    return { hours: totalHours, mins: totalMins, secs: totalSecs, total: totalSeconds };
  };

  const currentTotals = getTotalTime(selectedPeriod);

  // Phase 3: Focus Time vs Total Time
  // Focus = productive categories only, Total = all categories
  const [timeMode, setTimeMode] = useState<'focus' | 'total'>('focus');

  // Compute time by category - SEPARATE for apps and websites
  // All apps time (for Total mode) - include ALL apps including browsers
  const appsTimeByCategory = useMemo(() => {
    const categoryTime: Record<string, number> = {};
    filteredLogs.forEach(log => {
      if (log.is_browser_tracking) return; // Only skip actual website tracking
      const cat = log.category || 'Uncategorized';
      categoryTime[cat] = (categoryTime[cat] || 0) + log.duration;
    });
    return categoryTime;
  }, [filteredLogs]);

  // Productive websites time (for Focus mode)
  const productiveWebsitesTime = useMemo(() => {
    let productiveTime = 0;
    browserLogs.forEach(log => {
      const websiteCategory = (log as any).category || 'Uncategorized';
      const mappedCategory = WEBSITE_CATEGORY_MAP[websiteCategory] || 'Other';
      if (tierAssignments?.productive.includes(mappedCategory)) {
        productiveTime += log.duration;
      }
    });
    return productiveTime;
  }, [browserLogs, tierAssignments]);

  // Total time by category (apps + all websites, used for score calculation)
  const timeByCategory = useMemo(() => {
    const categoryTime: Record<string, number> = {};
    
    // Desktop apps - include ALL apps
    filteredLogs.forEach(log => {
      if (log.is_browser_tracking) return; // Only skip actual website tracking
      const cat = log.category || 'Uncategorized';
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
  }, [filteredLogs, browserLogs]);

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
  // Total = apps only (no websites)
  // Focus = apps productive only (no websites)
  const focusAndTotalTime = useMemo(() => {
    // Total time = apps only
    const totalTime = Object.values(appsTimeByCategory).reduce((sum, d) => sum + d, 0);
    
    // Focus time = apps productive only
    let productiveAppsTime = 0;
    Object.entries(appsTimeByCategory).forEach(([category, duration]) => {
      if (tierAssignments?.productive.includes(category)) {
        productiveAppsTime += duration;
      }
    });

    return { focus: productiveAppsTime, total: totalTime };
  }, [appsTimeByCategory, tierAssignments]);
  
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
        const category = log.category || 'Uncategorized';
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
        const category = log.category || 'Uncategorized';
        
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
  }, [filteredLogs, tierAssignments]);

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
   • Coding: ${codingPct}% (${codingTime}min) — Top Project: ${topProject}
   • AI Tools: ${aiPct}% (${aiTime}min) — Smart prompting on Claude & ChatGPT
   • Distractions: ${distPct}% — Minimal YouTube/Entertainment

⏰ Peak Productivity Window: ${peakHour}
   You averaged 92% focus during this window.

Tip Insights:
   • 87% of IDE time spent on actual editing (vs. idle)
   • You completed 3 major tasks in PyCharm
   • Browser time was 68% productive (docs, GitHub)
   • Productivity Score: ${Math.floor(Math.random() * 15) + 83}/100

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
    setShowWorkspaceWarning(false);
    const saveFn = (window as any).__workspaceSave;
    if (saveFn) await saveFn();
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    } else {
      // Window close — allow Electron to close
      (window as any).deskflowAPI?.workspaceAllowClose?.();
    }
  }, [navigate, pendingNavigation]);

  const handleWorkspaceDiscardChanges = useCallback(() => {
    setShowWorkspaceWarning(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    } else {
      // Window close — allow Electron to close without saving
      (window as any).deskflowAPI?.workspaceAllowClose?.();
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
  const handleSidebarNavigation = useCallback((path: string) => {
    // If on Settings page with unsaved changes, show warning
    if (location.pathname === '/settings' && settingsHasChanges) {
      setPendingNavigation(path);
      setShowUnsavedWarning(true);
      return;
    }
    // If on Terminal page with unsaved workspace changes, show warning
    if (location.pathname === '/terminal' && (window as any).__workspaceHasUnsavedChanges) {
      setPendingNavigation(path);
      setShowWorkspaceWarning(true);
      return;
    }
    navigate(path);
  }, [location.pathname, settingsHasChanges, navigate]);

  // Listen for main process requesting save on window close
  useEffect(() => {
    const unsub = (window as any).deskflowAPI?.onWorkspaceRequestSave?.(() => {
      if ((window as any).__workspaceHasUnsavedChanges) {
        setPendingNavigation(null); // not a navigation — it's a window close
        setShowWorkspaceWarning(true);
      } else {
        (window as any).deskflowAPI?.workspaceAllowClose?.();
      }
    });
    return () => { unsub?.(); };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format duration in seconds to human-readable string
  // < 60s â†’ "45s", 60s-3600s â†’ "2m 15s", â‰¥ 3600s â†’ "1h 23m"
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

  const sidebarItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: Activity, label: 'Activity', path: '/activity' },
    { icon: Code2, label: 'IDE Projects', path: '/ide' },
    { icon: Clock4, label: 'External', path: '/external' },
    { icon: Bot, label: 'AI Assistant', path: '/ai' },
    { icon: Wallet, label: 'Finance', path: '/finance' },
    { icon: BarChart3, label: 'Insights', path: '/reports' },
    { icon: Database, label: 'Database', path: '/database' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: BookOpen, label: 'Guide', path: '/guide' },
    { icon: GraduationCap, label: 'Learn', path: '/learn' },
  ];

  return (
    <TutorialProvider>
    <div className="flex h-screen overflow-hidden bg-[#121212] text-white">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col h-full glass">
        <div className="p-5 flex items-center gap-3 border-b border-zinc-800 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-xl tracking-tight">DeskFlow</div>
            <div className="text-[10px] text-zinc-500 -mt-1">AI TRACKER</div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col">
            <div className="flex flex-col gap-2">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <motion.button
                  key={item.path}
                  onClick={() => handleSidebarNavigation(item.path)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-colors duration-150 ${isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                    }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </motion.button>
              );
            })}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-zinc-500">Local SQLite • Zero Cloud • Privacy-First</span>
          <span className="text-[10px] text-zinc-600">DeskFlow v3.85</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
        {/* Top Bar */}
        {location.pathname === '/terminal' ? (
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if ((window as any).__workspaceHasUnsavedChanges) {
                    setPendingNavigation('/ide');
                    setShowWorkspaceWarning(true);
                  } else {
                    navigate('/ide');
                  }
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                title="Back to IDE projects"
              >
                <Minus className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if ((window as any).__workspaceHasUnsavedChanges) {
                    setPendingNavigation('/ide');
                    setShowWorkspaceWarning(true);
                  } else {
                    navigate('/ide');
                  }
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                title="Close workspace"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-[var(--page-accent)]" />
                <div>
                  <h2 className="text-white font-semibold">{terminalProjectInfo.name || 'Terminal'}</h2>
                  {terminalProjectInfo.path && (
                    <p className="text-xs text-zinc-500 font-mono">{terminalProjectInfo.path}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('trigger-provision'))}
                disabled={provisionStatus === 'provisioning'}
                className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded flex items-center gap-1 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                title={provisionStatus === 'provisioned' ? 'Re-setup agent directory structure' : 'Setup agent directory structure'}
              >
                <FolderTree className="w-3 h-3" />
                {provisionStatus === 'provisioned' ? 'Re-setup' : 'Setup'}
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-new-agent'))}
                className="px-2 py-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs rounded flex items-center gap-1 transition-colors duration-150"
                title="Start a new AI agent session"
              >
                <Bot className="w-3 h-3" />
                Initialize
              </button>
            </div>
          </div>
        ) : (
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 glass">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold tracking-tight">
              {sidebarItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
            </div>
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
            <div className="flex bg-zinc-900 rounded-full p-1 flex-shrink-0">
              <button
                onClick={() => setTimeMode('focus')}
                className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 w-[72px] justify-center flex-shrink-0 text-xs ${timeMode === 'focus' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
                title="Focus Time: Sum of all logged sessions"
              >
                <Zap className="w-3 h-3" />
                Focus
              </button>
              <button
                onClick={() => setTimeMode('total')}
                className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 w-[72px] justify-center flex-shrink-0 text-xs ${timeMode === 'total' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-400 hover:text-white'}`}
                title="Total Time: Apps + Websites"
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

            <div className="flex bg-zinc-900 rounded-full p-1 text-xs">
              {/* Today */}
              <button
                onClick={() => { setExpandedPeriod(null); setSelectedPeriod('today'); }}
                className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'today' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                Today
              </button>

              {/* Week / 7 Day */}
              <div className="relative flex">
                {expandedPeriod === 'week' ? (
                  <>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('week'); }}
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'week' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('7day'); }}
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === '7day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      7 Day
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setExpandedPeriod('week')}
                    className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'week' || selectedPeriod === '7day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
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
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => { setExpandedPeriod(null); setSelectedPeriod('30day'); }}
                      className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === '30day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      30d
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setExpandedPeriod('month')}
                    className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'month' || selectedPeriod === '30day' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {selectedPeriod === '30day' ? '30d' : 'Month'}
                  </button>
                )}
              </div>

              {/* All Time */}
              <button
                onClick={() => { setExpandedPeriod(null); setSelectedPeriod('all'); }}
                className={`px-3 py-1.5 rounded-full transition ${selectedPeriod === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                All Time
              </button>
            </div>

            {/* Timeline navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateOffset(o => o + 1)}
                className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
                title="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-zinc-400 min-w-[80px] text-center select-none font-medium">
                {getDateRange(selectedPeriod, dateOffset).label}
              </span>
              <button
                onClick={() => setDateOffset(o => Math.max(0, o - 1))}
                disabled={dateOffset === 0}
                className={`p-1.5 rounded-lg transition ${
                  dateOffset === 0
                    ? 'bg-zinc-800/20 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white'
                }`}
                title="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Clock className="w-4 h-4" />
                {format(new Date(), 'HH:mm')}
              </div>
              {isIdle && (
                <div className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" /> IDLE
                </div>
              )}
            </div>

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
          </div>
        </div>
        )}

        {/* Main Scroll Area */}
        <div className={`flex-1 min-h-0 ${location.pathname === '/terminal' ? 'flex flex-col overflow-hidden' : 'overflow-auto p-5'}`}>
          <AnimatePresence mode="sync">
            <Routes location={location} key={location.pathname}>
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
              <Route path="/activity" element={<ActivityPage appStats={appStats} logs={filteredLogs} allLogs={allLogs} browserLogs={browserLogs} selectedPeriod={selectedPeriod} dateOffset={dateOffset} onDateOffsetChange={setDateOffset} timeMode={timeMode} tierAssignments={tierAssignments || DEFAULT_TIER_ASSIGNMENTS} liveActivityLogs={liveActivityLogs} domainKeywordRules={domainKeywordRules} externalActivities={externalActivities} externalActivityTiers={externalActivityTiers} />} />
              {/* Legacy routes — redirect to unified Activity page */}
              <Route path="/stats" element={<Navigate to="/activity?tab=apps" replace />} />
              <Route path="/productivity" element={<Navigate to="/activity?tab=productivity" replace />} />
              <Route path="/browser" element={<Navigate to="/activity?tab=websites" replace />} />
              {/* IDE Page */}
              <Route path="/ide" element={<IDEProjectsPage selectedPeriod={selectedPeriod} dateOffset={dateOffset} />} />

              <Route path="/external" element={<ExternalPage selectedPeriod={selectedPeriod} dateOffset={dateOffset} onDateOffsetChange={setDateOffset} />} />
              <Route path="/ai" element={<AiPage />} />
              <Route path="/finance" element={<FinancePage />} />
               {/* Legacy routes — kept as redirect for any bookmarked URLs */}
               <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/old-dashboard" element={<Navigate to="/external" replace />} />

              <Route path="/guide" element={<GuidePage />} />

              <Route path="/learn" element={<LearnPage />} />

              <Route path="/ide-help" element={<IDEHelpPage />} />

              <Route path="/terminal" element={<TerminalPage />} />
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
              {/* Pricing Page */}
              <Route path="/pricing" element={<div className="glass rounded-3xl p-8 flex items-center justify-center h-96"><div className="text-center text-zinc-400"><div className="text-4xl mb-4">!</div><div className="text-lg font-medium">Not Yet Added Feature</div><div className="text-sm text-zinc-500 mt-1">Pricing plans are coming soon</div></div></div>} />
              {/* Settings Page */}
<Route path="/settings" element={<SettingsPage logs={logs} appStats={allTimeAppStats} websiteStats={allTimeWebsiteStats} onRegisterSave={handleRegisterSave} onReloadData={loadData} onCategoryOverridesChange={setCategoryOverrides} onHasChangesChange={setSettingsHasChanges} timerBehavior={timerBehavior} setTimerBehavior={setTimerBehavior} trackerAppMode={trackerAppMode} setTrackerAppMode={setTrackerAppMode} externalActivities={externalActivities} externalActivityTiers={externalActivityTiers} onExternalActivityTiersChange={setExternalActivityTiers} showGapBannerSetting={showGapBannerSetting} setShowGapBannerSetting={setShowGapBannerSetting} />} />
            </Routes>
          </AnimatePresence>

          {/* ── Unsaved Changes Warning Modal ── */}
          <AnimatePresence>
            {showUnsavedWarning && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[65]" onClick={() => setShowUnsavedWarning(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="glass rounded-3xl p-8 w-full max-w-sm"
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
                    <p>• Your category assignments and color customizations</p>
                    <p>• will be lost if you navigate away without saving</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSaveAndNavigate}
                      className="w-full py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition text-sm font-medium border border-emerald-500/30"
                    >
                      Save & Navigate
                    </button>
                    <button
                      onClick={handleDiscardChanges}
                      className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-sm font-medium"
                    >
                      Discard Changes
                    </button>
                    <button
                      onClick={() => { setShowUnsavedWarning(false); setPendingNavigation(null); }}
                      className="w-full py-2 rounded-xl text-zinc-500 hover:text-zinc-400 transition text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── Workspace Unsaved Warning Modal ── */}
          <AnimatePresence>
            {showWorkspaceWarning && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center z-[66]" onClick={() => setShowWorkspaceWarning(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="glass rounded-3xl p-8 w-full max-w-sm"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">Unsaved Workspace</div>
                      <div className="text-xs text-zinc-400">You have open terminals.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 mb-6">
                    <p>Save your workspace to preserve open terminals, layout, and sidebar config before leaving.</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleWorkspaceSaveAndNavigate}
                      className="w-full py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition text-sm font-medium border border-emerald-500/30"
                    >
                      {pendingNavigation ? 'Save & Navigate' : 'Save & Close'}
                    </button>
                    <button
                      onClick={handleWorkspaceDiscardChanges}
                      className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-sm font-medium"
                    >
                      {pendingNavigation ? 'Discard & Navigate' : 'Discard & Close'}
                    </button>
                    <button
                      onClick={() => { setShowWorkspaceWarning(false); setPendingNavigation(null); }}
                      className="w-full py-2 rounded-xl text-zinc-500 hover:text-zinc-400 transition text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── Sleep Detection Modal ── */}
          <AnimatePresence>
            {showSleepDetection && sleepDetectionData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70]"
                onClick={dismissSleepDetection}
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.92, opacity: 0 }}
                  className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="text-center mb-6">
                    <div className="flex justify-center mb-3"><Moon className="w-10 h-10 text-indigo-400" /></div>
                    <h2 className="text-xl font-semibold text-zinc-100">Were you sleeping?</h2>
                    <p className="text-zinc-400 mt-2">
                      App was inactive for <span className="text-zinc-200 font-medium">{customDurationMinutes()} minutes</span>
                    </p>
                  </div>

                  <div className="bg-zinc-800/50 rounded-xl p-4 mb-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Device Off</span>
                      <span className="text-sm font-medium text-zinc-200">
                        {formatTimeFromHours(sleepDetectCustomBedtime.hours, sleepDetectCustomBedtime.minutes)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-amber-400/80">
                      <span className="text-sm">Fell asleep at</span>
                      <span className="text-sm font-medium">
                        {formatTimeFromHours(sleepDetectFellAsleepAt.hours, sleepDetectFellAsleepAt.minutes)}
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-500/60 pl-2">
                      {(() => {
                        const off = sleepDetectCustomBedtime.hours * 60 + sleepDetectCustomBedtime.minutes;
                        const asleep = sleepDetectFellAsleepAt.hours * 60 + sleepDetectFellAsleepAt.minutes;
                        let pre = asleep - off;
                        if (pre < 0) pre += 24 * 60;
                        return `+${pre}m pre-sleep`;
                      })()}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Woke Up</span>
                      <span className="text-sm font-medium text-zinc-200">
                        {formatTimeFromHours(sleepDetectWakeUpAt.hours, sleepDetectWakeUpAt.minutes)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Device On</span>
                      <span className="text-sm font-medium text-zinc-200">
                        {formatTimeFromHours(sleepDetectCustomWaketime.hours, sleepDetectCustomWaketime.minutes)}
                      </span>
                    </div>
                    <div className="border-t border-zinc-700/50 pt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Actual Sleep</span>
                        <span className="text-sm font-semibold text-indigo-400">
                          {(() => {
                            const asleep = sleepDetectFellAsleepAt.hours * 60 + sleepDetectFellAsleepAt.minutes;
                            const wake = sleepDetectWakeUpAt.hours * 60 + sleepDetectWakeUpAt.minutes;
                            let s = asleep, w = wake;
                            if (w < s) s -= 24 * 60;
                            const dur = Math.max(0, w - s);
                            return `${Math.floor(dur / 60)}h ${dur % 60}m`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-400">
                        <span className="text-sm">Total inactive</span>
                        <span className="text-sm font-semibold">
                          {Math.floor(customDurationMinutes() / 60)}h {customDurationMinutes() % 60}m
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5 text-center">Device Off (auto)</label>
                      <DurationPicker
                        hours={sleepDetectCustomBedtime.hours}
                        minutes={sleepDetectCustomBedtime.minutes}
                        onHoursChange={(h) => setSleepDetectCustomBedtime({ ...sleepDetectCustomBedtime, hours: h })}
                        onMinutesChange={(m) => setSleepDetectCustomBedtime({ ...sleepDetectCustomBedtime, minutes: m })}
                        maxHours={23}
                        hourLabel="Hr"
                        minuteLabel="Min"
                        wrap={true}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5 text-center">Fell asleep at</label>
                      <DurationPicker
                        hours={sleepDetectFellAsleepAt.hours}
                        minutes={sleepDetectFellAsleepAt.minutes}
                        onHoursChange={(h) => setSleepDetectFellAsleepAt({ ...sleepDetectFellAsleepAt, hours: h })}
                        onMinutesChange={(m) => setSleepDetectFellAsleepAt({ ...sleepDetectFellAsleepAt, minutes: m })}
                        maxHours={23}
                        hourLabel="Hr"
                        minuteLabel="Min"
                        wrap={true}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5 text-center">Woke up at</label>
                      <DurationPicker
                        hours={sleepDetectWakeUpAt.hours}
                        minutes={sleepDetectWakeUpAt.minutes}
                        onHoursChange={(h) => setSleepDetectWakeUpAt({ ...sleepDetectWakeUpAt, hours: h })}
                        onMinutesChange={(m) => setSleepDetectWakeUpAt({ ...sleepDetectWakeUpAt, minutes: m })}
                        maxHours={23}
                        hourLabel="Hr"
                        minuteLabel="Min"
                        wrap={true}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5 text-center">Device On (auto)</label>
                      <DurationPicker
                        hours={sleepDetectCustomWaketime.hours}
                        minutes={sleepDetectCustomWaketime.minutes}
                        onHoursChange={(h) => setSleepDetectCustomWaketime({ ...sleepDetectCustomWaketime, hours: h })}
                        onMinutesChange={(m) => setSleepDetectCustomWaketime({ ...sleepDetectCustomWaketime, minutes: m })}
                        maxHours={23}
                        hourLabel="Hr"
                        minuteLabel="Min"
                        wrap={true}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={dismissSleepDetection}
                      className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm text-zinc-300 transition-colors"
                    >
                      Skip
                    </button>
                    <button
                      onClick={confirmSleepDetection}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl text-sm text-white font-medium hover:from-emerald-400 hover:to-emerald-500 transition-colors duration-150"
                    >
                      Confirm Sleep
                    </button>
                  </div>
                </motion.div>
              </motion.div>
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
                  className="glass rounded-3xl p-8 w-full max-w-sm"
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

                  <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-700 text-xs text-zinc-400 mb-6">
                    <p>• {logs.length} activity records will be exported</p>
                    <p>• File format: <span className="text-zinc-200 uppercase">{showConfirmExport}</span></p>
                    <p>• File stays on your device</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirmExport(null)}
                      className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        exportData(showConfirmExport);
                        setShowConfirmExport(null);
                      }}
                      className="flex-1 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition text-sm font-medium border border-emerald-500/30"
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
                  className="glass rounded-3xl p-8 w-full max-w-4xl max-h-[85vh] flex flex-col"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Code2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-xl">SQLite Activity Logs</div>
                        <div className="text-xs text-zinc-500">TABLE: activity_logs • {allLogs.length} rows • SQLite database</div>
                      </div>
                    </div>
                    <button onClick={() => setShowDatabase(false)} className="text-zinc-400 hover:text-white text-xl">✕</button>
                  </div>

                  {/* Schema Info */}
                  <div className="mb-4 text-xs font-mono bg-zinc-950 rounded-lg p-4 border border-zinc-800 overflow-x-auto">
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
                  <div className="flex-1 overflow-auto border border-zinc-800 rounded-2xl bg-zinc-950">
                    <table className="w-full text-sm font-mono">
                      <thead className="sticky top-0 bg-zinc-900 z-10">
                        <tr className="border-b border-zinc-800 text-left text-zinc-400">
                          <th className="px-4 py-3 font-medium">ID</th>
                          <th className="px-4 py-3 font-medium">Timestamp</th>
                          <th className="px-4 py-3 font-medium">App</th>
                          <th className="px-4 py-3 font-medium">Category</th>
                          <th className="px-4 py-3 font-medium">Duration</th>
                          <th className="px-4 py-3 font-medium">Project</th>
                          <th className="px-4 py-3 font-medium">Title</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {allLogs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                              No records yet. Start tracking to populate the database.
                            </td>
                          </tr>
                        ) : (
                          allLogs.slice(0, 50).map((log, idx) => (
                            <tr key={idx} className="hover:bg-zinc-900/50 transition">
                              <td className="px-4 py-3 text-emerald-400">#{log.id}</td>
                              <td className="px-4 py-3 text-zinc-400">{format(log.timestamp, 'yyyy-MM-dd HH:mm:ss')}</td>
                              <td className="px-4 py-3 text-white font-medium">{log.app}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-xs" style={{
                                  backgroundColor: APP_CATEGORIES[log.app as keyof typeof APP_CATEGORIES]?.color + '22',
                                  color: APP_CATEGORIES[log.app as keyof typeof APP_CATEGORIES]?.color
                                }}>
                                  {log.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 tabular-nums text-white">{log.duration} min</td>
                              <td className="px-4 py-3 text-zinc-400">{log.project || '—'}</td>
                              <td className="px-4 py-3 text-zinc-400 truncate max-w-[200px]">{log.title || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                    <div>Showing {Math.min(50, allLogs.length)} of {allLogs.length} records • Data persists in SQLite database</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const sql = `SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50;`;
                          alert(`Simulated Query:\n\n${sql}\n\n${allLogs.length} rows returned`);
                        }}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded"
                      >
                        Run Query
                      </button>
                      <button
                        onClick={() => exportData('json')}
                        className="px-3 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded"
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
              <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-[60]" onClick={() => setShowSummary(false)}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="glass rounded-3xl p-8 w-full max-w-xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold">AI Productivity Summary</div>
                        <div className="text-xs text-emerald-400">Generated using local heuristics</div>
                      </div>
                    </div>
                    <button onClick={() => setShowSummary(false)} className="text-zinc-400">✕</button>
                  </div>

                  <div className="font-mono text-sm whitespace-pre-wrap bg-zinc-950 p-6 rounded-2xl leading-relaxed border border-zinc-800">
                    {aiSummary}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiSummary);
                        alert('Summary copied to clipboard');
                      }}
                      className="flex-1 py-3 rounded-2xl border border-zinc-700 hover:bg-zinc-900"
                    >
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => exportData('json')}
                      className="flex-1 py-3 rounded-2xl bg-white text-black font-medium"
                    >
                      Export Full Data
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ── AFK Activity Prompt ── */}
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
                queueRemaining={afkPromptQueue.length - 1}
                onConfirm={handleAfkConfirm}
                onDismiss={handleAfkDismiss}
                onNotAfk={() => { pendingIdleRangeRef.current = null; setAfkPromptQueue(prev => prev.slice(1)); }}
                defaultNotAfk={entry.defaultNotAfk}
              />
            );
          })()}

          {/* â”€â”€ Smart Gap Fill Drawer â”€â”€ */}
          {showGapDrawer && (
            <GapFillDrawer
              open={showGapDrawer}
              onClose={() => setShowGapDrawer(false)}
              onFilled={() => { fetchGaps(); }}
            />
          )}
        </div>
      </div>
      <TutorialOverlay />
    </div>
    </TutorialProvider>
  );
}

export default App;

