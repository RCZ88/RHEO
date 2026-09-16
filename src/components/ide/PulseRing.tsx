import { useEffect, useState } from 'react'

interface PulseRingProps {
  count: number
  label?: string
}

export function PulseRing({ count, label = 'commits' }: PulseRingProps) {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true)
      setTimeout(() => setPulse(false), 1000)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div className={`absolute inset-0 rounded-full border-2 border-[var(--page-accent)] transition-all duration-1000 ${pulse ? 'scale-110 opacity-0' : 'scale-100 opacity-30'}`} />
      <div className={`absolute inset-2 rounded-full border-2 border-[var(--page-accent)] transition-all duration-1000 delay-100 ${pulse ? 'scale-110 opacity-0' : 'scale-100 opacity-50'}`} />
      <div className="absolute inset-4 rounded-full bg-[var(--page-accent)]/10" />
      <div className="relative z-10 text-center">
        <div className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{count}</div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      </div>
    </div>
  )
}
