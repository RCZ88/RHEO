export interface FinanceAccount {
  id: number;
  name: string;
  type: 'personal' | 'joint' | 'custodial' | 'business';
  description: string | null;
  icon: string;
  color: string;
  currency: string;
  balance: number;
  is_archived: number;
  parent_account_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceWallet {
  id: number;
  account_id: number;
  name: string;
  type: 'bank' | 'debit_card' | 'credit_card' | 'crypto' | 'cash' | 'ewallet' | 'physical' | 'prepaid_card' | 'other';
  provider: string | null;
  last_four: string | null;
  balance: number;
  currency: string;
  is_archived: number;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

export interface CashDenomination {
  value: number;
  label: string;
  count: number;
}

export type WalletMetadata =
  | { type: 'bank'; bank_name?: string; branch?: string; account_number?: string; swift?: string; iban?: string; notes?: string }
  | { type: 'debit_card'; card_network?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other'; issuer?: string; daily_limit?: number; notes?: string }
  | { type: 'credit_card'; card_network?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other'; issuer?: string; credit_limit?: number; billing_day?: number; due_day?: number; apr?: number; notes?: string }
  | { type: 'crypto'; coin_id?: string; symbol?: string; blockchain?: string; wallet_address?: string; acquisition_price?: number; notes?: string }
  | { type: 'cash'; denominations?: CashDenomination[]; notes?: string }
  | { type: 'physical'; denominations?: CashDenomination[]; description?: string; notes?: string }
  | { type: 'ewallet'; platform?: string; phone_or_email?: string; daily_limit?: number; notes?: string }
  | { type: 'prepaid_card'; provider?: string; card_number?: string; auto_topup?: boolean; top_up_limit?: number; notes?: string }
  | { type: 'other'; notes?: string };

export interface CryptoPrice {
  coin_id: string;
  name: string;
  symbol: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  last_updated: string;
}

export interface CryptoHistoryPoint {
  timestamp: number;
  price: number;
}

export interface FinanceCategory {
  id: number;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  icon: string;
  color: string;
  sort_order: number;
  is_archived: number;
  created_at: string;
}

export interface FinanceTransaction {
  id: number;
  account_id: number;
  wallet_id: number | null;
  category_id: number;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  fee: number;
  merchant: string | null;
  description: string | null;
  note: string | null;
  date: string;
  time: string | null;
  is_recurring: number;
  recurring_interval: string | null;
  tags: string | null;
  transfer_id: string | null;
  from_wallet_id: number | null;
  to_wallet_id: number | null;
  on_behalf_of: number;
  on_behalf_of_label: string | null;
  ft_person_id: number | null;
  is_adjustment: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceFtPerson {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  transaction_count: number;
  total_owed: number;
  total_paid: number;
  balance: number;
  wallet_id: number | null;
}

export interface FinanceFtPersonBalance {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  total_owed: number;
  total_repaid: number;
  transaction_count: number;
  current_balance: number;
}


export type AssetType = 'stock' | 'etf' | 'commodity' | 'crypto' | 'index' | 'currency';

export interface WalletAsset {
  symbol: string;
  asset_type: AssetType;
  name: string;
  amount: number;
  avg_buy_price: number;
  current_price?: number;
  blockchain?: string;
  wallet_address?: string;
}

export interface AssetPrice {
  symbol: string;
  asset_type: AssetType;
  provider: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  exchange?: string;
  last_updated: string;
}

export interface AssetSearchResult {
  symbol: string;
  asset_type: AssetType;
  name: string;
  exchange: string;
  provider: string;
}

export interface FinanceSubscription {
  id: number;
  wallet_id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  billing_interval: number;
  start_date: string | null;
  next_renewal_date: string | null;
  cancel_url: string;
  cancel_reminder_days: number;
  reminder_note: string;
  status: 'active' | 'cancelled' | 'paused' | 'expired';
  category_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string;
  details: any;
  created_at: string;
  decrypted_data?: Record<string, any> | null;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  periodComparison?: { incomeChange: number; expenseChange: number };
}

export interface FinanceSpendingByCategory {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  percentage: number;
}

export interface FinanceMonthlyTrend {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface FinanceBalanceHistory {
  date: string;
  balance: number;
}

// FinanceTabKey is defined at the bottom of this file after all interfaces

// ── Dashboard Enhancement Types ──

export interface CryptoAssetEnhanced {
  coin_id: string;
  symbol: string;
  name: string;
  amount: number;
  avg_buy_price: number;
  current_price: number;
  value: number;
  cost_basis: number;
  pnl: number;
  pnl_percentage: number;
}

export interface CryptoPortfolioData {
  walletId: number;
  walletName: string;
  currency: string;
  fiatBalance: number;
  cryptoPortfolioValue: number;
  totalValue: number;
  costBasis: number;
  unrealizedPnL: number;
  pnlPercentage: number;
  fiatAllocation: number;
  cryptoAllocation: number;
  assets: CryptoAssetEnhanced[];
}

export interface LiquidityTier {
  name: string;
  amount: number;
  color: string;
  icon: string;
  wallets: Array<{ id: number; name: string; balance: number; currency: string }>;
  percentage: number;
}

export interface LiquidityData {
  tiers: LiquidityTier[];
  totalNetWorth: number;
  liquidityScore: number;
  liquidAmount: number;
  lockedAmount: number;
  transferSpeeds: Array<{ from: string; to: string; avgMinutes: number }>;
}

export interface SubscriptionIntelligence {
  totalMonthlyCost: number;
  burdenPercentage: number;
  monthlyIncome: number;
  subscriptionCount: number;
  growthTrend: number;
  upcomingRenewals: number;
  urgentRenewals: number;
  radarData: { axes: string[]; values: number[]; colors: string[] };
  subscriptions: Array<{
    id: number; name: string; price: number; currency: string;
    billingCycle: string; monthlyEquivalent: number;
    nextRenewalDate: string; daysUntilRenewal: number;
    isUrgent: boolean; isWarning: boolean;
  }>;
}

export interface RunwayData {
  runwayMonths: number;
  dailyBurnRate: number;
  monthlyBurnRate: number;
  committedMonthly: number;
  totalMonthlyBurn: number;
  liquidNetWorth: number;
  breakEvenMonth: number | null;
  trendDirection: number;
  projectedBalances: Array<{ month: number; projectedBalance: number; isNegative: boolean }>;
  dailyExpenseHistory: Array<{ date: string; amount: number }>;
}

export interface WalletHealth {
  walletId: number;
  name: string;
  type: string;
  balance: number;
  currency: string;
  healthScore: number;
  balanceDrift: number;
  transactionFrequency: number;
  feeBurden: number;
  sparklineData: Array<{ date: string; balance: number }>;
  alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical' | 'info' }>;
}

export interface TransferMatrixCell {
  fromWalletId: number;
  fromWalletName: string;
  toWalletId: number;
  toWalletName: string;
  estimatedFee: number;
  historicalAvgFee: number;
  historicalAvgAmount: number;
  transferCount: number;
  efficiencyScore: number;
  feeType: string;
  feeValue: number;
}

export interface TransferMatrixData {
  matrix: TransferMatrixCell[];
  optimalRoutes: Array<{
    from: string; to: string; path: string[];
    totalFee: number; efficiencyScore: number;
  }>;
  walletCount: number;
}

// ── Fixed Expenses ──

export interface FinanceFixedExpense {
  id: number;
  wallet_id: number;
  name: string;
  description: string;
  amount: number;
  currency: string;
  category_id: number | null;
  billing_day: number;
  is_active: number;
  auto_create_transaction: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  wallet_name?: string;
  wallet_currency?: string;
  current_month_status?: 'pending' | 'paid' | 'skipped';
  current_month_amount_paid?: number;
  current_month_transaction_id?: number | null;
  current_month_paid_date?: string | null;
}

export interface FinanceFixedExpensePayment {
  id: number;
  fixed_expense_id: number;
  month: string;
  status: 'pending' | 'paid' | 'skipped';
  amount_paid: number | null;
  transaction_id: number | null;
  paid_date: string | null;
  paid_by: 'manual' | 'auto' | 'quick';
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedExpenseSummary {
  totalMonthlyFixed: number;
  totalPaid: number;
  totalRemaining: number;
  percentagePaid: number;
  byCategory: Array<{
    categoryId: number | null;
    categoryName: string;
    categoryColor: string;
    totalAmount: number;
    paidAmount: number;
    count: number;
  }>;
  overdueCount: number;
  upcomingCount: number;
}

// ── Budgets ──

export interface FinanceBudget {
  id: number;
  name: string;
  type: 'total' | 'category';
  category_id: number | null;
  amount: number;
  currency: string;
  period: 'monthly' | 'weekly' | 'yearly';
  alert_threshold: number;
  is_active: number;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

export interface BudgetStatus {
  budgets: Array<{
    id: number;
    name: string;
    type: 'total' | 'category';
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: 'ok' | 'warning' | 'over';
    category?: { id: number; name: string; color: string; icon: string };
  }>;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overallPercentage: number;
  overBudgetCount: number;
  warningCount: number;
}

export interface RecurringPatternSuggestion {
  suggestedName: string;
  avgAmount: number;
  frequency: number;
  lastSeen: string;
  category: string;
  categoryId: number | null;
  confidence: number;
}

// ── Extended tab key ──
export type FinanceTabKey = 'overview' | 'wallets' | 'transactions' | 'categories' | 'people' | 'subscriptions' | 'budget' | 'audit' | 'charts' | 'recap';
