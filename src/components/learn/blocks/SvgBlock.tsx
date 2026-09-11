import React from 'react';
import DOMPurify from 'dompurify';
import type { SvgBlock } from '../../../shared/learn/types';
import { ZoomPan } from './ZoomPan';

interface Props {
  block: SvgBlock;
  onAsk?: (blockId: string, question: string) => void;
}

export function SvgBlock({ block, onAsk }: Props) {
  const clean = DOMPurify.sanitize(block.svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onload', 'onclick', 'onerror'],
  });

  return (
    <figure className="my-6" data-block-id={block.id}>
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-4 text-clay-300 group relative">
        <ZoomPan>
          <div
            className="[&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-none"
            dangerouslySetInnerHTML={{ __html: clean }}
          />
        </ZoomPan>
        {onAsk && (
          <button
            onClick={() => onAsk(block.id, 'Explain this figure')}
            className="absolute -right-6 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 text-xs"
            title="Ask about this"
          >
            💡
          </button>
        )}
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-sm text-zinc-500 italic text-center">{block.caption}</figcaption>
      )}
    </figure>
  );
}
