# RESULT.md — Finance Page Bugfix & Feature Completion

---

## Executive Summary

Eight fixes addressing balance calculation, net worth chart, header percentage, fee display, follow-through feature completion, subscription currency, audit log crash, and subscription auto-transaction generation. Fixes are ordered by dependency: schema migrations first, then backend IPC handlers, then frontend components.

---

## Fix A: Balance Calculation Logic

### Root Cause

Three compounding issues:

1. **`finance:get-summary` reads `SUM(balance)` from `finance_accounts`** — this is a stored running total that can drift from the truth if any code path fails to update it. It should compute from wallet balances (the same source `FinancePage.tsx` uses on the frontend) to guarantee consistency.

2. **`finance:recalculate-balances` double-counts fees for non-transfer transactions.** The formula `initial_balance + SUM(amount) - SUM(fee)` subtracts ALL fees, but fees are only meaningful for transfers. For expenses, `fee` is always `0` so this is harmless — but for transfers, the fee is stored as a positive number that is NOT included in the `amount` column. The `create-transaction` handler adds `data.amount` to the balance but does NOT subtract `data.fee`. So after creation, the fee is NOT deducted. After recalculation, the fee IS deducted. This creates an inconsistency between freshly-created and recalculated balances.

3. **`finance:recalculate-balances` does not handle transfer directionality.** A transfer from wallet A to wallet B creates a single transaction row. The `recalculate-balances` handler for wallet A needs to subtract the transfer amount (and fee), while for wallet B it needs to add the transfer amount. The current formula `SUM(amount)` does not distinguish between source and destination wallets.

### Files to Modify

#### 1. `src/main.ts` — `finance:get-summary` handler (line 21038)

**Before:**
```typescript
ipcMain.handle('finance:get-summary', async () => {
  if (!db) return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  try {
    const income = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type='income'").get() as any;
    const expense = db.prepare("SELECT COALESCE(-SUM(amount),0) as total FROM finance_transactions WHERE type='expense'").get() as any;
    const netBalance = db.prepare("SELECT COALESCE(SUM(balance),0) as total FROM finance_accounts WHERE is_archived=0 AND type!='custodial'").get() as any;
    return {
      totalIncome: income.total,
      totalExpense: expense.total,
      netBalance: netBalance.total,
    };
  } catch {
    return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  }
});
```

**After:**
```typescript
ipcMain.handle('finance:get-summary', async () => {
  if (!db) return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  try {
    // Income amounts are stored as positive
    const income = db.prepare(
      "SELECT COALESCE(SUM(amount),0) as total FROM finance_transactions WHERE type='income'"
    ).get() as any;

    // Expense amounts are stored as negative — negate for display
    const expense = db.prepare(
      "SELECT COALESCE(-SUM(amount),0) as total FROM finance_transactions WHERE type='expense'"
    ).get() as any;

    // Compute netBalance from wallet balances (same source as FinancePage frontend)
    // This guarantees consistency between the summary API and the displayed net worth
    const netBalance = db.prepare(`
      SELECT COALESCE(SUM(w.balance), 0) as total
      FROM finance_wallets w
      INNER JOIN finance_accounts a ON w.account_id = a.id
      WHERE w.is_archived = 0
        AND a.is_archived = 0
        AND a.type != 'custodial'
    `).get() as any;

    return {
      totalIncome: income.total,
      totalExpense: expense.total,
      netBalance: netBalance.total,
    };
  } catch {
    return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  }
});
```

#### 2. `src/main.ts` — `finance:recalculate-balances` handler (line 20672)

**Before:**
```typescript
const result = db.prepare('SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(fee), 0) as total_fee FROM finance_transactions WHERE wallet_id = ?').get(walletId) as any;
const computedBalance = (wallet.initial_balance || 0) + (result?.total || 0) - (result?.total_fee || 0);
```

**After:**
```typescript
// Compute signed sum correctly:
// - income: amount is positive → adds to balance
// - expense: amount is negative → subtracts from balance (already signed)
// - transfer where this wallet is the DESTINATION (wallet_id = ?): amount is positive → adds
// - transfer where this wallet is the SOURCE (from_wallet_id = ?): amount should subtract → negate
// - Fee: only charged on the SOURCE wallet of a transfer
const result = db.prepare(`
  SELECT
    COALESCE(SUM(
      CASE
        WHEN type = 'income' THEN amount
        WHEN type = 'expense' THEN amount
        WHEN type = 'transfer' AND wallet_id = ? THEN amount
        WHEN type = 'transfer' AND from_wallet_id = ? THEN -amount
        ELSE 0
      END
    ), 0) as total,
    COALESCE(SUM(
      CASE
        WHEN type = 'transfer' AND from_wallet_id = ? THEN fee
        ELSE 0
      END
    ), 0) as total_fee
  FROM finance_transactions
  WHERE wallet_id = ? OR from_wallet_id = ?
`).get(walletId, walletId, walletId, walletId, walletId) as any;

const computedBalance = (wallet.initial_balance || 0) + (result?.total || 0) - (result?.total_fee || 0);
```

#### 3. `src/main.ts` — `finance:create-transaction` handler (line 20870)

**Before:**
```typescript
const fee = Math.abs(data.fee || 0);
const stmt = db.prepare(`
  INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, description, note, "date", "time")
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const result = stmt.run(
  data.account_id, data.wallet_id || null, data.category_id,
  data.type, data.amount, fee, data.description || null, data.note || null,
  data.date, data.time || null
);
// Update account balance
db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, data.account_id);
// Update wallet balance if wallet specified
if (data.wallet_id) {
  db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, data.wallet_id);
}
```

**After:**
```typescript
const fee = Math.abs(data.fee || 0);

// ENSURE expenses are always stored as negative amounts.
// This is the defensive layer — even if the frontend sends a positive amount
// for an expense, we sign it correctly here.
let signedAmount = data.amount;
if (data.type === 'expense' && signedAmount > 0) {
  signedAmount = -signedAmount;
}
if (data.type === 'income' && signedAmount < 0) {
  signedAmount = -signedAmount;
}

const stmt = db.prepare(`
  INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, description, note, "date", "time",
    ${data.ft_person_id ? 'ft_person_id, ' : ''}
    on_behalf_of, on_behalf_of_label, tags, transfer_id, from_wallet_id, to_wallet_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ${data.ft_person_id ? '?, ' : ''}
    ?, ?, ?, ?, ?, ?)
`);
const params = [
  data.account_id, data.wallet_id || null, data.category_id,
  data.type, signedAmount, fee, data.description || null, data.note || null,
  data.date, data.time || null,
];
if (data.ft_person_id) params.push(data.ft_person_id);
params.push(
  data.on_behalf_of || 0,
  data.on_behalf_of_label || null,
  data.tags || null,
  data.transfer_id || null,
  data.from_wallet_id || null,
  data.to_wallet_id || null,
);
const result = stmt.run(...params);
const id = Number(result.lastInsertRowid);

// Update account balance — use the SIGNED amount (negative for expenses)
db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(signedAmount, data.account_id);

// Update wallet balance if wallet specified
if (data.wallet_id) {
  db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(signedAmount, data.wallet_id);
}

// If this is a transfer with a fee, deduct the fee from the SOURCE wallet
if (data.type === 'transfer' && fee > 0 && data.from_wallet_id) {
  db.prepare('UPDATE finance_wallets SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(fee, data.from_wallet_id);
  // Also update the account for the source wallet
  const sourceWallet = db.prepare('SELECT account_id FROM finance_wallets WHERE id = ?').get(data.from_wallet_id) as any;
  if (sourceWallet) {
    db.prepare('UPDATE finance_accounts SET balance = balance - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(fee, sourceWallet.account_id);
  }
}

writeAuditLog('transaction_created', 'transaction', id, `Transaction "${data.description || ''}" created`, {
  type: data.type, amount: signedAmount, fee, category_id: data.category_id,
  on_behalf_of: data.on_behalf_of || 0, ft_person_id: data.ft_person_id || null
});
return { id, ...data, amount: signedAmount };
```

#### 4. `src/main.ts` — `finance:get-dashboard-overview` handler (line 21104)

Apply the same fix to `netBalance` calculation:

**Before:**
```typescript
const netBalance = (db.prepare("SELECT COALESCE(SUM(balance),0) as total FROM finance_accounts WHERE is_archived=0 AND type!='custodial'").get() as any).total;
```

**After:**
```typescript
const netBalance = (db.prepare(`
  SELECT COALESCE(SUM(w.balance), 0) as total
  FROM finance_wallets w
  INNER JOIN finance_accounts a ON w.account_id = a.id
  WHERE w.is_archived = 0 AND a.is_archived = 0 AND a.type != 'custodial'
`).get() as any).total;
```

### Verification Steps

1. Create an expense of $50 on any wallet. Verify wallet balance decreases by $50.
2. Create an income of $100. Verify wallet balance increases by $100.
3. Create a transfer of $75 with $5 fee from Wallet A to Wallet B. Verify Wallet A decreases by $80 ($75 + $5 fee), Wallet B increases by $75.
4. Call `finance:recalculate-balances` on Wallet A. Verify the balance does not change (it was already correct).
5. Call `finance:get-summary`. Verify `netBalance` matches the sum of wallet balances shown on the frontend.

---

## Fix B: Net Worth Line Chart

### Root Cause

Four issues in `OverviewTab.tsx`:

1. **`openingNW` is derived from `monthlyTrends` which uses `SUM(amount)` — but `monthlyTrends` groups by month and returns at most 12 rows.** If transactions span more than 12 months, older flows are lost, making `openingNW` wrong.

2. **Transfer transactions return `0` in the day-series** — `signed = t.type === 'income' ? Math.abs(t.amount) : t.type === 'expense' ? -Math.abs(t.amount) : 0`. Transfers are skipped entirely, so the chart doesn't reflect wallet balance changes from transfers.

3. **`effectivePeriod` auto-switches to `'month'` when there are ≤30 unique dates**, collapsing all same-month transactions into a single point. The user sees "only one transaction" because all their transactions are in the same month.

4. **`allTransactions` may be limited or filtered** before reaching `OverviewTab`, causing missing data points.

### Files to Modify

#### 1. `src/components/finance/OverviewTab.tsx` (lines 131-163)

**Before:**
```typescript
const openingNW = useMemo(() => {
  const totalNetFlow = monthlyTrends.reduce((s, m) => s + convertAmount(m.net, baseCurrency, displayCurrency), 0);
  return totalNetWorth - totalNetFlow;
}, [totalNetWorth, monthlyTrends, baseCurrency, displayCurrency]);

const netWorthSeries = useMemo(() => {
  if (effectivePeriod === 'day') {
    const dayMap = new Map<string, number>();
    for (const t of allTransactions) {
      const signed = t.type === 'income' ? Math.abs(t.amount)
        : t.type === 'expense' ? -Math.abs(t.amount) : 0;
      dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + signed);
    }
    const sorted = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let run = openingNW;
    return sorted.map(([date, net]) => {
      run += convertAmount(net, baseCurrency, displayCurrency);
      return { month: date, value: run };
    });
  }
  let run = openingNW;
  return monthlyTrends.map(m => {
    run += convertAmount(m.net, baseCurrency, displayCurrency);
    return { month: m.month, value: run };
  });
}, [effectivePeriod, allTransactions, monthlyTrends, baseCurrency, displayCurrency, openingNW]);
```

**After:**
```typescript
// Compute openingNW from ALL transactions (not just monthlyTrends which is capped at 12 months)
const openingNW = useMemo(() => {
  // Sum ALL transaction signed amounts to get total net flow
  const totalNetFlow = allTransactions.reduce((s, t) => {
    if (t.type === 'income') return s + convertAmount(Math.abs(t.amount), baseCurrency, displayCurrency);
    if (t.type === 'expense') return s - convertAmount(Math.abs(t.amount), baseCurrency, displayCurrency);
    // Transfers are neutral for net worth (money moved between wallets, not gained/lost)
    // BUT transfer fees DO reduce net worth
    if (t.type === 'transfer') return s - convertAmount(t.fee || 0, baseCurrency, displayCurrency);
    return s;
  }, 0);
  return totalNetWorth - totalNetFlow;
}, [totalNetWorth, allTransactions, baseCurrency, displayCurrency]);

const netWorthSeries = useMemo(() => {
  // Always build the series from individual transactions, grouped by date
  const dayMap = new Map<string, number>();
  for (const t of allTransactions) {
    let signed: number;
    if (t.type === 'income') {
      signed = Math.abs(t.amount);
    } else if (t.type === 'expense') {
      signed = -Math.abs(t.amount);
    } else if (t.type === 'transfer') {
      // Transfers are neutral except for the fee
      signed = -(t.fee || 0);
    } else {
      signed = 0;
    }
    const converted = convertAmount(signed, baseCurrency, displayCurrency);
    dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + converted);
  }

  const sorted = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (sorted.length === 0) {
    // No transactions — show current net worth as a flat line
    return [{ month: new Date().toISOString().split('T')[0], value: totalNetWorth }];
  }

  let run = openingNW;
  const series: { month: string; value: number }[] = [];

  // Prepend a starting point (opening NW before any transactions) if we have history
  const firstDate = sorted[0][0];
  const dayBefore = new Date(firstDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  series.push({ month: dayBefore.toISOString().split('T')[0], value: openingNW });

  for (const [date, net] of sorted) {
    run += net;
    series.push({ month: date, value: run });
  }

  // If the last data point is not today, append the current net worth as the final point
  const today = new Date().toISOString().split('T')[0];
  if (series[series.length - 1].month !== today) {
    series.push({ month: today, value: totalNetWorth });
  }

  // If effectivePeriod is 'month', downsample to monthly granularity
  if (effectivePeriod === 'month') {
    const monthMap = new Map<string, number>();
    for (const point of series) {
      const monthKey = point.month.slice(0, 7); // YYYY-MM
      monthMap.set(monthKey, point.value); // Last value for each month wins
    }
    return [...monthMap.entries()].map(([month, value]) => ({ month, value }));
  }

  return series;
}, [effectivePeriod, allTransactions, openingNW, totalNetWorth, baseCurrency, displayCurrency]);
```

#### 2. `src/components/finance/OverviewTab.tsx` — `effectivePeriod` logic

Find the `effectivePeriod` memo and update it to default to `'day'` mode whenever there are transactions, regardless of count:

**Before (approximate — find the useMemo that sets effectivePeriod):**
```typescript
const effectivePeriod = useMemo(() => {
  const uniqueDates = new Set(allTransactions.map(t => t.date));
  return uniqueDates.size > 30 ? 'month' : 'day';
}, [allTransactions]);
```

**After:**
```typescript
const effectivePeriod = useMemo(() => {
  if (!allTransactions || allTransactions.length === 0) return 'day';
  const uniqueDates = new Set(allTransactions.map(t => t.date));
  const uniqueMonths = new Set(allTransactions.map(t => t.date.slice(0, 7)));
  // Use 'month' mode only if transactions span more than 12 unique months
  // Otherwise, always use 'day' to show individual transaction impact
  return uniqueMonths.size > 12 ? 'month' : 'day';
}, [allTransactions]);
```

#### 3. `src/components/finance/FinancePage.tsx` — Ensure `allTransactions` is passed to `OverviewTab`

Verify that `OverviewTab` receives the FULL transaction list, not a limited slice:

**Check (in FinancePage.tsx, wherever OverviewTab is rendered):**
```tsx
<OverviewTab
  allTransactions={transactions}  // ← Must be the FULL list, not transactions.slice(0, N)
  // ... other props
/>
```

If `transactions` is being limited anywhere (e.g., `transactions.slice(0, 100)`), remove the limit or increase it to `10000`.

### Verification Steps

1. Add a single expense of $150. Verify the chart shows TWO points: the opening NW and the post-expense NW.
2. Add 5 transactions across 3 different days. Verify the chart shows 4+ data points (opening + 3 days, possibly + today).
3. Add transactions across 13+ different months. Verify the chart switches to monthly mode and shows 13+ monthly data points.
4. Verify the chart's final value matches `totalNetWorth` displayed in the header.
5. Verify transfer fees cause a dip in the chart (transfer principal does not).

---

## Fix C: Net Worth Header Percentage

### Root Cause

The `trend` prop passed to `FinanceStickyHeader` is computed incorrectly or not at all. The percentage should represent month-over-month net worth change, but the current calculation either uses the wrong base or doesn't compute a percentage at all.

### Files to Modify

#### 1. `src/components/finance/FinancePage.tsx` — Compute trend for sticky header

Find where `trend` is computed and passed to `FinanceStickyHeader`. Add/replace with:

**New code (place near the `netWorthTotal` memo, around line 700):**
```typescript
const trend = useMemo(() => {
  if (!transactions || transactions.length === 0) {
    return { value: 0, percent: 0 };
  }

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}/${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Sum signed amounts for this month
  const thisMonthFlow = transactions
    .filter(t => t.date.startsWith(thisMonth.replace('-', '-'))) // YYYY-MM match
    .reduce((s, t) => {
      if (t.type === 'income') return s + convertAmount(Math.abs(t.amount), baseCurrency, displayCurrency);
      if (t.type === 'expense') return s - convertAmount(Math.abs(t.amount), baseCurrency, displayCurrency);
      if (t.type === 'transfer') return s - convertAmount(t.fee || 0, baseCurrency, displayCurrency);
      return s;
    }, 0);

  // Sum signed amounts for previous month
  const prevMonthFlow = transactions
    .filter(t => {
      const pm = prevMonth.replace('/', '-');
      return t.date.startsWith(pm);
    })
    .reduce((s, t) => {
      if (t.type === 'income') return s + convertAmount(Math.abs(t.amount), baseCurrency, displayCurrency);
      if (t.type === 'expense') return s - convertAmount(Math.abs(t.amount), baseCurrency, displayCurrency);
      if (t.type === 'transfer') return s - convertAmount(t.fee || 0, baseCurrency, displayCurrency);
      return s;
    }, 0);

  // The trend value is the difference between this month's and last month's net flow
  const value = thisMonthFlow - prevMonthFlow;

  // Percentage: compare this month's flow to last month's flow
  // If last month was 0, use 100% (or -100% if this month is negative)
  let percent = 0;
  if (prevMonthFlow !== 0) {
    percent = ((thisMonthFlow - prevMonthFlow) / Math.abs(prevMonthFlow)) * 100;
  } else if (thisMonthFlow !== 0) {
    percent = thisMonthFlow > 0 ? 100 : -100;
  }

  // Cap percentage to reasonable bounds for display
  percent = Math.max(-999, Math.min(999, percent));

  return { value, percent };
}, [transactions, baseCurrency, displayCurrency]);
```

#### 2. `src/components/finance/FinanceStickyHeader.tsx` (lines 142-148)

The display code is already correct — it shows `trend.value` and `trend.percent`. No change needed to the display logic itself, but add a guard for `Infinity`:

**Before:**
```tsx
<span className={`text-[11px] ${trend.value >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
  ({trend.percent >= 0 ? '+' : ''}{trend.percent.toFixed(1)}%)
</span>
```

**After:**
```tsx
<span className={`text-[11px] ${trend.value >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
  ({trend.percent >= 0 ? '+' : ''}{isFinite(trend.percent) ? trend.percent.toFixed(1) : '—'}%)
</span>
```

### Verification Steps

1. With no transactions in the current or previous month, verify trend shows `+0.0%`.
2. Add $500 income this month. With no previous month data, verify trend shows `+100.0%`.
3. Add $300 expense in the previous month (by setting transaction date to last month). Verify the percentage reflects the change correctly.
4. Verify the trend value (currency amount) matches the difference between this month's and last month's net flow.

---

## Fix D: Transaction Fee Display for All Types

### Root Cause

The fee field is only sent for transfers: `fee: type === 'transfer' ? numericFee : 0`. For income and expenses, fee is always `0`, so the fee display in `TransactionDetailModal`, `TransactionsTab`, and `RecentTxnsCard` always shows `$0.00` or is hidden.

### Files to Modify

#### 1. `src/components/finance/useTransactionForm.ts` (line 58)

**Before:**
```typescript
fee: type === 'transfer' ? numericFee : 0,
```

**After:**
```typescript
fee: numericFee,  // Fee is now available for ALL transaction types
```

#### 2. Transaction Form Modal — Show fee field for all types

In whichever modal renders the fee input (likely `TransferModal.tsx` or a shared form section), remove the conditional that hides the fee field for non-transfer types.

**Find the fee input field. It likely looks like:**
```tsx
{type === 'transfer' && (
  <div>
    <label>Transfer Fee</label>
    <input value={fee} onChange={e => setFee(e.target.value)} />
  </div>
)}
```

**Replace with:**
```tsx
<div>
  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
    {type === 'transfer' ? 'Transfer Fee' : 'Transaction Fee'}
  </label>
  <div className="relative">
    <input
      type="number"
      min="0"
      step="any"
      value={fee}
      onChange={e => setFee(e.target.value)}
      placeholder="0.00"
      className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 pl-7 pr-3 py-2.5 outline-none placeholder:text-zinc-600 focus:border-zinc-500 tabular-nums transition-colors"
    />
    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
      {currencySymbol}
    </span>
  </div>
  {type !== 'transfer' && (
    <p className="text-[11px] text-zinc-600 mt-1">Optional — e.g. ATM fee, service charge</p>
  )}
</div>
```

If the fee field is inside the "Advanced" section, move it OUTSIDE so it's always visible, OR ensure the advanced section is accessible for all transaction types.

#### 3. `src/components/finance/TransactionDetailModal.tsx` — Always show fee (even if 0)

Find the fee display section (around lines 349-357). Ensure it always renders:

**Before (likely):**
```tsx
{transaction.fee > 0 && (
  <div>
    <span className="text-zinc-500">Fee</span>
    <span className="text-white tabular-nums">{fmtCurrency(transaction.fee, displayCurrency)}</span>
  </div>
)}
```

**After:**
```tsx
<div className="flex items-center justify-between py-1.5">
  <span className="text-xs text-zinc-500">Fee</span>
  <span className="text-sm text-white tabular-nums">
    {transaction.fee > 0
      ? <span className="text-red-400">-{fmtCurrency(transaction.fee, displayCurrency)}</span>
      : <span className="text-zinc-600">{fmtCurrency(0, displayCurrency)}</span>
    }
  </span>
</div>
```

#### 4. `src/components/finance/TransactionsTab.tsx` — Show fee in list

Find the fee display in the transaction list (around lines 518-520). Show it inline with the amount:

**After (ensure this renders for all types):**
```tsx
{(transaction.fee || 0) > 0 && (
  <span className="text-[10px] text-red-400/60 tabular-nums ml-1">
    +{fmtCurrency(transaction.fee, displayCurrency)} fee
  </span>
)}
```

#### 5. `src/components/finance/RecentTxnsCard.tsx` — Show fee in recent activity

Find the fee display (around lines 112-114). Same pattern as above.

### Verification Steps

1. Create an expense with a $3 fee. Verify the fee appears in the transaction list, recent activity card, and detail modal.
2. Create an income with a $1 fee. Verify the fee appears everywhere.
3. Create an expense with $0 fee. Verify it shows `$0.00` in the detail modal and no fee badge in the list.
4. Create a transfer with a $5 fee. Verify it still works as before.

---

## Fix E: Follow-Through Feature Completion

This is the largest fix. It requires a new database table, new IPC handlers, a new frontend component, and modifications to existing components.

### E.1: Database Migration — `finance_ft_persons` table

**New migration file: `migrations/00X_finance_ft_persons.sql`**

```sql
-- Follow-Through Persons table
CREATE TABLE IF NOT EXISTS finance_ft_persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_finance_ft_persons_name ON finance_ft_persons(name);

-- Add ft_person_id column to transactions (nullable for backward compat)
ALTER TABLE finance_transactions ADD COLUMN ft_person_id INTEGER REFERENCES finance_ft_persons(id);

-- Migrate existing on_behalf_of_label values to the persons table
INSERT OR IGNORE INTO finance_ft_persons (name, created_at, updated_at)
SELECT DISTINCT on_behalf_of_label,
  datetime('now','localtime'),
  datetime('now','localtime')
FROM finance_transactions
WHERE on_behalf_of = 1
  AND on_behalf_of_label IS NOT NULL
  AND on_behalf_of_label != '';

-- Link existing transactions to the new persons table
UPDATE finance_transactions
SET ft_person_id = (
  SELECT id FROM finance_ft_persons WHERE name = finance_transactions.on_behalf_of_label
)
WHERE on_behalf_of = 1
  AND on_behalf_of_label IS NOT NULL
  AND on_behalf_of_label != '';
```

### E.2: New IPC Handlers — `src/main.ts`

Add these handlers after the existing `finance:get-on-behalf-of-summary` handler (after line 21081):

```typescript
// ─── Follow-Through Persons ──────────────────────────────────────

ipcMain.handle('finance:get-ft-persons', async () => {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT p.*,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.on_behalf_of = 1 THEN -t.amount ELSE 0 END), 0) as total_owed,
        COALESCE(SUM(CASE WHEN t.tags LIKE '%ft_repaid:%' OR t.tags LIKE '%ft_partial_repaid:%' THEN t.amount ELSE 0 END), 0) as total_paid
      FROM finance_ft_persons p
      LEFT JOIN finance_transactions t ON t.ft_person_id = p.id
      GROUP BY p.id
      ORDER BY p.name ASC
    `).all();
  } catch (e: any) {
    console.error('[finance] get-ft-persons error:', e?.message);
    return [];
  }
});

ipcMain.handle('finance:create-ft-person', async (_event, data: { name: string; email?: string; phone?: string; notes?: string }) => {
  if (!db) return null;
  try {
    const name = (data.name || '').trim();
    if (!name) return null;
    // Check for existing person with same name (case-insensitive)
    const existing = db.prepare('SELECT id FROM finance_ft_persons WHERE LOWER(name) = LOWER(?)').get(name) as any;
    if (existing) return { id: existing.id, name, duplicate: true };
    const result = db.prepare(`
      INSERT INTO finance_ft_persons (name, email, phone, notes)
      VALUES (?, ?, ?, ?)
    `).run(name, data.email || null, data.phone || null, data.notes || '');
    const id = Number(result.lastInsertRowid);
    writeAuditLog('ft_person_created', 'ft_person', id, `Follow-through person "${name}" created`, { name, email: data.email, phone: data.phone });
    return { id, name, email: data.email || null, phone: data.phone || null, notes: data.notes || '', transaction_count: 0, total_owed: 0, total_paid: 0 };
  } catch (e: any) {
    console.error('[finance] create-ft-person error:', e?.message);
    return null;
  }
});

ipcMain.handle('finance:update-ft-person', async (_event, data: { id: number; name?: string; email?: string; phone?: string; notes?: string }) => {
  if (!db) return { success: false };
  try {
    const updates: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name.trim()); }
    if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email || null); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone || null); }
    if (data.notes !== undefined) { updates.push('notes = ?'); values.push(data.notes || ''); }
    updates.push("updated_at = datetime('now','localtime')");
    values.push(data.id);
    db.prepare(`UPDATE finance_ft_persons SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
});

ipcMain.handle('finance:delete-ft-person', async (_event, personId: number) => {
  if (!db) return { success: false };
  try {
    // Check if person has transactions
    const count = (db.prepare('SELECT COUNT(*) as c FROM finance_transactions WHERE ft_person_id = ?').get(personId) as any)?.c || 0;
    if (count > 0) {
      // Don't delete — just null out the ft_person_id but keep the label for historical records
      db.prepare('UPDATE finance_transactions SET on_behalf_of_label = (SELECT name FROM finance_ft_persons WHERE id = ?), ft_person_id = NULL WHERE ft_person_id = ?').run(personId, personId);
    }
    db.prepare('DELETE FROM finance_ft_persons WHERE id = ?').run(personId);
    writeAuditLog('ft_person_deleted', 'ft_person', personId, `Follow-through person deleted`, { transactionCount: count });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
});

ipcMain.handle('finance:get-ft-person-balances', async () => {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT
        p.id, p.name, p.email, p.phone,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.on_behalf_of = 1 THEN -t.amount ELSE 0 END), 0) as total_owed,
        COALESCE(SUM(CASE WHEN t.type = 'income' AND (t.tags LIKE '%ft_repaid:%' OR t.tags LIKE '%ft_partial_repaid:%') THEN t.amount ELSE 0 END), 0) as total_repaid,
        COUNT(DISTINCT t.id) as transaction_count
      FROM finance_ft_persons p
      LEFT JOIN finance_transactions t ON t.ft_person_id = p.id
      GROUP BY p.id
      ORDER BY total_owed DESC
    `).all();
  } catch (e: any) {
    console.error('[finance] get-ft-person-balances error:', e?.message);
    return [];
  }
});

// ─── Follow-Through Repayment ────────────────────────────────────

ipcMain.handle('finance:record-ft-repayment', async (_event, data: {
  original_tx_id: number;
  person_id: number;
  amount: number;
  date: string;
  is_overpayment: boolean;
  wallet_id: number;
  account_id: number;
}) => {
  if (!db) return null;
  try {
    const tags = data.is_overpayment
      ? `ft_repaid:${data.original_tx_id},ft_overpayment:${data.original_tx_id}:${data.amount}`
      : `ft_repaid:${data.original_tx_id}`;

    // Create income transaction for the repayment
    const result = db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, fee, description, date, tags, on_behalf_of, ft_person_id)
      VALUES (?, ?, NULL, 'income', ?, 0, ?, ?, ?, 0, ?)
    `).run(
      data.account_id,
      data.wallet_id,
      data.amount,
      `Repayment from ${data.person_id}`,
      data.date,
      tags,
      data.person_id
    );

    const txId = Number(result.lastInsertRowid);

    // Update wallet and account balances
    db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, data.wallet_id);
    db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(data.amount, data.account_id);

    writeAuditLog('ft_repayment_recorded', 'transaction', txId, `Follow-through repayment recorded`, {
      original_tx_id: data.original_tx_id,
      person_id: data.person_id,
      amount: data.amount,
      is_overpayment: data.is_overpayment
    });

    return { id: txId, success: true };
  } catch (e: any) {
    console.error('[finance] record-ft-repayment error:', e?.message);
    return null;
  }
});
```

### E.3: Modify `finance:create-transaction` to accept `ft_person_id`

Already addressed in Fix A (section 3). The modified handler accepts `data.ft_person_id` and inserts it into the transaction row. It also sets `on_behalf_of` and `on_behalf_of_label` based on the person ID.

### E.4: New Component — `FTPersonCombobox.tsx`

**New file: `src/components/finance/FTPersonCombobox.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, User, X } from 'lucide-react';

export interface FTPerson {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  transaction_count?: number;
  total_owed?: number;
}

interface FTPersonComboboxProps {
  value: number | null;
  onChange: (personId: number | null, personName: string | null) => void;
  persons: FTPerson[];
  onCreateNew: (name: string) => Promise<FTPerson | null>;
  displayCurrency?: string;
}

export function FTPersonCombobox({
  value,
  onChange,
  persons,
  onCreateNew,
}: FTPersonComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAddingNew(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedPerson = persons.find(p => p.id === value);

  const filtered = persons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (person: FTPerson) => {
    onChange(person.id, person.name);
    setOpen(false);
    setSearch('');
  };

  const handleCreateNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await onCreateNew(name);
      if (created) {
        onChange(created.id, created.name);
        setOpen(false);
        setAddingNew(false);
        setNewName('');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 outline-none focus:border-amber-500/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          {selectedPerson ? (
            <>
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="font-medium">{selectedPerson.name}</span>
              {selectedPerson.transaction_count && selectedPerson.transaction_count > 0 && (
                <span className="text-[10px] text-zinc-500 bg-zinc-700/50 px-1.5 py-0.5 rounded">
                  {selectedPerson.transaction_count} txns
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-500">Select person...</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-2xl overflow-hidden">
          {/* Search */}
          {!addingNew && (
            <div className="p-2 border-b border-zinc-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search persons..."
                  autoFocus
                  className="w-full bg-zinc-800/60 text-sm text-white rounded-md border border-zinc-700/50 pl-8 pr-3 py-2 outline-none focus:border-amber-500/50 placeholder:text-zinc-600"
                />
              </div>
            </div>
          )}

          {/* Add new form */}
          {addingNew ? (
            <div className="p-3 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateNew(); if (e.key === 'Escape') setAddingNew(false); }}
                placeholder="Person name"
                autoFocus
                className="w-full bg-zinc-800/60 text-sm text-white rounded-md border border-zinc-700/50 px-3 py-2 outline-none focus:border-amber-500/50 placeholder:text-zinc-600"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  disabled={!newName.trim() || creating}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Person'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingNew(false); setNewName(''); }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Person list */}
              <div className="max-h-48 overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-zinc-600">
                    No persons found
                  </div>
                )}
                {filtered.map(person => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSelect(person)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-zinc-800/60 transition-colors ${
                      value === person.id ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-medium">{person.name}</div>
                      {person.email && (
                        <div className="text-[10px] text-zinc-500">{person.email}</div>
                      )}
                    </div>
                    {person.total_owed !== undefined && person.total_owed > 0 && (
                      <span className="text-[10px] text-amber-400/80 tabular-nums">
                        Owed: {person.total_owed}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Add new button */}
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-amber-400 hover:bg-amber-500/10 border-t border-zinc-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add new person...</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Clear button */}
      {selectedPerson && (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="absolute right-9 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
```

### E.5: Modify `useTransactionForm.ts` — Replace free-text with person ID

**Before (lines 28-29):**
```typescript
const [onBehalfOf, setOnBehalfOf] = useState(false)
const [onBehalfOfLabel, setOnBehalfOfLabel] = useState('')
```

**After:**
```typescript
const [onBehalfOf, setOnBehalfOf] = useState(false)
const [onBehalfOfLabel, setOnBehalfOfLabel] = useState('')
const [ftPersonId, setFtPersonId] = useState<number | null>(null)
const [ftPersons, setFtPersons] = useState<{ id: number; name: string; transaction_count?: number; total_owed?: number }[]>([])
```

**Add effect to load persons when FT is toggled on:**
```typescript
useEffect(() => {
  if (onBehalfOf && ftPersons.length === 0) {
    (window as any).deskflowAPI?.getFTPersons?.().then((persons: any[]) => {
      if (Array.isArray(persons)) setFtPersons(persons);
    }).catch(() => {});
  }
}, [onBehalfOf, ftPersons.length]);
```

**Add create-person callback:**
```typescript
const handleCreatePerson = useCallback(async (name: string) => {
  const result = await (window as any).deskflowAPI?.createFTPerson?.({ name });
  if (result) {
    setFtPersons(prev => [...prev, result]);
    return result;
  }
  return null;
}, []);
```

**Modify `buildPayload` (line 55-56):**
```typescript
on_behalf_of: onBehalfOf ? 1 : 0,
on_behalf_of_label: onBehalfOf && ftPersonId
  ? (ftPersons.find(p => p.id === ftPersonId)?.name ?? onBehalfOfLabel.trim() || null)
  : (onBehalfOf && onBehalfOfLabel.trim() ? onBehalfOfLabel.trim() : null),
ft_person_id: onBehalfOf ? ftPersonId : null,
```

**Update the return statement to expose new state:**
```typescript
return {
  type, setType, amount, setAmount, numericAmount,
  description, setDescription, categoryId, setCategoryId,
  date, setDate, note, setNote, showAdvanced, setShowAdvanced,
  onBehalfOf, setOnBehalfOf,
  onBehalfOfLabel, setOnBehalfOfLabel,  // Keep for backward compat
  ftPersonId, setFtPersonId, ftPersons, setFtPersons, handleCreatePerson,  // NEW
  fee, setFee, numericFee,
  categoriesForType, reset, persistPrefs, buildPayload,
};
```

### E.6: Modify Transaction Form Modal — Replace text input with combobox

In the modal that renders the `onBehalfOfLabel` input (likely in the transaction form component), replace the text input:

**Before:**
```tsx
{onBehalfOf && (
  <input
    type="text"
    value={onBehalfOfLabel}
    onChange={e => setOnBehalfOfLabel(e.target.value)}
    placeholder="Person name"
    className="..."
  />
)}
```

**After:**
```tsx
{onBehalfOf && (
  <FTPersonCombobox
    value={ftPersonId}
    onChange={(id, name) => {
      setFtPersonId(id);
      setOnBehalfOfLabel(name || '');
    }}
    persons={ftPersons}
    onCreateNew={handleCreatePerson}
  />
)}
```

Add the import at the top:
```typescript
import { FTPersonCombobox } from './FTPersonCombobox';
```

### E.7: Dashboard Spending Split — Visual Card

**New file: `src/components/finance/SpendingSplitCard.tsx`**

```tsx
import { useMemo } from 'react';
import { Handshake, User } from 'lucide-react';

interface SpendingSplitCardProps {
  transactions: any[];
  displayCurrency: string;
  fmtCurrency: (amount: number, currency: string) => string;
}

export function SpendingSplitCard({ transactions, displayCurrency, fmtCurrency }: SpendingSplitCardProps) {
  const { personalTotal, ftTotal, total } = useMemo(() => {
    let personalTotal = 0;
    let ftTotal = 0;
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const absAmount = Math.abs(t.amount);
      if (t.on_behalf_of === 1) {
        ftTotal += absAmount;
      } else {
        personalTotal += absAmount;
      }
    }
    return { personalTotal, ftTotal, total: personalTotal + ftTotal };
  }, [transactions]);

  const personalPct = total > 0 ? (personalTotal / total) * 100 : 0;
  const ftPct = total > 0 ? (ftTotal / total) * 100 : 0;

  return (
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Spending Breakdown</h3>
        <span className="text-xs text-zinc-500 tabular-nums">
          Total: {fmtCurrency(total, displayCurrency)}
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800 mb-3">
        {personalPct > 0 && (
          <div
            className="bg-red-500/80 transition-all duration-500"
            style={{ width: `${personalPct}%` }}
          />
        )}
        {ftPct > 0 && (
          <div
            className="bg-amber-500/80 transition-all duration-500"
            style={{ width: `${ftPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Personal</div>
            <div className="text-sm font-semibold text-white tabular-nums truncate">
              {fmtCurrency(personalTotal, displayCurrency)}
            </div>
            <div className="text-[10px] text-zinc-600 tabular-nums">
              {personalPct.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Handshake className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Follow Through</div>
            <div className="text-sm font-semibold text-white tabular-nums truncate">
              {fmtCurrency(ftTotal, displayCurrency)}
            </div>
            <div className="text-[10px] text-zinc-600 tabular-nums">
              {ftPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### E.8: Modify `OverviewTab.tsx` — Replace text split with visual card

Find the section that renders `Personal: {expense} · Follow Through: {ftTotal}` and replace it:

**Before:**
```tsx
<div className="text-xs text-zinc-500">
  Personal: {fmtCurrency(personalExpense, displayCurrency)} · Follow Through: {fmtCurrency(ftTotal, displayCurrency)}
</div>
```

**After:**
```tsx
<SpendingSplitCard
  transactions={allTransactions}
  displayCurrency={displayCurrency}
  fmtCurrency={fmtCurrency}
/>
```

Add import:
```typescript
import { SpendingSplitCard } from './SpendingSplitCard';
```

### E.9: Repayment Modal — Full UI

**New file: `src/components/finance/RepaymentModal.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, ArrowUpCircle } from 'lucide-react';

interface RepaymentModalProps {
  open: boolean;
  onClose: () => void;
  originalTx: any;
  personName: string;
  amountOwed: number;
  amountRepaid: number; // Total already repaid (for partial repayments)
  walletId: number;
  accountId: number;
  displayCurrency: string;
  fmtCurrency: (amount: number, currency: string) => string;
  onRecordRepayment: (data: {
    original_tx_id: number;
    person_id: number;
    amount: number;
    date: string;
    is_overpayment: boolean;
    wallet_id: number;
    account_id: number;
  }) => Promise<any>;
}

export function RepaymentModal({
  open,
  onClose,
  originalTx,
  personName,
  amountOwed,
  amountRepaid,
  walletId,
  accountId,
  displayCurrency,
  fmtCurrency,
  onRecordRepayment,
}: RepaymentModalProps) {
  const remaining = Math.max(0, amountOwed - amountRepaid);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(remaining.toFixed(2));
      setDate(new Date().toISOString().split('T')[0]);
      setError('');
    }
  }, [open, remaining]);

  if (!open) return null;

  const numericAmount = Number(amount.replace(/[^0-9.]/g, '')) || 0;
  const isOverpayment = numericAmount > remaining;
  const isPartial = numericAmount < remaining && numericAmount > 0;

  const handleSubmit = async () => {
    if (numericAmount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await onRecordRepayment({
        original_tx_id: originalTx.id,
        person_id: originalTx.ft_person_id,
        amount: numericAmount,
        date,
        is_overpayment: isOverpayment,
        wallet_id: walletId,
        account_id: accountId,
      });
      if (result?.success || result?.id) {
        onClose();
      } else {
        setError('Failed to record repayment');
      }
    } catch (e: any) {
      setError(e?.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Record Repayment</h2>
              <p className="text-xs text-zinc-500">From {personName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Original</div>
              <div className="text-sm font-medium text-white tabular-nums">
                {fmtCurrency(amountOwed, displayCurrency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Repaid</div>
              <div className="text-sm font-medium text-emerald-400 tabular-nums">
                {fmtCurrency(amountRepaid, displayCurrency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Remaining</div>
              <div className="text-sm font-medium text-amber-400 tabular-nums">
                {fmtCurrency(remaining, displayCurrency)}
              </div>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Repayment Amount</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 pl-3 pr-3 py-2.5 outline-none focus:border-amber-500/50 tabular-nums transition-colors"
              />
            </div>
          </div>

          {/* Date input */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {/* Status indicators */}
          {isOverpayment && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="text-emerald-400 font-medium">Overpayment Detected</p>
                <p className="text-zinc-400 mt-0.5">
                  {personName} pays {fmtCurrency(numericAmount - remaining, displayCurrency)} extra.
                  This will be tracked as a credit for future follow-through transactions.
                </p>
              </div>
            </div>
          )}
          {isPartial && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="text-amber-400 font-medium">Partial Repayment</p>
                <p className="text-zinc-400 mt-0.5">
                  {fmtCurrency(remaining - numericAmount, displayCurrency)} will still be owed after this payment.
                </p>
              </div>
            </div>
          )}
          {!isOverpayment && !isPartial && numericAmount === remaining && numericAmount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="text-emerald-400 font-medium">Full Repayment</p>
                <p className="text-zinc-400 mt-0.5">This will mark the transaction as fully repaid.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-white rounded-lg border border-zinc-700/50 hover:border-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || numericAmount <= 0}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### E.10: Modify `TransactionDetailModal.tsx` — Integrate Repayment Modal

Add state and render the RepaymentModal:

**Add state (near other useState calls):**
```typescript
const [showRepayModal, setShowRepayModal] = useState(false);
```

**Add the repayment calculation:**
```typescript
const repaymentInfo = useMemo(() => {
  if (!transaction || transaction.on_behalf_of !== 1 || transaction.type !== 'expense') return null;
  const amountOwed = Math.abs(transaction.amount);
  const allRepaidTxs = (allTransactions || []).filter(t => {
    const tags = (t.tags || '').split(',').map(s => s.trim());
    return tags.some(tag => tag.startsWith(`ft_repaid:${transaction.id}`) || tag.startsWith(`ft_partial_repaid:${transaction.id}`)) && t.type === 'income';
  });
  const totalRepaid = allRepaidTxs.reduce((s, t) => s + t.amount, 0);
  const isFullyRepaid = totalRepaid >= amountOwed;
  return {
    amountOwed,
    totalRepaid,
    remaining: Math.max(0, amountOwed - totalRepaid),
    isFullyRepaid,
    repaymentTxs: allRepaidTxs,
  };
}, [transaction, allTransactions]);
```

**In the FT section of the modal (around lines 419-479), replace the existing "Mark as Repaid" button:**

```tsx
{repaymentInfo && (
  <div className="space-y-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide">Follow-Through</p>
        <p className="text-sm font-medium text-white">
          {getFtPerson(transaction) ?? 'Unknown person'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-zinc-500">Amount owed</p>
        <p className="text-sm font-medium text-amber-400 tabular-nums">
          {fmtCurrency(repaymentInfo.amountOwed, displayCurrency)}
        </p>
      </div>
    </div>

    {/* Repayment status */}
    {repaymentInfo.isFullyRepaid ? (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <div className="text-sm">
          <span className="text-emerald-400 font-medium">Fully repaid</span>
          {repaymentInfo.repaymentTxs.length > 0 && (
            <span className="text-zinc-500 ml-1">
              ({repaymentInfo.repaymentTxs.length} payment{repaymentInfo.repaymentTxs.length > 1 ? 's' : ''})
            </span>
          )}
        </div>
      </div>
    ) : repaymentInfo.totalRepaid > 0 ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Partially repaid</span>
          <span className="text-zinc-400 tabular-nums">
            {fmtCurrency(repaymentInfo.totalRepaid, displayCurrency)} / {fmtCurrency(repaymentInfo.amountOwed, displayCurrency)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500/80 transition-all"
            style={{ width: `${(repaymentInfo.totalRepaid / repaymentInfo.amountOwed) * 100}%` }}
          />
        </div>
        <button
          onClick={() => setShowRepayModal(true)}
          className="w-full px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          Record Another Payment
        </button>
      </div>
    ) : (
      <button
        onClick={() => setShowRepayModal(true)}
        className="w-full px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
      >
        Record Repayment
      </button>
    )}
  </div>
)}

{showRepayModal && transaction && (
  <RepaymentModal
    open={showRepayModal}
    onClose={() => setShowRepayModal(false)}
    originalTx={transaction}
    personName={getFtPerson(transaction) ?? 'Unknown'}
    amountOwed={repaymentInfo?.amountOwed ?? 0}
    amountRepaid={repaymentInfo?.totalRepaid ?? 0}
    walletId={transaction.wallet_id}
    accountId={transaction.account_id}
    displayCurrency={displayCurrency}
    fmtCurrency={fmtCurrency}
    onRecordRepayment={async (data) => {
      const result = await (window as any).deskflowAPI?.recordFTRepayment?.(data);
      if (result) {
        // Refresh transactions
        setShowRepayModal(false);
      }
      return result;
    }}
  />
)}
```

### E.11: Modify `receivables.ts` — Update to use `ft_person_id`

**Before:**
```typescript
export function getFtPerson(tx: FinanceTransaction): string | null {
  if (!tx.on_behalf_of || !tx.tags) return null;
  for (const t of tx.tags.split(',').map(s => s.trim())) {
    if (t.startsWith('ft_person:')) return t.slice('ft_person:'.length);
  }
  return tx.on_behalf_of_label ?? null;
}
```

**After:**
```typescript
export function getFtPerson(tx: FinanceTransaction): string | null {
  // Prefer ft_person_id lookup (handled by component with persons list)
  // Fall back to on_behalf_of_label
  if (!tx.on_behalf_of) return null;
  return tx.on_behalf_of_label ?? null;
}

export function getRepaymentStatus(
  tx: FinanceTransaction,
  allTxns: FinanceTransaction[],
): { repaid: boolean; totalRepaid: number; repaymentTxs: FinanceTransaction[] } {
  if (tx.on_behalf_of !== 1 || tx.type !== 'expense') {
    return { repaid: false, totalRepaid: 0, repaymentTxs: [] };
  }
  const repaymentTxs = allTxns.filter(t => {
    if (t.type !== 'income') return false;
    const tags = (t.tags ?? '').split(',').map(s => s.trim());
    return tags.some(tag => tag.startsWith(`ft_repaid:${tx.id}`) || tag.startsWith(`ft_partial_repaid:${tx.id}`));
  });
  const totalRepaid = repaymentTxs.reduce((s, t) => s + t.amount, 0);
  const amountOwed = Math.abs(tx.amount);
  return {
    repaid: totalRepaid >= amountOwed,
    totalRepaid,
    repaymentTxs,
  };
}
```

### E.12: Preload Bridge — Register new IPC channels

In `src/preload.ts` (or wherever the API bridge is defined), add:

```typescript
getFTPersons: () => ipcRenderer.invoke('finance:get-ft-persons'),
createFTPerson: (data: { name: string; email?: string; phone?: string; notes?: string }) =>
  ipcRenderer.invoke('finance:create-ft-person', data),
updateFTPerson: (data: { id: number; name?: string; email?: string; phone?: string; notes?: string }) =>
  ipcRenderer.invoke('finance:update-ft-person', data),
deleteFTPerson: (personId: number) =>
  ipcRenderer.invoke('finance:delete-ft-person', personId),
getFTPersonBalances: () => ipcRenderer.invoke('finance:get-ft-person-balances'),
recordFTRepayment: (data: any) =>
  ipcRenderer.invoke('finance:record-ft-repayment', data),
```

### E.13: Main Dashboard — Show FT spending

In the main dashboard page (not the finance page), add a card showing follow-through spending. Find the dashboard component and add:

```tsx
// In the dashboard component's data fetching:
const [ftSummary, setFtSummary] = useState({ totalExpense: 0, breakdown: [] });

useEffect(() => {
  (window as any).deskflowAPI?.getOnBehalfOfSummary?.().then((data: any) => {
    if (data) setFtSummary(data);
  });
}, []);

// In the render:
{ftSummary.totalExpense > 0 && (
  <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-3">
      <Handshake className="w-4 h-4 text-amber-400" />
      <h3 className="text-sm font-semibold text-white">Follow-Through Spending</h3>
    </div>
    <div className="text-2xl font-bold text-amber-400 tabular-nums mb-2">
      {fmtCurrency(ftSummary.totalExpense, displayCurrency)}
    </div>
    <div className="space-y-1.5">
      {ftSummary.breakdown.map((item: any) => (
        <div key={item.label} className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">{item.label}</span>
          <span className="text-white tabular-nums">
            {fmtCurrency(item.total, displayCurrency)}
            <span className="text-zinc-600 ml-1">({item.count})</span>
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

### Verification Steps

1. Toggle "Follow Through" on an expense. Verify the FTPersonCombobox appears with a dropdown of existing persons.
2. Click "Add new person...", type a name, and create. Verify the person appears in the dropdown and is selected.
3. Save the transaction. Verify it has `ft_person_id` set in the database and `on_behalf_of = 1`.
4. Open the transaction detail modal. Verify the person name, amount owed, and "Record Repayment" button appear.
5. Click "Record Repayment" and enter the full amount. Verify an income transaction is created and the original is marked as repaid.
6. Record a partial repayment. Verify the progress bar shows partial repayment.
7. Record an overpayment. Verify the overpayment indicator appears.
8. Check the dashboard spending split card. Verify personal vs follow-through spending is shown as a stacked bar.
9. Verify old transactions with `on_behalf_of_label` still work (backward compatibility).

---

## Fix F: Subscription Modal Currency

### Root Cause

`SubscriptionModal.tsx` hardcodes `currency: 'USD'` in the INITIAL state and has no currency dropdown in the form. The `displayCurrency` prop is received but only used in the preview section.

### Files to Modify

#### 1. `src/components/finance/SubscriptionModal.tsx`

**Modify the INITIAL state (line 37):**

**Before:**
```typescript
const INITIAL = {
  wallet_id: 0,
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  billing_cycle: 'monthly',
  // ...
};
```

**After:**
```typescript
const INITIAL = {
  wallet_id: 0,
  name: '',
  description: '',
  price: '',
  currency: displayCurrency || 'USD',  // ← Use displayCurrency prop as default
  billing_cycle: 'monthly',
  // ...
};
```

**Add currency dropdown in the form (between Name and Price fields):**

Find the price input section (around lines 135-145) and add the currency selector BEFORE it:

```tsx
{/* Currency selector */}
<div>
  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Currency</label>
  <select
    value={form.currency}
    onChange={e => handleChange('currency', e.target.value)}
    className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-indigo-500/50 transition-colors"
  >
    {COMMON_CURRENCIES.map(curr => (
      <option key={curr.code} value={curr.code}>
        {curr.code} — {curr.name} ({curr.symbol})
      </option>
    ))}
  </select>
</div>

{/* Price with currency symbol */}
<div>
  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Price</label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
      {COMMON_CURRENCIES.find(c => c.code === form.currency)?.symbol || '$'}
    </span>
    <input
      type="number"
      min="0"
      step="any"
      value={form.price}
      onChange={e => handleChange('price', e.target.value)}
      placeholder="0.00"
      className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 pl-8 pr-3 py-2.5 outline-none placeholder:text-zinc-600 focus:border-indigo-500/50 tabular-nums transition-colors"
    />
  </div>
</div>
```

**Add the import at the top:**
```typescript
import { COMMON_CURRENCIES } from './currency-data';
```

**Update the preview section to use `form.currency` instead of `displayCurrency`:**

Find the preview section and change all references from `displayCurrency` to `form.currency`:

```tsx
{/* Before: */}
{fmtCurrency(Number(form.price) || 0, displayCurrency)}

{/* After: */}
{fmtCurrency(Number(form.price) || 0, form.currency)}
```

Apply this to every `fmtCurrency` call within the preview that references the subscription's price.

#### 2. Ensure `COMMON_CURRENCIES` exists in `currency-data.ts`

If it doesn't already exist, add it:

```typescript
export const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
];
```

### Verification Steps

1. Open the subscription modal. Verify the currency dropdown defaults to the `displayCurrency` from settings.
2. Change the currency to EUR. Verify the price input prefix changes to `€`.
3. Verify the preview section uses the selected currency, not the page-level displayCurrency.
4. Save the subscription. Verify the `currency` field in the database matches the selected value.
5. Edit the saved subscription. Verify the currency dropdown shows the saved value.

---

## Fix G: AuditLogTab Crash

### Root Cause

`auditList()` returns `{ rows: [], total: 0 }` but `setLogs(result)` stores the entire object. Then `logs.map(...)` crashes because `logs` is an object, not an array.

### Files to Modify

#### 1. `src/components/finance/AuditLogTab.tsx` (line 35)

**Before:**
```typescript
const result = await (window as any).deskflowAPI?.auditList(opts) ?? []
setLogs(result)
```

**After:**
```typescript
const result = await (window as any).deskflowAPI?.auditList(opts) ?? { rows: [], total: 0 }
setLogs(result?.rows ?? [])
setTotalCount(result?.total ?? 0)  // If there's a totalCount state; if not, add one
```

**If there's no `totalCount` state, add it:**
```typescript
const [totalCount, setTotalCount] = useState(0)
```

**Also fix the pagination to use `totalCount` instead of `logs.length`:**
```typescript
// Before:
const totalPages = Math.ceil(logs.length / PAGE_SIZE)

// After:
const totalPages = Math.ceil(totalCount / PAGE_SIZE)
```

### Verification Steps

1. Navigate to the Audit Log tab. Verify it loads without crashing.
2. Verify logs are displayed as a list.
3. Verify pagination works (if there are more than PAGE_SIZE logs).
4. Filter by entity type. Verify the list updates.

---

## Fix H: Subscription Auto-Transaction Generation

### Root Cause

No IPC handler exists for checking due subscriptions or generating transactions from them. Subscriptions have `next_renewal_date` but nothing acts on it.

### Files to Modify

#### 1. `src/main.ts` — New IPC handlers

Add after the existing `subscriptions:create` handler (after line 21305):

```typescript
// ─── Subscription Renewal Check ─────────────────────────────────

ipcMain.handle('subscriptions:check-renewals', async () => {
  if (!db) return { dueSubscriptions: [], count: 0 };
  try {
    const today = new Date().toISOString().split('T')[0];
    const dueSubscriptions = db.prepare(`
      SELECT s.*,
        w.name as wallet_name,
        w.account_id,
        w.currency as wallet_currency
      FROM finance_subscriptions s
      INNER JOIN finance_wallets w ON s.wallet_id = w.id
      WHERE s.status = 'active'
        AND s.next_renewal_date IS NOT NULL
        AND s.next_renewal_date <= ?
      ORDER BY s.next_renewal_date ASC
    `).all(today) as any[];

    return {
      dueSubscriptions,
      count: dueSubscriptions.length,
    };
  } catch (e: any) {
    console.error('[subscriptions] check-renewals error:', e?.message);
    return { dueSubscriptions: [], count: 0, error: e?.message };
  }
});

// ─── Generate Transaction from Subscription ─────────────────────

ipcMain.handle('subscriptions:generate-transaction', async (_event, subscriptionId: number) => {
  if (!db) return null;
  try {
    const sub = db.prepare(`
      SELECT s.*, w.account_id, w.currency as wallet_currency
      FROM finance_subscriptions s
      INNER JOIN finance_wallets w ON s.wallet_id = w.id
      WHERE s.id = ?
    `).get(subscriptionId) as any;

    if (!sub) return { success: false, error: 'Subscription not found' };

    const today = new Date().toISOString().split('T')[0];
    const amount = -Math.abs(sub.price); // Expense: negative amount

    // Create the expense transaction
    const txResult = db.prepare(`
      INSERT INTO finance_transactions
        (account_id, wallet_id, category_id, type, amount, fee, description, note, date, tags, on_behalf_of)
      VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, 0)
    `).run(
      sub.account_id,
      sub.wallet_id,
      sub.category_id || null,
      amount,
      `Subscription: ${sub.name}`,
      sub.description || '',
      today,
      `subscription:${sub.id}`
    );

    const txId = Number(txResult.lastInsertRowid);

    // Update wallet and account balances
    db.prepare('UPDATE finance_wallets SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(amount, sub.wallet_id);
    db.prepare('UPDATE finance_accounts SET balance = balance + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(amount, sub.account_id);

    // Advance next_renewal_date
    const nextDate = computeNextRenewalDate(sub.next_renewal_date || today, sub.billing_cycle, sub.billing_interval);
    db.prepare('UPDATE finance_subscriptions SET next_renewal_date = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(nextDate, sub.id);

    writeAuditLog('subscription_transaction_generated', 'transaction', txId,
      `Transaction generated from subscription "${sub.name}"`, {
        subscription_id: sub.id,
        amount,
        next_renewal_date: nextDate
      });

    return { success: true, transactionId: txId, nextRenewalDate: nextDate };
  } catch (e: any) {
    console.error('[subscriptions] generate-transaction error:', e?.message);
    return { success: false, error: e?.message };
  }
});

// ─── Skip Subscription Renewal ──────────────────────────────────

ipcMain.handle('subscriptions:skip-renewal', async (_event, subscriptionId: number) => {
  if (!db) return { success: false };
  try {
    const sub = db.prepare('SELECT next_renewal_date, billing_cycle, billing_interval FROM finance_subscriptions WHERE id = ?').get(subscriptionId) as any;
    if (!sub) return { success: false, error: 'Subscription not found' };

    const nextDate = computeNextRenewalDate(sub.next_renewal_date || new Date().toISOString().split('T')[0], sub.billing_cycle, sub.billing_interval);
    db.prepare('UPDATE finance_subscriptions SET next_renewal_date = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(nextDate, subscriptionId);

    writeAuditLog('subscription_renewal_skipped', 'subscription', subscriptionId,
      `Subscription renewal skipped`, { next_renewal_date: nextDate });

    return { success: true, nextRenewalDate: nextDate };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
});
```

**Add the `computeNextRenewalDate` helper function** (place near the top of `main.ts`, after imports):

```typescript
function computeNextRenewalDate(currentDate: string, billingCycle: string, interval: number): string {
  const date = new Date(currentDate + 'T00:00:00');
  const n = Math.max(1, interval || 1);

  switch (billingCycle) {
    case 'daily':
      date.setDate(date.getDate() + n);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * n));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + n);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + (3 * n));
      break;
    case 'yearly':
    case 'annually':
      date.setFullYear(date.getFullYear() + n);
      break;
    default:
      date.setMonth(date.getMonth() + n); // Default to monthly
  }

  return date.toISOString().split('T')[0];
}
```

#### 2. Preload Bridge — Register new IPC channels

```typescript
checkSubscriptionRenewals: () => ipcRenderer.invoke('subscriptions:check-renewals'),
generateSubscriptionTransaction: (subscriptionId: number) =>
  ipcRenderer.invoke('subscriptions:generate-transaction', subscriptionId),
skipSubscriptionRenewal: (subscriptionId: number) =>
  ipcRenderer.invoke('subscriptions:skip-renewal', subscriptionId),
```

#### 3. Frontend — Subscription Renewal Banner

**New file: `src/components/finance/SubscriptionRenewalBanner.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { AlertCircle, Check, X, Clock } from 'lucide-react';

interface SubscriptionRenewalBannerProps {
  onRefresh: () => void;
  displayCurrency: string;
  fmtCurrency: (amount: number, currency: string) => string;
}

interface DueSubscription {
  id: number;
  name: string;
  price: number;
  currency: string;
  next_renewal_date: string;
  billing_cycle: string;
  billing_interval: number;
  wallet_name: string;
}

export function SubscriptionRenewalBanner({ onRefresh, displayCurrency, fmtCurrency }: SubscriptionRenewalBannerProps) {
  const [dueSubs, setDueSubs] = useState<DueSubscription[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    (window as any).deskflowAPI?.checkSubscriptionRenewals?.().then((data: any) => {
      if (data?.dueSubscriptions) {
        setDueSubs(data.dueSubscriptions);
      }
    }).catch(() => {});
  }, []);

  if (dueSubs.length === 0 || dismissed) return null;

  const handleGenerate = async (subId: number) => {
    setProcessing(subId);
    try {
      const result = await (window as any).deskflowAPI?.generateSubscriptionTransaction?.(subId);
      if (result?.success) {
        setDueSubs(prev => prev.filter(s => s.id !== subId));
        onRefresh();
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleSkip = async (subId: number) => {
    setProcessing(subId);
    try {
      const result = await (window as any).deskflowAPI?.skipSubscriptionRenewal?.(subId);
      if (result?.success) {
        setDueSubs(prev => prev.filter(s => s.id !== subId));
      }
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Subscriptions Due for Renewal</h3>
            <p className="text-[11px] text-zinc-500">{dueSubs.length} subscription{dueSubs.length > 1 ? 's' : ''} need attention</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {dueSubs.map(sub => (
          <div key={sub.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{sub.name}</div>
                <div className="text-[11px] text-zinc-500">
                  {fmtCurrency(sub.price, sub.currency || displayCurrency)} · {sub.billing_cycle}
                  {sub.billing_interval > 1 ? ` × ${sub.billing_interval}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleGenerate(sub.id)}
                disabled={processing === sub.id}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
              >
                {processing === sub.id ? 'Processing...' : 'Generate'}
              </button>
              <button
                onClick={() => handleSkip(sub.id)}
                disabled={processing === sub.id}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 4. Render the banner in the Finance Page

In `FinancePage.tsx`, add the banner above the tabs or in the subscriptions section:

```tsx
import { SubscriptionRenewalBanner } from './SubscriptionRenewalBanner';

// In the render, before the tab content:
<SubscriptionRenewalBanner
  onRefresh={() => { /* refetch subscriptions and transactions */ }}
  displayCurrency={displayCurrency}
  fmtCurrency={fmtCurrency}
/>
```

### Verification Steps

1. Create a subscription with `next_renewal_date` set to yesterday.
2. Reload the Finance page. Verify the renewal banner appears.
3. Click "Generate" on a due subscription. Verify an expense transaction is created with the correct amount and description.
4. Verify the subscription's `next_renewal_date` is advanced to the next cycle.
5. Click "Skip" on another due subscription. Verify no transaction is created but the date advances.
6. Verify the banner disappears when all due subscriptions are handled.

---

## Migration SQL — All Schema Changes

**Single migration file: `migrations/00X_finance_bugfix_complete.sql`**

```sql
-- ═══════════════════════════════════════════════════════════════
-- Finance Bugfix & Feature Completion Migration
-- ═══════════════════════════════════════════════════════════════

-- 1. Follow-Through Persons table
CREATE TABLE IF NOT EXISTS finance_ft_persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_finance_ft_persons_name ON finance_ft_persons(name);

-- 2. Add ft_person_id to transactions (nullable for backward compat)
-- Use try/catch in application code since ALTER TABLE ADD COLUMN fails if column exists
-- The application should check PRAGMA table_info before running this.
ALTER TABLE finance_transactions ADD COLUMN ft_person_id INTEGER REFERENCES finance_ft_persons(id);

-- 3. Migrate existing on_behalf_of_label values to persons table
INSERT OR IGNORE INTO finance_ft_persons (name, created_at, updated_at)
SELECT DISTINCT on_behalf_of_label,
  datetime('now','localtime'),
  datetime('now','localtime')
FROM finance_transactions
WHERE on_behalf_of = 1
  AND on_behalf_of_label IS NOT NULL
  AND on_behalf_of_label != ''
  AND on_behalf_of_label NOT IN (SELECT name FROM finance_ft_persons);

-- 4. Link existing transactions to persons
UPDATE finance_transactions
SET ft_person_id = (
  SELECT id FROM finance_ft_persons WHERE name = finance_transactions.on_behalf_of_label
)
WHERE on_behalf_of = 1
  AND on_behalf_of_label IS NOT NULL
  AND ft_person_id IS NULL;

-- 5. Verify data integrity
-- Run this query to check for orphaned FT transactions:
-- SELECT * FROM finance_transactions WHERE on_behalf_of = 1 AND ft_person_id IS NULL AND on_behalf_of_label IS NOT NULL;
```

**Application-side migration runner** (in `main.ts`, after DB initialization):

```typescript
function runMigrations() {
  if (!db) return;
  try {
    // Check if ft_person_id column exists
    const columns = db.prepare('PRAGMA table_info(finance_transactions)').all() as any[];
    const hasFtPersonId = columns.some(c => c.name === 'ft_person_id');

    if (!hasFtPersonId) {
      console.log('[migration] Adding ft_person_id column to finance_transactions...');
      db.exec('ALTER TABLE finance_transactions ADD COLUMN ft_person_id INTEGER REFERENCES finance_ft_persons(id);');
    }

    // Create finance_ft_persons table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS finance_ft_persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_finance_ft_persons_name ON finance_ft_persons(name);
    `);

    // Migrate existing labels to persons
    db.exec(`
      INSERT OR IGNORE INTO finance_ft_persons (name, created_at, updated_at)
      SELECT DISTINCT on_behalf_of_label,
        datetime('now','localtime'),
        datetime('now','localtime')
      FROM finance_transactions
      WHERE on_behalf_of = 1
        AND on_behalf_of_label IS NOT NULL
        AND on_behalf_of_label != '';
    `);

    // Link transactions
    db.exec(`
      UPDATE finance_transactions
      SET ft_person_id = (
        SELECT id FROM finance_ft_persons WHERE name = finance_transactions.on_behalf_of_label
      )
      WHERE on_behalf_of = 1
        AND on_behalf_of_label IS NOT NULL
        AND ft_person_id IS NULL;
    `);

    console.log('[migration] Finance bugfix migration complete.');
  } catch (e: any) {
    console.error('[migration] Error:', e?.message);
  }
}
```

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/components/finance/FTPersonCombobox.tsx` | Dropdown combobox for selecting/creating follow-through persons |
| `src/components/finance/SpendingSplitCard.tsx` | Visual stacked-bar card showing personal vs FT spending split |
| `src/components/finance/RepaymentModal.tsx` | Modal for recording full/partial/over repayments |
| `src/components/finance/SubscriptionRenewalBanner.tsx` | Banner showing due subscriptions with generate/skip actions |
| `migrations/00X_finance_bugfix_complete.sql` | Database migration for `finance_ft_persons` table + `ft_person_id` column |

---

## Implementation Order

Execute fixes in this order due to dependencies:

```
Phase 1 — Backend Foundation (no frontend changes)
  ├── Fix G: AuditLogTab crash (independent, immediate)
  ├── Fix A.2: recalculate-balances handler fix
  ├── Fix A.3: create-transaction handler fix (adds ft_person_id support)
  ├── Fix A.1: get-summary handler fix
  ├── Fix A.4: get-dashboard-overview handler fix
  └── Run migration: finance_ft_persons table + ft_person_id column

Phase 2 — Follow-Through Backend
  ├── E.2: New IPC handlers (get-ft-persons, create-ft-person, etc.)
  ├── E.3: Preload bridge registration for FT handlers
  └── E.12: Preload bridge for all new IPC channels

Phase 3 — Subscription Backend
  ├── Fix H.1: subscriptions:check-renewals handler
  ├── Fix H.1: subscriptions:generate-transaction handler
  ├── Fix H.1: subscriptions:skip-renewal handler
  ├── Fix H.2: computeNextRenewalDate helper
  └── Fix H.2: Preload bridge for subscription handlers

Phase 4 — Frontend Bug Fixes (no new components)
  ├── Fix B: OverviewTab netWorthSeries + openingNW + effectivePeriod
  ├── Fix C: FinancePage trend calculation + FinanceStickyHeader guard
  ├── Fix D: useTransactionForm fee for all types + modal UI changes
  ├── Fix F: SubscriptionModal currency dropdown
  └── Fix E.11: receivables.ts update

Phase 5 — Frontend New Components
  ├── E.4: FTPersonCombobox.tsx
  ├── E.5: useTransactionForm.ts — integrate FTPersonCombobox
  ├── E.6: Transaction form modal — replace text input with combobox
  ├── E.7: SpendingSplitCard.tsx
  ├── E.8: OverviewTab — replace text split with SpendingSplitCard
  ├── E.9: RepaymentModal.tsx
  ├── E.10: TransactionDetailModal — integrate RepaymentModal
  ├── E.13: Main Dashboard — FT spending card
  └── Fix H.3: SubscriptionRenewalBanner.tsx + render in FinancePage

Phase 6 — Verification
  ├── Verify all 8 fixes per their verification steps
  ├── Test backward compatibility with old transactions
  └── Test edge cases (empty data, single transaction, overpayments)
```

**Critical dependency notes:**
- Fix A (balance calculation) must be applied before Fix B (chart) and Fix C (percentage), because the chart and percentage depend on correct balance data.
- The migration (Phase 1) must run before any FT backend handlers (Phase 2) since they reference the `finance_ft_persons` table.
- Fix E.5 (useTransactionForm changes) must be applied before E.6 (modal UI) since the modal depends on the new hook return values.
- Fix D (fee for all types) should be applied in Phase 4 but is independent of other fixes.

---

## Edge Cases Handled

| Edge Case | Fix | Handling |
|-----------|-----|----------|
| No transactions exist | B | Chart shows flat line at current net worth |
| Single transaction | B | Chart shows opening NW + 1 data point + today |
| All transactions same day | B | Chart shows opening + that day + today (3 points) |
| Previous month net flow is 0 | C | Percentage defaults to +100% or -100% |
| `trend.percent` is Infinity | C | Displays "—" instead of `Infinity%` |
| Fee is 0 for non-transfer | D | Shows `$0.00` in detail, no fee badge in list |
| Person name already exists | E.2 | Returns existing person ID with `duplicate: true` |
| Person has transactions, trying to delete | E.2 | Nullifies `ft_person_id` but keeps `on_behalf_of_label` for history |
| Partial repayment | E.9 | Progress bar shows partial, "Record Another Payment" button |
| Overpayment | E.9 | Shows overpayment indicator, credits tracked via tags |
| Subscription currency different from displayCurrency | F | Preview uses subscription's own currency |
| Subscription has no `next_renewal_date` | H | Excluded from renewal check |
| `billing_interval` is 0 or null | H | `computeNextRenewalDate` defaults to 1 |
| `auditList` returns null | G | Falls back to `{ rows: [], total: 0 }` |
| Column `ft_person_id` already exists | Migration | `PRAGMA table_info` check prevents duplicate ALTER |
| localStorage access fails | All | Wrapped in try/catch per constraints |
| CRLF line endings | All | All files must be saved with CRLF (`\r\n`) |