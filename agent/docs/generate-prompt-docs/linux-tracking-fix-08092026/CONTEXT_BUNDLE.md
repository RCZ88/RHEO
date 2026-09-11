# Context Bundle — Linux Desktop App Tracking Fix

> Self-contained reference for the target AI. The target AI does NOT have access to this codebase — this file replaces that gap.

---

## 1. What the system does today

RHEO is an Electron + React + Vite productivity time-tracker. It tracks:

- **Desktop app tracking** — every ~1s, the main process calls `active-win` to get the current foreground window, resolves it to an app name, and logs duration to SQLite (`logs` table → `stats_hourly`/`stats_daily` via triggers).
- **Browser tracking** — a browser extension sends `POST /browser-data` to the app's HTTP server (port 54321). The app verifies the browser is the confirmed foreground app, then logs website sessions.

The tracking loop is in `src/main.ts:4721` (`pollForeground()`). It runs via `setInterval` at `src/main.ts:22721`, started in `src/main.ts:22717-22723`.

---

## 2. The Linux failure

### Root cause
`active-win` v8.2.1 (`node_modules/active-win`) is a native C++ addon (N-API binary). Its `binding.gyp` compiles platform-specific C++ sources. The `active-win` README and npm metadata claim Linux support, but in practice:

- On **Wayland** (default on most modern Linux distros — Ubuntu 22.04+, Fedora, GNOME-on-Wayland), the X11-based window enumeration that `active-win` uses is **blocked by the compositor**. `active-win` returns `null` consistently.
- Even on **X11**, `active-win` on Linux can be unreliable with certain window managers (returns the WM name, or fails on tiling WMs).

When `active-win` returns `null`, `pollForeground()` at `src/main.ts:4769` enters the null-poll handling path (`src/main.ts:4777-4800+`). After enough consecutive nulls, the session gets treated as a sleep gap or the app just silently stops logging desktop app activity.

### Evidence in code
- `src/main.ts:27`: `const active_win_1 = __importDefault(require("active-win"));`
- `src/main.ts:4769`: `const result = await (0, active_win_1.default)();`
- `src/main.ts:4777-4800`: null-poll counting and sleep-gap handling
- `src/main.ts:22720-22721`: `const pollInterval = userPreferences.trackingPollInterval || 1000; trackingInterval = setInterval(pollForeground, pollInterval);`
- `src/main.ts:6521`: `const browsersList = userPreferences?.browsersWithExtension || ...` — browser tracking is already a separate code path

### What works on Linux today (partial)
- **Browser tracking** (`POST /browser-data` at `src/main.ts:21114`) works on ALL platforms, including Linux, because it's HTTP-based and doesn't depend on `active-win`.
- **The watchdog** (`src/main.ts` — tracking watchdog checks every 30s if poll interval is alive, restarts if stale >30s — referenced in MEMORY.md 2026-08-14) handles `setInterval` death but NOT `active-win` returning `null`.

---

## 3. Current architecture — files and line numbers

### Main process — tracking core
| File | Lines | What |
|---|---|---|
| `src/main.ts` | 27 | `active-win` import |
| `src/main.ts` | 4721-4860 | `pollForeground()` — the main tracking loop |
| `src/main.ts` | 4769 | `active-win` call site |
| `src/main.ts` | 4863 | `foreground-changed` IPC broadcast to renderer |
| `src/main.ts` | 22717-22723 | `setInterval(pollForeground, ...)` startup |
| `src/main.ts` | 6375-6383 | `restart-tracking` IPC handler |
| `src/main.ts` | 8889-8907 | `get-browser-tracking` / `set-browser-tracking` IPC |
| `src/main.ts` | 21110-21785 | `startBrowserTrackingServer()` — HTTP server for extension |
| `src/main.ts` | 21805-21824 | `freshForegroundIsBrowser()` — live `active-win` check before trusting extension data |
| `src/main.ts` | 6521-6540 | Browser matching logic in `/browser-data` handler |

### Preload — renderer IPC bridges
| File | Lines | What |
|---|---|---|
| `src/preload.ts` | 81 | `restartTracking: () => ipcRenderer.invoke('restart-tracking')` |
| `src/preload.ts` | 126-127 | `setBrowserTracking` / `getBrowserTrackingStatus` |
| `src/preload.ts` | 198 | `getCurrentForeground: () => ipcRenderer.invoke('get-current-foreground')` |

### Renderer — Settings UI
| File | Lines | What |
|---|---|---|
| `src/pages/SettingsPage.tsx` | 1447-1457 | Tracking settings state: `sleepGapMs`, `maxSessionMs`, `trackingPollInterval`, `filterTransientApps`, `browserRecordingMode`, `appRecordingMode`, `availableBrowsers`, `selectedBrowsers` |
| `src/pages/SettingsPage.tsx` | 1470-1490 | Load tracking settings on mount |
| `src/pages/SettingsPage.tsx` | ~3900 | `trackingPollInterval` selector UI (1s/2s/3s/5s) |
| `src/pages/SettingsPage.tsx` | 1219-1277 | Settings page feature list — Tracking Settings section (10.3) |

### DB schema — tracking data
| Table | Purpose |
|---|---|
| `logs` | Raw tracking entries: `timestamp, app, domain, category, duration_ms` |
| `stats_hourly` | Hourly aggregation (trigger `trg_update_hourly` at `src/main.ts:3862`) |
| `stats_daily` | Daily aggregation (trigger `trg_update_daily` at `src/main.ts:3890`) |

---

## 4. What the user wants

The user reports: **"tracking is not really working at all in Linux"**.

Specifically:

1. **OS auto-detection** — detect Windows / Linux / macOS at runtime (`process.platform` in Electron main) and adjust tracking strategy accordingly.
2. **Platform-specific builds** — the download from the website should offer different builds per OS. The `package.json` already has electron-builder targets:
   ```json
   "win": { "target": "nsis", ... },
   "mac": { "target": "dmg", ... },
   "linux": { "target": "AppImage", ... }
   ```
   The user wants this surfaced clearly: the user picks their OS at download time and gets the right build.
3. **User-selectable OS / tracking method** — a settings UI where the user can see:
   - Detected platform (`win32` / `linux` / `darwin`)
   - Detected display server on Linux (`X11` vs `Wayland` — via `$XDG_SESSION_TYPE` or `loginctl`)
   - Which tracking methods are available (app tracking via active-win, browser-only tracking)
   - Manual override: force browser-only mode, or choose a specific fallback
4. **Graceful degradation on Linux** — when `active-win` can't get the foreground window (Wayland), fall back to:
   - Browser-only tracking (already works)
   - Possibly a Linux-native alternative for X11 (e.g., `wnck`/`libwnck` bindings, `xprop` subprocess, or a maintained fork of `active-win`)
   - A clear notice in the UI that desktop app tracking is unavailable on this session's display server

---

## 5. Existing building blocks that can be reused

- **`process.platform`** (`src/main.ts:1353`, `src/main.ts:5102`): already used extensively in `main.ts` for platform-specific logic.
- **`$XDG_SESSION_TYPE`**: standard Linux env var — `"x11"` or `"wayland"`. Read via `process.env.XDG_SESSION_TYPE` in the main process at startup.
- **`loginctl show-session $XDG_SESSION_ID -p Type`**: fallback if env var is missing.
- **Browser tracking HTTP server** (`src/main.ts:21110`): already platform-independent and already running.
- **Settings page** (`src/pages/SettingsPage.tsx`): already has a Tracking Settings section (10.3 in FEATURE_TRACKER). New OS/display-server info and fallback toggle can be added here.
- **`electron-builder` multi-target**: `package.json:42-54` already defines win/mac/Linux targets. The website download page needs to offer these separately.
- **IPC pattern**: new settings (e.g., `forceBrowserOnly`, `displayServer`, `platform`) can follow the existing `setPreference`/`getPreferences` pattern in `src/preload.ts:99` / `src/main.ts` preferences save.

---

## 6. IPC endpoints that would need to be added or extended

| New/extended endpoint | Purpose | Where |
|---|---|---|
| `get-platform-info` (new) | Returns `{ platform: 'linux'|'win32'|'darwin', displayServer?: 'x11'|'wayland'|null, activeWinAvailable: boolean }` | `src/main.ts` handler + `src/preload.ts` bridge |
| `set-tracking-mode` (new or extend `setPreference`) | Set `{ mode: 'auto' | 'app-only' | 'browser-only' | 'disabled' }` | `src/main.ts` + `src/preload.ts` |
| `get-tracking-mode` (new or extend `getPreferences`) | Read current tracking mode | `src/main.ts` + `src/preload.ts` |
| Settings UI in `SettingsPage.tsx` | Display platform info + mode selector | New panel in Tracking Settings section (10.3) |

---

## 7. Constraints

- **Do NOT break Windows or macOS tracking.** The fix must be additive — detect platform, apply Linux-specific logic only on `process.platform === 'linux'`.
- **Do NOT require the user to install system packages.** Any Linux fallback that needs `libwnck` or `xdotool` must either bundle it, use a pure-Node approach, or clearly tell the user what to install.
- **Browser tracking must remain the reliable fallback.** On Wayland, browser-only tracking is the path that definitely works. The UI must make this clear.
- **Electron 41.x** (`package.json:139`): `active-win` v8.2.1 is compiled against this Electron's Node ABI. Any replacement native module must target the same ABI or use `electron-rebuild`.
- **CRLF line endings** (AGENTS.md §7): preserve line endings in edited files.
- **Multi-agent coordination** (MULTI_AGENT_PROTOCOL.md): claim files before editing; use `run-exclusive.mjs` for builds; never build while app runs.

---

## 8. Files likely to be touched

- `src/main.ts` — platform detection at startup, Linux display-server detection, conditional tracking strategy, new IPC handlers
- `src/preload.ts` — new/extended IPC bridges for platform info + tracking mode
- `src/pages/SettingsPage.tsx` — new UI panel in Tracking Settings section showing platform + display server + mode selector
- `package.json` — already has correct electron-builder targets; may need a website-download note or a README update about per-OS builds
- `agent/FEATURE_TRACKER.md` — update Tracking Settings section (10.3) to document new OS/display-server fields
- `agent/MEMORY.md` — append lesson about Linux Wayland tracking limitation
