// ============================================================
// RHEO Dashboard — LayoutEditor
// Visual grid overlay, drag-to-resize, ratio splits, preview mode
// LAMINAR: design.md wins over all skill defaults
// ============================================================

"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings2, Columns3, Rows3, Save, RotateCcw,
  ChevronDown, Trash2, Plus, Split, X, Check, Layers, Eye,
} from 'lucide-react';
import {
  WidgetRegistry,
  DEFAULT_LAYOUT,
  type DashboardLayoutConfig,
} from './WidgetRegistry';
import type { WidgetConfig } from './WidgetRegistry';
import { WidgetCard } from './WidgetCard';
import { DashboardDataProvider } from './DashboardContext';
import type { DashboardData } from './DashboardContext';
import { getWidgetTheme } from './widgetTheme';
import './layout-editor.css';
import './registerWidgets';

// ── Constants ──

const LAYOUT_KEY = 'dashboard_layout';
const PRESETS_KEY = 'dashboard_widget_presets';

// Ratio presets for splitting
const RATIO_PRESETS = [
  { id: '1:1', label: '1:1', cols: 1, rows: 1 },
  { id: '2:1', label: '2:1', cols: 2, rows: 1 },
  { id: '1:2', label: '1:2', cols: 1, rows: 2 },
  { id: '2:3', label: '2:3', cols: 2, rows: 3 },
  { id: '3:2', label: '3:2', cols: 3, rows: 2 },
  { id: '1:3', label: '1:3', cols: 1, rows: 3 },
  { id: '3:1', label: '3:1', cols: 3, rows: 1 },
  { id: '3:3', label: '3:3', cols: 3, rows: 3 },
];

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function writeLocal(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* silent */ }
}

// ── LayoutEditor Props ──

interface LayoutEditorProps {
  data: DashboardData;
  onSaved?: () => void;
}

// ── Grid Preview Component ──

interface GridPreviewProps {
  layout: DashboardLayoutConfig;
  visibleWidgets: WidgetConfig[];
  isPreview: boolean;
  onEdit: () => void;
  data?: DashboardData;
}

function GridPreview({ layout, visibleWidgets, isPreview, onEdit, data }: GridPreviewProps) {
  if (!isPreview) return null;

  return (
    <div className="layout-preview-overlay">
      <div className="layout-preview-header">
        <span className="layout-preview-title">Dashboard Preview</span>
        <button onClick={onEdit} className="layout-preview-close">
          <Settings2 size={14} />
          Edit Layout
        </button>
      </div>
      <div className="p-6" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        gap: '16px',
        minHeight: '100vh',
      }}>
        {visibleWidgets.map(widget => {
          const pos = layout.gridPositions[widget.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
          const theme = getWidgetTheme(widget.id);
          const WidgetComponent = widget.component;
          if (!WidgetComponent) return null;
          return (
            <div key={widget.id} style={{
              gridColumn: `${pos.col + 1} / span ${Math.min(pos.colSpan, layout.columns)}`,
              gridRow: `${pos.row + 1} / span ${pos.rowSpan}`,
            }}>
              <DashboardDataProvider value={data}>
                <WidgetCard
                  widgetId={widget.id}
                  title={widget.name}
                  icon={null}
                  accent={theme.accent}
                  kicker={theme.kicker}
                >
                  <WidgetComponent />
                </WidgetCard>
              </DashboardDataProvider>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Resize Handle Component ──

interface ResizeHandleProps {
  position: string;
  onMouseDown: (e: React.MouseEvent) => void;
}

function ResizeHandle({ position, onMouseDown }: ResizeHandleProps) {
  const cursorMap: Record<string, string> = {
    top: 'ns-resize', bottom: 'ns-resize',
    left: 'ew-resize', right: 'ew-resize',
    tl: 'nwse-resize', tr: 'nesw-resize',
    bl: 'nesw-resize', br: 'nwse-resize',
  };

  return (
    <div
      className={`layout-widget-resize layout-widget-resize-${position}`}
      onMouseDown={onMouseDown}
      style={{ cursor: cursorMap[position] || 'se-resize' }}
    />
  );
}

// ── Split Overlay Component ──

interface SplitOverlayProps {
  widgetId: string;
  onSplit: (widgetId: string, ratio: string) => void;
  onExit: () => void;
}

function SplitOverlay({ widgetId, onSplit, onExit }: SplitOverlayProps) {
  return (
    <div className="layout-split-overlay">
      <div className="layout-split-indicator">
        <Split size={12} />
        Split Mode — Click a ratio to apply
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px',
        width: '100%',
        height: '100%',
      }}>
        {RATIO_PRESETS.map(ratio => (
          <button
            key={ratio.id}
            onClick={() => onSplit(widgetId, ratio.id)}
            className="layout-split-region"
          >
            {ratio.label}
          </button>
        ))}
      </div>
      <button
        onClick={onExit}
        className="absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ws-border)] bg-[var(--ws-surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Main LayoutEditor Component ──

export function LayoutEditor({ data, onSaved }: LayoutEditorProps) {
  const [layout, setLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [presets, setPresets] = useState<Array<{ id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }>>([
    { id: 'default', name: 'Default deck', layout: DEFAULT_LAYOUT, updatedAt: 0 },
  ]);
  const [activePresetId, setActivePresetId] = useState<string>('default');
  const [editMode, setEditMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; edge: string; startX: number; startY: number; colSpan: number; rowSpan: number; col: number; row: number } | null>(null);
   const [splitWidget, setSplitWidget] = useState<string | null>(null);
   const [columns, setColumns] = useState(12);
   const gridRef = useRef<HTMLDivElement>(null);
   const editSnapshot = useRef<DashboardLayoutConfig>(DEFAULT_LAYOUT);
   const [loaded, setLoaded] = useState(false);

  // Load persisted layout
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = (window as any).deskflowAPI;
        let storedLayout = DEFAULT_LAYOUT;
        let storedPresets = [presets[0]];
        if (api?.getPreferences) {
          const prefs = await api.getPreferences();
          storedLayout = prefs?.[LAYOUT_KEY] ?? DEFAULT_LAYOUT;
          const storedPresetsRaw = prefs?.[PRESETS_KEY];
          if (Array.isArray(storedPresetsRaw) && storedPresetsRaw.length > 0) {
            storedPresets = [presets[0], ...storedPresetsRaw];
          }
        } else {
          storedLayout = readLocal<DashboardLayoutConfig>(LAYOUT_KEY) ?? DEFAULT_LAYOUT;
          const localPresets = readLocal<Array<{ id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }>>(PRESETS_KEY);
          if (localPresets && localPresets.length > 0) storedPresets = [presets[0], ...localPresets];
        }
        if (!cancelled) {
          setLayout(storedLayout);
          setSavedLayout(storedLayout);
          setPresets(storedPresets);
          setColumns(storedLayout.columns);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);

  // Edit flow
  const enterEditMode = useCallback(() => {
    editSnapshot.current = layout;
    setShowAddPanel(false);
    setEditMode(true);
  }, [layout]);

  const cancelEdit = useCallback(() => {
    setLayout(editSnapshot.current);
    setShowAddPanel(false);
    setShowPresets(false);
    setSplitWidget(null);
    setEditMode(false);
  }, []);

  const saveEdit = useCallback(async () => {
    setSavedLayout(layout);
    const match = presets.find(p => JSON.stringify(p.layout) === JSON.stringify(layout));
    setActivePresetId(match?.id ?? 'custom');
    setShowAddPanel(false);
    setShowPresets(false);
    setSplitWidget(null);
    setEditMode(false);
    writeLocal(LAYOUT_KEY, layout);
    try { await (window as any).deskflowAPI?.setPreference?.(LAYOUT_KEY, layout); } catch { /* silent */ }
    onSaved?.();
  }, [layout, presets, onSaved]);

  // Esc cancels
  useEffect(() => {
    if (!editMode && !splitWidget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (splitWidget) setSplitWidget(null);
        else cancelEdit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, cancelEdit, splitWidget]);

  // Mark custom
  const markCustom = useCallback(() => setActivePresetId('custom'), []);

  // Widget ops
  const toggleVisibility = useCallback((widgetId: string) => {
    markCustom();
    setLayout(prev => ({
      ...prev,
      widgetVisibility: { ...prev.widgetVisibility, [widgetId]: prev.widgetVisibility[widgetId] === false },
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
          [widgetId]: { col: 0, row: prev.widgetOrder.length, colSpan: config?.defaultSize?.cols || 1, rowSpan: config?.defaultSize?.rows || 1 },
        },
      };
    });
  }, [markCustom]);

  const updateColumns = useCallback((cols: number) => {
    markCustom();
    setColumns(cols);
    setLayout(prev => ({ ...prev, columns: Math.max(4, Math.min(12, cols)) }));
  }, [markCustom]);

  const resetToDefault = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    setColumns(12);
    setActivePresetId('default');
    setSplitWidget(null);
  }, []);

  // Drag and drop
  const handleDragStart = useCallback((e: React.DragEvent, widgetId: string) => {
    setDraggedId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const moveWidget = useCallback((fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;
    setLayout(prev => {
      const newOrder = [...prev.widgetOrder];
      const fromIdx = newOrder.indexOf(fromId);
      const toIdx = newOrder.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, fromId);
      return { ...prev, widgetOrder: newOrder };
    });
    markCustom();
  }, [markCustom]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId) return;
    moveWidget(draggedId, targetId);
    setDraggedId(null);
  }, [draggedId, moveWidget]);

  // Resize
  const beginResize = useCallback((e: React.MouseEvent, widgetId: string, edge: string, position: { col: number; row: number; colSpan: number; rowSpan: number }) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: widgetId, edge, startX: e.clientX, startY: e.clientY, colSpan: position.colSpan, rowSpan: position.rowSpan, col: position.col, row: position.row });
  }, []);

  useEffect(() => {
    if (!resizing || !gridRef.current) return;
    const onMove = (e: MouseEvent) => {
      const width = gridRef.current!.getBoundingClientRect().width || 1;
      const colWidth = width / Math.max(layout.columns, 1);
      const rowHeight = 180; // Default row height
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      const colDelta = Math.round(dx / colWidth);
      const rowDelta = Math.round(dy / rowHeight);

      setLayout(prev => {
        const current = prev.gridPositions[resizing.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
        const config = WidgetRegistry.get(resizing.id);
        const minCols = Math.max(1, config?.minSize?.cols || 1);
        const minRows = Math.max(1, config?.minSize?.rows || 1);
        const maxCols = prev.columns;

        let newColSpan = resizing.colSpan;
        let newRowSpan = resizing.rowSpan;
        let newCol = resizing.col;
        let newRow = resizing.row;

        // Handle edge-specific resize
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

        return {
          ...prev,
          gridPositions: {
            ...prev.gridPositions,
            [resizing.id]: { col: newCol, row: newRow, colSpan: newColSpan, rowSpan: newRowSpan },
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

  // Split
  const handleSplit = useCallback((widgetId: string, ratio: string) => {
    const [cols, rows] = ratio.split(':').map(Number);
    const current = layout.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
    const totalCols = Math.max(current.colSpan, 1);
    const leftCols = Math.max(1, Math.round(totalCols * cols / (cols + rows)));
    const rightCols = totalCols - leftCols;
    setLayout(prev => ({
      ...prev,
      gridPositions: {
        ...prev.gridPositions,
        [widgetId]: { ...current, colSpan: leftCols },
        [`${widgetId}-split-r`]: { col: current.col + leftCols, row: current.row, colSpan: Math.max(1, rightCols), rowSpan: current.rowSpan },
      },
    }));
    markCustom();
    setSplitWidget(null);
  }, [layout.gridPositions, markCustom]);

  // Presets
  const applyPreset = useCallback((preset: { id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }) => {
    setLayout(preset.layout);
    setColumns(preset.layout.columns);
    setActivePresetId(preset.id);
    setShowPresets(false);
    setSplitWidget(null);
  }, []);

  const saveAsPreset = useCallback(async () => {
    const name = presetName.trim();
    if (!name) return;
    const preset = { id: `preset-${Date.now()}`, name, layout, updatedAt: Date.now() };
    const next = [...presets.filter(p => p.id !== 'default'), preset];
    const full = [{ id: 'default', name: 'Default deck', layout: DEFAULT_LAYOUT, updatedAt: 0 }, ...next];
    setPresets(full);
    setActivePresetId(preset.id);
    setPresetName('');
    writeLocal(PRESETS_KEY, next);
    try { await (window as any).deskflowAPI?.setPreference?.(PRESETS_KEY, next); } catch { /* silent */ }
  }, [presetName, layout, presets]);

  const deletePreset = useCallback(async (id: string) => {
    if (id === 'default') return;
    const full = presets.filter(p => p.id !== id);
    setPresets(full.length > 0 ? full : [{ id: 'default', name: 'Default deck', layout: DEFAULT_LAYOUT, updatedAt: 0 }]);
    if (activePresetId === id) setActivePresetId('custom');
    writeLocal(PRESETS_KEY, full);
  }, [presets, activePresetId]);

  // Derived
  const visibleWidgets = WidgetRegistry.getVisible(layout);
  const hiddenWidgets = WidgetRegistry.getAll().filter(
    w => !layout.widgetOrder.includes(w.id) || layout.widgetVisibility[w.id] === false
  );
  const activePreset = presets.find(p => p.id === activePresetId);

  if (!loaded) return null;

  const sortedVisibleWidgets = [...visibleWidgets].sort((a, b) => {
    const ia = layout.widgetOrder.indexOf(a.id);
    const ib = layout.widgetOrder.indexOf(b.id);
    return ia - ib;
  });

  // Keyboard resize handler
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      const focused = document.activeElement;
      if (!focused?.closest?.('.layout-widget')) return;
      const widgetId = focused.closest('.layout-widget')?.getAttribute('data-widget-id');
      if (!widgetId) return;
      const step = e.shiftKey ? 2 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLayout(prev => {
          const pos = prev.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
          return { ...prev, gridPositions: { ...prev.gridPositions, [widgetId]: { ...pos, col: Math.max(0, pos.col - step) } } };
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLayout(prev => {
          const pos = prev.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
          return { ...prev, gridPositions: { ...prev.gridPositions, [widgetId]: { ...pos, col: Math.min(layout.columns - pos.colSpan, pos.col + step) } } };
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLayout(prev => {
          const pos = prev.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
          return { ...prev, gridPositions: { ...prev.gridPositions, [widgetId]: { ...pos, row: Math.max(0, pos.row - step) } } };
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLayout(prev => {
          const pos = prev.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
          return { ...prev, gridPositions: { ...prev.gridPositions, [widgetId]: { ...pos, row: Math.min(6, pos.row + step) } } };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, layout.columns]);

  return (
    <div className="relative layout-edit-background">
      {/* ── Toolbar ── */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="layout-editor-toolbar"
          >
            <div className="toolbar-section">
              <Columns3 size={13} className="text-[var(--text-muted)]" />
              <span className="toolbar-label">Columns</span>
              <div className="flex items-center gap-1">
                {[4, 6, 8, 12].map(n => (
                  <button key={n} onClick={() => setColumns(n)}
                    className={`layout-select-btn ${layout.columns === n ? 'active' : ''}`}
                    aria-pressed={layout.columns === n}
                  >{n}</button>
                ))}
              </div>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-section">
              <Rows3 size={13} className="text-[var(--text-muted)]" />
              <span className="toolbar-label">Auto</span>
            </div>
            <button onClick={() => setShowAddPanel(!showAddPanel)}
              className="flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
              <Plus size={14} /> Add Widgets
            </button>
            <button onClick={resetToDefault}
              className="flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
              <RotateCcw size={13} /> Reset
            </button>
            <div className="ml-auto flex items-center gap-2">
              {dirty && <div className="layout-unsaved-dot" />}
              <button onClick={cancelEdit}
                className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[var(--ws-border)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                <X size={13} /> Cancel
              </button>
              <button onClick={saveEdit} disabled={!dirty}
                className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[var(--page-accent)]/40 bg-[var(--page-accent)]/15 px-3 text-[12px] font-medium text-[var(--page-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40">
                <Check size={13} /> Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Widget Panel ── */}
      <AnimatePresence initial={false}>
        {editMode && showAddPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-raised)] mb-4"
          >
            <div className="p-4">
              <h4 className="mb-2 text-[12px] font-semibold text-[var(--text-secondary)]">Widget Library</h4>
              <p className="mb-3 text-[11px] text-[var(--text-muted)]">
                {hiddenWidgets.length === 0 ? 'All widgets are on this deck.' : 'Pick widgets to add — they appear at the end of the deck.'}
              </p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {hiddenWidgets.map(widget => {
                  const theme = getWidgetTheme(widget.id);
                  return (
                    <button key={widget.id} onClick={() => addWidget(widget.id)}
                      className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-[var(--ws-border)] p-2.5 text-left transition-colors hover:border-[var(--page-accent)]/30">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: theme.tint, color: theme.accent }}>
                        <span className="text-[11px] font-bold">{widget.name[0]}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium text-[var(--text-primary)]">{widget.name}</span>
                        <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{theme.kicker}</span>
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

      {/* ── Widget Grid ── */}
      <div className="relative">
        {/* Grid overlay in edit mode */}
        {editMode && (
          <div className="layout-grid-overlay" style={{ '--editor-columns': layout.columns } as React.CSSProperties} />
        )}

        {/* The actual grid */}
        <div ref={gridRef}
          className={`layout-grid-scroll ${editMode ? 'min-h-[500px]' : ''}`}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            gridAutoRows: '180px',
            gap: '16px',
            position: 'relative',
          }}
        >
          <AnimatePresence mode="popLayout">
            {sortedVisibleWidgets.map(widget => {
              const position = layout.gridPositions[widget.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
              const WidgetComponent = widget.component;
              const theme = getWidgetTheme(widget.id);
              const isSplitting = splitWidget === widget.id;
              const isDragged = draggedId === widget.id;
              if (!WidgetComponent) return null;
              return (
                <motion.div
                  key={widget.id}
                  layout
                  layoutId={widget.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: isDragged ? 0.4 : 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    gridColumn: `${position.col + 1} / span ${Math.min(position.colSpan, layout.columns)}`,
                    gridRow: `${position.row + 1} / span ${Math.min(position.rowSpan, 6)}`,
                    position: 'relative',
                  }}
                  draggable={editMode}
                  onDragStart={(e) => handleDragStart(e as any, widget.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e as any, widget.id)}
                  className={`layout-widget rounded-xl layout-widget-focus ${isDragged ? 'layout-drag-ghost' : ''}`}
                  tabIndex={editMode ? 0 : -1}
                  data-widget-id={widget.id}
                  role="button"
                  aria-label={editMode ? `${widget.name} widget. Use arrow keys to move.` : undefined}
                >
                  <WidgetCard
                    widgetId={widget.id}
                    title={widget.name}
                    icon={null}
                    accent={theme.accent}
                    kicker={theme.kicker}
                    description={editMode ? undefined : widget.description}
                    draggable={editMode}
                    removable={editMode}
                    hidden={!layout.widgetVisibility[widget.id]}
                    onToggleVisibility={() => toggleVisibility(widget.id)}
                    onRemove={() => removeWidget(widget.id)}
                  >
                    <DashboardDataProvider value={data}>
                      <WidgetComponent />
                    </DashboardDataProvider>
                  </WidgetCard>

                  {/* Edit mode resize handles */}
                  {editMode && !isSplitting && (
                    <>
                      <ResizeHandle position="top" onMouseDown={(e) => beginResize(e, widget.id, 'top', position)} />
                      <ResizeHandle position="bottom" onMouseDown={(e) => beginResize(e, widget.id, 'bottom', position)} />
                      <ResizeHandle position="left" onMouseDown={(e) => beginResize(e, widget.id, 'left', position)} />
                      <ResizeHandle position="right" onMouseDown={(e) => beginResize(e, widget.id, 'right', position)} />
                      <ResizeHandle position="tl" onMouseDown={(e) => beginResize(e, widget.id, 'tl', position)} />
                      <ResizeHandle position="tr" onMouseDown={(e) => beginResize(e, widget.id, 'tr', position)} />
                      <ResizeHandle position="bl" onMouseDown={(e) => beginResize(e, widget.id, 'bl', position)} />
                      <ResizeHandle position="br" onMouseDown={(e) => beginResize(e, widget.id, 'br', position)} />
                      {/* Split button */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSplitWidget(widget.id); }}
                        className="absolute bottom-1.5 left-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-[var(--page-accent)]/40 bg-[var(--ws-surface-raised)]/90 text-[var(--page-accent)] opacity-80 transition-opacity hover:opacity-100"
                        aria-label={`Split ${widget.name}`}
                        title="Split widget"
                      >
                        <Split size={12} />
                      </button>
                    </>
                  )}

                  {/* Split overlay */}
                  {isSplitting && (
                    <SplitOverlay
                      widgetId={widget.id}
                      onSplit={handleSplit}
                      onExit={() => setSplitWidget(null)}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Presets Dropdown ── */}
      {editMode && (
        <div className="relative">
          <button onClick={() => setShowPresets(v => !v)}
            className="flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[var(--ws-border)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            <Layers size={13} /> Decks
            <ChevronDown size={13} />
          </button>
          {showPresets && (
            <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-raised)] p-2">
              {presets.map(p => (
                <div key={p.id} className="flex items-center gap-1 rounded-lg px-2 py-1.5">
                  <button onClick={() => applyPreset(p)} className="min-h-[32px] flex-1 truncate text-left text-[12px] text-[var(--text-primary)]">
                    {p.name}
                    <span className="ml-2 font-mono text-[10px] text-[var(--text-muted)]">
                      {p.layout.widgetOrder.filter(id => p.layout.widgetVisibility[id] !== false).length}w · {p.layout.columns}c
                    </span>
                  </button>
                  {p.id !== 'default' && (
                    confirmDeleteId === p.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={() => { deletePreset(p.id); setConfirmDeleteId(null); }}
                          className="flex min-h-[32px] items-center rounded-md bg-[var(--color-amber-400)]/15 px-2 text-[11px] font-medium text-[var(--color-amber-400)]">Delete?</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="flex h-[32px] w-[32px] items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={13} /></button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(p.id)} className="flex h-[32px] w-[32px] items-center justify-center text-[var(--text-muted)] hover:text-[var(--color-amber-400)]"><Trash2 size={13} /></button>
                    )
                  )}
                </div>
              ))}
              <div className="mt-2 flex items-center gap-1.5 border-t border-[var(--ws-border)] px-2 pt-2">
                <input value={presetName} onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveAsPreset(); }}
                  placeholder="Name this deck…" maxLength={40}
                  className="min-h-[32px] flex-1 rounded-md border border-[var(--ws-border)] bg-transparent px-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--page-accent)]/50 focus:outline-none" />
                <button onClick={saveAsPreset} disabled={!presetName.trim()}
                  className="flex min-h-[32px] items-center gap-1 rounded-md bg-[var(--page-accent)]/15 px-2.5 text-[12px] font-medium text-[var(--page-accent)] disabled:opacity-40">
                  <Save size={12} /> Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Toggle Button (always visible in preview or when not editing) ── */}
      {!editMode && !previewMode && (
        <button onClick={enterEditMode}
          className="fixed bottom-6 right-6 z-50 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-[var(--ws-border)] bg-[var(--ws-surface-raised)] text-[var(--text-secondary)] shadow-lg transition-all hover:border-[var(--page-accent)] hover:text-[var(--page-accent)]">
          <Settings2 size={20} />
        </button>
      )}

      {/* ── Preview Toggle Button ── */}
      {!editMode && (
        <button onClick={() => setPreviewMode(true)}
          className="fixed bottom-6 right-[80px] z-50 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-[var(--ws-border)] bg-[var(--ws-surface-raised)] text-[var(--text-secondary)] shadow-lg transition-all hover:border-[var(--page-accent)] hover:text-[var(--page-accent)]">
          <Eye size={20} />
        </button>
      )}

      {/* ── Preview Mode ── */}
      <AnimatePresence>
        {previewMode && (
          <GridPreview
            layout={layout}
            visibleWidgets={visibleWidgets}
            isPreview={previewMode}
            onEdit={() => { setPreviewMode(false); enterEditMode(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Standalone Preview Component ──

interface LayoutPreviewStandaloneProps {
  layout: DashboardLayoutConfig;
  data: DashboardData;
  onClose: () => void;
}

export function LayoutPreviewStandalone({ layout, data, onClose }: LayoutPreviewStandaloneProps) {
  const visibleWidgets = WidgetRegistry.getVisible(layout);

  return (
    <div className="layout-preview-overlay">
      <div className="layout-preview-header">
        <span className="layout-preview-title">Dashboard Preview</span>
        <button onClick={onClose} className="layout-preview-close">
          <X size={14} /> Close Preview
        </button>
      </div>
      <div className="p-6" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        gap: '16px',
        minHeight: '100vh',
      }}>
        {visibleWidgets.map(widget => {
          const pos = layout.gridPositions[widget.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
          const theme = getWidgetTheme(widget.id);
          const WidgetComponent = widget.component;
          if (!WidgetComponent) return null;
          return (
            <div key={widget.id} style={{
              gridColumn: `${pos.col + 1} / span ${Math.min(pos.colSpan, layout.columns)}`,
              gridRow: `${pos.row + 1} / span ${Math.min(pos.rowSpan, 6)}`,
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
  );
}
