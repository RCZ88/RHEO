// LAMINAR-adapted Magic UI + React Bits components for Overlay Studio
// Stripped of hues, driven by tokens.css

import { useRef } from 'react'
import { motion, AnimatePresence, useInView, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── BlurFade — entrance animation ──
interface BlurFadeProps {
  children: React.ReactNode
  className?: string
  duration?: number
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  inView?: boolean
  blur?: string
}

export function BlurFade({ children, className, duration = 0.4, delay = 0, direction = 'down', inView = false, blur = '6px' }: BlurFadeProps) {
  const ref = useRef(null)
  const inViewResult = useInView(ref, { once: true, margin: '-50px' })
  const isInView = !inView || inViewResult
  const variants: Variants = {
    hidden: { [direction === 'left' || direction === 'right' ? 'x' : 'y']: direction === 'right' || direction === 'down' ? -6 : 6, opacity: 0, filter: `blur(${blur})` },
    visible: { [direction === 'left' || direction === 'right' ? 'x' : 'y']: 0, opacity: 1, filter: 'blur(0px)' },
  }
  return (
    <AnimatePresence>
      <motion.div ref={ref} initial="hidden" animate={isInView ? 'visible' : 'hidden'} exit="hidden" variants={variants}
        transition={{ delay: 0.04 + duration, duration, ease: 'easeOut' }} className={className}>
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ── NumberTicker — animated number ──
import { MotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

function Number({ mv, number, height }: { mv: MotionValue<number>; number: number; height: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10
    const offset = (10 + number - placeValue) % 10
    let memo = offset * height
    if (offset > 5) memo -= 10 * height
    return memo
  })
  return <motion.span className="inline-block" style={{ y }}>{number}</motion.span>
}

export function NumberTicker({ value, className, fontSize = 24 }: { value: number; className?: string; fontSize?: number }) {
  const spring = useSpring(0)
  const display = useTransform(spring, (v) => Math.floor(v))
  useEffect(() => { spring.set(value) }, [value, spring])
  const height = fontSize
  const digits = String(Math.floor(value)).split('').map(Number)
  return (
    <span className={cn("flex items-baseline overflow-hidden tabular-nums font-mono", className)} style={{ fontSize: `${fontSize}px`, height: `${height}px` }}>
      {digits.map((digit, i) => (
        <span key={i} className="relative" style={{ width: '1ch', height: `${height}px` }}>
          <Number mv={spring} number={digit} height={height} />
        </span>
      ))}
    </span>
  )
}
