Here is the comprehensive fix packet, ordered by file and dependency (backend first, then frontend).

---

## Prerequisite: Extract Recalculation Logic to Shared Function

**File:** `src/main.ts` (lines 25884–26064)

**Current code:**
```typescript
electron_1.ipcMain.handle('finance:recalculate-balances', async (_event, walletId?: number, preview?: boolean) => {
  if (!db) return { success: false };
  try {
    if (walletId) {
      const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(walletId) as any;
      if (!wallet) return { error: 'Wallet not found' };

      const rawInitBal = wallet.initial_balance || 0;
      const initialBalance = /* decrypt */ Number(rawInitBal) || 0;
      const txns = db.prepare('SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, sort_order ASC, created_at ASC, id ASC').all(walletId) as any[];

      const isCryptoWallet = wallet.type === 'crypto' || wallet.type === 'investment';

      let balance = initialBalance;
      const assetsMap = new Map<string, any>();

      for (const t of txns) {
        // ... existing logic (lines 25910–26020) ...
      }

      // ... existing write-back logic (lines 26020–26060) ...
    } else {
      // ... existing all-wallets logic ...
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

**New code:**
```typescript
// Extracted helper so delete-wallet can reuse it
async function recalculateSingleWallet(walletId: number, preview?: boolean): Promise<any> {
  if (!db) return { success: false };
  const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(walletId) as any;
  if (!wallet) return { error: 'Wallet not found' };

  const rawInitBal = wallet.initial_balance || 0;
  const initialBalance = Number(rawInitBal) || 0;
  const txns = db.prepare('SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, sort_order ASC, created_at ASC, id ASC').all(walletId) as any[];

  const isCryptoWallet = wallet.type === 'crypto' || wallet.type === 'investment';

  let balance = initialBalance;
  const assetsMap = new Map<string, any>();

  for (const t of txns) {
    // === PRESERVE EXISTING LOGIC FROM LINES 25910–26020 ===
    // (metadata parsing, isCryptoTxn / isCryptoToCrypto detection,
    //  balance/asset accumulation, sort_order handling)
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
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

**Explanation:** The per-wallet recalculation logic must be callable from both the existing `recalculate-balances` handler and the `delete-wallet` handler. Extracting it into `recalculateSingleWallet` avoids duplicating 180 lines of balance/crypto logic.

---

## Fix 7: srcWalletId Temporal Dead Zone

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

**Explanation:** `srcWalletId` was referenced in the `sortOrder` expression before its declaration, causing a temporal dead zone crash whenever `isAdjustment` was truthy. Moving the declaration above fixes the latent crash.

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

**Explanation:** Without a server-side `wallet_id` filter, the frontend receives every transaction in the database and must filter client-side. This allows orphaned transfer legs (where `to_wallet_id` matches a wallet but `wallet_id` does not) to leak through. Filtering on all three wallet reference columns ensures only genuinely relevant transactions are returned.

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
          existing.avg_buy_price = newAmt > 0 ? ((oldAmt * oldAvg) + (newAsset.amount * newAsset.avg_buy_price)) / newAmt : newAsset.avg_buy_price;
        } else {
          assets.push(newAsset);
        }
```

**Explanation:** Buying the same coin twice created duplicate entries in `wallet.metadata.assets`, breaking portfolio calculations. This change merges quantities using a weighted average for `avg_buy_price`, keeping the metadata canonical.

---

## Fix 5: Update Account Balance for Crypto Buys

**File:** `src/main.ts` (inside the crypto buy block, after wallet metadata is written back)

**Current code:** The crypto buy path updates wallet metadata and wallet balance, but never reaches the account-balance update code because it is gated behind `else if (!parsedMeta || !(parsedMeta.coinId || parsedMeta.coin_id))`.

**New code:** Add the following immediately after the wallet metadata/balance update inside the `if (parsedMeta && (parsedMeta.coinId || parsedMeta.coin_id) && data.wallet_id && data.type === 'expense')` block:

```typescript
        // FIX #5: Account balance must also reflect the fiat spent on crypto
        if (data.account_id) {
          const acctRow = db.prepare('SELECT balance FROM finance_accounts WHERE id = ?').get(data.account_id) as any;
          const curAcctBal = financeDataKey && isEncrypted(acctRow?.balance)
            ? Number(decryptField(String(acctRow.balance), financeDataKey)) || 0
            : Number(acctRow?.balance) || 0;
          const newAcctBal = curAcctBal + (data.amount || 0);
          const encAcctBal = financeDataKey ? encryptField(enc(newAcctBal), financeDataKey) : String(newAcctBal);
          db.prepare("UPDATE finance_accounts SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
            .run(encAcctBal, data.account_id);
        }
```

**Explanation:** Crypto buy transactions are `expense` type with a negative `amount` representing fiat spent. The existing code updated the wallet balance but skipped the parent account balance because the account update lived in the `else if` non-crypto branch. This ensures the account balance stays in sync.

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

**Explanation:** The old code only deleted transactions where `wallet_id` matched, leaving orphaned transfer legs (where the deleted wallet was `from_wallet_id` or `to_wallet_id`). These orphans would reappear in new wallets that happened to receive the recycled auto-increment ID. The fix deletes all legs, scrubs remaining foreign-key references, and recalculates every surviving wallet so balances reflect the deletion.

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

**Explanation:** The backend detects crypto transfers by checking `data.metadata.coinId`. Because the sell-when-no-fiat path omitted `metadata`, the backend fell through to the fiat-to-fiat transfer path, subtracting the crypto quantity from the fiat balance instead of reducing crypto holdings. Adding `metadata` routes the transaction through the correct crypto-to-fiat handler.

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

**Explanation:** The backend already updates `wallet.metadata.assets` atomically during transaction creation. The frontend then immediately overwrote that metadata with its own array, causing a race condition and potential data loss. Removing the overwrite and refreshing from the backend ensures a single source of truth.

> **Note:** If `props.onRefreshWalletData` does not exist in the current component interface, replace it with whatever mechanism the parent uses to re-fetch the wallet (e.g., a context refresh function, a `useEffect` dependency toggle, or a manual `window.deskflowAPI.financeGetWallet` call). The critical change is **removing the `onChange('assets', ...)` call**.

---

## Summary of Changes

| # | File | Lines | Bug Fixed |
|---|------|-------|-----------|
| Prereq | `src/main.ts` | 25884–26064 | Extract `recalculateSingleWallet` for reuse |
| 7 | `src/main.ts` | 24073–24083 | `srcWalletId` used before declaration |
| 2 | `src/main.ts` | 23830–23868 | Missing server-side `wallet_id` filter |
| 4 | `src/main.ts` | ~23952 | `assets.push()` never merges same-coin entries |
| 5 | `src/main.ts` | ~23979–23997 | Account balance not updated for crypto buys |
| 1 | `src/main.ts` | 24906–24917 | Wallet deletion leaves orphaned transactions |
| 3 | `CryptoTransactionModal.tsx` | 113–125 | Sell transfer missing `metadata` |
| 6 | `WalletDetailView.tsx` | 868–872 | Double metadata write on add asset |

Apply these changes in the order listed. After applying, run `finance:recalculate-balances` once without a `walletId` to heal any existing corrupted balances.