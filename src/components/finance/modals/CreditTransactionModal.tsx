import React, { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { TransactionModalShell } from './TransactionModalShell'
import { useTransactionForm } from './useTransactionForm'
import { ContextBand, TypeToggle, AmountInput, AdvancedToggle, ProgressBar, OnBehalfOfSection, HistoricalToggle } from './modalParts'
import { CategoryChipGrid } from './CategoryChipGrid'
import { useCurrencyFormat, parseMeta, thresholdColor } from './modalUtils'
import type { TxModalProps } from './modalUtils'

const ACCENT = '#F59E0B'

export const CreditTransactionModal: React.FC<TxModalProps> = (props) => {
	const f = useTransactionForm(props, ['expense', 'income'])
	const meta = parseMeta(props.wallet)
	const { format, symbol } = useCurrencyFormat(props.displayCurrency)
	const [installments, setInstallments] = useState(1)

	const limit = Number(meta.credit_limit) || 0
	const owed = Math.abs(props.wallet.balance)
	const projectedOwed = f.type === 'expense' ? owed + f.numericAmount : Math.max(0, owed - f.numericAmount)
	const pct = limit > 0 ? (projectedOwed / limit) * 100 : 0
	const th = thresholdColor(pct)
	const available = Math.max(0, limit - projectedOwed)
	const valid = f.numericAmount > 0
	const selectedPerson = f.ftPersonId ? props.ftPersons?.find(p => p.id === f.ftPersonId) : null

	return (
		<TransactionModalShell
			accent={ACCENT} icon={<CreditCard size={18} />} typeBadge="Credit Card"
			title={props.wallet.name} onClose={props.onClose} onSuccess={f.reset}
			onSubmit={async () => {
				f.persistPrefs()
				return !!(await props.onSubmit(f.buildPayload(
					f.type === 'expense' && installments > 1 ? { metadata: { installments } } : {},
				)))
			}}
		>
			{({ setCanSubmit }) => {
				useEffect(() => setCanSubmit(valid), [valid, setCanSubmit])
				return (
					<>
						<ContextBand accent={ACCENT}>
							<div className="flex items-center justify-between text-[11px] mb-1">
								<span className="text-zinc-400">Utilization</span>
								<span style={{ color: th.hex }}>{pct.toFixed(0)}% · {th.label}</span>
							</div>
							<ProgressBar pct={pct} color={th.hex} />
							<div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
								<span>Available {format(available)}</span>
								{meta.statement_balance != null && (
									<span>Stmt {format(Number(meta.statement_balance))}{meta.due_date ? ` · due ${meta.due_date}` : ''}</span>
								)}
							</div>
						</ContextBand>

						<TypeToggle accent={ACCENT} value={f.type} onChange={f.setType}
							options={[{ id: 'expense', label: 'Purchase' }, { id: 'income', label: 'Payment' }]} />
						<AmountInput accent={ACCENT} value={f.amount} onChange={f.setAmount} symbol={symbol} autoFocus />
						<input value={f.description} onChange={(e) => f.setDescription(e.target.value)} placeholder="Description"
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
						<CategoryChipGrid accent={ACCENT} categories={f.categoriesForType} selectedId={f.categoryId} onSelect={f.setCategoryId}
							onCreateCategory={async (data) => { try { const res = await (window as any).deskflowAPI?.financeCreateCategory?.(data); if (res?.id) { f.setCategoryId(res.id); return true; } } catch {} return false; }} categoryType={f.type} />

						<div>
							<label className="block text-[10px] font-medium text-zinc-400 mb-1">Merchant / Store</label>
							<input value={f.merchant} onChange={e => f.setMerchant(e.target.value)}
								placeholder="e.g. Netflix, Starbucks, Amazon"
								className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
						</div>

						<AmountInput accent={ACCENT} value={f.fee} onChange={f.setFee} symbol={symbol} label={f.type === 'transfer' ? 'Transfer Fee' : 'Transaction Fee'} />

						<OnBehalfOfSection accent={ACCENT} value={f.onBehalfOf} personId={f.ftPersonId} onValueChange={f.setOnBehalfOf} onPersonChange={(id, _name) => f.setFtPersonId(id)} persons={props.ftPersons} onAddPerson={props.onAddFtPerson} usePersonBalance={f.usePersonBalance} onUsePersonBalanceChange={f.setUsePersonBalance} personBalance={selectedPerson?.balance} />
{(f.type === 'income' || f.type === 'transfer') && (
    <HistoricalToggle accent={ACCENT} value={f.isAdjustment} onChange={f.setIsAdjustment} />
)}
						<input type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)}
							className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500" />
						<AdvancedToggle open={f.showAdvanced} onToggle={() => f.setShowAdvanced(!f.showAdvanced)} />
						{f.showAdvanced && (
							<>
								{f.type === 'expense' && (
									<label className="flex items-center justify-between text-xs text-zinc-400">
										Installments
										<select value={installments} onChange={(e) => setInstallments(Number(e.target.value))}
											className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-2 py-1.5 text-white outline-none">
											{[1, 3, 6, 12, 24].map((n) => <option key={n} value={n}>{n === 1 ? 'None' : `${n}×`}</option>)}
										</select>
									</label>
								)}
								{installments > 1 && (
									<div className="text-[11px] text-zinc-500 tabular-nums">
										{format(f.numericAmount / installments)} / month for {installments} months
									</div>
								)}
							</>
						)}
					</>
				)
			}}
		</TransactionModalShell>
	)
}
