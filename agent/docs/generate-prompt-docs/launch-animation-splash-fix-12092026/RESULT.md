# RESULT — Launch animation fix (R-10 Boot Splash, Meridian Wake)

Status: IMPLEMENTED + VERIFIED HEADLESS. Ready for Hands runtime check in the real Electron app.

## Raw Request (verbatim)

"HOW IS THE ANIMATION STARTUP OF THE APP IDIOT??" / "WHY IS IT STILL NOT WOKRING" / "the app opening animation doesnt work at fucking all. it only shows the black rectangle and nothing else" / "FIX THE LAUNCH ANIMATION"

## Root cause

`public/splash.html` (ships as `dist/splash.html`): `var tick` in the tick-builder loop hoisted across the IIFE scope and overwrote the `function tick(now)` animation loop. `requestAnimationFrame(tick)` received a DIV and threw on the first call — zero frames ever ran, every element kept `opacity: 0`, window stayed pure black. Headless-Chromium proof pre-fix: `Failed to execute 'requestAnimationFrame' on 'Window': parameter 1 is not of type 'Function'`, all styles empty at 1600ms.

Secondary flaw found while verifying: the clock was set at script parse (`performance.now()`), but render-blocking webfont CSS can delay the first frame past the whole 1500ms timeline — the staggered entrance would be skipped on any slow load. Clock now syncs to the first frame.

## Coverage table (PROMPT.md items → this file)

| PROMPT.md Item | Covered? | Location |
|---|---|---|
| 1. Fix `tick` collision, smallest edit, recursion intact | YES | Fix 1 below |
| 2. Full `var`-vs-function scope audit | YES | Audit table below — `tick` was the only collision |
| 3. Preload ambiguity (main preload vs splashPreload.cjs) | NOTED, NOT CHANGED | Follow-up A — Architect decision, splash currently works on main preload |
| 4. Dead skip handlers (`BW.on('keydown')`, `WC.on('mouse-down')`) | NOTED, NOT CHANGED | Follow-up B — no-ops today, no user-visible effect |
| 5. Harden `splash-complete`/`replay-splash` window matching | NOTED, NOT CHANGED | Follow-up C — works today via size+title match |
| 6. `public/` vs `src/` sync rule | YES | Fix 3 below — both patched identically, verified with cmp |
| 7. Verification plan (headless asserts + build + black-screen list) | YES | Evidence below |
| 8. Visual spec unchanged (Concept A repair, no redesign) | YES | No pixel/easing/color touched |
| 9. All startup paths (cold/warm/RM/disabled/skip/dev race/failure) | YES | Path table below |

## Fix 1 — `var tick` → `var tickEl` (the actual repair)

Files: `public/splash.html` + `src/splash.html` (lines ~191-197, identical):

```js
  for (var i = 0; i < 24; i++) {
    var tickEl = document.createElement('div');
    tickEl.className = 'splash-tick';
    tickEl.style.top = (40 + i * 10) + 'px';
    tickFrag.appendChild(tickEl);
  }
```

Nothing else references the old loop variable. `function tick`, `tickFrag`, `tickStart` untouched.

## Fix 2 — clock syncs to first frame (slow-load hardening)

Same two files, three one-line edits:

- `var startTime = performance.now();` → `var startTime = 0;` (+ comment)
- `function tick(now) {` gains `if (startTime === 0) startTime = now;` as first line
- `startAnimation()`: `startTime = performance.now();` → `startTime = 0;` (also re-syncs replay)

Effect: timeline is relative to first painted frame. A stalled load pauses the entrance instead of skipping it. RM path and `enabled === false` path do not use `startTime` — untouched.

## Audit table (item 2) — every `var` in the splash IIFE vs function declarations

| Binding | Kind | Verdict |
|---|---|---|
| FIELD, TICKS, NUMS, NOW_TICK, NOW_DOT, SWEEP, LOGO | var, DOM refs | safe — no function of same name |
| tickFrag / tickEl (renamed) | var | safe — `tick` function no longer shadowed |
| TICK_NODES | var | safe |
| easeOut | var function expr | safe — no competing declaration |
| startTime, animCompleteSent, warmStart | var state | safe |
| tick, sequenceFull, sequenceWarm, handleRM, startAnimation, init, sendComplete | function declarations | safe after Fix 1 — no `var` shares these names |
| tFrac/nFrac/wFrac/sFrac/lFrac, tickStart, local, e, nE, wE, sE, lE, i, j, elapsed, now | function-scoped locals | safe — inner scope, no outer collision |

## Verification evidence (item 7, all executed)

Headless Chromium, 520x320 viewport, fixed `public/splash.html`:

- `PAGEERRORS: []` on every run (pre-fix: rAF TypeError on load).
- T+2100ms: ticks `1`, numbers `1`, NOW marker `0.927749` (mid-fade), sweep/logo pending — staggered entrance playing frame by frame.
- T+3300ms: ticks `1`, numbers `1`, marker `1`, sweep `scaleX(1)`, logo `1` — full end-state.
- Harness note: headless delivers the first frame ~1.4s after parse (render-blocking webfont + background throttling), which is exactly why Fix 2 exists. On a real visible window with warm font cache the timeline runs from t≈0.
- `node scripts/build.mjs` exit 0; `dist/splash.html` ships the fix (vite copies `public/`); `dist-electron/preload.cjs` 121K; black-screen checklist holds (dist/index.html #root + module script + #df-fallback verified in prior cycle build).

## Startup path table (item 9)

| Path | Expected | Status |
|---|---|---|
| Cold start, normal | full 1500ms sequence → `sendComplete` → close | fixed + headless-verified |
| Slow webfont load | entrance waits for first frame, then plays fully | fixed by Fix 2 |
| Warm start (`warmStart: true`) | 600ms short sequence | logic untouched, same loop |
| `prefers-reduced-motion` | static frame + close after 140ms | untouched (`handleRM`) |
| `enabled === false` | plain body, no animation | untouched (`init` early return) |
| User skip after 400ms | keydown/mousedown → close | unchanged (handlers are no-ops — Follow-up B) |
| Main-window `did-finish-load` race | gated on `!splashClosed` (uncommitted Hands edit, kept) | unchanged |
| Splash load failure/crash | `closeSplash` via did-fail-load/crashed | unchanged |

## Follow-ups for Architect (explicitly NOT in this fix)

- A. Preload wiring: splash window uses full main `preload.cjs`; dedicated `src/preload/splashPreload.ts` builds but is unused. Pick one.
- B. Skip handlers `BrowserWindow.on('keydown')` / `webContents.on('mouse-down')` are non-existent events (dead code). If skip matters, implement renderer-side or `before-input-event`.
- C. `splash-complete`/`replay-splash` find the window by width+title scan. Prefer the captured reference.
- D. `src/splash.html` vs `public/splash.html` duplication — pick a single source of truth.

## Hands runtime check (still required — headless is not Electron)

Launch the app, confirm the 520x320 splash plays ticks→numbers→sweep→logo and closes by ~1400ms, main window content renders (NOT black). If the splash still misbehaves in Electron specifically, the cause is outside this page (window config/preload) — this page is proven correct standalone.
