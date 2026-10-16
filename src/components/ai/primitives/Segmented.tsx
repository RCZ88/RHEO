import { motion, useReducedMotion } from "framer-motion"
import { cn } from "../lib/cn"
import { MOTION, TEXT } from "../tokens"

export interface SegmentedOption<T extends string> {
	value: T
	label: string
	count?: number
}

export interface SegmentedProps<T extends string> {
	options: SegmentedOption<T>[]
	value: T
	onChange: (value: T) => void
	className?: string
	"aria-label"?: string
}

/**
 * Segmented control used for filter tabs (Reflect) and pane switching (Plan).
 * The active pill slides between options via a shared layoutId (transform only).
 */
export function Segmented<T extends string>({
	options,
	value,
	onChange,
	className,
	...rest
}: SegmentedProps<T>) {
	const reduce = useReducedMotion()
	return (
		<div
			role="tablist"
			aria-label={rest["aria-label"]}
			className={cn(
				"inline-flex items-center gap-1 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-60)] p-1 ring-1 ring-zinc-800/60",
				className,
			)}
		>
			{options.map((opt) => {
				const active = opt.value === value
				return (
					<button
						key={opt.value}
						role="tab"
						aria-selected={active}
						onClick={() => onChange(opt.value)}
						className={cn(
							"relative rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors duration-150",
							active ? TEXT.primary : cn(TEXT.muted, "hover:text-zinc-300"),
						)}
					>
						{active ? (
							<motion.span
								layoutId="segmented-active"
							aria-hidden
							className="absolute inset-0 rounded-md bg-zinc-800/80 ring-1 ring-zinc-700"
							transition={ { duration: reduce ? 0 : MOTION.fast, ease: MOTION.ease } }
						/>
						) : null}
						<span className="relative flex items-center gap-1.5">
							{opt.label}
							{typeof opt.count === "number" ? (
								<span className="tabular-nums text-[11px] text-zinc-500">
									{opt.count}
								</span>
							) : null}
						</span>
					</button>
				)
			})}
		</div>
	)
}
