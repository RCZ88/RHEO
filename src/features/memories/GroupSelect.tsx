import { useState } from 'react';
import { ChevronDown, Plus, FolderOpen } from 'lucide-react';
import type { MemoryGroup } from './types';
import { GROUP_ACCENTS } from './accents';

interface GroupSelectProps {
  groups: MemoryGroup[];
  value: string | undefined;
  onChange: (groupId: string | undefined) => void;
  onCreate: (title: string) => Promise<MemoryGroup>;
  onAssign: (groupId: string) => void;
}

export function GroupSelect({ groups, value, onChange, onCreate, onAssign }: GroupSelectProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const selected = value ? groups.find(g => g.id === value) : null;

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const group = await onCreate(newTitle.trim());
    onAssign(group.id);
    setNewTitle('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-raised)] text-[12px] text-[var(--text-primary)] hover:border-[var(--border-default)]"
      >
        {selected ? (
          <>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GROUP_ACCENTS[selected.accent] }} />
            <span className="truncate max-w-24">{selected.title}</span>
          </>
        ) : (
          <>
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">No album</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 min-w-44 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <button
            type="button"
            onClick={() => { onChange(undefined); setOpen(false); }}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-white/[0.06] ${!value ? 'text-[var(--color-mem-400)]' : 'text-[var(--text-primary)]'}`}
          >
            No album
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => { onChange(g.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-white/[0.06] ${value === g.id ? 'text-[var(--color-mem-400)]' : 'text-[var(--text-primary)]'}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GROUP_ACCENTS[g.accent] }} />
              <span className="truncate">{g.title}</span>
              <span className="ml-auto font-['JetBrains_Mono'] text-[10px] text-[var(--text-muted)]">
                {g.id}
              </span>
            </button>
          ))}
          <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
            {creating ? (
              <div className="flex gap-1 px-1">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewTitle(''); } }}
                  placeholder="Album name"
                  className="flex-1 h-7 px-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  className="px-2 py-1 rounded-md text-[11px] text-[var(--color-mem-400)] hover:bg-white/[0.06]"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--color-mem-400)] hover:bg-white/[0.06]"
              >
                <Plus className="w-3.5 h-3.5" />
                New album…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}