<aside>
⚡

**How to use this.** When the app breaks, find the matching **Symptom** below, run the **Fast fix**, and only dig deeper if it doesn't work. Each entry is something we already solved once — don't re-diagnose from scratch. Add a new entry every time a fresh error costs more than 20 minutes.

</aside>

## The 60-second triage (do this first, every time)

1. **App won't open at all?** → it's a build/launch problem (Entry 1, 4, or 5). Look at the message text.
2. **App opens but everything is 0 / blank data?** → the main process or the DB failed. **The real error is in the terminal where you ran `npm start`, NOT the in-app DevTools.** Go read it (Entry 2).
3. **A `npm run build` / rebuild command failed?** → toolchain problem (Entry 3).

<aside>
🧭

**Golden rules learned the hard way**

- The SQLite DB lives in the **main process** — its errors print in the **terminal**, never in the app window.
- "Everything is 0" is almost always a **symptom** of the main process or DB not starting — not data loss. The data is still on disk.
- Never "fix" these by masking them (try/catch returning empty, optional chaining, setTimeout). Fix the cause.
- Our project path has a **space** (`App Tracker`) — this breaks native-module builds. See Entry 3.
</aside>

---

## Entry 1 — App won't launch: "Cannot find module dist-electron/main.cjs"

**Symptom**

`Unable to find Electron app at …` + `Cannot find module '…\dist-electron\main.cjs'. Please verify that the package.json has a valid "main" entry`. Often paired with the UI showing all zeros.

**Root cause**

`package.json` points `"main"` at `dist-electron/main.cjs`, but that file was never built. Either only the renderer was built (`vite build` / `dev`), or `electron-vite build` **silently failed on Windows** (exits code 0, writes nothing), or `dist-electron/` got deleted.

**Fast fix** (PowerShell — run one at a time)

```
Test-Path .\dist-electron\main.cjs      # False = confirmed
node scripts/build.mjs                   # the REAL build (NOT electron-vite)
Test-Path .\dist-electron\main.cjs      # must be True now
npm start
```

Watch the build reach **Step 4/4** and print `main: ~643 KB` + `Build complete`. If it stops earlier, that earlier error is the real blocker.

**Prevention**

- Never run `electron-vite build` on Windows — it's broken. Always `node scripts/build.mjs`.
- Add a `prestart` guard so launch refuses to run without the file:

```
"scripts": {
  "build": "node scripts/build.mjs",
  "prestart": "node scripts/verify-build.mjs",
  "start": "electron ."
}
```

`scripts/verify-build.mjs`:

```
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
if (!existsSync(resolve('dist-electron/main.cjs'))) {
  console.error('\n❌ dist-electron/main.cjs missing. Run "npm run build" first.\n');
  process.exit(1);
}
```

- Never `git clean -fdx` or hand-delete `dist-electron/` without rebuilding.

---

## Entry 2 — App launches but DB shows all zeros

**Symptom**

App window opens fine, but every number is 0 / lists empty. No obvious error in the app.

**Root cause (one of two)**

1. **better-sqlite3 native binary built for the wrong runtime** — compiled for system Node, not Electron's ABI. Silent connection failure.
2. **Wrong DB path in the built app** — code resolved the DB path from `__dirname`, which is now `dist-electron/`, so it opened a fresh empty database instead of the real one.

**Fast fix**

First, **read the `npm start` terminal** (the main-process console). Then:

- If you see `NODE_MODULE_VERSION` mismatch / `bindings` / `invalid ELF header` → it's cause 1, rebuild the native module → **see Entry 3**.
- If there's **no error** but data is 0 → it's cause 2. Log the path and fix it:

```
console.log('[DB] opening:', dbPath, 'userData:', app.getPath('userData'));
```

Use a stable path: `path.join(app.getPath('userData'), 'deskflow.db')`, and point it at / copy in the real populated DB file.

**Prevention**

Wrap DB init in try/catch with a **loud** `console.error` so it's never silent again:

```
try { db = new Database(dbPath); console.log('[DB] connected:', dbPath); }
catch (err) { console.error('[DB] FAILED TO OPEN:', err); }
```

---

## Entry 3 — `electron-rebuild` fails: MSB8040 Spectre libs / space-in-path

**Symptom**

```
Attempting to build a module with a space in the path
error MSB8040: Spectre-mitigated libraries are required for this project …
  [ … \node_modules\node-pty\build\conpty.vcxproj ]
✖ Rebuild Failed — node-gyp failed to rebuild 'node-pty'
```

**Root cause**

`electron-rebuild` builds **all** native modules (active-win, better-sqlite3, node-pty, sqlite3) and **aborts on the first failure**. The failure here is **node-pty**, not better-sqlite3 — node-pty's C++ build needs the Visual Studio **Spectre-mitigated VC++ libraries**, which aren't installed. The **space in the project path** (`App Tracker`) is a second landmine that breaks node-gyp.

**Fast fix (gets the DB working now)**

Rebuild **only** better-sqlite3 and skip node-pty entirely — the DB doesn't need node-pty (that only powers the in-app terminal):

```
npx electron-rebuild -f --only better-sqlite3
```

Then `npm start`. The DB should connect. (The terminal feature stays broken until node-pty is rebuilt — fix that later via the two options below.)

**Full fix (to rebuild node-pty too)**

- **Best / permanent:** move the project to a path with **no spaces**, e.g. `C:\dev\AppTracker`, then `npm install` and rebuild. This kills the space warnings forever and prevents a whole class of native-build failures.
- **Or install the Spectre libs:** Visual Studio Installer → *Individual Components* → check **"MSVC … C++ Spectre-mitigated libs"** matching your toolset → re-run the rebuild.
- Note: VS "18" Build Tools is bleeding-edge; if it keeps fighting you, the known-good combo is **VS 2022 (v17) Build Tools** with *Desktop development with C++* + Spectre libs.

**Prevention**

- Keep the project on a space-free path.
- Use `--only better-sqlite3` for DB-only rebuilds so an unrelated module (node-pty) can't block you.

---

## Entry 4 — White screen / crash on launch: "Cannot access 'z' before initialization"

**Symptom**

`ReferenceError: Cannot access 'z' before initialization` immediately on launch, stack points into minified `dist/assets/index.js` and React internals. Works in `npm run dev`, crashes in the built app.

**Root cause**

A **Temporal Dead Zone** error = a **circular import**. Module A imports B; B uses something from A before A finished initializing. The production bundle reorders modules, which exposes the cycle (dev doesn't).

**Fast fix**

1. Temporarily build readable to find the real culprit — in `vite.config.ts`: `build.minify = false`, `build.sourcemap = true`, and add an `onwarn` that logs `CIRCULAR_DEPENDENCY`. Rebuild → the stack now names the real file/variable and the log lists every cycle.
2. `npx madge --circular --extensions ts,tsx src/` lists the loops directly.
3. Break the cycle: move the shared thing (constant / context / class) into a new **leaf** module both files import, or defer the top-level usage into a function. Kill barrel `index.ts` re-exports involved in the loop.
4. Restore minify/sourcemap, rebuild.

**Prevention**

Avoid barrel files (`export * from`) for components; import by direct path. Don't reference a top-level `const`/`class` from a module that imports back into yours.

---

## Entry 5 — "TypeError: Illegal constructor" on launch

**Symptom**

`TypeError: Illegal constructor`, often near icon/UI code, app crashes on render.

**Root cause**

A lucide-react icon import resolved to a **browser DOM global** instead of the icon — e.g. `import { Lock } from 'lucide-react'` but `Lock` collided with `window.Lock` (Web Locks API). TypeScript doesn't catch it because the DOM global exists ambiently.

**Fast fix**

Alias the import: `import { Lock as LockIcon } from 'lucide-react'` and render `<LockIcon />`.

**Prevention**

Alias any icon whose name collides with a DOM/Web global: `Lock`, `Notification`, `Image`, `Range`, `History`, `Worker`, `Event`, `Selection`, `Text`, etc. Also explicitly `ChartJS.register(...)` before rendering charts.

---

## Entry 6 — App opens but ALL data is 0 (every backend API is undefined)

**Symptom**

App launches fine. The **DevTools** console (in-app, Ctrl+Shift+I) shows `TypeError: Cannot read properties of undefined (reading 'getDashboardAggregates')` plus several `No <X> API` / `<X> API not available` lines. The **terminal** shows the DB initialized fine with real data (e.g. `SQLite database initialized … 27799 logs`).

**Root cause**

The **preload script didn't load**, so `window.deskflowAPI` was never created → every renderer→main call is `undefined` → no data anywhere. **This is NOT a database problem.** In our case the build emitted `dist-electron/preload.mjs`, but `main.ts` loads `path.join(__dirname,'preload.cjs')` — that file didn't exist, so Electron loaded no preload. It was an extension/format mismatch: the build produced ESM `.mjs` when Electron requires CommonJS `.cjs`.

**Confirm it's this bug**

- `Get-ChildItem dist-electron` shows a `preload.*` file whose **name/extension doesn't match** the path in `main.ts`'s `webPreferences.preload`.
- The DB logs in the terminal are healthy (data exists), but the renderer's API object is undefined.

**Fast fix** (re-emit preload as CommonJS at the exact path main expects — no full rebuild)

```
npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs
npm start
```

Do NOT just rename `preload.mjs` → `.cjs`; ESM content won't run under the CommonJS loader. Re-emit it as `cjs`.

**Prevention**

- Make `scripts/build.mjs` emit the preload as `dist-electron/preload.cjs` with esbuild `format: 'cjs'`. Electron preload must be CommonJS.
- Keep the `console.log('[DeskFlow] Preload path:', preloadPath)` line and add a check that the file exists — warn loudly at launch if it doesn't.
- Reminder: "every number is 0 + DevTools says an API is undefined" = **preload/bridge problem**, not the DB. Check the preload before touching better-sqlite3.

---

## Entry 7 — Sidebar accent strip not full height / content won't scroll

**Symptom**

The green (or other color) vertical accent strip on the left side of sidebar group panels only spans the content height, not the full panel height. When content is short, the strip is short. Additionally, sub-tabs like Sessions and Map may show duplicate accent strips. Using `h-full` to fix this breaks scrolling — the panel locks to the viewport and long content can't be scrolled.

**Root cause**

The `GroupPanel` component used `position: absolute; top: 0; bottom: 0` for the accent strip inside a `min-h-full` container. Inside a scroll container (`overflow-y: auto`), `min-height: 100%` can compute to `auto` (content-based), so the container only grows to the content height. The absolute strip follows suit.

Additionally, the Sessions and Map sub-tabs had **duplicate** accent strips — one from `<GroupPanel>` and one inline `<span>` — causing visual overlap.

Using `h-full` (fixed 100% height) instead of `min-h-full` breaks scrolling because the panel is locked to exactly the parent's height; content taller than the panel overflows invisibly and the parent scrollbar never activates.

**Fast fix**

Replace `position: absolute` with `display: flex` on GroupPanel so the accent strip stretches as a flex child:

```tsx
function GroupPanel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <span className={`w-0.5 shrink-0 ${ACCENT_STRIP[accent]} opacity-60`} />
      <div className="flex-1 px-3 py-3 space-y-3 min-w-0">
        {children}
      </div>
    </div>
  );
}
```

Key points:
- `display: flex` with `min-h-full` keeps the container at minimum full parent height but allows growth when content overflows
- Flex items stretch to the container's full cross-axis height by default (`align-items: stretch`)
- `w-0.5 shrink-0` on the strip gives it fixed width while it stretches to full height
- `flex-1` on the content div fills remaining width
- `min-w-0` prevents flex overflow

Remove any **duplicate** inline accent strips in sub-tab renders — they're now handled by GroupPanel.

**Prevention**

- Never use `position: absolute` for layout elements that need dynamic height inside scroll containers — use flexbox stretching instead.
- Never use `h-full` inside a scroll container that needs to scroll — use `min-h-full`.
- Only one `<GroupPanel>` accent strip per panel; remove inline duplicates.

**The pattern:** Layout bugs inside scroll containers are almost always about percentage height computation vs. flex stretch. When you need a child to always fill the container AND the container to grow with content, use `display: flex` + `min-h-full` on the parent, and let flex `align-items: stretch` handle the child sizing. Never force `position: absolute` with `top/bottom` for vertical stretching in dynamic-height containers.

## Entry 8 — DB is 4KB (empty schema) but WAL is megabytes, queries return 0 rows

**Symptom**

App launches fine, DB connects (`✅ SQLite database initialized`), but all queries return 0 rows. `deskflow-data.db` is only 4KB (just schema), while `deskflow-data.db-wal` is 1-3MB. The terminal shows no errors.

**Root cause**

The SQLite Write-Ahead Log (WAL) contains all the real data, but better-sqlite3 in Electron can't read it — likely because the WAL was left uncommitted by a previous instance that crashed or was force-killed. The main DB file (4KB) is a freshly created schema-only file, and the WAL from the old instance isn't being merged.

**Confirm it's this bug**

```powershell
Get-Item "$env:APPDATA\DeskFlow\deskflow-data.db*" | Select-Object Name, Length
# deskflow-data.db      → ~4096 bytes (empty schema)
# deskflow-data.db-wal  → 1,000,000+ bytes (real data stranded here)
```

**Fast fix** (PowerShell — kill Electron, checkpoint WAL via Python, restart)

```powershell
# 1. Kill all Electron processes (they lock the WAL)
Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Open DB with Python sqlite3 — this auto-checkpoints the WAL into the main DB
python -c "import sqlite3; sqlite3.connect(r'$env:APPDATA\DeskFlow\deskflow-data.db').close()"

# 3. Verify the DB grew (should be 100KB+ now, WAL/SHM files gone)
Get-Item "$env:APPDATA\DeskFlow\deskflow-data.db*" | Select-Object Name, Length

# 4. Restart the app
npm start
```

**Prevention**

- Never force-kill Electron (`taskkill /F`) — close it gracefully so the WAL checkpoints on shutdown.
- If the app crashes, run the Python checkpoint fix before restarting.
- Consider adding a WAL checkpoint on app startup: `db.pragma('wal_checkpoint(PASSIVE)')` in main.ts DB init.

---

---

## Entry 9 — Black screen on launch: app opens but window shows nothing (no content, no error)

**Symptom**

`[DeskFlow] Page loaded successfully` appears in the terminal, but the Electron window is completely black — no dashboard, no sidebar, no fallback error overlay. The DevTools console shows nothing because no JS executed. This is the **#1 regression** in DeskFlow.

**Root cause A — VITE_DEV_SERVER_URL pollution (most common)**

`.env` or an environment variable has `VITE_DEV_SERVER_URL=http://localhost:5173` left from a dev setup. `main.ts` checks this flag and calls `mainWindow.loadURL('http://localhost:5173')`. When Vite isn't running, it fails with `ERR_CONNECTION_REFUSED`. The `did-fail-load` handler then retries with `mainWindow.loadFile('dist/index.html')` — but because the window has `webSecurity: true`, Chromium blocks `crossorigin` module scripts loaded from the `file://` protocol. The HTML renders the fallback `<div>` but the JS bundle never executes.

**Confirm it's this bug:**
- Terminal shows `[DeskFlow] Failed to load (attempt 1): -102 ERR_CONNECTION_REFUSED`
- Then shows `[DeskFlow] Page loaded successfully` (from `did-finish-load` after `loadFile`)
- But the window is black
- `.env` contains `VITE_DEV_SERVER_URL=http://localhost:5173`

**Fast fix:**
```powershell
# Remove VITE_DEV_SERVER_URL from .env, or clear it in PowerShell before launching:
$env:VITE_DEV_SERVER_URL = ""; npx electron .
```

Or update `start-dev.ps1` to clear it:
```powershell
Remove-Item Env:VITE_DEV_SERVER_URL -ErrorAction SilentlyContinue
```

**Permanent fix (code):** The `did-fail-load` handler should start the production HTTP server (`startProdServer`) instead of using `loadFile`. This loads the app over `http://localhost:<port>` where `crossorigin` module scripts work correctly. See `src/main.ts` — `startProdServer()` factory + fallback logic.

---

**Root cause B — EPIPE uncaught exception (crashes main process after window loads)**

`console.log("[DeskFlow] Browser data received:", data.domain, ...)` in the browser tracking HTTP server (port 54321) writes to `process.stdout`. When the stdout pipe breaks (terminal host closes, parent process exits), Node.js throws an **EPIPE** error. Without an `uncaughtException` handler, this kills the **entire Electron main process** — the BrowserWindow closes instantly, leaving a black/frozen screen. No error appears in the app window because the main process is dead.

**Confirm it's this bug:**
- Window appeared briefly then vanished
- Terminal shows an EPIPE stack trace or an "Uncaught Exception" error dialog
- `process.on('uncaughtException')` is not registered in `main.ts`

**Fast fix:**
```typescript
// Add at top of app.whenReady() in main.ts — prevents EPIPE from killing the process
if (process.stdout) process.stdout.on('error', () => {});
if (process.stderr) process.stderr.on('error', () => {});
process.on('uncaughtException', (err) => {
    console.error('[DeskFlow] Uncaught exception:', err.message);
});
```

**Prevention (both causes — this is the checklist to run EVERY cycle):**

1. **Check `.env` for `VITE_DEV_SERVER_URL`** — if set and Vite isn't meant to be running, clear it. Add `Remove-Item Env:VITE_DEV_SERVER_URL` to `start-dev.ps1`.
2. **Verify the `did-fail-load` fallback** uses `startProdServer()` (HTTP), NOT `loadFile()` (file://). `loadFile` breaks `crossorigin` module scripts under `webSecurity: true`.
3. **Check `process.stdout.on('error')` and `process.on('uncaughtException')`** exist in `main.ts` `app.whenReady()`. Without them, an EPIPE on any `console.log` kills the main process.
4. **Build + launch** — run the full build pipeline (`vite build` → `rebuild-main.mjs` → `npx electron .`), then verify the window shows real content. Do NOT claim VERDICT PASS without visual verification.

---

## Entry 10 — "Cannot find module 'X'" on every launch (keeps cycling through different packages)

**Symptom**

App launches, immediately crashes with `Cannot find module 'cheerio'` / `'async-mutex'` / `'axios'` / `'html-to-image'` / etc. After fixing one, another appears. Feels like an infinite loop.

**Root cause**

Services in `src/services/` import npm packages, but those packages were never added to `package.json`. When a new service is created (often by AI), the author `import`s the package but doesn't run `npm install <package>`. The package works in dev (because it's in node_modules from a previous install or a different project), but the build bundles everything — so the missing dep only shows up at runtime.

**Fast fix — install ALL missing deps at once (run once, solves the cycle):**

```powershell
cd "C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker"
npm install archiver async-mutex axios cheerio html-to-image exifr recharts cytoscape-dagre tabulator-tables
```

Then rebuild:
```powershell
node scripts/rebuild-main.mjs
npx vite build
```

**Permanent fix — add a pre-launch guard:**

Add to `scripts/verify-deps.mjs`:
```javascript
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
const pkg = JSON.parse(readFileSync('package.json','utf8'));
const allDeps = {...pkg.dependencies, ...pkg.devDependencies};
const src = execSync('grep -roh "from [\"'\\']\\S*[\"'\\']" src/services/ 2>/dev/null',{encoding:'utf8'});
const imports = [...new Set(src.match(/from ["']([^"./][^"']+)["']/g)?.map(m=>m.split(/["']/)[1].split('/')[0])||[])];
const missing = imports.filter(d=>!allDeps[d]);
if(missing.length){console.error('❌ Missing packages:',missing.join(', '));process.exit(1);}
```

Add to `package.json` scripts:
```json
"prestart": "node scripts/verify-deps.mjs && node scripts/verify-build.mjs"
```

**Prevention**

- Every time a service file is created with `import X from 'npm-package'`, immediately run `npm install npm-package`.
- Search `src/services/` for external imports before any build: `grep -rh "from ['\"](?!\.)" src/services/ | sort -u` — cross-reference against `package.json`.
- **The rule:** if a `.ts` file imports a package that isn't in `package.json`, the build WILL fail at runtime. Don't trust that "it works in dev."

---

## Entry 11 — Sidebar navigation broken on AI Assistant page (hash changes but page doesn't re-render)

**Symptom**

Clicking sidebar navigation buttons while on the AI Assistant page (`/ai`) fires `navigate()` and changes `window.location.hash`, but the visible page stays on `/ai`. The URL updates (`#/learn`, `#/activity`, etc.) but React Router never re-renders. Works fine on every other page.

**Root cause**

React Router v6's HashRouter relies on the browser's native `hashchange` event to detect URL changes and trigger re-renders. In Electron (Chromium), when heavy canvas/3D content is active on a page (like the AI page's `CanvasGrid` with GPU compositor layers), the `hashchange` event is suppressed — the hash physically changes but the event never fires. React Router's internal state becomes stale, so `useLocation()` never updates and the component tree never re-renders.

**Confirm it's this bug:**

1. Add a global hashchange listener:
   ```javascript
   window.addEventListener('hashchange', (e) => {
     console.log('[HASHCHANGE]', e.oldURL, '→', e.newURL);
   });
   ```
2. Navigate to `/ai`, click a sidebar button
3. Check console: `window.location.hash` changes BUT `[HASHCHANGE]` never appears
4. Also check: `document.documentElement.getAttribute('data-page')` stays `ai` even after hash changes

**Fast fix**

Add a hash polling fallback in `App.tsx` that detects hash changes React Router misses and forces a re-render:

```tsx
function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, forceRender] = useState(0);

  // Fallback: poll hash and force re-render if React Router misses the change
  const lastHashRef = useRef(window.location.hash);
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.location.hash !== lastHashRef.current) {
        lastHashRef.current = window.location.hash;
        forceRender(n => n + 1);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);
  // ... rest of App
}
```

**Why it only happens on `/ai`:**

The AI Assistant page is the only route with a canvas (`CanvasGrid`) that uses `will-change: transform` and GPU compositor layers. These layers interfere with Chromium's event dispatching in the renderer process, suppressing native `hashchange` events. Other pages use standard flexbox/scroll layouts that don't trigger this.

**Prevention:**

- When building Electron apps with heavy canvas/3D content, always include a hash polling fallback as a safety net
- Never rely solely on `hashchange` events for routing in Electron — test with actual canvas pages
- If a page uses `will-change: transform` or GPU-intensive rendering, verify sidebar navigation still works after adding it

---

## Entry 12 — Sidebar/topbar covered or invisible after changing AppBackground

**Symptom**

After modifying `src/components/AppBackground.tsx` (adding layers, textures, or changing z-index), the sidebar navigation rail and/or top bar become invisible, darkened, or covered by a dark overlay. Content behind the sidebar is obscured. Buttons and text in the sidebar don't render properly.

**Root cause**

AppBackground is `position: fixed; inset: 0; z-index: 0` — it covers the ENTIRE viewport. Any child element inside it that is NOT `pointer-events-none` or that has a visible opaque/semi-opaque background will visually cover the sidebar and topbar, which are siblings in the DOM at normal flow (no explicit z-index on sidebar).

The specific culprits (tried and confirmed breaking):

| Component | Why it breaks | File |
|-----------|--------------|------|
| **Vignette** | `rgba(9,9,11,0.85)` = 85% opaque dark overlay at `z-[1]` over entire viewport. Kills all text/buttons underneath. | `ambient-patterns.tsx` |
| **AmbientGlow** | Uses `var(--page-accent)` — if CSS variable not set, `color-mix()` can produce unexpected opaque colors | `ambient-patterns.tsx` |
| **MeshGradient** | Animated radial gradients at 8% opacity — can look wrong on sidebar glass | `ambient-patterns.tsx` |
| **DotPattern** | Dot grid using `var(--page-accent)` — renders over sidebar area | `ambient-patterns.tsx` |
| **GradientWash** | Linear gradient overlay — subtle but adds visual noise over sidebar | `ambient-patterns.tsx` |

**The rule: these MCP ambient components from `ambient-patterns.tsx` were removed in commit `c4e55c6` FOR THIS EXACT REASON. Do NOT re-add them to AppBackground. They break the sidebar every time.**

**What WORKS in AppBackground (confirmed):**

- `LivingSubstrate` — WebGL RD shader, pointer-events-none, renders at low alpha (0.20-0.35). Safe.
- `Particles` — small canvas dots, pointer-events-none, low opacity. Safe.
- `LightRays` — CSS motion blur rays, pointer-events-none. Safe.
- `bg-[#09090b]` on the container — matches body background, not a problem.
- Per-page accent colors via `PAGE_ACCENTS` — just changes shader tint. Safe.

**Fast fix (if you already broke it):**

Replace `src/components/AppBackground.tsx` with the minimal safe version:

```tsx
import { Particles } from './ui/particles';
import { LightRays } from './ui/light-rays';
import { LivingSubstrate } from './life-river/LivingSubstrate';

const PAGE_ACCENTS: Record<string, string> = {
  '/': '#10b981', '/activity': '#06b6d4', '/ide': '#6366f1',
  '/life': '#fbbf24', '/finance': '#10b981', '/external': '#f59e0b',
  '/terminal': '#22c55e', '/ai': '#8b5cf6', '/learn': '#6366f1',
  '/settings': '#06b6d4', '/database': '#a78bfa', '/reports': '#ec4899',
  '/resume': '#cbd5e1',
};

export function AppBackground({ pathname = '/' }: { pathname?: string }) {
  const accent = PAGE_ACCENTS[pathname] || '#10b981';
  const isHero = pathname === '/' || pathname === '/life';
  return (
    <div className="fixed inset-0 pointer-events-none z-[0] overflow-hidden">
      <LivingSubstrate accent={accent} speed={isHero ? 2 : 1} maxAlpha={isHero ? 0.35 : 0.20} />
      <Particles quantity={30} color="#10b981" opacity={0.3} />
      <Particles quantity={20} color="#3b82f6" opacity={0.25} />
      <LightRays color="rgba(160, 210, 255, 0.35)" blur={48} count={4} speed={12} />
    </div>
  );
}
```

Then rebuild: `npx vite build && npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs && node scripts/rebuild-main.mjs`

**Prevention:**

- **NEVER add ambient overlay components from `ambient-patterns.tsx` to AppBackground.** They are viewport-spanning absolute layers that cover the sidebar. They were removed in commit `c4e55c6` for this reason.
- **NEVER add Vignette to AppBackground.** It's a 85% opaque dark overlay — instant sidebar death.
- If you want page-specific visual texture, put it INSIDE the page component itself (e.g. `<DotPattern>` inside `StatsPage`), NOT in the global AppBackground.
- The `ambient-patterns.tsx` file can stay in the repo (other pages import from it directly), but AppBackground must NEVER import from it.
- AppBackground's ONLY job is the subtle ambient base layer (substrate + particles + light rays). Everything else goes in page components.

---

<aside>
📌

**The pattern across all of these:** the visible error is rarely the real one. Build output gets reordered/minified, the DB error hides in the terminal, and "0 everywhere" means "a process didn't start," not "data is gone." Read the *first* failure in the *right* console before changing code.

</aside>