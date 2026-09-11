import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Search, Bug, Sparkles, Terminal, Clock, ChevronDown, ChevronRight,
  Loader2, CheckCircle2, Circle, ArrowRight, XCircle, History as HistoryIcon, LayoutList, Rows3,
} from 'lucide-react';
import { listContainer, riseItem, expandPanel, DUR, EASE_OUT } from './workspace/_ds/motion';
import { StatusPill, Chip, ProgressBar, Skeleton, IconButton, EmptyState, type WorkStatus } from './workspace/_ds/primitives';

// ---------------------------------------------------------------------------
// Types (unchanged contract with the backend)
// ---------------------------------------------------------------------------
interface PromptEntry {
  id: number;
  session_id: string;
  role?: string;
  prompt: string;
  sent_at: string;
  status?: string;
  session_id_ref: string | null;
  session_topic: string | null;
  agent: string | null;
  category: string | null;
  product_area: string | null;
  session_status: string | null;
  active_problem_id: string | null;
  active_request_id: string | null;
  project_id: string | null;
  binding_agent: string | null;
}

const AGENT_COLORS: Record<string, string> = {
  opencode: 'text-cyan-300 bg-cyan-500/12 ring-1 ring-cyan-500/30',
  claude: 'text-purple-300 bg-purple-500/12 ring-1 ring-purple-500/30',
  aider: 'text-emerald-300 bg-emerald-500/12 ring-1 ring-emerald-500/30',
  codex: 'text-blue-300 bg-blue-500/12 ring-1 ring-blue-500/30',
};
const AGENT_FALLBACK = 'text-zinc-300 bg-zinc-700/50 ring-1 ring-zinc-600/50';

const STATUS_ICON: Record<WorkStatus, any> = {
  pending: Circle, in_progress: Loader2, completed: CheckCircle2, failed: XCircle,
};

const LIMIT_OPTIONS = [3, 5, 10, 20, 50, 100];

// Reduce-motion-safe const motion props (avoid inline object literals in JSX).
const PRESS = { scale: 0.97 };

function normalizeStatus(raw?: string | null): WorkStatus {
  if (raw === 'pending' || raw === 'in_progress' || raw === 'failed') return raw;
  if (raw === 'completed' || !raw) return 'completed';
  return 'completed';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\n.*$/s, '') + '\u2026';
}

// ---------------------------------------------------------------------------
// StatTile + Row are MODULE-LEVEL components. Defining them inside the parent
// component would give them a new identity on every render, forcing React to
// unmount/remount them (and replay their framer-motion fade-in) constantly.
// ---------------------------------------------------------------------------
interface StatTileProps {
  label: string;
  count: number;
  status?: WorkStatus;
  accent?: boolean;
  active: boolean;
  onClick: () => void;
}

const StatTile: React.FC<StatTileProps> = ({ label, count, status, accent, active, onClick }) => (
  <motion.button
    type="button" variants={riseItem} whileTap={PRESS}
    onClick={onClick}
    className={`flex flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none ${
      active
        ? 'bg-[color-mix(in_srgb,var(--page-accent)_14%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--page-accent)_40%,transparent)]'
        : 'bg-zinc-800/50 ring-1 ring-zinc-700/50 hover:bg-zinc-800'
    }`}
  >
    <span className={`tabular-nums text-lg font-semibold leading-none ${accent ? 'text-[color:var(--page-accent)]' : 'text-zinc-100'}`}>{count}</span>
    <span className="text-[11px] font-medium text-zinc-400">{label}</span>
  </motion.button>
);

interface RowProps {
  entry: PromptEntry;
  nested?: boolean;
  isExpanded: boolean;
  status: WorkStatus;
  isDeleting: boolean;
  agentColor: string;
  onToggleExpand: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onNavigateToSession?: (sessionId: string) => void;
}

const Row: React.FC<RowProps> = ({ entry, nested, isExpanded, status, isDeleting, agentColor, onToggleExpand, onDelete, onNavigateToSession }) => {
  const StatusIcon = STATUS_ICON[status];

  return (
    <motion.div
      layout variants={riseItem}
      className={`group overflow-hidden rounded-xl transition-colors ${
        nested ? 'bg-transparent hover:bg-zinc-800/30' : 'bg-zinc-800/40 ring-1 ring-zinc-700/50 hover:ring-zinc-600/60'
      } ${status === 'in_progress' ? 'ring-1 ring-cyan-500/40' : ''} ${isDeleting ? 'pointer-events-none opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          type="button" onClick={onToggleExpand} aria-label={isExpanded ? 'Collapse' : 'Expand'}
          className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-200 focus-visible:outline-none"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggleExpand}>
          <div className="mb-1 flex items-center gap-1.5">
            <StatusPill status={status} icon={<StatusIcon className={`h-3 w-3 ${status === 'in_progress' ? 'animate-spin' : ''}`} />} />
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${agentColor}`}>{entry.agent || 'unknown'}</span>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500">
              <Clock className="h-3 w-3" />{formatTime(entry.sent_at)}
            </span>
          </div>
          <p className="line-clamp-2 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-300">
            {truncate(entry.prompt, 140) || <span className="italic text-zinc-500">(empty prompt)</span>}
          </p>
          {entry.session_topic && !nested && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigateToSession?.(entry.session_id_ref || entry.session_id); }}
              className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-[color:var(--page-accent)] hover:underline"
            >
              <Terminal className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{entry.session_topic}</span>
            </button>
          )}
        </div>
        <IconButton title="Delete this prompt" danger onClick={onDelete} className="opacity-0 group-hover:opacity-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </IconButton>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div variants={expandPanel} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
            <div className="space-y-2 border-t border-zinc-700/40 px-2.5 py-2.5">
              <div className="rounded-lg bg-zinc-900/60 p-2.5">
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300">{entry.prompt}</pre>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div><span className="text-zinc-500">Terminal:</span> <span className="font-mono text-[10px] text-zinc-400">{entry.session_id}</span></div>
                {entry.agent && <div><span className="text-zinc-500">Agent:</span> <span className="text-zinc-300">{entry.agent}</span></div>}
                {entry.category && <div><span className="text-zinc-500">Category:</span> <span className="text-zinc-300">{entry.category}</span></div>}
                {entry.product_area && <div><span className="text-zinc-500">Area:</span> <span className="text-zinc-300">{entry.product_area}</span></div>}
                <div className="col-span-2"><span className="text-zinc-500">Sent:</span> <span className="text-zinc-300">{new Date(entry.sent_at).toLocaleString()}</span></div>
              </div>
              {(entry.active_problem_id || entry.active_request_id) && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {entry.active_problem_id && (
                    <span className="flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300 ring-1 ring-red-500/20"><Bug className="h-3 w-3" /> Problem #{entry.active_problem_id}</span>
                  )}
                  {entry.active_request_id && (
                    <span className="flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-300 ring-1 ring-blue-500/20"><Sparkles className="h-3 w-3" /> Request #{entry.active_request_id}</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const PromptHistoryTab: React.FC<{
  projectId?: string;
  projectPath?: string;
  onNavigateToSession?: (sessionId: string) => void;
}> = ({ projectId, projectPath, onNavigateToSession }) => {
  const [entries, setEntries] = useState<PromptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkStatus | null>(null);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});
  const liveStatusRef = useRef<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [visibleLimit, setVisibleLimit] = useState(5);
  const [showOlder, setShowOlder] = useState(false);
  const [deleting, setDeleting] = useState<Set<number>>(new Set());

  // ---- Preferences -------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const api = (window as any).deskflowAPI;
        const prefs = await api?.getPreferences?.();
        if (prefs?.promptHistoryLimit != null) setVisibleLimit(prefs.promptHistoryLimit);
      } catch {}
    })();
  }, []);

  // ---- Initial load ------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const api = (window as any).deskflowAPI;
        const result = await api?.getPromptHistory?.({ projectId, limit: 200 });
        if (result?.success) setEntries(result.data);
        const statusResult = await api?.getPromptStatus?.();
        if (statusResult?.success) {
          const statusMap: Record<string, string> = {};
          for (const row of statusResult.data) statusMap[`${row.session_id}:${row.id}`] = row.status || 'completed';
          setLiveStatuses(statusMap);
          liveStatusRef.current = statusMap;
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [projectId]);

  // ---- Live task status updates -----------------------------------------
  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (!api?.onAiTaskUpdated) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = api.onAiTaskUpdated((data: { terminalId: string; status: string; messageId?: string }) => {
      if (data.messageId) {
        const key = `${data.terminalId}:${data.messageId}`;
        liveStatusRef.current[key] = data.status;
        if (!debounceTimer) {
          debounceTimer = setTimeout(() => {
            setLiveStatuses(prev => {
              const next = { ...liveStatusRef.current };
              return Object.keys(next).some(k => next[k] !== prev[k]) ? next : prev;
            });
            debounceTimer = null;
          }, 500);
        }
      } else {
        setEntries(prev => {
          let changed = false;
          const next = prev.map(e => {
            if (e.session_id === data.terminalId && e.status !== data.status) {
              changed = true;
              return { ...e, status: data.status };
            }
            return e;
          });
          return changed ? next : prev;
        });
      }
    });
    return () => { if (debounceTimer) clearTimeout(debounceTimer); if (typeof cleanup === 'function') cleanup(); };
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    const api = (window as any).deskflowAPI;
    if (!api?.aiTaskWatch) return;
    api.aiTaskWatch(projectPath);
    return () => { api.aiTaskStopWatch?.(projectPath); };
  }, [projectPath]);

  useEffect(() => {
    const api = (window as any).deskflowAPI;
    if (!api?.onAiTaskFileChanged) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = api.onAiTaskFileChanged((data: { tasks: any[] }) => {
      if (!data.tasks?.length) return;
      const taskMap = new Map(data.tasks.map(t => [t.terminal_id + ':' + t.id, t]));
      if (!debounceTimer) {
        debounceTimer = setTimeout(() => {
          setEntries(prev => prev.map(e => {
            for (const [key, task] of taskMap) {
              if (key.startsWith(e.session_id)) return { ...e, status: task.status };
            }
            return e;
          }));
          debounceTimer = null;
        }, 500);
      }
    });
    return () => { if (debounceTimer) clearTimeout(debounceTimer); if (typeof cleanup === 'function') cleanup(); };
  }, []);

  // ---- Handlers ----------------------------------------------------------
  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (entry: PromptEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(prev => new Set(prev).add(entry.id));
    try {
      await (window as any).deskflowAPI?.deleteTerminalMessage?.(entry.id);
      setEntries(prev => prev.filter(x => x.id !== entry.id));
    } catch {}
    setDeleting(prev => { const next = new Set(prev); next.delete(entry.id); return next; });
  };

  const handleLimitChange = async (limit: number) => {
    setVisibleLimit(limit);
    setShowOlder(false);
    try { await (window as any).deskflowAPI?.setPreference?.('promptHistoryLimit', limit); } catch {}
  };

  const getStatus = (entry: PromptEntry): WorkStatus => {
    const key = `${entry.session_id}:${entry.id}`;
    return normalizeStatus(liveStatuses[key] || entry.status);
  };

  // ---- Derived data ------------------------------------------------------
  const agents = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => { if (e.agent) set.add(e.agent); });
    return [...set].sort();
  }, [entries]);

  const promptEntries = useMemo(() => entries.filter(e => e.role !== 'assistant'), [entries]);

  const statusCounts = useMemo(() => {
    const c = { total: 0, in_progress: 0, completed: 0, failed: 0, pending: 0 } as Record<string, number>;
    for (const e of promptEntries) { c.total++; c[getStatus(e)]++; }
    return c;
  }, [promptEntries, liveStatuses]);

  const filtered = useMemo(() => {
    let result = promptEntries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.prompt?.toLowerCase().includes(q) ||
        e.session_topic?.toLowerCase().includes(q) ||
        e.session_id?.toLowerCase().includes(q) ||
        e.active_problem_id?.toLowerCase().includes(q) ||
        e.active_request_id?.toLowerCase().includes(q)
      );
    }
    if (agentFilter) result = result.filter(e => e.agent === agentFilter);
    if (statusFilter) result = result.filter(e => getStatus(e) === statusFilter);
    return result;
  }, [promptEntries, search, agentFilter, statusFilter, liveStatuses]);

  const visibleEntries = useMemo(() => (showOlder ? filtered : filtered.slice(0, visibleLimit)), [filtered, visibleLimit, showOlder]);
  const olderCount = filtered.length - visibleLimit;

  const groupedEntries = useMemo(() => {
    if (viewMode !== 'grouped') return null;
    const groups = new Map<string, { topic: string; entries: PromptEntry[] }>();
    for (const entry of visibleEntries) {
      const key = entry.session_id_ref || entry.session_id || 'unknown';
      if (!groups.has(key)) groups.set(key, { topic: entry.session_topic || 'Unknown Session', entries: [] });
      groups.get(key)!.entries.push(entry);
    }
    return Array.from(groups.entries());
  }, [visibleEntries, viewMode]);

  // ---- Loading skeleton --------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-3">
      {/* Search + view toggle + agent filter */}
      <motion.div variants={riseItem} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search prompts, sessions, problems\u2026"
            className="min-h-[36px] w-full rounded-lg bg-zinc-800 pl-8 pr-2.5 text-[12px] text-zinc-200 ring-1 ring-zinc-700 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]"
          />
        </div>
        <IconButton
          title={viewMode === 'grouped' ? 'Grouped by session' : 'Flat list'}
          onClick={() => setViewMode(v => (v === 'flat' ? 'grouped' : 'flat'))}
        >
          {viewMode === 'grouped' ? <Rows3 className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
        </IconButton>
        {agents.length > 1 && (
          <select
            value={agentFilter || ''} onChange={e => setAgentFilter(e.target.value || null)}
            className="min-h-[36px] rounded-lg bg-zinc-800 px-2 text-[11px] text-zinc-300 ring-1 ring-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]"
          >
            <option value="">All agents</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </motion.div>

      {/* Live status summary tiles (clickable filters) */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Total" count={statusCounts.total} accent active={statusFilter === null} onClick={() => setStatusFilter(null)} />
        <StatTile label="Processing" count={statusCounts.in_progress} status="in_progress" active={statusFilter === 'in_progress'} onClick={() => setStatusFilter('in_progress')} />
        <StatTile label="Completed" count={statusCounts.completed} status="completed" active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} />
        <StatTile label="Failed" count={statusCounts.failed} status="failed" active={statusFilter === 'failed'} onClick={() => setStatusFilter('failed')} />
      </div>

      {/* Result count + limit selector */}
      <motion.div variants={riseItem} className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>{visibleEntries.length} of {filtered.length} prompt{filtered.length !== 1 ? 's' : ''}</span>
          {(statusFilter || agentFilter || search) && (
            <Chip onClick={() => { setStatusFilter(null); setAgentFilter(null); setSearch(''); }}>Clear filters</Chip>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          Show
          <select
            value={visibleLimit} onChange={e => handleLimitChange(Number(e.target.value))}
            className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent)]"
          >
            {LIMIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
      </motion.div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title={search || statusFilter || agentFilter ? 'No matching prompts' : 'No prompts sent yet'}
          hint={search || statusFilter || agentFilter ? 'Try clearing filters.' : 'Prompts appear here after you send instructions to the AI.'}
        />
      ) : viewMode === 'grouped' && groupedEntries ? (
        <motion.div variants={listContainer} className="space-y-3">
          {groupedEntries.map(([sessionId, group]) => {
            const done = group.entries.filter(e => getStatus(e) === 'completed').length;
            return (
              <motion.div key={sessionId} variants={riseItem} layout className="overflow-hidden rounded-xl bg-zinc-800/20 ring-1 ring-zinc-700/40">
                <button
                  type="button" onClick={() => onNavigateToSession?.(sessionId)}
                  className="group flex w-full items-center gap-2 border-b border-zinc-700/40 bg-zinc-800/40 px-3 py-2 text-left transition-colors hover:bg-zinc-800/70 focus-visible:outline-none"
                >
                  <Terminal className="h-3.5 w-3.5 flex-shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-zinc-200">{group.topic}</span>
                  <div className="w-24 flex-shrink-0"><ProgressBar value={done} total={group.entries.length} /></div>
                  <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                <div className="space-y-1 p-1.5">
                  {group.entries.map(entry => (
                    <Row
                      key={entry.id} entry={entry} nested
                      isExpanded={expanded.has(entry.id)}
                      status={getStatus(entry)}
                      isDeleting={deleting.has(entry.id)}
                      agentColor={AGENT_COLORS[entry.agent || ''] || AGENT_FALLBACK}
                      onToggleExpand={() => toggleExpand(entry.id)}
                      onDelete={(e) => handleDelete(entry, e)}
                      onNavigateToSession={onNavigateToSession}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div variants={listContainer} className="space-y-2">
          {visibleEntries.map(entry => (
            <Row
              key={entry.id} entry={entry}
              isExpanded={expanded.has(entry.id)}
              status={getStatus(entry)}
              isDeleting={deleting.has(entry.id)}
              agentColor={AGENT_COLORS[entry.agent || ''] || AGENT_FALLBACK}
              onToggleExpand={() => toggleExpand(entry.id)}
              onDelete={(e) => handleDelete(entry, e)}
              onNavigateToSession={onNavigateToSession}
            />
          ))}
        </motion.div>
      )}

      {/* Show older */}
      {!showOlder && olderCount > 0 && (
        <motion.button
          variants={riseItem} whileTap={PRESS} type="button" onClick={() => setShowOlder(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-800/30 py-2.5 text-[11px] text-zinc-400 ring-1 ring-zinc-700/40 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:outline-none"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
          Show {olderCount} older prompt{olderCount !== 1 ? 's' : ''}
        </motion.button>
      )}
    </motion.div>
  );
};

export default PromptHistoryTab;
