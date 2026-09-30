import { useCallback, useEffect, useMemo, useState } from 'react';
import { ALL_WIDGET_IDS, OPT_IN_WIDGET_IDS, ROW_TEMPLATES, toDashboardId, type WidgetId } from '../components/dashboard/widgetRegistry';

// v2: the v1 key stored layouts produced while row-8 and the library-only
// widgets were wrongly visible. Starting clean is the only way to guarantee the
// dashboard shows exactly what was opted into.
const STORAGE_KEY = 'deskflow-dashboard-layout-v2';

interface StoredLayout { hidden: WidgetId[]; order: Record<string, WidgetId[]> }

function sanitize(raw: unknown): StoredLayout {
  try {
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Partial<StoredLayout>;
      const valid = new Set<string>(ALL_WIDGET_IDS);
      // Accept BOTH id schemes: a library id (momentum-hero) resolves to its
      // dashboard id (momentum); an id with no dashboard equivalent is dropped
      // rather than silently treated as a no-op that leaves the widget visible.
      const hidden = Array.isArray(r.hidden)
        ? Array.from(new Set(
            r.hidden.map(id => toDashboardId(String(id))).filter((id): id is WidgetId => !!id)
          ))
        : [];
      const order: Record<string, WidgetId[]> = {};
      for (const row of ROW_TEMPLATES) {
        const saved = r.order?.[row.key];
        if (Array.isArray(saved) && saved.length === row.cells.length) {
          order[row.key] = saved.filter(id => valid.has(id));
          if (order[row.key].length !== row.cells.length) order[row.key] = row.cells.map(c => c.id);
        } else {
          order[row.key] = row.cells.map(c => c.id);
        }
      }
      // BUG FIX: row-8 widgets used to be force-pushed into `hidden` on EVERY
      // load, which made the layout editor's toggles for ai-usage /
      // console-widget / finance-widget / learn-widget permanently
      // non-functional — the user's choice was reverted on every mount.
      // The row-8 default is now applied ONLY for a fresh profile (no stored
      // layout at all), via defaultLayout(). A user's explicit choice is
      // always respected from here on.
      return { hidden, order };
    }
  } catch { /* fall through to defaults */ }
  return defaultLayout();
}

function defaultLayout(): StoredLayout {
  const order: Record<string, WidgetId[]> = {};
  for (const row of ROW_TEMPLATES) order[row.key] = row.cells.map(c => c.id);

  // Row 8 (ai-usage, console, finance, learn) is opt-in: those four are extra
  // instrumentation panels, not the core dashboard. They must be HIDDEN unless
  // the user asks for them.
  const row8 = new Set<WidgetId>(
    ROW_TEMPLATES.find(r => r.key === 'row-8')?.cells.map(c => c.id) ?? []
  );
  // Library-only widgets are never placed by default either — the dashboard must
  // not show anything the user has not switched on themselves.
  const hidden: WidgetId[] = [
    ...row8,
    ...OPT_IN_WIDGET_IDS,
  ];
  return { hidden, order };
}

function load(): StoredLayout {
  try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return defaultLayout(); }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<StoredLayout>(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }
    catch { /* quota/private mode — non-fatal */ }
  }, [layout]);

  const hiddenSet = useMemo(() => new Set(layout.hidden), [layout.hidden]);
  const isVisible = useCallback((id: WidgetId) => !hiddenSet.has(id), [hiddenSet]);

  const toggleVisible = useCallback((id: WidgetId) => {
    setLayout(prev => ({
      ...prev,
      hidden: prev.hidden.includes(id) ? prev.hidden.filter(h => h !== id) : [...prev.hidden, id],
    }));
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

  const reset = useCallback(() => setLayout(defaultLayout()), []);

  const orderedRow = useCallback((rowKey: string): WidgetId[] => {
    const base = ROW_TEMPLATES.find(r => r.key === rowKey)!;
    const order = layout.order[rowKey] ?? base.cells.map(c => c.id);
    return order;
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

  const hiddenCount = layout.hidden.length;
  return { isVisible, toggleVisible, moveCell, reorder, reset, orderedRow, hiddenCount, allIds: ALL_WIDGET_IDS };
}
