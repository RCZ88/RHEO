import { motion } from 'framer-motion';
import { FolderMinus, X } from 'lucide-react';
import type { MemoryGroup } from './types';

interface SelectionBarProps {
  count: number;
  groups: MemoryGroup[];
  onMoveTo: (groupId: string | null) => void;
  onClear: () => void;
}

export function SelectionBar({ count, groups, onMoveTo, onClear }: SelectionBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-raised)] py-1.5 pl-3 pr-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
    >
      <span className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-primary)]">
        {count} selected
      </span>
      <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
      <button
        type="button"
        onClick={() => onMoveTo(null)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]"
      >
        <FolderMinus className="w-3.5 h-3.5" />
        Remove from album
      </button>
      <select
        onChange={e => {
          if (e.target.value) onMoveTo(e.target.value);
        }}
        className="px-2 py-1 rounded-md text-[11px] bg-[var(--bg-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
        defaultValue=""
      >
        <option value="" disabled>Add to album...</option>
        {groups.map(g => (
          <option key={g.id} value={g.id}>{g.title}</option>
        ))}
      </select>
      <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]"
        aria-label="Clear selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}