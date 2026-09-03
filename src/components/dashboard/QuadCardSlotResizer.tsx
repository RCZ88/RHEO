// DeskFlow Dashboard — QuadCardSlotResizer
// Shared height control for the 4-card dashboard grid row.
// Rendered as a drag handle ABOVE the grid (NOT a grid child), so it
// never steals a column from the cards. It sets an explicit height on
// the grid container AND each card wrapper so all 4 cards stretch
// to the same height at once (not per-card).

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react'

const STORAGE_KEY = 'rheo-quad-card-height'

export function QuadCardSlotResizer({
  defaultPx = 340,
  minPx = 200,
  maxPx = 600,
  targetRef,
  cardRefs,
  onHeightChange,
}: {
  defaultPx?: number
  minPx?: number
  maxPx?: number
  targetRef: React.RefObject<HTMLDivElement | null>
  cardRefs: React.MutableRefObject<Array<React.RefObject<HTMLDivElement>>>;
  onHeightChange?: (px: number) => void
}) {
  const [height, setHeight] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) return Math.max(minPx, Math.min(maxPx, parsed))
    } catch {}
    return defaultPx
  })

  const startYRef = useRef(0)
  const startHeightRef = useRef(height)

  const applyHeight = useCallback(
    (next: number) => {
      setHeight(next)
      // 1) Set height on the grid container so items-stretch works.
      const gridNode = targetRef?.current
      if (gridNode) {
        gridNode.style.setProperty('--dashboard-quad-slot-height', `${next}px`)
        gridNode.style.height = `${next}px`
      }
      // 2) ALSO set explicit height on each card wrapper — unwrap the ref first.
      if (cardRefs?.current) {
        cardRefs.current.forEach((ref) => {
          const cardNode = ref?.current
          if (cardNode) {
            cardNode.style.height = `${next}px`
          }
        })
      }
      onHeightChange?.(next)
      localStorage.setItem(STORAGE_KEY, `${next}`)
    },
    [onHeightChange, targetRef, cardRefs]
  )

  // Hydrate the container on mount / target swap.
  useEffect(() => {
    applyHeight(height)
  }, [applyHeight, height])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    startYRef.current = e.clientY
    startHeightRef.current = height

    const onMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY
      const next = Math.round(startHeightRef.current + delta)
      applyHeight(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <motion.div className="mb-2 flex items-center justify-center gap-2">
      <motion.div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 hover:border-zinc-600/50 hover:bg-zinc-800/50 transition-all text-zinc-500 hover:text-zinc-300 cursor-row-resize"
        onMouseDown={startDrag}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <GripHorizontal size={10} />
        <span className="text-[10px] font-mono">{height}px</span>
        <ChevronUp size={10} />
        <ChevronDown size={10} />
      </motion.div>
    </motion.div>
  )
}
