import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { Progress } from "../primitives/Progress"
import { cn } from "../lib/cn"
import { MOTION, TEXT } from "../tokens"

export interface AgentStep {
	id: string
	label: string
	status: "pending" | "active" | "done"
}

export interface AgentProgressBarProps {
	visible: boolean
	steps?: AgentStep[]
	statusText?: string
	actionId?: string
	className?: string
}

/**
 * Honest agent-working banner. If discrete steps are provided it shows a
 * determinate ratio; otherwise an indeterminate sync bar with a status line.
 * Slides down on mount, collapses on exit (transform/opacity + height).
 */
export function AgentProgressBar({ visible, steps, statusText, className }: AgentProgressBarProps) {
	const reduce = useReducedMotion()
	const total = steps?.length ?? 0
	const done = steps?.filter((s) => s.status === "done").length ?? 0
	const active = steps?.find((s) => s.status === "active")
	const ratio = total > 0 ? done / total : 0
	return (
		<AnimatePresence initial={false}>
			{visible ? (
				<motion.div
					initial={ { opacity: 0, height: 0 } }
					animate={ { opacity: 1, height: "auto" } }
					exit={ { opacity: 0, height: 0 } }
					transition={ { duration: reduce ? 0 : MOTION.normal, ease: MOTION.easeInOut } }
					className={cn("overflow-hidden", className)}
				>
					<div className="rounded-lg bg-zinc-900/60 p-3 ring-1 ring-zinc-800/60">
						<div className="mb-2 flex items-center gap-2">
							<Loader2 size={13} className="text-pink-300 animate-spin motion-reduce:animate-none" />
							<span className={cn("flex-1 truncate text-[12px]", TEXT.secondary)}>
								{active?.label ?? statusText ?? "Working…"}
							</span>
							{total > 0 ? (
								<span className="text-[11px] tabular-nums text-zinc-500">
									{done}/{total}
								</span>
							) : null}
						</div>
						<Progress
							accent="pink"
							indeterminate={total === 0}
							value={ratio}
							aria-label="Agent progress"
						/>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	)
}
