import { useMemo, useState, useCallback } from 'react';
import { X, Phone, Mail, FileText, Wallet, Calendar, CheckCircle2, Clock, Plus, Minus, ChevronDown, ChevronRight, Check, Landmark, Pencil, Trash2, ArrowUpRight, Download, ArrowDownRight } from 'lucide-react';
import type { FinanceFtPerson, FinanceTransaction, FinanceWallet } from './finance-types';
import { getRepaymentStatus, getFtPerson, getCoveredExpenses } from '../../lib/receivables';
import { TopUpModal } from './modals/TopUpModal';
import { DeductModal } from './modals/DeductModal';
import { ReceiptGeneratorModal } from './receipt/ReceiptGeneratorModal';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

interface PersonDetailModalProps {
  open: boolean;
  onClose: () => void;
  person: FinanceFtPerson;
  transactions: FinanceTransaction[];
  wallets: FinanceWallet[];
  displayCurrency: string;
  onRecordPayment: () => void;
  onRefresh: () => void;
  onNewTransaction?: (personId: number) => void;
  onTransactionClick?: (tx: FinanceTransaction) => void;
  onUpdateTransaction?: (id: number, data: Record<string, any>) => Promise<any>;
}

type FilterMode = 'all' | 'pending' | 'repaid';

interface DisplayTx {
  tx: FinanceTransaction;
  type: 'expense' | 'repayment' | 'topup' | 'deduction';
  repaid: boolean;
  stillOwed: number;
  coveredExpenses?: FinanceTransaction[];
}

export function PersonDetailModal({
  open, onClose, person, transactions, wallets, displayCurrency, onRecordPayment, onRefresh, onNewTransaction, onTransactionClick, onUpdateTransaction
}: PersonDetailModalProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? v.toFixed(2) : maskNumber(v.toFixed(2), maskMode, maskFixedValue);

  // ── State ──
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedRepaymentId, setExpandedRepaymentId] = useState<number | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showDeduct, setShowDeduct] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(person.name);
  const [editEmail, setEditEmail] = useState(person.email || '');
  const [editPhone, setEditPhone] = useState(person.phone || '');
  const [editNotes, setEditNotes] = useState(person.notes || '');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDate, setEditTxDate] = useState('');

  // ── Build display list ──
  const personTxns = useMemo(() => {
    const nameLower = person.name.toLowerCase();
    const personExpenseIds = new Set<number>();
    for (const tx of transactions) {
      if (tx.ft_person_id === person.id) personExpenseIds.add(tx.id);
      if (tx.on_behalf_of_label && tx.on_behalf_of_label.toLowerCase() === nameLower) personExpenseIds.add(tx.id);
      const tags = (tx.tags ?? '').split(',').map(s => s.trim());
      for (const tag of tags) {
        if (tag.startsWith('ft_person:') && tag.slice('ft_person:'.length).toLowerCase() === nameLower) personExpenseIds.add(tx.id);
      }
    }
    return transactions.filter(tx => {
      if (tx.ft_person_id === person.id) return true;
      if (tx.on_behalf_of_label && tx.on_behalf_of_label.toLowerCase() === nameLower) return true;
      const tags = (tx.tags ?? '').split(',').map(s => s.trim());
      for (const tag of tags) {
        if (tag.startsWith('ft_person:') && tag.slice('ft_person:'.length).toLowerCase() === nameLower) return true;
        const repaidMatch = tag.match(/^ft_repaid:(\d+)$/);
        if (repaidMatch && personExpenseIds.has(Number(repaidMatch[1]))) return true;
      }
      return getFtPerson(tx)?.toLowerCase() === nameLower;
    });
  }, [transactions, person]);

  const displayList = useMemo((): DisplayTx[] => {
    return personTxns.map(tx => {
      const isIncome = tx.type === 'income';
      const isRepaymentTx = isIncome && tx.on_behalf_of === 1;
      const isTopUp = isIncome && tx.on_behalf_of === 0;
      const isDeduction = tx.type === 'expense' && tx.wallet_id === null && tx.account_id === null && tx.on_behalf_of === 1;
      const isExpense = tx.type === 'expense' && !isDeduction && tx.on_behalf_of === 1;

      let dType: DisplayTx['type'] = 'expense';
      if (isRepaymentTx) dType = 'repayment';
      else if (isTopUp) dType = 'topup';
      else if (isDeduction) dType = 'deduction';

      const repaid = isExpense ? getRepaymentStatus(tx, transactions).repaid : false;
      const stillOwed = isExpense ? Math.abs(tx.amount) - getRepaymentStatus(tx, transactions).totalRepaid : 0;
      const coveredExpenses = isRepaymentTx ? getCoveredExpenses(tx, transactions) : undefined;

      return { tx, type: dType, repaid, stillOwed, coveredExpenses };
    }).sort((a, b) => new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());
  }, [personTxns, transactions]);

  const filteredList = useMemo(() => {
    if (filter === 'pending') return displayList.filter(d => !d.repaid && d.type === 'expense');
    if (filter === 'repaid') return displayList.filter(d => d.repaid || d.type !== 'expense');
    return displayList;
  }, [displayList, filter]);

  // ── Balance summary ──
  const { totalOwed, totalRepaid, pendingCount, repaidCount } = useMemo(() => {
    let owed = 0, repaidAmt = 0, pending = 0, repaid = 0;
    for (const d of displayList) {
      if (d.type === 'expense') {
        if (d.repaid) { repaidAmt += Math.abs(d.tx.amount); repaid++; }
        else { owed += d.stillOwed; pending++; }
      }
    }
    return { totalOwed: owed, totalRepaid: repaidAmt, pendingCount: pending, repaidCount: repaid };
  }, [displayList]);

  const storedBalance = person.balance ?? 0;
  const linkedWallet = person.wallet_id ? wallets.find(w => w.id === person.wallet_id) : null;
  const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // ── Handlers ──
  const handleSetWallet = useCallback(async (walletId: number | null) => {
    try {
      await (window as any).deskflowAPI?.financeFtPersonSetWallet({ personId: person.id, walletId });
      setShowWalletPicker(false);
      onRefresh();
    } catch { /* ignore */ }
  }, [person.id, onRefresh]);

  const handleTopUpDone = useCallback(() => { setShowTopUp(false); onRefresh(); }, [onRefresh]);

  const handleSaveEdit = useCallback(async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await (window as any).deskflowAPI?.financeFtPersonEdit({
        personId: person.id, name: editName.trim(),
        email: editEmail.trim() || undefined, phone: editPhone.trim() || undefined, notes: editNotes.trim() || undefined,
      });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefresh();
    } catch { /* ignore */ }
    setSaving(false);
  }, [person.id, editName, editEmail, editPhone, editNotes, onRefresh]);

  const handleDelete = useCallback(async () => {
    try {
      await (window as any).deskflowAPI?.financeFtPersonDelete({ personId: person.id });
      setShowDeleteConfirm(false);
      onClose();
      onRefresh();
    } catch { /* ignore */ }
  }, [person.id, onClose, onRefresh]);

  const startEditTx = useCallback((d: DisplayTx) => {
    setEditingTxId(d.tx.id);
    setEditTxDesc(d.tx.description || '');
    setEditTxAmount(String(Math.abs(d.tx.amount)));
    setEditTxDate(d.tx.date);
  }, []);

  const saveEditTx = useCallback(async () => {
    if (!editingTxId || !onUpdateTransaction) return;
    const amt = parseFloat(editTxAmount);
    if (isNaN(amt) || amt <= 0) return;
    await onUpdateTransaction(editingTxId, {
      description: editTxDesc.trim() || undefined,
      amount: amt,
      date: editTxDate || undefined,
    });
    setEditingTxId(null);
    onRefresh();
  }, [editingTxId, editTxDesc, editTxAmount, editTxDate, onUpdateTransaction, onRefresh]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex-shrink-0 p-5 border-b border-zinc-800/60">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-lg font-bold">{initials}</div>
              <div>
                {editing ? (
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="text-base font-semibold text-zinc-100 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50" autoFocus />
                ) : (
                  <h2 className="text-base font-semibold text-zinc-100">{person.name}</h2>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {editing ? (
                    <>
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email"
                        className="text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone"
                        className="text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
                    </>
                  ) : (
                    <>
                      {person.email && <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Mail className="w-3 h-3" />{person.email}</span>}
                      {person.phone && <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Phone className="w-3 h-3" />{person.phone}</span>}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {saveSuccess && <span className="px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/20 text-emerald-400 animate-in fade-in">Saved</span>}
              {editing ? (
                <>
                  <button onClick={handleSaveEdit} disabled={saving || !editName.trim()}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setEditName(person.name); setEditEmail(person.email || ''); setEditPhone(person.phone || ''); setEditNotes(person.notes || ''); }}
                    className="px-2 py-1 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowReceipt(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[11px] font-medium transition-colors" title="Export receipt">
                    <Download className="w-3 h-3" /> Receipt
                  </button>
                  <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors" title="Edit person"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors" title="Delete person"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 transition-colors"><X className="w-4 h-4" /></button>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {editing && (
            <div className="mt-2">
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes..."
                className="w-full text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none h-14" />
            </div>
          )}
          {!editing && person.notes && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500"><FileText className="w-3 h-3" /> {person.notes}</div>
          )}

          {/* ── Balance Cards ── */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Owed</p>
              <p className="text-lg font-bold text-amber-400 tabular-nums mt-0.5">{displayCurrency}{fmtMoney(totalOwed)}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{pendingCount} pending</p>
            </div>
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
              <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Repaid</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums mt-0.5">{displayCurrency}{fmtMoney(totalRepaid)}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{repaidCount} done</p>
            </div>
            <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3">
              <p className="text-[10px] text-violet-400/70 uppercase tracking-wider">Balance</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${storedBalance >= 0 ? 'text-violet-400' : 'text-amber-400'}`}>{displayCurrency}{fmtMoney(Math.abs(storedBalance))}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{storedBalance >= 0 ? 'credit' : 'deficit'}</p>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              <button onClick={() => setShowWalletPicker(!showWalletPicker)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-2 text-[11px] text-zinc-400 hover:text-zinc-300 hover:border-zinc-600/50 transition-colors">
                <Landmark className="w-3 h-3" /> {linkedWallet ? linkedWallet.name : 'Link Wallet'}
                <ChevronDown className={`w-3 h-3 transition-transform ${showWalletPicker ? 'rotate-180' : ''}`} />
              </button>
              {showWalletPicker && (
                <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg bg-zinc-800 border border-zinc-700/60 shadow-xl py-1">
                  <button onClick={() => handleSetWallet(null)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors">
                    <span className="text-zinc-400">No wallet</span>
                    {!person.wallet_id && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                  {wallets.filter(w => !w.is_archived).map(w => (
                    <button key={w.id} onClick={() => handleSetWallet(w.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors">
                      <span className="text-zinc-200">{w.name}</span>
                      {w.id === person.wallet_id && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowTopUp(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-400 font-medium hover:bg-emerald-500/20 transition-colors">
              <Plus className="w-3 h-3" /> Top Up
            </button>
            {storedBalance > 0 && (
              <button onClick={() => setShowDeduct(true)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-400 font-medium hover:bg-amber-500/20 transition-colors">
                <Minus className="w-3 h-3" /> Deduct
              </button>
            )}
          </div>
          {hasOwed && (
            <button onClick={onRecordPayment}
              className="w-full mt-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium text-xs py-2.5 transition-colors flex items-center justify-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Record Payment
            </button>
          )}
          {onNewTransaction && (
            <button onClick={() => onNewTransaction(person.id)}
              className="w-full mt-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-medium text-xs py-2.5 transition-colors flex items-center justify-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> New Transaction from {person.name.split(' ')[0]}'s Balance
            </button>
          )}
        </div>

        {/* ── Transaction History ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Filter Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-800/50 flex-1">
              {(['all', 'pending', 'repaid'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                    filter === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
                  }`}>
                  {f === 'all' ? `All (${displayList.length})` : f === 'pending' ? `Pending (${pendingCount})` : `Repaid (${repaidCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction List */}
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">
                {filter === 'all' ? 'No transactions yet' : filter === 'pending' ? 'Nothing pending — all paid off!' : 'No repaid transactions'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredList.map(d => {
                const isExpanded = expandedRepaymentId === d.tx.id;
                const isEditing = editingTxId === d.tx.id;
                const wallet = d.tx.wallet_id ? wallets.find(w => w.id === d.tx.wallet_id) : null;

                return (
                  <div key={d.tx.id} className={`rounded-lg border transition-colors ${
                    d.type === 'repayment' ? 'bg-emerald-500/5 border-emerald-500/10' :
                    d.repaid ? 'bg-emerald-500/5 border-emerald-500/10' :
                    d.type === 'topup' ? 'bg-violet-500/5 border-violet-500/10' :
                    d.type === 'deduction' ? 'bg-amber-500/5 border-amber-500/10' :
                    'bg-zinc-800/30 border-zinc-800/60'
                  }`}>
                    {/* Main Row */}
                    <div className="flex items-center gap-3 p-3">
                      {/* Type Icon */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        d.type === 'repayment' ? 'bg-emerald-500/20' :
                        d.type === 'topup' ? 'bg-violet-500/20' :
                        d.type === 'deduction' ? 'bg-amber-500/20' :
                        d.repaid ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                      }`}>
                        {d.type === 'repayment' ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> :
                         d.type === 'topup' ? <Plus className="w-3.5 h-3.5 text-violet-400" /> :
                         d.type === 'deduction' ? <Minus className="w-3.5 h-3.5 text-amber-400" /> :
                         d.repaid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                         <Clock className="w-3.5 h-3.5 text-amber-400" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <input value={editTxDesc} onChange={e => setEditTxDesc(e.target.value)} placeholder="Description"
                              className="w-full text-xs text-zinc-200 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 outline-none focus:border-amber-500/50" />
                            <div className="flex gap-2">
                              <input value={editTxAmount} onChange={e => setEditTxAmount(e.target.value)} placeholder="Amount" type="number" step="0.01"
                                className="w-24 text-xs text-zinc-200 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 outline-none focus:border-amber-500/50" />
                              <input value={editTxDate} onChange={e => setEditTxDate(e.target.value)} type="date"
                                className="flex-1 text-xs text-zinc-200 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 outline-none focus:border-amber-500/50" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-zinc-200 truncate">{d.tx.description || (d.type === 'repayment' ? 'Repayment' : d.type === 'topup' ? 'Top-up' : 'Transaction')}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium flex-shrink-0 ${
                                d.type === 'repayment' ? 'bg-emerald-500/20 text-emerald-400' :
                                d.type === 'topup' ? 'bg-violet-500/20 text-violet-400' :
                                d.type === 'deduction' ? 'bg-amber-500/20 text-amber-400' :
                                d.repaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {d.type === 'repayment' ? 'Repayment' :
                                 d.type === 'topup' ? 'Top-up' :
                                 d.type === 'deduction' ? 'Deduction' :
                                 d.repaid ? 'Paid' : 'Pending'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" /> {new Date(d.tx.date).toLocaleDateString()}
                              </span>
                              {wallet && (
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                  <Wallet className="w-2.5 h-2.5" /> {wallet.name}
                                </span>
                              )}
                              {!d.repaid && d.type === 'expense' && d.stillOwed > 0 && (
                                <span className="text-[10px] text-amber-400/70">{displayCurrency}{fmtMoney(d.stillOwed)} remaining</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Amount + Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={saveEditTx} className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditingTxId(null)} className="p-1 rounded bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <>
                            <span className={`text-xs font-bold tabular-nums ${
                              d.type === 'repayment' ? 'text-emerald-400' :
                              d.type === 'topup' ? 'text-violet-400' :
                              'text-amber-400'
                            }`}>
                              {d.type === 'repayment' || d.type === 'topup' ? '+' : '-'}{displayCurrency}{fmtMoney(Math.abs(d.tx.amount))}
                            </span>
                            {onUpdateTransaction && (
                              <button onClick={() => startEditTx(d)} className="p-1 rounded hover:bg-zinc-700/50 text-zinc-600 hover:text-zinc-400 transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expandable Covers Section (repayments only) */}
                    {d.type === 'repayment' && d.coveredExpenses && d.coveredExpenses.length > 0 && !isEditing && (
                      <>
                        <button onClick={() => setExpandedRepaymentId(isExpanded ? null : d.tx.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 border-t border-emerald-500/10 text-[10px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors">
                          <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          Covers {d.coveredExpenses.length} expense{d.coveredExpenses.length !== 1 ? 's' : ''}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-2 pt-1 space-y-1 border-t border-emerald-500/5">
                            {d.coveredExpenses.map(exp => (
                              <div key={exp.id} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-emerald-500/5">
                                <span className="text-zinc-400 truncate">{exp.description || 'Untitled'}</span>
                                <span className="text-emerald-400/60 tabular-nums ml-2">{displayCurrency}{fmtMoney(Math.abs(exp.amount))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showTopUp && (
        <TopUpModal open={true} onClose={() => setShowTopUp(false)} personName={person.name} personId={person.id}
          wallets={wallets} displayCurrency={displayCurrency}
          onSubmit={(data) => (window as any).deskflowAPI?.financeFtPersonTopup(data)} onDone={handleTopUpDone} />
      )}
      {showDeduct && (
        <DeductModal open={true} onClose={() => setShowDeduct(false)} personName={person.name} personId={person.id}
          currentBalance={storedBalance} displayCurrency={displayCurrency}
          onSubmit={(data) => (window as any).deskflowAPI?.financeFtPersonDeduct(data)}
          onDone={() => { setShowDeduct(false); onRefresh(); }} />
      )}
      {showReceipt && (
        <ReceiptGeneratorModal open={true} onClose={() => setShowReceipt(false)} person={person}
          transactions={transactions} displayCurrency={displayCurrency} />
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 animate-in zoom-in-95">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2">Delete Person</h3>
            <p className="text-xs text-zinc-400 mb-1">Are you sure you want to delete <span className="font-medium text-zinc-200">{person.name}</span>?</p>
            <p className="text-[11px] text-zinc-500 mb-4">All linked transactions will be unlinked. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs py-2.5 hover:bg-zinc-700 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-500 text-white text-xs py-2.5 font-medium hover:bg-red-400 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
