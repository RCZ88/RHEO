import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Users,
  Clock,
  Activity,
  TrendingUp,
  ExternalLink,
  HelpCircle,
  BookOpen,
  FolderOpen,
  Settings,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  TrendingDown,
  DollarSign,
  Download,
  BarChart3,
  Pencil,
  RotateCcw,
  AlertTriangle,
  Search,
  Minus,
  FolderTree,
  Bot,
  Settings2,
  LayoutDashboard,
  FolderGit2,
  Archive,
} from 'lucide-react';
import InitializeProgressModal from '../components/InitializeProgressModal';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { format, subDays, eachDayOfInterval, formatDistanceToNow } from 'date-fns';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';

ChartJS.register(CategoryScale, LinearScale, PointElement, BarElement, LineElement, ArcElement, Tooltip, Legend, Filler);

interface Overview {
  ides: any[];
  tools: any[];
  projects: any[];
  aiUsage: { totalTokens: number; totalCost: number; totalMessages?: number; byTool: Record<string, any> };
  commits: { totalCommits: number; totalAdditions: number; totalDeletions: number };
}

interface AIAgent {
  id: string;
  name: string;
  icon: string;
  color: string;
  tokens: number;
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
  'aider': { name: 'Aider', icon: 'aider', color: '#f59e0b' },
  'copilot': { name: 'GitHub Copilot', icon: 'copilot', color: '#6366f1' },
};

type TabKey = 'overview' | 'projects' | 'ai' | 'git' | 'environment' | 'analytics' | 'backup';

const TAB_KEYS: TabKey[] = ['overview', 'projects', 'ai', 'git', 'environment', 'analytics', 'backup'];

const TAB_HOVER = { scale: 1.02 };
const TAB_TAP = { scale: 0.98 };
const TAB_LAYOUT_SPRING = { type: 'spring' as const, stiffness: 380, damping: 30 };

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

export default function IDEProjectsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [syncingAI, setSyncingAI] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [aiSyncResult, setAiSyncResult] = useState<{ success: boolean; agents: Record<string, number> } | null>(null);
  const [aiLastSyncAt, setAiLastSyncAt] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', path: '', repositoryUrl: '', defaultIde: '' });
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('ide-projects-activeTab') || '';
    const resolved = (TAB_MIGRATION[saved] ?? saved) as TabKey;
    return TAB_KEYS.includes(resolved) ? resolved : 'overview';
  });
  const commitHistoryRef = useRef<any[]>([]);
  const [commitHistory, setCommitHistory] = useState<any[]>([]);
  const [workspaceAnalytics, setWorkspaceAnalytics] = useState<{ aiUsage: any; sessions: any[]; problems: any[]; requests: any[]; promptHistory: any[] } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [contributorStats, setContributorStats] = useState<any>(null);
  const [doraMetrics, setDoraMetrics] = useState<any>(null);
  const [syncingGit, setSyncingGit] = useState(false);
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [gitDiff, setGitDiff] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [generatedCommitMsg, setGeneratedCommitMsg] = useState<string | null>(null);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showAgentDebug, setShowAgentDebug] = useState(false);
  const [aiChartMode, setAiChartMode] = useState<'tokens' | 'messages' | 'cost' | 'sessions'>('tokens');
  const [aiPeriod, setAiPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AIAgent | null>(null);
  const [agentDetailPeriod, setAgentDetailPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [agentDetailMetric, setAgentDetailMetric] = useState<'tokens' | 'messages' | 'sessions' | 'cost'>('tokens');
  const [agentDebugInfo, setAgentDebugInfo] = useState<any>(null);
  const [compareAgents, setCompareAgents] = useState<string[]>([]);
  const [compareMetric, setCompareMetric] = useState<'tokens' | 'messages' | 'cost' | 'sessions'>('tokens');
  const [comparePeriod, setComparePeriod] = useState<'week' | 'month' | 'all'>('week');

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [quickAddProjects, setQuickAddProjects] = useState<{ ide: string; projects: { name: string; path: string }[] }[]>([]);
  const [loadingQuickAdd, setLoadingQuickAdd] = useState(false);
  const [savedCustomDirs, setSavedCustomDirs] = useState<string[]>(() => {
    try {
      const multi = localStorage.getItem('customScanDirs');
      if (multi) return JSON.parse(multi);
      const old = localStorage.getItem('customScanPath');
      if (old) {
        localStorage.setItem('customScanDirs', JSON.stringify([old]));
        localStorage.removeItem('customScanPath');
        return [old];
      }
      return [];
    } catch { return []; }
  });
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

  useEffect(() => {
    localStorage.setItem('ide-projects-onboarding-seen', 'true');
    loadOverview();
    window.deskflowAPI!.getAISyncStatus().then(status => {
      if (status?.lastRunAt) setAiLastSyncAt(status.lastRunAt);
    }).catch(() => {});
  }, []);

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

  // Fetch workspace analytics when analytics tab is active
  useEffect(() => {
    if (activeTab !== 'analytics' || !window.deskflowAPI) return;
    setAnalyticsLoading(true);
    Promise.all([
      window.deskflowAPI.getAIUsageSummary('month'),
      window.deskflowAPI.getProblems(),
      window.deskflowAPI.getRequests(),
      window.deskflowAPI.getTerminalSessions?.(undefined, 500),
      window.deskflowAPI.getPromptHistory?.({ limit: 2000 }),
    ]).then(([aiUsage, problems, requests, sessions, promptHistory]) => {
      setWorkspaceAnalytics({
        aiUsage: aiUsage || null,
        problems: problems?.data || problems || [],
        requests: requests?.data || requests || [],
        sessions: sessions?.data || sessions || [],
        promptHistory: promptHistory || [],
      });
    }).catch((err) => {
      console.error('[IDEProjectsPage] Failed to fetch workspace analytics:', err);
    }).finally(() => {
      setAnalyticsLoading(false);
    });
  }, [activeTab]);

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

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await window.deskflowAPI!.getIDEProjectsOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load IDE projects overview:', err);
    }
    setLoading(false);
  };

  const handleSyncAI = async () => {
    setSyncingAI(true);
    setSyncProgress('Starting AI sync...');
    setAiSyncResult(null);
    let cleanup: (() => void) | undefined;
    try {
      cleanup = window.deskflowAPI!.onAISyncProgress((data: any) => {
        if (data.status === 'detecting') {
          setSyncProgress(`Detecting ${data.name}...`);
        } else if (data.status === 'parsing') {
          setSyncProgress(`Parsing ${data.name} data...`);
        } else if (data.status === 'saving') {
          setSyncProgress(`Saving ${data.count} sessions from ${data.name}...`);
        }
      });
      const result = await window.deskflowAPI!.syncAIUsage() as any;
      if (result.success) {
        const agents: Record<string, number> = {};
        for (const [key, value] of Object.entries(result)) {
          if (key !== 'success' && typeof value === 'number') {
            agents[key] = value;
          }
        }
        setAiSyncResult({ success: true, agents });
        setSyncProgress('Refreshing data...');
        await loadOverview();
        const status = await window.deskflowAPI!.getAISyncStatus();
        if (status?.lastRunAt) setAiLastSyncAt(status.lastRunAt);
      }
    } catch (err) {
      console.error('AI sync failed:', err);
    } finally {
      if (cleanup) cleanup();
      setSyncingAI(false);
      setSyncProgress(null);
    }
  };

  const handleDebugAgents = async () => {
    setShowAgentDebug(true);
    try {
      const info = await window.deskflowAPI!.debugAIAgents() as any;
      setAgentDebugInfo(info);
    } catch (err) {
      console.error('Debug failed:', err);
    }
  };

  const handleAddProject = async () => {
    if (!newProject.name || !newProject.path) {
      setAddProjectError('Project name and path are required');
      return;
    }
    setAddProjectError(null);
    setAddingProject(true);

    try {
      const result = await window.deskflowAPI!.addProject(newProject);
      if (result.success) {
        setShowAddProject(false);
        setNewProject({ name: '', path: '', repositoryUrl: '', defaultIde: '' });
        setAddProjectError(null);
        await loadOverview();
      } else {
        setAddProjectError(result.message || 'Failed to add project');
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
    if (tokens >= 1000000000) return `${(tokens / 1000000000).toFixed(1)}B`;
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatCurrency = (amount: number): string => {
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

  const aiAgents = useMemo((): AIAgent[] => {
    const agents: AIAgent[] = [];
    const byTool = overview?.aiUsage?.byTool || {};

    for (const [agentId, data] of Object.entries(byTool)) {
      const config = AGENT_CONFIG[agentId] || { name: agentId, icon: agentId, color: '#6366f1' };
      agents.push({
        id: agentId,
        name: config.name,
        icon: config.icon,
        color: config.color,
        tokens: (data as any).tokens || 0,
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
          color: config.color,
          tokens: 0,
          cost: 0,
          sessions: 0,
          messageCount: 0,
          status: 'inactive',
          models: [],
        });
      }
    }

    return agents;
  }, [overview?.aiUsage?.byTool]);

  useEffect(() => {
    const activeIds = aiAgents.filter(a => a.tokens > 0).map(a => a.id);
    if (compareAgents.length === 0 && activeIds.length > 0) {
      setCompareAgents(activeIds);
    }
  }, [aiAgents]);

  const agentChartsData = useMemo(() => {
    const daysMap: Record<string, number> = { 'week': 7, 'month': 30, 'all': 90 };
    const numDays = daysMap[aiPeriod] || 7;

    const lastDays = eachDayOfInterval({
      start: subDays(new Date(), numDays - 1),
      end: new Date()
    });

    const activeAgents = aiAgents.filter(a => a.status !== 'inactive' && a.tokens > 0);

    const getMetricValue = (agent: AIAgent, dayStr: string) => {
      const dayData = overview?.aiUsage?.byTool?.[agent.id]?.daily?.[dayStr];
      if (!dayData) return 0;
      if (aiChartMode === 'tokens') return dayData.tokens || 0;
      if (aiChartMode === 'messages') return dayData.messageCount || 0;
      if (aiChartMode === 'sessions') return dayData.sessions || 0;
      if (aiChartMode === 'cost') return dayData.cost || 0;
      return 0;
    };

    const metricLabel = aiChartMode === 'tokens' ? 'Tokens' : aiChartMode === 'messages' ? 'Messages' : aiChartMode === 'sessions' ? 'Sessions' : 'Cost';

    return activeAgents.map(agent => {
      const labels = lastDays.map(d => format(d, 'MMM dd'));
      const data = lastDays.map(d => getMetricValue(agent, format(d, 'yyyy-MM-dd')));
      return {
        agentId: agent.id,
        agentName: agent.name,
        color: agent.color,
        metricLabel,
        chartData: {
          labels,
          datasets: [{
            label: `${agent.name} - ${metricLabel}`,
            data,
            backgroundColor: agent.color + '40',
            borderColor: agent.color,
            borderWidth: 2,
            borderRadius: 4,
          }]
        }
      };
    });
  }, [aiAgents, overview?.aiUsage?.byTool, aiPeriod, aiChartMode]);

  const agentDistributionData = useMemo(() => {
    const activeAgents = aiAgents.filter(a => a.status !== 'inactive');
    const agentColorsMap: Record<string, string> = {
      'claude': '#a855f7',
      'opencode': '#22c55e', 
      'cursor': '#3b82f6',
      'windsurf': '#f59e0b',
    };
    const getAgentDisplayName = (id: string) => {
      const names: Record<string, string> = {
        'claude': 'Claude',
        'opencode': 'OpenCode',
        'cursor': 'Cursor',
        'windsurf': 'Windsurf',
      };
      return names[id.toLowerCase()] || id;
    };
    const getValue = (agent: AIAgent) => {
      if (aiChartMode === 'tokens') return agent.tokens;
      if (aiChartMode === 'cost') return agent.cost;
      if (aiChartMode === 'messages') return agent.messageCount;
      return agent.sessions;
    };
    const getLabel = (agent: AIAgent) => {
      const displayName = getAgentDisplayName(agent.id);
      if (aiChartMode === 'tokens') return `${displayName}: ${formatTokens(agent.tokens)}`;
      if (aiChartMode === 'cost') return `${displayName}: ${formatCurrency(agent.cost)}`;
      if (aiChartMode === 'messages') return `${displayName}: ${agent.messageCount} msgs`;
      return `${displayName}: ${agent.sessions} sessions`;
    };
    activeAgents.sort((a, b) => getValue(b) - getValue(a));
    return {
      labels: activeAgents.map(a => getLabel(a)),
      datasets: [{
        data: activeAgents.map(a => getValue(a)),
        backgroundColor: activeAgents.map(a => agentColorsMap[a.id.toLowerCase()] || a.color || '#888888'),
        borderColor: '#0a0a0a',
        borderWidth: 2,
      }]
    };
  }, [aiAgents, aiChartMode]);

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
    <PageShell page="ide-projects" className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            IDE Projects
          </h1>
          <p className="text-zinc-500 mt-1">Track your development environment, AI tools, and project metrics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowSetupModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors duration-150"
            title="Setup guide"
          >
            <HelpCircle className="w-4 h-4" />
            Guide
          </button>
        </div>
      </div>

      {/* AI Sync Result */}
      <AnimatePresence>
        {aiSyncResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-white font-medium">AI Usage Synced</div>
              <div className="text-xs text-zinc-400">
                {Object.entries(aiSyncResult.agents).map(([agent, count]) => (
                  `${agent}: ${count} records`
                )).join(' • ')}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <motion.button
              key={key}
              onClick={() => setActiveTab(key)}
              whileHover={TAB_HOVER}
              whileTap={TAB_TAP}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${
                isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="ide-tab-active"
                  className="absolute inset-0 bg-zinc-800 rounded-xl"
                  transition={TAB_LAYOUT_SPRING}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metric Cards (clickable → navigate to tab) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Environment', value: (overview?.ides?.length || 0) + (overview?.tools?.length || 0), subValue: `${overview?.ides?.length || 0} IDEs · ${overview?.tools?.length || 0} tools`, icon: Boxes, color: '#3b82f6', bg: 'bg-blue-500/10', tab: 'environment' as TabKey },
              { label: 'AI Usage', value: formatTokens(overview?.aiUsage?.totalTokens || 0), subValue: formatCurrency(overview?.aiUsage?.totalCost || 0), icon: Sparkles, color: '#a855f7', bg: 'bg-violet-500/10', tab: 'ai' as TabKey },
              { label: 'Commits', value: overview?.commits?.totalCommits || 0, subValue: `+${overview?.commits?.totalAdditions || 0} / -${overview?.commits?.totalDeletions || 0}`, icon: GitCommit, color: '#f59e0b', bg: 'bg-amber-500/10', tab: 'git' as TabKey },
              { label: 'Last Backup', value: '—', subValue: 'Not configured', icon: Archive, color: '#10b981', bg: 'bg-emerald-500/10', tab: 'backup' as TabKey },
            ].map((stat, idx) => (
              <motion.button
                key={idx}
                onClick={() => setActiveTab(stat.tab)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5 text-left hover:bg-zinc-900/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <div className="text-xs text-zinc-500 font-medium">LIVE</div>
                </div>
                <div className="text-3xl font-semibold tabular-nums tracking-tight" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
                {stat.subValue && <div className="text-xs text-zinc-500 mt-1">{stat.subValue}</div>}
              </motion.button>
            ))}
          </div>

          {/* AI & Projects Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* AI Usage Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  <div>
                    <div className="text-xl font-semibold">AI Tool Usage</div>
                    <div className="text-sm text-zinc-500">Last 30 days</div>
                  </div>
                </div>
              </div>

              {aiAgents.filter(a => a.tokens > 0).length > 0 ? (
                <>
                  <div className="h-48 mb-6">
                    {(() => {
                      const activeAgents = aiAgents.filter(a => a.tokens > 0);
                      const overviewDays = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
                      const overviewChartData = {
                        labels: overviewDays.map(d => format(d, 'MMM dd')),
                        datasets: activeAgents.map((agent, idx) => ({
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
                                  label: (ctx: any) => ` ${ctx.dataset.label || 'AI'}: ${formatTokens(ctx.parsed.y ?? 0)} tokens`
                                }
                              }
                            },
                            scales: {
                              x: { stacked: true, grid: { display: false }, ticks: { color: '#71717a', maxTicksLimit: 7 } },
                              y: {
                                stacked: true,
                                grid: { color: '#27272a' },
                                ticks: { color: '#71717a', callback: (v: any) => formatTokens(v) },
                                beginAtZero: true,
                              }
                            },
                          }}
                        />
                      );
                    })()}
                  </div>

                  <div className="space-y-3">
                    {aiAgents.filter(a => a.tokens > 0).map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: agent.color + '22' }}>
                            <Code2 className="w-4 h-4" style={{ color: agent.color }} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{agent.name}</div>
                            <div className="text-xs text-zinc-500">{agent.sessions} sessions &middot; {agent.messageCount} msgs</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-violet-400">{formatTokens(agent.tokens)}</div>
                          <div className="text-xs text-zinc-500">{formatCurrency(agent.cost)}</div>
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
              className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5"
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
                      className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl hover:bg-zinc-900/70 transition-colors"
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
                        {project.primary_language && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-md">
                            {project.primary_language}
                          </span>
                        )}
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <button
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
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Environment'}
            </button>
            <button
              onClick={async () => {
                const result = await window.deskflowAPI!.resetTools();
                if (result.success) await loadOverview();
              }}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg text-sm transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset Tools
            </button>
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
                  <div key={ide.id} className="glass rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{ide.name}</div>
                        {ide.version && <div className="text-xs text-zinc-500">v{ide.version}</div>}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg">Active</span>
                  </div>
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
                {Object.entries(groupToolsByCategory()).map(([category, tools], idx) => {
                  const Icon = CATEGORY_ICONS[category] || Package;
                  const label = CATEGORY_LABELS[category] || category;
                  const isExpanded = expandedCategories.has(category);
                  return (
                    <div key={category} className="glass rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-4 hover:bg-zinc-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-zinc-400" />
                          <span className="text-white font-medium">{label}</span>
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-lg">{(tools as any[]).length}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {(tools as any[]).map((tool: any) => (
                            <div key={tool.id} className="flex items-center justify-between p-2.5 bg-zinc-900/30 rounded-xl">
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl transition-colors duration-150"
          >
<Plus className="w-4 h-4" />
            Add Project
          </motion.button>

          {overview?.projects && overview.projects.length > 0 ? (
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
                  className="glass rounded-xl overflow-hidden"
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditProjectClick(project)}
                          className="p-2 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleProjectExpand(project)}
                          className={`p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(project)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions Row */}
                    <div className="flex items-center gap-3 mt-4">
                      {project.default_ide && (
                        <button
                          onClick={() => handleOpenProject(project.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 rounded-xl transition-colors duration-150"
                        >
                          <Monitor className="w-4 h-4" />
                          <span className="text-sm font-medium">Open in IDE</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedProject(project.id);
                          setWorkspaceProject(project);
                          setIsWorkspaceOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl transition-colors duration-150"
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
                      {project.primary_language && (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg">
                          {project.primary_language}
                        </span>
                      )}
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
                        <span className="px-2 py-1 bg-zinc-700/50 text-zinc-400 text-xs rounded-lg">
                          {details.tools.length} tools
                        </span>
                      )}
                      {details?.sessions?.length > 0 && (
                        <span className="px-2 py-1 bg-zinc-700/50 text-zinc-400 text-xs rounded-lg">
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

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-zinc-800 bg-zinc-900/30"
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
                                <div className="p-3 bg-zinc-800/50 rounded-xl">
                                  <div className="text-xs text-zinc-500 mb-1">Health Score</div>
                                  <div className="text-xl font-bold text-white">{details.health?.healthScore || 0}<span className="text-sm text-zinc-500">/100</span></div>
                                  <div className="text-xs text-zinc-500 mt-1">{details.health?.activityLevel || 'unknown'}</div>
                                </div>
                                <div className="p-3 bg-zinc-800/50 rounded-xl">
                                  <div className="text-xs text-zinc-500 mb-1">Terminal Sessions</div>
                                  <div className="text-xl font-bold text-white">{details.sessions?.length || 0}</div>
                                  <div className="text-xs text-zinc-500 mt-1">total</div>
                                </div>
                                <div className="p-3 bg-zinc-800/50 rounded-xl">
                                  <div className="text-xs text-zinc-500 mb-1">Version Control</div>
                                  <div className="text-sm font-medium text-white truncate">{project.vcs_type || 'None detected'}</div>
                                  <div className="text-xs text-zinc-500 mt-1">{project.repository_url ? 'Connected' : 'No remote'}</div>
                                </div>
                                <div className="p-3 bg-zinc-800/50 rounded-xl">
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
                                      <div key={session.id} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                          <span className="text-sm text-zinc-300 truncate">{session.topic || session.agent || 'Untitled'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className="text-xs text-zinc-500">{formatDistanceToNow(new Date(session.started_at))}</span>
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
                                        className="px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
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
                                      <span key={tool.id} className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-lg">
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
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-xl"
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
        <div className="space-y-6">
          {/* Summary Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <div>
                <span className="text-white font-medium">AI Agents</span>
                <span className="text-zinc-500 ml-2">{aiAgents.filter(a => a.status !== 'inactive').length} active</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div>
                <span className="text-zinc-500">Tokens: </span>
                <span className="text-violet-400 font-medium">{formatTokens(overview?.aiUsage?.totalTokens || 0)}</span>
              </div>
              <div className="text-zinc-700">|</div>
              <div>
                <span className="text-zinc-500">Messages: </span>
                <span className="text-blue-400 font-medium">{(overview?.aiUsage?.totalMessages || 0).toLocaleString()}</span>
              </div>
              <div className="text-zinc-700">|</div>
              <div>
                <span className="text-zinc-500">Cost: </span>
                <span className="text-emerald-400 font-medium">{formatCurrency(overview?.aiUsage?.totalCost || 0)}</span>
              </div>
              <div className="w-px h-6 bg-zinc-700" />
              <button
                onClick={handleSyncAI}
                disabled={syncingAI}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs disabled:opacity-50 transition-colors"
                title="Import AI usage data"
              >
                <Sparkles className={`w-3.5 h-3.5 ${syncingAI ? 'animate-spin' : ''}`} />
                {syncingAI ? 'Syncing...' : 'Sync AI'}
              </button>
              {aiLastSyncAt && !syncingAI && (
                <span className="text-[11px] text-zinc-500">
                  Last: {(() => {
                    const diff = Date.now() - new Date(aiLastSyncAt).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 1) return 'just now';
                    if (mins < 60) return `${mins}m ago`;
                    const hours = Math.floor(mins / 60);
                    if (hours < 24) return `${hours}h ago`;
                    return formatDistanceToNow(new Date(aiLastSyncAt), { addSuffix: true });
                  })()}
                </span>
              )}
              <div className="w-px h-6 bg-zinc-700" />
              <button
                onClick={handleDebugAgents}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                {showAgentDebug ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
          </motion.div>

          {/* Debug Panel */}
          <AnimatePresence>
            {showAgentDebug && agentDebugInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass rounded-xl p-5 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Agent Detection Details</h3>
                  <button
                    onClick={() => setShowAgentDebug(false)}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    Hide Details
                  </button>
                </div>

                {/* Database State */}
                {agentDebugInfo.database && (
                  <div className="mb-4 p-4 bg-zinc-900/50 rounded-xl">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">Database State</h4>
                    {agentDebugInfo.database.error ? (
                      <p className="text-red-400 text-sm">{agentDebugInfo.database.error}</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-zinc-500">Total Records:</span>
                          <span className="text-white ml-2">{agentDebugInfo.database.totalRecords}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Total Tokens:</span>
                          <span className="text-violet-400 ml-2">{formatTokens(agentDebugInfo.database.totalTokens || 0)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">By Tool:</span>
                          <span className="text-white ml-2">
                            {agentDebugInfo.database.byTool?.map((t: any) => `${t.tool}: ${t.count}`).join(', ') || 'None'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Agent Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(agentDebugInfo.agents || {}).map(([agentId, info]: [string, any]) => (
                    <div key={agentId} className="bg-zinc-900/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${info.detected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="text-white font-medium">{agentId}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${info.detected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {info.detected ? 'Detected' : 'Not Found'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-zinc-500">Paths:</span>
                          <div className="text-xs text-zinc-400 font-mono mt-1">
                            {info.paths.map((p: string, i: number) => (
                              <div key={i} className="truncate" title={p}>{p}</div>
                            ))}
                          </div>
                        </div>
                        {info.sampleFiles && info.sampleFiles.length > 0 && (
                          <div>
                            <span className="text-xs text-zinc-500">Files Found:</span>
                            {info.totalFiles > 0 && <span className="text-xs text-violet-400 ml-2">({info.totalFiles} total)</span>}
                            <div className="text-xs text-zinc-400 font-mono mt-1 max-h-24 overflow-y-auto">
                              {info.sampleFiles.slice(0, 5).map((f: string, i: number) => (
                                <div key={i} className="truncate">{f}</div>
                              ))}
                              {info.sampleFiles.length > 5 && <div className="text-zinc-600">...and {info.sampleFiles.length - 5} more</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sync Result */}
          <AnimatePresence>
            {aiSyncResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">Sync Complete</div>
                    <div className="text-xs text-zinc-400">
                      {Object.keys(aiSyncResult.agents).length > 0 ? (
                        Object.entries(aiSyncResult.agents).map(([agent, count]) => (
                          <span key={agent} className="mr-3">{agent}: <span className="text-violet-400">{count as number} records</span></span>
                        ))
                      ) : (
                        <span>No new records found. Click "Show Details" to debug.</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiAgents.map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  setSelectedAgent(selectedAgent === agent.id ? null : agent.id);
                  if (agent.status !== 'inactive') setSelectedAgentDetail(agent);
                }}
                className={`glass rounded-xl p-5 cursor-pointer transition-colors duration-150 hover:border-violet-500/50 ${
                  selectedAgent === agent.id ? 'border-violet-500' : 'border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: agent.color + '22' }}
                    >
                      <Code2 className="w-5 h-5" style={{ color: agent.color }} />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{agent.name}</h3>
                      <p className="text-xs text-zinc-500">{agent.models[0] || 'No model detected'}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    agent.status === 'active' ? 'bg-emerald-400' :
                    agent.status === 'idle' ? 'bg-amber-400' :
                    agent.status === 'error' ? 'bg-red-400' : 'bg-zinc-600'
                  }`} />
                </div>

                {agent.status !== 'inactive' ? (
                  <>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-white tabular-nums">{formatTokens(agent.tokens)}</div>
                        <div className="text-xs text-zinc-500">Tokens</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-400 tabular-nums">{agent.messageCount.toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">Messages</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-emerald-400 tabular-nums">{formatCurrency(agent.cost)}</div>
                        <div className="text-xs text-zinc-500">Cost</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-amber-400 tabular-nums">{agent.messageCount > 0 ? formatTokens(Math.round(agent.tokens / agent.messageCount)) : '—'}</div>
                        <div className="text-xs text-zinc-500">Avg/Msg</div>
                      </div>
                    </div>

                    {/* Sparkline - 7 day trend */}
                    {(() => {
                      const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
                      const data = days.map(d => {
                        const dayStr = format(d, 'yyyy-MM-dd');
                        return overview?.aiUsage?.byTool?.[agent.id]?.daily?.[dayStr]?.tokens || 0;
                      });
                      const hasData = data.some(v => v > 0);
                      if (!hasData) return null;
                      return (
                        <div className="h-10 mb-3">
                          <Line
                            data={{
                              labels: days.map(d => format(d, 'EEE')),
                              datasets: [{
                                data,
                                borderColor: agent.color,
                                backgroundColor: agent.color + '18',
                                borderWidth: 1.5,
                                pointRadius: 0,
                                fill: true,
                                tension: 0.3,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: { legend: { display: false }, tooltip: { enabled: false } },
                              scales: { x: { display: false }, y: { display: false } },
                              layout: { padding: 0 },
                            }}
                          />
                        </div>
                      );
                    })()}

                    {agent.lastUsed && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        Last used: {format(agent.lastUsed, 'MMM dd, HH:mm')}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-3">
                    <span className="text-sm text-zinc-500">Not detected</span>
                    {agentDebugInfo?.agents?.[agent.id]?.paths ? (
                      <p className="text-xs text-zinc-600 mt-1 truncate mx-2" title={agentDebugInfo.agents[agent.id].paths[0]}>
                        Looking in: {agentDebugInfo.agents[agent.id].paths[0]}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600 mt-1">Install {agent.name} to start tracking</p>
                    )}
                    <p className="text-xs text-violet-500 mt-2">Click "Show Details" to debug</p>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Coming Soon Card for GitHub Copilot */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: aiAgents.length * 0.05 }}
              className="glass rounded-xl p-5 border border-zinc-800"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">GitHub Copilot</h3>
                    <p className="text-xs text-zinc-500">CLI Integration</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg font-medium">Coming Soon</span>
              </div>
              <p className="text-sm text-zinc-500">
                Connect your GitHub organization to track Copilot usage including code completions and chat interactions.
              </p>
            </motion.div>
          </div>

          {/* AI Leaderboard & Actions */}
          {aiAgents.filter(a => a.tokens > 0).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {/* Most Active */}
              {(() => {
                const sorted = [...aiAgents].filter(a => a.tokens > 0).sort((a, b) => b.tokens - a.tokens);
                const top = sorted[0];
                if (!top) return null;
                return (
                  <GlassCard className="p-4">
                    <div className="text-xs text-zinc-500 mb-1">Most Active</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: top.color }} />
                      <span className="text-white font-medium">{top.name}</span>
                    </div>
                    <div className="text-sm text-violet-400 mt-1">{formatTokens(top.tokens)} tokens</div>
                  </GlassCard>
                );
              })()}
              {/* Most Efficient */}
              {(() => {
                const sorted = [...aiAgents].filter(a => a.tokens > 0 && a.messageCount > 0).sort((a, b) => (a.tokens / a.messageCount) - (b.tokens / b.messageCount));
                const top = sorted[0];
                if (!top) return null;
                return (
                  <GlassCard className="p-4">
                    <div className="text-xs text-zinc-500 mb-1">Most Efficient</div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: top.color }} />
                      <span className="text-white font-medium">{top.name}</span>
                    </div>
                    <div className="text-sm text-emerald-400 mt-1">{formatTokens(Math.round(top.tokens / top.messageCount))} tokens/msg</div>
                  </GlassCard>
                );
              })()}
              {/* Export Button */}
              <GlassCard className="p-4 flex flex-col justify-center">
                <button
                  onClick={() => {
                    const rows: string[] = ['Agent,Tokens,Messages,Sessions,Cost,Tokens/Msg,Cost/Session'];
                    aiAgents.filter(a => a.tokens > 0).forEach(a => {
                      rows.push(`${a.name},${a.tokens},${a.messageCount},${a.sessions},${a.cost.toFixed(4)},${a.messageCount > 0 ? Math.round(a.tokens / a.messageCount) : 0},${a.sessions > 0 ? (a.cost / a.sessions).toFixed(4) : 0}`);
                    });
                    const csv = rows.join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `ai-usage-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </GlassCard>
            </motion.div>
          )}

          {/* AI Charts Section */}
          {aiAgents.filter(a => a.tokens > 0).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Trend Header with Period + Metric selectors */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                  <div>
                    <div className="text-lg font-semibold">Usage Trend</div>
                    <div className="text-sm text-zinc-500">Per agent, daily breakdown</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Metric Selector */}
                  <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
                    {(['tokens', 'messages', 'sessions', 'cost'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setAiChartMode(mode)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                          aiChartMode === mode
                            ? 'bg-violet-500/20 text-violet-400'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Period Selector */}
                  <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
                    {(['week', 'month', 'all'] as const).map(period => (
                      <button
                        key={period}
                        onClick={() => setAiPeriod(period)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                          aiPeriod === period
                            ? 'bg-violet-500/20 text-violet-400'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {period === 'week' ? '7 Days' : period === 'month' ? '30 Days' : 'All Time'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-Agent Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {agentChartsData.map((agentChart) => (
                  <GlassCard key={agentChart.agentId}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: agentChart.color }} />
                      <span className="text-sm font-medium text-white">{agentChart.agentName}</span>
                      <span className="text-xs text-zinc-500 ml-auto">{agentChart.metricLabel}</span>
                    </div>
                    <div className="h-40">
                      <Bar
                        data={agentChart.chartData}
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
                                  if (aiChartMode === 'tokens') return ` ${formatTokens(val)} tokens`;
                                  if (aiChartMode === 'cost') return ` ${formatCurrency(val)}`;
                                  if (aiChartMode === 'messages') return ` ${val} messages`;
                                  return ` ${val} sessions`;
                                }
                              }
                            }
                          },
                          scales: {
                            x: { grid: { display: false }, ticks: { color: '#71717a', maxTicksLimit: 5, font: { size: 10 } } },
                            y: {
                              grid: { color: '#27272a' },
                              ticks: {
                                color: '#71717a',
                                font: { size: 10 },
                                callback: (v) => {
                                  if (aiChartMode === 'tokens') return formatTokens(v as number);
                                  if (aiChartMode === 'cost') return `$${(v as number).toFixed(2)}`;
                                  return String(v);
                                }
                              },
                              beginAtZero: true,
                            }
                          },
                        }}
                      />
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Distribution Doughnut */}
              <GlassCard>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-lg font-semibold">Usage Distribution</div>
                      <div className="text-sm text-zinc-500">By AI agent</div>
                    </div>
                  </div>
                </div>
                <div className="h-64 flex items-center justify-center">
                  {agentDistributionData.labels.length > 0 ? (
                    <Doughnut
                      data={agentDistributionData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '65%',
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: { color: '#a1a1aa', padding: 16, usePointStyle: true }
                          },
                          tooltip: {
                            backgroundColor: 'rgba(24, 24, 27, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#a1a1aa',
                            borderColor: '#3f3f46',
                            borderWidth: 1,
                            callbacks: {
                              label: (ctx) => {
                                const label = ctx.label || '';
                                const value = ctx.parsed || 0;
                                if (aiChartMode === 'tokens') return ` ${label}: ${formatTokens(value)} tokens`;
                                if (aiChartMode === 'cost') return ` ${label}: ${formatCurrency(value)}`;
                                if (aiChartMode === 'messages') return ` ${label}: ${value} messages`;
                                return ` ${label}: ${value} sessions`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  ) : (
                    <p className="text-zinc-500">No data yet</p>
                  )}
                </div>
              </GlassCard>

              {/* Multi-Agent Comparison Chart */}
              {aiAgents.filter(a => a.tokens > 0).length > 1 && (
                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-violet-400" />
                      <div>
                        <div className="text-lg font-semibold">Compare AI Agents</div>
                        <div className="text-sm text-zinc-500">Grouped daily breakdown</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-lg p-0.5">
                        {(['tokens', 'messages', 'sessions', 'cost'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setCompareMetric(mode)}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                              compareMetric === mode
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-lg p-0.5">
                        {(['week', 'month', 'all'] as const).map(period => (
                          <button
                            key={period}
                            onClick={() => setComparePeriod(period)}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                              comparePeriod === period
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {period === 'week' ? '7D' : period === 'month' ? '30D' : 'All'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Agent Toggles */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {aiAgents.filter(a => a.tokens > 0).map(agent => (
                      <label key={agent.id} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800 transition">
                        <input
                          type="checkbox"
                          checked={compareAgents.includes(agent.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCompareAgents(prev => [...prev, agent.id]);
                            } else {
                              setCompareAgents(prev => prev.filter(id => id !== agent.id));
                            }
                          }}
                          className="w-3 h-3 rounded border-zinc-600"
                        />
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                        <span className="text-xs text-zinc-300">{agent.name}</span>
                      </label>
                    ))}
                  </div>

                  <div className="h-72">
                    {(() => {
                      const daysMap: Record<string, number> = { 'week': 7, 'month': 30, 'all': 90 };
                      const numDays = daysMap[comparePeriod] || 7;
                      const periodDays = eachDayOfInterval({ start: subDays(new Date(), numDays - 1), end: new Date() });
                      const labels = periodDays.map(d => format(d, numDays <= 7 ? 'EEE' : 'MMM dd'));

                      const selected = aiAgents.filter(a => compareAgents.includes(a.id) && a.tokens > 0);
                      const datasets = selected.map(agent => {
                        const data = periodDays.map(d => {
                          const dayStr = format(d, 'yyyy-MM-dd');
                          const dayData = overview?.aiUsage?.byTool?.[agent.id]?.daily?.[dayStr];
                          if (!dayData) return 0;
                          if (compareMetric === 'tokens') return dayData.tokens || 0;
                          if (compareMetric === 'messages') return dayData.messageCount || 0;
                          if (compareMetric === 'sessions') return dayData.sessions || 0;
                          if (compareMetric === 'cost') return dayData.cost || 0;
                          return 0;
                        });
                        return {
                          label: agent.name,
                          data,
                          backgroundColor: agent.color + 'CC',
                          borderColor: agent.color,
                          borderWidth: 1,
                          borderRadius: 2,
                        };
                      });

                      return (
                        <Bar
                          data={{ labels, datasets }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'bottom',
                                labels: { color: '#a1a1aa', padding: 12, usePointStyle: true, font: { size: 11 } }
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
                                    if (compareMetric === 'tokens') return ` ${ctx.dataset.label}: ${formatTokens(val)} tokens`;
                                    if (compareMetric === 'cost') return ` ${ctx.dataset.label}: ${formatCurrency(val)}`;
                                    if (compareMetric === 'messages') return ` ${ctx.dataset.label}: ${val} messages`;
                                    return ` ${ctx.dataset.label}: ${val} sessions`;
                                  }
                                }
                              }
                            },
                            scales: {
                              x: {
                                grid: { display: false },
                                ticks: { color: '#71717a', maxTicksLimit: 8, font: { size: 10 } }
                              },
                              y: {
                                grid: { color: '#27272a' },
                                ticks: {
                                  color: '#71717a',
                                  font: { size: 10 },
                                  callback: (v) => {
                                    if (compareMetric === 'tokens') return formatTokens(v as number);
                                    if (compareMetric === 'cost') return `$${(v as number).toFixed(2)}`;
                                    return String(v);
                                  }
                                },
                                beginAtZero: true,
                              }
                            }
                          }}
                        />
                      );
                    })()}
                  </div>
                </GlassCard>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Git Tab */}
      {activeTab === 'git' && (
        <motion.div
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
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl border border-zinc-700 focus:border-violet-500 focus:outline-none"
              >
                {overview?.projects?.map((project: any) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <motion.button
              onClick={handleSyncGit}
              disabled={syncingGit || !selectedProject}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <GitCommit className={`w-4 h-4 ${syncingGit ? 'animate-spin' : ''}`} />
              {syncingGit ? 'Syncing...' : 'Sync Commits'}
            </motion.button>
          </GlassCard>

          {/* DORA Metrics */}
          {doraMetrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5"
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
                  <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 text-center">
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
                  className="glass rounded-xl p-5"
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
                  className="glass rounded-xl p-5"
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
                className="glass rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
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
            className="glass rounded-xl p-5"
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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
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
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
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
                            <div className="ml-8 pl-4 border-l border-zinc-800 py-3 space-y-2">
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
                                <div className="text-xs text-zinc-400 bg-zinc-900/50 rounded-lg p-3 mt-1 whitespace-pre-wrap">
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
              className="glass rounded-xl p-5"
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
                  whileHover={{ scale: 1.02 }}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <textarea
                value={gitDiff}
                onChange={(e) => setGitDiff(e.target.value)}
                className="w-full h-40 bg-zinc-900/50 text-zinc-300 text-xs font-mono rounded-lg p-3 border border-zinc-800 focus:border-violet-500 focus:outline-none resize-y"
                placeholder="No changes detected..."
              />

              <div className="flex items-center justify-end gap-2 mt-3">
                <motion.button
                  onClick={() => navigator.clipboard.writeText(gitDiff)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {generatingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {generatingMsg ? 'Generating...' : 'Generate with Agent'}
                </motion.button>
              </div>

              {generatedCommitMsg && (
                <div className="mt-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                  <div className="text-xs text-zinc-600 mb-1">Result:</div>
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">{generatedCommitMsg}</div>
                  {generatedCommitMsg.startsWith('Prompt sent') && (
                    <motion.button
                      onClick={() => navigator.clipboard.writeText(generatedCommitMsg)}
                      whileHover={{ scale: 1.02 }}
                      className="mt-2 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded transition-colors"
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
            <AnalyticsDashboard
              aiUsage={workspaceAnalytics.aiUsage}
              sessions={workspaceAnalytics.sessions}
              problems={workspaceAnalytics.problems}
              requests={workspaceAnalytics.requests}
              promptHistory={workspaceAnalytics.promptHistory}
              loading={analyticsLoading}
              period="30d"
              variant="workspace"
            />
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <GlassCard>
            <div className="flex items-center gap-3 mb-4">
              <Archive className="w-6 h-6 text-zinc-400" />
              <div>
                <h2 className="text-xl font-semibold text-white">Backup</h2>
                <p className="text-sm text-zinc-400">Backup snapshots for AI coding changes — coming soon</p>
              </div>
            </div>

            <EmptyState
              icon={<Archive className="w-8 h-8" />}
              title="Backup system not yet active"
              description="Create a backup before your next AI coding session to enable file-level restore"
            />
          </GlassCard>
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
              className="bg-zinc-900 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-zinc-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-zinc-700 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
                <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-white" />
                  </div>
                  Project Tracking Setup Guide
                </h2>
                <div className="flex items-center gap-3">
                  {!showOnboarding && (
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            localStorage.setItem('ide-projects-onboarding-seen', 'true');
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                      />
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
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(85vh-88px)] space-y-6">
                {showOnboarding && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                    <p className="text-blue-300 text-sm"> Welcome! This guide will help you set up project tracking. Follow the steps below to get started.</p>
                  </div>
                )}

                {/* Step 1: Add Project */}
                <GlassCard>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
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
                      <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
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
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
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
                          <div key={agent.name} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl">
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
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-amber-400">3</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-3">Track Git Commits & Metrics</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-zinc-800/50 rounded-xl">
                          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-zinc-400" />
                            Local Repositories
                          </h4>
                          <p className="text-sm text-zinc-400">Add your project (must contain .git folder), then click "Sync Commits" to import commit history, additions, and deletions.</p>
                        </div>
                        <div className="p-4 bg-zinc-800/50 rounded-xl">
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
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
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
                          <div key={ide.name} className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-lg">
                            <Monitor className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm text-zinc-300">{ide.name}</span>
                            {ide.detected ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-zinc-600 ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
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
                      <label key={idx} className="flex items-center gap-3 p-3 hover:bg-zinc-800/30 rounded-lg cursor-pointer transition-colors">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          item.done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
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
              className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 max-w-sm w-full mx-4"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Scanning Environment</h3>
                <p className="text-zinc-400 text-sm mb-4">Detecting IDEs and development tools...</p>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
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

      {syncingAI && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-sm w-full mx-4 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Syncing AI Usage</h3>
            <p className="text-zinc-400 text-sm mb-4">{syncProgress || 'Please wait...'}</p>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: syncProgress ? '60%' : '30%' }}
                transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-4">Do not close or switch tabs during sync</p>
          </motion.div>
        </div>
      )}

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
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-4xl w-full max-h-[85vh] overflow-y-auto"
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
                  className="p-2 hover:bg-zinc-800 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Top Metrics Grid — period-aware */}
              {(() => {
                const daysMap: Record<string, number> = { 'week': 7, 'month': 30, 'all': 9999 };
                const numDays = daysMap[agentDetailPeriod] || 7;
                const cutoff = numDays >= 9999 ? null : subDays(new Date(), numDays - 1);
                const daily = overview?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily || {};

                let periodTokens = 0;
                let periodMessages = 0;
                let periodCost = 0;
                let periodSessions = 0;

                for (const [dateStr, dayData] of Object.entries(daily)) {
                  if (cutoff) {
                    const d = new Date(dateStr);
                    if (d < cutoff) continue;
                  }
                  periodTokens += (dayData as any).tokens || 0;
                  periodMessages += (dayData as any).messageCount || 0;
                  periodCost += (dayData as any).cost || 0;
                  periodSessions += (dayData as any).sessions || 0;
                }

                const periodLabel = agentDetailPeriod === 'week' ? 'Last 7 Days' : agentDetailPeriod === 'month' ? 'Last 30 Days' : 'All Time';

                return (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-zinc-400 font-medium">{periodLabel}</span>
                      <div className="h-px flex-1 bg-zinc-800" />
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                      <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Tokens</div>
                        <div className="text-base font-semibold text-white">{formatTokens(periodTokens)}</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Messages</div>
                        <div className="text-base font-semibold text-blue-400">{periodMessages.toLocaleString()}</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Cost</div>
                        <div className="text-base font-semibold text-emerald-400">{formatCurrency(periodCost)}</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Sessions</div>
                        <div className="text-base font-semibold text-violet-400">{periodSessions.toLocaleString()}</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Tokens/Msg</div>
                        <div className="text-base font-semibold text-amber-400">
                          {periodMessages > 0 ? formatTokens(Math.round(periodTokens / periodMessages)) : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Cost/Session</div>
                        <div className="text-base font-semibold text-rose-400">
                          {periodSessions > 0 ? formatCurrency(periodCost / periodSessions) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Timeline Chart */}
                <div className="bg-zinc-800/50 rounded-xl p-4 lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-zinc-400">Daily Usage</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5 bg-zinc-700/50 rounded-md p-0.5">
                        {(['tokens', 'messages', 'sessions', 'cost'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setAgentDetailMetric(mode)}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                              agentDetailMetric === mode
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-0.5 bg-zinc-700/50 rounded-md p-0.5">
                        {(['week', 'month', 'all'] as const).map(period => (
                          <button
                            key={period}
                            onClick={() => setAgentDetailPeriod(period)}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                              agentDetailPeriod === period
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {period === 'week' ? '7D' : period === 'month' ? '30D' : 'All'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="h-48">
                    {(() => {
                      const daysMap: Record<string, number> = { 'week': 7, 'month': 30, 'all': 90 };
                      const numDays = daysMap[agentDetailPeriod] || 7;
                      const periodDays = eachDayOfInterval({ start: subDays(new Date(), numDays - 1), end: new Date() });
                      const getMetricValue = (dayStr: string) => {
                        const dayData = overview?.aiUsage?.byTool?.[selectedAgentDetail.id]?.daily?.[dayStr];
                        if (!dayData) return 0;
                        if (agentDetailMetric === 'tokens') return dayData.tokens || 0;
                        if (agentDetailMetric === 'messages') return dayData.messageCount || 0;
                        if (agentDetailMetric === 'sessions') return dayData.sessions || 0;
                        if (agentDetailMetric === 'cost') return dayData.cost || 0;
                        return 0;
                      };
                      const chartData = {
                        labels: periodDays.map(d => format(d, numDays <= 7 ? 'EEE' : 'MMM dd')),
                        datasets: [{
                          label: agentDetailMetric.charAt(0).toUpperCase() + agentDetailMetric.slice(1),
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
                                    if (agentDetailMetric === 'tokens') return ` ${formatTokens(val)} tokens`;
                                    if (agentDetailMetric === 'cost') return ` ${formatCurrency(val)}`;
                                    if (agentDetailMetric === 'messages') return ` ${val} messages`;
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
                                    if (agentDetailMetric === 'tokens') return formatTokens(v as number);
                                    if (agentDetailMetric === 'cost') return `$${(v as number).toFixed(2)}`;
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

                {/* Project Breakdown */}
                {(() => {
                  const projects = overview?.aiUsage?.byTool?.[selectedAgentDetail.id]?.projects || [];
                  if (projects.length === 0) return null;
                  return (
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-3">Project Breakdown</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {projects.slice(0, 10).map((proj: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-zinc-900/40 rounded-lg">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-zinc-300 truncate" title={proj.path}>{proj.path}</div>
                              <div className="text-[10px] text-zinc-500">{proj.sessions} sessions • {proj.messageCount} msgs</div>
                            </div>
                            <div className="text-xs text-violet-400 font-medium tabular-nums ml-2">{formatTokens(proj.tokens)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Model Breakdown */}
                {(() => {
                  const models = overview?.aiUsage?.byTool?.[selectedAgentDetail.id]?.modelBreakdown || [];
                  if (models.length === 0) return null;
                  return (
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-3">Model Breakdown</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {models.slice(0, 10).map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-zinc-900/40 rounded-lg">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-zinc-300 truncate" title={m.model}>{m.model}</div>
                              <div className="text-[10px] text-zinc-500">{m.sessions} sessions • {m.messageCount} msgs</div>
                            </div>
                            <div className="text-xs text-blue-400 font-medium tabular-nums ml-2">{formatTokens(m.tokens)}</div>
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
              <GlassCard className="p-4 bg-zinc-800/30 border-zinc-700/50">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">How This Is Calculated</h4>
                <div className="space-y-1 text-xs text-zinc-500">
                  <p><span className="text-zinc-300">Sessions:</span> Number of chat/conversation files. One JSONL file = one session.</p>
                  <p><span className="text-zinc-300">Messages:</span> Count of user + assistant exchanges in session files.</p>
                  <p><span className="text-zinc-300">Tokens:</span> Sum of input + output tokens parsed from session files.</p>
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
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Features & Capabilities
                </h3>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
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
            onClick={() => { setShowAddProject(false); setAddProjectError(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  Add New Project
                </h3>
                <button
onClick={() => { setShowAddProject(false); setAddProjectError(null); setCustomDirResults({}); }}
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
                            {group.projects.map(p => (
                              <button
                                key={p.path}
                                onClick={() => {
                                  setNewProject({ name: p.name, path: p.path, repositoryUrl: '', defaultIde: '' });
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg border border-zinc-700 hover:border-indigo-500/50 transition text-sm"
                              >
                                <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate max-w-[200px]">{p.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
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
                          <div key={dir} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-2">
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
                                    localStorage.setItem('customScanDirs', JSON.stringify(next));
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
                                {dirResults.map(p => (
                                  <button
                                    key={p.path}
                                    onClick={() => setNewProject({ name: p.name, path: p.path, repositoryUrl: '', defaultIde: '' })}
                                    className="flex flex-col items-start gap-0.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg border border-zinc-700 hover:border-indigo-500/50 transition text-xs"
                                  >
                                    <span className="truncate max-w-[180px]">{p.name}</span>
                                    <span className="text-[10px] text-zinc-500 flex flex-wrap gap-1">
                                      {p.languages.slice(0, 3).map(lang => (
                                        <span key={lang} className="px-1 py-0.5 bg-zinc-900 rounded text-zinc-400 border border-zinc-700">{lang}</span>
                                      ))}
                                      {p.languages.length > 3 && <span className="text-zinc-600">+{p.languages.length - 3}</span>}
                                    </span>
                                  </button>
                                ))}
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
                      localStorage.setItem('customScanDirs', JSON.stringify(next));
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
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg border border-dashed border-zinc-700 hover:border-indigo-500/50 transition text-sm w-full justify-center"
                >
                  <FolderOpen className="w-4 h-4" />
                  Add Directory
                </button>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Project Name *</label>
                    <input
                      type="text"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="My Project"
                      className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Project Path *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProject.path}
                        onChange={(e) => setNewProject({ ...newProject, path: e.target.value })}
                        placeholder="C:\Projects\my-project"
                        className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                          const result = await window.deskflowAPI!.pickFolder();
                          if (result.success && result.path) {
                            setNewProject({ ...newProject, path: result.path });
                          }
                        }}
                        className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600 transition"
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
                      className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Default IDE (optional)</label>
                    <select
                      value={newProject.defaultIde}
                      onChange={(e) => setNewProject({ ...newProject, defaultIde: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select an IDE...</option>
                      {overview?.ides?.map((ide: any) => (
                        <option key={ide.id} value={ide.id}>{ide.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => { setShowAddProject(false); setAddProjectError(null); setCustomDirResults({}); }}
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
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-lg w-full"
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
                    className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Project Path *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editProjectForm.path}
                      onChange={(e) => setEditProjectForm({ ...editProjectForm, path: e.target.value })}
                      className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        const result = await window.deskflowAPI!.pickFolder();
                        if (result.success && result.path) {
                          setEditProjectForm({ ...editProjectForm, path: result.path });
                        }
                      }}
                      className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600 transition"
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
                    className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-violet-500 focus:outline-none"
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
                        className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-violet-500 focus:outline-none pr-10"
                      />
                      <ChevronDown
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
                      />
                      {showLanguageDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg max-h-48 overflow-y-auto">
                          {filteredLanguages.length > 0 ? (
                            filteredLanguages.map(lang => (
                              <button
                                key={lang}
                                onClick={() => handleLanguageSelect(lang)}
                                className={`w-full text-left px-4 py-2 text-white hover:bg-zinc-700 transition ${
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
                      className="px-3 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg border border-zinc-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-violet-500 focus:outline-none"
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
                    className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="">Select an IDE...</option>
                    {overview?.ides?.map((ide: any) => (
                      <option key={ide.id} value={ide.id}>{ide.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
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
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-md w-full"
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

      {/* Terminal Workspace Modal */}
        {workspaceProject && (
          <motion.div
            initial={false}
            animate={{
              opacity: isWorkspaceOpen ? 1 : 0,
              pointerEvents: isWorkspaceOpen ? 'auto' : 'none' as any,
              transition: { duration: 0.2 },
            }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
          >
            {/* Workspace Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-close-workspace-dialog'))}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Close workspace"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsWorkspaceOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Minimize workspace"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="text-white font-semibold">{workspaceProject.name}</h2>
                    <p className="text-xs text-zinc-500 font-mono">{workspaceProject.path}</p>
                  </div>
                </div>
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
                  title="Initialize workspace infrastructure (creates agent files, directories)"
                >
                  <FolderTree className="w-3.5 h-3.5" />
                  Initialize
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-new-agent'))}
                  disabled={!selectedProject}
                  className="px-2 py-1.5 bg-zinc-700/60 hover:bg-zinc-600/60 border border-zinc-600/50 text-zinc-300 text-xs rounded-lg flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Start a new AI agent session"
                >
                  <Bot className="w-3.5 h-3.5" />
                  New Agent
                </button>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 flex overflow-hidden">
              <TerminalPage projectId={workspaceProject.id} projectPath={workspaceProject.path} onCloseWorkspace={handleCloseWorkspace} />
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
    </PageShell>
  );
}
