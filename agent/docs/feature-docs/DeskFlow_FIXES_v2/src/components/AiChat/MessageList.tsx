import React, { type FC, type ReactNode, useEffect, useRef, useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

type Props = {
  children: ReactNode
  onScrollChange?: (isPinned: boolean) => void
}

export const MessageList: FC<Props> = ({ children, onScrollChange }) => {
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
        {children}
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
