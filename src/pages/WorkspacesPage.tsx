import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageShell } from '../components/PageShell';
import { EmptyState } from '../components/EmptyState';
import { Save, Clock, Monitor, Trash2, RefreshCw, Loader2, Terminal, FolderOpen, CheckCircle2 } from 'lucide-react';

interface WorkspaceEntry {
  name: string;
  projectId: string;
  projectName: string;
  isActive: boolean;
  sidebarWidth: number;
  activeTab: string;
  updatedAt: string;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function WorkspacesPage() {
  const [items, setItems] = useState<WorkspaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = (window as any).deskflowAPI;
      if (!api?.listAllWorkspaces) {
        setError('Workspace API not available');
        setItems([]);
        return;
      }
      const res = await api.listAllWorkspaces();
      if (res?.success && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        setItems([]);
        if (res?.error) setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load workspaces');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = useCallback(async (name: string, projectId: string) => {
    const api = (window as any).deskflowAPI;
    if (!api?.deleteWorkspace) return;
    if (!window.confirm(`Delete saved workspace "${name}"?`)) return;
    await api.deleteWorkspace({ projectId, name });
    refresh();
  }, [refresh]);

  const handleLoad = useCallback((name: string, projectId: string) => {
    const api = (window as any).deskflowAPI;
    if (!api?.loadWorkspace) return;
    api.selectProject?.(projectId);
    api.loadWorkspace({ scope: 'project', projectId, name }).then(() => {
      window.location.hash = '#/terminal';
    });
  }, []);

  const grouped = items.reduce<Record<string, WorkspaceEntry[]>>((acc, item) => {
    const key = item.projectName || item.projectId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const projectKeys = Object.keys(grouped).sort();

  return (
    <PageShell page="workspaces">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Save className="w-6 h-6 text-cyan-400" />
              Saved Workspaces
            </h1>
            <p className="text-sm text-zinc-400 mt-1">Browse and manage all saved workspace states across projects</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
          </div>
        ) : error && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <p className="text-sm">{error}</p>
            <button onClick={refresh} className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm">
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState iconComponent={Save} title="No saved workspaces" hint="Save a workspace from the Terminal page to see it here." />
        ) : (
          <div className="space-y-8">
            {projectKeys.map((projectName) => (
              <div key={projectName}>
                <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-zinc-500" />
                  {projectName}
                  <span className="text-xs text-zinc-600 font-normal">({grouped[projectName].length})</span>
                </h2>
                <div className="grid gap-2">
                  {grouped[projectName].map((w) => (
                    <motion.div
                      key={`${w.projectId}-${w.name}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="text-sm text-zinc-200 font-medium truncate">{w.name}</span>
                          {w.isActive && (
                            <span className="flex items-center gap-1 text-[10px] text-green-400 border border-green-600/40 rounded px-1.5 py-0.5">
                              <CheckCircle2 className="w-3 h-3" /> active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(w.updatedAt)}
                          </span>
                          <span className="text-[11px] text-zinc-600">tab: {w.activeTab || '—'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button
                          onClick={() => handleLoad(w.name, w.projectId)}
                          className="px-3 py-1.5 bg-emerald-600/40 hover:bg-emerald-500/60 text-emerald-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          Open
                        </button>
                        <button
                          onClick={() => handleDelete(w.name, w.projectId)}
                          title="Delete workspace"
                          className="px-2 py-1.5 bg-rose-600/30 hover:bg-rose-500/50 text-rose-300 text-xs rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
