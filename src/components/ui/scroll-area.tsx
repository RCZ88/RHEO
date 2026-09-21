import { type ReactNode, useRef, useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onScrollChange?: (pinned: boolean) => void;
}

export function ScrollArea({ children, className = '', contentClassName = '', onScrollChange }: ScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [showFade, setShowFade] = useState(false);

  const handleScroll = useCallback(() => {
    if (!ref.current) return;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    const isPinned = scrollHeight - scrollTop - clientHeight < 60;
    setPinned(isPinned);
    setShowFade(scrollTop > 8);
    onScrollChange?.(isPinned);
  }, [onScrollChange]);

  return (
    <div className={`relative ${className}`}>
      {showFade && <div className="sticky top-0 h-6 -mt-4 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none z-10" />}
      <div
        ref={ref}
        onScroll={handleScroll}
        className={`absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent ${contentClassName}`}
      >
        {children}
      </div>
      {!pinned && (
        <button
          onClick={() => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })}
          className="absolute bottom-4 right-5 rounded-full bg-zinc-800/90 border border-zinc-700/50 px-3 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-700 transition-all z-10"
        >
          <ChevronDown className="w-3 h-3 inline mr-1" />
          Jump to latest
        </button>
      )}
    </div>
  );
}
