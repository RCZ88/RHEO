import { type ReactNode } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { cn } from "./lib/cn"
import { ACCENT, MOTION, TEXT, type AccentKey } from "./tokens"

export interface SectionHeadProps {
	accent: AccentKey
	icon: ReactNode
	title: string
	desc?: string
	right?: ReactNode
	/** When true the whole header acts as an accordion toggle (mobile pattern). */
	collapsible?: boolean
	collapsed?: boolean
	onToggle?: () => void
	reduce?: boolean
	/** Larger treatment for the hero (Daily Digest). */
	hero?: boolean
}

/**
 * Consistent section header: accent bar + 32px icon tile + title/desc + right slot.
 * This is the visual rhythm device that gives each section its identity without
 * a repeated tracked-uppercase kicker (anti-slop).
 */
export function SectionHead({
	accent,
	icon,
	title,
	desc,
	right,
	collapsible,
	collapsed,
	onToggle,
	reduce,
	hero,
}: SectionHeadProps) {
	const a = ACCENT[accent]
	const TitleTag = hero ? "h2" : "h3"
	return (
		<div className="mb-4 flex items-center gap-3">
			<span aria-hidden className={cn("h-8 w-0.5 rounded-full", a.bar)} />
			<span
				aria-hidden
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
					"bg-zinc-900/60 ring-1 ring-zinc-800/60",
					a.text,
				)}
			>
				{icon}
			</span>
			<button
				type="button"
				onClick={collapsible ? onToggle : undefined}
				className={cn(
					"flex min-w-0 flex-1 items-center gap-2 text-left",
					collapsible ? "cursor-pointer" : "cursor-default",
				)}
				aria-expanded={collapsible ? !collapsed : undefined}
			>
				<span className="min-w-0">
					<TitleTag
						className={cn(
							"truncate font-semibold",
							hero ? "text-[15px]" : "text-[14px]",
							TEXT.primary,
						)}
					>
						{title}
					</TitleTag>
					{desc ? (
						<p className={cn("truncate text-[12px]", TEXT.muted)}>{desc}</p>
					) : null}
				</span>
				{collapsible ? (
					<motion.span
						aria-hidden
						animate={ { rotate: collapsed ? 0 : 180 } }
						transition={ { duration: reduce ? 0 : MOTION.fast, ease: MOTION.ease } }
						className="ml-1 text-zinc-500 light:text-stone-500"
					>
						<ChevronDown size={16} />
					</motion.span>
				) : null}
			</button>
			{right ? <div className="flex items-center gap-1">{right}</div> : null}
		</div>
	)
}
