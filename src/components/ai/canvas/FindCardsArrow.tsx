import { useMemo } from 'react'

interface FindCardsArrowProps {
  viewportSize: { w: number; h: number }
  pan: { x: number; y: number }
  clusterCenter: { x: number; y: number }
  onRecenter: () => void
}

const ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']

export function FindCardsArrow({ viewportSize, pan, clusterCenter, onRecenter }: FindCardsArrowProps) {
  const arrow = useMemo(() => {
    const vCenterX = -pan.x + viewportSize.w / 2
    const vCenterY = -pan.y + viewportSize.h / 2
    const dx = clusterCenter.x - vCenterX
    const dy = clusterCenter.y - vCenterY
    const angle = Math.atan2(-dy, dx)
    const octant = Math.round((angle * 8) / (2 * Math.PI) + 8) % 8
    return ARROWS[octant]
  }, [viewportSize, pan, clusterCenter])

  // Fixed, predictable placement: bottom-center above the composer, so the
  // button never appears to jump around. The arrow still indicates direction.
  const position = { bottom: '118px', left: '50%', transform: 'translateX(-50%)' }

  return (
    <button className="dk-find-arrow" style={position} onClick={onRecenter}>
      <span className="dk-find-arrow-icon">{arrow}</span>
      <span className="dk-find-arrow-text">Find cards</span>
    </button>
  )
}