"use client"

import React from "react"
import { motion, type MotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

const animationProps: MotionProps = {
  initial: { "--x": "100%", scale: 0.8 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.95 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: {
      type: "spring",
      stiffness: 200,
      damping: 5,
      mass: 0.5,
    },
  },
}

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  accent?: string
  borderClass?: string
}

export const ShinyButton = React.forwardRef<
  HTMLButtonElement,
  ShinyButtonProps
>(({ children, className, accent = "99,102,241", borderClass = "border-indigo-500/40", ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      className={cn(
        `relative cursor-pointer rounded-xl border ${borderClass} px-6 py-3 font-semibold text-sm text-zinc-50 transition-shadow duration-300 ease-in-out`,
        `hover:shadow-[0_0_20px_rgba(${accent},0.25)]`,
        className
      )}
      initial={{ "--x": "100%", scale: 0.8 }}
      animate={{ "--x": "-100%", scale: 1 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        repeat: Infinity,
        repeatType: "loop",
        repeatDelay: 1,
        type: "spring",
        stiffness: 20,
        damping: 15,
        mass: 2,
      }}
      {...props}
    >
      <span
        className="relative flex items-center justify-center gap-2 size-full pointer-events-none"
        style={{
          maskImage: `linear-gradient(-75deg, rgba(${accent},0.8) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),rgba(${accent},0.8) calc(var(--x) + 100%))`,
          WebkitMaskImage: `linear-gradient(-75deg, rgba(${accent},0.8) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),rgba(${accent},0.8) calc(var(--x) + 100%))`,
        }}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 z-10 rounded-[inherit] p-px pointer-events-none"
        style={{
          mask: "linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)",
          WebkitMask: "linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)",
          padding: "1px",
          background: `linear-gradient(-75deg, rgba(${accent},0.15) calc(var(--x)+20%),rgba(${accent},0.55) calc(var(--x)+25%),rgba(${accent},0.15) calc(var(--x)+100%))`,
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
      />
    </motion.button>
  )
})

ShinyButton.displayName = "ShinyButton"
