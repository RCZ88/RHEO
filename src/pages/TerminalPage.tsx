import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, X, Monitor, Play, Trash2, Clock, FolderOpen, Zap, Settings, Settings2, PanelLeftClose, PanelLeft, GripVertical, Info, PieChart, AlertCircle, FileText, Send, Folder, Link, Terminal as TerminalIcon, Bug, Sparkles, Search, Eye, MoreHorizontal, RefreshCw, CheckCircle2, ChevronLeft, Database, Palette, ListChecks, BookOpen, DollarSign, Loader2, Edit, AlertTriangle, Lock, Save, MessageSquare, Smartphone, Cpu, ChevronDown, Activity, Bot, GitBranch, Shield, Coins, Network, SwatchBook, BarChart3, DatabaseBackup, Brain, Globe } from 'lucide-react';
import { AnomalyBadge } from '../components/AnomalyBadge';
import type { PaneNode } from '../components/TerminalWindow';
import { TerminalLayout, insertIntoLayout, getLeafIds, getGroupTrees, updateGroupTree } from '../components/TerminalWindow';
import { MapEditor, swapLeavesInTree } from '../components/MapEditor';
import { TerminalMiniMap } from '../components/TerminalMiniMap';
import { InstructionPanel } from '../components/InstructionPanel';
import { NewSessionDialog, type SessionConfig } from '../components/NewSessionDialog';
import ImportSessionsDialog from '../components/ImportSessionsDialog';
import { splitPane, removePane } from '../components/TerminalWindow';
import { ContextMaintenanceTab } from '../components/ContextMaintenanceTab';
import DesignWorkspacePage from './DesignWorkspacePage';
import IssuesWorkspace from '../components/IssuesWorkspace';
import { BugReportPanel } from '../components/BugReportPanel';
import InitializeProgressModal from '../components/InitializeProgressModal';
import ContextSidebar from '../components/ContextSidebar';
import { CodeArchitectureMap } from '../components/workspace/CodeArchitectureMap';
import { BrainManagementView } from '../features/warmth/context-brain/BrainManagementView';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { DEFAULT_SYSTEM_PROMPT, getDefaultAgent } from '../lib/defaults';
import { stripAnsi } from '../lib/stripAnsi';
import GeneralistDialog from '../components/GeneralistDialog';
import { RoutingDisambiguationDialog } from '../components/RoutingDisambiguationDialog';
import { RoutingToast } from '../components/RoutingToast';
import { SessionEditDialog } from '../components/SessionEditDialog';
import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { notificationService } from '../services/NotificationService';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ProblemsTab, ProblemDetailModal, NewProblemDialog } from '../components/ProblemsTab';
import { SkillsTab } from '../components/SkillsTab';
import PromptHistoryTab from '../components/PromptHistoryTab';
import { DesignStudioTab } from '../components/workspace/DesignStudioTab';
import { RequestsTab, RequestDetailModal, NewRequestDialog } from '../components/RequestsTab';
import { FilesTab } from '../components/FilesTab';
import PerformanceMetricsPanel from '../components/workspace/PerformanceMetricsPanel';
import CodeStatsTab from '../components/workspace/CodeStatsTab';
import { ConductorWorkspaceTab } from '../components/workspace/ConductorWorkspaceTab';
import { AIGatewayTab } from '../components/workspace/ai-gateway/AIGatewayTab';
import { WorkspaceDetailModal } from '../components/workspace/WorkspaceDetailModal';
import { WorkspaceShell } from '../components/workspace/WorkspaceShell';
import { WorkspaceGroupRail } from '../components/workspace/WorkspaceGroupRail';
import { PresetsTab } from '../components/workspace/PresetsTab';
import { ConfigsTab } from '../components/workspace/ConfigsTab';
import FortressProtocolSetup from '../components/workspace/FortressProtocolSetup';
import BackupCenterPage from '../pages/BackupCenterPage';
import { usePersistentSubTab } from '../hooks/usePersistentSubTab';
import PageContextPanel from '../components/PageContextPanel';
import FeatureLogicPanel from '../components/workspace/FeatureLogicPanel';
import ArchMapPage from '../features/arch-map/ArchMapPage';
import { UserDictionaryPanel } from '../components/UserDictionaryPanel';
import '@xterm/xterm/css/xterm.css';
import { SelectionProvider, SelectionOverlay, SelectionToolbar, SelectionResultPanel, SelectionEngineActivator } from '../features/selection-engine';
import { MousePointer2 } from 'lucide-react';

function generateTerminalId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface TerminalGroup { terminals: string[]; direction?: 'horizontal' | 'vertical'; }

function collectLeafIds(node: PaneNode): string[] {
  if (node.type === 'leaf') return node.terminalId ? [node.terminalId] : [];
  if (node.children) return [...collectLeafIds(node.children[0]), ...collectLeafIds(node.children[1])];
  return [];
}

function extractGroups(layout: PaneNode | null): TerminalGroup[] {
  if (!layout) return [];
  if (layout.type === 'leaf') return [{ terminals: layout.terminalId ? [layout.terminalId] : [], direction: undefined }];
  if (layout.children) return layout.children.map(c => ({ terminals: collectLeafIds(c), direction: layout.direction }));
  return [];
}

function togglePaneDirection(node: PaneNode, path: number[]): PaneNode {
  if (path.length === 0) {
    return { ...node, direction: node.direction === 'horizontal' ? 'vertical' : 'horizontal' };
  }
  const [index, ...rest] = path;
  if (!node.children || !node.children[index]) return node;
  const newChildren = [...node.children];
  newChildren[index] = togglePaneDirection(newChildren[index], rest);
  return { ...node, children: newChildren };
}

function findLeafInTree(node: PaneNode, terminalId: string): PaneNode | null {
  if (node.type === 'leaf') return node.terminalId === terminalId ? node : null;
  if (node.children) {
    for (const child of node.children) {
      const found = findLeafInTree(child, terminalId);
      if (found) return found;
    }
  }
  return null;
}

function removeLeafFromTree(node: PaneNode, terminalId: string): PaneNode | null {
  if (node.type === 'leaf') return node.terminalId === terminalId ? null : node;
  if (!node.children) return node;
  const newChildren = node.children.map(c => removeLeafFromTree(c, terminalId)).filter((c): c is PaneNode => c !== null);
  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...node, children: newChildren };
}

function addLeafToGroup(tree: PaneNode, targetId: string, leaf: PaneNode, direction: 'horizontal' | 'vertical'): PaneNode {
  if (tree.type === 'leaf' && tree.terminalId === targetId) {
    return { type: 'split', direction, children: [tree, leaf] };
  }
  if (tree.children) {
    return { ...tree, children: tree.children.map(c => addLeafToGroup(c, targetId, leaf, direction)) };
  }
  return tree;
}

// ── Session Categorization Config ──

const SESSION_CATEGORIES: Record<string, { label: string; icon: any; bg: string; text: string; border: string; color: string }> = {
  'bug-fix': { label: 'Bug Fix', icon: Bug, bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', color: 'red' },
  'feature': { label: 'Feature', icon: Sparkles, bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', color: 'blue' },
  'refactor': { label: 'Refactor', icon: RefreshCw, bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30', color: 'purple' },
  'research': { label: 'Research', icon: Search, bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/30', color: 'teal' },
  'review': { label: 'Review', icon: Eye, bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', color: 'amber' },
  'other': { label: 'Other', icon: MoreHorizontal, bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30', color: 'zinc' },
};

const SESSION_STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  active: { dot: 'bg-green-500 animate-pulse', label: 'Active' },
  paused: { dot: 'bg-yellow-500', label: 'Paused' },
  completed: { dot: 'bg-gray-500', label: 'Completed' },
  archived: { dot: 'bg-zinc-600', label: 'Archived' },
  action_required: { dot: 'bg-orange-500 animate-pulse', label: 'Action Required' },
  in_progress: { dot: 'bg-violet-500 animate-pulse', label: 'Working...' },
  ready: { dot: 'bg-cyan-500', label: 'Ready' },
};

const SUBPAGE_LABELS: Record<string, string> = {
  'setup/presets': 'Setup / Presets',
  'setup/configs': 'Setup / Configs',
  'setup/fortress': 'Setup / Fortress',
  'setup/backups': 'Setup / Backups',
  'work/sessions': 'Work / Sessions',
  'work/map': 'Work / Map',
  'work/files': 'Work / Files',
  'work/workspaces': 'Work / Workspaces',
  'insights/analytics': 'Insights / Analytics',
  'insights/code-stats': 'Insights / Code Stats',
  'insights/history': 'Insights / Prompts',
  'insights/issues': 'Insights / Issues',
  'insights/performance': 'Insights / Performance',
  'insights/bugs': 'Insights / Bugs',
  'insights/architecture': 'Insights / Architecture',
  'studio/skills': 'Studio / Skills',
  'studio/styles': 'Studio / Styles',
  'studio/design': 'Studio / Design',
  'ai-gateway/status': 'AI Gateway / Status',
  'ai-gateway/chat': 'AI Gateway / Chat',
  'ai-gateway/providers': 'AI Gateway / Providers',
  'ai-gateway/runs': 'AI Gateway / Runs',
  'ai-gateway/settings': 'AI Gateway / Settings',
  'context/context': 'Context / Context',
  'context/context-maintenance': 'Context / Maintenance',
  'context/page-context': 'Context / Page Context',
  'context/feature-logic': 'Context / Feature Logic',
  'context/dictionary': 'Context / Dictionary',
};

function CategoryBadge({ category }: { category?: string }) {
  const cat = SESSION_CATEGORIES[category || 'other'] || SESSION_CATEGORIES.other;
  const Icon = cat.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium leading-none ${cat.bg} ${cat.text} ${cat.border} border`}>
      <Icon className="w-2.5 h-2.5" />
      {cat.label}
    </span>
  );
}

function ModelSwitcher({ terminalId, agent }: { terminalId: string; agent: string }) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ installed: boolean; source: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const api: any = (window as any).deskflowAPI;
      const r = await api?.detectModels?.(agent);
      if (r?.success) { setModels(r.models || []); setMeta({ installed: !!r.installed, source: r.source || 'fallback' }); }
    } catch (e) {} finally { setLoading(false); }
  }, [agent]);
  useEffect(() => {
    const api: any = (window as any).deskflowAPI;
    if (!api?.onModelChanged) return;
    const unsub = api.onModelChanged((d: any) => { if (d && d.terminalId === terminalId && d.model) setCurrent(d.model); });
    return typeof unsub === 'function' ? unsub : undefined;
  }, [terminalId]);
  const pick = useCallback(async (m: string) => {
    setOpen(false);
    setCurrent(m);
    try { await (window as any).deskflowAPI?.setSessionModel?.(terminalId, m, agent); } catch (e) {}
  }, [terminalId, agent]);
  return (
    <div className="relative">
      <button
        onClick={() => { const n = !open; setOpen(n); if (n && models.length === 0) load(); }}
        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-zinc-800/70 ring-1 ring-inset ring-zinc-700 text-zinc-300 hover:ring-[color:var(--page-accent)]/50 hover:text-white transition-colors duration-150"
        title="Switch model for this session"
      >
        <Cpu className="w-3 h-3" />
        <span className="max-w-[140px] truncate">{current || 'Model'}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-1 z-50 w-56 max-h-72 overflow-auto rounded-lg bg-zinc-900 ring-1 ring-inset ring-zinc-700 shadow-xl p-1">
          <div className="flex items-center justify-between px-2 py-1 text-[10px] text-zinc-500">
            <span>{loading ? 'Detecting...' : (meta ? (meta.source === 'detected' ? 'Detected' : 'Suggested') : 'Models')}</span>
            {meta && !meta.installed ? <span className="text-amber-400">CLI not found</span> : null}
          </div>
          {models.length === 0 && !loading ? (
            <div className="px-2 py-2 text-[11px] text-zinc-500">No models found</div>
          ) : null}
          {models.map((m) => (
            <button
              key={m}
              onClick={() => pick(m)}
              className={'w-full text-left px-2 py-1.5 text-[11px] rounded-md hover:bg-zinc-800 transition-colors ' + (m === current ? 'text-[color:var(--page-accent)]' : 'text-zinc-300')}
            >
              {m}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SessionResourceStats({ stats }: { stats?: { pid: number | null; alive: boolean; memMB: number; cpuPct: number; eventLoopLagMs: number; ts: number } }) {
  if (!stats || !stats.alive) return null;
  const laggy = stats.eventLoopLagMs > 200 || stats.cpuPct > 90;
  const warm = !laggy && (stats.cpuPct > 60 || stats.memMB > 1500);
  const healthColor = laggy ? 'text-red-400' : warm ? 'text-amber-400' : 'text-emerald-400';
  const dotColor = laggy ? 'bg-red-500' : warm ? 'bg-amber-500' : 'bg-emerald-500';
  const memLabel = stats.memMB >= 1024 ? (stats.memMB / 1024).toFixed(1) + ' GB' : Math.round(stats.memMB) + ' MB';
  return (
    <div className="flex items-center gap-2 mt-1" title={'PID ' + (stats.pid != null ? stats.pid : '?') + '  |  event-loop lag ' + Math.round(stats.eventLoopLagMs) + 'ms'}>
      <span className={'flex items-center gap-1 text-[10px] font-medium ' + healthColor}>
        <span className={'w-1.5 h-1.5 rounded-full ' + dotColor + (laggy ? ' animate-pulse' : '')} />
        {laggy ? 'Laggy' : warm ? 'Busy' : 'Smooth'}
      </span>
      <span className="text-[10px] text-zinc-500 font-mono">{Math.round(stats.cpuPct)}% CPU</span>
      <span className="text-[10px] text-zinc-500 font-mono">{memLabel}</span>
    </div>
  );
}

function ConfigGenerator({ agent, baseDir }: { agent: string; baseDir: string }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'project' | 'global' | 'custom'>('project');
  const [customDir, setCustomDir] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const run = async () => {
    const api: any = (window as any).deskflowAPI;
    if (!api || !api.generateAgentConfigs) { setResult('Config API unavailable'); return; }
    setBusy(true); setResult(null);
    try {
      const r = await api.generateAgentConfigs({ agent: agent || 'all', scope: scope, baseDir: baseDir, customDir: customDir || undefined });
      if (r && r.success) {
        const written = (r.files || []).filter((f: any) => f.status === 'written').length;
        const skipped = (r.files || []).filter((f: any) => f.status === 'skipped').length;
        setResult('Wrote ' + written + ', skipped ' + skipped + ' -> ' + (r.root || '?'));
      } else { setResult((r && r.error) || 'Failed'); }
    } catch (e: any) { setResult(String((e && e.message) || e)); }
    setBusy(false);
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-zinc-800/70 ring-1 ring-inset ring-zinc-700 text-zinc-300 hover:ring-[color:var(--page-accent)]/50 hover:text-white transition-colors duration-150" title="Generate CLI config files (opencode.json, GEMINI.md, CLAUDE.md, codex)">
        <Settings className="w-3 h-3" />
        <span>Configs</span>
      </button>
      {open ? (
        <div className="absolute bottom-full mb-1 right-0 z-50 w-64 rounded-lg ring-1 ring-inset ring-zinc-700 bg-zinc-900 p-3 shadow-xl">
          <div className="text-[11px] font-semibold text-zinc-200 mb-2">Generate CLI configs</div>
          <div className="flex flex-col gap-1 mb-2">
            {(['project', 'global', 'custom'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                <input type="radio" name="cfg-scope" checked={scope === s} onChange={() => setScope(s)} />
                <span>{s === 'project' ? 'Project (this repo)' : s === 'global' ? 'Global (home dir)' : 'Custom directory'}</span>
              </label>
            ))}
          </div>
          {scope === 'custom' ? (
            <input value={customDir} onChange={(e) => setCustomDir(e.target.value)} placeholder="/path/to/dir" className="w-full mb-2 px-2 py-1 text-[11px] rounded bg-zinc-800 border border-zinc-700 text-zinc-200" />
          ) : null}
          <button onClick={run} disabled={busy} className="w-full px-2 py-1 rounded-md text-[11px] font-semibold text-white bg-[color:var(--page-accent)] hover:opacity-90 disabled:opacity-50 transition-opacity">
            {busy ? 'Generating...' : 'Generate for ' + (agent || 'all')}
          </button>
          {result ? <div className="mt-2 text-[10px] text-zinc-400 break-words">{result}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusDot({ status, size }: { status?: string; size?: 'sm' | 'md' }) {
  const style = SESSION_STATUS_STYLES[status || 'active'] || SESSION_STATUS_STYLES.active;
  const dims = size === 'md' ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5';
  return <span className={`${dims} rounded-full flex-shrink-0 ${style.dot}`} title={style.label} />;
}

// ── Workspace UI Primitives ──

const GROUP_ACCENT_HEX: Record<string, string> = {
	green: '#34d399', emerald: '#34d399', teal: '#2dd4bf', cyan: '#22d3ee', blue: '#3b82f6',
	indigo: '#818cf8', violet: '#a78bfa', purple: '#c084fc', pink: '#f472b6', rose: '#fb7185',
	amber: '#fbbf24', yellow: '#facc15', orange: '#fb923c',
};
const accentStyle = (accent: string): React.CSSProperties => ({ ['--page-accent' as string]: GROUP_ACCENT_HEX[accent] || '#22d3ee' } as React.CSSProperties);

const WS_ICON_BTN = 'p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors duration-150 active:scale-95';

const WS_SELECT = 'h-7 w-full rounded-md bg-zinc-900 border border-zinc-800/60 px-2 pr-7 text-[11px] text-zinc-200 appearance-none bg-no-repeat bg-[right_0.5rem_center] hover:border-zinc-700 focus:border-[color:var(--page-accent)]/60 focus:ring-1 focus:ring-[color:var(--page-accent)]/25 focus:outline-none transition-colors duration-150';

const TAB_ACTIVE: Record<string, string> = {
	green: 'text-green-400 border-green-500', emerald: 'text-emerald-400 border-emerald-500',
	yellow: 'text-yellow-400 border-yellow-500', indigo: 'text-indigo-400 border-indigo-500',
	pink: 'text-pink-400 border-pink-500', orange: 'text-orange-400 border-orange-500',
	rose: 'text-rose-400 border-rose-500', amber: 'text-amber-400 border-amber-500',
	violet: 'text-violet-400 border-violet-500',
};

const ACCENT_STRIP: Record<string, string> = {
	green: 'bg-green-500', emerald: 'bg-emerald-500', yellow: 'bg-yellow-500',
	indigo: 'bg-indigo-500', pink: 'bg-pink-500', orange: 'bg-orange-500',
	rose: 'bg-rose-500', amber: 'bg-amber-500', violet: 'bg-violet-500',
};

// Per-group accent classes for the sidebar nav (Frontend Design: per-section accents)
const ACCENT_TEXT: Record<string, string> = {
	orange: 'text-orange-300', green: 'text-green-300', purple: 'text-purple-300',
	indigo: 'text-indigo-300', amber: 'text-amber-300', rose: 'text-rose-300',
};
const ACCENT_BORDER: Record<string, string> = {
	orange: 'border-orange-500/50', green: 'border-green-500/50', purple: 'border-purple-500/50',
	indigo: 'border-indigo-500/50', amber: 'border-amber-500/50', rose: 'border-rose-500/50',
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
	return (
		<button
			role="switch" aria-checked={checked} aria-label={label}
			onClick={() => onChange(!checked)}
			className={`relative inline-flex items-center w-9 h-5 rounded-full shrink-0 transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]/40 ${checked ? 'bg-[color:var(--page-accent)]' : 'bg-zinc-700'}`}
		>
			<span className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
		</button>
	);
}

function Pill({ active, onClick, dotClass, children }: { active: boolean; onClick: () => void; dotClass?: string; children: React.ReactNode }) {
	return (
		<button
			onClick={onClick}
			className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium transition-colors duration-150 active:scale-95 border ${active ? 'bg-zinc-200 text-zinc-900 border-transparent' : 'bg-transparent text-zinc-400 border-zinc-800/60 hover:text-zinc-200 hover:border-zinc-700'}`}
		>
			{dotClass && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
			{children}
		</button>
	);
}

function Badge({ tone = 'zinc', children }: { tone?: 'zinc' | 'blue' | 'green'; children: React.ReactNode }) {
	const tones: Record<string, string> = {
		zinc: 'bg-zinc-800 text-zinc-300',
		blue: 'bg-blue-500/15 text-blue-300',
		green: 'bg-green-500/15 text-green-300',
	};
	return <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
}

function ToolbarButton({ variant = 'secondary', icon: Icon, children, ...props }: { variant?: 'primary' | 'secondary'; icon?: React.ComponentType<any>; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			{...props}
			className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium transition-colors duration-150 active:scale-95 ${variant === 'primary' ? 'bg-[color:var(--page-accent)] text-zinc-950 font-semibold ring-1 ring-inset ring-white/15 shadow-sm shadow-black/40 hover:brightness-110' : 'bg-zinc-800/70 ring-1 ring-zinc-700/60 hover:bg-zinc-700/70 text-zinc-200 backdrop-blur-sm'}`}
		>
			{Icon && <Icon className="w-3.5 h-3.5" />}
			{children}
		</button>
	);
}

function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }: { open: boolean; onClose: () => void; title: string; width?: string; children: React.ReactNode; footer?: React.ReactNode }) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-overlay)] flex items-center justify-center p-4" onClick={onClose}>
			<div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={accentStyle('cyan')} className={`w-full ${width} rounded-xl border border-zinc-800/60 bg-zinc-900 animate-[ws-modal-in_250ms_cubic-bezier(0.2,0,0,1)]`}>
				<header className="flex items-center justify-between px-4 h-11 border-b border-zinc-800/60">
					<h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
					<button onClick={onClose} className={WS_ICON_BTN}><X className="w-4 h-4" /></button>
				</header>
				<div className="p-4 space-y-3 text-xs text-zinc-300">{children}</div>
				{footer && <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800/60">{footer}</footer>}
			</div>
		</div>
	);
}

function SectionCard({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) {
	return (
		<section style={accentStyle(accent)} className="rounded-xl ring-1 ring-inset ring-zinc-800/70 bg-zinc-900/50 backdrop-blur-sm">
			<header className="flex items-center gap-1.5 px-3 h-9 border-b border-zinc-800/60">
				<span className={`w-1.5 h-1.5 rounded-full ${ACCENT_STRIP[accent]}`} />
				<span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{title}</span>
			</header>
			<div className="p-3 space-y-3">{children}</div>
		</section>
	);
}

function TabPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
	return (
		<div className="relative flex-1 min-h-0">
			<span className={`absolute left-0 top-0 bottom-0 w-0.5 ${ACCENT_STRIP[accent]} opacity-60`} />
			<div className="px-3 py-3 space-y-3">
				{children}
			</div>
		</div>
	);
}

function WorkspacesPanel({ projectId, currentName, onLoad, onSaveCurrent }: {
  projectId: string | null;
  currentName: string;
  onLoad: (name?: string) => Promise<void> | void;
  onSaveCurrent: (name?: string) => Promise<void> | void;
}) {
  const [items, setItems] = useState<Array<{ name: string; isActive: boolean; activeTab?: string; updatedAt?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId || !window.deskflowAPI?.listWorkspaces) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await window.deskflowAPI.listWorkspaces({ projectId });
      if (res?.success && Array.isArray(res.data)) setItems(res.data);
      else setItems([]);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = useCallback(async (name: string) => {
    if (!projectId || !window.deskflowAPI?.deleteWorkspace) return;
    if (!window.confirm(`Delete saved workspace "${name}"?`)) return;
    await window.deskflowAPI.deleteWorkspace({ projectId, name });
    refresh();
  }, [projectId, refresh]);

  return (
    <div className="relative flex-1 min-h-0">
      <div className="px-3 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">Saved workspaces for this project</p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowDetail(true)} className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] rounded flex items-center gap-1">
              View Details
            </button>
            <button onClick={refresh} className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] rounded flex items-center gap-1">
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New workspace name…"
            className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-green-500"
          />
          <button
            onClick={async () => { await onSaveCurrent(newName.trim() || undefined); setNewName(''); refresh(); }}
            className="px-2 py-1 bg-green-600/70 hover:bg-green-500/80 text-green-100 text-[10px] font-medium rounded flex items-center gap-1 whitespace-nowrap"
          >
            <Save size={11} /> Save current
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-600">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-zinc-600">No saved workspaces yet. Save the current layout above to create one.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((w) => (
              <div key={w.name} className="flex items-center justify-between px-2.5 py-2 bg-zinc-800/60 border border-zinc-700 rounded-md">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-200 font-medium truncate">{w.name}</span>
                    {w.isActive && <span className="text-[9px] text-green-400 border border-green-600/50 rounded px-1">active</span>}
                    {w.name === currentName && <span className="text-[9px] text-blue-400 border border-blue-600/50 rounded px-1">current</span>}
                  </div>
                  {w.updatedAt && <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5"><Clock size={9} /> {formatDate(w.updatedAt)}</div>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onLoad(w.name)}
                    className="px-2 py-0.5 bg-green-600/50 hover:bg-green-500/80 text-green-100 text-[10px] font-medium rounded transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDelete(w.name)}
                    title="Delete workspace"
                    className="px-2 py-0.5 bg-rose-600/50 hover:bg-rose-500/80 text-rose-200 text-[10px] font-medium rounded transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showDetail && projectId && (
        <WorkspaceDetailModal
          projectId={projectId}
          onClose={() => setShowDetail(false)}
          onLoad={(name) => { onLoad(name); setShowDetail(false); }}
          onDelete={async (name) => { await window.deskflowAPI?.deleteWorkspace?.({ projectId, name }); refresh(); }}
        />
      )}
    </div>
  );
}

function GroupPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
	return (
		<div className="min-h-full">
			{children}
		</div>
	);
}

interface Preset {
  id: string;
  name: string;
  command: string;
  category?: string;
  isBuiltIn?: boolean;
}

interface Session {
  id: string;
  agent: string;
  topic: string;
  resume_id?: string;
  created_at: string;
  total_cost?: number;
  total_tokens?: number;
  terminal_id?: string;
  // Categorization fields
  category?: string;
  status?: string;
  product_area?: string;
  description?: string;
  auto_tags?: string;
  category_confirmed?: number;
  auto_named?: number;
  subpage?: string;
}

const loggedErrors = new Set<string>();

function logOnce(key: string, message: string, ...args: any[]) {
  if (!loggedErrors.has(key)) {
    loggedErrors.add(key);
    console.warn(message, ...args);
  }
}

export default function TerminalPage({ projectId: propProjectId, projectPath: propProjectPath, onCloseWorkspace }: { projectId?: string; projectPath?: string; onCloseWorkspace?: () => void }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('terminal-sidebarWidth');
    return saved ? parseInt(saved) : 400;
  });
  const [isResizing, setIsResizing] = useState(false);
  type GroupKey = 'setup' | 'work' | 'insights' | 'studio' | 'conductor' | 'ai-gateway' | 'context';
  const [activeGroup, setActiveGroup] = useState<GroupKey>(() => {
    const saved = localStorage.getItem('terminal-activeGroup');
    return (saved as GroupKey) || 'setup';
  });
  const location = useLocation();
  useEffect(() => {
    const group = (location.state as any)?.group;
    if (group) setActiveGroup(group);
    const subpage = (location.state as any)?.subpage;
    if (subpage && typeof subpage === 'string') {
      const [grp, sub] = subpage.split('/');
      if (grp && sub) {
        localStorage.setItem(`workspace-subtab-${grp}`, sub);
      }
    }
  }, []);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const sessionsRef = useRef<Session[]>([]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPreset, setNewPreset] = useState({ name: '', command: '', category: '' });
  const [showEditPreset, setShowEditPreset] = useState(false);
  const [editPreset, setEditPreset] = useState<Preset | null>(null);
  const [showFeaturesDialog, setShowFeaturesDialog] = useState(false);
  const [showGeneralistDialog, setShowGeneralistDialog] = useState(false);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showImportSessionsDialog, setShowImportSessionsDialog] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);
  useEffect(() => {
    window.deskflowAPI?.getPreferences?.().then(prefs => { if (prefs) setPreferences(prefs); });
  }, []);
  const [modelReinjectThreshold, setModelReinjectThreshold] = useState(() => {
    const saved = localStorage.getItem('model-reinject-threshold');
    return saved ? Number(saved) : 10;
  });
  const [modelDefaultTier, setModelDefaultTier] = useState<'top' | 'mid' | 'low'>(() => {
    return (localStorage.getItem('default-model-tier') as any) || 'mid';
  });
  const [modelDebugMode, setModelDebugMode] = useState(() => {
    return localStorage.getItem('model-debug-mode') === 'true';
  });
  const [openCodeSessionName, setOpenCodeSessionName] = useState('');
  const [newSessionAgent, setNewSessionAgent] = useState('claude');
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionMode, setNewSessionMode] = useState<'create' | 'initialize'>('create');
  const [newSessionTerminalMode, setNewSessionTerminalMode] = useState<'create' | 'select'>('create');
  const [newSessionSelectedTerminal, setNewSessionSelectedTerminal] = useState('');
  const [sendTargetSession, setSendTargetSession] = useState<string>('');
  const [autoAssignConfig, setAutoAssignConfig] = useState<any>(null);
  // ── Cross-session sync config ─────────────────────────────────
  const [crossSessionSyncEnabled, setCrossSessionSyncEnabled] = useState(() => {
    return localStorage.getItem('cross-session-sync-enabled') !== 'false';
  });
  const [fileLockTTL, setFileLockTTL] = useState(() => {
    const saved = localStorage.getItem('file-lock-ttl');
    return saved ? Number(saved) : 300;
  });
  const [contextBroadcastEnabled, setContextBroadcastEnabled] = useState(() => {
    return localStorage.getItem('context-broadcast-enabled') !== 'false';
  });
  const [conflictWarningMode, setConflictWarningMode] = useState(() => {
    return localStorage.getItem('conflict-warning-mode') || 'both';
  });
  const [syncCommandEnabled, setSyncCommandEnabled] = useState(() => {
    return localStorage.getItem('sync-command-enabled') !== 'false';
  });
  const [thoughtProcessEnabled, setThoughtProcessEnabled] = useState(() => {
    return localStorage.getItem('thought-process-enabled') !== 'false';
  });
  const [routingResult, setRoutingResult] = useState<any>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const [disambiguationCandidates, setDisambiguationCandidates] = useState<any[]>([]);
  const [showRoutingToast, setShowRoutingToast] = useState(false);
  const [routingToastSession, setRoutingToastSession] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [showMessagesViewer, setShowMessagesViewer] = useState<string | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<Session | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [quotedReferences, setQuotedReferences] = useState<Array<{ role: string; content: string; createdAt?: string; id?: number }>>([]);
  const [sessionProblems, setSessionProblems] = useState<any[]>([]);
  const [sessionRequests, setSessionRequests] = useState<any[]>([]);
  const [messagesSearchQuery, setMessagesSearchQuery] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string; path: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(propProjectId || '');
  const [hoveredPane, setHoveredPane] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<{ totalTokens: number; totalCost: number; byTool: Record<string, any> | null } | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsProblems, setAnalyticsProblems] = useState<any[]>([]);
  const [analyticsRequests, setAnalyticsRequests] = useState<any[]>([]);
  const [analyticsPromptHistory, setAnalyticsPromptHistory] = useState<any[]>([]);
  const [analyticsDailyStats, setAnalyticsDailyStats] = useState<any[]>([]);
  const [analyticsCodeStats, setAnalyticsCodeStats] = useState<any | undefined>(undefined);

  
  // Terminal binding state
  const [terminalBindings, setTerminalBindings] = useState<Record<string, {
    terminalId: string;
    projectId: string | null;
    activeProblemId: string | null;
    status: string;
    agentType: string | null;
  }>>({});
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [showInstructionInput, setShowInstructionInput] = useState(false);
  const [showInstructionPanel, setShowInstructionPanel] = useState(false);
  const [composeSkills, setComposeSkills] = useState<string[]>([]);
  const [terminalAnomalies, setTerminalAnomalies] = useState<Record<string, { kind: string; type: string; severity: 'low' | 'medium' | 'high'; detail: string; ts: number }>>({});
  const [cliUpdates, setCliUpdates] = useState<Array<{ agent: string; current: string; latest: string; pkg: string }>>([]);
  useEffect(() => {
    const api: any = (window as any).deskflowAPI;
    const subs: Array<() => void> = [];
    if (api && api.onTerminalAnomaly) subs.push(api.onTerminalAnomaly((d: any) => { setTerminalAnomalies((prev) => ({ ...prev, [d.terminalId]: { kind: d.kind, type: d.type, severity: d.severity, detail: d.detail, ts: d.ts } })); }));
    if (api && api.onCliUpdateAvailable) subs.push(api.onCliUpdateAvailable((list: any) => { setCliUpdates(Array.isArray(list) ? list : []); }));
    return () => { subs.forEach((u) => { try { u(); } catch (_e) { } }); };
  }, []);
  const [resourceStats, setResourceStats] = useState<Record<string, { pid: number | null; alive: boolean; memMB: number; cpuPct: number; eventLoopLagMs: number; ts: number }>>({});
  useEffect(() => {
    const api: any = (window as any).deskflowAPI;
    if (!api || typeof api.onResourceStats !== 'function') return;
    const unsub = api.onResourceStats((stats: any) => setResourceStats(stats || {}));
    return typeof unsub === 'function' ? unsub : undefined;
  }, []);
  const [instructionText, setInstructionText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [terminalErrorType, setTerminalErrorType] = useState<'error' | 'warning' | 'info'>('error');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogName, setSaveDialogName] = useState('');
  const [showCloseWorkspaceDialog, setShowCloseWorkspaceDialog] = useState(false);

  // Workspace instance management (named snapshots)
  const [workspaceName, setWorkspaceName] = useState<string>('default');
  const [showWorkspaceSaveAsDialog, setShowWorkspaceSaveAsDialog] = useState(false);
  const [workspaceSaveAsName, setWorkspaceSaveAsName] = useState('');
  const [showWorkspaceLoadDialog, setShowWorkspaceLoadDialog] = useState(false);
  const [workspaceList, setWorkspaceList] = useState<Array<{ name: string; isActive: boolean; sidebarWidth: number; activeTab: string; updatedAt: string }>>([]);
  const [workspaceListLoading, setWorkspaceListLoading] = useState(false);
  const [opencodeSessionExport, setOpencodeSessionExport] = useState<any>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [fileConflicts, setFileConflicts] = useState<Array<{
    filePath: string; requestingTerminal: string; lockingTerminal: string;
    sessionId: string | null; timestamp: number;
  }>>([]);
  const [terminalFileLocks, setTerminalFileLocks] = useState<Record<string, string[]>>({});
  const [touchedFiles, setTouchedFiles] = useState<Array<{
    id: string; terminal_id: string; session_id: string;
    file_path: string; action: string; project_path: string; timestamp: string;
  }>>([]);

  // Confirm dialog (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void }>({ isOpen: false, message: '', onConfirm: () => {} });

  // Context menu for session items
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: Session } | null>(null);

  // Session drag state for drag-to-terminal
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);

  const showError = useCallback((msg: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setTerminalError(msg);
    setTerminalErrorType(type);
    setTimeout(() => setTerminalError(null), 8000);
  }, []);

  interface AgentInitErrorInfo {
    terminalId: string;
    agentType: string;
    reason: string;
    detail: string;
    installHint?: string;
    hint?: string;
  }
  const [agentInitErrors, setAgentInitErrors] = useState<Record<string, AgentInitErrorInfo>>({});

  // Real-time agent status + captured session IDs per terminal
  const [terminalAgentStatus, setTerminalAgentStatus] = useState<Record<string, { phase: string; sessionId?: string | null; error?: string | null }>>({});
  const [terminalCapturedSessionIds, setTerminalCapturedSessionIds] = useState<Record<string, string>>({});

  // Terminal tab bar state
  type TerminalTabInfo = { name: string; agent: string; modelTier?: string };
  useEffect(() => {
    if (!window.deskflowAPI?.onAiTaskUpdated) return;

    const cleanup = window.deskflowAPI.onAiTaskUpdated((data: { terminalId: string; status: string }) => {
      // Get settings from localStorage
      const settings = JSON.parse(localStorage.getItem('agent-notifications') || '{"attention": true, "complete": true}');
      
      if (data.status === 'action_required' && settings.attention) {
        notificationService.notifyAttention();
      } else if (data.status === 'completed' && settings.complete) {
        notificationService.notifyComplete();
      }
    });

    return () => cleanup();
  }, []);

  const [terminalTabs, setTerminalTabs] = useState<Record<string, TerminalTabInfo>>({});
  const terminalTabsRef = useRef(terminalTabs);
  useEffect(() => { terminalTabsRef.current = terminalTabs; }, [terminalTabs]);
  const draggedTabRef = useRef<string | null>(null);
  // to hold onCloseWorkspace for IPC cleanup
  const onCloseWorkspaceRef = useRef(onCloseWorkspace);
  const instructionTextareaRef = useRef<HTMLTextAreaElement>(null);
  onCloseWorkspaceRef.current = onCloseWorkspace;

  // Problems and Requests for binding/instruction panel
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [showBindDropdown, setShowBindDropdown] = useState(false);

  // Session categorization state
  const [sessionCategoryFilter, setSessionCategoryFilter] = useState<string>('all');
  const [sessionSubpageFilter, setSessionSubpageFilter] = useState<string>('all');
  const [sessionAgentFilter, setSessionAgentFilter] = useState<string>('all');
  const [mentionDropdown, setMentionDropdown] = useState<{
    visible: boolean; query: string; results: Array<{ id: string; name: string; agent: string; sessionTopic: string }>; cursor: number;
  }>({ visible: false, query: '', results: [], cursor: 0 });
  
  // Initialize agent state
  const [initStatus, setInitStatus] = useState<'idle' | 'checking' | 'ready' | 'init-ok' | 'error'>('idle');
  const [showInitModal, setShowInitModal] = useState(false);

  const handleInitSetup = useCallback(async () => {
    if (initStatus === 'init-ok') {
      if (!window.confirm('This project is already initialized. Re-initialize workspace files?')) return;
    }
    setShowInitModal(true);
  }, [initStatus]);

  // File change pulse notification
  const [fileChangedPulse, setFileChangedPulse] = useState(false);
  const [terminalLayout, setTerminalLayout] = useState<PaneNode | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [layoutLoading, setLayoutLoading] = useState(true);
  const effectiveProjectId = propProjectId || selectedProject;

  const [mapListRatio, setMapListRatio] = useState(() => {
    if (effectiveProjectId) {
      const saved = localStorage.getItem(`mapListRatio:${effectiveProjectId}`);
      if (saved) return parseFloat(saved);
    }
    return 0.6;
  });
  const mapResizeRef = useRef<{ startY: number; startRatio: number } | null>(null);
  const userCreatedTerminalRef = useRef(false);

  // Persist mapListRatio when it changes
  useEffect(() => {
    if (effectiveProjectId) {
      localStorage.setItem(`mapListRatio:${effectiveProjectId}`, String(mapListRatio));
    }
  }, [mapListRatio, effectiveProjectId]);

  // Load saved layout from DB — only restore if empty state (no terminals to auto-spawn)
  useEffect(() => {
    if (!window.deskflowAPI) { setLayoutLoading(false); return; }
    (async () => {
      try {
        const layouts = await window.deskflowAPI.getTerminalLayouts(effectiveProjectId || undefined);
        const active = layouts?.find((l: any) => l.is_active);
        if (!userCreatedTerminalRef.current && active?.layout_data) {
          const parsed = JSON.parse(active.layout_data);
          const leafIds = getLeafIds(parsed);
          // Only restore if no terminals would auto-spawn (empty layout)
          if (leafIds.length === 0) {
            setTerminalLayout(parsed);
          } else {
            setTerminalLayout(null);
          }
        } else {
          setTerminalLayout(null);
        }
      } catch { if (!userCreatedTerminalRef.current) setTerminalLayout(null); }
      setLayoutLoading(false);
    })();
  }, [effectiveProjectId, propProjectId]);

  // ── Cross-session conflict listener + notification ─────────────
  useEffect(() => {
    if (!window.deskflowAPI?.onFileConflict) return;
    const unsub = window.deskflowAPI.onFileConflict((data) => {
      setFileConflicts(prev => [...prev.slice(-9), { ...data, timestamp: Date.now() }]);
      setTerminalError(`Conflict: ${data.requestingTerminal} wants to edit ${data.filePath} (locked by ${data.lockingTerminal})`);
      setTerminalErrorType('warning');

      if (crossSessionSyncEnabled && data.requestingTerminal === activeTerminalId && window.deskflowAPI?.terminalWrite) {
        const msg = `[System: Conflict — ${data.filePath} is locked by ${data.lockingTerminal}. Wait for lock to expire (~60s) or coordinate with that session.]`;
        window.deskflowAPI.terminalWrite(activeTerminalId, msg + '\r\n');
      }
    });
    return unsub;
  }, [activeTerminalId, crossSessionSyncEnabled]);

  // ── Context sync listener — refresh + notify other terminals ──
  useEffect(() => {
    if (!window.deskflowAPI?.onContextChanged) return;
    const unsub = window.deskflowAPI.onContextChanged((data) => {
      if (data.source && data.source !== activeTerminalId && (data.type === 'problems' || data.type === 'requests')) {
        if (data.action === 'broadcast') {
          loadAllProblems?.();
          loadAllRequests?.();

          if (crossSessionSyncEnabled && window.deskflowAPI?.terminalWrite) {
            const typeLabel = data.type === 'problems' ? 'problem' : 'request';
            const actionLabel = data.action === 'created' ? 'created' : data.action === 'updated' ? 'updated' : 'modified';
            const title = data.entity?.title ? ` "${data.entity.title}"` : '';
            const msg = `[System: ${data.source} ${actionLabel} ${typeLabel}${title}. Run /sync for full context.]`;
            window.deskflowAPI.terminalWrite(activeTerminalId, msg + '\r\n');
          }
        }
      }
    });
    return unsub;
  }, [activeTerminalId, crossSessionSyncEnabled]);

  // ── Periodic file lock refresh ─────────────────────────────────
  useEffect(() => {
    if (!window.deskflowAPI?.getFileLocks) return;
    const refresh = () => {
      window.deskflowAPI!.getFileLocks!().then((locks) => {
        const byTerminal: Record<string, string[]> = {};
        for (const l of locks) {
          if (!byTerminal[l.terminalId]) byTerminal[l.terminalId] = [];
          byTerminal[l.terminalId].push(l.filePath);
        }
        setTerminalFileLocks(byTerminal);
      }).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Periodic touched files refresh ──────────────────────────────
  useEffect(() => {
    if (!window.deskflowAPI?.getTouchedFiles || !crossSessionSyncEnabled) { setTouchedFiles([]); return; }
    const refresh = () => {
      window.deskflowAPI!.getTouchedFiles!({ limit: 10 }).then((result) => {
        setTouchedFiles(result?.data || []);
      }).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [crossSessionSyncEnabled]);

  const saveLayout = useCallback((layout: PaneNode | null) => {
    if (!window.deskflowAPI) return;
    try {
      window.deskflowAPI.saveTerminalLayout({
        name: 'Default Layout',
        layoutData: layout ? JSON.stringify(layout) : '',
        isActive: true,
        projectId: effectiveProjectId || undefined,
      });
    } catch {}
  }, [effectiveProjectId]);

  const initializeTerminal = useCallback(async (terminalId: string, agent: string, resumeId?: string, initContent?: string, systemPrompt?: string, projectPath?: string) => {
    if (initializingTerminals.current.has(terminalId)) {
      console.log('[TerminalPage] Already initializing terminal:', terminalId);
      return;
    }
    initializingTerminals.current.add(terminalId);
    try {
      // ═══ VERIFY AGENT AVAILABILITY ═══
      if (window.deskflowAPI?.verifyAgent) {
        const verifyResult = await window.deskflowAPI.verifyAgent(agent);
        console.log('[RESUME-DBG] verifyAgent', agent, JSON.stringify(verifyResult));
        if (!verifyResult?.found) {
          if (agent !== 'opencode') {
            console.warn('[TerminalPage] Agent not found on PATH:', agent);
            showError(verifyResult?.installHint || `Agent '${agent}' not found. Install it and restart.`, 'warning');
            return;
          }
          console.log('[RESUME-DBG] Allowing opencode despite verifyAgent false-negative');
        }
      }

      // ═══ WAIT FOR TERMINAL READY ═══
      // Skip if terminal was just spawned — it's already ready
      try {
        await new Promise<void>((resolve) => {
          let done = false;
          const remover = window.deskflowAPI?.onTerminalReady?.((id: string) => {
            if (id === terminalId && !done) {
              done = true;
              remover?.();
              resolve();
            }
          });
          // Short timeout — terminal should be ready immediately after spawn
          setTimeout(() => { if (!done) { done = true; remover?.(); resolve(); } }, 500);
        });
      } catch {}
      console.log('[RESUME-DBG] terminal-ready wait complete for', terminalId);

      // small pause to let shell render
      await new Promise(r => setTimeout(r, 200));

      // [PUSHDOWN-FIX] Clear any existing scrollback before TUI launches
      // This prevents old shell output from appearing above the TUI
      try { await window.deskflowAPI.terminalWrite(terminalId, '\x1b[2J\x1b[H\x1b[3J'); } catch {}

      // ═══ VERIFY resumeId against opencode's session list ═══
      // If the stored id no longer exists in opencode, discard it and start fresh.
      // This is the single gate for ALL resume paths (new session, dialog, resume list).
      if (resumeId && resumeId.trim().length > 0) {
        try {
          const checkResult = await (window.deskflowAPI as any)?.checkSessionExists?.(resumeId);
          if (checkResult && !checkResult.exists) {
            console.log('[RESUME-DBG] Stored resumeId', resumeId, 'not found in opencode — starting fresh');
            resumeId = undefined;
          }
        } catch (e) {
          console.warn('[RESUME-DBG] Resume validation error, proceeding with resumeId:', e);
        }
      }

      // ═══ WRITE BANNER ═══
      let banner = `\r\n[resume] terminal ${terminalId} · looking up opencode session for ${projectPath || ''}…\r\n`;
      if (resumeId) {
        banner += `[resume] found opencode session ${resumeId} (source: db)\r\n`;
      } else {
        banner += `[resume] NO opencode session found — starting a FRESH session\r\n`;
      }
      (window.deskflowAPI as any)?.terminalWriteDisplay?.(terminalId, banner);

      // ═══ LAUNCH AGENT (fresh — no -s unless explicit resume) ═══
      const cdCmd = projectPath ? `cd "${projectPath}"\r\n` : '';
      let launchCommand: string;
      if (resumeId && resumeId.trim().length > 0) {
        // Use correct resume flag per agent type
        const resumeFlags: Record<string, string> = {
          opencode: '--resume',
          claude: '--resume',
          codex: '--session',
          gemini: '--resume',
        };
        let resumeCmd = `${agent} ${resumeFlags[agent] || '-s'} ${resumeId}`;
        try {
          const prefs = await window.deskflowAPI?.getPreferences?.();
          const templates: Record<string, string> = prefs?.agentResumeCommands || {};
          const template = templates[agent];
          if (template) {
            resumeCmd = template.replace('{agent}', agent).replace('{resumeId}', resumeId);
          }
        } catch {}
        launchCommand = `${cdCmd}${resumeCmd}\r\n`;
      } else {
        // Fresh launch — no resume flag, let agent create the session itself
        launchCommand = `${cdCmd}${agent}\r\n`;
      }
      const r2 = await window.deskflowAPI?.terminalWriteRaw?.(terminalId, launchCommand);
      console.log('[TerminalPage] Wrote launch command:', JSON.stringify(launchCommand), 'result:', r2);

      // ═══ WAIT FOR AGENT TO BE READY (capped so the UI never freezes) ═══
      // Per-agent timeout: Claude needs 5s (Node.js cold start), others 1.5s
      const readyTimeout = agent === 'claude' ? 5000 : 1500;
      await new Promise<void>((resolve) => {
        let done = false;
        const remover = window.deskflowAPI?.onAgentReady?.((data: { terminalId: string }) => {
          if (data.terminalId === terminalId && !done) {
            done = true;
            remover?.();
            resolve();
          }
        });
        setTimeout(() => { if (!done) { done = true; remover?.(); resolve(); } }, readyTimeout);
      });

      // ═══ CAPTURE REAL SESSION ID (up to 5s; strategy depends on agent) ═══
      // Primary: agent:session-id-captured event from the main-process output parser
      // (Ink TUIs: claude/gemini/codex print the id in their ANSI header).
      // Fallback: opencode never prints its session id — the PID-correlated DB lookup
      // is its PRIMARY path, run here after a short grace for the session row to appear.
      if (!resumeId) {
        try {
          const capturedSessionId = await new Promise<string | null>((resolve) => {
            let done = false;
            let captured: string | null = null;
            const removerSession = window.deskflowAPI?.onAgentSessionIdCaptured?.((data: { terminalId: string; sessionId: string }) => {
              if (data.terminalId === terminalId && !done) {
                done = true;
                captured = data.sessionId;
                removerSession?.();
                resolve(captured);
              }
            });
            setTimeout(async () => {
              if (!done) {
                done = true;
                removerSession?.();

                const agentConfig = await window.deskflowAPI?.getAgentConfig?.(agent);
                if (agentConfig?.sessionIdSource === 'db-pid') {
                  // OPENCODE PATH: PID-correlated DB lookup is the primary method.
                  const status = await window.deskflowAPI?.agentGetStatus?.(terminalId);
                  const fallback = await window.deskflowAPI?.captureOpencodeSessionId?.(
                    projectPath || '',
                    Date.now() - 10000,
                    status?.spawnedPid ?? undefined
                  );
                  if (fallback?.success && fallback.sessionId) {
                    captured = fallback.sessionId;
                    const dbSession = sessionsRef.current.find((s: any) => s.terminal_id === terminalId);
                    if (dbSession) {
                      await (window.deskflowAPI as any)?.updateSessionResumeId?.(dbSession.id, captured);
                      console.log('[TerminalPage] db-pid fallback captured opencode session:', captured, 'for terminal', terminalId);
                      loadSessions();
                    }
                  } else {
                    console.warn('[TerminalPage] opencode db lookup found no session yet:', fallback?.reason);
                  }
                } else {
                  // INK TUI PATH: output parsing already covered by the main process;
                  // if the event never fired within 5s the TUI simply didn't print it.
                  console.warn(`[TerminalPage] ${agent} did not output session ID within 5s.`);
                }
                resolve(captured);
              }
            }, 5000);
          });
          if (capturedSessionId) {
            const updateBanner = `\r\n[resume] captured real session ${capturedSessionId}\r\n`;
            (window.deskflowAPI as any)?.terminalWriteDisplay?.(terminalId, updateBanner);
          }
        } catch (e) {
          console.warn('[TerminalPage] Session ID capture failed:', e);
        }
      }

      // ═══ SETTLE ═══
      // opencode has no ready signal (never prints a session id, emits no
      // onAgentReady), so the generic 300ms wait is too short — the context/prompt
      // can land while opencode is still booting. For opencode we use a longer fixed
      // settle so the injected context lands after its TUI has initialized.
      // (A PTY "output idle" event would be ideal but requires main-process support
      // not currently wired; the longer delay is the robust, self-contained fix.)
      const settleMs = agent === 'opencode' ? 1800 : 300;
      await new Promise(r => setTimeout(r, settleMs));

      // ═══ HANDSHAKE REMOVED ═══
      // The bracketed-paste handshake was non-functional and added up to 10s of
      // blocking latency on every launch. Removed to keep startup responsive.

      // ═══ INITIAL CONTEXT (assembled brain / reflections) — inject if provided ═══
      // initContent is an assembled-context block (problems, brain memories, past
      // mistakes, selection captures). It is written into the agent's shell after
      // launch so the agent starts WITH prior-session context instead of "clean".
      if (initContent && initContent.trim() && window.deskflowAPI?.agentSend) {
        const sendResult = await window.deskflowAPI.agentSend(terminalId, initContent, agent);
        if (!sendResult?.success) {
          console.warn('[TerminalPage] Failed to send initial context block:', sendResult?.error);
        }
      }

      // ═══ SYSTEM PROMPT — Only send if explicitly provided (resume session) ═══
      // For fresh terminals, the agent starts clean. System prompt is sent
      // only when the user explicitly sends a message or resumes a session.
      const promptParts = systemPrompt ? [systemPrompt] : [];
      if (systemPrompt && promptParts.length > 0 && window.deskflowAPI?.agentSend) {
        const combined = promptParts.join('\n\n');
        const sendResult = await window.deskflowAPI.agentSend(terminalId, combined, agent);
        if (!sendResult?.success) {
          console.warn('[TerminalPage] Failed to send initialization prompt:', sendResult?.error);
        }
        // The backend will broadcast 'agent:write-verified' or 'agent:write-failed'
        // No need to block the renderer waiting for verification here.
      }
    } catch (e) {
      console.error('[TerminalPage] initializeTerminal failed:', e);
    } finally {
      initializingTerminals.current.delete(terminalId);
    }
  }, [thoughtProcessEnabled, showError, selectedProject, crossSessionSyncEnabled, modelDebugMode]);

  // Load all problems for binding dropdown
  const loadAllProblems = useCallback(async () => {
    if (!window.deskflowAPI || !selectedProject) return;
    try {
      const result = await window.deskflowAPI.getProblems(selectedProject);
      if (result?.success) setAllProblems(result.data || []);
    } catch (e) {
      console.error('[TerminalPage] Failed to load problems:', e);
    }
  }, [selectedProject]);

  // Load all requests for instruction panel
  const loadAllRequests = useCallback(async () => {
    if (!window.deskflowAPI || !selectedProject) return;
    try {
      const result = await window.deskflowAPI.getRequests?.(selectedProject);
      if (result?.success) setAllRequests(result.data || []);
    } catch (e) {
      console.error('[TerminalPage] Failed to load requests:', e);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      loadAllProblems();
      loadAllRequests();
    }
  }, [selectedProject, loadAllProblems, loadAllRequests]);

  // Listen for agent file changes (pulse notification)
  useEffect(() => {
    if (!window.deskflowAPI?.onAgentFileChanged) return;
    const cleanup = window.deskflowAPI.onAgentFileChanged(() => {
      setFileChangedPulse(true);
      setTimeout(() => setFileChangedPulse(false), 3000);
    });
    return () => cleanup?.();
  }, []);

  // Track terminal timeouts for retry overlay
  const [terminalTimeouts, setTerminalTimeouts] = useState<Record<string, boolean>>({});

  // Listen for agent init errors (launch failure recovery)
  useEffect(() => {
    if (!window.deskflowAPI?.onAgentInitError) return;
    const cleanup = window.deskflowAPI.onAgentInitError((data) => {
      setAgentInitErrors(prev => ({ ...prev, [data.terminalId]: data }));
    });
    return () => cleanup?.();
  }, []);

  // Clear false red init UI when the agent becomes ready
  useEffect(() => {
    if (!window.deskflowAPI?.onAgentReady) return;
    const cleanup = window.deskflowAPI.onAgentReady((data: { terminalId: string }) => {
      setAgentInitErrors(prev => {
        const next = { ...prev };
        delete next[data.terminalId];
        return next;
      });
      setTerminalTimeouts(prev => {
        const next = { ...prev };
        delete next[data.terminalId];
        return next;
      });
    });
    return () => cleanup?.();
  }, []);

  // [SESSION-ID] Real-time agent status sync (phase + sessionId + error)
  useEffect(() => {
    if (!window.deskflowAPI?.onAgentStatus) return;
    const cleanup = window.deskflowAPI.onAgentStatus((data: { terminalId: string; phase: string; sessionId?: string | null; error?: string | null }) => {
      setTerminalAgentStatus(prev => ({ ...prev, [data.terminalId]: { phase: data.phase, sessionId: data.sessionId, error: data.error } }));
      if (data.sessionId) {
        setTerminalCapturedSessionIds(prev => ({ ...prev, [data.terminalId]: data.sessionId! }));
      }
    });
    return () => cleanup?.();
  }, []);

  // [SESSION-ID] Session ID captured via output parser (persists to session row)
  useEffect(() => {
    if (!window.deskflowAPI?.onAgentSessionIdCaptured) return;
    const cleanup = window.deskflowAPI.onAgentSessionIdCaptured((data: { terminalId: string; sessionId: string }) => {
      setTerminalCapturedSessionIds(prev => ({ ...prev, [data.terminalId]: data.sessionId }));
      loadSessions();
    });
    return () => cleanup?.();
  }, []);

  const spawnTerminal = useCallback(async (terminalId: string, cwd?: string, agentType?: string, cols?: number, rows?: number) => {
    if (!window.deskflowAPI) {
      showError('Terminal API not available - cannot create terminal', 'error');
      return false;
    }
    try {
      const result = await window.deskflowAPI.spawnTerminal(terminalId, cwd || '', agentType, cols, rows);
      if (!result.success) {
        showError(`Failed to spawn shell: ${result.error || 'Unknown error'}`, 'error');
        return false;
      }
      return true;
    } catch (e) {
      console.error('[TerminalPage] spawnTerminal error:', e);
      showError(`Terminal creation failed: ${(e as any).message}`, 'error');
      return false;
    }
  }, [showError]);

  // Listen for agent timeouts
  useEffect(() => {
    if (!window.deskflowAPI?.onAgentTimeout) return;
    const cleanup = window.deskflowAPI.onAgentTimeout((data: { terminalId: string }) => {
      setTerminalTimeouts(prev => ({ ...prev, [data.terminalId]: true }));
    });
    return () => cleanup?.();
  }, []);

  // Listen for conductor spawn requests
  useEffect(() => {
    if (!(window.deskflowAPI as any)?.onConductorSpawnTerminal) return;
    const cleanup = (window.deskflowAPI as any).onConductorSpawnTerminal((data: { terminalId: string; cwd: string; cols: number; rows: number; agentType?: string }) => {
      const exists = terminalTabsRef.current?.some(t => t.id === data.terminalId);
      if (exists) return;
      setTerminalTabs(prev => [...prev, {
        id: data.terminalId,
        name: `⚡${data.agentType || 'agent'}`,
        sessionTopic: `Conductor: ${data.terminalId}`,
        agent: data.agentType || 'claude',
        cwd: data.cwd,
        terminalType: 'agent',
      }]);
      spawnTerminal(data.terminalId, data.cwd, data.agentType);
    });
    return () => cleanup?.();
  }, [spawnTerminal]);

  // Build agentStatuses for TerminalLayout overlay
  const agentStatuses = useMemo(() => {
    const result: Record<string, 'spawning' | 'waiting' | 'ready' | 'timeout'> = {};
    for (const tid of Object.keys(terminalTimeouts)) {
      result[tid] = 'timeout';
    }
    return result;
  }, [terminalTimeouts]);

  // Load terminal bindings
  const loadTerminalBindings = useCallback(async () => {
    if (!window.deskflowAPI) return;
    try {
      const result = await window.deskflowAPI.getTerminalBindings();
      if (result?.success) {
        const bindingsMap: typeof terminalBindings = {};
        for (const b of result.data || []) {
          bindingsMap[b.terminal_id] = {
            terminalId: b.terminal_id,
            projectId: b.project_id,
            activeProblemId: b.active_problem_id,
            status: b.status,
            agentType: b.agent_type
          };
        }
        setTerminalBindings(bindingsMap);
      }
    } catch (e) {
      console.error('[TerminalPage] Failed to load terminal bindings:', e);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    if (!window.deskflowAPI) return;
    try {
      const data = await window.deskflowAPI.getTerminalSessions(selectedProject || undefined, 20);
      setSessions(data || []);
    } catch (e) {
      logOnce('terminal-sessions', '[TerminalPage] Failed to load sessions:', e);
    }
  }, [selectedProject]);

  // Register terminal with binding
  const registerTerminal = useCallback(async (terminalId: string, agentType?: string) => {
    if (!window.deskflowAPI) return;
    try {
      await window.deskflowAPI.registerTerminal({
        terminalId,
        projectId: selectedProject || undefined,
        agentType: agentType || 'claude',
        status: 'active'
      });
      setActiveTerminalId(terminalId);
      loadTerminalBindings();
    } catch (e) {
      console.error('[TerminalPage] Failed to register terminal:', e);
    }
  }, [selectedProject, loadTerminalBindings]);

  const systemPromptLayers = useMemo(() => {
    const layers: Array<{ label: string; content: string; color: string }> = [];
    layers.push({ label: 'Default', content: DEFAULT_SYSTEM_PROMPT || '', color: 'text-cyan-400' });
    const generalAdditions = preferences?.systemPrompts?.generalAdditions || '';
    if (generalAdditions.trim()) {
      layers.push({ label: 'General', content: generalAdditions, color: 'text-blue-400' });
    }
    const projectPrompt = preferences?.systemPrompts?.[selectedProject || ''] || '';
    if (projectPrompt.trim()) {
      layers.push({ label: 'Project', content: projectPrompt, color: 'text-purple-400' });
    }
    return layers;
  }, [preferences, selectedProject]);

  // Send instruction from InstructionPanel (with problem/request/skill data)
  const handleInstructionPanelSend = useCallback(async (config: {
    problems: string[];
    requests: string[];
    skills?: string[];
    instruction: string;
    prompt: string;
    systemPromptIncluded?: boolean;
    agent?: string;
  }) => {
    if (!window.deskflowAPI || !config.prompt.trim() || isSending) return;
    setIsSending(true);
    setShowInstructionPanel(false);
    try {
      // ── 1. Resolve target terminal ──────────────────���───────
      let resolvedTargetId = activeTerminalId || '';
      if (!resolvedTargetId && sendTargetSession) {
        const targetSession = sessions.find(s => s.id === sendTargetSession);
        if (targetSession?.terminal_id) {
          resolvedTargetId = targetSession.terminal_id;
        }
      }
      if (!resolvedTargetId) {
        showError('No terminal available for this session.', 'error');
        return;
      }

      // /sync command — compile cross-session context summary
      if (config.prompt.trim().toLowerCase() === '/sync') {
        const syncResult = await window.deskflowAPI.compileSyncSummary(resolvedTargetId);
        if (syncResult?.success && syncResult.summary) {
          const agentType = config.agent || existingSession?.agent || 'claude';
          const sendResult = await window.deskflowAPI.agentSend?.(resolvedTargetId, syncResult.summary, agentType);
          if (sendResult && !sendResult.success) {
            showError(`Sync write failed: ${sendResult.error || 'Unknown'}`, 'error');
          } else {
            showError('Cross-session context synced', 'info');
          }
        } else {
          showError(syncResult?.error || 'Sync failed', 'error');
        }
        return;
      }

      const proj = projects.find(p => p.id === selectedProject);
      const cwd = proj?.path || undefined;

      // ── 2. Build meaningful topic ───────────────────────────
      const instructionText = config.instruction?.trim();
      let topic: string;
      if (instructionText && instructionText.length > 0) {
        topic = instructionText.replace(/\n/g, ' ').trim();
        if (topic.length > 60) topic = topic.substring(0, 57) + '...';
      } else {
        const parts: string[] = [];
        if (config.problems.length > 0) parts.push(`${config.problems.length}p`);
        if (config.requests.length > 0) parts.push(`${config.requests.length}r`);
        if (config.skills && config.skills.length > 0) parts.push(`${config.skills.length}s`);
        topic = parts.length > 0 ? `Instruction: ${parts.join(' ')}` : 'Quick instruction';
      }

      // ── 3. Generate session ID ──────────────────────────────
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // ── 4. Save session BEFORE terminal write ───────────────
      const existingSession = sessions.find(s => s.terminal_id === resolvedTargetId || s.id === resolvedTargetId);
      const sessionPayload: any = {
        id: existingSession?.id || sessionId,
        projectId: selectedProject,
        agent: existingSession?.agent || 'claude',
        resumeId: undefined,
        terminalId: resolvedTargetId,
        topic,
        workingDirectory: cwd || '',
        description: instructionText || undefined,
      };
      try {
        const saveResult = await window.deskflowAPI?.saveTerminalSession?.(sessionPayload);
        if (!saveResult?.success) {
          console.error('[InstructionSend] Session save failed:', saveResult);
        }
      } catch (err) {
        console.error('[InstructionSend] Session save exception:', err);
      }

      // ── 4b. Brain + memory context assembly ────────────────────
      // Retrieve context Brain memories about the topic before sending the prompt
      let assembledContextSnippet = '';
      if (selectedProject && topic.length > 1) {
        try {
          const assembled = await (window.deskflowAPI as any).assembleContext?.({
            projectId: selectedProject,
            sessionId: sessionPayload.id,
            topic,
            tokenBudget: 2000,
          });
          if (assembled && typeof assembled === 'string' && assembled.trim()) {
            assembledContextSnippet = `\r\n${assembled}\r\n`;
          }
        } catch (e) {
          console.warn('[InstructionSend] Context assembly failed (non-fatal):', e);
        }
      }

      // Write context to terminal before prompt so agent sees it
      if (assembledContextSnippet) {
        try {
          await (window.deskflowAPI as any).terminalWriteRaw?.(resolvedTargetId, assembledContextSnippet);
        } catch (e) {
          console.warn('[InstructionSend] Context write failed (non-fatal):', e);
        }
      }

      // ── 5. Send prompt to agent ────────────────────────────
      try {
        const sendResult = await window.deskflowAPI?.agentSend?.(resolvedTargetId, config.prompt, config.agent || existingSession?.agent || 'claude');
        if (sendResult && !sendResult.success) {
          showError(`Terminal not responding: ${sendResult.error || 'Unknown error'}`, 'error');
          return;
        }
      } catch (err) {
        console.error('[InstructionSend] agentSend failed:', err);
        return;
      }

      // ── 6. Update terminal binding ──────────────────────────
      try {
        await window.deskflowAPI?.updateTerminalBinding?.({
          terminalId: resolvedTargetId,
          updates: {
            active_problem_id: config.problems[0] || null,
            session_context: JSON.stringify({
              problems: config.problems,
              requests: config.requests,
              skills: config.skills,
              systemPromptIncluded: config.systemPromptIncluded,
            }),
          },
        });
      } catch (err) {
        console.error('[InstructionSend] Binding update failed:', err);
      }

      // ── 7. Background capture real opencode session ID ──────
      if (cwd && !config.resumeId) {
        const savedSessionId = existingSession?.id || sessionId;
        (async () => {
          await new Promise(r => setTimeout(r, 5000));
          try {
            if (!window.deskflowAPI) return;
            const capResult = await (window.deskflowAPI as any).captureOpencodeSessionId?.(cwd, Date.now() - 10000);
            if (capResult?.success && capResult.sessionId) {
              await (window.deskflowAPI as any).updateSessionResumeId?.(savedSessionId, capResult.sessionId);
              console.log('[InstructionSend] Captured opencode session:', capResult.sessionId, 'for', cwd);
              loadSessions();
              const updateBanner = `\r\n[resume] captured real opencode session ${capResult.sessionId} (source: db)\r\n`;
              (window.deskflowAPI as any)?.terminalWriteDisplay?.(resolvedTargetId, updateBanner);
            } else {
              console.log('[InstructionSend] No opencode session found yet for', cwd, capResult?.reason);
            }
          } catch (e) {
            console.warn('[InstructionSend] Background capture failed:', e);
          }
        })();
      }

      // ── 8. Feedback ─────────────────────────────────────────
      loadTerminalBindings();
      loadSessions();
      const toastMsg = `Sent to terminal (${config.problems.length} problems, ${config.requests.length} requests)`;
      showError(toastMsg, 'info');
    } catch (e) {
      console.error('[TerminalPage] Failed to send instruction:', e);
      showError(`Failed to send: ${(e as any).message}`, 'error');
    } finally {
      setIsSending(false);
    }
  }, [activeTerminalId, sendTargetSession, sessions, showError, isSending, selectedProject, projects, loadSessions, loadTerminalBindings]);

  // Send instruction to terminal
  const handleSendToTerminal = useCallback(async (terminalId: string, message: string, agentType?: string) => {
    const result = await window.deskflowAPI.agentSend(terminalId, message, agentType);
    if (result && !result.success) {
      showError(`Terminal not responding: ${result.error || 'Unknown error'}`, 'error');
      return false;
    }
    setInstructionText('');
    setMentionDropdown(prev => ({ ...prev, visible: false }));
    setShowInstructionInput(false);
    if (terminalId !== activeTerminalId) {
      showError(`Sent to ${Object.entries(terminalTabs).find(([id]) => id === terminalId)?.[1]?.name || 'terminal'}`, 'info');
    }
    if (autoAssignConfig?.enabled) {
      const session = sessions.find((s: any) => s.terminal_id === terminalId);
      if (session) {
        window.deskflowAPI?.updateSessionSummary?.({ sessionId: session.id }).catch(() => {});
      }
    }
    return true;
  }, [activeTerminalId, instructionText, terminalTabs, showError, autoAssignConfig, sessions]);

  const handleRetryAgentInit = useCallback(async (terminalId: string, agentType: string) => {
    setAgentInitErrors(prev => { const n = { ...prev }; delete n[terminalId]; return n; });
    setTerminalTimeouts(prev => { const n = { ...prev }; delete n[terminalId]; return n; });
    if (window.deskflowAPI?.retryAgentLaunch) {
      await window.deskflowAPI.retryAgentLaunch(terminalId, agentType);
    }
    await initializeTerminal(terminalId, agentType);
  }, [initializeTerminal]);

  const handleCreateNewSession = useCallback(async (name?: string, summary?: string, prompt?: string) => {
    try {
      // Use selected project, or fallback to first available project
      const activeProjectId = selectedProject || projects[0]?.id || '';
      const proj = projects.find(p => p.id === activeProjectId);
      const newTerminalId = generateTerminalId();
      const cwd = proj?.path || '';
      
      if (!cwd) {
        showError('No project path available. Please select a project with a valid path.', 'warning');
        return null;
      }
      
      // ═══ CREATE UI ═══
      setTerminalTabs(prev => ({ ...prev, [newTerminalId]: { name: name || 'New Session', agent: newSessionAgent, modelTier: 'mid' } }));
      setActiveTerminalId(newTerminalId);
      const updatedLayout = insertIntoLayout(terminalLayout, newTerminalId);
      setTerminalLayout(updatedLayout);
      saveLayout(updatedLayout);
      
      // ═══ SPAWN PTY ═══
      if (!window.deskflowAPI?.spawnTerminal) {
        showError('Terminal API not available', 'error');
        return null;
      }
      const spawnResult = await window.deskflowAPI.spawnTerminal(newTerminalId, cwd, newSessionAgent);
      if (!spawnResult?.success) {
        showError(`Failed to spawn terminal: ${spawnResult?.error}`, 'error');
        return null;
      }
      window.dispatchEvent(new CustomEvent('terminal:mark-spawned', { detail: { terminalId: newTerminalId } }));
      
      // ═══ INITIALIZE AGENT ═══
      await registerTerminal(newTerminalId, newSessionAgent);

      // Assemble prior-session context (brain memories, reflections, problems) so a
      // fresh session is NOT "clean". Derived topic = session name (best available
      // signal at spawn time); assemble-context injects brain/reflection blocks when
      // a topic is present. Falls back silently if assembly fails.
      let initialContext = '';
      try {
        const topic = (name || 'New Session').trim();
        const assembled = await (window.deskflowAPI as any).assembleContext?.({
          projectId: selectedProject,
          topic,
          tokenBudget: 2500,
        });
        if (assembled && typeof assembled === 'string' && assembled.trim()) {
          initialContext = assembled;
        } else if (assembled && assembled.context && typeof assembled.context === 'string') {
          initialContext = assembled.context;
        }
      } catch (e) {
        console.warn('[handleCreateNewSession] context assembly failed (non-fatal):', e);
      }

      await initializeTerminal(newTerminalId, newSessionAgent, undefined, initialContext || undefined, undefined, cwd);

      // ═══ WRITE USER PROMPT ═══
      if (prompt && prompt.trim()) {
        const writeResult = await window.deskflowAPI?.agentSend?.(newTerminalId, prompt, newSessionAgent);
        if (!writeResult?.success) {
          console.error('[handleCreateNewSession] Failed to write prompt:', writeResult?.error);
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      // ═══ SAVE SESSION ═══
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const subtab = localStorage.getItem(`workspace-subtab-${activeGroup}`) || 'sessions';
      const savePayload: any = {
        id: sessionId,
        projectId: selectedProject,
        agent: newSessionAgent,
        terminalId: newTerminalId,
        topic: name || 'New Session',
        workingDirectory: cwd,
        description: summary || '',
        autoNamed: 1,
        subpage: `${activeGroup}/${subtab}`,
      };
      const saveResult = await window.deskflowAPI?.saveTerminalSession?.(savePayload);
      if (!saveResult?.success) {
        console.error('[handleCreateNewSession] Failed to save session:', saveResult?.error);
        showError(`Session save failed: ${saveResult?.error}`, 'warning');
      }
      const capturedSessionId = sessionId;
      
      // ═══ BACKGROUND CAPTURE opencode session ID ═══
      if (cwd) {
        (async () => {
          await new Promise(r => setTimeout(r, 5000));
          try {
            if (!window.deskflowAPI) return;
            const capResult = await (window.deskflowAPI as any).captureOpencodeSessionId?.(cwd, Date.now() - 10000);
            if (capResult?.success && capResult.sessionId) {
              await (window.deskflowAPI as any).updateSessionResumeId?.(capturedSessionId, capResult.sessionId);
              console.log('[TerminalPage] Captured opencode session:', capResult.sessionId, 'for', cwd);
              loadSessions();
              // write banner to terminal
              const updateBanner = `\r\n[resume] captured real opencode session ${capResult.sessionId} (source: db)\r\n`;
              (window.deskflowAPI as any)?.terminalWriteDisplay?.(newTerminalId, updateBanner);
            } else {
              console.log('[TerminalPage] No opencode session found yet for', cwd, capResult?.reason);
            }
          } catch (e) {
            console.warn('[TerminalPage] Background capture failed:', e);
          }
        })();
      }
      
      loadSessions();
      return newTerminalId;
    } catch (err) {
      console.error('[handleCreateNewSession] Unexpected error:', err);
      showError(`Session creation failed: ${(err as any).message}`, 'error');
      return null;
    }
  }, [projects, selectedProject, terminalLayout, loadSessions, registerTerminal, initializeTerminal, saveLayout, showError]);

  const sendInstruction = useCallback(async () => {
    if (!window.deskflowAPI || !instructionText.trim() || isSending) return;
    setIsSending(true);
    try {
      // Auto-assign routing (ONLY if no @term mention and feature is enabled)
      if (autoAssignConfig?.enabled && !instructionText.includes('@')) {
        setIsRouting(true);
        setPendingPrompt(instructionText);
        try {
          const result = await window.deskflowAPI?.routePrompt?.({ prompt: instructionText });
          if (result && result.action === 'route' && result.confidence != null) {
            if (result.confidence >= 0.7) {
              // High confidence — auto-send
              await handleSendToTerminal(result.terminalId!, instructionText);
              return;
            } else if (result.confidence >= 0.4) {
              // Medium — show toast with 3s cancel window
              setRoutingToastSession(result.sessionName || 'Session');
              setShowRoutingToast(true);
              setRoutingResult(result);
              // Don't return yet — toast will auto-confirm or cancel
              // Fall through to prevent double-send from existing flow
              return;
            } else {
              // Low — show disambiguation
              setDisambiguationCandidates([{
                sessionId: result.sessionId!,
                sessionName: result.sessionName || 'Session',
                summary: result.reason || '',
                confidence: result.confidence,
              }]);
              setShowDisambiguation(true);
              setRoutingResult(result);
              return;
            }
          } else if (result?.action === 'create_new') {
            await handleCreateNewSession(result.suggestedName || 'New Session', result.suggestedSummary || '', instructionText);
            return;
          }
          // action === 'manual' or unknown — fall through to existing flow
        } catch (err) {
          console.error('[AutoAssign] Routing failed, falling back:', err);
          // Fall through to existing flow
        } finally {
          setIsRouting(false);
        }
      }

      // Check for @mention first
      let resolvedTargetId = activeTerminalId;
      let resolvedMessage = instructionText;
      if (instructionText.includes('@')) {
        const tabs = Object.entries(terminalTabs).map(([id, t]) => ({ id, name: t.name }));
        const mentionResult = await window.deskflowAPI.resolveAtMention({ input: instructionText, terminalTabs: tabs });
        if (mentionResult.resolved && mentionResult.terminalId) {
          resolvedTargetId = mentionResult.terminalId;
          resolvedMessage = mentionResult.message;
        }
      }
      // Fallback: from sendTargetSession, or activeTerminalId
      if (!resolvedTargetId && sendTargetSession) {
        const targetSession = sessions.find(s => s.id === sendTargetSession);
        if (targetSession?.terminal_id) {
          resolvedTargetId = targetSession.terminal_id;
        }
      }
      if (!resolvedTargetId) {
        showError('No terminal available for this session. Open a session first.', 'error');
        return;
      }
      // Prepend quoted references as context
      if (quotedReferences.length > 0) {
        const refBlock = quotedReferences
          .map(r => `[Referenced ${r.role} message${r.createdAt ? ` (${new Date(r.createdAt).toLocaleTimeString()})` : ''}]: ${r.content}`)
          .join('\n---\n');
        resolvedMessage = `Context from session messages:\n${refBlock}\n\n---\n${resolvedMessage}`;
      }
      const targetAgent = terminalTabs[resolvedTargetId]?.agent;
      const sendOk = await handleSendToTerminal(resolvedTargetId, resolvedMessage, targetAgent);
      if (sendOk === false) return;
      setInstructionText('');
      setQuotedReferences([]);
      setMentionDropdown(prev => ({ ...prev, visible: false }));
      setShowInstructionInput(false);
      if (resolvedTargetId !== activeTerminalId) {
        showError(`Sent to ${Object.entries(terminalTabs).find(([id]) => id === resolvedTargetId)?.[1]?.name || 'terminal'}`, 'info');
      }
    } catch (e) {
      console.error('[TerminalPage] Failed to send instruction:', e);
      showError(`Failed to send: ${(e as any).message}`, 'error');
    } finally {
      setIsSending(false);
    }
  }, [activeTerminalId, instructionText, isSending, showError, sendTargetSession, sessions, terminalTabs, autoAssignConfig, handleSendToTerminal, handleCreateNewSession, quotedReferences]);

  // Routing confirm/cancel/disambiguation handlers
  const handleRoutingConfirm = useCallback(async () => {
    setShowRoutingToast(false);
    if (routingResult?.terminalId && pendingPrompt) {
      await handleSendToTerminal(routingResult.terminalId, pendingPrompt);
    }
    setPendingPrompt(null);
    setRoutingResult(null);
  }, [routingResult, pendingPrompt, handleSendToTerminal]);

  const handleRoutingCancel = useCallback(() => {
    setShowRoutingToast(false);
    setPendingPrompt(null);
    setRoutingResult(null);
  }, []);

  const handleDisambiguationSelect = useCallback(async (sessionId: string) => {
    setShowDisambiguation(false);
    const session = sessions.find((s: any) => s.id === sessionId);
    if (session?.terminal_id && pendingPrompt) {
      await handleSendToTerminal(session.terminal_id, pendingPrompt);
    }
    setPendingPrompt(null);
  }, [sessions, pendingPrompt, handleSendToTerminal]);

  const handleDisambiguationCreateNew = useCallback(async (name: string) => {
    setShowDisambiguation(false);
    if (pendingPrompt) {
      await handleCreateNewSession(name, pendingPrompt.substring(0, 120), pendingPrompt);
    }
    setPendingPrompt(null);
  }, [pendingPrompt, handleCreateNewSession]);

  const loadPresets = useCallback(async () => {
    if (!window.deskflowAPI) return;
    try {
      const data = await window.deskflowAPI.getTerminalPresets(selectedProject || undefined);
      const builtIn: Preset[] = [
        { id: 'builtin-remind', name: 'Remind', command: '', category: 'system', isBuiltIn: true },
      ];
      setPresets([...builtIn, ...(data || [])]);
    } catch (e) {
      logOnce('terminal-presets', '[TerminalPage] Failed to load presets:', e);
    }
  }, [selectedProject]);

  const fetchAnalyticsData = useCallback(async () => {
    if (!window.deskflowAPI) return;
    setAnalyticsLoading(true);
    try {
      const periodMap: Record<string, string> = { '7d': 'week', '30d': 'month', 'all': 'all' };
      const p = periodMap[analyticsPeriod] || 'week';
      const now = new Date();
      const cutoffDate = analyticsPeriod === '7d' ? new Date(now.getTime() - 7 * 864e5).toISOString()
        : analyticsPeriod === '30d' ? new Date(now.getTime() - 30 * 864e5).toISOString()
        : null;
      const inPeriod = (dateStr: string | null | undefined) => !cutoffDate || (!!dateStr && dateStr >= cutoffDate);
      const [aiResult, problemsResult, requestsResult, historyResult, dailyResult, codeStatsResult] = await Promise.all([
        window.deskflowAPI.getAIUsageSummary(p, 0, selectedProject || undefined),
        window.deskflowAPI.getProblems(selectedProject, propProjectPath).catch(() => null),
        window.deskflowAPI.getRequests(selectedProject).catch(() => null),
        window.deskflowAPI.getPromptHistory({ projectId: selectedProject, limit: 500 }).catch(() => null),
        window.deskflowAPI.getDailyAggregates().catch(() => null),
        window.deskflowAPI.getCodeChangeStats?.(p, 0, selectedProject || undefined).catch(() => null),
      ]);
      if (aiResult) setAiSummary(aiResult);
      if (codeStatsResult) setAnalyticsCodeStats(codeStatsResult);
      if (problemsResult) {
        const items = Array.isArray(problemsResult) ? problemsResult : problemsResult?.data || [];
        setAnalyticsProblems(items.filter((r: any) => inPeriod(r.created_at)));
      }
      if (requestsResult) {
        const items = Array.isArray(requestsResult) ? requestsResult : requestsResult?.data || [];
        setAnalyticsRequests(items.filter((r: any) => inPeriod(r.created_at)));
      }
      if (historyResult) {
        const items = Array.isArray(historyResult) ? historyResult : historyResult?.data || [];
        setAnalyticsPromptHistory(items.filter((r: any) => inPeriod(r.sent_at)));
      }
      if (dailyResult) {
        const items = Array.isArray(dailyResult) ? dailyResult : dailyResult?.data || [];
        setAnalyticsDailyStats(items.filter((r: any) => inPeriod(r.date)));
      }
    } catch (err) {
      console.error('[TerminalPage] Analytics fetch error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsPeriod, selectedProject, propProjectPath]);

  const loadProjects = useCallback(async () => {
    if (!window.deskflowAPI) return;
    try {
      const data = await window.deskflowAPI.getProjects();
      setProjects(data || []);
      if (data && data.length > 0 && !localStorage.getItem('terminal-project')) {
        setSelectedProject(data[0].id);
      }
    } catch (e) {
      logOnce('terminal-projects', '[TerminalPage] Failed to load projects:', e);
    }
  }, []);

  // Save session checkpoint - opens dialog for naming
  const handleSaveCheckpoint = useCallback(() => {
    if (!activeTerminalId || !window.deskflowAPI) return;
    const session = sessions.find(s => s.terminal_id === activeTerminalId || s.id === activeTerminalId);
    setSaveDialogName(session?.topic || `Checkpoint ${new Date().toLocaleString()}`);
    setShowSaveDialog(true);
  }, [activeTerminalId, sessions]);

  const handleSaveCheckpointSubmit = useCallback(async () => {
    if (!activeTerminalId || !window.deskflowAPI || !saveDialogName.trim()) return;
    setShowSaveDialog(false);
    try {
      const proj = projects.find(p => p.id === selectedProject);
      const session = sessions.find(s => s.terminal_id === activeTerminalId || s.id === activeTerminalId);
      const result = await window.deskflowAPI.saveTerminalSession?.({
        id: session?.id || `checkpoint-${Date.now()}`,
        projectId: selectedProject,
        agent: session?.agent || 'claude',
        resumeId: session?.resume_id || activeTerminalId,
        terminalId: activeTerminalId,
        topic: saveDialogName.trim(),
        workingDirectory: proj?.path || '',
        totalTokens: session?.total_tokens || 0,
        totalCost: session?.total_cost || 0,
      });
      if (result?.success) {
        loadSessions();
        showError(`Checkpoint saved: "${saveDialogName.trim()}"`, 'info');
      } else {
        showError('Failed to save checkpoint', 'error');
      }
    } catch (e) {
      console.error('[TerminalPage] Failed to save session checkpoint:', e);
      showError('Failed to save session', 'error');
    }
  }, [activeTerminalId, selectedProject, projects, sessions, saveDialogName, showError, loadSessions]);

   // Resize sidebar
   const startResize = useCallback((e: React.MouseEvent) => {
     e.preventDefault();
     setIsResizing(true);
     const startX = e.clientX;
     const startWidth = sidebarWidth;
     
     const handleMouseMove = (e: MouseEvent) => {
       const delta = startX - e.clientX;
       const newWidth = Math.max(200, startWidth + delta);
       setSidebarWidth(newWidth);
     };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    loadTerminalBindings();
  }, [loadTerminalBindings]);

  useEffect(() => {
    const interval = setInterval(loadTerminalBindings, 5000);
    return () => clearInterval(interval);
  }, [loadTerminalBindings]);

  useEffect(() => {
    loadProjects();
    // Load project from localStorage if no propProjectId
    if (!propProjectId) {
      const stored = localStorage.getItem('terminal-project');
      if (stored) {
        setSelectedProject(stored);
      }
    }
  }, [loadProjects]);

  useEffect(() => {
    if (activeGroup === 'setup') {
      loadPresets();
    } else if (activeGroup === 'work') {
      loadSessions();
    } else if (activeGroup === 'insights' && window.deskflowAPI) {
      fetchAnalyticsData();
      loadSessions();
    }
  }, [activeGroup, selectedProject, loadPresets, loadSessions, analyticsPeriod, fetchAnalyticsData]);

  // Load auto-assign config on mount
  useEffect(() => {
    window.deskflowAPI?.getAutoAssignConfig?.().then(setAutoAssignConfig);
  }, []);

  // Load routing costs when Configs tab is active
  const loadRoutingCosts = useCallback(async () => {
    try { const costs = await window.deskflowAPI?.getRoutingCosts?.(); setRoutingCosts(costs); } catch {}
  }, []);
  const [routingCosts, setRoutingCosts] = useState<any>(null);
  useEffect(() => {
    if (activeGroup === 'setup') {
      loadRoutingCosts();
      window.deskflowAPI?.getAutoAssignConfig?.().then(setAutoAssignConfig);
    }
  }, [activeGroup, loadRoutingCosts]);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('terminal-activeGroup', activeGroup);
  }, [activeGroup]);

  // Persist sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('terminal-sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // Persist selected project to localStorage
  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('terminal-project', selectedProject);
    }
  }, [selectedProject]);

  // Auto-select send target session when active terminal changes
  useEffect(() => {
    if (activeTerminalId) {
      const sessionForTerminal = sessions.find(s => s.terminal_id === activeTerminalId);
      if (sessionForTerminal) {
        setSendTargetSession(sessionForTerminal.id);
      }
    }
  }, [activeTerminalId, sessions]);



  // Load workspace state on mount (for propProjectPath mode)
  useEffect(() => {
    const wsProjectId = propProjectId || selectedProject;
    if (!wsProjectId || !window.deskflowAPI?.loadWorkspace) return;
    window.deskflowAPI.loadWorkspace({ scope: 'project', projectId: wsProjectId }).then((result: any) => {
      if (result?.success && result.data) {
        if (result.data.name) setWorkspaceName(result.data.name);
        if (result.data.sidebarWidth) setSidebarWidth(result.data.sidebarWidth);
        if (result.data.activeTab) setActiveGroup(result.data.activeTab);
        if (result.data.analyticsPeriod) setAnalyticsPeriod(result.data.analyticsPeriod);
        if (result.data.sessionCategoryFilter) setSessionCategoryFilter(result.data.sessionCategoryFilter);
        if (result.data.sessionAgentFilter) setSessionAgentFilter(result.data.sessionAgentFilter);
      }
    }).catch(() => {});
  }, [propProjectId, selectedProject]);

  // Track terminals currently being initialized (prevent duplicate init calls)
  const initializingTerminals = useRef(new Set<string>());
  const sessionTerminalsRef = useRef(new Set<string>());

  // Save workspace state on relevant changes (debounced)
  const saveWorkspaceDebounce = useRef<NodeJS.Timeout | null>(null);
  const isRestoringRef = useRef(false);

  // Track unsaved workspace changes for beforeunload + navigation guard
  const hasUnsavedChanges = useMemo(() => Object.keys(terminalTabs).length > 0, [terminalTabs]);

  useEffect(() => {
    (window as any).__workspaceHasUnsavedChanges = hasUnsavedChanges;
    return () => { (window as any).__workspaceHasUnsavedChanges = false; };
  }, [hasUnsavedChanges]);

  // beforeunload handler — warns if terminals are open
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const handleSaveWorkspace = useCallback(async (name?: string) => {
    const wsProjectId = propProjectId || selectedProject;
    if (!wsProjectId || !window.deskflowAPI?.saveWorkspace) return;
    try {
      const saveName = name || workspaceName || 'default';
      const terminalInfo = Object.fromEntries(
        Object.entries(terminalTabs).map(([id, info]) => [id, { name: info.name, agent: info.agent, modelTier: info.modelTier }])
      );

      // Export terminal scrollback for each open terminal
      const scrollbackData: Record<string, string> = {};
      const exportFn = (window as any).__terminalExportScrollback;
      if (exportFn) {
        for (const terminalId of Object.keys(terminalTabs)) {
          if (exportFn[terminalId]) {
            try { scrollbackData[terminalId] = exportFn[terminalId](); } catch {}
          }
        }
      }

      const activeSubtabs: Record<string, string> = {};
      try {
        for (const key of ['setup', 'work', 'insights', 'studio', 'conductor', 'ai-gateway', 'context']) {
          const v = localStorage.getItem(`workspace-subtab-${key}`);
          if (v) activeSubtabs[key] = v;
        }
      } catch {}
      // Include session details for the workspace
      const sessionDetails = sessions.slice(0, 50).map(s => ({
        id: s.id,
        topic: s.topic,
        agent: s.agent,
        status: s.status,
        category: s.category,
        terminal_id: s.terminal_id,
        created_at: s.created_at,
      }));
      const result = await window.deskflowAPI.saveWorkspace({
        projectId: wsProjectId,
        name: saveName,
        scope: 'project',
        activeTab: activeGroup,
        terminalTabs: Object.keys(terminalTabs),
        terminalInfo,
        sessionDetails,
        scrollbackData,
        layout: terminalLayout,
        activeTerminalId,
        presets,
        analyticsPeriod,
        sessionCategoryFilter,
        sessionAgentFilter,
        activeSubtabs,
        configs: {
          modelReinjectThreshold,
          modelDefaultTier,
          modelDebugMode,
          crossSessionSyncEnabled: localStorage.getItem('cross-session-sync-enabled') === 'true',
          fileLockTTL: Number(localStorage.getItem('file-lock-ttl')) || 30000,
          contextBroadcastEnabled: localStorage.getItem('context-broadcast-enabled') === 'true',
          conflictWarningMode: localStorage.getItem('conflict-warning-mode') || 'all',
          syncCommandEnabled: localStorage.getItem('sync-command-enabled') === 'true',
          thoughtProcessEnabled: localStorage.getItem('thought-process-enabled') === 'true',
        },
        mapListRatio: Number(localStorage.getItem(`mapListRatio:${wsProjectId}`)) || 50,
      });
      if (result?.success) {
        setWorkspaceName(saveName);
        showError(`Workspace "${saveName}" saved`, 'info');
      } else {
        showError(result?.error || 'Failed to save workspace', 'error');
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to save workspace', 'error');
    }
  }, [propProjectId, selectedProject, workspaceName, activeGroup, terminalTabs, terminalLayout, activeTerminalId, presets, sessions, analyticsPeriod, sessionCategoryFilter, modelReinjectThreshold, modelDefaultTier, modelDebugMode]);

  // Expose save function for App.tsx navigation guard
  useEffect(() => {
    (window as any).__workspaceSave = handleSaveWorkspace;
  }, [handleSaveWorkspace]);

  const handleLoadWorkspace = useCallback(async (name?: string) => {
    const wsProjectId = propProjectId || selectedProject;
    if (!wsProjectId || !window.deskflowAPI?.loadWorkspace) return;
    isRestoringRef.current = true;
    try {
      const result = await window.deskflowAPI.loadWorkspace({ scope: 'project', projectId: wsProjectId, name });
      if (result?.success && result.data) {
        setWorkspaceName(result.data.name || 'default');
        if (result.data.sidebarWidth) setSidebarWidth(result.data.sidebarWidth);
        if (result.data.activeTab) setActiveGroup(result.data.activeTab as GroupKey);
        if (result.data.activeSubtabs) {
          try {
            for (const [key, val] of Object.entries(result.data.activeSubtabs as Record<string, string>)) {
              localStorage.setItem(`workspace-subtab-${key}`, val);
            }
          } catch {}
        }
        if (result.data.presets?.length > 0) setPresets(result.data.presets);

        // Restore configs tab settings
        if (result.data.configs) {
          const c = result.data.configs;
          if (c.modelReinjectThreshold !== undefined) {
            setModelReinjectThreshold(c.modelReinjectThreshold);
            localStorage.setItem('model-reinject-threshold', String(c.modelReinjectThreshold));
          }
          if (c.modelDefaultTier) {
            setModelDefaultTier(c.modelDefaultTier);
            localStorage.setItem('default-model-tier', c.modelDefaultTier);
          }
          if (c.modelDebugMode !== undefined) {
            setModelDebugMode(c.modelDebugMode);
            localStorage.setItem('model-debug-mode', String(c.modelDebugMode));
          }
          if (c.crossSessionSyncEnabled !== undefined) localStorage.setItem('cross-session-sync-enabled', String(c.crossSessionSyncEnabled));
          if (c.fileLockTTL !== undefined) localStorage.setItem('file-lock-ttl', String(c.fileLockTTL));
          if (c.contextBroadcastEnabled !== undefined) localStorage.setItem('context-broadcast-enabled', String(c.contextBroadcastEnabled));
          if (c.conflictWarningMode) localStorage.setItem('conflict-warning-mode', c.conflictWarningMode);
          if (c.syncCommandEnabled !== undefined) localStorage.setItem('sync-command-enabled', String(c.syncCommandEnabled));
          if (c.thoughtProcessEnabled !== undefined) localStorage.setItem('thought-process-enabled', String(c.thoughtProcessEnabled));
        }

        // Restore analytics period
        if (result.data.analyticsPeriod) setAnalyticsPeriod(result.data.analyticsPeriod as any);
        if (result.data.sessionCategoryFilter) setSessionCategoryFilter(result.data.sessionCategoryFilter);
        if (result.data.sessionAgentFilter) setSessionAgentFilter(result.data.sessionAgentFilter);
        if (result.data.mapListRatio !== undefined && result.data.mapListRatio !== null) {
          localStorage.setItem(`mapListRatio:${wsProjectId}`, String(result.data.mapListRatio));
        }

        // Restore pane layout from state_json.layout or from terminal_layouts table
        if (result.data.layout) {
          setTerminalLayout(result.data.layout);
        } else {
          const layouts = await window.deskflowAPI.getTerminalLayouts(effectiveProjectId || undefined);
          const active = layouts?.find((l: any) => l.is_active);
          if (active?.layout_data) {
            setTerminalLayout(JSON.parse(active.layout_data));
          }
        }

        // Reconstruct terminals from saved terminalTabs
        const savedTabs = result.data.terminalTabs || [];
        const terminalInfo = result.data.terminalInfo || {};
        const scrollbackData = result.data.scrollbackData || {};
        if (savedTabs.length > 0) {
          const proj = projects.find(p => p.id === wsProjectId);
          const cwd = proj?.path || '';
          for (const terminalId of savedTabs) {
            if (!terminalTabsRef.current[terminalId]) {
              const info = terminalInfo[terminalId];
              window.dispatchEvent(new CustomEvent('create-terminal', {
                detail: { terminalId, cwd, agent: info?.agent || 'claude', sessionName: info?.name, restoring: true, initAgent: !!info?.agent }
              }));
            }
          }
          // Restore scrollback after terminals are created (wait for PTY ready)
          if (Object.keys(scrollbackData).length > 0) {
            setTimeout(() => {
              const importFn = (window as any).__terminalImportScrollback;
              if (!importFn) return;
              for (const [terminalId, content] of Object.entries(scrollbackData)) {
                if (importFn[terminalId] && content) {
                  try { importFn[terminalId](content); } catch {}
                }
              }
            }, 3000); // Wait for terminals to spawn and be ready
          }
        }

        if (result.data.activeTerminalId) {
          setActiveTerminalId(result.data.activeTerminalId);
        }
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to load workspace', 'error');
    } finally {
      isRestoringRef.current = false;
    }
  }, [propProjectId, selectedProject, effectiveProjectId, projects]);

  const handleImportOpencodeSessions = useCallback(async (opencodeSessions: any[]) => {
    const proj = projects.find(p => p.id === selectedProject);
    const cwd = proj?.path || '';
    let imported = 0;
    let skipped = 0;
    for (const s of opencodeSessions) {
      const exists = sessions.some(t => t.resume_id === s.id);
      if (exists) { skipped++; continue; }
      await window.deskflowAPI?.saveTerminalSession?.({
        projectId: selectedProject,
        agent: s.agent || 'opencode',
        resumeId: s.id,
        topic: s.topic || 'Imported from opencode',
        workingDirectory: cwd || s.workingDirectory || '',
      });
      imported++;
    }
    loadSessions();
    setShowImportSessionsDialog(false);
    showError(`Imported ${imported} session${imported !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} already exist)` : ''}`, 'info');
  }, [selectedProject, projects, sessions]);

  const fetchOpencodeSessionTitle = useCallback(async () => {
    try {
      const result = await window.deskflowAPI?.executeCommand?.('opencode session list');
      if (result?.error || !result?.stdout?.trim()) return;
      const lines = result.stdout.trim().split('\n').filter((l: string) => l.trim());
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const idMatch = line.match(/^([a-zA-Z0-9_\-]{8,})\s+/);
        if (!idMatch) continue;
        const rest = line.slice(idMatch[0].length).trim();
        const dateMatch = rest.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*$/);
        const title = dateMatch ? rest.slice(0, dateMatch.index).trim() : rest;
        if (title) { setOpenCodeSessionName(title); return; }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (showNewSessionDialog) fetchOpencodeSessionTitle();
  }, [showNewSessionDialog, fetchOpencodeSessionTitle]);

  useEffect(() => {
    const wsProjectId = propProjectId || selectedProject;
    if (!wsProjectId || !window.deskflowAPI?.saveWorkspace) return;
    if (isRestoringRef.current) return;
    if (saveWorkspaceDebounce.current) clearTimeout(saveWorkspaceDebounce.current);
    saveWorkspaceDebounce.current = setTimeout(handleSaveWorkspace, 2000);
    return () => {
      if (saveWorkspaceDebounce.current) clearTimeout(saveWorkspaceDebounce.current);
    };
  }, [propProjectId, selectedProject, sidebarWidth, activeGroup, terminalTabs, handleSaveWorkspace]);

  useEffect(() => {
    if (!selectedSessionDetail) { setOpencodeSessionExport(null); return; }
    const session = sessions.find(s => s.id === selectedSessionDetail);
    if (!session?.resume_id) { setOpencodeSessionExport(null); return; }
    setLoadingExport(true);
    window.deskflowAPI?.executeCommand?.(`opencode export ${session.resume_id}`).then(result => {
      if (result?.stdout) {
        try {
          const parsed = JSON.parse(result.stdout);
          setOpencodeSessionExport(parsed.info || parsed);
        } catch {}
      }
    }).finally(() => setLoadingExport(false));
  }, [selectedSessionDetail, sessions]);

  const workspaceRestoredRef = useRef(false);

  useEffect(() => {
    const wsProjectId = propProjectId || selectedProject;
    if (!wsProjectId || workspaceRestoredRef.current) return;
    workspaceRestoredRef.current = true;
    const timer = setTimeout(() => {
      handleLoadWorkspace();
    }, 800);
    return () => clearTimeout(timer);
  }, [propProjectId, selectedProject, handleLoadWorkspace]);

  // Handle create-terminal events: spawn the PTY and notify the system
  useEffect(() => {
    const handleCreateTerminal = async (e: CustomEvent) => {
      const d = e.detail as { terminalId: string; cwd?: string; agent?: string; sessionName?: string; restoring?: boolean; initAgent?: boolean };
      if (!d.restoring) {
        userCreatedTerminalRef.current = true;
      }
      window.dispatchEvent(new CustomEvent('terminal:mark-spawned', { detail: { terminalId: d.terminalId } }));
      await spawnTerminal(d.terminalId, d.cwd || propProjectPath, d.agent);
      window.dispatchEvent(new CustomEvent('terminal-created', { detail: { terminalId: d.terminalId, agent: d.agent } }));
      if (d.initAgent && d.agent && d.agent.length > 0) {
        await initializeTerminal(d.terminalId, d.agent, undefined, undefined, undefined, d.cwd || propProjectPath);
      }
    };
    window.addEventListener('create-terminal', handleCreateTerminal as EventListener);
    return () => window.removeEventListener('create-terminal', handleCreateTerminal as EventListener);
  }, [spawnTerminal, initializeTerminal, propProjectPath]);

  // Handle terminal crash events: clean up agent state
  useEffect(() => {
    const handleTerminalCrashed = (e: CustomEvent) => {
      const { terminalId } = e.detail as { terminalId: string; exitCode: number };
      setAgentInitErrors(prev => { const n = { ...prev }; delete n[terminalId]; return n; });
    };
    window.addEventListener('terminal:crashed', handleTerminalCrashed as EventListener);
    return () => window.removeEventListener('terminal:crashed', handleTerminalCrashed as EventListener);
  }, []);

  // Handle re-spawn requests from dead terminal overlay
  useEffect(() => {
    const handleReSpawn = async (e: CustomEvent) => {
      const { terminalId } = e.detail as { terminalId: string };
      const tab = terminalTabs[terminalId];
      const agent = tab?.agent || '';
      const cwd = propProjectPath || '';
      const spawned = await spawnTerminal(terminalId, cwd, agent || undefined);
      if (!spawned) return;
      window.dispatchEvent(new CustomEvent('terminal:mark-spawned', { detail: { terminalId } }));
      if (agent) {
        await initializeTerminal(terminalId, agent, undefined, undefined, undefined, cwd);
      }
    };
    window.addEventListener('re-spawn-terminal', handleReSpawn as EventListener);
    return () => window.removeEventListener('re-spawn-terminal', handleReSpawn as EventListener);
  }, [spawnTerminal, initializeTerminal, terminalTabs, propProjectPath]);

  const handleLayoutChange = useCallback((layout: PaneNode) => {
    setTerminalLayout(layout);
    saveLayout(layout);
  }, [saveLayout]);

  const handleMiniMapTerminalMove = useCallback((fromId: string, toId: string) => {
    if (!terminalLayout) return;
    const newLayout = swapLeavesInTree(terminalLayout, fromId, toId);
    setTerminalLayout(newLayout);
    saveLayout(newLayout);
  }, [terminalLayout, saveLayout]);

  const handleMiniMapSplit = useCallback((terminalId: string, direction: 'horizontal' | 'vertical') => {
    if (!terminalLayout) return;
    const newTerminalId = `term-${Date.now()}`;
    const newLayout = splitPane(terminalLayout, terminalId, newTerminalId, direction);
    setTerminalLayout(newLayout);
    saveLayout(newLayout);
    window.dispatchEvent(new CustomEvent('create-terminal', {
      detail: { terminalId: newTerminalId, cwd: propProjectPath }
    }));
  }, [terminalLayout, saveLayout, propProjectPath]);

  const handleTabSelect = useCallback((terminalId: string) => {
    setActiveTerminalId(terminalId);
    if (terminalLayout) {
      const groups = extractGroups(terminalLayout);
      const groupIdx = groups.findIndex(g => g.terminals.includes(terminalId));
      if (groupIdx >= 0) {
        setActiveGroupIndex(groupIdx);
      }
      if (terminalLayout.type === 'leaf') {
        if (terminalLayout.terminalId !== terminalId) {
          const updated = { ...terminalLayout, terminalId };
          setTerminalLayout(updated);
          saveLayout(updated);
        }
      }
    }
  }, [terminalLayout, saveLayout]);

  const handleMiniMapTerminalSelect = useCallback((terminalId: string) => {
    setActiveTerminalId(terminalId);
    if (terminalTabs[terminalId]) {
      handleTabSelect(terminalId);
    }
  }, [handleTabSelect, terminalTabs]);

  const handleMiniMapToggleDirection = useCallback((_groupIndex: number, path: number[]) => {
    if (!terminalLayout) return;
    const newLayout = togglePaneDirection(terminalLayout, path);
    setTerminalLayout(newLayout);
    saveLayout(newLayout);
  }, [terminalLayout, saveLayout]);

  const handleTerminalMoveToGroup = useCallback((terminalId: string, targetGroupIndex: number) => {
    if (!terminalLayout) return;
    const groups = extractGroups(terminalLayout);
    if (targetGroupIndex < 0 || targetGroupIndex >= groups.length) return;
    const sourceGroup = groups.find(g => g.terminals.includes(terminalId));
    if (!sourceGroup) return;
    if (groups.indexOf(sourceGroup) === targetGroupIndex) return;
    const targetGroupFirstId = groups[targetGroupIndex].terminals[0];
    if (!targetGroupFirstId) return;
    const newLeaf: PaneNode = { type: 'leaf', terminalId };
    // Remove source terminal from tree first
    const newLayout = removeLeafFromTree(terminalLayout, terminalId);
    if (!newLayout) return;
    // Find the target group's anchor terminal in the new tree
    // (group indices may have shifted after removal, so search by terminal ID)
    const anchorTarget = findLeafInTree(newLayout, targetGroupFirstId);
    if (!anchorTarget) return;
    const finalLayout = addLeafToGroup(newLayout, anchorTarget.terminalId!, newLeaf, 'vertical');
    setTerminalLayout(finalLayout);
    saveLayout(finalLayout);
  }, [terminalLayout, saveLayout]);

  const handleMiniMapMoveToGroup = useCallback((terminalId: string, targetGroupIndex: number) => {
    handleTerminalMoveToGroup(terminalId, targetGroupIndex);
  }, [handleTerminalMoveToGroup]);

  const loadSavedConfigs = useCallback(async () => {
    if (!window.deskflowAPI) return;
    try {
      const presetData = await window.deskflowAPI.getTerminalPresets(selectedProject || undefined);
      return presetData || [];
    } catch {
      return [];
    }
  }, [selectedProject]);

  const handleActiveTerminalChange = useCallback((terminalId: string) => {
    setActiveTerminalId(terminalId);
  }, []);

  const closeTerminal = useCallback(async (terminalId: string) => {
    if (!window.deskflowAPI) return;
    try {
      const tab = terminalTabs[terminalId];
      const sessionInTerminal = sessions.find(s => s.terminal_id === terminalId);
      if (sessionInTerminal) {
        await window.deskflowAPI.saveTerminalSession?.({
          id: sessionInTerminal.id,
          projectId: selectedProject || undefined,
          agent: sessionInTerminal.agent,
          topic: sessionInTerminal.topic,
          workingDirectory: projects.find(p => p.id === selectedProject)?.path,
        });
      }
      loadSessions();

      await window.deskflowAPI.killTerminal(terminalId);
      window.deskflowAPI.terminalAPI?.destroy(terminalId);

      const remainingTabs = Object.keys(terminalTabs).filter(id => id !== terminalId);

      setTerminalTabs(prev => {
        const next = { ...prev };
        delete next[terminalId];
        return next;
      });

      // Update active terminal
      if (activeTerminalId === terminalId) {
        setActiveTerminalId(remainingTabs.length > 0 ? remainingTabs[0] : null);
      }

      // Update layout to remove the closed terminal
      if (terminalLayout && terminalLayout.type === 'leaf' && terminalLayout.terminalId === terminalId) {
        if (remainingTabs.length > 0) {
          const updated = { ...terminalLayout, terminalId: remainingTabs[0] };
          setTerminalLayout(updated);
          saveLayout(updated);
        } else {
          setTerminalLayout(null);
          saveLayout(null);
        }
      } else if (terminalLayout && terminalLayout.type === 'split') {
        const updated = removePane(terminalLayout, terminalId);
        setTerminalLayout(updated);
        saveLayout(updated);
      }

      // Ensure activeGroupIndex is in bounds
      const groupsAfterClose = getGroupTrees(terminalLayout?.type === 'split' ? removePane(terminalLayout!, terminalId) : terminalLayout);
      if (activeGroupIndex >= groupsAfterClose.length) {
        setActiveGroupIndex(Math.max(0, groupsAfterClose.length - 1));
      }

      window.dispatchEvent(new CustomEvent('terminal-cleanup', { detail: { terminalId } }));
    } catch (e) {
      console.error('[TerminalPage] Failed to close terminal:', e);
    }
  }, [activeTerminalId, terminalTabs, selectedProject, projects, loadSessions, terminalLayout, saveLayout, sessions]);

  const handleAddPreset = useCallback(async () => {
    if (!window.deskflowAPI || !newPreset.name || !newPreset.command) return;
    try {
      const result = await window.deskflowAPI.addTerminalPreset({
        projectId: selectedProject || undefined,
        name: newPreset.name,
        command: newPreset.command,
        category: newPreset.category || undefined,
      });
      if (result.success) {
        setNewPreset({ name: '', command: '', category: '' });
        setShowAddPreset(false);
        loadPresets();
      } else {
        logOnce('terminal-add-preset', '[TerminalPage] Failed to add preset:', result.error);
      }
    } catch (e) {
      logOnce('terminal-add-preset', '[TerminalPage] Failed to add preset:', e);
    }
  }, [newPreset, selectedProject, loadPresets]);

  const handleRemovePreset = useCallback(async (presetId: string) => {
    if (!window.deskflowAPI) return;
    try {
      await window.deskflowAPI.removeTerminalPreset(presetId);
      loadPresets();
    } catch (e) {
      console.warn('[TerminalPage] Failed to remove preset:', e);
    }
  }, [loadPresets]);

  const handleSavePresetEdit = useCallback(async () => {
    if (!window.deskflowAPI || !editPreset || !editPreset.name || (!editPreset.isBuiltIn && !editPreset.command)) return;
    try {
      await window.deskflowAPI.saveTerminalPreset(editPreset);
      setShowEditPreset(false);
      setEditPreset(null);
      loadPresets();
    } catch (e) {
      console.warn('[TerminalPage] Failed to save preset:', e);
    }
  }, [editPreset, loadPresets]);

  const handleExecutePreset = useCallback(async (preset: Preset) => {
    if (!window.deskflowAPI || !activeTerminalId) return;
    try {
      if (preset.isBuiltIn) {
        if (preset.id === 'builtin-remind') {
          const projectDir = propProjectPath || (projects.find(p => p.id === selectedProject)?.path);
          if (projectDir) {
            const rulesResult = await window.deskflowAPI.readProjectFile?.('agent/RULES_COMPACT.md', projectDir);
            const stateResult = await window.deskflowAPI.readProjectFile?.('agent/state.md', projectDir);
            const rulesContent = rulesResult?.success ? rulesResult.data : '';
            const stateContent = stateResult?.success ? stateResult.data : '';
            let remindContent = '## [SYSTEM] Remind — Current Session Context\n';
            if (rulesContent) remindContent += rulesContent + '\n';
            if (stateContent) {
              const truncated = stateContent.length > 1500 ? stateContent.slice(0, 1500) + '...' : stateContent;
              remindContent += '## Current State (from state.md)\n' + truncated + '\n';
            }
            await window.deskflowAPI.terminalWrite(activeTerminalId, remindContent + '\r\n');
          }
        }
        return;
      }
      const result = await window.deskflowAPI.executeTerminalPreset(preset.id);
      if (result?.command) {
        await window.deskflowAPI.terminalWrite(activeTerminalId, result.command + '\r\n');
      }
    } catch (e) {
      console.warn('[TerminalPage] Failed to execute preset:', e);
    }
  }, [activeTerminalId, propProjectPath, projects, selectedProject]);

  const handleResumeSession = useCallback(async (session: Session, targetTerminalId?: string) => {
    if (!window.deskflowAPI) return;
    try {
      let resumeId = session.resume_id || (await window.deskflowAPI.getTerminalSessionResumeId(session.id)) || undefined;
      const proj = projects.find(p => p.id === selectedProject);
      const cwd = proj?.path || '';
      let resolvedTerminalId = targetTerminalId;

      // ═══ VERIFY stored resumeId against opencode's session list ═══
      // If the session no longer exists in opencode, discard it and start fresh.
      if (resumeId && !resumeId.startsWith('local_')) {
        try {
          const checkResult = await (window.deskflowAPI as any)?.checkSessionExists?.(resumeId);
          if (checkResult && !checkResult.exists) {
            console.log('[RESUME-DBG] Resume: stored id', resumeId, 'not found in opencode — starting fresh');
            resumeId = undefined;
          }
        } catch (e) {
          console.warn('[RESUME-DBG] Resume validation error, proceeding with resumeId:', e);
        }
      }

      // Load saved session config for init content
      let savedInitContent: string | undefined;
      let savedSystemPrompt: string | undefined;
      try {
        const configResult = await window.deskflowAPI.loadSessionConfig?.(session.id, cwd);
        if (configResult?.success && configResult.data) {
          const cfg = configResult.data;
          if (cfg.initContent) savedInitContent = cfg.initContent;
          if (cfg.customSystemPrompt) savedSystemPrompt = cfg.customSystemPrompt;
        }
      } catch {}

      if (!resolvedTerminalId) {
        resolvedTerminalId = `term-${Date.now()}-resume`;
        setTerminalTabs(prev => ({ ...prev, [resolvedTerminalId!]: { name: proj?.name || 'Resumed', agent: session.agent || 'claude', modelTier: session.modelTier || 'mid' } }));
        setActiveTerminalId(resolvedTerminalId);
        const updatedLayout = insertIntoLayout(terminalLayout, resolvedTerminalId);
        setTerminalLayout(updatedLayout);
        saveLayout(updatedLayout);
        const spawned = await spawnTerminal(resolvedTerminalId, cwd, session.agent);
        if (!spawned) {
          showError('Failed to create terminal', 'error');
          return;
        }
        window.dispatchEvent(new CustomEvent('terminal:mark-spawned', { detail: { terminalId: resolvedTerminalId } }));
        await registerTerminal(resolvedTerminalId, session.agent || 'claude');
        await initializeTerminal(resolvedTerminalId, session.agent || 'claude', resumeId || undefined, undefined, savedSystemPrompt, cwd);
      } else {
        setActiveTerminalId(resolvedTerminalId);
      }

      // Update session with terminal binding
      if (resolvedTerminalId && session.terminal_id !== resolvedTerminalId) {
        await window.deskflowAPI.saveTerminalSession?.({
          id: session.id,
          projectId: selectedProject,
          agent: session.agent,
          resumeId: resumeId || undefined,
          terminalId: resolvedTerminalId,
          topic: session.topic,
          workingDirectory: proj?.path || '',
        });
      }

      // ═══ CAPTURE real opencode session ID if we only have a fake local_ id ═══
      if (cwd && (!resumeId || resumeId.startsWith('local_'))) {
        const spawnTimestamp = Date.now();
        (async () => {
          try {
            if (!window.deskflowAPI) return;
            let capResult: any = null;
            for (let attempt = 0; attempt < 10; attempt++) {
              capResult = await (window.deskflowAPI as any).captureOpencodeSessionId?.(cwd, spawnTimestamp);
              if (capResult?.sessionId) break;
              await new Promise(r => setTimeout(r, 1000));
            }
            if (capResult?.sessionId && capResult.sessionId.startsWith('ses_')) {
              await (window.deskflowAPI as any).updateSessionResumeId?.(session.id, capResult.sessionId);
              console.log('[TerminalPage] Resume capture: updated resume_id', capResult.sessionId, 'for', session.id);
              loadSessions();
              const updateBanner = `\r\n[resume] found real opencode session ${capResult.sessionId} (source: db)\r\n`;
              (window.deskflowAPI as any)?.terminalWriteDisplay?.(resolvedTerminalId!, updateBanner);
            } else {
              console.log('[TerminalPage] Resume capture: no real opencode session found after polling');
              const warnBanner = `\r\n[resume] WARNING: no real opencode session in db — using LOCAL stub, resume WILL fail\r\n`;
              (window.deskflowAPI as any)?.terminalWriteDisplay?.(resolvedTerminalId!, warnBanner);
            }
          } catch (e) {
            console.warn('[TerminalPage] Resume capture failed:', e);
          }
        })();
      }

      loadSessions();
      showError(`Opened session "${session.topic}" in terminal`, 'info');
    } catch (e) {
      console.warn('[TerminalPage] Failed to resume session:', e);
      showError('Failed to resume session', 'error');
    }
  }, [selectedProject, projects, terminalTabs, sessions, showError, loadSessions, spawnTerminal, initializeTerminal]);

  const handleOpenSessionInTerminal = useCallback((session: Session, terminalId: string) => {
    const existingSession = sessions.find(s => s.terminal_id === terminalId);
    const doReplace = async () => {
      await closeTerminal(terminalId);
      handleResumeSession(session);
    };
    if (existingSession) {
      setConfirmDialog({
        isOpen: true,
        message: `Terminal already has session "${existingSession.topic}". Replace it with "${session.topic}"?`,
        onConfirm: doReplace,
      });
    } else {
      doReplace();
    }
  }, [sessions, handleResumeSession, closeTerminal]);

  // Delete session from database
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!window.deskflowAPI) return;
    try {
      await window.deskflowAPI.deleteTerminalSession(sessionId);
      loadSessions();
    } catch (e) {
      console.warn('[TerminalPage] Failed to delete session:', e);
    }
  }, [loadSessions]);

  const handleSaveSession = useCallback(async (data: { sessionId: string; topic?: string; category?: string; productArea?: string; description?: string; status?: string; tags?: string[] }): Promise<boolean> => {
    if (!window.deskflowAPI) return false;
    try {
      const result = await window.deskflowAPI.updateSessionCategory(data);
      if (result?.success) { loadSessions(); return true; }
      return false;
    } catch (e) {
      console.warn('[TerminalPage] Failed to update session:', e);
      return false;
    }
  }, [loadSessions]);

  useEffect(() => {
    const handleCreateTerminalForProblem = async (e: CustomEvent<{ terminalId: string; prompt: string; projectPath?: string }>) => {
      const { terminalId, prompt, projectPath } = e.detail;
      const proj = projects.find(p => p.id === selectedProject);
      const agent = localStorage.getItem('terminal-defaultAgent') || 'claude';
      setTerminalTabs(prev => {
        if (prev[terminalId]) return prev;
        return { ...prev, [terminalId]: { name: proj?.name || 'Terminal', agent } };
      });
      setActiveTerminalId(terminalId);
      const updatedLayout = insertIntoLayout(terminalLayout, terminalId);
      setTerminalLayout(updatedLayout);
      saveLayout(updatedLayout);
      window.dispatchEvent(new CustomEvent('create-terminal', {
        detail: { terminalId, cwd: projectPath, agent },
      }));
      if (prompt) {
        setTimeout(async () => {
          await window.deskflowAPI?.terminalWrite?.(terminalId, prompt + '\r\n');
        }, 3000);
      }
      // Auto-create session when problem is assigned to terminal
      const sessionName = `Problem: ${prompt?.substring(0, 60) || 'Assigned'}`;
      await window.deskflowAPI?.saveTerminalSession?.({
        id: `session-${Date.now()}`,
        projectId: selectedProject,
        agent,
        terminalId,
        topic: sessionName,
        workingDirectory: projectPath || proj?.path || '',
      });
      loadSessions();
    };

    const handleFocusTerminal = (e: CustomEvent<{ terminalId: string }>) => {
      handleTabSelect(e.detail.terminalId);
    };

    const handleTerminalCreated = async (e: CustomEvent<{ terminalId: string; agent?: string }>) => {
      const { terminalId } = e.detail;
      // ONLY launch an agent when one was EXPLICITLY requested (New Session dialog /
      // opening an existing session). Plain terminals (New Terminal, split panes,
      // + Open Terminal) must stay plain shells — never fall back to the default agent.
      const agent = e.detail.agent || '';
      const proj = projects.find(p => p.id === selectedProject);
      setTerminalTabs(prev => {
        if (prev[terminalId]) return prev;
        return { ...prev, [terminalId]: { name: proj?.name || 'Terminal', agent, modelTier: 'mid' } };
      });
      await registerTerminal(terminalId, agent || undefined);
      if (agent) {
        // Initialize the agent (launch command + system prompt)
        await initializeTerminal(terminalId, agent, undefined, undefined, undefined, propProjectPath);
      }
    };

    const handleClosePane = (e: CustomEvent<{ terminalId: string }>) => {
      closeTerminal(e.detail.terminalId);
    };

    const handleOpenNewSessionForTerminal = (e: CustomEvent<{ terminalId: string }>) => {
      const { terminalId } = e.detail;
      setNewSessionTerminalMode('select');
      setNewSessionSelectedTerminal(terminalId);
      setNewSessionAgent('claude');
      setNewSessionName('');
      setShowNewSessionDialog(true);
    };

    const handleTriggerProvision = () => {
      if (initStatus === 'init-ok') {
        if (!window.confirm('This project is already initialized. Re-initialize workspace files?')) return;
      }
      setShowInitModal(true);
    };

    const handleOpenNewAgent = () => {
      const projectId = propProjectId || selectedProject;
      if (!projectId) { showError('Please select a project first', 'warning'); return; }
      setNewSessionMode('initialize');
      setNewSessionAgent(localStorage.getItem('terminal-defaultAgent') || 'claude');
      setShowNewSessionDialog(true);
    };

    window.addEventListener('create-terminal-for-problem', handleCreateTerminalForProblem as EventListener);
    window.addEventListener('focus-terminal', handleFocusTerminal as EventListener);
    window.addEventListener('terminal-created', handleTerminalCreated as EventListener);
    window.addEventListener('close-pane', handleClosePane as EventListener);
    window.addEventListener('open-new-session-for-terminal', handleOpenNewSessionForTerminal as EventListener);
    window.addEventListener('trigger-provision', handleTriggerProvision);
    window.addEventListener('open-new-agent', handleOpenNewAgent);
    const handleSwitchSidebarTab = (e: CustomEvent) => {
      const tab = e.detail as string;
      if (['setup', 'work', 'insights', 'studio', 'conductor', 'ai-gateway', 'context'].includes(tab)) {
        setActiveGroup(tab as GroupKey);
      }
    };
    window.addEventListener('switch-sidebar-tab', handleSwitchSidebarTab as EventListener);
    const handleCloseWorkspaceDialog = () => {
      const hasTerminals = Object.keys(terminalTabsRef.current).length > 0;
      if (!hasTerminals) {
        onCloseWorkspaceRef.current?.();
        return;
      }
      setShowCloseWorkspaceDialog(true);
    };
    window.addEventListener('open-close-workspace-dialog', handleCloseWorkspaceDialog);
    return () => {
      window.removeEventListener('create-terminal-for-problem', handleCreateTerminalForProblem as EventListener);
      window.removeEventListener('focus-terminal', handleFocusTerminal as EventListener);
      window.removeEventListener('terminal-created', handleTerminalCreated as EventListener);
      window.removeEventListener('close-pane', handleClosePane as EventListener);
      window.removeEventListener('open-new-session-for-terminal', handleOpenNewSessionForTerminal as EventListener);
      window.removeEventListener('trigger-provision', handleTriggerProvision);
      window.removeEventListener('switch-sidebar-tab', handleSwitchSidebarTab as EventListener);
      window.removeEventListener('open-new-agent', handleOpenNewAgent);
      window.removeEventListener('open-close-workspace-dialog', handleCloseWorkspaceDialog);
    };
  }, [projects, selectedProject, propProjectId, propProjectPath, registerTerminal, spawnTerminal, loadSessions, initializeTerminal, handleTabSelect, closeTerminal, showError, setInitStatus, setNewSessionMode, setNewSessionAgent, setShowNewSessionDialog]);

  return (
    <PageShell page="terminal" className="flex-1 flex bg-black text-white !p-0 !space-y-0 relative overflow-hidden" data-workspace-root>
      <SelectionProvider>
      {/* Main Terminal Area */}
      <div style={accentStyle('cyan')} className="flex-1 flex flex-col bg-zinc-950 relative">
        
        {/* Terminal Tab Bar */}
        <div className="flex items-center bg-zinc-950 border-b border-zinc-800/60 overflow-x-auto min-h-[36px]">
          {(() => {
            const groups = extractGroups(terminalLayout);
            const tabToGroupMap: Record<string, number> = {};
            groups.forEach((g, i) => g.terminals.forEach(tid => { tabToGroupMap[tid] = i; }));
            return Object.entries(terminalTabs).map(([id, tab]) => {
              const sessionInTab = sessions.find(s => s.terminal_id === id);
              const groupIdx = tabToGroupMap[id];
              const isActive = activeTerminalId === id;
              const isDragTarget = draggedTabRef.current !== null && draggedTabRef.current !== id;
              return (
                <div
                  key={id}
                  draggable
                  onClick={() => handleTabSelect(id)}
                  onDragStart={(e) => {
                    draggedTabRef.current = id;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const srcId = draggedTabRef.current;
                    if (!srcId || srcId === id || !terminalLayout) return;
                    const srcGroupIdx = tabToGroupMap[srcId];
                    const dstGroupIdx = groupIdx;
                    if (srcGroupIdx === undefined || dstGroupIdx === undefined) return;
                    if (srcGroupIdx === dstGroupIdx) {
                      const swapped = swapLeavesInTree(terminalLayout, srcId, id);
                      setTerminalLayout(swapped);
                      saveLayout(swapped);
                    } else {
                      handleTerminalMoveToGroup(srcId, dstGroupIdx);
                    }
                    draggedTabRef.current = null;
                  }}
                  onDragEnd={() => { draggedTabRef.current = null; }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-zinc-800 select-none transition-colors duration-150 ${
                    isActive
                      ? 'bg-zinc-800 text-white border-t-2 border-cyan-500'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  } ${isDragTarget ? 'opacity-60' : ''}`}
                >
                  <Monitor className="w-3 h-3 text-green-500" />
                  {sessionInTab && <StatusDot status={sessionInTab.status} />}
                  {sessionInTab?.status === 'action_required' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 animate-pulse ml-0.5" />
                  )}
                  {terminalAnomalies[id] && (
                    <AlertCircle className={"w-3.5 h-3.5 ml-0.5 " + (terminalAnomalies[id].severity === 'high' ? 'text-red-500 animate-pulse' : 'text-amber-500')} />
                  )}
                  <span>{tab.name}</span>
                  {tab.modelTier && (
                    <span className={`text-[9px] px-1 rounded font-medium ${
                      tab.modelTier === 'top' ? 'bg-green-500/20 text-green-400' :
                      tab.modelTier === 'low' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {tab.modelTier}
                    </span>
                  )}
                  {sessionInTab && <CategoryBadge category={sessionInTab.category} />}
                  {terminalFileLocks[id]?.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-500/10 px-1 rounded" title={`Locked files: ${terminalFileLocks[id].join(', ')}`}>
                      <Lock className="w-2.5 h-2.5" />
                      {terminalFileLocks[id].length}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-600 max-w-[80px] truncate">{sessionInTab ? (sessionInTab.topic || tab.agent) : ''}</span>
                  {sessionInTab && (
                    <span className="text-[8px] text-cyan-500 bg-cyan-500/10 px-1 rounded">S</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTerminal(id); }}
                    className={WS_ICON_BTN}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            });
          })()}
          <button className={WS_ICON_BTN} title="New Terminal" onClick={async () => {
              const cwd = selectedProject ? (projects.find(p => p.id === selectedProject)?.path || '') : '';
              const newId = `term-${Date.now()}`;
              const count = Object.keys(terminalTabs).length;
              const defaultAgent = localStorage.getItem('terminal-defaultAgent') || 'claude';
              setTerminalTabs(prev => ({ ...prev, [newId]: { name: `Terminal ${count + 1}`, agent: defaultAgent, modelTier: 'mid' } }));
              setActiveTerminalId(newId);
              const updatedLayout = insertIntoLayout(terminalLayout, newId);
              setTerminalLayout(updatedLayout);
              setActiveGroupIndex(getGroupTrees(updatedLayout).length - 1);
              saveLayout(updatedLayout);
              window.dispatchEvent(new CustomEvent('create-terminal', { detail: { cwd, terminalId: newId } }));
            }}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Terminal Toolbar — Compose / Quick / Save */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border-b border-zinc-800/40">
          <button
            onClick={() => { setShowInstructionInput(false); setShowInstructionPanel(true); }}
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-lg text-[10px] font-semibold text-zinc-950 bg-green-500 hover:bg-green-400 transition-all duration-150 active:scale-95"
          >
            <Send className="w-3 h-3" />
            Compose
          </button>
          <button
            onClick={() => { setShowInstructionPanel(false); setShowInstructionInput(true); }}
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-lg text-[10px] font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-150 active:scale-95"
          >
            Quick
          </button>
          <button
            onClick={async () => { await handleSaveWorkspace(); }}
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-150 active:scale-95 relative"
          >
            <Save className="w-3 h-3" />
            {hasUnsavedChanges && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('selection-engine:toggle'))}
            title="Select screen element for AI context (Ctrl+Shift+S)"
            className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-amber-300 transition"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-zinc-600">
            {Object.keys(terminalTabs).length} terminal{Object.keys(terminalTabs).length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {terminalError && (
            <div className={`px-4 py-2 text-xs border-b flex items-center justify-between ${
              terminalErrorType === 'error' ? 'bg-red-950/50 border-red-800/60 text-red-200' :
              terminalErrorType === 'warning' ? 'bg-yellow-950/50 border-yellow-800/60 text-yellow-200' :
              'bg-green-950/50 border-green-800/60 text-green-200'
            }`}>
              <span className="flex-1 min-w-0 truncate">{terminalError}</span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(terminalError); showError('Copied to clipboard', 'info'); }}
                  className="px-2 py-0.5 rounded text-[10px] bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="px-2 py-0.5 rounded text-[10px] bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Settings
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-2 py-0.5 rounded text-[10px] bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Dashboard
                </button>
                <button onClick={() => setTerminalError(null)} className="px-1 py-0.5 rounded text-[10px] hover:bg-white/10 transition-colors">×</button>
              </div>
            </div>
          )}
          {Object.entries(agentInitErrors).map(([tid, err]) => (
            <div key={tid} className="px-4 py-3 text-xs border-b bg-red-950/50 border-red-800/60 text-red-200 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-red-300 font-medium mb-1">Agent initialization failed</div>
                <div className="text-red-200/70 mb-1">{err.detail}</div>
                <div className="text-red-200/50">{err.installHint}</div>
              </div>
              <button
                onClick={() => handleRetryAgentInit(tid, err.agentType)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
              >
                Retry
              </button>
            </div>
          ))}
          {layoutLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
              <LoadingState variant="spinner" />
            </div>
          ) : (
            <>
              {(() => {
                const groups = getGroupTrees(terminalLayout);
                if (groups.length > 1) {
                  return (
                    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-950 border-b border-zinc-800/50">
                      {groups.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveGroupIndex(i)}
                          className={`px-2.5 py-0.5 text-[11px] rounded transition-colors ${
                            activeGroupIndex === i
                              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-600/40'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                          }`}
                        >
                          Group {i + 1}
                        </button>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}
              {(() => {
                const activeGroupTree = terminalLayout ? getGroupTrees(terminalLayout)[activeGroupIndex] ?? terminalLayout : null;
                const handleGroupLayoutChange = (newGroupTree: PaneNode) => {
                  setTerminalLayout(prev => {
                    if (!prev) return newGroupTree;
                    const updated = updateGroupTree(prev, activeGroupIndex, newGroupTree);
                    saveLayout(updated);
                    return updated;
                  });
                };
                return (
                  <div data-tutorial="term.panes"
                    className="flex-1 min-h-0 relative overflow-hidden"
                    onDragOver={(e) => {
                      if (draggedTabRef.current || draggedSessionId) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const srcId = draggedTabRef.current;
                      if (srcId && terminalLayout) {
                        const targetEl = (e.target as HTMLElement).closest('[data-terminal-id]') as HTMLElement | null;
                        if (targetEl) {
                          const targetId = targetEl.getAttribute('data-terminal-id');
                          if (targetId && targetId !== srcId) {
                            const groups = extractGroups(terminalLayout);
                            const targetGroupIdx = groups.findIndex(g => g.terminals.includes(targetId));
                            const srcGroupIdx = groups.findIndex(g => g.terminals.includes(srcId));
                            if (srcGroupIdx !== -1 && targetGroupIdx !== -1 && srcGroupIdx !== targetGroupIdx) {
                              handleTerminalMoveToGroup(srcId, targetGroupIdx);
                            }
                          }
                        }
                        draggedTabRef.current = null;
                        return;
                      }
                      const sessionData = e.dataTransfer.getData('text/plain');
                      if (sessionData) {
                        try {
                          const parsed = JSON.parse(sessionData);
                          const targetEl = (e.target as HTMLElement).closest('[data-terminal-id]') as HTMLElement | null;
                          if (targetEl) {
                            const targetId = targetEl.getAttribute('data-terminal-id');
                            if (targetId && sessions) {
                              const session = sessions.find(s => s.id === parsed.id);
                              if (session) {
                                handleOpenSessionInTerminal(session, targetId);
                              }
                            }
                          }
                        } catch {}
                        setDraggedSessionId(null);
                      }
                    }}
                  >
                    <TerminalLayout
                      layout={activeGroupTree}
                      activeTerminalId={activeTerminalId}
                      spawnTerminal={spawnTerminal}
                      onLayoutChange={handleGroupLayoutChange}
                      onActiveTerminalChange={handleActiveTerminalChange}
                      onCloseTerminal={closeTerminal}
                      projectPath={propProjectPath}
                      agentStatuses={agentStatuses}
                      capturedSessionIds={terminalCapturedSessionIds}
                      onRetryInit={(tid) => {
                        const err = agentInitErrors[tid];
                        if (err) {
                          handleRetryAgentInit(tid, err.agentType);
                        } else {
                          const tab = terminalTabs[tid];
                          handleRetryAgentInit(tid, tab?.agent || 'opencode');
                        }
                      }}
                    />
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Instruction Panel & Quick Input Overlays */}
        {showInstructionPanel && (
          <div className="absolute inset-x-0 top-[88px] bottom-0 z-[100] flex flex-col pointer-events-none">
            <div className="pointer-events-auto mx-4 mt-2 max-h-[70vh] overflow-y-auto rounded-xl bg-zinc-900/95 ring-1 ring-inset ring-zinc-700/50 shadow-2xl shadow-black/60 backdrop-blur-md">
              <InstructionPanel
                problems={allProblems}
                requests={allRequests}
                onSend={handleInstructionPanelSend}
                onClose={() => setShowInstructionPanel(false)}
                isSending={isSending}
                projectPath={propProjectPath || projects.find(p => p.id === selectedProject)?.path}
                systemPromptLayers={systemPromptLayers}
                defaultSkills={composeSkills}
              />
            </div>
            <div className="flex-1" onClick={() => setShowInstructionPanel(false)} />
          </div>
        )}

        {showInstructionInput && (
          <div className="absolute inset-x-0 top-[88px] z-[100] flex flex-col pointer-events-none">
            <div className="pointer-events-auto mx-4 mt-2 rounded-xl bg-zinc-900/95 ring-1 ring-inset ring-zinc-700/50 shadow-2xl shadow-black/60 backdrop-blur-md px-4 py-2">
              {quotedReferences.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2 px-0.5">
                  {quotedReferences.map((ref, i) => (
                    <div key={ref.id ?? i} className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-900/30 border border-cyan-700/30 rounded text-[10px] text-cyan-300 max-w-[240px]">
                      <span className="font-semibold uppercase text-[9px] text-cyan-500 shrink-0">{ref.role}</span>
                      <span className="truncate text-zinc-300">{ref.content.slice(0, 40)}</span>
                      <button onClick={() => setQuotedReferences(prev => prev.filter(r => r.id !== ref.id))} className="ml-0.5 text-zinc-500 hover:text-zinc-200 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <select value={sendTargetSession} onChange={(e) => setSendTargetSession(e.target.value)} className="h-7 w-[120px] rounded-lg bg-zinc-800 border border-zinc-700 px-2 text-[10px] text-zinc-300" title="Select session">
                  <option value="">Active Terminal</option>
                  {sessions.filter(s => s.terminal_id && terminalTabs[s.terminal_id]).map(s => (
                    <option key={s.id} value={s.id}>{s.topic || 'Unnamed'} ({terminalTabs[s.terminal_id!]?.name || '?'})</option>
                  ))}
                </select>
                <div className="flex-1 relative">
                  <textarea ref={instructionTextareaRef} value={instructionText} onChange={(e) => setInstructionText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInstruction(); } }} rows={1} autoFocus placeholder="Type instruction... (Enter to send)" className="w-full px-3 py-1.5 bg-zinc-900/80 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 resize-none overflow-hidden" />
                </div>
                <button onClick={sendInstruction} disabled={!instructionText.trim() || isSending} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold text-zinc-950 bg-green-500 hover:bg-green-400 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
                  {isSending ? <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : 'Send'}
                </button>
                <button onClick={() => { setShowInstructionInput(false); setInstructionText(''); }} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setShowInstructionInput(false)} />
          </div>
        )}
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div 
          className="relative shrink-0 bg-zinc-950 ws-sidebar-edge flex flex-row min-w-0 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Resize Handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startResize}
            className="group absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-ew-resize z-10 flex items-center justify-center"
          >
            <span className={`h-full w-px transition-colors duration-150 ${isResizing ? 'w-0.5 bg-cyan-400' : 'bg-zinc-800 group-hover:bg-zinc-600'}`} />
          </div>
          
          {/* Group Rail */}
          <WorkspaceGroupRail
            activeGroup={activeGroup}
            onGroupChange={(g) => { setFileChangedPulse(false); setActiveGroup(g); }}
            fileChangedPulse={fileChangedPulse}
          />

          {/* Content */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {activeGroup === 'setup' && (
              <WorkspaceShell accent="orange" tabs={[
                { key: 'presets', icon: Zap, label: 'Presets' },
                { key: 'configs', icon: Settings, label: 'Configs' },
                { key: 'fortress', icon: Shield, label: 'Fortress' },
                { key: 'backups', icon: DatabaseBackup, label: 'Backups' },
              ]} storageKey="setup" render={(sub) => {
                switch (sub) {
                  case 'presets': return (
                    <PresetsTab
                      presets={presets}
                      onAdd={async (name, command, category) => {
                        if (!window.deskflowAPI) return;
                        await window.deskflowAPI.addTerminalPreset({
                          projectId: selectedProject || undefined,
                          name, command, category: category || undefined,
                        });
                        loadPresets();
                      }}
                      onRemove={handleRemovePreset}
                      onEdit={(preset) => { setEditPreset(preset); setShowEditPreset(true); }}
                      onExecute={handleExecutePreset}
                    />
                  );
                  case 'configs': return (
                    <GroupPanel accent="orange">
                      <ConfigsTab
                        modelReinjectThreshold={modelReinjectThreshold}
                        onReinjectThresholdChange={(v) => {
                          setModelReinjectThreshold(v);
                          localStorage.setItem('model-reinject-threshold', String(v));
                          window.deskflowAPI?.setReinjectThreshold?.({ threshold: v });
                        }}
                        modelDefaultTier={modelDefaultTier}
                        onDefaultTierChange={(v) => {
                          setModelDefaultTier(v);
                          localStorage.setItem('default-model-tier', v);
                        }}
                        modelDebugMode={modelDebugMode}
                        onDebugModeChange={(v) => {
                          setModelDebugMode(v);
                          localStorage.setItem('model-debug-mode', String(v));
                          window.deskflowAPI?.setModelDebug?.({ enabled: v });
                        }}
                        autoAssignConfig={autoAssignConfig}
                        onAutoAssignConfigChange={async (config) => {
                          await window.deskflowAPI?.saveAutoAssignConfig?.(config);
                          setAutoAssignConfig(config);
                        }}
                        crossSessionSyncEnabled={crossSessionSyncEnabled}
                        onCrossSessionSyncChange={(v) => {
                          setCrossSessionSyncEnabled(v);
                          localStorage.setItem('cross-session-sync-enabled', String(v));
                          window.deskflowAPI?.setCrossSessionSyncConfig?.({ enabled: v });
                        }}
                        fileLockTTL={fileLockTTL}
                        onFileLockTTLChange={(v) => {
                          setFileLockTTL(v);
                          localStorage.setItem('file-lock-ttl', String(v));
                          window.deskflowAPI?.setCrossSessionSyncConfig?.({ lockTTL: v });
                        }}
                        contextBroadcastEnabled={contextBroadcastEnabled}
                        onContextBroadcastChange={(v) => {
                          setContextBroadcastEnabled(v);
                          localStorage.setItem('context-broadcast-enabled', String(v));
                          window.deskflowAPI?.setCrossSessionSyncConfig?.({ contextBroadcast: v });
                        }}
                        conflictWarningMode={conflictWarningMode}
                        onConflictWarningModeChange={(v) => {
                          setConflictWarningMode(v);
                          localStorage.setItem('conflict-warning-mode', v);
                          window.deskflowAPI?.setCrossSessionSyncConfig?.({ conflictWarningMode: v });
                        }}
                        syncCommandEnabled={syncCommandEnabled}
                        onSyncCommandChange={(v) => {
                          setSyncCommandEnabled(v);
                          localStorage.setItem('sync-command-enabled', String(v));
                          window.deskflowAPI?.setCrossSessionSyncConfig?.({ syncCommand: v });
                        }}
                        thoughtProcessEnabled={thoughtProcessEnabled}
                        onThoughtProcessChange={(v) => {
                          setThoughtProcessEnabled(v);
                          localStorage.setItem('thought-process-enabled', String(v));
                        }}
                        routingCosts={routingCosts}
                      />

                      {/* ── Live Context Viewer ── */}
                      <div className="rounded-lg border border-zinc-800/60 bg-zinc-900 overflow-hidden mt-3">
                        <div className="flex items-center gap-1.5 mb-2 px-3 pt-3">
                          <span className={`w-1.5 h-1.5 rounded-full ${crossSessionSyncEnabled ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
                          <h4 className="text-[11px] font-medium text-amber-300">Live Context</h4>
                          <span className="text-[8px] text-zinc-600 ml-auto">
                            {Object.keys(terminalFileLocks).length} terminal{Object.keys(terminalFileLocks).length !== 1 ? 's' : ''} active
                          </span>
                        </div>
                        <div className="space-y-2 px-3 pb-3">
                          <div>
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                              <Lock className="w-3 h-3" />
                              <span>File Locks</span>
                            </div>
                            {Object.keys(terminalFileLocks).length === 0 ? (
                              <p className="text-[9px] text-zinc-600 pl-4">No active locks</p>
                            ) : (
                              <div className="space-y-1 pl-3">
                                {Object.entries(terminalFileLocks).map(([termId, files]) => (
                                  <div key={termId} className="flex items-start gap-1.5">
                                    <span className="text-[9px] text-amber-400/70 font-mono shrink-0 mt-0.5">{termId.replace('term-', '').slice(0, 8)}</span>
                                    <div className="flex flex-wrap gap-1">
                                      {files.map((fp, i) => (
                                        <span key={i} className="text-[9px] bg-amber-500/10 text-amber-400/80 px-1 rounded truncate max-w-[160px]" title={fp}>
                                          {fp.split('\\').pop()?.split('/').pop()}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="pt-2 border-t border-amber-500/10">
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                              <FileText className="w-3 h-3" />
                              <span>Recent Edits</span>
                            </div>
                            {touchedFiles.length === 0 ? (
                              <p className="text-[9px] text-zinc-600 pl-4">No recent file activity</p>
                            ) : (
                              <div className="space-y-0.5 pl-3 max-h-[120px] overflow-y-auto">
                                {touchedFiles.map((f, i) => (
                                  <div key={f.id || i} className="flex items-center gap-1 text-[9px]">
                                    <span className={`shrink-0 w-1 h-1 rounded-full ${f.action === 'create' ? 'bg-green-500' : f.action === 'delete' ? 'bg-red-500' : 'bg-blue-400'}`} />
                                    <span className="text-zinc-400 truncate max-w-[140px]" title={f.file_path}>{f.file_path.split('\\').pop()?.split('/').pop()}</span>
                                    <span className="text-zinc-600 ml-auto shrink-0">
                                      {f.timestamp ? (() => { const d = new Date(f.timestamp); const diff = Math.floor((Date.now() - d.getTime()) / 1000); return diff < 60 ? `${diff}s` : diff < 3600 ? `${Math.floor(diff / 60)}m` : `${Math.floor(diff / 3600)}h`; })() : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── Saved Workspaces ── */}
                      <div className="rounded-lg border border-zinc-800/60 bg-zinc-900 overflow-hidden mt-3">
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                          <h4 className="text-[11px] font-medium text-orange-300">Saved Workspaces</h4>
                          <div className="flex gap-1">
                            <button onClick={async () => { await handleSaveWorkspace(); }} className="px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">Save</button>
                            <button onClick={() => { setWorkspaceSaveAsName(workspaceName); setShowWorkspaceSaveAsDialog(true); }} className="px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">Save As</button>
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          {workspaceList.length === 0 ? (
                            <p className="text-[10px] text-zinc-600 py-2 text-center">No saved workspaces yet.</p>
                          ) : (
                            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                              {workspaceList.map((ws) => (
                                <div key={ws.name} className={`flex items-center justify-between p-2 rounded text-[11px] ${ws.isActive ? 'bg-green-900/30 border border-green-700/50' : 'bg-zinc-800/50 border border-zinc-700/50'}`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ws.isActive ? 'bg-green-400' : 'bg-zinc-600'}`} />
                                    <span className="text-zinc-200 truncate">{ws.name}</span>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button onClick={() => handleLoadWorkspace(ws.name)} className="px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors">Load</button>
                                    <button onClick={async () => { if (window.confirm(`Delete "${ws.name}"?`)) { const wsProjectId = propProjectId || selectedProject; if (wsProjectId && window.deskflowAPI?.deleteWorkspace) { await window.deskflowAPI.deleteWorkspace({ projectId: wsProjectId, name: ws.name }); const res = await window.deskflowAPI.listWorkspaces({ projectId: wsProjectId }); if (res?.success) setWorkspaceList(res.data || []); } } }} className="px-1.5 py-0.5 text-[10px] text-zinc-600 hover:text-red-400 transition-colors">✕</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </GroupPanel>
                  );
                  case 'fortress': return (
                    <GroupPanel accent="orange">
                      <FortressProtocolSetup />
                    </GroupPanel>
                  );
                  case 'backups': return (
                    <GroupPanel accent="orange">
                      <BackupCenterPage />
                    </GroupPanel>
                  );
                  default: return null;
                }
              }} />
            )}

            <Modal
              open={showEditPreset}
              onClose={() => { setShowEditPreset(false); setEditPreset(null); }}
              title={editPreset?.isBuiltIn ? 'Preset Details' : 'Edit Preset'}
              footer={<>
                <button
                  onClick={() => { setShowEditPreset(false); setEditPreset(null); }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                {editPreset && !editPreset.isBuiltIn && (
                  <ToolbarButton variant="primary" onClick={handleSavePresetEdit}>Save</ToolbarButton>
                )}
              </>}
            >
              {editPreset && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Name</label>
                    <input
                      value={editPreset.name}
                      onChange={(e) => setEditPreset(prev => prev ? { ...prev, name: e.target.value } : null)}
                      disabled={editPreset.isBuiltIn}
                      className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
                    />
                  </div>
                  {!editPreset.isBuiltIn && (
                    <div>
                      <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Command</label>
                      <input
                        value={editPreset.command || ''}
                        onChange={(e) => setEditPreset(prev => prev ? { ...prev, command: e.target.value } : null)}
                        className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Category</label>
                    <input
                      value={editPreset.category || ''}
                      onChange={(e) => setEditPreset(prev => prev ? { ...prev, category: e.target.value } : null)}
                      disabled={editPreset.isBuiltIn}
                      className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
                    />
                  </div>
                  {editPreset.isBuiltIn && (
                    <div>
                      <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Description</label>
                      <div className="mt-1 p-2 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs text-zinc-400">
                        Reads <code className="text-cyan-400">agent/RULES_COMPACT.md</code> and <code className="text-cyan-400">agent/state.md</code>, then injects them into the active terminal as a context reminder.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Modal>

            {activeGroup === 'work' && (
              <WorkspaceShell accent="green" tabs={[
                { key: 'sessions', icon: Clock, label: 'Sessions' },
                { key: 'map', icon: Monitor, label: 'Map' },
                { key: 'files', icon: Folder, label: 'Files' },
                { key: 'workspaces', icon: Save, label: 'Workspaces' },
              ]} storageKey="work" render={(sub) => {
                switch (sub) {
                  case 'sessions': return (
                    <GroupPanel accent="green">
                      <div data-tutorial="term.sessions" className="relative flex-1 min-h-0">
                        <div className="px-3 py-3 space-y-3">
                         {selectedSessionDetail ? (
                           <div>
                              <button
                                onClick={() => { setSelectedSessionDetail(null); setSessionMessages([]); }}
                                className="mb-3 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] rounded flex items-center gap-1"
                              >
                                <ChevronLeft className="w-3 h-3" />
                                Back to sessions
                              </button>
                            {(() => {
                              const session = sessions.find(s => s.id === selectedSessionDetail);
                              if (!session) return <p className="text-xs text-zinc-500">Session not found.</p>;
                              const terminalInfo = session.terminal_id && terminalTabs[session.terminal_id]
                                ? { name: terminalTabs[session.terminal_id].name, agent: terminalTabs[session.terminal_id].agent, isRunning: true }
                                : null;
                              return (
                                  <div>
                                     <div className="p-3 bg-zinc-800 rounded-lg mb-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <StatusDot status={session.status} size="md" />
                                          <span className="text-sm font-bold text-white">{session.topic || 'Unnamed Session'}</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-green-400 bg-green-500/20 px-2 py-1 rounded">{session.agent}</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div><span className="text-zinc-500">Status:</span> <span className="text-zinc-300">{session.status || 'Unknown'}</span></div>
                                        <div><span className="text-zinc-500">Category:</span> <span className="text-zinc-300">{session.category || 'Uncategorized'}</span></div>
                                        <div><span className="text-zinc-500">Date:</span> <span className="text-zinc-300">{formatDate(session.created_at)}</span></div>
                                        <div><span className="text-zinc-500">Terminal:</span> <span className="text-zinc-300">{terminalInfo ? `${terminalInfo.name} (active)` : 'Closed'}</span></div>
                                        <div><span className="text-zinc-500">Cost:</span> <span className="text-emerald-400">${opencodeSessionExport?.cost?.toFixed(2) ?? session.total_cost?.toFixed(2) ?? '0.00'}</span></div>
                                        <div><span className="text-zinc-500">Tokens:</span> <span className="text-zinc-300">{opencodeSessionExport?.tokens ? (opencodeSessionExport.tokens.input + opencodeSessionExport.tokens.output).toLocaleString() : session.total_tokens?.toLocaleString() ?? '0'}</span></div>
                                        {session.resume_id && <div className="col-span-2"><span className="text-zinc-500">Resume ID:</span> <span className="text-zinc-300 font-mono">{session.resume_id}</span></div>}
                                        {session.description && <div className="col-span-2"><span className="text-zinc-500">Description:</span> <span className="text-zinc-300">{session.description}</span></div>}
                                        {session.product_area && <div className="col-span-2"><span className="text-zinc-500">Area:</span> <span className="text-cyan-600">{session.product_area}</span></div>}
                                      </div>
                                      <div className="flex gap-2 mt-3">
                                        {terminalInfo ? (
                                          <button onClick={() => { setActiveTerminalId(session.terminal_id!); window.dispatchEvent(new CustomEvent('focus-terminal', { detail: { terminalId: session.terminal_id } })); }} className="px-3 py-1.5 bg-green-600/80 hover:bg-green-500 text-green-50 text-xs font-medium rounded-lg transition-colors duration-150 hover:shadow-[0_0_8px_rgba(34,197,94,0.3)] active:scale-95">Focus Terminal</button>
                                        ) : (
                                          <button onClick={() => handleResumeSession(session)} className="px-3 py-1.5 bg-green-600/80 hover:bg-green-500 text-green-50 text-xs font-medium rounded-lg transition-colors duration-150 hover:shadow-[0_0_8px_rgba(34,197,94,0.3)] active:scale-95">Open in Terminal</button>
                                        )}
                                        <button onClick={() => setSessionToEdit(session)} className="px-3 py-1.5 bg-zinc-600/80 hover:bg-zinc-500 text-zinc-200 text-xs font-medium rounded-lg transition-colors duration-150 active:scale-95">Edit</button>
                                      </div>
                                    </div>
                                     <div className="p-3 bg-zinc-800 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-zinc-500">Messages</span>
                                        <button
                                          onClick={async () => {
                                            try {
                                              const result = await window.deskflowAPI?.getSessionMessages?.(session.id, session.agent);
                                              if (result?.success) setSessionMessages(result.data || []);
                                            } catch {}
                                          }}
                                          className="px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] rounded"
                                        >
                                          Refresh
                                        </button>
                                      </div>
                                      {sessionMessages.length === 0 ? (
                                        <p className="text-[10px] text-zinc-600">No messages loaded. Click Refresh to load.</p>
                                      ) : (
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                          {sessionMessages.map((msg: any, i: number) => (
                                            <div key={i} className={`px-2 py-1 rounded text-[10px] ${msg.role === 'assistant' ? 'bg-cyan-900/20 border-l-2 border-cyan-500/30' : msg.role === 'user' ? 'bg-blue-900/20 border-l-2 border-blue-500/30' : 'bg-zinc-900/50 border-l-2 border-zinc-500/30'}`}>
                                              <span className="text-[9px] font-medium text-zinc-500 uppercase mr-1">{msg.role}</span>
                                              <span className="text-zinc-300">{stripAnsi(msg.content || '').slice(0, 200)}{stripAnsi(msg.content || '').length > 200 ? '...' : ''}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    </div>
                                );
                              })()}
                            </div>
                         ) : (
                           <div>
                              <div className="flex gap-2 mb-4">
                                 <button onClick={() => {
                                     setNewSessionMode('create');
                                     setNewSessionTerminalMode('create');
                                     setNewSessionSelectedTerminal('');
                                     setNewSessionAgent('claude');
                                    setNewSessionName('');
                                    setShowNewSessionDialog(true);
                                  }} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium transition-colors duration-150 active:scale-95 bg-emerald-600 text-white hover:bg-emerald-500 ring-1 ring-inset ring-white/15 shadow-sm shadow-black/40">
                                  <Plus className="w-3.5 h-3.5" />
                                  New Session
                                </button>
                                <ToolbarButton onClick={() => setShowImportSessionsDialog(true)}>
                                  <TerminalIcon className="w-3 h-3" />
                                  Import
                                </ToolbarButton>
                                <div className="ml-auto flex gap-1">
                                  <ToolbarButton onClick={async () => {
                                    await handleSaveWorkspace();
                                  }}>
                                    Save
                                  </ToolbarButton>
                                  <ToolbarButton onClick={async () => {
                                    const wsProjectId = propProjectId || selectedProject;
                                    if (!wsProjectId || !window.deskflowAPI?.listWorkspaces) return;
                                    setWorkspaceListLoading(true);
                                    try {
                                      const res = await window.deskflowAPI.listWorkspaces({ projectId: wsProjectId });
                                      if (res?.success && res.data) setWorkspaceList(res.data);
                                    } finally { setWorkspaceListLoading(false); }
                                    setShowWorkspaceLoadDialog(true);
                                  }}>
                                    Load
                                  </ToolbarButton>
                                  <ToolbarButton onClick={() => {
                                    setWorkspaceSaveAsName(workspaceName);
                                    setShowWorkspaceSaveAsDialog(true);
                                  }}>
                                    Save As...
                                  </ToolbarButton>
                                </div>
                              </div>
                             {sessions.length > 0 && (
                                <div className="space-y-2 mb-3">
                                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    {[{ key: 'all', label: 'All', color: 'zinc' }, ...Object.entries(SESSION_CATEGORIES).map(([k, v]) => ({ key: k, label: v.label, color: v.color || 'zinc' }))].map(f => {
                                      const dotColor: Record<string, string> = {
                                        zinc: 'bg-zinc-400', green: 'bg-green-400', blue: 'bg-blue-400',
                                        purple: 'bg-purple-400', amber: 'bg-amber-400', cyan: 'bg-cyan-400',
                                        red: 'bg-red-400', emerald: 'bg-emerald-400', pink: 'bg-pink-400',
                                        teal: 'bg-teal-400',
                                      };
                                      return (
                                        <Pill key={f.key} active={sessionCategoryFilter === f.key} onClick={() => setSessionCategoryFilter(f.key)} dotClass={dotColor[f.color]}>
                                          {f.label}
                                        </Pill>
                                      );
                                    })}
                                  </div>
                                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    <Pill key="all-sub" active={sessionSubpageFilter === 'all'} onClick={() => setSessionSubpageFilter('all')}>All Pages</Pill>
                                    {['setup/presets', 'setup/configs', 'work/sessions', 'work/map', 'work/files', 'insights/analytics', 'insights/code-stats', 'insights/issues', 'insights/bugs', 'insights/architecture', 'studio/skills', 'studio/design', 'context/context', 'context/context-maintenance', 'context/page-context'].map(sp => {
                                      const count = sessions.filter(s => (s.subpage || 'work/sessions') === sp).length;
                                      if (count === 0) return null;
                                      return (
                                        <Pill key={sp} active={sessionSubpageFilter === sp} onClick={() => setSessionSubpageFilter(sp)}>
                                          {SUBPAGE_LABELS[sp] || sp} ({count})
                                        </Pill>
                                      );
                                    })}
                                  </div>
                                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    <Pill key="all-agent" active={sessionAgentFilter === 'all'} onClick={() => setSessionAgentFilter('all')}>All Tools</Pill>
                                    {['opencode', 'claude', 'gemini', 'codex', 'aider'].map(ag => {
                                      const count = sessions.filter(s => s.agent === ag).length;
                                      if (count === 0) return null;
                                      return (
                                        <Pill key={ag} active={sessionAgentFilter === ag} onClick={() => setSessionAgentFilter(ag)}>
                                          {ag} ({count})
                                        </Pill>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            {sessions.length === 0 ? (
                                <EmptyState iconComponent={Clock} title="No sessions yet" hint="Create one using the button above." />
                             ) : (
                              (() => {
                                const filtered = sessions.filter(s => {
                                  if (sessionCategoryFilter !== 'all' && s.category !== sessionCategoryFilter) return false;
                                  if (sessionAgentFilter !== 'all' && s.agent !== sessionAgentFilter) return false;
                                  return true;
                                });
                                const groups: Record<string, Session[]> = {};
                                for (const s of filtered) {
                                  const sp = s.subpage || 'work/sessions';
                                  if (sessionSubpageFilter !== 'all' && sp !== sessionSubpageFilter) continue;
                                  if (!groups[sp]) groups[sp] = [];
                                  groups[sp].push(s);
                                }
                                const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
                                return (
                                  <div className="space-y-4">
                                    {sortedGroups.map(([sp, groupSessions]) => (
                                      <div key={sp}>
                                        <div className="flex items-center gap-2 mb-2 sticky top-0 bg-zinc-900/90 backdrop-blur z-10 py-1">
                                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{SUBPAGE_LABELS[sp] || sp}</span>
                                          <span className="text-[10px] text-zinc-600">{groupSessions.length} session{groupSessions.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="space-y-2">
                                          {groupSessions.map((session) => {
                                            const terminalInfo = session.terminal_id && terminalTabs[session.terminal_id]
                                              ? { name: terminalTabs[session.terminal_id].name, agent: terminalTabs[session.terminal_id].agent, isRunning: true }
                                              : null;
                                            const tags = (() => { try { return JSON.parse(session.auto_tags || '[]'); } catch { return []; } })();
                                            return (
                                    <div key={session.id}
                                         onClick={async () => { setSelectedSessionDetail(session.id); setSessionMessages([]); try { const r = await window.deskflowAPI?.getSessionMessages?.(session.id, session.agent); if (r?.success) setSessionMessages(r.data || []); } catch {} }}
                                         className="mb-2 p-2.5 bg-zinc-900/50 backdrop-blur-sm ring-1 ring-inset ring-zinc-800/70 rounded-lg group hover:ring-[color:var(--page-accent)]/35 hover:bg-zinc-900/70 transition-all duration-150 border-l-2 cursor-pointer"
                                         style={{ borderLeftColor: terminalInfo ? 'rgb(34 197 94 / 0.4)' : 'rgb(113 113 122 / 0.2)' }}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <StatusDot status={session.status} />
                                            <CategoryBadge category={session.category} />
                                            <span className="text-[10px] font-medium text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">{session.agent}</span>
                                            <span className="text-xs font-medium text-zinc-200 truncate">{session.topic || 'Unnamed Session'}</span>
                                            {terminalInfo ? (
                                              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                {terminalInfo.name}
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-zinc-500 bg-zinc-700/30 px-1.5 py-0.5 rounded">Closed</span>
                                            )}
                                          </div>
                                          {session.description && (
                                            <div className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{session.description}</div>
                                          )}
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-zinc-500">{formatDate(session.created_at)}</span>
                                            {session.product_area && (
                                              <span className="text-[10px] text-cyan-600/80">{session.product_area}</span>
                                            )}
                                            {session.resume_id && (
                                              <span className="text-[10px] text-cyan-600 font-mono">Resume: {session.resume_id.slice(-12)}&hellip;</span>
                                            )}
                                          </div>
                                          <SessionResourceStats stats={session.terminal_id ? resourceStats[session.terminal_id] : undefined} />
                                          {tags.length > 0 && (
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                              {tags.slice(0, 5).map((t: string, i: number) => (
                                                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-zinc-700/50 text-zinc-400 rounded">{t}</span>
                                              ))}
                                            </div>
                                          )}
                                          {session.total_cost !== undefined && (
                                            <div className="text-[10px] text-zinc-600 mt-0.5">Cost: ${session.total_cost.toFixed(2)}</div>
                                          )}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                          <button
                                            onClick={async () => {
                                              if (terminalInfo) {
                                                setActiveTerminalId(session.terminal_id!);
                                                window.dispatchEvent(new CustomEvent('focus-terminal', { detail: { terminalId: session.terminal_id } }));
                                              } else {
                                                handleResumeSession(session);
                                              }
                                            }}
                                            title={terminalInfo ? 'Focus terminal' : 'Open in terminal'}
                                            className="px-2 py-0.5 bg-green-600/60 hover:bg-green-500/80 text-green-200 text-[10px] font-medium rounded-md transition-colors duration-150 active:scale-95"
                                          >
                                            {terminalInfo ? 'Focus' : 'Open'}
                                          </button>
                                          <button
                                            onClick={async () => {
                                              setSelectedSessionDetail(session.id);
                                              setSessionMessages([]);
                                              try {
                                                const r = await window.deskflowAPI?.getSessionMessages?.(session.id, session.agent);
                                                if (r?.success) setSessionMessages(r.data || []);
                                              } catch {}
                                            }}
                                            title="View session details"
                                            className="px-2 py-0.5 bg-cyan-600/60 hover:bg-cyan-500/80 text-cyan-200 text-[10px] font-medium rounded-md transition-colors duration-150 active:scale-95"
                                          >
                                            Details
                                          </button>
                                          <button
                                            onClick={async () => {
                                              try {
                                                const result = await window.deskflowAPI?.getSessionMessages?.(session.id, session.agent);
                                                if (result?.success) {
                                                  setSessionMessages(result.data || []);
                                                  setShowMessagesViewer(session.id);
                                                }
                                              } catch {}
                                            }}
                                            title="View session messages"
                                            className="px-2 py-0.5 bg-zinc-600 hover:bg-zinc-500 text-zinc-200 text-[10px] rounded"
                                          >
                                            Messages
                                          </button>
                                          <button
                                            onClick={() => setConfirmDialog({
                                              isOpen: true,
                                              message: `Delete session "${session.topic}" permanently?`,
                                              onConfirm: () => handleDeleteSession(session.id),
                                            })}
                                            title="Delete session"
                                            className="px-2 py-0.5 bg-rose-600/50 hover:bg-rose-500/80 text-rose-200 text-[10px] font-medium rounded-md transition-colors duration-150 active:scale-95"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                         )}
                      </div>
                    </div>
                    </GroupPanel>
                  );
                  case 'workspaces': return (
                    <GroupPanel accent="green">
                      <WorkspacesPanel
                        projectId={propProjectId || selectedProject}
                        currentName={workspaceName}
                        onLoad={handleLoadWorkspace}
                        onSaveCurrent={handleSaveWorkspace}
                      />
                    </GroupPanel>
                  );
                  case 'map': return (
                    <GroupPanel accent="green">
                      <div className="relative flex-1 min-h-0">
                        <div className="p-3 space-y-3">
                        <p className="text-xs text-zinc-500">Drag panes to rearrange or split • Click to focus</p>
                        <div className="min-h-0 overflow-hidden" style={{ flex: mapListRatio }}>
                          {terminalLayout ? (
                            <TerminalMiniMap
                              layouts={getGroupTrees(terminalLayout)}
                              activeTerminalId={activeTerminalId}
                              onTerminalSelect={handleMiniMapTerminalSelect}
                              onTerminalMove={handleMiniMapTerminalMove}
                              onSplit={handleMiniMapSplit}
                              onToggleDirection={handleMiniMapToggleDirection}
                              onMoveToGroup={handleMiniMapMoveToGroup}
                            />
                          ) : (
                            <p className="text-xs text-zinc-600 mb-4">No terminals open</p>
                          )}
                        </div>

                        <div
                          onMouseDown={(e) => {
                            mapResizeRef.current = { startY: e.clientY, startRatio: mapListRatio };
                            const handleMouseMove = (me: MouseEvent) => {
                              if (!mapResizeRef.current) return;
                              const parent = (me.target as HTMLElement).closest('[data-map-container]') as HTMLElement | null;
                              if (!parent) return;
                              const rect = parent.getBoundingClientRect();
                              const deltaY = me.clientY - mapResizeRef.current.startY;
                              const newRatio = Math.max(0.2, Math.min(0.8, mapResizeRef.current.startRatio + deltaY / rect.height));
                              setMapListRatio(newRatio);
                            };
                            const handleMouseUp = () => {
                              mapResizeRef.current = null;
                              window.removeEventListener('mousemove', handleMouseMove);
                              window.removeEventListener('mouseup', handleMouseUp);
                            };
                            window.addEventListener('mousemove', handleMouseMove);
                            window.addEventListener('mouseup', handleMouseUp);
                          }}
                          className="relative h-1.5 cursor-row-resize hover:bg-zinc-700/30 rounded transition-colors"
                        >
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-0.5 bg-zinc-600 rounded-full" />
                        </div>

                        <div className="min-h-0 overflow-hidden border-t border-zinc-800 pt-2" style={{ flex: 1 - mapListRatio }}>
                          <SectionCard accent="green" title="Running Terminals">
                            <div className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              {Object.keys(terminalTabs).length} active
                            </div>
                            {Object.keys(terminalTabs).length === 0 ? (
                              <p className="text-xs text-zinc-600 px-2 mb-3">No running terminals</p>
                            ) : (
                              <div className="space-y-2 mb-4">
                                {(() => {
                                  const groups = extractGroups(terminalLayout);
                                  return groups.length > 0 ? groups.map((group, gi) => (
                                    <div key={gi} className="bg-zinc-800/20 border border-zinc-700/30 rounded-lg overflow-hidden">
                                      <div className="px-2 py-1 bg-zinc-800/40 border-b border-zinc-700/20 flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-zinc-500">Group {gi + 1}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] text-zinc-600">{group.direction === 'vertical' ? '↕ Stack' : group.direction === 'horizontal' ? '↔ Side-by-side' : '—'}</span>
                                          <span className="text-[9px] text-zinc-600">{group.terminals.length} terminal{group.terminals.length !== 1 ? 's' : ''}</span>
                                        </div>
                                      </div>
                                      <div className="p-1.5 space-y-1">
                                        {group.terminals.map(tid => {
                                          const tab = terminalTabs[tid];
                                          if (!tab) return null;
                                          const sessionInTerminal = sessions.find(s => s.terminal_id === tid);
                                          return (
                                            <div key={tid} className={`p-2 rounded border transition-all duration-150 ${
                                              activeTerminalId === tid
                                                ? 'bg-zinc-700/80 border-zinc-600/50 shadow-[0_0_10px_rgba(0,0,0,0.2)]'
                                                : 'bg-zinc-800/50 border-zinc-700/30 hover:bg-zinc-700/50'
                                            }`}>
                                              <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-xs font-medium text-zinc-200 truncate">{tab.name}</div>
                                                  <div className="text-[10px] text-zinc-500">{tab.agent}</div>
                                                </div>
                                                {activeTerminalId === tid && (
                                                  <span className="text-[10px] text-green-400">active</span>
                                                )}
                                              </div>
                                              {sessionInTerminal ? (
                                                <div className="mt-1.5 ml-4 pl-2 border-l-2 border-cyan-500/30">
                                                  <div className="flex items-center gap-1 flex-wrap">
                                                    <span className="text-[10px] text-cyan-400">Session:</span>
                                                    <CategoryBadge category={sessionInTerminal.category} />
                                                    <StatusDot status={sessionInTerminal.status} />
                                                    <span className="text-[10px] text-zinc-300 truncate">{sessionInTerminal.topic || 'Unnamed'}</span>
                                                  </div>
                                                  <div className="text-[9px] text-zinc-600 mt-0.5">{sessionInTerminal.agent} • {formatDate(sessionInTerminal.created_at)}</div>
                                                </div>
                                              ) : (
                                                <div className="mt-1.5 ml-4 pl-2 border-l-2 border-zinc-700/30">
                                                  <div className="text-[9px] text-zinc-500">No session — ready to assign</div>
                                                </div>
                                              )}
                                              <div className="flex gap-1 mt-1.5">
                                                <button
                                                  onClick={() => { setActiveTerminalId(tid); window.dispatchEvent(new CustomEvent('focus-terminal', { detail: { terminalId: tid } })); }}
                                                  className="flex-1 px-1.5 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[9px] rounded"
                                                >
                                                  Focus
                                                </button>
                                                {!sessionInTerminal && (
                                                  <button
                                                    onClick={() => {
                                                      const event = new CustomEvent('open-new-session-for-terminal', { detail: { terminalId: tid } });
                                                      window.dispatchEvent(event);
                                                    }}
                                                    className="flex-1 px-1.5 py-0.5 bg-cyan-700 hover:bg-cyan-600 text-cyan-200 text-[9px] rounded"
                                                  >
                                                    New Session
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )) : (
                                    <p className="text-[10px] text-zinc-500">No layout groups defined.</p>
                                  );
                                })()}
                              </div>
                            )}
                          </SectionCard>
                        </div>
                       </div>
                     </div>
                    </GroupPanel>
                  );
                  case 'files': return (
                    <GroupPanel accent="yellow">
                      <FilesTab projectId={selectedProject} projectPath={propProjectPath} projects={projects} onSelectProject={setSelectedProject} />
                    </GroupPanel>
                  );
                  default: return null;
                }
              }} />
            )}

            {activeGroup === 'insights' && (
              <WorkspaceShell accent="purple" tabs={[
                { key: 'analytics', icon: PieChart, label: 'Analytics' },
                { key: 'code-stats', icon: BarChart3, label: 'Code Stats' },
                { key: 'history', icon: MessageSquare, label: 'Prompts' },
                { key: 'issues', icon: ListChecks, label: 'Issues' },
                { key: 'performance', icon: Activity, label: 'Performance' },
                { key: 'bugs', icon: Bug, label: 'Bugs' },
                { key: 'architecture', icon: Network, label: 'Architecture' },
              ]} storageKey="insights" render={(sub) => {
                switch (sub) {
                  case 'analytics': return (
                    <GroupPanel accent="purple">
                      <div className="flex gap-1.5">
                        {(['7d', '30d', 'all'] as const).map(p => (
                          <Pill key={p} active={analyticsPeriod === p} onClick={() => setAnalyticsPeriod(p)}>
                            {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : 'All Time'}
                          </Pill>
                        ))}
                      </div>
                      <AnalyticsDashboard
                        aiUsage={aiSummary}
                        sessions={sessions}
                        problems={analyticsProblems}
                        requests={analyticsRequests}
                        promptHistory={analyticsPromptHistory}
                        dailyStats={analyticsDailyStats}
                        codeStats={analyticsCodeStats}
                        loading={analyticsLoading}
                        period={analyticsPeriod}
                        variant="full"
                      />
                    </GroupPanel>
                  );
                  case 'code-stats': return (
                    <GroupPanel accent="purple">
                      <CodeStatsTab projectId={selectedProject} projectPath={propProjectPath} />
                    </GroupPanel>
                  );
                  case 'performance': return (
                    <GroupPanel accent="purple">
                      <PerformanceMetricsPanel projectId={selectedProject} projectPath={propProjectPath} />
                    </GroupPanel>
                  );
                  case 'history': return (
                    <GroupPanel accent="purple">
                      <PromptHistoryTab
                        projectId={selectedProject || undefined}
                        projectPath={propProjectPath}
                        onNavigateToSession={(sessionId) => {
                          setActiveGroup('work');
                          localStorage.setItem('workspace-subtab-work', 'sessions');
                          setSelectedSessionDetail(sessionId);
                        }}
                      />
                    </GroupPanel>
                  );
                  case 'issues': return (
                    <GroupPanel accent="emerald">
                      <IssuesWorkspace projectId={selectedProject} projectPath={propProjectPath} activeTerminalId={activeTerminalId} sessions={sessions} />
                    </GroupPanel>
                  );
                  case 'bugs': return (
                    <GroupPanel accent="purple">
                      <BugReportPanel projectId={selectedProject} />
                    </GroupPanel>
                  );
                  case 'architecture': return (
                    <GroupPanel accent="purple">
                      <ArchMapPage />
                    </GroupPanel>
                  );
                  default: return null;
                }
              }} />
            )}

            {activeGroup === 'studio' && (
              <WorkspaceShell accent="indigo" tabs={[
                { key: 'skills', icon: Sparkles, label: 'Skills' },
                { key: 'styles', icon: SwatchBook, label: 'Styles' },
                { key: 'design', icon: Palette, label: 'Design' },
              ]} storageKey="studio" render={(sub) => {
                switch (sub) {
                  case 'skills': return (
                    <GroupPanel accent="indigo">
                      <SkillsTab
                        projectPath={propProjectPath || projects.find(p => p.id === selectedProject)?.path || ''}
                        terminalTabs={terminalTabs}
                        activeTerminalId={activeTerminalId}
                        onAddToCompose={(skillId) => {
                          setComposeSkills(prev => prev.includes(skillId) ? prev : [...prev, skillId]);
                          setShowInstructionPanel(true);
                        }}
                      />
                    </GroupPanel>
                  );
                  case 'styles': return (
                    <GroupPanel accent="indigo">
                      <DesignStudioTab />
                    </GroupPanel>
                  );
                  case 'design': return (
                    <GroupPanel accent="pink">
                      <DesignWorkspacePage
                        projectPath={propProjectPath || projects.find(p => p.id === selectedProject)?.path || ''}
                        activeTerminalId={activeTerminalId}
                      />
                    </GroupPanel>
                  );
                  default: return null;
                }
              }} />
            )}

            {activeGroup === 'conductor' && (
              <WorkspaceShell accent="rose" tabs={[
                { key: 'missions', icon: Bot, label: 'Missions' },
                { key: 'approvals', icon: Shield, label: 'Approvals' },
                { key: 'trace', icon: Activity, label: 'Trace' },
                { key: 'budget', icon: Coins, label: 'Budget' },
                { key: 'providers', icon: Zap, label: 'Providers' },
                { key: 'templates', icon: Sparkles, label: 'Templates' },
                { key: 'settings', icon: Settings, label: 'Settings' },
              ]} storageKey="conductor" render={(sub) => {
                return (
                  <GroupPanel accent="rose">
                    <ConductorWorkspaceTab activeTab={sub} projectId={selectedProject || propProjectId || undefined} repoPath={propProjectPath} userBranch="main" />
                  </GroupPanel>
                );
              }} />
            )}

            {activeGroup === 'ai-gateway' && (
              <WorkspaceShell accent="cyan" tabs={[
                { key: 'status', icon: Activity, label: 'Status' },
                { key: 'chat', icon: MessageSquare, label: 'Chat' },
                { key: 'providers', icon: Globe, label: 'Providers' },
                { key: 'runs', icon: Clock, label: 'Runs' },
                { key: 'settings', icon: Settings, label: 'Settings' },
              ]} storageKey="ai-gateway" render={(sub) => {
                return (
                  <GroupPanel accent="cyan">
                    <AIGatewayTab activeTab={sub} />
                  </GroupPanel>
                );
              }} />
            )}

            {activeGroup === 'context' && (
              <WorkspaceShell accent="amber" tabs={[
                { key: 'context', icon: Settings2, label: 'Context' },
                { key: 'context-brain', icon: Brain, label: 'Brain' },
                { key: 'context-maintenance', icon: Database, label: 'Maintenance' },
                { key: 'context-map', icon: Network, label: 'Architecture Map' },
                { key: 'dictionary', icon: BookOpen, label: 'Dictionary' },
              ]} storageKey="context" render={(sub) => {
                switch (sub) {
                  case 'context': return (
                    <GroupPanel accent="amber">
                      <ContextSidebar
                        projectId={selectedProject || propProjectId || undefined}
                        projectPath={propProjectPath}
                      />
                    </GroupPanel>
                  );
                  case 'context-brain': return (
                    <GroupPanel accent="violet">
                      <BrainManagementView />
                    </GroupPanel>
                  );
                  case 'context-maintenance': return (
                    <GroupPanel accent="violet">
                      <ContextMaintenanceTab
                        projectId={selectedProject || ''}
                        projectPath={propProjectPath || ''}
                        sessionId={selectedSessionDetail || undefined}
                      />
                    </GroupPanel>
                  );
                  case 'context-map': return (
                    <GroupPanel accent="cyan">
                       <CodeArchitectureMap projectPath={propProjectPath || ''} />
                    </GroupPanel>
                  );
                  case 'dictionary': return (
                    <GroupPanel accent="amber">
                      <UserDictionaryPanel />
                    </GroupPanel>
                  );
                  default: return null;
                }
              }} />
            )}


            <NewSessionDialog
              open={showNewSessionDialog}
              mode={newSessionMode}
              defaultName={openCodeSessionName || undefined}
              projectId={propProjectId || selectedProject || undefined}
              projectPath={propProjectPath || projects.find(p => p.id === selectedProject)?.path || ''}
              terminalTabs={terminalTabs}
              defaultAgent={newSessionAgent || 'claude'}
              initialTerminalMode={newSessionTerminalMode}
              initialSelectedTerminal={newSessionSelectedTerminal || undefined}
              onClose={() => { setShowNewSessionDialog(false); setNewSessionSelectedTerminal(''); }}
              onCreate={async (config: SessionConfig) => {
                const proj = projects.find(p => p.id === selectedProject);
                const cwd = propProjectPath || proj?.path || '';
                const agent = config.agentType;
                const sessionName = config.name.trim() || `Session ${sessions.length + 1}`;
                localStorage.setItem('terminal-defaultAgent', agent);
                setShowNewSessionDialog(false);

                // Show session in list immediately
                const optimisticSession: Session = {
                  id: config.id,
                  agent,
                  topic: sessionName,
                  created_at: new Date().toISOString(),
                  status: 'initializing',
                };
                setSessions(prev => [optimisticSession, ...prev]);

                // Resolve init content
                let initContent = config.initContent || '';
                if (!config.resumeId && !config.initContent) {
                  if (config.includeDefaultInit) {
                    const dflt = await window.deskflowAPI?.readProjectFile?.('INITIALIZE.md', cwd);
                    if (dflt?.success && dflt.data) initContent = dflt.data;
                  }
                  if (config.initializeFile) {
                    const cust = await window.deskflowAPI?.readInitFile?.(config.initializeFile, cwd);
                    if (cust?.success && cust.data) {
                      initContent = initContent ? `${initContent}\n\n${cust.data}` : cust.data;
                    }
                  }
                  if (config.problemIds?.length) {
                    const ctx = config.problemIds.map(id => `- ${allProblems.find(p => p.id === id)?.title || id}`).join('\n');
                    initContent += `\n## Context: Problems\n${ctx}\n`;
                  }
                  if (config.requestIds?.length) {
                    const ctx = config.requestIds.map(id => `- ${allRequests.find(r => r.id === id)?.title || id}`).join('\n');
                    initContent += `\n## Context: Requests\n${ctx}\n`;
                  }
                }
                // ═══ CONTEXT ASSEMBLY ═══
                // 1. Renderer-side context (state.md, MEMORY.md, knowledge systems)
                if (!config.resumeId && selectedProject && sessionName.length > 1) {
                  try {
                    const api = (window as any).deskflowAPI
                    if (api?.assembleContext) {
                      const rendererContext = await api.assembleContext({ projectId: selectedProject, topic: sessionName, tokenBudget: 2000 })
                      if (rendererContext && rendererContext.trim().length > 0) {
                        initContent += `\n\n${rendererContext}`
                      }
                    }
                  } catch (e) {
                    console.warn('[NewSession] ContextService assembly failed (non-fatal):', e)
                  }
                }
                // 2. Backend context (brain, memory, problems, requests, page, cross-session)
                if (!config.resumeId && selectedProject && sessionName.length > 1) {
                  try {
                    const assembled = await (window.deskflowAPI as any).assembleContext?.({
                      projectId: selectedProject,
                      sessionId: config.id,
                      topic: sessionName,
                      problemIds: config.problemIds,
                      requestIds: config.requestIds,
                      tokenBudget: 4000,
                    });
                    if (assembled && typeof assembled === 'string' && assembled.trim()) {
                      initContent += `\n\n${assembled}`;
                    }
                  } catch (e) {
                    console.warn('[NewSession] Backend context assembly failed (non-fatal):', e);
                  }
                }

                const systemPrompt = config.customSystemPrompt || undefined;

                // ═══ DETERMINE TERMINAL ═══
                let targetTerminalId = '';
                const isNewTerminal = config.terminalMode !== 'select' || !config.selectedTerminal;

                if (isNewTerminal) {
                  // ── CREATE NEW TERMINAL ──
                  targetTerminalId = generateTerminalId();
                  setTerminalTabs(prev => ({ ...prev, [targetTerminalId]: { name: proj?.name || sessionName, agent, modelTier: config.modelTier || config.contextConfig?.model_tier || 'mid' } }));
                  setActiveTerminalId(targetTerminalId);
                  const updatedLayout = insertIntoLayout(terminalLayout, targetTerminalId);
                  setTerminalLayout(updatedLayout);
                  saveLayout(updatedLayout);
                  sessionTerminalsRef.current.add(targetTerminalId);

                  // Spawn PTY
                  if (!window.deskflowAPI?.spawnTerminal) {
                    console.error('[NewSession] Terminal API not available');
                    return;
                  }
                  // Mark spawned BEFORE await so TerminalWindow's handleTerminalReady
                  // sees the ref and doesn't double-spawn (race condition fix)
                  window.dispatchEvent(new CustomEvent('terminal:mark-spawned', { detail: { terminalId: targetTerminalId } }));
                  const spawnRes = await window.deskflowAPI.spawnTerminal(targetTerminalId, cwd, agent);
                  if (!spawnRes?.success) {
                    console.error('[NewSession] Failed to spawn:', spawnRes?.error);
                    window.dispatchEvent(new CustomEvent('terminal-cleanup', { detail: { terminalId: targetTerminalId } }));
                    return;
                  }

                  // Register and initialize
                  await registerTerminal(targetTerminalId, agent);
                  await initializeTerminal(targetTerminalId, agent, config.resumeId, initContent, systemPrompt, cwd);
                } else {
                  // ── REUSE EXISTING TERMINAL ──
                  targetTerminalId = config.selectedTerminal!;
                  setActiveTerminalId(targetTerminalId);

                  // Use initializeTerminal to properly launch agent (with correct resume flags)
                  await initializeTerminal(targetTerminalId, agent, config.resumeId, initContent, systemPrompt, cwd);
                }

                // ═══ SAVE SESSION TO DB ═══
                const sesResumeId = config.resumeId || undefined;
                const subtab = localStorage.getItem(`workspace-subtab-${activeGroup}`) || 'sessions';
                const sessionResult = await window.deskflowAPI?.saveTerminalSession?.({
                  id: config.id,
                  projectId: selectedProject,
                  agent,
                  resumeId: sesResumeId,
                  terminalId: targetTerminalId,
                  topic: sessionName,
                  workingDirectory: proj?.path || '',
                  description: initContent || '',
                  autoNamed: 1,
                  subpage: `${activeGroup}/${subtab}`,
                });
                if (sessionResult?.success) {
                  await window.deskflowAPI?.saveSessionConfig?.(config.id, config, proj?.path);
                  loadSessions();
                  showError(`Session "${sessionName}" started in terminal`, 'info');
                  setNewSessionSelectedTerminal('');
                } else {
                  setSessions(prev => prev.filter(s => s.id !== config.id));
                  showError('Failed to save session', 'error');
                }

                // ═══ CAPTURE REAL OPENCODE SESSION ID ═══
                if (cwd && !config.resumeId) {
                  try {
                    const capResult = await (window.deskflowAPI as any)?.captureOpencodeSessionId?.(cwd, Date.now() - 10000);
                    if (capResult?.success && capResult.sessionId) {
                      console.log('[NewSession] Captured opencode session:', capResult.sessionId);
                      const updateBanner = `\r\n[captured] opencode session ${capResult.sessionId}\r\n`;
                      (window.deskflowAPI as any)?.terminalWriteDisplay?.(targetTerminalId, updateBanner);
                    }
                  } catch (e) {
                    console.warn('[NewSession] Session capture failed:', e);
                  }
                }

                // ═══ BACKGROUND CAPTURE real opencode session ID (only for new sessions) ═══
                if (cwd && !config.resumeId) {
                  (async () => {
                    await new Promise(r => setTimeout(r, 5000));
                    try {
                      if (!window.deskflowAPI) return;
                      const capResult = await (window.deskflowAPI as any).captureOpencodeSessionId?.(cwd, Date.now() - 10000);
                      if (capResult?.success && capResult.sessionId) {
                        await (window.deskflowAPI as any).updateSessionResumeId?.(config.id, capResult.sessionId);
                        console.log('[TerminalPage] Captured opencode session:', capResult.sessionId, 'for', cwd);
                        loadSessions();
                        const updateBanner = `\r\n[resume] captured real opencode session ${capResult.sessionId} (source: db)\r\n`;
                        (window.deskflowAPI as any)?.terminalWriteDisplay?.(targetTerminalId, updateBanner);
                      } else {
                        console.log('[TerminalPage] No opencode session found yet for', cwd, capResult?.reason);
                      }
                    } catch (e) {
                      console.warn('[TerminalPage] Background capture failed:', e);
                    }
                  })();
                }
              }}
              problems={allProblems}
              requests={allRequests}
            />

            {showImportSessionsDialog && (
              <ImportSessionsDialog
                onClose={() => setShowImportSessionsDialog(false)}
                onImport={handleImportOpencodeSessions}
                projectId={propProjectId}
              />
            )}

            {/* Features Dialog */}
            {showFeaturesDialog && (
              <FeaturesDialog onClose={() => setShowFeaturesDialog(false)} />
            )}

            {/* Generalist Dialog */}
            {showGeneralistDialog && (
              <GeneralistDialog onClose={() => setShowGeneralistDialog(false)} />
            )}

            {/* Routing toast */}
            {showRoutingToast && (
              <RoutingToast
                sessionName={routingToastSession}
                onCancel={handleRoutingCancel}
                onConfirm={handleRoutingConfirm}
              />
            )}
            {/* File conflict toasts */}
            {fileConflicts.map((conflict, idx) => (
              <div key={idx} className="fixed bottom-20 right-4 z-50 max-w-sm bg-yellow-900/90 border border-yellow-600 rounded-lg p-3 shadow-lg animate-in slide-in-from-bottom-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-yellow-200">File Conflict</p>
                    <p className="text-[11px] text-yellow-300/80 mt-0.5 truncate">{conflict.filePath}</p>
                    <p className="text-[10px] text-yellow-400/60 mt-0.5">
                      {conflict.lockingTerminal} is editing → {conflict.requestingTerminal} wants access
                    </p>
                  </div>
                  <button
                    onClick={() => setFileConflicts(prev => prev.filter((_, i) => i !== idx))}
                    className="text-yellow-400/60 hover:text-yellow-300 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {/* Disambiguation dialog */}
            {showDisambiguation && (
              <RoutingDisambiguationDialog
                candidates={disambiguationCandidates}
                onSelectSession={handleDisambiguationSelect}
                onCreateNew={handleDisambiguationCreateNew}
                onCancel={() => { setShowDisambiguation(false); setPendingPrompt(null); }}
              />
            )}
            {/* Routing spinner */}
            {isRouting && (
              <div className="flex items-center gap-1.5 text-cyan-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">Routing...</span>
              </div>
            )}
            {/* Initialize Progress Modal */}
            <InitializeProgressModal
              isOpen={showInitModal}
              onClose={() => {
                setShowInitModal(false);
                if (initStatus !== 'init-ok') setInitStatus('init-ok');
              }}
              onComplete={() => setInitStatus('init-ok')}
              projectId={selectedProject || propProjectId || undefined}
              projectPath={propProjectPath || projects.find(p => p.id === (selectedProject || propProjectId))?.path}
              isReinit={initStatus === 'init-ok'}
              onSeedWithAgent={async ({ agent, prompt, projectPath: seedPath }) => {
                const terminalId = `seed-${Date.now()}`;
                const cwd = seedPath || propProjectPath || '';
                try {
                  const spawnRes = await window.deskflowAPI?.spawnTerminal?.(terminalId, cwd);
                  if (!spawnRes?.success) {
                    return { success: false, error: spawnRes?.error || 'Failed to spawn terminal' };
                  }
                  await new Promise(r => setTimeout(r, 1000));
                  const cdCmd = cwd ? `cd "${cwd}"\r\n` : '';
                  const launchCmd = `${cdCmd}${agent}\r\n`;
                  await window.deskflowAPI?.terminalWrite?.(terminalId, launchCmd);
                  await new Promise(r => setTimeout(r, 5000));
                  await window.deskflowAPI?.terminalWrite?.(terminalId, prompt + '\r\n');
                  return { success: true, terminalId };
                } catch (e: any) {
                  return { success: false, error: e?.message || 'Unknown error' };
                }
              }}
            />

            {showMessagesViewer && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)]">
                <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.5)]" />
                      <h2 className="text-base font-bold text-white">Session Messages</h2>
                    </div>
                    <button onClick={() => setShowMessagesViewer(null)} className={WS_ICON_BTN}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="px-4 py-2.5 border-b border-zinc-800/50">
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input
                        type="text"
                        value={messagesSearchQuery}
                        onChange={(e) => setMessagesSearchQuery(e.target.value)}
                        placeholder="Search messages..."
                        className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800/60 rounded text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-colors duration-150"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {sessionMessages.length === 0 ? (
                      <EmptyState iconComponent={MessageSquare} title="No messages" hint="No messages recorded for this session." />
                    ) : (() => {
                      const filtered = messagesSearchQuery
                        ? sessionMessages.filter(m => m.content && m.content.toLowerCase().includes(messagesSearchQuery.toLowerCase()))
                        : sessionMessages;
                      if (filtered.length === 0) {
                        return <p className="text-xs text-zinc-500 text-center py-4">No messages match your search.</p>;
                      }
                      return filtered.slice(0, 500).map((msg, i) => {
                        const roleColor = msg.role === 'user' ? 'cyan' : msg.role === 'system' ? 'amber' : 'emerald';
                        const colorMap = { cyan: { bg: 'bg-cyan-900/15', border: 'border-cyan-800/20', dot: 'bg-cyan-400', text: 'text-cyan-300', tag: 'bg-cyan-500/20' }, amber: { bg: 'bg-amber-900/15', border: 'border-amber-800/20', dot: 'bg-amber-400', text: 'text-amber-300', tag: 'bg-amber-500/20' }, emerald: { bg: 'bg-emerald-900/15', border: 'border-emerald-800/20', dot: 'bg-emerald-400', text: 'text-emerald-300', tag: 'bg-emerald-500/20' } };
                        const c = colorMap[roleColor];
                        return (
                          <div key={i} className={`group flex items-start gap-3 p-3 rounded-xl ${c.bg} border ${c.border} transition-colors duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${msg.role === 'user' ? 'ml-8' : msg.role === 'system' ? '' : 'mr-8'}`}>
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${c.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${c.text}`}>{msg.role}</span>
                                {msg.created_at && <span className="text-[10px] text-zinc-600">{new Date(msg.created_at).toLocaleTimeString()}</span>}
                              </div>
                              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono break-words max-h-40 overflow-y-auto leading-relaxed">{stripAnsi(msg.content)}</pre>
                            </div>
                          </div>
                        );
                      });
                    })()}
                    {!messagesSearchQuery && sessionMessages.length > 500 && (
                      <p className="text-xs text-zinc-500 text-center py-2 border-t border-zinc-800/30 mt-2">... and {sessionMessages.length - 500} more messages</p>
                    )}
                    {messagesSearchQuery && (
                      <p className="text-xs text-zinc-600 text-center py-1">{sessionMessages.filter(m => m.content && m.content.toLowerCase().includes(messagesSearchQuery.toLowerCase())).length} of {sessionMessages.length} messages</p>
                    )}
                  </div>
                  <div className="px-6 py-3 border-t border-zinc-800/50 flex justify-between items-center">
                    <span className="text-xs text-zinc-600">{sessionMessages.length} message{sessionMessages.length !== 1 ? 's' : ''} total</span>
                    <ToolbarButton onClick={() => setShowMessagesViewer(null)}>Close</ToolbarButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Edit Dialog */}
      <SessionEditDialog
        session={sessionToEdit}
        onClose={() => setSessionToEdit(null)}
        onSave={handleSaveSession}
      />

      {/* Save Checkpoint Dialog */}
      <Modal open={showSaveDialog} onClose={() => setShowSaveDialog(false)} title="Save Checkpoint" footer={
        <div className="flex gap-2">
          <button onClick={() => setShowSaveDialog(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <ToolbarButton variant="primary" disabled={!saveDialogName.trim()} onClick={handleSaveCheckpointSubmit}>Save</ToolbarButton>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Workspace Name</label>
            <input
              type="text"
              value={saveDialogName}
              onChange={(e) => setSaveDialogName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCheckpointSubmit()}
              className="w-full bg-zinc-950 border border-zinc-800/60 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. Fix login bug"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Close Workspace Dialog */}
      {showCloseWorkspaceDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowCloseWorkspaceDialog(false)}>
          <GlassCard className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-2">Close Workspace</h2>
            <p className="text-sm text-zinc-400 mb-6">Save a checkpoint before closing, or discard changes?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  setShowCloseWorkspaceDialog(false);
                  await handleSaveWorkspace();
                  onCloseWorkspace?.();
                }}
                className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded text-sm font-medium"
              >
                Save & Close
              </button>
              <button
                onClick={() => {
                  setShowCloseWorkspaceDialog(false);
                  onCloseWorkspace?.();
                }}
                className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-sm"
              >
                Discard & Close
              </button>
              <button
                onClick={() => setShowCloseWorkspaceDialog(false)}
                className="w-full px-4 py-2 text-zinc-500 hover:text-zinc-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Confirm Dialog */}
      <Modal open={confirmDialog.isOpen} onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} title="Confirm" width="max-w-sm" footer={
        <div className="flex gap-2 w-full">
          <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors rounded-md bg-zinc-800 hover:bg-zinc-700">Cancel</button>
          <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, isOpen: false })); }} className="flex-1 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-md font-medium">Delete</button>
        </div>
      }>
        <p className="text-xs text-zinc-300">{confirmDialog.message}</p>
      </Modal>

      {/* Session context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-zinc-900 border border-zinc-800/60 rounded-lg py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-2.5 py-1.5 text-[10px] text-zinc-500 border-b border-zinc-800/60">Open in Terminal</div>
            {Object.entries(terminalTabs).length === 0 ? (
              <div className="px-2.5 py-2 text-[10px] text-zinc-600">No running terminals</div>
            ) : (
              Object.entries(terminalTabs).map(([tid, tab]) => {
                const hasSession = sessions.some(s => s.terminal_id === tid);
                return (
                  <button
                    key={tid}
                    onClick={() => {
                      handleOpenSessionInTerminal(contextMenu.session, tid);
                      setContextMenu(null);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs text-left text-zinc-300 hover:bg-zinc-800/80 transition-colors flex items-center gap-2"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasSession ? 'bg-amber-400' : 'bg-green-400'}`} />
                    <span className="flex-1 truncate">{tab.name}</span>
                    {hasSession && <span className="text-[9px] text-amber-400">occupied</span>}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Workspace Save As Dialog */}
      <Modal open={showWorkspaceSaveAsDialog} onClose={() => setShowWorkspaceSaveAsDialog(false)} title="Save Workspace As" footer={
        <div className="flex gap-2">
          <button onClick={() => setShowWorkspaceSaveAsDialog(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <ToolbarButton variant="primary" disabled={!workspaceSaveAsName.trim()} onClick={async () => {
            await handleSaveWorkspace(workspaceSaveAsName.trim());
            setShowWorkspaceSaveAsDialog(false);
          }}>Save</ToolbarButton>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Workspace Name</label>
            <input
              type="text"
              value={workspaceSaveAsName}
              onChange={(e) => setWorkspaceSaveAsName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && workspaceSaveAsName.trim() && handleSaveWorkspace(workspaceSaveAsName.trim()).then(() => setShowWorkspaceSaveAsDialog(false))}
              className="w-full bg-zinc-950 border border-zinc-800/60 rounded px-3 py-2 text-white text-sm"
              placeholder="e.g. Bug fixing session"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-zinc-500">Saves the current terminal layout, sidebar config, and all page states to a named workspace instance for this project.</p>
        </div>
      </Modal>

      {/* Workspace Load Dialog */}
      <Modal open={showWorkspaceLoadDialog} onClose={() => setShowWorkspaceLoadDialog(false)} title="Load Workspace" footer={
        <div className="flex gap-2">
          <button onClick={() => setShowWorkspaceLoadDialog(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">Close</button>
        </div>
      }>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {workspaceListLoading ? (
            <p className="text-xs text-zinc-500 py-4 text-center">Loading...</p>
          ) : workspaceList.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4 text-center">No saved workspaces yet.</p>
          ) : (
            workspaceList.map((ws) => (
              <button
                key={ws.name}
                onClick={async () => {
                  await handleLoadWorkspace(ws.name);
                  setShowWorkspaceLoadDialog(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${ws.isActive ? 'bg-green-900/30 border border-green-700/50' : 'bg-zinc-900/50 border border-zinc-800/60 hover:bg-zinc-800/80'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${ws.isActive ? 'bg-green-400' : 'bg-zinc-600'}`} />
                  <div>
                    <div className="text-xs font-medium text-zinc-200">{ws.name}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {ws.activeTab ? ws.activeTab.charAt(0).toUpperCase() + ws.activeTab.slice(1) : 'Setup'} &middot; {ws.sidebarWidth}px
                    </div>
                  </div>
                </div>
            <div className="flex items-center gap-0.5 shrink-0">
                  {ws.isActive && <span className="text-[10px] text-green-400 mr-1">active</span>}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete workspace "${ws.name}"?`)) {
                        const wsProjectId = propProjectId || selectedProject;
                        if (wsProjectId && window.deskflowAPI?.deleteWorkspace) {
                          await window.deskflowAPI.deleteWorkspace({ projectId: wsProjectId, name: ws.name });
                          const res = await window.deskflowAPI.listWorkspaces({ projectId: wsProjectId });
                          if (res?.success) setWorkspaceList(res.data || []);
                        }
                      }
                    }}
                    className="text-zinc-600 hover:text-red-400 text-[10px] px-1 opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Collapsed sidebar strip */}
      {!sidebarOpen && (
        <div className="h-full w-12 bg-zinc-950 ws-sidebar-edge flex flex-col items-center gap-2 py-3">
          <motion.button
            whileHover={{ scale: 1.2, y: -2 }}
            whileTap={{ scale: 0.9 }}
            title="Workspace Features"
            className={`${WS_ICON_BTN} ws-tip`}
            data-tip="Features"
            onClick={() => setShowFeaturesDialog(true)}
          >
            <Info className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.2, y: -2 }}
            whileTap={{ scale: 0.9 }}
            title="Skill Configuration"
            className={`${WS_ICON_BTN} ws-tip`}
            data-tip="Skills"
            onClick={() => setShowGeneralistDialog(true)}
          >
            <BookOpen className="w-5 h-5" />
          </motion.button>
          <div className="w-6 h-px bg-zinc-800 my-1" />
          <motion.button
            whileHover={{ scale: 1.2, y: -2 }}
            whileTap={{ scale: 0.9 }}
            title="Expand sidebar"
            className={`${WS_ICON_BTN} ws-tip`}
            data-tip="Expand"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="w-5 h-5" />
          </motion.button>
        </div>
      )}

      {/* Selection Engine — scoped to the workspace */}
      <SelectionEngineActivator />
      <SelectionOverlay />
      <SelectionToolbar />
      <SelectionResultPanel />
      </SelectionProvider>
    </PageShell>
  );
}

// ─────────────────────────────────────────────
// PROBLEMS TAB COMPONENT
// ─────────────────────────────────────────────

interface Problem {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  terminal_id: string | null;
  skill_used: string | null;
  user_notes: string | null;
  fix_description: string | null;
  files: string[];
  created_at: string;
  updated_at: string;
}

// ProblemsTab, ProblemDetailModal, NewProblemDialog extracted to ../components/ProblemsTab.tsx

// SkillsTab, SkillDynamicForm, DSLGenerationModal extracted to ../components/SkillsTab.tsx

// RequestsTab, RequestDetailModal, NewRequestDialog extracted to ../components/RequestsTab.tsx

// FilesTab extracted to ../components/FilesTab.tsx

// ─────────────────────────────────────────────
// TERMINALS TAB
// ─────────────────────────────────────────────

const TerminalsTab: React.FC<{
  terminalTabs: Record<string, TerminalTabInfo>;
  terminalBindings: Record<string, any>;
  activeTerminalId: string | null;
  sessions: Session[];
  onFocusTerminal: (id: string) => void;
  onResumeSession: (session: Session, terminalId?: string) => void;
}> = ({ terminalTabs, terminalBindings, activeTerminalId, sessions, onFocusTerminal, onResumeSession }) => {
  const runningTerminals = Object.entries(terminalTabs);

  return (
    <div className="flex flex-col h-full">
      {/* Running Terminals */}
      <div className="mb-4">
        <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Running Terminals ({runningTerminals.length})
        </div>
        {runningTerminals.length === 0 ? (
          <p className="text-xs text-zinc-600 px-2">No running terminals</p>
        ) : (
          <div className="space-y-2">
            {runningTerminals.map(([id, tab]) => {
              const sessionInTerminal = sessions.find(s => s.terminal_id === id);
              return (
                <div
                  key={id}
                  className={`p-2 rounded border transition-colors duration-150 ${
                    activeTerminalId === id
                      ? 'bg-zinc-700/80 border-zinc-600/50 shadow-[0_0_10px_rgba(0,0,0,0.2)]'
                      : 'bg-zinc-800/50 border-zinc-700/30 hover:bg-zinc-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-200 truncate">{tab.name}</div>
                      <div className="text-[10px] text-zinc-500">{tab.agent}</div>
                    </div>
                    {activeTerminalId === id && (
                      <span className="text-[10px] text-green-400">active</span>
                    )}
                  </div>
                  {/* Session info for this terminal */}
                  {sessionInTerminal ? (
                    <div className="mt-1.5 ml-4 pl-2 border-l-2 border-cyan-500/30">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-cyan-400">Session:</span>
                        <CategoryBadge category={sessionInTerminal.category} />
                        <StatusDot status={sessionInTerminal.status} />
                        <span className="text-[10px] text-zinc-300 truncate">{sessionInTerminal.topic || 'Unnamed'}</span>
                      </div>
                      <div className="text-[9px] text-zinc-600 mt-0.5">{sessionInTerminal.agent} • {formatDate(sessionInTerminal.created_at)}</div>
                      {sessionInTerminal.product_area && (
                        <div className="text-[9px] text-cyan-600/70">{sessionInTerminal.product_area}</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 ml-4 pl-2 border-l-2 border-zinc-700/30">
                      <div className="text-[9px] text-zinc-500">No session — ready to assign</div>
                    </div>
                  )}
                  <div className="flex gap-1 mt-1.5">
                    <button
                      onClick={() => onFocusTerminal(id)}
                      className="flex-1 px-1.5 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[9px] rounded"
                    >
                      Focus
                    </button>
                    {!sessionInTerminal && (
                      <button
                        onClick={() => {
                          // Pre-fill new session dialog for this terminal
                          const event = new CustomEvent('open-new-session-for-terminal', { detail: { terminalId: id } });
                          window.dispatchEvent(event);
                        }}
                        className="flex-1 px-1.5 py-0.5 bg-cyan-700 hover:bg-cyan-600 text-cyan-200 text-[9px] rounded"
                      >
                        New Session
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sessions (with and without terminals) */}
      <div>
        <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-500" />
          Sessions ({sessions.length})
        </div>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions" />
        ) : (
          <div className="space-y-1">
            {sessions.slice(0, 20).map((session) => {
              const isRunning = session.terminal_id && terminalTabs[session.terminal_id];
              return (
                <div key={session.id} className={`px-2 py-2 rounded group transition-colors duration-150 ${
                  isRunning ? 'bg-zinc-800/30 border-l-2 border-green-700/30' : 'bg-zinc-800/10 border-l-2 border-zinc-700/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <StatusDot status={session.status} />
                        <CategoryBadge category={session.category} />
                        <span className={`text-[10px] font-medium px-1 rounded ${
                          isRunning ? 'text-green-400 bg-green-500/20' : 'text-zinc-500 bg-zinc-700/30'
                        }`}>{session.agent}</span>
                        <span className="text-xs text-zinc-300 truncate">{session.topic || 'No topic'}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 flex items-center gap-1 mt-0.5">
                        {isRunning ? (
                          <><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {terminalTabs[session.terminal_id!]?.name || 'Terminal'}</>
                        ) : (
                          <><span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> Closed • {formatDate(session.created_at)}</>
                        )}
                        {session.product_area && (
                          <span className="text-[9px] text-cyan-600/70 ml-1">{session.product_area}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      {isRunning ? (
                        <button
                          onClick={() => onFocusTerminal(session.terminal_id!)}
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-blue-200 text-[10px] rounded"
                        >
                          Focus
                        </button>
                      ) : (
                        <button
                          onClick={() => onResumeSession(session)}
                          className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-cyan-200 text-[10px] rounded"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// RequestDetailModal, NewRequestDialog extracted to ../components/RequestsTab.tsx

// ─────────────────────────────────────────────
// FEATURES DIALOG
// ─────────────────────────────────────────────

const FEATURES = [
  {
    category: 'Terminal',
    color: 'green',
    items: [
      { name: 'Split Panes', desc: 'Split terminal into horizontal/vertical panes with drag resize' },
      { name: 'Multi-Terminal', desc: 'Run multiple terminals simultaneously with tabbed interface' },
      { name: 'Layout Persistence', desc: 'Terminal layouts auto-save and restore across sessions' },
      { name: 'Minimap', desc: 'Visual minimap for navigating split terminal panes' },
    ],
  },
  {
    category: 'Presets',
    color: 'green',
    items: [
      { name: 'Quick Commands', desc: 'Save and run frequently used terminal commands as presets' },
      { name: 'Categorized', desc: 'Organize presets by category (test, build, deploy, etc.)' },
    ],
  },
  {
    category: 'Sessions',
    color: 'green',
    items: [
      { name: 'Session Tracking', desc: 'Track each AI agent session with metadata and categorization' },
      { name: 'Category System', desc: 'Categorize sessions as bug-fix, feature, refactor, research, review' },
      { name: 'Status Tracking', desc: 'Monitor session status (active, paused, completed, error)' },
      { name: 'Message History', desc: 'View full message history for any session with search' },
    ],
  },
  {
    category: 'Analytics',
    color: 'emerald',
    items: [
      { name: 'AI Usage Stats', desc: 'Token usage, cost tracking, and session statistics per agent' },
      { name: 'Charts & Trends', desc: 'Visual charts for cost, tokens, sessions by agent and status' },
      { name: 'Problem/Request Progress', desc: 'Progress bars for problem resolution and request completion' },
    ],
  },
  {
    category: 'Issues',
    color: 'emerald',
    items: [
      { name: 'Problems Tab', desc: 'Track and manage problems with status, priority, and category' },
      { name: 'Requests Tab', desc: 'Manage feature requests and changes with linking to problems' },
      { name: 'Status Management', desc: 'Update problem/request status with visual feedback' },
      { name: 'Problem Linking', desc: 'Link problems to terminals and requests for traceability' },
    ],
  },
  {
    category: 'Files',
    color: 'yellow',
    items: [
      { name: 'Agent File Browser', desc: 'Browse and edit agent directory files inline' },
      { name: 'Live File Watching', desc: 'Auto-detect file changes and show real-time notifications' },
      { name: 'Init File Support', desc: 'Create and select custom INITIALIZE.md files per project' },
    ],
  },
  {
    category: 'Skills',
    color: 'indigo',
    items: [
      { name: 'Skill Management', desc: 'Create, edit, and manage AI agent skills with full CRUD' },
      { name: 'Inline Editing', desc: 'Edit skill markdown directly in the sidebar with save support' },
      { name: 'Category Filtering', desc: 'Filter skills by type (design, research, debugging, etc.)' },
    ],
  },
  {
    category: 'Design',
    color: 'pink',
    items: [
      { name: 'Design Skills', desc: 'Configure design intelligence levels (variance, motion, density)' },
      { name: 'Taste Configuration', desc: 'Fine-tune design output preferences' },
    ],
  },
  {
    category: 'Context',
    color: 'amber',
    items: [
      { name: 'Context Systems', desc: 'Toggle context sources (LLM Wiki, Obsidian Skills, Graphify, PARÁ, QMD, Automations, Design Skills)' },
      { name: 'Architecture Map', desc: 'Interactive visual map of project structure — files, components, and dependencies' },
      { name: 'Context Assembly', desc: 'Build and preview assembled context before starting a session' },
      { name: 'Maintenance', desc: 'Manage context optimization, summarization, and deep memory' },
    ],
  },
  {
    category: 'History',
    color: 'rose',
    items: [
      { name: 'Command History', desc: 'View and search command execution history' },
      { name: 'Session Log', desc: 'Complete log of past sessions with timestamps' },
    ],
  },
];

const categoryColors: Record<string, string> = {
  green: 'border-green-500/30 text-green-400',
  emerald: 'border-emerald-500/30 text-emerald-400',
  yellow: 'border-yellow-500/30 text-yellow-400',
  indigo: 'border-indigo-500/30 text-indigo-400',
  pink: 'border-pink-500/30 text-pink-400',
  amber: 'border-amber-500/30 text-amber-400',
  rose: 'border-rose-500/30 text-rose-400',
};

function FeaturesDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)]" onClick={onClose}>
      <GlassCard className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Workspace Features</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">✕</button>
        </div>

        <p className="text-xs text-zinc-400 mb-6">
          Overview of all features available in the Terminal Workspace sidebar.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {FEATURES.map((group) => (
            <div key={group.category} className={`bg-zinc-900/50 rounded-lg p-3 border-l-2 ${categoryColors[group.color]}`}>
              <h3 className="text-sm font-semibold text-white mb-3">{group.category}</h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.name} className="text-xs">
                    <div className="text-zinc-200 font-medium">{item.name}</div>
                    <div className="text-zinc-500 mt-0.5">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
