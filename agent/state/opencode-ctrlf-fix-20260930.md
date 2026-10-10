<!-- AGENT STATE -->
<!-- SESSION: opencode-ctrlf-fix-20260930 -->
<!-- AGENT: opencode | TERMINAL: (external CLI) | PROJECT: App Tracker -->

# Agent State — opencode-ctrlf-fix-20260930

> **STATUS:** completed | **UPDATED:** 2026-10-01T22:05:00.000Z

---

## CURRENT CYCLE (6)
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
**C4 (this cycle) — 4 asks:**
- SHIPPED + verified in dist/:
  1. Scopes renamed to a strict hierarchy Subpage / Page / App. Subpage = live
     DOM find on the visible screen; Page = indexed, current route; App =
     indexed, everything. Bar always shows which one (e.g. "App · 57 indexed").
  2. Wheel over the results scrolls the RESULTS: `overscroll-behavior: contain`
     on the panel plus a non-passive `wheel` listener with stopPropagation, so
     the page behind no longer slides away under the list.
  3. Drag rewritten: pointer events (not mouse), and move/up listeners are
     attached SYNCHRONOUSLY in pointerdown. The old version flipped a `dragging`
     state and attached from a useEffect, so the first pixels of a fast drag
     were missed and the bar felt glued. Now the bar FOLLOWS the cursor 1:1 and
     a dashed ghost shows the cell it will snap into.
  4. Result clicks now navigate. THREE separate silent failures fixed:
     - scrollToSection() queried `[data-section=...]` but auto segments store a
       card TITLE there — never matched.
     - getElementById(hit.id) assumed ids were DOM ids; auto ids are
       `auto:settings:c:5` — always null.
     - same-page hits did NOTHING at all (only the cross-page branch existed).
     New `src/lib/findLocate.ts` locates via data-df-locator -> text probe, and
     flashes the target. Harvester now stamps `data-df-locator` on every
     element it indexes. Verified: click on an `↗ activity` hit moved the route
     #/settings -> #/activity.
  5. Clicking a tab switches the mode to Subpage (a tab click IS the user saying
     "I moved to a different here"), and re-reads the tab name.
- NOT YET BUILT (machine thrashing, 5 concurrent vite builds, swap 13MB free):
  `locateHit` retry budget 8x150ms -> 40x200ms (8s). Without it a cross-page
  click navigates but may not finish scrolling into view on a slow-mounting
  page. Source is correct and typechecks; it just needs ONE successful build:
  `run-exclusive.mjs build -- npx cross-env NODE_OPTIONS=--max-old-space-size=8192 vite build`
  Verify with `ls dist/assets | wc -l` (>100) and `ls -la dist/index.html`.
**C5 — the REAL reason clicks never scrolled (found by diffing the bundle):**
- The shipped bundle still contained the OLD handler: `grep 'SmartSearch]
  selected'` and `'scrollToSection result'` both matched `dist/assets/index.*.js`.
  Source had been REVERTED — another agent overwrote `src/App.tsx` (408
  insertions / 199 deletions vs HEAD) between my edit and my build, so
  `locateHit` was gone while `src/lib/findLocate.ts` sat unused.
- Route changes appeared to work because the OLD handler still called
  `navigateTo`; it just could never scroll (old code = `scrollToSection`).
- RE-APPLIED the handler + import. LESSON: on a shared file, verify your marker
  is in the BUILT BUNDLE, not just in source — `rg 'yourMarker' dist/assets/
  index-*.js`. A silent revert by a peer is invisible to tsc.
- Enter was closing the bar in indexed scopes; now Enter/Space step through
  results and KEEP the bar open (Chrome behaviour), Shift+Enter reverses, row
  click keeps it open too. Esc/X are the way out.
- Fixed a walk bug this exposed: `currentPageId` was a dep of the search effect,
  so each navigation refetched and called setHitIdx(0) — the counter reset
  (1/26 -> 2/26 -> 1/26) and you could never pass the 2nd result. Removed it;
  Page-scope narrowing already reads currentPageId in visibleHits.
- Verified live (14/14): flash lands 250ms after click; Enter walks
  7/26->8/26->9/26->10/26->11/26 with the bar open and every step flashing;
  wheel over the list scrolls the LIST and the page behind does not move
  (listScrolled:true, pageMovedBehind:false); drag follows the cursor
  (1695,12)->(860,688) with the dashed preview, snaps to bottom-center and
  persists; scopes read Subpage|Page|App; Esc closes.
- Built to a scratch --outDir and copied in, so dist/ was never at risk. Optional follow-ups, in order of value:
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
**C6 — arrow/Enter parity (why the arrows felt dead):**
- In the INDEXED scopes (Page/App) `step()` only moved the highlighted row and
  did NOT navigate, while Enter did. So ArrowDown/ArrowUp and the two chevron
  BUTTONS looked broken: the selection moved and nothing happened on the page.
  Chrome's find bar has no "select but do not go" mode — the selection IS the
  navigation.
- FIXED: `step()` now calls `onSelect` in every scope, so arrows, chevrons and
  Enter are interchangeable and every one lands on the target. `stepAndGo` was
  redundant afterwards and was deleted. Hovering a row still only previews
  (setHitIdx, no navigation) so moving the mouse cannot yank the page.
- Added Ctrl/⌘ + ArrowDown/ArrowRight = next, Ctrl/⌘ + ArrowUp/ArrowLeft =
  previous. Checked for conflicts first: Sidebar.tsx's ArrowLeft/ArrowRight
  resizer is an onKeyDown on the resizer ELEMENT (needs focus), so no clash.
- Verified live 17/17: Enter 1->2, ArrowDown 2->3->4, Ctrl+Right 4->5->6,
  Ctrl+Left 6->5->4, Shift+Enter 4->3, chevron buttons 3->4->5->4, ArrowUp ->3.
  Bar stayed open through all of it.

**NEXT ACTION:** rewrite NativeFindOverlay as a no-scrim lens