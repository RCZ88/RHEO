import { type ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "./lib/cn"
import { ACCENT, TEXT, type AccentKey } from "./tokens"
import { CountUp } from "./primitives/CountUp"
import { IconButton } from "./IconButton"

export interface MetricCardProps {
	accent: AccentKey
	icon: ReactNode
	label: string
	value: number
	/** Format the big number (e.g. seconds -> "2h 15m"). */
	format?: (n: number) => string
	footer?: ReactNode
	refreshing?: boolean
	stale?: boolean
	staleLabel?: string
	onRefresh?: () => void
	className?: string
}

/**
 * Shared metric shell for SummaryGrid + Focus metric strip.
 * Alignment grid: 32px icon tile, 11px uppercase label, 24px mono number, footer.
 * Only the number carries the accent; everything else stays zinc (anti-slop).
 */
export function MetricCard({
	accent,
	icon,
	label,
	value,
	format,
	footer,
	refreshing,
	stale,
	staleLabel,
	onRefresh,
	className,
}: MetricCardProps) {
	const a = ACCENT[accent]
	return (
		<div
			className={cn(
				"group relative flex flex-col gap-3 rounded-xl bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-5 ring-1 ring-zinc-800/60",
				"transition-[box-shadow] duration-150 hover:ring-zinc-700",
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<span
					aria-hidden
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60",
						a.text,
					)}
				>
					{icon}
				</span>
				<div className="flex items-center gap-1.5">
					{stale ? (
						<span className="flex items-center gap-1 text-[10px] text-amber-400/80">
							<span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
							{staleLabel ?? "stale"}
						</span>
					) : null}
					{onRefresh ? (
						<span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
							<IconButton
								icon={
									<RefreshCw
										size={14}
									className={refreshing ? "animate-spin motion-reduce:animate-none" : ""}
								/>
							}
							label="Refresh"
							onClick={onRefresh}
						/>
						</span>
					) : null}
				</div>
			</div>
			<div className="space-y-1">
				<p className={cn("text-[11px] font-medium uppercase tracking-wide", TEXT.muted)}>
					{label}
				</p>
				<CountUp
					value={value}
					format={format}
					className={cn("text-2xl font-semibold", TEXT.primary)}
				/>
			</div>
			{footer ? (
				<div className={cn("text-[11px]", TEXT.muted)}>{footer}</div>
			) : null}
		</div>
	)
}
