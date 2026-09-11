/**
 * Shared motion system for the /ai surface.
 *
 * Rules enforced here (Motion skill / L2 budget):
 * - Animate transform + opacity ONLY.
 * - Durations 150 / 250 / 400ms. No spring physics.
 * - Easing [0.16,1,0.3,1] standard, [0.4,0,0.2,1] in/out.
 * - Everything degrades to instant under prefers-reduced-motion.
 *
 * Use `useMotionProps()` in components so reduced-motion is handled once.
 */
import { useReducedMotion, type Variants, type Transition } from "framer-motion"
import { MOTION } from "../tokens"

export const easeOut = MOTION.ease
export const easeInOut = MOTION.easeInOut

/** Section entrance: subtle rise + fade. */
export const sectionVariants: Variants = {
	hidden: { opacity: 0, y: 8 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: MOTION.slow, ease: easeOut },
	},
}

/** Container that staggers its children on mount. */
export const staggerParent: Variants = {
	hidden: {},
	show: {
		transition: { staggerChildren: MOTION.stagger, delayChildren: 0.02 },
	},
}

/** Child row/item entrance used inside a staggerParent. */
export const itemVariants: Variants = {
	hidden: { opacity: 0, y: 6 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: MOTION.normal, ease: easeOut },
	},
}

/** Collapsible height + fade. */
export const collapseTransition: Transition = {
	duration: MOTION.normal,
	ease: easeInOut,
}

/** Dialog content. */
export const dialogVariants: Variants = {
	hidden: { opacity: 0, scale: 0.98 },
	show: { opacity: 1, scale: 1, transition: { duration: MOTION.fast, ease: easeOut } },
	exit: { opacity: 0, scale: 0.98, transition: { duration: MOTION.fast, ease: easeInOut } },
}

/**
 * Returns reduced-motion-aware variants + a flag.
 * When the user prefers reduced motion, all offsets/scales collapse so only
 * opacity (or nothing) changes, and loops should be disabled by callers.
 */
export function useMotionProps() {
	const reduce = useReducedMotion()
	if (reduce) {
		return {
			reduce: true as const,
			section: {
				hidden: { opacity: 0 },
				show: { opacity: 1, transition: { duration: 0 } },
			} satisfies Variants,
			item: {
				hidden: { opacity: 0 },
				show: { opacity: 1, transition: { duration: 0 } },
			} satisfies Variants,
			parent: { hidden: {}, show: { transition: { staggerChildren: 0 } } } satisfies Variants,
		}
	}
	return {
		reduce: false as const,
		section: sectionVariants,
		item: itemVariants,
		parent: staggerParent,
	}
}

// ═══ Action Animation Variants ═══

export const cardEnterVariants: Variants = {
	hidden: { opacity: 0, scale: 0.95, y: 12 },
	show: { opacity: 1, scale: 1, y: 0, transition: { duration: MOTION.slow, ease: easeOut } },
	exit: { opacity: 0, scale: 0.95, y: 8, transition: { duration: MOTION.normal, ease: easeInOut } },
}

export const cardExitVariants: Variants = {
	exit: { opacity: 0, y: 16, scale: 0.95, transition: { duration: MOTION.normal, ease: easeInOut } },
}

export const contentUpdateVariants: Variants = {
	idle: { backgroundColor: "rgba(139,92,246,0)" },
	flash: {
		backgroundColor: ["rgba(139,92,246,0)", "rgba(139,92,246,0.08)", "rgba(139,92,246,0)"],
		transition: { duration: 0.6, ease: "easeInOut" },
	},
}

export const actionSpinnerVariants: Variants = {
	hidden: { opacity: 0, scale: 0.8 },
	show: { opacity: 1, scale: 1, transition: { duration: MOTION.fast, ease: easeOut } },
	exit: { opacity: 0, scale: 0.8, transition: { duration: MOTION.fast, ease: easeInOut } },
}

export const completionBurstVariants: Variants = {
	hidden: { opacity: 0, scale: 0.6 },
	show: { opacity: 1, scale: 1, transition: { duration: MOTION.normal, ease: [0.34, 1.56, 0.64, 1] } },
	exit: { opacity: 0, scale: 1.1, transition: { duration: MOTION.fast, ease: easeInOut } },
}

export const glowPulseVariants: Variants = {
	idle: { boxShadow: "0 0 0px 0px rgba(16,185,129,0)" },
	glow: {
		boxShadow: ["0 0 0px 0px rgba(16,185,129,0)", "0 0 12px 2px rgba(16,185,129,0.25)", "0 0 0px 0px rgba(16,185,129,0)"],
		transition: { duration: 1.2, ease: "easeInOut" },
	},
}

export const errorShakeVariants: Variants = {
	idle: { x: 0 },
	shake: { x: [0, -6, 6, -4, 4, -2, 2, 0], transition: { duration: 0.5, ease: "easeInOut" } },
}

export const errorFlashVariants: Variants = {
	idle: { borderColor: "rgba(63,63,70,0.5)" },
	flash: {
		borderColor: ["rgba(63,63,70,0.5)", "rgba(239,68,68,0.6)", "rgba(239,68,68,0.3)", "rgba(63,63,70,0.5)"],
		transition: { duration: 0.6, ease: "easeInOut" },
	},
}

export const listItemAddVariants: Variants = {
	hidden: { opacity: 0, x: 24, height: 0 },
	show: { opacity: 1, x: 0, height: "auto", transition: { duration: MOTION.normal, ease: easeOut } },
}

export const listItemRemoveVariants: Variants = {
	exit: { opacity: 0, x: -24, height: 0, marginBottom: 0, transition: { duration: MOTION.normal, ease: easeInOut } },
}

export const dragFeedbackVariants: Variants = {
	idle: { scale: 1, zIndex: 1 },
	dragging: { scale: 1.03, zIndex: 100, transition: { duration: MOTION.fast, ease: easeOut } },
}

export const groupFormationVariants: Variants = {
	hidden: { opacity: 0, scale: 1.1 },
	show: { opacity: 1, scale: 1, transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] } },
}

export const groupColorPulse: Variants = {
	idle: { opacity: 0.6 },
	pulse: { opacity: [0.6, 1, 0.6], transition: { duration: 0.8, ease: "easeInOut", repeat: 1 } },
}

export const aiBuildingVariants: Variants = {
	hidden: { opacity: 0, y: 20, scale: 0.9 },
	building: { opacity: 0.6, y: 10, scale: 0.95, transition: { duration: MOTION.slow, ease: easeOut } },
	show: { opacity: 1, y: 0, scale: 1, transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] } },
}

export const compositionExecuteVariants: Variants = {
	idle: { opacity: 1 },
	execute: { opacity: [1, 0.7, 1], transition: { duration: 0.4, ease: "easeInOut" } },
}

export const statusBadgePulse: Variants = {
	idle: { scale: 1 },
	pulse: { scale: [1, 1.15, 1], transition: { duration: 0.5, ease: "easeInOut" } },
}

export function useActionMotionProps() {
	const reduce = useReducedMotion()
	const instant = { duration: 0 }
	if (reduce) {
		return {
			reduce: true as const,
			cardEnter: { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } } satisfies Variants,
			listItem: { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } } satisfies Variants,
			shake: { idle: {}, shake: {} } satisfies Variants,
			burst: { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } } satisfies Variants,
			building: { hidden: { opacity: 0 }, building: { opacity: 0.6, transition: instant }, show: { opacity: 1, transition: instant } } satisfies Variants,
		}
	}
	return {
		reduce: false as const,
		cardEnter: cardEnterVariants,
		listItem: { ...listItemAddVariants, exit: listItemRemoveVariants.exit },
		shake: errorShakeVariants,
		burst: completionBurstVariants,
		building: aiBuildingVariants,
	}
}

// ---- Automation Cards (spec 13) ---------------------------

/** Automation card entrance (from AI creation or user save). */
export const automationEnterVariants: Variants = {
	hidden: { opacity: 0, scale: 0.92, y: 16 },
	show: {
		opacity: 1, scale: 1, y: 0,
		transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] },
	},
	exit: {
		opacity: 0, scale: 0.92, y: 12,
		transition: { duration: MOTION.normal, ease: easeInOut },
	},
}

/** Automation executing (test run / live fire) � violet glow pulse. */
export const automationPulseVariants: Variants = {
	idle: { boxShadow: '0 0 0px 0px rgba(139,92,246,0)' },
	active: {
		boxShadow: [
			'0 0 0px 0px rgba(139,92,246,0)',
			'0 0 16px 3px rgba(139,92,246,0.15)',
			'0 0 0px 0px rgba(139,92,246,0)',
		],
		transition: { duration: 1.5, ease: 'easeInOut', repeat: Infinity },
	},
}

/** Automation created celebration (brief). */
export const automationCreatedVariants: Variants = {
	hidden: { opacity: 0, scale: 0.8, rotate: -2 },
	show: {
		opacity: 1, scale: 1, rotate: 0,
		transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] },
	},
}
