import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Wallet, ArrowUpRight, Tag, Plus, Shield, ChevronDown, Bell, RefreshCw, History, Users, BarChart3, Receipt, Target, BookOpenText } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { TabBar } from '../components/TabBar';
import { FinanceLockScreen } from '../components/finance/FinanceLockScreen';
import { FinanceStickyHeader } from '../components/finance/FinanceStickyHeader';
import { OverviewTab } from '../components/finance/OverviewTab';
import { WalletsTab } from '../components/finance/WalletsTab';
import { TransactionsTab } from '../components/finance/TransactionsTab';
import { CategoriesTab } from '../components/finance/CategoriesTab';
import { SubscriptionRenewalBanner } from '../components/finance/SubscriptionRenewalBanner';
import { AuroraBackground } from '../components/finance/_fx/AuroraBackground';
import { FinanceChartsTab } from '../components/finance/FinanceChartsTab';
import { getCurrencyInfo, formatCurrency, convertAmount } from '../components/finance/currency-data';
import { pageContainer, tabPanel, fab, DUR } from '../components/finance/_fx/financeMotion';
import { ArchivedItemsModal } from '../components/finance/ArchivedItemsModal';
import { PasswordConfirmDialog } from '../components/finance/PasswordConfirmDialog';
import { RecalculateBalanceModal, type RecalculateBreakdown } from '../components/finance/RecalculateBalanceModal';
import { WalletDetailView } from '../components/finance/WalletDetailView';
import { RecapPanel } from '../components/finance/RecapPanel';
import { SubscriptionsTab } from '../components/finance/SubscriptionsTab';
import { SubscriptionsPageView } from './SubscriptionsPage';
import { AuditLogTab } from '../components/finance/AuditLogTab';
import { PeopleTab } from '../components/finance/PeopleTab';
import BudgetExpensesDashboard from '../components/finance/budget-expenses/BudgetExpensesDashboard';
import { BudgetTab } from '../components/finance/BudgetTab';
import { NetWorthLineChart } from '../components/finance/NetWorthLineChart';
import { IncomeExpenseBarChart } from '../components/finance/IncomeExpenseBarChart';
import { SpendingCategoryChart } from '../components/finance/SpendingCategoryChart';
import { followThroughReceivable, netWorthWithReceivable } from '../lib/netWorth';
import {
  BankTransactionModal, DebitTransactionModal, CreditTransactionModal,
  CryptoTransactionModal, PhysicalTransactionModal, CashTransactionModal, EwalletTransactionModal, PrepaidCardTransactionModal,
} from '../components/finance/modals';
import type {
  FinanceAccount, FinanceWallet, FinanceCategory, FinanceTransaction,
  FinanceSummary, FinanceSpendingByCategory, FinanceMonthlyTrend, FinanceTabKey,
  FinanceFixedExpense, FixedExpenseSummary, FinanceBudget, BudgetStatus
} from '../components/finance/finance-types';
import { CurrentCanvas } from '../components/CurrentCanvas';
import { renderFlow } from '../lib/renderers/flow';
import { startPhaseClock } from '../lib/currentPhase';

const SEED_CATEGORIES = [
  { name: 'Salary', type: 'income' as const, icon: 'CircleDollarSign', color: '#10b981', sort_order: 1 },
  { name: 'Freelance', type: 'income' as const, icon: 'CircleDollarSign', color: '#34d399', sort_order: 2 },
  { name: 'Gift', type: 'income' as const, icon: 'CircleDollarSign', color: '#6ee7b7', sort_order: 3 },
  { name: 'Interest', type: 'income' as const, icon: 'CircleDollarSign', color: '#a7f3d0', sort_order: 4 },
  { name: 'Refund', type: 'income' as const, icon: 'CircleDollarSign', color: '#6ee7b7', sort_order: 5 },
  { name: 'Food & Groceries', type: 'expense' as const, icon: 'TrendingDown', color: '#ef4444', sort_order: 6 },
  { name: 'Transport', type: 'expense' as const, icon: 'TrendingDown', color: '#f97316', sort_order: 7 },
  { name: 'Housing', type: 'expense' as const, icon: 'TrendingDown', color: '#f59e0b', sort_order: 8 },
  { name: 'Utilities', type: 'expense' as const, icon: 'TrendingDown', color: '#eab308', sort_order: 9 },
  { name: 'Entertainment', type: 'expense' as const, icon: 'TrendingDown', color: '#ec4899', sort_order: 10 },
  { name: 'Shopping', type: 'expense' as const, icon: 'TrendingDown', color: '#d946ef', sort_order: 11 },
  { name: 'Health', type: 'expense' as const, icon: 'TrendingDown', color: '#8b5cf6', sort_order: 12 },
  { name: 'Education', type: 'expense' as const, icon: 'TrendingDown', color: '#6366f1', sort_order: 13 },
  { name: 'Other', type: 'expense' as const, icon: 'TrendingDown', color: '#52525b', sort_order: 14 },
  { name: 'Transfer', type: 'transfer' as const, icon: 'ArrowLeftRight', color: '#f59e0b', sort_order: 15 },
];

const tabs: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { key: 'wallets', label: 'Wallets', icon: <Wallet className="w-3.5 h-3.5" /> },
  { key: 'transactions', label: 'Transactions', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  { key: 'people', label: 'People', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'categories', label: 'Categories', icon: <Tag className="w-3.5 h-3.5" /> },
  { key: 'budget', label: 'Budget & Expenses', icon: <Target className="w-3.5 h-3.5" /> },
  { key: 'audit', label: 'Audit Log', icon: <Shield className="w-3.5 h-3.5" /> },
  { key: 'charts', label: 'Charts', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: 'recap', label: 'Recap', icon: <BookOpenText className="w-3.5 h-3.5" /> },
];

export function FinancePage() {
  useEffect(() => { startPhaseClock(); }, []);
  const [isLocked, setIsLocked] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('overview');
  const location = useLocation();
  useEffect(() => {
    const tab = (location.state as any)?.tab;
    if (tab) setActiveTab(tab);
    // Pre-fetch live exchange rates
    import('../components/finance/currency-data').then(m => m.fetchLiveRates()).catch(() => {});
  }, []);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [walletTxModal, setWalletTxModal] = useState<string | null>(null);
  const [preselectedFtPersonId, setPreselectedFtPersonId] = useState<number | null>(null);
  const [preselectedOnBehalfOf, setPreselectedOnBehalfOf] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedAccounts, setArchivedAccounts] = useState<FinanceAccount[]>([]);
  const [archivedWallets, setArchivedWallets] = useState<FinanceWallet[]>([]);
  const [passwordRequirements, setPasswordRequirements] = useState<Record<string, boolean>>({});
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [wallets, setWallets] = useState<FinanceWallet[]>([]);
  const [autoRecalc, setAutoRecalc] = useState(true);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [spendingByCategory, setSpendingByCategory] = useState<FinanceSpendingByCategory[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<FinanceMonthlyTrend[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FinanceFixedExpense[]>([]);
  const [fixedExpenseSummary, setFixedExpenseSummary] = useState<FixedExpenseSummary | null>(null);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [upcomingRenewals, setUpcomingRenewals] = useState<any[]>([]);
  const [ftPersons, setFtPersons] = useState<{ id: number; name: string }[]>([]);
  const [onBehalfOfSummary, setOnBehalfOfSummary] = useState<{ totalExpense: number; breakdown: { label: string; total: number; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pageAccess, setPageAccess] = useState<{ canAccess: boolean; requiresSetup: boolean; reason?: string } | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const securityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userLockedRef = useRef(false);
  const lockedRef = useRef(true);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [maxAttempts] = useState(3);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const passwordResolveRef = useRef<((pw: string | null) => void) | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [showSubscriptionsPage, setShowSubscriptionsPage] = useState(false);
  const [budgetSubView, setBudgetSubView] = useState<'bills' | 'subscriptions'>('bills');
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);
  const [recalculateData, setRecalculateData] = useState<{ walletId: number; walletName: string; initialBalance: number; currentBalance: number; computedBalance: number; breakdown: RecalculateBreakdown[] } | null>(null);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [scrollToTransactionId, setScrollToTransactionId] = useState<number | null>(null);

  useEffect(() => { lockedRef.current = isLocked; }, [isLocked]);

  useEffect(() => {
    checkSetup();
    checkPageAccess();
    if (window.deskflowAPI?.financeGetDisplayCurrency) {
      window.deskflowAPI.financeGetDisplayCurrency().then(result => {
        if (result?.currency) {
          setDisplayCurrency(result.currency);
          setBaseCurrency(result.currency);
        }
      }).catch(() => { });
    }
    if (window.deskflowAPI?.financeGetAutoSave) {
      window.deskflowAPI.financeGetAutoSave().then(result => {
        if (result && typeof result.enabled === 'boolean') {
          setAutoSave(result.enabled);
        }
      }).catch(() => { });
    }
    if (window.deskflowAPI?.financeGetAutoRecalc) {
      window.deskflowAPI.financeGetAutoRecalc().then(result => {
        if (result && typeof result.enabled === 'boolean') {
          setAutoRecalc(result.enabled);
        }
      }).catch(() => { });
    }
  }, []);

  // Auto-save effect: when autoSave is ON and wallet is dirty, save automatically
  useEffect(() => {
    if (autoSave && isDirty && selectedWalletId) {
      const timer = setTimeout(() => {
        // Trigger save by dispatching a custom event that WalletDetailView listens to
        window.dispatchEvent(new CustomEvent('finance-auto-save'));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoSave, isDirty, selectedWalletId]);

  // Before unload warning when auto-save is OFF and there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!autoSave && isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [autoSave, isDirty]);

  useEffect(() => {
    if (window.deskflowAPI) {
      window.deskflowAPI.financeGetSecuritySettings().then(setSecuritySettings);
      window.deskflowAPI.financeGetPasswordRequirements().then(setPasswordRequirements);
      window.deskflowAPI.financeGetLockState().then((state: any) => {
        if (state) {
          setAttemptsLeft(state.attemptsLeft);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (securitySettings) {
      if (securitySettings.locked) {
        setIsLocked(true);
      } else if (securitySettings.rememberDevice && securitySettings.rememberDeviceExpiry && Date.now() < securitySettings.rememberDeviceExpiry) {
        setIsLocked(false);
      }
      if (securitySettings.displayCurrency) {
        setDisplayCurrency(securitySettings.displayCurrency);
        setBaseCurrency(securitySettings.displayCurrency);
      }
    }
  }, [securitySettings]);

  const checkSetup = async () => {
    try {
      const result = await window.deskflowAPI?.financeCheckPasswordSetup();
      if (result) {
        const setupResult = result as { hasPassword: boolean };
        setIsFirstTime(!setupResult.hasPassword);
        if (!setupResult.hasPassword) {
          setIsLocked(false);
        } else {
          setIsLocked(true);
        }
      }
    } catch {
      setIsFirstTime(true);
      setIsLocked(true);
    }
  };

  const checkPageAccess = async () => {
    try {
      const result = await window.deskflowAPI?.financeCheckPageAccess();
      if (result) {
        setPageAccess(result);
      }
    } catch (err) {
      console.error('[FinancePage] check page access error:', err);
      setPageAccess({ canAccess: false, requiresSetup: false, reason: 'access_denied' });
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [accts, wals, cats, txns, sum, spend, trends, subs, obSummary, ftPersonsData, renewals] = await Promise.all([
        (window.deskflowAPI?.financeGetAccounts() as Promise<FinanceAccount[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetWallets() as Promise<FinanceWallet[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetCategories() as Promise<FinanceCategory[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetTransactions() as Promise<FinanceTransaction[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetSummary() as Promise<FinanceSummary>) ?? Promise.resolve({ totalIncome: 0, totalExpense: 0, netBalance: 0 }),
        (window.deskflowAPI?.financeGetSpendingByCategory() as Promise<FinanceSpendingByCategory[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetMonthlyTrends() as Promise<FinanceMonthlyTrend[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.subscriptionsList() as Promise<any[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetOnBehalfOfSummary() as Promise<any>) ?? Promise.resolve({ totalExpense: 0, breakdown: [] }),
        (window.deskflowAPI?.financeGetFtPersons() as Promise<any[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.subscriptionsGetUpcomingRenewals(7) as Promise<any[]>) ?? Promise.resolve([]),
      ]);
      // Fetch fixed expenses & budgets separately (fault-tolerant — won't kill main load)
      let feList: FinanceFixedExpense[] = [];
      let feSummary: FixedExpenseSummary | null = null;
      let budList: FinanceBudget[] = [];
      let budStatusData: BudgetStatus | null = null;
      try { feList = (await window.deskflowAPI?.fixedExpensesList?.(selectedMonth)) || []; } catch { feList = []; }
      try { feSummary = (await window.deskflowAPI?.fixedExpensesSummary?.(selectedMonth)) || null; } catch { feSummary = null; }
      try { budList = (await window.deskflowAPI?.budgetsList?.()) || []; } catch { budList = []; }
      try { budStatusData = (await window.deskflowAPI?.budgetsGetStatus?.(selectedMonth)) || null; } catch { budStatusData = null; }
      setAccounts(accts);
      setWallets(wals);
      setCategories(cats);
      setTransactions(txns);
      setSubscriptions(subs);
      setUpcomingRenewals(renewals);
      setSummary(sum);
      setFtPersons(ftPersonsData);
      const totalExpenseAmt = spend.reduce((s, c) => s + c.amount, 0);
      setSpendingByCategory(spend.map(c => ({
        ...c,
        amount: c.amount,
        percentage: totalExpenseAmt > 0 ? c.amount / totalExpenseAmt * 100 : 0,
      })));
      setMonthlyTrends(trends);
      setOnBehalfOfSummary(obSummary);
      setFixedExpenses(feList);
      setFixedExpenseSummary(feSummary);
      setBudgets(budList);
      setBudgetStatus(budStatusData);
    } catch (err) {
      console.error('[FinancePage] fetch error:', err);
      setFetchError('Could not load finance data');
    } finally {
      setLoading(false);
    }
    // Auto-generate subscription transactions for due renewals
    try {
      const result = await (window as any).deskflowAPI?.subscriptionsGenerateDueTransactions();
      if (result && result.created > 0) {
        // Re-fetch to pick up newly created transactions
        const txns = await (window.deskflowAPI?.financeGetTransactions() as Promise<FinanceTransaction[]>) ?? [];
        setTransactions(txns);
      }
    } catch { /* silent — non-critical */ }
  }, [selectedMonth]);

  useEffect(() => {
    if (!isLocked) fetchData();
  }, [isLocked, fetchData]);

  useEffect(() => {
    if (!isLocked) fetchData();
  }, [selectedMonth]);

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = null;
  }, []);

  const startLockTimer = useCallback(() => {
    resetLockTimer();
    if (!securitySettings?.hasPassword || securitySettings?.locked) return;
    const timeoutMs = securitySettings?.lockTimeout ?? 5 * 60 * 1000;
    lockTimerRef.current = setTimeout(async () => {
      if (isFirstTime) return;
      await window.deskflowAPI?.financeLock();
      setIsLocked(true);
      lockTimerRef.current = null;
    }, timeoutMs);
  }, [securitySettings, resetLockTimer, isFirstTime]);

  // Page visibility: never unlocks an already-locked page
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        // Timer keeps running — it will fire even while the page is hidden.
      } else {
        if (userLockedRef.current) return;
        if (lockedRef.current) return; // already locked locally — stay locked
        if (window.deskflowAPI) {
          window.deskflowAPI.financeIsLocked().then(result => {
            const locked = result?.locked ?? true;
            setIsLocked(locked);
          });
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Lock timer: runs only while page is unlocked AND visible
  useEffect(() => {
    if (!isLocked && securitySettings?.hasPassword && !securitySettings?.locked) {
      startLockTimer();
    } else {
      resetLockTimer();
    }
    return () => resetLockTimer();
  }, [isLocked, securitySettings, startLockTimer, resetLockTimer]);

  // 30s polling: sync with backend lock state (sync only, no timer management)
  useEffect(() => {
    securityCheckIntervalRef.current = setInterval(() => {
      if (window.deskflowAPI && !userLockedRef.current && !lockedRef.current) {
        window.deskflowAPI.financeIsLocked().then(result => {
          const locked = result?.locked ?? true;
          setIsLocked(locked);
        });
      }
    }, 30000);
    return () => {
      if (securityCheckIntervalRef.current) clearInterval(securityCheckIntervalRef.current);
    };
  }, []);

  const handleUnlock = async (password: string): Promise<boolean> => {
    try {
      setLockError(null);
      const result = await window.deskflowAPI?.financeUnlock(password) as { success: boolean; attemptsLeft?: number };
      if (result?.success) {
        userLockedRef.current = false;
        setIsLocked(false);
        setAttemptsLeft(3);
        await checkPageAccess();
        return true;
      }
      if (result?.attemptsLeft !== undefined) {
        setAttemptsLeft(result.attemptsLeft);
      }
      setLockError('Wrong password');
      return false;
    } catch {
      setLockError('Unlock failed');
      return false;
    }
  };

  const handleSetup = async (password: string): Promise<boolean> => {
    try {
      setLockError(null);
      const result = await window.deskflowAPI?.financeSetPassword(password) as { success: boolean };
      if (result?.success) {
        setIsFirstTime(false);
        setIsLocked(false);
        await checkPageAccess();
        return true;
      }
      setLockError('Failed to set password');
      return false;
    } catch {
      setLockError('Setup failed');
      return false;
    }
  };

  const handleBiometricUnlock = async (): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeBiometricUnlock() as { success: boolean };
      if (result?.success) {
        userLockedRef.current = false;
        setIsLocked(false);
        await checkPageAccess();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleLock = async () => {
    if (isFirstTime) return;
    userLockedRef.current = true;
    await window.deskflowAPI?.financeLock();
    setIsLocked(true);
  };

  // Reset lock timer on any user interaction while unlocked
  useEffect(() => {
    const resetOnActivity = () => {
      if (!isLocked && securitySettings?.hasPassword && !securitySettings?.locked) {
        startLockTimer();
      }
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach(e => document.addEventListener(e, resetOnActivity, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, resetOnActivity));
  }, [isLocked, securitySettings, startLockTimer]);

  useEffect(() => {
    if (selectedWalletId) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSelectedWalletId(null);
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [selectedWalletId]);

  const handleCreateAccount = async (data: {
    name: string; type: FinanceAccount['type']; description?: string;
    icon?: string; color?: string;
  }): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeCreateAccount({
        name: data.name, type: data.type, description: data.description || null,
        icon: data.icon || 'Wallet', color: data.color || '#10b981',
        currency: 'USD', balance: 0,
      }) as FinanceAccount;
      if (result) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleNewTransactionFromPerson = useCallback((personId: number) => {
    // Find the first non-archived wallet to open the modal
    const firstWallet = wallets.find(w => !w.is_archived);
    if (!firstWallet) return;
    setPreselectedFtPersonId(personId);
    setPreselectedOnBehalfOf(true);
    setWalletTxModal(firstWallet.type);
  }, [wallets]);

  const handlePeopleGoToTransactions = useCallback((txId: number) => {
    setActiveTab('transactions');
    setScrollToTransactionId(txId);
  }, []);

  const handleAddTransaction = async (data: {
    account_id: number; wallet_id: number | null; category_id: number;
    type: string; amount: number;
    description: string; note?: string; date: string;
    to_wallet_id?: number; fromWalletName?: string; toWalletName?: string;
    [key: string]: any;
  }): Promise<boolean> => {
    try {
      if (data.type === 'transfer' && data.to_wallet_id) {
        console.log('[FinancePage] Creating transfer:', JSON.stringify({ type: data.type, wallet_id: data.wallet_id, account_id: data.account_id, to_wallet_id: data.to_wallet_id, amount: data.amount, fee: data.fee, dest_amount: data.dest_amount }));
        const result = await window.deskflowAPI?.financeCreateTransfer(data) as { transferId?: string; success?: boolean; error?: string };
        console.log('[FinancePage] Transfer result:', JSON.stringify(result));
        if (result?.success) {
          // For crypto transfers, the backend handles wallet metadata directly.
          // Only merge dest_metadata for physical/cash denomination wallets.
          if (data.dest_metadata && data.to_wallet_id && data.dest_metadata.denominations) {
            const dstWallet = wallets.find(w => w.id === data.to_wallet_id);
            if (dstWallet && (dstWallet.type === 'physical' || dstWallet.type === 'cash')) {
              let meta: Record<string, any> = {};
              if (dstWallet.metadata) {
                try { meta = typeof dstWallet.metadata === 'object' ? dstWallet.metadata : JSON.parse(dstWallet.metadata as string); } catch { meta = {}; }
              }
              const incomingDenoms = data.dest_metadata.denominations;
              const existing = meta.denominations ?? {};
              const merged: Record<string, number> = { ...existing };
              for (const [d, n] of Object.entries(incomingDenoms)) {
                merged[+d] = (merged[+d] ?? 0) + (n as number);
              }
              meta.denominations = merged;
              await window.deskflowAPI?.financeUpdateWalletMetadata({ id: data.to_wallet_id, metadata: meta });
            }
          }
          await fetchData();
          // Auto-recalc both source and destination wallets after transfer
          if (autoRecalc && data.wallet_id) {
            try { await window.deskflowAPI?.financeRecalculateBalances(data.wallet_id, false); } catch { /* best-effort */ }
          }
          if (autoRecalc && data.to_wallet_id) {
            try { await window.deskflowAPI?.financeRecalculateBalances(data.to_wallet_id, false); } catch { /* best-effort */ }
          }
          await fetchData();
          return true;
        }
        throw new Error(result?.error || 'Transfer failed');
      }
      const result = await window.deskflowAPI?.financeCreateTransaction(data) as any;
      if (result?.error) throw new Error(result.error);
      if (result) {
        await fetchData();
        if (autoRecalc && data.wallet_id) {
          try { await window.deskflowAPI?.financeRecalculateBalances(data.wallet_id, false); } catch { /* best-effort */ }
          await fetchData();
        }
        return true;
      }
      throw new Error('Transaction returned no data from server');
    } catch (e: any) { throw new Error(e?.message || 'Failed to save transaction'); }
  };

  const handleDeleteTransaction = async (id: number): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeDeleteTransaction(id) as { success: boolean };
      if (result?.success) {
        await fetchData();
        if (autoRecalc) {
          try { await window.deskflowAPI?.financeRecalculateBalances(undefined, false); } catch { /* best-effort */ }
          await fetchData();
        }
        return true;
      }
      return false;
    } catch { return false; }
  };

  const handleUpdateTransaction = async (id: number, data: Record<string, any>): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeUpdateTransaction(id, data);
      if (result?.success === false) {
        setNotifMsg('Failed to update transaction');
        return false;
      }
      await fetchData();
      if (autoRecalc) {
        try { await window.deskflowAPI?.financeRecalculateBalances(undefined, false); } catch { /* best-effort */ }
        await fetchData();
      }
      return true;
    } catch {
      setNotifMsg('Failed to update transaction');
      return false;
    }
  };

  const handleCreateCategory = async (data: {
    name: string; type: FinanceCategory['type']; icon?: string; color?: string;
  }): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeCreateCategory(data) as FinanceCategory;
      if (result) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleUpdateCategory = async (data: {
    id: number; name: string; type: string; icon: string; color: string;
  }): Promise<boolean> => {
    try {
      const result = await (window as any).deskflowAPI?.financeUpdateCategory(data);
      if (result) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  useEffect(() => { lockedRef.current = isLocked; }, [isLocked]);

  const handleRecordFtRepayment = useCallback(async (data: { originalTxId: number; personId?: number; amount: number; date: string; walletId?: number; description?: string; isOverpayment?: boolean }): Promise<boolean> => {
    try {
      const result = await (window as any).deskflowAPI?.financeRecordFtRepayment(data);
      if (result?.success) { fetchData(); return true; }
      return false;
    } catch { return false; }
  }, [fetchData]);

  const handleGenerateSubscriptions = useCallback(async () => {
    try {
      const result = await (window as any).deskflowAPI?.subscriptionsGenerateDueTransactions();
      if (result) { fetchData(); return result; }
      return { created: 0, subscriptions: [] };
    } catch { return { created: 0, subscriptions: [] }; }
  }, [fetchData]);

  const handleSkipRenewal = useCallback(async (id: number): Promise<boolean> => {
    try {
      const result = await (window as any).deskflowAPI?.subscriptionsSkipRenewal(id);
      if (result?.success) { fetchData(); return true; }
      return false;
    } catch { return false; }
  }, [fetchData]);

  const handleEditTransaction = async (id: number, data: Record<string, any>): Promise<boolean> => {
    try {
      const txn = transactions.find(t => t.id === id);
      if (!txn) return false;
      const payload = { id, account_id: txn.account_id, wallet_id: txn.wallet_id, category_id: data.category_id ?? txn.category_id, type: txn.type, amount: txn.amount, description: data.description ?? txn.description, note: data.note ?? txn.note, date: data.date ?? txn.date, time: txn.time };
      const result = await window.deskflowAPI?.financeUpdateTransaction(payload);
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleCreateSubscription = async (data: any): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.subscriptionsCreate(data);
      if (result) {
        await fetchData();
        if (result.hasBalance === false) {
          // Return a special value to indicate insufficient balance
          return true; // subscription created but no transaction
        }
        return true;
      }
      return false;
    } catch { return false; }
  };

  const handleUpdateSubscription = async (data: any): Promise<boolean> => {
    try { const result = await window.deskflowAPI?.subscriptionsUpdate(data); if (result?.success) { await fetchData(); return true; } return false; } catch { return false; }
  };

  const handleDeleteSubscription = async (id: number): Promise<boolean> => {
    try { const result = await window.deskflowAPI?.subscriptionsDelete(id); if (result?.success) { await fetchData(); return true; } return false; } catch { return false; }
  };

  const handleMoveSubscriptionTransaction = async (subscriptionId: number, newWalletId: number): Promise<boolean> => {
    try { const result = await (window as any).deskflowAPI?.subscriptionsMoveTransaction({ subscriptionId, newWalletId }); if (result?.success) { await fetchData(); return true; } return false; } catch { return false; }
  };

  const handleRetrySubscriptionPayment = async (subscriptionId: number, walletId?: number, date?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await (window as any).deskflowAPI?.subscriptionsRetryPayment({ subscriptionId, walletId, date });
      if (result?.success) { await fetchData(); }
      return result || { success: false, error: 'Unknown error' };
    } catch { return { success: false, error: 'Network error' }; }
  };

  const handleToggleAutodebet = async (id: number): Promise<boolean> => {
    try { const result = await (window as any).deskflowAPI?.subscriptionsToggleAutodebet(id); return result?.success || false; } catch { return false; }
  };

  const handleRecordSubscriptionPayment = async (subscriptionId: number, walletId?: number, amount?: number, date?: string): Promise<boolean> => {
    try {
      const result = await (window as any).deskflowAPI?.subscriptionsRecordPayment({ subscriptionId, walletId, amount, date });
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleRecalculateBalance = async (walletId?: number): Promise<boolean> => {
    if (!walletId) return false;
    try {
      const result = await window.deskflowAPI?.financeRecalculateBalances(walletId, true);
      if (result?.success && result?.breakdown) {
        setRecalculateData({ walletId, walletName: result.walletName || '', initialBalance: result.initialBalance || 0, currentBalance: result.oldBalance || 0, computedBalance: result.newBalance || 0, breakdown: result.breakdown });
        setShowRecalculateModal(true);
        return true;
      }
      return false;
    } catch { return false; }
  };

  const handleApplyRecalculatedBalance = async () => {
    if (!recalculateData) return;
    try {
      const result = await window.deskflowAPI?.financeApplyRecalculatedBalance(recalculateData.walletId);
      if (result?.success) {
        setShowRecalculateModal(false);
        setRecalculateData(null);
        setNotifMsg(`Balance applied for ${recalculateData.walletName}`);
        setTimeout(() => setNotifMsg(null), 3000);
        await fetchData();
      } else {
        setNotifMsg('Failed to apply balance');
        setTimeout(() => setNotifMsg(null), 3000);
      }
    } catch { setNotifMsg('Failed to apply balance'); setTimeout(() => setNotifMsg(null), 3000); }
  };

  const [syncStatus, setSyncStatus] = useState<{ phase: string; wallets: number; updated: number } | null>(null);
  const [syncResults, setSyncResults] = useState<string[] | null>(null);

  const handleRecalculateAllBalances = async () => {
    try {
      setSyncResults(null);
      const results: string[] = [];

      // Phase 1: Fix historical dates
      setSyncStatus({ phase: 'Fixing historical dates...', wallets: 0, updated: 0 });
      try {
        const histResult = await window.deskflowAPI?.financeFixHistoricalDates() as any;
        if (histResult?.fixed > 0) {
          results.push(`Fixed ${histResult.fixed} historical transaction date(s) → 1900-01-01`);
        } else {
          results.push('All historical dates already correct');
        }
      } catch { results.push('Historical date fix skipped'); }

      // Phase 2: Sync wallet balances
      setSyncStatus({ phase: 'Scanning wallets...', wallets: 0, updated: 0 });
      const wallets = await window.deskflowAPI?.financeGetWallets() as any[];
      const totalWallets = wallets?.length || 0;
      setSyncStatus({ phase: `Syncing ${totalWallets} wallets...`, wallets: totalWallets, updated: 0 });

      let updatedCount = 0;
      let balancedCount = 0;
      for (const w of (wallets || [])) {
        try {
          setSyncStatus({ phase: `Syncing ${w.name || 'Wallet'}...`, wallets: totalWallets, updated: updatedCount });
          const result = await window.deskflowAPI?.financeRecalculateBalances(w.id, true) as any;
          if (result?.success) {
            if (result.breakdown && result.breakdown.length > 0) {
              const diff = Math.abs((result.newBalance || 0) - (result.oldBalance || 0));
              if (diff > 0.01) {
                await window.deskflowAPI?.financeApplyRecalculatedBalance(w.id);
                updatedCount++;
              } else {
                balancedCount++;
              }
            }
          }
        } catch { /* skip wallet */ }
      }

      if (updatedCount > 0) {
        results.push(`Updated ${updatedCount} wallet balance(s)`);
      }
      if (balancedCount > 0) {
        results.push(`${balancedCount} wallet(s) already balanced`);
      }

      // Phase 3: Crypto history backfill
      setSyncStatus({ phase: 'Backfilling crypto history...', wallets: totalWallets, updated: updatedCount });
      try {
        await window.deskflowAPI?.financeRecalculateBalances() as any; // no walletId = all wallets path does crypto backfill
        results.push('Crypto asset history backfilled');
      } catch { results.push('Crypto history backfill skipped'); }

      // Done
      setSyncStatus({ phase: 'Done!', wallets: totalWallets, updated: updatedCount });
      setSyncResults(results);
      await fetchData();
      setTimeout(() => { setSyncStatus(null); }, 5000);
      setTimeout(() => { setSyncResults(null); }, 8000);
    } catch {
      setSyncStatus(null);
      setSyncResults(['Sync failed — try again']);
      setTimeout(() => { setSyncResults(null); setSyncStatus(null); }, 4000);
    }
  };

  const handleCreateWallet = async (data: {
    account_id: number; name: string; type: string; provider?: string;
    last_four?: string; balance?: number; currency?: string;
    metadata?: Record<string, any>;
  }): Promise<boolean> => {
    try {
      const payload = {
        account_id: data.account_id, name: data.name, type: data.type,
        provider: data.provider, last_four: data.last_four,
        balance: data.balance ?? 0, currency: data.currency,
      };
      const result = await window.deskflowAPI?.financeCreateWallet(payload) as { id: number };
      if (result?.id) {
        if (data.metadata && Object.keys(data.metadata).length > 0) {
          await window.deskflowAPI?.financeUpdateWalletMetadata({ id: result.id, metadata: data.metadata });
        }
        setNotifMsg(`"${data.name}" created`);
        setTimeout(() => setNotifMsg(null), 3000);
        await fetchData();
        return true;
      }
      setNotifMsg('Failed to create wallet');
      setTimeout(() => setNotifMsg(null), 3000);
      return false;
    } catch (e) { setNotifMsg('Failed to create wallet'); setTimeout(() => setNotifMsg(null), 3000); return false; }
  };

  const handleArchiveWallet = async (id: number): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeArchiveWallet(id) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const hasPassword = securitySettings?.hasPassword ?? false;

  const handlePasswordConfirm = async (pw: string): Promise<boolean> => {
    const ok = await window.deskflowAPI?.financeVerifyPassword(pw) as { success: boolean };
    if (ok?.success) {
      const resolve = passwordResolveRef.current;
      if (resolve) {
        passwordResolveRef.current = null;
        resolve(true);
      }
    }
    return ok?.success ?? false;
  };

  const handlePasswordDialogClose = () => {
    setShowPasswordDialog(false);
    const resolve = passwordResolveRef.current;
    if (resolve) {
      passwordResolveRef.current = null;
      resolve(false);
    }
  };

  const checkPasswordRequirement = async (action: string): Promise<boolean> => {
    if (!hasPassword) return true;
    if (passwordRequirements[`password_req_${action}`] !== false) {
      return new Promise<boolean>((resolve) => {
        passwordResolveRef.current = resolve;
        setShowPasswordDialog(true);
      });
    }
    return true;
  };

  const handleDeleteAccount = async (id: number): Promise<boolean> => {
    if (!await checkPasswordRequirement('delete_account')) return false;
    try {
      const result = await window.deskflowAPI?.financeDeleteAccount(id) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleSaveMetadata = async (id: number, metadata: Record<string, any>): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeUpdateWalletMetadata({ id, metadata }) as any;
      if (result?.id) { await fetchData(); return true; }
      setNotifMsg('Failed to save metadata');
      setTimeout(() => setNotifMsg(null), 3000);
      return false;
    } catch { setNotifMsg('Failed to save metadata'); setTimeout(() => setNotifMsg(null), 3000); return false; }
  };

  const handleWalletClick = (id: number) => {
    setSelectedWalletId(id);
  };

  const handleDeleteWallet = async (id: number): Promise<boolean> => {
    if (!await checkPasswordRequirement('delete_wallet')) return false;
    try {
      const walletName = wallets.find(w => w.id === id)?.name || 'Wallet';
      const result = await window.deskflowAPI?.financeDeleteWallet(id) as { success: boolean };
      if (result?.success) {
        setNotifMsg(`${walletName} deleted`);
        setTimeout(() => setNotifMsg(null), 3000);
        await fetchData();
        return true;
      }
      setNotifMsg('Failed to delete wallet');
      setTimeout(() => setNotifMsg(null), 3000);
      return false;
    } catch { setNotifMsg('Failed to delete wallet'); setTimeout(() => setNotifMsg(null), 3000); return false; }
  };

  const handleViewArchived = async () => {
    const [archAccts, archWals] = await Promise.all([
      window.deskflowAPI?.financeGetArchivedAccounts() as Promise<FinanceAccount[]>,
      window.deskflowAPI?.financeGetArchivedWallets() as Promise<FinanceWallet[]>,
    ]);
    setArchivedAccounts(archAccts ?? []);
    setArchivedWallets(archWals ?? []);
    setShowArchived(true);
  };

  const handleUnarchiveAccount = async (id: number): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeUnarchiveAccount(id) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleUnarchiveWallet = async (id: number): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeUnarchiveWallet(id) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleUpdateWallet = async (data: {
    id: number; name: string; type: string; provider?: string;
    last_four?: string; balance?: number; currency?: string;
  }): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeUpdateWallet(data) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      setNotifMsg('Failed to update wallet');
      setTimeout(() => setNotifMsg(null), 3000);
      return false;
    } catch { setNotifMsg('Failed to update wallet'); setTimeout(() => setNotifMsg(null), 3000); return false; }
  };

  const netWorth = useMemo(() =>
    accounts.reduce((s, a) => {
      if (a.type === 'custodial') return s;
      const walletSum = wallets
        .filter(w => w.account_id === a.id && !w.is_archived)
        .reduce((ws, w) => {
          let total = 0;
          if ((w.type === 'physical' || w.type === 'cash') && w.metadata?.denominations) {
            // Physical: normalize denominations format (array or record)
            const denoms = w.metadata.denominations;
            if (Array.isArray(denoms)) {
              total = denoms.reduce((sx: number, d: any) => sx + (d.value || 0) * (d.count || 0), 0);
            } else if (typeof denoms === 'object') {
              total = Object.entries(denoms).reduce((sx: number, [val, cnt]: [string, any]) => sx + (parseFloat(val) || 0) * (Number(cnt) || 0), 0);
            } else {
              total = w.balance ?? 0;
            }
          } else if ((w.type === 'crypto' || w.type === 'investment') && w.metadata?.assets) {
            // Crypto: use wallet.balance (available fiat) + market value of assets
            total = w.balance ?? 0;
            try {
              const assets = typeof w.metadata.assets === 'string' ? JSON.parse(w.metadata.assets) : w.metadata.assets;
              if (Array.isArray(assets)) {
                // Try to compute market value from assets (amount * price if available)
                const marketValue = assets.reduce((cs: number, a: any) => {
                  const amt = Number(a.amount) || 0;
                  const price = Number(a.currentPrice || a.price || a.avg_buy_price || a.avgBuyPrice) || 0;
                  return cs + (amt * price);
                }, 0);
                if (marketValue > 0) total += marketValue;
              }
            } catch { /* ignore */ }
          } else {
            total = w.balance ?? 0;
          }
          return ws + convertAmount(total, w.currency || baseCurrency, displayCurrency);
        }, 0);
      return s + walletSum;
    }, 0),
    [accounts, wallets, displayCurrency, baseCurrency]
  );

  const ftReceivable = useMemo(
    () => followThroughReceivable(transactions),
    [transactions],
  );
  const netWorthTotal = useMemo(
    () => netWorthWithReceivable(netWorth, ftReceivable),
    [netWorth, ftReceivable],
  );

  const trend = useMemo(() => {
    if (monthlyTrends.length < 2) return null;
    const last = monthlyTrends[monthlyTrends.length - 1];
    const prev = monthlyTrends[monthlyTrends.length - 2];
    const lastNet = last.net;
    const prevNet = prev.net;
    const diff = lastNet - prevNet;
    // Use absolute prev value as base — if prev is 0 or very small, cap the percentage
    const base = Math.abs(prevNet);
    const pct = base > 1 ? (diff / base) * 100 : (diff > 0 ? 100 : diff < 0 ? -100 : 0);
    // Cap extreme percentages to prevent 7000% display
    const cappedPct = Math.max(-100, Math.min(1000, pct));
    return { value: diff, percent: cappedPct };
  }, [monthlyTrends]);

  if (isLocked && !isFirstTime) {
    return (
      <div className="flex flex-col h-full" style={{ ['--page-accent' as string]: '#10b981' }}>
        <AuroraBackground intense />
        <FinanceLockScreen
          onUnlock={handleUnlock}
          onSetup={handleSetup}
          onBiometricUnlock={handleBiometricUnlock}
          isFirstTime={false}
          error={lockError}
          attemptsLeft={attemptsLeft}
          maxAttempts={maxAttempts}
        />
      </div>
    );
  }

  if (pageAccess && !pageAccess.canAccess) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-5">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-zinc-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Access Restricted</h2>
          <p className="text-sm text-zinc-400 mb-4">
            {pageAccess.reason === 'locked'
              ? 'Your finance page is currently locked. Please unlock to access your data.'
              : 'You do not have permission to access the finance page.'}
          </p>
          {pageAccess.reason === 'locked' && (
            <button
              onClick={() => { setIsLocked(true); checkPageAccess(); }}
              className="px-4 py-2 rounded-lg bg-[var(--page-accent)] hover:bg-[var(--page-accent)]/90 text-white text-sm font-medium transition-colors"
            >
              Unlock Now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PageShell page="finance" variant="sticky-header" style={{ ['--page-accent' as string]: '#10b981' }}>
      <CurrentCanvas accent="#10b981" render={renderFlow} />
      <div className="relative z-10">
      <AuroraBackground />

      <div className="relative isolate min-h-full px-6 pt-4 pb-28 mx-auto w-full max-w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCurrencyPicker(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 light:bg-zinc-100/60 light:bg-zinc-100 text-zinc-300 hover:text-white text-xs font-medium transition-colors border border-zinc-700 light:border-zinc-300/30 light:border-zinc-300/30 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            >
              <span>{getCurrencyInfo(displayCurrency).symbol}</span>
              <span>{displayCurrency}</span>
            </button>
          </div>

          <AnimatePresence>
            {showCurrencyPicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
                onClick={() => setShowCurrencyPicker(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 20 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-xs bg-zinc-900 light:bg-white/95 backdrop-blur-xl border border-zinc-700 light:border-zinc-300/50 rounded-xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 pt-4 pb-2 border-b border-zinc-700 light:border-zinc-300/30 light:border-zinc-300/30">
                    <h3 className="text-sm font-semibold text-white">Select Currency</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Display currency for all amounts</p>
                  </div>
                  <div className="p-2 max-h-72 overflow-y-auto">
                    {['USD', 'IDR', 'SGD', 'GBP', 'EUR', 'JPY', 'AUD', 'CNY', 'KRW', 'INR'].map(code => (
                      <button
                        key={code}
                        onClick={() => { setDisplayCurrency(code); setShowCurrencyPicker(false); window.deskflowAPI?.financeSetDisplayCurrency(code); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${displayCurrency === code ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-300 hover:bg-zinc-800 light:bg-zinc-100/60 light:bg-zinc-100'
                          }`}
                      >
                        <span className="w-6 text-center text-base">{getCurrencyInfo(code).symbol}</span>
                        <span className="font-medium">{code}</span>
                        <span className="text-[11px] text-zinc-500 ml-auto">{getCurrencyInfo(code).name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mb-6" style={{ display: selectedWalletId ? 'none' : undefined }}>
          <TabBar tabs={tabs} activeKey={activeTab} onTabChange={(k) => {
            if (isDirty) {
              if (autoSave) {
                window.dispatchEvent(new CustomEvent('finance-auto-save'));
              } else if (!window.confirm('Discard unsaved changes?')) {
                return;
              }
            }
            setActiveTab(k as FinanceTabKey);
            setSelectedWalletId(null);
            setIsDirty(false);
          }} />
        </div>

        <FinanceStickyHeader
          isLocked={isLocked}
          netWorth={netWorthTotal}
          displayCurrency={displayCurrency}
          onToggleLock={handleLock}
          trend={trend}
          monthlyTrends={monthlyTrends}
          hasPassword={securitySettings?.hasPassword ?? true}
          syncStatus={syncStatus}
          syncResults={syncResults}
          onSyncBalances={handleRecalculateAllBalances}
          onSyncDismiss={() => setSyncResults(null)}
        />

        <SubscriptionRenewalBanner
          upcomingRenewals={upcomingRenewals}
          displayCurrency={displayCurrency}
          onGenerateTransactions={handleGenerateSubscriptions}
          onSkipRenewal={handleSkipRenewal}
          onRefresh={fetchData}
        />

        {(() => {
          const dw = selectedWalletId ? wallets.find(x => x.id === selectedWalletId) : null;
          const showDetail = dw !== undefined;
          if (showDetail && dw) {
            return (
              <WalletDetailView
                key={dw.id}
                wallet={dw}
                displayCurrency={displayCurrency}
                transactions={transactions}
                wallets={wallets}
                accounts={accounts}
                categories={categories}
                onBack={() => setSelectedWalletId(null)}
                onSaveMetadata={handleSaveMetadata}
                onUpdateWallet={handleUpdateWallet}
                onDeleteWallet={handleDeleteWallet}
                onAddTransaction={(walletType) => setWalletTxModal(walletType as any)}
                onDirtyChange={setIsDirty}
                onRecalculateBalance={handleRecalculateBalance}
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onVerifyPassword={handleUnlock}
                ftPersons={ftPersons}
                onAddFtPerson={async (name: string) => {
                  const result = await window.deskflowAPI?.financeCreateFtPerson({ name });
                  if (result) {
                    setFtPersons(prev => {
                      if (prev.some(p => p.id === result.id)) return prev;
                      return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
                    });
                  }
                }}
                onNotify={(msg, type) => { setNotifMsg(msg); setTimeout(() => setNotifMsg(null), 3000); }}
                subscriptions={subscriptions}
              />
            );
          }
          return (
            <>
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <OverviewTab
                    data-section="finance.overview"
                    summary={summary}
                    spendingByCategory={spendingByCategory}
                    monthlyTrends={monthlyTrends}
                    accounts={accounts}
                    recentTransactions={transactions.slice(0, 5)}
                    allTransactions={transactions}
                    loading={loading}
                    error={fetchError}
                    onRetry={fetchData}
                    onCreateAccount={handleCreateAccount}
                    onAddTransaction={handleAddTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    onVerifyPassword={handleUnlock}
                    categories={categories}
                    wallets={wallets}
                    subscriptions={subscriptions}
                    displayCurrency={displayCurrency}
                    baseCurrency={baseCurrency}
                    currentNetWorth={netWorthTotal}
                    onBehalfOfSummary={onBehalfOfSummary}
                    onRecordFtRepayment={handleRecordFtRepayment}
                  />
                </motion.div>
              )}
              {activeTab === 'wallets' && (
                <motion.div
                  key="wallets"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <WalletsTab
                    data-section="finance.wallets"
                    accounts={accounts}
                    wallets={wallets}
                    loading={loading}
                    displayCurrency={displayCurrency}
                    onCreateAccount={handleCreateAccount}
                    onCreateWallet={handleCreateWallet}
                    onArchiveWallet={handleArchiveWallet}
                    onUpdateWallet={handleUpdateWallet}
                    onDeleteAccount={handleDeleteAccount}
                    onDeleteWallet={handleDeleteWallet}
                    onViewArchived={handleViewArchived}
                    archivedCount={archivedAccounts.length + archivedWallets.length}
                    error={fetchError}
                    onRetry={fetchData}
                    onWalletClick={handleWalletClick}
                  />
                </motion.div>
              )}
              {activeTab === 'transactions' && (
                <motion.div
                  key="transactions"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <TransactionsTab
                    data-section="finance.transactions"
                    transactions={transactions}
                    accounts={accounts}
                    categories={categories}
                    wallets={wallets}
                    loading={loading}
                    displayCurrency={displayCurrency}
                    baseCurrency={baseCurrency}
                    onAddTransaction={handleAddTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                    onVerifyPassword={handleUnlock}
                    error={fetchError}
                    onRetry={fetchData}
                    ftPersons={ftPersons}
                    onAddFtPerson={async (name: string) => {
                      const result = await window.deskflowAPI?.financeCreateFtPerson({ name });
                      if (result) {
                        setFtPersons(prev => {
                          if (prev.some(p => p.id === result.id)) return prev;
                          return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
                        });
                      }
                    }}
                    scrollToTransactionId={scrollToTransactionId}
                    onScrollToTransactionDone={() => setScrollToTransactionId(null)}
                  />
                </motion.div>
              )}
              {activeTab === 'categories' && (
                <motion.div
                  key="categories"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CategoriesTab
                    data-section="finance.categories"
                    categories={categories}
                    loading={loading}
                    displayCurrency={displayCurrency}
                    baseCurrency={baseCurrency}
                    onCreateCategory={handleCreateCategory}
                    onUpdateCategory={handleUpdateCategory}
                    error={fetchError}
                    onRetry={fetchData}
                  />
                </motion.div>
              )}
              {activeTab === 'people' && (
                <motion.div
                  key="people"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <PeopleTab
                    persons={ftPersons}
                    transactions={transactions}
                    wallets={wallets}
                    displayCurrency={displayCurrency}
                    onRefresh={fetchData}
                    onNewTransaction={handleNewTransactionFromPerson}
                    accounts={accounts}
                    categories={categories}
                    baseCurrency={baseCurrency}
                    onDeleteTransaction={handleDeleteTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                    onVerifyPassword={handleUnlock}
                    ftPersons={ftPersons}
                    onAddFtPerson={async (name: string) => {
                      const result = await window.deskflowAPI?.financeCreateFtPerson({ name });
                      if (result) {
                        setFtPersons(prev => {
                          if (prev.some(p => p.id === result.id)) return prev;
                          return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
                        });
                      }
                    }}
                    onGoToTransactions={handlePeopleGoToTransactions}
                  />
                </motion.div>
              )}
               {activeTab === 'budget' && (
                 <motion.div key="budget" variants={tabPanel} initial="enter" animate="center" exit="exit"
                   transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}>
                   <div className="mb-4">
                     <TabBar
                       tabs={[
                         { key: 'bills', label: 'Bills & Budget', icon: <Target className="w-3.5 h-3.5" /> },
                         { key: 'subscriptions', label: 'Subscriptions', icon: <Bell className="w-3.5 h-3.5" /> },
                       ]}
                       activeKey={budgetSubView}
                       onTabChange={(k) => setBudgetSubView(k as 'bills' | 'subscriptions')}
                     />
                   </div>
                   {budgetSubView === 'bills' && (
                     <BudgetExpensesDashboard displayCurrency={displayCurrency} />
                   )}
                   {budgetSubView === 'subscriptions' && !showSubscriptionsPage && (
                     <SubscriptionsTab
                       data-section="finance.subscriptions"
                       subscriptions={subscriptions}
                       wallets={wallets}
                       transactions={transactions}
                       categories={categories}
                       displayCurrency={displayCurrency}
                       onRefresh={fetchData}
                       onGenerateTransactions={handleGenerateSubscriptions}
                       onSkipRenewal={handleSkipRenewal}
                       onViewAll={() => setShowSubscriptionsPage(true)}
                       onCreate={handleCreateSubscription}
                       onUpdate={handleUpdateSubscription}
                       onDelete={handleDeleteSubscription}
                       onMoveTransaction={handleMoveSubscriptionTransaction}
                       onRetryPayment={handleRetrySubscriptionPayment}
                       onToggleAutodebet={handleToggleAutodebet}
                       onRecordPaymentManual={handleRecordSubscriptionPayment}
                       onGetPaymentHistory={async (subId) => {
                         try { return await (window as any).deskflowAPI?.subscriptionsGetPaymentHistory?.(subId); }
                         catch { return { success: false }; }
                       }}
                        onCancelPayment={async (subId, txnId, reason) => {
                          try {
                            const r = await (window as any).deskflowAPI?.subscriptionsCancelPayment?.({ subscriptionId: subId, transactionId: txnId, reason });
                            if (r?.success) { await fetchData(); return true; }
                            return false;
                          } catch (e: any) { console.error('[FinancePage] subscriptionsCancelPayment error:', e); throw e; }
                        }}
                       onNotify={(msg, type) => { setNotifMsg(msg); setTimeout(() => setNotifMsg(null), 3000); }}
                     />
                   )}
                   {budgetSubView === 'subscriptions' && showSubscriptionsPage && (
                     <SubscriptionsPageView
                       data-section="finance.subscriptions.full"
                       subscriptions={subscriptions}
                       wallets={wallets}
                       categories={categories}
                       displayCurrency={displayCurrency}
                       onRefresh={fetchData}
                       onGenerateTransactions={handleGenerateSubscriptions}
                       onSkipRenewal={handleSkipRenewal}
                       onBack={() => setShowSubscriptionsPage(false)}
                     />
                   )}
                 </motion.div>
               )}
                {activeTab === 'charts' && (
                 <motion.div
                   key="charts"
                   variants={tabPanel}
                   initial="enter"
                   animate="center"
                   exit="exit"
                   transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                 >
                    <FinanceChartsTab
                      spendingByCategory={spendingByCategory}
                      monthlyTrends={monthlyTrends}
                      allTransactions={transactions}
                      wallets={wallets}
                      displayCurrency={displayCurrency}
                      baseCurrency={baseCurrency}
                      loading={loading}
                      error={fetchError}
                      onRetry={fetchData}
                    />
                 </motion.div>
               )}
               {activeTab === 'audit' && (

                <motion.div
                  key="audit"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                   <AuditLogTab
                    data-section="finance.audit"
                    displayCurrency={displayCurrency}
                  />
                </motion.div>
              )}
               {activeTab === 'recap' && (
                <motion.div
                  key="recap"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <RecapPanel
                    data-section="finance.recap"
                    displayCurrency={displayCurrency}
                    onNotify={(msg, type) => { setNotifMsg(msg); setTimeout(() => setNotifMsg(null), 3000); }}
                  />
                </motion.div>
              )}
            </>
            );
        })()}
      </div>

      <motion.button
        variants={fab}
        initial="hidden"
        animate="show"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          if (selectedWalletId) {
            const w = wallets.find(x => x.id === selectedWalletId);
            if (w) setWalletTxModal(w.type);
          } else {
            setShowWalletSelector(true);
          }
        }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center z-[var(--z-elevated)] focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.35)]"
        title="New transaction (Ctrl+N)"
      >
        <Plus className="w-5 h-5" />
      </motion.button>

      {showWalletSelector && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[var(--z-modal)] flex items-end justify-center pb-24 sm:items-center sm:pb-0"
          onClick={() => setShowWalletSelector(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-zinc-900 light:bg-white/95 backdrop-blur-xl border border-zinc-700 light:border-zinc-300/50 rounded-2xl p-4 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">Quick Transaction</p>
            {(() => {
              const activeWallets = wallets.filter(w => !w.is_archived);
              if (activeWallets.length === 0) {
                return <p className="text-xs text-zinc-600 text-center py-6">No wallets yet — create one first</p>;
              }
              const TYPE_EMOJI: Record<string, string> = {
                bank: '🏦', debit_card: '💳', credit_card: '💳',
                crypto: '₿', physical: '💵', cash: '💰', ewallet: '📱', other: '📦',
              };
              const TYPE_COLOR: Record<string, string> = {
                bank: '#3B82F6', debit_card: '#10B981', credit_card: '#F59E0B',
                crypto: '#8B5CF6', physical: '#F97316', cash: '#EC4899', ewallet: '#06B6D4', other: '#6B7280',
              };
              const fc = (v: number) => formatCurrency(convertAmount(v, baseCurrency, displayCurrency), displayCurrency);
              return (
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                  {activeWallets.map(w => {
                    const color = TYPE_COLOR[w.type] || '#6B7280';
                    return (
                      <button
                        key={w.id}
                        onClick={() => {
                          setSelectedWalletId(w.id);
                          setWalletTxModal(w.type);
                          setShowWalletSelector(false);
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 hover:bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 transition-colors text-left focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                      >
                        <span className="text-lg shrink-0">{TYPE_EMOJI[w.type] || '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">{w.name}</p>
                          <p className="text-[10px] text-zinc-500">{accounts.find(a => a.id === w.account_id)?.name || ''}</p>
                        </div>
                        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>
                          {fc(w.balance)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </motion.div>
        </motion.div>
      )}

      {/* Wallet-type-specific transaction modals */}
      {walletTxModal && (() => {
        // Find wallet: use selectedWalletId if set, otherwise find first matching type
        let w = wallets.find(x => x.id === selectedWalletId);
        if (!w) w = wallets.find(x => x.type === walletTxModal && !x.is_archived);
        if (!w) return null;
        const modalProps = {
          open: true,
          onClose: () => { setWalletTxModal(null); setPreselectedFtPersonId(null); setPreselectedOnBehalfOf(false); },
          wallet: w,
          categories,
          wallets,
          accounts,
          displayCurrency,
          baseCurrency,
          onSubmit: handleAddTransaction,
          onCreateCategory: handleCreateCategory,
          ftPersons,
          onAddFtPerson: async (name: string) => {
            const result = await window.deskflowAPI?.financeCreateFtPerson({ name });
            if (result) {
              setFtPersons(prev => {
                if (prev.some(p => p.id === result.id)) return prev;
                return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
              });
            }
          },
          initialFtPersonId: preselectedFtPersonId,
          initialOnBehalfOf: preselectedOnBehalfOf,
        };
        switch (walletTxModal) {
          case 'bank': return <BankTransactionModal key={w.id} {...modalProps} />;
          case 'debit_card': return <DebitTransactionModal key={w.id} {...modalProps} />;
          case 'credit_card': return <CreditTransactionModal key={w.id} {...modalProps} />;
          case 'crypto': return <CryptoTransactionModal key={w.id} {...modalProps} />;
          case 'physical': return <PhysicalTransactionModal key={w.id} {...modalProps} />;
          case 'cash': return <CashTransactionModal key={w.id} {...modalProps} />;
          case 'ewallet': return <EwalletTransactionModal key={w.id} {...modalProps} />;
          case 'prepaid_card': return <PrepaidCardTransactionModal key={w.id} {...modalProps} />;
        }
      })()}

      <PasswordConfirmDialog
        open={showPasswordDialog}
        onClose={handlePasswordDialogClose}
        onConfirm={handlePasswordConfirm}
      />

      <ArchivedItemsModal
        open={showArchived}
        onClose={() => setShowArchived(false)}
        accounts={archivedAccounts}
        wallets={archivedWallets}
        onUnarchiveAccount={handleUnarchiveAccount}
        onUnarchiveWallet={handleUnarchiveWallet}
        onDeleteAccount={handleDeleteAccount}
        onDeleteWallet={handleDeleteWallet}
        hasPassword={hasPassword}
        onVerifyPassword={async (pw) => {
          const r = await window.deskflowAPI?.financeVerifyPassword(pw) as { success: boolean } | undefined;
          return r?.success === true;
        }}
        passwordRequired={passwordRequirements['password_req_delete_account'] !== false}
      />

      {recalculateData && (
        <RecalculateBalanceModal
          open={showRecalculateModal}
          onClose={() => { setShowRecalculateModal(false); setRecalculateData(null); }}
          walletName={recalculateData.walletName}
          initialBalance={recalculateData.initialBalance}
          currentBalance={recalculateData.currentBalance}
          computedBalance={recalculateData.computedBalance}
          breakdown={recalculateData.breakdown}
          displayCurrency={displayCurrency}
          onApply={handleApplyRecalculatedBalance}
        />
      )}

      {notifMsg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-[200] px-4 py-2.5 rounded-xl bg-zinc-800 light:bg-zinc-100/90 border border-zinc-700 light:border-zinc-300/50 text-xs text-white shadow-lg backdrop-blur-sm"
        >
          {notifMsg}
        </motion.div>
      )}
      </div>
    </PageShell>
  );
}
