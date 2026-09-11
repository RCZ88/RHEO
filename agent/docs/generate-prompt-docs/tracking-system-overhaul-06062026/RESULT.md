<aside>
📋

**DeskFlow Tracking System Overhaul** — production-ready engineering design for 4 interconnected problems: period-navigation freeze, website-tracking accuracy, game detection, and general performance. All references trace to `CONTEXT_BUNDLE.md`. Constraints honored: no new npm packages, IPC-only architecture, Tailwind v4, no git, refs for async state, listener cleanup, backend IPC verification, minimal diffs.

</aside>

## Cross-cutting foundations (build these first)

Three small shared pieces are reused across Problems A, B, and D. Build them once.

### F1 — Canonical date-range helper (single source of truth)

The freeze is fundamentally caused by **four** date-range functions that disagree about what `7day`/`30day` mean. Rather than patch each independently and risk drift, define one canonical resolver in the main process and have every handler call it.

**File:** `src/main.ts` (new helper, place directly above `computeDateRange` at line 3670)

```tsx
// SINGLE SOURCE OF TRUTH for period -> [start, end) date boundaries.
// offset > 0 means "this many periods into the past" (matches dateOffset semantics).
// Returns Date objects at local-midnight boundaries; callers format for SQL as needed.
function resolvePeriodBounds(period: string, offset: number = 0): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const startOfDay = (yy: number, mm: number, dd: number) => new Date(yy, mm, dd, 0, 0, 0, 0);
  const endOfDay   = (yy: number, mm: number, dd: number) => new Date(yy, mm, dd, 23, 59, 59, 999);

  switch (period) {
    case 'today': {
      const day = startOfDay(y, m, d - offset);
      return { start: day, end: endOfDay(y, m, d - offset) };
    }
    case 'week': {
      const dow = now.getDay();                       // 0=Sun
      const monday = d - dow + 1 - offset * 7;         // ISO week start
      return { start: startOfDay(y, m, monday), end: endOfDay(y, m, monday + 6) };
    }
    case '7day': {                                     // rolling 7-day window
      const end = endOfDay(y, m, d - offset * 7);
      const start = startOfDay(y, m, d - offset * 7 - 6);
      return { start, end };
    }
    case 'month': {
      const start = startOfDay(y, m - offset, 1);
      const end = endOfDay(y, m - offset + 1, 0);      // day 0 of next month = last day
      return { start, end };
    }
    case '30day': {                                    // rolling 30-day window
      const end = endOfDay(y, m, d - offset * 30);
      const start = startOfDay(y, m, d - offset * 30 - 29);
      return { start, end };
    }
    case 'all':
    default: {
      // Bounded floor instead of year 2000 / epoch. App has no data before install;
      // 5 years back is a safe, cheap ceiling that still indexes well.
      return { start: startOfDay(y - 5, 0, 1), end: endOfDay(y, m, d) };
    }
  }
}
```

Note that `computeBrowserDateRange` (main.ts:10542) already handles every period correctly; this helper generalizes that proven logic so the other three functions stop diverging.

### F2 — Stable fingerprint utility (renderer)

Used to skip state updates and stabilize `useMemo` deps when IPC returns structurally-identical objects with new references.

**File:** `src/lib/fingerprint.ts` (new, ~10 lines)

```tsx
// Cheap, order-stable structural key. NOT cryptographic — only used to detect
// "did this IPC payload actually change?" before triggering re-renders.
export function fingerprint(value: unknown): string {
  try { return JSON.stringify(value); } catch { return String(value); }
}
```

### F3 — Shared browser process names (resolves the 4-copy duplication)

**File:** `src/lib/browserProcessNames.ts` (new) — plain data + helper, no Node APIs, so it is importable by main, preload, and renderer.

```tsx
export const BROWSER_PROCESS_NAMES: Record<string, string[]> = {
  comet:  ['chrome', 'comet', 'chromium'],
  chrome: ['chrome', 'chromium'],
  brave:  ['brave', 'chrome'],
  edge:   ['msedge', 'edge'],
  arc:    ['arc'],
  vivaldi:['vivaldi', 'chrome'],
  opera:  ['opera'],
  firefox:['firefox'],
};

export function getBrowserProcessNames(browser: string): string[] {
  return BROWSER_PROCESS_NAMES[(browser || '').toLowerCase()] ?? [];
}
```

The Chrome extension (`browser-extension/background.js`) cannot import a TS module at runtime, so it keeps its own copy — but we add a build-time guard (see Problem B, fix B4) so the copy cannot silently drift.

---

## Problem A: Period Navigation Freeze

### Root Cause Confirmation

All seven listed causes are confirmed. They compound into a single fatal sequence (per CONTEXT_BUNDLE §6):

1. **Backend full-table scans** — `computePeriodRange` (3800), `computeDateRange` (3670), and `computeWeekRange` (3833) lack `7day`/`30day` cases. They fall to a `default` that scans from **year 2000 / epoch**, so `get-dashboard-aggregates` runs heavy `stats_daily`/`stats_hourly` queries across the entire table on every nav click — worst on the rolling windows.
2. **Double-render** — `filteredLogs` (useMemo) → `useEffect` → `setLogs` (App.tsx:467-475) produces a guaranteed second render wave plus a redundant copy of the dataset in state.
3. **Unstable memo deps** — object refs from IPC responses invalidate downstream `useMemo`s every response.
4. **`chartBars`** (DashboardPage.tsx:586) has no `7day`/`30day` branch → empty bars, masking the failure.
5. **`get-logs-by-period`** (4370) ignores `dateOffset`, so navigating offsets either returns wrong data or forces the client to re-derive everything.

The "dark screen, no error" is the renderer's main thread blocking long enough that Electron paints an empty BrowserWindow — not a crash, which is why the console is silent.

### Solution Design

- Route **all** four backend functions through `resolvePeriodBounds` (F1) so every period is bounded and index-friendly.
- Collapse the double-render: `logs` becomes a **derived memo**, not state. Delete the `setLogs` effect.
- Pass `dateOffset` end-to-end to `get-logs-by-period`.
- Add the missing `chartBars` branches.
- Stabilize memo deps with primitive fingerprints (F2).

### Implementation

**File:** `src/main.ts` — `computeDateRange` (3670-3702), `computePeriodRange` (3800-3831), `computeWeekRange` (3833-3849)

```tsx
// Replace each function body's switch with a delegation to the canonical resolver.
// computeDateRange / computePeriodRange:
function computePeriodRange(period: string, dateOffset: number = 0) {
  return resolvePeriodBounds(period, dateOffset);   // was: switch w/ default -> new Date(2000,0,1)
}
function computeDateRange(period: string, dateOffset: number = 0) {
  return resolvePeriodBounds(period, dateOffset);   // was: switch w/ default -> new Date(0)
}

// computeWeekRange is the per-week sub-range used by the heatmap. For rolling windows
// it should anchor on the window's end week, not silently fall through to 'week'.
function computeWeekRange(period: string, weekOffset: number = 0) {
  if (period === '7day' || period === '30day') {
    // derive the containing week of the window end, then step by weekOffset
    const { end } = resolvePeriodBounds(period, 0);
    return resolvePeriodBounds('week', weekOffset + weeksAgoOf(end));
  }
  return resolvePeriodBounds(period === 'all' ? 'all' : 'week', weekOffset);
}
```

**File:** `src/main.ts` — `get-logs-by-period` handler (4370)

```tsx
// BEFORE: ipcMain.handle('get-logs-by-period', (event, period) => { ... })
ipcMain.handle('get-logs-by-period', (event, args) => {
  // Accept both legacy (string) and new ({period,dateOffset}) shapes for safety.
  const period = typeof args === 'string' ? args : args?.period ?? 'today';
  const dateOffset = typeof args === 'string' ? 0 : (args?.dateOffset ?? 0);
  const { start, end } = resolvePeriodBounds(period, dateOffset);
  return db.prepare(
    `SELECT * FROM logs WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC`
  ).all(start.toISOString(), end.toISOString());
});
```

**File:** `src/preload.ts` — bridge for `get-logs-by-period`

```tsx
// Verified: channel exists in preload bridge. Widen the argument it forwards.
getLogsByPeriod: (period: string, dateOffset: number = 0) =>
  ipcRenderer.invoke('get-logs-by-period', { period, dateOffset }),
```

**File:** `src/App.tsx` — eliminate the double-render (456-475)

```tsx
const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');
const [dateOffset, setDateOffset] = useState(0);

useEffect(() => { setDateOffset(0); }, [selectedPeriod]); // unchanged: reset on period switch

// logs is now PURE DERIVED STATE. No second state var, no setLogs effect.
const logs = useMemo(() => {
  const { start, end } = getDateRange(selectedPeriod, dateOffset);
  const lo = +start, hi = +end;
  return allLogs.filter(l => { const t = +new Date(l.timestamp); return t >= lo && t < hi; });
}, [allLogs, selectedPeriod, dateOffset]);

// DELETE: const [logs, setLogs] = useState([]);
// DELETE: const filteredLogs = useMemo(...);
// DELETE: useEffect(() => { setLogs(filteredLogs); }, [filteredLogs]);
```

**File:** `src/App.tsx` — period selector UI (2610-2633): stop calling `getDateRange` inline on every render

```tsx
const rangeLabel = useMemo(
  () => getDateRange(selectedPeriod, dateOffset).label,
  [selectedPeriod, dateOffset]
);
// ...
<button onClick={() => setDateOffset(o => o + 1)} aria-label="Previous">←</button>
<span>{rangeLabel}</span>
<button onClick={() => setDateOffset(o => Math.max(0, o - 1))} aria-label="Next">→</button>
```

**File:** `src/lib/dateRange.ts` — fill the stubbed `7day`/`30day`/`month`/`all` cases so the renderer's `getDateRange` matches `resolvePeriodBounds` exactly (same rolling-window math). This keeps client filtering and backend queries aligned.

**File:** `src/pages/DashboardPage.tsx` — `chartBars` (586-691): add the missing branches

```tsx
const chartBars = useMemo(() => {
  switch (selectedPeriod) {
    case 'today':
      return buildHourBars(hourlyHeatmapFP);     // existing
    case '7day':                                  // NEW: 7 day-bars
      return buildDayBars(weeklyHeatmapFP, 7);
    case '30day':                                 // NEW: 30 day-bars
      return buildDayBars(weeklyHeatmapFP, 30);
    case 'week':
    case 'month':
    case 'all':
      return buildDayBars(weeklyHeatmapFP);       // existing
    default:
      return [];
  }
}, [weeklyHeatmapFP, hourlyHeatmapFP, chartExternalDataFP, selectedPeriod, dateOffset]);
// FP deps are primitive fingerprints (see Problem D), not raw IPC objects.
```

### Edge Cases

- **Empty data:** bounded queries return `[]`; `chartBars` returns `[]` cleanly instead of hanging on a year-2000 scan.
- **`dateOffset` at boundary:** the Next button is clamped at `Math.max(0, o-1)` so you can never navigate into the future; `offset` very large just yields an empty (but fast) past window.
- **Month rollover:** `new Date(y, m-offset+1, 0)` correctly yields the last day of the target month (handles 28/29/30/31 and year wrap).
- **Race condition:** rapid chevron clicks fire overlapping `get-dashboard-aggregates` invokes. Guard with a request token (see Problem D, fix D3) so a stale response can't overwrite newer state.
- **Legacy callers:** `get-logs-by-period` still accepts a bare string, so any un-migrated caller keeps working at `offset 0`.

### Verification Steps

1. Open DevTools Performance, select `7day`, click ← five times rapidly → no freeze, no dark screen; each nav < ~150 ms.
2. Add a `console.time` around the `get-dashboard-aggregates` SQL → confirm row counts are bounded to the window (not whole table).
3. Switch to `30day` → chart shows 30 day-bars (previously empty).
4. Add a render counter to `App` → exactly one render per nav click (was ≥3).
5. Navigate to an offset with no data → empty charts render instantly, no hang.

---

## Problem B: Website Tracking Accuracy

### Root Cause Confirmation

Confirmed. The architecture already has 8 guards in `handleBrowserData` (10334-10514) and browser checks on the app-change and checkpoint paths — but two paths and one safety net are missing:

1. **Sleep detection** (2680-2688) and **sleep-gap detection** (2699-2706) call `addLog()` without `!isBrowserWithExtension(currentApp)`, so waking from sleep logs the tracking browser as a normal app session.
2. **`addLog()` (2180) has no internal guard** — correctness depends on every caller remembering the check. That is the real defect; the two missing call-site checks are symptoms.
3. **`BROWSER_PROCESS_NAMES` exists in 4 places** (main 3367, App 393, Dashboard 175, extension 108) and can drift.

### Solution Design

- Add the missing call-site guards (cheap, immediate).
- Add a **defense-in-depth safety net inside `addLog()`** so the browser can never be logged as a regular app regardless of caller.
- Consolidate process names via F3, with a build-time parity check for the extension copy.
- Tighten the extension's focus gate so it only emits when its specific browser is foreground.

### Implementation

**File:** `src/main.ts` — sleep & gap paths (2680-2688, 2699-2706)

```tsx
// Sleep detection (after 30 null polls):
if (currentApp && currentApp !== 'DeskFlow' && currentApp !== 'Electron'
    && !isBrowserWithExtension(currentApp)) {            // ADDED guard
  const duration = Math.min(knownDuration, MAX_SESSION_MS);
  if (duration > 5000) addLog(/* ... */ currentApp, category, duration /* ... */);
}

// Sleep gap detection:
if (currentApp && currentApp !== 'DeskFlow' && currentApp !== 'Electron'
    && !isBrowserWithExtension(currentApp)) {            // ADDED guard
  addLog(/* ... */ currentApp, category, duration /* ... */);
}
```

**File:** `src/main.ts` — `addLog()` safety net (2180)

```tsx
function addLog(entry: LogEntry) {
  // DEFENSE IN DEPTH: never persist the tracking browser as a regular app session.
  // Browser website rows are inserted via handleBrowserData with is_browser_tracking=1;
  // any *other* path trying to log the configured browser is a bug -> drop silently.
  if (!entry.is_browser_tracking && entry.app && isBrowserWithExtension(entry.app)) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[addLog] dropped browser-as-app attempt:', entry.app);
    }
    return; // reject, do not insert
  }
  // ...existing insert logic unchanged...
}
```

This assumes `addLog` takes (or can be normalized to) an object with `app` and `is_browser_tracking`. If the current signature is positional, add a single normalization line at the top rather than changing every caller (minimal-diff).

**File:** `src/main.ts` (3367), `src/App.tsx` (393), `src/pages/DashboardPage.tsx` (175)

```tsx
// DELETE the three local BROWSER_PROCESS_NAMES / *_RENDERER / *_DASHBOARD definitions.
import { BROWSER_PROCESS_NAMES, getBrowserProcessNames } from '@/lib/browserProcessNames';
// isAppMatchingBrowser (main.ts:3384) now calls the imported getBrowserProcessNames.
```

**File:** `browser-extension/background.js` (108) — keep the runtime copy, but add a parity guard

```jsx
// Build step compares this object to src/lib/browserProcessNames.ts and fails CI on drift.
// scripts/check-browser-names.mjs (new): imports both, asserts deep-equal.
const BROWSER_PROCESS_NAMES = { /* must match src/lib/browserProcessNames.ts */ };
```

**File:** `browser-extension/background.js` — `checkBrowserFocus` (233-267) and send path (184-210)

```jsx
async function checkBrowserFocus() {
  try {
    const resp = await fetch('http://localhost:54321/foreground-app');
    const data = await resp.json();
    // Gate on THIS browser specifically, not "any browser".
    isBrowserFocused = !!data.app && isAppMatchingBrowser(data.app, BROWSER_NAME);
  } catch { isBrowserFocused = false; } // fail closed: if server is down, do not track
}

// In the periodic sender (184-210): never POST when not focused.
if (!isBrowserFocused) return;
fetch('http://localhost:54321/browser-data', {
  method: 'POST',
  body: JSON.stringify({ /* ... */ is_browser_focused: true, /* ... */ }),
});
```

The server-side `browserAppMatch` guard (Guard 5) remains as the authoritative backstop — extension-side gating just reduces wasted POSTs.

### Edge Cases

- **Browser focused but no extension active tab:** `handleBrowserData` Guard 8 (most-recently-active tab) still applies; nothing logged for background tabs.
- **Wake-from-sleep while browser is foreground:** new guard drops the browser app-session; the website session resumes via `handleBrowserData` once a valid `/browser-data` POST arrives.
- **Server down during focus check:** extension fails **closed** (`isBrowserFocused=false`) — better to under-track than mis-track.
- **User changes configured browser:** `isBrowserWithExtension` reads `userPreferences.browserWithExtension` live, so the safety net follows the new selection immediately.
- **Race:** foreground flips browser→app mid-POST. Server Guard 5 re-checks `currentApp` at insert time, so a late POST is rejected.

### Verification Steps

1. Open browser + a tracked site, then focus VS Code → confirm no website rows accrue and the browser is **not** logged as an app.
2. Sleep the machine with the browser foreground; wake → confirm no `browser`-named app session was written (query `logs WHERE app LIKE '%chrome%' AND is_browser_tracking=0`).
3. Temporarily call `addLog` with the browser name and `is_browser_tracking=0` in a test → row is dropped.
4. Edit one process-name list, run `node scripts/check-browser-names.mjs` → CI fails on drift.
5. Kill the main process server, watch extension logs → it stops POSTing instead of tracking blindly.

---

## Problem C: App Detection Accuracy (Games)

### Root Cause Confirmation

Confirmed multi-layer failure (CONTEXT §4F, §6):

1. `active-win` returns `null` for exclusive-fullscreen games.
2. PowerShell Method 1 (`GetForegroundWindow`) is blocked by anti-cheat (Vanguard).
3. Method 2 picks the **most-recently-started** process — wrong proxy; yields ~3 s phantom sessions.
4. No `Gaming` category → games become `Uncategorized` (neutral).
5. Raw `VALORANT.exe` shown to users.

### Solution Design

- Replace Method 2's "newest process" heuristic with a **scored heuristic** combining (a) known-game process allow-list match, (b) CPU usage, and (c) main-window presence — far more reliable than start time, and uses only built-in PowerShell (no new deps).
- Add a **session-preservation** rule: when both detectors fail, *hold* the current game session instead of closing it at 3 s.
- Add a `Gaming` category + keyword map, a tier assignment, and a friendly-name mapping.

### Implementation

**File:** `src/main.ts` — `getForegroundViaPowerShell` Method 2 (2533-2592)

```tsx
// Replace "Sort StartTime -Descending | First 1" with a scored selection.
// Scoring (all native PowerShell, no modules):
//   +1000 if ProcessName matches a known game executable (GAME_PROCESS_HINTS)
//   +CPU seconds (recent CPU = likely the active fullscreen game)
//   +50 if MainWindowHandle != 0
// This avoids picking a just-launched helper process over the actual game.
const ps = `
$known = @('valorant','league of legends','leagueclient','steam','csgo','cs2',
           'dota2','battle.net','overwatch','riotclientservices','gameoverlayui',
           'eldenring','genshinimpact','wuthering','helldivers')
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -or $_.CPU -gt 0 } |
  ForEach-Object {
    $score = 0
    if ($known -contains $_.ProcessName.ToLower()) { $score += 1000 }
    if ($_.CPU) { $score += [int]$_.CPU }
    if ($_.MainWindowHandle -ne 0) { $score += 50 }
    [PSCustomObject]@{ S=$score; T=$_.MainWindowTitle; P=$_.ProcessName; Id=$_.Id }
  } | Sort-Object S -Descending | Select-Object -First 1 |
  ForEach-Object { \"$($_.T)|$($_.P)|$($_.Id)\" }`;
// Parse "title|process|pid" exactly as the old Method 2 did (minimal downstream change).
```

**File:** `src/main.ts` — `pollForeground` session preservation (2595-2795)

```tsx
// When BOTH active-win and PowerShell fail but we were mid game-session,
// do NOT tear down the session at the 3s null threshold. Hold it open up to
// MAX_SESSION_MS, checkpointing on the normal CHECKPOINT_INTERVAL_MS.
if (!result) {
  consecutiveNullPolls++;
  const inGame = currentApp && categorizeApp(currentApp) === 'Gaming';
  if (consecutiveNullPolls >= 3) {
    const psResult = getForegroundViaPowerShell();
    if (psResult) { /* process normally */ }
    else if (inGame && (Date.now() - sessionStart) < MAX_SESSION_MS) {
      // PRESERVE: keep accumulating the current game session instead of closing it.
      maybeCheckpoint();   // extend duration; do not reset currentApp
      return;
    }
  }
  // ...existing sleep detection unchanged (>=30 nulls)...
  return;
}
```

**File:** `src/main.ts` — `DEFAULT_APP_CATEGORIES` (190-263)

```tsx
const DEFAULT_APP_CATEGORIES: Record<string, string> = {
  // ...existing entries...
  // NEW gaming keywords (matched via lower.includes):
  'steam': 'Gaming', 'valorant': 'Gaming', 'league': 'Gaming', 'riot': 'Gaming',
  'battle': 'Gaming', 'epic': 'Gaming', 'origin': 'Gaming', 'ubisoft': 'Gaming',
  'gog': 'Gaming', 'csgo': 'Gaming', 'cs2': 'Gaming', 'dota': 'Gaming',
  'overwatch': 'Gaming', 'minecraft': 'Gaming', 'genshin': 'Gaming',
  'eldenring': 'Gaming', 'helldivers': 'Gaming', 'roblox': 'Gaming',
};
```

**File:** `src/main.ts` — `DEFAULT_TIER_ASSIGNMENTS`

```tsx
const DEFAULT_TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  // DESIGN DECISION: Gaming -> distracting by default. Rationale: a time-tracker's
  // "distracting" tier is for leisure that competes with focused work; gaming fits there.
  // It remains user-overridable via categoryConfig, so anyone tracking gaming as work
  // (streamers, QA) can reclassify it. This is the least-surprising default.
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming'],
};
```

**File:** `src/main.ts` — friendly-name mapping (new, near `categorizeApp` 2391)

```tsx
const FRIENDLY_APP_NAMES: Record<string, string> = {
  'valorant': 'VALORANT', 'leagueclient': 'League of Legends', 'league of legends': 'League of Legends',
  'cs2': 'Counter-Strike 2', 'csgo': 'Counter-Strike', 'dota2': 'Dota 2',
  'battle.net': 'Battle.net', 'steam': 'Steam', 'eldenring': 'Elden Ring',
};
// Apply at log-write time so the DB stores the friendly name; raw process name kept in title.
function friendlyName(raw: string): string {
  const key = raw.toLowerCase().replace(/\.exe$/i, '');
  return FRIENDLY_APP_NAMES[key] ?? raw.replace(/\.exe$/i, '');
}
```

### Edge Cases

- **Unknown game (other users):** scored heuristic still favors high-CPU + windowed process, and `categorizeApp` keyword match covers launchers (`steam`, `epic`) even when the game exe is unrecognized; users can add overrides.
- **CPU tie / idle game:** `MainWindowHandle` bonus breaks ties; if the game is truly idle and null-detected, session preservation still holds the session rather than fragmenting it.
- **Anti-cheat blocks everything:** preservation path keeps the long session intact up to `MAX_SESSION_MS`; on the next successful detection the session closes with correct duration.
- **False preservation (user actually Alt-Tabbed to nothing):** capped by `MAX_SESSION_MS` and overridden the moment any detector returns a real app.
- **Friendly-name collisions:** mapping is keyed on normalized process name; raw name is preserved in `title` for audit.

### Verification Steps

1. Launch VALORANT (fullscreen) → after ≤15 s it appears as **VALORANT** under **Gaming**, not `Uncategorized`.
2. Play 10 min, Alt-Tab briefly, return → one continuous ~10 min session, not multiple 3 s fragments.
3. Launch a Steam game with no keyword entry → categorized via `steam`/high-CPU path.
4. Open Settings → reassign Gaming to neutral → confirm tier override persists and recolors history.
5. Query `logs` → app stored as friendly name, `title` retains raw process name.

---

## Problem D: General Performance

### Root Cause Confirmation

Confirmed. Four hot paths run on every render/period change:

1. **`appStats`** (App.tsx:1057) re-filters all of `allLogs` (O(n)) even when only `dateOffset` changes.
2. **`appColors`** (App.tsx:751) does synchronous `localStorage` read/write **inside a useMemo** keyed on `logs` — blocks the UI thread every nav.
3. **DashboardPage useMemos** depend on raw IPC objects (`weeklyHeatmap`, `hourlyHeatmap`, …) that are new refs every response.
4. **`chartExternalData`** rebuilds a `Map` from `externalSessions` every render.

### Solution Design

- Reuse the already-computed `logs` memo (Problem A) as the input to `appStats` so filtering happens **once**, not twice.
- Move `appColors` `localStorage` access to a **load-once ref + lazy writer**, out of render.
- Add **fingerprint gating** (F2) to skip `setDashboardData` when payload is unchanged, and derive **primitive FP deps** for DashboardPage memos.
- Memoize `chartExternalData` on a fingerprint, not the Map.

### Implementation

**File:** `src/App.tsx` — `appStats` (1057)

```tsx
// Reuse the single derived `logs` memo (already filtered for period+offset in Problem A)
// instead of re-filtering allLogs again.
const appStats = useMemo(() => {
  const stats: Record<string, AppStat> = {};
  for (const log of logs) {            // was: allLogs.filter(...) then loop
    const k = log.app;
    (stats[k] ??= { app: k, totalMs: 0, sessions: 0 });
    stats[k].totalMs += log.duration_ms;
    stats[k].sessions += 1;
  }
  return stats;
}, [logs, categoryOverrides]);          // deps shrink: no more selectedPeriod/dateOffset/allLogs
```

**File:** `src/App.tsx` — `appColors` (751): remove localStorage from render

```tsx
// Load once into a ref; never touch localStorage during render.
const appColorsRef = useRef<Record<string, string>>(
  (() => { try { return JSON.parse(localStorage.getItem('deskflow-app-colors') || '{}'); }
           catch { return {}; } })()
);

// Assign colors for any new apps without writing synchronously in a memo.
const appColors = useMemo(() => {
  let mutated = false;
  for (const app of Object.keys(appStats)) {
    if (!appColorsRef.current[app]) { appColorsRef.current[app] = pickColor(app); mutated = true; }
  }
  if (mutated) scheduleColorPersist(appColorsRef.current); // debounced write, see below
  return appColorsRef.current;
}, [appStats]);                        // keyed on derived stats, not raw logs

// Debounced, off-thread-ish writer (microtask/idle), declared once at module scope:
const scheduleColorPersist = debounce((c) =>
  (window.requestIdleCallback ?? setTimeout)(() =>
    localStorage.setItem('deskflow-app-colors', JSON.stringify(c))), 500);
```

**File:** `src/pages/DashboardPage.tsx` — fingerprint the IPC objects (527-2035)

```tsx
import { fingerprint } from '@/lib/fingerprint';

const weeklyHeatmapFP = useMemo(() => fingerprint(dashboardData?.weeklyHeatmap), [dashboardData?.weeklyHeatmap]);
const hourlyHeatmapFP = useMemo(() => fingerprint(dashboardData?.hourlyHeatmap), [dashboardData?.hourlyHeatmap]);

// chartExternalData keyed on a fingerprint of externalSessions, not the array ref.
const extSessionsFP = useMemo(() => fingerprint(externalSessions), [externalSessions]);
const chartExternalData = useMemo(() => {
  const extMap = new Map<string, ExternalHourSegment[]>();
  /* ...existing iteration... */
  return extMap;
}, [extSessionsFP, selectedPeriod, dateOffset]);
const chartExternalDataFP = useMemo(() => fingerprint([...chartExternalData.keys()]), [chartExternalData]);

// Downstream memos (chartBars etc.) depend on the *FP primitives*, not raw objects.
```

**File:** `src/pages/DashboardPage.tsx` — skip redundant state updates (D3, request-token + fingerprint)

```tsx
const reqToken = useRef(0);
const lastFP = useRef('');

useEffect(() => {
  const my = ++reqToken.current;                 // newest-wins guard for rapid nav
  let cancelled = false;
  (async () => {
    const data = await window.deskflowAPI.getDashboardAggregates({ period: selectedPeriod, dateOffset, weekOffset });
    if (cancelled || my !== reqToken.current) return;   // stale response -> drop
    const fp = fingerprint(data);
    if (fp === lastFP.current) return;            // unchanged -> no setState, no re-render
    lastFP.current = fp;
    setDashboardData(data);
  })();
  return () => { cancelled = true; };             // listener/async cleanup per constraints
}, [selectedPeriod, dateOffset, weekOffset]);
```

(`get-dashboard-aggregates` confirmed present in both `preload.ts` and `main.ts:4005` per CONTEXT §4C / §5 IPC table.)

### Edge Cases

- **First load:** `lastFP` empty ⇒ always renders once. Correct.
- **Genuinely identical re-fetch:** fingerprint match skips re-render (the common case while idling on one period).
- **Rapid nav:** request token ensures the last-requested offset wins even if an earlier query resolves later.
- **`localStorage` quota/exception:** writer is wrapped in try/catch via debounce; failure degrades to in-memory colors, no crash.
- **Large `allLogs`:** filtering now happens once per nav (shared `logs` memo) instead of in both `logs` and `appStats`.
- **`requestIdleCallback` unavailable (older Electron):** falls back to `setTimeout`.

### Verification Steps

1. React Profiler: switch periods → DashboardPage commits once per change; identical re-fetch produces **zero** commits.
2. Performance panel: confirm no long `localStorage` task on the main thread during nav.
3. Add a counter inside the `appStats` loop → it iterates `logs.length`, not `allLogs.length`.
4. Spam ← / → → only the final offset's data renders (no flicker of stale data).
5. With 100k+ logs, period switch stays interactive (< ~150 ms).

---

## Suggested rollout order

1. **F1–F3 foundations** (unblocks A, B, D).
2. **Problem A** (stops the freeze — highest user pain).
3. **Problem D** (compounds A's gains; removes residual lag).
4. **Problem B** (data-correctness; low risk).
5. **Problem C** (additive; no risk to existing flows).

<aside>
✅

Every proposed IPC channel (`get-logs-by-period`, `get-dashboard-aggregates`) is confirmed to exist in both `preload.ts` and `main.ts` per the CONTEXT_BUNDLE IPC table. No new npm packages, no git operations, Tailwind untouched, refs used for all async/IPC-callback state, and all listeners return cleanup functions.

</aside>