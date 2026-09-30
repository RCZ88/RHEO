import * as React from "react";
"use client"

import { motion, type HTMLMotionProps } from "motion/react"
import { cn } from "@/lib/utils"
import { Pin } from "lucide-react"
import { WidgetJumpButton } from "./WidgetJumpButton"
import {
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
  const Comp = noMotion ? 'div' : motion.div as any

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
  zIndex,
  onClick,
  pinned,
  jumpWidgetId,
  ...props
}: { className?: string; children: React.ReactNode; zIndex?: number; onClick?: () => void; pinned?: boolean; jumpWidgetId?: string }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ zIndex, position: 'relative' }}
      className={cn(
        "rounded-xl bg-zinc-900/80 overflow-hidden transition-colors duration-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.07)] flex-1 min-h-0 cursor-pointer",
        pinned ? "ring-1 ring-amber-500/30" : "",
        className,
      )}
      {...props}
    >
      {pinned && (
        <div className="absolute top-2 left-2 z-50 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono pointer-events-none">
          <Pin size={10} /> PINNED
        </div>
      )}
      {/* Jump-to-source button: the ONLY control in this card that navigates away
          from the dashboard. Always visible (never hover-only), top-right, and
          self-stop-propagating so the card's bringToFront click never fires. */}
      {jumpWidgetId && (
        <div className="absolute top-2 right-2 z-50">
          <WidgetJumpButton widgetId={jumpWidgetId} iconOnly />
        </div>
      )}
      {children}
    </motion.div>
  );
}
