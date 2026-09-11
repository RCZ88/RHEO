import React, { useEffect, useRef, useState } from 'react';
import type { ChartBlock as ChartBlockType } from '../../../shared/learn/types';
import { isDynamicImportFailure, autoHealDynamicImport } from '../../ErrorBoundary';

interface Props {
  block: ChartBlockType;
  onAsk?: (blockId: string, question: string) => void;
}

export function ChartBlock({ block, onAsk }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    if (containerRef.current) containerRef.current.innerHTML = '';

    let spec: Record<string, unknown>;
    try {
      spec = block.parsed ?? JSON.parse(block.spec);
    } catch (e: any) {
      if (mounted) {
        setError(`Invalid chart spec: ${e.message}`);
        setLoading(false);
      }
      return;
    }

    import('vega-embed').then((vegaEmbed) => {
      if (!mounted) return;
      vegaEmbed.default(containerRef.current!, spec, {
        actions: false,
        renderer: 'svg',
        theme: 'dark',
      }).then(() => {
        if (mounted) {
          const svgEl = containerRef.current?.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.width = '100%';
            svgEl.style.height = 'auto';
          }
          setLoading(false);
        }
      }).catch((err: any) => {
        if (mounted) {
          setError(`Chart render error: ${err.message}`);
          setLoading(false);
        }
      });
    }).catch((err: any) => {
      if (mounted) {
        if (isDynamicImportFailure(err)) {
          autoHealDynamicImport();
          return;
        }
        setError(`Failed to load chart renderer: ${err?.message ?? err}`);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [block.id, block.spec, block.parsed, retry]);

  return (
    <div className="my-6 py-4 px-4 rounded-xl bg-zinc-800/30 border border-zinc-700/40 group relative min-h-[220px]" data-block-id={block.id}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-zinc-900/50">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-clay-400 rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="relative z-10 text-red-400 text-sm">
          <div>{error}</div>
          <pre className="mt-2 text-xs bg-zinc-900/50 p-2 rounded overflow-x-auto">{block.spec}</pre>
          <button
            onClick={() => setRetry((r) => r + 1)}
            className="mt-2 text-xs font-medium text-clay-400 hover:text-clay-300 transition"
          >
            ↻ Retry
          </button>
        </div>
      )}
      <div ref={containerRef} className={error ? 'hidden' : ''} />
      {block.caption && (
        <div className="mt-2 text-sm text-zinc-500 italic text-center">{block.caption}</div>
      )}
      {onAsk && (
        <button
          onClick={() => onAsk(block.id, `Explain this chart`)}
          className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}
