# CONTEXT BUNDLE — Tracking Time Adjustment, Sleep Exclusion & UI Consolidation

> **Read this file FIRST. It is the source of truth for every code shape below.**
> Every snippet is copied verbatim from the live repo at
> `/home/clementzhao/dev/rheo` on **2026-10-16**. Line numbers are real.
> The receiving AI has NO access to this codebase — this file replaces that gap.

---

## 0. RAW REQUEST (VERBATIM — do not reinterpret)

> make suer theres no error or bugs comming from when like i suspend my laptop or sleep or shutdown or msht becasue like its not supposed to track it when its in those state. i wouldl ike so that im able to manually, and safely, from the app, be able to edit those, like adjust using some sort of sliders. properly. for each app .and it shold have a smart design system that is able to adjust the points aas accurate as possible somehow. so like its meant to predict the usages absed on the data that is error so it knows how to split the knewly adjusted total time into multiple session. this should be a feature of the app tracking too. but the problem is that we already have this like filling gpas feature, and like its a good one but i havent tried it yet bcs its like complex. so like @agent/skills/generate-prompt/ skill to adjust these stuff and like make the fill range and like the manual time button problem (which is that htey popup a same feature but different ui) make sure theres only 1 and like if htey are different feature which is lookks like they have hte fsam feature. make suret those are properly handled with alongisde the added feature that i requested which is those mnually eadjusted exisitng data aside from just adding new one

---

## 1. SYSTEM ARCHITECTURE — THERE ARE TWO INDEPENDENT WRITERS

This is the single most important structural fact. Any fix that touches tracking
duration MUST be applied to **both** writers, or the bug survives in the other one.

```
                    ┌──────────────────────────────┐
                    │  RHEO Electron app (main.ts) │   ← WRITER A  (correct)
                    │  runs when window is open    │
                    └──────────────┬───────────────┘
                                   │  both write the SAME table
                                   ▼
                  logs  (SQLite, ~/.config/RHEO/deskflow-data.db)
                                   ▲
                    ┌──────────────┴───────────────┐
                    │  rheo-tracker daemon (node)   │   ← WRITER B  (BUGGY)
                    │  ~/.local/share/rheo-tracker/ │
                    │  owns port 54321 when app off │
                    └──────────────────────────────┘
```

**Exactly one writer is live at a time.** Per `AGENTS.md` §0-0z:
"The app when running, the `rheo-tracker.service` daemon when it is not."

- Port **38123** = the Electron app's renderer server (proves the app is up).
- Port **54321** = the tracker bridge (`/browser-data`, `/browser-identify`,
  `/foreground-app`, `/health`, `/code-activity`, `/proc`). Served by the app
  when running, by the daemon when not.
- `/health` returns `{"ok":true,"server":"rheo-tracker","source":"daemon"}`
  — `source` tells you which writer currently owns the port.

**Verified live on 2026-10-16:** the app was CLOSED and the daemon owned 54321.

---

## 2. BUG #1 — THE DAEMON CREDITS SLEEP TIME TO THE LAST APP

### 2a. The caps (`~/.local/share/rheo-tracker/daemon.mjs` lines 542-550)

```js
var POLL_INTERVAL_MS = Number(process.env.RHEO_TRACKER_POLL_MS || 1e3);
var STATE_FLUSH_INTERVAL_MS = 6e4;
var OWNERSHIP_CHECK_INTERVAL_MS = 1e4;
var MAX_SESSION_MS = 120 * 6e4;
var MAX_LOGGED_SESSION_MS = 60 * 6e4;   // ← 60 min cap, applied to a SLEEP GAP
var SLEEP_GAP_MS = 5 * 6e4;             // ← gap threshold: 5 min
var AFK_THRESHOLD_MS = 5 * 6e4;
```

### 2b. `flush()` — where the duration is computed (`daemon.mjs` ~lines 951-987)

```js
function flush(reason) {
  if (!open) return;
  const endedAtMs = lastPollMs || Date.now();          // ← lastPollMs ALREADY = now
  const durationMs = endedAtMs - open.startedAtMs;     // ← = entire sleep span
  const session = open;
  open = null;
  lastFlushMs = Date.now();
  if (durationMs < 1e3) return;
  const capped = Math.min(durationMs, MAX_LOGGED_SESSION_MS);   // ← capped at 60 MIN
  const timestamp = new Date(session.startedAtMs).toISOString();
  const ok = commitLog(
    {
      timestamp,
      app: session.app,
      category: session.category,
      duration_ms: capped,
      title: session.title,
      is_browser_tracking: 0,
      platform: "linux",
      source: "auto"
    },
    { timestamp, app: session.app, category: session.category,
      duration_ms: capped, is_browser_tracking: 0 }
  );
  if (ok) {
    stats.rowsWritten++;
    stats.lastRow = `${session.app} ${Math.round(capped / 1e3)}s`;
    log(`wrote ${session.app} ${Math.round(capped / 1e3)}s (${reason})`);
  } else {
    warn(`dropped ${session.app} ${Math.round(capped / 1e3)}s (${reason}) — DB write failed`);
  }
}
```

### 2c. `feed()` — the ORDERING BUG (`daemon.mjs` ~lines 988-1005)

```js
function feed(observed) {
  const now = Date.now();
  stats.polls++;
  const wallGap = now - lastPollMs;
  lastPollMs = now;                                  // ← (1) ADVANCED FIRST
  if (open && wallGap > SLEEP_GAP_MS) {
    flush(`sleep gap of ${Math.round(wallGap / 1e3)}s`);   // ← (2) flush reads the NEW value
    warn(`detected a ${Math.round(wallGap / 6e4)} min gap — flushed without backfill`);
    open = null;
    nullPolls = 0;
    if (afkState === "afk") { afkState = "active"; }
  }
  // ... AFK detection continues below
```

### 2d. The defect, stated precisely

`lastPollMs = now` executes **before** `flush()`. Because `flush()` derives
`endedAtMs` from `lastPollMs`, a detected sleep gap is measured as
`now − open.startedAtMs` — **the whole suspend span** — and then written to the
last foregrounded app, truncated only by the 60-minute cap.

**Consequence:** suspend for 3 hours and the last app is credited **60 minutes**
of fabricated usage. The log message says `flushed without backfill`, which
describes the intent but not the behaviour.

**The correct model** — and WRITER A already implements it — is to end the
session at the **last successful observation**, never at `now`. The daemon
currently has no `lastSuccessfulObservationMs` variable at all; `lastPollMs`
tracks *poll attempts*, not *successful observations*. This distinction is the
root cause.

### 2e. Evidence in the live database (real rows, `~/.config/RHEO/deskflow-data.db`)

`logs` — 43,705 rows total, 6,345 with `is_browser_tracking=1`.

Impossible totals, grouped by day (note `timestamp` is **TEXT ISO-8601**, so
`date(timestamp,'unixepoch')` returns blank — use `substr(timestamp,1,10)`):

| day | rows | claimed hours |
|---|---|---|
| 2026-10-13 | 830 | **139.0** |
| 2026-10-12 | 617 | **108.1** |
| 2026-10-10 | 531 | 48.8 |
| 2026-10-14 | 226 | 5.5 |

133 rows carry `duration_ms = 3600000` (exactly 60 min — the daemon cap),
across only **9 distinct timestamps**. 577 consecutive pairs overlap, i.e. each
row's duration runs past the next row's start.

Top offenders on 2026-10-13: `open.spotify.com` 89.3 h, `chatgpt.com` 69.1 h,
`obsidianui.dev` 62.6 h, `youtube.com` 38.8 h.

**This is the data the user wants to be able to correct from inside the app.**

---

## 3. WRITER A — THE APP'S SLEEP PATH (ALREADY CORRECT — USE AS THE REFERENCE MODEL)

### `src/main.ts` lines 6355-6385, verbatim

```js
          // --- Sleep / gap detection (time-based, independent of null-counter) ---
          // If enough real time elapsed since the previous poll attempt, the system
          // was likely suspended. This fires regardless of how many null polls
          // accumulated — it is driven by wall-clock gap, not by consecutiveNullPolls.
          if (timeSinceLastPoll > SLEEP_GAP_MS) {
              console.log(`[DeskFlow] 💤 Sleep gap detected (${Math.round(timeSinceLastPoll / 1000)}s). Resetting session.`);
              if (currentApp && currentApp !== 'RHEO' && currentApp !== 'DeskFlow' && currentApp !== 'Electron') {
                  // Known duration uses the last successful observation, not the
                  // last poll attempt, so a failed poll never inflates the logged
                  // interval with unobservable time.
                  const knownDuration = lastSuccessfulObservationTime - sessionStart;
                  if (knownDuration > 5000) {
                      const duration = Math.min(knownDuration, MAX_SESSION_MS);
                      const category = categorizeApp(currentApp);
                      addLog(new Date(sessionStart).toISOString(), currentApp, category, duration, `${currentApp} Window`, null);
                  }
              }
              if (currentApp !== null) {
                  lastForegroundChangeMs = now;
                  lastForegroundActivityMs = now;
              }
              currentApp = null;
              sessionStart = now;
              lastSuccessfulObservationTime = now;
              consecutiveNullPolls = 0;
              // Trigger sleep detection popup (covers case where window never lost focus)
              checkSleepGap(now - timeSinceLastPoll, now);
              return;
          }
```

**Key line to mirror in the daemon:** `lastSuccessfulObservationTime - sessionStart`.
WRITER A subtracts the time from the last *confirmed* observation, so unobservable
suspend time is never included. WRITER B has no equivalent variable.

### powerMonitor audit — what exists today

`grep -n "powerMonitor" src/main.ts`:

| Line | Code | What it does |
|---|---|---|
| 5229 | `powerMonitor.getSystemIdleTime()` | idle read (dead on Linux, see below) |
| 6201 | `getSystemIdleTime()` | idle read |
| 6228 | `getSystemIdleTime()` | idle read |
| 7142 | `getSystemIdleTime()` | idle read |
| **24238** | `powerMonitor.on('resume', () => reconcileHaloGeometry())` | Halo geometry only |
| **24239** | `powerMonitor.on('unlock-screen', () => reconcileHaloGeometry())` | Halo geometry only |
| 24481 | *(comment)* `'resume' fires when the machine wakes from sleep/hibernation` | — |
| **24503** | `powerMonitor.on('resume', checkResumeSleepGap)` | triggers sleep-gap check |
| **24504** | `powerMonitor.on('unlock-screen', checkResumeSleepGap)` | triggers sleep-gap check |

**Gaps in coverage (verified, not hypotheses):**
`powerMonitor` has NO handler for `'suspend'`, `'shutdown'`, `'lock-screen'`,
`'on-ac'`/`'on-battery'`, or `'thermal-state-change'`. Only `resume` and
`unlock-screen` are subscribed. Nothing fires at the moment of entering suspend,
so the last session is only corrected *after the fact*, on wake.

### Linux idle caveat — `src/main.ts` lines 5340-5350

```js
        console.warn('[DeskFlow] powerMonitor.getSystemIdleTime() is not functional on Linux — it always returns 0. Idle-driven prompts (AFK, sleep) will use the renderer input clock / foreground-change fallback instead.');
```

`powerMonitor.getSystemIdleTime()` **always returns 0 on Linux**. The whole
machine runs native Wayland (KDE Plasma). Any design that depends on OS-native
idle time will silently do nothing here. Use the renderer input clock /
foreground-change fallback.

---

## 4. DATABASE SCHEMA (actual `CREATE TABLE` from the live DB)

### 4a. `logs` — the primary time table

```sql
CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        app TEXT NOT NULL,
        category TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        title TEXT,
        project TEXT,
        keystrokes INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        window_switches INTEGER DEFAULT 0,
        url TEXT,
        domain TEXT,
        tab_id INTEGER,
        is_browser_tracking INTEGER DEFAULT 0
      , profile_id TEXT, browser_name TEXT, platform TEXT DEFAULT NULL, source TEXT NOT NULL DEFAULT 'auto');
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
```

`source` is the provenance discriminator: `'auto'` (tracked), `'manual'`
(user-authored). Triggers `trg_update_hourly` / `trg_update_daily` fire
`AFTER INSERT` and maintain `stats_hourly` — **so any correction MUST go through
these triggers or the aggregates drift out of sync.**

### 4b. `manual_time_assignments` — user-authored spans

```sql
CREATE TABLE manual_time_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        mode TEXT NOT NULL DEFAULT 'custom' CHECK(mode IN ('random','custom')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      , app TEXT, category TEXT, log_id INTEGER);
CREATE INDEX idx_manual_time_assignments_date ON manual_time_assignments(date);
CREATE INDEX idx_manual_time_log ON manual_time_assignments(log_id);
```

`log_id` FK-links a manual assignment to its mirrored `logs` row — this is the
existing "manual entry has a real log row" pattern to preserve.

### 4c. `external_sessions` — sleep/activity entries

```sql
CREATE TABLE external_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_seconds INTEGER DEFAULT 0,
            notes TEXT,
            device_off_to_sleep_seconds INTEGER DEFAULT 0,
            wake_up_to_app_seconds INTEGER DEFAULT 0,
            FOREIGN KEY (activity_id) REFERENCES external_activities(id)
          );
```

---

## 5. THE UI DUPLICATION — RECONNAISSANCE RESULT (this is the problem to consolidate)

### 5a. Dead components (zero importers — safe to remove, but ASK FIRST)

| Component | Path | Status |
|---|---|---|
| `GapFillModal` | `src/components/GapFillModal.tsx` (730 ln) | **DEAD** — 0 importers |
| `GapFillModal` | `src/components/external/GapFillModal.tsx` (721 ln) | **DEAD** — 0 importers |
| `GapFillDrawer` | `src/components/GapFillDrawer.tsx` | **DEAD** — 0 importers |

Proof: `grep -E "from ['\"].*GapFill(Modal|Drawer)|import.*GapFill"` over
`src/**/*.{ts,tsx}` → **no matches**. The only textual references are their own
export lines (`GapFillModal.tsx:60`, `external/GapFillModal.tsx:120`,
`GapFillDrawer.tsx:76`).

All three call **IPC channels that do not exist**:

```js
// src/components/GapFillModal.tsx:274 / :303
const result = await api().predictGapFill(gs.gap.start, gs.gap.end, 'combined');
await api().confirmGapFill(fills);            // :352

// src/components/GapFillDrawer.tsx:151 / :181 / :396  — same ghost channels
```

`predictGapFill` / `confirmGapFill` have **no `ipcMain.handle` in `src/main.ts`**
and **no binding in `src/preload.ts` or `src/preload2.ts`**. If either component
were ever re-mounted it would throw at runtime.

### 5b. Live components

| Component | Path | Role |
|---|---|---|
| `AfkPromptModal` | `src/components/AfkPromptModal.tsx` | **THE real gap-fill UI** (gap mode) |
| `GapsListModal` | `src/components/external/GapsListModal.tsx` | list + dispatch |
| `MissedTimePanel` | `src/components/MissedTimePanel.tsx` | child of AfkPromptModal |
| `SleepDetectionModal` | `src/components/SleepDetectionModal.tsx` | post-wake prompt |
| `ManualAssignModal` | `src/components/external/ManualAssignModal.tsx` (1067 ln) | assign into empty spans |
| `ManualFillModal` | `src/components/external/ManualFillModal.tsx` (757 ln) | spec-driven generator |
| `manualBackfill` | `src/lib/external/manualBackfill.ts` | **pure logic, no DB writes** |

Consolidation has already been attempted once — `src/App.tsx:1094-1102`:

```js
// There used to be four separate consumers of a gap-filling modal — the sleep popup,
// the AFK prompt, a smart-fill path, and the External page — each with its own
// target/queue/filled list... every entry point now pushes onto this one queue
// and a single `AfkPromptModal` in gap mode drains it.
```

and `src/App.tsx:4325`: `{/* -- Single gap-fill prompt (replaces three GapFillModal mounts) --`

### 5c. THE BUTTON COLLISION — two different buttons, both labelled exactly "Smart Fill"

| Trigger | File:line | Opens | Tooltip says |
|---|---|---|---|
| "Smart Fill" (app header) | `src/App.tsx:3787-3794` | `ManualAssignModal` | *"Fill gaps with tracked apps, websites, or external activities"* — describes the **other** button |
| "Smart Fill" (External header) | `src/pages/ExternalPage.tsx:1016-1023` | gap-fill `AfkPromptModal` via `window.dispatchEvent(new Event('open-gap-drawer'))` | — |

```js
// src/App.tsx:3787-3794
<button
  onClick={() => setShowManualAssign(true)}
  title="Fill gaps with tracked apps, websites, or external activities"
```

### 5d. ActivityPage — "Manual time" vs "Fill a range" (`src/pages/ActivityPage.tsx`)

```js
// :240-251  "Manual time"  → ManualAssignModal
setShowManualAssign(true)
// :253-260  "Fill a range" → ManualFillModal
setShowManualFill(true)
// :148-153  TrackingCoverage "Fill now" → ManualFillModal (BYPASSES the gap-fill queue)
<... onFillNow={() => setShowManualFill(true)} />   // :152
```

**Both ultimately call the SAME `manual-assign:*` IPC.** Per recon:
"ManualFillModal is a *spec-driven generator that emits ManualAssign writes*; the
two modals are the two UX front-ends to `manual-assign:*`."

### 5e. Unreachable AI-prediction path (relevant to the user's "smart" request)

- `ipcMain.handle('predict-day-gaps', ...)` exists at `src/main.ts:31473`
- bound in `src/preload.ts:2123` and `src/preload2.ts:970`
- its **only** caller is `src/hooks/useGapPredictions.ts:59,82`
- **that hook is imported nowhere** → the entire AI day-prediction path is dead code.

This is the closest existing thing to the "smart design system that predicts
usage" the user is asking for. It is built but unreachable.

---

## 6. THE WRITE PATH — `manual-assign:*` (`src/main.ts:25055-25200`)

### 6a. Handler signature (`:25055`)

```js
electron_1.ipcMain.handle('manual-assign:list', (event, { date } = {}) => {
    if (useJson) return [];
    try {
        return db.prepare(`SELECT id, date, started_at, ended_at, duration_seconds, mode, app, category, created_at FROM manual_time_assignments WHERE date = ? ORDER BY started_at ASC`).all(date);
    }
    catch (err) {
        console.error('[DeskFlow] manual-assign:list error:', err);
        return [];
    }
});
```

Related channels: `manual-assign:day-context` (`:25066`), `manual-assign:create`,
`manual-assign:delete` (range `:25055-25200`).

### 6b. The two-table write — the pattern to follow (`:25140-25165`)

```js
          const appName = (app && String(app).trim()) || 'Manual time';
          const catName = (category && String(category).trim()) || 'other';

          // Insert the aggregate-visible row FIRST so the existing AFTER INSERT
          // triggers (trg_update_daily / trg_update_hourly) pick it up exactly as
          // they would for real tracked time. This is what makes manual fill show up
          // in every chart, timeline and per-app breakdown with no query changes.
          const logInfo = db.prepare(`
              INSERT INTO logs (timestamp, app, category, duration_ms, title, is_browser_tracking, source)
              VALUES (?, ?, ?, ?, ?, 0, 'manual')
          `).run(startedAt, appName, catName, durationSeconds * 1000, `Manual entry: ${appName}`);

          const info = db.prepare(`
              INSERT INTO manual_time_assignments (date, started_at, ended_at, duration_seconds, mode, app, category, log_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(dateStr, startedAt, endedAt, durationSeconds, mode === 'random' ? 'random' : 'custom', appName, catName, Number(logInfo.lastInsertRowid));

          syncManualStats(dateStr);
          recomputeAppAggregate(dateStr, appName);
```

**Critical convention:** the `logs` row is inserted FIRST so the existing
`AFTER INSERT` triggers maintain every aggregate. A correction feature must
**UPDATE** (not re-insert) and then recompute the affected aggregate windows.

---

## 7. EXISTING EDIT CAPABILITY AUDIT — WHAT EXISTS AND WHAT DOES NOT

### 7a. What EXISTS (per-row, one at a time)

`src/main.ts:7328` and `:7361`:

```js
ipcMain.handle('update-app-log', (_event, id, data) => {
    // ... UPDATE logs SET timestamp = ?, duration_ms = ?, title = ? WHERE id = ?   (:7337)
});
ipcMain.handle('delete-app-log', (_event, id) => {
    // ... DELETE FROM logs WHERE id = ?                                            (:7368)
});
```

Bound in `src/preload.ts:207-208`:

```js
    ipcRenderer.invoke('update-app-log', id, data),
    deleteAppLog: (id: number) => ipcRenderer.invoke('delete-app-log', id),
```

Surfaced in **`src/pages/StatsPage.tsx`** only:

```js
const [editingAppLogId, setEditingAppLogId] = useState<number | null>(null);        // :136
const [editingAppLogTimes, setEditingAppLogTimes] = useState({ started_at: '', ended_at: '' }); // :137
// :1550  await window.deskflowAPI.updateAppLog(log.id, { ... })
// :1608  if (window.confirm('Delete this session?')) {
// :1609    await window.deskflowAPI.deleteAppLog(log.id);
```

Editing is done with **text `datetime-local` inputs** (`:1527`, `:1538`), not
sliders. Also `updateExternalSession` (`ExternalPage.tsx:1488-1540`) and
`update-manual-sleep` (`main.ts:25472-25510`) exist for external sessions.

### 7b. What DOES NOT EXIST — the gap the user is asking to fill

- **No slider-based editor for already-recorded time.** `grep` for
  `RangeSlider|dual.?handle|DualRange` → **no matches anywhere in `src/`.**
- The only `type="range"` inputs in the app are *parameter* sliders, not editors:
  - `src/components/external/ManualAssignModal.tsx:897` (weight)
  - `src/components/external/ManualFillModal.tsx:340` and `:458`
- The only drag interaction is `AfkPromptModal.tsx:414-451` — a split divider that
  redistributes **not-yet-saved** gap segments.
- **No feature adjusts an EXISTING recorded total downward/upward with automatic
  re-distribution into multiple sessions.** That is the new capability requested.

### 7c. Available primitives (ALREADY INSTALLED — do not re-add)

- `src/components/ui/slider.tsx` **exists**
- `package.json`: `"@radix-ui/react-slider": "^1.4.7"` **installed**
- Also available: `dialog.tsx`, `drawer.tsx`, `progress.tsx`, `card.tsx`,
  `button.tsx`, `popover.tsx`, `select.tsx`, `scroll-area.tsx`,
  `DateTimeRangePicker.tsx`, `DateTimePicker.tsx`

---

## 8. DESIGN TOKENS (actual custom properties from `src/index.css`)

```css
	--ws-surface: #09090b;
	--ws-surface-raised: #18181b;
	--ws-surface-hover: #27272a;
	--ws-border: rgb(39 39 42 / 0.6);
	--ws-border-strong: rgb(63 63 70 / 0.6);
	--ws-accent: #06b6d4;
	--ws-radius-card: 0.5rem;
	--ws-dur: 150ms;
	--ws-ease: cubic-bezier(0.2, 0, 0, 1);

	--color-clay-300: #f0a892;
	--color-clay-400: #e8866b;
	--color-clay-500: #d96846;
	--color-clay-600: #c2553a;
	--color-sage-400: #6fb38f;
	--color-mem-400: #6fb38f;
	--color-amber-400: #fbbf24;
	--color-amber-300: #fcd34d;
	--color-sky-400: #5ab0c9;
	--color-glow: #f7f3ee;

	--color-cyan-ink: #22d3ee;
	--color-emerald-ink: #34d399;
	--color-violet-ink: #8b5cf6;
	--color-orange-ink: #f97316;
	--color-rose-ink: #fb7185;
	--color-sky-ink: #7dd3fc;
```

Font families present as registry fonts: `font-geist`, `font-jetbrains-mono`,
`font-space-grotesk`, `font-inter`.

---

## 9. MCP REGISTRY INVENTORY (VERIFIED — real item names, do not invent)

Registries configured in `components.json`: **@shadcn, @react-bits, @kokonutui, @bklit**.

`@shadcn` — 471 items. Confirmed present and relevant:

| Item | Add command | Use for |
|---|---|---|
| `slider` | `npx shadcn@latest add @shadcn/slider` | *(already local — see §7c)* |
| `dialog` | `@shadcn/dialog` | correction modal shell |
| `drawer` | `@shadcn/drawer` | bottom-sheet editing variant |
| `popover` | `@shadcn/popover` | inline day picker |
| `progress` | `@shadcn/progress` | coverage/confidence bar |
| `chart` | `@shadcn/chart` | recharts wrapper |
| `card` | `@shadcn/card` | panel containers |
| `select` | `@shadcn/select` | app/session pickers |
| `badge` | `@shadcn/badge` | source='manual' vs 'auto' chips |
| `alert` / `alert-dialog` | `@shadcn/alert` | destructive-confirm guard |
| `input` / `label` / `form` | `@shadcn/form` | numeric entry |
| `scroll-area` | `@shadcn/scroll-area` | long session lists |
| `separator` | `@shadcn/separator` | section dividers |
| `tabs` | `@shadcn/tabs` | per-app / per-day views |
| `tooltip` | `@shadcn/tooltip` | explain the prediction |
| `empty` | `@shadcn/empty` | empty states |
| `field` / `input-group` | `@shadcn/field` | grouped numeric input |

`@bklit` — 58 items, chart-focused. Confirmed relevant:

| Item | Description (verbatim from registry) |
|---|---|
| `chart-utils` | "Shared Intl formatters, time-series decimation, and RAF tooltip scheduling" |
| `chart-context` | "Shared context and hooks for Bklit chart components" |
| `chart-parent-size` | "Responsive size wrapper for charts (visix useParentSize without overflow clipping)" |
| `chart-animation` | "Shared motion helpers for chart enter transitions, clip reveals, staggered animations" |
| `chart-series` | "Shared line and area series rendering helpers (paths, markers, highlights, dash tails)" |
| `grid` | "Grid lines for charts" |
| `reference-area` | "Shaded data-coordinate band for target ranges and thresholds on time-series charts" |
| `projection-line` | "Forecast segment extending a line series past the last data point" |
| `shimmering-text` | "Per-character shimmer animation for loading labels and badges" |

**Rule from AGENTS.md §9: charts/data-viz come from `@bklit` ONLY** — never
hand-rolled Recharts, never KokonutUI.

---

## 10. ANIMATION / MOTION CONSTRAINTS

- Animation engine available: **`motion` v12** (Framer Motion successor) **only**.
- **GSAP and Anime.js are NOT dependencies** and have no MCP server. Do not import them.
- Never wire two animation engines to the same element.
- **`prefers-reduced-motion` MUST be honored.**
- No spring/bounce on data surfaces (developer tool — see §11).
- Duration token: `--ws-dur: 150ms`; easing token: `--ws-ease: cubic-bezier(0.2, 0, 0, 1)`.

---

## 11. DESIGN CONSTITUTION (binding — `design/design.md` LAMINAR, precedence: highest wins)

1. Monochrome zinc surfaces. **ONE signal hue per surface.**
2. Radii: **8 / 12 / pill ONLY.**
3. Fonts: Inter + JetBrains Mono + Space Grotesk — **max 2 per view.**
4. **No glassmorphism on chrome.**
5. **No decorative glow / gradients.**
6. **No spring / bounce** — this is a developer tool; data areas must feel precise.
7. `prefers-reduced-motion` honored.
8. Dark mode only.

---

## 12. OPEN QUESTIONS THE RECEIVING AI MUST RESOLVE (do not hand back a menu)

1. How should a *correction* be represented in the data model so it is
   distinguishable from fabricated-but-`auto` data, and so the correction itself
   is reversible/auditable? Consider: a third `source` value, a
   `corrections` ledger table, or a `corrected_from` column. **Choose one and
   justify it.**
2. How does a corrected total get split into multiple sessions? The user wants
   prediction from the surviving good data. Specify the actual algorithm —
   histogram of gap sizes, per-app session-length distribution, weighted
   allocation — with the math written out.
3. What are the guard rails that make the correction "safe" (the user's word)?
   Undo? Preview-before-commit? Never silently exceeding 24 h/day? Bounds per app?
4. How do the two writers (app + daemon) share the exclusion rule so the fix
   cannot regress when the daemon owns the port?
