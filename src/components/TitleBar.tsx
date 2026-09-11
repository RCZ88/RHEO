import { useState, useEffect, useCallback } from 'react';
import { Minus, Square, X, Bell } from 'lucide-react';

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

  // Poll unread count every 10s so the bell badge stays fresh even when the
  // window is hidden (notifications arrive via main-process checker).
  useEffect(() => {
    refreshState();
    const poll = setInterval(refreshState, 500);

    const unsubFocus = api?.onWindowFocusChange?.(
      (focused: boolean) => {
        setIsFocused(focused);
        refreshState();
      },
    );

    let cancelled = false;
    const refreshUnread = async () => {
      try {
        const res = await callApi(a => a.notificationsGet?.());
        if (!cancelled && res) setUnreadCount(res.unread ?? 0);
      } catch {}
    };
    refreshUnread();
    const unreadInterval = setInterval(refreshUnread, 10_000);

    // Live push: main process emits 'notification:new' on every enqueue — no
    // more waiting for the 10s poll to update the badge.
    const unsubNotif = window?.addEventListener?.(
      'notification:new',
      (e: any) => {
        if (!cancelled) setUnreadCount(c => c + 1);
      },
    );

    const bar = document.querySelector('[data-titlebar-drag]');
    const onDblClick = () => callApi(a => a.windowMaximize?.());
    bar?.addEventListener('dblclick', onDblClick);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(unreadInterval);
      unsubFocus?.();
      unsubNotif?.();
      bar?.removeEventListener('dblclick', onDblClick);
    };
  }, [refreshState]);

  const handleMinimize = () => callApi(a => a.windowMinimize?.());
  const handleMaximize = () => callApi(a => a.windowMaximize?.());
  const handleClose = () => callApi(a => a.windowClose?.());
  const handleNotifyClick = () => {
    onOpenNotifPanel?.()
  };

  return (
    <div
      className="shrink-0 h-9 flex items-center justify-between select-none"
      style={{
        background: isFocused
          ? 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)'
          : 'linear-gradient(180deg, #111111 0%, #0d0d0d 100%)',
        borderBottom: 'none',
        WebkitAppRegion: 'drag',
      }}
      data-titlebar-drag
    >
      <div className="flex-1 h-full" />

      {/* Notification bell — separate no-drag zone so dragging the titlebar
          does NOT open the notification panel. */}
      <div
        className="flex items-center h-full shrink-0"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={handleNotifyClick}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-white/5 relative"
          title="Notifications"
        >
          <Bell
            className="w-3.5 h-3.5 transition-colors"
            style={{
              color: unreadCount > 0
                ? (isFocused ? '#fbbf24' : '#d97706')
                : isFocused ? '#a1a1aa' : '#52525b',
            }}
            strokeWidth={1.5}
          />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex items-center justify-center
                text-[10px] font-bold text-white"
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'var(--accent, #6366f1)',
                boxShadow: '0 0 0 2px #121212',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={handleMinimize}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-white/5"
          title="Minimize"
        >
          <Minus
            className="w-3.5 h-3.5 transition-colors"
            style={{ color: isFocused ? '#a1a1aa' : '#52525b' }}
            strokeWidth={1.5}
          />
        </button>

        <button
          onClick={handleMaximize}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-white/5"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <span className="relative" style={{ width: 14, height: 14 }}>
              <Square
                className="absolute transition-colors"
                style={{
                  top: 1,
                  left: 1,
                  width: 11,
                  height: 11,
                  color: isFocused ? '#a1a1aa' : '#52525b',
                }}
                strokeWidth={1.5}
              />
              <Square
                className="absolute transition-colors"
                style={{
                  top: 4,
                  left: 4,
                  width: 11,
                  height: 11,
                  color: isFocused ? '#a1a1aa' : '#52525b',
                  fill: 'currentColor',
                  fillOpacity: isFocused ? 0.15 : 0.1,
                }}
                strokeWidth={1.5}
              />
            </span>
          ) : (
            <Square
              className="w-3.5 h-3.5 transition-colors"
              style={{ color: isFocused ? '#a1a1aa' : '#52525b' }}
              strokeWidth={1.5}
              fill="none"
            />
          )}
        </button>

        <button
          onClick={handleClose}
          className="group h-full w-12 flex items-center justify-center transition-colors hover:bg-red-500/10"
          title="Close"
        >
          <X
            className="w-3.5 h-3.5 transition-colors group-hover:text-red-400"
            style={{ color: isFocused ? '#a1a1aa' : '#52525b' }}
            strokeWidth={1.5}
          />
        </button>
      </div>
    </div>
  );
}
