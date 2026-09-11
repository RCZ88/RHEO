import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Wallet, ArrowUpRight, Tag, Plus, Shield, ChevronDown, Bell, RefreshCw, History } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { TabBar } from '../components/TabBar';
import { GlassCard } from '../components/GlassCard';
import { FinanceLockScreen } from '../components/finance/FinanceLockScreen';
import { FinanceStickyHeader } from '../components/finance/FinanceStickyHeader';
import { OverviewTab } from '../components/finance/OverviewTab';
import { WalletsTab } from '../components/finance/WalletsTab';
import { TransactionsTab } from '../components/finance/TransactionsTab';
import { CategoriesTab } from '../components/finance/CategoriesTab';
import { AuroraBackground } from '../components/finance/_fx/AuroraBackground';
import { getCurrencyInfo, formatCurrency, convertAmount } from '../components/finance/currency-data';
import { pageContainer, tabPanel, fab, DUR } from '../components/finance/_fx/financeMotion';
import { ArchivedItemsModal } from '../components/finance/ArchivedItemsModal';
import { PasswordConfirmDialog } from '../components/finance/PasswordConfirmDialog';
import { WalletDetailView } from '../components/finance/WalletDetailView';
import { SubscriptionsTab } from '../components/finance/SubscriptionsTab';
import { SubscriptionsPageView } from './SubscriptionsPage';
import { AuditLogTab } from '../components/finance/AuditLogTab';
import { followThroughReceivable, netWorthWithReceivable } from '../lib/netWorth';
import {
  BankTransactionModal, DebitTransactionModal, CreditTransactionModal,
  CryptoTransactionModal, PhysicalTransactionModal, CashTransactionModal, EwalletTransactionModal,
} from '../components/finance/modals';
import type {
  FinanceAccount, FinanceWallet, FinanceCategory, FinanceTransaction,
  FinanceSummary, FinanceSpendingByCategory, FinanceMonthlyTrend, FinanceTabKey
} from '../components/finance/finance-types';

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
  { key: 'categories', label: 'Categories', icon: <Tag className="w-3.5 h-3.5" /> },
  { key: 'subscriptions', label: 'Subscriptions', icon: <Bell className="w-3.5 h-3.5" /> },
  { key: 'audit', label: 'Audit Log', icon: <Shield className="w-3.5 h-3.5" /> },
];

export function FinancePage() {
  const [isLocked, setIsLocked] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('overview');
  const location = useLocation();
  useEffect(() => {
    const tab = (location.state as any)?.tab;
    if (tab) setActiveTab(tab);
  }, []);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [walletTxModal, setWalletTxModal] = useState<string | null>(null);
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
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [spendingByCategory, setSpendingByCategory] = useState<FinanceSpendingByCategory[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<FinanceMonthlyTrend[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [onBehalfOfSummary, setOnBehalfOfSummary] = useState<{ totalExpense: number; breakdown: { label: string; total: number; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pageAccess, setPageAccess] = useState<{ canAccess: boolean; requiresSetup: boolean; reason?: string } | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const securityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userLockedRef = useRef(false);
  const lockedRef = useRef(true); // tracks isLocked for closure safety in visibility/polling
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [maxAttempts] = useState(3);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const passwordResolveRef = useRef<((pw: string | null) => void) | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [showSubscriptionsPage, setShowSubscriptionsPage] = useState(false);

  // Keep lockedRef in sync so visibility/polling closures always see current lock state
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
  }, []);

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
      const [accts, wals, cats, txns, sum, spend, trends, subs, obSummary] = await Promise.all([
        (window.deskflowAPI?.financeGetAccounts() as Promise<FinanceAccount[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetWallets() as Promise<FinanceWallet[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetCategories() as Promise<FinanceCategory[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetTransactions() as Promise<FinanceTransaction[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetSummary() as Promise<FinanceSummary>) ?? Promise.resolve({ totalIncome: 0, totalExpense: 0, netBalance: 0 }),
        (window.deskflowAPI?.financeGetSpendingByCategory() as Promise<FinanceSpendingByCategory[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetMonthlyTrends() as Promise<FinanceMonthlyTrend[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.subscriptionsList() as Promise<any[]>) ?? Promise.resolve([]),
        (window.deskflowAPI?.financeGetOnBehalfOfSummary() as Promise<any>) ?? Promise.resolve({ totalExpense: 0, breakdown: [] }),
      ]);
      setAccounts(accts);
      setWallets(wals);
      setCategories(cats);
      setTransactions(txns);
      setSubscriptions(subs);
      setSummary(sum);
      const totalExpenseAmt = spend.reduce((s, c) => s + c.amount, 0);
      setSpendingByCategory(spend.map(c => ({
        ...c,
        amount: c.amount,
        percentage: totalExpenseAmt > 0 ? c.amount / totalExpenseAmt * 100 : 0,
      })));
      setMonthlyTrends(trends);
      setOnBehalfOfSummary(obSummary);
    } catch (err) {
      console.error('[FinancePage] fetch error:', err);
      setFetchError('Could not load finance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLocked) fetchData();
  }, [isLocked, fetchData]);

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

  const handleAddTransaction = async (data: {
    account_id: number; wallet_id: number | null; category_id: number;
    type: string; amount: number;
    description: string; note?: string; date: string;
    to_wallet_id?: number; fromWalletName?: string; toWalletName?: string;
    [key: string]: any;
  }): Promise<boolean> => {
    try {
      if (data.type === 'transfer' && data.to_wallet_id) {
        const result = await window.deskflowAPI?.financeCreateTransfer(data) as { transferId?: string; success?: boolean };
        if (result?.success) {
          // Merge dest_metadata (e.g. denomination counts for physical wallets) into destination wallet metadata
          if (data.dest_metadata && data.to_wallet_id) {
            const dstWallet = wallets.find(w => w.id === data.to_wallet_id);
            if (dstWallet) {
              let meta: Record<string, any> = {};
              if (dstWallet.metadata) {
                try { meta = typeof dstWallet.metadata === 'object' ? dstWallet.metadata : JSON.parse(dstWallet.metadata as string); } catch { meta = {}; }
              }
              const incomingDenoms = data.dest_metadata.denominations;
              if (incomingDenoms) {
                const existing = meta.denominations ?? {};
                const merged: Record<string, number> = { ...existing };
                for (const [d, n] of Object.entries(incomingDenoms)) {
                  merged[+d] = (merged[+d] ?? 0) + (n as number);
                }
                meta.denominations = merged;
                await window.deskflowAPI?.financeUpdateWalletMetadata({ id: data.to_wallet_id, metadata: meta });
              }
            }
          }
          // Update source wallet metadata for physical/cash wallets (denominations)
          if (data.wallet_id && data.metadata?.denomination_after) {
            const srcWallet = wallets.find(w => w.id === data.wallet_id);
            if (srcWallet && (srcWallet.type === 'physical' || srcWallet.type === 'cash')) {
              let meta: Record<string, any> = {};
              if (srcWallet.metadata) {
                try { meta = typeof srcWallet.metadata === 'object' ? srcWallet.metadata : JSON.parse(srcWallet.metadata as string); } catch { meta = {}; }
              }
              meta.denominations = data.metadata.denomination_after;
              await window.deskflowAPI?.financeUpdateWalletMetadata({ id: data.wallet_id, metadata: meta });
            }
          } else if (data.wallet_id && data.metadata?.denominations) {
            const srcWallet = wallets.find(w => w.id === data.wallet_id);
            if (srcWallet && (srcWallet.type === 'physical' || srcWallet.type === 'cash')) {
              let meta: Record<string, any> = {};
              if (srcWallet.metadata) {
                try { meta = typeof srcWallet.metadata === 'object' ? srcWallet.metadata : JSON.parse(srcWallet.metadata as string); } catch { meta = {}; }
              }
              const delta = data.metadata.denominations as Record<string, number>;
              const existing = meta.denominations ?? {};
              const merged: Record<string, number> = { ...existing };
              for (const [d, n] of Object.entries(delta)) {
                merged[+d] = (merged[+d] ?? 0) - (n as number);
              }
              meta.denominations = merged;
              await window.deskflowAPI?.financeUpdateWalletMetadata({ id: data.wallet_id, metadata: meta });
            }
          }
          await fetchData(); return true;
        }
        return false;
      }
      const result = await window.deskflowAPI?.financeCreateTransaction(data) as FinanceTransaction;
      if (result) {
        // For physical/cash wallets, update wallet metadata denominations to stay in sync
        if (data.wallet_id && data.metadata?.denominations) {
          const srcWallet = wallets.find(w => w.id === data.wallet_id);
          if (srcWallet && (srcWallet.type === 'physical' || srcWallet.type === 'cash')) {
            let meta: Record<string, any> = {};
            if (srcWallet.metadata) {
              try { meta = typeof srcWallet.metadata === 'object' ? srcWallet.metadata : JSON.parse(srcWallet.metadata as string); } catch { meta = {}; }
            }
            if (data.metadata.denomination_after) {
              meta.denominations = data.metadata.denomination_after;
            } else {
              const delta = data.metadata.denominations as Record<string, number>;
              const existing = meta.denominations ?? {};
              const merged: Record<string, number> = { ...existing };
              const sign = data.amount < 0 ? -1 : 1;
              for (const [d, n] of Object.entries(delta)) {
                merged[+d] = (merged[+d] ?? 0) + sign * (n as number);
              }
              meta.denominations = merged;
            }
            await window.deskflowAPI?.financeUpdateWalletMetadata({ id: data.wallet_id, metadata: meta });
          }
        }
        await fetchData(); return true;
      }
      return false;
    } catch { return false; }
  };

  const handleDeleteTransaction = async (id: number): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeDeleteTransaction(id) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleEditTransaction = async (id: number, data: Record<string, any>): Promise<boolean> => {
    try {
      const txn = transactions.find(t => t.id === id);
      if (!txn) return false;
      const payload = {
        id,
        account_id: txn.account_id,
        wallet_id: txn.wallet_id,
        category_id: data.category_id ?? txn.category_id,
        type: txn.type,
        amount: txn.amount,
        description: data.description ?? txn.description,
        note: data.note ?? txn.note,
        date: data.date ?? txn.date,
        time: txn.time,
      };
      const result = await window.deskflowAPI?.financeUpdateTransaction(payload) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleCreateSubscription = async (data: any): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.subscriptionsCreate(data);
      if (result) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleUpdateSubscription = async (data: any): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.subscriptionsUpdate(data);
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleRecalculateBalance = async (walletId?: number): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.financeRecalculateBalances(walletId);
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
  };

  const handleDeleteSubscription = async (id: number): Promise<boolean> => {
    try {
      const result = await window.deskflowAPI?.subscriptionsDelete(id);
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
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
      console.log('[handleCreateWallet] sending:', JSON.stringify(payload));
      const result = await window.deskflowAPI?.financeCreateWallet(payload) as { id: number };
      console.log('[handleCreateWallet] result:', JSON.stringify(result), 'type of id:', typeof result?.id);
      if (result?.id) {
        if (data.metadata && Object.keys(data.metadata).length > 0) {
          await window.deskflowAPI?.financeUpdateWalletMetadata({ id: result.id, metadata: data.metadata });
        }
        await fetchData();
        return true;
      }
      console.warn('[handleCreateWallet] no result.id, returning false');
      return false;
    } catch (e) { console.error('[handleCreateWallet] error:', e); return false; }
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
      return false;
    } catch { return false; }
  };

  const handleWalletClick = (id: number) => {
    setSelectedWalletId(id);
  };

  const handleDeleteWallet = async (id: number): Promise<boolean> => {
    if (!await checkPasswordRequirement('delete_wallet')) return false;
    try {
      const result = await window.deskflowAPI?.financeDeleteWallet(id) as { success: boolean };
      if (result?.success) { await fetchData(); return true; }
      return false;
    } catch { return false; }
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
      return false;
    } catch { return false; }
  };

  const netWorth = useMemo(() =>
    accounts.reduce((s, a) => {
      if (a.type === 'custodial') return s;
      const walletSum = wallets
        .filter(w => w.account_id === a.id && !w.is_archived)
        .reduce((ws, w) => {
          const wb = (w.type === 'physical' || w.type === 'cash') && w.metadata?.denominations
            ? (Array.isArray(w.metadata.denominations)
                ? w.metadata.denominations.reduce((sx: number, d: any) => sx + (d.value || 0) * (d.count || 0), 0)
                : (w.balance ?? 0))
            : (w.balance ?? 0);
          return ws + convertAmount(wb, w.currency, displayCurrency);
        }, 0);
      return s + walletSum;
    }, 0),
    [accounts, wallets, displayCurrency]
  );

  // C6 model: net worth = raw wallet sum + outstanding Follow Through receivable
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
    const lastTotal = last.income + last.expense;
    const prevTotal = prev.income + prev.expense;
    const diff = lastTotal - prevTotal;
    const pct = prevTotal > 0 ? (diff / prevTotal) * 100 : 0;
    return { value: diff, percent: pct };
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
          <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
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
      <AuroraBackground />

      <div className="relative isolate min-h-full px-6 pb-28 pt-4 mx-auto w-full max-w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-[15px] font-semibold text-white">Finance <span className="text-[10px] text-emerald-400 font-mono ml-2 bg-emerald-500/10 px-1.5 py-0.5 rounded">BUILD MARKER v4</span></h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCurrencyPicker(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 text-zinc-300 hover:text-white text-xs font-medium transition-colors border border-zinc-700/30 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
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
                  className="w-full max-w-xs bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 pt-4 pb-2 border-b border-zinc-700/30">
                    <h3 className="text-sm font-semibold text-white">Select Currency</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Display currency for all amounts</p>
                  </div>
                  <div className="p-2 max-h-72 overflow-y-auto">
                    {['USD', 'IDR', 'SGD', 'GBP', 'EUR', 'JPY', 'AUD', 'CNY', 'KRW', 'INR'].map(code => (
                      <button
                        key={code}
                        onClick={() => { setDisplayCurrency(code); setShowCurrencyPicker(false); window.deskflowAPI?.financeSetDisplayCurrency(code); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${displayCurrency === code ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-300 hover:bg-zinc-800/60'
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
          <TabBar tabs={tabs} activeKey={activeTab} onTabChange={(k) => { if (isDirty && !window.confirm('Discard unsaved changes?')) return; setActiveTab(k as FinanceTabKey); setSelectedWalletId(null); setIsDirty(false); }} />
        </div>

        <FinanceStickyHeader
          isLocked={isLocked}
          netWorth={netWorthTotal}
          displayCurrency={displayCurrency}
          onToggleLock={handleLock}
          trend={trend}
          monthlyTrends={monthlyTrends}
          hasPassword={securitySettings?.hasPassword ?? true}
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
                onBack={() => setSelectedWalletId(null)}
                onSaveMetadata={handleSaveMetadata}
                onUpdateWallet={handleUpdateWallet}
                onDeleteWallet={handleDeleteWallet}
                onAddTransaction={(walletType) => setWalletTxModal(walletType as any)}
                onDirtyChange={setIsDirty}
                onRecalculateBalance={handleRecalculateBalance}
                subscriptions={subscriptions}
              />
            );
          }
          return (
            <div className="mt-5">
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
                    onBehalfOfSummary={onBehalfOfSummary}
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
                    onRecalculateBalance={handleRecalculateBalance}
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
                    onUpdateTransaction={handleEditTransaction}
                    onVerifyPassword={handleUnlock}
                    error={fetchError}
                    onRetry={fetchData}
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
                    error={fetchError}
                    onRetry={fetchData}
                  />
                </motion.div>
              )}
              {activeTab === 'subscriptions' && (
                showSubscriptionsPage ? (
                  <SubscriptionsPageView
                    subscriptions={subscriptions}
                    wallets={wallets}
                    transactions={transactions}
                    categories={categories}
                    displayCurrency={displayCurrency}
                    baseCurrency={baseCurrency}
                    onBack={() => setShowSubscriptionsPage(false)}
                    onCreate={handleCreateSubscription}
                    onUpdate={handleUpdateSubscription}
                    onDelete={handleDeleteSubscription}
                    onRecordPayment={async (sub) => {
                      const wallet = wallets.find(w => w.id === sub.wallet_id);
                      if (!wallet) return;
                      const cat = categories.find(c => c.type === 'expense' && c.name === 'Subscriptions') ||
                                  categories.find(c => c.type === 'expense');
                      const txData = {
                        account_id: wallet.account_id,
                        wallet_id: sub.wallet_id,
                        category_id: sub.category_id || cat?.id || null,
                        type: 'expense',
                        amount: -sub.price,
                        description: `${sub.name} subscription payment`,
                        date: new Date().toISOString().split('T')[0],
                      };
                      const result = await window.deskflowAPI?.financeCreateTransaction(txData);
                      if (result) {
                        const d = sub.next_renewal_date ? new Date(sub.next_renewal_date) : new Date();
                        switch (sub.billing_cycle) {
                          case 'weekly': d.setDate(d.getDate() + 7); break;
                          case 'monthly': d.setMonth(d.getMonth() + 1); break;
                          case 'quarterly': d.setMonth(d.getMonth() + 3); break;
                          case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
                          case 'custom': d.setMonth(d.getMonth() + (sub.billing_interval || 1)); break;
                          default: d.setMonth(d.getMonth() + 1);
                        }
                        await window.deskflowAPI?.subscriptionsUpdate({ id: sub.id, next_renewal_date: d.toISOString().split('T')[0] });
                        await fetchData();
                      }
                    }}
                    loading={loading}
                    error={fetchError}
                    onRetry={fetchData}
                  />
                ) : (
                <motion.div
                  key="subscriptions"
                  variants={tabPanel}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SubscriptionsTab
                    subscriptions={subscriptions}
                    wallets={wallets}
                    displayCurrency={displayCurrency}
                    onCreate={handleCreateSubscription}
                    onUpdate={handleUpdateSubscription}
                    onDelete={handleDeleteSubscription}
                    onRecordPayment={async (sub) => {
                      const wallet = wallets.find(w => w.id === sub.wallet_id);
                      if (!wallet) return;
                      const cat = categories.find(c => c.type === 'expense' && c.name === 'Subscriptions') ||
                                  categories.find(c => c.type === 'expense');
                      const txData = {
                        account_id: wallet.account_id,
                        wallet_id: sub.wallet_id,
                        category_id: sub.category_id || cat?.id || null,
                        type: 'expense',
                        amount: -sub.price,
                        description: `${sub.name} subscription payment`,
                        date: new Date().toISOString().split('T')[0],
                      };
                      const result = await window.deskflowAPI?.financeCreateTransaction(txData);
                      if (result) {
                        const d = sub.next_renewal_date ? new Date(sub.next_renewal_date) : new Date();
                        switch (sub.billing_cycle) {
                          case 'weekly': d.setDate(d.getDate() + 7); break;
                          case 'monthly': d.setMonth(d.getMonth() + 1); break;
                          case 'quarterly': d.setMonth(d.getMonth() + 3); break;
                          case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
                          case 'custom': d.setMonth(d.getMonth() + (sub.billing_interval || 1)); break;
                          default: d.setMonth(d.getMonth() + 1);
                        }
                        await window.deskflowAPI?.subscriptionsUpdate({ id: sub.id, next_renewal_date: d.toISOString().split('T')[0] });
                        await fetchData();
                      }
                    }}
                    onNavigateToPage={() => setShowSubscriptionsPage(true)}
                  />
                </motion.div>
                )
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
                  <AuditLogTab displayCurrency={displayCurrency} />
                </motion.div>
              )}
            </div>
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
            className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-4 w-full max-w-sm mx-4 shadow-2xl"
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
                        className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors text-left focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                      >
                        <span className="text-lg shrink-0">{TYPE_EMOJI[w.type] || '📦'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">{w.name}</p>
                          <p className="text-[10px] text-zinc-500">{accounts.find(a => a.id === w.account_id)?.name || ''}</p>
                        </div>
                        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>
                          {fc((w.type === 'physical' || w.type === 'cash') && w.metadata?.denominations
                            ? (Array.isArray(w.metadata.denominations)
                                ? w.metadata.denominations.reduce((sx: number, d: any) => sx + (d.value || 0) * (d.count || 0), 0)
                                : (w.balance ?? 0))
                            : (w.balance ?? 0))}
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
        const w = wallets.find(x => x.id === selectedWalletId);
        if (!w) return null;
        const modalProps = {
          open: true,
          onClose: () => { setWalletTxModal(null); },
          wallet: w,
          categories,
          wallets,
          accounts,
          displayCurrency,
          baseCurrency,
          onSubmit: handleAddTransaction,
          onCreateCategory: handleCreateCategory,
        };
        switch (walletTxModal) {
          case 'bank': return <BankTransactionModal key={w.id} {...modalProps} />;
          case 'debit_card': return <DebitTransactionModal key={w.id} {...modalProps} />;
          case 'credit_card': return <CreditTransactionModal key={w.id} {...modalProps} />;
          case 'crypto': return <CryptoTransactionModal key={w.id} {...modalProps} />;
          case 'physical': return <PhysicalTransactionModal key={w.id} {...modalProps} />;
          case 'cash': return <CashTransactionModal key={w.id} {...modalProps} />;
          case 'ewallet': return <EwalletTransactionModal key={w.id} {...modalProps} />;
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
    </PageShell>
  );
}
