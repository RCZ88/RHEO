# DeskFlow Browser Extension

A Chrome Manifest V3 extension that tracks your active browsing activity and sends it to the DeskFlow Electron app.

## What It Tracks

- **Active tab only** — Only the tab you're currently viewing is tracked
- **URL & Domain** — Sanitized (query parameters stripped)
- **Page Title** — From the browser tab
- **Time per site** — Accurate duration based on tab switches and navigation

## What It Does NOT Track

- Background tabs (tabs you have open but aren't viewing)
- Browsing history or bookmarks
- Keystrokes or form data
- Screenshots or page content
- Incognito/private browsing (by default)

## Install in Zen / Firefox (the extension is named "DeskFlow Browser Bridge")

Zen is **Firefox-based** — there is no "Developer mode" and no "Load unpacked".
Those are Chromium-only, and looking for them wastes your time.

1. Build the package (it needs `manifest.json` at the archive root):
   ```bash
   node scripts/build-extension-package.mjs
   ```
   Output: `release/deskflow-bridge/deskflow-bridge-firefox.xpi`
2. Open `about:addons` → **Extensions** tab
3. Gear icon (⚙️ top-right) → **Install Add-on From File…**
4. Pick the **`.xpi`** (not the folder, not the `browser-extension/` dir)
5. On the permission prompt, **Allow** access to `localhost`

### The extension is not on your toolbar (Zen 1.17b+)

Zen removed the toolbar extension button. Extensions moved into the **unified
panel** in the address bar. The panel is also **hidden on new-tab and `about:`
pages**, so on a blank page it genuinely looks like nothing is installed.

Open a **real web page** → click the settings icon in the address bar → find
DeskFlow Browser Bridge → right-click → **Pin to Toolbar**.

### Nothing is being sent to DeskFlow?

Firefox-family MV3 makes `host_permissions` **opt-in** (Chrome grants them
silently). Without the grant every request to `localhost:54321` is blocked and
the extension looks fine while sending nothing.

Check: `about:addons` → **DeskFlow Browser Bridge** → confirm **localhost** access
is ON. You can also click **Connect to DeskFlow** in the add-on's own popup —
the extension retries automatically, so this is only needed once.

### Debug it properly

**`about:debugging#/runtime/this-firefox`** → *This Firefox* sidebar → the add-on
→ **Inspect** → **Console**.

This is where a broken add-on's actual error appears. Prefer it to guessing.

---

## Installation in Chrome / Comet / Brave / Edge (Chromium)

1. **Open Comet Browser**

2. **Navigate to Extensions**
   - Click the menu (☰ or ⋮) in the top-right → **Extensions** → **Manage Extensions**
   - OR: Type `chrome://extensions` in the address bar and press Enter
   - *(Comet uses the standard Chromium extensions page)*

3. **Enable Developer Mode**
   - Toggle **"Developer mode"** in the top-right corner of the extensions page

4. **Load the Extension**
   - Click **"Load unpacked"** button
   - Navigate to and select the `browser-extension/` folder from your DeskFlow project
   - Example: `C:\Users\cleme\Downloads\App Tracker\browser-extension`

5. **Verify Installation**
   - You should see **"DeskFlow Browser Bridge"** in your extensions list
   - Under the extension, you should see: `Service Worker` (clickable link)
   - Click "Service Worker" to open DevTools and see console logs

6. **Start DeskFlow App**
   - Make sure the DeskFlow Electron app is running (`npm run dev`)
   - The extension will automatically send data to `http://localhost:54321`
   - If DeskFlow isn't running, the extension quietly retries — no errors shown

## How It Works

```
You browse in Comet
       ↓
Extension detects active tab changes via:
  - chrome.tabs.onActivated (tab switch)
  - chrome.tabs.onUpdated (URL/title change)
  - chrome.webNavigation.onCompleted (page load)
  - chrome.windows.onFocusChanged (Alt+Tab)
       ↓
chrome.alarms fires every ~5 seconds (survives SW suspension)
       ↓
HTTP POST → localhost:54321/browser-data
  Payload: { url, domain, title, tab_id, active_duration_ms, ... }
       ↓
DeskFlow Electron app receives data
       ↓
Merged with active-win data (only when browser is foreground)
       ↓
Stored in SQLite with domain categorization
       ↓
Displayed in DeskFlow /browser page
```

## Architecture Details

### Service Worker Lifecycle (MV3)

Unlike Manifest V2, MV3 service workers are **ephemeral** — they get killed after a few seconds of inactivity. This extension handles that by:

- Using `chrome.alarms` instead of `setInterval` for periodic sync (alarms wake up the SW)
- Persisting state to `chrome.storage.local` (survives SW restarts)
- Re-initializing from the current active tab on every SW wake
- Flushing the current session on `chrome.runtime.onSuspend`

### Permissions Explained

| Permission | Why |
|------------|-----|
| `tabs` | Read tab URL, title, and ID across all sites |
| `webNavigation` | Detect when pages finish loading |
| `activeTab` | Access the currently focused tab's data |
| `alarms` | Periodic sync that survives SW suspension |
| `storage` | Persist tracking state across SW restarts |

No `<all_urls>` host permission is needed. Only `localhost:54321` is declared in `host_permissions`.

### State Persistence

The extension saves these fields to `chrome.storage.local` on every tab change:
- `activeTabId` — Current tab being tracked
- `activeTabUrl` — Sanitized URL (no query params)
- `activeTabTitle` — Page title
- `activeTabDomain` — Extracted domain
- `sessionStart` — Timestamp when user arrived on this tab
- `isTrackingEnabled` — Master toggle

This ensures that even if the service worker is killed and restarted, tracking resumes seamlessly.

## Configuration

### Change the Server Port

If DeskFlow is running on a different port, edit `background.js` line 11:

```javascript
const DESKFLOW_SERVER = 'http://localhost:YOUR_PORT';
```

Then reload the extension (click the refresh icon on `chrome://extensions`).

### Disable Tracking Temporarily

The extension respects the `isTrackingEnabled` flag. You can toggle it from the DeskFlow app settings, or manually in DevTools:

```javascript
// In service worker console:
chrome.storage.local.set({ deskflow_isTrackingEnabled: false });
```

## Troubleshooting

### Extension not sending data

1. **Check that DeskFlow app is running** — look for `Browser tracking server started on port 54321` in Electron console
2. **Open extension service worker console** → look for `✅ Synced:` messages
3. **Test the server manually:**
   ```bash
   curl http://localhost:54321/health
   curl -X POST http://localhost:54321/browser-data \
     -H "Content-Type: application/json" \
     -d '{"url":"https://test.com","domain":"test.com","title":"Test","active_duration_ms":5000}'
   ```
4. **Check the Network tab** in the service worker DevTools — look for POST requests and their status codes

### No browser data in DeskFlow UI

1. Make sure browser tracking is enabled in DeskFlow settings (Settings → General → Browser Tracking)
2. Verify the port matches between extension and DeskFlow
3. Check that you're **actually browsing** (not just having tabs open) — only active tabs are tracked
4. Minimum session duration is 3 seconds — quick tab switches are ignored
5. Check the service worker console for any `⚠️` or `💔` messages

### Service worker keeps getting killed

This is **normal MV3 behavior**. The extension uses `chrome.alarms` to wake up every ~5 seconds. If you notice gaps in tracking:

1. Open `chrome://extensions` → find DeskFlow → check if there are error messages
2. Reload the extension (refresh icon)
3. Check the console logs for "Server unreachable" — if the server is down, data is silently dropped

### Comet-specific issues

- Comet's AI sidebar/panel: If you're interacting with Perplexity's AI assistant in the sidebar, the main tab is still considered "active" by the extension. This is a known limitation.
- Internal Comet pages: Some Comet-specific internal URLs may have restricted access. The extension filters out any non-`http`/`https` URLs automatically.
- Enterprise policies: If your Comet is managed by an organization, extensions may be restricted by MDM policies.

### Debugging in Comet (or any Chromium browser)

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Find "DeskFlow Browser Tracker"
4. Click the **"Service Worker"** link under "Inspect views"
5. This opens DevTools — use:
   - **Console tab** → see `console.log` output
   - **Network tab** → see HTTP requests to localhost
   - **Application tab** → inspect `chrome.storage.local` data

## Data Flow

```
┌─────────────────┐
│  You browse in  │
│    Comet        │
└────────┬────────┘
         │ Tab events fire
         ▼
┌─────────────────┐
│  Extension SW   │  ← Persisted to chrome.storage.local
│  (MV3, ephem.)  │     Survives SW kills/restarts
└────────┬────────┘
         │ POST every ~5s (chrome.alarms)
         ▼
┌─────────────────┐
│  localhost:54321│  ← DeskFlow Electron HTTP server
│  /browser-data  │     Handles CORS, validates payload
└────────┬────────┘
         │ Enriched with domain categorization
         ▼
┌─────────────────┐
│  SQLite DB      │  ← logs table with url, domain,
│  (better-sqlite)│     tab_id, is_browser_tracking
└────────┬────────┘
         │ IPC (get-browser-logs, get-browser-domain-stats)
         ▼
┌─────────────────┐
│  /browser page  │  ← Charts, domain breakdown,
│  (React + R3F)  │     category pie, timeline
└─────────────────┘
```

## Known Limitations

1. **AI sidebar not tracked** — When the user interacts with Comet's AI assistant in the sidebar, the main tab is still counted as "active." There's no extension API to detect sidebar focus.
2. **Data lost if server is down** — If the DeskFlow app isn't running, HTTP POSTs fail silently. No local queue/buffer is implemented (yet).
3. **Minimum 3-second sessions** — Tab switches faster than 3 seconds are ignored to prevent noise.
4. **Single browser instance** — If you have multiple Comet windows, only the focused window's active tab is tracked. This is by design.
