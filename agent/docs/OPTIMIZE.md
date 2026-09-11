<aside>
🤖

**Read this whole document before touching code.** It is written for a low/mid-tier coding agent. Every task gives the file, the symptom, the root cause, the exact change, and how to verify. Do tasks in order (P0 → P1 → P2). Do not improvise beyond what is written. Where it says “search for this snippet,” use a literal text search — line numbers may have shifted slightly.

</aside>

## 0. Hard rules (breaking any = failure)

<aside>
⛔

1. **Tailwind v4 only.** Keep `@import "tailwindcss";` in `src/index.css`. Never use `@tailwind base/components/utilities`.
2. **Never run destructive git** (`checkout`, `restore`, `reset --hard`, `stash`). Fix code manually.
3. **No Node in the renderer.** React files talk to main ONLY via `window.deskflowAPI` (preload). No `require`, `fs`, or direct DB in renderer.
4. **Do not change game / video / AFK tracking** except exactly as in Task T13/T14. Current game keep-alive and sleep logic is intentional.
5. After each task group, run `npm run build` and confirm it compiles before continuing. Make small, isolated commits per task.
6. Preserve all existing visual output. These are performance/safety changes, not redesigns.
</aside>

**Stack:** Electron ~34 (main = `src/main.ts` → `dist-electron/main.cjs`), preload = `src/preload.ts`, React 19 + Vite renderer, Three.js / @react-three/fiber for 3D, better-sqlite3 (JSON fallback via `useJson`).

**Key fact:** A pre-aggregated table `stats_daily` and handler `get-app-stats` (returns `{ app, category, totalSeconds, sessions }`) already exist, plus `computePlanetsFromStats()` in `OrbitSystem.tsx`. Most freezes happen because the UI ignores these and instead pulls tens of thousands of raw rows and aggregates them on the UI thread. **Fix theme: aggregate in SQL → send small data → compute off the main thread → render less.**

---

## 1. Root-cause summary

| Symptom | Real root cause | Fixed in |
| --- | --- | --- |
| Solar system / galaxy hard-freezes on All-time, needs restart | (a) `Math.max(...hugeArray)` spreads tens of thousands of args → RangeError: Maximum call stack size exceeded. (b) Up to 100k raw rows shipped to renderer and aggregated synchronously, both app + website galaxies at once. | T1, T2 |
| Timeline switch (week→month→all) very laggy | Each switch re-ships raw rows and re-runs O(n) aggregation on the main thread, no debounce, no abort. | T2, T6, T8 |
| Analytics subpage on ID Projects → not responding | Synchronous load of full dataset + heavy charts on mount, no pagination/defer. | T4 |
| Sync AI button freezes whole app | `sync-ai-usage` runs big synchronous DB + file parse on the main-process event loop, blocking all IPC. | T3 |
| City visualization (towers / cyberpunk city) laggy | Per-frame JS loop over every building every frame; particles/cars/signs heavy; frame-skip only in one quality mode. | T7 |
| Insights / Finance / general lag | `Math.max(...)` spreads + recompute on every render + weak memoization. | T6, T9 |

---

# 🔴 P0 — App-breaking freezes (do first)

## T1 — Kill the `Math.max(...spread)` crash (the All-time freeze)

**Why:** `Math.max(...arr)` passes each element as an argument. With all-time data (tens of thousands of items) this throws `RangeError: Maximum call stack size exceeded` and locks the renderer. Highest priority.

**Step 1 — add `src/utils/safeMath.ts`:**

```tsx
// Spread-free reducers. Math.max(...arr) crashes on large arrays.
export function maxOf(arr: number[], fallback = 0): number {
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m === -Infinity ? fallback : m;
}
export function minOf(arr: number[], fallback = 0): number {
  let m = Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m === Infinity ? fallback : m;
}
export function maxBy<T>(arr: T[], fn: (x: T) => number, fallback = 0): number {
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) { const v = fn(arr[i]); if (v > m) m = v; }
  return m === -Infinity ? fallback : m;
}
```

**Step 2 — replace every data-array spread.** Import the helpers and rewrite these exact spots:

- `src/components/OrbitSystem.tsx`
    - ~L735 `Math.max(...Object.values(...))` → collect totals into a `number[]`, then `maxOf(values, 1)`.
    - ~L2280 inside `useFrame`: `Math.max(...Array.from(particleOpacities.current))` → `maxOf(Array.from(particleOpacities.current), 0)`. **Runs every frame — fixing it also removes per-frame jank.**
    - ~L2543 `Math.max(...sortedApps.map(a => a.time), 1)` → `maxBy(sortedApps, a => a.time, 1)`.
    - ~L2755 `Math.max(...sortedApps.map(([, domainLogs]) => ...))` → `maxBy(sortedApps, ([, domainLogs]) => ..., 1)`.
- `src/pages/DashboardPage.tsx` L2039, L2059
- `src/pages/ExternalPage.tsx` L1015, L1147, L1193, L1213, L1429
- `src/pages/InsightsPage.tsx` L233, L1162
- `src/components/DayDetailPopup.tsx` L148, L499
- `src/components/finance/_fx/Sparkline.tsx` L22, L23
- `src/components/finance/FinanceLockScreen.tsx` L110

**Rule:** any `Math.max(...x)` / `Math.min(...x)` where `x` comes from logs/sessions/usage data MUST become `maxOf`/`minOf`/`maxBy`. Leave fixed small spreads like `Math.max(a, b)` alone.

**Acceptance:** Switch galaxy and solar system to All-time on a large DB → no crash, no RangeError.

---

## T2 — Stop shipping raw rows; aggregate in SQL, compute off-thread

**Why:** `getLogs` (`src/main.ts` ~L2962) returns up to **100,000 rows** (`SELECT * FROM logs ... LIMIT 100000`), and `get-logs-by-period` for `'all'` (~L5316) returns the **entire table with no LIMIT**. The renderer then groups/sorts synchronously for BOTH the apps and websites galaxies. This is the timeline lag and the all-time freeze.

**Step 1 — feed the galaxy from aggregates, not raw logs.** In the page that renders `<OrbitSystem>` (and inside `OrbitSystem.tsx`), replace the raw `logs`/`websiteLogs` data source:

- Fetch `window.deskflowAPI.getAppStats({ period, dateOffset })` (already grouped in SQL) instead of `getLogs()`/`getLogsByPeriod()`.
- Feed those into `computePlanetsFromStats(appStats, ...)` (already implemented ~L2501) instead of `computePlanets(rawLogs, ...)`.
- Keep the same visual structure; only the input source changes.

**Step 2 — add a website/domain aggregate** in `src/main.ts` next to `get-app-stats` (copy that handler’s `computePeriodRange` usage exactly):

```tsx
electron_1.ipcMain.handle('get-domain-stats', async (_, { period, dateOffset = 0 }) => {
  ensureDb();
  try {
    const range = computePeriodRange(period, dateOffset);
    const rows = db.prepare(`
      SELECT domain AS app, category,
             SUM(duration_ms)/1000 AS totalSeconds,
             COUNT(*) AS sessions
      FROM logs
      WHERE is_browser_tracking = 1 AND timestamp >= ? AND timestamp < ?
      GROUP BY domain, category
      ORDER BY totalSeconds DESC
      LIMIT 2000
    `).all(range.start, range.end);
    return rows;
  } catch (err) { console.error('[DeskFlow] get-domain-stats error:', err); return []; }
});
```

Expose it in `src/preload.ts` as `getDomainStats` (copy the `getAppStats` line). Build a `computeSolarSystemsFromStats` that mirrors `computeWebsiteSolarSystems` but takes grouped rows.

**Step 3 — cap the raw period query** so it can never return the whole table. In `src/main.ts` ~L5316:

```tsx
const stmt = db.prepare(`SELECT * FROM logs WHERE timestamp >= ? ORDER BY id DESC LIMIT 20000`);
return stmt.all(bounds.startISO);
```

Remaining raw-row consumers (e.g. a day detail list) must request a specific day/range, never `'all'`.

**Step 4 (after Steps 1–3 build & pass) — move any still-heavy client aggregation into a Web Worker.** Create `src/workers/galaxyWorker.ts` that receives grouped stats and returns `PlanetData[]`; call it via `new Worker(new URL('../workers/galaxyWorker.ts', import.meta.url), { type: 'module' })`. Show a light loading state while it runs; keep the canvas interactive. If a worker is too risky, Steps 1–3 alone remove ~95% of the cost — do the worker last.

**Acceptance:** week → month → all updates within ~1s and never blocks navigation; the `'all'` IPC payload is a few hundred grouped rows, not 100k.

---

## T3 — Make “Sync AI” non-blocking

**Why:** `src/main.ts` ~L8083 `ipcMain.handle('sync-ai-usage', ...)` does `await syncAllAIAgents(db)` — large synchronous SQLite writes + JSONL parsing on the main event loop, blocking all IPC, so the app looks frozen.

**Step 1 — fire-and-track, return immediately, stream progress:**

```tsx
let aiSyncRunning = false;
electron_1.ipcMain.handle('sync-ai-usage', async () => {
  if (useJson) return { success: false, message: 'AI sync requires SQLite' };
  if (aiSyncRunning) return { success: false, message: 'Sync already running' };
  aiSyncRunning = true;
  (async () => {
    try {
      const results = await syncAllAIAgents(db, (done, total, label) => {
        mainWindow?.webContents.send('ai-sync-progress', { done, total, label });
      });
      mainWindow?.webContents.send('ai-sync-done', { success: true, ...results });
    } catch (err) {
      mainWindow?.webContents.send('ai-sync-done', { success: false, error: String(err) });
    } finally { aiSyncRunning = false; }
  })();
  return { success: true, started: true };
});
```

**Step 2 — make `syncAllAIAgents` yield the event loop** so it never blocks even when detached: process agents/files in batches and `await new Promise(r => setImmediate(r))` between batches; wrap multi-row inserts in a single `db.transaction(...)` (better-sqlite3) so writes are fast and atomic; call the optional `onProgress(done, total, label)` callback each batch.

**Step 3 — renderer side (`pages/AiPage.tsx`):** add `ai-sync-progress` / `ai-sync-done` listeners (remove them on unmount). On click set a local `syncing` state + progress bar; the page stays usable and other pages stay navigable. On `ai-sync-done`, refresh via `clearAiPageCache()` + refetch.

**Acceptance:** clicking Sync AI shows progress, the rest of the app stays responsive and navigable, and results appear when done.

---

## T4 — Analytics subpage (ID Projects) must not hang

**Why:** opening the Analytics subpage triggers a synchronous full-dataset load + heavy chart mount. Files: `src/components/AnalyticsDashboard.tsx` and its data path in `pages/IDEProjectsPage.tsx` (handlers `get-page-stats` ~L5134 / `get-dashboard-aggregates` ~L4877).

**Fixes:**

1. **Aggregate in SQL** (like T2) — the analytics handler must `GROUP BY` in SQL and return summary rows only, with `LIMIT`. Never return raw `logs`.
2. **Defer mount:** wrap the dashboard in `React.lazy` + `<Suspense fallback={skeleton}>`, and only mount when the subpage is actually visible (gate on the active tab/route, not always-mounted).
3. **Defer charts:** render the page shell first, then mount Chart.js charts after first paint (e.g. in a `useEffect` that sets `ready=true`), so the click feels instant.
4. **Memoize** all derived series with `useMemo` keyed on the fetched data, and apply T1 (`maxBy`) to any `Math.max(...)` in chart scaling.
5. **Abort stale loads:** if the user navigates away or switches period mid-load, ignore the late result (use a request id / `mountedRef`).

**Acceptance:** opening Analytics shows a skeleton instantly and never triggers “not responding”, even on All-time.

---

# 🟡 P1 — Lag reduction

## T5 — OrbitSystem render cost (galaxy + solar system)

File: `src/components/OrbitSystem.tsx`. Current cost: `frameloop="always"` (~L4010), EffectComposer Bloom, two particle clouds of **6000 + 5000** points always present, per-planet procedural canvas textures, and **both** app and website solar systems computed even though only one is visible.

**Fixes:**

1. **Render only the active galaxy.** `appSolarSystems` and `websiteSolarSystems` are both `useMemo`-computed every time; only compute/render the one matching `galaxyType`. Gate the inactive `useMemo` behind `galaxyType === 'apps'` etc. (return `[]` when inactive).
2. **Quality tiers for particles.** Make `particleCount` depend on a quality setting: high=6000/5000, balanced=2500/2000, performance=1000/800. Reuse the existing graphics-quality setting used by AICityscape if present.
3. **`frameloop="demand"` when idle.** When the user isn’t interacting and animation is paused, switch to demand rendering, and pause rendering entirely when the window/tab is hidden (`document.visibilitychange`). This stops the GPU spinning at 100% on a static view.
4. **Cap DPR lower on performance:** `dpr={Math.min(window.devicePixelRatio, perf ? 1 : 1.5)}` and disable Bloom/Vignette in performance mode.
5. **Adaptive scaling:** keep `PerformanceMonitor`; on `onDecline` drop DPR / particle size / disable postprocessing.
6. Confirm `GLCleanup` runs on unmount (it does) and that `releasePlanetTextures` is called for every `acquirePlanetTextures` so the texture cache can’t grow without bound across timeline switches.

**Acceptance:** idle galaxy view uses far less GPU; performance mode holds a smooth frame rate on All-time.

## T6 — Fix the data-cache bug in `useAiPageData`

File: `src/hooks/useAiPageData.ts`. Bug: `cacheKey(name, [])` is always called with an empty args array (see the `fetch` body), so different periods/projects share one cache entry → stale data and redundant refetches.

**Fix:** accept a `deps`/`args` array param and include it in the cache key and in the `useCallback` deps; invalidate when deps change. Keep the 60s TTL but make it stale-while-revalidate (show cached immediately, refetch in background). Ensure `mountedRef` guards all `setState`.

## T7 — AICityscape (city / towers) per-frame cost

File: `src/components/AICityscape.tsx`. Buildings already use `InstancedMesh` (good), but `useFrame` runs a JS loop over **every building every frame** to lerp height/footprint morph (`InstanceBuildings`, ~L889+), and frame-skip exists only in `performance` quality.

**Fixes:**

1. **Settle and stop.** Track a per-frame max delta; once all buildings are within an epsilon of target (`|tgt-cur| < 0.01`), stop updating the instance matrices (set a `settled` ref) until `buildings`/metric changes. This removes steady-state CPU cost after the intro animation.
2. **Throttle morph** in all quality modes (e.g. update every 2nd frame unless `quality === 'high'`).
3. **Lower secondary detail by quality:** cars, neon signs, rooftop signs, ground strips, trees — reduce counts or disable in performance mode (they’re decorative).
4. **Dispose GLTF clones / textures** on unmount (the file disposes some textures; verify cars/signs clones and `disposeWindowPool()` are also disposed).
5. Keep `useGLTF.preload` but ensure models load behind `<Suspense>` so the page paints first.

**Acceptance:** city view holds a stable frame rate at rest; switching metric re-animates then settles to ~0 CPU.

## T8 — Debounce timeline switches + abort stale work (global)

Wherever a period selector drives a fetch (galaxy, solar, analytics, dashboard, insights):

1. **Debounce** rapid clicks (~150–250ms) before firing the fetch.
2. **Abort/ignore stale results** using a monotonically increasing request id; apply only the latest.
3. Show a skeleton/spinner during load instead of blocking.
4. Keep the previous view rendered until new data arrives (no white flash / no full unmount).

---

# 🟢 P2 — Security & hardening (SKILL.md: Secure Code Review)

## T9 — SQL injection & unsafe identifiers

1. **`getLogs(limit)`** (`src/main.ts` ~L2970) builds `LIMIT ${limit}` via string interpolation. Parameterize: `db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(limit)`. Validate `limit` is a positive integer; clamp to a max (e.g. 20000).
2. **`get-table-data` / `get-table-schema`** (`src/main.ts` ~L3908–L3945) take a `tableName` from the renderer and use it directly in SQL → arbitrary table read. Validate `tableName` against an explicit allowlist of known tables; reject anything else. Do the same for any handler that accepts a column/table name.
3. Audit all `db.prepare(\`...${x}...`) `template-literal queries; convert user-influenced values to bound` ?` params. Identifiers that can’t be bound must be allowlisted.

## T10 — Logging noise / info exposure

1. The active-win poll logs **every 5 seconds** (`src/main.ts` ~L3332 `[DeskFlow] active-win: ...`) including window titles (can contain sensitive info). Gate behind a `DEBUG_TRACKING` flag (env or preference), off by default.
2. `getLogs` logs row counts every call; remove or gate. Reduce hot-path `console.log` across `main.ts` and `OrbitSystem.tsx` (`[FROZEN-DBG]`, `[StorageDebug]`) — wrap in a `debug()` helper.
3. Never log full tokens/paths from AI sync; log counts only.

## T11 — IPC input validation & error handling

1. Every `ipcMain.handle` that takes `{ period, dateOffset }` should validate `period ∈ {today, week, month, all}` and `dateOffset` is a finite integer; reject/normalize otherwise.
2. Wrap DB handlers in try/catch returning a typed `{ success, error }` (most do; fill gaps) and never leak raw stack traces to the renderer.
3. Confirm `contextIsolation` is on and the preload exposes a **fixed** API surface (no generic “invoke any channel” passthrough). If a generic passthrough exists in `preload.ts`, remove it.

## T12 — Resource leaks (efficiency + stability)

1. Audit `setInterval`/`setTimeout` in pages (e.g. `AiPage.tsx` `digestPollRef`, `OrbitSystem` `FPSLineGraph` interval) — every one must be cleared on unmount.
2. Audit `window.addEventListener` (OrbitSystem pointer/wheel listeners) — all removed on unmount (they are; keep it that way when editing).
3. Three.js: every `geometry`/`material`/`texture`/`Worker` created must be disposed/terminated on unmount.
4. Ensure DB statements reuse prepared handles where in hot loops; avoid re-preparing inside loops.

---

# 🎮 Tracking correctness — must improve WITHOUT breaking

<aside>
🛡️

The poll loop `pollForeground()` (`src/main.ts` ~L3213) and sleep logic are deliberately tuned for games and anti-cheat. Preserve: game keep-alive (`source === 'keepalive'`), the “never reset session for Gaming” branch, browser null-poll slack, checkpointing, and `GAME_POLL_SKIP`. Only make the additive changes below.

</aside>

## T13 — Don’t mark video/games as AFK (the YouTube problem)

**Why:** AFK/sleep checks use `powerMonitor.getSystemIdleTime()` (e.g. heartbeat ~L3610 and `checkSleepGap` ~L3675). When the user watches YouTube or a video, there’s no keyboard/mouse input, so the OS reports idle — but the user is NOT AFK.

**Fix (additive guard):** before any idle-based pause/AFK/sleep decision, check the **current foreground category**. If `categorizeApp(currentApp)` is in a “passive-active” set, skip idle-based AFK:

```tsx
const PASSIVE_ACTIVE = new Set(['Entertainment', 'Gaming']);
function isPassiveActive(app: string | null): boolean {
  if (!app) return false;
  return PASSIVE_ACTIVE.has(categorizeApp(app));
}
```

Also treat known video domains as passive-active: when the tracked browser tab/domain is `youtube.com`, `netflix.com`, etc. (reuse the existing domain category map ~L287), do not flag AFK from OS idle. Keep real sleep detection (large gaps within sleep hours) intact — only suppress the **short** idle-based AFK when foreground is passive-active.

**Acceptance:** watching a long YouTube video or a fullscreen game does not produce AFK/idle gaps; leaving the computer truly idle on a normal app still does.

## T14 — Robust game tracking (launchers vs. games, hard-to-track titles)

Keep the current keep-alive design and extend coverage:

1. **Don’t trust `active-win` alone.** Games like Valorant / Wuthering Waves run separately from their launcher and often report no window (anti-cheat/fullscreen). The existing `gameDetection.cjs` index + `keepalive` path handles this — ensure the installed-game index (`rescan-games`) covers launcher process names AND the actual game executables, and that a detected game keeps the session alive during null polls.
2. **Generalize, don’t hardcode.** Game detection should match against the scanned Steam/installed index and a process allowlist, not a fixed list of titles, so every game is handled.
3. **Separate launcher time from game time** where possible: if the launcher process is foreground but a known game executable is running, attribute to the game.
4. Add a short debug-gated log (per T10) when a keep-alive decision is made, so future tuning is possible without spamming logs.

**Acceptance:** starting a fullscreen/anti-cheat game keeps a continuous game session even with null `active-win` polls; closing it ends the session correctly; no game is silently dropped.

---

## 3. Execution order checklist

- [ ]  T1 safeMath + replace all data-array spreads, `npm run build`
- [ ]  T2 SQL-aggregated galaxy data + cap raw query, `npm run build`
- [ ]  T3 non-blocking Sync AI + progress events
- [ ]  T4 analytics defer + SQL aggregate + skeleton
- [ ]  T5 OrbitSystem render cost (active galaxy only, quality tiers, demand frameloop)
- [ ]  T6 useAiPageData cache key fix
- [ ]  T7 AICityscape settle-and-stop morph + quality gating
- [ ]  T8 debounce + abort stale period switches
- [ ]  T9–T12 security/hardening (SQL params, allowlist, logging, validation, leaks)
- [ ]  T13 AFK/video guard
- [ ]  T14 game tracking robustness
- [ ]  Final full `npm run build`, manual smoke test of every page on All-time

## 4. Findings + fixes report (fill this in as you go)

For each task, append: **Finding** (issue, severity, file:line), **Fix applied** (what changed + why it’s safe now), **Residual risk / follow-ups**. Severity guide: Critical = crash/freeze/SQLi; High = data loss / blocking IPC; Medium = N+1 / weak validation; Low = logging/style.

<aside>
✅

**Definition of done:** All-time loads on every page without freezing; timeline switches stay responsive; Sync AI and Analytics run in the background; no `Math.max(...spread)` on data arrays remains; SQL is parameterized + table names allowlisted; game/YouTube tracking verified unbroken; `npm run build` passes clean.

</aside>