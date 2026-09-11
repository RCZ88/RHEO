import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle, FileText, CheckCircle2, Plus, Terminal, Clock,
  ArrowUp, ArrowDown, X, ExternalLink, Send, Link,
  Bug, Lightbulb, ListChecks, RefreshCw, ChevronDown, ChevronRight, Eye, EyeOff
} from 'lucide-react';
import CheckFeedbackControls from './CheckFeedbackControls';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import { sortAndGroupChecks, DEFAULT_CHECKLIST_CONFIG, ChecklistConfig } from '../lib/checklistAlgorithm';
import { resolveSessionForCheck } from '../lib/sessionResolution';
import { sanitizeMojibake } from '../lib/sanitize';

interface Problem {
  id: string; title: string; status: string; priority: string; category: string;
  terminal_id: string | null; skill_used: string | null; user_notes: string | null;
  fix_description: string | null; files: string[]; created_at: string; updated_at: string;
}

interface Request {
  id: string; title: string; description: string; status: string; priority: string;
  category: string; linked_problems: string[]; created_at: string; updated_at: string;
}

interface IssueWorkspaceProps {
  projectId?: string; projectPath?: string;
  projects?: { id: string; name: string; path: string }[];
  onSelectProject?: (id: string) => void;
  activeTerminalId?: string | null;
  sessions?: Array<{ id: string; terminal_id: string | null; status: string }>;
}

type SubTab = 'problems' | 'requests' | 'checklists';

const PROBLEM_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'NEW': { color: 'bg-red-500', label: 'New' },
  'Not Started': { color: 'bg-zinc-500', label: 'Not Started' },
  'In Progress': { color: 'bg-blue-500', label: 'In Progress' },
  'AI Attempted Fix': { color: 'bg-amber-500', label: 'AI Attempted' },
  'User Testing': { color: 'bg-purple-500', label: 'User Testing' },
  'Fixed': { color: 'bg-emerald-500', label: 'Fixed' },
  'Irrelevant': { color: 'bg-zinc-400', label: 'Irrelevant' },
};

const REQUEST_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'Pending': { color: 'bg-amber-500', label: 'Pending' },
  'In Progress': { color: 'bg-blue-500', label: 'In Progress' },
  'Completed': { color: 'bg-emerald-500', label: 'Completed' },
  'Cancelled': { color: 'bg-zinc-500', label: 'Cancelled' },
};

const PRIORITY_CONFIG: Record<string, { color: string; border: string; icon: typeof ArrowUp }> = {
  critical: { color: 'text-red-400', border: 'border-l-red-500', icon: ArrowUp },
  high: { color: 'text-orange-400', border: 'border-l-orange-500', icon: ArrowUp },
  medium: { color: 'text-yellow-400', border: 'border-l-yellow-500', icon: ArrowDown },
  low: { color: 'text-zinc-500', border: 'border-l-zinc-600', icon: ArrowDown },
};

const SUB_TABS: { key: SubTab; label: string; icon: typeof Bug; color: string }[] = [
  { key: 'problems', label: 'Problems', icon: Bug, color: 'text-purple-400' },
  { key: 'requests', label: 'Requests', icon: Lightbulb, color: 'text-blue-400' },
  { key: 'checklists', label: 'Checklist', icon: ListChecks, color: 'text-emerald-400' },
];

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusPill({ status, config }: { status: string; config: Record<string, { color: string; label: string }> }) {
  const c = config[status] || { color: 'bg-zinc-500', label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${c.color}/10 text-${c.color.replace('bg-', '')} border border-${c.color.replace('bg-', '')}/20`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
      {c.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_CONFIG[priority] || { color: 'text-zinc-500', border: 'border-l-zinc-600', icon: ArrowDown };
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${p.color}`}>
      <p.icon className="w-2.5 h-2.5" />
      {priority}
    </span>
  );
}

export default function IssuesWorkspace({ projectId, projectPath, projects, onSelectProject, activeTerminalId, sessions = [] }: IssueWorkspaceProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('problems');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [hideFinished, setHideFinished] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showNewProblem, setShowNewProblem] = useState(false);
  const [showNewRequest, setShowNewRequest] = useState(false);

  const loadProblems = useCallback(async () => {
    try {
      const r = await window.deskflowAPI?.getProblems?.(projectId, projectPath);
      if (r?.success) setProblems(r.data || []);
    } catch (e) { console.error('[IssuesWorkspace] loadProblems', e); }
    finally { setProblemsLoading(false); }
  }, [projectId, projectPath]);

  const loadRequests = useCallback(async () => {
    try {
      const r = await window.deskflowAPI?.getRequests?.(projectId);
      if (r?.success) setRequests(r.data || []);
    } catch (e) { console.error('[IssuesWorkspace] loadRequests', e); }
    finally { setRequestsLoading(false); }
  }, [projectId]);

  useEffect(() => { loadProblems(); const i = setInterval(loadProblems, 5000); return () => clearInterval(i); }, [loadProblems]);
  useEffect(() => { loadRequests(); const i = setInterval(loadRequests, 5000); return () => clearInterval(i); }, [loadRequests]);

  const filteredProblems = problems.filter(p => {
    // Hide finished problems if toggle is on
    if (hideFinished && ['Fixed', 'Irrelevant'].includes(p.status)) return false;
    
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return ['NEW', 'Not Started', 'In Progress', 'AI Attempted Fix', 'User Testing'].includes(p.status);
    return p.status === filterStatus;
  });

  const filteredRequests = requests.filter(r => {
    // Hide finished requests if toggle is on
    if (hideFinished && ['Completed', 'Cancelled'].includes(r.status)) return false;
    
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const handleProblemStatus = async (id: string, status: string) => {
    await window.deskflowAPI?.updateProblemStatus?.({ problemId: id, status, projectId });
    loadProblems();
  };

  const handleRequestStatus = async (id: string, status: string) => {
    await window.deskflowAPI?.updateRequestStatus?.({ requestId: id, status });
    loadRequests();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-1 py-1.5 bg-zinc-900/60 border border-zinc-800/50 rounded-lg mb-3">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
              activeSubTab === tab.key
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${activeSubTab === tab.key ? tab.color : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar — only for problems/requests */}
      {activeSubTab !== 'checklists' && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-600"
            >
              <option value="all">All Items</option>
              <option value="active">Active</option>
              {Object.entries(activeSubTab === 'problems' ? PROBLEM_STATUS_CONFIG : REQUEST_STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            
            <button
              onClick={() => setHideFinished(!hideFinished)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                hideFinished
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800'
              }`}
              title={hideFinished ? 'Showing active only' : 'Showing all including finished'}
            >
              {hideFinished ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              <span>{hideFinished ? 'Active' : 'All'}</span>
            </button>
          </div>
          <button
            onClick={() => activeSubTab === 'problems' ? setShowNewProblem(true) : setShowNewRequest(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-[10px] font-medium rounded-lg transition-all"
          >
            <Plus className="w-3 h-3" />
            New {activeSubTab === 'problems' ? 'Problem' : 'Request'}
          </button>
        </div>
      )}

      {/* Content */}
      {activeSubTab === 'problems' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {problemsLoading ? (
            <div className="flex items-center justify-center py-8 text-zinc-500">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              <span className="text-[11px]">Loading...</span>
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
              <Bug className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-[11px]">No problems found</p>
            </div>
          ) : filteredProblems.map(p => (
            <ProblemCard key={p.id} problem={p} onClick={() => setSelectedProblem(p)} />
          ))}
        </div>
      )}

      {activeSubTab === 'requests' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-8 text-zinc-500">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              <span className="text-[11px]">Loading...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
              <Lightbulb className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-[11px]">No requests found</p>
            </div>
          ) : filteredRequests.map(r => (
            <RequestCard key={r.id} request={r} onClick={() => setSelectedRequest(r)} />
          ))}
        </div>
      )}

      {activeSubTab === 'checklists' && (
        <CombinedChecklist
          problems={problems}
          requests={requests}
          activeTerminalId={activeTerminalId ?? null}
          sessions={sessions}
        />
      )}

      {/* Problem Detail Modal */}
      {selectedProblem && (
        <ProblemDetailModal
          problem={selectedProblem}
          onClose={() => setSelectedProblem(null)}
          onStatusChange={handleProblemStatus}
          projectId={projectId}
        />
      )}

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onStatusChange={handleRequestStatus}
          projectId={projectId}
        />
      )}

      {/* New Problem Dialog */}
      {showNewProblem && (
        <NewProblemDialog
          onClose={() => setShowNewProblem(false)}
          onCreate={() => { setShowNewProblem(false); loadProblems(); }}
          projectId={projectId}
          projectPath={projectPath}
        />
      )}

      {/* New Request Dialog */}
      {showNewRequest && (
        <NewRequestDialog
          onClose={() => setShowNewRequest(false)}
          onCreate={() => { setShowNewRequest(false); loadRequests(); }}
          projectId={projectId}
        />
      )}
    </div>
  );
}

// ── Problem Card ──

function ProblemCard({ problem, onClick }: { problem: Problem; onClick: () => void }) {
  const priority = PRIORITY_CONFIG[problem.priority] || PRIORITY_CONFIG.medium;
  return (
    <div
      onClick={onClick}
      className={`bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-3
        hover:border-zinc-700/50 hover:bg-zinc-900/60 transition-all cursor-pointer
        border-l-2 ${priority.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusPill status={problem.status} config={PROBLEM_STATUS_CONFIG} />
            <PriorityBadge priority={problem.priority} />
            <span className="text-[9px] font-mono text-zinc-600">{problem.id}</span>
          </div>
          <p className="text-sm text-zinc-200 font-medium leading-snug line-clamp-2">{sanitizeMojibake(problem.title)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {formatRelative(problem.created_at)}
        </span>
        {problem.terminal_id && (
          <span className="flex items-center gap-1 text-purple-400/70">
            <Terminal className="w-2.5 h-2.5" />
            {problem.terminal_id.slice(0, 8)}
          </span>
        )}
        {problem.files.length > 0 && (
          <span className="flex items-center gap-1 text-zinc-600">
            <FileText className="w-2.5 h-2.5" />
            {problem.files.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Request Card ──

function RequestCard({ request, onClick }: { request: Request; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-3
        hover:border-zinc-700/50 hover:bg-zinc-900/60 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusPill status={request.status} config={REQUEST_STATUS_CONFIG} />
            <PriorityBadge priority={request.priority} />
            <span className="text-[9px] font-mono text-zinc-600">#{request.id}</span>
          </div>
          <p className="text-sm text-zinc-200 font-medium leading-snug line-clamp-2">{sanitizeMojibake(request.title)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {formatRelative(request.created_at)}
        </span>
        {request.linked_problems.length > 0 && (
          <span className="flex items-center gap-1 text-blue-400/70">
            <Link className="w-2.5 h-2.5" />
            {request.linked_problems.length} linked
          </span>
        )}
      </div>
    </div>
  );
}

// ── Problem Detail Modal ──

function ProblemDetailModal({
  problem, onClose, onStatusChange, projectId
}: {
  problem: Problem; onClose: () => void; onStatusChange: (id: string, status: string) => void; projectId?: string;
}) {
  const [instructions, setInstructions] = useState('');
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState(problem.user_notes || '');

  const handleSend = async () => {
    if (!instructions.trim() || !problem.terminal_id || sending) return;
    setSending(true);
    try { await window.deskflowAPI?.terminalWrite?.(problem.terminal_id, instructions + '\n'); setInstructions(''); }
    finally { setSending(false); }
  };

  const handleSaveNotes = async () => {
    await window.deskflowAPI?.updateProblem?.({ id: problem.id, user_notes: notes, projectId });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Bug className="w-4.5 h-4.5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">{problem.id}</h2>
              <p className="text-sm text-zinc-300 mt-0.5">{sanitizeMojibake(problem.title)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
            <X className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>

        {/* Status Pills */}
        <div className="mb-4">
          <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PROBLEM_STATUS_CONFIG).map(([s, c]) => (
              <button
                key={s}
                onClick={() => onStatusChange(problem.id, s)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                  problem.status === s
                    ? `${c.color} text-white border-transparent shadow-sm`
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Actions */}
        <div className="mb-4">
          <button
            onClick={async () => {
              if (problem.terminal_id) {
                window.dispatchEvent(new CustomEvent('focus-terminal', { detail: { terminalId: problem.terminal_id } }));
                onClose();
              } else {
                const r = await window.deskflowAPI?.assignProblemToTerminal?.({ problemId: problem.id });
                if (r?.success) {
                  window.dispatchEvent(new CustomEvent('create-terminal-for-problem', {
                    detail: { terminalId: r.data.terminalId, prompt: r.data.prompt }
                  }));
                  onClose();
                }
              }
            }}
            className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 rounded-xl text-[11px] text-zinc-300 flex items-center justify-center gap-2 transition-all"
          >
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            {problem.terminal_id ? 'Open in Terminal' : 'Assign & Create Terminal'}
          </button>
        </div>

        {/* Send Instructions */}
        {problem.terminal_id && (
          <div className="mb-4">
            <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Send to Terminal</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type instruction..."
                className="flex-1 bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50"
              />
              <button
                onClick={handleSend}
                disabled={sending || !instructions.trim()}
                className="px-3 py-2 bg-pink-600 hover:bg-pink-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-[11px] flex items-center gap-1 transition-all"
              >
                {sending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-4">
          <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Notes</div>
          <VoiceInputWrapper>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              rows={2}
              placeholder="Add notes..."
              className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50 resize-none"
            />
          </VoiceInputWrapper>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-zinc-600 border-t border-zinc-800/50 pt-3 mt-2">
          <span>Category: <span className="text-zinc-400">{problem.category || '—'}</span></span>
          <span>Skill: <span className="text-zinc-400">{problem.skill_used || '—'}</span></span>
          <span>Created: <span className="text-zinc-400">{new Date(problem.created_at).toLocaleDateString()}</span></span>
          {problem.fix_description && (
            <span>Fix: <span className="text-zinc-400">{problem.fix_description}</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Request Detail Modal ──

function RequestDetailModal({
  request, onClose, onStatusChange, projectId
}: {
  request: Request; onClose: () => void; onStatusChange: (id: string, status: string) => void; projectId?: string;
}) {
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [linkId, setLinkId] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(request.description || '');

  useEffect(() => {
    window.deskflowAPI?.getProblems?.(projectId).then((r: any) => {
      if (r?.success) setAllProblems(r.data || []);
    });
  }, [projectId]);

  const handleLink = async () => {
    if (!linkId) return;
    await window.deskflowAPI?.linkProblemToRequest?.({ requestId: request.id, problemId: linkId, projectId });
    setLinkId('');
  };

  const handleSaveDesc = async () => {
    await window.deskflowAPI?.updateRequest?.({ id: request.id, description: desc });
    setEditingDesc(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Lightbulb className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">#{request.id}</h2>
              <p className="text-sm text-zinc-300 mt-0.5">{sanitizeMojibake(request.title)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
            <X className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>

        {/* Description */}
        <div className="mb-4">
          <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Description</div>
          {editingDesc ? (
            <div className="space-y-2">
              <VoiceInputWrapper>
                <textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-[11px] text-zinc-300 focus:outline-none focus:border-pink-500/50 resize-none"
                />
              </VoiceInputWrapper>
              <div className="flex gap-2">
                <button onClick={handleSaveDesc} className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-[10px] rounded-lg">Save</button>
                <button onClick={() => { setEditingDesc(false); setDesc(request.description || ''); }} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] rounded-lg">Cancel</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingDesc(true)}
              className="bg-zinc-950 border border-zinc-800/50 rounded-lg px-3 py-2 text-[11px] text-zinc-400 cursor-text hover:border-zinc-700/50 transition-colors min-h-[2.5rem]"
            >
              {request.description || 'No description — click to add...'}
            </div>
          )}
        </div>

        {/* Status Pills */}
        <div className="mb-4">
          <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(REQUEST_STATUS_CONFIG).map(([s, c]) => (
              <button
                key={s}
                onClick={() => onStatusChange(request.id, s)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                  request.status === s
                    ? `${c.color} text-white border-transparent shadow-sm`
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linked Problems */}
        <div className="mb-4">
          <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Linked Problems</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {request.linked_problems.length === 0 ? (
              <span className="text-[10px] text-zinc-600">None</span>
            ) : request.linked_problems.map(pid => (
              <span key={pid} className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] rounded-full border border-purple-500/20">
                #{pid}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={linkId}
              onChange={e => setLinkId(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-pink-500/50"
            >
              <option value="">Link a problem...</option>
              {allProblems.filter(p => !request.linked_problems.includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>#{p.id} — {sanitizeMojibake(p.title).slice(0, 40)}</option>
              ))}
            </select>
            <button onClick={handleLink} disabled={!linkId} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-[10px] rounded-lg transition-all active:scale-95">
              <Link className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-zinc-600 border-t border-zinc-800/50 pt-3 mt-2">
          <span>Category: <span className="text-zinc-400">{request.category || '—'}</span></span>
          <span>Created: <span className="text-zinc-400">{new Date(request.created_at).toLocaleDateString()}</span></span>
        </div>
      </div>
    </div>
  );
}

// ── New Problem Dialog ──

function NewProblemDialog({ onClose, onCreate, projectId, projectPath }: {
  onClose: () => void; onCreate: () => void; projectId?: string; projectPath?: string;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const r = await window.deskflowAPI?.createProblem?.({ title, priority, category: category || undefined, projectId, projectPath });
    if (r?.success) onCreate();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-zinc-100 mb-4">New Problem</h2>
        <div className="space-y-3">
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Brief description" autoFocus
            className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50"
          />
          <div className="flex gap-3">
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/50">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/50">
              <option value="">Category</option>
              <option value="terminal">Terminal</option>
              <option value="dashboard">Dashboard</option>
              <option value="external">External</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[11px] rounded-lg transition-all">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 px-3 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-[11px] rounded-lg transition-all">Create</button>
        </div>
      </div>
    </div>
  );
}

// ── New Request Dialog ──

function NewRequestDialog({ onClose, onCreate, projectId }: {
  onClose: () => void; onCreate: () => void; projectId?: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const r = await window.deskflowAPI?.createRequest?.({ title, description, priority, category: 'Feature', projectId });
    if (r?.success) onCreate();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-zinc-100 mb-4">New Request</h2>
        <div className="space-y-3">
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Brief description" autoFocus
            className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50"
          />
          <VoiceInputWrapper>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="What was requested?"
              className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pink-500/50 resize-none"
            />
          </VoiceInputWrapper>
          <select value={priority} onChange={e => setPriority(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/50">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[11px] rounded-lg transition-all">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 px-3 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-[11px] rounded-lg transition-all">Create</button>
        </div>
      </div>
    </div>
  );
}

// ── Combined Checklist (algorithmic view — grouped by parent, sortable, with feedback) ──

function CombinedChecklist({
  problems,
  requests,
  activeTerminalId,
  sessions,
}: {
  problems: any[];
  requests: any[];
  activeTerminalId: string | null;
  sessions: Array<{ id: string; terminal_id: string | null; status: string }>;
}) {
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('active');
  const [sortBy, setSortBy] = useState<'priority' | 'recent'>('priority');
  const [groupByParent, setGroupByParent] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [checklistConfig, setChecklistConfig] = useState<ChecklistConfig>(DEFAULT_CHECKLIST_CONFIG);
  const [showChecklistSettings, setShowChecklistSettings] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('checklist-config');
      if (saved) setChecklistConfig({ ...DEFAULT_CHECKLIST_CONFIG, ...JSON.parse(saved) });
    } catch {}
  }, []);

  const saveConfig = (updates: Partial<ChecklistConfig>) => {
    const newConfig = { ...checklistConfig, ...updates };
    setChecklistConfig(newConfig);
    localStorage.setItem('checklist-config', JSON.stringify(newConfig));
  };

  const result = useMemo(() =>
    sortAndGroupChecks(problems, requests, {
      ...checklistConfig,
      autoSortByPriority: sortBy === 'priority',
      groupByParent,
      defaultFilterMode: filterMode,
    }),
    [problems, requests, sortBy, groupByParent, filterMode, checklistConfig]
  );

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCheck = (id: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const priorityColor: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  };

  return (
    <div className="flex flex-col flex-1 space-y-3 min-h-0">
      {/* ── Config bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value as any)}
            className="text-[10px] bg-zinc-900/70 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>

          <div className="flex rounded border border-zinc-700/50 overflow-hidden">
            <button
              onClick={() => setSortBy('priority')}
              className={`text-[10px] px-2 py-0.5 ${sortBy === 'priority' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-zinc-900/70 text-zinc-500'}`}
            >
              Priority
            </button>
            <button
              onClick={() => setSortBy('recent')}
              className={`text-[10px] px-2 py-0.5 ${sortBy === 'recent' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-zinc-900/70 text-zinc-500'}`}
            >
              Recent
            </button>
          </div>

          <button
            onClick={() => setGroupByParent(!groupByParent)}
            className={`text-[10px] px-2 py-0.5 rounded border ${groupByParent ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' : 'bg-zinc-900/70 text-zinc-500 border-zinc-700/50'}`}
          >
            {groupByParent ? 'Grouped' : 'Flat'}
          </button>

          <button
            onClick={() => setShowChecklistSettings(!showChecklistSettings)}
            className={`text-[10px] px-2 py-0.5 rounded border ${showChecklistSettings ? 'bg-zinc-800 text-zinc-300 border-zinc-600/50' : 'bg-zinc-900/70 text-zinc-500 border-zinc-700/50'}`}
          >
            Settings
          </button>
        </div>

        <span className="text-[10px] text-zinc-500 font-mono">
          {result.completedCount}/{result.totalCount} done
        </span>
      </div>

      {/* ── Settings panel ── */}
      {showChecklistSettings && (
        <div className="bg-zinc-900/40 rounded-lg border border-zinc-800/50 p-3 space-y-2.5">
          <h4 className="text-[11px] font-semibold text-zinc-400">Checklist Settings</h4>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Auto-sort by priority</span>
            <button
              onClick={() => saveConfig({ autoSortByPriority: !checklistConfig.autoSortByPriority })}
              className={`relative w-7 h-4 rounded-full transition-colors ${checklistConfig.autoSortByPriority ? 'bg-cyan-500/30 border border-cyan-500/40' : 'bg-zinc-700 border border-zinc-600'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${checklistConfig.autoSortByPriority ? 'translate-x-3 bg-cyan-400' : 'translate-x-0.5 bg-zinc-400'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Group by parent</span>
            <button
              onClick={() => { setGroupByParent(!groupByParent); saveConfig({ groupByParent: !groupByParent }); }}
              className={`relative w-7 h-4 rounded-full transition-colors ${checklistConfig.groupByParent ? 'bg-cyan-500/30 border border-cyan-500/40' : 'bg-zinc-700 border border-zinc-600'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${checklistConfig.groupByParent ? 'translate-x-3 bg-cyan-400' : 'translate-x-0.5 bg-zinc-400'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Default filter</span>
            <select
              value={checklistConfig.defaultFilterMode}
              onChange={e => saveConfig({ defaultFilterMode: e.target.value as any })}
              className="text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-zinc-300"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Feedback mode</span>
            <select
              value={checklistConfig.feedbackMode}
              onChange={e => saveConfig({ feedbackMode: e.target.value as any })}
              className="text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-zinc-300"
            >
              <option value="simple">Simple</option>
              <option value="simple+text">Simple + Text</option>
              <option value="rich">Rich</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Max checks shown</span>
            <input
              type="number"
              value={checklistConfig.maxChecksShown}
              onChange={e => saveConfig({ maxChecksShown: parseInt(e.target.value) || 50 })}
              className="w-14 text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-zinc-300 text-center"
              min={10}
              max={200}
            />
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {result.groups.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <ListChecks className="w-6 h-6 text-zinc-700 mx-auto mb-2 shrink-0" />
          <p className="text-xs text-zinc-500">No checks yet</p>
          <p className="text-[10px] text-zinc-600 mt-1">
            AI can add them with <code className="text-zinc-400">[add-check]</code> actions
          </p>
        </div>
      )}

      {/* ── Groups ── */}
      {result.groups.map(group => {
        const isExpanded = expandedGroups.has(group.parentId);
        const typeColor = group.parentType === 'problem' ? 'bg-purple-500' : 'bg-blue-500';
        const typeLabel = group.parentType === 'problem' ? 'P' : 'R';

        return (
          <div
            key={group.parentId}
            className="bg-zinc-900/40 rounded-lg border border-zinc-800/50 overflow-hidden"
          >
            {/* Group header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/30 transition-colors"
              onClick={() => toggleGroup(group.parentId)}
            >
              <button className="shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-zinc-500" />
                )}
              </button>

              <div className={`w-2 h-2 rounded-full ${typeColor} shrink-0`} />

              <span className="text-xs text-zinc-200 truncate flex-1">
                {group.parentTitle}
              </span>

              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${priorityColor[group.parentPriority] || priorityColor.low}`}>
                {group.parentPriority}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/60 rounded-full transition-all duration-300"
                    style={{ width: `${group.progress.percent}%` }}
                  />
                </div>
                <span className="text-[9px] text-zinc-600 font-mono w-8 text-right">
                  {group.progress.done}/{group.progress.total}
                </span>
              </div>
            </div>

            {/* Checks list */}
            {isExpanded && (
              <div className="border-t border-zinc-800/30 px-3 py-2 space-y-1">
                {group.checks.map(check => {
                  const isCheckExpanded = expandedChecks.has(check.checkId);
                  const statusIcon = check.checkStatus === 'completed' ? '\u2713' :
                    check.checkStatus === 'in_progress' ? '\u25C9' : '\u25CB';
                  const statusColor = check.checkStatus === 'completed' ? 'text-emerald-400' :
                    check.checkStatus === 'in_progress' ? 'text-amber-400' : 'text-zinc-600';

                  const resolved = resolveSessionForCheck(
                    check,
                    { session_id: group.parentSessionId, terminal_id: group.parentTerminalId },
                    activeTerminalId,
                    sessions,
                  );

                  return (
                    <div
                      key={check.checkId}
                      className="rounded border border-zinc-800/30 bg-zinc-950/40"
                    >
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                        onClick={() => toggleCheck(check.checkId)}
                      >
                        <span className={`text-xs ${statusColor}`}>{statusIcon}</span>
                        <span className={`text-[11px] flex-1 ${check.checkStatus === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                          {sanitizeMojibake(check.description)}
                        </span>
                        <span className="text-[9px] text-zinc-700 font-mono">
                          {check.checkId.split('-').slice(-2).join('-')}
                        </span>
                      </div>

                      {isCheckExpanded && (
                        <div className="px-2.5 pb-2 pt-1 border-t border-zinc-800/20">
                          <p className="text-[10px] text-zinc-500 mb-2">
                            <span className="text-zinc-600">How to verify:</span> {check.instruction}
                          </p>

                          {resolved.terminalId && (
                            <p className="text-[9px] text-zinc-600 mb-1.5">
                              Session: {resolved.sessionId?.substring(0, 12) || '\u2014'} \u2022
                              Terminal: {resolved.terminalId.substring(0, 12)}
                              {resolved.source === 'active' && ' (active)'}
                            </p>
                          )}

                          {check.checkStatus !== 'completed' && (
                            <CheckFeedbackControls
                              checkId={check.checkId}
                              checkDescription={check.description}
                              parentType={group.parentType}
                              parentId={group.parentId}
                              parentSessionId={resolved.sessionId}
                              parentTerminalId={resolved.terminalId}
                              feedbackMode={checklistConfig.feedbackMode}
                              onFeedbackSent={() => {
                                window.dispatchEvent(new CustomEvent('check-feedback-sent'));
                              }}
                            />
                          )}

                          {check.feedback && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px]">
                                {check.feedback.type === 'approved' ? '\u2705' :
                                 check.feedback.type === 'rejected' ? '\u274C' : '\uD83D\uDCAC'}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {check.feedback.type === 'approved' ? 'Works' :
                                 check.feedback.type === 'rejected' ? "Doesn't work" :
                                 check.feedback.value?.substring(0, 80)}
                              </span>
                              {resolved.source === 'none' && (
                                <span className="text-[9px] text-amber-600">
                                  (no terminal connected)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
