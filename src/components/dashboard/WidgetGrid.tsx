// ============================================================
// RHEO Dashboard — WidgetGrid (Dynamic Layout Engine)
// Status strip (current config) · Save/Cancel edit flow ·
// Named layout presets (preference store + localStorage fallback).
// LAMINAR: CSS Grid only, tween easing, token colors, lucide only.
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup, MotionConfig } from 'motion/react';
import {
  Columns3, Rows3, Plus, Settings2, Box, Check, X, Save,
  LayoutDashboard, ChevronDown, Trash2, RotateCcw, Eye, ArrowUpRight,
  Activity, Calendar, Sparkles, Target, AlertCircle, Zap, BarChart3,
  Pin, Moon, Brain, Orbit, Clock, Flame, ArrowRight, CalendarDays,
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
}

/**
 * Dynamic widget grid: status strip, edit mode with Save/Cancel,
 * named layout presets, drag-to-reorder, column control.
 */
export function WidgetGrid({ forceEditMode = false, data }: WidgetGridProps) {
  const [layout, setLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [presets, setPresets] = useState<LayoutPreset[]>([BUILT_IN_PRESET]);
  const [activePresetId, setActivePresetId] = useState<string>('default');
  const [editMode, setEditMode] = useState(forceEditMode);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; colSpan: number; rowSpan: number } | null>(null);
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
  }, [layout, presets]);

  // Esc cancels edit mode (forgiveness — humancentred-UIUX pillar 6)
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, cancelEdit]);

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

  const toggleLibraryWidget = useCallback(async (widgetId: string) => {
    const selected = layout.widgetVisibility[widgetId] !== false && layout.widgetOrder.includes(widgetId);
    const config = WidgetRegistry.get(widgetId);
    const next: DashboardLayoutConfig = selected
      ? {
          ...layout,
          widgetOrder: layout.widgetOrder.filter(id => id !== widgetId),
          widgetVisibility: { ...layout.widgetVisibility, [widgetId]: false },
        }
      : {
          ...layout,
          widgetOrder: [...layout.widgetOrder, widgetId],
          widgetVisibility: { ...layout.widgetVisibility, [widgetId]: true },
          gridPositions: {
            ...layout.gridPositions,
            [widgetId]: layout.gridPositions[widgetId] || {
              col: 0,
              row: layout.rows + layout.widgetOrder.length,
              colSpan: Math.min(layout.columns, config?.defaultSize?.cols || 3),
              rowSpan: config?.defaultSize?.rows || 1,
            },
          },
        };
    markCustom();
    setLayout(next);
    setSavedLayout(next);
    await persistLayout(next);
  }, [layout, markCustom]);

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

  const beginResize = useCallback((e: React.MouseEvent, widgetId: string, position: { colSpan: number; rowSpan: number }) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: widgetId, startX: e.clientX, startY: e.clientY, colSpan: position.colSpan, rowSpan: position.rowSpan });
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const width = gridRef.current?.getBoundingClientRect().width || 1;
      const colWidth = width / Math.max(layout.columns, 1);
      const nextCols = resizing.colSpan + Math.round((e.clientX - resizing.startX) / colWidth);
      const nextRows = resizing.rowSpan + Math.round((e.clientY - resizing.startY) / 180);
      setLayout(prev => {
        const current = prev.gridPositions[resizing.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
        const widget = WidgetRegistry.get(resizing.id);
        const minCols = Math.max(1, widget?.minSize?.cols || 1);
        const maxCols = prev.columns;
        return {
          ...prev,
          gridPositions: {
            ...prev.gridPositions,
            [resizing.id]: {
              ...current,
              colSpan: Math.max(minCols, Math.min(maxCols, nextCols)),
              rowSpan: Math.max(widget?.minSize?.rows || 1, Math.min(6, nextRows)),
            },
          },
        };
      });
      setActivePresetId('custom');
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [layout.columns, resizing]);

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

      {/* The library is part of the dashboard, not a separate view. */}
      <section className="mb-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)]/90 p-4 light:bg-white/85 light:border-[var(--ws-border)]" aria-label="Dashboard card library">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--page-accent)]">Card library</div>
            <h2 className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">Choose what belongs on your dashboard</h2>
          </div>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">{visibleWidgets.length} selected</span>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          {WidgetRegistry.getAll().map(widget => {
            const theme = getWidgetTheme(widget.id);
            const WidgetIcon = getIcon(widget.icon);
            const selected = layout.widgetVisibility[widget.id] !== false && layout.widgetOrder.includes(widget.id);
            return (
              <button
                key={widget.id}
                type="button"
                onClick={() => void toggleLibraryWidget(widget.id)}
                aria-pressed={selected}
                className={`group min-h-[76px] rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 ${selected ? 'border-[var(--page-accent)]/50 bg-[var(--page-accent)]/10' : 'border-[var(--border-subtle)] bg-white/[0.02] hover:border-[var(--page-accent)]/30 hover:bg-white/[0.04]'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: theme.tint, color: theme.accent }}><WidgetIcon size={14} /></span>
                  <span className={`h-2 w-2 rounded-full ${selected ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]/40'}`} aria-hidden />
                </span>
                <span className="mt-2 block truncate text-[12px] font-medium text-[var(--text-primary)]">{widget.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--text-muted)]">{selected ? 'On dashboard' : 'Add card'}</span>
              </button>
            );
          })}
        </div>
      </section>

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
              <div className="flex items-center gap-1" role="group" aria-label="Column count">
                    {[4, 6, 8, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setColumns(n)}
                    aria-pressed={layout.columns === n}
                    aria-label={`${n} columns`}
                    className={`flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md font-mono text-[12px] font-medium transition-colors light:bg-white light:border-[var(--ws-border-strong)] light:text-stone-900 ${layout.columns === n ? 'bg-[var(--page-accent)]/20 text-[var(--page-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
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
                className="grid auto-rows-[180px] gap-4"
                style={{
                  gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
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
                    <button
                      type="button"
                      onMouseDown={(e) => beginResize(e, widget.id, position)}
                      className="absolute bottom-1.5 right-1.5 z-10 h-7 w-7 cursor-se-resize rounded-md border border-[var(--page-accent)]/40 bg-[var(--color-card)]/90 text-[var(--page-accent)] opacity-80 transition-opacity hover:opacity-100"
                      aria-label={`Resize ${widget.name} card`}
                      title="Drag to resize card"
                    >
                      <span aria-hidden className="mx-auto block h-3 w-3 border-b-2 border-r-2 border-current" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
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
