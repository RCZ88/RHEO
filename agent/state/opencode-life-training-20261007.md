<!-- SESSION: opencode-life-training-20261007 -->
<!-- AGENT: opencode | TERMINAL: life-training | PROJECT: App Tracker -->

# Agent State — opencode-life-training-20261007

> **STATUS:** working | **UPDATED:** 2026-10-07T22:40:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Rebuild Training to the full PAINT/Router standard; fix the defects a self-audit found.
**STATUS:** working
**IN FLIGHT:**
- Renderer changes after 22:11 are NOT built. Needs a CZ build to verify `life.training.rules` + the parser fix live.
- Deep-link `#/life?tab=training` does NOT auto-switch River->Pages mode. The tab is unreachable by URL.
  UNFIXED — real bug, found at runtime. `usePageSurface`'s onTabRequest appears not to read the hash query.
**COMPLETED:**
- Router v1.6.0 loaded: **DESIGN dispatches through `paint` ONLY.** AGENTS.md 5b's "load all 8" is STALE.
  Real names: impeccable, motion-alive, design-taste (I had guessed 3 wrong paths).
- DEAD PREFS FIXED: `training_minimum_day_minutes` + `training_weekly_win_days` were read by the weekly-score
  handler and written by NOTHING. Added `training:get-prefs`/`training:set-prefs` + a TrainingRules card.
- SHORTCUT COLLISION FIXED: Ctrl+Shift+Space was already `terminalBalance`. Moved to **Ctrl+Shift+G**
  (verified free vs every Ctrl+Shift+letter in src/), now read FROM prefs and RE-REGISTERED on change.
- TOKEN-LAW FIX: removed inline `--page-accent` (index.css defines a darker value for light mode).
  TrainingPage now has ZERO raw hex/rgba; amber -> var(--error); uses ui/card + ui/skeleton.
- **RUNTIME BUG FOUND BY PROBE:** parser returned wall-clock as duration -> 1340 min = 22h session.
  Root cause was the PREMISE (a clock reading cannot yield elapsed time), not the arithmetic.
  **218 tests now pass with the CORRECT contract** after finding 3 tests that had ENCODED the bug.
**NEXT ACTION:** CZ builds. Then verify: TrainingRules panel, parser returns null minutes, Ctrl+Shift+G focuses.

---

## HISTORY
(first cycle for this session)
