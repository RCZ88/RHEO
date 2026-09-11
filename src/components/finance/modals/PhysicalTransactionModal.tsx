import React, { useEffect, useMemo, useState } from 'react'
import { WalletCards } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, OnBehalfOfSection, HistoricalToggle } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { TransferWalletSelect } from './TransferWalletSelect'
import { TransferDestinationPanel } from './TransferDestinationPanel'
import { DenominationPicker } from './DenominationPicker'
import { MerchantCombobox } from '../MerchantCombobox'
import { useCurrencyFormat, parseMeta, sumDenoms, DENOMINATIONS } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#F97316'

export const PhysicalTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income', 'transfer'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useCurrencyFormat(props.displayCurrency)
	const denoms = DENOMINATIONS[props.wallet.currency] ?? DENOMINATIONS.IDR
	const [destWalletId, setDestWalletId] = useState<number | null>(null)
	const [destMetadata, setDestMetadata] = useState<Record<string, any> | null>(null)

	const destWallet = useMemo(() =>
		props.wallets?.find(w => w.id === destWalletId), [props.wallets, destWalletId])

	const onHand: Record<number, number> = useMemo(() => meta.denominations ?? {}, [meta])
	const [counts, setCounts] = useState<Record<number, number>>({})

	const tendered = sumDenoms(counts)
	const effectiveAmt = f.type === 'income' ? f.numericAmount : Math.abs(f.numericAmount || tendered)
	const change = (f.type === 'expense' || f.type === 'transfer') ? Math.max(0, tendered - effectiveAmt) : 0
	const validSpend = f.type === 'income' ? f.numericAmount > 0 : f.numericAmount > 0 && tendered >= f.numericAmount
	const valid = f.type === 'transfer'
		? f.numericAmount > 0 && tendered >= f.numericAmount && !!destWalletId
		: validSpend
	const selectedPerson = f.ftPersonId ? props.ftPersons?.find(p => p.id === f.ftPersonId) : null

	return (
		<TransactionModalShell
			accent={ACCENT} icon={<WalletCards size={18} />} typeBadge="Physical"
			title={props.wallet.name} onClose={props.onClose}
			onSuccess={() => { f.reset(); setCounts({}); setDestWalletId(null); setDestMetadata(null) }}
			onSubmit={async () => {
				f.persistPrefs()
				const next: Record<number, number> = { ...onHand }
				if (f.type === 'expense' || f.type === 'transfer') {
					for (const [d, n] of Object.entries(counts)) next[+d] = (next[+d] ?? 0) - n
				} else {
					for (const [d, n] of Object.entries(counts)) next[+d] = (next[+d] ?? 0) + n
				}
				const extra: Record<string, any> = {
					amount: f.type === 'income' ? f.numericAmount : -effectiveAmt,
					metadata: { denominations: counts, change_kept: change, denomination_after: next },
				}
				if (f.type === 'transfer') {
					extra.to_wallet_id = destWalletId
					extra.fromWalletName = props.wallet.name
					extra.toWalletName = destWallet?.name || 'another wallet'
					extra.description = f.description.trim() || `Transfer to ${destWallet?.name || 'another wallet'}`
					extra.dest_metadata = destMetadata
				}
				return !!(await props.onSubmit(f.buildPayload(extra)))
			}}
		>
			{({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ACCENT}>
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-zinc-400">Wallet total</span>
								<span className="text-xs font-semibold tabular-nums text-white">{format(props.wallet.balance)}</span>
							</div>
							{meta.description && <div className="mt-0.5 text-[11px] text-zinc-500">{meta.description}</div>}
							<div className="mt-0.5 text-[11px] text-zinc-500">
								{Object.entries(onHand).filter(([, n]) => n > 0).map(([d, n]) => `${format(+d)}×${n}`).join('  ·  ') || 'No notes recorded'}
							</div>
						</ContextBand>

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'expense', label: 'Spend' }, { id: 'income', label: 'Deposit' }, { id: 'transfer', label: 'Transfer' }]} />
						<AmountInput accent={ACCENT} value={f.amount} onChange={f.setAmount} symbol={symbol} autoFocus />

						<div>
							<label className="block text-[10px] font-medium text-zinc-400 mb-1">Description</label>
							<input value={f.description} onChange={(e) => f.setDescription(e.target.value)}
								placeholder="What's this for?"
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
						</div>

						<DenominationPicker accent={ACCENT} currency={props.wallet.currency} denoms={denoms}
							counts={counts} onChange={setCounts} format={format}
							autoFillTarget={f.type !== 'income' ? f.numericAmount : undefined} />

						{f.type !== 'income' && (
							<div className="flex items-center justify-between text-xs">
								<span className="text-zinc-400">Change kept</span>
								<span className="tabular-nums font-medium" style={{ color: tendered < f.numericAmount ? '#EF4444' : '#10B981' }}>
									{tendered < f.numericAmount ? 'Insufficient notes selected' : format(change)}
								</span>
							</div>
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
              <TransferDestinationPanel
                destWallet={destWallet}
                accent={ACCENT}
                format={format}
                onMetadataChange={setDestMetadata}
                sourceFee={(() => {
                  const ft = meta.transfer_fee_type;
                  const fv = parseFloat(meta.transfer_fee_value || '0');
                  return ft && ft !== 'none' && fv > 0 ? { type: ft, value: fv } : null;
                })()}
                destFee={(() => {
                  if (!destWallet) return null;
                  const destMeta = parseMeta(destWallet);
                  const ft = destMeta.transfer_fee_type;
                  const fv = parseFloat(destMeta.transfer_fee_value || '0');
                  return ft && ft !== 'none' && fv > 0 ? { type: ft, value: fv } : null;
                })()}
                transferAmount={f.numericAmount}
              />
							</>
						) : (
							<CategoryChipGrid accent={ACCENT} categories={f.categoriesForType} selectedId={f.categoryId} onSelect={f.setCategoryId}
								onCreateCategory={async (data) => { try { const res = await (window as any).deskflowAPI?.financeCreateCategory?.(data); if (res?.id) { f.setCategoryId(res.id); return true; } } catch {} return false; }} categoryType={f.type} />
						)}
						<AmountInput accent={ACCENT} value={f.fee} onChange={f.setFee} symbol={symbol} label={f.type === 'transfer' ? 'Transfer Fee' : 'Transaction Fee'} />
						<div>
							<label className="block text-[10px] font-medium text-zinc-400 mb-1">Merchant / Store</label>
							<MerchantCombobox
								merchants={f.merchants}
								value={f.merchantId || null}
								onChange={(id, name) => { f.setMerchantId(id); f.setMerchant(name); }}
								onAddMerchant={async (name) => { try { const res = await (window as any).deskflowAPI?.financeCreateMerchant?.({ name, account_id: props.wallet.account_id }); if (res?.id) { f.setMerchants((prev: any[]) => [...prev, res].sort((a: any, b: any) => a.name.localeCompare(b.name))); return res.id; } } catch {} return null; }}
								placeholder="e.g. Netflix, Starbucks"
							/>
						</div>
						<OnBehalfOfSection accent={ACCENT} value={f.onBehalfOf} personId={f.ftPersonId} onValueChange={f.setOnBehalfOf} onPersonChange={(id, _name) => f.setFtPersonId(id)} persons={props.ftPersons} onAddPerson={props.onAddFtPerson} usePersonBalance={f.usePersonBalance} onUsePersonBalanceChange={f.setUsePersonBalance} personBalance={selectedPerson?.balance} />
{(f.type === 'income' || f.type === 'transfer') && (
    <HistoricalToggle accent={ACCENT} value={f.isAdjustment} onChange={f.setIsAdjustment} />
)}
						<input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)}
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" />
					</>
				)
			}}
		</TransactionModalShell>
	)
}
