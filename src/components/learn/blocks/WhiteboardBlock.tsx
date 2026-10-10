import React, { useRef, useEffect, useState } from 'react';

interface Props {
  meta: {
    initial_data?: string;
    read_only?: boolean;
    allow_export?: boolean;
    width?: string;
    height?: string;
  };
  onSave?: (data: string) => void;
}

export function WhiteboardBlock({ meta, onSave }: Props) {
  const { initial_data, read_only = false, allow_export = true, width = '100%', height = '400px' } = meta;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'excalidraw:save' && onSave) onSave(e.data.payload);
      if (e.data.type === 'excalidraw:ready') setIsLoaded(true);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSave]);

  useEffect(() => {
    if (iframeRef.current && initial_data && isLoaded) {
      iframeRef.current.contentWindow?.postMessage({ type: 'excalidraw:load', payload: initial_data }, '*');
    }
  }, [initial_data, isLoaded]);

  const excalidrawUrl = `https://excalidraw.com?theme=dark&embed=true${read_only ? '&readonly=true' : ''}`;

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <span className="text-base">✏️</span>
          Whiteboard
          {read_only && <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 font-normal">Read-only</span>}
        </div>
        {allow_export && !read_only && (
          <div className="flex gap-1.5">
            <button onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: 'excalidraw:export:png' }, '*')}
              className="text-xs px-3 py-1 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 transition-all">
              Export PNG
            </button>
            <button onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: 'excalidraw:export:svg' }, '*')}
              className="text-xs px-3 py-1 rounded-md border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 transition-all">
              Export SVG
            </button>
          </div>
        )}
      </div>
      <div className="relative" style={{ width, height }}>
        <iframe ref={iframeRef} src={excalidrawUrl} className="w-full h-full border-none" style={{ background: 'var(--ws-surface)' }}
          sandbox="allow-scripts allow-same-origin allow-popups" title="Whiteboard" />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 light:bg-[var(--ws-surface)] text-zinc-500 text-sm">
            Loading whiteboard...
          </div>
        )}
      </div>
    </div>
  );
}
