Here's the complete design. The widget above is the **human-centric surface** — play with it: drag the rows, click the arrow buttons, hit `W`/`S` or `↑`/`↓` with a row selected, and toggle between *oldest-first* and *newest-first* views. Notice how the chronology badge updates and the timeline bar flips.

---

## 1. The Core Insight: Chronology as a Sequence, Not a Date

You already figured this out. All historical transactions share `date = '1900-01-01'`. The recalculate handler sorts by `date ASC, created_at ASC, id ASC`. Since `date` is identical for all historical rows, `created_at` (DB insertion time) becomes the tie-breaker — and that's **arbitrary** relative to real-world chronology.

**The fix is not to fight the date system — it's to hijack the tie-breaker.**

Add a `sort_order` integer column. Historical transactions all keep `1900-01-01`, but their `sort_order` encodes the true chronological sequence. The recalculate `ORDER BY` becomes:

```sql
ORDER BY date ASC, sort_order ASC, id ASC
```

This makes `sort_order` the effective primary sort key within the historical date block, while regular (non-historical) transactions with real dates still sort correctly around it.

---

## 2. DB Migration

```sql
-- Safe ALTER TABLE with fallback
ALTER TABLE finance_transactions ADD COLUMN sort_order INTEGER DEFAULT 0;
```

No migration framework needed. On app startup, run this inside a `try/catch`. If the column already exists, SQLite throws — catch and continue.

---

## 3. Backend Specification

### 3.1 Update Recalculate Handlers

**File:** `src/main.ts`

**`finance:recalculate-balances` (around line 26000+):**
Change:
```typescript
// BEFORE:
const txns = db.prepare(`SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, created_at ASC, id ASC`).all(walletId);

// AFTER:
const txns = db.prepare(`SELECT * FROM finance_transactions WHERE wallet_id = ? ORDER BY date ASC, sort_order ASC, created_at ASC, id ASC`).all(walletId);
```

**`finance:apply-recalculated-balance` (around line 26163):**
Change:
```typescript
// BEFORE:
ORDER BY date ASC, id ASC

// AFTER:
ORDER BY date ASC, sort_order ASC, id ASC
```

The `created_at` fallback ensures existing rows (with `sort_order = 0` default) maintain their current relative order until the user explicitly reorders them.

### 3.2 Auto-Assign `sort_order` on Creation

When creating historical transactions (`is_adjustment = 1` or baseline), auto-assign `sort_order` to `MAX(sort_order) + 1` for that wallet. This appends new historical transactions to the **end** of the chronological sequence (i.e., newest), which is the safest default — the user can drag them to the correct spot if needed.

**`finance:create-wallet` baseline (around line 23220):**
```typescript
const maxSort = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?`).get(walletId).max;
db.prepare(`INSERT INTO finance_transactions (wallet_id, date, amount, type, is_adjustment, sort_order, metadata) VALUES (?, '1900-01-01', ?, 'expense', 1, ?, ?)`)
  .run(walletId, balance, maxSort + 1, JSON.stringify({ note: 'Wallet creation baseline' }));
```

**`finance:create-adjustment` (around line 23985):**
```typescript
const maxSort = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?`).get(walletId).max;
const txnDate = '1900-01-01';
db.prepare(`INSERT INTO finance_transactions (wallet_id, date, amount, type, is_adjustment, sort_order, metadata) VALUES (?, ?, ?, ?, 1, ?, ?)`)
  .run(walletId, txnDate, amount, type, maxSort + 1, metadata);
```

**`finance:create-transfer` for historical legs (around line 24056):**
```typescript
const maxSort = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) as max FROM finance_transactions WHERE wallet_id = ?`).get(walletId).max;
const txnDate = data.is_adjustment ? '1900-01-01' : (data.date || todayStr());
const sortOrder = data.is_adjustment ? (maxSort + 1) : 0; // 0 for regular txns (date-driven)
```

### 3.3 New IPC Handler: `finance:update-transaction-sort-order`

```typescript
// In main.ts IPC registration
ipcMain.handle('finance:update-transaction-sort-order', async (_, updates: { id: number; sort_order: number }[]) => {
  const db = getDb();
  const stmt = db.prepare(`UPDATE finance_transactions SET sort_order = ? WHERE id = ?`);
  const updateMany = db.transaction((rows) => {
    for (const row of rows) {
      stmt.run(row.sort_order, row.id);
    }
  });
  updateMany(updates);
  return { success: true };
});
```

This is wrapped in a SQLite transaction so the reorder is atomic — no partial writes if the app crashes mid-update.

---

## 4. Frontend Specification

### 4.1 New Component: `HistoricalReorderPanel`

Create this inside `src/components/finance/WalletDetailView.tsx` (or as a sub-component in the same file, since you prefer no new files).

**Props interface:**
```typescript
interface HistoricalReorderPanelProps {
  transactions: Transaction[];
  walletId: number;
  onOrderChanged: () => void; // triggers fetchData() / recalculate
}
```

**State:**
```typescript
const [order, setOrder] = useState<Transaction[]>([]);
const [selectedId, setSelectedId] = useState<number | null>(null);
const [viewMode, setViewMode] = useState<'oldest' | 'newest'>('oldest');
const [dirty, setDirty] = useState(false);
```

**Key behaviors:**

1. **Initialize from props:** Filter `transactions` to only `is_adjustment = 1` rows, sort by `sort_order ASC`, set as `order`.
2. **Drag-and-drop:** Use native HTML5 DnD (no `@dnd-kit` needed for a simple vertical list — native is lighter and zero-dependency). Each row is `draggable`. On `dragStart`, capture source index. On `drop`, splice and reorder.
3. **Keyboard:** Global `keydown` listener. If `selectedId` is set and user presses `ArrowUp`/`ArrowDown`/`W`/`S`, move the selected row up/down one position.
4. **Arrow buttons:** Per-row up/down buttons, hidden by default, revealed on `:hover` and `:focus-within` (following Kimi design system hover-reveal pattern).
5. **View mode toggle:** "Oldest first" vs "Newest first". This only affects **display** — the underlying `sort_order` array is always oldest→newest. When in "newest first" mode, render `order.slice().reverse()`.
6. **Chronology badges:** Each row shows a badge: "Earliest", "Latest", or "#N" based on its position in the true chronological order.
7. **Sync button:** Disabled until `dirty = true`. On click, builds payload `[{ id, sort_order }]` and calls `financeUpdateTransactionSortOrder`, then calls `onOrderChanged()` to trigger `fetchData()` and recalculate.

### 4.2 Integration into `WalletDetailView`

Insert the panel into the existing historical section (around lines 225–243 in your context):

```typescript
// Inside WalletDetailView render, where historical transactions are shown:
{historical.length > 0 && (
  <div className="historical-section">
    <div className="section-header">
      <span>Historical transactions ({historical.length})</span>
      <button onClick={() => setShowReorder(!showReorder)}>
        {showReorder ? 'Done' : 'Reorder'}
      </button>
    </div>
    
    {showReorder ? (
      <HistoricalReorderPanel
        transactions={historical}
        walletId={wallet.id}
        onOrderChanged={() => {
          setShowReorder(false);
          onRefresh(); // triggers fetchData + recalculate
        }}
      />
    ) : (
      historical.slice(0, 15).map(renderTxnRow)
    )}
  </div>
)}
```

### 4.3 TypeScript Types to Add

```typescript
// In your types file or top of WalletDetailView.tsx
interface Transaction {
  id: number;
  wallet_id: number;
  date: string;
  amount: number;
  type: string;
  is_adjustment: number;
  sort_order: number;
  metadata?: string;
  created_at: string;
}
```

---

## 5. Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────────────────┐     ┌─────────────────┐
│  User drags/    │     │  HistoricalReorderPanel      │     │  SQLite DB      │
│  keys row       │────▶│  - order[] state (oldest→  │────▶│  sort_order     │
│  into new spot  │     │    newest sequence)          │     │  column updated │
└─────────────────┘     │  - dirty flag                │     │  atomically     │
                        │  - viewMode (display only)   │     └─────────────────┘
                        └───────────────────────────────┘              │
                                     │                               │
                                     ▼                               ▼
                        ┌─────────────────────────────┐     ┌─────────────────┐
                        │  Sync button clicked         │     │  fetchData()    │
                        │  → build [{id, sort_order}]  │────▶│  → recalculate  │
                        │  → IPC call                  │     │  → UI refreshes │
                        └─────────────────────────────┘     └─────────────────┘
```

---

## 6. Invariant Checklist

| # | Invariant | How it's enforced |
|---|-----------|-------------------|
| 1 | **Historical transactions sort by real chronology, not `created_at`** | `ORDER BY date ASC, sort_order ASC` makes `sort_order` the primary tie-breaker within the `1900-01-01` block. |
| 2 | **Regular (dated) transactions are unaffected** | Non-historical transactions have real dates that sort before/after `1900-01-01`, so they naturally bracket the historical block regardless of `sort_order`. |
| 3 | **New historical transactions default to end-of-sequence** | `MAX(sort_order) + 1` appends them as "newest", safest default. |
| 4 | **Reorder is atomic** | SQLite `db.transaction()` wrapper in `finance:update-transaction-sort-order`. |
| 5 | **View mode is pure display, doesn't mutate data** | `viewMode` only affects `.reverse()` at render time; the canonical `order[]` is always oldest→newest. |
| 6 | **Existing data is preserved** | `DEFAULT 0` on new column means existing rows sort to the top of the historical block (oldest), maintaining current behavior until user explicitly reorders. |

---

## 7. Test Plan

1. **Create wallet with 12M balance** → baseline txn appears in historical section.
2. **Add 0.0049 BTC manually** → second historical txn appears below baseline.
3. **Transfer 0.0039 BTC** → third historical txn appears at bottom.
4. **Click "Reorder"** → panel opens with drag handles and arrow buttons.
5. **Drag transfer above the add** → order changes, "Sync" button enables.
6. **Click Sync** → DB updates, recalculate runs.
7. **Verify crypto quantities** → wallet balance reflects chronological order (baseline → transfer → add).
8. **Toggle "Newest first"** → display flips but underlying order is preserved.
9. **Select a row, press `W`** → row moves up one position.
10. **Delete a historical txn** → remaining txns keep their relative `sort_order`; recalculate still works.

---

## 8. Risk Assessment

| Risk | Mitigation |
|------|------------|
| **User forgets to sync** | Dirty state indicator + disabled sync button pattern makes unsaved changes obvious. |
| **Two users/devices editing simultaneously** | Electron is single-user local; no conflict. |
| **sort_order gaps after deletions** | Gaps are harmless — `ORDER BY sort_order ASC` handles sparse values fine. No need to compact. |
| **Migration fails on older DB** | Wrap `ALTER TABLE` in `try/catch`; if column exists, continue silently. |

---

## 9. Files to Modify

| File | Changes |
|------|---------|
| `src/main.ts` | Add `sort_order` to `ORDER BY` in recalculate + apply handlers; add `sort_order` to INSERTs for historical txns; add `finance:update-transaction-sort-order` IPC handler. |
| `src/components/finance/WalletDetailView.tsx` | Add `HistoricalReorderPanel` sub-component; integrate toggle into historical section; add `sort_order` to Transaction type. |
| `src/preload.ts` (or wherever IPC bridge is) | Expose `financeUpdateTransactionSortOrder` to renderer. |

---

The widget demonstrates the exact interaction model. The spec above is what you hand to your OpenCode agent — it's backend-authoritative, preserves the existing date architecture, and gives the user full manual control over chronology without breaking anything.