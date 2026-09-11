# Motion Preference Cycling — Context Handoff

**Date:** 2026-09-04  
**Scope:** Full session — motion-preference fix for RHEO landing page  
**Project:** `C:/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/landing/`

---

## 1. TL;DR / Mission

Fix the MotionChip label so it updates to "MOTION ON" / "MOTION OFF" after user clicks, syncing with `localStorage` key `rheo-motion`. Build must pass (SSR-safe, no stale closures). The chip was stuck showing "MOTION AUTO" after every click despite `localStorage` updating correctly.

## 2. Current Status

| Item | Status |
|------|--------|
| Build (`npm run build`) | ✅ Exit 0 |
| Dev server (`localhost:3001`) | ✅ 200 OK |
| `test-cycle.cjs` (Playwright, 1280×800, 5-click cycle) | ❌ FAILING — chip label stays "MOTION AUTO" after every click; `localStorage` cycles correctly (on→off→on…) |
| Debug logging | ✅ Added to `use-motion-preference.ts` (`console.log` in `notify`, `subscribe`, `useMotionPreference`, `useMotionPreferenceSetter`) |
| Dev server console output | ❌ Not captured yet — dev server running in background, need to read its stdout |

**What was just finished:** Clean rewrite of `use-motion-preference.ts` (128 lines, `"use client"`, module-level store + `Set` listeners + `notify`/`subscribe` + three `useEffect` hooks + one `useLayoutEffect` subscriber in setter). Build passes. Debug instrumentation in place.

**What's in flight:** Identifying why the React re-render triggered by `notify()` → `force()` doesn't propagate the new `mode` to the chip's DOM label. Dev server console logs not yet read.

## 3. Key Decisions & Rationale

- **Module-level mutable store** (`let mode`, `Set<() => void>` listeners): Chosen over `useSyncExternalStore` because the simpler pattern was already ~80% working and `useSyncExternalStore` introduced SSR `getServerSnapshot` complexity. Decision was reverted from `useSyncExternalStore` attempt back to manual store.
- **`useLayoutEffect` for setter subscriber:** Used so the subscriber is registered synchronously after DOM mutations, before the first paint — avoids race where first click's `notify()` fires before listener is ready. (Was `useEffect` originally; switched to `useLayoutEffect`.)
- **`useCallback(setMode, [])` with empty deps:** Stable setter identity. Captures `mode` (module `let`) and `notify` by closure — both are mutable/module-level so changes are visible on each call.
- **Three separate `useEffect` hooks in `useMotionPreference`:** (1) Init from localStorage or system RM on mount; (2) System `matchMedia` listener for auto mode; (3) Cross-tab `storage` event sync. Each runs once `[]`.
- **Dual subscriber registration:** `useMotionPreference` registers a subscriber via `useEffect` (line 93-96); `useMotionPreferenceSetter` registers via `useLayoutEffect` (line 104-110). Both call `force(_ => _ + 1)` to trigger re-renders.

## 4. Constraints & Gotchas

- **Clement Zhao constraints (from MEMORY):** NEVER run destructive git commands without explicit permission. Runs `npm run dev` in PowerShell/cmd on Windows, not git-bash. `tee` unavailable there. Expects exhaustive commit messages. ALL CAPS when frustrated. Pushes back on imprecise file-location claims.
- **SSR safety:** File has `"use client"` directive. `getSystemReducedMotion()` and `readStoredMode()` guard against `window` undefined. Build passes with SSR.
- **Module `mode` var:** `let mode: MotionMode = "auto"` at module scope (line 24). Read directly by both hooks. Mutated by init effect, system RM effect, storage effect, and `setMode`.
- **`subscribe` returns unsubscribe:** `listeners.add(fn)` then returns `() => listeners.delete(fn)`. React effects use the returned unsubscribe in cleanup.
- **`notify()` clones listeners:** `for (const fn of [...listeners]) fn()` — copies to avoid mutation during iteration.
- **Test environment:** `test-cycle.cjs` launches headless Chromium, viewport 1280×800, waits 2s for `networkidle`, then 5-click cycle with 200ms wait after each click. Checks `localStorage.getItem('rheo-motion')` and `button[aria-label*="Motion"]` textContent.
- **Gotcha — dev server console:** Debug `console.log` output goes to the dev server process stdout, NOT to the Playwright test output. Need to read the dev server's terminal/background process log to see the debug traces.

## 5. Artifacts & References

| Artifact | Path / URL | Description |
|----------|-----------|-------------|
| Motion preference hook (source of truth) | `landing/src/components/rheo/use-motion-preference.ts` | 128-line module with shared store, 2 exports (`useMotionPreference`, `useMotionPreferenceSetter`), debug logging |
| MotionChip component | `landing/src/components/rheo/MotionChip.tsx` | Calls `useMotionPreferenceSetter()`, renders 3-button group (AUTO/ON/OFF), `aria-label="Motion preference"` |
| `use-reduced-motion.ts` | `landing/src/components/rheo/use-reduced-motion.ts` | Companion hook — context for motion preference system |
| `use-motion-preference.ts` (earlier version) | `src/components/rheo/use-motion-preference.ts` | Older copy — not the active one |
| Test script | `landing/test-cycle.cjs` | Playwright 5-click cycle test, headless Chromium |
| Takeover 1 doc | `docs/takeover_1.md` | Landing LAMINAR spec execution report — 22 items, all DONE |
| Dev server | `http://localhost:3001` | Next.js dev server, 200 OK |
| Landing landing page repo root | `C:/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/landing/` | Next.js standalone build |

## 6. State of the Code / Data

**File:** `landing/src/components/rheo/use-motion-preference.ts` (128 lines, 3,961 bytes)

**Store:**
```ts
let mode: MotionMode = "auto";           // line 24 — module-level mutable
const listeners = new Set<() => void>(); // line 25 — subscriber set
```

**Exports:**
- `useMotionPreference(): MotionMode` — returns module `mode`; init effect (line 44-57) reads localStorage or system RM; system RM listener (line 60-74); cross-tab storage sync (line 77-89); subscriber via `useEffect` (line 93-96).
- `useMotionPreferenceSetter(): { mode, setMode }` — returns `{ mode: useMotionPreference(), setMode }`; `setMode` mutates module `mode` + `localStorage.setItem` + `notify()`; subscriber via `useLayoutEffect` (line 104-110).
- `useShouldAnimate(): boolean` — derived from `useMotionPreference()`: "on"→true, "off"→false, "auto"→!systemRM.

**Debug logging (lines 28, 33, 36, 42, 45, 47, 49, 53, 106, 113, 116):**
- `[notify] firing, mode = X, listeners = N`
- `[subscribe] adding listener, total = N`
- `[unsubscribe] removing listener, remaining = N`
- `[useMotionPreference] rendering, module mode = X`
- `[useMotionPreference] init effect running`
- `[useMotionPreference] readStoredMode = X`
- `[useMotionPreference] mode set from storage to X` / `mode set from system to X`
- `[MPSubscriber] notify received, forcing re-render, module mode = X`
- `[MPSetter] setMode(X) called, module mode before = X`
- `[MPSetter] module mode set to X`

## 7. Open Tasks / Next Actions

1. **Read dev server console output** — The debug `console.log` traces are being emitted by the running dev server. Need to capture them (background process log, or terminal attached to dev server) to see: (a) does `notify()` fire with the correct `mode` value after each click? (b) does `[MPSubscriber] notify received` fire? (c) does `[useMotionPreference] rendering` show the updated `mode`? This is the single most important next step.
2. **If debug shows `notify` firing correctly but chip not updating:** Investigate whether React is batching/debouncing the `force()` calls, or whether the chip component is remounting between clicks (key prop issue, parent re-render).
3. **If debug shows `notify` NOT firing or firing with wrong `mode`:** The `setMode` closure or module `mode` mutation is the issue — check for module re-evaluation (HMR), closure staleness, or shadowing.
4. **Alternative fix if current approach proves unfixable:** Replace the manual store with `useSyncExternalStore` from React (already imported as a fallback). This gives a guaranteed subscribe/unsubscribe contract and avoids manual `force()` re-render hacks.
5. **Once test passes:** Remove debug `console.log` statements, rebuild, confirm clean console, update `docs/takeover_1.md` with fix status.
6. **Commit:** Exhaustive commit message per Clement's preference.

## 8. Glossary / Key Entities

| Entity | Meaning |
|--------|---------|
| RHEO | Electron+React+Vite desktop app (NOT TURGO). Clement Zhao's project. |
| MotionChip / rheo chip | Toggle button component showing "MOTION AUTO" / "MOTION ON" / "MOTION OFF" |
| `rheo-motion` | `localStorage` key for motion preference |
| AUTO / ON / OFF | Three motion modes: auto = follow system RM setting; on = always animate; off = always reduced |
| `useMotionPreference` | Hook reading current mode from shared store |
| `useMotionPreferenceSetter` | Hook returning `{ mode, setMode }` for components that need to change the mode |
| `useShouldAnimate` | Derived boolean hook: should animations run? |
| `useLayoutEffect` | React effect that runs synchronously after DOM mutations, before paint — used for subscriber registration to avoid race |
| `useSyncExternalStore` | React hook for subscribing to external stores — considered but not currently used |
| `test-cycle.cjs` | Playwright test: 5 clicks, 1280×800 viewport, checks localStorage + chip label |
| Clement Zhao | Developer — direct, action-first, hates narration, sensitive about destructive git ops |
| SE Asia UTC+07:00 | Clement's timezone |

---

## How to Resume

1. **Read this file** for full context.
2. **Read `landing/src/components/rheo/use-motion-preference.ts`** — it's the current source of truth (128 lines, debug logging in place).
3. **Read `landing/test-cycle.cjs`** — the failing test.
4. **Read `landing/src/components/rheo/MotionChip.tsx`** — the component under test.
5. **Capture dev server console output** — the debug logs are the key to diagnosing why the chip label doesn't update. The dev server is running at `localhost:3001`; its stdout has the `console.log` traces from `use-motion-preference.ts`.
6. **Run `node test-cycle.cjs` from `landing/`** to reproduce.
7. **If console logs aren't accessible:** Remove debug logging, replace with a different observability approach (e.g., write to a log file via `fs`, or add a DOM attribute that the test can read).

---

*Handoff generated 2026-09-04. Skill: context-handoff.*
