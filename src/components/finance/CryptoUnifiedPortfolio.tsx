// ============================================================================
// CryptoUnifiedPortfolio.tsx
// src/components/finance/CryptoUnifiedPortfolio.tsx
// ============================================================================
// Shows fiat balance + crypto portfolio value as a unified view.
// Fixes the critical bug where crypto exchange fiat balances were invisible.
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Coins, Wallet, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CryptoAsset {
  coin_id: string;
  symbol: string;
  name: string;
  amount: number;
  avg_buy_price: number;
  current_price: number;
  value: number;
  cost_basis: number;
  pnl: number;
  pnl_percentage: number;
}

interface CryptoPortfolioData {
  walletId: number;
  walletName: string;
  currency: string;
  fiatBalance: number;
  cryptoPortfolioValue: number;
  totalValue: number;
  costBasis: number;
  unrealizedPnL: number;
  pnlPercentage: number;
  fiatAllocation: number;
  cryptoAllocation: number;
  assets: CryptoAsset[];
}

interface Props {
  walletId: number;
  displayCurrency?: string;
}

const CATEGORY_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#ec4899', '#f97316', '#14b8a6', '#a855f7', '#6366f1',
];

export default function CryptoUnifiedPortfolio({ walletId, displayCurrency = 'IDR' }: Props) {
  const [data, setData] = useState<CryptoPortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await (window as any).deskflowAPI?.financeGetCryptoUnifiedPortfolio(walletId);
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load portfolio');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [walletId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number, cur?: string) => {
    const s = formatCurrency(v);
    return showNumbers ? s : maskNumber(s, maskMode, maskFixedValue);
  };

  // Allocation doughnut chart data
  const allocationChartData: ChartData<'doughnut'> = useMemo(() => {
    if (!data) return { labels: [], datasets: [] };

    return {
      labels: ['Fiat Balance', ...data.assets.map(a => a.symbol.toUpperCase())],
      datasets: [{
        data: [data.fiatBalance, ...data.assets.map(a => a.value)],
        backgroundColor: ['#3b82f6', ...CATEGORY_COLORS.slice(0, data.assets.length)],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };
  }, [data]);

  const allocationChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#e4e4e7',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx) => {
            const val = ctx.raw as number;
            const total = data?.totalValue || 1;
            const pct = ((val / total) * 100).toFixed(1);
            return `${ctx.label}: ${fmtMoney(val)} (${pct}%)`;
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800 animate-pulse">
        <div className="h-6 w-48 bg-zinc-800 rounded mb-4"></div>
        <div className="h-32 bg-zinc-800/50 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-red-900/30">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isProfit = data.unrealizedPnL >= 0;

  return (
    <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Unified Portfolio</h3>
        </div>
        <span className="text-xs text-zinc-500 font-mono">{data.walletName}</span>
      </div>

      {/* Total Value Hero */}
      <div className="text-center mb-6">
        <div className="text-xs text-zinc-500 mb-1">Total Portfolio Value</div>
        <div className="text-3xl font-bold text-zinc-50 tracking-tight">
          {fmtMoney(data.totalValue)}
        </div>
        <div className={`flex items-center justify-center gap-1 mt-1 text-sm font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
          {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{isProfit ? '+' : ''}{showNumbers ? data.unrealizedPnL.toLocaleString() : maskNumber(data.unrealizedPnL, maskMode, maskFixedValue)} ({data.pnlPercentage > 0 ? '+' : ''}{data.pnlPercentage.toFixed(2)}%)</span>
        </div>
      </div>

      {/* Dual Balance Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-blue-400" />
            <span className="text-xs text-zinc-400">Fiat Balance</span>
          </div>
          <div className="text-lg font-semibold text-zinc-100">{fmtMoney(data.fiatBalance)}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{data.fiatAllocation.toFixed(1)}% of portfolio</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={14} className="text-violet-400" />
            <span className="text-xs text-zinc-400">Crypto Value</span>
          </div>
          <div className="text-lg font-semibold text-zinc-100">{fmtMoney(data.cryptoPortfolioValue)}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{data.cryptoAllocation.toFixed(1)}% of portfolio</div>
        </div>
      </div>

      {/* Allocation Chart + Asset List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chart */}
        <div className="relative h-48">
          <Doughnut data={allocationChartData} options={allocationChartOptions} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-[10px] text-zinc-500">Assets</div>
              <div className="text-sm font-bold text-zinc-200">{data.assets.length}</div>
            </div>
          </div>
        </div>

        {/* Asset List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.assets.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              No crypto assets yet
            </div>
          ) : (
            data.assets.map((asset, idx) => (
              <div key={asset.coin_id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}></div>
                  <div>
                    <div className="text-xs font-medium text-zinc-200">{asset.name}</div>
                    <div className="text-[10px] text-zinc-500">{asset.amount.toFixed(6)} {asset.symbol.toUpperCase()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-zinc-200">{fmtMoney(asset.value)}</div>
                  <div className={`text-[10px] ${asset.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {asset.pnl >= 0 ? '+' : ''}{asset.pnl_percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
