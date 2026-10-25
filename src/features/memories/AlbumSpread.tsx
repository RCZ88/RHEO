import { useState } from 'react';
import { ChevronLeft, MoreHorizontal, MapPin, Trash2, Star } from 'lucide-react';
import type { LoadedMemory } from './useMemories';
import type { MemoryGroup } from './types';
import { GROUP_ACCENTS } from './accents';
import { MemoryMasonry } from './MemoryMasonry';
import { MemoryTile } from './MemoryTile';

interface AlbumSpreadProps {
  group: MemoryGroup;
  members: LoadedMemory[];
  onBack: () => void;
  onUpdateGroup: (patch: Partial<MemoryGroup>) => void;
  onDeleteGroup: () => void;
  onSetCover: (memoryId: string) => void;
  onOpenMemory: (m: LoadedMemory) => void;
  onAddPhotos: () => void;
}

export function AlbumSpread({
  group,
  members,
  onBack,
  onUpdateGroup,
  onDeleteGroup,
  onSetCover,
  onOpenMemory,
  onAddPhotos,
}: AlbumSpreadProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(group.title);
  const [showMenu, setShowMenu] = useState(false);

  const accent = GROUP_ACCENTS[group.accent];
  const cover = members.length > 0 ? members[0] : null;

  const commitTitle = () => {
    if (titleDraft.trim() && titleDraft !== group.title) {
      onUpdateGroup({ title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const dateRange = group.dateFrom && group.dateTo
    ? `${group.dateFrom} – ${group.dateTo}`
    : group.dateFrom || 'No dates';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
          aria-label="Back to albums"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {cover && (
          <img src={cover.url} alt="" className="w-10 h-10 rounded-md object-cover" />
        )}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(group.title); setEditingTitle(false); } }}
              className="w-full bg-transparent font-['Space_Grotesk'] text-[20px] font-semibold text-[var(--text-primary)] focus:outline-none border-b border-[var(--border-subtle)]"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="font-['Space_Grotesk'] text-[20px] font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:text-[var(--color-mem-400)]"
            >
              <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: accent }} />
              {group.title}
            </h1>
          )}
          <p className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-muted)]">
            {members.length} photo{members.length !== 1 ? 's' : ''} · {dateRange}
            {group.location && ` · ${group.location}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)] transition-colors"
            aria-label="More actions"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Menu */}
      {showMenu && (
        <div className="absolute right-4 top-16 z-40 min-w-44 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <button
            type="button"
            onClick={() => { setShowMenu(false); /* accent picker would go here */ }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--text-primary)] hover:bg-white/[0.06]"
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
            Change accent
          </button>
          <button
            type="button"
            onClick={() => { setShowMenu(false); onDeleteGroup(); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--color-mem-400)] hover:bg-white/[0.06]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete album
          </button>
        </div>
      )}

      {/* Hero row */}
      {members.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2 row-span-2">
            <MemoryTile
              item={members[0]}
              group={group}
              accentVar={accent}
              featured
              onOpen={() => onOpenMemory(members[0])}
              menuItems={[
                { label: 'Set as cover', icon: <Star className="w-3.5 h-3.5" />, onClick: () => onSetCover(members[0].meta.id) },
              ]}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-3">
            <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[var(--text-primary)] mb-1">
                {group.title}
              </p>
              <p className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-muted)]">
                {members.length} photo{members.length !== 1 ? 's' : ''} · {dateRange}
              </p>
              {group.location && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[11px] text-[var(--text-secondary)]">{group.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Member masonry */}
      {members.length > 0 ? (
        <MemoryMasonry
          items={members}
          groups={[group]}
          onOpen={onOpenMemory}
          menuFor={(item) => [
            { label: 'Set as cover', icon: <Star className="w-3.5 h-3.5" />, onClick: () => onSetCover(item.meta.id) },
            { label: 'Remove from album', icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => {}, destructive: true },
          ]}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-6 py-10 text-center">
          <p className="text-[13px] text-[var(--text-primary)]">No photos in this album yet</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Select photos in the All view, or drop files here.
          </p>
          <button
            type="button"
            onClick={onAddPhotos}
            className="mt-3 text-[11px] text-[var(--color-mem-400)] hover:underline"
          >
            Add photos
          </button>
        </div>
      )}
    </div>
  );
}