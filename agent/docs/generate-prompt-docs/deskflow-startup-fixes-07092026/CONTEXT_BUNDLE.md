# Context Bundle: DeskFlow Startup Fixes (Canonical)

**Date**: 2026-09-07
**Folder**: `agent/docs/generate-prompt-docs/deskflow-startup-fixes-07092026/`

## Project Overview

- **Repo root**: `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker`
- **Electron**: 41.10.7, bundled Node 24.18.0, V8 14.6.202.34-electron.0, ABI 145
- **System Node**: v26.8.1 (ABI 147, irrelevant — Electron bundles its own)
- **OS**: Fedora 44 KDE Plasma, wayland session, uid=1000(clementzhao)
- **Mount**: fusebk (NTFS) at repo root — `noexec` not set, writable confirmed

## Build System

Single build command: `node scripts/build.mjs` (runs 4 phases: renderer → preload → main services → main entry).

Output artifacts:
- `dist/index.html` — must contain `#root`
- `dist-electron/preload.cjs` — ~120KB, contextBridge + IPC bridges
- `dist-electron/main.cjs` — ~1.5MB, main process entry
- `dist/assets/*.js` — renderer bundle

## IPC Architecture

### Preload Bridge (`dist-electron/preload.cjs`, 1445 lines)

Exposes `window.deskflowAPI` via `contextBridge.exposeInMainWorld`. Pattern:

```javascript
// src/preload.ts → dist-electron/preload.cjs
import_electron.contextBridge.exposeInMainWorld("deskflowAPI", {
  // invoke pattern: ipcRenderer.invoke("channel-name", ...args)
  getLogs: () => import_electron.ipcRenderer.invoke("get-logs"),
  // on pattern: ipcRenderer.on("channel-name", handler)
  onForegroundChange: (callback) => {
    const handler = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("foreground-changed", handler);
    return () => import_electron.ipcRenderer.removeListener("foreground-changed", handler);
  },
  // ... 200+ bridges total
});
```

### Main Process Handlers (`dist-electron/main.cjs`, 34628 lines)

IPC handlers registered at module top level in `src/main.ts` (compiled to `main.cjs`). Pattern:

```javascript
// main.cjs — handler registration
ipcMain.handle("get-dashboard-aggregates", async (event, request) => {
  // ... query db, return result
});
```

### Learn Module IPC (`dist-electron/services/learn/index.js`, 1345 lines)

```javascript
// Line 73: registerLearnHandlers signature
function registerLearnHandlers(db, callAi, streamAi) {
  (0, import_repo.runMigration)(db);
  // ... instantiate services
  console.log("[learn] IPC handlers registered — lmd-import v2 (accepts { source })");
  import_electron.ipcMain.handle("learn:importLdoc", (_event, payload) => { ... });
  import_electron.ipcMain.handle("learn:validate", (_event, payload) => { ... });
  import_electron.ipcMain.handle("learn:listLessons", (_event, { branchId, part, chapter, subtopic } = {}) => {
    return content.listLessons({ branchId, part, chapter, subtopic });
  });
  // ... 20+ more learn:* handlers (lines 93-500+)
}
```

### Preload Learn Bridges (`dist-electron/preload.cjs`, lines 1150-1169)

```javascript
// ALL learn bridges ARE exposed — these exist
deskflowAPI: {
  // ...
  learnImportLdoc: (payload) => import_electron.ipcRenderer.invoke("learn:importLdoc", payload),
  learnValidate: (payload) => import_electron.ipcRenderer.invoke("learn:validate", payload),
  learnListLessons: (params) => import_electron.ipcRenderer.invoke("learn:listLessons", params || {}),
  learnListChapters: (params) => import_electron.ipcRenderer.invoke("learn:listChapters", params || {}),
  learnListGroups: (params) => import_electron.ipcRenderer.invoke("learn:listGroups", params || {}),
  learnListBranches: () => import_electron.ipcRenderer.invoke("learn:listBranches"),
  learnGetTopicsByBranch: (params) => import_electron.ipcRenderer.invoke("learn:getTopicsByBranch", params),
  learnGetLesson: ({ lessonId }) => import_electron.ipcRenderer.invoke("learn:getLesson", { lessonId }),
  learnGetNode: ({ nodeId }) => import_electron.ipcRenderer.invoke("learn:getNode", { nodeId }),
  learnGetGraph: (params) => import_electron.ipcRenderer.invoke("learn:getGraph", params || {}),
  learnAskTutor: (params) => import_electron.ipcRenderer.invoke("learn:askTutor", params),
  learnSubmitQuiz: (params) => import_electron.ipcRenderer.invoke("learn:submitQuiz", params),
  learnGetProgress: (params) => import_electron.ipcRenderer.invoke("learn:getProgress", params || {}),
  learnGetDueReviews: () => import_electron.ipcRenderer.invoke("learn:getDueReviews"),
  learnPickFile: () => import_electron.ipcRenderer.invoke("learn:pick-file"),
  learnGetWorkedExample: () => import_electron.ipcRenderer.invoke("learn:get-worked-example"),
  learnGetSchema: () => import_electron.ipcRenderer.invoke("learn:get-schema"),
  learnGetAuthorGuide: () => import_electron.ipcRenderer.invoke("learn:get-author-guide"),
  learnBuildPrompt: (params) => import_electron.ipcRenderer.invoke("learn:buildPrompt", params),
  learnGenerateLdoc: (params) => import_electron.ipcRenderer.invoke("learn:generateLdoc", params),
  // ... more
}
```

## Bug 1: FocusManager "second handler" crash

### Symptom
```
[DeskFlow] Failed to init FocusManager: Error: Attempted to register a second handler for 'focus:start'
    at IpcMainImpl.handle (node:electron/js2c/browser_init:2:116931)
    at FocusManager.registerIpc (focusManager.js:320:29)
    at createWindow (main.cjs:7000:18)
```

### Root Cause
`createWindow()` is called from 3 places in `src/main.ts`:
1. `app.whenReady()` → main startup path (line ~22703 in compiled)
2. `app.on('activate', ...)` → `ensureWindow()` → `createWindow()` (line 4968-4970)
3. `ipcMain.handle('show-window', ...)` → `ensureWindow()` (line 5600-5601)

On Linux, `app.on('activate')` fires after initial window creation (dock/tray click). If `mainWindow` is null/destroyed, `ensureWindow()` calls `createWindow()` again. `createWindow()` runs ALL IPC registrations including `focusManager.registerIpc()`, causing a second registration attempt for `focus:start` → Electron throws.

### Source Location
- `src/main.ts:4963-4976` — `ensureWindow()` function
- `src/main.ts:4977+` — `createTray()`
- `src/main.ts:5073` — `createWindow()` function definition
- `src/main.ts:5400-5406` — Compositions engine
- `src/main.ts:5910-5912` — `initWordTracker` + `ensureWordTrackerTables`
- `src/main.ts:6983-7006` — FocusManager registration (inside createWindow)

### Compiled Location
- `dist-electron/main.cjs:6832` — `createWindow()` definition
- `dist-electron/main.cjs:6833-6834` — windowCreated guard (ALREADY PATCHED)
- `dist-electron/main.cjs:6986-7010` — FocusManager init + registerIpc (inside try/catch)
- `dist-electron/main.cjs:7004` — `focusManager.registerIpc()`
- `dist-electron/domains/focus/focusManager.js:320` — `registerIpc()` method

### Fix Applied (Source)
Added `let windowCreated = false;` alongside `let mainWindow = null;` at line ~4962, and guard at start of `createWindow()`:
```typescript
function createWindow() {
    if (windowCreated) return;
    windowCreated = true;
    // ... rest of function
}
```

### Compiled Status
ALREADY PATCHED in `main.cjs:6833-6834`:
```javascript
function createWindow() {
    if (windowCreated) return;
    windowCreated = true;
```

## Bug 2: word_tracker_config table missing

### Symptom
```
[DeskFlow] ⚠️ SQLite failed, falling back to JSON: no such table: word_tracker_config
```

### Root Cause
`initWordTracker()` queries `word_tracker_config` table BEFORE it's created. The table creation happens in `ensureWordTrackerTables()` which is called AFTER `initWordTracker()`.

Call order in `main.cjs`:
```
line 5911: await initWordTracker();       // queries word_tracker_config → fails
line 5912: await ensureWordTrackerTables(); // creates word_tracker_config → too late
```

### Source Location
- `src/main/wordTracker.ts` — full file (5115 chars)
- `initWordTracker()`: lines 46-126 in source
- `ensureWordTrackerTables()`: lines 128-146 in source
- The SELECT at line 121 queries `word_tracker_config` before CREATE TABLE at line 131

### Compiled Location
- `dist-electron/main/wordTracker.js` — compiled wordTracker module
- `initWordTracker`: lines 55-122 (SELECT at line 55-68, CREATE at lines 118-140 — WRONG ORDER)
- `ensureWordTrackerTables`: in `main.cjs` lines 5955-5966 (redundant CREATE, harmless)

### Fix Needed
Move `CREATE TABLE IF NOT EXISTS word_tracker_config` from `ensureWordTrackerTables()` into `initWordTracker()`, before the SELECT query.

In source (`src/main/wordTracker.ts`), the CREATE TABLE block (~lines 131-146) should be moved to before line 121 (the SELECT).

In compiled (`dist-electron/main/wordTracker.js`), the CREATE TABLE block (lines 118-140) should be moved to before line 55 (the SELECT).

The `ensureWordTrackerTables()` function can keep its CREATE as a no-op safety net, or be cleaned up.

## Bug 3: learn:* IPC handlers not registered

### Symptom
```
Error invoking remote method 'learn:listLessons': Error: No handler registered for 'learn:listLessons'
Error invoking remote method 'learn:getTutorConfig': Error: No handler registered for 'learn:getTutorConfig'
Error invoking remote method 'learn:getProfile': Error: No handler registered for 'learn:getProfile'
Error invoking remote method 'learn:setProfile': Error: No handler registered for 'learn:setProfile'
```

### Root Cause: streamAi argument mismatch

**Compiled learn service** (`dist-electron/services/learn/index.js:73`):
```javascript
function registerLearnHandlers(db, callAi, streamAi) {
  // ...
  const tutorV2 = new import_tutorV2.TutorServiceV2(db, callAi, streamAi, tutorPersona);
  // streamAi is undefined → TutorServiceV2 constructor likely throws
}
```

**Compiled caller** (`dist-electron/main.cjs:5962-5964`):
```javascript
const { registerLearnHandlers } = require("./services/learn/index.js");
const { buildChain: buildChain2, runWithFallback: runWithFallback2 } = require("./services/providers/router");
registerLearnHandlers(db, async (prompt, systemPrompt, maxTokens) => {
  // ... callAi implementation
});
// ONLY 2 arguments passed: db + callAi. streamAi is MISSING.
```

The third argument `streamAi` is not passed. Inside `registerLearnHandlers`, `streamAi` is `undefined`. When `new TutorServiceV2(db, callAi, streamAi, tutorPersona)` is constructed at line 87, the undefined `streamAi` likely causes a throw inside the TutorServiceV2 constructor → the entire `registerLearnHandlers` call fails → caught by try/catch at `main.cjs:5980-5981` → **"⚠️ Lyceum Learn module failed to register"** → no handlers registered.

### Source Locations
- `src/main.ts:4004-4027` — learn handler registration (inside try/catch)
- `src/services/learn/index.ts` — source learn module (compiles to `dist-electron/services/learn/index.js`)
- `src/services/learn/services/tutorV2.service.ts` — TutorServiceV2 constructor (likely throws on undefined streamAi)

### Compiled Locations
- `dist-electron/main.cjs:5960-5982` — learn registration try/catch block
- `dist-electron/services/learn/index.js:73-92` — `registerLearnHandlers` function
- `dist-electron/services/learn/index.js:87` — `new TutorServiceV2(db, callAi, streamAi, tutorPersona)`

### Fix Options
1. **Pass a streamAi callback** (even if it throws/logs): `registerLearnHandlers(db, callAi, () => { throw new Error('streamAi not implemented'); })`
2. **Make streamAi optional in registerLearnHandlers**: Change signature to `registerLearnHandlers(db, callAi, streamAi?)` and handle undefined.
3. **Pass null**: `registerLearnHandlers(db, callAi, null)` if TutorServiceV2 handles null.

The minimal fix is option 1 or 3 — pass something so the constructor doesn't receive undefined.

## Bug 4: Sleep state JSON parse error

### Symptom
```
[DeskFlow] Failed to load sleep state: SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at loadSleepState (main.cjs:1960:25)
    at main.cjs:23464:5
```

### Root Cause
`loadSleepState()` reads `deskflow-sleep-state.json` and parses it. If the file is empty, truncated, or contains invalid JSON, `JSON.parse()` throws. The file at `/home/clementzhao/.config/RHEO/deskflow-sleep-state.json` may be corrupted from a previous crash.

### Source Location
- `src/main.ts:155-168` — `loadSleepState()` function
- `src/main.ts:157-161` — reads file, parses JSON
- `src/main.ts:168` — catch block logs error but doesn't prevent crash

### Compiled Location
- `dist-electron/main.cjs:1957-1974` — `loadSleepState()` function
- `main.cjs:1960` — `JSON.parse(rawSleepState)` — crashes on empty/invalid
- `main.cjs:1961` — **ALREADY PATCHED**: `if (!rawSleepState || !rawSleepState.trim()) { return; }`

### Fix Status
✅ ALREADY FIXED in compiled code. The source patch (adding empty-check before JSON.parse) compiled correctly. The function now:
```javascript
function loadSleepState() {
  try {
    if (fs_1.default.existsSync(sleepStatePath)) {
      const rawSleepState = fs_1.default.readFileSync(sleepStatePath, "utf-8");
      if (!rawSleepState || !rawSleepState.trim()) { return; }  // ← guard
      const data = JSON.parse(rawSleepState);
      // ...
    }
  } catch (err) {
    console.error("[DeskFlow] Failed to load sleep state:", err);
  }
}
```

## Startup Sequence (compiled main.cjs)

1. **Line 22654**: `loadSleepState()` — loads sleep state (now safe)
2. **Line 22576**: `new StateCoordinator()` — state management
3. **Line 6832+**: `createWindow()` — guarded by `windowCreated` flag
   - Line 6986-7010: FocusManager init + registerIpc (inside createWindow)
   - Line 5960-5982: Learn handler registration (inside createWindow)
   - Line 5983+: Content Engine registration
4. **Line 23468**: `loadSleepState()` called again (redundant but harmless)

## Files to Modify

### Source (primary — needs rebuild):
- `src/main.ts` — windowCreated guard (DONE), streamAi fix for learn
- `src/main/wordTracker.ts` — move CREATE TABLE before SELECT (DONE)
- `src/services/learn/index.ts` — make streamAi optional (alternative fix)
- `src/services/learn/services/tutorV2.service.ts` — handle undefined streamAi

### Compiled (direct patch — no rebuild needed):
- `dist-electron/main.cjs` — fix learn caller to pass streamAi argument (line 5962-5964)
- `dist-electron/services/learn/index.js` — make streamAi optional (line 73)

### Direct compiled patch for Bug 3 (recommended — immediate fix):
In `dist-electron/main.cjs` around line 5962-5964, change:
```javascript
registerLearnHandlers(db, async (prompt, systemPrompt, maxTokens) => {
```
to:
```javascript
registerLearnHandlers(db, async (prompt, systemPrompt, maxTokens) => {
  // ... existing callAi implementation
}, null);  // <-- add null for streamAi
```

This passes `null` as `streamAi` so `TutorServiceV2` receives `null` instead of `undefined`. If `TutorServiceV2` doesn't handle null, the alternative is to patch `dist-electron/services/learn/index.js:73` to make `streamAi` optional:
```javascript
function registerLearnHandlers(db, callAi, streamAi) {
  streamAi = streamAi || null;  // <-- add this line
```

## Verification Criteria

After fixes, app launch log must show:
1. ✅ NO `Failed to init FocusManager: Attempted to register a second handler`
2. ✅ NO `word_tracker_config` fallback message
3. ✅ `✅ Lyceum Learn module registered` (NOT `⚠️ Lyceum Learn module failed to register`)
4. ✅ NO `Failed to load sleep state` error
5. ✅ All `learn:*` IPC handlers responding (renderer can call them)
6. ✅ App window loads, dashboard visible
7. ✅ No SIGTRAP/Wayland crash (app stays running)

## Launch Command

```bash
# Kill stale processes
pkill -9 -f "electron.*App Tracker" 2>/dev/null; pkill -9 -f "RHEO" 2>/dev/null

# Launch with X11 (Wayland causes SIGTRAP)
export WAYLAND_DISPLAY=""
export ELECTRON_OZONE_PLATFORM=x11
export BROWSER_PATH="/usr/bin/firefox"
cd "/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker"
./start-dev.js > /tmp/rheo-dev-final.log 2>&1 &
echo $!

# Monitor
tail -f /tmp/rheo-dev-final.log
```
