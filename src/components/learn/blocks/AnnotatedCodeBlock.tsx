import React, { useCallback } from 'react';
import type { AnnotatedCodeBlock } from '../../../shared/learn/types';

interface Props {
  block: AnnotatedCodeBlock;
  onAsk?: (blockId: string, question: string) => void;
  activeRefId?: string | null;
  onRefHover?: (id: string | null) => void;
  onRefClick?: (id: string) => void;
}

export function AnnotatedCodeBlock({ block, onAsk, activeRefId, onRefHover, onRefClick }: Props) {
  const lines = block.code.split('\n');
  const handleLineMouseEnter = useCallback((id: string) => onRefHover?.(id), [onRefHover]);
  const handleLineMouseLeave = useCallback(() => onRefHover?.(null), [onRefHover]);
  const handleCardMouseEnter = useCallback((id: string) => onRefHover?.(id), [onRefHover]);
  const handleCardMouseLeave = useCallback(() => onRefHover?.(null), [onRefHover]);
  const handleClick = useCallback((id: string) => onRefClick?.(id), [onRefClick]);

  return (
    <div className="my-6 rounded-xl border border-zinc-700/40 bg-zinc-800/30 overflow-hidden" data-block-id={block.id}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-700/30">
        <span className="text-[10px] font-mono text-zinc-500 uppercase">{block.lang}</span>
        <span className="text-[10px] text-zinc-600">{block.targets.length} annotations</span>
      </div>
      <div className="flex min-h-0">
        <div className="flex-1 overflow-x-auto font-mono text-[12px] leading-relaxed border-r border-zinc-700/30">
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const target = block.targets.find((t) => t.line === lineNum);
            const isActive = target && activeRefId === target.id;
            return (
              <div
                key={i}
                className={`flex items-stretch ${isActive ? 'bg-amber-500/15' : 'hover:bg-zinc-700/20'} transition-colors duration-100`}
                data-target-id={target?.id}
                onMouseEnter={target ? () => handleLineMouseEnter(target.id) : undefined}
                onMouseLeave={target ? handleLineMouseLeave : undefined}
                onClick={target ? () => handleClick(target.id) : undefined}
                style={target ? { cursor: 'pointer' } : undefined}
              >
                <span className="w-10 shrink-0 text-right pr-3 py-1 text-zinc-600 select-none text-[11px]">{lineNum}</span>
                <span className="flex-1 py-1 pr-4 text-zinc-200 whitespace-pre">{line || ' '}</span>
                {target && (
                  <span className="shrink-0 w-5 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="w-72 shrink-0 overflow-y-auto p-3 space-y-2">
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
      </div>
    </div>
  );
}
