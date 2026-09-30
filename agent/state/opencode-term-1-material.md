<!-- SESSION: opencode-term-1-material -->
<!-- AGENT: opencode | TERMINAL: term-1 | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-term-1-material

> **STATUS:** working | **UPDATED:** 2026-09-25T19:30:00Z

---

## CURRENT CYCLE (5)
**ROLE:** Hands & Eyes — Terminal audit bug fixes (13 bugs per workspace terminal audit spec)
**STATUS:** working
**IN FLIGHT:**
- Phase 1 (HIGH impact): Bug 1 (raw ANSI INSERT → flushTranscriptToDb), Bug 3 ([TERMINAL_DEBUG] removal), Bug 9 (backup scheduler autoBackup per-tick)
- Phase 2 (launch pipeline): Bug 4 (spoke paths → absolute), Bug 5 (hermes AGENT_CONFIGS), Bug 6 (settleMs → phase polling)
- Phase 3 (sessions): Bug 11 (eager binding), Bug 8 (layout isActive), Bug 7 (saveError surface)
- Phase 4 (orchestration): Bug 2 (conductor ACK + broadcast all windows)
- Phase 5 (hardening): Bug 10 (SHA256), Bug 12 (preload onData), Bug 13 (intentionalKills leak)
- All 13 bugs fixed, build passing (npx vite build ✓, main.cjs ✓, preload.cjs ✓)

**COMPLETED:**
- Bug 1: Replaced raw ANSI per-chunk INSERT with flushTranscriptToDb/flushTranscriptToDb2 + one-time purge migration (ansi_msg_purge_v1)
- Bug 2: Fixed conductor spawnAgentTerminal - PTY created in MAIN, broadcast to ALL windows
- Bug 3: Removed [TERMINAL_DEBUG] per-chunk console.log that was freezing main process
- Bug 4: Fixed spoke paths from relative to absolute via getAgentStateDir() with userData fallback
- Bug 5: Added hermes to AGENT_CONFIGS with cross-platform HermesPlugin paths + resume flag map
- Bug 7: useTerminalLayout now surfaces saveError state + retrySave callback
- Bug 8: Layout save preserves is_active; load prefers project-scoped over global
- Bug 9: Backup scheduler respects autoBackup on every tick, not just startup
- Bug 10: Backup restore verifies SHA256 manifest; prunes old .replaced-*.db files
- Bug 12: preload onData returns unsubscribe function; removeDataListener is no-op
- Bug 13: intentionalKills.delete(id) added to exit handler to prevent memory leak
- All 13 bugs fixed and build verified

**NEXT ACTION:** Runtime verification with Probe MCP; update agent/FEATURE_TRACKER.md, agent/state.md, agent/data.md
**NOTES:** Build: npx vite build ✓ (1m10s), npx esbuild preload ✓, node scripts/rebuild-main.mjs ✓. dist-electron/main.cjs 1.5MB, preload.cjs 130KB.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 4 — 2026-09-25T12:00:00Z
**ROLE:** Hands & Eyes — Dashboard Layout Editor fix + widget navigation
**STATUS:** completed
**IN FLIGHT:**
- Fixed WidgetLibraryPopup: replaced broken Popover (@radix-ui) with Sheet (@base-ui/drawer)
- Fixed crash: removed PrototypePreview import + /design-review route from App.tsx
- Fixed TrackingScorePanelA_SIGNAL.tsx duplicate style attribute
- Added 8 extra widgets to widgetRegistry.tsx
- Gated all 8 extra widgets in DashboardPage.tsx with isVisible()
**COMPLETED:**
- npx vite build passes ✓ (1m 1s)
- WidgetLibraryPopup renders via Sheet with live preview + drag-to-reorder
- All 20 widgets now in registry with isVisible() gating
**NEXT ACTION:** Runtime verification with Probe MCP

### Cycle 3 — 2026-09-24T17:00:00Z
**ROLE:** Hands & Eyes — Dashboard Layout Editor implementation
**STATUS:** completed
**IN FLIGHT:**
- Implemented widgetRegistry.tsx (12 widgets, ROW_TEMPLATES with 8fr/4fr proportions)
- Implemented useDashboardLayout.ts (localStorage persistence, sanitized, self-healing)
- Implemented WidgetLibraryPopup.tsx (live proportional preview, grouped toggles, reset)
**COMPLETED:**
- DashboardPage.tsx fully integrated: 17 isVisible() calls, 0 isCardVisible remaining
- Grid fixed from 9fr_3fr to 8fr_4fr
- transition-all → transition-colors across all dashboard components
**NEXT ACTION:** Build verification + runtime verification with Probe MCP

<!-- SESSION: opencode-term-1-material -->
