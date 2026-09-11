# Finance Page — Code Context Bundle

## How to use this file

This is ground truth for an implementing AI that has **no codebase access beyond this file**. Every source snippet, type, IPC endpoint, and design token below is accurate to the current `src/` as of 2026-06-18. Where `prompt.md` disagrees on visuals, the prompt wins; where they disagree on data shapes or IPC, this bundle wins.

---

## 1. Architecture Overview

### Entry point: `src/pages/FinancePage.tsx`

```tsx
<PageShell page="finance" variant="sticky-header" style={{ ['--page-accent' as string]: '#10b981' }}>
```

The finance page uses **Pattern B** (Sticky Header + Tabs). It wraps everything in `<PageShell>` with `variant="sticky-header"` and sets `--page-accent: #10b981` (emerald-500).

### Component hierarchy

```
FinancePage
├── FinanceStickyHeader (when locked — simplified)
│   └── Lock icon, title "Finance"
├── FinanceLockScreen (when locked)
│   └── Shield icon + PIN input + Windows Hello fallback + cooldown
├── PageShell (when unlocked)
│   ├── Header bar (custom, NOT FinanceStickyHeader)
│   │   ├── Wallet IconBox + "Finance" + Net Worth
│   │   ├── Currency dropdown (10 common currencies)
│   │   ├── Lock button
│   │   └── Security Settings popover (remember device, lock timeout)
│   ├── TabBar (Overview | Accounts | Transactions | Categories)
│   ├── Tab content (crossfade via AnimatePresence)
│   │   ├── OverviewTab
│   │   │   ├── QuickAddBar (GlassCard, 2-tier: controls + category chips)
│   │   │   ├── 4 Metric cards (grid-cols-2 lg:grid-cols-4)
│   │   │   │   └── Each has Sparkline SVG (opacity-10)
│   │   │   ├── 2-column charts (Doughnut + Bar via Chart.js 4.x)
│   │   │   └── Account Summary (2-col grid + custodial section)
│   │   ├── AccountsTab
│   │   │   ├── SectionHeader + "New Account" button
│   │   │   ├── Account cards (GlassCard interactive + border-l-2 accent rail)
│   │   │   │   └── Expandable wallet list (AnimatePresence accordion)
│   │   │   └── CreateAccountModal (name, type, description, currency, balance)
│   │   ├── TransactionsTab
│   │   │   ├── SectionHeader + "Add" button
│   │   │   ├── Sticky filter bar (search + type pill filters)
│   │   │   └── Grouped transaction list (date headers, semantic border-l)
│   │   └── CategoriesTab
│   │       ├── SectionHeader + "New Category" button
│   │       ├── Grouped grid by type (Income/Expense/Transfer)
│   │       └── CreateCategoryModal (name, type, icon picker, color swatches)
│   └── FAB (fixed bottom-right, Plus icon, emerald)
└── QuickAddModal (overlay, opened from FAB or "Add" button)
```

### Data initialization flow

1. `checkSetup()` → IPC `financeCheckPasswordSetup` → sets `isFirstTime` / `isLocked`
2. `checkPageAccess()` → IPC `financeCheckPageAccess` → sets `pageAccess`
3. `fetchData()` → Parallel Promise.all of 7 IPC calls (once unlocked)
4. Auto-lock timer: `securitySettings.lockTimeout` (default 5min), `resetLockTimer()` on unlock
5. Security poll: `setInterval` every 30s checking `financeIsLocked()`

### Key state (FinancePage)

```tsx
const [isLocked, setIsLocked] = useState(true);
const [isFirstTime, setIsFirstTime] = useState(false);
const [activeTab, setActiveTab] = useState<FinanceTabKey>('overview');
const [displayCurrency, setDisplayCurrency] = useState('USD');
const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
const [wallets, setWallets] = useState<FinanceWallet[]>([]);
const [categories, setCategories] = useState<FinanceCategory[]>([]);
const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
const [summary, setSummary] = useState<FinanceSummary | null>(null);
const [spendingByCategory, setSpendingByCategory] = useState<FinanceSpendingByCategory[]>([]);
const [monthlyTrends, setMonthlyTrends] = useState<FinanceMonthlyTrend[]>([]);
const [loading, setLoading] = useState(true);
```

Net worth calculation:
```tsx
const netWorth = accounts.reduce((s, a) =>
  s + convertAmount(a.type === 'custodial' ? 0 : a.balance, a.currency, displayCurrency), 0);
```

---

## 2. IPC Endpoints

All accessed via `window.deskflowAPI`:

| Method | Returns | Description |
|--------|---------|-------------|
| `financeCheckPasswordSetup()` | `{ hasPassword: boolean }` | Check if password exists |
| `financeCheckPageAccess()` | `{ canAccess, requiresSetup, reason }` | Page access check |
| `financeSetPassword(password)` | `{ success: boolean }` | Set initial password |
| `financeIsLocked()` | `{ locked: boolean }` | Check lock state |
| `financeLock()` | void | Lock the page |
| `financeUnlock(password)` | `{ success: boolean }` | Unlock with password |
| `financeGetSecuritySettings()` | `{ locked, hasPassword, lockTimeout, rememberDevice, rememberDeviceExpiry }` | Security config |
| `financeSetLockTimeout(ms)` | void | Update auto-lock timeout |
| `financeSetRememberDevice(bool, days)` | void | Remember device setting |
| `financeGetAccounts()` | `FinanceAccount[]` | All accounts |
| `financeGetWallets()` | `FinanceWallet[]` | All wallets |
| `financeGetCategories()` | `FinanceCategory[]` | All categories |
| `financeGetTransactions()` | `FinanceTransaction[]` | All transactions |
| `financeGetSummary()` | `FinanceSummary` | Aggregated totals |
| `financeGetSpendingByCategory()` | `FinanceSpendingByCategory[]` | Spending breakdown |
| `financeGetMonthlyTrends()` | `FinanceMonthlyTrend[]` | Monthly income/expense |
| `financeCreateAccount(data)` | `FinanceAccount` | Create account |
| `financeCreateTransaction(data)` | `FinanceTransaction` | Create transaction |
| `financeDeleteTransaction(id)` | `{ success: boolean }` | Delete transaction |
| `financeCreateCategory(data)` | `FinanceCategory` | Create category |

---

## 3. Component Source Code (accurate to `src/`)

### 3.1 FinancePage.tsx (515 lines)

The page shell with all state management, lock mechanism, data fetching, and tab routing.

**Header bar** (custom, not using FinanceStickyHeader component):
```tsx
<div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
      <Wallet className="w-5 h-5 text-emerald-400" />
    </div>
    <div>
      <h1 className="text-[15px] font-semibold text-white">Finance</h1>
      <p className="text-[11px] text-zinc-500">
        Net Worth <span className={`font-semibold ${netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatCurrency(netWorth, displayCurrency)}
        </span>
      </p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    // Currency dropdown (10 common currencies)
    // Lock button
    // Security Settings popover (hover group)
  </div>
</div>
```

**Tab bar area** (below header, sticky):
```tsx
<div className="px-6 pb-3 bg-zinc-950/90 backdrop-blur-lg border-b border-zinc-800/60 shrink-0">
  <TabBar tabs={tabs} activeKey={activeTab} onTabChange={(k) => setActiveTab(k as FinanceTabKey)} />
</div>
```

**Content area with crossfade:**
```tsx
<div className="flex-1 overflow-auto p-5 space-y-6">
  <AnimatePresence mode="wait">
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {activeTab === 'overview' && <OverviewTab ... />}
      {activeTab === 'accounts' && <AccountsTab ... />}
      {activeTab === 'transactions' && <TransactionsTab ... />}
      {activeTab === 'categories' && <CategoriesTab ... />}
    </motion.div>
  </AnimatePresence>
</div>
```

**FAB button:**
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  onClick={() => setShowQuickAdd(true)}
  className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-colors z-[var(--z-elevated)]"
  title="New transaction (Ctrl+N)"
>
  <Plus className="w-5 h-5" />
</motion.button>
```

### 3.2 FinanceStickyHeader.tsx (44 lines)

Used only when the page is **locked** (simplified header). Not used in the main unlocked view.

```tsx
export function FinanceStickyHeader({ isLocked, netWorth, displayCurrency, onToggleLock }) {
  // bg-zinc-950/90 backdrop-blur-lg border-b border-zinc-800
  // Left: Wallet icon box + "Finance" title
  // Center (when unlocked): "Net Worth" + formatted amount
  // Right: Lock/Unlock toggle button
}
```

### 3.3 FinanceLockScreen.tsx (197 lines)

Full-screen lock overlay. Key features:
- Password input with show/hide toggle (`Eye`/`EyeOff` icons)
- Setup mode (first time): password + confirm password
- Unlock mode: password + attempts tracking + cooldown
- 3-attempt limit → 30s cooldown with animated progress bar
- Blur feedback on failed attempt (250ms `blur(4px)` + `scale(0.95)` + `opacity(0.8)`)
- Windows Hello button (placeholder, `Fingerprint` icon)
- Error messages: "Incorrect password — N attempts left" / "Too many attempts. Try again in Ns"

States tested: First-time setup, unlock attempt, incorrect password, cooldown, biometric available/unavailable.

### 3.4 OverviewTab.tsx (602 lines)

The main dashboard tab. Imports Chart.js 4.x (`chart.js` + `react-chartjs-2`).

**Chart theme contract (inline):**
```tsx
const CHART_THEME = {
  tooltip: {
    backgroundColor: 'rgba(24, 24, 27, 0.95)',
    titleColor: '#e4e4e7',
    bodyColor: '#a1a1aa',
    borderColor: 'rgba(63, 63, 70, 0.5)',
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
  },
  ticks: { color: '#71717a', font: { size: 10 } },
  grid: { color: 'rgba(113,113,122,0.08)' },
  border: { color: 'rgba(113,113,122,0.15)' },
};
```

**QuickAddBar (GlassCard, 2-tier):**
```tsx
<GlassCard accent={typeAccent === 'income' ? 'emerald' : typeAccent === 'transfer' ? 'amber' : undefined}>
  {/* Tier 1: type toggle + amount + description + account + Add button */}
  <div class="flex items-center gap-3 flex-wrap">
    {/* Type toggle: 3 pills (income/expense/transfer) */}
    {/* Amount input: w-44, text-2xl font-bold tabular-nums, currency symbol prefix */}
    {/*   Animated underline: scaleX 250ms on focus */}
    {/* Description input: flex-1 min-w-[140px] */}
    {/* Account select: styled dropdown */}
    {/* Add button: primary, color changes per type */}
  </div>
  {/* Tier 2: scrollable category chips */}
  <div class="flex gap-1.5 overflow-x-auto" style={{ maskImage: '...' }}>
    {/* Recently-used first, selected has ring-2 ring-emerald-500/50 */}
  </div>
</GlassCard>
```

**Sparkline component (inline, SVG):**
```tsx
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  // SVG polyline: 120x36, opacity-10, absolute bottom-right
  // Maps data to SVG points, fills polyline with stroke=color
}
```

**4 Metric cards:** `grid grid-cols-2 lg:grid-cols-4 gap-4`
Each: GlassCard variant="compact" !p-5 relative overflow-hidden + Sparkline
- Income: `TrendingUp` icon, emerald value, `▲ vs last period`
- Expenses: `TrendingDown` icon, red value, `▼ vs last period`
- Net Worth: `Wallet` icon, emerald/red based on sign, custodial exclusion note
- Transactions: `Receipt` icon, zinc value (count)

**2-column charts:** `grid grid-cols-1 lg:grid-cols-2 gap-4`

Spending by Category → **Doughnut**:
```tsx
<Doughnut
  data={doughnutData}
  options={{
    responsive: true, maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'right', labels: { color: '#a1a1aa', font: { size: 10 }, padding: 10, usePointStyle: true }},
      tooltip: CHART_THEME.tooltip,
    },
  }}
/>
```
Top 8 items (top 7 + "Other" aggregation), each category's `color + 'CC'` as backgroundColor.

Monthly Trends → **Bar** (grouped):
```tsx
<Bar
  data={{
    labels: last6.map(m => m.month),
    datasets: [
      { label: 'Income', data: [...], backgroundColor: 'rgba(52, 211, 153, 0.7)', borderRadius: 6, barThickness: 20 },
      { label: 'Expense', data: [...], backgroundColor: 'rgba(248, 113, 113, 0.7)', borderRadius: 6, barThickness: 20 },
    ],
  }}
  options={{ /* legend: top, x grid: none, y grid: subtle, ticks: maxTicksLimit:5 */ }}
/>
```

**Account Summary:** `grid grid-cols-1 md:grid-cols-2 gap-3`
- Non-custodial accounts: GlassCard compact, account name + type badge + currency badge + converted balance + original
- Custodial accounts: separate section with `border-l-2 border-amber-400/40`, amber "Holding for Others" header, "Not counted in net worth" label

State handling:
- Loading: 3 skeleton divs (`animate-pulse bg-zinc-800/60 rounded-xl h-24`)
- Error: red error card with retry button
- Empty (no accounts): `<EmptyState>` with Wallet icon + "No accounts yet" + "Create Account" CTA

### 3.5 AccountsTab.tsx (335 lines)

Account cards in `grid grid-cols-1 md:grid-cols-2 gap-3`:

```tsx
<GlassCard variant="interactive" accent="emerald"
  onClick={() => setExpandedId(isExpanded ? null : account.id)}
  className={`!p-4 border-l-2 ${account.type === 'custodial' ? 'border-l-amber-500/50' : ...}`}
>
  {/* Row: IconBox (account color) + name + type badge + wallet count | balance */}
  {/* Expanded wallet list via AnimatePresence (height auto, opacity) */}
  {/* Each wallet: type icon (Landmark/CreditCard/Banknote) + name + last_four + balance */}
  {/* Hover actions (edit/archive) on wallet rows */}
</GlassCard>
```

Type badges: personal=emerald, joint=purple, custodial=amber, business=blue.
Account type labels: personal → "Personal", joint → "Joint", custodial → "Holding", business → "Business".

**CreateAccountModal:**
- Overlay: `fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)]`
- Card: `max-w-sm bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5`
- Fields: Name | Type segmented control (4 buttons) | Description (optional) | Currency picker (searchable, shows symbol+name) | Initial balance
- Custodial hint: "Custodial balances are excluded from Net Worth calculations"
- Footer: Cancel (ghost) + Create (primary emerald, spinner on save)

States tested: Loading (3 skeleton cards), Empty (EmptyState + CTA), populated with wallets, no wallets, archived accounts filtered.

### 3.6 TransactionsTab.tsx (237 lines)

Transaction list with date grouping:

```tsx
// Filter bar (sticky, z-elevated):
<div className="sticky top-14 z-elevated bg-zinc-950/90 backdrop-blur-lg border-b border-zinc-800/60 py-3 -mx-5 px-5 mb-4">
  {/* Search input (leading Search icon) + Type filter pills (All/Income/Expense/Transfer) */}
</div>

// Transaction rows:
<GlassCard variant="default"
  className={`!p-3 hover:bg-zinc-800/70 transition-all group border-l-2 ${typeClass} hover:border-l-emerald-500/70`}
>
  {/* Left: type icon box (ArrowUpRight/ArrowDownRight/ArrowLeftRight, tinted) */}
  {/* Middle: description + category badge (colored via inline style)  + account name + time */}
  {/* Right: amount (emerald/red/amber, tabular-nums, sign prefix) */}
  {/* Delete button: opacity-0 group-hover:opacity-100 */}
</GlassCard>
```

Date grouping: "Today", "Yesterday", or full date (weekday, month, day). Each date group shows net total on the right.

State handling:
- Loading: 5 skeleton rows
- Empty: EmptyState with different copy for "no transactions" vs "no matches" (filtered)
- Search: debounced (standard React state, no debounce library)

### 3.7 CategoriesTab.tsx (377 lines)

Grouped by type with colored section headers:
- Income: emerald `TrendingUp` icon
- Expense: red `TrendingDown` icon
- Transfer: amber `ArrowLeftRight` icon

```tsx
// Category card: compact GlassCard, border tinted with cat.color+20
<GlassCard variant="compact" className="!p-3" style={{ borderColor: `${cat.color}20` }}>
  {/* Color dot/icon box (cat.color/20 bg) + name */}
  {/* Spent this period: cat.color formatted amount */}
  {/* Hover: color picker button (opacity-0 group-hover:opacity-100) */}
</GlassCard>
```

**Color picker modal** (separate from create): grid of 8 default colors, `ring-2 ring-emerald-500/50` on active.

**CreateCategoryModal:**
- Same overlay/card pattern as CreateAccountModal
- Fields: Name | Type toggle (3-way) | Icon search + picker (32 Lucide icons, searchable grid) | Color swatches (8 colors) | Live preview chip
- Icons: ShoppingCart, Home, Car, Heart, Book, Coffee, Zap, Gift, Plane, Smartphone, Shirt, Utensils, Music, Gamepad, Monitor, Dumbbell, Droplets, Leaf, Wifi, Film, Train, Briefcase, DollarSign, PiggyBank, CreditCard, Banknote, Landmark, Gem, Receipt, Wallet, TrendingUp, TrendingDown

Default colors: `#10b981, #ef4444, #f59e0b, #3b82f6, #8b5cf6, #ec4899, #06b6d4, #84cc16`

### 3.8 QuickAddModal.tsx (234 lines)

Full transaction creation modal. Opened from FAB or "Add" buttons.

```tsx
<AnimatePresence>
  {open && (
    <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] ..." onClick={onClose}>
      <motion.div className="max-w-md bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5"
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
        {/* Type toggle: 3 buttons (income/expense/transfer) */}
        {/* Amount input (large, currency symbol prefix) */}
        {/* Description input */}
        {/* Account select + Wallet select (conditional) */}
        {/* Date picker (native date input) */}
        {/* Category chips (horizontal list, selectable) */}
        {/* Notes toggle + textarea */}
        {/* Footer: Cancel + Add button */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

Resets all state on open via `useEffect`. Auto-selects first account.

---

## 4. Types (finance-types.ts)

```ts
FinanceAccount { id, name, type('personal'|'joint'|'custodial'|'business'), description, icon, color, currency, balance, is_archived, parent_account_id, created_at, updated_at }
FinanceWallet { id, account_id, name, type('bank'|'debit_card'|'credit_card'|'crypto'|'cash'|'ewallet'|'other'), provider, last_four, balance, currency, is_archived, created_at, updated_at }
FinanceCategory { id, name, type('income'|'expense'|'transfer'), icon, color, sort_order, is_archived, created_at }
FinanceTransaction { id, account_id, wallet_id, category_id, type('income'|'expense'|'transfer'), amount, description, note, date, time, is_recurring, recurring_interval, tags, created_at, updated_at }
FinanceSummary { totalIncome, totalExpense, netBalance, periodComparison?: { incomeChange, expenseChange } }
FinanceSpendingByCategory { categoryId, categoryName, categoryColor, categoryIcon, amount, percentage }
FinanceMonthlyTrend { month, income, expense, net }
FinanceBalanceHistory { date, balance }
FinanceTabKey = 'overview' | 'accounts' | 'transactions' | 'categories'
```

---

## 5. Currency Utilities (currency-data.ts)

17 currencies: USD, EUR, GBP, JPY, CNY, IDR, SGD, KRW, INR, AUD, CAD, CHF, MYR, PHP, THB, VND, BRL

- `CURRENCIES`: Array of `{ code, symbol, name, locale }`
- `EXCHANGE_RATES`: Static USD-based rates (`Record<string, number>`)
- `getCurrencyInfo(code)`: Returns `CurrencyInfo`
- `convertAmount(amount, from, to)`: Converts via USD pivot
- `formatCurrency(amount, code)`: Locale-aware formatting, special-cases zero-decimal currencies (IDR, VND, KRW, JPY)
- `COMMON_CURRENCIES`: `['USD', 'IDR', 'SGD', 'GBP', 'EUR', 'JPY', 'AUD', 'CNY', 'KRW', 'INR']` (used in header dropdown)

---

## 6. Shared Components

### GlassCard.tsx (50 lines)

7 variants: `default | compact | subtle | notebook | bordered | elevated | interactive`
4 accents: `pink | amber | emerald | none`

```tsx
// Variant styles:
default:    'bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 shadow-lg'
compact:    'bg-zinc-900/50 backdrop-blur-md border border-zinc-800/40 shadow-sm p-3'
subtle:     'bg-zinc-900/30 border border-zinc-800/30 shadow-sm'
notebook:   'bg-zinc-950/70 backdrop-blur-lg border-l-2 shadow-inner'
bordered:   'bg-transparent border-[1.5px]'
elevated:   'bg-zinc-800/70 backdrop-blur-2xl border border-zinc-600/40 shadow-2xl'
interactive: 'bg-zinc-900/60 backdrop-blur-xl border shadow-lg cursor-pointer hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200'
```

When accent is set and variant is NOT notebook/bordered: adds 2px top stripe in accent color + 3% tint background.

### PageShell.tsx (25 lines)

3 variants: `default | sticky-header | dashboard`

```tsx
sticky-header: 'flex flex-col h-full'  // Used by finance page
// Applies animation: pageEnter var(--normal) var(--ease-out)
```

### TabBar.tsx (27 lines)

```tsx
<div className="bg-zinc-900/50 p-1 rounded-xl inline-flex gap-0.5">
  // Each tab: flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
  // Active: bg-[var(--page-accent)]/15 text-[var(--page-accent)]
  // Inactive: text-[var(--text-muted)] hover:text-[var(--text-secondary)]
</div>
```

### SectionHeader.tsx (22 lines)

```tsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2.5">
    <div className="w-9 h-9 rounded-lg bg-[var(--page-accent)]/15 flex items-center justify-center text-[var(--page-accent)]">
      {icon}
    </div>
    <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
  </div>
  {action}
</div>
```

### EmptyState.tsx (39 lines)

```tsx
<div className="flex flex-col items-center justify-center py-12">
  // Icon (w-9 h-9 rounded-lg border-zinc-800/60 bg-zinc-900)
  // Title (text-sm font-medium text-secondary)
  // Description (text-xs text-muted, max-w-xs)
  // Action button or node (mt-3/4)
</div>
```

---

## 7. Design Tokens & CSS Variables (from `index.css`)

### CSS Custom Properties

```css
--bg-primary:     #09090b (zinc-950)
--bg-secondary:   #18181b (zinc-900)
--bg-tertiary:    #27272a (zinc-800)
--bg-elevated:    #2d2d31
--bg-glass:       rgba(24, 24, 27, 0.80)
--bg-glass-heavy: rgba(24, 24, 27, 0.92)

--text-primary:   #f4f4f5 (zinc-100)
--text-secondary: #a1a1aa (zinc-400)
--text-muted:     #52525b (zinc-600)
--text-disabled:  #3f3f46 (zinc-700)

--accent-primary:   #ec4899 (pink-500)
--accent-hover:     #db2777
--accent-muted:     rgba(236, 72, 153, 0.15)
--accent-secondary: #22d3ee (cyan-400)

--success:         #34d399 (emerald-400)
--warning:         #fbbf24 (amber-400)
--error:           #f87171 (red-400)
--info:            #38bdf8 (sky-400)

--border-subtle:   #27272a
--border-default:  #3f3f46
--border-active:   #52525b
--border-glass:    rgba(63, 63, 70, 0.50)

--z-base: 0 | --z-elevated: 10 | --z-dropdown: 20 | --z-sticky: 25 | --z-overlay: 30 | --z-modal: 40 | --z-toast: 50 | --z-max: 100
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
--fast: 150ms | --normal: 250ms | --slow: 400ms
```

### Per-Page Accent via `[data-page]` attribute

Finance page: `[data-page="finance"] { --page-accent: #10b981; }`

### Typography

```css
body { font-family: "Geist", "Inter", system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.5; }
code, pre, .font-mono { font-family: "JetBrains Mono", "Fira Code", monospace; }
```

### Glass utility classes

```css
.glass { background: var(--bg-glass); backdrop-filter: blur(16px); border: 1px solid var(--border-glass); }
.glass-heavy { background: var(--bg-glass-heavy); backdrop-filter: blur(24px); border: 1px solid var(--border-glass); }
```

### Focus ring (global default)

```css
*:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px color-mix(in srgb, var(--page-accent) 50%, transparent); }
```

### Animation keyframes

```css
@keyframes pageEnter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 8. Seed Data

FinancePage generates 15 default categories on first load (in the `SEED_CATEGORIES` constant):
- Income (4): Salary, Freelance, Gift, Interest, Refund
- Expense (9): Food & Groceries, Transport, Housing, Utilities, Entertainment, Shopping, Health, Education, Other
- Transfer (1): Transfer

Each with pre-assigned icons (`CircleDollarSign`, `TrendingDown`, `ArrowLeftRight`) and colors.

---

## 9. Anti-Patterns (NEVER violate)

1. **Pure black (#000) backgrounds** — always zinc-950
2. **box-shadow for elevation** — use border brightness + glass layers
3. **More than 2 font families** in a single view
4. **Animating width/height/top/left** — use transform + opacity only
5. **Default browser focus rings** — use ring tokens
6. **rounded-2xl (16px) or rounded-3xl (24px)** — max is rounded-xl (12px)
7. **Spring physics** — use cubic-bezier(0.16, 1, 0.3, 1)
8. **More than 3 accent colors in a view**
9. **opacity-50 on text** — use dedicated text color tokens
10. **Arbitrary z-index (999, 1000)** — use the CSS custom property scale
11. **Color as the ONLY state indicator** — always pair with icon/sign/text
12. **No `transition: all`** — specify exact properties
13. **Touch targets below 44×44px**
14. **Disabled buttons looking enabled** — use opacity-40 + cursor-not-allowed

---

## 10. Design Skill References

- `frontend-design/SKILL.md`: Core principles (glass as structure, progressive disclosure, density without clutter, motion as feedback, type as UI)
- `impeccable/SKILL.md`: 7 domains (typography, color, spatial, motion, interaction, responsive, UX writing), 23 commands, 27 anti-patterns
- `taste-skill/SKILL.md`: Variance 5 (balanced), motion 5 (250ms cubic-bezier), density 7 (data-rich but not cluttered)
