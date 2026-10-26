import { useState, useEffect, useCallback, memo, useMemo, useRef, useSyncExternalStore } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
  LayoutDashboard, Activity, Brain, GraduationCap,
  Code2, Wallet, HeartHandshake, Settings, BookOpen,
  Smartphone, Shield as ShieldIcon, Terminal, Search, Lock, Bot,
  X, ChevronUp, ChevronDown, Trash2, SlidersHorizontal, FlaskConical,
} from 'lucide-react';
import { SidebarLogo } from './SidebarLogo';
import { useSidebarConfig, sidebarConfigActions } from './sidebar/useSidebarConfig';
import { SidebarHorizontal } from './sidebar/SidebarHorizontal';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../lib/utils';
import { stopwatch, formatStopwatch } from '../lib/stopwatchStore';

// Registry re-exported: App.tsx imports SIDEBAR_ITEMS from here.
import { SIDEBAR_ITEMS, type SidebarItem } from './sidebar/items';
// Re-exported for App.tsx, which resolves the active page from SIDEBAR_ITEMS.
export type { SidebarItem };
export { SIDEBAR_ITEMS };

const GROUP_ORDER = ['OVERVIEW', 'RECORD', 'INTELLIGENCE', 'CREATE', 'LIFE', 'SYSTEM'];

const GROUP_KICKER: Record<string, string> = {
  OVERVIEW: 'OVERVIEW',
  RECORD: 'RECORD',
  INTELLIGENCE: 'INTELLIGENCE',
  CREATE: 'CREATE',
  LIFE: 'LIFE',
  SYSTEM: 'SYSTEM',
};

// ── Ruler: 24 ticks, labels at 00/06/12/18/24 ─────────────────────────
const RULER_LABELS: Record<number, string> = {
  0: '00', 6: '06', 12: '12', 18: '18', 23: '24',
};

// ── Timer formatter ────────────────────────────────────────────────────
// The stopwatch readout is NOT computed here. It used to be: this sidebar
// rendered `elapsedTime` (App.tsx's per-foreground-window counter, in SECONDS,
// zeroed on every window switch) while the dashboard hero rendered the
// day-scoped totals from lib/stopwatchStore in MILLISECONDS. Two clocks, two
// formats, two meanings — so the two readouts disagreed and the sidebar looked
// like it reset at random. Both surfaces now render `stopwatch.displayMs`
// through the one shared formatter.
const TICK_COUNT = 24;

// ── Node dot ───────────────────────────────────────────
const NodeDot = memo(function NodeDot({
  // `mouseY` used to be destructured here and threaded in by the parent even
  // though nothing below ever read it. A prop that changes on every mousemove
  // makes memo() always miss, so every nav dot re-rendered at cursor frequency.
  item, isActive, collapsed, onNavigate,
}: {
  item: SidebarItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate: (path: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.path)}
      className={cn(
        // `transition-all` → `transition-colors`: only colours change on this
        // row, and `all` also animates layout (LAMINAR §6 bans it).
        'group relative flex items-center w-full rounded-lg transition-colors duration-150',
        // This row had NO surface state. Measured in light mode: background
        // `rgba(0,0,0,0)` at rest, on hover AND while active, `radius: 0px`,
        // `cursor: default`. The four `--sidebar-*` tokens below were written
        // for exactly this row and referenced by ZERO components, so the one
        // control the user touches most was the only control in the app with
        // no hover and no "you are here" except a 6px dot.
        // Rest/hover/active now come from tokens, so both themes resolve their
        // own values. The active wash is the PAGE accent at 15% (not the fixed
        // teal `--sidebar-active-bg`) because the dot on this same row is
        // already `var(--page-accent)` in light — a teal wash under a pink dot
        // was two signal hues on one row (LAMINAR §2). Hover stays neutral
        // ink: hovering is not a signal.
        isActive ? 'bg-[var(--page-accent-15)]' : 'hover:bg-[var(--sidebar-hover-bg)]',
        collapsed ? 'justify-center py-2' : 'gap-3 py-[7px] pl-3 pr-3',
      )}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <>
        {/* Icon chip — centered in collapsed; off-screen left in expanded */}
        {collapsed ? (
          <span
            className={cn(
              'flex h-[32px] w-[32px] items-center justify-center rounded-xl border-2 shadow-lg transition-all duration-200',
              isActive
                ? 'scale-100 border-white/30 bg-white/[0.15] shadow-[0_0_16px_rgba(255,255,255,0.3)] z-10 light:border-[var(--ws-accent)]/30 light:bg-[var(--ws-accent)]/[0.12] light:shadow-none'
                : 'scale-60 border-white/[0.08] bg-white/[0.04] group-hover:scale-[0.85] group-hover:border-white/20 group-hover:shadow-[0_0_12px_rgba(255,255,255,0.15)] light:border-[var(--ws-border)] light:bg-[var(--ws-veil)] light:group-hover:border-[var(--ws-border-strong)] light:group-hover:shadow-none',
            )}
          >
            <Icon
              className={cn(
                'h-[18px] w-[18px] drop-shadow-md light:drop-shadow-none',
                isActive ? 'text-white light:text-[var(--ws-accent-text)]' : 'text-zinc-100 light:text-[var(--text-secondary)]',
              )}
            />
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center justify-center shrink-0 transition-all duration-150',
              isActive
                ? 'text-white light:text-[var(--ws-accent-text)]'
                : 'text-zinc-400 group-hover:text-white light:text-[var(--text-muted)] light:group-hover:text-[var(--text-primary)]',
            )}
          >
            <Icon className={cn('h-[18px] w-[18px]')} />
          </span>
        )}

          {/* Dot on the line — only in expanded mode */}
        {!collapsed && (
          <span className="relative flex items-center justify-center shrink-0">
            {isActive ? (
              <span className="relative flex items-center justify-center">
                <span className="absolute w-4 h-4 rounded-full bg-white/[0.08] blur-[6px] light:hidden" />
                <span className="relative w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.25)] light:bg-[var(--page-accent)] light:shadow-none" />
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full border border-white/[0.35] group-hover:border-white/[0.6] group-hover:bg-white/[0.1] transition-all duration-150 light:border-[var(--ws-border-strong)] light:group-hover:border-[var(--ws-accent)] light:group-hover:bg-[var(--ws-veil)]" />
            )}
          </span>
        )}

        {/* Label — only in expanded mode */}
        {!collapsed && (
          <span
            className={cn(
              'text-[13px] truncate transition-colors duration-150 flex-1 text-left py-[2px]',
              isActive
                ? 'text-[var(--text-primary)] font-medium'
                : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]',
            )}
          >
            {item.label}
          </span>
        )}

        {/* Badge */}
        {item.badge && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] light:bg-[var(--ws-veil)] text-[var(--text-muted)] font-medium tabular-nums">
            {item.badge}
          </span>
        )}
      </>
    </button>
  );
});

// ── Width geometry ──────────────────────────────────────────────────────
// The rail presents itself as a measuring instrument (24 ticks, a nav needle, a
// mouse needle), so its width is adjusted by hand like a ruler. Clamped so the
// group kickers never truncate and the work surface is never crowded out.
export const SIDEBAR_MIN = 208;
export const SIDEBAR_MAX = 520;
export const SIDEBAR_DEFAULT = 224;
export const SIDEBAR_RAIL = 64;

const clampWidth = (n: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(n)));

/** Drag handle for the app sidebar. Drag + arrow keys + double-click to reset. */
function SidebarResizer({
  width,
  onResize,
  onResizingChange,
}: {
  width: number;
  onResize: (w: number) => void;
  onResizingChange: (active: boolean) => void;
}) {
  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    onResizingChange(true);
    // Coalesce to one state write per frame — otherwise every mousemove re-renders
    // the whole nav tree and the handle lags behind the cursor.
    let pending = startW;
    let frame = 0;
    const move = (ev: MouseEvent) => {
      pending = clampWidth(startW + (ev.clientX - startX));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        onResize(pending);
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (frame) cancelAnimationFrame(frame);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResizingChange(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize sidebar, ${width} pixels`}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      tabIndex={0}
      data-testid="sidebar-resizer"
      onMouseDown={onDown}
      onDoubleClick={() => onResize(SIDEBAR_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(clampWidth(width - 16)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onResize(clampWidth(width + 16)); }
        if (e.key === 'Home') { e.preventDefault(); onResize(SIDEBAR_MIN); }
        if (e.key === 'End') { e.preventDefault(); onResize(SIDEBAR_MAX); }
      }}
      title="Drag to resize · arrows nudge · double-click resets"
      className="group/resizer absolute right-0 top-0 z-20 flex h-full w-1.5 cursor-col-resize items-center justify-center outline-none"
    >
      <span className="h-8 w-0.5 rounded-full bg-white/[0.08] transition-colors duration-150 group-hover/resizer:bg-white/25 group-focus-visible/resizer:bg-[var(--page-accent)]" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export const Sidebar = memo(function SidebarComponent({
  collapsed,
  onToggle,
  width = SIDEBAR_DEFAULT,
  onResize,
  pathname,
  isTracking = false,
  onToggleTracking,
  onQuickLog,
  onOpenPalette,
}: {
  collapsed: boolean;
  onToggle: () => void;
  width?: number;
  onResize?: (w: number) => void;
  pathname?: string;
  isTracking?: boolean;
  onToggleTracking?: () => void;
  onQuickLog?: () => void;
  onOpenPalette?: () => void;
}) {
  // The sidebar's timer IS the stopwatch — same store, same snapshot, same
  // formatter as the dashboard hero. Subscribing here (rather than receiving a
  // number by prop) is what makes the two impossible to desynchronise: there is
  // only one value to show.
  const stopwatchSnap = useSyncExternalStore(stopwatch.subscribe, stopwatch.getSnapshot, stopwatch.getSnapshot);
  const stopwatchPaused = stopwatchSnap.paused;
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = pathname ?? location.pathname;
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const config = useSidebarConfig();
  const { setSide, renameGroup, moveGroup, addGroup, removeGroup, assignItem, reset } = sidebarConfigActions;
  const flipped = config.side === 'right';
  const [authenticated, setAuthenticated] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Mouse Y needle (red line) — driven straight onto the DOM node.
  //
  // This used to be React state: an unconditional window-level `mousemove`
  // listener called setMouseY on EVERY move, which (a) measured
  // getBoundingClientRect() per move, forcing a synchronous layout, and
  // (b) re-rendered SidebarComponent — a memo()'d tree of every nav group and
  // item. `mouseY` was then also threaded into every <NodeDot> as a prop even
  // though NodeDot never read it, which defeated their memo() as well. The
  // visible symptom was the needle appearing to lag and stutter behind the
  // cursor, because each frame queued a full nav-tree re-render.
  //
  // The needle is decorative and pointer-events-none, so it needs no React at
  // all: write the transform once per animation frame, and only while the
  // pointer is actually inside the sidebar.
  const needleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    let pendingY: number | null = null;
    let inside = false;

    const flush = () => {
      frame = 0;
      const el = needleRef.current;
      if (el && pendingY !== null) el.style.transform = `translateY(${pendingY}px)`;
      pendingY = null;
    };

    const onMove = (e: MouseEvent) => {
      const root = sidebarRef.current;
      if (!root) return;
      // Gate on the pointer being over the sidebar, so moving the mouse anywhere
      // else in the app costs nothing. Also reuses the rect we already measured
      // instead of forcing a layout read on every event.
      const rect = root.getBoundingClientRect();
      inside = e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inside) return;
      pendingY = e.clientY - rect.top;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Phone connection polling
  useEffect(() => {
    let alive = true;

    const checkAuth = async () => {
      try {
        const api = (window as any).deskflowAPI;
        if (!api?.authGetState) return;
        const state = await api.authGetState();
        if (alive) setAuthenticated(!!state?.authenticated);
      } catch { if (alive) setAuthenticated(false); }
    };

    const poll = async () => {
      try {
        const api = (window as any).deskflowAPI;
        if (!api?.listDevices) return;
        const r = await api.listDevices();
        if (alive) setPhoneConnected(r?.success && (r.devices?.length ?? 0) > 0);
      } catch { if (alive) setPhoneConnected(false); }
    };

    checkAuth();
    poll();
    const id = setInterval(() => { if (alive) { checkAuth(); poll(); } }, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const isActive = useCallback((item: SidebarItem) => {
    const p = item.path.split('?')[0];
    if (p === '/') return activePath === '/';
    return activePath === p || activePath.startsWith(p + '/');
  }, [activePath]);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  // Group items — order and membership come from persisted config, not constants
  const grouped = useMemo(() => {
    const map = new Map<string, SidebarItem[]>();
    for (const g of config.groups) map.set(g.id, []);
    for (const item of SIDEBAR_ITEMS) {
      const target = map.has(config.assignments[item.path])
        ? config.assignments[item.path]
        : item.group;
      (map.get(target) ?? map.get(map.keys().next().value as string))?.push(item);
    }
    return map;
  }, [config.groups, config.assignments]);

  const groupLabel = useCallback(
    (id: string) => config.groups.find(g => g.id === id)?.label ?? id,
    [config.groups],
  );

  // Active group: which group contains the currently active item
  const activeGroup = useMemo(() => {
    for (const item of SIDEBAR_ITEMS) {
      const p = item.path.split('?')[0];
      if (p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/')) {
        return config.assignments[item.path] ?? item.group;
      }
    }
    return undefined;
  }, [activePath, config.assignments]);

  // Nav marker position: map active item to a rough percentage of sidebar height
  const activeNavPct = useMemo(() => {
    const idx = SIDEBAR_ITEMS.findIndex((item) => {
      const p = item.path.split('?')[0];
      return p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/');
    });
    if (idx < 0) return 0;
    // Approximate: spread items across the ruler strip
    return (idx / Math.max(SIDEBAR_ITEMS.length - 1, 1)) * 100;
  }, [activePath]);

  // HOOK ORDER IS LOAD-BEARING: this conditional return MUST sit below every hook
  // in this body. React requires the same hooks in the same order on every render.
  // Returning early near the top skipped nine of them when the side flipped to
  // top/bottom, so flipping back rendered MORE hooks than the previous render and
  // React threw error #310 ("Rendered more hooks than during the previous render").
  // It only reproduced on a live orientation change, never on reload — a fresh
  // mount is internally consistent, which is exactly why it survived testing.
  if (config.side === 'top' || config.side === 'bottom') {
    return (
      <SidebarHorizontal
        side={config.side}
        collapsed={collapsed}
        onToggle={onToggle}
        pathname={pathname}
        isTracking={isTracking}
        onToggleTracking={onToggleTracking}
        onQuickLog={onQuickLog}
        onOpenPalette={onOpenPalette}
      />
    );
  }

  return (
    <div
      ref={sidebarRef}
      className={cn(
        'relative flex h-full shrink-0',
        // order-last moves the whole rail to the far side of the flex row
        flipped && 'order-last',
        flipped ? 'flex-row-reverse border-l border-zinc-800/60' : 'border-r border-zinc-800/60',
        // Was `bg-[#0c0c0c]`. An arbitrary hex compiles to a LITERAL, so it was
        // the one surface in the app that ignored BOTH the dark palette and the
        // light one — the rail stayed black in light mode no matter what the
        // theme did. Reads the token now, so the sidebar follows the theme.
        'bg-[var(--sidebar-bg)]',
      )}
      style={{
        width: collapsed ? SIDEBAR_RAIL : clampWidth(width),
        // No width transition while dragging — a transitioning width makes the
        // handle lag behind the cursor. Same 250ms LAMINAR easing otherwise.
        transition: resizing ? 'none' : 'width 250ms cubic-bezier(0.16,1,0.3,1)',
        WebkitAppRegion: 'no-drag' as any,
      }}>
      {!collapsed && onResize && (
        <SidebarResizer
          width={clampWidth(width)}
          onResize={onResize}
          onResizingChange={setResizing}
        />
      )}
      {/* ── Ruler strip (16px, left edge) ────────────────────────── */}
      <div className={cn("relative w-4 shrink-0 flex flex-col items-center", flipped ? "border-l border-zinc-800/40" : "border-r border-zinc-800/40")}>
        {/* Spacer where logo lives in main pane */}
        <div className="shrink-0 h-14 w-full border-b border-zinc-800/40" />
        {/* Tick strip — full remaining height with now-tick + nav marker */}
        <div className="relative flex-1 w-full">
          {/* Vertical hairline (the Y-axis line) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/[0.08]" />
          {/* Hour ticks */}
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const isMajor = RULER_LABELS[i] !== undefined;
            return (
              <div
                key={i}
                className="absolute left-1/2 -translate-x-1/2 flex items-center"
                style={{ top: `${(i / (TICK_COUNT - 1)) * 100}%` }}
              >
                <span
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 block',
                    isMajor ? 'w-2.5 h-px' : 'w-1.5 h-px',
                  )}
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                />
                {/* Label positioned above the tick, centered on the hairline */}
                {isMajor && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[9px] font-mono text-zinc-600 whitespace-nowrap select-none"
                    style={{ bottom: '100%', transform: 'translateX(-50%) translateY(-4px)' }}
                  >
                    {RULER_LABELS[i]}
                  </span>
                )}
              </div>
            );
          })}
          {/* ── Nav needle (slides between pages) ──────── */}
          <div
            className={cn("absolute z-10 pointer-events-none", flipped ? "right-[18px]" : "left-[18px]")}
            style={{ top: `${activeNavPct}%`, transform: 'translateY(-50%)', transition: 'top 0.4s ease' }}
          >
            <span className="w-2 h-2 rounded-full bg-[var(--page-accent)] shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          </div>
          {/* Mouse Y needle (red line). Position is written by the rAF listener
              above onto this node directly; no React state is involved, so the
              line tracks the cursor without re-rendering the nav tree. The
              transform is set inline by JS, so no `top` transition here. */}
          <div
            ref={needleRef}
            className="absolute left-0 right-0 pointer-events-none z-20"
            style={{ top: 0, height: '1px', backgroundColor: 'rgba(255,60,60,0.7)', willChange: 'transform' }}
          />
        </div>
      </div>

      {/* ── Main pane (node line + instrument strip) ─────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div
          className={cn(
            'shrink-0 flex items-center border-b border-zinc-800/60',
            collapsed ? 'justify-center h-10' : 'h-10 px-3',
          )}
        >
          {collapsed ? (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
            title="Expand sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <SidebarLogo href="#/" />
              <button
                onClick={onToggle}
                className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                title="Collapse sidebar"
              >
                <svg className="w-3.5 h-3.5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}
        </div>

{/* ── Arrange panel (quick-access: lives ON the rail, not in Settings) ── */}
        {editMode && (
          <div className="shrink-0 border-b border-zinc-800/60 px-3 py-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 light:text-[var(--text-faint)]">Arrange</span>
              <button
                onClick={() => setEditMode(false)}
                className="p-0.5 text-zinc-500 hover:text-white transition-colors"
                title="Done arranging"
                aria-label="Close arrange panel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-600 w-8 shrink-0 light:text-[var(--text-faint)]">Side</span>
              <div className="flex gap-1 flex-1">
                {(['left', 'right', 'top', 'bottom'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    aria-pressed={config.side === s}
                    className={cn(
                      'flex-1 px-1.5 py-1 rounded text-[10px] capitalize transition-colors',
                      config.side === s
                        ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)]'
                        : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 light:text-[var(--text-muted)] light:hover:bg-[var(--ws-veil)] light:hover:text-[var(--text-primary)]',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-[38vh] overflow-y-auto hide-scrollbar">
              {config.groups.map((g, i) => (
                <div key={g.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <input
                      value={g.label}
                      onChange={e => renameGroup(g.id, e.target.value)}
                      aria-label={`Rename group ${g.label}`}
                      className="flex-1 min-w-0 bg-zinc-800/60 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-200 focus:outline-none focus:border-[var(--page-accent)]"
                    />
                    <button
                      onClick={() => moveGroup(g.id, -1)}
                      disabled={i === 0}
                      className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-25 disabled:hover:text-zinc-500 transition-colors"
                      title="Move group up"
                      aria-label={`Move ${g.label} up`}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveGroup(g.id, 1)}
                      disabled={i === config.groups.length - 1}
                      className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-25 disabled:hover:text-zinc-500 transition-colors"
                      title="Move group down"
                      aria-label={`Move ${g.label} down`}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeGroup(g.id)}
                      disabled={config.groups.length <= 1}
                      className="p-0.5 text-zinc-500 hover:text-red-400 disabled:opacity-25 disabled:hover:text-zinc-500 transition-colors"
                      title="Delete group — its pages move to the first group"
                      aria-label={`Delete group ${g.label}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {SIDEBAR_ITEMS
                    .filter(it => (config.assignments[it.path] ?? it.group) === g.id)
                    .map(it => (
                      <select
                        key={it.path}
                        value={config.assignments[it.path] ?? it.group}
                        onChange={e => assignItem(it.path, e.target.value)}
                        aria-label={`Group for ${it.label}`}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-400 focus:outline-none focus:border-[var(--page-accent)]"
                      >
                        {config.groups.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    ))}
                </div>
              ))}
            </div>

            <div className="flex gap-1">
              <button
                onClick={addGroup}
                className="flex-1 px-1.5 py-1 rounded text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                + Group
              </button>
              <button
                onClick={reset}
                className="flex-1 px-1.5 py-1 rounded text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                title="Restore default groups and side"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ── Node line (scrollable navigation) ─────────────────── */}
        
        <div className="flex-1 min-h-0 overflow-y-auto py-2 hide-scrollbar">
          <div className="relative flex">
            {/* Vertical node hairline */}
            <div className={cn("absolute top-0 bottom-0 w-px bg-white/[0.06]", flipped ? "right-[18px]" : "left-[18px]")} />

            {/* Groups + items — same NodeDot list in both modes */}
            <div className="flex-1 min-w-0">
              {config.groups.map((groupMeta, gIdx) => {
                const group = groupMeta.id;
                const items = grouped.get(group) ?? [];
                const isGroupActive = activeGroup === group;

                return (
                  <div key={group}>
                    {/* Group header (kicker) — hidden in collapsed mode */}
                    {!collapsed && (
                    <div
                        className={cn(
                          'px-4 pt-3 pb-1 text-[10px] font-mono uppercase tracking-[0.14em] transition-colors select-none',
                          isGroupActive ? 'text-[var(--text-primary)]' : 'text-zinc-600',
                        )}
                      >
                        {groupLabel(group)}
                      </div>
                    )}

                    {/* Items — NodeDot in both modes */}
                    <div className={cn(flipped ? 'pr-1 pl-2' : 'pl-1 pr-2', collapsed && (flipped ? 'pr-0' : 'pl-0'))}>
                      {items.map((item) => (
                        <NodeDot
                          key={item.path}
                          item={item}
                          isActive={isActive(item)}
                          collapsed={collapsed}
                          onNavigate={handleNavigate}
                        />
                      ))}
                    </div>

                    {/* Group separator — horizontal line in collapsed mode */}
                    {gIdx < config.groups.length - 1 && collapsed && (
                      <div className="w-full h-px bg-white/[0.15] my-1 mx-2" />
                    )}
                    {gIdx < config.groups.length - 1 && !collapsed && (
                      <div className="relative h-2 flex items-center justify-center">
                        <div className={cn("absolute flex flex-col gap-[3px]", flipped ? "right-[14px]" : "left-[14px]")}>
                          <span className="block w-[9px] h-px bg-white/[0.1]" />
                          <span className="block w-[9px] h-px bg-white/[0.1]" />
                          <span className="block w-[9px] h-px bg-white/[0.1]" />
</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        

        {/* ── Instrument Strip (bottom: state, not destinations) ── */}
        <div
          className={cn(
            'shrink-0 border-t border-zinc-800/60',
            collapsed ? 'p-1.5' : 'px-3 py-2.5',
          )}
        >
          {collapsed ? (
                      /* Rail mode: compact icon cluster */
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex flex-col items-center gap-1.5">
                          {/* Theme toggle */}
                          <ThemeToggle size="sm" />
                          {/* Phone QR */}
                          <button
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent('open-pair-modal', {
                                  detail: { terminalId: 'desktop', label: 'Desktop' },
                                })
                              );
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            title="Connect phone"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                          </button>
                          {/* LIVE dot — only rendered when tracking */}
                          {isTracking && (
                  <div
                    className="flex items-center justify-center"
                    title="Recording"
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inset-0 rounded-full bg-emerald-400/80" />
                      <span className="absolute inset-0 rounded-full bg-emerald-400/80 animate-ping" />
                    </span>
                  </div>
                )}
                        {/* Smart search */}
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('smart-search:open'))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                          title="Smart search"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                <button
                  onClick={onToggleTracking}
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                    isTracking
                      ? 'bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/30'
                      : 'bg-zinc-700/40 text-zinc-400 hover:bg-zinc-700 hover:text-white',
                  )}
                  title={isTracking ? 'Pause tracking' : 'Resume tracking'}
                >
                  {isTracking ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={onOpenPalette}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                  title="Command palette"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </button>

                {/* Smart search */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('smart-search:open'))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                  title="Smart search (Ctrl+F)"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                {/* Arrange groups / side */}
                <button
                  onClick={() => setEditMode(v => !v)}
                  aria-pressed={editMode}
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                    editMode
                      ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)]'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-800',
                  )}
                  title="Arrange groups and sidebar side"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
                </div>
            </div>
          ) : (
            /* Expanded: full instrument strip */
            <div className="flex flex-col gap-2">
              {/* Row 1: LIVE + timer + focus toggle */}
              <div className="flex items-center justify-between gap-2">
                {/* Left: LIVE + tabular timer */}
                <div className="flex items-center gap-2 min-w-0">
                  {isTracking && !stopwatchPaused && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-400/80" />
                      <span className="absolute inset-0 rounded-full bg-emerald-400/80 animate-ping" />
                    </span>
                  )}
                  <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                    {formatStopwatch(stopwatchSnap.displayMs)}
                  </span>
                </div>
                {/* Right: focus toggle */}
                <button
                  onClick={onToggleTracking}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium transition-colors',
                    isTracking
                      ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                  )}
                  title={isTracking ? 'Pause tracking' : 'Resume tracking'}
                >
                  {isTracking ? (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                      </svg>
                      <span className="font-mono">LIVE</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      <span className="font-mono">PAUSED</span>
                    </>
                  )}
                </button>
              </div>
              {/* Row 2: Theme toggle + phone status */}
              <div className="flex items-center justify-between gap-2">
                <ThemeToggle size="sm" />
                <div className="flex items-center gap-1.5">
                  {authenticated ? (
                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('open-pair-modal', {
                            detail: { terminalId: 'desktop', label: 'Desktop' },
                          })
                        );
                      }}
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                      title="Connect phone"
                    >
                      <Smartphone className="w-3 h-3" />
                      <span className="font-mono">{phoneConnected ? 'SYNCED' : 'NO PHONE'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('settings:open-tab', { detail: 'auth' }))}
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      title="Not authenticated — go to Auth settings"
                    >
                      <Lock className="w-3 h-3" />
                      <span className="font-mono">AUTH</span>
                    </button>
                  )}
                </div>
              </div>
              {/* Row 3: Quick Log + ⌘K + Smart Search */}
              <div className="flex items-center justify-between gap-1">
                <button
                  onClick={onQuickLog}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                  title="Quick Log"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="font-mono">Quick Log</span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('smart-search:open'))}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                    title="Smart search"
                  >
                    <Search className="w-3 h-3" />
                    <span className="font-mono text-[9px]">⌘F</span>
                  </button>
                  <button
                    onClick={onOpenPalette}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 light:text-[var(--text-muted)] light:hover:text-[var(--text-primary)] light:hover:bg-[var(--ws-veil)] transition-colors"
                    title="Command palette"
                  >
                    <span className="font-mono text-[9px]">⌘K</span>
                  </button>

                  {/* Arrange groups + side (expanded strip) */}
                  <button
                    onClick={() => setEditMode(v => !v)}
                    aria-pressed={editMode}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors',
                      editMode
                        ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)]'
                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800',
                    )}
                    title="Arrange groups and sidebar side"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Sidebar;
