import { useState, useEffect } from 'react'
import { Info, Wallet, WalletCards, PiggyBank } from 'lucide-react'
import { DenominationPicker } from './DenominationPicker'
import { DENOMINATIONS, tint } from './modalUtils'
import type { FinanceWallet } from '../finance-types'

interface Props {
  destWallet: FinanceWallet | null
  accent: string
  format: (n: number) => string
  onMetadataChange: (meta: Record<string, any> | null) => void
  sourceFee?: { type: string; value: number } | null
  destFee?: { type: string; value: number } | null
  transferAmount?: number
}

export function TransferDestinationPanel({ destWallet, accent, format, onMetadataChange, sourceFee, destFee, transferAmount }: Props) {
  const denoms = destWallet?.currency ? (DENOMINATIONS[destWallet.currency] ?? DENOMINATIONS.IDR) : DENOMINATIONS.IDR
  const [destCounts, setDestCounts] = useState<Record<number, number>>({})

  useEffect(() => {
    if (destWallet && (destWallet.type === 'physical' || destWallet.type === 'cash')) {
      onMetadataChange(Object.keys(destCounts).length > 0 ? { denominations: destCounts } : null)
    } else {
      onMetadataChange(null)
    }
  }, [destCounts, destWallet, onMetadataChange])

  useEffect(() => {
    setDestCounts({})
  }, [destWallet?.id])

  if (!destWallet) return null

  const feeRow = sourceFee && transferAmount && transferAmount > 0
    ? (() => {
        const amt = sourceFee.type === 'percentage' ? (transferAmount * sourceFee.value / 100) : sourceFee.value;
        return (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 mt-2">
            <span className="text-xs text-zinc-400">Source wallet fee ({sourceFee.type === 'percentage' ? `${sourceFee.value}%` : format(sourceFee.value)})</span>
            <span className="text-xs text-zinc-200 tabular-nums font-medium">{format(amt)}</span>
          </div>
        );
      })()
    : null;

  const destFeeRow = destFee && transferAmount && transferAmount > 0
    ? (() => {
        const amt = destFee.type === 'percentage' ? (transferAmount * destFee.value / 100) : destFee.value;
        return (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 mt-1">
            <span className="text-xs text-zinc-400">Destination wallet fee ({destFee.type === 'percentage' ? `${destFee.value}%` : format(destFee.value)})</span>
            <span className="text-xs text-zinc-200 tabular-nums font-medium">{format(amt)}</span>
          </div>
        );
      })()
    : null;

  const netReceived = transferAmount && transferAmount > 0
    ? (() => {
        const srcAmt = sourceFee ? (sourceFee.type === 'percentage' ? (transferAmount * sourceFee.value / 100) : sourceFee.value) : 0;
        const dstAmt = destFee ? (destFee.type === 'percentage' ? (transferAmount * destFee.value / 100) : destFee.value) : 0;
        const net = transferAmount - srcAmt - dstAmt;
        return (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 mt-1">
            <span className="text-xs text-emerald-400/80">Received amount</span>
            <span className="text-xs text-emerald-400 tabular-nums font-semibold">{format(net)}</span>
          </div>
        );
      })()
    : null;

  if (destWallet.type === 'physical') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 transition-colors duration-150 hover:brightness-110"
          style={{ borderLeftColor: accent, background: tint(accent, 0.04) }}>
          <WalletCards size={14} style={{ color: accent }} className="shrink-0" />
          <div>
            <p className="text-xs font-medium text-zinc-200">Destination: Physical Wallet</p>
            <p className="text-[10px] text-zinc-500">Count the notes this wallet will receive</p>
          </div>
        </div>
        <DenominationPicker
          accent={accent}
          currency={destWallet.currency}
          denoms={denoms}
          counts={destCounts}
          onChange={setDestCounts}
          format={format}
        />
        {feeRow}
        {destFeeRow}
        {netReceived}
      </div>
    )
  }

  if (destWallet.type === 'cash') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 transition-colors duration-150 hover:brightness-110"
          style={{ borderLeftColor: accent, background: tint(accent, 0.04) }}>
          <PiggyBank size={14} style={{ color: accent }} className="shrink-0" />
          <div>
            <p className="text-xs font-medium text-zinc-200">Destination: Cash Wallet</p>
            <p className="text-[10px] text-zinc-500">Count the cash this wallet will receive</p>
          </div>
        </div>
        <DenominationPicker
          accent={accent}
          currency={destWallet.currency}
          denoms={denoms}
          counts={destCounts}
          onChange={setDestCounts}
          format={format}
        />
        {feeRow}
        {destFeeRow}
        {netReceived}
      </div>
    )
  }

  if (destWallet.type === 'crypto') {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 rounded-lg border border-zinc-700/40 bg-zinc-800/15 px-3.5 py-3 transition-colors duration-150 hover:bg-zinc-800/25"
          style={{ borderLeft: `3px solid ${accent}` }}>
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: tint(accent, 0.12) }}>
            <Wallet size={13} style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-200">Fiat value transfer</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              This transfer sends <strong className="font-medium text-zinc-400">fiat cash value</strong> to the crypto wallet — not cryptocurrency coins.
              The wallet&apos;s balance increases in fiat currency.
            </p>
          </div>
        </div>
        {feeRow}
        {destFeeRow}
        {netReceived}
      </div>
    )
  }

  return feeRow || destFeeRow || netReceived ? <div>{feeRow}{destFeeRow}{netReceived}</div> : null
}
