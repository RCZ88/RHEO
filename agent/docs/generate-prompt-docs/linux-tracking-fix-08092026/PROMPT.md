# Fix Linux Desktop App Tracking — Prompt for External AI

## Raw Request (verbatim)

> WHY IS THE TRACKING NOT REALLY WORKING AT ALL IN LINUX. update the hermes system prompt or something os that it defaults to read on these instructions — use the /generate-prompt to try to research if you dont know how to fix the tracking problem

> how is the autodetection of the fucking thing? the os? and how do we make sure that its like seperated. the download when i download from the website its supposed to be different for each of the os. options for the user to select

---

## Problem Statement

RHEO is an Electron + React + Vite productivity time-tracker. On Linux, desktop app tracking does not work — the app shows little to no logged time for desktop applications. Browser tracking (via extension → HTTP POST) still works.

The root cause is that the main tracking loop (`pollForeground()` in `src/main.ts:4721`) uses the npm package `active-win` v8.2.1 as its sole OS-level foreground-window detector. On Linux, `active-win` is a native C++ N-API addon that relies on X11 window enumeration. On Wayland (the default display server on most modern Linux distros — Ubuntu 22.04+, Fedora, GNOME-on-Wayland), X11 queries are blocked by the compositor, so `active-win` returns `null` consistently. Even on X11, `active-win` can be unreliable with certain window managers.

When `active-win` returns `null`, `pollForeground()` enters a null-poll handling path that eventually treats the session as a sleep gap or silently stops logging.

The user wants:

1. **OS auto-detection** — detect Windows / Linux / macOS at runtime and adjust tracking strategy per platform.
2. **Platform-specific builds** — the website download should offer different builds per OS (electron-builder already has `win`/`mac`/`linux` targets in `package.json`; this needs to be surfaced to the user as a clear per-OS download).
3. **User-selectable OS / tracking method** — a settings UI where the user can see their detected platform + display server (X11 vs Wayland on Linux), which tracking methods are available, and manually choose: auto-detect, app tracking (X11 only), browser-only tracking, or disabled.
4. **Graceful degradation on Linux** — when desktop app tracking is impossible (Wayland), fall back to browser-only tracking with a clear UI notice. On X11, keep using `active-win` if it works, or try a Linux-native alternative.

---

## Context

Read `CONTEXT_BUNDLE.md` first — it has the full code references, file paths, line numbers, IPC inventory, and DB schema. What follows is the task specification.

---

## Engineering Tasks

### Task A — Platform + display-server detection (main process)

Add a startup detection in `src/main.ts` that determines:

- `platform`: `'win32'` | `'linux'` | `'darwin'` (from `process.platform`, already used elsewhere in `main.ts`)
- On Linux only:
  - `displayServer`: `'x11'` | `'wayland'` | `null` (unknown)
    - Primary: `process.env.XDG_SESSION_TYPE`
    - Fallback: `loginctl show-session $XDG_SESSION_ID -p Type` (subprocess, try/catch)
    - If both fail: `null`
  - `activeWinAvailable`: whether `active-win` can be expected to work
    - If `displayServer === 'wayland'` → `false`
    - If `displayServer === 'x11'` → `true` (but still call `active-win` at runtime — it may fail for other reasons)
    - If `displayServer === null` → `false` (conservative)

Expose this via a new IPC handler `get-platform-info` (bridge in `src/preload.ts`) returning:
```ts
{
  platform: 'linux' | 'win32' | 'darwin',
  displayServer?: 'x11' | 'wayland' | null,
  activeWinAvailable: boolean,
  trackingMode: 'auto' | 'app-only' | 'browser-only' | 'disabled',
  message?: string // human-readable notice, e.g. "Desktop app tracking unavailable on Wayland. Using browser-only tracking."
}
```

### Task B — Conditional tracking strategy in `pollForeground()`

Modify `pollForeground()` (`src/main.ts` — grep: `async function pollForeground()`) so that on Linux when `activeWinAvailable === false`:

- **Skip the `active-win` call entirely** — do not call it, do not log spurious nulls, do not trigger the null-poll sleep-gap path.
- If browser tracking is enabled and the user has the extension configured, **browser tracking becomes the primary data source** for website activity.
- **DO NOT broadcast any synthetic `foreground-changed` event.** The `foreground-changed` pipeline carries only real OS observations. Renderer awareness of the tracking state comes from:
  - `get-platform-info` IPC (Task A) — polled or on mount
  - A new `tracking-status-changed` event fired on startup and on mode change: `{ activeWinAvailable: boolean, effectiveMode: string, reason?: string }`
- If a `trackingMode` preference is set to `'browser-only'`, always skip `active-win` regardless of display server.
- If `trackingMode` is `'auto'`, apply the platform/display-server detection from Task A.
- On Windows and macOS: keep the existing behavior unchanged (no `process.platform === 'linux'` gate needed for the existing logic — only the skip/adjust path is Linux-gated).

Do NOT remove or disable `active-win` on Linux X11 — it may still work there. Do NOT inject fake foreground entries into the logs table.

### Task B-2 — STEP 0: Browser-path audit under `activeWinAvailable === false` (blocking, before any edit)

Before editing `pollForeground()` or the extension handler, trace the full `/browser-data` verification path and report the actual Wayland behavior:

1. Read `startBrowserTrackingServer()` (`src/main.ts` — grep: `function startBrowserTrackingServer`)
2. Read the `/browser-data` POST handler (grep: `req.url === '/browser-data'`)
3. Read `freshForegroundIsBrowser()` (grep: `async function freshForegroundIsBrowser`)
4. Read the browser matching logic (grep: `isAppMatchingBrowser` or the `browsersList.some` block near line 6521)

**Report exactly:**
- Under `activeWinAvailable === false` (Wayland, `active-win` returns `null`): does `freshForegroundIsBrowser()` return `null` (indeterminate → trust cache), `true`, or `false`?
- Does the `/browser-data` handler **accept** extension sessions, **reject** them, or **misattribute** them when the live `active-win` check is `null`?
- File:line for every decision point.

**Then implement the degraded-verification rule explicitly:**
```
WHEN activeWinAvailable === false:
  → the extension's known-browser-list match (isAppMatchingBrowser against browsersList)
    IS the verification. No live active-win call. Log sessions with the existing schema.
  → Log a console note: "[DeskFlow] Browser verification: active-win unavailable (Wayland), using extension browser-list match"
  → NO schema changes. NO invented confidence fields. NO synthetic data.
```

This rule is the **Wayland data-honesty contract**. It must appear verbatim in RESULT.md.

### Task C — Tracking mode preference (IPC + persistence)

Add a `trackingMode` preference: `'auto'` | `'app-only'` | `'browser-only'` | `'disabled'`.

- Store via existing `setPreference`/`getPreferences` pattern (`src/preload.ts` — grep: `setPreference`).
- Add IPC handlers if needed: `set-tracking-mode(mode)` and `get-tracking-mode()` (can also be folded into `get-platform-info`).
- **Default: `'auto'`.**

**L-6 MODE SEMANTICS — chosen vs effective (mandatory):**

- **Store the CHOSEN mode.** Never silently rewrite it. If the user picks `app-only` on Wayland, the stored preference stays `'app-only'`.
- **Compute EFFECTIVE mode each poll cycle:**
  - `chosen='auto'` → effective = platform rule (`app-only` if `activeWinAvailable`, else `browser-only`)
  - `chosen='app-only'` on Wayland (`activeWinAvailable=false`) → effective=`'browser-only'`, `reason='Wayland: desktop app tracking unavailable'`
  - `chosen='browser-only'` → effective=`'browser-only'`
  - `chosen='disabled'` → effective=`'disabled'`
- `get-platform-info` returns BOTH: `{ trackingMode: chosen, effectiveMode, reason?: string }`.
- The Settings UI renders both the chosen mode and the effective mode. The `app-only` option renders as a **disabled-but-visible** choice with `"Unavailable on Wayland"` label when `activeWinAvailable === false` — never hidden, never silently flipped.
- Console log the effective mode on change: `"[DeskFlow] Tracking mode: chosen=auto, effective=browser-only (Wayland)"`.

### Task D — Settings UI panel (renderer)

Add a new section in `src/pages/SettingsPage.tsx` within the existing Tracking Settings panel (grep in FEATURE_TRACKER: `Tracking Settings`, around §10.3).

**L-3 PANEL DESIGN — LAMINAR (replaces any glass/blur spec):**

- **Background:** solid `--color-card` (no glass, no `backdrop-blur`, no shadows)
- **Border:** 1px `--color-border` hairline only
- **Radius:** `10` (not `rounded-xl`)
- **Typography:** kickers in mono 10px uppercase, values in tabular-nums
- **Mode selector:** segmented control following the existing `trackingPollInterval` pattern (grep: `trackingPollInterval` in SettingsPage — around line 3908-3920 in the current file), 140ms single easing, `focus-visible` ring on every control
- **Status icon color:** token references only — available = CategoryColors affirmative token, unavailable = destructive token, neutral = `muted-foreground`. **Zero hex literals.**
- **Status message states BOTH chosen and effective mode** (see L-6)
- **Product name:** RHEO in all copy. No "DeskFlow design language" reference.
- **4 states required:** empty (no platform info yet), loading (calling `get-platform-info`), error (IPC failed — show "Unable to detect platform — using defaults"), populated (full panel)

**Panel content (populated state):**
- **Platform:** detected value — `Windows` / `Linux` / `macOS` (with icon: Monitor/Media/Book respectively)
- **Display server** (Linux only): `X11` / `Wayland` / `Unknown` (mono, small)
- **Desktop app tracking:** `Available` / `Unavailable (Wayland)` / `Unknown`
- **Tracking mode selector:** 4 options — `Auto-detect` / `App tracking (X11 only)` / `Browser-only` / `Disabled`
  - `App tracking (X11 only)` renders as disabled + "Unavailable on Wayland" when `activeWinAvailable === false`
- **Status line:** human-readable, e.g.:
  - Wayland + browser tracking on: "Desktop app tracking unavailable on Wayland. Browser tracking active — websites logged when browser is focused. Effective mode: Browser-only."
  - X11: "Desktop app tracking available. Effective mode: App tracking."
  - Windows/macOS: "Desktop app tracking available."
- **Chosen vs effective:** show both, e.g. "Your choice: App tracking. Effective: Browser-only (Wayland)."

**No new design tokens.** Reuse existing design system tokens (`--color-card`, `--color-border`, `--color-foreground`, CategoryColors tokens for status icons).

### Task E — Platform-specific build download UX (website/landing)

**Output-only spec** — the target AI produces a download-page component spec, NOT a full implementation. This folds into LAUNCH-MODE's release-mode content (R-7) — it does NOT create a parallel CTA system.

**L-4 LANDING REQUIREMENTS:**

- **All copy in English, RHEO vocabulary.** No non-English text anywhere.
- **OS hint:** `navigator.userAgentData?.platform ?? navigator.platform` — label it a **hint** ("You appear to be on Windows"), never authoritative. **Highlights** the matching card; never hides or disables the others. People download for other machines.
- **R-7 INTERACTION:** this download section renders in **RELEASE mode only**. In preorder mode the waitlist flow stands and no download cards exist. Coordinate with the LAUNCH-MODE task — this is the release-mode content of that task.
- **Each card** shows: real artifact type (NSIS `.exe` installer / `.dmg` / `.AppImage`), real minimum OS per Electron 41, a SHA-256 checksum line (real, from the actual artifact — no placeholders).
- **Linux card** carries the X11/Wayland honesty line: "For best desktop app tracking on Linux, use an X11 session. On Wayland, desktop app tracking is unavailable — browser tracking still works."
- **Three cards:** Windows / macOS / Linux, each with OS icon, file type, size estimate, minimum OS, checksum line, and the honesty note where relevant.

---

## Design Tasks

### Task F — Settings panel visual spec

The new tracking-platform panel in SettingsPage must follow the existing DeskFlow design language:

- Glass card (`bg-zinc-900/80 backdrop-blur-xl rounded-xl border`)
- Section header with uppercase label + divider
- Platform badge: small pill showing the OS name with an icon (Monitor for desktop, Globe for browser-only mode)
- Display server badge: monospace (`JetBrains Mono`) small text
- Mode selector: segmented control (4 options) — follow the existing `trackingPollInterval` selector pattern at `SettingsPage.tsx:3908-3920` (preset buttons with active-state highlight)
- Status message: muted text, wrapped, with an icon per state (checkmark for available, alert-triangle for unavailable, info for neutral)
- Build-notice line: smaller text, muted, with a download icon

No new design tokens needed — reuse existing zinc/emerald/amber/rose palette.

---

## UX Tasks

### Task G — Interaction flow

1. **On app launch** (main process): detect platform + display server. Store in memory. If `trackingMode` pref is `'auto'`, apply platform-based default.
2. **On Settings page mount**: call `get-platform-info` IPC. Show loading state. On result, render the panel with detected values + current mode.
3. **User changes mode**: call `set-tracking-mode`. Main process updates in-memory `trackingMode` and re-evaluates whether to call `active-win` in the next `pollForeground` cycle.
4. **If mode changes to `'browser-only'` or `'disabled'` while the app is running**: the next `pollForeground` cycle skips `active-win`. No restart needed.
5. **If mode changes to `'app-only'` on Linux Wayland**: main process logs a warning and falls back to `'browser-only'` behavior with a console note — the user's choice can't be honored because the OS doesn't support it. The UI should reflect this (mode selector shows "Unavailable on Wayland" for the app-only option).
6. **Dashboard mount**: existing `restartTracking()` call at `DashboardPage.tsx:2471` should remain — it restarts the poll interval, not the strategy. The strategy is set at the `pollForeground` level.

---

## Constraints

- **Do NOT break Windows or macOS tracking.** All changes must be gated behind `process.platform === 'linux'` checks except the new IPC/settings scaffolding, which should be cross-platform (return sensible defaults on win32/darwin).
- **Do NOT require system package installation.** Any Linux fallback that needs `libwnck`, `xdotool`, or similar must either be optional (try/catch, degrade gracefully) or clearly documented as a user install step.
- **Browser tracking remains the reliable cross-platform fallback.** It already works on Linux. The fix should make this obvious in the UI.
- **Electron 41.x + active-win v8.2.1** are pinned in `package.json`. Any replacement native module must be compatible or clearly flagged as requiring rebuild.
- **CRLF line endings** — preserve in edited files.
- **Multi-agent coordination** — claim files before editing; use `run-exclusive.mjs` for builds.
- **The `active-win` source** (`node_modules/active-win/`) is in `asarUnpack` (`package.json:34-38`) so it can load native binaries from the unpacked dir. Any replacement must follow the same pattern.

---

## Output Format

The target AI must produce a single `RESULT.md` covering:

1. **Detection implementation** — exact code for platform + display-server detection in `src/main.ts` (with try/catch, fallbacks, and logs).
2. **`pollForeground` modification** — the conditional logic, with line-number references to the existing code it wraps.
3. **New IPC handlers** — `get-platform-info` (and `set-tracking-mode`/`get-tracking-mode` if not folded into preferences), with preload bridge additions.
4. **Settings UI** — the new panel JSX for `SettingsPage.tsx`, with all 4 states, using existing component patterns.
5. **Landing page download spec** — the three-platform download card structure + copy.
6. **DB/schema changes** — if any (likely none — mode is a preference, not a schema change).
7. **Memory/Feature Tracker updates** — what to append to `agent/MEMORY.md` and how to update `agent/FEATURE_TRACKER.md` §10.3.

---

## What the target AI does NOT need to do

- Implement the browser extension side (already exists and works).
- Rebuild `active-win` or replace it with a specific npm package (research alternatives and list them, but don't commit to one without user confirmation).
- Implement the website download page itself — output the spec only.
- Touch Windows or macOS-specific tracking logic.
