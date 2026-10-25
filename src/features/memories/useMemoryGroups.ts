import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LoadedMemory } from './useMemories';
import type { MemoryGroup, GroupSuggestion } from './types';
import { listGroups, saveGroup, removeGroup } from './groupsStore';
import { suggestGroups } from './smartGrouping';
import { nextAccent } from './accents';

const DISMISSED_KEY = 'memories.dismissed-suggestions';

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDismissed(keys: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

export function useMemoryGroups(items: LoadedMemory[]) {
  const [groups, setGroups] = useState<MemoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listGroups();
      setGroups(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Repair pass: items with groupId pointing to non-existent group → treat as ungrouped
  const validGroupIds = useMemo(() => new Set(groups.map(g => g.id)), [groups]);

  const createGroup = useCallback(async (init?: Partial<MemoryGroup>): Promise<MemoryGroup> => {
    const now = Date.now();
    const derivedDateFrom = init?.dateFrom;
    const order = derivedDateFrom
      ? -Math.floor(new Date(derivedDateFrom).getTime() / (1000 * 60 * 60 * 24))
      : -Math.floor(now / (1000 * 60 * 60 * 24));
    const group: MemoryGroup = {
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: init?.title || 'Untitled album',
      coverId: init?.coverId,
      accent: init?.accent || nextAccent(groups),
      dateFrom: init?.dateFrom,
      dateTo: init?.dateTo,
      location: init?.location,
      people: init?.people,
      order,
      createdAt: now,
      updatedAt: now,
    };
    await saveGroup(group);
    setGroups(prev => [...prev, group]);
    return group;
  }, [groups]);

  const updateGroup = useCallback(async (id: string, patch: Partial<MemoryGroup>): Promise<void> => {
    const existing = groups.find(g => g.id === id);
    if (!existing) return;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await saveGroup(updated);
    setGroups(prev => prev.map(g => (g.id === id ? updated : g)));
  }, [groups]);

  const deleteGroup = useCallback(async (id: string): Promise<void> => {
    // Clear members' groupId first, then delete group
    await removeGroup(id);
    setGroups(prev => prev.filter(g => g.id !== id));
  }, []);

  const setCover = useCallback(async (groupId: string, memoryId: string): Promise<void> => {
    await updateGroup(groupId, { coverId: memoryId });
  }, [updateGroup]);

  const moveMemories = useCallback(async (_ids: string[], _groupId: string | undefined): Promise<void> => {
    // Caller handles updateMemoryMeta for each id
  }, []);

  const albumCover = useCallback((groupId: string): LoadedMemory | undefined => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return undefined;
    if (group.coverId) {
      const found = items.find(m => m.meta.id === group.coverId);
      if (found) return found;
    }
    // fallback: earliest member
    const members = items.filter(m => m.meta.groupId === groupId);
    if (members.length === 0) return undefined;
    return members.sort((a, b) => (a.meta.date || '').localeCompare(b.meta.date || ''))[0];
  }, [groups, items]);

  const suggestions = useMemo(() => {
    const ungrouped = items.filter(m => !m.meta.groupId || !validGroupIds.has(m.meta.groupId));
    return suggestGroups(ungrouped.map(m => m.meta));
  }, [items, validGroupIds]);

  const acceptSuggestion = useCallback(async (s: GroupSuggestion): Promise<MemoryGroup> => {
    const group = await createGroup({
      title: s.title,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
      location: s.location,
      people: s.people,
    });
    // Assign members (caller handles updateMemoryMeta)
    (group as any)._pendingMemoryIds = s.memberIds;
    return group;
  }, [createGroup]);

  const dismissSuggestion = useCallback((key: string): void => {
    const newDismissed = [...dismissed, key];
    setDismissed(newDismissed);
    saveDismissed(newDismissed);
  }, [dismissed]);

  return {
    groups,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    setCover,
    moveMemories,
    albumCover,
    suggestions,
    acceptSuggestion,
    dismissSuggestion,
  };
}