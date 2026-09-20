import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TimerResetOverlayProps {
  trigger: number
}

export function TimerResetOverlay({ trigger }: TimerResetOverlayProps) {
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevTriggerRef = useRef(trigger)

  useEffect(() => {
    if (trigger === prevTriggerRef.current) return
    prevTriggerRef.current = trigger

    if (timerRef.current) clearTimeout(timerRef.current)
    setActive(true)
    timerRef.current = setTimeout(() => {
      setActive(false)
      timerRef.current = null
    }, 1500)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [trigger])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="timer-reset-overlay"
          className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ background: 'radial-gradient(circle at center, rgba(239,68,68,0.3), transparent 70%)' }}
          />

          <motion.div
            className="absolute rounded-full border-2 border-red-500/60"
            initial={{ width: 0, height: 0, opacity: 0.6 }}
            animate={{ width: '80vw', height: '80vw', opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />

          <motion.div
            className="absolute rounded-full border border-red-400/30"
            initial={{ width: 0, height: 0, opacity: 0.4 }}
            animate={{ width: '120vw', height: '120vw', opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: 'easeOut', delay: 0.1 }}
          />

          <motion.div
            className="relative flex flex-col items-center gap-3"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <motion.svg
              viewBox="0 0 24 24"
              className="w-10 h-10 text-red-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 1, ease: 'easeInOut' }}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </motion.svg>
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-red-400/80">
              Timer Reset
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
