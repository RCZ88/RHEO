import { useRef, useState, useEffect } from 'react';
import type { LoadedMemory } from './useMemories';
import type { MemoryGroup } from './types';
import { MemoryTile } from './MemoryTile';
import { GROUP_ACCENTS } from './accents';
import { useMasonryColumns } from './useMasonryColumns';

interface MemoryMasonryProps {
  items: LoadedMemory[];
  groups: MemoryGroup[];
  featured?: (item: LoadedMemory) => boolean;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onOpen: (item: LoadedMemory) => void;
  menuFor?: (item: LoadedMemory) => { label: string; icon?: React.ReactNode; onClick: () => void; destructive?: boolean }[];
}

export function MemoryMasonry({
  items,
  groups,
  featured,
  selectable = false,
  selected = new Set(),
  onToggleSelect,
  onOpen,
  menuFor,
}: MemoryMasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w < 640) setColumns(2);
      else if (w < 1080) setColumns(3);
      else if (w < 1560) setColumns(4);
      else setColumns(5);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const groupMap = new Map(groups.map(g => [g.id, g]));

  const cols = useMasonryColumns(items, (item) => {
    const w = item.meta.width || 4;
    const h = item.meta.height || 3;
    return w / h;
  }, columns);

  return (
    <div ref={containerRef} className="flex gap-3">
      {cols.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
          {col.map((item) => {
            const isFeatured = featured ? featured(item) : false;
            const group = item.meta.groupId ? groupMap.get(item.meta.groupId) : undefined;
            const accentVar = group ? GROUP_ACCENTS[group.accent] : undefined;
            return (
              <MemoryTile
                key={item.meta.id}
                item={item}
                group={group}
                accentVar={accentVar}
                featured={isFeatured}
                selected={selected.has(item.meta.id)}
                selectable={selectable}
                onOpen={() => onOpen(item)}
                onToggleSelect={() => onToggleSelect?.(item.meta.id)}
                menuItems={menuFor ? menuFor(item) : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}