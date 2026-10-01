import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
  LayoutDashboard, Activity, Brain, Sparkles, GraduationCap,
  FileText, Code2, Wallet, HeartHandshake, Settings, BookOpen,
  Smartphone, Shield as ShieldIcon, Terminal, Search, Lock,
} from 'lucide-react';
import { SidebarLogo } from './SidebarLogo';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../lib/utils';

// ── Types ───────────────────────────────────────────────────────────────
interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  group: string;
  badge?: string;
}

// ── Navigation (§16 — URL is the single truth) ─────────────────────────
export const SIDEBAR_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', group: 'OVERVIEW' },
  { icon: Activity, label: 'Activity', path: '/activity', group: 'RECORD' },
  { icon: Code2, label: 'IDE Projects', path: '/ide', group: 'RECORD' },
  { icon: Brain, label: 'AI Assistant', path: '/ai', group: 'INTELLIGENCE' },
  { icon: ShieldIcon, label: 'Insights', path: '/reports', group: 'INTELLIGENCE' },
  { icon: GraduationCap, label: 'Lyceum', path: '/learn', group: 'INTELLIGENCE' },
  { icon: BookOpen, label: 'Lecture', path: '/lecture', group: 'INTELLIGENCE' },
  { icon: Sparkles, label: 'Content Engine', path: '/studio', group: 'CREATE' },
  { icon: FileText, label: 'Resume', path: '/resume', group: 'CREATE' },
  { icon: HeartHandshake, label: 'Life', path: '/life', group: 'LIFE' },
  { icon: Wallet, label: 'Finance', path: '/finance', group: 'LIFE' },
  { icon: BookOpen, label: 'Guide', path: '/guide', group: 'SYSTEM' },
  { icon: Settings, label: 'Settings', path: '/settings', group: 'SYSTEM' },
  { icon: Terminal, label: 'Penguin Console', path: '/penguin-console', group: 'SYSTEM' },
];

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
const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${sec.toString().padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
};
const TICK_COUNT = 24;

// ── Node dot ───────────────────────────────────────────
const NodeDot = memo(function NodeDot({
  item, isActive, collapsed, onNavigate, mouseY,
}: {
  item: SidebarItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate: (path: string) => void;
  mouseY: number;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.path)}
      className={cn(
        'group relative flex items-center w-full transition-all duration-150',
        collapsed ? 'justify-center py-2' : 'gap-3 py-[7px] pl-3 pr-3',
      )}
      title={collapsed ? item.label : undefined}
    >
      <>
        {/* Icon chip — centered in collapsed; off-screen left in expanded */}
        {collapsed ? (
          <span
            className={cn(
              'flex h-[32px] w-[32px] items-center justify-center rounded-xl border-2 shadow-lg transition-all duration-200',
              isActive
                ? 'scale-100 border-white/30 bg-white/[0.15] shadow-[0_0_16px_rgba(255,255,255,0.3)] z-10'
                : 'scale-60 border-white/[0.08] bg-white/[0.04] group-hover:scale-[0.85] group-hover:border-white/20 group-hover:shadow-[0_0_12px_rgba(255,255,255,0.15)]',
            )}
          >
            <Icon
              className={cn(
                'h-[18px] w-[18px] drop-shadow-md',
                isActive ? 'text-white' : 'text-zinc-100',
              )}
            />
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center justify-center shrink-0 transition-all duration-150',
              isActive
                ? 'text-white'
                : 'text-zinc-400 group-hover:text-white',
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
                <span className="absolute w-4 h-4 rounded-full bg-white/[0.08] blur-[6px]" />
                <span className="relative w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.25)]" />
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full border border-white/[0.35] group-hover:border-white/[0.6] group-hover:bg-white/[0.1] transition-all duration-150" />
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
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[var(--text-muted)] font-medium tabular-nums">
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
  elapsedTime = 0,
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
  elapsedTime?: number;
  onToggleTracking?: () => void;
  onQuickLog?: () => void;
  onOpenPalette?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = pathname ?? location.pathname;
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [mouseY, setMouseY] = useState(0);
  const [resizing, setResizing] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Track mouse Y globally so the expanded chip (at left:-28px) follows cursor
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const rect = sidebarRef.current?.getBoundingClientRect();
      if (rect) setMouseY(e.clientY - rect.top);
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
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

  // Group items
  const grouped = useMemo(() => {
    const map = new Map<string, SidebarItem[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const item of SIDEBAR_ITEMS) map.get(item.group)?.push(item);
    return map;
  }, []);

  // Active group: which group contains the currently active item
  const activeGroup = useMemo(() => {
    for (const item of SIDEBAR_ITEMS) {
      const p = item.path.split('?')[0];
      if (p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/')) {
        return item.group;
      }
    }
    return undefined;
  }, [activePath]);

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

  return (
    <div
      ref={sidebarRef}
      className={cn(
        'relative flex h-full shrink-0 border-r border-zinc-800/60',
        'bg-[#0c0c0c]',
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
      <div className="relative w-4 shrink-0 flex flex-col items-center border-r border-zinc-800/40">
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
            className="absolute left-[18px] z-10 pointer-events-none"
            style={{ top: `${activeNavPct}%`, transform: 'translateY(-50%)', transition: 'top 0.4s ease' }}
          >
            <span className="w-2 h-2 rounded-full bg-[var(--page-accent)] shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          </div>
          {/* Mouse Y needle (red line) */}
          <div
            className="absolute left-0 right-0 pointer-events-none z-20"
            style={{ top: `${mouseY}px`, height: '1px', backgroundColor: 'rgba(255,60,60,0.7)', transition: 'top 0.05s linear' }}
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
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
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
                className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Collapse sidebar"
              >
                <svg className="w-3.5 h-3.5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Node line (scrollable navigation) ─────────────────── */}
        
        <div className="flex-1 min-h-0 overflow-y-auto py-2 hide-scrollbar">
          <div className="relative flex">
            {/* Vertical node hairline */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-white/[0.06]" />

            {/* Groups + items — same NodeDot list in both modes */}
            <div className="flex-1 min-w-0">
              {GROUP_ORDER.map((group, gIdx) => {
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
                        {GROUP_KICKER[group]}
                      </div>
                    )}

                    {/* Items — NodeDot in both modes */}
                    <div className={cn('pl-1 pr-2', collapsed && 'pl-0')}>
                      {items.map((item) => (
                        <NodeDot
                          key={item.path}
                          item={item}
                          isActive={isActive(item)}
                          collapsed={collapsed}
                          onNavigate={handleNavigate}
                          mouseY={mouseY}
                        />
                      ))}
                    </div>

                    {/* Group separator — horizontal line in collapsed mode */}
                    {gIdx < GROUP_ORDER.length - 1 && collapsed && (
                      <div className="w-full h-px bg-white/[0.15] my-1 mx-2" />
                    )}
                    {gIdx < GROUP_ORDER.length - 1 && !collapsed && (
                      <div className="relative h-2 flex items-center justify-center">
                        <div className="absolute left-[14px] flex flex-col gap-[3px]">
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
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
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
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Command palette"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </button>

                {/* Smart search */}
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('smart-search:open'))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Smart search (Ctrl+F)"
                >
                  <Search className="w-3.5 h-3.5" />
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
                  {isTracking && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-400/80" />
                      <span className="absolute inset-0 rounded-full bg-emerald-400/80 animate-ping" />
                    </span>
                  )}
                  <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                    {formatDuration(elapsedTime)}
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
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
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
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
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
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Smart search"
                  >
                    <Search className="w-3 h-3" />
                    <span className="font-mono text-[9px]">⌘F</span>
                  </button>
                  <button
                    onClick={onOpenPalette}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Command palette"
                  >
                    <span className="font-mono text-[9px]">⌘K</span>
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
