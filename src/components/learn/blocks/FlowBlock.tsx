import React, { useEffect, useRef, useState } from 'react';
import type { FlowBlock as FlowBlockType } from '../../../shared/learn/types';
import { ZoomPan } from './ZoomPan';
import { loadMermaid, renderMermaidWithTimeout } from './mermaidLoader';

interface Props {
  block: FlowBlockType;
  onAsk?: (blockId: string, question: string) => void;
}

function edgesToMermaid(block: FlowBlockType): string {
  if (block.edges && block.edges.length > 0) {
    if (block.variant === 'sankey') {
      // Mermaid 11 sankey grammar is CSV (RFC 4180), 3 columns:
      // source,target,value — NOT "A --> B : 10" (that syntax fails to parse
      // with "Expecting 'COMMA'" on any node name containing a space).
      const lines = block.edges.map((e) => {
        const from = /[",]/.test(e.from) ? `"${e.from.replaceAll('"', '""')}"` : e.from;
        const to = /[",]/.test(e.to) ? `"${e.to.replaceAll('"', '""')}"` : e.to;
        return `${from},${to},${e.value}`;
      });
      return `sankey-beta\n${lines.join('\n')}`;
    }
    const lines = block.edges.map((e) => `${JSON.stringify(e.from)}[${e.from}] --> ${JSON.stringify(e.to)}[${e.to}]`);
    return `flowchart LR\n${lines.join('\n')}`;
  }
  return block.spec;
}

export function FlowBlock({ block, onAsk }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const mermaidSrc = edgesToMermaid(block);

    loadMermaid().then(async (m) => {
      if (!mounted) return;

      try {
        const diagramId = `flow-${block.id}-${Date.now()}`;
        const { svg } = await renderMermaidWithTimeout(m, diagramId, mermaidSrc);

        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.removeAttribute('height');
            svgEl.removeAttribute('width');
            svgEl.style.removeProperty('max-width');
            svgEl.style.width = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.maxWidth = 'none';
            svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          const msg = err?.message || String(err);
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
  }, [block.id, block.spec, block.edges, block.variant]);

  return (
    <div className="my-6 py-4 px-4 rounded-xl bg-zinc-800/30 border border-zinc-700/40 group relative" data-block-id={block.id}>
      {loading && (
        <div className="h-40 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-clay-400 rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-sm">
          <div className="text-amber-400 font-medium mb-1">⚠ Diagram could not render</div>
          <div className="text-zinc-500 text-xs mb-2">{error}</div>
          <details className="group/details">
            <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition">Show diagram source</summary>
            <pre className="mt-2 text-xs bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] p-3 rounded overflow-x-auto text-zinc-400 border border-zinc-800/50">{edgesToMermaid(block)}</pre>
          </details>
        </div>
      )}
      {!error && (
        <ZoomPan>
          <div ref={containerRef} />
        </ZoomPan>
      )}
      {block.caption && (
        <div className="mt-2 text-sm text-zinc-500 italic text-center">{block.caption}</div>
      )}
      {onAsk && (
        <button
          onClick={() => onAsk(block.id, `Explain this ${block.variant} diagram`)}
          className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}
