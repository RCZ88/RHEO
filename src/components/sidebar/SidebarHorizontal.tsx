import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronUp, ChevronDown, Trash2, SlidersHorizontal, Search } from 'lucide-react';

import { SIDEBAR_ITEMS } from './items';
import { useSidebarConfig, sidebarConfigActions } from './useSidebarConfig';
import { SidebarLogo } from '../SidebarLogo';
import { ThemeToggle } from '../ThemeToggle';
import { cn } from '../../lib/utils';

/**
 * Horizontal sidebar — the top/bottom variant.
 *
 * WHY THIS IS A SEPARATE COMPONENT: the vertical rail is an INSTRUMENT, not a
 * list. It carries a 16px ruler strip with 24 ticks labelled 00/06/12/18/24, a
 * nav needle that slides VERTICALLY (`top: activeNavPct%`), and a mouse needle
 * that is a HORIZONTAL line tracking `mouseY`. Rotating that with CSS would
 * leave the ruler vertical inside a horizontal bar. So the same metaphor is
 * re-derived on the other axis here: the ruler runs horizontally along the bar's
 * inner edge, the nav needle slides horizontally, and the mouse needle becomes a
 * VERTICAL line tracking `mouseX`.
 *
 * Collapse means "icons only, shorter bar" rather than "shrink to a 64px rail" —
 * a horizontal bar has no rail state, and the toggle must stay reachable.
 */

export const H_MIN = 44;
export const H_MAX = 140;
export const H_DEFAULT = 60;
const HEIGHT_KEY = 'df-sidebar-height';

const TICK_COUNT = 24;
const RULER_LABELS: Record<number, string> = { 0: '00', 6: '06', 12: '12', 18: '18', 24: '24' };

const clampH = (n: number) => Math.min(H_MAX, Math.max(H_MIN, Math.round(n)));

function loadHeight(): number {
  try {
    const raw = Number(localStorage.getItem(HEIGHT_KEY));
    return Number.isFinite(raw) && raw >= H_MIN && raw <= H_MAX ? raw : H_DEFAULT;
  } catch { return H_DEFAULT; }
}

/** Vertical drag handle — adjusts bar HEIGHT (the horizontal analogue of width). */
function HeightResizer({ height, onResize }: { height: number; onResize: (n: number) => void }) {
  const [dragging, setDragging] = useState(false);
  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    setDragging(true);
    let pending = startH;
    let frame = 0;
    const move = (ev: MouseEvent) => {
      pending = clampH(startH - (ev.clientY - startY)); // dragging up grows a top bar
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; onResize(pending); });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (frame) cancelAnimationFrame(frame);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Resize sidebar, ${height} pixels tall`}
      aria-valuenow={height}
      aria-valuemin={H_MIN}
      aria-valuemax={H_MAX}
      tabIndex={0}
      data-testid="sidebar-resizer"
      onMouseDown={onDown}
      onDoubleClick={() => onResize(H_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); onResize(clampH(height + 16)); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onResize(clampH(height - 16)); }
        if (e.key === 'Home') { e.preventDefault(); onResize(H_MIN); }
        if (e.key === 'End') { e.preventDefault(); onResize(H_MAX); }
      }}
      title="Drag to resize · arrows nudge · double-click resets"
      className="group/hresizer absolute inset-x-0 flex h-1.5 cursor-row-resize items-center justify-center outline-none"
    >
      <span className={cn(
        'h-0.5 w-8 rounded-full bg-white/[0.08] transition-colors duration-150',
        'group-hover/hresizer:bg-white/25 group-focus-visible/hresizer:bg-[var(--page-accent)]',
        dragging && 'bg-white/40',
      )} />
    </div>
  );
}

export interface SidebarHorizontalProps {
  side: 'top' | 'bottom';
  collapsed: boolean;
  onToggle: () => void;
  pathname?: string;
  isTracking?: boolean;
  onToggleTracking?: () => void;
  onQuickLog?: () => void;
  onOpenPalette?: () => void;
}

export function SidebarHorizontal({
  side, collapsed, onToggle, pathname, isTracking = false,
  onToggleTracking, onQuickLog, onOpenPalette,
}: SidebarHorizontalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = pathname ?? location.pathname;
  const config = useSidebarConfig();
  const { renameGroup, moveGroup, addGroup, removeGroup, assignItem, reset } = sidebarConfigActions;

  const [height, setHeight] = useState(loadHeight);
  const [mouseX, setMouseX] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const isTop = side === 'top';

  useEffect(() => {
    try { localStorage.setItem(HEIGHT_KEY, String(height)); } catch { /* no persist */ }
  }, [height]);

  const onResize = useCallback((h: number) => setHeight(clampH(h)), []);

  // Mouse needle: vertical line tracking X instead of horizontal tracking Y.
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = barRef.current?.getBoundingClientRect();
      if (r) setMouseX(e.clientX - r.left);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  const isActive = useCallback(
    (path: string) => {
      const p = path.split('?')[0];
      return p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/');
    },
    [activePath],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof SIDEBAR_ITEMS>();
    for (const g of config.groups) map.set(g.id, []);
    for (const item of SIDEBAR_ITEMS) {
      const target = map.has(config.assignments[item.path]) ? config.assignments[item.path] : item.group;
      (map.get(target) ?? map.get(map.keys().next().value as string))?.push(item);
    }
    return map;
  }, [config.groups, config.assignments]);

  const activeNavPct = useMemo(() => {
    const idx = SIDEBAR_ITEMS.findIndex(i => isActive(i.path));
    if (idx < 0) return 0;
    return (idx / Math.max(SIDEBAR_ITEMS.length - 1, 1)) * 100;
  }, [isActive]);

  const barHeight = collapsed ? H_MIN : height;

  return (
    <div
      ref={barRef}
      data-testid="sidebar-horizontal"
      data-side={side}
      className={cn(
        'relative flex shrink-0 bg-[#0c0c0c]',
        // The App wrapper is a COLUMN for top/bottom, so the bar's own position
        // in that column is decided by order — flex-col-reverse below only
        // reverses the bar's CHILDREN (ruler/labels), not the bar itself.
        !isTop && 'order-last',
        isTop ? 'flex-col border-b border-zinc-800/60' : 'flex-col-reverse border-t border-zinc-800/60',
      )}
      style={{ height: barHeight }}
    >
      {!collapsed && (
        <HeightResizer height={height} onResize={onResize} />
      )}

      <div className="flex items-center gap-2 min-w-0 flex-1 px-2">
        {/* Brand + collapse */}
        <div className={cn('flex items-center shrink-0', isTop ? 'border-r border-zinc-800/60 pr-2' : 'border-l border-zinc-800/60 pl-2')}>
          {!collapsed && <SidebarLogo href="#/" />}
          <button
            onClick={onToggle}
            className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={cn('w-3.5 h-3.5', isTop ? 'rotate-180' : 'rotate-0')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Nav items, grouped, inline */}
        <nav className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto hide-scrollbar">
          {config.groups.map((g, gi) => {
            const items = grouped.get(g.id) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={g.id} className="flex items-center gap-1 shrink-0">
                {gi > 0 && <span className="w-px h-4 bg-white/[0.12] mx-1 shrink-0" aria-hidden />}
                {!collapsed && (
                  <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600 select-none shrink-0">
                    {g.label}
                  </span>
                )}
                {items.map(item => {
                  const Icon = item.icon;
                  const on = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      title={item.label}
                      aria-current={on ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors shrink-0',
                        on ? 'bg-white/[0.10] text-white' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {!collapsed && <span className="text-[11px] whitespace-nowrap">{item.label}</span>}
                      {on && (
                        <span
                          className="absolute w-1.5 h-1.5 rounded-full bg-[var(--page-accent)]"
                          style={{ bottom: isTop ? 2 : 2, top: isTop ? undefined : 2, left: '50%', transform: 'translateX(-50%)' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Utilities */}
        <div className={cn('flex items-center gap-1 shrink-0', isTop ? 'border-l border-zinc-800/60 pl-2' : 'border-r border-zinc-800/60 pr-2')}>
          <button
            onClick={() => setEditMode(v => !v)}
            aria-pressed={editMode}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              editMode ? 'bg-[var(--page-accent)]/15 text-[var(--page-accent)]' : 'text-zinc-500 hover:text-white hover:bg-zinc-800',
            )}
            title="Arrange groups and sidebar side"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          {!collapsed && (
            <>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('smart-search:open'))}
                className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Smart search (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              {onOpenPalette && (
                <button
                  onClick={onOpenPalette}
                  className="px-1.5 py-1 rounded-md text-[10px] font-mono text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Command palette"
                >
                  ⌘K
                </button>
              )}
              <ThemeToggle size="sm" />
              {onQuickLog && (
                <button
                  onClick={onQuickLog}
                  className="px-1.5 py-1 rounded-md text-[10px] text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Quick Log"
                >
                  Quick Log
                </button>
              )}
            </>
          )}
          {onToggleTracking && (
            <button
              onClick={onToggleTracking}
              className={cn(
                'px-1.5 py-1 rounded-md text-[10px] transition-colors',
                isTracking ? 'text-emerald-400 hover:bg-zinc-800' : 'text-zinc-500 hover:text-white hover:bg-zinc-800',
              )}
              title={isTracking ? 'Pause tracking' : 'Resume tracking'}
            >
              {isTracking ? 'Pause' : 'Track'}
            </button>
          )}
        </div>
      </div>

      {/* ── Ruler: horizontal re-derivation of the vertical strip ──
          Everything here is CONTAINED. The strip is overflow-hidden and every
          child is explicitly anchored to the hairline, so no tick, label or
          needle can escape into the page content above/below the bar. The
          previous version had auto-positioned wrappers (no top/bottom) and a
          needle sized to the whole bar, which drew a 60px line 51px ABOVE a
          bottom bar — the red streak over the content the user reported. */}
      {!collapsed && (
        <div
          className={cn(
            'absolute inset-x-0 h-4 overflow-hidden pointer-events-none select-none',
            isTop ? 'bottom-0' : 'top-0',
          )}
        >
          {/* Baseline hairline, on the bar's inner edge */}
          <div className={cn('absolute inset-x-0 h-px', isTop ? 'top-0' : 'bottom-0')} style={{ backgroundColor: 'var(--sb-ruler-line)' }} />

          {/* Ticks hang inward from the hairline */}
          {Array.from({ length: TICK_COUNT + 1 }, (_, i) => (
            <span
              key={i}
              className="absolute block w-px"
              style={{
                left: `${(i / TICK_COUNT) * 100}%`,
                transform: 'translateX(-50%)',
                [isTop ? 'top' : 'bottom']: 0,
                height: RULER_LABELS[i] !== undefined ? 6 : 3,
                backgroundColor: 'var(--sb-ruler-tick)',
              }}
            />
          ))}

          {/* Only the two end labels — a 60px bar has no room for a full scale,
              and five floating numbers read as noise. Clipped if they ever overflow. */}
          {[0, TICK_COUNT].map(i => (
            <span
              key={`lbl-${i}`}
              className="absolute text-[8px] font-mono leading-none"
              style={{
                [i === 0 ? 'left' : 'right']: 3,
                [isTop ? 'top' : 'bottom']: 8,
                color: 'var(--sb-ruler-label)',
              }}
            >
              {RULER_LABELS[i]}
            </span>
          ))}

          {/* Nav needle — small dot sitting on the hairline */}
          <span
            className="absolute z-10 block h-1.5 w-1.5 rounded-full"
            style={{
              left: `${activeNavPct}%`,
              transform: 'translateX(-50%)',
              [isTop ? 'top' : 'bottom']: 0,
              marginTop: isTop ? -2 : undefined,
              marginBottom: isTop ? undefined : -2,
              backgroundColor: 'var(--page-accent)',
              transition: 'left 0.4s ease',
            }}
          />

          {/* Mouse needle — a short tick INSIDE the strip, never the full bar */}
          <span
            className="absolute z-20 block w-px"
            style={{
              left: `${mouseX}px`,
              [isTop ? 'top' : 'bottom']: 0,
              height: 10,
              backgroundColor: 'var(--sb-mouse-needle)',
              transition: 'left 0.05s linear',
            }}
          />
        </div>
      )}

      {/* ── Arrange panel (horizontal layout) ── */}
      {editMode && (
        <div
          className={cn(
            'absolute z-30 left-2 right-2 rounded-lg border border-zinc-700 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] p-3 shadow-xl',
            isTop ? 'top-2' : 'bottom-2',
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">Arrange</span>
            <button
              onClick={() => setEditMode(false)}
              className="p-0.5 text-zinc-500 hover:text-white transition-colors"
              title="Done arranging"
              aria-label="Close arrange panel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-zinc-600 w-8 shrink-0">Side</span>
            <div className="flex gap-1 flex-1">
              {(['left', 'right', 'top', 'bottom'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => sidebarConfigActions.setSide(s)}
                  aria-pressed={config.side === s}
                  className={cn(
                    'flex-1 px-1 py-1 rounded text-[10px] transition-colors',
                    config.side === s
                      ? 'bg-[var(--page-accent)]/15 text-[var(--page-accent)]'
                      : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto hide-scrollbar">
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
                    onClick={() => moveGroup(g.id, -1)} disabled={i === 0}
                    className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-25 transition-colors"
                    title="Move group earlier" aria-label={`Move ${g.label} earlier`}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveGroup(g.id, 1)} disabled={i === config.groups.length - 1}
                    className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-25 transition-colors"
                    title="Move group later" aria-label={`Move ${g.label} later`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeGroup(g.id)} disabled={config.groups.length <= 1}
                    className="p-0.5 text-zinc-500 hover:text-red-400 disabled:opacity-25 transition-colors"
                    title="Delete group — its pages move to the first group" aria-label={`Delete group ${g.label}`}
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
                      {config.groups.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  ))}
              </div>
            ))}
          </div>

          <div className="flex gap-1 mt-2">
            <button onClick={addGroup} className="flex-1 px-1.5 py-1 rounded text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors">
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
    </div>
  );
}

export default SidebarHorizontal;