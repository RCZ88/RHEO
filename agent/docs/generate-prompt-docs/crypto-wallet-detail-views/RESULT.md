<aside>
🧱

**Decision summary** — Store type-specific data in a single `metadata` JSON (TEXT) column on `finance_wallets`. Render details in a **full-bleed in-page view** driven by React state in `FinancePage.tsx`. Compute crypto + cash balances from metadata so net worth stays correct. Fetch crypto prices from **CoinGecko free tier** in the main process, cached in a new `finance_crypto_prices` table.

</aside>

## 1. Data Architecture

### 1.1 Storage strategy — single `metadata` JSON column

Add one nullable `metadata TEXT` column to `finance_wallets`. It holds a JSON-serialized, type-discriminated payload. The shared columns (`id`, `account_id`, `name`, `balance`, `currency`, `provider`, `last_four`, `wallet_type`, …) are unchanged.

| Option | Migration cost | Query complexity | Forward compat | Verdict |
| --- | --- | --- | --- | --- |
| **`metadata` JSON column** | One `ALTER TABLE ADD COLUMN` | Single-row read, parse in JS | Add fields with zero schema change | **Chosen** |
| Per-type tables (6×) | 6 tables + 6 migrations + joins | LEFT JOIN per type on every read | New field = new migration | Rejected |

Why JSON wins here: the wallet count per workspace is small, reads are point-lookups (not analytical scans), and the metadata shape differs wildly per type (a `denominations` map vs. an `assets` array). A relational split buys nothing and costs six join paths through the inline handlers in `src/main.ts`.

### 1.2 Type-discriminated metadata schema

Define a discriminated union keyed on `wallet_type`. Persisted as `JSON.stringify(metadata)` in the column; parsed on read.

```tsx
// Shared, unchanged
interface FinanceWalletBase {
	id: string
	account_id: string
	name: string
	balance: number          // display/stored fiat balance (see 1.3)
	currency: string         // ISO 4217, e.g. "USD"
	provider?: string
	last_four?: string
	wallet_type: WalletType  // 'bank' | 'debit_card' | 'credit_card' | 'crypto' | 'cash' | 'ewallet' | 'other'
	metadata: WalletMetadata | null
}

type WalletMetadata =
	| BankMeta | DebitMeta | CreditMeta
	| CryptoMeta | CashMeta | EwalletMeta

interface BankMeta {
	type: 'bank'
	accountNumber?: string
	routingNumber?: string
	institution?: string
	notes?: string
}

interface DebitMeta {
	type: 'debit_card'
	atmWithdrawalLimit?: number
	dailySpendingLimit?: number
	linkedAccountId?: string   // FK -> finance_wallets.id (a bank wallet)
}

interface CreditMeta {
	type: 'credit_card'
	creditLimit?: number
	apr?: number
	statementDate?: string         // ISO date
	paymentDueDate?: string        // ISO date
	lastStatementBalance?: number
}

interface CryptoAsset {
	asset: string          // CoinGecko id-mapped symbol, e.g. 'BTC'
	amount: number         // units held, e.g. 0.5
	avgBuyPrice?: number   // optional cost basis, in wallet currency
}
interface CryptoMeta {
	type: 'crypto'
	assets: CryptoAsset[]
}

interface CashMeta {
	type: 'cash'
	// face value (string) -> count. Coins use decimal keys ('0.25').
	denominations: Record<string, number>
}

interface EwalletLink {
	provider: string
	lastFour?: string
	label?: string
}
interface EwalletMeta {
	type: 'ewallet'
	linkedAccounts: EwalletLink[]
}
```

| Type | Required metadata | Accent (`walletMeta`) |
| --- | --- | --- |
| **bank** | `accountNumber`, `routingNumber`, `institution`, `notes` | `#3B82F6` |
| **debit_card** | `atmWithdrawalLimit`, `dailySpendingLimit`, `linkedAccountId` | `#10B981` |
| **credit_card** | `creditLimit`, `apr`, `statementDate`, `paymentDueDate`, `lastStatementBalance` | `#F59E0B` |
| **crypto** | `assets: [{ asset, amount, avgBuyPrice? }]` | `#8B5CF6` |
| **cash** | `denominations: { '100': 3, '20': 5, '0.25': 8 }` | `#EC4899` |
| **ewallet** | `linkedAccounts: [{ provider, lastFour, label }]` | `#06B6D4` |

### 1.3 Balance computation

| Type | `balance` source | Rule |
| --- | --- | --- |
| crypto | **Derived** | `Σ(asset.amount × livePrice[asset])` in wallet currency. Recomputed on every read from cached prices. |
| cash | **Derived** | `Σ(Number(face) × count)` over `denominations`. Recomputed whenever denominations change. |
| bank / debit / credit / ewallet | **Manual** | User-entered `balance`, unchanged from today. |

<aside>
⚠️

The stored `balance` column stays the **fiat number consumed by net worth and account rollups**. For crypto/cash it is a cache of the derived value, refreshed in the same handler that mutates metadata (and, for crypto, when prices refresh). This keeps `OverviewTab`, account-balance sums, and the net-worth number working with **zero changes to their math**.

</aside>

### 1.4 Migration plan for existing wallets

- Run `ALTER TABLE finance_wallets ADD COLUMN metadata TEXT;` guarded by a `PRAGMA table_info` check (matches the existing additive-migration pattern in `main.ts`).
- Existing rows get `metadata = NULL`. The detail view treats `NULL` as an **empty metadata object of the row's type** (`{ type, assets: [] }`, `{ type, denominations: {} }`, etc.), so old wallets open cleanly into an empty state.
- No backfill required; balances of legacy wallets remain their manually-entered values until the user edits metadata.

## 2. Backend Changes

### 2.1 SQL migrations

```sql
-- 1. metadata column on wallets (idempotent guard in code)
ALTER TABLE finance_wallets ADD COLUMN metadata TEXT;

-- 2. crypto price cache
CREATE TABLE IF NOT EXISTS finance_crypto_prices (
	asset        TEXT NOT NULL,      -- 'BTC'
	vs_currency  TEXT NOT NULL,      -- 'usd'
	price        REAL NOT NULL,
	change_24h   REAL,               -- percent
	fetched_at   INTEGER NOT NULL,   -- epoch ms
	PRIMARY KEY (asset, vs_currency)
);

-- 3. (optional) per-asset history cache for the chart timeframe selector
CREATE TABLE IF NOT EXISTS finance_crypto_history (
	asset        TEXT NOT NULL,
	vs_currency  TEXT NOT NULL,
	range        TEXT NOT NULL,      -- '1D'|'1W'|'1M'|'3M'|'1Y'|'ALL'
	points       TEXT NOT NULL,      -- JSON [[ts, price], ...]
	fetched_at   INTEGER NOT NULL,
	PRIMARY KEY (asset, vs_currency, range)
);
```

### 2.2 IPC channels (inline handlers in `src/main.ts`, exposed via `src/preload.ts`)

| Channel | Payload | Returns | Notes |
| --- | --- | --- | --- |
| `finance:update-wallet-metadata` | `{ walletId, metadata }` | updated `FinanceWallet` | Validates discriminator vs. `wallet_type`; recomputes `balance` for crypto/cash before write. |
| `finance:fetch-crypto-prices` | `{ assets: string[], vsCurrency }` | `{ prices, stale, fetchedAt }` | Reads cache; refreshes from CoinGecko if older than TTL; returns stale cache on failure. |
| `finance:get-crypto-history` | `{ asset, vsCurrency, range }` | `{ points: [ts, price][], stale }` | Backs the performance chart timeframe selector. |
| `finance:get-wallet` | `{ walletId }` | `FinanceWallet` w/ parsed `metadata` | Detail view loader (or reuse the existing list fetch). |

A single generic `finance:update-wallet-metadata` is preferred over per-field channels: it accepts the full typed `metadata` blob, keeps the handler count low, and matches the discriminated-union model. The existing `finance:update-wallet` continues handling shared columns.

### 2.3 Crypto price fetching

- **API:** CoinGecko public `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true`. No key, no auth. Maintain a small `SYMBOL → coingecko-id` map (`BTC→bitcoin`, `ETH→ethereum`, `SOL→solana`, …). History via `/coins/{id}/market_chart?vs_currency=usd&days=N`.
- **Where it runs:** main process only (renderer never calls the network). Two triggers: (a) a `setInterval` refresh every **120 s** while at least one crypto wallet exists and the window is focused; (b) on-demand when the crypto detail view opens or the user hits refresh.
- **Caching:** write into `finance_crypto_prices`; TTL **90 s**. Reads inside TTL skip the network.
- **Failure handling:** on fetch error, return the last cached row flagged `stale: true` + `fetchedAt`. The UI renders dimmed values with a ⚠️ banner. Never throw into the renderer.

```tsx
// src/main.ts (sketch)
const PRICE_TTL_MS = 90_000
ipcMain.handle('finance:fetch-crypto-prices', async (_e, { assets, vsCurrency }) => {
	const now = Date.now()
	const ids = assets.map(symbolToId).filter(Boolean)
	const cached = readCachedPrices(assets, vsCurrency)        // from finance_crypto_prices
	const fresh = cached.length === assets.length &&
		cached.every(r => now - r.fetched_at < PRICE_TTL_MS)
	if (fresh) return { prices: toMap(cached), stale: false, fetchedAt: maxFetchedAt(cached) }
	try {
		const url = `https://api.coingecko.com/api/v3/simple/price` +
			`?ids=${ids.join(',')}&vs_currencies=${vsCurrency}&include_24hr_change=true`
		const res = await fetch(url)
		if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
		const data = await res.json()
		upsertPrices(data, vsCurrency, now)                     // write cache
		return { prices: normalize(data), stale: false, fetchedAt: now }
	} catch (err) {
		return { prices: toMap(cached), stale: true, fetchedAt: maxFetchedAt(cached), error: String(err) }
	}
})
```

## 3. Navigation Design

- **Entry:** clicking a wallet row (whole row is the hit target; cursor-pointer) opens its detail view. A subtle `›` chevron appears on hover to signal it.
- **Container:** a **full-bleed in-page view** rendered inside `FinancePage.tsx` via `AnimatePresence` (slide+fade from the right, ~180 ms). It replaces the active tab body but **keeps the top header + net-worth number visible**. The tab bar is hidden while in detail (a back affordance takes its place).
- **Back/close:** a `‹ Back` button top-left returns to the originating tab; `Esc` also closes. The tab the user came from is preserved.
- **State in `FinancePage.tsx`:**

```tsx
const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
// derive: const detailWallet = wallets.find(w => w.id === selectedWalletId)
// open:  onWalletClick = (id) => setSelectedWalletId(id)
// close: onBack = () => setSelectedWalletId(null)
```

When `selectedWalletId` is set, `FinancePage` renders `<WalletDetailView wallet={detailWallet} onBack={…} />` instead of the tab content. No React Router; lock screen and auto-lock timer wrap the whole page and are unaffected.

## 4. Wallet Detail View — Per-Type Specifications

### 4.0 Common header (all types)

Rendered by `WalletDetailHeader`. Layout (left→right): back button · type badge (color-coded from `walletMeta`) · wallet name · provider + `••••{last_four}`. Right side: balance in display currency (large, `tabular-nums`) with original balance beneath (`text-[11px]` muted), then **Edit** / **Delete** buttons. Delete keeps the existing confirm/delete-protection flow.

### 4.1 Bank

- **Body:** Account number (masked `••••1234`, click to reveal), Routing number, Institution name, Notes. Below: **Recent transactions** filtered to this wallet.
- **Controls:** Edit (opens edit modal), Delete.
- **States:** empty → "No transactions for this account yet."

### 4.2 Debit Card

- **Body:** ATM withdrawal limit (inline-editable), Daily spending limit (inline-editable), `••••{last_four}`, Linked bank account (chip linking to that wallet's detail). Recent spending transactions.
- **Controls:** edit limits inline, Edit, Delete.

### 4.3 Credit Card

- **Body:**
    - **Credit-limit bar** — used vs. available; fill turns `text-red-400`/red gradient as utilization nears the limit. Shows `used / limit` and available remaining.
    - Statement balance + statement date, Payment due date (highlight if within 7 days), APR, `••••{last_four}`.
    - Transactions split into **Pending** and **Cleared** sections.
- **Controls:** Edit, Delete.

### 4.4 Crypto — Portfolio Dashboard

The flagship view. Component tree top→bottom:

1. **Portfolio header** — total value (display currency), 24h change (abs + %, green/red), all-time P&L (green/red), last-updated timestamp.
2. **Performance chart** (`Chart.js` line/area, gradient fill green-positive / red-negative) with timeframe selector **1D · 1W · 1M · 3M · 1Y · ALL** and a crosshair tooltip. Backed by `finance:get-crypto-history`.
3. **Allocation donut** — % by asset (BTC 45% · ETH 30% · SOL 25%).
4. **Asset table** — columns: icon + name · amount (`0.5000`) · avg buy · price · value · 24h % (green/red) · P&L since buy (green/red). Sortable by any column; each row expandable to a mini per-asset chart; per-row remove action. **+ Add Asset** opens a symbol picker (amount + optional avg buy price).
5. **Price-source indicator** — "Prices from CoinGecko • Updated 2m ago" + refresh button.
6. **P&L summary row** — total realized + unrealized at the bottom.

| State | Treatment |
| --- | --- |
| Empty | Illustrated icon + "No assets yet. Add your first cryptocurrency." + Add Asset CTA. |
| Loading | Skeleton rows: amounts shown, prices render as `—`. |
| Error / stale | ⚠️ banner "Could not update prices"; last-known prices shown dimmed with a stale marker. |

### 4.5 Cash

- **Denomination grid** — one row per face value: `[−] count [+]` stepper + live `count × face` value. Quick-add presets ("+$100", "+$20", …). Supports coins (`$0.25`, `$0.10`, `$0.05`, `$0.01`).
- **Currency-aware** — if wallet currency is EUR, show €100/€50/€20/… denominations.
- **Total** — bold, auto-updates live as counts change.
- **Save** persists `denominations` (and recomputes `balance`); **Cancel** reverts.
- **Empty:** all-zero → "Enter your physical cash by adding bills below."

```
| Denomination | Count       | Value |
| $100         | [-] 3 [+]   | $300  |
| $50          | [-] 1 [+]   | $50   |
| $20          | [-] 5 [+]   | $100  |
| Total        |             | $485  |
```

### 4.6 E-Wallet

- **Body:** Linked payment methods list (provider + `••••last_four` + label), balance (may differ from real balance due to pending), recent transactions.
- **Controls:** Edit, Delete, **Link new card** (appends to `linkedAccounts`).

### Shared visual spec

Dark theme; `GlassSurface` cards; emerald accent for primary actions; per-type accent from `walletMeta` for badges/bars/charts; `tabular-nums` on all money; labels at `text-[10px]`/`text-[11px]`; Tailwind v4 (`@import "tailwindcss"`).

## 5. Implementation Plan

### Phase 1 — Backend foundation

- [ ]  Add `metadata TEXT` column migration (guarded) to `finance_wallets`.
- [ ]  Create `finance_crypto_prices` (+ optional `finance_crypto_history`) tables.
- [ ]  Add `finance:update-wallet-metadata` handler (validate discriminator, recompute crypto/cash `balance`).
- [ ]  Parse `metadata` JSON on all wallet reads; expose channels in `preload.ts`.

### Phase 2 — Navigation shell

- [ ]  Add `selectedWalletId` state + open/close handlers in `FinancePage.tsx`.
- [ ]  Build `WalletDetailView` container with `AnimatePresence` transition, keep header/net-worth visible, hide tab bar, wire back + `Esc`.
- [ ]  Make wallet rows clickable with hover chevron.

### Phase 3 — Shared components

- [ ]  `WalletDetailHeader` (badge, name, provider/last_four, balance, Edit/Delete).
- [ ]  Reusable `MaskedField`, `InlineEditableNumber`, `TransactionList` (wallet-scoped).

### Phase 4 — Per-type bodies (build order)

- [ ]  Cash (self-contained, no network) → validates the metadata write path.
- [ ]  Bank → Debit → Credit → E-Wallet (share transaction list + field patterns).

### Phase 5 — Crypto price integration

- [ ]  `finance:fetch-crypto-prices` + 120s focused timer + on-open fetch + 90s TTL cache + stale fallback.
- [ ]  Crypto detail: header, asset table, Add/Remove asset, allocation donut.
- [ ]  Performance chart + timeframe selector via `finance:get-crypto-history`.
- [ ]  Loading / empty / error+stale states.

### Phase 6 — Ripple fixes

- [ ]  `AccountsTab` rows show derived balance for crypto (fiat total) and cash (denom sum).
- [ ]  Confirm `OverviewTab` account balances + net worth read the recomputed `balance` (should need no math change).
- [ ]  Branch `CreateWalletModal`/`EditWalletModal` by type (crypto: optional "add initial assets"; cash: optional denomination entry).
- [ ]  Add a crypto→fiat conversion path alongside `convertAmount()` (price-based), leaving fiat conversion untouched.
- [ ]  Regression pass: lock screen, auto-lock timer, password, currency conversion, net worth, custodial exclusion, delete protection.

<aside>
✅

**Definition of done** — every wallet type opens its own detail view; crypto holds assets with live CoinGecko prices + charts; cash tracks bill/coin counts; net worth and account totals stay correct; all existing finance features still pass.

</aside>