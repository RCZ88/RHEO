# Halo Island: Content Fit, Focus Grouping, and Cross-App Hover

**Status:** implementation specification derived from the self-contained prompt and `HALO_ISLAND_CURRENT_STATE.md` embedded with it. This is not a claim that files were edited or that compositor integration was run. The codebase source files themselves were not mounted, so source lines not present in the prompt are not fabricated. Geometry, existing probe count, environment, and stated fixes below are treated as supplied facts.

## 1. Diagnosis

### 1.1 Compact pill cutoff

The previous `.pill .n { max-width: 140px }` treated the label as though it owned the entire pill. The actual measured pill budgets are 182×28, 198×32, and 227×40. After reserving the fixed stopwatch children, the supplied measured label budgets are **100 / 109 / 131 px** (S/M/L). The previous 140px label therefore exceeded its budget by **40 / 31 / 9 px**.

The stated fix (`flex: 0 1 auto; min-width: 0` for the label; fixed children `flex-shrink: 0`; row `width/max-width:100%; min-width:0; overflow:hidden`) is the right flexbox correction. `min-width: 0` must apply to every flex ancestor between the pill and every text node expected to ellipsize; putting it only on the final `<span>` is insufficient if a parent keeps the default `min-width:auto`. `text-overflow:ellipsis` also needs `overflow:hidden` and `white-space:nowrap` on the actual text box.

**Verification limitation:** the prompt states that the stopwatch row has been fixed, but does not include the current `CompactPill.tsx`/`halo.css` contents. I cannot honestly assert that every descendant of all ten kinds already has the rule. The patch below standardizes the row and each truncating slot; the new probe should fail until all variants use it.

| Compact kind | Fixed children | Flexible/truncating content | Worst-case guarantee after patch |
|---|---|---|---|
| `stopwatch` | dot, elapsed time, divider | app name | label cap S/M/L = **100/109/131px**; outer row overflow = 0px |
| `stopwatchSite` | dot, elapsed time, divider | site name (e.g. `github.com`) | **100/109/131px** label cap; outer row overflow = 0px |
| `now` | app icon, verified age value | app name | name gets computed remainder; long name ellipsizes; outer row overflow = 0px |
| `website` | globe icon, verified age value | site name | name gets computed remainder; long host ellipsizes; outer row overflow = 0px |
| `private` | lock icon | `Private window` | label gets computed remainder; outer row overflow = 0px |
| `dictation` | mic icon, `Listening`/verified state | waveform takes only remainder and clips internally | wave cannot push label outside; outer row overflow = 0px |
| `aiUsage` | bot icon, verified percentage | usage bar | bar has `min-width:0`; percentage remains legible; outer row overflow = 0px |
| `hud` | terminal icon, count | `penguin-console` / title | title ellipsizes before count clips; outer row overflow = 0px |
| `nextDeadline` | calendar icon, compact due value | deadline title | title and due text each shrink/ellipsize; outer row overflow = 0px |
| `critical` | alert icon, signal state | alert title and due value | same bounded title/value contract; outer row overflow = 0px |

“Outer row overflow = 0px” is a structural guarantee from a bounded flex row plus clipped content, not a claim that all labels will fit in full. Text may ellipsize. Exact per-child rendered widths depend on the actual font, icon, gap, padding, and the current implementation; those measurements must be obtained by the regression probe in the built renderer, not guessed from the prompt.

### 1.2 Dictation palette

The supplied fixes are internally consistent: live/recording speech uses `--halo-accent`; `--halo-focus` is dead and removed; `--halo-signal` is reserved for warnings such as overdue deadlines. The remaining `AmbientCard.DOMAIN_CLASS` mapping from activity *kind* to `sky` / `sage` / `amber` violates the active rule **“on a data surface colour means TIER, never identity.”** A kind is identity; a tier is data. Giving `aiUsage` sky and `now` sage makes hue communicate the activity category, not the data value.

**Decision:** remove all kind-to-hue mappings from ambient data cards. Use neutral surface/border/text for activity identity; communicate identity through Lucide icon, title, and structure. Use `--halo-accent` only for live/recording/active status, and `--halo-signal` only for warning/error/overdue state. Tier hues may appear only beside an actual tier value and must use the existing tier palette. Do not add an extra accent to a whole card. This is a reduction, not a new palette.

### 1.3 Stopwatch app name is split from its timer

The current row has three blocks: `Stopwatch + clock`, `Tracking + Figma`, and `Productive + 3:12:40`, separated by two dividers. This contradicts the user’s semantic grouping: “Figma for 42 minutes” is one stopwatch fact, not a separate tracking card.

**Layout correction:** the left block becomes a single stopwatch hero group containing the status dot, `STOPWATCH`, the tracked app/site name, and the elapsed clock. Remove the separate `TRACKING` block and its divider. Keep exactly one divider between the entire left stopwatch group and the `PRODUCTIVE` block. Keep the spacer and the two 44×44 controls on the far right. The label `TRACKING` is not needed in the expanded header; the adjacent app name carries that meaning.

The change must not add a row. At medium, the supplied budget remains `12 + 56 + 8 + 44 + 12 = 132px` inside the 134px canvas, leaving 2px. At small, use the existing scale with **8px vertical padding, 50px content row, 8px gap, and 44px controls**: `8 + 50 + 8 + 44 + 8 = 118px`. At large, a 56px row with 12px padding and the same controls is 132px, within 154px. The actual measured window presets remain unchanged.

### 1.4 Cross-application hover

The app is a Wayland session on KDE, but Electron is forced to X11/XWayland by `start-dev.sh:368`. On that backend, Electron’s `setAlwaysOnTop` is an X11 stacking hint. A native Wayland window can be stacked above it by KWin; reasserting the X11 hint cannot turn the Electron window into a Wayland overlay-layer surface. Removing the X11 flag alone is not a complete fix: Electron’s Wayland backend does not expose the global coordinates and window-placement controls this hover implementation expects. Electron explicitly documents `win.setPosition()` and `screen.getCursorScreenPoint()` as unavailable on Wayland, and documents additional restrictions for `globalShortcut` and `desktopCapturer`.

The current global-pointer tools (`kdotool` / `hyprctl` / `wlrctl`) are reported as working 6/6. Keep them as the Wayland pointer-intent input. Do not replace the tested hover FSM or make Electron’s cursor APIs the source of truth on Wayland.

**Key input invariant:** the helper’s transparent canvas must never be an input target. In pass-through mode its Wayland input region is empty. When the user intentionally enters the *actual visible island surface*, input may be enabled only for that visible rectangle and its controls; all transparent canvas around it remains outside the input region. An interactive control necessarily receives its own click. If “never intercept a click” literally includes clicks directly on visible island buttons, then those controls must become display-only and be operated through a keyboard/portal-mediated command instead. No window-system design can both receive a button click and pass that same click through to the obscured app.

References: [Electron `setShape`](https://github.com/electron/electron/blob/main/docs/api/base-window.md), [Electron `setIgnoreMouseEvents`](https://www.electronjs.org/docs/latest/api/browser-window), [Electron’s Wayland API limitations](https://www.electronjs.org/blog/tech-talk-wayland), [wlr layer-shell protocol](https://wayland.app/protocols/wlr-layer-shell-unstable-v1).

## 2. Decision

### 2.1 Content layout decision

Merge `Stopwatch`, its elapsed clock, and the current tracked app/site into one left group. Remove the separate Tracking block. One divider remains, between that group and Productive. The two 44×44 actions stay fixed at the right. The three S/M/L canvas dimensions stay exactly **480×118, 560×134, 680×154**; the pill stays **182×28, 198×32, 227×40**.

### 2.2 Overlay architecture decision: GTK4 layer-shell host on supported Wayland

Use a **small GTK4 `gtk4-layer-shell` helper**, owning a `zwlr_layer_shell_v1` overlay surface, for KDE Plasma Wayland. This is not another Electron `BrowserWindow`; it is the native compositor surface required for real overlay-layer stacking. Host the shared Halo renderer in a GTK-compatible WebKitGTK view only after the small platform bridge is separated from Electron preload APIs. If the existing view has Chromium-only dependencies that cannot be isolated cleanly, port only the Halo view layer to the helper; do not attempt to parent an Electron Wayland surface inside another process (Wayland does not permit that architecture).

The layer is chosen because the prompt establishes that protocol v5 exists and GTK Layer Shell supports KDE Plasma Wayland. `GTK_LAYER_SHELL_LAYER_OVERLAY` requests the compositor’s overlay layer rather than an advisory X11 `ABOVE` hint. The helper uses the existing fixed S/M/L geometry; it must not remeasure or invent new window sizes.

- **Stacking:** GTK helper calls `gtk_layer_init_for_window()` before realization, sets `GTK_LAYER_SHELL_LAYER_OVERLAY`, anchors at the top edge, sets zero exclusive zone, and does not request keyboard focus. Do not use Electron `setAlwaysOnTop` to claim Wayland correctness.
- **Input:** call `gdk_surface_set_input_region()` with an empty region in pass-through state. In interaction-armed state, set the region only to the translated local rectangle for the visible pill/panel (`computeSurfaceRect`), not the full transparent canvas. Never enable the region solely because the panel expanded underneath the pointer.
- **Hover:** retain `stepHover()` and the proven `kdotool`/`hyprctl`/`wlrctl` path. Poll at the existing 120ms idle / 40ms expanded cadence. If an expanded panel appears under the current pointer, keep it pass-through until the pointer is observed outside the visible rect and then re-enters it. That prevents the expansion transition itself from arming an unexpected click capture.
- **Keyboard/focus:** `keyboard_interactivity = none` initially and no focus steal. Existing island actions work on pointer only when the pointer intentionally enters the visible hit region. A keyboard shortcut stays on its already-supported path; do not assume Electron’s `globalShortcut` will work under Wayland without desktop-portal support.
- **IPC:** Electron main remains the data and action authority. A local Unix-domain socket carries versioned JSON lines to/from the helper. The helper may render state and emit allow-listed commands; it never accesses SQLite, arbitrary filesystem paths, or unrestricted application IPC.
- **Lifecycle:** spawn helper only after capability detection; wait for `hello(protocolVersion=1)` before reporting overlay ready; heartbeat; restart at most 3 times with bounded backoff; if it fails, destroy its socket and keep RHEO running. Never silently fall back to a Wayland XWayland overlay that violates the guarantee.
- **Packaging:** add a small native build target under `native/halo-layer-shell/`; build/package the helper beside the app’s resources; verify the required GTK4, GTK Layer Shell, and WebKitGTK runtime libraries are available in the target Fedora package. The protocol is Linux Wayland-only. Keep the current Electron overlay adapter for macOS, Windows, and Linux X11, with every `setShape` call still platform-guarded. On Wayland compositors without layer-shell support, disable the cross-app overlay with an explicit capability message rather than pretending `always-on-top` is guaranteed.

### 2.3 Rejected alternatives

1. **Drop `--ozone-platform=x11` and use a regular Electron Wayland toplevel:** rejected as the final architecture. It improves native Wayland compatibility but does not give an ordinary toplevel the layer-shell overlay role. It also breaks/changes assumptions around global cursor coordinates, `setPosition`, shortcuts, and screen capture. Use this only as a diagnostic branch, not as the fix.
2. **Keep the current Electron `BrowserWindow` and keep reasserting always-on-top:** rejected. The stacking protocol semantics do not change when the hint is reasserted. An Electron XWayland window cannot reliably outrank native Wayland applications this way.
3. **Render the island only inside RHEO:** rejected because it removes cross-application presence.
4. **Use a second native overlay but keep its entire canvas interactive:** rejected. It repeats the hitbox bug. The helper’s input region must track the visible region, not its full surface allocation.

## 3. Implementation

> The following are exact new contracts and code patterns. Where the provided context does not expose the current function signature, integrate at the named call site rather than replacing unrelated files wholesale.

### 3.1 `src/features/halo/CompactPill.tsx` and `src/features/halo/halo.css`

Keep all ten existing compact kinds and their rendering. Route every kind through the same width-constrained row and truncating-slot classes. Do not change any preset dimensions.

```tsx
// Shared wrapper used by every existing CompactPill variant.
<div className={`halo-pill halo-pill--${kind}`} data-preset={preset}>
  {renderKindContent(kind, payload)}
</div>
```

```css
/* Outer pill dimensions continue to come from the existing S/M/L preset. */
.halo-pill {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--halo-pill-gap, 8px);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

/* Apply this to every flex ancestor that contains a truncating descendant. */
.halo-pill__group,
.halo-pill__label-slot,
.halo-pill__value-slot {
  min-width: 0;
  max-width: 100%;
}

/* Text, not its icon/value parent, gets the ellipsis. */
.halo-pill__text,
.halo-pill__name,
.halo-pill__secondary,
.halo-pill__deadline-title {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Icons, elapsed time and verified numeric values are non-shrinking. */
.halo-pill__icon,
.halo-pill__dot,
.halo-pill__time,
.halo-pill__metric,
.halo-pill__divider {
  flex: 0 0 auto;
}

/* Waveform is decorative: it uses only leftover width and cannot force overflow. */
.halo-pill__waveform {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  max-width: 48px;
  overflow: hidden;
  gap: 1px;
}
.halo-pill__waveform > span {
  flex: 0 0 2px;
  width: 2px;
}

/* AI usage bar may shrink to its minimum; percentage remains the pinned value. */
.halo-pill__usage-bar {
  flex: 1 1 0;
  min-width: 0;
  max-width: 48px;
  overflow: hidden;
}

/* Due/alert copy can ellipsize too; it is not a fixed-width second card. */
.halo-pill__due {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Important:** apply the classes to the actual mapped nodes in each current variant. A shared wrapper alone does not fix a descendant with `min-width:auto`, `flex-shrink:0`, a fixed `width`, or an unbounded child. Do not set the app/site label to `max-width:140px`; its effective width is the leftover space in that preset.

### 3.2 Add `src/shared/halo/compactBudget.ts`

This pure function keeps the sizing rule testable without Electron or DOM dependencies.

```ts
export type CompactPreset = 'small' | 'medium' | 'large';

export const COMPACT_PILL_WIDTH: Readonly<Record<CompactPreset, number>> = {
  small: 182,
  medium: 198,
  large: 227,
};

export interface CompactBudgetInput {
  preset: CompactPreset;
  horizontalPadding: number;
  fixedChildWidths: readonly number[];
  gaps: readonly number[];
  dividers?: readonly number[];
}

export function remainingCompactWidth(input: CompactBudgetInput): number {
  const gapWidth = input.gaps.reduce((sum, n) => sum + n, 0);
  const dividerWidth = (input.dividers ?? []).reduce((sum, n) => sum + n, 0);
  const fixedWidth = input.fixedChildWidths.reduce((sum, n) => sum + n, 0);
  return Math.max(
    0,
    COMPACT_PILL_WIDTH[input.preset] -
      input.horizontalPadding * 2 - fixedWidth - gapWidth - dividerWidth,
  );
}
```

Use the existing measured stopwatch cap values as regression fixtures for the current fixed-child/gap set: S=100, M=109, L=131. If the function does not reproduce those values, the DOM’s padding/gap/fixed-child fixture differs from the supplied measurement; inspect that mismatch rather than changing the preset width.

### 3.3 `src/features/halo/AmbientCard.tsx`

Delete the identity-hue mapping from `DOMAIN_CLASS`. Activity kind should not choose `sky`, `sage`, or `amber` card chrome.

```tsx
// Remove DOMAIN_CLASS[kind] from the ambient card class list.
<div className="ambient-card" data-kind={kind}>
  <ActivityIcon kind={kind} />
  <div className="ambient-card__body">...</div>
</div>
```

```css
.ambient-card {
  color: var(--halo-text);
  background: var(--halo-raised);
  border: 1px solid var(--halo-border);
}
.ambient-card__identity-icon { color: var(--halo-muted); }
.halo-status--active,
.halo-status--recording { color: var(--halo-accent); }
.halo-status--warning,
.halo-status--overdue,
.halo-status--error { color: var(--halo-signal); }
```

Keep tier colors only on the actual tier swatch/chip; don't use a tier token for an entire card. Dictation keeps `--halo-accent`/`--halo-dim`. Do not reintroduce `--halo-focus` or clay as a kind color.

### 3.4 `src/features/halo/FocusPageRow.tsx`

Replace three blocks and two dividers with two blocks and one divider in the **top data row**. The left hero contains dot + `STOPWATCH` + app/site name on its first line, and the elapsed clock on its second line. `Tracking` is no longer an independent block. Keep the existing action rail below the data row, aligned right, with both 44×44 controls unchanged.

```tsx
<div className={`focus-page focus-page--${preset}`}>
  <div className="focus-data-row">
    <section className="focus-stopwatch-group" aria-label="Stopwatch">
      <div className="focus-stopwatch-heading">
        <span className={`halo-pill__dot${stopped ? ' is-off' : ''}`} aria-hidden="true" />
        <span className="focus-eyebrow">Stopwatch</span>
        {trackedAppName ? (
          <span className="focus-tracked-app" title={trackedAppName}>
            <span aria-hidden="true">·</span> {trackedAppName}
          </span>
        ) : null}
      </div>
      <time className="focus-stopwatch-clock" dateTime={stopwatchIsoDuration}>
        {formattedStopwatch}
      </time>
    </section>

    <span className="focus-row-divider" aria-hidden="true" />

    <section className="focus-productive-group" aria-label="Productive time">
      <span className="focus-eyebrow">Productive</span>
      <time className="focus-productive-value" dateTime={productiveIsoDuration}>
        {formattedProductive}
      </time>
    </section>
    <span className="focus-row-spacer" />
  </div>

  <div className="focus-action-rail">
    <button className="focus-action" aria-label="Reset stopwatch">...</button>
    <button className="focus-action" aria-label={stopped ? 'Start stopwatch' : 'Pause stopwatch'}>...</button>
  </div>
</div>
```

Keep the existing action callbacks and icon/control body on those two buttons; `...` denotes the existing body, not a new implementation. Keep current `trackedAppName` privacy rules and actual data source. The app/site label must use the same min-width/ellipsis rules as a pill label.

```css
.focus-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
}
.focus-page--small { padding-block: 8px; }
.focus-page--medium,
.focus-page--large { padding-block: 12px; }

.focus-data-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 56px;
}
.focus-page--small .focus-data-row { height: 50px; }
.focus-stopwatch-group,
.focus-productive-group {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  height: 100%;
}
.focus-stopwatch-group { flex: 1 1 auto; }
.focus-stopwatch-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.focus-eyebrow {
  flex: 0 0 auto;
  font: 10px/14px Inter, sans-serif;
  letter-spacing: .08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.focus-tracked-app {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--halo-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.focus-stopwatch-clock {
  font: 26px/30px "JetBrains Mono", monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.focus-row-divider {
  flex: 0 0 1px;
  width: 1px;
  height: 32px;
  background: var(--halo-border);
}
.focus-productive-group { flex: 0 0 auto; max-width: 30%; }
.focus-productive-value {
  font: 14px/20px "JetBrains Mono", monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.focus-row-spacer { flex: 1 1 8px; min-width: 8px; }
.focus-action-rail {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  height: 44px;
  margin-top: 8px;
}
.focus-action { flex: 0 0 44px; width: 44px; height: 44px; }

.focus-page--small .focus-stopwatch-clock { font-size: 22px; line-height: 26px; }
```

The geometry is the supplied vertical stack, not a single 44px-high flex row: **S** `8 + 50 + 8 + 44 + 8 = 118px`; **M** `12 + 56 + 8 + 44 + 12 = 132px` inside 134px (2px slack); **L** `12 + 56 + 8 + 44 + 12 = 132px` inside 154px. The extra 22px at L remains slack. Do not add another data row, card, or divider.

### 3.5 New native helper: `native/halo-layer-shell/`

#### `meson.build`

```meson
project('rheo-halo-layer-shell', 'c', version: '1.0.0', default_options: ['c_std=c17', 'warning_level=2'])

add_project_arguments('-D_GNU_SOURCE', language: 'c')

deps = [
  dependency('gtk4'),
  dependency('gtk4-layer-shell-0'),
  dependency('webkitgtk-6.0'),
  dependency('json-glib-1.0'),
]

executable('rheo-halo-layer-shell', 'main.c', dependencies: deps, install: true)
```

Build this target only on Linux packages that provide all declared dependencies. Verify the precise `pkg-config` package names on Fedora 44 before wiring release packaging; if the system package names differ, update Meson to the installed names rather than removing the layer-shell capability check.

#### `main.c` — surface creation and layer assignment

```c
#include <gtk/gtk.h>
#include <gtk4-layer-shell.h>
#include <webkit/webkit.h>
#include <json-glib/json-glib.h>

static GtkWidget *window;
static WebKitWebView *web_view;
static gboolean input_armed = FALSE;

static void apply_input_region(gboolean armed,
                               int x, int y, int width, int height) {
  GdkSurface *surface = gtk_native_get_surface(GTK_NATIVE(window));
  if (surface == NULL) return;

  cairo_region_t *region = cairo_region_create();
  if (armed && width > 0 && height > 0) {
    cairo_rectangle_int_t rect = { x, y, width, height };
    cairo_region_union_rectangle(region, &rect);
  }
  /* Empty region means this layer surface receives no pointer input. */
  gdk_surface_set_input_region(surface, region);
  cairo_region_destroy(region);

  /* GTK event targeting must agree with the native region. */
  gtk_widget_set_can_target(GTK_WIDGET(web_view), armed);
  input_armed = armed;
}

static void activate(GtkApplication *app, gpointer user_data) {
  if (!gtk_layer_is_supported() || gtk_layer_get_protocol_version() < 1) {
    g_application_quit(G_APPLICATION(app));
    return;
  }

  window = gtk_application_window_new(app);
  gtk_window_set_decorated(GTK_WINDOW(window), FALSE);
  gtk_window_set_resizable(GTK_WINDOW(window), FALSE);
  gtk_window_set_focusable(GTK_WINDOW(window), FALSE);
  gtk_window_set_default_size(GTK_WINDOW(window), 560, 134);

  /* Must be called before the GtkWindow is realized. */
  gtk_layer_init_for_window(GTK_WINDOW(window));
  gtk_layer_set_namespace(GTK_WINDOW(window), "rheo-halo-island");
  gtk_layer_set_layer(GTK_WINDOW(window), GTK_LAYER_SHELL_LAYER_OVERLAY);
  gtk_layer_set_anchor(GTK_WINDOW(window), GTK_LAYER_SHELL_EDGE_TOP, TRUE);
  gtk_layer_set_margin(GTK_WINDOW(window), GTK_LAYER_SHELL_EDGE_TOP, 8);
  gtk_layer_set_exclusive_zone(GTK_WINDOW(window), 0);
  gtk_layer_set_keyboard_mode(GTK_WINDOW(window), GTK_LAYER_SHELL_KEYBOARD_MODE_NONE);

  web_view = WEBKIT_WEB_VIEW(webkit_web_view_new());
  const GdkRGBA transparent = { .red = 0.0, .green = 0.0, .blue = 0.0, .alpha = 0.0 };
  webkit_web_view_set_background_color(web_view, &transparent);
  gtk_widget_set_hexpand(GTK_WIDGET(web_view), TRUE);
  gtk_widget_set_vexpand(GTK_WIDGET(web_view), TRUE);
  gtk_window_set_child(GTK_WINDOW(window), GTK_WIDGET(web_view));

  /* Load only the packaged local Halo renderer; no remote URL. */
  webkit_web_view_load_uri(web_view, packaged_halo_file_uri());

  /* Start click-through. Geometry/input become live only on an explicit host command. */
  gtk_widget_set_can_target(GTK_WIDGET(web_view), FALSE);
  gtk_window_present(GTK_WINDOW(window));
  apply_input_region(FALSE, 0, 0, 0, 0);
  connect_host_socket();
}
```

This is the native-surface skeleton; `packaged_halo_file_uri()` and `connect_host_socket()` are two required functions implemented by the helper, not existing APIs. `gtk_layer_is_supported()`/protocol version must be checked at runtime. The child must send a protocol-version `hello` before the main process marks it ready. Before release, verify whether the WebKitGTK build creates child Wayland surfaces for accelerated content. If it does, the passthrough code must disable input on every such child surface too; a parent-only input region is not accepted as proof. The automated desktop input probe below is the ship gate. If child surfaces cannot be controlled reliably, ship a native GTK-rendered Halo view instead of accepting an unverified hit-test boundary.

**Input mode messages:**

```json
{"v":1,"type":"input-region","mode":"passthrough"}
{"v":1,"type":"input-region","mode":"armed","rect":{"x":189,"y":0,"width":182,"height":28}}
```

`rect` is local to the layer surface. Convert the result of `computeSurfaceRect(canvas, compactSize, edge)` by subtracting `canvas.x/y`; do not pass screen coordinates as local coordinates. The same geometry function must continue to feed placement, visible hit region, and hover hot zone. For rounded visual edges, a rectangular region is acceptable only if the entire rectangle is part of the visible pill/panel; otherwise use a scanline-composed Cairo region matching the visible rounded silhouette.

#### Input safety state machine

```text
COLLAPSED: empty region; global cursor poll only
EXPANDING: empty region; never arm because the window appeared under the cursor
EXPANDED_UNARMED: empty region; render visible surface but do not capture input
  pointer observed outside visible bounds -> eligible to arm
  pointer then re-enters visible bounds -> set region to visible rect; INTERACTIVE
INTERACTIVE: only visible rect accepts input; transparent canvas passes through
  pointer leaves visible rect -> clear region immediately; normal leave grace controls collapse
COLLAPSING: empty region immediately; animate pixels only; then COLLAPSED
```

Never set the input region to the full S/M/L window by default. Never turn input on merely because the hover FSM transitions to `expanded`. When interaction is armed, the region is the *actual island surface*, not `480×118`, `560×134`, or `680×154` if the visible surface is smaller. The two 44×44 Focus controls are within the intended visible surface and therefore intentionally receive their own clicks.

### 3.6 Main/renderer bridge

Add `src/shared/halo/hostProtocol.ts`:

```ts
export const HALO_HOST_PROTOCOL_VERSION = 1 as const;

export type HaloHostMessage =
  | { v: 1; type: 'hello'; protocolVersion: 1 }
  | { v: 1; type: 'state'; state: SerializedHaloState; geometry: HaloCanvasGeometry }
  | { v: 1; type: 'input-region'; mode: 'passthrough' }
  | { v: 1; type: 'input-region'; mode: 'armed'; rect: { x: number; y: number; width: number; height: number } }
  | { v: 1; type: 'command'; command: 'reset' | 'pause' | 'resume' | 'dismiss' | 'open-route'; route?: string };

export function isHaloHostMessage(value: unknown): value is HaloHostMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<HaloHostMessage>;
  return message.v === HALO_HOST_PROTOCOL_VERSION && typeof message.type === 'string';
}
```

`SerializedHaloState` and `HaloCanvasGeometry` should be imported from the real shared types rather than redefined. The minimal guard above is only a first envelope check; validate every field and allow-list every command/route before dispatch.

In `src/main/halo/haloIsland.ts`, select the host once during startup:

```ts
const isKdeWayland = process.platform === 'linux'
  && process.env.XDG_SESSION_TYPE === 'wayland'
  && /KDE/i.test(process.env.XDG_CURRENT_DESKTOP ?? '');

const host = isKdeWayland
  ? new LayerShellHaloHost(/* packaged helper path, existing state/action adapters */)
  : new ElectronHaloHost(/* current window manager, guarded by platform */);

await host.start();
```

`LayerShellHaloHost` starts the native executable, creates a private Unix socket endpoint under a user-private runtime directory, validates the helper handshake, and sends only serialized Halo state + geometry. Map helper commands back to existing action callbacks; do **not** add duplicate business logic to the helper and do not fabricate new commands for actions that do not already exist. The socket directory must be mode `0700`, the socket mode `0600`; cap a single JSONL message (for example 64 KiB), reject unknown versions, validate routes against the existing route list, and close the server/socket/process on stop and app quit.

The native helper connects to that socket; it does not open SQLite or use unrestricted IPC. Add heartbeat/exit handling. On helper exit, clear readiness, close socket, attempt at most three restarts with bounded backoff, then mark the overlay unavailable and leave the RHEO app running. Do not start the old XWayland overlay as a supposedly equivalent fallback in native Wayland.

Keep `setShape` guarded for the remaining Electron host. `setShape` is not available on macOS; every use must remain inside the existing platform guard. On X11, continue to use `setIgnoreMouseEvents(true)` for click-through, and never treat `setShape([])` as an empty region: Electron documents that an empty array resets shape to a rectangle.

### 3.7 `start-dev.sh` and build scripts

Do **not** globally remove `--ozone-platform=x11` before the helper path is working. The Halo layer-shell process uses the Wayland session directly while the main Electron app can retain its proven XWayland behavior for tray, shortcuts, and existing cursor tools. This is the key advantage of the helper architecture: the native overlay and main app need not use the same window backend.

Add a build task for the native helper (Meson configure + compile) and copy the executable into the app’s packaged resources. Startup order: create secure socket → spawn helper → wait for protocol handshake → publish initial geometry/state → enable hover FSM. Shutdown order: disarm input region → send `shutdown` → wait briefly → terminate helper if needed → close socket and remove private runtime directory.

## 4. Migration

1. **Commit current green state first.** Record all seven existing probes and the 255 assertion baseline. No geometry constants or current board components are removed.
2. **Land compact width guard and palette reduction.** Run the existing seven probes plus the new compact and palette probes. Open the built renderer in S/M/L and verify long app/site/deadline names ellipsize, waveform/usage bar shrink internally, no pill border clips, and no horizontal scrollbar appears.
3. **Land the Focus row refactor independently.** Verify visually at 480×118, 560×134, 680×154. At medium the measured row must remain within 132px plus the existing 2px slack. Confirm one divider only, app name on the stopwatch group, two 44×44 controls, and no new line/row.
4. **Build the layer-shell helper as a standalone spike.** Confirm `gtk_layer_is_supported()` true and protocol v5 detected on the target Fedora KDE Wayland session. Verify it anchors top-center and is stacked above Firefox and VS Code without focusing them. If the capability check fails, stop here; do not ship an advisory toplevel as the Wayland overlay.
5. **Verify pass-through before React integration.** Draw only a visible small test pill. Keep region empty and click/hover through it into a test page below. Then arm a region matching only the visible pill and prove a click outside the rectangle reaches the underlying app. Confirm the window canvas edge never receives input. Test after expansion begins while the pointer is already within the eventual surface: it must remain unarmed until leave + re-entry.
6. **Connect socket protocol to shared Halo state.** Test one state update and one allow-listed action end-to-end. Reject malformed JSON, oversized message, invalid route, mismatched protocol version, duplicate hello, and disconnected peer.
7. **Route KDE Wayland to the helper.** Preserve the current Electron host on Windows, macOS, and Linux X11. Confirm every `setShape` call remains guarded. Confirm no `BrowserWindow` for Halo is created in the KDE Wayland branch.
8. **Run the complete suite.** All old 255 assertions must remain green, plus all newly added probes. Run `git diff --check`, the native Meson build, and the existing app build. Use the runtime acceptance matrix below before enabling by default.
9. **Rollback:** revert the host-selection change to the known-good Electron host, leave the helper binary unused, and keep the content-fit/Focus/palette fixes. Do not remove existing hover probes or restore a full-canvas input region. The rollback is a code rollback, not `--ozone-platform=wayland` toggling.

## 5. Regression tests

All existing probes remain unchanged and green: `halo-fit` (34), `halo-board-coverage` (40), `halo-core` (33), `halo-slot` (63), `halo-spec-fundamentals` (54), `halo-renderer-placement` (11), `halo-click-region-growth` (20). Add the following probes under `agent/probes/`, matching the existing `npx tsx` assertion style.

### 5.1 `halo-compact-layout.ts`

Assertions:

1. Exact pill widths remain 182 / 198 / 227 and heights remain 28 / 32 / 40.
2. All ten compact kinds remain registered: `stopwatch`, `stopwatchSite`, `now`, `website`, `private`, `dictation`, `aiUsage`, `hud`, `nextDeadline`, `critical`.
3. Every kind path uses a row with `width/max-width:100%`, `min-width:0`, and `overflow:hidden`.
4. Every mapped text node that can truncate has `min-width:0`, `overflow:hidden`, `text-overflow:ellipsis`, and `white-space:nowrap` on itself or the shared truncation class.
5. No `.pill .n { max-width:140px }` rule remains.
6. Stopwatch fixed-child fixtures produce the supplied remaining label widths: S=100, M=109, L=131.
7. In each of the 30 kind×preset combinations, the row’s computed `scrollWidth <= clientWidth`; long fixture strings may ellipsize but must not enlarge the pill. This is a renderer/browser integration assertion; do not replace it with a string-length heuristic.
8. `dictation` waveform has `min-width:0` and clipping; 24 bars never increase the outer pill’s scroll width.
9. `aiUsage` bar has `min-width:0`; percentage remains visible at S.
10. `hud`, `nextDeadline`, and `critical` keep count/due values within the row even with a long title.

### 5.2 `halo-palette-semantics.ts`

Assertions:

1. `--halo-accent` is the sole live/recording/active accent token in dark and light themes.
2. `--halo-signal` is reserved for warning/error/overdue states; it is not mapped from every activity kind.
3. `--halo-focus` is absent.
4. `AmbientCard` no longer maps `kind` to `sky`, `sage`, or `amber` identity classes.
5. Tier colors only occur on actual tier chips/swatches, not as ambient card backgrounds.
6. Dictation uses accent/dim only; no clay identity class returns.

### 5.3 `halo-focus-group.ts`

Assertions:

1. `FocusPageRow` has exactly two semantic data groups: stopwatch and productive.
2. The tracked app name is inside `focus-stopwatch-group` and next to the Stopwatch heading, not in a standalone `Tracking` block.
3. Exactly one visual divider exists, between stopwatch group and productive group.
4. Two action controls are 44×44 and stay at the right.
5. The S/M/L dimensions stay exactly 480×118, 560×134, 680×154.
6. Vertical budget: S=118px, M=132px ≤ 134px, L=132px ≤ 154px.
7. Long app names ellipsize in the left group without displacing the productive value or controls.
8. No second row, new card, spring/bounce, gradient, or extra accent is introduced.

### 5.4 `halo-layer-shell-contract.ts`

Assertions:

1. KDE Wayland host selection requires Linux + `XDG_SESSION_TYPE=wayland` + KDE desktop detection.
2. That branch starts the native layer-shell helper and does not construct the Halo Electron `BrowserWindow`.
3. Helper checks layer-shell support and reports protocol handshake before overlay readiness.
4. Layer is `GTK_LAYER_SHELL_LAYER_OVERLAY`; keyboard mode is `NONE`; exclusive zone is 0.
5. Input region starts empty; `passthrough` clears it; `armed` requires a positive visible rectangle.
6. Region coordinates are local to the layer surface, converted by subtracting canvas origin.
7. Region is never set to full S/M/L canvas merely because the island expands.
8. An overlay under the current pointer stays unarmed until pointer leaves visible bounds and re-enters.
9. The existing 120ms / 40ms polling values and `stepHover()` FSM remain in use.
10. macOS `setShape` stays inside platform guards; no unguarded call is introduced.
11. Helper crash leaves RHEO alive, closes the socket, clears readiness, and respects the restart limit.
12. Old Electron host still routes Windows, macOS, and Linux X11.

### 5.5 `halo-host-protocol.ts`

Assertions:

1. Protocol version mismatch is rejected.
2. Invalid JSON and oversized messages are rejected.
3. Unknown message types and unknown command values are rejected.
4. `open-route` only permits the existing registered routes.
5. Helper can publish state but cannot invoke arbitrary IPC or filesystem access.
6. Socket/runtime directory permissions are 0700 and socket permissions 0600.
7. Shutdown closes socket, stops helper, and deletes its private runtime directory.

### 5.6 Runtime compositor acceptance (required, not replaced by source tests)

On the measured Fedora 44 KDE Wayland environment, with Firefox and VS Code each in front:

- collapsed: move/click anywhere around the visible pill and through the transparent canvas; underlying application receives the click; the helper receives none because its region is empty;
- hover: move to the existing hot zone while another app is focused; island expands without activating keyboard focus;
- expanded-under-cursor: the surface remains pass-through until cursor exits and re-enters the visible panel;
- interactive: only clicks inside visible island controls go to Halo; clicks outside its visible region reach the underlying app;
- collapse: input region clears immediately at the start of collapse, not after the animation;
- helper crash/restart: no stale surface or input-blocking region remains;
- inspect layer role through compositor tooling and confirm the helper is actually a Wayland layer surface, not an XWayland toplevel.

## 6. Spec deltas against `agent/docs/HALO_ISLAND.md`

The current state states that §8 mandates a separate Electron `BrowserWindow`, and §8 says `focusable:false`. The following deltas are intentional and must be applied only after the native helper spike passes on the target compositor.

```diff
- §8: Halo is implemented as a separate Electron BrowserWindow on every platform.
+ §8: Halo uses a platform host adapter. On Linux KDE Wayland with layer-shell support,
+     the cross-app surface is owned by the native GTK4 layer-shell helper. On macOS,
+     Windows, and Linux X11, the existing Electron host remains in use.
+     Never create both hosts for the same session.

- §8: BrowserWindow.focusable is the overlay's focus policy.
+ §8-Wayland: layer-shell keyboard_interactivity is NONE; the overlay never requests
+     keyboard focus. Pointer interaction is controlled by the native input region.

- §13: collapsed path uses Electron setIgnoreMouseEvents/setShape as the hit-test authority.
+ §13-Wayland: the helper's GdkSurface input region is authoritative. It is empty while
+     collapsed, expanding, collapsing, and expanded-but-unarmed. When armed, it is only
+     the local rectangle of the actual visible island.
+ §13-Electron: keep the existing platform-guarded click-through implementation. Never
+     interpret setShape([]) as an empty region; Electron documents it as reset-to-rectangle.

- §14: never call win.focus(); use Electron focusability rules.
+ §14-Wayland: never request layer keyboard interactivity and never call GTK focus APIs.
+     Preserve the existing Electron never-focus rule on non-Wayland hosts.

- §47: cursor polling can rely on the current host's pointer APIs.
+ §47-Wayland: retain the measured kdotool/hyprctl/wlrctl detector and existing 120ms idle /
+     40ms expanded polling. Do not depend on Electron screen.getCursorScreenPoint().

- §63: expansion may make the hit region interactive when the hover FSM enters expanded.
+ §63: expansion is visual first. Keep the region empty until pointer exit + re-entry into
+     the visible surface. Clear the region immediately when collapsing begins.

- §181: the transparent BrowserWindow canvas is the overlay surface and click boundary.
+ §181: the native layer-shell surface may use the existing S/M/L canvas geometry, but its
+     input region must never default to that full canvas. Only visible interactive pixels
+     may be armed; all transparent padding must pass through.
```

### Explicit assumptions and falsifiers

- **Assumption:** the target KDE compositor advertises `zwlr_layer_shell_v1` and GTK Layer Shell reports support at runtime. **Falsified by:** helper logs unsupported/0 protocol version on the measured desktop. Do not fall back to advisory Electron stacking and call it fixed.
- **Assumption:** WebKitGTK can load the built Halo renderer after its Electron-only bridge calls are isolated behind the shared host adapter. **Falsified by:** a required Chromium/Electron-only API cannot be abstracted without forking the whole app renderer. In that case keep the layer-shell helper, but implement the small Halo visual layer natively rather than stream screenshots or pretend an Electron surface can be reparented.
- **Assumption:** current `kdotool`/`hyprctl`/`wlrctl` detection remains available on the target machine. **Falsified by:** repeated cursor-query failure or stale coordinates during compositor transitions. Treat pointer detection as unavailable and disable hover rather than making the layer input-transparent surface clickable.
- **Assumption:** “never intercept a click” means no transparent padding or unintended desktop area captures input, while visible island controls remain interactive after explicit entry. If the literal rule also forbids clicks on visible island controls from reaching Halo, those controls must be disabled and the UI made display-only; that is a product requirement conflict, not a fixable hit-test bug.

## References

- Electron BaseWindow / `setShape`: https://github.com/electron/electron/blob/main/docs/api/base-window.md
- Electron BrowserWindow / `setIgnoreMouseEvents`: https://www.electronjs.org/docs/latest/api/browser-window
- Electron Wayland restrictions: https://www.electronjs.org/blog/tech-talk-wayland
- `zwlr_layer_shell_v1` protocol: https://wayland.app/protocols/wlr-layer-shell-unstable-v1
- GTK4 Layer Shell supported compositors and API: https://github.com/wmww/gtk4-layer-shell
