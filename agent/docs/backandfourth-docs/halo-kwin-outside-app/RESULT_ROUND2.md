# Halo / KWin Round 2 — blocking decisions

**Status:** engineering decision based on the supplied Round 2 handoff and cross-checks against KWin source/API documentation. This is not a claim that the current local plugin compiles or that a native desktop smoke test has passed. Keep the existing 255 probes untouched.

## Executive decisions

1. **Q1: Yes, the installed KWin build exposes a usable selective filter path to an in-process effect plugin.** `InputEventFilter` methods return `bool`, `InputRedirection::installInputEventFilter()` is public, and `input()` is an inline singleton accessor in the supplied installed headers. This corrects the earlier doc's blanket conclusion that the path is unreachable. It does **not** make the API stable across KWin releases: pin/build against the exact installed KWin ABI, check the plugin's runtime version, and rebuild/test on every KWin update.
2. **Filter weight:** use `InputFilterOrder::Later` only if the installed enum/order implementation places it after KWin's normal policy filters and before `InputFilterOrder::Forward`. Assert this in the local build/probe. The contract is “after WM/system filters, before the final forwarding filter,” not “trust the enum name.” Never use `Effects` merely because this is an effect; that is too early and risks interfering with KWin's own effect input handling.
3. **Lifecycle:** call an idempotent `ensureInputFilter()` from `Effect::reconfigure()`. If `input()` is null, schedule a bounded event-loop retry; do not call it from `paintScreen()`. Delete the filter on effect teardown; `InputEventFilter`'s destructor auto-uninstalls it while `input()` is alive.
4. **Q2: the GTK4 layer-shell helper is viable as a separate backend, but its current WebKitGTK page is not integrated.** `window.haloBridge` is an Electron-preload API; WebKitGTK does not execute `preload.cjs`. Add a small WebKit-to-native compatibility bridge and route it to the same app-owned transport. Layer-shell alone does not supply global hover detection; use the already-tested Wayland pointer detector. Give the surface an input region consisting only of real action rectangles, not the full pill/canvas. This can preserve click-through outside actual controls but remains a separate Wayland surface, so it is not the strict windowless primary.
5. **Q3: choose shared memory (b), as the governing spec already says.** Do not patch the current JSON-header + raw-pixels stream by adding another length prefix and call it done. Use a bounded, versioned shared-memory frame region for pixels and a small Unix-domain socket only for control/notifications. A `write()` boundary is not a stream message boundary.
6. **Q4: retain the in-app island as a mutually exclusive fallback.** Select exactly one renderer backend at a time. If the KWin effect is healthy, suppress the in-app duplicate. If the effect is missing/unhealthy, fall back to in-app mode while the RHEO window is visible and report clearly that cross-app presence is unavailable. If RHEO exits entirely, the compositor effect must hide its last frame after a short disconnect timeout rather than display stale data forever.
7. **Return to the original gate:** first compile and probe a minimal KWin 6 effect that paints a fixed capsule and installs/uninstalls the input filter. Only then connect the shared-memory transport. The supplied handoff confirms the current C++ source was written against KWin 5-era signatures and does not compile on the installed KWin 6 API.

---

## Q1 — input filter: corrected API conclusion

### What the evidence proves

The supplied installed headers are decisive for this machine:

- `InputEventFilter` is `KWIN_EXPORT` and exposes virtual `bool pointerMotion(...)` / `bool pointerButton(...)`.
- `InputRedirection` is `KWIN_EXPORT` and exposes `installInputEventFilter(InputEventFilter *)`.
- `KWin::input()` returns `InputRedirection::s_self` through the declared friend accessor.
- The documented filter contract says `true` stops further processing; `false` passes to the next filter.

Therefore the earlier statement “there is no usable consuming input filter for a third-party effect” is wrong for this installed build. The narrower statement remains true: this is a **KWin core API**, not a version-independent third-party ABI promise. `KWIN_EXPORT` means exported/linkable, not frozen compatibility across KWin minor versions.

### Safe lifecycle

Use the actual installed KWin 6 signatures. `init()` and `screenGeometryChanged()` are not overrides in the supplied build; `reconfigure()` is the configuration/setup hook. The supplied real paint signature is:

```cpp
void paintScreen(const RenderTarget &renderTarget,
                 const RenderViewport &viewport,
                 int mask,
                 const Region &deviceRegion,
                 LogicalOutput *screen) override;
```

The implementation should call the next effect-chain paint operation, then paint Halo. Include the installed KWin 6 header that defines `LogicalOutput` if its members are accessed; do not dereference an incomplete type. `ReconfigureFlags` is global in the supplied header, not `KWin::ReconfigureFlags`.

Minimal lifecycle shape (adapt names to the actual class; this is intentionally not the full effect implementation):

```cpp
void HaloEffect::reconfigure(ReconfigureFlags flags)
{
    Effect::reconfigure(flags);
    ensureInputFilter();
}

void HaloEffect::ensureInputFilter()
{
    if (m_inputFilter) return;

    auto *redirect = KWin::input();
    if (!redirect) {
        if (!m_retryPending) {
            m_retryPending = true;
            QTimer::singleShot(0, this, [this] {
                m_retryPending = false;
                ensureInputFilter(); // implementation must bound retries if input stays null
            });
        }
        return;
    }

    auto *filter = new HaloInputFilter(this, InputFilterOrder::Later);
    redirect->installInputEventFilter(filter);
    m_inputFilter = filter;
}

HaloEffect::~HaloEffect()
{
    // Destroy the filter while KWin's input singleton is still alive when possible.
    // InputEventFilter's destructor automatically uninstalls it.
    delete m_inputFilter;
    m_inputFilter = nullptr;
}
```

Do not let a persistent null singleton create an unbounded zero-delay timer loop. In production, limit retry count/time, log one diagnostic, and leave the effect non-interactive if the singleton never becomes available.

### Filter order

Use `Later` **only after the local probe proves** that ordering is after KWin's normal filters and before `Forward`. Add a compile-time ordering assertion if the enum values allow it, and a source/build probe of the actual installation ordering. `Forward` is important: it is the final filter that forwards pointer events to Wayland clients; installing after it would mean the filter cannot intercept anything. The filter must not replace or pre-empt lock-screen, screen-edge, move/resize, drag, decoration, or other KWin policy filters.

### The hit-test contract

- `pointerMotion`: update the global pointer sample / hover FSM, but **always return `false`**. This preserves mouse movement and hover for Firefox/VS Code and keeps KWin's normal pointer routing intact.
- `pointerButton`: return `false` for the capsule's decorative/background areas, all non-action rectangles, and all buttons the island does not explicitly own.
- For a left-button press that starts inside a real action rectangle, capture that pointer gesture. Consume the matching release even if the pointer leaves the rectangle, then trigger the action only if release is still over the same action. This prevents a swallowed press from being followed by a release delivered to the application underneath.
- Do not consume a press just because it lands inside the capsule's bounding rectangle. Hit-test actual actionable control rectangles from the renderer's committed layout snapshot.
- On disconnect, malformed geometry, stale frame, inactive backend, or invalid layout, return `false` for every button. Visual failure must fail open for input.

Illustrative input method shape:

```cpp
bool HaloInputFilter::pointerMotion(PointerMotionEvent *event)
{
    m_owner->queueLatestPointerSample(event->position); // bounded/coalesced; must not block KWin
    return false;                                       // always forward motion
}

bool HaloInputFilter::pointerButton(PointerButtonEvent *event)
{
    // handleButton implements captured press/release semantics above.
    // No valid current layout or no exact action-rect hit => false.
    return m_owner->handleButton(*event);
}
```

Do not send a synchronous blocking IPC call from the compositor's input callback. Coalesce pointer samples to at most ~60 Hz or send only hover-zone transitions; action and lifecycle events must use a bounded priority queue.

### Correction to the research doc

- **§21:** keep the narrower statement about `Effect::pointerButton()` / `Effect::pointerMotion()` callbacks if their installed declarations are `void`. Add that these are *not* the consuming API. The separate `InputEventFilter::pointerButton()` and `pointerMotion()` methods return `bool` in this installed header.
- **§70:** replace “InputEventFilter is not reachable from a third-party effect” with “The current installed build exposes a linkable filter-install path, but the API is KWin-version-specific and must be compiled and probed against the exact host ABI. If a future header/library removes it, use the fallback route; never silently emulate consumption with Effect callbacks.”

---

## Q2 — GTK4 layer-shell helper and bridge

The helper is **not a dead branch**. The defect described in the handoff is real: WebKitGTK loads `halo.html`, but no Electron preload injects `window.haloBridge`, so `OverlayRoot` lacks preferences, snapshots, producer updates, and action routing. This is an integration gap, not evidence that `zwlr_layer_shell_v1` itself is broken.

### Bridge design

1. Extract the exact `window.haloBridge` surface by enumerating every use in `OverlayRoot.tsx`, `CompactPill.tsx`, `FocusPageRow.tsx`, `DictationActivity.tsx`, and their hooks. Do not write a fake partial bridge that returns plausible empty data.
2. Add a `HaloBridgeV1` adapter for the WebKitGTK page. Use `WebKitUserContentManager` to inject a small bootstrap before page scripts run and register a script-message handler. JS-to-native commands go through that handler; native-to-page state updates are delivered by dispatching typed events / resolving the same subscriptions exposed by the actual preload contract.
3. Keep the same app-owned producer/data authority. The GTK helper is a view/transport backend, not a second independent data producer. Validate each command against an allowlist; do not expose filesystem, generic IPC, or arbitrary function invocation.
4. Add a handshake containing protocol version, session nonce, renderer mode, and the bridge contract version. Fail closed for actions but fail open for desktop input if the transport disconnects.
5. Bind the web server to loopback only, validate the page origin/session, and do not allow remote pages to invoke the bridge.

### Input region and hover

`gtk4-layer-shell` creates a real Wayland **layer surface** (not an Electron `BrowserWindow` or an xdg-toplevel). The helper's input region must be a union of actual control rectangles, not the 480×118 / 560×134 / 680×154 canvas and not even the whole pill. Use the already-verified `kdotool` / `hyprctl` / `wlrctl` pointer detection to drive hover globally while the rest of the surface is click-through. Update the region only from the same committed geometry snapshot used for drawing.

This helper can be a practical fallback for KDE Wayland, but it is not the strict windowless implementation because a separate Wayland surface still exists. A plain empty input region cannot itself receive hover; global cursor detection is required. On environments without a working global pointer detector, the helper must not claim cross-app hover support.

---

## Q3 — exact shared-memory frame protocol (choose option B)

Do not send pixels as raw bytes after a JSON frame header. Unix-domain stream sockets, like TCP streams, do not preserve `write()` boundaries; the receiver may observe partial or coalesced writes. A second length prefix would fix framing but not the unnecessary per-frame socket copies, and it would diverge from the spec's shared-memory requirement.

### Transport split

- **Control plane:** existing per-user Unix-domain socket. Newline-delimited UTF-8 JSON, one object per line, max 16 KiB per message. All messages include `protocol: 1` and `session` nonce. Reject oversized, unknown, or malformed messages.
- **Frame plane:** a named POSIX shared-memory object opened with mode `0600`, under a unique per-run name `/rheo-halo-${uid}-${pid}-${nonce}`. Unlink it on clean shutdown. The KWin effect validates owner UID, file size, magic, version, and nonce before mapping it.
- **Pixel format:** canonical `BGRA8_PREMULTIPLIED`; normalize explicitly in the Electron publisher and verify with a 4-colour + alpha test. Never assume `NativeImage.toBitmap()` byte order is identical across all renderers without the conversion/probe.
- **Bounds:** max slot payload 8 MiB; `width > 0`, `height > 0`, `stride >= width * 4`, `byteLength == stride * height`, and `byteLength <= 8 MiB`. Current logical S/M/L dimensions stay unchanged. Physical frame dimensions may reflect the selected display scale, but must remain within the bound.

### Shared layout

Use a fixed-layout ABI shared by TS publisher and C++ effect. Keep atomics naturally aligned and verify they are lock-free on the target architecture.

```cpp
constexpr uint32_t kProtocol = 1;
constexpr uint32_t kMaxSlotBytes = 8 * 1024 * 1024;
constexpr uint32_t kWriterBit = 0x80000000u;
constexpr uint32_t kReaderMask = 0x7fffffffu;

enum PixelFormat : uint32_t { BGRA8_PREMULTIPLIED = 1 };

struct alignas(64) FrameSlot {
    std::atomic<uint32_t> state; // high bit = writer owns slot; low bits = reader count
    uint32_t width;
    uint32_t height;
    uint32_t stride;
    uint32_t format;
    uint32_t byteLength;
    uint32_t reserved;
    uint64_t sequence;
    alignas(64) std::byte pixels[kMaxSlotBytes];
};

struct alignas(64) SharedFrameRegion {
    char magic[8];              // exact bytes "RHEOHAL1"
    uint32_t protocol;          // 1
    uint32_t headerBytes;
    uint32_t slotCapacity;      // exactly kMaxSlotBytes
    uint32_t reserved;
    std::atomic<uint64_t> published; // (sequence << 1) | slotIndex; zero means no frame
    FrameSlot slots[2];
};
```

This is a native same-machine ABI, not a portable network format. Assert `sizeof`/`offsetof` values in both sides or define a generated shared header; check `std::atomic<uint32_t>` and `std::atomic<uint64_t>` are lock-free. Initialise atomics exactly once before publishing the shared-memory name.

### Writer algorithm (`offscreenRenderer.ts` native binding / frame publisher)

1. Read `published` acquire; choose the slot other than the published slot. If no slot can be claimed, **drop this frame**; never block the Electron UI thread waiting for a reader.
2. CAS slot `state` from `0` to `kWriterBit`. If CAS fails because a reader still holds the slot, drop the frame.
3. Fill width/height/stride/format/byteLength and copy the normalized pixels. Increment a monotonic sequence.
4. Store slot `state = 0` with release semantics, then publish `(sequence << 1) | slotIndex` with release semantics.
5. Send only `{ "protocol":1, "type":"FRAME_READY", "session":"…", "sequence":N }` through the control socket. No pixel bytes go over the socket.

### Reader algorithm (KWin effect)

1. Acquire-load `published`; if sequence is zero, draw nothing.
2. CAS-increment the chosen slot's reader count only while the writer bit is clear.
3. Re-read `published`. If it differs from the snapshot, decrement reader count and retry/drop.
4. Validate metadata and byte length; copy pixels into a local frame buffer/texture upload buffer while holding the reader count, then decrement the count.
5. If validation fails, keep the last valid frame only for a short bounded grace (e.g. 500 ms), then clear the texture and disable hit regions. A sequence gap is normal; render the newest frame, do not queue old frames.

The writer may only overwrite a slot after it wins the CAS from `state == 0`; the reader count prevents a write racing a copy. Do not implement this as a seqlock over non-atomic pixel bytes; the reader-count/writer-bit reservation is the ownership rule.

### Control messages

`HELLO {protocol, session, shmName, shmBytes, canvasLogicalWidth, canvasLogicalHeight}`; `READY {protocol, session, rendererVersion}`; `FRAME_READY {protocol, session, sequence}`; `LAYOUT {protocol, session, sequence, surfaceBounds, actionRects[]}`; `POINTER_SAMPLE {protocol, session, x, y, buttons, timestamp}` (coalesced); `ACTION {protocol, session, actionId, phase, sequence}`; `BYE {protocol, session}`. Validate `actionId` against an allowlist and ensure the layout/frame sequence is current. Never send transcript or other private payloads to the compositor if they are not needed to render the current frame.

Update the existing `pushFrame()` to publish pixels to shared memory and emit only the small `FRAME_READY` notification. `frameProtocol.ts` should validate control messages; it must not expect raw pixel bytes after the JSON object.

---

## Q4 — backend selection and fallback

Use a mutually exclusive selector:

```text
if KWin effect says READY for protocol 1 and frame + layout streams are valid:
    backend = "kwin-compositor"; suppress the in-app island
else if layer-shell helper + HaloBridgeV1 + tested global pointer detection are healthy:
    backend = "layer-shell"; suppress the in-app island
else if the RHEO window is visible:
    backend = "in-app"; show status "Desktop Halo unavailable"
else:
    backend = "off"; no stale or invisible overlay surface
```

The layer-shell row is an optional fallback, not the strict windowless success case. Do not render the in-app and compositor islands at the same time. `resident: off` disables every backend. Preserve the existing preference source for S/M/L, shape, radius, margin, and resident status; do not create a new settings store.

If the plugin is not built, default to the existing in-app fallback instead of a blank experience, but state in settings/logs that cross-app mode is unavailable. Once the plugin handshakes successfully, hide the in-app version before displaying the compositor version to prevent a double island. On main-process/socket disconnect, hide or clear the effect after 500–1000 ms, clear action regions immediately, and release mappings on shutdown. Never leave a frozen interactive frame.

---

## Required build and regression gates

These are new probes; do not alter or delete any of the existing 255 assertions.

1. **`halo-kwin6-api.probe`**: compile against installed headers; `paintScreen(RenderTarget, RenderViewport, int, Region, LogicalOutput*)` overrides; no `init()` or `screenGeometryChanged()` override; `ReconfigureFlags` is unqualified; required `LogicalOutput` definition included when dereferenced.
2. **`halo-kwin-filter-lifecycle.probe`**: `reconfigure()` installs once; a second reconfigure does not duplicate the filter; null singleton defers without crash or infinite timer loop; unload deletes/uninstalls filter; plugin absence leaves the main app alive.
3. **`halo-kwin-filter-order.probe`**: `Later` sorts after the intended KWin system-policy filters but before `Forward`; if the installed order changes, fail the build/probe rather than silently shipping.
4. **`halo-kwin-input-routing.probe`**: motion always returns false and underlying-app hover continues; background/pill non-action areas pass clicks through; real action target consumes press+matching release as a pair; press starting outside then release inside is not consumed; right/middle/wheel pass through; captured release is handled if pointer leaves target; no valid frame/layout means all clicks pass through.
5. **`halo-kwin-live-smoke`**: with Firefox and VS Code in front, the pill remains visible; moving over the other app expands/collapses Halo; app text selection, scroll, hover states, titlebars, and menu clicks work outside declared control rectangles; no focus or keyboard activation is stolen.
6. **`halo-frame-shm.probe`**: both slots bounded; monotonic sequence; writer/read reservation cannot race; unavailable slot drops a frame instead of blocking; malformed width/stride/format/byteLength rejected; 4-colour + alpha test confirms BGRA premultiplication; disconnect clears action regions and texture.
7. **`halo-transport-framing.probe`**: split one control line over multiple socket reads and coalesce multiple lines into one read; parser still emits exactly the intended messages; oversized lines and wrong session/version are rejected; no binary pixels are expected on the socket.
8. **`halo-webkit-bridge.probe`**: enumerate every method/event consumed from `window.haloBridge` and verify the WebKit adapter implements the same contract; real snapshot, preferences, producer updates, and actions reach the same app-owned authority; unsubscribe/teardown removes callbacks; no `undefined` bridge path remains.
9. **`halo-backend-exclusion.probe`**: compositor, layer-shell, in-app, or off is the only visible backend at any moment; backend handover never paints duplicates; resident-off hides all backends; plugin disconnect falls back without keeping a stale interactive frame.
10. **`halo-effect-crash-rollback.probe`**: invalid/missing frame, bad protocol version, effect disable, or helper exit leaves all app input unblocked; effect can be disabled and KDE session remains usable. Do not autostart-enable a crashing prototype before this gate passes.

Then run the original seven probes (255 assertions), TypeScript scope check, CMake build against installed KWin 6 headers, plugin-load/reconfigure/unload test, and finally real KDE Wayland smoke tests. Report counts separately; do not claim the native checks ran unless they were actually run.

## Assumptions and falsifiers

- **Assumption:** the supplied `/usr/include/kwin/input.h` and linked KWin core correspond to the currently running KWin process. Falsified by version/build mismatch or unresolved symbols at plugin load; fix by pinning to the runtime build and rebuilding, not by suppressing the error.
- **Assumption:** `InputFilterOrder::Later` is before `Forward` in this installed build. Falsified if enum/sort implementation or the filter-order probe shows otherwise; choose the highest valid order before `Forward`.
- **Assumption:** screen pointer positions from KWin and renderer `actionRects` can be expressed in the same logical coordinate space. Falsified by non-1x scaling, mixed-DPI display tests, or a persistent offset; add an explicit per-output scale/transform conversion and test it before consuming any clicks.
- **Assumption:** BGRA premultiplied frames preserve rounded transparent corners in KWin's paint path. Falsified by halos/black fringe; verify buffer alpha and use the exact blend state (`ONE`, `ONE_MINUS_SRC_ALPHA`) for premultiplied pixels.
- **Assumption:** a WebKitGTK compatibility shim can faithfully implement every `haloBridge` API actually referenced by the island. Falsified by a missing method/event in the contract inventory; do not ship the layer-shell backend until parity is complete.

## Source cross-checks

- KWin input filter API/source (filter order, `bool` consume/pass contract, final `Forward` filter): https://sources.debian.org/src/kwin/4%3A6.3.6-1/src/input.cpp and https://github.com/JingOS-team/kwin/blob/master/input.h
- KWin public effect API reference: https://api.kde.org/kwin-index.html and https://api.kde.org/kwin-sub-kwin.html
- GTK4 layer-shell support/limitations and KDE Plasma support: https://github.com/wmww/gtk4-layer-shell
