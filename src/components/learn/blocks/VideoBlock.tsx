import React from 'react';
import type { VideoBlock } from '../../../shared/learn/types';

interface Props {
  block: VideoBlock;
  onAsk?: (blockId: string, question: string) => void;
}

export function VideoBlock({ block, onAsk }: Props) {
  const [clicked, setClicked] = React.useState(false);

  const getEmbedUrl = () => {
    if (block.provider === 'youtube') {
      return `https://www.youtube.com/embed/${block.ref}`;
    }
    if (block.provider === 'vimeo') {
      return `https://player.vimeo.com/video/${block.ref}`;
    }
    return block.ref;
  };

  return (
    <figure className="my-6 group relative" data-block-id={block.id}>
      <div className="rounded-xl overflow-hidden border border-zinc-700/40 bg-zinc-800/30 aspect-video relative">
        {!clicked ? (
          <button
            onClick={() => setClicked(true)}
            className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] hover:bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] transition cursor-pointer"
          >
            <div className="text-center">
              <div className="text-4xl mb-2">▶️</div>
              <div className="text-sm text-zinc-400">Click to load video</div>
              <div className="text-xs text-zinc-600 mt-1">{block.provider}</div>
            </div>
          </button>
        ) : (
          <iframe
            src={getEmbedUrl()}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-sm text-zinc-500 italic text-center">{block.caption}</figcaption>
      )}
      <div className="mt-1 flex items-center justify-center gap-2 text-[10px] text-zinc-600">
        <span>Source: {block.source}</span>
        <span>·</span>
        <span>{block.license}</span>
      </div>
    </figure>
  );
}
