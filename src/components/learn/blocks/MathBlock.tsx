import React, { useEffect, useRef, useState } from 'react';
import type { MathBlock } from '../../../shared/learn/types';

interface Props {
  block: MathBlock;
  onAsk?: (blockId: string, question: string) => void;
}

export function MathBlock({ block, onAsk }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    // NOTE: `try/catch` around an `import()` is USELESS — a rejected dynamic
    // import is a promise rejection, not a synchronous throw, so it sails
    // straight past the try block and out of the component. Unhandled, it
    // reached the global error router, which classified it as a stale-chunk
    // failure and called `window.location.reload()` — i.e. a single missing
    // KaTeX chunk RESTARTED THE WHOLE APP when opening a lesson. Every lazy
    // import in a lesson block must catch its own failure and degrade that
    // block locally; only the app's own top-level chunk is worth a reload.
    import('katex')
      .then((katex) =>
        import('katex/dist/katex.min.css').then(() => {
          if (cancelled || !containerRef.current) return;
          katex.default.render(block.tex, containerRef.current, {
            displayMode: true,
            throwOnError: false,
          });
        })
      )
      .catch((err: any) => {
        if (cancelled) return;
        console.warn('[MathBlock] KaTeX unavailable:', err?.message ?? err);
        setError(
          err?.message?.includes('dynamically imported') || err?.message?.includes('Failed to fetch')
            ? 'Math rendering is unavailable right now (the app was updated while open). Reopen the app to restore it.'
            : err?.message || 'Math could not be rendered.'
        );
      });
    return () => { cancelled = true; };
  }, [block.tex]);

  return (
    <div className="my-6 py-4 px-6 rounded-xl bg-zinc-800/30 border border-zinc-700/40 group relative" data-block-id={block.id}>
      <div className="overflow-x-auto">
        <div ref={containerRef} className="katex-scroll inline-block min-w-full text-center text-lg text-zinc-100 min-h-[2rem]" />
      </div>
      {error && <div className="text-red-400 text-xs mt-2">KaTeX error: {error}</div>}
      {block.caption && (
        <div className="mt-2 text-sm text-zinc-500 italic">{block.caption}</div>
      )}
      {onAsk && (
        <button
          onClick={() => onAsk(block.id, `Explain this formula: ${block.tex}`)}
          className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
          title="Ask about this"
        >
          💡
        </button>
      )}
    </div>
  );
}
