# CONTEXT_BUNDLE.md — Dashboard Widget System Revamp (AMENDED)

> Generated: 2026-09-08 · Amended: 2026-09-08 (W-1–W-10)
> Scope: Dynamic widget system for RHEO Dashboard + cross-page widgets
> Level: L2 (Responsive) — useSpring only, no bare spring()
> Constitution: `design/design.md` (LAMINAR) wins over all skill defaults

---

## LAYER 0 — design.md wins (AMENDMENT A)

**Tokens are referenced by ROLE, never hex.** Source of truth: `src/index.css`.

### Color Law (design.md §2)
- Base: `--color-background #09090b`, `--color-card #18181b`, `--color-border #27272a`
- Signal hues (ONE per surface):
  - amber `--color-amber-400` — time-domain surfaces
  - pink `--color-clay-400` brand + `--accent-primary` — Focus/Deep Focus/brand
  - cyan `--ws-accent` — workspace/IDE
  - emerald — success/filled ONLY
  - rose — destructive/error ONLY
- Categorical data-viz: `src/lib/CategoryColors.ts` ONLY

### Typography (design.md §3)
- UI/body: **Inter** (`--font-sans`)
- Display: **Space Grotesk** (`--font-display`)
- Mono/labels/numerics: **JetBrains Mono** (`--font-mono`)
- Max 2 font families per view

### Radii (design.md §4)
- `8px` (sm), `12px` (card, max), `9999px` (pill)
- `rounded-2xl`/`rounded-3xl` BANNED

### Motion (design.md §6)
- Easings: `--ease-out-expo` or `cubic-bezier(0.16,1,0.3,1)`
- Durations: fast 150ms / normal 250ms / slow 400ms
- Page entrance: opacity 0→1, y 16→0, 250ms
- **No decorative infinite loops** (aurora/mesh/shine/border-beam/glow-breathe)
- Honor `prefers-reduced-motion`

### Anti-Slop Blacklist (design.md §7) — HARD GATE
1. Decorative chrome gradient
2. More than one signal hue on a surface
3. `backdrop-blur` glassmorphism on chrome
4. `spring`/`bounce` motion
5. Emoji as icons
6. Neon glow
7. Raw hex/rgba in `.tsx` (use tokens/var())
8. Mixed icon sets (lucide only)
9. Per-component bespoke shadow/radius/border

### Naming (design.md §15)
- RHEO everywhere in user-visible strings
- `window.deskflowAPI` referenced as-is (rename is separate debt)

---

## Bundle Integrity Report (AMENDMENT J)

| File | Bundle Claimed | Real (wc -l) | Status |
|------|---------------|--------------|--------|
| DeadlinesCard.tsx | 41021 | **815** | Bundle was wrong |
| GoalsCard.tsx | 33262 | **673** | Bundle was wrong |
| ScheduleCard.tsx | 24851 | **465** | Bundle was wrong |
| PinnedActivities.tsx | 14329 | **280** | Bundle was wrong |
| StatusBand.tsx | 281 | **281** | Correct |
| DashboardPage.tsx | 2853 | **2853** | Correct |

**Rule: code wins. Zero trust in bundle metadata.**

---

## Project Structure (VERIFIED)

**DashboardPage.tsx** (2853 lines) — Main landing page
**Dashboard sub-components** (`src/pages/dashboard/`):
- StatusBand.tsx (281), ScheduleCard.tsx (465), PinnedActivities.tsx (280), InsightStrip.tsx (90), TierBreakdownStrip.tsx (90), SummaryStrip.tsx (192), HeroBand.tsx (76), Sparkline.tsx (81), StopwatchTimer.tsx (342), ProductivityFocusZone.tsx (153)

**Dashboard components** (`src/components/dashboard/`):
- GoalsCard.tsx (673), DeadlinesCard.tsx (815), LongestFocusCard.tsx (196), MomentumHero.tsx (193), MasteryRingMini.tsx (61), StreakCard.tsx (151), StreakBadge.tsx (99), InsightsCard.tsx (168), ScheduleSyncCard.tsx (121), DailySurveyCard.tsx (211), MomentumScore.tsx (228), MomentumOrb.tsx (167), FinanceOverviewSection.tsx (150), UnifiedGoalsCard.tsx (235), useDashboardData.ts (344), types.ts (114), BlurText.tsx (79), SpotlightCard.tsx (61), DrillDownCard.tsx (43), TimerResetOverlay.tsx (96)

**UI components** (`src/components/ui/`):
- card.tsx, glass-card.tsx, magic-card.tsx, neon-gradient-card.tsx, blur-fade.tsx, number-ticker.tsx, skeleton.tsx, empty-state.tsx, section-header.tsx, animated-circular-progress-bar.tsx, v-calendar.tsx

---

## Data Flow (DashboardPage)

| Data | Source | IPC/Hook |
|------|--------|----------|
| Goals | `get-goals` IPC | `useDashboardData()` |
| Deadlines | `get-deadlines` IPC | `useDashboardData()` |
| Schedule | `getSchedule` IPC | `useDashboardData()` |
| Overview stats | `getDashboardAggregates` IPC | `api.getDashboardAggregates()` |
| Activity feed | `getDashboardAggregates` | `recentSessions` |
| Mastery | `learn_getProfile` | setState |
| Sleep | `external_sessions` | `api.getInsightStrip` |
| Focus | `useHomeSummary` hook | `homeSummary` |
| Unfilled time | `detectUsageGaps` IPC | `detectUsageGaps` |

---

## IPC Channels (VERIFIED from preload.ts)

```typescript
// Preferences (persistence — AMENDMENT C)
getPreferences: () => ipcRenderer.invoke('get-preferences')
setPreference: (key: string, value: any) => ipcRenderer.invoke('set-preference', key, value)

// Goals
getGoals: (date: string) => Promise<{ goals: Goal[] }>
saveGoal: (date: string, goal: Goal) => Promise<{ success: boolean }>
deleteGoal: (id: string) => Promise<{ success: boolean }>

// Deadlines
getDeadlines: (params: { days?: number }) => Promise<{ deadlines: Deadline[] }>

// Schedule
getSchedule: () => Promise<{ entries: ScheduleEntry[] }>

// Dashboard
getDashboardAggregates: ({ period, dateOffset, weekOffset }) => Promise<OverviewData>
getLongestFocus: () => Promise<{ today: [], week: [], allTime: [] }>
getInsightStrip: ({ period }) => Promise<{ insights: Insight[] }>
detectUsageGaps: ({ period, minGapMinutes }) => Promise<GapData[]>
```

---

## All Pages & Widget Candidates (AMENDMENT D)

### KEPT (phased)

| Phase | Widget ID | Name | Icon | Data Source |
|-------|-----------|------|------|-------------|
| WS-1 | status-band | Status Band | Activity | Timer state |
| WS-1 | schedule-hero | Schedule Hero | Calendar | getSchedule |
| WS-1 | insight-strip | AI Insights | Sparkles | getInsightStrip |
| WS-1 | goals-card | Goals | Target | get-goals |
| WS-1 | deadlines-card | Deadlines | AlertCircle | get-deadlines |
| WS-1 | focus-card | Deep Focus | Zap | useDeepFocus |
| WS-1 | tier-breakdown | Tier Breakdown | BarChart3 | getDashboardAggregates |
| WS-1 | productivity-chart | Productivity Chart | TrendingUp | getDashboardAggregates |
| WS-1 | sleep-bar | Sleep | Moon | external_sessions |
| WS-1 | mastery-ring | Mastery | Brain | learn_progress |
| WS-1 | app-ecosystem | App Ecosystem | Orbit | getDashboardAggregates |
| WS-1 | activity-feed | Recent Sessions | Clock | recentSessions |
| WS-1 | momentum-hero | Momentum | Flame | MomentumScore |
| WS-1 | follow-through | Follow Through | ArrowRight | Finance IPC |
| WS-1 | vcalendar | Calendar | CalendarDays | VCalendar (real) |
| WS-1 | pinned-activities | Pinned | Pin | PinnedActivities |
| WS-2 | app-table | App Statistics | Table | App stats IPC |
| WS-2 | category-chart | Category Chart | PieChart | Category data |
| WS-2 | top-apps | Top Apps | Trophy | Top apps IPC |
| WS-2 | session-list | Session History | Clock | Session list IPC |
| WS-2 | day-heatmap | Day Heatmap | Grid | weeklyHeatmap |
| WS-2 | sleep-chart | Sleep Chart | Moon | Sleep data |
| WS-2 | activity-breakdown | Activity Breakdown | BarChart3 | Activity data |
| WS-2 | focus-timer | Focus Timer | Timer | useDeepFocus |
| WS-2 | category-dist | Category Distribution | PieChart | Category data |
| WS-2 | site-timeline | Site Timeline | Clock | Browser activity |
| WS-2 | site-categories | Site Categories | Tag | Site categories |
| WS-2 | workspace-analytics | Workspace Analytics | Chart | Analytics IPC |
| WS-2 | agent-status | Agent Status | Bot | Agent states |
| WS-2 | wallet-health | Wallet Health | Wallet | Finance IPC |
| WS-2 | transactions | Transactions | Receipt | Transaction IPC |
| WS-2 | data-analytics | Data Analytics | Database | Analytics IPC |
| WS-2 | data-tables | Data Tables | Table | DB tables IPC |

### FROZEN (needs data lift — AMENDMENT D)

| Widget | Reason |
|--------|--------|
| streak-card | Sourced from component-local state (streak calc) |
| goal-progress | Sourced from component-local state |
| goal-streak | Sourced from component-local state |
| live-tracking | Sourced from component-local state |
| terminal-presets | Sourced from component-local state |
| budget-tracker | Sourced from component-local state |

### REJECTED (AMENDMENT D)

| Widget | Reason |
|--------|--------|
| category-manager | Config surface, not data (§16) |
| tracking-prefs | Config surface, not data |
| color-picker | Config surface, not data |

---

## Persistence (AMENDMENT C)

**Preference store, single source.** No localStorage.

```typescript
// Key: 'dashboard_layout'
interface DashboardLayoutConfig {
  schemaVersion: number;       // for migrations
  columns: number;             // 1-5
  rows: number;                // 1-3
  widgetOrder: string[];       // ordered widget IDs
  widgetVisibility: Record<string, boolean>;
  gridPositions: Record<string, { col: number; row: number; colSpan: number; rowSpan: number }>;
}
```

**Preload bridge**: `setPreference('dashboard_layout', config)` / `getPreferences().dashboard_layout`

---

## Motion Spec (AMENDMENT B)

- Entrance: opacity 0→1 + translateY 16→0, 220ms, LAMINAR easing, stagger 45ms
- Hover: border-color/bg shift 140ms
- NO `whileHover` scale, NO `translateY(-2px)` lift without border emphasis
- Drag: grabbed card gets hairline emphasis + elevation via border, 140ms; drop = FLIP via `layout` prop
- Edit-mode transitions: AnimatePresence, 140–180ms
- NumberTicker: ONLY where value changes on data refresh
- RM: entrance and drag-layout snap; edit mode fully usable without motion

---

## Slop Bans in New Code (AMENDMENT I)

- NeonGradientCard, AuroraText, BorderBeam, MagicCard — BANNED
- Any backdrop-blur — BANNED
- Any box-shadow elevation — BANNED
- Spring physics — BANNED
- Icons: lucide only
- RHEO naming everywhere

---

## Verification Law (AMENDMENT G)

- Probe MCP: dev-time interaction only
- Gates:
  - G1: tsc zero outside docs/debt.md
  - G2: clean rebuild — delete dist/ FIRST
  - G3: shell-launch (_electron.launch, xvfb on Linux) — default layout renders, edit mode works
  - G4: keyboard — every drag/resize/visibility op has keyboard equivalent
  - G5: console clean
  - G6: screenshots — default parity, edit mode, RM, 375/1280/1920
  - G7: commit per phase

---

## Phases (AMENDMENT H)

- **WS-1**: registry + WidgetGrid + WidgetCard + edit mode + persistence + 16 existing dashboard widgets (default parity)
- **WS-2**: cross-page data widgets + factory script
- **WS-3**: "needs lift" appendix items after their data lifts

---

*End of Amended Context Bundle*
