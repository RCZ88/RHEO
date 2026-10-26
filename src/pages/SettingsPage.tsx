import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { tierColor as getTierColor, tierColor as tierColorValue, TIERS, TIER_LABELS, setTierColor, resetTierColors } from '../lib/tierColors';
import { DURATION_PRESETS, getToastDurationMs, setToastDurationMs, DEFAULT_DURATION_MS } from '../lib/toastDuration';
import {
  getAmbientPrefs,
  setAmbientPrefs,
  ambientGradient,
  ambientTheme,
  getPageAccent,
  AMBIENT_PAGES,
  ALL_AMBIENT_PAGE_IDS,
  type AmbientPrefs,
} from '../lib/ambient';
import { consumeSectionHint, scrollToSection } from '../lib/deepNav';
// Leaf module, not the `@/pages/registry` barrel: the barrel re-exports
// `usePageSurface`, which imports React and reads `import.meta.env`. Importing it
// here would make a plain data import drag the whole React hook chain in, which
// is the exact mistake `deepNav.ts` documents at the top of its own file.
import { SETTINGS_SECTION_TAB } from './registry/pages/settings';
import {
  getAfkPrefs,
  setAfkPrefs,
  AFK_PRESETS,
  AFK_ACTIONS,
  AFK_MIN_MINUTES,
  AFK_MAX_MINUTES,
  AFK_MIN_NOT_AFK_MINUTES,
  AFK_MAX_NOT_AFK_MINUTES,
  ALL_CATEGORIES,
  type AfkPrefs,
} from '../lib/afk';
import {
  getSleepWindow,
  setSleepWindow,
  COMMON_SLEEP_WINDOWS,
  SLEEP_WINDOW_CHANGED_EVENT,
  MIN_SLEEP_OVERLAP_MINUTES,
  describeSleepWindow,
  formatHour,
  type SleepWindowPrefs,
} from '../lib/sleepWindow';
/** Plain-language name for the AFK action, used in the summary line. */
function afkActionLabel(a: string): string {
  return AFK_ACTIONS.find(x => x.value === a)?.label ?? 'Pause only';
}

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Settings, Database, Clock, Download, Trash2, RefreshCw, Terminal,
  ChevronRight, X, Plus, GripVertical, Palette, Check, ChevronDown, Globe,
  ChevronLeft, Search, AlertTriangle, Sparkles, ChevronUp, Loader2,
  Eye, EyeOff, DollarSign, Shield, Key, Save, Lock, LockOpen, History, Undo2, Pencil,
  Upload, FileText, SearchX, Inbox, Keyboard, Monitor, Sun, Moon, Bell, Waves, Mic
} from 'lucide-react';
import { useSmoothScroll } from '../components/ui/smooth-scroll';
import { lazy } from 'react';
// ColorPicker / TierContainer / SortableChip are intentionally NOT imported here:
// this module declares its own local copies further down, and importing the same
// binding twice is a module-level Duplicate Declaration — a PARSE error, not a type
// error. It surfaced as `Duplicate declaration "ColorPicker"` in the vite dev
// transform, and because vite compiles the whole import graph it breaks the whole
// page, not just the settings tab. `./settings/shared` still exports all three and
// ColorsSection.tsx consumes them from there; only this file's own copies are used here.
import { SearchableSection } from './settings/shared';

const DatabasePage = lazy(() => import('./DatabasePage'));
import ErdCanvas, { type ErdSchema } from '@/features/database/ErdCanvas';
import { ARCH_GROUPS } from '@/features/database/domains';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DEFAULT_SYSTEM_PROMPT } from '../lib/defaults';
import { migrateSystemPrompts, projectKey } from '../lib/promptAssembly';
import { useLocation } from 'react-router-dom';
import { useNumberMask, type MaskMode } from '../context/NumberMaskContext';
import { applyAccent, getStoredAccent, setAccent, ACCENT_SWATCHES, isLightMode } from '../lib/applyAccent';
import { registerCustomCategories } from '../components/CategoryColors';
import { SectionHeader } from '../components/SectionHeader'
import { ProviderDiagnostics } from '../components/ProviderDiagnostics';
import { GlassCard } from '../components/GlassCard';
import { searchSettings } from './settings/registry';
import type { SettingsTabId } from './settings/registry';
import RewindNavSetting from '../features/rewind-nav/RewindNavSetting';
import { PageShell } from '../components/PageShell';
import { DevicesPanel } from '../components/DevicesPanel';
import { PhoneStatsPanel } from '../components/PhoneStatsPanel';
import { AuthSettings } from '../components/AuthSettings';
import BrowserProfileSettings from '../components/BrowserProfileSettings';
import ExtensionSetupPanel from '../components/ExtensionSetupPanel';
import { BorderBeam } from '../components/ui/border-beam';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

interface SettingsPageProps {
  logs: any[];
  appStats: any[];
  storageStatus: {
    type: string;
    working: boolean;
    path: string;
    error?: string;
    logCount: number;
  };
  idleThreshold: number;
  setIdleThreshold: (val: number) => void;
  autoExport: boolean;
  setAutoExport: (val: boolean) => void;
  onClearData: () => void;
  onExportData: (format: 'csv' | 'json') => void;
  onViewDatabase: () => void;
  onRegisterSave: (fn: () => void) => void;
  onRequestNavigate: (path: string, hasUnsaved: boolean) => void;
  onHasChangesChange: (hasChanges: boolean) => void;
  onReloadData: () => void;
  onCategoryOverridesChange?: (overrides: Record<string, string>) => void;
  appColors?: Record<string, string>;
  setAppColors?: (colors: Record<string, string>) => void;
  categoryOrder?: string[];
  setCategoryOrder?: (order: string[]) => void;
  autoStartEnabled?: boolean;
  setAutoStartEnabled?: (enabled: boolean) => void;
  timerBehavior?: { neutralAction: 'pause' | 'reset' | 'ignore'; distractingAction: 'pause' | 'reset' | 'ignore' };
  setTimerBehavior?: (behavior: { neutralAction: 'pause' | 'reset' | 'ignore'; distractingAction: 'pause' | 'reset' | 'ignore' }) => void;
  trackerAppMode?: 'show-other' | 'pause' | 'track';
  setTrackerAppMode?: (mode: 'show-other' | 'pause' | 'track') => void;
  externalActivities?: { id: number; name: string; type: string; is_productive: boolean }[];
  externalActivityTiers?: Record<number, string>;
  onExternalActivityTiersChange?: (tiers: Record<number, string>) => void;
}

type AnimationSpeed = 'slow' | 'normal' | 'instant';

const DEFAULT_CATEGORIES = [
  'IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication',
  'Design', 'Productivity', 'Tools', 'Education', 'Developer Tools',
  'Search Engine', 'News', 'Shopping', 'Social Media', 'Gaming', 'Uncategorized', 'Other'
];

const DEFAULT_TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming']
};

const CATEGORY_COLORS: Record<string, string> = {
  'IDE': '#6366f1',
  'AI Tools': '#8b5cf6',
  'Browser': '#3b82f6',
  'Entertainment': '#ec4899',
  'Communication': '#14b8a6',
  'Design': '#a855f7',
  'Productivity': '#10b981',
  'Tools': '#f59e0b',
  'Education': '#06b6d4',
  'Developer Tools': '#10b981',
  'Search Engine': '#0ea5e9',
  'News': '#eab308',
  'Shopping': '#f97316',
  'Social Media': '#ef4444',
  'Uncategorized': '#78716c',
  'Other': '#64748b',
};

const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = {
  slow: 2500,
  normal: 1200,
  instant: 0,
};

// Preset colors for quick selection
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#64748b', '#78716c',
];

// Wrapper that hides sections when they don't match the settings search
// SearchableSection is imported from './settings/shared' (line 16). A local copy
// used to live here and shadowed that import, which is why search only ever
// matched the manually-maintained `terms` arrays. Do not re-add it.

// Custom color picker component with preset swatches - simplified circle design
function ColorPicker({ value, onChange, size = 'md' }: { value: string; onChange: (color: string) => void; size?: 'sm' | 'md' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-color-picker-overlay]')) return;
      if (ref.current && !ref.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const sizeClass = size === 'sm' ? 'w-16 h-3' : 'w-20 h-4';

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${sizeClass} rounded cursor-pointer border-2 border-zinc-600 hover:border-zinc-400 transition-colors duration-150 hover:scale-110 shadow-md`}
          style={{ backgroundColor: value, borderRadius: '4px' }}
          title="Click to change color"
        />
      </div>
      {isOpen && createPortal(
        <div
          data-color-picker-overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            className="p-4 bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-xl w-52"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-300">Pick a color</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {PRESET_COLORS.slice(0, 15).map((color) => (
                <button
                  key={color}
                  onClick={() => { onChange(color); setIsOpen(false); }}
                  className={`w-7 h-7 rounded-full hover:scale-110 transition-transform ${value === color ? 'ring-2 ring-white ring-offset-zinc-900' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-zinc-700">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <span className="text-xs text-zinc-400 font-mono">{value}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Sortable category chip using dnd-kit
function SortableChip({
  id,
  color,
  onRemove,
}: {
  id: string;
  color: string;
  onRemove?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: `${color}15`, borderColor: `${color}50`, color: color }}
      {...attributes}
      {...listeners}
      className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border cursor-grab active:cursor-grabbing hover:scale-105 transition-transform select-none"
    >
      <GripVertical className="w-3 h-3 opacity-50" />
      <span>{id}</span>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-1 hover:opacity-70 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// Tier container with droppable zone
import { useDroppable } from '@dnd-kit/core';
import {
  HALO_CLOSE_DELAY_MAX,
  HALO_CLOSE_DELAY_MIN,
  HALO_DEFAULTS,
  HALO_DURATION_MAX,
  HALO_DURATION_MIN,
  HALO_MAX_VISIBLE_MAX,
  HALO_MAX_VISIBLE_MIN,
  HALO_OPEN_DELAY_MAX,
  HALO_OPEN_DELAY_MIN,
  HALO_ORDERABLE,
  HALO_PAD_X_MAX,
  HALO_PAD_Y_MAX,
  HALO_PREFS_KEY,
  HALO_SCALE_MAX,
  HALO_SCALE_MIN,
  HALO_OFFSET_Y_MAX,
  HALO_OFFSET_Y_MIN,
  HALO_PILL_RESIDENTS,
  HALO_SIZE_TOKENS,
  isWidgetVisible,
  normalizeHaloPrefs,
  type HaloPageId,
  type HaloPillResident,
  type HaloPrefs,
  // `as HaloUiVersion[]` is used by the Layout picker in the Halo block below and
  // was never imported — TS2304 on a type-only reference, so it breaks the file
  // under `verbatimModuleSyntax`. The export exists (HaloPreferences.ts:118).
  type HaloUiVersion,
} from '../features/halo/HaloPreferences';
import { HaloSettingsPreview } from '../features/halo/HaloSettingsPreview';
import {
  HALO_SIZE_PRESETS,
  presetForScale,
  resolveHaloSize,
} from '../shared/halo/sizes';

function TierContainer({
  tier,
  color,
  label,
  description,
  creditLabel,
  children
}: {
  tier: 'productive' | 'neutral' | 'distracting';
  color: string;
  label: string;
  description: string;
  creditLabel: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier });
  const tierColor = getTierColor(tier);

  return (
    <div
      ref={setNodeRef}
      className={`p-4 rounded-xl border transition-colors duration-150 ${isOver ? 'border-2 border-solid' : ''
        } ${tier === 'productive'
          ? 'bg-gradient-to-br from-[var(--tier-productive)]/10 to-transparent border-[var(--tier-productive)]/20'
          : tier === 'neutral'
            ? 'bg-gradient-to-br from-[var(--tier-neutral)]/10 to-transparent border-[var(--tier-neutral)]/20'
            : 'bg-gradient-to-br from-[var(--tier-distracting)]/10 to-transparent border-[var(--tier-distracting)]/20'
        }`}
      style={isOver ? { borderColor: tierColor, borderWidth: 2 } : undefined}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-4 h-4 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${tierColor} 0%, ${tierColor}88 100%)`,
            boxShadow: `0 0 10px ${tierColor}50`
          }}
        />
        <div>
          <h3 className="font-semibold" style={{ color: tierColor }}>{label}</h3>
          <span className="text-xs text-zinc-500">{creditLabel}</span>
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{description}</p>
      <div className="flex flex-wrap gap-2 min-h-[48px]">
        {children}
      </div>
    </div>
  );
}

/** Tracked-time formatter for browser profile rows.
 *  browser_profiles.total_duration_ms used to never be written, so this used to
 *  render "0m" for every profile forever. Now it reflects real accumulated time.
 *  Deliberately compact — this sits in a dense settings row. */
function formatTrackedTime(ms: number): string {
  const totalMin = Math.floor((ms || 0) / 60000);
  if (totalMin < 1) return '<1m';
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/* ── Reminder lead times ───────────────────────────────────────────────────
   checkDeadlinesAndNotify fires at three points before a deadline. Those were
   hardcoded 1 day / 3 hours / 1 hour with no way to change them, so this reads
   and writes the same app_settings row the main-process poller reads. */
function ReminderLeadTimeSettings() {
  const [minutes, setMinutes] = useState<{ d1: number; h3: number; h1: number }>({ d1: 1440, h3: 180, h1: 60 });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const api = (window as any).deskflowAPI;
    if (!api?.appSettingGet) { setLoaded(true); return; }
    api.appSettingGet('reminder_lead_minutes')
      .then((r: any) => {
        if (!alive) return;
        if (r?.value) {
          try {
            const p = JSON.parse(r.value);
            const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
            setMinutes({ d1: n(p.d1, 1440), h3: n(p.h3, 180), h1: n(p.h1, 60) });
          } catch { /* fall back to defaults */ }
        }
      })
      .catch(() => { if (alive) setError('Could not read reminder settings. Defaults are in use.'); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const save = async (next: { d1: number; h3: number; h1: number }) => {
    setMinutes(next);
    const api = (window as any).deskflowAPI;
    if (!api?.appSettingSet) return;
    setSaving(true); setError(null);
    try {
      const res = await api.appSettingSet('reminder_lead_minutes', JSON.stringify(next));
      if (res && res.success === false) throw new Error(res.error || 'Could not save reminder settings.');
    } catch (e: any) {
      setError(e?.message || 'Could not save reminder settings.');
    } finally { setSaving(false); }
  };

  const toAmount = (mins: number) =>
    mins === 0 ? 'At the deadline'
    : mins % 1440 === 0 ? `${mins / 1440} day${mins / 1440 === 1 ? '' : 's'} before`
    : mins % 60 === 0 ? `${mins / 60} hour${mins / 60 === 1 ? '' : 's'} before`
    : `${mins} min before`;

  const rows: Array<{ key: 'd1' | 'h3' | 'h1'; label: string; help: string }> = [
    { key: 'd1', label: 'First warning', help: 'The earliest heads-up before something is due.' },
    { key: 'h3', label: 'Second warning', help: 'A mid-point reminder. Set to 0 to skip this one.' },
    { key: 'h1', label: 'Final warning', help: 'The last nudge. Set to 0 to skip this one.' },
  ];

  if (!loaded) {
    return (
      <GlassCard>
        <div className="h-8 w-1/3 animate-pulse rounded bg-zinc-800/40" aria-hidden />
        <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-zinc-800/40" aria-hidden />
        <p className="sr-only">Loading reminder settings</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">Deadline reminders</h3>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          How far ahead DeskFlow warns you about an upcoming deadline. Anything already past its
          date is announced once as overdue and then left on the list until you clear it.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[12px] text-amber-400/90">{error}</p>
      )}

      <div className="space-y-3">
        {rows.map(row => {
          const id = `reminder-lead-${row.key}`;
          return (
            <div key={row.key} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <label htmlFor={id} className="block text-[13px] text-[var(--text-primary)]">{row.label}</label>
                <p className="text-[11px] text-[var(--text-muted)]">{row.help}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  id={id}
                  type="number"
                  min={0}
                  step={5}
                  value={minutes[row.key]}
                  disabled={saving}
                  aria-describedby={`${id}-help`}
                  onChange={e => {
                    const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                    setMinutes(prev => ({ ...prev, [row.key]: v }));
                  }}
                  onBlur={() => save(minutes)}
                  className="w-20 rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--page-accent)] focus-visible:ring-[var(--page-accent)]/40 disabled:opacity-60"
                />
                <span id={`${id}-help`} className="w-36 text-[11px] text-[var(--text-muted)]">
                  {toAmount(minutes[row.key])}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">
        {saving ? 'Saving…' : 'Changes apply to the next deadline check (runs every 5 minutes).'}
      </p>
    </GlassCard>
  );
}

export default function SettingsPage({
  logs = [],
  appStats = [],
  storageStatus = { type: 'none', working: false, path: '', logCount: 0 },
  idleThreshold = 5,
  setIdleThreshold = () => { },
  autoExport = false,
  setAutoExport = () => { },
  onClearData,
  onExportData,
  onViewDatabase,
  onRegisterSave,
  onRequestNavigate,
  onHasChangesChange,
  onCategoryOverridesChange,
  onReloadData,
  appColors = {},
  setAppColors,
  categoryOrder = DEFAULT_CATEGORIES.slice(0, 9),
  setCategoryOrder,
  autoStartEnabled: autoStartEnabledProp = false,
  setAutoStartEnabled: setAutoStartEnabledProp = () => { },
  timerBehavior: timerBehaviorProp = { neutralAction: 'pause', distractingAction: 'reset' },
  setTimerBehavior: setTimerBehaviorProp = () => { },
  trackerAppMode: trackerAppModeProp = 'track',
  setTrackerAppMode: setTrackerAppModeProp = () => { },
  externalActivities = [],
  externalActivityTiers: externalActivityTiersProp = {},
  onExternalActivityTiersChange,
}: Partial<SettingsPageProps> & { onRegisterSave: (fn: () => void) => void; onReloadData?: () => void }) {
  type TabId = 'category' | 'colors' | 'general' | 'tracking' | 'prompts' | 'finance' | 'ai' | 'devices' | 'database' | 'auth' | 'shortcuts' | 'appearance';
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem('settings-activeTab');
    return (saved as any) || 'category';
  });
  const location = useLocation();
  /* The section a deep link asked for, held until the tab that owns it has
     mounted. See the deep-nav arrival effect below for why it cannot be scrolled
     to in the same tick. */
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  /* Smooth scrolling — the toggleable half of the scroll feature. The other
     half (scrollbar appearance) is unconditional and lives in
     src/styles/surface.css, so there is nothing to configure here for it. */
  const {
    enabled: smoothScrollEnabled,
    setEnabled: setSmoothScrollEnabled,
  } = useSmoothScroll();
  const smoothScrollBlockedByOS = (() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();
  useEffect(() => {
    applyAccent();
  }, []);

  /* Deep-nav arrival: pick the tab, then scroll to the section ON THAT TAB.
   *
   * Two real defects are repaired here.
   *
   * 1. `deepNav` writes the target section into `sessionStorage['deepNav:section']`
   *    (`src/lib/deepNav.ts:70`) and expects the destination page to CONSUME it.
   *    `SettingsPage` never called `consumeSectionHint`, so the key was written
   *    and never removed — it survived every later visit to Settings and would
   *    have fired a scroll the moment anything did start reading it.
   *
   * 2. A same-page section row carries a `section` but no `tab`, so a ⌘K pick of
   *    "Settings — Halo Island" arrived on whatever tab was last open. Now the
   *    owning tab comes from `SETTINGS_SECTION_TAB`, which is declared next to the
   *    section itself, and the scroll runs in a SECOND effect that is keyed on the
   *    tab — so it happens after the tab's content has mounted rather than racing
   *    it. Scrolling before paint is what made a stale hint look like it had
   *    landed on the wrong section entirely. */
  useEffect(() => {
    const tab = (location.state as any)?.tab;
    const section = consumeSectionHint();
    const stateSection = (location.state as any)?.section;
    const wanted = section || stateSection;
    const owning = typeof wanted === 'string' ? SETTINGS_SECTION_TAB[wanted] : undefined;
    if (tab) setActiveTab(tab);
    else if (owning) setActiveTab(owning as TabId);
    if (typeof wanted === 'string') setPendingSection(wanted);
  }, []);

  // Runs after the tab content is in the DOM, with the retry the helper documents
  // for lazily-mounted panels. Keyed on `activeTab` so switching tabs by hand
  // re-resolves rather than replaying a spent hint.
  useEffect(() => {
    if (!pendingSection) return;
    let cancelled = false;
    const attempt = (n: number) => {
      if (cancelled || n <= 0) return;
      if (scrollToSection(pendingSection)) return;
      window.setTimeout(() => attempt(n - 1), 200);
    };
    const t = window.setTimeout(() => attempt(4), 100);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [activeTab, pendingSection]);

  const [tierAssignments, setTierAssignments] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-tier-assignments');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch { /* ignore */ }
      }
    }
    return DEFAULT_TIER_ASSIGNMENTS;
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [localAppColors, setLocalAppColors] = useState<Record<string, string>>(() => {
    // Load from localStorage first (in case Settings saved colors while app was closed)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-planet-colors');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch { /* ignore */ }
      }
    }
    // Fallback to prop
    return appColors;
  });
  const [localCategoryOrder, setLocalCategoryOrder] = useState<string[]>(categoryOrder);
  const [autoStartEnabled, setAutoStartEnabled] = useState(autoStartEnabledProp);
  const [localTimerBehavior, setLocalTimerBehavior] = useState(timerBehaviorProp);
  const [trackerAppMode, setTrackerAppMode] = useState(trackerAppModeProp);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [accentColor, setAccentColor] = useState<string | null>(() => getStoredAccent());
  const [erdSchema, setErdSchema] = useState<ErdSchema | null>(null);
  const [erdLoading, setErdLoading] = useState(false);

  const fetchErd = useCallback(async () => {
    const api: any = (window as any).deskflowAPI;
    const blank = { tables: [], relationships: [], tablesWithoutForeignKeys: [], totalColumns: 0, generatedAt: '' };
    if (!api?.getErdSchema) { setErdSchema({ ...blank, error: 'Schema introspection unavailable — rebuild the app' } as ErdSchema); return; }
    setErdLoading(true);
    try { setErdSchema(await api.getErdSchema()); }
    catch (e: any) { setErdSchema({ ...blank, error: e?.message || String(e) } as ErdSchema); }
    finally { setErdLoading(false); }
  }, []);

  // Load the schema the first time the Database subpage is opened.
  // Declared AFTER the state above — a useEffect that reads `erdSchema`
  // earlier in the body throws "Cannot access before initialization".
  useEffect(() => {
    if (activeTab === 'database' && !erdSchema && !erdLoading) fetchErd();
  }, [activeTab, erdSchema, erdLoading, fetchErd]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [localExternalTiers, setLocalExternalTiers] = useState<Record<number, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-external-activity-tiers');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return externalActivityTiersProp;
  });

  // AI Agent color overrides
  const [agentColorOverrides, setAgentColorOverrides] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-agent-colors');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return {};
  });

  // Finance password protection settings
  const [financePasswordSettings, setFinancePasswordSettings] = useState({
    overview: true,
    accounts: true,
    transactions: true,
    categories: true,
    masterPassword: '',
  });

  const { showNumbers, setShowNumbers, maskMode, setMaskMode, maskFixedValue, setMaskFixedValue } = useNumberMask();

  // Union of the built-in and user-created categories, deduped case-insensitively
  // so a custom category can never be shadowed or dropped by a built-in spelling.
  const allCategories = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [...DEFAULT_CATEGORIES, ...customCategories]) {
      const k = String(c || '').trim();
      if (!k) continue;
      const lk = k.toLowerCase();
      if (seen.has(lk)) continue;
      seen.add(lk);
      out.push(k);
    }
    return out;
  }, [customCategories]);

  // Sync tracker app mode from props when they change
  useEffect(() => {
    if (trackerAppModeProp !== trackerAppMode) {
      setTrackerAppMode(trackerAppModeProp);
    }
  }, [trackerAppModeProp]);

  // Drag-and-drop state for dnd-kit
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeContainer, setActiveContainer] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const savedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSavedNoticeTimer = () => {
    if (savedNoticeTimerRef.current) {
      clearTimeout(savedNoticeTimerRef.current);
      savedNoticeTimerRef.current = null;
    }
  };

  const DEFAULT_SHORTCUTS: Record<string, string> = {
    // Global shortcuts
    voiceInput: 'Ctrl+Shift+V',
    commandPalette: 'Ctrl+K',
    quickCapture: 'Ctrl+Shift+G',
    aiChatVoice: 'Ctrl+Shift+M',
    aiPageTranscript: 'Ctrl+Shift+L',
    aiPagePalette: 'Ctrl+K',
    designWorkspacePalette: 'Cmd+K',
externalSelect: 'Enter',
      externalDeselect: 'Escape',
      // Matches DEFAULT_KEYBOARD_SHORTCUTS in src/main.ts. Deliberately NOT one of the
      // terminal's Ctrl+Shift+<letter> combos: this one is registered GLOBALLY, so it would be
      // consumed by the OS before the terminal's renderer handler ever ran.
      // The 3 "files" claiming Ctrl+Shift+O in this repo are all this same default value in the
      // three maps that must agree (main defaults, settings constants, settings renderer) — not
      // three competing features. That is the mirror-image of the H/V bug, where the claims were
      // genuinely different features.
      haloIslandToggle: 'Ctrl+Shift+O',
      // App shortcuts
    canvasUndo: 'Ctrl+Z',
    canvasRedo: 'Ctrl+Shift+Z',
    financeNewTx: 'Ctrl+N',
    chatSend: 'Ctrl+Enter',
    pageContextSearch: 'Ctrl+F',
    ideAddProject: 'Ctrl+A',
    ideRefresh: 'Ctrl+R',
    resumeSubmit: 'Ctrl+Enter',
    // Terminal shortcuts
    terminalNewTab: 'Ctrl+Shift+T',
    terminalCloseTab: 'Ctrl+Shift+W',
    terminalRename: 'Ctrl+Shift+R',
    terminalPin: 'Ctrl+Shift+P',
    terminalNextTab: 'Ctrl+Tab',
    terminalPrevTab: 'Ctrl+Shift+Tab',
    terminalSplitH: 'Ctrl+Shift+H',
    terminalSplitV: 'Ctrl+Shift+V',
    terminalNextPane: 'Ctrl+Shift+ArrowRight',
    terminalPrevPane: 'Ctrl+Shift+ArrowLeft',
    terminalZoom: 'Ctrl+Shift+Z',
    terminalBroadcast: 'Ctrl+Shift+B',
    terminalPalette: 'Ctrl+K',
    terminalClear: 'Ctrl+L',
    terminalWorkspace: 'Ctrl+Shift+S',
    terminalFind: 'Ctrl+Shift+F',
    terminalSaveCmd: 'Ctrl+Shift+D',
    terminalCycleTheme: 'Ctrl+Shift+Y',
    terminalFindInPanes: 'Ctrl+Shift+T',
    terminalBalance: 'Ctrl+Shift+Space',
    terminalExport: 'Ctrl+Shift+E',
    terminalSplitFind: 'Ctrl+Shift+J',
    terminalSplitFindHist: 'Ctrl+Shift+K',
    terminalEnter: 'Enter',
    // Lyceum shortcuts
    lyceumHome: 'g h',
    lyceumLibrary: 'g l',
    lyceumStudy: 'g s',
    lyceumNext: 'j / ↓',
    lyceumPrev: 'k / ↑',
    lyceumTutor: 'a',
    lyceumGraph: 'g',
    lyceumCompose: 'c',
    lyceumImport: 'i',
    lyceumShortcuts: '?',
    lyceumClose: 'Esc',
  };

  // === KEYBOARD SHORTCUTS STATE ===
  // Seeded with defaults so rows never render blank before the loader resolves.
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(() => ({ ...DEFAULT_SHORTCUTS }));
  const [recordingKey, setRecordingKey] = useState<string | null>(null);


  const SHORTCUT_CONFIG: Record<string, { label: string; description: string; group: string }> = {
    // Global
    voiceInput: { label: 'Voice Input (STT)', description: 'Toggle speech-to-text voice input', group: 'Global' },
    commandPalette: { label: 'Command Palette', description: 'Open command palette search', group: 'Global' },
    aiChatVoice: { label: 'AI Chat Voice Toggle', description: 'Toggle voice mode in AI chat (Ctrl+Shift+M)', group: 'Global' },
    aiPageTranscript: { label: 'AI Page Transcript Rail', description: 'Toggle transcript rail on AI page (Ctrl+Shift+L)', group: 'Global' },
    aiPagePalette: { label: 'AI Page Command Palette', description: 'Open command palette from AI page', group: 'Global' },
    designWorkspacePalette: { label: 'Design Workspace Palette', description: 'Open design workspace command palette', group: 'Global' },
    externalSelect: { label: 'External Activity Select', description: 'Select highlighted external activity (Enter)', group: 'Global' },
    externalDeselect: { label: 'External Activity Deselect', description: 'Deselect external activity (Escape)', group: 'Global' },
    // App
    canvasUndo: { label: 'Canvas Undo', description: 'Undo last canvas mutation (Ctrl+Z)', group: 'App' },
    canvasRedo: { label: 'Canvas Redo', description: 'Redo canvas mutation (Ctrl+Shift+Z / Ctrl+Y)', group: 'App' },
    financeNewTx: { label: 'New Transaction', description: 'Open new transaction dialog (Ctrl+N)', group: 'App' },
    chatSend: { label: 'Send Chat Prompt', description: 'Send the current prompt in chat (Ctrl+Enter)', group: 'App' },
    pageContextSearch: { label: 'Page Context Search', description: 'Search pages in the context panel (Ctrl+F)', group: 'App' },
    ideAddProject: { label: 'Add Project', description: 'Add a new project in IDE help (Ctrl+A)', group: 'App' },
    ideRefresh: { label: 'Refresh IDE Data', description: 'Refresh IDE help data (Ctrl+R)', group: 'App' },
    resumeSubmit: { label: 'Submit Answer', description: 'Submit the current answer field (Ctrl+Enter)', group: 'App' },
    // Terminal
    terminalNewTab: { label: 'New Terminal Tab', description: 'Open a fresh terminal tab (Ctrl+Shift+T)', group: 'Terminal' },
    terminalCloseTab: { label: 'Close Terminal Tab', description: 'Close the active terminal tab (Ctrl+Shift+W)', group: 'Terminal' },
    terminalRename: { label: 'Rename Tab', description: 'Rename active tab inline (Ctrl+Shift+R)', group: 'Terminal' },
    terminalPin: { label: 'Pin Tab', description: 'Pin tab to the front (Ctrl+Shift+P)', group: 'Terminal' },
    terminalNextTab: { label: 'Next Tab', description: 'Cycle to next tab (Ctrl+Tab)', group: 'Terminal' },
    terminalPrevTab: { label: 'Previous Tab', description: 'Cycle to previous tab (Ctrl+Shift+Tab)', group: 'Terminal' },
    terminalSplitH: { label: 'Split Horizontal', description: 'Split active pane side-by-side (Ctrl+Shift+H)', group: 'Terminal' },
    terminalSplitV: { label: 'Split Vertical', description: 'Split active pane stacked (Ctrl+Shift+V)', group: 'Terminal' },
    terminalNextPane: { label: 'Next Pane', description: 'Focus next pane (Ctrl+Shift+ArrowRight)', group: 'Terminal' },
    terminalPrevPane: { label: 'Previous Pane', description: 'Focus previous pane (Ctrl+Shift+ArrowLeft)', group: 'Terminal' },
    terminalZoom: { label: 'Zoom Pane', description: 'Maximize focused pane (Ctrl+Shift+Z)', group: 'Terminal' },
    terminalBroadcast: { label: 'Broadcast Toggle', description: 'Send input to every pane (Ctrl+Shift+B)', group: 'Terminal' },
    terminalPalette: { label: 'Terminal Command Palette', description: 'Fuzzy search actions & commands (Ctrl+K)', group: 'Terminal' },
    terminalClear: { label: 'Clear Pane', description: 'Clear active pane output (Ctrl+L)', group: 'Terminal' },
    terminalWorkspace: { label: 'Save Workspace', description: 'Snapshot tabs as workspace (Ctrl+Shift+S)', group: 'Terminal' },
    terminalFind: { label: 'Find in Terminal', description: 'Search terminal output across all panes (Ctrl+Shift+F)', group: 'Terminal' },
    terminalSaveCmd: { label: 'Save Command', description: 'Save input as command (Ctrl+Shift+D)', group: 'Terminal' },
    terminalCycleTheme: { label: 'Cycle Theme', description: 'Rotate terminal themes (Ctrl+Shift+Y)', group: 'Terminal' },
    terminalFindInPanes: { label: 'Find in Panes', description: 'Search in terminal find mode (Ctrl+Shift+J)', group: 'Terminal' },
    terminalSplitFind: { label: 'Find in Split', description: 'Search within the current split pane (Ctrl+Shift+J)', group: 'Terminal' },
    terminalSplitFindHist: { label: 'Find in Split History', description: 'Search split pane history (Ctrl+Shift+K)', group: 'Terminal' },
    terminalEnter: { label: 'Terminal Enter', description: 'Send Enter to the active terminal pane', group: 'Terminal' },
    quickCapture: { label: 'Quick Capture', description: 'Jump to the training capture box from anywhere (Ctrl+Shift+G)', group: 'Global' },
    terminalBalance: { label: 'Balance Panes', description: 'Balance active pane sizes (Ctrl+Shift+Space)', group: 'Terminal' },
    terminalExport: { label: 'Export Transcript', description: 'Export terminal transcript (Ctrl+Shift+E)', group: 'Terminal' },
    // Lyceum
    lyceumHome: { label: 'Lyceum - Go to Home', description: 'Navigate to home node (g h)', group: 'Lyceum' },
    lyceumLibrary: { label: 'Lyceum - Go to Library', description: 'Navigate to library node (g l)', group: 'Lyceum' },
    lyceumStudy: { label: 'Lyceum - Go to Study', description: 'Navigate to study node (g s)', group: 'Lyceum' },
    lyceumNext: { label: 'Lyceum - Next Node', description: 'Next node (j / ↓)', group: 'Lyceum' },
    lyceumPrev: { label: 'Lyceum - Previous Node', description: 'Previous node (k / ↑)', group: 'Lyceum' },
    lyceumTutor: { label: 'Lyceum - Open Tutor', description: 'Open tutor panel (a)', group: 'Lyceum' },
    lyceumGraph: { label: 'Lyceum - Toggle Graph', description: 'Toggle graph view (g)', group: 'Lyceum' },
    lyceumCompose: { label: 'Lyceum - Compose', description: 'Compose lesson (c)', group: 'Lyceum' },
    lyceumImport: { label: 'Lyceum - Import', description: 'Import lesson (i)', group: 'Lyceum' },
    lyceumShortcuts: { label: 'Lyceum - Toggle Shortcuts', description: 'Toggle shortcuts overlay (?)', group: 'Lyceum' },
    lyceumClose: { label: 'Lyceum - Close', description: 'Close / go home (Esc)', group: 'Lyceum' },
  };

  // Load shortcuts on mount - merge defaults with backend
  useEffect(() => {
    if (window.deskflowAPI?.getKeyboardShortcuts) {
      window.deskflowAPI.getKeyboardShortcuts().then(sc => {
        if (sc && typeof sc === 'object') {
          setShortcuts({ ...DEFAULT_SHORTCUTS, ...sc });
        } else {
          setShortcuts({ ...DEFAULT_SHORTCUTS });
        }
      }).catch(() => {
        setShortcuts({ ...DEFAULT_SHORTCUTS });
      });
    } else {
      setShortcuts({ ...DEFAULT_SHORTCUTS });
    }
  }, []);

  // Restore defaults
  const restoreDefaults = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
  };

  // Start recording a new keybinding
  const startRecording = (key: string) => {
    setRecordingKey(key);
  };

  // Handle key press while recording
  useEffect(() => {
    if (!recordingKey) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.metaKey) parts.push('Cmd');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      const keyName = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (keyName) parts.push(keyName);
      const shortcut = parts.join('+');
      setShortcuts(prev => ({ ...prev, [recordingKey]: shortcut }));
      setRecordingKey(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find which tier a category belongs to
  const findTier = (id: string): 'productive' | 'neutral' | 'distracting' | null => {
    if (tierAssignments.productive.includes(id)) return 'productive';
    if (tierAssignments.neutral.includes(id)) return 'neutral';
    if (tierAssignments.distracting.includes(id)) return 'distracting';
    return null;
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    setActiveContainer(findTier(id));
  };

  // Handle drag over (cross-container movement)
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let overContainer: string | null = null;
    if (overId === 'productive' || overId === 'neutral' || overId === 'distracting') {
      overContainer = overId;
    } else {
      overContainer = findTier(overId);
    }

    if (!overContainer || overContainer === activeContainer) return;

    setTierAssignments(prev => {
      const src = activeContainer as 'productive' | 'neutral' | 'distracting';
      const dst = overContainer as 'productive' | 'neutral' | 'distracting';
      if (!prev[src].includes(activeId)) return prev;
      const newTiers = { ...prev };
      newTiers[src] = newTiers[src].filter(c => c !== activeId);
      newTiers[dst] = [...newTiers[dst], activeId];
      return newTiers;
    });
    setActiveContainer(overContainer);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveContainer(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine source and destination tiers
    const sourceTier = findTier(activeId);

    // Check if overId is a tier name or a category
    let destTier: 'productive' | 'neutral' | 'distracting' | null = null;

    if (overId === 'productive' || overId === 'neutral' || overId === 'distracting') {
      destTier = overId;
    } else {
      destTier = findTier(overId);
    }

    if (!sourceTier || !destTier || sourceTier === destTier) return;

    // Move category from source to destination
    setTierAssignments(prev => {
      const newTiers = { ...prev };
      newTiers[sourceTier] = newTiers[sourceTier].filter(c => c !== activeId);
      newTiers[destTier] = [...newTiers[destTier], activeId];
      return newTiers;
    });
    setHasChanges(true);
    onHasChangesChange(true);
  };

  const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('deskflow-animation-speed') as AnimationSpeed) || 'normal';
    }
    return 'normal';
  });

  // R-10: Boot Animation state (single source = preference store, ruling 2)
  const [bootAnimEnabled, setBootAnimEnabled] = useState(true);
  const [bootAnimVariant, setBootAnimVariant] = useState<'meridian' | 'minimal'>('meridian');
  const [bootAnimWarm, setBootAnimWarm] = useState(false);
  const [bootAnimLoading, setBootAnimLoading] = useState(true);

  // R-10: Mount-load boot animation prefs from preference store (ruling 4)
  useEffect(() => {
    (async () => {
      try {
        if (window.deskflowAPI?.getPreference) {
          const cfg = await window.deskflowAPI.getPreference('boot_animation');
          if (cfg && typeof cfg === 'object') {
            setBootAnimEnabled(cfg.enabled !== false);
            setBootAnimVariant(cfg.variant === 'minimal' ? 'minimal' : 'meridian');
            setBootAnimWarm(!!cfg.warmStart);
          }
        }
      } catch { /* keep defaults */ }
      setBootAnimLoading(false);
    })();
  }, []);

  // Title bar auto-hide mode
  const [tbModeState, setTbModeState] = useState<'always' | 'hover' | 'auto'>(() => {
    try {
      const saved = localStorage.getItem('titleBarMode');
      if (saved === 'always' || saved === 'hover' || saved === 'auto') return saved;
    } catch {}
    return 'always';
  });
  // Seed from the saved preference and stay in sync with changes made elsewhere.
  useEffect(() => {
    const a = (window as any)?.deskflowAPI;
    if (!a?.getTitleBarMode) return;
    a.getTitleBarMode().then((m: string) => {
      if (m === 'always' || m === 'hover' || m === 'auto') setTbModeState(m);
    }).catch(() => {});
    if (!a?.onTitleBarModeChange) return;
    const unsub = a.onTitleBarModeChange((m: string) => {
      if (m === 'always' || m === 'hover' || m === 'auto') setTbModeState(m);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);
  useEffect(() => {
    (async () => {
      try {
        if ((window as any)?.deskflowAPI?.getTitleBarMode) {
          const mode = await (window as any).deskflowAPI.getTitleBarMode();
          if (mode && typeof mode === 'string') setTbModeState(mode as 'always' | 'hover' | 'auto');
        }
      } catch {}
    })();
  }, []);

  const [appCategoryOverrides, setAppCategoryOverrides] = useState<Record<string, string>>({});
  const [domainCategoryOverrides, setDomainCategoryOverrides] = useState<Record<string, string>>({});



  // Load overrides from BOTH localStorage AND categoryConfig on mount
  useEffect(() => {
    const loadOverrides = async () => {
      const overrides: Record<string, string> = {};
      const domainOverrides: Record<string, string> = {};

      // First load from localStorage
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('deskflow-app-category-overrides');
          if (saved) Object.assign(overrides, JSON.parse(saved));
        } catch { /* ignore */ }
        try {
          const saved = localStorage.getItem('deskflow-domain-category-overrides');
          if (saved) Object.assign(domainOverrides, JSON.parse(saved));
        } catch { /* ignore */ }
      }

      // Also load from categoryConfig (for persistence across app restarts)
      if (window.deskflowAPI?.getCategoryConfig) {
        try {
          const config = await window.deskflowAPI.getCategoryConfig();
          // Merge appCategoryMap into overrides
          if (config?.appCategoryMap) {
            Object.assign(overrides, config.appCategoryMap);
          }
          if (config?.domainCategoryMap) {
            Object.assign(domainOverrides, config.domainCategoryMap);
          }
          // Load keyword rules
          if (config?.domainKeywordRules) {
            setDomainKeywordSets(config.domainKeywordRules);
          }
          if (config?.domainDefaultCategories) {
            setDomainDefaultCategories(config.domainDefaultCategories);
          }
          // Load custom categories
          if (config?.customCategories) {
            setCustomCategories(config.customCategories);
            // Make them first-class for every getCategoryStyle() consumer.
            registerCustomCategories(config.customCategories);
          }
        } catch { /* ignore */ }
      }

      // Load tier assignments from backend (ensures custom categories are in tiers)
      if (window.deskflowAPI?.getTierAssignments) {
        try {
          const backendTiers = await window.deskflowAPI.getTierAssignments();
          if (backendTiers) {
            setTierAssignments(prev => {
              const merged = {
                productive: [...new Set([...prev.productive, ...(backendTiers.productive || [])])],
                neutral: [...new Set([...prev.neutral, ...(backendTiers.neutral || [])])],
                distracting: [...new Set([...prev.distracting, ...(backendTiers.distracting || [])])],
              };
              return merged;
            });
          }
        } catch { /* ignore */ }
      }

      // Load keyword-enabled domains and their keyword sets
      if (window.deskflowAPI?.getKeywordEnabledDomains) {
        try {
          const domains = await window.deskflowAPI.getKeywordEnabledDomains();
          setKeywordEnabledDomains(domains);

          // Load keyword sets for each domain
          const keywordSetsMap: Record<string, { category: string; keywords: string[] }[]> = {};
          for (const domain of domains) {
            if (window.deskflowAPI?.getDomainKeywordRules) {
              const rules = await window.deskflowAPI.getDomainKeywordRules(domain);
              if (rules && rules.length > 0) {
                keywordSetsMap[domain] = rules;
              }
            }
          }
          setDomainKeywordSets(keywordSetsMap);
        } catch { /* ignore */ }
      }

      // Load AI config & interest topics
      if (window.deskflowAPI?.getAiConfig) {
        try {
          const config = await window.deskflowAPI.getAiConfig();
          if (config) {
            setAiConfig(prev => ({ ...prev, ...config }));
          }
        } catch { /* ignore */ }
      }
      if (window.deskflowAPI?.getInterestTopics) {
        try {
          const topics = await window.deskflowAPI.getInterestTopics();
          if (topics?.length > 0) setInterestTopics(topics);
        } catch { /* ignore */ }
      }
      // Load Knowledge Base documents (R5)
      if (window.deskflowAPI?.kbList) {
        try {
          const docs = await window.deskflowAPI.kbList();
          if (Array.isArray(docs)) setKbDocs(docs);
        } catch { /* ignore */ }
      }
      // Load OpenRouter API key from preferences
      if (window.deskflowAPI?.getPreferences) {
        try {
          const prefs = await window.deskflowAPI.getPreferences();
          if (prefs?.openrouterApiKey) {
            // Strip any quotes that might have been saved
            const cleanKey = prefs.openrouterApiKey.trim().replace(/^["']|["']$/g, '');
            setOpenRouterApiKey(cleanKey);
          }
          if (prefs?.filterTransientApps !== undefined) {
            setFilterTransientApps(prefs.filterTransientApps);
          }
          if (prefs?.promptHistoryLimit !== undefined) {
            setPromptHistoryLimit(prefs.promptHistoryLimit);
          }
          if (typeof prefs?.sttApiKey === 'string') {
            setSttApiKey(prefs.sttApiKey.replace(/^["']|["']$/g, ''));
          }
          if (typeof prefs?.sttModel === 'string') {
            setSttModel(prefs.sttModel);
          }
          if (typeof prefs?.sttBaseUrl === 'string') {
            setSttBaseUrl(prefs.sttBaseUrl);
          }
        } catch { /* ignore */ }
      }
      if (window.deskflowAPI?.getAiProviders) {
        try {
          const state = await window.deskflowAPI.getAiProviders();
          if (state?.providers) {
            setAiProviders(state.providers);
            setAiProviderRouting(state.routing || { default: { providerId: '', model: '' }, researchDigest: null, goalAssistant: null });
          }
        } catch { /* ignore */ }
      }
      // Load data access preferences
      if (window.deskflowAPI?.getPreferences) {
        try {
          const prefs = await window.deskflowAPI.getPreferences();
          if (prefs?.ai_dataAccess) {
            const parsed = JSON.parse(prefs.ai_dataAccess);
            setDataAccess(prev => ({ ...prev, ...parsed }));
          }
        } catch { /* ignore */ }
      }

      setAppCategoryOverrides(overrides);
      setDomainCategoryOverrides(domainOverrides);
    };
    loadOverrides().catch((e) => console.warn('[Settings] loadOverrides failed:', e?.message || e));
  }, []);
  const [dataSyncMode, setDataSyncMode] = useState<'forward' | 'refactor'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('deskflow-data-sync-mode');
      if (saved === 'refactor' || saved === 'forward') return saved;
    }
    return 'forward';
  });

  /* Save dataSyncMode when it changes, AND raise the save bar.
   *
   * The write alone was silent: the preference reached `localStorage` and the page gave the
   * user no indication whatsoever. A setting that writes without telling you is
   * indistinguishable from one that silently fails — the exact defect that made the Halo
   * island's `enabled` flag untrustworthy for as long as it existed. The audit that found this
   * found the same shape in three other places; they all now report.
   *
   * The `didMount` ref matters because this effect also runs on the FIRST render, where there
   * is no user change to report. Without it the bar would flash up the moment the Settings
   * tab opened, which is worse than silence: a prompt that is wrong once teaches you to
   * distrust the prompt. */
  const dataSyncModeDidMount = useRef(false);
  useEffect(() => {
    localStorage.setItem('deskflow-data-sync-mode', dataSyncMode);
    if (dataSyncModeDidMount.current) setHasChanges(true);
    else dataSyncModeDidMount.current = true;
  }, [dataSyncMode]);

  // Refactor flow: analyze (read-only preview) -> confirm dialog -> apply -> feedback
  type RefactorPhase = 'idle' | 'analyzing' | 'preview' | 'running' | 'done' | 'error';
  interface RefactorMismatch { kind: 'app' | 'domain'; key: string; current: string | null; next: string; count: number; }
  interface RefactorPreview { success: boolean; totalMismatch: number; mismatches: RefactorMismatch[]; byCategory: Record<string, number>; error?: string; }
  const [refactorPhase, setRefactorPhase] = useState<RefactorPhase>('idle');
  const [refactorPreview, setRefactorPreview] = useState<RefactorPreview | null>(null);
  const [refactorMessage, setRefactorMessage] = useState('');
  const [refactorConfirmOpen, setRefactorConfirmOpen] = useState(false);
  const [refactorDoneCount, setRefactorDoneCount] = useState(0);

  const buildOverrideMaps = () => {
    const appOverrides: Record<string, string> = {};
    const domainOverrides: Record<string, string> = {};
    for (const [app, category] of Object.entries(appCategoryOverrides)) {
      if (app && typeof category === 'string' && category.trim()) appOverrides[app.toLowerCase()] = category.trim();
    }
    for (const [domain, category] of Object.entries(domainCategoryOverrides)) {
      if (domain && typeof category === 'string' && category.trim()) domainOverrides[domain.toLowerCase()] = category.trim();
    }
    return { appOverrides, domainOverrides };
  };

  const analyzeRefactor = async () => {
    if (!window.deskflowAPI?.previewCategoriesFromOverrides) {
      setRefactorPhase('error');
      setRefactorMessage('Category preview is not available in this build.');
      return;
    }
    const { appOverrides, domainOverrides } = buildOverrideMaps();
    setRefactorPhase('analyzing');
    setRefactorMessage('');
    try {
      const result = await window.deskflowAPI.previewCategoriesFromOverrides(appOverrides, domainOverrides);
      if (result.success) {
        setRefactorPreview({
          success: true,
          totalMismatch: typeof result.totalMismatch === 'number' ? result.totalMismatch : 0,
          mismatches: Array.isArray(result.mismatches) ? result.mismatches : [],
          byCategory: result.byCategory && typeof result.byCategory === 'object' ? result.byCategory : {},
        });
        setRefactorPhase('preview');
      } else {
        setRefactorPhase('error');
        setRefactorMessage(result.error || 'Could not analyze the data.');
      }
    } catch (err) {
      setRefactorPhase('error');
      setRefactorMessage('Analysis error: ' + (err as Error).message);
    }
  };

  const applyRefactor = async () => {
    if (!window.deskflowAPI?.updateCategoriesFromOverrides) {
      setRefactorPhase('error');
      setRefactorMessage('Database sync is not available.');
      return;
    }
    const { appOverrides, domainOverrides } = buildOverrideMaps();
    setRefactorConfirmOpen(false);
    setRefactorPhase('running');
    setRefactorMessage('');
    try {
      const result = await window.deskflowAPI.updateCategoriesFromOverrides(appOverrides, domainOverrides);
      if (result.success) {
        setRefactorDoneCount(typeof result.updatedCount === 'number' ? result.updatedCount : 0);
        setRefactorPhase('done');
        if (onReloadData) setTimeout(() => onReloadData(), 400);
        setTimeout(() => { if (dataSyncMode === 'refactor') analyzeRefactor(); }, 2600);
      } else {
        setRefactorPhase('error');
        setRefactorMessage(result.error || 'Refactor failed.');
      }
    } catch (err) {
      setRefactorPhase('error');
      setRefactorMessage('Refactor error: ' + (err as Error).message);
    }
  };

  // Read-only preview whenever Refactor mode is active and overrides are loaded/edited
  useEffect(() => {
    if (dataSyncMode !== 'refactor' || refactorPhase !== 'idle') return;
    if (Object.keys(appCategoryOverrides).length === 0 && Object.keys(domainCategoryOverrides).length === 0) return;
    analyzeRefactor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSyncMode, appCategoryOverrides, domainCategoryOverrides]);

  const getAssignedCategories = () => {
    return new Set([
      ...tierAssignments.productive,
      ...tierAssignments.neutral,
      ...tierAssignments.distracting
    ]);
  };

  const removeCategoryFromTier = (tier: 'productive' | 'neutral' | 'distracting', category: string) => {
    setTierAssignments(prev => ({
      ...prev,
      [tier]: prev[tier].filter(c => c !== category)
    }));
    setHasChanges(true);
    onHasChangesChange(true);
  };

  const getUnassignedCategories = () => {
    const assigned = getAssignedCategories();
    return allCategories.filter(cat => !assigned.has(cat));
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (allCategories.some(c => c.toLowerCase() === name.toLowerCase())) return;
    // Update local state FIRST, then persist. The IPC await used to sit above
    // this setState with no try/catch, so a single rejection (handler not
    // registered, main busy, restart mid-call) aborted the handler and the new
    // category silently never appeared in any picker.
    setCustomCategories((prev: string[]) => {
      if (prev.some((c: string) => c.toLowerCase() === name.toLowerCase())) return prev;
      const next = [...prev, name];
      registerCustomCategories(next);
      return next;
    });
    setTierAssignments((prev: any) => ({
      ...prev,
      neutral: [...prev.neutral, name]
    }));
    setNewCategoryName('');
    setHasChanges(true);
    onHasChangesChange?.(true);
    // Persist after the UI is already correct, and never let a failure roll the
    // visible state back — Save will re-push the full list anyway.
    try {
      await (window as any).deskflowAPI?.addCategory?.(name);
    } catch (err: any) {
      console.error('[Settings] add-category IPC failed; category kept locally:', err?.message || err);
    }
  };

  const saveChanges = () => {
    clearSavedNoticeTimer();
    // INSTANT UX: apply all local state + show "saved" notice immediately, then
    // persist to main process / DB in the background. The previous version awaited
    // every IPC round-trip sequentially, so the button felt frozen for seconds.
    // Each persistence step is isolated: one missing/failing IPC channel must never
    // abort the rest of the save.
    localStorage.setItem('deskflow-tier-assignments', JSON.stringify(tierAssignments));
    localStorage.setItem('deskflow-planet-colors', JSON.stringify(localAppColors));
    if (setAppColors) setAppColors(localAppColors);
    if (setCategoryOrder) {
      setCategoryOrder(localCategoryOrder);
      localStorage.setItem('deskflow-category-order', JSON.stringify(localCategoryOrder));
    }
    localStorage.setItem('deskflow-app-category-overrides', JSON.stringify(appCategoryOverrides));
    localStorage.setItem('deskflow-domain-category-overrides', JSON.stringify(domainCategoryOverrides));
    localStorage.setItem('deskflow-animation-speed', animationSpeed);
    localStorage.setItem('deskflow-agent-colors', JSON.stringify(agentColorOverrides));
    try { if (typeof onCategoryOverridesChange === 'function') onCategoryOverridesChange(appCategoryOverrides); } catch (e) { console.error('[Settings] Error notifying parent:', e); }
    setHasChanges(false);
    onHasChangesChange?.(false);
    setSavedNotice(true);
    clearSavedNoticeTimer();
    savedNoticeTimerRef.current = setTimeout(() => setSavedNotice(false), 2500);

    const failed: string[] = [];
    const step = async (label: string, fn: () => Promise<unknown> | unknown) => {
      try { await fn(); }
      catch (err: any) { failed.push(`${label}: ${err?.message || err}`); console.error(`[Settings] save step failed — ${label}:`, err?.message || err); }
    };

    // Background persistence — does not block the UI.
    (async () => {
      try {
        await Promise.all([
          step('setTierAssignments', () => window.deskflowAPI?.setTierAssignments?.(tierAssignments)),
          step('setAppCategory', () => Promise.all(Object.entries(appCategoryOverrides).map(([appName, category]) => window.deskflowAPI!.setAppCategory(appName, category)))),
          step('setDomainCategory', () => Promise.all(Object.entries(domainCategoryOverrides).map(([domain, category]) => window.deskflowAPI!.setDomainCategory(domain, category)))),
          step('boot_animation', () => window.deskflowAPI?.setPreference?.('boot_animation', { enabled: bootAnimEnabled, variant: bootAnimVariant, warmStart: bootAnimWarm })),
          step('trackerAppMode', () => window.deskflowAPI?.setPreference?.('trackerAppMode', trackerAppMode)),
          (openRouterApiKey ? step('openrouterApiKey', () => window.deskflowAPI?.setPreference?.('openrouterApiKey', openRouterApiKey.trim().replace(/^["']|["']$/g, ''))) : Promise.resolve()),
          step('saveAiConfig', () => window.deskflowAPI?.saveAiConfig?.({ ...aiConfig, apiKey: openRouterApiKey.trim().replace(/^["']|["']$/g, '') })),
          step('saveAiProviders', () => window.deskflowAPI?.saveAiProviders?.({ providers: aiProviders.map(({ _newModel, ...rest }) => rest), routing: aiProviderRouting })),
        ]);
        try { if (typeof onReloadData === 'function') onReloadData(); } catch (e) { console.error('[Settings] Error reloading data:', e); }
        await Promise.all([
          step('financeSetDisplayCurrency', () => window.deskflowAPI?.financeSetDisplayCurrency?.(financeCurrency)),
          step('financeSetPasswordRequirement', () => Promise.all(Object.entries(passwordReqs).map(([key, value]) => window.deskflowAPI!.financeSetPasswordRequirement(key, value)))),
          step('setLockedItems', () => window.deskflowAPI?.setLockedItems?.({ lockedApps, lockedDomains })),
        ]);
      } catch (err) {
        failed.push(`saveChanges: ${(err as any)?.message || err}`);
        console.error('[Settings] Save failed:', err);
      } finally {
        if (failed.length) console.error('[Settings] Incomplete save — these did not persist:', failed);
      }
    })();
  };

  const handleAppColorChange = (app: string, color: string) => {
    setLocalAppColors(prev => ({ ...prev, [app]: color }));
    setHasChanges(true);
    onHasChangesChange?.(true);
  };

  const handleCategoryColorChange = (category: string, color: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`deskflow-category-color-${category}`, color);
      setHasChanges(true);
      onHasChangesChange?.(true);
    }
  };

  const getCategoryColor = (category: string): string => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`deskflow-category-color-${category}`);
      if (saved) return saved;
    }
    return CATEGORY_COLORS[category] || '#64748b';
  };

  const getAppColor = (app: string): string => {
    return localAppColors[app] || appColors[app] || '#888888';
  };

  // Keep category assignments live: when a category is saved, main broadcasts the
  // FULL maps. Without this subscriber the panel kept rendering the previous
  // values until a manual reload, so it looked like the change never applied.
  useEffect(() => {
    const api: any = (window as any).deskflowAPI;
    if (!api?.onCategoryConfigChanged) return;
    const off = api.onCategoryConfigChanged((p: any) => {
      if (p?.appCategoryMap) setAppCategoryOverrides(p.appCategoryMap);
      if (p?.domainCategoryMap) setDomainCategoryOverrides(p.domainCategoryMap);
      setHasChanges(false);
    });
    return () => { try { off?.(); } catch { /* ignore */ } };
  }, []);

  const changeAppCategory = (app: string, newCategory: string) => {
    if (lockedApps[app]) return; // Don't change locked apps
    const updated = { ...appCategoryOverrides, [app]: newCategory };
    setAppCategoryOverrides(updated);
    if (setAppColors) {
      const colorKey = `__category__${newCategory}`;
      const newColors = { ...localAppColors };
      newColors[app] = newColors[app] || appColors[app] || CATEGORY_COLORS[newCategory] || '#888888';
      setAppColors(newColors);
    }
    setEditingAppCategory(null);
    setHasChanges(true);
    onHasChangesChange(true);
  };

  const getAppDisplayCategory = (app: any): string => {
    return appCategoryOverrides[app.app] || app.category || 'Other';
  };

  // === LOCK HELPERS ===
  const toggleAppLock = async (appName: string) => {
    const newLocked = { ...lockedApps, [appName]: !lockedApps[appName] };
    if (!newLocked[appName]) delete newLocked[appName]; // Clean up false entries
    setLockedApps(newLocked);
    if (window.deskflowAPI?.setLockedItems) {
      await window.deskflowAPI.setLockedItems({ lockedApps: newLocked });
    }
  };

  const toggleDomainLock = async (domain: string) => {
    const newLocked = { ...lockedDomains, [domain]: !lockedDomains[domain] };
    if (!newLocked[domain]) delete newLocked[domain];
    setLockedDomains(newLocked);
    if (window.deskflowAPI?.setLockedItems) {
      await window.deskflowAPI.setLockedItems({ lockedDomains: newLocked });
    }
  };

  const toggleLockAllApps = async () => {
    const allLocked = displayedAppStats.every((a: any) => lockedApps[a.app]);
    const newLocked: Record<string, boolean> = {};
    if (!allLocked) {
      displayedAppStats.forEach((a: any) => { newLocked[a.app] = true; });
    }
    setLockedApps(newLocked);
    if (window.deskflowAPI?.setLockedItems) {
      await window.deskflowAPI.setLockedItems({ lockedApps: newLocked });
    }
  };

  const toggleLockAllDomains = async () => {
    const allLocked = displayedDomainStats.every((d: any) => lockedDomains[d.domain]);
    const newLocked: Record<string, boolean> = {};
    if (!allLocked) {
      displayedDomainStats.forEach((d: any) => { newLocked[d.domain] = true; });
    }
    setLockedDomains(newLocked);
    if (window.deskflowAPI?.setLockedItems) {
      await window.deskflowAPI.setLockedItems({ lockedDomains: newLocked });
    }
  };

  // === APPROVAL QUEUE HELPERS ===
  const approveChange = async (changeId: string) => {
    const change = pendingChanges.find(c => c.id === changeId);
    if (!change) return;
    // Apply the change to local state
    if (change.type === 'app') {
      changeAppCategory(change.name, change.newCategory);
    } else {
      const newOverrides = { ...domainCategoryOverrides, [change.name]: change.newCategory };
      setDomainCategoryOverrides(newOverrides);
    }
    // Persist to DB
    if (change.type === 'app') {
      if (window.deskflowAPI?.setAppCategory) {
        await window.deskflowAPI.setAppCategory(change.name, change.newCategory);
      }
    } else {
      if (window.deskflowAPI?.setDomainCategory) {
        await window.deskflowAPI.setDomainCategory(change.name, change.newCategory);
      }
    }
    // Record in history
    if (window.deskflowAPI?.addAiChangeHistory) {
      await window.deskflowAPI.addAiChangeHistory({
        name: change.name,
        type: change.type,
        previousCategory: change.previousCategory,
        newCategory: change.newCategory,
        source: 'ai'
      });
    }
    // Remove from pending
    setPendingChanges(prev => prev.filter(c => c.id !== changeId));
    // Refresh history
    if (window.deskflowAPI?.getAiChangeHistory) {
      const history = await window.deskflowAPI.getAiChangeHistory();
      setChangeHistory(history || []);
    }
    setHasChanges(true);
    onHasChangesChange(true);
  };

  const discardChange = (changeId: string) => {
    setPendingChanges(prev => prev.filter(c => c.id !== changeId));
  };

  const approveAllChanges = async () => {
    for (const change of pendingChanges) {
      // Apply the change to local state
      if (change.type === 'app') {
        changeAppCategory(change.name, change.newCategory);
      } else {
        const newOverrides = { ...domainCategoryOverrides, [change.name]: change.newCategory };
        setDomainCategoryOverrides(newOverrides);
      }
      // Persist to DB
      if (change.type === 'app') {
        if (window.deskflowAPI?.setAppCategory) {
          await window.deskflowAPI.setAppCategory(change.name, change.newCategory);
        }
      } else {
        if (window.deskflowAPI?.setDomainCategory) {
          await window.deskflowAPI.setDomainCategory(change.name, change.newCategory);
        }
      }
      // Record in history
      if (window.deskflowAPI?.addAiChangeHistory) {
        await window.deskflowAPI.addAiChangeHistory({
          name: change.name,
          type: change.type,
          previousCategory: change.previousCategory,
          newCategory: change.newCategory,
          source: 'ai'
        });
      }
    }
    setPendingChanges([]);
    if (window.deskflowAPI?.getAiChangeHistory) {
      const history = await window.deskflowAPI.getAiChangeHistory();
      setChangeHistory(history || []);
    }
    setHasChanges(true);
    onHasChangesChange(true);
    clearSavedNoticeTimer();
    savedNoticeTimerRef.current = setTimeout(() => setSavedNotice(false), 2500);
  };

  const discardAllChanges = () => {
    setPendingChanges([]);
  };

  const editPendingChange = (changeId: string, newCategory: string) => {
    setPendingChanges(prev => prev.map(c =>
      c.id === changeId ? { ...c, newCategory } : c
    ));
  };

  // === UNDO/REDO HELPERS ===
  const undoChange = async (changeId: string) => {
    if (window.deskflowAPI?.undoAiChange) {
      await window.deskflowAPI.undoAiChange(changeId);
      // Refresh state
      if (window.deskflowAPI?.getAiChangeHistory) {
        const history = await window.deskflowAPI.getAiChangeHistory();
        setChangeHistory(history || []);
      }
      // Refresh category overrides
      if (window.deskflowAPI?.getCategoryConfig) {
        const config = await window.deskflowAPI.getCategoryConfig();
        setAppCategoryOverrides(config.appCategoryMap || {});
        setDomainCategoryOverrides(config.domainCategoryMap || {});
      }
      setHasChanges(true);
      onHasChangesChange(true);
    }
  };

  useEffect(() => {
    if (onRegisterSave) {
      onRegisterSave(saveChanges);
    }
  }, [tierAssignments, localAppColors, localCategoryOrder, animationSpeed, appCategoryOverrides, domainCategoryOverrides, agentColorOverrides, onRegisterSave, saveChanges]);

  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [originalSecuritySettings, setOriginalSecuritySettings] = useState<any>(null);
  const [financeCurrency, setFinanceCurrency] = useState('USD');
  const [originalFinanceCurrency, setOriginalFinanceCurrency] = useState('USD');
  const [autoSave, setAutoSave] = useState(true);
  const [autoRecalc, setAutoRecalc] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordReqs, setPasswordReqs] = useState<Record<string, boolean>>({
    password_req_delete_account: true,
    password_req_delete_wallet: true,
    password_req_delete_transaction: true,
  });

  useEffect(() => {
    // Load display currency
    if (window.deskflowAPI?.financeGetDisplayCurrency) {
      window.deskflowAPI.financeGetDisplayCurrency().then(result => {
        if (result?.currency) {
          setFinanceCurrency(result.currency);
          setOriginalFinanceCurrency(result.currency);
        }
      }).catch(() => { });
    }
    // Load auto-save setting
    if (window.deskflowAPI?.financeGetAutoSave) {
      window.deskflowAPI.financeGetAutoSave().then(result => {
        if (result && typeof result.enabled === 'boolean') {
          setAutoSave(result.enabled);
        }
      }).catch(() => { });
    }
    // Load auto-recalc setting
    if (window.deskflowAPI?.financeGetAutoRecalc) {
      window.deskflowAPI.financeGetAutoRecalc().then(result => {
        if (result && typeof result.enabled === 'boolean') {
          setAutoRecalc(result.enabled);
        }
      }).catch(() => { });
    }
    // Load security settings
    if (window.deskflowAPI?.financeGetSecuritySettings) {
      window.deskflowAPI.financeGetSecuritySettings().then(settings => {
        setSecuritySettings(settings);
        setOriginalSecuritySettings(settings);
      }).catch(() => { });
    }
    // Load password requirements
    if (window.deskflowAPI?.financeGetPasswordRequirements) {
      window.deskflowAPI.financeGetPasswordRequirements().then(reqs => {
        if (reqs && Object.keys(reqs).length > 0) setPasswordReqs(reqs);
      }).catch(() => { });
    }
  }, []);

  const handleSetFinanceCurrency = (code: string) => {
    setFinanceCurrency(code);
    setHasChanges(true);
    onHasChangesChange(true);
  };

  const handleSetRememberDevice = async (remember: boolean, days: number) => {
    if (!securitySettings) return;
    const expires = remember ? Date.now() + days * 24 * 60 * 60 * 1000 : null;
    const updated = { ...securitySettings, rememberDevice: remember, rememberDeviceExpiry: expires };
    setSecuritySettings(updated);
    setHasChanges(true);
    onHasChangesChange(true);
    await window.deskflowAPI?.financeSetRememberDevice?.(remember, days);
  };

  const handleSetLockTimeout = async (timeoutMs: number) => {
    if (!securitySettings) return;
    const updated = { ...securitySettings, lockTimeout: timeoutMs };
    setSecuritySettings(updated);
    setHasChanges(true);
    onHasChangesChange(true);
    await window.deskflowAPI?.financeSetLockTimeout?.(timeoutMs);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (securitySettings?.hasPassword && !currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }
    try {
      const result = securitySettings?.hasPassword
        ? await window.deskflowAPI?.financeChangePassword?.(currentPassword, newPassword) as { success: boolean }
        : await window.deskflowAPI?.financeSetPassword?.(newPassword) as { success: boolean };
      if (result?.success) {
        setPasswordSuccess('Password updated successfully');
        setNewPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        // Refresh securitySettings so Password Protection card shows immediately
        if (window.deskflowAPI?.financeGetSecuritySettings) {
          window.deskflowAPI.financeGetSecuritySettings().then(settings => {
            setSecuritySettings(settings);
            setOriginalSecuritySettings(settings);
          });
        }
      } else {
        setPasswordError((result as any)?.error || 'Failed to update password');
      }
    } catch (e: any) {
      setPasswordError(e?.message || 'Failed to update password');
    }
  };

  const tabs = [
    { id: 'category', label: 'Category' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'colors', label: 'Colors' },
    { id: 'ai', label: 'AI Assistant' },
    { id: 'general', label: 'General' },
    { id: 'tracking', label: 'Tracking' },
    { id: 'prompts', label: 'System Prompts' },
    { id: 'finance', label: 'Finance' },
    { id: 'devices', label: 'Devices' },
    { id: 'database', label: 'Database' },
    { id: 'auth', label: 'Auth' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  ];

  const [domainStats, setDomainStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchDomainStats = async () => {
      if (window.deskflowAPI?.getBrowserDomainStats) {
        const stats = await window.deskflowAPI.getBrowserDomainStats('all');
        setDomainStats(stats || []);
      }
    };
    if (activeTab === 'category') {
      fetchDomainStats().catch((e) => console.warn('[Settings] fetchDomainStats failed:', e?.message || e));
    }
  }, [activeTab]);

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('settings-activeTab', activeTab);
  }, [activeTab]);

  // Listen for external tab navigation requests
  useEffect(() => {
    const handleOpenTab = (event: CustomEvent) => {
      const tab = event.detail;
      if (tab && tabs.some(t => t.id === tab)) {
        setActiveTab(tab as any);
      }
    };
    window.addEventListener('settings:open-tab', handleOpenTab as any);
    return () => window.removeEventListener('settings:open-tab', handleOpenTab as any);
  }, [tabs]);

  const [editingAppCategory, setEditingAppCategory] = useState<string | null>(null);
  const [editingDomainCategory, setEditingDomainCategory] = useState<string | null>(null);
  const [appCarouselIndex, setAppCarouselIndex] = useState(0);
  const [domainCarouselIndex, setDomainCarouselIndex] = useState(0);
  const [appCarouselExpanded, setAppCarouselExpanded] = useState(false);
  const [domainCarouselExpanded, setDomainCarouselExpanded] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [domainSearchQuery, setDomainSearchQuery] = useState('');
  const [appSearchFilter, setAppSearchFilter] = useState('');
  const [editingExtActivity, setEditingExtActivity] = useState<number | null>(null);
  const [extCarouselIndex, setExtCarouselIndex] = useState(0);
  const [extCarouselExpanded, setExtCarouselExpanded] = useState(false);
  const [domainSearchFilter, setDomainSearchFilter] = useState('');
  const [colorTab, setColorTab] = useState<'apps' | 'websites'>('apps');
  const [colorSearchFilter, setColorSearchFilter] = useState('');
  const [settingsSearch, setSettingsSearch] = useState('');

  // Settings search is driven by the manifest in `pages/settings/registry/`.
  //
  // The object this replaces covered 9 of the 12 tabs, so `appearance`,
  // `database` and `shortcuts` could NEVER be reached by typing — the page just
  // did not move, which reads exactly like broken search. It also returned the
  // FIRST insertion-order hit, so "sync" (owned by Auth, Category and Devices)
  // always landed on whichever happened to be declared first.
  //
  // `searchSettings` scores instead, breaks ties by keyword importance, and
  // reports what matched so results can be highlighted.
  const findMatchingTab = (query: string): SettingsTabId | null => searchSettings(query).bestTab;
  const [generatingColors, setGeneratingColors] = useState(false);
  const [pendingColors, setPendingColors] = useState<Record<string, string>>({});
  const [preAiColors, setPreAiColors] = useState<Record<string, string>>({});
  const [generatingCategories, setGeneratingCategories] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<Record<string, string>>({});
  const [preAiCategories, setPreAiCategories] = useState<Record<string, string>>({});
  // Locked items state
  const [lockedApps, setLockedApps] = useState<Record<string, boolean>>({});
  const [lockedDomains, setLockedDomains] = useState<Record<string, boolean>>({});
  // Pending AI changes (approval queue)
  const [pendingChanges, setPendingChanges] = useState<Array<{
    id: string;
    name: string;
    type: 'app' | 'domain';
    previousCategory: string;
    newCategory: string;
  }>>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  // AI change history (undo/redo)
  const [changeHistory, setChangeHistory] = useState<Array<{
    id: string;
    timestamp: string;
    name: string;
    type: 'app' | 'domain';
    previousCategory: string;
    newCategory: string;
    source: 'ai' | 'manual';
  }>>([]);
  const [showChangeHistory, setShowChangeHistory] = useState(false);
  const [lockedSkipped, setLockedSkipped] = useState<string[]>([]);
  // Live Magic Category / Magic Color run status (streamed from main via provider-chunk)
  const [aiRun, setAiRun] = useState<{ purpose: 'category' | 'colors'; phase: string; provider?: string; error?: string; done?: boolean; prompt?: string; rawOutput?: string } | null>(null);
  const [showRunLogs, setShowRunLogs] = useState(false);
  useEffect(() => {
    const off = window.deskflowAPI?.onProviderChunk?.((d: any) => {
      if (!d || (d.purpose !== 'category' && d.purpose !== 'colors')) return;
      setAiRun(prev => {
        const keep = prev?.purpose === d.purpose
          ? { ...prev }
          : { purpose: d.purpose, phase: 'Starting...' };
        const next = { ...keep };
        if (d.prompt) next.prompt = d.prompt;
        if (d.full) next.rawOutput = d.full;
        if (d.error) return { ...next, phase: '', error: d.error, done: false };
        if (d.done) return { ...next, phase: 'Done', done: true, error: '' };
        if (d.delta) return { ...next, phase: d.delta, provider: d.providerId || keep.provider, error: '' };
        return next;
      });
    });
    return off;
  }, []);
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [apiKeyTestStatus, setApiKeyTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiKeyTestMessage, setApiKeyTestMessage] = useState('');

  // Voice & Speech state
  const [sttApiKey, setSttApiKey] = useState('');
  const [sttModel, setSttModel] = useState('whisper-large-v3-turbo');
  const [sttBaseUrl, setSttBaseUrl] = useState('https://api.groq.com/openai/v1/audio/transcriptions');
  const [showSttKey, setShowSttKey] = useState(false);

  // Floating dictation overlay. It is a portal inside the app now (not a second
  // OS window), so visibility lives in a module store rather than in the main
  // process — this launcher, the /labs launcher and the hotkey all talk to it.
  const [islandOpen, setIslandOpen] = useState(false);
  const [haloPrefs, setHaloPrefs] = useState(HALO_DEFAULTS);
  // Loaded once on mount. There is no `onPreferenceChanged` channel in this
  // preload, so a live subscription would be a silent no-op — the write would land
  // and the control would simply not move, which is worse than not offering it.
  useEffect(() => {
    let alive = true;
    void window.deskflowAPI
      ?.getPreference?.(HALO_PREFS_KEY)
      .then((raw: unknown) => {
        if (alive) setHaloPrefs(normalizeHaloPrefs(raw));
      });
    return () => {
      alive = false;
    };
  }, []);
  const [islandError, setIslandError] = useState<string | null>(null);

  /* THE ONE WRITE PATH FOR HALO PREFERENCES.
   *
   * Every control in this section used to inline the same two lines — set local state, then
   * `setPreference` — and stop there. That persisted the value and did nothing with it: the
   * main process only ever pushed `halo:prefs` on `did-finish-load`, so the renderer had no
   * way to learn about a change and the section had to promise "applies on next launch".
   * Centralising it means a new control cannot forget the third step, which is the failure
   * mode that made every other setting here decorative.
   *
   * It also normalises before writing, so what lands on disk is always a value the island
   * will accept — a partially-edited object can never be persisted half-formed.
   */
  /* Settings copy for the three handoff §5 pages. The `hint` is the one-line description shown
   * under the name, taken from the handoff's own wording for each page.
   *
   * `now` was removed: its app/website readout folded into Focus, which is where the tracked
   * target already lived, and Focus now also shows the real focus session and its lock. */
  const HALO_PAGE_LABELS: Record<HaloPageId, { label: string; hint: string }> = {
    focus: { label: 'Focus', hint: 'Stopwatch, what is being tracked, the focus session and its lock' },
    deadlines: { label: 'Schedule', hint: 'Nearest class block and open deadlines with their alarms' },
    tools: { label: 'Tools', hint: 'Dictation and console' },
  };
  const HALO_PILL_LABELS: Record<HaloPillResident, { label: string; hint: string }> = {
    stopwatch: { label: 'Stopwatch', hint: 'Session time and what it is tracking' },
    now: { label: 'Current app and website', hint: 'What you are using right now' },
    aiUsage: { label: 'AI usage', hint: "Share of today's AI budget used" },
    nextDeadline: { label: 'Next deadline', hint: 'Your closest open deadline' },
    hud: { label: 'Console', hint: 'Running console sessions' },
  };
  /* The stored sequence, falling back to the handoff order so an install that never touched
   * these settings still renders all four pages. `normalizeHaloPages` already guarantees the
   * array is complete, de-duped and never fully hidden. */
  const haloPages: HaloPageId[] = haloPrefs.pages?.order?.length
    ? haloPrefs.pages.order
    : (['focus', 'deadlines', 'tools'] as HaloPageId[]);
  const haloHidden: HaloPageId[] = haloPrefs.pages?.hidden ?? [];

  /* THE HITBOX DIAGRAM MUST DRAW THE REAL PILL.
   *
   * It used `HALO_SIZE_TOKENS.compactWidth` for the width (232 — the legacy token bag) and
   * `resolveHaloSize(prefs.scale).compactHeight` for the height (32 on Medium). The real pill
   * is 198x32 on Medium, so the "TRUE ratio" diagram was 34px too wide before a slider was
   * touched, and the dashed zone inherited the error. One preset, both axes, same as the
   * renderer and `computeHotZone`. */
  const haloPreviewSize = resolveHaloSize(haloPrefs.scale);
  const haloZoneW = haloPreviewSize.compactWidth + haloPrefs.trigger.padX * 2;
  const haloZoneH = haloPreviewSize.compactHeight + haloPrefs.trigger.padY;
  /* The panel is 320px wide and the zone can be 678px (padX 240). A diagram that silently
   * overflows the panel stops being a diagram, so scale the whole group down; the RATIO — the
   * thing this preview exists to show — is preserved. */
  const haloPreviewFit = Math.min(1, (320 - 24) / haloZoneW, (96 - 12) / haloZoneH);

  const haloPrefsRef = useRef(haloPrefs);
  /* Drag-reorder state for the Pages list. `dragIndex` is a ref because it is only read inside
   * the drop handler and re-rendering on every dragstart would fight the drag. */
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pageMenu, setPageMenu] = useState<HaloPageId | null>(null);
  const saveHaloPrefs = useCallback(async (patch: Partial<HaloPrefs>) => {
    /* WHY A REF AND NOT A FUNCTIONAL setState
     *
     * The first version of this did the writes inside the updater:
     *   setHaloPrefs(prev => { persist(...); apply(); return next })
     * A `useState` updater must be PURE, and React calls it twice under StrictMode — so every
     * slider tick would have written to the database and pushed to the island twice. For a
     * range input that is dozens of duplicate IPC round-trips per drag, and it would make the
     * island re-apply preferences the user is still in the middle of changing.
     *
     * Reading the previous value from a ref keeps the callback stable (empty deps, so it is
     * not re-created on every render) and keeps the side effects in the event handler, which
     * is the only place they belong. */
    const next = normalizeHaloPrefs({ ...haloPrefsRef.current, ...patch });
    haloPrefsRef.current = next;
    setHaloPrefs(next);

    /* THE WRITE MUST COMPLETE BEFORE THE PUSH. THIS IS A REAL RACE, NOT A STYLE CHOICE.
     *
     * These were two fire-and-forget `invoke`s on TWO DIFFERENT CHANNELS:
     *   setPreference -> 'set-preference'
     *   applyPrefs    -> 'halo:apply-prefs'
     * Electron guarantees no ordering ACROSS different channels, so `applyPrefs` regularly
     * arrived FIRST. `applyHaloPrefs` in the main process re-reads prefs from disk, so it read
     * the STALE value — still `enabled: false` — and destroyed the island again. The live
     * diagnostic log shows precisely this, and `deskflow-prefs.json` ended up holding
     * `enabled: false` with the island dead, so turning the toggle back ON did nothing either:
     * every push raced the write and lost.
     *
     * THE FIX IS ORDER, NOT RETRY. Awaiting the persist makes the value durable before
     * anything reads it. A retry loop would paper over a race with an unbounded window, and
     * `sleep`-then-retry is exactly the shape behind the OOM disaster in AGENTS.md §0-0.
     *
     * `setHasChanges(true)` moves into a `finally` so the bar still appears if the write
     * THROWS. A setting that stays silent when its persistence errors is worse than one that
     * reports falsely, because the user cannot tell those two apart — which is the same trap
     * as the `enabled` flag this whole chain exists to fix. */
    try {
      await window.deskflowAPI?.setPreference?.(HALO_PREFS_KEY, next);
      await window.haloBridge?.applyPrefs?.();
    } finally {
      setHasChanges(true);
    }
  }, []);

  /* Monitor list for the position picker. Fetched once: displays do not change while this
   * panel is open often enough to justify a subscription, and `listDisplays` is a cheap
   * synchronous read of cached Electron display data in the main process. */
  const [haloDisplays, setHaloDisplays] = useState<
    { id: number; label: string; primary: boolean }[]
  >([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const raw = (await window.haloBridge?.listDisplays?.()) as
          | { id: number; label: string; primary: boolean }[]
          | undefined;
        if (alive && Array.isArray(raw)) setHaloDisplays(raw);
      } catch {
        /* the picker degrades to "main display only" — an honest empty state, not a crash */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await window.haloBridge?.getSnapshot?.();
        if (!cancelled && s) setIslandOpen(!!s.open);
      } catch { /* cosmetic */ }
    })();
    const off = window.haloBridge?.onHover?.((s) => { if (!cancelled) setIslandOpen(!!s.open); });
    return () => { cancelled = true; if (typeof off === 'function') off(); };
  }, []);
  const toggleSttPanel = async () => {
    setIslandError(null);
    try {
      const s = await window.haloBridge?.open?.();
      if (s && typeof s.open === 'boolean') setIslandOpen(s.open);
    } catch (err) {
      setIslandError(err instanceof Error ? err.message : 'The Halo Island could not be opened.');
    }
  };

  // AI Assistant state
  const [interestTopics, setInterestTopics] = useState<string[]>([]);
  const [kbDocs, setKbDocs] = useState<Array<{ id: string; name: string; type: string; addedAt: number }>>([]);
  const [kbIngesting, setKbIngesting] = useState(false);
  const [kbQueryText, setKbQueryText] = useState('');
  const [kbResults, setKbResults] = useState<Array<{ docName: string; content: string }>>([]);
  const [kbQuerying, setKbQuerying] = useState(false);
  const kbFileInputRef = useRef<HTMLInputElement>(null);
  const [newTopic, setNewTopic] = useState('');
  const [aiUsageStats, setAiUsageStats] = useState<{ totalCalls: number; totalCost: number }>({ totalCalls: 0, totalCost: 0 });
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    briefModel: 'google/gemini-2.0-flash-001',
    weeklyModel: 'google/gemini-2.0-flash-001',
    digestModel: 'google/gemini-2.0-flash-001',
    anomalyModel: 'google/gemini-2.0-flash-001',
    autoGenerateBrief: true,
  });

  const [aiProviders, setAiProviders] = useState<any[]>([]);
  const [aiProviderRouting, setAiProviderRouting] = useState<any>({ default: { providerId: '', model: '' }, researchDigest: null, goalAssistant: null });
  const [providerTestStatus, setProviderTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});
  const [providerTestMessages, setProviderTestMessages] = useState<Record<string, string>>({});
  const [showProviderApiKeys, setShowProviderApiKeys] = useState<Record<string, boolean>>({});
  const [dataAccess, setDataAccess] = useState<Record<string, boolean>>({
    projects: true, problems: true, requests: true, aiUsage: true, dashboardStats: true, goals: true, checklist: true, finance: true,
  });

  // Keyword-based productivity categorization state
  // NEW structure: Record<domain, { category: string; keywords: string[] }[]>
  const [keywordEnabledDomains, setKeywordEnabledDomains] = useState<string[]>([]);
  const [editingKeywordDomain, setEditingKeywordDomain] = useState<string | null>(null);
  const [domainKeywordSets, setDomainKeywordSets] = useState<Record<string, { category: string; keywords: string[] }[]>>({});
  const [domainDefaultCategories, setDomainDefaultCategories] = useState<Record<string, string>>({});
  const [newKeywordDomain, setNewKeywordDomain] = useState('');

  // Keyword set editing state
  const [editingKeywordSets, setEditingKeywordSets] = useState<{ category: string; keywords: string[] }[]>([]);
  const [tempKeywordInput, setTempKeywordInput] = useState('');
  const [tempCategoryForNewSet, setTempCategoryForNewSet] = useState('Education');

  // Tracking settings state
  const [sleepGapMs, setSleepGapMs] = useState(10000);
  const [maxSessionMs, setMaxSessionMs] = useState(300000);
  const [trackingPollInterval, setTrackingPollInterval] = useState(1000);
  const [filterTransientApps, setFilterTransientApps] = useState(true);
  // How long toasts/notifications stay on screen. Persisted in
  // localStorage (see src/lib/toastDuration.ts) and applied live.
  const [toastDuration, setToastDurationState] = useState(() => getToastDurationMs());

  // AFK threshold + what to do on AFK (Settings → Tracking → AFK Behaviour).
  const [afkPrefs, setAfkPrefsState] = useState<AfkPrefs>(getAfkPrefs);
  useEffect(() => {
    const onAfk = () => setAfkPrefsState(getAfkPrefs());
    window.addEventListener('afk-prefs-changed', onAfk);
    return () => window.removeEventListener('afk-prefs-changed', onAfk);
  }, []);

  // Bedtime. Sits directly under AFK Behaviour because it is the OTHER half of
  // the same decision — "how long until AFK" and "when does AFK become sleep"
  // were previously defined in three places that disagreed, and only the first
  // of them was ever in this file.
  const [sleepWindow, setSleepWindowState] = useState<SleepWindowPrefs>(getSleepWindow);
  useEffect(() => {
    const onSleep = () => setSleepWindowState(getSleepWindow());
    window.addEventListener(SLEEP_WINDOW_CHANGED_EVENT, onSleep);
    return () => window.removeEventListener(SLEEP_WINDOW_CHANGED_EVENT, onSleep);
  }, []);
  // Global ambient background (the tinted wash). Live — no save bar.
  const [ambientPrefs, setAmbientPrefsState] = useState<AmbientPrefs>(getAmbientPrefs);
  useEffect(() => {
    const onAmbient = () => setAmbientPrefsState(getAmbientPrefs());
    window.addEventListener('ambient-prefs-changed', onAmbient);
    return () => window.removeEventListener('ambient-prefs-changed', onAmbient);
  }, []);
  /* The preview has to repaint when the THEME changes, not only when the ambient
   * prefs do. `ambientTheme()` reads `document.documentElement.classList`, and
   * without this the preview kept drawing the dark-theme alpha after the user
   * flipped to light — a preview that shows the wrong thing is worse than no
   * preview.
   *
   * Observed rather than pushed: the theme is owned by `src/lib/theme.ts`, which
   * flips a class on `<html>`. A MutationObserver on that attribute fires for
   * every writer of that class, so this cannot drift from however the theme is
   * actually applied. */
  const [ambientThemeNow, setAmbientThemeNow] = useState(() => ambientTheme());
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || !document.documentElement) return;
    const mo = new MutationObserver(() => setAmbientThemeNow(ambientTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // Also read once on mount: the observer only fires on a CHANGE, so a page
    // loaded directly into light mode would otherwise show the dark preview.
    setAmbientThemeNow(ambientTheme());
    return () => mo.disconnect();
  }, []);
  const [promptHistoryLimit, setPromptHistoryLimit] = useState(5);
  const [browserRecordingMode, setBrowserRecordingMode] = useState<'always' | 'on-view'>('always');
  const [appRecordingMode, setAppRecordingMode] = useState<'always' | 'on-view'>('always');
  const [availableBrowsers, setAvailableBrowsers] = useState<string[]>([]);
  const [selectedBrowsers, setSelectedBrowsers] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<any>(null);
  // Live extension truth (who is connected right now). Kept separate from
  // availableBrowsers (what is merely installed) because conflating the two is
  // what made this section feel broken: it offered browsers that were not
  // installed and hid the ones actually reporting.
  const [extStatus, setExtStatus] = useState<{
    trackingEnabled?: boolean;
    connectedBrowsers?: string[];
    connectedNow?: Array<{ profileId: string; browserName: string | null; ageMs: number }>;
    profiles?: any[];
  } | null>(null);
  const [extLoading, setExtLoading] = useState(true);
  const [extError, setExtError] = useState<string | null>(null);

  // System Prompts state
  const [systemPrompts, setSystemPrompts] = useState<Record<string, string>>({
    claude: '',
    opencode: '',
    custom: '',
    generalAdditions: ''
  });
  const [promptProjectId, setPromptProjectId] = useState('');
  const [promptProjects, setPromptProjects] = useState<{ id: string; name: string }[]>([]);

  // Load tracking settings on mount
  useEffect(() => {
    const loadTrackingSettings = async () => {
      if (window.deskflowAPI?.getTrackingSettings) {
        const settings = await window.deskflowAPI.getTrackingSettings();
        setSleepGapMs(settings.sleep_gap_ms || 10000);
        setMaxSessionMs(settings.max_session_ms || 300000);
      }
      if (window.deskflowAPI?.getRecordingModes) {
        const modes = await window.deskflowAPI.getRecordingModes();
        setBrowserRecordingMode(modes.browser || 'always');
        setAppRecordingMode(modes.app || 'always');
      }
      if (window.deskflowAPI?.getPreferences) {
        const prefs = await window.deskflowAPI.getPreferences();
        setTrackingPollInterval(prefs.trackingPollInterval || 1000);
        if (prefs?.browsersWithExtension && Array.isArray(prefs.browsersWithExtension)) {
          setSelectedBrowsers(prefs.browsersWithExtension);
        } else if (prefs?.browserWithExtension) {
          setSelectedBrowsers([prefs.browserWithExtension.toLowerCase()]);
        }
      }
      if (window.deskflowAPI?.getAvailableBrowsers) {
        try {
          const browsers = await window.deskflowAPI.getAvailableBrowsers();
          setAvailableBrowsers(browsers || []);
        } catch { setAvailableBrowsers([]); }
      }
      // Get server status via IPC (CSP blocks direct fetch)
      if (window.deskflowAPI?.getBrowserTrackingStatus) {
        try {
          const status = await window.deskflowAPI.getBrowserTrackingStatus();
          setServerStatus(status);
        } catch { setServerStatus({ error: 'Failed to get status' }); }
      }
    };
    loadTrackingSettings().catch((e) => console.warn('[Settings] loadTrackingSettings failed:', e?.message || e));
  }, []);

  // ── Live extension liveness ────────────────────────────────────────────────
  // "Connected" is a heartbeat that expires, so it has to be polled. 10s is fast
  // enough to feel live without hammering IPC, and it means closing the browser
  // visibly drops the dot instead of leaving a permanent lie on screen.
  const refreshExtStatus = useCallback(async () => {
    if (!window.deskflowAPI?.getExtensionStatus) {
      setExtError('This build cannot report extension status. Restart DeskFlow to update.');
      setExtLoading(false);
      return;
    }
    try {
      const st = await window.deskflowAPI.getExtensionStatus();
      setExtStatus(st);
      setExtError(null);
    } catch (e: any) {
      setExtError(e?.message || 'Could not read extension status');
    } finally {
      setExtLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshExtStatus();
    const t = setInterval(refreshExtStatus, 10000);
    return () => clearInterval(t);
  }, [refreshExtStatus]);

  // Listen for browser extension identification (extension calls /browser-identify)
  useEffect(() => {
    if (!window.deskflowAPI?.onBrowserIdentified) return;
    const unsub = window.deskflowAPI.onBrowserIdentified((data: { browser: string }) => {
      console.log('[Settings] Extension identified browser:', data.browser);
      setAvailableBrowsers(prev => {
        const lower = data.browser.toLowerCase();
        if (prev.some(b => b.toLowerCase() === lower)) return prev;
        return [...prev, data.browser];
      });
    });
    return () => { unsub && unsub(); };
  }, []);

  // Load locked items and change history
  useEffect(() => {
    const loadLockedAndHistory = async () => {
      if (window.deskflowAPI?.getLockedItems) {
        const items = await window.deskflowAPI.getLockedItems();
        setLockedApps(items.lockedApps || {});
        setLockedDomains(items.lockedDomains || {});
      }
      if (window.deskflowAPI?.getAiChangeHistory) {
        const history = await window.deskflowAPI.getAiChangeHistory();
        setChangeHistory(history || []);
      }
    };
    loadLockedAndHistory().catch((err) => {
      console.warn('[Settings] failed to load locked items / change history:', err?.message || err);
    });
  }, []);

  // Load system prompts on mount with migration
  useEffect(() => {
    const loadPrompts = async () => {
      if (window.deskflowAPI?.getPreferences) {
        const prefs = await window.deskflowAPI.getPreferences();
        if (prefs?.systemPrompts) {
          const migrated = migrateSystemPrompts(prefs.systemPrompts);
          setSystemPrompts({ claude: '', opencode: '', custom: '', generalAdditions: '', ...migrated });
          if (prefs.systemPrompts.__v !== '2' && window.deskflowAPI?.setPreference) {
            await window.deskflowAPI.setPreference('systemPrompts', migrated);
          }
        }
      }
    };
    loadPrompts().catch((e) => console.warn('[Settings] loadPrompts failed:', e?.message || e));
  }, []);

  // Load projects for project prompt selector
  useEffect(() => {
    const loadProjects = async () => {
      if (window.deskflowAPI?.getProjects) {
        const data = await window.deskflowAPI.getProjects();
        if (Array.isArray(data)) {
          setPromptProjects(data.filter((p: any) => !p.deleted_at).map((p: any) => ({ id: p.id, name: p.name })));
          if (data.length > 0) setPromptProjectId(data[0].id);
        }
      }
    };
    loadProjects().catch((e) => console.warn('[Settings] loadProjects failed:', e?.message || e));
  }, []);

  const handleSaveSystemPrompt = async (key: string, content: string) => {
    const updated = { ...systemPrompts, [key]: content };
    setSystemPrompts(updated);
    if (window.deskflowAPI?.setPreference) {
      await window.deskflowAPI.setPreference('systemPrompts', updated);
    }
    if (key === 'generalAdditions' && (window.deskflowAPI as any)?.writeAgentFile) {
      (window.deskflowAPI as any).writeAgentFile({ relativePath: 'agent/GENERAL_ADDITIONS.md', content: content || '# General Additions\n\n> Auto-generated mirror of the `generalAdditions` preference. Edit in Settings → Prompts.\n' });
    }
  };

  const AGENTS = ['opencode', 'claude', 'aider', 'codex', 'gemini'];

  const DEFAULT_RESUME_COMMANDS: Record<string, string> = {
    opencode: '{agent} -s {resumeId}',
    claude: '{agent} --resume {resumeId}',
    aider: '{agent} --session {resumeId}',
    codex: '{agent} -s {resumeId}',
    gemini: '{agent} -s {resumeId}',
  };

  const [resumeCommands, setResumeCommands] = useState<Record<string, string>>(
    Object.fromEntries(AGENTS.map(a => [a, DEFAULT_RESUME_COMMANDS[a] || '{agent} -s {resumeId}']))
  );

  useEffect(() => {
    const load = async () => {
      if (window.deskflowAPI?.getPreferences) {
        const prefs = await window.deskflowAPI.getPreferences();
        if (prefs?.agentResumeCommands) {
          setResumeCommands(prev => ({ ...prev, ...prefs.agentResumeCommands }));
        }
      }
    };
    load().catch((e) => console.warn('[Settings] load failed:', e?.message || e));
  }, []);

  const handleSaveResumeCommand = async (agent: string, cmd: string) => {
    const updated = { ...resumeCommands, [agent]: cmd };
    setResumeCommands(updated);
    if (window.deskflowAPI?.setPreference) {
      await window.deskflowAPI.setPreference('agentResumeCommands', updated);
    }
  };

  const handleSaveTrackingSetting = async (key: string, value: number) => {
    if (window.deskflowAPI?.setTrackingSetting) {
      await window.deskflowAPI.setTrackingSetting(key, value.toString());
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const [showUncategorizedOnly, setShowUncategorizedOnly] = useState(false);

  const ITEMS_PER_PAGE = 5;

  const uncategorizedCategories = ['Uncategorized', 'Other', ''];

  const filteredAppStats = appSearchFilter
    ? appStats.filter((a: any) => a.app.toLowerCase().includes(appSearchFilter.toLowerCase()))
    : appStats;

  const filteredDomainStats = domainSearchFilter
    ? domainStats.filter((s: any) => s.domain.toLowerCase().includes(domainSearchFilter.toLowerCase()))
    : domainStats;

  const uncategorizedApps = filteredAppStats.filter((a: any) =>
    uncategorizedCategories.includes(appCategoryOverrides[a.app] || a.category || 'Other')
  );
  const uncategorizedDomains = filteredDomainStats.filter((s: any) =>
    uncategorizedCategories.includes(domainCategoryOverrides[s.domain] || s.category || 'Other')
  );

  const displayedAppStats = showUncategorizedOnly ? uncategorizedApps : filteredAppStats;
  const displayedDomainStats = showUncategorizedOnly ? uncategorizedDomains : filteredDomainStats;

  /* WHICH CHANGES ARE ACTUALLY PENDING — the save bar's honesty contract.
   *
   * The bar now appears for EVERY settings change, because most of this page writes through
   * immediately and previously gave the user no confirmation at all. But "unsaved changes" is
   * only true for the small group that genuinely stages in component state and writes on the
   * bar's action: the tier assignments, the planet/app colours, and the category order. Those
   * three live in localStorage under their own keys; everything else is already in the store.
   *
   * So this is computed by COMPARING the live state against what is actually persisted, not by
   * assuming. A flag set at mutation time would be wrong the moment any other path wrote the
   * same key, which is the stale-flag family of bug: the prompt would claim work is pending
   * after it was already saved. Comparing the values makes the bar self-correcting — press
   * Save, the store matches, the copy flips to "Settings applied" on its own.
   *
   * `stringify` is used instead of `===` because these are objects and arrays, and identity
   * comparison would report every render as changed. `JSON.stringify` key order follows
   * insertion order, so both sides are produced by the same writers and the comparison is
   * stable in practice; the fallbacks keep this from ever throwing. */
  const stringify = (v: unknown) => {
    try {
      return JSON.stringify(v ?? null);
    } catch {
      return '';
    }
  };
  const readStored = (key: string) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const hasStagedChanges =
    readStored('deskflow-tier-assignments') !== stringify(tierAssignments) ||
    readStored('deskflow-planet-colors') !== stringify(localAppColors) ||
    readStored('deskflow-category-order') !== stringify(localCategoryOrder) ||
    readStored('deskflow-app-category-overrides') !== stringify(appCategoryOverrides) ||
    readStored('deskflow-domain-category-overrides') !== stringify(domainCategoryOverrides) ||
    readStored('deskflow-agent-colors') !== stringify(agentColorOverrides) ||
    /* `animationSpeed` is a plain string, not JSON, so it is compared verbatim. Wrapping it in
     * `stringify` would quote it and make every comparison false — which is the same bug as
     * `JSON.stringify` on a string, and the reason the type is checked rather than assumed. */
    (readStored('deskflow-animation-speed') ?? '') !== (animationSpeed ?? '');

  return (
    <PageShell page="settings">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-zinc-400" />
            Settings
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Track and customize your app usage</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={settingsSearch}
            onChange={e => {
              const v = e.target.value;
              setSettingsSearch(v);
              // Re-score on EVERY keystroke. The old code also ran per keystroke,
              // but its matcher returned the first hit for the WHOLE query, so
              // once a query matched a tab, later characters could never move you
              // somewhere better.
              const matched = findMatchingTab(v);
              if (matched) setActiveTab(matched as any);
            }}
            placeholder="Search settings..."
            className="w-full bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white/50 border border-zinc-800 rounded-xl pl-9 pr-9 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 transition-colors"
          />
        {settingsSearch && (
          <button onClick={() => setSettingsSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white/50 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${activeTab === tab.id
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 light:bg-zinc-100/50'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content based on active tab */}
{activeTab === 'appearance' && (
        <div data-section="settings.appearance" className="space-y-6">
          {/* ── Ambient background ───────────────────────────────────────────
              The soft tinted wash that used to exist only on the terminal page,
              now on every route and tinted by that page's --page-accent. Four
              controls: off/on, how strong the tint is, how far it spreads, and
              WHICH pages wear it. "Spread" is the distracting one — a wide wash tints
              more of the reading area even when the alpha is low. */}
          <GlassCard>
            <SectionHeader title="Ambient Background" icon={<Sparkles className="w-5 h-5" />} />
            <p className="text-xs text-zinc-500 mb-4">
              A faint tinted light behind the app. Each screen gets its own hue from its accent colour.
            </p>

            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-zinc-300">Enabled</label>
                <p className="text-xs text-zinc-500">Turn the wash off entirely</p>
              </div>
              {/* Was a bare <button> with a hardcoded `bg-emerald-500` track and a
                  `bg-white` knob — a fourth switch style on this page, and a
                  hardcoded hue where the token contract specifies the accent. It is
                  now the same `sf-switch` as every other switch here. */}
              <SettingsSwitch
                checked={ambientPrefs.enabled}
                label="Ambient background"
                onChange={(v) => setAmbientPrefsState(setAmbientPrefs({ enabled: v }))}
              />
            </div>

            {ambientPrefs.enabled && (
              <>
                <div className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-zinc-300">Intensity</label>
                    <span className="text-xs font-mono text-zinc-500">{ambientPrefs.intensity}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={5} value={ambientPrefs.intensity}
                    onChange={(e) => setAmbientPrefsState(setAmbientPrefs({ intensity: Number(e.target.value) }))}
                    aria-label="Ambient intensity"
                    className="w-full"
                  />
                  <p className="text-[11px] text-zinc-600 mt-1">How visible the tint is. Keep it low — this is atmosphere, not decoration.</p>
                </div>

                <div className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-zinc-300">Spread</label>
                    <span className="text-xs font-mono text-zinc-500">{ambientPrefs.spread}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={5} value={ambientPrefs.spread}
                    onChange={(e) => setAmbientPrefsState(setAmbientPrefs({ spread: Number(e.target.value) }))}
                    aria-label="Ambient spread"
                    className="w-full"
                  />
                  <p className="text-[11px] text-zinc-600 mt-1">How far the wash reaches. Higher tints more of the screen and reads as more distracting.</p>
                </div>

                {/* ── WHERE IT SHOWS ──────────────────────────────────────────
                    Progressive disclosure, deliberately (Human-Centric UX §2): the
                    common case is "everywhere", so the common case is a single
                    click. Fifteen checkboxes on screen by default would be the
                    flat-wall-of-controls anti-pattern for a setting almost nobody
                    wants to narrow.
                    `.sf-radio--card` and `.sf-check` are the sanctioned control
                    classes from src/styles/surface.css — not new components, and
                    selected state is carried by a 2px hairline + raised surface
                    rather than by hue alone. */}
                <div className="pt-1 pb-3">
                  <p className="text-sm font-medium text-zinc-300 mb-2">Where it shows</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={ambientPrefs.scope === 'all'}
                      className="sf-radio--card"
                      onClick={() => setAmbientPrefsState(setAmbientPrefs({ scope: 'all' }))}
                    >
                      <span className="text-[13px] font-medium">Every page</span>
                      <span className="text-[11px] text-zinc-500">Tint the whole app. One switch, nothing to maintain.</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={ambientPrefs.scope === 'selected'}
                      className="sf-radio--card"
                      onClick={() => setAmbientPrefsState(setAmbientPrefs({ scope: 'selected' }))}
                    >
                      <span className="text-[13px] font-medium">Only some pages</span>
                      <span className="text-[11px] text-zinc-500">
                        Pick the screens below. Pages you leave unticked stay plain.
                      </span>
                    </button>
                  </div>

                  {ambientPrefs.scope === 'selected' && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--ws-border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] text-zinc-500">
                          {ambientPrefs.pages.length} of {AMBIENT_PAGES.length} pages selected
                        </p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setAmbientPrefsState(setAmbientPrefs({ pages: [...ALL_AMBIENT_PAGE_IDS] }))}
                            className="text-[11px] px-2 py-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmbientPrefsState(setAmbientPrefs({ pages: [] }))}
                            className="text-[11px] px-2 py-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      {/* Empty state, stated rather than left blank: a grid of
                          unticked boxes reads as "nothing selected", which IS the
                          meaning here, but the sentence makes it unambiguous. */}
                      {ambientPrefs.pages.length === 0 && (
                        <p className="text-[11px] text-zinc-500 mb-2" style={{ color: 'var(--text-muted)' }}>
                          No pages selected — the wash is currently off everywhere. Tick at least one to see it.
                        </p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {AMBIENT_PAGES.map(p => {
                          const on = ambientPrefs.pages.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-zinc-800/40"
                              style={{ minHeight: 32 }}
                            >
                              <input
                                type="checkbox"
                                className="sf-check"
                                checked={on}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...ambientPrefs.pages, p.id]
                                    : ambientPrefs.pages.filter(x => x !== p.id);
                                  setAmbientPrefsState(setAmbientPrefs({ pages: next }));
                                }}
                              />
                              <span className="text-[12px]" style={{ color: on ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {p.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* The preview renders the EXACT gradient the app paints, in the
                    current theme, so it cannot drift from reality the way a
                    hardcoded `#22d3ee` approximation would. */}
                <div className="pt-2">
                  <p className="text-[11px] text-zinc-500 mb-2">Preview on {ambientThemeNow === 'light' ? 'light' : 'dark'}</p>
                  <div
                    className="h-16 rounded-lg border"
                    style={{
                      borderColor: 'var(--ws-border)',
                      background: ambientGradient(ambientPrefs, getPageAccent(), ambientThemeNow),
                    }}
                  />
                </div>
              </>
            )}
          </GlassCard>

          <GlassCard className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Appearance</h2>
              <p className="text-sm text-zinc-400 mb-4">Choose how DeskFlow looks on your screen.</p>

              {/* Theme mode — redesigned cards */}
              <div className="grid grid-cols-3 gap-4">
                {(['light', 'dark', 'system'] as const).map(mode => {
                  const isActive = (() => { try { return localStorage.getItem('df-theme') || 'dark'; } catch { return 'dark'; } })() === mode;
                  return (
                    <button key={mode} onClick={() => import('../lib/theme').then(m => m.setTheme(mode))}
                      className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 ${isActive
                        ? mode === 'light' ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : mode === 'dark' ? 'bg-violet-500/10 border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.15)]' : 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                        : 'bg-zinc-800/40 light:bg-zinc-100/40 border-zinc-700/40 hover:border-zinc-600/60 hover:bg-zinc-800/60 light:bg-zinc-100'}`}>
                      <div className={`w-16 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${isActive
                        ? mode === 'light' ? 'border-amber-400 bg-white shadow-sm' : mode === 'dark' ? 'border-violet-400 bg-zinc-900 light:bg-[var(--ws-surface-raised)] shadow-sm' : 'border-blue-400 bg-gradient-to-br from-white to-zinc-800 shadow-sm'
                        : 'border-zinc-600/40 bg-zinc-800'}`}>
                        {mode === 'light' && <div className="w-full h-full rounded-xl bg-gradient-to-br from-amber-50 via-white to-amber-50/50 border border-amber-200/30" />}
                        {mode === 'dark' && <div className="w-full h-full rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900/50 border border-zinc-700/30" />}
                        {mode === 'system' && <div className="w-full h-full rounded-xl bg-gradient-to-br from-white via-zinc-800 to-zinc-950 border border-zinc-600/30" />}
                        {mode === 'light' && <Sun className="w-5 h-5 text-amber-500 absolute" />}
                        {mode === 'dark' && <Moon className="w-5 h-5 text-violet-400 absolute" />}
                        {mode === 'system' && <Monitor className="w-5 h-5 text-blue-400 absolute" />}
                      </div>
                      <span className="text-sm font-semibold capitalize tracking-wide">{mode}</span>
                      <span className="text-xs text-zinc-500">
                        {mode === 'light' ? 'Bright & clean' : mode === 'dark' ? 'Easy on the eyes' : 'Follows your system'}
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId={`theme-badge-${mode}`}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                          <Check className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Smooth accent color picker */}
              <div className="mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-300">Accent Color</h3>
                  <span className="text-xs text-zinc-500">Highlights, borders, active states</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Each swatch is a NAME, not a hex: applyAccent resolves it
                      per theme, because the dark value and the light value are
                      different colours (the dark set is calibrated as a fill on
                      #09090b and fails 4.5:1 on cream). The chip previews the
                      value for the theme currently on screen. */}
                  {ACCENT_SWATCHES.map(color => {
                    const chip = isLightMode() ? color.light : color.dark;
                    const saved = accentColor;
                    // Compare by NAME. It used to compare against a hex, but
                    // the stored value is a swatch name now and the hex is
                    // theme-dependent — a hex comparison can never match in
                    // one of the two themes (and TypeScript proves it: the dark
                    // and light literal unions do not overlap).
                    const isSelected = saved === color.name;
                    return (
                      <button key={color.name}
                        onClick={() => {
                          setAccent(color.name);
                          setAccentColor(color.name);
                          setHasChanges(true);
                          onHasChangesChange(true);
                        }}
                        className={`w-9 h-9 rounded-full border-2 transition-all duration-200 hover:scale-110 ${isSelected
                          ? 'border-white/60 ring-2 ring-white/30 shadow-lg scale-110'
                          : 'border-zinc-700/50 hover:border-zinc-500/70'}`}
                        style={{ backgroundColor: chip }}
                        title={color.name}
                      />
                    );
                  })}
                </div>
                {accentColor && (
                  <button
                    onClick={() => { setAccent(null); setAccentColor(null); setHasChanges(true); onHasChangesChange(true); }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Reset to default (cyan)
                  </button>
                )}
              </div>
            </div>
            </GlassCard>

          {/* Window title bar auto-hide mode */}
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-zinc-500" />
                  Window Title Bar
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Control when the title bar shows or hides</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['always', 'hover', 'auto'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    const a = (window as any)?.deskflowAPI;
                    if (a?.setTitleBarMode) a.setTitleBarMode(mode).catch((e: any) => console.warn('[Settings] setTitleBarMode failed:', e?.message || e));
                    try { localStorage.setItem('titleBarMode', mode); } catch {}
                    setTbModeState(mode);
                    setHasChanges(true);
                    onHasChangesChange(true);
                  }}
                  className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    tbModeState === mode
                      ? 'border-emerald-500/60 bg-emerald-500/8 shadow-[0_0_24px_rgba(50,205,50,0.12)]'
                      : 'border-zinc-700/40 hover:border-zinc-600/60 hover:bg-zinc-800/40 light:hover:bg-zinc-100/40 light:border-zinc-500/50'
                  }`}
                >
                  <Monitor className={`w-5 h-5 ${tbModeState === mode ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="text-xs font-semibold capitalize">
                    {mode === 'always' ? 'Always show' : mode === 'hover' ? 'Hide + hover' : 'Auto-hide 3s'}
                  </span>
                  {tbModeState === mode && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                      on
                    </span>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1 justify-center">
                    {mode === 'always' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">title bar always visible</span>}
                    {mode === 'hover' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">hide on leave, show on hover</span>}
                    {mode === 'auto' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">hide after 3s inactivity</span>}
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* ── Motion ──────────────────────────────────────────────────
              Inertia is a preference, so it is the only half of the scroll
              feature that is togglable. The scrollbar's appearance is NOT
              here and NOT togglable: it is defined once in
              src/styles/surface.css and is the same on every page, because a
              scrollbar that changes shape per page is a styling bug, not a
              setting. The state lives in components/ui/smooth-scroll. */}
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Waves className="w-4 h-4 text-zinc-500" />
                  Smooth scrolling
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {smoothScrollBlockedByOS
                    ? 'Your system asks for reduced motion, so scrolling stays 1:1 and instant. Smooth scrolling is off until you change that system setting.'
                    : 'Pages glide to a stop instead of stopping dead. Scrollbars stay identical either way.'}
                </p>
              </div>
              {/* Was a hand-rolled <button> whose track was filled with
                  `--page-accent` and whose knob was `bg-white`. On this page that
                  token is `var(--text-primary)` = `#fafafa` on dark, so ON rendered
                  white-on-white at 1.04:1. Now the one sanctioned `sf-switch`. */}
              <SettingsSwitch
                checked={smoothScrollEnabled}
                disabled={smoothScrollBlockedByOS}
                label="Smooth scrolling"
                onChange={(v) => setSmoothScrollEnabled(v)}
              />
            </div>
          </GlassCard>

          {/* Quick preview of current theme */}
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Current Theme Preview</h2>
                <p className="text-xs text-zinc-500">How your current choice looks</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] light:bg-white/30 p-5 space-y-3 light:border-zinc-200/40 light:bg-white/50">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-700/50 light:bg-zinc-200/50 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 rounded bg-zinc-700/50 light:bg-zinc-200/50" />
                  <div className="h-2 w-full rounded bg-zinc-700/30" />
                </div>
                <div className="flex gap-1">
                  <div className="w-6 h-6 rounded-full bg-zinc-700/50 light:bg-zinc-200/50" />
                  <div className="w-6 h-6 rounded-full bg-zinc-700/50 light:bg-zinc-200/50" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-full rounded-lg bg-zinc-800/60 light:bg-zinc-100 flex items-center px-3 light:bg-zinc-100">
                  <span className="text-xs text-zinc-500 light:text-zinc-400">Sample card content</span>
                </div>
                <div className="h-8 w-20 rounded-lg bg-zinc-800/60 light:bg-zinc-100 flex items-center justify-center light:bg-zinc-100">
                  <span className="text-xs text-zinc-500 light:text-zinc-400">Action</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'category' && (
        <div data-section="settings.category" className="space-y-4">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors duration-150 ${aiRun?.purpose === 'category' && aiRun.error ? 'bg-red-500/10 border-red-500/30' : aiRun?.purpose === 'category' && aiRun.done ? 'bg-emerald-500/10 border-emerald-500/30' : aiRun?.purpose === 'category' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-800/40 light:bg-zinc-100/40 border-zinc-700/40'}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${aiRun?.purpose === 'category' && aiRun.error ? 'bg-red-500/20' : aiRun?.purpose === 'category' && aiRun.done ? 'bg-emerald-500/20' : aiRun?.purpose === 'category' ? 'bg-amber-500/20' : 'bg-zinc-700/50 light:bg-zinc-200/50'}`}>
              {aiRun?.purpose === 'category' && aiRun.error ? <AlertTriangle className="w-4 h-4 text-red-400" /> : aiRun?.purpose === 'category' && aiRun.done ? <Check className="w-4 h-4 text-emerald-400" /> : aiRun?.purpose === 'category' ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" /> : <Sparkles className="w-4 h-4 text-zinc-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-200">AI Category Assignment</span>
                <Badge variant="secondary">{aiRun?.purpose === 'category' && aiRun.error ? 'Error' : aiRun?.purpose === 'category' && aiRun.done ? 'Completed' : aiRun?.purpose === 'category' ? 'Running' : pendingChanges.length > 0 ? `${pendingChanges.length} pending` : 'Ready'}</Badge>
              </div>
              <p className={`text-xs mt-0.5 ${aiRun?.purpose === 'category' && aiRun.error ? 'text-red-300' : aiRun?.purpose === 'category' && aiRun.done ? 'text-emerald-300' : aiRun?.purpose === 'category' ? 'text-amber-200' : 'text-zinc-500'}`}>
                {aiRun?.purpose === 'category' ? (aiRun.error || aiRun.phase) : pendingChanges.length > 0 ? `${pendingChanges.length} change${pendingChanges.length !== 1 ? 's' : ''} awaiting your approval.` : 'Run Magic Category to auto-assign categories to your apps.'}
              </p>
            </div>
            {aiRun?.purpose === 'category' && aiRun.provider && !aiRun.error && <span className="text-xs text-zinc-400 font-mono flex-shrink-0">via {aiRun.provider}</span>}
            {pendingChanges.length > 0 && (
              <button
                onClick={() => setShowApprovalModal(true)}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition-colors duration-150 flex-shrink-0"
              >
                Review ({pendingChanges.length})
              </button>
            )}
            {(aiRun?.prompt || aiRun?.rawOutput) && (
              <button
                onClick={() => setShowRunLogs(!showRunLogs)}
                className="p-1.5 rounded bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors duration-150 flex-shrink-0"
                title={showRunLogs ? 'Hide provider logs' : 'Show provider logs (prompt & raw output)'}
              >
                {showRunLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            {aiRun?.purpose === 'category' && aiRun.done && !aiRun.error && <button onClick={() => setAiRun(null)} className="p-1 rounded bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors duration-150 flex-shrink-0" title="Dismiss"><X className="w-3.5 h-3.5" /></button>}
          </div>
          {showRunLogs && (aiRun?.prompt || aiRun?.rawOutput) && (
            <div className="space-y-2">
              {aiRun.prompt && (
                <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/70 light:bg-[var(--ws-surface-raised)] light:bg-zinc-100/70 overflow-hidden">
                  <div className="px-3 py-1.5 bg-zinc-800/60 light:bg-zinc-100 text-[11px] font-mono text-zinc-400 border-b border-zinc-700/40">INPUT PROMPT → provider</div>
                  <pre className="px-3 py-2 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-words max-h-40 overflow-y-auto sf-scroll-gutter">{aiRun.prompt}</pre>
                </div>
              )}
              {aiRun.rawOutput && (
                <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/70 light:bg-[var(--ws-surface-raised)] light:bg-zinc-100/70 overflow-hidden">
                  <div className="px-3 py-1.5 bg-zinc-800/60 light:bg-zinc-100 text-[11px] font-mono text-zinc-400 border-b border-zinc-700/40">RAW OUTPUT ← provider</div>
                  <pre className="px-3 py-2 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-words max-h-40 overflow-y-auto sf-scroll-gutter">{aiRun.rawOutput}</pre>
                </div>
              )}
            </div>
          )}
          {/* Data Sync Mode */}
          <SearchableSection terms={['sync', 'forward', 'refactor', 'data sync mode']} search={settingsSearch}>
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Data Sync Mode</h2>
                <p className="text-xs text-zinc-500">Choose how category changes are applied to your data</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDataSyncMode('forward')}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition ${dataSyncMode === 'forward'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-800/50 light:bg-zinc-100/50 text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
              >
                <div className="font-medium">Forward Only</div>
                <div className="text-xs mt-1 opacity-70">New data uses updated categories</div>
              </button>
              <button
                onClick={() => setDataSyncMode('refactor')}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition ${dataSyncMode === 'refactor'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800/50 light:bg-zinc-100/50 text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
              >
                <div className="font-medium">Refactor All Data</div>
                <div className="text-xs mt-1 opacity-70">Update existing data to match categories</div>
              </button>
            </div>
            {dataSyncMode === 'refactor' && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={analyzeRefactor}
                    disabled={refactorPhase === 'analyzing' || refactorPhase === 'running'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/60 light:bg-zinc-100 border border-zinc-700/50 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refactorPhase === 'analyzing' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    {refactorPhase === 'analyzing' ? 'Analyzing data…' : 'Analyze changes'}
                  </button>
                  {(refactorPhase === 'done' || refactorPhase === 'error') && (
                    <button
                      onClick={analyzeRefactor}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/60 light:bg-zinc-100 border border-zinc-700/50 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-analyze
                    </button>
                  )}
                  {refactorPhase === 'idle' && (
                    <p className="text-xs text-zinc-500">Run a read-only analysis to see what would change.</p>
                  )}
                </div>

                {refactorPhase === 'analyzing' && (
                  <div className="space-y-2 px-3 py-3 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] light:bg-white/40 rounded-lg border border-zinc-800">
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-2/3" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
                    <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
                  </div>
                )}

                {refactorPhase === 'error' && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-red-300">{refactorMessage}</p>
                      <button onClick={analyzeRefactor} className="mt-1.5 text-xs text-red-300 underline underline-offset-2 hover:text-red-200">Retry analysis</button>
                    </div>
                  </div>
                )}

                {refactorPhase === 'preview' && refactorPreview && (
                  refactorPreview.totalMismatch === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-xs text-emerald-300">Everything already matches your category settings — nothing to refactor.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-200">
                          <span className="font-semibold text-amber-300">{refactorPreview.totalMismatch.toLocaleString()} rows</span> across{' '}
                          {refactorPreview.mismatches.length} apps/websites don't match your category settings. This action is permanent and cannot be undone.
                        </p>
                      </div>

                      {Object.keys(refactorPreview.byCategory).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(refactorPreview.byCategory).map(([cat, count]) => (
                            <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
                              {cat}: {count.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="max-h-40 overflow-y-auto sf-scroll-gutter rounded-lg border border-zinc-800 divide-y divide-zinc-800/80">
                        {refactorPreview.mismatches.map((m) => (
                          <div key={`${m.kind}-${m.key}`} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-zinc-300 truncate">{m.key}</span>
                              <span className="text-[11px] text-zinc-500 shrink-0">{m.kind === 'domain' ? 'website' : 'app'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                              <span className="text-zinc-500">{m.current || 'unset'}</span>
                              <ChevronRight className="w-3 h-3 text-zinc-600" />
                              <span className="text-amber-300 font-medium">{m.next}</span>
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{(m.count || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => setRefactorConfirmOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refactor All Data ({refactorPreview.totalMismatch.toLocaleString()} rows)
                      </button>
                    </>
                  )
                )}

                {refactorPhase === 'running' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 light:bg-zinc-100/50 text-zinc-400 rounded-lg">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">Refactoring categories across all data…</span>
                  </div>
                )}

                {refactorPhase === 'done' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-xs text-emerald-300">Updated {refactorDoneCount.toLocaleString()} rows to match your category settings.</p>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
          </SearchableSection>

          <Dialog open={refactorConfirmOpen} onOpenChange={setRefactorConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Refactor all data?</DialogTitle>
                <DialogDescription>
                  {refactorPreview && refactorPreview.totalMismatch > 0
                    ? `${refactorPreview.totalMismatch.toLocaleString()} rows across ${refactorPreview.mismatches.length} apps/websites will be updated to match your category settings. This is permanent — there is no undo.`
                    : 'Your category overrides will be applied to all existing data. This is permanent — there is no undo.'}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200">Double-check the breakdown above before continuing. Past tracking data cannot be restored.</p>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button onClick={applyRefactor} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30">
                  <RefreshCw className="w-4 h-4" />
                  {refactorPreview && refactorPreview.totalMismatch > 0 ? `Refactor ${refactorPreview.totalMismatch.toLocaleString()} rows` : 'Refactor all data'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Custom Categories */}
          <SearchableSection terms={['custom', 'categories', 'add category', 'new category']} search={settingsSearch}>
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Custom Categories</h2>
                <p className="text-xs text-zinc-500">Add new categories beyond the defaults</p>
              </div>
            </div>

            {customCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {customCategories.map(cat => {
                  const catColor = getCategoryColor(cat);
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                      style={{ backgroundColor: `${catColor}20`, color: catColor }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                      <span>{cat}</span>
                      <button
                        onClick={async () => {
                          if (window.deskflowAPI?.removeCategory) {
                            await window.deskflowAPI.removeCategory(cat);
                          }
                          setCustomCategories(prev => prev.filter(c => c !== cat));
                          setTierAssignments(prev => ({
                            productive: prev.productive.filter(c => c !== cat),
                            neutral: prev.neutral.filter(c => c !== cat),
                            distracting: prev.distracting.filter(c => c !== cat),
                          }));
                          setHasChanges(true);
                          onHasChangesChange(true);
                        }}
                        className="ml-1 p-0.5 hover:bg-white/10 rounded transition-colors duration-150"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                  placeholder="New category name..."
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500"
                />
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </GlassCard>
          </SearchableSection>

          {/* Productivity Tiers */}
          <SearchableSection terms={['productivity', 'tier', 'productive', 'neutral', 'distracting', 'drag', 'drop']} search={settingsSearch}>
          <GlassCard>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Productivity</h2>
              <p className="text-xs text-zinc-500">Drag categories between tiers</p>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <TierContainer
                  tier="productive"
                  color="#22c55e"
                  label="Productive"
                  description="Full productivity credit."
                  creditLabel="100%"
                >
                  <SortableContext items={tierAssignments.productive} strategy={verticalListSortingStrategy}>
                    {tierAssignments.productive.map(id => (
                      <SortableChip
                        key={id}
                        id={id}
                        color="#22c55e"
                        onRemove={() => removeCategoryFromTier('productive', id)}
                      />
                    ))}
                  </SortableContext>
                  {tierAssignments.productive.length === 0 && (
                    <div className="w-full py-3 border-2 border-dashed border-emerald-500/30 rounded-lg text-center text-xs text-emerald-400/50">
                      Drop here
                    </div>
                  )}
                </TierContainer>

                <TierContainer
                  tier="neutral"
                  color="#3b82f6"
                  label="Neutral"
                  description="Partial credit."
                  creditLabel="50%"
                >
                  <SortableContext items={tierAssignments.neutral} strategy={verticalListSortingStrategy}>
                    {tierAssignments.neutral.map(id => (
                      <SortableChip
                        key={id}
                        id={id}
                        color="#3b82f6"
                        onRemove={() => removeCategoryFromTier('neutral', id)}
                      />
                    ))}
                  </SortableContext>
                  {tierAssignments.neutral.length === 0 && (
                    <div className="w-full py-3 border-2 border-dashed border-blue-500/30 rounded-lg text-center text-xs text-blue-400/50">
                      Drop here
                    </div>
                  )}
                </TierContainer>

                <TierContainer
                  tier="distracting"
                  color="#ef4444"
                  label="Distracting"
                  description="No credit."
                  creditLabel="0%"
                >
                  <SortableContext items={tierAssignments.distracting} strategy={verticalListSortingStrategy}>
                    {tierAssignments.distracting.map(id => (
                      <SortableChip
                        key={id}
                        id={id}
                        color="#ef4444"
                        onRemove={() => removeCategoryFromTier('distracting', id)}
                      />
                    ))}
                  </SortableContext>
                  {tierAssignments.distracting.length === 0 && (
                    <div className="w-full py-3 border-2 border-dashed border-red-500/30 rounded-lg text-center text-xs text-red-400/50">
                      Drop here
                    </div>
                  )}
                </TierContainer>
              </div>

              <DragOverlay>
                {activeId ? (
                  (() => {
                    const tier = findTier(activeId);
                    const chipColor = getTierColor(tier);
                    return (
                      <div className="fixed px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border cursor-grabbing z-[9999] pointer-events-none"
                        style={{
                          borderColor: `${chipColor}50`,
                          color: chipColor,
                          backgroundColor: `${chipColor}15`,
                          transform: 'translate(-50%, -50%)',
                          left: '50%',
                          top: '50%'
                        }}
                      >
                        <GripVertical className="w-3 h-3 opacity-50" />
                        <span>{activeId}</span>
                      </div>
                    );
                  })()
                ) : null}
              </DragOverlay>
            </DndContext>
          </GlassCard>
          </SearchableSection>

          {/* External Activities Tier Assignment */}
          <SearchableSection terms={['external', 'activities', 'external activities']} search={settingsSearch}>
          {externalActivities.length > 0 && (
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">External Activities</h2>
                    <p className="text-xs text-zinc-500">Click activity to change tier</p>
                  </div>
                  <span className="text-xs text-zinc-500 bg-zinc-800/50 light:bg-zinc-100/50 px-2 py-1 rounded-md">{externalActivities.length} activities</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { if (extCarouselIndex > 0) setExtCarouselIndex(extCarouselIndex - 1); }}
                  disabled={extCarouselIndex === 0}
                  className="flex-shrink-0 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex-1 grid grid-cols-5 gap-2">
                  {externalActivities.slice(
                    extCarouselIndex * (extCarouselExpanded ? 15 : ITEMS_PER_PAGE),
                    extCarouselIndex * (extCarouselExpanded ? 15 : ITEMS_PER_PAGE) + (extCarouselExpanded ? 15 : ITEMS_PER_PAGE)
                  ).map(act => {
                    const currentTier = localExternalTiers[act.id] || (act.is_productive ? 'productive' : 'neutral');
                    const tierColor = getTierColor(currentTier);
                    const isEditing = editingExtActivity === act.id;

                    return (
                      <div key={act.id}>
                        <button
                          onClick={() => setEditingExtActivity(isEditing ? null : act.id)}
                          className={`w-full flex flex-col items-center p-3 rounded-xl border transition-colors duration-150 group ${isEditing
                            ? 'bg-zinc-700/60 border-2 border-emerald-500/60'
                            : 'bg-zinc-800/40 light:bg-zinc-100/40 hover:bg-zinc-800/70 border border-zinc-700/30 hover:border-zinc-500'
                            }`}
                        >
                          <div className="flex items-center justify-center gap-1.5 w-full">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tierColor }} />
                            <span className="text-xs text-zinc-200 group-hover:text-white truncate max-w-[calc(100%-16px)]">{act.name}</span>
                          </div>
                          <span className="text-xs px-1.5 py-0.5 rounded mt-1.5" style={{ backgroundColor: `${tierColor}20`, color: tierColor }}>
                            {currentTier}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    const itemsPerView = extCarouselExpanded ? 15 : ITEMS_PER_PAGE;
                    const maxPage = Math.max(0, Math.ceil(externalActivities.length / itemsPerView) - 1);
                    if (extCarouselIndex < maxPage) setExtCarouselIndex(extCarouselIndex + 1);
                  }}
                  disabled={extCarouselIndex >= Math.max(0, Math.ceil(externalActivities.length / (extCarouselExpanded ? 15 : ITEMS_PER_PAGE)) - 1)}
                  className="flex-shrink-0 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Show More/Less Button */}
              {externalActivities.length > 5 && (
                <button
                  onClick={() => {
                    setExtCarouselExpanded(!extCarouselExpanded);
                    setExtCarouselIndex(0);
                  }}
                  className="mt-3 w-full py-2 bg-zinc-800/50 light:bg-zinc-100/50 hover:bg-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors duration-150 flex items-center justify-center gap-2"
                >
                  {extCarouselExpanded ? (
                    <><ChevronUp className="w-4 h-4" /> Show Less</>
                  ) : (
                    <><ChevronDown className="w-4 h-4" /> Show More</>
                  )}
                </button>
              )}

              {/* Tier Selection Panel */}
              {editingExtActivity !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] light:bg-white/60 rounded-xl border border-zinc-700/50"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {(['productive', 'neutral', 'distracting'] as const).map(tier => {
                      const tierColors = { productive: getTierColor('productive'), neutral: getTierColor('neutral'), distracting: getTierColor('distracting') };
                      const currentTier = localExternalTiers[editingExtActivity] || 'neutral';
                      const isSelected = currentTier === tier;
                      return (
                        <button
                          key={tier}
                          onClick={() => {
                            const updated = { ...localExternalTiers, [editingExtActivity]: tier };
                            setLocalExternalTiers(updated);
                            localStorage.setItem('deskflow-external-activity-tiers', JSON.stringify(updated));
                            onExternalActivityTiersChange?.(updated);
                            /* This one DID already raise a transient "Saved" popup — the only
                             * write-through setting that did. It still skipped the persistent
                             * bar, so the confirmation vanished after 2.5s and left no record
                             * that anything had changed. The two now agree: the popup for the
                             * immediate acknowledgement, the bar for the standing state. */
                            setHasChanges(true);
                            setSavedNotice(true);
                            clearSavedNoticeTimer();
                            savedNoticeTimerRef.current = setTimeout(() => setSavedNotice(false), 2500);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${isSelected ? 'ring-2 ring-white/30' : 'hover:bg-zinc-800'
                            }`}
                          style={{ backgroundColor: `${tierColors[tier]}15`, borderColor: isSelected ? tierColors[tier] : 'transparent', color: tierColors[tier] }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tierColors[tier] }} />
                          <span className="capitalize">{tier}</span>
                          {isSelected && <Check className="w-4 h-4 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setEditingExtActivity(null)}
                    className="w-full mt-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 transition-colors duration-150"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </GlassCard>
          )}
          </SearchableSection>

          {/* AI Changes Confirmation Modal (popup asks for confirmation before applying) */}
          {createPortal(
            <AnimatePresence>
              {showApprovalModal && (
                <motion.div
                  className="fixed inset-0 z-[300] flex items-center justify-center p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)} />
                  <motion.div
                    initial={{ scale: 0.95, y: 12, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 12, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="relative w-full max-w-lg flex flex-col overflow-hidden rounded-xl border border-amber-500/30 bg-[#18181b]/95 shadow-2xl"
                  >
                    <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-zinc-800">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-zinc-100">Confirm AI Category Changes</h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {pendingChanges.length} change{pendingChanges.length !== 1 ? 's' : ''} suggested — nothing is applied until you approve
                          {lockedSkipped.length > 0 && ` · ${lockedSkipped.length} locked skipped`}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowApprovalModal(false)}
                        className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors duration-150 flex-shrink-0"
                        title="Close (changes stay pending)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {lockedSkipped.length > 0 && (
                      <div className="mx-5 mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-xs text-amber-400"><span className="font-medium">Locked items skipped:</span> {lockedSkipped.join(', ')}</p>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto sf-scroll-gutter px-5 py-3 space-y-2 max-h-[45vh]">
                      {pendingChanges.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center">
                          <Check className="w-6 h-6 text-emerald-400" />
                          <p className="text-sm font-medium text-zinc-300">All changes resolved</p>
                          <p className="text-xs text-zinc-500">No pending AI category changes.</p>
                        </div>
                      ) : pendingChanges.map((change) => {
                        const catColor = getCategoryColor(change.newCategory);
                        const prevColor = getCategoryColor(change.previousCategory);
                        return (
                          <motion.div
                            key={change.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-3 p-3 bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl border border-zinc-700/30"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-zinc-200 truncate">{change.name}</span>
                                <Badge variant="secondary">{change.type}</Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${prevColor}20`, color: prevColor }}>
                                  {change.previousCategory}
                                </span>
                                <svg className="w-3 h-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
                                  {change.newCategory}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const cats = allCategories;
                                const currentIdx = cats.indexOf(change.newCategory);
                                editPendingChange(change.id, cats[(currentIdx + 1) % cats.length]);
                              }}
                              className="p-1.5 rounded bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors duration-150"
                              title="Change suggested category"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => approveChange(change.id)}
                              className="p-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors duration-150"
                              title="Approve change"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => discardChange(change.id)}
                              className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors duration-150"
                              title="Discard change"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-zinc-800 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white/50">
                      {pendingChanges.length > 0 ? (
                        <>
                          <button
                            onClick={() => { discardAllChanges(); }}
                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg text-sm font-medium transition-colors duration-150"
                          >
                            Discard All
                          </button>
                          <button
                            onClick={approveAllChanges}
                            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors duration-150"
                          >
                            Approve All ({pendingChanges.length})
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setShowApprovalModal(false)}
                          className="ml-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm font-medium transition-colors duration-150"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

          {/* Change History (Undo/Redo) */}
          {changeHistory.length > 0 && (
            <SearchableSection terms={['history', 'undo', 'redo', 'changes', 'log']} search={settingsSearch}>
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-700/50 light:bg-zinc-200/50 flex items-center justify-center">
                    <History className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Change History</h2>
                    <p className="text-xs text-zinc-500">{changeHistory.length} recorded change{changeHistory.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowChangeHistory(!showChangeHistory)}
                    className="px-3 py-1.5 bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 text-zinc-400 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
                  >
                    {showChangeHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showChangeHistory ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={async () => {
                      if (window.deskflowAPI?.clearAiChangeHistory) {
                        await window.deskflowAPI.clearAiChangeHistory();
                        setChangeHistory([]);
                      }
                    }}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors duration-150"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showChangeHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 max-h-64 overflow-y-auto sf-scroll-gutter">
                      {changeHistory.slice().reverse().map((change) => {
                        const catColor = getCategoryColor(change.newCategory);
                        const prevColor = getCategoryColor(change.previousCategory);
                        const timeAgo = formatTimeAgo(change.timestamp);
                        return (
                          <div
                            key={change.id}
                            className="flex items-center gap-3 p-5 bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl border border-zinc-700/30 hover:border-zinc-600/50 transition-colors duration-150"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-zinc-200 truncate">{change.name}</span>
                                <Badge variant="outline">{timeAgo}</Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${prevColor}20`, color: prevColor }}>
                                  {change.previousCategory}
                                </span>
                                <svg className="w-3 h-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
                                  {change.newCategory}
                                </span>
                                <Badge variant="outline">{change.source}</Badge>
                              </div>
                            </div>

                            {/* Undo button */}
                            <button
                              onClick={() => undoChange(change.id)}
                              className="p-1.5 rounded bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors duration-150"
                              title="Undo this change"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
            </SearchableSection>
          )}

          {/* Applications Section - Carousel with Expandable Grid */}
          <SearchableSection terms={['applications', 'apps', 'application']} search={settingsSearch}>
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Applications</h2>
                  <p className="text-xs text-zinc-500">Click app to change category · Lock to block AI changes</p>
                </div>
                {appStats.length > 0 && (
                  <span className="text-xs text-zinc-500 bg-zinc-800/50 light:bg-zinc-100/50 px-2 py-1 rounded-md">{displayedAppStats.length} apps</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUncategorizedOnly(!showUncategorizedOnly)}
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 ${showUncategorizedOnly ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-white'}`}
                  title="Show only uncategorized apps"
                >
                  <Inbox className="w-3.5 h-3.5" />
                  Uncategorized
                </button>
                <button
                  onClick={async () => {
                    setPreAiCategories({ ...appCategoryOverrides });
                    setGeneratingCategories(true);
                    setLockedSkipped([]);
                    setAiRun({ purpose: 'category', phase: 'Starting...' });
                    try {
                      const itemsToCategorize = appStats.map((a: any) => ({
                        name: a.app,
                        category: getAppDisplayCategory(a)
                      }));
                      if (window.deskflowAPI?.generateAICategorization) {
                        const result = await window.deskflowAPI.generateAICategorization(itemsToCategorize);
                        const changes = (result.changes || []).map((c: any) => ({
                          id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                          name: c.name,
                          type: c.type || 'app',
                          previousCategory: c.previousCategory,
                          newCategory: c.newCategory
                        }));
                        setPendingChanges(prev => [...prev, ...changes]);
                        if (changes.length > 0) setShowApprovalModal(true);
                        setLockedSkipped(result.lockedSkipped || []);
                        setAiRun(prev => prev?.error ? prev : ({
                          purpose: 'category',
                          phase: `${changes.length} change${changes.length === 1 ? '' : 's'} ready to review`,
                          done: true,
                          provider: prev?.provider,
                          error: ''
                        }));
                        setGeneratingCategories(false);
                      }
                    } catch (err) {
                      console.error('Magic Category failed:', err);
                      setAiRun({ purpose: 'category', phase: '', error: err instanceof Error ? err.message : String(err), done: false });
                      setGeneratingCategories(false);
                    }
                  }}
                  disabled={generatingCategories}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {generatingCategories ? 'Generating...' : 'Magic Category'}
                </button>
                {appStats.length > 0 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search apps..."
                        value={appSearchFilter}
                        onChange={(e) => { setAppSearchFilter(e.target.value); setAppCarouselIndex(0); }}
                        className="pl-8 pr-3 py-1.5 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 w-36"
                      />
                  </div>
                )}
              </div>
            </div>

            {displayedAppStats.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const current = appCarouselIndex; if (current > 0) setAppCarouselIndex(current - 1); }}
                    disabled={appCarouselIndex === 0}
                    className="flex-shrink-0 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className={`flex-1 grid gap-2 ${appCarouselExpanded ? 'grid-cols-5' : 'grid-cols-5'}`}>
                    {displayedAppStats.slice(
                      appCarouselIndex * (appCarouselExpanded ? 15 : ITEMS_PER_PAGE),
                      appCarouselIndex * (appCarouselExpanded ? 15 : ITEMS_PER_PAGE) + (appCarouselExpanded ? 15 : ITEMS_PER_PAGE)
                    ).map((app: any) => {
                      const displayCategory = getAppDisplayCategory(app);
                      const categoryColor = getCategoryColor(displayCategory);
                      const isEditing = editingAppCategory === app.app;

                      return (
                        <div key={app.app} className="relative">
                          <button
                            onClick={() => setEditingAppCategory(isEditing ? null : app.app)}
                            className={`w-full flex flex-col items-center p-3 rounded-xl border transition-colors duration-150 group ${isEditing
                              ? 'bg-zinc-700/60 border-2 border-emerald-500/60'
                              : 'bg-zinc-800/40 light:bg-zinc-100/40 hover:bg-zinc-800/70 border border-zinc-700/30 hover:border-zinc-500'
                              }`}
                          >
                            {/* Individual AI Sparkle Button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (lockedApps[app.app]) return; // Don't AI-categorize locked apps
                                try {
                                  if (window.deskflowAPI?.generateAICategorization) {
                                    const result = await window.deskflowAPI.generateAICategorization([{
                                      name: app.app,
                                      category: displayCategory
                                    }]);
                                    if (result.changes && result.changes.length > 0) {
                                      const change = result.changes[0];
                                      setPendingChanges(prev => [...prev, {
                                        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                        name: change.name,
                                        type: 'app',
                                        previousCategory: change.previousCategory,
                                        newCategory: change.newCategory
                                      }]);
                                      setShowApprovalModal(true);
                                    }
                                  }
                                } catch (err) {
                                  console.error('Individual AI categorize failed:', err);
                                }
                              }}
                              disabled={lockedApps[app.app]}
                              className="absolute top-1.5 right-1.5 p-1 rounded bg-white/10 hover:bg-white/20 text-white/40 hover:text-white transition-colors duration-150 opacity-60 hover:opacity-100 z-10 disabled:opacity-20 disabled:cursor-not-allowed"
                              title={lockedApps[app.app] ? "Unlock to use AI" : "AI Categorize"}
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>

                            {/* Lock Toggle Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAppLock(app.app);
                              }}
                              className={`absolute top-1.5 left-1.5 p-1 rounded transition-colors duration-150 z-10 ${
                                lockedApps[app.app]
                                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                  : 'bg-white/10 text-white/30 hover:bg-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100'
                              }`}
                              title={lockedApps[app.app] ? "Unlock app" : "Lock app (blocks AI & manual changes)"}
                            >
                              {lockedApps[app.app] ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <LockOpen className="w-3 h-3" />
                              )}
                            </button>

                            <div className="flex items-center justify-center gap-1.5 w-full pr-5 pl-5">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                              <span className="text-xs text-zinc-200 group-hover:text-white truncate max-w-[calc(100%-16px)]">{app.app}</span>
                            </div>
                            <span className="text-xs px-1.5 py-0.5 rounded mt-1.5" style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}>
                              {displayCategory}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      const itemsPerView = appCarouselExpanded ? 15 : ITEMS_PER_PAGE;
                      const maxPage = Math.max(0, Math.ceil(displayedAppStats.length / itemsPerView) - 1);
                      if (appCarouselIndex < maxPage) setAppCarouselIndex(appCarouselIndex + 1);
                    }}
                    disabled={appCarouselIndex >= Math.max(0, Math.ceil(displayedAppStats.length / (appCarouselExpanded ? 15 : ITEMS_PER_PAGE)) - 1)}
                    className="flex-shrink-0 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Show More/Less Button */}
                {displayedAppStats.length > 5 && (
                  <button
                    onClick={() => {
                      setAppCarouselExpanded(!appCarouselExpanded);
                      setAppCarouselIndex(0);
                    }}
                    className="mt-3 w-full py-2 bg-zinc-800/50 light:bg-zinc-100/50 hover:bg-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors duration-150 flex items-center justify-center gap-2"
                  >
                    {appCarouselExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show More
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{appSearchFilter ? 'No matching apps' : 'No apps tracked yet'}</p>
              </div>
            )}

            {/* Full Category Selection Panel */}
            {editingAppCategory && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] light:bg-white/60 rounded-xl border border-zinc-700/50"
              >
                {lockedApps[editingAppCategory] ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Lock className="w-5 h-5" />
                      <span className="text-sm font-medium">App is locked</span>
                    </div>
                    <p className="text-xs text-zinc-500 text-center">Unlock this app first to change its category</p>
                    <button
                      onClick={() => { toggleAppLock(editingAppCategory); setEditingAppCategory(null); }}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm transition-colors duration-150"
                    >
                      Unlock
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={appSearchQuery}
                        onChange={(e) => setAppSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto sf-scroll-gutter">
                      {allCategories.filter(cat => cat.toLowerCase().includes(appSearchQuery.toLowerCase())).map((cat) => {
                        const catColor = getCategoryColor(cat);
                        const appData = appStats.find((a: any) => a.app === editingAppCategory);
                        const displayCategory = getAppDisplayCategory(appData);
                        const isSelected = displayCategory === cat;
                        return (
                        <button
                        key={cat}
                        onClick={() => changeAppCategory(editingAppCategory, cat)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${isSelected ? 'ring-2 ring-white/30' : 'hover:bg-zinc-800'
                          }`}
                        style={{ backgroundColor: `${catColor}15`, borderColor: isSelected ? catColor : 'transparent', color: catColor }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catColor }} />
                        <span>{cat}</span>
                        {isSelected && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setEditingAppCategory(null)}
                  className="w-full mt-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 transition-colors duration-150"
                >
                  Done
                </button>
                  </>
                )}
              </motion.div>
            )}
          </GlassCard>
          </SearchableSection>

          {/* Websites Section - Carousel with Expandable Grid */}
          <SearchableSection terms={['websites', 'domains', 'website']} search={settingsSearch}>
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Websites</h2>
                  <p className="text-xs text-zinc-500">Click site to change category · Lock to block AI changes</p>
                </div>
                {domainStats.length > 0 && (
                  <span className="text-xs text-zinc-500 bg-zinc-800/50 light:bg-zinc-100/50 px-2 py-1 rounded-md">{displayedDomainStats.length} sites</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUncategorizedOnly(!showUncategorizedOnly)}
                  className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 ${showUncategorizedOnly ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-white'}`}
                  title="Show only uncategorized sites"
                >
                  <Inbox className="w-3.5 h-3.5" />
                  Uncategorized
                </button>
                {displayedDomainStats.length > 0 && (
                  <button
                    onClick={toggleLockAllDomains}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
                    title={displayedDomainStats.every((d: any) => lockedDomains[d.domain]) ? "Unlock all domains" : "Lock all domains"}
                  >
                    {displayedDomainStats.every((d: any) => lockedDomains[d.domain]) ? (
                      <LockOpen className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    {displayedDomainStats.every((d: any) => lockedDomains[d.domain]) ? 'Unlock All' : 'Lock All'}
                  </button>
                )}
                <button
                  onClick={async () => {
                    setPreAiCategories({ ...domainCategoryOverrides });
                    setGeneratingCategories(true);
                    setLockedSkipped([]);
                    setAiRun({ purpose: 'category', phase: 'Starting...' });
                    try {
                      const itemsToCategorize = domainStats.map((d: any) => ({
                        name: d.domain,
                        category: domainCategoryOverrides[d.domain] || d.category || 'Other'
                      }));
                      if (window.deskflowAPI?.generateAICategorization) {
                        const result = await window.deskflowAPI.generateAICategorization(itemsToCategorize);
                        const changes = (result.changes || []).map((c: any) => ({
                          id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                          name: c.name,
                          type: 'domain',
                          previousCategory: c.previousCategory,
                          newCategory: c.newCategory
                        }));
                        setPendingChanges(prev => [...prev, ...changes]);
                        if (changes.length > 0) setShowApprovalModal(true);
                        setLockedSkipped(result.lockedSkipped || []);
                        setAiRun(prev => prev?.error ? prev : ({
                          purpose: 'category',
                          phase: `${changes.length} change${changes.length === 1 ? '' : 's'} ready to review`,
                          done: true,
                          provider: prev?.provider,
                          error: ''
                        }));
                        setGeneratingCategories(false);
                      }
                    } catch (err) {
                      console.error('Magic Category failed:', err);
                      setAiRun({ purpose: 'category', phase: '', error: err instanceof Error ? err.message : String(err), done: false });
                      setGeneratingCategories(false);
                    }
                  }}
                  disabled={generatingCategories}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {generatingCategories ? 'Generating...' : 'Magic Category'}
                </button>
                {domainStats.length > 0 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search sites..."
                      value={domainSearchFilter}
                      onChange={(e) => { setDomainSearchFilter(e.target.value); setDomainCarouselIndex(0); }}
                      className="pl-8 pr-3 py-1.5 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 w-36"
                    />
                  </div>
                )}
              </div>
            </div>

            {displayedDomainStats.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const current = domainCarouselIndex; if (current > 0) setDomainCarouselIndex(current - 1); }}
                    disabled={domainCarouselIndex === 0}
                    className="flex-shrink-0 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex-1 grid grid-cols-5 gap-2">
                    {displayedDomainStats.slice(
                      domainCarouselIndex * (domainCarouselExpanded ? 15 : ITEMS_PER_PAGE),
                      domainCarouselIndex * (domainCarouselExpanded ? 15 : ITEMS_PER_PAGE) + (domainCarouselExpanded ? 15 : ITEMS_PER_PAGE)
                    ).map((site: any) => {
                      const displayCategory = domainCategoryOverrides[site.domain] || site.category || 'Other';
                      const categoryColor = getCategoryColor(displayCategory);
                      const isEditing = editingDomainCategory === site.domain;

                      return (
                        <div key={site.domain} className="relative">
                          <button
                            onClick={() => setEditingDomainCategory(isEditing ? null : site.domain)}
                            className={`w-full flex flex-col items-center p-3 rounded-xl border transition-colors duration-150 group ${isEditing
                              ? 'bg-zinc-700/60 border-2 border-emerald-500/60'
                              : 'bg-zinc-800/40 light:bg-zinc-100/40 hover:bg-zinc-800/70 border border-zinc-700/30 hover:border-zinc-500'
                              }`}
                          >
                            {/* Individual AI Sparkle Button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (lockedDomains[site.domain]) return;
                                try {
                                  if (window.deskflowAPI?.generateAICategorization) {
                                    const result = await window.deskflowAPI.generateAICategorization([{
                                      name: site.domain,
                                      category: displayCategory
                                    }]);
                                    if (result.changes && result.changes.length > 0) {
                                      const change = result.changes[0];
                                      setPendingChanges(prev => [...prev, {
                                        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                        name: change.name,
                                        type: 'domain',
                                        previousCategory: change.previousCategory,
                                        newCategory: change.newCategory
                                      }]);
                                    }
                                  }
                                } catch (err) {
                                  console.error('Individual AI categorize failed:', err);
                                }
                              }}
                              disabled={lockedDomains[site.domain]}
                              className="absolute top-1.5 right-1.5 p-1 rounded bg-white/10 hover:bg-white/20 text-white/40 hover:text-white transition-colors duration-150 opacity-60 hover:opacity-100 z-10 disabled:opacity-20 disabled:cursor-not-allowed"
                              title={lockedDomains[site.domain] ? "Unlock to use AI" : "AI Categorize"}
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>

                            {/* Lock Toggle Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDomainLock(site.domain);
                              }}
                              className={`absolute top-1.5 left-1.5 p-1 rounded transition-colors duration-150 z-10 ${
                                lockedDomains[site.domain]
                                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                  : 'bg-white/10 text-white/30 hover:bg-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100'
                              }`}
                              title={lockedDomains[site.domain] ? "Unlock domain" : "Lock domain (blocks AI & manual changes)"}
                            >
                            <LockOpen className="w-3 h-3" />
                            </button>

                            <div className="flex items-center justify-center gap-1.5 w-full pr-5 pl-5">
                              <Globe className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                              <span className="text-xs text-zinc-200 group-hover:text-white truncate max-w-[calc(100%-20px)]">{site.domain}</span>
                            </div>
                            <span className="text-xs px-1.5 py-0.5 rounded mt-1.5" style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}>
                              {displayCategory}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      const itemsPerView = domainCarouselExpanded ? 15 : ITEMS_PER_PAGE;
                      const maxPage = Math.max(0, Math.ceil(displayedDomainStats.length / itemsPerView) - 1);
                      if (domainCarouselIndex < maxPage) setDomainCarouselIndex(domainCarouselIndex + 1);
                    }}
                    disabled={domainCarouselIndex >= Math.max(0, Math.ceil(displayedDomainStats.length / (domainCarouselExpanded ? 15 : ITEMS_PER_PAGE)) - 1)}
                    className="flex-shrink-0 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Show More/Less Button */}
                {displayedDomainStats.length > 5 && (
                  <button
                    onClick={() => {
                      setDomainCarouselExpanded(!domainCarouselExpanded);
                      setDomainCarouselIndex(0);
                    }}
                    className="mt-3 w-full py-2 bg-zinc-800/50 light:bg-zinc-100/50 hover:bg-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors duration-150 flex items-center justify-center gap-2"
                  >
                    {domainCarouselExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show More
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <Globe className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{domainSearchFilter ? 'No matching sites' : 'No websites tracked yet'}</p>
              </div>
            )}

            {/* Full Category Selection Panel */}
            {editingDomainCategory && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] light:bg-white/60 rounded-xl border border-zinc-700/50"
              >
                {lockedDomains[editingDomainCategory] ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Lock className="w-5 h-5" />
                      <span className="text-sm font-medium">Domain is locked</span>
                    </div>
                    <p className="text-xs text-zinc-500 text-center">Unlock this domain first to change its category</p>
                    <button
                      onClick={() => { toggleDomainLock(editingDomainCategory); setEditingDomainCategory(null); }}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm transition-colors duration-150"
                    >
                      Unlock
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="w-4 h-4 text-zinc-500" />
                       <input
                        type="text"
                        placeholder="Search categories..."
                        value={domainSearchQuery}
                        onChange={(e) => setDomainSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto sf-scroll-gutter">
                      {allCategories.filter(cat => cat.toLowerCase().includes(domainSearchQuery.toLowerCase())).map((cat) => {
                        const catColor = getCategoryColor(cat);
                        const siteData = domainStats.find((s: any) => s.domain === editingDomainCategory);
                        const displayCategory = domainCategoryOverrides[editingDomainCategory] || siteData?.category || 'Other';
                        const isSelected = displayCategory === cat;
                        return (
                        <button
                        key={cat}
                        onClick={async () => {
                          const updated = { ...domainCategoryOverrides, [editingDomainCategory]: cat };
                          setDomainCategoryOverrides(updated);
                          if (window.deskflowAPI?.setDomainCategory) {
                            await window.deskflowAPI.setDomainCategory(editingDomainCategory, cat);
                          }
                          setEditingDomainCategory(null);
                          setHasChanges(true);
                          onHasChangesChange(true);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${isSelected ? 'ring-2 ring-white/30' : 'hover:bg-zinc-800'
                          }`}
                        style={{ backgroundColor: `${catColor}15`, borderColor: isSelected ? catColor : 'transparent', color: catColor }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catColor }} />
                        <span>{cat}</span>
                        {isSelected && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setEditingDomainCategory(null)}
                  className="w-full mt-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 transition-colors duration-150"
                >
                  Done
                </button>
                  </>
                )}
              </motion.div>
            )}
          </GlassCard>
          </SearchableSection>

          {/* Smart Website Categorization Section */}
          <SearchableSection terms={['smart', 'keyword', 'categorization', 'domain keywords']} search={settingsSearch}>
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Smart Website Categorization</h2>
                <p className="text-xs text-zinc-500">Configure keyword-based productivity detection for websites</p>
              </div>
              <button
                onClick={() => setEditingKeywordDomain(editingKeywordDomain ? null : 'new')}
                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Domain
              </button>
            </div>

            {/* List of domains with keyword rules */}
            <div className="space-y-2 mb-4">
              {keywordEnabledDomains.length > 0 ? (
                keywordEnabledDomains.map((domain) => {
                  const sets = domainKeywordSets[domain] || [];
                  const totalKeywords = sets.reduce((acc, s) => acc + (s.keywords?.length || 0), 0);
                  return (
                    <div
                      key={domain}
                      className="flex items-center justify-between p-3 bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl border border-zinc-700/30"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Globe className="w-4 h-4 text-zinc-500" />
                        <div>
                          <div className="text-sm font-medium text-zinc-200">{domain}</div>
                          <div className="text-xs text-zinc-500">
                            {sets.length} rule(s), {totalKeywords} keywords total
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingKeywordDomain(domain);
                            setEditingKeywordSets(domainKeywordSets[domain] || []);
                            setTempKeywordInput('');
                          }}
                          className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors duration-150"
                        >
                          Configure
                        </button>
                        <button
                          onClick={async () => {
                            if (window.deskflowAPI?.removeKeywordDomain) {
                              await window.deskflowAPI.removeKeywordDomain(domain);
                              setKeywordEnabledDomains(prev => prev.filter(d => d !== domain));
                              setHasChanges(true);
                              onHasChangesChange(true);
                            }
                          }}
                          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors duration-150"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-zinc-500">
                  <Globe className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No domains with keyword rules yet</p>
                  <p className="text-xs mt-1">Add a domain to enable smart categorization</p>
                </div>
              )}
            </div>

            {/* Configuration panel - NEW: Multiple keyword sets */}
            {editingKeywordDomain && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] light:bg-white/60 rounded-xl border border-zinc-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">
                    {editingKeywordDomain === 'new' ? 'Add New Domain' : `Configure: ${editingKeywordDomain}`}
                  </h3>
                  <button
                    onClick={() => {
                      setEditingKeywordDomain(null);
                      setEditingKeywordSets([]);
                      setTempKeywordInput('');
                    }}
                    className="p-1 text-zinc-500 hover:text-white transition-colors duration-150"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Domain Dropdown for new */}
                {editingKeywordDomain === 'new' && (
                  <div className="mb-4">
                    <label className="text-xs text-zinc-400 mb-1.5 block">Select Website</label>
                    <select
                      value={newKeywordDomain}
                      onChange={(e) => setNewKeywordDomain(e.target.value)}
                      className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white"
                    >
                      <option value="">Choose a website...</option>
                      {domainStats
                        .filter((s: any) => !keywordEnabledDomains.includes(s.domain))
                        .map((site: any) => (
                          <option key={site.domain} value={site.domain}>
                            {site.domain} ({site.category || 'Uncategorized'})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Keyword Sets - each set has category + keywords */}
                <div className="space-y-3 mb-4">
                  {(editingKeywordDomain === 'new' ? editingKeywordSets : (domainKeywordSets[editingKeywordDomain] || []))
                    .map((set, setIdx) => (
                      <div key={setIdx} className="p-3 bg-zinc-800/50 light:bg-zinc-100/50 rounded-lg border border-zinc-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <select
                            value={set.category}
                            onChange={(e) => {
                              const updated = [...(editingKeywordDomain === 'new' ? editingKeywordSets : (domainKeywordSets[editingKeywordDomain] || []))];
                              updated[setIdx] = { ...updated[setIdx], category: e.target.value };
                              if (editingKeywordDomain === 'new') {
                                setEditingKeywordSets(updated);
                              } else {
                                setDomainKeywordSets(prev => ({ ...prev, [editingKeywordDomain]: updated }));
                                setEditingKeywordSets(updated);
                              }
                            }}
                            className="px-2 py-1 bg-zinc-700 border border-zinc-600 rounded-lg text-xs text-white"
                          >
                            {allCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const updated = [...(editingKeywordDomain === 'new' ? editingKeywordSets : (domainKeywordSets[editingKeywordDomain] || []))];
                              updated.splice(setIdx, 1);
                              if (editingKeywordDomain === 'new') {
                                setEditingKeywordSets(updated);
                              } else {
                                setDomainKeywordSets(prev => ({ ...prev, [editingKeywordDomain]: updated }));
                                setEditingKeywordSets(updated);
                              }
                            }}
                            className="p-1 text-zinc-500 hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {(set.keywords || []).map((keyword, kwIdx) => (
                            <span key={kwIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">
                              {keyword}
                              <button
                                onClick={() => {
                                  const updated = [...(editingKeywordDomain === 'new' ? editingKeywordSets : (domainKeywordSets[editingKeywordDomain] || []))];
                                  updated[setIdx] = {
                                    ...updated[setIdx],
                                    keywords: (updated[setIdx].keywords || []).filter((_, i) => i !== kwIdx)
                                  };
                                  if (editingKeywordDomain === 'new') {
                                    setEditingKeywordSets(updated);
                                  } else {
                                    setDomainKeywordSets(prev => ({ ...prev, [editingKeywordDomain]: updated }));
                                    setEditingKeywordSets(updated);
                                  }
                                }}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                          {(!set.keywords || set.keywords.length === 0) && (
                            <span className="text-xs text-zinc-500 italic">No keywords - will always use this category</span>
                          )}
                          {/* Hide Numbers Toggle */}
                          <GlassCard className="mt-4 p-4 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] light:bg-white/60 rounded-xl border border-zinc-700/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Eye className="w-5 h-5 text-emerald-400" />
                                <div>
                                  <h2 className="text-lg font-semibold">Number Display</h2>
                                  <p className="text-xs text-zinc-500">Choose whether monetary values are shown or replaced with asterisks.</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setShowNumbers(!showNumbers)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg ${showNumbers ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-300'}`}
                                aria-pressed={showNumbers}
                                aria-label="Toggle hide numbers"
                              >
                                {showNumbers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                <span className="text-xs">{showNumbers ? 'Hide' : 'Show'} numbers</span>
                              </button>
                            </div>
                          </GlassCard>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={setIdx === (editingKeywordDomain === 'new' ? editingKeywordSets.length - 1 : (domainKeywordSets[editingKeywordDomain] || []).length - 1) ? tempKeywordInput : ''}
                            onChange={(e) => setTempKeywordInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && tempKeywordInput.trim()) {
                                e.preventDefault();
                                const newKeyword = tempKeywordInput.trim().toLowerCase();
                                const updated = [...(editingKeywordDomain === 'new' ? editingKeywordSets : (domainKeywordSets[editingKeywordDomain] || []))];
                                if (!updated[setIdx].keywords) updated[setIdx].keywords = [];
                                if (!updated[setIdx].keywords.includes(newKeyword)) {
                                  updated[setIdx] = {
                                    ...updated[setIdx],
                                    keywords: [...updated[setIdx].keywords, newKeyword]
                                  };
                                  if (editingKeywordDomain === 'new') {
                                    setEditingKeywordSets(updated);
                                  } else {
                                    setDomainKeywordSets(prev => ({ ...prev, [editingKeywordDomain]: updated }));
                                    setEditingKeywordSets(updated);
                                  }
                                }
                                setTempKeywordInput('');
                              }
                            }}
                            placeholder={`Add keyword for ${set.category}...`}
                            className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500"
                          />
                        </div>
                      </div>
                    ))}
                </div>

                {/* Add new keyword set button */}
                <button
                  onClick={() => {
                    const newSet = { category: tempCategoryForNewSet, keywords: [] };
                    if (editingKeywordDomain === 'new') {
                      setEditingKeywordSets(prev => [...prev, newSet]);
                    } else {
                      setDomainKeywordSets(prev => ({
                        ...prev,
                        [editingKeywordDomain]: [...(prev[editingKeywordDomain] || []), newSet]
                      }));
                      setEditingKeywordSets(prev => [...prev, newSet]);
                    }
                  }}
                  className="w-full py-2 mb-4 border border-dashed border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 rounded-lg text-sm transition-colors duration-150"
                >
                  + Add Keyword Set
                </button>

                {/* Category selector for new set */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-zinc-400">New set category:</span>
                  <select
                    value={tempCategoryForNewSet}
                    onChange={(e) => setTempCategoryForNewSet(e.target.value)}
                    className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                  >
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Note about fallback */}
                <p className="text-xs text-zinc-500 mb-4">
                  If no keywords match, falls back to Category Overrides setting
                </p>

                {/* Save Button */}
                <button
                  onClick={async () => {
                    const domain = editingKeywordDomain === 'new' ? newKeywordDomain.toLowerCase() : editingKeywordDomain;
                    const keywordSets = editingKeywordDomain === 'new' ? editingKeywordSets : (domainKeywordSets[editingKeywordDomain] || []);

                    if (!domain) {
                      alert('Please select a website');
                      return;
                    }

                    if (window.deskflowAPI?.addKeywordDomain) {
                      await window.deskflowAPI.addKeywordDomain(domain, keywordSets);

                      if (editingKeywordDomain === 'new') {
                        setDomainKeywordSets(prev => ({ ...prev, [domain]: keywordSets }));
                        setKeywordEnabledDomains(prev => [...prev, domain]);
                      } else {
                        setDomainKeywordSets(prev => ({ ...prev, [domain]: keywordSets }));
                      }

                      setEditingKeywordDomain(null);
                      setEditingKeywordSets([]);
                      setTempKeywordInput('');
                      setNewKeywordDomain('');
                    }
                  }}
                  disabled={editingKeywordDomain === 'new' && !newKeywordDomain}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-150"
                >
                  {editingKeywordDomain === 'new' ? 'Add Domain' : 'Done'}
                </button>
              </motion.div>
            )}
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {activeTab === 'general' && (
        <div data-section="settings.general" className="space-y-4">
          {/* Notification display time — previously 5 separate hardcoded
              timeouts (4000/3600/3000/3000ms) in different toast systems. */}
          <SearchableSection terms={['notification', 'toast', 'duration', 'how long', 'display time', 'message']} search={settingsSearch}>
          <GlassCard>
            <SectionHeader title="Notification Duration" icon={<Bell className="w-5 h-5" />} />
            <p className="text-xs text-zinc-500 mb-3">
              How long a notification stays on screen. "Stick" keeps it up until you dismiss it.
            </p>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setToastDurationState(setToastDurationMs(p.value))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    toastDuration === p.value
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {toastDuration !== DEFAULT_DURATION_MS && (
              <button
                onClick={() => setToastDurationState(setToastDurationMs(DEFAULT_DURATION_MS))}
                className="mt-3 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
              >
                Reset to default (4s)
              </button>
            )}
          </GlassCard>
          </SearchableSection>

          <SearchableSection terms={['behavior', 'idle', 'threshold', 'neutral', 'distracting', 'pause', 'reset', 'ignore', 'auto-start', 'auto-export', 'animation', 'window mode', 'tracker behavior']} search={settingsSearch}>
          <GlassCard className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-3">App Tracker Behavior</h2>

              <div className="space-y-4">

                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">Idle Threshold</label>
                  <div className="flex gap-2">
                    {[3, 5, 10].map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          setIdleThreshold(m);
                          setHasChanges(true);
                          onHasChangesChange(true);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${idleThreshold === m
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                          }`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">When using Neutral apps</label>
                  <div className="flex gap-2">
                    {(['pause', 'reset', 'ignore'] as const).map(action => (
                      <button
                        key={action}
                        onClick={() => {
                          const newBehavior = { ...localTimerBehavior, neutralAction: action };
                          setLocalTimerBehavior(newBehavior);
                          setTimerBehaviorProp(newBehavior);
                          setHasChanges(true);
                          onHasChangesChange(true);
                          if (window.deskflowAPI?.setPreference) {
                            window.deskflowAPI.setPreference('timerBehavior', newBehavior);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${localTimerBehavior.neutralAction === action
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                          }`}
                      >
                        {action === 'pause' ? '⏸ Pause' : action === 'reset' ? '🔄 Reset' : '⏭ Ignore'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">What happens when you switch from productive to neutral (e.g., Communication, Design)</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">When using Distracting apps</label>
                  <div className="flex gap-2">
                    {(['pause', 'reset', 'ignore'] as const).map(action => (
                      <button
                        key={action}
                        onClick={() => {
                          const newBehavior = { ...localTimerBehavior, distractingAction: action };
                          setLocalTimerBehavior(newBehavior);
                          setTimerBehaviorProp(newBehavior);
                          setHasChanges(true);
                          onHasChangesChange(true);
                          if (window.deskflowAPI?.setPreference) {
                            window.deskflowAPI.setPreference('timerBehavior', newBehavior);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${localTimerBehavior.distractingAction === action
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                          }`}
                      >
                        {action === 'pause' ? '⏸ Pause' : action === 'reset' ? '🔄 Reset' : '⏭ Ignore'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">What happens when you switch from productive to distracting (e.g., Entertainment, Social Media)</p>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">Min Session Duration</div>
                    <div className="text-xs text-zinc-500">Only count sessions longer than this</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {([60, 180, 300, 600, 900, 1800] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          if (window.deskflowAPI?.setPreference) {
                            window.deskflowAPI.setPreference('productivityMinDuration', m);
                            setHasChanges(true);
                            onHasChangesChange(true);
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${m === 300
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                          }`}
                      >
                        {m < 60 ? `${m}s` : m < 3600 ? `${m / 60}m` : `${m / 3600}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">Auto-Export</div>
                    <div className="text-xs text-zinc-500">Export data periodically</div>
                  </div>
                  <button
                    onClick={() => {
                      setAutoExport(!autoExport);
                      setHasChanges(true);
                      onHasChangesChange(true);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors duration-150 relative ${autoExport ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-colors duration-150 ${autoExport ? 'left-7' : 'left-1'
                      }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">Auto-Start</div>
                    <div className="text-xs text-zinc-500">Launch on system startup</div>
                  </div>
                  <button
                    onClick={async () => {
                      const newValue = !autoStartEnabled;
                      setAutoStartEnabled(newValue);
                      setAutoStartEnabledProp?.(newValue);
                      setHasChanges(true);
                      onHasChangesChange(true);
                      if (window.deskflowAPI?.setAutoStart) {
                        await window.deskflowAPI.setAutoStart(newValue);
                      }
                    }}
                    className={`w-12 h-6 rounded-full transition-colors duration-150 relative ${autoStartEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-colors duration-150 ${autoStartEnabled ? 'left-7' : 'left-1'
                      }`} />
                  </button>
                </div>

                <div>
                  <p className="text-xs text-zinc-500 italic">OpenRouter API key is configured in the <span className="text-zinc-300 not-italic">AI Assistant</span> tab</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">Animation Speed</label>
                  <div className="flex gap-1.5">
                    {(['slow', 'normal', 'instant'] as const).map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          setAnimationSpeed(speed);
                          setHasChanges(true);
                          onHasChangesChange(true);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${animationSpeed === speed
                          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                          : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                          }`}
                      >
                        {speed === 'slow' ? 'Slow' : speed === 'normal' ? 'Normal' : 'Off'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* R-10: Boot Animation — single source = preference store (ruling 2) */}
                <div>
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">Boot Animation</label>
                  <p className="text-xs text-zinc-500 mb-3">Play the Meridian Wake launch animation when DeskFlow starts.</p>
                  <div className="flex flex-col gap-3">
                    {/* Enabled toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        role="switch"
                        aria-checked={bootAnimEnabled}
                        onClick={() => {
                          setBootAnimEnabled(!bootAnimEnabled);
                          setHasChanges(true);
                          onHasChangesChange(true);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${bootAnimEnabled ? 'bg-violet-500' : 'bg-zinc-700'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition ${bootAnimEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className="text-xs text-zinc-400">{bootAnimEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>

                    {/* Variant picker */}
                    {bootAnimEnabled && (
                      <>
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Variant</label>
                          <div className="flex gap-1.5">
                            {(['meridian', 'minimal'] as const).map((v) => (
                              <button
                                key={v}
                                onClick={() => {
                                  setBootAnimVariant(v);
                                  setHasChanges(true);
                                  onHasChangesChange(true);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${bootAnimVariant === v
                                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                                  : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                                  }`}
                              >
                                {v === 'meridian' ? 'Meridian Wake' : 'Minimal'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Warm-start */}
                        <div className="flex items-center gap-2">
                          <button
                            role="switch"
                            aria-checked={bootAnimWarm}
                            onClick={() => {
                              setBootAnimWarm(!bootAnimWarm);
                              setHasChanges(true);
                              onHasChangesChange(true);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${bootAnimWarm ? 'bg-violet-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition ${bootAnimWarm ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                          <span className="text-xs text-zinc-400">Warm start (shorter animation)</span>
                        </div>

                        {/* Replay Intro */}
                        <button
                          onClick={async () => {
                            if (window.deskflowAPI?.replaySplash) {
                              await window.deskflowAPI.replaySplash();
                            }
                          }}
                          className="self-start px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:text-white hover:border-zinc-500 transition"
                        >
                          ▶ Replay Intro
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm font-medium">Storage</span>
                </div>
                <div className="space-y-1 text-xs text-zinc-400">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Type:</span>
                    <span>{storageStatus.type === 'sqlite' ? 'SQLite' : storageStatus.type === 'json' ? 'JSON' : 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Records:</span>
                    <span>{storageStatus.logCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl p-3 border border-zinc-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-sm font-medium">Export</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onExportData('csv')}
                    className="flex-1 px-2 py-1.5 bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 rounded-md text-xs font-medium transition"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => onExportData('json')}
                    className="flex-1 px-2 py-1.5 bg-zinc-700/50 light:bg-zinc-200/50 hover:bg-zinc-700 rounded-md text-xs font-medium transition"
                  >
                    JSON
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {activeTab === 'tracking' && (
        <div data-section="settings.tracking" className="space-y-4">
          <ReminderLeadTimeSettings />

          {/* ── AFK behaviour ────────────────────────────────────────────────
              Three unrelated idle thresholds used to exist (5 min in the stopwatch
              store, 5 min of never-persisted state in App.tsx, a dead 10 min
              constant in main.ts, and a bare inline `300` in the sleep-gap
              guard). None were in Settings and none agreed. One now. */}
          <SearchableSection terms={['afk', 'idle', 'away', 'threshold', 'streak', 'stopwatch', 'reset', 'minutes', 'inactive']} search={settingsSearch}>
          <GlassCard>
            <SectionHeader title="AFK Behaviour" icon={<Clock className="w-5 h-5" />} />

            {/* One-line summary of what is actually in force right now, so the
                state is readable without interpreting the controls below. */}
            <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border mb-4 text-[12px] ${
              afkPrefs.enabled
                ? 'bg-emerald-500/[0.07] border-emerald-500/25 text-[var(--text-muted)]'
                : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400'
            }`}>
              <Clock size={13} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {afkPrefs.enabled ? (
                  <>Away for <strong className="font-semibold">{afkPrefs.thresholdMinutes}m</strong> → {afkActionLabel(afkPrefs.action)}</>
                ) : (
                  <>AFK detection is <strong className="font-semibold">off</strong> — the timer keeps counting while you are away.</>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-zinc-800/40">
              <div className="pr-4">
                <label className="text-sm font-medium text-zinc-300">Detect AFK</label>
                <p className="text-[11px] text-zinc-500 mt-0.5">Uses system idle time, so reading or watching still counts as present</p>
              </div>
              <button
                onClick={() => setAfkPrefsState(setAfkPrefs({ enabled: !afkPrefs.enabled }))}
                aria-pressed={afkPrefs.enabled}
                aria-label="Detect AFK"
                className={`relative w-11 h-6 shrink-0 rounded-full transition-colors duration-200 ${afkPrefs.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${afkPrefs.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {afkPrefs.enabled && (
              <>
                {/* Threshold: presets for the common choices, slider underneath so
                    7 or 13 minutes is reachable without the slider being the only
                    control (which reads as a fine-tune afterthought). */}
                <div className="py-4 border-t border-zinc-800/40">
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-sm font-medium text-zinc-300">Treat as AFK after</label>
                    <span className="text-xs font-mono text-zinc-400">{afkPrefs.thresholdMinutes} min</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AFK_PRESETS.map((m) => {
                      const on = afkPrefs.thresholdMinutes === m;
                      return (
                        <button
                          key={m}
                          onClick={() => setAfkPrefsState(setAfkPrefs({ thresholdMinutes: m }))}
                          aria-pressed={on}
                          className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors duration-150 ${
                            on
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-800/40 border border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                          }`}
                        >
                          {m}m
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="range" min={AFK_MIN_MINUTES} max={AFK_MAX_MINUTES} step={1}
                    value={afkPrefs.thresholdMinutes}
                    onChange={(e) => setAfkPrefsState(setAfkPrefs({ thresholdMinutes: Number(e.target.value) }))}
                    className="w-full mt-3"
                    aria-label="AFK threshold in minutes"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                    <span>{AFK_MIN_MINUTES}m</span><span>{AFK_MAX_MINUTES}m</span>
                  </div>
                </div>

                {/* Action: a radio group, not four cards. Only one can ever be
                    true, and the summary line at the top already spells the
                    consequence out in words. */}
                <div className="py-4 border-t border-zinc-800/40">
                  <label className="text-sm font-medium text-zinc-300 mb-2 block">When AFK is detected</label>
                  <div className="space-y-0.5">
                    {AFK_ACTIONS.map((a) => {
                      const on = afkPrefs.action === a.value;
                      return (
                        <button
                          key={a.value}
                          role="radio"
                          aria-checked={on}
                          onClick={() => setAfkPrefsState(setAfkPrefs({ action: a.value }))}
                          className={`w-full flex items-start gap-3 px-2.5 py-2 rounded-md text-left transition-colors duration-150 ${
                            on ? 'bg-emerald-500/[0.08]' : 'hover:bg-zinc-800/40'
                          }`}
                        >
                          <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150 ${
                            on ? 'border-emerald-400' : 'border-zinc-600'
                          }`}>
                            {on && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </span>
                          <span className="min-w-0">
                            <span className={`block text-[13px] ${on ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>{a.label}</span>
                            <span className="block text-[11px] text-zinc-500 mt-0.5">{a.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Prompt thresholds ──────────────────────────────────────
                    These were hardcoded inside App.tsx, so the prompt had
                    behaviour nobody could see or change: a fixed 60s floor, a
                    fixed 15-minute "I wasn't AFK" default, and a fixed
                    Entertainment+Gaming exemption. */}
                <div className="py-4 border-t border-zinc-800/40 space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="text-sm font-medium text-zinc-300">Must stay away for</label>
                      <span className="text-xs font-mono text-zinc-400">{afkPrefs.holdSeconds}s</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 30, 60, 90, 180].map((sec) => {
                        const on = afkPrefs.holdSeconds === sec;
                        return (
                          <button
                            key={sec}
                            onClick={() => setAfkPrefsState(setAfkPrefs({ holdSeconds: sec }))}
                            aria-pressed={on}
                            className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors duration-150 ${
                              on
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-zinc-800/40 border border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                            }`}
                          >
                            {sec === 0 ? 'instantly' : `${sec}s`}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1.5">Touch the mouse at any point and this resets — nothing is decided from a single sample.</p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="text-sm font-medium text-zinc-300">Ask about absences over</label>
                      <span className="text-xs font-mono text-zinc-400">
                        {afkPrefs.minPromptSeconds === 0 ? 'any' : `${afkPrefs.minPromptSeconds}s`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 30, 60, 120, 300].map((sec) => {
                        const on = afkPrefs.minPromptSeconds === sec;
                        return (
                          <button
                            key={sec}
                            onClick={() => setAfkPrefsState(setAfkPrefs({ minPromptSeconds: sec }))}
                            aria-pressed={on}
                            className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors duration-150 ${
                              on
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-zinc-800/40 border border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                            }`}
                          >
                            {sec === 0 ? 'any' : sec < 60 ? `${sec}s` : `${sec / 60}m`}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1.5">Shorter absences are discarded without asking. 0 means ask about everything.</p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="text-sm font-medium text-zinc-300">Pre-select &quot;I wasn&apos;t AFK&quot; up to</label>
                      <span className="text-xs font-mono text-zinc-400">{afkPrefs.notAfkBelowMinutes} min</span>
                    </div>
                    <input
                      type="range"
                      min={AFK_MIN_NOT_AFK_MINUTES}
                      max={AFK_MAX_NOT_AFK_MINUTES}
                      step={1}
                      value={afkPrefs.notAfkBelowMinutes}
                      onChange={(e) => setAfkPrefsState(setAfkPrefs({ notAfkBelowMinutes: Number(e.target.value) }))}
                      className="w-full"
                      aria-label="Minutes below which I was not AFK is pre-selected"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">Short absences are usually a bathroom or kitchen trip, so the answer arrives pre-picked. You still confirm it.</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-zinc-300 block mb-1.5">Never treat as AFK</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_CATEGORIES.map((cat) => {
                        const on = afkPrefs.passiveCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() =>
                              setAfkPrefsState(
                                setAfkPrefs({
                                  passiveCategories: on
                                    ? afkPrefs.passiveCategories.filter((c) => c !== cat)
                                    : [...afkPrefs.passiveCategories, cat],
                                }),
                              )
                            }
                            aria-pressed={on}
                            className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors duration-150 ${
                              on
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-zinc-800/40 border border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      While the focused app is one of these, idle time is what you meant, so AFK is never raised. Watching something used to be hardcoded here.
                    </p>
                  </div>
                </div>
              </>
            )}
          </GlassCard>
          </SearchableSection>

          {/* ── Sleep window ───────────────────────────────────────────────
              The other half of the AFK decision. A gap that overlaps these
              hours is sleep; anything else is AFK and gets the AFK prompt.
              Before this existed the boundary was hardcoded to 21:00 → 10:59
              inside main.ts and could not be changed from anywhere, and it
              tested each gap's ENDPOINTS rather than its overlap — so a 10:15am
              coffee break qualified (because `h <= 10` swallowed the whole 10
              o'clock hour) while a genuine 20:00 → 22:00 pre-bed gap with only
              30 minutes of overlap did not.

              Same primitives as the AFK section above on purpose: same emerald
              signal hue, same pill toggle, same preset-chip treatment, same
              hairline dividers. This is a sibling subsection, not a new surface,
              so it must not invent its own visual language. */}
          <SearchableSection group="sleep-window" terms={['sleep', 'bedtime', 'night', 'bed', 'wake', 'overnight', 'hours', 'window', 'afk']} search={settingsSearch}>
          <GlassCard>
            <SectionHeader title="Sleep Window" icon={<Moon className="w-5 h-5" />} />

            {/* State readable without interpreting the controls — the same
                one-line-summary contract the AFK section sets. */}
            <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border mb-4 text-[12px] ${
              sleepWindow.enabled
                ? 'bg-emerald-500/[0.07] border-emerald-500/25 text-[var(--text-muted)]'
                : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400'
            }`}>
              <Moon size={13} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                {sleepWindow.enabled ? (
                  <>Away between <strong className="font-semibold">{describeSleepWindow(sleepWindow.startHour, sleepWindow.endHour)}</strong> counts as sleep, not AFK.</>
                ) : (
                  <>Sleep detection is <strong className="font-semibold">off</strong> — every absence is treated as AFK.</>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-zinc-800/40">
              <div className="pr-4">
                <label className="text-sm font-medium text-zinc-300">Detect sleep</label>
                <p className="text-[11px] text-zinc-500 mt-0.5">Outside these hours you get the AFK prompt instead</p>
              </div>
              <button
                onClick={() => setSleepWindowState(setSleepWindow({ enabled: !sleepWindow.enabled }))}
                aria-pressed={sleepWindow.enabled}
                aria-label="Detect sleep"
                className={`relative w-11 h-6 shrink-0 rounded-full transition-colors duration-200 ${sleepWindow.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${sleepWindow.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {sleepWindow.enabled && (
              <>
                {/* Presets for the windows people actually keep, with the exact
                    hour inputs underneath so an unusual schedule is still one
                    keystroke away. Mirrors the AFK threshold control's shape. */}
                <div className="py-4 border-t border-zinc-800/40">
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-sm font-medium text-zinc-300">Your usual hours</label>
                    <span className="text-xs font-mono text-zinc-400">{describeSleepWindow(sleepWindow.startHour, sleepWindow.endHour)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SLEEP_WINDOWS.map((w) => {
                      const on = sleepWindow.startHour === w.startHour && sleepWindow.endHour === w.endHour;
                      return (
                        <button
                          key={w.label}
                          onClick={() => setSleepWindowState(setSleepWindow({ startHour: w.startHour, endHour: w.endHour }))}
                          aria-pressed={on}
                          className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors duration-150 ${
                            on
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-800/40 border border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                          }`}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-[11px] text-zinc-500 block mb-1">Sleep starts</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={sleepWindow.startHour}
                          onChange={(e) => setSleepWindowState(setSleepWindow({ startHour: Number(e.target.value) }))}
                          aria-label="Hour sleep starts"
                          className="w-16 px-2 py-1 text-sm bg-zinc-800/60 border border-zinc-700 rounded-lg text-white text-right font-mono"
                        />
                        <span className="text-[11px] text-zinc-500">0–23</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-500 block mb-1">Sleep ends</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={sleepWindow.endHour}
                          onChange={(e) => setSleepWindowState(setSleepWindow({ endHour: Number(e.target.value) }))}
                          aria-label="Hour sleep ends"
                          className="w-16 px-2 py-1 text-sm bg-zinc-800/60 border border-zinc-700 rounded-lg text-white text-right font-mono"
                        />
                        <span className="text-[11px] text-zinc-500">0–23</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
                    An absence has to sit inside these hours for at least {MIN_SLEEP_OVERLAP_MINUTES} minutes before you get asked about sleep.
                    {sleepWindow.endHour <= sleepWindow.startHour ? ' Your window runs overnight, past midnight.' : ' Your window is within the same day.'}
                  </p>
                </div>
              </>
            )}
          </GlassCard>
          </SearchableSection>

          <SearchableSection terms={['tracking', 'transient', 'background', 'recording', 'game', 'detection', 'browser', 'profiles', 'sleep', 'gap', 'max session']} search={settingsSearch}>
          <GlassCard className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Tracking Settings</h2>
              <p className="text-xs text-zinc-500">Configure how app usage is tracked</p>
            </div>

                              <div>
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">App Tracker Window Mode</label>
                                <div className="flex gap-2">
                                  {(['show-other', 'pause', 'track'] as const).map(mode => (
                                    <button
                                      key={mode}
                                      onClick={() => {
                                        setTrackerAppMode(mode);
                                        setTrackerAppModeProp(mode);
                                        // Persist immediately. The main-process poll reads this
                                        // preference every tick, so waiting for the OK button
                                        // meant the setting appeared to do nothing.
                                        window.deskflowAPI?.setPreference?.('trackerAppMode', mode)
                                          .catch((e: any) => console.warn('[Settings] trackerAppMode persist failed:', e?.message || e));
                                        setHasChanges(true);
                                        onHasChangesChange(true);
                                      }}
                                      className={`px-3 py-2 rounded-lg text-sm font-medium transition flex-1 ${trackerAppMode === mode
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                        : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                      {mode === 'show-other' ? 'Show Other Apps' : mode === 'pause' ? 'Pause Timer' : 'Track as Normal'}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                                  <p><span className="text-emerald-400">Show Other Apps:</span> When you open the tracker, it keeps showing the last app you were using. The tracker app itself is not tracked.</p>
                                  <p><span className="text-amber-400">Pause Timer:</span> The stopwatch pauses when you're using the tracker app (but previous time is preserved). Useful when reviewing stats.</p>
                                  <p><span className="text-blue-400">Track as Normal:</span> The tracker app is tracked like any other app. Timer counts based on its category.</p>
                                </div>
                              </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-zinc-300">Ignore Transient System Apps</label>
                <p className="text-xs text-zinc-500">Filter out brief system windows (Explorer, task switcher) from tracking</p>
              </div>
              <button
                onClick={async () => {
                  const newVal = !filterTransientApps;
                  setFilterTransientApps(newVal);
                  if (window.deskflowAPI?.setPreference) {
                    await window.deskflowAPI.setPreference('filterTransientApps', newVal);
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${filterTransientApps ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${filterTransientApps ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-zinc-300">Website Background Recording</label>
                <p className="text-xs text-zinc-500">When OFF, website logs only appear while Browser Activity page is open</p>
              </div>
              <button
                onClick={async () => {
                  const newMode = browserRecordingMode === 'always' ? 'on-view' : 'always';
                  setBrowserRecordingMode(newMode);
                  if (window.deskflowAPI?.setRecordingMode) {
                    await window.deskflowAPI.setRecordingMode('browser', newMode);
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${browserRecordingMode === 'always' ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${browserRecordingMode === 'always' ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-zinc-300">App Background Recording</label>
                <p className="text-xs text-zinc-500">When OFF, app logs only appear while Dashboard is open</p>
              </div>
              <button
                onClick={async () => {
                  const newMode = appRecordingMode === 'always' ? 'on-view' : 'always';
                  setAppRecordingMode(newMode);
                  if (window.deskflowAPI?.setRecordingMode) {
                    await window.deskflowAPI.setRecordingMode('app', newMode);
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${appRecordingMode === 'always' ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${appRecordingMode === 'always' ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="pt-4 border-t border-zinc-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-zinc-300">Game Detection</h3>
                  <p className="text-xs text-zinc-500">Scan Steam library for installed games to improve tracking accuracy</p>
                </div>
                <button
                  onClick={async () => {
                    if (window.deskflowAPI?.rescanGames) {
                      await window.deskflowAPI.rescanGames();
                    }
                  }}
                  className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Rescan Games
                </button>
              </div>
            </div>

{/* Browser Extension Tracking — live mirror, not a config menu.
                Design intent: setup should feel like plugging in a device, not
                choosing from a list. Extensions announce themselves; this panel
                reflects reality back. "Connected" is a 60s heartbeat, never a
                permanent flag, and a browser with no extension is shown quietly
                because its absence is not an error. */}
            {/* Guided setup: get the folder -> load it in the browser -> confirm it
                connected. Sits above the live mirror because a first-time user needs
                instructions, and only needs the status list once something reports. */}
            <div className="pt-4 border-t border-zinc-700/50">
              <ExtensionSetupPanel onStatusChange={refreshExtStatus} />
            </div>

            <div className="pt-4 border-t border-zinc-700/50 space-y-3" data-section="settings.tracking.browsers">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-zinc-300">Website Tracking</h3>
                  <p className="text-xs text-zinc-500">
                    Install the DeskFlow Browser Bridge on any browser you want tracked. It connects on its own — no setup needed here.
                  </p>
                </div>
                {extStatus && (
                  <span className={`shrink-0 mt-0.5 text-[11px] font-medium px-2 py-1 rounded-full border ${
                    extStatus.trackingEnabled
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
                  }`}>
                    {extStatus.trackingEnabled ? 'Recording' : 'Paused'}
                  </span>
                )}
              </div>

              {/* ERROR — plain language + a recovery action, never a raw code. */}
              {extError && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/25">
                  <p className="text-xs text-amber-300">{extError}</p>
                  <button
                    onClick={() => { setExtLoading(true); refreshExtStatus(); }}
                    className="mt-2 text-[11px] px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* LOADING — skeleton matching the row shape, not a bare spinner. */}
              {!extError && extLoading && (
                <div className="space-y-2" aria-busy="true" aria-label="Checking connected browsers">
                  {[0, 1].map(i => (
                    <div key={i} className="h-11 rounded-lg bg-zinc-800/40 border border-zinc-700/30 animate-pulse" />
                  ))}
                </div>
              )}

              {/* POPULATED / EMPTY — connected browsers, then installed ones. */}
              {!extError && !extLoading && (() => {
                const profiles = extStatus?.profiles || [];
                const connectedProfiles = profiles.filter((p: any) => p.is_connected);
                const quietProfiles = profiles.filter((p: any) => !p.is_connected);
                const connectedSet = new Set((extStatus?.connectedBrowsers || []).map(b => b.toLowerCase()));
                // Installed-but-not-yet-connected browsers the user could add.
                const installedNotConnected = availableBrowsers
                  .filter(b => !connectedSet.has(b.toLowerCase()))
                  .filter(b => !selectedBrowsers.some(s => s.toLowerCase() === b.toLowerCase()));

                const toggleBrowser = async (lower: string) => {
                  const isEnabled = selectedBrowsers.some(x => x.toLowerCase() === lower);
                  const next = isEnabled
                    ? selectedBrowsers.filter(x => x.toLowerCase() !== lower)
                    : [...selectedBrowsers, lower];
                  setSelectedBrowsers(next);
                  if (window.deskflowAPI?.setPreference) {
                    await window.deskflowAPI.setPreference('browsersWithExtension', next);
                    await window.deskflowAPI.setPreference('browserWithExtension', next[0] || '');
                  }
                  refreshExtStatus();
                };

                const Row = ({ label, sub, connected, onToggle, active }: any) => (
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    active
                      ? 'bg-emerald-500/[0.07] border-emerald-500/25'
                      : 'bg-zinc-800/40 light:bg-zinc-100/50 border-zinc-700/40'
                  }`}>
                    <span className="relative flex h-2.5 w-2.5 shrink-0" title={connected ? 'Reporting now' : 'Not reporting'}>
                      <span className={`absolute inset-0 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      {connected && (
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60 motion-reduce:hidden" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${connected ? 'text-zinc-200' : 'text-zinc-400'}`}>{label}</p>
                      {sub && <p className="text-[11px] text-zinc-500 truncate">{sub}</p>}
                    </div>
                    {onToggle && (
                      <button
                        onClick={() => onToggle(label.toLowerCase())}
                        className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                          selectedBrowsers.some((x: string) => x.toLowerCase() === label.toLowerCase())
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                            : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                        }`}
                      >
                        {selectedBrowsers.some((x: string) => x.toLowerCase() === label.toLowerCase()) ? 'Tracking' : 'Track'}
                      </button>
                    )}
                  </div>
                );

                if (profiles.length === 0) {
                  return (
                    <div className="p-4 rounded-lg bg-zinc-800/40 light:bg-zinc-100/50 border border-dashed border-zinc-700/60 text-center">
                      <p className="text-sm text-zinc-300 font-medium">No browser is connected yet</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Add the <span className="text-zinc-400">DeskFlow Browser Bridge</span> extension to Chrome, Brave, Edge or Firefox.
                        It will appear here on its own the moment it starts reporting.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {connectedProfiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-medium">Connected</p>
                        {connectedProfiles.map((p: any) => (
                          <Row
                            key={`c-${p.id}`}
                            label={p.profile_name || p.browser_name}
                            sub={`${p.browser_name || 'Browser'}${p.total_duration_ms ? ` · ${formatTrackedTime(p.total_duration_ms)} tracked` : ''}`}
                            connected
                            active
                          />
                        ))}
                      </div>
                    )}

                    {quietProfiles.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-600 font-medium">Previously connected</p>
                        {quietProfiles.map((p: any) => (
                          <Row
                            key={`q-${p.id}`}
                            label={p.profile_name || p.browser_name}
                            sub={`${p.browser_name || 'Browser'} · not reporting now`}
                            connected={false}
                          />
                        ))}
                      </div>
                    )}

                    {installedNotConnected.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] uppercase tracking-wide text-zinc-600 font-medium">Installed · no extension</p>
                        <div className="grid grid-cols-2 gap-2">
                          {installedNotConnected.map(b => (
                            <button
                              key={b}
                              onClick={() => toggleBrowser(b.toLowerCase())}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700/50 bg-zinc-800/40 light:bg-zinc-100/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors text-sm text-left"
                            >
                              <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                              <span className="truncate">{b.charAt(0).toUpperCase() + b.slice(1)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedBrowsers.length > 0 && (
                      <p className="text-[11px] text-emerald-400/80 pt-1">
                        Tracking: {selectedBrowsers.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(', ')}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Server Status */}
            <div className="pt-4 border-t border-zinc-700/50 space-y-3">
              <div className="p-3 rounded-lg bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${serverStatus && !serverStatus.error ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-xs font-medium text-zinc-300">Extension Server (port {serverStatus?.port || 54321})</span>
                </div>
                {serverStatus && !serverStatus.error ? (
                  <div className="text-[11px] text-zinc-500 space-y-1 font-mono">
                    <div>Browsers: {(serverStatus.browsersWithExtension || []).join(', ') || serverStatus.browserWithExtension || '(none)'}</div>
                    <div>Foreground: {serverStatus.currentApp || '(null)'}</div>
                    <div>Active sessions: {serverStatus.activeBrowserSessions} | Last domain: {serverStatus.lastActiveDomain || '(none)'}</div>
                  </div>
                ) : (
                  <p className="text-[11px] text-red-400">Could not get server status</p>
                )}
              </div>
            </div>

            {/* Browser Profiles */}
            <div className="pt-4 border-t border-zinc-700/50">
              <BrowserProfileSettings />
            </div>

            <div className="pt-4 border-t border-zinc-700/50"></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-zinc-300">Update Frequency</label>
                  <p className="text-xs text-zinc-500">How often to check which app is in focus</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={trackingPollInterval}
                    onChange={(e) => setTrackingPollInterval(parseInt(e.target.value) || 1000)}
                    className="w-24 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white text-right font-mono"
                  />
                  <span className="text-xs text-zinc-500">ms</span>
                </div>
              </div>
              <div className="flex gap-2">
                {[100, 500, 1000, 2000, 5000].map(ms => (
                  <button
                    key={ms}
                    onClick={() => { setTrackingPollInterval(ms); if (window.deskflowAPI?.setPreference) window.deskflowAPI.setPreference('trackingPollInterval', ms); }}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${trackingPollInterval === ms ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'}`}
                  >
                    {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600">Lower = more responsive but higher CPU. 100ms feels instant.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-zinc-300">Sleep Gap Detection</label>
                  <p className="text-xs text-zinc-500">Time before app is considered "sleep"</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={sleepGapMs}
                    onChange={(e) => setSleepGapMs(parseInt(e.target.value) || 10000)}
                    className="w-24 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white text-right font-mono"
                  />
                  <span className="text-xs text-zinc-500">ms</span>
                </div>
              </div>
              <div className="flex gap-2">
                {[5000, 10000, 15000, 30000].map(ms => (
                  <button
                    key={ms}
                    onClick={() => { setSleepGapMs(ms); handleSaveTrackingSetting('sleep_gap_ms', ms); }}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${sleepGapMs === ms ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'}`}
                  >
                    {ms / 1000}s
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-zinc-300">Max Session Duration</label>
                  <p className="text-xs text-zinc-500">Maximum app session length</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={maxSessionMs}
                    onChange={(e) => setMaxSessionMs(parseInt(e.target.value) || 300000)}
                    className="w-24 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white text-right font-mono"
                  />
                  <span className="text-xs text-zinc-500">ms</span>
                </div>
              </div>
              <div className="flex gap-2">
                {[60000, 180000, 300000, 600000].map(ms => (
                  <button
                    key={ms}
                    onClick={() => { setMaxSessionMs(ms); handleSaveTrackingSetting('max_session_ms', ms); }}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${maxSessionMs === ms ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'}`}
                  >
                    {ms === 60000 ? '1m' : ms === 180000 ? '3m' : ms === 300000 ? '5m' : '10m'}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-700/50 grid grid-cols-2 gap-4 text-xs">
              <div className="bg-zinc-800/50 light:bg-zinc-100/50 rounded-lg p-3">
                <div className="text-zinc-500 mb-1">Sleep Gap</div>
                <div className="text-white font-mono">{(sleepGapMs / 1000).toFixed(1)}s</div>
              </div>
              <div className="bg-zinc-800/50 light:bg-zinc-100/50 rounded-lg p-3">
                <div className="text-zinc-500 mb-1">Max Session</div>
                <div className="text-white font-mono">{(maxSessionMs / 60000).toFixed(1)}m</div>
              </div>
            </div>
          </GlassCard>
          </SearchableSection>

          {/* Prompt History Settings */}
          <SearchableSection terms={['prompt', 'history', 'visible prompts']} search={settingsSearch}>
          <GlassCard>
            <h2 className="text-lg font-semibold mb-3">Prompt History</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-zinc-400 mb-2 block">Visible Prompts</label>
                <p className="text-xs text-zinc-500 mb-2">Number of recent prompts shown in the terminal sidebar history tab. Older prompts are hidden but can be expanded.</p>
                <div className="flex gap-2 flex-wrap">
                  {[3, 5, 10, 20, 50, 100].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        setPromptHistoryLimit(n);
                        window.deskflowAPI?.setPreference?.('promptHistoryLimit', n);
                        setHasChanges(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${promptHistoryLimit === n
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        : 'bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-400 hover:text-white'
                        }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={promptHistoryLimit}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value) || 5);
                    setPromptHistoryLimit(v);
                    window.deskflowAPI?.setPreference?.('promptHistoryLimit', v);
                    /* The numeric input is the SAME setting as the preset buttons above, so it
                     * reports the same way. Typing raises the bar on every keystroke, which is
                     * correct: `setHasChanges(true)` is idempotent, so it does not re-render
                     * beyond the first, and the bar is a standing state rather than a toast —
                     * it should be present the whole time the value differs. */
                    setHasChanges(true);
                  }}
                  className="w-20 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white text-right font-mono"
                />
              </div>
            </div>
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div data-section="settings.prompts" className="space-y-6">

          {/* 1. DEFAULT (read-only) */}
          <SearchableSection terms={['default', 'baseline', 'app baseline']} search={settingsSearch}>
          <GlassCard>
            <div>
              <h3 className="text-cyan-400 font-semibold">Default · app baseline</h3>
              <p className="text-sm text-zinc-500">Always applied first to every agent and project. Edit in agent/DEFAULT_SYSTEM_PROMPT.md.</p>
            </div>
            <details className="mt-2 group">
              <summary className="text-sm font-medium text-zinc-400 hover:text-zinc-300 cursor-pointer select-none list-none flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                View default prompt
              </summary>
              <div className="mt-2 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] light:bg-white/60 rounded-lg border border-zinc-700/50 p-3 max-h-48 overflow-y-auto sf-scroll-gutter">
                <pre className="text-[11px] text-zinc-400 font-mono whitespace-pre-wrap">{DEFAULT_SYSTEM_PROMPT}</pre>
              </div>
            </details>
          </GlassCard>
          </SearchableSection>

          {/* 2. GENERAL (generalAdditions) */}
          <SearchableSection terms={['general', 'instructions', 'general additions']} search={settingsSearch}>
          <GlassCard>
            <div>
              <h3 className="text-blue-400 font-semibold">General · all projects · all agents</h3>
              <p className="text-sm text-zinc-500">Reusable instructions saved to the app and applied on every project. This is the place for cross-project standards.</p>
            </div>
            <textarea
              value={systemPrompts.generalAdditions || ''}
              onChange={(e) => setSystemPrompts((p) => ({ ...p, generalAdditions: e.target.value }))}
              onBlur={() => handleSaveSystemPrompt('generalAdditions', systemPrompts.generalAdditions || '')}
              placeholder={'App-wide instructions appended after the default, before agent/project layers...'}
              rows={4}
              className="mt-2 w-full bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-600 transition-colors duration-150"
            />
          </GlassCard>
          </SearchableSection>

          {/* 3. AGENT-TYPE (claude/opencode/custom) */}
          <SearchableSection terms={['agent', 'agent-type', 'claude', 'opencode', 'custom agent']} search={settingsSearch}>
          <GlassCard>
            <div>
              <h3 className="text-emerald-400 font-semibold">Agent-type · only this agent</h3>
              <p className="text-sm text-zinc-500">Applied only when a session uses this agent type. Stacks on top of Default + General.</p>
            </div>
            <div className="mt-2 space-y-4">
              {['claude', 'opencode', 'custom'].map((agent) => {
                const additions = systemPrompts[agent] || '';
                return (
                  <div key={agent} className="p-3 bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl border border-zinc-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-zinc-300 capitalize">{agent === 'custom' ? 'Custom AI' : agent}</label>
                      <button
                        onClick={() => handleSaveSystemPrompt(agent, '')}
                        className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-400 rounded transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <textarea
                      value={additions}
                      onChange={(e) => setSystemPrompts(prev => ({ ...prev, [agent]: e.target.value }))}
                      onBlur={() => handleSaveSystemPrompt(agent, systemPrompts[agent] || '')}
                      placeholder={`Instructions applied only to ${agent} sessions...`}
                      rows={4}
                      className="w-full bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-600 transition-colors duration-150"
                    />
                  </div>
                );
              })}
            </div>
          </GlassCard>
          </SearchableSection>

          {/* 4. PROJECT (project:<id>) */}
          <SearchableSection terms={['project', 'project prompt']} search={settingsSearch}>
          <GlassCard>
            <div>
              <h3 className="text-purple-400 font-semibold">Project · only the selected project</h3>
              <p className="text-sm text-zinc-500">Applied only to the chosen project. Highest precedence.</p>
            </div>
            <div className="mt-2">
              <select
                value={promptProjectId}
                onChange={(e) => setPromptProjectId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300"
              >
                {promptProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
                <textarea
                value={systemPrompts[projectKey(promptProjectId)] || ''}
                onChange={(e) => setSystemPrompts((p) => ({ ...p, [projectKey(promptProjectId)]: e.target.value }))}
                onBlur={() => handleSaveSystemPrompt(projectKey(promptProjectId), systemPrompts[projectKey(promptProjectId)] || '')}
                placeholder={'Instructions applied only to this project...'}
                rows={4}
                className="mt-2 w-full bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-600 transition-colors duration-150"
              />
            </div>
          </GlassCard>
          </SearchableSection>

          <SearchableSection terms={['resume', 'commands', 'agent resume']} search={settingsSearch}>
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Agent Resume Commands</h2>
                <p className="text-xs text-zinc-500">Template for resuming AI agent sessions. Use <code className="text-cyan-400">{'{agent}'}</code> and <code className="text-cyan-400">{'{resumeId}'}</code> as placeholders.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AGENTS.map(agent => {
                const cmd = resumeCommands[agent] || DEFAULT_RESUME_COMMANDS[agent] || '{agent} -s {resumeId}';
                return (
                  <div key={agent} className="p-3 bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl border border-zinc-700/30">
                    <label className="text-sm font-medium text-zinc-300 capitalize block mb-1.5">{agent}</label>
                    <div className="flex gap-2">
                      <input
                        value={cmd}
                        onChange={(e) => setResumeCommands(prev => ({ ...prev, [agent]: e.target.value }))}
                        onBlur={() => handleSaveResumeCommand(agent, resumeCommands[agent] || DEFAULT_RESUME_COMMANDS[agent] || '{agent} -s {resumeId}')}
                        placeholder="{agent} -s {resumeId}"
                        className="flex-1 bg-zinc-900 light:bg-[var(--ws-surface-raised)] border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono placeholder-zinc-600 transition-colors duration-150"
                      />
                      <button
                        onClick={() => handleSaveResumeCommand(agent, resumeCommands[agent] || DEFAULT_RESUME_COMMANDS[agent] || '{agent} -s {resumeId}')}
                        className="px-2.5 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors shrink-0"
                      >
                        Save
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Result: <code className="text-emerald-400">{cmd.replace('{agent}', agent).replace('{resumeId}', 'abc123')}</code>
                    </p>
                  </div>
                );
              })}
            </div>
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {activeTab === 'colors' && (
        <div data-section="settings.colors" className="space-y-4">
          {aiRun?.purpose === 'colors' && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${aiRun.error ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
              {aiRun.error ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : aiRun.done ? <Check className="w-4 h-4 flex-shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
              <span className="flex-1">{aiRun.error || aiRun.phase}</span>
              {aiRun.provider && !aiRun.error && <span className="text-xs text-zinc-400 font-mono">via {aiRun.provider}</span>}
            </div>
          )}
          {/* Tier Colors — the three productivity tiers, app-wide.
              These are the SAME --tier-* variables the dashboard stopwatch, Tier
              Breakdown strip, Productivity page and Insights charts read, so a
              change here repaints every one of them. Before this existed the
              tiers were hardcoded in 9 files that disagreed with each other. */}
          <SearchableSection terms={['tier', 'tier color', 'productive', 'neutral', 'distracting', 'productivity color']} search={settingsSearch}>
          <GlassCard>
            <SectionHeader
              title="Tier Colors"
              icon={<Palette className="w-5 h-5" />}
            />
            <p className="text-xs text-zinc-500 mb-4">
              How productive, neutral and distracting apps are coloured everywhere — stopwatch, charts, lists.
            </p>
            <div className="space-y-2">
              {TIERS.map((t) => (
                <div key={t} className="flex items-center gap-3 p-2.5 bg-zinc-800/40 light:bg-zinc-100/40 rounded-lg border border-zinc-700/30">
                  <ColorPicker
                    value={tierColorValue(t)}
                    onChange={(color) => setTierColor(t, color)}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-300 font-medium">{TIER_LABELS[t]}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">{tierColorValue(t)}</div>
                  </div>
                  <div className="h-6 w-16 rounded-md border border-zinc-700/40" style={{ background: tierColorValue(t) }} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/50">
              <span className="text-[11px] text-zinc-500">Applies immediately, everywhere. No save needed.</span>
              <button
                onClick={() => resetTierColors()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors duration-150"
              >
                Reset to defaults
              </button>
            </div>
          </GlassCard>
          </SearchableSection>

          {/* Category Colors Section */}
          <SearchableSection terms={['category', 'colors', 'category color', 'palette']} search={settingsSearch}>
          <GlassCard>
            <SectionHeader
              title="Category Colors"
              icon={<Palette className="w-5 h-5" />}
            />
            <p className="text-xs text-zinc-500 mb-4">Solar system colors</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {allCategories.map((category) => (
                <div key={category} className="flex items-center gap-2 p-2.5 bg-zinc-800/40 light:bg-zinc-100/40 hover:bg-zinc-800/70 rounded-lg border border-zinc-700/30 hover:border-zinc-600 transition-colors duration-150 group">
                  <ColorPicker
                    value={getCategoryColor(category)}
                    onChange={(color) => handleCategoryColorChange(category, color)}
                    size="sm"
                  />
                  <span className="text-sm text-zinc-300 group-hover:text-white font-medium truncate">{category}</span>
                </div>
              ))}
            </div>
          </GlassCard>
          </SearchableSection>

          {/* App/Website Colors Section */}
          <SearchableSection terms={['application', 'website', 'app color', 'website color']} search={settingsSearch}>
          <GlassCard>
            <SectionHeader
              title={`${colorTab === 'apps' ? 'Application' : 'Website'} Colors`}
              icon={<Palette className="w-5 h-5" />}
              action={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 bg-zinc-800/50 light:bg-zinc-100/50 px-2 py-1 rounded-md">
                    {(colorTab === 'apps' ? appStats : domainStats).length} {colorTab}
                  </span>
                  <button
                    onClick={async () => {
                      setPreAiColors({ ...localAppColors });
                      setGeneratingColors(true);
                      setAiRun({ purpose: 'colors', phase: 'Starting...' });
                      try {
                        const appsToColor = colorTab === 'apps'
                          ? appStats.map((a: any) => a.app)
                          : domainStats.map((d: any) => d.domain);
                        if (window.deskflowAPI?.generateAIColors) {
                          const generated = await window.deskflowAPI.generateAIColors(appsToColor);
                          // Apply all generated colors in single state update
                          const validColors: Record<string, string> = {};
                          Object.entries(generated).forEach(([appName, color]) => {
                            if (color && typeof color === 'string' && color.startsWith('#')) {
                              validColors[appName] = color;
                            }
                          });
                          setLocalAppColors(prev => ({ ...prev, ...validColors }));
                          setHasChanges(true);
                          onHasChangesChange(true);
                          setAiRun(prev => prev?.error ? prev : ({
                            purpose: 'colors',
                            phase: `${Object.keys(validColors).length} color${Object.keys(validColors).length === 1 ? '' : 's'} generated`,
                            done: true,
                            provider: prev?.provider,
                            error: ''
                          }));
                          setGeneratingColors(false);
                        }
                      } catch (err) {
                        console.error('Magic Color failed:', err);
                        setAiRun({ purpose: 'colors', phase: '', error: err instanceof Error ? err.message : String(err), done: false });
                        setGeneratingColors(false);
                      }
                    }}
                    disabled={generatingColors}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generatingColors ? 'Generating...' : 'Magic Color'}
                  </button>
                </div>
              }
            />
            <p className="text-xs text-zinc-500 mb-3">Individual colors</p>

            {/* Apps/Websites Toggle */}
            <div className="flex gap-1 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white/50 p-1 rounded-xl mb-4 w-fit">
              <button
                onClick={() => setColorTab('apps')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${colorTab === 'apps'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 light:bg-zinc-100/50'
                  }`}
              >
                Apps
              </button>
              <button
                onClick={() => setColorTab('websites')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${colorTab === 'websites'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 light:bg-zinc-100/50'
                  }`}
              >
                Websites
              </button>
            </div>

            {/* Search Filter */}
            <div className="mb-4 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder={`Search ${colorTab}...`}
                value={colorSearchFilter}
                onChange={(e) => setColorSearchFilter(e.target.value)}
                className="w-full sm:w-64 pl-8 pr-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500"
              />
            </div>

            {/* Responsive Grid Layout - ALL Items */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {(colorTab === 'apps' ? appStats : domainStats)
                .filter((item: any) => colorSearchFilter === '' || (colorTab === 'apps' ? item.app : item.domain).toLowerCase().includes(colorSearchFilter.toLowerCase()))
                .map((item: any) => {
                  const name = colorTab === 'apps' ? item.app : item.domain;
                  const color = localAppColors[name] || '#888888';
                  const category = colorTab === 'apps' ? item.category : (item.category || 'Other');
                  const categoryColor = getCategoryColor(category);
                  return (
                    <div key={name} className="relative flex flex-col p-3 bg-zinc-800/40 light:bg-zinc-100/40 hover:bg-zinc-800/70 rounded-xl border border-zinc-700/30 hover:border-zinc-600 transition-colors duration-150 group">
                      {/* Individual AI Sparkle Button */}
                      <button
                        onClick={async () => {
                          try {
                            if (window.deskflowAPI?.generateAIColors) {
                              const generated = await window.deskflowAPI.generateAIColors([name]);
                              if (generated[name]) {
                                handleAppColorChange(name, generated[name]);
                              }
                            }
                          } catch (err) {
                            console.error('Individual AI color failed:', err);
                          }
                        }}
                        className="absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 text-white/40 hover:text-white transition-colors duration-150 opacity-60 hover:opacity-100 z-10"
                        title="AI Color"
                      >
                        <Sparkles className="w-3 h-3" />
                      </button>

                      {/* Color Bar at Top */}
                      <div className="mb-2">
                        <ColorPicker
                          value={color}
                          onChange={(newColor) => handleAppColorChange(name, newColor)}
                          size="sm"
                        />
                      </div>

                      {/* App Name */}
                      <div className="text-xs text-zinc-300 group-hover:text-white font-medium truncate mb-1 pr-5">{name}</div>

                      {/* Category Badge */}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md self-start"
                        style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                      >
                        {category}
                      </span>
                    </div>
                  );
                })}
            </div>
          </GlassCard>
          </SearchableSection>

          {/* Voice & Speech Section */}
          <SearchableSection terms={['voice', 'speech', 'dictation', 'microphone', 'stt', 'speech api key', 'whisper', 'windows speech']} search={settingsSearch}>
          <GlassCard className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Voice & Speech</h2>
              <p className="text-xs text-zinc-500">Dictation runs on-device with faster-whisper — your audio never leaves this machine. A cloud key is optional and only used if on-device is unavailable.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Speech API Key</label>
              <div className="relative">
                <input
                  type={showSttKey ? 'text' : 'password'}
                  placeholder="gsk_..."
                  value={sttApiKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSttApiKey(v);
                    if (window.deskflowAPI?.setPreference) {
                      window.deskflowAPI.setPreference('sttApiKey', v.trim());
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSttKey(prev => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showSttKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Any OpenAI-compatible speech-to-text API key (Groq, OpenAI, etc.). When set, dictation uses the cloud API first — this is the most accurate engine.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-zinc-400 mb-2 block">Model</label>
                <input
                  type="text"
                  placeholder="whisper-large-v3-turbo"
                  value={sttModel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSttModel(v);
                    if (window.deskflowAPI?.setPreference) {
                      window.deskflowAPI.setPreference('sttModel', v.trim() || 'whisper-large-v3-turbo');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-400 mb-2 block">API URL</label>
                <input
                  type="text"
                  placeholder="https://api.groq.com/openai/v1/audio/transcriptions"
                  value={sttBaseUrl}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSttBaseUrl(v);
                    if (window.deskflowAPI?.setPreference) {
                      window.deskflowAPI.setPreference('sttBaseUrl', v.trim());
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 font-mono"
                />
              </div>
            </div>

            {/* Floating dictation panel — the reachable entry point */}
            <div className="rounded-lg border border-zinc-700/40 p-3 space-y-2">
              <p className="text-xs text-zinc-400 font-medium">Floating dictation panel</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={toggleSttPanel}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-zinc-700/60 bg-zinc-800/50 hover:bg-zinc-800 light:bg-zinc-100/60 light:border-zinc-300/60 light:hover:bg-zinc-200/60 text-zinc-100 light:text-zinc-900 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  {islandOpen ? 'Close Halo Island' : 'Open Halo Island'}
                </button>
                <span className="text-xs text-zinc-500">
                  {islandError
                    ? islandError
                    : 'A separate window that stays above your other apps. Press Start, speak, then press Stop — it saves the transcript to your library and copies it to your clipboard.'}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                <span className="text-zinc-400">Ctrl+Shift+V</span> shows this panel when it is
                hidden and hides it again when it is already open.
              </p>
            </div>

            <div className="rounded-lg bg-zinc-800/40 light:bg-zinc-100/40 border border-zinc-700/40 p-3 space-y-1.5">
              <p className="text-xs text-zinc-400 font-medium">Fallback chain</p>
              <p className="text-xs text-zinc-500"><span className="text-emerald-400">1. Cloud API</span> — used when an API key is set. Best accuracy.</p>
              <p className="text-xs text-zinc-500"><span className="text-blue-400">2. Windows speech</span> — built-in Windows recognition, used when no API key is set. Works fully offline.</p>
              <p className="text-xs text-zinc-500"><span className="text-amber-400">3. Browser speech</span> — last resort. Can be unreliable in this app.</p>
            </div>
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {/* HALO ISLAND — enable/disable, layout, size, shape and widgets.
          *
          * ── THIS BLOCK WAS RENDERING ON EVERY SETTINGS TAB ─────────────────────────────────
          * It sat at the top level of the page's JSX, outside every
          * `activeTab === '…'` conditional, so React mounted it unconditionally —
          * appended below whatever tab you were on. Finance, Devices, Database,
          * Auth and Keyboard Shortcuts therefore all ended in a Halo Island
          * panel, and because it was the LAST `data-section` in the DOM it is
          * also what a scroll-to-section lands on when the requested tab has not
          * painted yet.
          *
          * It belongs to APPEARANCE: the island is window chrome — an
          * always-on-top surface the user chooses the look of — and Appearance
          * already owns theme, fonts and the ambient wash. Finance/Devices/
          * Database/Auth/Shortcuts are data and account domains; a floating
          * top-of-screen widget is not part of any of them.
          *
          * It keeps its own `data-section` so ⌘K and the tour have a real anchor. */}
      {activeTab === 'appearance' && (
        <div data-section="settings.halo" className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Halo Island</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              The always-on-top strip at the top of the screen showing tracked time and dictation.
            </p>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-[12px] text-zinc-300">Show Halo Island</div>
              <div className="text-[11px] text-zinc-500">
                Also opens on hover. The global shortcut is editable under Keyboard.
              </div>
            </div>
            {/* Track was `var(--page-accent)` (= `--text-primary` = `#fafafa` on dark) with a
                `bg-zinc-100` knob: white-on-white at 1.04:1. Delegated to `sf-switch`. */}
            <SettingsSwitch
              checked={haloPrefs.enabled}
              label="Show Halo Island"
              onChange={(v) => {
                void saveHaloPrefs({ enabled: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-[12px] text-zinc-300">Auto-show active features</div>
              <div className="text-[11px] text-zinc-500">
                Show a feature in the island while it is running, even if its widget is
                hidden below. Default on.
              </div>
            </div>
            <SettingsSwitch
              checked={haloPrefs.autoShowActive !== false}
              label="Auto-show active features"
              onChange={(v) => {
                void saveHaloPrefs({ autoShowActive: v });
              }}
            />
          </div>

          {/* DUAL-BOOT: which of the two shipped layouts the island renders.
           *
           * Both are complete and independently functional — 'legacy' is the top rail with two
           * tabs, 'figma' is board `2 / Pages` with four pages and a bottom rail. The pin is in
           * BOTH. This exists so a new, unverified design never ships without an escape hatch,
           * and so a revert is one click rather than a re-implementation. */}
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[12px] text-zinc-300">Layout</span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                {haloPrefs.uiVersion === 'figma' ? '4 pages' : '2 tabs'}
              </span>
            </div>
            <div role="radiogroup" aria-label="Halo layout" className="grid grid-cols-2 gap-1">
              {(['figma', 'legacy'] as HaloUiVersion[]).map((key) => {
                const active = haloPrefs.uiVersion === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!haloPrefs.enabled}
                    onClick={() => void saveHaloPrefs({ uiVersion: key })}
                    className={[
                      'rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70',
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-zinc-100'
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/60',
                      !haloPrefs.enabled ? 'opacity-50 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {key === 'figma' ? 'New (4 pages)' : 'Previous (2 tabs)'}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-600 mt-1.5">
              {haloPrefs.uiVersion === 'figma'
                ? 'Bottom tab rail, four pages, per Figma board 2.'
                : 'Top rail, Tracked time and Dictation, as it shipped before.'}
            </p>
          </div>

          {/* THREE SIZES, NOT A CONTINUOUS SLIDER.
           *
           * This was a 0.7-1.6 range input. The island now resolves a scale onto one of three
           * DESIGNED presets (480 / 560 / 680 wide — Figma board `1 / Sizes`), so most of that
           * slider became a dead zone: 0.95 and 1.05 both render Medium, and dragging between
           * them changed nothing on screen. It also labelled its ends `322px` and `736px`,
           * computed from the legacy 460-wide token, which matched no real island at any size.
           *
           * A stored `scale` from an older install still works: `presetForScale` maps any old
           * value onto the band it falls in, and 1.0 — the historical default — lands on
           * Medium. So this replaces the control without migrating anyone's setting. */}
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[12px] text-zinc-300">Size</span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                {resolveHaloSize(haloPrefs.scale).expandedWidth}×
                {resolveHaloSize(haloPrefs.scale).expandedHeight}
              </span>
            </div>
            <div role="radiogroup" aria-label="Halo Island size" className="grid grid-cols-3 gap-1">
              {(['small', 'medium', 'large'] as const).map((key) => {
                const preset = HALO_SIZE_PRESETS[key];
                const active = presetForScale(haloPrefs.scale) === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!haloPrefs.enabled}
                    onClick={() => void saveHaloPrefs({ scale: preset.typeScale })}
                    className={[
                      'rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70',
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-zinc-100'
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/60',
                      !haloPrefs.enabled ? 'opacity-50 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    <span className="block">{preset.label}</span>
                    <span className="block font-mono text-[10px] tabular-nums opacity-60">
                      {preset.expandedWidth}
                    </span>
                  </button>
                );
              })}
            </div>
<p className="text-[10px] text-zinc-600 mt-1.5">
                {resolveHaloSize(haloPrefs.scale).iconOnlyTabs
                  ? 'Compact tabs at this size.'
                  : 'Tabs show icon and label.'}
              </p>
            </div>

            {/* ── PREVIEW — HALO_SETTINGS.html places this between General and Pages:
                "This is the real island at your size. It updates as you change things.
                Sample data." with an Open | Pill toggle. It renders the island's own
                presentation primitives at the user's chosen size/shape/radius/scale, so every
                one of those controls now has a visible consequence on this page. */}
            <HaloSettingsPreview
              prefs={haloPrefs}
              pages={haloPages.filter((id) => !haloHidden.includes(id)) as HaloPageId[]}
            />

            {/* ── PAGES — drag or keyboard to reorder, Show to hide ────────────────
                Replaces the up/down widget block that was rejected. Claude's
                `agent/docs/HALO_SETTINGS.html` puts a drag HANDLE on each row so the row
                itself stays a plain target, and adds a "More" menu with Move up / Move down /
                Move to top as the WCAG 2.5.7 alternative to dragging. */}
            <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[12px] text-zinc-300">Pages</span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {haloPages.length - haloHidden.length}/{haloPages.length} on
                </span>
              </div>
              <ul className="flex flex-col gap-1" role="list" aria-label="Halo pages">
                {haloPages.map((id, i) => {
                  const on = !haloHidden.includes(id);
                  const meta = HALO_PAGE_LABELS[id];
                  const move = (to: number) => {
                    const next = haloPages.slice();
                    const [row] = next.splice(i, 1);
                    next.splice(Math.max(0, Math.min(next.length, to)), 0, row);
                    void saveHaloPrefs({ pages: { ...haloPrefs.pages, order: next } });
                  };
                  return (
                    <li
                      key={id}
                      className={[
                        'flex items-center gap-2 rounded-md border px-2 py-1.5',
                        'border-zinc-800',
                        dragOver === id ? 'border-emerald-500/60' : '',
                        on ? '' : 'opacity-60',
                      ].join(' ')}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(id); }}
                      onDragLeave={() => setDragOver((p) => (p === id ? null : p))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = dragIndex.current;
                        setDragOver(null);
                        if (from == null || from === i) return;
                        const next = haloPages.slice();
                        const [row] = next.splice(from, 1);
                        next.splice(i, 0, row);
                        void saveHaloPrefs({ pages: { ...haloPrefs.pages, order: next } });
                      }}
                    >
                      <button
                        type="button"
                        draggable
                        aria-label={`Move ${meta.label}. Position ${i + 1} of ${haloPages.length}.`}
                        onDragStart={(e) => {
                          dragIndex.current = i;
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => { dragIndex.current = null; setDragOver(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp') { e.preventDefault(); move(i - 1); }
                          else if (e.key === 'ArrowDown') { e.preventDefault(); move(i + 1); }
                        }}
                        className="h-6 w-6 shrink-0 cursor-grab rounded border border-zinc-800 text-[11px] leading-none text-zinc-400 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                      >
                        ⠿
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={['text-[12px]', on ? 'text-zinc-200' : 'text-zinc-500 line-through'].join(' ')}>
                          {meta.label}
                        </div>
                        <div className="text-[11px] text-zinc-500">{meta.hint}</div>
                      </div>
                      <SettingsSwitch
                        checked={on}
                        label={`Show the ${meta.label} page`}
                        onChange={(v) => {
                          const hidden = v
                            ? haloHidden.filter((p) => p !== id)
                            : [...haloHidden, id];
                          void saveHaloPrefs({ pages: { ...haloPrefs.pages, hidden } });
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`More actions for ${meta.label}`}
                        aria-expanded={pageMenu === id}
                        onClick={() => setPageMenu((p) => (p === id ? null : id))}
                        className="h-6 w-6 shrink-0 rounded border border-zinc-800 text-[11px] leading-none text-zinc-400 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                      >
                        ⋯
                      </button>
                      {pageMenu === id && (
                        <div className="flex gap-1 rounded-md bg-zinc-900 p-1">
                          <button type="button" disabled={i === 0} onClick={() => { move(i - 1); setPageMenu(null); }}
                            className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 disabled:opacity-40">Up</button>
                          <button type="button" disabled={i === haloPages.length - 1} onClick={() => { move(i + 1); setPageMenu(null); }}
                            className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 disabled:opacity-40">Down</button>
                          <button type="button" disabled={i === 0} onClick={() => { move(0); setPageMenu(null); }}
                            className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 disabled:opacity-40">Top</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between py-1.5 mt-2">
                <div>
                  <div className="text-[12px] text-zinc-300">Open on</div>
                  <div className="text-[11px] text-zinc-500">Which page shows when the island opens.</div>
                </div>
                <select
                  aria-label="Open on"
                  value={haloPrefs.pages.open}
                  onChange={(e) => {
                    const v = e.target.value as 'last' | HaloPageId;
                    void saveHaloPrefs({ pages: { ...haloPrefs.pages, open: v } });
                  }}
                  className="h-11 rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[12px] text-zinc-200"
                >
                  <option value="last">The last page I used</option>
                  {haloPages.map((id) => (
                    <option key={id} value={id}>{HALO_PAGE_LABELS[id].label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── THE PILL — one main item, others may still appear ──────────────── */}
            <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[12px] text-zinc-300">The pill</span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {HALO_PILL_LABELS[haloPrefs.pill.resident].label}
                </span>
              </div>
              <ul className="flex flex-col gap-1" role="radiogroup" aria-label="Main item in the pill">
                {HALO_PILL_RESIDENTS.map((kind) => {
                  const isResident = haloPrefs.pill.resident === kind;
                  const canAppear = haloPrefs.widgets?.[kind]?.compact !== false;
                  return (
                    <li key={kind} className="flex items-center gap-2 rounded-md border border-zinc-800 px-2 py-1.5">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isResident}
                        onClick={() => void saveHaloPrefs({ pill: { resident: kind } })}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2"
                          style={{ borderColor: isResident ? 'var(--color-emerald-500)' : 'var(--color-zinc-600)' }}
                        >
                          {isResident && (
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className={['block text-[12px]', isResident ? 'text-zinc-100' : 'text-zinc-300'].join(' ')}>
                            {HALO_PILL_LABELS[kind].label}
                            {isResident && <span className="ml-1 text-[11px] font-normal text-zinc-500">main item</span>}
                          </span>
                          <span className="block text-[11px] text-zinc-500">{HALO_PILL_LABELS[kind].hint}</span>
                        </span>
                      </button>
                      {!isResident && (
                        <SettingsSwitch
                          checked={canAppear}
                          label={`Let ${HALO_PILL_LABELS[kind].label} appear in the pill`}
                          onChange={(v) => void saveHaloPrefs({
                            widgets: {
                              ...haloPrefs.widgets,
                              [kind]: { ...haloPrefs.widgets?.[kind], compact: v },
                            },
                          })}
                        />
                      )}
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 rounded-md border border-zinc-800 px-2 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-zinc-300">Overdue alerts</span>
                    <span className="block text-[11px] text-zinc-500">
                      Always take over the pill when a deadline is overdue.
                    </span>
                  </span>
                  <span className="text-[11px] text-zinc-500">Always on</span>
                </li>
              </ul>
            </div>


          {/* Shape and the corner-radius slider are NOT offered. Claude's ruling: LAMINAR
              allows radii 8, 12 and pill only, and the radius is decided by OS placement
              (§8: macOS square top corners, Windows all rounded), so a free radius control
              contradicts the design system. `shape` and `radius` stay in the normaliser so an
              existing pref still loads; they are just not editable here. */}

          {/* ── How many widgets show at once ───────────────────────────────────
            Capped at 3 because the spec forbids three legible text segments inside the
            232px compact pill; beyond that, extra widgets degrade to identity dots
            instead of the type shrinking. */}
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[12px] text-zinc-300">Widgets shown at once</span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                {haloPrefs.maxVisible}
              </span>
            </div>
            <input
              type="range"
              min={HALO_MAX_VISIBLE_MIN}
              max={HALO_MAX_VISIBLE_MAX}
              step={1}
              value={haloPrefs.maxVisible}
              disabled={!haloPrefs.enabled}
              aria-label="Widgets shown at once"
              onChange={(e) => {
                void saveHaloPrefs({ maxVisible: Number(e.target.value) });
              }}
              className="w-full"
            />
            <p className="text-[10px] text-zinc-600 mt-1 leading-snug">
              Up to 3. The compact pill is 232px wide and cannot hold three legible values,
              so anything beyond the limit appears as a small coloured dot rather than
              shrinking the type.
            </p>
          </div>

          {/* ── Which widgets appear, and in what order ─────────────────────────
            Show/hide per widget. The stopwatch is deliberately NOT listed: it is the
            permanent hero and the surface's core invariant is that it is never removed. */}
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300 mb-0.5">Widgets</div>
            <p className="text-[10px] text-zinc-600 mb-2 leading-snug">
              Tracked time always shows. Turn the rest on or off, and drag to change the
              order they appear in.
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between py-1.5 px-2" style={{ borderRadius: 8, background: 'var(--ws-surface-raised)' }}>
                <div>
                  <div className="text-[12px] text-zinc-200">Tracked time</div>
                  <div className="text-[10px] text-zinc-500">Always on — the hero.</div>
                </div>
                <span className="text-[10px] text-zinc-500">Required</span>
              </div>
              {HALO_ORDERABLE.map((kind) => {
                const on = isWidgetVisible(haloPrefs, kind);
                return (
                  <div
                    key={kind}
                    className="flex items-center gap-2 py-1.5 px-2"
                    style={{ borderRadius: 8, background: on ? 'var(--ws-surface-raised)' : 'transparent', border: on ? 'none' : '1px solid var(--ws-border)' }}
                  >
                    <span className="text-[11px] text-zinc-400 capitalize flex-1">{kind.replace(/([A-Z])/g, ' $1')}</span>
                    <button
                      type="button"
                      disabled={!haloPrefs.enabled}
                      aria-label={`Move ${kind} up`}
                      onClick={() => {
                        const i = haloPrefs.order.indexOf(kind);
                        if (i <= 0) return;
                        const order = [...haloPrefs.order];
                        [order[i - 1], order[i]] = [order[i], order[i - 1]];
                        void saveHaloPrefs({ order });
                      }}
                      className="text-[11px] text-zinc-500 px-1 disabled:opacity-40"
                      style={{ color: 'var(--text-disabled)' }}
                    >
                      ↑
                    </button>
                    {/* Same white-on-white track/knob pair as the two above — the third instance of
                        the identical defect. `sf-switch` handles the disabled state too. */}
                    <SettingsSwitch
                      checked={on}
                      disabled={!haloPrefs.enabled}
                      label={`Show ${kind}`}
                      onChange={(v) => {
                        void saveHaloPrefs({
                          widgets: { ...haloPrefs.widgets, [kind]: { visible: v } },
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
          <div className="halo-t-eyebrow pt-3 pb-1.5" style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--ws-border)", marginBottom: 4 }}>
            Trigger
          </div>
              TRIGGER — the hitbox. FIRST because it is the control people reach for
              when the island "doesn't work right", and the one whose effect is
              invisible until it is wrong.

              WHY THE HITBOX IS DESCRIBED AS HOVER-ONLY, IN PLAIN WORDS
              Human-Centric UX, pillar 1: no raw field names. `padX`/`padY` mean
              nothing to a user; "how far away the pointer can be" does. And the
              reassurance that it never blocks clicks is stated here rather than
              buried in a code comment, because a user widening a hitbox on an
              always-on-top overlay is exactly the person who needs to know that.
              ═══════════════════════════════════════════════════════════════════ */}
          {/* ═══ VISIBILITY — when the pill itself is on screen ═════════════════════════════
              FIRST in the section, and it is a DIFFERENT question from "Opens when"
              below. `trigger.mode` says what EXPANDS the island; `resident` says whether
              the collapsed pill is there at all. There was no control for the second
              question, which is why "always on" could not be expressed and the pill had
              no way to stay up.

              The wording is deliberately about the PILL, not the island: with
              "Always visible" the pill is up and hovering still expands it. "Hidden until
              hover" is the classic dynamic-island behaviour for anyone who wants the
              desktop back. ══════════════════════════════════════════════════════════ */}
          <div className="py-2 space-y-3" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div>
              <div className="text-[12px] text-zinc-300 mb-0.5">Pill visibility</div>
              <p className="text-[10px] text-zinc-600 leading-snug">
                Whether the small pill stays on screen. This is separate from how it expands.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Halo Island pill visibility">
              {([
                ['always', 'Always visible', 'Sits on the desktop over any app'],
                ['hover', 'Hidden until hover', 'Appears when the pointer reaches it'],
                ['off', 'Off', 'No island at all'],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={haloPrefs.resident === value}
                  disabled={!haloPrefs.enabled}
                  onClick={() => void saveHaloPrefs({ resident: value })}
                  className="text-left disabled:opacity-50"
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: `1px solid ${haloPrefs.resident === value ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                    background: haloPrefs.resident === value ? 'var(--ws-surface-raised)' : 'transparent',
                  }}
                >
                  <div className="text-[11px] text-zinc-300">{label}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="py-2 space-y-3" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div>
              <div className="text-[12px] text-zinc-300 mb-0.5">Opens when</div>
              <p className="text-[10px] text-zinc-600 leading-snug">
                How the island is summoned. None of these ever intercept a click meant for the
                app underneath — the hitbox is a hover region only.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Halo Island opens when">
              {([
                ['hover', 'Pointer enters', 'Move the mouse over it'],
                ['hover-or-click', 'Pointer or click', 'Either one (most forgiving)'],
                ['click', 'Click only', 'Never opens on its own'],
                ['hotkey', 'Shortcut only', 'Nothing opens it by accident'],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={haloPrefs.trigger.mode === value}
                  disabled={!haloPrefs.enabled}
                  onClick={() => void saveHaloPrefs({ trigger: { ...haloPrefs.trigger, mode: value } })}
                  className="text-left disabled:opacity-50"
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: `1px solid ${haloPrefs.trigger.mode === value ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                    background: haloPrefs.trigger.mode === value ? 'var(--ws-surface-raised)' : 'transparent',
                  }}
                >
                  <div className="text-[11px] text-zinc-300">{label}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Hitbox reach ────────────────────────────────────────────────────
              The live diagram is the point. The hitbox is invisible on the desktop, so
              a slider with a number next to it is unauditable — you cannot tell whether
              60px reaches past the pill or eats half your title bar. The dashed outline
              is drawn at the TRUE ratio (the real preset's pill inside the zone), so what
              you see is what the cursor actually does. */}
          <div className="py-2 space-y-3" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-zinc-300">Hitbox size</span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                {haloPrefs.trigger.padX}px sides · {haloPrefs.trigger.padY}px deep
              </span>
            </div>
            <div
              aria-hidden="true"
              className="relative mx-auto"
              style={{ width: '100%', maxWidth: 320, height: 96 }}
            >
              {/* The dashed zone IS the hitbox: pill + padX on both sides, padY downward.
                  Anchored at the top exactly like the island, so "down" reads as down. */}
              <div
                className="absolute"
                style={{
                  left: '50%',
                  top: 6,
                  width: haloZoneW,
                  height: haloZoneH,
                  transform: `translateX(-50%) scale(${haloPreviewFit})`,
                  transformOrigin: 'top center',
                  border: '1px dashed var(--page-accent)',
                  borderRadius: 4,
                  opacity: 0.75,
                }}
              >
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: '50%',
                    top: 0,
                    width: haloPreviewSize.compactWidth,
                    height: haloPreviewSize.compactHeight,
                    transform: 'translateX(-50%)',
                    background: 'var(--ws-surface-raised)',
                    border: '1px solid var(--ws-border-strong)',
                    borderRadius: 9999,
                  }}
                >
                  <span className="text-[10px] text-zinc-500">the island</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <HaloSlider
                label="How far in from the sides"
                value={haloPrefs.trigger.padX}
                min={0}
                max={HALO_PAD_X_MAX}
                step={4}
                suffix="px"
                disabled={!haloPrefs.enabled}
                onChange={(padX) => void saveHaloPrefs({ trigger: { ...haloPrefs.trigger, padX } })}
              />
              <HaloSlider
                label="How far down it reaches"
                value={haloPrefs.trigger.padY}
                min={0}
                max={HALO_PAD_Y_MAX}
                step={4}
                suffix="px"
                disabled={!haloPrefs.enabled}
                onChange={(padY) => void saveHaloPrefs({ trigger: { ...haloPrefs.trigger, padY } })}
              />
            </div>
            <p className="text-[10px] text-zinc-600 leading-snug">
              Widen this if the island is hard to summon. It will not make the island harder to
              click through — a bigger hitbox only means it appears sooner.
            </p>
          </div>

          {/* ── Timing ────────────────────────────────────────────────────────── */}
          <div className="py-2 space-y-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300">Timing</div>
            <HaloSlider
              label="Delay before it opens"
              value={haloPrefs.trigger.openDelayMs}
              min={HALO_OPEN_DELAY_MIN}
              max={HALO_OPEN_DELAY_MAX}
              step={10}
              suffix="ms"
              disabled={!haloPrefs.enabled}
              onChange={(openDelayMs) => void saveHaloPrefs({ trigger: { ...haloPrefs.trigger, openDelayMs } })}
            />
            <HaloSlider
              label="Grace period before it closes"
              value={haloPrefs.trigger.closeDelayMs}
              min={HALO_CLOSE_DELAY_MIN}
              max={HALO_CLOSE_DELAY_MAX}
              step={10}
              suffix="ms"
              disabled={!haloPrefs.enabled}
              onChange={(closeDelayMs) => void saveHaloPrefs({ trigger: { ...haloPrefs.trigger, closeDelayMs } })}
            />
            {/* `leaveMarginPx` was the ONE hover pref with no control. The island feeds it to
                `pointInHotZone` as the padding around the hot zone, so it decides how far the
                pointer can drift toward the island before the close timer starts. A value of 0
                makes the island feel like it is being dismissed the instant you reach for it;
                the default 24 lets you travel diagonally onto it without losing it. */}
            <HaloSlider
              label="Pointer forgiveness"
              value={haloPrefs.trigger.leaveMarginPx}
              min={0}
              max={64}
              step={4}
              suffix="px"
              disabled={!haloPrefs.enabled}
              onChange={(leaveMarginPx) => void saveHaloPrefs({ trigger: { ...haloPrefs.trigger, leaveMarginPx } })}
            />
            <p className="text-[10px] text-zinc-600 leading-snug">
              A long open delay ignores a cursor merely passing by. A short close delay collapses
              the island the moment the pointer drifts off it.
            </p>
          </div>

          <div className="halo-t-eyebrow pt-3 pb-1.5" style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--ws-border)", marginBottom: 4 }}>
            Position
          </div>
          {/* ── SHAPE ────────────────────────────────────────────────────────────
              `shape` and `radius` were READ by the island (`prefs.shape`,
              `prefs.radius`) but had no control anywhere, so a stored value from an older
              session changed the silhouette and the user had no way to change it back.
              The island renders `shape: 'capsule'` as a full pill and otherwise honours
              `radius`, so these two controls are the whole surface treatment. */}
          <div className="halo-t-eyebrow pt-3 pb-1.5" style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--ws-border)", marginBottom: 4 }}>
            Shape
          </div>
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300 mb-2">Silhouette</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Halo Island silhouette">
              {([
                ['capsule', 'Capsule'],
                ['square', 'Square'],
              ] as const).map(([value, label]) => {
                const active = (haloPrefs.shape ?? 'capsule') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => void saveHaloPrefs({ shape: value })}
                    className={[
                      'flex-1 rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70',
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-zinc-100 font-medium'
                        : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/60',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between py-2 mt-1">
              <div className="min-w-0">
                <div className="text-[12px] text-zinc-300">Corner radius</div>
                <div className="text-[11px] text-zinc-500">
                  Applies to the Square silhouette. The capsule is always fully rounded.
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={16}
                  step={2}
                  value={haloPrefs.radius ?? HALO_DEFAULTS.radius ?? 12}
                  aria-label="Halo Island corner radius in pixels"
                  onChange={(e) => void saveHaloPrefs({ radius: Number(e.target.value) })}
                  className="h-11 w-40 accent-emerald-500"
                />
                <span className="w-10 text-right font-mono text-[11px] tabular-nums text-zinc-400">
                  {haloPrefs.radius ?? HALO_DEFAULTS.radius ?? 12} px
                </span>
              </div>
            </div>
          </div>

          {/* ── POSITION ─────────────────────────────────────────────────────────
              HALO §127 defines exactly three edges and forbids freeform positioning,
              so this offers three and no more. What was actually broken is that the
              renderer hardcoded the top edge, so picking left or right moved the window
              and changed nothing on screen. */}
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300 mb-2">Where it sits</div>

            <HaloPlacementPreview prefs={haloPrefs} />
              {/* Claude's ruling: the island is 560x134, so a side edge would need a vertical
                  layout that is not designed anywhere. The top edge is the only one offered, and
                  "where along it" becomes three anchors plus a gap. Left/right stay in the
                  normaliser so an old stored pref still loads — they are just not offered. */}
              <div className="text-[12px] text-zinc-300 mt-3 mb-2">Where along the top edge</div>
              <div className="flex gap-2" role="radiogroup" aria-label="Halo Island horizontal position">
                {([
                  ['left', 'Left'],
                  ['center', 'Center'],
                  ['right', 'Right'],
                ] as const).map(([value, label]) => {
                  const active = (haloPrefs.anchor ?? 'center') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => void saveHaloPrefs({ anchor: value })}
                      className={[
                        'flex-1 rounded-md border px-2 py-1.5 text-[11px] transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70',
                        active
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-zinc-100 font-medium'
                          : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/60',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between py-2 mt-1">
                <div className="min-w-0">
                  <div className="text-[12px] text-zinc-300">Gap below the top edge</div>
                  <div className="text-[11px] text-zinc-500">
                    Windows and Linux only. Keep clear of your top bar.
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    type="range"
                    min={HALO_OFFSET_Y_MIN}
                    max={HALO_OFFSET_Y_MAX}
                    step={4}
                    value={haloPrefs.offsetY ?? HALO_DEFAULTS.offsetY}
                    aria-label="Gap below the top edge in pixels"
                    onChange={(e) => void saveHaloPrefs({ offsetY: Number(e.target.value) })}
                    className="h-11 w-40 accent-emerald-500"
                  />
                  <span className="w-10 text-right font-mono text-[11px] tabular-nums text-zinc-400">
                    {haloPrefs.offsetY ?? HALO_DEFAULTS.offsetY} px
                  </span>
                </div>
              </div>
          </div>
          {/* ── Which monitor ──────────────────────────────────────────────────── */}
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300 mb-2">Display</div>
            <div className="flex gap-2" role="radiogroup" aria-label="Halo Island display">
              <button
                type="button"
                role="radio"
                aria-checked={haloPrefs.displayId == null}
                disabled={!haloPrefs.enabled || haloDisplays.length === 0}
                onClick={() => void saveHaloPrefs({ displayId: null })}
                className="flex-1 text-[11px] py-1.5 disabled:opacity-40"
                style={{
                  borderRadius: 8,
                  border: `1px solid ${haloPrefs.displayId == null ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                  background: haloPrefs.displayId == null ? 'var(--ws-surface-raised)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                Main display
              </button>
              {haloDisplays.filter((d) => !d.primary).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={haloPrefs.displayId === d.id}
                  disabled={!haloPrefs.enabled}
                  onClick={() => void saveHaloPrefs({ displayId: d.id })}
                  className="flex-1 text-[11px] py-1.5 disabled:opacity-40 truncate"
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${haloPrefs.displayId === d.id ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                    background: haloPrefs.displayId === d.id ? 'var(--ws-surface-raised)' : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {haloDisplays.length === 0 && (
              <p className="text-[10px] text-zinc-600 mt-1">Could not read the display list.</p>
            )}
            <p className="text-[10px] text-zinc-600 mt-1 leading-snug">
              Falls back to the main display if that monitor is unplugged.
            </p>
          </div>

          {/* ── Custom corner radius ───────────────────────────────────────────── */}


          <div className="halo-t-eyebrow pt-3 pb-1.5" style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--ws-border)", marginBottom: 4 }}>
            Contents
          </div>
          {/* ── What the small pill shows ────────────────────────────────────────
              This is the setting the pill needed and did not have. Its contents used to
              depend on which producers were emitting at that instant, so the pill
              flickered and the user could not predict or control it. */}
          <div className="halo-t-eyebrow pt-3 pb-1.5" style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--ws-border)", marginBottom: 4 }}>
            Motion
          </div>
                    {/* ── MOTION ───────────────────────────────────────────────────────────
              One duration and one curve, read by both the stylesheet and the JS
              transition. They previously disagreed (250ms vs 280ms). */}
          <div className="py-2 space-y-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300">Motion</div>
            <HaloSlider
              label="Open and close speed"
              value={haloPrefs.motion.durationMs}
              min={HALO_DURATION_MIN}
              max={HALO_DURATION_MAX}
              step={10}
              suffix="ms"
              disabled={!haloPrefs.enabled}
              onChange={(durationMs) => void saveHaloPrefs({ motion: { ...haloPrefs.motion, durationMs } })}
            />
            <div className="flex gap-2" role="radiogroup" aria-label="Halo Island motion curve">
              {([
                ['expo', 'Settle'],
                ['standard', 'Even'],
                ['snappy', 'Quick'],
                ['linear', 'No easing'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={haloPrefs.motion.easing === value}
                  disabled={!haloPrefs.enabled}
                  onClick={() => void saveHaloPrefs({ motion: { ...haloPrefs.motion, easing: value } })}
                  className="flex-1 text-[11px] py-1.5 disabled:opacity-50"
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${haloPrefs.motion.easing === value ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                    background: haloPrefs.motion.easing === value ? 'var(--ws-surface-raised)' : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 leading-snug">
              If your system asks for reduced motion, that always wins over this setting.
            </p>
          </div>

          {/* ── Liveliness ─────────────────────────────────────────────────────────
              `motion.liveliness` was honoured by motionDurationMs() from the day it was
              written, but NO control ever wrote it — so it could only ever be 'full' and the
              pref was dead weight. This is the last of that class. */}
          <div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300 mb-2">How much it moves</div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Halo Island motion amount">
              {([
                ['full', 'Normal', 'Moves at the speed above'],
                ['reduced', 'Minimal', 'Short cross-fade only'],
                ['off', 'None', 'Snaps between states'],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={haloPrefs.motion.liveliness === value}
                  disabled={!haloPrefs.enabled}
                  onClick={() => void saveHaloPrefs({ motion: { ...haloPrefs.motion, liveliness: value } })}
                  className="text-left disabled:opacity-50"
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: `1px solid ${haloPrefs.motion.liveliness === value ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                    background: haloPrefs.motion.liveliness === value ? 'var(--ws-surface-raised)' : 'transparent',
                  }}
                >
                  <div className="text-[11px] text-zinc-300">{label}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Pin control + click behaviour ─────────────────────────────────────
              Two toggles that answer questions a user actually has: "why is there a
              pin and where is it", and "is this thing going to eat my clicks". */}
          <div className="py-2 space-y-1" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="flex items-center justify-between py-1.5">
              <div>
                <div className="text-[12px] text-zinc-300">Show the pin button</div>
                <div className="text-[10px] text-zinc-500">Pin keeps the island open. Click away or press Esc to release it.</div>
              </div>
              <SettingsSwitch
                checked={haloPrefs.showPin}
                disabled={!haloPrefs.enabled}
                label="Show the pin button"
                onChange={(showPin) => void saveHaloPrefs({ showPin })}
              />
            </div>
            {/* `clickShield` was REMOVED as a control, not wired up.
                It was a switch whose "off" position wrote `clickShield: 'canvas'` — and
                `haloIsland.ts:360` deliberately ignores that value, because making the whole
                transparent canvas a click region is exactly the "the hitbox blocks my clicks"
                bug HALO §12/§13 forbid. So the switch was a lie: it persisted a preference the
                main process refuses to honour, which is the same stored-but-never-read defect as
                a dead pin button, only worse because the UI implies an off state exists.

                The behaviour itself is correct and stays: `applyClickRegion` always shapes the
                window to the painted surface. The pref field remains in the normaliser so an
                existing saved value still loads without being reported as invalid. */}
          </div>

<div className="py-2" style={{ opacity: haloPrefs.enabled ? 1 : 0.5 }}>
            <div className="text-[12px] text-zinc-300 mb-0.5">Collapsed pill contents</div>
            <p className="text-[10px] text-zinc-600 mb-2 leading-snug">
              The small pill at the top of the screen. Opening the island always shows
              everything — this only affects the collapsed pill.
            </p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Halo Island collapsed pill contents">
              {([
                ['auto', 'Live only', 'Shows what has fresh data'],
                ['always', 'Always', 'Always shows the ones you pick'],
                ['off', 'Nothing', 'Just the tracked time'],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={haloPrefs.compactStyle === value}
                  disabled={!haloPrefs.enabled}
                  onClick={() => void saveHaloPrefs({ compactStyle: value })}
                  className="text-left disabled:opacity-50"
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: `1px solid ${haloPrefs.compactStyle === value ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                    background: haloPrefs.compactStyle === value ? 'var(--ws-surface-raised)' : 'transparent',
                  }}
                >
                  <div className="text-[11px] text-zinc-300">{label}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{hint}</div>
                </button>
              ))}
            </div>
            {haloPrefs.compactStyle === 'always' && (
              <p className="text-[10px] text-zinc-500 mt-2 leading-snug">
                Pick which ones below. A widget with no fresh reading shows dimmed rather than
                disappearing, so a quiet widget is never mistaken for a missing one.
              </p>
            )}

            <div className="text-[12px] text-zinc-300 mb-0.5 mt-3">Productivity ambience</div>
            <p className="text-[10px] text-zinc-600 mb-2 leading-snug">
              Tint the pill's edge by the stopwatch's tier — green for productive, red for
              distracting. It is a state readout, not decoration, so it is off until you turn
              it on.
            </p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Halo Island productivity ambience">
              {([
                ['off', 'Off', 'No ambience on the pill'],
                ['edge', 'Edge glow', 'Green / red ring by tier'],
              ] as const).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={haloPrefs.ambient === value}
                  disabled={!haloPrefs.enabled}
                  onClick={() => void saveHaloPrefs({ ambient: value })}
                  className="text-left disabled:opacity-50"
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: `1px solid ${haloPrefs.ambient === value ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
                    background: haloPrefs.ambient === value ? 'var(--ws-surface-raised)' : 'transparent',
                  }}
                >
                  <div className="text-[11px] text-zinc-300">{label}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{hint}</div>
                </button>
              ))}
            </div>


<div className="text-[12px] text-zinc-300 mb-0.5">Collapsed pill</div>
            <HaloPillPreview prefs={haloPrefs} />
            <p className="text-[10px] text-zinc-600 mb-2 leading-snug">
              The pill is small. Turn a widget off here to keep it out of the collapsed island
              while still showing it when the island is open.
            </p>
            <div className="space-y-1">
              {HALO_ORDERABLE.map((kind) => {
                const inPill = haloPrefs.widgets?.[kind]?.compact !== false;
                return (
                  <div
                    key={`pill-${kind}`}
                    className="flex items-center justify-between py-1.5 px-2"
                    style={{ borderRadius: 8, background: inPill ? 'var(--ws-surface-raised)' : 'transparent' }}
                  >
                    <span className="text-[11px] text-zinc-400 capitalize">
                      {kind.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <SettingsSwitch
                      checked={inPill}
                      disabled={!haloPrefs.enabled || !isWidgetVisible(haloPrefs, kind)}
                      label={`Show ${kind} in the collapsed pill`}
                      onChange={(compact) =>
                        void saveHaloPrefs({
                          widgets: { ...haloPrefs.widgets, [kind]: { visible: true, compact } },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div data-section="settings.ai" className="space-y-4">
          <SearchableSection terms={['openrouter', 'api key', 'provider', 'routing', 'daily brief', 'research', 'topics', 'usage', 'cost', 'data access', 'multi-provider']} search={settingsSearch}>
          <GlassCard className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">AI Assistant</h2>
              <p className="text-xs text-zinc-500">Configure AI briefing, weekly review, and research features</p>
            </div>

            {/* API Key */}
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">OpenRouter API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-or-v1-..."
                  value={openRouterApiKey}
                  onChange={(e) => {
                    setOpenRouterApiKey(e.target.value);
                    setApiKeyTestStatus('idle');
                    setHasChanges(true);
                    onHasChangesChange(true);
                  }}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(prev => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">All AI features use this key. Must be an OpenRouter API key.</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={async () => {
                    if (!openRouterApiKey) {
                      setApiKeyTestStatus('error');
                      setApiKeyTestMessage('Please enter an API key first');
                      return;
                    }
                    setApiKeyTestStatus('testing');
                    setApiKeyTestMessage('Testing connection...');
                    try {
                      if (window.deskflowAPI?.setPreference) {
                        await window.deskflowAPI.setPreference('openrouterApiKey', openRouterApiKey);
                      }
                      const result = await window.deskflowAPI?.testOpenRouterKey?.();
                      if (result?.success) {
                        setApiKeyTestStatus('success');
                        setApiKeyTestMessage(`Connected! Model: ${result.model || 'OK'}`);
                      } else {
                        setApiKeyTestStatus('error');
                        setApiKeyTestMessage(result?.error || 'Connection failed');
                      }
                    } catch (err: any) {
                      setApiKeyTestStatus('error');
                      setApiKeyTestMessage(err.message || 'Test failed');
                    }
                  }}
                  disabled={apiKeyTestStatus === 'testing'}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 hover:border-zinc-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  {apiKeyTestStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
                {apiKeyTestStatus === 'success' && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {apiKeyTestMessage}
                  </span>
                )}
                {apiKeyTestStatus === 'error' && (
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {apiKeyTestMessage}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">Any OpenRouter-compatible model slug works — paste the full slug (e.g. <code className="text-zinc-400">openai/gpt-4o</code>)</p>
            </div>

            <div className="pt-4 border-t border-zinc-700/50" />

            {/* Multi-Provider Routing */}
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-1 block">Multi-Provider Routing</label>
              <p className="text-xs text-zinc-500 mb-3">Enable free providers so the Research Digest doesn't need OpenRouter credits. Order controls fallback priority.</p>
              <div className="space-y-2">
                {aiProviders.map((prov, idx) => (
                  <div key={prov.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => {
                          const next = [...aiProviders];
                          if (idx > 0) { [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; }
                          setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                        }}
                        disabled={idx === 0}
                        className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
                      ><ChevronUp className="w-3 h-3" /></button>
                      <span className="text-[10px] text-zinc-600 font-mono">{idx + 1}</span>
                      <button
                        onClick={() => {
                          const next = [...aiProviders];
                          if (idx < next.length - 1) { [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; }
                          setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                        }}
                        disabled={idx === aiProviders.length - 1}
                        className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
                      ><ChevronDown className="w-3 h-3" /></button>
                    </div>
                    <button
                      onClick={() => {
                        const next = aiProviders.map(p => p.id === prov.id ? { ...p, enabled: !p.enabled } : p);
                        setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                      }}
                      className={`shrink-0 relative w-8 h-4.5 rounded-full transition-colors ${prov.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      style={{ height: '18px', width: '32px' }}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform ${prov.enabled ? 'translate-x-3.5' : ''}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-zinc-300">{prov.label}</span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${prov.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700/50 light:bg-zinc-200/50 text-zinc-500'}`}>{prov.enabled ? 'On' : 'Off'}</span>
                      </div>
                      {prov.enabled && (
                        <div className="space-y-1.5 mt-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type={showProviderApiKeys[prov.id] ? 'text' : 'password'}
                              placeholder="API key (leave blank if none needed)"
                              value={prov.apiKey || ''}
                              onChange={(e) => {
                                const next = aiProviders.map(p => p.id === prov.id ? { ...p, apiKey: e.target.value } : p);
                                setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                              }}
                              className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-600 font-mono"
                            />
                            <button
                              onClick={() => setShowProviderApiKeys(prev => ({ ...prev, [prov.id]: !prev[prov.id] }))}
                              className="shrink-0 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              {showProviderApiKeys[prov.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={async () => {
                                setProviderTestStatus(prev => ({ ...prev, [prov.id]: 'testing' }));
                                setProviderTestMessages(prev => ({ ...prev, [prov.id]: 'Testing...' }));
                                console.log(`[Settings] Testing provider: ${prov.id} (${prov.label})`);
                                try {
                                  const res = await window.deskflowAPI?.testAiProvider?.(prov.id);
                                  console.log('[Settings] Test result:', res);
                                  if (res?.success) {
                                    setProviderTestStatus(prev => ({ ...prev, [prov.id]: 'success' }));
                                    setProviderTestMessages(prev => ({ ...prev, [prov.id]: 'OK' }));
                                  } else {
                                    setProviderTestStatus(prev => ({ ...prev, [prov.id]: 'error' }));
                                    setProviderTestMessages(prev => ({ ...prev, [prov.id]: res?.error || 'Failed' }));
                                    console.error('[Settings] Provider test failed:', res?.error);
                                  }
                                } catch (err: any) {
                                  setProviderTestStatus(prev => ({ ...prev, [prov.id]: 'error' }));
                                  setProviderTestMessages(prev => ({ ...prev, [prov.id]: err.message }));
                                  console.error('[Settings] Provider test error:', err.message);
                                }
                              }}
                              disabled={providerTestStatus[prov.id] === 'testing'}
                              className="shrink-0 px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 text-zinc-300 rounded transition-colors"
                            >
                              {providerTestStatus[prov.id] === 'testing' ? '...' : 'Test'}
                            </button>
                            {providerTestStatus[prov.id] === 'success' && <Check className="shrink-0 w-3 h-3 text-emerald-400" />}
                            {providerTestStatus[prov.id] === 'error' && <AlertTriangle className="shrink-0 w-3 h-3 text-red-400" />}
                            {providerTestStatus[prov.id] === 'error' && (
                              <span className="text-[10px] text-red-400 truncate max-w-[160px]" title={providerTestMessages[prov.id]}>
                                {providerTestMessages[prov.id]}
                              </span>
                            )}
                          </div>
                          {prov.templateId === 'cloudflare' && (
                            <div className="flex items-center gap-2">
                               <input
                                type="text"
                                placeholder="Cloudflare Account ID (required)"
                                value={prov.extraConfig?.cloudflareAccountId || ''}
                                onChange={(e) => {
                                  const next = aiProviders.map(p => p.id === prov.id ? { ...p, extraConfig: { ...p.extraConfig, cloudflareAccountId: e.target.value } } : p);
                                  setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                                }}
                                className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-600 font-mono"
                              />
                              <a
                                href="https://dash.cloudflare.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-400 hover:text-blue-300 shrink-0"
                              >Find ID</a>
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1">
                              {(prov.models || []).map((m: string, mi: number) => (
                                <span key={mi} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 border border-zinc-700/50 rounded text-zinc-300 group">
                                  {m}
                                  <button
                                    onClick={() => {
                                      const next = aiProviders.map(p =>
                                        p.id === prov.id
                                          ? { ...p, models: (p.models || []).filter((_: string, i: number) => i !== mi) }
                                          : p
                                      );
                                      setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                                    }}
                                    className="text-zinc-600 hover:text-red-400 transition-colors"
                                  >×</button>
                                </span>
                              ))}
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="Add model..."
                                  value={((prov as any)._newModel) || ''}
                                  onChange={(e) => {
                                    const next = aiProviders.map(p =>
                                      p.id === prov.id ? { ...p, _newModel: e.target.value } as any : p
                                    );
                                    setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && ((prov as any)._newModel || '').trim()) {
                                      const val = ((prov as any)._newModel || '').trim();
                                      const next = aiProviders.map(p =>
                                        p.id === prov.id
                                          ? { ...p, models: [...(p.models || []), val], _newModel: '' }
                                          : p
                                      );
                                      setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                                    }
                                  }}
                                  className="w-24 px-1.5 py-0.5 text-[10px] bg-zinc-800 border border-zinc-700/30 rounded-lg text-white placeholder-zinc-600 font-mono"
                                />
                                <button
                                  onClick={() => {
                                    const val = ((prov as any)._newModel || '').trim();
                                    if (!val) return;
                                    const next = aiProviders.map(p =>
                                      p.id === prov.id
                                        ? { ...p, models: [...(p.models || []), val], _newModel: '' }
                                        : p
                                    );
                                    setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 light:bg-zinc-200/50 rounded transition-colors"
                                >+</button>
                              </div>
                            </div>
                              <input
                                type="text"
                                placeholder="Base URL (optional)"
                                value={prov.baseUrl || ''}
                                onChange={(e) => {
                                  const next = aiProviders.map(p => p.id === prov.id ? { ...p, baseUrl: e.target.value } : p);
                                  setAiProviders(next); setHasChanges(true); onHasChangesChange(true);
                                }}
                                className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-600 font-mono"
                              />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-2">Providers configured here are available as presets on the AI Assistant page, where you can assign a specific provider + model per feature (Digest, Daily Plan).</p>
            </div>

            <div className="pt-4 border-t border-zinc-700/50" />

            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm font-medium text-zinc-300">Auto-generate daily brief on start</label>
                <p className="text-xs text-zinc-500">Generate a daily briefing in the background when the app opens</p>
              </div>
              <button
                onClick={() => {
                  setAiConfig(prev => ({ ...prev, autoGenerateBrief: !prev.autoGenerateBrief }));
                  setHasChanges(true);
                  onHasChangesChange(true);
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${aiConfig.autoGenerateBrief ? 'bg-violet-500' : 'bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${aiConfig.autoGenerateBrief ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="pt-4 border-t border-zinc-700/50" />

            {/* Interest Topics */}
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Research Topics</label>
              <p className="text-xs text-zinc-500 mb-3">Topics you want AI to research daily digests for</p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newTopic.trim()) {
                      const topic = newTopic.trim();
                      if (window.deskflowAPI?.addInterestTopic) {
                        await window.deskflowAPI.addInterestTopic(topic);
                      }
                      setInterestTopics(prev => [...prev, topic]);
                      setNewTopic('');
                      setHasChanges(true);
                      onHasChangesChange(true);
                    }
                  }}
                  placeholder="e.g., Artificial Intelligence"
                  className="flex-1 px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500"
                />
                <button
                  onClick={async () => {
                    if (newTopic.trim()) {
                      const topic = newTopic.trim();
                      if (window.deskflowAPI?.addInterestTopic) {
                        await window.deskflowAPI.addInterestTopic(topic);
                      }
                      setInterestTopics(prev => [...prev, topic]);
                      setNewTopic('');
                    }
                  }}
                  disabled={!newTopic.trim()}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {interestTopics.map((topic, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                    style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                  >
                    {topic}
                    <button
                      onClick={async () => {
                        if (window.deskflowAPI?.removeInterestTopic) {
                          await window.deskflowAPI.removeInterestTopic(topic);
                        }
                        setInterestTopics(prev => prev.filter(t => t !== topic));
                      }}
                      className="ml-0.5 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {interestTopics.length === 0 && (
                  <p className="text-xs text-zinc-500 italic">No topics added yet</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-700/50" />

            {/* Knowledge Base (R5: self-contained RAG) */}
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Knowledge Base</label>
              <p className="text-xs text-zinc-500 mb-3">
                Upload notes or documents (txt/md) — the AI assistant retrieves the most relevant sections when answering you.
              </p>
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                multiple
                ref={kbFileInputRef}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (files.length === 0) return;
                  setKbIngesting(true);
                  let ingested = 0;
                  for (const file of files) {
                    try {
                      const content = await file.text();
                      const ext = file.name.split('.').pop()?.toLowerCase();
                      const type = ext === 'md' ? 'md' : ext === 'txt' ? 'txt' : 'txt';
                      if (window.deskflowAPI?.kbIngest) {
                        const r = await window.deskflowAPI.kbIngest({ name: file.name, type, content });
                        if (r?.success) ingested++;
                      }
                    } catch (err) {
                      console.error('[Settings] KB ingest failed:', err);
                    }
                  }
                  setKbIngesting(false);
                  if (ingested > 0) {
                    setHasChanges(true);
                    onHasChangesChange(true);
                    if (window.deskflowAPI?.kbList) {
                      try {
                        const docs = await window.deskflowAPI.kbList();
                        if (Array.isArray(docs)) setKbDocs(docs);
                      } catch { /* ignore */ }
                    }
                  }
                }}
                className="hidden"
              />
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => kbFileInputRef.current?.click()}
                  disabled={kbIngesting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 disabled:opacity-40 transition-colors"
                >
                  {kbIngesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {kbIngesting ? 'Importing…' : 'Import files'}
                </button>
                {kbDocs.length > 0 && (
                  <span className="text-xs text-zinc-500">{kbDocs.length} document{kbDocs.length === 1 ? '' : 's'}</span>
                )}
              </div>
              {kbDocs.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {kbDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] light:bg-white/30 border border-zinc-700/30">
                      <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span className="text-xs text-zinc-300 truncate flex-1" title={doc.name}>{doc.name}</span>
                      <span className="text-[10px] text-zinc-500 uppercase shrink-0">{doc.type}</span>
                      <button
                        onClick={async () => {
                          if (window.deskflowAPI?.kbRemove) {
                            await window.deskflowAPI.kbRemove(doc.id);
                            setKbDocs(prev => prev.filter(d => d.id !== doc.id));
                          }
                        }}
                        className="shrink-0 text-zinc-500 hover:text-rose-400 transition-colors"
                        title={`Remove ${doc.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={kbQueryText}
                  onChange={(e) => setKbQueryText(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && kbQueryText.trim() && window.deskflowAPI?.kbQuery) {
                      setKbQuerying(true);
                      try {
                        const results = await window.deskflowAPI.kbQuery(kbQueryText.trim(), 3);
                        setKbResults(results || []);
                      } catch { setKbResults([]); }
                      setKbQuerying(false);
                    }
                  }}
                  placeholder="Test retrieval — type a question about your notes…"
                  className="flex-1 px-3 py-2 text-sm bg-zinc-800/50 light:bg-zinc-100/50 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500"
                />
                <button
                  onClick={async () => {
                    if (!kbQueryText.trim() || !window.deskflowAPI?.kbQuery) return;
                    setKbQuerying(true);
                    try {
                      const results = await window.deskflowAPI.kbQuery(kbQueryText.trim(), 3);
                      setKbResults(results || []);
                    } catch { setKbResults([]); }
                    setKbQuerying(false);
                  }}
                  disabled={!kbQueryText.trim() || kbQuerying}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 disabled:opacity-40 transition-colors"
                >
                  {kbQuerying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SearchX className="w-3.5 h-3.5" />}
                </button>
              </div>
              {kbResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {kbResults.map((r, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] light:bg-white/30 border border-zinc-700/30">
                      <div className="text-[10px] text-violet-400 mb-1 truncate">{r.docName}</div>
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-700/50" />

            {/* Usage Stats */}
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Usage</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl p-3 border border-zinc-700/30">
                  <div className="text-xs text-zinc-500 mb-1">Total API Calls</div>
                  <div className="text-lg font-semibold text-white">{aiUsageStats.totalCalls}</div>
                </div>
                <div className="bg-zinc-800/40 light:bg-zinc-100/40 rounded-xl p-3 border border-zinc-700/30">
                  <div className="text-xs text-zinc-500 mb-1">Estimated Cost</div>
                  <div className="text-lg font-semibold text-white">${aiUsageStats.totalCost.toFixed(4)}</div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-700/50" />

            {/* Data Access */}
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Data Access</label>
              <p className="text-xs text-zinc-500 mb-3">Control which data categories the AI Assistant can read when answering your questions.</p>
              <div className="space-y-2">
                {[
                  { key: 'projects', label: 'Projects', desc: 'Project names, paths, health scores, commit stats' },
                  { key: 'problems', label: 'Problems', desc: 'Tracked bugs, issues, and their statuses' },
                  { key: 'requests', label: 'Requests', desc: 'Feature requests and their details' },
                  { key: 'aiUsage', label: 'AI Usage', desc: 'Token usage, costs, and tool usage stats' },
                  { key: 'dashboardStats', label: 'Dashboard Stats', desc: 'App activity, focus time, hourly stats' },
                  { key: 'goals', label: 'Goals', desc: 'Daily goals, long-term goals, and reviews' },
                  { key: 'checklist', label: 'Checklists', desc: 'Checklist items on problems and requests' },
                  { key: 'prompts', label: 'Prompts', desc: 'Agent prompts, status, and progress' },
                  { key: 'finance', label: 'Finance', desc: 'Wallets, transactions, balances, and crypto' },
                  { key: 'connectors', label: 'Connectors', desc: 'Email, calendar, and other external synced data' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-zinc-300">{item.label}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{item.desc}</div>
                    </div>
                    <button
                      onClick={async () => {
                        const next = { ...dataAccess, [item.key]: !dataAccess[item.key] };
                        setDataAccess(next);
                        if (window.deskflowAPI?.setPreference) {
                          await window.deskflowAPI.setPreference('ai_dataAccess', JSON.stringify(next));
                        }
                      }}
                      className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${dataAccess[item.key] !== false ? 'bg-violet-500' : 'bg-zinc-700'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${dataAccess[item.key] !== false ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-3">When a category is disabled, the AI will return a privacy notice instead of the data. The AI Chat toggle is separate — it controls the chat UI visibility, not data access.</p>
            </div>

            <div className="pt-4 border-t border-zinc-700/50" />

            {/* AI Agent Colors */}
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Agent Colors</label>
              <p className="text-xs text-zinc-500 mb-3">Customize colors for each AI agent in charts and the donut distribution.</p>
              <div className="space-y-2">
                {Object.entries({
                  'opencode': { name: 'OpenCode', default: '#3b82f6' },
                  'claude-code': { name: 'Claude Code', default: '#f97316' },
                  'gemini': { name: 'Gemini CLI', default: '#22c55e' },
                  'codex': { name: 'Codex CLI', default: '#10b981' },
                  'qwen': { name: 'Qwen CLI', default: '#f59e0b' },
                  'cursor': { name: 'Cursor AI', default: '#a855f7' },
                  'kilocode': { name: 'KiloCode', default: '#22c55e' },
                  'aider': { name: 'Aider', default: '#f59e0b' },
                }).map(([id, info]) => {
                  const currentColor = agentColorOverrides[id] || info.default;
                  return (
                    <div key={id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-zinc-600" style={{ backgroundColor: currentColor }} />
                        <div>
                          <div className="text-xs font-medium text-zinc-300">{info.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{currentColor}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentColor}
                          onChange={(e) => {
                            const next = { ...agentColorOverrides, [id]: e.target.value };
                            setAgentColorOverrides(next);
                            setHasChanges(true);
                            onHasChangesChange(true);
                          }}
                          className="w-8 h-6 rounded-lg border border-zinc-600 bg-transparent cursor-pointer"
                        />
                        {agentColorOverrides[id] && (
                          <button
                            onClick={() => {
                              const next = { ...agentColorOverrides };
                              delete next[id];
                              setAgentColorOverrides(next);
                              setHasChanges(true);
                              onHasChangesChange(true);
                            }}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Reset to default"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {activeTab === 'ai' && (
        <div data-section="settings.ai.diagnostics" className="space-y-4">
          <SearchableSection terms={['diagnostics', 'provider diagnostics']} search={settingsSearch}>
          <GlassCard>
            <ProviderDiagnostics />
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {activeTab === 'finance' && (
        <div data-section="settings.finance" className="space-y-4">
          <SearchableSection terms={['currency', 'finance', 'auto-save', 'security', 'password', 'lock', 'masking', 'balance', 'recalculate']} search={settingsSearch}>
          <GlassCard className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Finance Currency</h2>
                <p className="text-xs text-zinc-500">Set the base display currency for the finance page</p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-700/50" />

            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Base Currency</label>
              <p className="text-xs text-zinc-500 mb-3">This currency is used as the default display currency on the finance page and persists across app restarts. You can also change it temporarily from the finance page.</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                {[
                  { code: 'USD', symbol: '$', name: 'US Dollar' },
                  { code: 'IDR', symbol: 'Rp', name: 'Rupiah' },
                  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
                  { code: 'GBP', symbol: '£', name: 'Pound' },
                  { code: 'EUR', symbol: '€', name: 'Euro' },
                  { code: 'JPY', symbol: '¥', name: 'Yen' },
                  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
                  { code: 'CNY', symbol: '¥', name: 'Yuan' },
                  { code: 'KRW', symbol: '₩', name: 'Won' },
                  { code: 'INR', symbol: '₹', name: 'Rupee' },
                  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
                  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
                  { code: 'MYR', symbol: 'RM', name: 'Ringgit' },
                  { code: 'PHP', symbol: '₱', name: 'Peso' },
                  { code: 'THB', symbol: '฿', name: 'Baht' },
                  { code: 'VND', symbol: '₫', name: 'Dong' },
                  { code: 'BRL', symbol: 'R$', name: 'Real' },
                ].map(c => (
                  <button
                    key={c.code}
                    onClick={() => handleSetFinanceCurrency(c.code)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs transition-colors ${financeCurrency === c.code
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-800/50 light:bg-zinc-100/50 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700/50'
                      }`}
                    title={c.name}
                  >
                    <span className="text-sm font-medium">{c.symbol}</span>
                    <span className="text-[10px]">{c.code}</span>
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Save className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Finance Auto-Save</h2>
                <p className="text-xs text-zinc-500">Automatically save changes to wallets and transactions</p>
              </div>
            </div>
            <div className="pt-2 border-t border-zinc-700/50" />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-zinc-400">Auto-save wallet changes</span>
                <p className="text-[10px] text-zinc-600 mt-0.5">When on, changes to wallets save automatically. When off, you'll be prompted to save before leaving.</p>
              </div>
              <button
                onClick={() => {
                  const next = !autoSave;
                  setAutoSave(next);
                  window.deskflowAPI?.financeSetAutoSave?.(next);
                }}
                className={`w-10 h-5 rounded-full transition-colors ${autoSave ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${autoSave ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Balance Auto-Recalculate</h2>
                <p className="text-xs text-zinc-500">Automatically verify wallet balances after each transaction</p>
              </div>
            </div>
            <div className="pt-2 border-t border-zinc-700/50" />
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-zinc-400">Auto-recalculate on transaction</span>
                <p className="text-[10px] text-zinc-600 mt-0.5">When on, wallet balances are silently verified after adding, deleting, or editing a transaction. Off = faster but balances may drift.</p>
              </div>
              <button
                onClick={() => {
                  const next = !autoRecalc;
                  setAutoRecalc(next);
                  window.deskflowAPI?.financeSetAutoRecalc?.(next);
                }}
                className={`w-10 h-5 rounded-full transition-colors ${autoRecalc ? 'bg-violet-500' : 'bg-zinc-700'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${autoRecalc ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </GlassCard>

          {securitySettings && (
            <GlassCard className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Finance Security</h2>
                  <p className="text-xs text-zinc-500">Lock timeout, device remembering, and password</p>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-700/50" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Remember device</span>
                  <button
                    onClick={() => handleSetRememberDevice(!securitySettings.rememberDevice, 7)}
                    className={`w-10 h-5 rounded-full transition-colors ${securitySettings.rememberDevice ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${securitySettings.rememberDevice ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Lock timeout</span>
                  <select
                    value={securitySettings.lockTimeout / (60 * 1000)}
                    onChange={(e) => handleSetLockTimeout(parseInt(e.target.value) * 60 * 1000)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-1.5 py-0.5 text-[10px] text-zinc-300"
                  >
                    <option value="1">1 min</option>
                    <option value="5">5 min</option>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Masking mode</span>
                  <select
                    value={maskMode}
                    onChange={(e) => setMaskMode(e.target.value as MaskMode)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-1.5 py-0.5 text-[10px] text-zinc-300"
                  >
                    <option value="digits">Same digit count</option>
                    <option value="fixed">Fixed number</option>
                  </select>
                </div>
                {maskMode === 'fixed' && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">Display value</span>
                    <input
                      type="number"
                      value={maskFixedValue}
                      onChange={(e) => setMaskFixedValue(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-1.5 py-0.5 text-[10px] text-zinc-300 text-right"
                    />
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {securitySettings && (
            <GlassCard className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${securitySettings.hasPassword ? 'bg-red-500/15' : 'bg-zinc-700/30'}`}>
                  <Shield className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Password Protection</h2>
                  <p className="text-xs text-zinc-500">Choose which actions require password confirmation{!securitySettings.hasPassword ? ' (set a password first)' : ''}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-700/50" />
              <div className="space-y-3">
                {[
                  { key: 'password_req_delete_account', label: 'Delete accounts' },
                  { key: 'password_req_delete_wallet', label: 'Delete wallets' },
                  { key: 'password_req_delete_transaction', label: 'Delete transactions' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">{item.label}</span>
                    <button
                      onClick={() => {
                        const next = !passwordReqs[item.key];
                        setPasswordReqs(prev => ({ ...prev, [item.key]: next }));
                        setHasChanges(true);
                        onHasChangesChange(true);
                      }}
                      className={`w-10 h-5 rounded-full transition-colors ${passwordReqs[item.key] ? 'bg-emerald-500' : 'bg-zinc-700'
                        }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${passwordReqs[item.key] ? 'translate-x-5' : ''
                        }`} />
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {!securitySettings?.hasPassword && (
            <GlassCard className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Key className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Set Password</h2>
                  <p className="text-xs text-zinc-500">Set a master password to protect your finance page</p>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-700/50" />
              <div className="space-y-3">
                {securitySettings?.hasPassword && (
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                    placeholder="Current password"
                    className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                  />
                )}
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                  placeholder="New password"
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                  placeholder="Confirm password"
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                />
                {passwordError && <p className="text-[11px] text-red-400">{passwordError}</p>}
                {passwordSuccess && <p className="text-[11px] text-emerald-400">{passwordSuccess}</p>}
                <button
                  onClick={handleChangePassword}
                  disabled={securitySettings?.hasPassword ? (!currentPassword || !newPassword || !confirmPassword) : (!newPassword || !confirmPassword)}
                  className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-colors disabled:opacity-40"
                >
                  Set Password
                </button>
              </div>
            </GlassCard>
          )}

          {securitySettings?.hasPassword && (
            <GlassCard className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <Key className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Change Password</h2>
                  <p className="text-xs text-zinc-500">Update your finance page password</p>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-700/50" />
              <div className="space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                  placeholder="Current password"
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                  placeholder="New password"
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                  placeholder="Confirm new password"
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                />
                {passwordError && <p className="text-[11px] text-red-400">{passwordError}</p>}
                {passwordSuccess && <p className="text-[11px] text-emerald-400">{passwordSuccess}</p>}
                <button
                  onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                  className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors disabled:opacity-40"
                >
                  Update Password
                </button>
              </div>
            </GlassCard>
          )}
          </SearchableSection>
        </div>
      )}

      {activeTab === 'auth' && (
        <div data-section="settings.auth" className="space-y-4">
          <SearchableSection terms={['auth', 'login', 'register', 'sync', 'password']} search={settingsSearch}>
            <AuthSettings />
          </SearchableSection>
        </div>
      )}

      {activeTab === 'devices' && (
        <div data-section="settings.devices" className="space-y-4">
          <SearchableSection terms={['devices', 'device']} search={settingsSearch}>
          <PhoneStatsPanel />
          </SearchableSection>
          <SearchableSection terms={['devices', 'device']} search={settingsSearch}>
          <DevicesPanel />
          </SearchableSection>
        </div>
      )}

      {activeTab === 'shortcuts' && (
        <div data-section="settings.shortcuts" className="space-y-4">
          {/* Navigation mode. Split out of ShortcutSection.tsx because that file
              is dead code — it is imported nowhere, and SettingsPage renders the
              shortcuts tab inline. Its `SearchableSection` terms are widened so
              the mode is findable by typing "film", "palette" or "navigation". */}
          {/* `group` (not `terms`): the synonyms live in settings/registry, so a
              word added there is searchable here with no edit to this file. */}
          <SearchableSection group="nav-mode" search={settingsSearch}>
            <RewindNavSetting />
          </SearchableSection>

          <SearchableSection terms={['shortcut', 'keybind', 'hotkey', 'keyboard', 'key', 'bind', 'ctrl', 'command']} search={settingsSearch}>
          <GlassCard className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h2>
              <p className="text-xs text-zinc-500">Customize keyboard shortcuts for app actions</p>
            </div>

            {/* Grouped shortcuts */}
            {(() => {
              const groups: Record<string, [string, { label: string; description: string; group: string }][]> = {};
              Object.entries(shortcuts).forEach(([key, shortcut]) => {
                const config = SHORTCUT_CONFIG[key];
                if (!config) return;
                const g = config.group || 'Other';
                if (!groups[g]) groups[g] = [];
                groups[g].push([key, config]);
              });
              return Object.entries(groups).map(([groupName, items]) => (
                <div key={groupName} className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-3 mb-1">{groupName}</h3>
                  {items.map(([key, config]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-zinc-700/20 last:border-0">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-sm font-medium text-zinc-200">{config.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{config.description}</div>
                      </div>
                      <button
                        onClick={() => startRecording(key)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono transition-colors duration-150 ${recordingKey === key
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200'
                          }`}
                      >
                        {recordingKey === key ? (
                          <span className="animate-pulse text-xs">Recording...</span>
                        ) : (
                          <>
                            <Key className="w-3.5 h-3.5" />
                            <span className="text-xs">{shortcuts[key] || '—'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ));
            })()}

            {typeof shortcuts !== 'object' || !Object.keys(shortcuts).length ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                Failed to load shortcuts. Using defaults.
              </div>
            ) : null}

            <div className="pt-4 border-t border-zinc-700/30">
              <button
                onClick={restoreDefaults}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Restore Defaults
              </button>
            </div>
          </GlassCard>
          </SearchableSection>
        </div>
      )}

      {activeTab === 'database' && (
        <div data-section="settings.database"
             className="flex flex-col gap-3"
             /* A DEFINITE height is what makes the database list scroll internally.
                 With `minHeight:0` alone this box sized to `auto`, so `DatabasePage`'s root `h-full` resolved against an auto parent,
                 the whole flex chain went unbounded, and the table list's `overflow-y-auto` had nothing to scroll inside — every table
                 stacked into the page and you had to scroll Settings to the
                 bottom to reach one. */
             style={{ minHeight: 0, height: 'min(78vh, 900px)' }}>
          {/* The Schema(ERD)/Data toggle is gone: `DatabasePage` already owns
              ERD, Architecture, Browse and Recent Changes as its own tabs, so
              this rendered the ERD twice — once bare via `ErdCanvas` and once
              inside Data. One surface, one place for the ERD. */}
          <Suspense fallback={<div className="py-24 flex items-center justify-center text-zinc-500 text-sm">Loading database…</div>}>
            <DatabasePage />
          </Suspense>
        </div>
      )}

      {/* Discord-style Bottom Save Bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-md border-t border-zinc-700/50 shadow-black/50"
          >
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm text-zinc-300">
                    {/* HONEST COPY. This bar now appears for BOTH kinds of change, so it must
                     * not claim every one of them is unsaved.
                     *
                     * `saveHaloPrefs` and friends write through `setPreference` the instant
                     * they change — there is nothing pending to save. The staged group is
                     * narrower: tier assignments, planet colours and category order, which
                     * live in localStorage until this bar's action persists them. Calling the
                     * whole thing "unsaved changes" when most of it is already committed is how
                     * a user ends up clicking Save repeatedly, or distrusting the page. */}
                    <span className="text-zinc-400">
                      {hasStagedChanges ? 'You have unsaved changes' : 'Settings applied'}
                    </span>
                    {hasStagedChanges && (
                      <span className="ml-2 text-xs text-zinc-500">
                        Tier assignments and colours are saved when you press Save.
                      </span>
                    )}
                  </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setTierAssignments(() => {
                      if (typeof window !== 'undefined') {
                        const saved = localStorage.getItem('deskflow-tier-assignments');
                        if (saved) {
                          try { return JSON.parse(saved); } catch { /* ignore */ }
                        }
                      }
                      return DEFAULT_TIER_ASSIGNMENTS;
                    });
                    setLocalAppColors(() => {
                      if (typeof window !== 'undefined') {
                        const saved = localStorage.getItem('deskflow-planet-colors');
                        if (saved) {
                          try { return JSON.parse(saved); } catch { /* ignore */ }
                        }
                      }
                      return appColors;
                    });
                    setLocalCategoryOrder(categoryOrder);
                    setAppCategoryOverrides({});
                    setDomainCategoryOverrides({});
                    setFinanceCurrency(originalFinanceCurrency);
                    setSecuritySettings(originalSecuritySettings);
                    setHasChanges(false);
                    onHasChangesChange(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={saveChanges}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors duration-150 shadow-emerald-500/25 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  OK
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved confirmation popup */}
      <AnimatePresence>
        {savedNotice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-[60] bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-4 py-3 flex items-center gap-2 shadow-lg"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-emerald-300 font-medium">Settings saved</span>
          </motion.div>
        )}
      </AnimatePresence>

    </PageShell>
  );
}

/* Halo settings — the live preview pieces.
 *
 * WHY A PREVIEW AND NOT A DESCRIPTION
 * -----------------------------------
 * The shape control was three text buttons reading "Fully rounded, floats free" /
 * "Top corners only, hugs the edge" / "8px on every corner". Every one of those is a
 * CLAIM about a picture, and the user has to hold the claim in their head and trust it.
 * A shape is a single glance. So each option now DRAWS its own shape, at the real
 * proportion (232x40 compact), and the "Custom" row draws the actual radius the slider
 * is currently set to. Nothing to interpret.
 *
 * The same reasoning gives the placement diagram: "Left edge" is a word, but where the
 * island actually lands on a 16:9 screen is not, and it is the thing you cannot check
 * by reading.
 *
 * Every preview reads live from `haloPrefs`, so moving a slider moves the picture. A
 * preview that does not update is a screenshot, and a screenshot cannot be a control.
 */


/**
 * The preview scale.
 *
 * WHY THE PREVIEWS USED TO LIE
 * ----------------------------
 * The pill preview was hardcoded to 116x20, the placement frame to 260px, and the shape
 * swatch to a 20px bar — all fixed numbers chosen when the default scale was 1.00. Drag the
 * Size slider to 1.60 and the drawing stayed exactly the same size, so the preview showed a
 * 232px island that the user was about to make 371px. A preview that does not move when the
 * thing it previews moves is a decoration, and it is worse than none because it is trusted.
 *
 * Every preview now derives its geometry from this one factor, which is the user's `scale`
 * preference multiplied by PREVIEW_ZOOM. PREVIEW_ZOOM exists because the real 232px pill is
 * far too wide to sit inside a settings panel next to its own labels; the zoom is a pure
 * presentation scale and never affects the ratio, which is the thing being communicated.
 */
const PREVIEW_ZOOM = 0.5;

function previewScale(scale: number): number {
  const n = Number.isFinite(scale) ? scale : 1;
  return Math.min(1.6, Math.max(0.7, n)) * PREVIEW_ZOOM;
}

/** Draws one shape option as the shape itself. */
function HaloShapeSwatch({
  shape,
  radius,
  scaleScale,
  active,
  disabled,
  label,
  hint,
  onClick,
}: {
  shape: HaloPrefs['shape'];
  radius: number;
  scaleScale: number;
  active: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  /* Mirrors shellRadii() for the swatch: 'notch' rounds the edge it sits on, and a
   * 40px-tall pill is fully rounded at any radius past ~20. Kept deliberately in sync
   * with HaloPreferences rather than imported, because this is a 1-glyph approximation
   * and pulling the real function in here would drag the whole island module into a
   * settings panel. The PROBE on shape is what keeps them honest. */
  const r =
    shape === 'custom'
      ? Math.min(48, radius)
      : shape === 'square'
        ? 4
        : shape === 'notch'
          ? '4px 4px 0 0'
          : 9999;

  /* Height tracks the real compact height (40px at scale 1) rather than a fixed 20px, so
   * swatches grow and shrink with the Size slider like the island does. The width is the
   * 5.8:1 compact ratio so the silhouette is honest at every scale. */
  /* This component takes EXPLICIT PROPS. It has no `prefs` binding and no `haloPrefs` binding —
   * both threw `ReferenceError` on every render of the Halo section (first `prefs.scale`, then
   * `haloPrefs.scale` when I "fixed" it by reaching one scope out). The island's stored scale is
   * ALREADY passed in as `scaleScale`, so use it. A component reads its own props or it is not a
   * component. */
  const barH = Math.round(resolveHaloSize(scaleScale).compactHeight * previewScale(scaleScale));
  const barW = Math.round(HALO_SIZE_TOKENS.compactWidth * previewScale(scaleScale) * 0.62);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`${label}. ${hint}`}
      disabled={disabled}
      onClick={onClick}
      className="text-left disabled:opacity-40"
      style={{
        padding: 8,
        borderRadius: 8,
        /* Selection is a STRONGER HAIRLINE, not a hue (design.md 2: monochrome chrome). */
        border: `1px solid ${active ? 'var(--text-secondary)' : 'var(--ws-border)'}`,
        background: active ? 'var(--ws-surface-raised)' : 'transparent',
      }}
    >
      {/* The shape, drawn at the real compact proportion. */}
      <div
        aria-hidden="true"
        style={{
          height: barH,
          width: barW,
          borderRadius: r,
          /* The island's OWN signal colour, amber (halo.css:38). Showing the settings page
             accent here would make the preview describe something the user will not get. */
          background: active ? 'var(--color-amber-400)' : 'var(--ws-border-strong)',
          marginBottom: 6,
          opacity: active ? 1 : 0.7,
        }}
      />
      <div className="text-[11px]" style={{ color: 'var(--text-primary)' }}>
        {label}
      </div>
      <div className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--text-disabled)' }}>
        {hint}
      </div>
    </button>
  );
}

/**
 * Where the island lands, drawn on a miniature screen.
 *
 * The frame is 16:9 because that is the common case and because a wrong aspect ratio
 * would misrepresent how much of the screen the island occupies. The island is drawn
 * FLUSH to the edge it is attached to, which is the entire point of the control — the
 * old version moved the native window but the renderer ignored the edge, so the
 * diagram would have been showing a promise the code did not keep.
 */
function HaloPlacementPreview({ prefs }: { prefs: HaloPrefs }) {
  const edge = prefs.edge;
  /* The island's footprint on screen, as a fraction of the frame. Derived rather than
   * guessed: 232px wide is 11.3% of a 2048px display and 17px of a 1440px one, so the
   * honest fraction depends on the scale the user picked. A constant here would show a
   * 1.6x island at the same footprint as a 0.7x one. */
  const frac = (232 * prefs.scale) / 2048;
  const barPx = Math.max(5, Math.round(frac * 260 * 3));
  const island = {
    top: { left: `${Math.round((1 - frac) * 50)}%`, width: `${Math.max(4, frac * 100)}%` },
    left: { top: `${Math.round((1 - (40 * prefs.scale) / 900) * 50)}%`, height: `${Math.max(3, (40 * prefs.scale) / 900 * 100)}%` },
    right: { top: `${Math.round((1 - (40 * prefs.scale) / 900) * 50)}%`, height: `${Math.max(3, (40 * prefs.scale) / 900 * 100)}%` },
  } as const;

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto"
      style={{
        width: '100%',
        maxWidth: 260,
        aspectRatio: '16 / 9',
        borderRadius: 8,
        border: '1px solid var(--ws-border)',
        background: 'var(--ws-surface)',
      }}
    >
      {/* Fills the frame so the island reads as ON something. */}
      <div className="absolute inset-0" style={{ borderRadius: 7 }} />
      <div
        style={{
          position: 'absolute',
          background: 'var(--color-amber-400)',
          borderRadius: 3,
          ...(edge === 'top'
            ? { top: 0, left: island.top.left, width: island.top.width, height: barPx }
            : edge === 'left'
              ? { left: 0, top: island.left.top, width: barPx, height: island.left.height }
              : { right: 0, top: island.right.top, width: barPx, height: island.right.height }),
        }}
      />
      <span
        className="absolute text-[9px]"
        style={{
          color: 'var(--text-disabled)',
          ...(edge === 'top'
            ? { top: 11, left: '38%' }
            : edge === 'left'
              ? { left: 11, top: '52%' }
              : { right: 11, top: '52%' }),
        }}
      >
        Halo
      </span>
    </div>
  );
}

/**
 * The compact pill at true aspect, with one dot per opted-in widget.
 *
 * 232x40 is a 5.8:1 ratio, so it is drawn at 116x20 — exactly half. Anything else
 * would misrepresent how crowded the pill is, which is the whole question this control
 * answers: "does everything I picked still fit?"
 */
function HaloPillPreview({ prefs }: { prefs: HaloPrefs }) {
  const dots = prefs.compactStyle === 'off'
    ? []
    : (prefs.order ?? []).filter(
        (k) => isWidgetVisible(prefs, k) && prefs.widgets?.[k]?.compact !== false,
      );
  const cap = 3;
  const shown = dots.slice(0, cap);
  const overflow = dots.length - shown.length;

  /* EVERY dimension is derived, not chosen. The pill is 232x40 at scale 1 and keeps its
   * 5.8:1 ratio at any scale, so a wider island genuinely looks wider here — which is the
   * only way the user can tell whether their picks still fit before they leave the panel. */
  const k = previewScale(prefs.scale);
  const w = Math.round(HALO_SIZE_TOKENS.compactWidth * k);
  const h = Math.round(resolveHaloSize(prefs.scale).compactHeight * k);
  const padX = Math.round(10 * k);
  const padY = Math.round(4 * k);
  const heroW = Math.round(26 * k);
  const heroH = Math.max(3, Math.round(6 * k));
  const dot = Math.max(3, Math.round(4 * k));
  const gap = Math.max(2, Math.round(3 * k));

  return (
    <div className="flex justify-center" style={{ marginTop: 6, marginBottom: 8 }}>
      <div
        aria-hidden="true"
        title={`${Math.round(HALO_SIZE_TOKENS.compactWidth)}×${resolveHaloSize(prefs.scale).compactHeight}px (${resolveHaloSize(prefs.scale).label})`}
        style={{
          position: 'relative',
          width: w,
          height: h,
          borderRadius:
            prefs.shape === 'square' ? 4 : prefs.shape === 'notch' ? '4px 4px 0 0' : 9999,
          background: 'var(--ws-surface-raised)',
          border: '1px solid var(--ws-border-strong)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: padX,
            top: Math.round((h - heroH) / 2),
            width: heroW,
            height: heroH,
            borderRadius: 2,
            background: 'var(--color-amber-400)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: padX,
            top: Math.round((h - Math.max(dot, 8)) / 2),
            display: 'flex',
            gap,
            alignItems: 'center',
          }}
        >
          {shown.map((k2) => (
            <span
              key={`pv-${k2}`}
              style={{ width: dot, height: dot, borderRadius: 9999, background: 'var(--text-disabled)' }}
            />
          ))}
          {overflow > 0 && (
            <span style={{ fontSize: Math.max(8, 9 * k), color: 'var(--text-disabled)' }}>+{overflow}</span>
          )}
          {dots.length === 0 && (
            <span style={{ fontSize: Math.max(8, 9 * k), color: 'var(--text-disabled)' }}>—</span>
          )}
        </div>
      </div>
      {/* The real dimensions, so the number is never something you have to infer. */}
      <span
        className="font-mono tabular-nums"
        style={{ fontSize: 10, color: 'var(--text-disabled)', marginLeft: 10, alignSelf: 'center' }}
      >
        {Math.round(HALO_SIZE_TOKENS.compactWidth)}×
        {resolveHaloSize(prefs.scale).compactHeight}px
      </span>
    </div>
  );
}

/**
 * A labelled range control for the Halo section.
 *
 * WHY A HELPER RATHER THAN SIX MORE COPIES OF THE MARKUP
 * The section already had an inline `input[type=range]` for size and another for widget
 * count, and this change adds four more. Six hand-written copies is six places to forget the
 * `aria-label`, the disabled state or the tabular-nums readout — and an unlabelled slider is
 * invisible to a screen reader, which is the one thing a "customize everything" panel must not
 * ship. One helper makes the omission impossible.
 *
 * The readout is `font-mono tabular-nums` per the file's existing convention for numeric
 * values, so the number does not jitter horizontally while dragging.
 */
function HaloSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="py-1">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-zinc-500">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full disabled:opacity-40"
      />
    </div>
  );
}

/**
 * The switch used throughout Settings — previously `HaloSwitch`, which was only
 * used by the Halo section and therefore only fixed the Halo section.
 *
 * ── WHY THE HAND-ROLLED SWITCHES WERE INVISIBLE ─────────────────────────────────
 * Three switches here (smooth scrolling, Show Halo Island, the Halo widget
 * toggles) drew their own track and coloured it with `--page-accent`. On this
 * page `index.css:743` sets:
 *
 *     [data-page="settings"] { --page-accent: var(--text-primary); }
 *
 * deliberately — Settings is MONOCHROME, so "selection" is meant to read as
 * contrast rather than hue. `--text-primary` is `#fafafa` on dark. The knob was
 * `bg-white`. So in the ON state the track and the knob were both `#fafafa`:
 * **measured 1.04:1 contrast**, i.e. a white shape on a white field.
 * `agent/probes/ambient-probe.mjs` prints that number.
 *
 * Swapping the token for `--ws-accent` is NECESSARY BUT NOT SUFFICIENT. A white
 * knob on the dark accent measures **2.43:1**, which still fails WCAG 1.4.11
 * (3:1 for a control boundary). The knob has to invert to the surface colour,
 * which is exactly what `.sf-switch` already does (`src/styles/surface.css:643`)
 * and what this component now delegates to.
 *
 * So there is ONE switch implementation on this page and it is the sanctioned
 * one — not a fourth hand-drawn variant.
 */
function SettingsSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  /* A real <input type="checkbox" role="switch"> wearing `.sf-switch`.
   *
   * The previous version was a <button> containing its own knob <span>, hand-drawn per
   * call site — and three of them did not agree with each other or with the Halo ones. A real
   * checkbox is focusable, submittable and announced correctly by every screen reader, and
   * `sf-switch` draws the track and the knob from a pseudo-element so no extra markup is
   * needed at all. */
  return (
    <input
      type="checkbox"
      role="switch"
      className="sf-switch"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
