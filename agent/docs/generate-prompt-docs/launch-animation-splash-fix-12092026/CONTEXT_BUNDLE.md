# CONTEXT BUNDLE — Launch (boot splash) animation renders as black rectangle, no sequence plays

Task: fix the RHEO app opening animation (R-10 Boot Splash — Meridian Wake).
Symptom (user-verbatim): "the app opening animation doesnt work at fucking all. it only shows the black rectangle and nothing else".

Pipeline role: this bundle is the codebase reference for the Architect. Hands (opencode/Hermes) implements the FIX PACKET after.

Date: 2026-09-12. Folder: agent/docs/generate-prompt-docs/launch-animation-splash-fix-12092026/

---

## 1. Runtime evidence (root-cause pointer, verified by execution)

Loaded the shipped splash file in headless Chromium (Playwright) at 520x320 viewport, waited 1600ms (full 1500ms sequence):

- PAGEERROR: `Failed to execute 'requestAnimationFrame' on 'Window': parameter 1 is not of type 'Function'.`
- After 1600ms: 24 ticks in DOM, but `logo.style.opacity === ""`, `sweep.style.transform === ""`, first tick `style.opacity === ""` — NO animation frame ever ran.

Cause (in public/splash.html AND src/splash.html, identical files): the tick-builder loop declares `var tick`, which hoists across the whole IIFE scope and OVERWRITES the `function tick(now)` animation-loop declaration. By the time `startAnimation()` runs `requestAnimationFrame(tick)`, the name `tick` refers to the last created DIV element, not the function. The rAF call throws, the loop never starts, every element keeps its CSS initial state (`opacity: 0`) — so the window is a pure black rectangle. The recursive `requestAnimationFrame(tick)` inside `tick()` would throw the same way.

Colliding lines (public/splash.html, lines 189-199 and 214-224):

```js
  // ── Build 24 ruler ticks ──
  var tickFrag = document.createDocumentFragment();
  for (var i = 0; i < 24; i++) {
    var tick = document.createElement('div');   // <-- HOISTED: overwrites function tick below
    tick.className = 'splash-tick';
    tick.style.top = (40 + i * 10) + 'px';
    tickFrag.appendChild(tick);
  }
```

```js
  // ── Animation loop ──
  function tick(now) {                          // <-- DEAD binding: shadowed by `var tick` above
    var elapsed = now - startTime;
    ...
    sequenceFull(now, elapsed);
    if (elapsed < 1500) requestAnimationFrame(tick);
  }
```

```js
  function startAnimation() {
    startTime = performance.now();
    animCompleteSent = false;
    if (rmMatch.matches) { handleRM(); return; }
    requestAnimationFrame(tick);                // <-- THROWS: tick is a DIV here
  }
```

Fix direction: rename the loop variable (e.g. `tickEl`). One-line-class fix, but verify no other `var`-vs-function collisions in the same IIFE scope (`tickFrag`, `tickStart` are distinct names — safe).

Other defect candidates found during tracing (secondary — fix or explicitly rule out):
- (a) `src/preload/splashPreload.ts` was briefly deleted during a prior session and has been RESTORED (9-line file, see §6). `scripts/build.mjs` step 2b builds it to `dist-electron/splashPreload.cjs`, but the splash BrowserWindow currently uses the FULL main preload (`dist-electron/preload.cjs`), so `splashPreload.cjs` output is unused. Decide: point the splash window at the dedicated preload (original R-10 design) or delete the dead file + build step. Do NOT leave both wired ambiguously.
- (b) `splashWindow.on('keydown', ...)` in main.ts is a non-existent BrowserWindow event (key input arrives via `webContents` `before-input-event`). `webContents.on('mouse-down', ...)` is likewise not a real event. Click/keypress-to-skip currently does nothing. If skip behavior is required, implement renderer-side (splash.html click/keydown → `sendComplete()` after the 400ms gate) or `before-input-event`.
- (c) `splash-complete` / `replay-splash` handlers locate the splash by `getSize()[0] === 520 && getTitle() === 'RHEO'` across ALL windows — fragile. Prefer closing via the captured `splashWindow` reference / `splashClosed` flag already in `createWindow()`.
- (d) `did-finish-load` on the main window races the 1250ms animation in dev mode (Vite serves instantly). Current uncommitted code gates it on `!splashClosed` (see §3).

---

## 2. Splash page source — public/splash.html (FULL FILE, 357 lines)

This is the file that ships: vite copies `public/` → `dist/`, so `dist/splash.html` IS this file. `src/splash.html` is a byte-identical reference copy — keep both in sync or remove one (do not let them drift).

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>RHEO</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
  /* ===== R-10 Boot Splash — Meridian Wake (Concept A) ===== */
  /* Single LAMINAR easing, transform/opacity ONLY, one-shot, no loop */

  :root {
    --splash-field: #09090b;
    --splash-hairline: rgba(255,255,255,0.08);
    --splash-mono: rgba(255,255,255,0.50);
    --splash-caption: rgba(255,255,255,0.35);
    --splash-now-tick: #ec4899;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: 100%; height: 100%;
    overflow: hidden;
    background: var(--splash-field);
    color: rgba(255,255,255,0.85);
    font-family: 'Inter', sans-serif;
  }

  /* Full-screen field */
  .splash-field {
    position: fixed;
    inset: 0;
    background: var(--splash-field);
  }

  /* Ticks container — fixed height so children have room */
  #ticks {
    position: absolute;
    left: 0; top: 0;
    width: 100%; height: 100%;
  }

  .splash-tick {
    position: absolute;
    left: 28px;
    width: 2px;
    height: 8px;
    background: var(--splash-hairline);
    transform-origin: center;
    opacity: 0;
    transform: translateY(6px);
    will-change: transform, opacity;
  }

  .splash-num {
    position: absolute;
    left: 40px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--splash-mono);
    letter-spacing: -0.02em;
    opacity: 0;
    transform: translateY(50%);
    will-change: transform, opacity;
  }

  .splash-now {
    position: absolute;
    left: 28px;
    width: 2px;
    height: 8px;
    background: var(--splash-now-tick);
    opacity: 0;
    transform-origin: center;
    will-change: opacity;
  }

  .splash-now-dot {
    position: absolute;
    width: 4px; height: 4px;
    border-radius: 50%;
    background: var(--splash-now-tick);
    opacity: 0;
    box-shadow: 0 0 8px rgba(236,72,153,0.08);
    will-change: opacity;
  }

  .splash-sweep {
    position: absolute;
    left: 28px;
    top: 50%;
    width: 464px;
    height: 1px;
    background: var(--splash-hairline);
    transform-origin: left center;
    transform: scaleX(0);
    will-change: transform;
  }

  .splash-logo {
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    will-change: opacity, transform;
  }

  .splash-wordmark {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #fafafa;
    line-height: 1;
    white-space: nowrap;
  }

  .splash-caption {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--splash-caption);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .splash-tick, .splash-num, .splash-now, .splash-now-dot,
    .splash-sweep, .splash-logo {
      opacity: 1;
      transform: none;
      animation: none !important;
    }
    .splash-sweep { transform: scaleX(1); }
    .splash-logo { transform: translate(-50%, -50%) scale(1); }
    .splash-tick { opacity: var(--splash-mono); }
    .splash-num { opacity: var(--splash-mono); }
    body { animation: splash-rm-fade 140ms ease-out forwards; }
  }
  @keyframes splash-rm-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
</head>
<body>
<div class="splash-field" aria-hidden="true"></div>
<div id="ticks" aria-hidden="true"></div>

<div class="splash-num" id="num-00" style="top:40px">00</div>
<div class="splash-num" id="num-06" style="top:100px">06</div>
<div class="splash-num" id="num-12" style="top:160px">12</div>
<div class="splash-num" id="num-18" style="top:220px">18</div>
<div class="splash-num" id="num-24" style="top:280px">24</div>

<div class="splash-now" id="now-tick" style="top:160px"></div>
<div class="splash-now-dot" id="now-dot" style="top:158px;left:27px"></div>

<div class="splash-sweep" id="sweep" aria-hidden="true"></div>

<div class="splash-logo" id="logo" aria-hidden="true">
  <span class="splash-wordmark">RHEO</span>
  <span class="splash-caption">Productivity Tracker</span>
</div>

<script>
(function () {
  'use strict';

  // ── DOM refs ──
  var FIELD = document.querySelector('.splash-field');
  var TICKS = document.getElementById('ticks');
  var NUMS  = ['num-00','num-06','num-12','num-18','num-24'].map(function (id) {
    return document.getElementById(id);
  });
  var NOW_TICK = document.getElementById('now-tick');
  var NOW_DOT  = document.getElementById('now-dot');
  var SWEEP    = document.getElementById('sweep');
  var LOGO     = document.getElementById('logo');

  // ── Build 24 ruler ticks ──
  var tickFrag = document.createDocumentFragment();
  for (var i = 0; i < 24; i++) {
    var tick = document.createElement('div');
    tick.className = 'splash-tick';
    tick.style.top = (40 + i * 10) + 'px';
    tickFrag.appendChild(tick);
  }
  TICKS.appendChild(tickFrag);
  var TICK_NODES = Array.prototype.slice.call(TICKS.querySelectorAll('.splash-tick'));

  // ── Easing + state ──
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var startTime = performance.now();
  var animCompleteSent = false;
  var warmStart = false;

  function sendComplete() {
    if (animCompleteSent) return;
    animCompleteSent = true;
    if (window.splashAPI && window.splashAPI.sendComplete) {
      window.splashAPI.sendComplete();
    }
  }

  // ── Animation loop ──
  function tick(now) {
    var elapsed = now - startTime;
    if (warmStart) {
      sequenceWarm(now, elapsed);
      if (elapsed < 600) requestAnimationFrame(tick);
      return;
    }
    sequenceFull(now, elapsed);
    if (elapsed < 1500) requestAnimationFrame(tick);
  }

  function sequenceFull(now, elapsed) {
    if (elapsed < 500) {
      var tFrac = Math.min(elapsed / 500, 1);
      for (var i = 0; i < TICK_NODES.length; i++) {
        var tickStart = i * 12;
        var local = Math.max(0, tFrac * 500 - tickStart);
        var e = easeOut(Math.min(local / 80, 1));
        TICK_NODES[i].style.opacity = e;
        TICK_NODES[i].style.transform = 'translateY(' + (6 * (1 - e)) + 'px)';
      }
    }
    if (elapsed >= 350 && elapsed < 700) {
      var nFrac = Math.min((elapsed - 350) / 350, 1);
      var nE = easeOut(nFrac);
      for (var j = 0; j < NUMS.length; j++) {
        NUMS[j].style.opacity = nE;
        NUMS[j].style.transform = 'translateY(' + (50 * (1 - nE)) + '%)';
      }
    }
    if (elapsed >= 700 && elapsed < 900) {
      var wFrac = Math.min((elapsed - 700) / 200, 1);
      var wE = easeOut(wFrac);
      NOW_TICK.style.opacity = wE;
      NOW_DOT.style.opacity = wE;
    } else if (elapsed >= 900) {
      NOW_TICK.style.opacity = '1';
      NOW_DOT.style.opacity = '1';
    }
    if (elapsed >= 850 && elapsed < 1250) {
      var sFrac = Math.min((elapsed - 850) / 400, 1);
      var sE = easeOut(sFrac);
      SWEEP.style.transform = 'scaleX(' + sE + ')';
    } else if (elapsed >= 1250) {
      SWEEP.style.transform = 'scaleX(1)';
    }
    if (elapsed >= 850 && elapsed < 1250) {
      var lFrac = Math.min((elapsed - 850) / 400, 1);
      var lE = easeOut(lFrac);
      LOGO.style.opacity = lE;
      LOGO.style.transform = 'translate(-50%,-50%) scale(' + (0.9 + 0.1 * lE) + ')';
    } else if (elapsed >= 1250) {
      LOGO.style.opacity = '1';
      LOGO.style.transform = 'translate(-50%,-50%) scale(1)';
      sendComplete();
    }
  }

  function sequenceWarm(now, elapsed) {
    if (elapsed < 400) {
      var tFrac = Math.min(elapsed / 400, 1);
      for (var i = 0; i < TICK_NODES.length; i++) {
        var tickStart = i * 12;
        var local = Math.max(0, tFrac * 400 - tickStart);
        var e = easeOut(Math.min(local / 80, 1));
        TICK_NODES[i].style.opacity = e;
        TICK_NODES[i].style.transform = 'translateY(' + (6 * (1 - e)) + 'px)';
      }
    }
    if (elapsed >= 350 && elapsed < 600) {
      var lFrac = Math.min((elapsed - 350) / 250, 1);
      var lE = easeOut(lFrac);
      LOGO.style.opacity = lE;
      LOGO.style.transform = 'translate(-50%,-50%) scale(' + (0.9 + 0.1 * lE) + ')';
    } else if (elapsed >= 600) {
      LOGO.style.opacity = '1';
      LOGO.style.transform = 'translate(-50%,-50%) scale(1)';
    }
  }

  // ── Reduced motion ──
  var rmMatch = window.matchMedia('(prefers-reduced-motion: reduce)');
  function handleRM() {
    FIELD.style.opacity = '0';
    FIELD.style.animation = 'splash-rm-fade 140ms ease-out forwards';
    for (var i = 0; i < TICK_NODES.length; i++) {
      TICK_NODES[i].style.opacity = '0.5';
      TICK_NODES[i].style.transform = 'none';
    }
    for (var j = 0; j < NUMS.length; j++) {
      NUMS[j].style.opacity = '0.5';
      NUMS[j].style.transform = 'none';
    }
    NOW_TICK.style.opacity = '1';
    NOW_DOT.style.opacity = '1';
    SWEEP.style.transform = 'scaleX(1)';
    LOGO.style.opacity = '1';
    LOGO.style.transform = 'translate(-50%,-50%) scale(1)';
    setTimeout(function () {
      if (window.splashAPI && window.splashAPI.sendComplete) {
        window.splashAPI.sendComplete();
      }
    }, 140);
  }

  // ── Replay handler ──
  function startAnimation() {
    startTime = performance.now();
    animCompleteSent = false;
    if (rmMatch.matches) { handleRM(); return; }
    requestAnimationFrame(tick);
  }

  // ── Config load (async — getBootAnimationConfig returns a Promise) ──
  function init() {
    if (window.splashAPI && window.splashAPI.getBootAnimationConfig) {
      window.splashAPI.getBootAnimationConfig().then(function (cfg) {
        if (cfg && typeof cfg === 'object') {
          if (cfg.enabled === false) { document.body.style.opacity = '1'; return; }
          warmStart = !!cfg.warmStart;
        }
        startAnimation();
      }).catch(function () {
        startAnimation();
      });
    } else {
      startAnimation();
    }
  }

  // ── Replay via splash preload IPC channel (ruling 3 — full IPC chain) ──
  if (window.splashAPI && window.splashAPI.onReplay) {
    window.splashAPI.onReplay(function () {
      startAnimation();
    });
  }

  // ── Boot ──
  init();
})();
</script>
</body>
</html>
```

Animation timeline (intended): 0-500ms ticks stagger in; 350-700ms numbers fade; 700-900ms NOW tick/dot; 850-1250ms sweep scaleX + logo scale 0.9→1; at ≥1250ms `sendComplete()` fires. rAF loop runs to 1500ms. Warm-start variant: 600ms short sequence.

---

## 3. Main-process splash wiring — src/main.ts (UNCOMMITTED EDITS IN FLIGHT, current state)

### 3a. Splash block in createWindow() (lines ~5212-5279)

```ts
    // ── R-10 Boot Splash ──────────────────────────────────────────────
    // Open splash BEFORE main window, per spec. Splash is a frameless 520×320
    // overlay that closes on the MAIN window's did-finish-load signal.
    let splashWindow = null;
    try {
        const prefService = require('./services/prefService');
        const splashCfg = prefService.getBootAnimation();
        if (splashCfg?.enabled && splashCfg.variant === 'meridian') {
            let splashClosed = false;
            // Track when splash opened so we can gate dismiss/timeout on animation progress.
            const splashStartTime = performance.now();

            const closeSplash = () => {
                if (splashClosed) return;
                splashClosed = true;
                if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
            };
            splashWindow = new electron_1.BrowserWindow({
                width: 520,
                height: 320,
                x: Math.round((electron_1.screen.getPrimaryDisplay().workArea.width - 520) / 2),
                y: Math.round((electron_1.screen.getPrimaryDisplay().workArea.height - 320) / 2),
                frame: false,
                resizable: false,
                skipTaskbar: true,
                transparent: true,
                backgroundColor: '#09090b',
                hasShadow: false,
                webPreferences: {
                    preload: preloadPath,          // NOTE: full main preload, NOT splashPreload.cjs (see §1a)
                    contextIsolation: true,
                    nodeIntegration: false,
                    webSecurity: true,
                },
            });
            splashWindow.setIgnoreMouseEvents(false);
            splashWindow.on('ready-to-show', () => {
                if (!splashWindow || splashWindow.isDestroyed()) return;
                splashWindow.show();
            });
            const splashHtmlPath = path_1.default.join(__dirname, '../dist/splash.html');
            if (require('fs').existsSync(splashHtmlPath)) {
                splashWindow.loadFile(splashHtmlPath);
            } else {
                splashWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL || 'http://localhost:38123'}/splash.html`);
            }
            splashWindow.on('closed', () => { splashWindow = null; });
            splashWindow.webContents.on('did-fail-load', closeSplash);
            splashWindow.webContents.on('crashed', closeSplash);
            splashWindow.on('blur', () => { /* keep visible */ });
            splashWindow.on('keydown', () => {                                     // NOTE: not a real BW event (see §1b)
                if (performance.now() - splashStartTime >= 400) closeSplash();
            });
            splashWindow.webContents.on('mouse-down', () => {                     // NOTE: not a real WC event (see §1b)
                if (performance.now() - splashStartTime >= 400) closeSplash();
            });
            setTimeout(closeSplash, 4000); // hard cap
            setTimeout(() => { if (!splashClosed) closeSplash(); }, 1400); // min display — full anim completes at 1250ms
            console.log('[DeskFlow] ✅ Splash window opened (Meridian wake)');
        }
    } catch (e) {
        console.error('[DeskFlow] Splash init error:', e?.message || e);
    }
    // ── End splash block ───────────────────────────────────────────────
```

### 3b. Main-window did-finish-load (lines ~5390, UNCOMMITTED: gated on !splashClosed)

```ts
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[DeskFlow] Page loaded successfully');
        // R-10: close splash on main window ready signal — only if splash is still
        // playing (animation hasn't completed via sendComplete yet).
        if (splashWindow && !splashWindow.isDestroyed() && !splashClosed) {
            closeSplash();
        }
    });
```

### 3c. IPC handlers (lines ~6802-6839, committed)

```ts
// R-10: single preference getter
electron_1.ipcMain.handle('get-preference', (_event, key) => {
    return userPreferences[key];
});
// R-10: boot animation config — preference store single source (ruling 2)
electron_1.ipcMain.handle('boot-animation-config', () => {
    try {
        const raw = userPreferences['boot_animation'];
        if (raw && typeof raw === 'object') {
            return {
                enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
                variant: 'meridian',
                warmStart: typeof raw.warmStart === 'boolean' ? raw.warmStart : false,
            };
        }
    } catch { /* fallback */ }
    return { enabled: true, variant: 'meridian', warmStart: false };
});
// R-10: replay trigger — fires the sequence in the splash renderer
electron_1.ipcMain.on('replay-splash', () => {
    const all = electron_1.BrowserWindow.getAllWindows();
    for (const w of all) {
        if (w.isVisible() && w.getSize()[0] === 520 && w.getTitle() === 'RHEO') {   // NOTE fragile (see §1c)
            w.webContents.send('replay-splash');
            break;
        }
    }
});
// R-10: splash sequence complete — renderer calls this when anim finishes
electron_1.ipcMain.handle('splash-complete', () => {
    const all = electron_1.BrowserWindow.getAllWindows();
    for (const w of all) {
        if (w.isVisible() && w.getSize()[0] === 520 && w.getTitle() === 'RHEO') {   // NOTE fragile (see §1c)
            w.close();
            break;
        }
    }
});
```

---

## 4. Config source — src/services/prefService.ts (FULL FILE, safe without init)

```ts
// R-10 · Boot animation config — reads from userPreferences directly
// (main process can't use preload's deskflowAPI — contextBridge doesn't exist there)

export interface BootAnimationConfig {
  enabled: boolean;
  variant: 'meridian';
  warmStart: boolean;
}

export const DEFAULT_BOOT_ANIMATION: BootAnimationConfig = {
  enabled: true,
  variant: 'meridian',
  warmStart: false,
};

const STORAGE_KEY = 'boot_animation';

function parseConfig(raw: unknown): BootAnimationConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_BOOT_ANIMATION;
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_BOOT_ANIMATION.enabled,
    variant: 'meridian' as const,
    warmStart: typeof r.warmStart === 'boolean' ? r.warmStart : DEFAULT_BOOT_ANIMATION.warmStart,
  };
}

// userPreferences is set by main.ts before createWindow() is called
let _prefs: Record<string, unknown> = {};

export function initPrefService(prefs: Record<string, unknown>) {
  _prefs = prefs;
}

export function getBootAnimation(): BootAnimationConfig {
  try {
    const raw = _prefs[STORAGE_KEY];
    if (raw !== undefined && raw !== null) {
      return parseConfig(raw);
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_BOOT_ANIMATION;
}

export function setBootAnimation(cfg: BootAnimationConfig): boolean {
  try {
    _prefs[STORAGE_KEY] = cfg;
    return true;
  } catch {
    return false;
  }
}
```

Note: splash gate is NOT the problem — defaults are enabled/meridian even with no stored pref.

---

## 5. Preload bridge — src/preload.ts (lines 1770-1778, committed) + build (scripts/build.mjs lines 81-93)

```ts
// R-10: Splash renderer preload bridge (single IPC channel for splash↔main)
contextBridge.exposeInMainWorld('splashAPI', {
  getBootAnimationConfig: () => ipcRenderer.invoke('boot-animation-config'),
  onReplay: (cb) => ipcRenderer.on('replay-splash', () => cb()),
  sendComplete: () => ipcRenderer.invoke('splash-complete'),
});

// R-10: Single preference getter (needed by SettingsPage mount-load)
ipcRenderer.invoke('get-preference');
```

Build note: `scripts/build.mjs` step 2b compiles `src/preload/splashPreload.ts` → `dist-electron/splashPreload.cjs`, but `createWindow()` wires the splash window to the full main `preload.cjs`. The dedicated file and the wiring disagree — resolve one way (dedicated preload is the R-10 design; it is smaller and cannot be broken by app-preload changes).

---

## 6. Dedicated splash preload — src/preload/splashPreload.ts (FULL FILE, restored 2026-09-12)

```ts
// R-10 · Splash renderer preload — single IPC channel for splash↔main
// Exposes: getBootAnimationConfig(), onReplay(cb), sendComplete()
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashAPI', {
  getBootAnimationConfig: () => ipcRenderer.invoke('boot-animation-config'),
  onReplay: (cb) => ipcRenderer.on('replay-splash', () => cb()),
  sendComplete: () => ipcRenderer.invoke('splash-complete'),
});
```

---

## 7. Ship chain (how splash.html reaches the app)

`public/splash.html` --(vite copies public/ → dist/)--> `dist/splash.html` <--(loadFile, if exists)--> splash window.
`src/splash.html` is a byte-identical reference copy (verified with cmp on 2026-09-12). Keep both in sync or delete one.
Fallback if `dist/splash.html` missing: loads `${VITE_DEV_SERVER_URL || 'http://localhost:38123'}/splash.html`.
Build: `node scripts/build.mjs` (renderer → preload → services → main.cjs). Verified `node --check` passes on the extracted inline script (syntax is valid — the failure is runtime name shadowing, not syntax).

---

## 8. MUST NOT BREAK (hard invariants)

- Zero-destruction rule: no `git checkout --`, `git restore`, `git reset --hard`, `git clean`, wholesale tree copies. Backup single files with timestamped `.bak` copies before replacing.
- Main window must still verify per the black-screen checklist (dist/index.html has #root + module script + #df-fallback; dist-electron/preload.cjs > 1KB; main.cjs builds).
- Reduced-motion path (`handleRM` + CSS `@media (prefers-reduced-motion: reduce)`) must keep working: single static frame, `sendComplete` after 140ms.
- `enabled === false` path in `init()` (plain body, no animation) must keep working.
- Splash timing contract: logo/sendComplete at 1250ms, rAF loop ends 1500ms, min-display close 1400ms, hard cap 4000ms.
- LAMINAR constraint for the splash: transform/opacity ONLY, one-shot, no loop (Concept A).
