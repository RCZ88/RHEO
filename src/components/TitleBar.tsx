import { useState, useEffect, useCallback, useRef } from 'react';
import { Minus, Square, X, Bell, Eye, MousePointer2, Clock, Settings2 } from 'lucide-react';

// Live accessor — resolved fresh each call so the preload bridge is always visible
const api = () => (window as any)?.deskflowAPI ?? null;

function callApi<T>(fn: (api: any) => T): T | undefined {
  try {
    const a = api();
    return a ? fn(a) : undefined;
  } catch { return undefined; }
}

export default function TitleBar({
  onOpenNotifPanel,
}: {
  onOpenNotifPanel?: () => void
}) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Title bar auto-hide state ──
  const [tbMode, setTbMode] = useState<'always' | 'hover' | 'auto'>('always');
  const [hidden, setHidden] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load title bar mode from API on mount
  useEffect(() => {
    const a = api();
    if (!a?.getTitleBarMode) return;
    a.getTitleBarMode().then(m => {
      if (m && typeof m === 'string') setTbMode(m as TbMode);
    }).catch(() => {});
  }, []);

  const setMode = useCallback((mode: 'always' | 'hover' | 'auto') => {
    setTbMode(mode);
    setHidden(false);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const a = api();
    if (a?.setTitleBarMode) a.setTitleBarMode(mode).catch(() => {});
  }, []);

  // Auto-hide timer for 'auto' mode (3s inactivity)
  const resetAutoTimer = useCallback(() => {
    if (tbMode !== 'auto' || hidden) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      if (tbMode === 'auto' && !hidden) setHidden(true);
    }, 3000);
  }, [tbMode, hidden]);

  // Mouse leaves title bar → schedule hide (for hover mode)
  const onMouseLeave = useCallback(() => {
    if (tbMode === 'always') return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (tbMode === 'hover') setHidden(true);
    }, tbMode === 'auto' ? 300 : 150);
  }, [tbMode]);

  // Mouse enters title bar → show immediately
  const onMouseEnter = useCallback(() => {
    if (tbMode === 'always') return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHidden(false);
    resetAutoTimer();
  }, [tbMode, resetAutoTimer]);

  // Thin shelf hover → reveal title bar
  const onShelfEnter = useCallback(() => {
    if (tbMode !== 'always' && hidden) {
      setHidden(false);
      resetAutoTimer();
    }
  }, [tbMode, hidden, resetAutoTimer]);

  // Reset auto timer on any document mousemove when visible
  useEffect(() => {
    if (tbMode !== 'auto' || hidden) return;
    const onMove = () => resetAutoTimer();
    document.addEventListener('mousemove', onMove);
    resetAutoTimer();
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [tbMode, hidden, resetAutoTimer]);

  // Close settings on click outside
  const settingsRef = useRef<HTMLDivElement>(null);

  // Listen for command palette / external trigger to open settings
  useEffect(() => {
    const fn = () => setSettingsOpen(true);
    window.addEventListener('open-titlebar-settings', fn);
    return () => window.removeEventListener('open-titlebar-settings', fn);
  }, []);
  useEffect(() => {
    if (!settingsOpen) return;
    const fn = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [settingsOpen]);

  // ── Original refresh logic ──
  const refreshState = useCallback(async () => {
    try {
      const max = await callApi(a => a.windowIsMaximized?.());
      setIsMaximized(!!max);
    } catch { /* ignore */ }
    try {
      const foc = await callApi(a => a.windowIsFocused?.());
      setIsFocused(!!foc);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshState();
    const poll = setInterval(refreshState, 500);

    const unsubFocus = (() => { const fn = api()?.onWindowFocusChange; return fn ? fn((focused: boolean) => { setIsFocused(focused); refreshState(); }) : undefined; })();

    let cancelled = false;
    const refreshUnread = async () => {
      try {
        const res = await callApi(a => a.notificationsGet?.());
        if (!cancelled && res) setUnreadCount(res.unread ?? 0);
      } catch {}
    };
    refreshUnread();
    const unreadInterval = setInterval(refreshUnread, 10_000);

    const onNotifPush = () => {
      if (!cancelled) setUnreadCount(c => c + 1);
    };
    window?.addEventListener?.('notification:new', onNotifPush);

    const bar = document.querySelector('[data-titlebar-drag]');
    const onDblClick = () => callApi(a => a.windowMaximize?.());
    bar?.addEventListener('dblclick', onDblClick);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(unreadInterval);
      unsubFocus?.();
      window?.removeEventListener?.('notification:new', onNotifPush);
      bar?.removeEventListener('dblclick', onDblClick);
    };
  }, [refreshState]);

  const handleMinimize = () => callApi(a => a.windowMinimize?.());
  const handleMaximize = () => callApi(a => a.windowMaximize?.());
  const handleClose = () => callApi(a => a.windowClose?.());
  const handleNotifyClick = () => {
    onOpenNotifPanel?.();
  };

  // ── Render helpers ──
  const modeIcons: Record<TbMode, React.ReactNode> = {
    always: <Eye size={13} />,
    hover: <MousePointer2 size={13} />,
    auto: <Clock size={13} />,
  };
  const modeLabels = {
    always: 'Always show',
    hover: 'Hide / hover to show',
    auto: 'Auto-hide after 3s',
  };

  // Build the title bar content (shared between always and hover/auto modes)
  const buildTitleBar = () => (
    <div
      className="relative z-20 shrink-0 h-9 flex items-center justify-between select-none light:bg-stone-200/90"
      style={{
        background: isFocused ? '#1a1a1a' : '#111111',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        WebkitAppRegion: 'drag',
      }}
      data-titlebar-drag
    >
      <div className="flex-1 h-full" />
      <div
        className="flex items-center h-full shrink-0"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={handleNotifyClick}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-white/5 relative light:hover:bg-stone-300/50"
          title="Notifications"
        >
          <Bell
            className="w-3.5 h-3.5 transition-colors"
            style={{
              color: unreadCount > 0
                ? (isFocused ? '#fbbf24' : '#d97706')
                : isFocused ? '#a1a1aa' : '#52525b',
              light: unreadCount > 0 ? '#b45309' : '#57534e',
            }}
            strokeWidth={1.5}
          />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex items-center justify-center text-[10px] font-bold text-white light:text-stone-900"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: unreadCount > 0 ? '#fbbf24' : 'transparent',
                border: '2px solid #121212',
                boxShadow: '0 0 0 2px #121212',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={handleMinimize}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-white/5 light:hover:bg-stone-300/50"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5 transition-colors text-zinc-400 light:text-stone-500" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-white/5 light:hover:bg-stone-300/50"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <span className="relative" style={{ width: 14, height: 14 }}>
              <Square
                className="absolute transition-colors text-zinc-400 light:text-stone-500"
                style={{ top: 1, left: 1, width: 11, height: 11 }}
                strokeWidth={1.5}
              />
              <Square
                className="absolute transition-colors text-zinc-400 light:text-stone-500"
                style={{ top: 4, left: 4, width: 11, height: 11, fill: 'currentColor', fillOpacity: isFocused ? 0.15 : 0.1 }}
                strokeWidth={1.5}
              />
            </span>
          ) : (
            <Square className="w-3.5 h-3.5 transition-colors text-zinc-400 light:text-stone-500" strokeWidth={1.5} fill="none" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-red-500/10 light:hover:bg-red-200/40"
          title="Close"
        >
          <X className="w-3.5 h-3.5 transition-colors group-hover:text-red-400 text-zinc-400 light:text-stone-500" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="group h-full w-10 flex items-center justify-center transition-colors hover:bg-white/5 light:hover:bg-stone-300/50"
          title="Title bar settings"
        >
          <Settings2 className="w-3.5 h-3.5 transition-colors text-zinc-400 light:text-stone-500" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );

  // ── Always show mode ──
  if (tbMode === 'always') {
    return (
      <div className="relative z-20">
        <div onMouseLeave={onMouseLeave} onMouseEnter={onMouseEnter}>
          {buildTitleBar()}
        </div>
        {/* Settings dropdown */}
        {settingsOpen && (
          <div ref={settingsRef}
            className="fixed top-[52px] right-4 z-50 rounded-xl border overflow-hidden shadow-2xl min-w-[210px]"
            style={{ background: '#1a1a1a', borderColor: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Settings2 size={12} style={{ color: '#a1a1aa' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Title bar</span>
            </div>
            {(['always', 'hover', 'auto'] as const).map((m) => (
              <button key={m}
                onClick={() => { setMode(m); setSettingsOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/5 cursor-pointer"
              >
                {modeIcons[m]}
                <span className="flex-1 text-[12px]" style={{ color: '#d4d4d8' }}>{modeLabels[m]}</span>
                {tbMode === m && (
                  <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full border" style={{ borderColor: '#22c55e', color: '#22c55e' }}>on</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Hover / Auto mode: thin shelf + animated title bar ──
  return (
    <div className="relative z-20" ref={settingsRef}>
      {/* Thin shelf strip that stays visible to catch hover */}
      <div
        className="h-[3px] shrink-0 flex items-center justify-end pr-2 cursor-default transition"
        style={{ background: isFocused ? '#1a1a1a' : '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        onMouseEnter={onShelfEnter}
      >
        {hidden && (
          <MousePointer2 size={8} style={{ color: '#52525b', opacity: 0.4 }} />
        )}
      </div>
      {/* Title bar — slides up/down */}
      <div
        className="shrink-0 overflow-hidden"
        style={{
          transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 0.15s ease',
          height: '37px', // h-9 + border
        }}
        onMouseLeave={onMouseLeave}
        onMouseEnter={onMouseEnter}
      >
        {buildTitleBar()}
      </div>
      {/* Settings dropdown */}
      {settingsOpen && (
        <div className="fixed top-[52px] right-4 z-50 rounded-xl border overflow-hidden shadow-2xl min-w-[210px]"
          style={{ background: '#1a1a1a', borderColor: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Settings2 size={12} style={{ color: '#a1a1aa' }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>Title bar</span>
          </div>
          {(['always', 'hover', 'auto'] as const).map((m) => (
            <button key={m}
              onClick={() => { setMode(m); setSettingsOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/5 cursor-pointer"
            >
              {modeIcons[m]}
              <span className="flex-1 text-[12px]" style={{ color: '#d4d4d8' }}>{modeLabels[m]}</span>
              {tbMode === m && (
                <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full border" style={{ borderColor: '#22c55e', color: '#22c55e' }}>on</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
