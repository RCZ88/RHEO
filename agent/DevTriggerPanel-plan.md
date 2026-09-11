# DevTrigger Panel — plan

## Goal
A dev-only control surface in the running app that lets you open, inject, and schedule every auto-trigger popup/behavior without waiting for real conditions (sleep, idle, visibility gaps, etc.). Also exposes current armed-state so you can see WHY a popup did or didn't fire.

## Scope (what the panel controls)

### Popups with explicit React state in App.tsx
| Popup | State / trigger | Entry point in App.tsx |
|---|---|---|
| SleepDetectionModal | `showSleepDetection` + `sleepDetectionData` + `sleepModalStep` | mount check (864), onSleepDetection listener (913), visibility/focus (941) |
| AfkPromptModal | `afkPromptQueue.length>0` | idleReturnFnRef.current on activity return (1857); persisted queue restore (890) |
| Sleep GapFillModal | `sleepGapFillTarget` | opened from SleepDetectionModal gaps step |
| Afk GapFillModal | `afkGapFillTarget` | opened from AfkPromptModal gaps button |
| Smart Fill Modal | `smartFillGaps` + `smartFillSource` | top-bar "Smart Fill" button (2734) + `open-gap-drawer`/`open-gap-panel` events |
| ManualAssignModal | `showManualAssign` | top-bar Smart Fill button (2735) |
| PairPhoneModal | `pairPhoneModal` | `open-pair-modal` custom event (1576) |
| ConfirmExportModal | `showConfirmExport` | export flow |
| ConfirmClearModal | `showConfirmClear` | settings/data clear flow |
| AiSummaryModal | `showSummary` | AI summary trigger |
| GapBanner | `showGapBannerSetting && unfilledMinutes>0` | banner render (2570); dismissed via setPreference |
| NotifPanel | `notifPanelOpen` | bell button |
| GlobalSearchCommandPalette | `paletteOpen` | ⌘K / Ctrl+K |
| WorkspaceWarning | `showWorkspaceWarning` | workspace nav guard |
| UnsavedWarning | `showUnsavedWarning` | unsaved-changes guard |
| TutorialOverlay | (mounted) | tutorial flow |

### Behaviors without a modal (still worth a dev control)
- Sleep detection "fire now" — call `checkSleepDetection()` + optionally auto-confirm with custom times
- AFK idle entry injection — push a synthetic `AfkPromptEntry` into `afkPromptQueue` with chosen idle duration / defaultNotAfk
- Gap detection refresh — re-run `detectUsageGaps` / `computeAdjacentGaps` and preview results in-panel
- Gap banner force-show — set `unfilledMinutes` artificially so banner renders even with no real gaps
- Tracking toggle — pause/resume without clicking the top bar

## Features (v1 — ship these)

### 1. Popup trigger grid
One row per controlled popup:
- Label + small icon
- "Open now" button that sets the React state to show it
- For popups that need data (sleep, AFK, gaps): a "prep + open" variant that first injects the required state/data, then opens

### 2. Data injectors (per popup that needs them)
- **Sleep**: editable bedtime/waketime/fell-asleep/wake-up/date; "Run detection" calls IPC `checkSleepDetection`; "Confirm with these times" runs `confirmSleep` with the edited times; preview `adjacentGaps` from `computeAdjacentGaps`
- **AFK**: editable idle duration (minutes), return time, defaultNotAfk toggle; "Inject AFK entry" pushes a synthetic entry into `afkPromptQueue` (uses `afkQueueIdRef` for id); queue viewer shows current entries
- **Gaps**: editable minGapMinutes; "Detect gaps" runs `detectUsageGaps` (today/week/month) and shows the result array in-panel; "Use these gaps" sets `smartFillGaps` + source so the Smart Fill modal opens populated; "Fill sleep/afk gaps" sets the respective gap-target states

### 3. Schedule panel
- One or more scheduled fires, each with: target popup, delay in seconds, optional data injector to run first
- Simple list: "in 10s → open SleepDetectionModal with custom times"
- Runs once (not recurring) to avoid runaway timers; cancel button per entry + clear all

### 4. Live armed-state snapshot
Read-only panel showing current values of the key states so you can tell why something didn't fire:
- `showSleepDetection`, `sleepModalStep`, `sleepDetectionData` present?
- `afkPromptQueue` length + first entry details
- `smartFillGaps` / `smartFillSource`
- `showGapBannerSetting`, `unfilledMinutes`, `gapCount`
- `isIdle`, `isTracking`, `pendingIdleRangeRef` (approximate — expose via a ref read helper)
- `sleepActiveRef`, `sleepPeriodRef`

### 5. Tension-release helpers
- "Dismiss all" — clears every popup state at once (sleep, afk queue, gap targets, smart fill, modals, banner)
- "Reset AFK queue" — clears persisted + in-memory AFK queue
- "Reload detection data" — re-runs sleep check + gap detect and refreshes the snapshot

## UI plan
- Single modal, `z-[10000]` (above everything, same level as the gap-fill modals)
- Header: "DevTrigger" + close X + a "Detach" toggle that keeps it open across page nav (state lifted in App.tsx so it survives route changes; only hidden when explicitly closed)
- Three tabs:
  1. **Fire** — popup trigger grid (the main view)
  2. **Inject** — data editors + detect buttons grouped by popup (sleep / afk / gaps)
  3. **Schedule + State** — schedule list on top, armed-state snapshot below
- Each trigger row: label, condition summary (e.g. "armed when afkPromptQueue.length>0"), Fire button, Prep+Fire button when relevant
- Data injectors are collapsible sections so the panel doesn't become a scroll trench
- All controls are clearly marked dev-only (small "DEV" badge in header); no persistence — everything is in-memory and resets on close/reload

## What's NOT in v1 (defer)
- Per-popup custom schedule presets / saved schedules (start with ad-hoc seconds-delay only)
- Automating timer/heartbeat manipulation (idleRef, cooldown) — v1 injects AFK entries directly instead, which is the cleaner path
- Editing main-process behavior (IPC flags, powerMonitor) — out of scope; this is a renderer-side dev surface
- Unit tests — there is no test runner in this repo (MEMORY 08-04); verification = build + manual click-through

## File plan
- New component: `src/components/DevTriggerPanel.tsx` — the panel UI; receives the fire/inject/schedule callbacks + current state snapshot as props
- Wired in `src/App.tsx`: one state `devTriggerOpen`; the panel is rendered once at the app root (like the other global modals at 3005–3390); all fire/inject handlers live in App.tsx next to the states they control
- No new IPC, no new backend — reuses existing `checkSleepDetection`, `confirmSleep`, `computeAdjacentGaps`, `detectUsageGaps`, `getExternalActivities`, `getExternalSessions`, `loadAfkQueue`/`saveAfkQueue`, `setPreference`
- Build: `node agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/run-exclusive.mjs build --forbid app -- npm run build` (coordination wrapper per DEFAULT_SYSTEM_PROMPT §1b)

## Verification criteria
- Build passes (vite + esbuild + main)
- Panel opens from a new top-bar button (only in dev — guarded by a const flag `DEV_TRIGGER_ENABLED=true` so it can be turned off for release builds without deleting code)
- Each popup fires on click and shows its real content (not a stub)
- Sleep inject → detection → confirm → gaps step flow works end to end
- AFK inject → AfkPromptModal appears with the chosen duration
- Schedule fires after the chosen delay, cancel works
- Dismiss all clears everything
- Snapshot reflects the live state after each action
