import { useEffect, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../lib/cn'

interface ErrorShakeProps {
  trigger: boolean
  onDone?: () => void
  className?: string
  children: ReactNode
}

export function ErrorShake({ trigger, onDone, className, children }: ErrorShakeProps) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (trigger && !reduce) {
      const timer = setTimeout(() => onDone?.(), 600)
      return () => clearTimeout(timer)
    }
    if (trigger && reduce) onDone?.()
  }, [trigger, reduce, onDone])

  return (
    <motion.div
      animate={trigger && !reduce ? {
        x: [0, -6, 6, -4, 4, -2, 2, 0],
        borderColor: ['rgba(63,63,70,0.5)', 'rgba(239,68,68,0.6)', 'rgba(239,68,68,0.3)', 'rgba(63,63,70,0.5)'],
      } : {}}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className={cn('border border-transparent rounded-2xl', className)}
    >
      {children}
    </motion.div>
  )
}
