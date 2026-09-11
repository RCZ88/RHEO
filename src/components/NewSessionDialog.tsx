import { useState, useEffect, useRef, useCallback, Fragment, type FormEvent } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, BookOpen, Zap, Network, FolderTree, FileText, Bot, Palette, RefreshCw, Check, AlertCircle, Brain, Terminal } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT } from '../lib/defaults';
import { assembleContext } from '../services/ContextService';
import { WORKSPACE_CONFIG_PREF_KEY } from './ContextSidebar';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { NumberTicker } from './ui/number-ticker';
import { Skeleton } from './ui/skeleton';
import { Particles } from './ui/particles';
import type { WorkspaceConfig } from './ContextSidebar';

const NSD_ACCENT = { ['--page-accent' as any]: '#2dd4bf' } as any;

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
        levels: { design_variance: number; motion_intensity: number; visual_density: number };
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

const HEALTH_LABELS: Record<Health, string> = {
  healthy: 'Live',
  degraded: 'Degraded',
  missing: 'Not configured',
  unknown: 'Checking',
  error: 'Error',
};

interface SystemInfo {
  id: string; name: string; icon: any; accentColor: string;
  itemCount: number; itemLabel: string; lastBuilt: string | null;
  maxTokens: number; enabled: boolean; onToggle: () => void;
  health: Health; lastSynced: string | null; onVerify: () => void;
  refreshing: boolean; lastError: string | null;
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

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SYSTEM_DEFS: Array<{ id: string; name: string; icon: any; accentColor: string; maxTokens: number; defaultLabel: string }> = [
  { id: 'llm_wiki', name: 'LLM Wiki', icon: BookOpen, accentColor: 'text-blue-400', maxTokens: 2000, defaultLabel: 'files' },
  { id: 'obsidian_skills', name: 'Obsidian Skills', icon: Zap, accentColor: 'text-purple-400', maxTokens: 500, defaultLabel: 'skills' },
  { id: 'graphify', name: 'Graphify', icon: Network, accentColor: 'text-cyan-400', maxTokens: 500, defaultLabel: 'nodes' },
  { id: 'para', name: 'PARA', icon: FolderTree, accentColor: 'text-teal-400', maxTokens: 300, defaultLabel: 'areas' },
  { id: 'qmd', name: 'QMD Templates', icon: FileText, accentColor: 'text-amber-400', maxTokens: 200, defaultLabel: 'templates' },
  { id: 'automations', name: 'Automations', icon: Bot, accentColor: 'text-rose-400', maxTokens: 100, defaultLabel: 'automations' },
  { id: 'design_skills', name: 'Design Skills', icon: Palette, accentColor: 'text-pink-400', maxTokens: 800, defaultLabel: 'design skills' },
];

/* ─── System Toggle Card (skeleton / error / expandable) ─── */
function SystemToggleCard({ system, verifySignal, index }: { system: SystemInfo; verifySignal: VerifySignal; index: number }) {
  const toggleColors: Record<string, { on: string }> = {
    llm_wiki: { on: 'bg-blue-500/40' }, obsidian_skills: { on: 'bg-purple-500/40' },
    graphify: { on: 'bg-cyan-500/40' }, para: { on: 'bg-teal-500/40' },
    qmd: { on: 'bg-amber-500/40' }, automations: { on: 'bg-rose-500/40' },
    design_skills: { on: 'bg-pink-500/40' },
  };
  const dotColors: Record<string, { on: string }> = {
    llm_wiki: { on: 'left-3.5 bg-blue-400' }, obsidian_skills: { on: 'left-3.5 bg-purple-400' },
    graphify: { on: 'left-3.5 bg-cyan-400' }, para: { on: 'left-3.5 bg-teal-400' },
    qmd: { on: 'left-3.5 bg-amber-400' }, automations: { on: 'left-3.5 bg-rose-400' },
    design_skills: { on: 'left-3.5 bg-pink-400' },
  };
  const c = toggleColors[system.id]; const d = dotColors[system.id];
  const [flash, setFlash] = useState<'none' | 'green' | 'red'>('none');
  const [countPulse, setCountPulse] = useState(false);
  const [dotReady, setDotReady] = useState(system.health !== 'unknown');
  const [expanded, setExpanded] = useState(false);
  const prevCount = useRef(system.itemCount);
  const lastSignalN = useRef(0);

  useEffect(() => {
    if (verifySignal && verifySignal.id === system.id && verifySignal.n !== lastSignalN.current) {
      lastSignalN.current = verifySignal.n; setFlash(verifySignal.status);
    }
  }, [verifySignal, system.id]);
  useEffect(() => { if (flash === 'none') return; const t = setTimeout(() => setFlash('none'), 1000); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (system.health !== 'unknown' && !dotReady) { const t = setTimeout(() => setDotReady(true), 20); return () => clearTimeout(t); } }, [system.health, dotReady]);
  useEffect(() => {
    if (prevCount.current !== system.itemCount && prevCount.current !== 0) { setCountPulse(true); const t = setTimeout(() => setCountPulse(false), 800); prevCount.current = system.itemCount; return () => clearTimeout(t); }
    prevCount.current = system.itemCount;
  }, [system.itemCount]);

  const dotBase: Record<Health, string> = {
    healthy: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]', degraded: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]',
    missing: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]', error: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]', unknown: 'bg-zinc-600',
  };
  const flashClass = flash === 'green' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse' : flash === 'red' ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse' : '';
  const dotClass = flash !== 'none' ? flashClass : dotBase[system.health];
  const scaleClass = dotReady ? 'scale-100' : 'scale-75';
  const loading = system.health === 'unknown';
  const isEmptyDegraded = system.health === 'degraded' && system.itemCount === 0;
  const isError = system.health === 'error';

  const tip = system.health === 'healthy' ? `Live: ${system.itemCount} ${system.itemLabel} · updated ${formatRelTime(system.lastSynced)}`
    : system.health === 'degraded' ? `System exists but no items found${system.lastBuilt ? ` · last built ${formatRelTime(system.lastBuilt)}` : ''}`
    : system.health === 'missing' ? 'Not configured — run Initialize or create the directory'
    : system.health === 'error' ? `Error: ${system.lastError ?? 'unknown'}` : 'Checking…';

  const timeText = system.lastSynced ? formatRelTime(system.lastSynced) : system.lastBuilt ? `Built ${formatRelTime(system.lastBuilt)}` : '';
  const timeClass = staleClass(system.lastSynced || system.lastBuilt);

  if (loading) {
    return (
      <div className="nsd-anim rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3" style={{ animationDelay: `${index * 45}ms` }}>
        <Skeleton className="mb-2 h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    );
  }

  return (
    <div className={`nsd-anim group relative border rounded-xl p-3 transition-all duration-200 ${isError ? 'border-red-500/40 bg-red-500/5' : system.enabled ? 'bg-zinc-800/40 border-zinc-600/40 shadow-[0_1px_4px_rgba(0,0,0,0.1)]' : 'bg-zinc-900/30 border-zinc-700/30 opacity-60 hover:opacity-80'}`} style={{ animationDelay: `${index * 45}ms` }}>
      <span className="group/tooltip absolute top-2 left-2 z-10">
        <span className={`block w-2 h-2 rounded-full transition-transform duration-300 ${scaleClass} ${dotClass}`} />
        <span className="absolute left-0 top-3 hidden group-hover/tooltip:block whitespace-nowrap rounded-md bg-zinc-950/95 border border-zinc-700/60 px-2 py-1 text-[10px] text-zinc-300 shadow-lg z-20">{tip}</span>
      </span>
      <div className="pl-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1 rounded-md ${system.enabled ? 'bg-zinc-800/60' : 'bg-zinc-800/20'}`}>
              <system.icon className={`w-3.5 h-3.5 ${system.accentColor}`} />
            </div>
            <span className="text-[11px] text-zinc-300 font-medium truncate">{system.name}</span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={() => setExpanded(!expanded)} title={expanded ? 'Hide details' : 'Show details'} className={`p-1 rounded-md hover:bg-zinc-700/50 transition-all duration-150 ${expanded ? 'text-cyan-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <button type="button" onClick={system.onVerify} disabled={system.refreshing} title="Verify" className="p-1 rounded-md hover:bg-zinc-700/50 disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${system.refreshing ? 'animate-spin text-cyan-400' : 'text-zinc-600 hover:text-zinc-400'}`} />
            </button>
            <button type="button" onClick={system.onToggle} aria-pressed={system.enabled} title={system.enabled ? 'Disable' : 'Enable'} className={`w-8 h-4 rounded-full transition-all duration-200 relative ${system.enabled ? c.on : 'bg-zinc-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 shadow-sm ${system.enabled ? d.on : 'left-0.5 bg-zinc-400'}`} />
            </button>
          </div>
        </div>
        <div className="text-[10px] text-zinc-500 leading-relaxed">
          {isError ? <span className="text-red-400">Check failed{system.lastError ? `: ${system.lastError}` : ''}</span> : isEmptyDegraded ? <span className="text-amber-500">Empty</span> : (
            <span className={`transition-colors duration-300 ${countPulse ? 'text-emerald-400' : 'text-zinc-400'}`}>{system.itemCount} {system.itemLabel}</span>
          )}
          <span className="text-zinc-600 mx-1">·</span>
          <span className="text-zinc-600 text-[10px]">~{system.maxTokens}t</span>
          {timeText ? <><span className="text-zinc-600 mx-1">·</span><span className={timeClass}>{timeText}</span></> : null}
        </div>
        {expanded && (
          <div className="nsd-fadein mt-2 pt-2 border-t border-zinc-700/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Token budget</span>
              <span className="text-[10px] text-zinc-300">~{system.maxTokens} tokens</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Last verified</span>
              <span className={`text-[10px] ${timeClass}`}>{timeText || 'Never'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Status</span>
              <span className="text-[10px] text-zinc-300">{HEALTH_LABELS[system.health]}</span>
            </div>
            {isError && (
              <button type="button" onClick={system.onVerify} className="text-[10px] text-red-300 hover:text-red-200 underline underline-offset-2 transition-colors">
                Retry check
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Context map visualization (clickable nodes + animated beams) ─── */
interface ContextItem { node: string; type: string; label?: string; value: string; status?: string; usedTokens?: number; total?: number; }
interface ContextState { items: ContextItem[]; graphNodes: string[]; usedTokens: number; loading: boolean; error?: string; }

function ContextMapVisualization({ ctx, prevNode, allNodes, toggleState, getColor, SYSTEM_DEFS: _defs, activeSystems, findSystem, onNodeClick, layoutMode, svgDim }: {
  ctx: ContextState; prevNode: string | null; allNodes: string[];
  toggleState: (n: string) => boolean;
  getColor: (n: string) => string; SYSTEM_DEFS: typeof SYSTEM_DEFS;
  activeSystems: string[]; findSystem: (id: string) => { name: string; icon: any; accentColor: string } | undefined;
  onNodeClick: (n: string) => void; layoutMode: 'grid' | 'line' | 'radial'; svgDim: { w: number; h: number };
}) {
  const w = svgDim.w, h = svgDim.h;
  const positions: Record<string, { x: number; y: number }> = {};
  if (layoutMode === 'line') {
    const startX = 40, endX = w - 40, y = 42;
    const ordered = allNodes.filter(n => n !== 'user' && n !== 'chat');
    const cnt = ordered.length + 2;
    const step = (endX - startX) / (cnt - 1 || 1);
    positions['user'] = { x: startX, y };
    ordered.forEach((n, i) => { positions[n] = { x: startX + step * (i + 1), y }; });
    positions['chat'] = { x: endX, y };
  } else {
    const cols = 3, rows = 3;
    const cellW = w / cols, cellH = h / rows;
    const offX = (i: number) => (i % 2 === 0 ? -1 : 1) * Math.abs(Math.sin(i * 1.7)) * 14;
    const offY = (i: number) => (i % 2 === 0 ? -1 : 1) * Math.abs(Math.cos(i * 2.3)) * 10;
    allNodes.forEach((n, i) => {
      if (n === 'user' || n === 'chat') return;
      const col = i % cols, row = Math.floor(i / cols);
      const cx = 24 + col * cellW + cellW / 2, cy = 16 + row * cellH + cellH / 2;
      positions[n] = { x: cx + offX(i), y: cy + offY(i) };
    });
    positions['user'] = { x: 18, y: 8 };
    positions['chat'] = { x: w - 18, y: h - 8 };
  }
  void prevNode;

  const edgePairs: Array<[string, string]> = [];
  const seenEdges = new Set<string>();
  const addEdge = (a: string, b: string) => {
    const key = [a, b].sort().join('|');
    if (a === b || seenEdges.has(key)) return;
    seenEdges.add(key);
    edgePairs.push([a, b]);
  };
  activeSystems.forEach((sid, i) => {
    if (i > 0) addEdge(activeSystems[i - 1], sid);
  });
  if (activeSystems.length) addEdge('user', activeSystems[0]);
  if (activeSystems.length) addEdge(activeSystems[activeSystems.length - 1], 'chat');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" role="img" aria-label="Context systems map">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {edgePairs.map(([a, b], i) => {
        const pa = positions[a], pb = positions[b];
        if (!pa || !pb) return null;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const active = toggleState(a) && toggleState(b);
        const cy = getColor(a) === getColor(b) ? getColor(a) : '#22d3ee';
        return (
          <g key={i}>
            <line x1={pa.x + nx * 6} y1={pa.y + ny * 6} x2={pb.x + nx * 6} y2={pb.y + ny * 6}
              stroke={active ? cy : '#2b2b35'} strokeWidth={active ? 1.2 : 0.8} strokeOpacity={active ? 0.85 : 0.55}
              strokeDasharray={active ? '5,4' : undefined}
              className={active ? 'nsd-beam' : undefined} />
          </g>
        );
      })}
      {allNodes.map((n) => {
        const p = positions[n];
        if (!p) return null;
        const isUser = n === 'user', isChat = n === 'chat';
        const sys = findSystem(n);
        const color = getColor(n);
        const on = toggleState(n);
        const r = isUser || isChat ? 5 : 7;
        return (
          <g key={n} onClick={() => onNodeClick(n)} role="button" aria-label={isUser ? 'You' : isChat ? 'Session' : sys ? sys.name : n} className="cursor-pointer">
            {isUser || isChat ? null : (
              <circle cx={p.x} cy={p.y} r={r + 2} fill={color} opacity={on ? 0.22 : 0.08}>
                <animate attributeName="r" values={`${r + 1};${r + 3.5};${r + 1}`} dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={p.x} cy={p.y} r={r} fill={isUser || isChat ? '#ffffff' : color} stroke={on ? color : '#3f3f46'}
              strokeWidth={on ? 1.6 : 0.8} filter={on ? 'url(#glow)' : undefined}
              opacity={isUser || isChat ? 0.95 : on ? 0.95 : 0.6} />
            <circle cx={p.x} cy={p.y} r={r} fill="transparent" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.4" />
            <title>{isUser ? 'You' : isChat ? 'Session output' : `${sys?.name ?? n} — ${on ? 'enabled' : 'disabled'} (click to toggle)`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Wizard step indicator ─── */
function StepIndicator({ step, labels, accent }: { step: number; labels: string[]; accent: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      {labels.map((label, i) => {
        const active = i === step, done = i < step;
        return (
          <Fragment key={label}>
            {i > 0 && <div className={`h-px flex-1 max-w-6 ${done ? 'bg-zinc-600' : 'bg-zinc-800'}`} />}
            <span className={`text-[10px] rounded-md px-1.5 py-0.5 transition-all duration-200 ${active ? `text-zinc-950 font-semibold ${accent}` : done ? 'text-zinc-400 bg-zinc-800/70' : 'text-zinc-600 bg-zinc-800/30'}`}>
              {label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

/* ─── System prompt layer bar + preview ─── */
function LayerBar() {
  const layers = [
    { name: 'default', color: '#2dd4bf' },
    { name: 'general', color: '#a78bfa' },
    { name: 'project', color: '#34d399' },
    { name: 'session', color: '#fbbf24' },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Stack</span>
      {layers.map((l) => (
        <span key={l.name} className="flex items-center gap-1 text-[10px] text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
          {l.name}
        </span>
      ))}
    </div>
  );
}

function PromptPreview({ title, content, defaultContent, maxChars = 2000 }: { title: string; content: string; defaultContent: string; maxChars?: number }) {
  const [showFull, setShowFull] = useState(false);
  const base = content.trim() || defaultContent;
  const truncated = base.length > maxChars;
  const shown = showFull || !truncated ? base : base.slice(0, maxChars) + '…';
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{title}</span>
        {truncated && (
          <button type="button" onClick={() => setShowFull(!showFull)} className="text-[10px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors">
            {showFull ? 'Show less' : `Show all (${base.length.toLocaleString()})`}
          </button>
        )}
      </div>
      <pre className="text-[10px] leading-relaxed text-zinc-400 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto pr-1">{shown}</pre>
    </div>
  );
}

function getPromptParts(projectPrompt: string | undefined, initContent: string | undefined, additions: string) {
  const stack: Array<{ label: string; color: string; content: string }> = [
    { label: 'default', color: '#2dd4bf', content: DEFAULT_SYSTEM_PROMPT },
  ];
  if (projectPrompt && projectPrompt.trim()) stack.push({ label: 'project', color: '#34d399', content: projectPrompt });
  if (initContent && initContent.trim()) stack.push({ label: 'session', color: '#fbbf24', content: initContent });
  const combined = stack.map((l) => l.content).join('\n\n');
  const additionsBlock = additions.trim() ? `\n\n## Session Additions\n${additions.trim()}` : '';
  const effective = combined + additionsBlock;
  return { stack, combined, additionsBlock, effective };
}

/* ─── Main component ─── */
export function NewSessionDialog({ open, mode = 'create', onClose, onCreate, projectPath, projectId, projectPrompt, terminalTabs, defaultAgent, initialTerminalMode = 'create', initialSelectedTerminal, defaultName }: NewSessionDialogProps) {
  const [name, setName] = useState(defaultName ?? '');
  const [agentType, setAgentType] = useState(defaultAgent || 'claude');
  const [terminalMode, setTerminalMode] = useState<'create' | 'select'>(initialTerminalMode || 'create');
  const [selectedTerminal, setSelectedTerminal] = useState(initialSelectedTerminal ?? '');
  const [resumeId, setResumeId] = useState('');
  const [initializeFile, setInitializeFile] = useState('INITIALIZE.md');
  const [includeDefaultInit, setIncludeDefaultInit] = useState(true);
  const [step, setStep] = useState(0);
  const [stepDir, setStepDir] = useState<'next' | 'back'>('next');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(true);
  const [initFiles, setInitFiles] = useState<string[]>([]);
  const [initContent, setInitContent] = useState('');
  const [ctxState, setCtxState] = useState<ContextState>({ items: [], graphNodes: [], usedTokens: 0, loading: true });
  const [prevNode, setPrevNode] = useState<string | null>(null);
  const [ctxLoadFailed, setCtxLoadFailed] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'line' | 'radial'>('grid');
  const [verifySignal, setVerifySignal] = useState<VerifySignal>(null);
  const [enabledNodes, setEnabledNodes] = useState<Set<string>>(new Set(['user', 'chat']));
  const [sessionAdditions, setSessionAdditions] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [tokenBudget, setTokenBudget] = useState(2000);
  const [modelTier, setModelTier] = useState<'top' | 'mid' | 'low'>('mid');
  const [tierHint, setTierHint] = useState(false);
  const lastReqRef = useRef<{ fn: string; data?: string } | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [backendSystems, setBackendSystems] = useState<Record<string, BackendSystem>>({});
  const [agentsContext, setAgentsContext] = useState<any[]>([]);
  const [showAgentsCtx, setShowAgentsCtx] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSPACE_CONFIG_PREF_KEY);
      if (raw) setWorkspaceConfig(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const applyIfLatest = useCallback((fn: string, data?: string, cb?: (d: any) => void) => {
    const current = lastReqRef.current;
    if (!current || current.fn !== fn || (data !== undefined && current.data !== data)) return;
    if (cb) cb(data);
  }, []);

  const getModelTier = useCallback((t: 'top' | 'mid' | 'low') => {
    const map: Record<'top' | 'mid' | 'low', { label: string; hint: string }> = {
      top: { label: 'Top', hint: 'Best reasoning & quality' },
      mid: { label: 'Mid', hint: 'Balanced speed & cost' },
      low: { label: 'Low', hint: 'Fastest & cheapest' },
    };
    return map[t];
  }, []);

  const fetchSystems = useCallback(async () => {
    if (!window.deskflowAPI?.system?.list) return;
    try {
      const res: any = await window.deskflowAPI.system.list();
      if (res && res.ok && Array.isArray(res.systems)) setBackendSystems(Object.fromEntries(res.systems.map((s: any) => [s.id, s])));
    } catch (e) { console.warn('NewSessionDialog: system.list failed', e); }
  }, []);

  const loadSystemStatus = useCallback(async () => {
    if (!window.deskflowAPI?.system?.status) { setCtxState((s) => ({ ...s, loading: false })); return; }
    const data = { projectPath, projectId, includeItems: true, agentType: mode === 'create' ? undefined : agentType };
    try {
      const res: any = await window.deskflowAPI.system.status(data);
      applyIfLatest('status', data.projectPath + '|' + data.projectId + '|' + data.agentType, (d) => {
        if (d && d.ok) {
          const items: ContextItem[] = d.items || [];
          setCtxState({ items, graphNodes: d.nodes || [], usedTokens: d.usedTokens || 0, loading: false });
          setTokenBudget(d.total_token_budget ?? 2000);
          setPrevNode(d.nodes?.[0] ?? null);
          setCtxLoadFailed(false);
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      applyIfLatest('status', data.projectPath + '|' + data.projectId + '|' + data.agentType, () => {
        setCtxLoadFailed(true);
        setCtxState({ items: [], graphNodes: [], usedTokens: 0, loading: false, error: msg });
      });
    }
  }, [projectPath, projectId, mode, agentType, applyIfLatest]);

  const verifySystem = useCallback(async (systemId: string) => {
    if (!window.deskflowAPI?.system?.verify || refreshing) return;
    setRefreshing(systemId);
    const data = { systemId, projectPath, projectId, agentType: mode === 'create' ? undefined : agentType };
    const signal: VerifySignal = { id: systemId, status: 'green', n: Date.now() };
    lastReqRef.current = { fn: 'verify', data: systemId };
    setVerifySignal(signal);
    try {
      const res: any = await window.deskflowAPI.system.verify(data);
      applyIfLatest('verify', systemId, (d: any) => {
        setVerifySignal(d && d.ok ? { id: systemId, status: 'green', n: Date.now() } : { id: systemId, status: 'red', n: Date.now() });
      });
    } catch (e) {
      applyIfLatest('verify', systemId, () => { setVerifySignal({ id: systemId, status: 'red', n: Date.now() }); });
      console.warn('verify failed', systemId, e);
    } finally {
      setRefreshing((r) => (r === systemId ? null : r));
      fetchSystems();
    }
  }, [refreshing, projectPath, projectId, mode, agentType, applyIfLatest, fetchSystems]);

  const loadInitFiles = useCallback(async () => {
    if (!window.deskflowAPI?.system?.listInitFiles) return;
    try {
      const res: any = await window.deskflowAPI.system.listInitFiles({ projectPath });
      if (res && res.ok && Array.isArray(res.files)) {
        setInitFiles(res.files.map((f: any) => f.name));
        const init = res.files.find((f: any) => f.name === 'INITIALIZE.md');
        if (init && init.content) setInitContent(init.content);
      }
    } catch (e) { console.warn('listInitFiles failed', e); }
  }, [projectPath]);

  const loadAgentsContext = useCallback(async () => {
    if (!window.deskflowAPI?.system?.getAgentsContext || agentsLoading) return;
    setAgentsLoading(true);
    try {
      const res: any = await window.deskflowAPI.system.getAgentsContext({ projectPath });
      if (res && res.ok && Array.isArray(res.files)) {
        setAgentsContext(res.files);
        const index = res.files.findIndex((f: any) => f.name === 'AGENTS.md');
        if (index >= 0) {
          setAgentsContext((prev) => { const copy = [...prev]; copy.splice(index, 1); copy.unshift(res.files[index]); return copy; });
        }
      }
    } catch (e) { console.warn('getAgentsContext failed', e); }
    finally { setAgentsLoading(false); }
  }, [projectPath, agentsLoading]);

  const buildPreview = useCallback(() => {
    if (!window.deskflowAPI?.system?.assemble) {
      setAgentsContext([]);
      const { effective } = getPromptParts(projectPrompt, includeDefaultInit ? initContent : '', sessionAdditions);
      return { prompt: effective, contextConfig: undefined };
    }
    try {
      const { stack, combined, additionsBlock } = getPromptParts(projectPrompt, includeDefaultInit ? initContent : '', sessionAdditions);
      const params = {
        projectPath, projectId,
        agentType: mode === 'create' ? undefined : agentType,
        initContent: includeDefaultInit ? initContent : '',
        projectPrompt: projectPrompt ?? '',
        stack: stack.map((s) => s.label),
        additions: additionsBlock,
        combined,
      };
      const res: any = window.deskflowAPI.system.assemble(params);
      if (res && res.ok) {
        return { prompt: res.prompt, contextConfig: res.contextConfig };
      }
      return { prompt: combined, contextConfig: undefined };
    } catch (e) {
      const { combined } = getPromptParts(projectPrompt, includeDefaultInit ? initContent : '', sessionAdditions);
      console.warn('assemble failed, falling back', e);
      return { prompt: combined, contextConfig: undefined };
    }
  }, [projectPath, projectId, mode, agentType, initContent, includeDefaultInit, projectPrompt, sessionAdditions]);

  const handleCreate = useCallback(() => {
    if (!name.trim() || !mountedRef.current) return;
    let selectedId = '';
    if (terminalMode === 'create') {
      selectedId = `term-${Date.now()}`;
    } else {
      const tabs = terminalTabs || {};
      if (!selectedTerminal && Object.keys(tabs).length === 1) selectedId = Object.keys(tabs)[0];
      else selectedId = selectedTerminal;
    }
    if (!selectedId) return;
    const { prompt, contextConfig } = buildPreview();
    const config: SessionConfig = {
      id: selectedId,
      name: name.trim(),
      agentType,
      terminalMode,
      selectedTerminal: selectedId,
      resumeId: resumeId.trim() || undefined,
      initializeFile: includeDefaultInit ? initializeFile : undefined,
      customSystemPrompt: prompt || undefined,
      includeDefaultInit,
      initContent: includeDefaultInit ? initContent : undefined,
      modelTier,
      contextConfig,
    };
    onCreate(config);
  }, [name, terminalMode, terminalTabs, selectedTerminal, buildPreview, agentType, resumeId, initializeFile, includeDefaultInit, initContent, modelTier, onCreate]);

  useEffect(() => {
    mountedRef.current = true;
    if (!open) {
      setStep(0); setName(defaultName ?? ''); setTerminalMode(initialTerminalMode || 'create');
      setSelectedTerminal(initialSelectedTerminal ?? ''); setAgentType(defaultAgent || 'claude');
      setShowAdvanced(false); setShowPrompt(false); setShowReviewPrompt(true); setShowAll(false);
      setCtxState({ items: [], graphNodes: [], usedTokens: 0, loading: true }); setPrevNode(null);
      setCtxLoadFailed(false); setVerifySignal(null); setSessionAdditions('');
      setInitContent(''); setResumeId(''); setInitializeFile('INITIALIZE.md');
      setIncludeDefaultInit(true); setLayoutMode('grid'); setModelTier('mid'); setTokenBudget(2000);
      const ws = workspaceConfig;
      if (ws?.systems) {
        const seeded = new Set(['user', 'chat']);
        Object.keys(ws.systems).forEach((k) => { if (SYSTEM_DEFS.some((d) => d.id === k)) seeded.add(k); });
        setEnabledNodes(seeded);
      } else {
        setEnabledNodes(new Set(['user', 'chat']));
      }
      return;
    }
    if (!name && defaultName) setName(defaultName);
    if (!agentType && defaultAgent) setAgentType(defaultAgent);
    if (!selectedTerminal && initialSelectedTerminal) setSelectedTerminal(initialSelectedTerminal);
    if (!terminalMode && initialTerminalMode) setTerminalMode(initialTerminalMode);
    const req = { fn: 'status', data: (projectPath || '') + '|' + (projectId || '') + '|' + (mode === 'create' ? undefined : agentType) };
    lastReqRef.current = req;
    setCtxState({ items: [], graphNodes: [], usedTokens: 0, loading: true });
    fetchSystems();
    loadSystemStatus();
    loadInitFiles();
    if (mode !== 'create') loadAgentsContext();
    const timer = window.setInterval(() => { loadSystemStatus(); }, 30000);
    return () => { mountedRef.current = false; window.clearInterval(timer); lastReqRef.current = null; };
  }, [open, projectPath, projectId, mode, agentType, fetchSystems, loadSystemStatus, loadInitFiles, loadAgentsContext, name, defaultName, defaultAgent, selectedTerminal, initialSelectedTerminal, terminalMode, initialTerminalMode]);

  useEffect(() => { if (!open) return; const cb = () => { lastReqRef.current = null; };
    window.addEventListener('deskflow:context-update', cb); return () => window.removeEventListener('deskflow:context-update', cb);
  }, [open]);

  const systems: SystemInfo[] = SYSTEM_DEFS.map((def) => {
    const back = backendSystems[def.id];
    const health = deriveHealth(back);
    return {
      id: def.id, name: def.name, icon: def.icon, accentColor: def.accentColor,
      itemCount: back?.itemCount ?? 0,
      itemLabel: back?.itemLabel ?? def.defaultLabel,
      lastBuilt: back?.lastBuilt ?? null,
      maxTokens: def.maxTokens,
      enabled: enabledNodes.has(def.id),
      onToggle: () => setEnabledNodes((prev) => { const next = new Set(prev); if (next.has(def.id)) next.delete(def.id); else next.add(def.id); return next; }),
      health,
      lastSynced: back?.lastBuilt ?? null,
      onVerify: () => verifySystem(def.id),
      refreshing: refreshing === def.id,
      lastError: back?.error ?? null,
    };
  });

  const findSystem = (n: string) => SYSTEM_DEFS.find((d) => d.id === n);
  const getColor = (n: string) => {
    if (n === 'user') return '#ffffff';
    if (n === 'chat') return '#a1a1aa';
    const sys = findSystem(n);
    if (!sys) return '#3f3f46';
    const map: Record<string, string> = { llm_wiki: '#60a5fa', obsidian_skills: '#a78bfa', graphify: '#22d3ee', para: '#2dd4bf', qmd: '#fbbf24', automations: '#fb7185', design_skills: '#f472b6' };
    return map[n] || '#3f3f46';
  };
  const onNodeClick = (n: string) => {
    if (n === 'user' || n === 'chat') return;
    setEnabledNodes((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  };
  const allNodes = [...new Set([...(ctxState.graphNodes.length ? ctxState.graphNodes : SYSTEM_DEFS.map((d) => d.id)), 'user', 'chat'])];
  const activeSystems = allNodes.filter((n) => n !== 'user' && n !== 'chat' && enabledNodes.has(n));
  const ctxSystems = systems;
  const totalNodes = ctxState.graphNodes.length || 0;
  const { effective: effectivePrompt } = getPromptParts(projectPrompt, includeDefaultInit ? initContent : '', sessionAdditions);
  const usedBudget = ctxState.usedTokens || 0;
  const budgetPct = Math.min(100, Math.round((usedBudget / tokenBudget) * 100));
  const totalTokens = ctxSystems.reduce((s, c) => s + (c.enabled ? c.maxTokens : 0), 0);
  const systemCount = totalNodes || ctxState.items.length;
  const agentsCtx = agentsContext;

  const submitForm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 0) {
      if (!name.trim()) return;
      setStepDir('next'); setStep(1); return;
    }
    if (step === 1) {
      setStepDir('next'); setStep(2); return;
    }
    handleCreate();
  };

  const goBack = () => { if (step === 0) return; setStepDir('back'); setStep(step - 1); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-5 max-h-[85vh] overflow-y-auto" style={NSD_ACCENT}>
        <DialogTitle className="sr-only">New session</DialogTitle>
        <DialogDescription className="sr-only">Create a new AI agent session</DialogDescription>
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <Particles className="absolute inset-0" quantity={22} color="#22d3ee" opacity={0.16} />
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 pr-8 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300">
                <Terminal className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-zinc-100 leading-tight">New Session</h2>
                <p className="text-[10px] text-zinc-500">{mode === 'create' ? 'Launch a fresh agent in this project' : mode === 'new-agent' ? 'Add an agent to an open terminal' : 'Initialize the workspace context'}</p>
              </div>
              {step > 0 && <span className="shrink-0 text-[10px] rounded-md bg-zinc-800/70 border border-zinc-700/50 px-1.5 py-0.5 text-zinc-400">Step {step + 1} of 3</span>}
            </div>

            <form onSubmit={submitForm}>
              <div key={step} className={stepDir === 'next' ? 'nsd-slideInRight' : 'nsd-slideInLeft'}>
                {step === 0 && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Session name</label>
                      <input
                        autoFocus value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={defaultName || 'e.g. Fix the login bug'}
                        className="w-full rounded-xl border border-zinc-700/60 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all duration-150 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Agent</label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {SUPPORTED_AGENTS.map((a) => (
                          <button key={a.id} type="button" onClick={() => setAgentType(a.id)}
                            className={`rounded-xl border px-2 py-1.5 text-[11px] transition-all duration-150 ${agentType === a.id ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-zinc-700/50 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'}`}>
                            {a.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Terminal</label>
                      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                        <button type="button" onClick={() => setTerminalMode('create')}
                          className={`rounded-xl border px-2 py-1.5 text-[11px] transition-all duration-150 ${terminalMode === 'create' ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-zinc-700/50 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'}`}>
                          Create new terminal
                        </button>
                        <button type="button" onClick={() => setTerminalMode('select')} disabled={!terminalTabs || Object.keys(terminalTabs).length === 0}
                          className={`rounded-xl border px-2 py-1.5 text-[11px] transition-all duration-150 disabled:opacity-40 ${terminalMode === 'select' ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-zinc-700/50 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'}`}>
                          Use open terminal
                        </button>
                      </div>
                      {terminalMode === 'select' && terminalTabs && Object.keys(terminalTabs).length > 0 ? (
                        <select value={selectedTerminal} onChange={(e) => setSelectedTerminal(e.target.value)}
                          className="w-full rounded-xl border border-zinc-700/60 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 outline-none transition-all duration-150 focus:border-cyan-400/50">
                          {Object.entries(terminalTabs).map(([id, t]) => <option key={id} value={id}>{t.name} ({t.agent})</option>)}
                        </select>
                      ) : terminalMode === 'select' ? (
                        <p className="text-[10px] text-amber-400/80">No terminals are open right now. Pick "Create new terminal" above instead.</p>
                      ) : null}
                    </div>

                    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150">
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                      Advanced Configuration
                    </button>

                    <button type="button" onClick={() => setShowPrompt(!showPrompt)} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150">
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showPrompt ? 'rotate-180' : ''}`} />
                      System prompt
                    </button>
                    {showPrompt && (
                      <div className="nsd-fadein space-y-2">
                        <LayerBar />
                        <PromptPreview title="Effective system prompt" content={effectivePrompt} defaultContent={DEFAULT_SYSTEM_PROMPT} />
                      </div>
                    )}

                    {showAdvanced && (
                      <div className="nsd-fadein space-y-3 border-t border-zinc-800/60 pt-3">
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Model tier</label>
                          <div className="flex items-center gap-1.5" onMouseEnter={() => setTierHint(true)}>
                            {(['top', 'mid', 'low'] as const).map((t) => (
                              <button key={t} type="button" onClick={() => setModelTier(t)}
                                className={`flex-1 rounded-xl border px-2 py-1.5 text-[11px] transition-all duration-150 ${modelTier === t ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200' : 'border-zinc-700/50 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600'}`}>
                                {getModelTier(t).label}
                              </button>
                            ))}
                          </div>
                          <p className="mt-1 text-[10px] text-zinc-500">{tierHint ? getModelTier(modelTier).hint : 'Choose the model quality for this session'}</p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Context systems</label>
                          <div className="space-y-1.5">
                            {systems.map((s, i) => (
                              <SystemToggleCard key={s.id} system={s} verifySignal={verifySignal} index={i} />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Init content</label>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                              <input type="checkbox" checked={includeDefaultInit} onChange={(e) => setIncludeDefaultInit(e.target.checked)} className="accent-cyan-400" />
                              Use default
                            </label>
                            {includeDefaultInit && initFiles.length > 0 && (
                              <select value={initializeFile} onChange={(e) => setInitializeFile(e.target.value)} className="rounded-lg border border-zinc-700/60 bg-zinc-950/60 px-2 py-1 text-[11px] text-zinc-300 outline-none">
                                {initFiles.map((f) => <option key={f} value={f}>{f}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-medium text-zinc-400">Context map</label>
                        <div className="flex items-center gap-1">
                          {(['grid', 'line', 'radial'] as const).map((m) => (
                            <button key={m} type="button" onClick={() => setLayoutMode(m)}
                              className={`rounded-md px-1.5 py-0.5 text-[10px] transition-all duration-150 ${layoutMode === m ? 'bg-cyan-400/10 text-cyan-300' : 'text-zinc-600 hover:text-zinc-400'}`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative rounded-xl border border-zinc-800/60 bg-zinc-950/60 overflow-hidden">
                        {ctxState.loading ? (
                          <div className="h-44 flex items-center justify-center"><Skeleton className="h-3 w-1/3" /></div>
                        ) : ctxLoadFailed ? (
                          <div className="h-44 flex flex-col items-center justify-center gap-2 text-zinc-500">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span className="text-[11px]">Context status unavailable</span>
                            <button type="button" onClick={() => { setCtxLoadFailed(false); loadSystemStatus(); }} className="text-[10px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors">Retry</button>
                          </div>
                        ) : (
                          <ContextMapVisualization ctx={ctxState} prevNode={prevNode} allNodes={allNodes} toggleState={(n) => enabledNodes.has(n)} getColor={getColor} SYSTEM_DEFS={SYSTEM_DEFS} activeSystems={activeSystems} findSystem={findSystem} onNodeClick={onNodeClick} layoutMode={layoutMode} svgDim={{ w: 680, h: 190 }} />
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-600">click nodes to toggle</span>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{totalNodes || systemCount} sources</span>
                          <span className="flex items-center gap-1"><NumberTicker value={usedBudget} direction="up" className="text-cyan-300" />/{tokenBudget} tokens</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-cyan-400/80 transition-all duration-500" style={{ width: `${budgetPct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-zinc-400">Context systems ({systems.filter((s) => s.enabled).length}/{systems.length})</label>
                      <button type="button" onClick={() => setShowAll(!showAll)} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150 underline underline-offset-2">{showAll ? 'Show less' : 'Show all'}</button>
                    </div>
                    <div className="space-y-1.5">
                      {(showAll ? systems : systems.slice(0, 4)).map((s, i) => <SystemToggleCard key={s.id} system={s} verifySignal={verifySignal} index={i} />)}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3.5">
                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/60">
                          <Brain className="w-4 h-4 text-cyan-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-zinc-100 font-medium truncate">{name.trim() || 'Untitled session'}</div>
                          <div className="text-[10px] text-zinc-500">{SUPPORTED_AGENTS.find((a) => a.id === agentType)?.name || agentType} · {terminalMode === 'create' ? 'new terminal' : 'existing terminal'} · {getModelTier(modelTier).label}</div>
                        </div>
                        <span className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400"><Check className="w-3 h-3" />Ready</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span>{ctxState.items.length} context items</span><span className="text-zinc-700">·</span>
                        <span>{systems.filter((s) => s.enabled).length} systems</span><span className="text-zinc-700">·</span>
                        <span>{totalTokens}t budget</span>
                      </div>
                    </div>

                    <button type="button" onClick={() => setShowReviewPrompt(!showReviewPrompt)} className="flex items-center justify-between w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
                      <span className="flex items-center gap-2 text-[11px] text-zinc-300 font-medium"><ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showReviewPrompt ? 'rotate-180' : ''}`} />System prompt</span>
                      <LayerBar />
                    </button>
                    {showReviewPrompt && (
                      <div className="nsd-fadein space-y-2">
                        <PromptPreview title="Effective system prompt" content={effectivePrompt} defaultContent={DEFAULT_SYSTEM_PROMPT} />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Session additions (optional)</label>
                      <VoiceInputWrapper>
                        <textarea value={sessionAdditions} onChange={(e) => setSessionAdditions(e.target.value)}
                          placeholder="Extra instructions for this session only…" rows={2}
                          className="w-full rounded-xl border border-zinc-700/60 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all duration-150 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 resize-none" />
                      </VoiceInputWrapper>
                    </div>

                    {agentsCtx.length > 0 && (
                      <div>
                        <button type="button" onClick={() => setShowAgentsCtx(!showAgentsCtx)} className="flex items-center justify-between w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
                          <span className="flex items-center gap-2 text-[11px] text-zinc-300 font-medium"><ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showAgentsCtx ? 'rotate-180' : ''}`} />Agent context ({agentsCtx.length})</span>
                          <span className="text-[10px] text-zinc-500">{agentsLoading ? 'Loading…' : `${agentsCtx.length} files`}</span>
                        </button>
                        {showAgentsCtx && (
                          <div className="nsd-fadein mt-1.5 space-y-1">
                            {agentsCtx.map((f: any) => (
                              <div key={f.id ?? f.name} className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-zinc-950/40 px-2 py-1">
                                <span className="text-[10px] text-zinc-400 truncate">{f.name}</span>
                                <span className="shrink-0 text-[10px] text-zinc-600">{(f.size ?? 0).toLocaleString()} B</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-zinc-800/60">
                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <button type="button" onClick={goBack} className="flex items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-3 py-1.5 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all duration-150">
                      <ChevronLeft className="w-3 h-3" />Back
                    </button>
                  )}
                  <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-3 py-1.5 text-[11px] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all duration-150">Cancel</button>
                </div>
                <button type="submit"
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-medium transition-all duration-150 ${step < 2 ? 'bg-cyan-400/10 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/20' : 'bg-cyan-400 text-zinc-950 hover:bg-cyan-300'}`}>
                  {step < 2 ? <>Next<ChevronRight className="w-3 h-3" /></> : <>Create session<ChevronRight className="w-3 h-3" /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
        <style>{`
@keyframes nsd-slideUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes nsd-slideInRight { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
@keyframes nsd-slideInLeft { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
@keyframes nsd-fadein { from { opacity: 0; } to { opacity: 1; } }
@keyframes nsd-beam-flow { to { stroke-dashoffset: -18; } }
.nsd-anim { animation: nsd-slideUp 0.3s ease-out both; }
.nsd-slideInRight { animation: nsd-slideInRight 0.22s ease-out both; }
.nsd-slideInLeft { animation: nsd-slideInLeft 0.22s ease-out both; }
.nsd-fadein { animation: nsd-fadein 0.2s ease-out both; }
.nsd-beam { animation: nsd-beam-flow 1.4s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .nsd-anim, .nsd-slideInRight, .nsd-slideInLeft, .nsd-fadein, .nsd-beam { animation: none !important; }
}
`}</style>
      </DialogContent>
    </Dialog>
  );
}


