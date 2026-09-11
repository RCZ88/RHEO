<aside>
🧮

**Lead design + engineering spec** for multi-select transactions, a live aggregate analytics panel, and a slate of finance QoL features. Grounded entirely in `CONTEXT_BUNDLE.md` (types, IPC, schema, tokens, existing inventory). One opinionated build — no alternatives. Design/spec only; **no app code is written until you say "go."**

</aside>

## 0 · Design decisions (the opinionated best version)

Every downstream section follows from these. Each is a single committed choice, justified against the codebase.

| **Decision** | **Choice** | **Why (grounded)** |
| --- | --- | --- |
| Where selection state lives | A dedicated `useTransactionSelection` hook **inside `TransactionsTab`** — not in `FinancePage` | `FinancePage.tsx` is already 904 lines and owns CRUD + lock + routing. Selection is ephemeral, tab-local UI state; lifting it up would bloat the page and re-render every tab. Keep blast radius to the Transactions subtree. |
| Selection data structure | **Anchored hybrid:** `Set<number>` for manual picks + a `filterAnchored` flag with a `deselectedIds: Set<number>` subtraction set | Avoids copying the whole filtered list for "select all N matching." Filter-select is O(1) to enter; manual deselects are a small subtraction set. Matches the engineering task's optimization note. |
| Aggregation source | **100% client-side** `useMemo` over in-memory `selectedTxns` — zero new read IPC | `fetchData()` already loads all transactions into memory on unlock. Aggregates are pure derivations; no round-trip needed. |
| Panel placement | **Sticky bottom** `GlassSurface` dock inside the Transactions scroll area, `AnimatePresence` show/hide | Keeps the list and its analytics in one visual context; sidebar would fight the existing FAB at `bottom-6 right-6`. Bottom dock clears the FAB by reserving right padding. |
| Export | **Client-side `Blob` download** — no IPC | All fields (wallet/category/account names) are already resolved on the in-memory rows. A `dialog.showSaveDialog` round-trip adds a main-process handler for no benefit. Browser download is instant and offline. |
| Batch delete | **Reuse `finance:delete-transaction`** per id, sequentially, inside one optimistic UI pass | That handler already reverses balances and cascades transfer pairs via `transfer_id`. Re-implementing batch SQL would risk double-reversing transfer legs. |
| Batch recategorize | **One new IPC** `finance:batch-update-category` (metadata-only, no balance impact) | Category change touches no balances, so a single wrapped `UPDATE ... WHERE id IN (...)` is safe and far faster than N round-trips. |

## 1 · Component architecture

New components live in `src/components/finance/` (feature) and `_fx/` (primitives), per DeskFlow conventions. Existing files are reused, not rewritten.

```
TransactionsTab.tsx                         (MODIFY — host of selection)
│
├── useTransactionSelection()               NEW hook  _fx/useTransactionSelection.ts
│      └─ returns { state, derivedSelectedIds, api } consumed by the subtree below
│
├── <TransactionsToolbar/>                   existing filter bar (search, type pills, date range)
│      └── + <SelectAllControl/>             NEW — "Select all N matching" / tri-state master checkbox
│
├── <SelectableTransactionList/>             NEW wrapper around existing grouped rows
│      ├── <DateGroupHeader/>                 MODIFY — add group tri-state checkbox
│      └── <TransactionRow/> (existing)       MODIFY — add leading <TransactionCheckbox/>
│            └── <TransactionCheckbox/>       NEW primitive  _fx/TransactionCheckbox.tsx
│
├── <AnimatePresence>
│      └── <SelectionAggregatePanel/>         NEW  finance/SelectionAggregatePanel.tsx
│             ├── <SelectionBar/>             NEW — "N selected · Ctrl+A · Esc" + close
│             ├── stat cards (Count / Inflow / Outflow / Net)   reuse AnimatedAmount
│             ├── <CategoryBreakdownList/>    NEW — horizontal bar list
│             ├── <WalletBreakdownList/>      NEW — horizontal bar list
│             ├── <Sparkline/> (existing)     daily distribution micro-chart
│             └── <BatchActionsBar/>          NEW — Delete · Recategorize · Export CSV
│
├── <BatchRecategorizeModal/>                 NEW  finance/modals/BatchRecategorizeModal.tsx
│      └── <CategoryChipGrid/> (existing, reused)
└── <PasswordConfirmDialog/> (existing)        reused for gated batch delete
```

Communication: the hook returns one object; `TransactionsTab` passes `derivedSelectedIds` + `api` down by props (single subtree, so **no React Context needed**). The aggregate panel receives `selectedTxns` (resolved via `useMemo`) and the `api` for batch actions.

## 2 · State model

```tsx
// _fx/useTransactionSelection.ts

export type SelectionMode = 'idle' | 'manual' | 'filter';

export interface SelectionState {
	mode: SelectionMode;
	// MANUAL mode: the explicit set the user checked
	selectedIds: Set<number>;
	// FILTER mode: "every currently-filtered row is selected EXCEPT these"
	filterAnchored: boolean;
	deselectedIds: Set<number>;
	// anchor for Shift+click contiguous range selection (index into the flat visible order)
	lastAnchorId: number | null;
}

// Derived — never stored. Recomputed via useMemo from state + the current filtered list.
export interface DerivedSelection {
	selectedIds: Set<number>;       // the resolved truth used everywhere
	count: number;                  // selectedIds.size
	totalVisible: number;           // filteredTxns.length
	headerState: 'none' | 'some' | 'all';  // tri-state for master + group checkboxes
}

export interface SelectionApi {
	toggleOne(id: number): void;                 // plain click
	toggleWithCtrl(id: number): void;            // add/remove, keep others
	selectRangeTo(id: number, order: number[]): void; // Shift+click using visible order
	toggleGroup(groupIds: number[]): void;       // date-group header checkbox
	selectAllFiltered(filteredIds: number[]): void;   // "Select all N matching" / Ctrl+A
	clear(): void;                               // Escape
	isSelected(id: number): boolean;
}
```

```tsx
// Aggregate model — finance/SelectionAggregatePanel.tsx

export interface CategorySlice {
	categoryId: number;
	name: string;
	color: string;   // from category_color join, falls back to categoryVisual.ts
	icon: string;
	total: number;   // absolute spend within selection
	count: number;
	pct: number;     // total / outflow
}

export interface WalletSlice {
	walletId: number | null;
	name: string;    // wallet_name, or 'Unassigned'
	total: number;
	count: number;
	pct: number;
}

export interface DailyPoint { date: string; net: number; }

export interface AggregateData {
	count: number;
	inflow: number;          // SUM(amount) where type='income'
	outflow: number;         // SUM(abs(amount)) where type='expense'
	net: number;             // inflow - outflow
	avgExpense: number;      // outflow / expenseCount (0-safe)
	expenseCount: number;
	dateRange: { from: string; to: string } | null; // MIN/MAX date
	byCategory: CategorySlice[]; // sorted desc by total
	byWallet: WalletSlice[];     // sorted desc by total
	daily: DailyPoint[];         // for the Sparkline
}
```

### Derivation rules

- **Resolved selected ids:** if `filterAnchored` → `filteredIds.filter(id => !deselectedIds.has(id))`; else → `selectedIds`.
- **`headerState`** (tri-state): `count === 0` → `none`; `count === totalVisible` → `all`; else → `some` (renders the indeterminate dash). This drives both the toolbar master control and each date-group header.
- **Mixed indicator** ("N of M selected"): shown whenever `mode === 'filter'` and `deselectedIds.size > 0`, or whenever `headerState === 'some'`.
- **Shift+range:** `selectRangeTo` walks the **flat visible order array** (the same order rows render in after grouping) from `lastAnchorId` to the clicked id and unions that slice into `selectedIds` (switching to `manual` mode if needed).

## 3 · Aggregation math

Pure, memoized, 0-safe. Lives next to the panel; recomputes only when `selectedIds` or the source rows change.

```tsx
const aggregate = useMemo<AggregateData>(() => {
	const rows = allTxns.filter(t => selectedIds.has(t.id));
	let inflow = 0, outflow = 0, expenseCount = 0;
	const cat = new Map<number, CategorySlice>();
	const wal = new Map<number | null, WalletSlice>();
	const day = new Map<string, number>();

	for (const t of rows) {
		const abs = Math.abs(t.amount);
		if (t.type === 'income') inflow += abs;
		else if (t.type === 'expense') { outflow += abs; expenseCount++; }
		// transfers are net-neutral: counted, but excluded from inflow/outflow/P&L

		if (t.type === 'expense') {
			const c = cat.get(t.category_id) ?? seedCat(t);
			c.total += abs; c.count++; cat.set(t.category_id, c);
			const w = wal.get(t.wallet_id) ?? seedWallet(t);
			w.total += abs; w.count++; wal.set(t.wallet_id, w);
		}
		const signed = t.type === 'income' ? abs : t.type === 'expense' ? -abs : 0;
		day.set(t.date, (day.get(t.date) ?? 0) + signed);
	}

	const net = inflow - outflow;
	const dates = rows.map(r => r.date).sort();
	return {
		count: rows.length, inflow, outflow, net,
		expenseCount, avgExpense: expenseCount ? outflow / expenseCount : 0,
		dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
		byCategory: [...cat.values()].map(c => ({ ...c, pct: outflow ? c.total / outflow : 0 }))
			.sort((a, b) => b.total - a.total),
		byWallet: [...wal.values()].map(w => ({ ...w, pct: outflow ? w.total / outflow : 0 }))
			.sort((a, b) => b.total - a.total),
		daily: [...day.entries()].sort().map(([date, net]) => ({ date, net })),
	};
}, [selectedIds, allTxns]);
```

**Transfer handling decision:** transfers are *counted* in `count` and shown in the daily chart as net-zero, but excluded from inflow/outflow/Net — otherwise a transfer would double as both income and expense and corrupt P&L. This matches the two-legged atomic transfer model in the bundle.

## 4 · Visual spec

All values use existing DeskFlow tokens. Max radius `rounded-xl`, easing `cubic-bezier(0.16, 1, 0.3, 1)`, no box-shadow, touch targets ≥ 44px.

### 4.1 `TransactionCheckbox` (`_fx/TransactionCheckbox.tsx`)

| **State** | **Classes** |
| --- | --- |
| Hit area | `flex items-center justify-center w-11 h-11` (44px target) wrapping the visual box |
| Box base | `w-5 h-5 rounded-md border transition-colors duration-150` |
| Unchecked | `border-zinc-600 bg-transparent` |
| Checked | `bg-emerald-500 border-emerald-500`  • `<Check className="w-3.5 h-3.5 text-zinc-950"/>` (Lucide) |
| Indeterminate | `bg-emerald-500/20 border-emerald-500`  • `<Minus className="w-3.5 h-3.5 text-emerald-400"/>` |
| Focus | `ring-2 ring-emerald-500/30 outline-none` |
| Row reveal | Hidden by default, `opacity-0 group-hover:opacity-100`; pinned `opacity-100` once any selection is active (select mode) |

The checkbox is a **separate click target**: `onClick` calls `stopPropagation()` so the row's existing `onClick → TransactionDetailModal` never fires from a checkbox press.

### 4.2 `SelectionBar` + `SelectionAggregatePanel`

- **Selection bar:** floating glass chip docked just under the filter bar — `GlassSurface` with `bg-zinc-800/60 backdrop-blur rounded-xl px-3 h-11 flex items-center gap-3`. Content: emerald count pill `text-emerald-400 font-semibold tabular-nums`, dim hint `text-[11px] text-zinc-500` reading `N selected · Ctrl+A to select all · Esc to clear`, and a mixed-state note `N of M` when partial.
- **Aggregate panel dock:** `GlassSurface` pinned `sticky bottom-0` (inside the scroll container) with `rounded-t-xl border-t border-white/5 bg-zinc-900/80 backdrop-blur-xl p-4 pr-20` (right padding clears the FAB). `AnimatePresence` + `motion.div` slide/fade using `financeMotion` `DUR` and the house easing.
    - **Row 1 — stat cards** (`grid grid-cols-2 lg:grid-cols-4 gap-3`): Count, Total Inflow (`emerald-400`), Total Outflow (`red-400`), Net (emerald if ≥0 else red). Each value rendered with `AnimatedAmount` / `useCountUp`, `text-money font-semibold tabular-nums`. Labels `text-[11px] uppercase tracking-[0.08em] text-zinc-500`.
    - **Row 2 — breakdowns** (`grid grid-cols-1 lg:grid-cols-3 gap-3`): `CategoryBreakdownList`, `WalletBreakdownList`, and the daily `Sparkline`. Each breakdown row: icon dot in category color, name, `tabular-nums` amount, and a `h-1.5 rounded-full bg-zinc-700` track with an emerald (or category-color) fill width = `pct`.

### 4.3 The four states

| **State** | **Behavior** |
| --- | --- |
| Empty | No selection → panel unmounted (`AnimatePresence` exit). Checkboxes hidden unless the user pins "select mode." List looks exactly as today. |
| Loading | N/A — data is in-memory. (Documented as intentionally N/A to satisfy the state checklist.) |
| Populated | Panel mounted, every metric live-updates with a count-up on each selection change. Breakdown bars animate width. |
| Error | Batch action failure → toast with message + **Retry** (retries only the failed ids). Rows that failed to delete animate back in. |

### 4.4 Anti-slop checklist

| **#** | **Check** | **How this spec satisfies it** |
| --- | --- | --- |
| 1 | Distinct type colors | income `emerald-400`, expense `red-400`, transfer `amber-400` — used in stat cards + row accents |
| 2 | Spacing hierarchy | `gap-3`/`p-4` panel, `gap-2` within cards; labels at `text-[11px]`, values at `text-money` |
| 3 | Motion-pref aware | All `motion.*` honor `prefers-reduced-motion` → fall back to instant opacity, no count-up |
| 4 | Consistent icon library | Lucide only (`Check`, `Minus`, `Trash2`, `Tag`, `Download`, `X`) |
| 5 | All states present | Empty / Loading(N/A) / Populated / Error defined for panel + batch actions |
| 6 | Glass over shadow | `backdrop-blur`  • `border-white/5`; zero box-shadow |
| 7 | Radius cap | `rounded-xl` max; checkbox `rounded-md` |
| 8 | Touch targets | 44px checkbox hit area + 44px action buttons |
| 9 | tabular-nums | Every numeric uses `tabular-nums` to stop digit jitter during count-up |
| 10 | Token fidelity | Only bundle tokens (zinc-800/900 family, emerald accent, house easing) |

## 5 · UX flows

### 5.1 Multi-select

1. User applies filters (type pills, wallet, category, date range, search) → filtered grouped list.
2. Hovering a row reveals its checkbox; once ≥1 is checked, select mode pins all checkboxes visible.
3. Date-group header checkbox toggles that group (tri-state).
4. Toolbar master control / `Ctrl+A` → "Select all N matching" enters **filter-anchored** mode.
5. Clicking the row body (not the checkbox) still opens `TransactionDetailModal`.
6. Selecting ≥1 → aggregate panel slides up from the bottom; stays put during scroll (sticky).
7. `Esc` clears selection **and** the panel exits.

### 5.2 Batch delete

Click **Delete N** → if `checkPasswordRequirement('delete_transaction')`-style gate enabled, show existing `PasswordConfirmDialog`; else a lightweight confirm. On confirm, optimistically animate rows out (`AnimatePresence`) and call `financeDeleteTransaction(id)` sequentially (transfer cascade handled by the existing handler). Any failures → error toast + **Retry** for just the failed ids; those rows animate back in.

### 5.3 Batch recategorize

Click **Recategorize** → `BatchRecategorizeModal` with the reused `CategoryChipGrid`. Pick one category → fire `finance:batch-update-category` (single wrapped UPDATE). No balance impact. Brief success state, panel metrics recompute.

### 5.4 Export CSV

Click **Export N** → client-side: build headers `date,time,type,amount,description,category,wallet,account,note,tags`, map each selected row using already-resolved names, join, `new Blob([...], { type: 'text/csv' })`, `URL.createObjectURL`, click a hidden `<a download="finance-export-YYYY-MM-DD.csv">`, then revoke the URL.

### 5.5 Filters change while a selection is active

If `mode === 'filter'` (anchored), the selection **auto-recalculates** against the new filtered set — that is the intent of "all matching." If `mode === 'manual'`, keep the explicit picks that still exist in the new set and silently drop the rest (no nag dialog; show the updated "N selected" count). This is the least surprising behavior and needs no modal.

## 6 · Keyboard shortcuts

| **Shortcut** | **Action** |
| --- | --- |
| `Ctrl/Cmd + A` | Select all visible (filtered) — enters filter-anchored mode. Only when the Transactions tab is focused and no input is focused. |
| `Shift + click` | Contiguous range select from the last anchor to the clicked row |
| `Ctrl/Cmd + click` | Toggle a single row without clearing the rest |
| `Esc` | Clear selection and hide the aggregate panel |
| `Delete` / `Backspace` | Trigger batch delete confirm (respects password gate); ignored when an input is focused |

## 7 · Backend gaps (only what's truly needed)

Most of this feature is frontend-only. Exactly **one** new IPC handler is required; CSV and aggregation need none.

### 7.1 NEW — `finance:batch-update-category`

```tsx
// preload.ts
financeBatchUpdateCategory: (ids: number[], categoryId: number) =>
	ipcRenderer.invoke('finance:batch-update-category', { ids, categoryId })

// main.ts handler
ipcMain.handle('finance:batch-update-category', (_e, { ids, categoryId }) => {
	if (!ids?.length) return { success: false, error: 'no ids' };
	const run = db.transaction((list: number[]) => {
		const stmt = db.prepare(
			'UPDATE finance_transactions SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		);
		for (const id of list) stmt.run(categoryId, id);
	});
	try { run(ids); return { success: true, updated: ids.length }; }
	catch (e) { return { success: false, error: String(e) }; }
});
```

Metadata-only → no balance recompute. Wrapped in `db.transaction()` for atomicity. (A dynamic `WHERE id IN (...)` is also fine; the prepared-loop avoids variadic-param limits for very large selections.)

### 7.2 Reused, unchanged

- `finance:delete-transaction` — batch delete loops over this (balance reversal + transfer cascade already handled).
- `finance:get-transactions` — selection reads the already-fetched in-memory rows; no change.
- **No** `finance:export-csv` — client-side Blob is the chosen path.

## 8 · Implementation plan (dependency-ordered)

| **#** | **File** | **Create / Modify** | **Purpose** |
| --- | --- | --- | --- |
| 1 | `_fx/useTransactionSelection.ts` | Create | Selection state machine + api + derivations |
| 2 | `_fx/TransactionCheckbox.tsx` | Create | Tri-state checkbox primitive |
| 3 | `TransactionsTab.tsx` | Modify | Wire hook, add checkbox column + group/master controls, keyboard handlers |
| 4 | `finance/SelectionAggregatePanel.tsx` | Create | Sticky dock: stat cards + breakdowns + sparkline + batch bar |
| 5 | `finance/CategoryBreakdownList.tsx`  • `WalletBreakdownList.tsx` | Create | Horizontal bar lists |
| 6 | `finance/BatchActionsBar.tsx` | Create | Delete · Recategorize · Export buttons + handlers |
| 7 | `finance/modals/BatchRecategorizeModal.tsx` | Create | Category picker reusing `CategoryChipGrid` |
| 8 | `preload.ts`  • `main.ts` | Modify | Add `finance:batch-update-category` |
| 9 | `finance/csvExport.ts` | Create | Pure client-side CSV builder + download |

Guardrails: do not touch the FAB / wallet-selector quick-add flow; do not lift selection into `FinancePage`; respect the lock/password system for delete.

## 9 · Secondary — Finance QoL proposals

Five high-impact additions, each grounded in the bundle. "Backend ready?" answered per item.

| **Feature** | **Backend ready?** | **Effort** | **Where it fits** |
| --- | --- | --- | --- |
| **Transaction tags + tag filter** | ✅ `tags TEXT` column already exists — **UI only** (+ tiny filter clause) | S–M | Add tag chips in the 7 modals (`useTransactionForm`), a tag filter pill in `TransactionsTab`, tags column in CSV. Reuses multi-select for bulk-tagging. |
| **Recurring transactions manager** | ⚠️ `is_recurring`  • `recurring_interval` columns exist but **no UI and no scheduler** — needs new IPC + a post-on-launch job | L | New `RecurringTab` (or section in Overview). New IPC `finance:get-recurring`, `finance:upsert-recurring`, and a launch-time "post due recurring" pass that inserts transactions whose next date ≤ today. |
| **Per-category budgets + progress bars + alerts** | ❌ Needs a new `finance_budgets` table + IPC (read is derivable from existing spend-by-category) | M | New `BudgetsTab` or cards in Overview. Progress bar per category vs monthly limit; amber at 80%, red at 100%. Alerts surface as a badge on the category + Overview banner. |
| **Transaction templates (quick-fill)** | ⚠️ No table needed if stored in `localStorage` (matches existing `txPrefs.ts` / last-used pattern); a table is the durable upgrade | S–M | "Save as template" in modals; a template picker row in the FAB quick-add. Reuses `useTransactionForm` to hydrate fields. |
| **Balance forecast (cashflow projection)** | ⚠️ Depends on the recurring manager; pure client-side projection once recurring data exists | M–L | A projected net-worth line on `OverviewTab` (reuse `NetWorthLineChart`) extending 30/60/90 days from current balance + scheduled recurring in/out. |

**Quick bonus wins** (S, mostly UI): a **"cleared/reconciled" toggle** (one new boolean column + a row badge) for bank-statement matching; and **saved filter presets** (localStorage) that pair perfectly with the new filter-anchored multi-select.

### Recommended sequence

Ship **multi-select + aggregate panel** first (it's frontend-heavy, one tiny IPC, and immediately enables bulk-tagging and bulk-recategorize). Then **tags** (cheapest, schema-ready), then **budgets+alerts**, then the **recurring manager** (unlocks **forecast**), then **templates**.

## 10 · Tooling note

The `generate-prompt` skill and the frontend MCP servers (shadcn/ui, Magic UI, 21st.dev, React Bits, Iconify) referenced in the brief are **not connected in this environment**, so their named primitives weren't pulled live. Every component above is therefore specified against DeskFlow's own existing primitives (`GlassSurface`, `Sparkline`, `AnimatedAmount`, `CategoryChipGrid`, `financeMotion`) and Lucide icons — which keeps the build dependency-free as the constraints require.

## 11 · Production-ready frontend code (drop-in)

<aside>
🧩

**These are complete, paste-ready files** styled to the existing finance tab (emerald accent, `GlassSurface`, `financeMotion`, Lucide, `tabular-nums`, `rounded-xl`, no box-shadow). The implementing model only has to: (1) fix import paths to your tree, (2) confirm the prop names of your existing `AnimatedAmount` / `Sparkline` / `CategoryChipGrid` / `PasswordConfirmDialog`, and (3) wire the **three marked insert points** in `TransactionsTab.tsx` (§11.7). No design decisions left to make.

</aside>

### 11.1 · `_fx/useTransactionSelection.ts`

```tsx
import { useCallback, useMemo, useState } from 'react'

export type SelectionMode = 'idle' | 'manual' | 'filter'

export interface SelectionState {
	mode: SelectionMode
	selectedIds: Set<number>
	filterAnchored: boolean
	deselectedIds: Set<number>
	lastAnchorId: number | null
}

export interface DerivedSelection {
	selectedIds: Set<number>
	count: number
	totalVisible: number
	headerState: 'none' | 'some' | 'all'
	isMixed: boolean
}

export interface SelectionApi {
	toggleOne: (id: number) => void
	toggleWithCtrl: (id: number) => void
	selectRangeTo: (id: number, order: number[]) => void
	toggleGroup: (groupIds: number[]) => void
	selectAllFiltered: () => void
	clear: () => void
	isSelected: (id: number) => boolean
}

const EMPTY: SelectionState = {
	mode: 'idle',
	selectedIds: new Set(),
	filterAnchored: false,
	deselectedIds: new Set(),
	lastAnchorId: null,
}

/** Bound to the live filtered id list; everything derives from it. */
export function useTransactionSelection(filteredIds: number[]) {
	const [state, setState] = useState<SelectionState>(EMPTY)

	// resolved truth: what is actually selected right now
	const derivedSelectedIds = useMemo(() => {
		if (state.filterAnchored) {
			return new Set(filteredIds.filter((id) => !state.deselectedIds.has(id)))
		}
		return state.selectedIds
	}, [state, filteredIds])

	const derived = useMemo<DerivedSelection>(() => {
		const count = derivedSelectedIds.size
		const totalVisible = filteredIds.length
		const headerState =
			count === 0
				? 'none'
				: count >= totalVisible && totalVisible > 0
					? 'all'
					: 'some'
		const isMixed =
			(state.filterAnchored && state.deselectedIds.size > 0) || headerState === 'some'
		return { selectedIds: derivedSelectedIds, count, totalVisible, headerState, isMixed }
	}, [derivedSelectedIds, filteredIds.length, state])

	const isSelected = useCallback(
		(id: number) => derivedSelectedIds.has(id),
		[derivedSelectedIds],
	)

	// collapse a filter-anchored selection into an explicit set when the user edits it
	const explicitFrom = (prev: SelectionState) =>
		prev.filterAnchored
			? new Set(filteredIds.filter((x) => !prev.deselectedIds.has(x)))
			: new Set(prev.selectedIds)

	const commit = (base: Set<number>, anchor: number | null): SelectionState => ({
		mode: base.size ? 'manual' : 'idle',
		selectedIds: base,
		filterAnchored: false,
		deselectedIds: new Set(),
		lastAnchorId: anchor,
	})

	const toggleOne = useCallback((id: number) => {
		setState((prev) => {
			const base = explicitFrom(prev)
			if (base.has(id)) base.delete(id)
			else base.add(id)
			return commit(base, id)
		})
	}, [filteredIds])

	// Ctrl/Cmd-click: in filter mode, subtract from the anchor set instead of collapsing it
	const toggleWithCtrl = useCallback((id: number) => {
		setState((prev) => {
			if (prev.filterAnchored) {
				const deselectedIds = new Set(prev.deselectedIds)
				if (deselectedIds.has(id)) deselectedIds.delete(id)
				else deselectedIds.add(id)
				return { ...prev, deselectedIds, lastAnchorId: id }
			}
			const base = new Set(prev.selectedIds)
			if (base.has(id)) base.delete(id)
			else base.add(id)
			return commit(base, id)
		})
	}, [])

	const selectRangeTo = useCallback((id: number, order: number[]) => {
		setState((prev) => {
			const anchor = prev.lastAnchorId ?? id
			const a = order.indexOf(anchor)
			const b = order.indexOf(id)
			if (a === -1 || b === -1) return prev
			const lo = Math.min(a, b)
			const hi = Math.max(a, b)
			const base = explicitFrom(prev)
			for (let i = lo; i <= hi; i++) base.add(order[i])
			return commit(base, id)
		})
	}, [filteredIds])

	const toggleGroup = useCallback((groupIds: number[]) => {
		setState((prev) => {
			const base = explicitFrom(prev)
			const allOn = groupIds.every((id) => base.has(id))
			for (const id of groupIds) {
				if (allOn) base.delete(id)
				else base.add(id)
			}
			return commit(base, groupIds[groupIds.length - 1] ?? null)
		})
	}, [filteredIds])

	const selectAllFiltered = useCallback(() => {
		setState((prev) => {
			const fullyOn = prev.filterAnchored && prev.deselectedIds.size === 0
			if (fullyOn) return EMPTY // toggle off when everything is already selected
			return {
				mode: 'filter',
				selectedIds: new Set(),
				filterAnchored: true,
				deselectedIds: new Set(),
				lastAnchorId: null,
			}
		})
	}, [])

	const clear = useCallback(() => setState(EMPTY), [])

	const api = useMemo<SelectionApi>(
		() => ({
			toggleOne,
			toggleWithCtrl,
			selectRangeTo,
			toggleGroup,
			selectAllFiltered,
			clear,
			isSelected,
		}),
		[toggleOne, toggleWithCtrl, selectRangeTo, toggleGroup, selectAllFiltered, clear, isSelected],
	)

	return { state, derived, derivedSelectedIds, api }
}
```

### 11.2 · `_fx/useSelectionAggregate.ts`

```tsx
import { useMemo } from 'react'
import type { FinanceTransaction } from '../../types/finance'

export interface CategorySlice {
	categoryId: number
	name: string
	color: string
	icon: string
	total: number
	count: number
	pct: number
}

export interface WalletSlice {
	walletId: number | null
	name: string
	total: number
	count: number
	pct: number
}

export interface DailyPoint {
	date: string
	net: number
}

export interface AggregateData {
	count: number
	inflow: number
	outflow: number
	net: number
	avgExpense: number
	expenseCount: number
	dateRange: { from: string; to: string } | null
	byCategory: CategorySlice[]
	byWallet: WalletSlice[]
	daily: DailyPoint[]
}

export interface AggregateMeta {
	categoryName: (id: number) => string
	categoryColor: (id: number) => string
	categoryIcon: (id: number) => string
	walletName: (id: number | null) => string
}

export function useSelectionAggregate(
	allTxns: FinanceTransaction[],
	selectedIds: Set<number>,
	meta: AggregateMeta,
): AggregateData {
	return useMemo(() => {
		const rows = allTxns.filter((t) => selectedIds.has(t.id))
		let inflow = 0
		let outflow = 0
		let expenseCount = 0
		const cat = new Map<number, CategorySlice>()
		const wal = new Map<number | null, WalletSlice>()
		const day = new Map<string, number>()

		for (const t of rows) {
			const abs = Math.abs(t.amount)
			if (t.type === 'income') inflow += abs
			else if (t.type === 'expense') {
				outflow += abs
				expenseCount++
			}
			// transfers: counted but net-neutral, excluded from inflow/outflow/P&L

			if (t.type === 'expense') {
				const c = cat.get(t.category_id) ?? {
					categoryId: t.category_id,
					name: meta.categoryName(t.category_id),
					color: meta.categoryColor(t.category_id),
					icon: meta.categoryIcon(t.category_id),
					total: 0,
					count: 0,
					pct: 0,
				}
				c.total += abs
				c.count++
				cat.set(t.category_id, c)

				const w = wal.get(t.wallet_id) ?? {
					walletId: t.wallet_id,
					name: meta.walletName(t.wallet_id),
					total: 0,
					count: 0,
					pct: 0,
				}
				w.total += abs
				w.count++
				wal.set(t.wallet_id, w)
			}

			const signed = t.type === 'income' ? abs : t.type === 'expense' ? -abs : 0
			day.set(t.date, (day.get(t.date) ?? 0) + signed)
		}

		const net = inflow - outflow
		const dates = rows.map((r) => r.date).sort()

		return {
			count: rows.length,
			inflow,
			outflow,
			net,
			expenseCount,
			avgExpense: expenseCount ? outflow / expenseCount : 0,
			dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
			byCategory: [...cat.values()]
				.map((c) => ({ ...c, pct: outflow ? c.total / outflow : 0 }))
				.sort((a, b) => b.total - a.total),
			byWallet: [...wal.values()]
				.map((w) => ({ ...w, pct: outflow ? w.total / outflow : 0 }))
				.sort((a, b) => b.total - a.total),
			daily: [...day.entries()].sort().map(([date, value]) => ({ date, net: value })),
		}
	}, [allTxns, selectedIds, meta])
}
```

### 11.3 · `_fx/TransactionCheckbox.tsx`

```tsx
import type React from 'react'
import { Check, Minus } from 'lucide-react'

type CheckState = boolean | 'indeterminate'

interface Props {
	checked: CheckState
	onToggle: (e: React.MouseEvent) => void
	/** pin visible once any selection is active; otherwise reveal on row hover */
	forceVisible?: boolean
	ariaLabel?: string
}

export function TransactionCheckbox({ checked, onToggle, forceVisible, ariaLabel }: Props) {
	const isOn = checked === true
	const isMixed = checked === 'indeterminate'

	// never let a checkbox press bubble up to the row's detail-modal handler
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		onToggle(e)
	}

	const hit = [
		'flex items-center justify-center w-11 h-11 shrink-0 -ml-1.5',
		'transition-opacity duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none',
		forceVisible || isOn || isMixed
			? 'opacity-100'
			: 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
	].join(' ')

	const box = [
		'flex items-center justify-center w-5 h-5 rounded-md border transition-colors duration-150',
		'ring-offset-2 ring-offset-zinc-900',
		isOn
			? 'bg-emerald-500 border-emerald-500'
			: isMixed
				? 'bg-emerald-500/20 border-emerald-500'
				: 'bg-transparent border-zinc-600 hover:border-zinc-500',
	].join(' ')

	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={isMixed ? 'mixed' : isOn}
			aria-label={ariaLabel ?? 'Select transaction'}
			onClick={handleClick}
			className={hit}
		>
			<span className={box}>
				{isOn && <Check className="w-3.5 h-3.5 text-zinc-950" strokeWidth={3} />}
				{isMixed && <Minus className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />}
			</span>
		</button>
	)
}
```

### 11.4 · `finance/SelectionAggregatePanel.tsx`

Includes the panel + its `StatCard`, `BreakdownList`, and `BatchButton` building blocks.

<aside>
ℹ️

`AnimatedAmount` / `Sparkline` / `formatMoney` are your existing primitives — prop names here are illustrative. If your `AnimatedAmount` only accepts `value`, drop `currency`/`signed` and wrap the value with your formatter.

</aside>

```tsx
import type React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, Tag, Download, X } from 'lucide-react'
import { GlassSurface } from '../_fx/GlassSurface'
import { Sparkline } from '../_fx/Sparkline'
import { AnimatedAmount } from '../_fx/AnimatedAmount'
import { formatMoney } from '../_fx/format'
import { financeMotion } from '../_fx/financeMotion'
import type {
	AggregateData,
	CategorySlice,
	WalletSlice,
} from '../_fx/useSelectionAggregate'

const EASE = [0.16, 1, 0.3, 1] as const

const panelMotion = {
	initial: { opacity: 0, y: 24 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: 24 },
	transition: { duration: financeMotion?.DUR ?? 0.24, ease: EASE },
}

interface Props {
	open: boolean
	data: AggregateData
	currency: string
	busy?: boolean
	onClear: () => void
	onDelete: () => void
	onRecategorize: () => void
	onExport: () => void
}

export function SelectionAggregatePanel(props: Props) {
	const { open, data, currency, busy, onClear, onDelete, onRecategorize, onExport } = props
	const netPositive = data.net >= 0

	return (
		<AnimatePresence>
			{open && (
				<motion.div key="agg-panel" {...panelMotion} className="sticky bottom-0 z-10 mt-3">
					<GlassSurface className="rounded-t-xl border-t border-white/5 bg-zinc-900/80 backdrop-blur-xl p-4 pr-20">
						{/* selection bar */}
						<div className="flex items-center justify-between gap-3 mb-3">
							<div className="flex items-center gap-2 text-[13px]">
								<span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold tabular-nums">
									{data.count} selected
								</span>
								{data.isMixed && (
									<span className="text-[11px] text-zinc-500 tabular-nums">
										{data.count} of {data.totalVisible}
									</span>
								)}
								<span className="text-[11px] text-zinc-500">
									Ctrl/Cmd+A to select all · Esc to clear
								</span>
							</div>
							<button
								type="button"
								onClick={onClear}
								aria-label="Clear selection"
								className="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:outline-none"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						{/* row 1 — stat cards */}
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
							<StatCard label="Transactions" tone="neutral">
								<AnimatedAmount value={data.count} />
							</StatCard>
							<StatCard label="Inflow" tone="positive">
								<AnimatedAmount value={data.inflow} currency={currency} />
							</StatCard>
							<StatCard label="Outflow" tone="negative">
								<AnimatedAmount value={data.outflow} currency={currency} />
							</StatCard>
							<StatCard label="Net (P/L)" tone={netPositive ? 'positive' : 'negative'}>
								<AnimatedAmount value={data.net} currency={currency} signed />
							</StatCard>
						</div>

						{/* row 2 — breakdowns + daily sparkline */}
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
							<BreakdownList title="By category" slices={data.byCategory} currency={currency} kind="category" />
							<BreakdownList title="By wallet" slices={data.byWallet} currency={currency} kind="wallet" />
							<div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3">
								<p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 mb-2">Daily net</p>
								{data.daily.length > 0 ? (
									<Sparkline data={data.daily.map((d) => d.net)} className="h-12 w-full" />
								) : (
									<p className="text-[12px] text-zinc-600">No dated activity in selection.</p>
								)}
								{data.dateRange && (
									<p className="text-[11px] text-zinc-500 mt-2 tabular-nums">
										{data.dateRange.from} → {data.dateRange.to}
									</p>
								)}
							</div>
						</div>

						{/* batch actions */}
						<div className="flex flex-wrap items-center gap-2 mt-4">
							<BatchButton icon={Tag} label="Recategorize" onClick={onRecategorize} disabled={busy} />
							<BatchButton icon={Download} label="Export CSV" onClick={onExport} disabled={busy} />
							<BatchButton icon={Trash2} label={`Delete ${data.count}`} onClick={onDelete} disabled={busy} danger />
						</div>
					</GlassSurface>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

function StatCard({
	label,
	tone,
	children,
}: {
	label: string
	tone: 'neutral' | 'positive' | 'negative'
	children: React.ReactNode
}) {
	const toneClass =
		tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : 'text-zinc-100'
	return (
		<div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3">
			<p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 mb-1">{label}</p>
			<p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{children}</p>
		</div>
	)
}

function BreakdownList({
	title,
	slices,
	currency,
	kind,
}: {
	title: string
	slices: Array<CategorySlice | WalletSlice>
	currency: string
	kind: 'category' | 'wallet'
}) {
	const top = slices.slice(0, 5)
	return (
		<div className="rounded-xl border border-white/5 bg-zinc-950/40 p-3">
			<p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500 mb-2">{title}</p>
			{top.length === 0 ? (
				<p className="text-[12px] text-zinc-600">No expenses in selection.</p>
			) : (
				<ul className="space-y-2">
					{top.map((s) => {
						const isCat = kind === 'category'
						const color = isCat ? (s as CategorySlice).color : '#10b981'
						const name = isCat ? (s as CategorySlice).name : (s as WalletSlice).name
						const rowKey = isCat
							? `c-${(s as CategorySlice).categoryId}`
							: `w-${(s as WalletSlice).walletId}`
						const dotStyle = { backgroundColor: color }
						const fillStyle = { width: `${Math.round(s.pct * 100)}%`, backgroundColor: color }
						return (
							<li key={rowKey} className="space-y-1">
								<div className="flex items-center justify-between gap-2 text-[12px]">
									<span className="flex items-center gap-1.5 min-w-0">
										<span className="w-2 h-2 rounded-full shrink-0" style={dotStyle} />
										<span className="truncate text-zinc-300">{name}</span>
									</span>
									<span className="tabular-nums text-zinc-400">{formatMoney(s.total, currency)}</span>
								</div>
								<div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
									<div
										className="h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
										style={fillStyle}
									/>
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}

function BatchButton({
	icon: Icon,
	label,
	onClick,
	disabled,
	danger,
}: {
	icon: React.ComponentType<{ className?: string }>
	label: string
	onClick: () => void
	disabled?: boolean
	danger?: boolean
}) {
	const base =
		'flex items-center gap-2 h-11 px-3.5 rounded-xl text-[13px] font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2'
	const skin = danger
		? 'border-red-500/30 text-red-300 hover:bg-red-500/10 focus-visible:ring-red-500/40'
		: 'border-white/10 text-zinc-200 hover:bg-white/5 focus-visible:ring-emerald-500/40'
	const off = disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
	return (
		<button type="button" onClick={onClick} disabled={disabled} className={`${base} ${skin} ${off}`}>
			<Icon className="w-4 h-4" />
			{label}
		</button>
	)
}
```

### 11.5 · `finance/modals/BatchRecategorizeModal.tsx`

```tsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CategoryChipGrid } from './CategoryChipGrid'
import type { FinanceCategory } from '../../../types/finance'

const EASE = [0.16, 1, 0.3, 1] as const
const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
const dialogMotion = {
	initial: { opacity: 0, scale: 0.97 },
	animate: { opacity: 1, scale: 1 },
	exit: { opacity: 0, scale: 0.97 },
	transition: { duration: 0.25, ease: EASE },
}

interface Props {
	open: boolean
	count: number
	categories: FinanceCategory[]
	busy?: boolean
	onCancel: () => void
	onConfirm: (categoryId: number) => void
}

export function BatchRecategorizeModal({ open, count, categories, busy, onCancel, onConfirm }: Props) {
	const [picked, setPicked] = useState<number | null>(null)

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					{...overlayMotion}
					className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
					onClick={onCancel}
				>
					<motion.div
						{...dialogMotion}
						role="dialog"
						aria-modal="true"
						aria-label="Recategorize selected transactions"
						className="w-full max-w-md rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl p-5"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 className="text-[15px] font-semibold text-zinc-100">
							Recategorize {count} transaction{count === 1 ? '' : 's'}
						</h2>
						<p className="text-[12px] text-zinc-500 mt-1">
							Pick a new category. This only changes labels — balances are not affected.
						</p>

						<div className="mt-4 max-h-64 overflow-y-auto pr-1">
							<CategoryChipGrid categories={categories} selectedId={picked} onSelect={setPicked} />
						</div>

						<div className="flex justify-end gap-2 mt-5">
							<button
								type="button"
								onClick={onCancel}
								className="h-11 px-4 rounded-xl text-[13px] text-zinc-300 border border-white/10 hover:bg-white/5 transition-colors duration-150"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={picked == null || busy}
								onClick={() => picked != null && onConfirm(picked)}
								className="h-11 px-4 rounded-xl text-[13px] font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Apply category
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
```

### 11.6 · `finance/csvExport.ts`

```tsx
import type { FinanceTransaction } from '../../types/finance'

interface CsvLookups {
	categoryName: (id: number) => string
	walletName: (id: number | null) => string
	accountName: (id: number) => string
}

const csvCell = (value: string | number | null | undefined): string => {
	const s = value == null ? '' : String(value)
	// wrap + escape only when the cell contains a comma, quote, or newline
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportTransactionsCsv(txns: FinanceTransaction[], lookups: CsvLookups): void {
	const headers = [
		'Date', 'Time', 'Type', 'Amount', 'Description',
		'Category', 'Wallet', 'Account', 'Note', 'Tags',
	]
	const lines = txns.map((t) =>
		[
			t.date,
			t.time ?? '',
			t.type,
			Math.abs(t.amount).toFixed(2),
			t.description ?? '',
			lookups.categoryName(t.category_id),
			lookups.walletName(t.wallet_id),
			lookups.accountName(t.account_id),
			t.note ?? '',
			t.tags ?? '',
		]
			.map(csvCell)
			.join(','),
	)

	const csv = [headers.join(','), ...lines].join('\r\n')
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
	const url = URL.createObjectURL(blob)
	const today = new Date().toISOString().slice(0, 10)

	const a = document.createElement('a')
	a.href = url
	a.download = `finance-export-${today}.csv`
	document.body.appendChild(a)
	a.click()
	a.remove()
	URL.revokeObjectURL(url)
}
```

### 11.7 · `TransactionsTab.tsx` — wiring (three insert points)

All additions; existing code shown as `// …`. Adjust `categoryMap` / `walletMap` / `accountMap` / `allTxns` / `filtered` / `refreshData` / `openDetail` / `toast` / `displayCurrency` to your existing identifiers.

```tsx
import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { useTransactionSelection } from '../_fx/useTransactionSelection'
import { useSelectionAggregate } from '../_fx/useSelectionAggregate'
import { TransactionCheckbox } from '../_fx/TransactionCheckbox'
import { SelectionAggregatePanel } from './SelectionAggregatePanel'
import { BatchRecategorizeModal } from './modals/BatchRecategorizeModal'
import { exportTransactionsCsv } from './csvExport'

// ─── INSERT POINT 1: after `filtered` (existing client-side filtered list) is computed ───
const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered])
const visibleOrder = filteredIds // already in render order (date groups, newest first)

const { derived, derivedSelectedIds, api } = useTransactionSelection(filteredIds)

const aggMeta = useMemo(
	() => ({
		categoryName: (id: number) => categoryMap.get(id)?.name ?? 'Uncategorized',
		categoryColor: (id: number) => categoryMap.get(id)?.color ?? '#6B7280',
		categoryIcon: (id: number) => categoryMap.get(id)?.icon ?? 'circle',
		walletName: (id: number | null) =>
			id == null ? 'Unassigned' : walletMap.get(id)?.name ?? 'Unknown',
	}),
	[categoryMap, walletMap],
)

const aggregate = useSelectionAggregate(allTxns, derivedSelectedIds, aggMeta)
const selectionActive = derived.count > 0

const [recatOpen, setRecatOpen] = useState(false)
const [busy, setBusy] = useState(false)

const requestBatchDelete = async () => {
	const ids = [...derivedSelectedIds]
	if (ids.length === 0) return
	const gate = await window.finance.getPasswordRequirements?.()
	if (gate?.requireForDelete) {
		const ok = await openPasswordConfirm() // existing PasswordConfirmDialog flow
		if (!ok) return
	}
	setBusy(true)
	const failed: number[] = []
	for (const id of ids) {
		const res = await window.finance.deleteTransaction(id)
		if (!res?.success) failed.push(id)
	}
	setBusy(false)
	await refreshData() // existing fetchData()
	if (failed.length) toast.error(`${failed.length} couldn't be deleted — try again`)
	else {
		api.clear()
		toast.success(`Deleted ${ids.length} transactions`)
	}
}

const applyRecategorize = async (categoryId: number) => {
	const ids = [...derivedSelectedIds]
	setBusy(true)
	const res = await window.finance.batchUpdateCategory(ids, categoryId)
	setBusy(false)
	setRecatOpen(false)
	if (res?.success) {
		await refreshData()
		toast.success(`Moved ${ids.length} to a new category`)
	} else {
		toast.error('Recategorize failed — try again')
	}
}

const handleExport = () => {
	const rows = allTxns.filter((t) => derivedSelectedIds.has(t.id))
	exportTransactionsCsv(rows, {
		categoryName: (id) => categoryMap.get(id)?.name ?? 'Uncategorized',
		walletName: (id) => (id == null ? 'Unassigned' : walletMap.get(id)?.name ?? 'Unknown'),
		accountName: (id) => accountMap.get(id)?.name ?? 'Account',
	})
}

// keyboard shortcuts — scoped to the tab, ignored while typing in an input
useEffect(() => {
	const onKey = (e: KeyboardEvent) => {
		const el = e.target as HTMLElement
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
		const meta = e.ctrlKey || e.metaKey
		if (meta && e.key.toLowerCase() === 'a') {
			e.preventDefault()
			api.selectAllFiltered()
		} else if (e.key === 'Escape' && selectionActive) {
			api.clear()
		} else if ((e.key === 'Delete' || e.key === 'Backspace') && selectionActive) {
			e.preventDefault()
			requestBatchDelete()
		}
	}
	window.addEventListener('keydown', onKey)
	return () => window.removeEventListener('keydown', onKey)
}, [api, selectionActive])

// ─── INSERT POINT 2: leading checkbox inside each transaction row ───
// Render rows via map so each row owns its handler:
{filtered.map((t) => {
	const onCheckbox = (e: React.MouseEvent) => {
		if (e.shiftKey) api.selectRangeTo(t.id, visibleOrder)
		else if (e.ctrlKey || e.metaKey) api.toggleWithCtrl(t.id)
		else api.toggleOne(t.id)
	}
	return (
		<div key={t.id} className="group flex items-center gap-2" onClick={() => openDetail(t)}>
			<TransactionCheckbox
				checked={api.isSelected(t.id)}
				forceVisible={selectionActive}
				ariaLabel={`Select ${t.description || t.type}`}
				onToggle={onCheckbox}
			/>
			{/* …existing row content (amount, category, wallet, etc.)… */}
		</div>
	)
})}

// Date-group header tri-state checkbox (inside each group header):
// const groupIds = group.items.map((t) => t.id)
// const allOn = groupIds.every((id) => api.isSelected(id))
// const someOn = !allOn && groupIds.some((id) => api.isSelected(id))
// <TransactionCheckbox
//   checked={allOn ? true : someOn ? 'indeterminate' : false}
//   forceVisible={selectionActive}
//   ariaLabel="Select all in this date group"
//   onToggle={() => api.toggleGroup(groupIds)}
// />

// Toolbar master "select all" control:
// <button type="button" onClick={() => api.selectAllFiltered()} className="…">
//   {derived.headerState === 'all' ? 'Deselect all' : `Select all ${filtered.length}`}
// </button>

// ─── INSERT POINT 3: panel + modal at the end of the tab's JSX tree ───
<SelectionAggregatePanel
	open={selectionActive}
	data={aggregate}
	currency={displayCurrency}
	busy={busy}
	onClear={api.clear}
	onDelete={requestBatchDelete}
	onRecategorize={() => setRecatOpen(true)}
	onExport={handleExport}
/>
<BatchRecategorizeModal
	open={recatOpen}
	count={derived.count}
	categories={categories}
	busy={busy}
	onCancel={() => setRecatOpen(false)}
	onConfirm={applyRecategorize}
/>
```

### 11.8 · Backend (one new IPC)

The only backend change is `finance:batch-update-category` — full handler + preload binding are in **§7.1**. Wire `window.finance.batchUpdateCategory(ids, categoryId)` to that channel. Batch delete reuses the existing `finance:delete-transaction`; CSV + aggregation are pure client-side.

## 12 · How the five design skills were applied

**Scope (Human-Centric UX rule):** this applies to the **Transactions tab of the Finance page only** — the checkbox column, master/group controls, the sticky aggregate dock, and the recategorize modal. The FAB quick-add, other finance tabs, and `FinancePage` routing are untouched.

**Taste knobs:** variance **5** (balanced — reuse the existing finance language, no novelty for its own sake), motion **4** (financial dashboards stay calm: count-ups + slide/fade, no spring), density **7** (4-stat row + two breakdown columns + sparkline in one dock).

| **Skill** | **What it dictated in this build** |
| --- | --- |
| **Frontend Design** | `bg-zinc-900/80` glass + `border-white/5` and zero box-shadow; `rounded-xl` cap (checkbox `rounded-md`); 150–250ms `cubic-bezier(0.16,1,0.3,1)`; `p-3`/`p-4` on the 8px grid; 11px label / 13px body type scale; reused `GlassSurface`  • the StatCard pattern. |
| **Human-Centric UX** | All four states (Empty = panel hidden; Loading = N/A in-memory; Populated = live count-ups; Error = toast + retry); plain-language labels ("Inflow" / "Outflow" / "Net (P/L)", never enum codes); checkbox is a separate 44px target so a row click still opens the detail modal; full keyboard path (Ctrl/Cmd+A, Esc, Delete) with inputs guarded; destructive batch delete confirms through the existing password gate. |
| **UI-UX-ProMax** (Financial rules) | `tabular-nums` on every figure; numbers count up; sparkline + KPI cards; amounts carry cents (`toFixed(2)` in CSV); state is never signalled by red/green alone — always paired with a text label + icon. |
| **Impeccable** | Max 3 accents (emerald primary + red semantic + zinc neutrals); depth via opacity layers (`emerald-500/15`, `/20`) not new hex; z-index discipline (panel `z-10`, modal `z-30`, overlay `bg-black/70`); animate only `transform`/`opacity`; `focus-visible` rings everywhere; disabled = `opacity-40 cursor-not-allowed`; verb+noun button labels ("Export CSV", "Apply category"). |
| **Taste** | variance 5 / motion 4 / density 7 — calm, dense, on-brand; anti-repetition satisfied by matching the finance tab's existing emerald system instead of inventing a new accent. |

Reduced motion: every `motion.*` and the count-ups must fall back to instant opacity under `prefers-reduced-motion` (Impeccable anti-pattern #19, Frontend Design principle #4).