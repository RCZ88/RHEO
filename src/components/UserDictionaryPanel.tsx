import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Edit, Search, Download, Upload, X, Check, GripVertical, Copy } from 'lucide-react';

interface DictEntry {
  id: number;
  term: string;
  definition: string;
  context: string;
  aliases: string;
  created_at: string;
  updated_at: string;
}

export function UserDictionaryPanel() {
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formTerm, setFormTerm] = useState('');
  const [formDef, setFormDef] = useState('');
  const [formContext, setFormContext] = useState('');
  const [formAliases, setFormAliases] = useState('');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (window as any).deskflowAPI?.userDictionary?.list();
      if (res?.ok) setEntries(res.entries || []);
    } catch (e) { console.warn('user-dictionary:list failed', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q) || e.context.toLowerCase().includes(q);
  });

  const handleAdd = async () => {
    if (!formTerm.trim() || !formDef.trim()) return;
    const aliases = formAliases.split(',').map((a) => a.trim()).filter(Boolean);
    const res = await (window as any).deskflowAPI?.userDictionary?.add({ term: formTerm, definition: formDef, context: formContext, aliases });
    if (res?.ok) {
      setAdding(false); setFormTerm(''); setFormDef(''); setFormContext(''); setFormAliases('');
      loadEntries();
    }
  };

  const handleUpdate = async (id: number) => {
    if (!formTerm.trim() || !formDef.trim()) return;
    const aliases = formAliases.split(',').map((a) => a.trim()).filter(Boolean);
    const res = await (window as any).deskflowAPI?.userDictionary?.update({ id, term: formTerm, definition: formDef, context: formContext, aliases });
    if (res?.ok) {
      setEditingId(null); setFormTerm(''); setFormDef(''); setFormContext(''); setFormAliases('');
      loadEntries();
    }
  };

  const handleDelete = async (id: number) => {
    const res = await (window as any).deskflowAPI?.userDictionary?.delete(id);
    if (res?.ok) loadEntries();
  };

  const startEdit = (entry: DictEntry) => {
    setEditingId(entry.id);
    setFormTerm(entry.term);
    setFormDef(entry.definition);
    setFormContext(entry.context || '');
    try { setFormAliases(JSON.parse(entry.aliases || '[]').join(', ')); } catch { setFormAliases(''); }
    setAdding(false);
  };

  const cancelForm = () => {
    setAdding(false); setEditingId(null); setFormTerm(''); setFormDef(''); setFormContext(''); setFormAliases('');
  };

  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const VocabPrompt = `Update the vocabulary map using these IPC calls via window.deskflowAPI.vocab:

Adding synonyms: window.deskflowAPI.vocab.add({ canonical: "workspace", variant: "terminal" })
Correcting wrong terms: window.deskflowAPI.vocab.correct({ wrong: "ws", correct: "workspace" })
Listing all mappings: window.deskflowAPI.vocab.list()
Removing a mapping: window.deskflowAPI.vocab.delete(id)

Example session:

User: add vocab workspace = terminal, ws, terminal workspace
AI: calls vocab.add({ canonical: "workspace", variant: "terminal" }) + vocab.add({ canonical: "workspace", variant: "ws" }) + vocab.add({ canonical: "workspace", variant: "terminal workspace" })

User: when I say conductor I mean the swarm system
AI: calls vocab.add({ canonical: "conductor", variant: "swarm" })

User: I meant workspace not terminal
AI: calls vocab.correct({ wrong: "terminal", correct: "workspace" })

User: show my vocabulary
AI: calls vocab.list() and displays the results

These words all mean the same thing and should be mapped to one canonical term. The vocabulary resolver stores variant→canonical mappings so the AI agent knows they're synonyms.`;

  const handleCopyPrompt = async () => {
    try { await navigator.clipboard.writeText(VocabPrompt); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 2000); } catch {}
  };

  const handleExport = async () => {
    const res = await (window as any).deskflowAPI?.userDictionary?.export();
    if (res?.ok) {
      const blob = new Blob([res.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'user-dictionary.md'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,.md';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        const entries = Array.isArray(data) ? data : data.entries || [];
        const res = await (window as any).deskflowAPI?.userDictionary?.import(entries);
        if (res?.ok) loadEntries();
      } catch { /* try markdown parse */ }
    };
    input.click();
  };

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-100">User Dictionary</h3>
            <p className="text-[10px] text-zinc-500">{entries.length} terms defined</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopyPrompt} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-700/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-400 hover:text-zinc-200 text-[10px] transition-all" title="Copy prompt to paste into AI chat">
            {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copiedPrompt ? 'Copied' : 'Vocab Prompt'}
          </button>
          <button onClick={handleExport} className="p-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-400 hover:text-zinc-200 transition-all" title="Export">
            <Download className="w-3 h-3" />
          </button>
          <button onClick={handleImport} className="p-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-400 hover:text-zinc-200 transition-all" title="Import">
            <Upload className="w-3 h-3" />
          </button>
          <button onClick={() => { setAdding(true); setEditingId(null); }} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[10px] transition-all">
            <Plus className="w-3 h-3" /> Add Term
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search terms..."
          className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 light:bg-[var(--ws-surface)]/60 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
      </div>

      {/* Add/Edit Form */}
      {(adding || editingId) && (
        <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-300 font-medium">{editingId ? 'Edit Term' : 'New Term'}</span>
            <button onClick={cancelForm} className="p-0.5 rounded hover:bg-zinc-800 transition-colors"><X className="w-3 h-3 text-zinc-500" /></button>
          </div>
          <input value={formTerm} onChange={(e) => setFormTerm(e.target.value)} placeholder="Term (e.g. 'workspace')"
            className="w-full px-2 py-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 light:bg-[var(--ws-surface)]/60 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
          <input value={formDef} onChange={(e) => setFormDef(e.target.value)} placeholder="Definition (what it means to you)"
            className="w-full px-2 py-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 light:bg-[var(--ws-surface)]/60 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
          <input value={formContext} onChange={(e) => setFormContext(e.target.value)} placeholder="Context (optional: when to use this term)"
            className="w-full px-2 py-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 light:bg-[var(--ws-surface)]/60 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
          <input value={formAliases} onChange={(e) => setFormAliases(e.target.value)} placeholder="Aliases (comma-separated, e.g. 'ws,terminal-ws')"
            className="w-full px-2 py-1.5 rounded-lg border border-zinc-700/50 bg-zinc-950 light:bg-[var(--ws-surface)]/60 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-500/50" />
          <button onClick={() => editingId ? handleUpdate(editingId) : handleAdd()}
            className="w-full py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-medium hover:bg-amber-500/30 transition-all">
            {editingId ? 'Update' : 'Add Term'}
          </button>
        </div>
      )}

      {/* Entries */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-[10px] text-zinc-600">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 gap-1">
            <BookOpen className="w-4 h-4 text-zinc-700" />
            <span className="text-[10px] text-zinc-600">{search ? 'No matching terms' : 'No terms defined yet'}</span>
          </div>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className="group rounded-xl border border-zinc-700/30 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] p-2.5 hover:border-zinc-600/50 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-amber-300">{entry.term}</span>
                    {entry.context && <span className="text-[9px] text-zinc-600 bg-zinc-800/50 px-1 rounded">{entry.context}</span>}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{entry.definition}</p>
                  {(() => { try { const aliases = JSON.parse(entry.aliases || '[]'); return aliases.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aliases.map((a: string) => <span key={a} className="text-[9px] text-zinc-500 bg-zinc-800/40 px-1 rounded">{a}</span>)}
                    </div>
                  ) : null; } catch { return null; } })()}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => startEdit(entry)} className="p-1 rounded hover:bg-zinc-800 transition-colors"><Edit className="w-2.5 h-2.5 text-zinc-500" /></button>
                  <button onClick={() => handleDelete(entry.id)} className="p-1 rounded hover:bg-zinc-800 transition-colors"><Trash2 className="w-2.5 h-2.5 text-red-400/60" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
