import React, { useEffect, useMemo, useState } from 'react'
import { Banknote } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, ProgressBar, OnBehalfOfSection, HistoricalToggle } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { TransferWalletSelect } from './TransferWalletSelect'
import { TransferDestinationPanel } from './TransferDestinationPanel'
import { MerchantCombobox } from '../MerchantCombobox'
import { useCurrencyFormat, tint, parseMeta, thresholdColor } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#06B6D4'

export const EwalletTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income', 'transfer'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useCurrencyFormat(props.displayCurrency)
	const [destWalletId, setDestWalletId] = useState<number | null>(null)
	const [destMetadata, setDestMetadata] = useState<Record<string, any> | null>(null)

	const destWallet = useMemo(() =>
		props.wallets?.find(w => w.id === destWalletId), [props.wallets, destWalletId])

	const linked: string[] = meta.linked_methods ?? []
	const [source, setSource] = useState(linked[0] ?? '')
	const dailyLimit = Number(meta.daily_limit) || 0
	const pct = dailyLimit > 0 ? (f.numericAmount / dailyLimit) * 100 : 0
	const th = thresholdColor(pct)
	const valid = f.numericAmount > 0 && (f.type !== 'transfer' || !!destWalletId)
	const selectedPerson = f.ftPersonId ? props.ftPersons?.find(p => p.id === f.ftPersonId) : null

	return (
		<TransactionModalShell
			accent={ACCENT} icon={<Banknote size={18} />} typeBadge="E-Wallet"
			title={props.wallet.name} onClose={props.onClose} onSuccess={f.reset}
			onSubmit={async () => {
				f.persistPrefs()
				if (f.type === 'transfer') {
					return !!(await props.onSubmit(f.buildPayload({
						to_wallet_id: destWalletId,
						fromWalletName: props.wallet.name,
						toWalletName: destWallet?.name || 'another wallet',
						description: f.description.trim() || `Transfer to ${destWallet?.name || 'another wallet'}`,
						dest_metadata: destMetadata,
					})))
				}
				return !!(await props.onSubmit(f.buildPayload(
					f.type === 'income' && source ? { metadata: { topup_source: source } } : {},
				)))
			}}
		>
			{({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ACCENT}>
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium text-white">{props.wallet.provider ?? meta.platform ?? 'E-Wallet'}</span>
								<span className="text-xs tabular-nums text-zinc-300">{format(props.wallet.balance)}</span>
							</div>
							{linked.length > 0 && (
								<div className="mt-1 flex flex-wrap gap-1">
									{linked.map((m) => (
										<span key={m} className="rounded-full px-2 py-0.5 text-[10px]"
											style={{ background: tint(ACCENT, 0.1), color: ACCENT, border: `1px solid ${tint(ACCENT, 0.2)}` }}>{m}</span>
									))}
								</div>
							)}
							{dailyLimit > 0 && f.numericAmount > 0 && (
								<div className="mt-1.5"><ProgressBar pct={pct} color={th.hex} /></div>
							)}
						</ContextBand>

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'expense', label: 'Pay' }, { id: 'income', label: 'Top-up' }, { id: 'transfer', label: 'Transfer' }]} />
						<AmountInput accent={ACCENT} value={f.amount} onChange={f.setAmount} symbol={symbol} autoFocus />

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

						{f.type === 'transfer' ? (
							<>
								<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Description"
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
						) : f.type === 'income' && linked.length > 0 ? (
							<select value={source} onChange={(e) => setSource(e.target.value)}
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none">
								{linked.map((m) => <option key={m} value={m}>Top-up from {m}</option>)}
							</select>
						) : (
							<>
								<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Description"
									className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
								<CategoryChipGrid accent={ACCENT} categories={f.categoriesForType} selectedId={f.categoryId} onSelect={f.setCategoryId}
									onCreateCategory={async (data) => { try { const res = await (window as any).deskflowAPI?.financeCreateCategory?.(data); if (res?.id) { f.setCategoryId(res.id); return true; } } catch {} return false; }} categoryType={f.type} />
							</>
						)}

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
