import { useState } from "react"
import { Settings } from "lucide-react"
import { motion } from "framer-motion"
import {
	Activity,
	Brain,
	Check,
	CircleCheck,
	Moon,
	Sparkles,
	Sunrise,
	X,
} from "lucide-react"
import { GlassCard } from "../GlassCard"
import { SectionHead } from "../SectionHead"
import { MetricCard } from "../MetricCard"
import { StateShell, EmptyState } from "../StateShell"
import { SkeletonRow, Skeleton } from "../primitives/Skeleton"
import { GoalRow } from "./GoalRow"
import { useMotionProps } from "../lib/motion"
import { cn } from "../lib/cn"
import { ACCENT, TEXT } from "../tokens"
import type { DataState, Goal, Mode } from "../types"
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';

export interface FocusBoardProps {
	state: DataState
	mode: Mode
	goals: Goal[]
	planGoals?: Goal[]
	suggestions?: Goal[]
	metrics: { doneToday: number; inProgress: number; focusSeconds: number }
	reviewSummary?: string
	onToggleGoal?: (goal: Goal) => void
	onAcceptSuggestion?: (goal: Goal) => void
	onDismissSuggestion?: (goal: Goal) => void
	onSuggestGoals?: () => void
	onSaveReview?: (text: string) => void
	errorMessage?: string
	onRetry?: () => void
	onConfigure?: () => void
	reviewError?: string | null
	toggleErrors?: Record<number, string>
	acceptErrors?: Record<string, string>
	onRetryReview?: () => void
	onDismissReviewError?: () => void
}

const MODE_META: Record<Mode, { label: string; icon: typeof Sunrise; accent: keyof typeof ACCENT }> = {
	morning: { label: "Morning", icon: Sunrise, accent: "amber" },
	"in-progress": { label: "In progress", icon: Activity, accent: "emerald" },
	review: { label: "Review", icon: Moon, accent: "violet" },
}

function fmtDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600)
	const m = Math.round((seconds % 3600) / 60)
	return h > 0 ? h + "h " + m + "m" : m + "m"
}

export function FocusBoard(props: FocusBoardProps) {
	const { state, mode, goals, planGoals = [], suggestions = [], metrics } = props
	const m = useMotionProps()
	const modeMeta = MODE_META[mode]
	const ModeIcon = modeMeta.icon

	return (
		<GlassCard accent="emerald" bar className="flex flex-col">
			<SectionHead
				accent="emerald"
				icon={<CircleCheck size={16} />}
				title="Focus"
				desc="Today's plan, in motion"
				right={
					<div className="flex items-center gap-1.5">
						{props.onConfigure && (
							<button
								onClick={props.onConfigure}
								className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
								title="Configure AI provider & model"
							>
								<Settings size={11} />
							</button>
						)}
						<span
							className={cn(
								"inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
								ACCENT[modeMeta.accent].pill,
							)}
						>
							<ModeIcon size={12} /> {modeMeta.label}
						</span>
					</div>
				}
			/>

			<StateShell
				state={state}
				errorMessage={props.errorMessage}
				onRetry={props.onRetry}
				loading={
					<div className="space-y-4">
						<div className="grid grid-cols-3 gap-3">
							{[0, 1, 2].map((i) => (
								<Skeleton key={i} className="h-24" />
							))}
						</div>
						{[0, 1, 2].map((i) => (
							<SkeletonRow key={i} />
						))}
					</div>
				}
				empty={
					<EmptyState
						icon={<Brain size={20} />}
						title="Plan your day"
						message="Set a few goals, or let DeskFlow suggest some from your recent work."
						cta={
							<button
								type="button"
								onClick={props.onSuggestGoals}
								className={cn(
									"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium",
									ACCENT.emerald.pill,
								)}
							>
								<Sparkles size={13} /> Suggest goals
							</button>
						}
					/>
				}
			>
				<motion.div
					variants={m.parent}
					initial="hidden"
					animate="show"
					className="space-y-5"
				>
					{/* Metric strip */}
					<motion.div variants={m.item} className="grid grid-cols-3 gap-3">
						<MetricCard accent="emerald" icon={<Check size={15} />} label="Done today" value={metrics.doneToday} />
						<MetricCard accent="amber" icon={<Activity size={15} />} label="In progress" value={metrics.inProgress} />
						<MetricCard
							accent="violet"
							icon={<Sunrise size={15} />}
							label="Focus time"
							value={metrics.focusSeconds}
							format={(n) => fmtDuration(n)}
						/>
					</motion.div>

					{planGoals.length > 0 ? (
						<motion.div variants={m.item}>
							<GroupLabel>From your plan</GroupLabel>
							<div className="space-y-0.5">
								{planGoals.map((g) => (
									<GoalRow key={g.id} goal={g} onToggle={props.onToggleGoal} />
								))}
							</div>
						</motion.div>
					) : null}

					{suggestions.length > 0 ? (
						<motion.div variants={m.item}>
							{props.reviewError && (
						<motion.div variants={m.item}>
							<div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">
								<span className="flex-1">Review failed: {props.reviewError}</span>
								<button className="rounded bg-red-500/15 px-2 py-1 font-medium text-red-200 hover:bg-red-500/25" onClick={props.onRetryReview}>Retry</button>
								{props.onDismissReviewError && <button className="text-red-400 hover:text-red-200" onClick={props.onDismissReviewError}>Dismiss</button>}
							</div>
						</motion.div>
					)}

					<GroupLabel accent="emerald">
								<Sparkles size={12} className="text-emerald-300" /> AI suggestions
							</GroupLabel>
							<div className="space-y-1">
								{suggestions.map((g) => {
									const acceptKey = g.title;
									const acceptErr = props.acceptErrors?.[acceptKey];
									return (
										<div key={g.id}>
											<SuggestionRow
												goal={g}
												onAccept={props.onAcceptSuggestion}
												onDismiss={props.onDismissSuggestion}
											/>
											{acceptErr && (
												<div className="ml-3 mt-1 flex items-center gap-2 rounded bg-red-500/8 px-3 py-1.5 text-[11px] text-red-400">
													<span className="flex-1">{acceptErr}</span>
													<button className="font-medium text-indigo-400 hover:text-indigo-300" onClick={() => props.onAcceptSuggestion?.(g)}>Retry</button>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</motion.div>
					) : null}

					<motion.div variants={m.item}>
						<GroupLabel>Today's goals</GroupLabel>
						<div className="space-y-0.5">
							{goals.map((g) => {
								const toggleErr = props.toggleErrors?.[g.id];
								return (
									<div key={g.id}>
										<GoalRow goal={g} onToggle={props.onToggleGoal} />
										{toggleErr && (
											<div className="ml-3 mt-1 flex items-center gap-2 rounded bg-red-500/8 px-3 py-1.5 text-[11px] text-red-400">
												<span>Failed to update: {toggleErr}</span>
												<button className="font-medium text-indigo-400 hover:text-indigo-300" onClick={() => props.onToggleGoal?.(g)}>Retry</button>
											</div>
										)}
									</div>
								);
							})}
						</div>
					</motion.div>

					{mode === "review" ? (
						<motion.div variants={m.item}>
							<ReviewPanel
								doneToday={metrics.doneToday}
								total={goals.length}
							initialSummary={props.reviewSummary}
							onSave={props.onSaveReview}
						/>
						</motion.div>
					) : null}
				</motion.div>
			</StateShell>
		</GlassCard>
	)
}

function GroupLabel({
	children,
}: {
	children: React.ReactNode
	accent?: keyof typeof ACCENT
}) {
	return (
		<p className={cn("mb-1.5 flex items-center gap-1.5 text-[12px] font-medium", TEXT.secondary)}>
			{children}
		</p>
	)
}

function SuggestionRow({
	goal,
	onAccept,
	onDismiss,
}: {
	goal: Goal
	onAccept?: (g: Goal) => void
	onDismiss?: (g: Goal) => void
}) {
	return (
		<div className="flex items-center gap-3 rounded-lg bg-emerald-500/[0.04] px-3 py-2.5 ring-1 ring-emerald-500/10">
			<Sparkles size={14} className="shrink-0 text-emerald-300/80" />
			<span className={cn("min-w-0 flex-1 truncate text-[13px]", TEXT.primary)}>{goal.title}</span>
			<button
				type="button"
				onClick={() => onAccept?.(goal)}
				className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-500/15"
			>
				<Check size={12} /> Accept
			</button>
			<button
				type="button"
				onClick={() => onDismiss?.(goal)}
				aria-label="Dismiss suggestion"
				className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
			>
				<X size={13} />
			</button>
		</div>
	)
}

function ReviewPanel({
	doneToday,
	total,
	initialSummary,
	onSave,
}: {
	doneToday: number
	total: number
	initialSummary?: string
	onSave?: (text: string) => void
}) {
	const [text, setText] = useState(initialSummary ?? "")
	const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0
	return (
		<div className="rounded-xl bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-4 ring-1 ring-zinc-800/50">
			<div className="mb-3 flex items-center justify-between">
				<span className={cn("text-[12px] font-medium", TEXT.secondary)}>Evening review</span>
				<span className="text-[12px] tabular-nums text-violet-300">
					{doneToday}/{total} · {pct}%
				</span>
			</div>
			<VoiceInputWrapper>
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="How did today go? What will you carry into tomorrow?"
					rows={3}
					className="w-full resize-none rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/60 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 ring-1 ring-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60"
				/>
			</VoiceInputWrapper>
			<div className="mt-2 flex justify-end">
				<button
					type="button"
					onClick={() => onSave?.(text)}
					className="rounded-lg bg-violet-500/10 px-3 py-1.5 text-[12px] font-medium text-violet-300 ring-1 ring-violet-500/20 transition-colors hover:bg-violet-500/15"
				>
					Save review
				</button>
			</div>
		</div>
	)
}
