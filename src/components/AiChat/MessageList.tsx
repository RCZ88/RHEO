import React, { type FC, type ReactNode, useEffect, useRef, useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

type Props = {
  children: ReactNode
  loading?: boolean
  onScrollChange?: (isPinned: boolean) => void
}

function BubbleSkeleton({ align }: { align: 'left' | 'right' }) {
  return (
    <div className={`flex gap-3 px-4 py-3 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className="w-6 h-6 rounded-lg shrink-0 bg-zinc-800/60 animate-pulse" />
      <div className={`flex flex-col gap-2 ${align === 'right' ? 'items-end' : ''}`}>
        <div className={`h-4 rounded bg-zinc-800/60 animate-pulse ${align === 'right' ? 'w-32' : 'w-48'}`} />
        <div className={`h-4 rounded bg-zinc-800/40 animate-pulse ${align === 'right' ? 'w-24' : 'w-36'}`} />
      </div>
    </div>
  );
}

export const MessageList: FC<Props> = ({ children, loading, onScrollChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPinned, setIsPinned] = useState(true)
  const [showFade, setShowFade] = useState(false)
  const prevChildrenCount = useRef(0)

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const pinned = scrollHeight - scrollTop - clientHeight < 60
    setIsPinned(pinned)
    setShowFade(scrollTop > 8)
    onScrollChange?.(pinned)
  }, [onScrollChange])

  useEffect(() => {
    if (isPinned && containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [children, isPinned])

  const childrenCount = React.Children.count(children)
  useEffect(() => { prevChildrenCount.current = childrenCount }, [childrenCount])

  return (
    <div className="relative flex-1 min-h-0">
      {showFade && (
        <div className="sticky top-0 h-6 -mt-4 bg-[linear-gradient(180deg,#09090b,transparent)] pointer-events-none z-10" />
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
      >
        {loading ? (
          <>
            <BubbleSkeleton align="right" />
            <BubbleSkeleton align="left" />
            <BubbleSkeleton align="right" />
          </>
        ) : children}
        <div className="h-2" />
      </div>
      {!isPinned && (
        <button
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
            }
            setIsPinned(true)
          }}
          className="absolute bottom-4 right-5 rounded-full bg-zinc-800/90 border border-zinc-700/50 px-3 py-1.5 text-[11px] font-mono text-zinc-200 hover:bg-zinc-700 hover:text-white transition-all shadow-lg z-10 backdrop-blur-sm hover:scale-105 active:scale-95"
        >
          <ChevronDown className="w-3 h-3 inline mr-1" />
          Jump to latest
        </button>
      )}
    </div>
  )
}
