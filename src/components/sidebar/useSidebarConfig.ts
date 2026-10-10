import { useSyncExternalStore } from 'react';
import { SIDEBAR_ITEMS } from './items';

/**
 * Sidebar grouping + orientation preferences.
 *
 * Design note: `SIDEBAR_ITEMS` stays the immutable item REGISTRY (it is also
 * consumed by App.tsx to resolve the active page). This config only regroups and
 * reorders what already exists — a user can rename a group, move a page into a
 * different group, reorder groups, or flip the rail. Pages are never removed,
 * because every entry is a live route that would otherwise become unreachable.
 *
 * This is a module-level store read through `useSyncExternalStore`, NOT component
 * state: both App.tsx (which needs `side` to flip the rail in the layout) and
 * Sidebar.tsx (which renders the groups) consume it, so two independent
 * useState copies would desync — a write from the rail would never reach the
 * layout.
 */

export type SidebarSide = 'left' | 'right' | 'top' | 'bottom';

/** left/right = vertical rail, top/bottom = horizontal bar. */
export type SidebarAxis = 'vertical' | 'horizontal';
export const axisFor = (s: SidebarSide): SidebarAxis =>
  s === 'top' || s === 'bottom' ? 'horizontal' : 'vertical';

export interface SidebarGroup {
  id: string;
  label: string;
}

export interface SidebarConfig {
  side: SidebarSide;
  groups: SidebarGroup[];
  /** item path -> group id */
  assignments: Record<string, string>;
}

const STORAGE_KEY = 'df-sidebar-config';

/** Default groups, derived from the module constants so first run looks identical. */
const DEFAULT_GROUPS: SidebarGroup[] = [
  { id: 'OVERVIEW', label: 'OVERVIEW' },
  { id: 'RECORD', label: 'RECORD' },
  { id: 'INTELLIGENCE', label: 'INTELLIGENCE' },
  { id: 'CREATE', label: 'CREATE' },
  { id: 'LIFE', label: 'LIFE' },
  { id: 'SYSTEM', label: 'SYSTEM' },
];

export const DEFAULT_CONFIG: SidebarConfig = {
  side: 'left',
  groups: DEFAULT_GROUPS,
  assignments: Object.fromEntries(SIDEBAR_ITEMS.map(i => [i.path, i.group])),
};

const isSide = (v: unknown): v is SidebarSide =>
  v === 'left' || v === 'right' || v === 'top' || v === 'bottom';

function sanitise(raw: unknown): SidebarConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;
  const candidate = raw as Partial<SidebarConfig>;

  // Groups: keep only well-formed entries.
  const groups: SidebarGroup[] = Array.isArray(candidate.groups)
    ? candidate.groups
        .filter((g): g is SidebarGroup => !!g && typeof g.id === 'string' && typeof g.label === 'string')
        .map(g => ({ id: g.id, label: g.label }))
    : DEFAULT_GROUPS;
  if (groups.length === 0) return DEFAULT_CONFIG;

  // An item whose group vanished falls back to its default group, then to the
  // first group — a page must never become unroutable.
  const validIds = new Set(groups.map(g => g.id));
  const fallbackId = groups[0].id;
  const assignments: Record<string, string> = {};
  const source = (candidate.assignments ?? {}) as Record<string, string>;
  for (const item of SIDEBAR_ITEMS) {
    const g = source[item.path];
    assignments[item.path] = validIds.has(g) ? g : (validIds.has(item.group) ? item.group : fallbackId);
  }

  return { side: isSide(candidate.side) ? candidate.side : 'left', groups, assignments };
}

function load(): SidebarConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return sanitise(JSON.parse(raw));
  } catch {
    return DEFAULT_CONFIG;
  }
}

// ── Store ──────────────────────────────────────────────────────────────
let snapshot: SidebarConfig = load();
const listeners = new Set<() => void>();

function commit(next: SidebarConfig) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — preferences simply do not persist */
  }
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const getSnapshot = () => snapshot;

function update(fn: (prev: SidebarConfig) => SidebarConfig) {
  const next = fn(snapshot);
  if (next !== snapshot) commit(next);
}

export function useSidebarConfig(): SidebarConfig {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const sidebarConfigActions = {
  setSide: (side: SidebarSide) => update(prev => (prev.side === side ? prev : { ...prev, side })),

  renameGroup: (id: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    update(prev => ({ ...prev, groups: prev.groups.map(g => (g.id === id ? { ...g, label: clean } : g)) }));
  },

  moveGroup: (id: string, delta: number) => update(prev => {
    const i = prev.groups.findIndex(g => g.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= prev.groups.length) return prev;
    const groups = [...prev.groups];
    [groups[i], groups[j]] = [groups[j], groups[i]];
    return { ...prev, groups };
  }),

  addGroup: () => update(prev => {
    let n = prev.groups.length + 1;
    let id = `CUSTOM-${n}`;
    while (prev.groups.some(g => g.id === id)) { n += 1; id = `CUSTOM-${n}`; }
    return { ...prev, groups: [...prev.groups, { id, label: `NEW GROUP ${n}` }] };
  }),

  removeGroup: (id: string) => update(prev => {
    if (prev.groups.length <= 1) return prev; // never leave zero groups
    const groups = prev.groups.filter(g => g.id !== id);
    const fallbackId = groups[0].id;
    // Orphaned items fall back to the first remaining group rather than vanish.
    const assignments = { ...prev.assignments };
    for (const item of SIDEBAR_ITEMS) {
      if (assignments[item.path] === id) assignments[item.path] = fallbackId;
    }
    return { ...prev, groups, assignments };
  }),

  assignItem: (path: string, groupId: string) =>
    update(prev => ({ ...prev, assignments: { ...prev.assignments, [path]: groupId } })),

  reset: () => commit(DEFAULT_CONFIG),
};