import React, { useState } from 'react';
import { StickyNote, Plus, Trash2, Pin, PinOff } from 'lucide-react';
import type { NotesBlock as NotesBlockType, NoteEntry } from '../../../shared/learn/types';

interface Props {
  block: NotesBlockType;
  nodeId: string;
  onAddNote?: (blockId: string, text: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onTogglePin?: (noteId: string) => void;
}

export function NotesBlock({ block, nodeId, onAddNote, onDeleteNote, onTogglePin }: Props) {
  const [text, setText] = useState('');
  const sorted = [...block.notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleAdd = () => {
    if (!text.trim() || !onAddNote) return;
    onAddNote(block.id, text.trim());
    setText('');
  };

  return (
    <div className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]">
        <StickyNote className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-medium text-zinc-300">Notes</span>
        <span className="text-[10px] text-zinc-600 ml-auto">{block.notes.length}</span>
      </div>

      <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">No notes yet. Add one below.</p>
        )}
        {sorted.map((note) => (
          <div
            key={note.id}
            className={`group flex items-start gap-2 p-2 rounded-lg transition ${
              note.pinned ? 'bg-emerald-500/8 border border-emerald-500/15' : 'bg-zinc-800/30 hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{note.text}</p>
              <span className="text-[10px] text-zinc-600 mt-1 block">
                {new Date(note.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
              {onTogglePin && (
                <button
                  onClick={() => onTogglePin(note.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-emerald-400 hover:bg-zinc-700/50"
                >
                  {note.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                </button>
              )}
              {onDeleteNote && (
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-700/50"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {onAddNote && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
              placeholder="Add a note..."
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-xs focus:border-emerald-500/50 focus:outline-none placeholder:text-zinc-600 transition"
            />
            <button
              onClick={handleAdd}
              disabled={!text.trim()}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
