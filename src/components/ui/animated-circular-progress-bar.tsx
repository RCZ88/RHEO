import { useEffect, useRef } from "react"
import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCircularProgressBarProps {
  value: number
  size?: number
  strokeWidth?: number
  gaugePrimaryColor: string
  gaugeSecondaryColor?: string
  linear?: boolean
  linearDurationMs?: number
  className?: string
  children?: React.ReactNode
}

const CIRCUMFERENCE_R = 45

export function AnimatedCircularProgressBar({
  value,
  size = 160,
  strokeWidth = 10,
  gaugePrimaryColor,
  /* THE TRACK (the unfilled ring) WAS THE BUG.
   * Default was rgba(255,255,255,0.08) — a WHITE track, which is invisible
   * on the cream light surface, while four call sites overrode it with
   * rgba(63,63,70,0.5) — a hardcoded DARK track, which read as a thick
   * black border on that same surface. Both were literals, so neither
   * could follow the theme.
   * --color-foreground is near-white in dark mode and near-black in light
   * mode, so a color-mix off it produces a track that is legible in BOTH and
   * needs no per-theme override. Callers may still pass their own colour. */
  gaugeSecondaryColor = "color-mix(in srgb, var(--color-foreground) 14%, transparent)",
  linear = false,
  linearDurationMs = 1000,
  className,
  children,
}: AnimatedCircularProgressBarProps) {
  const reduce = useReducedMotion()
  const circumference = 2 * Math.PI * CIRCUMFERENCE_R
  const clamped = Math.max(0, Math.min(100, value))

  const motionValue = useMotionValue(clamped)
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 })
  const dashoffset = useTransform(spring, (v) => circumference - (v / 100) * circumference)
  const prevRef = useRef(clamped)

  useEffect(() => {
    if (reduce) {
      motionValue.jump(clamped)
      prevRef.current = clamped
      return
    }
    motionValue.set(clamped)
    prevRef.current = clamped
  }, [clamped, reduce, motionValue])

  const trackStyle = { stroke: gaugeSecondaryColor }
  const wrapStyle = { width: size, height: size }

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={wrapStyle}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={CIRCUMFERENCE_R} fill="none" strokeWidth={strokeWidth} style={trackStyle} />
        <motion.circle
          cx="50"
          cy="50"
          r={CIRCUMFERENCE_R}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={gaugePrimaryColor}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={reduce ? { strokeDashoffset: circumference - (clamped / 100) * circumference } : { strokeDashoffset: dashoffset }}
          transition={linear ? { duration: linearDurationMs / 1000, ease: "linear" } : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
