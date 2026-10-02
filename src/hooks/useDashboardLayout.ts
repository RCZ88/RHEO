import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { ALL_WIDGET_IDS, OPT_IN_WIDGET_IDS, ROW_TEMPLATES, toDashboardId, type WidgetId } from '../components/dashboard/widgetRegistry';

// v3. v1 stored layouts made while the whole bottom of the dashboard was
// unconditionally visible; v2 fixed row-8 but still keyed off the stored
// `hidden` array, so any profile that had already stored a layout kept
// showing it. Both problems are the same mistake: making the DEFAULT the
// mechanism. Defaults only apply to a fresh profile, and this profile is not
// fresh. v3 keys off an explicit opt-in list instead, which cannot be
// bypassed by a stale `hidden` array.
const STORAGE_KEY = 'deskflow-dashboard-layout-v3';

/**
 * Widgets the user must explicitly switch on. Everything else shows by default.
 *
 * These are the two bottom rows (AI/console/finance/learn, and
 * browser/brain/covenant/health) plus the eight library-only widgets. None of
 * them are part of the core dashboard, and a dashboard that renders things you
 * did not ask for is a dashboard you cannot trust, so the safe state is the
 * only state until the user says otherwise.
 */
const OPT_IN_ONLY: Set<WidgetId> = new Set<WidgetId>([
  ...(ROW_TEMPLATES.find(r => r.key === 'row-8')?.cells.map(c => c.id) ?? []),
  ...(ROW_TEMPLATES.find(r => r.key === 'row-9')?.cells.map(c => c.id) ?? []),
  ...OPT_IN_WIDGET_IDS,
]);

export const isOptInOnly = (id: WidgetId): boolean => OPT_IN_ONLY.has(id);

interface StoredLayout {
  /** Opt-in widgets the user switched OFF again. */
  hidden: WidgetId[];
  /** Opt-in widgets the user explicitly switched ON. Only these are visible. */
  optedIn: WidgetId[];
  order: Record<string, WidgetId[]>;
}

function sanitize(raw: unknown): StoredLayout {
  const order: Record<string, WidgetId[]> = {};
  for (const row of ROW_TEMPLATES) order[row.key] = row.cells.map(c => c.id);

  try {
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Partial<StoredLayout>;
      const valid = new Set<string>(ALL_WIDGET_IDS);
      // Accept BOTH id schemes: a library id (momentum-hero) resolves to its
      // dashboard id (momentum); an id with no dashboard equivalent is dropped
      // rather than silently treated as a no-op that leaves the widget visible.
      const normalise = (ids: unknown): WidgetId[] =>
        Array.isArray(ids)
          ? Array.from(new Set(
              ids.map(id => toDashboardId(String(id))).filter((id): id is WidgetId => !!id)
            ))
          : [];

      // Seed `optedIn` from the stored `hidden` list on first migration only:
      // if a widget was NOT hidden before, the user had it switched on, and
      // silently dropping it would undo their choice. Anything hidden, or
      // absent, stays off.
      const hidden = normalise(r.hidden);
      const hasOptedInKey = Array.isArray((r as { optedIn?: unknown }).optedIn);
      const optedIn = hasOptedInKey
        ? normalise(r.optedIn)
        : normalise(r.hidden).length === 0
          ? normalise(r.hidden) // nothing hidden -> nothing to carry over
          : [];

      for (const row of ROW_TEMPLATES) {
        const saved = r.order?.[row.key];
        if (Array.isArray(saved) && saved.length === row.cells.length) {
          order[row.key] = saved.filter(id => valid.has(id));
          if (order[row.key].length !== row.cells.length) order[row.key] = row.cells.map(c => c.id);
        }
      }
      return { hidden, optedIn, order };
    }
  } catch { /* fall through to defaults */ }
  return { hidden: [], optedIn: [], order };
}

function defaultLayout(): StoredLayout {
  const order: Record<string, WidgetId[]> = {};
  for (const row of ROW_TEMPLATES) order[row.key] = row.cells.map(c => c.id);
  // Nothing is opted in, so every OPT_IN_ONLY widget is hidden. This is the
  // correct state regardless of what any previous version stored.
  return { hidden: [], optedIn: [], order };
}

function load(): StoredLayout {
  try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return defaultLayout(); }
}

// ── Shared store ────────────────────────────────────────────────────────────
//
// CardLibrary and DashboardPage each call this hook. With plain useState they
// got two INDEPENDENT copies of the layout: toggling a widget in the library
// updated the library's copy and wrote localStorage, but the dashboard's copy
// never re-read it — a `storage` event does not fire in the tab that made the
// change. So the dashboard kept rendering whatever it had captured at mount,
// which is why widgets you switched off came straight back and why opting in
// never appeared to take effect.
//
// One module-level store + useSyncExternalStore keeps every caller on the same
// live state, so a toggle is reflected immediately in both.
let store: StoredLayout | null = null;
const listeners = new Set<() => void>();

function getStore(): StoredLayout {
  if (!store) store = load();
  return store;
}

function setStore(next: StoredLayout) {
  store = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch { /* quota/private mode — non-fatal */ }
  listeners.forEach(l => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // Another tab (or an earlier hook instance from before this landed) may have
  // written the key since we last read it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) { store = null; cb(); }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

export function useDashboardLayout() {
  const layout = useSyncExternalStore(subscribe, getStore, getStore);
  const setLayout = useCallback((updater: (prev: StoredLayout) => StoredLayout) => setStore(updater(getStore())), []);

  const optedInSet = useMemo(() => new Set(layout.optedIn), [layout.optedIn]);
  const hiddenSet = useMemo(() => new Set(layout.hidden), [layout.hidden]);

  /**
   * An opt-in widget is visible ONLY while it is in `optedIn`. A missing or
   * stale `hidden` entry cannot surface it, which is the property the previous
   * design lacked and the reason the four bottom-row cards kept reappearing.
   */
  const isVisible = useCallback(
    (id: WidgetId) => (OPT_IN_ONLY.has(id) ? optedInSet.has(id) : !hiddenSet.has(id)),
    [optedInSet, hiddenSet],
  );

  const toggleVisible = useCallback((id: WidgetId) => {
    setLayout(prev => {
      if (OPT_IN_ONLY.has(id)) {
        const on = prev.optedIn.includes(id);
        return {
          ...prev,
          optedIn: on ? prev.optedIn.filter(x => x !== id) : [...prev.optedIn, id],
          hidden: on ? prev.hidden.filter(x => x !== id) : prev.hidden,
        };
      }
      return {
        ...prev,
        hidden: prev.hidden.includes(id) ? prev.hidden.filter(h => h !== id) : [...prev.hidden, id],
      };
    });
  }, []);

  const moveCell = useCallback((rowKey: string, index: number, dir: -1 | 1) => {
    setLayout(prev => {
      const row = prev.order[rowKey];
      const to = index + dir;
      if (!row || to < 0 || to >= row.length) return prev;
      const next = [...row];
      [next[index], next[to]] = [next[to], next[index]];
      return { ...prev, order: { ...prev.order, [rowKey]: next } };
    });
  }, []);

  const reset = useCallback(() => setLayout(() => defaultLayout()), []);

  const orderedRow = useCallback((rowKey: string): WidgetId[] => {
    const base = ROW_TEMPLATES.find(r => r.key === rowKey)!;
    return layout.order[rowKey] ?? base.cells.map(c => c.id);
  }, [layout.order]);

  const reorder = useCallback((rowKey: string, fromIndex: number, toIndex: number) => {
    setLayout(prev => {
      const row = prev.order[rowKey];
      if (!row || fromIndex < 0 || fromIndex >= row.length || toIndex < 0 || toIndex >= row.length) return prev;
      const next = [...row];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return { ...prev, order: { ...prev.order, [rowKey]: next } };
    });
  }, []);

  const hiddenCount = useMemo(
    () => ALL_WIDGET_IDS.filter(id => !isVisible(id)).length,
    [isVisible],
  );
  return { isVisible, toggleVisible, moveCell, reorder, reset, orderedRow, hiddenCount, allIds: ALL_WIDGET_IDS };
}
