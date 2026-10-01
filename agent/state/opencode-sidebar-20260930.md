<!-- SESSION: opencode-sidebar-20260930 -->
<!-- AGENT: opencode | TERMINAL: sidebar-20260930 | PROJECT: App Tracker -->

# Agent State — opencode-sidebar-20260930

> **STATUS:** error (blocked on machine resources) | **UPDATED:** 2026-10-01T00:50:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Hands & Eyes — app sidebar: restore orphaned /agentic nav item + add drag-resize handle
**STATUS:** error (build blocked; dist/ recovery needed)
**IN FLIGHT:**
- Group CRUD customization (NOT started — deliberately deferred, see NOTES)
**COMPLETED:**
- **Answered "what is the 15th nav item":** the blank line at `Sidebar.tsx:35` is a scar from the
  sidebar-overhaul series (`2199d36`, `1fc895f`, `a78d545`), which folded the old `AGENTS` group
  into `SYSTEM` and DROPPED `{ icon: Shield, label: 'Agentic System', path: '/agentic', group: 'AGENTS' }`.
  `/agentic` is NOT dead: `App.tsx:3252` route, `App.tsx:80` lazy import, `AgenticSystemPage.tsx` exists,
  `design/design.md:86` lists it, `index.css:456` gives it `--page-accent: #8b5cf6`. It was a live,
  routed, accent-themed page with no nav entry. **Restored** into SYSTEM with lucide `Bot`
  (`ShieldIcon` was already used by Insights, so reuse would have confused the two).
- **Added a drag-resize handle** to the app sidebar, adapted from the console's proven
  `src/terminal/App.tsx:26-81`. Clamp 208/520/224, rAF-coalesced mousemove, double-click reset,
  ArrowLeft/Right ±16, Home/End, `role="separator"` + `aria-valuenow/min/max`, `tabIndex=0`,
  `data-testid="sidebar-resizer"`, hairline pill that lights on hover AND focus-visible.
  Hidden while collapsed (a 64px rail has nothing to resize).
  Exported `SIDEBAR_MIN/MAX/DEFAULT/RAIL` + `clampWidth`.
- **Width now comes from state**, not the old hardcoded `w-[64px]`/`w-[224px]`. New
  `df-sidebar-width` localStorage key mirroring the existing `df-sidebar-collapsed` pattern exactly
  (try/catch wrapped, clamp applied on READ so a hand-edited value can't escape the range).
  `App.tsx` passes `width` + `onResize`; `Sidebar.tsx` applies it via `style` and adds `relative`.
- **Width transition is disabled while dragging** (`resizing` state -> `transition: 'none'`) — a
  transitioning width makes the handle lag behind the cursor.
- tsc: 7,183 -> 7,180. Zero new errors from my change. Both `Sidebar.tsx` errors
  (`WebkitAppRegion` not in `Properties`, unused `mouseY`) are PRE-EXISTING (confirmed in baseline).
  The only "new" messages in the diff were in `main.ts` / `GoldPage.tsx` = another agent's edits.
- Built via the wrapper; my symbols confirmed in shipped `dist/assets/index.DQf61Sug.js`
  (`sidebar-resizer` x3, `Resize sidebar` x1, `df-sidebar-width` x2, `Agentic System` x3).

**NEXT ACTION:** RELOAD the app to see the changes. The running window (pid 160176) started BEFORE
this build, so it still holds the old renderer in memory. Then: decide group-CRD placement with CZ.

**NOTES / BLOCKERS:**
- **⚠ CRITICAL MACHINE STATE, NOT MY CODE.** Swap was pegged at 8191/8191 MB (0 free) with 10
  `opencode` processes + webstorm each ~1 GB. Three of my build attempts were OOM-killed mid-vite
  (`transforming...` / `rendering chunks...` then silent death, no error text — the documented
  signature). `npm run build` hardcodes `NODE_OPTIONS=--max-old-space-size=8192`, which this box
  physically cannot satisfy. Capping to 3072 did NOT help — the contention, not the heap size, is
  the cause.
- **⚠ `dist/` WAS WIPED and I restored it.** Mid-session `dist/index.html` vanished and
  `dist/assets` hit 0 files — a black-screen state (AGENTS.md §8 root cause #1/#2). A competing
  build finished at 00:46 and restored it (300 assets). All 5 black-screen gates re-verified green.
  If the app is reloaded while `dist/` is empty it WILL black-screen. Watch for this.
- **Coordination-layer wart:** a build lock's `ttlMs` is 1,200,000 (20 min). An OOM-killed build
  holds the lock for 20 minutes even though its pid is gone, and `coord.mjs status` still lists it
  as an agent. A stale lock therefore looks identical to a live one; check `ps -p <pid>` before
  assuming you must wait 20 minutes.
- I registered build agents that then blocked on the lock, adding to the pile. Cleaned all of them
  up with `coord.mjs done` — do NOT leave blocked build agents registered, they make status useless.
- **Group CRUD deliberately NOT started.** It needs a placement decision (Settings tab vs inline
  drag in the rail) and it is a whole new surface. `setGroups` already exists in the terminal store
  but the app sidebar's groups are 3 frozen module constants (`SIDEBAR_ITEMS` per-item `group:`
  field, `GROUP_ORDER:41`, `GROUP_KICKER:43`) with zero customization UI. Moving them to persisted
  store state (the way `sidebarWidth` now is) is the prerequisite. dnd-kit is already a dependency
  and already used for tier drag at `SettingsPage.tsx:2428` — reuse it, pull nothing.
