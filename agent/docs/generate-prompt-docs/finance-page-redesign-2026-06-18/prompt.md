# Finance Page — Visual Design Brief

## How to use this document

This is a **build prompt for the implementing AI**, which has no codebase access beyond `CONTEXT_BUNDLE.md`. Treat the bundle as ground truth for existing file names, IPC, and types. Everything below is the **target state**. Where this prompt and the bundle disagree on visuals, this prompt wins; where they disagree on data shapes/IPC, the bundle wins.

**Design knobs:** `VARIANCE 5` (balanced — one distinctive signature per component, no avant-garde) · `MOTION 5` (250ms, cubic-bezier, zero spring physics) · `DENSITY 7` (data-rich, tight 8px rhythm, but never cluttered).

**Golden rules:**
- **Beauty is the finish, not the substitute.** Clarity and state-coverage first, polish second.
- **One focal point per view.** Demote everything that isn't the answer to the screen's primary question.
- **Every data component ships 5 states:** Loading (skeleton), Empty (icon + 1-line + CTA), Error (plain cause + retry), Populated, and Overflow (truncate/paginate). No exceptions.
- **One distinctive signature per component** — noted below as 🪶 *Signature*.

---

## 1. Design DNA (single source of truth)

### 1.1 Color

| Role | Token | Where |
|---|---|---|
| Base canvas | `zinc-950` (`--bg-primary: #09090b`) | Page background. NEVER `#000`. |
| Surface | `zinc-900/80` • `backdrop-blur-xl` (`--bg-glass`) | Glass cards. |
| Elevated surface | `zinc-900/95` (`--bg-glass-heavy`) | Modals, popovers. |
| Border subtle / active | `zinc-800/60` → `zinc-700/60` | Default → hover. |
| Text primary / secondary / muted | `zinc-100` / `zinc-400` / `zinc-600` | Use tokens, never `opacity-50` on text. |
| Accent (page) | `--page-accent: #10b981` (emerald-500) | Primary actions, active states, focus rings. |
| Semantic — income / expense / transfer | `emerald-400` (`#34d399`) / `red-400` (`#f87171`) / `amber-400` (`#fbbf24`) | Money direction. Always paired with icon + sign, never color alone. |

**3-accent ceiling per view.** Emerald is the page accent. Income/expense/transfer semantics reuse emerald/red/amber — that is the budget. Do not introduce a 4th hue (no blues, no violets) anywhere on `/finance`.

### 1.2 Elevation language (no shadows)

Never use `box-shadow` for lift. Build depth with **3 layers only**:
1. `backdrop-blur-xl` (glass cards)
2. Border brightness step (`zinc-800/60` → `zinc-700/60` → accent-tinted on interactive)
3. 1px top inner highlight via `border-t border-white/5` on hero cards

The single permitted shadow is the modal's ambient glow `shadow-[0_0_30px_rgba(0,0,0,0.35)]` — reads as atmosphere, not elevation, and is allowed only on the modal card.

### 1.3 Type scale

| Token | Size/weight | Where |
|---|---|---|
| Display | 24–32px / 700, `tabular-nums` | Net worth, big amounts |
| Page title | 18px / 600 | "Finance" in header |
| Section h2 | 15px / 600 | SectionHeader titles |
| Card title | 13px / 600 | Card headings |
| Body | 13px / 400 | Default text |
| Meta | 12px / 400, `zinc-400` | Timestamps, sub-labels |
| Badge | 11px / 500, uppercase tracking-wide | Type badges, pills |

All money figures use `tabular-nums` so columns align. Fonts: Geist/Inter (sans) + JetBrains Mono (mono). Mono only for amounts/numerics — otherwise sans with `tabular-nums`.

### 1.4 Spacing, radius, motion, z-index

- **8px grid:** `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32`. Card padding is always `p-5`. Section rhythm `space-y-4`.
- **Radius ceiling:** `rounded-xl` (12px). Pills/dots may be `rounded-full`. Never `rounded-2xl/3xl`.
- **Motion:** `fast 150ms` (hover/focus) · `normal 250ms` (modals, tab swaps, accordions) · ease `cubic-bezier(0.16,1,0.3,1)`. Animate **only** `transform` + `opacity`. Respect `@media (prefers-reduced-motion: reduce)` → disable transitions, keep instant state changes.
- **Z-index (use the scale, never arbitrary):** `--z-base: 0` · `--z-elevated: 10` · `--z-dropdown: 20` · `--z-sticky: 25` · `--z-overlay: 30` · `--z-modal: 40` · `--z-toast: 50` · `--z-max: 100`.
- **Touch targets ≥ 44×44px**, including icon buttons (pad to size; the visible glyph can be smaller).
- **Focus ring (every interactive element):** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950`.

### 1.5 Reusable primitives (define once, reuse everywhere)

| Primitive | Spec |
|---|---|
| `GlassCard` | `bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-4 transition-colors duration-150`. `interactive` adds `hover:-translate-y-0.5 cursor-pointer`. Accent adds 2px top stripe. |
| `IconBox` | `w-9 h-9 rounded-lg grid place-items-center` • `bg-[color]/15 text-[color]`. Used for category/account/type glyphs. |
| `MoneyText` | `tabular-nums font-semibold`; income `text-emerald-400` w/ `▲`, expense `text-red-400` w/ `▼`, neutral `text-zinc-100`. Sign + arrow + color (3 cues, never color alone). |
| `Pill` (filter/segment) | idle `text-zinc-400 hover:text-zinc-200`; active `bg-zinc-800 text-zinc-100`; container `bg-zinc-900/50 p-1 rounded-xl inline-flex`. |
| `TypeBadge` | `px-2 py-0.5 rounded-full text-[11px] font-medium bg-[color]/10 text-[color] border border-[color]/20`. |
| `Skeleton` | `animate-pulse bg-zinc-800/60 rounded-xl` shaped to the content it replaces (not a spinner). |

---

## 2. Overview Tab — the hero view

**Primary question:** *"What's my money situation right now, and can I log something in 2 seconds?"*

### 2.1 QuickAddBar (top, full-width GlassCard)

Current state: 2-tier composer (type toggle → amount → description → account → Add button) with scrollable category chips below. Already implemented. **Minor polish needed:**

- Amount input underline animation: `transform: scaleX` 250ms on focus (already implemented — verify it works)
- Empty accounts → Add disabled (`opacity-40 cursor-not-allowed`) with inline hint "Create an account first" (implemented)
- Submit → button shows inline spinner then 250ms success check + toast (implemented)
- 🪶 *Signature:* the animated underline on focus

### 2.2 Metric cards (4-up KPI row)

Current state: `grid grid-cols-2 lg:grid-cols-4 gap-4` with Sparkline SVG. Already implemented. **Polish:**
- Verify sparkline data alignment (monthlyTrends)
- Ensure "vs last period" text is correct (compare current vs previous period, not hardcoded)
- Net Worth card: ensure custodial exclusion note shows only when custodial accounts exist
- 🪶 *Signature:* Sparkline SVG at `opacity-10` behind the value

### 2.3 Charts (real Chart.js, not text lists)

Current state: 2-column grid with Doughnut + Bar charts. Already implemented. **Polish:**
- Doughnut `cutout: '68%'` with custom legend to the right (on `lg`), below on mobile
- Bar chart: last 6 months, income emerald vs expense red, `borderRadius: 6`, `barThickness: 20`
- Chart theme: font `zinc-400 11px`, tooltip `bg-zinc-900/95 border-zinc-700/50 rounded-lg`, no gridlines (or `zinc-800/40` only)
- Empty chart state: icon + "No spending this period" + "Add a transaction" CTA

### 2.4 Account summary + "Holding for Others"

Current state: `grid grid-cols-1 md:grid-cols-2 gap-3`. Already implemented with custodial section. **Polish:**
- Custodial accounts rendered in separate "Holding for Others" subsection (amber `border-l-2`)
- Excluded from Net Worth calculation (already done in FinancePage)

---

## 3. Accounts Tab

**Primary question:** *"What accounts/wallets do I have and what's in each?"*

Current state: Interactive GlassCard with border-l-2 accent rail, expandable wallet list. Already implemented. **Polish:**
- 🪶 *Signature:* thin **left accent rail** (`border-l-2`) in the account type's color (emerald/amber/purple/blue)
- Wallet icons: `Landmark` (bank), `CreditCard` (credit/debit), `Banknote` (cash/crypto) — verify type→icon mapping
- Expanded wallet list: hover reveals edit/archive buttons (opacity-0 → opacity-100)
- CreateAccountModal: custodial type shows amber hint about net worth exclusion

---

## 4. Transactions Tab

**Primary question:** *"Find and scan my money movements — beautifully, not as a spreadsheet."*

Current state: Styled ledger with type-colored border-l, date groups, hover delete. Already implemented. **Polish:**
- 🪶 *Signature:* left **semantic hairline** (`border-l-2` emerald/red/amber by type) that brightens on hover
- Date grouping: "Today", "Yesterday", or full date — with per-group net total
- Delete button: `opacity-0 group-hover:opacity-100`, confirm before delete (currently immediate — add inline confirm "Delete? Cancel" per spec)
- Filter bar: sticky under header at `top-14`, `z-elevated`

---

## 5. Categories Tab

**Primary question:** *"Organize the buckets money flows through."*

Current state: Grouped by type (Income/Expense/Transfer) with colored section headers, compact cards with color dots. Already implemented. **Polish:**
- 🪶 *Signature:* the section's accent tints its cards' borders faintly (`border-[color]/20`)
- Color picker modal: 8 swatch grid, hover scale, active ring
- CreateCategoryModal: icon picker (32 Lucide icons, searchable grid), live preview chip

---

## 6. Shared chrome — Page shell, Modal, Lock screen, FAB

### 6.1 FinancePage shell

Current state: Custom header (not FinanceStickyHeader) with wallet icon, title, net worth, currency dropdown, lock button, security settings. Already implemented. **Verify:**
- Tab content crossfade: 150ms `opacity` + `translateY(4px→0)` (AnimatePresence mode="wait")
- Currency dropdown: 10 common currencies (USD/IDR/SGD/GBP/EUR/JPY/AUD/CNY/KRW/INR)

### 6.2 Modal pattern (QuickAddModal, Create*Modal)

Every modal follows the same pattern (already implemented):
- Overlay: `fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)]`
- Card: `bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 max-w-md`
- Entrance: `opacity 0→1` + `scale 0.92→1` 250ms `cubic-bezier(0.16,1,0.3,1)`
- Header: close (X) button, title
- Footer: Cancel (ghost) + primary action (emerald)

### 6.3 FinanceLockScreen

Current state: Full-bleed lock with centered card, password input, show/hide toggle, cooldown timer, Windows Hello button. Already implemented. **Polish:**
- 🪶 *Signature:* on unlock attempt, blur feedback (`backdrop-blur` → 4px) then de-blur on success
- Error: "Incorrect password — N attempts left"; after 3 fails: 30s cooldown with animated progress bar
- Windows Hello button: `Fingerprint` icon (placeholder — functional integration deferred)

### 6.4 FAB

Current state: Fixed bottom-right, emerald circle 48px, `Plus` icon, scale hover/tap. Already implemented.

---

## 7. State coverage matrix (the #1 anti-slop gate)

| Component | Loading | Empty | Error | Overflow / special |
|---|---|---|---|---|
| Metric cards | 4 skeleton cards | `0` / `—` muted | inline "—" + retry on card | large numbers formatted (tabular-nums, k/M) |
| Charts | skeleton at chart height | icon + "No data" + CTA | "Couldn't load chart · Retry" | many categories → top N + "Other" |
| Account list | 3 skeleton cards | "Create your first account" | retry | long names truncate; custodial fenced |
| Transaction list | 5–6 skeleton rows | no-txn vs no-match variants | retry | debounced search |
| Category grid | skeleton grid | per-group "Add" | retry | — |
| Lock | — | — | wrong-pw + cooldown | Hello unavailable → password fallback |

---

## 8. Motion spec

| Interaction | Duration | Properties |
|---|---|---|
| Hover / focus / pill active | 150ms | `border-color`, `background-color`, `opacity`, `transform: scale` |
| Tab/content swap | 150ms | `opacity` • `translateY(4px→0)` |
| Modal in/out | 250ms | `opacity` • `scale(0.92→1)` |
| Account accordion | 200ms | `opacity` • `height` (auto, via measured container — never animate raw height) |
| Unlock de-blur | 250ms | `filter: blur`, `opacity`, `transform: scale` |
| Doughnut hover | native | Chart.js `offset` (GPU) |

Easing everywhere: `cubic-bezier(0.16,1,0.3,1)`. No `transition: all`. No spring physics. Honor reduced-motion.

---

## 9. Hard constraints (carry verbatim into the build)

1. No `box-shadow` for elevation — glass + border brightness only (modal ambient glow is the sole exception).
2. No pure black `#000` — `zinc-950` base; `bg-black/70` allowed only as the modal overlay.
3. Max radius `rounded-xl` (12px); pills/dots `rounded-full`. No `rounded-2xl/3xl`.
4. Animate `transform`/`opacity` only — never width/height/top/left/margin.
5. No default focus rings — emerald ring token on every interactive element.
6. ≤ 2 font families; ≤ 3 accents per view (emerald + red + amber is the whole budget).
7. Touch targets ≥ 44px. Keyboard nav + visible focus everywhere.
8. No `opacity-50` on text — use `zinc-400/600` tokens.
9. Z-index from the scale only — never `999`/`1000`.
10. No spring physics; `cubic-bezier` only.
11. Color never the sole signal — pair with icon/sign/text.
12. Preserve all existing behavior: lock + auto-lock timer, currency conversion/display dropdown, custodial net-worth exclusion, FAB QuickAdd, keyboard shortcuts. **Visual-only refinement.**
13. Stay within `/finance` files (§ Files). Don't touch other routes.
14. **No AI integration** — finance data must never be wired into any AI chat/context.

---

## 10. Files to modify

```
src/pages/FinancePage.tsx                     — Header polish, net-worth display, tab crossfade, FAB
src/components/finance/OverviewTab.tsx        — QuickAddBar, KPI cards w/ sparkline, doughnut + bar charts, account summary + custodial section
src/components/finance/AccountsTab.tsx        — Interactive cards w/ accent rail, accordion wallet list, CreateAccountModal
src/components/finance/TransactionsTab.tsx    — Styled ledger rows w/ semantic hairline, sticky filter bar, date groups, hover delete+confirm
src/components/finance/CategoriesTab.tsx      — Type-zoned color groups, compact cards, icon+color picker modal
src/components/finance/FinanceLockScreen.tsx  — Vault de-blur unlock, Hello button, cooldown error state
src/components/finance/QuickAddModal.tsx      — Modal form for quick transaction creation
src/components/finance/FinanceStickyHeader.tsx — Simplified header (locked state only)
```

---

## 11. Implementation order

1. **State coverage sweep** — verify the §7 matrix on every component. Add missing skeletons, empty states, error handlers.
2. **Transaction delete confirm** — add inline "Delete? Cancel" confirmation (currently deletes immediately).
3. **Polish existing visuals** — verify sparkline data alignment, chart empty states, custodial section, focus rings.
4. **Motion audit** — ensure all animations are `transform`/`opacity` only, no springs, correct durations.
5. **a11y + contrast sweep** — verify §9 constraints on every interactive element.

---

## 12. Pre-return review checklist

- [ ] Scope respected: only `/finance` files touched.
- [ ] Primary action obvious in < 1s on each tab.
- [ ] No raw tokens/enums/stack traces shown to the user; copy is plain language.
- [ ] Loading + Empty + Error states exist for every data component (§7).
- [ ] One clear focal point per view; metadata muted.
- [ ] Hover / focus / active / disabled on every interactive element.
- [ ] All motion 150–300ms, transform/opacity only, reduced-motion handled.
- [ ] Destructive actions (delete txn) confirm; submits give spinner→success feedback; inputs never wiped on error.
- [ ] Meaning never by color alone (sign + arrow + icon).
- [ ] Focus rings emerald; full keyboard nav; targets ≥ 44px.
- [ ] No `#000`, no `box-shadow` lift, no `rounded-2xl+`, no layout animation, ≤ 3 accents.
- [ ] Contrast ≥ 4.5:1 body / 3:1 large; charts have non-color labels.
- [ ] Existing behavior (lock, currency, custodial, shortcuts) intact.
