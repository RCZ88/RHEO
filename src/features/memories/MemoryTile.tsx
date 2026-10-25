import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, MapPin, Check, MoreHorizontal } from 'lucide-react';
import type { LoadedMemory } from './useMemories';
import type { MemoryGroup } from './types';
import { GROUP_ACCENTS } from './accents';
import { captureVideoThumbnail } from './videoThumbnail';

interface MemoryTileProps {
  item: LoadedMemory;
  group?: MemoryGroup;
  accentVar?: string;
  featured?: boolean;
  selected?: boolean;
  selectable?: boolean;
  onOpen: () => void;
  onToggleSelect?: () => void;
  menuItems?: { label: string; icon?: React.ReactNode; onClick: () => void; destructive?: boolean }[];
}

const hoverAnimate = { y: -2, scale: 1.012 };
const hoverTransition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

export function MemoryTile({
  item,
  group,
  accentVar,
  featured = false,
  selected = false,
  selectable = false,
  onOpen,
  onToggleSelect,
  menuItems,
}: MemoryTileProps) {
  const [poster, setPoster] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (item.meta.kind === 'video') {
      fetch(item.url).then(r => r.blob()).then(captureVideoThumbnail).then(p => { if (!cancelled) setPoster(p); });
    }
    return () => { cancelled = true; };
  }, [item.url, item.meta.kind]);

  const { meta } = item;
  const dateStr = (meta.date || '').slice(0, 10);
  const dateLabel = dateStr ? dateStr : '';
  const timeLabel = meta.durationSec ? ` · ${Math.floor(meta.durationSec / 60)}:${String(meta.durationSec % 60).padStart(2, '0')}` : '';
  const caption = meta.title || meta.caption;
  const people = meta.people || [];
  const location = meta.location;
  const accent = accentVar || (group ? GROUP_ACCENTS[group.accent] : undefined);

  const aspectRatio = meta.width && meta.height ? `${meta.width}/${meta.height}` : '4/3';

  return (
    <motion.button
      onClick={selectable ? onToggleSelect : onOpen}
      whileHover={hoverAnimate}
      transition={hoverTransition}
      className="relative block w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-left group"
      style={accent ? { boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 15%, transparent)` } : undefined}
    >
      <div style={{ aspectRatio }} className="relative overflow-hidden">
        {item.meta.kind === 'video' ? (
          <>
            {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60">
              <PlayCircle className="w-8 h-8 text-white/90 drop-shadow" />
            </div>
          </>
        ) : (
          <img src={item.url} alt={caption || ''} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}

        {/* Date badge — always visible */}
        {dateLabel && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-white/92">
            {dateLabel}{timeLabel}
          </span>
        )}

        {/* Location chip — always visible if set */}
        {location && (
          <span className="absolute bottom-1.5 right-1.5 flex max-w-[45%] items-center gap-0.5 rounded bg-black/60 px-1.5 py-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0 text-zinc-400" />
            <span className="text-[10px] leading-none text-zinc-300 truncate">{location}</span>
          </span>
        )}

        {/* People chips — hover only */}
        {people.length > 0 && (
          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-180 group-hover:opacity-100 group-focus-visible:opacity-100">
            {people.slice(0, 3).map(p => (
              <span key={p} className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-strong)] bg-black/60 text-[8px] font-semibold text-white/90">
                {p.charAt(0).toUpperCase()}
              </span>
            ))}
            {people.length > 3 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-strong)] bg-black/60 text-[8px] font-semibold text-white/90">
                +{people.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Caption scrim — hover only, always for featured */}
        {(caption || featured) && (
          <div className={`absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6 bg-gradient-to-t from-black/72 to-transparent transition-opacity duration-180 ${featured ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
            {caption && <p className="text-[11px] leading-snug text-white/95 line-clamp-2">{caption}</p>}
          </div>
        )}

        {/* Selection checkbox */}
        {selectable && (
          <div className={`absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded border transition-colors ${selected ? 'bg-[var(--color-mem-400)] border-transparent' : 'border-[var(--border-strong)] bg-black/60'}`}>
            {selected && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
        )}

        {/* Tile menu */}
        {!selectable && menuItems && menuItems.length > 0 && (
          <div className="absolute left-1.5 top-1.5 opacity-0 transition-opacity duration-180 group-hover:opacity-100 group-focus-visible:opacity-100">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="flex h-5 w-5 items-center justify-center rounded bg-black/60 text-zinc-400 hover:text-white"
              aria-label="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-6 z-40 min-w-40 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                {menuItems.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); item.onClick(); }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-white/[0.06] ${item.destructive ? 'text-[var(--color-mem-400)]' : 'text-[var(--text-primary)]'}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
}