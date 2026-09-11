import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { ChevronRight, BookOpen, Zap, Network, FolderTree, FileText, Bot, ChevronDown, Palette, RefreshCw } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT } from '../lib/defaults';
import { assembleContext } from '../services/ContextService';
import { WORKSPACE_CONFIG_PREF_KEY } from './ContextSidebar';
import type { WorkspaceConfig } from './ContextSidebar';

const SUPPORTED_AGENTS = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'opencode', name: 'OpenCode' },
  { id: 'aider', name: 'Aider' },
  { id: 'codex', name: 'Codex CLI' },
  { id: 'gemini', name: 'Gemini CLI' },
];

export interface SessionConfig {
  id: string;
  name: string;
  agentType: string;
  terminalMode: 'create' | 'select';
  selectedTerminal: string;
  resumeId?: string;
  initializeFile?: string;
  customSystemPrompt?: string;
  includeDefaultInit: boolean;
  initContent?: string;
  problemIds?: string[];
  requestIds?: string[];
  modelTier?: 'top' | 'mid' | 'low';
  contextConfig?: {
    total_token_budget: number;
    model_tier: 'top' | 'mid' | 'low';
    systems: {
      llm_wiki: { enabled: boolean; max_tokens: number };
      obsidian_skills: { enabled: boolean; max_tokens: number };
      graphify: { enabled: boolean; include_summary: boolean; max_tokens: number };
      para: { enabled: boolean; max_tokens: number };
      qmd: { enabled: boolean; max_tokens: number };
      automations: { enabled: boolean; max_tokens: number };
      design_skills: {
        enabled: boolean;
        max_tokens: number;
        skills: string[];
        levels: {
          design_variance: number;
          motion_intensity: number;
          visual_density: number;
        };
        include_references: boolean;
      };
    };
    summarization: { enabled: boolean; message_threshold: number };
    deep_memory: { enabled: boolean; pattern_detection: boolean };
  };
}

interface BackendSystem {
  id: string;
  name: string;
  itemCount: number;
  itemLabel: string;
  available: boolean;
  lastBuilt: string | null;
  error: string | null;
}

type Health = 'healthy' | 'degraded' | 'missing' | 'unknown' | 'error';

type VerifySignal = { id: string; status: 'green' | 'red'; n: number } | null;

interface SystemInfo {
  id: string;
  name: string;
  icon: any;
  accentColor: string;
  itemCount: number;
  itemLabel: string;
  lastBuilt: string | null;
  maxTokens: number;
  enabled: boolean;
  onToggle: () => void;
  health: Health;
  lastSynced: string | null;
  onVerify: () => void;
  refreshing: boolean;
  lastError: string | null;
}

interface NewSessionDialogProps {
  open: boolean;
  mode?: 'create' | 'new-agent' | 'setup';
  onClose: () => void;
  onCreate: (config: SessionConfig) => void;
  projectPath: string;
  projectId?: string;
  projectPrompt?: string;
  terminalTabs: Record<string, { name: string; agent: string }>;
  defaultAgent: string;
  initialTerminalMode?: 'create' | 'select';
  initialSelectedTerminal?: string;
  defaultName?: string;
}

function deriveHealth(s: BackendSystem | null): Health {
  if (!s) return 'unknown';
  if (s.error) return 'error';
  if (s.available && s.itemCount > 0) return 'healthy';
  if (s.available && s.itemCount === 0) return 'degraded';
  if (!s.available) return 'missing';
  return 'unknown';
}

function staleClass(iso: string | null): string {
  if (!iso) return 'text-zinc-600';
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min < 5) return 'text-zinc-500';
  if (min < 30) return 'text-zinc-600';
  return 'text-amber-600/70';
}

const SYSTEM_DEFS: Array<{
  id: string;
  name: string;
  icon: any;
  accentColor: string;
  maxTokens: number;
  defaultLabel: string;
}> = [
  { id: 'llm_wiki', name: 'LLM Wiki', icon: BookOpen, accentColor: 'text-blue-400', maxTokens: 2000, defaultLabel: 'files' },
  { id: 'obsidian_skills', name: 'Obsidian Skills', icon: Zap, accentColor: 'text-purple-400', maxTokens: 500, defaultLabel: 'skills' },
  { id: 'graphify', name: 'Graphify', icon: Network, accentColor: 'text-cyan-400', maxTokens: 500, defaultLabel: 'nodes' },
  { id: 'para', name: 'PARA', icon: FolderTree, accentColor: 'text-teal-400', maxTokens: 300, defaultLabel: 'areas' },
  { id: 'qmd', name: 'QMD Templates', icon: FileText, accentColor: 'text-amber-400', maxTokens: 200, defaultLabel: 'templates' },
  { id: 'automations', name: 'Automations', icon: Bot, accentColor: 'text-rose-400', maxTokens: 100, defaultLabel: 'automations' },
  { id: 'design_skills', name: 'Design Skills', icon: Palette, accentColor: 'text-pink-400', maxTokens: 800, defaultLabel: 'design skills' },
];

function SystemToggleCard({ system, verifySignal }: { system: SystemInfo; verifySignal: VerifySignal }) {
  const toggleColors: Record<string, { on: string }> = {
    llm_wiki: { on: 'bg-blue-500/40' },
    obsidian_skills: { on: 'bg-purple-500/40' },
    graphify: { on: 'bg-cyan-500/40' },
    para: { on: 'bg-teal-500/40' },
    qmd: { on: 'bg-amber-500/40' },
    automations: { on: 'bg-rose-500/40' },
    design_skills: { on: 'bg-pink-500/40' },
  };
  const dotColors: Record<string, { on: string }> = {
    llm_wiki: { on: 'left-3.5 bg-blue-400' },
    obsidian_skills: { on: 'left-3.5 bg-purple-400' },
    graphify: { on: 'left-3.5 bg-cyan-400' },
    para: { on: 'left-3.5 bg-teal-400' },
    qmd: { on: 'left-3.5 bg-amber-400' },
    automations: { on: 'left-3.5 bg-rose-400' },
    design_skills: { on: 'left-3.5 bg-pink-400' },
  };
  const c = toggleColors[system.id];
  const d = dotColors[system.id];

  const [flash, setFlash] = useState<'none' | 'green' | 'red'>('none');
  const [countPulse, setCountPulse] = useState(false);
  const [dotReady, setDotReady] = useState(system.health !== 'unknown');
  const prevCount = useRef(system.itemCount);
  const lastSignalN = useRef(0);

  useEffect(() => {
    if (verifySignal && verifySignal.id === system.id && verifySignal.n !== lastSignalN.current) {
      lastSignalN.current = verifySignal.n;
      setFlash(verifySignal.status);
    }
  }, [verifySignal, system.id]);

  useEffect(() => {
    if (flash === 'none') return;
    const t = setTimeout(() => setFlash('none'), 1000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (system.health !== 'unknown' && !dotReady) {
      const t = setTimeout(() => setDotReady(true), 20);
      return () => clearTimeout(t);
    }
  }, [system.health, dotReady]);

  useEffect(() => {
    if (prevCount.current !== system.itemCount && prevCount.current !== 0) {
      setCountPulse(true);
      const t = setTimeout(() => setCountPulse(false), 800);
      prevCount.current = system.itemCount;
      return () => clearTimeout(t);
    }
    prevCount.current = system.itemCount;
  }, [system.itemCount]);

  const dotBase: Record<Health, string> = {
    healthy: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
    degraded: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]',
    missing: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]',
    error: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]',
    unknown: 'bg-zinc-600',
  };
  const flashClass =
    flash === 'green'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse'
      : flash === 'red'
        ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse'
        : '';
  const dotClass = flash !== 'none' ? flashClass : dotBase[system.health];
  const scaleClass = dotReady ? 'scale-100' : 'scale-75';

  const loading = system.health === 'unknown';
  const isEmptyDegraded = system.health === 'degraded' && system.itemCount === 0;

  const tip =
    system.health === 'healthy'
      ? `Live: ${system.itemCount} ${system.itemLabel} · updated ${formatRelTime(system.lastSynced)}`
      : system.health === 'degraded'
        ? `System exists but no items found${system.lastBuilt ? ` · last built ${formatRelTime(system.lastBuilt)}` : ''}`
        : system.health === 'missing'
          ? 'Not configured — run Initialize or create the directory'
          : system.health === 'error'
            ? `Error: ${system.lastError ?? 'unknown'}`
            : 'Checking\u2026';

  const timeText = system.lastSynced
    ? formatRelTime(system.lastSynced)
    : system.lastBuilt
      ? `Built ${formatRelTime(system.lastBuilt)}`
      : '';
  const timeClass = staleClass(system.lastSynced || system.lastBuilt);

  return (
    <div
      className={`relative border rounded-xl p-3 transition-all duration-200 ${
        system.enabled
          ? 'bg-zinc-800/40 border-zinc-600/40 shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
          : 'bg-zinc-900/30 border-zinc-700/30 opacity-60 hover:opacity-80'
      }`}
    >
      <span className="group/tooltip absolute top-2 left-2 z-10">
        <span className={`block w-2 h-2 rounded-full transition-transform duration-300 ${scaleClass} ${dotClass}`} />
        <span className="absolute left-0 top-3 hidden group-hover/tooltip:block whitespace-nowrap rounded-md bg-zinc-950/95 border border-zinc-700/60 px-2 py-1 text-[9px] text-zinc-300 shadow-lg z-20">
          {tip}
        </span>
      </span>

      <div className="pl-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-md ${system.enabled ? 'bg-zinc-800/60' : 'bg-zinc-800/20'}`}>
              <system.icon className={`w-3.5 h-3.5 ${system.accentColor}`} />
            </div>
            <span className="text-[11px] text-zinc-300 font-medium">{system.name}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={system.onVerify}
              disabled={loading || system.refreshing}
              title="Verify"
              className="p-1 rounded-md hover:bg-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-3 h-3 ${system.refreshing ? 'animate-spin text-cyan-400' : 'text-zinc-600 hover:text-zinc-400'}`}
              />
            </button>

            <button
              onClick={system.onToggle}
              className={`w-8 h-4 rounded-full transition-all duration-200 relative ${system.enabled ? c.on : 'bg-zinc-700'}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 shadow-sm ${
                  system.enabled ? d.on : 'left-0.5 bg-zinc-400'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="text-[9px] text-zinc-500 leading-relaxed">
          {loading ? (
            <span className="text-zinc-600">...</span>
          ) : isEmptyDegraded ? (
            <span className="text-amber-500">Empty</span>
          ) : (
            <span className={`transition-colors duration-300 ${countPulse ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {system.itemCount} {system.itemLabel}
            </span>
          )}
          <span className="text-zinc-600 mx-1">·</span>
          <span className="text-zinc-600 text-[9px]">~{system.maxTokens}t</span>
          {timeText ? (
            <>
              <span className="text-zinc-600 mx-1">·</span>
              <span className={timeClass}>{timeText}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ContextMapVisualization({ systems, totalBudget }: { systems: SystemInfo[]; totalBudget: number }) {
  const nodes: Record<string, { x: number; y: number }> = {
    llm_wiki: { x: 60, y: 30 },
    obsidian_skills: { x: 220, y: 30 },
    graphify: { x: 60, y: 100 },
    para: { x: 220, y: 100 },
    qmd: { x: 30, y: 170 },
    automations: { x: 140, y: 170 },
    design_skills: { x: 250, y: 170 },
  };
  const edges = [
    { from: 'llm_wiki', to: 'obsidian_skills' },
    { from: 'graphify', to: 'para' },
    { from: 'llm_wiki', to: 'graphify' },
    { from: 'qmd', to: 'llm_wiki' },
    { from: 'automations', to: 'graphify' },
    { from: 'automations', to: 'para' },
    { from: 'design_skills', to: 'obsidian_skills' },
    { from: 'design_skills', to: 'para' },
  ];
  const accentHex: Record<string, string> = {
    llm_wiki: '#3b82f6',
    obsidian_skills: '#a855f7',
    graphify: '#22d3ee',
    para: '#14b8a6',
    qmd: '#f59e0b',
    automations: '#f43f5e',
    design_skills: '#ec4899',
  };
  const enabledIds = systems.filter(s => s.enabled).map(s => s.id);
  const usedTokens = systems.filter(s => s.enabled).reduce((sum, s) => sum + s.maxTokens, 0);
  const pct = Math.min((usedTokens / totalBudget) * 100, 100);
  return (
    <div className="bg-zinc-900/70 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.3)]" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Context Map</span>
        </div>
        <span className="text-[9px] text-zinc-600">{enabledIds.length}/{systems.length} active · ~{usedTokens}/{totalBudget} tokens</span>
      </div>
      <svg width="280" height="240" className="w-full">
        {edges.map((edge, i) => {
          const f = nodes[edge.from];
          const t = nodes[edge.to];
          const active = enabledIds.includes(edge.from) && enabledIds.includes(edge.to);
          return (
            <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              stroke={active ? 'rgba(6,182,212,0.3)' : 'rgba(63,63,70,0.2)'}
              strokeWidth={active ? 1.5 : 0.5}
              strokeDasharray={active ? 'none' : '4,4'} />
          );
        })}
        {systems.map(s => {
          const pos = nodes[s.id];
          const enabled = enabledIds.includes(s.id);
          return (
            <g key={s.id}>
              <circle cx={pos.x} cy={pos.y} r={enabled ? 22 : 18}
                fill={enabled ? accentHex[s.id] + '25' : 'transparent'}
                stroke={enabled ? accentHex[s.id] : '#52525b'}
                strokeWidth={enabled ? 2 : 0.5}
                className={enabled ? 'drop-shadow-[0_0_4px_rgba(6,182,212,0.2)]' : ''} />
              <circle cx={pos.x} cy={pos.y} r={enabled ? 22 : 18}
                fill="none" stroke={enabled ? accentHex[s.id] : 'none'}
                strokeWidth={4} className="opacity-30" />
              <text x={pos.x} y={pos.y + 28} textAnchor="middle" className="text-[7px] fill-zinc-500 font-medium"
                fill={enabled ? (accentHex[s.id] || '#a1a1aa') : '#52525b'}>
                {s.name.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 w-full h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500/60 to-emerald-500/40 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function NewSessionDialog({
  open,
  mode = 'create',
  onClose,
  onCreate,
  projectPath,
  projectId,
  projectPrompt = '',
  terminalTabs,
  defaultAgent,
  initialTerminalMode,
  initialSelectedTerminal,
  defaultName = 'New Agent',
}: NewSessionDialogProps) {
  const [name, setName] = useState(defaultName);
  useEffect(() => { setName(defaultName); }, [defaultName]);
  const [agentType, setAgentType] = useState('opencode');
  const [terminalMode, setTerminalMode] = useState<'create' | 'select'>('create');
  const [selectedTerminal, setSelectedTerminal] = useState('');
  const [includeDefaultInit, setIncludeDefaultInit] = useState(true);
  const [customInitFile, setCustomInitFile] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [generalAdditions, setGeneralAdditions] = useState('');
  const [initFiles, setInitFiles] = useState<string[]>([]);
  const [agentFiles, setAgentFiles] = useState<{ name: string; path: string }[]>([]);
  const [selectedAgentFiles, setSelectedAgentFiles] = useState<string[]>([]);
  const [agentsMdContent, setAgentsMdContent] = useState('');
  const [loadingAgentsMd, setLoadingAgentsMd] = useState(false);
  const [includeAgentsMd, setIncludeAgentsMd] = useState(true);
  const [includeGraphify, setIncludeGraphify] = useState(true);
  const [includeQMD, setIncludeQMD] = useState(true);
  const [includeSkills, setIncludeSkills] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [totalBudget, setTotalBudget] = useState(7000);
  const [ctxLLMWiki, setCtxLLMWiki] = useState(true);
  const [ctxSkills, setCtxSkills] = useState(true);
  const [ctxGraphify, setCtxGraphify] = useState(true);
  const [ctxPara, setCtxPara] = useState(false);
  const [ctxQMD, setCtxQMD] = useState(true);
  const [ctxAutomations, setCtxAutomations] = useState(false);
  const [ctxSummarization, setCtxSummarization] = useState(true);
  const [ctxDeepMemory, setCtxDeepMemory] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [ctxSystemData, setCtxSystemData] = useState<BackendSystem[]>([]);
  const [ctxLastSynced, setCtxLastSynced] = useState<string | null>(null);
  const [ctxLoadFailed, setCtxLoadFailed] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [verifySignal, setVerifySignal] = useState<VerifySignal>(null);

  const appliedAtRef = useRef(0);
  const signalSeq = useRef(0);
  const [ctxShowMap, setCtxShowMap] = useState(true);
  const [resumeSessionId, setResumeSessionId] = useState('');
  const [resumeSession, setResumeSession] = useState<any>(null);
  const [resumeError, setResumeError] = useState('');
  const [resumeChecking, setResumeChecking] = useState(false);
  const [resumeCliResult, setResumeCliResult] = useState<{ exists: boolean; error?: string } | null>(null);
  const [ctxDesignSkills, setCtxDesignSkills] = useState(true);
  const [modelTier, setModelTier] = useState<'top' | 'mid' | 'low'>('mid');

  useEffect(() => {
    if (open) {
      setAgentType(defaultAgent);
      setTerminalMode(initialTerminalMode || 'create');
      setSelectedTerminal(initialSelectedTerminal || '');
      setName(defaultName && defaultName !== 'New Agent' ? defaultName : '');
      setIncludeDefaultInit(true);
      setCustomInitFile('');
      setCustomSystemPrompt('');
      setGeneralAdditions('');
      setSelectedAgentFiles([]);
      setIncludeAgentsMd(true);
      setIncludeGraphify(true);
      setIncludeQMD(true);
      setIncludeSkills(true);
      setShowPreview(false);
      setTotalBudget(7000);
      setCtxLLMWiki(true);
      setCtxSkills(true);
      setCtxGraphify(true);
      setCtxPara(false);
      setCtxQMD(true);
      setCtxAutomations(false);
      setCtxSummarization(true);
      setCtxDeepMemory(true);
      setCtxShowMap(true);
      setCtxDesignSkills(true);
      setResumeSessionId('');
      setResumeSession(null);
      setResumeError('');
      setResumeChecking(false);
      setResumeCliResult(null);
      setCtxLoadFailed(false);
      setVerifySignal(null);
      loadInitFiles();
      const configKey = projectId ? `${WORKSPACE_CONFIG_PREF_KEY}-${projectId}` : WORKSPACE_CONFIG_PREF_KEY;
      const dapi = (window as any).deskflowAPI;
      if (dapi?.getPreferences) {
        dapi.getPreferences().then((prefs: any) => {
          if (prefs?.systemPrompts) {
            setGeneralAdditions(prefs.systemPrompts[defaultAgent] || prefs.systemPrompts.claude || '');
          }
          if (prefs?.total_token_budget) setTotalBudget(prefs.total_token_budget);
          const raw = prefs?.[configKey] || prefs?.[WORKSPACE_CONFIG_PREF_KEY];
          if (raw) {
            try {
              const wsConfig: WorkspaceConfig = JSON.parse(raw);
              if (wsConfig.systems) {
                if (wsConfig.systems.llm_wiki != null) setCtxLLMWiki(wsConfig.systems.llm_wiki.enabled);
                if (wsConfig.systems.obsidian_skills != null) setCtxSkills(wsConfig.systems.obsidian_skills.enabled);
                if (wsConfig.systems.graphify != null) setCtxGraphify(wsConfig.systems.graphify.enabled);
                if (wsConfig.systems.para != null) setCtxPara(wsConfig.systems.para.enabled);
                if (wsConfig.systems.qmd_templates != null) setCtxQMD(wsConfig.systems.qmd_templates.enabled);
                if (wsConfig.systems.automations != null) setCtxAutomations(wsConfig.systems.automations.enabled);
                if (wsConfig.systems.design_skills != null) {
                  setCtxDesignSkills(wsConfig.systems.design_skills.enabled);
                }
              }
              if (wsConfig.behaviors) {
                if (wsConfig.behaviors.summarization != null) setCtxSummarization(wsConfig.behaviors.summarization);
                if (wsConfig.behaviors.deep_memory != null) setCtxDeepMemory(wsConfig.behaviors.deep_memory);
              }
            } catch (e) {
              console.warn('[NewSessionDialog] Could not load workspace settings:', e);
            }
          }
        });
      }
      if (mode !== 'create' && projectPath) {
        loadAgentsContext();
      }
    }
  }, [open, defaultAgent, mode, projectPath, initialTerminalMode, initialSelectedTerminal]);

  const applyIfLatest = useCallback((issuedAt: number, data: BackendSystem[]) => {
    if (issuedAt < appliedAtRef.current) return false;
    appliedAtRef.current = issuedAt;
    setCtxSystemData(data);
    setCtxLastSynced(new Date(issuedAt).toISOString());
    setCtxLoadFailed(false);
    return true;
  }, []);

  const fetchSystems = useCallback(async (): Promise<{ ok: boolean; data?: BackendSystem[] }> => {
    const dapi = (window as any).deskflowAPI;
    if (!dapi?.getContextSystems || !projectPath) return { ok: false };
    try {
      const res = await dapi.getContextSystems(projectPath);
      if (res?.success && Array.isArray(res.data)) return { ok: true, data: res.data as BackendSystem[] };
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }, [projectPath]);

  const loadSystemStatus = useCallback(async () => {
    if (mode === 'create') return;
    const issuedAt = Date.now();
    const r = await fetchSystems();
    if (r.ok && r.data) {
      applyIfLatest(issuedAt, r.data);
    } else if (appliedAtRef.current === 0) {
      setCtxSystemData([]);
      setCtxLoadFailed(true);
    }
  }, [mode, fetchSystems, applyIfLatest]);

  useEffect(() => {
    if (mode === 'create') return;
    void loadSystemStatus();
    const t = setInterval(() => {
      void loadSystemStatus();
    }, 30000);
    return () => clearInterval(t);
  }, [mode, loadSystemStatus]);

  const loadInitFiles = async () => {
    if (!projectPath) return;
    try {
      const result = await (window as any).deskflowAPI?.listInitFiles?.(projectPath);
      if (result?.success) {
        setInitFiles(result.data || []);
      }
    } catch {}
  };

  const loadAgentsContext = async () => {
    setLoadingAgentsMd(true);
    try {
      const dapi = (window as any).deskflowAPI;
      if (!dapi) return;

      const agentsResult = await dapi.readAgentFileContent?.('agents.md', projectPath);
      if (agentsResult?.success && agentsResult.data) {
        setAgentsMdContent(agentsResult.data);
      }

      const filesResult = await dapi.listAgentDirFiles?.(projectPath);
      if (filesResult?.success) {
        setAgentFiles(filesResult.data || []);
      }
    } catch {}
    setLoadingAgentsMd(false);
  };

  const verifySystem = useCallback(
    async (id: string) => {
      setRefreshingId(id);
      const issuedAt = Date.now();
      const r = await fetchSystems();
      if (r.ok && r.data) {
        applyIfLatest(issuedAt, r.data);
        signalSeq.current += 1;
        setVerifySignal({ id, status: 'green', n: signalSeq.current });
      } else {
        setCtxSystemData((prev) => prev.map((s) => (s.id === id ? { ...s, error: s.error ?? 'Verification failed' } : s)));
        signalSeq.current += 1;
        setVerifySignal({ id, status: 'red', n: signalSeq.current });
      }
      setRefreshingId(null);
    },
    [fetchSystems, applyIfLatest],
  );

  const buildPreview = async () => {
    const previewContextConfig = {
      total_token_budget: totalBudget,
      model_tier: modelTier,
      systems: {
        llm_wiki: { enabled: ctxLLMWiki, files: [], max_tokens: 2000 },
        obsidian_skills: { enabled: ctxSkills, skills: [], max_tokens: 500 },
        graphify: { enabled: ctxGraphify, include_graph: false, include_summary: true, max_tokens: 500 },
        para: { enabled: ctxPara, areas: [], max_tokens: 300 },
        qmd: { enabled: ctxQMD, templates: [], max_tokens: 200 },
        automations: { enabled: ctxAutomations, max_tokens: 100 },
        design_skills: {
          enabled: ctxDesignSkills,
          max_tokens: 800,
          skills: ['frontend-design', 'impeccable', 'ui-ux-pro-max', 'taste-skill'],
          levels: { design_variance: 5, motion_intensity: 5, visual_density: 7 },
          include_references: true,
        },
      },
      summarization: { enabled: ctxSummarization, message_threshold: 10, max_recent_messages: 5, summary_style: 'brief' as const },
      deep_memory: { enabled: ctxDeepMemory, pattern_detection: true, max_patterns: 20, retention_days: 90 },
    };
    const content = await assembleContext(projectPath, previewContextConfig);
    setPreviewContent(content);
    setShowPreview(true);
  };

  const handleCreate = async () => {
    try {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sessionName = name.trim() || (mode === 'setup' ? `Setup ${agentType}` : mode === 'new-agent' ? `${agentType} agent` : `${agentType} session`);
      const config: SessionConfig = {
        id: sessionId,
        name: sessionName,
        agentType,
        terminalMode,
        selectedTerminal,
        resumeId: resumeSession?.resume_id || resumeSessionId || undefined,
        initializeFile: customInitFile || undefined,
        customSystemPrompt: customSystemPrompt || undefined,
        initContent: generalAdditions || undefined,
        includeDefaultInit: mode === 'create' ? includeDefaultInit : false,
        problemIds: [],
        requestIds: [],
      };

      if (mode !== 'create') {
        config.contextConfig = {
          total_token_budget: totalBudget,
          model_tier: modelTier,
          systems: {
            llm_wiki: { enabled: ctxLLMWiki, max_tokens: 2000 },
            obsidian_skills: { enabled: ctxSkills, max_tokens: 500 },
            graphify: { enabled: ctxGraphify, include_summary: true, max_tokens: 500 },
            para: { enabled: ctxPara, max_tokens: 300 },
            qmd: { enabled: ctxQMD, max_tokens: 200 },
            automations: { enabled: ctxAutomations, max_tokens: 100 },
            design_skills: {
              enabled: ctxDesignSkills,
              max_tokens: 800,
              skills: ['frontend-design', 'impeccable', 'ui-ux-pro-max', 'taste-skill'],
              levels: { design_variance: 5, motion_intensity: 5, visual_density: 7 },
              include_references: true,
            },
          },
          summarization: { enabled: ctxSummarization, message_threshold: 10 },
          deep_memory: { enabled: ctxDeepMemory, pattern_detection: true },
        };
      }

      onCreate(config);
      onClose();
    } catch (err) {
      console.error('[NewSessionDialog] handleCreate error:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900/95 backdrop-blur-xl rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto border border-zinc-700/50 shadow-black/40" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center justify-between mb-5">
          <div className="absolute -top-6 -left-6 -right-6 h-1 bg-gradient-to-r from-cyan-500/30 via-cyan-400/10 to-transparent rounded-t-2xl pointer-events-none" />
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.5)]" />
            <h2 className="text-lg font-bold text-white">{mode === 'new-agent' ? 'New Agent' : mode === 'setup' ? 'Setup Agent Workspace' : 'Create New Session'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800/80 rounded-md text-zinc-500 hover:text-zinc-200 transition-all duration-150 active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Session Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all duration-150"
            placeholder="e.g. Fix login bug"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">AI Agent</label>
          <select
            value={agentType}
            onChange={(e) => setAgentType(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all duration-150"
          >
            {SUPPORTED_AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Model Tier</label>
          <select
            value={modelTier}
            onChange={(e) => setModelTier(e.target.value as 'top' | 'mid' | 'low')}
            className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all duration-150"
          >
            <option value="top">Top (Opus 4, Gemini 2.5 Pro, Sonnet 4.5)</option>
            <option value="mid">Mid (Sonnet 4, GPT-4o, Gemini 2.0 Flash)</option>
            <option value="low">Low (mini, flash, haiku, small open-weights)</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-2 font-medium">Terminal</label>
          <div className="space-y-2">
            <label onClick={() => setTerminalMode('create')} className="flex items-center gap-3 px-3.5 py-2.5 bg-zinc-900/60 backdrop-blur-sm rounded-lg border border-zinc-700/50 cursor-pointer hover:bg-zinc-800/60 hover:border-zinc-600/50 transition-all duration-150">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${terminalMode === 'create' ? 'border-cyan-400 bg-cyan-500/20' : 'border-zinc-600'}`}>
                {terminalMode === 'create' && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
              </div>
              <div>
                <span className="text-sm text-white font-medium">Create new terminal</span>
                <p className="text-[10px] text-zinc-500 mt-0.5">Launches a new terminal with the selected agent</p>
              </div>
            </label>
            <label onClick={() => setTerminalMode('select')} className="flex items-center gap-3 px-3.5 py-2.5 bg-zinc-900/60 backdrop-blur-sm rounded-lg border border-zinc-700/50 cursor-pointer hover:bg-zinc-800/60 hover:border-zinc-600/50 transition-all duration-150">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${terminalMode === 'select' ? 'border-cyan-400 bg-cyan-500/20' : 'border-zinc-600'}`}>
                {terminalMode === 'select' && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
              </div>
              <div>
                <span className="text-sm text-white font-medium">Use existing terminal</span>
                <p className="text-[10px] text-zinc-500 mt-0.5">Attach session to a running terminal</p>
              </div>
            </label>
          </div>
          {terminalMode === 'select' && (
            <select
              value={selectedTerminal}
              onChange={(e) => setSelectedTerminal(e.target.value)}
              className="w-full mt-2 bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all duration-150"
            >
              <option value="">Select a terminal...</option>
              {Object.entries(terminalTabs).map(([id, tab]) => (
                <option key={id} value={id}>
                  {tab.name} ({tab.agent})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-4 border-t border-zinc-700 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-3 rounded-full bg-gradient-to-b from-zinc-400 to-zinc-600" />
              <h3 className="text-sm font-medium text-white">
                {mode === 'new-agent' ? 'Quick Setup' : mode === 'setup' ? 'Agent Context & Tools' : 'Setup'}
              </h3>
            </div>

          {/* Resume Session ID — only in create mode */}
          {mode === 'create' && (
            <div className="mb-3 p-3 bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-zinc-800/50">
              <label className="text-[10px] text-zinc-500 font-medium">Resume Session ID <span className="text-zinc-600 font-normal">(optional)</span></label>
              <input
                type="text"
                value={resumeSessionId}
                onChange={(e) => { setResumeSessionId(e.target.value); setResumeError(''); setResumeCliResult(null); }}
                placeholder="Paste session ID to resume..."
                className="w-full mt-1.5 bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all duration-150"
              />
              {resumeSessionId && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={async () => {
                      const dapi = (window as any).deskflowAPI;
                      if (!dapi) return;
                      try {
                        const session = await dapi.getTerminalSessionById(resumeSessionId);
                        if (session) {
                          setAgentType(session.agent || 'claude');
                          setResumeSession(session);
                          setResumeError('');
                        } else {
                          setResumeError('Session not found');
                        }
                      } catch {
                        setResumeError('Failed to look up session');
                      }
                    }}
                    className="text-[9px] text-cyan-400 hover:text-cyan-300"
                  >
                    Lookup DB
                  </button>
                  <button
                    onClick={async () => {
                      const dapi = (window as any).deskflowAPI;
                      if (!dapi) return;
                      setResumeChecking(true);
                      setResumeCliResult(null);
                      try {
                        const result = await dapi.checkSessionExists(resumeSessionId);
                        setResumeCliResult(result);
                      } catch {
                        setResumeCliResult({ exists: false, error: 'Failed to run opencode CLI check' });
                      }
                      setResumeChecking(false);
                    }}
                    className="text-[9px] text-purple-400 hover:text-purple-300"
                  >
                    {resumeChecking ? 'Checking...' : 'Check CLI'}
                  </button>
                </div>
              )}
              {resumeSession && (
                <div className="mt-1 text-[9px] text-green-400">Session found: {resumeSession.topic || resumeSession.id}</div>
              )}
              {resumeError && (
                <div className="mt-1 text-[9px] text-red-400">{resumeError}</div>
              )}
              {resumeCliResult && (
                <div className={`mt-1 text-[9px] ${resumeCliResult.exists ? 'text-green-400' : 'text-red-400'}`}>
                  {resumeCliResult.exists
                    ? 'CLI confirmed: session exists'
                    : `CLI: session not found — ${resumeCliResult.error || 'unknown error'}`}
                </div>
              )}
            </div>
          )}

          {/* Advanced Configuration toggle */}
          <div className="mb-3">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-all duration-150 px-2 py-1 rounded-md hover:bg-zinc-800/40"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`} />
              <span className="font-medium">Advanced Configuration</span>
            </button>
          </div>

          {/* Full context configuration — shown in setup mode or when advanced is toggled */}
          {(mode === 'setup' || showAdvanced) ? (
            <div>
              {/* Build systems array for the context UI */}
      {(() => {
        const enabledById: Record<string, boolean> = {
          llm_wiki: ctxLLMWiki,
          obsidian_skills: ctxSkills,
          graphify: ctxGraphify,
          para: ctxPara,
          qmd: ctxQMD,
          automations: ctxAutomations,
          design_skills: ctxDesignSkills,
        };
        const toggleById: Record<string, () => void> = {
          llm_wiki: () => setCtxLLMWiki(!ctxLLMWiki),
          obsidian_skills: () => setCtxSkills(!ctxSkills),
          graphify: () => setCtxGraphify(!ctxGraphify),
          para: () => setCtxPara(!ctxPara),
          qmd: () => setCtxQMD(!ctxQMD),
          automations: () => setCtxAutomations(!ctxAutomations),
          design_skills: () => setCtxDesignSkills(!ctxDesignSkills),
        };

        const firstLoadDone = ctxLastSynced !== null || ctxLoadFailed;
        const globalError = ctxLoadFailed && ctxSystemData.length === 0;

        const systems: SystemInfo[] = SYSTEM_DEFS.map((def) => {
          const rec = ctxSystemData.find((d) => d.id === def.id) || null;

          let health: Health;
          let lastError: string | null;
          if (globalError) {
            health = 'error';
            lastError = 'Failed to load system status';
          } else if (!firstLoadDone) {
            health = 'unknown';
            lastError = null;
          } else if (!rec) {
            health = 'missing';
            lastError = null;
          } else {
            health = deriveHealth(rec);
            lastError = rec.error;
          }

          return {
            id: def.id,
            name: def.name,
            icon: def.icon,
            accentColor: def.accentColor,
            itemCount: rec?.itemCount ?? 0,
            itemLabel: rec?.itemLabel || def.defaultLabel,
            lastBuilt: rec?.lastBuilt ?? null,
            maxTokens: def.maxTokens,
            enabled: enabledById[def.id],
            onToggle: toggleById[def.id],
            health,
            lastSynced: ctxLastSynced,
            onVerify: () => verifySystem(def.id),
            refreshing: refreshingId === def.id,
            lastError,
          };
        });
        return (
          <Fragment>
            {/* Context Systems toggle cards */}
            <div className="mb-3 p-3 bg-zinc-900/70 backdrop-blur-sm rounded-xl border border-zinc-800/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-3 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Context Systems</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {systems.map(s => <SystemToggleCard key={s.id} system={s} verifySignal={verifySignal} />)}
              </div>
            </div>

                    {/* Design Skills — configure tastes in Context Sidebar */}
                    {ctxDesignSkills && (
                      <div className="mb-3 p-3 bg-zinc-900/70 backdrop-blur-sm rounded-xl border border-pink-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1 h-4 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full" />
                          <h4 className="text-[10px] font-semibold text-pink-400 uppercase tracking-wider">Design Intelligence</h4>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">Configure design tastes (variance, motion, density) in Context Sidebar</p>
                      </div>
                    )}

                    {/* Context Map Visualization */}
                    {ctxShowMap && (
                      <div className="mb-3">
                        <button onClick={() => setCtxShowMap(false)} className="text-[9px] text-zinc-600 hover:text-zinc-400 mb-1 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800/40">hide map</button>
                        <ContextMapVisualization systems={systems} totalBudget={totalBudget} />
                      </div>
                    )}

                    {/* Behavior toggles */}
                    <div className="mb-3 p-3 bg-zinc-900/70 backdrop-blur-sm rounded-xl border border-zinc-800/50">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-3 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                        <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Behavior</h4>
                      </div>
                      <div className="flex items-center gap-5">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                            ctxSummarization ? 'bg-cyan-500/30 border-cyan-400' : 'border-zinc-600 group-hover:border-zinc-500'
                          }`}>
                            {ctxSummarization && <svg className="w-2.5 h-2.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <input type="checkbox" checked={ctxSummarization} onChange={(e) => setCtxSummarization(e.target.checked)} className="sr-only" />
                          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 transition-colors">Auto-summarize</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                            ctxDeepMemory ? 'bg-cyan-500/30 border-cyan-400' : 'border-zinc-600 group-hover:border-zinc-500'
                          }`}>
                            {ctxDeepMemory && <svg className="w-2.5 h-2.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <input type="checkbox" checked={ctxDeepMemory} onChange={(e) => setCtxDeepMemory(e.target.checked)} className="sr-only" />
                          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 transition-colors">Deep memory</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                            includeAgentsMd ? 'bg-amber-500/30 border-amber-400' : 'border-zinc-600 group-hover:border-zinc-500'
                          }`}>
                            {includeAgentsMd && <svg className="w-2.5 h-2.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <input type="checkbox" checked={includeAgentsMd} onChange={(e) => setIncludeAgentsMd(e.target.checked)} className="sr-only" />
                          <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 transition-colors">agents.md</span>
                        </label>
                      </div>
                    </div>

                    {/* Existing agent files */}
                    <div className="mb-3">
                      <label className="block text-[10px] text-zinc-500 mb-1.5 font-medium">Additional Agent Files</label>
                      <div className="max-h-24 overflow-y-auto space-y-0.5 bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-1.5">
                        {agentFiles.length === 0 ? (
                          <div className="text-[10px] text-zinc-600 px-2 py-3 text-center">No files in agent/</div>
                        ) : agentFiles.map((f) => (
                          <label key={f.path} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors group">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                              selectedAgentFiles.includes(f.name) ? 'bg-amber-500/30 border-amber-400' : 'border-zinc-600 group-hover:border-zinc-500'
                            }`}>
                              {selectedAgentFiles.includes(f.name) && <svg className="w-2.5 h-2.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedAgentFiles.includes(f.name)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedAgentFiles([...selectedAgentFiles, f.name]);
                                else setSelectedAgentFiles(selectedAgentFiles.filter(x => x !== f.name));
                              }}
                              className="sr-only"
                            />
                            <span className="text-[10px] text-zinc-300 group-hover:text-zinc-200 transition-colors">{f.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button onClick={buildPreview} className="w-full text-[10px] text-zinc-400 hover:text-zinc-200 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30 hover:bg-zinc-700/60 hover:border-zinc-600/40 transition-all duration-150 active:scale-[0.98]">
                      Preview Init Content
                    </button>
                    {showPreview && (
                      <div className="mt-2 max-h-32 overflow-y-auto bg-zinc-900/80 rounded-xl p-3 border border-zinc-800/50">
                        <pre className="text-[9px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">{previewContent.substring(0, 1500)}{previewContent.length > 1500 ? '\n...' : ''}</pre>
                      </div>
                    )}
                  </Fragment>
                );
              })()}
            </div>
          ) : null}

          {/* Create mode — default init options */}
          {mode === 'create' && (
            <div>
              {resumeSessionId ? (
                <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-300">
                  Session ID entered — init options disabled for existing sessions
                </div>
              ) : null}
              <label className={`flex items-center gap-2.5 mb-3 px-3 py-2 rounded-lg transition-all ${
                resumeSessionId ? 'opacity-40' : 'hover:bg-zinc-800/40 cursor-pointer'
              }`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                  includeDefaultInit ? 'bg-cyan-500/30 border-cyan-400' : 'border-zinc-600'
                }`}>
                  {includeDefaultInit && <svg className="w-2.5 h-2.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <input
                  type="checkbox"
                  checked={includeDefaultInit}
                  onChange={(e) => setIncludeDefaultInit(e.target.checked)}
                  disabled={!!resumeSessionId}
                  className="sr-only"
                />
                <span className="text-sm text-zinc-300">Include default INITIALIZE.md</span>
              </label>

              <div className={`mb-3 ${resumeSessionId ? 'opacity-40' : ''}`}>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Custom Init File</label>
                <select
                  value={customInitFile}
                  onChange={(e) => setCustomInitFile(e.target.value)}
                  disabled={!!resumeSessionId}
                  className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">None</option>
                  {initFiles.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* System Prompt — Always visible, expanded */}
          <div className="border-t border-zinc-800/50 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                <h3 className="text-sm font-medium text-white">System Prompt</h3>
              </div>
              <span className="text-[10px] text-zinc-500 bg-zinc-800/60 border border-zinc-700/30 px-2 py-0.5 rounded-md">Live preview</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3 leading-relaxed">The prompt sent to the AI merges: <span className="text-cyan-400 font-medium">default</span> + <span className="text-blue-400 font-medium">general</span> + <span className="text-purple-400 font-medium">project</span> + <span className="text-amber-400 font-medium">session</span> additions.</p>
            <div className="bg-zinc-900/90 rounded-xl border border-zinc-800/50 overflow-hidden shadow-sm">
              {/* Prompt header with layer indicators */}
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 border-b border-zinc-800/40">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.4)]" />
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">Default (always included)</span>
                {generalAdditions && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1" />
                    <span className="text-[9px] text-zinc-500">+ General</span>
                  </>
                )}
                {projectPrompt && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 ml-1" />
                    <span className="text-[9px] text-zinc-500">+ Project</span>
                  </>
                )}
                {customSystemPrompt && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1" />
                    <span className="text-[9px] text-zinc-500">+ Session</span>
                  </>
                )}
              </div>
              {/* Prompt content - styled, scrollable */}
              <div className="p-3 max-h-48 overflow-y-auto">
                {(() => {
                  const parts: { label: string; color: string; content: string }[] = [];
                  parts.push({ label: 'Default', color: 'text-cyan-400', content: DEFAULT_SYSTEM_PROMPT });
                  if (generalAdditions) parts.push({ label: 'General', color: 'text-blue-400', content: generalAdditions });
                  if (projectPrompt) parts.push({ label: 'Project', color: 'text-purple-400', content: projectPrompt });
                  if (customSystemPrompt) parts.push({ label: 'Session', color: 'text-amber-400', content: customSystemPrompt });

                  return parts.map((part, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      {parts.length > 1 && (
                        <div className={`text-[9px] uppercase tracking-wider font-semibold ${part.color} mb-1`}>
                          {part.label} Additions
                        </div>
                      )}
                      <div className="text-[11px] text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap">
                        {part.content.substring(0, 2000)}
                        {part.content.length > 2000 && (
                          <span className="text-zinc-600">... [{part.content.length - 2000} more chars]</span>
                        )}
                      </div>
                      {i < parts.length - 1 && (
                        <div className="flex items-center gap-1 justify-center text-zinc-700 my-2">
                          <span className="w-1 h-1 rounded-full bg-zinc-700" />
                          <span className="w-1 h-1 rounded-full bg-zinc-700" />
                          <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Session Additions <span className="text-zinc-600 font-normal">(appended to merged prompt)</span></label>
              <textarea
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-white text-sm h-16 resize-none placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all duration-150"
                placeholder="Extra instructions for this specific session..."
              />
            </div>
          </div>
        </div>



        <div className="flex gap-3 pt-4 border-t border-zinc-800/50">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-lg text-sm font-medium border border-zinc-700/50 transition-all duration-150 active:scale-[0.98]">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98] hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] ${
              mode === 'setup'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500'
            }`}
          >
            {mode === 'setup' ? 'Setup Agent' : mode === 'new-agent' ? 'Start Agent' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}