import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Landmark, CreditCard, Wallet, Banknote, PiggyBank, Save, RefreshCw, AlertTriangle, Plus, Trash2, Eye, EyeOff, Link2, Unlink, WalletCards, Users, Nfc } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Filler } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { GlassSurface } from './_fx/GlassSurface';
import { getCurrencyInfo, formatCurrency as fmtCurrency, formatAmount as fmtAmount, formatPercent as fmtPct } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { TransactionDetailModal } from './TransactionDetailModal';
import { CryptoAssetDetailModal } from './CryptoAssetDetailModal';
import { CurrencyInput } from './CurrencyInput';
import WalletMonthlyChart from './WalletMonthlyChart';
import type { FinanceWallet, FinanceTransaction, CashDenomination, CryptoPrice, CryptoHistoryPoint, FinanceSubscription, AssetPrice, AssetSearchResult, FinanceAccount, FinanceCategory } from './finance-types';

interface WalletDetailViewProps {
  wallet: FinanceWallet & { metadata?: any };
  displayCurrency: string;
  transactions: FinanceTransaction[];
  wallets: FinanceWallet[];
  accounts?: FinanceAccount[];
  categories?: FinanceCategory[];
  onBack: () => void;
  onSaveMetadata: (id: number, metadata: Record<string, any>) => Promise<boolean>;
  onUpdateWallet: (data: { id: number; name: string; type: string; provider?: string; last_four?: string; balance?: number; currency?: string }) => Promise<boolean>;
  onDeleteWallet?: (id: number) => Promise<boolean>;
  onAddTransaction: (walletType: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRecalculateBalance?: (walletId: number) => Promise<boolean>;
  onUpdateTransaction?: (id: number, data: Record<string, any>) => Promise<boolean>;
  onDeleteTransaction?: (id: number) => Promise<boolean>;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  ftPersons?: { id: number; name: string; email?: string | null; phone?: string | null }[];
  onAddFtPerson?: (name: string) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  subscriptions?: FinanceSubscription[];
}

const walletMeta: Record<string, { icon: any; label: string; color: string }> = {
  bank: { icon: Landmark, label: 'Bank', color: '#3B82F6' },
  debit_card: { icon: CreditCard, label: 'Debit Card', color: '#10B981' },
  credit_card: { icon: CreditCard, label: 'Credit Card', color: '#F59E0B' },
  crypto: { icon: Wallet, label: 'Crypto', color: '#8B5CF6' },
  cash: { icon: PiggyBank, label: 'Cash', color: '#EC4899' },
  physical: { icon: WalletCards, label: 'Physical', color: '#F97316' },
  ewallet: { icon: Banknote, label: 'E-Wallet', color: '#06B6D4' },
  prepaid_card: { icon: Nfc, label: 'Prepaid Card', color: '#22D3EE' },
  other: { icon: Wallet, label: 'Other', color: '#6B7280' },
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Filler);

const maskField = (val: string | null | undefined): string => {
  if (!val) return '';
  if (val.length <= 4) return val;
  return '\u2022'.repeat(val.length - 4) + val.slice(-4);
};

const CURRENCY_DENOMINATIONS: Record<string, { value: number; label: string }[]> = {
  USD: [
    { value: 100, label: '$100' }, { value: 50, label: '$50' }, { value: 20, label: '$20' },
    { value: 10, label: '$10' }, { value: 5, label: '$5' }, { value: 1, label: '$1' },
    { value: 0.25, label: '25\u00a2' }, { value: 0.10, label: '10\u00a2' }, { value: 0.05, label: '5\u00a2' }, { value: 0.01, label: '1\u00a2' },
  ],
  EUR: [
    { value: 500, label: '\u20ac500' }, { value: 200, label: '\u20ac200' }, { value: 100, label: '\u20ac100' },
    { value: 50, label: '\u20ac50' }, { value: 20, label: '\u20ac20' }, { value: 10, label: '\u20ac10' }, { value: 5, label: '\u20ac5' },
    { value: 2, label: '\u20ac2' }, { value: 1, label: '\u20ac1' }, { value: 0.50, label: '50c' }, { value: 0.20, label: '20c' }, { value: 0.10, label: '10c' },
  ],
  GBP: [
    { value: 50, label: '\u00a350' }, { value: 20, label: '\u00a320' }, { value: 10, label: '\u00a310' }, { value: 5, label: '\u00a35' }, { value: 1, label: '\u00a31' },
    { value: 0.50, label: '50p' }, { value: 0.20, label: '20p' }, { value: 0.10, label: '10p' }, { value: 0.05, label: '5p' }, { value: 0.01, label: '1p' },
  ],
  IDR: [
    { value: 100000, label: '100rb' }, { value: 50000, label: '50rb' }, { value: 20000, label: '20rb' },
    { value: 10000, label: '10rb' }, { value: 5000, label: '5rb' }, { value: 2000, label: '2rb' }, { value: 1000, label: '1rb' },
  ],
  JPY: [
    { value: 10000, label: '\u00a510,000' }, { value: 5000, label: '\u00a55,000' }, { value: 2000, label: '\u00a52,000' },
    { value: 1000, label: '\u00a51,000' }, { value: 500, label: '\u00a5500' }, { value: 100, label: '\u00a5100' }, { value: 50, label: '\u00a550' }, { value: 10, label: '\u00a510' }, { value: 1, label: '\u00a51' },
  ],
};

const DEFAULT_DENOMINATIONS = [
  { value: 100, label: '100' }, { value: 50, label: '50' }, { value: 20, label: '20' },
  { value: 10, label: '10' }, { value: 5, label: '5' }, { value: 1, label: '1' },
];

function getDenominations(currency: string) {
  return CURRENCY_DENOMINATIONS[currency] || DEFAULT_DENOMINATIONS;
}

type EditableField = string | number | boolean | null | undefined;

function FieldRow({ label, value, onChange, type = 'text', masked = false, warning, hint }: {
  label: string; value: EditableField; onChange?: (v: string) => void; type?: string; masked?: boolean; warning?: string; hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const display = masked && !revealed ? maskField(String(value ?? '')) : String(value ?? '');
  return (
    <div className={`py-2 px-3 rounded-lg transition-colors ${warning ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-zinc-800/20 hover:bg-zinc-800/40'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">{label}</span>
        <div className="flex items-center gap-1.5">
          {onChange ? (
            <input type={type} value={String(value ?? '')} onChange={e => onChange(e.target.value)}
              className="text-xs text-right bg-transparent text-zinc-200 tabular-nums outline-none w-40 border-b border-white/5 focus:border-[var(--page-accent)] transition-colors" />
          ) : (
            <span className="text-xs text-zinc-200 tabular-nums">{display}</span>
          )}
          {masked && !onChange && (
            <button onClick={() => setRevealed(!revealed)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
      {warning && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400">
          <AlertTriangle className="w-3 h-3" />{warning}
        </div>
      )}
      {hint && (
        <div className="mt-1 text-[10px] text-zinc-500 leading-relaxed">{hint}</div>
      )}
    </div>
  );
}

function HistoricalReorderPanel({ transactions, walletId, onOrderChanged, displayCurrency }: {
  transactions: FinanceTransaction[]; walletId: number; onOrderChanged: () => void; displayCurrency: string;
}) {
  const sym = getCurrencyInfo(displayCurrency).symbol;
  const [order, setOrder] = useState<FinanceTransaction[]>(() =>
    [...transactions].sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0))
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    setDirty(true);
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (idx: number) => {
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      moveItem(dragIdx.current, idx);
    }
    dragIdx.current = null;
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = order.map((t, i) => ({ id: t.id, sort_order: i + 1 }));
    await (window as any).deskflowAPI?.financeUpdateTransactionSortOrder(updates);
    setSaving(false);
    setDirty(false);
    if (onOrderChanged) onOrderChanged();
    else window.location.reload();
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] text-zinc-500">Drag to reorder chronological order</span>
        <button onClick={handleSave} disabled={!dirty || saving}
          className="text-[10px] px-2 py-0.5 rounded-full transition-colors disabled:opacity-40"
          style={{ background: dirty ? 'rgba(139,92,246,0.2)' : 'transparent', color: dirty ? '#8B5CF6' : '#71717a' }}>
          {saving ? 'Saving...' : dirty ? 'Sync Order' : 'No changes'}
        </button>
      </div>
      {order.map((txn, idx) => {
        let cryptoLabel: string | null = null;
        if (txn.metadata) {
          try {
            const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
            if (m.coinId || m.coin_id) {
              const coinSym = (m.symbol || '').toUpperCase();
              const qty = Number(m.qty) || 0;
              cryptoLabel = `${qty.toFixed(8).replace(/\.?0+$/, '')} ${coinSym}`;
            }
          } catch {}
        }
        return (
          <div key={txn.id} draggable onDragStart={() => handleDragStart(idx)}
            onDragOver={handleDragOver} onDrop={() => handleDrop(idx)}
            className="flex items-center gap-2 py-2 px-3 rounded-lg bg-violet-500/[0.06] border-l-2 border-l-violet-500/40 hover:bg-violet-500/10 transition-colors cursor-grab active:cursor-grabbing">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveItem(idx, idx - 1)} className="text-zinc-600 hover:text-zinc-300"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg></button>
              <button onClick={() => moveItem(idx, idx + 1)} className="text-zinc-600 hover:text-zinc-300"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-violet-400/60 tabular-nums w-4 text-right">{idx + 1}</span>
                <span className="text-xs text-zinc-400 truncate">{txn.description || 'Untitled'}</span>
                {idx === 0 && <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300">Earliest</span>}
                {idx === order.length - 1 && order.length > 1 && <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300">Latest</span>}
              </div>
              {cryptoLabel && <div className="text-[10px] text-[#8B5CF6]/70 mt-0.5 font-mono ml-5">{cryptoLabel}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionList({ transactions, displayCurrency, emptyText, walletId, onTxnClick, onRefresh }: {
  transactions: FinanceTransaction[]; displayCurrency: string; emptyText?: string; walletId?: number; onTxnClick?: (txn: FinanceTransaction) => void; onRefresh?: () => void;
}) {
  const sym = getCurrencyInfo(displayCurrency).symbol;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtAmt = (v: number) => showNumbers ? `${sym}${Math.abs(v).toFixed(2)}` : maskNumber(`${sym}${Math.abs(v).toFixed(2)}`, maskMode, maskFixedValue);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showReorder, setShowReorder] = useState(false);

  const regular = useMemo(() => transactions.filter(t => !t.is_adjustment), [transactions]);
  const historical = useMemo(() => transactions.filter(t => t.is_adjustment), [transactions]);

  // Group regular transactions by year for separators
  const regularWithYears = useMemo(() => {
    const sorted = [...regular].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const result: { type: 'year' | 'txn'; key: string; year?: string; txn?: FinanceTransaction }[] = [];
    let lastYear = '';
    for (const txn of sorted) {
      const year = (txn.date || '').substring(0, 4);
      if (year !== lastYear) {
        result.push({ type: 'year', key: `year-${year}`, year });
        lastYear = year;
      }
      result.push({ type: 'txn', key: `txn-${txn.id}`, txn });
    }
    return result;
  }, [regular]);

  const renderTxnRow = (txn: FinanceTransaction) => {
    let denomLabel: string | null = null;
    let cryptoLabel: string | null = null;
    if (txn.metadata) {
      try {
        const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
        if (m.denominations && typeof m.denominations === 'object') {
          const parts = Object.entries(m.denominations)
            .filter(([, n]) => (n as number) > 0)
            .map(([val, n]) => `${sym}${val}×${n}`);
          if (parts.length > 0) denomLabel = parts.join('  ·  ');
        }
        if (m.coinId || m.coin_id) {
          const coinSym = (m.symbol || '').toUpperCase();
          const qty = Number(m.qty) || 0;
          cryptoLabel = `${qty.toFixed(8).replace(/\.?0+$/, '')} ${coinSym}`;
        }
      } catch { /* ignore bad JSON */ }
    }
    const isHistorical = !!txn.is_adjustment;
    return (
      <div
        key={txn.id}
        onClick={() => onTxnClick?.(txn)}
        className={`flex justify-between items-center py-2 px-3 rounded-lg transition-colors ${
          isHistorical
            ? 'bg-violet-500/[0.06] border-l-2 border-l-violet-500/40 hover:bg-violet-500/10'
            : 'bg-zinc-800/30 hover:bg-zinc-700/40'
        } ${onTxnClick ? 'cursor-pointer' : ''}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs truncate ${isHistorical ? 'text-zinc-400' : 'text-zinc-300'}`}>{txn.description || 'Untitled'}</span>
            {isHistorical && (
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">hist</span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500">{isHistorical ? 'Historical data' : new Date(txn.date).toLocaleDateString()}</div>
          {denomLabel && (
            <div className="text-[10px] text-zinc-500/70 mt-0.5 font-mono">{denomLabel}</div>
          )}
          {cryptoLabel && (
            <div className="text-[10px] text-[#8B5CF6]/70 mt-0.5 font-mono">{cryptoLabel}</div>
          )}
        </div>
        <div className={`text-xs font-medium tabular-nums ml-2 ${isHistorical ? 'text-violet-400' : txn.type === 'expense' ? 'text-red-400' : txn.type === 'income' ? 'text-emerald-400' : txn.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          {isHistorical ? '' : txn.type === 'expense' || (txn.type === 'transfer' && txn.amount < 0) ? '-' : txn.type === 'income' || (txn.type === 'transfer' && txn.amount > 0) ? '+' : ''}{fmtAmt(txn.amount)}
        </div>
      </div>
    );
  };

  if (transactions.length === 0) {
    return <div className="text-center py-6 text-xs text-zinc-500">{emptyText || 'No transactions yet'}</div>;
  }

  return (
    <div className="space-y-2">
      {regularWithYears.length > 0 && (
        <div className="space-y-1">
          {regularWithYears.slice(0, 30).map((entry) => {
            if (entry.type === 'year') {
              return (
                <div key={entry.key} className="flex items-center gap-2 pt-1 pb-0.5 px-1">
                  <div className="h-px flex-1 bg-zinc-700/50" />
                  <span className="text-[9px] font-bold text-zinc-500 tracking-widest">{entry.year}</span>
                  <div className="h-px flex-1 bg-zinc-700/50" />
                </div>
              );
            }
            return renderTxnRow(entry.txn!);
          })}
        </div>
      )}
      {historical.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <button onClick={() => setShowHistorical(v => !v)} className="flex items-center gap-2 flex-1 text-left rounded-lg hover:bg-zinc-800/40 transition-colors">
              <svg className={`w-3 h-3 text-violet-400 transition-transform ${showHistorical ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Historical</span>
              <span className="text-[10px] text-violet-400/60 tabular-nums">{historical.length}</span>
            </button>
            {showHistorical && walletId && (
              <button onClick={() => setShowReorder(v => !v)}
                className="text-[9px] px-2 py-0.5 rounded-full transition-colors"
                style={{ background: showReorder ? 'rgba(139,92,246,0.2)' : 'transparent', color: showReorder ? '#8B5CF6' : '#71717a' }}>
                {showReorder ? 'Done' : 'Reorder'}
              </button>
            )}
          </div>
          {showHistorical && (
            <div className="mt-1">
              {showReorder && walletId ? (
                <HistoricalReorderPanel transactions={historical} walletId={walletId} displayCurrency={displayCurrency}
                  onOrderChanged={() => { setShowReorder(false); onRefresh?.(); }} />
              ) : (
                <div className="space-y-1">{historical.slice(0, 15).map(renderTxnRow)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BankDetail({ metadata, onChange, transactions, displayCurrency, walletId, onTxnClick }: {
  metadata: Record<string, any>; onChange: (k: string, v: string) => void; transactions: FinanceTransaction[]; displayCurrency: string; walletId?: number; onTxnClick?: (txn: FinanceTransaction) => void;
}) {
  return (
    <div className="space-y-4">
      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Account Details</div>
        <div className="space-y-1">
          <FieldRow label="Institution" value={metadata.institution || metadata.bank_name} onChange={v => onChange('institution', v)} />
          <FieldRow label="Account Number" value={metadata.accountNumber || metadata.account_number} masked />
          <FieldRow label="Routing Number" value={metadata.routingNumber || metadata.swift} onChange={v => onChange('routingNumber', v)} />
          <FieldRow label="IBAN" value={metadata.iban} onChange={v => onChange('iban', v)} />
          <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
        </div>
      </GlassSurface>
      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Recent Transactions</div>
        <TransactionList transactions={transactions} displayCurrency={displayCurrency} emptyText="No transactions for this account yet" walletId={walletId} onTxnClick={onTxnClick} />
      </GlassSurface>
    </div>
  );
}

function DebitCardDetail({ metadata, onChange, transactions, displayCurrency, wallets, onWalletClick, walletId, onTxnClick }: {
  metadata: Record<string, any>; onChange: (k: string, v: string) => void; transactions: FinanceTransaction[]; displayCurrency: string; wallets: FinanceWallet[]; onWalletClick?: (id: number) => void; walletId?: number; onTxnClick?: (txn: FinanceTransaction) => void;
}) {
  const linkedBank = wallets.find(w => w.id === Number(metadata.linkedAccountId));
  return (
    <div className="space-y-4">
      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Card Details</div>
        <div className="space-y-1">
          <FieldRow label="Card Network" value={metadata.card_network} onChange={v => onChange('card_network', v)} />
          <FieldRow label="Issuer" value={metadata.issuer} onChange={v => onChange('issuer', v)} />
          <FieldRow label="ATM Withdrawal Limit" value={(metadata.atmWithdrawalLimit || metadata.daily_limit) ?? ''} onChange={v => onChange('atmWithdrawalLimit', v)} type="number" />
          <FieldRow label="Daily Spending Limit" value={metadata.dailySpendingLimit ?? ''} onChange={v => onChange('dailySpendingLimit', v)} type="number" />
          <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
        </div>
      </GlassSurface>
      {linkedBank && onWalletClick && (
        <button onClick={() => onWalletClick(linkedBank.id)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] text-xs hover:bg-[#3B82F6]/20 transition-colors w-full">
          <Link2 className="w-3.5 h-3.5" />
          <span>Linked: {linkedBank.name}</span>
        </button>
      )}
      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Recent Spending</div>
        <TransactionList transactions={transactions.filter(t => t.type === 'expense')} displayCurrency={displayCurrency} emptyText="No spending transactions yet" walletId={walletId} onTxnClick={onTxnClick} />
      </GlassSurface>
    </div>
  );
}

function CreditCardDetail({ metadata, onChange, wallet, transactions, displayCurrency }: {
  metadata: Record<string, any>; onChange: (k: string, v: string) => void; wallet: FinanceWallet;
  transactions: FinanceTransaction[]; displayCurrency: string;
}) {
  const creditLimit = Number(metadata.creditLimit || metadata.credit_limit) || 0;
  const currentBalance = Math.abs(wallet.balance);
  const utilization = creditLimit > 0 ? (currentBalance / creditLimit) * 100 : 0;
  const available = creditLimit - currentBalance;
  const statementBalance = Number(metadata.lastStatementBalance || metadata.statement_balance) || 0;
  const statementDate = metadata.statementDate || metadata.statement_date || '';
  const paymentDueDate = metadata.paymentDueDate || metadata.payment_due_date || '';
  const sym = getCurrencyInfo(displayCurrency).symbol;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? fmtCurrency(v, displayCurrency) : maskNumber(fmtCurrency(v, displayCurrency), maskMode, maskFixedValue);
  const fmtSym = (v: number) => showNumbers ? `${sym}${v.toFixed(2)}` : maskNumber(`${sym}${v.toFixed(2)}`, maskMode, maskFixedValue);

  const isDueSoon = paymentDueDate && (() => {
    const due = new Date(paymentDueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  })();

  const recentTxns = transactions.slice(0, 10);
  const today = new Date().toISOString().split('T')[0];
  const pendingTxns = recentTxns.filter(t => t.date === today);
  const clearedTxns = recentTxns.filter(t => t.date !== today);

  return (
    <div className="space-y-4">
      {creditLimit > 0 && (
        <GlassSurface tier={2} className="p-4">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-zinc-400">Credit Utilization</span>
            <span className={`font-semibold tabular-nums ${utilization > 80 ? 'text-red-400' : utilization > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {utilization.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full transition-all rounded-full ${utilization > 80 ? 'bg-gradient-to-r from-red-500 to-red-400' : utilization > 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
              style={{ width: `${Math.min(utilization, 100)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500 mt-1.5">
            <span>Used: {fmtSym(currentBalance)}</span>
            <span>Available: {fmtSym(Math.max(available, 0))}</span>
          </div>
        </GlassSurface>
      )}

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Card Details</div>
        <div className="space-y-1">
          <FieldRow label="Card Network" value={metadata.card_network} onChange={v => onChange('card_network', v)} />
          <FieldRow label="Issuer" value={metadata.issuer} onChange={v => onChange('issuer', v)} />
          <FieldRow label="Credit Limit" value={(metadata.creditLimit || metadata.credit_limit) ?? ''} onChange={v => onChange('creditLimit', v)} type="number" />
          <FieldRow label="APR (%)" value={metadata.apr ?? ''} onChange={v => onChange('apr', v)} type="number" />
          {statementBalance > 0 && <FieldRow label="Statement Balance" value={fmtSym(statementBalance)} />}
          {statementDate && <FieldRow label="Statement Date" value={statementDate} />}
          <FieldRow label="Payment Due Date" value={paymentDueDate} onChange={v => onChange('paymentDueDate', v)} type="date"
            warning={isDueSoon ? 'Payment due within 7 days' : undefined} />
          <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
        </div>
      </GlassSurface>

      {pendingTxns.length > 0 && (
        <GlassSurface tier={2} className="p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-amber-400 mb-2">Pending ({pendingTxns.length})</div>
          <TransactionList transactions={pendingTxns} displayCurrency={displayCurrency} walletId={wallet.id} onTxnClick={onTxnClick} />
        </GlassSurface>
      )}

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Cleared ({clearedTxns.length})</div>
        <TransactionList transactions={clearedTxns} displayCurrency={displayCurrency} emptyText="No cleared transactions yet" walletId={wallet.id} onTxnClick={onTxnClick} />
      </GlassSurface>
    </div>
  );
}

const POPULAR_COINS = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'tether', name: 'Tether', symbol: 'USDT' },
  { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'ripple', name: 'XRP', symbol: 'XRP' },
  { id: 'usd-coin', name: 'USDC', symbol: 'USDC' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
  { id: 'tron', name: 'TRON', symbol: 'TRX' },
  { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' },
  { id: 'chainlink', name: 'Chainlink', symbol: 'LINK' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
  { id: 'polygon-ecosystem-token', name: 'Polygon', symbol: 'POL' },
  { id: 'litecoin', name: 'Litecoin', symbol: 'LTC' },
  { id: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'BCH' },
  { id: 'stellar', name: 'Stellar', symbol: 'XLM' },
  { id: 'uniswap', name: 'Uniswap', symbol: 'UNI' },
  { id: 'monero', name: 'Monero', symbol: 'XMR' },
  { id: 'ethereum-classic', name: 'Ethereum Classic', symbol: 'ETC' },
  { id: 'filecoin', name: 'Filecoin', symbol: 'FIL' },
  { id: 'cosmos', name: 'Cosmos', symbol: 'ATOM' },
  { id: 'algorand', name: 'Algorand', symbol: 'ALGO' },
  { id: 'vechain', name: 'VeChain', symbol: 'VET' },
  { id: 'internet-computer', name: 'Internet Computer', symbol: 'ICP' },
  { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR' },
  { id: 'aptos', name: 'Aptos', symbol: 'APT' },
  { id: 'optimism', name: 'Optimism', symbol: 'OP' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ARB' },
  { id: 'pepe', name: 'Pepe', symbol: 'PEPE' },
];

function CryptoDetail({ metadata, onChange, wallet, displayCurrency, onTotalValueChange, transactions, walletTransactions, onTxnClick }: {
  metadata: Record<string, any>; onChange: (key: string, v: string) => void; wallet: FinanceWallet; displayCurrency: string; onTotalValueChange?: (val: number) => void; transactions?: FinanceTransaction[]; walletTransactions?: FinanceTransaction[]; onTxnClick?: (t: FinanceTransaction) => void;
}) {
  const sym = getCurrencyInfo(displayCurrency).symbol;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? fmtCurrency(v, displayCurrency) : maskNumber(fmtCurrency(v, displayCurrency), maskMode, maskFixedValue);
  const isInvestment = wallet.type === 'investment';
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [history, setHistory] = useState<CryptoHistoryPoint[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframeDays, setTimeframeDays] = useState(7);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [searchCoin, setSearchCoin] = useState('');
  const [selectedCoinId, setSelectedCoinId] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState<string>('crypto');
  const [newAssetAmount, setNewAssetAmount] = useState('');
  const [newAssetAvgPrice, setNewAssetAvgPrice] = useState('');
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'from-spend'>('manual');
  const [newTotalSpent, setNewTotalSpent] = useState('');
  const [editingCoinIdx, setEditingCoinIdx] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editAvgPrice, setEditAvgPrice] = useState('');
  const [fiatError, setFiatError] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<{ coinId: string; symbol: string; name: string } | null>(null);
  const [chartMode, setChartMode] = useState<'price' | 'quantity' | 'value'>('price');

  const TIMEFRAMES = [
    { days: 1, label: '1D' }, { days: 7, label: '1W' }, { days: 30, label: '1M' },
    { days: 90, label: '3M' }, { days: 365, label: '1Y' }, { days: 9999, label: 'ALL' },
  ] as const;



  const assets: { coin_id: string; symbol: string; amount: number; avg_buy_price: number }[] = useMemo(() => {
    // Derive assets from THIS wallet's transactions only (not all wallets)
    const walletTxns = walletTransactions || [];
    const sorted = [...walletTxns].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      const soA = (a as any).sort_order || 0;
      const soB = (b as any).sort_order || 0;
      if (soA !== soB) return soA - soB;
      return (a.id || 0) - (b.id || 0);
    });

    const assetsMap = new Map<string, { coin_id: string; symbol: string; amount: number; total_cost: number; total_fiat_spent: number }>();

    for (const t of sorted) {
      if (!t.metadata) continue;
      let m: any;
      try { m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata; } catch { continue; }
      const coinId = m.coinId || m.coin_id;
      if (!coinId || m.qty == null) continue;

      let delta = Number(m.qty) || 0;
      if (t.type === 'income' || (t.type === 'transfer' && t.amount < 0)) {
        delta = -Math.abs(delta);
      } else {
        delta = Math.abs(delta);
      }

      if (!assetsMap.has(coinId)) {
        assetsMap.set(coinId, { coin_id: coinId, symbol: (m.symbol || '').toUpperCase(), amount: 0, total_cost: 0, total_fiat_spent: 0 });
      }
      const asset = assetsMap.get(coinId)!;
      // Only count as "spent" for actual purchases (buys), NOT receives or transfers
      if (delta > 0 && t.type === 'expense' && m.is_purchase !== false) {
        const cost = delta * (Number(m.price) || 0);
        asset.total_cost += cost;
        asset.total_fiat_spent += Number(m.total) || cost;
      }
      // When removing assets, reduce total_cost proportionally to keep avg_buy_price accurate
      if (delta < 0 && asset.amount > 0) {
        const removalRatio = Math.abs(delta) / asset.amount;
        asset.total_cost = Math.max(0, asset.total_cost * (1 - removalRatio));
      }
      asset.amount += delta;
    }

    return Array.from(assetsMap.values())
      .filter(a => a.amount > 0.00000001)
      .map(a => ({
        coin_id: a.coin_id,
        symbol: a.symbol,
        amount: a.amount,
        avg_buy_price: a.amount > 0 ? a.total_cost / a.amount : 0,
        total_fiat_spent: (a as any).total_fiat_spent || 0,
      }));
  }, [walletTransactions]);

  const coinIds = assets.map(a => a.coin_id).filter(Boolean);
  const hasAssets = assets.length > 0;
  const primaryCoinId = coinIds[0] || '';

  // Fiat balance = wallet.balance (the actual fiat in the wallet)
  const fiatBalance = wallet.balance || 0;

  const cryptoPortfolioValue = useMemo(() => {
    const val = assets.reduce((sum, a) => {
      const p = prices.find(pr => pr.coin_id === a.coin_id);
      return sum + ((Number(a.amount) || 0) * (Number(p?.current_price) || 0));
    }, 0);
    return Number.isFinite(val) ? val : 0;
  }, [assets, prices]);

  const totalCost = useMemo(() => {
    const val = assets.reduce((s, a) => s + (Number(a.amount) || 0) * (Number(a.avg_buy_price) || 0), 0);
    return Number.isFinite(val) ? val : 0;
  }, [assets]);
  const totalSpent = useMemo(() => {
    const val = assets.reduce((s, a) => s + (Number((a as any).total_fiat_spent) || 0), 0);
    return Number.isFinite(val) ? val : 0;
  }, [assets]);
  // For crypto wallets: available fiat is just the actual wallet balance
  const availableFiat = Number(fiatBalance) || 0;
  const totalValue = availableFiat + (Number(cryptoPortfolioValue) || 0);

  const totalPnl = (Number(cryptoPortfolioValue) || 0) - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Use ref for onTotalValueChange to avoid infinite re-render from inline parent callback
  const onTotalValueChangeRef = useRef(onTotalValueChange);
  onTotalValueChangeRef.current = onTotalValueChange;
  useEffect(() => { onTotalValueChangeRef.current?.(cryptoPortfolioValue); }, [cryptoPortfolioValue]);

  const primaryPrice = prices.find(p => p.coin_id === primaryCoinId);
  const pc24h = primaryPrice?.price_change_percentage_24h ?? primaryPrice?.price_change_24h ?? null;

  useEffect(() => {
    if (coinIds.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoadingPrices(true); setError(null);
      try {
        let r: any[];
        if (isInvestment) {
          r = await (window as any).deskflowAPI?.financeFetchAssetPrices(coinIds, 'stock', displayCurrency) || [];
        } else {
          r = await (window as any).deskflowAPI?.financeFetchCryptoPrices(coinIds, displayCurrency) || [];
        }
        if (!cancelled && r.length) { setPrices(r); setLastUpdated(Date.now()); setStale(false); }
      } catch (e: any) { if (!cancelled) setError(e?.message || String(e)); }
      finally { if (!cancelled) setLoadingPrices(false); }
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify(coinIds), isInvestment, displayCurrency]);

  // Mark prices as stale if older than 10 minutes
  useEffect(() => {
    if (!lastUpdated) return;
    const check = () => {
      if (Date.now() - lastUpdated > 10 * 60 * 1000) setStale(true);
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  useEffect(() => {
    if (!primaryCoinId) return;
    let cancelled = false;
    (async () => {
      setLoadingHistory(true);
      try {
        let r: any[];
        if (isInvestment) {
          r = await (window as any).deskflowAPI?.financeGetAssetHistory(primaryCoinId, 'stock', timeframeDays) || [];
        } else {
          r = await (window as any).deskflowAPI?.financeGetCryptoHistory(primaryCoinId, timeframeDays, displayCurrency) || [];
        }
        if (!cancelled && r) setHistory(r);
      } catch { /* non-critical */ }
      finally { if (!cancelled) setLoadingHistory(false); }
    })();
    return () => { cancelled = true; };
  }, [primaryCoinId, timeframeDays, isInvestment]);

  const fmtLabel = useCallback((ts: number) => {
    const d = new Date(ts);
    if (timeframeDays <= 1) return d.toLocaleTimeString(undefined, { hour: '2-digit' });
    if (timeframeDays <= 90) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }, [timeframeDays]);

  const lineData = useMemo(() => {
    const COLORS = ['#8B5CF6', '#22d3ee', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#EF4447'];
    if (chartMode === 'quantity') {
      // Multi-line: one line per coin showing quantity over time
      const walletTxns = walletTransactions || [];
      const sorted = [...walletTxns].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id || 0) - (b.id || 0));
      const coinTimelines = new Map<string, { date: string; qty: number }[]>();
      const coinRunning = new Map<string, number>();
      for (const t of sorted) {
        if (!t.metadata) continue;
        let m: any;
        try { m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata; } catch { continue; }
        const coinId = m.coinId || m.coin_id;
        if (!coinId || m.qty == null) continue;
        let delta = Number(m.qty) || 0;
        if (t.type === 'income' || (t.type === 'transfer' && t.amount < 0)) delta = -Math.abs(delta);
        else delta = Math.abs(delta);
        coinRunning.set(coinId, (coinRunning.get(coinId) || 0) + delta);
        if (!coinTimelines.has(coinId)) coinTimelines.set(coinId, []);
        coinTimelines.get(coinId)!.push({ date: t.date || '', qty: coinRunning.get(coinId)! });
      }
      if (coinTimelines.size === 0) return null;
      // Merge all coin dates into sorted unique labels
      const allDates = [...new Set([...coinTimelines.values()].flat().map(p => p.date))].sort();
      if (allDates.length === 0) return null;
      const datasets = [...coinTimelines.entries()].map(([coinId, timeline], idx) => {
        const sym = assets.find(a => a.coin_id === coinId)?.symbol || coinId.slice(0, 6).toUpperCase();
        const timelineMap = new Map(timeline.map(p => [p.date, p.qty]));
        let lastQty = 0;
        return {
          label: sym,
          data: allDates.map(d => { if (timelineMap.has(d)) lastQty = timelineMap.get(d)!; return lastQty; }),
          borderColor: COLORS[idx % COLORS.length],
          backgroundColor: 'transparent',
          tension: 0.3, pointRadius: 0, borderWidth: 2,
          pointHoverRadius: 3, pointHoverBorderWidth: 1,
        };
      });
      return { labels: allDates, datasets };
    }
    if (chartMode === 'value') {
      // Single line: total fiat value of all holdings over time
      const walletTxns = walletTransactions || [];
      const sorted = [...walletTxns].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id || 0) - (b.id || 0));
      const coinRunning = new Map<string, number>();
      const timeline: { date: string; value: number }[] = [];
      for (const t of sorted) {
        if (!t.metadata) continue;
        let m: any;
        try { m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata; } catch { continue; }
        const coinId = m.coinId || m.coin_id;
        if (!coinId || m.qty == null) continue;
        let delta = Number(m.qty) || 0;
        if (t.type === 'income' || (t.type === 'transfer' && t.amount < 0)) delta = -Math.abs(delta);
        else delta = Math.abs(delta);
        coinRunning.set(coinId, (coinRunning.get(coinId) || 0) + delta);
        // Compute total value using current prices
        let totalVal = 0;
        for (const [cid, qty] of coinRunning) {
          const p = prices.find(pr => pr.coin_id === cid);
          totalVal += qty * (p?.current_price || 0);
        }
        timeline.push({ date: t.date || '', value: totalVal });
      }
      if (timeline.length === 0) return null;
      const isUp = timeline.length > 1 && timeline[timeline.length - 1].value >= timeline[0].value;
      return {
        labels: timeline.map(p => p.date),
        datasets: [{
          label: 'Total Value',
          data: timeline.map(p => p.value),
          borderColor: isUp ? '#10B981' : '#EF4444',
          backgroundColor: isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
          pointHoverRadius: 4, pointHoverBackgroundColor: isUp ? '#10B981' : '#EF4444',
          pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        }]
      };
    }
    // Default: price mode
    if (history.length === 0) return null;
    const isUp = history.length > 1 && history[history.length - 1].price >= history[0].price;
    const c = isUp ? '16, 185, 129' : '239, 68, 68';
    return {
      labels: history.map(p => fmtLabel(p.timestamp)),
      datasets: [{
        data: history.map(p => p.price),
        borderColor: isUp ? '#10B981' : '#EF4444',
        backgroundColor: (ctx: any) => {
          if (!ctx.chart?.ctx) return 'transparent';
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          g.addColorStop(0, `rgba(${c}, 0.25)`); g.addColorStop(1, `rgba(${c}, 0)`); return g;
        },
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
        pointHoverRadius: 4, pointHoverBackgroundColor: isUp ? '#10B981' : '#EF4444',
        pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
      }]
    };
  }, [history, fmtLabel, chartMode, walletTransactions, prices, assets]);

  const donutData = useMemo(() => {
    if (assets.length === 0 && availableFiat <= 0) return null;
    const colors = ['#22d3ee', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#EF4447'];
    const labels: string[] = [];
    const data: number[] = [];
    if (availableFiat > 0) {
      labels.push('Fiat');
      data.push(availableFiat);
    }
    assets.forEach(a => {
      const p = prices.find(pr => pr.coin_id === a.coin_id);
      const val = a.amount * (p?.current_price || 0);
      if (val > 0) {
        labels.push(a.symbol || a.coin_id);
        data.push(val);
      }
    });
    if (data.length === 0) return null;
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderColor: 'rgba(24, 24, 27, 0.8)',
        borderWidth: 2,
      }]
    };
  }, [assets, prices, availableFiat]);

  const donutOpts: any = {
    responsive: true, maintainAspectRatio: false, cutout: '70%',
    plugins: {
      legend: { position: 'right' as const, labels: { color: '#a1a1aa', font: { size: 10 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)', titleColor: '#e4e4e7', bodyColor: '#a1a1aa',
        borderColor: 'rgba(63, 63, 70, 0.5)', borderWidth: 1, cornerRadius: 8,
        callbacks: { label: (ctx: any) => ` ${ctx.label}: ${fmtMoney(ctx.parsed)} (${((ctx.parsed / totalValue) * 100).toFixed(1)}%)` }
      }
    }
  };

  const lineOpts: any = {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)', titleColor: '#e4e4e7', bodyColor: '#a1a1aa',
        borderColor: 'rgba(63, 63, 70, 0.5)', borderWidth: 1, cornerRadius: 8,
        callbacks: { label: (ctx: any) => `${fmtMoney(ctx.parsed.y)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#71717a', font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false }, border: { color: 'rgba(113,113,122,0.15)' } },
      y: { ticks: { color: '#71717a', font: { size: 10 }, maxTicksLimit: 5, callback: (v: any) => showNumbers ? `${sym}${v}` : maskNumber(`${sym}${v}`, maskMode, maskFixedValue) }, grid: { color: 'rgba(113,113,122,0.08)' }, border: { display: false } },
    },
  };

  const ago = lastUpdated ? (() => { const s = Math.floor((Date.now() - lastUpdated) / 1000); return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`; })() : null;

  const searchAssetTypes = isInvestment ? undefined : ['crypto'];

  // Universal asset search (debounced)
  useEffect(() => {
    if (!showAddAsset || searchCoin.trim().length < 2) { setSearchResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await (window as any).deskflowAPI?.financeSearchAssets(searchCoin.trim(), searchAssetTypes);
        if (!cancelled && Array.isArray(r)) setSearchResults(r);
      } catch { if (!cancelled) setSearchResults([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchCoin, showAddAsset, isInvestment]);

  // Preload CoinGecko coin list on mount for instant search
  useEffect(() => {
    if (!isInvestment) {
      (window as any).deskflowAPI?.financeGetAllCoins();
    }
  }, [isInvestment]);

  const filteredCoins = useMemo(() => {
    if (searchResults.length > 0) return searchResults;
    if (searchCoin.trim().length >= 2 && !searching) return [];
    return POPULAR_COINS;
  }, [searchCoin, searchResults, searching]);

  const canUseCustom = searchCoin.trim().length > 0 && filteredCoins.length === 0 && !selectedCoinId;

  const handleSelectCoin = (coin: any) => {
    setSelectedCoinId(coin.id || coin.symbol);
    setSelectedAssetType(coin.asset_type || 'crypto');
    setSearchCoin(`${coin.name} (${coin.symbol || coin.id})`);
  };

  const handleUseCustom = () => {
    const raw = searchCoin.trim().toUpperCase().replace(/\s+/g, '-');
    setSelectedCoinId(raw);
    setSelectedAssetType(isInvestment ? 'stock' : 'crypto');
  };

  const handleAddAsset = async () => {
    if (!selectedCoinId) return;
    let amount: number;
    let spentFiat: number = 0;

    if (addMode === 'from-spend') {
      if (!newTotalSpent || !newAssetAvgPrice) return;
      const spent = parseFloat(newTotalSpent);
      const avgPrice = parseFloat(newAssetAvgPrice);
      if (!spent || !avgPrice) return;
      amount = spent / avgPrice;
      spentFiat = spent;
    } else {
      if (!newAssetAmount || !newAssetAvgPrice) return;
      amount = parseFloat(newAssetAmount);
      spentFiat = 0;
    }

    const symbol = selectedCoinId.split('-').pop()?.toUpperCase() || selectedCoinId.slice(0, 6).toUpperCase();
    const name = searchCoin.split(' (')[0] || selectedCoinId;
    const newAsset = {
      coin_id: selectedCoinId,
      symbol,
      asset_type: selectedAssetType || 'crypto',
      name,
      amount,
      avg_buy_price: parseFloat(newAssetAvgPrice) || 0,
    };
    // Merge with existing assets (don't duplicate same coin)
    const existingIdx = assets.findIndex(a => a.coin_id === selectedCoinId);
    const newAssets = [...assets];
    if (existingIdx >= 0) {
      const existing = newAssets[existingIdx];
      const oldAmt = existing.amount || 0;
      const newAmt = oldAmt + amount;
      const oldAvg = existing.avg_buy_price || 0;
      newAssets[existingIdx] = {
        ...existing,
        amount: newAmt,
        avg_buy_price: newAmt > 0 ? ((oldAmt * oldAvg) + (amount * newAsset.avg_buy_price)) / newAmt : newAsset.avg_buy_price,
      };
    } else {
      newAssets.push(newAsset);
    }
    const cryptoMetadata = { coinId: selectedCoinId, symbol, name, qty: amount, price: parseFloat(newAssetAvgPrice) || 0, fee: 0, total: spentFiat };
    let createdTxnId: number | null = null;

    try {
      let expenseCategoryId = 1;
      try {
        const cats = await (window as any).deskflowAPI?.financeGetCategories() as any[];
        const expenseCat = cats?.find((c: any) => c.type === 'expense') || cats?.[0];
        if (expenseCat) expenseCategoryId = expenseCat.id;
      } catch {}

      const result = await (window as any).deskflowAPI?.financeCreateTransaction({
        account_id: wallet.account_id,
        wallet_id: wallet.id,
        category_id: expenseCategoryId,
        type: 'expense',
        amount: spentFiat || 0,
        description: `Historical: Added ${amount.toFixed(6)} ${symbol}`,
        note: `Crypto: ${name} (${selectedCoinId}) @ ${fmtCurrency(parseFloat(newAssetAvgPrice) || 0, displayCurrency)}`,
        date: '1900-01-01',
        time: '00:00',
        metadata: cryptoMetadata,
        is_adjustment: 1,
      });

      if (!result || !result.id) {
        setFiatError('Failed to create historical adjustment — see console for details');
        return;
      }
      createdTxnId = result.id;
    } catch (err) {
      console.error('Failed to create historical adjustment:', err);
      setFiatError('Failed to create historical adjustment');
      return;
    }

    // Backend already pushed the new asset into wallet.metadata.assets during
    // finance:create-transaction. The merge logic (fix #4) ensures no duplicates.
    // Update frontend state to reflect the new asset list.
    const finalAssets = [...newAssets];
    if (createdTxnId && finalAssets.length > 0) {
      finalAssets[finalAssets.length - 1] = { ...finalAssets[finalAssets.length - 1], txn_id: createdTxnId };
    }
    onChange('assets', JSON.stringify(finalAssets));
    setShowAddAsset(false);
    setSearchCoin('');
    setSelectedCoinId('');
    setSelectedAssetType('crypto');
    setNewAssetAmount('');
    setNewAssetAvgPrice('');
    setNewTotalSpent('');
    setAddMode('manual');
    setSearchResults([]);
    setFiatError(null);
  };

  const handleRemoveAsset = async (idx: number) => {
    if (idx < 0) return;
    const removed = assets[idx];
    const coinId = (removed?.coin_id || '').toLowerCase();

    // Find and delete ALL transactions related to this crypto coin in this wallet
    try {
      const allTxns = await (window as any).deskflowAPI?.financeGetTransactions() as any[];
      if (Array.isArray(allTxns)) {
        const relatedTxns = allTxns.filter((t: any) => {
          if (t.wallet_id !== wallet.id) return false;
          if (!t.metadata) return false;
          try {
            const m = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
            const txnCoinId = (m.coinId || m.coin_id || '').toLowerCase();
            return txnCoinId === coinId;
          } catch { return false; }
        });
        for (const txn of relatedTxns) {
          try {
            await (window as any).deskflowAPI?.financeDeleteTransaction(txn.id);
          } catch { /* best-effort per transaction */ }
        }
      }
    } catch { /* fallback: at least delete the linked txn */
      if (removed?.txn_id) {
        try { await (window as any).deskflowAPI?.financeDeleteTransaction(removed.txn_id); } catch {}
      }
    }

    const newAssets = assets.filter((_, i) => i !== idx);
    onChange('assets', JSON.stringify(newAssets));
  };

  const handleStartEdit = (idx: number) => {
    if (idx < 0 || idx >= assets.length) return;
    const a = assets[idx];
    setEditingCoinIdx(idx);
    setEditAmount(String(a.amount));
    setEditAvgPrice(String(a.avg_buy_price));
  };

  const handleSaveEdit = () => {
    if (editingCoinIdx === null) return;
    const newAssets = [...assets];
    newAssets[editingCoinIdx] = {
      ...newAssets[editingCoinIdx],
      amount: parseFloat(editAmount) || 0,
      avg_buy_price: parseFloat(editAvgPrice) || 0,
    };
    onChange('assets', JSON.stringify(newAssets));
    setEditingCoinIdx(null);
    setEditAmount('');
    setEditAvgPrice('');
  };

  // MUST be before early return to satisfy React hooks rules
  const displayAssets = useMemo(() => {
    const list = assets.map(a => ({
      ...a,
      isFiat: false
    }));
    if (availableFiat > 0) {
      list.unshift({
        coin_id: 'fiat-available',
        symbol: getCurrencyInfo(displayCurrency).symbol,
        name: 'Available Fiat',
        amount: availableFiat,
        avg_buy_price: 1,
        isFiat: true
      });
    }
    return list;
  }, [assets, availableFiat, displayCurrency]);

  if (!hasAssets) {
    return (
      <div className="space-y-3">
        {/* Empty state — big, friendly, impossible to miss */}
        <div className="flex flex-col items-center py-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-[#8B5CF6]" />
          </div>
          <p className="text-base text-white font-semibold">This wallet is empty</p>
          {fiatBalance > 0 && (
            <div className="mt-3 px-4 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <span className="text-[10px] text-emerald-400/70">Available to invest</span>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{fmtMoney(fiatBalance)}</p>
            </div>
          )}
          <p className="text-[11px] text-zinc-500 mt-2.5 max-w-[240px] leading-relaxed">
            {fiatBalance > 0
              ? 'You have funds deposited — add the cryptocurrencies you own to see live prices and portfolio value.'
              : 'Add the cryptocurrencies you own to see live prices, portfolio value, and performance charts.'
            }
          </p>
          <button onClick={() => setShowAddAsset(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white text-sm font-medium transition-all mt-5 shadow-lg shadow-[#8B5CF6]/20">
            <Plus className="w-4 h-4" /> Add Your First Coin
          </button>
        </div>

        {/* Add Asset Form — must be inside early return so it actually renders */}
        {showAddAsset && (
      <GlassSurface tier={2} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-[#8B5CF6]/20 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-[#8B5CF6]" />
              </div>
              <div className="text-sm font-medium text-white">Add a Coin</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Select Coin</label>
                <input
                  value={searchCoin}
                  onChange={e => { setSearchCoin(e.target.value); setSelectedCoinId(''); }}
                  placeholder="Search coins (e.g. Bitcoin, BTC)"
                  autoFocus
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50"
                />
                {searching && (
                  <div className="mt-1.5 flex items-center gap-2 px-3 py-2 text-[10px] text-zinc-500">
                    <div className="w-3 h-3 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                    Searching across markets...
                  </div>
                )}
                {!searching && filteredCoins.length > 0 && (
                  <div className="mt-1.5 max-h-[180px] overflow-y-auto rounded-lg border border-zinc-700/30 bg-zinc-800/60">
                    {filteredCoins.map((coin: any) => {
                      const key = coin.symbol || coin.id;
                      const isSelected = selectedCoinId === key;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSelectCoin(coin)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-700/40 ${isSelected ? 'bg-[#8B5CF6]/10' : ''}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-white font-medium truncate">{coin.name}</span>
                            <span className="text-[10px] text-zinc-500 shrink-0">{coin.symbol || coin.id}</span>
                          </div>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {canUseCustom && (
                  <button onClick={handleUseCustom}
                    className="mt-1.5 w-full text-left px-3 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/40 border border-zinc-700/30 transition-colors">
                    <span className="text-[10px] text-zinc-400">Not in the list? </span>
                    <span className="text-[10px] text-[#A78BFA] font-medium">Use '{searchCoin.trim().toLowerCase().replace(/\s+/g, '-')}' as CoinGecko ID</span>
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setAddMode('manual'); setNewTotalSpent(''); }}
                  className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${addMode === 'manual' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'}`}>
                  Manual
                </button>
                <button onClick={() => { setAddMode('from-spend'); setNewAssetAmount(''); }}
                  className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${addMode === 'from-spend' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'}`}>
                  From Spend
                </button>
              </div>
              {addMode === 'manual' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Amount You Own</label>
                    <CurrencyInput value={newAssetAmount} onChange={(v) => setNewAssetAmount(String(v))} placeholder="0.00"
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Avg Buy Price <span className="text-zinc-600 font-normal">(optional)</span></label>
                    <CurrencyInput value={newAssetAvgPrice} onChange={(v) => setNewAssetAvgPrice(String(v))} placeholder={`${sym}0.00`}
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Total Spent</label>
                    <CurrencyInput value={newTotalSpent} onChange={(v) => setNewTotalSpent(String(v))} placeholder={`${sym}0.00`}
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50" />
                    <p className="text-[9px] text-zinc-600 mt-1">Total money you put into this coin</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Avg Buy Price</label>
                    <CurrencyInput value={newAssetAvgPrice} onChange={(v) => setNewAssetAvgPrice(String(v))} placeholder={`${sym}0.00`}
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50" />
                    <p className="text-[9px] text-zinc-600 mt-1">Amount = Total Spent &divide; Avg Buy Price</p>
                  </div>
                </div>
              )}
              {addMode === 'from-spend' && parseFloat(newTotalSpent) > 0 && parseFloat(newAssetAvgPrice) > 0 && (
                <div className="px-3 py-2 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-center">
                  <span className="text-[10px] text-zinc-500">You'll receive </span>
                  <span className="text-xs font-semibold text-[#8B5CF6]">{(parseFloat(newTotalSpent) / parseFloat(newAssetAvgPrice)).toFixed(8)} {selectedCoinId.split('-').pop()?.toUpperCase() || 'COIN'}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleAddAsset}
                  disabled={!selectedCoinId || (addMode === 'manual' ? !newAssetAmount || !newAssetAvgPrice : (!newTotalSpent || !newAssetAvgPrice))}
                  className="flex-1 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all">
                  Add Coin
                </button>
                <button onClick={() => { setShowAddAsset(false); setSearchCoin(''); setSelectedCoinId(''); setNewAssetAmount(''); setNewAssetAvgPrice(''); setNewTotalSpent(''); setAddMode('manual'); }}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </GlassSurface>
        )}

        {/* Wallet metadata fields — demoted below the CTA */}
        <GlassSurface tier={2} className="p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Wallet Details</div>
          <div className="space-y-1">
            <FieldRow label="Blockchain" value={metadata.blockchain} onChange={v => onChange('blockchain', v)} />
            <FieldRow label="Wallet Address" value={metadata.wallet_address} masked />
            <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
          </div>
        </GlassSurface>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loadingPrices && prices.length === 0 && (
        <div className="animate-pulse space-y-3">
          <GlassSurface tier={2} className="p-4"><div className="h-14" /></GlassSurface>
          <GlassSurface tier={2} className="p-3"><div className="h-[220px]" /></GlassSurface>
        </div>
      )}

      {error && !loadingPrices && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /><span>{error}</span>
          <button onClick={() => { setLoadingPrices(true); setError(null); }} className="ml-auto text-[10px] underline hover:no-underline">Retry</button>
        </div>
      )}

      {stale && !error && !loadingPrices && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /><span>Cached prices from {ago || 'earlier'}</span>
        </div>
      )}

      <GlassSurface tier={2} className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Portfolio Value</div>
            <div className="text-xl font-bold text-white tabular-nums mt-1">{prices.length > 0 ? fmtMoney(totalValue) : fmtMoney(availableFiat)}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-zinc-500">{fmtMoney(cryptoPortfolioValue)} crypto</span>
              {totalCost > 0 && (
                <>
                  <span className="text-[10px] text-zinc-600">+</span>
                  <span className="text-[10px] text-zinc-400">{fmtMoney(availableFiat)} available</span>
                </>
              )}
            </div>
          </div>
          {pc24h !== null && (
            <div className={`text-right ${pc24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <div className="text-sm font-semibold tabular-nums">{fmtPct(pc24h)}%</div>
              <div className="text-[10px] opacity-70">24h</div>
            </div>
          )}
        </div>
        {/* Fiat balance breakdown */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 text-[11px]">
          {totalSpent > 0 && (
            <>
              <span className="text-zinc-500">Spent</span>
              <span className="text-zinc-400 tabular-nums">{fmtMoney(totalSpent)}</span>
              <span className="text-zinc-600">·</span>
            </>
          )}
          <span className="text-zinc-500">Available</span>
          <span className={`font-medium tabular-nums ${availableFiat > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(availableFiat)}</span>
        </div>
        {totalCost > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 text-[11px]">
            <span className="text-zinc-500">P&amp;L</span>
            <span className={`font-medium tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtMoney(totalPnl)}
            </span>
            <span className={`tabular-nums ${totalPnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              ({fmtPct(totalPnlPct, 1)}%)
            </span>
          </div>
        )}
      </GlassSurface>

      <GlassSurface tier={2} className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Performance</div>
          <div className="flex items-center gap-1">
            {/* Chart mode toggle */}
            <div className="flex items-center gap-0.5 mr-2 bg-zinc-800/50 rounded p-0.5">
              <button onClick={() => setChartMode('price')}
                className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${chartMode === 'price' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Price
              </button>
              <button onClick={() => setChartMode('quantity')}
                className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${chartMode === 'quantity' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Qty
              </button>
              <button onClick={() => setChartMode('value')}
                className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${chartMode === 'value' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                Value
              </button>
            </div>
            {TIMEFRAMES.map(tf => (
              <button key={tf.label} onClick={() => setTimeframeDays(tf.days)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${timeframeDays === tf.days ? 'bg-[#8B5CF6]/20 text-[#8B5CF6] shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[220px]">
          {lineData ? <Line data={lineData} options={lineOpts} />
            : loadingHistory ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-zinc-600">Loading chart&hellip;</span>
                </div>
              </div>
            ) : prices.length > 0 ? (
              <div className="h-full flex items-center justify-center"><span className="text-[10px] text-zinc-600">Chart data unavailable</span></div>
            ) : null}
        </div>
      </GlassSurface>

      {donutData && (
        <GlassSurface tier={2} className="p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-3">Allocation</div>
          <div className="h-[160px]"><Doughnut data={donutData} options={donutOpts} /></div>
        </GlassSurface>
      )}

      <GlassSurface tier={2} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Assets</div>
          <button onClick={() => setShowAddAsset(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors">
            <Plus className="w-3 h-3" /> {isInvestment ? 'Add Asset' : 'Add Coin'}
          </button>
        </div>
         <div className="space-y-1">
            {displayAssets.map((a, idx) => {
              const isFiat = a.isFiat;
              const assetIdx = isFiat ? -1 : assets.findIndex(x => x.coin_id === a.coin_id);
             const p = !isFiat ? prices.find(pr => pr.coin_id === a.coin_id) : null;
             const price = isFiat ? 1 : (p?.current_price || 0);
             const change = !isFiat ? p?.price_change_percentage_24h : null;
             const value = a.amount * price;
             const assetPnl = !isFiat ? value - (a.amount * a.avg_buy_price) : 0;
             const assetPnlPct = !isFiat && a.avg_buy_price > 0 ? (assetPnl / (a.amount * a.avg_buy_price)) * 100 : 0;
             const isEditing = !isFiat && editingCoinIdx === idx;
             return (
               <div key={idx} className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors cursor-pointer ${isFiat ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-zinc-800/20 hover:bg-zinc-800/40'}`}
                onClick={() => !isFiat && !isEditing && setDetailAsset({ coinId: a.coin_id, symbol: a.symbol || a.coin_id, name: a.name || a.symbol || a.coin_id })}>
                 <div className="flex items-center gap-2.5 min-w-0 flex-1">
                   <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isFiat ? 'bg-emerald-500/15' : 'bg-[#8B5CF6]/15'}`}>
                     <span className={`text-[10px] font-bold ${isFiat ? 'text-emerald-400' : 'text-[#8B5CF6]'}`}>{a.symbol ? a.symbol.slice(0, 2) : '?'}</span>
                   </div>
                   <div className="min-w-0">
                     <div className="flex items-center gap-1.5">
                       <span className="text-xs text-zinc-200 font-medium">{a.symbol || a.coin_id}</span>
                       {a.name && a.name !== a.symbol && <span className="text-[10px] text-zinc-500">{a.name}</span>}
                     </div>
                     {isEditing ? (
                       <div className="flex items-center gap-1 mt-1">
                         <CurrencyInput value={editAmount} onChange={(v) => setEditAmount(String(v))}
                           className="w-20 bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-[10px] text-white tabular-nums" placeholder="0" />
                         <span className="text-[9px] text-zinc-600">@</span>
                         <CurrencyInput value={editAvgPrice} onChange={(v) => setEditAvgPrice(String(v))}
                           className="w-20 bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-[10px] text-white tabular-nums" placeholder="0.00" />
                         <button onClick={handleSaveEdit}
                           className="px-2 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Save</button>
                         <button onClick={() => setEditingCoinIdx(null)}
                           className="px-2 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors">X</button>
                       </div>
                     ) : (
                       <div className="flex items-center gap-2 text-[10px] text-zinc-500 tabular-nums">
                         <span>{fmtAmount(a.amount)} {a.symbol}</span>
                         {!isFiat && a.avg_buy_price > 0 && (
                           <>
                             <span className="text-zinc-700">@</span>
                             <span>{fmtMoney(a.avg_buy_price)}</span>
                           </>
                         )}
                         {!isFiat && price > 0 && (
                           <>
                             <span className="text-zinc-700">now</span>
                             <span className={change !== null && change >= 0 ? 'text-emerald-400/60' : change !== null ? 'text-red-400/60' : 'text-zinc-500'}>{fmtMoney(price)}</span>
                           </>
                         )}
                       </div>
                     )}
                   </div>
                 </div>
                 <div className="text-right shrink-0 ml-2">
                   <div className="text-xs text-zinc-200 tabular-nums">{fmtMoney(value)}</div>
                   <div className="flex items-center gap-1.5 justify-end">
                     {!isFiat && change !== null && (
                       <span className={`text-[10px] tabular-nums ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                         {fmtPct(change, 1)}%
                       </span>
                     )}
                     {!isFiat && a.avg_buy_price > 0 && (
                       <span className={`text-[10px] tabular-nums ${assetPnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                         {fmtPct(assetPnlPct, 1)}%
                       </span>
                     )}
                   </div>
                 </div>
                 {!isFiat && (
                   <div className="flex flex-col gap-1 shrink-0 ml-2">
                      <button onClick={() => handleStartEdit(assetIdx)} className="p-1 rounded text-zinc-600 hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 transition-colors">
                       <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                     </button>
                      <button onClick={() => handleRemoveAsset(assetIdx)} className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                       <Trash2 className="w-3 h-3" />
                     </button>
                  </div>
                 )}
               </div>
             );
           })}
           </div>
         </GlassSurface>

      {showAddAsset && (
        <GlassSurface tier={2} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-[#8B5CF6]/20 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </div>
            <div className="text-sm font-medium text-white">Add a Coin</div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="block text-[10px] font-medium text-zinc-400">{isInvestment ? 'Search Assets' : 'Select Coin'}</label>
              </div>
              <input
                value={searchCoin}
                onChange={e => { setSearchCoin(e.target.value); setSelectedCoinId(''); }}
                placeholder={isInvestment ? "Search stocks, ETFs, gold, crypto..." : "Search coins (e.g. Bitcoin, BTC)"}
                autoFocus
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50"
              />
              {searching && (
                <div className="mt-1.5 flex items-center gap-2 px-3 py-2 text-[10px] text-zinc-500">
                  <div className="w-3 h-3 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                  Searching across markets...
                </div>
              )}
              {!searching && filteredCoins.length > 0 && (
                <div className="mt-1.5 max-h-[180px] overflow-y-auto rounded-lg border border-zinc-700/30 bg-zinc-800/60">
                  {filteredCoins.map((coin: any) => {
                    const key = coin.symbol || coin.id;
                    const isSelected = selectedCoinId === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectCoin(coin)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-700/40 ${isSelected ? 'bg-[#8B5CF6]/10' : ''}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-white font-medium truncate">{coin.name}</span>
                          <span className="text-[10px] text-zinc-500 shrink-0">{coin.symbol || coin.id}</span>
                          {coin.asset_type && coin.asset_type !== 'crypto' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 shrink-0">{coin.asset_type}</span>
                          )}
                          {coin.exchange && coin.exchange !== 'CoinGecko' && (
                            <span className="text-[9px] text-zinc-600 truncate">{coin.exchange}</span>
                          )}
                        </div>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {canUseCustom && (
                <button
                  onClick={handleUseCustom}
                  className="mt-1.5 w-full text-left px-3 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/40 border border-zinc-700/30 transition-colors"
                >
                  <span className="text-[10px] text-zinc-400">Not in the list? </span>
                  <span className="text-[10px] text-[#A78BFA] font-medium">Use '{searchCoin.trim().toLowerCase().replace(/\s+/g, '-')}' as CoinGecko ID</span>
                </button>
              )}
            </div>

            {/* Input mode toggle */}
            <div className="flex gap-2">
              <button onClick={() => { setAddMode('manual'); setNewTotalSpent(''); }}
                className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${addMode === 'manual' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'}`}>
                Manual
              </button>
              <button onClick={() => { setAddMode('from-spend'); setNewAssetAmount(''); }}
                className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${addMode === 'from-spend' ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'}`}>
                From Spend
              </button>
            </div>

            {addMode === 'manual' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Amount You Own</label>
                  <CurrencyInput
                    value={newAssetAmount}
                    onChange={(v) => setNewAssetAmount(String(v))}
                    placeholder="0.00"
                    className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Avg Buy Price <span className="text-zinc-600 font-normal">(optional)</span></label>
                  <CurrencyInput
                    value={newAssetAvgPrice}
                    onChange={(v) => setNewAssetAvgPrice(String(v))}
                    placeholder={`${sym}0.00`}
                    className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Total Spent</label>
                  <CurrencyInput
                    value={newTotalSpent}
                    onChange={(v) => setNewTotalSpent(String(v))}
                    placeholder={`${sym}0.00`}
                    className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50"
                  />
                  <p className="text-[9px] text-zinc-600 mt-1">Total money you put into this coin</p>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-400 mb-1.5">Avg Buy Price</label>
                  <CurrencyInput
                    value={newAssetAvgPrice}
                    onChange={(v) => setNewAssetAvgPrice(String(v))}
                    placeholder={`${sym}0.00`}
                    className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#8B5CF6]/50"
                  />
                  <p className="text-[9px] text-zinc-600 mt-1">Amount = Total Spent &divide; Avg Buy Price</p>
                </div>
              </div>
            )}
            {addMode === 'from-spend' && parseFloat(newTotalSpent) > 0 && parseFloat(newAssetAvgPrice) > 0 && (
              <div className="px-3 py-2 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-center">
                <span className="text-[10px] text-zinc-500">You'll receive </span>
                <span className="text-xs font-semibold text-[#8B5CF6]">{(parseFloat(newTotalSpent) / parseFloat(newAssetAvgPrice)).toFixed(8)} {selectedCoinId.split('-').pop()?.toUpperCase() || 'COIN'}</span>
              </div>
            )}

            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Live prices are fetched from <strong className="text-zinc-400">CoinGecko</strong>. To track individual buys, sells, and fees, use the <strong className="text-zinc-400">Transactions</strong> tab.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleAddAsset}
                disabled={!selectedCoinId || (addMode === 'manual' ? !newAssetAmount : (!newTotalSpent || !newAssetAvgPrice))}
                className="flex-1 py-2.5 rounded-lg bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
              >
                {isInvestment ? 'Add Asset' : 'Add Coin'}
              </button>
              <button
                onClick={() => { setShowAddAsset(false); setSearchCoin(''); setSelectedCoinId(''); setNewAssetAmount(''); setNewAssetAvgPrice(''); setNewTotalSpent(''); setAddMode('manual'); }}
                className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </GlassSurface>
      )}

      {totalCost > 0 && (
        <GlassSurface tier={2} className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Total P&amp;L</span>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtMoney(totalPnl)}
              </span>
              <span className={`text-[10px] tabular-nums ${totalPnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                ({fmtPct(totalPnlPct, 1)}%)
              </span>
            </div>
          </div>
        </GlassSurface>
      )}

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Wallet Details</div>
        <div className="space-y-1">
          <FieldRow label="Blockchain" value={metadata.blockchain} onChange={v => onChange('blockchain', v)} />
          <FieldRow label="Wallet Address" value={metadata.wallet_address} masked />
          <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
        </div>
      </GlassSurface>

      {walletTransactions && walletTransactions.length > 0 && (
        <GlassSurface tier={2} className="p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Transfers & Transactions</div>
          <TransactionList transactions={walletTransactions} displayCurrency={displayCurrency} onTxnClick={onTxnClick} walletId={wallet.id} />
        </GlassSurface>
      )}

      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-zinc-600">
          Prices from CoinGecko{ago ? <span className="text-zinc-700"> &middot; Updated {ago}</span> : ''}
        </span>
        <button onClick={() => { setLoadingPrices(true); setError(null); }} disabled={loadingPrices}
          className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${loadingPrices ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {detailAsset && (
        <CryptoAssetDetailModal
          open={!!detailAsset}
          onClose={() => setDetailAsset(null)}
          coinId={detailAsset.coinId}
          symbol={detailAsset.symbol}
          name={detailAsset.name}
          amount={assets.find(a => a.coin_id === detailAsset.coinId)?.amount || 0}
          avgBuyPrice={assets.find(a => a.coin_id === detailAsset.coinId)?.avg_buy_price || 0}
          currentPrice={prices.find(p => p.coin_id === detailAsset.coinId)?.current_price || 0}
          priceChange24h={prices.find(p => p.coin_id === detailAsset.coinId)?.price_change_percentage_24h ?? null}
          displayCurrency={displayCurrency}
          transactions={transactions || []}
          walletId={wallet.id}
        />
      )}
    </div>
  );
}

function CashDetail({ metadata, onChange, onDenominationsChange, displayCurrency, onTotalValueChange, onTxnClick }: {
  metadata: Record<string, any>; onChange: (k: string, v: string) => void;
  onDenominationsChange: (d: CashDenomination[]) => void; displayCurrency: string;
  onTotalValueChange?: (v: number) => void; onTxnClick?: (txn: FinanceTransaction) => void;
}) {
  const sym = getCurrencyInfo(displayCurrency).symbol;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtSym = (v: number) => showNumbers ? `${sym}${v.toFixed(2)}` : maskNumber(`${sym}${v.toFixed(2)}`, maskMode, maskFixedValue);
  const denoms: CashDenomination[] = useMemo(() => {
    if (Array.isArray(metadata.denominations) && metadata.denominations.length > 0) return metadata.denominations;
    return getDenominations(displayCurrency).map(d => ({ value: d.value, label: d.label, count: 0 }));
  }, [metadata.denominations, displayCurrency]);

  const total = useMemo(() => denoms.reduce((s, d) => s + d.value * d.count, 0), [denoms]);
  const isEmpty = denoms.every(d => d.count === 0);

  useEffect(() => { onTotalValueChange?.(total); }, [total, onTotalValueChange]);

  const updateCount = (idx: number, count: number) => {
    const next = [...denoms];
    next[idx] = { ...next[idx], count: Math.max(0, count) };
    onDenominationsChange(next);
  };

  const quickAdd = (value: number) => {
    const idx = denoms.findIndex(d => d.value === value);
    if (idx >= 0) updateCount(idx, denoms[idx].count + 1);
  };

  return (
    <div className="space-y-4">
      <GlassSurface tier={2} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Denominations</div>
          <div className="text-sm font-semibold text-white tabular-nums">{fmtSym(total)}</div>
        </div>

        {isEmpty && (
          <div className="text-center py-4 mb-3">
            <p className="text-xs text-zinc-500">Enter your physical cash by adding bills below.</p>
          </div>
        )}

        <div className="space-y-1">
          {denoms.map((d, i) => (
            <div key={d.label} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-800/30">
              <span className="text-xs text-zinc-300 w-14">{d.label}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => updateCount(i, d.count - 1)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/50 text-sm">-</button>
                <span className="text-xs tabular-nums text-zinc-200 w-8 text-center">{d.count}</span>
                <button onClick={() => updateCount(i, d.count + 1)} className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/50 text-sm">+</button>
              </div>
              <span className="text-xs tabular-nums text-zinc-400 w-20 text-right">{fmtSym(d.value * d.count)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-3 mt-2 border-t border-white/5">
          <span className="text-xs font-medium text-zinc-300">Total</span>
          <span className="text-sm font-bold text-white tabular-nums">{fmtSym(total)}</span>
        </div>
      </GlassSurface>

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Quick Add</div>
        <div className="flex flex-wrap gap-1.5">
          {getDenominations(displayCurrency).filter(d => d.value >= 1).map(d => (
            <button key={d.value} onClick={() => quickAdd(d.value)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-300 hover:text-white hover:bg-zinc-700/50 text-[10px] font-medium transition-colors">
              +{d.label}
            </button>
          ))}
        </div>
      </GlassSurface>

      <GlassSurface tier={2} className="p-4">
        <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
      </GlassSurface>
    </div>
  );
}

function PhysicalDetail({ metadata, onChange, onDenominationsChange, transactions, displayCurrency, onTotalValueChange, walletId, onTxnClick }: {
  metadata: Record<string, any>; onChange: (k: string, v: string) => void;
  onDenominationsChange: (d: CashDenomination[]) => void; transactions: FinanceTransaction[]; displayCurrency: string;
  onTotalValueChange?: (v: number) => void; walletId?: number; onTxnClick?: (txn: FinanceTransaction) => void;
}) {
  const sym = getCurrencyInfo(displayCurrency).symbol;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtSym = (v: number) => showNumbers ? `${sym}${v.toFixed(2)}` : maskNumber(`${sym}${v.toFixed(2)}`, maskMode, maskFixedValue);
  const [editingCards, setEditingCards] = useState(false);
  const denoms: CashDenomination[] = useMemo(() => {
    if (Array.isArray(metadata.denominations) && metadata.denominations.length > 0) return metadata.denominations;
    return getDenominations(displayCurrency).map(d => ({ value: d.value, label: d.label, count: 0 }));
  }, [metadata.denominations, displayCurrency]);

  const cards: Array<{ name: string; type: string; last4?: string }> = useMemo(() => {
    return Array.isArray(metadata.cards) ? metadata.cards : [];
  }, [metadata.cards]);

  const total = useMemo(() => denoms.reduce((s, d) => s + d.value * d.count, 0), [denoms]);
  const isEmpty = denoms.every(d => d.count === 0);

  useEffect(() => { onTotalValueChange?.(total); }, [total, onTotalValueChange]);

  const updateCount = (idx: number, count: number) => {
    const next = [...denoms];
    next[idx] = { ...next[idx], count: Math.max(0, count) };
    onDenominationsChange(next);
  };

  const addCard = () => {
    const next = [...cards, { name: '', type: 'debit', last4: '' }];
    onChange('cards', JSON.stringify(next));
  };

  const updateCard = (idx: number, field: string, value: string) => {
    const next = [...cards];
    next[idx] = { ...next[idx], [field]: value };
    onChange('cards', JSON.stringify(next));
  };

  const removeCard = (idx: number) => {
    const next = cards.filter((_, i) => i !== idx);
    onChange('cards', JSON.stringify(next));
  };

  const walletTxns = useMemo(() =>
    transactions.filter(t => t.type === 'expense' || t.type === 'income' || t.type === 'transfer'),
    [transactions]
  );

  return (
    <div className="space-y-4">
      <GlassSurface tier={2} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Wallet Contents</div>
          <div className="text-sm font-semibold text-white tabular-nums">{fmtSym(total)}</div>
        </div>

        {isEmpty && (
          <div className="text-center py-4 mb-3">
            <p className="text-xs text-zinc-500">No cash counted yet. Add bills using the controls below.</p>
          </div>
        )}

        <div className="space-y-1">
          {denoms.map((d, i) => (
            <div key={d.label} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-800/30">
              <span className="text-xs text-zinc-300 w-14">{d.label}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => updateCount(i, d.count - 1)}
                  className="h-11 w-11 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/50 active:scale-95 text-sm transition-all">-</button>
                <span className="text-xs tabular-nums text-zinc-200 w-12 text-center">{d.count}</span>
                <button onClick={() => updateCount(i, d.count + 1)}
                  className="h-11 w-11 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/50 active:scale-95 text-sm transition-all">+</button>
              </div>
              <span className="text-sm tabular-nums text-zinc-400 w-24 text-right">{fmtSym(d.value * d.count)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-3 mt-2 border-t border-zinc-700/50">
          <span className="text-xs font-medium text-zinc-300">Total</span>
          <span className="text-xl font-bold text-white tabular-nums">{fmtSym(total)}</span>
        </div>
      </GlassSurface>

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Quick Add</div>
        <div className="flex flex-wrap gap-2">
          {getDenominations(displayCurrency).filter(d => d.value >= 1).map(d => (
            <button key={d.value} onClick={() => {
              const idx = denoms.findIndex(x => x.value === d.value);
              if (idx >= 0) updateCount(idx, denoms[idx].count + 1);
            }}
            className="h-11 px-4 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20 hover:bg-[#F97316]/20 active:scale-95 text-[10px] font-medium transition-all">
              +{d.label}
            </button>
          ))}
        </div>
      </GlassSurface>

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Description</div>
        <div className="space-y-2">
          <input
            value={metadata.description || ''}
            onChange={e => onChange('description', e.target.value)}
            placeholder="Where is this wallet? (e.g. Brown leather bifold)"
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
          />
          <textarea
            value={metadata.notes || ''}
            onChange={e => onChange('notes', e.target.value)}
            placeholder="Notes..."
            rows={2}
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 resize-none"
          />
        </div>
      </GlassSurface>

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Recent Transactions</div>
        {walletTxns.length === 0 ? (
          <div className="text-center py-4 text-xs text-zinc-500">No transactions yet. Tap + to add one.</div>
        ) : (
          <TransactionList transactions={walletTxns} displayCurrency={displayCurrency} walletId={walletId} onTxnClick={onTxnClick} />
        )}
      </GlassSurface>

      {/* Cards & Items */}
      <GlassSurface tier={2} className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Cards & Items</div>
          <div className="flex items-center gap-1.5">
            {editingCards && (
              <button onClick={addCard} className="text-[10px] px-2 py-1 rounded-lg bg-[#F97316]/10 text-[#F97316] hover:bg-[#F97316]/20 transition-colors">+ Add</button>
            )}
            <button onClick={() => setEditingCards(v => !v)}
              className="text-[10px] px-2 py-1 rounded-lg bg-zinc-700/40 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors">
              {editingCards ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>
        {cards.length === 0 ? (
          <p className="text-[11px] text-zinc-600 text-center py-3">No cards stored. Click "Edit" then "Add" to track cards in this wallet.</p>
        ) : editingCards ? (
          <div className="space-y-2">
            {cards.map((card, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/30">
                <select value={card.type} onChange={e => updateCard(i, 'type', e.target.value)}
                  className="bg-zinc-800 text-[10px] text-zinc-300 rounded border border-zinc-700/50 px-1.5 py-1 outline-none">
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                  <option value="id">ID</option>
                  <option value="transit">Transit</option>
                  <option value="other">Other</option>
                </select>
                <input value={card.name} onChange={e => updateCard(i, 'name', e.target.value)} placeholder="Card name"
                  className="flex-1 bg-zinc-800/50 text-[11px] text-zinc-200 rounded border border-zinc-700/50 px-2 py-1 outline-none" />
                <input value={card.last4 || ''} onChange={e => updateCard(i, 'last4', e.target.value)} placeholder="Last 4"
                  className="w-12 bg-zinc-800/50 text-[11px] text-zinc-200 rounded border border-zinc-700/50 px-2 py-1 outline-none text-center" />
                <button onClick={() => removeCard(i)} className="text-zinc-600 hover:text-red-400 text-xs px-1">×</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cards.map((card, i) => {
              const typeColors: Record<string, string> = {
                debit: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
                credit: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
                id: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                transit: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                other: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
              };
              const typeLabels: Record<string, string> = {
                debit: 'Debit', credit: 'Credit', id: 'ID', transit: 'Transit', other: 'Other',
              };
              return (
                <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] ${typeColors[card.type] || typeColors.other}`}>
                  <CreditCard className="w-3 h-3 opacity-70" />
                  <span className="font-medium text-zinc-200">{card.name || 'Unnamed'}</span>
                  {card.last4 && <span className="text-zinc-500">••••{card.last4}</span>}
                  <span className="text-[9px] uppercase tracking-wider opacity-60 ml-0.5">{typeLabels[card.type] || 'Other'}</span>
                </div>
              );
            })}
          </div>
        )}
      </GlassSurface>
    </div>
  );
}

function EwalletDetail({ metadata, onChange, transactions, displayCurrency, walletId, onTxnClick }: {
  metadata: Record<string, any>; onChange: (k: string, v: string) => void;
  transactions: FinanceTransaction[]; displayCurrency: string; walletId?: number; onTxnClick?: (txn: FinanceTransaction) => void;
}) {
  const [showAddLink, setShowAddLink] = useState(false);
  const [newProvider, setNewProvider] = useState('');
  const [newLastFour, setNewLastFour] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const linkedAccounts: { provider: string; lastFour?: string; label?: string }[] =
    Array.isArray(metadata.linkedAccounts) ? metadata.linkedAccounts : [];

  const handleAddLink = () => {
    if (!newProvider) return;
    const updated = [...linkedAccounts, { provider: newProvider, lastFour: newLastFour || undefined, label: newLabel || undefined }];
    onChange('linkedAccounts', JSON.stringify(updated));
    setShowAddLink(false); setNewProvider(''); setNewLastFour(''); setNewLabel('');
  };

  const handleRemoveLink = (idx: number) => {
    const updated = linkedAccounts.filter((_, i) => i !== idx);
    onChange('linkedAccounts', JSON.stringify(updated));
  };

  return (
    <div className="space-y-4">
      <GlassSurface tier={2} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Linked Payment Methods</div>
          <button onClick={() => setShowAddLink(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#06B6D4] hover:bg-[#06B6D4]/10 transition-colors">
            <Plus className="w-3 h-3" /> Link Card
          </button>
        </div>
        {linkedAccounts.length === 0 ? (
          <div className="text-center py-4 text-xs text-zinc-500">No linked payment methods</div>
        ) : (
          <div className="space-y-1">
            {linkedAccounts.map((link, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/30">
                <div className="flex items-center gap-2 min-w-0">
                  <CreditCard className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-300">{link.provider}{link.lastFour ? ` \u2022\u2022\u2022${link.lastFour}` : ''}</div>
                    {link.label && <div className="text-[10px] text-zinc-500">{link.label}</div>}
                  </div>
                </div>
                <button onClick={() => handleRemoveLink(idx)} className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                  <Unlink className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        </GlassSurface>

      {showAddLink && (
        <GlassSurface tier={2} className="p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Link New Card</div>
          <div className="space-y-2">
            <input value={newProvider} onChange={e => setNewProvider(e.target.value)} placeholder="Provider (e.g. Visa)"
              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/50" />
            <div className="flex gap-2">
              <input value={newLastFour} onChange={e => setNewLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Last 4" maxLength={4}
                className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/50" />
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (optional)"
                className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/50" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddLink} className="flex-1 py-2 rounded-lg bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-white text-xs font-medium transition-colors">Link</button>
              <button onClick={() => setShowAddLink(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors">Cancel</button>
            </div>
          </div>
        </GlassSurface>
      )}

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Details</div>
        <div className="space-y-1">
          <FieldRow label="Platform" value={metadata.platform} onChange={v => onChange('platform', v)} />
          <FieldRow label="Phone / Email" value={metadata.phone_or_email} onChange={v => onChange('phone_or_email', v)} />
          <FieldRow label="Daily Limit" value={metadata.daily_limit ?? ''} onChange={v => onChange('daily_limit', v)} type="number" />
          <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
        </div>
      </GlassSurface>

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Recent Transactions</div>
        <TransactionList transactions={transactions} displayCurrency={displayCurrency} walletId={walletId} onTxnClick={onTxnClick} />
      </GlassSurface>
    </div>
  );
}

function PrepaidCardDetail({ metadata, onChange, transactions, displayCurrency, walletId, onTxnClick }: {
  metadata: Record<string, any>; onChange: (k: string, v: string) => void;
  transactions: FinanceTransaction[]; displayCurrency: string; walletId?: number; onTxnClick?: (txn: FinanceTransaction) => void;
}) {
  const sym = getCurrencyInfo(displayCurrency).symbol;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtSym = (v: number) => showNumbers ? `${sym}${v.toFixed(2)}` : maskNumber(`${sym}${v.toFixed(2)}`, maskMode, maskFixedValue);

  const walletTxns = useMemo(() =>
    transactions.filter(t => t.type === 'expense' || t.type === 'income' || t.type === 'transfer'),
    [transactions]
  );

  const recentTxns = [...walletTxns]
    .sort((a, b) => `${b.date || ''}-${b.id}`.localeCompare(`${a.date || ''}-${a.id}`))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Card Info</div>
        <div className="space-y-1">
          <FieldRow label="Provider" value={metadata.provider} onChange={v => onChange('provider', v)} />
          <FieldRow label="Card Number" value={metadata.card_number} onChange={v => onChange('card_number', v)} placeholder="Last 4-6 digits" />
          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-800/30">
            <span className="text-[11px] text-zinc-400">Auto Top-Up</span>
            <button
              onClick={() => onChange('auto_topup', metadata.auto_topup ? 'false' : 'true')}
              className={`relative w-9 h-5 rounded-full transition-colors ${metadata.auto_topup === 'true' ? 'bg-[#22D3EE]' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${metadata.auto_topup === 'true' ? 'translate-x-4' : ''}`} />
            </button>
          </div>
          <FieldRow label="Top-Up Limit" value={metadata.top_up_limit} onChange={v => onChange('top_up_limit', v)} type="number" />
          <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
        </div>
      </GlassSurface>

      <GlassSurface tier={2} className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 mb-2">Recent Transactions</div>
        {recentTxns.length === 0 ? (
          <div className="text-center py-4 text-xs text-zinc-500">No transactions yet. Tap + to add one.</div>
        ) : (
          <TransactionList transactions={recentTxns} displayCurrency={displayCurrency} walletId={walletId} onTxnClick={onTxnClick} />
        )}
      </GlassSurface>
    </div>
  );
}

function OtherDetail({ metadata, onChange }: { metadata: Record<string, any>; onChange: (k: string, v: string) => void }) {
  return (
    <GlassSurface tier={2} className="p-4">
      <FieldRow label="Notes" value={metadata.notes} onChange={v => onChange('notes', v)} />
    </GlassSurface>
  );
}

export function WalletDetailView({ wallet, displayCurrency, transactions, wallets, accounts = [], categories = [], onBack, onSaveMetadata, onUpdateWallet, onDeleteWallet, onAddTransaction, onDirtyChange, onRecalculateBalance, onUpdateTransaction, onDeleteTransaction, onVerifyPassword, ftPersons = [], onAddFtPerson, onNotify, subscriptions }: WalletDetailViewProps) {
  const meta = walletMeta[wallet.type] || walletMeta.other;
  const WalletIcon = meta.icon;
  const [editName, setEditName] = useState(false);
  const [nameBuf, setNameBuf] = useState(wallet.name);
  const [localMetadata, setLocalMetadata] = useState<Record<string, any>>(wallet.metadata || {});
  const [saving, setSaving] = useState(false);
  const [editingFee, setEditingFee] = useState(false);
  const [localFeeType, setLocalFeeType] = useState(wallet.transfer_fee_type || 'none');
  const [localFeeValue, setLocalFeeValue] = useState(wallet.transfer_fee_value ?? 0);
  const [recalibrating, setRecalibrating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cryptoLiveTotal, setCryptoLiveTotal] = useState(0);
  const cryptoTotalRef = useRef(0);
  const [cashLiveTotal, setCashLiveTotal] = useState(0);
  const cashTotalRef = useRef(0);
  const [editingInitialBalance, setEditingInitialBalance] = useState(false);
  const [initialBalanceBuf, setInitialBalanceBuf] = useState('');
  const [initialBalancePassword, setInitialBalancePassword] = useState('');
  const [savingInitialBalance, setSavingInitialBalance] = useState(false);
  const [initialBalanceCooldown, setInitialBalanceCooldown] = useState<string | null>(null);
  const [detailTxn, setDetailTxn] = useState<FinanceTransaction | null>(null);
  const symbol = getCurrencyInfo(displayCurrency).symbol;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? fmtCurrency(v, displayCurrency) : maskNumber(fmtCurrency(v, displayCurrency), maskMode, maskFixedValue);
  // For crypto/investment wallets: fiat balance = sum of transfers IN (not wallet.balance which may be total cash)
  // For other wallets: fiat balance = wallet.balance (the actual balance in this wallet)
  const fiatBalance = wallet.balance || 0;
  const cryptoOnlyValue = cryptoLiveTotal;

  // For crypto/investment wallets: available fiat is simply the wallet balance
  // (wallet.balance already reflects all fiat transactions — buys, sells, transfers)
  const parentAvailableFiat = wallet.balance || 0;

  // Check if physical/cash wallet denominations are out of sync with balance
  const isPhysical = wallet.type === 'cash' || wallet.type === 'physical';
  const denominationTotal = useMemo(() => {
    if (!isPhysical) return null;
    const denoms = localMetadata.denominations;
    if (!Array.isArray(denoms)) return null;
    return denoms.reduce((sum: number, d: CashDenomination) => sum + (d.value || 0) * (d.count || 0), 0);
  }, [isPhysical, localMetadata.denominations]);
  const isOutOfSync = isPhysical && denominationTotal !== null && Math.abs(denominationTotal - wallet.balance) > 0.01;

  const walletTransactions = useMemo(() =>
    transactions.filter(t =>
      t.wallet_id === wallet.id ||
      (t as any).from_wallet_id === wallet.id ||
      (t as any).to_wallet_id === wallet.id
    ),
    [transactions, wallet.id]
  );

  // Sync from wallet.metadata on mount, wallet ID change, AND when backend metadata changes externally
  // (e.g. after a crypto transfer). Preserves user edits by detecting diff from last-synced snapshot.
  const walletIdRef = useRef(wallet.id);
  const lastSyncedMetaRef = useRef(JSON.stringify(wallet.metadata || {}));
  const userEditedMetaRef = useRef(false);
  const isSyncingFromPropRef = useRef(false);
  useEffect(() => {
    const metaJson = JSON.stringify(wallet.metadata || {});
    const prevJson = lastSyncedMetaRef.current;
    const isNewWallet = wallet.id !== walletIdRef.current;
    // Sync if: new wallet, OR metadata changed externally (even if user edited before)
    if (isNewWallet || metaJson !== prevJson) {
      walletIdRef.current = wallet.id;
      lastSyncedMetaRef.current = metaJson;
      userEditedMetaRef.current = false;
      isSyncingFromPropRef.current = true;
      setLocalMetadata(wallet.metadata || {});
      setNameBuf(wallet.name);
      setLocalFeeType(wallet.transfer_fee_type || 'none');
      setLocalFeeValue(wallet.transfer_fee_value ?? 0);
    }
  }, [wallet.id, wallet.metadata]);

  const isDirty = nameBuf !== wallet.name || JSON.stringify(localMetadata) !== JSON.stringify(wallet.metadata || {});
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  const handleMetadataChange = useCallback((key: string, value: string) => {
    userEditedMetaRef.current = true;
    let parsed: any = value;
    try { parsed = JSON.parse(value); } catch { /* keep as string */ }
    setLocalMetadata(prev => ({ ...prev, [key]: parsed }));
  }, []);

  // Auto-save assets to DB when they change (debounced)
  const assetsDirtyRef = useRef(false);
  useEffect(() => {
    // Skip auto-save if this state change came from prop sync (not user edit)
    if (isSyncingFromPropRef.current) {
      isSyncingFromPropRef.current = false;
      return;
    }
    assetsDirtyRef.current = true;
    const timer = setTimeout(() => {
      if (assetsDirtyRef.current) {
        assetsDirtyRef.current = false;
        onSaveMetadata(wallet.id, localMetadata).catch(() => {});
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localMetadata.assets]);

  const handleDenominationsChange = useCallback((d: CashDenomination[]) => {
    userEditedMetaRef.current = true;
    setLocalMetadata(prev => ({ ...prev, denominations: d }));
  }, []);

  const saveInitialBalance = async () => {
    const val = parseFloat(initialBalanceBuf.replace(/,/g, ''));
    if (isNaN(val)) return;
    if (!initialBalancePassword) return;
    setSavingInitialBalance(true);
    try {
      const result = await (window as any).deskflowAPI?.financeUpdateInitialBalance?.(wallet.id, val, initialBalancePassword);
      if (result?.success) {
        setEditingInitialBalance(false);
        setInitialBalancePassword('');
        setInitialBalanceCooldown(null);
        onNotify?.(`Initial balance updated to ${fmtCurrency(val, displayCurrency)}`, 'success');
        // Reload wallet data
        const freshWallets = await (window as any).deskflowAPI?.financeGetWallets?.();
        const freshWallet = freshWallets?.find((w: any) => w.id === wallet.id);
        if (freshWallet) {
          onUpdateWallet({ id: freshWallet.id, name: freshWallet.name, type: freshWallet.type, provider: freshWallet.provider, last_four: freshWallet.last_four, balance: freshWallet.balance, currency: freshWallet.currency });
        }
      } else if (result?.error) {
        onNotify?.(result.error, 'error');
        setInitialBalanceCooldown(result.error);
      }
    } finally { setSavingInitialBalance(false); }
  };

  const handleSave = async (silent = false) => {
    setSaving(true);
    try {
      let newBalance = wallet.balance;
      if ((wallet.type === 'cash' || wallet.type === 'physical') && cashTotalRef.current > 0) {
        newBalance = cashTotalRef.current;
      } else if ((wallet.type === 'cash' || wallet.type === 'physical') && Array.isArray(localMetadata.denominations)) {
        newBalance = localMetadata.denominations.reduce((sum: number, d: CashDenomination) => sum + d.value * d.count, 0);
      }
      // For crypto wallets: balance is managed by transaction operations (buy/sell/transfer),
      // NOT by save. Never overwrite it here with market value.
      const needsWalletUpdate = nameBuf !== wallet.name || Math.abs(newBalance - wallet.balance) > 0.001;
      if (needsWalletUpdate) {
        await onUpdateWallet({
          id: wallet.id, name: nameBuf, type: wallet.type,
          provider: wallet.provider || undefined, last_four: wallet.last_four || undefined,
          balance: newBalance, currency: wallet.currency,
        });
      }
      await onSaveMetadata(wallet.id, localMetadata);
      onDirtyChange?.(false);
      if (!silent) {
        onNotify?.('Wallet saved successfully', 'success');
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      if (!silent) onNotify?.('Failed to save wallet', 'error');
    } finally { setSaving(false); }
  };

  // Listen for auto-save events from FinancePage
  useEffect(() => {
    const handleAutoSave = () => {
      if (isDirty) handleSave(true);
    };
    window.addEventListener('finance-auto-save', handleAutoSave);
    return () => window.removeEventListener('finance-auto-save', handleAutoSave);
  }, [isDirty, handleSave]);

  const renderDetailBody = () => {
    switch (wallet.type) {
      case 'bank': return <BankDetail metadata={localMetadata} onChange={handleMetadataChange} transactions={walletTransactions} displayCurrency={displayCurrency} walletId={wallet.id} onTxnClick={setDetailTxn} />;
      case 'debit_card': return <DebitCardDetail metadata={localMetadata} onChange={handleMetadataChange} transactions={walletTransactions} displayCurrency={displayCurrency} wallets={wallets} walletId={wallet.id} onTxnClick={setDetailTxn} />;
      case 'credit_card': return <CreditCardDetail metadata={localMetadata} onChange={handleMetadataChange} wallet={wallet} transactions={walletTransactions} displayCurrency={displayCurrency} />;
      case 'crypto': return <CryptoDetail metadata={localMetadata} onChange={handleMetadataChange} wallet={wallet} displayCurrency={displayCurrency} onTotalValueChange={v => { cryptoTotalRef.current = v; setCryptoLiveTotal(v); }} transactions={transactions} walletTransactions={walletTransactions} onTxnClick={setDetailTxn} />;
      case 'investment': return <CryptoDetail metadata={localMetadata} onChange={handleMetadataChange} wallet={wallet} displayCurrency={displayCurrency} onTotalValueChange={v => { cryptoTotalRef.current = v; setCryptoLiveTotal(v); }} transactions={transactions} walletTransactions={walletTransactions} onTxnClick={setDetailTxn} />;
      case 'cash': return <CashDetail metadata={localMetadata} onChange={handleMetadataChange} onDenominationsChange={handleDenominationsChange} displayCurrency={displayCurrency} onTotalValueChange={v => { cashTotalRef.current = v; setCashLiveTotal(v); }} onTxnClick={setDetailTxn} />;
      case 'physical': return <PhysicalDetail metadata={localMetadata} onChange={handleMetadataChange} onDenominationsChange={handleDenominationsChange} transactions={walletTransactions} displayCurrency={displayCurrency} onTotalValueChange={v => { cashTotalRef.current = v; setCashLiveTotal(v); }} walletId={wallet.id} onTxnClick={setDetailTxn} />;
      case 'ewallet': return <EwalletDetail metadata={localMetadata} onChange={handleMetadataChange} transactions={walletTransactions} displayCurrency={displayCurrency} walletId={wallet.id} onTxnClick={setDetailTxn} />;
      case 'prepaid_card': return <PrepaidCardDetail metadata={localMetadata} onChange={handleMetadataChange} transactions={walletTransactions} displayCurrency={displayCurrency} walletId={wallet.id} onTxnClick={setDetailTxn} />;
      default: return <OtherDetail metadata={localMetadata} onChange={handleMetadataChange} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassSurface className="p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-2">
            {onRecalculateBalance && (
              <button onClick={async () => { setRecalibrating(true); await onRecalculateBalance(wallet.id); setRecalibrating(false); }}
                disabled={recalibrating}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${recalibrating ? 'animate-spin' : ''}`} /> Recalc
              </button>
            )}
            {onDeleteWallet && (
              <button onClick={() => onDeleteWallet(wallet.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
              {saved ? <>&#10003; Saved!</> : saving ? <><Save className="w-3 h-3" /> Saving...</> : <><Save className="w-3 h-3" /> Save</>}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
            <WalletIcon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {editName ? (
                <input autoFocus value={nameBuf} onChange={e => setNameBuf(e.target.value)} onBlur={() => setEditName(false)}
                  onKeyDown={e => e.key === 'Enter' && setEditName(false)}
                  className="text-sm font-medium bg-zinc-800 text-white outline-none px-1 rounded border border-white/10" />
              ) : (
                <h3 className="text-sm font-medium text-white cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => setEditName(true)}>{wallet.name}</h3>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
              {isOutOfSync && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400" title={`Denominations total ${fmtMoney(denominationTotal!)} doesn't match balance ${fmtMoney(wallet.balance)}`}>
                  <AlertTriangle className="w-3 h-3" /> Out of sync
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {wallet.provider && <span className="text-[10px] text-zinc-500">{wallet.provider}</span>}
              {wallet.last_four && <span className="text-[10px] text-zinc-500">{'\u2022'.repeat(3)}{wallet.last_four}</span>}
            </div>
          </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                {(wallet.type === 'crypto' || wallet.type === 'investment' || wallet.type === 'cash' || wallet.type === 'physical') ? (
                  <>
                    <div className="text-sm font-semibold text-white tabular-nums">
                       {(wallet.type === 'crypto' || wallet.type === 'investment')
                         ? fmtMoney(parentAvailableFiat + cryptoOnlyValue)
                         : fmtMoney(cashLiveTotal > 0 ? cashLiveTotal : wallet.balance)}
                    </div>
                    <div className="text-[10px] text-zinc-500">{displayCurrency}</div>
                    {(wallet.type === 'crypto' || wallet.type === 'investment') && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-zinc-400">{fmtMoney(cryptoOnlyValue)} crypto</span>
                        {fiatBalance > 0 && (
                          <>
                            <span className="text-[9px] text-zinc-700">+</span>
                            <span className="text-[9px] text-emerald-400/70">{fmtMoney(parentAvailableFiat)} available</span>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-white tabular-nums">{fmtMoney(wallet.balance)}</div>
                    <div className="text-[10px] text-zinc-500">{displayCurrency}</div>
                  </>
                )}
              </div>
            {/* Wallet info: initial balance (editable) + created date */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {editingInitialBalance ? (
                <div className="flex items-center gap-1.5 bg-zinc-800/80 rounded-lg px-2 py-1 border border-zinc-700/50">
                  <span className="text-[10px] text-zinc-500">Initial:</span>
                  <div onKeyDown={e => { if (e.key === 'Enter') saveInitialBalance(); if (e.key === 'Escape') { setEditingInitialBalance(false); setInitialBalanceBuf(''); } }}>
                    <CurrencyInput value={initialBalanceBuf} onChange={(v) => setInitialBalanceBuf(String(v))}
                      autoFocus className="w-24 bg-transparent text-[10px] text-white outline-none tabular-nums" placeholder="0.00" />
                  </div>
                  <input type="password" placeholder="Password" value={initialBalancePassword}
                    onChange={e => setInitialBalancePassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveInitialBalance(); if (e.key === 'Escape') { setEditingInitialBalance(false); setInitialBalancePassword(''); } }}
                    className="w-20 bg-transparent text-[10px] text-zinc-400 outline-none placeholder-zinc-600" />
                  <button onClick={saveInitialBalance} disabled={savingInitialBalance}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 font-medium">Set</button>
                  <button onClick={() => { setEditingInitialBalance(false); setInitialBalanceBuf(''); setInitialBalancePassword(''); }}
                    className="text-[10px] text-zinc-500 hover:text-white">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => { 
                      const displayInitial = (wallet.type === 'crypto' || wallet.type === 'investment') 
                        ? Math.max(Number((wallet as any).initial_balance || 0), wallet.balance || 0)
                        : Number((wallet as any).initial_balance || 0);
                      setEditingInitialBalance(true); 
                      setInitialBalanceBuf(String(displayInitial)); 
                    }}>
                    Initial: {fmtMoney(
                      (wallet.type === 'crypto' || wallet.type === 'investment')
                        ? Math.max(Number((wallet as any).initial_balance || 0), wallet.balance || 0)
                        : Number((wallet as any).initial_balance || 0)
                    )}
                    <span className="text-zinc-600 ml-1">(edit)</span>
                  </span>
                  {initialBalanceCooldown && (
                    <span className="text-[10px] text-amber-500/70">{initialBalanceCooldown}</span>
                  )}
                </>
              )}
              {wallet.created_at && (
                <span className="text-[10px] text-zinc-500">Created {new Date(wallet.created_at).toLocaleDateString()}</span>
              )}
            </div>

            <button onClick={() => onAddTransaction(wallet.type)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white text-lg font-medium transition-colors"
              style={{ backgroundColor: `${meta.color}30`, color: meta.color }}
              title="Add transaction">
              +
            </button>
          </div>
        </div>

        {/* Transfer Fee (dedicated DB columns) */}
        <div className="mb-4 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">Transfer Fee</span>
            <button onClick={() => setEditingFee(p => !p)}
              className="text-xs text-zinc-400 hover:text-white transition-colors">
              {localFeeType !== 'none' && localFeeValue > 0
                ? (localFeeType === 'percentage'
                  ? `${localFeeValue}% fee`
                  : `${fmtMoney(Number(localFeeValue))} fee`)
                : 'None \u2716'}
            </button>
          </div>
          {editingFee && (
            <div className="flex items-center gap-2 mt-2">
              <select value={localFeeType}
                onChange={e => { setLocalFeeType(e.target.value); if (e.target.value === 'none') setLocalFeeValue(0); }}
                className="flex-1 bg-zinc-800 text-xs text-zinc-300 rounded-lg border border-white/10 px-2 py-1.5 outline-none">
                <option value="none">No fee</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </select>
              {localFeeType !== 'none' && (
                <CurrencyInput value={localFeeValue || ''} onChange={(v) => setLocalFeeValue(v)}
                  placeholder={localFeeType === 'percentage' ? '0%' : '0.00'}
                  className="w-22 bg-zinc-800 text-xs text-zinc-300 rounded-lg border border-white/10 px-2 py-1.5 outline-none text-right tabular-nums" />
              )}
              <button onClick={async () => {
                await (window as any).deskflowAPI?.financeUpdateWalletFees({ id: wallet.id, transfer_fee_type: localFeeType, transfer_fee_value: localFeeValue });
                setEditingFee(false);
              }}
                className="text-[10px] px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                Save
              </button>
            </div>
          )}
        </div>

        {/* Per-person balances */}
        {(() => {
          // Extract person balances from transactions using tags
          const personMap = new Map<string, { paid: number; spent: number }>();
          for (const txn of walletTransactions) {
            try {
              const tags = JSON.parse(txn.tags || '[]');
              const personTag = tags.find((t: string) => t.startsWith('person:'));
              if (personTag) {
                const name = personTag.slice(7);
                const entry = personMap.get(name) || { paid: 0, spent: 0 };
                const amt = Math.abs(txn.amount);
                if (txn.type === 'income') entry.paid += amt;
                else entry.spent += amt;
                personMap.set(name, entry);
              }
            } catch {}
          }
          if (personMap.size === 0) return null;
          return (
            <div className="mb-4 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Person Balances</span>
              </div>
              <div className="space-y-1.5">
                {Array.from(personMap.entries()).map(([name, data]) => {
                  const net = data.paid - data.spent;
                  return (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 tabular-nums">+{fmtMoney(data.paid)}</span>
                        <span className="text-zinc-500 tabular-nums">-{fmtMoney(data.spent)}</span>
                        <span className={`font-medium tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {net >= 0 ? '+' : ''}{fmtMoney(net)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Subscriptions tied to this wallet */}
        {subscriptions && subscriptions.filter(s => s.wallet_id === wallet.id).length > 0 && (
          <div className="mb-4 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 font-medium">Active Subscriptions</span>
              <span className="text-[10px] text-zinc-600">{subscriptions.filter(s => s.wallet_id === wallet.id).length} tied</span>
            </div>
            <div className="space-y-1.5">
              {subscriptions.filter(s => s.wallet_id === wallet.id).map(sub => {
                const sym = getCurrencyInfo(sub.currency || displayCurrency).symbol;
                return (
                  <div key={sub.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-zinc-800/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${sub.status === 'active' ? 'bg-emerald-400' : sub.status === 'paused' ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                      <span className="text-xs text-zinc-300 truncate">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-400 tabular-nums">{showNumbers ? `${sym}${Number(sub.price).toFixed(2)}` : maskNumber(`${sym}${Number(sub.price).toFixed(2)}`, maskMode, maskFixedValue)}<span className="text-[9px] text-zinc-600">/{sub.billing_cycle?.replace('ly','')}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly income/expense chart — skipped for crypto (has its own) */}
        {wallet.type !== 'crypto' && wallet.type !== 'investment' && (
          <div className="mb-4">
            <WalletMonthlyChart
              transactions={transactions}
              walletId={wallet.id}
              displayCurrency={displayCurrency}
              baseCurrency={displayCurrency}
              walletColor={walletMeta[wallet.type]?.color || '#6B7280'}
            />
          </div>
        )}

        {renderDetailBody()}
      </GlassSurface>

      <TransactionDetailModal
        transaction={detailTxn}
        accounts={accounts}
        categories={categories}
        wallets={wallets}
        allTransactions={transactions}
        displayCurrency={displayCurrency}
        baseCurrency={displayCurrency}
        onClose={() => setDetailTxn(null)}
        onDelete={onDeleteTransaction}
        onUpdate={onUpdateTransaction}
        onVerifyPassword={onVerifyPassword}
        ftPersons={ftPersons}
        onAddFtPerson={onAddFtPerson}
        onNotify={onNotify}
      />
    </motion.div>
  );
}
