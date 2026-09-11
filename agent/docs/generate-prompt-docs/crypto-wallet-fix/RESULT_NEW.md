# RESULT.md — Crypto Wallet End-to-End Fix

> Comprehensive fix plan with exact file paths, line numbers, and code. All changes assume CRLF line endings preserved. All SQL changes use safe try/catch migrations.

---

## Executive Summary

After tracing the entire flow end-to-end, the **root cause** of "everything is broken" is a single architectural defect with cascading consequences:

### The Encryption Inconsistency Bug (Root Cause #1)

`finance:update-wallet-metadata` (main.ts line ~23327) writes wallet metadata as **plain JSON**:
```typescript
db.prepare("UPDATE finance_wallets SET metadata=?, ...").run(JSON.stringify(merged), id);
```

But `finance:create-transfer`'s crypto→crypto path uses a `writeMeta` helper that **encrypts** with `financeDataKey`. Then `finance:get-wallets` (line 23123) attempts to decrypt every wallet's metadata. The result:

- If metadata is **plain JSON** and `financeDataKey` is set → `decryptField` returns it unchanged (the `if (!value.startsWith(ENC_PREFIX)) return value` guard saves us). OK.
- If metadata is **encrypted** but `financeDataKey` is null → `JSON.parse(encryptedString)` fails → `metadata = null` → **all crypto assets vanish from the UI**.

This single bug explains:
1. Buy mechanism appears broken — assets get saved to metadata but then vanish on next read when encryption state mismatches.
2. Recalculate "produces wrong results" — it reads `wallet.metadata` and tries `JSON.parse` on potentially encrypted data, gets `{}`, finds no assets, and skips crypto transfer detection.
3. Crypto→crypto transfers "lose" assets — same metadata corruption.

### The Hardcoded Category Bug (Root Cause #2)

`handleAddAsset` in WalletDetailView.tsx passes `category_id: 1`. In fresh databases the seed `finance_categories` table may not have id=1, OR id=1 may be a non-expense category (like "Salary" income). The INSERT either fails (FK constraint) or creates a semantically wrong transaction. Worse: the error is swallowed by the try/catch, so the user sees nothing happen.

### The is_adjustment Filter Misunderstanding (Root Cause #3)

Recalculate correctly **includes** `is_adjustment=1` transactions (they affect balance). But several summary handlers may not **exclude** them from spending/income totals. Need to verify all summary handlers.

---

## Task A: Fix the Crypto Buy Mechanism

### A.1 Backend: `finance:create-transaction` — Category Fallback

**File:** `src/main.ts`
**Location:** `finance:create-transaction` handler (~line 23775)

**Replace the handler with:**

```typescript
ipcMain.handle('finance:create-transaction', async (_event, data: {
  account_id: number; wallet_id: number | null; category_id: number;
  type: string; amount: number; description: string; note?: string;
  date: string; time?: string; metadata?: any; is_adjustment?: number;
  fee?: number; merchant?: string;
}) => {
  if (!db) return null;
  try {
    // === CATEGORY RESOLUTION (fixes hardcoded category_id:1) ===
    let resolvedCategoryId = data.category_id;
    const catExists = db.prepare('SELECT id FROM finance_categories WHERE id = ?').get(data.category_id) as any;
    if (!catExists) {
      // Fallback: find any category matching the transaction type
      const fallback = db.prepare(
        `SELECT id FROM finance_categories WHERE type = ? OR type IS NULL ORDER BY id LIMIT 1`
      ).get(data.type) as any;
      if (fallback) {
        resolvedCategoryId = fallback.id;
      } else {
        // Last resort: find ANY category
        const anyCat = db.prepare('SELECT id FROM finance_categories ORDER BY id LIMIT 1').get() as any;
        if (anyCat) resolvedCategoryId = anyCat.id;
        else resolvedCategoryId = 0; // Allow 0 if schema permits; otherwise fails loudly
      }
      console.warn(`[finance] category_id ${data.category_id} not found, fell back to ${resolvedCategoryId}`);
    }

    // === INSERT TRANSACTION (all 13 columns explicitly) ===
    const stmt = db.prepare(
      `INSERT INTO finance_transactions
       (account_id, wallet_id, category_id, type, amount, description, note, date, time, metadata, is_adjustment, fee, merchant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const metaJson = data.metadata ? JSON.stringify(data.metadata) : null;
    const info = stmt.run(
      data.account_id,
      data.wallet_id ?? null,
      resolvedCategoryId,
      data.type,
      data.amount,
      data.description || '',
      data.note || '',
      data.date,
      data.time || null,
      metaJson,
      data.is_adjustment || 0,
      data.fee || 0,
      data.merchant || null
    );
    const txn = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(info.lastInsertRowid) as any;

    // === CRYPTO BUY: Update wallet metadata + balance ===
    // Parse metadata to detect crypto buy
    let parsedMeta: any = null;
    if (txn?.metadata) {
      try { parsedMeta = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata; } catch {}
    }
    if (parsedMeta && (parsedMeta.coinId || parsedMeta.coin_id) && data.wallet_id && data.type === 'expense') {
      // This is a crypto buy — update wallet.metadata.assets and wallet.balance atomically
      const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(data.wallet_id) as any;
      if (wallet) {
        // Decrypt existing metadata if encrypted
        let meta: any = {};
        if (wallet.metadata) {
          const rawMeta = (financeDataKey && isEncrypted(wallet.metadata))
            ? decryptField(wallet.metadata, financeDataKey)
            : wallet.metadata;
          try { meta = JSON.parse(rawMeta); } catch { meta = {}; }
        }
        const assets: any[] = Array.isArray(meta.assets) ? meta.assets : [];
        // Add new asset
        const newAsset = {
          coin_id: parsedMeta.coinId || parsedMeta.coin_id,
          symbol: parsedMeta.symbol || '',
          name: parsedMeta.name || '',
          amount: Number(parsedMeta.qty) || 0,
          avg_buy_price: Number(parsedMeta.price) || 0,
          asset_type: 'crypto',
          txn_id: txn.id,
        };
        assets.push(newAsset);
        meta.assets = assets;

        // Write metadata — ENCRYPT if financeDataKey is set (fixes encryption inconsistency)
        const metaToWrite = financeDataKey ? encryptField(JSON.stringify(meta), financeDataKey) : JSON.stringify(meta);

        // Decrypt current balance if encrypted
        let curBalance = 0;
        if (wallet.balance != null) {
          curBalance = (financeDataKey && isEncrypted(String(wallet.balance)))
            ? Number(decryptField(String(wallet.balance), financeDataKey)) || 0
            : Number(wallet.balance) || 0;
        }
        const newBalance = curBalance - Math.abs(data.amount);
        const balToWrite = financeDataKey ? encryptField(String(newBalance), financeDataKey) : String(newBalance);

        db.prepare(
          `UPDATE finance_wallets SET metadata = ?, balance = ?, updated_at = datetime('now','localtime') WHERE id = ?`
        ).run(metaToWrite, balToWrite, data.wallet_id);
      }
    }

    if (txn?.metadata) {
      try { txn.metadata = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata; } catch {}
    }
    return txn;
  } catch (e: any) {
    console.error('[finance] create-transaction error:', e.message);
    return null;
  }
});
```

**Why this fixes the buy mechanism:**
1. Category_id fallback prevents INSERT failures when `category_id: 1` doesn't exist.
2. Crypto buy is handled **atomically in the same handler** — wallet metadata + balance updated together, so the asset can't "disappear" between INSERT and metadata update.
3. Metadata is encrypted **consistently** with `financeDataKey`, fixing the inconsistency bug.

### A.2 Frontend: `handleAddAsset` — Remove Hardcoded Category

**File:** `src/components/finance/WalletDetailView.tsx`
**Location:** `handleAddAsset` (~line 680)

**Replace the regular buy branch (non-historical):**

```typescript
} else {
  // Regular buy — create expense transaction
  // Find an expense category from the wallet's account; don't hardcode id:1
  let expenseCategoryId = 1;
  try {
    const cats = await (window as any).deskflowAPI?.financeGetCategories() as any[];
    const expenseCat = cats?.find((c: any) => c.type === 'expense') || cats?.[0];
    if (expenseCat) expenseCategoryId = expenseCat.id;
  } catch { /* keep fallback 1, backend will resolve if invalid */ }

  const result = await (window as any).deskflowAPI?.financeCreateTransaction({
    account_id: wallet.account_id,
    wallet_id: wallet.id,
    category_id: expenseCategoryId,
    type: 'expense',
    amount: spentFiat,
    description: `Buy ${amount.toFixed(6)} ${symbol}`,
    note: `Crypto: ${name} (${selectedCoinId}) @ ${fmtCurrency(parseFloat(newAssetAvgPrice) || 0, displayCurrency)}`,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    metadata: cryptoMetadata,
  });
  if (!result || !result.id) {
    setFiatError('Failed to create buy transaction — see console for details');
    return;  // Don't update local state if backend failed
  }
  createdTxnId = result.id;
}
```

**Then change the local state update** — since backend now updates metadata directly, we should re-fetch the wallet instead of optimistically patching local state:

```typescript
// After transaction creation, call onChange to trigger auto-save AND refetch wallet
onChange('assets', JSON.stringify(finalAssets));
setShowAddAsset(false);
// Reset form state...
setSearchCoin(''); setSelectedCoinId(''); setNewAssetAmount(''); setNewAssetAvgPrice('');
setNewTotalSpent(''); setAddMode('manual'); setIsHistorical(false); setFiatError(null);
```

**Note:** If the WalletDetailView's parent (FinancePage) re-fetches wallets after `financeCreateTransaction` returns (which it does via the `onChange` → auto-save → `fetchData` chain), the wallet will come back with the backend-authoritative metadata, eliminating any local/backend mismatch.

### A.3 Backend: `finance:update-wallet-metadata` — Fix Encryption Consistency

**File:** `src/main.ts`
**Location:** `finance:update-wallet-metadata` (~line 23327)

**Replace the metadata write block:**

```typescript
ipcMain.handle('finance:update-wallet-metadata', async (_event, { id, metadata }: { id: number; metadata: Record<string, any> }) => {
  if (!db) return null;
  try {
    const existing = db.prepare('SELECT metadata, name FROM finance_wallets WHERE id = ?').get(id) as any;
    if (!existing) return null;

    // === DECRYPT existing metadata if encrypted (fixes read inconsistency) ===
    let merged: Record<string, any> = {};
    if (existing.metadata) {
      const rawMeta = (financeDataKey && isEncrypted(existing.metadata))
        ? decryptField(existing.metadata, financeDataKey)
        : existing.metadata;
      try { merged = JSON.parse(rawMeta); } catch { merged = {}; }
    }
    const oldAssets: any[] = Array.isArray(merged.assets) ? [...merged.assets] : [];
    Object.assign(merged, metadata);
    const newAssets: any[] = Array.isArray(merged.assets) ? [...merged.assets] : [];

    // === ENCRYPT metadata if financeDataKey is set (fixes write inconsistency) ===
    const jsonPlain = JSON.stringify(merged);
    const jsonToWrite = financeDataKey ? encryptField(jsonPlain, financeDataKey) : jsonPlain;

    db.prepare("UPDATE finance_wallets SET metadata=?, updated_at=datetime('now','localtime') WHERE id=?").run(jsonToWrite, id);

    // === Record asset history for changed coins (unchanged) ===
    try {
      const priceRows = db.prepare('SELECT coin_id, current_price FROM finance_crypto_prices').all() as any[];
      const priceMap = new Map(priceRows.map((r: any) => [r.coin_id.toLowerCase(), Number(r.current_price) || 0]));
      const oldMap = new Map(oldAssets.map((a: any) => [(a.coin_id || a.coinId || a.asset || '').toLowerCase(), a]));
      const newMap = new Map(newAssets.map((a: any) => [(a.coin_id || a.coinId || a.asset || '').toLowerCase(), a]));
      for (const [cid, a] of newMap) {
        const oldAmt = oldMap.has(cid) ? Number(oldMap.get(cid)!.amount) || 0 : 0;
        const newAmt = Number(a.amount) || 0;
        if (oldAmt !== newAmt) {
          const curPrice = priceMap.get(cid) || Number(a.avg_buy_price || a.avgBuyPrice) || 0;
          recordCryptoAssetHistory(id, cid, newAmt, Number(a.avg_buy_price || a.avgBuyPrice) || 0, curPrice);
        }
      }
    } catch { /* best-effort */ }

    const updated = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(id) as any;
    if (updated?.metadata) {
      const rawMeta = (financeDataKey && isEncrypted(updated.metadata))
        ? decryptField(updated.metadata, financeDataKey)
        : updated.metadata;
      try { updated.metadata = JSON.parse(rawMeta); } catch { updated.metadata = null; }
    }
    return updated;
  } catch (e: any) {
    console.error('[finance] update-wallet-metadata error:', e.message);
    return null;
  }
});
```

**Critical:** This ensures `finance:update-wallet-metadata` and `finance:create-transfer`'s crypto→crypto path both encrypt when `financeDataKey` is set, and both write plain JSON when it's null. Reads are now consistent.

---

## Task B: Fix Recalculate

**File:** `src/main.ts`
**Location:** `finance:recalculate-balances` (~line 25734)

**Key issues fixed:**
1. `wallet.initial_balance` may be encrypted → decrypt before use.
2. `t.metadata` may be encrypted → decrypt before `JSON.parse`.
3. `wallet.balance` write should encrypt if `financeDataKey` is set.
4. `is_adjustment=1` transactions are **kept** (they affect balance) — already correct, but make explicit with comment.

**Replace the entire handler:**

```typescript
// Helper: decrypt a value if encrypted, return original otherwise
function safeDecrypt(value: any): string {
  if (value == null) return '';
  const s = String(value);
  return (financeDataKey && isEncrypted(s)) ? decryptField(s, financeDataKey) : s;
}

// Helper: parse JSON metadata, handling encryption
function parseTxnMetadata(raw: any): any {
  if (!raw) return null;
  try {
    const decoded = safeDecrypt(raw);
    return JSON.parse(decoded);
  } catch { return null; }
}

ipcMain.handle('finance:recalculate-balances', async (_event, walletId?: number, preview?: boolean) => {
  if (!db) return { error: 'No database' };
  try {
    if (walletId) {
      // === SINGLE WALLET RECALCULATE ===
      const wallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(walletId) as any;
      if (!wallet) return { error: 'Wallet not found' };

      // Decrypt initial_balance
      const initialBalance = Number(safeDecrypt(wallet.initial_balance)) || 0;

      const txns = db.prepare('SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, id ASC').all(walletId) as any[];

      let balance = initialBalance;
      const breakdown: any[] = [];
      const isCryptoWallet = wallet.type === 'crypto' || wallet.type === 'investment';

      for (const t of txns) {
        // KEY INVARIANT: is_adjustment=1 transactions DO affect balance.
        // They are stored as type='income'/'expense', so the type check below naturally includes them.
        // Do NOT filter them out here.
        if (t.type === 'income') {
          balance += Math.abs(t.amount);
        } else if (t.type === 'expense') {
          balance -= Math.abs(t.amount);
        } else if (t.type === 'transfer') {
          // For crypto wallets: skip crypto→crypto transfer balance adjustments
          // (crypto→crypto moves assets via metadata, NOT fiat balance)
          if (isCryptoWallet) {
            const meta = parseTxnMetadata(t.metadata);
            if (meta && (meta.coinId || meta.coin_id)) {
              // This is a crypto transfer — skip balance update for crypto wallets
              // (the asset itself was moved via metadata, not fiat)
              breakdown.push({
                date: t.date, type: t.type, amount: t.amount,
                runningBalance: balance, id: t.id, is_adjustment: t.is_adjustment,
                skipped: 'crypto-transfer'
              });
              continue;
            }
          }
          // Standard transfer balance logic
          if (t.amount < 0) {
            // Outgoing transfer
            balance -= Math.abs(t.amount);
            balance -= (t.fee || 0);
          } else {
            // Incoming transfer
            balance += Math.abs(t.amount);
          }
        }
        breakdown.push({
          date: t.date, type: t.type, amount: t.amount,
          runningBalance: balance, id: t.id, is_adjustment: t.is_adjustment
        });
      }

      // Apply if not preview
      if (!preview) {
        const balToWrite = financeDataKey ? encryptField(String(balance), financeDataKey) : String(balance);
        db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
          .run(balToWrite, walletId);
      }

      return {
        success: true,
        walletName: wallet.name,
        initialBalance,
        oldBalance: Number(safeDecrypt(wallet.balance)) || 0,
        newBalance: balance,
        breakdown
      };
    } else {
      // === ALL WALLETS RECALCULATE + BACKFILL CRYPTO HISTORY ===
      const wallets = db.prepare('SELECT * FROM finance_wallets WHERE is_archived = 0').all() as any[];
      let updatedCount = 0;

      for (const w of wallets) {
        const initialBalance = Number(safeDecrypt(w.initial_balance)) || 0;
        const txns = db.prepare('SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, id ASC').all(w.id) as any[];
        const isCryptoWallet = w.type === 'crypto' || w.type === 'investment';

        let balance = initialBalance;
        for (const t of txns) {
          if (t.type === 'income') {
            balance += Math.abs(t.amount);
          } else if (t.type === 'expense') {
            balance -= Math.abs(t.amount);
          } else if (t.type === 'transfer') {
            if (isCryptoWallet) {
              const meta = parseTxnMetadata(t.metadata);
              if (meta && (meta.coinId || meta.coin_id)) continue;
            }
            if (t.amount < 0) {
              balance -= Math.abs(t.amount);
              balance -= (t.fee || 0);
            } else {
              balance += Math.abs(t.amount);
            }
          }
        }

        // Write balance — encrypt if financeDataKey set
        const balToWrite = financeDataKey ? encryptField(String(balance), financeDataKey) : String(balance);
        db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
          .run(balToWrite, w.id);
        updatedCount++;

        // Backfill crypto asset history for crypto wallets
        if (isCryptoWallet && w.metadata) {
          let meta: any = {};
          try {
            const rawMeta = safeDecrypt(w.metadata);
            meta = JSON.parse(rawMeta);
          } catch { meta = {}; }
          const assets: any[] = Array.isArray(meta.assets) ? meta.assets : [];
          for (const a of assets) {
            const coinId = (a.coin_id || a.coinId || a.asset || '').toLowerCase();
            if (!coinId) continue;
            const priceRow = db.prepare('SELECT current_price FROM finance_crypto_prices WHERE coin_id = ?').get(coinId) as any;
            const curPrice = priceRow?.current_price || a.avg_buy_price || 0;
            recordCryptoAssetHistory(w.id, coinId, Number(a.amount) || 0, Number(a.avg_buy_price) || 0, curPrice);
          }
        }
      }
      return { success: true, message: `Recalculated ${updatedCount} wallets`, updatedCount };
    }
  } catch (e: any) {
    console.error('[finance] recalculate-balances error:', e.message);
    return { error: e.message };
  }
});
```

**Why this fixes recalculate:**
- `safeDecrypt` handles both encrypted and plaintext values uniformly.
- `parseTxnMetadata` correctly decrypts transaction metadata before checking for crypto transfer markers.
- `is_adjustment` transactions are explicitly **kept** (they fall through to the income/expense branches naturally — no filter).
- Wallet balance writes are encrypted when `financeDataKey` is set, preventing future read failures.

---

## Task C: Fix Crypto Transaction Display

**File:** `src/components/finance/TransactionsTab.tsx`

**Location:** Inside the transaction row render function (where amount is displayed).

**Add a helper function near the top of the file (after imports):**

```typescript
/**
 * Parse transaction metadata safely (handles string or object).
 * Returns null if metadata is missing or invalid.
 */
function parseTxnMeta(t: FinanceTransaction): any | null {
  if (!t.metadata) return null;
  try {
    return typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
  } catch { return null; }
}

/**
 * Determine if a transaction is a crypto transaction (has coinId in metadata).
 */
function isCryptoTxn(t: FinanceTransaction): boolean {
  const m = parseTxnMeta(t);
  return !!(m && (m.coinId || m.coin_id));
}

/**
 * Format crypto quantity with appropriate precision.
 * BTC: 6 decimals, ETH: 6 decimals, small-cap: 8 decimals
 */
function formatCryptoQty(qty: number, symbol: string): string {
  if (!qty || isNaN(qty)) return '0';
  // Use up to 8 significant digits, strip trailing zeros
  const formatted = qty >= 1
    ? qty.toFixed(6).replace(/\.?0+$/, '')
    : qty.toFixed(8).replace(/\.?0+$/, '');
  return `${formatted} ${symbol}`;
}

/**
 * Compute fiat equivalent for a crypto transaction from metadata.
 * Returns { fiatAmount, fiatLabel } or null.
 */
function getCryptoFiatEquivalent(t: FinanceTransaction, displayCurrency: string): { amount: number; label: string } | null {
  const m = parseTxnMeta(t);
  if (!m) return null;
  const qty = Number(m.qty) || 0;
  const price = Number(m.price) || 0;
  const total = Number(m.total) || (qty * price);
  if (!total) return null;
  const sym = getCurrencyInfo(displayCurrency).symbol;
  return { amount: total, label: `≈ ${sym}${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
}
```

**Modify the transaction row rendering** — locate the JSX where `formatCurrency(Math.abs(t.amount), displayCurrency)` is rendered as the primary amount. Replace with:

```tsx
{/* Amount display — crypto transactions show qty primary, fiat secondary */}
{isCryptoTxn(t) ? (() => {
  const m = parseTxnMeta(t)!;
  const symbol = (m.symbol || m.coinId || '').toUpperCase();
  const qty = Number(m.qty) || 0;
  const fiatEq = getCryptoFiatEquivalent(t, displayCurrency);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`text-sm font-semibold tabular-nums ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
        {t.type === 'income' ? '+' : '-'}{formatCryptoQty(qty, symbol)}
      </span>
      {fiatEq && (
        <span className="text-[10px] text-zinc-500 tabular-nums">
          {fiatEq.label}
        </span>
      )}
    </div>
  );
})() : (
  /* Standard fiat transaction display — unchanged */
  <span className={`text-sm font-semibold tabular-nums ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
    {t.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(t.amount), displayCurrency)}
  </span>
)}
```

**Apply the same pattern to the historical section** (violet-bordered historical transactions) — they use the same amount rendering logic. Locate the historical txn JSX block and apply the same conditional.

**Test verification:**
1. Buy 0.5 BTC at $40,000 → transaction shows "0.5 BTC" as primary, "≈ $20,000.00" as secondary.
2. Sell 0.1 BTC at $42,000 → transaction shows "0.1 BTC" as primary (with minus sign for expense/sell).
3. Fiat transfer of $500 → shows "$500.00" only (no crypto subtitle).

---

## Task D: Verify Sync Button Feedback

The existing implementation is largely correct. Required verifications:

### D.1 Verify `FinanceStickyHeader` sync results banner placement

**File:** `src/components/finance/FinanceStickyHeader.tsx`

**Issue:** The sync results banner (lines ~243-263) must be **outside** the GlassSurface component that has `overflow-hidden`, otherwise the banner's expand animation gets clipped.

**Verification/fix:** Ensure the AnimatePresence block is a **sibling** of the GlassSurface, not a child:

```tsx
// CORRECT structure:
<>
  <GlassSurface className="... overflow-hidden">
    {/* header content with sync button */}
  </GlassSurface>

  {/* Sync results banner — OUTSIDE GlassSurface overflow-hidden */}
  <AnimatePresence>
    {syncResults && syncResults.length > 0 && !syncStatus && (
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.2 }}
        className="sticky top-[48px] z-[14] mx-4 sm:mx-6 mb-2"
      >
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
          <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-emerald-300">
            {syncResults.map((r, i) => (<span key={i}>{r}</span>))}
          </div>
          <button
            onClick={() => onSyncDismiss?.()}
            className="ml-auto text-emerald-400/60 hover:text-emerald-400 transition-colors"
            aria-label="Dismiss sync results"
          >✕</button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</>
```

### D.2 Add `onSyncDismiss` prop

**File:** `src/components/finance/FinanceStickyHeader.tsx`

**Add to interface:**
```typescript
interface FinanceStickyHeaderProps {
  // ... existing props
  onSyncDismiss?: () => void;
}
```

**File:** `src/pages/FinancePage.tsx`

**Pass the dismiss handler:**
```tsx
<FinanceStickyHeader
  // ... existing props
  syncStatus={syncStatus}
  syncResults={syncResults}
  onSyncBalances={handleRecalculateAllBalances}
  onSyncDismiss={() => setSyncResults(null)}
/>
```

### D.3 Sync status — multi-phase already correct

The existing `handleRecalculateAllBalances` in FinancePage.tsx (line 655) has correct phases:
1. "Fixing historical dates..."
2. "Scanning wallets..."
3. "Syncing {N} wallets..." → "Syncing {walletName}..."
4. "Backfilling crypto history..."
5. "Done!"

The button label shows `syncStatus.phase` while active, "Sync" when idle. Spinner animates via `syncStatus ? 'animate-spin' : ''`. This is correct.

**Add error-phase visual feedback:**

```tsx
// In FinanceStickyHeader.tsx, sync button — change color when sync failed
{onSyncBalances && (
  <button
    onClick={onSyncBalances}
    disabled={!!syncStatus}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors disabled:opacity-50
      ${syncResults && syncResults.some(r => r.toLowerCase().includes('failed'))
        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
        : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}
  >
    <RefreshCw className={`w-3 h-3 ${syncStatus ? 'animate-spin' : ''}`} />
    {syncStatus ? syncStatus.phase : 'Sync'}
  </button>
)}
```

---

## Task E: Verify Fiat Balance Isolation

**File:** `src/main.ts`
**Location:** `finance:create-transfer` (~line 23919)

The existing code has confusing and partially incorrect branch logic. **Replace the entire handler** with clear, explicit branch handling:

```typescript
ipcMain.handle('finance:create-transfer', async (_event, data) => {
  if (!db) return { error: 'No database' };
  const {
    wallet_id, to_wallet_id, amount, fee = 0, description, note,
    date, time, account_id, metadata, dest_metadata, assetIdx, qty, price
  } = data;

  const srcWallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(wallet_id) as any;
  const dstWallet = db.prepare('SELECT * FROM finance_wallets WHERE id = ?').get(to_wallet_id) as any;
  if (!srcWallet || !dstWallet) return { error: 'Wallet not found' };

  const srcIsCrypto = srcWallet.type === 'crypto' || srcWallet.type === 'investment';
  const dstIsCrypto = dstWallet.type === 'crypto' || dstWallet.type === 'investment';

  // === THREE-WAY BRANCH (clear and explicit) ===
  const isCryptoToCrypto = srcIsCrypto && dstIsCrypto;
  const isCryptoToFiat = srcIsCrypto && !dstIsCrypto;
  const isFiatToFiat = !srcIsCrypto && !dstIsCrypto;
  // (fiat→crypto is treated as a buy, not a transfer — should use create-transaction)

  const transferId = `tf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const metaJson = metadata ? JSON.stringify(metadata) : null;
  const destMetaJson = dest_metadata ? JSON.stringify(dest_metadata) : null;

  try {
    // === INSERT TRANSFER TRANSACTIONS (always, for audit trail) ===
    db.prepare(
      `INSERT INTO finance_transactions
       (account_id, wallet_id, category_id, type, amount, description, note, date, time, transfer_id, from_wallet_id, to_wallet_id, fee, metadata)
       VALUES (?, ?, 0, 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      account_id, wallet_id, -Math.abs(amount),
      description || `Transfer to ${dstWallet.name}`, note || '',
      date, time || new Date().toTimeString().slice(0, 5),
      transferId, wallet_id, to_wallet_id, fee, metaJson
    );

    db.prepare(
      `INSERT INTO finance_transactions
       (account_id, wallet_id, category_id, type, amount, description, note, date, time, transfer_id, from_wallet_id, to_wallet_id, fee, metadata)
       VALUES (?, ?, 0, 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      account_id, to_wallet_id, 0, Math.abs(amount),
      description || `Transfer from ${srcWallet.name}`, note || '',
      date, time || new Date().toTimeString().slice(0, 5),
      transferId, wallet_id, to_wallet_id, 0, destMetaJson
    );

    // === BRANCH 1: FIAT → FIAT (standard) ===
    // Update both wallets' fiat balances.
    if (isFiatToFiat) {
      // Source: subtract amount + fee
      const srcBal = Number(safeDecrypt(srcWallet.balance)) || 0;
      const newSrcBal = srcBal - Math.abs(amount) - (fee || 0);
      const srcBalWrite = financeDataKey ? encryptField(String(newSrcBal), financeDataKey) : String(newSrcBal);
      db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(srcBalWrite, wallet_id);

      // Dest: add amount
      const dstBal = Number(safeDecrypt(dstWallet.balance)) || 0;
      const newDstBal = dstBal + Math.abs(amount);
      const dstBalWrite = financeDataKey ? encryptField(String(newDstBal), financeDataKey) : String(newDstBal);
      db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(dstBalWrite, to_wallet_id);
    }

    // === BRANCH 2: CRYPTO → FIAT (sell / off-ramp) ===
    // Source crypto wallet: NO fiat balance change (the fiat value was already represented
    // by the asset itself; selling converts the asset to fiat in the dest wallet).
    // Dest fiat wallet: receives the fiat amount.
    // CRITICAL: Source crypto wallet's `balance` (fiat) is NOT modified.
    if (isCryptoToFiat) {
      // 2a. Reduce the asset quantity in source wallet's metadata
      let srcMeta: any = {};
      try {
        const raw = safeDecrypt(srcWallet.metadata);
        srcMeta = JSON.parse(raw);
      } catch { srcMeta = {}; }
      const srcAssets: any[] = Array.isArray(srcMeta.assets) ? srcMeta.assets : [];

      if (assetIdx !== undefined && assetIdx >= 0 && assetIdx < srcAssets.length) {
        const asset = srcAssets[assetIdx];
        const sellQty = Number(qty) || 0;
        const newAmt = Number(asset.amount) - sellQty;
        if (newAmt <= 0) {
          // Remove asset entirely
          srcAssets.splice(assetIdx, 1);
        } else {
          srcAssets[assetIdx] = { ...asset, amount: newAmt };
        }
        srcMeta.assets = srcAssets;
        const metaWrite = financeDataKey
          ? encryptField(JSON.stringify(srcMeta), financeDataKey)
          : JSON.stringify(srcMeta);
        db.prepare("UPDATE finance_wallets SET metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?")
          .run(metaWrite, wallet_id);
      }

      // 2b. Add fiat to dest wallet
      const dstBal = Number(safeDecrypt(dstWallet.balance)) || 0;
      const newDstBal = dstBal + Math.abs(amount);
      const dstBalWrite = financeDataKey ? encryptField(String(newDstBal), financeDataKey) : String(newDstBal);
      db.prepare("UPDATE finance_wallets SET balance = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(dstBalWrite, to_wallet_id);
    }

    // === BRANCH 3: CRYPTO → CRYPTO (asset move between wallets) ===
    // NO fiat balance changes on either wallet.
    // Move the asset from source metadata to dest metadata.
    if (isCryptoToCrypto) {
      let srcMeta: any = {};
      try {
        const raw = safeDecrypt(srcWallet.metadata);
        srcMeta = JSON.parse(raw);
      } catch { srcMeta = {}; }
      let dstMeta: any = {};
      try {
        const raw = safeDecrypt(dstWallet.metadata);
        dstMeta = JSON.parse(raw);
      } catch { dstMeta = {}; }

      const srcAssets: any[] = Array.isArray(srcMeta.assets) ? srcMeta.assets : [];
      const dstAssets: any[] = Array.isArray(dstMeta.assets) ? dstMeta.assets : [];

      if (assetIdx !== undefined && assetIdx >= 0 && assetIdx < srcAssets.length) {
        const movedAsset = { ...srcAssets[assetIdx] };
        const moveQty = Number(qty) || Number(movedAsset.amount) || 0;

        // Partial move: reduce source, push new entry to dest
        const remaining = Number(movedAsset.amount) - moveQty;
        if (remaining <= 0) {
          srcAssets.splice(assetIdx, 1);
        } else {
          srcAssets[assetIdx] = { ...movedAsset, amount: remaining };
        }

        // Check if dest already has this coin — merge if so
        const existingDestIdx = dstAssets.findIndex(
          (a: any) => (a.coin_id || a.coinId) === (movedAsset.coin_id || movedAsset.coinId)
        );
        if (existingDestIdx >= 0) {
          const existing = dstAssets[existingDestIdx];
          const oldQty = Number(existing.amount) || 0;
          const oldCost = Number(existing.avg_buy_price) || 0;
          const newQty = oldQty + moveQty;
          const movedCost = Number(movedAsset.avg_buy_price) || 0;
          // Weighted average buy price
          const newAvg = newQty > 0 ? ((oldQty * oldCost) + (moveQty * movedCost)) / newQty : movedCost;
          dstAssets[existingDestIdx] = { ...existing, amount: newQty, avg_buy_price: newAvg };
        } else {
          dstAssets.push({ ...movedAsset, amount: moveQty });
        }
      }

      srcMeta.assets = srcAssets;
      dstMeta.assets = dstAssets;

      const srcMetaWrite = financeDataKey
        ? encryptField(JSON.stringify(srcMeta), financeDataKey)
        : JSON.stringify(srcMeta);
      const dstMetaWrite = financeDataKey
        ? encryptField(JSON.stringify(dstMeta), financeDataKey)
        : JSON.stringify(dstMeta);

      db.prepare("UPDATE finance_wallets SET metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(srcMetaWrite, wallet_id);
      db.prepare("UPDATE finance_wallets SET metadata = ?, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(dstMetaWrite, to_wallet_id);

      // CRITICAL: NO balance updates for either wallet in crypto→crypto.
    }

    return { success: true, transferId };
  } catch (e: any) {
    console.error('[finance] create-transfer error:', e.message);
    return { error: e.message };
  }
});
```

**Fiat isolation guarantee:**
- `isFiatToFiat` → updates both fiat balances. ✓
- `isCryptoToFiat` → updates **only dest** fiat balance; source crypto wallet's `balance` is untouched. ✓
- `isCryptoToCrypto` → **no** `balance` column updates on either wallet; only `metadata.assets` is moved. ✓

---

## Task F: Verify Historical Data Flow (`is_adjustment`)

### F.1 Backend summary handlers — verify `is_adjustment = 0` filter

**File:** `src/main.ts`

**Locate each of these handlers and verify they include `AND is_adjustment = 0` in their WHERE clauses:**

#### `finance:get-summary`
```typescript
// Example fix — locate the expense/income SUM queries:
const expenseRow = db.prepare(
  `SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions
   WHERE account_id = ? AND type = 'expense' AND is_adjustment = 0
   ${dateFilter ? 'AND date >= ? AND date <= ?' : ''}`
).get(...params) as any;

const incomeRow = db.prepare(
  `SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions
   WHERE account_id = ? AND type = 'income' AND is_adjustment = 0
   ${dateFilter ? 'AND date >= ? AND date <= ?' : ''}`
).get(...params) as any;
```

#### `finance:get-spending-by-category`
```typescript
const rows = db.prepare(
  `SELECT category_id, SUM(amount) as total, COUNT(*) as count
   FROM finance_transactions
   WHERE account_id = ? AND type = 'expense' AND is_adjustment = 0
   ${dateFilter ? 'AND date >= ? AND date <= ?' : ''}
   GROUP BY category_id ORDER BY total DESC`
).all(...params) as any[];
```

#### `finance:get-monthly-trends`
```typescript
const rows = db.prepare(
  `SELECT substr(date, 1, 7) as month,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
   FROM finance_transactions
   WHERE account_id = ? AND is_adjustment = 0
   GROUP BY substr(date, 1, 7)
   ORDER BY month DESC
   LIMIT 12`
).all(accountId) as any[];
```

#### `finance:get-cashflow-runway`
```typescript
// Monthly expense average — exclude is_adjustment
const avgExpenseRow = db.prepare(
  `SELECT AVG(monthly_total) as avg FROM (
     SELECT SUM(amount) as monthly_total
     FROM finance_transactions
     WHERE account_id = ? AND type = 'expense' AND is_adjustment = 0
     GROUP BY substr(date, 1, 7)
     ORDER BY substr(date, 1, 7) DESC
     LIMIT 3
   )`
).get(accountId) as any;
```

#### `finance:get-net-worth` (if exists)
```typescript
// Net worth should NOT include is_adjustment in spending, but SHOULD include
// them in wallet balances (since recalculate includes them).
// So: wallet balances already include is_adjustment (correct).
// Spending totals used for "this month spent" should exclude is_adjustment.
```

### F.2 Frontend verification (already correct per context bundle)

The context bundle confirms these already exclude `is_adjustment`:
- `FinanceChartsTab.tsx` → `netWorthSeries`: `if (t.is_adjustment) continue;` ✓
- `useSelectionAggregate.ts`: `if (t.is_adjustment) continue;` ✓
- `SpendingCategoryChart.tsx` FT logic: `t.on_behalf_of === 1 && t.type === 'expense' && !t.is_adjustment` ✓

### F.3 Add a backend sanity migration

**File:** `src/main.ts` — in the DB initialization block (after table creation)

```typescript
// Safety: ensure all is_adjustment transactions have date='1900-01-01' for chronological sort
try {
  db.exec(`UPDATE finance_transactions SET date = '1900-01-01' WHERE is_adjustment = 1 AND date > '1900-01-01'`);
} catch (e) {
  console.warn('[finance] migration: is_adjustment date fix skipped:', (e as Error).message);
}

// Safety: ensure is_adjustment flag is integer 0 or 1
try {
  db.exec(`UPDATE finance_transactions SET is_adjustment = 0 WHERE is_adjustment IS NULL OR is_adjustment NOT IN (0, 1)`);
} catch (e) {
  console.warn('[finance] migration: is_adjustment normalization skipped:', (e as Error).message);
}
```

---

## Design Task: Crypto Wallet Detail View Enhancements

The existing `CryptoDetail` component (WalletDetailView.tsx lines 411-1377) already implements most design requirements. Required enhancements:

### 1. Portfolio Value Card — Add Live Price Indicator

**File:** `src/components/finance/WalletDetailView.tsx`
**Location:** Inside CryptoDetail, portfolio value card JSX

```tsx
<GlassSurface tier={2} className="p-5">
  <div className="flex items-start justify-between mb-3">
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Portfolio Value</div>
      <div className="text-2xl font-bold tabular-nums text-white">
        {fmtCurrency(totalValue, displayCurrency)}
      </div>
    </div>
    <div className="flex flex-col items-end gap-1">
      {/* Live price indicator */}
      {loadingPrices ? (
        <span className="text-[10px] text-amber-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
        </span>
      ) : lastUpdated ? (
        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {stale ? 'Stale' : 'Live'} · {new Date(lastUpdated).toLocaleTimeString()}
        </span>
      ) : null}
    </div>
  </div>

  {/* P&L bar */}
  <div className="flex items-center gap-3 mt-2">
    <span className={`text-xs font-medium tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
      {totalPnl >= 0 ? '▲' : '▼'} {fmtCurrency(Math.abs(totalPnl), displayCurrency)}
    </span>
    <span className={`text-[10px] tabular-nums ${totalPnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
      ({totalPnlPct.toFixed(2)}%)
    </span>
  </div>
</GlassSurface>
```

### 2. Per-Coin Asset Row — Crypto Quantity Primary, Fiat Secondary

```tsx
{assets.map((a, idx) => {
  const price = prices.find(p => p.coin_id === a.coin_id);
  const curPrice = price?.current_price || 0;
  const fiatValue = a.amount * curPrice;
  const pnl = fiatValue - (a.amount * a.avg_buy_price);
  const pnlPct = a.avg_buy_price > 0 ? (pnl / (a.amount * a.avg_buy_price)) * 100 : 0;

  return (
    <GlassSurface key={idx} tier={1} className="p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
      onClick={() => setDetailAsset({ coinId: a.coin_id, symbol: a.symbol, name: a.name })}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Coin icon */}
          <div className="w-9 h-9 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 font-bold text-xs shrink-0">
            {a.symbol.slice(0, 3)}
          </div>
          <div className="min-w-0">
            {/* PRIMARY: crypto quantity + symbol */}
            <div className="text-sm font-semibold text-white tabular-nums truncate">
              {a.amount.toFixed(6).replace(/\.?0+$/, '')} {a.symbol}
            </div>
            {/* SECONDARY: fiat value */}
            <div className="text-[11px] text-zinc-500 tabular-nums">
              ≈ {fmtCurrency(fiatValue, displayCurrency)}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          {/* P&L per asset */}
          <span className={`text-xs font-medium tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : '-'}{fmtCurrency(Math.abs(pnl), displayCurrency)}
          </span>
          <span className={`text-[10px] tabular-nums ${pnl >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
            ({pnlPct.toFixed(2)}%)
          </span>
          {/* Avg buy price */}
          <span className="text-[10px] text-zinc-600 tabular-nums mt-0.5">
            avg {fmtCurrency(a.avg_buy_price, displayCurrency)}
          </span>
        </div>
      </div>
    </GlassSurface>
  );
})}
```

### 3. Action Buttons — Buy / Sell / Transfer

```tsx
<div className="flex gap-2 mt-4">
  <button
    onClick={() => { setShowAddAsset(true); setAddMode('manual'); }}
    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-xs font-medium transition-colors"
  >
    <Plus className="w-3.5 h-3.5" /> Buy
  </button>
  <button
    onClick={() => onTxnClick?.({} as any)}  // Opens CryptoTransactionModal in sell mode
    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
  >
    <Minus className="w-3.5 h-3.5" /> Sell
  </button>
  <button
    onClick={() => onTxnClick?.({ type: 'transfer' } as any)}  // Opens transfer modal
    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700/70 text-xs font-medium transition-colors"
  >
    <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
  </button>
</div>
```

### 4. Allocation Donut Chart — Verify

The donut chart should show each asset's percentage of total portfolio value. Verify the existing implementation uses `fiatValue` (not `amount`) for slice sizes:

```tsx
// Allocation donut — uses fiat value for slice, not crypto amount
const allocationData = {
  labels: assets.map(a => a.symbol),
  datasets: [{
    data: assets.map(a => {
      const p = prices.find(pr => pr.coin_id === a.coin_id);
      return a.amount * (p?.current_price || 0);
    }),
    backgroundColor: assets.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]),
    borderWidth: 0,
  }]
};
```

### 5. Performance Chart — Timeframe Selector

Already implemented via `timeframeDays` state and buttons (7D / 30D / 90D / 1Y). Verify buttons exist:

```tsx
<div className="flex gap-1 mb-3">
  {[7, 30, 90, 365].map(d => (
    <button
      key={d}
      onClick={() => setTimeframeDays(d)}
      className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors
        ${timeframeDays === d
          ? 'bg-violet-500/20 text-violet-300'
          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'}`}
    >
      {d === 365 ? '1Y' : `${d}D`}
    </button>
  ))}
</div>
```

---

## Test Plan — Step-by-Step Verification

### Pre-test Setup
1. Launch Electron app in dev mode: `npm run dev`
2. Unlock finance vault with password.
3. Open DevTools (Cmd+Option+I) to watch console for errors.
4. Ensure internet connection (for CoinGecko API).

### Test 1: Crypto Buy Mechanism (Task A)
1. Navigate to Finance → Wallets.
2. Create a new crypto wallet (type: 'crypto', name: "Test Crypto Wallet", initial_balance: 10000).
3. Click into the wallet → "Buy" button.
4. Search for "bitcoin" → select BTC.
5. Enter amount: 0.5, avg price: 40000.
6. Click "Add Asset".
7. **Verify:**
   - No error in console.
   - Asset appears in wallet assets list showing "0.5 BTC" primary, "≈ $20,000.00" secondary.
   - Wallet balance reduced by $20,000 (from 10000 to -10000, OR if initial_balance is separate, the availableFiat reflects the reduction).
   - Transaction appears in Transactions tab with "Buy 0.500000 BTC" description.
   - Transaction amount shows "0.5 BTC" primary (per Task C fix), "≈ $20,000.00" secondary.
8. Refresh the page (reload Finance tab).
9. **Verify:** Asset persists — if it disappears, the encryption inconsistency bug is not fully fixed.

### Test 2: Recalculate Single Wallet (Task B)
1. Manually edit a wallet's balance in DB to a wrong value (or use the adjustment feature).
2. Click "Sync" button in sticky header.
3. **Verify:**
   - Sync button shows "Fixing historical dates..." → "Scanning wallets..." → "Syncing {WalletName}..." → "Backfilling crypto history..." → "Done!".
   - Green banner appears below header with results like "Updated 1 wallet balance(s)".
   - Banner auto-dismisses after ~8 seconds.
   - Wallet balance matches the sum of initial_balance + all transactions (including is_adjustment).
4. Add a historical adjustment transaction (is_adjustment=1, amount: -500, date: 1900-01-01).
5. Click Sync again.
6. **Verify:** Wallet balance reflects the -500 adjustment. But the "Spending this month" summary does NOT include the -500.

### Test 3: Crypto Transaction Display (Task C)
1. Perform a crypto buy (Test 1).
2. Go to Transactions tab.
3. **Verify:** The buy transaction shows:
   - Primary amount: "0.5 BTC" (in red, since it's an expense).
   - Secondary subtitle: "≈ $20,000.00".
   - NOT: "$20,000.00" as primary.
4. Create a fiat expense ($50 coffee).
5. **Verify:** Fiat transaction shows "$50.00" only — no crypto subtitle.

### Test 4: Sync Button Feedback (Task D)
1. Click "Sync" button.
2. **Verify each phase appears in the button label:**
   - Phase 1: "Fixing historical dates..." (with spinning icon).
   - Phase 2: "Scanning wallets...".
   - Phase 3: "Syncing Test Crypto Wallet..." (cycles through each wallet).
   - Phase 4: "Backfilling crypto history...".
   - Phase 5: "Done!".
3. After completion, **verify the green results banner** appears below the sticky header, is fully visible (not clipped by overflow-hidden), and lists each result.
4. Click the ✕ button on the banner → it dismisses immediately.
5. Wait 8 seconds without clicking → banner auto-dismisses.
6. Simulate failure: disconnect internet, click Sync. **Verify:** red banner with "Crypto history backfill skipped" or "Sync failed" message.

### Test 5: Fiat Balance Isolation — Crypto→Crypto Transfer (Task E)
1. Create two crypto wallets: "Wallet A" (initial_balance: 5000) and "Wallet B" (initial_balance: 0).
2. Buy 0.5 BTC in Wallet A (spentFiat: 20000).
3. Record Wallet A's fiat balance and Wallet B's fiat balance BEFORE transfer.
4. Initiate a transfer: from Wallet A → Wallet B, transfer 0.2 BTC.
5. **Verify AFTER transfer:**
   - Wallet A's assets: BTC amount reduced from 0.5 to 0.3.
   - Wallet B's assets: BTC amount = 0.2.
   - Wallet A's **fiat balance** is UNCHANGED (still the same as before transfer).
   - Wallet B's **fiat balance** is UNCHANGED (still 0).
   - Two transfer transactions created (one negative, one positive) with crypto metadata.
6. Click Sync → recalculate.
7. **Verify:** Neither wallet's fiat balance changed due to the crypto→crypto transfer.

### Test 6: Fiat Balance Isolation — Crypto→Fiat Transfer (Sell)
1. From "Test Crypto Wallet" (has 0.5 BTC), transfer 0.1 BTC to a fiat wallet ("Bank Account", balance: 1000).
2. **Verify AFTER transfer:**
   - Test Crypto Wallet's BTC: 0.4 (reduced).
   - Test Crypto Wallet's **fiat balance**: UNCHANGED (crypto→fiat does not modify source crypto wallet's fiat balance).
   - Bank Account's balance: 1000 + (0.1 × current BTC price).
3. Click Sync.
4. **Verify:** Balances remain correct.

### Test 7: Historical Data Flow (Task F)
1. Create a historical adjustment: amount +5000, date 1900-01-01, is_adjustment=1, wallet: Bank Account.
2. **Verify:**
   - Wallet balance increases by 5000 (in recalculate).
   - "Spending this month" does NOT include the 5000.
   - Net worth chart (FinanceChartsTab) does NOT show a +5000 spike at 1900-01-01.
   - Spending by category chart does NOT include the 5000.
   - useSelectionAggregate (if you select the adjustment) shows count but 0 inflow.
3. Transactions tab: historical adjustment appears in the violet "Historical Data" section at the bottom, not in the regular date-grouped list.

### Test 8: Encryption Round-Trip
1. Lock the finance vault (FinanceStickyHeader lock toggle).
2. **Verify:** All finance data hidden / blurred.
3. Unlock with password.
4. **Verify:** All crypto wallets, assets, transactions reappear correctly.
5. Buy more crypto → lock → unlock.
6. **Verify:** New asset persists across lock/unlock cycle (encryption round-trip works).

### Test 9: Edge Cases
1. **Buy with insufficient balance:** Enter spentFiat > wallet.balance → verify fiatError shows "Insufficient balance" message, no transaction created.
2. **Buy with non-existent category_id:** Manually call `financeCreateTransaction` with `category_id: 99999` → verify fallback category is used (check console warning).
3. **Recalculate with encrypted metadata:** Ensure recalculate works after lock/unlock cycle (metadata is encrypted).
4. **Sync with no internet:** Verify CoinGecko API failures are caught, sync completes with "Crypto history backfill skipped" warning.

---

## Risk Assessment

### High Risk
1. **Encryption migration for existing data:** Existing wallets may have **plaintext** metadata in DB. After the fix, `finance:get-wallets` will try to decrypt — but `decryptField` has a guard `if (!value.startsWith(ENC_PREFIX)) return value` that handles plaintext gracefully. **Mitigation:** The `safeDecrypt` helper always checks `isEncrypted()` first. No data migration needed — reads are backward-compatible.

2. **Recalculate changing balances unexpectedly:** If existing wallet balances were wrong due to the old buggy recalculate, running Sync will "fix" them — which may surprise users. **Mitigation:** Sync shows a results banner ("Updated N wallet balance(s)") so users see what changed. Consider adding a "preview" mode that shows diffs before applying.

3. **`finance:create-transaction` now updates wallet metadata for crypto buys:** This changes the handler's behavior — previously it only inserted a transaction. Now it also updates wallet metadata + balance. **Mitigation:** The metadata update only fires when `metadata.coinId` exists AND `type === 'expense'` AND `wallet_id` is set. Non-crypto transactions are unaffected.

### Medium Risk
4. **`finance:create-transfer` rewrite:** The handler is significantly restructured. Any code that depended on the old branch logic (e.g., expecting source crypto wallet's balance to change on crypto→fiat) will break. **Mitigation:** The new behavior is **correct** per requirements — crypto→fiat should NOT modify source crypto wallet's fiat balance. Document this clearly.

5. **Category fallback to type-matching:** If the user has only income categories and tries an expense transaction, the fallback may pick an income category. **Mitigation:** The fallback tries `WHERE type = ?` first, then falls back to ANY category. Edge case but rare — most users have both income and expense categories.

6. **Crypto transaction display change:** Existing transactions with crypto metadata will now render differently (qty primary vs fiat primary). **Mitigation:** This is the desired behavior per requirements. Visual change is expected.

### Low Risk
7. **Sync button color change on failure:** Cosmetic, no data impact.
8. **Historical date migration:** Sets `is_adjustment=1` transactions to `1900-01-01`. Could affect date-range queries that filter `date >= ?`. **Mitigation:** Use `1900-01-01` consistently and ensure date filters use `>= 1900-01-02` for "real" transactions if needed. Actually, simpler: historical transactions are excluded from spending summaries via `is_adjustment = 0` filter, so their date doesn't matter for summaries. For recalculate, `ORDER BY date ASC` puts them first chronologically — which is the desired behavior.

### What Could Break and How to Prevent It
- **Existing fiat wallets:** Unaffected — all changes are scoped to crypto transfer/buy paths. Fiat→fiat transfer logic is preserved exactly.
- **Physical/cash wallets with denominations:** The `dest_metadata.denominations` merge in `handleAddTransaction` (FinancePage) is preserved — only the backend transfer handler changed, not the frontend denomination merge.
- **Subscriptions:** No changes to recurring transaction logic.
- **Charts:** `is_adjustment` exclusion already in place — no changes needed to chart components.

### Rollback Plan
If issues arise, revert in this order:
1. Revert `finance:create-transfer` to original (restores old branch logic).
2. Revert `finance:update-wallet-metadata` to plaintext JSON writes.
3. Revert `finance:create-transaction` to original (remove crypto metadata update block).
4. Revert `finance:recalculate-balances` to original.
5. Frontend changes are isolated to display logic — safe to revert individually.

Each backend handler is self-contained, so reverting one doesn't cascade.

---

## File Change Summary

| File | Lines Changed | Change Type |
|------|--------------|-------------|
| `src/main.ts` | ~23775 (`finance:create-transaction`) | Rewrite — add category fallback, crypto metadata update |
| `src/main.ts` | ~23327 (`finance:update-wallet-metadata`) | Rewrite — encrypt/decrypt consistently |
| `src/main.ts` | ~23919 (`finance:create-transfer`) | Rewrite — clear three-way branch, fiat isolation |
| `src/main.ts` | ~25734 (`finance:recalculate-balances`) | Rewrite — decrypt metadata, encrypt balance writes |
| `src/main.ts` | ~23100 (helpers) | Add `safeDecrypt`, `parseTxnMetadata` helpers |
| `src/main.ts` | summary handlers (4 locations) | Add `AND is_adjustment = 0` filters |
| `src/main.ts` | DB init block | Add is_adjustment sanity migrations |
| `src/components/finance/WalletDetailView.tsx` | ~680 (`handleAddAsset`) | Remove hardcoded category_id, add error handling |
| `src/components/finance/WalletDetailView.tsx` | CryptoDetail JSX | Enhance portfolio card, asset rows, action buttons |
| `src/components/finance/TransactionsTab.tsx` | Amount render block | Crypto qty primary, fiat secondary |
| `src/components/finance/FinanceStickyHeader.tsx` | ~243 (sync results banner) | Move outside GlassSurface, add dismiss button |
| `src/pages/FinancePage.tsx` | ~655 (sync handler) | Pass `onSyncDismiss` prop |

All changes preserve CRLF line endings. All SQL uses safe try/catch. No schema migrations required — existing columns are sufficient.