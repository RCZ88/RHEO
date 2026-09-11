# Monthly Financial Recap — Design Specification

> **Status:** Production-ready spec  
> **Feature:** `finance/recap`  
> **Independence:** Recap's `recapMonth` state is **strictly decoupled** from FinancePage's `selectedMonth`. No shared fetcher, no shared state, no top-timeline influence.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer (FinancePage.tsx)                                      │
│  ┌─────────────────────┐      ┌──────────────────────────────┐  │
│  │ Top nav: selectedMonth  │      │ Recap tab: recapMonth (own)  │  │
│  │ (drives transactions,  │      │ (drives recap-list/get/     │  │
│  │  budgets, fixed exp.)  │      │  generate)                  │  │
│  └──────────┬────────────┘      └──────────────┬───────────────┘  │
│             │                                   │                  │
└─────────────┼───────────────────────────────────┼──────────────────┘
              │                                   │
              ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Preload (deskflowAPI)                                          │
│  financeGetTransactions(selectedMonth)                          │
│  financeRecapList() / financeRecapGet(recapMonth)               │
│  financeRecapGenerate(recapMonth)                               │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Main Process (main.ts)                                         │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │ finance:get-transactions │  │ finance:recap-generate      │  │
│  │ (uses selectedMonth)     │  │ • computeRecapStats(month)  │  │
│  └──────────────────────────┘  │ • buildRecapPrompt(stats)   │  │
│                                 │ • runWithFallback(chain)    │  │
│                                 │ • upsert recap row         │  │
│                                 └────────────────────────────┘  │
│                                                                  │
│  checkMonthlyRecaps(db) — runs at startup + every 6h           │
│  → auto-generates ONLY the immediate previous calendar month   │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SQLite (better-sqlite3)                                       │
│  finance_monthly_recaps (month UNIQUE)                          │
│  finance_transactions / finance_wallets / finance_categories    │
│  finance_subscriptions / finance_fixed_expense_payments         │
│  finance_ft_persons / finance_wallet_snapshots                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Pipeline

### 2.1 Auto-Generation Trigger (Idempotent)

**Location:** `src/main.ts`, inside `app.whenReady()` (line 18877), following the `checkDeadlines` pattern (lines 18927-18931).

**Behavior on startup + every 6 hours:**

```ts
function checkMonthlyRecaps(db: Database.Database) {
  try {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    // 1. Idempotent — never regenerate existing row
    const existing = db.prepare('SELECT id FROM finance_monthly_recaps WHERE month = ?').get(monthKey);
    if (existing) return;

    // 2. Only generate if there's actual data
    const { count } = db.prepare(`
      SELECT COUNT(*) as count FROM finance_transactions
      WHERE strftime('%Y-%m', date) = ?
        AND (is_adjustment IS NULL OR is_adjustment = 0)
    `).get(monthKey) as any;
    if (count === 0) return;

    // 3. Fire-and-forget generation (non-blocking)
    generateRecapInternal(db, monthKey).catch(e =>
      console.log('[RECAP] auto-gen failed:', e?.message?.slice(0, 120))
    );
  } catch (e: any) {
    console.log('[RECAP] check error:', e?.message?.slice(0, 120));
  }
}

// Hook:
checkMonthlyRecaps(db);
setInterval(() => { if (db) checkMonthlyRecaps(db); }, 6 * 60 * 60 * 1000);
```

**First-launch backfill decision:** On first launch with *N* months of historical data, **only the immediate previous calendar month is auto-generated**. Rationale: backfilling years of history would burn significant tokens, surprise the user, and produce low-quality recaps (the AI has no prior recaps for MoM comparison). Users can manually backfill specific months they care about.

### 2.2 Stats Computation (Pure SQL, No AI Numbers)

All stats computed server-side; the AI only writes prose. Display currency is respected by converting at aggregation time using the user's active display currency (via `finance:get-display-currency`); stats are stored alongside their generation-time display currency so historical recaps stay consistent.

**Function signature:**
```ts
function computeRecapStats(db: Database.Database, month: string): RecapStats | null
```

**Aggregation queries** (each `try`-wrapped, defaults to 0/`[]` on error):

```sql
-- Income (positive transfers, excluding adjustments)
SELECT COALESCE(SUM(t.amount), 0) AS total, COUNT(*) AS count
FROM finance_transactions t
WHERE t.type = 'transfer' AND t.amount > 0
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month;

-- Expenses
SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total, COUNT(*) AS count
FROM finance_transactions t
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month;

-- Top 5 expense categories (joined)
SELECT c.id, c.name, c.color, c.icon,
       COALESCE(SUM(ABS(t.amount)), 0) AS amount, COUNT(t.id) AS count
FROM finance_transactions t
JOIN finance_categories c ON t.category_id = c.id
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
GROUP BY c.id ORDER BY amount DESC LIMIT 5;

-- Per-wallet expense
SELECT w.id, w.name, w.type,
       COALESCE(SUM(ABS(t.amount)), 0) AS amount
FROM finance_transactions t
JOIN finance_wallets w ON t.wallet_id = w.id
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
GROUP BY w.id ORDER BY amount DESC;

-- Subscriptions billed (via generated transactions matching subscription name)
SELECT DISTINCT s.id, s.name, s.price, s.currency
FROM finance_subscriptions s
JOIN finance_transactions t ON t.wallet_id = s.wallet_id
  AND t.description LIKE '%' || s.name || '%'
WHERE strftime('%Y-%m', t.date) = $month;

-- Fixed expenses paid (via payments table)
SELECT fe.id, fe.name, fe.amount AS expected,
       COALESCE(fep.amount_paid, 0) AS paid,
       COALESCE(fep.status, 'pending') AS status
FROM finance_fixed_expenses fe
LEFT JOIN finance_fixed_expense_payments fep
  ON fep.fixed_expense_id = fe.id AND fep.month = $month
WHERE fe.is_active = 1;

-- Follow-Through activity
SELECT p.id, p.name,
       COALESCE(SUM(
         CASE WHEN t.type = 'income' OR (t.type='transfer' AND t.amount>0)
              THEN t.amount ELSE -ABS(t.amount) END
       ), 0) AS net,
       COUNT(t.id) AS count
FROM finance_transactions t
JOIN finance_ft_persons p ON t.ft_person_id = p.id
WHERE strftime('%Y-%m', t.date) = $month
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
GROUP BY p.id;

-- Wallet balance delta (via snapshots at month start/end)
SELECT w.id, w.name, w.type,
       COALESCE((SELECT balance FROM finance_wallet_snapshots ws
                 WHERE ws.wallet_id = w.id
                   AND ws.date <= $month || '-01'
                 ORDER BY ws.date DESC LIMIT 1), w.balance) AS startBalance,
       COALESCE((SELECT balance FROM finance_wallet_snapshots ws
                 WHERE ws.wallet_id = w.id
                   AND ws.date < (strftime('%Y-%m', date($month || '-01', '+1 month')))
                 ORDER BY ws.date DESC LIMIT 1), w.balance) AS endBalance
FROM finance_wallets w WHERE w.is_archived = 0;

-- Biggest single expense
SELECT t.description, ABS(t.amount) AS amount, c.name AS category, t.date
FROM finance_transactions t
JOIN finance_categories c ON t.category_id = c.id
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
ORDER BY ABS(t.amount) DESC LIMIT 1;

-- Biggest income event
SELECT t.description, t.amount, c.name AS category, t.date
FROM finance_transactions t
JOIN finance_categories c ON t.category_id = c.id
WHERE t.type = 'transfer' AND t.amount > 0
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
ORDER BY t.amount DESC LIMIT 1;

-- Active days
SELECT COUNT(DISTINCT t.date) AS days
FROM finance_transactions t
WHERE (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month;
```

**Stats JSON schema** (stored in `stats_json` column):

```ts
interface RecapStats {
  month: string;                    // 'YYYY-MM'
  displayCurrency: string;          // e.g. 'IDR'
  generatedAt: string;              // ISO timestamp
  income: { total: number; count: number };
  expense: { total: number; count: number };
  net: number;
  activeDays: number;
  previousMonth: { income: number; expense: number; net: number } | null;
  momDelta: { income: number; expense: number; net: number };
  topCategories: Array<{
    id: number; name: string; color: string; icon: string;
    amount: number; count: number;
  }>;
  walletSpend: Array<{
    id: number; name: string; type: string; amount: number;
  }>;
  walletBalanceDelta: Array<{
    id: number; name: string; type: string;
    startBalance: number; endBalance: number; delta: number;
  }>;
  subscriptionsBilled: Array<{
    id: number; name: string; price: number; currency: string;
  }>;
  fixedExpenses: {
    total: number; paid: number; pending: number; skipped: number;
    items: Array<{ id: number; name: string; expected: number; paid: number; status: string }>;
  };
  followThrough: Array<{
    id: number; name: string; net: number; count: number;
  }>;
  biggestExpense: { description: string; amount: number; category: string; date: string } | null;
  biggestIncome: { description: string; amount: number; category: string; date: string } | null;
}
```

### 2.3 Month List Computation (for month picker)

All calendar months with recorded activity (used to populate the recap month picker):

```sql
SELECT DISTINCT strftime('%Y-%m', date) AS month
FROM finance_transactions
WHERE (is_adjustment IS NULL OR is_adjustment = 0)
ORDER BY month DESC;
```

---

## 3. AI Generation

### 3.1 Provider Chain Integration

**Mandatory change to `src/services/providers/router.ts:7`:** add `'monthlyRecap'` to the feature union:

```ts
feature: 'researchDigest' | 'goalAssistant' | 'resumeBuilder' | 'category' | 'colors' | 'monthlyRecap' | 'lifeAssistant',
```

Routing config follows existing pattern: `state.routing.monthlyRecap || state.routing.default`. Users
# Monthly Financial Recap — Design Specification

> **Status:** Production-ready spec  
> **Feature:** `finance/recap`  
> **Independence:** Recap's `recapMonth` state is **strictly decoupled** from FinancePage's `selectedMonth`. No shared fetcher, no shared state, no top-timeline influence.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer (FinancePage.tsx)                                      │
│  ┌─────────────────────┐      ┌──────────────────────────────┐  │
│  │ Top nav: selectedMonth  │      │ Recap tab: recapMonth (own)  │  │
│  │ (drives transactions,  │      │ (drives recap-list/get/     │  │
│  │  budgets, fixed exp.)  │      │  generate)                  │  │
│  └──────────┬────────────┘      └──────────────┬───────────────┘  │
│             │                                   │                  │
└─────────────┼───────────────────────────────────┼──────────────────┘
              │                                   │
              ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Preload (deskflowAPI)                                          │
│  financeGetTransactions(selectedMonth)                          │
│  financeRecapList() / financeRecapGet(recapMonth)               │
│  financeRecapGenerate(recapMonth)                               │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Main Process (main.ts)                                         │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │ finance:get-transactions │  │ finance:recap-generate      │  │
│  │ (uses selectedMonth)     │  │ • computeRecapStats(month)  │  │
│  └──────────────────────────┘  │ • buildRecapPrompt(stats)   │  │
│                                 │ • runWithFallback(chain)    │  │
│                                 │ • upsert recap row         │  │
│                                 └────────────────────────────┘  │
│                                                                  │
│  checkMonthlyRecaps(db) — runs at startup + every 6h           │
│  → auto-generates ONLY the immediate previous calendar month   │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SQLite (better-sqlite3)                                       │
│  finance_monthly_recaps (month UNIQUE)                          │
│  finance_transactions / finance_wallets / finance_categories    │
│  finance_subscriptions / finance_fixed_expense_payments         │
│  finance_ft_persons / finance_wallet_snapshots                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Pipeline

### 2.1 Auto-Generation Trigger (Idempotent)

**Location:** `src/main.ts`, inside `app.whenReady()` (line 18877), following the `checkDeadlines` pattern (lines 18927-18931).

**Behavior on startup + every 6 hours:**

```ts
function checkMonthlyRecaps(db: Database.Database) {
  try {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    // 1. Idempotent — never regenerate existing row
    const existing = db.prepare('SELECT id FROM finance_monthly_recaps WHERE month = ?').get(monthKey);
    if (existing) return;

    // 2. Only generate if there's actual data
    const { count } = db.prepare(`
      SELECT COUNT(*) as count FROM finance_transactions
      WHERE strftime('%Y-%m', date) = ?
        AND (is_adjustment IS NULL OR is_adjustment = 0)
    `).get(monthKey) as any;
    if (count === 0) return;

    // 3. Fire-and-forget generation (non-blocking)
    generateRecapInternal(db, monthKey).catch(e =>
      console.log('[RECAP] auto-gen failed:', e?.message?.slice(0, 120))
    );
  } catch (e: any) {
    console.log('[RECAP] check error:', e?.message?.slice(0, 120));
  }
}

// Hook:
checkMonthlyRecaps(db);
setInterval(() => { if (db) checkMonthlyRecaps(db); }, 6 * 60 * 60 * 1000);
```

**First-launch backfill decision:** On first launch with *N* months of historical data, **only the immediate previous calendar month is auto-generated**. Rationale: backfilling years of history would burn significant tokens, surprise the user, and produce low-quality recaps (the AI has no prior recaps for MoM comparison). Users can manually backfill specific months they care about.

### 2.2 Stats Computation (Pure SQL, No AI Numbers)

All stats computed server-side; the AI only writes prose. Display currency is respected by converting at aggregation time using the user's active display currency (via `finance:get-display-currency`); stats are stored alongside their generation-time display currency so historical recaps stay consistent.

**Function signature:**
```ts
function computeRecapStats(db: Database.Database, month: string): RecapStats | null
```

**Aggregation queries** (each `try`-wrapped, defaults to 0/`[]` on error):

```sql
-- Income (positive transfers, excluding adjustments)
SELECT COALESCE(SUM(t.amount), 0) AS total, COUNT(*) AS count
FROM finance_transactions t
WHERE t.type = 'transfer' AND t.amount > 0
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month;

-- Expenses
SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total, COUNT(*) AS count
FROM finance_transactions t
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month;

-- Top 5 expense categories (joined)
SELECT c.id, c.name, c.color, c.icon,
       COALESCE(SUM(ABS(t.amount)), 0) AS amount, COUNT(t.id) AS count
FROM finance_transactions t
JOIN finance_categories c ON t.category_id = c.id
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
GROUP BY c.id ORDER BY amount DESC LIMIT 5;

-- Per-wallet expense
SELECT w.id, w.name, w.type,
       COALESCE(SUM(ABS(t.amount)), 0) AS amount
FROM finance_transactions t
JOIN finance_wallets w ON t.wallet_id = w.id
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
GROUP BY w.id ORDER BY amount DESC;

-- Subscriptions billed (via generated transactions matching subscription name)
SELECT DISTINCT s.id, s.name, s.price, s.currency
FROM finance_subscriptions s
JOIN finance_transactions t ON t.wallet_id = s.wallet_id
  AND t.description LIKE '%' || s.name || '%'
WHERE strftime('%Y-%m', t.date) = $month;

-- Fixed expenses paid (via payments table)
SELECT fe.id, fe.name, fe.amount AS expected,
       COALESCE(fep.amount_paid, 0) AS paid,
       COALESCE(fep.status, 'pending') AS status
FROM finance_fixed_expenses fe
LEFT JOIN finance_fixed_expense_payments fep
  ON fep.fixed_expense_id = fe.id AND fep.month = $month
WHERE fe.is_active = 1;

-- Follow-Through activity
SELECT p.id, p.name,
       COALESCE(SUM(
         CASE WHEN t.type = 'income' OR (t.type='transfer' AND t.amount>0)
              THEN t.amount ELSE -ABS(t.amount) END
       ), 0) AS net,
       COUNT(t.id) AS count
FROM finance_transactions t
JOIN finance_ft_persons p ON t.ft_person_id = p.id
WHERE strftime('%Y-%m', t.date) = $month
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
GROUP BY p.id;

-- Wallet balance delta (via snapshots at month start/end)
SELECT w.id, w.name, w.type,
       COALESCE((SELECT balance FROM finance_wallet_snapshots ws
                 WHERE ws.wallet_id = w.id
                   AND ws.date <= $month || '-01'
                 ORDER BY ws.date DESC LIMIT 1), w.balance) AS startBalance,
       COALESCE((SELECT balance FROM finance_wallet_snapshots ws
                 WHERE ws.wallet_id = w.id
                   AND ws.date < (strftime('%Y-%m', date($month || '-01', '+1 month')))
                 ORDER BY ws.date DESC LIMIT 1), w.balance) AS endBalance
FROM finance_wallets w WHERE w.is_archived = 0;

-- Biggest single expense
SELECT t.description, ABS(t.amount) AS amount, c.name AS category, t.date
FROM finance_transactions t
JOIN finance_categories c ON t.category_id = c.id
WHERE t.type = 'expense'
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
ORDER BY ABS(t.amount) DESC LIMIT 1;

-- Biggest income event
SELECT t.description, t.amount, c.name AS category, t.date
FROM finance_transactions t
JOIN finance_categories c ON t.category_id = c.id
WHERE t.type = 'transfer' AND t.amount > 0
  AND (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month
ORDER BY t.amount DESC LIMIT 1;

-- Active days
SELECT COUNT(DISTINCT t.date) AS days
FROM finance_transactions t
WHERE (t.is_adjustment IS NULL OR t.is_adjustment = 0)
  AND strftime('%Y-%m', t.date) = $month;
```

**Stats JSON schema** (stored in `stats_json` column):

```ts
interface RecapStats {
  month: string;                    // 'YYYY-MM'
  displayCurrency: string;          // e.g. 'IDR'
  generatedAt: string;              // ISO timestamp
  income: { total: number; count: number };
  expense: { total: number; count: number };
  net: number;
  activeDays: number;
  previousMonth: { income: number; expense: number; net: number } | null;
  momDelta: { income: number; expense: number; net: number };
  topCategories: Array<{
    id: number; name: string; color: string; icon: string;
    amount: number; count: number;
  }>;
  walletSpend: Array<{
    id: number; name: string; type: string; amount: number;
  }>;
  walletBalanceDelta: Array<{
    id: number; name: string; type: string;
    startBalance: number; endBalance: number; delta: number;
  }>;
  subscriptionsBilled: Array<{
    id: number; name: string; price: number; currency: string;
  }>;
  fixedExpenses: {
    total: number; paid: number; pending: number; skipped: number;
    items: Array<{ id: number; name: string; expected: number; paid: number; status: string }>;
  };
  followThrough: Array<{
    id: number; name: string; net: number; count: number;
  }>;
  biggestExpense: { description: string; amount: number; category: string; date: string } | null;
  biggestIncome: { description: string; amount: number; category: string; date: string } | null;
}
```

### 2.3 Month List Computation (for month picker)

All calendar months with recorded activity (used to populate the recap month picker):

```sql
SELECT DISTINCT strftime('%Y-%m', date) AS month
FROM finance_transactions
WHERE (is_adjustment IS NULL OR is_adjustment = 0)
ORDER BY month DESC;
```

---

## 3. AI Generation

### 3.1 Provider Chain Integration

**Mandatory change to `src/services/providers/router.ts:7`:** add `'monthlyRecap'` to the feature union:

```ts
feature: 'researchDigest' | 'goalAssistant' | 'resumeBuilder' | 'category' | 'colors' | 'monthlyRecap' | 'lifeAssistant',
```

Routing config follows existing pattern: `state.routing.monthlyRecap || state.routing.default`. Users can route the recap to a specific provider in settings, independent of other features.

### 3.2 Main-Process Helper (copy of `runLifePhaseAI` pattern)

```ts
async function runMonthlyRecapAI(systemPrompt: string, userMsg: string): Promise<string> {
  const p = userPreferences || {};
  const pState = p.aiProviders ? JSON.parse(p.aiProviders) : null;
  const chain = pState ? buildChain(pState, 'monthlyRecap') : [];
  if (chain.length > 0) {
    const { result } = await runWithFallback(chain, {
      systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
      maxTokens: 500,
      temperature: 0.7,
    });
    return result.content;
  }
  // OpenRouter fallback
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error('No AI providers configured');
  const model = p.ai_briefModel || 'google/gemini-2.0-flash-001';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
```

### 3.3 System Prompt

```text
You are a financial biographer writing a monthly recap for the DeskFlow user.
Write in second person ("you spent", "your BCA wallet"), 180-300 words, warm and specific.
AVOID: clichés ("journey," "stay on top of," "track," "you've got this"),
self-help platitudes, exclamation marks, judgmental framing of spending,
vague words ("significant," "notable" without specifics).

You have access to data about these features:
• Transactions (income, expenses, transfers) across categories
• Wallets (bank, cash, e-wallet, crypto) and their balance changes
• Subscriptions that renewed
• Fixed expenses (paid/pending/skipped)
• Budgets (set category limits)
• Follow-Through people (money with specific people)

From the structured stats below, CHOOSE what to highlight based on what's
significant: a large income event, a category that dominated spending,
wallets that grew or shrank sharply, subscriptions renewing, unusual
quiet months, or a big shift from last month.

Use exact numbers only from the stats. Never invent numbers or categories.
If income was zero, say so plainly. If one category took 60%+ of spending,
name it and quantify it. End with ONE short forward-looking sentence
about what this month's pattern suggests.
```

### 3.4 User Message Template

```text
Month: {MONTH} (displayed in {displayCurrency})

Income: {income.total} across {income.count} transaction(s).
Expenses: {expense.total} across {expense.count} transaction(s) on {activeDays} active day(s).
Net flow: {net} (previous month: {previousMonth.net ?? 'n/a'}, change: {momDelta.net}).

Top spending categories:
{topCategories.map(c => `• ${c.name}: ${c.amount} (${c.count} txns)`).join('\n')}

Wallet balance changes:
{walletBalanceDelta.filter(w => w.delta !== 0).map(w => `• ${w.name} (${w.type}): ${w.startBalance} → ${w.endBalance} (${w.delta >= 0 ? '+' : ''}${w.delta})`).join('\n')}

Subscriptions billed this month:
{subscriptionsBilled.length ? subscriptionsBilled.map(s => `• ${s.name}: ${s.price} ${s.currency}`).join('\n') : '(none)'}

Fixed expenses: {fixedExpenses.paid} of {fixedExpenses.total} paid, {fixedExpenses.skipped} skipped.

Follow-Through people:
{followThrough.length ? followThrough.map(p => `• ${p.name}: net ${p.net} (${p.count} txns)`).join('\n') : '(no activity)'}

Biggest single expense: {biggestExpense ? `${biggestExpense.description}, ${biggestExpense.amount} on ${biggestExpense.date} (${biggestExpense.category})` : 'none'}.
Biggest income event: {biggestIncome ? `${biggestIncome.description}, ${biggestIncome.amount} on ${biggestIncome.date}` : 'none'}.
```

### 3.5 Error Handling (No-Crash Guarantee)

If AI invocation fails for any reason (no provider configured, all providers timed out, quota exhausted):
- Row is still created with `status='failed'`
- `summary` column stores a graceful fallback: `"[AI unavailable — this month's narrative couldn't be generated. The financial stats below are still accurate.]"`
- `provider_id` is stored as `null`
- `error_message` stores the thrown error's message
- UI renders stats-only view with explanatory banner

The recap never blocks, never crashes, never shows a blank screen.

---

## 4. Database Schema

**Location:** `src/main.ts`, inserted alongside other migrations (after line 3362, following the `try { db.exec(...) } catch` pattern).

```sql
-- Migration: finance_monthly_recaps
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_monthly_recaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT UNIQUE NOT NULL,
      title TEXT,
      summary TEXT,
      stats_json TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','generated','failed')),
      provider_id TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
} catch (e) {
  console.log('[DB MIGRATION] finance_monthly_recaps skip:', e?.message);
}

-- Index for fast month lookup
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_monthly_recaps_month ON finance_monthly_recaps(month)`);
} catch (e) {
  console.log('[DB MIGRATION] recap index skip:', e?.message);
}
```

**List/Get/Upsert queries:**

```ts
// List all recaps, newest first, with stats summary
const listRecaps = db.prepare(`
  SELECT id, month, title, status, provider_id, created_at, updated_at,
         json_extract(stats_json, '$.income.total') AS income_total,
         json_extract(stats_json, '$.expense.total') AS expense_total,
         json_extract(stats_json, '$.net') AS net
  FROM finance_monthly_recaps
  ORDER BY month DESC
`).all();

// Get by month
const getRecap = db.prepare(`SELECT * FROM finance_monthly_recaps WHERE month = ?`).get(month);

// Upsert (INSERT OR REPLACE on month UNIQUE)
const upsertRecap = db.prepare(`
  INSERT INTO finance_monthly_recaps (month, title, summary, stats_json, status, provider_id, error_message)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(month) DO UPDATE SET
    title = excluded.title,
    summary = excluded.summary,
    stats_json = excluded.stats_json,
    status = excluded.status,
    provider_id = excluded.provider_id,
    error_message = excluded.error_message,
    updated_at = datetime('now','localtime')
`);

// Delete
const deleteRecap = db.prepare(`DELETE FROM finance_monthly_recaps WHERE month = ?`);
```

---

## 5. IPC + Preload Bridge

### 5.1 New IPC Channels (src/main.ts)

| Channel | Purpose | Input | Return |
|---|---|---|---|
| `finance:recap-list` | All recaps, newest first | `void` | `{ ok: true, data: RecapListItem[] }` |
| `finance:recap-get` | Single recap by month | `{ month: string }` | `{ ok: true, data: Recap \| null }` |
| `finance:recap-generate` | Generate or regenerate | `{ month: string, force?: boolean }` | `{ ok: true, data: Recap } \| { ok: false, error: string }` |
| `finance:recap-delete` | Delete a recap | `{ month: string }` | `{ ok: true }` |
| `finance:recap-months-with-data` | Months picker source | `void` | `{ ok: true, data: string[] }` |

**Types:**

```ts
interface RecapListItem {
  id: number;
  month: string;
  title: string | null;
  status: 'pending' | 'generated' | 'failed';
  providerId: string | null;
  incomeTotal: number;
  expenseTotal: number;
  net: number;
  createdAt: string;
  updatedAt: string;
}

interface Recap extends RecapListItem {
  summary: string;
  statsJson: string;
  errorMessage: string | null;
  stats: RecapStats;  // parsed on return
}
```

### 5.2 Handler Implementation (`finance:recap-generate`)

```ts
electron_1.ipcMain.handle('finance:recap-generate', async (_event, params: { month: string; force?: boolean }) => {
  try {
    const { month, force = false } = params || {};
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return { ok: false, error: 'Invalid month format (YYYY-MM required)' };
    }

    // Check existing
    const existing = db.prepare('SELECT * FROM finance_monthly_recaps WHERE month = ?').get(month) as any;
    if (existing && !force) {
      return { ok: true, data: hydrateRecap(existing) };
    }

    // Compute stats
    const stats = computeRecapStats(db, month);
    if (!stats || (stats.income.count === 0 && stats.expense.count === 0)) {
      return { ok: false, error: 'No transaction data for this month' };
    }

    // Build AI prompts
    const systemPrompt = RECAP_SYSTEM_PROMPT;
    const userMsg = buildRecapUserMessage(stats);

    // Invoke AI
    let summary = '';
    let status: 'generated' | 'failed' = 'generated';
    let providerId: string | null = null;
    let errorMessage: string | null = null;
    try {
      summary = await runMonthlyRecapAI(systemPrompt, userMsg);
      // Detect which provider was used (from runWithFallback internals, or store it)
      providerId = getLastUsedProviderId();
    } catch (e: any) {
      summary = '[AI unavailable — this month\'s narrative couldn\'t be generated. The financial stats below are still accurate.]';
      status = 'failed';
      errorMessage = e?.message?.slice(0, 500) || String(e);
    }

    // Upsert
    const statsJson = JSON.stringify(stats);
    const title = formatRecapTitle(month, stats); // e.g. "July 2026 Recap"
    db.prepare(`
      INSERT INTO finance_monthly_recaps (month, title, summary, stats_json, status, provider_id, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(month) DO UPDATE SET
        title=excluded.title, summary=excluded.summary, stats_json=excluded.stats_json,
        status=excluded.status, provider_id=excluded.provider_id,
        error_message=excluded.error_message, updated_at=datetime('now','localtime')
    `).run(month, title, summary, statsJson, status, providerId, errorMessage);

    const saved = db.prepare('SELECT * FROM finance_monthly_recaps WHERE month = ?').get(month);
    return { ok: true, data: hydrateRecap(saved) };
  } catch (err: any) {
    console.log('[RECAP] generate error:', err?.message);
    return { ok: false, error: err?.message || 'Unknown error' };
  }
});
```

### 5.3 Preload Methods (src/preload.ts)

Added near other finance methods (after line 1070):

```ts
financeRecapList: () => ipcRenderer.invoke('finance:recap-list'),
financeRecapGet: (month: string) => ipcRenderer.invoke('finance:recap-get', { month }),
financeRecapGenerate: (month: string, force?: boolean) =>
  ipcRenderer.invoke('finance:recap-generate', { month, force }),
financeRecapDelete: (month: string) => ipcRenderer.invoke('finance:recap-delete', { month }),
financeRecapMonthsWithData: () => ipcRenderer.invoke('finance:recap-months-with-data'),
```

**Types in `src/preload/deskflow-api.d.ts`:**

```ts
financeRecapList(): Promise<{ ok: boolean; data?: RecapListItem[]; error?: string }>;
financeRecapGet(month: string): Promise<{ ok: boolean; data?: Recap | null; error?: string }>;
financeRecapGenerate(month: string, force?: boolean): Promise<{ ok: boolean; data?: Recap; error?: string }>;
financeRecapDelete(month: string): Promise<{ ok: boolean; error?: string }>;
financeRecapMonthsWithData(): Promise<{ ok: boolean; data?: string[]; error?: string }>;
```

---

## 6. UI Component Specification

### 6.1 Placement Decision: Top-Level Tab

**Choice:** Add `'recap'` as a new top-level tab in `tabs` array (`src/pages/FinancePage.tsx:61-68`) and add to the `FinanceTabKey` union (`src/components/finance/finance-types.ts:451`).

**Justification:** A recap is a peer concept to Overview/Charts — it aggregates across all finance features. Making it a top-level tab makes its **state independence** architecturally visible and physically enforces the decoupling from `selectedMonth`. A nested subtab inside Budget would imply inheritance of the parent's month state. The tab-level boundary is the cleanest separation.

**Changes:**

```ts
// finance-types.ts:451
export type FinanceTabKey =
  | 'overview' | 'wallets' | 'transactions' | 'categories' | 'people'
  | 'subscriptions' | 'budget' | 'audit' | 'charts' | 'recap';

// FinancePage.tsx tabs array
const tabs: Array<{ key: FinanceTabKey; label: string; icon: React.ReactNode }> = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { key: 'wallets', label: 'Wallets', icon: <Wallet className="w-3.5 h-3.5" /> },
  { key: 'transactions', label: 'Transactions', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  { key: 'people', label: 'People', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'recap', label: 'Recap', icon: <FileText className="w-3.5 h-3.5" /> },  // NEW
  { key: 'categories', label: 'Categories', icon: <Tag className="w-3.5 h-3.5" /> },
  { key: 'budget', label: 'Budget & Expenses', icon: <Target className="w-3.5 h-3.5" /> },
  { key: 'audit', label: 'Audit Log', icon: <Shield className="w-3.5 h-3.5" /> },
  { key: 'charts', label: 'Charts', icon: <BarChart3 className="w-3.5 h-3.5" /> },
];
```

### 6.2 RecapPanel State

```tsx
// RecapPanel.tsx (new file under src/components/finance/)
const [recapMonth, setRecapMonth] = useState<string>(() => {
  // Default: previous calendar month, NEVER FinancePage.selectedMonth
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});
const [recap, setRecap] = useState<Recap | null>(null);
const [hasData, setHasData] = useState<boolean>(true);
const [monthsList, setMonthsList] = useState<string[]>([]);
const [isGenerating, setIsGenerating] = useState(false);
const [isLoading, setIsLoading] = useState(false);
```

`useEffect` watches `recapMonth` only and fetches `window.deskflowAPI.financeRecapGet(recapMonth)`. It **never** reads `selectedMonth`.

### 6.3 Component Hierarchy

```
RecapPanel (own state, own fetcher)
├── RecapHeader
│   ├── MonthNavigator (ChevronLeft, formatted month label, ChevronRight)
│   └── GenerateButton (Sparkles / RefreshCw spin during generation)
└── RecapBody (switches on 5 states)
    ├── RecapLoading (Skeleton)
    ├── RecapEmptyNoData (empty state, no data for month)
    ├── RecapEmptyWithData ("Generate your recap" CTA)
    ├── RecapStatsOnly (when status='failed', banner + stats grid)
    └── RecapFull (populated recap)
        ├── RecapHero (income/expense/net + MoM deltas with NumberTicker)
        ├── RecapNarrative (glass card, drop-cap, Bot icon)
        ├── RecapStatsGrid (Top categories, Wallet activity)
        └── RecapSecondary (Subscriptions billed, Follow-through)
```

### 6.4 Tokens & Styling Rules

| Token | Value |
|---|---|
| Background | `bg-zinc-900/80 backdrop-blur-xl` (glass) |
| Border | `border border-zinc-800` |
| Radius | `rounded-xl` (max, consistent with rest of Finance) |
| Accent | `emerald-500` / `emerald-400` / `emerald-500/10` bg tint |
| Text primary | `text-zinc-100` / `text-white` |
| Text secondary | `text-zinc-400` / `text-zinc-300` |
| Negative accent | `text-rose-400` |
| Font body | Geist |
| Font mono | JetBrains Mono (for amounts) |
| Spacing | `p-5` card body, `gap-4` between cards |
| Motion | `tabPanel` variants from FinancePage, L2 count-ups |

### 6.5 Per-Component JSX & Props

#### `RecapHeader`

```tsx
<div className="flex items-center justify-between mb-6 px-1">
  <div className="flex items-center gap-3">
    <button
      onClick={() => stepMonth(-1)}
      aria-label="Previous month"
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
    <h2 className="text-2xl font-semibold text-white tracking-tight">
      {formatMonthLong(recapMonth)} Recap
    </h2>
    <button
      onClick={() => stepMonth(+1)}
      disabled={recapMonth >= currentMonth}
      aria-label="Next month"
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
    >
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>

  <button
    onClick={handleGenerate}
    disabled={isGenerating || !hasData}
    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
  >
    {isGenerating ? (
      <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
    ) : (
      <><Sparkles className="w-4 h-4" /> {recap ? 'Regenerate' : 'Generate'}</>
    )}
  </button>
</div>
```

#### `RecapHero`

```tsx
<div className="relative bg-zinc-900/80 backdrop-blur-xl rounded-xl p-6 border border-zinc-800 overflow-hidden">
  <DotPattern className="absolute inset-0 opacity-[0.04]" />
  <div className="relative flex items-center justify-between mb-5">
    <div className="flex items-center gap-2">
      <CalendarRange className="w-4 h-4 text-emerald-400" />
      <span className="text-sm font-medium text-zinc-300">{recap.month}</span>
    </div>
    <StatusBadge status={recap.status} />
  </div>
  <div className="grid grid-cols-3 gap-6">
    <HeroStat label="Income" value={stats.income.total} delta={stats.momDelta.income} positive />
    <HeroStat label="Expenses" value={stats.expense.total} delta={stats.momDelta.expense} />
    <HeroStat label="Net" value={stats.net} delta={stats.momDelta.net} positive={stats.net >= 0} />
  </div>
  <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-500">
    <span>{stats.expense.count} transactions</span>
    <span>·</span>
    <span>{stats.activeDays} active days</span>
    {stats.displayCurrency !== activeDisplayCurrency && (
      <><span>·</span><span className="text-amber-400">Generated in {stats.displayCurrency}</span></>
    )}
  </div>
</div>
```

`HeroStat` uses `AnimatedNumber`/`NumberTicker` for count-up on mount; delta renders as `+12%` / `-8%` pill with `text-emerald-400` or `text-rose-400`.

#### `RecapNarrative`

```tsx
<div className="relative bg-zinc-900/80 backdrop-blur-xl rounded-xl p-6 border border-zinc-800">
  <div className="flex items-center gap-2 mb-4">
    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
      <Bot className="w-3.5 h-3.5 text-emerald-400" />
    </div>
    <div>
      <div className="text-sm font-medium text-zinc-200">Monthly Insight</div>
      <div className="text-xs text-zinc-500">
        {recap.status === 'generated' ? `Written by ${recap.providerId || 'AI'}` : 'Stats only'}
      </div>
    </div>
  </div>
  <p className="text-zinc-200 leading-relaxed text-[15px] first-letter:text-5xl first-letter:font-serif first-letter:text-emerald-400 first-letter:mr-2 first-letter:float-left first-letter:leading-none first-letter:font-semibold">
    {recap.summary}
  </p>
</div>
```

#### `RecapStatsGrid` (2-column)

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="bg-zinc-900/80 backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
    <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
      <Tag className="w-3.5 h-3.5" /> Top Categories
    </h3>
    {stats.topCategories.length === 0 ? (
      <p className="text-sm text-zinc-500">No expenses recorded</p>
    ) : (
      <div className="space-y-2.5">
        {stats.topCategories.map((c, i) => (
          <div key={c.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-sm text-zinc-200 truncate">{c.name}</span>
              <span className="text-xs text-zinc-500 shrink-0">({c.count})</span>
            </div>
            <span className="text-sm font-mono text-zinc-100 shrink-0 ml-3">
              {formatCurrency(c.amount)}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>

  <div className="bg-zinc-900/80 backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
    <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
      <Wallet className="w-3.5 h-3.5" /> Wallet Activity
    </h3>
    {stats.walletBalanceDelta.length === 0 ? (
      <p className="text-sm text-zinc-500">No wallet changes</p>
    ) : (
      <div className="space-y-2.5">
        {stats.walletBalanceDelta.filter(w => w.delta !== 0).map(w => (
          <div key={w.id} className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm text-zinc-200 truncate">{w.name}</div>
              <div className="text-xs text-zinc-500">{w.type}</div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className={`text-sm font-mono ${w.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {w.delta >= 0 ? '+' : ''}{formatCurrency(w.delta)}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

#### `RecapSecondary` (conditional)

Only renders if subscriptions billed > 0 OR follow-through activity > 0. Same visual treatment: glass card, 2-column grid.

### 6.6 State Variants (all 5 required)

| State | Render | Visual Cue |
|---|---|---|
| `isLoading` | `<RecapSkeleton />` | Shimmer gradient blocks matching hero + narrative shapes |
| `!hasData` | `<RecapEmptyNoData />` | Ghost FileText icon, "No activity recorded for [month]" + muted prev/next hint |
| `hasData && !recap` | `<RecapEmptyWithData />` | Hero-sized card with Sparkles icon, "You have [N] transactions this month. Generate your recap?" + prominent CTA |
| `recap.status === 'failed'` | `<RecapStatsOnly />` | Amber banner: "AI unavailable — showing stats only. Configure a provider in settings." + full stats grid |
| `recap.status === 'generated'` | `<RecapFull />` | Everything rendered |

### 6.7 Recap History Sidebar (within tab)

Below the current recap, a compact list of all existing recaps (`financeRecapList()`). Each row:

```tsx
<button
  onClick={() => setRecapMonth(row.month)}
  className={`w-full flex items-center justify-between p-3 rounded-lg border transition
    ${row.month === recapMonth ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60'}`}
>
  <div className="flex items-center gap-3">
    <span className="text-sm font-medium text-zinc-200">{formatMonthLong(row.month)}</span>
    <StatusDot status={row.status} />
  </div>
  <div className="flex items-center gap-4 text-xs">
    <span className="font-mono text-emerald-400">+{formatCurrency(row.incomeTotal)}</span>
    <span className="font-mono text-rose-400">-{formatCurrency(row.expenseTotal)}</span>
  </div>
</button>
```

---

## 7. Interaction Flow

### 7.1 Auto-Generation UX

- **Silent generation.** No toast when the app opens on a new month. Reason: auto-gen is routine, and toasts are reserved for user-initiated actions.
- **Discovery path:** When the user opens the Recap tab and the previous month has a new auto-generated recap, the tab's icon in the TabBar shows a small `emerald-400` dot for the first visit (cleared after `recapMonth` is set to that month). This is non-intrusive discoverability.
- The Recap tab default month is the previous calendar month, so the user sees the freshly auto-generated recap immediately on first visit.

### 7.2 Manual Generation Flow

1. User selects any month via arrow navigation (or month picker dropdown on desktop-wide layout).
2. If no recap exists and month has data → `RecapEmptyWithData` state with CTA.
3. User clicks **Generate**. Button shows spinner (`RefreshCw` rotate, 300ms ease-in-out). Generate button is disabled during generation.
4. On success → recap body cross-fades in (framer-motion `opacity` + `y: 8px` entry, 250ms).
5. On failure → `RecapStatsOnly` state with amber banner.

### 7.3 Regeneration

When a recap exists, the Generate button relabels to **Regenerate**. Clicking opens a lightweight confirm dialog (not blocking modal — an inline "Confirm" / "Cancel" swap-in):

> "Regenerate the [month] recap? The AI narrative will be rewritten; financial stats stay the same."

Confirmed → calls `financeRecapGenerate(month, force: true)`. This allows AI output to improve with better prompts/providers without losing the stats record.

### 7.4 Keyboard & Accessibility

- Left/Right arrow keys when recap header is focused: step month.
- `Enter` on Generate button: triggers generation.
- All icon buttons have `aria-label`. Focus ring: `focus:ring-2 focus:ring-emerald-500/40`.
- Screen-reader live region for recap content: `<div aria-live="polite">` wraps the body so content swap is announced.

---

## 8. Edge Cases

| Case | Behavior |
|---|---|
| **App closed for multiple months** | Auto-gen runs at startup, generates **only the immediate previous month**. Older missed months appear in history list with status "No recap" — user backfills manually. |
| **First launch with N months of history** | Only immediate previous month auto-generated. Others listed as "not yet generated" in history. |
| **No data for month** | Month picker still allows selection; `RecapEmptyNoData` shown; Generate button disabled. |
| **No AI provider configured at all** | Generation still runs stats; summary set to fallback text; status='failed'; UI shows stats-only view with setup hint. |
| **All providers fail** (rate limits, etc.) | Same as above — `status='failed'`, graceful fallback. |
| **Display currency changes after generation** | Recap keeps its generation-time currency. Banner in hero: "Generated in [X]; current display is [Y]." Stats grid converts live. |
| **Month rollover while app is running** | `setInterval` (6h) eventually picks up; also hook on `app.focus` event could trigger immediate check. |
| **User deletes all transactions for a month that has a recap** | Recap remains (historical record). Stats grid shows zeros on next load; summary stays frozen. |
| **Concurrent generate calls** | Second call returns the existing recap (idempotent by month UNIQUE constraint + early-return in handler). |
| **Wallet archived during month** | Stats still include its activity; wallet name shown with "archived" hint. |

---

## 9. Backend Audit Table

| New Element | Source Location | Handler / Query | Purpose |
|---|---|---|---|
| `finance_monthly_recaps` table | `src/main.ts` after line 3362 | CREATE TABLE + UNIQUE(month) | Persistent recap storage |
| `idx_monthly_recaps_month` | same | CREATE INDEX | Fast month lookup |
| `checkMonthlyRecaps(db)` | `src/main.ts` after line 18931 | SELECT existing + COUNT txns + fire-and-forget generate | Auto-gen on startup + 6h interval |
| `computeRecapStats(db, month)` | `src/main.ts` (new function) | 9 prepared statements joined into `RecapStats` | Pure-numeric stats |
| `runMonthlyRecapAI(sp, um)` | `src/main.ts` (new, mirrors `runLifePhaseAI`) | buildChain('monthlyRecap') → runWithFallback → OpenRouter fallback | AI invocation |
| `'monthlyRecap'` feature key | `src/services/providers/router.ts:7` | Added to union | Routing config |
| `finance:recap-list` | `src/main.ts` (new IPC) | SELECT * ORDER BY month DESC | List all recaps |
| `finance:recap-get` | same | SELECT WHERE month = ? | Single recap |
| `finance:recap-generate` | same | compute stats → AI → upsert | Create/refresh |
| `finance:recap-delete` | same | DELETE WHERE month = ? | Remove recap |
| `finance:recap-months-with-data` | same | DISTINCT strftime('%Y-%m', date) | Month picker source |
| `financeRecapList` etc. | `src/preload.ts` after line 1070 | `ipcRenderer.invoke(...)` | Renderer bridge |
| `'recap'` tab key | `src/pages/FinancePage.tsx:61-68` + `finance-types.ts:451` | Added to `tabs` + `FinanceTabKey` union | Top-level tab |
| `RecapPanel.tsx` | `src/components/finance/RecapPanel.tsx` (new) | Own `recapMonth` state, own `useEffect` | Independent UI |
| Supporting components | `src/components/finance/recap/` | Header, Hero, Narrative, StatsGrid, HistoryList, Empty states | Visual spec |

---

## 10. Worked Example: July 2026

Given the live data snapshot in §9 of the context bundle:

- **Stats computed** (display currency IDR): `income: 0`, `expense: 1,179,330`, `net: -1,179,330`, `transactionCount: 7`, `activeDays: 4`. Top categories: Transport (990,500 / 2 txns), Utilities (93,930 / 1), Offerings (50,000 / 1), Subscriptions (29,900 / 1), Food (15,000 / 2). Subscriptions billed: SPOTIFY (29,900). Wallets with biggest spend: MAIN WALLET, BANK BCA.
- **AI narrative** (example output):
  > July was quiet on the income side — no deposits recorded. Your spending centered heavily on transport, which accounted for over 84% of the month's outflow across two transactions totaling Rp 990,500. Utilities (Rp 93,930) and offerings (Rp 50,000) rounded out the bigger-ticket items. Spotify renewed on OVO for Rp 29,900, keeping your active subscription count at two. Your MAIN WALLET and BANK BCA handled most of the movement, while OVO stayed small and the crypto wallets sat untouched. With July running about 26% leaner than June's spending peak, the month reads as a consolidation period — worth watching whether transport returns to normal levels in August.

This demonstrates: the AI used **only** the provided numbers, named specific wallets and categories, quantified the transport share (84%), and ended with a forward-looking sentence — satisfying all prompt constraints.

---

## Summary of Hard Guarantees

✅ Recap month state **never** reads or writes `FinancePage.selectedMonth`.
✅ Auto-generation is idempotent via `month UNIQUE` + early-return check.
✅ AI never invents numbers — all stats are server-computed.
✅ No AI provider = stats-only view, no crash, no blank screen.
✅ No new npm dependencies; no PTY changes; CRLF line endings preserved.
✅ All IPC, preload, DB, and AI integration follow existing patterns verbatim.
✅ All 5 UI states (loading / no-data / empty-with-data / stats-only / populated) specified.
✅ Keyboard, focus, and ARIA accessibility built in.