# Fix DeskFlow Startup Bugs — FocusManager Double-Init, word_tracker_config, learn Handlers

## Raw Request
/generate-prompt USE THE SKILL AND NOTHING ELSE TO SOLVE THE PROBLEM. I WILL EGNERATE HTE RESULT SPEC FOR YOU TO THEN FOLLOW TO SOLVE THE FUCKING PROBLEM. GET IT?

Plus: "WHERES TEH PROMPT??"

## Problem Statement
DeskFlow Electron app (RHEO, Electron 41.10.7, ABI 145) crashes on Linux startup. Four bugs remain after ABI + heartbeatInterval fixes:

1. **FocusManager "second handler" crash** — `createWindow()` called twice (once from `app.whenReady()`, once from `app.on('activate')` tray handler). Second call tries to register `focus:start` IPC handler again → Electron throws → FocusManager null → all focus IPC broken.
2. **word_tracker_config table missing** — `initWordTracker()` queries table before it's created → SQLite error → fallback to JSON.
3. **learn:* IPC handlers not registered** — `registerLearnHandlers(db, callAi)` called with only 2 args, but function signature is `registerLearnHandlers(db, callAi, streamAi)`. `streamAi` is undefined → `TutorServiceV2` constructor throws → entire registration fails silently inside try/catch → "⚠️ Lyceum Learn module failed to register" → no learn handlers.
4. **Sleep state JSON parse** — Already fixed in compiled code (empty-check before JSON.parse).

## Context
- App: `/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker`
- Electron: 41.10.7, ABI 145 (better-sqlite3 rebuilt via @electron/rebuild)
- OS: Fedora 44 KDE, Wayland session (force X11 via `WAYLAND_DISPLAY=` + `ELECTRON_OZONE_PLATFORM=x11`)
- Build: `node scripts/build.mjs` (4 phases: renderer → preload → main services → main entry)
- Previous fixes applied: esbuild mismatch, workspace.ts route, vite binary, sync.db path, better-sqlite3 ABI, heartbeatInterval declaration, word_tracker_config CREATE order, sleep state empty-check, windowCreated guard

## Context Bundle
See `CONTEXT_BUNDLE.md` in this folder for full source code excerpts, line numbers, compiled file locations, and architecture details.

## Engineering Task
Fix the remaining bugs so the app launches without crashing and all IPC handlers are registered. The four bugs above need fixes — bugs 1, 2, and 4 are already fixed in source but bug 3 (learn handlers) is the critical remaining issue.

### Bug 3 Detail (the critical one)
In `src/main.ts` (compiled to `dist-electron/main.cjs`), the learn handler registration at lines 4004-4027 calls:
```typescript
registerLearnHandlers(db, async (prompt, systemPrompt, maxTokens) => { ... });
```
But `registerLearnHandlers` in `src/services/learn/index.ts` (compiled to `dist-electron/services/learn/index.js`) has signature:
```typescript
function registerLearnHandlers(db: Database, callAi: AiCallback, streamAi?: AiCallback) { ... }
```
The third parameter `streamAi` is not passed. Inside the function, `streamAi` is passed to `new TutorServiceV2(db, callAi, streamAi, tutorPersona)`. With `streamAi` being `undefined`, the TutorServiceV2 constructor likely throws, causing the entire `registerLearnHandlers` call to fail. The failure is caught by the try/catch at lines 4025-4027, logging "⚠️ Lyceum Learn module failed to register" but leaving no handlers registered.

The preload bridge (`src/preload.ts`, compiled to `dist-electron/preload.cjs` lines 1150-1169) exposes ALL learn bridges (`deskflowAPI.learn.*`) — they exist and are correct. The problem is purely on the main process side: the handlers are never registered because `registerLearnHandlers` throws.

## Fix Options for Bug 3
1. Pass `null` as third arg: `registerLearnHandlers(db, callAi, null)` — simplest, if TutorServiceV2 handles null
2. Make streamAi optional with default: change signature to handle undefined
3. Pass a no-op stream callback

## UX Task
After fixes, verify app launches cleanly with:
- No FocusManager crash
- No word_tracker_config fallback
- Learn handlers registered (check log for "✅ Lyceum Learn module registered")
- No sleep state parse error
- App window loads

## Constraints
- Do NOT use git checkout/reset/restore (Zero-Destruction Rule)
- Build with `node scripts/build.mjs` after source changes
- Can also patch compiled `dist-electron/main.cjs` directly for immediate testing
- Launch with X11 mode: `WAYLAND_DISPLAY="" ELECTRON_OZONE_PLATFORM=x11 ./start-dev.js`
- Project path has spaces — use proper quoting or cd first

## Acceptance Criteria
1. App starts without FocusManager "second handler" crash
2. word_tracker_config table exists in SQLite DB (no JSON fallback)
3. Learn handlers registered: log shows "✅ Lyceum Learn module registered"
4. Renderer can call `deskflowAPI.learn.listLessons()` etc. without "No handler registered" error
5. No sleep state JSON parse error
6. App stays running (no SIGTRAP/Wayland crash)

## Files Involved
- `src/main.ts` — main process entry, createWindow(), IPC registration
- `src/main/wordTracker.ts` — word tracker init (FIXED)
- `src/services/learn/index.ts` — learn handler registration (NEEDS FIX)
- `src/services/learn/services/tutorV2.service.ts` — TutorServiceV2 constructor
- `src/preload.ts` — preload bridges (CORRECT, no changes needed)
- `dist-electron/main.cjs` — compiled main (can patch directly)
- `dist-electron/services/learn/index.js` — compiled learn service (can patch directly)
- `dist-electron/preload.cjs` — compiled preload (CORRECT, no changes needed)
- `/home/clementzhao/.config/RHEO/deskflow-sleep-state.json` — sleep state file (corrupted, can delete)
