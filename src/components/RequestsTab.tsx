import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Link2, AlertTriangle, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { listContainer, riseItem } from './workspace/_ds/motion';
import { EmptyState, Skeleton } from './workspace/_ds/primitives';
import { INPUT_CLS, BTN_PRIMARY, BTN_GHOST, filterChipCls, accentVars, Pill, ModalShell, dotStyle } from './workspace/_ds/controls';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';

interface Request {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  linked_problems: string[];
  created_at: string;
  updated_at: string;
}

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

// Legacy export kept for compatibility (color + label).
const REQUEST_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'Pending': { color: 'bg-amber-500', label: 'Pending' },
  'In Progress': { color: 'bg-cyan-500', label: 'In Progress' },
  'Completed': { color: 'bg-emerald-500', label: 'Completed' },
  'Cancelled': { color: 'bg-zinc-500', label: 'Cancelled' }
};

// Unified pill styling for the request status enum.
const REQUEST_STATUS_META: Record<string, { label: string; pill: string; dot: string }> = {
  'Pending':     { label: 'Pending',     pill: 'text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30',    dot: '#f59e0b' },
  'In Progress': { label: 'In Progress', pill: 'text-cyan-300 bg-cyan-500/15 ring-1 ring-cyan-400/40',       dot: '#22d3ee' },
  'Completed':   { label: 'Completed',   pill: 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30', dot: '#34d399' },
  'Cancelled':   { label: 'Cancelled',   pill: 'text-zinc-400 bg-zinc-500/15 ring-1 ring-zinc-500/30',       dot: '#a1a1aa' },
};
const reqMeta = (s: string) => REQUEST_STATUS_META[s] ?? REQUEST_STATUS_META['Pending'];

const PRIORITY_RAIL: Record<string, string> = {
  critical: 'before:bg-red-500',
  high: 'before:bg-orange-500',
  medium: 'before:bg-amber-500',
  low: 'before:bg-zinc-600',
};

const ACCENT = '#34d399';

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Completed', label: 'Completed' },
];

const RequestsTab: React.FC<{ projectId?: string; projectPath?: string; onNewRequest: () => void; projects?: { id: string; name: string; path: string }[]; onSelectProject?: (id: string) => void }> = ({ projectId, projectPath: propProjectPath, onNewRequest, projects, onSelectProject }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const result = await window.deskflowAPI?.getRequests?.(projectId);
      if (result?.success) {
        setRequests(result.data || []);
      }
    } catch (e) {
      console.error('[RequestsTab] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 5000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const filteredRequests = requests.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const groupedRequests = filteredRequests.reduce((acc, r) => {
    const status = r.status || 'Pending';
    if (!acc[status]) acc[status] = [];
    acc[status].push(r);
    return acc;
  }, {} as Record<string, Request[]>);

  const handleStatusChange = async (requestId: string, status: string) => {
    await window.deskflowAPI?.updateRequestStatus?.({ requestId, status });
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
    setSelectedRequest(prev => prev?.id === requestId ? { ...prev, status } : prev);
    loadRequests();
  };

  const resolvedProject = projects?.find(p => p.id === projectId);
  const displayPath = propProjectPath || resolvedProject?.path || '';

  return (
    <div className="flex flex-col h-full gap-3 p-3" style={accentVars(ACCENT)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)} className={filterChipCls(filterStatus === f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={onNewRequest} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* Project context */}
      {(displayPath || resolvedProject) ? (
        <div className="rounded-lg bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 px-3 py-2">
          <div className="text-[11px] text-zinc-300 truncate font-medium" title={displayPath}>{resolvedProject?.name || 'Project'}</div>
          <div className="text-[10px] text-zinc-600 truncate mt-0.5">agent/REQUESTS.md</div>
        </div>
      ) : (
        <div className="rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/25 px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> No project selected
          </div>
          <select value="" onChange={(e) => { if (e.target.value) onSelectProject?.(e.target.value); }} className={INPUT_CLS}>
            <option value="">— Choose project —</option>
            {projects?.filter(p => p.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : !projectId ? (
        <EmptyState icon={<Inbox className="w-5 h-5" />} title="Select a project" hint="Choose a project to view its requests." />
      ) : filteredRequests.length === 0 ? (
        <EmptyState icon={<Inbox className="w-5 h-5" />} title="No requests found" hint="Requests parsed from agent/REQUESTS.md appear here." />
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="show" className="flex-1 overflow-y-auto space-y-4 pr-0.5">
          {(Object.entries(groupedRequests) as [string, Request[]][]).map(([status, statusRequests]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <Pill label={reqMeta(status).label} cls={reqMeta(status).pill} dot={reqMeta(status).dot} compact />
                <span className="text-[11px] text-zinc-600">{statusRequests.length}</span>
              </div>
              <div className="space-y-2">
                {statusRequests.map((request) => (
                  <motion.button
                    key={request.id}
                    variants={riseItem}
                    onClick={() => setSelectedRequest(request)}
                    className={`group relative w-full text-left rounded-xl bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 hover:ring-zinc-700 hover:bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] transition-all duration-200 p-3 pl-4 overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${PRIORITY_RAIL[request.priority] || 'before:bg-zinc-600'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-zinc-500">#{request.id}</span>
                      <span className="text-[10px] text-zinc-500 capitalize">{request.priority}</span>
                    </div>
                    <div className="text-sm text-zinc-100 mt-1 line-clamp-2 leading-snug">{request.title}</div>
                    {request.linked_problems.length > 0 && (
                      <div className="inline-flex items-center gap-1 text-[10px] text-[color:var(--page-accent)] mt-1.5">
                        <Link2 className="w-3 h-3" /> {request.linked_problems.map(p => `#${p}`).join(', ')}
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
        {selectedRequest && (
          <RequestDetailModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onStatusChange={handleStatusChange}
            projectId={projectId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const RequestDetailModal: React.FC<{
  request: Request;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  projectId?: string;
}> = ({ request, onClose, onStatusChange, projectId }) => {
  const [linkProblemId, setLinkProblemId] = useState('');
  const [allProblems, setAllProblems] = useState<Problem[]>([]);

  useEffect(() => {
    window.deskflowAPI?.getProblems?.(projectId).then((result: any) => {
      if (result?.success) setAllProblems(result.data || []);
    });
  }, [projectId]);

  const handleLinkProblem = async () => {
    if (!linkProblemId) return;
    await window.deskflowAPI?.linkProblemToRequest?.({ requestId: request.id, problemId: linkProblemId, projectId });
    setLinkProblemId('');
  };

  return (
    <ModalShell
      onClose={onClose}
      accent={ACCENT}
      title={
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-500">#{request.id}</span>
          <Pill label={reqMeta(request.status).label} cls={reqMeta(request.status).pill} dot={reqMeta(request.status).dot} compact />
        </div>
      }
    >
      <p className="text-[15px] text-zinc-100 mb-4 leading-snug">{request.title}</p>

      {request.description && (
        <div className="mb-4">
          <div className="text-[11px] font-medium text-zinc-500 mb-1">Description</div>
          <div className="text-[13px] text-zinc-300 bg-zinc-950 light:bg-[var(--ws-surface)]/60 ring-1 ring-zinc-800/60 p-2.5 rounded-lg">{request.description}</div>
        </div>
      )}

      <div className="mb-4">
        <div className="text-[11px] font-medium text-zinc-500 mb-2">Status</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(REQUEST_STATUS_META).map((status) => {
            const active = request.status === status;
            const m = reqMeta(status);
            return (
              <button
                key={status}
                onClick={() => onStatusChange(request.id, status)}
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

      <div className="mb-4">
        <div className="text-[11px] font-medium text-zinc-500 mb-2">Linked problems</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {request.linked_problems.length === 0 ? (
            <span className="text-[11px] text-zinc-600">No linked problems</span>
          ) : request.linked_problems.map(pid => (
            <span key={pid} className="px-1.5 py-0.5 bg-[color-mix(in_srgb,var(--page-accent)_16%,transparent)] text-[color:var(--page-accent)] text-[10px] rounded-md ring-1 ring-[color-mix(in_srgb,var(--page-accent)_30%,transparent)]">#{pid}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={linkProblemId} onChange={(e) => setLinkProblemId(e.target.value)} className={INPUT_CLS}>
            <option value="">Link a problem…</option>
            {allProblems.filter(p => !request.linked_problems.includes(p.id)).map(p => (
              <option key={p.id} value={p.id}>#{p.id} - {p.title}</option>
            ))}
          </select>
          <button onClick={handleLinkProblem} disabled={!linkProblemId} className={`${BTN_PRIMARY} min-w-[64px]`}>
            <Link2 className="w-3.5 h-3.5" /> Link
          </button>
        </div>
      </div>

      <div className="text-[11px] text-zinc-500 border-t border-zinc-800 pt-3 mt-4 space-y-0.5">
        <div>Priority: <span className="capitalize text-zinc-400">{request.priority}</span></div>
        <div>Category: <span className="text-zinc-400">{request.category || '—'}</span></div>
        <div>Created: <span className="text-zinc-400">{formatDate(request.created_at)}</span></div>
      </div>
    </ModalShell>
  );
};

const NewRequestDialog: React.FC<{
  projectId?: string;
  onClose: () => void;
  onCreate: () => void;
}> = ({ projectId, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const result = await window.deskflowAPI?.createRequest?.({ title, description, priority, category: 'Feature', projectId });
    if (result?.success) onCreate();
  };

  return (
    <ModalShell onClose={onClose} accent={ACCENT} title={<h2 className="text-[15px] font-semibold text-zinc-100">New Request</h2>}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLS} placeholder="Brief description" autoFocus />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Description</label>
          <VoiceInputWrapper>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLS} rows={3} placeholder="What was requested?" />
          </VoiceInputWrapper>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={INPUT_CLS}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-6">
        <button onClick={onClose} className={`${BTN_GHOST} flex-1 py-2`}>Cancel</button>
        <button onClick={handleSubmit} className={`${BTN_PRIMARY} flex-1 py-2`}>Create</button>
      </div>
    </ModalShell>
  );
};

export { Request, Problem, REQUEST_STATUS_CONFIG, RequestsTab, RequestDetailModal, NewRequestDialog };
