# Reply 1 — Specialist requests answered (context + clarifications)

> From: Project Owner (opencode) | To: Specialist (Architect) | Case: external-grid-sizing-complaint-04082026
> Date: 2026-08-04

Your diagnosis is accepted as-is: **pure weight-model redesign, frontend-only, keep the treemap**. All three defects you named (fixed weights, index-driven sizeTier, no min-size guard) are in the weight/layout/render layer. Your gamma-preset direction (`s_i = w_i^γ`, w = log1p(seconds), f = normalized) is sound; the worked examples (A: 33.7/33.3/32.9; B: 29.9/25.3/23.4/21.4) match what the user is asking for — sizes must track durations, and near-equal durations must render near-equal.

## CONTEXT: The three source files

**Already delivered verbatim in `CONTEXT_BUNDLE.md` of this package** (fetched from the live repo today, nothing changed since):
- `src/lib/external/grid.ts` — full 389 lines: `visualWeight` (log1p), `buildTargetWeights` (the fixed-ladder defect), `squarifyTreemap` (exact-thickness, verified), `computeActivityGridLayout` signature `{ activities, stats, aspect?, width? }`, `sizeTier` mapping at index-based branch, `compactActivities` filter (sleep || seconds === 0).
- `src/components/external/ActivityMosaic.tsx` — full 149 lines: ResizeObserver aspect switching (`>=1200`→16/9, `>=768`→4/3, else 3/4), layout memo calls `computeActivityGridLayout({ activities, stats, aspect, width: 1200 })` — **width is hardcoded 1200**, container is measured only for aspect. Compact-row render block below the main grid.
- `src/components/external/ActivityMosaicCard.tsx` — full 185 lines: `sizeTier`-driven content (padding p-3…p-5, icon h-9…h-14, name text-sm…text-xl, time-chip + sparkline only hero/secondary, `overflow-hidden` on the button = the clip you need to spec against).

## CONTEXT: Previous RESULT.md (full, for your delta)

- File added to this package: `PREVIOUS_RESULT.md` (verbatim copy of `agent/docs/generate-prompt-docs/external-page-grid-redesign-03082026/RESULT.md`, 82,965 bytes).
- Key parts for your diff: §3 goal block (lines 99-119) — note it says "dominant ~50-60%, second ~25-30%" — and §6 design hierarchy (hero/secondary/small content rules). The current shipped code implements these goals via the fixed weights. Your v2 must supersede both §3 weights and §6 tiers coherently (I'll implement your spec exactly).

## ANSWER: Preference persistence — canonical mechanism

Two layers exist; **recommendation: page-local UI setting → localStorage** (matches codebase precedent for display-only toggles).

1. **Backend preferences (canonical global store):** `window.deskflowAPI.getPreferences()` → IPC `get-preferences` (main.ts:5312) returns the whole `userPreferences` object (loaded from JSON file at `prefsPath`, main.ts:5286-5296). `window.deskflowAPI.setPreference(key, value)` → IPC `set-preference` (preload.ts:94) → main sets `userPreferences[key] = value` + `savePreferences()` (fs write, main.ts:5300-5307). Survives reload; survives app restarts; global to the app.
2. **localStorage (page-level UI state — established pattern):** every page in this app persists display-only settings this way, e.g. `ide-projects-log-scale`, `ide-projects-exclude-outliers` (IDEProjectsPage.tsx:384-385, 606-609), `settings-activeTab`, `stats-time-lock`. Hard invariant: ALL localStorage access wrapped in try/catch (AGENTS.md).

**My recommendation:** hierarchy selection is a display-only preference of exactly the `ide-projects-log-scale` kind → persist as localStorage key **`external-mosaic-hierarchy`** (values `subtle | balanced | dramatic`, default `balanced`), try/catch wrapped, read in the `useState` initializer, written on change. Keeps the fix 100% frontend-only with zero main-process changes. If you want global/cross-window persistence instead, spec `setPreference('externalMosaicHierarchy', …)` and I'll wire it — your call, but localStorage is my recommendation to protect the frontend-only scope.

## ANSWER: Compact row — EXISTS, but not for overflow yet

Yes, a compact row already renders below the mosaic: `ActivityMosaic.tsx` lines 121-146 — `layout.compactActivities` in an `auto-fit minmax(150px,1fr)` grid, cards are plain `div`s (icon dot + name + "Sleep"/"No time yet", min-h 88px). **However:** `computeActivityGridLayout` (grid.ts:293-298) currently puts ONLY sleep + 0-second activities into `compactActivities`. There is **no K-cap / overflow mechanism** — nothing moves small cells into the compact row today. RESULT.md v2's `K = min(n, maxReadableCells(...))` overflow step is net-new: it needs to push the dropped activities into `compactActivities` so the existing renderer shows them (the compact card has no selection wiring — `onSelectActivity` is not connected on those divs; if you want them selectable, spec the change, else note it as out-of-scope).

## CONTEXT: Calibration numbers for f_min / maxReadableCells

- Layout is computed at a **fixed width of 1200** (ActivityMosaic hardcodes it) with aspect from container: `>=1200px` → 16/9 → **height = 675px** (1200 / (16/9), floor 320); `>=768` → 4/3 → height 900; else 3/4 → height 1600. On the user's 1920px screen with app sidebar, the mosaic container is ~1200-1400px → 16/9 @ 675px height is the case to calibrate against.
- Grid `gap-2` (8px) between cells.
- User's actual usage pattern (from their complaint): 8-12 activities on the busiest days, one strong dominant (the "SO BIGGGG" one) — typical ratio roughly 5h / 2-3h / 1-2h / sub-hour tail, so the B example (10/2/1/0.5) is representative of the spread to protect.

## Optional screenshot

Nice-to-have; if you want real pixel confirmation I'll have CZ capture `/external` for a 6+ activity day before you finalize. Given the deterministic inputs (1200×675, gap 8px, known card content densities), deriving f_min from the spec numbers is acceptable — you decide; I'll request the screenshot only if your final f_min depends on it.

## Ready for RESULT.md v2

All requests answered. Produce RESULT.md v2 (delta-only): new `buildTargetWeights` signature incl. `hierarchy` + gamma presets, `computeActivityGridLayout` options (hierarchy, min-size floor, K-cap/overflow → compactActivities), `sizeTier` areaFraction-based remap, min-size/content rules per tier, hierarchy control mount point + localStorage key, and the card tweaks (e.g. clip/overflow rules, sparkline gating) with exact class changes.
