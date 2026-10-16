# CONTEXT_BUNDLE — Halo Island Window Architecture

**Generated:** 2026-10-12
**Repo:** `/home/clementzhao/dev/rheo` (Electron 41.10.7 + React + Vite + TypeScript)
**Target AI has NO access to this codebase. Everything needed is in this file.**

---

## 1. The raw user request (verbatim, do not rephrase)

> i dont want the seperate window and evne with the speerate iwndow thing, ti doesnt owrk, when previously it works without any seperate window

---

## 2. VERIFIED ENVIRONMENT (measured, not assumed)

```bash
$ echo $XDG_SESSION_TYPE $XDG_CURRENT_DESKTOP
wayland KDE

$ pgrep -af electron | head -1
node /home/clementzhao/dev/rheo/node_modules/.bin/electron --ozone-platform=x11 --user-data-dir=/home/...

$ wayland-info | grep layer_shell
interface: 'zwlr_layer_shell_v1',  version: 5, name: 64
```

| Fact | Value | Source |
|---|---|---|
| Desktop session | **native Wayland** | `XDG_SESSION_TYPE=wayland` |
| Compositor | **KDE Plasma** | `XDG_CURRENT_DESKTOP=KDE` |
| Electron backend | **XWayland** (`--ozone-platform=x11`) | process argv |
| Layer-shell protocol | **available, v5** | `wayland-info` |
| Where the flag is forced | `start-dev.sh:368` | see §4.3 |

**This is the central architectural fact.** The desktop is native Wayland; the app is an XWayland
client. Any "always on top" request from the app is an **X11 advisory hint**
(`_NET_WM_STATE_ABOVE`) to KWin, not a real compositor layer. KWin arbitrates between that hint
and genuine native Wayland surfaces, and **a native window that takes focus wins**. Firefox,
VS Code, WebStorm and JetBrains IDEs are native Wayland clients.

---

## 3. GOVERNING SPEC

`agent/docs/HALO_ISLAND.md` — 4,195 lines, 226 numbered sections.
`agent/docs/halo_cross_platform_agent_spec_compact(1).md` is **byte-identical** (md5
`135e2c74b283ceb7a835359b319debf2`). Use `HALO_ISLAND.md`.

Visual states: `agent/docs/halo/HALO_STATES.html` (5 boards).
Settings reference: `agent/docs/HALO_SETTINGS.html`.

### 3.1 §8 ELECTRON WINDOW — the spec mandates a separate window

```
# 8. ELECTRON WINDOW
Recommended baseline:
const win = new BrowserWindow({
  width: canvasWidth, height: canvasHeight, x: initialX, y: initialY,
  frame: false, transparent: true, backgroundColor: "#00000000",
  resizable: false, movable: false, minimizable: false, maximizable: false,
  fullscreenable: false, hasShadow: false, skipTaskbar: true, show: false,
  focusable: false,
  webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true }
});
```

### 3.2 §181 — no full-screen transparent canvas

```
# 181. NO FULL-SCREEN TRANSPARENT CANVAS
Forbidden default:
  1920×1080 transparent BrowserWindow
Prefer the smallest canvas that safely contains the expanded island.
Large transparent surfaces waste compositor resources and complicate hit testing.
```

### 3.3 §12 / §13 — click-through is the spec's requirement

```
# 12. TRANSPARENT WINDOW + CSS HIT TESTING
# 13. CLICK-THROUGH INTERACTION
```

The intent: collapsed, the island must NOT intercept desktop clicks.

### 3.4 §14 — must never steal focus

```
# 14. FOCUS RULES
Showing the island must not steal focus.
Prefer: win.showInactive();
Forbidden: win.focus();
The user may be typing in: VS Code, terminal, browser, IDE, game, editor
```

---

## 4. CURRENT IMPLEMENTATION — actual source

### 4.1 Window creation — `src/main/halo/haloIsland.ts:745-800`

```ts
const win = new BrowserWindow({
  width: canvasW,
  height: canvasH,
  frame: false,
  transparent: true,
  backgroundColor: '#00000000',
  resizable: false,
  movable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  hasShadow: false,
  skipTaskbar: true,
  show: false,
  focusable: true,          // <-- CHANGED from spec's `false`. See §6.1.
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
});

applyAlwaysOnTop(win);                                   // line 744
win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });  // line 747
```

Window size at Small preset: **480 × 118** (from `halo-diagnostic.log`).
Collapsed pill: **182 × 28**. So ~298 × 90 of that window is transparent canvas.

### 4.2 Click-through — `src/main/halo/haloIsland.ts:358-420`

```ts
// line 358
function setClickThrough(win: BrowserWindow, collapsed: boolean): void {
  try {
    win.setIgnoreMouseEvents(collapsed, collapsed ? { forward: true } : undefined);
  } catch { /* ... */ }
}

// line 407
function applyClickRegion(h: HaloHandle, prefs: HaloPrefs): void {
  const win = h.window;
  if (win.isDestroyed()) return;

  if (!h.expanded) {
    // Collapsed: no click region at all. Reset the shape.
    setClickThrough(win, true);
    try {
      win.setShape([]);          // <-- empty shape
    } catch {
      /* platform has no window shapes; pass-through already covers this phase */
    }
    return;
  }

  setClickThrough(win, false);
  // ... then setShape() to the painted surface rect
}
```

**Called from exactly two places:** line 413 (collapse path) and line 422 (expand path).
Plus `applyClickRegion` is called after every `setBounds` move.

### 4.3 The X11 flag is forced — `start-dev.sh:366-369`

```bash
ELECTRON_ARGS_ARR=()
if ! $IS_WIN && [ "${ELECTRON_OZONE_PLATFORM:-}" != "wayland" ]; then
  ELECTRON_ARGS_ARR+=(--ozone-platform=x11)
fi
```

**So the app is XWayland on a native Wayland desktop unless the operator explicitly sets
`ELECTRON_OZONE_PLATFORM=wayland`.**

### 4.4 The island renderer entry — `src/halo.tsx` + `halo.html`

A separate Vite entry (`vite.config.ts` `input: { index: 'index.html', halo: 'halo.html' }`).
Mounts only `<OverlayRoot />`. Themed independently via a `storage` event on `df-theme`.

### 4.5 Geometry — `src/shared/halo/geometry.ts:355-386`

```ts
const safeW = Math.max(160, bounds.width - 24);
const safeH = Math.max(120, bounds.height - 24);
const preset = input.size ?? HALO_SIZE_PRESETS.medium;

// CANVAS = the expanded panel of the current preset
const canvasWidth  = Math.min(preset.expandedWidth,  safeW);
const canvasHeight = Math.min(preset.expandedHeight, safeH);
```

Presets (`src/shared/halo/sizes.ts`):

| preset | expanded | compact | fBody | typeScale |
|---|---|---|---|---|
| small | 480×118 | 182×28 | 11 | 0.85 |
| medium | 560×134 | 198×32 | 12 | 1.0 |
| large | 680×154 | 227×40 | 14 | 1.2 |

---

## 5. WHAT WAS ALREADY ATTEMPTED (do not repeat blindly)

| Attempt | Outcome |
|---|---|
| `'pop-up-menu'` always-on-top level on Linux | Island disappeared behind native Wayland apps. Replaced with `'screen-saver'`. |
| `applyAlwaysOnTop` called once, in the constructor | Stacking is applied at map time, so a pre-show request attaches to nothing. Now re-asserted after `showInactive()` and on every `reconcileHaloGeometry`. |
| `focusable: false` (per spec §8) | KWin does not reliably raise a non-focusable XWayland window above a focused native client. Changed to `true`. |
| `clickShield: 'canvas'` pref | Was returning early and making the whole 520×300 canvas one click region. Now neutered. |
| `expandedHeight: 0 \|\| MAX_CANVAS_HEIGHT` | `0 \|\| X` silently substituted the canvas for the content height, so the click region became the entire window. Removed. |

**These are all stacking/hit-test mitigations inside the separate-window architecture.
None of them removes the window.** That is the user's actual complaint.

---

## 6. THE THREE OPEN QUESTIONS

### 6.1 If the separate window is kept — why do clicks still get eaten?

The collapsed path looks correct: `setIgnoreMouseEvents(true, {forward:true})` plus
`setShape([])`. Candidates:

- **A.** `setShape([])` — an **empty** shape array may mean "no shape constraint = full
  rectangle" on some X11 backends rather than "click through everything".
- **B.** `setIgnoreMouseEvents(..., {forward: true})` may not behave as expected under
  XWayland for **click** events (it is documented to forward *move* events).
- **C.** `focusable: true` (introduced this cycle) may make the window eligible for
  activation in a way that interferes with pass-through.

`halo-diagnostic.log` proves `applyClickRegion` runs constantly
(`click-region-shaped`, 480×118, `pinned: false`), so the region *is* being applied —
the question is whether that region is correct.

### 6.2 XWayland cannot guarantee a layer

A true always-on-top desktop overlay needs `zwlr_layer_shell_v1`, which this compositor
advertises (v5) — but **Electron exposes no API for it.** Options the target AI should weigh:

- run the app as a **native Wayland client** (`--ozone-platform=wayland`);
- move the island into a small **GTK4 / layer-shell helper** process;
- keep Electron and accept the hint is advisory.

### 6.3 The user wants no separate window at all

**Git evidence: the island has ALWAYS been a separate window.** The first commit touching
`src/features/halo` (`ee97f6d`) already contains 21 halo files including `halo.html`.
There is no in-app island implementation in history to restore.

So "it worked before without a separate window" most likely means: **before the island
existed, the app did not have a window in the way.** There is no prior in-app version.

If the user genuinely wants an in-app island, that is a **different product** — one that
cannot hover over other applications, which is the feature's entire purpose. This tension
needs to be surfaced explicitly, not silently resolved.

---

## 7. RELATED BUG FOUND WHILE GATHERING THIS

`~/.config/RHEO/halo-diagnostic.log` is **63 MB** and contains **604,001** lines of the
identical event:

```json
{"event":"click-region-shaped","w":480,"h":118,"pinned":false,"surfaceH":118}
```

Logged roughly every 110 ms. This is a state-transition log being written on every
*evaluation*. It should log on change only. It also means `applyClickRegion` is being
re-applied far more often than necessary — worth checking whether some caller is driving
it from a timer, because that same caller may be the thing calling `setShape` while the
user is clicking.

---

## 8. FILES THAT MATTER

| File | Lines | Role |
|---|---|---|
| `src/main/halo/haloIsland.ts` | 1392 | Window lifecycle, geometry, click region, hover poll |
| `src/shared/halo/geometry.ts` | 504 | `computeGeometry`, hot zones, surface rects |
| `src/shared/halo/sizes.ts` | ~250 | S/M/L presets, `fitToCanvas`, responsive clamp |
| `src/shared/halo/hoverMachine.ts` | 155 | Pure FSM: cursor sample → open/close intent |
| `src/features/halo/OverlayRoot.tsx` | ~1790 | Renderer root, all 5 boards, `showPill` |
| `src/features/halo/CompactPill.tsx` | ~330 | All 10 board-1 compact kinds |
| `src/features/halo/halo.css` | 787 | Tokens, `--halo-scale`, reduced-motion |
| `src/halo.tsx` | 60 | Separate renderer entry |
| `halo.html` | — | Separate document |
| `start-dev.sh` | 368 | Forces `--ozone-platform=x11` |

### Existing probes (all currently green — 246 assertions)

`agent/probes/halo-fit.probe.mts`, `halo-board-coverage.probe.mts`,
`halo-core.probe.mts`, `halo-slot.probe.mts`, `halo-spec-fundamentals.probe.mts`,
`halo-renderer-placement.probe.mts`, `halo-click-region-growth.probe.mts`

**These are the correct place to add regression coverage for any fix.**