# RESULT.md — Dashboard Widget Expansion (8 New Widgets, Underserved Features)

> **Ruling basis:** R-24 (reconciliation) · R-25 (slop bans) · R-26 (persistence + defaults) · R-27 (queue position) · LAMINAR (design/design.md is law) · §15 naming · W-1–W-10 (Command Deck) · empty≠zero
> **Supersedes:** the 2026-09-22 Dashboard Widget Expansion PROMPT.md as written
> **Queue position:** Renderer-only (R-27) — **parallel-to-P0 eligible.** All 8 IPC channels are claimed to exist; Phase 1 verifies that claim with round-trip evidence. No hot-file claims (WidgetRegistry/WidgetSummaries/DashboardPage are not §7 hot files). VCalendar stays FROZEN (VCAL-REPLACE) — untouched here.

---

## 8.1 Executive Summary

Eight new dashboard widgets surface data from pages that already compute it but never show it at a glance: AI usage, terminal console, finance, learn, browser activity, Context Brain, covenant, and health/sleep. They register into the existing 12-col mosaic grid, land in currently-empty grid rows (zero displacement of existing widgets), and follow the LAMINAR primitive layer — solid token surfaces with hairlines, radius 10, `motion/react` single engine, 140ms reactive, transform/opacity only. The package's glass chrome, per-widget hex accents, hover-scale, and localStorage persistence are all overridden by standing rulings; what survives is the data-contract work and the grid integration.

---

## 8.2 Preconditions (STEP-0, blocking)

1. **Token dump:** `src/index.css` + CategoryColors.ts. Determines accent tokens, font families/roles, hairline tokens. The package's pink-500/zinc/Geist/Space-Grotesk claims are quarantined — pink and amber are the two known fabricated bundle tokens; **code wins.** STOP-and-report if the dump contradicts assumptions.
2. **Registry dump:** `WidgetRegistry.ts` gridPositions + `DashboardContext.tsx` fields, **before** assigning new grid slots. The package's suggested rows 18–22 are hints, not facts — anchors by content (grep), never line numbers.
3. **IPC round-trip evidence** for all 8 channels (§8.4). Any channel that 404s/fails shape-check is reported verbatim and its widget is staged with a graceful error state — never fabricated data.

---

## 8.3 Widget Set + Data Contracts

All data via `useDashboardDataContext()`; gaps fetched through the existing bridge (renamed `rheoAPI` only when the sanctioned rename lands — until then `window.deskflowAPI` as-is). Empty ≠ zero everywhere: "no sessions" renders the explicit string, never `0` where the count is unknown; a true zero renders `0`.

| ID | Source (existing page) | IPC channel | Renders | defaultSize (cols×rows) |
|---|---|---|---|---|
| `ai-usage` | AiPage | `get-ai-stats` + `get-model-usage` | Top model, tokens today, session count, 5-bar model breakdown | 4×2 |
| `console-widget` | /penguin-console | `get-terminal-stats`, `get-handbook-progress` | Command count, active sessions, handbook completion (ProgressBar) | 4×2 |
| `finance-widget` | FinancePage | `get-finance-summary`, `get-wallets` | Total balance (tabular-nums), txn count, 7-day net row | 4×2 |
| `learn-widget` | Lyceum | `get-learn-stats`, `get-mastery-levels` | Due-count, mastery %, streak, next lesson | 3×2 |
| `browser-widget` | BrowserActivityPage | `get-browser-stats`, `get-website-stats` | Top site list (3), category split bars, tracking-state dot (honest: uses real tracking-status, never synthesized) | 3×2 |
| `brain-widget` | Context Brain | `get-brain-stats`, `get-graph-stats` | Node count, connection density, retrievals today, recent-query line | 3×2 |
| `covenant-widget` | CovenantPage | `get-covenant-stats`, `get-commitments` | Active count, completion %, next due | 3×2 |
| `health-widget` | External/sleep | `get-sleep-summary`, `get-health-stats` | Last-night hours, consistency %, gap count | 6×2 (horizontal split: stats left, 7-night mini-bars right) |

**4-state matrix per widget (mandatory):**
- **Loading:** skeleton matching content shape (shimmer-free; static placeholder blocks).
- **Empty:** explicit sentence ("No AI sessions yet"), styled as data state, not an error.
- **Error:** message + retry `Button`; the widget never silently renders empty on failure.
- **Populated:** full spec per table. Values `font-display` 22px bold, tabular-nums; labels 11px muted; titles 13px semibold — with font families taken from the §8.2 dump, not the package's font list.

---

## 8.4 IPC Verification Table (Phase 1 gate — evidence, not assumptions)

| Channel | Shape assertion (verbatim fields) | Status |
|---|---|---|
| `get-ai-stats` | `{ tokensToday, sessionCount, models: [{name, tokens}] }` or actual dump | FILL FROM DUMP |
| `get-model-usage` | model breakdown array | FILL FROM DUMP |
| `get-terminal-stats` | `{ commandCount, activeSessions }` | FILL FROM DUMP |
| `get-handbook-progress` | `{ completed, total, percent }` | FILL FROM DUMP |
| `get-finance-summary` | `{ totalBalance, transactionCount, net7d }` | FILL FROM DUMP |
| `get-wallets` | wallet array | FILL FROM DUMP |
| `get-learn-stats` | `{ dueCount, masteryPercent, streak, nextLesson }` | FILL FROM DUMP |
| `get-mastery-levels` | level array | FILL FROM DUMP |
| `get-browser-stats` | `{ categories, topSites, tracking }` | FILL FROM DUMP |
| `get-website-stats` | per-site rows | FILL FROM DUMP |
| `get-brain-stats` | `{ nodes, density, retrievalsToday }` | FILL FROM DUMP |
| `get-graph-stats` | graph counts | FILL FROM DUMP |
| `get-covenant-stats` | `{ active, completionPercent, nextDue }` | FILL FROM DUMP |
| `get-commitments` | commitment rows | FILL FROM DUMP |
| `get-sleep-summary` | `{ lastNightHours, consistencyPercent, gapCount }` | FILL FROM DUMP |
| `get-health-stats` | health rows | FILL FROM DUMP |

Any gap → widget ships with error-state wiring + a report row; no invented handlers, no main.ts edits (that would claim the P0 file).

---

## 8.5 Visual Specification (LAMINAR — overrides the package's chrome)

- **Surface:** solid token background (`--bg-elevated` per dump). NO `backdrop-blur`, NO glass layers, NO `box-shadow`. Hairline 1px token border; hover brightens the hairline token only.
- **Radius:** **10** on widget cards (package's `rounded-xl`/12 and any `rounded-2xl/3xl` rejected — radii ∈ {6,10,16}).
- **Accents:** NO hex literals. Per-widget accents selected from **CategoryColors (Tableau-10)** at build time; the package's hex table (violet/green/emerald/indigo/sky/cyan/amber/rose) is a mood reference only — final hues recorded in the report. ENTITY_COLORS takes precedence where semantics overlap.
- **Charts in-widget:** category split bars = 1px-gap solid token bars (chart.js only if an existing dashboard widget already uses it in-card; otherwise pure divs). No new chart deps (dependency freeze).
- **Motion:** `motion/react` only. Entrance ≤400ms one-shot, opacity/transform only. Reactive 140ms. **NO `whileHover` scale (banned — IDE-EVAL A1):** hover = hairline brightening + cursor pointer. One easing from design.md (the package's cubic-bezier claim is pre-empted).
- **Counters:** static tabular-nums values; NO NumberTicker-style animated counters (loop-adjacent motion; zero decorative animation budget on the dashboard).
- **RM:** `prefers-reduced-motion` → entrances render in final state instantly; hover states persist (composition ≠ motion).

---

## 8.6 Interaction + Layout

- **Click widget** → navigate to source page via `useNavigate()`; `data-section` attribute per widget for tracking.
- **Split/orientation:** internal L/R splits allowed (stat left, bars right). Vertical stacking inside small sizes collapses to stats-only with chart hidden (progressive disclosure, not scroll).
- **Resize:** `minSize`/`maxSize` per §8.3 table; drag handles per existing LayoutEditor — no new resize machinery (§3-2: repairs may not invent components; this is not a repair, but reuse still wins).
- **Persistence (R-26):** layout writes to the **preference store key `dashboard_layout`** with `schemaVersion` — NEVER localStorage (W-4 ruling; the package's localStorage claim is void). Registry must tolerate the legacy localStorage key on read-migrate once, then ignore it.
- **Defaults (W-10):** existing 16 widgets' positions are byte-identical after this lands. New widgets are `defaultVisible: true`, slotted into the first verified-empty rows **after** the current max row, in §8.3 order. Zero displacement of anything already on the board.
- **Keyboard:** visibility toggles and layout-editor ops get keyboard equivalents (W ruling: mandatory for every drag/resize/visibility op).

---

## 8.7 Registration + Phases

Registration pattern per existing `WidgetRegistry.ts` (content-anchored, dump-first). Console stamp per component per repo convention.

| Phase | Scope | Commit |
|---|---|---|
| **1 — Data contracts** | §8.2 dumps → §8.4 round-trip evidence → `DashboardContext` fields added (no main.ts) | `feat: dashboard widget data contracts (WS-expansion P1)` |
| **2 — Widgets + registration** | 8 summary components → registry entries → layout slots → persistence to preference store → legacy localStorage read-migrate | `feat: 8 dashboard widgets from underserved features (WS-expansion P2)` |

---

## 8.8 Verification Checklist

- **Build:** `node scripts/build.mjs` exits 0. **Typecheck:** zero errors outside docs/debt.md; total + delta reported.
- **Served artifact:** launcher serves `dist/` (never dist-tmp/); stale dist deleted first.
- **Shell-launch:** Playwright `_electron.launch` + bounding-box + screenshots — dashboard with all 8 new widgets populated, one empty-state widget, one error-state widget (forced). Renderer-attach is NOT a gate.
- **Grep gates (verbatim in report):** `backdrop-blur` = 0 · hex literals in new files = 0 · `framer-motion` imports = 0 · `whileHover` = 0 · `rounded-2xl|rounded-3xl` = 0 · `BorderBeam|MagicCard|magic-card|particle-button|NumberTicker` = 0 · `localStorage` writes in dashboard layout code = 0 · "DeskFlow" in new code = 0.
- **Persistence gate:** layout change survives relaunch; preference-store readback shows `schemaVersion`; legacy localStorage key migrated then dormant.
- **Zero-displacement gate:** diff of pre/post gridPositions for the original 16 widget IDs = empty.
- **Empty≠zero gate:** screenshots of empty vs true-zero states side by side (e.g., finance with no txns vs finance with 0-balance wallet).
- **EOL:** match existing endings; zero EOL-only diff lines. Anchors by content, never line numbers.

---

## 8.9 Risks & Invariants

| Risk | Mitigation |
|---|---|
| IPC channel claims in the bundle are stale (main.ts is 22k+ lines) | §8.4 round-trip gate; gaps → error-state wiring, not invention |
| localStorage legacy key conflicts with preference store | One-way read-migrate in P2; writes go to preference store only |
| Grid rows 18–22 actually occupied | §8.2 dump-first; slots assigned to verified-empty rows |
| Widget bloat on small screens | minSize floors; collapsed stats-only mode below 2-col width |
| Accent drift from Tableau-10 | Hues recorded in report; M-1 token audit grep catches literals later |

---

## 8.10 Deferred / Rejected

| Item | Verdict |
|---|---|
| `magic-card`, `particle-button`, `BorderBeam`, `NumberTicker` | **REJECTED (R-25)** — MCP slop bans / loop-adjacent motion. |
| Glass chrome (`backdrop-blur-xl`) | **REJECTED** — LAMINAR solid-surface law. |
| `whileHover={{scale:1.02}}` | **REJECTED** — hover-scale banned; hairline brightening only. |
| localStorage `dashboard_layout` | **VOID** — preference store per W-4 (R-26). |
| Animated counters, spring easing, decorative gradients | **REJECTED** — §2 motion law. |
| New IPC handlers / main.ts edits | **OUT OF SCOPE** — would claim the P0 file; gaps reported for a follow-up behind P0. |
| VCalendar replacement | Unchanged — frozen until VCAL-REPLACE closes; not touched by this spec. |

---

## 8.11 Anti-Regression Checklist

- [ ] All 16 pre-existing widgets render in identical positions/sizes
- [ ] CardLibrary lists 24 widgets with correct visibility defaults
- [ ] LayoutEditor drag/resize still works for old + new widgets
- [ ] Existing dashboard data (goals, deadlines, schedule, focus) unaffected
- [ ] Relaunch persistence intact for pre-existing layouts (legacy users)
- [ ] tsc total + delta reported; no new errors
- [ ] RM pass: entrances instant, static composition correct

---

*Amendments vs. the 2026-09-22 package: DeskFlow→RHEO (§15) · glass→solid LAMINAR, radii {6,10,16} · hex accents→CategoryColors Tableau-10 + ENTITY_COLORS · hover-scale→hairline brighten · localStorage→preference store `dashboard_layout` + schemaVersion (W-4) · DEFAULTS=TODAY zero-displacement (W-10) · KokonutUI/Magic-UI components rejected (R-25) · NumberTicker/counters rejected · font/easing claims quarantined behind index.css dump · queue: renderer-only, parallel-to-P0 (R-27) · VCalendar untouched (frozen).*
