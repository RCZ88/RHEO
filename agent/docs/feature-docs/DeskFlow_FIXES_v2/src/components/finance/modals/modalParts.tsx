import React from 'react'
import { ChevronDown } from 'lucide-react'
import { tint } from './modalUtils'
import type { TxType } from './modalUtils'

export function ContextBand({ accent, children }: { accent: string; children: React.ReactNode }) {
	return (
		<div className="px-3 py-2 mb-2 rounded-lg border"
			style={{ background: tint(accent, 0.05), borderColor: tint(accent, 0.1) }}>
			{children}
		</div>
	)
}

export function TypeToggle({ accent, value, options, onChange }: {
	accent: string; value: TxType; options: { id: TxType; label: string }[]; onChange: (t: TxType) => void
}) {
	return (
		<div className="flex gap-2">
			{options.map((o) => {
				const on = o.id === value
				return (
					<button key={o.id} onClick={() => onChange(o.id)}
						className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-medium border transition-colors
							focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
						style={on
							? { background: tint(accent, 0.15), color: accent, borderColor: tint(accent, 0.3) }
							: { background: 'rgba(39,39,42,0.5)', color: '#a1a1aa', borderColor: 'rgba(63,63,70,0.5)' }}>
						{o.label}
					</button>
				)
			})}
		</div>
	)
}

export function formatWithCommas(raw: string): string {
	const clean = raw.replace(/[^0-9.]/g, '')
	const dot = clean.indexOf('.')
	if (dot === -1) return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	const intPart = clean.slice(0, dot).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	const decPart = clean.slice(dot + 1).replace(/[^0-9]/g, '').slice(0, 2)
	return `${intPart}.${decPart}`
}

export function stripFormatting(formatted: string): string {
	return formatted.replace(/,/g, '')
}

export function AmountInput({ accent, value, onChange, symbol, autoFocus }: {
	accent: string; value: string; onChange: (v: string) => void; symbol: string; autoFocus?: boolean
}) {
	return (
		<label className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3
			focus-within:ring-2 transition-shadow"
			style={{ ['--tw-ring-color' as any]: tint(accent, 0.5) }}>
			<span className="text-zinc-500 text-base">{symbol}</span>
			<input
				autoFocus={autoFocus} inputMode="decimal" placeholder="0"
				value={formatWithCommas(value)}
				onChange={(e) => onChange(stripFormatting(e.target.value))}
				className="w-full bg-transparent py-2.5 text-xl font-semibold tabular-nums text-white
					outline-none focus-visible:ring-0 placeholder:text-zinc-600" />
		</label>
	)
}

export function AdvancedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
	return (
		<button onClick={onToggle}
			className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
			<ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
			{open ? 'Hide advanced' : '+ Advanced'}
		</button>
	)
}

export function ProgressBar({ pct, color }: { pct: number; color: string }) {
	return (
		<div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
			<div className="h-full rounded-full transition-all duration-300"
				style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
		</div>
	)
}
