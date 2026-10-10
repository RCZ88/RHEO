// Lyceum Learn — Node Sources Panel (Task A)
// Editable grounding links/sources per node

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, Plus, ExternalLink, Trash2, Edit3, Check, LoaderCircle } from 'lucide-react';

console.log('%c[NodeSourcesPanel] v1.0 loaded', 'color: #fbbf24; font-weight: bold');

interface Source {
  id: string;
  node_id: string;
  url: string;
  title: string;
  kind?: string;
  license?: string;
  retrieved?: string;
}

interface NodeSourcesPanelProps {
  nodeId: string;
  open: boolean;
  onClose: () => void;
}

export function NodeSourcesPanel({ nodeId, open, onClose }: NodeSourcesPanelProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ id: '', url: '', title: '', kind: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const api = (window as any).deskflowAPI;
      const res = await api?.learnGetSources?.({ nodeId });
      if (res?.ok) setSources(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [nodeId]);

  useEffect(() => { if (open && nodeId) load(); }, [open, nodeId, load]);

  const save = useCallback(async (next: Source[]) => {
    const api = (window as any).deskflowAPI;
    const res = await api?.learnUpdateSources?.({
      nodeId,
      sources: next.map(s => ({ id: s.id, url: s.url, title: s.title, kind: s.kind, license: s.license })),
    });
    if (res?.ok) {
      setSources(next);
      setError(null);
    } else {
      setError(res?.error || 'Failed to save');
    }
  }, [nodeId]);

  const handleAdd = () => {
    if (!form.id.trim() || !form.url.trim() || !form.title.trim()) {
      setError('All fields are required');
      return;
    }
    if (!/^https?:\/\//.test(form.url)) {
      setError('URL must start with http:// or https://');
      return;
    }
    if (!/^[a-z0-9-]{1,32}$/.test(form.id)) {
      setError('ID must be 1-32 lowercase alphanumeric/dash');
      return;
    }
    if (sources.some(s => s.id === form.id)) {
      setError('Duplicate source ID');
      return;
    }
    const newSrc: Source = {
      id: form.id.trim(),
      node_id: nodeId,
      url: form.url.trim(),
      title: form.title.trim(),
      kind: form.kind.trim() || undefined,
    };
    save([...sources, newSrc]);
    setForm({ id: '', url: '', title: '', kind: '' });
    setAdding(false);
  };

  const handleDelete = (id: string) => {
    save(sources.filter(s => s.id !== id));
  };

  const handleEdit = (src: Source) => {
    setEditing(src.id);
    setForm({ id: src.id, url: src.url, title: src.title, kind: src.kind || '' });
  };

  const handleSaveEdit = () => {
    const next = sources.map(s =>
      s.id === editing
        ? { ...s, url: form.url.trim(), title: form.title.trim(), kind: form.kind.trim() || undefined }
        : s
    );
    save(next);
    setEditing(null);
    setForm({ id: '', url: '', title: '', kind: '' });
  };

  if (!open) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 shrink-0">
        <h3 className="text-sm font-semibold text-zinc-200">Grounding Sources</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition" aria-label="Close sources panel">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <LoaderCircle size={14} className="animate-spin" /> Loading sources…
          </div>
        )}

        {!loading && sources.length === 0 && !adding && (
          <p className="text-xs text-zinc-600">No sources linked to this node yet.</p>
        )}

          {sources.map(src => (
            <div key={src.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] p-3">
              {editing === src.id ? (
                <div className="space-y-2">
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                    placeholder="Title" />
                  <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200 font-mono"
                    placeholder="https://..." />
                  <input value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400"
                    placeholder="Kind (optional)" />
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit}
                      className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500">
                      <Check size={12} /> Save
                    </button>
                    <button onClick={() => { setEditing(null); setForm({ id: '', url: '', title: '', kind: '' }); setError(null); }}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-200 truncate">{src.title}</p>
                    <p className="text-[11px] text-zinc-500 font-mono truncate">{src.url}</p>
                    {src.kind && <span className="mt-1 inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{src.kind}</span>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                      className="text-zinc-600 hover:text-zinc-400 transition p-1">
                      <ExternalLink size={12} />
                    </a>
                    <button onClick={() => handleEdit(src)}
                      className="text-zinc-600 hover:text-zinc-400 transition p-1">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleDelete(src.id)}
                      className="text-zinc-600 hover:text-red-400 transition p-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {adding && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200 font-mono"
                placeholder="source-id (lowercase, 1-32 chars)" />
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200"
                placeholder="Title" />
              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-200 font-mono"
                placeholder="https://..." />
              <input value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400"
                placeholder="Kind (optional: article, docs, video, etc.)" />
              <div className="flex gap-2">
                <button onClick={handleAdd}
                  className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500">
                  <Check size={12} /> Add Source
                </button>
                <button onClick={() => { setAdding(false); setForm({ id: '', url: '', title: '', kind: '' }); setError(null); }}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>

      <div className="border-t border-zinc-800 px-4 py-3 shrink-0">
        {!adding && (
          <button onClick={() => { setAdding(true); setError(null); }}
            className="flex items-center gap-1 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition">
            <Plus size={12} /> Add Source
          </button>
        )}
      </div>
    </div>
  );
}
