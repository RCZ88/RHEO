/**
 * DeskFlow AI design tokens — the single source of truth for the /ai surface.
 * Never hard-code colors, radii, or timing in components; pull from here.
 * Dark mode only. No box-shadow. rounded-xl + p-5 max.
 */

export const SURFACE = {
	base: "bg-zinc-950",
	card: "bg-zinc-900/40",
	cardHi: "bg-zinc-900/60",
	inset: "bg-zinc-950/60",
} as const

export const RING = {
	base: "ring-1 ring-zinc-800/60",
	hover: "ring-zinc-700",
	active: "ring-zinc-600",
	focus:
		"focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:outline-none",
} as const

export const TEXT = {
	primary: "text-zinc-100",
	secondary: "text-zinc-400",
	muted: "text-zinc-500",
	disabled: "text-zinc-600",
} as const

export type AccentKey = "pink" | "emerald" | "amber" | "violet" | "red" | "cyan" | "automation"

export interface AccentDef {
	dot: string
	bar: string
	pill: string
	text: string
	ring: string
	hex: string
}

export const ACCENT: Record<AccentKey, AccentDef> = {
	pink: {
		dot: "bg-pink-400",
		bar: "bg-pink-500",
		pill: "bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20",
		text: "text-pink-300",
		ring: "ring-pink-500/30",
		hex: "#f472b6",
	},
	emerald: {
		dot: "bg-emerald-400",
		bar: "bg-emerald-500",
		pill: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20",
		text: "text-emerald-300",
		ring: "ring-emerald-500/30",
		hex: "#10b981",
	},
	amber: {
		dot: "bg-amber-400",
		bar: "bg-amber-500",
		pill: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20",
		text: "text-amber-300",
		ring: "ring-amber-500/30",
		hex: "#f59e0b",
	},
	violet: {
		dot: "bg-violet-400",
		bar: "bg-violet-500",
		pill: "bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20",
		text: "text-violet-300",
		ring: "ring-violet-500/30",
		hex: "#a78bfa",
	},
	automation: {
		dot: "bg-violet-400",
		bar: "bg-violet-500",
		pill: "bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20",
		text: "text-violet-300",
		ring: "ring-violet-500/30",
		hex: "#a78bfa",
	},
	red: {
		dot: "bg-red-400",
		bar: "bg-red-500",
		pill: "bg-red-500/10 text-red-300 ring-1 ring-red-500/20",
		text: "text-red-300",
		ring: "ring-red-500/30",
		hex: "#f87171",
	},
	cyan: {
		dot: "bg-cyan-400",
		bar: "bg-cyan-500",
		pill: "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20",
		text: "text-cyan-300",
		ring: "ring-cyan-500/30",
		hex: "#22d3ee",
	},
}

export const MOTION = {
	fast: 0.15,
	normal: 0.25,
	slow: 0.4,
	ease: [0.16, 1, 0.3, 1] as const,
	easeInOut: [0.4, 0, 0.2, 1] as const,
	stagger: 0.05,
} as const

/** Section identity map — one accent per section, applied sparingly. */
export const SECTION_ACCENT = {
	chat: "pink",
	summary: "pink",
	connectors: "cyan",
	digest: "cyan",
	focus: "emerald",
	plan: "violet",
	reflect: "amber",
	automation: "violet",
} as const satisfies Record<string, AccentKey>

export type ActionType =
  | 'goal-toggle' | 'goal-add' | 'goal-delete' | 'goal-update' | 'goal-suggestions'
  | 'schedule-add' | 'schedule-delete' | 'schedule-update'
  | 'deadline-add' | 'deadline-delete' | 'deadline-update'
  | 'email-send' | 'email-mark-read' | 'email-sync'
  | 'calendar-create' | 'calendar-update' | 'calendar-delete'
  | 'composition-create' | 'composition-update' | 'composition-delete' | 'composition-evaluate'
  | 'canvas-add' | 'canvas-remove' | 'canvas-group' | 'canvas-ungroup'
  | 'ai-generate' | 'ai-stream' | 'connector-sync'

export const ACTION_ACCENT: Record<ActionType, AccentKey> = {
  'goal-toggle': 'emerald', 'goal-add': 'emerald', 'goal-delete': 'red', 'goal-update': 'amber', 'goal-suggestions': 'violet',
  'schedule-add': 'cyan', 'schedule-delete': 'red', 'schedule-update': 'amber',
  'deadline-add': 'amber', 'deadline-delete': 'red', 'deadline-update': 'amber',
  'email-send': 'pink', 'email-mark-read': 'pink', 'email-sync': 'cyan',
  'calendar-create': 'violet', 'calendar-update': 'violet', 'calendar-delete': 'red',
  'composition-create': 'emerald', 'composition-update': 'amber', 'composition-delete': 'red', 'composition-evaluate': 'cyan',
  'canvas-add': 'violet', 'canvas-remove': 'red', 'canvas-group': 'pink', 'canvas-ungroup': 'amber',
  'ai-generate': 'violet', 'ai-stream': 'pink', 'connector-sync': 'cyan',
}

export const ACTION_ICON: Record<ActionType, string> = {
  'goal-toggle': 'Check', 'goal-add': 'Plus', 'goal-delete': 'Trash2', 'goal-update': 'Pencil', 'goal-suggestions': 'Sparkles',
  'schedule-add': 'CalendarPlus', 'schedule-delete': 'Trash2', 'schedule-update': 'Pencil',
  'deadline-add': 'Clock', 'deadline-delete': 'Trash2', 'deadline-update': 'Pencil',
  'email-send': 'Send', 'email-mark-read': 'Mail', 'email-sync': 'RefreshCw',
  'calendar-create': 'CalendarPlus', 'calendar-update': 'Pencil', 'calendar-delete': 'Trash2',
  'composition-create': 'Plus', 'composition-update': 'Pencil', 'composition-delete': 'Trash2', 'composition-evaluate': 'Play',
  'canvas-add': 'Plus', 'canvas-remove': 'X', 'canvas-group': 'Group', 'canvas-ungroup': 'Ungroup',
  'ai-generate': 'Sparkles', 'ai-stream': 'Radio', 'connector-sync': 'RefreshCw',
}
