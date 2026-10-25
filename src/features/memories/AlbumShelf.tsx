import type { LoadedMemory } from './useMemories';
import type { MemoryGroup } from './types';
import { AlbumCard } from './AlbumCard';

interface AlbumShelfProps {
  groups: MemoryGroup[];
  items: LoadedMemory[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpenGroup: (group: MemoryGroup) => void;
  onCreateGroup: () => void;
}

export function AlbumShelf({
  groups,
  items,
  loading,
  error,
  onRetry,
  onOpenGroup,
  onCreateGroup,
}: AlbumShelfProps) {
  const ungrouped = items.filter(m => !m.meta.groupId);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-[var(--bg-surface)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-mem-400)]/30 bg-[var(--color-mem-400)]/10 p-3 text-[12px] text-[var(--color-mem-400)]">
        Couldn't load albums
        <button type="button" onClick={onRetry} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {groups.map(g => {
        const members = items.filter(m => m.meta.groupId === g.id);
        return (
          <AlbumCard
            key={g.id}
            group={g}
            members={members}
            onOpen={() => onOpenGroup(g)}
          />
        );
      })}

      {/* Ungrouped pseudo-card (only if there are ungrouped photos) */}
      {ungrouped.length > 0 && (
        <AlbumCard
          group={{
            id: '__ungrouped__',
            title: 'Ungrouped',
            accent: 'rose',
            order: 9999,
            createdAt: 0,
            updatedAt: 0,
          }}
          members={ungrouped}
          onOpen={() => onOpenGroup({
            id: '__ungrouped__',
            title: 'Ungrouped',
            accent: 'rose',
            order: 9999,
            createdAt: 0,
            updatedAt: 0,
          })}
          isUngrouped
        />
      )}

      {/* New Album tile */}
      <AlbumCard
        group={{
          id: '__new__',
          title: 'New album',
          accent: 'rose',
          order: 10000,
          createdAt: 0,
          updatedAt: 0,
        }}
        members={[]}
        onOpen={onCreateGroup}
        isNew
      />
    </div>
  );
}