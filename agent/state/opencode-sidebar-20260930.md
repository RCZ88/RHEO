<!-- SESSION: opencode-sidebar-20260930 -->
<!-- AGENT: opencode | TERMINAL: sidebar-20260930 | PROJECT: App Tracker -->

# Agent State — opencode-sidebar-20260930

> **STATUS:** completed | **UPDATED:** 2026-10-02T14:20:00Z

---

## CURRENT CYCLE (3)
**ROLE:** Hands & Eyes — app sidebar: full arrangement system + all four orientations
**STATUS:** completed
**COMPLETED:**
- **`/agentic` nav restored.** The blank line at old `Sidebar.tsx:35` was a scar from the sidebar-overhaul
  commits (`2199d36`, `1fc895f`, `a78d545`) which folded group `AGENTS` into `SYSTEM` and dropped
  `{ path: '/agentic' }`. Route was never retired: `App.tsx:3252` route, `AgenticSystemPage.tsx` exists,
  `design/design.md:86` lists it, `index.css:456` gives it `--page-accent: #8b5cf6`. Restored with lucide `Bot`
  (`ShieldIcon` was already Insights, so reuse would have made the two indistinguishable).
- **Registry extracted to `src/components/sidebar/items.ts`** — a LEAF module. It was forced by a real crash:
  `Sidebar.tsx` -> `useSidebarConfig` -> `Sidebar.tsx` meant the store's module-level `load()` read a `const`
  in its TDZ => shipped white screen, `ReferenceError: Cannot access 'SIDEBAR_ITEMS' before initialization`.
  Vite only WARNED (circular dependency) and esbuild/tsc were both clean — nothing caught it but the app.
- **Config is a module-level external store** (`useSyncExternalStore` + `sidebarConfigActions`), NOT component
  state: `App.tsx` needs `side` to flip the layout and `Sidebar.tsx` renders the groups, so two `useState`
  copies would desync. Key `df-sidebar-config`. `sanitise()` on read drops malformed groups and re-homes
  orphaned items so a page can never become unroutable.
- **All four orientations.** left/right = vertical rail (`Sidebar.tsx`, mirrored: `flex-row-reverse`,
  `order-last`, ruler strip border, nav needle, node hairline, item padding, separator ticks all flip).
  top/bottom = `src/components/sidebar/SidebarHorizontal.tsx`, a SEPARATE component because the rail is an
  INSTRUMENT: its 24-tick ruler, vertical nav needle and horizontal mouse needle are re-derived on the other
  axis (ruler horizontal along the inner edge, needle slides horizontally, mouse needle becomes a VERTICAL
  line at mouseX). Height drag handle 44-140px, default 60, `df-sidebar-height`, `role=separator`
  `aria-orientation=horizontal`. Collapse in horizontal = icons-only + `H_MIN`, because a bar has no rail state
  and the toggle must stay reachable.
- **Arrange panel** (quick-access ON the rail, not in Settings): rename/reorder/delete groups, per-page group
  dropdown for all 13 items, +Group, Reset, 4-way side toggle. Same panel exists in both layouts.
- **Resize handle** on the vertical rail: clamp 208/520/224, rAF-coalesced drag, double-click reset, arrows
  ±16, Home/End, `role=separator` + `aria-valuenow`. Width transition disabled while dragging or the handle lags.
- **VERIFIED LIVE** (Probe, launched via MCP not `npx electron`): top = 60px tall, full width 2048, horizontal
  resizer strip, 13 items, 6 inline group labels, 25 ruler ticks. bottom = anchored to viewport bottom after
  fix. all 4 sides round-trip. vertical rail returns at 224px, `flexDirection:row`, `order:0`,
  navNeedleLeft `18px`, agentic visible, arrange button present. `assert_no_errors(console)` CLEAN.

**BUG FOUND BY LIVE VERIFICATION (not by build or review):** first `bottom` build reported
`data-side="bottom"` and the correct `border-top`, but the bar rendered at the TOP of the viewport. Cause: the
App wrapper is a COLUMN for top/bottom, and the `flex-col-reverse` I applied to the bar reverses the bar's
CHILDREN (ruler/labels) — not the bar's position IN that column. Fix: `!isTop && 'order-last'`. A static
read of the class list looks correct; only geometry proved it wrong.


**CYCLE 3 ADDENDUM — Agentic System page REMOVED at CZ's request:**
- CZ: "it doesn't belong to anything but the terminal or the AI assistant... just remove it."
- Evidence gathered first (worth keeping): the page was ~90% DEAD. `AgentCommsPanel` and `ContextDashboard`
  both call `api.agent.getMessages({})` and there is **NO `agent:get-messages` handler anywhere in main.ts**
  — the call is guarded, so it fails silently and the panel renders permanently empty with no error. The 24 real
  `agent:*` handlers are ALL terminal-agent lifecycle (`ready`, `idle`, `get-phase`, `get-status`,
  `write-verified`, `start-timeout`, `retry-launch`, `arm-handshake`, `set-model`, `send`) — Penguin Console
  territory, already surfaced there. The external-AI path uses `ai_context_captures`, a completely separate
  system with zero overlap. That is why nobody noticed it missing for 2 weeks.
- Removed: `src/pages/AgenticSystemPage.tsx`, all of `src/components/agentic/` (4 panels), the lazy import +
  `/agentic` route in `App.tsx`, the orphaned `[data-page="agentic"]` token in `src/index.css`, and `agentic`
  from the LAMINAR §8 route list in `design/design.md`. Nav item already removed from `sidebar/items.ts`.
- Dependency-checked BEFORE deleting: only the page imported the 4 panels, only App.tsx imported the page,
  and the panels do not import each other. Physical backup at
  `agent/backups/20261001-pre-agentic-removal/` (R5) — 4 panels + page.
- Build OK (5m21s). Assets 300 -> 298, `AgenticSystemPage.*` chunk gone, 0 references in any bundle.
- VERIFIED live via Probe: booted, `agenticInSidebar:false`, rail onLeft 224px, arrange button present,
  all 6 group labels render, console CLEAN. probe_close done, no leaked processes.
- CZ's judgement call was correct and my earlier "restore the orphaned route" instinct was wrong: a route with
  no nav entry is only a bug if something lives behind it. This one held a page with an unimplemented API.


**CYCLE 3 ADDENDUM 2 — React #310 FIXED (CZ reported it live):**
- CZ: "Minified React error #310 ... this error shows when i change the orientation of the shit. but once i
  reload there was no problem." — a precise, complete bug report.
- Cause was MINE. The top/bottom dispatch `if (config.side === 'top' || 'bottom') return <SidebarHorizontal/>`
  sat near the top of `SidebarComponent`, ABOVE nine further hooks. Flipping to top/bottom ran 13 hooks where
  the previous render ran 22; flipping back ran 22 where the previous ran 13. React compares hook count
  between consecutive renders => #310. **Reload masked it entirely** because a fresh mount is internally
  consistent — which is exactly why every build/esbuild/tsc/reload check passed.
- Fix: moved the dispatch to immediately before the component's final `return`, below all 13 hooks, with a
  comment stating hook order is load-bearing and why. Verified by awk that every HOOK line precedes the
  RETURN-GATE line and the FINAL-RETURN.
- REBUILT (a first attempt failed on `services/ai/toolRegistry.ts` — that file is unmodified in git, compiles
  standalone in 13ms and was untouched since Sep 21, so it was a transient OOM kill, not a real error;
  re-ran and got a clean build).
- VERIFIED LIVE by clicking the real UI: right, bottom, left, top, left — all 5 transitions correct
  (barSide matches, railLeft 1824 for right / 0 for left), `assert_no_errors(console)` CLEAN after every one.
  16/16 probe assertions passed, probe closed.
- TESTING LESSON recorded in MEMORY.md: writing localStorage directly does NOT notify the store's
  subscribers, so a localStorage-driven orientation test silently proves nothing — drive the real buttons.
  Also `data-testid="sidebar-resizer"` is intentionally present in BOTH layouts, so a presence check for it
  cannot distinguish vertical from horizontal; test `[data-testid="sidebar-horizontal"]` instead.


**CYCLE 3 ADDENDUM 3 — horizontal-bar NEEDLE/RULER containment fix (CZ: "the red needle becomes so big and
disturbing the rest of the stuff"):**
- MEASURED THE ACTUAL BUG (bottom bar, 60px tall, viewport y 1220-1280):
  needle box was `{x:600, y:1169, w:1, h:60}` — i.e. it started **51px ABOVE the bar** and shot up into the
  page content. Cause: the needle's parent is the 8px `h-2` ruler strip and I set `bottom:0` +
  `height: barHeight`, with `overflow: visible`, so a 60px line anchored to an 8px box escaped upward.
- SECOND BUG found in the same pass: 12+ ruler TICK spans rendered at y=1213, i.e. **7px above the bar**, because
  each tick wrapper was `absolute` with only `left` set — no `top`/`bottom` — so it fell to an auto/static
  position. Ruler labels were also positioned at `'100%'` of a 0-height parent.
- FIX: rewrote the whole ruler as a deterministic 16px strip with `overflow-hidden`, every child explicitly
  anchored to the baseline hairline. Mouse needle is now a short 10px tick INSIDE the strip (was `barHeight`).
  Dropped the 5 scale labels to just the two ends (`00`, `24`) — a 60px bar has no room for five floating
  numbers and they read as noise. Nav needle is a 6px dot on the hairline instead of an 8px glow.
- ADDED CSS TOKENS `--sb-ruler-line/-tick/-label/-mouse-needle` in `index.css` (LAMINAR §7.7 forbids raw rgba
  typed in a .tsx). Needle is muted rose `rgba(244,114,182,0.5)` because it is a cursor-position readout, NOT
  an error state — §2 reserves full-strength rose for destructive.
- VERIFIED LIVE both orientations, panel CLOSED: bottom needle `{y:1227,h:10}` inside strip 1221-1237 inside
  bar; top needle `{y:71,h:10}`; **strays outside the bar: 0 for both** (was 12+ ticks + the needle).
  `overflow` computes to `hidden`. Screenshot captured — bar reads clean, no streak. Console CLEAN.
  29/29 probe assertions passed, probe closed, no leaked processes. Vertical rail re-verified intact at 224px.
- MEASUREMENT GOTCHAS hit this pass (both produced wrong conclusions at first):
  (a) `.h-4` matched a nav ICON wrapper, not the ruler strip, so an `overflow` reading came back `visible` and
  looked like the fix had not applied. Target the strip by its `overflow-hidden` class, never a size utility.
  (b) An "18 strays" reading was the ARRANGE PANEL — a popover taller than a 60px bar, legitimately outside it.
  Always close the panel before measuring containment, or measure only the instrument subtree.
- BUILD WAS BLOCKED MID-TASK by `src/pages/DatabasePage.tsx:187` (`Expected ")" but found "data"` — a raw JSX
  comment inside an expression container). NOT my file, uncommitted, mtime seconds old, and no agent held a
  lease. Did NOT touch it; polled until it went valid (~150s) and proceeded. **A syntactically broken file from
  another session blocks the whole renderer build — check `git status` + lease before assuming your own change
  broke the build.**

**NEXT ACTION (unchanged):** Only remaining sidebar-adjacent gap: **rename for TRACKER categories** (Settings -> Category).
Finance categories rename exists (`CategoriesTab.tsx:94`); tracker categories have add/delete/drag-tiers/
per-app/per-domain assign but NO rename path anywhere. Deliberately NOT started — CZ said "do the sidebar".

**NOTES / OPEN THREADS:**
- **`FlaskConical` sits unused in `Sidebar.tsx`'s lucide import** and is in NEITHER HEAD nor the index, so it
  is not my edit and not staged work. Left in place rather than clobbering another session. Needs a human call.
- **Another agent added a "Labs" nav item** that is not in my `items.ts`; the arrange panel listed it
  ("Group for Labs"), so their build has it. My extraction may have raced their edit — reconcile.
- **`App.tsx` has pre-existing `TS2304 Cannot find name` for `setNotifPanelOpen` / `setShowGapDrawer` /
  `setShowGapBanner`** (used 2/2/5x, defined 0x). Confirmed present in the INDEXED App.tsx too, so it is
  another agent's in-flight work, not mine. Would be a runtime ReferenceError if reached.
- **`cn` is NOT imported in `App.tsx`** — using it there would be a runtime ReferenceError that esbuild and
  tsc both accept. Used a ternary instead. Worth remembering.
- **AFK "Were you sleeping?" modal** is a full-screen `z-[9999]` overlay with `pointer-events:auto` that
  swallows real clicks. Bit me twice. Unfixed.
- Machine: build takes ~4m20s; 8GB heap request; builds get OOM-killed under contention and a mid-build death
  leaves `dist/` EMPTY (black screen). Always `ls dist/index.html` + `ls dist/assets|wc -l` after a build.
