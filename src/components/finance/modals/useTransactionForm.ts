import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLastType, getLastCategoryId, getLastDate, saveLastTxPrefs } from './txPrefs'
import type { TxModalProps, TxType } from './modalUtils'

export function useTransactionForm(props: TxModalProps, allowedTypes: TxType[]) {
	const walletType = props.wallet.type.replace('_card', '').replace('ewallet', 'ewallet')
	const prefsType = walletType === 'physical' ? 'cash' : walletType === 'prepaid' ? 'debit' : walletType === 'other' ? 'bank' : walletType

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
	const [onBehalfOf, setOnBehalfOf] = useState(props.initialOnBehalfOf ?? false)
	const [ftPersonId, setFtPersonId] = useState<number | null>(props.initialFtPersonId ?? null)
	const [ftPersons, setFtPersons] = useState<{ id: number; name: string; email?: string | null; phone?: string | null }[]>(props.ftPersons ?? [])
	const [fee, setFee] = useState('')
	const [merchant, setMerchant] = useState('')
	const [merchantId, setMerchantId] = useState<number | null>(null)
	const [merchants, setMerchants] = useState<{id: number; name: string; account_id?: number | null}[]>([])
	const [isAdjustment, setIsAdjustment] = useState(false)

	useEffect(() => { (window as any).deskflowAPI?.financeGetMerchants?.().then((m: any[]) => setMerchants(m || [])).catch(() => {}) }, [])
	const [usePersonBalance, setUsePersonBalance] = useState(false)

	useEffect(() => {
		if (props.ftPersons?.length) setFtPersons(props.ftPersons)
	}, [props.ftPersons])

	const numericAmount = Number(amount.replace(/[^0-9.]/g, '')) || 0
	const numericFee = Number(fee.replace(/[^0-9.]/g, '')) || 0
	const categoriesForType = useMemo(
		() => props.categories.filter((c) => c.type === type),
		[props.categories, type],
	)

	// reset category when the type switch invalidates it
	useEffect(() => {
		if (categoryId && !categoriesForType.some((c) => c.id === categoryId)) setCategoryId(null)
	}, [categoriesForType, categoryId])

	const reset = useCallback(() => {
		setAmount(''); setDescription(''); setNote(''); setShowAdvanced(false); setFee(''); setMerchant(''); setMerchantId(null); setFtPersonId(null); setIsAdjustment(false)
	}, [])

	const persistPrefs = useCallback(() => {
		saveLastTxPrefs(prefsType, type, categoryId, date || undefined)
	}, [prefsType, type, categoryId, date])

  const ftLabel = ftPersonId
    ? (ftPersons.find(p => p.id === ftPersonId)?.name ?? '')
    : '';

  /** Base payload; modals merge their specialty fields + metadata in. */
  const buildPayload = useCallback((extra: Record<string, any> = {}) => ({
    account_id: props.wallet.account_id,
    wallet_id: props.wallet.id,
    category_id: categoryId,
    type,
    amount: type === 'expense' ? -numericAmount : numericAmount,
    description: description.trim(),
    merchant: merchant.trim() || undefined,
    merchant_id: merchantId,
    date,
    note: note.trim() || undefined,
    on_behalf_of: onBehalfOf ? 1 : 0,
    on_behalf_of_label: onBehalfOf && ftLabel ? ftLabel : null,
    ft_person_id: onBehalfOf ? ftPersonId : null,
    use_person_balance: onBehalfOf && usePersonBalance && ftPersonId ? 1 : 0,
    fee: numericFee,
    is_adjustment: isAdjustment ? 1 : 0,
    ...extra,
  }), [props.wallet, categoryId, type, numericAmount, description, merchant, merchantId, date, note, onBehalfOf, ftPersonId, ftLabel, numericFee, isAdjustment])

	return {
		type, setType, amount, setAmount, numericAmount,
		description, setDescription, 		merchant, setMerchant, merchantId, setMerchantId, merchants, categoryId, setCategoryId,
		date, setDate, note, setNote, showAdvanced, setShowAdvanced,
		onBehalfOf, setOnBehalfOf, ftPersonId, setFtPersonId, ftPersons, setFtPersons,
		fee, setFee, numericFee,
		isAdjustment, setIsAdjustment,
		usePersonBalance, setUsePersonBalance,
		categoriesForType, reset, persistPrefs, buildPayload,
	}
}
