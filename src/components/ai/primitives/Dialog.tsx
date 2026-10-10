import { type ReactNode, useEffect } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "../lib/cn"
import { MOTION, TEXT } from "../tokens"
import { IconButton } from "../IconButton"

export interface DialogProps {
	open: boolean
	onClose: () => void
	title: string
	description?: string
	children: ReactNode
	footer?: ReactNode
	className?: string
}

/**
 * Lightweight modal (portal + overlay + focus trap-lite via Escape/backdrop).
 * DeskFlow-skinned: bg-zinc-900 light:bg-[var(--ws-surface-raised)], ring-1, rounded-xl, p-5. Overlay is a blurred
 * scrim. Content scales 0.98 -> 1 (transform/opacity only). Used for bulk import
 * and destructive confirmations.
 */
export function Dialog({
	open,
	onClose,
	title,
	description,
	children,
	footer,
	className,
}: DialogProps) {
	const reduce = useReducedMotion()

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, onClose])

	if (typeof document === "undefined") return null

	return createPortal(
		<AnimatePresence>
			{open ? (
				<motion.div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					initial={ { opacity: 0 } }
					animate={ { opacity: 1 } }
					exit={ { opacity: 0 } }
					transition={ { duration: reduce ? 0 : MOTION.fast } }
				>
					<div
						aria-hidden
						onClick={onClose}
						className="absolute inset-0 bg-black/50 backdrop-blur-sm"
					/>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-label={title}
						initial={ { opacity: 0, scale: reduce ? 1 : 0.98 } }
						animate={ { opacity: 1, scale: 1 } }
						exit={ { opacity: 0, scale: reduce ? 1 : 0.98 } }
						transition={ { duration: reduce ? 0 : MOTION.fast, ease: MOTION.ease } }
						className={cn(
							"relative w-full max-w-lg rounded-xl bg-zinc-900 light:bg-[var(--ws-surface-raised)] p-5 ring-1 ring-zinc-800/60",
							className,
						)}
					>
						<div className="mb-4 flex items-start justify-between gap-3">
							<div className="space-y-1">
								<h3 className={cn("text-[14px] font-semibold", TEXT.primary)}>
									{title}
								</h3>
								{description ? (
									<p className={cn("text-[12px]", TEXT.muted)}>{description}</p>
								) : null}
							</div>
							<IconButton icon={<X size={16} />} label="Close" onClick={onClose} />
						</div>
						<div>{children}</div>
						{footer ? (
							<div className="mt-5 flex items-center justify-end gap-2">{footer}</div>
						) : null}
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	)
}
