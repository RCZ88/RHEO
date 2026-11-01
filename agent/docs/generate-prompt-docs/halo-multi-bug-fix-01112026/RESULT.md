# Halo Island — Five-Defect Repair Specification

**Scope:** website/domain presentation, hover-open, pill repositioning, Focus/Stopwatch/Schedule page functionality, and stopwatch reset integrity.

**Source of truth:** the supplied `PROMPT.md` and `CONTEXT_BUNDLE.md` for `RHEO` as of 2026-11-01. This is an implementation specification, not a claim that the repository has already been changed. The implementation agent must preserve existing components, channels, and behavior not explicitly changed below. Do not replace the working Halo renderer or redesign its boards.

## 0. Decisions and invariants

1. **Main-process authority:** the main process owns foreground identity, accepted browser-site state, window geometry, hover policy, and the validated stopwatch relay cache. React renders state; it does not decide which desktop window is foreground.
2. **One painter at a time:** the cross-app Halo host paints when it is healthy. The in-app Halo paints only when the cross-app host is unavailable. Do not hide the in-app version merely because preferences say Halo is enabled; host health must be part of the painter decision.
3. **One stopwatch writer:** the main RHEO renderer's `stopwatchStore` is the only writer of `localStorage['rheo-stopwatch-v1']`. Main caches and relays; the separate island renderer never persists or writes stopwatch state.
4. **Tri-state domain:** `domain === undefined` means the foreground app is not a browser; `domain === null` means a browser is foreground but its site is unknown; a non-empty string means a verified website domain. Never collapse `null` into `undefined` or an empty string.
5. **Hover has a visible anchor:** when hover triggering is enabled and the resident preference is not `off`, the compact pill is painted in its collapsed state. The hot zone must not be used to summon a pill that is not painted.
6. **One geometry model:** pill painting, hover hit testing, drag preview, saved drag offsets, and host placement all derive from the same computed compact-surface rectangle.
7. **All data is honest:** an unavailable producer shows a loading/error/empty state. It must not fabricate a browser domain, focus session, schedule item, timer duration, or alarm.
8. **No focus theft or permanent click interception:** preserve `showInactive()` and the existing click-through/shape guards. Hover must not call `win.focus()`.
9. **No new test runner and no build by the agent:** use scoped `tsc`, `esbuild` parsing, pure TypeScript probes run with `npx tsx`, and Playwright against the dev server. CZ performs the application build.

---

## 1. Root cause summary

| Defect | Proven facts in the bundle | Required repair |
|---|---|---|
| Website missing | The compact-kind expression only selects `website` / `stopwatchSite` when `currentApp.domain` is truthy. The normal foreground path sends app/title/category but not domain. Browser data arrives on the separate `handleBrowserData` → `onWebActivity` path. | Main merges accepted browser-site metadata into the authoritative current-app snapshot and republishes it through the existing Halo snapshot/stream. Preserve domain tri-state semantics. |
| Hover does not open | `stepHover` works only for modes `hover` and `hover-or-click`; the main poll uses computed hot-zone geometry; resident rendering can hide the pill until `hovered` becomes true. | Remove the hidden-pill/hover circular dependency. Share a single hover eligibility/presence predicate between main and renderer. Poll only the compact pill plus configured padding. |
| Drag does not move/persist | `dragX` / `dragY` are normalized and consumed in `OverlayRoot`, but the press-hold gesture and preference write are missing/no-op. Main host geometry is not guaranteed to receive the same offset. | Add a long-press drag gesture, transient preview, one preference commit on release, and one shared geometry result consumed by the in-app renderer and cross-app host. |
| Focus / Stopwatch / Schedule broken | Focus currently uses a stopwatch snapshot alongside an optional Focus payload; this is not the real Focus feature. `SchedulePageRow` is prop-driven but its producer/action path is not proven end-to-end. | Read Focus from the existing Focus session service; read Schedule from the existing Life/Schedule data source; route controls through one validated main-process action boundary. Keep stopwatch separate from Focus session state. |
| Stopwatch randomly resets | The owner store, main relay cache, and island renderer can disagree. `resetCount` exists but consumers may not remount/rebase on it. Day rollover, tier policy, AFK, manual reset, and renderer reload have different semantics. | Enforce a single writer, monotonic revision/reset counter, strict payload validation, keep-last-known-good relay behavior, and explicit reset-vs-pause rules. |

---

## 2. Website on browser tracking

### 2.1 Authoritative ownership

**The main process is authoritative for the accepted `NowPayload.domain` and `NowPayload.isPrivate` values.** The browser extension is the source of browser-tab facts; the main process decides whether those facts are fresh and belong to the currently foreground browser.

The normal foreground detector remains authoritative for `app`, `category`, and foreground identity. The extension remains authoritative for the active browser tab/site and private-window signal. The main process joins those facts only after validating that the foreground browser matches the browser which supplied the extension event.

Do not let the renderer independently infer the current domain from `title`, a stale URL, a cached prior browser event, or the browser's process name.

### 2.2 Required tri-state contract

Keep the existing public type semantics:

```ts
export interface NowPayload {
  app: string;
  category: string;
  tier: 'productive' | 'neutral' | 'distracting';
  /**
   * undefined: foreground app is not a browser.
   * null: a browser is foreground, but no current site is verified.
   * string: verified normalized hostname for the current browser tab.
   */
  domain?: string | null;
  /** true only when the extension positively confirms a private window. */
  isPrivate?: boolean;
  secondsInApp?: number;
}
```

Consumers must test `domain !== undefined` to identify the browser context. Do not test truthiness for browser identity. The value `null` is meaningful.

`isPrivate` semantics:

- `true`: the extension positively confirms a private/incognito window. Suppress domain and URL-derived context.
- `false`: the extension positively confirms a normal window.
- `undefined`: privacy status has not been verified. Do not infer `false` from a missing field.

If privacy is `true`, it takes precedence over a previously known domain. The accepted `NowPayload` must not retain the last non-private domain.

### 2.3 End-to-end data flow

```text
OS foreground detector
  -> main current foreground identity (app/category/title)
  -> if app is not a configured browser: domain = undefined; isPrivate = undefined
  -> if app is a configured browser: domain = null; isPrivate = undefined until verified

Browser extension active-tab event
  -> existing browser-data bridge / handleBrowserData
  -> onWebActivity validates browser identity + freshness + current foreground
  -> main normalizes hostname and privacy state
  -> main updates the current NowPayload
  -> existing halo:report-stream / halo:snapshot transport
  -> OverlayRoot currentApp
  -> CompactKind decision
  -> CompactPill renders website or stopwatchSite with domain
```

Use the existing `handleBrowserData` → `onWebActivity` path. Do not add a second independent website tracker.

### 2.4 Browser event contract

The extension-to-main event must contain the following semantic fields. Adapt the field names to the existing `browser-data` payload rather than creating a competing bridge:

```ts
interface BrowserSiteObservation {
  browserApp: string;
  domain: string | null;
  isPrivate?: boolean;
  observedAt: number; // epoch milliseconds
  tabId?: string;
}
```

Validation at the main-process boundary:

1. `browserApp` must map to an enabled browser integration.
2. A fresh foreground check must either confirm that same browser or return `null` (unknown). If it returns `false`, reject the event and emit the existing authoritative clear event. If it returns `null`, do not discard a potentially valid event solely because the fresh check is inconclusive; require the cached foreground identity to match and keep the event short-lived.
3. `observedAt` must be finite, not in the future beyond a small clock-skew tolerance, and no older than the configured site-observation TTL.
4. Normalize `domain` by parsing the supplied URL/domain with a safe URL parser, lowercasing the hostname, stripping a terminal dot, and rejecting IP literals or malformed/empty hostnames unless the existing extension contract explicitly supports them. Store/display hostname only, not a full URL.
5. If `isPrivate === true`, force accepted `domain = null` and do not retain the prior domain.
6. An omitted `domain` from an extension event is invalid input. The main accepted state still uses `null` for unknown browser site.

**Freshness policy:** define one shared `BROWSER_SITE_TTL_MS = 10_000` constant unless the existing extension heartbeat cadence proves that it must be adjusted. This assumes successful site observations arrive at least once every 3 seconds. If the actual extension heartbeat is slower, set the TTL to `max(10_000, 3 * heartbeatIntervalMs)`. A stale observation clears the currently displayed site to `null`; it never leaves an old domain on screen.

### 2.5 Foreground transition and clear behavior

When foreground changes:

- To a non-browser app: set `domain = undefined` and `isPrivate = undefined` immediately. Emit the existing browser clear event if a browser site was active.
- To a configured browser: create a fresh `NowPayload` with `domain = null` and `isPrivate = undefined`. Do not carry the prior browser's domain across the transition. Wait for a matching extension observation.
- To a private browser window: set `isPrivate = true`, `domain = null` and render private copy. Do not expose a prior URL/domain.
- When the extension emits `browser-tracking-event { type: 'clear' }`: clear site-specific state. If the browser remains foreground, preserve browser identity and set `domain = null`; if the fresh foreground check confirms a non-browser, set `domain = undefined` and exit browser mode.

`freshForegroundIsBrowser(browsersList)` remains tri-state (`true` / `false` / `null`). Do not replace it with a blanket acceptance/rejection rule.

### 2.6 Compact kind decision

Replace the truthy-domain expression with a helper that preserves the tri-state:

```ts
function selectCompactKind(
  currentApp: NowPayload,
  displaySource: StopwatchPayload['displaySource'],
): CompactKind {
  if (currentApp.isPrivate === true) return 'private';

  const isBrowser = currentApp.domain !== undefined;
  if (!isBrowser) return 'stopwatch';

  return displaySource === 'idle' ? 'website' : 'stopwatchSite';
}
```

Rendering rules:

| State | Kind | Main label |
|---|---|---|
| Not a browser (`domain === undefined`) | `stopwatch` | Existing stopwatch/app presentation |
| Browser, known domain, idle | `website` | `github.com` (or verified hostname) |
| Browser, known domain, actively tracked | `stopwatchSite` | Verified hostname beside timer |
| Browser, unknown/stale site (`domain === null`), idle | `website` | `Site unavailable` |
| Browser, unknown/stale site, actively tracked | `stopwatchSite` | `Site unavailable` beside timer |
| Verified private window | `private` | `Private window` |

Do not fall back to `stopwatch` just because domain is null. That would hide the fact that the current foreground app is a browser and would make the bug recur.

### 2.7 Failure and privacy states

- Extension late: show `Site unavailable` until a fresh observation arrives.
- Extension stale: clear the domain and show `Site unavailable`; never keep an old hostname indefinitely.
- Private window: show `Private window`; never show a domain, URL, tab title, or stale prior site.
- Browser not configured for website tracking: `domain = undefined`; use the existing non-browser/stopwatch pill path.
- Browser focused, tab still loading, no active tab, or extension disconnected: `domain = null`; display the explicit unknown-site copy.

### 2.8 Files to change

| File | Change |
|---|---|
| `src/shared/halo/types.ts` | Document and retain `domain?: string | null`; retain optional `isPrivate`; add typed browser observation only if it belongs in shared IPC types. |
| `src/main.ts` | Merge `onWebActivity` observations into main's current foreground snapshot; reset domain on foreground changes; validate freshness, browser identity and privacy; emit authoritative clear transitions. |
| `src/features/halo/OverlayRoot.tsx` | Consume the merged `NowPayload`; stop relying on truthy domain to identify browser context. |
| `src/features/halo/CompactPill.tsx` | Render `Site unavailable` for browser `domain === null`; do not silently render a non-browser fallback. |
| `src/main/halo/haloIsland.ts` | Include the joined `NowPayload` in `halo:get-snapshot` and the existing `halo:report-stream` updates. |
| `src/preload.ts` / `src/preload2.ts` | Only update if the existing browser event or Halo snapshot binding is missing. Preserve the established bridge names. |

---

## 3. Hover-open

### 3.1 Exact geometry contract

The hover FSM tests the **compact pill rectangle plus configured user padding**, never the transparent BrowserWindow canvas.

```ts
const compactRect = computeSurfaceRect(canvas, compactSize, edge);
const hotZone = computeHotZone(
  canvas,
  compactSize,
  { padX: prefs.hoverPadX ?? 0, padY: prefs.hoverPadY ?? 0 },
  edge,
);
const expandedKeepOpenZone = unionRect(hotZone, expandedRect);
```

If the current preference model uses different property names for padding, retain those names. Do not add a parallel set of hover settings. Current documented defaults are `padX = 0`, `padY = 0`; `leaveMarginPx = 24` is hysteresis for leaving, not additional clickable geometry.

Required invariants:

- `hotZone` contains `compactRect`.
- `hotZone` is bounded to the intended screen/display bounds.
- `hotZone` does not expand to the full transparent canvas.
- When expanded, the keep-open region is the union of the compact trigger zone and the expanded surface rectangle.
- The same computed rectangles feed both pointer testing and diagnostic readback.

### 3.2 Trigger mode and timing

The `HoverTriggerMode` must be one of:

- `hover`: hover can open.
- `hover-or-click`: hover can open and click can open.
- `click`: hover must not open.
- `hotkey`: hover must not open.

The default is already `hover`. Do not silently normalize a missing/invalid preference to `click`.

Keep the existing timings:

```ts
HOVER_POLL_IDLE_MS = 120;
HOVER_POLL_EXPANDED_MS = 40;
openDelayMs = 110;
closeDelayMs = 280;
leaveMarginPx = 24;
```

The main process calls `stepHover()` on every poll with the selected mode. An `open` intent expands; a `close` intent collapses after the close delay. No renderer-side duplicate hover timer is allowed.

### 3.3 Fix the resident/painter circular dependency

Current renderer logic can hide the pill until `hovered` becomes true. If the pill is hidden, the user has no visible anchor and the user cannot know where to hover. Worse, a trigger zone that is only meaningful when the pill is painted can never bootstrap itself.

Create one shared pure predicate in `src/shared/halo/`:

```ts
interface HaloPresenceInput {
  enabled: boolean;
  resident: string;
  triggerMode: HoverTriggerMode;
  expanded: boolean;
  pinned: boolean;
  painterAvailable: boolean;
}

function canHoverOpen(input: HaloPresenceInput): boolean {
  return input.enabled
    && input.resident !== 'off'
    && input.painterAvailable
    && (input.triggerMode === 'hover' || input.triggerMode === 'hover-or-click');
}

function shouldPaintCompact(input: HaloPresenceInput): boolean {
  if (!input.enabled || input.resident === 'off') return false;
  return input.resident === 'always'
    || canHoverOpen(input)
    || input.expanded
    || input.pinned;
}
```

The renderer uses `shouldPaintCompact()` to determine whether the compact pill is painted. The main process uses `canHoverOpen()` to determine whether it should poll/act on hover. Do not make either predicate depend on `hovered`; `hovered` is the result of the poll, not a prerequisite for the poll.

If the user selects `resident = 'off'`, do not poll a hidden pill and do not show a hot zone. If `resident !== 'off'` and hover mode is selected, the compact pill remains visible in its collapsed state; hovering expands it. This is the intentional behavior required to make hover discoverable and reliable.

### 3.4 Single painter ownership

The current single-painter rule returns `null` from the in-app renderer whenever `inApp && prefs.enabled && prefs.resident !== 'off'`. That assumes the cross-app host is actually healthy. It is unsafe because an unavailable/failed host then leaves no painter.

Introduce a host health state owned by main:

```ts
type HaloPainter = 'cross-app' | 'in-app' | 'none';
```

Main publishes `painter` in the Halo snapshot. Rules:

1. `cross-app` only after the host is created, loaded, visible, geometry-resolved, and able to receive fresh hover samples.
2. If host creation/load/heartbeat fails, switch to `in-app` when the RHEO main window is available.
3. In-app OverlayRoot returns `null` only when `painter === 'cross-app'` and `prefs.enabled && prefs.resident !== 'off'`.
4. Never paint both versions at the same time.
5. If neither painter is available, Halo is hidden and the application remains healthy.

`showPill` should be derived from `shouldPaintCompact()` plus the selected painter. It must not be independently reimplemented in three components.

### 3.5 Hover state readback and watchdog

Add a diagnostic snapshot available through the existing `halo:get-snapshot` debug path:

```ts
interface HaloHoverDiagnostic {
  enabled: boolean;
  triggerMode: HoverTriggerMode;
  painter: HaloPainter;
  phase: 'idle' | 'expanding' | 'expanded' | 'collapsing';
  cursor: { x: number; y: number } | null;
  compactRect: Rect;
  hotZone: Rect;
  insideHotZone: boolean;
  lastIntent: 'open' | 'close' | null;
  lastTransitionAt: number | null;
  pollIntervalMs: number;
}
```

When mode is hover-capable, painter is cross-app, and the cursor remains inside `hotZone`, a transition from `idle` to `expanding`/`expanded` must occur within `openDelayMs + 2 * HOVER_POLL_IDLE_MS + HOVER_POLL_EXPANDED_MS` (380 ms). Use 500 ms as the watchdog threshold to allow scheduling jitter. If it does not occur, log one structured failure for that failed entry attempt and expose the diagnostic snapshot. Do not log the same failure on every poll.

The watchdog must distinguish:
- pointer did not enter the hot zone;
- trigger mode disallows hover;
- resident is off;
- painter is unavailable;
- cursor provider returned null/stale;
- FSM accepted entry but renderer did not paint expanded state.

### 3.6 Files to change

| File | Change |
|---|---|
| `src/shared/halo/hoverMachine.ts` | Keep the pure FSM; add tests for modes, timing and hysteresis. Do not duplicate state logic. |
| `src/shared/halo/geometry.ts` | Ensure hot-zone calculation uses compact rect + padding and bounds, not canvas bounds. |
| `src/shared/halo/types.ts` | Add typed painter/hover diagnostic snapshot if needed. |
| `src/main/halo/haloIsland.ts` | Use shared presence predicate; poll at existing rates; expose transition readback; retain focusless show behavior. |
| `src/features/halo/OverlayRoot.tsx` | Derive `showPill` from shared predicate and painter; remove `hovered` bootstrap dependency. |
| `src/features/halo/HaloPreferences.ts` | Preserve `trigger.mode` default `'hover'`; keep current preference values and padding keys. |
| `src/preload.ts` | Expose only the typed readback if absent; do not expose raw `ipcRenderer`. |

---

## 4. Drag position and persistence

### 4.1 Gesture contract

Implement the gesture on the compact pill's non-interactive surface in `CompactPill.tsx` or its immediate wrapper. Do not make child buttons or links draggable.

Exact gesture:

1. `pointerdown`: record pointer id, `screenX/screenY`, current `{dragX, dragY}`, start timestamp; do not prevent a normal click yet.
2. Hold for **350 ms**. If the pointer is released before 350 ms, execute the normal click/activation behavior.
3. After the hold threshold, movement of at least **4 px** in either axis enters drag mode. Use pointer capture so leaving the pill does not terminate the gesture.
4. While dragging, compute `nextX = clamp(startDragX + (screenX - startScreenX), -HALO_DRAG_MAX, +HALO_DRAG_MAX)` and likewise for Y. `HALO_DRAG_MAX` remains 600.
5. Send transient preview geometry to main; do not write preferences on every pointer move.
6. On `pointerup`, commit the final drag values through the existing `set-preference` path, then release pointer capture.
7. On `pointercancel`, Escape, host loss, or display removal, discard the preview and restore the last persisted offset.
8. Suppress the click that would otherwise fire after a completed drag.

No spring animation. Use a short linear/ease transition only when not actively dragging; while dragging, follow the pointer directly.

### 4.2 Preference write

Persist the existing `HaloPreferences.dragX` and `dragY`; do not create a new preference namespace or new database table.

Use the same `set-preference` IPC path already used for preferences. Prefer one existing object/batch preference write for both fields so they commit atomically. If the current setter only supports scalar keys, issue both writes through the existing setter and wait for both acknowledgements before treating the drag as saved. Do not create a second persistence mechanism in localStorage or in the Halo host.

Clamp once in the renderer for immediate feedback and again in the main/preference normalizer as the trust boundary:

```ts
const clampDrag = (n: number) => Math.max(-HALO_DRAG_MAX, Math.min(HALO_DRAG_MAX, Math.round(n)));
```

Reject non-finite values; never coerce `NaN` to zero silently without recording an invalid preference diagnostic.

### 4.3 Shared geometry application

Create one helper that applies the preference offset to the computed anchor:

```ts
const offsetRect = (rect: Rect, dragX: number, dragY: number): Rect => ({
  ...rect,
  x: rect.x + clampDrag(dragX),
  y: rect.y + clampDrag(dragY),
});
```

Use this exact resolved rectangle for:
- `OverlayRoot` in-app `marginLeft` / `marginTop` (or the equivalent absolute position style already used);
- main-process cross-app host placement;
- the compact rect consumed by `computeHotZone`;
- settings preview/calibration if present.

The host must not apply the offset a second time after geometry has already included it. Do not separately mutate `top`, margin and native `setPosition` with the same delta.

For an Electron host use `setPosition()`/the existing geometry adapter with the final offset rectangle. If the active cross-app host is the layer-shell adapter, update that adapter's margins with the same final rectangle. Keep platform-specific placement inside `haloIsland.ts`/the host adapter, never in React.

### 4.4 Display changes and restart

- On startup, normalize persisted `dragX`/`dragY` then recompute the host rect for the selected display.
- On display topology, resolution, DPI, or primary-display changes, recompute the base anchor and reapply the same saved offsets. Do not reset user position merely because the display changed.
- After recomputing, clamp the final rect to keep at least the full pill visible within the target display's safe bounds. The user preference remains within ±600; the per-display visible clamp may be tighter.
- On restart, the pill must return to the saved offset before hover polling is enabled. Never sample a stale old rect and open against it.

### 4.5 Reset gesture

Use **double-click on the non-interactive pill surface** to reset position to `{dragX: 0, dragY: 0}`. Do not assign both double-click and long-press to reset because long-press is the drag gesture. Reset writes through the same preference path and moves the host/in-app pill using the shared geometry helper.

### 4.6 Files to change

| File | Change |
|---|---|
| `src/features/halo/CompactPill.tsx` | Add pointer hold/drag gesture, 4 px threshold, pointer capture, click suppression and double-click reset. |
| `src/features/halo/OverlayRoot.tsx` | Apply the preview/persisted offset through shared geometry; do not own native placement. |
| `src/features/halo/HaloPreferences.ts` | Keep drag fields; centralize finite-number normalization and ±600 clamp. |
| `src/shared/halo/geometry.ts` | Add shared offset rectangle / safe-display clamp helpers. |
| `src/main/halo/haloIsland.ts` | Receive transient drag preview, update host geometry, persist only on commit through existing `set-preference` flow. |
| `src/preload.ts` | Add typed preview/commit bridge only if no existing safe bridge can express it; the preference commit must still use `set-preference`. |

---

## 5. Focus, Stopwatch and Schedule page functionality

### 5.1 Separate the three concepts

The Focus page must not derive its session status from the productivity stopwatch. They represent different domain concepts:

- **Focus session:** an intentional session with its own `startedAt`, `endsAt`, status, pause/resume and end semantics.
- **Productivity stopwatch:** accumulated tracking duration from `stopwatchStore`, broken down by tier/display policy.
- **Schedule:** nearest class block and open deadlines/alarms from the existing Life/Schedule data source.

A missing Focus session must not be interpreted as a zero stopwatch. A stopwatch running must not imply that a Focus session exists.

### 5.2 Focus data contract

Use the same persisted Focus session model/service used by the live UI:

`/activity` → `FocusTab` → `src/features/focus/FocusSection.tsx`.

Do not wire `src/pages/FocusPage.tsx`; the supplied context explicitly says it is imported but not routed. Do not use the unreferenced `FocusSessionCard.tsx` as the source of truth.

The Halo `FocusPayload` must contain the active session fields already available from that service:

```ts
interface FocusPayload {
  sessionId: string;
  status: 'running' | 'paused';
  startedAt: number;       // epoch milliseconds
  endsAt: number;          // epoch milliseconds
  pausedAt?: number | null;
  label?: string | null;
}
```

If the real Focus model uses ISO strings or a different status union, map it in one adapter at the main-process boundary. Do not change the canonical Focus model to match Halo.

Time math:

```ts
const remainingMs = status === 'paused'
  ? Math.max(0, pausedRemainingMs)
  : Math.max(0, endsAt - nowMs);
```

For a running session, `endsAt` is authoritative. `startedAt` is used for elapsed/progress display and sanity checks. For a paused session, use the service's saved remaining duration or the paused `endsAt` convention; do not continue decrementing a paused countdown locally.

### 5.3 Focus IPC and actions

Reuse the existing `halo:get-snapshot` for initial Halo state and `halo:report-stream` for live updates. The snapshot must include `focus` from the real Focus service. The stream emits a new focus payload whenever a session starts, pauses, resumes, ends, or is edited.

Use one typed action command for the Halo Focus controls:

```ts
type HaloFocusCommand =
  | { action: 'pause'; sessionId: string }
  | { action: 'resume'; sessionId: string }
  | { action: 'end'; sessionId: string };
```

Channel: `halo:focus-command` (new adapter only if no existing Focus action bridge is directly reusable). Main validates `sessionId` and command, then calls the same Focus service function used by `FocusSection`. It must not duplicate Focus business rules or write a second Focus table. The authoritative Focus service returns the updated session; main republishes it on `halo:report-stream`.

Focus UI behavior:
- Loading: static timer-shaped skeleton.
- Empty: `No active focus session`.
- Error: `Focus data unavailable` plus Retry.
- Running: live remaining time, progress, Pause, End.
- Paused: frozen remaining time, Resume, End.
- Expired: show `Focus session complete`; do not silently roll it into another session.
- Retry: re-request the current snapshot through the existing `halo:get-snapshot` boundary.
- Edit/open: use `bridge.navigate('/activity?tab=focus')`.

Controls must disable while their command is in flight. Duplicate clicks with the same command/session id must be idempotent or rejected as stale by the Focus service.

### 5.4 Stopwatch data and control path

`src/lib/stopwatchStore.ts` is the single state writer and persistence owner in the main RHEO renderer. The island renderer is a consumer.

Data flow:

```text
main RHEO renderer stopwatchStore
  -> persist rheo-stopwatch-v1
  -> publish existing stopwatch:publish payload
  -> main validates with validateStopwatchPayload
  -> main updates last-known-good cache
  -> main relays to cross-app Halo
  -> OverlayRoot / StopwatchHero / CompactPill
```

Initial island mount requests the existing `halo:get-snapshot`; do not wait indefinitely for the next publish.

Island controls cannot call methods on their own renderer-local copy of `stopwatchStore`. They must send a command to the owner renderer:

```ts
type HaloStopwatchCommand =
  | { action: 'pause'; requestId: string }
  | { action: 'resume'; requestId: string }
  | { action: 'reset'; requestId: string };
```

Use `halo:stopwatch-command` from the island to main. Main forwards the command to the main RHEO renderer, which invokes the real store method. The owner renderer then publishes the new snapshot through `stopwatch:publish`. The island does not optimistically mutate its timer value. It may show a pending control state until the authoritative publish arrives.

### 5.5 Schedule data contract

Use the existing Life/Schedule data source. The Schedule page must display:

1. The nearest upcoming class block (or a truthful empty state if none exists).
2. Every open deadline, with its due date/time, overdue status, and alarm status.
3. Existing tracking state for a deadline, if present.

The `life` snapshot passed to `SchedulePageRow` must be created by one main-process adapter and include the fields needed by its existing props. Do not query a second, unrelated schedule source in the Halo renderer.

Initial data: `halo:get-snapshot`. Live updates: `halo:report-stream`. Retry: refresh the same snapshot/data service. Track toggle, alarm add, and alarm delete must call the existing Life/Schedule domain actions. If a required action handler is actually absent, mark that control unavailable with an explicit error; do not wire a decorative button that does nothing.

Schedule UI:
- Nearest class block is pinned at the top of the page content.
- Open deadlines are listed below it, sorted by next due instant ascending, then stable id.
- Each deadline row shows an alarm indicator and an explicit action to add/remove an alarm.
- Keep the page's existing fixed `rowHeight` contract. Use one row height for every deadline row; do not increase the overall Halo window height to fit more rows.
- Put the deadline list in an internal scroll container whose height is the remaining page viewport after header and class block.
- `onWheelCapture` in the scroll container must stop propagation to the page/tab-rail gesture handler, while allowing the inner scroll container itself to scroll. Wheel scrolling over the list must never flip the Halo page.
- A large number of deadlines must not create an outer-window scrollbar.

Schedule states:
- Loading: fixed-height skeleton rows.
- Empty: `No upcoming classes or deadlines`.
- Error: `Schedule unavailable` plus Retry.
- Populated: nearest class + all open deadline rows.
- Alarm action error: preserve the row and show a local inline error; do not clear the deadline.

### 5.6 Page/IPC/backend audit

| Surface | Initial data | Live data | Actions | Authority / status |
|---|---|---|---|---|
| Focus | `halo:get-snapshot` includes real `focus` | `halo:report-stream` focus updates | `halo:focus-command` adapter maps to existing Focus service pause/resume/end | Real Focus feature is authoritative. `halo:get-focus` in the old comment is not proven as an exact channel; do not assume it exists. |
| Stopwatch | `halo:get-snapshot` includes last-good stopwatch | `stopwatch:publish` → main cache → Halo relay | `halo:stopwatch-command` → main → owner renderer `stopwatchStore` | `stopwatchStore` is sole writer. `stopwatch:publish` and `halo:get-snapshot` are existing per bundle. |
| Schedule | `halo:get-snapshot` includes `life` / schedule payload | `halo:report-stream` life/deadline updates | existing Life/Schedule tracking and alarm handlers via typed Halo adapter | Existing data source is expected; exact underlying Life channel names are not in the supplied excerpts and must be verified before binding. |

### 5.7 Files to change

| File | Change |
|---|---|
| `src/features/halo/OverlayRoot.tsx` | Bind `focus` to real Focus payload; bind `life` to schedule payload; wire loading/error/empty and retry states. |
| `src/features/halo/FocusPageRow.tsx` | Use Focus session fields and Focus controls; remove dependence on stopwatch state for Focus session existence/countdown. |
| `src/features/halo/StopwatchHero.tsx` | Consume validated relay snapshot; key/rebase display on reset counter and revision. |
| `src/features/halo/SchedulePageRow.tsx` | Sort nearest class/deadlines, render alarms, internal scroll, prevent wheel propagation. |
| `src/main/halo/haloIsland.ts` | Compose snapshot; forward typed focus/stopwatch/schedule actions; relay last-good snapshots. |
| `src/main.ts` | Add or connect adapters to existing Focus and Life/Schedule services; do not duplicate their business logic. |
| `src/lib/stopwatchStore.ts` | Expose owner-side command handler; remain sole localStorage writer. |
| `src/shared/halo/types.ts` | Define Focus/Schedule payloads and command unions. |
| `src/preload.ts`, `src/preload2.ts` | Expose narrow typed methods only; keep context isolation and existing wrapper shape. |

---

## 6. Stopwatch reset integrity

### 6.1 Single-writer contract

The only writer of `localStorage['rheo-stopwatch-v1']` is the main app renderer's `stopwatchStore` singleton. This applies to every reset path, including tier changes and AFK handling.

- Main process: validates/cache/relays snapshots; it does not mutate persisted stopwatch state.
- Island renderer: displays snapshots and sends commands; it never persists or directly calls a second store instance.
- Main app renderer: applies policy events to the store and persists the resulting state.
- Other windows: may request a command or read a snapshot; they cannot overwrite the store.

If a reset policy is currently decided in `src/main.ts` or `src/lib/afk.ts`, send a typed policy command to the store owner. Do not independently zero values in both main and renderer.

### 6.2 Reset-vs-pause matrix

| Trigger | Required behavior | Increment `resetCount`? | Reason |
|---|---|---:|---|
| Manual Reset button | Zero the stopwatch accumulators/buckets for the current tracking day, set display to zero, persist | Yes | Explicit user reset |
| Day rollover in `hydrate()` | Create the new day state with zero daily totals and new `dayKey`; preserve any historical prior-day record outside the active store if the existing model has it | Yes, when a real prior-day state is replaced | A new daily stopwatch period has begun |
| Tier flip with `neutralAction === 'reset'` | Apply the configured reset policy exactly once to the affected stopwatch buckets; publish the new snapshot | Yes | Explicit configured reset behavior |
| Tier flip when `neutralAction !== 'reset'` | Continue or pause according to the configured action; do not clear accumulated totals | No | A classification change is not automatically a reset |
| AFK entry / AFK threshold | Pause/close the active timing segment and stop accumulating while inactive; preserve already accumulated daily totals | No | AFK is not permission to destroy recorded time |
| AFK-specific `shouldResetStopwatch` returns true | Treat as one explicit policy reset, not as a side effect of every AFK poll; call the same `reset(reason='afk-policy')` path | Yes | Preserve an existing explicit AFK reset policy while making it deterministic |
| Suspend / resume gap | Close the current observation segment at last known good observation; pause until tracking resumes; never add unobserved suspended duration | No | Sleep is an observation gap, not a timer reset |
| Renderer reload | Hydrate from persisted snapshot; never zero merely because a module reloaded | No | Reload is not a user reset |
| Island renderer reload | Re-fetch `halo:get-snapshot`; do not hydrate/persist a separate stopwatch instance | No | Island is a consumer only |

Important: `shouldResetStopwatch` must be evaluated on a state transition, not on every poll while AFK remains true. Debounce/guard the reset by an AFK transition id or a consumed event id. That prevents repeated resets in one continuous AFK interval.

### 6.3 Reset counter and revision

Keep `resetCount` and make it mandatory in every published `StopwatchPayload`. It increments exactly once for every actual reset path in §6.2. It does not increment for pause/resume, ordinary tick, renderer reload, or malformed publish rejection.

Add a monotonic `revision` to the persisted and relayed snapshot if the current payload does not already have an equivalent sequence/version field. Increment it for every authoritative store mutation/publish. Do not use wall-clock milliseconds as the ordering mechanism.

Consumer rules:

- `StopwatchHero`, `CompactPill` (`stopwatch` and `stopwatchSite`) and any numeric interpolation must observe `{dayKey, resetCount, revision}`.
- If `resetCount` changes, cancel any in-flight interpolation and immediately render the new authoritative value. Use `key={`${dayKey}:${resetCount}`}` for the timer-value subtree where necessary.
- If `revision` is older than the consumer's current revision for the same day, ignore it.
- A different `dayKey` is accepted only when it matches the current local day or is the expected day-rollover transition from the store owner.
- `useSyncExternalStore` must receive a stable snapshot object between publishes; do not construct a new object on every `getSnapshot()` call.

### 6.4 Payload validation

`validateStopwatchPayload(raw)` remains the single boundary validator in `src/shared/halo/stopwatchRelay.ts`. It must reject malformed payloads and return `null`; the main cache must never be replaced by an invalid value.

Validate at minimum:

1. `raw` is a non-null plain object, not an array.
2. Required string fields (including `dayKey`) are strings with the expected bounded format. `dayKey` must match `YYYY-MM-DD` and parse as a real local date.
3. `resetCount` and `revision` are safe non-negative integers. `resetCount` may not decrease within the same `dayKey`; `revision` must strictly increase for a new publish within the same store epoch.
4. Every duration field in the existing payload is finite, integer, non-negative, and no greater than `MAX_MS = 7 * 24 * 60 * 60 * 1000`.
5. Any required enum such as `displaySource` belongs to its existing declared union. Do not accept arbitrary strings.
6. Optional app/domain labels are bounded strings or the explicitly allowed `null` / `undefined` values. Reject oversized strings and unexpected object values.
7. Fields that represent timestamps must be finite epoch milliseconds; reject invalid dates, `NaN`, infinities, and implausibly future timestamps.
8. Cross-field invariants must match the actual store's calculation. If the payload exposes bucket totals and a derived display total, validate the documented relationship in `stopwatchStore`; do not invent a sum formula that disagrees with neutral/action policy.

Keep `MAX_MS` at 7 days as already specified. Do not silently clamp malformed values into acceptable-looking data.

### 6.5 Keep-last-known-good relay

Main maintains:

```ts
let lastGoodStopwatch: StopwatchPayload | null = null;
```

On `stopwatch:publish`:

1. Call `validateStopwatchPayload`.
2. If invalid, retain `lastGoodStopwatch`, increment a diagnostic rejection counter, log the reason once per reason per time window, and do not relay the invalid payload.
3. If valid but stale (`revision` not newer for same store epoch), ignore it and record a stale-publish diagnostic.
4. If valid and newer, deep-freeze or treat as immutable, replace `lastGoodStopwatch`, then relay to the Halo host.
5. On island mount/reload, return the last-good cache in `halo:get-snapshot` before waiting for a new update.
6. If no last-good snapshot exists, return an explicit loading/unavailable state, not a fabricated zero snapshot.

On owner renderer reload, the owner store rehydrates persisted state and republishes it. Main must not clear the last-good cache merely because the renderer temporarily reloads.

### 6.6 Files to change

| File | Change |
|---|---|
| `src/lib/stopwatchStore.ts` | Centralize reset/pause policy; sole storage writer; monotonic revision; idempotent AFK reset handling; reload hydration that preserves values. |
| `src/lib/afk.ts` | Emit one AFK transition/policy command; do not call reset every poll. Preserve current configured reset policy through the single store reset path. |
| `src/main.ts` | Forward external tier/AFK policy transitions to the owner renderer; do not write stopwatch values itself. |
| `src/shared/halo/stopwatchRelay.ts` | Strengthen validator; preserve MAX_MS; add resetCount/revision checks. |
| `src/main/halo/haloIsland.ts` | Keep last-known-good snapshot; reject stale/malformed updates; re-send on snapshot request. |
| `src/features/halo/StopwatchHero.tsx` | Re-key/rebase on dayKey/resetCount; ignore stale revisions. |
| `src/features/halo/CompactPill.tsx` | Same timer revision/reset handling for stopwatchSite/stopwatch compact kinds. |
| `src/features/halo/OverlayRoot.tsx` | Use stable snapshots and explicit loading/error state. |

---

## 7. IPC and module contract

### 7.1 Existing channels to preserve

| Channel | Direction | Current evidence | Required use |
|---|---|---|---|
| `halo:get-snapshot` | renderer → main | Existing snapshot pull per context bundle | Initial full snapshot: current app/domain, prefs, activities, last-good stopwatch, Focus payload, Life/Schedule payload, painter/hover diagnostic if requested. |
| `halo:report-stream` | main → Halo renderer | Existing report stream per context bundle | Live updates for `now`, stopwatch, focus, schedule/life, and producers. Preserve the current envelope format; add missing fields without breaking existing consumers. |
| `stopwatch:publish` | main-app renderer → main | Existing channel in `stopwatchRelay.ts` | Validated owner-store snapshot only. |
| `browser-tracking-event` | main → renderer | Existing `clear` contract in context | Clear browser-site state or deliver accepted website state using the established event family. |
| `set-preference` | renderer → main | Existing preference path required by task | Commit `dragX` and `dragY` through the same preference mechanism. |
| `halo:navigate` | Halo renderer → main/app | Referenced but exact implementation must be verified | Navigate to `/activity?tab=focus` and existing app routes without direct Electron access from React. |
| `halo:close`, `halo:set-pinned` | Halo renderer → main | Listed in context as existing/referenced | Preserve; do not replace. |

### 7.2 Narrow typed command adapters

Add only if an existing typed bridge cannot already represent the action. All main-process handlers must use the repository's result/error wrapper shape and `electron_1.` prefix in `main.ts`.

```ts
type HaloCommand =
  | { kind: 'stopwatch'; action: 'pause' | 'resume' | 'reset'; requestId: string }
  | { kind: 'focus'; action: 'pause' | 'resume' | 'end'; sessionId: string; requestId: string }
  | { kind: 'schedule'; action: 'toggle-track'; deadlineId: string; requestId: string }
  | { kind: 'schedule'; action: 'add-alarm'; deadlineId: string; requestId: string }
  | { kind: 'schedule'; action: 'delete-alarm'; alarmId: string; requestId: string };
```

Recommended single command channel: `halo:command`. Main validates the discriminated union and forwards to the owner service/renderer. If the existing bridge already has equivalent command channels, reuse those exact channels instead of introducing duplicates. Do not expose raw `ipcRenderer` or `ipcMain` to React.

Validation rules:
- `requestId`: non-empty bounded string; deduplicate in-flight/recent requests.
- Every id: non-empty bounded string; verify it exists and belongs to the relevant user/profile before mutation.
- Every command: enum-validated; reject unknown keys/actions.
- Main is the IPC trust boundary; the domain service remains authoritative for ownership and business constraints.
- Return `{ ok: true, data }` or `{ ok: false, error }` matching the existing app wrapper. Do not invent an incompatible return envelope.

### 7.3 Browser site transport

Do not add a second browser tracker. `handleBrowserData` / `onWebActivity` remains the bridge. The accepted state is merged into the main current-app snapshot then published on `halo:report-stream`. Existing `browser-tracking-event { type: 'clear' }` remains authoritative for leaving website mode.

### 7.4 No database migration

These five defects do not require schema changes. Website domain is live context; hover/drag are preferences/geometry; Focus and Schedule use their existing domain stores; stopwatch remains in its existing localStorage store and relay. Do not add a duplicate DB table or persist website domains into session logs as a side effect of fixing the pill.

---

## 8. Observability and diagnostics

Add transition-oriented diagnostics. Do not add per-poll log spam.

| Event | Fields |
|---|---|
| `halo.website.accepted` | browser app, normalized domain or null, private flag, observation age, foreground validation result |
| `halo.website.cleared` | reason: foreground-change / stale / extension-clear / private / invalid |
| `halo.hover.transition` | previous phase, next phase, intent, mode, inside flag, trigger rect, poll interval |
| `halo.hover.watchdog` | mode, painter, cursor, trigger rect, `insideHotZone`, phase, reason |
| `halo.drag.commit` | old offset, new offset, clamped flag, display id |
| `halo.drag.cancel` | reason and restored offset |
| `halo.focus.command` | command, session id, success/error, request id |
| `halo.schedule.command` | command, entity id, success/error |
| `stopwatch.publish.accepted` | dayKey, resetCount, revision |
| `stopwatch.publish.rejected` | validation reason, payload type/field name only; never dump full payload |
| `stopwatch.reset` | reason, prior/new resetCount, dayKey |
| `stopwatch.pause` | reason, dayKey, revision |

Rate-limit identical failure diagnostics to one per reason per 10 seconds, while maintaining counters. Never log full browser URLs, document titles, private-window data, or sensitive payloads.

---

## 9. Regression probes

No test runner exists. Add pure-logic probes under `agent/probes/`, run with `npx tsx`. Existing app build remains CZ-owned.

### 9.1 `halo-website-domain.probe.mts`

Assertions:
1. `domain === undefined` is classified as non-browser.
2. `domain === null` is classified as browser-with-unknown-site.
3. A valid hostname string is classified as browser-with-known-site.
4. `isPrivate === true` always wins over a previously valid domain.
5. Private state never returns a domain string.
6. Normal idle browser selects `website`.
7. Tracked browser selects `stopwatchSite`.
8. Browser with null domain still selects website/stopwatchSite and renders `Site unavailable`.
9. Non-browser with `displaySource === 'idle'` remains non-browser/stopwatch, not website.
10. Foreground app switch clears the old domain immediately.
11. Site observation from a different browser app is rejected.
12. Stale site observation clears to null for a still-foreground browser.
13. Stale site observation cannot restore an old domain after a clear.
14. A fresh matching observation populates domain.
15. `freshForegroundIsBrowser() === null` does not cause unconditional rejection when cached foreground identity matches.
16. `freshForegroundIsBrowser() === false` rejects the observation and emits clear.
17. Malformed domain / invalid URL is rejected.
18. Full URL/query/path is never displayed or published as domain.
19. No domain event for a non-browser foreground app can enter website mode.
20. Private window after normal tab clears the prior hostname.

### 9.2 `halo-hover-presence.probe.mts`

Assertions:
1. `click` trigger mode does not hover-open.
2. `hotkey` trigger mode does not hover-open.
3. `hover` trigger mode enables hover.
4. `hover-or-click` enables hover.
5. `resident === 'off'` disables hover and compact painting.
6. Enabled + resident not off + hover mode paints collapsed compact pill before hover.
7. `shouldPaintCompact` and `canHoverOpen` agree on eligibility.
8. Hidden/unavailable cross-app painter does not arm cross-app hover.
9. The in-app painter activates when the cross-app host is unhealthy.
10. Both painters are never selected simultaneously.
11. `hotZone` equals compact rect plus configured padding, not canvas.
12. Zero padding leaves the hot zone equal to compact rect.
13. User padding expands only the configured sides.
14. Expanded keep-open region is union of compact hot zone and expanded rect.
15. Leave margin 24 px applies only to hysteresis; it does not create a permanent click region.
16. Open delay uses 110 ms.
17. Close delay uses 280 ms.
18. Idle polling uses 120 ms.
19. Expanded polling uses 40 ms.
20. After a valid entry, FSM transitions to expanding/expanded within expected poll tolerance.
21. No open intent is produced when cursor is outside hot zone.
22. Painter loss cancels hover and selects fallback/none safely.
23. Hover never calls focus/activate on the BrowserWindow.
24. Diagnostic readback reports actual rect, cursor, mode, phase and painter.

### 9.3 `halo-drag-geometry.probe.mts`

Assertions:
1. Pointer release before 350 ms is a normal click, not a drag.
2. Long press plus movement of 4 px enters drag.
3. Movement below 4 px does not enter drag.
4. Pointer capture keeps drag active after leaving pill bounds.
5. Delta is computed from pointer-down origin, not accumulated per event.
6. X and Y are independently clamped to ±600.
7. NaN and Infinity are rejected.
8. Preview does not persist preferences.
9. Pointer release commits once.
10. Pointer cancel restores the persisted values.
11. Escape restores persisted values.
12. Double-click resets both values to zero.
13. In-app pill and cross-app host resolve to the same final rect.
14. Hot-zone geometry follows the dragged rect.
15. Display change recomputes base anchor and retains user offset.
16. Restart hydration restores saved values.
17. Safe-display clamp keeps the entire pill visible.
18. Commit uses the existing `set-preference` path.
19. No native host is moved from React directly.

### 9.4 `halo-pages-data.probe.mts`

Assertions:
1. Focus empty state is shown when there is no active Focus session, regardless of stopwatch value.
2. A running Focus session countdown derives from `endsAt`.
3. `startedAt` is used for progress/elapsed context, not substituted for `endsAt`.
4. Paused Focus session remaining time is frozen.
5. Resume updates from the authoritative Focus service payload.
6. End command uses the real session id.
7. Stale Focus command/session id is rejected safely.
8. Focus retry re-requests snapshot.
9. Schedule chooses the nearest upcoming class block.
10. Deadlines are sorted by due instant ascending.
11. All open deadlines remain present, not only the first.
12. Alarm presence is shown per deadline.
13. Add/delete alarm action uses the correct existing service id.
14. Tracking toggle uses the correct deadline id.
15. Empty and error state copy is distinct.
16. Long deadline list has fixed outer viewport height.
17. Wheel over list does not propagate into page/tab navigation.
18. Wheel scrolling remains possible inside list.
19. Focus / Schedule UI never treats missing data as numeric zero.

### 9.5 `halo-stopwatch-integrity.probe.mts`

Assertions:
1. Owner store is the only code path that writes `rheo-stopwatch-v1`.
2. Island renderer persistence guard returns before storage write.
3. Manual reset zeros counters and increments resetCount exactly once.
4. Day rollover creates new day state and increments resetCount exactly once.
5. `neutralAction === 'reset'` triggers one configured reset on a tier transition.
6. Other tier actions do not clear totals.
7. AFK entry pauses/ends active accumulation without erasing totals.
8. AFK reset policy, when explicitly true, executes once per AFK transition.
9. Continuous AFK polls do not repeatedly increment resetCount.
10. Suspend gap never adds the unobserved interval.
11. Renderer reload hydrates persisted values unchanged.
12. Island reload pulls last-good snapshot and never writes localStorage.
13. resetCount is a non-negative safe integer.
14. revision is a monotonically increasing safe integer.
15. Invalid dayKey is rejected.
16. Negative duration is rejected.
17. Non-finite duration is rejected.
18. Duration above MAX_MS is rejected.
19. Invalid displaySource is rejected.
20. Stale revision is rejected.
21. resetCount regression within same day is rejected.
22. A malformed publish leaves last-good cache intact.
23. A first malformed publish with no cache yields unavailable/loading, not fake zero.
24. Every actual reset consumer re-keys or rebases on dayKey/resetCount.
25. A pause/resume does not increment resetCount.

### 9.6 Existing probes and manual verification

- Keep all existing Halo probes green. Do not weaken or delete assertions to accommodate the implementation.
- Add source-level assertions to catch duplicate `showPill` logic, duplicate stopwatch storage writers, raw `ipcRenderer` exposure, and direct React-to-BrowserWindow access.
- Use `npx tsx agent/probes/<probe>.probe.mts` and require numeric assertion output.
- Run scoped TypeScript checks only on changed shared/main/renderer modules. Do not treat the known 8,000+ repository-wide errors as newly introduced by this task.
- Run `esbuild` parse checks on changed renderer and preload entries. Rebuild `preload.cjs` separately after the application build when CZ performs the build; do not assume `build.mjs` alone updated preload.
- Use Playwright against the dev server for actual renderer behavior. The agent must not run the application build.

Manual Playwright acceptance:
1. Bring a configured browser to foreground with a normal tab. Pill displays its verified domain.
2. Switch tabs. Pill changes domain without requiring a foreground-app change.
3. Open a private window. Pill shows `Private window` and no prior domain.
4. Disable/close extension. Pill shows `Site unavailable`, not stale domain.
5. Move cursor into the pill. It opens after the expected delay while another application has focus.
6. Move cursor away. It closes after leave grace without stealing focus.
7. Set resident off. Pill and hover hot zone both disappear.
8. Re-enable resident and hover. Collapsed pill appears and hover works.
9. Drag using long press, move, release. Both host and in-app fallback move; setting survives restart.
10. Change display/resolution. Pill remains at the saved relative offset and fully visible.
11. Start a Focus session in ActivityPage. Focus page reflects the same active session and correct remaining time.
12. Pause/resume/end from Halo. ActivityPage reflects the same state.
13. Populate upcoming class blocks and several deadlines with alarms. Schedule shows all open deadlines in a fixed scrolling region.
14. Wheel over deadlines scrolls list and does not switch Halo pages.
15. Pause/reset stopwatch from Halo. Main RHEO renderer and Halo agree after the next authoritative publish.
16. Reload main renderer and island renderer separately. Stopwatch totals persist and no false reset occurs.
17. Publish malformed and stale stopwatch payloads. Last-good timer remains on screen.
18. Simulate day rollover, tier reset, AFK transition, and repeated AFK polls. Each produces the exact reset/pause behavior in §6.2.

---

## 10. Implementation order and acceptance gates

Implement in this order. Do not begin the next phase while its gate is red.

### Phase 1 — stopwatch state ownership and relay

1. Audit every write to `rheo-stopwatch-v1`; make `stopwatchStore` the only writer.
2. Add revision/reset semantics and validator coverage.
3. Implement keep-last-known-good in main.
4. Route island pause/reset commands to owner renderer.
5. Add and run `halo-stopwatch-integrity.probe.mts`.

**Gate:** no reset on renderer reload; invalid/stale publish cannot replace last-good; all actual resets increment resetCount once.

### Phase 2 — browser-site domain contract

1. Update foreground transition to clear/tri-state domain correctly.
2. Merge extension `onWebActivity` into main's current NowPayload.
3. Republish joined NowPayload through existing stream/snapshot.
4. Update compact kind selection and unknown/private copy.
5. Add and run website probes.

**Gate:** tab switch updates domain; private/unknown/stale states cannot leak previous domain.

### Phase 3 — hover presence and diagnostics

1. Add shared presence predicates.
2. Tie compact painting and main hover eligibility to those predicates.
3. Confirm hot-zone geometry and leave hysteresis.
4. Add watchdog/state readback.
5. Add and run hover probes.

**Gate:** with hover mode and resident enabled, compact pill is already painted; entering its compact rect opens it over another application without focus theft; resident off disables both painter and hot zone.

### Phase 4 — drag

1. Add long-press gesture and pointer capture.
2. Add transient preview path.
3. Commit through existing preference setter on release.
4. Apply offset to both painter implementations through shared geometry.
5. Verify display changes/restart persistence.
6. Add and run drag probes.

**Gate:** preview, committed host geometry and in-app geometry are numerically identical; restart/display changes retain offset.

### Phase 5 — Focus and Schedule domain integration

1. Read the real Focus service/model used by `FocusSection`.
2. Add the Halo snapshot/stream adapter and action forwarding.
3. Bind FocusPageRow to real session fields and commands.
4. Read existing Life/Schedule data source for nearest class/open deadlines/alarms.
5. Connect tracking/alarm controls through existing service methods.
6. Implement internal scroll and wheel propagation control.
7. Add and run page-data probes.

**Gate:** Focus and Schedule display the same canonical data as their full-page features; all visible controls produce confirmed domain actions or honest disabled/error feedback.

### Phase 6 — integration verification

1. Run all pre-existing probes unchanged.
2. Run all five new probes.
3. Run scoped `tsc` and `esbuild` parse checks.
4. Run Playwright acceptance steps.
5. Produce a concise report listing pass/fail, platform tested, exact remaining limitations, and no claim of cross-app Wayland behavior unless actually tested.

**Final acceptance:** all five defects are reproduced before the patch, all five are covered by regression tests, no existing Halo probe regresses, no keyboard focus is stolen, and no hidden/invisible canvas becomes a larger desktop click target.

---

## 11. Open risks and assumptions

| Risk / assumption | How to verify | Required response if false |
|---|---|---|
| Extension site observations arrive at least every 3 seconds | Inspect actual extension heartbeat/event cadence in the browser bridge | Set TTL to 3× actual heartbeat interval, with 10 seconds as minimum. |
| The existing browser-data event can provide domain and verified private-window state | Inspect `handleBrowserData`, `onWebActivity`, extension payload and browser-specific permissions | If private state is unavailable, keep `isPrivate = undefined`; never infer private mode. If domain unavailable, display `Site unavailable`. |
| Existing `halo:report-stream` can carry the joined `NowPayload`, Focus and Life snapshots | Inspect its exact envelope and every consumer | Extend the envelope compatibly; do not add parallel competing streams. |
| Existing Focus service has pause/resume/end methods used by FocusSection | Trace `FocusSection` callbacks to their domain service | Add only a thin Halo adapter to those methods. Do not create a second Focus session state machine. |
| Existing Life/Schedule service has class/deadline/alarm actions | Trace Activity/Life page handlers and source data | Reuse those handlers. If absent, report the missing capability instead of adding fake controls. |
| The existing preference setter supports a combined drag preference update | Inspect `set-preference` handler and preload wrapper | Use two acknowledged writes through the same setter if batch is not supported; do not add a competing storage path. |
| Renderer reloads are not meant to reset stopwatch totals | Confirm current product intent and localStorage hydration semantics | Preserve existing day rollover behavior; any other reset must be an explicit policy event. |
| The cross-app host remains available on the current platform | Inspect actual host health and platform adapter | Fall back to in-app painter without hiding both or claiming native Wayland parity. |
| Existing stopwatch payload has an equivalent sequence field | Inspect `StopwatchPayload` and `stopwatchStore` snapshot | Add `revision` once to the shared shape; do not introduce multiple clocks/sequences. |

## 12. Non-goals and preservation rules

- Do not redesign or delete the five Figma boards.
- Do not remove `CompactPill`, `StopwatchHero`, `FocusPageRow`, `SchedulePageRow`, `DictationIsland`, or existing activity producers as part of this repair.
- Do not add a new chart library or a second timer implementation.
- Do not add database schema changes for domain, drag, or stopwatch relay.
- Do not move Electron APIs into React components.
- Do not introduce springs, bounce, decorative gradients/glow, glass chrome, raw hex values in TSX, or more than two font families in a view.
- Do not call `win.focus()` or allow the Halo host to steal keyboard focus.
- Do not allow hover trigger geometry to use the transparent canvas bounds.
- Do not make the island a second stopwatch writer.
- Do not treat a missing domain/focus/schedule payload as a successful zero-value result.

**Definition of done:** the website pill reflects the actual foreground browser tab; the compact pill opens on hover using its own visible geometry; drag changes and persists both painter positions; Focus, Stopwatch and Schedule operate on their real owner services; and timer totals survive reloads and ordinary AFK/suspend transitions without false resets.
