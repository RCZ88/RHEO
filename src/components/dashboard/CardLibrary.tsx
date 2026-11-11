// RHEO Dashboard — CardLibrary (Workbench revamp — direction C)
// Customization UI where every card shows its real shape first: per-widget
// identity (accent + kicker + preview kind), on-card opt-in switch, dashboard-
// accurate size chips, live dashboard mirror. Sources: Vengeance expandable-bento
// (card→overlay preview), Animate UI motion law (exits faster than entrances,
// transform/opacity only), Uiverse knob mechanic re-skinned to LAMINAR.
//
// LAMINAR: chrome single-hue (--page-accent); each card's OWN accent is data
// identity from widgetTheme.ts, one signal per card; radii 8/12/pill; no glass,
// no springs; prefers-reduced-motion honored.
//
// Stack: shadcn/ui (base-nova) · motion v12 · lucide-react · Tailwind v4

import { useState, useEffect, useCallback, useRef, type ReactNode, type DragEvent as ReactDragEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Calendar, Sparkles, Target, AlertCircle, Zap, BarChart3,
  Pin, Moon, Brain, Orbit, Clock, Flame, ArrowRight, CalendarDays, Box,
  Check, Eye, X, Search, Grid3X3, List, ChevronDown,
  Plus, Trash2, Save, RotateCcw, LayoutDashboard, Filter,
  Bot, Terminal, Wallet, Globe, Shield, Trophy, BookOpen, ClipboardCheck,
  CalendarSync, Layers, Gauge,
} from 'lucide-react';
import { WidgetRegistry, DEFAULT_LAYOUT, type DashboardLayoutConfig, type WidgetConfig } from './WidgetRegistry';
import { DashboardDataProvider, type DashboardData } from './DashboardContext';
import { getWidgetTheme } from './widgetTheme';
import './registerWidgets';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { ROW_TEMPLATES, OPT_IN_WIDGETS, toDashboardId } from './widgetRegistry';

// ── Constants ──────────────────────────────────────────────────────────────

const LAYOUT_KEY = 'dashboard_layout';
const PRESETS_KEY = 'dashboard_widget_presets';

const ICON_MAP: Record<string, any> = {
  Activity, Calendar, Sparkles, Target, AlertCircle, Zap, BarChart3,
  Pin, Moon, Brain, Orbit, Clock, Flame, ArrowRight, CalendarDays, Box,
  Bot, Terminal, Wallet, Globe, Shield, Trophy, BookOpen, ClipboardCheck,
  CalendarSync, Layers, Gauge,
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

// ── Persistence ────────────────────────────────────────────────────────────

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
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
  } catch (err) {
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

// ── Workbench data: sizes straight from the live dashboard geometry ────────
//
// The v4 gridPositions the old resize control wrote are NOT read by the
// dashboard (it renders ROW_TEMPLATES + the shared layout store), so a size
// chosen there was theater. The honest "size" of a card is the w×h share its
// row template gives it — displayed here, never edited.

const TEMPLATE_SIZE: Map<string, { w: number; h: number }> = new Map();
for (const row of ROW_TEMPLATES) {
  for (const cell of row.cells) TEMPLATE_SIZE.set(cell.id, { w: cell.w, h: cell.h });
}
for (const opt of OPT_IN_WIDGETS) TEMPLATE_SIZE.set(opt.id, { w: opt.w, h: opt.h });

function templateSizeLabel(id: string, fallback: string): string {
  const t = TEMPLATE_SIZE.get(id);
  return t ? `${t.w}×${t.h}` : fallback;
}

/** Wide cards — the row-template widgets that span most of a dashboard row. */
const WIDE_CARDS = new Set<string>([
  'status-band', 'schedule-hero', 'insight-strip', 'tier-breakdown',
  'pinned-activities', 'productivity-chart', 'activity-feed', 'momentum-hero',
  'app-ecosystem', 'schedule', 'insights', 'recent-sessions',
  'unified-goals', 'schedule-sync', 'health-widget', 'drilldown',
]);

/** Preview archetype per widget — the shape its data actually takes. */
type PreviewKind = 'live' | 'bars' | 'ring' | 'rows' | 'orbit' | 'terminal' | 'stats';
const PREVIEW_KIND: Record<string, PreviewKind> = {
  'status-band': 'live',
  'productivity-chart': 'bars', 'sleep-bar': 'bars', 'streak': 'bars', 'health-widget': 'bars',
  'momentum-hero': 'ring', 'goals-card': 'ring', 'focus-card': 'ring', 'quick-focus': 'ring',
  'mastery-ring': 'ring', 'momentum-orb': 'ring', 'momentum-score': 'ring',
  'deadlines-card': 'rows', 'notes-card': 'rows', 'activity-feed': 'rows', 'recent-sessions': 'rows',
  'schedule-hero': 'rows', 'schedule': 'rows', 'unified-goals': 'rows', 'schedule-sync': 'rows',
  'insight-strip': 'rows', 'insights': 'rows', 'daily-survey': 'rows', 'vcalendar': 'rows',
  'app-ecosystem': 'orbit', 'tier-breakdown': 'orbit', 'pinned-activities': 'orbit',
  'browser-widget': 'orbit', 'brain-widget': 'orbit',
  'console-widget': 'terminal',
  'ai-usage': 'stats', 'finance-widget': 'stats', 'learn-widget': 'stats',
  'longest-focus': 'stats', 'covenant-widget': 'stats', 'spotlight': 'stats', 'drilldown': 'stats',
};

/** Deterministic per-id seed so same-kind cards still differ from each other. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h;
}

// ── Workbench preview shapes (CSS-only, one accent per card) ────────────────

function PreviewShape({ kind, accent, wide, seed }: { kind: PreviewKind; accent: string; wide: boolean; seed: number }) {
  const fill = (hue: string) => `linear-gradient(180deg, ${hue}, color-mix(in srgb, ${hue} 10%, transparent))`;
  const hair = 'rgba(250,250,250,0.09)';

  if (kind === 'live') {
    return (
      <div className="wl-pv" style={{ height: wide ? 76 : 62 }}>
        <div className="flex items-center gap-2 h-full px-3">
          <span className="wl-dot" style={{ background: accent }} />
          <span className="font-mono text-[15px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
            00:42:17
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full"
            style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>
            Tier II
          </span>
        </div>
      </div>
    );
  }

  if (kind === 'bars') {
    const hs = [0, 1, 2, 3, 4, 5].map(i => 28 + ((seed * (i + 3)) % 52));
    return (
      <div className="wl-pv" style={{ height: wide ? 76 : 62 }}>
        <div className="flex items-end gap-[5px] h-full px-3 pb-2 pt-2">
          {hs.map((h, i) => (
            <i key={i} className="wl-bar flex-1" style={{ height: `${h}%`, background: fill(accent) }} />
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'ring') {
    const pct = 52 + (seed % 38);
    return (
      <div className="wl-pv" style={{ height: wide ? 76 : 62 }}>
        <div className="flex items-center justify-center h-full relative">
          <span className="wl-ring" style={{
            width: wide ? 54 : 44, height: wide ? 54 : 44,
            background: `conic-gradient(${accent} 0 ${pct}%, rgba(250,250,250,0.08) ${pct}% 100%)`,
          }} />
          <span className="absolute font-mono text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {pct}
          </span>
        </div>
      </div>
    );
  }

  if (kind === 'rows') {
    const widths = [100, 62 + (seed % 20), 40 + (seed % 18)];
    return (
      <div className="wl-pv" style={{ height: wide ? 76 : 62 }}>
        <div className="flex flex-col justify-center gap-[7px] h-full px-3">
          {widths.map((w, i) => (
            <i key={i} className="block h-[6px] rounded-[3px]" style={{ width: `${w}%`, background: i === 0 ? fill(accent) : hair }} />
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'orbit') {
    const flexes = [3, 2, 1].map((f, i) => (f + ((seed >> i) % 2)));
    return (
      <div className="wl-pv" style={{ height: wide ? 76 : 62 }}>
        <div className="flex gap-[6px] h-full px-3 py-3">
          {flexes.map((f, i) => (
            <i key={i} style={{
              flex: f, borderRadius: 6,
              background: i === 0
                ? `color-mix(in srgb, ${accent} 26%, transparent)`
                : 'rgba(250,250,250,0.07)',
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'terminal') {
    return (
      <div className="wl-pv" style={{ height: wide ? 76 : 62 }}>
        <div className="flex flex-col justify-center gap-[6px] h-full px-3 font-mono text-[9px] leading-none">
          <span style={{ color: 'var(--text-muted)' }}>~ rheo ▸ <span style={{ color: 'var(--text-secondary)' }}>build</span></span>
          <span style={{ color: accent }}>▸ <span className="wl-caret" style={{ background: accent }} /></span>
        </div>
      </div>
    );
  }

  // stats — hero numeral + two supporting rows
  const n = 3 + (seed % 7);
  return (
    <div className="wl-pv" style={{ height: wide ? 76 : 62 }}>
      <div className="flex items-center gap-3 h-full px-3">
        <span className="font-mono text-[19px] font-semibold tracking-tight" style={{ color: accent }}>{n}.{seed % 9}</span>
        <div className="flex flex-col gap-[6px] flex-1">
          <i className="block h-[5px] rounded-[3px] w-[72%]" style={{ background: hair }} />
          <i className="block h-[5px] rounded-[3px] w-[44%]" style={{ background: hair }} />
        </div>
      </div>
    </div>
  );
}

// ── On-card switch (Uiverse knob mechanic, LAMINAR skin) ────────────────────

function WorkbenchSwitch({ on, locked, accent, onChange, label }: {
  on: boolean; locked: boolean; accent: string; onChange: () => void; label: string;
}) {
  if (locked) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-1 rounded-full shrink-0"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
        Always on
      </span>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${on ? 'Remove' : 'Add'} ${label} ${on ? 'from' : 'to'} dashboard`}
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`wl-sw shrink-0 ${on ? 'wl-sw-on' : ''}`}
      style={on ? {
        background: `color-mix(in srgb, ${accent} 16%, transparent)`,
        borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
      } : undefined}
    >
      <i className="wl-sw-knob" style={on ? { background: accent } : undefined} />
    </button>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list';
type CategoryFilter = 'all' | WidgetConfig['category'];
type StateFilter = 'all' | 'on' | 'off';

/** Natural (un-squeezed) render size for a widget inside a preview cell. */
const PREVIEW_NATURAL_W = 300;
const PREVIEW_NATURAL_H = 260;
/** One dashboard "row" in px — converts ROW_TEMPLATES height units to pixels. */
const PREVIEW_ROW_H = 92;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [dragSource, setDragSource] = useState<{ widgetId: string } | null>(null);
  const [dragOverDashboard, setDragOverDashboard] = useState(false);

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

  // Close the preset popover on outside click
  useEffect(() => {
    if (!presetMenuOpen) return;
    const close = () => setPresetMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [presetMenuOpen]);

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
  const isOn = useCallback((id: string): boolean => {
    const dashId = toDashboardId(id);
    return !!dashId && isVisible(dashId);
  }, [isVisible]);

  const visibleWidgets = allWidgets.filter(w => isOn(w.id));

  const matchesFilters = (w: WidgetConfig, onState: boolean) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!w.name.toLowerCase().includes(q) && !w.description.toLowerCase().includes(q)) return false;
    }
    if (categoryFilter !== 'all' && w.category !== categoryFilter) return false;
    if (stateFilter === 'on' && !onState) return false;
    if (stateFilter === 'off' && onState) return false;
    return true;
  };

  const workbenchWidgets = allWidgets
    .filter(w => !!toDashboardId(w.id))      // cannot render at all -> not offered
    .filter(w => matchesFilters(w, isOn(w.id)));

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
      setPresetMenuOpen(false);
    } catch {
      setSaveError('Failed to save preset');
    }
    setIsSavingPreset(false);
  }, [presetName, layout, presets]);

  const applyPreset = useCallback((preset: { id: string; name: string; layout: DashboardLayoutConfig; updatedAt: number }) => {
    setLayout(preset.layout);
    setSavedLayout(preset.layout);
    setActivePresetId(preset.id);
    setPresetMenuOpen(false);
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
    <div className="flex items-center justify-between mb-3">
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--page-accent)]">
          Dashboard Cards
        </div>
        <h1 className="text-[17px] font-semibold text-[var(--text-primary)] mt-0.5">
          Compose your dashboard
        </h1>
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
          Every card shows its real shape — flip a switch to place it.
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
          className="flex items-center gap-1.5 rounded-lg border border-[var(--page-accent)]/40 bg-[var(--page-accent-15)] px-3 py-1.5 text-[12px] font-medium text-[var(--page-accent)] hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!dirty}
        >
          <Save size={13} />
          Save layout
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
    const seg = (value: StateFilter, label: string) => (
      <button
        onClick={() => setStateFilter(value)}
        aria-pressed={stateFilter === value}
        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
          stateFilter === value
            ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }`}
      >
        {label}
      </button>
    );
    return (
      <div className="flex flex-wrap items-center gap-3 mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[150px] max-w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cards…"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-transparent pl-8 pr-3 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--page-accent)]/50 focus:outline-none"
          />
        </div>

        {/* State segmented control — All / Off / On */}
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-card)] p-0.5">
          {seg('all', 'All')}
          {seg('off', 'Off')}
          {seg('on', 'On')}
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={13} className="text-[var(--text-muted)]" />
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(categoryFilter === cat.value ? 'all' : cat.value)}
              aria-pressed={categoryFilter === cat.value}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                categoryFilter === cat.value
                  ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)] border border-[var(--page-accent)]/30'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
              }`}
            >
              <cat.icon size={12} />
              {cat.label}
            </button>
          ))}
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-3 ml-1">
          <button
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <List size={14} />
          </button>
        </div>

        {/* Active preset — functional popover */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            {visibleWidgets.length}/{allWidgets.filter(w => !!toDashboardId(w.id)).length} on
          </span>
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setPresetMenuOpen(o => !o); }}
              aria-expanded={presetMenuOpen}
              className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {activePreset ? activePreset.name : 'Custom'}
              <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {presetMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-full mt-1 z-30 min-w-[180px] rounded-lg border border-[var(--border-subtle)] bg-[var(--color-card)] p-1 shadow-lg"
                  onClick={e => e.stopPropagation()}
                >
                  {presets.length === 0 ? (
                    <p className="px-2 py-1.5 text-[11px] text-[var(--text-muted)]">
                      No saved presets yet — save one below.
                    </p>
                  ) : (
                    presets.map(p => (
                      <div key={p.id} className="flex items-center gap-1">
                        <button
                          onClick={() => applyPreset(p)}
                          className={`flex-1 text-left px-2 py-1.5 rounded-md text-[11px] transition-colors ${
                            activePresetId === p.id
                              ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)]'
                              : 'text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {p.name}
                          <span className="ml-1.5 font-mono text-[9px] text-[var(--text-muted)]">
                            {p.layout.widgetOrder.filter(id => p.layout.widgetVisibility[id] !== false).length} cards
                          </span>
                        </button>
                        <button
                          onClick={() => deletePreset(p.id)}
                          aria-label={`Delete preset ${p.name}`}
                          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--error)]"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Workbench (available + placed, per-card identity) ─────────────

  const renderWorkbenchCard = (widget: WidgetConfig, idx: number) => {
    const theme = getWidgetTheme(widget.id);
    const WidgetIcon = getIcon(widget.icon);
    const on = isOn(widget.id);
    const locked = widget.id === 'status-band';
    const wide = WIDE_CARDS.has(widget.id);
    const kind = PREVIEW_KIND[widget.id] ?? 'stats';

    return (
      <motion.div
        key={widget.id}
        draggable
        onDragStart={e => handleDragStart(e as unknown as ReactDragEvent<HTMLDivElement>, widget.id)}
        onDragEnd={() => handleDragEnd()}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1], delay: Math.min(idx * 0.03, 0.3) }}
        className={`wl-card relative rounded-xl border bg-[var(--color-card)] overflow-hidden cursor-pointer ${wide ? 'col-span-2' : ''} ${
          on ? 'wl-card-on' : 'wl-card-off'
        }`}
        style={on ? { borderColor: `color-mix(in srgb, ${theme.accent} 38%, transparent)` } : undefined}
        onClick={() => setPreviewId(widget.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setPreviewId(widget.id); } }}
        aria-label={`${widget.name} — ${on ? 'on' : 'off'} dashboard, open preview`}
      >
        {/* head */}
        <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors"
            style={{
              backgroundColor: on ? theme.tint : 'transparent',
              borderColor: on ? `color-mix(in srgb, ${theme.accent} 30%, transparent)` : 'var(--border-subtle)',
              color: on ? theme.accent : 'var(--text-muted)',
            }}
          >
            <WidgetIcon size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[8px] uppercase tracking-[0.14em] leading-none" style={{ color: on ? theme.accent : 'var(--text-muted)' }}>
              {theme.kicker}
            </div>
            <div className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate mt-0.5 leading-tight">
              {widget.name}
            </div>
          </div>
          <WorkbenchSwitch
            on={on}
            locked={locked}
            accent={theme.accent}
            onChange={() => toggleWidget(widget.id)}
            label={widget.name}
          />
        </div>

        {/* the card's own live-shape preview */}
        <PreviewShape kind={kind} accent={theme.accent} wide={wide} seed={seedOf(widget.id)} />

        {/* foot — real dashboard size + preview action */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span className="font-mono text-[9px] text-[var(--text-muted)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5">
            {templateSizeLabel(widget.id, `${widget.defaultSize?.cols ?? 1}×${widget.defaultSize?.rows ?? 1}`)}
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            {widget.category}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye size={10} />
            Preview
          </span>
        </div>
      </motion.div>
    );
  };

  const renderWorkbench = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
          Card Workbench
          <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
            ({workbenchWidgets.length})
          </span>
        </h2>
        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-[0.1em]">
          previews always live
        </span>
      </div>

      {workbenchWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--color-card-50)] p-8 text-center min-h-[200px]">
          <Box size={24} className="text-[var(--text-muted)] mb-2 opacity-50" />
          <p className="text-[12px] text-[var(--text-secondary)]">
            {searchQuery || categoryFilter !== 'all' || stateFilter !== 'all'
              ? 'No cards match this filter.'
              : 'All cards are already on your dashboard.'}
          </p>
          {(searchQuery || categoryFilter !== 'all' || stateFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setStateFilter('all'); }}
              className="mt-2 text-[11px] text-[var(--page-accent)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0 content-start overflow-y-auto pr-1 group">
          {workbenchWidgets.map((w, i) => renderWorkbenchCard(w, i))}
        </div>
      ) : (
        <div className="space-y-1 flex-1 min-h-0 content-start overflow-y-auto pr-1">
          {workbenchWidgets.map((widget, i) => {
            const theme = getWidgetTheme(widget.id);
            const WidgetIcon = getIcon(widget.icon);
            const on = isOn(widget.id);
            const locked = widget.id === 'status-band';
            return (
              <motion.div
                key={widget.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.02, 0.2) }}
                onClick={() => setPreviewId(widget.id)}
                className={`group flex items-center gap-2.5 rounded-xl border bg-[var(--color-card)] px-3 py-2 cursor-pointer transition-colors hover:border-[var(--page-accent)]/30 ${
                  on ? '' : 'opacity-70'
                }`}
                style={on ? { borderColor: `color-mix(in srgb, ${theme.accent} 38%, transparent)` } : undefined}
              >
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                  style={{ backgroundColor: theme.tint, color: theme.accent }}
                >
                  <WidgetIcon size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{widget.name}</span>
                    <span className="font-mono text-[9px] text-[var(--text-muted)] border border-[var(--border-subtle)] rounded px-1 py-px">
                      {templateSizeLabel(widget.id, `${widget.defaultSize?.cols ?? 1}×${widget.defaultSize?.rows ?? 1}`)}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[var(--text-secondary)] truncate">{widget.description}</p>
                </div>
                <span className="font-mono text-[9px] tracking-[0.08em] w-8 text-right" style={{ color: on ? 'var(--success)' : 'var(--text-muted)' }}>
                  {on ? 'ON' : 'OFF'}
                </span>
                <WorkbenchSwitch
                  on={on}
                  locked={locked}
                  accent={theme.accent}
                  onChange={() => toggleWidget(widget.id)}
                  label={widget.name}
                />
                <button
                  onClick={e => { e.stopPropagation(); setPreviewId(widget.id); }}
                  className="p-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--page-accent)]/30 transition-colors"
                  aria-label={`Preview ${widget.name}`}
                >
                  <Eye size={11} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Render: Dashboard Preview Panel (real components, real geometry) ──────

  // Preview placement — derived from ROW_TEMPLATES (the 1:1 mirror of DashboardPage's
  // real geometry in widgetRegistry.tsx), NOT from the stale v4 gridPositions. Cells
  // carry the template's width share (w) and height unit (h), which is what makes the
  // preview's dimensions match the live dashboard instead of an invented mosaic.
  const previewGroups: Array<Array<{ widgetId: string; colSpan: number; bc: number; height: number }>> = [];
  const previewLookup: Map<string, { col: number; row: number; colSpan: number; rowSpan: number; bc: number; height: number }> = new Map();
  {
    const groups: Array<{ bc: number; cells: Array<{ widgetId: string; colStart: number; colSpan: number; height: number }> }> = [];
    for (const row of ROW_TEMPLATES) {
      const cells = row.cells
        .map(c => ({ id: c.id, dashId: toDashboardId(c.id), w: c.w, h: c.h, bc: row.breakpointCols }))
        .filter(c => c.dashId && isVisible(c.dashId));
      if (cells.length === 0) continue;
      groups.push({
        bc: row.breakpointCols,
        cells: cells.map((c, i) => ({
          widgetId: c.id,
          colStart: cells.slice(0, i).reduce((s, p) => s + p.w, 0),
          colSpan: c.w,
          height: c.h * PREVIEW_ROW_H,
        })),
      });
    }
    for (const opt of OPT_IN_WIDGETS) {
      const dashId = toDashboardId(opt.id);
      if (!dashId || !isVisible(dashId)) continue;
      if (groups.some(g => g.cells.some(c => c.widgetId === opt.id))) continue;
      groups.push({ bc: 12, cells: [{ widgetId: opt.id, colStart: 0, colSpan: opt.w, height: opt.h * PREVIEW_ROW_H }] });
    }
    for (const g of groups) {
      previewGroups.push(g.cells.map(c => ({ widgetId: c.widgetId, colSpan: c.colSpan, bc: g.bc, height: c.height })));
      for (const c of g.cells) {
        previewLookup.set(c.widgetId, { col: 0, row: 0, colSpan: c.colSpan, rowSpan: Math.max(1, Math.round(c.height / PREVIEW_ROW_H)), bc: g.bc, height: c.height });
      }
    }
  }

  const renderDashboardPreview = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">
          Your Dashboard
          <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
            ({visibleWidgets.length} · real components)
          </span>
        </h2>
        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-[0.1em]">
          hover a cell to remove
        </span>
      </div>

      {visibleWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--color-card-50)] p-8 text-center min-h-[200px]">
          <LayoutDashboard size={24} className="text-[var(--text-muted)] mb-2 opacity-50" />
          <p className="text-[12px] text-[var(--text-secondary)]">
            Your dashboard is empty.
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Flip a switch on any card in the workbench.
          </p>
        </div>
      ) : (
        <div
          ref={gridRef}
          className={`relative flex-1 min-h-0 rounded-xl border-2 transition-colors ${
            dragOverDashboard ? 'border-[var(--page-accent)] bg-[var(--page-accent-5)]' : 'border-[var(--border-subtle)]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={() => handleDragEnd()}
        >
          {/* Drop overlay */}
          <AnimatePresence>
            {dragOverDashboard && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-[var(--page-accent-10)] rounded-xl pointer-events-none"
              >
                <div className="flex items-center gap-2 text-[var(--page-accent)]">
                  <Plus size={16} />
                  <span className="text-sm font-medium">Drop to add card</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid preview — rows stack vertically; each cell's width/height come
              from the ROW_TEMPLATES mirror of the live dashboard, not from an
              invented grid, so the preview's dimensions match reality. */}
          <div className="p-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col" style={{ gap: 8 }}>
              {previewGroups.map((group, gi) => (
                <div key={`row-${gi}`} className="flex" style={{ gap: 8 }}>
                  {group.map(cell => {
                    const widget = visibleWidgets.find(w => w.id === cell.widgetId);
                    if (!widget) return null;
                    const position = previewLookup.get(widget.id) ?? { col: 0, row: 0, colSpan: cell.colSpan, rowSpan: Math.max(1, Math.round(cell.height / PREVIEW_ROW_H)), bc: cell.bc, height: cell.height };
                    const theme = getWidgetTheme(widget.id);

                    const RealComponent = WidgetRegistry.get(widget.id)?.component;

                    // Scale the widget to fit its dashboard-accurate cell. The widget
                    // renders at NATURAL_W/NATURAL_H (its real proportions) and is scaled
                    // down to the size the live dashboard would give it, so the preview
                    // mirrors real dimensions instead of an invented grid.
                    const GAP = 8;
                    const cellW = gridW > 0
                      ? (gridW - GAP * (position.bc - 1)) / position.bc * position.colSpan + GAP * (position.colSpan - 1)
                      : 0;
                    const scale = cellW > 0 ? Math.min(cellW / PREVIEW_NATURAL_W, position.height / PREVIEW_NATURAL_H) : 0;
                    const cellH = position.height;

                    return (
                      <motion.div
                        key={widget.id}
                        layout
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="relative group rounded-lg border bg-[var(--color-card)] overflow-hidden"
                        style={{
                          width: cellW,
                          height: cellH,
                          borderColor: `color-mix(in srgb, ${theme.accent} 24%, transparent)`,
                        }}
                      >
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeWidget(widget.id)}
                          className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--error-15)] text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--error-25)]"
                          aria-label={`Remove ${widget.name}`}
                        >
                          <X size={10} />
                        </button>

                        {/* Actual widget component preview — real component, real context data,
                            laid out at natural size then scaled to fit the cell */}
                        {RealComponent ? (
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
                              <RealComponent />
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 flex items-center justify-center h-full">
                            <p className="text-[10px] text-[var(--text-muted)]">{widget.name}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
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
    const visible = isOn(previewId);
    const locked = previewId === 'status-band';
    const RealComponent = widget.component;

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
          className="relative w-full max-w-[640px] rounded-xl border bg-[var(--color-card)] overflow-hidden shadow-2xl"
          style={{ borderColor: `color-mix(in srgb, ${theme.accent} 30%, transparent)` }}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
                <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: theme.accent }}>
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
              <span className="font-mono border border-[var(--border-subtle)] rounded px-1.5 py-0.5">
                {templateSizeLabel(previewId, `${widget.defaultSize?.cols ?? 1}×${widget.defaultSize?.rows ?? 1}`)}
              </span>
              <span className="flex items-center gap-1">
                <Box size={10} />
                {widget.category}
              </span>
              <span className={`flex items-center gap-1 ${visible ? 'text-[var(--success)]' : ''}`}>
                <Check size={10} />
                {visible ? 'On dashboard' : 'Not on dashboard'}
              </span>
            </div>

            {/* Live component preview — the real thing, real data context */}
            <div
              className="rounded-xl border bg-white/[0.02] p-4 min-h-[160px]"
              style={{ borderColor: `color-mix(in srgb, ${theme.accent} 18%, transparent)` }}
            >
              {previews?.[previewId] ?? (RealComponent ? (
                <div style={{ width: PREVIEW_NATURAL_W + 40, transform: 'scale(1)', transformOrigin: 'top left' }}>
                  <RealComponent />
                </div>
              ) : (
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
              onClick={() => { if (!locked) { toggleWidget(previewId); setPreviewId(null); } }}
              disabled={locked}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                visible
                  ? 'border border-[var(--border-subtle)] bg-[var(--color-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--error)]/30'
                  : 'bg-[var(--page-accent)] text-white hover:opacity-90'
              }`}
            >
              {locked ? (
                <>
                  <Check size={13} />
                  Always on
                </>
              ) : visible ? (
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

  // ── Render: Presets Panel ─────────────────────────────────────────────────

  const renderPresetsPanel = () => {
    const customPresets = presets.filter(p => p.id !== 'default');

    return (
      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[12px] font-semibold text-[var(--text-secondary)]">
            Layout Presets
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAsPreset(); }}
              placeholder="Name this layout…"
              maxLength={40}
              className="flex-1 min-w-[160px] rounded-md border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--page-accent)]/50 focus:outline-none"
            />
            <button
              onClick={saveAsPreset}
              disabled={!presetName.trim() || isSavingPreset}
              className="flex items-center gap-1 rounded-md bg-[var(--page-accent-15)] border border-[var(--page-accent)]/30 px-2.5 py-1.5 text-[11px] font-medium text-[var(--page-accent)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90"
            >
              {isSavingPreset ? (
                <span className="animate-pulse">Saving…</span>
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
          <div className="flex flex-wrap gap-1.5">
            {customPresets.map(preset => (
              <div
                key={preset.id}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white/[0.02] pl-3 pr-1.5 py-1 transition-colors hover:border-[var(--page-accent)]/25"
              >
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
                <span className="font-mono text-[9px] text-[var(--text-muted)]">
                  {preset.layout.widgetOrder.filter(id => preset.layout.widgetVisibility[id] !== false).length}
                </span>
                {activePresetId === preset.id && (
                  <Check size={10} className="text-[var(--page-accent)]" />
                )}
                <button
                  onClick={() => deletePreset(preset.id)}
                  className="p-0.5 rounded-full text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                  aria-label={`Delete preset ${preset.name}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)] italic">
            No saved presets yet — name the current layout above to keep it.
          </p>
        )}
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────

  const innerContent = (
    <div
      className="relative w-full h-full max-w-[1600px] max-h-[92vh] rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] shadow-2xl overflow-hidden flex flex-col min-h-0"
      onClick={e => e.stopPropagation()}
    >
      {/* Workbench motion + switch styles — scoped to this surface, reduced-motion aware */}
      <style>{`
        .wl-card { transition: border-color .15s ease, transform .15s cubic-bezier(.16,1,.3,1), opacity .2s ease; }
        .wl-card:hover { transform: translateY(-2px); }
        .wl-card:focus-visible { outline: none; box-shadow: 0 0 0 1.5px var(--page-accent); }
        .wl-card-off .wl-pv { filter: grayscale(1); opacity: .55; }
        .wl-card-off { opacity: .78; }
        .wl-pv { border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--color-card) 82%, #000); position: relative; overflow: hidden; }
        .wl-bar { border-radius: 3px 3px 0 0; transform-origin: bottom; transition: transform .2s cubic-bezier(.16,1,.3,1); }
        .wl-card:hover .wl-bar { transform: scaleY(1.12); }
        .wl-ring { border-radius: 9999px; -webkit-mask: radial-gradient(circle, transparent 55%, #000 56%); mask: radial-gradient(circle, transparent 55%, #000 56%); }
        .wl-dot { width: 7px; height: 7px; border-radius: 9999px; animation: wl-pulse 2s ease-in-out infinite; }
        @keyframes wl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .wl-caret { display: inline-block; width: 5px; height: 9px; margin-left: 1px; animation: wl-blink 1.1s steps(1) infinite; }
        @keyframes wl-blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0; } }
        .wl-sw { position: relative; width: 30px; height: 17px; border-radius: 9999px; background: var(--color-card); border: 1px solid var(--border-subtle); cursor: pointer; transition: background .15s ease, border-color .15s ease; padding: 0; }
        .wl-sw:hover { border-color: var(--text-muted); }
        .wl-sw-knob { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 9999px; background: var(--text-muted); transition: transform .15s cubic-bezier(.16,1,.3,1), background .15s ease; }
        .wl-sw-on .wl-sw-knob { transform: translateX(13px); }
        .wl-sw:focus-visible { outline: none; box-shadow: 0 0 0 1.5px var(--page-accent); }
        @media (prefers-reduced-motion: reduce) {
          .wl-card, .wl-bar, .wl-sw, .wl-sw-knob { transition: none !important; }
          .wl-dot, .wl-caret { animation: none !important; }
          .wl-card:hover { transform: none; }
          .wl-card:hover .wl-bar { transform: none; }
        }
      `}</style>

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-[var(--border-subtle)]">
        {renderHeader()}
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 py-2">
        {renderToolbar()}
      </div>

      {/* Main content — workbench left, live mirror right */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full gap-4 px-4 py-2 min-h-0">
          {/* Workbench — left panel */}
          <div className="w-[480px] flex-shrink-0 border-r border-[var(--border-subtle)] pr-4 min-h-0">
            <div className="h-full min-h-0 overflow-hidden">
              {renderWorkbench()}
            </div>
          </div>

          {/* Dashboard mirror — right panel */}
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
      <AnimatePresence>
        {previewId && renderPreviewModal()}
      </AnimatePresence>
    </div>
  );

  if (!data) {
    // Loading state — the menu never silently vanishes while data resolves.
    return (
      <div className="relative w-full h-full max-w-[1600px] max-h-[92vh] rounded-xl border border-[var(--border-subtle)] bg-[var(--color-card)] shadow-2xl overflow-hidden flex flex-col min-h-0 p-6">
        <div className="animate-pulse flex flex-col gap-3 h-full">
          <div className="h-8 w-64 rounded-lg bg-white/[0.05]" />
          <div className="h-11 rounded-xl bg-white/[0.04]" />
          <div className="flex-1 grid grid-cols-2 gap-2.5 content-start">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Standalone overlay hoisted out of the ternary below: JSX narrowing would
  // otherwise reduce `onClose` to `undefined` in the else-branch and turn the
  // optional call into TS2349 ("Type 'never' has no call signatures").
  const standaloneOverlay = (
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
  );

  return (
    <DashboardDataProvider value={data}>
    <AnimatePresence>
      {onClose ? (
        // When wrapped by parent modal, render just the content (no overlay)
        innerContent
      ) : (
        // Standalone: render full overlay
        standaloneOverlay
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
  'notes-card',
  'focus-card',
  'deadlines-card',
  'schedule-hero',
  'insight-strip',
  'productivity-chart',
  'activity-feed',
];
