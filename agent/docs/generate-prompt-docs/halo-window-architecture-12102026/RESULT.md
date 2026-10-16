# RESULT — Halo Island: remove the separate Electron window

**Decision:** render Halo inside RHEO's existing main-window renderer. Delete the Halo `BrowserWindow` and all Halo-specific native-window hit-testing/stacking code. Preserve the current `HaloPreferences`, S/M/L sizing, app data producers, and Wayland pointer-detection adapter, but never let global pointer detection raise a window or steal focus.

**Non-negotiable trade-off:** an in-app island cannot remain visible over other applications when RHEO is behind them, minimized, or closed. A compositor-level overlay can do that, but it is a separate Wayland surface/window. Because the user explicitly requires no separate window and zero interference with other applications, cross-application presence is removed from the product requirement. There is no architecture that satisfies both simultaneously without a separate compositor-managed surface.

> Source limitation: the prompt names `CONTEXT_BUNDLE.md`, but the matching file available in the accessible file library was unrelated to Halo. This result therefore treats the exact facts in the prompt as ground truth, verifies Electron/Wayland API semantics against public documentation, and does **not** invent unprovided function bodies, line numbers, or IPC channel names. The call site responsible for the 110 ms repetition must be confirmed in the actual repo as part of Step 1 below. The code blocks are concrete replacement code; connect them to existing project state/preload contracts instead of adding guessed IPC.

---

## 1. Diagnosis

### 1.1 `setShape([])` means rectangular again, not click through

Electron's `BaseWindow.setShape(rects)` API documents an empty array as resetting the window to a rectangular shape. It does **not** produce a zero-area/input-empty region. With a `480 × 118` native window, the rectangle covers `56,640 px²`. A visible `182 × 28` pill covers only `5,096 px²`. The native rectangle is about **11.1×** the pill area; **51,544 px² (~91%)** of it lies outside the visible pill if the visible pill is the only intended target. Transparent pixels are still within the native window rectangle unless the platform input region says otherwise. So `setShape([])` actively undoes any earlier shape narrowing.

Electron API: <https://www.electronjs.org/docs/latest/api/browser-window/> (see `setShape` and `setIgnoreMouseEvents`).

### 1.2 `forward: true` does not forward clicks, and Linux does not support `forward`

Electron defines `setIgnoreMouseEvents(ignore, { forward: true })`'s `forward` option as forwarding **mouse-move messages to Chromium**, enabling renderer events such as `mouseleave`. It is only supported on **macOS and Windows**. It is not a click-forwarding mechanism and is ignored on Linux. Electron's documented `setIgnoreMouseEvents(true)` behavior is that the window ignores all mouse events and those events go to the window below. Thus:

- On XWayland, `setIgnoreMouseEvents(true)` is the relevant native pass-through request.
- `{ forward: true }` cannot be relied upon for Linux hover tracking.
- `setShape([])` is not pass-through; it resets the window shape to a rectangle.
- If the actual code later changes `setIgnoreMouseEvents(false)`, leaves it false during a timer transition, or recreates/enables an interactive region, that transition can make the whole rectangular native area hit-testable. Search every setter and state transition; don't assume the collapsed branch is the last writer.
- A repeated `setShape([])` alone does **not** prove it overrides `setIgnoreMouseEvents(true)`. The API docs say the latter ignores all mouse events. The safest diagnosis is the invalid shape reset plus an unverified writer/state race, not a claim that Electron's documented pass-through always fails on XWayland.

Electron docs: <https://www.electronjs.org/docs/latest/api/browser-window/> and <https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions/>.

### 1.3 `focusable: true` is wrong for the intended overlay, but is not by itself the complete click bug

`focusable: true` permits the Halo window to take keyboard focus. It is contrary to the stated focus-safe design and can make focus behavior worse when the window is activated or when the ignore-mouse state is toggled. It does **not**, by itself, explain every click interception while `setIgnoreMouseEvents(true)` remains active. Remove it with the window; do not keep a focusable separate overlay to repair this architecture.

### 1.4 Why the current design cannot be repaired into the requested design

Even perfectly implemented X11 click-through would leave a separate native window, platform-specific hit testing, stacking races, and an oversized transparent native rectangle to manage. It still does not satisfy “not a separate window.” The replacement removes the native overlay surface entirely. It makes other applications physically incapable of receiving an event through the Halo overlay because no Halo native surface sits above them.

### 1.5 Why `applyClickRegion` is being called around every 110 ms

`604,001` identical messages across roughly 110 ms intervals describe a timer/poll-driven write path, not 604,001 distinct user actions. The 110 ms cadence is compatible with an approximately 100–120 ms hover/idle polling loop, but the exact caller cannot be proven from the prompt alone. In the real repo:

1. Find `applyClickRegion`, `click-region-shaped`, `setShape`, and `setIgnoreMouseEvents`.
2. Enumerate all callers. In particular inspect any `setInterval`, `setTimeout` loop, hover-machine `step` function, pointer poll, window-creation callback, and expand/collapse transition.
3. Add a `reason` argument to trace the caller during one run. It is likely the poll/hover-state path reapplying the same state, but call it proven only after the trace identifies it.
4. Delete the Halo `applyClickRegion` path when the BrowserWindow is removed. Logging suppression is not the primary fix.

The old event's name is misleading: `click-region-shaped` is a repeated state-application log, not evidence of a real click. The replacement diagnostic rule is edge-triggered: log only when the derived state/signature changes (`previous !== next`), with `reason`, and never from an unchanged poll tick. Do not log pointer coordinates or activity payloads every tick.

---

## 2. Decision

### Chosen: in-app island in the existing RHEO window

Mount the island into the main renderer's existing app shell. It is normal DOM, not another `BrowserWindow`, native panel, GTK window, or overlay process. The compact/expanded geometry is styled inside RHEO's viewport. The outer mount has `pointer-events: none`; only the visible island surface has `pointer-events: auto`. The wrapper must be only as large as the rendered island, never a full-width or full-screen interactive layer.

**Guarantees:**

- No second Halo native window and no invisible desktop window.
- Halo cannot intercept clicks or hovers sent to another application.
- Transparent regions outside the actual pill/panel have no DOM hit target.
- Existing S/M/L presets and the existing Halo settings UI continue to control dimensions via the already-used preference store.
- DOM hover enters/leaves remain local to the real island bounds; no native hit-region mutation is needed.

**Cannot do:** stay visible over another application, be always-on-top of native Wayland applications, or react by displaying itself over another app merely because the pointer is at the desktop's top edge. Making it do any of those requires a desktop/compositor surface, which is specifically rejected here.

### Rejected: switch Electron to native Wayland and retain a BrowserWindow

Rejected because it is still a separate native window. Electron's own Wayland discussion states that global window positioning and cursor coordinates are restricted; `setPosition` and `screen.getCursorScreenPoint()` do not provide their X11 semantics on native Wayland. Some features change behavior or rely on portals: global shortcuts go through the desktop portal and screen capture depends on portal/PipeWire behavior. `setShape` is not a portable native-Wayland click-region solution. Switching backend does not remove the surface and does not fulfill the user's architecture requirement.

Sources: <https://www.electronjs.org/blog/tech-talk-wayland>, <https://www.electronjs.org/docs/latest/api/global-shortcut/>, <https://www.electronjs.org/docs/latest/api/desktop-capturer/>.

### Rejected: GTK4 / `zwlr_layer_shell_v1` helper

This is the proper Wayland-native path **if** cross-application presence is the product requirement: layer-shell gives a compositor-managed top/overlay layer, edge anchors, and input-region semantics. Version 5 is reported available in this environment. But the helper creates a separate Wayland surface, must be packaged/started/stopped, and needs a validated IPC boundary from RHEO to helper. It directly violates the user's explicit “not a separate window” requirement. It is not the selected design.

Protocol: <https://wayland.app/protocols/wlr-layer-shell-unstable-v1>.

### Product requirement change

Amend the goal from **“a global always-on-top island over every application”** to **“an unobtrusive island inside RHEO that is interactive only inside its visible bounds.”** If the team later reintroduces global presence, it must be a deliberate product change that accepts a separate compositor surface. Do not quietly reintroduce an Electron `BrowserWindow` under another name.

---

## 3. Implementation

The prompt provides file names but not the actual checked-out source or line bodies. The following are exact design-level edits and code to apply at the named integration points. Keep existing store and preload names; do not create guessed IPC channels.

### 3.1 `src/main/halo/haloIsland.ts`: delete the overlay window lifecycle

Remove the Halo-only code that constructs or controls its own `BrowserWindow`, including:

- `new BrowserWindow(...)` / overlay-window factory;
- `focusable`, `alwaysOnTop`, `showInactive`, `setVisibleOnAllWorkspaces` calls for Halo;
- Halo calls to `setShape(...)` and `setIgnoreMouseEvents(...)`;
- Halo-specific native positioning, canvas-bound checks, re-show timers, and click-region retries;
- polling that calls `applyClickRegion` only to manage the removed window.

Retain only activity/data routing that is needed by the in-app component. Its state must flow through existing app state/preload contracts; **do not invent an IPC channel**. If `haloIsland.ts` currently owns state that the renderer needs, expose that state through the project's existing subscription/bridge mechanism and pass it as props/context to `OverlayRoot`.

The intended end-state for the native service is deliberately boring:

```ts
// src/main/halo/haloIsland.ts
// Halo has no native window. This module only owns existing data/lifecycle
// subscriptions required by the in-app component. Keep current, verified
// producer and teardown code; remove all BrowserWindow/hit-region ownership.

export interface HaloIslandLifecycle {
  start(): void;
  stop(): void;
}

// Implement with the existing project subscriptions. Do not create a window.
export function createHaloIslandLifecycle(deps: ExistingHaloDependencies): HaloIslandLifecycle {
  let started = false;
  const cleanups: Array<() => void> = [];

  return {
    start() {
      if (started) return;
      started = true;
      // Register existing data/event subscriptions here only.
      // Add each actual cleanup callback to cleanups.
      // No BrowserWindow creation; no setShape; no input-region polling.
    },
    stop() {
      if (!started) return;
      started = false;
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    },
  };
}
```

`ExistingHaloDependencies` is a placeholder for the repo's **actual** types, not a new type to copy literally. If the current module has no useful non-window work, remove it and its boot calls instead of keeping an empty facade. Do not edit `main.ts` blindly: replace only the current Halo service invocation with the minimal lifecycle or remove it if unused.

### 3.2 `src/features/halo/OverlayRoot.tsx`: mount in the main app shell

Render this component once under the existing app-shell/root component, not through a new `BrowserWindow`, `window.open`, portal-to-window, or overlay process. Use the app's current preference/state hooks and existing handlers in place of the typed props shown here.

```tsx
import type { CSSProperties, ReactNode } from 'react';
import './halo.css';

type HaloSizePreset = 'S' | 'M' | 'L';
type HaloVisualState = 'collapsed' | 'expanded';

interface OverlayRootProps {
  enabled: boolean;
  sizePreset: HaloSizePreset;
  visualState: HaloVisualState;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  children: ReactNode;
}

const SIZE_SCALE: Record<HaloSizePreset, number> = {
  S: 0.80,
  M: 1.00,
  L: 1.20,
};

export function OverlayRoot({
  enabled,
  sizePreset,
  visualState,
  onPointerEnter,
  onPointerLeave,
  children,
}: OverlayRootProps) {
  if (!enabled) return null;

  const style = {
    '--halo-size-scale': SIZE_SCALE[sizePreset],
  } as CSSProperties;

  return (
    <div className="haloIslandMount" style={style} data-testid="halo-mount">
      <div
        className="haloIslandSurface"
        data-state={visualState}
        data-size={sizePreset}
        data-testid="halo-surface"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </div>
    </div>
  );
}
```

If the existing presets use different scale factors, **keep their current values**. The sample values above only show the CSS variable boundary; do not silently overwrite current S/M/L tuning. The setting's persisted source remains `HaloPreferences` or the existing preference store. Do not move it into `localStorage`.

Mount it in the app shell adjacent to the existing top-level content, with the existing route/provider context:

```tsx
<AppProviders>
  <AppShell>
    <ExistingRoutes />
    <OverlayRoot
      enabled={haloPreferences.enabled}
      sizePreset={haloPreferences.sizePreset}
      visualState={haloState.visualState}
      onPointerEnter={haloHandlers.onPointerEnter}
      onPointerLeave={haloHandlers.onPointerLeave}
    >
      <ExistingHaloContent />
    </OverlayRoot>
  </AppShell>
</AppProviders>
```

These identifiers illustrate the connection point, not claims about the repo's exact exported symbol names. Reuse the existing preference/state/handler symbols. There must be exactly one mounted in-app `OverlayRoot`.

### 3.3 `src/features/halo/halo.css`: confine DOM hit testing to visible pixels

Use the existing project tokens and visual rules; these CSS properties are the important hit-test contract. The wrapper must **not** fill the screen or app width.

```css
/* In-app only. No fixed native canvas and no desktop hit region. */
.haloIslandMount {
  position: fixed;
  z-index: var(--z-halo, 40);
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  height: max-content;
  padding: 0;
  margin: 0;
  overflow: visible;
  pointer-events: none;
}

/* Only painted island bounds participate in pointer targeting. */
.haloIslandSurface {
  position: relative;
  box-sizing: border-box;
  width: calc(var(--halo-compact-width, 182px) * var(--halo-size-scale, 1));
  height: calc(var(--halo-compact-height, 28px) * var(--halo-size-scale, 1));
  pointer-events: auto;
  touch-action: manipulation;
}

.haloIslandSurface[data-state='expanded'] {
  width: calc(var(--halo-expanded-width, 360px) * var(--halo-size-scale, 1));
  height: calc(var(--halo-expanded-height, 220px) * var(--halo-size-scale, 1));
}

/* Keep nested transparent layers from becoming hit targets outside the shape. */
.haloIslandSurface :where(.halo-decorative, .halo-shadow, .halo-backdrop) {
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .haloIslandSurface,
  .haloIslandSurface * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Important details:

- Preserve the existing S/M/L measurements and scale bounds. The CSS sample defaults use the prompt's visible-pill `182×28` only to make the target clear.
- Expanded width/height should come from the current geometry preset; they must not create a window or change OS-level geometry.
- If decorative descendants overlay buttons, make only those decorations `pointer-events:none`; real controls remain hit-testable.
- Do not use an invisible wide hot-zone element. Expand on pointer enter of the actual surface and use a small leave grace timer owned by the existing hover state machine.
- Keep current LAMINAR restrictions: no spring/bounce, no scale-on-hover, no decorative gradients/glows, Lucide icons only.

### 3.4 `HaloPreferences` and Settings: preserve existing preferences

Do **not** replace the existing preferences UI or its saved store. Keep:

- enable/disable;
- current S/M/L preset selection or existing size scale slider;
- persistence through the current `HaloPreferences`/preference-store path;
- any current reduced-motion/other Halo controls.

Route the saved size value into `--halo-size-scale` (or existing CSS variables) so it changes the **DOM island surface**, not a `BrowserWindow`'s width/height. Preserve existing values rather than changing the numerical size contract during this architecture migration. Acceptance: changing S/M/L in Settings changes the island on the next render and still does so after app restart; no native window APIs are called.

### 3.5 Hover handling: preserve existing Wayland detection without raising a window

Retain the existing `kdotool` / `hyprctl` / `wlrctl` capability adapter and its tests. Do not switch Electron to native Wayland in this change; keep the current launch environment needed by the app (`ELECTRON_OZONE_PLATFORM_HINT=x11`) unless a separate, validated migration changes the whole app.

Change the adapter's authority:

- It may continue reading pointer/hot-zone data and emitting diagnostic capability states.
- It must not call `show`, `showInactive`, `focus`, `setAlwaysOnTop`, `setShape`, `setIgnoreMouseEvents`, or any window positioning API to make Halo appear.
- It may trigger expansion only when the existing RHEO main window is visible and the island is actually under the pointer in that app window.
- When the pointer is over another application, do not raise RHEO, do not change focus, and do not claim to display Halo. The DOM island is naturally hidden behind that app.
- Mouse enter/leave and grace timers must not re-render at poll frequency; state changes only when the hover FSM phase changes.

This preserves the native detection implementation without falsely promising a global floating island. Global desktop hover-to-show is incompatible with a strict no-separate-window design.

### 3.6 `applyClickRegion`: remove from runtime

The selected architecture has no native click region. Delete the function and its callers if they existed only to shape/enable/disable the overlay window. If a general diagnostic helper is still needed for unrelated native windows, rename it to avoid implying it manages Halo and preserve its macOS guard (`setShape` throws on macOS). No Halo path may call `setShape`.

If keeping a transition logger during the migration, use this logic and then remove it once validated:

```ts
type ClickMode = 'none' | 'island';

let lastLoggedMode: ClickMode | undefined;

function logClickModeTransition(next: ClickMode, reason: string): void {
  if (next === lastLoggedMode) return;
  const previous = lastLoggedMode ?? 'unknown';
  lastLoggedMode = next;
  diagnostic.info('halo-click-mode-transition', { previous, next, reason });
}
```

Do not call the logger with high-frequency coordinates or write one record per polling tick. Under the chosen design it should emit no ongoing `click-region-shaped` records at all.

### 3.7 Log cleanup

Do not let the old 63 MB file keep growing. Stop RHEO first, then preserve the old log and start a fresh one:

```bash
log="$HOME/.config/RHEO/halo-diagnostic.log"
if [ -f "$log" ]; then
  mv -- "$log" "$log.pre-inapp-migration.$(date +%Y%m%d-%H%M%S)"
fi
: > "$log"
```

Do not delete the preserved file until after confirming it is no longer needed for debugging. After restart, verify that the new log does not contain the repeated `click-region-shaped` event. Diagnostic records should describe transitions, not poll ticks.

---

## 4. Migration

### Step 1 — establish the actual caller and freeze a baseline

In the repository, run:

```bash
rg -n 'applyClickRegion|click-region-shaped|setShape|setIgnoreMouseEvents|focusable|new BrowserWindow|stepHover|setInterval|setTimeout' src start-dev.sh agent/probes
rg -n 'HaloPreferences|sizePreset|sizeScale|halo.*enabled|S/M/L' src
rg -n 'kdotool|hyprctl|wlrctl|ELECTRON_OZONE_PLATFORM_HINT' . --glob '!node_modules/**'
```

Record every `applyClickRegion` call site and the timer callback it comes from. Trace logging must show which `reason` fires about every 110 ms. **Do not guess a caller from the log cadence alone.** Run all seven existing probes and retain the 246-assertion baseline.

**Verify:** baseline still passes; capture current settings/preset values; confirm the actual source and lifecycle call sites. If the bundle/code says a different file is authoritative, follow that source.

### Step 2 — delete the native Halo window path

Remove Halo's `BrowserWindow` creation, shape mutation, mouse-ignore toggles, focusability/topmost code, placement guard, and native overlay poll caller. Keep only data subscriptions that still feed the in-app component. Do not change app-wide window behavior or the existing Ozone launch flag as part of this migration.

**Verify:** app starts with no extra Halo window in `xwininfo -root -tree` / `wmctrl -l` on the XWayland session; the normal RHEO main window remains unchanged; no new helper process starts.

### Step 3 — mount `OverlayRoot` inside the app shell

Mount one instance using the existing renderer state and route/provider context. Remove any overlay-specific loading/navigation path that creates another renderer. Do not add a new IPC channel merely to mirror state already accessible in the renderer.

**Verify:** DOM has exactly one `[data-testid="halo-mount"]`, and it is a descendant of the existing main app root. The component survives app route changes without creating any native window.

### Step 4 — apply true DOM bounds and reuse Settings

Set the compact and expanded CSS dimensions from existing geometry/preset values. Keep the wrapper `pointer-events:none`; only the painted surface/controls receive events. Connect current settings to CSS variables using the existing preference store.

**Verify:** S/M/L all change dimensions; each value persists through restart; no full-width/full-screen halo wrapper appears in computed layout; expanded controls remain clickable.

### Step 5 — disconnect global hover from global window actions

Keep the `kdotool`/`hyprctl`/`wlrctl` detection adapter but remove any effect that raises or repositions an overlay window. Use local DOM pointer events and the existing FSM while the main RHEO window is visible. When another app owns the screen, the adapter may log detection but cannot bring RHEO forward.

**Verify:** hovering the actual DOM island expands and leaving collapses with the existing grace behavior; hovering unrelated controls in RHEO does not trigger the island; switching to another application and moving/clicking there never raises RHEO or changes that application's hover behavior.

### Step 6 — bound diagnostics and rotate the old log

Remove redundant `click-region-shaped` logging and keep only real FSM/architecture transitions. Archive the large log using Step 3.7.

**Verify:** 60 seconds of idle use creates no repeated same-state click-region messages; transitions appear once each; the diagnostic log size remains bounded.

### Step 7 — amend spec and run the full acceptance suite

Apply the spec deltas below. Run all seven original probes and the new probes. Then test on the target Fedora/KDE/XWayland session, including Settings changes, app switching, top-edge hover, rapid pointer travel, and route changes.

**Verify:** all original 246 assertions stay green; new probes pass; no Halo-specific second window exists; no hover or click is stolen from another application.

---

## 5. Regression tests

Add probes under `agent/probes/` using the existing probe harness and style. Keep all 246 existing assertions. These are acceptance probes, not a claim that they already exist.

### Probe A — `halo-no-native-window.probe.ts`

- Starting Halo creates **zero** new `BrowserWindow` instances.
- The Halo renderer mount exists only under the existing main renderer root.
- Halo never invokes `show`, `showInactive`, `focus`, `setAlwaysOnTop`, `setBounds`, `setPosition`, `setShape`, or `setIgnoreMouseEvents`.
- Disabling Halo removes/hides the DOM component and does not hide/minimize/resize the main app window.
- Repeated mount/unmount does not leak timers/listeners/subscriptions.

### Probe B — `halo-dom-hitbox.probe.ts`

For S, M, and L in both collapsed and expanded states:

- The wrapper width/height equals the visible surface width/height (or its exact bounding box), not screen width, `480×118`, or any native canvas size.
- The mount has `pointer-events:none`; the painted surface has `pointer-events:auto`.
- Clicks at four visible surface corners reach the island's intended handler.
- Clicks 1 px outside all four bounds are not handled by Halo.
- Transparent/decorative descendants never create a larger input rectangle.
- A click on an underlying RHEO button outside Halo still activates that button.

### Probe C — `halo-settings-size-persistence.probe.ts`

- S/M/L values match the pre-migration Settings contract exactly.
- Changing the preset updates the actual DOM island dimensions after the next render.
- Values persist through app restart via the existing preference store.
- Disabling/re-enabling Halo preserves the chosen size.
- No setting triggers `BrowserWindow.setSize`, `setBounds`, or another window creation.

### Probe D — `halo-click-region-transition-logging.probe.ts`

- Repeatedly invoke the prior poll/hover callback 10,000 times with unchanged state: **zero repeated same-state logs** after the initial state.
- Transition collapsed → expanded logs one transition; repeated expanded ticks log none.
- Transition expanded → collapsed logs one transition; repeated collapsed ticks log none.
- A reason/caller is included for actual transitions while tracing is enabled.
- The runtime emits no `click-region-shaped` event after the native Halo path is removed.
- A 60-second idle smoke run keeps the log below a small bound (suggested ≤64 KB absent genuine errors), not tens of MB.

### Probe E — `halo-hover-contract.probe.ts`

- Pointer enter on the real compact surface enters the existing expand transition.
- Pointer leave starts the existing grace timer; it does not instantly flicker closed during a valid move to expanded controls.
- Pointer leaving the entire island collapses once; no timer duplicates the transition.
- Moving over another RHEO component does not open Halo.
- Hovering another application never raises/focuses RHEO and cannot intercept that application's mouse events.
- Global platform detection may emit status/log events but cannot dispatch a native-window show/focus/position action.

### Probe F — `halo-wayland-adapter-preserved.probe.ts`

- The existing `kdotool` / `hyprctl` / `wlrctl` command preference/fallback behavior remains intact.
- Each unavailable command follows the existing fallback rather than crashing or blocking renderer startup.
- Native detection produces no Halo `BrowserWindow`, hit-region, focus, or stacking call.
- The current XWayland launch environment remains present unless a separate migration has its own passing test matrix.

### Probe G — `halo-shape-semantics.probe.ts`

This should be a static/code-contract probe plus a documented native smoke test:

- No Halo source calls `setShape([])`.
- No Halo code assumes an empty shape array means an empty input region.
- Any unrelated `setShape` usage remains platform-guarded because it throws on macOS.
- If a test double models Electron's API, it asserts that `setShape([])` resets shape to rectangular rather than pass-through.

### Probe H — `halo-cross-app-noninterference.manual.md`

Run on Fedora 44 KDE Plasma with the current XWayland startup:

1. Open a second native app with clickable toolbar controls, text fields, and hover-only elements.
2. Move across the top-center screen region where the old island was positioned. All controls and hover states must behave exactly as without Halo.
3. Click every part of the old `480×118` canvas area. Since no Halo native window exists, all clicks go to the underlying app.
4. Switch back to RHEO. Verify compact/expanded interaction and Settings size presets.
5. Check `wmctrl -l`/`xwininfo` for no extra Halo window and inspect diagnostics for no repeated event.

### Suite-level gates

- Original seven probes: all **246** prior assertions still pass.
- New automated probes: all pass.
- Manual native smoke test: pass on the actual Fedora/KDE/XWayland desktop.
- No claim of always-on-top over other apps is permitted in UI copy/docs.

---

## 6. Spec deltas

Amend `agent/docs/HALO_ISLAND.md`. These are intentional product/architecture changes, not implementation exceptions.

### Delta 1 — §8: separate-window mandate

```diff
- Halo MUST own a separate transparent BrowserWindow / fixed native canvas.
+ Halo MUST be rendered inside the existing RHEO main-window renderer.
+ Halo MUST NOT create a separate BrowserWindow, native panel, layer-shell surface,
+   helper process, or other desktop overlay surface.
+ The island is only visible while the RHEO app window is visible.
+ Cross-application always-on-top presence is explicitly unsupported by this product contract.
```

### Delta 2 — §8: focusability

```diff
- focusable: false (required overlay setting)
+ No Halo BrowserWindow exists, so BrowserWindow focusability is not configured.
+ The in-app island uses ordinary DOM hit testing and cannot take OS focus independently.
```

### Delta 3 — click-through / `setShape`

```diff
- Collapsed state uses setIgnoreMouseEvents(true, { forward: true }) and setShape([]).
- Expanded state enables the native window hit region.
+ Halo does not use setShape or setIgnoreMouseEvents.
+ The island wrapper is pointer-events:none; only the visible surface and real controls
+   are pointer-events:auto.
+ DOM hit targets must stay within the actual compact/expanded surface bounds.
+ Never interpret setShape([]) as an empty region; Electron documents it as reset to rectangle.
```

### Delta 4 — global hover/window polling

```diff
- Global pointer polling controls native overlay visibility and click region.
+ Keep existing kdotool/hyprctl/wlrctl detection/fallbacks, but they cannot raise, focus,
+   reposition, or alter hit testing for Halo.
+ Local enter/leave on the actual DOM island drives visual expansion when RHEO is visible.
+ A pointer over another application must not bring RHEO forward.
```

### Delta 5 — Linux startup/backend

```diff
- [No change] ELECTRON_OZONE_PLATFORM_HINT=x11 is required by the current RHEO desktop integration.
+ Keep the existing XWayland launch setting during this migration to avoid changing app-wide
+   shortcut, capture, and pointer-detection assumptions. Native Wayland is a separate project.
+ The setting no longer exists to support a Halo overlay window; it remains only for the
+   current app's verified environment/integrations.
```

### Delta 6 — geometry and settings

```diff
- Halo dimensions map to native overlay BrowserWindow/canvas geometry.
+ Existing S/M/L and enabled/disabled preferences remain unchanged and persisted through
+   the current preference store.
+ Presets affect only CSS/DOM dimensions. No native window is resized or repositioned.
+ Compact and expanded hitboxes equal their rendered surface bounds; no invisible hot zone.
```

### Delta 7 — diagnostics

```diff
- click-region-shaped may be emitted for every poll/application of the current region.
+ Logs are transition-only (previous != next), include a reason only when state changes,
+   and do not include sensitive activity payloads or per-tick pointer details.
+ The in-app Halo emits no click-region-shaped event because it has no native click region.
```

### Delta 8 — Definition of done

```diff
- compact_is_click_through / underlying_app_retains_focus for a separate overlay window
- always_on_top_over_other_apps
+ no_separate_halo_window
+ no_halo_native_hit_region
+ halo_dom_hitbox_equals_visible_surface
+ clicks_and_hover_outside_halo_are_unaffected
+ settings_presets_persist_and_resize_dom_surface
+ halo_visible_only_inside_existing_rheo_window
```

### Assumptions and falsification

| Assumption | Why used | What would falsify it |
|---|---|---|
| The main RHEO renderer can host `OverlayRoot` inside its app shell. | The requested result must have no second window; Electron apps already have a main renderer. | The actual app is architected with no shared top-level shell and cannot mount this component; then mount it at the highest common route/layout that already exists, not a new window. |
| The current preference store exposes enabled + size preset/scale. | User explicitly says existing settings already control size. | Actual source shows another source of truth; continue using that exact existing source, do not add a second store. |
| The 110 ms writes originate from a repeating timer or polling-driven transition callback. | Identical records at regular cadence strongly indicate repeated polling work. | Instrumentation proves the writes are initiated by a different recurring source, e.g. a resize event or renderer IPC loop; remove/log-gate that actual writer instead. |
| `setShape([])` resets to rectangular shape. | Electron BrowserWindow API documents the empty-array reset. | A pinned Electron version/source in this repo demonstrably overrides the documented behavior; add a version-specific native probe and revise only that statement, but do not reintroduce a separate Halo window. |
| No separate native surface is the highest-priority requirement. | User explicitly repeats it in the final request. | User changes the product requirement to accept a separate compositor-managed surface for true global presence. Until then, do not ship layer-shell or another BrowserWindow. |

---

## Final engineering order

**Remove the extra window first.** The click guarantee then comes from the architecture, not a fragile combination of X11 shape, input-ignore, focusability, and polling. Keep the existing Settings and Wayland detection code, but make the island a normal in-app DOM component. Accept that it cannot be always-on-top of other applications without reintroducing a separate compositor surface.

### External references

- Electron `BrowserWindow` API (`setShape`, `setIgnoreMouseEvents`): https://www.electronjs.org/docs/latest/api/browser-window/
- Electron custom window interactions / click-through: https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions/
- Electron Wayland limitations: https://www.electronjs.org/blog/tech-talk-wayland
- Electron global shortcuts: https://www.electronjs.org/docs/latest/api/global-shortcut/
- Electron desktop capture: https://www.electronjs.org/docs/latest/api/desktop-capturer/
- `zwlr_layer_shell_v1` protocol: https://wayland.app/protocols/wlr-layer-shell-unstable-v1
