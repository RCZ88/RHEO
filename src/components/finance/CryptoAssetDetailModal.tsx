import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Calendar, Gem, Wallet } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency, formatAmount } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import type { FinanceTransaction } from './finance-types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface AssetHistoryPoint {
  coinId: string; amount: number; avgBuyPrice: number; fiatValue: number; date: string;
}

interface CryptoAssetDetailModalProps {
  open: boolean;
  onClose: () => void;
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  priceChange24h: number | null;
  displayCurrency: string;
  transactions: FinanceTransaction[];
  walletId?: number;
}

export function CryptoAssetDetailModal({
  open, onClose, coinId, symbol, name, amount, avgBuyPrice, currentPrice, priceChange24h, displayCurrency, transactions, walletId,
}: CryptoAssetDetailModalProps) {
  const fc = (v: number) => formatCurrency(v, displayCurrency);
  const fa = (v: number) => formatAmount(v);
  const sym = symbol.toUpperCase();
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number, cur?: string) => {
    const s = fc(v);
    return showNumbers ? s : maskNumber(s, maskMode, maskFixedValue);
  };
  const [showAllWallets, setShowAllWallets] = useState(false);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryPoint[]>([]);
  const [activeChart, setActiveChart] = useState<'quantity' | 'fiat'>('quantity');

  // Build quantity timeline dynamically from transactions (sorted by date ASC)
  const quantityTimeline = useMemo(() => {
    const coinTxns = transactions.filter(t => {
      if (!t.metadata) return false;
      try {
        const m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
        const mCoinId = m.coinId || m.coin_id || '';
        if (mCoinId !== coinId) return false;
        if (!showAllWallets && walletId && t.wallet_id !== walletId) return false;
        return m.qty != null;
      } catch { return false; }
    });

    coinTxns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningQty = 0;
    const points: { date: string; qty: number }[] = [];

    if (coinTxns.length > 0) {
      points.push({ date: '1900-01-01', qty: 0 });
    }

    for (const t of coinTxns) {
      const m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
      let delta = Number(m.qty) || 0;

      const isDecrease = (t.type === 'income') || (t.type === 'transfer' && t.amount < 0);
      if (isDecrease) {
        delta = -Math.abs(delta);
      } else {
        delta = Math.abs(delta);
      }

      runningQty += delta;
      points.push({ date: t.date, qty: runningQty });
    }

    return points;
  }, [transactions, coinId, showAllWallets, walletId]);

  // Fiat value timeline from quantityTimeline + assetHistory price data
  const fiatValueTimeline = useMemo(() => {
    if (!quantityTimeline.length) return [];
    return quantityTimeline.map(p => {
      const histPt = assetHistory.find(h => h.date === p.date);
      return { date: p.date, fiatValue: histPt ? histPt.fiatValue : p.qty * currentPrice };
    });
  }, [quantityTimeline, assetHistory, currentPrice]);

  const quantityChartData = useMemo(() => {
    if (!quantityTimeline.length) return null;
    const accent = '#8B5CF6';
    return {
      labels: quantityTimeline.map((p, i) => {
        if (i === 0) return '';
        const d = new Date(p.date + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: `${sym} Quantity`,
        data: quantityTimeline.map(p => p.qty),
        borderColor: accent,
        backgroundColor: accent + '20',
        fill: true,
        tension: 0.3,
        pointRadius: quantityTimeline.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      }],
    };
  }, [quantityTimeline, sym]);

  const fiatValueChartData = useMemo(() => {
    if (!fiatValueTimeline.length) return null;
    const accent = '#F59E0B';
    return {
      labels: fiatValueTimeline.map((p, i) => {
        if (i === 0) return '';
        const d = new Date(p.date + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: `${sym} Fiat Value`,
        data: fiatValueTimeline.map(p => p.fiatValue),
        borderColor: accent,
        backgroundColor: accent + '20',
        fill: true,
        tension: 0.3,
        pointRadius: fiatValueTimeline.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      }],
    };
  }, [fiatValueTimeline, sym]);

  const chartOptions = (isFiat: boolean) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24,24,27,0.95)',
        borderColor: 'rgba(113,113,122,0.3)',
        borderWidth: 1,
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        padding: 8,
        callbacks: {
          label: (ctx: any) => isFiat ? `${fmtMoney(ctx.raw)}` : `${formatAmount(ctx.raw)} ${sym}`,
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { color: 'rgba(113,113,122,0.1)' },
        ticks: { color: '#71717a', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 6, maxRotation: 0 },
      },
      y: {
        display: true,
        grid: { color: 'rgba(113,113,122,0.1)' },
        ticks: {
          color: '#71717a',
          font: { family: 'JetBrains Mono', size: 9 },
          callback: (v: any) => isFiat ? fmtMoney(v) : formatAmount(v),
        },
      },
    },
  });

  const purchases = useMemo(() => {
    return transactions.filter(t => {
      if (!t.metadata) return false;
      try {
        const m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
        const mCoinId = m.coinId || m.coin_id || '';
        if (mCoinId !== coinId) return false;
        if (!showAllWallets && walletId && t.wallet_id !== walletId) return false;
        return true;
      } catch { return false; }
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, coinId, showAllWallets, walletId]);

  const totalCostBasis = amount * avgBuyPrice;
  const currentValue = amount * currentPrice;
  const totalPnl = currentValue - totalCostBasis;
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;
  const totalFiatSpent = purchases.reduce((s, t) => {
    if (t.type === 'expense') return s + Math.abs(t.amount);
    if (t.type === 'income') return s - Math.abs(t.amount);
    if (t.type === 'transfer' && t.amount < 0) return s + Math.abs(t.amount);
    if (t.type === 'transfer' && t.amount > 0) return s - Math.abs(t.amount);
    return s;
  }, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/50 rounded-xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center">
                  <Gem className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">{sym}</h2>
                    {name && name !== sym && <span className="text-xs text-zinc-500">{name}</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{purchases.length} transaction{purchases.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 p-5">
              <GlassSurface tier={2} className="p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Holdings</div>
                <div className="text-sm font-semibold text-white tabular-nums">{fa(amount)} {sym}</div>
              </GlassSurface>
              <GlassSurface tier={2} className="p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Current Price</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white tabular-nums">{fmtMoney(currentPrice)}</span>
                  {priceChange24h !== null && (
                    <span className={`text-[10px] tabular-nums ${priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(1)}%
                    </span>
                  )}
                </div>
              </GlassSurface>
              <GlassSurface tier={2} className="p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Cost Basis</div>
                <div className="text-sm font-semibold text-white tabular-nums">{fmtMoney(totalCostBasis)}</div>
                <div className="text-[10px] text-zinc-500 tabular-nums mt-0.5">avg {fmtMoney(avgBuyPrice)}/{sym}</div>
              </GlassSurface>
              <GlassSurface tier={2} className="p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Market Value</div>
                <div className="text-sm font-semibold text-white tabular-nums">{fmtMoney(currentValue)}</div>
                <div className={`text-[10px] tabular-nums mt-0.5 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{fmtMoney(totalPnl)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%)
                </div>
              </GlassSurface>
            </div>

            {/* Charts */}
            {quantityTimeline.length > 1 && (
              <div className="px-5 pb-3">
                <div className="flex gap-1 mb-2">
                  <button onClick={() => setActiveChart('quantity')}
                    className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${activeChart === 'quantity' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    Quantity
                  </button>
                  <button onClick={() => setActiveChart('fiat')}
                    className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${activeChart === 'fiat' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    Fiat Value
                  </button>
                </div>
                <div className="h-36 bg-zinc-800/30 rounded-lg p-2">
                  {activeChart === 'quantity' && quantityChartData && (
                    <Line data={quantityChartData} options={chartOptions(false) as any} />
                  )}
                  {activeChart === 'fiat' && fiatValueChartData && (
                    <Line data={fiatValueChartData} options={chartOptions(true) as any} />
                  )}
                </div>
              </div>
            )}

            {/* Purchase History */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Purchase History</div>
                {walletId && (
                  <button onClick={() => setShowAllWallets(v => !v)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${showAllWallets ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    <Wallet className="w-2.5 h-2.5" />
                    {showAllWallets ? 'All wallets' : 'This wallet'}
                  </button>
                )}
              </div>
              {purchases.length === 0 ? (
                <div className="text-center py-8">
                  <Gem className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No transactions found for this coin</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {purchases.map(txn => {
                    let coinQty = 0, coinPrice = 0, coinFee = 0, coinType = txn.type;
                    try {
                      const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
                      coinQty = Number(m.qty) || 0;
                      coinPrice = Number(m.price) || 0;
                      coinFee = Number(m.fee) || 0;
                    } catch { /* ignore */ }

                    const isExpense = txn.type === 'expense' || (txn.type === 'transfer' && txn.amount < 0);
                    const isIncome = txn.type === 'income' || (txn.type === 'transfer' && txn.amount > 0);

                    return (
                      <div key={txn.id} className="flex items-center gap-3 py-2.5 px-3 bg-zinc-800/20 rounded-lg">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isExpense ? 'bg-red-500/15' : isIncome ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                          {isExpense ? (
                            <ArrowDownRight className="w-4 h-4 text-red-400" />
                          ) : isIncome ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-300 font-medium truncate">{txn.description || (isExpense ? 'Buy' : isIncome ? 'Sell' : 'Transfer')}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-2.5 h-2.5 text-zinc-600" />
                            <span className="text-[10px] text-zinc-500">{new Date(txn.date).toLocaleDateString()}</span>
                            {coinFee > 0 && (
                              <span className="text-[10px] text-red-400/70">fee: {fa(coinFee)} {sym}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-semibold tabular-nums ${isExpense ? 'text-red-400' : isIncome ? 'text-emerald-400' : 'text-white'}`}>
                            {isExpense ? '-' : isIncome ? '+' : ''}{coinQty > 0 ? fa(coinQty) : fa(Math.abs(txn.amount))} {sym}
                          </div>
                          {coinPrice > 0 && (
                            <div className="text-[10px] text-zinc-500 tabular-nums">@ {fmtMoney(coinPrice)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
