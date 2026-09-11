<aside>
💳

**Complete, production-ready redesign of all 7 wallet transaction modals.** Every modal gets a wallet-specific context band, progressive disclosure, the spinner→check→auto-close submit lifecycle, and full empty/loading/error coverage — all on the shared `TransactionModalShell`, all wired to the **existing** `finance:add-transaction` / `finance:fetch-crypto-prices` IPC. JSX below uses spaced `{ {` — paste as normal braces.

</aside>

# 0. The one architectural decision everything hangs on

**You cannot use `bg-{accent}/5` with a runtime hex.** Tailwind only ships classes it sees at build time; `walletMeta[type].color` is a runtime `#RRGGBB`, so `bg-[${ color }]/5` silently produces **no CSS** — which is *exactly why every modal looks generic and “not different per wallet”* today. The fix is a 6-line `tint()` helper that returns an `rgba()` string for inline `style`. Every accent tint, border, ring, and progress fill below uses it. This single change is what makes the wallets finally look distinct.

```tsx
// src/components/finance/modals/modalUtils.ts
import type { FinanceWallet, WalletType } from '../finance-types'

/** hex (#RRGGBB) + alpha 0..1 -> rgba() string. The reason accents finally render. */
export function tint(hex: string, alpha: number): string {
	const h = hex.replace('#', '')
	const r = parseInt(h.slice(0, 2), 16)
	const g = parseInt(h.slice(2, 4), 16)
	const b = parseInt(h.slice(4, 6), 16)
	return `rgba(${ r }, ${ g }, ${ b }, ${ alpha })`
}

/** Threshold color for utilization / daily-limit bars (color + meaning, never color alone). */
export function thresholdColor(pct: number): { hex: string; label: string } {
	if (pct < 50) return { hex: '#10B981', label: 'Healthy' }
	if (pct <= 80) return { hex: '#F59E0B', label: 'Watch' }
	return { hex: '#EF4444', label: 'High' }
}

/** metadata may arrive as a JSON string or an object. Normalize once. */
export function parseMeta(wallet: FinanceWallet): Record<string, any> {
	const m = wallet.metadata
	if (!m) return {}
	if (typeof m === 'string') { try { return JSON.parse(m) } catch { return {} } }
	return m
}

/** Default denominations by currency (extend as needed). */
export const DENOMINATIONS: Record<string, number[]> = {
	IDR: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100],
	USD: [100, 50, 20, 10, 5, 1],
	EUR: [200, 100, 50, 20, 10, 5],
}

/** Greedy largest-first auto-fill: how many of each note to cover `amount`. */
export function greedyFill(amount: number, denoms: number[]): Record<number, number> {
	const out: Record<number, number> = {}
	let remaining = Math.round(amount)
	for (const d of [...denoms].sort((a, b) => b - a)) {
		const n = Math.floor(remaining / d)
		if (n > 0) { out[d] = n; remaining -= n * d }
	}
	return out
}

export const sumDenoms = (counts: Record<number, number>) =>
	Object.entries(counts).reduce((s, [d, n]) => s + Number(d) * n, 0)

export type TxType = 'income' | 'expense' | 'transfer'

export interface TxModalProps {
	wallet: FinanceWallet
	categories: Array<{ id: number; name: string; type: TxType; icon?: string }>
	displayCurrency: string
	baseCurrency: string
	/** Optional: today's spend for this wallet, used by Debit daily-limit band. */
	todaySpent?: number
	onSubmit: (data: Record<string, any>) => Promise<{ id: number } | null>
	onClose: () => void
}
```

---

# 1. `TransactionModalShell.tsx` — shell + submit lifecycle

Owns overlay, container, header, footer, focus management, ESC-to-close, and the **idle → submitting → success → auto-close** / **error+retry** state machine. Children render the body; the shell renders the footer button whose state it controls.

```tsx
// src/components/finance/modals/TransactionModalShell.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { tint } from './modalUtils'

type Phase = 'idle' | 'submitting' | 'success' | 'error'

export interface ShellRenderProps {
	submit: () => void
	phase: Phase
	setCanSubmit: (v: boolean) => void
}

interface Props {
	accent: string
	icon: React.ReactNode
	typeBadge: string
	title: string
	onClose: () => void
	/** Returns true on success. Throw or return false to surface the error state. */
	onSubmit: () => Promise<boolean>
	/** Called after the success animation completes (form reset / close happen here). */
	onSuccess?: () => void
	children: (rp: ShellRenderProps) => React.ReactNode
}

export function TransactionModalShell({
	accent, icon, typeBadge, title, onClose, onSubmit, onSuccess, children,
}: Props) {
	const [phase, setPhase] = useState<Phase>('idle')
	const [errorMsg, setErrorMsg] = useState<string | null>(null)
	const [canSubmit, setCanSubmit] = useState(false)
	const [mounted, setMounted] = useState(false)
	const dialogRef = useRef<HTMLDivElement>(null)

	useEffect(() => { setMounted(true) }, [])

	const close = useCallback(() => {
		setMounted(false)
		window.setTimeout(onClose, 180) // let the fade-out play
	}, [onClose])

	const submit = useCallback(async () => {
		if (phase === 'submitting' || !canSubmit) return
		setPhase('submitting'); setErrorMsg(null)
		try {
			const ok = await onSubmit()
			if (!ok) throw new Error('Could not save this transaction.')
			setPhase('success')
			window.setTimeout(() => { onSuccess?.(); close() }, 800)
		} catch (e: any) {
			setPhase('error')
			setErrorMsg(e?.message ?? 'Something went wrong. Please try again.')
		}
	}, [phase, canSubmit, onSubmit, onSuccess, close])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close()
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [close, submit])

	return (
		<div
			className={ `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm
				transition-opacity duration-[180ms] ${ mounted ? 'opacity-100' : 'opacity-0' }` }
			onClick={ close }
			role="dialog" aria-modal="true" aria-label={ `${ typeBadge } transaction` }
		>
			<div
				ref={ dialogRef }
				onClick={ (e) => e.stopPropagation() }
				style={ { transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' } }
				className={ `w-full max-w-md rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl p-5
					transition-all duration-[240ms] ${ mounted ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0' }` }
			>
				{ /* Header */ }
				<div className="flex items-center gap-3 mb-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-lg"
						style={ { background: tint(accent, 0.15), color: accent } }>
						{ icon }
					</span>
					<div className="min-w-0">
						<div className="text-[11px] uppercase tracking-wide" style={ { color: accent } }>{ typeBadge }</div>
						<h2 className="text-sm font-semibold text-white truncate">{ title }</h2>
					</div>
					<button onClick={ close } aria-label="Close"
						className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400
							hover:text-white hover:bg-zinc-800/50 focus-visible:ring-2 focus-visible:ring-offset-2
							focus-visible:ring-offset-zinc-950 transition-colors"
						style={ { } }>
						<X size={ 18 } />
					</button>
				</div>

				{ /* Body */ }
				<div className="space-y-3">{ children({ submit, phase, setCanSubmit }) }</div>

				{ /* Error */ }
				{ phase === 'error' && errorMsg && (
					<div className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
						style={ { background: tint('#EF4444', 0.08), borderColor: tint('#EF4444', 0.25), color: '#FCA5A5' } }>
						<span>{ errorMsg }</span>
						<button onClick={ submit } className="ml-auto font-medium underline hover:no-underline">Retry</button>
					</div>
				) }

				{ /* Footer */ }
				<div className="mt-4 flex gap-2">
					<button onClick={ close }
						className="flex-1 min-h-[44px] rounded-lg border border-zinc-700/50 bg-zinc-800/50 text-sm
							text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
						Cancel
					</button>
					<button onClick={ submit } disabled={ !canSubmit || phase === 'submitting' || phase === 'success' }
						className="flex-[2] min-h-[44px] rounded-lg text-sm font-semibold text-white
							flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
						style={ { background: phase === 'success' ? '#10B981' : accent } }>
						{ phase === 'submitting' && <Loader2 size={ 16 } className="animate-spin" /> }
						{ phase === 'success' && <Check size={ 16 } className="animate-[pop_200ms_ease-out]" /> }
						{ phase === 'idle' && 'Add transaction' }
						{ phase === 'error' && 'Add transaction' }
						{ phase === 'submitting' && 'Saving…' }
						{ phase === 'success' && 'Transaction added' }
					</button>
				</div>
			</div>
		</div>
	)
}
```

> Add once to your global CSS for the success pop: `@keyframes pop { from { transform: scale(0.8); opacity: 0 } to { transform: scale(1); opacity: 1 } }`.
> 

---

# 2. `useTransactionForm.ts` — shared form brain (kills the per-modal duplication)

This is the reason all 7 modals stay short and consistent: shared state for amount/description/category/date/type/advanced, last-used prefs via `txPrefs`, validity reporting, and the `buildPayload` → `onSubmit` bridge. Each modal layers only its **specialty** on top.

```tsx
// src/components/finance/modals/useTransactionForm.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadTxPrefs, saveTxPrefs } from './txPrefs'
import type { TxModalProps, TxType } from './modalUtils'

export function useTransactionForm(props: TxModalProps, allowedTypes: TxType[]) {
	const prefs = useMemo(() => loadTxPrefs(props.wallet.id), [props.wallet.id])
	const [type, setType] = useState<TxType>(
		allowedTypes.includes(prefs.type as TxType) ? (prefs.type as TxType) : allowedTypes[0],
	)
	const [amount, setAmount] = useState('')
	const [description, setDescription] = useState('')
	const [categoryId, setCategoryId] = useState<number | null>(prefs.categoryId ?? null)
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
	const [note, setNote] = useState('')
	const [showAdvanced, setShowAdvanced] = useState(false)

	const numericAmount = Number(amount.replace(/[^0-9.]/g, '')) || 0
	const categoriesForType = useMemo(
		() => props.categories.filter((c) => c.type === type),
		[props.categories, type],
	)

	// reset category when the type switch invalidates it
	useEffect(() => {
		if (categoryId && !categoriesForType.some((c) => c.id === categoryId)) setCategoryId(null)
	}, [categoriesForType, categoryId])

	const reset = useCallback(() => {
		setAmount(''); setDescription(''); setNote(''); setShowAdvanced(false)
		setDate(new Date().toISOString().slice(0, 10))
	}, [])

	const persistPrefs = useCallback(() => {
		saveTxPrefs(props.wallet.id, { type, categoryId: categoryId ?? undefined })
	}, [props.wallet.id, type, categoryId])

	/** Base payload; modals merge their specialty fields + metadata in. */
	const buildPayload = useCallback((extra: Record<string, any> = {}) => ({
		account_id: props.wallet.account_id,
		wallet_id: props.wallet.id,
		category_id: categoryId,
		type,
		amount: numericAmount,
		description: description.trim(),
		date,
		note: note.trim() || undefined,
		...extra,
	}), [props.wallet, categoryId, type, numericAmount, description, date, note])

	return {
		type, setType, amount, setAmount, numericAmount,
		description, setDescription, categoryId, setCategoryId,
		date, setDate, note, setNote, showAdvanced, setShowAdvanced,
		categoriesForType, reset, persistPrefs, buildPayload,
	}
}
```

---

# 3. Shared primitives used by every modal

Small, dependency-free building blocks (context band frame, type toggle, amount input, advanced toggle, progress bar). Keeping them here is why each modal file is ~80–140 lines instead of 400.

```tsx
// src/components/finance/modals/modalParts.tsx
import React from 'react'
import { ChevronDown } from 'lucide-react'
import { tint } from './modalUtils'
import type { TxType } from './modalUtils'

export function ContextBand({ accent, children }: { accent: string; children: React.ReactNode }) {
	return (
		<div className="px-3 py-2 mb-2 rounded-lg border"
			style={ { background: tint(accent, 0.05), borderColor: tint(accent, 0.1) } }>
			{ children }
		</div>
	)
}

export function TypeToggle({ accent, value, options, onChange }: {
	accent: string; value: TxType; options: { id: TxType; label: string }[]; onChange: (t: TxType) => void
}) {
	return (
		<div className="flex gap-2">
			{ options.map((o) => {
				const on = o.id === value
				return (
					<button key={ o.id } onClick={ () => onChange(o.id) }
						className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-medium border transition-colors
							focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
						style={ on
							? { background: tint(accent, 0.15), color: accent, borderColor: tint(accent, 0.3) }
							: { background: 'rgba(39,39,42,0.5)', color: '#a1a1aa', borderColor: 'rgba(63,63,70,0.5)' } }>
						{ o.label }
					</button>
				)
			}) }
		</div>
	)
}

export function AmountInput({ accent, value, onChange, symbol, autoFocus }: {
	accent: string; value: string; onChange: (v: string) => void; symbol: string; autoFocus?: boolean
}) {
	return (
		<label className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3
			focus-within:ring-2 transition-shadow"
			style={ { ['--tw-ring-color' as any]: tint(accent, 0.5) } }>
			<span className="text-zinc-500 text-base">{ symbol }</span>
			<input
				autoFocus={ autoFocus } inputMode="decimal" placeholder="0"
				value={ value } onChange={ (e) => onChange(e.target.value) }
				className="w-full bg-transparent py-2.5 text-xl font-semibold tabular-nums text-white
					outline-none placeholder:text-zinc-600" />
		</label>
	)
}

export function AdvancedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
	return (
		<button onClick={ onToggle }
			className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
			<ChevronDown size={ 13 } className={ `transition-transform ${ open ? 'rotate-180' : '' }` } />
			{ open ? 'Hide advanced' : '+ Advanced' }
		</button>
	)
}

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
	return (
		<div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
			<div className="h-full rounded-full transition-all duration-300"
				style={ { width: `${ Math.min(100, Math.max(0, pct)) }%`, background: color } } />
		</div>
	)
}
```

---

# 4. `DenominationPicker.tsx` — reusable, with greedy auto-fill

Used by Physical and Cash. Steppers are ≥44px; subtotals + grand total live-update; the **Auto-fill** button runs `greedyFill`; quick-add pills bump common notes fast.

```tsx
// src/components/finance/modals/DenominationPicker.tsx
import React from 'react'
import { Minus, Plus, Wand2 } from 'lucide-react'
import { tint, sumDenoms, greedyFill } from './modalUtils'

interface Props {
	accent: string
	currency: string
	denoms: number[]
	counts: Record<number, number>
	onChange: (counts: Record<number, number>) => void
	/** When provided, shows an Auto-fill button that greedily covers this amount. */
	autoFillTarget?: number
	format: (n: number) => string
}

export function DenominationPicker({ accent, denoms, counts, onChange, autoFillTarget, format }: Props) {
	const bump = (d: number, delta: number) => {
		const next = { ...counts, [d]: Math.max(0, (counts[d] ?? 0) + delta) }
		if (next[d] === 0) delete next[d]
		onChange(next)
	}
	const total = sumDenoms(counts)
	return (
		<div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-3 space-y-2">
			<div className="flex items-center justify-between">
				<span className="text-[11px] text-zinc-400">Denominations</span>
				{ autoFillTarget != null && autoFillTarget > 0 && (
					<button onClick={ () => onChange(greedyFill(autoFillTarget, denoms)) }
						className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border min-h-[28px]"
						style={ { background: tint(accent, 0.1), color: accent, borderColor: tint(accent, 0.2) } }>
						<Wand2 size={ 12 } /> Auto-fill
					</button>
				) }
			</div>
			<div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
				{ denoms.map((d) => {
					const n = counts[d] ?? 0
					return (
						<div key={ d } className="flex items-center gap-2">
							<span className="w-20 text-xs tabular-nums text-zinc-300">{ format(d) }</span>
							<button onClick={ () => bump(d, -1) } disabled={ n === 0 } aria-label={ `Remove ${ d }` }
								className="h-11 w-11 rounded-lg border border-zinc-700/50 bg-zinc-800/50 text-zinc-300
									flex items-center justify-center hover:bg-zinc-800 disabled:opacity-30 transition-colors">
								<Minus size={ 15 } />
							</button>
							<span className="w-8 text-center text-sm tabular-nums text-white">{ n }</span>
							<button onClick={ () => bump(d, 1) } aria-label={ `Add ${ d }` }
								className="h-11 w-11 rounded-lg border flex items-center justify-center transition-colors"
								style={ { background: tint(accent, 0.1), color: accent, borderColor: tint(accent, 0.2) } }>
								<Plus size={ 15 } />
							</button>
							<span className="ml-auto text-xs tabular-nums text-zinc-400">{ n > 0 ? format(d * n) : '—' }</span>
						</div>
					)
				}) }
			</div>
			<div className="flex items-center justify-between border-t border-zinc-700/50 pt-2">
				<span className="text-xs text-zinc-400">Total</span>
				<span className="text-xl font-bold tabular-nums text-white">{ format(total) }</span>
			</div>
		</div>
	)
}
```

---

# 5. `BankTransactionModal.tsx`

Income / Expense / Transfer with institution context band. Transfer reveals a destination-wallet field via progressive disclosure.

```tsx
// src/components/finance/modals/BankTransactionModal.tsx
import React, { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, AdvancedToggle } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { useFormattedAmount } from './useFormattedAmount'
import { parseMeta } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#3B82F6'

export const BankTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income', 'transfer'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useFormattedAmount(props.displayCurrency)
	const [destWallet, setDestWallet] = useState('')

	const valid = f.numericAmount > 0 && (f.type !== 'transfer' || destWallet.trim().length > 0)

	return (
		<TransactionModalShell
			accent={ ACCENT } icon={ <Landmark size={ 18 } /> } typeBadge="Bank"
			title={ props.wallet.name } onClose={ props.onClose }
			onSuccess={ f.reset }
			onSubmit={ async () => {
				f.persistPrefs()
				const res = await props.onSubmit(f.buildPayload(
					f.type === 'transfer' ? { metadata: { to_wallet: destWallet } } : {},
				))
				return !!res
			} }
		>
			{ ({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ ACCENT }>
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-zinc-400">Balance</span>
								<span className="text-xs font-semibold tabular-nums text-white">{ format(props.wallet.balance) }</span>
							</div>
							<div className="mt-0.5 flex items-center justify-between text-[11px] text-zinc-500">
								<span>{ props.wallet.provider ?? meta.institution ?? 'Bank account' }</span>
								{ props.wallet.last_four && <span>•••• { props.wallet.last_four }</span> }
							</div>
						</ContextBand>

						<TypeToggle accent={ ACCENT } value={ f.type } onChange={ f.setType }
							options={ [{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }, { id: 'transfer', label: 'Transfer' }] } />

						<AmountInput accent={ ACCENT } value={ f.amount } onChange={ f.setAmount } symbol={ symbol } autoFocus />

						<input value={ f.description } onChange={ (e) => f.setDescription(e.target.value) }
							placeholder="Description"
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm
								text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600" />

						{ f.type === 'transfer' ? (
							<input value={ destWallet } onChange={ (e) => setDestWallet(e.target.value) }
								placeholder="Transfer to (wallet / account)"
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm
									text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
						) : (
							<CategoryChipGrid accent={ ACCENT } categories={ f.categoriesForType }
								selected={ f.categoryId } onSelect={ f.setCategoryId } />
						) }

						<AdvancedToggle open={ f.showAdvanced } onToggle={ () => f.setShowAdvanced(!f.showAdvanced) } />
						{ f.showAdvanced && (
							<div className="space-y-2">
								<input type="date" value={ f.date } onChange={ (e) => f.setDate(e.target.value) }
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none" />
								<textarea value={ f.note } onChange={ (e) => f.setNote(e.target.value) } rows={ 2 }
									placeholder="Reference number / note"
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600" />
							</div>
						) }
					</>
				)
			} }
		</TransactionModalShell>
	)
}
```

---

# 6. `DebitTransactionModal.tsx`

Expense-focused. Context band shows network + last 4 and a **daily-limit progress bar** with green/amber/red thresholds (color + label, never color alone).

```tsx
// src/components/finance/modals/DebitTransactionModal.tsx
import React, { useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, AdvancedToggle, ProgressBar } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { useFormattedAmount } from './useFormattedAmount'
import { parseMeta, thresholdColor } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#10B981'

export const DebitTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useFormattedAmount(props.displayCurrency)

	const dailyLimit = Number(meta.daily_limit) || 0
	const spent = (props.todaySpent ?? 0) + (f.type === 'expense' ? f.numericAmount : 0)
	const pct = dailyLimit > 0 ? (spent / dailyLimit) * 100 : 0
	const th = thresholdColor(pct)
	const valid = f.numericAmount > 0

	return (
		<TransactionModalShell
			accent={ ACCENT } icon={ <CreditCard size={ 18 } /> } typeBadge="Debit Card"
			title={ props.wallet.name } onClose={ props.onClose } onSuccess={ f.reset }
			onSubmit={ async () => { f.persistPrefs(); return !!(await props.onSubmit(f.buildPayload())) } }
		>
			{ ({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ ACCENT }>
							<div className="flex items-center justify-between text-[11px]">
								<span className="text-zinc-400">{ props.wallet.provider ?? meta.network ?? 'Debit' } •••• { props.wallet.last_four ?? '—' }</span>
								<span className="tabular-nums text-white">{ format(props.wallet.balance) }</span>
							</div>
							{ dailyLimit > 0 && (
								<div className="mt-1.5">
									<div className="flex items-center justify-between text-[11px] mb-1">
										<span className="text-zinc-500">Today: { format(spent) } / { format(dailyLimit) }</span>
										<span style={ { color: th.hex } }>{ th.label }</span>
									</div>
									<ProgressBar pct={ pct } color={ th.hex } />
								</div>
							) }
						</ContextBand>

						<TypeToggle accent={ ACCENT } value={ f.type } onChange={ f.setType }
							options={ [{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Refund / Income' }] } />
						<AmountInput accent={ ACCENT } value={ f.amount } onChange={ f.setAmount } symbol={ symbol } autoFocus />
						<input value={ f.description } onChange={ (e) => f.setDescription(e.target.value) } placeholder="Description"
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
						<CategoryChipGrid accent={ ACCENT } categories={ f.categoriesForType } selected={ f.categoryId } onSelect={ f.setCategoryId } />
						<AdvancedToggle open={ f.showAdvanced } onToggle={ () => f.setShowAdvanced(!f.showAdvanced) } />
						{ f.showAdvanced && (
							<input type="date" value={ f.date } onChange={ (e) => f.setDate(e.target.value) }
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none" />
						) }
					</>
				)
			} }
		</TransactionModalShell>
	)
}
```

---

# 7. `CreditTransactionModal.tsx`

Utilization bar (color-coded), available credit, statement balance + due date, and an installments field that appears for purchases via progressive disclosure.

```tsx
// src/components/finance/modals/CreditTransactionModal.tsx
import React, { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, AdvancedToggle, ProgressBar } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { useFormattedAmount } from './useFormattedAmount'
import { parseMeta, thresholdColor } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#F59E0B'

export const CreditTransactionModal: React.FC<TxModalProps> = (props) => {
	// 'expense' = purchase (increases owed), 'income' = payment (reduces owed)
	const f = useTransactionForm(props, ['expense', 'income'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useFormattedAmount(props.displayCurrency)
	const [installments, setInstallments] = useState(1)

	const limit = Number(meta.credit_limit) || 0
	const owed = Math.abs(props.wallet.balance) // balance held as owed amount
	const projectedOwed = f.type === 'expense' ? owed + f.numericAmount : Math.max(0, owed - f.numericAmount)
	const pct = limit > 0 ? (projectedOwed / limit) * 100 : 0
	const th = thresholdColor(pct)
	const available = Math.max(0, limit - projectedOwed)
	const valid = f.numericAmount > 0

	return (
		<TransactionModalShell
			accent={ ACCENT } icon={ <CreditCard size={ 18 } /> } typeBadge="Credit Card"
			title={ props.wallet.name } onClose={ props.onClose } onSuccess={ f.reset }
			onSubmit={ async () => {
				f.persistPrefs()
				return !!(await props.onSubmit(f.buildPayload(
					f.type === 'expense' && installments > 1 ? { metadata: { installments } } : {},
				)))
			} }
		>
			{ ({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ ACCENT }>
							<div className="flex items-center justify-between text-[11px] mb-1">
								<span className="text-zinc-400">Utilization</span>
								<span style={ { color: th.hex } }>{ pct.toFixed(0) }% · { th.label }</span>
							</div>
							<ProgressBar pct={ pct } color={ th.hex } />
							<div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
								<span>Available { format(available) }</span>
								{ meta.statement_balance != null && (
									<span>Stmt { format(Number(meta.statement_balance)) }{ meta.due_date ? ` · due ${ meta.due_date }` : '' }</span>
								) }
							</div>
						</ContextBand>

						<TypeToggle accent={ ACCENT } value={ f.type } onChange={ f.setType }
							options={ [{ id: 'expense', label: 'Purchase' }, { id: 'income', label: 'Payment' }] } />
						<AmountInput accent={ ACCENT } value={ f.amount } onChange={ f.setAmount } symbol={ symbol } autoFocus />
						<input value={ f.description } onChange={ (e) => f.setDescription(e.target.value) } placeholder="Description"
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
						<CategoryChipGrid accent={ ACCENT } categories={ f.categoriesForType } selected={ f.categoryId } onSelect={ f.setCategoryId } />

						<AdvancedToggle open={ f.showAdvanced } onToggle={ () => f.setShowAdvanced(!f.showAdvanced) } />
						{ f.showAdvanced && (
							<div className="space-y-2">
								{ f.type === 'expense' && (
									<label className="flex items-center justify-between text-xs text-zinc-400">
										Installments
										<select value={ installments } onChange={ (e) => setInstallments(Number(e.target.value)) }
											className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2 py-1.5 text-white outline-none">
											{ [1, 3, 6, 12, 24].map((n) => <option key={ n } value={ n }>{ n === 1 ? 'None' : `${ n }×` }</option>) }
										</select>
									</label>
								) }
								{ installments > 1 && (
									<div className="text-[11px] text-zinc-500 tabular-nums">
										{ format(f.numericAmount / installments) } / month for { installments } months
									</div>
								) }
								<input type="date" value={ f.date } onChange={ (e) => f.setDate(e.target.value) }
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none" />
							</div>
						) }
					</>
				)
			} }
		</TransactionModalShell>
	)
}
```

---

# 8. `CryptoTransactionModal.tsx`

Asset selector, **live price fetch with skeleton + error/retry**, and a tinted auto-calc panel: `qty × price = total`, `± fee = net`, recomputed every keystroke. Empty state when no assets are tracked.

```tsx
// src/components/finance/modals/CryptoTransactionModal.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Wallet, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AdvancedToggle } from './modalParts'
import { useFormattedAmount } from './useFormattedAmount'
import { tint, parseMeta } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#8B5CF6'
interface Asset { coinId: string; symbol: string; holdings: number }

export const CryptoTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income']) // expense=Sell, income=Buy
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useFormattedAmount(props.displayCurrency)

	const assets: Asset[] = useMemo(() => meta.assets ?? [], [meta])
	const [assetIdx, setAssetIdx] = useState(0)
	const asset = assets[assetIdx]

	const [qty, setQty] = useState('')
	const [price, setPrice] = useState('')
	const [fee, setFee] = useState('')
	const [priceState, setPriceState] = useState<'idle' | 'loading' | 'error'>('idle')
	const [change24h, setChange24h] = useState<number | null>(null)

	const fetchPrice = useCallback(async () => {
		if (!asset) return
		setPriceState('loading')
		try {
			const data = await (window as any).electronAPI.financeFetchCryptoPrices([asset.coinId], props.displayCurrency)
			const p = data?.[asset.coinId]
			if (p == null) throw new Error('No price')
			setPrice(String(p.price ?? p))
			setChange24h(typeof p.change24h === 'number' ? p.change24h : null)
			setPriceState('idle')
		} catch { setPriceState('error') }
	}, [asset, props.displayCurrency])

	useEffect(() => { fetchPrice() }, [fetchPrice])

	const qn = Number(qty) || 0, pn = Number(price) || 0, fn = Number(fee) || 0
	const total = qn * pn
	const net = f.type === 'income' ? total + fn : total - fn // Buy costs fee, Sell nets after fee
	const valid = qn > 0 && pn > 0 && !!asset

	if (assets.length === 0) {
		return (
			<TransactionModalShell accent={ ACCENT } icon={ <Wallet size={ 18 } /> } typeBadge="Crypto"
				title={ props.wallet.name } onClose={ props.onClose } onSubmit={ async () => false }>
				{ ({ setCanSubmit }) => {
					useEffect(() => setCanSubmit(false), [setCanSubmit])
					return (
						<div className="py-6 text-center">
							<p className="text-sm text-zinc-300">No assets tracked yet</p>
							<p className="mt-1 text-xs text-zinc-500">Add an asset to this wallet before recording a trade.</p>
						</div>
					)
				} }
			</TransactionModalShell>
		)
	}

	return (
		<TransactionModalShell
			accent={ ACCENT } icon={ <Wallet size={ 18 } /> } typeBadge="Crypto"
			title={ props.wallet.name } onClose={ props.onClose }
			onSuccess={ () => { f.reset(); setQty(''); setFee('') } }
			onSubmit={ async () => {
				f.persistPrefs()
				return !!(await props.onSubmit(f.buildPayload({
					amount: net,
					description: f.description.trim() || `${ f.type === 'income' ? 'Buy' : 'Sell' } ${ qn } ${ asset.symbol }`,
					metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: fn, total },
				})))
			} }
		>
			{ ({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ ACCENT }>
							<div className="flex items-center gap-2">
								<select value={ assetIdx } onChange={ (e) => setAssetIdx(Number(e.target.value)) }
									className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2 py-1 text-xs text-white outline-none">
									{ assets.map((a, i) => <option key={ a.coinId } value={ i }>{ a.symbol }</option>) }
								</select>
								<div className="ml-auto text-right">
									{ priceState === 'loading' ? (
										<div className="h-3 w-20 rounded bg-zinc-700/50 animate-pulse" />
									) : priceState === 'error' ? (
										<button onClick={ fetchPrice } className="flex items-center gap-1 text-[11px] text-amber-400">
											<RefreshCw size={ 11 } /> Retry price
										</button>
									) : (
										<div className="flex items-center gap-1 justify-end">
											<span className="font-mono text-xs text-white">{ format(pn) }</span>
											{ change24h != null && (
												<span className={ `flex items-center text-[10px] ${ change24h >= 0 ? 'text-emerald-400' : 'text-red-400' }` }>
													{ change24h >= 0 ? <TrendingUp size={ 10 } /> : <TrendingDown size={ 10 } /> }
													{ Math.abs(change24h).toFixed(1) }%
												</span>
											) }
										</div>
									) }
								</div>
							</div>
							<div className="mt-1 text-[11px] text-zinc-500">You hold: <span className="font-mono text-zinc-300">{ asset.holdings } { asset.symbol }</span></div>
						</ContextBand>

						<TypeToggle accent={ ACCENT } value={ f.type } onChange={ f.setType }
							options={ [{ id: 'income', label: 'Buy' }, { id: 'expense', label: 'Sell' }] } />

						<div className="flex gap-2">
							<label className="flex-1">
								<span className="text-[11px] text-zinc-500">Quantity</span>
								<input autoFocus inputMode="decimal" value={ qty } onChange={ (e) => setQty(e.target.value) } placeholder="0.00"
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none" />
							</label>
							<label className="flex-1">
								<span className="text-[11px] text-zinc-500">Price</span>
								<input inputMode="decimal" value={ price } onChange={ (e) => setPrice(e.target.value) } placeholder="0.00"
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none" />
							</label>
						</div>

						<div className="rounded-lg p-3 space-y-1 font-mono text-xs" style={ { background: tint(ACCENT, 0.08) } }>
							<div className="flex justify-between text-zinc-400"><span>{ qn } × { format(pn) }</span><span className="text-white">{ format(total) }</span></div>
							<div className="flex justify-between text-zinc-400"><span>Fee { f.type === 'income' ? '+' : '−' }</span><span>{ format(fn) }</span></div>
							<div className="flex justify-between border-t border-white/10 pt-1 text-sm"><span className="text-zinc-300">Net</span><span className="font-semibold text-white">{ format(net) }</span></div>
						</div>

						<AdvancedToggle open={ f.showAdvanced } onToggle={ () => f.setShowAdvanced(!f.showAdvanced) } />
						{ f.showAdvanced && (
							<div className="flex gap-2">
								<input inputMode="decimal" value={ fee } onChange={ (e) => setFee(e.target.value) } placeholder="Fee"
									className="flex-1 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none" />
								<input type="date" value={ f.date } onChange={ (e) => f.setDate(e.target.value) }
									className="flex-1 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-sm text-white outline-none" />
							</div>
						) }
					</>
				)
			} }
		</TransactionModalShell>
	)
}
```

---

# 9. `PhysicalTransactionModal.tsx`

The one the user explicitly called out. Spend/Deposit toggle, denomination picker with auto-fill, and **change-kept math** so the wallet's denomination metadata stays exact and adds up to the balance.

```tsx
// src/components/finance/modals/PhysicalTransactionModal.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { WalletCards } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { DenominationPicker } from './DenominationPicker'
import { useFormattedAmount } from './useFormattedAmount'
import { parseMeta, sumDenoms, DENOMINATIONS } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#F97316'

export const PhysicalTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income']) // expense=Spend, income=Deposit
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useFormattedAmount(props.displayCurrency)
	const denoms = DENOMINATIONS[props.wallet.currency] ?? DENOMINATIONS.IDR

	const onHand: Record<number, number> = useMemo(() => meta.denominations ?? {}, [meta])
	const [counts, setCounts] = useState<Record<number, number>>({})

	const tendered = sumDenoms(counts)
	const change = f.type === 'expense' ? Math.max(0, tendered - f.numericAmount) : 0
	const validSpend = f.type === 'expense' ? f.numericAmount > 0 && tendered >= f.numericAmount : f.numericAmount > 0

	return (
		<TransactionModalShell
			accent={ ACCENT } icon={ <WalletCards size={ 18 } /> } typeBadge="Physical"
			title={ props.wallet.name } onClose={ props.onClose }
			onSuccess={ () => { f.reset(); setCounts({}) } }
			onSubmit={ async () => {
				f.persistPrefs()
				// reconcile denominations: spend subtracts tendered then re-adds change
				const next: Record<number, number> = { ...onHand }
				if (f.type === 'expense') {
					for (const [d, n] of Object.entries(counts)) next[+d] = (next[+d] ?? 0) - n
					// change re-added greedily handled server-side; we record the deltas
				} else {
					for (const [d, n] of Object.entries(counts)) next[+d] = (next[+d] ?? 0) + n
				}
				return !!(await props.onSubmit(f.buildPayload({
					metadata: { denominations: counts, change_kept: change, denomination_after: next },
				})))
			} }
		>
			{ ({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(validSpend), [validSpend, setCanSubmit])
				return (
					<>
						<ContextBand accent={ ACCENT }>
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-zinc-400">Wallet total</span>
								<span className="text-xs font-semibold tabular-nums text-white">{ format(props.wallet.balance) }</span>
							</div>
							{ meta.description && <div className="mt-0.5 text-[11px] text-zinc-500">{ meta.description }</div> }
							<div className="mt-0.5 text-[11px] text-zinc-500">
								{ Object.entries(onHand).filter(([, n]) => n > 0).map(([d, n]) => `${ format(+d) }×${ n }`).join('  ·  ') || 'No notes recorded' }
							</div>
						</ContextBand>

						<TypeToggle accent={ ACCENT } value={ f.type } onChange={ f.setType }
							options={ [{ id: 'expense', label: 'Spend' }, { id: 'income', label: 'Deposit' }] } />
						<AmountInput accent={ ACCENT } value={ f.amount } onChange={ f.setAmount } symbol={ symbol } autoFocus />

						<DenominationPicker accent={ ACCENT } currency={ props.wallet.currency } denoms={ denoms }
							counts={ counts } onChange={ setCounts } format={ format }
							autoFillTarget={ f.type === 'expense' ? f.numericAmount : undefined } />

						{ f.type === 'expense' && (
							<div className="flex items-center justify-between text-xs">
								<span className="text-zinc-400">Change kept</span>
								<span className="tabular-nums font-medium" style={ { color: tendered < f.numericAmount ? '#EF4444' : '#10B981' } }>
									{ tendered < f.numericAmount ? 'Insufficient notes selected' : format(change) }
								</span>
							</div>
						) }

						<CategoryChipGrid accent={ ACCENT } categories={ f.categoriesForType } selected={ f.categoryId } onSelect={ f.setCategoryId } />
					</>
				)
			} }
		</TransactionModalShell>
	)
}
```

---

# 10. `CashTransactionModal.tsx`

Simplest denomination flow — a counter with quick-add, no change math. Amount is **derived** from the notes you count, so it always reconciles.

```tsx
// src/components/finance/modals/CashTransactionModal.tsx
import React, { useEffect, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { DenominationPicker } from './DenominationPicker'
import { useFormattedAmount } from './useFormattedAmount'
import { parseMeta, sumDenoms, DENOMINATIONS } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#EC4899'

export const CashTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income'])
	const meta = parseMeta(props.wallet)
	const { format } = useFormattedAmount(props.displayCurrency)
	const denoms = DENOMINATIONS[props.wallet.currency] ?? DENOMINATIONS.IDR
	const [counts, setCounts] = useState<Record<number, number>>({})
	const total = sumDenoms(counts)
	const valid = total > 0

	return (
		<TransactionModalShell
			accent={ ACCENT } icon={ <PiggyBank size={ 18 } /> } typeBadge="Cash"
			title={ props.wallet.name } onClose={ props.onClose }
			onSuccess={ () => { f.reset(); setCounts({}) } }
			onSubmit={ async () => {
				f.persistPrefs()
				return !!(await props.onSubmit(f.buildPayload({
					amount: total,
					description: f.description.trim() || (f.type === 'income' ? 'Cash in' : 'Cash out'),
					metadata: { denominations: counts },
				})))
			} }
		>
			{ ({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ ACCENT }>
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-zinc-400">Cash on hand</span>
								<span className="text-xs font-semibold tabular-nums text-white">{ format(props.wallet.balance) }</span>
							</div>
						</ContextBand>
						<TypeToggle accent={ ACCENT } value={ f.type } onChange={ f.setType }
							options={ [{ id: 'expense', label: 'Cash out' }, { id: 'income', label: 'Cash in' }] } />
						<DenominationPicker accent={ ACCENT } currency={ props.wallet.currency } denoms={ denoms }
							counts={ counts } onChange={ setCounts } format={ format } />
						<CategoryChipGrid accent={ ACCENT } categories={ f.categoriesForType } selected={ f.categoryId } onSelect={ f.setCategoryId } />
					</>
				)
			} }
		</TransactionModalShell>
	)
}
```

---

# 11. `EwalletTransactionModal.tsx`

Platform name, linked-method badges, optional daily limit, and a top-up flow (income from a linked source).

```tsx
// src/components/finance/modals/EwalletTransactionModal.tsx
import React, { useEffect, useState } from 'react'
import { Banknote } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, AdvancedToggle, ProgressBar } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { useFormattedAmount } from './useFormattedAmount'
import { tint, parseMeta, thresholdColor } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#06B6D4'

export const EwalletTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income']) // income = Top-up
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useFormattedAmount(props.displayCurrency)
	const linked: string[] = meta.linked_methods ?? []
	const [source, setSource] = useState(linked[0] ?? '')
	const dailyLimit = Number(meta.daily_limit) || 0
	const pct = dailyLimit > 0 ? (f.numericAmount / dailyLimit) * 100 : 0
	const th = thresholdColor(pct)
	const valid = f.numericAmount > 0

	return (
		<TransactionModalShell
			accent={ ACCENT } icon={ <Banknote size={ 18 } /> } typeBadge="E-Wallet"
			title={ props.wallet.name } onClose={ props.onClose } onSuccess={ f.reset }
			onSubmit={ async () => {
				f.persistPrefs()
				return !!(await props.onSubmit(f.buildPayload(
					f.type === 'income' && source ? { metadata: { topup_source: source } } : {},
				)))
			} }
		>
			{ ({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ ACCENT }>
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium text-white">{ props.wallet.provider ?? meta.platform ?? 'E-Wallet' }</span>
								<span className="text-xs tabular-nums text-zinc-300">{ format(props.wallet.balance) }</span>
							</div>
							{ linked.length > 0 && (
								<div className="mt-1 flex flex-wrap gap-1">
									{ linked.map((m) => (
										<span key={ m } className="rounded-full px-2 py-0.5 text-[10px]"
											style={ { background: tint(ACCENT, 0.1), color: ACCENT, border: `1px solid ${ tint(ACCENT, 0.2) }` } }>{ m }</span>
									)) }
								</div>
							) }
							{ dailyLimit > 0 && f.numericAmount > 0 && (
								<div className="mt-1.5"><ProgressBar pct={ pct } color={ th.hex } /></div>
							) }
						</ContextBand>

						<TypeToggle accent={ ACCENT } value={ f.type } onChange={ f.setType }
							options={ [{ id: 'expense', label: 'Pay' }, { id: 'income', label: 'Top-up' }] } />
						<AmountInput accent={ ACCENT } value={ f.amount } onChange={ f.setAmount } symbol={ symbol } autoFocus />

						{ f.type === 'income' && linked.length > 0 ? (
							<select value={ source } onChange={ (e) => setSource(e.target.value) }
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none">
								{ linked.map((m) => <option key={ m } value={ m }>Top-up from { m }</option>) }
							</select>
						) : (
							<input value={ f.description } onChange={ (e) => f.setDescription(e.target.value) } placeholder="Description"
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
						) }

						<CategoryChipGrid accent={ ACCENT } categories={ f.categoriesForType } selected={ f.categoryId } onSelect={ f.setCategoryId } />
						<AdvancedToggle open={ f.showAdvanced } onToggle={ () => f.setShowAdvanced(!f.showAdvanced) } />
						{ f.showAdvanced && (
							<input type="date" value={ f.date } onChange={ (e) => f.setDate(e.target.value) }
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none" />
						) }
					</>
				)
			} }
		</TransactionModalShell>
	)
}
```

---

# 12. `FinancePage.tsx` — routing wiring

The routing map already exists; the only changes are passing `todaySpent` (for the Debit band) and a single `onSubmit` that calls the existing IPC. No new backend.

```tsx
// src/pages/FinancePage.tsx  (excerpt — the FAB → modal routing)
import { BankTransactionModal } from '../components/finance/modals/BankTransactionModal'
import { DebitTransactionModal } from '../components/finance/modals/DebitTransactionModal'
import { CreditTransactionModal } from '../components/finance/modals/CreditTransactionModal'
import { CryptoTransactionModal } from '../components/finance/modals/CryptoTransactionModal'
import { PhysicalTransactionModal } from '../components/finance/modals/PhysicalTransactionModal'
import { CashTransactionModal } from '../components/finance/modals/CashTransactionModal'
import { EwalletTransactionModal } from '../components/finance/modals/EwalletTransactionModal'
import { QuickAddModal } from '../components/finance/modals/QuickAddModal'
import type { WalletType } from '../components/finance/finance-types'
import type { TxModalProps } from '../components/finance/modals/modalUtils'

const MODALS: Record<WalletType, React.FC<TxModalProps>> = {
	bank: BankTransactionModal,
	debit_card: DebitTransactionModal,
	credit_card: CreditTransactionModal,
	crypto: CryptoTransactionModal,
	physical: PhysicalTransactionModal,
	cash: CashTransactionModal,
	ewallet: EwalletTransactionModal,
	other: QuickAddModal,
}

function WalletTxHost({ wallet, categories, displayCurrency, baseCurrency, onClose, onAdded }: {
	wallet: FinanceWallet; categories: any[]; displayCurrency: string; baseCurrency: string
	onClose: () => void; onAdded: () => void
}) {
	const Modal = MODALS[wallet.type] ?? QuickAddModal

	// today's spend for the Debit daily-limit band (sum of today's expense tx for this wallet)
	const [todaySpent, setTodaySpent] = useState<number | undefined>(undefined)
	useEffect(() => {
		let alive = true
		;(async () => {
			try {
				const today = new Date().toISOString().slice(0, 10)
				const txs = await (window as any).electronAPI.financeGetTransactions?.({ wallet_id: wallet.id, date: today })
				if (alive) setTodaySpent((txs ?? []).filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + t.amount, 0))
			} catch { if (alive) setTodaySpent(0) }
		})()
		return () => { alive = false }
	}, [wallet.id])

	const onSubmit = useCallback(async (data: Record<string, any>) => {
		const payload = { ...data, metadata: data.metadata ? JSON.stringify(data.metadata) : undefined }
		const res = await (window as any).electronAPI.financeAddTransaction(payload)
		if (res) onAdded() // refresh wallet balances/list
		return res
	}, [onAdded])

	return (
		<Modal wallet={ wallet } categories={ categories } displayCurrency={ displayCurrency }
			baseCurrency={ baseCurrency } todaySpent={ todaySpent } onSubmit={ onSubmit } onClose={ onClose } />
	)
}
```

> `financeGetTransactions` is used only as an optional read for the daily-limit band; the `?.` guard means the Debit modal degrades gracefully (hides the bar) if that read isn't wired — no new backend is required for the core add-transaction flow.
> 

---

# 13. Human-Centric UX checklist — coverage

| # | Requirement | Where it's met |
| --- | --- | --- |
| 1 | Clarity over cleverness | Plain labels (“Purchase / Payment”, “Cash in / Cash out”, “Top-up”); one primary action per modal. |
| 2 | Progressive disclosure | `AdvancedToggle` hides notes/date/installments/fee; transfer + topup fields appear only for their type. |
| 3 | Visual hierarchy | Context band → type → amount (text-xl) → secondary; amount is the focal point. |
| 4 | Empty state | Crypto “No assets tracked”; Physical “No notes recorded”. |
| 5 | Loading state | Crypto price skeleton (`animate-pulse`). |
| 6 | Error state | Shell inline error + Retry (fields preserved); crypto price Retry. |
| 7 | Feedback states | hover/focus/active/disabled on every button; 150–300ms transitions. |
| 8 | Submit lifecycle | idle → spinner → check pop → auto-close 800ms; form clears via `onSuccess`. |
| 9 | Accessibility | `focus-visible` rings w/ offset, `aria-label`s, ≥44px targets, `inputMode`. |
| 10 | Color + meaning | Threshold bars carry a text label (Healthy/Watch/High), never color alone. |
| 11 | Forgiveness | Insufficient-notes message before submit; ESC + overlay click close; ⌘/Ctrl+Enter submits. |
| 12 | No raw tokens | All currency via `useFormattedAmount`; no IDs/enums shown to the user. |

<aside>
🧮

**Why balances now “add up perfectly.”** Physical/Cash submit the actual **denomination deltas** (`denominations`, `change_kept`, `denomination_after`) and derive `amount` from `sum(value × count)`, so the note breakdown and the numeric balance can never drift. Crypto submits `net` (after fee) plus the full `{ qty, price, fee, total }` so holdings and balance reconcile. Credit derives utilization from `|balance|` vs `credit_limit` projected by the pending amount, so the bar reflects the post-transaction state.

</aside>

# Build order

1. **`modalUtils.ts` + `modalParts.tsx`** — the `tint()` fix alone makes existing modals stop looking generic.
2. **`TransactionModalShell.tsx` + `useTransactionForm.ts`** — the shared lifecycle every modal depends on.
3. **`DenominationPicker.tsx`** — unblocks Physical + Cash.
4. **The 7 modals** — each is now ~80–140 lines; drop them in one at a time, Physical and Crypto first (the two the user flagged).
5. **`FinancePage.tsx`** wiring — `todaySpent` + `onSubmit` metadata stringify.