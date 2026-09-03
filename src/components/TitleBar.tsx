import { useState, useEffect, useCallback } from 'react';
import { Minus, Square, X } from 'lucide-react';

// Live accessor — resolved fresh each call so the preload bridge is always visible
const api = () => (window as any)?.deskflowAPI ?? null;

function callApi<T>(fn: (api: any) => T): T | undefined {
  try {
    const a = api();
    return a ? fn(a) : undefined;
  } catch { return undefined; }
}

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

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

    const unsub = api?.onWindowFocusChange?.((focused: boolean) => {
      setIsFocused(focused);
      refreshState();
    });

    const bar = document.querySelector('[data-titlebar-drag]');
    const onDblClick = () => callApi(a => a.windowMaximize?.());
    bar?.addEventListener('dblclick', onDblClick);

    return () => {
      clearInterval(poll);
      unsub?.();
      bar?.removeEventListener('dblclick', onDblClick);
    };
  }, [refreshState]);

  const handleMinimize = () => callApi(a => a.windowMinimize?.());
  const handleMaximize = () => callApi(a => a.windowMaximize?.());
  const handleClose = () => callApi(a => a.windowClose?.());
  const handleNotifyClick = () => callApi(a => a.notifyClick?.());

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
      onClick={handleNotifyClick}
    >
      <div className="flex-1 h-full" />

      <div
        className="flex items-center h-full shrink-0"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
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
                fill="none"
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
