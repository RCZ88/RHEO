 
 
 
   
 
   
     
 Done. Everything is packed into one zip:

**[crypto-wallet-7bug-fix.zip](sandbox:///mnt/agents/output/crypto-wallet-7bug-fix.zip)** — 48.4 KB

Here's what's inside and what each fix does:

---

### The 7 Bugs & Their Fixes

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| **1** | Fiat not deducted when buying crypto | `CryptoTransactionModal` mapped "Buy" to `type='income'` which **increases** `wallet.balance` | Swap the types: **Buy → `expense`** (fiat leaves), **Sell → `income`** (fiat enters) |
| **2** | No transaction when adding a coin | `handleAddAsset` only updated `metadata.assets`, no `finance_transactions` record | After `onChange('assets', ...)`, call `finance:create-transaction` with `type='expense'` and the fiat cost |
| **3** | Wrong display numbers | `fiatBalance` computed from transfers (not `wallet.balance`), then `availableFiat = fiatBalance - totalCost` double-counted | `fiatBalance = wallet.balance` (source of truth). `totalValue = fiatBalance + cryptoPortfolioValue`. No subtraction. |
| **4** | Charts page = copy of dashboard | `FinanceChartsTab` had duplicate content | Keep only financial analysis charts in `FinanceChartsTab` |
| **5** | Dashboard has duplicate analytics | `OverviewTab` had same "Advanced Analytics" section as Charts tab | **Delete** the Advanced Analytics section from `OverviewTab` |
| **6** | **Duplicate charts tab blocks navigation** (critical) | `FinancePage.tsx` had two `{activeTab === 'charts' && ...}` blocks with same `key="charts"` | **Delete** the second block (lines 1184–1234) |
| **7** | Charts tab not single source of truth | Analytics scattered across both tabs | All advanced analytics live **only** in `FinanceChartsTab` |

---

### The Core Logic Fix

```
BEFORE (broken):
  fiatBalance = sum(transfers IN)                    ← ignores wallet.balance
  availableFiat = fiatBalance - totalCost            ← double-counts
  totalValue = availableFiat + cryptoValue            ← wrong

AFTER (correct):
  fiatBalance = wallet.balance                         ← source of truth
  totalValue = fiatBalance + cryptoPortfolioValue     ← fiat + coins
  availableFiat = fiatBalance                          ← already reflects all buys
```

When you buy crypto: `wallet.balance` decreases (expense transaction) → `metadata.assets` gains the coin. The cost is already baked into `wallet.balance`.