# 🐛 Debugging Guide

**Purpose:** Common issues, debugging strategies, and known fixes.

---

## Stale `useCallback`/`useMemo` closures — props/state not updating

**Root cause:** A `useCallback` or `useMemo` has an **empty or incomplete dependency array**, so the function/memoized value captures stale props or state in its closure. Changing those values in the parent does nothing — the old values are used forever.

**Symptoms:**
- A component receives new props but doesn't react to them
- Data loads from an IPC call using an old period/offset/ID
- Works on first render, breaks on subsequent state changes
- Console logs show the old value despite seeing new props pass externally

**Fix:**
- Add ALL referenced props, state, and variables to the dependency array
- The React exhaustive-deps eslint rule catches this — run `npx eslint` if available
- Common pattern: `useCallback(fn, [])` where `fn` uses `selectedPeriod` or similar prop

**Example (the bug):**
```typescript
// BUG: empty deps — selectedPeriod is captured once on mount, never updates
const fetchAnalytics = useCallback(async () => {
  const data = await api.getData(selectedPeriod); // always uses initial 'week'
}, []);
```

**Example (fixed):**
```typescript
const fetchAnalytics = useCallback(async () => {
  const data = await api.getData(selectedPeriod);
}, [selectedPeriod]); // re-creates when selectedPeriod changes
```

---

---

## `git clean -fdx` deletes original `.ts` source files (UNRECOVERABLE)

**Root cause:** `git clean -fdx` removes ALL files not tracked by git, including `.ts` source files that were in the working directory. Unlike `git checkout` or `git restore` which revert tracked files, `git clean` targets **untracked** files — git has never stored them, so they are permanently gone.

**Symptoms:**
- `src/main.ts` — if it was a pre-compiled CJS backup with uncommitted source changes, the real source is impossible to recover. The CJS file still exists (because it was overwriting the real `.ts` file) but it contains `require()`/`exports.` syntax, not real TypeScript.
- `src/services/*.ts` — these must be reconstructed by hand from whatever fragments exist in bundled output directories
- Any documentation, build scripts, config files, or backups that weren't committed are gone

**Fix (prevention):**
- Add ALL source files to `.gitignore` or commit them before running any git cleanup
- Use `git clean -ndx` first (dry run) to see what would be deleted — then manually move or commit important files before running with `-f`
- Better yet: don't use `git clean` at all. Manually delete `node_modules/`, `dist/`, and `dist-electron/` when needed.

**Fix (recovery — if source is lost):**
- Check `git stash list` for any stashed changes
- Check Windows File History or previous backups
- If the file is a `.ts` file that has been overwritten with CJS output, the CJS file IS the only surviving copy. You must manually reverse-engineer it back to real `.ts` syntax (convert `require()` → `import`, `exports.X` → `export`, add types).
- Check `src/*.ts.bak.*` files if backup naming convention was used (e.g., `main.ts.bak.20260607-210956`)

---

## `mainWindow.on('focus')` never fires on app startup

**Root cause:** The `BrowserWindow` constructor creates and shows the window immediately (with default `show: true`). By the time `mainWindow.on('focus', handler)` is registered, the window is **already focused** — so the `focus` event never fires. This means any focus-gated logic (like sleep detection) silently never runs on app launch.

**Symptoms:**
- Sleep detection modal never shows on app startup even after long overnight gaps
- Code assumes `focus` will fire at least once, but it doesn't on cold start
- Works fine on subsequent `alt-tab` or window click

**Fix:**
- Extract the inline focus-handler logic into a reusable `checkSleepGap()` function
- Call it explicitly after registering the handler: `checkSleepGap(lastFocusTime, Date.now())`
- If IPC is sent before renderer loads, use a JSON file as fallback that the renderer reads on mount

## Early return before later hooks causes production hook-order crash

**Root cause:** A component returns for `loading` or `error` before all of its hooks are declared. The initial render skips the later hooks, but the next render after data loads calls them, so React sees a different hook order and throws a minified production error.

**Symptoms:**
- Browser or page works in source mentally, but crashes only when data transitions from loading to loaded
- Production build shows a minified React error instead of a clear hook warning
- Error appears near the component's first render or around a `useMemo`/`useEffect` that was added later in the file

**Fix:**
- Declare all `useState`, `useRef`, `useMemo`, `useEffect`, and `useCallback` hooks before any early `return`
- If loading/error UI is needed, move the early returns to the bottom of the hook section
- Rebuild and verify the component renders through both loading and loaded states

---

## Terminals can exist without a session (pre-session state)

**Root cause:** Designing features (file locks, context sync, broadcasts) that assume `session_id` is always set. But terminals can exist in a pre-initialization state where `initializeSession()` hasn't run yet — `session_id` is null.

**Symptoms:**
- Session ID is null or "not set" but code assumes it's always a string
- Fake/generated session IDs assigned before the real session exists
- Resume logic runs on terminals that should just launch fresh
- Cross-session sync fails on terminals that have no session

**Fix:**
- Always treat `session_id` as nullable (null = "session not yet created")
- No resume, no context restore, no sync participation when session_id is null
- Fill session_id lazily when `initializeSession()` / `save-terminal-session` runs
- Never assign fake/generated session IDs before the real session exists

**Related:** `agent/skills/agent-reflect/logs/2026-05-30_session_id_hardcode.md`

## Workspace sidebar/tab content won't scroll despite `overflow-y-auto`

**Root cause:** The sidebar container is missing `flex flex-col`. The content div has `flex-1` but it only works inside a flex container. Without `flex-col` on the sidebar wrapper, the content div's `flex-1` resolves to auto (block flow), so no definite height reaches the inner scrollable panels, and the scroll chain collapses.

**Scroll chain for a flex-child to work:**
```
flex-parent (definite height) → min-h-0 → flex-child → overflow-y-auto
```

Every link in the chain must be present. `flex-1` does NOT make its parent a flex container.

**Fix:** Add `flex flex-col` to the sidebar wrapper element.

**Related:** `agent/skills/agent-reflect/logs/2026-06-06_idiot_trigger.md`

---

## `toISOString().split('T')[0]` returns UTC date, not local date

**Root cause:** Using `.toISOString().split('T')[0]` to get "today's date" gives the **UTC date**, but this disagrees with the user's **local date** when their timezone offset causes the UTC date to be 1 day off. For users in UTC+5:30 (India), at 2:00 AM local the UTC date is still the *previous* day.

**Symptoms:**
- Sleep chart shows wrong bedtime/waketime labels
- `isToday` check fails for UTC+ timezone users in early morning hours
- 'today' period filter includes sessions from yesterday or misses overnight sleep

**Fix:** Use local date methods for date strings:
```js
const d = new Date();
const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

For SQL filtering by local day, convert local midnight to UTC timestamps:
```js
const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
// SQL: es.started_at >= localStart AND es.started_at < localEnd
```

**See also:** `agent/skills/agent-reflect/logs/2026-05-29_idiot_trigger.md`

## AFK → External Session Not Saving to Database

**Root cause:** Multiple potential issues:
1. `start-afk-session` creates the AFK session on idle, but `stop-afk-session` returns `{ success: false }` because no running AFK session is found (AFK session may have been closed by a previous call or never created).
2. The frontend's `handleAfkConfirm` only dispatches `external-data-changed` on `r?.success`, so if the backend fails, the ExternalPage never refreshes.

**Symptoms:**
- User picks an activity from the AFK prompt, but nothing appears on the External page
- Console shows "Failed to stop AFK session" errors
- `stop-afk-session` returns `{ success: false }` due to no running AFK session found

**Fix:**
- `stop-afk-session` should always fire `external-data-changed` event so the UI refreshes
- Add fallback: if no session with `activity_id = AFK.id` is found, try finding ANY running external session
- Log IPC call arguments and return values for debugging

## TDZ (Temporal Dead Zone) — `Cannot access 'X' before initialization`

**Root cause:** A `const` (useState, useRef, useMemo, or plain const) is referenced in a hook's dependency array or useMemo callback BEFORE its declaration line in the function body. `const` is in TDZ until its declaration line executes.

**Detection:**
- Error in minified output: `Cannot access 'ht' before initialization` where `ht` maps to a minified variable name
- Line number in the source map points to a dependency array or useMemo callback
- Minifier assigns different short names per build, so the variable name changes between builds

**Fix:**
- Find which `const` declaration is referenced before its declaration
- Move it ABOVE the hook that references it
- Common culprits: `weekOffset`, `externalSessions`, or any `useState` declared after a `useEffect`/`useMemo` that references it

**Prevention:**
- Group ALL `useState` and `useRef` declarations at the TOP of the function body, before any `useEffect` or `useMemo`
- Never scatter `const [foo, setFoo] = useState()` between hooks
- When adding `weekOffset` or similar to a dependency array, verify its `useState` is declared BEFORE the hook

---

## ⚠️ Prompt Generation Mistakes (DO NOT REPEAT)

### Mistake: Writing documentation prompts instead of design prompts
**Symptom:** User asks to "generate prompt" for existing features. I write a prompt that catalogs/document what exists instead of tasking an AI with designing NEW UI/settings/features built ON TOP.

**Fix:** 
- Existing features are the FOUNDATION, not the ENDPOINT
- Write prompts that EXPAND the features: new settings panels, live dashboards, configurable knobs, visualizations
- Include in every prompt: Data Processing Logic (real IPC, real math), Visual Specs (exact hex codes, spacing, design tokens), UX Flow (loading/empty/error states, animations, interactions)
- The skill says "act as Lead Designer and Engineer" — the prompt should mandate design + engineering, not documentation

**Example of bad prompt:** "Design a verification document that lists what exists."
**Example of good prompt:** "Design a live dashboard with 5 stat cards, 3 settings sliders, and a context assembly map — all pulling real data via IPC. Expand the customizability with new UI controls."

---

## 🔍 Debugging Workflow

### Step 1: Identify the Issue
1. Check console errors
2. Reproduce consistently
3. Note the exact error message
4. Check when it started happening

### Step 2: Isolate the Problem
1. Check agent/state.md for known issues
2. Review recent changes
3. Test with minimal repro
4. Check file existence and paths

---

## 🔴 React TDZ Error: "Cannot access 'X' before initialization"

**Symptoms:**
- Runtime error in compiled output: "Cannot access 'At' before initialization" (minified var)
- Error points to line in compiled code, not source
- Usually happens after code changes to component

**Root Cause:**
- `const` variable (ref, state) declared AFTER its first usage in same scope
- Common when adding refs at bottom of component, but using in useEffect dep array at top
- React's exhaustive-deps ESLint rule doesn't catch this (different scope issue)
- Minified variables (At, bs, Jt, etc.) = original variable names

**Example:**
```typescript
// Line 342: Using ref in dep array
}, [currentProductiveMs, stopwatchStartRef.current, ...]);

// Line 557: Ref declared here (AFTER usage)
const stopwatchStartRef = useRef<number | null>(null);
```

**Fix:**
1. Move ALL ref declarations to TOP of component (right after useState calls)
2. Ensure declaration order matches usage order
3. Run build after moving to catch minified variable errors
4. Use grep/search to find ALL references before renaming variables

**Prevention:**
- Always declare refs immediately after useState declarations
- Never declare refs at bottom of component
- Use `Select-String -Pattern "refName"` to verify no forward references exist
- When renaming: update ALL references before testing

**Real Example (2026-05-07):**
- Renamed `productiveStartRef` → `stopwatchStartRef`
- Forgot to update lines 327 and 342
- Caused "productiveStartRef is not defined" error
- Then moved refs to line 557 but dep array at line 342 referenced them → TDZ error

---

## 🐛 Common Issue: Empty Data Showing "--" or Empty

**Symptom:** UI shows "--" or empty instead of actual data

**Root Cause:** API not exposed in preload.ts

**Debug Steps:**
1. Find where data comes from (e.g., `window.deskflowAPI.getSomeData`)
2. Check if function exists in preload.ts
3. Check if IPC handler exists in main.ts
4. Only then check display logic

**Example:** Activity buttons showing "--" → `getExternalStats` existed in main.ts but not in preload.ts

### Step 3: Fix and Verify
1. Make minimal fix
2. Rebuild
3. Test the fix
4. Check for regressions

---

## 🐛 SQLite ALTER TABLE Pattern

### Problem
Running `ALTER TABLE ... ADD COLUMN` on existing database fails if column already exists, causing SQLite to fall back to JSON mode and lose all data.

### Solution
**Always wrap ALTER TABLE in try-catch:**
```javascript
try { db.exec(`ALTER TABLE projects ADD COLUMN health_score INTEGER`); } catch {}
```

### Rule
Never run ALTER TABLE without error handling. Always assume the column might already exist.

---

## 🐛 External Activity/Stopwatch Persistence

### Problem
Timer doesn't persist when leaving page or restarting app.

### Root Causes
1. Activity might be on different page than expected (check routes!)
2. Start might not be saving to database (just local React state)
3. Restore might be checking before data loads (race condition)
4. localStorage doesn't survive app restart - only navigation within session

### Debug Steps
1. **Ask user:** Which page has the feature? Check routes in App.tsx
2. **Check routes:** Look for `<Route path="/external"` etc.
3. **Verify DB writes:** Does startActivity call `window.deskflowAPI.startExternalSession()`?
4. **Check session ID:** Is it "temp-xxx" (local only) or real DB ID?
5. **Fix race condition:** Load data FIRST, THEN check for active session

### Example Fix
```javascript
// WRONG - race condition
useEffect(() => {
  getActiveExternalSession().then(session => {...}); // runs before activities load
  getExternalActivities().then(data => {...});
}, []);

// CORRECT - sequential
useEffect(() => {
  getExternalActivities().then(data => {
    setActivities(data);
    // AFTER activities load, check session
    getActiveExternalSession().then(session => {
      if (session) {
        const activity = data.find(a => a.id === session.activity_id);
        // restore session...
      }
    });
  });
}, []);
```

---

## 🚨 Common Errors & Fixes

### ERR_FILE_NOT_FOUND
**Error:** `Failed to load URL: file:///.../dist/index.html`

**Cause:** dist/ folder doesn't exist

**Fix:**
```bash
npm run build:renderer
```

### Cannot find module 'dist-electron/main.cjs'
**Error:** `Unable to find Electron app at ...`

**Cause:** dist-electron/ doesn't have main.cjs

**Fix:**
```bash
npm run build:electron
```

### setHeatmap is not defined
**Error:** `Uncaught ReferenceError: setHeatmap is not defined`

**Cause:** Removed useState but references remain

**Fix:**
1. Search for `setHeatmap` in App.tsx
2. Remove all references
3. Use heatmap useMemo instead

### Texture Not Showing
**Symptoms:** Planets are solid colors, no patterns visible

**Checklist:**
1. `texture.colorSpace = THREE.SRGBColorSpace` ✓
2. `texture.needsUpdate = true` ✓
3. `texture.wrapS = THREE.RepeatWrapping` ✓
4. `texture.wrapT = THREE.RepeatWrapping` ✓
5. Material uses `map={texture}` ✓
6. Canvas drawing actually executes ✓
7. Category matches pattern conditions ✓

**Common Issues:**
- Emissive color overriding texture
- `color` property darkening texture
- Wrong material type (use meshStandardMaterial)
- Canvas context is null

### Orbit Path Mismatch
**Symptoms:** Planet doesn't follow the orbit line

**Fix:** Ensure same formula in both:
```typescript
// OrbitPath and useFrame must use:
const semiLatusRectum = semiMajorAxis * (1 - eccentricity * eccentricity);
const distance = semiLatusRectum / (1 + eccentricity * Math.cos(angle + longitudeOfPerihelion));
```

### Better-SQLite3 NODE_MODULE_VERSION Mismatch
**Error:** `The module 'better_sqlite3.node' was compiled against a different Node.js version`

**Cause:** Native module compiled for Node.js, not Electron; rebuild fails if Visual Studio Build Tools are missing

**Fix (Preferred - if rebuild fails):**
Use sql.js (pure JS/WebAssembly, no native dependencies) to read databases:
1. Read buffer: `const dbBuffer = fs.readFileSync(dbPath)`
2. Init: `const SQL = await initSqlJs()`
3. Load: `const db = new SQL.Database(new Uint8Array(dbBuffer))`
4. Check tables: `db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='table'")`
- **Why**: No native bindings, works across all Node/Electron versions, no rebuild needed

**Fix (If build tools available):**
1. Ensure Visual Studio Build Tools installed
2. Path must not have spaces
3. Run: `npm rebuild better-sqlite3 --runtime=electron --target=41.1.1`
4. JSON fallback will work if rebuild fails

---

## 🎯 Data Mismatch Debugging Pattern (CRITICAL)

**When data doesn't match between components, use this workflow:**

### Step 1: Find the Source of Truth
- Identify a component that shows CORRECT data
- That component is your reference

### Step 2: Trace Data Flow FROM Source
```
StatsPage (correct) → computedAppStats → worked correctly
OrbitSystem (wrong) → filteredLogs → was wrong
```

### Step 3: Compare the Two Paths
Look for WHERE the data diverges:
```javascript
// Source of truth (StatsPage)
const appLogs = filtered.filter(log => {
  if (log.is_browser_tracking) return false;  // ← Filter exists
  return true;
});

// Broken component (OrbitSystem received)
<OrbitSystem logs={filteredLogs} />  // ← No filter at source
```

### Step 4: Fix at the Divergence Point
```javascript
// Wrong: Trying to fix downstream
<OrbitSystem logs={filteredLogs} />

// Right: Fix at the source
<OrbitSystem logs={filteredLogs.filter(l => !l.is_browser_tracking)} />
```

### Key Lessons
1. **Don't fix downstream** - Fix at where data diverges
2. **Compare with working implementation** - Find what worked, trace it
3. **Trust data flow, not assumptions** - Verify what data actually contains
4. **Minimal fixes** - One line at the right place vs complex downstream fixes

### When to Apply
- Data totals don't match
- Different number of items
- Missing or extra entries
- Different values for same item

---

## 🧮 Data Computation Pattern (CRITICAL)

**When data computation is wrong or inconsistent between components:**

### The Problem
Data gets computed in MULTIPLE places with DIFFERENT logic, leading to inconsistencies.

### Step 1: Find Where Data is Computed
```typescript
// Component A - StatsPage.tsx (computing locally)
const stats = useMemo(() => { ... }, [logs]);

// Component B - App.tsx (computing globally)
const computedAppStats = useMemo(() => { ... }, [allLogs]);
```

### Step 2: Compare Computations
| Location | Logic | Result |
|----------|-------|--------|
| StatsPage | Complex, local | Wrong |
| App.tsx | Clean, centralized | Correct |

### Step 3: Apply Single Source of Truth
```typescript
// WRONG: Computing in child component
function StatsPage({ logs }) {
  const stats = useMemo(() => computeStats(logs), [logs]);
  // ...
}

// RIGHT: Pass computed data as props
function App() {
  const computedAppStats = useMemo(() => computeStats(allLogs), [allLogs]);
  return <StatsPage appStats={computedAppStats} />;
}

function StatsPage({ appStats }) {
  // Just display, don't compute
  return <div>{appStats.map(...)}</div>;
}
```

### Key Lessons
1. **Compute ONCE at highest level** - Usually App.tsx for global data
2. **Pass down as props** - Child components display, don't compute
3. **Remove redundant computations** - Delete local useMemo hooks
4. **Share computed data** - If two components need same data, compute once

### When to Apply
- Child component computing what parent already computed
- Same computation logic duplicated
- Data inconsistent between similar views
- Performance issues from duplicate computations

### Signs You're Computing Twice
```typescript
// Red flag 1: Component receives logs AND computes stats
function Component({ logs }) {
  const stats = useMemo(() => computeFromLogs(logs), [logs]);
  // ...
}

// Red flag 2: Multiple components computing same thing
// StatsPage.tsx computes stats
// ProductivityPage.tsx computes similar stats
// Dashboard.tsx computes yet another version

// Solution: Centralize in App.tsx, pass as props
```

---

## 🛠️ Debugging Tools

### Console Logging
```typescript
// Main process
console.log('[DeskFlow] ✅ SQLite initialized');
console.error('[DeskFlow] Error:', err.message);

// Renderer
console.log('[DeskFlow] Loaded', logs.length, 'logs');
console.warn('[DeskFlow] Texture fallback used');
```

### DevTools
- **Electron:** Open with Ctrl+Shift+I
- **Console:** Check for errors
- **Network:** Verify asset loading
- **Elements:** Inspect DOM

### State Inspection
```typescript
// Check current state
console.log('Planets:', planets);
console.log('Texture:', texture);
console.log('Logs:', logs.length);
```

---

## 📊 Performance Debugging

### FPS Drops
**Causes:**
- Too many planets (>12)
- High geometry segments
- Unnecessary re-renders
- Memory leaks

**Fixes:**
- Limit to 12 planets
- Use 64x64 segments max
- Memoize expensive computations
- Clean up event listeners

### Memory Leaks
**Check for:**
- Event listeners not removed
- Textures not disposed
- State growing unbounded

**Fixes:**
```typescript
useEffect(() => {
  const interval = setInterval(...);
  return () => clearInterval(interval); // Cleanup
}, []);
```

---

## 🔧 Build Issues

### Vite Build Fails
**Check:**
1. TypeScript errors
2. Missing imports
3. Circular dependencies
4. File paths correct

**Fix:**
```bash
npx tsc --noEmit  # Check types
npm run build:renderer  # Rebuild
```

### Electron Build Fails
**Check:**
1. TypeScript config correct
2. Output directory exists
3. File renamed to .cjs

**Fix:**
```bash
npx tsc src/main.ts src/preload.ts \
  --module commonjs \
  --target ES2020 \
  --esModuleInterop \
  --outDir dist-electron \
  --skipLibCheck
```

---

## 🤖 AI-Specific Issues & Fixes

### "x is not a function" / "Callback is not defined"
**Problem:** When calling props callbacks like `onCategoryOverridesChange(...)`

**What NOT to do:**
- ❌ Call directly: `onCategoryOverridesChange(value)` - will throw if undefined
- ❌ Use optional chaining with await: `await window.deskflowAPI?.method()` - returns undefined, not promise
- ❌ Multiple nested try-catch blocks - makes debugging harder

**What TO do:**
- ✅ Check type first: `if (typeof onCallback === 'function') { onCallback(value); }`
- ✅ Wrap in try-catch: `try { onCallback(value); } catch (e) { /* ignore */ }`

**Why it fails:**
- Props may not be passed (undefined)
- Optional chaining (`?.`) returns undefined, not a caught error
- React may unmount between check and call
- TypeScript types may not match runtime

### Promise/Async Issues
**Problem:** `Uncaught (in promise) TypeError`

**Fix:**
- Always wrap async calls in try-catch
- Don't use `await` with optional chaining: `await window.api?.method()` can fail silently
- Check if result exists before using: `if (result) { ... }`

### File Search Confusion: Filesystem vs Codebase Search
**Problem:** User references a file (e.g., `Initialize.md`) and AI searches for it via grep/code search instead of checking the actual filesystem.

**What NOT to do:**
- ❌ Grep for filename patterns and assume the FIRST match in code is the user's file
- ❌ Search `main.ts` for dynamically generated filenames when user means a static file on disk

**What TO do:**
- ✅ Use glob/read on the actual path first: does `agent/Initialize.md` exist?
- ✅ Consider case sensitivity: `Initialize.md` ≠ `INITIALIZE.md`
- ✅ The filesystem is the source of truth — code references to a filename are NOT the file itself

**Why it fails:**
- A file can be referenced in code (e.g., `main.ts` generates `INITIALIZE.md`) but a different file with a similar name exists on disk (`agent/Initialize.md`)
- grep finds every occurrence in code, not just the file the user is talking about
- Case-insensitive search on Windows makes `Initialize.md` and `INITIALIZE.md` look the same

---

## 📷 3D Camera/Clipping Debugging Pattern

**When you see black squares, cut-off objects, or particles disappearing when rotating camera:**

### Step 1: Check Camera Far Plane
```typescript
// Wrong - far plane defaults to ~2000
camera={{ position: [0, 100, 200], fov: 45 }}

// Right - explicit far plane
camera={{ position: [0, 100, 200], fov: 45, near: 0.1, far: 10000 }}
```

### Step 2: Check Position Mismatches
Verify all positioned elements match their constants:
```typescript
const APPS_GALAXY_POS: [number, number, number] = [0, 0, 0];
const WEBSITES_GALAXY_POS: [number, number, number] = [3250, 0, 0];

// Element must match constant
<group position={WEBSITES_GALAXY_POS}>  // NOT [650, 0, 0]
```

### Step 3: Check OrbitControls Limits
```typescript
// Wrong - can't zoom out far enough
<OrbitControls maxDistance={800} />

// Right - allow viewing entire scene
<OrbitControls maxDistance={5000} />
```

### Step 4: Add Fog for Smooth Fade
```typescript
// Fog helps objects fade naturally instead of clipping
<fog attach="fog" args={['#0a0a14', 1500, 4500]} />
```

### Step 5: Check Stars Coverage
```typescript
// Wrong - stars disappear when zooming out
<Stars radius={500} depth={100} count={3000} />

// Right - stars cover entire viewable area
<Stars radius={4000} depth={200} count={8000} />
```

### Key Numbers to Remember for DeskFlow
| Setting | Value | Reason |
|---------|-------|--------|
| Galaxy distance | 3250 | 5x galaxy width |
| Camera far | 10000 | Covers both galaxies |
| OrbitControls maxDistance | 5000 | Can zoom to see both |
| Stars radius | 4000 | Background covers scene |
| Fog range | 1500-4500 | Smooth particle fade |

### Signs of Camera/Clipping Issues
- Black square appears when rotating
- Particles cut off sharply instead of fading
- Can't zoom out far enough
- Stars disappear when moving camera
- Objects "pop" into existence

---

## 🕹️ Electron + Three.js/WebGL Memory Leak Pattern

**Symptoms:** App freezes during page navigation, console stops output, memory grows

**Root Causes:**
1. React StrictMode causes double-mounting (duplicate WebGL contexts)
2. Three.js geometries/materials/textures not disposed on unmount
3. Particle counts too high (memory accumulation)
4. Chart.js instances not destroyed
5. Event listeners not cleaned up

**Fix Workflow:**
1. Remove StrictMode from main.tsx (causes double-mount)
2. Add GLCleanup component in Canvas for WebGL disposal
3. Dispose in onUnmount/useEffect cleanup
4. Reduce particle counts if >10K total
5. Lazy-load heavy 3D components
6. Add Chart.js cleanup with destroy()

**Key Numbers:**
| Component | Safe Count | Problem Threshold |
|-----------|------------|-------------------|
| Galaxy particles | 3000-4000 | >6000 |
| Website particles | 2000-3000 | >5000 |
| Stars | 2000-4000 | >6000 |
| Total | <12000 | >15000 leaks |

**Fixed in:** 2026-04-17 (OrbitSystem.tsx, main.tsx, StatsPage.tsx)

---

## � System Prompt Must Include Project-Specific Context

The `DEFAULT_SYSTEM_PROMPT` in `src/lib/defaults.ts` must describe the actual DeskFlow project features, not be a generic "AI coding assistant" template. A generic prompt causes the AI to have no knowledge of:
- Problems/Requests/Checklists CRUD (IPC methods, JSON storage)
- Session and terminal flow
- UI patterns (sidebar tabs, dialogs, navigation)
- Data storage rules (JSON vs DB vs prefs)
- Build/verify commands

If the system prompt looks generic, rewrite it by researching all project features and IPC endpoints.

## 🎨 Tailwind v4 CSS Silent Failure (CRITICAL)

**Severity:** P0 — Entire app looks unstyled/broken with zero build errors

**Symptoms:**
- App renders but looks completely wrong — no colors, no spacing, no layout
- Build succeeds with no errors
- CSS output file is suspiciously small (~14KB instead of 68KB+)
- Most utility classes (bg-zinc-*, text-*, p-*, gap-*, etc.) are missing from built CSS
- May see "Invalid code point" errors in Tailwind — these are RED HERRINGS

**Root Cause:**
`src/index.css` has Tailwind v3 directives instead of v4 directive:
```css
/* WRONG — Tailwind v3 syntax, does NOT work with v4 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Fix:**
```css
/* CORRECT — Tailwind v4 syntax */
@import "tailwindcss";
```

**Why it breaks silently:**
Tailwind v4's engine ignores `@tailwind` directives. They get passed through as inert CSS. The v4 plugin never triggers content scanning, so it never looks at your `.tsx` files to find which utility classes to generate. Only the baseline `@layer properties` and any custom styles in the CSS file itself get emitted.

**Verification checklist:**
1. `src/index.css` line 1 is `@import "tailwindcss";` (NOT `@tailwind base/components/utilities`)
2. `vite.config.ts` has `@tailwindcss/vite` plugin
3. `package.json` has `"tailwindcss": "4.x"` (NOT 3.x)
4. Built CSS file is 60KB+ (not ~14KB)
5. Do NOT install `autoprefixer` or `postcss` — they are v3 dependencies

**NEVER do these:**
- NEVER change `@import "tailwindcss"` to `@tailwind base/components/utilities`
- NEVER run `npm install tailwindcss@latest` — it may downgrade to v3
- NEVER add `autoprefixer` or `postcss` — they conflict with v4
- NEVER assume "build succeeded" means "CSS is correct" — always check output size

---

## 🎣 useMemo with Object Dependencies Causes React TDZ Initialization Error

**Severity:** P1 — Crashes component with "Cannot access 'X' before initialization"

**Symptoms:**
- Error message: "Cannot access 'Jt'/'bs' before initialization" (minified names)
- useMemo dependency array contains complex objects
- Error occurs during React's dependency comparison phase
- Only happens when object dependencies are invalidated/recreated
- Breaks component and all children unexpectedly

**Root Cause:**
useMemo's dependency comparison triggers React's Temporal Dead Zone (TDZ) when checking object references during initialization order issues.

**Wrong Pattern (DO NOT USE):**
```typescript
// ❌ BROKEN - Object dependencies in useMemo
const chartBarsResult = useMemo(() => {
  return expensiveComputation();
}, [heatmapData, chartExternalData]); // Objects cause TDZ
```

**Correct Pattern (USE THIS):**
```typescript
// ✅ FIXED - useState + useEffect with primitive dependencies
const [chartBarsResult, setChartBarsResult] = useState<T | null>(null);

useEffect(() => {
  const result = expensiveComputation();
  setChartBarsResult(result);
}, [primitive1, primitive2]); // Only primitives
```

**Why This Works:**
1. useEffect runs AFTER render (avoids TDZ)
2. Dependency array only contains primitives (no object comparison)
3. Explicit timing control (clearer intent)
4. React doesn't try to compare complex object references during init

**When to Apply:**
- useMemo dependency contains Map, array of objects, or complex structures
- You see minified React errors ('Jt', 'bs', 'ab', etc.)
- Error message mentions "before initialization"
- Changes in other components trigger hidden initialization bugs

**Fixed in:** 2026-05-06 (DashboardPage.tsx line 787)

---

## 🎯 generate-prompt Skill Workflow

**When user says:** "use prompt engineer skill" or "use generate-prompt skill"

**What to do:**
1. Update `state.md` FIRST (mark as IN PROGRESS)
2. Read `agent/skills/generate-prompt/SKILL.md`
3. Gather context: `state.md`, relevant files, data layer
4. CREATE a prompt (don't solve it yourself)
5. Save prompt to `agent/docs/<topic>-prompt.md`
6. Tell user: "Here's the prompt. Send it to the AI to get the full solution."

**What NOT to do:**
- ❌ Solve the problem yourself
- ❌ Edit code directly
- ❌ Skip updating state.md first

**The skill creates prompts FOR another AI to solve.**

**Added:** 2026-05-08 (after idiot moment #8)

---

### Agent Readiness False-Positive on Windows Shell Prompts

**Symptoms:**
- "Waiting for agent..." overlay appears briefly then disappears
- Terminal shows a shell prompt (no AI agent visible)
- System prompt text may appear as garbage in the terminal

**Root Cause:**
- On Windows, shell prompts end with `>` (PowerShell: `PS C:\path>`, CMD: `C:\path>`)
- The `opencode` agent signature `/>\s*$/` matches any line ending with `>` — including the shell prompt
- `agent:ready` fires immediately when the shell prompt appears (first ~100ms), before the AI agent launch command has been processed
- The renderer's `initializeTerminal` sees `agent:ready`, stops waiting, and writes the system prompt to the shell instead of the AI agent

**Fix:**
Added a 3-second startup delay (`handlerStartTime`) to the data handlers in `terminal:create` and `spawn-terminal`. Agent signature detection is skipped for the first 3 seconds, allowing the shell prompt to pass by harmlessly. After 3 seconds, only the real AI agent prompt triggers readiness.

**Prevention:**
- Keep the startup delay as a guard against any shell prompt matching
- If adding new agent signatures (`AGENT_SIGNATURES`), avoid overly broad patterns like `/>\s*$/` — prefer patterns that include the agent name (e.g., `aider>\s*$`)

**Introduced in:** v3.25
**Added:** 2026-05-17

---

### Agent Status Stuck on 'Waiting' (Opposite of False-Positive)

**Symptoms:**
- "Initializing agent..." pill stays visible forever even after agent has started
- Terminal is fully functional but the UI thinks agent isn't ready

**Root Cause:**
- `detectAgentPrompt` only returns `true` when the last non-empty line matches `^[>?$]\s*$`
- If the AI agent outputs multi-line text, headings, or anything before the prompt char, detection never fires
- The condition `!agentReady && agentType && promptDetected` never triggers
- Status stays 'waiting' forever because it only updates on prompt detection

**Fix:**
Added a 7-second fallback timer in `terminal:create` and `spawn-terminal` handlers. If prompt detection hasn't fired within 7 seconds, emit `agent:ready` anyway. This covers cases where the agent outputs initialization text before showing a prompt char.

**Prevention:**
- Don't rely on output pattern matching for state transitions that must happen
- If state must change within a timeframe, always add a time-based fallback
- Pattern-based detection is fragile; explicit event emission is more reliable

**Files:** `src/main.ts` — `terminal:create` (line ~5757) and `spawn-terminal` (line ~5833)

**Introduced in:** v3.26
**Added:** 2026-05-18

---

## 🛑 Dual-State Sync Pattern (AFK/Idle Tracking)

**Symptom:**
- AFK sessions are created correctly but the selected activity doesn't show on the External page (or has 0 duration)
- App sessions continue to be logged for the last active app even while user is AFK

**Root Cause:**
- Two separate `isTracking` flags exist: renderer (React state) and main process (module-level var)
- Idle detection only pauses the renderer's `isTracking` — main process's `pollForeground()` keeps running
- When user returns from idle, `setIsTracking(true)` restarts the 1s timer immediately, but the 5s heartbeat hasn't updated `systemIdleSecondsRef.current` yet — stale high idle value triggers a false re-idle, closing the AFK session with duration=0 and starting a new one

**Fix:**
1. Always sync main process tracking state when idle state changes — use dedicated `setTracking(boolean)` IPC
2. Add a cooldown period (12s = 2+ heartbeat cycles) after returning from idle to prevent false re-idle from stale heartbeat data

**Files:** `src/main.ts` (tracking state), `src/preload.ts` (setTracking bridge), `src/App.tsx` (idle detection + cooldown ref)

**Prevention:**
- When a feature spans main process + renderer, always verify state sync across both
- Account for timer update intervals: if heartbeat is 5s and your timer is 1s, the stale heartbeat value can cause false triggers
- Never assume refs update immediately — they update at their timer's cadence

**Added:** 2026-05-22

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-04 | Initial creation |
| 1.1 | 2026-04-16 | Added callback/promise fix patterns |
| 1.2 | 2026-04-16 | Added Data Mismatch Debugging Pattern |
| 1.3 | 2026-04-16 | Added Data Computation Pattern (Single Source of Truth) |
| 1.4 | 2026-04-16 | Added 3D Camera/Clipping Debugging Pattern |
| 1.5 | 2026-04-17 | Added Electron + Three.js/WebGL Memory Leak Pattern |
| 1.7 | 2026-05-16 | Added System Prompt must include project-specific context pattern |
| 1.6 | 2026-04-19 | Added Tailwind v4 CSS Silent Failure pattern |
| 1.7 | 2026-05-06 | Added useMemo object dependencies TDZ pattern |
| 1.9 | 2026-05-18 | Added Agent Status Stuck on Waiting pattern |

### Sidebar Won't Scroll

**Symptom:** Sidebar navigation items extend past viewport but no scrollbar appears. Content is cut off at the bottom.

**Root Cause:** Missing `min-h-0` on a `flex-col` container in the scroll chain. In flex layout, `flex-col` items default to `min-height: auto`, which means they expand to fit their content and cannot shrink below that. `overflow-y-auto` needs a defined constraint — without `min-h-0` on the flex container, the overflow is never triggered because the container's minimum height is its content height.

**Fix:** Use the two-level wrapper pattern (decouples height from overflow):

```html
<!-- Outer: height constraint from flex (min-h-0 allows shrink) -->
<div className="flex-1 min-h-0">
  <!-- Inner: uses parent's definite height, handles overflow -->
  <div className="h-full overflow-y-auto">
    {content}
  </div>
</div>
```

Putting `overflow-y-auto` directly on the `flex-1` element is unreliable across browsers — the single element must serve as both the flex child (height computed) and the scroll container (overflow computed). The two-level wrapper pattern matches what TabPanel uses and is bulletproof.

**Also check:**
- `py-4` (24px) on each nav item × 11 items = 264px of padding alone. Reduce to `py-2.5` if items need to fit before scrolling.
- Main sidebar nav in `App.tsx` is the most common location for this bug.
- Workspace sidebar tabs (TerminalPage Sessions/Map) typically have correct `relative flex-1 min-h-0` → `h-full overflow-y-auto` chain.

**Last Updated:** 2026-06-05

---

### Minimize Button Hides Wrong Elements

**Symptom:** Minimize button only collapses the sidebar instead of the entire workspace (tabs + terminal layout + sidebar).

**Root Cause:** When wiring `workspaceMinimized` state, the condition `{!workspaceMinimized && sidebarOpen &&` was only placed on the sidebar element. The terminal layout area (tab bar + `TerminalLayout` component) had no `workspaceMinimized` guard at all.

**Fix:** Wrap both the terminal area and the sidebar in a ternary: `{workspaceMinimized ? <RestoreCard /> : (<><terminal-area>{sidebarOpen && <sidebar/>}</>)}`.

**Also check:** 
- Minimize button should use `Minus` icon (not `Minimize2`), be placed beside the close (X) button, and toggle `workspaceMinimized` state via `toggle-minimize` custom event.
- Sidebar collapse (`sidebarOpen`) is a SEPARATE concern — do not conflate with workspace minimize.

**Last Updated:** 2026-05-18
**Maintained By:** AI Development Team

---

### Browser Tracked as App Despite Website Tracking Being ON

**Symptom:** User enables Website Tracking for their browser (Brave, Chrome, etc.), but the browser process name (e.g., "brave.exe") still appears as a regular app entry in Dashboard/StatsPage alongside website entries like "youtube.com".

**Root Cause (v1):** The `pollForeground()` function logs ALL foreground window changes as app entries via `addLog()`. There was no check to skip logging when the detected app is the known browser with the extension installed.

**Root Cause (v2 — rediscovered 2026-05-28):** Three additional bugs found:
1. `isBrowserWithExtension()` had `!isBrowserTrackingEnabled` guard — browser was logged as app when user turned off website tracking
2. Sleep gap detection (line ~2520) was missing `!isBrowserWithExtension(currentApp)` — waking from sleep with browser as last app logged browser
3. Sleep detection (line ~2509) nulled `currentApp` even for browser — undetectable games destroyed tracking state

**Fix in `main.ts`:**
1. `isBrowserWithExtension()` no longer depends on `isBrowserTrackingEnabled` — only checks `browserWithExtension` preference
2. Added `&& !isBrowserWithExtension(currentApp)` to sleep gap detection
3. Sleep detection only nulls `currentApp` for non-browser apps; `sessionStart` is always reset
4. Added safety net in `addLog()` itself: `!is_browser_tracking && app && isBrowserWithExtension(app)` → reject silently

**6 locations where `!isBrowserWithExtension(currentApp)` is checked:**
- PS fallback app change
- PS fallback checkpoint
- Main poll app change
- Main poll checkpoint
- Sleep detection (30 null polls)
- Sleep gap detection (wake from sleep)
- Before-quit handler

**How it works:** When the foreground app matches the browser with the extension, `currentApp` is still set (so `/foreground-app` endpoint returns the browser name for focus checks) but `addLog` is NOT called. The extension handles all website-level tracking via its own data pipeline. 

**Also check:** The `userPreferences.browserWithExtension` is set when the extension calls `POST /browser-identify`. Value comes from `detectBrowserName()` in background.js which returns human-readable names like "Brave", "Chrome", "Edge". The app name from active-win is process names like "brave.exe". The comparison normalizes both sides.

**Last Updated:** 2026-05-28

### Game Sessions Show 3 Seconds Instead of Actual Duration

**Symptom:** Playing a fullscreen game (WuWa, Osu) for 5+ minutes but Dashboard shows only 3 seconds.

**Root Cause:** Games in exclusive fullscreen mode are invisible to both `active-win` and the PS fallback (`GetForegroundWindow()`). After 30 consecutive null polls (150 seconds with 5s interval), the sleep detection fired and reset `currentApp = null`, destroying the tracking state. The "3 seconds" comes from a brief detectable window (launcher, overlay, or exit animation) during game launch/exit.

**Fix in `main.ts`:**
- Sleep detection no longer nulls `currentApp` when `isBrowserWithExtension(currentApp)` returns true (browser last known app). Only `sessionStart` is reset. When the game exits and a detectable app appears, tracking resumes normally.
- Note: Game duration itself is still lost when both detection methods fail. This is a fundamental limitation of window-based detection with anti-cheat protected games.

## Miscommunication: User says "prompt" meaning "my message text"

**Symptom:** User asks "wheres the prompt for the problems" but means their own original message, not a file.

**Root Cause:** In this project's convention, "prompt" = markdown file in `agent/`. But in user-speak, "prompt" = "the text I gave you".

**Fix:** When user asks for "the prompt for [something they mentioned]", always quote their original message back to them first. If they wanted a file, they'll clarify.

**Last Updated:** 2026-06-04

---

## ⚡ React Functional Updater Race with Async IPC Callbacks

**Symptom:** An async callback (e.g., idle return handler) queues a state update via functional updater (`setQueue(prev => [...prev, entry])`). A separate callback (e.g., sleep detection) clears the queue (`setQueue([])`). The entry from the first callback still appears, undoing the clear.

**Root Cause:** React's state batching + functional updater behavior:
1. Sleep handler calls `setAfkPromptQueue([])` — this is a state SET, not a function
2. Idle return handler's `setAfkPromptQueue(prev => [...prev, entry])` uses a **functional updater**
3. When React batches these updates, it processes the functional updater AFTER the direct set
4. The functional updater's `prev` argument is the **latest committed state**, not the "current" one
5. Since the idle handler ran asynchronously and already captured `prev` from before the sleep clear, `...prev, entry` still contains the AFK entry

**Fix pattern — synchronous guard ref:**
```ts
const guardRef = useRef(false);

// In the "clear" callback (always synchronous entrance, no await before set):
guardRef.current = true;
setQueue([]);

// In the "append" callback (has await calls):
async () => {
  if (guardRef.current) return; // Check BEFORE async
  const result = await someAsyncOp();
  if (guardRef.current) return; // Check AFTER async (reentrancy)
  setQueue(prev => [...prev, result]);
}
```

**Why this works:**
- `useRef` is synchronous — `guardRef.current = true` is visible immediately, even before React has processed the batch
- The async callback checks the ref BEFORE doing work (short-circuits) and AFTER async operations (catches race during the await gap)
- Unlike `useState`, `useRef` doesn't participate in React's batching — its mutation is immediate

**Key differences from useState guards:**
- ❌ Checking `someState` won't work — React state is stale in async callbacks
- ✅ Checking `someRef.current` works — refs are synchronous across all callbacks
- ✅ Checking the ref AT BOTH points (pre-async + post-async) covers the race window

**Added:** 2026-06-04
**Fixed in:** `src/App.tsx` — `sleepActiveRef` pattern in `onSleepDetection`/`idleReturnFnRef`

---

## Never hardcode model names — retry with reduced maxTokens instead

**Symptoms:**
- Topic digest generates 429 rate-limit errors after a "fix" for 402 credit errors
- User's configured model is silently overridden by a hardcoded fallback
- Switching models introduces new failure modes (rate limits, different behavior)

**Root cause:**
- Assumption that "any free model is better than a credit error"
- Hardcoding `meta-llama/llama-3.2-3b-instruct:free` as fallback without checking user's configured model
- Not understanding that the user deliberately chose their model in settings

**Fix:**
- On OpenRouter 402 credit errors, retry the **same model** with reduced maxTokens (200→100→50)
- `generateTopicDigest` accepts optional `maxTokens` parameter for retry calls
- Never substitute a different model — the user configured theirs for a reason

**Prevention:**
- Never hardcode model names — always use the user's configured model from settings
- If retrying on credit errors, reduce maxTokens on the SAME model — never switch to a different model
- Before implementing any AI feature fix, check the user's actual settings values first
- 402/credit error → retry same model with reduced maxTokens
- 429/rate-limit → surface the error, let user retry

**Added:** 2026-06-06
**Fixed in:** `src/main.ts:9926-9940`, `src/services/AIService.ts:517`

---

## MCP feedback doc vs SKILL.md confusion

**Symptoms:**
- User asks to document a conversation about Probe MCP capabilities
- AI creates a formal SKILL.md with YAML frontmatter, tool specs, and code patterns
- User gets angry — they wanted a conversation capture, not a tool definition

**Root cause:**
- AI hears "make file in skill tab" and assumes SKILL.md format
- Doesn't distinguish between "create a tool/skill" vs "document a conversation/review"
- Over-engineers: writes 300+ lines of DSL definitions when user wanted Q&A feedback document

**Fix:**
- When user says "review", "feedback", "my question and your response", "document this conversation" — create a `*_REVIEW.md` or `*_FEEDBACK.md` file capturing the actual dialogue exchange
- Do NOT create a SKILL.md with frontmatter DSL — that's for defining interactive tools, not documenting feedback
- File format: Q&A style, capability analysis, improvement suggestions — NOT input/output schemas and code examples

**Prevention:**
- Before writing, ask: "Do you want a SKILL.md (tool definition) or a feedback document (conversation capture)?"
- If unsure, read the `PROBE_MCP_REVIEW.md` in `agent/skills/probe-mcp-testing/` for the correct format
- Pattern signal: user wants "improve the MCP" → they want analysis/recommendations, not a new tool

**Added:** 2026-06-15
**Reference file:** `agent/skills/probe-mcp-testing/PROBE_MCP_REVIEW.md`

---

## Writing to existing output folders instead of creating new ones

**Root cause:** When asked to write fresh versions of context bundle, prompt, or design files, the AI wrote directly into the **existing** output folder, overwriting unrecoverable files. Old files were not in git → permanently destroyed.

**Fix:**
- Before writing ANY file, check if the target directory already exists
- If it does and is not a designated "working" directory → create a new directory (e.g., `-2026-06-18`, `-v2`)
- When in doubt, ASK the user about folder naming
- Convention: new iteration = new folder. Never overwrite.

**Added:** 2026-06-18
**Reference file:** `agent/skills/agent-reflect/logs/2026-06-18_overwrite_existing_folder_idiot.md`

---

## CYCLE REPORT format — ALWAYS use for status responses

**Root cause:** When asked "What did we do so far?" or any status query, the AI repeatedly responds with a verbose multi-section summary instead of the project's canonical CYCLE REPORT format.

**Symptoms:**
- User says "What did we do so far?" — AI gives Goals/Constraints/Progress/Next Steps breakdown
- AI produces long structured responses with unnecessary preamble
- User gets frustrated and calls AI "idiot" (repeated pattern: 2026-05-18, 2026-06-20, 2026-06-21)

**Fix:**
Respond ONLY in this format for any status/cycle query:

```
---
CYCLE: <n>
BUILD: OK/FAIL | main.cjs <timestamp> | preload.cjs <timestamp>
GATE A  window.deskflowAPI: <object with N keys | undefined>
FEATURE: <name>
  STEPS: <what you clicked/ran>
  EXPECTED: <from packet>
  ACTUAL: <what happened>
  RENDERER CONSOLE: <relevant lines | none>
  MAIN CONSOLE: <relevant lines | none>
  VERDICT: PASS / FAIL / PARTIAL
---
```

No preamble, no postamble, no extra sections.

**Prevention:**
- Any status query → CYCLE REPORT only
- No explanatory text before or after
- If no cycle exists, use "CYCLE: N/A"
- Reference file: `agent/skills/agent-reflect/logs/2026-06-21_idiot_trigger_verbose_report_format.md`
