# DeskFlow Tracking System Overhaul — Agent Task File
**Date:** 2026-05-28  
**State:** `agent/state.md`  
**Context bundle:** `agent/docs/tracking-revamp-28052026/CONTEXT_BUNDLE.md`

Read `agent/state.md` and the files listed under each fix before touching any code.  
Work through phases in order. Do not skip to Phase 2 before Phase 1 reads are complete.

---

## System Overview

Three tracking subsystems, all rooted in `src/main.ts`:

| Subsystem | Mechanism | Key file |
|-----------|-----------|----------|
| App tracking | `active-win` poll every 2s + PowerShell Win32 fallback | `src/main.ts` |
| Website tracking | Browser extension → HTTP POST to port 54321 → `handleBrowserData()` | `src/main.ts`, `browser-extension/background.js` |
| External / sleep tracking | Manual sessions, sleep detection, AFK → `external_sessions` table | `src/main.ts`, `src/pages/ExternalPage.tsx` |

---

## What Is Already Done

These were implemented before this session — do NOT re-implement, but understand how they work:

1. **PowerShell fallback** (`main.ts:2370+`) — when `active-win` returns null, uses Win32 API `GetForegroundWindow()` + `GetWindowThreadProcessId()` + `GetModuleBaseName()` to catch games in exclusive fullscreen (Forza Horizon, Horus, etc.)
2. **Browser focus fix** (`browser-extension/background.js`) — `checkBrowserFocus()` compares against `BROWSER_NAME` constant instead of a generic browser pattern
3. **Sleep fellAsleep date fix** (`ExternalPage.tsx:2462`, `App.tsx:791`) — 10-hour heuristic distinguishes same-day vs next-day fell-asleep times
4. **`add-external-time` handler** (`main.ts`) — fully implemented (was a stub)
5. **Add Session button** (`ExternalPage.tsx`) — DurationPicker modal for manually logging past session durations
6. **Sleep Debug toggle** (`ExternalPage.tsx`) — shows raw sleep sessions and trends input

---

## Remaining Problems — Prioritized

### BUG A — Website tracking: data not displaying (MOST LIKELY CULPRIT)

**Root cause:** `handleBrowserData()` at `main.ts:8200-8203` drops ALL browser data where `is_browser_focused === false`. The extension sets `is_browser_focused` by comparing the string returned by `GET /foreground-app` against its `BROWSER_NAME` constant. If there is a case/format mismatch (e.g. `/foreground-app` returns `"brave.exe"` but `BROWSER_NAME` is `"Brave"`), the check always fails and all website tracking is silently dropped.

**Before touching anything, read:**
- `main.ts` → find the `GET /foreground-app` handler (around line 8053–8187) — what exact string does it return for the `app` field?
- `browser-extension/background.js` → find `BROWSER_NAME` constant and `checkBrowserFocus()` — what string does it compare against?

**Fix options (pick whichever matches the actual mismatch found):**
- Option 1 — Normalize in the `/foreground-app` response: strip `.exe`, lowercase the app name before returning
- Option 2 — Normalize in the extension's `checkBrowserFocus()`: lowercase both sides before comparing
- Option 3 — Make the comparison case-insensitive and strip `.exe` suffix on both sides (most robust)

**Recommended implementation for Option 3 in the extension:**
```javascript
// In checkBrowserFocus(), replace the comparison with:
const returnedApp = (data.app || '').toLowerCase().replace(/\.exe$/, '');
const browserName = BROWSER_NAME.toLowerCase().replace(/\.exe$/, '');
isBrowserFocused = returnedApp === browserName || returnedApp.includes(browserName) || browserName.includes(returnedApp);
```

**And in main.ts `/foreground-app` handler, normalize the returned app name:**
```typescript
// Normalize before sending — strip .exe, lowercase for comparison
const normalizedApp = (currentApp || '').replace(/\.exe$/i, '');
res.json({ app: normalizedApp, timestamp: Date.now() });
```

---

### BUG B — Sleep chart not rendering

**Root cause:** `getSleepTrends()` at `main.ts:9552-9657` computes:
```
actualSleepSeconds = MAX(0, total_sleep_seconds - avgPreSleepSec)
```
where `avgPreSleepSec` is derived from `device_off_to_sleep_seconds`. If any sleep session has `device_off_to_sleep_seconds` set to a wildly inflated value (e.g. 86400+ seconds = 24h+), `actualSleepSeconds` collapses to 0 for that day and the chart renders nothing.

**Before touching anything, read:**
- `main.ts:8836-8872` (`addManualSleep`) — does it store `device_off_to_sleep_seconds`? Where does the value come from?
- `main.ts:9552-9657` (`getSleepTrends`) — what happens if `avgPreSleepSec` > `total_sleep_seconds`?
- Open Sleep Debug panel in the running app — check the raw `device_off_to_sleep_seconds` values

**Fix:**
1. Add a sanity cap in `getSleepTrends()` — `device_off_to_sleep_seconds` should never exceed `duration_seconds`. Cap it before the subtraction:
```typescript
const safePre = Math.min(avgPreSleepSec, totalSleepSeconds * 0.5); // pre-sleep can't exceed 50% of total
const actualSleepSeconds = Math.max(0, totalSleepSeconds - safePre);
```
2. In `addManualSleep()`, if the modal doesn't collect `device_off_to_sleep_seconds`, ensure it is stored as `0`, not `null` or some computed garbage value.
3. Guard the chart render: if `actualSleepSeconds === 0` but `duration_seconds > 0`, fall back to using `duration_seconds` directly rather than showing nothing.

---

### BUG C — Long session durations incorrect on StatsPage

**Context:** Checkpoint interval is 5 minutes — a 3-hour session creates ~36 log entries of ~5 minutes each. `appStats` in `App.tsx:930-965` groups by `app` and sums `duration_ms`, so the total should be correct if the grouping is working.

**Before touching anything, read:**
- `App.tsx:930-965` (`appStats` useMemo) — confirm it sums `duration_ms` across ALL entries for the same app name, including checkpoint entries
- `StatsPage.tsx` — confirm it receives and displays `appStats`, not a separate query
- Check if game app names are stable across checkpoint entries (PowerShell may return a different string than `active-win` did on first detection)

**Likely fix:** App name normalization. If `active-win` returns `"Forza Horizon 5"` for the first entry but PowerShell returns `"ForzaHorizon5.exe"` for checkpoint entries, they never group together.

**Fix if name instability confirmed:**
```typescript
// In pollForeground(), normalize the app name from PowerShell to match active-win format:
function normalizeAppName(rawName: string): string {
    return rawName
        .replace(/\.exe$/i, '')           // strip .exe
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // CamelCase → spaced (ForzaHorizon → Forza Horizon)
        .trim();
}
```
Store the normalized name in `currentApp` so all checkpoint entries use the same string.

---

### BUG D — AFK→activity conversion doesn't refresh ExternalPage

**Root cause:** `stopAfkSession()` at `main.ts:8697-8726` updates the `external_sessions` record but likely does NOT dispatch the `external-data-changed` IPC event that `ExternalPage.tsx` listens for.

**Before touching anything, read:**
- `main.ts:8697-8726` — does the `stopAfkSession` handler call `webContents.send('external-data-changed')` at the end?
- `ExternalPage.tsx` — confirm it has a `useEffect` listening for `external-data-changed`

**Fix:** Add the event dispatch at the end of the `stopAfkSession` IPC handler in `main.ts`:
```typescript
// At end of stopAfkSession handler, after the DB update:
mainWindow?.webContents.send('external-data-changed');
```

---

### BUG E — Polling efficiency (lower priority, do last)

**Current problem:** `setInterval(pollForeground, 2000)` runs every 2 seconds. The PowerShell fallback uses `execSync` — a blocking call on the main thread. This can cause UI jank and wastes CPU.

**Fix:**
1. Reduce poll interval from 2000ms to 5000ms
2. Only trigger the PowerShell fallback after 3+ consecutive null polls (15 seconds of no detection), not immediately on first null
3. Wrap the `execSync` call in a try/catch that catches the 100ms timeout — already should be there, confirm it is

```typescript
// Change polling interval:
setInterval(pollForeground, 5000); // was 2000

// In pollForeground(), only run PowerShell after threshold:
const PS_FALLBACK_THRESHOLD = 3;
if (result === null) {
    consecutiveNullPolls++;
    if (consecutiveNullPolls >= PS_FALLBACK_THRESHOLD) {
        // run PowerShell fallback
    }
} else {
    consecutiveNullPolls = 0;
}
```

---

## Phase 1 — Diagnosis (READ ONLY, no code changes yet)

Complete all reads before writing a single line. Answer each question explicitly before moving on.

| # | Read | Answer needed |
|---|------|--------------|
| 1 | `main.ts` `/foreground-app` handler | What exact string format does it return for `app`? (e.g. `"brave.exe"`, `"Brave"`, `"brave"`) |
| 2 | `browser-extension/background.js` `BROWSER_NAME` | What is the value? What does `checkBrowserFocus()` compare? |
| 3 | `main.ts:8200-8203` | Confirm the exact `is_browser_focused` filter condition |
| 4 | `main.ts:8836-8872` (`addManualSleep`) | Does it write `device_off_to_sleep_seconds`? What value? |
| 5 | `main.ts:9552-9657` (`getSleepTrends`) | What happens when `avgPreSleepSec` > `total_sleep_seconds`? |
| 6 | `App.tsx:930-965` (`appStats` useMemo) | Does it group correctly for checkpoint entries? Same app name? |
| 7 | `main.ts:8697-8726` (`stopAfkSession`) | Does it dispatch `external-data-changed` event? |
| 8 | `ExternalPage.tsx` | Does it listen for `external-data-changed` and call reload? |

---

## Phase 2 — Fix (in this order)

1. **Bug A** — Browser focus mismatch: normalize app names in `/foreground-app` response AND in `checkBrowserFocus()` comparison
2. **Bug B** — Sleep trends: add `device_off_to_sleep_seconds` sanity cap; fix fallback render
3. **Bug D** — AFK refresh: add `external-data-changed` dispatch to `stopAfkSession`
4. **Bug C** — Long session grouping: add PowerShell app name normalization if confirmed to be the cause
5. **Bug E** — Poll interval: reduce to 5s, add null-poll threshold for PS fallback

---

## Phase 3 — Verification Checklist

Run `npm start` and check each item. Do not mark done until verified in the running app.

- [ ] Open Brave → browse 3+ sites → check Dashboard "Recent Sessions" — website entries appear
- [ ] Open DevTools → Console — filter `[DeskFlow]` — confirm browser focus check logs `isBrowserFocused: true`
- [ ] Open Network tab — filter `foreground-app` — confirm response `app` field format matches extension `BROWSER_NAME`
- [ ] Launch Forza / any fullscreen game → wait 10s → Alt+Tab back → check Dashboard — game logged
- [ ] Open ExternalPage → Sleep Debug panel → confirm `device_off_to_sleep_seconds` values are reasonable (< duration)
- [ ] Check Sleep Trends chart renders bars for each day with a sleep entry
- [ ] Trigger AFK → select activity from prompt → confirm ExternalPage refreshes without manual reload
- [ ] Open StatsPage after a 30+ minute app session — confirm correct total duration shown
- [ ] Check console for blocking main thread warnings (none expected after poll interval fix)

---

## Files to Modify

| File | What changes |
|------|-------------|
| `src/main.ts` | `/foreground-app` response normalization; `getSleepTrends` cap; `stopAfkSession` event dispatch; poll interval; PS fallback threshold |
| `browser-extension/background.js` | `checkBrowserFocus()` comparison normalization |
| `src/App.tsx` | `appStats` app name normalization if needed |
| `src/pages/ExternalPage.tsx` | Confirm `external-data-changed` listener exists; add if missing |

Do NOT modify `src/index.css` (Tailwind v4). Do NOT use git commands.

---

## Key Code References

```
main.ts
  2211-2217   Constants (MAX_SESSION_MS, CHECKPOINT_INTERVAL_MS, etc.)
  2218-2223   TRANSIENT_APPS filter list
  2368-2495   pollForeground() — main tracking loop
  8053-8187   Browser HTTP server + /foreground-app handler
  8194-8363   handleBrowserData() — browser data ingestion
  8200-8203   is_browser_focused filter (the blocker)
  8667-8693   startAfkSession()
  8697-8726   stopAfkSession()
  8836-8872   addManualSleep()
  9008-9057   confirmSleep()
  9552-9657   getSleepTrends()
  9812-9816   Before-quit session logging

App.tsx
  388-391     filteredLogs useMemo
  407-464     loadData()
  930-965     appStats useMemo (grouping + summing)

ExternalPage.tsx
  2462        fellAsleep date heuristic

browser-extension/background.js
  checkBrowserFocus()   Browser focus validation
  BROWSER_NAME          Browser identifier constant
```

---

## Constraints

- Tailwind v4 ONLY — `@import "tailwindcss"` in `src/index.css`. Never change it.
- No git commands — `git checkout`, `git restore`, `git reset`, `git stash` are forbidden.
- Renderer uses ONLY IPC via `window.deskflowAPI` — no `require()`, no direct `fs` access in renderer files.
- `better-sqlite3` runs in main process only.
- After any `main.ts` change: `npm run build:electron`. After any renderer change: `npm run build:renderer`. After both: `npm run build`.