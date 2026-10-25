import { useMemo } from 'react';
import type { LoadedMemory } from './useMemories';
import type { MemoryGroup } from './types';
import { GROUP_ACCENTS } from './accents';
import { MemoryMasonry } from './MemoryMasonry';

interface AllPhotosViewProps {
  items: LoadedMemory[];
  groups: MemoryGroup[];
  sort: 'captured' | 'added';
  filterPerson: string | null;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onOpen: (item: LoadedMemory) => void;
}

export function AllPhotosView({
  items,
  groups,
  sort,
  filterPerson,
  selectable = false,
  selected = new Set(),
  onToggleSelect,
  onOpen,
}: AllPhotosViewProps) {
  const sorted = useMemo(() => {
    const arr = filterPerson ? items.filter(m => m.meta.people.includes(filterPerson)) : [...items];
    arr.sort(sort === 'captured'
      ? (x, y) => (y.meta.date || '').localeCompare(x.meta.date || '')
      : (x, y) => (y.meta.createdAt || 0) - (x.meta.createdAt || 0));
    return arr;
  }, [items, filterPerson, sort]);

  const groupMap = new Map(groups.map(g => [g.id, g]));

  // Build sections: group headers + items
  const sections: { header: string; accent?: string; items: LoadedMemory[]; isGroup: boolean }[] = [];
  let currentGroupId: string | null = null;
  let currentItems: LoadedMemory[] = [];

  for (const item of sorted) {
    const gid = item.meta.groupId && groupMap.has(item.meta.groupId) ? item.meta.groupId : null;
    if (gid !== currentGroupId) {
      if (currentItems.length > 0) {
        const g = currentGroupId ? groupMap.get(currentGroupId) : null;
        sections.push({
          header: g ? g.title : 'Ungrouped',
          accent: g ? g.accent : undefined,
          items: currentItems,
          isGroup: !!g,
        });
      }
      currentGroupId = gid;
      currentItems = [item];
    } else {
      currentItems.push(item);
    }
  }
  if (currentItems.length > 0) {
    const g = currentGroupId ? groupMap.get(currentGroupId) : null;
    sections.push({
      header: g ? g.title : 'Ungrouped',
      accent: g ? g.accent : undefined,
      items: currentItems,
      isGroup: !!g,
    });
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] px-6 py-10 text-center">
        <p className="text-[13px] text-[var(--text-primary)]">No memories found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section, si) => (
        <div key={si}>
          <div className="flex items-center gap-2 mb-3">
            {section.isGroup && section.accent && (
              <span className="h-3 w-1 rounded-full" style={{ backgroundColor: GROUP_ACCENTS[section.accent as keyof typeof GROUP_ACCENTS] }} />
            )}
            <h3 className={`text-[16px] font-['Space_Grotesk'] font-semibold ${section.isGroup ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] uppercase tracking-wide text-[11px]'}`}>
              {section.header}
            </h3>
            <span className="font-['JetBrains_Mono'] text-[11px] text-[var(--text-muted)]">
              · {section.items.length} photo{section.items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <MemoryMasonry
            items={section.items}
            groups={groups}
            selectable={selectable}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onOpen={onOpen}
          />
        </div>
      ))}
    </div>
  );
}