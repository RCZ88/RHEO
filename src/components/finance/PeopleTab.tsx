import { useState, useMemo, useCallback } from 'react';
import { Users, Plus, Search, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import type { FinanceFtPerson, FinanceTransaction, FinanceWallet, FinanceAccount, FinanceCategory } from './finance-types';
import { PersonCard } from './PersonCard';
import { PersonDetailModal } from './PersonDetailModal';
import { PaymentAllocationModal } from './PaymentAllocationModal';
import { TransactionDetailModal } from './TransactionDetailModal';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

interface PeopleTabProps {
  persons: FinanceFtPerson[];
  transactions: FinanceTransaction[];
  wallets: FinanceWallet[];
  displayCurrency: string;
  onRefresh: () => void;
  onNewTransaction?: (personId: number) => void;
  accounts?: FinanceAccount[];
  categories?: FinanceCategory[];
  baseCurrency?: string;
  onDeleteTransaction?: (id: number) => Promise<boolean>;
  onUpdateTransaction?: (id: number, data: Record<string, any>) => Promise<boolean>;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  ftPersons?: { id: number; name: string; email?: string | null; phone?: string | null }[];
  onAddFtPerson?: (name: string) => void;
  onGoToTransactions?: (txId: number) => void;
}

export function PeopleTab({ persons, transactions, wallets, displayCurrency, onRefresh, onNewTransaction, accounts = [], categories = [], baseCurrency = 'USD', onDeleteTransaction, onUpdateTransaction, onVerifyPassword, ftPersons = [], onAddFtPerson, onGoToTransactions }: PeopleTabProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? v.toFixed(2) : maskNumber(v.toFixed(2), maskMode, maskFixedValue);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<FinanceFtPerson | null>(null);
  const [paymentPerson, setPaymentPerson] = useState<FinanceFtPerson | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [detailTransaction, setDetailTransaction] = useState<FinanceTransaction | null>(null);

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons;
    const q = searchQuery.toLowerCase();
    return persons.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  }, [persons, searchQuery]);

  const stats = useMemo(() => {
    const totalOwed = persons.reduce((sum, p) => sum + (p.total_owed - p.total_paid), 0);
    const activeCount = persons.filter(p => (p.total_owed - p.total_paid) > 0).length;
    const settledCount = persons.filter(p => (p.total_owed - p.total_paid) <= 0 && p.transaction_count > 0).length;
    return { totalOwed, activeCount, settledCount };
  }, [persons]);

  const handleTransactionClick = useCallback((tx: FinanceTransaction) => {
    setDetailTransaction(tx);
  }, []);

  const handleRecordPayment = useCallback((person: FinanceFtPerson) => {
    setSelectedPerson(null);
    setPaymentPerson(person);
  }, []);

  const handlePaymentClose = useCallback(() => {
    setPaymentPerson(null);
    onRefresh();
  }, [onRefresh]);

  const handlePersonClick = useCallback((person: FinanceFtPerson) => {
    setSelectedPerson(person);
  }, []);

  const handleSyncBalances = useCallback(async () => {
    setSyncing(true);
    try {
      await (window as any).deskflowAPI?.financeFtPersonSyncBalances();
      onRefresh();
    } catch (err) {
      console.error('[PeopleTab] sync error:', err);
    }
    setSyncing(false);
  }, [onRefresh]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            People & Debt
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Track who owes you and manage repayments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSyncBalances} disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors disabled:opacity-50"
            title="Sync all person balances from transactions">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Person
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 p-4">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Total Owed</span>
          </div>
          <div className="text-xl font-bold text-amber-400">{displayCurrency}{fmtMoney(stats.totalOwed)}</div>
        </div>
        <div className="rounded-xl bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 p-4">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <Users className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Active</span>
          </div>
          <div className="text-xl font-bold text-emerald-400">{stats.activeCount}</div>
        </div>
        <div className="rounded-xl bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 p-4">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wider">Settled</span>
          </div>
          <div className="text-xl font-bold text-zinc-400">{stats.settledCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search people by name, email, or phone..."
          className="w-full rounded-xl bg-zinc-900/60 border border-zinc-800/60 pl-9 pr-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/30 transition-colors" />
      </div>

      {/* People Grid */}
      {filteredPersons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-zinc-600" />
          </div>
          <h3 className="text-sm font-medium text-zinc-400">No people found</h3>
          <p className="text-xs text-zinc-600 mt-1 max-w-xs">
            {searchQuery ? 'Try a different search term' : 'Add people to track debts and shared expenses'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredPersons.map(person => (
            <PersonCard key={person.id} person={person} wallets={wallets} displayCurrency={displayCurrency} onClick={() => handlePersonClick(person)} />
          ))}
        </div>
      )}

      {/* Person Detail Modal */}
      {selectedPerson && (
        <PersonDetailModal open={true} onClose={() => setSelectedPerson(null)} person={selectedPerson}
          transactions={transactions} wallets={wallets} displayCurrency={displayCurrency}
          onRecordPayment={() => handleRecordPayment(selectedPerson)} onRefresh={onRefresh}
          onNewTransaction={onNewTransaction} onTransactionClick={handleTransactionClick} />
      )}

      {/* Payment Allocation Modal */}
      {paymentPerson && (
        <PaymentAllocationModal open={true} onClose={handlePaymentClose} person={paymentPerson}
          transactions={transactions} wallets={wallets} displayCurrency={displayCurrency} onRefresh={onRefresh} />
      )}

      {/* Add Person Modal */}
      {showAddModal && (
        <AddPersonModal onClose={() => setShowAddModal(false)} onCreated={onRefresh} />
      )}

      {/* Transaction Detail Modal */}
      {detailTransaction && (
        <TransactionDetailModal
          transaction={detailTransaction}
          accounts={accounts}
          categories={categories}
          wallets={wallets}
          allTransactions={transactions}
          displayCurrency={displayCurrency}
          baseCurrency={baseCurrency}
          ftPersons={ftPersons}
          onAddFtPerson={onAddFtPerson}
          onDelete={onDeleteTransaction}
          onUpdate={onUpdateTransaction}
          onVerifyPassword={onVerifyPassword}
          onClose={() => setDetailTransaction(null)}
          onGoToTransactions={(txId) => {
            setDetailTransaction(null);
            onGoToTransactions?.(txId);
          }}
        />
      )}
    </div>
  );
}

function AddPersonModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await (window as any).deskflowAPI?.financeCreateFtPerson({ name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined });
      onCreated();
      onClose();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 animate-in zoom-in-95">
        <h3 className="text-sm font-semibold text-zinc-100 mb-4">Add New Person</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Sarah Chen"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="optional"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="optional"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500/50" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs py-2.5 hover:bg-zinc-700 transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || saving}
            className="flex-1 rounded-lg bg-emerald-500 text-black text-xs py-2.5 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
