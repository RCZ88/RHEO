import React, { useEffect, useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js';
import {
  HeartPulse, TrendingDown, TrendingUp, AlertTriangle,
  Activity, Receipt, CreditCard, Wallet, Coins, Smartphone,
  Landmark, Banknote, Package, Nfc
} from 'lucide-react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface WalletAlert {
  type: string;
  message: string;
  severity: 'warning' | 'critical' | 'info';
}

interface SparkPoint {
  date: string;
  balance: number;
}

interface WalletHealth {
  walletId: number;
  name: string;
  type: string;
  balance: number;
  currency: string;
  healthScore: number;
  balanceDrift: number;
  transactionFrequency: number;
  feeBurden: number;
  sparklineData: SparkPoint[];
  alerts: WalletAlert[];
  lastActivity: string | null;
  avgDailySpend: number;
}

interface WalletHealthData {
  wallets: WalletHealth[];
  overallScore: number;
  totalBalance: number;
}

const WALLET_ICONS: Record<string, any> = {
  cash: Banknote, physical: Wallet, crypto: Coins, investment: Coins,
  debit: CreditCard, credit: CreditCard, ewallet: Smartphone, bank: Landmark,
  prepaid_card: Nfc,
};

const WALLET_COLORS: Record<string, string> = {
  cash: '#F97316', physical: '#F97316', crypto: '#8B5CF6', investment: '#8B5CF6',
  debit: '#3B82F6', credit: '#EF4444', ewallet: '#06B6D4', bank: '#10B981',
  prepaid_card: '#22D3EE',
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/5 border-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/5 border-amber-500/20';
  if (score >= 40) return 'bg-orange-500/5 border-orange-500/20';
  return 'bg-red-500/5 border-red-500/20';
}

function getScoreRing(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function WalletHealthScorecards() {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [data, setData] = useState<WalletHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fmtMoney = (v: number) =>
    showNumbers ? formatCurrency(v) : maskNumber(formatCurrency(v), maskMode, maskFixedValue);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await (window as any).deskflowAPI?.financeGetWalletHealth?.();
        if (result?.success) {
          setData(result.data);
        } else {
          setError(result?.error || 'Failed to load wallet health');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-zinc-900/80 backdrop-blur-xl rounded-xl p-5 border border-zinc-800 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 bg-zinc-800 rounded" />
          <div className="h-4 w-32 bg-zinc-800 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-zinc-800/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/80 backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-medium text-zinc-300">Wallet Health</span>
        </div>
        <p className="text-xs text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!data || data.wallets.length === 0) return (
    <div className="rounded-xl border border-zinc-700/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <HeartPulse size={18} className="text-rose-400" />
        <h3 className="text-sm font-semibold text-zinc-100">Wallet Health</h3>
      </div>
      <p className="text-xs text-zinc-500">No wallets to analyze. Create wallets to see health scores.</p>
    </div>
  );

  const overallScore = Number.isFinite(data.overallScore) ? data.overallScore : 0;

  return (
    <div className="rounded-xl border border-zinc-700/30 p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HeartPulse size={18} className="text-rose-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Wallet Health Scorecards</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}
          </span>
          <span className="text-[10px] text-zinc-500">overall</span>
        </div>
      </div>

      {/* Scorecard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.wallets.map((wallet) => {
          const Icon = WALLET_ICONS[wallet.type] || Wallet;
          const color = WALLET_COLORS[wallet.type] || '#71717a';
          const scoreColor = getScoreColor(wallet.healthScore);
          const scoreBg = getScoreBg(wallet.healthScore);
          const scoreRing = getScoreRing(wallet.healthScore);
          const freqPerDay = Number.isFinite(wallet.transactionFrequency) ? wallet.transactionFrequency : 0;
          const dailySpend = Number.isFinite(wallet.avgDailySpend) ? wallet.avgDailySpend : 0;

          // Sparkline chart
          const sparklineData: ChartData<'line'> = {
            labels: wallet.sparklineData.map(d => d.date.slice(5)),
            datasets: [{
              data: wallet.sparklineData.map(d => d.balance),
              borderColor: color,
              backgroundColor: `${color}10`,
              borderWidth: 1.5,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
            }],
          };

          const sparklineOptions: ChartOptions<'line'> = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { display: false },
              y: { display: false },
            },
          };

          return (
            <div
              key={wallet.walletId}
              className={`rounded-lg p-4 border ${scoreBg} transition-all hover:border-zinc-700`}
            >
              {/* Top Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{wallet.name}</div>
                    <div className="text-[10px] text-zinc-500 capitalize">{wallet.type.replace('_', ' ')}</div>
                  </div>
                </div>

                {/* Score Ring */}
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#27272a" strokeWidth="3" />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={scoreRing}
                      strokeWidth="3"
                      strokeDasharray={`${wallet.healthScore}, 100`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor}`}>
                    {wallet.healthScore}
                  </div>
                </div>
              </div>

              {/* Balance + Sparkline */}
              <div className="flex items-end justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-zinc-100">{fmtMoney(wallet.balance)}</div>
                  <div className={`text-[10px] flex items-center gap-0.5 ${wallet.balanceDrift >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {wallet.balanceDrift >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {wallet.balanceDrift >= 0 ? '+' : ''}{wallet.balanceDrift.toFixed(1)}% drift
                  </div>
                </div>
                <div className="w-20 h-8">
                  <Line data={sparklineData} options={sparklineOptions} />
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-700/30">
                <div className="text-center" title="Average transactions per day over the last 30 days">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Activity size={10} className="text-zinc-500" />
                    <span className="text-[9px] text-zinc-500">Freq</span>
                  </div>
                  <div className="text-xs font-medium text-zinc-300">{freqPerDay.toFixed(1)}/d</div>
                </div>
                <div className="text-center" title="Total fees as a share of transaction volume (last 30 days)">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Receipt size={10} className="text-zinc-500" />
                    <span className="text-[9px] text-zinc-500">Fees</span>
                  </div>
                  <div className="text-xs font-medium text-zinc-300">{Number.isFinite(wallet.feeBurden) ? `${wallet.feeBurden.toFixed(1)}%` : '0%'}</div>
                </div>
                <div className="text-center" title="Average daily spending over the last 30 days (expenses only, excludes adjustments)">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Wallet size={10} className="text-zinc-500" />
                    <span className="text-[9px] text-zinc-500">Daily</span>
                  </div>
                  <div className="text-xs font-medium text-zinc-300">{fmtMoney(dailySpend)}</div>
                </div>
              </div>

              {/* Alerts */}
              {wallet.alerts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {wallet.alerts.slice(0, 2).map((alert, i) => (
                    <div key={i} className={`text-[10px] px-2 py-1 rounded ${
                      alert.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                      alert.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Last Activity */}
              {wallet.lastActivity && (
                <div className="mt-2 text-[9px] text-zinc-600">
                  Last: {wallet.lastActivity}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
