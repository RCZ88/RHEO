# Context Bundle — Focus Groups Feature

> Purpose: gives the target AI (which has NO file access to the project) everything it
> needs — real source code, IPC surface, DB schema, types, and existing UI wiring — to
> implement the Focus Groups feature as specified in PROMPT.md. All code below is
> verbatim from `App Tracker` (a.k.a. "RHEO" in workspace memory). DO NOT invent
> shapes that differ from what is shown here; match the existing patterns exactly.

## 1. App identity & design language

- Product: Desktop productivity/activity tracker, Electron + React + better-sqlite3, Vite build.
- Branding token mismatch to be aware of: `src/components/ai/tokens.ts` brands the surface as
  "DeskFlow", while workspace memory calls the app "RHEO". They are the same product. When
  the prompt refers to `DeskFlow`, it == `RHEO`.
- Theme: **dark only**. Tailwind v3 + CSS variables under `canvas.css`.
- Surface style (`canvas.css`): glassmorphism. Cards use
  `bg-[rgba(24,24,27,0.60)]` + `backdrop-blur-xl` + `border border-zinc-800/60`;
  headings/title bars use `bg-[#18181b]`-ish or `var(--dk-bg-raised)`.
- Radius: `rounded-xl` (sections/cards), `rounded-lg` (buttons/controls).
- Fonts: headings/numbers Jetbrains Mono / `font-mono` (`tabular-nums`), body Inter/Geist.
- Accent palette (cyan→violet family, used across the app):
  - cyan-500 `#22d3ee` → emerald-400 `#4ade80` (productivity/complete)
  - amber-300 `#fbbf24` / amber-400 `#fbbf24` (warnings/suggested)
  - rose-400 `#f87171` (danger/break)
  - violet-400 `#a78bfa` (AI/accent)
  - pink-400 `#ec4899` (Deep Focus feature — the focus tab accent is `#ec4899`)
- Existing color-var shorthand used in CSS: `var(--dk-accent)` (== cyan-500),
  `var(--dk-bg-raised)`, `var(--dk-bg-surface)`, `var(--dk-border-default)`,
  `var(--dk-border-subtle)`, `var(--dk-text-primary)`, `var(--dk-text-faint)`,
  `var(--dk-success)` (#4ade80), `var(--dk-danger)`.

## 2. Project layout (what the receiving AI will touch)

```
src/
  domains/focus/             # NEW Focus Groups live here (storage + manager)
    focusManager.ts          # existing FocusManager (enforces allowed apps/domains during a session)
    focusSchema.ts           # existing schema (deep_focus_sessions, deep_focus_events)
    focusGroupManager.ts     # <-- NEW (to create)
  hooks/
    useFocusSession.ts       # existing focus session hook (state/history/start/stop)
    useFocusGoals.ts         # BROKEN against current backend — see §6
    useDailyGoals.ts         # existing daily goals CRUD hook
    useGoalProgress.ts       # existing goal-progress-by-category hook (authoritative)
    useFocusGroups.ts        # <-- NEW (to create)
    useDragDuration.ts       # <-- NEW (to create)  — drag-to-set duration
  services/
    GoalStore.ts             # existing Goal type + localStorage goal store
  components/
    focus/
      FocusSection.tsx       # existing — the Deep Focus UI (ActivityPage focus tab)
      FocusTimer.tsx         # existing — presets + start/stop + strict modes
      focusHelpers.ts        # existing — FocusHistoryRow, fmtClock, computeTodayStats, computeStreak
      FocusGroupSelector.tsx # <-- NEW (to create) — choose/edit a focus group
      FocusGroupEditor.tsx   # <-- NEW (to create) — edit a group (apps/domains/tiers)
      DragDurationBar.tsx    # <-- NEW (to create) — drag-to-set session minutes
    dashboard/
      QuickFocusCard.tsx     # existing — dashboard hero focus card
    focus/FocusSessionCard.tsx   # existing
    focus/FocusManager.tsx       # exists? (grep hit) — treat as alias; use FocusSection/FocusTimer
  pages/
    ActivityPage.tsx         # existing — focus is a LAZY tab here (FocusSection)
    FocusPage.tsx            # existing but DEAD IMPORT (see §7)
    AiPage.tsx               # existing — lazy-loads DailyPlannerCard (canvas card)
  components/ai/canvas/cards/
    DailyPlannerCard.tsx     # existing — goals list + startFocus helper; integrates focus+goals
    GoalTimeline.tsx         # exists
    GoalProgressBar.tsx      # exists
    GoalItem.tsx            # exists
  main.ts                    # existing — focus + goal IPC handlers
  preload.ts                 # existing — deskflowAPI contextBridge
  services/ai/goalContext.ts # <-- check existence; provides suggest-goals / goal-context
```

## 3. The Goal type (AUTHORITATIVE — single source: `src/services/GoalStore.ts`)

```typescript
export type GoalCategory = 'work' | 'personal' | 'health' | 'learning';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type GoalStatus = 'suggested' | 'pending' | 'in-progress' | 'completed' | 'overdue' | 'slipped' | 'dismissed';

export interface GoalTarget {
  type: 'time' | 'completion';
  targetSeconds?: number;
  matchCategory?: string;
  matchApps?: string[];
  done?: boolean;
}
export interface GoalLink { label: string; url: string; }

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target: GoalTarget;
  period: GoalPeriod;
  status: GoalStatus;
  date: string;                 // ISO date YYYY-MM-DD (per-day goals)
  source: 'ai' | 'manual';
  links: GoalLink[];
  progressSeconds?: number;
  createdAt: string;
  completedAt?: string;
}
```

> ⚠️ IMPORTANT — goal-shape reconciliation. Two incompatible shapes appear in the repo:
> 1. `GOALSTORE` shape above (nested camelCase): `goal.target.type`, `goal.target.matchCategory`,
>    `goal.target.targetSeconds`, `goal.progressSeconds`. Used by `useGoalProgress.ts`,
>    `useDailyGoals.ts`, `DailyPlannerCard.tsx`, `GoalStore.ts`, and `main.ts` `save-goal`.
> 2. A flat snake_case shape (`goal.target_type`, `goal.match_category`, `goal.target_seconds`,
>    `goal.progress_seconds`) appearing ONLY in the legacy `RESULT.md`/`PROMPT.md` of the
>    `daily-goals-planner` generate-prompt-docs folder.
>
> The flat snake_case shape does NOT match the live code. Use the **nested camelCase
> GoalStore shape** everywhere in the new code.

## 4. Focus IPC surface (`src/preload.ts`, deskflowAPI contextBridge)

```typescript
// focus sub-object
focus: {
  start: (cfg: { durationSec: number; strictness?: 'distracting' | 'non_allowed'; allowed?: { apps?: string[]; domains?: string[]; tiers?: ('productive'|'neutral'|'distracting')[] } }) => ipcRenderer.invoke('focus:start', cfg),
  end: (outcome?: 'aborted') => ipcRenderer.invoke('focus:end', outcome),
  getState: () => ipcRenderer.invoke('focus:get-state'),
  history: (opts?: { limit?: number }) => ipcRenderer.invoke('focus:history', opts),
  onState: (cb: (s: FocusPublicState | null) => void) => ipcRenderer.on('focus:state', (_, s) => cb(s)),
  onEnded: (cb: (r: { outcome: string; reason: string | null }) => void) => ipcRenderer.on('focus:ended', (_, r) => cb(r)),
},
// goals sub-object
getGoals: (date: string) => ipcRenderer.invoke('get-goals', date),
getGoalsBatch: (startDate: string, endDate: string) => ipcRenderer.invoke('get-goals-batch', startDate, endDate),
getLongtermGoals: () => ipcRenderer.invoke('get-longterm-goals'),
saveGoal: (date: string, goal: any) => ipcRenderer.invoke('save-goal', date, goal),
saveGoalReview: (date: string, reviewSummary: string) => ipcRenderer.invoke('save-goal-review', date, reviewSummary),
getGoalReview: (date: string) => ipcRenderer.invoke('get-goal-review', date),
saveGoalSuggestion: (data: any) => ipcRenderer.invoke('save-goal-suggestion', data),
getGoalContext: () => ipcRenderer.invoke('get-goal-context'),
suggestGoals: (date: string, ctx: string) => ipcRenderer.invoke('suggest-goals', date, ctx),
// activity logs (used for progress aggregation by category)
['get-logs-by-period']: (opts: { period: 'day' | 'week' | 'month'; dateOffset?: number }) => ipcRenderer.invoke('get-logs-by-period', opts),
```

### `FocusPublicState` (as returned by `FocusManager.getPublicState()` in `main.ts`/`focusManager.ts`)

```typescript
interface FocusPublicState {
  active: boolean;
  endsAt: number | null;      // epoch ms
  remainingSec: number;
  strictness: 'distracting' | 'non_allowed';
  paused: boolean;
}
```

> ⚠️ CRITICAL GAP: `focusManager.ts#getPublicState()` returns ONLY the 5 fields above. It does
> NOT return `id`, `outcome`, `allowed_json`, `started_at`, or `broke_on_type`. But the existing
> `useFocusGoals.ts` reads `state.outcome`, `state.allowed_json`, `state.broke_on_type`,
> `state.id`, `state.started_at` — so **`useFocusGoals.ts` is currently non-functional**.
> The receiving AI MUST make the focus state the source of truth for goal-progress
> accumulation during a session and must NOT depend on fields that are not in
> `FocusPublicState`. The intended linkage is: when a focus session starts with a group,
> the group's categories must be recoverable so matching goals can be credited. See §6.

## 5. Existing FocusManager behavior (verbatim, from `src/domains/focus/focusManager.ts`)

```typescript
import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import type Database from 'better-sqlite3';
import { ensureFocusSchema } from './focusSchema';

export type Tier = 'productive' | 'neutral' | 'distracting';
export type Strictness = 'distracting' | 'non_allowed';

export interface FocusConfig {
  durationSec: number;
  strictness?: Strictness;
  allowed?: { apps?: string[]; domains?: string[]; tiers?: Tier[] };
}

interface FocusState {
  active: boolean; sessionId: number | null;
  startedAt: number | null; endsAt: number | null;
  strictness: Strictness;
  allowed: { apps: string[]; domains: string[]; tiers: Tier[] };
  returnCount: number; paused: boolean;
}

export class FocusManager {
  private state: FocusState = this.idle();
  private overlay: BrowserWindow | null = null;
  private endTimer: NodeJS.Timeout | null = null;
  private current: { type: 'app' | 'website'; name: string } | null = null;
  private overlayHideTimer: NodeJS.Timeout | null = null;

  constructor(
    private db: Database.Database,
    private getMainWindow: () => BrowserWindow | null,
    private classifyApp: (appName: string, category?: string) => Tier,
    private classifyDomain: (domain: string) => Tier,
    private token: string,
  ) {
    ensureFocusSchema(db);
    this.registerIpc();
  }

  private idle(): FocusState {
    return { active: false, sessionId: null, startedAt: null, endsAt: null,
      strictness: 'distracting',
      allowed: { apps: [], domains: [], tiers: ['productive', 'neutral'] },
      returnCount: 0, paused: false };
  }

  getPublicState() {
    return {
      active: this.state.active,
      endsAt: this.state.endsAt,
      strictness: this.state.strictness,
      remainingSec: this.state.endsAt
        ? Math.max(0, Math.round((this.state.endsAt - Date.now()) / 1000))
        : 0,
      paused: this.state.paused,
    };
  }

  // start(cfg): inserts deep_focus_sessions row with allowed_json = JSON.stringify(allowed)
  // isStopwatch when durationSec===0 ; auto-complete timer when >0
  // onForegroundApp / onWebActivity classify via classifyApp/classifyDomain and decide allowed
  // isAllowed: app match by name in allowed.apps ; domain match in allowed.domains ;
  //   strictness 'non_allowed' => only allowed.tiers ; else block only 'distracting' tier
  // breakFocus(source,name) -> end('failed', `${source}:${name}`)
  // returnToFocus() -> show overlay 2s then hide + refocus main
  // end(outcome, reason) -> UPDATE deep_focus_sessions {...}, pushState(), send 'focus:ended'
  // private pushState() -> webContents.send('focus:state', getPublicState())
  // registerIpc(): focus:start, focus:end, focus:get-state, focus:history, focus:overlay-return, focus:overlay-break
}
```

### `main.ts` focus wiring (how the FocusManager is constructed & hooked into the global tracker)

```typescript
// main.ts (excerpt — search "FocusManager" / "focus:start" registration)
// FocusManager is constructed with a `classifyApp`/`classifyDomain` that map app/window
// names to Tier using TIER_ASSIGNMENTS (productive/neutral/distracting) from userPreferences.
// onForegroundApp is invoked from the foreground-change pipeline so a focus session can
// surface the overlay when the user switches to a non-allowed app.
ipcMain.handle('focus:start', (_e, cfg: FocusConfig) => focusManager.start(cfg));
ipcMain.handle('focus:end', (_e, outcome?: 'aborted') => focusManager.end(outcome ?? 'aborted', 'user'));
ipcMain.handle('focus:get-state', () => focusManager.getPublicState());
ipcMain.handle('focus:history', (_e, opts?: { limit?: number }) => focusManager.history(opts?.limit ?? 50));
ipcMain.on('focus:overlay-return', () => focusManager.returnToFocus());
ipcMain.on('focus:overlay-break', () => focusManager.breakFocus(/* current type/name */));
// focus:state is PUSHED on start/end/break/return; focus:ended is PUSHED on session end.
```

## 6. The existing (BROKEN) `useFocusGoals.ts` — must be fixed, not copied blindly

The file at `src/hooks/useFocusGoals.ts` reads fields that `getPublicState()` does NOT return
(`outcome`, `allowed_json`, `broke_on_type`, `id`, `started_at`). This is the focus<->goals
bridge the new feature needs. The receiving AI must either (a) extend `getPublicState()` /
`focus:state` payload to include `allowed_json` and `outcome`/`id` so goal attribution works,
or (b) track focus-group attribution through a separate channel. Either approach must keep the
GoalStore camelCase goal shape consistent.

## 7. Existing focus UI wiring (verbatim where it matters)

### `src/features/focus/FocusSection.tsx`
```typescript
import { useEffect, useState } from 'react';
import { Focus as FocusIcon } from 'lucide-react';
import { SectionHeader } from '../../components/SectionHeader';
import { LoadingState } from '../../components/LoadingState';
import { useFocusSession } from '../../hooks/useFocusSession';
import { FocusTimer } from './FocusTimer';
import { FocusStats } from './FocusStats';
import { FocusHistory } from './FocusHistory';
import { FocusInsights } from './FocusInsights';
import { FocusLeaderboard } from './FocusLeaderboard';
import { FocusDistractionLog } from './FocusDistractionLog';
import { computeTodayStats, computeStreak, type FocusHistoryRow } from './focusHelpers';

type FocusMode = 'timer' | 'stopwatch';

export function FocusSection() {
  const { state, history, start, stop } = useFocusSession();
  const [mins, setMins] = useState(25);
  const [strict, setStrict] = useState<'distracting' | 'non_allowed'>('distracting');
  const [justCompleted, setJustCompleted] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [mode, setMode] = useState<FocusMode>('timer');
  const [distractions, setDistractions] = useState<...>([]);

  useEffect(() => { setApiMissing(!window?.deskflowAPI?.focus); }, []);
  useEffect(() => {
    if (!state) return;
    if (!state.active && history[0]?.outcome === 'completed') {
      setJustCompleted(true); setTimeout(() => setJustCompleted(false), 4000);
    }
  }, [state, history]);

  const handleStart = () => start(mins * 60, strict);   // <-- FocusGroupSelector must feed allowed here
  const handleStop = () => stop();
  // layout: lg:grid lg:grid-cols-3 — col 1 = <FocusTimer>, cols 2-3 = stats/history/insights
}
```

### `src/features/focus/FocusTimer.tsx` (the drag-to-set target — replace preset chips or augment)
- `PRESETS = [5,10,15,25,50,90] m` (constants, line 12-19).
- Props: `state, mins, onMinsChange, strict, onStrictChange, onStart, onStop, justCompleted, mode?, onModeChange?, stopwatchElapsed?`.
- Timer mode = count-down circular progress (AnimatedCircularProgressBar + NumberTicker fmtClock).
- Stopwatch mode ("Challenge") = count-up.
- `onStart` → `start(mins*60, strict)`.
- Uses `GlassCard accent="pink"`, `Particles`, `AnimatedCircularProgressBar`, `NumberTicker`.
- The "drag to set time" requirement must be added here (or a new `DragDurationBar` wired into FocusTimer).

### `src/components/ai/canvas/cards/DailyPlannerCard.tsx` (the goals↔focus integration surface)
- Already calls `useGoalProgress(date, goals)` and `useFocusGoals(goals)`.
- `startFocus(goal)` currently: `api.focus.start({ durationSec: target - progress, strictness: 'distracting' })`
  — **this is where a focus group must be selected/passed**: `allowed: { tiers:['productive','neutral'] }`
  plus the group's matched category so `useGoalProgress`/`useFocusGoals` can credit the goal.
- Goal list renders `GoalItem` with `onFocus={goal.target?.type==='time' && goal.target?.matchCategory ? startFocus : undefined}`.

### `src/components/focus/QuickFocusCard.tsx`
- Dashboard hero card. `onStart(durationSec, strictness)` (no allowed currently).
- Also a candidate to gain a group selector + drag-duration.

### `src/hooks/useFocusSession.ts`
```typescript
export interface FocusPublicState { active; endsAt; remainingSec; strictness; paused; }
export function useFocusSession() {
  // state via getState()+onState push; history via focus:history; start(durationSec,strictness)
  return { state, history, start, stop, refreshHistory };
}
```

### `src/hooks/useGoalProgress.ts` (authoritative progress-by-category)
```typescript
// timeBasedGoals = goals.filter(g => g.target?.type === 'time' && g.target?.matchCategory)
// aggregates logs category→seconds (lowercase) via get-logs-by-period({period:'day',dateOffset:0}) or DB query
// status: completed|active|pending ; target clamp 1..86400 ; pct clamp 0..100
```

## 8. ActivityPage.tsx — the focus tab host (ActivityPage mounts FocusSection as a lazy tab)

```typescript
const FocusTab = lazy(() => import('../features/focus/FocusSection').then(m => ({ default: m.FocusSection })));
// in the sub-tab array (accent #ec4899):
{ key: 'focus', label: 'Focus', icon: FocusIcon, accent: '#ec4899' },
// render:
{activeTab === 'focus' && (
  <Suspense fallback={<LoadingState variant="skeleton" className="h-48" />} key="focus">
    <FocusTab />
  </Suspense>
)}
```

## 9. FocusPage.tsx — DEAD IMPORT (must NOT be used as the integration target unless explicitly wired)

- `FocusPage` (line 57) is imported in `App.tsx` line 33 but is **never rendered** in any
  `<Route>` and has **no `/focus` route** (App.tsx routes confirmed: `/`, `/activity`,
  `/stats`(→/activity?tab=apps), `/productivity`, `/browser`, `/ide`, `/external`, `/ai`,
  `/finance`, `/reports`, `/database`, `/settings`, `/life`, `/learn`, `/conductor`,
  `/terminal`, `/guide`... + catch-all).
- FocusPage is actually a **daily-goals planner CRUD page** (categories work/personal/health/learning,
  add/toggle/delete, streak + confetti on complete) — i.e. it is the un-routed "goals planner".
- Therefore the Focus Groups feature UI should attach to the LIVE `FocusSection`/`FocusTimer`
  inside `ActivityPage` (the `/activity?tab=focus` tab), NOT to `FocusPage`.

## 10. Existing design-system CSS tokens (`canvas.css`) — re-skin rules (copy verbatim style)

```
--dk-bg-deep: #0a0a0b
--dk-bg-raised: rgba(24,24,27,0.60)   (≈ bg-zinc-900/60)
--dk-bg-surface: rgba(24,24,27,0.90)
--dk-border-default: rgba(255,255,255,0.12)
--dk-border-subtle:  rgba(255,255,255,0.06)
--dk-accent: #22d3ee  (cyan-500)
--dk-accent-dim: rgba(34,211,238,0.10)
--dk-success: #4ade80  (green-400)
--dk-danger:  #f87171  (red-400)
--dk-text-primary: #fafafa
--dk-text-secondary: #e4e4e7
--dk-text-faint: #71717a
--dk-radius-sm: 6px
--dk-radius-md: 10px
--dk-radius-xl: 16px
--dk-fast: 150ms   --dk-normal: 250ms  --dk-ease: cubic-bezier(0.22,1,0.35,0)
```
Re-skin rule for any new component: `bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/60 rounded-xl`,
title accent `--dk-accent` (cyan) unless it belongs to the Focus domain (pink `#ec4899`),
numbers in `font-mono tabular-nums`.

## 11. Real component inventory (queried from MCP — do not invent, name these exactly)

shadcn/ui v4 (installed; from `shadcn-ui-mcp_list_components`):
`accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar,
card, chart, checkbox, collapsible, combobox, command, dialog, drawer, form, hover-card, input,
label, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet,
sidebar, skeleton, slider, switch, table, tabs, textarea, toggle, tooltip` (+ `sonner`, `spinner`).

Magic UI (available via `@magicuidesign/mcp`, queried live — relevant subset):
`animated-beam, animated-circular-progress-bar, animated-gradient-text, border-beam, bento-grid,
confetti, dot-pattern, glare-hover, magic-card, marquee, meteors, neon-gradient-card, number-ticker,
particles, shimmer-button, sparkles-text, text-reveal`.
(Use `magicui_getRegistryItem` on these exact names to fetch source.)

ReactBits (available; queried live): 135+ components across `animations, backgrounds, icons,
texts, components` — full list via `reactbits_list_components` (categories endpoint). Use
`reactbits_get_component` for e.g. `splash-cursor`, `pixel-card`, etc., by exact slug.

Lucide (installed via `lucide-react`): 1500+ icons. Use `google-design-mcp_search_icons`
before naming an icon; relevant: `Timer` (stopwatch countdown), `Clock` (challenge mode),
`Target`, `Flag`, `Plus`, `Trash2`, `Edit`, `GripVertical` (drag grip), `Check`, `Bookmark`,
`Shield`, `ShieldCheck`, `Layers`, `Grid3x3`, `Pause`, `RefreshCw`, `AlertCircle`.

## 12. Human-Centered UX requirements (from `humancentred-UIUX` skill — mandatory coverage)

Every new UI must cover ALL of:
- **Empty state**: no focus groups yet → call-to-action (create first group).
- **Loading state**: skeleton / spinner while fetching groups/sessions.
- **Error state**: API missing, save failed → inline message + retry.
- **Populated state**: list of groups with selection + edit + delete.
- **Feedback**: every click shows immediate visual state (hover/focus ring, disabled style).
- **Accessibility**: keyboard nav, `aria-label`s on icon buttons, `title`s, contrast ≥ 4.5:1.
- **Transitions**: `framer-motion` crossfades / `AnimatePresence` for modal/drawers (mirror
  existing FocusTimer patterns).
- **Animations**: subtle only — `motion` tap scale on buttons; `Particles`/`BorderBeam`
  reserved for active-focus state (do NOT overuse on every card).

## 13. Constraints (non-negotiable)

- No new npm dependencies (use only installed shadcn / MagicUI / ReactBits / lucide / framer-motion).
- All SQL parameterized (`?` placeholders); no string interpolation.
- Dark mode only; use the `--dk-*` tokens above (no new colors invented).
- Must degrade gracefully when offline/AI unavailable.
- Files are CRLF — preserve line endings on edit.
- `useGoalProgress.ts` (renderer) and `main.ts` `get-daily-goal-progress` are the two
  progress computation paths — keep them consistent (nested camelCase goal shape).

---

*End of Context Bundle. The implementation spec lives in `PROMPT.md` in the same folder.*
