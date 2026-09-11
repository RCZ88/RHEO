import React, { useEffect, useState, useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, ProgressBar, OnBehalfOfSection } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { TransferWalletSelect } from './TransferWalletSelect'
import { TransferDestinationPanel } from './TransferDestinationPanel'
import { useCurrencyFormat, parseMeta, thresholdColor } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#10B981'

export const DebitTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income', 'transfer'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useCurrencyFormat(props.displayCurrency)
	const [destWalletId, setDestWalletId] = useState<number | null>(null)
	const [destMetadata, setDestMetadata] = useState<Record<string, any> | null>(null)

	const destWallet = useMemo(() =>
		props.wallets?.find(w => w.id === destWalletId), [props.wallets, destWalletId])

	const dailyLimit = Number(meta.daily_limit) || 0
	const spent = (props.todaySpent ?? 0) + (f.type === 'expense' ? f.numericAmount : 0)
	const pct = dailyLimit > 0 ? (spent / dailyLimit) * 100 : 0
	const th = thresholdColor(pct)
	const valid = f.numericAmount > 0 && (f.type !== 'transfer' || !!destWalletId)

	return (
		<TransactionModalShell
			accent={ACCENT} icon={<CreditCard size={18} />} typeBadge="Debit Card"
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
								<span className="text-zinc-400">{props.wallet.provider ?? meta.network ?? 'Debit'} •••• {props.wallet.last_four ?? '—'}</span>
								<span className="tabular-nums text-white">{format(props.wallet.balance)}</span>
							</div>
							{dailyLimit > 0 && (
								<div className="mt-1.5">
									<div className="flex items-center justify-between text-[11px] mb-1">
										<span className="text-zinc-500">Today: {format(spent)} / {format(dailyLimit)}</span>
										<span style={{ color: th.hex }}>{th.label}</span>
									</div>
									<ProgressBar pct={pct} color={th.hex} />
								</div>
							)}
						</ContextBand>

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Refund / Income' }, { id: 'transfer', label: 'Transfer' }]} />
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
                sourceFee={(() => {
                  const ft = meta.transfer_fee_type;
                  const fv = parseFloat(meta.transfer_fee_value || '0');
                  return ft && ft !== 'none' && fv > 0 ? { type: ft, value: fv } : null;
                })()}
                transferAmount={f.numericAmount}
              />
							</>
						) : (
							<CategoryChipGrid accent={ACCENT} categories={f.categoriesForType} selectedId={f.categoryId} onSelect={f.setCategoryId}
								onCreateCategory={async () => false} categoryType={f.type} />
						)}
						{f.type === 'expense' && (
							<OnBehalfOfSection accent={ACCENT} value={f.onBehalfOf} label={f.onBehalfOfLabel} onValueChange={f.setOnBehalfOf} onLabelChange={f.setOnBehalfOfLabel} />
						)}
						<input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)}
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" />
					</>
				)
			}}
		</TransactionModalShell>
	)
}
