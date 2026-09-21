import * as React from "react";
/**
 * BorderBeam — Animated light traveling along container border
 * Adapted from Magic UI, inlined to avoid registry dependency.
 * No next-themes dependency.
 */

import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 6,
  borderWidth = 1.5,
  anchor = 90,
  colorFrom = "#a1a1aa",
  colorTo = "#71717a",
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      style={{
        "--size": size,
        "--duration": `${duration}s`,
        "--anchor": `${anchor}%`,
        "--border-width": `${borderWidth}px`,
        "--color-from": colorFrom,
        "--color-to": colorTo,
        "--delay": `${delay}s`,
      } as React.CSSProperties}
      className={cn(
        "absolute inset-0 rounded-[inherit] pointer-events-none",
        "[border:calc(var(--border-width)*1px)_solid_transparent]",
        "[background:linear-gradient(to_right,var(--color-from),var(--color-to),var(--color-from))_border-box]",
        "[mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)]",
        "[mask-composite:exclude]",
        "animate-border-beam",
        className
      )}
    />
  );
}
