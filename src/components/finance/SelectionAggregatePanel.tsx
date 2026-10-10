import type React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, Tag, Download, X, Handshake, CircleCheck } from 'lucide-react'
import { GlassSurface } from './_fx/GlassSurface'
import { Sparkline } from './_fx/Sparkline'
import { AnimatedAmount } from './_fx/AnimatedAmount'
import { formatCurrency } from './currency-data'
import { useNumberMask } from '../../context/NumberMaskContext'
import { maskNumber } from '../../utils/maskNumber'
import { DUR } from './_fx/financeMotion'
import type {
  AggregateData,
  CategorySlice,
  WalletSlice,
} from './_fx/useSelectionAggregate'

const EASE = [0.16, 1, 0.3, 1] as const

const panelMotion = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 24 },
  transition: { duration: DUR?.ENTRANCE ?? 0.24, ease: EASE },
}

interface Props {
  open: boolean
  data: AggregateData
  currency: string
  busy?: boolean
  onClear: () => void
  onDelete: () => void
  onRecategorize: () => void
  onExport: () => void
  onSetFollowThrough?: (value: 0 | 1) => void
  onMarkRepaid?: () => void
  hasUnrepaidFT?: boolean
}

export function SelectionAggregatePanel(props: Props) {
  const { open, data, currency, busy, onClear, onDelete, onRecategorize, onExport, onSetFollowThrough, onMarkRepaid, hasUnrepaidFT } = props
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask()
  const netPositive = data.net >= 0
  const masked = (v: number) => maskNumber(formatCurrency(v, currency), maskMode, maskFixedValue)

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="agg-panel" {...panelMotion} className="sticky bottom-0 z-10 mt-3">
          <GlassSurface className="rounded-t-xl border-t border-white/5 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-4 pr-20">
            {/* selection bar */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold tabular-nums">
                  {data.count} selected
                </span>
                {data.isMixed && (
                  <span className="text-[11px] text-zinc-500 tabular-nums">
                    {data.count} of {data.totalVisible}
                  </span>
                )}
                <span className="text-[11px] text-zinc-500">
                  Ctrl/Cmd+A to select all · Esc to clear
                </span>
              </div>
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear selection"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* row 1 — stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Transactions" tone="neutral">
                <AnimatedAmount value={data.count} formatter={(v) => String(v)} />
              </StatCard>
              <StatCard label="Inflow" tone="positive">
                {showNumbers ? <AnimatedAmount value={data.inflow} currency={currency} formatter={formatCurrency} /> : <span>{masked(data.inflow)}</span>}
              </StatCard>
              <StatCard label="Outflow" tone="negative">
                {showNumbers ? <AnimatedAmount value={data.outflow} currency={currency} formatter={formatCurrency} /> : <span>{masked(data.outflow)}</span>}
              </StatCard>
              <StatCard label="Net (P/L)" tone={netPositive ? 'positive' : 'negative'}>
                {showNumbers
                  ? <AnimatedAmount value={data.net} currency={currency} formatter={(v, c) => {
                    const sign = v >= 0 ? '+' : ''
                    return sign + formatCurrency(v, c)
                  }} />
                  : <span>{masked(data.net)}</span>}
              </StatCard>
            </div>

            {/* row 2 — breakdowns + daily sparkline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
              <BreakdownList title="By category" slices={data.byCategory} currency={currency} kind="category" showNumbers={showNumbers} maskMode={maskMode} maskFixedValue={maskFixedValue} />
              <BreakdownList title="By wallet" slices={data.byWallet} currency={currency} kind="wallet" showNumbers={showNumbers} maskMode={maskMode} maskFixedValue={maskFixedValue} />
              <div className="rounded-xl border border-white/5 bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 mb-2">Daily net</p>
                {data.daily.length > 0 ? (
                  <Sparkline data={data.daily.map((d) => d.net)} className="h-12 w-full" color="#6ee7b7" width={300} height={48} />
                ) : (
                  <p className="text-[12px] text-zinc-600">No dated activity in selection.</p>
                )}
                {data.dateRange && (
                  <p className="text-[11px] text-zinc-500 mt-2 tabular-nums">
                    {data.dateRange.from} → {data.dateRange.to}
                  </p>
                )}
              </div>
            </div>

            {/* batch actions */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <BatchButton icon={Tag} label="Recategorize" onClick={onRecategorize} disabled={busy} />
              {onSetFollowThrough && (
                <BatchButton icon={Handshake} label="Set Follow Through" onClick={() => onSetFollowThrough(1)} disabled={busy} />
              )}
              {onMarkRepaid && hasUnrepaidFT && (
                <BatchButton icon={CircleCheck} label="Mark Repaid" onClick={onMarkRepaid} disabled={busy} />
              )}
              <BatchButton icon={Download} label="Export CSV" onClick={onExport} disabled={busy} />
              <BatchButton icon={Trash2} label={`Delete ${data.count}`} onClick={onDelete} disabled={busy} danger />
            </div>
          </GlassSurface>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatCard({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'neutral' | 'positive' | 'negative'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : 'text-zinc-100'
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{children}</p>
    </div>
  )
}

function BreakdownList({
  title,
  slices,
  currency,
  kind,
  showNumbers,
  maskMode,
  maskFixedValue,
}: {
  title: string
  slices: Array<CategorySlice | WalletSlice>
  currency: string
  kind: 'category' | 'wallet'
  showNumbers: boolean
  maskMode: 'digits' | 'fixed'
  maskFixedValue: number | null
}) {
  const top = slices.slice(0, 5)
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950 light:bg-[var(--ws-surface)]/40 p-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 mb-2">{title}</p>
      {top.length === 0 ? (
        <p className="text-[12px] text-zinc-600">No expenses in selection.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((s) => {
            const isCat = kind === 'category'
            const color = isCat ? (s as CategorySlice).color : '#10b981'
            const name = isCat ? (s as CategorySlice).name : (s as WalletSlice).name
            const rowKey = isCat
              ? `c-${(s as CategorySlice).categoryId}`
              : `w-${(s as WalletSlice).walletId}`
            return (
              <li key={rowKey} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-zinc-300">{name}</span>
                  </span>
                  <span className="tabular-nums text-zinc-400">{showNumbers ? formatCurrency(s.total, currency) : maskNumber(formatCurrency(s.total, currency), maskMode, maskFixedValue)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ width: `${Math.round(s.pct * 100)}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function BatchButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  const base =
    'flex items-center gap-2 h-11 px-3.5 rounded-xl text-[13px] font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2'
  const skin = danger
    ? 'border-red-500/30 text-red-300 hover:bg-red-500/10 focus-visible:ring-red-500/40'
    : 'border-white/10 text-zinc-200 hover:bg-white/5 focus-visible:ring-emerald-500/40'
  const off = disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${skin} ${off}`}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}
