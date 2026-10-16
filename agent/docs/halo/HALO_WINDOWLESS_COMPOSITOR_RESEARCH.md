# Halo Island: genuinely windowless compositor overlay

**Research status:** sourced architecture recommendation, not a claim that a prototype was built or tested on this machine. This document supersedes the *architecture choice only* in the earlier `RESULT.md`; it does not replace the existing layout, palette, S/M/L sizes, settings, hover FSM, or the 255 passing probe assertions.

## Answer first

**No. The earlier specification did not contain a genuinely windowless implementation.** It recommended a GTK4 `gtk4-layer-shell` helper. That avoids a normal Electron `BrowserWindow` and gives the overlay the Wayland `overlay` layer, but it still creates a distinct Wayland `wl_surface`/layer-surface. That's a desktop-shell surface rather than a normal top-level app window, but it is still a compositor-managed surface.

There are two meanings of “without a window”:

1. **No visible Electron/OS top-level window:** achievable while keeping the existing React UI, using Electron offscreen rendering and a KDE KWin compositor effect to paint its output into the composed desktop.
2. **No app-owned Wayland surface at all:** also achievable for the *visuals* with a KWin effect, which draws directly after KWin paints normal windows. But the ordinary public effect callbacks do not by themselves establish reliable selective click capture. Interactive hit testing requires a KWin-side input filter/hit-test bridge, or else the capsule is visual-only and actions need another input route.

For this Fedora KDE Wayland machine, the recommended path for the literal requirement is **KWin compositor effect + offscreen React renderer + KWin hit-test/input filter**. This is KDE/KWin-specific, not a universal Electron API. Do not call it complete until the prototype proves selective click consumption and pass-through on the installed KWin version.

## What primary sources establish

- Electron documents that `BrowserWindow.setAlwaysOnTop()` and `moveTop()` are not supported on Wayland, and that programmatic positioning is unsupported on that backend. The currently forced XWayland path therefore cannot turn `_NET_WM_STATE_ABOVE` into guaranteed native-Wayland topmost ordering: [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window).
- KWin's **C++ `KWin::Effect::paintScreen()`** hook explicitly allows an effect to call the rest of the paint chain and then “paint something on top of the windows.” That is the relevant no-window rendering seam: [KWin Effect API](https://api.kde.org/kwin-effect.html), especially `paintScreen()` and its painting-stage description.
- KDE's QML `SceneEffect` is not the right first implementation for this overlay: its documented example takes over the screen scene, and KDE says the effect is then responsible for what is displayed. Use a normal C++ `KWin::Effect` that chains the existing scene and draws only the island afterwards, not a fullscreen `SceneEffect`: [KWin Effects guide](https://develop.kde.org/docs/plasma/kwineffect/).
- The KWin Effect API lists `pointerMotion()` and `pointerButton()` callbacks as introduced in KWin 6.7. Those callbacks are `void`; do **not** assume that merely implementing them gives the effect permission to consume one click and pass another through. The effect API alone is not a documented rectangular/DOM hit-test filter: [KWin Effect API](https://api.kde.org/kwin-effect.html).
- Wayland layer shell is the easier, supported alternative if a dedicated surface is accepted: its protocol supports a true `overlay` layer and explicitly says an empty `wl_surface` input region makes the layer surface receive no pointer/touch/tablet events. This is strong input-region semantics, but it is still a layer surface: [wlr layer-shell protocol](https://wayland.app/protocols/wlr-layer-shell-unstable-v1).
- Electron has a separate **offscreen rendering** mode. It emits rendered frames as a bitmap or (experimental) shared GPU texture, suitable for drawing “anywhere”; the shared-texture route needs native integration. This lets React remain the visual source without a visible desktop window: [Electron Offscreen Rendering](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering), [WebContents `paint` event](https://www.electronjs.org/docs/latest/api/web-contents#event-paint).
- KDE describes KWin effects as plugins that can be installed in the user's KWin effects directory or built/installed with KDE's packaging/build tools. They run inside the compositor process, so an effect crash or deadlock is more serious than an overlay process crash: [KWin Effects guide](https://develop.kde.org/docs/plasma/kwineffect/).

## Chosen architecture: offscreen React + KWin compositor effect

```text
RHEO main process (authoritative data/actions/settings)
  ├─ existing Halo React renderer in Electron offscreen mode
  │    └─ frame output + DOM hit-target map
  └─ local authenticated/versioned bridge
        ├─ frame channel/shared-memory buffer → KWin Halo Effect
        ├─ activity/state/settings updates → KWin Halo Effect
        └─ allow-listed pointer actions ← KWin hit-test filter

KWin compositor
  ├─ paints Firefox/VS Code/other native Wayland applications normally
  ├─ paints Halo texture over the already-composited scene (no app-owned visible window)
  ├─ monitors pointer motion without consuming it
  └─ consumes pointer buttons ONLY if the screen point hits an armed Halo action region;
       every other event continues to the application under the pointer
```

### Renderer choice

Keep the existing React components (`CompactPill`, `FocusPageRow`, `DictationActivity`, `AmbientCard`, boards, sizing, S/M/L settings) as the single source of visual content. Move only the Halo render instance to an Electron `BrowserWindow` configured with `webPreferences.offscreen: true` and **never call `show()`**. It is an offscreen render target, not a mapped desktop surface; it does not sit above apps or participate in OS hit testing.

Start the spike in CPU-bitmap mode to prove correctness. Use Electron's `paint` event and a bounded/double-buffered shared-memory frame channel, not JSON/Base64 frame payloads. Consider `webPreferences.offscreen.useSharedTexture: true` only after CPU mode works; Electron documents this mode as experimental and requiring native integration. Stop painting while no visual change is needed; cap the initial active frame rate at 30 fps and measure before moving to 60 fps.

Each frame record must include `{ protocolVersion, sequence, width, height, deviceScaleFactor, dirtyRect, pixelFormat }`. Do not serialize pixels into JSON. The KWin effect uploads the newest completed buffer to a GPU texture and discards stale frames. If frame handling falls behind, render the latest frame rather than queuing frames.

### KWin effect

Create a version-pinned KWin `Effect` plugin, e.g. `native/kwin-halo-effect/`, and install it under the user's KWin effect path. In its `paintScreen()` implementation, preserve normal desktop composition by invoking the next effect/normal paint chain first, then draw the island texture with alpha at the top-center coordinates. Repaint only the previous and current island bounds. Do **not** use a fullscreen opaque `SceneEffect`, an X11 override-redirect window, a GTK layer-shell surface, or an Electron top-level overlay in this strict no-visible-window backend.

The effect should only render the supplied frames. Application data, settings persistence, SQLite access, and action authorization remain in RHEO main. The effect receives a minimal, schema-versioned state packet, never arbitrary JavaScript. It reports capabilities and failures over the bridge.

### Input contract (the make-or-break part)

A compositor-rendered texture has no native surface input region. The KWin-side hit-test filter must therefore be proven before implementation expands beyond a spike.

- Track pointer motion at the compositor level; run the existing `stepHover()` FSM and retain the existing settings/poll timing where appropriate. Motion observation must not consume the event.
- The renderer publishes a small, versioned set of **interactive DOM rectangles** (or a compact input mask) in canvas-local coordinates. Publish on layout, preset, phase, or content changes, not on each animation frame. Do not treat the whole 480×118 / 560×134 / 680×154 canvas as interactive.
- Convert those rectangles to screen coordinates using the same geometry source used to paint the texture. The target is the actual pill/control/interactive-content bounds, excluding transparent canvas, margins, rounded transparent corners, and noninteractive blank areas.
- On pointer motion, update hover state and pass the motion to the underlying app. This allows normal app hover states to continue.
- On pointer press/release: if the point does **not** hit an armed interactive region, pass the event to KWin's normal input dispatch unchanged. If it hits an armed region, consume that button event and forward the matching synthetic input to Electron's offscreen `webContents` through the local bridge. Do not consume only press or only release; preserve event pairs and modifiers.
- Avoid click stealing when expansion animates under the pointer: opening starts visually but the hit map remains disarmed until the pointer leaves the trigger hot zone and deliberately re-enters a visible interactive region. Keep pass-through during `idle → expanding` and while pointer stays at its pre-expansion location.
- Do not consume wheel, touch, keyboard, or unrelated mouse buttons unless that exact action is implemented and tested. Never call `win.focus()` or activate RHEO because the user clicked a Halo control.
- If the current KWin package does not expose a supported way to install a selective input filter from a third-party effect, do not fake it with `pointerButton()` callbacks. Either maintain a small, KWin-version-pinned patch/plugin that uses the compositor's internal input-filter API, or fall back to the layer-shell surface backend. The internal `InputEventFilter` is not a stable cross-version application API, so compatibility has to be tested and declared.

### Local bridge and safety

Use a per-user Unix-domain socket with restrictive permissions and a protocol version. If using shared memory, pass the FD over the socket and use two buffers plus monotonic frame sequence numbers. Validate message size, dimensions, rectangle bounds, action enum, and protocol version. Accept only fixed actions from an allowlist; the KWin plugin must not accept arbitrary commands, file paths, URLs, or renderer-supplied IPC channel names. Keep a heartbeat. If RHEO exits, stop rendering and clear the overlay. If the effect disconnects, RHEO must remain usable and must not fall back silently to the broken XWayland topmost window.

## Why not the simpler alternatives?

| Approach | Above native Wayland apps? | No visible app-owned window? | Exact pass-through? | Decision |
|---|---|---|---|---|
| Current Electron XWayland `BrowserWindow` + `setAlwaysOnTop` | Not guaranteed | No | Fragile | Reject for KDE Wayland |
| Regular Electron native-Wayland toplevel | No guarantee of overlay-layer placement; Electron documents window-management limits | No | Window input semantics only | Reject as the final solution |
| GTK4 `gtk4-layer-shell` / `zwlr_layer_shell_v1` | Yes, on compositors supporting layer-shell | No: there is a dedicated compositor layer surface, though not a normal app toplevel | Strong; empty or bounded input region is in the protocol | Best fallback if a layer surface is acceptable |
| **KWin effect + offscreen React + selective KWin input filter** | **Yes, under KWin; drawn in compositor render chain** | **Yes: no mapped Halo desktop window/surface** | **Yes only after the selective input filter is proven** | **Chosen for the strict KDE no-window requirement** |
| Plasma applet alone | Normally sits in the desktop shell layer, not persistently over ordinary application windows | Yes | Not applicable | Reject for all-app presence |
| KWin JavaScript window-management script alone | Does not provide a persistent custom composited renderer/hit-test surface | Not by itself | Not applicable | Reject; use a KWin effect, not only a KWin script |

A single cross-platform **windowless** mechanism does not exist in Electron. KWin effects solve this on KDE/KWin only. macOS and Windows need their own OS-specific overlay integration or a conventional native window; do not promise “windowless above all apps” across platforms using a shared Electron API.

## Prototype gate before migrating production

Implement this as a minimal effect and probe first; do not port the full island yet.

1. Paint a solid 182×28 test capsule using the effect after the normal scene. Verify it stays above native Wayland Firefox and VS Code, across desktop switching, fullscreen, display scaling, and sleep/wake.
2. Add pointer-motion observation only. Verify hover is detected over Firefox/VS Code while their own hover and focus continue normally.
3. Prove a selective hit-test filter with three screen zones: outside canvas, transparent canvas, visible-but-noninteractive pill area. All clicks must reach the underlying app.
4. Add one explicit test control. Only pointer press/release inside its armed rectangle is consumed and delivered to that control. Test clicks on app tabs/title bars immediately adjacent to the pill and while the pill is opening/collapsing.
5. Kill/restart RHEO and the effect independently. The desktop must remain interactive and no stale overlay may persist.
6. Only after all gates pass, connect the existing render surface and migrate the remaining 255 assertions unchanged. Add the new windowless/input probes rather than deleting or rewriting existing probes.

## Probe requirements

Add probes under `agent/probes/` for at least:

- `halo-kwin-windowless-paint`: `paintScreen` chains the desktop scene exactly once before painting Halo; no new mapped window/surface is created by the effect; transparent pixels reveal the real app; full-screen apps remain visible beneath all pixels except actual capsule pixels.
- `halo-kwin-hover-observer`: motion updates `stepHover` over native Wayland apps but does not consume motion; idle/expanded timing retains existing thresholds; the user can hover Firefox/VS Code controls behind and adjacent to the island.
- `halo-kwin-hit-test-pass-through`: events outside armed action rectangles return to normal KWin dispatch; transparent canvas/background clicks never get consumed; only an explicit armed control rectangle consumes a complete press/release pair.
- `halo-kwin-expand-under-pointer`: expanding beneath the pointer never arms a click until leave-and-re-enter; click on the Firefox toolbar during expansion still reaches Firefox.
- `halo-offscreen-frames`: validates protocol version, sequence monotonicity, S/M/L dimensions, scale factor, dirty-rectangle clipping, stale-frame drop, no unbounded queue, idle paint suspension, reconnect behavior.
- `halo-kwin-settings-geometry`: existing `--halo-scale`, shape, radius, margin, resident, and S/M/L settings produce matching render size, paint position, and hit-test coordinates; no duplicate settings store.
- `halo-kwin-failure-isolation`: KWin bridge failure or renderer crash removes/clears overlay and never disables desktop input; RHEO remains functional.
- `halo-kwin-version-gate`: on a KWin version where selective input filtering is unsupported, fail closed and report unsupported; never switch to a full-canvas click-capturing fallback.

Run all existing seven probes first and preserve the **255/255** green baseline. The new spike should not require changing the preset geometry or deleting board coverage.

## Assumptions and falsifiers

- **Assumption:** target development desktop runs KWin/Plasma Wayland, not another compositor. Falsified by `echo "$XDG_SESSION_TYPE $XDG_CURRENT_DESKTOP"` or a different window manager.
- **Assumption:** the installed KWin build can load an external C++ effect and the matching build exposes a selective input filter or can be patched to provide one. Falsified if the plugin cannot link/register the filter or a click-outside test is intercepted. In that case, a true no-window **interactive** solution is not demonstrated on that KWin build; the honest operational fallback is a layer-shell surface with a strict input region.
- **Assumption:** existing React UI can run in an offscreen BrowserWindow without dependencies on visible-window focus or native pointer enter events. Falsified by renderer tests; adapt its platform bridge, do not reimplement data/business logic.
- **Assumption:** input and frame bridge are local-only and trusted to one user. Falsified if the application is packaged in a sandbox that prevents socket/FD transfer; then define explicit IPC permissions before shipping.

## References

1. [KWin Effect API — paintScreen draws after windows](https://api.kde.org/kwin-effect.html)
2. [KWin Effects guide — QML effects and fullscreen scene behavior](https://develop.kde.org/docs/plasma/kwineffect/)
3. [KWin Effect API members — current paint and pointer callbacks](https://api.kde.org/kwin-effect-members.html)
4. [Electron Offscreen Rendering](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)
5. [Electron WebContents API — `paint` and shared texture handling](https://www.electronjs.org/docs/latest/api/web-contents#event-paint)
6. [Electron BrowserWindow API — Wayland limitations](https://www.electronjs.org/docs/latest/api/browser-window)
7. [wlr-layer-shell protocol — overlay layer and input regions](https://wayland.app/protocols/wlr-layer-shell-unstable-v1)
8. [KWin Effects distribution/build guide](https://develop.kde.org/docs/plasma/kwineffect/)
