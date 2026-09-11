# Human Testing Checklist

**Last Updated:** 2026-06-19

## SECTION 6: OrbitSystem Bug Fixes (2026-06-19)

**Fixes:** FPSLineGraph hook error, website duration scaling, timeline selector data loading, sun size, orbit spacing.

| Feature | Test Steps | Expected | Pass/Fail |
|---------|-----------|----------|-----------|
| No R3F hook crash | 1. Go to Dashboard 2. Orbit thumbnail loads | No console error "Hooks can only be used within the Canvas" | ⏳ |
| FPS graph renders | 1. Open OrbitSystem fullscreen 2. Click FPS button | Sparkline graph appears with live FPS data | ⏳ |
| Website planet sizes correct | 1. Visit websites for several minutes 2. Go to Dashboard → OrbitSystem galaxy view → Websites tab | Website planet sizes correlate to actual usage (hours/minutes, not <5s) | ⏳ |
| Timeline selector refetches data | 1. Click "Today" in OrbitSystem timeline 2. Click "Week" 3. Click "Month" 4. Click "All" | Data changes to match selected period (planet count, sizes update) | ⏳ |
| Sun is visually dominant | 1. View solar system mode | Sun is noticeably larger than all planets (≥3x size ratio) | ⏳ |
| No orbit collisions | 1. Open solar system with many apps visible | Inner planet orbits don't visually overlap; all orbits clearly separated | ⏳ |

## SECTION 5: Sidebar Scroll Fix (2026-06-05)

**Fix:** Two-level wrapper pattern (outer `flex-1 min-h-0` + inner `h-full overflow-y-auto`). Same pattern as TabPanel.

| Feature | Test Steps | Expected | Pass/Fail |
|---------|-----------|----------|-----------|
| Main sidebar scrolls | 1. Open app 2. Collapse window very short (~500px) 3. Scroll sidebar nav with mouse wheel AND drag scrollbar thumb | All 11 nav items visible via scroll, nothing cut off at bottom | ⏳ |
| TerminalPage workspace sidebar tabs | 4. Go to Workspace 5. Open workspace 6. Click any tab (Sessions/Map/Analytics/etc.) 7. Shrink window | Tab content scrolls vertically with both wheel and scrollbar | ⏳ |
| Main page content scrolls | 8. Navigate to Dashboard/Stats with tall content 9. Shrink window | Page content scrolls with mouse wheel | ⏳ |

## SECTION 4: AFK Confirm Save Fix (2026-06-04)

| Feature | Test Steps | Expected | Pass/Fail |
|---------|-----------|----------|-----------|
| Debug trigger manual AFK | 1. Press `Ctrl+Shift+Alt+A` anywhere in the app | AFK prompt modal appears with a suggested activity (or fallback "No activities") and a live elapsed timer | ⏳ |
| Debug AFK — confirm saves | 2. In the AFK prompt, click an activity | Modal closes; navigate to External page → click that activity's "View Data & Charts" | The session appears with correct duration matching the live elapsed timer shown | ⏳ |
| Debug AFK — re-trigger test | 3. Press `Ctrl+Shift+Alt+A` again, pick a different activity | New session saved under that activity; External page shows both sessions across different activities | ⏳ |
| Debug AFK — dismiss works | 4. Press `Ctrl+Shift+Alt+A`, click "Nothing special — just AFK" | Modal closes; External page can show "AFK" activity sessions if filtered | ⏳ |

---


### TerminalPage Analytics — Project-Specific Only

| Feature | Test Steps | Expected | Pass/Fail |
|---------|-----------|----------|-----------|
| Terminal Analytics tab | 1. Open workspace with a project selected | Shows only Sessions count stat + Sessions by Agent pie + Session Status doughnut | ⏳ |
| No global data in sidebar | 2. Click Analytics tab in Terminal sidebar | No AI Usage Summary, no Problems/Requests charts, no Daily Activity Trend | ⏳ |
| Period filter works | 3. Toggle 7d / 30d / All Time | Session data filters accordingly | ⏳ |

### IDEProjectsPage — New Analytics Tab

| Feature | Test Steps | Expected | Pass/Fail |
|---------|-----------|----------|-----------|
| Analytics tab visible | 1. Go to IDE Projects page | "Analytics" tab button visible in tab bar | ⏳ |
| Workspace analytics loads | 2. Click Analytics tab | Shows AI Usage stat cards (Tokens, Cost, Sessions, Problems, Requests) | ⏳ |
| Charts render | 3. Wait for data | Token Distribution pie, Cost Distribution doughnut, Problems/Requests by Status charts visible | ⏳ |
| AI Usage Summary table | 4. Scroll down | Table shows per-tool breakdown (Tool, Tokens, Cost, Sessions) | ⏳ |
| Problems/Requests progress | 5. Check bottom of page | Problems Progress + Requests Progress bars visible | ⏳ |
| Tab persists on reload | 6. Click other tab, click back to Analytics | Analytics tab re-fetches data fresh | ⏳ |

### InsightsPage — New Charts on Activities Tab

| Feature | Test Steps | Expected | Pass/Fail |
|---------|-----------|----------|-----------|
| Daily Activity Trend chart | 1. Go to Insights → Activities tab | Bar chart visible at top showing hours per day | ⏳ |
| Activity by Category chart | 2. Check next to trend chart | Doughnut chart showing time breakdown by category | ⏳ |
| Charts match period | 3. Toggle Week / Month period selector | Charts update to show correct date range | ⏳ |
| Existing content preserved | 4. Scroll below charts | External Activity Breakdown + App/Least Used lists still present | ⏳ |

---
| Phase | Feature | Status | File |
|-------|---------|--------|------|
| 1 | Tracking on startup | ⏳ Test | main.ts line 2147 |
| 2 | Morning sleep modal | ⏳ Test | App.tsx new modal |
| 3 | View Stats Only button | ⏳ Test | ExternalPage.tsx |
| 4 | Dashboard external timer (unchanged) | ✅ | Already correct |

---

## SECTION 2: Terminal Workspace Features (NEW - 2026-05-12)

### 🔥 CRITICAL TERMINAL FEATURES

| Feature | #Req | Status | Test Steps | Expected | Pass/Fail |
|---------|------|--------|-----------|----------|-----------|
| **Build passes** | - | ✅ Done | Run `npm run build` | No errors | ✅ |
| **Add Terminal button** | #027 | ✅ Done | Click + button in terminal tab bar | New terminal created | ⏳ |
| **Terminal renders** | - | ✅ Done | Click + button | Terminal pane visible on screen | ⏳ |
| **AI agent dropdown** | #035 | ✅ Done | Click + button, see AI selector | Claude/OpenCode/other options | ⏳ |
| **Default agent persists** | - | ✅ Done | Select agent, close app, reopen | Same agent selected next time | ⏳ |
| **Terminal tab shows agent** | #026/#036 | ✅ Done | Create terminal, check tab label | Tab shows "Claude" or "OpenCode" | ⏳ |
| **Sessions list visible** | #028 | ✅ Done | Click Sessions tab | Shows running/recent sessions | ⏳ |
| **Session resume** | #033 | ✅ Done | Click Resume on session | Terminal reconnects to session | ⏳ |
| **Delete session** | #034 | ✅ Done | Click Delete on session, confirm | Session removed from list | ⏳ |
| **Presets execute** | - | ✅ Done | Select preset, click Execute | Command sent to terminal | ⏳ |
| **Send button works** | #032 | ✅ Done | Type command in Send field, click Send | Command executes in terminal | ⏳ |
| **Save checkpoint** | - | ✅ Done | Click 💾 Save button | Session state saved | ⏳ |
| **System prompt loads** | - | ✅ Done | Create terminal, check output | System prompt appears first | ⏳ |
| **INITIALIZE.md loads** | - | ✅ Done | Create terminal with project | INITIALIZE.md content sent | ⏳ |
| **Sidebar resize works** | #031/#038 | ✅ Done | Drag sidebar edge | Sidebar resizes smoothly | ⏳ |
| **Sidebar width persists** | - | ✅ Done | Resize sidebar, close app, reopen | Width stays same | ⏳ |
| **Map tab interactive** | - | ✅ Done | Click map tab, drag panes | Can rearrange/split layout | ⏳ |
| **Problems parse correctly** | - | ✅ Done | Go to Problems tab | Shows issues from PROBLEMS.md | ⏳ |
| **Files tab project filter** | - | ✅ Done | Open workspace from IDE, check Files tab | Shows only selected project files | ⏳ |
| **Terminal messages persist** | #030 | ✅ Done | Create terminal, send message, close app, reopen | Messages appear after restart | ⏳ |

---

## Test Instructions for Terminal Features:

### Step 1: Open Terminal Page
1. Open DeskFlow app
2. Go to **Workspace** tab
3. Select a project from dropdown (or click "Open" on IDE page)
4. Click **Terminal** tab

### Step 2: Create First Terminal
1. Click **+** button in terminal tab bar
2. ⏳ Should see "New Session" dialog with AI selector
3. Select AI type: Claude, OpenCode, or custom
4. Click "Create Terminal"
5. ✅ Pass = Terminal pane appears | ❌ Fail = Nothing happens

### Step 3: Verify Terminal Works
1. Terminal should show system prompt and INITIALIZE.md content
2. Try typing a simple command (e.g., `echo "test"`)
3. Press Enter or click "Send" button
4. ✅ Pass = Command executes | ❌ Fail = No output

### Step 4: Sessions Tab
1. Click **Sessions** tab in sidebar
2. ✅ Pass = Sees running/recent sessions | ❌ Fail = Empty or error

### Step 5: Map Tab (Layout Editor)
1. Click **Map** tab
2. Try dragging a pane (should highlight)
3. Drop on another pane area
4. ✅ Pass = Panes rearrange or split | ❌ Fail = No drag/drop

### Step 6: Persistence Test
1. Close app
2. Reopen DeskFlow
3. Go back to Terminal page
4. ✅ Pass = Terminal state restored | ❌ Fail = Terminal missing/reset

---

## Test Instructions (Original Phases):

### Phase 1: Tracking on App Open
1. Have VS Code (or any app) open first
2. Start the DeskFlow app
3. Timer should show VS Code immediately (not previous app)
4. ✅ Pass = Shows current app | ❌ Fail = Shows wrong app

### Phase 2: Morning Sleep Prompt
1. Close app at night (after 10pm)
2. Reopen app next morning (5am-10am)
3. Should see "Good Morning!" sleep modal
4. ✅ Pass = Modal shows | ❌ Fail = No modal

### Phase 3: View Stats Only
1. Go to External page (/external)
2. Click an activity
3. See Cancel, Start, AND "View Stats Only" buttons
4. ✅ Pass = 3 buttons | ❌ Fail = 2 buttons

---

## Results

### Dashboard & Tracking
| Phase | ✅ Pass | ❌ Fail | Notes |
|-------|--------|--------|-------|
| 1 Tracking | | | |
| 2 Sleep | | |  
| 3 Stats | | | |
| 4 Dashboard | ✅ | | Already work |

### Terminal Workspace (2026-05-12)
| Feature | ✅ Pass | ❌ Fail | Issue # | Notes |
|---------|--------|--------|---------|-------|
| Build passes | ✅ | | - | `npm run build` succeeds |
| Context Management — Setup dialog 6 toggles | | | #124 | Open Setup, verify 6 systems toggle on/off |
| Context Management — SVG map visualization | | | #125 | Context map shows with connections + budget bar |
| Context Management — Behavior toggles | | | #126 | Auto-summarize + Deep memory checkboxes work |
| Context Management — assembleContext wired | | | #127 | Start session with config, verify init content assembled |
| Terminal creation | | | #027 | |
| AI agent selection | | | #035 | |
| Terminal renders | | | - | |
| Session management | | | #025/#028/#033/#034 | |
| Send/Execute | | | #032 | |
| Persistence | | | #029/#030 | |
| Layout editing | | | - | |
| Files filtering | | | - | |
| System prompts | | | - | |

---