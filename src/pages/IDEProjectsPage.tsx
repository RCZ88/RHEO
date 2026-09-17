import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import TerminalPage from './TerminalPage';
// motion removed per LAMINAR constitution
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
  ArrowRight,
  Sigma,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { NumberTicker } from '@/components/ui/number-ticker';
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
import { StatsGrid } from '../components/ide/StatsGrid';
import { LanguageChart } from '../components/ide/LanguageChart';
import { AIUsageChart } from '../components/ide/AIUsageChart';
import { CommitHeatmap } from '../components/ide/CommitHeatmap';
import { ProjectHealthGrid } from '../components/ide/ProjectHealthGrid';
import { QuickActions } from '../components/ide/QuickActions';
import { ActivityFeed } from '../components/ide/ActivityFeed';
import { CostTracker } from '../components/ide/CostTracker';
import { PulseRing } from '../components/ide/PulseRing';

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
    <div className="bg-[var(--color-card)] border-[var(--border-hairline)] rounded-[10px] p-3 flex flex-col text-center">
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold mb-2">{label}</div>
      
      {/* Usage bar */}
      <div className="w-full h-1.5 bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-full mb-2 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${stats.overLimit ? 'bg-red-500' : stats.usagePercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(100, stats.usagePercent)}%` }}
        />
      </div>

      {/* Usage vs Limit */}
      <div className="text-[10px] text-[var(--text-muted)] mb-1">
        <span className={stats.overLimit ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
          {formatTokens(stats.estimatedTotal)}
        </span>
        <span className="text-[var(--text-muted)]"> / {formatTokens(stats.totalLimit)}</span>
      </div>

      {/* Average daily */}
      <div className="text-[9px] text-[var(--text-muted)] mb-1.5">
        Avg: <span className="text-[var(--text-muted)]">{formatTokens(stats.avgDaily)}</span>/day
      </div>

      {/* Available or Over limit */}
      {stats.overLimit ? (
        <div className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[8px] text-red-400 font-medium">
          Over limit by {formatTokens(stats.estimatedTotal - stats.totalLimit)}
        </div>
      ) : (
        <div className="text-sm font-bold text-emerald-400">
          {formatTokens(stats.available)}
          <div className="text-[9px] text-[var(--text-muted)] font-normal mt-0.5">tokens left</div>
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
    <div className="bg-[var(--color-card)] rounded-[10px] p-4 mb-6 border border-emerald-500/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[6px] bg-emerald-500/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Usage vs Daily Limit</h4>
            <p className="text-[10px] text-[var(--text-muted)]">Daily allowance: {formatTokens(limit)} tokens/day</p>
          </div>
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">
          {agent.name}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Today" stats={day} />
        <StatCard label="This Week" stats={week} />
        <StatCard label="This Month" stats={month} />
      </div>
      <div className="mt-4 flex items-start gap-2 p-2 rounded-[10px] bg-[var(--color-card)] border-[var(--border-hairline)]">
        <div className="w-1 h-1 rounded-full bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] mt-1.5" />
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic">
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
  const [projectQuery, setProjectQuery] = useState('');
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<Record<string, string>>({});
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
    setOverviewError(null);
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
      setOverviewError('The overview request failed.');
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
          setDetailsError(prev => ({ ...prev, [projectId]: 'Project details failed to load.' }));
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

  const reloadProjectDetails = async (projectId: string) => {
    if (loadingProjectDetails.has(projectId)) return;
    setDetailsError(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    setLoadingProjectDetails(prev => new Set(prev).add(projectId));
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
      console.error('Failed to reload project details:', err);
      setDetailsError(prev => ({ ...prev, [projectId]: 'Project details failed to load.' }));
    } finally {
      setLoadingProjectDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
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
          <span className="text-[10px] text-[var(--text-muted)] font-normal">{value.toLocaleString()}</span>
        ) : (
          <span>{formatTokens(value)}</span>
        )}
        {value > 0 && (
          <span className="text-[9px] text-[var(--text-muted)] font-normal opacity-50 hover:opacity-100 transition-opacity">
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
          <span className="text-[10px] text-[var(--text-muted)] font-normal">${value.toFixed(value >= 1 ? 2 : 4)}</span>
        ) : (
          <span>{formatCurrency(value)}</span>
        )}
        {value > 0 && (
          <span className="text-[9px] text-[var(--text-muted)] font-normal opacity-50 hover:opacity-100 transition-opacity">
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
    <PageShell page="ide-projects" className="max-w-7xl mx-auto space-y-6 overflow-y-auto">
      <div className="relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">IDE &amp; Projects</h1>
          <p className="text-[var(--text-muted)] mt-1">Track your development environment, AI tools, and project metrics</p>
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} aria-label="IDE sections">
        <TabsList className="flex gap-1 p-1 bg-[var(--color-card)] rounded-[6px] w-fit">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <TabsTrigger
                key={key}
                value={key}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium transition-colors duration-150 ${
                  isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {isActive && (
                  <span
                    className="absolute inset-0 bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-[10px]"
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
        <div className="space-y-6">
          {overviewError && !overview ? (
            <div className="border border-rose-500/25 bg-rose-500/[0.06] rounded-[12px] p-5 mb-6 flex flex-wrap items-center gap-3 justify-between" role="alert">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-[8px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Couldn&apos;t load the IDE overview</div>
                  <div className="text-xs text-[var(--text-muted)]">{overviewError} Check the connection and try again.</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadOverview()} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4" tabIndex={0}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-emerald-500/10">
                        <Code2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-[var(--text-muted)]">Lines Added</div>
                        <div className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">{codeActivity?.totalLinesAdded != null ? codeActivity.totalLinesAdded.toLocaleString() : '—'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4" tabIndex={0}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--page-accent)]/10">
                        <Sparkles className="h-4 w-4 text-[var(--page-accent)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-[var(--text-muted)]">AI Tokens</div>
                        <div className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">{overview?.aiUsage?.totalTokens != null ? overview.aiUsage.totalTokens.toLocaleString() : '—'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4" tabIndex={0}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-amber-500/10">
                        <GitCommit className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-[var(--text-muted)]">Commits</div>
                        <div className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">{overview?.commits?.totalCommits ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4" tabIndex={0}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-rose-500/10">
                        <Cpu className="h-4 w-4 text-rose-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-[var(--text-muted)]">Cost</div>
                        <div className="text-lg font-semibold tabular-nums text-[var(--text-primary)]">{overview?.aiUsage?.totalCost != null ? `$${overview.aiUsage.totalCost.toFixed(2)}` : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              {loading ? (
                <div className="h-10 rounded-[8px] bg-[var(--color-card)]" />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowAddProject(true)}
                    className="flex items-center gap-2 rounded-[8px] bg-[var(--page-accent)] px-3 py-2 text-sm font-medium text-[var(--bg-primary)] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)]"
                  >
                    <Plus className="h-4 w-4" /> New Project
                  </button>
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="flex items-center gap-2 rounded-[8px] border border-[var(--border-hairline)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--color-card-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)]"
                  >
                    <FolderGit2 className="h-4 w-4" /> View Projects
                  </button>
                  <button
                    onClick={() => setActiveTab('environment')}
                    className="flex items-center gap-2 rounded-[8px] border border-[var(--border-hairline)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--color-card-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)]"
                  >
                    <Boxes className="h-4 w-4" /> Environment
                  </button>
                </div>
              )}

              {/* Main Content Grid */}
              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Skeleton className="h-64 bg-[var(--color-card)] rounded-[12px]" />
                  <Skeleton className="h-64 bg-[var(--color-card)] rounded-[12px]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* AI Usage Chart */}
                  <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">AI Usage</h3>
                      <span className="text-xs text-[var(--text-muted)]">Last 30 days</span>
                    </div>
                    <div className="mt-4 h-48">
                      {(() => {
                        const activeAgents = aiAgents.filter(a => a.tokens > 0);
                        if (activeAgents.length === 0) {
                          return <EmptyState icon={<Sparkles className="w-8 h-8" />} title="No AI usage" description="Sync AI to start tracking" />;
                        }
                        const overviewDays = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
                        const chartData = {
                          labels: overviewDays.map(d => format(d, 'MMM dd')),
                          datasets: activeAgents.map((agent) => ({
                            label: agent.name,
                            data: overviewDays.map(d => {
                              const dayStr = format(d, 'yyyy-MM-dd');
                              return overview?.aiUsage?.byTool?.[agent.id]?.daily?.[dayStr]?.tokens || 0;
                            }),
                            backgroundColor: agent.color,
                            stack: 'combined',
                          }))
                        };
                        return (
                          <Bar data={chartData} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                              legend: { display: true, position: 'bottom', labels: { color: 'var(--text-muted)', padding: 8, usePointStyle: true } },
                              tooltip: { backgroundColor: 'rgba(24, 24, 27, 0.95)', titleColor: '#fafafa', bodyColor: '#a1a1aa', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
                                callbacks: { label: (ctx: any) => `${ctx.dataset.label || 'AI'}: ${formatTokens(ctx.parsed.y ?? 0)} tokens` }
                              }
                            },
                            scales: {
                              x: { stacked: true, grid: { display: false }, ticks: { color: 'var(--text-muted)', maxTicksLimit: 7 } },
                              y: { stacked: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'var(--text-muted)', callback: (v: any) => formatTokens(v) }, beginAtZero: true }
                            },
                          }} />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Recent Projects */}
                  <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">Recent Projects</h3>
                      <button onClick={() => setActiveTab('projects')} className="text-xs text-[var(--page-accent)] hover:opacity-80">View all</button>
                    </div>
                    {overview?.projects && overview.projects.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {overview.projects.slice(0, 5).map((project: any) => (
                          <button
                            key={project.id}
                            onClick={() => { setActiveTab('projects'); }}
                            className="w-full flex items-center justify-between p-3 rounded-[8px] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] border border-[var(--border-hairline)] transition-colors duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.2)]"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-[8px] bg-[var(--page-accent)]/10 flex items-center justify-center flex-shrink-0">
                                <FolderGit2 className="w-4 h-4 text-[var(--page-accent)]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{project.name}</div>
                                {project.path && <div className="text-xs text-[var(--text-muted)] truncate">{project.path}</div>}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[var(--text-muted)]">No projects yet. Click "New Project" to add one.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div data-section="ide.projects" className="space-y-6">
          <QuickActions />
          <ProjectHealthGrid overview={overview} />
        </div>
      )}

      {/* AI Tools Tab */}
      {activeTab === 'ai' && (
        <div data-section="ide.ai" className="space-y-6">
          <StatsGrid overview={overview} />
          <AIUsageChart />
          <CostTracker />
        </div>
      )}

      {/* Git Tab */}
      {activeTab === 'git' && (
        <div
          data-section="ide.git"
          className="space-y-6"
        >
          {/* Project Selector & Sync */}
          <GlassCard className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <select
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-4 py-2 bg-[var(--color-card)] text-white rounded-[6px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none"
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
            <div
              className="bg-[var(--color-card)] border-[var(--border-hairline)] rounded-[10px] p-5"
            >
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-xl font-semibold">DORA Metrics</div>
                  <div className="text-sm text-[var(--text-muted)]">Monthly performance</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Deploy Frequency', value: doraMetrics.deploymentFrequency, sub: `${doraMetrics.deploymentFrequency || 0}/day` },
                  { label: 'Lead Time', value: doraMetrics.leadTimeHours, sub: doraMetrics.leadTimeHours ? `${doraMetrics.leadTimeHours}h` : 'N/A' },
                  { label: 'MTTR', value: doraMetrics.meanTimeToRecoveryHours, sub: '~1 day est.' },
                  { label: 'Change Failure', value: doraMetrics.changeFailureRate, sub: `${doraMetrics.changeFailureRate || 0}%` },
                ].map((metric, idx) => (
                  <div key={idx} className="bg-[var(--color-card)] rounded-[10px] p-4 text-center">
                    <div className={`text-2xl font-bold mb-1 ${
                      metric.value === 'elite' ? 'text-emerald-400' :
                      metric.value === 'high' ? 'text-blue-400' :
                      metric.value === 'medium' ? 'text-amber-400' :
                      metric.value === 'low' ? 'text-red-400' : 'text-[var(--text-muted)]'
                    }`}>
                      {metric.value || 'N/A'}
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mb-1">{metric.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{metric.sub}</div>
                  </div>
                ))}
              </div>
            </div>
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
                <div
                  className="bg-[var(--color-card)] border-[var(--border-hairline)] rounded-[10px] p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <GitCommit className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-sm font-semibold">Commits per Day</div>
                      <div className="text-xs text-[var(--text-muted)]">Last 30 days</div>
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
                </div>

                <div
                  className="bg-[var(--color-card)] border-[var(--border-hairline)] rounded-[10px] p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-sm font-semibold">Lines Changed</div>
                      <div className="text-xs text-[var(--text-muted)]">Additions vs Deletions</div>
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
                </div>
              </div>
            );
          })()}

          {/* Commit Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Commits', value: overview?.commits?.totalCommits || 0, icon: GitCommit, iconColor: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Lines Added', value: `+${overview?.commits?.totalAdditions || 0}`, icon: Plus, iconColor: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Lines Removed', value: `-${overview?.commits?.totalDeletions || 0}`, icon: Trash2, iconColor: 'text-red-400', bg: 'bg-red-500/10' },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-[var(--color-card)] border-[var(--border-hairline)] rounded-[10px] p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-[6px] ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
                <div className={`text-3xl font-semibold tabular-nums tracking-tight ${stat.iconColor}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-[var(--text-muted)] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Commit History */}
          <div
            className="bg-[var(--color-card)] border-[var(--border-hairline)] rounded-[10px] p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <GitCommit className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-lg font-semibold">Recent Commits</div>
                  <div className="text-sm text-[var(--text-muted)]">Last {commitHistory.length} commits</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!selectedProject) return;
                    setLoadingDiff(true);
                    try {
                      const res = await (window as any).deskflowAPI.getGitDiff(selectedProject, 'working');
                      setGitDiff(res.success ? res.diff : 'No changes');
                    } catch { setGitDiff('Failed to load diff'); }
                    setLoadingDiff(false);
                  }}
                  className="px-3 py-1.5 text-xs bg-[var(--color-card)] light:bg-[var(--color-card)] hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-[var(--text-secondary)] rounded-[6px] transition-colors"
                >
                  {loadingDiff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Show Diff'}
                </button>
              </div>
            </div>

            {commitHistory.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">No commits yet. Sync to load commit history.</div>
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
                      <div
                        onClick={() => setExpandedCommit(isExpanded ? null : commit.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[var(--color-card)] light:bg-[var(--color-card)]/50 light:bg-[var(--color-card)]/50 cursor-pointer transition-colors"
                      >
                        <div className="w-2 h-2 rounded-full bg-amber-500/60 flex-shrink-0" />
                        <span className="font-mono text-xs text-[var(--text-muted)] w-16 flex-shrink-0">
                          {commit.sha?.substring(0, 7)}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)] truncate flex-1">
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
                            <span className="text-[var(--text-muted)]">{commit.files_changed} files</span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--text-muted)] w-16 text-right flex-shrink-0">{relativeDate}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                      {isExpanded && (
                          <div
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-8 pl-4 border-l border-[var(--border-hairline)] light:border-[var(--border-hairline)] py-3 space-y-2">
                              <div className="flex items-center gap-4 text-xs">
                                <span className="text-[var(--text-muted)]">
                                  <span className="text-[var(--text-muted)]">Author:</span> {commit.author}
                                </span>
                                {commit.author_email && (
                                  <span className="text-[var(--text-muted)]">
                                    <span className="text-[var(--text-muted)]">Email:</span> {commit.author_email}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[var(--text-muted)]">
                                <span className="text-[var(--text-muted)]">Date:</span> {new Date(commit.date).toLocaleString()}
                              </div>
                              <div className="text-xs text-[var(--text-muted)]">
                                <span className="text-[var(--text-muted)]">SHA:</span> <span className="font-mono">{commit.sha}</span>
                              </div>
                              {commit.message?.includes('\n') && (
                                <div className="text-xs text-[var(--text-muted)] bg-[var(--color-card)] rounded-[10px] p-3 mt-1 whitespace-pre-wrap">
                                  {commit.message}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Auto-Generate Commit Message */}
          {gitDiff !== null && (
            <div
              className="bg-[var(--color-card)] border-[var(--border-hairline)] rounded-[10px] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <div>
                    <div className="text-lg font-semibold">Generate Commit Message</div>
                    <div className="text-sm text-[var(--text-muted)]">From working tree changes</div>
                  </div>
                </div>
                <button
                  onClick={() => setGitDiff(null)}
                  
                  className="p-1.5 rounded-[10px] hover:bg-[var(--color-card)] light:bg-[var(--color-card)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={gitDiff}
                onChange={(e) => setGitDiff(e.target.value)}
                className="w-full h-40 bg-[var(--color-card)] text-[var(--text-secondary)] text-xs font-mono rounded-[10px] p-3 border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none resize-y"
                placeholder="No changes detected..."
              />

              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => navigator.clipboard.writeText(gitDiff)}
                  className="px-3 py-1.5 text-xs bg-[var(--color-card)] light:bg-[var(--color-card)] hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-[var(--text-secondary)] rounded-[6px] transition-colors"
                >
                  Copy Diff
                </button>
                <button
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
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-[6px] transition-colors disabled:opacity-50"
                >
                  {generatingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingMsg ? 'Generating...' : 'Generate with Agent'}
                </button>
              </div>

              {generatedCommitMsg && (
                <div className="mt-3 p-3 bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[10px]">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Result:</div>
                  <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{generatedCommitMsg}</div>
                  {generatedCommitMsg.startsWith('Prompt sent') && (
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedCommitMsg)}
                      
                      className="mt-2 px-2 py-1 text-xs bg-[var(--color-card)] light:bg-[var(--color-card)] hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-[var(--text-muted)] rounded transition-colors"
                    >
                      Copy Note
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div data-section="ide.analytics" className="space-y-6">
          <LanguageChart />
          <CommitHeatmap />
          <ActivityFeed />
        </div>
      )}

      {/* Backup Tab (replaces Trash) */}
      {activeTab === 'backup' && (
        <div
          data-section="ide.backup"
          className="space-y-6"
        >
          <BackupTabPanel
            projectId={selectedProject}
            projectPath={overview?.projects?.find((p: any) => p.id === selectedProject)?.path || null}
          />
        </div>
      )}

      {/* Setup Guide Modal */}
      {(showSetupModal || showOnboarding) && (
          <div
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
            <div
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-card)] rounded-[10px] w-full max-w-3xl max-h-[85vh] overflow-hidden border-[var(--border-hairline)] light:border-[var(--border-hairline)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-[var(--border-hairline)] light:border-[var(--border-hairline)] flex items-center justify-between sticky top-0 bg-[var(--color-card)] z-10">
                <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[6px] bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-white" />
                  </div>
                  Project Tracking Setup Guide
                </h2>
                <div className="flex items-center gap-3">
                  {!showOnboarding && (
                    <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
                      <VoiceInputWrapper>
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              localStorage.setItem('ide-projects-onboarding-seen', 'true');
                            }
                          }}
                          className="w-4 h-4 rounded border-[var(--border-hairline)] light:border-[var(--border-hairline)] bg-[var(--color-card)] light:bg-[var(--color-card)] text-blue-500 focus:ring-blue-500"
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
                    className="w-8 h-8 flex items-center justify-center rounded-[10px] hover:bg-[var(--color-card)] light:bg-[var(--color-card)] text-[var(--text-muted)] hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(85vh-88px)] space-y-6">
                {showOnboarding && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-[10px] p-4 mb-4">
                    <p className="text-blue-300 text-sm"> Welcome! This guide will help you set up project tracking. Follow the steps below to get started.</p>
                  </div>
                )}

                {/* Step 1: Add Project */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-[6px] bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-emerald-400">1</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        Add Your First Project
                        {overview?.projects && overview.projects.length > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-[10px]">Done</span>
                        )}
                      </h3>
                      <div className="space-y-2 text-sm text-[var(--text-muted)]">
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                          Click the <strong className="text-white">"Add Project"</strong> button
                        </p>
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                          Click <strong className="text-white">"Browse"</strong> and select your project <strong className="text-amber-400">FOLDER</strong> (not the .exe file)
                        </p>
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                          Enter a name for the project
                        </p>
                        <p className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                          (Optional) Add your GitHub repository URL
                        </p>
                      </div>
                      <div className="mt-3 p-3 bg-[var(--color-card)] rounded-[10px]">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Example paths:</p>
                        <p className="text-xs text-emerald-400 font-mono">✓ C:\Projects\MyApp</p>
                      <p className="text-xs text-red-400 font-mono">✗ C:\Projects\MyApp\myapp.exe</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Step 2: AI Usage Tracking */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-[6px] bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-violet-400">2</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3">Track AI Coding Assistant Usage</h3>
                      <p className="text-sm text-[var(--text-muted)] mb-4">We automatically detect these AI tools and import their usage data:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { name: 'Claude Code', path: '~/.claude/projects/<project>/*.jsonl', color: '#f97316' },
                          { name: 'Qwen CLI', path: '~/.qwen/projects/<project>/chats/*.jsonl', color: '#f59e0b' },
                          { name: 'OpenCode', path: '~/.local/share/opencode/opencode.db', color: '#3b82f6' },
                          { name: 'Gemini CLI', path: '~/.gemini/history/', color: '#06b6d4' },
                          { name: 'Cursor AI', path: '%APPDATA%\\Cursor\\', color: '#a855f7' },
                          { name: 'Codex CLI', path: '~/.codex/', color: '#10b981' },
                        ].map((agent) => (
                          <div key={agent.name} className="flex items-center gap-3 p-3 bg-[var(--color-card)] rounded-[10px]">
                            <div className="w-8 h-8 rounded-[6px] flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${agent.color} 13%, transparent)` }}>
                              <Sparkles className="w-4 h-4" style={{ color: agent.color }} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{agent.name}</div>
                              <div className="text-xs text-[var(--text-muted)] font-mono truncate max-w-[180px]">{agent.path}</div>
                            </div>
                            {agentDebugInfo?.agents?.[agent.name.toLowerCase().replace(' ', '-')]?.detected ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-[var(--text-muted)] ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-[10px]">
                        <p className="text-sm text-amber-300">Tip Click <strong>"Sync AI Usage"</strong> to import data from detected AI tools</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Step 3: Git Tracking */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-[6px] bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-amber-400">3</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3">Track Git Commits & Metrics</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-[var(--color-card)] rounded-[10px]">
                          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
                            Local Repositories
                          </h4>
                          <p className="text-sm text-[var(--text-muted)]">Add your project (must contain .git folder), then click "Sync Commits" to import commit history, additions, and deletions.</p>
                        </div>
                        <div className="p-4 bg-[var(--color-card)] rounded-[10px]">
                          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
                            GitHub Repositories
                          </h4>
                          <p className="text-sm text-[var(--text-muted)]">Click "Sync GitHub" and enter <span className="text-violet-400 font-mono">owner/repository</span> (e.g., "facebook/react"). For private repos, add your GitHub token.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Step 4: IDE Detection */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-[6px] bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-blue-400">4</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3">Detect Your Development Environment</h3>
                      <p className="text-sm text-[var(--text-muted)] mb-4">Click "Scan Environment" to automatically detect:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { name: 'VS Code', detected: overview?.ides?.some((i: any) => i.name === 'VS Code') },
                          { name: 'IntelliJ IDEA', detected: overview?.ides?.some((i: any) => i.name?.includes('IntelliJ')) },
                          { name: 'PyCharm', detected: overview?.ides?.some((i: any) => i.name?.includes('PyCharm')) },
                          { name: 'Android Studio', detected: overview?.ides?.some((i: any) => i.name?.includes('Android')) },
                          { name: 'Cursor', detected: overview?.ides?.some((i: any) => i.name === 'Cursor') },
                          { name: 'Google Antigravity', detected: overview?.ides?.some((i: any) => i.name?.includes('Antigravity')) },
                        ].map((ide) => (
                          <div key={ide.name} className="flex items-center gap-2 p-2 bg-[var(--color-card)] rounded-[10px]">
                            <Monitor className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-secondary)]">{ide.name}</span>
                            {ide.detected ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border-[var(--border-hairline)] light:border-[var(--border-hairline)] ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-[var(--color-card)] rounded-[10px]">
                        <p className="text-sm text-[var(--text-muted)]">Also detects: Git, Node.js, Python, Docker, npm, yarn, and more tools.</p>
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
                      <label key={idx} className="flex items-center gap-3 p-3 hover:bg-[var(--color-card)] light:bg-[var(--color-card)]/30 rounded-[10px] cursor-pointer transition-colors">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          item.done ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--border-hairline)] light:border-[var(--border-hairline)]'
                        }`}>
                          {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm ${item.done ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-violet-500/10 border border-violet-500/30 rounded-[10px]">
                    <p className="text-sm text-violet-300">Tip Your data is stored locally and private. No data leaves your computer.</p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        )}

      {/* Scanning Loading Overlay */}
      {scanning && (
          <div
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center"
          >
            <div
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] rounded-[10px] p-5 border-[var(--border-hairline)] light:border-[var(--border-hairline)] max-w-sm w-full mx-4"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Scanning Environment</h3>
                <p className="text-[var(--text-muted)] text-sm mb-4">Detecting IDEs and development tools...</p>
                <div className="w-full bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  />
                </div>
                <p className="text-[var(--text-muted)] text-xs mt-3">Please wait, this may take a moment</p>
              </div>
            </div>
          </div>
        )}

      {/* AI Agent Detail Modal */}
      {selectedAgentDetail && (
          <div
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAgentDetail(null)}
          >
            <div
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[10px] p-5 max-w-4xl w-full max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[6px] flex items-center justify-center" style={{ backgroundColor: selectedAgentDetail.color + '20' }}>
                    <Sparkles className="w-5 h-5" style={{ color: selectedAgentDetail.color }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedAgentDetail.name}</h3>
                    <p className="text-sm text-[var(--text-muted)]">{selectedAgentDetail.status === 'active' ? 'Active' : 'Idle'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgentDetail(null)}
                  className="p-2 hover:bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-[10px] transition"
                >
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Timeline Selector */}
              <div className="flex items-center justify-center mb-5">
                <div className="flex bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-full p-1 text-xs">
                  <button
                    onClick={() => { setModalExpandedPeriod(null); setModalPeriod('today'); }}
                    className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'today' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
                  >
                    Today
                  </button>
                  <div className="relative flex">
                    {modalExpandedPeriod === 'week' ? (
                      <>
                        <button
                          onClick={() => { setModalExpandedPeriod(null); setModalPeriod('week'); }}
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'week' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                          Week
                        </button>
                        <button
                          onClick={() => { setModalExpandedPeriod(null); setModalPeriod('7day'); }}
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === '7day' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                          7 Day
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setModalExpandedPeriod('week')}
                        className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'week' || modalPeriod === '7day' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
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
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'month' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                          Month
                        </button>
                        <button
                          onClick={() => { setModalExpandedPeriod(null); setModalPeriod('30day'); }}
                          className={`px-3 py-1.5 rounded-full transition ${modalPeriod === '30day' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                          30d
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setModalExpandedPeriod('month')}
                        className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'month' || modalPeriod === '30day' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
                      >
                        {modalPeriod === '30day' ? '30d' : 'Month'}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setModalExpandedPeriod(null); setModalPeriod('all'); }}
                    className={`px-3 py-1.5 rounded-full transition ${modalPeriod === 'all' ? 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}
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
                      <span className="text-xs text-[var(--text-muted)] font-medium">{periodLabel}</span>
                      <div className="h-px flex-1 bg-[var(--color-card)] light:bg-[var(--color-card)]" />
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-2">
                      <div className="bg-[var(--color-card)] rounded-[10px] p-3 text-center">
                        <div className="text-xs text-[var(--text-muted)] mb-1">Total Tokens</div>
                        <div className="text-base font-semibold text-white"><TokenValue value={periodTokens} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-3 text-center">
                        <div className="text-xs text-[var(--text-muted)] mb-1">Input (You)</div>
                        <div className="text-base font-semibold text-blue-400"><TokenValue value={periodTokensIn} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-3 text-center">
                        <div className="text-xs text-[var(--text-muted)] mb-1">Output (AI)</div>
                        <div className="text-base font-semibold text-emerald-400"><TokenValue value={periodTokensOut} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-3 text-center">
                        <div className="text-xs text-[var(--text-muted)] mb-1">In:Out Ratio</div>
                        <div className="text-base font-semibold text-amber-400 font-mono">
                          {periodTokensIn > 0 ? `1:${(periodTokensOut / periodTokensIn).toFixed(1)}` : '∞'}
                        </div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-3 text-center">
                        <div className="text-xs text-[var(--text-muted)] mb-1">Input %</div>
                        <div className="text-base font-semibold text-blue-400">
                          {periodTokens > 0 ? `${((periodTokensIn / periodTokens) * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-3 text-center">
                        <div className="text-xs text-[var(--text-muted)] mb-1">Output %</div>
                        <div className="text-base font-semibold text-emerald-400">
                          {periodTokens > 0 ? `${((periodTokensOut / periodTokens) * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-6">
                      <div className="bg-[var(--color-card)] rounded-[10px] p-2.5 text-center">
                        <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Messages</div>
                        <div className="text-sm font-semibold text-blue-400">{periodMessages.toLocaleString()}</div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-2.5 text-center">
                        <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Cost</div>
                        <div className="text-sm font-semibold text-emerald-400"><CostValue value={periodCost} /></div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-2.5 text-center">
                        <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Sessions</div>
                        <div className="text-sm font-semibold text-violet-400">{periodSessions.toLocaleString()}</div>
                      </div>
                      <div className="bg-[var(--color-card)] rounded-[10px] p-2.5 text-center">
                        <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Tokens/Msg</div>
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
                <div className="bg-[var(--color-card)] rounded-[10px] p-4 lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-[var(--text-muted)]">Daily Usage</h4>
                    <div className="flex items-center gap-1 bg-[var(--color-card)] rounded-[10px] p-0.5">
                      {(['tokens', 'messages', 'sessions', 'cost'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAiChartMode(mode)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                            aiChartMode === mode
                              ? 'bg-violet-500/20 text-violet-400'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                          }`}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                      {aiChartMode === 'tokens' && <div className="w-px h-4 bg-[var(--color-card-sunken)] light:bg-[var(--color-card)]" />}
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
                                    : 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)]/50 light:bg-[var(--color-card)]/50 text-[var(--text-secondary)]'
                                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
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
                    <div className="bg-[var(--color-card)] rounded-[10px] p-4 lg:col-span-2">
                      <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3">Model Usage Timeline — {metricLabel}</h4>
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
                    <div className="bg-[var(--color-card)] rounded-[10px] p-4">
                      <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3">Project Breakdown</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {projects.slice(0, 10).map((proj: any, idx: number) => (
                          <div key={proj.model} className="flex items-center justify-between p-2 bg-[rgba(255,255,255,0.04)] rounded-[10px]">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-[var(--text-secondary)] truncate" title={proj.path}>{proj.path}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{proj.sessions} sessions • {proj.messageCount} msgs</div>
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
                    <div className="bg-[var(--color-card)] rounded-[10px] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-[var(--text-muted)]">Model Breakdown</h4>
                        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--color-card-sunken)] light:bg-[var(--color-card)]/50 light:bg-[var(--color-card)]/50 px-2 py-0.5 rounded">{periodLabel}</span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {models.slice(0, 10).map((m: any, idx: number) => (
                          <div key={m.model} className="flex items-center justify-between p-2 bg-[rgba(255,255,255,0.04)] rounded-[10px]">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-[var(--text-secondary)] truncate" title={m.model}>{m.model}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{m.sessions} sessions • {m.messageCount} msgs</div>
                            </div>
                            <div className="text-xs text-blue-400 font-medium tabular-nums ml-2"><TokenValue value={m.tokens} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="text-xs text-[var(--text-muted)] mb-4">
                Last used: {selectedAgentDetail.lastUsed ? format(selectedAgentDetail.lastUsed, 'MMM dd, yyyy HH:mm') : 'Never'}
              </div>

              {/* Agent-specific help info */}
              <GlassCard className="p-4 bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)]/50">
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">How This Is Calculated</h4>
                <div className="space-y-1 text-xs text-[var(--text-muted)]">
                  <p><span className="text-[var(--text-secondary)]">Sessions:</span> Number of chat/conversation files. One JSONL file = one session.</p>
                  <p><span className="text-[var(--text-secondary)]">Messages:</span> Count of user + assistant exchanges in session files.</p>
                  <p><span className="text-[var(--text-secondary)]">Tokens:</span> Sum of input (human prompts) + output (AI responses) tokens parsed from session files.</p>
                  <p><span className="text-[var(--text-secondary)]">Input Tokens:</span> Tokens from user/human messages — what you wrote.</p>
                  <p><span className="text-[var(--text-secondary)]">Output Tokens:</span> Tokens from AI/assistant responses — what the AI wrote.</p>
                  <p><span className="text-[var(--text-secondary)]">In:Out Ratio:</span> Shows how many output tokens the AI generates per 1 input token you send. Higher = more verbose AI.</p>
                  <p><span className="text-[var(--text-secondary)]">Cost:</span> Calculated from tokens using provider pricing.</p>
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
            </div>
          </div>
        )}

      {/* Features Modal */}
      {showHelpModal && (
          <div
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <div
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[10px] p-5 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Features & Capabilities
                </h3>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-3 py-1 text-xs text-[var(--text-muted)] hover:text-white bg-[var(--color-card)] light:bg-[var(--color-card)] hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] rounded-[10px] transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6">
                <GlassCard className="p-4">
                  <h4 className="text-emerald-400 font-medium mb-3">IDE Detection</h4>
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <li>• IntelliJ IDEA (IntelliJ, Community)</li>
                    <li>• PyCharm (Professional, Community)</li>
                    <li>• WebStorm, GoLand, Rider, DataGrip</li>
                    <li>• VS Code, Cursor</li>
                    <li>• Android Studio</li>
                  </ul>
                </GlassCard>

                <GlassCard className="p-4">
                  <h4 className="text-violet-400 font-medium mb-3">AI Tool Integration</h4>
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <li>• Claude Code - parses .claude/projects/*.jsonl</li>
                    <li>• OpenCode - reads opencode.db</li>
                    <li>• Gemini CLI - parses tmp/*/chats</li>
                    <li>• Codex CLI, Qwen, Aider</li>
                    <li>Tracks: tokens, cost, sessions</li>
                  </ul>
                </GlassCard>

                <GlassCard className="p-4">
                  <h4 className="text-blue-400 font-medium mb-3">Project Tracking</h4>
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <li>• Add projects with path & default IDE</li>
                    <li>• Open in detected IDE</li>
                    <li>• Track primary language</li>
                    <li>• Git repository integration</li>
                  </ul>
                </GlassCard>

                <GlassCard className="p-4">
                  <h4 className="text-amber-400 font-medium mb-3">Tools Detection</h4>
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <li>• Git - version control</li>
                    <li>• Node.js, npm, yarn, pnpm</li>
                    <li>• Python, pip, uv</li>
                    <li>• Docker, Docker Compose</li>
                    <li>• And many more...</li>
                  </ul>
                </GlassCard>
              </div>
            </div>
          </div>
        )}

      {/* Add Project Modal - Accessible from any tab */}
      {showAddProject && (
          <div
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowAddProject(false); setAddProjectError(null); setSelectedQuickProjects(new Set()); }}
          >
            <div
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[10px] p-5 max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  Add New Project
                </h3>
                <button
                onClick={() => { setShowAddProject(false); setAddProjectError(null); setCustomDirResults({}); setSelectedQuickProjects(new Set()); }}
  className="p-1 text-[var(--text-muted)] hover:text-white transition"
>
  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 ws-scroll">
                {addProjectError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-[10px] text-red-400 text-sm">
                    {addProjectError}
                  </div>
                )}

                {loadingQuickAdd ? (
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning IDE default directories...
                  </div>
                ) : quickAddProjects.length > 0 && (
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider">Quick Add from IDE Directories</label>
                    <div className="flex flex-col gap-2">
                      {quickAddProjects.map(group => (
                        <div key={group.ide}>
                          <div className="text-xs text-[var(--text-muted)] mb-1 ml-1">{group.ide}</div>
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
                                className={`flex items-center gap-2 px-3 py-2 rounded-[10px] border transition text-sm ${
                                  isSel
                                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                    : 'bg-[var(--color-card)] light:bg-[var(--color-card)]/80 hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-[var(--text-secondary)] hover:text-white border-[var(--border-hairline)] light:border-[var(--border-hairline)] hover:border-indigo-500/50'
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
                  <div className="flex items-center justify-between px-3 py-2 bg-indigo-600/10 border border-indigo-500/30 rounded-[10px]">
                    <span className="text-sm text-indigo-300">
                      {selectedQuickProjects.size} project{selectedQuickProjects.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setSelectedQuickProjects(new Set())}
                      className="text-xs text-[var(--text-muted)] hover:text-white transition"
                    >
                      Clear selection
                    </button>
                  </div>
                )}

                {/* Saved Custom Directories */}
                {savedCustomDirs.length > 0 && (
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider">Saved Directories</label>
                    <div className="space-y-2">
                      {savedCustomDirs.map(dir => {
                        const dirResults = customDirResults[dir];
                        const isLoading = scanningDirs;
                        return (
                          <div key={dir} className="bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[6px] p-2">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs text-[var(--text-muted)] truncate flex-1 font-mono">{dir}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isLoading && !dirResults && (
                                  <Loader2 className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
                                )}
                                {dirResults && (
                                  <span className="text-[10px] text-[var(--text-muted)]">{dirResults.length} project{dirResults.length !== 1 ? 's' : ''}</span>
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
                                  className="p-0.5 text-[var(--text-muted)] hover:text-red-400 transition"
                                  title="Remove directory"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {isLoading && !dirResults ? (
                              <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
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
                                  className={`flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-[10px] border transition text-xs ${
                                    isSel
                                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                      : 'bg-[var(--color-card)] light:bg-[var(--color-card)] hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-[var(--text-secondary)] hover:text-white border-[var(--border-hairline)] light:border-[var(--border-hairline)] hover:border-indigo-500/50'
                                  }`}
                                >
                                  <span className="truncate max-w-[180px]">{p.name}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] flex flex-wrap gap-1">
                                    {p.languages.slice(0, 3).map(lang => (
                                      <span key={lang} className="px-1 py-0.5 bg-[var(--color-card)] rounded text-[var(--text-muted)] border-[var(--border-hairline)] light:border-[var(--border-hairline)]">{lang}</span>
                                    ))}
                                    {p.languages.length > 3 && <span className="text-[var(--text-muted)]">+{p.languages.length - 3}</span>}
                                  </span>
                                </button>
                              );
                            })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">No coding projects found</p>
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
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--color-card)] light:bg-[var(--color-card)] hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] text-[var(--text-muted)] hover:text-white rounded-[10px] border border-dashed border-[var(--border-hairline)] light:border-[var(--border-hairline)] hover:border-indigo-500/50 transition text-sm w-full justify-center"
                >
                  <FolderOpen className="w-4 h-4" />
                  Add Directory
                </button>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">Project Name *</label>
                    <VoiceInputWrapper>
                      <input
                        type="text"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        placeholder="My Project"
                        className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-indigo-500 focus:outline-none"
                      />
                    </VoiceInputWrapper>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">Project Path *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProject.path}
                        onChange={(e) => setNewProject({ ...newProject, path: e.target.value })}
                        placeholder="C:\Projects\my-project"
                        className="flex-1 px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                          const result = await window.deskflowAPI!.pickFolder();
                          if (result.success && result.path) {
                            setNewProject({ ...newProject, path: result.path });
                          }
                        }}
                        className="px-4 py-3 bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] hover:bg-[var(--color-card)] text-[var(--text-secondary)] rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] transition"
                        title="Browse for folder"
                      >
                        <FolderOpen className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">Repository URL (optional)</label>
                    <input
                      type="text"
                      value={newProject.repositoryUrl}
                      onChange={(e) => setNewProject({ ...newProject, repositoryUrl: e.target.value })}
                      placeholder="https://github.com/user/repo"
                      className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">Default IDE (optional)</label>
                    <select
                      value={newProject.defaultIde}
                      onChange={(e) => setNewProject({ ...newProject, defaultIde: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select an IDE...</option>
                      {overview?.ides?.map((ide: any) => (
                        <option key={ide.id} value={ide.id}>{ide.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-hairline)] light:border-[var(--border-hairline)]">
                <button
                  onClick={() => { setShowAddProject(false); setAddProjectError(null); setCustomDirResults({}); setSelectedQuickProjects(new Set()); }}
                  className="px-4 py-2 text-[var(--text-muted)] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProject}
                  disabled={!newProject.name || !newProject.path || addingProject}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[10px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingProject ? 'Adding...' : 'Add Project'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Edit Project Modal */}
      {showEditProject && editingProject && (
          <div
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowEditProject(false); setEditingProject(null); setAddProjectError(null); }}
          >
            <div
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[10px] p-5 max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-violet-400" />
                  Edit Project
                </h3>
                <button
                  onClick={() => { setShowEditProject(false); setEditingProject(null); setAddProjectError(null); }}
                  className="p-1 text-[var(--text-muted)] hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {addProjectError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-[10px] text-red-400 text-sm">
                  {addProjectError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={editProjectForm.name}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Project Path *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editProjectForm.path}
                      onChange={(e) => setEditProjectForm({ ...editProjectForm, path: e.target.value })}
                      className="flex-1 px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        const result = await window.deskflowAPI!.pickFolder();
                        if (result.success && result.path) {
                          setEditProjectForm({ ...editProjectForm, path: result.path });
                        }
                      }}
                      className="px-4 py-3 bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] hover:bg-[var(--color-card)] text-[var(--text-secondary)] rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] transition"
                      title="Browse for folder"
                    >
                      <FolderOpen className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Repository URL (optional)</label>
                  <input
                    type="text"
                    value={editProjectForm.repositoryUrl}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, repositoryUrl: e.target.value })}
                    placeholder="https://github.com/user/repo"
                    className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div ref={languageDropdownRef}>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Primary Language (optional)</label>
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
                        className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none pr-10"
                      />
                      <ChevronDown
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
                      />
                      {showLanguageDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-[var(--color-card)] light:bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[10px] max-h-48 overflow-y-auto">
                          {filteredLanguages.length > 0 ? (
                            filteredLanguages.map(lang => (
                              <button
                                key={lang}
                                onClick={() => handleLanguageSelect(lang)}
                                className={`w-full text-left px-4 py-2 text-white hover:bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] transition ${
                                  editProjectForm.primaryLanguage === lang ? 'bg-violet-500/20 text-violet-300' : ''
                                }`}
                              >
                                {lang}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-[var(--text-muted)] text-sm">
                              No match — using &ldquo;{editProjectForm.primaryLanguage}&rdquo;
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleDetectLanguage}
                      disabled={detectingLanguage || !editProjectForm.path}
                      className="px-3 py-3 bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] hover:bg-[var(--color-card)] text-[var(--text-secondary)] rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <label className="block text-sm text-[var(--text-muted)] mb-2">VCS Type (optional)</label>
                  <select
                    value={editProjectForm.vcsType}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, vcsType: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select VCS...</option>
                    <option value="git">Git</option>
                    <option value="svn">SVN</option>
                    <option value="mercurial">Mercurial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-2">Default IDE (optional)</label>
                  <select
                    value={editProjectForm.defaultIde}
                    onChange={(e) => setEditProjectForm({ ...editProjectForm, defaultIde: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select an IDE...</option>
                    {overview?.ides?.map((ide: any) => (
                      <option key={ide.id} value={ide.id}>{ide.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-hairline)] light:border-[var(--border-hairline)]">
                <button
                  onClick={() => { setShowEditProject(false); setEditingProject(null); setAddProjectError(null); }}
                  className="px-4 py-2 text-[var(--text-muted)] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProject}
                  disabled={!editProjectForm.name || !editProjectForm.path || updatingProject}
                  className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-[10px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingProject ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
          <div
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowDeleteConfirm(false); setDeletingProjectId(null); setDeletingProjectName(''); }}
          >
            <div
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-[10px] p-5 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-500/20 rounded-full">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Delete Project?</h3>
                  <p className="text-sm text-[var(--text-muted)]">This action can be undone later</p>
                </div>
              </div>

              <p className="text-[var(--text-secondary)] mb-6">
                Are you sure you want to delete <span className="text-white font-medium">"{deletingProjectName}"</span>? 
                The project will be moved to trash and can be restored at any time.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletingProjectId(null); setDeletingProjectName(''); }}
                  className="px-4 py-2 text-[var(--text-muted)] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-[10px] transition"
                >
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Run Project Configuration Modal */}
      {showRunConfig && runConfigProject && (
          <div
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRunConfig(false)}
          >
            <div
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--color-card)] border-[var(--border-hairline)] light:border-[var(--border-hairline)] rounded-2xl w-full max-w-lg p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Configure Run Commands</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">{runConfigProject.name}</p>
                </div>
                <button onClick={() => setShowRunConfig(false)} className="p-2 text-[var(--text-muted)] hover:text-white hover:bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-[10px] transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detectedScripts?.framework && (
                <div className="mb-4 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-[10px]">
                  <span className="text-xs text-indigo-400">Detected framework:</span>
                  <span className="text-sm text-white ml-2 font-medium">{detectedScripts.framework}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Single command mode */}
                <div>
                  <label className="block text-sm text-[var(--text-muted)] mb-1.5">Dev Command</label>
                  <input
                    type="text"
                    defaultValue={detectedScripts?.single?.command || runConfigData?.single?.command || ''}
                    id="run-cmd-single"
                    placeholder="e.g., npm run dev"
                    className="w-full px-3 py-2.5 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-emerald-500 focus:outline-none text-sm font-mono"
                  />
                  <div className="flex items-center gap-2 mt-1.5">
                    <label className="text-xs text-[var(--text-muted)]">Port (optional):</label>
                    <input
                      type="number"
                      defaultValue={detectedScripts?.single?.port || runConfigData?.single?.port || ''}
                      id="run-port-single"
                      placeholder="3000"
                      className="w-24 px-2 py-1.5 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-emerald-500 focus:outline-none text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-[var(--border-hairline)] light:border-[var(--border-hairline)] pt-4">
                  <p className="text-xs text-[var(--text-muted)] mb-3">Or use separate frontend/backend commands:</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Frontend Command</label>
                      <input
                        type="text"
                        defaultValue={detectedScripts?.frontend?.command || runConfigData?.frontend?.command || ''}
                        id="run-cmd-frontend"
                        placeholder="e.g., npm run dev"
                        className="w-full px-3 py-2 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-blue-500 focus:outline-none text-sm font-mono"
                      />
                      <input
                        type="number"
                        defaultValue={detectedScripts?.frontend?.port || runConfigData?.frontend?.port || ''}
                        id="run-port-frontend"
                        placeholder="Port (e.g., 5173)"
                        className="w-full mt-1.5 px-2 py-1.5 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-blue-500 focus:outline-none text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Backend Command</label>
                      <input
                        type="text"
                        defaultValue={detectedScripts?.backend?.command || runConfigData?.backend?.command || ''}
                        id="run-cmd-backend"
                        placeholder="e.g., python manage.py runserver"
                        className="w-full px-3 py-2 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded-[10px] border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-orange-500 focus:outline-none text-sm font-mono"
                      />
                      <input
                        type="number"
                        defaultValue={detectedScripts?.backend?.port || runConfigData?.backend?.port || ''}
                        id="run-port-backend"
                        placeholder="Port (e.g., 8000)"
                        className="w-full mt-1.5 px-2 py-1.5 bg-[var(--color-card)] light:bg-[var(--color-card)] text-white rounded border-[var(--border-hairline)] light:border-[var(--border-hairline)] focus:border-orange-500 focus:outline-none text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border-hairline)] light:border-[var(--border-hairline)]">
                <button
                  onClick={() => setShowRunConfig(false)}
                  className="px-4 py-2 text-[var(--text-muted)] hover:text-white transition text-sm"
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
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[10px] transition text-sm font-medium"
                >
                  Save & Run
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Terminal Workspace Modal — only in DOM when open to avoid blocking sidebar/nav */}
      {workspaceProject && isWorkspaceOpen && (
          <div
            key="workspace-overlay"
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[200] flex flex-col"
          >
            {/* Workspace Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-card)] border-b border-[var(--border-hairline)] light:border-[var(--border-hairline)]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-close-workspace-dialog'))}
                  className="p-1.5 text-[var(--text-muted)] hover:text-white hover:bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-[10px] transition-colors"
                  title="Close workspace"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsWorkspaceOpen(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-white hover:bg-[var(--color-card)] light:bg-[var(--color-card)] rounded-[10px] transition-colors"
                  title="Minimize workspace"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-[var(--color-card-sunken)] light:bg-[var(--color-card)] mx-1" />
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">{workspaceProject.name}</span>
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
                  className="px-2.5 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-[10px] flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Initialize workspace infrastructure"
                >
                  <FolderTree className="w-3.5 h-3.5" />
                  Initialize
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-new-agent'))}
                  disabled={!selectedProject}
                  className="px-2 py-1.5 bg-[var(--color-card-sunken)] light:bg-[var(--color-card)]/60 hover:bg-[var(--color-card)]/60 border-[var(--border-hairline)] light:border-[var(--border-hairline)]/50 text-[var(--text-secondary)] text-xs rounded-[6px] flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Start a new AI agent session"
                >
                  <Bot className="w-3.5 h-3.5" />
                  New Agent
                </button>
                <div className="w-px h-5 bg-[var(--color-card-sunken)] light:bg-[var(--color-card)]" />
                <button
                  onClick={() => setShowSpecs(!showSpecs)}
                  className={`px-2 py-1.5 text-xs rounded-[6px] flex items-center gap-1.5 transition-colors duration-150 ${showSpecs ? 'bg-cyan-700/50 text-cyan-200 border border-cyan-600/50' : 'bg-[var(--color-card-sunken)] light:bg-[var(--color-card)]/60 hover:bg-[var(--color-card)]/60 border-[var(--border-hairline)] light:border-[var(--border-hairline)]/50 text-[var(--text-secondary)]'}`}
                  title="View feature specifications"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Specs
                </button>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 flex overflow-hidden">
              <div className={`flex-1 min-w-0 ${showSpecs ? 'border-r border-[var(--border-hairline)] light:border-[var(--border-hairline)]' : ''}`}>
                <TerminalPage projectId={workspaceProject.id} projectPath={workspaceProject.path} onCloseWorkspace={handleCloseWorkspace} />
              </div>
              {showSpecs && (
                <div className="w-[45%] overflow-hidden border-l border-[var(--border-hairline)] light:border-[var(--border-hairline)]">
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

          </div>
        )}
      </div>
    </PageShell>
  );
}
