// RHEO Dashboard — Finance Widget
// 4×2 widget showing finance summary from FinancePage
// LAMINAR: solid token surface, hairline, radius 10
import { motion } from 'motion/react';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { WidgetJumpButton } from './WidgetJumpButton';

interface FinanceWidgetProps {
  summary?: {
    totalBalance: number;
    transactionCount: number;
    net7d: number;
  };
  loading?: boolean;
  error?: string | null;
}

export function FinanceWidget({ summary, loading, error }: FinanceWidgetProps) {
  const totalBalance = summary?.totalBalance ?? 0;
  const transactionCount = summary?.transactionCount ?? 0;
  const net7d = summary?.net7d ?? 0;

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-zinc-800" />
          <div className="h-10 rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-[13px] text-zinc-400">
          <Wallet size={14} />
          <span>Finance</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[12px] text-zinc-500">{error}</div>
        </div>
      </div>
    );
  }

  const isPositive = net7d >= 0;

  return (
    <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full relative">
      <div className="absolute top-0 left-[2px] right-[2px] h-[1px] -z-10 bg-gradient-to-r from-white/[0.06] via-white/[0.02] to-transparent rounded-t-lg" />
      <div className="absolute inset-0 -z-10 rounded-lg pointer-events-none" style={{
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.03), inset 0 -1px 0 0 rgba(0,0,0,0.2)',
      }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <DollarSign size={14} className="text-emerald-400" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200">Finance</span>
        </div>
        <WidgetJumpButton widgetId="finance-widget" iconOnly />
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/50 p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Balance</div>
          <div className="text-lg font-display font-bold text-zinc-100 tabular-nums">
            ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/50 p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Transactions</div>
          <div className="text-lg font-display font-bold text-zinc-100 tabular-nums">{transactionCount}</div>
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--ws-border)] flex items-center gap-2">
        {isPositive ? <TrendingUp size={12} className="text-emerald-400" /> : <TrendingDown size={12} className="text-rose-400" />}
        <span className={`text-[12px] font-mono tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : ''}${Math.abs(net7d).toFixed(2)}
        </span>
        <span className="text-[10px] text-zinc-500">net (7d)</span>
      </div>
    </div>
  );
}
