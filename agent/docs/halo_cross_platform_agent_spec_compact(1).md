# Halo-Style Cross-Platform Desktop Island
## Agent Build Specification
### Electron + TypeScript + React
> PURPOSE: Build a production-grade Halo / Dynamic-Island-style desktop overlay that feels native, remains smooth under load, works across macOS / Windows / Linux, and degrades honestly where platform APIs cannot provide equivalent behavior.
> IMPORTANT RESEARCH CAVEAT:
> This spec describes observable Halo UX plus verified platform/architecture techniques. Do NOT claim Halo internally uses Electron, React, SwiftUI, or any specific implementation unless its source proves it. The implementation below is our recommended architecture for reproducing the behavior reliably.
---
# 0. NON-NEGOTIABLE PRODUCT TARGET
```yaml
product:
  goal: "system-like glanceable desktop island"
  primary_feeling:
    - attached_to_screen_top
    - unobtrusive_when_idle
    - intentional_when_opened
    - physically_smooth
    - visually_stable
    - fast
    - reliable
  must_work:
    - macOS
    - Windows
    - Linux_X11
  must_handle:
    - Linux_native_Wayland_limitations
    - multiple_displays
    - DPI_scaling
    - display_hotplug
    - resolution_change
    - sleep_wake
    - lock_unlock
    - fullscreen
    - macOS_Spaces
    - macOS_Mission_Control
    - macOS_Stage_Manager
    - renderer_reload
    - native_helper_failure
  design_priority:
    1: reliability
    2: interaction_quality
    3: animation_quality
    4: visual_polish
    5: feature_density
  hard_principle:
    native_window_is_desktop_integration_layer
    react_surface_is_visual_layer
    motion_is_animation_layer
    main_process_is_authority
    platform_adapter_owns_os_differences
```
---
# 1. CRITICAL ARCHITECTURE RULES
```yaml
architecture:
  native_window:
    role: "fixed transparent desktop canvas"
    animation:
      resize_native_window: FORBIDDEN
      setBounds_per_frame: FORBIDDEN
      setSize_per_frame: FORBIDDEN
  renderer:
    role: "draw and animate island inside fixed canvas"
    ownership:
      - React_visual_state
      - Motion_animation
      - activity_components
      - pointer_interaction
    forbidden:
      - direct_Electron_APIs
      - direct_screen_geometry
      - direct_BrowserWindow_access
      - React_state_as_60hz_clock
  main_process:
    authority:
      - activity_router
      - display_selection
      - display_geometry
      - native_window
      - hover_policy
      - platform_capabilities
      - IPC_validation
      - persistent_activity_state
  platform:
    abstraction_required: true
    adapters:
      - macOS
      - Windows
      - Linux_X11
      - Linux_Wayland_capability/fallback
  animation:
    engine: Motion
    preferred_properties:
      - transform
      - opacity
    avoid_in_hot_path:
      - layout
      - width
      - height
      - margin
      - padding
      - animated_box_shadow
      - animated_backdrop_filter
      - forced_reflow
```
---
# 2. RECOMMENDED PROJECT STRUCTURE
```text
src/
  main/
    overlay/
      OverlayService.ts
      OverlayController.ts
      OverlayStateMachine.ts
      ActivityStore.ts
      ActivityRouter.ts
      WindowManager.ts
      DisplayManager.ts
      GeometryManager.ts
      HoverController.ts
      OverlayIPC.ts
      types.ts
    platform/
      PlatformAdapter.ts
      MacOSPlatformAdapter.ts
      WindowsPlatformAdapter.ts
      LinuxPlatformAdapter.ts
      WaylandCapabilityAdapter.ts
    native/
      MacGeometryProvider.ts
    display/
      DisplayIdentity.ts
      DisplaySelection.ts
      DisplayGeometry.ts
  preload/
    overlayPreload.ts
    overlayTypes.ts
  renderer/
    overlay/
      OverlayRoot.tsx
      IslandSurface.tsx
      CompactSurface.tsx
      ExpandedSurface.tsx
      ActivityRenderer.tsx
      activities/
        MusicActivity.tsx
        TimerActivity.tsx
        AIUsageActivity.tsx
        HudActivity.tsx
        DownloadActivity.tsx
        ScreenshotActivity.tsx
        BatteryActivity.tsx
        LiveActivity.tsx
      motion/
        motionTokens.ts
        transitions.ts
        layoutIds.ts
      hooks/
        useOverlayState.ts
        useReducedMotion.ts
        useHighFrequencyValue.ts
      styles/
        tokens.css
        island.css
        activities.css
  native/
    macos/
      MacGeometryHelper.swift
```
---
# 3. TYPESCRIPT DOMAIN MODEL
## 3.1 Platform
```ts
export type DesktopPlatform =
  | "darwin"
  | "win32"
  | "linux";
export type LinuxSession =
  | "x11"
  | "wayland"
  | "unknown";
export interface PlatformCapabilities {
  fixedScreenPosition: boolean;
  nativeAlwaysOnTop: boolean;
  cursorScreenPoint: boolean;
  clickThrough: boolean;
  clickThroughForwarding: boolean;
  notchGeometry: boolean;
  allSpaces: boolean;
  fullscreenOverlay: boolean;
  nativeWaylandLayerShell: boolean;
}
```
## 3.2 Geometry
```ts
export type OverlayEdge = "top" | "left" | "right";
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface IslandGeometry {
  displayId: number;
  displayBounds: Rect;
  workArea: Rect;
  scaleFactor: number;
  canvas: Rect;
  edge: OverlayEdge;
  notch: {
    hasNotch: boolean;
    width: number;
    height: number;
    left: number;
    right: number;
    source: "appkit" | "fallback" | "none";
  };
  compactSize: Size;
  expandedSize: Size;
  hotZone: Rect;
}
```
## 3.3 State
```ts
export type IslandPhase =
  | "hidden"
  | "compact"
  | "opening"
  | "expanded"
  | "closing";
export type InteractionMode =
  | "passive"
  | "hover"
  | "interactive"
  | "pinned";
export interface IslandState {
  phase: IslandPhase;
  interaction: InteractionMode;
  activeActivityId: string | null;
  queuedActivityIds: string[];
  pinned: boolean;
  displayId: number | null;
  edge: OverlayEdge;
  reducedMotion: boolean;
  geometry: IslandGeometry | null;
  capabilities: PlatformCapabilities;
}
```
---
# 4. ACTIVITY MODEL
Every thing the island displays is an activity.
```ts
export type ActivityKind =
  | "nowPlaying"
  | "timer"
  | "liveActivity"
  | "hud"
  | "download"
  | "screenshot"
  | "battery"
  | "aiUsage"
  | "clipboard"
  | "fileShelf"
  | "day"
  | "custom";
export interface IslandActivity {
  id: string;
  kind: ActivityKind;
  priority: number;
  persistent: boolean;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  replaceGroup?: string;
  minimumDisplayMs?: number;
  compact: unknown;
  expanded: unknown;
}
```
Rules:
```yaml
activity:
  stable_id: REQUIRED
  priority: REQUIRED
  persistent: REQUIRED
  transient_expiry: REQUIRED_for_transient_items
  replacement:
    same_replaceGroup: replace_previous
    examples:
      - volume
      - brightness
      - download_progress
      - timer
      - music_position
      - ai_usage
  queue:
    max_transient: 3
    never_drop:
      - pinned_activity
      - active_user_interaction
    lower_priority_items_may_be_dropped: true
```
Do NOT generate a new activity ID every update for the same logical activity.
Correct:
```text
timer-2026-10-04-focus
```
Incorrect:
```text
new_random_UUID_every_second
```
Stable IDs are required for continuity and `layoutId` transitions.
---
# 5. ACTIVITY PRIORITY
Initial values:
```yaml
priority:
  pinned_user_interaction: 1000
  critical_error: 900
  direct_user_feedback: 800
  system_hud: 700
  active_timer: 600
  now_playing: 500
  live_activity: 450
  ai_usage: 400
  download_screenshot: 300
  battery: 200
  informational: 100
```
These values are policy defaults, not immutable truths.
The router must be configurable.
---
# 6. ACTIVITY ROUTER
```ts
export interface ActivityRouter {
  publish(activity: IslandActivity): void;
  remove(activityId: string): void;
  getCurrent(): IslandActivity | null;
  getQueue(): readonly IslandActivity[];
  clearExpired(now: number): void;
}
```
Routing rules:
```yaml
router:
  higher_priority_can_replace_lower_priority: true
  same_replaceGroup_replaces: true
  pinned_blocks_auto_collapse: true
  active_direct_interaction_blocks_interruptions: true
  expired_transient_items_removed: true
  queue_bounded: true
  persistent_items_not_treated_as_toasts: true
```
Rapid activity sequence:
```text
Volume 52
Volume 53
Volume 54
Volume 55
```
must remain one logical activity, not four queued notifications.
---
# 7. STATE MACHINE
```text
hidden
  ↓
compact
  ↓
opening
  ↓
expanded
  ↓
closing
  ↓
compact
```
Rules:
```yaml
state_machine:
  hidden_to_compact:
    trigger: "overlay_initialized_or_activity_requires_presence"
  compact_to_opening:
    trigger:
      - hover_intent_confirmed
      - compact_click
      - explicit_open_request
  opening_to_expanded:
    trigger: "animation_reaches_target"
  expanded_to_closing:
    trigger:
      - cursor_left_with_grace_elapsed
      - unpin_and_close
      - Escape
      - outside_click
  opening_interruption:
    supported: true
    behavior: "retarget_current_animation"
  closing_interruption:
    supported: true
    behavior: "retarget_current_animation"
  contradictory_intent:
    behavior: "cancel_pending_transition"
```
Do NOT implement state with independent booleans that can become contradictory.
Avoid:
```ts
isOpen
isExpanded
isHovered
isAnimating
isPinned
```
as unrelated truth sources.
---
# 8. ELECTRON WINDOW
Recommended baseline:
```ts
const win = new BrowserWindow({
  width: canvasWidth,
  height: canvasHeight,
  x: initialX,
  y: initialY,
  frame: false,
  transparent: true,
  backgroundColor: "#00000000",
  resizable: false,
  movable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  hasShadow: false,
  skipTaskbar: true,
  show: false,
  focusable: false,
  webPreferences: {
    preload,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
});
```
Required security posture:
```yaml
security:
  contextIsolation: true
  nodeIntegration: false
  sandbox: true
  preload_only_bridge: true
  renderer_authority: false
```
---
# 9. FIXED CANVAS
Start with:
```yaml
canvas:
  max_width: 760
  max_height: 460
  recommended_min_width: 360
  recommended_min_height: 120
```
Actual values should be clamped to the selected display.
Example:
```ts
const width = Math.min(
  MAX_CANVAS_WIDTH,
  Math.max(MIN_CANVAS_WIDTH, display.bounds.width - 24)
);
```
The native canvas may resize when display topology changes.
The native canvas MUST NOT resize as part of compact ↔ expanded animation.
---
# 10. WHY FIXED CANVAS IS REQUIRED
BAD:
```text
compact
→ BrowserWindow.setSize(...)
→ wait
→ BrowserWindow.setSize(...)
→ reposition
→ renderer layout
→ repaint
```
GOOD:
```text
BrowserWindow remains fixed
        ↓
React surface layout changes
        ↓
Motion interpolates layout
        ↓
Chromium compositor handles transform/opacity
```
Native window mutation belongs to desktop geometry management, not animation.
---
# 11. NATIVE WINDOW RESIZE ALLOWLIST
Native `setBounds` / `setSize` may happen only for:
```yaml
allow_native_resize:
  - display_added
  - display_removed
  - display_metrics_changed
  - resolution_change
  - scale_factor_change
  - orientation_change
  - canvas_configuration_change
  - user_changed_overlay_size_setting
```
Forbidden:
```yaml
forbidden:
  - animation_frame
  - pointermove
  - hover_frame
  - spring_update
  - timer_tick
  - music_position_update
```
---
# 12. TRANSPARENT WINDOW + CSS HIT TESTING
Use two hit-testing layers.
Native layer:
```ts
win.setIgnoreMouseEvents(true, { forward: true });
```
while passive/collapsed.
Renderer layer:
```css
.overlay-root {
  pointer-events: none;
}
.island-surface {
  pointer-events: auto;
}
```
The invisible canvas must not become an accidental interaction region.
---
# 13. CLICK-THROUGH INTERACTION
Collapsed:
```yaml
native_click_through: true
forward_mouse_events: true
focusable: false
```
Expanded:
```yaml
native_click_through: false
focusable: true_only_if_keyboard_input_needed
```
On collapse:
```ts
win.setIgnoreMouseEvents(true, { forward: true });
```
On interaction:
```ts
win.setIgnoreMouseEvents(false);
```
Do not make the overlay permanently intercept desktop clicks.
---
# 14. FOCUS RULES
Default:
```yaml
collapsed:
  focusable: false
expanded:
  focusable: true_if_needed
```
Showing the island must not steal focus.
Prefer:
```ts
win.showInactive();
```
on macOS and equivalent non-activating behavior on other platforms where available.
Forbidden:
```ts
win.focus();
```
on ordinary notification appearance.
The user may be typing in:
```text
VS Code
terminal
browser
IDE
game
editor
```
and the island must not steal keyboard focus merely because it appeared.
---
# 15. MACOS PLATFORM ADAPTER
```ts
export interface MacOSPlatformAdapter extends OverlayPlatformAdapter {
  getMacDisplayGeometry(): Promise<MacDisplayGeometry[]>;
}
```
BrowserWindow settings:
```yaml
macos:
  window:
    type: panel
    always_on_top_level: screen-saver
    all_spaces: true
    visible_on_fullscreen: true
    enableLargerThanScreen: true
    focusable_initially: false
    hasShadow: false
```
Use:
```ts
win.setAlwaysOnTop(true, "screen-saver", 1);
win.setVisibleOnAllWorkspaces(true, {
  visibleOnFullScreen: true
});
```
Show with:
```ts
win.showInactive();
```
Do not use unnecessarily aggressive window levels.
---
# 16. MACOS TOP POSITIONING
The overlay should originate from:
```ts
y = display.bounds.y;
```
not:
```ts
y = display.workArea.y;
```
Reason:
```yaml
bounds:
  meaning: full display geometry
workArea:
  meaning: area available after system UI reservations
overlay:
  intentionally occupies_top_system_region: true
```
The macOS native window must be constructed/configured so AppKit does not push it below the menu bar.
Use:
```ts
enableLargerThanScreen: true
```
where required by this architecture.
---
# 17. MACOS NOTCH MEASUREMENT
Primary measurement source:
```text
NSScreen.safeAreaInsets
NSScreen.auxiliaryTopLeftArea
NSScreen.auxiliaryTopRightArea
```
Electron does not expose these exact AppKit properties directly.
Therefore create:
```text
MacGeometryHelper.swift
```
The helper must inspect the relevant `NSScreen` objects.
Conceptual:
```swift
for screen in NSScreen.screens {
    let left = screen.auxiliaryTopLeftArea
    let right = screen.auxiliaryTopRightArea
    let widthGap =
        screen.frame.width
        - left.width
        - right.width
    let positionGap =
        right.minX
        - left.maxX
    let notchWidth = min(widthGap, positionGap)
}
```
Use `safeAreaInsets.top` for notch/top obstruction height when available.
Do not use Mac model-number detection as the primary width measurement.
---
# 18. MACOS NOTCH HEIGHT FALLBACK
Priority:
```yaml
notch_height:
  1: safeAreaInsets.top
  2: frame.maxY - visibleFrame.maxY
  3: calibrated_fallback
```
Reject clearly invalid values.
Example reasonable range check:
```text
24pt <= measured_top <= 32pt
```
for common current notch configurations, but keep the implementation tunable rather than assuming every future model has identical geometry.
---
# 19. NOTCH MEASUREMENT RESULT
Recommended contract:
```json
{
  "screens": [
    {
      "frameWidth": 3024,
      "frameHeight": 1964,
      "safeTop": 30,
      "leftAuxWidth": 1390,
      "rightAuxWidth": 1390,
      "notchWidth": 244,
      "hasNotch": true
    }
  ]
}
```
Return only geometry that Electron cannot reliably obtain itself or that is required for calibration.
Electron remains authoritative for:
```text
display.id
display.bounds
display.workArea
display.scaleFactor
display selection
```
---
# 20. MACOS NOTCH CACHE
```yaml
cache:
  cache_success: true
  cache_failure: false
  invalidation:
    - display_metrics_changed
    - display_added
    - display_removed
    - wake
    - unlock
  key_should_include:
    - display_identity_if_available
    - width
    - height
    - scale_factor
```
Critical rule:
```text
Do NOT permanently cache "no notch" because a transient AppKit query failed.
```
A dock/undock transition can temporarily return incomplete geometry.
---
# 21. ASYNC MAC GEOMETRY
Correct:
```text
create overlay using fallback geometry
    ↓
show/use overlay
    ↓
measure AppKit asynchronously
    ↓
update geometry if measurement succeeds
```
Forbidden startup sequence:
```text
await helper forever
    ↓
only then create/show overlay
```
The helper is a refinement step, not a startup dependency.
---
# 22. MACOS HELPER EXECUTION
Use:
```ts
execFile(...)
```
not shell interpolation.
Requirements:
```yaml
helper:
  asynchronous: true
  timeout_ms: 4000
  executable: "packaged Swift helper"
  shell_interpolation: false
  failure:
    - log_diagnostic
    - keep_overlay_alive
    - use_fallback_geometry
    - retry_on_geometry_event
```
Do not crash Electron if the helper fails.
---
# 23. MACOS HELPER PACKAGING
The packaged application must contain the helper correctly inside the app bundle/resources.
Verify:
```yaml
packaging:
  - helper_exists_after_packaging
  - helper_executable_bit
  - architecture_matches_supported_macos_targets
  - code_signed
  - notarization_compatible
```
Test both:
```text
development
packaged
signed
notarized
```
because a helper working in development but failing from the signed app bundle is a release blocker.
---
# 24. MACOS DISPLAY EVENTS
Subscribe to:
```ts
screen.on("display-added", scheduleReconcile);
screen.on("display-removed", scheduleReconcile);
screen.on("display-metrics-changed", scheduleReconcile);
```
Also reconcile after:
```text
powerMonitor resume
powerMonitor unlock-screen
```
---
# 25. DISPLAY RECONCILIATION
Create exactly one central:
```ts
reconcileDisplays()
```
responsible for placement changes.
Pseudo-flow:
```text
read current displays
    ↓
resolve target display
    ↓
calculate geometry
    ↓
measure/refine notch if macOS
    ↓
validate generation
    ↓
resize/reposition native canvas if topology changed
    ↓
send geometry snapshot to renderer
```
No other component should independently call:
```text
setPosition
setBounds
setSize
```
for display placement.
---
# 26. DISPLAY EVENT DEBOUNCE
Use:
```yaml
display_reconciliation:
  initial_debounce_ms: 100
  stabilization_retry_ms: 1000
```
Reason:
```text
USB-C dock
→ multiple events
→ transient metrics
→ final metrics
```
Avoid five sequential native moves.
---
# 27. ASYNC GENERATION GUARD
Required:
```ts
let geometryGeneration = 0;
async function refreshGeometry() {
  const generation = ++geometryGeneration;
  const measured = await measure();
  if (generation !== geometryGeneration) {
    return;
  }
  apply(measured);
}
```
Prevents:
```text
old measurement
→ completes after new measurement
→ overwrites correct geometry
```
---
# 28. DISPLAY TARGETING
Recommended default:
```yaml
display_target:
  default: primary
```
Support optionally:
```ts
type DisplayTarget =
  | { type: "primary" }
  | { type: "display"; displayId: number }
  | { type: "cursor" };
```
If saved display disappears:
```text
saved display
→ no longer exists
→ fallback to primary
```
Never leave overlay logically attached to a disconnected display.
---
# 29. COORDINATE SYSTEM
Use Electron display coordinates in DIP/logical coordinates throughout main-process geometry calculations.
Do not mix:
```text
physical_pixels
AppKit_points
Electron_DIP
CSS_pixels
```
implicitly.
Prefer explicit types:
```ts
type Dip = number;
type CssPx = number;
type AppKitPoint = number;
```
when conversion boundaries matter.
---
# 30. MULTI-MONITOR GEOMETRY TESTS
Must support:
```yaml
monitor_layouts:
  - secondary_right
  - secondary_left
  - secondary_above
  - secondary_below
  - negative_x
  - negative_y
  - mixed_DPI
  - mirrored
  - rotated
```
Never assume primary display starts at `(0,0)`.
---
# 31. WINDOWS ADAPTER
Recommended BrowserWindow baseline:
```yaml
windows:
  frame: false
  transparent: true
  always_on_top: true
  skip_taskbar: true
  focusable: false_when_idle
  has_shadow: false
```
Use the least aggressive topmost level that consistently produces the desired HUD.
Do not blindly copy macOS `"screen-saver"` semantics to Windows.
---
# 32. WINDOWS DPI
Treat Electron display bounds as DIP/logical coordinates.
Do not compute:
```text
CSS_px = physical_px
```
as a universal rule.
Display geometry must remain consistent under:
```text
100%
125%
150%
175%
200%
```
and mixed-DPI multi-monitor configurations.
---
# 33. WINDOWS TASKBAR EDGE CASES
The island is normally top-centered, so taskbar placement should not directly affect its anchor.
Still test:
```text
taskbar_bottom
taskbar_top
taskbar_left
taskbar_right
auto_hide
```
No assumption should depend on the taskbar being at the bottom.
---
# 34. WINDOWS FULLSCREEN
Define an explicit policy:
```ts
type FullscreenPolicy =
  | "show"
  | "hide"
  | "hide-temporary";
```
Do not assume a universal Electron event can perfectly identify every application's fullscreen state.
Treat fullscreen visibility as platform capability.
---
# 35. LINUX X11
Primary Linux implementation target:
```yaml
linux_x11:
  support: true
  strategy:
    - fixed transparent Electron window
    - always-on-top
    - global cursor coordinates
    - click-through
    - display geometry manager
```
Keep the same renderer and animation implementation.
---
# 36. LINUX WAYLAND
CRITICAL:
```yaml
native_wayland:
  equivalent_generic_electron_overlay: NOT_GUARANTEED
```
Electron documents important Wayland restrictions involving:
```text
programmatic window position
always-on-top behavior
screen cursor position
```
Therefore:
```text
Linux != X11
```
and:
```text
"works on Linux"
```
must not mean:
```text
"identical window-manager semantics on every Wayland compositor"
```
---
# 37. WAYLAND STRATEGY
Use capability detection.
```yaml
wayland:
  tier_A:
    condition: "native compositor/backend provides required semantics"
    action: "use supported native path"
  tier_B:
    condition: "XWayland is available and compatibility mode explicitly enabled"
    action: "run overlay against X11 semantics"
  tier_C:
    condition: "native Wayland cannot provide reliable overlay positioning"
    action:
      - fallback_to_system_notification
      - or_in_app_surface
```
Never leave a visibly broken overlay active merely to claim feature parity.
---
# 38. FUTURE WAYLAND LAYER-SHELL
Future backend:
```text
wlr-layer-shell
```
Potential capabilities:
```text
top/left/right anchors
margins
exclusive zones
keyboard interaction mode
pointer input region
```
But:
```yaml
first_release:
  native_layer_shell_renderer: false
```
Do not make this a first-release requirement because integrating Chromium/Electron rendering into a native layer-shell surface adds significant complexity.
---
# 39. WAYLAND FALLBACK UX
Fallback must be explicit and quiet.
Options:
```text
native OS notification
in-app floating surface
tray/status indicator
```
Do not show:
```text
mispositioned island
offscreen island
unresponsive invisible hitbox
```
---
# 40. FIXED REACT CANVAS
Renderer root:
```css
.overlay-root {
  position: fixed;
  inset: 0;
  background: transparent;
  pointer-events: none;
  overflow: visible;
}
.island-surface {
  position: absolute;
  pointer-events: auto;
  isolation: isolate;
}
```
The root is transparent.
Only the actual island surface gets a visible background.
---
# 41. REACT RESPONSIBILITY
React owns:
```yaml
react:
  owns:
    - semantic_UI
    - activity_rendering
    - animation_targets
    - local_interaction_state
    - keyboard_UI
    - visual_accessibility
  does_not_own:
    - BrowserWindow
    - display_selection
    - notch_measurement
    - native_window_position
    - OS_capabilities
    - process_lifecycle
```
---
# 42. PRELOAD BRIDGE
Expose narrow methods.
Example:
```ts
contextBridge.exposeInMainWorld("overlayBridge", {
  requestAction: (action) =>
    ipcRenderer.invoke("overlay:action", action),
  getSnapshot: () =>
    ipcRenderer.invoke("overlay:snapshot"),
  onState: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: SerializedOverlayState
    ) => listener(state);
    ipcRenderer.on("overlay:state", handler);
    return () => {
      ipcRenderer.removeListener("overlay:state", handler);
    };
  },
  onGeometry: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      geometry: IslandGeometry
    ) => listener(geometry);
    ipcRenderer.on("overlay:geometry", handler);
    return () => {
      ipcRenderer.removeListener("overlay:geometry", handler);
    };
  }
});
```
Do not expose raw `ipcRenderer`.
---
# 43. IPC VALIDATION
Runtime-validate action payloads.
Example:
```ts
const overlayActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("playPause")
  }),
  z.object({
    type: z.literal("seek"),
    seconds: z.number().finite()
  }),
  z.object({
    type: z.literal("open"),
    target: z.enum([
      "settings",
      "source",
      "file",
      "application"
    ])
  })
]);
```
Main process validates before acting.
Renderer is not authoritative.
---
# 44. SNAPSHOT + INCREMENTAL UPDATE MODEL
On renderer load:
```text
full authoritative snapshot
```
During operation:
```text
incremental updates
```
If renderer reloads:
```text
did-finish-load
→ send current geometry
→ send current overlay snapshot
```
Do not require upstream services to replay historical activity events.
---
# 45. RENDERER CRASH RECOVERY
Required behavior:
```yaml
renderer_reload:
  - restore_current_state
  - restore_current_geometry
  - restore_current_activity
  - restore_visual_phase_appropriately
initial_visual_phase:
  if_snapshot_already_expanded: "paint expanded state directly"
  if_snapshot_compact: "paint compact directly"
```
Do not replay a full historical opening animation merely because the renderer restarted.
---
# 46. HOVER ARCHITECTURE
Main process owns hover intent.
Reason:
```text
click-through_window
→ cannot reliably depend on normal renderer mouseleave
```
Use:
```ts
screen.getCursorScreenPoint()
```
where supported.
Polling should answer:
```text
is cursor in hot zone?
is cursor inside active island?
has leave grace elapsed?
```
---
# 47. HOVER POLL RATES
Recommended starting values:
```yaml
hover_poll:
  idle_ms: 120
  expanded_ms: 40
```
Why:
```text
idle:
  120ms is sufficient for intentional hover detection
expanded:
  40ms gives responsive leave detection without frame-rate polling
```
Do not poll at:
```text
1ms
5ms
8ms
16ms
```
unless profiling proves it necessary.
Hover detection is not an animation clock.
---
# 48. HOVER DELAYS
Recommended:
```yaml
hover:
  open_delay_ms: 110
  close_delay_ms: 280
  leave_margin_px: 24
```
Optional:
```yaml
crossing_filter:
  cursor_must_remain_in_zone: true
  cancel_open_if_cursor_exits_before_delay: true
```
---
# 49. HOT ZONE
Do not use the entire native canvas.
```ts
interface HotZone {
  x: number;
  y: number;
  width: number;
  height: number;
}
```
Notched Mac:
```text
hotZone = notch + small strip below it
```
Notchless:
```text
hotZone = compact visible pill
```
The transparent 760×460 canvas must not itself be a giant hover trigger.
---
# 50. HOVER STATE ALGORITHM
```ts
interface HoverState {
  hovered: boolean;
  outsideSince: number;
}
```
Behavior:
```yaml
hover:
  cursor_inside:
    hovered: true
    outsideSince: 0
  cursor_outside_pinned:
    hovered: true
    outsideSince: 0
  first_cursor_exit:
    outsideSince: now
    hovered: true
  now_minus_outsideSince >= closeDelay:
    hovered: false
```
An intent already waiting for open/close must be canceled if the cursor contradicts it.
---
# 51. PINNING
Recommended interaction model:
```text
hover compact
→ temporary expanded
click compact
→ expanded + pinned
click outside
→ unpin + collapse
Escape
→ unpin + collapse
```
Pinning overrides ordinary cursor-based collapse.
---
# 52. CLICK VS DRAG
Use slop:
```ts
const DRAG_SLOP = 6;
```
Interpretation:
```text
movement <= 6px → click
movement > 6px → drag
```
This avoids accidental drag classification caused by natural hand movement.
---
# 53. POINTER CAPTURE
For genuine drag interactions:
```ts
element.setPointerCapture(event.pointerId);
```
On pointer release:
```ts
element.releasePointerCapture(event.pointerId);
```
Do not lose control because the cursor briefly crosses an inner child or nearby transparent region.
---
# 54. ESCAPE
Expanded interactive island:
```text
Escape → collapse
```
Do not require mouse movement to close a keyboard-accessible surface.
---
# 55. MOTION LIBRARY
Use current Motion for React.
```ts
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform
} from "motion/react";
```
Use Motion for:
```text
layout transition
shared elements
springs
opacity
transform
interruptible motion
MotionValue-driven values
```
---
# 56. MOTION ARCHITECTURE
```text
Native BrowserWindow
    static
        ↓
React fixed canvas
    static geometry
        ↓
Motion island surface
    compact ↔ expanded
        ↓
Motion content
    opacity / transform / shared identity
```
---
# 57. SURFACE ANIMATION
Outer surface:
```tsx
<motion.div layout className="island-surface">
  ...
</motion.div>
```
The renderer should express:
```text
compact layout
expanded layout
```
and allow Motion to interpolate.
Do not manually calculate every intermediate width/height frame.
---
# 58. CHILD LAYOUT ANIMATION
Use `layout` selectively on major nested elements:
```text
outer surface
major content column
important artwork
important controls
```
Do not place `layout` on every DOM node.
Too much automatic measurement adds unnecessary complexity.
---
# 59. SHARED ELEMENT IDs
Use stable identities:
```tsx
layoutId={`activity-${activity.id}`}
```
or:
```tsx
layoutId={`artwork-${activity.id}`}
```
for things whose visual identity should persist during transitions.
Good candidates:
```text
artwork
provider_logo
main_icon
timer_indicator
progress_object
```
---
# 60. ASPECT RATIO
For images/artwork whose aspect ratio must remain stable:
```tsx
layout="position"
```
may be preferable to full layout scaling.
Do not allow layout animation to distort cover art.
---
# 61. BORDERS
Do not rely on animating a real border around a transform-scaled layout if it visibly distorts.
Preferred:
```text
outer shell
  padding: 1px
  border color
inner shell
  actual surface
```
This keeps the visual border more stable during transform-based layout animation.
---
# 62. TRANSFORM ORIGIN
Top edge:
```css
transform-origin: top center;
```
Left edge:
```css
transform-origin: left center;
```
Right edge:
```css
transform-origin: right center;
```
The expansion anchor is part of the perceived physical behavior.
---
# 63. TOP-EDGE EXPANSION
For top-centered island:
```text
top edge remains visually fixed
bottom edge expands downward
```
Avoid vertical center expansion that moves both top and bottom.
Correct perception:
```text
"the island grew downward from the menu bar"
```
Incorrect perception:
```text
"a popup appeared around the cursor"
```
---
# 64. SPRING STARTING POINTS
Use these only as tuning defaults:
```ts
export const surfaceOpen = {
  type: "spring",
  stiffness: 480,
  damping: 36,
  mass: 0.65
};
export const surfaceClose = {
  type: "spring",
  stiffness: 540,
  damping: 42,
  mass: 0.60
};
```
These constants are NOT claimed to be Apple's values.
Tune visually and measure performance.
---
# 65. MOTION TIMING TARGETS
```yaml
animation:
  open:
    target_ms: 280-350
    character: "controlled with slight elasticity"
  close:
    target_ms: 220-280
    character: "quicker, quieter"
  content_enter:
    target_ms: 120-170
  content_exit:
    target_ms: 90-120
  button_press:
    target_ms: 50-90
```
Do not over-bounce.
Target feeling:
```text
precise
dense
heavy
controlled
```
not:
```text
toy
boing
notification_bubble
```
---
# 66. INTERRUPTIBLE ANIMATION
Required.
Example:
```text
opening
→ cursor leaves
→ close immediately retargets from current state
```
NOT:
```text
finish opening
→ wait
→ close
```
Do not use independent timeout chains to sequence animation states.
---
# 67. FORBIDDEN ANIMATION IMPLEMENTATION
Reject:
```ts
setTimeout(() => {
  win.setSize(...)
}, 16);
```
Reject:
```ts
requestAnimationFrame(() => {
  setState(progress);
});
```
if it drives the whole UI.
Reject:
```ts
pointermove
→ BrowserWindow.setBounds()
```
Reject:
```ts
setTimeout(open, 100);
setTimeout(showContent, 300);
setTimeout(close, 1500);
```
for visual sequencing.
Animation should be declarative and interruptible.
---
# 68. CONTENT CHOREOGRAPHY
Open:
```yaml
open_sequence:
  t0:
    - surface_begins_expanding
  t40:
    - primary_content_fades_in
  t80:
    - artwork_or_primary_icon_settles
  t120:
    - secondary_controls_appear
  t250:
    - surface_finishes_settling
```
These are approximate choreography targets.
Do not hard-sync every child to exactly the same start time.
---
# 69. COLLAPSE CHOREOGRAPHY
```yaml
close_sequence:
  t0:
    - secondary_content_fades
  t70:
    - primary_content_remains
  t90:
    - surface_contracts
  t220:
    - surface_settles
```
The island should not visually crush opaque controls as its shape shrinks.
---
# 70. CONTENT SWAP
When activity changes while already expanded:
Preferred:
```text
expanded A
→ content morph/crossfade
→ expanded B
```
Avoid:
```text
collapse
→ reopen
```
for every activity replacement.
Repeated close/open behavior feels nervous.
---
# 71. STABLE OUTER IDENTITY
The shell should remain stable while content changes.
Think:
```text
consistent shell
+
changing activity
```
not:
```text
new popup for every event
```
---
# 72. COMPACT STATE
Compact content must be glanceable.
Examples:
```yaml
music:
  - artwork
  - tiny playback/status indication
timer:
  - timer_icon
  - remaining_time
download:
  - download_icon
  - short_status
ai_usage:
  - provider_logo
  - concise_usage
```
Do not shrink the entire expanded dashboard into compact mode.
---
# 73. EXPANDED STATE
Expanded panels should reveal:
```text
primary_information
secondary_information
action_controls
```
Recommended width classes:
```yaml
expanded_widths:
  sm: 360
  md: 460
  lg: 520
```
Clamp to display width:
```ts
Math.min(520, display.bounds.width - 24)
```
---
# 74. SPACING SYSTEM
Use an 8pt-based system with 4pt micro increments:
```yaml
spacing:
  - 4
  - 8
  - 12
  - 16
  - 20
  - 24
  - 32
  - 40
  - 48
```
Do not use random spacing values unless optical correction is intentional.
---
# 75. RADII
Starting tokens:
```css
:root {
  --radius-compact: 999px;
  --radius-expanded: 24px;
  --radius-card: 18px;
  --radius-control: 10px;
}
```
Tune per visual design.
---
# 76. COLORS
Starting shell tokens:
```css
:root {
  --island-bg: rgba(5, 5, 7, 0.985);
  --text-primary: rgba(255, 255, 255, 0.96);
  --text-secondary: rgba(255, 255, 255, 0.62);
  --text-muted: rgba(255, 255, 255, 0.40);
  --divider: rgba(255, 255, 255, 0.08);
}
```
Keep shell neutral.
Use semantic accent color selectively:
```yaml
semantic:
  success: green
  warning: amber
  error: red
  info: blue
```
Do not make the entire shell neon for ordinary states.
---
# 77. SURFACE STYLE
Prefer:
```css
background: rgba(5, 5, 7, 0.985);
```
plus a subtle highlight if needed.
Avoid making correctness depend on:
```css
backdrop-filter: blur(...);
```
because cross-application compositor blur is not a reliable primitive for this architecture.
Do not build the product around glass blur.
---
# 78. SHADOW
Use a static subtle shadow.
Do not continuously animate shadow blur/radius.
Preferred:
```css
box-shadow:
  0 12px 36px rgba(0, 0, 0, 0.32);
```
If visibility must animate:
```text
fade shadow opacity
```
rather than rapidly changing blur geometry.
---
# 79. GLOW
Glow should be sparse.
Use for:
```text
critical state
recording
active audio
AI activity
explicit attention
```
Do not keep a giant glow on the idle shell.
---
# 80. TYPOGRAPHY
Use system-first stack:
```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "Segoe UI",
  system-ui,
  sans-serif;
```
Do not assume SF Pro exists on Windows/Linux.
Never redistribute proprietary Apple fonts unless licensed.
Define explicit line heights.
Example:
```css
:root {
  --font-xs: 11px;
  --font-sm: 12px;
  --font-md: 14px;
  --font-lg: 16px;
  --font-xl: 20px;
  --font-hero: 28px;
  --line-xs: 14px;
  --line-sm: 16px;
  --line-md: 20px;
  --line-lg: 22px;
  --line-xl: 26px;
}
```
Avoid `line-height: normal` on critical alignment elements.
---
# 81. ICON SYSTEM
Use deterministic SVG icons.
Avoid depending on:
```text
emoji
icon_fonts
OS_specific_glyphs
```
for important UI meaning.
Recommended icon traits:
```yaml
stroke:
  width: 1.5-2
  linecap: round
  linejoin: round
```
unless a filled icon is intentional.
---
# 82. OPTICAL ICON SIZING
A `20×20` SVG does not necessarily have a `20×20` visible drawing.
Use an icon box plus optical drawing size.
Example:
```text
box = 24×24
drawing = ~18×18
```
Align by optical mass, not just SVG viewBox.
---
# 83. COMPACT HIT TARGETS
Visible icon:
```text
~16-20px
```
actual hit target:
```text
~32-40px
```
where appropriate.
Do not make the visible glyph itself the entire click area.
---
# 84. BUTTON FEEDBACK
Button default:
```text
opacity ~0.72
```
hover:
```text
opacity → 1
```
press:
```text
scale ~0.96
```
or subtle opacity shift.
Keep press response around:
```text
50-90ms
```
---
# 85. HOVER FEEDBACK
Do not bounce the entire island on ordinary hover.
Optional:
```text
scale 1.000 → 1.015
```
at most.
Hover should communicate presence, not demand attention.
---
# 86. NEVER ADD PERMANENT BREATHING
Do not keep an idle:
```text
scale 1.0 → 1.02 → 1.0
```
animation running continuously.
The island should become visually quiet when nothing needs attention.
---
# 87. ATTENTION ANIMATION
Bound attention animations.
Examples:
```text
critical warning
recording indicator
new direct-user event
```
Use:
```text
short pulse
brief color emphasis
small shake if appropriate
```
then settle.
Do not create perpetual motion.
---
# 88. TEXT HANDLING
Compact:
```yaml
single_line: true
ellipsis: true
```
Expanded:
```yaml
max_visible_title_lines: 2
```
Do not allow arbitrary long text to continuously resize compact geometry.
---
# 89. SCROLLING
Outer shell:
```text
no visible scrollbar
```
If content is too large:
```text
internal_scroll_region
```
only.
Use stable scrollbar geometry where needed:
```css
scrollbar-gutter: stable;
```
Do not allow scrollbars to shift the entire panel layout during animation.
---
# 90. MUSIC ACTIVITY
Recommended expanded layout:
```text
+--------------------------------------+
| [artwork]  Title                     |
|            Artist                    |
|                                      |
|  ─────────────────────────────       |
|  0:42                       3:21     |
|                                      |
|       previous  play  next            |
+--------------------------------------+
```
Optional:
```text
shuffle
repeat
source
```
Compact:
```text
artwork + playback state
```
---
# 91. MUSIC PERFORMANCE
Do not start image decoding at the exact moment the expansion begins.
Preload:
```ts
const img = new Image();
img.src = url;
await img.decode();
```
where practical.
Keep music state outside React:
```text
track
artist
position
duration
playbackState
```
Renderer only visualizes it.
---
# 92. MUSIC SEEKING
Pointer down:
```text
enter_local_drag_mode
```
Pointer move:
```text
update_local_motion_value
```
Pointer up:
```text
commit_seek_to_main_process
```
Do not necessarily send one IPC call per pointer movement.
Throttle native/application seek operations where appropriate.
The UI must remain local and responsive.
---
# 93. TIMER ACTIVITY
Timer state should use deadline/time authority.
Store:
```text
endTimestamp
duration
state
```
Do not use:
```ts
remaining -= 1;
```
as source of truth.
Render:
```ts
remaining = Math.max(0, endTimestamp - Date.now());
```
The UI may update once per 250-1000ms depending on precision requirements.
---
# 94. TIMER PROGRESS
Prefer:
```css
transform: scaleX(var(--progress));
transform-origin: left center;
```
or MotionValue.
Do not drive a full React tree at 60Hz merely to draw a progress bar.
---
# 95. AI USAGE ACTIVITY
Readable format:
```text
Claude Code
████████████████░░░░ 82%
resets in 4h 12m
```
or equivalent.
Do not expose raw backend jargon.
User should understand:
```text
what provider
how much used
when reset
```
in one glance.
---
# 96. HUD ACTIVITY
HUD is short-lived and compact.
Examples:
```text
volume:     icon + 58
brightness: icon + bar + 58
```
Use HUD expansion only when additional context/action is genuinely useful.
Do not show a giant dashboard for a one-off volume event.
---
# 97. DOWNLOAD / SCREENSHOT ACTIVITY
Prefer:
```text
icon + short message
```
Examples:
```text
Downloaded
Screenshot saved
Copied
```
Do not automatically open a large panel unless user interaction is needed.
---
# 98. BATTERY ACTIVITY
Compact:
```text
battery icon + percentage
```
Expanded when meaningful:
```text
percentage
power source
estimated state
```
Avoid making battery a constantly distracting activity.
---
# 99. LIVE ACTIVITY
For ongoing activity:
```text
compact status
→ expandable context
```
Use stable ID and replaceGroup.
Do not queue every state update as a new activity.
---
# 100. IMAGE / ARTWORK RULES
Avoid:
```text
large decode during animation
```
Preload where practical.
Avoid layout-induced distortion.
Use:
```text
object-fit: cover
```
for square artwork where intended.
Use stable dimensions during animation.
---
# 101. REACT HIGH-FREQUENCY RULE
Forbidden:
```ts
setState(...)
```
as the frame clock for:
```text
audio visualizer
timer progress
pointer position
continuous media position
spring position
```
Preferred:
```yaml
high_frequency_visuals:
  - MotionValue
  - CSS_animation
  - requestAnimationFrame_local_to_canvas
  - Canvas
```
---
# 102. MOTION VALUES
Example:
```ts
const progress = useMotionValue(0);
const scaleX = useTransform(
  progress,
  [0, 1],
  [0, 1]
);
```
Bind directly to the animated element.
Do not convert high-frequency MotionValues back into React state every frame.
---
# 103. AUDIO VISUALIZER
If needed:
```text
audio data
→ requestAnimationFrame
→ Canvas draw
```
React does not manage individual bars every frame.
Lifecycle:
```yaml
visible:
  visualizer_running: true
hidden:
  visualizer_running: false
```
Cancel `requestAnimationFrame` on cleanup.
---
# 104. TIMER RENDERING
Do not use:
```ts
setInterval(..., 16)
```
for timer display.
Use timestamps plus low-frequency render updates.
The timer must remain accurate even if the renderer is busy for a moment.
---
# 105. RESIZE OBSERVER
Use `ResizeObserver` for activity layout measurement if necessary.
But prevent feedback loops:
```text
size changes
→ observer
→ state
→ size changes
→ observer
```
Only publish size when it actually changed.
Do not run the observer as an animation-frame loop.
---
# 106. GEOMETRY OWNERSHIP
Geometry changes should come only from:
```yaml
geometry_change_sources:
  - display_topology
  - display_scale
  - resolution
  - activity_layout_change
  - user_calibration
```
The animation interpolation itself is not a new geometry source.
---
# 107. IPC COALESCING
External events should feed:
```text
ActivityStore
→ Router
```
not directly trigger arbitrary renderer calls.
Coalesce bursty updates.
Examples:
```text
volume
brightness
download progress
AI usage
music position
```
should not flood IPC unnecessarily.
---
# 108. SNAPSHOT BROADCAST
Recommended:
```text
full snapshot on renderer start
incremental updates during normal operation
```
A state update should contain only what the renderer needs.
Do not serialize massive unrelated application state.
---
# 109. SECURITY / CSP
Use a restrictive CSP.
Example starting point:
```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    media-src 'self' blob:;
    connect-src 'self';
  "
/>
```
Adjust only for genuine requirements.
Do not depend on remote JS/CSS for the shell.
---
# 110. NO REMOTE UI EXECUTION
The core overlay should be shipped locally.
Avoid:
```text
remote_script
remote_css
remote_html
```
for the actual shell.
Remote content creates:
```text
latency
security_risk
failure_modes
layout_instability
```
---
# 111. NAVIGATION RESTRICTION
The overlay renderer should not silently navigate away from its intended document.
Use Electron navigation/window-open controls appropriate to the app.
Do not permit arbitrary renderer-created windows.
---
# 112. PRIVACY / LOGGING
The island can display sensitive data.
Do NOT log in production:
```text
clipboard content
private filenames
message text
full media metadata
raw AI usage payloads
```
Log identifiers and diagnostics instead:
```text
activity_id
activity_kind
phase
display_id
geometry_source
platform
error_code
```
---
# 113. CONTENT PROTECTION
Optionally support a privacy preference using Electron content-protection APIs where the target platform supports them.
Treat it as:
```text
user-controlled privacy feature
```
not a universal guarantee.
---
# 114. DEEP IDLE
When no persistent activity exists and no transient activity is active:
```yaml
deep_idle:
  hide_native_window: optional
  keep_renderer_alive: preferred
  stop_visualizers: true
  stop_high_frequency_loops: true
```
Avoid destroy/recreate on every notification.
Warm renderer state improves responsiveness.
---
# 115. SHOW/HIDE STRATEGY
Preferred:
```text
create once
load once
keep alive
hide when deeply idle
showInactive when needed
```
Avoid:
```text
create BrowserWindow
→ load HTML
→ show
→ destroy
```
for every event.
---
# 116. FIRST FRAME
Before showing:
```text
renderer loaded
state available
background transparent
geometry valid
```
Avoid:
```text
white flash
uninitialized black rectangle
wrong location
empty panel
```
Use an initial invisible/transparent visual state where necessary.
---
# 117. PLATFORM-SPECIFIC FOCUS
When expanded and keyboard input is not needed:
```text
do not force focus
```
If text input is actually part of the surface:
```text
focus only after explicit user interaction
```
Never steal focus merely because hover occurred.
---
# 118. FULLSCREEN / SPACES / MISSION CONTROL
macOS:
```yaml
spaces:
  visible_on_all_spaces: true
fullscreen:
  visible_when_desired: true
mission_control:
  explicitly_test_collection_behavior: true
stage_manager:
  explicitly_test: true
```
Do not indiscriminately enable every AppKit collection behavior.
Some behaviors interact or are mutually exclusive.
---
# 119. SLEEP / WAKE
On resume:
```text
reconcile displays
remeasure geometry
reposition native window
send geometry
refresh state
reset hover transient state
```
Do not assume prior coordinates remain valid.
---
# 120. LOCK / UNLOCK
On unlock:
```text
reconcile geometry
reset hover state
```
If cursor happens to remain over prior hot zone, do not unexpectedly open unless the user genuinely re-enters/holds intent.
---
# 121. MENU BAR AUTO-HIDE / TOPOLOGY EDGE CASE
Do not use simple menu-bar-height heuristics as the only notch detector.
The menu bar can report configurations that overlap normal/notchless ranges.
On macOS, AppKit geometry is the preferred source.
---
# 122. HARDWARE NOTCH RENDERING
Two strategies:
```yaml
strategy_A:
  complete_black_pill_over_center:
    pros:
      - simple
      - robust
    cons:
      - less_physical
strategy_B:
  split_wings_around_real_notch:
    pros:
      - physically_integrated
      - actual_hardware_gap_remains
    cons:
      - needs_calibration
```
Production target:
```text
Use split wings on actual notched displays.
Use a normal virtual pill on notchless displays.
```
---
# 123. NOTCH WING GEOMETRY
Let:
```text
N = measured notch width
W = wing width
```
Total compact width:
```text
2W + N
```
Starting wing width:
```text
36-44pt
```
Recommended initial token:
```ts
DEFAULT_NOTCH_WING_WIDTH = 38;
```
Tune visually per display.
---
# 124. NOTCH WING CORNERS
Compact split-wing surface:
```yaml
top:
  both_outer_corners: square
  notch_side: visually_fused
bottom:
  outer_corner: rounded
  notch_side: square_or_fused
```
The top edge should visually continue into the display, not look like a floating pill below the menu bar.
---
# 125. EXPANDED NOTCH SURFACE
Expanded surface:
```text
top edge = flush with display top
bottom-left = rounded
bottom-right = rounded
```
Do not center the entire panel vertically around its own midpoint.
Top should visually remain anchored.
---
# 126. NOTCHLESS MODE
On:
```text
external monitor
pre-notch Mac
Windows
Linux
```
use:
```text
normal centered top pill
```
with the same:
```text
shape language
typography
spacing
motion
activity hierarchy
```
Only platform geometry changes.
---
# 127. EDGE MODES
Support:
```ts
type OverlayEdge =
  | "top"
  | "left"
  | "right";
```
Anchor rules:
```yaml
top:
  transform_origin: top_center
left:
  transform_origin: left_center
right:
  transform_origin: right_center
```
Do not introduce arbitrary freeform positioning in the core model.
---
# 128. EDGE DISPLAY SAFETY
Before rendering:
```text
expanded width <= display width - safety margin
expanded height <= reasonable display area
```
If too large:
```text
clamp
```
not:
```text
render_offscreen
```
---
# 129. ACTIVITY VIEW CONTRACT
Each activity should define:
```ts
interface ActivityViewContract<Props> {
  getCompactSize(props: Props): Size;
  getExpandedSize(
    props: Props,
    available: Size
  ): Size;
  renderCompact(props: Props): React.ReactNode;
  renderExpanded(props: Props): React.ReactNode;
}
```
The activity owns visual layout.
The router owns selection.
---
# 130. DATA / UI SEPARATION
IPC payload:
```json
{
  "id": "timer-123",
  "kind": "timer",
  "remainingMs": 2697000,
  "durationMs": 3600000,
  "running": true
}
```
Renderer decides:
```text
how the timer looks
```
Do not send:
```text
React_node
DOM_element
function
class_instance
native_handle
```
through IPC.
---
# 131. ACTIVITY CONTENT AUTHORITY
Business/application logic stays outside the renderer.
Example timer:
```text
main/application:
    timer deadline
renderer:
    visual display
```
Example music:
```text
main/application:
    current track + state
renderer:
    visual display
```
This lets hidden overlays stop rendering without stopping the underlying activity.
---
# 132. OUTER SHELL VS ACTIVITY
Shell owns:
```text
shape
motion
topology
hit behavior
common spacing
global typography
```
Activity owns:
```text
content
activity-specific controls
activity-specific metadata
activity-specific internal layout
```
Do not let individual activities redefine shell geometry rules.
---
# 133. REACT TREE SIZE
Keep overlay DOM small.
Target:
```text
tens to a few hundred elements
```
for normal expanded states.
Avoid:
```text
thousands_of_nodes
```
for a small panel.
---
# 134. LAYER MANAGEMENT
Use compositor-friendly animation, but do not add:
```css
will-change: transform;
```
to every element.
Only apply it to actively animated small elements when profiling shows value.
Large numbers of promoted layers waste GPU memory.
---
# 135. CSS CONTAINMENT
Use containment selectively for isolated complex regions:
```css
contain: layout style;
```
Do not blindly add `contain: paint` where shadows need to escape.
Measure before adding.
---
# 136. PERFORMANCE TARGETS
At minimum:
```yaml
performance_targets:
  baseline:
    fps: ">=60"
  high_refresh:
    target: "support_120hz_where_compositor_allows"
  idle:
    cpu: "near_zero_or_minimal"
  hot_path:
    react_full_tree_commits_per_frame: "0"
```
Frame budget reference:
```text
60Hz = 16.7ms/frame
120Hz = 8.3ms/frame
```
---
# 137. PERFORMANCE HARD RULES
```yaml
forbidden_in_animation_hot_path:
  - BrowserWindow.setSize
  - BrowserWindow.setBounds
  - repeated_DOM_layout_reads
  - setState_every_frame
  - IPC_every_pointer_event_without_throttle
  - large_image_decode
  - animated_backdrop_filter
  - rapidly_animated_box_shadow
  - forced_reflow
  - unbounded_queue_growth
```
---
# 138. LAYOUT THRASHING
Avoid:
```ts
element.style.width = "...";
const width = element.offsetWidth;
element.style.height = "...";
```
repeatedly in one frame.
Do not perform layout reads immediately after writes in pointer/animation loops unless unavoidable and profiled.
---
# 139. TRANSFORM VS WIDTH
Prefer:
```css
transform: scaleX(...)
```
for continuous progress visuals.
Prefer Motion layout transitions for structural expansion.
Use actual layout width changes only when the semantic layout really must change, and let Motion optimize the transition rather than manually updating every frame.
---
# 140. BOX SHADOW / FILTERS
Do not animate:
```text
shadow blur
filter blur
backdrop-filter
large glow radius
```
continuously.
Static effects are acceptable if performance remains within budget.
---
# 141. TIMER / MUSIC / HIGH FREQUENCY IPC
Do not send every frame's visual value through IPC.
Main process should send semantic state.
Renderer should calculate/render local interpolation where safe.
Example:
```text
main:
  endTimestamp = X
renderer:
  visual remaining based on local clock
```
rather than:
```text
main sends remaining every 16ms
```
---
# 142. IPC BURST CONTROL
Coalesce multiple synchronous updates in the same event loop turn.
Concept:
```ts
let scheduled = false;
function scheduleBroadcast() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    broadcastCurrentSnapshot();
  });
}
```
Tune based on the existing application architecture.
---
# 143. VISUALIZER LIFECYCLE
```yaml
visualizer:
  activity_visible:
    raf: running
  activity_hidden:
    raf: canceled
  cleanup:
    - cancel_animation_frame
    - remove_audio_listener
    - release_canvas_resources_if_needed
```
Never leave an animation loop running because a component unmounted incorrectly.
---
# 144. IMAGE PRELOADING
When an activity can predict artwork:
```text
fetch
→ decode
→ cache
→ render
```
rather than:
```text
open animation
→ fetch image
→ decode
→ layout shift
```
Cache decoded or browser-usable assets where appropriate.
---
# 145. ERROR HANDLING PRINCIPLE
The island is an optional surface.
Therefore:
```text
overlay failure != application failure
```
Examples:
```yaml
helper_failure:
  fallback_geometry
display_failure:
  primary_display_or_hide
wayland_unsupported:
  notification_or_in_app_fallback
renderer_failure:
  reload + snapshot
activity_failure:
  show safe fallback
```
Never bring down the application's main process because the island failed.
---
# 146. DEVELOPER DEBUG MODE
Required debug overlay should show:
```text
platform
session
display_id
display_label
display_bounds
work_area
scale_factor
notch_has_notch
notch_width
notch_height
notch_source
canvas_bounds
compact_bounds
expanded_bounds
hot_zone
phase
interaction_mode
pinned
active_activity_id
queue_size
```
---
# 147. GEOMETRY CALIBRATION
Debug settings:
```yaml
calibration:
  notch_width_delta
  notch_height_delta
  x_offset
  y_offset
  wing_width
  compact_width
  compact_height
  expanded_width
  expanded_height
```
Do not hardcode calibration changes across random components.
Store them in one typed structure.
---
# 148. SCREENSHOT MODE
Developer command options:
```text
--overlay-screenshot
--overlay-state=compact
--overlay-state=expanded
--overlay-activity=timer
--overlay-activity=music
--overlay-activity=aiUsage
--overlay-activity=hud
```
Flow:
```text
launch
→ force state
→ wait for animation settle
→ capturePage
→ save PNG
→ exit
```
---
# 149. VISUAL REGRESSION MATRIX
Required states:
```yaml
visual_snapshots:
  - compact
  - expanded
  - music
  - timer
  - ai_usage
  - hud
  - download
  - battery
  - light_background
  - dark_background
  - wide_display
  - narrow_display
```
Do not validate only the default screenshot.
---
# 150. GEOMETRY UNIT TESTS
Pure functions must be isolated from Electron.
Test:
```yaml
geometry_tests:
  - centered_primary
  - secondary_right
  - secondary_left
  - secondary_above
  - secondary_below
  - negative_coordinates
  - mixed_DPI
  - notch_display
  - notchless_display
  - narrow_display
  - left_edge
  - right_edge
```
---
# 151. HOVER UNIT TESTS
Test:
```yaml
hover_tests:
  - outside_stays_closed
  - enter_starts_intent
  - exit_before_delay_cancels_open
  - intent_reaches_delay_opens
  - first_exit_starts_grace
  - inside_during_grace_keeps_open
  - grace_elapsed_closes
  - pinned_stays_open
  - contradictory_intent_cancels
```
Use pure functions where possible.
---
# 152. ACTIVITY ROUTER TESTS
Test:
```yaml
activity_router_tests:
  - stable_id_update
  - replaceGroup_replaces
  - higher_priority_wins
  - persistent_survives_transient
  - expired_removed
  - queue_bounded
  - pinned_never_dropped
  - active_interaction_not_interrupted
```
---
# 153. RENDERER RECOVERY TESTS
Test:
```yaml
renderer_recovery:
  - reload_compact
  - reload_expanded
  - reload_with_active_timer
  - reload_with_active_music
  - reload_during_activity_update
  - reload_after_display_change
```
Expected:
```text
renderer reloads
→ receives current snapshot
→ receives current geometry
→ returns to correct visual state
```
---
# 154. PERFORMANCE TESTS
Use:
```text
Chromium Performance panel
React Profiler
Electron process inspection
GPU diagnostics
```
Measure:
```yaml
perf_scenarios:
  - open
  - close
  - activity_swap
  - rapid_activity_updates
  - drag
  - timer_running
  - music_progress
  - visualizer
```
Inspect:
```text
layout
paint
composite
long_tasks
script
React commits
```
---
# 155. MACOS TEST MATRIX
At minimum:
```yaml
macos:
  hardware:
    - notched_MacBook
    - notchless_Mac
    - Intel_Mac
    - Apple_Silicon_Mac
  displays:
    - internal_only
    - internal_plus_external
    - external_only
    - mirrored
    - scaled_resolution
  desktop:
    - Spaces
    - Mission_Control
    - Stage_Manager
    - fullscreen_app
  lifecycle:
    - sleep
    - wake
    - lock
    - unlock
    - dock
    - undock
    - display_hotplug
```
---
# 156. WINDOWS TEST MATRIX
```yaml
windows:
  scaling:
    - 100
    - 125
    - 150
    - 175
    - 200
  displays:
    - primary_only
    - secondary_right
    - secondary_left
    - mixed_DPI
  shell:
    - taskbar_bottom
    - taskbar_top
    - taskbar_left
    - taskbar_right
    - auto_hide
  lifecycle:
    - sleep
    - wake
    - display_hotplug
```
---
# 157. LINUX TEST MATRIX
```yaml
linux:
  sessions:
    - X11
    - native_Wayland
    - Wayland_with_XWayland
  desktops_where_supported:
    - KDE
    - GNOME
    - other_supported_desktops
  displays:
    - single
    - multi
    - mixed_scale
  lifecycle:
    - monitor_hotplug
    - sleep
    - wake
```
---
# 158. PACKAGED APP TESTING
Every major behavior must work in:
```text
development
packaged_unpacked
installed
signed/notarized_where_applicable
```
Never assume dev-server behavior is representative of packaged Electron behavior.
---
# 159. NATIVE HELPER RELIABILITY
If helper returns malformed JSON:
```text
reject
log diagnostic
fallback
retry later
```
Do not crash.
If helper timeout:
```text
kill/terminate safely
fallback
retry on next geometry refresh
```
If helper executable missing:
```text
fallback virtual geometry
report packaging error in diagnostics
```
---
# 160. DISPLAY RECONCILIATION RETRY
After a topology event:
```text
immediate refresh
+
delayed stabilization refresh
```
Example:
```text
t = 0ms
reconcile()
t = 1000ms
reconcile again
```
This catches final post-dock metrics.
---
# 161. CURRENT DISPLAY SELECTION
Default:
```text
primary display
```
But allow future user setting:
```text
primary
cursor_display
specific_display
```
Saved display references should be resilient to changing IDs.
Prefer matching:
```text
displayId
fallback label
fallback primary
```
---
# 162. NEVER HARD-CODE SCREEN RESOLUTIONS
Forbidden:
```text
if width == 3024 && height == 1964
```
for general geometry logic.
Use measured geometry / display characteristics.
Hardcoded values are allowed only as:
```text
fallback/calibration defaults
```
not as primary identification.
---
# 163. DO NOT USE MENU BAR HEIGHT AS PRIMARY NOTCH DETECTOR
A top band of similar height can appear on notchless configurations.
Use:
```text
AppKit geometry on macOS
internal display identity
fallback heuristics only when geometry unavailable
```
---
# 164. APPLE NOTCH MODEL DETECTION
Model IDs may be used as an optional fallback hint, but never as the authoritative notch width/position source.
Preferred ordering:
```text
AppKit measured geometry
→ stable cached measurement
→ calibrated fallback
→ model hint if useful
→ virtual pill
```
---
# 165. MACOS NOTCHLESS INTERNAL DISPLAY
If AppKit reports no notch:
```text
hasNotch = false
```
The renderer should use:
```text
normal centered pill
```
not split wings.
---
# 166. EXTERNAL MAC DISPLAY
External display:
```text
hasNotch = false
```
unless future platform-specific evidence explicitly proves otherwise.
Use:
```text
virtual top-centered island
```
or selected edge.
---
# 167. VISUAL CONSISTENCY ACROSS OS
Keep consistent:
```text
shell shape
typography hierarchy
spacing
motion character
activity design
icon system
controls
```
Allow platform-specific differences in:
```text
window level
focus
positioning
notch handling
fullscreen
Wayland fallback
```
The user should perceive one product even if the implementation differs.
---
# 168. APPLE-STYLE ≠ MAC-ONLY
Do not put:
```ts
if (process.platform === "darwin") {
  renderHalo();
}
```
around the entire feature.
Instead:
```text
same renderer
+
platform-specific geometry and window backend
```
---
# 169. NO UNIVERSAL PLATFORM LIE
Do not describe unsupported capabilities as working.
Examples:
```text
native Wayland cursor positioning
universal fullscreen detection
universal topmost semantics
```
must be capability-gated.
---
# 170. ACCESSIBILITY
Support:
```text
prefers-reduced-motion
keyboard navigation
Escape
Tab
Shift+Tab
Enter
Space
semantic buttons
```
Critical information must not depend exclusively on animation.
---
# 171. REDUCED MOTION
Normal:
```text
spring
transform
subtle bounce
```
Reduced motion:
```text
fade
minimal transform
no bounce
no prolonged movement
```
Do not merely multiply durations by zero if that produces broken layout transitions.
Provide a separate reduced-motion path.
---
# 172. ARIA LIVE
Use live announcements only for meaningful transient events:
```text
Download complete
Timer finished
Device connected
```
Do NOT announce:
```text
44:59
44:58
44:57
```
every second.
---
# 173. BUTTON SEMANTICS
Prefer:
```html
<button>
```
over clickable generic `<div>` where the control is genuinely a button.
The overlay must remain keyboard accessible when interactive.
---
# 174. SYSTEM FONT FALLBACKS
Never design based solely on Apple text metrics.
Test with:
```text
SF Pro where available
Segoe UI / system-ui on Windows
common Linux system font
```
Watch for:
```text
text clipping
baseline shift
line wrap
button width changes
```
---
# 175. DENSITY PRINCIPLE
Expanded panels should usually show:
```text
1 primary concept
2-5 supporting pieces
```
without forcing scrolling for ordinary state.
Do not turn the island into a dashboard.
---
# 176. LONG CONTENT RULE
Compact:
```text
minimal
single-line
ellipsis
```
Expanded:
```text
two-line title max
internal scroll only for genuinely long content
```
---
# 177. NO OUTER SCROLLBAR
The main shell should never present a browser-like scrollbar.
If an activity requires scrolling:
```text
nested scroll container
```
only.
---
# 178. SETTINGS ARCHITECTURE
The island should not become the complete settings application.
Use a normal settings window for:
```text
display selection
edge selection
animation preference
reduced motion
activity priorities
privacy
shortcuts
calibration
```
The island remains a glanceable interaction surface.
---
# 179. DEVELOPER TOOLS
Debug mode should support:
```text
force_activity
force_phase
force_display
force_geometry
open_on_start
screenshot
diagnostic_dump
```
This makes visual testing deterministic.
---
# 180. NATIVE DIAGNOSTIC DUMP
When debug mode is enabled, dump:
```yaml
diagnostic:
  platform
  linux_session
  display_id
  display_bounds
  work_area
  scale_factor
  internal
  notch_source
  notch_width
  notch_height
  canvas
  compact
  expanded
  hot_zone
  phase
  interaction
  activity
```
Do not dump sensitive activity payloads.
---
# 181. NO FULL-SCREEN TRANSPARENT CANVAS
Forbidden default:
```text
1920×1080 transparent BrowserWindow
```
Prefer the smallest canvas that safely contains the expanded island.
Large transparent surfaces waste compositor resources and complicate hit testing.
---
# 182. WINDOW VISIBILITY + GPU
When deeply idle:
```text
hide native window
```
if useful.
Stop:
```text
visualizers
continuous CSS animations
high-frequency polling
```
while inactive.
---
# 183. MAIN PROCESS TIMER SAFETY
All timers and intervals require cleanup.
Track:
```text
setInterval
setTimeout
requestAnimationFrame
IPC listeners
screen listeners
powerMonitor listeners
ResizeObserver
```
Every acquisition needs a corresponding cleanup path.
---
# 184. SHUTDOWN
On quit:
```yaml
shutdown:
  - stop_hover_poll
  - cancel_intents
  - remove_screen_listeners
  - remove_power_monitor_listeners
  - cancel_activity_timers
  - stop_visualizers
  - stop_native_helpers
  - destroy_overlay_window
```
No orphan background processes.
---
# 185. OVERLAY SERVICE API
Recommended:
```ts
interface OverlayService {
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(activity: IslandActivity): void;
  remove(activityId: string): void;
  open(): void;
  collapse(): void;
  pin(): void;
  unpin(): void;
  getSnapshot(): SerializedOverlayState;
}
```
Application code should call `OverlayService`.
Application code should NOT directly manipulate `BrowserWindow`.
---
# 186. WINDOW MANAGER API
```ts
interface OverlayWindowManager {
  create(): BrowserWindow;
  showInactive(): void;
  hide(): void;
  setInteractive(interactive: boolean): void;
  applyDisplayGeometry(geometry: IslandGeometry): void;
  destroy(): void;
}
```
All native window manipulation lives here.
---
# 187. GEOMETRY MANAGER API
```ts
interface GeometryManager {
  resolveTargetDisplay(): Electron.Display | null;
  refresh(): Promise<IslandGeometry | null>;
  getCurrent(): IslandGeometry | null;
}
```
No React.
No CSS.
No activity routing.
---
# 188. HOVER CONTROLLER API
```ts
interface HoverController {
  start(): void;
  stop(): void;
  setPinned(pinned: boolean): void;
  getState(): HoverState;
}
```
No rendering.
No activity selection.
Only pointer intent and interaction mode.
---
# 189. ACTIVITY ROUTER API
```ts
interface ActivityRouter {
  publish(activity: IslandActivity): void;
  remove(id: string): void;
  current(): IslandActivity | null;
  queue(): readonly IslandActivity[];
  subscribe(listener: () => void): () => void;
}
```
---
# 190. OVERLAY STATE SNAPSHOT
Recommended serialized shape:
```ts
export interface SerializedOverlayState {
  phase: IslandPhase;
  interaction: InteractionMode;
  pinned: boolean;
  activeActivity: IslandActivity | null;
  queuedActivityIds: string[];
  reducedMotion: boolean;
}
```
Keep payload bounded.
---
# 191. MAIN → RENDERER STATE FLOW
```text
application event
    ↓
ActivityStore
    ↓
ActivityRouter
    ↓
OverlayController
    ↓
IPC snapshot/update
    ↓
React
```
Do not create:
```text
React
↔ arbitrary main listeners
↔ arbitrary global state
↔ DOM side channels
```
---
# 192. USER ACTION FLOW
```text
user click
    ↓
React action
    ↓
preload bridge
    ↓
validated IPC
    ↓
main controller
    ↓
application/system action
```
React does not directly execute privileged operations.
---
# 193. CONTENT ACTIONS
Examples:
```yaml
actions:
  music:
    - playPause
    - previous
    - next
    - seek
  timer:
    - pause
    - resume
    - reset
  generic:
    - open
    - dismiss
```
All actions must be validated.
---
# 194. OPTIMISTIC UI
Use optimistic visual state only when safe.
Example:
```text
play pressed
→ immediately show pause
→ main/app confirms
```
If backend state disagrees:
```text
reconcile to authoritative state
```
This makes controls feel instant without making UI state the permanent source of truth.
---
# 195. MEDIA SEEK OPTIMISM
During drag:
```text
UI follows pointer locally
```
At release:
```text
commit actual media seek
```
Do not make pointer latency depend on native media IPC response.
---
# 196. STATE COALESCING
For rapidly changing application data:
```yaml
coalesce:
  volume: true
  brightness: true
  timer_visual_progress: true
  music_position: true
  download_progress: true
  ai_usage: true
```
The last state in a burst is generally the one that matters.
---
# 197. ACTIVITY MINIMUM DISPLAY TIME
Use:
```ts
minimumDisplayMs
```
to prevent an event from being instantly replaced before the user can perceive it.
Example transient:
```text
~500-1500ms
```
depending on event importance.
Do not make every event remain for 4.5s.
---
# 198. ACTIVITY EXPIRY
Transient activities should include:
```ts
expiresAt
```
Source of truth in controller/router.
Do not depend solely on:
```text
React component timeout
```
for business state.
---
# 199. OUTER SHELL MUST REMAIN CALM
Activity update:
```text
content change
```
not automatically:
```text
full shell collapse/open cycle
```
unless the semantic interaction changes enough to justify it.
---
# 200. VISUAL TRANSITIONS BETWEEN ACTIVITIES
Use:
```text
crossfade
translate 2-6px
shared layout
```
where useful.
Avoid:
```text
large slide from arbitrary direction
```
for ordinary data replacement.
The system should feel like one persistent surface.
---
# 201. MUSIC ARTWORK TRANSITION
If the artwork identity stays related:
```text
stable artwork element
→ crossfade / shared-layout transition
```
Do not flash a blank image between tracks.
Preload next artwork where possible.
---
# 202. TIMER TRANSITION
When timer changes:
```text
do not rebuild whole panel
```
Update:
```text
remaining
progress
state
```
inside existing layout.
---
# 203. ERROR TRANSITION
For an error:
```text
neutral shell
→ small accent emphasis
→ optional brief shake
→ settle
```
Do not shake the entire screen-like panel aggressively.
---
# 204. WALLPAPER INDEPENDENCE
Do not sample desktop pixels for core design.
The shell must look correct over:
```text
bright
dark
photo
video
terminal
editor
```
Use a strong neutral surface rather than adaptive screenshot-based styling.
---
# 205. NO GLASS DEPENDENCY
Do not make the system rely on:
```text
backdrop-filter
desktop-pixel-sampling
```
to appear correct.
Those can be optional enhancements only.
---
# 206. INITIAL IMPLEMENTATION ORDER
```yaml
phase_1:
  - inspect_existing_electron_architecture
  - create_overlay_service_shell
phase_2:
  - native_window_spike
  - transparent
  - always_on_top
  - click_through
  - no_focus_steal
phase_3:
  - display_manager
  - geometry_manager
  - debug_geometry
phase_4:
  - macOS_appkit_measurement
  - fallback_geometry
phase_5:
  - fixed_canvas
  - compact_pill
phase_6:
  - Motion_compact_expanded
  - top_anchor
  - interruption
phase_7:
  - hover_controller
  - hot_zone
  - hysteresis
  - pinned_state
phase_8:
  - activity_router
  - timer
phase_9:
  - music
  - artwork_preload
phase_10:
  - HUDs
  - downloads
  - screenshots
  - battery
  - AI_usage
phase_11:
  - Windows_adapter
  - Linux_X11_adapter
  - Wayland_capability_fallback
phase_12:
  - security_review
  - packaging
  - signing
phase_13:
  - performance_profiling
phase_14:
  - visual_polish
phase_15:
  - regression_matrix
```
---
# 207. WHY THIS ORDER
Do not spend hours polishing:
```text
gradients
icons
shadows
```
before verifying:
```text
window placement
click-through
focus
display topology
animation architecture
```
A beautiful but unstable overlay is worse than an ugly but correct spike because it encourages the wrong architecture to become permanent.
---
# 208. FIRST SPIKE ACCEPTANCE CRITERIA
The first prototype only needs:
```text
transparent BrowserWindow
black rectangle
top-center
always on top
click-through
no focus stealing
correct display
```
If this fails:
```text
do not proceed to complex UI
```
---
# 209. SECOND SPIKE ACCEPTANCE CRITERIA
Must demonstrate:
```text
compact
→ expanded
→ compact
```
without:
```text
native window resizing
visible jitter
top-edge jump
```
If the animation is not smooth here:
```text
do not add activities
```
---
# 210. THIRD SPIKE ACCEPTANCE CRITERIA
Must demonstrate:
```text
hover
→ delayed opening
→ interaction
→ leave grace
→ close
```
without:
```text
accidental opening
premature closing
focus theft
menu bar click interception
```
---
# 211. CODE REVIEW HARD RULES
Every overlay PR must answer:
```yaml
review:
  - "Does this resize BrowserWindow during interaction?"
  - "Does this add React renders per frame?"
  - "Does this add repeated layout reads/writes?"
  - "Does this flood IPC?"
  - "Does this alter focus behavior?"
  - "Does this break click-through?"
  - "Does this handle display changes?"
  - "Does this survive renderer reload?"
  - "Does this introduce platform assumptions into React?"
  - "Is animation interruptible?"
  - "Does reduced motion remain correct?"
  - "Can the same result be achieved with compositor-friendly properties?"
```
---
# 212. REJECT THESE ANTI-PATTERNS
```yaml
reject:
  - "BrowserWindow.resize_each_frame"
  - "BrowserWindow.setBounds_inside_requestAnimationFrame"
  - "React_setState_every_16ms"
  - "screen_geometry_inside_renderer"
  - "Electron_import_inside_React_component"
  - "global_transparent_fullscreen_window"
  - "unbounded_activity_queue"
  - "timeout_chain_as_animation_engine"
  - "per_pointermove_native_IPC_without_throttle"
  - "hardcoded_notch_resolution_map"
  - "Linux_assumed_X11"
  - "Wayland_claimed_fully_supported_without_capability_check"
  - "remote_JS_for_core_UI"
  - "raw_ipcRenderer_exposed"
  - "focus_on_notification"
  - "visualizer_never_stopped"
  - "orphaned_screen_listeners"
```
---
# 213. QUALITY BAR: VISUAL
The island should feel:
```text
stable
dense
quiet
precise
slightly physical
responsive
```
Avoid:
```text
toy
bouncy
neon
glass-heavy
dashboard-like
chat-bubble-like
```
unless the product deliberately chooses otherwise.
---
# 214. QUALITY BAR: INTERACTION
The user should be able to infer:
```text
what is shown
what is active
what can be clicked
how to close it
```
without learning an undocumented gesture system.
---
# 215. QUALITY BAR: MOTION
Motion must:
```text
start with intent
remain anchored
preserve object identity
be interruptible
settle quickly
not dominate attention
```
---
# 216. QUALITY BAR: RELIABILITY
A display event must never leave:
```text
wrong monitor
offscreen
wrong scale
stale notch geometry
dead click target
stuck hover state
```
for the rest of the session.
---
# 217. QUALITY BAR: FAILURE
If the overlay fails:
```text
application still functions
```
Always.
---
# 218. PACKAGING / RELEASE CHECKLIST
```yaml
release:
  macos:
    - helper_packaged
    - helper_signed
    - architecture_verified
    - notarization_verified
    - notch_tested
  windows:
    - packaged_overlay_tested
    - DPI_tested
  linux:
    - X11_tested
    - Wayland_capability_tested
    - fallback_tested
  all:
    - startup_test
    - shutdown_test
    - monitor_hotplug
    - sleep_wake
    - renderer_reload
    - screenshot_regression
    - performance_trace
```
---
# 219. AGENT BEHAVIOR REQUIREMENTS
The coding agent must:
```yaml
agent:
  before_code:
    - inspect_existing_project_structure
    - inspect_current_window_architecture
    - inspect_existing_preload
    - inspect_existing_state_management
    - inspect_build/packaging_system
  implementation:
    - preserve_unrelated_existing_functionality
    - create_isolated_overlay_modules
    - test_each_architectural_layer_before_next
  after_each_major_phase:
    - run_tests
    - inspect_visual_result
    - inspect_performance_if_animation_changed
    - commit_stable_state
  never:
    - rewrite_unrelated_application
    - invent_platform_APIs
    - claim_unverified_Halo_internals
    - hide_platform_limitations
    - sacrifice_reliability_for_demo_visuals
```
---
# 220. FINAL ARCHITECTURAL MODEL
```text
                         APPLICATION
                              |
                              v
                       +--------------+
                       | ActivityStore|
                       +--------------+
                              |
                              v
                       +--------------+
                       | ActivityRouter|
                       +--------------+
                              |
                              v
                     +------------------+
                     | OverlayController|
                     +------------------+
                       /       |        \
                      /        |         \
                     v         v          v
              HoverController GeometryManager WindowManager
                                  |              |
                                  v              v
                           DisplayManager   PlatformAdapter
                                  |          /      |      \
                                  |       macOS  Windows   Linux
                                  |          |
                                  |          v
                                  |    AppKit Helper
                                  |
                                  v
                         Fixed Electron Canvas
                                  |
                                  v
                            React Overlay
                                  |
                                  v
                          Motion Island Surface
                                  |
                                  v
                           Activity Components
```
---
# 221. THE FIVE ABSOLUTE RULES
```yaml
RULE_1:
  statement: "Never animate by resizing BrowserWindow."
  reason: "native window management is the wrong animation layer"
RULE_2:
  statement: "React never directly accesses Electron."
  reason: "security + architectural separation"
RULE_3:
  statement: "High-frequency animation does not use React state as the frame clock."
  reason: "avoid unnecessary React commits"
RULE_4:
  statement: "Linux must be capability-detected; native Wayland is not equivalent to X11."
  reason: "Electron documents important Wayland window-management limitations"
RULE_5:
  statement: "The overlay is optional; its failure must never crash or block the main application."
  reason: "reliability beats cosmetic behavior"
```
---
# 222. IMPLEMENTATION DEFINITION OF DONE
```yaml
functional:
  - overlay_starts
  - overlay_hides
  - compact_works
  - expanded_works
  - hover_opens
  - hover_requires_intent
  - close_has_grace
  - click_can_pin
  - Escape_closes
  - compact_is_click_through
  - underlying_app_retains_focus
  - display_changes_reposition
  - DPI_changes_reposition
  - sleep_wake_recovers
  - renderer_reload_recovers
  - activity_queue_works
  - transient_expiry_works
  - persistent_activity_survives_collapse
animation:
  - native_window_not_resized_during_interaction
  - no_visible_jitter
  - no_top_jump
  - interruptible
  - content_does_not_stretch_badly
  - images_do_not_distort
  - activity_swaps_do_not_reopen_shell
  - reduced_motion_supported
performance:
  - >=60fps_target
  - no_framewise_react_commits
  - no_forced_layout_hot_loop
  - no_ipc_flood
  - no_visualizer_leak
  - no_unbounded_queue
  - no_large_decode_during_open
macos:
  - physical_notch_measured
  - notch_geometry_fallback
  - split_wings_on_real_notch
  - notchless_fallback
  - external_monitor_support
  - Spaces_tested
  - fullscreen_tested
  - Mission_Control_tested
  - Stage_Manager_tested
  - Intel_tested
  - Apple_Silicon_tested
  - helper_packaged
windows:
  - primary_display
  - secondary_display
  - mixed_DPI
  - click_through
  - focus_retention
  - sleep_wake
linux:
  - X11
  - Wayland_capability_detection
  - XWayland_fallback_where_supported
  - honest_unsupported_fallback
security:
  - contextIsolation
  - sandbox
  - nodeIntegration_false
  - typed_preload
  - validated_IPC
  - restrictive_CSP
  - no_remote_core_UI
  - safe_logging
```
---
# 223. RESEARCH BASIS
Use these as implementation/reference sources, not as claims about Halo's private internals.
```yaml
observable_product:
  halo:
    url: https://halo-mac.vercel.app/
    relevance:
      - public_Halo_UX
      - top_center_island
      - notch_and_notchless_behavior
      - activity_categories
      - external_display_behavior
apple:
  appkit_nsscreen:
    - https://developer.apple.com/documentation/appkit/nsscreen/auxiliarytoprightarea-gr2n
    - https://developer.apple.com/documentation/appkit/nsscreen/auxiliarytopleftarea
    - https://developer.apple.com/documentation/appkit/nswindow/collectionbehavior-swift.struct
electron:
  browser_window:
    - https://www.electronjs.org/docs/latest/api/browser-window
  screen:
    - https://www.electronjs.org/docs/latest/api/screen
  custom_window_interactions:
    - https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions
  security:
    - https://www.electronjs.org/docs/latest/tutorial/security
motion:
  layout:
    - https://motion.dev/docs/react-layout-animations
  motion_values:
    - https://motion.dev/docs/react-motion-value
  performance:
    - https://motion.dev/docs/performance
web_performance:
  animation_guide:
    - https://web.dev/articles/animations-guide
wayland:
  layer_shell:
    - https://github.com/wlr-protocols/wlr-layer-shell
```
---
# 224. REFERENCE IMPLEMENTATION PATTERNS FOUND IN REAL PROJECTS
Use these as evidence that the architecture is practical, but do not copy code blindly.
```yaml
patterns:
  - project: "DaliBerr/Vibe-Halo"
    useful_patterns:
      - Electron dynamic-island architecture
      - platform adapters
      - display selection
      - fullscreen/all-space behavior
      - bounded history/activity concepts
  - project: "HSUNEH/dynamac-island"
    useful_patterns:
      - fixed compact/expanded modes
      - macOS native AppKit notch measurement
      - wing geometry
      - screen-space anchoring
      - native status integration
  - project: "aby-agency/aby-claude-watcher"
    useful_patterns:
      - fixed transparent canvas
      - click-through by default
      - main-process cursor polling
      - hover hysteresis
      - async notch measurement
      - retry after display transitions
  - project: "nimbalyst/nimbalyst"
    useful_patterns:
      - fixed oversized Electron canvas
      - no window resize for animation
      - pure testable geometry
      - hover state machine
      - notchless/notched distinction
  - project: "0xshubhs/nibble"
    useful_patterns:
      - macOS notch measurement
      - explicit polling rates
      - focusable toggle
      - wake/unlock geometry refresh
      - fullscreen/Spaces handling
```
---
# 225. FINAL BUILD DIRECTIVE
```yaml
build_directive:
  implement:
    - fixed_native_overlay
    - platform_adapter
    - centralized_geometry_manager
    - AppKit_notch_helper
    - cursor_hover_controller
    - bounded_activity_router
    - React_overlay_shell
    - Motion_layout_animation
    - activity_components
    - performance_instrumentation
    - screenshot_regression
    - platform_test_matrix
  prioritize:
    1: correctness
    2: reliability
    3: smooth_interaction
    4: performance
    5: visual_polish
  reject:
    - fake_platform_parity
    - native_window_animation
    - React_frame_clock
    - polling_every_frame_for_hover
    - hardcoded_display_resolution_logic
    - full_screen_transparent_windows
    - unbounded_activity_state
    - focus_stealing_notifications
  success_definition:
    "The user should feel that a persistent, intelligent desktop surface exists at the edge of the screen, not that an Electron popup is being animated over the desktop."
```
