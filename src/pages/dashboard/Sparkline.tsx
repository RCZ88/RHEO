import { motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import { maxOf, minOf } from '../../utils/safeMath'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
  fill?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = 'currentColor',
  strokeWidth = 1.5,
  fill = true,
  className = '',
}: SparklineProps) {
  const reduce = useReducedMotion()
  const gradientId = useId()
  if (!data || data.length < 2) return null

  const max = maxOf(data, 1)
  const min = minOf(data, 0)
  const range = max - min || 1

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return { x, y }
  })

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const areaPath =
    linePath +
    ` L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sparkline-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && (
        <motion.path
          d={areaPath}
          fill={`url(#sparkline-fill-${gradientId})`}
          initial={reduce ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      )}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 2px ${color}40)` }}
        initial={reduce ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}
