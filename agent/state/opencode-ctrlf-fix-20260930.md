<!-- AGENT STATE -->
<!-- SESSION: opencode-ctrlf-fix-20260930 -->
<!-- AGENT: opencode | TERMINAL: (external CLI) | PROJECT: App Tracker -->

# Agent State — opencode-ctrlf-fix-20260930

> **STATUS:** completed | **UPDATED:** 2026-10-01T15:20:00.000Z

---

## CURRENT CYCLE (3)
**ROLE:** Hands & Eyes — C1 Ctrl+F. C2 user-placed bar + restored scope feature. C3 implemented the gap: automatic app-wide indexing; RETRACTED a wrong C1 root-cause claim
**STATUS:** completed
**IN FLIGHT:**
- nothing — closed out this cycle
- C2 additions below
**COMPLETED:**
- ROOT CAUSE: `src/components/NativeFindOverlay.tsx` was a full-screen scrim
  (`rgba(0,0,0,0.55)` + `backdropFilter: blur(6px)`) that LISTED matches and
  logged on Enter. It never highlighted, never scrolled. Worse, `App.tsx`'s
  Ctrl+F handler and 3 dead `useAppSmartSearch`/`useSmartSearch` handlers all
  "let the browser handle it" — **Electron has no browser find bar**, so the
  key was a literal no-op. The overlay's own Ctrl+F handler called `onClose()`,
  so pressing it twice toggled a curtain.
- REWROTE `src/components/NativeFindOverlay.tsx` as a real lens:
  - small fixed bar top-right (373x38 @2048x1280), `backdropFilter: none`,
    transparent backdrop, NO scrim, NO click-to-close, page stays interactive
  - TreeWalker highlight (collect-then-mutate) wrapping matches in `<mark>`,
    fully reversible teardown via `parent.normalize()`
  - inactive = `rgba(251,191,36,0.26)` wash; ACTIVE = solid `#fbbf24` +
    `#18181b` text + `df-find-ring` pulse animation
  - `revealMatch()` scrolls active to viewport centre, with a manual
    scrollable-ancestor correction pass
  - `contextFor()` renders an "in <nearest heading/data-section>" chip
  - counter `n/total`, No-results state, Enter/↓ next, Shift+Enter/↑ prev,
    Esc close, Ctrl+F refocus, Tab trapped in field
  - MutationObserver re-highlights after page re-renders
  - Radii pinned to LAMINAR §4 (12px card / 8px controls) — this build's
    `rounded-xl` computes to 20px, which §4 bans
- `src/App.tsx`: Ctrl+F handler is now UNCONDITIONAL (fires even with a text
  field focused, like Chrome), capture phase, `preventDefault`, documented why.
- `src/terminal/components/NativeFindOverlay.tsx`: was an unreferenced SECOND
  copy of the same broken overlay. Now re-exports the single implementation.
- PRE-EXISTING BUILD BLOCKER (not mine): `src/main.ts:26428` had `\\`` inside
  a template literal → tsc TS1005, esbuild "Expected ) but found $". Fixed to
  `` \` ``. Build went from FAIL to OK.
- PRE-EXISTING type error fixed (1 line): `App.tsx` used `SearchHit` with no
  import → added `import type { SearchHit } from './services/search/index'`.
**C2 COMPLETED:**
- USER ASK: "search bar in a weird position, make it adjustable" + "where is the
  search SCOPE feature, why is it all gone".
- SCOPE WAS NEVER REMOVED — it was UNREACHABLE. `SmartSearchOverlay` (All/Page/
  Section pills, app-wide indexed results) rendered behind `open={smartSearchOpen}`,
  and the ONLY writer of that state in the entire repo was `setSmartSearchOpen(false)`
  at App.tsx:329. There was no `setSmartSearchOpen(true)` anywhere. The 3 Sidebar
  "Smart search" buttons dispatch `smart-search:open`, whose only listeners live in
  `useAppSmartSearch` — a hook that is NEVER CALLED. So those buttons were no-ops
  and the scope feature had no reachable entry point. (Backend was fine all along:
  `registerSearchIpc()` IS called at main.ts:6204.)
- MERGED the two overlays into ONE bar. Scope is not a separate dialog, it is the
  same question at two altitudes, on the surface people actually press:
    Page    = live DOM find (instant, highlights, scrolls to centre)
    All     = indexed app-wide search, result list, click navigates + scrolls
    Section = indexed, narrowed to this page; FALLS BACK to live find when the
              page isn't indexed (never a dead end)
- PLACEMENT FEATURE: 3x3 anchor grid (top/bottom x left/center/right), reachable
  two ways — drag the grip, or click a cell in the position picker. Snaps rather
  than free-drags on purpose (free drag can strand the bar off-screen with no way
  back). Persisted to localStorage `deskflow:find-bar-anchor` in try/catch; resets
  to the default corner if a window shrink pushes the card out of reach.
- App.tsx: `openFind(scope)` now listens for BOTH `smart-search:open` (-> All) and
  `native-find:open` (-> Page); Ctrl+F -> Page. Removed the dead SmartSearchOverlay
  render + its import (file left on disk, scope now lives in the find bar).
- Own defect found + fixed in review: Section's fallback gated on the GLOBAL index
  size, so it never fired for a merely-unindexed page. Now gates on "this page
  returned no indexed hits".
- Own defect found + fixed in review: grip both dragged AND toggled the picker
  (two-in-one control). Split into grip = drag, Settings2 = picker.
- Radii: `rounded-xl` computes to 20px in this build; LAMINAR §4 bans >12. Pinned
  card/controls/chip to explicit 12px/8px.
- Verification (live Electron, Probe): Page 162 marks + counter 1/167 + 1 active;
  All -> seeded index -> 2 rows w/ section chips + snippets, click -> hash
  `#/learn` + bar closed + 0 marks; Section -> "This page isn't indexed — searching
  what you can see" + live marks; picker -> 6 cells; bottom-left click moved
  (12,12)->(12,1196) and persisted; drag 90%/80% -> bottom-right persisted;
  reopen honoured anchor; Escape -> 0 marks. backdropFilter:none, bg transparent.
- Collision: another agent was editing src/pages/DashboardPage.tsx and
  src/pages/TerminalPage.tsx during my build (intermediate parse errors both
  times). I did NOT touch their files; waited for the tree to go stable, and the
  coord lock correctly REFUSED my build while theirs held it.
**C3 COMPLETED:**
- RETRACTION (important): the C1 `ipcMain is not defined` / "reload every 4s"
  diagnosis was WRONG. It did not reproduce on a clean build: main logs
  `✅ Tracking handlers registered` + `🔄 Tracking restarted via IPC` + no
  SQLite-fallback warning. The earlier evidence came from running a HALF-WRITTEN
  dist-electron/main.cjs while another agent was mid-build. Broken artifact,
  not broken source. Do not chase it again.
- REAL live defects found in that clean boot log, still unfixed (out of scope,
  each needs its own diagnosis): `[Migration] v2 failed: SqliteError`,
  `[GAS] handlers failed to register: contextBrain$1.setBrainDb is not a
  function`, `[RECAP] whenReady hook error: checkMonthlyRecaps is not defined`.
- NEW `src/hooks/usePageSearchIndex.ts` — auto-indexes EVERY route. Harvester
  walks `[data-page-root]` (new attribute on App.tsx's main scroll area) in two
  passes: (1) heading-delimited prose, (2) text-bearing LEAF cards, because this
  app's UI is div-based and a prose-only pass found just 16 blocks on the
  dashboard. Card titles use `innerText` (not textContent) or sibling spans
  concatenate into "CustomCategories".
- Deliberately does NOT unindex on navigate — All scope is app-wide, so the
  index must ACCUMULATE visited pages. Ids are `auto:<pageId>:<n>` so a revisit
  upserts. Confirmed: dashboard 27, activity +8, reports 16, settings 57, and
  All-scope hits spanning ['settings','activity','reports'].
- Dedupe hits by (pageId, title) in the bar so a curated segment and its
  harvested twin never both show.
- Build: 4 OOM kills from 4-6 concurrent `vite build`s by other agents; each
  kill left `dist/` EMPTY (emptyOutDir) which BROKE the user's app until I
  rebuilt. Hard lesson saved to MEMORY.md.
**NEXT ACTION:** user restarts DeskFlow. Optional follow-ups, in order of value:
  1. fix the main.ts `ipcMain is not defined` storage-init throw (below) — it is
     what puts the app in "RHEO failed to load / reload every 4s" on a fresh
     profile, and it kills DashboardPage's indexer, so All-scope reads 0.
  2. register `useSmartSearch(pageId, segments)` on more pages — only
     DashboardPage.tsx:404 registers today, so All scope is thin by construction.
  3. the two dead useAppSmartSearch hooks still carry the "let the browser handle
     Ctrl+F" no-op comment; harmless (never mounted) but misleading. If the bar opens
but the page is in "RHEO failed to load / reload-tracking: No handler
registered" mode, that is the SEPARATE main-process bug below — chase that next.
**NOTES:** separate PRE-EXISTING bug found, NOT fixed (out of scope, needs its
own cycle): at main.ts:4400-4406 the tracking/session/gas/lecture
`registerXHandlers(...)` calls sit inside an outer try whose catch is
`[DeskFlow] ⚠️ SQLite failed, falling back to JSON: <err>`. That outer try
throws `ipcMain is not defined`, so lines 4403-4406 never run →
`restart-tracking` / `set-tracking` / `toggle-tracking` have NO handler →
renderer invokes fail → ErrorBoundary auto-reloads every 4s (3 attempts) →
"RHEO failed to load". Locate the bare `ipcMain` reference in the storage-init
block (not in main.ts itself — grep finds only `electron_1.ipcMain` there) and
import it properly.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — 2026-09-30T16:20
**ROLE:** Hands & Eyes — startup ritual, root-cause sweep for Ctrl+F
**STATUS:** completed
**IN FLIGHT:**
- mapped the 4 competing Ctrl+F code paths
**COMPLETED:**
- identified the dead "let the browser handle it" handlers as the no-op cause
**NEXT ACTION:** rewrite NativeFindOverlay as a no-scrim lens