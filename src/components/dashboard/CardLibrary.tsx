// RHEO Dashboard — CardLibrary (Full Customization UI)
// Customizable card library: browse, add/remove, resize, rearrange,
// preview, save/load presets. Uses shadcn base-nova + motion v12 + lucide.
//
// Stack: shadcn/ui (base-nova) · motion v12 · lucide-react · Tailwind v4
// LAMINAR: tween easing, token colors, no spring physics, no glass on chrome.

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Calendar, Sparkles, Target, AlertCircle, Zap, BarChart3,
  Pin, Moon, Brain, Orbit, Clock, Flame, ArrowRight, CalendarDays, Box,
  Check, Eye, X, Search, Grid3X3, List, ChevronDown, GripVertical,
  Plus, Trash2, Save, RotateCcw, LayoutDashboard, Filter,
} from 'lucide-react';
import { WidgetRegistry, DEFAULT_LAYOUT, type DashboardLayoutConfig, type WidgetConfig, type WidgetSize } from './WidgetRegistry';
import { DashboardDataProvider, type DashboardData } from './DashboardContext';
import { getWidgetTheme } from './widgetTheme';
import './registerWidgets';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { toDashboardId } from './widgetRegistry';

// ── Constants ──────────────────────────────────────────────────────────────

const LAYOUT_KEY = 'dashboard_layout';
const PRESETS_KEY = 'dashboard_widget_presets';

const ICON_MAP: Record<string, any> = {
  Activity, Calendar, Sparkles, Target, AlertCircle, Zap, BarChart3,
  Pin, Moon, Brain, Orbit, Clock, Flame, ArrowRight, CalendarDays, Box,
};

function getIcon(name: string): any {
  return ICON_MAP[name] || Box;
}

// Category metadata for filtering and display
const CATEGORIES: { value: WidgetConfig['category']; label: string; icon: any }[] = [
  { value: 'productivity', label: 'Productivity', icon: Target },
  { value: 'schedule', label: 'Schedule', icon: Calendar },
  { value: 'insights', label: 'Insights', icon: Sparkles },
  { value: 'finance', label: 'Finance', icon: ArrowRight },
  { value: 'health', label: 'Health', icon: Moon },
  { value: 'learn', label: 'Learn', icon: Brain },
  { value: 'system', label: 'System', icon: Box },
];

// Size presets for widget resizing (cols × rows)
const SIZE_PRESETS: WidgetSize[] = [
  { cols: 1, rows: 1 },
  { cols: 2, rows: 1 },
  { cols: 3, rows: 1 },
  { cols: 4, rows: 1 },
  { cols: 6, rows: 1 },
  { cols: 1, rows: 2 },
  { cols: 2, rows: 2 },
  { cols: 3, rows: 2 },
  { cols: 1, rows: 3 },
  { cols: 2, rows: 3 },
];

// ── Persistence ────────────────────────────────────────────────────────────

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

async function persistLayout(layout: DashboardLayoutConfig): Promise<boolean> {
  let ok = true;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    console.warn('[CardLibrary] localStorage save failed:', err);
    ok = false;
  }
  try {
    await (window as any).deskflowAPI?.setPreference?.(LAYOUT_KEY, layout);
  } catch {
    // Bridge absent — localStorage already written
  }
  return ok;
}

async function loadPresets(): Promise<Array<{ id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }>> {
  try {
    const api = (window as any).deskflowAPI;
    if (api?.getPreferences) {
      const prefs = await api.getPreferences();
      const stored = prefs?.[PRESETS_KEY];
      if (Array.isArray(stored)) return stored;
    }
  } catch {
    // Fall through
  }
  const local = readLocal<Array<{ id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }>>(PRESETS_KEY);
  return local ?? [];
}

async function persistPresets(presets: Array<{ id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }>): Promise<boolean> {
  let ok = true;
  const user = presets.filter(p => p.id !== 'default');
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(user));
  } catch {
    ok = false;
  }
  try {
    await (window as any).deskflowAPI?.setPreference?.(PRESETS_KEY, user);
  } catch {
    // Bridge absent
  }
  return ok;
}

function migrateLayout(stored: DashboardLayoutConfig): DashboardLayoutConfig {
  const next: DashboardLayoutConfig = {
    ...stored,
    schemaVersion: DEFAULT_LAYOUT.schemaVersion,
    widgetOrder: Array.isArray(stored.widgetOrder) ? [...stored.widgetOrder] : [...DEFAULT_LAYOUT.widgetOrder],
    widgetVisibility: { ...(stored.widgetVisibility ?? {}) },
    gridPositions: { ...(stored.gridPositions ?? {}) },
  };
  if ((stored.schemaVersion ?? 0) < DEFAULT_LAYOUT.schemaVersion) {
    next.widgetVisibility['momentum-hero'] = true;
    if (!next.widgetOrder.includes('momentum-hero')) next.widgetOrder.push('momentum-hero');
  }
  for (const id of DEFAULT_LAYOUT.widgetOrder) {
    if (!next.widgetOrder.includes(id)) {
      next.widgetOrder.push(id);
      if (next.widgetVisibility[id] === undefined) {
        next.widgetVisibility[id] = DEFAULT_LAYOUT.widgetVisibility[id] ?? true;
      }
    }
  }
  return next;
}

function isValidLayout(v: any): v is DashboardLayoutConfig {
  return !!v && Array.isArray(v.widgetOrder) && typeof v.widgetVisibility === 'object' && v.widgetVisibility !== null;
}

// ── Size helpers ────────────────────────────────────────────────────────────

function getAvailableSizes(widget: WidgetConfig): WidgetSize[] {
  const result: WidgetSize[] = [];
  for (const preset of SIZE_PRESETS) {
    if (preset.cols >= widget.minSize.cols && preset.cols <= widget.maxSize.cols &&
        preset.rows >= widget.minSize.rows && preset.rows <= widget.maxSize.rows) {
      result.push(preset);
    }
  }
  return result;
}

function sizeLabel(size: WidgetSize): string {
  return `${size.cols}×${size.rows}`;
}

// ── Visual column picker ─────────────────────────────────────────────────────

function ColumnPicker({ columns, onChange }: { columns: number; onChange: (n: number) => void }) {
  const vals = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  return (
    <div className="flex items-center gap-2">
      <LayoutDashboard size={13} className="text-[var(--text-muted)] shrink-0" />
      <span className="text-[11px] text-[var(--text-muted)]">Columns</span>
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-card)] p-0.5">
        {vals.map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            aria-label={`${v} columns`}
            aria-pressed={columns === v}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[12px] font-mono font-medium transition-colors ${
              columns === v
                ? 'bg-[var(--page-accent)]/20 text-[var(--page-accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list';
type CategoryFilter = 'all' | WidgetConfig['category'];

/** Natural (un-squeezed) render size for a widget inside a preview cell. */
const PREVIEW_NATURAL_W = 300;
const PREVIEW_NATURAL_H = 260;

interface CardLibraryProps {
  onChanged?: (layout: DashboardLayoutConfig) => void;
  onSaved?: () => void;
  previews?: Record<string, ReactNode>;
  onClose?: () => void;
  /** Real dashboard data — required so widget previews render actual content, not blanks. */
  data?: DashboardData;
}

// ── Component ──────────────────────────────────────────────────────────────

export function CardLibrary({ onChanged, onSaved, previews, onClose, data }: CardLibraryProps) {
  // Single source of truth: the same hook the dashboard renders with.
  const { isVisible, toggleVisible } = useDashboardLayout();
  // ── State ────────────────────────────────────────────────────────────────

  const [layout, setLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [savedLayout, setSavedLayout] = useState<DashboardLayoutConfig>(DEFAULT_LAYOUT);
  const [presets, setPresets] = useState<Array<{ id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }>>([]);
  const [activePresetId, setActivePresetId] = useState<string>('default');
  const [editMode, setEditMode] = useState(true); // Always editable in this version
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [dragSource, setDragSource] = useState<{ widgetId: string } | null>(null);
  const [dragOverDashboard, setDragOverDashboard] = useState(false);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [resizingWidget, setResizingWidget] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  // Measured width of the preview grid — used to scale each widget down to fit
  // its cell. Widgets lay out at NATURAL_W and are visually shrunk, so their
  // internal stat rows never collide the way they do when squeezed narrow.
  const [gridW, setGridW] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setGridW(e.contentRect.width);
    });
    ro.observe(el);
    setGridW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // ── Load saved state ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedLayout, storedPresets] = await Promise.all([loadStoredLayout(), loadPresets()]);
      if (cancelled) return;
      setLayout(storedLayout);
      setSavedLayout(storedLayout);
      setPresets(storedPresets.length > 0 ? storedPresets : []);
      const match = storedPresets.find(p => JSON.stringify(p.layout) === JSON.stringify(storedLayout));
      setActivePresetId(match?.id ?? 'custom');
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);

  // ── Widget helpers ────────────────────────────────────────────────────────

  const allWidgets = WidgetRegistry.getAll();
  // Truth comes from useDashboardLayout — the SAME hook the dashboard renders
  // with. Reading it from the library's own layout was why the two disagreed and
  // cards appeared on the dashboard that the user had never switched on.
  const visibleWidgets = allWidgets.filter(w => {
    const dashId = toDashboardId(w.id);
    if (!dashId) return false;                 // no dashboard equivalent -> not "on"
    return isVisible(dashId);
  });
  const hiddenWidgets = allWidgets.filter(w => {
    const dashId = toDashboardId(w.id);
    if (!dashId) return false;                 // cannot render at all -> don't offer it
    return !isVisible(dashId);
  });

  const filteredHiddenWidgets = hiddenWidgets.filter(w => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
    }
    if (categoryFilter !== 'all') {
      return w.category === categoryFilter;
    }
    return true;
  });

  const filteredVisibleWidgets = visibleWidgets.filter(w => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q);
    }
    return true;
  });

  const isWidgetVisible = (id: string): boolean => {
    return layout.widgetVisibility[id] !== false && layout.widgetOrder.includes(id);
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const addWidget = useCallback((widgetId: string) => {
    const config = WidgetRegistry.get(widgetId);
    let next: DashboardLayoutConfig;
    setLayout(prev => {
      if (prev.widgetOrder.includes(widgetId)) {
        next = { ...prev, widgetVisibility: { ...prev.widgetVisibility, [widgetId]: true } };
        return next;
      }
      const pos = prev.gridPositions[widgetId];
      next = {
        ...prev,
        widgetOrder: [...prev.widgetOrder, widgetId],
        widgetVisibility: { ...prev.widgetVisibility, [widgetId]: true },
        gridPositions: {
          ...prev.gridPositions,
          [widgetId]: pos || {
            col: 0,
            row: prev.rows,
            colSpan: config?.defaultSize?.cols || 1,
            rowSpan: config?.defaultSize?.rows || 1,
          },
        },
      };
      return next;
    });
    setSavedLayout(prev => {
      if (prev.widgetOrder.includes(widgetId)) {
        return { ...prev, widgetVisibility: { ...prev.widgetVisibility, [widgetId]: true } };
      }
      const pos = prev.gridPositions[widgetId];
      return {
        ...prev,
        widgetOrder: [...prev.widgetOrder, widgetId],
        widgetVisibility: { ...prev.widgetVisibility, [widgetId]: true },
        gridPositions: {
          ...prev.gridPositions,
          [widgetId]: pos || {
            col: 0,
            row: prev.rows,
            colSpan: config?.defaultSize?.cols || 1,
            rowSpan: config?.defaultSize?.rows || 1,
          },
        },
      };
    });
    setActivePresetId('custom');
    onChanged?.(next!);
  }, [onChanged]);

  const removeWidget = useCallback((widgetId: string) => {
    let next: DashboardLayoutConfig;
    setLayout(prev => {
      next = {
        ...prev,
        widgetOrder: prev.widgetOrder.filter(id => id !== widgetId),
        widgetVisibility: { ...prev.widgetVisibility, [widgetId]: false },
      };
      return next;
    });
    setSavedLayout(prev => ({
      ...prev,
      widgetOrder: prev.widgetOrder.filter(id => id !== widgetId),
      widgetVisibility: { ...prev.widgetVisibility, [widgetId]: false },
    }));
    setActivePresetId('custom');
    onChanged?.(next!);
  }, [onChanged]);

  const toggleWidget = useCallback((widgetId: string) => {
    // Drive the dashboard's own hook — that is what the renderer reads. The
    // library's own layout object only tracks grid position, not visibility.
    const dashId = toDashboardId(widgetId);
    if (!dashId) return;               // nothing on the dashboard renders this
    toggleVisible(dashId);
    const visible = !isWidgetVisible(widgetId);
    if (visible) {
      addWidget(widgetId);
    } else {
      removeWidget(widgetId);
    }
  }, [addWidget, removeWidget, toggleVisible]);

  const resizeWidget = useCallback((widgetId: string, size: WidgetSize) => {
    const config = WidgetRegistry.get(widgetId);
    const current = layout.gridPositions[widgetId] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
    setLayout(prev => ({
      ...prev,
      gridPositions: {
        ...prev.gridPositions,
        [widgetId]: {
          ...current,
          colSpan: Math.max(config?.minSize?.cols || 1, Math.min(prev.columns, size.cols)),
          rowSpan: Math.max(config?.minSize?.rows || 1, Math.min(6, size.rows)),
        },
      },
    }));
    setSavedLayout(prev => ({
      ...prev,
      gridPositions: {
        ...prev.gridPositions,
        [widgetId]: {
          ...current,
          colSpan: Math.max(config?.minSize?.cols || 1, Math.min(prev.columns, size.cols)),
          rowSpan: Math.max(config?.minSize?.rows || 1, Math.min(6, size.rows)),
        },
      },
    }));
    setActivePresetId('custom');
  }, [layout]);

  const setColumns = useCallback((columns: number) => {
    setLayout(prev => ({ ...prev, columns: Math.max(4, Math.min(12, columns)) }));
    setSavedLayout(prev => ({ ...prev, columns: Math.max(4, Math.min(12, columns)) }));
    setActivePresetId('custom');
  }, []);

  const resetToDefault = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    setSavedLayout(DEFAULT_LAYOUT);
    setActivePresetId('default');
    onChanged?.(DEFAULT_LAYOUT);
  }, [onChanged]);

  const saveAsPreset = useCallback(async () => {
    const name = presetName.trim();
    if (!name) return;
    setIsSavingPreset(true);
    try {
      const newPreset: { id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number } = {
        id: `preset-${Date.now()}`,
        name,
        layout,
        updatedAt: Date.now(),
      };
      const updated = [...presets, newPreset];
      setPresets(updated);
      await persistPresets(updated);
      setActivePresetId(newPreset.id);
      setPresetName('');
    } catch {
      setSaveError('Failed to save preset');
    }
    setIsSavingPreset(false);
  }, [presetName, layout, presets]);

  const applyPreset = useCallback((preset: { id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }) => {
    setLayout(preset.layout);
    setSavedLayout(preset.layout);
    setActivePresetId(preset.id);
    onChanged?.(preset.layout);
  }, [onChanged]);

  const deletePreset = useCallback(async (id: string) => {
    if (id === 'default') return;
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    await persistPresets(updated);
    if (activePresetId === id) {
      setActivePresetId('custom');
    }
  }, [presets, activePresetId]);

  const handleDragStart = useCallback((e: React.DragEvent, widgetId: string) => {
    e.dataTransfer.setData('text/plain', widgetId);
    e.dataTransfer.effectAllowed = 'copy';
    setDragSource({ widgetId });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragSource) {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverDashboard(true);
    }
  }, [dragSource]);

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setDragOverDashboard(false);
      dragCounterRef.current = 0;
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDashboard(false);
    dragCounterRef.current = 0;
    const widgetId = e.dataTransfer.getData('text/plain');
    if (widgetId && WidgetRegistry.get(widgetId)) {
      addWidget(widgetId);
    }
    setDragSource(null);
  }, [addWidget]);

  const handleDragEnd = useCallback(() => {
    setDragSource(null);
    setDragOverDashboard(false);
    dragCounterRef.current = 0;
  }, []);

  // ── Render: Header ────────────────────────────────────────────────────────

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--page-accent)]">
          Dashboard Cards
        </div>
        <h1 className="text-[18px] font-semibold text-[var(--text-primary)] mt-0.5">
          Customize your dashboard
        </h1>
        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
          Add cards from the library on the left. Drag to reorder on the right.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={resetToDefault}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-card)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--page-accent)]/30 transition-colors"
        >
          <RotateCcw size={13} />
          Reset
        </button>
        <button
          onClick={() => { persistLayout(layout); onChanged?.(layout); onSaved?.(); }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--page-accent)]/40 bg-[var(--page-accent)]/15 px-3 py-1.5 text-[12px] font-medium text-[var(--page-accent)] hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!dirty}
        >
          <Save size={13} />
          Save
        </button>
        <button
          onClick={() => onClose?.()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--page-accent)]/30 transition-colors"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );

  // ── Render: Toolbar ───────────────────────────────────────────────────────

  const renderToolbar = () => {
    const activePreset = presets.find(p => p.id === activePresetId);
    return (
      <div className="flex flex-wrap items-center gap-3 mb-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cards..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-transparent pl-8 pr-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:[var(--text-muted)] focus:border-[var(--page-accent)]/50 focus:outline-none"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1">
          <Filter size={13} className="text-[var(--text-muted)]" />
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                categoryFilter === cat.value
                  ? 'bg-[var(--page-accent)]/15 text-[var(--page-accent)] border border-[var(--page-accent)]/30'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <cat.icon size={12} />
              {cat.label}
            </button>
          ))}
          <button
            onClick={() => setCategoryFilter('all')}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              categoryFilter === 'all'
                ? 'bg-zinc-800 text-white border border-zinc-700'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            All
          </button>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-3 ml-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-[var(--page-accent)]/15 text-[var(--page-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-[var(--page-accent)]/15 text-[var(--page-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <List size={14} />
          </button>
        </div>

        {/* Column picker */}
        <div className="flex items-center gap-2 border-l border-[var(--border-subtle)] pl-3 ml-1">
          <ColumnPicker columns={layout.columns} onChange={setColumns} />
        </div>

        {/* Active preset */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-[var(--text-muted)]">
            {visibleWidgets.length} of {allWidgets.length} cards
          </span>
          {activePreset && (
            <div className="relative">
              <button
                onClick={() => {}}
                className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {activePreset.name}
                <ChevronDown size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render: Available Widgets Panel ───────────────────────────────────────

  const renderAvailableWidgets = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
          Available Cards
          <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
            ({filteredHiddenWidgets.length})
          </span>
        </h2>
        <span className="text-[11px] text-[var(--text-muted)]">
          Click a card to add it
        </span>
      </div>

      {filteredHiddenWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--color-card)]/50 p-8 text-center min-h-[200px]">
          <Box size={24} className="text-[var(--text-muted)] mb-2 opacity-50" />
          <p className="text-[12px] text-[var(--text-secondary)]">
            {searchQuery || categoryFilter !== 'all'
              ? 'No matching cards found.'
              : 'All cards are already on your dashboard.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 flex-1 min-h-0 content-start overflow-y-auto">
          {filteredHiddenWidgets.map(widget => {
            const theme = getWidgetTheme(widget.id);
            const WidgetIcon = getIcon(widget.icon);
            const availableSizes = getAvailableSizes(widget);

            return (
              <motion.div
                key={widget.id}
                draggable
                onDragStart={e => handleDragStart(e, widget.id)}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className={`group relative rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-3 cursor-pointer transition-colors duration-150 hover:-translate-y-0.5 hover:border-[var(--page-accent)]/30 ${
                  dragSource?.widgetId === widget.id ? 'ring-2 ring-[var(--page-accent)]/50 scale-105' : ''
                }`}
                onClick={() => addWidget(widget.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    addWidget(widget.id);
                  }
                }}
                aria-label={`Add ${widget.name} to dashboard`}
                aria-pressed={isWidgetVisible(widget.id)}
              >
                {/* Drag handle */}
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={12} className="text-[var(--text-muted)]" />
                </div>

                {/* Icon */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: theme.tint, color: theme.accent }}
                  >
                    <WidgetIcon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      {theme.kicker}
                    </div>
                    <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                      {widget.name}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-[var(--text-secondary)] leading-snug line-clamp-2 mb-2">
                  {widget.description}
                </p>

                {/* Size indicator */}
                {availableSizes.length > 0 && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      Size:
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                      {sizeLabel(widget.defaultSize)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      ({widget.category})
                    </span>
                  </div>
                )}

                {/* Add button */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); addWidget(widget.id); }}
                  className="mt-1 w-full flex items-center justify-center gap-1 rounded-md border border-[var(--page-accent)]/30 bg-[var(--page-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--page-accent)] hover:bg-[var(--page-accent)]/20 transition-colors"
                >
                  <Plus size={10} />
                  Add to dashboard
                </button>

                {/* Preview button */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setPreviewId(widget.id); }}
                  className="mt-0.5 w-full flex items-center justify-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--page-accent)]/30 transition-colors"
                >
                  <Eye size={9} />
                  Preview
                </button>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1 flex-1 min-h-0 content-start overflow-y-auto">
          {filteredHiddenWidgets.map(widget => {
            const theme = getWidgetTheme(widget.id);
            const WidgetIcon = getIcon(widget.icon);

            return (
              <motion.div
                key={widget.id}
                draggable
                onDragStart={e => handleDragStart(e, widget.id)}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className={`group flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] px-3 py-2.5 cursor-pointer transition-colors duration-150 hover:-translate-x-0.5 hover:border-[var(--page-accent)]/30 ${
                  dragSource?.widgetId === widget.id ? 'ring-2 ring-[var(--page-accent)]/50' : ''
                }`}
                onClick={() => addWidget(widget.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    addWidget(widget.id);
                  }
                }}
              >
                <GripVertical size={14} className="text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: theme.tint, color: theme.accent }}
                >
                  <WidgetIcon size={13} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                      {widget.name}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {sizeLabel(widget.defaultSize)}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {theme.kicker} · {widget.category}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">
                    {widget.description}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); addWidget(widget.id); }}
                    className="p-1.5 rounded-md bg-[var(--page-accent)]/15 text-[var(--page-accent)] hover:opacity-90 transition-opacity"
                    aria-label="Add to dashboard"
                  >
                    <Plus size={11} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setPreviewId(widget.id); }}
                    className="p-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--page-accent)]/30 transition-colors"
                    aria-label="Preview"
                  >
                    <Eye size={11} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Render: Dashboard Preview Panel ───────────────────────────────────────

  const renderDashboardPreview = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
          Your Dashboard
          <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
            ({visibleWidgets.length})
          </span>
          </h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-muted)]">
            Hover a card for options
          </span>
        </div>
      </div>

      {visibleWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--color-card)]/50 p-8 text-center min-h-[200px]">
          <LayoutDashboard size={24} className="text-[var(--text-muted)] mb-2 opacity-50" />
          <p className="text-[12px] text-[var(--text-secondary)]">
            Your dashboard is empty.
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Add cards from the available list on the left.
          </p>
        </div>
      ) : (
        <div
          ref={gridRef}
          className={`relative rounded-xl border-2 transition-colors ${
            dragOverDashboard ? 'border-[var(--page-accent)] bg-[var(--page-accent)]/5' : 'border-[var(--border-subtle)]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          {/* Drop overlay */}
          <AnimatePresence>
            {dragOverDashboard && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-[var(--page-accent)]/10 rounded-xl pointer-events-none"
              >
                <div className="flex items-center gap-2 text-[var(--page-accent)]">
                  <Plus size={16} />
                  <span className="text-sm font-medium">Drop to add card</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid preview */}
          <div className="p-3 flex-1 min-h-0 overflow-y-auto">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
              }}
            >
              {visibleWidgets.map(widget => {
                const position = layout.gridPositions[widget.id] || { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
                const currentSize = { cols: position.colSpan, rows: position.rowSpan };
                const availableSizes = getAvailableSizes(widget);
                const selectedSize = availableSizes.find(s => s.cols === currentSize.cols && s.rows === currentSize.rows);

                const FallbackComponent = WidgetRegistry.get(widget.id)?.component;

                // Scale the widget to fit its grid cell. The widget renders at
                // NATURAL_W/NATURAL_H (its real proportions) and is scaled down,
                // so text never overlaps the way it does when the cell squeezes it.
                const GAP = 8;
                const ROW_UNIT = 68;
                const cellW = gridW > 0
                  ? (gridW - GAP * (layout.columns - 1)) / layout.columns * position.colSpan + GAP * (position.colSpan - 1)
                  : 0;
                const scale = cellW > 0 ? Math.min(1, cellW / PREVIEW_NATURAL_W) : 0;
                const cellH = position.rowSpan * ROW_UNIT;

                return (
                  <motion.div
                    key={widget.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="relative group rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] overflow-hidden"
                    style={{
                      gridColumn: `span ${position.colSpan}`,
                      gridRow: `span ${position.rowSpan}`,
                    }}
                  >
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeWidget(widget.id)}
                      className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error)]/15 text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--error)]/25"
                      aria-label={`Remove ${widget.name}`}
                    >
                      <X size={10} />
                    </button>

                    {/* Actual widget component preview — real component, real context data,
                        laid out at natural size then scaled to fit the cell */}
                    {FallbackComponent ? (
                      <div
                        className="overflow-hidden"
                        style={{ height: cellH }}
                      >
                        <div
                          style={{
                            width: PREVIEW_NATURAL_W,
                            height: PREVIEW_NATURAL_H,
                            transform: scale ? `scale(${scale})` : undefined,
                            transformOrigin: 'top left',
                            pointerEvents: 'none',
                          }}
                        >
                          <FallbackComponent />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 flex items-center justify-center h-full">
                        <p className="text-[10px] text-[var(--text-muted)]">{widget.name}</p>
                      </div>
                    )}

                    {/* Size indicator + resize controls */}
                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1 bg-gradient-to-t from-[var(--color-card)] via-[var(--color-card)]/90 to-transparent pt-4 pb-1 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">
                        {sizeLabel(currentSize)}
                        {selectedSize ? ` · ${availableSizes.length} opts` : ''}
                      </span>
                      {editMode && availableSizes.length > 1 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setResizingWidget(widget.id);
                            setSelectedSizeId(`${widget.id}-size`);
                          }}
                          className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--color-card)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--page-accent)]/30 transition-colors"
                        >
                          <Grid3X3 size={8} />
                          Resize
                          <ChevronDown size={8} />
                        </button>
                      )}
                    </div>

                    {/* Size dropdown */}
                    <AnimatePresence initial={false}>
                      {resizingWidget === widget.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute bottom-full left-1 mb-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-card)] p-1.5 shadow-lg z-20 min-w-[120px]"
                        >
                          <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)] px-1.5 py-0.5">
                            Choose size
                          </div>
                          {availableSizes.map(size => (
                            <button
                              key={`${size.cols}-${size.rows}`}
                              onClick={() => {
                                resizeWidget(widget.id, size);
                                setResizingWidget(null);
                              }}
                              className={`flex items-center justify-between w-full px-1.5 py-1 rounded-md text-left transition-colors ${
                                selectedSize?.cols === size.cols && selectedSize?.rows === size.rows
                                  ? 'bg-[var(--page-accent)]/15 text-[var(--page-accent)]'
                                  : 'hover:bg-white/[0.04]'
                              }`}
                            >
                              <span className="text-[10px] font-medium">
                                {sizeLabel(size)}
                              </span>
                              <Check
                                size={8}
                                className={selectedSize?.cols === size.cols && selectedSize?.rows === size.rows ? 'text-[var(--page-accent)]' : 'opacity-0'}
                              />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Drag handle for reorder (visual only — full DnD in WidgetGrid) */}
                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical size={8} className="text-[var(--text-muted)]" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render: Preview Modal ─────────────────────────────────────────────────

  const renderPreviewModal = () => {
    if (!previewId) return null;
    const widget = WidgetRegistry.get(previewId);
    if (!widget) return null;
    const theme = getWidgetTheme(previewId);
    const WidgetIcon = getIcon(widget.icon);
    const visible = isWidgetVisible(previewId);
    const Fallback = widget.component;

    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => setPreviewId(null)}
      >
        <motion.div
          className="relative w-full max-w-[640px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-card)] overflow-hidden shadow-2xl"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: theme.tint, color: theme.accent }}
              >
                <WidgetIcon size={16} />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--page-accent)]">
                  {theme.kicker}
                </div>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {widget.name}
                </h3>
              </div>
            </div>
            <button
              onClick={() => setPreviewId(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] transition-colors"
              aria-label="Close preview"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
              {widget.description}
            </p>

            <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] mb-4">
              <span className="flex items-center gap-1">
                <Box size={10} />
                {sizeLabel(widget.defaultSize)}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays size={10} />
                {widget.category}
              </span>
              <span className={`flex items-center gap-1 ${visible ? 'text-[var(--success)]' : ''}`}>
                <Check size={10} />
                {visible ? 'On dashboard' : 'Not on dashboard'}
              </span>
            </div>

            {/* Live preview or fallback */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white/[0.02] p-4 min-h-[120px]">
              {previews?.[previewId] ?? (Fallback ? <Fallback /> : (
                <div className="flex flex-col items-center justify-center text-center h-full min-h-[100px]">
                  <WidgetIcon size={32} className="text-[var(--text-muted)] mb-2 opacity-40" />
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Preview not available
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-5 py-3">
            <button
              onClick={() => { toggleWidget(previewId); setPreviewId(null); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors ${
                visible
                  ? 'border border-[var(--border-subtle)] bg-[var(--color-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--error)]/30'
                  : 'bg-[var(--page-accent)] text-white hover:opacity-90'
              }`}
            >
              {visible ? (
                <>
                  <Trash2 size={13} />
                  Remove from dashboard
                </>
              ) : (
                <>
                  <Check size={13} />
                  Use this card
                </>
              )}
            </button>
            <button
              onClick={() => setPreviewId(null)}
              className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // ── Render: Presets Panel ──────────────────────────────────────────────────

  const renderPresetsPanel = () => {
    const customPresets = presets.filter(p => p.id !== 'default');

    return (
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[12px] font-semibold text-[var(--text-secondary)]">
            Layout Presets
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAsPreset(); }}
              placeholder="Name this layout..."
              maxLength={40}
              className="flex-1 min-w-[160px] rounded-md border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] placeholder:[var(--text-muted)] focus:border-[var(--page-accent)]/50 focus:outline-none"
            />
            <button
              onClick={saveAsPreset}
              disabled={!presetName.trim() || isSavingPreset}
              className="flex items-center gap-1 rounded-md bg-[var(--page-accent)]/15 border border-[var(--page-accent)]/30 px-2.5 py-1.5 text-[11px] font-medium text-[var(--page-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90"
            >
              {isSavingPreset ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Save size={11} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>

        {customPresets.length > 0 ? (
          <div className="space-y-1.5">
            {customPresets.map(preset => (
              <div
                key={preset.id}
                className="flex items-center justify-between group rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] px-3 py-2 transition-colors hover:border-[var(--page-accent)]/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => applyPreset(preset)}
                    className={`text-[11px] font-medium transition-colors ${
                      activePresetId === preset.id
                        ? 'text-[var(--page-accent)]'
                        : 'text-[var(--text-primary)] hover:text-[var(--page-accent)]'
                    }`}
                  >
                    {preset.name}
                  </button>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {preset.layout.widgetOrder.filter(id => preset.layout.widgetVisibility[id] !== false).length} cards · {preset.layout.columns} cols
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {activePresetId !== preset.id && (
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                      aria-label={`Delete preset ${preset.name}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                  <Check
                    size={11}
                    className={`${activePresetId === preset.id ? 'text-[var(--page-accent)]' : 'opacity-0'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)] italic">
            No saved presets yet. Save your current layout above.
          </p>
        )}
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────

  const innerContent = (
    <div
      className="relative w-full max-w-[1600px] max-h-[92vh] rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-card)] shadow-2xl overflow-hidden flex flex-col"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[var(--border-subtle)]">
        {renderHeader()}
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 py-2">
        {renderToolbar()}
      </div>

      {/* Main content — two columns */}
      <div className="flex-1 min-h-[360px] overflow-hidden">
        <div className="flex h-full">
          {/* Available widgets — left panel */}
          <div className="w-[380px] flex-shrink-0 border-r border-[var(--border-subtle)] min-h-0">
            <div className="h-full min-h-0 overflow-hidden">
              {renderAvailableWidgets()}
            </div>
          </div>

          {/* Dashboard preview — right panel */}
          <div className="flex-1 min-w-0">
            <div className="h-full min-h-0 overflow-hidden">
              {renderDashboardPreview()}
            </div>
          </div>
        </div>
      </div>

      {/* Presets panel */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-[var(--border-subtle)]">
        {renderPresetsPanel()}
      </div>

      {/* Save error */}
      {saveError && (
        <div className="flex-shrink-0 px-4 py-1.5">
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300">
            {saveError}
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewId && renderPreviewModal()}
    </div>
  );

  if (!data) return null;

  return (
    <DashboardDataProvider value={data}>
    <AnimatePresence>
      {onClose ? (
        // When wrapped by parent modal, render just the content (no overlay)
        innerContent
      ) : (
        // Standalone: render full overlay
        <motion.div
          key="card-library-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => onClose?.()}
        >
          {innerContent}
        </motion.div>
      )}
    </AnimatePresence>
    </DashboardDataProvider>
  );
}

export async function loadCardLayout(): Promise<DashboardLayoutConfig | null> {
  let stored: any = null;
  try {
    const api = (window as any).deskflowAPI;
    if (api?.getPreferences) {
      const prefs = await api.getPreferences();
      const storedPrefs = prefs?.[LAYOUT_KEY];
      if (storedPrefs?.schemaVersion === DEFAULT_LAYOUT.schemaVersion) return storedPrefs;
      if (isValidLayout(storedPrefs)) stored = storedPrefs;
    }
  } catch (err) {
    console.warn('[CardLibrary] getPreferences failed, falling back to localStorage:', err);
  }
  if (!stored) {
    const local = readLocal<DashboardLayoutConfig>(LAYOUT_KEY);
    if (isValidLayout(local)) stored = local;
  }
  if (!stored) return null;
  const migrated = migrateLayout(stored);
  if ((stored.schemaVersion ?? 0) !== migrated.schemaVersion || stored.widgetOrder.length !== migrated.widgetOrder.length) {
    await persistLayout(migrated);
  }
  return migrated;
}

export const CLASSIC_IDS = [
  'status-band',
  'momentum-hero',
  'tier-breakdown',
  'pinned-activities',
  'goals-card',
  'focus-card',
  'deadlines-card',
  'schedule-hero',
  'insight-strip',
  'productivity-chart',
  'activity-feed',
];
