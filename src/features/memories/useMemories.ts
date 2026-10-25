import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MemoryItem } from './types';
import { addMemory, listMemories, removeMemory, updateMemoryMeta } from './mediaStore';

export interface LoadedMemory {
  meta: MemoryItem;
  url: string;
}

export function useMemories() {
  const [items, setItems] = useState<LoadedMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listMemories();
    setItems(prev => {
      prev.forEach(p => URL.revokeObjectURL(p.url));
      return list.map(({ meta, blob }) => ({ meta, url: URL.createObjectURL(blob) }));
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      setItems(prev => { prev.forEach(p => URL.revokeObjectURL(p.url)); return prev; });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      await addMemory(file);
    }
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await removeMemory(id);
    await refresh();
  }, [refresh]);

  const updateMeta = useCallback(async (id: string, patch: Partial<MemoryItem>) => {
    await updateMemoryMeta(id, patch);
    await refresh();
  }, [refresh]);

  const onThisDay = useMemo(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return items.filter(i => {
      const [, m, d] = (i.meta.date || '').split('-');
      return m === mm && d === dd && i.meta.date !== now.toISOString().slice(0, 10);
    });
  }, [items]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, LoadedMemory[]>();
    for (const item of items) {
      const key = (item.meta.date || '').slice(0, 7) || 'Undated';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const tag of item.meta.tags || []) {
        if (tag.trim()) set.add(tag.trim());
      }
    }
    return [...set].sort();
  }, [items]);

  return { items, loading, upload, remove, updateMeta, onThisDay, groupedByMonth, refresh, allTags };
}
