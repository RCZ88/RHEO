import React, { useState, useEffect, useCallback } from 'react';
import { Search, Pin, Copy, ExternalLink, MessageSquarePlus, Edit3, ChevronDown, ChevronRight, Globe } from 'lucide-react';

console.log('%c[AiContextPanel] v3.0 loaded', 'color: #22d3ee; font-weight: bold');

const PROVIDER_COLORS: Record<string, string> = {
  chatgpt: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  claude: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  perplexity: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  you: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  gemini: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  unknown: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
};

export function AiContextPanel({ open }: { open: boolean }) {
  const [captures, setCaptures] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sendMenuId, setSendMenuId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await window.deskflowAPI?.aiContextList({
        provider: selectedProvider || undefined,
        group_id: selectedGroup ?? undefined,
        search: searchQuery || undefined,
        limit: 100
      });
      if (res) setCaptures(res.captures);
      const gRes = await window.deskflowAPI?.aiContextGroups();
      if (gRes) setGroups(gRes.groups);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [open, selectedProvider, selectedGroup, searchQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const unsub = window.deskflowAPI?.onAiContextCaptured(() => fetchData());
    return () => { if (unsub) unsub(); };
  }, [fetchData]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    setEditingId(null);
  };

  const openEdit = (cap: any) => {
    setEditingId(cap.id);
    setExpandedId(null);
    setEditForm({
      nickname: cap.nickname || '',
      note: cap.note || '',
      tagsStr: (cap.tags || []).join(', '),
      group_id: cap.group_id || '',
      pinned: !!cap.pinned
    });
  };

  const saveEdit = async (id: number) => {
    const tags = editForm.tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
    await window.deskflowAPI?.aiContextUpdate(id, {
      nickname: editForm.nickname,
      note: editForm.note,
      tags,
      group_id: editForm.group_id ? Number(editForm.group_id) : null,
      pinned: editForm.pinned
    });
    setEditingId(null);
    fetchData();
  };

  const togglePin = async (cap: any) => {
    await window.deskflowAPI?.aiContextUpdate(cap.id, { pinned: !cap.pinned });
    fetchData();
  };

  const formatAsMarkdown = (messages: any[]) => {
    return messages.map(m => `**${m.role}**:\n${m.content}`).join('\n\n---\n\n');
  };

  const copyTranscript = async (cap: any) => {
    await navigator.clipboard.writeText(formatAsMarkdown(cap.messages || []));
    setSendMenuId(null);
  };

  const insertIntoChat = async (cap: any) => {
    await window.deskflowAPI?.extensionQueueCommand({ type: 'INSERT_INTO_CHAT', text: formatAsMarkdown(cap.messages || []) });
    setSendMenuId(null);
  };

  const openLink = (cap: any) => {
    if (cap.url) window.open(cap.url, '_blank');
  };

  const pinnedCaptures = captures.filter(c => c.pinned);
  const regularCaptures = captures.filter(c => !c.pinned);

  const renderCaptureRow = (cap: any) => {
    const isExpanded = expandedId === cap.id;
    const isEditing = editingId === cap.id;
    const colorClass = PROVIDER_COLORS[cap.provider] || PROVIDER_COLORS.unknown;
    
    return (
      <div key={cap.id} className="bg-[rgba(24,24,27,0.60)] backdrop-blur-xl rounded-xl border border-zinc-800/40 light:border-[var(--ws-border)] overflow-hidden transition-colors hover:bg-zinc-800/15 light:hover:bg-stone-100">
        <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => toggleExpand(cap.id)}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorClass}`}>
              {cap.provider}
            </span>
            {cap.is_manual ? <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-700 text-zinc-300 border border-zinc-600 light:bg-stone-200 light:text-stone-700 light:border-stone-300">manual</span> : null}
            <span className="text-zinc-200 text-sm truncate light:text-stone-800">{cap.nickname || cap.title || 'Untitled Chat'}</span>
            {cap.pinned ? <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" /> : null}
          </div>
          <div className="flex items-center gap-2 text-zinc-500 light:text-stone-500">
            <span className="text-xs">{cap.messages?.length || 0} msgs</span>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>

        {cap.tags && cap.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-3 pb-2">
            {cap.tags.map((t: string) => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">{t}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 px-3 pb-3 text-xs border-t border-zinc-800/40 pt-2 light:border-[var(--ws-border)]">
          <button onClick={(e) => { e.stopPropagation(); openEdit(cap); }} className="flex items-center gap-1 hover:text-cyan-400 transition-colors text-zinc-400 light:text-stone-500"><Edit3 className="w-3 h-3" /> Edit</button>
          <button onClick={(e) => { e.stopPropagation(); copyTranscript(cap); }} className="flex items-center gap-1 hover:text-cyan-400 transition-colors text-zinc-400 light:text-stone-500"><Copy className="w-3 h-3" /> Copy</button>
          <button onClick={(e) => { e.stopPropagation(); openLink(cap); }} className="flex items-center gap-1 hover:text-cyan-400 transition-colors text-zinc-400 light:text-stone-500"><ExternalLink className="w-3 h-3" /> Open</button>
          <button onClick={(e) => { e.stopPropagation(); togglePin(cap); }} className="flex items-center gap-1 hover:text-amber-400 transition-colors text-zinc-400 light:text-stone-500"><Pin className="w-3 h-3" /> {cap.pinned ? 'Unpin' : 'Pin'}</button>
          
          <div className="relative ml-auto">
            <button onClick={(e) => { e.stopPropagation(); setSendMenuId(sendMenuId === cap.id ? null : cap.id); }} className="flex items-center gap-1 hover:text-emerald-400 transition-colors text-zinc-400 light:text-stone-500"><MessageSquarePlus className="w-3 h-3" /> Send to AI</button>
            {sendMenuId === cap.id && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-10 light:bg-white light:border-[var(--ws-border-strong)]">
                <button onClick={() => copyTranscript(cap)} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 light:hover:bg-stone-100 text-zinc-300 light:text-stone-700">Copy as Markdown</button>
                <button onClick={() => insertIntoChat(cap)} className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 light:hover:bg-stone-100 text-zinc-300 light:text-stone-700">Insert into Chat Input</button>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="p-3 border-t border-zinc-800/60 bg-zinc-900/50 space-y-3 light:bg-white light:border-[var(--ws-border)]" onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 uppercase light:text-stone-500">Nickname</label>
                <input className="w-full bg-zinc-800 border border-zinc-700 light:bg-white light:border-[var(--ws-border)] rounded px-2 py-1 text-xs text-zinc-200 light:text-stone-800" value={editForm.nickname} onChange={e => setEditForm({...editForm, nickname: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 uppercase light:text-stone-500">Note</label>
                <textarea className="w-full bg-zinc-800 border border-zinc-700 light:bg-white light:border-[var(--ws-border)] rounded px-2 py-1 text-xs text-zinc-200 light:text-stone-800 h-16" value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase light:text-stone-500">Tags (comma separated)</label>
                <input className="w-full bg-zinc-800 border border-zinc-700 light:bg-white light:border-[var(--ws-border)] rounded px-2 py-1 text-xs text-zinc-200 light:text-stone-800" value={editForm.tagsStr} onChange={e => setEditForm({...editForm, tagsStr: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase light:text-stone-500">Group</label>
                <select className="w-full bg-zinc-800 border border-zinc-700 light:bg-white light:border-[var(--ws-border)] rounded px-2 py-1 text-xs text-zinc-200 light:text-stone-800" value={editForm.group_id || ''} onChange={e => setEditForm({...editForm, group_id: e.target.value ? Number(e.target.value) : null})}>
                  <option value="">None</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 light:text-stone-500">Cancel</button>
              <button onClick={() => saveEdit(cap.id)} className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded">Save</button>
            </div>
          </div>
        )}

        {isExpanded && !isEditing && (
          <div className="p-3 border-t border-zinc-800/60 bg-zinc-950/50 max-h-96 overflow-y-auto space-y-3 light:bg-white light:border-[var(--ws-border)]">
            {(cap.messages || []).map((m: any, i: number) => (
              <div key={i} className={`p-2 rounded text-xs ${m.role === 'user' ? 'bg-cyan-900/20 border-l-2 border-cyan-500' : 'bg-zinc-800/50 border-l-2 border-zinc-600 light:bg-stone-100 light:border-stone-300'}`}>
                <div className="text-[10px] text-zinc-500 uppercase mb-1 light:text-stone-500">{m.role}</div>
                <div className="text-zinc-300 light:text-stone-700 whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950 text-zinc-200 light:bg-white light:text-stone-800">
      {/* Filters */}
      <div className="p-4 border-b border-zinc-800/60 light:border-[var(--ws-border)] space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 light:text-stone-500" />
          <input 
            type="text" 
            placeholder="Search nicknames, notes, content..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 light:bg-white light:border-[var(--ws-border)] light:text-stone-800 light:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setSelectedGroup(null)} 
            className={`px-2 py-1 rounded-full text-[10px] border transition-colors ${!selectedGroup ? 'bg-zinc-700 border-zinc-600 text-white light:bg-stone-300 light:border-stone-400' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 light:text-stone-500 light:hover:bg-stone-100'}`}
          >
            All Groups
          </button>
          {groups.map(g => (
            <button 
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={`px-2 py-1 rounded-full text-[10px] border transition-colors ${selectedGroup === g.id ? 'text-white' : 'text-zinc-400 hover:bg-zinc-800 light:text-stone-500 light:hover:bg-stone-100'}`}
              style={{ borderColor: g.color, color: selectedGroup === g.id ? g.color : undefined, backgroundColor: selectedGroup === g.id ? `${g.color}20` : undefined }}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setSelectedProvider(null)} 
            className={`px-2 py-1 rounded-full text-[10px] border transition-colors ${!selectedProvider ? 'bg-zinc-700 border-zinc-600 text-white light:bg-stone-300 light:border-stone-400' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 light:text-stone-500 light:hover:bg-stone-100'}`}
          >
            All Providers
          </button>
          {Object.keys(PROVIDER_COLORS).map(p => (
            <button 
              key={p}
              onClick={() => setSelectedProvider(p)}
              className={`px-2 py-1 rounded-full text-[10px] border transition-colors ${selectedProvider === p ? 'text-white' : 'text-zinc-400 hover:bg-zinc-800 light:text-stone-500 light:hover:bg-stone-100'} ${PROVIDER_COLORS[p]}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && captures.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 light:text-stone-500">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            Loading captures...
          </div>
        ) : captures.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 light:text-stone-500">
            <Globe className="w-12 h-12 mb-3 text-zinc-700 light:text-stone-400" />
            <p className="text-sm">No captures found.</p>
            <p className="text-xs text-zinc-600 light:text-stone-500 mt-1">Use the extension to save a chat or add a link.</p>
          </div>
        ) : (
          <>
            {pinnedCaptures.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold px-1">
                  <Pin className="w-3 h-3" /> PINNED
                </div>
                {pinnedCaptures.map(renderCaptureRow)}
              </div>
            )}
            <div className="space-y-2">
              {regularCaptures.map(renderCaptureRow)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
