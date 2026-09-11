import { useCallback, useEffect, useState } from 'react';

export interface FocusGroup {
  id: number;
  name: string;
  description: string | null;
  allowed_apps: string[];
  allowed_domains: string[];
  allowed_categories: string[];
  strictness: 'distracting' | 'non_allowed';
  default_duration: number | null;
  daily_goal_sec: number | null;
  goal_category: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupDraft {
  id?: number;
  name: string;
  description?: string | null;
  allowed_apps?: string[];
  allowed_domains?: string[];
  allowed_categories?: string[];
  strictness?: 'distracting' | 'non_allowed';
  default_duration?: number | null;
  daily_goal_sec?: number | null;
  goal_category?: string | null;
}

function getApi() {
  return (window as any).deskflowAPI?.focusGroup as any;
}

// Shared module-level selection — survives component remounts and is visible
// to every consumer (FocusSection, DailyPlannerCard, ...) at once.
let sharedSelectedId: number | null = null;
const selectionListeners = new Set<() => void>();

function setSharedSelectedId(id: number | null) {
  sharedSelectedId = id;
  selectionListeners.forEach(l => l());
}

export function useFocusGroups() {
  const [groups, setGroups] = useState<FocusGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedIdState] = useState<number | null>(sharedSelectedId);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);
  const isSelected = useCallback((id: number) => selectedIds.includes(id), [selectedIds]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  useEffect(() => {
    const l = () => setSelectedIdState(sharedSelectedId);
    selectionListeners.add(l);
    return () => { selectionListeners.delete(l); };
  }, []);

  const setSelectedId = useCallback((id: number | null) => {
    setSharedSelectedId(id);
    setSelectedIdState(id);
  }, []);

  const refresh = useCallback(async () => {
    const api = getApi();
    if (!api) {
      setLoading(false);
      return;
    }
    try {
      const rows = await api.list();
      setGroups(Array.isArray(rows) ? rows : []);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (draft: GroupDraft): Promise<number | null> => {
      const api = getApi();
      if (!api) return null;
      try {
        const res = await api.save(draft);
        if (res?.success === false) {
          setError(res.error || 'Failed to save group');
          return null;
        }
        await refresh();
        return res?.id ?? null;
      } catch (e: any) {
        setError(String(e?.message ?? e));
        return null;
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: number): Promise<boolean> => {
      const api = getApi();
      if (!api) return false;
      try {
        const res = await api.remove(id);
        await refresh();
        return res?.success !== false;
      } catch (e: any) {
        setError(String(e?.message ?? e));
        return false;
      }
    },
    [refresh],
  );

  const startWith = useCallback(
    async (id: number, durationSec?: number, strictness?: 'distracting' | 'non_allowed'): Promise<any> => {
      const api = getApi();
      if (!api) return { success: false, error: 'API unavailable' };
      try {
        return (await api.startWith(id, durationSec, strictness)) ?? { success: false };
      } catch (e: any) {
        return { success: false, error: String(e?.message ?? e) };
      }
    },
    [],
  );

  const selected = groups.find(g => g.id === selectedId) ?? null;

  return { groups, loading, error, refresh, save, remove, startWith, selected, selectedId, setSelectedId, selectedIds, toggleSelect, isSelected, clearSelection };
}
