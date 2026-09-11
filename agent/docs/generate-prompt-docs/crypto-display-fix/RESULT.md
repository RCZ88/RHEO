Here is the comprehensive fix packet addressing all 14 issues (7 bugs + 7 display/features), ordered by file and dependency (backend first, then frontend).

---

## Prerequisite: Extract Recalculation Logic to Shared Function

**File:** `src/main.ts` (lines 25884–26064)

**Current code:** The per-wallet recalculation logic is embedded inside the `finance:recalculate-balances` IPC handler and cannot be called from `delete-wallet`.

**New code:** Extract the wallet-specific recalculation into a reusable `recalculateSingleWallet` function. The existing handler body (lines 25892–26060) moves into this function, and the IPC handler calls it.

```typescript
// === EXTRACTED HELPER (insert before the IPC handler) ===
async function recalculateSingleWallet(walletId: number, preview?: boolean): Promise<any> {
  if (!db) return { success: false };
  const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(walletId) as any;
  if (!wallet) return { error: 'Wallet not found' };

  const rawInitBal = wallet.initial_balance || 0;
  const initialBalance = financeDataKey && isEncrypted(rawInitBal)
    ? Number(decryptField(String(rawInitBal), financeDataKey)) || 0
    : Number(rawInitBal) || 0;
  const txns = db.prepare('SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, sort_order ASC, created_at ASC, id ASC').all(walletId) as any[];

  const isCryptoWallet = wallet.type === 'crypto' || wallet.type === 'investment';

  let balance = initialBalance;
  const assetsMap = new Map<string, any>();

  for (const t of txns) {
    // === ENSURE AMOUNT IS DECRYPTED (critical for Task 7) ===
    let txnAmt = t.amount;
    if (financeDataKey && isEncrypted(txnAmt)) {
      txnAmt = Number(decryptField(String(txnAmt), financeDataKey)) || 0;
    } else {
      txnAmt = Number(txnAmt) || 0;
    }

    // === PRESERVE EXISTING LOGIC FROM LINES 25910–26020 ===
    // (metadata parsing, isCryptoTxn / isCryptoToCrypto detection,
    //  balance/asset accumulation, sort_order handling)
    //  Use txnAmt instead of t.amount for all balance math.
  }

  // === PRESERVE EXISTING WRITE-BACK LOGIC FROM LINES 26020–26060 ===
  // (reconstruct metadata.assets from assetsMap,
  //  update wallet.balance and wallet.metadata,
  //  recalculate parent account balance)

  return { success: true };
}

electron_1.ipcMain.handle('finance:recalculate-balances', async (_event, walletId?: number, preview?: boolean) => {
  if (!db) return { success: false };
  try {
    if (walletId) {
      return await recalculateSingleWallet(walletId, preview);
    } else {
      // === PRESERVE EXISTING ALL-WALLETS LOGIC ===
      const allWallets = db.prepare('SELECT id FROM finance_wallets').all() as any[];
      for (const w of allWallets) {
        await recalculateSingleWallet(w.id, preview);
      }
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

**Explanation:** `delete-wallet` needs to recalculate all surviving wallets after cleanup. Extracting the logic avoids duplicating 180+ lines of balance/crypto math. The `txnAmt` decryption fix inside the loop ensures encrypted adjustment transactions are properly read, preventing the negative-balance bug (Task 7).

---

## Fix 7: `srcWalletId` Temporal Dead Zone

**File:** `src/main.ts` (lines 24073–24083)

**Current code:**
```typescript
const sortOrder = isAdjustment ? ((db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?').get(srcWalletId) as any)?.max || 0) + 1 : 0;

// ... validation code ...

const srcWalletId = data.wallet_id;
const dstWalletId = data.to_wallet_id;
```

**New code:**
```typescript
const srcWalletId = data.wallet_id;
const dstWalletId = data.to_wallet_id;

// ... validation code ...

const sortOrder = isAdjustment ? ((db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?').get(srcWalletId) as any)?.max || 0) + 1 : 0;
```

**Explanation:** `srcWalletId` was referenced before its declaration, causing a runtime crash whenever `isAdjustment` was truthy (historical adjustments). Moving the declaration above fixes the latent crash.

---

## Fix 2: Server-Side `wallet_id` Filter on `get-transactions`

**File:** `src/main.ts` (lines 23830–23868)

**Current code:**
```typescript
    if (filters?.search) {
      conditions.push('(t.description LIKE ? OR t.note LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    // NO wallet_id filter!
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
```

**New code:**
```typescript
    if (filters?.search) {
      conditions.push('(t.description LIKE ? OR t.note LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters?.wallet_id) {
      conditions.push('(t.wallet_id = ? OR t.from_wallet_id = ? OR t.to_wallet_id = ?)');
      params.push(filters.wallet_id, filters.wallet_id, filters.wallet_id);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
```

**Explanation:** Without a server-side filter, orphaned transfer legs (where `to_wallet_id` matches but `wallet_id` does not) leak through client-side filtering. Filtering on all three wallet reference columns ensures only genuinely relevant transactions are returned.

---

## Fix 4: Merge Same-Coin Entries in `metadata.assets`

**File:** `src/main.ts` (line 23952)

**Current code:**
```typescript
        assets.push(newAsset);        // <-- ALWAYS PUSHES, NEVER MERGES
```

**New code:**
```typescript
        const existingIdx = assets.findIndex(a => (a.coin_id || a.coinId) === newAsset.coin_id);
        if (existingIdx >= 0) {
          const existing = assets[existingIdx];
          const oldAmt = Number(existing.amount) || 0;
          const newAmt = oldAmt + newAsset.amount;
          const oldAvg = Number(existing.avg_buy_price || existing.avgBuyPrice) || 0;
          existing.amount = newAmt;
          existing.avg_buy_price = newAmt > 0
            ? ((oldAmt * oldAvg) + (newAsset.amount * newAsset.avg_buy_price)) / newAmt
            : newAsset.avg_buy_price;
        } else {
          assets.push(newAsset);
        }
```

**Explanation:** Buying the same coin twice created duplicate entries, breaking portfolio calculations. This merges quantities using a weighted average for `avg_buy_price`, keeping the metadata canonical.

---

## Fix 5: Update Account Balance for Crypto Buys

**File:** `src/main.ts` (inside the crypto buy block, after wallet metadata is written back)

**Current code:** The crypto buy path updates wallet metadata and balance, but skips the parent account balance because the account update lives in the `else if (!parsedMeta...)` non-crypto branch.

**New code:** Add the following immediately after the wallet metadata/balance update inside the `if (parsedMeta && (parsedMeta.coinId || parsedMeta.coin_id) && data.wallet_id && data.type === 'expense')` block:

```typescript
        // FIX #5: Account balance must also reflect the fiat spent on crypto
        if (data.account_id) {
          const acctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(data.account_id) as any;
          const curAcctBal = financeDataKey && isEncrypted(acctRow?.balance)
            ? Number(decryptField(String(acctRow.balance), financeDataKey)) || 0
            : Number(acctRow?.balance) || 0;
          const newAcctBal = curAcctBal + (data.amount || 0); // data.amount is negative for buys
          const encAcctBal = financeDataKey ? encryptField(enc(newAcctBal), financeDataKey) : String(newAcctBal);
          db.prepare("UPDATE finance_accounts SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
            .run(encAcctBal, data.account_id);
        }
```

**Explanation:** Crypto buys are `expense` type with a negative `amount` representing fiat spent. The existing code updated the wallet balance but skipped the parent account. This ensures the account balance stays in sync.

---

## Fix 1: Wallet Deletion — Complete Transaction Cleanup

**File:** `src/main.ts` (lines 24906–24917)

**Current code:**
```typescript
electron_1.ipcMain.handle('finance:delete-wallet', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const wallet = db.prepare('SELECT name, type FROM finance_wallets WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM finance_transactions WHERE wallet_id = ?').run(id);  // <-- ONLY deletes primary wallet_id
    db.prepare('DELETE FROM finance_wallets WHERE id = ?').run(id);
    logAuditEvent('wallet_deleted', 'wallet', id, `Deleted wallet "${wallet?.name || id}" (type: ${wallet?.type || 'unknown'})`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

**New code:**
```typescript
electron_1.ipcMain.handle('finance:delete-wallet', async (_event, id: number) => {
  if (!db) return { success: false };
  try {
    const wallet = db.prepare('SELECT name, type FROM finance_wallets WHERE id = ?').get(id) as any;
    
    // Delete every transaction leg tied to this wallet in any role
    db.prepare('DELETE FROM finance_transactions WHERE wallet_id = ?').run(id);
    db.prepare('DELETE FROM finance_transactions WHERE from_wallet_id = ?').run(id);
    db.prepare('DELETE FROM finance_transactions WHERE to_wallet_id = ?').run(id);
    
    // Null out foreign-key references in other wallets' transactions so nothing points to a dead ID
    db.prepare('UPDATE finance_transactions SET from_wallet_id = NULL WHERE from_wallet_id = ?').run(id);
    db.prepare('UPDATE finance_transactions SET to_wallet_id = NULL WHERE to_wallet_id = ?').run(id);
    
    db.prepare('DELETE FROM finance_wallets WHERE id = ?').run(id);
    logAuditEvent('wallet_deleted', 'wallet', id, `Deleted wallet "${wallet?.name || id}" (type: ${wallet?.type || 'unknown'})`);
    
    // Recalculate balances for all surviving wallets so portfolios and fiat balances are correct
    const remainingWallets = db.prepare('SELECT id FROM finance_wallets').all() as any[];
    for (const w of remainingWallets) {
      await recalculateSingleWallet(w.id, false);
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

**Explanation:** The old code only deleted transactions where `wallet_id` matched, leaving orphaned transfer legs. These orphans would reappear in new wallets that happened to receive the recycled auto-increment ID. The fix deletes all legs, scrubs remaining foreign-key references, and recalculates every surviving wallet.

---

## Task 7: Fix Initial Value After Recalculate (Wallet Creation)

**File:** `src/main.ts` (lines 23243–23257)

**Current code:**
```typescript
// For crypto wallets: create an income transaction to establish the baseline from 0
if (isCrypto && initBal > 0) {
  try {
    const catId = getSubCategoryId();
    const encAmt = financeDataKey ? encryptField(enc(initBal), financeDataKey) : String(initBal);
    const encDesc = financeDataKey ? encryptField(`Initial ${data.name}`, financeDataKey) : `Initial ${data.name}`;
    const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?').get(newId) as any;
    db.prepare(`
      INSERT INTO finance_transactions (account_id, wallet_id, category_id, type, amount, description, note, "date", "time", is_adjustment, on_behalf_of, on_behalf_of_label, sort_order)
      VALUES (?, ?, ?, 'income', ?, ?, ?, '1900-01-01', '00:00', 1, 0, NULL, ?)
    `).run(data.account_id, newId, catId, encAmt, encDesc, `Initial crypto balance for ${data.name}`, (maxSort?.max || 0) + 1);
    // Set initial_balance to 0 so recalculate doesn't double-count
    const encZeroBal = financeDataKey ? encryptField(enc(0), financeDataKey) : '0';
    db.prepare('UPDATE finance_wallets SET initial_balance = ? WHERE id = ?').run(encZeroBal, newId);
  } catch (e: any) {
    console.error('[finance:create-wallet] failed to create historical baseline:', e?.message);
  }
}
```

**New code:**
```typescript
// For crypto wallets: DO NOT create an adjustment transaction and DO NOT zero out initial_balance.
// The wallet.balance already holds the correct initial fiat. Recalculate will start from initial_balance.
// The portfolio derivation (WalletDetailView) only looks at crypto metadata, so the adjustment is unnecessary.
if (isCrypto && initBal > 0) {
  // No-op: wallet.balance and wallet.initial_balance are already correct from the INSERT above.
  // The adjustment transaction caused recalculate to start from 0 and produced negative balances
  // when transaction amounts were not properly decrypted in the recalculate loop.
}
```

**Explanation:** The adjustment transaction set `initial_balance` to 0 while `wallet.balance` remained at `initBal`. The recalculate handler started from 0, and if the adjustment transaction's encrypted amount wasn't decrypted properly, the balance went negative. Removing the adjustment transaction and keeping `initial_balance` = `initBal` eliminates the mismatch.

> **For existing wallets:** Run `finance:recalculate-balances` once without a `walletId` after deploying. The extracted helper now decrypts transaction amounts correctly, which will heal existing corrupted balances.

---

## Fix 3: Crypto-to-Fiat Sell Transfer — Add Missing `metadata`

**File:** `src/components/finance/modals/CryptoTransactionModal.tsx` (lines 113–125)

**Current code:**
```tsx
        if (isDestFiat && !hasFiat) {
            return !!(await props.onSubmit(f.buildPayload({
                to_wallet_id: destWalletId,
                fromWalletName: props.wallet.name,
                toWalletName: destWallet?.name || 'another wallet',
                description: f.description.trim() || `Sell ${qn} ${asset.symbol} → ${format(qn * pn)} ${destWallet?.currency || props.displayCurrency}`,
                amount: qn,
                fee: 0,
                dest_amount: qn * pn,
                dest_metadata: destMetadata,
                // *** metadata field is MISSING here! ***
            })))
        }
```

**New code:**
```tsx
        if (isDestFiat && !hasFiat) {
            return !!(await props.onSubmit(f.buildPayload({
                to_wallet_id: destWalletId,
                fromWalletName: props.wallet.name,
                toWalletName: destWallet?.name || 'another wallet',
                description: f.description.trim() || `Sell ${qn} ${asset.symbol} → ${format(qn * pn)} ${destWallet?.currency || props.displayCurrency}`,
                amount: qn,
                fee: 0,
                dest_amount: qn * pn,
                metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: 0, total: qn * pn },
                dest_metadata: destMetadata,
            })))
        }
```

**Explanation:** The backend detects crypto transfers by checking `data.metadata.coinId`. Without `metadata`, the backend fell through to the fiat-to-fiat path, subtracting the crypto quantity from the fiat balance instead of reducing crypto holdings.

---

## Task 3 & 4: Add "Pay" and "Receive" Modes

**File:** `src/components/finance/modals/CryptoTransactionModal.tsx`

Add two new transaction modes inside `handleSubmit`, before the existing `// Transfer modes` block. Also add UI state for `mode` and `counterpartyName` in the component.

**New code (inside `handleSubmit`):**
```tsx
    // Pay mode (send crypto to a person as payment)
    if (mode === 'pay') {
        return !!(await props.onSubmit(f.buildPayload({
            type: 'income',
            amount: 0,
            description: f.description.trim() || `Pay ${qn} ${asset.symbol} to ${counterpartyName}`,
            metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: 0, total: 0, payee: counterpartyName, is_purchase: false },
        })))
    }

    // Receive mode (get crypto from a person as payment)
    if (mode === 'receive') {
        return !!(await props.onSubmit(f.buildPayload({
            type: 'expense',
            amount: 0,
            description: f.description.trim() || `Receive ${qn} ${asset.symbol} from ${counterpartyName}`,
            metadata: { coinId: asset.coinId, symbol: asset.symbol, qty: qn, price: pn, fee: 0, total: 0, sender: counterpartyName, is_purchase: false },
        })))
    }
```

**UI additions (in the modal JSX):**
```tsx
// Add to mode selector (e.g., tabs or dropdown):
<button onClick={() => setMode('pay')} className={mode === 'pay' ? 'active' : ''}>Pay</button>
<button onClick={() => setMode('receive')} className={mode === 'receive' ? 'active' : ''}>Receive</button>

// Add counterparty input when in pay/receive mode:
{(mode === 'pay' || mode === 'receive') && (
  <input
    type="text"
    placeholder={mode === 'pay' ? 'Payee name' : 'Sender name'}
    value={counterpartyName}
    onChange={e => setCounterpartyName(e.target.value)}
  />
)}
```

**Backend handling:** The existing `finance:create-transaction` handler already processes `expense` and `income` types. For these new modes:
- **Pay (`type: 'income'`, `amount: 0`):** The backend will add the transaction but won't change fiat balance (since amount is 0). The asset derivation in WalletDetailView will see `type: 'income'` and reduce holdings (as it does for sells). The `is_purchase: false` flag prevents it from being counted in "Spent".
- **Receive (`type: 'expense'`, `amount: 0`):** The backend will add the transaction but won't change fiat balance. The asset derivation will see `type: 'expense'` and increase holdings (as it does for buys). The `is_purchase: false` flag prevents it from being counted in "Spent".

---

## Fix 6: Remove Double Metadata Update for Add Asset

**File:** `src/components/finance/WalletDetailView.tsx` (lines 868–872)

**Current code:**
```tsx
    const finalAssets = [...newAssets];
    if (createdTxnId && finalAssets.length > 0) {
        finalAssets[finalAssets.length - 1] = { ...finalAssets[finalAssets.length - 1], txn_id: createdTxnId };
    }
    onChange('assets', JSON.stringify(finalAssets));
```

**New code:**
```tsx
    // Backend already pushed the new asset into wallet.metadata.assets during
    // finance:create-transaction. Do NOT overwrite it from the frontend.
    // Instead, refresh wallet data so React state syncs with the DB.
    if (result?.success) {
        props.onRefreshWalletData?.();
    }
```

**Explanation:** The backend updates `wallet.metadata.assets` atomically during transaction creation. The frontend then overwrote that metadata with its own array, causing a race condition. Removing the overwrite and refreshing from the backend ensures a single source of truth.

> **Note:** If `props.onRefreshWalletData` does not exist, replace it with whatever mechanism re-fetches the wallet (e.g., a context refresh, a `useEffect` dependency toggle, or a manual API call). The critical change is **removing the `onChange('assets', ...)` call**.

---

## Task 1: Combine "Fiat" and "Available" Display

**File:** `src/components/finance/WalletDetailView.tsx` (lines 1182–1196)

**Current code:**
```tsx
<div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 text-[11px]">
  <span className="text-zinc-500">Fiat</span>
  <span className="text-zinc-300 font-medium tabular-nums">{fmtCurrency(availableFiat, displayCurrency)}</span>
  {totalCost > 0 && (
    <>
      <span className="text-zinc-600">·</span>
      <span className="text-zinc-500">Spent</span>
      <span className="text-zinc-400 tabular-nums">{fmtCurrency(totalCost, displayCurrency)}</span>
      <span className="text-zinc-600">·</span>
      <span className="text-zinc-500">Available</span>
      <span className={`font-medium tabular-nums ${availableFiat > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(availableFiat, displayCurrency)}</span>
    </>
  )}
</div>
```

**New code:**
```tsx
<div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 text-[11px]">
  {totalSpent > 0 && (
    <>
      <span className="text-zinc-500">Spent</span>
      <span className="text-zinc-400 tabular-nums">{fmtCurrency(totalSpent, displayCurrency)}</span>
      <span className="text-zinc-600">·</span>
    </>
  )}
  <span className="text-zinc-500">Available</span>
  <span className={`font-medium tabular-nums ${availableFiat > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(availableFiat, displayCurrency)}</span>
</div>
```

**Explanation:** "Fiat" and "Available" showed the same value. Removed the duplicate label. "Spent" now uses `totalSpent` (actual fiat spent on buys) instead of `totalCost` (averaged cost basis).

---

## Task 2: Fix "Spent" Calculation

**File:** `src/components/finance/WalletDetailView.tsx` (lines 544–597, 607–613)

**Current assets derivation:**
```typescript
      if (!assetsMap.has(coinId)) {
        assetsMap.set(coinId, { coin_id: coinId, symbol: (m.symbol || '').toUpperCase(), amount: 0, total_cost: 0 });
      }
      const asset = assetsMap.get(coinId)!;
      if (delta > 0 && t.type === 'expense') {
        const cost = delta * (Number(m.price) || 0);
        asset.total_cost += cost;
      }
```

**New assets derivation:**
```typescript
      if (!assetsMap.has(coinId)) {
        assetsMap.set(coinId, { coin_id: coinId, symbol: (m.symbol || '').toUpperCase(), amount: 0, total_cost: 0, total_fiat_spent: 0 });
      }
      const asset = assetsMap.get(coinId)!;
      // Only count as "spent" for actual purchases (buys), NOT receives or transfers
      if (delta > 0 && t.type === 'expense' && m.is_purchase !== false) {
        const cost = delta * (Number(m.price) || 0);
        asset.total_cost += cost;
        asset.total_fiat_spent += Number(m.total) || cost;
      }
```

**Current display values:**
```typescript
const totalCost = useMemo(() => assets.reduce((s, a) => s + a.amount * a.avg_buy_price, 0), [assets]);
```

**New display values:**
```typescript
const totalCost = useMemo(() => assets.reduce((s, a) => s + a.amount * a.avg_buy_price, 0), [assets]);
const totalSpent = useMemo(() => assets.reduce((s, a) => s + ((a as any).total_fiat_spent || 0), 0), [assets]);
```

**Explanation:** `totalCost` is the cost basis (quantity × avg buy price), used for P&L. `totalSpent` is the actual fiat spent on buy transactions, tracked separately. The `is_purchase !== false` check excludes "Receive" transactions from the spent total.

---

## Task 5: Fix P&L Calculation

**File:** `src/components/finance/WalletDetailView.tsx` (lines 612–613)

**Current code:**
```typescript
const totalPnl = cryptoPortfolioValue - totalCost;
const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
```

**New code:** (No change needed to the formula, but ensure the inputs are correct)

```typescript
const totalPnl = cryptoPortfolioValue - totalCost;
const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
```

**Explanation:** The P&L formula is mathematically correct: `(current_price × qty) - (avg_buy_price × qty)`. The bug was in the inputs — `totalCost` was wrong because of duplicate asset entries (Fix 4) and the assets derivation didn't properly track cost basis. Once Fix 4 and Task 2 are applied, `totalCost` will be correct and P&L will be correct.

---

## Task 6: Fix 24h Percentage Display

**File:** `src/components/finance/WalletDetailView.tsx` (lines 620–621)

**Current code:**
```typescript
const primaryPrice = prices.find(p => p.coin_id === primaryCoinId);
const pc24h = primaryPrice?.price_change_percentage_24h ?? null;
```

**New code:**
```typescript
const primaryPrice = prices.find(p => p.coin_id === primaryCoinId);
const pc24h = primaryPrice?.price_change_percentage_24h
  ?? primaryPrice?.price_change_24h
  ?? null;
```

**Backend note:** Ensure `financeFetchCryptoPrices` (in `src/main.ts`) maps the CoinGecko response field correctly. The API returns `price_change_percentage_24h`. If your wrapper strips this field, add it to the returned object:

```typescript
// In the price-fetch handler (wherever financeFetchCryptoPrices is implemented):
return data.map((coin: any) => ({
  coin_id: coin.id,
  current_price: coin.current_price,
  price_change_percentage_24h: coin.price_change_percentage_24h, // <-- ensure this is included
  // ... other fields ...
}));
```

**Explanation:** Added a defensive fallback for alternative field names. If the backend API doesn't return `price_change_percentage_24h`, the frontend now falls back to `price_change_24h`.

---

## Summary of All Changes

| # | File | Lines | Issue |
|---|------|-------|-------|
| Prereq | `src/main.ts` | 25884–26064 | Extract `recalculateSingleWallet` + decrypt txnAmt |
| 7 | `src/main.ts` | 24073–24083 | `srcWalletId` TDZ crash |
| 2 | `src/main.ts` | 23830–23868 | Missing server-side `wallet_id` filter |
| 4 | `src/main.ts` | ~23952 | `assets.push()` never merges same-coin |
| 5 | `src/main.ts` | ~23962–23969 | Account balance not updated for crypto buys |
| 1 | `src/main.ts` | 24906–24917 | Wallet deletion leaves orphaned transactions |
| 7 | `src/main.ts` | 23243–23257 | Initial balance negative after recalculate |
| 3 | `CryptoTransactionModal.tsx` | 113–125 | Sell transfer missing `metadata` |
| 3/4 | `CryptoTransactionModal.tsx` | ~100–144 | Add Pay & Receive modes |
| 6 | `WalletDetailView.tsx` | 868–872 | Double metadata write on add asset |
| 1 | `WalletDetailView.tsx` | 1182–1196 | Combine Fiat/Available display |
| 2 | `WalletDetailView.tsx` | 544–597, 607–613 | Fix Spent calculation |
| 5 | `WalletDetailView.tsx` | 612–613 | P&L inputs corrected via other fixes |
| 6 | `WalletDetailView.tsx` | 620–621 | 24h percentage fallback |

**After applying all fixes, run `finance:recalculate-balances` once (without a walletId) to heal existing data.**