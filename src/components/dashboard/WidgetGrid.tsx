// ============================================================
// RHEO Dashboard — WidgetGrid (Dynamic Layout Engine)
// Status strip (current config) · Save/Cancel edit flow ·
// Named layout presets (preference store + localStorage fallback).
// LAMINAR: CSS Grid only, tween easing, token colors, lucide only.
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import {
  Columns3, Rows3, Plus, Settings2, Box, Check, X, Save,
  LayoutDashboard, ChevronDown, Trash2, RotateCcw, Eye, ArrowUpRight,
  Activity, Calendar, Sparkles, Target, AlertCircle, Zap, BarChart3,
  Pin, Moon, Brain, Orbit, Clock, Flame, ArrowRight, CalendarDays,
  Split, ChevronUp, Grid3X3,
} from 'lucide-react';
import {
  WidgetRegistry,
  DEFAULT_LAYOUT,
} from './WidgetRegistry';
import type { DashboardLayoutConfig } from './WidgetRegistry';
import { WidgetCard } from './WidgetCard';
import { DashboardDataProvider } from './DashboardContext';
import type { DashboardData } from './DashboardContext';
import { getWidgetTheme } from './widgetTheme';
import './registerWidgets';
import './layout-editor.css';

const RATIO_PRESETS = ['1:1', '2:1', '1:2', '2:3', '3:2', '1:3', '3:1'];

/** Map lucide icon names to components */
const ICON_MAP: Record<string, any> = {
  Activity, Calendar, Sparkles, Target, AlertCircle, Zap, BarChart3,
  Pin, Moon, Brain, Orbit, Clock, Flame, ArrowRight, CalendarDays, Box,
};

function getIcon(name: string): any {
  return ICON_MAP[name] || Box;
}

// ── Persistence ──
// Preference store is the source of truth (audit W-3); localStorage is the
// fallback when the Electron bridge is absent (browser/dev).

const LAYOUT_KEY = 'dashboard_layout';
const PRESETS_KEY = 'dashboard_widget_presets';

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full — silent fail
  }
}

async function loadStoredLayout(): Promise<DashboardLayoutConfig> {
  try {
    const api = (window as any).deskflowAPI;
    if (api?.getPreferences) {
      const prefs = await api.getPreferences();
      const stored = prefs?.[LAYOUT_KEY];
      if (stored?.schemaVersion === DEFAULT_LAYOUT.schemaVersion) return stored;
    }
  } catch {
    // Fall through to localStorage
  }
  return readLocal<DashboardLayoutConfig>(LAYOUT_KEY) ?? DEFAULT_LAYOUT;
}

async function persistLayout(layout: DashboardLayoutConfig): Promise<void> {
  writeLocal(LAYOUT_KEY, layout);
  try {
    await (window as any).deskflowAPI?.setPreference?.(LAYOUT_KEY, layout);
  } catch {
    // Bridge absent — localStorage already written
  }
}

// ── Named presets ──

export interface LayoutPreset {
  id: string;
  name: string;
  layout: DashboardLayoutConfig;
  updatedAt: number;
}

const BUILT_IN_PRESET: LayoutPreset = {
  id: 'default',
  name: 'Default deck',
  layout: DEFAULT_LAYOUT,
  updatedAt: 0,
};

async function loadPresets(): Promise<LayoutPreset[]> {
  try {
    const api = (window as any).deskflowAPI;
    if (api?.getPreferences) {
      const prefs = await api.getPreferences();
      const stored = prefs?.[PRESETS_KEY];
      if (Array.isArray(stored)) return [BUILT_IN_PRESET, ...stored];
    }
  } catch {
    // Fall through
  }
  const local = readLocal<LayoutPreset[]>(PRESETS_KEY);
  return [BUILT_IN_PRESET, ...(local ?? [])];
}

async function persistPresets(presets: LayoutPreset[]): Promise<void> {
  const user = presets.filter(p => p.id !== 'default');
  writeLocal(PRESETS_KEY, user);
  try {
    await (window as any).deskflowAPI?.setPreference?.(PRESETS_KEY, user);
  } catch {
    // Bridge absent — localStorage already written
  }
}

export interface WidgetGridProps {
  forceEditMode?: boolean;
  data: DashboardData;
  onSaved?: () => void;
}

/**
 * Dynamic widget grid: status strip, edit mode with Save/Cancel,
 * named layout presets, drag-to-reorder, column control.
 */
export function WidgetGrid({ forceEditMode = false, data, onSaved }: WidgetGridProps) {
  const [layout, setLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [presets, setPresets] = useState<LayoutPreset[]>([BUILT_IN_PRESET]);
  const [activePresetId, setActivePresetId] = useState<string>('default');
  const [editMode, setEditMode] = useState(forceEditMode);
  const [showAddPanel, setShowAddPanel] = useState(false);
   const [previewMode, setPreviewMode] = useState(false);
   const [showPresets, setShowPresets] = useState(false);
   const [presetName, setPresetName] = useState('');
   const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
   const [draggedId, setDraggedId] = useState<string | null>(null);
   const [resizing, setResizing] = useState<{ id: string; edge: string; startX: number; startY: number; colSpan: number; rowSpan: number; col: number; row: number } | null>(null);
   const [splitWidget, setSplitWidget] = useState<string | null>(null);
   const gridRef = useRef<HTMLDivElement>(null);
   const editSnapshot = useRef<DashboardLayoutConfig>(DEFAULT_LAYOUT);

  // Load persisted layout + presets once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedLayout, storedPresets] = await Promise.all([loadStoredLayout(), loadPresets()]);
      if (cancelled) return;
      setLayout(storedLayout);
      setSavedLayout(storedLayout);
      setPresets(storedPresets.length > 0 ? storedPresets : [BUILT_IN_PRESET]);
      // Match loaded layout to a preset when possible
      const match = storedPresets.find(
        p => JSON.stringify(p.layout) === JSON.stringify(storedLayout),
      );
      setActivePresetId(match?.id ?? 'custom');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);

  // ── Edit flow: snapshot on enter, Save persists, Cancel restores ──

  const enterEditMode = useCallback(() => {
    editSnapshot.current = layout;
    setShowAddPanel(false);
    setEditMode(true);
  }, [layout]);

  const cancelEdit = useCallback(() => {
    setLayout(editSnapshot.current);
    setShowAddPanel(false);
    setShowPresets(false);
    setEditMode(false);
  }, []);

  const saveEdit = useCallback(async () => {
    setSavedLayout(layout);
    const match = presets.find(p => JSON.stringify(p.layout) === JSON.stringify(layout));
    setActivePresetId(match?.id ?? 'custom');
    setShowAddPanel(false);
    setShowPresets(false);
    setEditMode(false);
    await persistLayout(layout);
    onSaved?.();
  }, [layout, presets, onSaved]);

  // Esc cancels edit mode (forgiveness — humancentred-UIUX pillar 6)
  useEffect(() => {
    if (!editMode && !splitWidget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (splitWidget) setSplitWidget(null);
        else cancelEdit();
      }
      if (!editMode) return;
      const focused = document.activeElement;
      if (!focused?.closest?.('.layout-widget')) return;
      const widgetId = focused.closest('.layout-widget')?.getAttribute('data-widget-id');
      if (!widgetId) return;
      const step = e.shiftKey ? 2 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setLayout(prev => {
          const pos = prev.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
          const delta = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const rowDelta = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          return { ...prev, gridPositions: { ...prev.gridPositions, [widgetId]: { ...pos, col: Math.max(0, pos.col + delta), row: Math.max(0, pos.row + rowDelta) } } };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, splitWidget, cancelEdit]);

  // ── Widget ops (staged until Save) ──

  const markCustom = useCallback(() => setActivePresetId('custom'), []);

  const toggleVisibility = useCallback((widgetId: string) => {
    markCustom();
    setLayout(prev => ({
      ...prev,
      widgetVisibility: {
        ...prev.widgetVisibility,
        [widgetId]: prev.widgetVisibility[widgetId] === false,
      },
    }));
  }, [markCustom]);

  const removeWidget = useCallback((widgetId: string) => {
    markCustom();
    setLayout(prev => ({
      ...prev,
      widgetOrder: prev.widgetOrder.filter(id => id !== widgetId),
      widgetVisibility: { ...prev.widgetVisibility, [widgetId]: false },
    }));
  }, [markCustom]);

  const addWidget = useCallback((widgetId: string) => {
    markCustom();
    setLayout(prev => {
      if (prev.widgetOrder.includes(widgetId)) {
        return { ...prev, widgetVisibility: { ...prev.widgetVisibility, [widgetId]: true } };
      }
      const config = WidgetRegistry.get(widgetId);
      return {
        ...prev,
        widgetOrder: [...prev.widgetOrder, widgetId],
        widgetVisibility: { ...prev.widgetVisibility, [widgetId]: true },
        gridPositions: {
          ...prev.gridPositions,
          [widgetId]: {
            col: 0,
            row: prev.widgetOrder.length,
            colSpan: config?.defaultSize?.cols || 1,
            rowSpan: config?.defaultSize?.rows || 1,
          },
        },
      };
    });
  }, [markCustom]);

  const setColumns = useCallback((columns: number) => {
    markCustom();
    setLayout(prev => ({ ...prev, columns: Math.max(4, Math.min(12, columns)) }));
  }, [markCustom]);

  const resetToDefault = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    setActivePresetId('default');
  }, []);

  // ── Drag and drop (HTML5 DnD; keyboard alternative below) ──

  const handleDragStart = useCallback((e: React.DragEvent, widgetId: string) => {
    setDraggedId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const moveWidget = useCallback((fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return false;
    let moved = false;
    setLayout(prev => {
      const newOrder = [...prev.widgetOrder];
      const fromIdx = newOrder.indexOf(fromId);
      const toIdx = newOrder.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, fromId);
      moved = true;
      return { ...prev, widgetOrder: newOrder };
    });
    markCustom();
    return moved;
  }, [markCustom]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId) return;
    moveWidget(draggedId, targetId);
    setDraggedId(null);
  }, [draggedId, moveWidget]);

  // Keyboard reorder: arrow keys move the focused widget in edit mode
  const moveWidgetBy = useCallback((widgetId: string, delta: -1 | 1) => {
    markCustom();
    setLayout(prev => {
      const idx = prev.widgetOrder.indexOf(widgetId);
      const swap = idx + delta;
      if (idx === -1 || swap < 0 || swap >= prev.widgetOrder.length) return prev;
      const newOrder = [...prev.widgetOrder];
      [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
      return { ...prev, widgetOrder: newOrder };
    });
  }, [markCustom]);

  const resizeWidgetBy = useCallback((widgetId: string, colDelta: number, rowDelta: number) => {
    markCustom();
    setLayout(prev => {
      const current = prev.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
      const widget = WidgetRegistry.get(widgetId);
      const minCols = Math.max(1, widget?.minSize?.cols || 1);
      const minRows = Math.max(1, widget?.minSize?.rows || 1);
      const maxCols = prev.columns;
      const nextCols = Math.max(minCols, Math.min(maxCols, current.colSpan + colDelta));
      const nextRows = Math.max(minRows, Math.min(6, current.rowSpan + rowDelta));
      const nextCol = Math.max(0, Math.min(prev.columns - nextCols, current.col));
      return {
        ...prev,
        gridPositions: { ...prev.gridPositions, [widgetId]: { ...current, col: nextCol, colSpan: nextCols, rowSpan: nextRows } },
      };
    });
  }, [markCustom]);

   const beginResize = useCallback((e: React.MouseEvent, widgetId: string, edge: string, position: { col: number; row: number; colSpan: number; rowSpan: number }) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: widgetId, edge, startX: e.clientX, startY: e.clientY, colSpan: position.colSpan, rowSpan: position.rowSpan, col: position.col, row: position.row });
  }, []);

  useEffect(() => {
    if (!resizing || !gridRef.current) return;
    const onMove = (e: MouseEvent) => {
      const width = gridRef.current?.getBoundingClientRect().width || 1;
      const colWidth = width / Math.max(layout.columns, 1);
      const rowHeight = 180;
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      const colDelta = Math.round(dx / colWidth);
      const rowDelta = Math.round(dy / rowHeight);
      setLayout(prev => {
        const current = prev.gridPositions[resizing.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
        const widget = WidgetRegistry.get(resizing.id);
        const minCols = Math.max(1, widget?.minSize?.cols || 1);
        const minRows = Math.max(1, widget?.minSize?.rows || 1);
        const maxCols = prev.columns;
        let newColSpan = current.colSpan;
        let newRowSpan = current.rowSpan;
        let newCol = current.col;
        let newRow = current.row;
        if (resizing.edge.includes('right') || resizing.edge === 'br' || resizing.edge === 'tr') {
          newColSpan = Math.max(minCols, Math.min(maxCols, current.colSpan + colDelta));
        }
        if (resizing.edge.includes('left')) {
          const newCS = Math.max(minCols, Math.min(maxCols, current.colSpan - colDelta));
          newColSpan = newCS;
          newCol = Math.max(0, Math.min(maxCols - newCS, current.col + colDelta));
        }
        if (resizing.edge.includes('bottom') || resizing.edge === 'br' || resizing.edge === 'bl') {
          newRowSpan = Math.max(minRows, Math.min(6, current.rowSpan + rowDelta));
        }
        if (resizing.edge.includes('top')) {
          const newRS = Math.max(minRows, Math.min(6, current.rowSpan - rowDelta));
          newRowSpan = newRS;
          newRow = Math.max(0, Math.min(6 - newRS, current.row + rowDelta));
        }
        return { ...prev, gridPositions: { ...prev.gridPositions, [resizing.id]: { col: newCol, row: newRow, colSpan: newColSpan, rowSpan: newRowSpan } } };
      });
      setActivePresetId('custom');
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [layout.columns, resizing]);

  // Split widget handler
  const handleSplit = useCallback((widgetId: string) => {
    if (splitWidget === widgetId) {
      setSplitWidget(null);
      return;
    }
    setSplitWidget(widgetId);
  }, [splitWidget]);

  const applySplit = useCallback((widgetId: string, ratio: string) => {
    const [cols, rows] = ratio.split(':').map(Number);
    const current = layout.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
    const totalCols = Math.max(current.colSpan, 1);
    const leftCols = Math.max(1, Math.round(totalCols * cols / (cols + rows)));
    setLayout(prev => ({
      ...prev,
      gridPositions: {
        ...prev.gridPositions,
        [widgetId]: { ...current, colSpan: leftCols },
      },
    }));
    markCustom();
    setSplitWidget(null);
  }, [layout.gridPositions, markCustom]);

  // ── Presets ──

  const applyPreset = useCallback((preset: LayoutPreset) => {
    setLayout(preset.layout);
    setActivePresetId(preset.id);
    setShowPresets(false);
  }, []);

  const saveAsPreset = useCallback(async () => {
    const name = presetName.trim();
    if (!name) return;
    const preset: LayoutPreset = {
      id: `preset-${Date.now()}`,
      name,
      layout,
      updatedAt: Date.now(),
    };
    const next = [...presets.filter(p => p.id !== 'default'), preset];
    const full = [BUILT_IN_PRESET, ...next];
    setPresets(full);
    setActivePresetId(preset.id);
    setPresetName('');
    await persistPresets(full);
  }, [presetName, layout, presets]);

  const deletePreset = useCallback(async (id: string) => {
    if (id === 'default') return;
    const full = presets.filter(p => p.id !== id);
    setPresets(full.length > 0 ? full : [BUILT_IN_PRESET]);
    if (activePresetId === id) setActivePresetId('custom');
    await persistPresets(full.length > 0 ? full : [BUILT_IN_PRESET]);
  }, [presets, activePresetId]);

  // ── Derived ──

  const visibleWidgets = WidgetRegistry.getVisible(layout);
  const hiddenWidgets = WidgetRegistry.getAll().filter(
    w => !layout.widgetOrder.includes(w.id) || layout.widgetVisibility[w.id] === false,
  );
  const activePreset = presets.find(p => p.id === activePresetId);
  const activeName = activePreset ? activePreset.name : 'Unsaved deck';

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative">
      {/* ── Status strip: what deck is loaded right now ── */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] px-4 py-2.5 light:bg-white/85 light:border-[var(--ws-border)]">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutDashboard size={14} className="shrink-0 text-[var(--page-accent)]" />
          <span className="truncate font-display text-[13px] font-semibold text-[var(--text-primary)]">
            {activeName}
          </span>
          {dirty && (
            <span className="shrink-0 rounded-full border border-[var(--color-amber-400)]/30 bg-[var(--color-amber-400)]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--color-amber-400)]">
              unsaved
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-[var(--text-muted)]">
          {visibleWidgets.length} of {WidgetRegistry.getAll().length} widgets · {layout.columns} col
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Preset switcher */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(v => !v)}
              className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              aria-label="Switch layout preset"
              aria-expanded={showPresets}
            >
              Decks
              <ChevronDown size={13} />
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-2">
                {presets.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${
                      p.id === activePresetId ? 'bg-[var(--page-accent)]/10 light:bg-white light:text-stone-900 light:border-[var(--ws-border-strong)]' : ''
                    }`}
                  >
                    <button
                      onClick={() => applyPreset(p)}
                      className="min-h-[32px] flex-1 truncate text-left text-[12px] text-[var(--text-primary)]"
                    >
                      {p.name}
                      <span className="ml-2 font-mono text-[10px] text-[var(--text-muted)]">
                        {p.layout.widgetOrder.filter(id => p.layout.widgetVisibility[id] !== false).length}w · {p.layout.columns}c
                      </span>
                    </button>
                    {p.id !== 'default' && (
                      confirmDeleteId === p.id ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => {
                              deletePreset(p.id);
                              setConfirmDeleteId(null);
                            }}
                            className="flex min-h-[32px] items-center rounded-md bg-[var(--error)]/15 px-2 text-[11px] font-medium text-[var(--error)]"
                            aria-label={`Confirm delete of deck ${p.name}`}
                          >
                            Delete?
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            aria-label="Keep deck"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:text-[var(--error)]"
                          aria-label={`Delete deck ${p.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                ))}
                {/* Save current as new deck */}
                <div className="mt-2 flex items-center gap-1.5 border-t border-[var(--border-subtle)] px-2 pt-2">
                  <input
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveAsPreset();
                    }}
                    placeholder="Name this deck…"
                    maxLength={40}
                    className="min-h-[32px] min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-transparent px-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--page-accent)]/50 focus:outline-none"
                    aria-label="New deck name"
                  />
                  <button
                    onClick={saveAsPreset}
                    disabled={!presetName.trim()}
                    className="flex min-h-[32px] items-center gap-1 rounded-md bg-[var(--page-accent)]/15 px-2.5 text-[12px] font-medium text-[var(--page-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Save size={12} />
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Edit toggle */}
          {!editMode ? (
            <button
              onClick={enterEditMode}
              className="flex min-h-[32px] items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              <Settings2 size={14} />
              Edit deck
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-900"
                aria-label="Cancel editing and discard changes (Esc)"
              >
                <X size={13} />
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={!dirty}
                className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[var(--page-accent)]/40 bg-[var(--page-accent)]/15 px-3 text-[12px] font-medium text-[var(--page-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Save deck layout"
              >
                <Check size={13} />
                Save deck
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Preview overlay ── */}
      {previewMode && (
        <div className="fixed inset-0 z-[100] bg-[var(--ws-surface)] overflow-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-[rgba(9,9,11,0.9)] backdrop-blur-xl border-b border-[var(--ws-border)] p-4">
            <span className="font-display text-lg font-semibold text-[var(--text-primary)]">Dashboard Preview</span>
            <button onClick={() => setPreviewMode(false)}
              className="flex items-center gap-2 rounded-lg border border-[var(--ws-border)] px-4 py-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              <X size={16} /> Close Preview
            </button>
          </div>
          <div className="p-6" style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            gap: '16px',
            minHeight: '100vh',
          }}>
            {visibleWidgets.map(widget => {
              const position = layout.gridPositions[widget.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
              const theme = getWidgetTheme(widget.id);
              const WidgetComponent = widget.component;
              if (!WidgetComponent) return null;
              return (
                <div key={widget.id} style={{
                  gridColumn: `${position.col + 1} / span ${Math.min(position.colSpan, layout.columns)}`,
                  gridRow: `${position.row + 1} / span ${Math.min(position.rowSpan, 6)}`,
                }}>
                  <DashboardDataProvider value={data}>
                    <WidgetCard widgetId={widget.id} title={widget.name} icon={null} accent={theme.accent} kicker={theme.kicker}>
                      <WidgetComponent />
                    </WidgetCard>
                  </DashboardDataProvider>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Edit controls (labeled groups) ── */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-[var(--page-accent)]/25 bg-[var(--color-card)] px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Columns3 size={13} className="text-[var(--text-muted)]" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Columns
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-card)] p-0.5">
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setColumns(n)}
                    aria-pressed={layout.columns === n}
                    aria-label={`${n} columns`}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px] font-mono font-medium transition-colors ${
                      layout.columns === n ? 'bg-[var(--page-accent)]/20 text-[var(--page-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Rows3 size={13} className="text-[var(--text-muted)]" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Rows
              </span>
              <span className="font-mono text-[12px] text-[var(--text-secondary)]">
                auto-flow
              </span>
            </div>
            <button
              onClick={() => setShowAddPanel(!showAddPanel)}
              aria-expanded={showAddPanel}
              className="flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              <Plus size={14} />
              {showAddPanel ? 'Hide widget list' : 'Add widgets'}
            </button>
            <button
              onClick={resetToDefault}
              className="flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-900"
              aria-label="Reset deck to default layout"
            >
              <RotateCcw size={13} />
              Reset
            </button>
            <span className="ml-auto hidden font-mono text-[10px] text-[var(--text-muted)] lg:inline">
                    drag to reorder · drag the corner to resize · Shift + arrows resize · Esc cancels
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add widget panel ── */}
      <AnimatePresence initial={false}>
        {editMode && showAddPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 1, 1] }}
            className="mb-4 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)]"
          >
            <div className="p-4">
              <h4 className="mb-1 text-[12px] font-semibold text-[var(--text-secondary)]">
                Widget library
              </h4>
              <p className="mb-3 text-[11px] text-[var(--text-muted)]">
                {hiddenWidgets.length === 0
                  ? 'Every widget is already on this deck.'
                  : 'Pick widgets to add — they appear at the end of the deck.'}
              </p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {hiddenWidgets.map(widget => {
                  const theme = getWidgetTheme(widget.id);
                  const WidgetIcon = getIcon(widget.icon);
                  return (
                    <button
                      key={widget.id}
                      onClick={() => addWidget(widget.id)}
                      className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] p-2.5 text-left transition-colors hover:border-[var(--page-accent)]/30"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: theme.tint, color: theme.accent }}
                      >
                        <WidgetIcon size={13} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium text-[var(--text-primary)]">
                          {widget.name}
                        </span>
                        <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          {theme.kicker}
                        </span>
                      </span>
                      <Plus size={13} className="ml-auto shrink-0 text-[var(--text-muted)]" />
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Widget grid ── */}
      <LayoutGroup>
              <motion.div
                ref={gridRef}
                layout
                className="grid gap-4 overflow-auto layout-grid-scroll"
                style={{
                  gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                  maxHeight: 'calc(100vh - 260px)',
           }}
         >
          <AnimatePresence mode="popLayout">
            {visibleWidgets.map(widget => {
              const position = layout.gridPositions[widget.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
              const WidgetComponent = widget.component;
              const theme = getWidgetTheme(widget.id);
              if (!WidgetComponent) return null;
              return (
                <motion.div
                  key={widget.id}
                  layout
                  layoutId={widget.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    gridColumn: `${position.col + 1} / span ${Math.min(position.colSpan, layout.columns)}`,
                    gridRow: `${position.row + 1} / span ${position.rowSpan}`,
                  }}
                  draggable={editMode}
                  onDragStart={(e) => handleDragStart(e as any, widget.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e as any, widget.id)}
                  onKeyDown={(e) => {
                    if (!editMode) return;
                    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                      e.preventDefault();
                      resizeWidgetBy(widget.id, e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0);
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      moveWidgetBy(widget.id, -1);
                    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      moveWidgetBy(widget.id, 1);
                    }
                  }}
                  tabIndex={editMode ? 0 : -1}
                  aria-label={editMode ? `${widget.name} widget. Use arrow keys to reorder.` : undefined}
                  className={`relative rounded-xl ${editMode ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50' : ''}`}
                >
                  <WidgetCard
                    widgetId={widget.id}
                    title={widget.name}
                    icon={getIcon(widget.icon)}
                    accent={theme.accent}
                    kicker={theme.kicker}
                    description={editMode ? undefined : widget.description}
                    draggable={editMode}
                    removable={editMode}
                    hidden={!layout.widgetVisibility[widget.id]}
                    onToggleVisibility={() => toggleVisibility(widget.id)}
                    onRemove={() => removeWidget(widget.id)}
                    footer={<DeckCardFooter route={theme.detailRoute} label={theme.detailLabel} />}
                  >
                    <DashboardDataProvider value={data}>
                      <WidgetComponent />
                    </DashboardDataProvider>
                  </WidgetCard>
                  {editMode && (
                    <>
                      {/* Edge resize handles */}
                      <button type="button" onMouseDown={(e) => beginResize(e, widget.id, 'top', position)}
                        className="absolute left-2 right-2 -top-1 z-10 h-2 cursor-ns-resize rounded bg-[var(--page-accent)]/30 hover:bg-[var(--page-accent)]/60 transition-colors"
                        aria-label={`Resize ${widget.name} top edge`} title="Drag to resize top" />
                      <button type="button" onMouseDown={(e) => beginResize(e, widget.id, 'bottom', position)}
                        className="absolute left-2 right-2 -bottom-1 z-10 h-2 cursor-ns-resize rounded bg-[var(--page-accent)]/30 hover:bg-[var(--page-accent)]/60 transition-colors"
                        aria-label={`Resize ${widget.name} bottom edge`} title="Drag to resize bottom" />
                      <button type="button" onMouseDown={(e) => beginResize(e, widget.id, 'left', position)}
                        className="absolute top-2 bottom-2 -left-1 z-10 w-2 cursor-ew-resize rounded bg-[var(--page-accent)]/30 hover:bg-[var(--page-accent)]/60 transition-colors"
                        aria-label={`Resize ${widget.name} left edge`} title="Drag to resize left" />
                      <button type="button" onMouseDown={(e) => beginResize(e, widget.id, 'right', position)}
                        className="absolute top-2 bottom-2 -right-1 z-10 w-2 cursor-ew-resize rounded bg-[var(--page-accent)]/30 hover:bg-[var(--page-accent)]/60 transition-colors"
                        aria-label={`Resize ${widget.name} right edge`} title="Drag to resize right" />
                      {/* Corner resize handles */}
                      <button type="button" onMouseDown={(e) => beginResize(e, widget.id, 'br', position)}
                        className="absolute bottom-1.5 right-1.5 z-10 h-4 w-4 cursor-nwse-resize rounded bg-[var(--page-accent)]/40 border border-[var(--page-accent)]/50 text-[var(--page-accent)] opacity-80 transition-opacity hover:opacity-100"
                        aria-label={`Resize ${widget.name} corner`} title="Drag to resize corner">
                        <span aria-hidden className="mx-auto block h-3 w-3 border-b-2 border-r-2 border-current" />
                      </button>
                      {/* Split button */}
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleSplit(widget.id); }}
                        className="absolute bottom-1.5 left-1.5 z-10 h-7 w-7 cursor-pointer rounded-md border border-[var(--page-accent)]/40 bg-[var(--color-card)]/90 text-[var(--page-accent)] opacity-80 transition-opacity hover:opacity-100"
                        aria-label={`Split ${widget.name}`} title="Split widget">
                        <Split size={12} />
                      </button>
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
  {/* Split overlay for the currently splitting widget */}
        {splitWidget && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-xl">
            <div className="layout-split-overlay rounded-xl bg-[var(--ws-surface-raised)] border border-[var(--ws-border)] p-6">
              <div className="mb-4 font-mono text-sm text-[var(--page-accent)]">Split {splitWidget}</div>
              <div className="grid grid-cols-2 gap-2">
                {RATIO_PRESETS.map(ratio => (
                  <button key={ratio} onClick={() => { applySplit(splitWidget, ratio); }}
                    className="layout-ratio-btn">{ratio}</button>
                ))}
              </div>
              <button onClick={() => setSplitWidget(null)}
                className="mt-4 flex h-8 w-8 items-center justify-center rounded-md border border-[var(--ws-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
      </LayoutGroup>

      {/* ── Edit-mode widget list (visibility toggles with labels) ── */}
      {editMode && (
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-4">
          <h4 className="mb-1 text-[12px] font-semibold text-[var(--text-secondary)]">
            Widgets on this deck
          </h4>
          <p className="mb-3 text-[11px] text-[var(--text-muted)]">
            Toggle visibility or remove widgets. Changes apply when you save the deck.
          </p>
          <ul className="space-y-1">
            {layout.widgetOrder.map(id => {
              const config = WidgetRegistry.get(id);
              if (!config) return null;
              const theme = getWidgetTheme(id);
              const WidgetIcon = getIcon(config.icon);
              const visible = layout.widgetVisibility[id] !== false;
              return (
                <li
                  key={id}
                  className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: theme.tint, color: theme.accent }}
                  >
                    <WidgetIcon size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-[var(--text-primary)]">
                      {config.name}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      {theme.kicker}
                    </span>
                  </span>
                  <button
                    onClick={() => toggleVisibility(id)}
                    aria-pressed={visible}
                    aria-label={visible ? `Hide ${config.name}` : `Show ${config.name}`}
                    className={`flex min-h-[32px] items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
                      visible
                        ? 'border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 text-[var(--page-accent)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <Eye size={12} />
                    {visible ? 'Shown' : 'Hidden'}
                  </button>
                  <button
                    onClick={() => removeWidget(id)}
                    aria-label={`Remove ${config.name} from deck`}
                    className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:text-[var(--error)]"
                  >
                    <X size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}

function DeckCardFooter({ route, label }: { route: string; label: string }) {
  return (
    <Link
      to={route}
      className="flex min-h-[32px] items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      aria-label={label}
    >
      {label}
      <ArrowUpRight size={12} />
    </Link>
  );
}
