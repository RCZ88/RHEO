import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Send, Terminal as TerminalIcon, Link2, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { listContainer, riseItem, DUR, EASE_OUT } from './workspace/_ds/motion';
import { EmptyState, Skeleton, IconButton } from './workspace/_ds/primitives';
import { sanitizeMojibake } from '../lib/sanitize';

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

// ---- Unified status model (matches the DeskFlow relay status enum) ----------
const STATUS_META: Record<string, { label: string; pill: string; dot: string }> = {
  'NEW':               { label: 'New',           pill: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30',        dot: '#f87171' },
  'Not Started':       { label: 'Not Started',   pill: 'text-zinc-400 bg-zinc-500/15 ring-1 ring-zinc-500/30',     dot: '#a1a1aa' },
  'In Progress':       { label: 'In Progress',   pill: 'text-cyan-300 bg-cyan-500/15 ring-1 ring-cyan-400/40',     dot: '#22d3ee' },
  'AI Attempted Fix':  { label: 'AI Attempted',  pill: 'text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30',  dot: '#f59e0b' },
  'User Testing':      { label: 'User Testing',  pill: 'text-violet-300 bg-violet-500/15 ring-1 ring-violet-500/30', dot: '#a78bfa' },
  'Fixed':             { label: 'Fixed',         pill: 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30', dot: '#34d399' },
  'Irrelevant':        { label: 'Irrelevant',    pill: 'text-zinc-500 bg-zinc-600/10 ring-1 ring-zinc-600/30',     dot: '#71717a' },
};
const statusMeta = (s: string) => STATUS_META[s] ?? STATUS_META['NEW'];

const PRIORITY_RAIL: Record<string, string> = {
  critical: 'before:bg-red-500',
  high: 'before:bg-orange-500',
  medium: 'before:bg-amber-500',
  low: 'before:bg-zinc-600',
};

// ---- Shared control styles (one design language) ---------------------------
const INPUT_CLS =
  'w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[color:var(--page-accent)]/40 focus:border-[color:var(--page-accent)]/40 transition-colors';
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-[color:var(--page-accent)] hover:brightness-110 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none';
const BTN_GHOST =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition active:scale-95';

const ACCENT_STYLE = { ['--page-accent' as string]: '#34d399' } as React.CSSProperties;

// Inline-style / motion helpers (module-level to avoid JSX object literals).
const dotStyle = (c: string): React.CSSProperties => ({ background: c });
const MODAL_OVERLAY = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: DUR.fast } };
const MODAL_PANEL = { initial: { opacity: 0, y: 12, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 8, scale: 0.98 }, transition: { duration: DUR.normal, ease: EASE_OUT } };

const StatusPill: React.FC<{ status: string; compact?: boolean }> = ({ status, compact }) => {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${m.pill} ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(m.dot)} />
      {m.label}
    </span>
  );
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'NEW', label: 'New' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Fixed', label: 'Fixed' },
];

const ProblemsTab: React.FC<{
  projectId?: string;
  projectPath?: string;
  projects?: { id: string; name: string; path: string }[];
  onSelectProject?: (id: string) => void;
  sessions?: { id: string; status: string }[];
}> = ({ projectId, projectPath: propProjectPath, projects, onSelectProject, sessions = [] }) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  const resolvedProject = projects?.find(p => p.id === projectId);
  const computedProjectPath = resolvedProject?.path || propProjectPath || '';

  const loadProblems = useCallback(async () => {
    try {
      const result = await window.deskflowAPI?.getProblems?.(projectId, computedProjectPath);
      if (result?.success) {
        setProblems(result.data || []);
      }
    } catch (e) {
      console.error('[ProblemsTab] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId, computedProjectPath]);

  useEffect(() => {
    loadProblems();
    const interval = setInterval(loadProblems, 5000);
    return () => clearInterval(interval);
  }, [loadProblems]);

  // Auto-compaction: check active sessions every 60s
  useEffect(() => {
    if (!window.deskflowAPI?.checkSessionCompaction) return;
    const check = async () => {
      for (const session of sessions) {
        if (session.status !== 'active') continue;
        try {
          const result = await window.deskflowAPI.checkSessionCompaction({
            sessionId: session.id,
            messageThreshold: 500,
          });
          if (result?.needsCompaction) {
            const compactResult = await window.deskflowAPI.compactSession?.({ sessionId: session.id });
            if (compactResult?.success) {
              console.log('[SessionCompaction] Compacted', session.id, '->', compactResult.newSessionId);
            }
          }
        } catch (err) {
          console.error('[SessionCompaction] Error checking session', session.id, err);
        }
      }
    };
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [sessions]);

  const filteredProblems = problems.filter(p => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return ['NEW', 'In Progress', 'AI Attempted Fix', 'User Testing'].includes(p.status);
    return p.status === filterStatus;
  });

  const groupedProblems = filteredProblems.reduce((acc, p) => {
    const status = p.status || 'NEW';
    if (!acc[status]) acc[status] = [];
    acc[status].push(p);
    return acc;
  }, {} as Record<string, Problem[]>);

  const handleStatusChange = async (problemId: string, status: string) => {
    await window.deskflowAPI?.updateProblemStatus?.({ problemId, status, projectId });
    setProblems(prev => prev.map(p => p.id === problemId ? { ...p, status } : p));
    setSelectedProblem(prev => prev?.id === problemId ? { ...prev, status } : prev);
    loadProblems();
  };

  return (
    <div className="flex flex-col h-full gap-3 p-3" style={ACCENT_STYLE}>
      {/* Toolbar: filter chips + new */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(f => {
            const active = filterStatus === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`inline-flex items-center rounded-full text-[11px] font-medium px-2.5 min-h-[26px] transition-colors active:scale-95 ${
                  active
                    ? 'text-[color:var(--page-accent)] bg-[color-mix(in_srgb,var(--page-accent)_16%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--page-accent)_38%,transparent)]'
                    : 'text-zinc-400 bg-zinc-800/70 ring-1 ring-zinc-700/50 hover:text-zinc-200 hover:bg-zinc-700/60'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowNewDialog(true)} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* Project context strip */}
      {computedProjectPath ? (
        <div className="rounded-lg bg-zinc-900/50 ring-1 ring-zinc-800/60 px-3 py-2">
          <div className="text-[11px] text-zinc-300 truncate font-medium" title={computedProjectPath}>
            {resolvedProject?.name || 'Project'}
          </div>
          <div className="text-[10px] text-zinc-500 truncate mt-0.5 font-mono">
            {computedProjectPath}
          </div>
          <div className="text-[10px] text-zinc-600 truncate mt-0.5">
            agent/PROBLEMS.md · {problems.length} issues parsed
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/25 px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> No project selected
          </div>
          <select
            value=""
            onChange={(e) => { if (e.target.value) onSelectProject?.(e.target.value); }}
            className={INPUT_CLS}
          >
            <option value="">— Choose project —</option>
            {projects?.filter(p => p.id).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filteredProblems.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="w-5 h-5" />} title="No problems found" hint="Parsed issues from agent/PROBLEMS.md will appear here." />
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="show" className="flex-1 overflow-y-auto space-y-4 pr-0.5">
          {(Object.entries(groupedProblems) as [string, Problem[]][]).map(([status, statusProblems]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <StatusPill status={status} compact />
                <span className="text-[11px] text-zinc-600">{statusProblems.length}</span>
              </div>
              <div className="space-y-2">
                {statusProblems.map((problem) => (
                  <motion.button
                    key={problem.id}
                    variants={riseItem}
                    onClick={() => setSelectedProblem(problem)}
                    className={`group relative w-full text-left rounded-xl bg-zinc-900/60 ring-1 ring-zinc-800/60 hover:ring-zinc-700 hover:bg-zinc-900/80 transition-all duration-200 p-3 pl-4 overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${PRIORITY_RAIL[problem.priority] || 'before:bg-zinc-600'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-zinc-500">{problem.id}</span>
                      <span className="text-[10px] text-zinc-500 capitalize">{problem.priority}</span>
                    </div>
                    <div className="text-sm text-zinc-100 mt-1 line-clamp-2 leading-snug">{sanitizeMojibake(problem.title)}</div>
                    {problem.terminal_id && (
                      <div className="inline-flex items-center gap-1 text-[10px] text-[color:var(--page-accent)] mt-1.5">
                        <TerminalIcon className="w-3 h-3" /> {problem.terminal_id}
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedProblem && (
          <ProblemDetailModal
            problem={selectedProblem}
            onClose={() => setSelectedProblem(null)}
            onStatusChange={handleStatusChange}
          />
        )}
        {showNewDialog && (
          <NewProblemDialog
            onClose={() => setShowNewDialog(false)}
            onCreate={() => { setShowNewDialog(false); loadProblems(); }}
            projectId={projectId}
            projectPath={computedProjectPath}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ---- Modal shell (one consistent overlay) ----------------------------------
const ModalShell: React.FC<{ onClose: () => void; children: React.ReactNode; title: React.ReactNode; accent?: string }> = ({ onClose, children, title, accent = '#34d399' }) => (
  <motion.div
    {...MODAL_OVERLAY}
    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[var(--z-overlay)] p-4"
    style={{ ['--page-accent' as string]: accent } as React.CSSProperties}
    onClick={onClose}
  >
    <motion.div
      {...MODAL_PANEL}
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-md max-h-[82vh] overflow-y-auto rounded-xl bg-zinc-900/95 backdrop-blur-xl ring-1 ring-zinc-800 shadow-2xl shadow-black/50 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">{title}</div>
        <IconButton title="Close" onClick={onClose}><X className="w-4 h-4" /></IconButton>
      </div>
      {children}
    </motion.div>
  </motion.div>
);

const ProblemDetailModal: React.FC<{
  problem: Problem;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}> = ({ problem, onClose, onStatusChange }) => {
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendInstructions = async () => {
    if (!additionalInstructions.trim() || !problem.terminal_id || isSending) return;
    setIsSending(true);
    try {
      await window.deskflowAPI?.terminalWrite?.(problem.terminal_id, additionalInstructions + '\r\n');
      setAdditionalInstructions('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-500">{problem.id}</span>
          <StatusPill status={problem.status} compact />
        </div>
      }
    >
      <p className="text-[15px] text-zinc-100 mb-4 leading-snug">{sanitizeMojibake(problem.title)}</p>

      {/* Status selector */}
      <div className="mb-4">
        <div className="text-[11px] font-medium text-zinc-500 mb-2">Status</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(STATUS_META).map((status) => {
            const active = problem.status === status;
            const m = statusMeta(status);
            return (
              <button
                key={status}
                onClick={() => onStatusChange(problem.id, status)}
                className={`inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 transition active:scale-95 ${
                  active ? m.pill : 'text-zinc-400 bg-zinc-800/70 ring-1 ring-zinc-700/50 hover:text-zinc-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(m.dot)} />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Terminal action */}
      <button
        onClick={async () => {
          if (problem.terminal_id) {
            window.dispatchEvent(new CustomEvent('focus-terminal', { detail: { terminalId: problem.terminal_id } }));
            onClose();
          } else {
            const result = await window.deskflowAPI?.assignProblemToTerminal?.({ problemId: problem.id });
            if (result?.success) {
              window.dispatchEvent(new CustomEvent('create-terminal-for-problem', {
                detail: { terminalId: result.data.terminalId, prompt: result.data.prompt }
              }));
              onClose();
            }
          }
        }}
        className={`${BTN_PRIMARY} w-full py-2 mb-4`}
      >
        {problem.terminal_id ? <><TerminalIcon className="w-3.5 h-3.5" /> Open in Terminal</> : <><Link2 className="w-3.5 h-3.5" /> Assign to Terminal</>}
      </button>

      {/* Send instructions */}
      {problem.terminal_id && (
        <div className="mb-4">
          <div className="text-[11px] font-medium text-zinc-500 mb-2">Send instructions to terminal</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="Type instructions…"
              className={INPUT_CLS}
              onKeyDown={(e) => e.key === 'Enter' && handleSendInstructions()}
            />
            <button onClick={handleSendInstructions} disabled={isSending} className={`${BTN_PRIMARY} min-w-[64px]`}>
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send</>}
            </button>
          </div>
        </div>
      )}

      {problem.user_notes && (
        <div className="mb-4">
          <div className="text-[11px] font-medium text-zinc-500 mb-1">Notes</div>
          <div className="text-[13px] text-zinc-300 bg-zinc-950/60 ring-1 ring-zinc-800/60 p-2.5 rounded-lg">{problem.user_notes}</div>
        </div>
      )}

      <div className="text-[11px] text-zinc-500 border-t border-zinc-800 pt-3 mt-4 space-y-0.5">
        <div>Priority: <span className="capitalize text-zinc-400">{problem.priority}</span></div>
        <div>Category: <span className="text-zinc-400">{problem.category || '—'}</span></div>
        <div>Created: <span className="text-zinc-400">{formatDate(problem.created_at)}</span></div>
      </div>
    </ModalShell>
  );
};

const NewProblemDialog: React.FC<{
  onClose: () => void;
  onCreate: () => void;
  projectId?: string;
  projectPath?: string;
}> = ({ onClose, onCreate, projectId, projectPath }) => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skills, setSkills] = useState<{ id: string; name: string; description: string }[]>([]);

  useEffect(() => {
    window.deskflowAPI?.getSkills?.().then(result => {
      if (result?.success) setSkills(result.data || []);
    });
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const result = await window.deskflowAPI?.createProblem?.({
      title,
      priority,
      category,
      skill_id: selectedSkill || undefined,
      projectId,
      projectPath
    });
    if (result?.success) onCreate();
  };

  return (
    <ModalShell onClose={onClose} title={<h2 className="text-[15px] font-semibold text-zinc-100">New Problem</h2>}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT_CLS}
            placeholder="Brief description"
            autoFocus
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={INPUT_CLS}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT_CLS}>
              <option value="">Select…</option>
              <option value="terminal">Terminal</option>
              <option value="dashboard">Dashboard</option>
              <option value="external">External</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        {skills.length > 0 && (
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-2">Skill (optional)</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-0.5">
              <button
                onClick={() => setSelectedSkill('')}
                className={`p-2 rounded-lg text-xs text-left ring-1 transition-colors ${
                  selectedSkill === '' ? 'bg-zinc-700/60 ring-zinc-600 text-zinc-100' : 'bg-zinc-800/60 ring-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50'
                }`}
              >
                <div className="font-medium">No skill</div>
              </button>
              {skills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill.id)}
                  className={`p-2 rounded-lg text-xs text-left ring-1 transition-colors ${
                    selectedSkill === skill.id
                      ? 'bg-[color-mix(in_srgb,var(--page-accent)_16%,transparent)] ring-[color-mix(in_srgb,var(--page-accent)_40%,transparent)] text-zinc-100'
                      : 'bg-zinc-800/60 ring-zinc-700/50 text-zinc-300 hover:bg-zinc-700/50'
                  }`}
                >
                  <div className="font-medium truncate">{skill.name}</div>
                  {skill.description && (
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">{skill.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-6">
        <button onClick={onClose} className={`${BTN_GHOST} flex-1 py-2`}>Cancel</button>
        <button onClick={handleSubmit} className={`${BTN_PRIMARY} flex-1 py-2`}>Create</button>
      </div>
    </ModalShell>
  );
};

export { ProblemsTab, ProblemDetailModal, NewProblemDialog };
export type { Problem };
