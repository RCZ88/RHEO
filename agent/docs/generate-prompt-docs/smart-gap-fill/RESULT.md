<aside>
🧩

Lead Designer + Engineer execution against `agent/docs/smart-gap-fill/CONTEXT_BUNDLE.md`. One comprehensive solution — math to pixels. Exact code, real file paths/line numbers, real Tailwind. Hand to the opencode agent and implement top-to-bottom. Companion to DeskFlow — AI Assistant Full Fix (Unified Provider Client, Diagnostics & Logging); use the relay + terminal-only steps in the DeskFlow Workspace — Context Handoff (2026-06-28).

</aside>

## 0. Scope & ground truth

Backend is **100% ready** — `detectUsageGaps`, `predictGapFill`, `confirmGapFill`, `predictDayGaps`, `getTypicalDay` all exist with preload bindings. This is a **renderer-only** build: new components + hooks + two `InsightsPage.tsx` edits. No new routes, no IPC changes, no `main.ts` edits.

<aside>
🎨

**Design skills applied:** *human-centred UI/UX* (mode prompt with plain-language choices, skip/include affordances, empty/error/loading states, keyboard nav), *frontend-design* (token-exact dark theme, confidence color system, spring motion), *frontend-external-infra* (lazy per-gap prediction + cache to avoid hammering IPC), *impeccable* (CRLF preserved, localStorage in try/catch, no layout regressions). **MCP note:** Magic UI / 21st.dev / shadcn MCP servers are **not connected to this agent**, so I specify equivalent Framer Motion + Tailwind primitives directly rather than pulling generated snippets — drop-in and dependency-free.

</aside>

## 1. Implementation Plan

| File | Action | What changes |
| --- | --- | --- |
| `src/types/gaps.ts` | NEW | Shared types: `Gap`, `GapMode`, `SlotPrediction`, `PredictedSlot`, `PredictedGap`, `DayGapGroup`, `ConfirmFill` |
| `src/lib/gapMapping.ts` | NEW | Time math: map ISO gaps → 7×24 day-of-week cells; `buildGapMap`, `isoToCell`, `cellId` |
| `src/lib/tooltipAnchor.ts` | NEW | 4-side proximity anchoring + viewport clamp (the bug fix) |
| `src/hooks/useGapPredictions.ts` | NEW | Wraps the 4 IPC calls; localStorage mode persistence; per-gap cache |
| `src/components/GapFillDrawer.tsx` | NEW | The smart slide-up drawer (replaces GapPanel) |
| `src/pages/InsightsPage.tsx` | EDIT | Tooltip fix (527-532), cell fill+stripe overlay, gap map, drawer mount |
| `src/components/GapBanner.tsx` | EDIT | Becomes a pure trigger: calls `onOpen()` instead of mounting GapPanel |
| `src/components/GapPanel.tsx` | DELETE | Replaced by the drawer |
| `src/components/GapPredictorPanel.tsx` | DELETE | Discarded draft — remove to avoid confusion |
| `src/App.tsx` | EDIT | Remove `fill-time-gap` CustomEvent listener + GapPanel import (drawer confirms directly via `confirmGapFill`) |

### Shared types — `src/types/gaps.ts`

```tsx
// src/types/gaps.ts
export type GapMode = 'combined' | 'separate'

export interface Gap {
	start: string // ISO
	end: string // ISO
	durationSeconds: number
}

export interface SlotPrediction {
	app: string
	category: string
	confidence: number // 0-99
	avgSeconds: number
	daysUsed: number
}

export interface PredictedSlot {
	slotStart: string
	slotEnd: string
	predictions: SlotPrediction[]
	durationSeconds: number
}

export interface PredictedGap {
	start: string
	end: string
	durationSeconds: number
	slots: PredictedSlot[]
}

export interface DayGapGroup {
	gapStart: string
	gapEnd: string
	durationSeconds: number
	slots: PredictedSlot[]
	predicted: boolean
}

export interface ConfirmFill {
	slotStart: string
	slotEnd: string
	app: string
	category: string
}
```

These mirror the exact return shapes documented in CONTEXT_BUNDLE §2 (`predictGapFill.gaps[].slots[].predictions[]`, `predictDayGaps.slots[]`, `confirmGapFill(fills)`).

## 2. Phase 1 — Core Gap Fill Drawer

### 2.1 Hook — `src/hooks/useGapPredictions.ts`

Wraps all four IPC endpoints, persists mode in `localStorage` (try/catch per constraint), and caches per-gap predictions by `start|end|mode` so re-expanding a gap doesn't re-hit IPC.

```tsx
// src/hooks/useGapPredictions.ts
import { useCallback, useRef, useState } from 'react'
import type { ConfirmFill, DayGapGroup, Gap, GapMode, PredictedGap } from '../types/gaps'

const MODE_KEY = 'deskflow.gapFillMode'

export function loadMode(): GapMode {
	try {
		return localStorage.getItem(MODE_KEY) === 'separate' ? 'separate' : 'combined'
	} catch {
		return 'combined'
	}
}
export function saveMode(mode: GapMode): void {
	try {
		localStorage.setItem(MODE_KEY, mode)
	} catch {
		/* storage disabled; ignore */
	}
}
export function modeChosen(): boolean {
	try {
		return localStorage.getItem(MODE_KEY) != null
	} catch {
		return false
	}
}

// window.deskflowAPI is the existing preload bridge (see CONTEXT_BUNDLE §2).
type Api = {
	detectUsageGaps: (o?: { period?: string; minGapMinutes?: number }) => Promise<Gap[]>
	predictGapFill: (start: string, end: string, mode?: GapMode) => Promise<{ gaps: PredictedGap[] }>
	predictDayGaps: (date: string, mode?: GapMode) => Promise<{ date: string; slots: DayGapGroup[] }>
	confirmGapFill: (fills: ConfirmFill[]) => Promise<unknown>
}
const api = (): Api => (window as unknown as { deskflowAPI: Api }).deskflowAPI

export function useGapPredictions(period: string) {
	const [gaps, setGaps] = useState<Gap[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const cache = useRef<Map<string, PredictedGap | null>>(new Map())

	const detect = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const list = await api().detectUsageGaps({ period, minGapMinutes: 15 })
			setGaps(Array.isArray(list) ? list : [])
		} catch {
			setError('Could not load gaps')
		} finally {
			setLoading(false)
		}
	}, [period])

	const predictGap = useCallback(async (gap: Gap, mode: GapMode): Promise<PredictedGap | null> => {
		const key = gap.start + '|' + gap.end + '|' + mode
		if (cache.current.has(key)) return cache.current.get(key) ?? null
		try {
			const res = await api().predictGapFill(gap.start, gap.end, mode)
			const pg = res?.gaps?.[0] ?? null
			cache.current.set(key, pg)
			return pg
		} catch {
			setError('Could not load predictions')
			return null
		}
	}, [])

	const predictDay = useCallback(async (date: string, mode: GapMode): Promise<DayGapGroup[]> => {
		try {
			const res = await api().predictDayGaps(date, mode)
			return res?.slots ?? []
		} catch {
			setError('Could not load predictions')
			return []
		}
	}, [])

	const confirm = useCallback(async (fills: ConfirmFill[]): Promise<boolean> => {
		if (!fills.length) return true
		try {
			await api().confirmGapFill(fills)
			return true
		} catch {
			setError('Could not save filled slots')
			return false
		}
	}, [])

	return { gaps, loading, error, setError, detect, predictGap, predictDay, confirm }
}
```

### 2.2 Drawer — `src/components/GapFillDrawer.tsx`

Slide-up drawer (NOT a modal): `absolute inset-x-0 bottom-0` inside the Typical Day section, `AnimatePresence` mount, spring entrance. Lazy per-gap prediction on expand, per-slot select/swap/skip, Accept-all per gap, mode toggle, first-run mode prompt, all empty/error/loading/keyboard states.

<aside>
⚠️

**Motion-prop convention used throughout:** all Framer Motion `variants`/`transition`/`style` objects are hoisted to named consts (e.g. `drawerSpring`, `collapse`) and referenced with a single brace (`transition={drawerSpring}`). This is intentional — it keeps the components clean *and* avoids the double-brace token issue when these files are written into the sandbox.

</aside>

```tsx
// src/components/GapFillDrawer.tsx
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Clock, RefreshCw, Sparkles, X } from 'lucide-react'
import type { ConfirmFill, DayGapGroup, Gap, GapMode, PredictedGap, PredictedSlot, SlotPrediction } from '../types/gaps'
import { loadMode, modeChosen, saveMode, useGapPredictions } from '../hooks/useGapPredictions'

const drawerVariants = { hidden: { y: '100%' }, visible: { y: 0 } }
const drawerSpring = { type: 'spring', duration: 0.4, bounce: 0.25 }
const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }
const itemVariants = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }
const collapse = { height: 0, opacity: 0 }
const expand = { height: 'auto', opacity: 1 }
const rowSpring = { type: 'spring', duration: 0.3, bounce: 0.2 }
const fade0 = { opacity: 0 }
const fade1 = { opacity: 1 }

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtMin = (s: number) => Math.round(s / 60) + 'm'
const barStyle = (c: number) => ({ width: Math.max(2, Math.min(100, c)) + '%' })
const why = (p: SlotPrediction) => p.daysUsed + '/30 days at this hour · avg ' + fmtMin(p.avgSeconds) + ' · ' + p.category

function confidenceTone(c: number) {
	if (c >= 70) return { badge: 'bg-emerald-500/20 text-emerald-300', bar: 'bg-emerald-400' }
	if (c >= 40) return { badge: 'bg-amber-500/20 text-amber-300', bar: 'bg-amber-400' }
	return { badge: 'bg-zinc-600/30 text-zinc-400', bar: 'bg-zinc-500' }
}

interface GapFillDrawerProps {
	open: boolean
	period: string
	focusGapStart?: string
	onClose: () => void
	onFilled?: () => void
}

export function GapFillDrawer({ open, period, focusGapStart, onClose, onFilled }: GapFillDrawerProps) {
	const { gaps, loading, error, detect, predictGap, predictDay, confirm } = useGapPredictions(period)
	const [mode, setMode] = useState<GapMode>(loadMode)
	const [askMode, setAskMode] = useState(false)
	const [expanded, setExpanded] = useState<string | null>(null)
	const [predicted, setPredicted] = useState<Record<string, PredictedGap | null>>({})
	const [predicting, setPredicting] = useState<string | null>(null)
	const [sel, setSel] = useState<Record<string, number>>({}) // slotStart -> index ( -1 = skip )
	const [busy, setBusy] = useState(false)

	const openGap = useCallback(
		async (start: string) => {
			const gap = gaps.find((g) => g.start === start)
			if (!gap || predicted[start] !== undefined) return
			setPredicting(start)
			const pg = await predictGap(gap, mode)
			setPredicted((p) => ({ ...p, [start]: pg }))
			if (pg) {
				setSel((s) => {
					const next = { ...s }
					for (const slot of pg.slots)
						if (next[slot.slotStart] === undefined) next[slot.slotStart] = slot.predictions.length ? 0 : -1
					return next
				})
			}
			setPredicting(null)
		},
		[gaps, predicted, predictGap, mode],
	)

	useEffect(() => {
		if (!open) return
		if (!modeChosen()) setAskMode(true)
		detect()
	}, [open, detect])

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [open, onClose])

	useEffect(() => {
		if (open && focusGapStart) {
			setExpanded(focusGapStart)
			void openGap(focusGapStart)
		}
	}, [open, focusGapStart, openGap])

	const chooseMode = (m: GapMode) => {
		setMode(m)
		saveMode(m)
		setAskMode(false)
		setPredicted({}) // invalidate cache view; hook cache keys include mode
	}

	const toggleGap = (start: string) => {
		const next = expanded === start ? null : start
		setExpanded(next)
		if (next) void openGap(start)
	}

	const acceptGap = async (pg: PredictedGap) => {
		setBusy(true)
		const fills: ConfirmFill[] = []
		for (const slot of pg.slots) {
			const idx = sel[slot.slotStart] ?? 0
			if (idx < 0) continue
			const pred = slot.predictions[idx]
			if (pred) fills.push({ slotStart: slot.slotStart, slotEnd: slot.slotEnd, app: pred.app, category: pred.category })
		}
		const ok = await confirm(fills)
		setBusy(false)
		if (ok) {
			onFilled?.()
			setExpanded(null)
			detect()
		}
	}

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					variants={drawerVariants}
					initial='hidden'
					animate='visible'
					exit='hidden'
					transition={drawerSpring}
					role='dialog'
					aria-label='Smart Gap Fill'
					className='absolute inset-x-0 bottom-0 z-40 max-h-[70%] overflow-hidden rounded-t-2xl border border-zinc-700/50 bg-zinc-900/95 shadow-2xl backdrop-blur'
				>
					<div className='h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-emerald-500/40 to-indigo-500/40' />
					<div className='flex items-center justify-between px-4 py-3'>
						<div className='flex items-center gap-2'>
							<div className='flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20'>
								<Sparkles className='h-4 w-4 text-indigo-300' />
							</div>
							<div>
								<div className='text-sm font-medium text-zinc-100'>Smart Gap Fill</div>
								<div className='text-xs text-zinc-500'>
									{gaps.length} gap{gaps.length === 1 ? '' : 's'} · {period}
								</div>
							</div>
						</div>
						<div className='flex items-center gap-1'>
							<ModeToggle mode={mode} onChange={chooseMode} />
							<button onClick={detect} aria-label='Refresh' className='rounded-lg p-2 text-zinc-400 hover:bg-zinc-800'>
								<RefreshCw className='h-4 w-4' />
							</button>
							<button onClick={onClose} aria-label='Close' className='rounded-lg p-2 text-zinc-400 hover:bg-zinc-800'>
								<X className='h-4 w-4' />
							</button>
						</div>
					</div>

					<div className='max-h-[calc(70vh-120px)] overflow-y-auto px-4 pb-4'>
						{loading && <GapSkeleton />}
						{error && <ErrorRow message={error} onRetry={detect} />}
						{!loading && !error && gaps.length === 0 && <AllAccounted />}

						<motion.div variants={listVariants} initial='hidden' animate='visible' className='space-y-2'>
							{gaps.map((g) => (
								<GapRow
									key={g.start}
									gap={g}
									expanded={expanded === g.start}
									predicting={predicting === g.start}
									pg={predicted[g.start]}
									sel={sel}
									setSel={setSel}
									busy={busy}
									onToggle={() => toggleGap(g.start)}
									onAccept={acceptGap}
								/>
							))}
						</motion.div>

						{!loading && gaps.length > 0 && (
							<BatchDayButton mode={mode} predictDay={predictDay} confirm={confirm} onFilled={() => { onFilled?.(); detect() }} />
						)}
					</div>

					{askMode && <ModePrompt onChoose={chooseMode} />}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

function ModeToggle({ mode, onChange }: { mode: GapMode; onChange: (m: GapMode) => void }) {
	const opts: GapMode[] = ['combined', 'separate']
	return (
		<div
			className='mr-1 flex items-center rounded-lg bg-zinc-800/60 p-0.5'
			title='Combined = predict from apps AND external sessions. Separate = only use app tracking data.'
		>
			{opts.map((m) => (
				<button
					key={m}
					onClick={() => onChange(m)}
					className={'rounded-md px-2 py-1 text-[11px] ' + (mode === m ? 'bg-zinc-700 text-zinc-200 shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}
				>
					{m === 'combined' ? 'Combined' : 'Separate'}
				</button>
			))}
		</div>
	)
}

function ModePrompt({ onChoose }: { onChoose: (m: GapMode) => void }) {
	return (
		<motion.div
			initial={fade0}
			animate={fade1}
			exit={fade0}
			className='absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm'
		>
			<div className='w-[320px] rounded-2xl border border-zinc-700/50 bg-zinc-900 p-5 text-center'>
				<div className='text-sm font-medium text-zinc-100'>How should I guess your gaps?</div>
				<div className='mt-1 text-xs text-zinc-500'>You can switch anytime with the toggle.</div>
				<div className='mt-4 space-y-2'>
					<button onClick={() => onChoose('combined')} className='w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500'>
						Combine app + external data
					</button>
					<button onClick={() => onChoose('separate')} className='w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 py-2 text-sm text-zinc-200 hover:bg-zinc-800'>
						Separate them
					</button>
				</div>
			</div>
		</motion.div>
	)
}

interface GapRowProps {
	gap: Gap
	expanded: boolean
	predicting: boolean
	pg: PredictedGap | null | undefined
	sel: Record<string, number>
	setSel: React.Dispatch<React.SetStateAction<Record<string, number>>>
	busy: boolean
	onToggle: () => void
	onAccept: (pg: PredictedGap) => void
}

function GapRow({ gap, expanded, predicting, pg, sel, setSel, busy, onToggle, onAccept }: GapRowProps) {
	const included = pg ? pg.slots.filter((s) => (sel[s.slotStart] ?? 0) >= 0).length : 0
	return (
		<motion.div variants={itemVariants} layout className='rounded-xl border border-zinc-700/20 bg-zinc-800/30'>
			<button onClick={onToggle} className='flex w-full items-center justify-between px-3 py-2.5 text-left'>
				<span className='flex items-center gap-2'>
					<Clock className='h-3.5 w-3.5 text-zinc-500' />
					<span className='font-mono text-xs text-zinc-300'>{fmtTime(gap.start)}–{fmtTime(gap.end)}</span>
					<span className='text-xs text-zinc-500'>{fmtMin(gap.durationSeconds)} untracked</span>
				</span>
				<ChevronDown className={'h-4 w-4 text-zinc-500 transition-transform ' + (expanded ? 'rotate-180' : '')} />
			</button>
			<AnimatePresence initial={false}>
				{expanded && (
					<motion.div initial={collapse} animate={expand} exit={collapse} transition={rowSpring} className='overflow-hidden'>
						<div className='space-y-2 px-3 pb-3'>
							{predicting && <SlotSkeleton />}
							{!predicting && pg === null && <NoData />}
							{!predicting && pg && pg.slots.map((slot) => (
								<SlotRow
									key={slot.slotStart}
									slot={slot}
									index={sel[slot.slotStart] ?? 0}
									onSelect={(i) => setSel((s) => ({ ...s, [slot.slotStart]: i }))}
								/>
							))}
							{!predicting && pg && pg.slots.length > 0 && (
								<button
									disabled={busy}
									onClick={() => onAccept(pg)}
									className='mt-1 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50'
								>
									Accept all · {included} slot{included === 1 ? '' : 's'}
								</button>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	)
}

function SlotRow({ slot, index, onSelect }: { slot: PredictedSlot; index: number; onSelect: (i: number) => void }) {
	const skipped = index < 0
	const active = Math.max(0, index)
	const top = slot.predictions[active]
	const tone = confidenceTone(top ? top.confidence : 0)
	return (
		<div
			tabIndex={0}
			role='button'
			aria-pressed={!skipped}
			onKeyDown={(e) => {
				if (e.key === ' ') {
					e.preventDefault()
					onSelect(skipped ? 0 : -1)
				}
			}}
			className={
				'rounded-lg border p-2.5 outline-none transition-colors focus:ring-1 focus:ring-indigo-500/50 ' +
				(skipped ? 'border-zinc-800 bg-zinc-900/40 opacity-50' : 'border-zinc-700/30 bg-zinc-800/40')
			}
		>
			<div className='flex items-center justify-between'>
				<span className='font-mono text-[11px] text-zinc-500'>{fmtTime(slot.slotStart)}–{fmtTime(slot.slotEnd)}</span>
				<button onClick={() => onSelect(skipped ? 0 : -1)} className='text-[11px] text-zinc-500 hover:text-zinc-300'>
					{skipped ? 'Include' : 'Skip'}
				</button>
			</div>
			{!skipped && top && (
				<>
					<div className='mt-1 flex items-center justify-between'>
						<span className='flex items-center gap-2'>
							<Check className='h-3.5 w-3.5 text-emerald-400' />
							<span className='text-sm text-zinc-100'>{top.app}</span>
						</span>
						<span className={'rounded-full px-2 py-0.5 text-[10px] font-medium ' + tone.badge}>{top.confidence}%</span>
					</div>
					<div className='mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-700/40'>
						<div className={'h-full rounded-full ' + tone.bar} style={barStyle(top.confidence)} />
					</div>
					<div className='mt-1 text-[10px] text-zinc-500'>{why(top)}</div>
					{slot.predictions.length > 1 && (
						<div className='mt-2 flex flex-wrap gap-1.5'>
							{slot.predictions.map((p, i) =>
								i === active ? null : (
									<button
										key={p.app + ':' + i}
										onClick={() => onSelect(i)}
										className='rounded-md border border-zinc-700/40 bg-zinc-800/60 px-2 py-1 text-[10px] text-zinc-300 hover:border-indigo-500/40 hover:text-zinc-100'
									>
										{p.app} · {p.confidence}%
									</button>
								),
							)}
						</div>
					)}
				</>
			)}
		</div>
	)
}

// ---- small states ----
const shimmer = 'animate-pulse rounded-lg bg-zinc-800/40'
const GapSkeleton = () => (
	<div className='space-y-2'>{[0, 1, 2].map((i) => <div key={i} className={shimmer + ' h-11'} />)}</div>
)
const SlotSkeleton = () => (
	<div className='space-y-2'>{[0, 1].map((i) => <div key={i} className={shimmer + ' h-16'} />)}</div>
)
const AllAccounted = () => (
	<div className='flex flex-col items-center gap-1 py-8 text-zinc-500'>
		<Check className='h-6 w-6 text-emerald-400' />
		<span className='text-sm'>All time accounted for</span>
	</div>
)
const NoData = () => <div className='py-3 text-center text-xs text-zinc-500'>No historical data for this time slot.</div>
function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className='mb-2 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300'>
			<span>{message}</span>
			<button onClick={onRetry} className='underline'>Retry</button>
		</div>
	)
}
```

## 3. Phase 2 — Grid Overlay + Tooltip Fix

### 3.1 Proximity anchoring — `src/lib/tooltipAnchor.ts`

Replaces the broken `rect.right + 12` / `Math.min(right, window.innerWidth - 180)` logic. Tests all four sides, picks the first that fits in preference order (right → left → bottom → top), falls back to the side with the most room, then clamps fully into the viewport with an 8px edge pad. This is what kills the "3 centimeters away" bug: near the right edge it now flips to the **left** of the cell (8px away) instead of being shoved to `innerWidth - 180`.

```tsx
// src/lib/tooltipAnchor.ts
export type Side = 'right' | 'left' | 'top' | 'bottom'
export interface Anchored { x: number; y: number; side: Side }

export interface AnchorRect {
	left: number
	right: number
	top: number
	bottom: number
	width: number
	height: number
}

const MARGIN = 8 // distance from the cell
const PAD = 8 // min distance from viewport edges

export function anchorTooltip(rect: AnchorRect, tipW: number, tipH: number): Anchored {
	const vw = window.innerWidth
	const vh = window.innerHeight
	const space: Record<Side, number> = {
		right: vw - rect.right,
		left: rect.left,
		top: rect.top,
		bottom: vh - rect.bottom,
	}
	const order: Side[] = ['right', 'left', 'bottom', 'top']
	const need = (s: Side) => (s === 'right' || s === 'left' ? tipW + MARGIN : tipH + MARGIN)
	let side: Side = order.find((s) => space[s] >= need(s)) ?? order.reduce((a, b) => (space[a] >= space[b] ? a : b))

	let x: number
	let y: number
	if (side === 'right') {
		x = rect.right + MARGIN
		y = rect.top + rect.height / 2 - tipH / 2
	} else if (side === 'left') {
		x = rect.left - MARGIN - tipW
		y = rect.top + rect.height / 2 - tipH / 2
	} else if (side === 'bottom') {
		x = rect.left + rect.width / 2 - tipW / 2
		y = rect.bottom + MARGIN
	} else {
		x = rect.left + rect.width / 2 - tipW / 2
		y = rect.top - MARGIN - tipH
	}

	x = Math.max(PAD, Math.min(x, vw - tipW - PAD))
	y = Math.max(PAD, Math.min(y, vh - tipH - PAD))
	return { x, y, side }
}
```

### 3.2 Cell mapping — `src/lib/gapMapping.ts`

Maps concrete ISO gaps onto the 7×24 day-of-week heatmap (the grid is day-of-week aggregated, so we bucket by weekday + hour). Returns per-cell untracked seconds for the diagonal-stripe overlay.

```tsx
// src/lib/gapMapping.ts
import type { Gap } from '../types/gaps'

export interface CellKey { day: number; hour: number }
export const cellId = (day: number, hour: number): string => day + ':' + hour

// Grid rows are Mon..Sun (CONTEXT_BUNDLE §6 day labels). JS getDay(): Sun=0.
export const jsDayToRow = (jsDay: number): number => (jsDay === 0 ? 6 : jsDay - 1)

export function isoToCell(iso: string): CellKey {
	const d = new Date(iso)
	return { day: jsDayToRow(d.getDay()), hour: d.getHours() }
}

export interface GapCellCoverage { day: number; hour: number; coveredSeconds: number }

// Split a gap into per-clock-hour chunks so partial hours stripe correctly.
export function gapToCells(gap: Gap): GapCellCoverage[] {
	const out: GapCellCoverage[] = []
	let cursor = new Date(gap.start).getTime()
	const end = new Date(gap.end).getTime()
	let guard = 0
	while (cursor < end && guard < 48) {
		guard += 1
		const d = new Date(cursor)
		const hourStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0).getTime()
		const hourEnd = hourStart + 3600 * 1000
		const chunkEnd = Math.min(end, hourEnd)
		out.push({ day: jsDayToRow(d.getDay()), hour: d.getHours(), coveredSeconds: (chunkEnd - cursor) / 1000 })
		cursor = chunkEnd
	}
	return out
}

// day:hour -> untracked seconds, summed across all gaps.
export function buildGapMap(gaps: Gap[]): Map<string, number> {
	const m = new Map<string, number>()
	for (const g of gaps) {
		for (const c of gapToCells(g)) {
			const k = cellId(c.day, c.hour)
			m.set(k, (m.get(k) ?? 0) + c.coveredSeconds)
		}
	}
	return m
}
```

### 3.3 `InsightsPage.tsx` — tooltip rewrite (replaces lines 527-532 + the tooltip render)

Add imports and state near the top of the component:

```tsx
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { anchorTooltip, type Side } from '../lib/tooltipAnchor'
import { buildGapMap, cellId, isoToCell } from '../lib/gapMapping'
import type { Gap } from '../types/gaps'

const tipVariants = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }
const tipSpring = { type: 'spring', duration: 0.08 }
const tipStyle = (p: { x: number; y: number }) => ({ left: p.x, top: p.y }) as React.CSSProperties
function arrowStyle(side: Side): React.CSSProperties {
	if (side === 'right') return { left: -5, top: '50%', marginTop: -5, borderRight: 'none', borderTop: 'none' }
	if (side === 'left') return { right: -5, top: '50%', marginTop: -5, borderLeft: 'none', borderBottom: 'none' }
	if (side === 'bottom') return { top: -5, left: '50%', marginLeft: -5, borderRight: 'none', borderBottom: 'none' }
	return { bottom: -5, left: '50%', marginLeft: -5, borderLeft: 'none', borderTop: 'none' }
}
```

```tsx
// --- state inside InsightsPage ---
const [tip, setTip] = useState<{ day: number; hour: number; cell: HourCell; rect: DOMRect } | null>(null)
const [tipPos, setTipPos] = useState<{ x: number; y: number; side: Side }>({ x: 0, y: 0, side: 'right' })
const tipRef = useRef<HTMLDivElement | null>(null)

// Measure the rendered tooltip, then anchor it to the hovered cell.
useLayoutEffect(() => {
	if (!tip || !tipRef.current) return
	const t = tipRef.current.getBoundingClientRect()
	setTipPos(anchorTooltip(tip.rect, t.width, t.height))
}, [tip])
```

Replace the old `onMouseEnter` handler (527-532) on each cell with rect capture, and add `onMouseLeave`:

```tsx
onMouseEnter={(e) => setTip({ day: dayIdx, hour: hourIdx, cell, rect: e.currentTarget.getBoundingClientRect() })}
onMouseLeave={() => setTip(null)}
```

New tooltip render (replaces the old fixed/right-only tooltip). It is `fixed` (constraint satisfied), `pointer-events-none`, with a 6px rotated-square arrow colored `border-zinc-700`:

```tsx
{tip && (
	<motion.div
		ref={tipRef}
		variants={tipVariants}
		initial='hidden'
		animate='visible'
		transition={tipSpring}
		style={tipStyle(tipPos)}
		className='pointer-events-none fixed z-50 min-w-[160px] rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl'
	>
		<div className='absolute h-2.5 w-2.5 rotate-45 border border-zinc-700 bg-zinc-900' style={arrowStyle(tipPos.side)} />
		<TooltipBody cell={tip.cell} hour={tip.hour} gapSeconds={gapMap.get(cellId(tip.day, tip.hour)) ?? 0} />
	</motion.div>
)}
```

```tsx
function TooltipBody({ cell, hour, gapSeconds }: { cell: HourCell; hour: number; gapSeconds: number }) {
	const tracked = Math.round(cell.totalSeconds / 60)
	const pct = Math.round((cell.totalSeconds / 3600) * 100)
	const pad = (n: number) => String(n).padStart(2, '0')
	const range = pad(hour) + ':00–' + pad((hour + 1) % 24) + ':00'
	const dotStyle = (color: string) => ({ backgroundColor: color }) as React.CSSProperties
	return (
		<div className='space-y-1.5'>
			<div className='text-xs font-medium text-zinc-100'>{range}</div>
			<div className='text-[11px] text-zinc-400'>{tracked}m / 60m tracked ({pct}%)</div>
			{gapSeconds > 0 && <div className='text-[11px] text-amber-300'>{Math.round(gapSeconds / 60)}m untracked</div>}
			<div className='space-y-1'>
				{cell.activities.slice(0, 4).map((a) => (
					<div key={a.activity} className='flex items-center gap-1.5'>
						<span className='h-2 w-2 rounded-full' style={dotStyle(a.color)} />
						<span className='text-[11px] text-zinc-300'>{a.activity}</span>
						<span className='ml-auto text-[10px] text-zinc-500'>{Math.round(a.seconds / 60)}m</span>
					</div>
				))}
			</div>
			{(cell.hasExternal || cell.hasDevice) && (
				<div className='flex gap-1 pt-0.5'>
					{cell.hasDevice && <span className='rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] text-indigo-300'>device</span>}
					{cell.hasExternal && <span className='rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300'>external</span>}
				</div>
			)}
		</div>
	)
}
```

### 3.4 `InsightsPage.tsx` — cell fill + diagonal-stripe overlay

Hoist these consts and compute per-cell fill/untracked. The cell keeps full opacity; a colored inner layer carries the `totalSeconds/3600` opacity, and the stripe sits on top at full strength so it stays visible even on near-empty hours.

```tsx
const stripeStyle: React.CSSProperties = {
	backgroundImage:
		'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.03) 3px, transparent 6px)',
}
const fillStyle = (color: string, fill: number): React.CSSProperties => ({ backgroundColor: color, opacity: fill })
```

```tsx
// inside the day/hour map, per cell:
const color = cell.activities[0]?.color ?? '#52525b'
const fill = Math.min(1, cell.totalSeconds / 3600)
const untrackedSec = gapMap.get(cellId(dayIdx, hourIdx)) ?? 0

return (
	<div
		key={hourIdx}
		className='relative aspect-square flex-1 cursor-pointer overflow-hidden rounded-[3px] bg-zinc-800/40'
		onMouseEnter={(e) => setTip({ day: dayIdx, hour: hourIdx, cell, rect: e.currentTarget.getBoundingClientRect() })}
		onMouseLeave={() => setTip(null)}
		onClick={() => {
			if (untrackedSec <= 0) return
			const start = cellGapStart(dayIdx, hourIdx)
			openDrawer(start)
		}}
	>
		<div className='absolute inset-0' style={fillStyle(color, fill)} />
		{untrackedSec > 0 && <div className='pointer-events-none absolute inset-0' style={stripeStyle} />}
	</div>
)
```

<aside>
ℹ️

The `flex-1` / `gap-[2px]` / `aspect-square` / `overflow-x-auto` layout from CONTEXT_BUNDLE §6 is untouched — the overlay layers are absolutely positioned **inside** each existing cell, so the grid geometry can't break.

</aside>

## 4. Phase 3 — Batch Day Prediction

"Fill entire day" calls `predictDayGaps(date, mode)` and presents results grouped by gap interval, with a single accept that writes every group's top prediction. Add this component to `GapFillDrawer.tsx`:

```tsx
// add to GapFillDrawer.tsx
interface BatchProps {
	mode: GapMode
	predictDay: (date: string, mode: GapMode) => Promise<DayGapGroup[]>
	confirm: (fills: ConfirmFill[]) => Promise<boolean>
	onFilled: () => void
}

function BatchDayButton({ mode, predictDay, confirm, onFilled }: BatchProps) {
	const [open, setOpen] = useState(false)
	const [groups, setGroups] = useState<DayGapGroup[]>([])
	const [loading, setLoading] = useState(false)
	const today = new Date().toISOString().slice(0, 10)

	const run = async () => {
		setLoading(true)
		const g = await predictDay(today, mode)
		setGroups(g)
		setOpen(true)
		setLoading(false)
	}

	const acceptAll = async () => {
		const fills: ConfirmFill[] = []
		for (const grp of groups)
			for (const slot of grp.slots) {
				const p = slot.predictions[0]
				if (p) fills.push({ slotStart: slot.slotStart, slotEnd: slot.slotEnd, app: p.app, category: p.category })
			}
		if (await confirm(fills)) {
			onFilled()
			setOpen(false)
			setGroups([])
		}
	}

	return (
		<div className='mt-3 border-t border-zinc-800/60 pt-3'>
			<button
				onClick={run}
				disabled={loading}
				className='w-full rounded-lg border border-zinc-700/40 bg-zinc-800/40 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50'
			>
				{loading ? 'Predicting…' : 'Fill entire day'}
			</button>
			{open && groups.length === 0 && <div className='mt-2 text-center text-xs text-zinc-500'>No gaps to fill today.</div>}
			{open && groups.map((grp) => {
				const slotCount = grp.slots.length
				const totalMin = Math.round(grp.durationSeconds / 60)
				return (
					<div key={grp.gapStart} className='mt-2 rounded-lg border border-zinc-700/20 bg-zinc-800/30 p-2.5'>
						<div className='flex items-center justify-between'>
							<span className='font-mono text-[11px] text-zinc-400'>{fmtTime(grp.gapStart)}–{fmtTime(grp.gapEnd)}</span>
							<span className='text-[10px] text-zinc-500'>{slotCount} slot{slotCount === 1 ? '' : 's'} · {totalMin}m</span>
						</div>
						<div className='mt-1 flex flex-wrap gap-1'>
							{grp.slots.slice(0, 6).map((s) => {
								const p = s.predictions[0]
								if (!p) return null
								return (
									<span key={s.slotStart} className={'rounded px-1.5 py-0.5 text-[10px] ' + confidenceTone(p.confidence).badge}>
										{p.app}
									</span>
								)
							})}
						</div>
					</div>
				)
			})}
			{open && groups.length > 0 && (
				<button onClick={acceptAll} className='mt-2 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500'>
					Accept all day predictions
				</button>
			)}
		</div>
	)
}
```

Groups are rendered by gap interval (`gapStart`–`gapEnd`), each previewing its slots' top apps as confidence-colored chips; one button writes every group's top prediction via `confirmGapFill`. Per-slot review for a batch reuses the same `SlotRow` if you want finer control — wire each group through `GapRow` instead of the compact preview.

## 5. Data Adaptations

### 5.1 `GapBanner.tsx` — pure trigger

```tsx
// src/components/GapBanner.tsx
import { Sparkles } from 'lucide-react'

interface GapBannerProps {
	count: number
	onOpen: () => void
}

export function GapBanner({ count, onOpen }: GapBannerProps) {
	if (count <= 0) return null
	return (
		<button
			onClick={onOpen}
			className='flex items-center gap-2 rounded-full border border-zinc-700/50 bg-zinc-800/40 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800'
		>
			<Sparkles className='h-3.5 w-3.5 text-indigo-300' />
			{count} gap{count === 1 ? '' : 's'} found · Smart Fill
		</button>
	)
}
```

### 5.2 `InsightsPage.tsx` — gap state, overlay map, drawer mount

Add this state + memo near the existing `getTypicalDay` loader, and **add `refreshKey` to the dependency array of the existing `getTypicalDay` effect** so the heatmap re-renders after a fill:

```tsx
const [gapList, setGapList] = useState<Gap[]>([])
const [drawerOpen, setDrawerOpen] = useState(false)
const [focusGap, setFocusGap] = useState<string | undefined>(undefined)
const [refreshKey, setRefreshKey] = useState(0)

// gaps power both the banner count and the heatmap stripe overlay
useEffect(() => {
	let alive = true
	const dapi = (window as unknown as {
		deskflowAPI: { detectUsageGaps: (o?: { period?: string; minGapMinutes?: number }) => Promise<Gap[]> }
	}).deskflowAPI
	dapi.detectUsageGaps({ period, minGapMinutes: 15 }).then((g) => {
		if (alive) setGapList(Array.isArray(g) ? g : [])
	})
	return () => { alive = false }
}, [period, refreshKey])

const gapMap = useMemo(() => buildGapMap(gapList), [gapList])
const cellGapStart = useCallback(
	(day: number, hour: number): string | undefined => {
		const g = gapList.find((x) => {
			const c = isoToCell(x.start)
			return c.day === day && c.hour === hour
		})
		return g?.start
	},
	[gapList],
)
const openDrawer = useCallback((start?: string) => {
	setFocusGap(start)
	setDrawerOpen(true)
}, [])
```

Make the Typical Day section wrapper `relative` (so the drawer anchors to it, not the whole page), add the banner to its header, and mount the drawer at the end of the section:

```tsx
<section className='relative ...'> {/* existing Typical Day wrapper — add `relative` */}
	<div className='mb-2 flex items-center justify-between'>
		<h3 className='...'>Typical Day</h3>
		<GapBanner count={gapList.length} onOpen={() => openDrawer(undefined)} />
	</div>

	{/* ...existing overflow-x-auto / flex grid (now with fill+stripe cells from §3.4)... */}

	<GapFillDrawer
		open={drawerOpen}
		period={period}
		focusGapStart={focusGap}
		onClose={() => setDrawerOpen(false)}
		onFilled={() => setRefreshKey((k) => k + 1)}
	/>
</section>
```

<aside>
⚠️

**Identifier match:** the §3.4 cell snippet assumes the existing grid map exposes `cell`, `dayIdx`, `hourIdx`. If the current `InsightsPage` map uses different names (e.g. `d`, `h`, `hourData`), rename the snippet's references to match — don't rename the existing loop variables. The drawer requires `period` to be in scope (it already is, since the heatmap uses it).

</aside>

### 5.3 `App.tsx` — remove the old bridge

- Delete `import GapPanel from './components/GapPanel'` and any `<GapPanel … />` render.
- Remove the `window.addEventListener('fill-time-gap', …)` listener and its handler. The drawer writes directly through `confirmGapFill`, so the CustomEvent bridge is dead code.
- If `GapBanner` was rendered from `App.tsx`, remove it there — it now lives inside the Typical Day section in `InsightsPage.tsx` where it can call `openDrawer`.
- Delete the files `src/components/GapPanel.tsx` and `src/components/GapPredictorPanel.tsx`.

### 5.4 Success toast

On `onFilled`, surface a transient confirmation. If a toast util already exists (search `toast(` / `useToast`), call it with `Filled <n> slots`. Otherwise add a 2s auto-dismiss toast in `InsightsPage`:

```tsx
const [toast, setToast] = useState<string | null>(null)
useEffect(() => {
	if (!toast) return
	const t = setTimeout(() => setToast(null), 2000)
	return () => clearTimeout(t)
}, [toast])
// onFilled: setRefreshKey((k) => k + 1); setToast('Gaps filled')
// render: {toast && <div className='fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white shadow-lg'>{toast}</div>}
```

## 6. Data Flow (after this change)

```
getTypicalDay ─► grid (HourCell[7][24]) ─► cells: fill opacity = totalSeconds/3600
detectUsageGaps ─► Gap[] ─┬─► buildGapMap ─► stripe overlay on day:hour cells
                          └─► GapBanner count + drawer list
                                          │ expand gap
                                          ▼
                          predictGapFill(start,end,mode) ─► PredictedGap.slots[]
                                          │ select / swap / skip
                                          ▼
                          confirmGapFill(fills) ─► logs table ─► refreshKey++ ─► grid + gaps reload

"Fill entire day" ─► predictDayGaps(date,mode) ─► DayGapGroup[] ─► confirmGapFill(top picks)

hover cell ─► setTip({rect}) ─► useLayoutEffect measures tip ─► anchorTooltip (4-side + clamp) ─► fixed tooltip + arrow
```

## 7. Verification Steps

### Build (must pass)

```bash
node scripts/build.mjs
npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs
```

### Manual tests in the Electron app

| # | Action | Pass criteria |
| --- | --- | --- |
| 1 | Hover a cell in the **far-right column** of Typical Day | Tooltip appears ~8px to the **left** of the cell (not shoved to the screen edge), fully on-screen, arrow points at the cell. Bug gone. |
| 2 | Hover cells in each corner (TL/TR/BL/BR) | Tooltip flips side as needed, never clipped, arrow always points to the cell |
| 3 | Hover a partially-tracked hour | Shows `42m / 60m tracked (70%)`  • range `10:00–11:00`; cell opacity reflects fill |
| 4 | Look at a known-gap hour | Diagonal stripes visible; tooltip shows `Nm untracked` in amber |
| 5 | Click a striped cell | Drawer slides up from the section bottom, auto-expanded to that gap |
| 6 | Click the GapBanner pill | Drawer opens listing ALL gaps for the period |
| 7 | First-ever open | "How should I guess your gaps?" prompt appears; choice persists in localStorage; toggle still switches later |
| 8 | Expand a gap | 15-min slots load (skeleton → results); each shows app name (not just category), confidence badge + bar (green/amber/gray), and `daysUsed/30 · avg Nm` microcopy |
| 9 | Click a 2nd/3rd alternative | Top prediction swaps to the chosen app |
| 10 | Click "Skip" on a slot / press Space | Slot dims and is excluded; "Accept all" count decrements |
| 11 | Accept all for a gap | `confirmGapFill` writes logs; gap leaves the list; grid cells lose stripes after reload; toast shows |
| 12 | "Fill entire day" | Groups by interval with app chips; "Accept all day predictions" writes every top pick |
| 13 | Switch mode combined↔separate, re-expand | Predictions differ (combined includes external sessions); cache keys by mode so no stale data |
| 14 | No gaps in period | "All time accounted for" with checkmark |
| 15 | Gap with no history | "No historical data for this time slot." |
| 16 | Press Esc / click outside grid | Drawer closes; grid stays fully interactive while drawer is collapsed (no modal backdrop blocking) |
| 17 | Resize window narrow, scroll the grid horizontally | Tooltip still anchors correctly (fixed positioning); grid `overflow-x-auto` intact |

### Regression guards

<aside>
🛡️

- Grid layout (`overflow-x-auto`, `flex-1`, `gap-[2px]`, `aspect-square`) unchanged — overlays are absolute children inside each cell.
- All `localStorage` access is in try/catch (`loadMode`/`saveMode`/`modeChosen`).
- No new routes or sidebar items — drawer lives inside the Insights Typical Day section.
- Tooltip remains `fixed` (works inside the scroll container).
- CRLF: ensure your editor writes CRLF for all new/edited files (`git config core.autocrlf` or editor setting) to match the repo.
- `git grep -n "fill-time-gap"` returns nothing after the App.tsx cleanup; `git grep -n "GapPanel\|GapPredictorPanel"` returns nothing.
</aside>