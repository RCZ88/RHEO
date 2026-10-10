import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Check, Loader2, RefreshCw, Terminal, Calendar, Database, Globe } from 'lucide-react';

interface ImportableSession {
  id: string;
  agent: string;
  started: string;
  topic: string;
  source: 'cli' | 'db';
}

type AgentDef = { id: string; name: string; command?: string; icon: any };

const AGENTS: AgentDef[] = [
  { id: 'opencode', name: 'OpenCode', command: 'opencode session list', icon: Terminal },
  { id: 'claude', name: 'Claude Code', command: 'claude session list', icon: Terminal },
  { id: 'gemini', name: 'Gemini CLI', command: 'gemini session list', icon: Terminal },
  { id: 'codex', name: 'Codex CLI', command: 'codex session list', icon: Terminal },
  { id: 'aider', name: 'Aider', command: 'aider --list-conversations', icon: Terminal },
  { id: 'all-db', name: 'All Tracked', icon: Database },
];

const CLR = {
  overlay: 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]',
  panel: 'fixed top-[8%] left-1/2 -translate-x-1/2 w-[680px] max-h-[80vh] bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded-xl flex flex-col z-[101]',
  header: 'flex items-center justify-between px-5 py-4 border-b border-zinc-800/70',
  title: 'text-sm font-semibold text-zinc-200 flex items-center gap-2',
  close: 'p-1 rounded-lg hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors',
  body: 'flex-1 overflow-y-auto px-5 py-3 space-y-1',
  row: 'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border border-transparent',
  rowSelected: 'bg-cyan-500/10 border-cyan-500/20',
  rowUnselected: 'hover:bg-zinc-800/40',
  checkbox: 'w-4 h-4 rounded border-2 border-zinc-600 flex items-center justify-center shrink-0 transition-colors',
  checkboxChecked: 'bg-cyan-500 border-cyan-500',
  footer: 'flex items-center justify-between px-5 py-3 border-t border-zinc-800/70 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)]',
  scanBtn: 'px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors',
  importBtn: 'px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed',
  cancelBtn: 'px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium rounded-lg transition-colors',
  empty: 'text-center py-12 text-zinc-600 text-xs',
  error: 'text-center py-4 text-rose-400 text-xs',
  badge: 'px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider',
};

function parseOpencodeSessions(output: string): ImportableSession[] {
  const lines = output.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const sessions: ImportableSession[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const idMatch = line.match(/^([a-zA-Z0-9_\-]{8,})\s+/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const rest = line.slice(idMatch[0].length).trim();
    const dateMatch = rest.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*$/);
    const started = dateMatch ? dateMatch[1] : '';
    const topic = dateMatch ? rest.slice(0, dateMatch.index).trim() : rest;
    sessions.push({ id, agent: 'opencode', started, topic, source: 'cli' });
  }
  return sessions;
}

function parseClaudeSessions(output: string): ImportableSession[] {
  const lines = output.trim().split('\n').filter(l => l.trim());
  const sessions: ImportableSession[] = [];
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_\-]{8,})\s+(.+?)(?:\s+(\d{4}-\d{2}-\d{2}))?$/);
    if (match) {
      sessions.push({ id: match[1], agent: 'claude', started: match[3] || '', topic: match[2].trim(), source: 'cli' });
    }
  }
  return sessions;
}

function parseGenericSessions(output: string, agentName: string): ImportableSession[] {
  const lines = output.trim().split('\n').filter(l => l.trim());
  const sessions: ImportableSession[] = [];
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_\-]{8,})\s+(.+?)(?:\s+(\d{4}-\d{2}-\d{2}))?$/);
    if (match) {
      sessions.push({ id: match[1], agent: agentName, started: match[3] || '', topic: match[2].trim(), source: 'cli' });
    }
  }
  return sessions;
}

export default function ImportSessionsDialog({ onClose, onImport, projectId }: {
  onClose: () => void;
  onImport: (sessions: ImportableSession[]) => void;
  projectId?: string;
}) {
  const [activeAgent, setActiveAgent] = useState('all-db');
  const [sessions, setSessions] = useState<ImportableSession[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError('');
    setSessions([]);
    setSelected(new Set());
    try {
      if (activeAgent === 'all-db') {
        const data = await window.deskflowAPI?.getTerminalSessions?.(projectId || undefined, 200);
        if (data && data.length > 0) {
          const parsed: ImportableSession[] = data.map((s: any) => ({
            id: s.resume_id || s.id,
            agent: s.agent || 'unknown',
            started: s.created_at || '',
            topic: s.topic || 'Unnamed Session',
            source: 'db' as const,
          }));
          setSessions(parsed);
        } else {
          setError('No tracked sessions found in database.');
        }
      } else {
        const agentDef = AGENTS.find(a => a.id === activeAgent);
        if (!agentDef?.command) {
          setError('No CLI command available for this agent.');
          return;
        }
        const result = await window.deskflowAPI?.executeCommand?.(agentDef.command);
        if (result?.error) {
          setError(`${agentDef.name} CLI error: ${result.error}`);
          return;
        }
        if (!result?.stdout?.trim()) {
          setError(`No output from ${agentDef.name}. Is it installed?`);
          return;
        }
        let parsed: ImportableSession[] = [];
        if (activeAgent === 'opencode') parsed = parseOpencodeSessions(result.stdout);
        else if (activeAgent === 'claude') parsed = parseClaudeSessions(result.stdout);
        else parsed = parseGenericSessions(result.stdout, activeAgent);
        if (parsed.length === 0) {
          setError(`No sessions found. Output:\n${result.stdout.slice(0, 300)}`);
          return;
        }
        setSessions(parsed);
      }
    } catch (e: any) {
      setError(`Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [activeAgent, projectId]);

  useEffect(() => { scan(); }, [scan]);

  const toggleIdx = (idx: number, shift: boolean) => {
    const ids = sessions.map(s => `${s.agent}:${s.id}`);
    if (shift && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end = Math.max(lastClickedIdx, idx);
      const range = ids.slice(start, end + 1);
      const allInRangeSelected = range.every(id => selected.has(id));
      setSelected(prev => {
        const next = new Set(prev);
        for (const id of range) {
          if (allInRangeSelected) next.delete(id);
          else next.add(id);
        }
        return next;
      });
    } else {
      const id = ids[idx];
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    setLastClickedIdx(idx);
  };

  const handleImport = () => {
    const toImport = sessions.filter(s => selected.has(`${s.agent}:${s.id}`));
    if (toImport.length === 0) return;
    onImport(toImport);
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  const AGENT_COLORS: Record<string, string> = {
    opencode: 'bg-cyan-500/20 text-cyan-300',
    claude: 'bg-orange-500/20 text-orange-300',
    gemini: 'bg-blue-500/20 text-blue-300',
    codex: 'bg-green-500/20 text-green-300',
    aider: 'bg-purple-500/20 text-purple-300',
    unknown: 'bg-zinc-500/20 text-zinc-400',
  };

  return (
    <>
      <div className={CLR.overlay} onClick={onClose} />
      <div className={CLR.panel}>
        <div className={CLR.header}>
          <span className={CLR.title}>
            <Terminal className="w-4 h-4 text-cyan-400" />
            Import Sessions
          </span>
          <button onClick={onClose} className={CLR.close}><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-2 border-b border-zinc-800/70">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {AGENTS.map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveAgent(a.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                    activeAgent === a.id
                      ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/30'
                      : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className={CLR.body} ref={listRef}>
          {loading ? (
            <div className={CLR.empty}>
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
              Scanning sessions...
            </div>
          ) : error ? (
            <div>
              <p className={CLR.error}>{error}</p>
              <div className="flex justify-center gap-2 mt-3">
                <button onClick={scan} className={CLR.scanBtn}>
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className={CLR.empty}>
              <Terminal className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              <p>No sessions found</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] text-zinc-500">{sessions.length} sessions</span>
                <button onClick={() => {
                  const allIds = new Set(sessions.map(s => `${s.agent}:${s.id}`));
                  if (selected.size === sessions.length) setSelected(new Set());
                  else setSelected(allIds);
                }} className="text-[10px] text-cyan-500 hover:text-cyan-400 transition-colors">
                  {selected.size === sessions.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              {sessions.map((s, i) => {
                const key = `${s.agent}:${s.id}`;
                const isSelected = selected.has(key);
                return (
                  <div
                    key={key}
                    onClick={(e) => toggleIdx(i, e.shiftKey)}
                    className={`${CLR.row} ${isSelected ? CLR.rowSelected : CLR.rowUnselected}`}
                  >
                    <div className={`${CLR.checkbox} ${isSelected ? CLR.checkboxChecked : ''}`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs text-zinc-200 font-medium truncate">{s.topic || 'Untitled'}</span>
                        <span className={`${CLR.badge} ${AGENT_COLORS[s.agent] || AGENT_COLORS.unknown}`}>{s.agent}</span>
                        {s.source === 'db' && <span className={`${CLR.badge} bg-zinc-800 text-zinc-500`}>tracked</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(s.started)}
                        </span>
                        <span className="font-mono truncate">{s.id.slice(0, 16)}...</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className={CLR.footer}>
          <div className="text-[10px] text-zinc-500">
            {selected.size > 0 ? `${selected.size} selected` : 'Click + Shift-click for range'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={CLR.cancelBtn}>Cancel</button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className={CLR.importBtn}
            >
              <Check className="w-3.5 h-3.5" />
              Import {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
