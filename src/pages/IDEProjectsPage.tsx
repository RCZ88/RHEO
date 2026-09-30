import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import TerminalPage from './TerminalPage';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Code2,
  Terminal,
  GitBranch,
  Package,
  Cpu,
  Database,
  Cloud,
  Plus,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  GitCommit,
  Layers,
  Boxes,
  Zap,
  Clock,
  Activity,
  TrendingUp,
  ExternalLink,
  HelpCircle,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  BarChart3,
  Pencil,
  AlertTriangle,
  Search,
  Minus,
  FolderTree,
  Bot,
  LayoutDashboard,
  FolderGit2,
  Archive,
  FileText,
  Play,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Particles } from '@/components/ui/particles';
import { BorderBeam } from '@/components/ui/border-beam';
import { MagicCard } from '@/components/ui/magic-card';
import { AmbientGlow } from '@/components/ui/ambient-patterns';
import InitializeProgressModal from '../components/InitializeProgressModal';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  BarElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { format, subDays, eachDayOfInterval, formatDistanceToNow } from 'date-fns';
const AnalyticsDashboard = lazy(() => import('../components/AnalyticsDashboard'));
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import FeatureSpecPanel from '../components/FeatureSpecPanel';
import { BackupTabPanel } from '../components/workspace/BackupTabPanel';
import AIToolsTab from '../components/ai/AIToolsTab';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderMechanical } from '../lib/renderers/mechanical';
import { startPhaseClock } from '../lib/currentPhase';

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, BarElement, LineElement, ArcElement, Tooltip, Legend, Filler);

interface Overview {
  ides: any[];
  tools: any[];
  projects: any[];
  aiUsage: { totalTokens: number; totalCost: number; totalMessages?: number; byTool: Record<string, any> };
  commits: { totalCommits: number; totalAdditions: number; totalDeletions: number };
}

interface LanguageBreakdownItem {
  language: string;
  count: number;
  percentage: number;
}

interface ProjectLanguagesResult {
  success: boolean;
  languages: LanguageBreakdownItem[];
  allLanguages: LanguageBreakdownItem[];
  totalFiles: number;
  codingFiles: number;
}

interface AIAgent {
  id: string;
  name: string;
  icon: string;
  color: string;
  tokens: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  sessions: number;
  messageCount: number;
  status: 'active' | 'idle' | 'inactive' | 'error';
  lastUsed?: Date;
  models: string[];
}

const CATEGORY_ICONS: Record<string, any> = {
  versionControl: GitBranch,
  runtimes: Cpu,
  packageManagers: Package,
  containers: Boxes,
  buildTools: Layers,
  databases: Database,
  cloud: Cloud,
  'npm-package': Package,
  linter: Code2,
  formatter: Code2,
  'type-checker': Code2,
  'test-runner': Zap,
  bundler: Layers,
};

const CATEGORY_LABELS: Record<string, string> = {
  versionControl: 'Version Control',
  runtimes: 'Runtimes',
  packageManagers: 'Package Managers',
  containers: 'Containers',
  buildTools: 'Build Tools',
  databases: 'Databases',
  cloud: 'Cloud & IaC',
  'npm-package': 'NPM Packages',
  linter: 'Linters',
  formatter: 'Formatters',
  'type-checker': 'Type Checkers',
  'test-runner': 'Test Runners',
  bundler: 'Bundlers',
};

const COMMON_LANGUAGES = [
  'Assembly', 'Astro', 'C', 'C#', 'C++', 'Clojure', 'CoffeeScript', 'CSS', 'Crystal',
  'D', 'Dart', 'Dockerfile', 'Elixir', 'Elm', 'Erlang', 'F#', 'Fortran', 'Go', 'GraphQL',
  'Groovy', 'HTML', 'Haskell', 'Java', 'JavaScript', 'Julia', 'JSON', 'Kotlin',
  'Less', 'Lua', 'MATLAB', 'Markdown', 'Nim', 'OCaml', 'Objective-C', 'PHP', 'Perl',
  'PowerShell', 'Prolog', 'Python', 'R', 'Ruby', 'Rust', 'SQL', 'Sass/SCSS', 'Scala',
  'Shell', 'Solidity', 'Svelte', 'Swift', 'TOML', 'TypeScript', 'V', 'Vue', 'WGSL',
  'XML', 'YAML', 'Zig',
];

const AGENT_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  'claude-code': { name: 'Claude Code', icon: 'claude', color: '#f97316' },
  'cursor': { name: 'Cursor AI', icon: 'cursor', color: '#a855f7' },
  'opencode': { name: 'OpenCode', icon: 'opencode', color: '#3b82f6' },
  'gemini': { name: 'Gemini CLI', icon: 'gemini', color: '#22c55e' },
  'codex': { name: 'Codex CLI', icon: 'codex', color: '#10b981' },
  'qwen': { name: 'Qwen CLI', icon: 'qwen', color: '#f59e0b' },
  'aider': { name: 'Aider', icon: 'aider', color: '#f59e0b' },
  'kilocode': { name: 'KiloCode', icon: 'kilocode', color: '#22c55e' },
  'hermes': { name: 'Hermes', icon: 'hermes', color: '#8b5cf6' },
};

const PROVIDER_MAP: Record<string, string> = {
  'claude-code': 'Anthropic',
  'cursor': 'Anthropic',
  'opencode': 'OpenCode',
  'gemini': 'Google',
  'codex': 'OpenAI',
  'qwen': 'Alibaba',
  'aider': 'Aider',
  'kilocode': 'KiloCode',
  'hermes': 'Hermes',
};

const MODEL_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6', '#8b5cf6'];

function getAgentColor(agentId: string): string {
  try {
    const saved = localStorage.getItem('deskflow-agent-colors');
    if (saved) {
      const overrides = JSON.parse(saved);
      if (overrides[agentId]) return overrides[agentId];
    }
  } catch {}
  return AGENT_CONFIG[agentId]?.color || '#6366f1';
}

const AGENT_LIMITS: Record<string, number> = {
  'opencode': 3500000,
  'claude-code': 1000000,
  'cursor': 500000,
  'gemini': 2000000,
  'codex': 1000000,
  'qwen': 3000000,
  'aider': 1000000,
  'kilocode': 2000000,
  'hermes': 2000000,
};

function FreeUsageStats({ agent, dailyUsage, formatTokens }: { agent: AIAgent; dailyUsage: Record<string, any>; formatTokens: (v: number) => string }) {
  const limit = AGENT_LIMITS[agent.id] || 0;
  if (limit === 0) return null;

  const calculateStats = (days: number) => {
    const periodDays = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() });
    let actualUsage = 0;
    let daysWithData = 0;

    for (const d of periodDays) {
      const dayStr = format(d, 'yyyy-MM-dd');
      if (dailyUsage[dayStr]) {
        actualUsage += dailyUsage[dayStr].tokens || 0;
        daysWithData++;
      }
    }

    const totalLimit = limit * days;
    const avgDaily = days > 0 ? actualUsage / days : 0;
    const isEstimated = daysWithData > 0 && daysWithData < days;
    const estimatedTotal = isEstimated ? avgDaily * days : actualUsage;
    const available = Math.max(0, totalLimit - estimatedTotal);
    const overLimit = estimatedTotal > totalLimit;
    const usagePercent = totalLimit > 0 ? Math.min(100, Math.round((estimatedTotal / totalLimit) * 100)) : 0;

    return { available, isEstimated, overLimit, usagePercent, avgDaily, actualUsage, totalLimit, daysWithData, estimatedTotal, timeframeDays: days };
  };

  const day = calculateStats(1);
  const week = calculateStats(7);
  const month = calculateStats(30);

  const StatCard = ({ label, stats }: { label: string; stats: ReturnType<typeof calculateStats> }) => (
    <div className="bg-[var(--color-card)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 flex flex-col text-center">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">{label}</div>
      
      {/* Usage bar */}
      <div className="w-full h-1.5 bg-zinc-800 light:bg-zinc-100 rounded-full mb-2 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${stats.overLimit ? 'bg-red-500' : stats.usagePercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(100, stats.usagePercent)}%` }}
        />
      </div>

      {/* Usage vs Limit */}
      <div className="text-[10px] text-zinc-400 mb-1">
        <span className={stats.overLimit ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
          {formatTokens(stats.estimatedTotal)}
        </span>
        <span className="text-zinc-600"> / {formatTokens(stats.totalLimit)}</span>
      </div>

      {/* Average daily */}
      <div className="text-[9px] text-zinc-500 mb-1.5">
        Avg: <span className="text-zinc-400">{formatTokens(stats.avgDaily)}</span>/day
      </div>

      {/* Available or Over limit */}
      {stats.overLimit ? (
        <div className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[8px] text-red-400 font-medium">
          Over limit by {formatTokens(stats.estimatedTotal - stats.totalLimit)}
        </div>
      ) : (
        <div className="text-sm font-bold text-emerald-400">
          {formatTokens(stats.available)}
          <div className="text-[9px] text-zinc-600 font-normal mt-0.5">tokens left</div>
        </div>
      )}

      {/* Estimated badge */}
      {stats.isEstimated && (
        <div className="mt-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] text-amber-500/80 font-medium uppercase tracking-tighter">
          Estimated ({stats.daysWithData}/{stats.timeframeDays} days)
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-[var(--color-card)] rounded-lg p-4 mb-6 border border-emerald-500/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Usage vs Daily Limit</h4>
            <p className="text-[10px] text-zinc-500">Daily allowance: {formatTokens(limit)} tokens/day</p>
          </div>
        </div>
        <div className="text-[10px] text-zinc-500">
          {agent.name}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Today" stats={day} />
        <StatCard label="This Week" stats={week} />
        <StatCard label="This Month" stats={month} />
      </div>
      <div className="mt-4 flex items-start gap-2 p-2 rounded-lg bg-[var(--color-card)] border border-[rgba(255,255,255,0.06)]">
        <div className="w-1 h-1 rounded-full bg-zinc-700 light:bg-zinc-200 mt-1.5" />
        <p className="text-[10px] text-zinc-500 leading-relaxed italic">
          Based on your average daily usage of {formatTokens(week.avgDaily)} tokens. 
          Limits are estimated free tier allowances — actual limits may vary by provider.
        </p>
      </div>
    </div>
  );
}

type TabKey = 'overview' | 'projects' | 'ai' | 'git' | 'environment' | 'analytics' | 'backup';

const TAB_KEYS: TabKey[] = ['overview', 'projects', 'ai', 'git', 'environment', 'analytics', 'backup'];

const TAB_HOVER = { scale: 1.02 };
const TAB_TAP = { scale: 0.98 };
const TAB_LAYOUT = { type: "tween" as const, duration: 200, ease: "easeOutExpo" };

const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'projects', label: 'Projects', icon: FolderGit2 },
  { key: 'ai', label: 'AI Tools', icon: Bot },
  { key: 'git', label: 'Git', icon: GitBranch },
  { key: 'environment', label: 'Environment', icon: Boxes },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'backup', label: 'Backup', icon: Archive },
];

// Back-compat: retired keys map to their new home.
const TAB_MIGRATION: Record<string, TabKey> = {
  ides: 'environment',
  tools: 'environment',
  trash: 'backup',
};

interface IDEProjectsPageProps {
  selectedPeriod?: string;
  dateOffset?: number;
}

export default function IDEProjectsPage({ selectedPeriod = 'week', dateOffset = 0 }: IDEProjectsPageProps) {
  useEffect(() => { startPhaseClock(); }, []);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', path: '', repositoryUrl: '', defaultIde: '' });
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('ide-projects-activeTab') || '';
    const resolved = (TAB_MIGRATION[saved] ?? saved) as TabKey;
    return TAB_KEYS.includes(resolved) ? resolved : 'overview';
  });
  const location = useLocation();
  useEffect(() => {
    const tab = (location.state as any)?.tab;
    if (tab) setActiveTab(tab);
  }, []);
  const commitHistoryRef = useRef<any[]>([]);
  const [commitHistory, setCommitHistory] = useState<any[]>([]);
  const [workspaceAnalytics, setWorkspaceAnalytics] = useState<{ aiUsage: any; sessions: any[]; problems: any[]; requests: any[]; promptHistory: any[]; codeStats: any; codeActivity?: any } | null>(null);
  const [codeActivity, setCodeActivity] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const analyticsCacheRef = useRef<{ data: typeof workspaceAnalytics; timestamp: number } | null>(null);
  const analyticsReqIdRef = useRef(0);
  const [contributorStats, setContributorStats] = useState<any>(null);
  const [doraMetrics, setDoraMetrics] = useState<any>(null);
  const [syncingGit, setSyncingGit] = useState(false);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [gitDiff, setGitDiff] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [generatedCommitMsg, setGeneratedCommitMsg] = useState<string | null>(null);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [aiChartMode, setAiChartMode] = useState<'tokens' | 'messages' | 'cost' | 'sessions'>('tokens');
  const [tokenDisplayMode, setTokenDisplayMode] = useState<'combined' | 'input' | 'output'>('combined');
  const [timeLock, setTimeLock] = useState(() => {
    try { return localStorage.getItem('ide-projects-ai-lock') === 'true'; } catch { return false; }
  });
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AIAgent | null>(null);
  const [agentDebugInfo, setAgentDebugInfo] = useState<any>(null);
  const [logScale, setLogScale] = useState(() => localStorage.getItem('ide-projects-log-scale') === 'true');
  const [excludeOutliers, setExcludeOutliers] = useState(() => localStorage.getItem('ide-projects-exclude-outliers') === 'true');
  const [modalPeriod, setModalPeriod] = useState<'today' | 'week' | '7day' | 'month' | '30day' | 'all'>('all');
  const [modalExpandedPeriod, setModalExpandedPeriod] = useState<string | null>(null);
  const [modalOverview, setModalOverview] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const effectiveAiPeriod = useMemo<'week' | 'month' | 'all'>(() => {
    if (timeLock) return 'all';
    switch (selectedPeriod) {
      case 'all': return 'all';
      case 'month':
      case '30day': return 'month';
      default: return 'week';
    }
  }, [selectedPeriod, timeLock]);

  const modalEffectivePeriod = useMemo<'week' | 'month' | 'all'>(() => {
    switch (modalPeriod) {
      case 'all': return 'all';
      case 'month':
      case '30day': return 'month';
      case 'today': return 'week';
      default: return 'week';
    }
  }, [modalPeriod]);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [quickAddProjects, setQuickAddProjects] = useState<{ ide: string; projects: { name: string; path: string }[] }[]>([]);
  const [loadingQuickAdd, setLoadingQuickAdd] = useState(false);
  const [selectedQuickProjects, setSelectedQuickProjects] = useState<Set<string>>(new Set());
  const [savedCustomDirs, setSavedCustomDirs] = useState<string[]>([]);
  const [customDirResults, setCustomDirResults] = useState<Record<string, { name: string; path: string; languages: string[]; fileCount: number }[]>>({});
  const [scanningDirs, setScanningDirs] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ide-projects-expandedProjects');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [projectDetailsCache, setProjectDetailsCache] = useState<Record<string, any>>({});
  const [loadingProjectDetails, setLoadingProjectDetails] = useState<Set<string>>(new Set());
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [workspaceProject, setWorkspaceProject] = useState<any>(null);
  const [provisionStatus, setProvisionStatus] = useState<'idle' | 'provisioning' | 'provisioned'>('idle');
  const [showInitModal, setShowInitModal] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [projectLanguages, setProjectLanguages] = useState<Record<string, LanguageBreakdownItem[]>>({});
  const [projectLanguagesLoading, setProjectLanguagesLoading] = useState(false);
  const [showLanguageStats, setShowLanguageStats] = useState(true);
  const scannedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handler = (e: CustomEvent<{ status: 'idle' | 'provisioning' | 'provisioned' }>) => setProvisionStatus(e.detail.status);
    window.addEventListener('provision-status-changed', handler as EventListener);
    return () => window.removeEventListener('provision-status-changed', handler as EventListener);
  }, []);

  // Edit/Delete project states
  const [showEditProject, setShowEditProject] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editProjectForm, setEditProjectForm] = useState({
    name: '', path: '', repositoryUrl: '', vcsType: '', primaryLanguage: '', defaultIde: ''
  });
  const [updatingProject, setUpdatingProject] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const [detectingLanguage, setDetectingLanguage] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingProjectName, setDeletingProjectName] = useState<string>('');
  const [showTrashBin, setShowTrashBin] = useState(false);
  const [trashProjects, setTrashProjects] = useState<any[]>([]);

  // Run Project feature state
  const [runningTerminals, setRunningTerminals] = useState<Map<string, { terminalId: string; command: string; startedAt: number }>>(new Map());
  const [showRunConfig, setShowRunConfig] = useState(false);
  const [runConfigProject, setRunConfigProject] = useState<any>(null);
  const [runConfigData, setRunConfigData] = useState<any>(null);
  const [detectedScripts, setDetectedScripts] = useState<any>(null);
  const [runningProjectLoading, setRunningProjectLoading] = useState<string | null>(null);

  const loadRunningProjects = useCallback(async () => {
    try {
      const result = await window.deskflowAPI!.getRunningProjects();
      if (result.success) {
        const map = new Map<string, { terminalId: string; command: string; startedAt: number }>();
        for (const r of result.running) {
          map.set(r.projectId, { terminalId: r.terminalId, command: r.command, startedAt: r.startedAt });
        }
        setRunningTerminals(map);
      }
    } catch {}
  }, []);

  useEffect(() => { loadRunningProjects(); }, []);

  // Load persisted custom scan directories from disk (not localStorage)
  useEffect(() => {
    window.deskflowAPI?.getCustomScanDirs()?.then((dirs: string[]) => {
      if (dirs && dirs.length > 0) setSavedCustomDirs(dirs);
    }).catch(() => {});
  }, []);

  const handleRunProject = async (project: any) => {
    try {
      setRunningProjectLoading(project.id);
      // First check if we have a run config
      const configResult = await window.deskflowAPI!.getProjectRunConfig(project.id);
      if (configResult.success && configResult.config) {
        // Run with existing config
        const runResult = await window.deskflowAPI!.runProject(project.id, configResult.config);
        if (runResult.success) {
          await loadRunningProjects();
          // If it's a web project with a port, open browser
          if (configResult.config.single?.port) {
            window.deskflowAPI!.openUrl(`http://localhost:${configResult.config.single.port}`);
          }
        }
      } else {
        // No config - try to detect scripts first
        const detected = await window.deskflowAPI!.detectProjectScripts(project.path);
        setDetectedScripts(detected);
        setRunConfigProject(project);
        if (detected.success && (detected.single || detected.frontend || detected.backend)) {
          // Auto-run if detected
          const autoConfig: any = {};
          if (detected.single) autoConfig.single = { command: detected.single.command };
          if (detected.frontend) autoConfig.frontend = { command: detected.frontend.command };
          if (detected.backend) autoConfig.backend = { command: detected.backend.command };
          const runResult = await window.deskflowAPI!.runProject(project.id, autoConfig);
          if (runResult.success) {
            await loadRunningProjects();
            if (detected.single?.port) {
              window.deskflowAPI!.openUrl(`http://localhost:${detected.single.port}`);
            }
          }
        } else {
          // Show config modal for manual setup
          setShowRunConfig(true);
        }
      }
    } catch (err: any) {
      console.error('[Run Project] Error:', err);
    } finally {
      setRunningProjectLoading(null);
    }
  };

  const handleStopProject = async (projectId: string) => {
    try {
      const terminal = runningTerminals.get(projectId);
      if (terminal) {
        await window.deskflowAPI!.stopProject(terminal.terminalId);
        await loadRunningProjects();
      }
    } catch (err: any) {
      console.error('[Stop Project] Error:', err);
    }
  };

  const handleSaveRunConfig = async (config: any) => {
    if (!runConfigProject) return;
    try {
      await window.deskflowAPI!.saveProjectRunConfig(runConfigProject.id, config);
      setRunConfigData(config);
      setShowRunConfig(false);
      // Run with the new config
      const runResult = await window.deskflowAPI!.runProject(runConfigProject.id, config);
      if (runResult.success) {
        await loadRunningProjects();
        if (config.single?.port) {
          window.deskflowAPI!.openUrl(`http://localhost:${config.single.port}`);
        }
      }
    } catch (err: any) {
      console.error('[Save Run Config] Error:', err);
    }
  };

  const handleOpenInBrowser = async (port: number) => {
    try {
      await window.deskflowAPI!.openUrl(`http://localhost:${port}`);
    } catch {}
  };

  useEffect(() => {
    localStorage.setItem('ide-projects-onboarding-seen', 'true');
    const p = activeTab === 'ai' ? effectiveAiPeriod : selectedPeriod;
    loadOverview(p, dateOffset);
  }, [selectedPeriod, dateOffset, activeTab, effectiveAiPeriod]);

  useEffect(() => {
    if (activeTab === 'git' && overview?.projects && overview.projects.length > 0) {
      if (!selectedProject) {
        setSelectedProject(overview.projects[0].id);
      }
    }
  }, [activeTab, overview, selectedProject]);

  useEffect(() => {
    if (activeTab === 'git' && selectedProject) {
      loadGitData(selectedProject);
    }
  }, [selectedProject, activeTab]);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('ide-projects-activeTab', activeTab);
  }, [activeTab]);

  // Persist expanded projects to localStorage
  useEffect(() => {
    localStorage.setItem('ide-projects-expandedProjects', JSON.stringify([...expandedProjects]));
  }, [expandedProjects]);

  useEffect(() => {
    localStorage.setItem('ide-projects-ai-lock', String(timeLock));
  }, [timeLock]);
  useEffect(() => {
    localStorage.setItem('ide-projects-log-scale', String(logScale));
  }, [logScale]);
  useEffect(() => {
    localStorage.setItem('ide-projects-exclude-outliers', String(excludeOutliers));
  }, [excludeOutliers]);

  const fetchAnalytics = useCallback(async () => {
    if (!window.deskflowAPI) return;
    const reqId = ++analyticsReqIdRef.current;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const effectivePeriod = activeTab === 'ai' ? effectiveAiPeriod : selectedPeriod;
      const effectiveOffset = dateOffset;

      console.log('[IDEProjectsPage] Fetching analytics data for period:', effectivePeriod);
      const [aiUsageSummary, problems, requests, sessions, promptHistory, codeStats, codeActivityResult] = await Promise.all([
        window.deskflowAPI.getAIUsageSummary(effectivePeriod, effectiveOffset).catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch AI usage summary:', err);
          return null;
        }),
        window.deskflowAPI.getProblems().catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch problems:', err);
          return [];
        }),
        window.deskflowAPI.getRequests().catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch requests:', err);
          return [];
        }),
        window.deskflowAPI.getTerminalSessions?.(undefined, 500).catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch sessions:', err);
          return [];
        }),
        window.deskflowAPI.getPromptHistory?.({ limit: 1000 }).catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch prompt history:', err);
          return [];
        }),
        window.deskflowAPI.getCodeChangeStats?.(effectivePeriod, effectiveOffset, selectedProject || undefined).catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch code change stats:', err);
          return null;
        }),
        window.deskflowAPI.getCodeActivityStats?.(effectivePeriod, effectiveOffset, selectedProject || undefined).catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch code activity stats:', err);
          return null;
        }),
      ]);

      // Progressive data rendering - process in chunks to prevent UI freezing
      setTimeout(() => {
        if (reqId !== analyticsReqIdRef.current) return; // stale response
        const data = {
          aiUsage: aiUsageSummary || null,
          problems: problems?.data || problems || [],
          requests: requests?.data || requests || [],
          sessions: sessions?.data || sessions || [],
          promptHistory: promptHistory || [],
          codeStats: codeStats || null,
          codeActivity: codeActivityResult || null,
        };
        analyticsCacheRef.current = { data, timestamp: Date.now() };
        setWorkspaceAnalytics(data);
        setCodeActivity(codeActivityResult || null);
        setAnalyticsLoading(false);
      }, 100); // Small delay to allow UI to render loading state

    } catch (err) {
      if (reqId !== analyticsReqIdRef.current) return; // stale
      console.error('[IDEProjectsPage] Failed to fetch workspace analytics:', err);
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
      setAnalyticsLoading(false);
    }
  }, [selectedPeriod, dateOffset, effectiveAiPeriod, activeTab]);

  // Fetch workspace analytics when ai or analytics tab is active
  useEffect(() => {
    if ((activeTab !== 'analytics' && activeTab !== 'ai') || !window.deskflowAPI) return;
    // Bypass cache when period changes so data stays in sync
    analyticsCacheRef.current = null;
    fetchAnalytics();
  }, [activeTab, selectedPeriod, dateOffset, effectiveAiPeriod, fetchAnalytics]);

  // Fetch modal data independently — modal has its own period selector
  const modalFetchReqIdRef = useRef(0);
  useEffect(() => {
    if (!selectedAgentDetail || !window.deskflowAPI) {
      setModalOverview(null);
      return;
    }
    let cancelled = false;
    const reqId = ++modalFetchReqIdRef.current;
    setModalLoading(true);

    // Map modalPeriod to the period string the backend expects
    const backendPeriod = modalPeriod === 'today' ? 'today'
      : modalPeriod === 'week' ? 'week'
      : modalPeriod === '7day' ? '7day'
      : modalPeriod === 'month' ? 'month'
      : modalPeriod === '30day' ? '30day'
      : 'all';

    console.log('[Modal] Fetching overview for period:', backendPeriod, 'agent:', selectedAgentDetail.id);
    window.deskflowAPI.getIDEProjectsOverview(backendPeriod, 0).then((overviewData) => {
      if (cancelled || reqId !== modalFetchReqIdRef.current) return;
      console.log('[Modal] Overview loaded, aiUsage byTool keys:', Object.keys(overviewData?.aiUsage?.byTool || {}));
      setModalOverview(overviewData);
      setModalLoading(false);
    }).catch((err) => {
      console.error('[Modal] Failed to load overview:', err);
      if (!cancelled && reqId === modalFetchReqIdRef.current) {
        setModalOverview(null); // Fall back to page overview
        setModalLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedAgentDetail, modalPeriod]);

  // Modal data source: prefer modalOverview (independent fetch), fall back to page overview
  const modalData = modalOverview || overview;

  const loadGitData = async (projectId: string) => {
    try {
      const [commits, contributors, dora] = await Promise.all([
        window.deskflowAPI!.getCommitHistory(projectId, 50),
        window.deskflowAPI!.getContributorStats(projectId),
        window.deskflowAPI!.getDORAMetrics(projectId, 'month'),
      ]);
      setCommitHistory(commits);
      setContributorStats(contributors);
      setDoraMetrics(dora);
    } catch (err) {
      console.error('Failed to load git data:', err);
    }
  };

  const handleSyncGit = async () => {
    if (!selectedProject) return;
    setSyncingGit(true);
    try {
      const project = overview?.projects?.find((p: any) => p.id === selectedProject);
      if (project?.repository_url) {
        const urlParts = project.repository_url.replace('https://', '').split('/');
        const token = localStorage.getItem('github_token');
        await window.deskflowAPI!.syncGitHubCommits(
          selectedProject,
          urlParts[1],
          urlParts[2],
          token || undefined
        );
      } else {
        await window.deskflowAPI!.syncCommits(selectedProject, project?.path);
      }
      await loadGitData(selectedProject);
      await loadOverview();
    } catch (err) {
      console.error('Git sync failed:', err);
    }
    setSyncingGit(false);
  };

  const loadOverview = async (period?: string, offset?: number) => {
    setLoading(true);
    try {
      const effectivePeriod = period ?? (activeTab === 'ai' ? effectiveAiPeriod : selectedPeriod);
      const effectiveOffset = offset ?? dateOffset;

      console.log('[IDEProjectsPage] Loading overview for period:', effectivePeriod, 'offset:', effectiveOffset, 'activeTab:', activeTab);

      const [data, caData] = await Promise.all([
        window.deskflowAPI!.getIDEProjectsOverview(effectivePeriod, effectiveOffset),
        window.deskflowAPI!.getCodeActivityStats?.(effectivePeriod, effectiveOffset, selectedProject || undefined).catch(err => {
          console.error('[IDEProjectsPage] Failed to fetch code activity stats:', err);
          return null;
        }),
      ]);
      console.log('[IDEProjectsPage] Overview loaded, projects:', data?.projects?.length);
      setOverview(data);
      setCodeActivity(caData || data?.codeActivity || null);
      setLoading(false);
    } catch (err) {
      console.error('[IDEProjectsPage] Failed to load IDE projects overview:', err);
      setLoading(false);
    }
  };

  const scanProjectLanguages = useCallback(async (projects: any[]) => {
    if (!window.deskflowAPI?.detectProjectsLanguages || !projects?.length) return;
    const paths = projects.filter((p: any) => p.path).map((p: any) => p.path);
    const uncached = paths.filter(p => !scannedPathsRef.current.has(p));
    if (uncached.length === 0) return;

    setProjectLanguagesLoading(true);
    try {
      const results = await window.deskflowAPI.detectProjectsLanguages(uncached);
      setProjectLanguages(prev => {
        const next = { ...prev };
        for (const [path, result] of Object.entries(results)) {
          const r = result as ProjectLanguagesResult;
          if (r.success && r.languages) {
            next[path] = r.languages;
            scannedPathsRef.current.add(path);
          }
        }
        return next;
      });
    } catch (err) {
      console.error('[IDEProjectsPage] Failed to scan project languages:', err);
    } finally {
      setProjectLanguagesLoading(false);
    }
  }, []);

  // Detect languages when projects or analytics tab becomes active
  useEffect(() => {
    if (activeTab !== 'projects' && activeTab !== 'analytics') return;
    if (!overview?.projects?.length) return;
    scanProjectLanguages(overview.projects);
  }, [activeTab, overview?.projects, scanProjectLanguages]);

  const aggregatedProjectLanguages = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const langs of Object.values(projectLanguages)) {
      for (const { language, count } of langs) {
        totals[language] = (totals[language] || 0) + count;
      }
    }
    return Object.entries(totals)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);
  }, [projectLanguages]);


  const handleAddProject = async () => {
    setAddProjectError(null);
    setAddingProject(true);

    try {
      // Collect all paths to add: selected quick-add projects + the manual form entry
      const pathsToAdd: { name: string; path: string; repositoryUrl: string; defaultIde: string }[] = [];

      // Gather all projects from quick-add selections and custom dir selections
      const quickSelectedPaths = new Set(selectedQuickProjects);
      const allScanProjects = [
        ...(quickAddProjects?.flatMap(g => g.projects) ?? []),
        ...Object.values(customDirResults).flat()
      ];
      const seen = new Set<string>();
      for (const p of allScanProjects) {
        if (quickSelectedPaths.has(p.path) && !seen.has(p.path)) {
          pathsToAdd.push({ name: p.name, path: p.path, repositoryUrl: '', defaultIde: '' });
          seen.add(p.path);
        }
      }

      // Add the manual form entry if it's filled in and not already in the list
      if (newProject.name && newProject.path) {
        const alreadyInList = pathsToAdd.some(p => p.path === newProject.path);
        if (!alreadyInList) {
          pathsToAdd.push({ ...newProject });
        }
      }

      if (pathsToAdd.length === 0) {
        setAddProjectError('Select a project from the list above or fill in the form');
        setAddingProject(false);
        return;
      }

      // Pre-load ACTIVE project paths so we can skip duplicates silently
      // (soft-deleted projects are NOT included — the backend will restore them)
      let existingPaths: Set<string> = new Set();
      try {
        const existing = await window.deskflowAPI!.getProjects() as any[];
        existingPaths = new Set(existing.map((p: any) => p.path));
      } catch {}

      let addedCount = 0;
      let skippedCount = 0;
      let lastError: string | null = null;
      for (const proj of pathsToAdd) {
        if (existingPaths.has(proj.path)) {
          skippedCount++;
          continue;
        }
        const result = await window.deskflowAPI!.addProject(proj);
        if (!result.success) {
          lastError = result.message || `Failed to add ${proj.name}`;
        } else {
          addedCount++;
          existingPaths.add(proj.path);
        }
      }

      if (lastError && addedCount === 0) {
        setAddProjectError(lastError);
      } else if (addedCount > 0 || skippedCount > 0) {
        setShowAddProject(false);
        setNewProject({ name: '', path: '', repositoryUrl: '', defaultIde: '' });
        setSelectedQuickProjects(new Set());
        setAddProjectError(null);
        console.log('[IDEProjectsPage] Added', addedCount, 'skipped', skippedCount, 'projects, refreshing overview');
        await loadOverview();
        console.log('[IDEProjectsPage] Overview refresh complete');
      }
    } catch (err: any) {
      console.error('Failed to add project:', err);
      setAddProjectError(err.message || 'An error occurred');
    } finally {
      setAddingProject(false);
    }
  };

  const handleOpenProject = async (projectId: string, ideId?: string) => {
    try {
      console.log('[IDEProjectsPage] Opening project:', projectId, 'with IDE:', ideId);
      const result = await window.deskflowAPI!.openProject(projectId, ideId);
      console.log('[IDEProjectsPage] Open result:', result);
      if (!result.success) {
        console.error('Failed to open project:', result.message);
        alert('Failed to open project: ' + result.message);
      } else {
        alert('Project opened in ' + result.ide);
      }
    } catch (err) {
      console.error('Failed to open project:', err);
      alert('Error opening project: ' + err);
    }
  };

  const handleEditProjectClick = (project: any) => {
    setEditingProject(project);
    setEditProjectForm({
      name: project.name || '',
      path: project.path || '',
      repositoryUrl: project.repository_url || '',
      vcsType: project.vcs_type || '',
      primaryLanguage: project.primary_language || '',
      defaultIde: project.default_ide || ''
    });
    setShowEditProject(true);
    setLanguageSearch('');
    setShowLanguageDropdown(false);
  };

  const handleLanguageSelect = (lang: string) => {
    setEditProjectForm({ ...editProjectForm, primaryLanguage: lang });
    setShowLanguageDropdown(false);
  };

  const handleDetectLanguage = async () => {
    if (!editProjectForm.path) return;
    setDetectingLanguage(true);
    try {
      const result = await window.deskflowAPI!.detectProjectLanguage(editProjectForm.path);
      if (result.success && result.language) {
        setEditProjectForm({ ...editProjectForm, primaryLanguage: result.language });
        setShowLanguageDropdown(false);
      }
    } catch (err) {
      console.error('Failed to detect language:', err);
    } finally {
      setDetectingLanguage(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    if (!editProjectForm.name || !editProjectForm.path) {
      setAddProjectError('Project name and path are required');
      return;
    }
    setAddProjectError(null);
    setUpdatingProject(true);

    try {
      const result = await window.deskflowAPI!.updateProject(editingProject.id, {
        name: editProjectForm.name,
        path: editProjectForm.path,
        repositoryUrl: editProjectForm.repositoryUrl || undefined,
        vcsType: editProjectForm.vcsType || undefined,
        primaryLanguage: editProjectForm.primaryLanguage || undefined,
        defaultIde: editProjectForm.defaultIde || undefined
      });
      if (result.success) {
        setShowEditProject(false);
        setEditingProject(null);
        setEditProjectForm({ name: '', path: '', repositoryUrl: '', vcsType: '', primaryLanguage: '', defaultIde: '' });
        await loadOverview();
      } else {
        setAddProjectError(result.message || 'Failed to update project');
      }
    } catch (err: any) {
      console.error('Failed to update project:', err);
      setAddProjectError(err.message || 'An error occurred');
    } finally {
      setUpdatingProject(false);
    }
  };

  const handleDeleteClick = (project: any) => {
    setDeletingProjectId(project.id);
    setDeletingProjectName(project.name);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProjectId) return;
    try {
      await window.deskflowAPI!.deleteProject(deletingProjectId);
      await loadOverview();
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setShowDeleteConfirm(false);
      setDeletingProjectId(null);
      setDeletingProjectName('');
    }
  };

  const handleRestoreProject = async (projectId: string) => {
    try {
      await window.deskflowAPI!.restoreProject(projectId);
      await loadOverview();
      await loadTrashProjects();
    } catch (err) {
      console.error('Failed to restore project:', err);
    }
  };

  const handlePermanentDelete = async (projectId: string) => {
    if (!confirm('This will permanently delete the project and cannot be undone. Are you sure?')) return;
    try {
      await window.deskflowAPI!.removeProject(projectId);
      await loadTrashProjects();
    } catch (err) {
      console.error('Failed to permanently delete project:', err);
    }
  };

  const loadTrashProjects = async () => {
    try {
      const allProjects = await window.deskflowAPI!.getAllProjects();
      setTrashProjects(allProjects.filter((p: any) => p.deleted_at));
    } catch (err) {
      console.error('Failed to load trash projects:', err);
    }
  };

  const handleRemoveProject = async (projectId: string) => {
    try {
      await window.deskflowAPI!.removeProject(projectId);
      await loadOverview();
    } catch (err) {
      console.error('Failed to remove project:', err);
    }
  };

  const handleCloseWorkspace = useCallback(() => {
    setIsWorkspaceOpen(false);
    setWorkspaceProject(null);
  }, []);

  const toggleProjectExpand = async (project: any) => {
    const projectId = project.id;
    const newExpanded = new Set(expandedProjects);
    
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
      setExpandedProjects(newExpanded);
    } else {
      newExpanded.add(projectId);
      setExpandedProjects(newExpanded);
      
      if (!projectDetailsCache[projectId] && !loadingProjectDetails.has(projectId)) {
        setLoadingProjectDetails(new Set(loadingProjectDetails).add(projectId));
        try {
          const details = await window.deskflowAPI!.getProjectDetails(projectId);
          setProjectDetailsCache(prev => ({
            ...prev,
            [projectId]: {
              project: details.project,
              tools: details.tools,
              sessions: details.sessions,
              health: details.health,
              presets: details.presets,
              aiUsage: details.aiUsage
            }
          }));
        } catch (err) {
          console.error('Failed to load project details:', err);
        } finally {
          setLoadingProjectDetails(prev => {
            const newSet = new Set(prev);
            newSet.delete(projectId);
            return newSet;
          });
        }
      }
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1e15) return `${(tokens / 1e15).toFixed(1)}Qi`;
    if (tokens >= 1e12) return `${(tokens / 1e12).toFixed(1)}T`;
    if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(1)}B`;
    if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`;
    if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1)}K`;
    return tokens.toString();
  };

  const TokenValue = ({ value }: { value: number }) => {
    const [showFull, setShowFull] = useState(false);
    return (
      <span className="inline-flex flex-col items-center leading-tight cursor-pointer" onClick={() => setShowFull(!showFull)} title={showFull ? 'Click for abbreviated' : 'Click for full number'}>
        {showFull ? (
          <span className="text-[10px] text-zinc-400 font-normal">{value.toLocaleString()}</span>
        ) : (
          <span>{formatTokens(value)}</span>
        )}
        {value > 0 && (
          <span className="text-[9px] text-zinc-600 font-normal opacity-50 hover:opacity-100 transition-opacity">
            {showFull ? 'abbreviated' : 'full'}
          </span>
        )}
      </span>
    );
  };

  const CostValue = ({ value }: { value: number }) => {
    const [showFull, setShowFull] = useState(false);
    return (
      <span className="inline-flex flex-col items-center leading-tight cursor-pointer" onClick={() => setShowFull(!showFull)} title={showFull ? 'Click for abbreviated' : 'Click for full amount'}>
        {showFull ? (
          <span className="text-[10px] text-zinc-400 font-normal">${value.toFixed(value >= 1 ? 2 : 4)}</span>
        ) : (
          <span>{formatCurrency(value)}</span>
        )}
        {value > 0 && (
          <span className="text-[9px] text-zinc-600 font-normal opacity-50 hover:opacity-100 transition-opacity">
            {showFull ? 'abbreviated' : 'full'}
          </span>
        )}
      </span>
    );
  };

  const fmtNum = (n: number): string => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(Math.round(n || 0));
  };

  const fmtSec = (s: number): string => {
    if (!s || s <= 0) return '0m';
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${(s / 60).toFixed(s % 60 === 0 ? 0 : 1)}m`;
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const topToolName = useMemo(() => {
    const byTool = overview?.aiUsage?.byTool || {};
    let best: string | null = null;
    let bestTokens = 0;
    for (const [tool, d] of Object.entries<any>(byTool)) {
      const t = Number(d?.tokens || 0);
      if (t > bestTokens) { bestTokens = t; best = tool; }
    }
    return best;
  }, [overview]);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
    if (amount >= 1) return `$${amount.toFixed(2)}`;
    return `$${amount.toFixed(4)}`;
  };

  const groupToolsByCategory = (): Record<string, any[]> => {
    if (!overview?.tools) return {};
    return overview.tools.reduce((acc: Record<string, any[]>, tool: any) => {
      const cat = tool.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(tool);
      return acc;
    }, {});
  };

  const aiAgentsRef = useRef<AIAgent[]>([]);
  const aiAgentsFingerprintRef = useRef('');
  const aiAgents = useMemo((): AIAgent[] => {
    const agents: AIAgent[] = [];
    const wsByTool = workspaceAnalytics?.aiUsage?.byTool;
    const ovByTool = overview?.aiUsage?.byTool;
    const byTool = wsByTool && Object.keys(wsByTool).length > 0 ? wsByTool : (ovByTool || {});

    for (const [agentId, data] of Object.entries(byTool)) {
      const config = AGENT_CONFIG[agentId] || { name: agentId, icon: agentId, color: '#6366f1' };
      agents.push({
        id: agentId,
        name: config.name,
        icon: config.icon,
        color: getAgentColor(agentId),
        tokens: (data as any).tokens || 0,
        tokensIn: (data as any).tokens_in || 0,
        tokensOut: (data as any).tokens_out || 0,
        cost: (data as any).cost || 0,
        sessions: (data as any).sessions || 0,
        messageCount: (data as any).messageCount || 0,
        status: (data as any).lastUsed ? 'active' : 'idle',
        lastUsed: (data as any).lastUsed ? new Date((data as any).lastUsed) : undefined,
        models: (data as any).models || [],
      });
    }

    for (const [agentId, config] of Object.entries(AGENT_CONFIG)) {
      if (!byTool[agentId]) {
        agents.push({
          id: agentId,
          name: config.name,
          icon: config.icon,
          color: getAgentColor(agentId),
          tokens: 0,
          tokensIn: 0,
          tokensOut: 0,
          cost: 0,
          sessions: 0,
          messageCount: 0,
          status: 'inactive',
          models: [],
        });
      }
    }

    const fp = agents.map(a => `${a.id}:${a.tokens}:${a.sessions}:${a.cost}:${a.messageCount}:${a.status}`).join('|');
    if (fp === aiAgentsFingerprintRef.current) return aiAgentsRef.current;
    aiAgentsFingerprintRef.current = fp;
    aiAgentsRef.current = agents;
    return agents;
  }, [workspaceAnalytics?.aiUsage?.byTool, overview?.aiUsage?.byTool]);


  function filterOutlierValues(values: number[], stddevMultiplier = 3): number[] {
    if (!excludeOutliers || values.length < 3) return values;
    const nonZero = values.filter(v => v > 0);
    if (nonZero.length < 2) return values;
    const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    const variance = nonZero.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nonZero.length;
    const stddev = Math.sqrt(variance);
    const threshold = mean + stddevMultiplier * stddev;
    return values.map(v => v > threshold ? 0 : v);
  }


  const filteredLanguages = useMemo(() => {
    const search = editProjectForm.primaryLanguage.toLowerCase();
    if (!search) return COMMON_LANGUAGES;
    return COMMON_LANGUAGES.filter(lang =>
      lang.toLowerCase().includes(search)
    );
  }, [editProjectForm.primaryLanguage]);

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <PageShell page="ide-projects" className="max-w-7xl mx-auto space-y-6 overflow-y-auto pt-6">
      <CurrentCanvas accent="#06b6d4" render={renderMechanical} />
      <div className="relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 mt-1">Track your development environment, AI tools, and project metrics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setShowSetupModal(true)}
            variant="outline"
            className="flex items-center gap-2"
            title="Setup guide"
          >
            <HelpCircle className="w-4 h-4" />
            Guide
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="flex gap-1 p-1 bg-[var(--color-card)] rounded-lg w-fit">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <TabsTrigger
                key={key}
                value={key}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="ide-tab-active"
                    className="absolute inset-0 bg-zinc-800 light:bg-zinc-100 rounded-lg"
                    transition={TAB_LAYOUT}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div data-section="ide.overview" className="space-y-6 relative z-10">
          {/* Live Pulse Grid - Replaces old navigate-away cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[0, 1, 2, 3].map(idx => (
                <Skeleton key={idx} className="h-24 bg-[var(--color-card)] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Live Coding', value: codeActivity?.totalLinesAdded == null ? '—' : <NumberTicker value={codeActivity.totalLinesAdded} />, sub: codeActivity == null ? '—' : `-${fmtNum(codeActivity.totalLinesRemoved || 0)} lines · ${codeActivity.totalDurationMs == null ? '—' : fmtSec(codeActivity.totalDurationMs / 1000) + ' active'}`, icon: Code2, color: '#10b981', bg: 'bg-emerald-500/10' },
                { label: 'AI Pulse', value: overview?.aiUsage?.totalTokens == null ? '—' : <NumberTicker value={overview.aiUsage.totalTokens} />, sub: overview?.aiUsage?.totalCost == null ? '—' : <CostValue value={overview.aiUsage.totalCost} />, icon: Sparkles, color: '#a855f7', bg: 'bg-violet-500/10' },
                { label: 'Git Velocity', value: overview?.commits?.totalCommits == null ? '—' : <NumberTicker value={overview.commits.totalCommits} />, sub: 'commits this period', icon: GitCommit, color: '#f59e0b', bg: 'bg-amber-500/10' },
                { label: 'Top Tool', value: topToolName || '—', icon: Cpu, color: '#3b82f6', bg: 'bg-blue-500/10' },
              ].map((stat, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                  className="bg-[var(--color-card)] border border-[rgba(255,255,255,0.08)] rounded-lg p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-semibold tabular-nums tracking-tight text-white truncate">{stat.value}</div>
                    <div className="text-xs text-zinc-400 truncate">{stat.label}</div>
                    {stat.sub && <div className="text-[10px] text-zinc-500 truncate mt-0.5">{stat.sub}</div>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* AI & Projects Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* AI Usage Overview */}
            <motion.div
              data-tutorial="ide.usage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[var(--color-card)] border border-[rgba(255,255,255,0.08)] rounded-lg p-5"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <div>
                    <div className="text-xl font-semibold">AI Tool Usage</div>
                    <div className="text-sm text-zinc-500">Last 30 days</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setLogScale(!logScale)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                      logScale ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Log
                  </button>
                  <button
                    onClick={() => setExcludeOutliers(!excludeOutliers)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                      excludeOutliers ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    ♯ Out
                  </button>
                </div>
              </div>

              {aiAgents.filter(a => a.status !== 'inactive').length > 0 ? (
                <>
                  <div className="h-48 mb-6">
                    {(() => {
                      const activeAgents = aiAgents.filter(a => a.tokens > 0);
                      const overviewDays = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
                      const overviewChartData = {
                        labels: overviewDays.map(d => format(d, 'MMM dd')),
                        datasets: activeAgents.map((agent, idx) => {
                          let data = overviewDays.map(d => {
                            const dayStr = format(d, 'yyyy-MM-dd');
                            return overview?.aiUsage?.byTool?.[agent.id]?.daily?.[dayStr]?.tokens || 0;
                          });
                          if (excludeOutliers) data = filterOutlierValues(data);
                          if (logScale) data = data.map(v => v === 0 ? null : v) as number[];
                          return {
                            label: agent.name,
                            data,
                            backgroundColor: agent.color,
                            ...(logScale ? {} : { stack: 'combined' }),
                          };
                        })
                      };
                      const isStacked = !logScale;
                      return (
                        <Bar
                          data={overviewChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: true, position: 'bottom', labels: { color: '#a1a1aa', padding: 8, usePointStyle: true } },
                              tooltip: {
                                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                titleColor: '#fff',
                                bodyColor: '#a1a1aa',
                                borderColor: '#3f3f46',
                                borderWidth: 1,
                                callbacks: {
                                  label: (ctx: any) => {
                                    const val = ctx.parsed.y ?? 0;
                                    return `${ctx.dataset.label || 'AI'}: ${formatTokens(val)} tokens`;
                                  }
                                }
                              }
                            },
                            scales: {
                              x: { stacked: isStacked, grid: { display: false }, ticks: { color: '#71717a', maxTicksLimit: 7 } },
                              y: {
                                type: logScale ? 'logarithmic' as const : 'linear' as const,
                                stacked: isStacked,
                                grid: { color: '#27272a' },
                                ticks: {
                                  color: '#71717a',
                                  callback: (v: any) => {
                                    if (v === null) return '';
                                    return formatTokens(v);
                                  },
                                },
                                ...(logScale ? {} : { beginAtZero: true }),
                              }
                            },
                          }}
                        />
                      );
                    })()}
                  </div>

                  <div className="space-y-3">
                    {aiAgents.filter(a => a.status !== 'inactive').map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between p-3 bg-[var(--color-card)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: agent.color + '22' }}>
                            <Code2 className="w-4 h-4" style={{ color: agent.color }} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{agent.name}</div>
                            <div className="text-xs text-zinc-500">{agent.sessions} sessions &middot; {agent.messageCount} msgs</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className={agent.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-700 text-zinc-400 border-zinc-600'}>
                            {agent.status}
                          </Badge>
                          <div className="text-right">
                            <div className="text-sm font-medium text-emerald-400"><CostValue value={agent.cost} /></div>
                            <div className="text-xs text-zinc-500"><TokenValue value={agent.tokens} /></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Sparkles className="w-12 h-12" />}
                  title="No AI usage data yet"
                  description="Sync AI to start tracking"
                />
              )}
            </motion.div>

            {/* Recent Projects */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-[var(--color-card)] border border-[rgba(255,255,255,0.08)] rounded-lg p-5"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xl font-semibold">Recent Projects</div>
                    <div className="text-sm text-zinc-500">{overview?.projects?.length || 0} projects tracked</div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('projects')}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  View all →
                </button>
              </div>

              {overview?.projects && overview.projects.length > 0 ? (
                <div className="space-y-3">
                  {overview.projects.slice(0, 5).map((project: any) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-3 bg-[var(--color-card)] rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">{project.name}</div>
                        <div className="text-xs text-zinc-500 truncate max-w-[200px]">{project.path}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {project.vcs_type && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-md flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {project.vcs_type}
                          </span>
                        )}
                        {(() => {
                          const langs = projectLanguages[project.path];
                          const detected = langs?.[0]?.language || project.primary_language;
                          const pct = langs?.[0]?.percentage;
                          if (detected) {
                            return (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-md">
                                {detected}{pct !== undefined ? ` ${pct}%` : ''}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Terminal className="w-12 h-12" />}
                  title="No projects tracked yet"
                  description="Add a project to get started"
                />
              )}
            </motion.div>
          </div>
        </div>
      )}

      {/* Environment Tab (merges IDEs + Tools) */}
      {activeTab === 'environment' && (
        <motion.div
          data-section="ide.environment"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                setScanning(true);
                try {
                  await window.deskflowAPI!.detectIDEs();
                  await window.deskflowAPI!.scanTools();
                  await loadOverview();
                } catch (err) {
                  console.error('Scan failed:', err);
                }
                setScanning(false);
              }}
              disabled={scanning}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Environment'}
            </Button>
            <Button
              onClick={async () => {
                if (!window.confirm('WARNING: This will permanently delete all detected tools and re-scan your system. Are you sure?')) return;
                const result = await window.deskflowAPI!.resetTools();
                if (result.success) await loadOverview();
              }}
              variant="ghost"
              className="flex items-center gap-2 text-zinc-400 hover:text-white"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset Tools
            </Button>
          </div>

          {/* IDEs section */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-400" />
              IDEs
            </h3>
            {overview?.ides && overview.ides.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {overview.ides.map((ide: any, idx: number) => (
                  <MagicCard key={ide.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{ide.name}</div>
                        {ide.version && <div className="text-xs text-zinc-500">v{ide.version}</div>}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
                  </MagicCard>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No IDEs detected. Click "Scan Environment" above.</p>
            )}
          </div>

          {/* Tools section (health-oriented) */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              Dev Tools
            </h3>
            {overview?.tools && overview.tools.length > 0 ? (
              <div className="space-y-2">
                <Separator className="my-4" />
                {Object.entries(groupToolsByCategory()).map(([category, tools], idx) => {
                  const Icon = CATEGORY_ICONS[category] || Package;
                  const label = CATEGORY_LABELS[category] || category;
                  const isExpanded = expandedCategories.has(category);
                  return (
                    <div key={category} className="glass rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-4 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-zinc-400" />
                          <span className="text-white font-medium">{label}</span>
                          <Badge variant="secondary" className="bg-zinc-800 light:bg-zinc-100 text-zinc-400 text-xs">{(tools as any[]).length}</Badge>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {(tools as any[]).map((tool: any) => (
                            <div key={tool.id} className="flex items-center justify-between p-2.5 bg-[rgba(255,255,255,0.04)] rounded-lg">
                              <span className="text-sm text-zinc-300">{tool.name}</span>
                              {tool.version && <span className="text-xs text-zinc-500 font-mono">v{tool.version}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No tools detected. Click "Scan Environment" above.</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <motion.div
          data-section="ide.projects"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-6"
        >
          <motion.button
            onClick={async () => {
              const next = !showAddProject;
              setShowAddProject(next);
              if (next) {
                if (window.deskflowAPI?.scanIdeDefaultProjects) {
                  setLoadingQuickAdd(true);
                  try {
                    const result = await window.deskflowAPI.scanIdeDefaultProjects();
                    setQuickAddProjects(result);
                  } catch {}
                  setLoadingQuickAdd(false);
                }
                if (savedCustomDirs.length > 0 && window.deskflowAPI?.scanCustomDirectory) {
                  setScanningDirs(true);
                  const results: Record<string, any[]> = {};
                  for (const dir of savedCustomDirs) {
                    try {
                      const r = await window.deskflowAPI.scanCustomDirectory(dir);
                      if (r.success) results[dir] = r.projects;
                    } catch {}
                  }
                  setCustomDirResults(results);
                  setScanningDirs(false);
                }
              }
            }}
          
            className="flex items-center gap-2 px-4 py-2 bg-[var(--page-accent)] text-zinc-950 font-medium rounded-lg transition-all duration-150 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            aria-label="Add new project"
            whileTap={{ scale: 0.98 }}
          >
<Plus className="w-4 h-4" />
            Add Project
          </motion.button>

          {overview?.projects && overview.projects.length > 0 ? (
            <div>
            {/* Expand / Collapse All + Language Stats Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (expandedProjects.size === overview.projects.length) {
                    setExpandedProjects(new Set());
                  } else {
                    const all = new Set(overview.projects.map((p: any) => p.id));
                    setExpandedProjects(all);
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${expandedProjects.size === overview.projects.length ? 'rotate-180' : ''}`} />
                {expandedProjects.size === overview.projects.length ? 'Collapse All' : 'Expand All'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLanguageStats(prev => !prev)}
                className="flex items-center gap-1.5"
              >
                <Code2 className="w-4 h-4" />
                {showLanguageStats ? 'Hide' : 'Show'} Languages
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {overview.projects.map((project: any, idx: number) => {
                const projectIde = overview?.ides?.find((ide: any) => ide.id === project.default_ide);
                const isExpanded = expandedProjects.has(project.id);
                const details = projectDetailsCache[project.id];
                const isLoading = loadingProjectDetails.has(project.id);
                
                return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[var(--color-card)] border border-[rgba(255,255,255,0.08)] rounded-lg overflow-hidden"
                >
                  {/* Card Header - Always Visible */}
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold truncate">{project.name}</h3>
                          {project.default_ide && (
                            <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">
                              {projectIde?.name || project.default_ide}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 font-mono truncate mt-1">{project.path}</p>
                        </div>
                        {/* Language Stats - always visible when enabled */}
                        {showLanguageStats && (() => {
                        const langs = projectLanguages[project.path];
                        if (langs && langs.length > 0) {
                         const top = langs.slice(0, 2);
                         const extra = langs.length - 2;
                         return (
                           <div className="flex items-center gap-1 flex-wrap justify-end">
                             {top.map((l, i) => (
                               <span key={l.language} className={`px-1.5 py-0.5 text-[10px] rounded-md font-medium ${
                                 i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 light:bg-zinc-200/50 text-zinc-400'
                               }`}>
                                 {l.language} {l.percentage}%
                               </span>
                             ))}
                             {extra > 0 && (
                               <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-zinc-800 light:bg-zinc-200 text-zinc-500">
                                 +{extra}
                               </span>
                             )}
                           </div>
                         );
                        }
                        if (project.primary_language) {
                         return (
                           <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-emerald-500/20 text-emerald-400 font-medium">
                             {project.primary_language}
                           </span>
                         );
                        }
                        return null;
                        })()}
                        <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditProjectClick(project)}
                          aria-label={`Edit ${project.name}`}
                          className="p-2 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleProjectExpand(project)}
                          aria-label={isExpanded ? `Collapse ${project.name}` : `Expand ${project.name}`}
                          className={`p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 light:bg-zinc-200 rounded-lg transition-colors duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(project)}
                          aria-label={`Delete ${project.name}`}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Quick Actions Row */}
                    <div className="flex items-center gap-3 mt-4">
                      {(() => {
                        const isRunning = runningTerminals.has(project.id);
                        return isRunning ? (
                          <button
                            onClick={() => handleStopProject(project.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg transition-colors duration-150"
                          >
                            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                            <span className="text-sm font-medium">Stop</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRunProject(project)}
                            disabled={runningProjectLoading === project.id}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg transition-colors duration-150 disabled:opacity-50"
                          >
                            {runningProjectLoading === project.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            <span className="text-sm font-medium">{runningProjectLoading === project.id ? 'Starting...' : 'Run'}</span>
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => {
                          if (project.default_ide) {
                            handleOpenProject(project.id);
                          } else {
                            handleEditProjectClick(project);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 rounded-lg transition-colors duration-150"
                      >
                        <Monitor className="w-4 h-4" />
                        <span className="text-sm font-medium">{project.default_ide ? 'Open in IDE' : 'Set IDE'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProject(project.id);
                          setWorkspaceProject(project);
                          setIsWorkspaceOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 hover:bg-zinc-700 light:bg-zinc-200 border border-zinc-600 light:border-zinc-300/50 text-zinc-300 rounded-lg transition-colors duration-150"
                      >
                        <Terminal className="w-4 h-4" />
                        <span className="text-sm font-medium">Open Workspace</span>
                      </button>
                    </div>

                    {/* Tags Row */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      {project.vcs_type && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-lg flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {project.vcs_type}
                        </span>
                      )}
                      {(() => {
                        const langs = projectLanguages[project.path];
                        const isLoading = projectLanguagesLoading;
                        if (langs && langs.length > 0) {
                          const top = langs.slice(0, 3);
                          const extra = langs.length - 3;
                          const maxPct = top[0]?.percentage || 0;
                          return (
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              {top.map((l, i) => (
                                <div key={l.language} className="group relative">
                                  <span className={`px-2 py-1 text-xs rounded-lg inline-flex items-center gap-1.5 ${
                                    i === 0
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 text-zinc-400'
                                  }`}>
                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                                      backgroundColor: i === 0 ? '#34d399' : i === 1 ? '#60a5fa' : '#a78bfa'
                                    }} />
                                    {l.language}
                                    <span className="text-[10px] opacity-70">{l.percentage}%</span>
                                  </span>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                                    <div className="bg-zinc-800 light:bg-zinc-100 border border-zinc-700 light:border-zinc-300 rounded-lg p-2 shadow-xl whitespace-nowrap">
                                      {langs.slice(0, 5).map(l => (
                                        <div key={l.language} className="flex items-center justify-between gap-3 text-[11px]">
                                          <span className="text-zinc-300">{l.language}</span>
                                          <span className="text-zinc-500">{l.count} files ({l.percentage}%)</span>
                                        </div>
                                      ))}
                                      {langs.length > 5 && (
                                        <div className="text-[10px] text-zinc-600 text-center mt-1">
                                          +{langs.length - 5} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {extra > 0 && (
                                <span className="text-[10px] text-zinc-600 px-1">
                                  +{extra}
                                </span>
                              )}
                            </div>
                          );
                        }
                        if (project.primary_language) {
                          return (
                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg">
                              {project.primary_language}
                            </span>
                          );
                        }
                        if (isLoading) {
                          return (
                            <span className="px-2 py-1 bg-zinc-700 light:bg-zinc-200/30 text-zinc-500 text-xs rounded-lg flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Detecting...
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {details?.health?.healthScore !== undefined && (
                        <span className={`px-2 py-1 text-xs rounded-lg flex items-center gap-1 ${
                          details.health.healthScore >= 80 ? 'bg-green-500/20 text-green-400' :
                          details.health.healthScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          <Activity className="w-3 h-3" />
                          {details.health.healthScore}%
                        </span>
                      )}
                      {details?.tools?.length > 0 && (
                        <span className="px-2 py-1 bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 text-zinc-400 text-xs rounded-lg">
                          {details.tools.length} tools
                        </span>
                      )}
                      {details?.sessions?.length > 0 && (
                        <span className="px-2 py-1 bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 text-zinc-400 text-xs rounded-lg">
                          {details.sessions.length} sessions
                        </span>
                      )}
                      {project.repository_url && (
                        <a
                          href={project.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-zinc-500 hover:text-violet-400 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-zinc-800 light:border-zinc-200 bg-[rgba(255,255,255,0.04)]"
                      >
                        <div className="p-5 space-y-5">
                          {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                              <span className="ml-2 text-zinc-400">Loading project details...</span>
                            </div>
                          ) : details ? (
                            <>
                              {/* Health & Sessions Row */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="p-3 bg-[var(--color-card)] rounded-lg">
                                  <div className="text-xs text-zinc-500 mb-1">Health Score</div>
                                  <div className="text-xl font-bold text-white">{details.health?.healthScore || 0}<span className="text-sm text-zinc-500">/100</span></div>
                                  <div className="text-xs text-zinc-500 mt-1">{details.health?.activityLevel || 'unknown'}</div>
                                </div>
                                <div className="p-3 bg-[var(--color-card)] rounded-lg">
                                  <div className="text-xs text-zinc-500 mb-1">Terminal Sessions</div>
                                  <div className="text-xl font-bold text-white">{details.sessions?.length || 0}</div>
                                  <div className="text-xs text-zinc-500 mt-1">total</div>
                                </div>
                                <div className="p-3 bg-[var(--color-card)] rounded-lg">
                                  <div className="text-xs text-zinc-500 mb-1">Version Control</div>
                                  <div className="text-sm font-medium text-white truncate">{project.vcs_type || 'None detected'}</div>
                                  <div className="text-xs text-zinc-500 mt-1">{project.repository_url ? 'Connected' : 'No remote'}</div>
                                </div>
                                <div className="p-3 bg-[var(--color-card)] rounded-lg">
                                  <div className="text-xs text-zinc-500 mb-1">Repository</div>
                                  <div className="text-sm font-medium text-white truncate">{project.repository_url ? project.repository_url.split('/').slice(-2).join('/') : 'Not linked'}</div>
                                  <div className="text-xs text-zinc-500 mt-1">{project.repository_url ? 'Connected' : 'None'}</div>
                                </div>
                              </div>

                              {/* Recent Sessions */}
                              {details.sessions && details.sessions.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Recent Terminal Sessions
                                  </h4>
                                  <div className="space-y-2">
                                    {details.sessions.slice(0, 3).map((session: any) => (
                                      <div key={session.id} className="flex items-center justify-between p-3 bg-[var(--color-card)] rounded-lg">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                          <span className="text-sm text-zinc-300 truncate">{session.topic || session.agent || 'Untitled'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className="text-xs text-zinc-500">{session.created_at ? formatDistanceToNow(new Date(session.created_at)) : 'Unknown'}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Presets */}
                              {details.presets && details.presets.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    Quick Run Presets
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {details.presets.map((preset: any) => (
                                      <button
                                        key={preset.id}
                                        className="px-3 py-1.5 bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 hover:bg-zinc-700 light:bg-zinc-200 text-zinc-300 text-xs rounded-lg transition-colors"
                                      >
                                        {preset.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Tools */}
                              <div>
                                <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                  <Package className="w-4 h-4" />
                                  Detected Tools ({details.tools?.length || 0})
                                </h4>
                                {details.tools && details.tools.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {details.tools.map((tool: any) => (
                                      <span key={tool.id} className="px-2 py-1 bg-zinc-800 light:bg-zinc-100 text-zinc-300 text-xs rounded-lg">
                                        {tool.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-zinc-500">No tools detected for this project</p>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-4 text-zinc-500">
                              Click expand to load details
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
              })}
            </div>
          </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-lg"
            >
              <EmptyState
                icon={<Terminal className="w-16 h-16" />}
                title="No projects tracked yet"
                description="Add a project to start tracking its metrics"
              />
            </motion.div>
          )}
        </motion.div>
      )}

      {/* AI Tools Tab */}
      {activeTab === 'ai' && (
        <AIToolsTab
          overview={overview}
          workspaceAnalytics={workspaceAnalytics}
          analyticsLoading={analyticsLoading}
          analyticsError={analyticsError}
          onRetryAnalytics={() => { analyticsCacheRef.current = null; fetchAnalytics(); }}
          selectedPeriod={effectiveAiPeriod}
          onDataRefresh={loadOverview}
          timeLock={timeLock}
          onToggleTimeLock={() => {
            const next = !timeLock
            setTimeLock(next)
            try { localStorage.setItem('ide-projects-ai-lock', String(next)) } catch {}
          }}
        />
      )}

      {/* Git Tab */}
      {activeTab === 'git' && (
        <motion.div
          data-section="ide.git"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Project Selector & Sync */}
          <GlassCard className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <select
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-4 py-2 bg-[var(--color-card)] text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-violet-500 focus:outline-none"
              >
                {overview?.projects?.map((project: any) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleSyncGit}
              disabled={syncingGit || !selectedProject}
              variant="outline"
              className="flex items-center gap-2"
            >
              <GitCommit className={`w-4 h-4 ${syncingGit ? 'animate-spin' : ''}`} />
              {syncingGit ? 'Syncing...' : 'Sync Commits'}
            </Button>
          </GlassCard>

          {/* DORA Metrics */}
          {doraMetrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-lg p-5"
            >
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-xl font-semibold">DORA Metrics</div>
                  <div className="text-sm text-zinc-500">Monthly performance</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Deploy Frequency', value: doraMetrics.deploymentFrequency, sub: `${doraMetrics.deploymentFrequency || 0}/day` },
                  { label: 'Lead Time', value: doraMetrics.leadTimeHours, sub: doraMetrics.leadTimeHours ? `${doraMetrics.leadTimeHours}h` : 'N/A' },
                  { label: 'MTTR', value: doraMetrics.meanTimeToRecoveryHours, sub: '~1 day est.' },
                  { label: 'Change Failure', value: doraMetrics.changeFailureRate, sub: `${doraMetrics.changeFailureRate || 0}%` },
                ].map((metric, idx) => (
                  <div key={idx} className="bg-[var(--color-card)] rounded-lg p-4 text-center">
                    <div className={`text-2xl font-bold mb-1 ${
                      metric.value === 'elite' ? 'text-emerald-400' :
                      metric.value === 'high' ? 'text-blue-400' :
                      metric.value === 'medium' ? 'text-amber-400' :
                      metric.value === 'low' ? 'text-red-400' : 'text-zinc-400'
                    }`}>
                      {metric.value || 'N/A'}
                    </div>
                    <div className="text-sm text-zinc-400 mb-1">{metric.label}</div>
                    <div className="text-xs text-zinc-500">{metric.sub}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Commit Activity Chart */}
          {commitHistory.length > 0 && (() => {
            const dayMap: Record<string, number> = {};
            const changeMap: Record<string, { add: number; del: number }> = {};
            const last30 = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });

            for (const c of commitHistory) {
              const day = format(new Date(c.date), 'yyyy-MM-dd');
              dayMap[day] = (dayMap[day] || 0) + 1;
              changeMap[day] = {
                add: (changeMap[day]?.add || 0) + (c.additions || 0),
                del: (changeMap[day]?.del || 0) + (c.deletions || 0),
              };
            }

            const labels = last30.map(d => format(d, 'MMM dd'));
            const days = last30.map(d => format(d, 'yyyy-MM-dd'));
            const commitCounts = days.map(d => dayMap[d] || 0);
            const additionsData = days.map(d => changeMap[d]?.add || 0);
            const deletionsData = days.map(d => changeMap[d]?.del || 0);

            const weekLabels = last30
              .filter((_, i) => i % 7 === 0 || i === last30.length - 1)
              .map(d => format(d, 'MMM dd'));

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-lg p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <GitCommit className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-sm font-semibold">Commits per Day</div>
                      <div className="text-xs text-zinc-500">Last 30 days</div>
                    </div>
                  </div>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels,
                        datasets: [{
                          label: 'Commits',
                          data: commitCounts,
                          backgroundColor: 'rgba(251, 191, 36, 0.6)',
                          borderColor: 'rgba(251, 191, 36, 0.9)',
                          borderWidth: 1,
                          borderRadius: 3,
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: {
                            ticks: {
                              color: '#71717a',
                              maxRotation: 0,
                              font: { size: 9 },
                              callback: (_, i) => (i % 7 === 0 || i === labels.length - 1) ? labels[i] : '',
                            },
                            grid: { display: false },
                          },
                          y: {
                            beginAtZero: true,
                            ticks: {
                              color: '#71717a',
                              font: { size: 9 },
                              stepSize: 1,
                            },
                            grid: { color: 'rgba(113, 113, 122, 0.15)' },
                          }
                        }
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="glass rounded-lg p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-sm font-semibold">Lines Changed</div>
                      <div className="text-xs text-zinc-500">Additions vs Deletions</div>
                    </div>
                  </div>
                  <div className="h-48">
                    <Bar
                      data={{
                        labels,
                        datasets: [
                          {
                            label: 'Additions',
                            data: additionsData,
                            backgroundColor: 'rgba(16, 185, 129, 0.6)',
                            borderColor: 'rgba(16, 185, 129, 0.9)',
                            borderWidth: 1,
                            borderRadius: 3,
                          },
                          {
                            label: 'Deletions',
                            data: deletionsData,
                            backgroundColor: 'rgba(239, 68, 68, 0.6)',
                            borderColor: 'rgba(239, 68, 68, 0.9)',
                            borderWidth: 1,
                            borderRadius: 3,
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                            align: 'end',
                            labels: { boxWidth: 10, padding: 8, font: { size: 9 }, color: '#a1a1aa' },
                          }
                        },
                        scales: {
                          x: {
                            ticks: {
                              color: '#71717a',
                              maxRotation: 0,
                              font: { size: 9 },
                              callback: (_, i) => (i % 7 === 0 || i === labels.length - 1) ? labels[i] : '',
                            },
                            grid: { display: false },
                          },
                          y: {
                            beginAtZero: true,
                            ticks: { color: '#71717a', font: { size: 9 } },
                            grid: { color: 'rgba(113, 113, 122, 0.15)' },
                          }
                        }
                      }}
                    />
                  </div>
                </motion.div>
              </div>
            );
          })()}

          {/* Commit Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Commits', value: overview?.commits?.totalCommits || 0, icon: GitCommit, color: '#f59e0b', bg: 'bg-amber-500/10' },
              { label: 'Lines Added', value: `+${overview?.commits?.totalAdditions || 0}`, icon: Plus, color: '#10b981', bg: 'bg-emerald-500/10' },
              { label: 'Lines Removed', value: `-${overview?.commits?.totalDeletions || 0}`, icon: Trash2, color: '#ef4444', bg: 'bg-red-500/10' },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass rounded-lg p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                </div>
                <div className="text-3xl font-semibold tabular-nums tracking-tight" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Commit History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-lg p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <GitCommit className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-lg font-semibold">Recent Commits</div>
                  <div className="text-sm text-zinc-500">Last {commitHistory.length} commits</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={async () => {
                    if (!selectedProject) return;
                    setLoadingDiff(true);
                    try {
                      const res = await (window as any).deskflowAPI.getGitDiff(selectedProject, 'working');
                      setGitDiff(res.success ? res.diff : 'No changes');
                    } catch { setGitDiff('Failed to load diff'); }
                    setLoadingDiff(false);
                  }}
                  
                  whileTap={{ scale: 0.98 }}
                  className="px-3 py-1.5 text-xs bg-zinc-800 light:bg-zinc-100 hover:bg-zinc-700 light:bg-zinc-200 text-zinc-300 rounded-lg transition-colors"
                >
                  {loadingDiff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Show Diff'}
                </motion.button>
              </div>
            </div>

            {commitHistory.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No commits yet. Sync to load commit history.</div>
            ) : (
              <div className="space-y-1.5">
                {commitHistory.map((commit: any) => {
                  const isExpanded = expandedCommit === commit.id;
                  const relativeDate = (() => {
                    const d = new Date(commit.date);
                    const now = new Date();
                    const diffMs = now.getTime() - d.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    if (diffMins < 1) return 'just now';
                    if (diffMins < 60) return `${diffMins}m ago`;
                    const diffHours = Math.floor(diffMins / 60);
                    if (diffHours < 24) return `${diffHours}h ago`;
                    const diffDays = Math.floor(diffHours / 24);
                    if (diffDays < 30) return `${diffDays}d ago`;
                    return d.toLocaleDateString();
                  })();

                  return (
                    <div key={commit.id} className="group">
                      <motion.div
                        onClick={() => setExpandedCommit(isExpanded ? null : commit.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 cursor-pointer transition-colors"
                      >
                        <div className="w-2 h-2 rounded-full bg-amber-500/60 flex-shrink-0" />
                        <span className="font-mono text-xs text-zinc-500 w-16 flex-shrink-0">
                          {commit.sha?.substring(0, 7)}
                        </span>
                        <span className="text-sm text-zinc-300 truncate flex-1">
                          {commit.message?.split('\n')[0] || 'No message'}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          {commit.additions > 0 && (
                            <span className="text-emerald-400">+{commit.additions}</span>
                          )}
                          {commit.deletions > 0 && (
                            <span className="text-red-400">-{commit.deletions}</span>
                          )}
                          {commit.files_changed > 0 && (
                            <span className="text-zinc-500">{commit.files_changed} files</span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-600 w-16 text-right flex-shrink-0">{relativeDate}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </motion.div>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-8 pl-4 border-l border-zinc-800 light:border-zinc-200 py-3 space-y-2">
                              <div className="flex items-center gap-4 text-xs">
                                <span className="text-zinc-500">
                                  <span className="text-zinc-600">Author:</span> {commit.author}
                                </span>
                                {commit.author_email && (
                                  <span className="text-zinc-500">
                                    <span className="text-zinc-600">Email:</span> {commit.author_email}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500">
                                <span className="text-zinc-600">Date:</span> {new Date(commit.date).toLocaleString()}
                              </div>
                              <div className="text-xs text-zinc-500">
                                <span className="text-zinc-600">SHA:</span> <span className="font-mono">{commit.sha}</span>
                              </div>
                              {commit.message?.includes('\n') && (
                                <div className="text-xs text-zinc-400 bg-[var(--color-card)] rounded-lg p-3 mt-1 whitespace-pre-wrap">
                                  {commit.message}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Auto-Generate Commit Message */}
          {gitDiff !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-lg p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <div>
                    <div className="text-lg font-semibold">Generate Commit Message</div>
                    <div className="text-sm text-zinc-500">From working tree changes</div>
                  </div>
                </div>
                <motion.button
                  onClick={() => setGitDiff(null)}
                  
                  className="p-1.5 rounded-lg hover:bg-zinc-800 light:bg-zinc-100 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <textarea
                value={gitDiff}
                onChange={(e) => setGitDiff(e.target.value)}
                className="w-full h-40 bg-[var(--color-card)] text-zinc-300 text-xs font-mono rounded-lg p-3 border border-zinc-800 light:border-zinc-200 focus:border-violet-500 focus:outline-none resize-y"
                placeholder="No changes detected..."
              />

              <div className="flex items-center justify-end gap-2 mt-3">
                <motion.button
                  onClick={() => navigator.clipboard.writeText(gitDiff)}
                  
                  whileTap={{ scale: 0.98 }}
                  className="px-3 py-1.5 text-xs bg-zinc-800 light:bg-zinc-100 hover:bg-zinc-700 light:bg-zinc-200 text-zinc-300 rounded-lg transition-colors"
                >
                  Copy Diff
                </motion.button>
                <motion.button
                  onClick={async () => {
                    if (!selectedProject) return;
                    setGeneratingMsg(true);
                    setGeneratedCommitMsg(null);
                    try {
                      const res = await (window as any).deskflowAPI.getGitDiff(selectedProject, 'cached');
                      const stagedDiff = res.success ? res.diff.trim() : '';

                      const pathRes = await (window as any).deskflowAPI.getTerminalSessions();
                      const terminals = Array.isArray(pathRes) ? pathRes.filter((t: any) => t.terminal_id) : [];
                      const targetTerminal = terminals[0]?.terminal_id;

                      if (!stagedDiff) {
                        setGeneratedCommitMsg('No staged changes found. Stage your changes first with `git add`.');
                        setGeneratingMsg(false);
                        return;
                      }

                      if (targetTerminal) {
                        const prompt = `Generate a conventional commit message for the following changes:\n\`\`\`diff\n${stagedDiff.slice(0, 8000)}\n\`\`\`\n\nRespond with ONLY the commit message, no explanations. Use format: type(scope): description`;
                        await (window as any).deskflowAPI.terminalWrite(targetTerminal, prompt + '\r\n');
                        setGeneratedCommitMsg('Prompt sent to terminal agent. Check the terminal for the generated commit message.');
                      } else {
                        setGeneratedCommitMsg('No active terminal found. Open a terminal and try again.');
                      }
                    } catch (err) {
                      setGeneratedCommitMsg('Failed to generate commit message.');
                    }
                    setGeneratingMsg(false);
                  }}
                  disabled={generatingMsg}
                  
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {generatingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingMsg ? 'Generating...' : 'Generate with Agent'}
                </motion.button>
              </div>

              {generatedCommitMsg && (
                <div className="mt-3 p-3 bg-[var(--color-card)] border border-zinc-800 light:border-zinc-200 rounded-lg">
                  <div className="text-xs text-zinc-600 mb-1">Result:</div>
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">{generatedCommitMsg}</div>
                  {generatedCommitMsg.startsWith('Prompt sent') && (
                    <motion.button
                      onClick={() => navigator.clipboard.writeText(generatedCommitMsg)}
                      
                      className="mt-2 px-2 py-1 text-xs bg-zinc-800 light:bg-zinc-100 hover:bg-zinc-700 light:bg-zinc-200 text-zinc-400 rounded transition-colors"
                    >
                      Copy Note
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <motion.div
          data-section="ide.analytics"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Workspace Analytics</h2>
              <p className="text-sm text-zinc-500">AI usage, problems, and requests across all projects</p>
            </div>
          </div>
          {workspaceAnalytics ? (
            <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-400 animate-spin" /><span className="ml-3 text-zinc-400 text-sm">Loading analytics...</span></div>}>
              <AnalyticsDashboard
                aiUsage={workspaceAnalytics.aiUsage}
                sessions={workspaceAnalytics.sessions}
                problems={workspaceAnalytics.problems}
                requests={workspaceAnalytics.requests}
                promptHistory={workspaceAnalytics.promptHistory}
                codeStats={workspaceAnalytics.codeStats}
                codeActivity={workspaceAnalytics.codeActivity}
                loading={analyticsLoading}
                period={selectedPeriod}
                variant="workspace"
                projectLanguages={aggregatedProjectLanguages}
              />
            </Suspense>
          ) : analyticsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <span className="ml-3 text-zinc-400 text-sm">Loading analytics...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">No analytics data available</div>
          )}
        </motion.div>
      )}

      {/* Backup Tab (replaces Trash) */}
      {activeTab === 'backup' && (
        <motion.div
          data-section="ide.backup"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <BackupTabPanel
            projectId={selectedProject}
            projectPath={overview?.projects?.find((p: any) => p.id === selectedProject)?.path || null}
          />
        </motion.div>
      )}

      {/* Setup Guide Modal */}
      <AnimatePresence>
        {(showSetupModal || showOnboarding) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowSetupModal(false);
              if (showOnboarding) {
                localStorage.setItem('ide-projects-onboarding-seen', 'true');
                setShowOnboarding(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-card)] rounded-lg w-full max-w-3xl max-h-[85vh] overflow-hidden border border-zinc-700 light:border-zinc-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-zinc-700 light:border-zinc-300 flex items-center justify-between sticky top-0 bg-[var(--color-card)] z-10">
                <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-white" />
                  </div>
                  Project Tracking Setup Guide
                </h2>
                <div className="flex items-center gap-3">
                  {!showOnboarding && (
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                      <VoiceInputWrapper>
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              localStorage.setItem('ide-projects-onboarding-seen', 'true');
                            }
                          }}
                          className="w-4 h-4 rounded border-zinc-600 light:border-zinc-300 bg-zinc-800 light:bg-zinc-100 text-blue-500 focus:ring-blue-500"
                        />
                      </VoiceInputWrapper>
                      Don't show again
                    </label>
                  )}
                  <button
                    onClick={() => {
                      setShowSetupModal(false);
                      if (showOnboarding) {
                        localStorage.setItem('ide-projects-onboarding-seen', 'true');
                        setShowOnboarding(false);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 light:bg-zinc-100 text-zinc-400 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(85vh-88px)] space-y-6">
                {showOnboarding && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                    <p className="text-blue-300 text-sm"> Welcome! This guide will help you set up project tracking. Follow the steps below to get started.</p>
                  </div>
                )}

                {/* Step 1: Add Project */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-emerald-400">1</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        Add Your First Project
                        {overview?.projects && overview.projects.length > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg">Done</span>
                        )}
                      </h3>
                      <div className="space-y-2 text-sm text-zinc-400">
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                          Click the <strong className="text-white">"Add Project"</strong> button
                        </p>
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                          Click <strong className="text-white">"Browse"</strong> and select your project <strong className="text-amber-400">FOLDER</strong> (not the .exe file)
                        </p>
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                          Enter a name for the project
                        </p>
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                          (Optional) Add your GitHub repository URL
                        </p>
                      </div>
                      <div className="mt-3 p-3 bg-[var(--color-card)] rounded-lg">
                        <p className="text-xs text-zinc-500 mb-1">Example paths:</p>
                        <p className="text-xs text-emerald-400 font-mono">✓ C:\Projects\MyApp</p>
                      <p className="text-xs text-red-400 font-mono">✗ C:\Projects\MyApp\myapp.exe</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Step 2: AI Usage Tracking */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-violet-400">2</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3">Track AI Coding Assistant Usage</h3>
                      <p className="text-sm text-zinc-400 mb-4">We automatically detect these AI tools and import their usage data:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { name: 'Claude Code', path: '~/.claude/projects/<project>/*.jsonl', color: '#f97316' },
                          { name: 'Qwen CLI', path: '~/.qwen/projects/<project>/chats/*.jsonl', color: '#f59e0b' },
                          { name: 'OpenCode', path: '~/.local/share/opencode/opencode.db', color: '#3b82f6' },
                          { name: 'Gemini CLI', path: '~/.gemini/history/', color: '#06b6d4' },
                          { name: 'Cursor AI', path: '%APPDATA%\\Cursor\\', color: '#a855f7' },
                          { name: 'Codex CLI', path: '~/.codex/', color: '#10b981' },
                        ].map((agent) => (
                          <div key={agent.name} className="flex items-center gap-3 p-3 bg-[var(--color-card)] rounded-lg">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: agent.color + '22' }}>
                              <Sparkles className="w-4 h-4" style={{ color: agent.color }} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{agent.name}</div>
                              <div className="text-xs text-zinc-500 font-mono truncate max-w-[180px]">{agent.path}</div>
                            </div>
                            {agentDebugInfo?.agents?.[agent.name.toLowerCase().replace(' ', '-')]?.detected ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-zinc-600 ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-sm text-amber-300">Tip Click <strong>"Sync AI Usage"</strong> to import data from detected AI tools</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Step 3: Git Tracking */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-amber-400">3</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3">Track Git Commits & Metrics</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-[var(--color-card)] rounded-lg">
                          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-zinc-400" />
                            Local Repositories
                          </h4>
                          <p className="text-sm text-zinc-400">Add your project (must contain .git folder), then click "Sync Commits" to import commit history, additions, and deletions.</p>
                        </div>
                        <div className="p-4 bg-[var(--color-card)] rounded-lg">
                          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-zinc-400" />
                            GitHub Repositories
                          </h4>
                          <p className="text-sm text-zinc-400">Click "Sync GitHub" and enter <span className="text-violet-400 font-mono">owner/repository</span> (e.g., "facebook/react"). For private repos, add your GitHub token.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Step 4: IDE Detection */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-blue-400">4</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3">Detect Your Development Environment</h3>
                      <p className="text-sm text-zinc-400 mb-4">Click "Scan Environment" to automatically detect:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { name: 'VS Code', detected: overview?.ides?.some((i: any) => i.name === 'VS Code') },
                          { name: 'IntelliJ IDEA', detected: overview?.ides?.some((i: any) => i.name?.includes('IntelliJ')) },
                          { name: 'PyCharm', detected: overview?.ides?.some((i: any) => i.name?.includes('PyCharm')) },
                          { name: 'Android Studio', detected: overview?.ides?.some((i: any) => i.name?.includes('Android')) },
                          { name: 'Cursor', detected: overview?.ides?.some((i: any) => i.name === 'Cursor') },
                          { name: 'Google Antigravity', detected: overview?.ides?.some((i: any) => i.name?.includes('Antigravity')) },
                        ].map((ide) => (
                          <div key={ide.name} className="flex items-center gap-2 p-2 bg-[var(--color-card)] rounded-lg">
                            <Monitor className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm text-zinc-300">{ide.name}</span>
                            {ide.detected ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-zinc-600 light:border-zinc-300 ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-[var(--color-card)] rounded-lg">
                        <p className="text-sm text-zinc-400">Also detects: Git, Node.js, Python, Docker, npm, yarn, and more tools.</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Quick Start Checklist */}
                <GlassCard className="bg-gradient-to-br from-zinc-900 to-zinc-800/50">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Quick Start Checklist
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Add at least one project', done: overview?.projects && overview.projects.length > 0 },
                      { label: 'Install Claude Code, Cursor, or OpenCode?', done: false },
                      { label: 'Click "Sync AI Usage" to import AI data', done: false },
                      { label: 'Click "Scan Environment" to detect your setup', done: overview?.ides && overview.ides.length > 0 },
                    ].map((item, idx) => (
                      <label key={idx} className="flex items-center gap-3 p-3 hover:bg-zinc-800 light:bg-zinc-100/30 rounded-lg cursor-pointer transition-colors">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          item.done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 light:border-zinc-300'
                        }`}>
                          {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm ${item.done ? 'text-zinc-400 line-through' : 'text-white'}`}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                    <p className="text-sm text-violet-300">Tip Your data is stored locally and private. No data leaves your computer.</p>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanning Loading Overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] rounded-lg p-5 border border-zinc-700 light:border-zinc-300 max-w-sm w-full mx-4"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Scanning Environment</h3>
                <p className="text-zinc-400 text-sm mb-4">Detecting IDEs and development tools...</p>
                <div className="w-full bg-zinc-800 light:bg-zinc-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
                <p className="text-zinc-500 text-xs mt-3">Please wait, this may take a moment</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Agent Detail Modal */}
      <AnimatePresence>
        {selectedAgentDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAgentDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border border-zinc-700 light:border-zinc-300 rounded-lg p-5 max-w-4xl w-full max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedAgentDetail.color + '20' }}>
                    <Sparkles className="w-5 h-5" style={{ color: selectedAgentDetail.color }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedAgentDetail.name}</h3>
                    <p className="text-sm text-zinc-500">{selectedAgentDetail.status === 'active' ? 'Active' : 'Idle'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgentDetail(null)}
                  className="p-2 hover:bg-zinc-800 light:bg-zinc-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Timeline Selector */}
              <div className="flex items-center justify-center mb-5">
                <div className="flex bg-zinc-800 light:bg-zinc-100 rounded-full p-1 text-xs">
                  <button
                    onClick={() => { setModalExpandedPeriod(null); setModalPeriod('today'); }}
                    className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'today' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Today
                  </button>
                  <div className="relative flex">
                    {modalExpandedPeriod === 'week' ? (
                      <>
                        <button
                          onClick={() => { setModalExpandedPeriod(null); setModalPeriod('week'); }}
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'week' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Week
                        </button>
                        <button
                          onClick={() => { setModalExpandedPeriod(null); setModalPeriod('7day'); }}
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === '7day' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                          7 Day
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setModalExpandedPeriod('week')}
                        className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'week' || modalPeriod === '7day' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                      >
                        {modalPeriod === '7day' ? '7 Day' : 'Week'}
                      </button>
                    )}
                  </div>
                  <div className="relative flex">
                    {modalExpandedPeriod === 'month' ? (
                      <>
                        <button
                          onClick={() => { setModalExpandedPeriod(null); setModalPeriod('month'); }}
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'month' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Month
                        </button>
                        <button
                          onClick={() => { setModalExpandedPeriod(null); setModalPeriod('30day'); }}
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === '30day' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                          30d
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setModalExpandedPeriod('month')}
                        className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'month' || modalPeriod === '30day' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                      >
                        {modalPeriod === '30day' ? '30d' : 'Month'}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setModalExpandedPeriod(null); setModalPeriod('all'); }}
                    className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'all' ? 'bg-zinc-700 light:bg-zinc-200 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    All Time
                  </button>
                </div>
              </div>

              {/* Top Metrics Grid — period-aware */}
              {(() => {
                const daysMap: Record<string, number> = { 'week': 7, 'month': 30, 'all': 9999 };
                const numDays = daysMap[modalEffectivePeriod] || 7;
                const cutoff = numDays >= 9999 ? null : subDays(new Date(), numDays - 1);
                const daily = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily || {};

                let periodTokens = 0;
                let periodTokensIn = 0;
                let periodTokensOut = 0;
                let periodMessages = 0;
                let periodCost = 0;
                let periodSessions = 0;

                for (const [dateStr, dayData] of Object.entries(daily)) {
                  if (cutoff) {
                    const d = new Date(dateStr);
                    if (d < cutoff) continue;
                  }
                  periodTokens += (dayData as any).tokens || 0;
                  periodTokensIn += (dayData as any).tokens_in || 0;
                  periodTokensOut += (dayData as any).tokens_out || 0;
                  periodMessages += (dayData as any).messageCount || 0;
                  periodCost += (dayData as any).cost || 0;
                  periodSessions += (dayData as any).sessions || 0;
                }

                const periodLabel = modalPeriod === 'today' ? 'Today' : modalPeriod === 'week' ? 'This Week' : modalPeriod === '7day' ? '7 Days' : modalPeriod === 'month' ? 'This Month' : modalPeriod === '30day' ? '30 Days' : 'All Time';

                return (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-zinc-400 font-medium">{periodLabel}</span>
                      <div className="h-px flex-1 bg-zinc-800 light:bg-zinc-100" />
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-2">
                      <div className="bg-[var(--color-card)] rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Total Tokens</div>
                        <div className="text-base font-semibold text-white"><TokenValue value={periodTokens} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Input (You)</div>
                        <div className="text-base font-semibold text-blue-400"><TokenValue value={periodTokensIn} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Output (AI)</div>
                        <div className="text-base font-semibold text-emerald-400"><TokenValue value={periodTokensOut} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">In:Out Ratio</div>
                        <div className="text-base font-semibold text-amber-400 font-mono">
                          {periodTokensIn > 0 ? `1:${(periodTokensOut / periodTokensIn).toFixed(1)}` : '∞'}
                        </div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Input %</div>
                        <div className="text-base font-semibold text-blue-400">
                          {periodTokens > 0 ? `${((periodTokensIn / periodTokens) * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Output %</div>
                        <div className="text-base font-semibold text-emerald-400">
                          {periodTokens > 0 ? `${((periodTokensOut / periodTokens) * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-6">
                      <div className="bg-[var(--color-card)] rounded-lg p-2.5 text-center">
                        <div className="text-[10px] text-zinc-500 mb-0.5">Messages</div>
                        <div className="text-sm font-semibold text-blue-400">{periodMessages.toLocaleString()}</div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-2.5 text-center">
                        <div className="text-[10px] text-zinc-500 mb-0.5">Cost</div>
                        <div className="text-sm font-semibold text-emerald-400"><CostValue value={periodCost} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-2.5 text-center">
                        <div className="text-[10px] text-zinc-500 mb-0.5">Sessions</div>
                        <div className="text-sm font-semibold text-violet-400">{periodSessions.toLocaleString()}</div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-lg p-2.5 text-center">
                        <div className="text-[10px] text-zinc-500 mb-0.5">Tokens/Msg</div>
                        <div className="text-sm font-semibold text-amber-400">
                          {periodMessages > 0 ? <TokenValue value={Math.round(periodTokens / periodMessages)} /> : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <FreeUsageStats 
                      agent={selectedAgentDetail} 
                      dailyUsage={modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily || {}} 
                      formatTokens={formatTokens}
                    />
                  </>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Timeline Chart */}
                <div className="bg-[var(--color-card)] rounded-lg p-4 lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-zinc-400">Daily Usage</h4>
                    <div className="flex items-center gap-1 bg-[var(--color-card)] rounded-lg p-0.5">
                      {(['tokens', 'messages', 'sessions', 'cost'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAiChartMode(mode)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                            aiChartMode === mode
                              ? 'bg-violet-500/20 text-violet-400'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                      {aiChartMode === 'tokens' && <div className="w-px h-4 bg-zinc-700 light:bg-zinc-200" />}
                      {aiChartMode === 'tokens' && (
                        <>
                          {(['combined', 'input', 'output'] as const).map(sub => (
                            <button
                              key={sub}
                              onClick={() => setTokenDisplayMode(sub)}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium transition ${
                                tokenDisplayMode === sub
                                  ? sub === 'input' ? 'bg-blue-500/20 text-blue-400'
                                    : sub === 'output' ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 text-zinc-300'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {sub === 'combined' ? 'All' : sub === 'input' ? 'In' : 'Out'}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-48">
                    {(() => {
                      let numDays = modalEffectivePeriod === 'week' ? 7 : modalEffectivePeriod === 'month' ? 30 : 7;
                      if (modalEffectivePeriod === 'all') {
                        const allDaily = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily || {};
                        const dateStrs = Object.keys(allDaily);
                        if (dateStrs.length > 0) {
                          const sorted = dateStrs.sort();
                          const minDate = new Date(sorted[0]).getTime();
                          const maxDate = new Date(sorted[sorted.length - 1]).getTime();
                          const span = Math.ceil((maxDate - minDate) / 86400000) + 30;
                          numDays = Math.min(180, Math.max(span, 60));
                        } else {
                          numDays = 60;
                        }
                      }
                      const periodDays = eachDayOfInterval({ start: subDays(new Date(), numDays - 1), end: new Date() });
                      const labels = periodDays.map(d => format(d, numDays <= 7 ? 'EEE' : 'MMM dd'));
                      const getMetricValue = (dayStr: string) => {
                        const dayData = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily?.[dayStr];
                        if (!dayData) return 0;
                        if (aiChartMode === 'messages') return dayData.messageCount || 0;
                        if (aiChartMode === 'sessions') return dayData.sessions || 0;
                        if (aiChartMode === 'cost') return dayData.cost || 0;
                        return 0;
                      };

                      if (aiChartMode === 'tokens') {
                        const inData = periodDays.map(d => {
                          const dayData = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily?.[format(d, 'yyyy-MM-dd')];
                          return dayData?.tokens_in || 0;
                        });
                        const outData = periodDays.map(d => {
                          const dayData = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily?.[format(d, 'yyyy-MM-dd')];
                          return dayData?.tokens_out || 0;
                        });
                        const tokenIsStacked = tokenDisplayMode === 'combined';
                        const tokenDatasets = tokenDisplayMode === 'output'
                          ? [{
                              label: 'Output (AI)',
                              data: outData,
                              backgroundColor: 'rgba(16, 185, 129, 0.6)',
                              borderColor: '#10b981',
                              borderWidth: 1,
                              borderRadius: 2,
                            }]
                          : tokenDisplayMode === 'input'
                          ? [{
                              label: 'Input (You)',
                              data: inData,
                              backgroundColor: 'rgba(59, 130, 246, 0.6)',
                              borderColor: '#3b82f6',
                              borderWidth: 1,
                              borderRadius: 2,
                            }]
                          : [
                              {
                                label: 'Input (You)',
                                data: inData,
                                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                                borderColor: '#3b82f6',
                                borderWidth: 1,
                                borderRadius: 2,
                              },
                              {
                                label: 'Output (AI)',
                                data: outData,
                                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                                borderColor: '#10b981',
                                borderWidth: 1,
                                borderRadius: 2,
                              }
                            ];
                        const tokenData = { labels, datasets: tokenDatasets };
                        return (
                          <Bar
                            data={tokenData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  display: tokenIsStacked,
                                  position: 'top',
                                  labels: { color: '#71717a', font: { size: 9 }, boxWidth: 8, padding: 8, usePointStyle: true }
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                  titleColor: '#fff',
                                  bodyColor: '#a1a1aa',
                                  borderColor: '#3f3f46',
                                  borderWidth: 1,
                                  callbacks: {
                                    label: (ctx) => {
                                      const val = ctx.parsed.y || 0;
                                      const label = ctx.dataset.label || '';
                                      return ` ${label}: ${formatTokens(val)} tokens`;
                                    },
                                    afterLabel: tokenIsStacked ? (ctx: any) => {
                                      const allIn = inData[ctx.dataIndex] || 0;
                                      const allOut = outData[ctx.dataIndex] || 0;
                                      const total = allIn + allOut;
                                      if (total === 0) return '';
                                      return ` Total: ${formatTokens(total)} (${((allIn / total) * 100).toFixed(0)}% in / ${((allOut / total) * 100).toFixed(0)}% out)`;
                                    } : undefined
                                  }
                                }
                              },
                              scales: {
                                x: {
                                  stacked: tokenIsStacked,
                                  ticks: { color: '#71717a', maxTicksLimit: numDays <= 7 ? 7 : 8, font: { size: 10 } },
                                  grid: { display: false }
                                },
                                y: {
                                  stacked: tokenIsStacked,
                                  ticks: {
                                    color: '#71717a',
                                    font: { size: 10 },
                                    callback: (v) => formatTokens(v as number)
                                  },
                                  grid: { color: '#27272a' },
                                  beginAtZero: true,
                                }
                              }
                            }}
                          />
                        );
                      }

                      // Non-tokens mode: single dataset
                      const chartData = {
                        labels,
                        datasets: [{
                          label: aiChartMode.charAt(0).toUpperCase() + aiChartMode.slice(1),
                          data: periodDays.map(d => getMetricValue(format(d, 'yyyy-MM-dd'))),
                          backgroundColor: selectedAgentDetail.color + '40',
                          borderColor: selectedAgentDetail.color,
                          borderWidth: 2,
                          borderRadius: 4,
                        }]
                      };
                      return (
                        <Bar
                          data={chartData}
                          options={{
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
                                callbacks: {
                                  label: (ctx) => {
                                    const val = ctx.parsed.y || 0;
                                    if (aiChartMode === 'cost') return ` ${formatCurrency(val)}`;
                                    if (aiChartMode === 'messages') return ` ${val} messages`;
                                    return ` ${val} sessions`;
                                  }
                                }
                              }
                            },
                            scales: {
                              x: { ticks: { color: '#71717a', maxTicksLimit: numDays <= 7 ? 7 : 8, font: { size: 10 } }, grid: { display: false } },
                              y: {
                                ticks: {
                                  color: '#71717a',
                                  font: { size: 10 },
                                  callback: (v) => {
                                    if (aiChartMode === 'cost') return `$${(v as number).toFixed(2)}`;
                                    return String(v);
                                  }
                                },
                                grid: { color: '#27272a' },
                                beginAtZero: true,
                              }
                            }
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Model Usage Timeline */}
                {(() => {
                  const modelDaily = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.modelDaily || {};
                  const modelNames = Object.keys(modelDaily);
                  if (modelNames.length <= 1) return null;

                  let numDays = modalEffectivePeriod === 'week' ? 7 : modalEffectivePeriod === 'month' ? 30 : 7;
                  if (modalEffectivePeriod === 'all') {
                    const allDaily = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily || {};
                    const dateStrs = Object.keys(allDaily);
                    if (dateStrs.length > 0) {
                      const sorted = dateStrs.sort();
                      const span = Math.ceil((new Date(sorted[sorted.length - 1]).getTime() - new Date(sorted[0]).getTime()) / 86400000) + 30;
                      numDays = Math.min(180, Math.max(span, 60));
                    } else { numDays = 60; }
                  }
                  const periodDays = eachDayOfInterval({ start: subDays(new Date(), numDays - 1), end: new Date() });
                  const modelColors = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

                  const metricField = aiChartMode === 'tokens' ? 'tokens'
                    : aiChartMode === 'messages' ? 'messageCount'
                    : aiChartMode === 'cost' ? 'cost'
                    : 'sessions';

                  const metricLabel = aiChartMode.charAt(0).toUpperCase() + aiChartMode.slice(1);

                  const datasets = modelNames.slice(0, 6).map((model, idx) => {
                    const modelData = modelDaily[model] || {};
                    return {
                      label: model.length > 30 ? model.slice(0, 27) + '...' : model,
                      data: periodDays.map(d => {
                        const dayStr = format(d, 'yyyy-MM-dd');
                        return modelData[dayStr]?.[metricField] || 0;
                      }),
                      backgroundColor: modelColors[idx % modelColors.length] + '60',
                      borderColor: modelColors[idx % modelColors.length],
                      borderWidth: 1,
                      borderRadius: 2,
                    };
                  });

                  const chartData = {
                    labels: periodDays.map(d => format(d, numDays <= 7 ? 'EEE' : 'MMM dd')),
                    datasets,
                  };

                  return (
                    <div className="bg-[var(--color-card)] rounded-lg p-4 lg:col-span-2">
                      <h4 className="text-sm font-medium text-zinc-400 mb-3">Model Usage Timeline — {metricLabel}</h4>
                      <div className="h-48">
                        <Bar
                          data={chartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                display: true,
                                position: 'top',
                                labels: { color: '#71717a', font: { size: 9 }, boxWidth: 8, padding: 8 }
                              },
                              tooltip: {
                                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                titleColor: '#fff',
                                bodyColor: '#a1a1aa',
                                borderColor: '#3f3f46',
                                borderWidth: 1,
                                callbacks: {
                                  label: (ctx) => {
                                    const val = ctx.parsed.y || 0;
                                    if (aiChartMode === 'tokens') return ` ${formatTokens(val)} tokens`;
                                    if (aiChartMode === 'cost') return ` ${formatCurrency(val)}`;
                                    if (aiChartMode === 'messages') return ` ${val} messages`;
                                    return ` ${val} sessions`;
                                  }
                                }
                              }
                            },
                            scales: {
                              x: {
                                stacked: true,
                                ticks: { color: '#71717a', maxTicksLimit: numDays <= 7 ? 7 : 8, font: { size: 10 } },
                                grid: { display: false }
                              },
                              y: {
                                stacked: true,
                                ticks: {
                                  color: '#71717a',
                                  font: { size: 10 },
                                  callback: (v) => {
                                    if (aiChartMode === 'tokens') return formatTokens(v as number);
                                    if (aiChartMode === 'cost') return `$${(v as number).toFixed(2)}`;
                                    return String(v);
                                  }
                                },
                                grid: { color: '#27272a' },
                                beginAtZero: true,
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Project Breakdown */}
                {(() => {
                  const projects = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.projects || [];
                  if (projects.length === 0) return null;
                  return (
                    <div className="bg-[var(--color-card)] rounded-lg p-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-3">Project Breakdown</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {projects.slice(0, 10).map((proj: any, idx: number) => (
                          <div key={proj.model} className="flex items-center justify-between p-2 bg-[rgba(255,255,255,0.04)] rounded-lg">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-zinc-300 truncate" title={proj.path}>{proj.path}</div>
                              <div className="text-[10px] text-zinc-500">{proj.sessions} sessions • {proj.messageCount} msgs</div>
                            </div>
                            <div className="text-xs text-violet-400 font-medium tabular-nums ml-2"><TokenValue value={proj.tokens} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Model Breakdown — period-aware */}
                {(() => {
                  const daysMap: Record<string, number> = { 'week': 7, 'month': 30, 'all': 9999 };
                const numDays = daysMap[modalEffectivePeriod] || 7;
                  const cutoff = numDays >= 9999 ? null : subDays(new Date(), numDays - 1);
                  const modelDaily = modalData?.aiUsage?.byTool?.[selectedAgentDetail.id]?.modelDaily || {};

                  // Aggregate modelBreakdown from modelDaily filtered by period
                  const modelAgg: Record<string, { model: string; tokens: number; tokens_in: number; tokens_out: number; messageCount: number; sessions: number }> = {};
                  for (const [model, dayRecords] of Object.entries(modelDaily)) {
                    for (const [dateStr, dayData] of Object.entries(dayRecords as Record<string, any>)) {
                      if (cutoff) {
                        const d = new Date(dateStr);
                        if (d < cutoff) continue;
                      }
                      if (!modelAgg[model]) {
                        modelAgg[model] = { model, tokens: 0, tokens_in: 0, tokens_out: 0, messageCount: 0, sessions: 0 };
                      }
                      modelAgg[model].tokens += (dayData.tokens || 0);
                      modelAgg[model].tokens_in += (dayData.tokens_in || 0);
                      modelAgg[model].tokens_out += (dayData.tokens_out || 0);
                      modelAgg[model].messageCount += (dayData.messageCount || 0);
                      modelAgg[model].sessions += (dayData.sessions || 0);
                    }
                  }

                  const models = Object.values(modelAgg).sort((a, b) => b.tokens - a.tokens);
                  if (models.length === 0) return null;

                  const periodLabel = modalPeriod === 'today' ? 'Today' : modalPeriod === 'week' ? 'This Week' : modalPeriod === '7day' ? '7 Days' : modalPeriod === 'month' ? 'This Month' : modalPeriod === '30day' ? '30 Days' : 'All Time';

                  return (
                    <div className="bg-[var(--color-card)] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-zinc-400">Model Breakdown</h4>
                        <span className="text-[10px] text-zinc-500 bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 px-2 py-0.5 rounded">{periodLabel}</span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {models.slice(0, 10).map((m: any, idx: number) => (
                          <div key={m.model} className="flex items-center justify-between p-2 bg-[rgba(255,255,255,0.04)] rounded-lg">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-zinc-300 truncate" title={m.model}>{m.model}</div>
                              <div className="text-[10px] text-zinc-500">{m.sessions} sessions • {m.messageCount} msgs</div>
                            </div>
                            <div className="text-xs text-blue-400 font-medium tabular-nums ml-2"><TokenValue value={m.tokens} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="text-xs text-zinc-500 mb-4">
                Last used: {selectedAgentDetail.lastUsed ? format(selectedAgentDetail.lastUsed, 'MMM dd, yyyy HH:mm') : 'Never'}
              </div>

              {/* Agent-specific help info */}
              <GlassCard className="p-4 bg-[var(--color-card)] border-zinc-700 light:border-zinc-300/50">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">How This Is Calculated</h4>
                <div className="space-y-1 text-xs text-zinc-500">
                  <p><span className="text-zinc-300">Sessions:</span> Number of chat/conversation files. One JSONL file = one session.</p>
                  <p><span className="text-zinc-300">Messages:</span> Count of user + assistant exchanges in session files.</p>
                  <p><span className="text-zinc-300">Tokens:</span> Sum of input (human prompts) + output (AI responses) tokens parsed from session files.</p>
                  <p><span className="text-zinc-300">Input Tokens:</span> Tokens from user/human messages — what you wrote.</p>
                  <p><span className="text-zinc-300">Output Tokens:</span> Tokens from AI/assistant responses — what the AI wrote.</p>
                  <p><span className="text-zinc-300">In:Out Ratio:</span> Shows how many output tokens the AI generates per 1 input token you send. Higher = more verbose AI.</p>
                  <p><span className="text-zinc-300">Cost:</span> Calculated from tokens using provider pricing.</p>
                  {selectedAgentDetail.id === 'claude-code' && (
                    <p className="text-violet-400">Claude Code: Reads ~/.claude/projects/*/*.jsonl files (including subagents/)</p>
                  )}
                  {selectedAgentDetail.id === 'qwen' && (
                    <p className="text-amber-400">Qwen: Reads ~/.qwen/projects/*/chats/*.jsonl files</p>
                  )}
                  {selectedAgentDetail.id === 'opencode' && (
                    <p className="text-blue-400">OpenCode: Reads ~/.local/share/opencode/opencode.db SQLite database</p>
                  )}
                  {selectedAgentDetail.id === 'gemini' && (
                    <p className="text-cyan-400">Gemini: Reads ~/.gemini/tmp/*/chats/*.jsonl files</p>
                  )}
                  {selectedAgentDetail.id === 'aider' && (
                    <p className="text-orange-400">Aider: Reads ~/.oobo/aider-analytics.jsonl</p>
                  )}
                  {selectedAgentDetail.id === 'codex' && (
                    <p className="text-emerald-400">Codex: Reads ~/.codex/sessions/*.jsonl files</p>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Features Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border border-zinc-700 light:border-zinc-300 rounded-lg p-5 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Features & Capabilities
                </h3>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 light:bg-zinc-100 hover:bg-zinc-700 light:bg-zinc-200 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6">
                <GlassCard className="p-4">
                  <h4 className="text-emerald-400 font-medium mb-3">IDE Detection</h4>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    <li>• IntelliJ IDEA (IntelliJ, Community)</li>
                    <li>• PyCharm (Professional, Community)</li>
                    <li>• WebStorm, GoLand, Rider, DataGrip</li>
                    <li>• VS Code, Cursor</li>
                    <li>• Android Studio</li>
                  </ul>
                </GlassCard>

                <GlassCard className="p-4">
                  <h4 className="text-violet-400 font-medium mb-3">AI Tool Integration</h4>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    <li>• Claude Code - parses .claude/projects/*.jsonl</li>
                    <li>• OpenCode - reads opencode.db</li>
                    <li>• Gemini CLI - parses tmp/*/chats</li>
                    <li>• Codex CLI, Qwen, Aider</li>
                    <li>Tracks: tokens, cost, sessions</li>
                  </ul>
                </GlassCard>

                <GlassCard className="p-4">
                  <h4 className="text-blue-400 font-medium mb-3">Project Tracking</h4>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    <li>• Add projects with path & default IDE</li>
                    <li>• Open in detected IDE</li>
                    <li>• Track primary language</li>
                    <li>• Git repository integration</li>
                  </ul>
                </GlassCard>

                <GlassCard className="p-4">
                  <h4 className="text-amber-400 font-medium mb-3">Tools Detection</h4>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    <li>• Git - version control</li>
                    <li>• Node.js, npm, yarn, pnpm</li>
                    <li>• Python, pip, uv</li>
                    <li>• Docker, Docker Compose</li>
                    <li>• And many more...</li>
                  </ul>
                </GlassCard>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Project Modal - Accessible from any tab */}
      <AnimatePresence>
        {showAddProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowAddProject(false); setAddProjectError(null); setSelectedQuickProjects(new Set()); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border border-zinc-700 light:border-zinc-300 rounded-lg p-5 max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  Add New Project
                </h3>
                <button
                onClick={() => { setShowAddProject(false); setAddProjectError(null); setCustomDirResults({}); setSelectedQuickProjects(new Set()); }}
  className="p-1 text-zinc-400 hover:text-white transition"
>
  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 ws-scroll">
                {addProjectError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {addProjectError}
                  </div>
                )}

                {loadingQuickAdd ? (
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning IDE default directories...
                  </div>
                ) : quickAddProjects.length > 0 && (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Quick Add from IDE Directories</label>
                    <div className="flex flex-col gap-2">
                      {quickAddProjects.map(group => (
                        <div key={group.ide}>
                          <div className="text-xs text-zinc-500 mb-1 ml-1">{group.ide}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.projects.map(p => {
                              const isSel = selectedQuickProjects.has(p.path);
                              return (
                              <button
                                key={p.path}
                                onClick={() => {
                                  setSelectedQuickProjects(prev => {
                                    const next = new Set(prev);
                                    if (next.has(p.path)) next.delete(p.path); else next.add(p.path);
                                    return next;
                                  });
                                  setNewProject({ name: p.name, path: p.path, repositoryUrl: '', defaultIde: '' });
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition text-sm ${
                                  isSel
                                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                    : 'bg-zinc-800 light:bg-zinc-100/80 hover:bg-zinc-700 light:bg-zinc-200 text-zinc-300 hover:text-white border-zinc-700 light:border-zinc-300 hover:border-indigo-500/50'
                                }`}
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate max-w-[200px]">{p.name}</span>
                              </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedQuickProjects.size > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 bg-indigo-600/10 border border-indigo-500/30 rounded-lg">
                    <span className="text-sm text-indigo-300">
                      {selectedQuickProjects.size} project{selectedQuickProjects.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setSelectedQuickProjects(new Set())}
                      className="text-xs text-zinc-400 hover:text-white transition"
                    >
                      Clear selection
                    </button>
                  </div>
                )}

                {/* Saved Custom Directories */}
                {savedCustomDirs.length > 0 && (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Saved Directories</label>
                    <div className="space-y-2">
                      {savedCustomDirs.map(dir => {
                        const dirResults = customDirResults[dir];
                        const isLoading = scanningDirs;
                        return (
                          <div key={dir} className="bg-[var(--color-card)] border border-zinc-700 light:border-zinc-300 rounded-lg p-2">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs text-zinc-400 truncate flex-1 font-mono">{dir}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isLoading && !dirResults && (
                                  <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                                )}
                                {dirResults && (
                                  <span className="text-[10px] text-zinc-500">{dirResults.length} project{dirResults.length !== 1 ? 's' : ''}</span>
                                )}
                                <button
                                  onClick={() => {
                                    const next = savedCustomDirs.filter(d => d !== dir);
                                    setSavedCustomDirs(next);
                                    window.deskflowAPI!.saveCustomScanDirs(next);
                                    const r = { ...customDirResults };
                                    delete r[dir];
                                    setCustomDirResults(r);
                                  }}
                                  className="p-0.5 text-zinc-500 hover:text-red-400 transition"
                                  title="Remove directory"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {isLoading && !dirResults ? (
                              <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Scanning...
                              </div>
                            ) : dirResults && dirResults.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {dirResults.map(p => {
                              const isSel = selectedQuickProjects.has(p.path);
                              return (
                                <button
                                  key={p.path}
                                  onClick={() => {
                                    setSelectedQuickProjects(prev => {
                                      const next = new Set(prev);
                                      if (next.has(p.path)) next.delete(p.path); else next.add(p.path);
                                      return next;
                                    });
                                    setNewProject({ name: p.name, path: p.path, repositoryUrl: '', defaultIde: '' });
                                  }}
                                  className={`flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-lg border transition text-xs ${
                                    isSel
                                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                      : 'bg-zinc-800 light:bg-zinc-100 hover:bg-zinc-700 light:bg-zinc-200 text-zinc-300 hover:text-white border-zinc-700 light:border-zinc-300 hover:border-indigo-500/50'
                                  }`}
                                >
                                  <span className="truncate max-w-[180px]">{p.name}</span>
                                  <span className="text-[10px] text-zinc-500 flex flex-wrap gap-1">
                                    {p.languages.slice(0, 3).map(lang => (
                                      <span key={lang} className="px-1 py-0.5 bg-[var(--color-card)] rounded text-zinc-400 border border-zinc-700 light:border-zinc-300">{lang}</span>
                                    ))}
                                    {p.languages.length > 3 && <span className="text-zinc-600">+{p.languages.length - 3}</span>}
                                  </span>
                                </button>
                              );
                            })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-zinc-600 mt-0.5">No coding projects found</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Add Directory Button */}
                <button
                  onClick={async () => {
                    const result = await window.deskflowAPI!.pickFolder();
                    if (result.success && result.path) {
                      if (savedCustomDirs.includes(result.path)) return;
                      const next = [...savedCustomDirs, result.path];
                      setSavedCustomDirs(next);
                      window.deskflowAPI!.saveCustomScanDirs(next);
                      setScanningDirs(true);
                      try {
                        const scan = await window.deskflowAPI!.scanCustomDirectory(result.path);
                        if (scan.success) {
                          setCustomDirResults(prev => ({ ...prev, [result.path]: scan.projects }));
                        }
                      } catch {}
                      setScanningDirs(false);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 light:bg-zinc-100 hover:bg-zinc-700 light:bg-zinc-200 text-zinc-400 hover:text-white rounded-lg border border-dashed border-zinc-700 light:border-zinc-300 hover:border-indigo-500/50 transition text-sm w-full justify-center"
                >
                  <FolderOpen className="w-4 h-4" />
                  Add Directory
                </button>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Project Name *</label>
                    <VoiceInputWrapper>
                      <input
                        type="text"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        placeholder="My Project"
                        className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-indigo-500 focus:outline-none"
                      />
                    </VoiceInputWrapper>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Project Path *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProject.path}
                        onChange={(e) => setNewProject({ ...newProject, path: e.target.value })}
                        placeholder="C:\Projects\my-project"
                        className="flex-1 px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                          const result = await window.deskflowAPI!.pickFolder();
                          if (result.success && result.path) {
                            setNewProject({ ...newProject, path: result.path });
                          }
                        }}
                        className="px-4 py-3 bg-zinc-700 light:bg-zinc-200 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600 light:border-zinc-300 transition"
                        title="Browse for folder"
                      >
                        <FolderOpen className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Repository URL (optional)</label>
                    <input
                      type="text"
                      value={newProject.repositoryUrl}
                      onChange={(e) => setNewProject({ ...newProject, repositoryUrl: e.target.value })}
                      placeholder="https://github.com/user/repo"
                      className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Default IDE (optional)</label>
                    <select
                      value={newProject.defaultIde}
                      onChange={(e) => setNewProject({ ...newProject, defaultIde: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select an IDE...</option>
                      {overview?.ides?.map((ide: any) => (
                        <option key={ide.id} value={ide.id}>{ide.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 light:border-zinc-200">
                <button
                  onClick={() => { setShowAddProject(false); setAddProjectError(null); setCustomDirResults({}); setSelectedQuickProjects(new Set()); }}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProject}
                  disabled={!newProject.name || !newProject.path || addingProject}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingProject ? 'Adding...' : 'Add Project'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Project Modal */}
      <AnimatePresence>
        {showEditProject && editingProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowEditProject(false); setEditingProject(null); setAddProjectError(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border border-zinc-700 light:border-zinc-300 rounded-lg p-5 max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-violet-400" />
                  Edit Project
                </h3>
                <button
                  onClick={() => { setShowEditProject(false); setEditingProject(null); setAddProjectError(null); }}
                  className="p-1 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {addProjectError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {addProjectError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={editProjectForm.name}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Project Path *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editProjectForm.path}
                      onChange={(e) => setEditProjectForm({ ...editProjectForm, path: e.target.value })}
                      className="flex-1 px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        const result = await window.deskflowAPI!.pickFolder();
                        if (result.success && result.path) {
                          setEditProjectForm({ ...editProjectForm, path: result.path });
                        }
                      }}
                      className="px-4 py-3 bg-zinc-700 light:bg-zinc-200 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600 light:border-zinc-300 transition"
                      title="Browse for folder"
                    >
                      <FolderOpen className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Repository URL (optional)</label>
                  <input
                    type="text"
                    value={editProjectForm.repositoryUrl}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, repositoryUrl: e.target.value })}
                    placeholder="https://github.com/user/repo"
                    className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div ref={languageDropdownRef}>
                  <label className="block text-sm text-zinc-400 mb-2">Primary Language (optional)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={editProjectForm.primaryLanguage}
                        onChange={(e) => {
                          setEditProjectForm({ ...editProjectForm, primaryLanguage: e.target.value });
                          setShowLanguageDropdown(true);
                        }}
                        onFocus={() => setShowLanguageDropdown(true)}
                        placeholder="Search or type a language..."
                        className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-violet-500 focus:outline-none pr-10"
                      />
                      <ChevronDown
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
                      />
                      {showLanguageDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-zinc-800 light:bg-zinc-100 border border-zinc-700 light:border-zinc-300 rounded-lg max-h-48 overflow-y-auto">
                          {filteredLanguages.length > 0 ? (
                            filteredLanguages.map(lang => (
                              <button
                                key={lang}
                                onClick={() => handleLanguageSelect(lang)}
                                className={`w-full text-left px-4 py-2 text-white hover:bg-zinc-700 light:bg-zinc-200 transition ${
                                  editProjectForm.primaryLanguage === lang ? 'bg-violet-500/20 text-violet-300' : ''
                                }`}
                              >
                                {lang}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-zinc-500 text-sm">
                              No match — using &ldquo;{editProjectForm.primaryLanguage}&rdquo;
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleDetectLanguage}
                      disabled={detectingLanguage || !editProjectForm.path}
                      className="px-3 py-3 bg-zinc-700 light:bg-zinc-200 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600 light:border-zinc-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Auto-detect language from project files"
                    >
                      {detectingLanguage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Search className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">VCS Type (optional)</label>
                  <select
                    value={editProjectForm.vcsType}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, vcsType: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select VCS...</option>
                    <option value="git">Git</option>
                    <option value="svn">SVN</option>
                    <option value="mercurial">Mercurial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Default IDE (optional)</label>
                  <select
                    value={editProjectForm.defaultIde}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, defaultIde: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select an IDE...</option>
                    {overview?.ides?.map((ide: any) => (
                      <option key={ide.id} value={ide.id}>{ide.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800 light:border-zinc-200">
                <button
                  onClick={() => { setShowEditProject(false); setEditingProject(null); setAddProjectError(null); }}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProject}
                  disabled={!editProjectForm.name || !editProjectForm.path || updatingProject}
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingProject ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowDeleteConfirm(false); setDeletingProjectId(null); setDeletingProjectName(''); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border border-zinc-700 light:border-zinc-300 rounded-lg p-5 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-500/20 rounded-full">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Delete Project?</h3>
                  <p className="text-sm text-zinc-400">This action can be undone later</p>
                </div>
              </div>

              <p className="text-zinc-300 mb-6">
                Are you sure you want to delete <span className="text-white font-medium">"{deletingProjectName}"</span>? 
                The project will be moved to trash and can be restored at any time.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletingProjectId(null); setDeletingProjectName(''); }}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
                >
                  Delete Project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Run Project Configuration Modal */}
      <AnimatePresence>
        {showRunConfig && runConfigProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRunConfig(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--color-card)] border border-zinc-800 light:border-zinc-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Configure Run Commands</h2>
                  <p className="text-sm text-zinc-500 mt-1">{runConfigProject.name}</p>
                </div>
                <button onClick={() => setShowRunConfig(false)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 light:bg-zinc-100 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detectedScripts?.framework && (
                <div className="mb-4 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                  <span className="text-xs text-indigo-400">Detected framework:</span>
                  <span className="text-sm text-white ml-2 font-medium">{detectedScripts.framework}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Single command mode */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Dev Command</label>
                  <input
                    type="text"
                    defaultValue={detectedScripts?.single?.command || runConfigData?.single?.command || ''}
                    id="run-cmd-single"
                    placeholder="e.g., npm run dev"
                    className="w-full px-3 py-2.5 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-emerald-500 focus:outline-none text-sm font-mono"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <label className="text-xs text-zinc-500">Port (optional):</label>
                    <input
                      type="number"
                      defaultValue={detectedScripts?.single?.port || runConfigData?.single?.port || ''}
                      id="run-port-single"
                      placeholder="3000"
                      className="w-24 px-2 py-1.5 bg-zinc-800 light:bg-zinc-100 text-white rounded border border-zinc-700 light:border-zinc-300 focus:border-emerald-500 focus:outline-none text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800 light:border-zinc-200 pt-4">
                  <p className="text-xs text-zinc-500 mb-3">Or use separate frontend/backend commands:</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Frontend Command</label>
                      <input
                        type="text"
                        defaultValue={detectedScripts?.frontend?.command || runConfigData?.frontend?.command || ''}
                        id="run-cmd-frontend"
                        placeholder="e.g., npm run dev"
                        className="w-full px-3 py-2 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-blue-500 focus:outline-none text-sm font-mono"
                      />
                      <input
                        type="number"
                        defaultValue={detectedScripts?.frontend?.port || runConfigData?.frontend?.port || ''}
                        id="run-port-frontend"
                        placeholder="Port (e.g., 5173)"
                        className="w-full mt-1.5 px-2 py-1.5 bg-zinc-800 light:bg-zinc-100 text-white rounded border border-zinc-700 light:border-zinc-300 focus:border-blue-500 focus:outline-none text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Backend Command</label>
                      <input
                        type="text"
                        defaultValue={detectedScripts?.backend?.command || runConfigData?.backend?.command || ''}
                        id="run-cmd-backend"
                        placeholder="e.g., python manage.py runserver"
                        className="w-full px-3 py-2 bg-zinc-800 light:bg-zinc-100 text-white rounded-lg border border-zinc-700 light:border-zinc-300 focus:border-orange-500 focus:outline-none text-sm font-mono"
                      />
                      <input
                        type="number"
                        defaultValue={detectedScripts?.backend?.port || runConfigData?.backend?.port || ''}
                        id="run-port-backend"
                        placeholder="Port (e.g., 8000)"
                        className="w-full mt-1.5 px-2 py-1.5 bg-zinc-800 light:bg-zinc-100 text-white rounded border border-zinc-700 light:border-zinc-300 focus:border-orange-500 focus:outline-none text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800 light:border-zinc-200">
                <button
                  onClick={() => setShowRunConfig(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const singleCmd = (document.getElementById('run-cmd-single') as HTMLInputElement)?.value;
                    const singlePort = (document.getElementById('run-port-single') as HTMLInputElement)?.value;
                    const feCmd = (document.getElementById('run-cmd-frontend') as HTMLInputElement)?.value;
                    const fePort = (document.getElementById('run-port-frontend') as HTMLInputElement)?.value;
                    const beCmd = (document.getElementById('run-cmd-backend') as HTMLInputElement)?.value;
                    const bePort = (document.getElementById('run-port-backend') as HTMLInputElement)?.value;

                    const config: any = {};
                    if (singleCmd) {
                      config.single = { command: singleCmd, port: singlePort ? parseInt(singlePort) : undefined };
                    }
                    if (feCmd) {
                      config.frontend = { command: feCmd, port: fePort ? parseInt(fePort) : undefined };
                    }
                    if (beCmd) {
                      config.backend = { command: beCmd, port: bePort ? parseInt(bePort) : undefined };
                    }
                    handleSaveRunConfig(config);
                  }}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm font-medium"
                >
                  Save & Run
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Workspace Modal — only in DOM when open to avoid blocking sidebar/nav */}
      <AnimatePresence>
        {workspaceProject && isWorkspaceOpen && (
          <motion.div
            key="workspace-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-[200] flex flex-col"
          >
            {/* Workspace Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-card)] border-b border-zinc-800 light:border-zinc-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-close-workspace-dialog'))}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 light:bg-zinc-100 rounded-lg transition-colors"
                  title="Close workspace"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsWorkspaceOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 light:bg-zinc-100 rounded-lg transition-colors"
                  title="Minimize workspace"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-zinc-700 light:bg-zinc-200 mx-1" />
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-medium text-zinc-300">{workspaceProject.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (provisionStatus === 'provisioned') {
                      if (!window.confirm('This project is already initialized. Re-initialize workspace files?')) return;
                    }
                    setShowInitModal(true);
                  }}
                  disabled={provisionStatus === 'provisioning' || !selectedProject}
                  className="px-2.5 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Initialize workspace infrastructure"
                >
                  <FolderTree className="w-3.5 h-3.5" />
                  Initialize
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-new-agent'))}
                  disabled={!selectedProject}
                  className="px-2 py-1.5 bg-zinc-700 light:bg-zinc-200/60 hover:bg-zinc-600/60 border border-zinc-600 light:border-zinc-300/50 text-zinc-300 text-xs rounded-lg flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Start a new AI agent session"
                >
                  <Bot className="w-3.5 h-3.5" />
                  New Agent
                </button>
                <div className="w-px h-5 bg-zinc-700 light:bg-zinc-200" />
                <button
                  onClick={() => setShowSpecs(!showSpecs)}
                  className={`px-2 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors duration-150 ${showSpecs ? 'bg-cyan-700/50 text-cyan-200 border border-cyan-600/50' : 'bg-zinc-700 light:bg-zinc-200/60 hover:bg-zinc-600/60 border border-zinc-600 light:border-zinc-300/50 text-zinc-300'}`}
                  title="View feature specifications"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Specs
                </button>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 flex overflow-hidden">
              <div className={`flex-1 min-w-0 ${showSpecs ? 'border-r border-zinc-800 light:border-zinc-200' : ''}`}>
                <TerminalPage projectId={workspaceProject.id} projectPath={workspaceProject.path} onCloseWorkspace={handleCloseWorkspace} />
              </div>
              {showSpecs && (
                <div className="w-[45%] overflow-hidden border-l border-zinc-800 light:border-zinc-200">
                  <div className="h-full overflow-auto">
                    <FeatureSpecPanel projectPath={workspaceProject?.path} />
                  </div>
                </div>
              )}
            </div>

            {/* Initialize Progress Modal */}
            <InitializeProgressModal
              isOpen={showInitModal}
              onClose={() => {
                setShowInitModal(false);
                if (provisionStatus !== 'provisioned') setProvisionStatus('provisioned');
              }}
              onComplete={() => setProvisionStatus('provisioned')}
              projectId={selectedProject || undefined}
              projectPath={workspaceProject?.path}
              isReinit={provisionStatus === 'provisioned'}
            />

          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </PageShell>
  );
}
