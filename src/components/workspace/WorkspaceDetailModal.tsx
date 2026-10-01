import { useState, useEffect } from 'react';
import { X, Save, Terminal, Clock, Trash2, Download, MessageSquare, Monitor, Bot, FolderOpen } from 'lucide-react';

export function WorkspaceDetailModal({
  projectId,
  onClose,
  onLoad,
  onDelete,
}: {
  projectId: string;
  onClose: () => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.deskflowAPI?.listWorkspaces) return;
    (window.deskflowAPI as any).listWorkspaces({ projectId }).then((r: any) => {
      if (r?.success) setWorkspaces(r.data || []);
      setLoading(false);
    });
  }, [projectId]);

  // Parse saved workspace data
  const savedSessions = (() => {
    if (!selected) return [];
    // Try sessionDetails first (new format)
    if (selected.sessionDetails && Array.isArray(selected.sessionDetails)) {
      return selected.sessionDetails;
    }
    // Fallback: parse state_json
    try {
      const state = typeof selected.state_json === 'string' ? JSON.parse(selected.state_json) : selected.state_json;
      return state?.sessionDetails || [];
    } catch { return []; }
  })();

  const savedTerminals = (() => {
    if (!selected) return [];
    // Try terminalTabs (array of IDs) + terminalInfo (details)
    const tabs = selected.terminalTabs || [];
    const info = selected.terminalInfo || {};
    // Try state_json fallback
    let stateInfo = info;
    let stateTabs = tabs;
    try {
      const state = typeof selected.state_json === 'string' ? JSON.parse(selected.state_json) : selected.state_json;
      if (state?.terminalInfo) stateInfo = state.terminalInfo;
      if (state?.terminalTabs) stateTabs = state.terminalTabs;
    } catch {}
    const terminalIds = stateTabs.length > 0 ? stateTabs : Object.keys(stateInfo);
    return terminalIds.map((id: string) => ({
      id,
      name: stateInfo[id]?.name || id,
      agent: stateInfo[id]?.agent || '',
    }));
  })();

  const savedLayout = (() => {
    if (!selected) return null;
    if (selected.layout) return selected.layout;
    try {
      const state = typeof selected.state_json === 'string' ? JSON.parse(selected.state_json) : selected.state_json;
      return state?.layout || null;
    } catch { return null; }
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[700px] max-h-[80vh] rounded-xl bg-zinc-950 ring-1 ring-inset ring-zinc-800/70 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Saved Workspaces</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: workspace list */}
          <div className="w-52 border-r border-zinc-800/60 flex flex-col min-h-0 overflow-y-auto">
            {loading && <p className="text-xs text-zinc-500 p-3">Loading...</p>}
            {workspaces.map((ws: any) => (
              <button
                key={ws.name}
                onClick={() => setSelected(ws)}
                className={`text-left px-3 py-2.5 text-[11px] font-medium transition-colors border-b border-zinc-800/30 ${
                  selected?.name === ws.name ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Save className="w-3 h-3" />
                  {ws.name}
                  {ws.isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </div>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {ws.updatedAt ? new Date(ws.updatedAt).toLocaleDateString() : ''}
                  {savedSessions.length > 0 && ` · ${savedSessions.length} sessions`}
                  {savedTerminals.length > 0 && ` · ${savedTerminals.length} terminals`}
                </p>
              </button>
            ))}
          </div>

          {/* Right: workspace details */}
          <div className="flex-1 p-4 min-h-0 overflow-y-auto">
            {selected ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">{selected.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onLoad(selected.name)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[11px] font-medium hover:bg-emerald-500/25 transition-colors">
                      <Download className="w-3 h-3" /> Load
                    </button>
                    <button onClick={() => { onDelete(selected.name); setSelected(null); }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 text-[11px] font-medium hover:bg-red-500/25 transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>

                {/* Active group */}
                <div className="rounded-lg bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Monitor className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Active Group</span>
                  </div>
                  <p className="text-xs text-zinc-200 capitalize">{selected.activeTab || 'work'}</p>
                </div>

                {/* Terminal Sessions */}
                <div className="rounded-lg bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-3 h-3 text-violet-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Sessions</span>
                    <span className="text-[10px] text-zinc-600 ml-auto">{savedSessions.length}</span>
                  </div>
                  {savedSessions.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">No sessions saved</p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                      {savedSessions.map((s: any, i: number) => (
                        <div key={s.id || i} className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-950/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              s.status === 'active' ? 'bg-emerald-500' :
                              s.status === 'completed' ? 'bg-blue-500' :
                              s.status === 'in_progress' ? 'bg-violet-500 animate-pulse' :
                              'bg-zinc-600'
                            }`} />
                            <span className="text-[11px] text-zinc-300 truncate">{s.topic || s.id || 'Untitled'}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.category && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-500">{s.category}</span>
                            )}
                            <Bot className="w-3 h-3 text-zinc-600" />
                            <span className="text-[10px] text-zinc-500">{s.agent || ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open Terminals */}
                <div className="rounded-lg bg-zinc-900/50 ring-1 ring-inset ring-zinc-800/70 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Open Terminals</span>
                    <span className="text-[10px] text-zinc-600 ml-auto">{savedTerminals.length}</span>
                  </div>
                  {savedTerminals.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">No terminals open</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {savedTerminals.map((t: any, i: number) => (
                        <div key={t.id || i} className="flex items-center gap-2 py-1 px-2 rounded bg-zinc-950/50">
                          <Terminal className="w-3 h-3 text-emerald-500" />
                          <span className="text-[11px] text-zinc-400 truncate">{t.name || t.id}</span>
                          {t.agent && <span className="text-[9px] text-zinc-600 ml-auto">{t.agent}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <Save className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Select a workspace to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
