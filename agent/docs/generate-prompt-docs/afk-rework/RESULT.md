<aside>
⚠️

**Read this first — the codebase has moved past `CONTEXT_BUNDLE.md`.** A prior rework already landed ~70% of the mandate. Re-doing those steps blindly will create churn or destroy working code. This packet is corrected against the *actual* `src.zip` you attached. Line numbers below are verified against that source.

</aside>

## 0. Reality check — what is already done vs. what the bundle claims

The `CONTEXT_BUNDLE.md` describes an **older** state of the app. Here is what the current `src.zip` actually contains:

| Bundle claim | Actual current state | Action needed |
| --- | --- | --- |
| AFK seeded in `external_activities` | **Already removed** — `defaultActivities` at `main.ts:2795` has no AFK | None (seed is clean) |
| `startAfkSession()` / `setTracking(false)` in idle loop | **Already gone** — idle loop at `App.tsx:1834` just sets `isIdle`, no DB write, no tracking pause | None |
| `start-afk-session` / `stop-afk-session` / `reclassify-afk-session` / `debug-save-afk` IPC | **Already removed** from `main.ts` and `preload.ts` | None |
| `batch-save-afk-segments` | **Already replaced** by `create-external-sessions-batch` (`main.ts:14763`) | None |
| `delete-external-activity` blocked by `is_default = 0` | **Already fixed** — guard removed (`main.ts:14748`) | None |
| No "I wasn't AFK" option | **Already added** — emerald button + `onNotAfk` prop in `AfkPromptModal.tsx`, wired at `App.tsx:3312` | None |
| Modal filters AFK from picker | **Already neutral** — `visibleActivities = allActivities` (`AfkPromptModal.tsx:60`) | None |

<aside>
🎯

**So why do you still see AFK polluting external stats?** Three concrete leftovers — these are the *entire* root cause:

</aside>

1. **The legacy-AFK cleanup migration is trapped inside a dead branch.** At `main.ts:2794` the AFK migration (`main.ts:2815–2828`, which hides the old AFK row and closes dangling sessions) lives **inside** `if (activityCount.count === 0)`. That block only runs when `external_activities` is *empty* (a brand-new DB). Your DB already has rows, so **the migration never executes** — the old AFK activity row (with `is_visible = 1`) and all its `external_sessions` survive untouched.
2. **`ExternalPage` hides AFK with `a.name !== 'AFK'`** at lines `335, 558, 570, 692, 1622, 2365, 2427`. This masks the AFK *activity* from the management list — so you "removed it from the list" but there was never a real delete; the underlying row + its sessions still exist and still feed stats.
3. **Leftover `external_sessions` rows** pointing at the old AFK activity still sum into External Page stats and `get-typical-activity-at-time` history.

That is the bug. Everything below fixes it permanently and closes the remaining genuine gaps (duration gating, elapsed-timer continuity, explicit `pendingIdleRange`, idle indicator).

---

## 1. Architecture Summary

**Principle:** AFK is *not* an activity. It is a transient, in-memory flag meaning "this stretch of time has not been labeled yet." It never touches the DB until the user explicitly assigns a real activity.

**Data model (final state):**

- `external_activities` — **never** contains an AFK row. (Seed already clean; migration deletes any historical AFK row.)
- `external_sessions` — **never** contains AFK placeholder rows. Old ones are deleted by migration.
- Idle state lives only in renderer memory: `pendingIdleRange = { idleStart, idleEnd }`.

**Tracking during idle:** `pollForeground()` in main (`main.ts:3355`) only early-returns on `!isTracking`. The renderer no longer flips `isTracking` off on idle, so **the main process keeps logging the real foreground app the whole time** — nothing is lost. We keep BOTH the app session (Dashboard truth: which app was foreground) and any external session the user adds (External truth: what they were actually doing). They are orthogonal.

**Resolution on return:** duration-gated prompt. Tiny idle → silent discard. Moderate → gentle nudge defaulting to "I wasn't AFK." Long → full activity picker. "I wasn't AFK" is the primary, one-click path.

---

## 2. Implementation Plan (ordered, exact)

### Step 1 — Make the legacy-AFK migration actually run (THE fix)

**File:** `src/main.ts` — migration currently nested at lines **2815–2828** inside the `if (activityCount.count === 0)` block starting at **2794**.

**Action:** Move the AFK cleanup OUT of the empty-table branch so it runs on every startup, and make it a hard delete (AFK time is unknown/meaningless — the user wants it gone from stats, not preserved). Place it immediately *after* the `if (activityCount.count === 0) { … }` block closes (after line ~2829), still inside DB init.

```tsx
// ---- AFK purge migration (idempotent, runs every startup) ----
// AFK is no longer a real activity. Remove any legacy AFK activity row
// and its placeholder sessions so they stop polluting External stats.
try {
  const afkRows = db.prepare("SELECT id FROM external_activities WHERE name = 'AFK'").all() as Array<{ id: number }>;
  if (afkRows.length > 0) {
    const ids = afkRows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const delSessions = db.prepare(`DELETE FROM external_sessions WHERE activity_id IN (${placeholders})`).run(...ids);
    const delActs = db.prepare(`DELETE FROM external_activities WHERE id IN (${placeholders})`).run(...ids);
    console.log('[DeskFlow] AFK purge: removed', delActs.changes, 'AFK activity row(s) and', delSessions.changes, 'placeholder session(s)');
  }
} catch (e) { console.error('[DeskFlow] AFK purge migration error:', e); }
```

**Also delete** the now-redundant gated migration at `main.ts:2815–2828` (the `is_visible = 0` hide block) to avoid two competing behaviors.

> Note on the data-loss history you mentioned: a restore likely re-created the AFK row before the seed was cleaned. Because the only cleanup was gated behind the empty-table check, it never ran on the restored DB. This idempotent purge fixes that for good.
> 

### Step 2 — Remove the `a.name !== 'AFK'` masking filters

**File:** `src/pages/ExternalPage.tsx` — lines **335, 558, 570, 692, 1622, 2365, 2427**.

**Action:** Replace each `data.filter((a: any) => a.name !== 'AFK')` (and the `updated.filter(...)` variants) with the unfiltered array (`data` / `updated`). After Step 1 there is no AFK row, so the filter is dead code that would also wrongly hide a *legitimate* future user activity literally named "AFK". Use a single find-and-replace but verify each of the 7 call sites individually (CRLF preserved).

### Step 3 — Add explicit `pendingIdleRange` + keep the elapsed timer running (Req 2)

**File:** `src/App.tsx`.

**3a.** Add state near the other idle refs (around `App.tsx:1382`):

```tsx
const pendingIdleRangeRef = useRef<{ idleStart: number; idleEnd: number | null } | null>(null);
```

**3b.** In the idle-detection interval at **`App.tsx:1834–1845`**, the current branch sets `isIdle`, stamps `idleStartRef`, then `return`s — which **freezes** `elapsedTime`. Change it to record the pending range *once* and then keep counting elapsed:

```tsx
if (!isPassiveActive && systemIdleSecondsRef.current * 1000 > idleMs) {
  if (!pendingIdleRangeRef.current) {
    pendingIdleRangeRef.current = { idleStart: Date.now() - idleMs, idleEnd: null };
    idleStartRef.current = pendingIdleRangeRef.current.idleStart;
    setIsIdle(true);
    afkPromptShownRef.current = false;
  }
  // DO NOT pause tracking and DO NOT discard the session — keep counting.
  setElapsedTime(prev => prev + 1);
  return;
}
setElapsedTime(prev => prev + 1);
```

Note `idleStart` is back-dated by `idleMs` because OS idle only crosses the threshold after the user has *already* been gone that long.

### Step 4 — Duration-gated prompt on return (Req 4)

**File:** `src/App.tsx`, `idleReturnFnRef.current` at **1701–1730**.

Replace the unconditional queue push with gating based on the resolved idle duration, and stamp `idleEnd`:

```tsx
idleReturnFnRef.current = async () => {
  if (sleepActiveRef.current || sleepDetectionPendingRef.current) { afkPromptShownRef.current = true; return; }
  if (afkPromptShownRef.current) return;
  afkPromptShownRef.current = true;

  const range = pendingIdleRangeRef.current;
  const idleStartMs = range?.idleStart ?? idleStartRef.current;
  const nowMs = Date.now();
  if (range) range.idleEnd = nowMs;
  const elapsedSec = idleStartMs ? Math.floor((nowMs - idleStartMs) / 1000) : 0;

  // Req 4: tiny idle → silent discard, no prompt
  if (elapsedSec < 60) { pendingIdleRangeRef.current = null; return; }

  const duration = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
  const entry: AfkPromptEntry = {
    id: afkQueueIdRef.current++,
    duration,
    idleStartMs,
    returnMs: nowMs,
    // Req 4: moderate idle (1–15m) defaults to "I wasn't AFK"
    defaultNotAfk: elapsedSec <= 15 * 60,
  };
  setAfkPromptQueue(prev => [...prev, entry]);
};
```

Extend the `AfkPromptEntry` interface (`App.tsx:1385`) with `defaultNotAfk: boolean`.

### Step 5 — Clear `pendingIdleRange` on every resolution path

**File:** `src/App.tsx`.

- `handleAfkConfirm` (**1464**): after slicing the queue, add `pendingIdleRangeRef.current = null;`
- `handleAfkDismiss` (**1475**): add `pendingIdleRangeRef.current = null;`
- The `onNotAfk` inline handler at **3312** (`() => setAfkPromptQueue(prev => prev.slice(1))`): change to also clear the ref:

```tsx
onNotAfk={() => { pendingIdleRangeRef.current = null; setAfkPromptQueue(prev => prev.slice(1)); }}
```

- In `handleActivity` (**1732**) and the heartbeat auto-resume (**794–799**): **do not** reset `setSessionStart(new Date())` when returning from idle if you want the pre-idle app session to stay continuous; leaving it is acceptable since main-process logging is authoritative. (No change required for correctness; note for awareness.)

### Step 6 — Rapid idle/wake safety (Constraint)

The `< 60s` silent-discard in Step 4 plus the single-shot `if (!pendingIdleRangeRef.current)` guard in Step 3 already absorb 30-second-step-away cycles: a short idle sets the range, return resolves it to a no-op, ref cleared. The existing `idleCooldownRef` (12s) at `App.tsx` still prevents immediate re-trigger.

### Step 7 — Idle indicator dot (UX)

**File:** wherever the live timer renders (the tracking header in `App.tsx`). Add a small pulsing amber dot bound to `isIdle`:

```tsx
{isIdle && (
  <span title="Idle detected — we'll ask what you were doing"
        className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-2" />
)}
```

---

## 3. IPC Contract

<aside>
✅

No new IPC is required — the clean surface already exists.

</aside>

| Channel | Status | Payload | Notes |
| --- | --- | --- | --- |
| `create-external-sessions-batch` | **Keep** (`main.ts:14763`) | `{ segments: { activityId, startedAt, endedAt }[] }` → `{ success, sessionIds }` | The AFK-free batch insert. Used by `handleAfkConfirm`. |
| `delete-external-activity` | **Keep** (`main.ts:14748`) | `id` → `boolean` | Guard already removed; deletes sessions + activity. |
| `get-typical-activity-at-time` | **Keep** (`main.ts:14791`) | `timestamp` → `{id,name,color} \ | null` |
| `set-tracking` | **Keep** (`main.ts:4180`) | `boolean` → `boolean` | Must **not** be called with `false` on idle. (Already not called.) |
| `start-afk-session`, `stop-afk-session`, `reclassify-afk-session`, `debug-save-afk`, `batch-save-afk-segments` | **Already removed** | — | Confirm no dangling `preload.ts` exports remain (none found). |

Preload (`preload.ts`) backward-compat: the removed AFK methods are already gone from both `main.ts` and `preload.ts`, so there is no live caller. No versioning shim needed.

---

## 4. Component Changes

**`AfkPromptModal.tsx`** — already has the three pathways (Save activities / `onNotAfk` emerald primary / dismiss). Two small adds:

1. Accept a `defaultNotAfk?: boolean` prop. When true, render the "I wasn't AFK — continue tracking" button as the **top, emphasized** action and collapse the segment editor behind a "Actually, let me log it" disclosure, so moderate idles are one click.
2. Header copy already reads "Back from a break?" — keep. Ensure it never shows a stopwatch/auto-running timer (it doesn't; `liveElapsed` is display-only).

**`App.tsx` modal render (3298–3316)** — pass `defaultNotAfk={entry.defaultNotAfk}` and the updated `onNotAfk` from Step 5.

**`ExternalPage.tsx`** — remove the 7 AFK filters (Step 2). No other changes; stats recompute correctly once AFK rows are purged.

**`DashboardPage.tsx`** — no change. It reads `logs` (foreground app sessions) which were never AFK rows.

---

## 5. Data Migration (existing DBs)

Run on every startup, idempotent (this is Step 1, expressed as SQL):

```sql
-- 1. Remove placeholder AFK sessions (unknown time, no real info)
DELETE FROM external_sessions
 WHERE activity_id IN (SELECT id FROM external_activities WHERE name = 'AFK');

-- 2. Remove the AFK activity row(s) themselves
DELETE FROM external_activities WHERE name = 'AFK';
```

No schema change. `external_activities` / `external_sessions` schemas stay as-is. Sessions the user previously *reclassified* into real activities are untouched (different `activity_id`).

<aside>
🛟

Take a verified DB backup before first run of the purge (your backup scheduler at `startBackupScheduler` already snapshots; confirm a fresh snapshot exists). The delete is intentional and not reversible without it.

</aside>

---

## 6. Verification Steps

1. **Migration runs on existing DB:** Launch app. Console shows `AFK purge: removed N AFK activity row(s) and M placeholder session(s)`. Re-launch → it logs `0 / 0` (idempotent).
2. **AFK gone from External Page:** Open External Page → no "AFK" in activity list, totals, or session history. Reduce-stats reflect drop.
3. **No AFK in pickers:** Trigger the return prompt → activity picker lists only real activities, no "AFK".
4. **Tracking continues during idle:** Set `idleThreshold` low (1 min). Open VS Code, sit idle > 1 min without touching mouse. Confirm (a) amber pulse dot appears, (b) the renderer elapsed timer keeps incrementing, (c) main-process log still records VS Code for the idle window (check `logs` table / Dashboard).
5. **< 60s false trigger:** Force a brief idle (lower threshold, idle ~30s, return). No prompt appears; `pendingIdleRange` cleared (add a temporary console log to confirm).
6. **1–15 min moderate:** Idle ~3 min, return. Prompt shows with "I wasn't AFK — continue tracking" emphasized/default; one click closes it, **zero** new `external_sessions` rows created.
7. **> 15 min long:** Idle > 15 min, return. Prompt shows with segment/activity picker ready. Assign two activities → confirm two `external_sessions` rows created via `create-external-sessions-batch`, and the original app session still present (BOTH kept).
8. **Delete works:** Create a throwaway external activity, delete it from External Page → row and its sessions gone (`delete-external-activity`).
9. **Rapid cycle:** Step away/return repeatedly at ~30s each → no prompts, no DB writes, no stuck idle state.
10. **CRLF intact:** `git diff --stat` shows only intended lines changed; no whole-file reformat.

---

## 7. File / Line Index (verified against your `src.zip`)

| File | Lines | What's there |
| --- | --- | --- |
| `main.ts` | 2794 | `if (activityCount.count === 0)` — seed + **gated** AFK migration |
| `main.ts` | 2795–2812 | `defaultActivities` (no AFK ✓) |
| `main.ts` | 2815–2828 | gated AFK hide migration (delete; replace per Step 1) |
| `main.ts` | 3355 | `pollForeground()` — early-returns only on `!isTracking` |
| `main.ts` | 4180 | `set-tracking` handler |
| `main.ts` | 14748 | `delete-external-activity` (guard already removed ✓) |
| `main.ts` | 14763 | `create-external-sessions-batch` |
| `main.ts` | 14791 | `get-typical-activity-at-time` (excludes AFK) |
| `App.tsx` | 794–799 | heartbeat idle auto-resume |
| `App.tsx` | 1382–1391 | idle state + `AfkPromptEntry` interface + `afkPromptQueue` |
| `App.tsx` | 1464–1481 | `handleAfkConfirm` / `handleAfkDismiss` |
| `App.tsx` | 1701–1730 | `idleReturnFnRef.current` (add duration gating) |
| `App.tsx` | 1732–1751 | `handleActivity` (return-from-idle) |
| `App.tsx` | 1834–1845 | idle-detection interval (keep elapsed counting) |
| `App.tsx` | 3298–3316 | `AfkPromptModal` render + `onNotAfk` |
| `AfkPromptModal.tsx` | 60 | `visibleActivities = allActivities` (no AFK filter ✓) |
| `AfkPromptModal.tsx` | ~395–415 | Save / `onNotAfk` / dismiss buttons |
| `ExternalPage.tsx` | 335, 558, 570, 692, 1622, 2365, 2427 | `a.name !== 'AFK'` filters (remove) |
| `preload.ts` | 76, 459, 464, 496 | `setTracking`, `deleteExternalActivity`, `createExternalSessionsBatch`, `getTypicalActivityAtTime` |

---

## 8. Scope summary for the Hands agent

- **2 real edits do the user-visible fix:** Step 1 (ungate + purge migration) and Step 2 (drop ExternalPage filters). Ship these first — they alone make AFK stop counting as external activity and clean the existing DB.
- **Steps 3–7 are the polish** to fully satisfy the mandate (timer continuity, duration gating, explicit `pendingIdleRange`, idle dot). Lower risk, do after verifying Steps 1–2.
- **Do NOT** re-add any AFK seed, AFK IPC handler, or `setTracking(false)` on idle. Those were already removed; re-adding them recreates the original bug.