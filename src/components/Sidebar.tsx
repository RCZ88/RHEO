import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Activity, Brain, Sparkles, GraduationCap,
  FileText, Code2, Wallet, HeartHandshake, Settings, BookOpen,
  Shield, Smartphone,
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
const SIDEBAR_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', group: 'OVERVIEW' },
  { icon: Activity, label: 'Activity', path: '/activity', group: 'RECORD' },
  { icon: Code2, label: 'IDE Projects', path: '/ide', group: 'RECORD' },
  { icon: Brain, label: 'AI Assistant', path: '/ai', group: 'INTELLIGENCE' },
  { icon: Shield, label: 'Insights', path: '/reports', group: 'INTELLIGENCE' },
  { icon: GraduationCap, label: 'Lyceum', path: '/learn', group: 'INTELLIGENCE' },
  { icon: Sparkles, label: 'Content Engine', path: '/studio', group: 'CREATE' },
  { icon: FileText, label: 'Resume', path: '/resume', group: 'CREATE' },
  { icon: HeartHandshake, label: 'Life Phases', path: '/life', group: 'LIFE' },
  { icon: Wallet, label: 'Finance', path: '/finance', group: 'LIFE' },
  { icon: Shield, label: 'Agentic System', path: '/agentic', group: 'AGENTS' },
  { icon: BookOpen, label: 'Guide', path: '/guide', group: 'SYSTEM' },
  { icon: Settings, label: 'Settings', path: '/settings', group: 'SYSTEM' },
];

const GROUP_ORDER = ['OVERVIEW', 'RECORD', 'INTELLIGENCE', 'CREATE', 'LIFE', 'AGENTS', 'SYSTEM'];

const GROUP_KICKER: Record<string, string> = {
  OVERVIEW: 'OVERVIEW',
  RECORD: 'RECORD',
  INTELLIGENCE: 'INTELLIGENCE',
  CREATE: 'CREATE',
  LIFE: 'LIFE',
  AGENTS: 'AGENTS',
  SYSTEM: 'SYSTEM',
};

// ── Ruler: 24 ticks, labels at 00/06/12/18/24 ─────────────────────────
const RULER_LABELS: Record<number, string> = {
  0: '00', 6: '06', 12: '12', 18: '18', 23: '24',
};
const TICK_COUNT = 24;

function getNowTickPercent(): number {
  const now = new Date();
  return ((now.getHours() + now.getMinutes() / 60) / 24) * 100;
}

// ── Node dot ───────────────────────────────────────────────────────────
const NodeDot = memo(function NodeDot({
  item, isActive, collapsed, onNavigate,
}: {
  item: SidebarItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate: (path: string) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(item.path)}
      className={cn(
        'group relative flex items-center w-full transition-all duration-150',
        collapsed ? 'justify-center py-2' : 'gap-3 py-[7px] pl-2 pr-3',
      )}
      title={collapsed ? item.label : undefined}
    >
      {/* Dot on the line */}
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
      {/* Label (hidden in rail) */}
      {!collapsed && (
        <span
          className={cn(
            'text-[13px] truncate transition-colors duration-150 flex-1 text-left',
            isActive
              ? 'text-[var(--text-primary)] font-medium'
              : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]',
          )}
        >
          {item.label}
        </span>
      )}
      {/* Badge */}
      {!collapsed && item.badge && (
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[var(--text-muted)] font-medium tabular-nums">
          {item.badge}
        </span>
      )}
    </button>
  );
});

// ── Main component ─────────────────────────────────────────────────────
export const Sidebar = memo(function SidebarComponent({
  collapsed,
  onToggle,
  pathname,
}: {
  collapsed: boolean;
  onToggle: () => void;
  pathname?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const activePath = pathname ?? location.pathname;
  const [nowTick, setNowTick] = useState(getNowTickPercent);
  const [phoneConnected, setPhoneConnected] = useState(false);

  // Live now-tick: update once per minute (state, not animation loop)
  useEffect(() => {
    const id = setInterval(() => setNowTick(getNowTickPercent()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Phone connection polling
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const api = (window as any).deskflowAPI;
        if (!api?.listDevices) return;
        const r = await api.listDevices();
        if (alive) setPhoneConnected(r?.success && (r.devices?.length ?? 0) > 0);
      } catch { if (alive) setPhoneConnected(false); }
    };
    poll();
    const id = setInterval(poll, 30_000);
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

  const activeGroup = useMemo(() => {
    for (const item of SIDEBAR_ITEMS) {
      const p = item.path.split('?')[0];
      if (p === '/' ? activePath === '/' : activePath === p || activePath.startsWith(p + '/')) {
        return item.group;
      }
    }
    return undefined;
  }, [activePath]);

  return (
    <div
      className={cn(
        'flex h-full shrink-0 border-r border-zinc-800/60',
        'bg-[#0c0c0c]',
        collapsed ? 'w-[64px]' : 'w-[224px]',
      )}
      style={{
        transition: 'width 250ms cubic-bezier(0.16,1,0.3,1)',
        WebkitAppRegion: 'no-drag' as any,
      }}
    >
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
          {/* ── Now tick (live, once per minute) ───────────────── */}
          <div
            className="absolute left-[18px] z-10 pointer-events-none"
            style={{ top: `${nowTick}%`, transform: 'translateY(-50%)', transition: 'top 60s linear' }}
          >
            <span className="block w-[3px] h-[2px] bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          </div>
          {/* ── Nav position marker (where you are in the sidebar) ─ */}
          <div
            className="absolute left-[18px] z-10 pointer-events-none"
            style={{ top: `${activeNavPct}%`, transform: 'translateY(-50%)' }}
          >
            <span className="block w-3 h-3 rotate-45 bg-[var(--page-accent)]/90 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          </div>
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
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Expand sidebar"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest select-none">RHEO</span>
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

            {/* Groups + items */}
            <div className="flex-1 min-w-0">
              {GROUP_ORDER.map((group, gIdx) => {
                const items = grouped.get(group) ?? [];
                const isGroupActive = activeGroup === group;

                return (
                  <div key={group}>
                    {/* Group header (kicker) */}
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

                    {/* Items */}
                    <div className={collapsed ? 'px-1' : 'pl-1 pr-2'}>
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

                    {/* Group break: 3 tiny ticks crossing the hairline */}
                    {gIdx < GROUP_ORDER.length - 1 && (
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
            collapsed ? 'p-2' : 'px-3 py-2.5',
          )}
        >
          {collapsed ? (
            /* Rail mode: icon + connector to active nav item */
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={handleOpenPairModal}
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                    phoneConnected ? 'bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/30' : 'bg-zinc-700/40 text-zinc-400 hover:bg-zinc-700 hover:text-white',
                  )}
                  title={phoneConnected ? 'Phone connected — open pairing' : 'No phone — pair via QR'}
                >
                  <Smartphone className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <ThemeToggle size="sm" />
              </div>
            </div>
          ) : (
            /* Expanded: full instrument strip */
            <div className="flex items-center justify-between gap-2">
              {/* Left: LIVE dot + phone status */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Phone connection */}
                <div
                  className="flex items-center gap-1.5 cursor-default"
                  title={phoneConnected ? 'Phone connected' : 'No phone paired'}
                >
                  <Smartphone className={cn(
                    'w-3 h-3',
                    phoneConnected ? 'text-emerald-400' : 'text-zinc-600',
                  )} strokeWidth={1.5} />
                  <span className={cn(
                    'text-[10px] font-mono tabular-nums',
                    phoneConnected ? 'text-emerald-400' : 'text-zinc-600',
                  )}>
                    {phoneConnected ? 'SYNCED' : 'NO PHONE'}
                  </span>
                </div>
              </div>
              {/* Right: theme toggle + collapse hint */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-700 font-mono select-none">⌘K</span>
                <ThemeToggle size="sm" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Sidebar;
