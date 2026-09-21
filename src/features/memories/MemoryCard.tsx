import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle } from 'lucide-react';
import type { LoadedMemory } from './useMemories';
import { captureVideoThumbnail } from './videoThumbnail';

interface MemoryCardProps {
  memory: LoadedMemory;
  onOpen: () => void;
  span?: 'sm' | 'lg';
  idPrefix?: string;
}

const hoverAnimate = { y: -3, scale: 1.015 };
const hoverTransition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

export function MemoryCard({ memory, onOpen, span = 'sm', idPrefix }: MemoryCardProps) {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (memory.meta.kind === 'video') {
      fetch(memory.url).then(r => r.blob()).then(captureVideoThumbnail).then(p => { if (!cancelled) setPoster(p); });
    }
    return () => { cancelled = true; };
  }, [memory.url, memory.meta.kind]);

  return (
    <motion.button
      layoutId={`${idPrefix ? `${idPrefix}-` : ''}memory-${memory.meta.id}`}
      onClick={onOpen}
      whileHover={hoverAnimate}
      transition={hoverTransition}
      className={`relative block w-full overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/40 text-left ${
        span === 'lg' ? 'row-span-2 aspect-[3/4]' : 'aspect-square'
      }`}
    >
      {memory.meta.kind === 'video' ? (
        <>
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
            <PlayCircle className="w-8 h-8 text-white/90 drop-shadow" />
          </div>
        </>
      ) : (
        <img src={memory.url} alt={memory.meta.caption || ''} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
        {memory.meta.caption && <p className="text-[11px] text-white/90 truncate">{memory.meta.caption}</p>}
      </div>
    </motion.button>
  );
}
