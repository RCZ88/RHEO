# Dev Popup Forge — spec

## Purpose
A developer panel that lets you manually fire, schedule, and pre-configure every popup/modal in the app so you can test flows without waiting for real-world triggers (45min idle, overnight sleep, visibility changes, etc.).

## Scope — every popup in App.tsx

| # | Popup | Trigger today | Gate |
|---|-------|---------------|------|
| 1 | Sleep Detection (sleep step) | `checkSleepDetection()` on mount, IPC `onSleepDetection` (≥45min gap), visibilitychange/focus (hidden >45min AND sleep hours 21–06) | gap≥45min + sleep hours + not already shown |
| 2 | Sleep Gap Fill (gaps step) | cascade — `confirmSleepDetection` sets `sleepModalStep='gaps'` | sleep confirmed first |
| 3 | AFK Prompt | `afkPromptQueue` non-empty (idle detection IPC + persisted restore on mount) | queue has entries |
| 4 | AFK Gap Fill (`GapFillModal`) | `onFillGapRequest` from AFK prompt "Fill all N gaps" button | AFK prompt open + adjacentGaps |
| 5 | Smart Fill Drawer (`GapFillModal`) | `open-gap-drawer`/`open-gap-panel` events, ExternalPage Smart Fill button, top-bar button | gaps detected |
| 6 | Manual Assign Modal | `showManualAssign` — button somewhere in External/Manual flow | user action |
| 7 | Confirm Export Modal | `showConfirmExport` — Export buttons on External/Stats pages | user action |
| 8 | SQLite Database Modal | `showDatabase` — Settings/Database page button | user action |
| 9 | AI Summary Modal | `showSummary` — AI Summary page button | user action |
| 10 | Confirm Clear Modal | `showConfirmClear` — clear data button | user action |
| 11 | Unsaved Changes Warning | `showUnsavedWarning` — settings changed + nav attempt | state-driven |
| 12 | Workspace Unsaved Warning | `showWorkspaceWarning` — workspace dirty + nav | state-driven |
| 13 | Pair Phone Modal | `pairPhoneModal` — `pair-phone` IPC event from main | main process event |

## Feature set

### 1. Fire (manual trigger)
One button per popup that executes the EXACT same state path the real trigger uses — not a fake overlay. For event-driven popups this means calling the IPC/state setup the real code calls.

- Sleep Detection → runs `checkSleepDetection()` → if detected, sets all the sleep state (data, custom times, date, step='sleep', show=true) exactly as the mount effect does
- Sleep Gap Fill → requires sleep state present; sets step='gaps' (same as confirm path)
- AFK Prompt → pushes a synthetic `AfkPromptEntry` onto `afkPromptQueue` (same shape the idle IPC writes) — popup renders from queue
- AFK Gap Fill → requires AFK prompt + gaps data; same `onFillGapRequest` path
- Smart Fill → dispatches `open-gap-drawer` event (same as real buttons) — reuses existing handler
- Manual Assign → sets `showManualAssign(true)`
- Confirm Export → sets `showConfirmExport('csv')` or `('json')`
- Database → sets `showDatabase(true)`
- AI Summary → sets `showSummary(true)`
- Confirm Clear → sets `showConfirmClear(true)`
- Unsaved Warning → sets `showUnsavedWarning(true)` (also toggles `settingsHasChanges` so the real guard path is testable)
- Workspace Warning → sets `showWorkspaceWarning(true)`
- Pair Phone → dispatches fake `pair-phone` event with synthetic terminalId/label (same listener at App.tsx:1578)

### 2. Configure (pre-fill state before firing)
Each popup that carries data gets a config form. Fill it, then Fire uses your values instead of defaults/live data.

- Sleep Detection:
  - gapMinutes (number, default 60)
  - suggestedBedtime (time picker → hours/minutes)
  - suggestedWakeTime (time picker)
  - fellAsleepAt offset (+15min from bedtime, as real code does)
  - wakeUpAt offset (-5min from wake, as real code does)
  - sleepDate (date picker, default today)
  - customBedtime / customWaketime (independent overrides)
  - "Use live IPC data" toggle — when on, Fire calls `checkSleepDetection()` and uses real data; when off, uses form values to build synthetic `sleepDetectionData`
- AFK Prompt:
  - idleStartMs (datetime picker or "now - N min")
  - returnMs (datetime picker or "now + N min" → duration)
  - app name (text, default 'VS Code')
  - defaultNotAfk (toggle)
  - queue position (append / prepend / replace queue)
- Sleep Gap Fill / AFK Gap Fill:
  - adjacentGaps editor: list of {start, end, durationSeconds, relation} — add/remove rows
  - activities/sessions picker (quick fills: empty / sample / live from API)
- Smart Fill:
  - period (today/week/month/all)
  - minGapMinutes
  - "Detect live" vs "use synthetic gaps"

### 3. Schedule (auto-fire on timer)
Countdown timers that fire a popup after N seconds. Useful for testing timing-dependent flows (e.g. "show sleep detection after 30s" to verify the popup animation, backdrop, step transition).

- Each Fire button has a "Schedule ▸" dropdown: 5s / 15s / 30s / 60s / custom
- Scheduled fires show in the panel with a countdown + Cancel button
- Multiple scheduled fires can coexist (they're independent)
- Sleep Detection schedule optionally simulates the "hidden >45min" path by firing a fake visibilitychange with a synthetic lastVisibilityCheckRef offset

### 4. Queues & State inspect
- AFK queue: list current entries (id, app, duration, idleStart, returnMs, age) + Clear button
- Sleep state: current data + step + date + custom times (read-only snapshot) + Reset button
- Gap data: AFK gaps + smart fill gaps (read-only) + Clear buttons
- Persisted AFK: button to force-save now + button to clear persisted queue

### 5. Event log
Every Fire / Schedule-fire / real trigger that opens a popup appends a line:
- timestamp, popup name, source (manual/scheduled/ipc/visibility), config snapshot (short)
- Clear button
- Max 50 lines, oldest dropped

### 6. Production guard
- Panel renders ONLY when `localStorage.getItem('rheo-dev-forge-enabled') === '1'`
- No import cost in production (the component file still lives in src, but the JSX never mounts)
- A one-line toggle in the panel header: "Keep open" (persists the flag) + "Destroy" (clears flag, unmounts)

## UI plan

### Placement
- Floating trigger button: bottom-right corner, outside the app's z-stack concerns, `z-[9999]`, glass pill with a wrench icon + "Dev Forge" label
- Clicking it slides in a right-side panel, `w-[420px] max-w-[90vw]`, `z-[9999]`, glass rounded-2xl, scrollable
- Panel header: title + "Keep open" toggle + Destroy button + close X
- Panel is NOT a modal — it does not block the app; you can interact with the app behind it

### Layout inside panel
Tabs or accordion? With 13 popups and 5 feature dimensions, tabs get deep. Going with **grouped accordion sections** so everything is visible at a glance and you can open/close sections:

```
[Dev Popup Forge]                      [Keep open] [Destroy] [×]
─────────────────────────────────────────────────────────────────────
> Detection popups (2)
  ☐ Sleep Detection
    [Fire] [Schedule ▸]  gapMin: [60]  bedtime: [22:00]  wake: [07:00]
    date: [2026-09-08]  [✓ Use live IPC data]
  ☐ Sleep Gap Fill
    [Fire]  (requires sleep state)  steps: [sleep → gaps]

> Idle popups (1)
  ☐ AFK Prompt
    [Fire] [Schedule ▸]  app: [VS Code]  idleStart: [now-10m]
    returnMs: [now+15m]  defaultNotAfk: [☐]  position: [append▼]

> Fill popups (3)
  ☐ AFK Gap Fill
    [Fire]  (requires AFK + gaps)  gaps: [edit...]
  ☐ Smart Fill Drawer
    [Fire] [Schedule ▸]  period: [week▼]  minGap: [5]
  ☐ Manual Assign
    [Fire]

> Confirmation popups (4)
  ☐ Confirm Export    [Fire csv] [Fire json]
  ☐ SQLite Database   [Fire]
  ☐ AI Summary        [Fire]
  ☐ Confirm Clear     [Fire]

> System popups (3)
  ☐ Unsaved Warning   [Fire]  (toggles settingsHasChanges)
  ☐ Workspace Warning [Fire]
  ☐ Pair Phone        [Fire]  terminalId: [term-001]  label: [My PC]

─────────────────────────────────────────────────────────────────────
Queues & State                         Event log
[AFK queue: 0 entries] [Clear]        11:23:01 Sleep Detection — manual
[Sleep: not shown]     [Reset]        11:23:05 AFK Prompt — scheduled (15s)
[AFK gaps: none]       [Clear]        11:23:05 AFK Prompt — manual
[Smart gaps: none]     [Clear]        11:22:44 Smart Fill — manual
                                     ...
                                     [Clear log]
```

Each section is an accordion row: click the row label to expand/collapse the config controls.

### Visual language
- Matches the app glass aesthetic: `bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/60`
- Dev accent: violet/magenta (`#a78bfa`) to distinguish from app's emerald/amber palette — so it's obvious this is not app UI
- Buttons: small, dense — `px-3 py-1.5 text-xs` for config controls, primary Fire button with dev accent bg
- Accordion rows: `py-2 px-3 rounded-lg hover:bg-zinc-800/50` with a right-arrow that rotates on expand
- Log: monospace, `text-[11px]`, timestamp + name + source tag

### Interaction details
- Fire buttons are disabled with tooltip when prerequisites aren't met (e.g. Sleep Gap Fill disabled until sleep state exists) — show `title` with reason
- Schedule shows a live countdown chip on the section row while active: "⏱ 12s"
- Config changes are local state in the panel — don't touch App state until Fire
- "Use live IPC data" for sleep: Fire runs `checkSleepDetection()`; if it returns `detected:false`, show an inline error "IPC returned no sleep detection — adjust form or use live data" and don't open the modal

## Implementation notes

- Component: `src/components/dev/DevPopupForge.tsx` — pure renderer component, receives the setters it needs as props
- Mount gate in App.tsx: read the localStorage flag once; if not set, never render (no JSX cost)
- Props surface: the panel needs write access to ~13 state setters + ~6 state values for disable-logic. Pass as a single `forge` prop object typed `DevForgeApi` so the component signature stays small.
- Schedule timers: panel-local `useRef` map of `timeoutId → {popup, config}`; `useEffect` cleanup clears all on unmount
- Event log: panel-local state, max 50, cleared on Destroy
- Pair Phone synthetic event: `window.dispatchEvent(new CustomEvent('pair-phone', { detail: { terminalId, label } }))` — matches the real listener at App.tsx:1578

## What this is NOT
- Not a test runner — no assertions, no DOM probes. It's a manual trigger surface.
- Not a simulator of the full idle/sleep detection pipeline — it fires the popups, not the underlying IPC detection. The sleep "Use live IPC data" toggle is the only bridge to real detection.
- Not shipped to production. The flag check is the only guard; no build-time stripping.

## Acceptance
1. Panel mounts only when flag is set; invisible otherwise
2. Every popup Fire button opens its popup through the real state path (visual + functional check: the real modal renders, not a fake)
3. Sleep Detection Fire with "Use live IPC data" off opens the modal pre-filled with form values
4. AFK Prompt Fire pushes to queue and the real AFK modal renders
5. Schedule fires a popup after the countdown, countdown visible in panel
6. Queues section reflects real state; Clear buttons empty them
7. Event log records every fire with source tag
8. Destroy unmounts panel and clears the flag; re-setting flag re-mounts
