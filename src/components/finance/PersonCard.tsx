import type { FinanceFtPerson, FinanceWallet } from './finance-types';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

interface PersonCardProps {
  person: FinanceFtPerson;
  wallets: FinanceWallet[];
  displayCurrency: string;
  onClick: () => void;
}

export function PersonCard({ person, wallets, displayCurrency, onClick }: PersonCardProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? v.toFixed(2) : maskNumber(v.toFixed(2), maskMode, maskFixedValue);
  const balance = person.total_owed - person.total_paid;
  const storedBalance = person.balance ?? 0;
  const linkedWallet = person.wallet_id ? wallets.find(w => w.id === person.wallet_id) : null;
  const isSettled = balance <= 0 && person.transaction_count > 0;
  const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-3 rounded-xl bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm border border-zinc-800/60 p-4 text-left transition-all duration-200 hover:bg-zinc-800/60 hover:border-zinc-700/60 hover:scale-[1.01] active:scale-[0.99]"
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isSettled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 truncate">{person.name}</h3>
          <span className={`text-xs font-bold tabular-nums ${isSettled ? 'text-emerald-400' : 'text-amber-400'}`}>
            {displayCurrency}{fmtMoney(balance)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-zinc-500">
            {person.transaction_count} transaction{person.transaction_count !== 1 ? 's' : ''}
          </span>
          {person.email && <span className="text-[10px] text-zinc-600 truncate max-w-[120px]">{person.email}</span>}
        </div>
        {storedBalance > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
              Balance: {displayCurrency}{fmtMoney(storedBalance)}
            </span>
            {linkedWallet && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-700/40 border border-zinc-700/40 px-1.5 py-0.5 text-[10px] text-zinc-400">
                {linkedWallet.name}
              </span>
            )}
          </div>
        )}
      </div>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSettled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
    </button>
  );
}
