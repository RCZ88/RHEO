import React, { useState, useEffect, useCallback } from 'react';
import { StickyNote, Pin, PinOff, Trash2, Search, Loader2, MessageCircle, AlertCircle } from 'lucide-react';
import type { NoteEntry } from '../../shared/learn/types';

type NoteFilter = 'all' | 'clarification';

interface Props {
  getNotes: () => Promise<NoteEntry[]>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  defaultFilter?: NoteFilter;
}

export function NotesPanel({ getNotes, deleteNote, togglePin, defaultFilter = 'all' }: Props) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NoteFilter>(defaultFilter);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setNotes(await getNotes());
    } catch (e: any) {
      setError(e?.message || 'Failed to load notes');
    }
    setLoading(false);
  }, [getNotes]);

  useEffect(() => { load(); }, [load]);

  const filtered = notes.filter(n => {
    if (filter === 'clarification' && (!n.tags || !n.tags.includes('clarification'))) return false;
    if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleTogglePin = async (id: string) => {
    await togglePin(id);
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <StickyNote className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-zinc-200">
          {filter === 'clarification' ? 'Clarifications' : 'All Notes'}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto">{filtered.length}</span>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${
            filter === 'all' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('clarification')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition ${
            filter === 'clarification' ? 'bg-amber-500/15 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MessageCircle className="w-2.5 h-2.5" />
          Clarifications
        </button>
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none placeholder:text-zinc-600 transition"
            aria-label="Search notes"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2" role="list" aria-label="Notes">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20" role="alert">
            <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8">{search ? 'No matching notes' : 'No notes yet'}</p>
        ) : (
          sorted.map((note) => (
            <div
              key={note.id}
              role="listitem"
              className={`group p-3 rounded-xl transition ${
                note.pinned ? 'bg-emerald-500/8 border border-emerald-500/15' : 'bg-zinc-800/30 hover:bg-zinc-800/50'
              }`}
            >
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{note.text}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-zinc-600">{new Date(note.created_at).toLocaleDateString()}</span>
                {note.node_title && <span className="text-[10px] text-zinc-600">· {note.node_title}</span>}
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                  <button
                    onClick={() => handleTogglePin(note.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-emerald-400"
                    aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                  >
                    {note.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-red-400"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
