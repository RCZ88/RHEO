import React, { useEffect, useRef, useCallback } from 'react';
import type { AnnotatedMathBlock } from '../../../shared/learn/types';

interface Props {
  block: AnnotatedMathBlock;
  onAsk?: (blockId: string, question: string) => void;
  activeRefId?: string | null;
  onRefHover?: (id: string | null) => void;
  onRefClick?: (id: string) => void;
}

export function AnnotatedMathBlock({ block, onAsk, activeRefId, onRefHover, onRefClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleCardMouseEnter = useCallback((id: string) => onRefHover?.(id), [onRefHover]);
  const handleCardMouseLeave = useCallback(() => onRefHover?.(null), [onRefHover]);
  const handleClick = useCallback((id: string) => onRefClick?.(id), [onRefClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    // A `try/catch` around `import()` catches nothing — a failed dynamic import
    // is a rejection, so it escaped this component, hit the global error router,
    // and was classified as a stale chunk → `window.location.reload()`. One
    // missing KaTeX chunk restarted the entire app from inside a lesson.
    import('katex')
      .then((katex) =>
        import('katex/dist/katex.min.css').then(() => {
          if (cancelled || !containerRef.current) return;
          katex.default.render(block.tex, containerRef.current, {
            displayMode: true,
            throwOnError: false,
            trust: true,
          });
        })
      )
      .catch((err: any) => {
        if (cancelled) return;
        console.warn('[AnnotatedMathBlock] KaTeX unavailable:', err?.message ?? err);
      });
    return () => { cancelled = true; };
  }, [block.tex]);

  // Highlight matching KaTeX spans when activeRefId changes
  useEffect(() => {
    if (!containerRef.current) return;
    const allEls = containerRef.current.querySelectorAll('[id]');
    allEls.forEach((el) => {
      if (activeRefId && el.id === activeRefId) {
        el.classList.add('anno-hot');
      } else {
        el.classList.remove('anno-hot');
      }
    });
  }, [activeRefId, block.tex]);

  // Delegate hover on rendered KaTeX elements
  const handleContainerMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as Element).closest('[id]');
    if (target) {
      const id = target.getAttribute('id');
      if (id && id.startsWith('m-')) onRefHover?.(id);
    }
  }, [onRefHover]);

  const handleContainerMouseOut = useCallback(() => {
    onRefHover?.(null);
  }, [onRefHover]);

  return (
    <div className="my-6 rounded-xl border border-zinc-700/40 bg-zinc-800/30 overflow-hidden" data-block-id={block.id}>
      <div className="flex min-h-0">
        <div className="flex-1 py-4 px-6 overflow-x-auto">
          <div
            ref={containerRef}
            className="katex-scroll inline-block min-w-full text-center text-lg text-zinc-100 min-h-[2rem]"
            onMouseOver={handleContainerMouseOver}
            onMouseOut={handleContainerMouseOut}
          />
        </div>
        {block.annotations.length > 0 && (
          <div className="w-64 shrink-0 overflow-y-auto p-3 space-y-2 border-l border-zinc-700/30">
            {block.annotations.map((a) => {
              const isActive = activeRefId === a.id;
              return (
                <div
                  key={a.id}
                  className={`p-2.5 rounded-lg border text-xs transition-all duration-100 ${
                    isActive
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                      : 'border-zinc-700/30 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-300 hover:border-zinc-600/50'
                  }`}
                  onMouseEnter={() => handleCardMouseEnter(a.id)}
                  onMouseLeave={handleCardMouseLeave}
                  onClick={() => handleClick(a.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="font-mono text-[10px] text-amber-400/80">@{a.id}</span>
                  <p className="mt-1 leading-relaxed">{a.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
