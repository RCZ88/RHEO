import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Wallet, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AdvancedToggle } from './modalParts'
import { TransferWalletSelect } from './TransferWalletSelect'
import { TransferDestinationPanel } from './TransferDestinationPanel'
import { useCurrencyFormat, tint, parseMeta } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#8B5CF6'
interface Asset { coinId: string; symbol: string; holdings: number }

export const CryptoTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income', 'transfer'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useCurrencyFormat(props.displayCurrency)
	const [destWalletId, setDestWalletId] = useState<number | null>(null)
	const [destMetadata, setDestMetadata] = useState<Record<string, any> | null>(null)

	const destWallet = useMemo(() =>
		props.wallets?.find(w => w.id === destWalletId), [props.wallets, destWalletId])

	const assets: Asset[] = useMemo(() => {
		if (Array.isArray(meta.assets)) return meta.assets.map((a: any) => ({
			coinId: a.coin_id || a.coinId || a.asset || '',
			symbol: (a.symbol || a.asset || '').toUpperCase(),
			holdings: Number(a.amount) || 0,
		}))
		if (meta.coin_id) return [{ coinId: meta.coin_id, symbol: (meta.symbol || '').toUpperCase(), holdings: Number(props.wallet.balance) || 0 }]
		return []
	}, [meta, props.wallet.balance])

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
			const data = await (window as any).deskflowAPI?.financeFetchCryptoPrices([asset.coinId], props.displayCurrency)
			const p = data?.[0]
			if (!p || p.current_price == null) throw new Error('No price')
			setPrice(String(p.current_price))
			setChange24h(typeof p.price_change_percentage_24h === 'number' ? p.price_change_percentage_24h : null)
			setPriceState('idle')
		} catch { setPriceState('error') }
	}, [asset, props.displayCurrency])

	useEffect(() => { if (f.type !== 'transfer') fetchPrice() }, [fetchPrice, f.type])

	const qn = Number(qty) || 0, pn = Number(price) || 0, fn = Number(fee) || 0
	const total = qn * pn
	const net = f.type === 'income' ? total + fn : total - fn
	const valid = f.type === 'transfer'
		? !!destWallet && !!(f.description.trim())
		: qn > 0 && pn > 0 && !!asset

	if (assets.length === 0) {
		return (
			<TransactionModalShell accent={ACCENT} icon={<Wallet size={18} />} typeBadge="Crypto"
				title={props.wallet.name} onClose={props.onClose} onSubmit={async () => false}>
				{({ setCanSubmit }) => {
					useEffect(() => setCanSubmit(false), [setCanSubmit])
					return (
						<div className="py-6 text-center">
							<p className="text-sm text-zinc-300">No assets tracked yet</p>
							<p className="mt-1 text-xs text-zinc-500">Add an asset to this wallet before recording a trade.</p>
						</div>
					)
				}}
			</TransactionModalShell>
		)
	}

	return (
		<TransactionModalShell
			accent={ACCENT} icon={<Wallet size={18} />} typeBadge="Crypto"
			title={props.wallet.name} onClose={props.onClose}
			onSuccess={() => { f.reset(); setQty(''); setFee(''); setDestWalletId(null); setDestMetadata(null) }}
			onSubmit={async () => {
				f.persistPrefs()
				if (f.type === 'transfer') {
					return !!(await props.onSubmit(f.buildPayload({
						to_wallet_id: destWalletId,
						fromWalletName: props.wallet.name,
						toWalletName: destWallet?.name || 'another wallet',
						description: f.description.trim() || `Transfer to ${destWallet?.name || 'another wallet'}`,
						amount: -f.numericAmount,
						dest_metadata: destMetadata,
					})))
				}
				return !!(await props.onSubmit(f.buildPayload({
					amount: f.type === 'income' ? -net : net,
					description: f.description.trim() || `${f.type === 'income' ? 'Buy' : 'Sell'} ${qn} ${asset.symbol}`,
					metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: fn, total },
				})))
			}}
		>
			{({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ACCENT}>
							<div className="flex items-center gap-2">
								{f.type !== 'transfer' && (
									<select value={assetIdx} onChange={(e) => setAssetIdx(Number(e.target.value))}
										className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2 py-1 text-xs text-white outline-none">
										{assets.map((a, i) => <option key={a.coinId} value={i}>{a.symbol}</option>)}
									</select>
								)}
								{f.type === 'transfer' && (
									<span className="text-xs text-zinc-300">Send crypto</span>
								)}
								<div className="ml-auto text-right">
									{f.type !== 'transfer' && priceState === 'loading' ? (
										<div className="h-3 w-20 rounded bg-zinc-700/50 animate-pulse" />
									) : priceState === 'error' ? (
										<button onClick={fetchPrice} className="flex items-center gap-1 text-[11px] text-amber-400">
											<RefreshCw size={11} /> Retry price
										</button>
									) : f.type !== 'transfer' ? (
										<div className="flex items-center gap-1 justify-end">
											<span className="font-mono text-xs text-white">{format(pn)}</span>
											{change24h != null && (
												<span className={`flex items-center text-[10px] ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
													{change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
													{Math.abs(change24h).toFixed(1)}%
												</span>
											)}
										</div>
									) : null}
								</div>
							</div>
							{f.type !== 'transfer' && (
								<div className="mt-1 text-[11px] text-zinc-500">You hold: <span className="font-mono text-zinc-300">{asset.holdings} {asset.symbol}</span></div>
							)}
						</ContextBand>

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'income', label: 'Buy' }, { id: 'expense', label: 'Sell' }, { id: 'transfer', label: 'Send' }]} />

						{f.type === 'transfer' ? (
							<>
								<AmountInput accent={ACCENT} value={f.amount} onChange={f.setAmount} symbol={symbol} autoFocus />
								<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Transaction ID / destination address"
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
								<TransferWalletSelect
									wallets={props.wallets || []}
									accounts={props.accounts || []}
									excludeWalletId={props.wallet.id}
									selectedWalletId={destWalletId}
									onSelect={setDestWalletId}
									displayCurrency={props.displayCurrency}
								/>
								<TransferDestinationPanel
									destWallet={destWallet}
									accent={ACCENT}
									format={format}
									onMetadataChange={setDestMetadata}
								/>
							</>
						) : (
							<>
								<div className="flex gap-2">
									<label className="flex-1">
										<span className="text-[11px] text-zinc-500">Quantity</span>
										<input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00"
											className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-zinc-500" />
									</label>
									<label className="flex-1">
										<span className="text-[11px] text-zinc-500">Price</span>
										<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00"
											className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-zinc-500" />
									</label>
								</div>
								<div className="rounded-lg p-3 space-y-1 font-mono text-xs" style={{ background: tint(ACCENT, 0.08) }}>
									<div className="flex justify-between text-zinc-400"><span>{qn} × {format(pn)}</span><span className="text-white">{format(total)}</span></div>
									<div className="flex justify-between text-zinc-400"><span>Fee {f.type === 'income' ? '+' : '−'}</span><span>{format(fn)}</span></div>
									<div className="flex justify-between border-t border-white/10 pt-1 text-sm"><span className="text-zinc-300">Net</span><span className="font-semibold text-white">{format(net)}</span></div>
								</div>
							</>
						)}

						<input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)}
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500" />
						<AdvancedToggle open={f.showAdvanced} onToggle={() => f.setShowAdvanced(!f.showAdvanced)} />
						{f.showAdvanced && (
							<>
								{f.type !== 'transfer' && (
									<input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Fee"
										className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-zinc-500" />
								)}
							</>
						)}
					</>
				)
			}}
		</TransactionModalShell>
	)
}
