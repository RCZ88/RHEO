<!-- SESSION: opencode-widgetlib-fix-20261025 -->
<!-- AGENT: opencode | TERMINAL: term-1 | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-widgetlib-fix-20261025

> **STATUS:** completed | **UPDATED:** 2026-10-25T00:00:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Hands & Eyes — Widget Library popup triage & fix (fit / scroll / close-on-interact / preview fidelity)
**STATUS:** completed
**IN FLIGHT:** nothing — awaiting CZ runtime verify
**COMPLETED:**
- **Bugs found & fixed (3):**
  1. Popup closed on ANY interaction — `DashboardPage` passed `onChanged` that called `setShowCardLibrary(false)`, so add/remove/resize/preset-apply via the library closed the modal instantly. `onChanged` now only logs; only Save / Close / X end the session.
  2. Popup couldn't scroll / content didn't fit — modal card was `overflow-auto p-4` while the library root added its own `max-h-[92vh]` + `flex flex-col`, and the content region had `min-h-[360px]` (flex min-height blocks shrinking) → broken height chain, clipped list. Now: card `overflow-hidden flex flex-col p-4`, library root `h-full max-h-[92vh] ... flex flex-col min-h-0`, content `flex-1 min-h-0`, list/preview panels `h-full min-h-0 overflow-hidden`, list grid `flex-1 min-h-0 overflow-y-auto`.
  3. Preview didn't resemble the actual dashboard — preview used stale v4 `layout.gridPositions` + `layout.columns` mosaic in a fake 300x260 natural size with `ROW_UNIT=68`. Now placement is derived from `ROW_TEMPLATES` / `OPT_IN_WIDGETS` (the 1:1 mirror in widgetRegistry.tsx), cells sized from template `w` (fr share) and `h` (height unit → PREVIEW_ROW_H=92px), real widgets scaled into those cells.
- **Scoped checks:** `tsc --noEmit` (tsconfig.app) → NO NEW errors in touched files (only pre-existing ones: unused vars, drag-event types, `onClose?.()`). `esbuild` transform-only on both files → EXIT 0. No build run (AGENTS §0-0 — CZ only).

**NEXT ACTION:** CZ closes RHEO, builds, reopens; then open Widget Library and verify: (a) popup stays open when clicking Add/Preview/Remove, (b) long lists scroll, (c) preview rows match live dashboard proportions.

**NOTES:**
- Repo has ~7.5k pre-existing tsc errors; scoped greps only. Never treat totals as regression signals.
- `src/components/dashboard/CardLibrary.tsx` imports `./WidgetRegistry` while the real file is `widgetRegistry.tsx` (case mismatch) — pre-existing, esbuild bundle fails on it (transform-only passes). Not touched (out of scope).
- `git status` shows many OTHER agents' uncommitted work — not mine; only CardLibrary.tsx + DashboardPage.tsx were edited by me this cycle.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-10-25
**ROLE:** (none — first cycle)
**STATUS:** completed
**IN FLIGHT:** n/a
**COMPLETED:** n/a
**NEXT ACTION:** n/a
