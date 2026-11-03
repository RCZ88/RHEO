# CONTEXT Response — Halo Hover-Open Fix (Round 7)

## CONTEXT 1: Offscreen renderer lifecycle

File: `src/main/halo/offscreenRenderer.ts`

### Complete start() method (lines 90-142)

```typescript
async start(): Promise<void> {
  if (this.win || this.disposed) return;

  const win = new BrowserWindow({
    show: false,
    width: 680,
    height: 154,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
      sandbox: true,
    },
  });

  this.win = win;

  win.webContents.setFrameRate(30);

  win.webContents.on('paint', (_event, _dirty, image) => {
    if (this.disposed) return;
    this.emit(image);
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[halo/offscreen] renderer gone:', details.reason);
    this.stop();
  });

  const devUrl = this.opts.devUrl ?? process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await win.loadURL(`${devUrl.replace(/\/$/, '')}/halo.html`);
  } else {
    const base = process.env.RHEO_SERVER_URL || 'http://localhost:38123';
    await win.loadURL(`${base}/halo.html`);
  }
}
```

### Key lifecycle points

1. `this.win = win` is set IMMEDIATELY after BrowserWindow construction (line 118), BEFORE loadURL completes.
2. `window()` method returns `this.win` if not destroyed — so it returns the window even before loadURL finishes.
3. There is NO `did-finish-load` handler. The renderer starts loading halo.html and the window is available immediately.
4. `extraTargets` in main.ts calls `offscreenRenderer?.window()` which returns the window as soon as `start()` sets `this.win`, regardless of load state.
5. There is a potential race: `extraTargets()` may return the window before the renderer has registered its `onHover` listener. The `halo:hover` IPC event would be sent to a webContents that hasn't set up its listener yet, and the event would be lost (IPC events are not buffered).

### Initialization sequence comparison

- `configureHalo()` creates the HaloHandle and starts polling
- `startPolling()` begins the interval that calls `readCursorPoint()` and `stepHover()`
- `pushHover()` sends `halo:hover` to targets including the offscreen window
- The offscreen window's renderer loads halo.html asynchronously
- If polling starts before the renderer finishes loading, hover events may be missed

### There is NO did-finish-load handler in offscreenRenderer.ts. The window is considered available immediately after construction.

---

## CONTEXT 2: OverlayRoot bridge selection

File: `src/features/halo/OverlayRoot.tsx` (line 135)

```typescript
const bridge = typeof window !== 'undefined' ? window.haloBridge : undefined;
```

The component uses `window.haloBridge` exclusively. It does NOT use `window.deskflowAPI`.

This is confirmed by the preload: the offscreen renderer gets `haloBridge` (not `deskflowAPI`) through `contextBridge.exposeInMainWorld('haloBridge', {...})`.

The `haloBridge.onHover` is the listener that receives `halo:hover` events from main.

---

## CONTEXT 3: Preload build configuration

### package.json build scripts

```json
"build": "node scripts/build-with-log.mjs",
"build:inner": "cross-env NODE_OPTIONS=--max-old-space-size=4096 node scripts/build.mjs",
```

### scripts/build.mjs preload compilation (line 159-162)

```javascript
const preloadOut = resolve(OUT, 'preload.cjs');
// ...
`npx esbuild "src/preload.ts" --outfile="${preloadOut}" --bundle --format=cjs --platform=node --target=node22 --external:electron`
```

### scripts/build-main-only.js (lines 36-37)

```javascript
entry: 'src/preload.ts',
fileName: () => 'preload.cjs',
```

### Confirmation: onHover is in the source

The `onHover` implementation exists in `src/preload.ts` (lines 2465-2470):

```typescript
onHover: (cb: (intent: { inside: boolean; pinned: boolean }) => void) => {
  const handler = (_event: unknown, intent: { inside: boolean; pinned: boolean }) =>
    cb({ inside: !!intent?.inside, pinned: !!intent?.pinned });
  ipcRenderer.on('halo:hover', handler);
  return () => ipcRenderer.removeListener('halo:hover', handler);
},
```

Since `build.mjs` bundles `src/preload.ts` into `dist-electron/preload.cjs` using esbuild, the `onHover` implementation IS included in the compiled artifact. The offscreen BrowserWindow loads `preload: join(__dirname, 'preload.cjs')` which resolves to `dist-electron/preload.cjs`.

### Verification needed

Run `grep -c "onHover" dist-electron/preload.cjs` to confirm the compiled artifact contains onHover. If it returns 0, the build is stale.

---

## CONTEXT 4: Initialization race analysis

### The race

1. `offscreenRenderer.start()` creates BrowserWindow → sets `this.win = win` → calls `loadURL()`
2. `extraTargets()` returns the window immediately (even before loadURL finishes)
3. Main process polling may send `halo:hover` before renderer's `useEffect` registers `bridge.onHover`
4. The event is lost (IPC events are not buffered for unregistered listeners)

### Mitigation: initial state pull

The OverlayRoot has a `getSnapshot` pull at mount (lines 740-760):

```typescript
useEffect(() => {
  if (!bridge?.getSnapshot) return;
  let cancelled = false;
  void Promise.resolve(bridge.getSnapshot())
    .then((raw: any) => {
      if (cancelled || snapshotPushed.current) return;
      if (!raw) return;
      setRemote({ stopwatch: ..., currentApp: ..., dictation: ... });
    })
    .catch(() => { /* no main process (browser preview): defaults remain */ });
  return () => { cancelled = true; };
}, []);
```

But this only pulls snapshot data (stopwatch, currentApp, dictation). It does NOT pull hover state. Hover state is push-only.

### The fix

To eliminate the race, one of:
1. Add a `halo:get-hover` IPC handler that returns current hover state, and have OverlayRoot pull it at mount
2. Have main process re-send current hover state when a new renderer registers (via `did-finish-load` event)
3. Buffer the last hover state in main and send it on first registration

Option 2 is cleanest: add a `did-finish-load` handler to the offscreen window that triggers a `pushHover()` call.

---

## CONTEXT 5: The nearWindow filter

File: `src/main/halo/haloIsland.ts` (lines 1078-1110)

```typescript
const inBounds = displays.some(d =>
  cand.x >= d.bounds.x && cand.x < d.bounds.x + d.bounds.width &&
  cand.y >= d.bounds.y && cand.y < d.bounds.y + d.bounds.height
);
const win = h?.window;
const winBounds = win && !win.isDestroyed() ? win.getBounds() : null;
const nearWindow = winBounds
  ? cand.x >= winBounds.x - 100 && cand.x <= winBounds.x + winBounds.width + 100 &&
    cand.y >= winBounds.y - 100 && cand.y <= winBounds.y + winBounds.height + 100
  : true;
if (inBounds && nearWindow) {
  lastNativePoint = cand;
  lastNativePointAtMs = Date.now();
  return cand;
}
```

### The problem

On a single-monitor setup (primary display origin (0,0)):
- kdotool returns (203, 700) when hovering pill (~925, 16)
- `inBounds`: true (within 2048x1280)
- `nearWindow`: winBounds is the Halo window (~685, 8, 678, 272). (203, 700) is NOT within 100px of this window.
- Result: REJECTED. Falls through to `screen.getCursorScreenPoint()` which may be frozen.

### The filter's intent

The `nearWindow` filter was added to reject kdotool coordinates that are in-bounds but far from the window (coordinate space mismatch). This is a band-aid: it prevents using wrong coordinates but also prevents using correct coordinates when the user's cursor is far from the window.

### Better approach

Instead of rejecting based on proximity to the window, we should:
1. Transform kdotool coordinates to Electron screen space properly
2. Validate against display bounds only (not window proximity)
3. Use the transformed coordinate if it's in-bounds

The transformation needs to account for DPI scaling and display origin offsets. On a single-monitor 2048x1280 at 96 DPI, the primary display origin is (0,0), so no offset is needed. But on multi-monitor or HiDPI setups, the offset matters.

### What we still don't know

Whether kdotool's coordinate space matches Electron's on this specific setup. The (203, 700) vs (~925, 16) discrepancy suggests they don't match, but we need the controlled experiment to confirm.
