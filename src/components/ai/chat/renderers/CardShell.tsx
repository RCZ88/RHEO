import { type ReactNode } from "react"
import type { AccentKey } from "../../tokens"

const ACCENT_COLORS: Record<string, string> = {
  pink: "bg-pink-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  red: "bg-red-500",
  cyan: "bg-cyan-500",
}

export interface CardShellProps {
  icon?: ReactNode
  title: string
  badge?: string
  subtitle?: string
  accent?: AccentKey
  right?: ReactNode
  children: ReactNode
  className?: string
}

export function CardShell({
  icon,
  title,
  badge,
  subtitle,
  accent = "pink",
  right,
  children,
  className,
}: CardShellProps) {
  return (
    <div
      className={"rounded-xl ring-1 ring-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] overflow-hidden " + (className || "")}
      style={{ position: "relative" }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ background: ACCENT_COLORS[accent] || ACCENT_COLORS.pink }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        {icon ? (
          <span className="flex-shrink-0 text-zinc-400">{icon}</span>
        ) : null}
        <span className="text-[13px] font-semibold text-zinc-200 flex-1">{title}</span>
        {badge ? (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/60 text-zinc-500">
            {badge}
          </span>
        ) : null}
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>

      {/* Subtitle bar */}
      {(subtitle || right) && (
        <div className="flex items-center justify-between px-5 py-1.5 border-t border-zinc-800/40">
          {subtitle ? <span className="text-[11px] text-zinc-500">{subtitle}</span> : null}
        </div>
      )}

      {/* Body */}
      <div className="px-5 pb-5 pt-2">
        {children}
      </div>
    </div>
  )
}
