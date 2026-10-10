import React, { useEffect, useRef, useState } from 'react';
import type { MermaidBlock } from '../../../shared/learn/types';
import { loadMermaid, renderMermaidWithTimeout } from './mermaidLoader';
import { ZoomPan } from './ZoomPan';

interface Props {
  block: MermaidBlock;
  onAsk?: (blockId: string, question: string) => void;
}

export function MermaidBlock({ block, onAsk }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    loadMermaid().then(async (m) => {
      if (!mounted) return;

      try {
        // Generate a unique ID to avoid conflicts with multiple diagrams
        const diagramId = `mermaid-${block.id}-${Date.now()}`;
        const { svg } = await renderMermaidWithTimeout(m, diagramId, block.src);

        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            const vb = svgEl.getAttribute('viewBox');
            let nw = 800, nh = 400;
            if (vb) {
              const parts = vb.split(/\s+/).map(Number);
              if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                nw = parts[2];
                nh = parts[3];
              }
            }
            svgEl.removeAttribute('height');
            svgEl.removeAttribute('width');
            svgEl.style.removeProperty('max-width');
            svgEl.style.maxWidth = 'none';
            svgEl.style.width = nw + 'px';
            svgEl.style.height = nh + 'px';
            svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            const wrapper = containerRef.current;
            if (wrapper) {
              wrapper.setAttribute('data-nat-w', String(nw));
              wrapper.setAttribute('data-nat-h', String(nh));
            }
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          // Extract the useful part of the error message
          const msg = err?.message || String(err);
          // Mermaid often wraps the real error in a longer message
          const shortMsg = msg.includes('Syntax error')
            ? `Mermaid syntax error — check the diagram source below`
            : msg.length > 200 ? msg.slice(0, 200) + '...' : msg;
          setError(shortMsg);
          setLoading(false);
        }
      }
    }).catch((err: any) => {
      if (mounted) {
        setError(`Failed to load Mermaid library: ${err?.message ?? err}`);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [block.src, block.id]);

  return (
    <div className="my-6 rounded-xl bg-zinc-800/30 border border-zinc-700/40 overflow-hidden group relative" data-block-id={block.id}>
      {loading && (
        <div className="h-40 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-clay-400 rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="p-4 text-sm">
          <div className="text-amber-400 font-medium mb-1">⚠ Diagram could not render</div>
          <div className="text-zinc-500 text-xs mb-2">{error}</div>
          <details className="group/details">
            <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition">Show diagram source</summary>
            <pre className="mt-2 text-xs bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] p-3 rounded overflow-x-auto text-zinc-400 border border-zinc-800/50">{block.src}</pre>
          </details>
        </div>
      )}
      {!error && (
        <div className="p-4">
          <ZoomPan>
            <div ref={containerRef} />
          </ZoomPan>
        </div>
      )}
      {block.caption && (
        <div className="px-4 pb-3 text-sm text-zinc-500 italic text-center">{block.caption}</div>
      )}
      {onAsk && (
        <button
          onClick={() => onAsk(block.id, `Explain this diagram`)}
          className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}
