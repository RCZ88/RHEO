import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Loader2, Clock, CheckCircle2, AlertCircle, Ban, ChevronRight, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { listContainer, riseItem } from './workspace/_ds/motion';
import { EmptyState, Skeleton } from './workspace/_ds/primitives';
import { INPUT_CLS, BTN_PRIMARY, BTN_GHOST, filterChipCls, accentVars, Pill, ModalShell, dotStyle } from './workspace/_ds/controls';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';

interface AgentPrompt {
  id: string; sessionId: string | null; projectId: string | null; content: string;
  title: string | null; status: string; progress: number; category: string;
  tags: string[]; resultSummary: string | null; sessionTopic: string | null;
  createdAt: string; updatedAt: string;
}

interface PromptsWorkspaceProps {
  projectId?: string;
  sessions?: Array<{ id: string; topic: string | null }>;
}

const ACCENT = '#a78bfa'; // Studio / Prompts violet

const STATUS_META: Record<string, { label: string; pill: string; dot: string; icon: any }> = {
  pending:     { label: 'Pending',     pill: 'text-zinc-300 bg-zinc-500/15 ring-1 ring-zinc-500/30',        dot: '#a1a1aa', icon: Clock },
  in_progress: { label: 'In Progress', pill: 'text-blue-300 bg-blue-500/15 ring-1 ring-blue-400/40',        dot: '#60a5fa', icon: Loader2 },
  completed:   { label: 'Completed',   pill: 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30', dot: '#34d399', icon: CheckCircle2 },
  failed:      { label: 'Failed',      pill: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30',            dot: '#f87171', icon: AlertCircle },
  cancelled:   { label: 'Cancelled',   pill: 'text-zinc-400 bg-zinc-500/15 ring-1 ring-zinc-500/30',         dot: '#71717a', icon: Ban },
};
const meta = (s: string) => STATUS_META[s] ?? STATUS_META.pending;

const FILTERS = ['all', 'pending', 'in_progress', 'completed', 'failed', 'cancelled'];
const filterLabel = (s: string) => (s === 'all' ? 'All' : meta(s).label);

const widthStyle = (n: number): React.CSSProperties => ({ width: `${n}%` });

export default function PromptsWorkspace({ projectId, sessions }: PromptsWorkspaceProps) {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedPrompt, setSelectedPrompt] = useState<AgentPrompt | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newSessionId, setNewSessionId] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await (window as any).deskflowAPI?.agentPrompts?.list({ projectId });
      if (r?.success) setPrompts(r.data || []);
    } catch (e) { console.error('[PromptsWorkspace] load', e); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [load]);

  const filtered = filter === 'all' ? prompts : prompts.filter(p => p.status === filter);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    setCreating(true);
    try {
      const r = await (window as any).deskflowAPI?.agentPrompts?.create({
        sessionId: newSessionId || undefined,
        projectId,
        content: newContent.trim(),
        title: newTitle.trim() || undefined,
        category: newCategory,
      });
      if (r?.success) {
        setShowNew(false);
        setNewTitle(''); setNewContent(''); setNewCategory('general'); setNewSessionId('');
        load();
      }
    } catch (e) { console.error('[PromptsWorkspace] create', e); }
    finally { setCreating(false); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setSavingId(id);
    try {
      await (window as any).deskflowAPI?.agentPrompts?.update({ id, status });
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      setSelectedPrompt(prev => prev && prev.id === id ? { ...prev, status } : prev);
      load();
    } catch (e) { console.error('[PromptsWorkspace] update status', e); }
    finally { setSavingId(null); }
  };

  const handleProgressUpdate = async (id: string, progress: number) => {
    setUpdatingProgress(id);
    try {
      await (window as any).deskflowAPI?.agentPrompts?.update({ id, progress });
      setSelectedPrompt(prev => prev && prev.id === id ? { ...prev, progress } : prev);
      load();
    } catch (e) { console.error('[PromptsWorkspace] update progress', e); }
    finally { setUpdatingProgress(null); }
  };

  const handleDelete = async (id: string) => {
    try {
      await (window as any).deskflowAPI?.agentPrompts?.delete(id);
      if (selectedPrompt && selectedPrompt.id === id) setSelectedPrompt(null);
      load();
    } catch (e) { console.error('[PromptsWorkspace] delete', e); }
  };

  return (
    <div className="flex flex-col h-full gap-3 p-3" style={accentVars(ACCENT)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)} className={filterChipCls(filter === s)}>
              {filterLabel(s)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)} className={BTN_PRIMARY}>
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* Prompt list */}
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<MessageSquare className="w-5 h-5" />} title="No prompts yet" hint="Track prompts you send to agents here." />
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="show" className="flex-1 overflow-y-auto ws-scroll space-y-2 pr-0.5">
          {filtered.map(p => {
            const m = meta(p.status);
            const StatusIcon = m.icon;
            return (
              <motion.button
                key={p.id}
                variants={riseItem}
                onClick={() => setSelectedPrompt(p)}
                className="group w-full text-left rounded-xl bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 hover:ring-zinc-700 hover:bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] transition-all duration-200 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon className={`w-3.5 h-3.5 ${p.status === 'in_progress' ? 'animate-spin' : ''}`} style={dotStyle('transparent')} color={m.dot} />
                      <span className="text-[13px] font-medium text-zinc-100 truncate">{p.title || 'Untitled Prompt'}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{p.content}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Pill label={m.label} cls={m.pill} dot={m.dot} compact />
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </div>
                {p.status === 'in_progress' && (
                  <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-[color:var(--page-accent)] transition-all" style={widthStyle(p.progress)} />
                  </div>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Detail modal */}
      {selectedPrompt && (
        <ModalShell
          onClose={() => setSelectedPrompt(null)}
          accent={ACCENT}
          title={
            <div className="flex items-center gap-2 min-w-0">
              <Pill label={meta(selectedPrompt.status).label} cls={meta(selectedPrompt.status).pill} dot={meta(selectedPrompt.status).dot} compact />
              <span className="text-[13px] text-zinc-100 truncate">{selectedPrompt.title || 'Untitled Prompt'}</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(STATUS_META).map(k => {
                  const active = selectedPrompt.status === k;
                  const km = meta(k);
                  return (
                    <button key={k} onClick={() => handleStatusUpdate(selectedPrompt.id, k)} disabled={savingId === selectedPrompt.id}
                      className={`inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 py-1 transition active:scale-95 disabled:opacity-50 ${active ? km.pill : 'text-zinc-400 bg-zinc-800/70 ring-1 ring-zinc-700/50 hover:text-zinc-200'}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={dotStyle(km.dot)} />
                      {km.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Progress: {selectedPrompt.progress}%</label>
              <input type="range" min={0} max={100} value={selectedPrompt.progress}
                onChange={e => handleProgressUpdate(selectedPrompt.id, parseInt(e.target.value))}
                disabled={updatingProgress === selectedPrompt.id}
                className="w-full h-1.5 rounded-full appearance-none bg-zinc-800 cursor-pointer"
              />
            </div>

            {selectedPrompt.sessionTopic && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-zinc-950 light:bg-[var(--ws-surface-60)] ring-1 ring-zinc-800/60 rounded-lg px-3 py-2">
                <TerminalIcon className="w-3.5 h-3.5 text-[color:var(--page-accent)]" />
                <span>Session: {selectedPrompt.sessionTopic}</span>
              </div>
            )}

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Content</label>
              <div className="bg-zinc-950 light:bg-[var(--ws-surface-60)] ring-1 ring-zinc-800/60 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto ws-scroll">{selectedPrompt.content}</div>
            </div>

            {selectedPrompt.resultSummary && (
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Result</label>
                <div className="bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 rounded-lg p-3 text-xs text-zinc-300 leading-relaxed">{selectedPrompt.resultSummary}</div>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-zinc-600 border-t border-zinc-800 pt-3">
              <span>Created: {new Date(selectedPrompt.createdAt).toLocaleString()}</span>
              <button onClick={() => handleDelete(selectedPrompt.id)} className="inline-flex items-center gap-1 text-red-400/80 hover:text-red-300 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* New prompt dialog */}
      {showNew && (
        <ModalShell onClose={() => setShowNew(false)} accent={ACCENT} title={<h2 className="text-[15px] font-semibold text-zinc-100">New Prompt</h2>}>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Title</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Optional title" className={INPUT_CLS} />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Content *</label>
              <VoiceInputWrapper>
                <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Enter prompt content…" rows={5} className={`${INPUT_CLS} resize-none font-mono`} autoFocus />
              </VoiceInputWrapper>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Category</label>
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className={INPUT_CLS}>
                  <option value="general">General</option>
                  <option value="debug">Debug</option>
                  <option value="feature">Feature</option>
                  <option value="review">Review</option>
                  <option value="research">Research</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Session</label>
                <select value={newSessionId} onChange={e => setNewSessionId(e.target.value)} className={INPUT_CLS}>
                  <option value="">None</option>
                  {(sessions || []).map(s => (
                    <option key={s.id} value={s.id}>{s.topic || s.id}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setShowNew(false)} className={`${BTN_GHOST} flex-1 py-2`}>Cancel</button>
            <button onClick={handleCreate} disabled={!newContent.trim() || creating} className={`${BTN_PRIMARY} flex-1 py-2`}>
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
