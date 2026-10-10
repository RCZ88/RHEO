/**
 * Selection model for the source browser.
 *
 * Deliberately a PURE reducer with no DOM access: the awkward part of a
 * multi-select list is not the rendering, it is what Shift+Down does after a
 * click, and that is exactly what you cannot eyeball. This way the whole
 * keyboard contract is unit-testable.
 */

export interface SelectState {
  /** Ids currently selected, in selection order. */
  selected: string[];
  /** Highlighted row index in the *visible* (filtered, grouped) list. */
  cursor: number;
  /** Id the next plain toggle extends/removes from, for Shift ranges. */
  anchor: string | null;
  /** Most recent single click, used by Shift. */
  lastAnchor: string | null;
  /**
   * The ids contributed by the most recent Shift-extension.
   *
   * Tracked separately because a Shift-range must REPLACE the previous range.
   * Without this, extending is purely additive: dragging 1→4 then 1→2 leaves
   * rows 3 and 4 selected, which is not what Shift-click means anywhere else.
   */
  lastRange: string[];
}

export const initialSelectState: SelectState = { selected: [], cursor: 0, anchor: null, lastAnchor: null, lastRange: [] };

export interface RowRef {
  id: string;
}

function indexOfId(rows: RowRef[], id: string | null): number {
  if (id == null) return -1;
  return rows.findIndex(r => r.id === id);
}

/** Add if absent, remove if present — and it is the same call either way. */
export function toggle(state: SelectState, rows: RowRef[], id: string, mode: 'replace' | 'add' | 'toggle'): SelectState {
  // Any plain click starts a fresh selection, so a stale Shift range is dropped.
  if (mode === 'replace') {
    return { selected: [id], cursor: indexOfId(rows, id), anchor: id, lastAnchor: id, lastRange: [] };
  }
  if (mode === 'add') {
    if (state.selected.includes(id)) return state;
    return { ...state, selected: [...state.selected, id], lastAnchor: id, anchor: id, lastRange: [] };
  }
  const has = state.selected.includes(id);
  return {
    ...state,
    selected: has ? state.selected.filter(s => s !== id) : [...state.selected, id],
    lastAnchor: id,
    anchor: id,
    lastRange: [],
  };
}

/**
 * Shift-click / Shift+Arrow: extend a contiguous RANGE from the anchor.
 *
 * Range is computed against the VISIBLE list, so a filtered view extends over
 * what the user can actually see rather than jumping to a hidden row. The anchor
 * does NOT move during an extension, so holding Shift and pressing Down
 * repeatedly grows one range instead of collapsing to a single row.
 *
 * The new span REPLACES the previous span (see `lastRange`) while leaving rows
 * that were picked by other clicks alone.
 */
export function extendRange(state: SelectState, rows: RowRef[], id: string): SelectState {
  const from = indexOfId(rows, state.lastAnchor ?? state.anchor);
  const to = indexOfId(rows, id);
  if (from < 0 || to < 0) return toggle(state, rows, id, 'replace');
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const span = rows.slice(lo, hi + 1).map(r => r.id);
  const survivors = state.selected.filter(s => !state.lastRange.includes(s));
  const merged = Array.from(new Set([...survivors, ...span]));
  return { ...state, selected: merged, cursor: to, lastRange: span };
}

export function moveCursor(state: SelectState, rows: RowRef[], delta: number, extend: boolean): SelectState {
  if (!rows.length) return state;
  const next = Math.max(0, Math.min(rows.length - 1, state.cursor + delta));
  const row = rows[next];
  if (extend) return extendRange(state, rows, row.id);
  return { ...state, cursor: next, anchor: row.id, lastAnchor: row.id };
}

/** Ctrl/Cmd+A — select everything visible, replacing the selection. */
export function selectAll(state: SelectState, rows: RowRef[]): SelectState {
  return { ...state, selected: rows.map(r => r.id), cursor: 0, lastRange: [] };
}

export function clearSelection(state: SelectState): SelectState {
  return { ...state, selected: [], anchor: null, lastAnchor: null, lastRange: [] };
}

export function removeSelected(state: SelectState, id: string): SelectState {
  return {
    ...state,
    selected: state.selected.filter(s => s !== id),
    lastRange: state.lastRange.filter(s => s !== id),
  };
}

/** Move a selected item within the tray; ordering is the composed order. */
export function moveInList(ids: string[], id: string, delta: number): string[] {
  const i = ids.indexOf(id);
  if (i < 0) return ids;
  const j = Math.max(0, Math.min(ids.length - 1, i + delta));
  if (i === j) return ids;
  const next = [...ids];
  next.splice(j, 0, next.splice(i, 1)[0]);
  return next;
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: '/', action: 'Focus search' },
  { keys: '↑ ↓', action: 'Move the highlight' },
  { keys: 'Space', action: 'Add / remove the highlighted source' },
  { keys: 'Shift + ↑ ↓', action: 'Extend selection by range' },
  { keys: 'Shift + Space', action: 'Select a range from the last click' },
  { keys: 'Ctrl / ⌘ + A', action: 'Select everything visible' },
  { keys: 'Esc', action: 'Clear the selection' },
  { keys: 'Alt + ↑ ↓', action: 'Reorder inside the tray' },
  { keys: 'Enter', action: 'Copy the composed prompt' },
  { keys: '?', action: 'Show or hide this help' },
];