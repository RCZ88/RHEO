import * as React from "react";
"use client"

import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

const accentColors = {
  pink:   { rail: "bg-pink-500/60",   border: "border-l-pink-500/20 hover:border-l-pink-500/30",   bg: "bg-pink-500/[0.02]",  edge: "border-pink-500/30", railLight: "bg-pink-500/40", borderLight: "border-l-pink-400/30", bgLight: "bg-pink-500/[0.04]" },
  amber:  { rail: "bg-amber-500/60",  border: "border-l-amber-500/20 hover:border-l-amber-500/30", bg: "bg-amber-500/[0.02]", edge: "border-amber-500/30", railLight: "bg-amber-500/40", borderLight: "border-l-amber-400/30", bgLight: "bg-amber-500/[0.04]" },
  emerald:{ rail: "bg-emerald-500/60",border: "border-l-emerald-500/20 hover:border-l-emerald-500/30", bg: "bg-emerald-500/[0.02]", edge: "border-emerald-500/30", railLight: "bg-emerald-500/40", borderLight: "border-l-emerald-400/30", bgLight: "bg-emerald-500/[0.04]" },
  none:   null,
}

// ── L2 Responsive motion ──
const hoverLift = {
  whileHover: { y: -2, scale: 1.005, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
}

const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 20px rgba(244, 63, 94, 0.12), 0 0 60px rgba(244, 63, 94, 0.06)",
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
}

interface DeskFlowCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  variant?: 'default' | 'elevated' | 'subtle' | 'accent'
  accent?: 'pink' | 'amber' | 'emerald' | 'none'
  title?: string
  description?: string
  headerAction?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  noMotion?: boolean
}

export function DeskFlowCard({
  variant = 'default',
  accent = 'none',
  title,
  description,
  headerAction,
  footer,
  children,
  className,
  noMotion = false,
  ...props
}: DeskFlowCardProps) {
  const ac = accent !== 'none' ? accentColors[accent] : null
  const Comp = noMotion ? 'div' : motion.div

  return (
    <Comp
      data-slot="deskflow-card"
      className={cn(
        "relative overflow-hidden rounded-xl transition-colors duration-200",
        hoverGlow.whileHover,
        className,
      )}
      {...(noMotion ? {} : hoverLift)}
      {...props}
    >
      {ac && (
        <>
          <div className={`absolute top-0 left-0 bottom-0 w-0.5 ${ac.rail} ${ac.railLight}`} />
          <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${ac.bg} ${ac.bgLight}`} />
        </>
      )}
      <div className="relative z-0 flex flex-col min-h-0 flex-1">
        {(title || description || headerAction) && (
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {title && <CardTitle>{title}</CardTitle>}
                {description && <CardDescription>{description}</CardDescription>}
              </div>
              {headerAction && <CardAction>{headerAction}</CardAction>}
            </div>
          </CardHeader>
        )}
        <CardContent className="px-4 pt-2 flex-1 min-h-0">
          {children}
        </CardContent>
        {footer && (
          <CardFooter className="px-4 pt-0 pb-4">{footer}</CardFooter>
        )}
      </div>
    </Comp>
  )
}

export function DeskFlowCardMotion({
  className,
  children,
  ...props
}: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "rounded-xl bg-zinc-900/80 backdrop-blur-xl overflow-hidden transition-colors duration-200 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}
