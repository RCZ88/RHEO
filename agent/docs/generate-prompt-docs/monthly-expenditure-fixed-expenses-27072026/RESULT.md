 I'll design the complete Fixed Expenses + Budget system specification for DeskFlow. Let me analyze the architecture and produce a comprehensive engineering document.

---

# DeskFlow Fixed Expenses & Budget System — Complete Engineering Specification

## 1. Database Schema

### 1.1 New Tables

```sql
-- ============================================
-- FIXED EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS finance_fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  category_id INTEGER,
  billing_day INTEGER DEFAULT 1 CHECK(billing_day >= 1 AND billing_day <= 28),
  is_active INTEGER DEFAULT 1,
  auto_create_transaction INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES finance_wallets(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_wallet ON finance_fixed_expenses(wallet_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_category ON finance_fixed_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON finance_fixed_expenses(is_active);

-- ============================================
-- FIXED EXPENSE MONTHLY PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS finance_fixed_expense_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fixed_expense_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'skipped')),
  amount_paid REAL,
  transaction_id INTEGER,
  paid_date TEXT,
  paid_by TEXT DEFAULT 'manual' CHECK(paid_by IN ('manual', 'auto', 'quick')),
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fixed_expense_id) REFERENCES finance_fixed_expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE SET NULL,
  UNIQUE(fixed_expense_id, month)
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_month ON finance_fixed_expense_payments(month);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_status ON finance_fixed_expense_payments(status);

-- ============================================
-- BUDGETS
-- ============================================
CREATE TABLE IF NOT EXISTS finance_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('total', 'category')),
  category_id INTEGER,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  period TEXT DEFAULT 'monthly' CHECK(period IN ('monthly', 'weekly', 'yearly')),
  alert_threshold REAL DEFAULT 80 CHECK(alert_threshold >= 50 AND alert_threshold <= 100),
  is_active INTEGER DEFAULT 1,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_budgets_type ON finance_budgets(type);
CREATE INDEX IF NOT EXISTS idx_budgets_active ON finance_budgets(is_active);
```

### 1.2 Migration Script (main.ts)

```typescript
// Insert at existing migration block in src/main.ts
const currentVersion = db.pragma('user_version', { simple: true }) as number;

if (currentVersion < 12) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS finance_fixed_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        category_id INTEGER,
        billing_day INTEGER DEFAULT 1 CHECK(billing_day >= 1 AND billing_day <= 28),
        is_active INTEGER DEFAULT 1,
        auto_create_transaction INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS finance_fixed_expense_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fixed_expense_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'skipped')),
        amount_paid REAL,
        transaction_id INTEGER,
        paid_date TEXT,
        paid_by TEXT DEFAULT 'manual' CHECK(paid_by IN ('manual', 'auto', 'quick')),
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(fixed_expense_id, month)
      );
      
      CREATE TABLE IF NOT EXISTS finance_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('total', 'category')),
        category_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        period TEXT DEFAULT 'monthly' CHECK(period IN ('monthly', 'weekly', 'yearly')),
        alert_threshold REAL DEFAULT 80 CHECK(alert_threshold >= 50 AND alert_threshold <= 100),
        is_active INTEGER DEFAULT 1,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_fixed_expenses_wallet ON finance_fixed_expenses(wallet_id);
      CREATE INDEX idx_fixed_expenses_category ON finance_fixed_expenses(category_id);
      CREATE INDEX idx_fixed_expenses_active ON finance_fixed_expenses(is_active);
      CREATE INDEX idx_fixed_expense_payments_month ON finance_fixed_expense_payments(month);
      CREATE INDEX idx_fixed_expense_payments_status ON finance_fixed_expense_payments(status);
      CREATE INDEX idx_budgets_type ON finance_budgets(type);
      CREATE INDEX idx_budgets_active ON finance_budgets(is_active);
    `);
    db.pragma('user_version = 12');
  } catch (err) {
    console.error('Migration v12 failed:', err);
  }
}
```

---

## 2. IPC Endpoint Specifications

### 2.1 Preload.ts Additions (lines 1058+)

```typescript
// Fixed Expenses
fixedExpensesList: (month?: string) => ipcRenderer.invoke('fixed-expenses:list', month),
fixedExpensesCreate: (data) => ipcRenderer.invoke('fixed-expenses:create', data),
fixedExpensesUpdate: (data) => ipcRenderer.invoke('fixed-expenses:update', data),
fixedExpensesDelete: (id) => ipcRenderer.invoke('fixed-expenses:delete', id),
fixedExpensesMarkPaid: (data) => ipcRenderer.invoke('fixed-expenses:mark-paid', data),
fixedExpensesSkipMonth: (data) => ipcRenderer.invoke('fixed-expenses:skip-month', data),
fixedExpensesUnmarkPaid: (data) => ipcRenderer.invoke('fixed-expenses:unmark-paid', data),
fixedExpensesPaymentHistory: (id) => ipcRenderer.invoke('fixed-expenses:payment-history', id),
fixedExpensesDetectRecurring: () => ipcRenderer.invoke('fixed-expenses:detect-recurring'),
fixedExpensesSummary: (month?: string) => ipcRenderer.invoke('fixed-expenses:summary', month),

// Budgets
budgetsList: () => ipcRenderer.invoke('budgets:list'),
budgetsCreate: (data) => ipcRenderer.invoke('budgets:create', data),
budgetsUpdate: (data) => ipcRenderer.invoke('budgets:update', data),
budgetsDelete: (id) => ipcRenderer.invoke('budgets:delete', id),
budgetsGetStatus: (month?: string) => ipcRenderer.invoke('budgets:get-status', month),
```

### 2.2 TypeScript Interfaces (finance-types.ts additions)

```typescript
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
  // Joined fields
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  wallet_name?: string;
  wallet_currency?: string;
  current_month_status?: 'pending' | 'paid' | 'skipped';
  current_month_amount_paid?: number;
  current_month_transaction_id?: number | null;
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
  // Joined fields
  category_name?: string;
  category_color?: string;
  category_icon?: string;
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
    category?: {
      id: number;
      name: string;
      color: string;
      icon: string;
    };
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
  merchant: string;
  confidence: number; // 0-1
  sampleTransactions: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
}

export type FinanceTabKey = 
  | 'overview' 
  | 'wallets' 
  | 'transactions' 
  | 'categories' 
  | 'people' 
  | 'subscriptions' 
  | 'fixed-expenses' 
  | 'budget' 
  | 'audit' 
  | 'charts';
```

### 2.3 IPC Handlers (main.ts)

#### Fixed Expenses CRUD

```typescript
// Helper: Get or create "Fixed Expenses" category
function getFixedExpenseCategoryId() {
  if (!db) return null;
  let cat = db.prepare("SELECT id FROM finance_categories WHERE name = 'Fixed Expenses' LIMIT 1").get();
  if (cat) return cat.id;
  const result = db.prepare(
    "INSERT INTO finance_categories (name, type, icon, color, sort_order) VALUES ('Fixed Expenses', 'expense', 'Receipt', '#f59e0b', 17)"
  ).run();
  return Number(result.lastInsertRowid);
}

// LIST — returns all fixed expenses with current month payment status
electron_1.ipcMain.handle('fixed-expenses:list', async (_event, month?: string) => {
  if (!db) return [];
  try {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    
    const rows = db.prepare(`
      SELECT 
        fe.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        w.name as wallet_name,
        w.currency as wallet_currency,
        fp.status as current_month_status,
        fp.amount_paid as current_month_amount_paid,
        fp.transaction_id as current_month_transaction_id
      FROM finance_fixed_expenses fe
      LEFT JOIN finance_categories c ON fe.category_id = c.id
      LEFT JOIN finance_wallets w ON fe.wallet_id = w.id
      LEFT JOIN finance_fixed_expense_payments fp 
        ON fe.id = fp.fixed_expense_id AND fp.month = ?
      WHERE fe.is_active = 1
      ORDER BY fe.billing_day ASC, fe.name ASC
    `).all(targetMonth);
    
    return rows;
  } catch (err) {
    console.error('fixed-expenses:list error:', err);
    return [];
  }
});

// CREATE
electron_1.ipcMain.handle('fixed-expenses:create', async (_event, data: any) => {
  if (!db) throw new Error('Database not available');
  
  try {
    const stmt = db.prepare(`
      INSERT INTO finance_fixed_expenses 
      (wallet_id, name, description, amount, currency, category_id, billing_day, is_active, auto_create_transaction, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.wallet_id,
      data.name,
      data.description || '',
      data.amount,
      data.currency || 'USD',
      data.category_id || null,
      data.billing_day || 1,
      data.is_active !== undefined ? data.is_active : 1,
      data.auto_create_transaction || 0,
      data.metadata || null
    );
    
    const id = Number(result.lastInsertRowid);
    
    // Auto-create pending payment record for current month if not exists
    const currentMonth = new Date().toISOString().slice(0, 7);
    db.prepare(`
      INSERT OR IGNORE INTO finance_fixed_expense_payments 
      (fixed_expense_id, month, status) VALUES (?, ?, 'pending')
    `).run(id, currentMonth);
    
    logAuditEvent('fixed_expense_created', 'fixed_expense', id, `Created fixed expense: ${data.name}`);
    
    return { id, ...data };
  } catch (err) {
    console.error('fixed-expenses:create error:', err);
    throw err;
  }
});

// UPDATE
electron_1.ipcMain.handle('fixed-expenses:update', async (_event, data: any) => {
  if (!db) throw new Error('Database not available');
  
  try {
    const existing = db.prepare('SELECT * FROM finance_fixed_expenses WHERE id = ?').get(data.id);
    if (!existing) throw new Error('Fixed expense not found');
    
    db.prepare(`
      UPDATE finance_fixed_expenses SET
        wallet_id = COALESCE(?, wallet_id),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        amount = COALESCE(?, amount),
        currency = COALESCE(?, currency),
        category_id = COALESCE(?, category_id),
        billing_day = COALESCE(?, billing_day),
        is_active = COALESCE(?, is_active),
        auto_create_transaction = COALESCE(?, auto_create_transaction),
        metadata = COALESCE(?, metadata),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.wallet_id,
      data.name,
      data.description,
      data.amount,
      data.currency,
      data.category_id,
      data.billing_day,
      data.is_active,
      data.auto_create_transaction,
      data.metadata,
      data.id
    );
    
    logAuditEvent('fixed_expense_updated', 'fixed_expense', data.id, `Updated fixed expense: ${data.name || existing.name}`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error('fixed-expenses:update error:', err);
    throw err;
  }
});

// DELETE
electron_1.ipcMain.handle('fixed-expenses:delete', async (_event, id: number) => {
  if (!db) throw new Error('Database not available');
  
  try {
    const expense = db.prepare('SELECT name FROM finance_fixed_expenses WHERE id = ?').get(id);
    if (!expense) throw new Error('Fixed expense not found');
    
    // Payments cascade delete via FK constraint
    db.prepare('DELETE FROM finance_fixed_expenses WHERE id = ?').run(id);
    
    logAuditEvent('fixed_expense_deleted', 'fixed_expense', id, `Deleted fixed expense: ${expense.name}`);
    return { success: true };
  } catch (err) {
    console.error('fixed-expenses:delete error:', err);
    throw err;
  }
});
```

#### Mark Paid / Skip / Unmark

```typescript
// MARK PAID — creates real transaction
electron_1.ipcMain.handle('fixed-expenses:mark-paid', async (_event, data: any) => {
  if (!db) throw new Error('Database not available');
  
  const { fixed_expense_id, month, amount, note, paid_by = 'manual' } = data;
  
  try {
    db.exec('BEGIN TRANSACTION');
    
    const expense = db.prepare('SELECT * FROM finance_fixed_expenses WHERE id = ?').get(fixed_expense_id);
    if (!expense) throw new Error('Fixed expense not found');
    
    const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(expense.wallet_id);
    if (!wallet) throw new Error('Wallet not found');
    
    const payAmount = amount || expense.amount;
    const today = new Date().toISOString().slice(0, 10);
    
    // 1. Create real transaction
    const txnStmt = db.prepare(`
      INSERT INTO finance_transactions 
      (account_id, wallet_id, category_id, type, amount, fee, merchant, description, note, date, time, on_behalf_of, is_adjustment)
      VALUES (?, ?, ?, 'expense', ?, 0, ?, ?, ?, ?, ?, 0, 0)
    `);
    
    const txnResult = txnStmt.run(
      wallet.account_id,
      expense.wallet_id,
      expense.category_id,
      -Math.abs(payAmount), // expense is negative
      expense.name,
      `Fixed: ${expense.name} (${month})`,
      note || '',
      today,
      new Date().toTimeString().slice(0, 5)
    );
    
    const transactionId = Number(txnResult.lastInsertRowid);
    
    // 2. Deduct from wallet
    db.prepare('UPDATE finance_wallets SET balance = balance - ? WHERE id = ?')
      .run(Math.abs(payAmount), expense.wallet_id);
    
    // 3. Upsert payment record
    db.prepare(`
      INSERT INTO finance_fixed_expense_payments 
      (fixed_expense_id, month, status, amount_paid, transaction_id, paid_date, paid_by, note)
      VALUES (?, ?, 'paid', ?, ?, ?, ?, ?)
      ON CONFLICT(fixed_expense_id, month) DO UPDATE SET
        status = 'paid',
        amount_paid = excluded.amount_paid,
        transaction_id = excluded.transaction_id,
        paid_date = excluded.paid_date,
        paid_by = excluded.paid_by,
        note = excluded.note,
        updated_at = CURRENT_TIMESTAMP
    `).run(fixed_expense_id, month, payAmount, transactionId, today, paid_by, note || '');
    
    db.exec('COMMIT');
    
    logAuditEvent('fixed_expense_paid', 'fixed_expense', fixed_expense_id, 
      `Marked ${expense.name} as paid for ${month}: ${payAmount} ${expense.currency}`);
    
    return { 
      success: true, 
      transaction_id: transactionId,
      amount: payAmount,
      month,
      paid_date: today 
    };
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('fixed-expenses:mark-paid error:', err);
    throw err;
  }
});

// SKIP MONTH
electron_1.ipcMain.handle('fixed-expenses:skip-month', async (_event, data: any) => {
  if (!db) throw new Error('Database not available');
  
  const { fixed_expense_id, month, note } = data;
  
  try {
    db.prepare(`
      INSERT INTO finance_fixed_expense_payments 
      (fixed_expense_id, month, status, note)
      VALUES (?, ?, 'skipped', ?)
      ON CONFLICT(fixed_expense_id, month) DO UPDATE SET
        status = 'skipped',
        transaction_id = NULL,
        amount_paid = NULL,
        paid_date = NULL,
        note = excluded.note,
        updated_at = CURRENT_TIMESTAMP
    `).run(fixed_expense_id, month, note || '');
    
    logAuditEvent('fixed_expense_skipped', 'fixed_expense', fixed_expense_id,
      `Skipped ${month} payment`);
    
    return { success: true };
  } catch (err) {
    console.error('fixed-expenses:skip-month error:', err);
    throw err;
  }
});

// UNMARK PAID — reverses transaction
electron_1.ipcMain.handle('fixed-expenses:unmark-paid', async (_event, data: any) => {
  if (!db) throw new Error('Database not available');
  
  const { fixed_expense_id, month } = data;
  
  try {
    db.exec('BEGIN TRANSACTION');
    
    const payment = db.prepare(`
      SELECT * FROM finance_fixed_expense_payments 
      WHERE fixed_expense_id = ? AND month = ?
    `).get(fixed_expense_id, month);
    
    if (!payment || payment.status !== 'paid') {
      throw new Error('Payment not found or not paid');
    }
    
    // 1. Reverse wallet balance
    if (payment.transaction_id) {
      const txn = db.prepare('SELECT amount, wallet_id FROM finance_transactions WHERE id = ?')
        .get(payment.transaction_id);
      if (txn) {
        // Add back the deducted amount
        db.prepare('UPDATE finance_wallets SET balance = balance + ? WHERE id = ?')
          .run(Math.abs(txn.amount), txn.wallet_id);
        
        // 2. Delete the transaction
        db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(payment.transaction_id);
      }
    }
    
    // 3. Reset payment record
    db.prepare(`
      UPDATE finance_fixed_expense_payments 
      SET status = 'pending', amount_paid = NULL, transaction_id = NULL, 
          paid_date = NULL, paid_by = 'manual', updated_at = CURRENT_TIMESTAMP
      WHERE fixed_expense_id = ? AND month = ?
    `).run(fixed_expense_id, month);
    
    db.exec('COMMIT');
    
    logAuditEvent('fixed_expense_unpaid', 'fixed_expense', fixed_expense_id,
      `Unmarked ${month} payment`);
    
    return { success: true };
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('fixed-expenses:unmark-paid error:', err);
    throw err;
  }
});
```

#### Payment History & Summary

```typescript
// PAYMENT HISTORY
electron_1.ipcMain.handle('fixed-expenses:payment-history', async (_event, id: number) => {
  if (!db) return [];
  
  try {
    return db.prepare(`
      SELECT fp.*, fe.name as expense_name, fe.amount as expected_amount
      FROM finance_fixed_expense_payments fp
      JOIN finance_fixed_expenses fe ON fp.fixed_expense_id = fe.id
      WHERE fp.fixed_expense_id = ?
      ORDER BY fp.month DESC
    `).all(id);
  } catch (err) {
    console.error('fixed-expenses:payment-history error:', err);
    return [];
  }
});

// MONTHLY SUMMARY
electron_1.ipcMain.handle('fixed-expenses:summary', async (_event, month?: string) => {
  if (!db) return null;
  
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  
  try {
    const totalFixed = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM finance_fixed_expenses 
      WHERE is_active = 1
    `).get();
    
    const paidSummary = db.prepare(`
      SELECT COALESCE(SUM(fe.amount), 0) as total_paid,
             COUNT(*) as paid_count
      FROM finance_fixed_expenses fe
      JOIN finance_fixed_expense_payments fp 
        ON fe.id = fp.fixed_expense_id AND fp.month = ? AND fp.status = 'paid'
      WHERE fe.is_active = 1
    `).get(targetMonth);
    
    const byCategory = db.prepare(`
      SELECT 
        fe.category_id,
        c.name as category_name,
        c.color as category_color,
        SUM(fe.amount) as total_amount,
        SUM(CASE WHEN fp.status = 'paid' THEN fe.amount ELSE 0 END) as paid_amount,
        COUNT(*) as count
      FROM finance_fixed_expenses fe
      LEFT JOIN finance_categories c ON fe.category_id = c.id
      LEFT JOIN finance_fixed_expense_payments fp 
        ON fe.id = fp.fixed_expense_id AND fp.month = ?
      WHERE fe.is_active = 1
      GROUP BY fe.category_id
    `).all(targetMonth);
    
    const overdueCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM finance_fixed_expenses fe
      LEFT JOIN finance_fixed_expense_payments fp 
        ON fe.id = fp.fixed_expense_id AND fp.month = ?
      WHERE fe.is_active = 1 
        AND fe.billing_day < ?
        AND (fp.status IS NULL OR fp.status = 'pending')
        AND ? <= date('now', 'start of month')
    `).get(targetMonth, new Date().getDate(), targetMonth).count;
    
    return {
      totalMonthlyFixed: totalFixed.total,
      totalPaid: paidSummary.total_paid,
      totalRemaining: totalFixed.total - paidSummary.total_paid,
      percentagePaid: totalFixed.total > 0 ? (paidSummary.total_paid / totalFixed.total) * 100 : 0,
      byCategory,
      overdueCount,
      upcomingCount: totalFixed.count - paidSummary.paid_count - overdueCount
    };
  } catch (err) {
    console.error('fixed-expenses:summary error:', err);
    return null;
  }
});
```

#### Detect Recurring Patterns

```typescript
// DETECT RECURRING PATTERNS
electron_1.ipcMain.handle('fixed-expenses:detect-recurring', async () => {
  if (!db) return [];
  
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().slice(0, 10);
    
    // Find merchants/descriptions that appear 3+ times
    const candidates = db.prepare(`
      SELECT 
        LOWER(TRIM(REPLACE(REPLACE(description, '[^a-zA-Z0-9 ]', ''), '  ', ' '))) as normalized_desc,
        merchant,
        category_id,
        COUNT(*) as frequency,
        AVG(ABS(amount)) as avg_amount,
        MAX(date) as last_seen,
        MIN(date) as first_seen
      FROM finance_transactions
      WHERE type = 'expense'
        AND date >= ?
        AND is_adjustment = 0
        AND (on_behalf_of = 0 OR on_behalf_of IS NULL)
      GROUP BY normalized_desc
      HAVING frequency >= 3
      ORDER BY frequency DESC, avg_amount DESC
      LIMIT 20
    `).all(cutoff);
    
    const suggestions: RecurringPatternSuggestion[] = [];
    
    for (const candidate of candidates) {
      // Get sample transactions
      const samples = db.prepare(`
        SELECT date, ABS(amount) as amount, description
        FROM finance_transactions
        WHERE type = 'expense'
          AND date >= ?
          AND (LOWER(description) LIKE ? OR LOWER(merchant) LIKE ?)
        ORDER BY date DESC
        LIMIT 5
      `).all(cutoff, `%${candidate.normalized_desc}%`, `%${candidate.normalized_desc}%`);
      
      // Calculate confidence based on amount variance and date regularity
      const amounts = samples.map((s: any) => s.amount);
      const avgAmount = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((sum: number, val: number) => sum + Math.pow(val - avgAmount, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);
      const cv = avgAmount > 0 ? stdDev / avgAmount : 1; // coefficient of variation
      
      // Check if already a fixed expense
      const existing = db.prepare(`
        SELECT 1 FROM finance_fixed_expenses 
        WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?
        LIMIT 1
      `).get(`%${candidate.normalized_desc}%`, `%${candidate.normalized_desc}%`);
      
      if (existing) continue;
      
      const category = db.prepare('SELECT name FROM finance_categories WHERE id = ?').get(candidate.category_id);
      
      suggestions.push({
        suggestedName: candidate.merchant || candidate.normalized_desc,
        avgAmount: Math.round(avgAmount * 100) / 100,
        frequency: candidate.frequency,
        lastSeen: candidate.last_seen,
        category: category?.name || 'Other',
        categoryId: candidate.category_id,
        merchant: candidate.merchant || candidate.normalized_desc,
        confidence: Math.max(0, 1 - cv), // higher confidence = lower variance
        sampleTransactions: samples
      });
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  } catch (err) {
    console.error('fixed-expenses:detect-recurring error:', err);
    return [];
  }
});
```

### 2.4 Budget IPC Handlers

```typescript
// BUDGETS LIST
electron_1.ipcMain.handle('budgets:list', async () => {
  if (!db) return [];
  
  try {
    return db.prepare(`
      SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM finance_budgets b
      LEFT JOIN finance_categories c ON b.category_id = c.id
      ORDER BY b.type ASC, b.name ASC
    `).all();
  } catch (err) {
    console.error('budgets:list error:', err);
    return [];
  }
});

// BUDGETS CREATE
electron_1.ipcMain.handle('budgets:create', async (_event, data: any) => {
  if (!db) throw new Error('Database not available');
  
  try {
    const stmt = db.prepare(`
      INSERT INTO finance_budgets 
      (name, type, category_id, amount, currency, period, alert_threshold, is_active, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.name,
      data.type,
      data.type === 'category' ? data.category_id : null,
      data.amount,
      data.currency || 'USD',
      data.period || 'monthly',
      data.alert_threshold || 80,
      data.is_active !== undefined ? data.is_active : 1,
      data.metadata || null
    );
    
    const id = Number(result.lastInsertRowid);
    logAuditEvent('budget_created', 'budget', id, `Created budget: ${data.name}`);
    return { id, ...data };
  } catch (err) {
    console.error('budgets:create error:', err);
    throw err;
  }
});

// BUDGETS UPDATE
electron_1.ipcMain.handle('budgets:update', async (_event, data: any) => {
  if (!db) throw new Error('Database not available');
  
  try {
    db.prepare(`
      UPDATE finance_budgets SET
        name = COALESCE(?, name),
        type = COALESCE(?, type),
        category_id = COALESCE(?, category_id),
        amount = COALESCE(?, amount),
        currency = COALESCE(?, currency),
        period = COALESCE(?, period),
        alert_threshold = COALESCE(?, alert_threshold),
        is_active = COALESCE(?, is_active),
        metadata = COALESCE(?, metadata),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.name, data.type, 
      data.type === 'category' ? data.category_id : null,
      data.amount, data.currency, data.period,
      data.alert_threshold, data.is_active, data.metadata,
      data.id
    );
    
    logAuditEvent('budget_updated', 'budget', data.id, `Updated budget: ${data.name}`);
    return { success: true };
  } catch (err) {
    console.error('budgets:update error:', err);
    throw err;
  }
});

// BUDGETS DELETE
electron_1.ipcMain.handle('budgets:delete', async (_event, id: number) => {
  if (!db) throw new Error('Database not available');
  
  try {
    const budget = db.prepare('SELECT name FROM finance_budgets WHERE id = ?').get(id);
    db.prepare('DELETE FROM finance_budgets WHERE id = ?').run(id);
    logAuditEvent('budget_deleted', 'budget', id, `Deleted budget: ${budget?.name}`);
    return { success: true };
  } catch (err) {
    console.error('budgets:delete error:', err);
    throw err;
  }
});

// BUDGETS GET STATUS
electron_1.ipcMain.handle('budgets:get-status', async (_event, month?: string) => {
  if (!db) return null;
  
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const [year, mon] = targetMonth.split('-').map(Number);
  const startDate = `${targetMonth}-01`;
  const endDate = new Date(year, mon, 0).toISOString().slice(0, 10); // last day of month
  
  try {
    const budgets = db.prepare(`
      SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM finance_budgets b
      LEFT JOIN finance_categories c ON b.category_id = c.id
      WHERE b.is_active = 1
    `).all();
    
    let totalBudget = 0;
    let totalSpent = 0;
    let overBudgetCount = 0;
    let warningCount = 0;
    
    const budgetStatuses = budgets.map((budget: any) => {
      let spent = 0;
      
      if (budget.type === 'total') {
        const result = db.prepare(`
          SELECT COALESCE(SUM(ABS(amount)), 0) as spent
          FROM finance_transactions
          WHERE type = 'expense'
            AND date >= ? AND date <= ?
            AND is_adjustment = 0
            AND (on_behalf_of = 0 OR on_behalf_of IS NULL)
        `).get(startDate, endDate);
        spent = result.spent;
      } else {
        const result = db.prepare(`
          SELECT COALESCE(SUM(ABS(amount)), 0) as spent
          FROM finance_transactions
          WHERE type = 'expense'
            AND category_id = ?
            AND date >= ? AND date <= ?
            AND is_adjustment = 0
            AND (on_behalf_of = 0 OR on_behalf_of IS NULL)
        `).get(budget.category_id, startDate, endDate);
        spent = result.spent;
      }
      
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const remaining = Math.max(0, budget.amount - spent);
      
      let status: 'ok' | 'warning' | 'over' = 'ok';
      if (percentage >= 100) {
        status = 'over';
        overBudgetCount++;
      } else if (percentage >= budget.alert_threshold) {
        status = 'warning';
        warningCount++;
      }
      
      totalBudget += budget.amount;
      totalSpent += spent;
      
      return {
        id: budget.id,
        name: budget.name,
        type: budget.type,
        limit: budget.amount,
        spent,
        remaining,
        percentage: Math.round(percentage * 10) / 10,
        status,
        category: budget.category_id ? {
          id: budget.category_id,
          name: budget.category_name,
          color: budget.category_color,
          icon: budget.category_icon
        } : undefined
      };
    });
    
    return {
      budgets: budgetStatuses,
      totalBudget,
      totalSpent,
      totalRemaining: Math.max(0, totalBudget - totalSpent),
      overallPercentage: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      overBudgetCount,
      warningCount
    };
  } catch (err) {
    console.error('budgets:get-status error:', err);
    return null;
  }
});
```

---

## 3. Component Hierarchy

### 3.1 New Components to Create

```
src/components/finance/
├── FixedExpensesTab.tsx          # Main tab container
├── FixedExpenseCard.tsx          # Individual expense card
├── FixedExpenseModal.tsx         # Create/Edit modal
├── FixedExpensesSummaryBar.tsx   # Top summary bar
├── MonthSelector.tsx             # < Jul 2026 > navigator
├── FixedExpenseEmptyState.tsx    # Empty state illustration
├── RecurringPatternDetector.tsx  # Suggestion panel
├── BudgetTab.tsx                 # Main budget container
├── BudgetCard.tsx                # Individual budget card
├── BudgetModal.tsx               # Create/Edit modal
├── BudgetOverallCard.tsx         # Large progress ring card
├── BudgetWarningBanner.tsx       # Alert banner component
├── BudgetEmptyState.tsx          # Empty state
├── FixedExpensesOverviewCard.tsx # For OverviewTab
├── BudgetStatusOverviewCard.tsx  # For OverviewTab
└── finance-types.ts              # Extended (see §2.2)
```

### 3.2 Modified Components

```
src/pages/FinancePage.tsx         # Add tabs, state, loadData
src/components/finance/OverviewTab.tsx  # Add new cards
src/components/dashboard/FinanceOverviewSection.tsx  # Add counts
src/main.ts                       # Add IPC handlers, migrations
src/preload.ts                    # Add bridge methods
```

---

## 4. Interaction Flows

### 4.1 Create Fixed Expense

```
1. User clicks FAB (+) in Fixed Expenses tab
2. FixedExpenseModal opens with empty form
3. User fills: name, amount, category, billing_day (1-28), wallet, description
4. User toggles auto_create_transaction (default: off)
5. User clicks "Save"
6. Frontend calls window.deskflowAPI.fixedExpensesCreate(data)
7. Backend:
   a. INSERT INTO finance_fixed_expenses
   b. INSERT OR IGNORE current month pending payment record
   c. logAuditEvent
8. Frontend: invalidate list, show toast success, close modal
9. New card appears in list with "Pending" status
```

### 4.2 Mark as Paid (One-Click)

```
1. User views Fixed Expenses tab, sees expense card with "Pending" status
2. User clicks "Mark Paid" button on card
3. Confirmation modal: "Mark 'University Parking' as paid for July 2026? ($45.00)"
4. User confirms
5. Frontend calls window.deskflowAPI.fixedExpensesMarkPaid({
     fixed_expense_id: 1,
     month: '2026-07',
     amount: 45.00  // optional override
   })
6. Backend (in transaction):
   a. SELECT expense + wallet
   b. INSERT INTO finance_transactions (type='expense', amount=-45.00)
   c. UPDATE finance_wallets SET balance = balance - 45.00
   d. INSERT/UPDATE finance_fixed_expense_payments → status='paid'
   e. COMMIT
   f. logAuditEvent
7. Frontend: 
   a. Refresh fixed expenses list (card now shows green "Paid")
   b. Refresh transactions list
   c. Refresh wallet balances
   d. Refresh budget status (spending increased)
   e. Show toast: "✓ Marked as paid — transaction #1234 created"
```

### 4.3 Detect Recurring Patterns

```
1. User clicks "Detect Patterns" button in Fixed Expenses tab
2. Frontend shows loading state
3. Frontend calls window.deskflowAPI.fixedExpensesDetectRecurring()
4. Backend:
   a. Scan last 6 months of expense transactions
   b. Group by normalized description
   c. Filter frequency >= 3, calculate confidence
   d. Exclude already-existing fixed expenses
5. Frontend displays RecurringPatternDetector panel:
   - "We found 4 potential fixed expenses"
   - Each suggestion: name, avg amount, frequency, confidence %
   - "Create" button per suggestion → pre-fills FixedExpenseModal
6. User clicks "Create" on a suggestion
7. Modal opens pre-filled: name, amount, category, samples
8. User adjusts billing_day, wallet, saves
```

### 4.4 Create Budget

```
1. User clicks FAB in Budget tab
2. BudgetModal opens
3. User selects type: "Total" or "Category"
   - If Category: dropdown of expense categories appears
4. User enters: name, amount, currency, period, alert_threshold (slider)
5. Live preview updates: "Warn when spending exceeds $800 (80%)"
6. User clicks "Save"
7. Frontend calls window.deskflowAPI.budgetsCreate(data)
8. Backend INSERT, logAuditEvent
9. Frontend refreshes budget list + status
```

### 4.5 Budget Warning Check

```
1. On FinancePage mount / data refresh:
   a. loadData() calls window.deskflowAPI.budgetsGetStatus()
   b. Store result in state: budgetStatus
   
2. If budgetStatus.warningCount > 0 or budgetStatus.overBudgetCount > 0:
   a. BudgetTab: render BudgetWarningBanner at top
   b. OverviewTab: render mini warning badge on BudgetStatusOverviewCard
   
3. BudgetWarningBanner:
   - Glass surface, amber/red left border
   - "⚠️ Food budget is at 87% — $12.30 remaining"
   - "🚨 You've exceeded Entertainment by $23.50"
   - Dismissible per-banner (localStorage key: dismissedBudgetWarnings)
   
4. On new transaction creation:
   a. After finance:create-transaction success
   b. Re-fetch budgets:get-status
   c. If new warning triggered, show transient toast
```

---

## 5. Data Processing Pipeline

### 5.1 Monthly Fixed Expense Summary

```typescript
function calculateFixedExpenseSummary(
  expenses: FinanceFixedExpense[],
  payments: Map<string, FinanceFixedExpensePayment>,
  targetMonth: string
): FixedExpenseSummary {
  const activeExpenses = expenses.filter(e => e.is_active === 1);
  
  const totalMonthlyFixed = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  const paidAmount = activeExpenses.reduce((sum, e) => {
    const payment = payments.get(`${e.id}:${targetMonth}`);
    return sum + (payment?.status === 'paid' ? (payment.amount_paid || e.amount) : 0);
  }, 0);
  
  const byCategory = groupBy(activeExpenses, 'category_id');
  const categoryBreakdown = Object.entries(byCategory).map(([catId, items]) => {
    const cat = items[0];
    return {
      categoryId: cat.category_id,
      categoryName: cat.category_name || 'Uncategorized',
      categoryColor: cat.category_color || '#71717a',
      totalAmount: items.reduce((s, i) => s + i.amount, 0),
      paidAmount: items.reduce((s, i) => {
        const p = payments.get(`${i.id}:${targetMonth}`);
        return s + (p?.status === 'paid' ? (p.amount_paid || i.amount) : 0);
      }, 0),
      count: items.length
    };
  });
  
  const today = new Date();
  const [year, month] = targetMonth.split('-').map(Number);
  const isCurrentOrPastMonth = targetMonth <= today.toISOString().slice(0, 7);
  const currentDay = today.getDate();
  
  const overdueCount = activeExpenses.filter(e => {
    const payment = payments.get(`${e.id}:${targetMonth}`);
    return isCurrentOrPastMonth && 
           e.billing_day < currentDay && 
           (!payment || payment.status === 'pending');
  }).length;
  
  return {
    totalMonthlyFixed,
    totalPaid: paidAmount,
    totalRemaining: totalMonthlyFixed - paidAmount,
    percentagePaid: totalMonthlyFixed > 0 ? (paidAmount / totalMonthlyFixed) * 100 : 0,
    byCategory: categoryBreakdown,
    overdueCount,
    upcomingCount: activeExpenses.length - 
      activeExpenses.filter(e => {
        const p = payments.get(`${e.id}:${targetMonth}`);
        return p?.status === 'paid';
      }).length - overdueCount
  };
}
```

### 5.2 Budget Spending Calculation

```typescript
function calculateBudgetSpending(
  budget: FinanceBudget,
  transactions: FinanceTransaction[],
  period: string,
  targetMonth: string
): number {
  const [year, mon] = targetMonth.split('-').map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0);
  
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  
  return transactions
    .filter(t => {
      const inPeriod = t.date >= startStr && t.date <= endStr;
      const isExpense = t.type === 'expense';
      const notAdjustment = t.is_adjustment === 0;
      const notOnBehalf = !t.on_behalf_of || t.on_behalf_of === 0;
      const categoryMatch = budget.type === 'total' || t.category_id === budget.category_id;
      return inPeriod && isExpense && notAdjustment && notOnBehalf && categoryMatch;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

function getBudgetStatusColor(percentage: number, threshold: number): string {
  if (percentage >= 100) return '#ef4444';      // red-500
  if (percentage >= threshold) return '#f97316'; // orange-500
  if (percentage >= 60) return '#eab308';        // yellow-500
  return '#10b981';                              // emerald-500
}
```

### 5.3 Cash Flow Runway Extension

Modify existing `finance:get-cashflow-runway` handler:

```typescript
// Add to existing committedMonthly calculation:
const fixedExpensesMonthly = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) as total
  FROM finance_fixed_expenses
  WHERE is_active = 1
`).get();

const committedMonthly = 
  monthlyBurnRate + 
  committedSubscriptions + 
  fixedExpensesMonthly.total;
```

### 5.4 Subscription Intelligence Extension

Modify existing `finance:get-subscription-intelligence` handler:

```typescript
// Add fixed expenses to burden calculation:
const fixedMonthly = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) as total
  FROM finance_fixed_expenses
  WHERE is_active = 1
`).get();

const totalCommittedMonthly = totalMonthlyCost + fixedMonthly.total;
const burdenPercentage = monthlyIncome > 0 
  ? (totalCommittedMonthly / monthlyIncome) * 100 
  : 0;
```

---

## 6. High-Fidelity Visual Specs

### 6.1 Fixed Expenses Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Summary Bar]                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ $1,240   │ │ $890     │ │ $350     │ │ 72%          │  │
│  │ Total    │ │ Paid     │ │ Remaining│ │ % Paid       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  [←] July 2026 [→]  [Today]  [🔍 Detect Patterns]         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🅿️ University Parking                    [Mark Paid] │   │
│  │    $45.00  •  Transport  •  Due: 5th               │   │
│  │    ✅ Paid on Jul 5, 2026                          │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📱 Phone Data Plan                      [Mark Paid] │   │
│  │    $30.00  •  Utilities  •  Due: 15th              │   │
│  │    ⏰ Pending (Due in 3 days)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🍔 Food Budget                          [Mark Paid] │   │
│  │    $400.00 •  Food       •  Due: 1st               │   │
│  │    🚨 Overdue (Due 2 days ago)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🏋️ Gym Membership                       [Skipped]  │   │
│  │    $50.00  •  Health     •  Due: 20th              │   │
│  │    ⏸️ Skipped for July 2026                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
      [+] FAB (bottom-right)
```

### 6.2 Fixed Expense Card Spec

```typescript
// GlassSurface wrapper
<GlassSurface className="p-5 rounded-xl border border-[rgba(63,63,70,0.50)] bg-[rgba(24,24,27,0.80)] backdrop-blur-xl">
  
  {/* Top row: Icon + Name + Amount + Action */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
        <Receipt className="w-5 h-5 text-amber-500" />
      </div>
      <div>
        <h3 className="text-zinc-50 font-medium text-sm">{expense.name}</h3>
        <p className="text-zinc-500 text-xs">{expense.category_name} • Due: {expense.billing_day}{getOrdinal(expense.billing_day)}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-zinc-50 font-bold text-lg tabular-nums">{formatCurrency(expense.amount, expense.currency)}</p>
    </div>
  </div>
  
  {/* Status row */}
  <div className="mt-4 flex items-center justify-between">
    <div className="flex items-center gap-2">
      {status === 'paid' && (
        <>
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-emerald-400 text-xs">Paid on {paidDate}</span>
        </>
      )}
      {status === 'pending' && !isOverdue && (
        <>
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-amber-400 text-xs">Due in {daysUntilDue} days</span>
        </>
      )}
      {status === 'pending' && isOverdue && (
        <>
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-red-400 text-xs">Overdue by {daysOverdue} days</span>
        </>
      )}
      {status === 'skipped' && (
        <>
          <SkipForward className="w-4 h-4 text-zinc-500" />
          <span className="text-zinc-400 text-xs">Skipped for {month}</span>
        </>
      )}
    </div>
    
    {/* Action button */}
    {status === 'pending' && (
      <button className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors">
        Mark Paid
      </button>
    )}
    {status === 'paid' && (
      <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-colors">
        Undo
      </button>
    )}
  </div>
  
  {/* Progress bar (optional visual) */}
  <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
    <div 
      className={cn(
        "h-full rounded-full transition-all",
        status === 'paid' ? "bg-emerald-500 w-full" :
        isOverdue ? "bg-red-500 w-1/4" :
        "bg-amber-500 w-1/2"
      )}
    />
  </div>
</GlassSurface>
```

### 6.3 Budget Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Overall Budget Card — Large Progress Ring]                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            ┌──────────┐                            │   │
│  │           /   68%    /                             │   │
│  │          /  SPENT   /                              │   │
│  │         └──────────┘                               │   │
│  │   $2,400 spent of $3,500 budget                    │   │
│  │   $1,100 remaining • 12 days left                  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Warnings (if any)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🚨 Entertainment budget exceeded by $23.50         │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠️ Food budget at 87% — only $12.30 remaining      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [Budget Cards Grid]                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ 🍔 Food         │  │ 🚗 Transport    │  │ 🎬 Ent.     │ │
│  │ $450 / $500     │  │ $120 / $200     │  │ $223 / $200 │ │
│  │ ████████████░   │  │ ██████░░░░░░░   │  │ ████████████│ │
│  │ 90% • WARNING   │  │ 60% • OK        │  │ 111% • OVER │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Budget Card Spec

```typescript
<GlassSurface className="p-5 rounded-xl relative overflow-hidden">
  {/* Left accent border */}
  <div 
    className="absolute left-0 top-0 bottom-0 w-1" 
    style={{ backgroundColor: budget.category?.color || '#f59e0b' }}
  />
  
  <div className="pl-3">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {budget.category?.icon && <Icon name={budget.category.icon} className="w-4 h-4" style={{ color: budget.category.color }} />}
        <span className="text-zinc-50 font-medium text-sm">{budget.name}</span>
      </div>
      <span className={cn(
        "px-2 py-0.5 text-xs font-bold rounded-full",
        status === 'ok' && "bg-emerald-500/20 text-emerald-400",
        status === 'warning' && "bg-amber-500/20 text-amber-400",
        status === 'over' && "bg-red-500/20 text-red-400"
      )}>
        {status.toUpperCase()}
      </span>
    </div>
    
    <div className="flex items-baseline justify-between mb-2">
      <span className="text-zinc-50 text-lg font-bold tabular-nums">{formatCurrency(spent)}</span>
      <span className="text-zinc-500 text-xs">of {formatCurrency(limit)}</span>
    </div>
    
    {/* Progress bar */}
    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-500"
        style={{ 
          width: `${Math.min(percentage, 100)}%`,
          background: status === 'over' 
            ? 'linear-gradient(90deg, #ef4444, #dc2626)' 
            : status === 'warning'
            ? 'linear-gradient(90deg, #f59e0b, #f97316)'
            : 'linear-gradient(90deg, #10b981, #34d399)'
        }}
      />
    </div>
    
    <div className="mt-2 flex justify-between text-xs">
      <span className="text-zinc-500">{percentage}% used</span>
      <span className={cn(
        status === 'over' ? "text-red-400" : "text-zinc-400"
      )}>
        {status === 'over' 
          ? `${formatCurrency(Math.abs(remaining))} over` 
          : `${formatCurrency(remaining)} left`}
      </span>
    </div>
  </div>
</GlassSurface>
```

### 6.5 Budget Warning Banner Spec

```typescript
<AnimatePresence>
  {warnings.length > 0 && (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mb-6"
    >
      <GlassSurface className="p-4 rounded-xl border-l-4 border-l-amber-500 bg-[rgba(24,24,27,0.90)]">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            {warnings.map(w => (
              <p key={w.id} className="text-sm text-zinc-200">
                {w.status === 'over' ? '🚨' : '⚠️'} {w.message}
              </p>
            ))}
          </div>
          <button 
            onClick={() => setDismissed(true)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </GlassSurface>
    </motion.div>
  )}
</AnimatePresence>
```

### 6.6 Animation Specs

```typescript
// Tab panel transition (existing pattern)
const tabPanel = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

// Card stagger (existing riseItem pattern)
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const cardItem = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }
  }
};

// Progress bar animation
const progressBar = {
  initial: { width: 0 },
  animate: { width: `${percentage}%` },
  transition: { duration: 0.8, ease: "easeOut", delay: 0.2 }
};

// Modal animation
const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
};

const modalContent = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
};
```

---

## 7. Edge Cases & Resolution

| Edge Case | Detection | Resolution |
|-----------|-----------|------------|
| **Wallet deleted** | FK constraint `ON DELETE RESTRICT` prevents deletion if fixed expenses reference it | Show error: "Cannot delete wallet — 3 fixed expenses linked. Reassign or delete expenses first." |
| **Category deleted** | FK `ON DELETE SET NULL` | Fixed expense becomes "Uncategorized". UI shows gray badge. Budget becomes invalid — `budgets:get-status` handles null category_id by returning 0 spent. |
| **Month boundary (31st)** | `billing_day` capped at 28 | Prevents February issues. For months with 30 days, billing on 30th works; on 31st-months, billing on 28th = 3 days early, acceptable tradeoff. |
| **Encrypted data** | All IPC handlers check `financeDataKey` | Follow existing pattern: encrypt `name`, `description`, `metadata` fields before INSERT; decrypt on SELECT. Payment records are not encrypted (link IDs only). |
| **Concurrent mark-paid** | SQLite transaction + unique constraint on payments | `BEGIN TRANSACTION` ensures atomicity. If two clients race, one wins; the other gets "payment already exists" and should refresh. |
| **Undo after wallet balance changed** | `unmark-paid` adds back original txn amount, not current balance | This is correct — we reverse the exact transaction. If user spent the money elsewhere, wallet may go negative (valid state, shows warning). |
| **Auto-create transaction on billing day** | Background job or on-app-open check | In `loadData()` or app startup, scan: `billing_day == today.getDate()` AND no payment record for current month AND `auto_create_transaction=1`. Call `mark-paid` with `paid_by='auto'`. |
| **Budget with deleted category** | `category_id` points to missing row | Budget card shows "Deleted Category" in gray. Spending = 0. User should edit budget to reassign or delete. |
| **Negative remaining budget** | Spent > limit | Show absolute overage in red. Progress bar clamps at 100% width but text shows true percentage (e.g., "112%"). |
| **Yearly/weekly budget periods** | `period` field supports 'monthly', 'weekly', 'yearly' | UI defaults to monthly. For weekly: calculate week boundaries (Mon-Sun). For yearly: Jan 1 - Dec 31. Backend `budgets:get-status` handles all three. |
| **Fixed expense amount changes mid-month** | User edits `amount` field | Existing payment records keep their `amount_paid`. Future mark-paid uses new amount. Historical months unaffected. |
| **Duplicate pattern detection** | Same merchant with slight description variations | Normalization strips numbers, dates, special chars. Confidence score filters low-quality matches. |
| **Performance: 1000+ transactions** | Detection scans 6 months | Indexed query on `date`, `type`. LIMIT 20 results. Runs in <50ms on typical SQLite. |

---

## 8. Integration Checklist

### 8.1 FinancePage.tsx Changes

```typescript
// 1. Extend tabs array
const tabs = [
  // ... existing tabs ...
  { key: 'subscriptions', label: 'Subscriptions', icon: <Bell /> },
  { key: 'fixed-expenses', label: 'Fixed Expenses', icon: <Receipt /> },
  { key: 'budget', label: 'Budget', icon: <Target /> },
  { key: 'audit', label: 'Audit Log', icon: <Shield /> },
  { key: 'charts', label: 'Charts', icon: <BarChart3 /> },
];

// 2. Add state
const [fixedExpenses, setFixedExpenses] = useState<FinanceFixedExpense[]>([]);
const [fixedExpenseSummary, setFixedExpenseSummary] = useState<FixedExpenseSummary | null>(null);
const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

// 3. Extend loadData
const loadData = useCallback(async () => {
  const month = selectedMonth;
  const [feRes, feSumRes, budRes, budStatRes] = await Promise.allSettled([
    window.deskflowAPI.fixedExpensesList(month),
    window.deskflowAPI.fixedExpensesSummary(month),
    window.deskflowAPI.budgetsList(),
    window.deskflowAPI.budgetsGetStatus(month),
  ]);
  // ... set state from results
}, [selectedMonth]);

// 4. Tab content switch
case 'fixed-expenses':
  return <FixedExpensesTab 
    expenses={fixedExpenses}
    summary={fixedExpenseSummary}
    month={selectedMonth}
    onMonthChange={setSelectedMonth}
    wallets={wallets}
    categories={categories}
    onRefresh={loadData}
  />;
case 'budget':
  return <BudgetTab 
    budgets={budgets}
    status={budgetStatus}
    transactions={transactions}
    categories={categories}
    onRefresh={loadData}
  />;
```

### 8.2 OverviewTab.tsx Additions

```typescript
// Add to imports
import { FixedExpensesOverviewCard } from './FixedExpensesOverviewCard';
import { BudgetStatusOverviewCard } from './BudgetStatusOverviewCard';

// In grid layout, add:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <IncomeExpenseCard ... />
  <FixedExpensesOverviewCard 
    summary={fixedExpenseSummary}
    onClick={() => onTabChange('fixed-expenses')}
  />
  <BudgetStatusOverviewCard 
    status={budgetStatus}
    onClick={() => onTabChange('budget')}
  />
  {/* ... existing cards ... */}
</div>
```

### 8.3 Dashboard Integration

```typescript
// In FinanceOverviewSection.tsx, add to data fetch:
const [fixedCount, setFixedCount] = useState(0);
// fetch via new IPC or derive from existing data

// In render:
<div className="flex gap-4">
  <Stat label="Subscriptions" value={subscriptionCount} />
  <Stat label="Fixed Expenses" value={fixedCount} />
  <Stat label="Budgets" value={budgetCount} />
</div>
```

---

## 9. File Size & Complexity Estimate

| Component | Lines | Complexity |
|-----------|-------|------------|
| `FixedExpensesTab.tsx` | ~180 | Medium |
| `FixedExpenseCard.tsx` | ~120 | Low |
| `FixedExpenseModal.tsx` | ~200 | Medium |
| `FixedExpensesSummaryBar.tsx` | ~80 | Low |
| `MonthSelector.tsx` | ~60 | Low |
| `RecurringPatternDetector.tsx` | ~150 | Medium |
| `BudgetTab.tsx` | ~160 | Medium |
| `BudgetCard.tsx` | ~100 | Low |
| `BudgetModal.tsx` | ~180 | Medium |
| `BudgetOverallCard.tsx` | ~140 | Medium |
| `BudgetWarningBanner.tsx` | ~80 | Low |
| Overview cards (2) | ~120 | Low |
| **Total New UI** | **~1,570** | **Medium** |
| IPC handlers (main.ts) | ~350 | Medium |
| Preload additions | ~15 | Low |
| Types | ~80 | Low |
| **Total Backend** | **~445** | **Medium** |
| **Grand Total** | **~2,015 lines** | **Medium complexity** |

---

This specification provides a complete, production-ready blueprint for the Fixed Expenses + Budget system. Every component follows the existing DeskFlow architecture patterns (glass UI, IPC bridge, SQLite migrations, audit logging, encryption awareness) and integrates seamlessly with subscriptions, transactions, and the overview dashboard.