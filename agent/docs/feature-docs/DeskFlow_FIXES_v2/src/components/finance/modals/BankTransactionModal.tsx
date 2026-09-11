import React, { useEffect, useState, useMemo } from 'react'
import { Landmark } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, AdvancedToggle } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { TransferWalletSelect } from './TransferWalletSelect'
import { TransferDestinationPanel } from './TransferDestinationPanel'
import { useCurrencyFormat, parseMeta } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#3B82F6'

export const BankTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income', 'transfer'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useCurrencyFormat(props.displayCurrency)
	const [destWalletId, setDestWalletId] = useState<number | null>(null)
	const [destMetadata, setDestMetadata] = useState<Record<string, any> | null>(null)

	const destWallet = useMemo(() =>
		props.wallets?.find(w => w.id === destWalletId), [props.wallets, destWalletId])

	const valid = f.numericAmount > 0 && (f.type !== 'transfer' || !!destWalletId)

	return (
		<TransactionModalShell
			accent={ACCENT} icon={<Landmark size={18} />} typeBadge="Bank"
			title={props.wallet.name} onClose={props.onClose}
			onSuccess={f.reset}
			onSubmit={async () => {
				f.persistPrefs()
				const extra: Record<string, any> = {}
				if (f.type === 'transfer') {
					Object.assign(extra, {
						to_wallet_id: destWalletId,
						fromWalletName: props.wallet.name,
						toWalletName: destWallet?.name || 'another wallet',
						description: f.description.trim() || `Transfer to ${destWallet?.name || 'another wallet'}`,
						dest_metadata: destMetadata,
					})
				}
				const res = await props.onSubmit(f.buildPayload(extra))
				return !!res
			}}
		>
			{({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ACCENT}>
							<div className="flex items-center justify-between">
								<span className="text-[11px] text-zinc-400">Balance</span>
								<span className="text-xs font-semibold tabular-nums text-white">{format(props.wallet.balance)}</span>
							</div>
							<div className="mt-0.5 flex items-center justify-between text-[11px] text-zinc-500">
								<span>{props.wallet.provider ?? meta.institution ?? 'Bank account'}</span>
								{props.wallet.last_four && <span>•••• {props.wallet.last_four}</span>}
							</div>
						</ContextBand>

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }, { id: 'transfer', label: 'Transfer' }]} />

						<AmountInput accent={ACCENT} value={f.amount} onChange={f.setAmount} symbol={symbol} autoFocus />

						<input value={f.description} onChange={(e) => f.setDescription(e.target.value)}
							placeholder="Description"
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm
								text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />

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
								/>
							</>
						) : (
							<CategoryChipGrid accent={ACCENT} categories={f.categoriesForType} selectedId={f.categoryId} onSelect={f.setCategoryId}
								onCreateCategory={async () => false} categoryType={f.type} />
						)}

						<input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)}
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" />
						<AdvancedToggle open={f.showAdvanced} onToggle={() => f.setShowAdvanced(!f.showAdvanced)} />
						{f.showAdvanced && (
							<textarea value={f.note} onChange={(e) => f.setNote(e.target.value)} rows={2}
								placeholder="Reference number / note"
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
						)}
					</>
				)
			}}
		</TransactionModalShell>
	)
}
