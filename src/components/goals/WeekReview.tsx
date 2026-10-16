/**
 * WeekReview — the Monday→Sunday hard-data recap.
 *
 * ONE component. This previously existed twice (GoldPage, HabitsPage) with
 * byte-identical bodies, so a fix to one left the other still wrong and nothing
 * in the compiler would say so.
 *
 * THE SUMMARY MATHS IS NOT RE-DERIVED HERE. `buildWeeklyReview` in
 * `src/shared/weeklyReview.ts` is the tested backend logic — it is unit-tested
 * in `src/__tests__/weeklyReview.test.ts` — so this component renders the
 * result and never recomputes the ratio, the most-skipped habit or the single
 * proposal. Re-deriving those in JSX is how the renderer and the stored
 * `weekly_reviews` row drift apart.
 *
 * Spec §3.4.
 */

import { motion } from 'framer-motion'
import { TrendingUp, Flame, Target, Repeat } from 'lucide-react'
import { buildWeeklyReview, type WeeklyInput } from '@/shared/weeklyReview'
import { formatTime, prettyDate } from '@/lib/format'
import { todayStr } from '@/lib/week'

/** One day's hard data. Aligned to the week, Monday first. */
export interface WeekReviewDay {
  date: string
  /** Productive seconds. Drives the bar length. */
  productiveSec: number
  /** Goals completed that day. */
  goalsCompleted: number
  /** Habits completed that day. */
  habitsCompleted: number
}

export interface WeekReviewProps {
  /** Seven entries, Monday first. */
  days: WeekReviewDay[]
  /** Everything `buildWeeklyReview` needs. Computed by the caller, which is the
   *  only place that has the goal rows. */
  weekly: WeeklyInput
  /** Consecutive days with a covenant completion. */
  streak?: number
  /** Dates with a covenant completion — draws the flame per day. */
  doneDates?: Set<string>
  /** Called when a day is selected. Omit to render non-interactive. */
  onDayClick?: (date: string) => void
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekReview({ days, weekly, streak = 0, doneDates, onDayClick }: WeekReviewProps) {
  const summary = buildWeeklyReview(weekly)

  const maxProd = Math.max(1, ...days.map(d => d.productiveSec))
  const avgProd = days.reduce((s, d) => s + d.productiveSec, 0) / (days.length || 1)
  const goalsSealed = days.reduce((s, d) => s + d.goalsCompleted, 0)
  const habitsKept = days.reduce((s, d) => s + d.habitsCompleted, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-medium text-zinc-300 flex items-center gap-1.5">
          <TrendingUp size={13} style={{ color: 'var(--page-accent)' }} aria-hidden />
          This week, at a glance
          <span className="warmth-serif italic text-zinc-600 font-normal">
            {/* `summary.start`/`summary.end` are raw YYYY-MM-DD. This is the one
                place a date reaches the user, and an ISO string reads as a bug. */}
            — {prettyDate(summary.start)} to {prettyDate(summary.end)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {days.map((d, i) => {
          const isToday = d.date === todayStr()
          /* A <button disabled> is announced as a disabled control and is
             unreachable by keyboard, which tells a screen-reader user these rows
             are interactive-but-locked when they are in fact static. When there
             is nothing to click, render a <div> — no role, no tab stop, no lie. */
          const Row: any = onDayClick ? 'button' : 'div'
          return (
            <Row
              key={d.date}
              {...(onDayClick ? { type: 'button', onClick: () => onDayClick(d.date) } : {})}
              className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                isToday
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]'
              } ${onDayClick ? 'hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50' : ''}`}
            >
              <span className="w-11 shrink-0">
                <span className={`block text-[9px] uppercase tracking-wider ${isToday ? 'text-amber-400' : 'text-zinc-600'}`}>
                  {DOW[i]}
                </span>
                <span className={`block text-[11px] font-semibold tabular-nums ${isToday ? 'text-amber-300' : 'text-zinc-500'}`}>
                  {d.date.slice(5)}
                </span>
              </span>

              <span className="flex-1 h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                <motion.span
                  /* LAMINAR §6 / PAINT Gate E: transform only, never width. */
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(1, d.productiveSec / maxProd) }}
                  transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="block h-full w-full rounded-full origin-left"
                  /* LAMINAR §7.1: flat fill, no decorative chrome gradient. */
                  style={{ backgroundColor: d.productiveSec > 0 ? 'var(--color-amber-400)' : 'transparent' }}
                />
              </span>

              <span className="w-12 text-right text-[11px] tabular-nums text-zinc-400">
                {d.productiveSec > 0 ? formatTime(d.productiveSec) : '—'}
              </span>
              <span className="w-6 text-center text-[11px] tabular-nums text-[var(--color-emerald-ink)]">
                {d.goalsCompleted || ''}
              </span>
              <span className="w-5 text-center">
                {doneDates?.has(d.date)
                  ? <Flame size={12} className="inline text-amber-400" aria-hidden />
                  : <span className="text-zinc-700">·</span>}
              </span>
            </Row>
          )
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-zinc-800/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span>avg <span className="text-zinc-300 tabular-nums">{formatTime(Math.round(avgProd))}</span>/day</span>
        {/* Was labelled "routines sealed" while counting every completed goal in
            `days`, which is not what "routine" means anywhere else in this file. */}
        <span>
          <span className="text-[var(--color-emerald-ink)] tabular-nums">{goalsSealed}</span> goals sealed
        </span>
        <span>
          <span className="text-[var(--color-violet-ink)] tabular-nums">{habitsKept}</span> habits kept
        </span>
        <span className="flex items-center gap-1">
          <Flame size={12} className="text-amber-400" aria-hidden />
          <span className="text-amber-300 tabular-nums">{streak}</span> day streak
        </span>
      </div>

      {/* The ONE proposal. Rendered as text, never as an array of suggestions —
          a review that lists five changes has an adoption rate of zero. */}
      {summary.proposal && (
        <div className="mt-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-2">
          <div className="flex items-start gap-2">
            <Target size={12} className="mt-0.5 shrink-0 text-[var(--page-accent)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12px] text-zinc-200">{summary.proposal.text}</p>
              {summary.proposal.why && (
                <p className="text-[11px] text-zinc-600 mt-0.5">{summary.proposal.why}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* `mostSkippedHabit` was computed by `buildWeeklyReview` on every call and
          then never rendered, so the one habit the review exists to name was
          invisible. Shown on its own row, by title. */}
      {summary.mostSkippedHabit && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-zinc-800/60 px-2.5 py-2">
          <Flame size={12} className="shrink-0 text-amber-400" aria-hidden />
          <p className="text-[12px] text-zinc-300 min-w-0">
            <span className="text-zinc-500">Skipped most:</span>{' '}
            <span className="text-zinc-200">{weekly.habitTitles?.[summary.mostSkippedHabit.id] ?? 'a tracked habit'}</span>
            <span className="text-zinc-600"> · missed {summary.mostSkippedHabit.missedDays} of 7 days</span>
          </p>
        </div>
      )}

      {/* "Nothing to change" is information, not an absence — it is shown. */}
      {summary.allClear && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-zinc-800/60 px-2.5 py-2">
          <Repeat size={12} className="text-[var(--color-emerald-ink)]" aria-hidden />
          <p className="text-[12px] text-zinc-300">
            {summary.done} of {summary.planned} sealed. Nothing to change.
          </p>
        </div>
      )}
    </div>
  )
}