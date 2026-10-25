import { motion } from 'framer-motion';
import { MapPin, ImageOff, Plus } from 'lucide-react';
import type { LoadedMemory } from './useMemories';
import type { MemoryGroup } from './types';
import { GROUP_ACCENTS } from './accents';

interface AlbumCardProps {
  group: MemoryGroup;
  members: LoadedMemory[];
  onOpen: () => void;
  onNew?: () => void;
  isNew?: boolean;
  isUngrouped?: boolean;
}

const hoverAnimate = { y: -2, scale: 1.012 };
const hoverTransition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

export function AlbumCard({ group, members, onOpen, isNew, isUngrouped }: AlbumCardProps) {
  const accent = GROUP_ACCENTS[group.accent];
  const cover = members.length > 0 ? members[0] : null;
  const count = members.length;
  const videoCount = members.filter(m => m.meta.kind === 'video').length;
  const photoCount = count - videoCount;
  const dateRange = group.dateFrom && group.dateTo
    ? `${group.dateFrom.slice(5).replace('-', '/')} – ${group.dateTo.slice(5).replace('-', '/')}`
    : group.dateFrom
      ? group.dateFrom.slice(5).replace('-', '/')
      : '';

  if (isNew) {
    return (
      <motion.button
        whileHover={hoverAnimate}
        transition={hoverTransition}
        onClick={onOpen}
        className="flex flex-col items-center justify-center aspect-[4/3] rounded-xl border border-dashed border-[var(--border-strong)] bg-transparent text-[var(--text-muted)] hover:border-[var(--color-mem-400)]/40 hover:text-[var(--color-mem-400)] transition-colors"
      >
        <Plus className="w-5 h-5 mb-1" />
        <span className="text-[13px]">New album</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={hoverAnimate}
      transition={hoverTransition}
      onClick={onOpen}
      className="relative block w-full text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 transition-shadow hover:shadow-[0_0_0_1px_var(--border-strong)]"
    >
      {/* Cover stack */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
        {members.length >= 3 && (
          <>
            <div className="absolute inset-x-2 top-1 h-full rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] -rotate-3" />
            <div className="absolute inset-x-2 top-1 h-full rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] rotate-2" />
          </>
        )}
        {cover ? (
          <img
            src={cover.url}
            alt={group.title}
            className="relative z-10 h-full w-full rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="relative z-10 flex h-full w-full items-center justify-center rounded-lg bg-[var(--bg-raised)]">
            <ImageOff className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="ml-1 text-[10px] text-[var(--text-muted)]">Empty</span>
          </div>
        )}
      </div>

      {/* Title row */}
      <div className="mt-3 flex items-center gap-1.5">
        {!isUngrouped && <span className="h-2 w-0.5 rounded-full" style={{ backgroundColor: accent }} />}
        <h3 className="truncate font-['Space_Grotesk'] text-[14px] font-semibold leading-tight text-[var(--text-primary)]">
          {group.title}
        </h3>
      </div>

      {/* Meta */}
      <p className="mt-1 font-['JetBrains_Mono'] text-[11px] font-medium text-[var(--text-muted)]">
        {photoCount > 0 && `${photoCount} photo${photoCount !== 1 ? 's' : ''}`}
        {photoCount > 0 && videoCount > 0 && ' · '}
        {videoCount > 0 && `${videoCount} video${videoCount !== 1 ? 's' : ''}`}
        {count === 0 && 'Empty'}
        {dateRange && ` · ${dateRange}`}
      </p>

      {/* Location */}
      {group.location && (
        <div className="mt-0.5 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[11px] text-[var(--text-secondary)] truncate">{group.location}</span>
        </div>
      )}
    </motion.button>
  );
}