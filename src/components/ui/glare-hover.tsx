import { forwardRef } from "react"
import type { ComponentProps, CSSProperties, Ref } from "react"
import { useMemo } from "react"

import { cn } from "@/lib/utils"

export interface GlareHoverProps extends ComponentProps<"div"> {
  background?: string
  color?: string
  opacity?: number
  angle?: number
  size?: number
  duration?: number
  playOnce?: boolean
}

type RGBA = `rgba(${number},${number},${number},${number})`

function parseHEX(color: string, opacity: number): string {
  const hex = color.replace("#", "")
  const parse = (h: string) => Number.parseInt(h, 16)
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return `rgba(${parse(hex.slice(0, 2))},${parse(hex.slice(2, 4))},${parse(hex.slice(4, 6))},${opacity})`
  }
  if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
    return `rgba(${parse(hex[0] + hex[0])},${parse(hex[1] + hex[1])},${parse(hex[2] + hex[2])},${opacity})`
  }
  return color
}

export const GlareHover = forwardRef<HTMLDivElement, GlareHoverProps>(function GlareHover(
  {
    background = "transparent",
    children,
    color = "#ffffff",
    opacity = 0.15,
    angle = -30,
    size = 250,
    duration = 700,
    playOnce = false,
    className,
    style,
    ...props
  },
  ref
) {
  const rgba = useMemo(() => parseHEX(color, opacity), [color, opacity])

  const cssVars = {
    "--gh-angle": `${angle}deg`,
    "--gh-duration": `${duration}ms`,
    "--gh-size": `${size}%`,
    "--gh-rgba": rgba,
    background,
    ...style,
  } as CSSProperties

  return (
    <div
      {...props}
      className={cn(
        "relative isolate overflow-hidden",
        "before:pointer-events-none before:absolute before:inset-0 before:z-10 before:content-['']",
        "before:[background-image:linear-gradient(var(--gh-angle),transparent_60%,var(--gh-rgba)_70%,transparent,transparent_100%)]",
        "before:[background-size:var(--gh-size)_var(--gh-size),100%_100%]",
        "before:[background-position:-100%_-100%,0_0]",
        !playOnce &&
          "before:transition-[background-position] before:duration-[var(--gh-duration)] before:ease-in-out",
        playOnce &&
          "before:transition-none hover:before:transition-[background-position] hover:before:duration-[var(--gh-duration)]",
        "hover:before:[background-position:100%_100%,0_0]",
        className
      )}
      style={cssVars}
      ref={ref}
    >
      {children}
    </div>
  )
})