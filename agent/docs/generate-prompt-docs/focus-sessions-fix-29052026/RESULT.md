Looking at this, I need to trace the entire data flow from foreground polling to session display, identify every broken link, and fix them surgically. Let me analyze each step.

---

## `agent/docs/focus-sessions-fix-29052026/RESULT.md`

```markdown
# RESULT — Focus Sessions End-to-End Fix

## Root Cause Analysis

Three distinct bugs prevent Focus Sessions from working:

### Bug 1: Session refs never reset after save (CRITICAL)
The session saver effect starts a session by setting `productivitySessionStartRef.current = Date.now()`.
When the user switches away from a productive app, the effect saves the session to the DB — but **never
resets `productivitySessionStartRef.current` back to `null`**. This means:

- First productive session: ref is null → starts new session ✅
- User switches away: session saved → ref STILL has old timestamp ❌
- Second productive session: ref is NOT null → "start new session" branch is SKIPPED ❌
- No subsequent sessions ever start. Only the first session ever works.

### Bug 2: Foreground listener has no cleanup + stale deps
The `onForegroundChange` useEffect at line 667:
- Has `lastNonBrowserApp` in its dependency array
- The handler calls `setLastNonBrowserApp(data)` → triggers re-render → re-runs effect
- **No cleanup function returned** — old listeners are never removed
- Result: listeners stack up (N listeners after N foreground changes), each with stale closures
- Stale closures mean `trackingBrowser`, `trackerAppMode` may have outdated values

### Bug 3: IIFE hooks anti-pattern at line 2386
`useState`, `useCallback`, `useEffect` inside `{(() => { ... })()}` in JSX:
- If the IIFE is inside any conditional render, hooks break (call order changes between renders)
- Even if always rendered, the pattern is fragile — any future conditional wrapping breaks it
- Makes debugging impossible (state is "hidden" inside an inline closure)
- The `useEffect` inside the IIFE for auto-refresh may not fire correctly

## Secondary Issues

- **Missing `getProductivitySessions` in Window type** — TypeScript only, not runtime-breaking
- **No diagnostic logging** — impossible to trace where the chain breaks
- **Browser mode doesn't set `currentApp`** — focus tracking pauses when user is in browser (by design, but `lastNonBrowserApp` fallback may be stale)

## What Was Fixed

| # | Bug | Fix |
|---|-----|-----|
| 1 | Session refs never reset | Add `= null` reset after save (both success and skip paths) |
| 2 | Listener stacking + stale deps | Ref-based handler pattern, single registration, empty deps |
| 3 | IIFE hooks | Move all hooks to component body, keep JSX inline |
| 4 | Missing type declaration | Add `getProductivitySessions` to Window.deskflowAPI |
| 5 | No logging | Add `console.log('[Focus]')` at every decision point |
| 6 | Preload unsubscribe | Modify `onForegroundChange` to return cleanup function |

## Verification

1. Open Dashboard → switch to VS Code → Focus timer should start accumulating
2. Switch to Slack (after 1+ min) → session should save → appear in Focus Sessions list
3. Switch back to VS Code → NEW session should start (this was the main bug)
4. Switch to browser (with tracking) → timer pauses, doesn't crash
5. Check console for `[Focus]` logs — should show full chain
6. Stats (Today Best, Week Best, All-Time PB) should update after session saves
```

---

## Code Changes

### `src/preload.ts` — Fix `onForegroundChange` to return unsubscribe

Find the existing `onForegroundChange` bridge and replace:

```typescript
// BEFORE:
onForegroundChange: (callback) => ipcRenderer.on('foreground-changed', (_event, data) => callback(data)),

// AFTER:
onForegroundChange: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('foreground-changed', handler);
    return () => { ipcRenderer.removeListener('foreground-changed', handler); };
},
```

---

### `src/App.tsx` — Add missing type declaration

Find the `Window` interface's `deskflowAPI` type declaration (~line 88) and add `getProductivitySessions`:

```typescript
// Add to the deskflowAPI interface, near the other productivity session methods:
getProductivitySessions: (opts?: any) => Promise<any>;
```

---

### `src/pages/DashboardPage.tsx` — The main fixes

#### Change 1: Add new refs (near line 225-237 with other refs)

Add after the existing ref declarations:

```typescript
const lastNonBrowserAppRef = useRef<ForegroundData | null>(null);
const foregroundHandlerRef = useRef<((data: ForegroundData) => void) | null>(null);
```

#### Change 2: Replace the foreground listener useEffect (line 667-761)

Replace the entire useEffect block:

```typescript
// ── Stable foreground handler (updated every render with fresh closure) ──
foregroundHandlerRef.current = (data: ForegroundData) => {
    console.log('[Focus] Foreground change:', data.app, '| category:', data.category);

    const isTrackingBrowser = trackingBrowser && data.app &&
        data.app.toLowerCase().includes(trackingBrowser.toLowerCase());
    const isTrackerApp = data.app && (
        data.app.toLowerCase().includes('deskflow') ||
        data.app.toLowerCase().includes('electron')
    );

    if (isTrackingBrowser) {
        console.log('[Focus] Browser tracking detected — isInBrowser=true, currentApp unchanged');
        setIsInBrowser(true);
        return;
    }

    setIsInBrowser(false);
    setCurrentWebsite(null);

    if (isTrackerApp) {
        if (trackerAppMode === 'show-other') {
            if (lastNonBrowserAppRef.current) {
                console.log('[Focus] Tracker app (show-other) — restoring:', lastNonBrowserAppRef.current.app);
                setCurrentApp(lastNonBrowserAppRef.current);
            }
            return;
        } else if (trackerAppMode === 'pause') {
            console.log('[Focus] Tracker app (pause) — pausing');
            setCurrentApp(lastNonBrowserAppRef.current || null);
            setIsPaused(true);
            setPausedByTrackerApp(true);
            return;
        }
        // 'track' mode falls through to normal handling
    }

    console.log('[Focus] Setting currentApp:', data.app, '| category:', data.category);
    lastNonBrowserAppRef.current = data;
    setLastNonBrowserApp(data);
    setCurrentApp(data);

    // ── Activity feed tracking (preserve existing logic) ──
    // ... (keep whatever activity feed code was here unchanged)
};

// ── Register listener ONCE with cleanup ──
useEffect(() => {
    const handler = (data: any) => {
        foregroundHandlerRef.current?.(data as ForegroundData);
    };
    const unsubscribe = window.deskflowAPI.onForegroundChange(handler);
    return () => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    };
}, []); // Empty deps — handler ref always has latest closure
```

#### Change 3: Fix session saver effect — reset refs after save (line 948-1007)

Find the session saver effect. The critical fix is adding ref resets after the save attempt. Find the block that handles `!shouldCountSession && productivitySessionStartRef.current` and modify:

```typescript
// Inside the session saver useEffect, find the "end session" block:

if (!shouldCountSession && productivitySessionStartRef.current) {
    const startTime = productivitySessionStartRef.current;
    const durationSec = Math.round((Date.now() - startTime) / 1000);
    const sessionApp = productivitySessionAppRef.current;

    console.log('[Focus] Session ended. App:', sessionApp, '| Duration:', durationSec + 's', '| Min threshold: 60s');

    if (durationSec >= 60) {
        const session = {
            started_at: new Date(startTime).toISOString(),
            ended_at: new Date().toISOString(),
            duration_seconds: durationSec,
            app_name: sessionApp || 'Unknown',
            category: lastProductiveCategory || 'Unknown',
        };

        console.log('[Focus] Saving session:', session);
        window.deskflowAPI?.saveProductivitySession?.(session)
            .then((result: any) => {
                console.log('[Focus] Session saved:', result);
                // Dispatch event for UI refresh
                window.dispatchEvent(new CustomEvent('focus-session-saved', { detail: session }));
            })
            .catch((err: any) => {
                console.error('[Focus] Failed to save session:', err);
            });
    } else {
        console.log('[Focus] Session too short (< 60s), skipping save');
    }

    // ═══════════════════════════════════════════════════════
    // CRITICAL FIX: Reset refs so the NEXT session can start
    // ═══════════════════════════════════════════════════════
    productivitySessionStartRef.current = null;
    productivitySessionAppRef.current = null;
}
```

Also fix the "start session" block to add logging:

```typescript
if (shouldCountSession && !productivitySessionStartRef.current) {
    console.log('[Focus] Starting new productive session. App:', currentApp?.app, '| Category:', currentCategory);
    productivitySessionStartRef.current = Date.now();
    productivitySessionAppRef.current = isInBrowser
        ? (currentWebsite?.domain || lastNonBrowserApp?.app || 'Browser')
        : (currentApp?.app || 'Unknown');
}
```

Also add logging to the timer effect (line 839-945). Find where `tier` is computed:

```typescript
// After tier computation in the timer effect:
console.log('[Focus] Timer check — category:', currentCategory, '| tier:', tier,
    '| shouldAccumulate:', shouldAccumulate, '| shouldPause:', shouldPause,
    '| isInBrowser:', isInBrowser, '| app:', currentApp?.app);
```

Also fix the periodic flush effect (line 1010-1033) to reset the start time ref correctly:

```typescript
// In the periodic flush effect, after saving:
if (productivitySessionStartRef.current) {
    const durationSec = Math.round((Date.now() - productivitySessionStartRef.current) / 1000);
    if (durationSec >= 60) {
        const session = {
            started_at: new Date(productivitySessionStartRef.current).toISOString(),
            ended_at: new Date().toISOString(),
            duration_seconds: durationSec,
            app_name: productivitySessionAppRef.current || 'Unknown',
            category: lastProductiveCategory || 'Unknown',
        };

        window.deskflowAPI?.saveProductivitySession?.(session)
            .then((result: any) => {
                console.log('[Focus] Periodic flush saved:', result);
                window.dispatchEvent(new CustomEvent('focus-session-saved', { detail: session }));
            })
            .catch((err: any) => {
                console.error('[Focus] Periodic flush failed:', err);
            });

        // Restart the session timer (keep tracking, don't reset to null)
        productivitySessionStartRef.current = Date.now();
    }
}
```

#### Change 4: Extract IIFE hooks to component body (line ~2386)

Find the IIFE block in JSX that looks like:

```tsx
{(() => {
    const [focusSessions, setFocusSessions] = useState([]);
    const [todayBest, setTodayBest] = useState(0);
    // ... more hooks
    return (<div>...</div>);
})()}
```

**Move all hooks to the component body** (near the other useState declarations, around line 225-250):

```typescript
// ── Focus Sessions state (extracted from IIFE) ──────────────
const [focusSessions, setFocusSessions] = useState<any[]>([]);
const [focusTodayBest, setFocusTodayBest] = useState(0);
const [focusWeekBest, setFocusWeekBest] = useState(0);
const [focusAllTimePB, setFocusAllTimePB] = useState(0);
const [focusLoading, setFocusLoading] = useState(true);

const loadFocusSessions = useCallback(async () => {
    try {
        const data = await window.deskflowAPI?.getProductivitySessions?.({
            period: 'all',
            minDuration: 60,
        });
        if (data) {
            setFocusSessions(data.sessions || data || []);
            // Compute stats
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];

            let todayBest = 0, weekBest = 0, allTime = 0;
            for (const s of (data.sessions || data || [])) {
                const dur = s.duration_seconds || 0;
                if (dur > allTime) allTime = dur;
                if (s.started_at >= weekAgo && dur > weekBest) weekBest = dur;
                if (s.started_at >= todayStr && dur > todayBest) todayBest = dur;
            }
            setFocusTodayBest(todayBest);
            setFocusWeekBest(weekBest);
            setFocusAllTimePB(allTime);
        }
        setFocusLoading(false);
    } catch (err) {
        console.error('[Focus] Failed to load sessions:', err);
        setFocusLoading(false);
    }
}, []);

// Load on mount + refresh every 5s
useEffect(() => {
    loadFocusSessions();
    const interval = setInterval(loadFocusSessions, 5000);
    return () => clearInterval(interval);
}, [loadFocusSessions]);

// Listen for session-saved events
useEffect(() => {
    const handler = () => {
        console.log('[Focus] focus-session-saved event received, reloading');
        loadFocusSessions();
    };
    window.addEventListener('focus-session-saved', handler);
    return () => window.removeEventListener('focus-session-saved', handler);
}, [loadFocusSessions]);
```

Then **replace the IIFE in JSX** with a direct reference to the extracted state:

```tsx
// BEFORE (broken IIFE):
{(() => {
    const [focusSessions, setFocusSessions] = useState([]);
    // ... more hooks
    return (
        <div className="...">
            {/* Focus sessions UI */}
        </div>
    );
})()}

// AFTER (clean JSX referencing component-level state):
{
    <div className="...">
        {/* Focus sessions UI — same JSX, but references focusSessions, focusTodayBest, etc. from component body */}
        {focusLoading ? (
            <div className="text-xs text-zinc-500">Loading...</div>
        ) : (
            <>
                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="...">
                        <span className="text-[10px] text-zinc-500">Today Best</span>
                        <span className="text-sm font-mono text-emerald-400">
                            {focusTodayBest > 0 ? formatDuration(focusTodayBest) : '—'}
                        </span>
                    </div>
                    <div className="...">
                        <span className="text-[10px] text-zinc-500">Week Best</span>
                        <span className="text-sm font-mono text-cyan-400">
                            {focusWeekBest > 0 ? formatDuration(focusWeekBest) : '—'}
                        </span>
                    </div>
                    <div className="...">
                        <span className="text-[10px] text-zinc-500">All-Time PB</span>
                        <span className="text-sm font-mono text-amber-400">
                            {focusAllTimePB > 0 ? formatDuration(focusAllTimePB) : '—'}
                        </span>
                    </div>
                </div>

                {/* Session list */}
                {focusSessions.length === 0 ? (
                    <p className="text-[10px] text-zinc-600">No focus sessions yet</p>
                ) : (
                    <div className="space-y-1">
                        {focusSessions.slice(0, 10).map((session: any, i: number) => (
                            <div key={session.id || i} className="...">
                                <span className="text-xs text-zinc-300">{session.app_name}</span>
                                <span className="text-[10px] text-zinc-500">
                                    {formatDuration(session.duration_seconds)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}
    </div>
}
```

The exact JSX structure should match what was inside the IIFE — just without the hooks wrapper. The key change is that `focusSessions`, `focusTodayBest`, `focusWeekBest`, `focusAllTimePB`, and `focusLoading` now come from the component body instead of being declared inside the IIFE.

---

## Summary of All Changes

| File | Change | Why |
|------|--------|-----|
| `src/preload.ts` | `onForegroundChange` returns unsubscribe function | Enables proper cleanup, prevents listener stacking |
| `src/App.tsx` | Add `getProductivitySessions` to Window type | TypeScript correctness |
| `src/pages/DashboardPage.tsx` | Add `lastNonBrowserAppRef`, `foregroundHandlerRef` refs | Stable handler pattern, avoids stale closures |
| `src/pages/DashboardPage.tsx` | Replace foreground listener useEffect | Single registration, proper cleanup, ref-based handler |
| `src/pages/DashboardPage.tsx` | Reset `productivitySessionStartRef = null` after save | **THE MAIN BUG** — allows subsequent sessions to start |
| `src/pages/DashboardPage.tsx` | Reset `productivitySessionAppRef = null` after save | Clean state for next session |
| `src/pages/DashboardPage.tsx` | Move IIFE hooks to component body | Fixes hook anti-pattern, ensures hooks always run in order |
| `src/pages/DashboardPage.tsx` | Add `console.log('[Focus]')` at every decision point | Diagnostic logging for future debugging |