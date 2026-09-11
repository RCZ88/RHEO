import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { PieChart } from 'lucide-react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { convertAmount } from './currency-data';
import type { FinanceTransaction } from './finance-types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const WALLET_COLORS: Record<string, string> = {
  bank: '#3B82F6',
  debit_card: '#10B981',
  credit_card: '#F59E0B',
  crypto: '#8B5CF6',
  cash: '#EC4899',
  physical: '#F97316',
  ewallet: '#06B6D4',
  prepaid_card: '#22D3EE',
  investment: '#6366F1',
  other: '#6B7280',
};

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return val.toString();
}

function getMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', IDR: 'Rp', AUD: 'A$', CAD: 'C$', SGD: 'S$',
  };
  return map[currency] || currency + ' ';
}

interface Wallet {
  id: number;
  name: string;
  type: string;
  currency?: string;
}

interface Props {
  transactions: FinanceTransaction[];
  wallets: Wallet[];
  displayCurrency: string;
  baseCurrency: string;
}

type ViewSide = 'income' | 'expense';

export default function WalletBreakdownChart({ transactions, wallets, displayCurrency, baseCurrency }: Props) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [side, setSide] = useState<ViewSide>('expense');

  const rp = (n: number) => {
    const s = `${getCurrencySymbol(displayCurrency)}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    return showNumbers ? s : maskNumber(s, maskMode, maskFixedValue);
  };

  const { months, walletData } = useMemo(() => {
    const nonTransfer = transactions.filter(t => t.type !== 'transfer');
    if (nonTransfer.length === 0) return { months: [], walletData: new Map<string, Map<string, number>>() };

    const walletMap = new Map<number, Wallet>();
    for (const w of wallets) walletMap.set(w.id, w);

    // month -> walletName -> amount
    const data = new Map<string, Map<string, number>>();
    const monthSet = new Set<string>();

    for (const t of nonTransfer) {
      const ym = t.date.slice(0, 7);
      monthSet.add(ym);
      const w = walletMap.get(t.wallet_id);
      const walletName = w?.name || 'Unknown';
      if (!data.has(ym)) data.set(ym, new Map());
      const inner = data.get(ym)!;
      inner.set(walletName, (inner.get(walletName) || 0) + convertAmount(Math.abs(t.amount), t.currency || baseCurrency, displayCurrency));
    }

    const sortedMonths = [...monthSet].sort().slice(-6);
    return { months: sortedMonths, walletData: data };
  }, [transactions, wallets, displayCurrency, baseCurrency]);

  const { labels, datasets } = useMemo(() => {
    if (months.length === 0) return { labels: [], datasets: [] };

    // Collect all wallet names that appear in the selected side
    const walletNamesSet = new Set<string>();
    for (const ym of months) {
      const inner = walletData.get(ym);
      if (!inner) continue;
      for (const [wn] of inner) {
        // Only include wallets that have transactions of the current side type
        const walletTxns = transactions.filter(
          t => t.wallet_id && wallets.find(w => w.id === t.wallet_id)?.name === wn && t.type === side && t.date.startsWith(ym)
        );
        if (walletTxns.length > 0) walletNamesSet.add(wn);
      }
    }
    const walletNames = [...walletNamesSet];

    // Build color map — use wallet type color for known types, fallback to a palette
    const fallbackPalette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#6366F1', '#6B7280'];
    const colorMap = new Map<string, string>();
    walletNames.forEach((wn, i) => {
      const wallet = wallets.find(w => w.name === wn);
      colorMap.set(wn, WALLET_COLORS[wallet?.type] || fallbackPalette[i % fallbackPalette.length]);
    });

    const ds = walletNames.map(wn => ({
      label: wn,
      data: months.map(ym => {
        const inner = walletData.get(ym);
        if (!inner) return 0;
        // Sum all transactions for this wallet in this month matching the side
        return transactions
          .filter(t => t.wallet_id && wallets.find(w => w.id === t.wallet_id)?.name === wn && t.type === side && t.date.startsWith(ym))
          .reduce((sum, t) => sum + convertAmount(Math.abs(t.amount), t.currency || baseCurrency, displayCurrency), 0);
      }),
      backgroundColor: `${colorMap.get(wn)}cc`,
      borderRadius: 3,
      borderSkipped: false,
    }));

    return { labels: months.map(getMonthLabel), datasets: ds };
  }, [months, walletData, transactions, wallets, side, displayCurrency, baseCurrency]);

  if (labels.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <PieChart className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-500">Per-Wallet Breakdown</span>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
          <PieChart className="w-10 h-10 mb-2 opacity-30" />
          <span className="text-xs">No wallet data this period</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-500">Per-Wallet Breakdown</span>
        </div>
        <div className="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-0.5">
          <button
            onClick={() => setSide('expense')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              side === 'expense' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setSide('income')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              side === 'income' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Income
          </button>
        </div>
      </div>

      <div className="relative w-full h-[220px]">
        <Bar
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
                ticks: { color: '#71717a', font: { size: 10, family: 'JetBrains Mono' } },
              },
              y: {
                stacked: true,
                grid: { color: 'rgba(113,113,122,0.08)' },
                ticks: {
                  color: '#71717a',
                  font: { size: 10, family: 'JetBrains Mono' },
                  callback: (v) => formatCompact(Number(v)),
                },
              },
            },
            plugins: {
              legend: {
                position: 'top',
                align: 'end',
                labels: {
                  color: '#a1a1aa',
                  font: { size: 9 },
                  usePointStyle: true,
                  pointStyle: 'circle',
                  boxWidth: 5,
                  padding: 8,
                },
              },
              tooltip: {
                backgroundColor: 'rgba(24,24,27,0.95)',
                titleColor: '#fff',
                bodyColor: '#a1a1aa',
                borderColor: 'rgba(113,113,122,0.3)',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${rp(ctx.parsed.y as number)}`,
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
