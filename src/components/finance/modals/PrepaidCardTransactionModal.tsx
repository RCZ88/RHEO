import React, { useEffect, useState, useMemo } from 'react'
import { Nfc } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, OnBehalfOfSection, HistoricalToggle } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { TransferWalletSelect } from './TransferWalletSelect'
import { TransferDestinationPanel } from './TransferDestinationPanel'
import { MerchantCombobox } from '../MerchantCombobox'
import { useCurrencyFormat, parseMeta } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#22D3EE'

export const PrepaidCardTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income', 'transfer'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useCurrencyFormat(props.displayCurrency)
	const [destWalletId, setDestWalletId] = useState<number | null>(null)
	const [destMetadata, setDestMetadata] = useState<Record<string, any> | null>(null)

	const destWallet = useMemo(() =>
		props.wallets?.find(w => w.id === destWalletId), [props.wallets, destWalletId])

	const valid = f.numericAmount > 0 && (f.type !== 'transfer' || !!destWalletId)
	const selectedPerson = f.ftPersonId ? props.ftPersons?.find(p => p.id === f.ftPersonId) : null

	return (
		<TransactionModalShell
			accent={ACCENT} icon={<Nfc size={18} />} typeBadge="Prepaid Card"
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
				return !!(await props.onSubmit(f.buildPayload()))
			}}
		>
			{({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ACCENT}>
							<div className="flex items-center justify-between text-[11px]">
								<span className="text-zinc-400">{props.wallet.provider ?? meta.provider ?? 'Prepaid'} •••• {props.wallet.last_four ?? '—'}</span>
								<span className="tabular-nums text-white">{format(props.wallet.balance)}</span>
							</div>
						</ContextBand>

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'expense', label: 'Spend' }, { id: 'income', label: 'Top-Up' }, { id: 'transfer', label: 'Transfer' }]} />
						<AmountInput accent={ACCENT} value={f.amount} onChange={f.setAmount} symbol={symbol} autoFocus />
						<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Description"
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
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
									sourceFee={null}
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
								placeholder="e.g. Transit, Convenience Store"
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
