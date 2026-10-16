/**
 * DayRing — a done/total donut for one day.
 *
 * ONE component. This existed twice (GoldPage, HabitsPage) with identical
 * bodies. The old GoldPage copy drew the track as a literal
 * `rgba(63,63,70,0.5)` and the arc as `#fbbf24`; both are now tokens, so the
 * ring follows the theme instead of being frozen at the dark-theme values
 * (PAINT Gate C — no raw rgba/hex in a component).
 *
 * The ring is `role="img"` with an `aria-label` stating the actual ratio in
 * words, because a donut conveys nothing to a screen reader otherwise.
 *
 * Spec §3.4.
 */

export interface DayRingProps {
  /** YYYY-MM-DD. Used for the accessible name and the today ring. */
  date: string
  done: number
  total: number
  /** Marks today with the accent ring. */
  isToday?: boolean
  /** Pixel size. Default 46, which is what GoldPage's header used. */
  size?: number
}

export function DayRing({ date, done, total, isToday = false, size = 46 }: DayRingProps) {
  const ratio = total > 0 ? Math.min(done / total, 1) : 0
  const circumference = 2 * Math.PI * (size / 2 - 3)
  const offset = circumference * (1 - ratio)

  return (
    <div
      className="relative shrink-0"
      role="img"
      aria-label={`${done} of ${total} complete on ${date}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {/* Track: --color-foreground at low alpha, so it derives from the theme. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 3}
          fill="none"
          stroke="var(--color-foreground)"
          strokeOpacity={0.2}
          strokeWidth={4}
        />
        {/* Arc: the page accent — the ONE signal hue on this surface. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 3}
          fill="none"
          stroke="var(--page-accent)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          /* Rotate so 0% starts at twelve o'clock. `transform` on an SVG circle
             is a presentational transform, not an animated layout property, so
             this does not violate PAINT Gate E. */
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          /* respect reduced-motion: no transition on the dash offset */
          style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-zinc-300 tabular-nums"
        aria-hidden
      >
        {done}/{total}
      </span>
      {isToday && (
        <span
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full"
          style={{ backgroundColor: 'var(--page-accent)' }}
          aria-hidden
        />
      )}
    </div>
  )
}