import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CalendarDays, History, Sparkles } from "lucide-react"
import { GlassCard } from "../GlassCard"
import { SectionHead } from "../SectionHead"
import { Segmented } from "../primitives/Segmented"
import { Progress } from "../primitives/Progress"
import { StateShell, EmptyState } from "../StateShell"
import { SkeletonRow } from "../primitives/Skeleton"
import { useMotionProps } from "../lib/motion"
import { cn } from "../lib/cn"
import { TEXT } from "../tokens"
import type { DataState, GoalDay } from "../types"

export interface ReflectFeedProps {
	state: DataState
	days: GoalDay[]
	errorMessage?: string
	onRetry?: () => void
	dayWindow?: number
	onLoadOlder?: () => void
}

type Filter = "all" | "reviewed" | "productive"

function dayStats(day: GoalDay) {
	const total = day.goals.length
	const done = day.goals.filter((g) => g.status === "done").length
	const pct = total > 0 ? done / total : 0
	return { total, done, pct }
}

/**
 * ReflectFeed replaces the GoalHistoryCard with a vertical timeline. Each day is
 * a node with a completion ring, goal counts, and (if present) the saved review.
 * Filter tabs animate the list via the shared stagger (no 1s artificial delay).
 */
export function ReflectFeed({ state, days, errorMessage, onRetry, dayWindow, onLoadOlder }: ReflectFeedProps) {
	const [filter, setFilter] = useState<Filter>("all")
	const m = useMotionProps()

	const filtered = useMemo(() => {
		let result = days
		if (filter === "reviewed") result = days.filter((d) => Boolean(d.reviewSummary))
		if (filter === "productive") result = days.filter((d) => dayStats(d).pct >= 0.6)
		if (dayWindow && result.length > dayWindow) result = result.slice(0, dayWindow)
		return result
	}, [days, filter, dayWindow])

	const counts = useMemo(
		() => ({
			all: days.length,
			reviewed: days.filter((d) => Boolean(d.reviewSummary)).length,
			productive: days.filter((d) => dayStats(d).pct >= 0.6).length,
		}),
		[days],
	)

	return (
		<GlassCard accent="amber" bar>
			<SectionHead
				accent="amber"
				icon={<History size={16} />}
				title="Reflect"
				desc="Your recent days, at a glance"
				right={
					<Segmented
						value={filter}
						onChange={setFilter}
						aria-label="Filter days"
						options={[
							{ value: "all", label: "All", count: counts.all },
							{ value: "reviewed", label: "Reviewed", count: counts.reviewed },
							{ value: "productive", label: "Productive", count: counts.productive },
						]}
					/>
				}
			/>

			<StateShell
				state={state}
				errorMessage={errorMessage}
				onRetry={onRetry}
				loading={
					<div className="space-y-2">
						{[0, 1, 2, 3].map((i) => (
							<SkeletonRow key={i} />
						))}
					</div>
				}
				empty={
					<EmptyState
						icon={<CalendarDays size={20} />}
						title="No history yet"
						message="Once you complete goals, your days will appear here."
					/>
				}
			>
				<motion.ol
					variants={m.parent}
					initial="hidden"
					animate="show"
					className="relative space-y-1 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-800/70"
				>
					{filtered.map((day) => (
						<motion.li key={day.date} variants={m.item} className="relative pl-6">
							<DayNode day={day} />
						</motion.li>
					))}
				</motion.ol>
				{dayWindow && days.length > dayWindow && onLoadOlder && (
					<button
						type="button"
						onClick={onLoadOlder}
						className="mt-3 w-full rounded-lg py-2 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-800/30 hover:text-zinc-300"
					>
						Load older days ({days.length - dayWindow} more)
					</button>
				)}
			</StateShell>
		</GlassCard>
	)
}

function DayNode({ day }: { day: GoalDay }) {
	const { total, done, pct } = dayStats(day)
	const date = new Date(day.date + "T00:00:00")
	const label = date.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	})
	return (
		<div className="rounded-xl bg-zinc-950 light:bg-[var(--ws-surface-40)] p-4 ring-1 ring-zinc-800/50 transition-[box-shadow] duration-150 hover:ring-zinc-700">
			<span
				aria-hidden
				className="absolute left-0 top-5 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 bg-amber-400/80"
			/>
			<div className="flex items-center justify-between">
				<span className={cn("text-[13px] font-semibold", TEXT.primary)}>{label}</span>
				<span className="text-[12px] tabular-nums text-amber-300/90">
					{done}/{total}
				</span>
			</div>
			<div className="mt-2">
				<Progress value={pct} accent="amber" aria-label={"Completion for " + label} />
			</div>
			{day.reviewSummary ? (
				<p className={cn("mt-3 flex gap-2 text-[12px] leading-5", TEXT.secondary)}>
					<Sparkles size={13} className="mt-0.5 shrink-0 text-amber-300/70" />
					<span>{day.reviewSummary}</span>
				</p>
			) : null}
		</div>
	)
}
