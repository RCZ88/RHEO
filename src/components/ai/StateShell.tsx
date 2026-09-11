import { type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "./lib/cn"
import { MOTION, TEXT } from "./tokens"
import type { DataState } from "./types"

export interface StateShellProps {
	state: DataState
	loading: ReactNode
	empty: ReactNode
	children: ReactNode
	errorMessage?: string
	onRetry?: () => void
	className?: string
}

/**
 * Renders exactly one of loading / empty / error / ready with a crossfade.
 * This enforces the Human-Centric 4-state contract in one place so no component
 * can accidentally render a blank box or a raw error.
 */
export function StateShell({
	state,
	loading,
	empty,
	children,
	errorMessage,
	onRetry,
	className,
}: StateShellProps) {
	const reduce = useReducedMotion()
	const content =
		state === "loading"
			? loading
			: state === "empty"
				? empty
				: state === "error"
					? <ErrorState message={errorMessage} onRetry={onRetry} />
					: children
	return (
		<div className={cn("relative", className)}>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={state}
					initial={ { opacity: 0 } }
					animate={ { opacity: 1 } }
					exit={ { opacity: 0 } }
					transition={ { duration: reduce ? 0 : MOTION.fast, ease: MOTION.ease } }
				>
					{content}
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function ErrorState({
	message,
	onRetry,
}: {
	message?: string
	onRetry?: () => void
}) {
	return (
		<div
			role="alert"
			className="flex flex-col items-center gap-3 rounded-xl bg-red-500/5 p-5 text-center ring-1 ring-red-500/20"
		>
			<AlertCircle size={20} className="text-red-400" />
			<p className={cn("text-[13px]", TEXT.secondary)}>
				{message ?? "Something went wrong loading this section."}
			</p>
			{onRetry ? (
				<button
					type="button"
					onClick={onRetry}
					className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-300 ring-1 ring-red-500/20 transition-colors hover:bg-red-500/15"
				>
					<RefreshCw size={13} /> Retry
				</button>
			) : null}
		</div>
	)
}

/** Reusable empty-state block: icon tile + message + optional CTA. */
export function EmptyState({
	icon,
	title,
	message,
	cta,
}: {
	icon: ReactNode
	title: string
	message?: string
	cta?: ReactNode
}) {
	return (
		<div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
			<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900/60 text-zinc-500 light:text-stone-500 ring-1 ring-zinc-800/60">
				{icon}
			</span>
			<div className="space-y-1">
				<p className={cn("text-[13px] font-medium", TEXT.secondary)}>{title}</p>
				{message ? (
					<p className={cn("text-[12px]", TEXT.muted)}>{message}</p>
				) : null}
			</div>
			{cta}
		</div>
	)
}
