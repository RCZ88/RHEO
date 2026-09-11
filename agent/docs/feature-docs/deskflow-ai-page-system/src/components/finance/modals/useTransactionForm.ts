import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLastType, getLastCategoryId, getLastDate, saveLastTxPrefs } from './txPrefs'
import type { TxModalProps, TxType } from './modalUtils'

export function useTransactionForm(props: TxModalProps, allowedTypes: TxType[]) {
	const walletType = props.wallet.type.replace('_card', '').replace('ewallet', 'ewallet')
	const prefsType = walletType === 'physical' ? 'cash' : walletType === 'other' ? 'bank' : walletType

	const lastType = getLastType(prefsType)
	const lastCat = getLastCategoryId(prefsType)
	const lastDate = getLastDate(prefsType)

	const [type, setType] = useState<TxType>(
		allowedTypes.includes(lastType as TxType) ? (lastType as TxType) : allowedTypes[0],
	)
	const [amount, setAmount] = useState('')
	const [description, setDescription] = useState('')
	const [categoryId, setCategoryId] = useState<number | null>(lastCat)
	const [date, setDate] = useState(lastDate)
	const [note, setNote] = useState('')
	const [showAdvanced, setShowAdvanced] = useState(false)
	const [onBehalfOf, setOnBehalfOf] = useState(false)
	const [onBehalfOfLabel, setOnBehalfOfLabel] = useState('')

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
	}, [])

	const persistPrefs = useCallback(() => {
		saveLastTxPrefs(prefsType, type, categoryId, date || undefined)
	}, [prefsType, type, categoryId, date])

	/** Base payload; modals merge their specialty fields + metadata in. */
	const buildPayload = useCallback((extra: Record<string, any> = {}) => ({
		account_id: props.wallet.account_id,
		wallet_id: props.wallet.id,
		category_id: categoryId,
		type,
		amount: type === 'expense' ? -numericAmount : numericAmount,
		description: description.trim(),
		date,
		note: note.trim() || undefined,
		on_behalf_of: onBehalfOf ? 1 : 0,
		on_behalf_of_label: onBehalfOf && onBehalfOfLabel.trim() ? onBehalfOfLabel.trim() : null,
		...extra,
	}), [props.wallet, categoryId, type, numericAmount, description, date, note, onBehalfOf, onBehalfOfLabel])

	return {
		type, setType, amount, setAmount, numericAmount,
		description, setDescription, categoryId, setCategoryId,
		date, setDate, note, setNote, showAdvanced, setShowAdvanced,
		onBehalfOf, setOnBehalfOf, onBehalfOfLabel, setOnBehalfOfLabel,
		categoriesForType, reset, persistPrefs, buildPayload,
	}
}
