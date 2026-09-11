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
    try {
      // Dynamic import of KaTeX
      import('katex').then((katex) => {
        import('katex/dist/katex.min.css').then(() => {
          katex.default.render(block.tex, containerRef.current!, {
            displayMode: true,
            throwOnError: false,
          });
        });
      });
    } catch (err: any) {
      setError(err.message);
    }
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
