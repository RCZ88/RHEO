import { useState, useMemo, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { X, Download, Check, FileText, Clock, Filter, Palette, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { FinanceFtPerson, FinanceTransaction } from '../finance-types';
import { getRepaymentStatus, getFtPerson } from '../../../lib/receivables';
import { RECEIPT_STYLES, getReceiptStyle } from './receiptStyles';
import { ReceiptPreview } from './ReceiptPreview';

interface ReceiptGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  person: FinanceFtPerson;
  transactions: FinanceTransaction[];
  displayCurrency: string;
}

type TxFilter = 'all' | 'pending' | 'repaid' | 'repayments';

export function ReceiptGeneratorModal({ open, onClose, person, transactions, displayCurrency }: ReceiptGeneratorModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [selectedStyle, setSelectedStyle] = useState('classic');
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [receiptTitle, setReceiptTitle] = useState('Statement of Account');
  const [receiptNote, setReceiptNote] = useState('');
  const [selectAll, setSelectAll] = useState(true);

  const style = getReceiptStyle(selectedStyle);

  const personTxns = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.ft_person_id === person.id) return true;
      if (tx.on_behalf_of_label === person.name) return true;
      return getFtPerson(tx) === person.name;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, person]);

  const { pendingTxs, repaidTxs, repaymentTxs } = useMemo(() => {
    const pending: FinanceTransaction[] = [];
    const repaid: FinanceTransaction[] = [];
    const repayments: FinanceTransaction[] = [];
    for (const tx of personTxns) {
      // Repayment = income with on_behalf_of=1 or ft_repaid tag
      const isRepayment = tx.type === 'income' && tx.on_behalf_of === 1;
      const hasRepaidTag = tx.tags && tx.tags.includes('ft_repaid:');
      if (isRepayment || hasRepaidTag) {
        repayments.push(tx);
        continue;
      }
      if (tx.type !== 'expense' || tx.on_behalf_of !== 1) continue;
      if (tx.wallet_id === null && tx.account_id === null) continue;
      const status = getRepaymentStatus(tx, transactions);
      const stillOwed = Math.abs(tx.amount) - status.totalRepaid;
      if (status.repaid || stillOwed <= 0) repaid.push(tx);
      else pending.push(tx);
    }
    return { pendingTxs: pending, repaidTxs: repaid, repaymentTxs: repayments };
  }, [personTxns, transactions]);

  const filteredTxs = useMemo(() => {
    if (txFilter === 'pending') return pendingTxs;
    if (txFilter === 'repaid') return repaidTxs;
    if (txFilter === 'repayments') return repaymentTxs;
    // 'all' = pending + repaid expenses
    return personTxns.filter(tx => tx.type === 'expense' && tx.on_behalf_of === 1 && !(tx.wallet_id === null && tx.account_id === null));
  }, [txFilter, pendingTxs, repaidTxs, repaymentTxs, personTxns]);

  const displayTxs = useMemo(() => {
    if (selectAll) return filteredTxs;
    return filteredTxs.filter(tx => selectedTxIds.has(tx.id));
  }, [filteredTxs, selectedTxIds, selectAll]);

  const { displayTotal, totalRepaidAmount } = useMemo(() => {
    let owed = 0;
    let repaidAmt = 0;
    for (const tx of displayTxs) {
      const isRepayment = tx.type === 'income' && (tx.on_behalf_of === 1 || (tx.tags && tx.tags.includes('ft_repaid:')));
      if (isRepayment) {
        repaidAmt += Math.abs(tx.amount);
      } else {
        const status = getRepaymentStatus(tx, transactions);
        const stillOwed = Math.abs(tx.amount) - status.totalRepaid;
        owed += status.repaid ? Math.abs(tx.amount) : stillOwed;
      }
    }
    return { displayTotal: owed, totalRepaidAmount: repaidAmt };
  }, [displayTxs, transactions]);

  const toggleTx = useCallback((id: number) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAll(false);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTxs.map(tx => tx.id)));
    }
    setSelectAll(!selectAll);
  }, [selectAll, filteredTxs]);

  const handleExport = useCallback(async () => {
    if (!receiptRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 3,
        backgroundColor: style.bg,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `receipt-${person.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      console.error('[ReceiptExport] failed:', err);
    } finally {
      setExporting(false);
    }
  }, [exporting, style.bg, person.name]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtMoney = (v: number) => `${displayCurrency}${v.toFixed(2)}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-[1100px] max-h-[92vh] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Generate Receipt</h2>
              <p className="text-[11px] text-zinc-500">for {person.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || displayTxs.length === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
            >
              {done ? (
                <><Check className="w-3.5 h-3.5" /> Saved!</>
              ) : exporting ? (
                'Exporting...'
              ) : (
                <><Download className="w-3.5 h-3.5" /> Export PNG</>
              )}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Panel */}
          <div className="w-[320px] flex-shrink-0 border-r border-zinc-800/60 overflow-y-auto p-4 space-y-5">
            {/* Style Picker */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium text-zinc-400">Receipt Style</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {RECEIPT_STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.id)}
                    className={`text-left rounded-lg p-2.5 border transition-all ${
                      selectedStyle === s.id
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-zinc-800/60 bg-zinc-800/20 hover:border-zinc-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: s.headerBg, border: `1px solid ${s.border}` }}
                      >
                        <span style={{ color: s.bg, fontSize: '8px', fontWeight: 700, fontFamily: s.headingFont }}>R</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-zinc-200">{s.name}</div>
                        <div className="text-[9px] text-zinc-500 truncate">{s.preview}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Title */}
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Receipt Title</label>
              <input
                type="text"
                value={receiptTitle}
                onChange={e => setReceiptTitle(e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Filter */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[11px] font-medium text-zinc-400">Transactions</span>
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-800/50">
                {(['all', 'pending', 'repaid', 'repayments'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setTxFilter(f); setSelectedTxIds(new Set()); setSelectAll(true); }}
                    className={`flex-1 py-1.5 text-[10px] font-medium rounded-md transition-colors capitalize ${
                      txFilter === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
                    }`}
                  >
                    {f === 'repayments' ? 'Paid Back' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Select All */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">Select all ({filteredTxs.length})</span>
              <button
                onClick={handleSelectAll}
                className={`w-9 h-5 rounded-full transition-colors relative ${selectAll ? 'bg-amber-500' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${selectAll ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Transaction Checkboxes */}
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {filteredTxs.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="w-6 h-6 text-zinc-700 mx-auto mb-1.5" />
                  <p className="text-[11px] text-zinc-500">No {txFilter === 'repayments' ? 'paid back' : txFilter} transactions</p>
                </div>
              ) : (
                filteredTxs.map(tx => {
                  const isChecked = selectAll || selectedTxIds.has(tx.id);
                  const isRepaymentTx = tx.type === 'income' && (tx.on_behalf_of === 1 || (tx.tags && tx.tags.includes('ft_repaid:')));
                  const status = getRepaymentStatus(tx, transactions);
                  const stillOwed = Math.abs(tx.amount) - status.totalRepaid;
                  const isRepaid = status.repaid || stillOwed <= 0;
                  return (
                    <button
                      key={tx.id}
                      onClick={() => toggleTx(tx.id)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                        isChecked
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-zinc-800/40 bg-transparent hover:border-zinc-700/40'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                        isChecked ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5 text-black" />}
                      </div>
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                        isRepaymentTx ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                      }`}>
                        {isRepaymentTx ? (
                          <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-zinc-200 truncate">{tx.description || (isRepaymentTx ? 'Repayment' : 'Untitled')}</div>
                        <div className="text-[9px] text-zinc-500">{fmtDate(tx.date)}</div>
                      </div>
                      <span className={`text-[11px] font-medium tabular-nums flex-shrink-0 ${isRepaymentTx ? 'text-emerald-400' : isRepaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isRepaymentTx ? '+' : ''}{fmtMoney(Math.abs(tx.amount))}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Note */}
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Note (optional)</label>
              <textarea
                value={receiptNote}
                onChange={e => setReceiptNote(e.target.value)}
                placeholder="Add a note to the receipt..."
                className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500/50 transition-colors resize-none h-16 placeholder-zinc-600"
              />
            </div>
          </div>

          {/* Right Panel — Live Preview */}
          <div className="flex-1 overflow-auto p-6 flex justify-center items-start" style={{ background: '#1a1a2e' }}>
            <div className="w-full max-w-[720px] flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Preview
              </div>
              <ReceiptPreview
                ref={receiptRef}
                style={style}
                person={person}
                txs={displayTxs}
                total={displayTotal}
                displayCurrency={displayCurrency}
                title={receiptTitle}
                note={receiptNote}
                fmtDate={fmtDate}
                fmtMoney={fmtMoney}
                allTransactions={transactions}
                repaymentTotal={totalRepaidAmount}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
