import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Wallet, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AdvancedToggle, OnBehalfOfSection, HistoricalToggle } from './modalParts'
import { TransferWalletSelect } from './TransferWalletSelect'
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

	const isDestFiat = useMemo(() =>
		destWallet && destWallet.type !== 'crypto', [destWallet])

	// Crypto wallet's fiat balance (deposited cash, not crypto holdings)
	const walletFiatBalance = Number(props.wallet.balance) || 0
	const hasFiat = walletFiatBalance > 0

	// Fiat amount input for crypto→fiat when wallet has fiat
	const [fiatAmt, setFiatAmt] = useState('')
	// Pay/Receive mode
	const [mode, setMode] = useState<'buy' | 'sell' | 'transfer' | 'pay' | 'receive'>('buy')
	const [counterpartyName, setCounterpartyName] = useState('')

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

	useEffect(() => { if (asset) fetchPrice() }, [fetchPrice, f.type, asset])

	const qn = Number(qty) || 0, pn = Number(price) || 0, fn = Number(fee) || 0
	const total = qn * pn
	const net = f.type === 'income' ? total + fn : total - fn
	const valid = (mode === 'pay' || mode === 'receive')
		? qn > 0 && !!asset && counterpartyName.trim().length > 0
		: f.type === 'transfer'
			? !!destWallet && (isDestFiat && hasFiat ? (Number(fiatAmt) || 0) > 0 : qn > 0)
			: qn > 0 && pn > 0 && !!asset
	const selectedPerson = f.ftPersonId ? props.ftPersons?.find(p => p.id === f.ftPersonId) : null

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
			onSuccess={() => { f.reset(); setQty(''); setPrice(''); setFee(''); setFiatAmt(''); setDestWalletId(null); setDestMetadata(null); setMode('buy'); setCounterpartyName('') }}
		onSubmit={async () => {
			f.persistPrefs()
			// Pay mode (send crypto to a person as payment)
			if (mode === 'pay') {
				return !!(await props.onSubmit(f.buildPayload({
					type: 'income',
					amount: 0,
					description: f.description.trim() || `Pay ${qn} ${asset.symbol} to ${counterpartyName}`,
					metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: 0, total: 0, payee: counterpartyName, is_purchase: false },
				})))
			}
			// Receive mode (get crypto from a person as payment)
			if (mode === 'receive') {
				return !!(await props.onSubmit(f.buildPayload({
					type: 'expense',
					amount: 0,
					description: f.description.trim() || `Receive ${qn} ${asset.symbol} from ${counterpartyName}`,
					metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: 0, total: 0, sender: counterpartyName, is_purchase: false },
				})))
			}
			if (f.type === 'transfer') {
					if (isDestFiat && hasFiat) {
						// Crypto wallet has fiat → standard fiat transfer
						const fiatAmount = Number(fiatAmt) || 0
						return !!(await props.onSubmit(f.buildPayload({
							to_wallet_id: destWalletId,
							fromWalletName: props.wallet.name,
							toWalletName: destWallet?.name || 'another wallet',
							description: f.description.trim() || `Transfer to ${destWallet?.name || 'another wallet'}`,
							amount: -fiatAmount,
							fee: 0,
							dest_metadata: destMetadata,
						})))
					}
					if (isDestFiat && !hasFiat) {
						// No fiat → sell crypto for fiat
						return !!(await props.onSubmit(f.buildPayload({
							to_wallet_id: destWalletId,
							fromWalletName: props.wallet.name,
							toWalletName: destWallet?.name || 'another wallet',
							description: f.description.trim() || `Sell ${qn} ${asset.symbol} → ${format(qn * pn)} ${destWallet?.currency || props.displayCurrency}`,
							amount: qn,
							fee: 0,
							dest_amount: qn * pn,
							metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: 0, total: qn * pn },
							dest_metadata: destMetadata,
						})))
					}
					// Crypto → Crypto
					const cryptoReceived = qn - fn
					return !!(await props.onSubmit(f.buildPayload({
						to_wallet_id: destWalletId,
						fromWalletName: props.wallet.name,
						toWalletName: destWallet?.name || 'another wallet',
						description: f.description.trim() || `Transfer ${qn} ${asset.symbol} to ${destWallet?.name || 'another wallet'}`,
						amount: qn * pn,
						fee: fn,
						metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: fn, cryptoReceived },
						dest_metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: cryptoReceived, price: pn },
					})))
				}
				return !!(await props.onSubmit(f.buildPayload({
					amount: f.type === 'expense' ? -net : net,
					description: f.description.trim() || `${f.type === 'expense' ? 'Buy' : 'Sell'} ${qn} ${asset.symbol}`,
					metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: fn, total },
				})))
			}}
		>
			{({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						{!(f.type === 'transfer' && isDestFiat) && (
						<ContextBand accent={ACCENT}>
							<div className="flex items-center gap-2">
								<select value={assetIdx} onChange={(e) => setAssetIdx(Number(e.target.value))}
									className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2 py-1 text-xs text-white outline-none">
									{assets.map((a, i) => <option key={a.coinId} value={i}>{a.symbol}</option>)}
								</select>
								<div className="ml-auto text-right">
									{priceState === 'loading' ? (
										<div className="h-3 w-20 rounded bg-zinc-700/50 animate-pulse" />
									) : priceState === 'error' ? (
										<button onClick={fetchPrice} className="flex items-center gap-1 text-[11px] text-amber-400">
											<RefreshCw size={11} /> Retry price
										</button>
									) : (
										<div className="flex items-center gap-1 justify-end">
											<span className="font-mono text-xs text-white">{format(pn)}</span>
											{change24h != null && (
												<span className={`flex items-center text-[10px] ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
													{change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
													{Math.abs(change24h).toFixed(1)}%
												</span>
											)}
										</div>
									)}
								</div>
							</div>
							<div className="mt-1 text-[11px] text-zinc-500">You hold: <span className="font-mono text-zinc-300">{asset.holdings} {asset.symbol}</span></div>
						</ContextBand>
						)}

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'expense', label: 'Buy' }, { id: 'income', label: 'Sell' }, { id: 'transfer', label: 'Send' }]} />

						{/* Pay/Receive mode selector */}
						<div className="flex gap-2 mt-2">
							<button onClick={() => setMode('pay')}
								className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${mode === 'pay' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'}`}>
								Pay (send to person)
							</button>
							<button onClick={() => setMode('receive')}
								className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${mode === 'receive' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'}`}>
								Receive (get from person)
							</button>
						</div>

						{/* Counterparty input for Pay/Receive */}
						{(mode === 'pay' || mode === 'receive') && (
							<label className="block mt-2">
								<span className="text-[11px] text-zinc-500">{mode === 'pay' ? 'Payee name' : 'Sender name'}</span>
								<input autoFocus value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)}
									placeholder={mode === 'pay' ? 'Who are you paying?' : 'Who sent it?'}
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
							</label>
						)}

						{f.type === 'transfer' ? (
						<>
							<TransferWalletSelect
								wallets={props.wallets || []}
								accounts={props.accounts || []}
								excludeWalletId={props.wallet.id}
								selectedWalletId={destWalletId}
								onSelect={setDestWalletId}
								displayCurrency={props.displayCurrency}
							/>
							{isDestFiat && hasFiat ? (
								<>
									<div className="rounded-lg p-3 space-y-1 font-mono text-xs" style={{ background: tint(ACCENT, 0.08) }}>
										<div className="flex justify-between text-zinc-400"><span>Available</span><span className="text-white">{format(walletFiatBalance)}</span></div>
									</div>
									<label className="block">
										<span className="text-[11px] text-zinc-500">Amount</span>
										<input autoFocus inputMode="decimal" value={fiatAmt} onChange={(e) => setFiatAmt(e.target.value)} placeholder="0"
											className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-zinc-500" />
									</label>
									{Number(fiatAmt) > walletFiatBalance && (
										<p className="text-[10px] text-red-400">Exceeds available balance</p>
									)}
									<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Note"
										className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
								</>
							) : isDestFiat && !hasFiat ? (
								<>
									<div className="rounded-lg p-3 space-y-1 font-mono text-xs" style={{ background: 'rgba(239,68,68,0.08)' }}>
										<div className="flex justify-between text-zinc-400"><span>No fiat balance</span><span className="text-red-400">{format(0)}</span></div>
										<div className="text-[10px] text-zinc-500 mt-1">Sell crypto to fund this transfer</div>
									</div>
									<label className="block">
										<span className="text-[11px] text-zinc-500">Sell Quantity ({asset.symbol})</span>
										<input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00"
											className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-zinc-500" />
									</label>
									<div className="rounded-lg p-3 space-y-1 font-mono text-xs" style={{ background: tint(ACCENT, 0.08) }}>
										<div className="flex justify-between text-zinc-400"><span>Rate</span><span className="text-white">{qn > 0 ? `1 ${asset.symbol} = ${format(pn)}` : '—'}</span></div>
										<div className="flex justify-between border-t border-white/10 pt-1 text-sm">
											<span className="text-zinc-300">Destination receives</span>
											<span className="font-semibold text-emerald-400">{qn > 0 ? `${format(qn * pn)} ${destWallet?.currency || props.displayCurrency}` : `0 ${destWallet?.currency || props.displayCurrency}`}</span>
										</div>
									</div>
									<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Note"
										className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
								</>
							) : (
								<>
									<div className="flex gap-2">
										<label className="flex-1">
											<span className="text-[11px] text-zinc-500">Quantity ({asset.symbol})</span>
											<input autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00"
												className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-zinc-500" />
										</label>
									</div>
									<div className="rounded-lg p-3 space-y-1 font-mono text-xs" style={{ background: tint(ACCENT, 0.08) }}>
										<div className="flex justify-between text-zinc-400"><span>Fee</span><span>−{fn > 0 ? `${fn} ${asset.symbol}` : `0 ${asset.symbol}`}</span></div>
										<div className="flex justify-between border-t border-white/10 pt-1 text-sm"><span className="text-zinc-300">They receive</span><span className="font-semibold text-white">{qn > 0 ? `${(qn - fn).toFixed(8).replace(/\.?0+$/, '')} ${asset.symbol}` : `0 ${asset.symbol}`}</span></div>
									</div>
									<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Transaction ID / address"
										className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
									<label className="block">
										<span className="text-[11px] text-zinc-500">Fee ({asset.symbol})</span>
										<input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0.00"
											className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-zinc-500" />
									</label>
								</>
							)}
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

					<OnBehalfOfSection accent={ACCENT} value={f.onBehalfOf} personId={f.ftPersonId} onValueChange={f.setOnBehalfOf} onPersonChange={(id, _name) => f.setFtPersonId(id)} persons={props.ftPersons} onAddPerson={props.onAddFtPerson} usePersonBalance={f.usePersonBalance} onUsePersonBalanceChange={f.setUsePersonBalance} personBalance={selectedPerson?.balance} />
					{(f.type === 'income' || f.type === 'transfer') && (
						<HistoricalToggle accent={ACCENT} value={f.isAdjustment} onChange={f.setIsAdjustment} />
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
