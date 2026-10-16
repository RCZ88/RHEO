// RHEO Browser Extension - Background Service Worker (MV3)
// Tracks only the actively viewed tab and sends data to RHEO Electron app
//
// Key design decisions (based on Chromium MV3 best practices):
// - Uses chrome.alarms instead of setInterval (SW gets killed when idle)
// - Persists state to chrome.storage.local (survives SW restarts)
// - Listens for tabs.onRemoved (handles tab close/crash)
// - Defensive error handling for tabs.get ("No tab with id")

const DESKFLOW_SERVER = 'http://localhost:54321';
const DESKFLOW_ORIGINS = [
  'http://localhost:54321/*',
  'http://127.0.0.1:54321/*',
];
const ALARM_NAME = 'deskflowSync';
// MV3 minimum alarm period: 0.5 min (30s) for unpacked extensions, 1 min installed.
// Values below the minimum are silently clamped by Chrome, so 0.5 is the fastest
// reliable period that keeps the service worker waking on schedule.
const SYNC_PERIOD_MINUTES = 0.5; // 30 seconds
const MIN_SESSION_MS = 3000;       // Minimum 3 seconds before logging
const HEALTH_CHECK_TIMEOUT_MS = 3000;

// --- State (persisted to chrome.storage.local) ---
let state = {
  activeTabId: null,
  activeTabUrl: '',
  activeTabTitle: '',
  activeTabDomain: '',
  /* HALO: private/incognito window flag. Added 2026-10-08 per the Halo spec section 6,
   * which requires "Private window -> never the domain". Only the extension can know this:
   * Chrome reports tab.incognito and Firefox reports tab.private, and by the time a URL
   * reaches the main process the flag is gone. Chrome deliberately does NOT expose
   * incognito state to extensions in incognito windows themselves, so this is best-effort
   * and the Halo must treat `false` as "unknown", not "public". */
  activeTabIsPrivate: false,
  sessionStart: Date.now(),
  lastPeriodicSync: Date.now(),  // Track last sync time for delta calculation
  isTrackingEnabled: true,
  serverHealthy: false,
  isBrowserFocused: true,        // Track if browser window has focus
  profileId: '',                 // Unique per-installation profile identifier
  browserNameOverride: ''        // Pinned browser identity when the UA is ambiguous
};

// --- Persistence helpers ---
async function saveState() {
  try {
    await chrome.storage.local.set({
      deskflow_activeTabId: state.activeTabId,
      deskflow_activeTabUrl: state.activeTabUrl,
      deskflow_activeTabTitle: state.activeTabTitle,
      deskflow_activeTabDomain: state.activeTabDomain,
      deskflow_sessionStart: state.sessionStart,
      deskflow_lastPeriodicSync: state.lastPeriodicSync,
      deskflow_isTrackingEnabled: state.isTrackingEnabled,
      deskflow_isBrowserFocused: state.isBrowserFocused,
      deskflow_profileId: state.profileId,
      deskflow_browserName: state.browserNameOverride
    });
  } catch (err) {
    console.debug('[RHEO] Failed to save state:', err.message);
  }
}

async function loadState() {
  try {
    const data = await chrome.storage.local.get([
      'deskflow_activeTabId',
      'deskflow_activeTabUrl',
      'deskflow_activeTabTitle',
      'deskflow_activeTabDomain',
      'deskflow_sessionStart',
      'deskflow_lastPeriodicSync',
      'deskflow_isTrackingEnabled',
      'deskflow_isBrowserFocused',
      'deskflow_profileId',
      'deskflow_browserName'
    ]);

    if (data.deskflow_activeTabId !== undefined) state.activeTabId = data.deskflow_activeTabId;
    if (data.deskflow_activeTabUrl) state.activeTabUrl = data.deskflow_activeTabUrl;
    if (data.deskflow_activeTabTitle) state.activeTabTitle = data.deskflow_activeTabTitle;
    if (data.deskflow_activeTabDomain) state.activeTabDomain = data.deskflow_activeTabDomain;
    if (data.deskflow_sessionStart) state.sessionStart = data.deskflow_sessionStart;
    if (data.deskflow_lastPeriodicSync) state.lastPeriodicSync = data.deskflow_lastPeriodicSync;
    // CRITICAL FIX: If lastPeriodicSync is not set, initialize to now to prevent huge delta on first sync
    if (!data.deskflow_lastPeriodicSync) state.lastPeriodicSync = Date.now();
    if (data.deskflow_isTrackingEnabled !== undefined) state.isTrackingEnabled = data.deskflow_isTrackingEnabled;
    if (data.deskflow_isBrowserFocused !== undefined) state.isBrowserFocused = data.deskflow_isBrowserFocused;
    if (data.deskflow_profileId) state.profileId = data.deskflow_profileId;
    if (data.deskflow_browserName) state.browserNameOverride = data.deskflow_browserName;

    // Identity may now differ from the value computed at module load.
    refreshBrowserIdentity();

    // Generate a stable profile ID on first run (one per extension installation)
    if (!state.profileId) {
      state.profileId = crypto.randomUUID ? crypto.randomUUID() :
        'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      await saveState();
      console.log('[RHEO] 🆔 Generated new profile ID:', state.profileId);
    }

    console.log('[RHEO] 📦 State loaded from storage');
  } catch (err) {
    console.warn('[RHEO] Failed to load state, using defaults:', err.message);
    // Initialize lastPeriodicSync on error
    state.lastPeriodicSync = Date.now();
  }
}

// --- Helper: Detect which browser the extension is running in ---
// ── BROWSER IDENTITY ────────────────────────────────────────────────────────
// Returns { name, exact }. `exact` means a fork-specific token was positively
// found in the UA. `exact === false` means we know the ENGINE (firefox) but
// NOT which fork — a genuinely ambiguous state, because Zen ships a stock
// Firefox UA in some builds and is then indistinguishable from Firefox by UA
// alone. That distinction decides whether this instance may claim another
// fork's process name; see getBrowserProcessNames.
function detectBrowser() {
  const ua = navigator.userAgent;

  // Chromium-family forks. Every one of these MUST be tested BEFORE the
  // generic Chrome test, because every Chromium UA ends with "Chrome/xxx".
  const CHROMIUM_FORKS = [
    [/Comet/i,             'Comet'],
    [/\bArc\b/i,           'Arc'],
    [/Edg\//,              'Edge'],
    [/OPR\/|Opera/i,       'Opera'],
    [/Brave/i,             'Brave'],
    [/Vivaldi/i,           'Vivaldi'],
  ];
  for (const [re, name] of CHROMIUM_FORKS) {
    if (re.test(ua)) return { name, exact: true };
  }
  if (ua.includes('Chrome') || ua.includes('Chromium')) return { name: 'Chrome', exact: true };

  // Firefox-family forks. A fork's UA normally STILL CONTAINS "Firefox", so
  // these MUST be tested BEFORE the generic Firefox test.
  //
  // The previous code did the opposite: `if (ua.includes('Firefox')) return
  // 'Firefox';` came first and the fork loop sat AFTER it, making that loop
  // UNREACHABLE — every fork UA contains "Firefox", so it always returned
  // early. The loop's own comment claimed "If the UA names one of these it
  // wins over the generic Firefox answer", which was simply false.
  const FIREFOX_FORKS = [
    [/\bZen\b|ZenBrowser/i, 'Zen'],
    [/LibreWolf/i,         'LibreWolf'],
    [/Waterfox/i,          'Waterfox'],
    [/Floorp/i,            'Floorp'],
    [/Mullvad/i,           'Mullvad'],
    [/Ghost/i,             'Ghost'],
    [/Basilisk/i,          'Basilisk'],
    [/Pale ?Moon|Netscape/i, 'Pale Moon'],
  ];
  for (const [re, name] of FIREFOX_FORKS) {
    if (re.test(ua)) return { name, exact: true };
  }

  // Generic Firefox: engine known, fork UNKNOWN. Deliberately NOT claiming
  // any fork's process name — see getBrowserProcessNames for why.
  if (ua.includes('Firefox')) return { name: 'Firefox', exact: false };

  if (ua.includes('Safari')) return { name: 'Safari', exact: true };
  return { name: 'Unknown', exact: false };
}

// ── PROCESS-NAME ALIASES ───────────────────────────────────────────────────
// One entry per browser, containing ONLY that browser's own OS process names.
//
// The previous 'firefox' entry also listed every Firefox fork (zen, librewolf,
// waterfox, floorp, ...). That is the multi-browser bug this table exists to
// prevent: with Zen AND Firefox both running, the copy of the extension inside
// FIREFOX would match a foreground process named "zen" and report itself
// focused, inventing website entries for a browser sitting in the background.
// Under-claiming (no match, no data) is the safer failure than over-claiming
// (another browser's data attributed to this one), so a browser that could not
// positively identify itself claims ONLY its own engine and is expected to be
// pinned via deskflow_browserName.
const BROWSER_PROCESS_NAMES = {
  'comet':     ['comet', 'comet.exe'],
  'chrome':    ['chrome', 'chromium'],
  'brave':     ['brave', 'brave.exe'],
  'edge':      ['msedge', 'edge'],
  'opera':     ['opera'],
  'vivaldi':   ['vivaldi'],
  'firefox':   ['firefox', 'firefox-esr', 'firefox-bin'],
  'zen':       ['zen', 'zen-browser', 'zenbrowser'],
  'librewolf': ['librewolf'],
  'waterfox':  ['waterfox'],
  'floorp':    ['floorp'],
  'mullvad':   ['mullvad'],
  'ghost':     ['ghost-browser', 'ghost'],
  'basilisk':  ['basilisk'],
  'pale moon': ['pale moon', 'palemoon'],
  'arc':       ['arc'],
  'safari':    ['safari'],
};

// ── PINNED IDENTITY OVERRIDE ────────────────────────────────────────────────
// A misdetected identity is not recoverable from the UA, so it is pinned
// explicitly. Stored in extension storage alongside profileId, so it survives
// restarts and upgrades. One value per browser installation.
function getActiveBrowser() {
  if (state.browserNameOverride) {
    return { name: state.browserNameOverride, exact: true, overridden: true };
  }
  return detectBrowser();
}

function getBrowserProcessNames(browserName, exact) {
  const key = String(browserName).toLowerCase();
  const own = BROWSER_PROCESS_NAMES[key];
  if (own) return own;
  return [key];
}

// Resolved identity. Re-resolved by refreshBrowserIdentity() once storage has
// loaded, because a pinned override is stored there and is not known at load.
let BROWSER_IDENTITY = detectBrowser();
let BROWSER_NAME = BROWSER_IDENTITY.name;

function refreshBrowserIdentity() {
  BROWSER_IDENTITY = getActiveBrowser();
  BROWSER_NAME = BROWSER_IDENTITY.name;
  if (!BROWSER_IDENTITY.exact && BROWSER_IDENTITY.name === 'Firefox') {
    console.warn(
      '[RHEO] ⚠️  Firefox-family browser with no fork token in its UA, so it can only' +
      ' claim the "firefox" process name. If this is actually Zen/LibreWolf/etc, pin it once:' +
      ' rheoSetBrowserName("Zen")  — see rheoIdentity() for what was detected.'
    );
  }
  return BROWSER_NAME;
}

// Diagnostics, callable from the extension console (works in both the Firefox
// event page and the Chrome MV3 service worker).
globalThis.rheoIdentity = () => ({
  name: BROWSER_NAME, exact: BROWSER_IDENTITY.exact, overridden: !!BROWSER_IDENTITY.overridden,
  processNames: getBrowserProcessNames(BROWSER_NAME, BROWSER_IDENTITY.exact),
  userAgent: navigator.userAgent, profileId: state.profileId,
});
globalThis.rheoSetBrowserName = async (name) => {
  state.browserNameOverride = String(name || '').trim();
  await saveState();
  return refreshBrowserIdentity();
};

// --- Send browser identification to RHEO ---
async function identifyBrowser() {
  try {
    // Send the union of ALL known alias process names (not just the detected
    // brand's) so the desktop app keeps matching the foreground browser even
    // when UA-based brand detection misidentifies (e.g. Comet reporting as
    // "Chrome" because its UA contains "Chrome"). This prevents the server from
    // clobbering its comet/edge entries in browserProcessNames.
    // ONLY this browser's own process names. Posting the union of every
    // browser's aliases made two installed profiles both claim the same
    // foreground process (e.g. Firefox and Zen both claiming "zen"), so the
    // desktop app could not tell which profile was actually in front.
    const processNames = getBrowserProcessNames(BROWSER_NAME, BROWSER_IDENTITY.exact);
    // A human-friendly label so the app can show "Chrome — Personal" instead of a
    // bare browser name when a user runs two profiles of the same browser.
    let profileName = BROWSER_NAME;
    try {
      const info = await chrome.runtime.getBrowserInfo?.();
      if (info && info.name && info.version) {
        profileName = `${BROWSER_NAME} ${info.version.split('.')[0]}`;
      }
    } catch (e) { /* getBrowserInfo unavailable in this browser */ }
    await fetch(`${DESKFLOW_SERVER}/browser-identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browser: BROWSER_NAME,
        processNames,
        profileId: state.profileId,
        profileName,
        browserVersion: (() => {
          try {
            const m = navigator.userAgent.match(/(?:Chrome|Firefox|Version)\/([\d.]+)/);
            return m ? m[1] : '';
          } catch (e) { return ''; }
        })()
      }),
      signal: AbortSignal.timeout(2000)
    });
    console.log('[RHEO] 🏷️ Identified as:', BROWSER_NAME, 'profileId:', state.profileId);
  } catch (err) {
    // Not a debug message any more: this is the exact reason the desktop app
    // shows nothing, so it must be loud enough to find in the console.
    console.warn('[RHEO] ❌ Could not reach RHEO at ' + DESKFLOW_SERVER
      + ' —', err && err.message);
    console.warn('[RHEO]    If this says ERR_BLOCKED_BY_CLIENT / permission,'
      + ' grant access in about:addons → RHEO Browser Bridge → Permissions.');
  }
}

// --- Helper: Extract domain from URL ---
function extractDomain(url) {
  if (!url) return 'unknown';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.split('/')[2] || 'unknown';
  }
}

// --- Helper: Sanitize URL (strip query params and hash, keep path root) ---
function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname.replace(/\/$/, '')}`;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

// --- Helper: Check if domain/URL should be excluded ---
function shouldExclude(url, domain) {
  // Non-http/https URLs (chrome://, about:, edge://, comet://, etc.)
  if (!url.startsWith('http://') && !url.startsWith('https://')) return true;

  const excludedPatterns = [
    'localhost',
    '127.0.0.1',
    'chrome-extension://',
    'about:blank',
    'newtab'
  ];

  return excludedPatterns.some(pattern =>
    url.includes(pattern) || domain.includes(pattern)
  );
}

// --- Send data to RHEO ---
async function sendToDeskFlow(data) {
  if (!state.isTrackingEnabled) return;

  try {
    const response = await fetch(`${DESKFLOW_SERVER}/browser-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(2000)
    });

    if (response.ok) {
      state.serverHealthy = true;
      console.log('[RHEO] ✅ Synced:', data.domain, `(${Math.round(data.active_duration_ms / 1000)}s)`);
    } else {
      state.serverHealthy = false;
      console.warn('[RHEO] ⚠️ Server returned', response.status, response.statusText);
    }
  } catch (err) {
    state.serverHealthy = false;
    if (err.name === 'AbortError') {
      console.debug('[RHEO] ⏱️ Request timed out — server may not be running');
    } else {
      console.debug('[RHEO] ⚠️ Server unreachable:', err.message);
    }
  }
}

// --- Health check on startup ---
async function healthCheck() {
  try {
    const response = await fetch(`${DESKFLOW_SERVER}/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS)
    });
    if (response.ok) {
      const data = await response.json();
      console.log('[RHEO] 💚 Server healthy:', data);
      state.serverHealthy = true;
    }
  } catch (err) {
    console.warn('[RHEO] 💔 Server health check failed — tracking data will queue until server starts');
    state.serverHealthy = false;
  }
}

// --- Check if the SPECIFIC browser with this extension is the focused application ---
// Queries the desktop app to see what app is currently in foreground
// Only considers the browser focused if the foreground app matches THIS browser
// (not just any browser), preventing website tracking when a different browser/app is active
async function checkBrowserFocus() {
  try {
    const response = await fetch(`${DESKFLOW_SERVER}/foreground-app`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS)
    });
    if (response.ok) {
      const data = await response.json();
      const appName = (data.app || '').toLowerCase();
      const browserName = BROWSER_NAME.toLowerCase();
      const processNames = getBrowserProcessNames(BROWSER_NAME, BROWSER_IDENTITY.exact);

      // Match against THIS extension's own brand name + its process-name aliases ONLY.
      // The union-of-all-browsers approach made this extension consider itself focused
      // whenever ANY browser (Edge, Chrome, ...) was foreground, producing phantom
      // website entries in other browsers. UA-based brand detection is unreliable
      // (Comet's UA often contains "Chrome" but the OS process is "comet"), so the
      // brand's own alias list is still included.
      const thisBrowserAliases = new Set([browserName, ...processNames]);

      // Check multiple matching strategies:
      // 1. Foreground app contains the browser brand name (e.g., "comet.exe" contains "comet")
      // 2. Browser brand name contains the foreground app (handles short process names)
      // 3. Foreground app matches any known process name for THIS browser
      const isBrowserActive = appName.length > 0 && (
        appName.includes(browserName) ||
        browserName.includes(appName) ||
        [...thisBrowserAliases].some(p => appName.includes(p))
      );
      
      console.log('[RHEO] 🔍 Foreground app:', data.app, `(extension host: ${BROWSER_NAME})`, '-> Browser focused:', isBrowserActive);
      state.isBrowserFocused = isBrowserActive;
      await saveState();
      return isBrowserActive;
    }
  } catch (err) {
    console.debug('[RHEO] Could not check foreground app:', err.message);
  }
  // On error (server unreachable, timeout), assume browser is NOT focused
  // Prevents phantom tracking when the desktop app isn't responding
  state.isBrowserFocused = false;
  await saveState();
  return false;
}

// Poll for foreground app changes periodically
let focusCheckInterval = null;
function startFocusCheckPolling() {
  if (focusCheckInterval) clearInterval(focusCheckInterval);
  focusCheckInterval = setInterval(checkBrowserFocus, 2000); // Check every 2 seconds
  console.log('[RHEO] 🔄 Started focus check polling');
}

// --- Update active tab tracking ---
async function updateActiveTab(tabId) {
  if (!tabId) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) {
      console.debug('[RHEO] Tab', tabId, 'has no URL, skipping');
      return;
    }

    const domain = extractDomain(tab.url);

    // Skip excluded domains/URLs
    if (shouldExclude(tab.url, domain)) {
      console.debug('[RHEO] Excluded URL:', tab.url.substring(0, 60));
      return;
    }

    // If switching to a different tab, log the previous session first
    if (state.activeTabId !== null && state.activeTabId !== tabId) {
      await logPreviousSession();
    }

    // Update active tab state
    state.activeTabId = tabId;
    state.activeTabUrl = sanitizeUrl(tab.url);
    state.activeTabTitle = tab.title || domain;
    state.activeTabDomain = domain;
    state.sessionStart = Date.now();
    // CRITICAL FIX: Reset lastPeriodicSync when switching to new domain to prevent huge delta
    state.lastPeriodicSync = Date.now();

    await saveState();
    console.log('[RHEO] 🔄 Tab activated:', domain);

  } catch (err) {
    // Defensive: tabs.get throws "No tab with id" when tab is gone
    if (err.message && err.message.includes('No tab with id')) {
      console.debug('[RHEO] Tab', tabId, 'no longer exists, skipping');
    } else {
      console.debug('[RHEO] Tab update failed:', err.message);
    }
  }
}

// --- Log previous session if it was long enough ---
async function logPreviousSession(force = false) {
  if (!state.activeTabId || !state.activeTabUrl) return;

  // NOTE: No focus gate here. We ALWAYS send the session and flag
  // is_browser_focused; the RHEO desktop app is the authority and decides
  // (it enforces a fresh foreground check unless forceBrowserTracking is on).
  // Gating here caused 24/7 data loss when the flag got stuck false (e.g. UA
  // misdetect on Comet), which is worse than the phantom-entry risk it guarded
  // against.

  const duration = Date.now() - state.sessionStart;

  // Only log if session was long enough to matter
  if (duration < MIN_SESSION_MS) {
    console.debug('[RHEO] Session too short, skipping:', Math.round(duration / 1000) + 's');
    return;
  }

  const data = {
    url: state.activeTabUrl,
    domain: state.activeTabDomain,
    isPrivate: state.activeTabIsPrivate,
    title: state.activeTabTitle,
    tab_id: state.activeTabId,
    timestamp: new Date(state.sessionStart).toISOString(),
    active_duration_ms: duration,
    sanitized_url: sanitizeUrl(state.activeTabUrl),
    is_periodic: false, // Important: this is a tab switch, NOT a periodic sync
    delta_ms: 0,
    is_browser_focused: state.isBrowserFocused, // Tell desktop app if browser was focused
    profileId: state.profileId,  // Which browser profile is active
    browserName: BROWSER_NAME,  // WHICH browser sent this. Without it the app cannot
                               // attribute a site to a browser, and two extensions
                               // visiting the same domain collapse into one row.
  };

  await sendToDeskFlow(data);
  
  // CRITICAL FIX: Reset lastPeriodicSync after logging to prevent huge delta on next periodic sync
  state.lastPeriodicSync = Date.now();
  await saveState();
}

// --- Periodic sync: send delta (new time since last sync) ---
async function periodicSync() {
  // Don't track if no active tab or tracking is disabled
  if (!state.activeTabId || !state.isTrackingEnabled) return;

  // NOTE: No focus gate here — see logPreviousSession. The desktop app decides
  // whether to accept (fresh foreground check / forceBrowserTracking). Removing
  // this gate fixes the stuck-focus false that silently stopped ALL tracking.

  // Calculate DELTA (new time since last sync), not total duration
  const deltaMs = Date.now() - state.lastPeriodicSync;
  
  // Only sync if we've accumulated at least MIN_SESSION_MS of new activity
  if (deltaMs < MIN_SESSION_MS) return;

  // Cap delta at 5 minutes to prevent sleep-time artifacts
  const MAX_DELTA_MS = 5 * 60 * 1000;
  const cappedDelta = Math.min(deltaMs, MAX_DELTA_MS);

  const data = {
    url: state.activeTabUrl,
    domain: state.activeTabDomain,
    isPrivate: state.activeTabIsPrivate,
    title: state.activeTabTitle,
    tab_id: state.activeTabId,
    timestamp: new Date(state.lastPeriodicSync).toISOString(),
    active_duration_ms: cappedDelta,        // Now sending DELTA, not total
    sanitized_url: sanitizeUrl(state.activeTabUrl),
    is_periodic: true,
    delta_ms: cappedDelta,                   // Explicit delta for desktop app
    is_browser_focused: state.isBrowserFocused, // Tell desktop app if browser is focused
    profileId: state.profileId,               // Which browser profile is active
    browserName: BROWSER_NAME,  // WHICH browser sent this. Without it the app cannot
                               // attribute a site to a browser, and two extensions
                               // visiting the same domain collapse into one row.
  };

  // Update last sync time after preparing data
  state.lastPeriodicSync = Date.now();
  await saveState();

  await sendToDeskFlow(data);
}

// ========================================
// --- Event Listeners ---
// ========================================

// 1. Tab activated (user clicked on a different tab)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('[RHEO] 📑 Tab activated:', activeInfo.tabId, 'in window', activeInfo.windowId);
  await updateActiveTab(activeInfo.tabId);
  // Deep Focus: check if this tab should show overlay
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) checkTabFocus(activeInfo.tabId, extractDomain(tab.url));
  } catch {}
});

// 2. Tab updated (URL changed, page loaded, title changed)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process if this is the active tab
  if (tabId !== state.activeTabId) return;

  // URL or title changed — update our tracking
  if (changeInfo.url || changeInfo.title) {
    const url = changeInfo.url || state.activeTabUrl;
    const domain = extractDomain(url);

    if (shouldExclude(url, domain)) {
      console.debug('[RHEO] Tab update to excluded URL, skipping');
      return;
    }

    // Log previous URL session before updating (navigation within same tab)
    if (state.activeTabUrl && sanitizeUrl(url) !== state.activeTabUrl) {
      console.log('[RHEO] 🔗 Navigation detected:', state.activeTabDomain, '→', domain);
      await logPreviousSession();
    }

    state.activeTabUrl = sanitizeUrl(url);
    state.activeTabTitle = tab.title || state.activeTabTitle;
    state.activeTabDomain = domain;
    state.sessionStart = Date.now();

    await saveState();
  }
});

// 3. Navigation completed (page fully loaded in main frame)
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only track main frame navigations (not iframes)
  if (details.frameId !== 0) return;

  // Only if this is the active tab
  if (details.tabId !== state.activeTabId) return;

  try {
    const tab = await chrome.tabs.get(details.tabId);
    if (!tab || !tab.url) return;

    if (shouldExclude(tab.url, extractDomain(tab.url))) return;

    // Log previous page session before updating
    if (state.activeTabUrl && sanitizeUrl(tab.url) !== state.activeTabUrl) {
      console.log('[RHEO] 📄 Page navigation completed:', details.tabId);
      await logPreviousSession();
    }

    state.activeTabId = details.tabId;
    state.activeTabUrl = sanitizeUrl(tab.url);
    state.activeTabTitle = tab.title || extractDomain(tab.url);
    state.activeTabDomain = extractDomain(tab.url);
    state.activeTabIsPrivate = isPrivateTab(tab);
    state.sessionStart = Date.now();
    state.lastPeriodicSync = Date.now(); // Reset sync time for new page

    await saveState();
    // Deep Focus: check if navigated page should show overlay
    checkTabFocus(details.tabId, extractDomain(tab.url));
  } catch (err) {
    console.debug('[RHEO] webNavigation handler failed:', err.message);
  }
});

// 4. Window focus changed (user switched browser windows or left browser entirely)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Lost focus — user left the browser (Alt+Tab, clicked another app)
    console.log('[RHEO] 🪟 Browser lost focus - pausing tracking');
    state.isBrowserFocused = false;
    await saveState();
    await logPreviousSession(true); // Force flush: capture time spent up to focus loss
  } else {
    // Regained focus — refresh active tab for the SPECIFIC window that gained focus
    // FIX: Use windowId from the event, NOT currentWindow:true (which queries extension's popup window)
    console.log('[RHEO] 🪟 Browser regained focus, window:', windowId);
    state.isBrowserFocused = true;
    state.lastPeriodicSync = Date.now(); // Reset sync time when regaining focus
    await saveState();
    try {
      // Query tabs in the SPECIFIC window that just gained focus
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        await updateActiveTab(tabs[0].id);
      }
    } catch (err) {
      console.debug('[RHEO] Focus change handler failed:', err.message);
    }
  }
});

// 5. Tab removed (closed or crashed) — ADDED based on Perplexity feedback
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  if (tabId === state.activeTabId) {
    console.log('[RHEO] ❌ Active tab removed:', tabId);
    await logPreviousSession();

    // Reset state
    state.activeTabId = null;
    state.activeTabUrl = '';
    state.activeTabTitle = '';
    state.activeTabDomain = '';
    state.sessionStart = Date.now();
    state.lastPeriodicSync = Date.now(); // Reset sync time for new session

    await saveState();
  }
});

// ========================================
// --- chrome.alarms for periodic sync ---
// (Replaces setInterval — survives SW suspension)
// ========================================

// MV3 kills an idle service worker (~30s) and revives it on the next event.
// onStartup() only fires on browser launch / extension install, so a worker
// revived by its own alarm came back with NONE of the runtime rebuilt:
//   - `state` reset to module defaults, including isBrowserFocused = TRUE
//   - focus polling never re-armed (setInterval dies with the worker)
//   - loadState() never ran, so state.activeTabId was null
//     → periodicSync() early-returns and the extension goes dormant.
// Net effect: website tracking silently stops after a short idle period and
// never recovers on its own. This rebuilds it on every wake.
let runtimeReady = false;

/**
 * Firefox / Zen MV3: declared `host_permissions` are OPT-IN. Chrome grants them
 * automatically at install; Firefox does not — the user must grant them, and
 * until they do, every fetch() to localhost:54321 is blocked. That produced the
 * worst possible failure: the extension installs cleanly, the app never sees a
 * single request, and nothing anywhere reports an error.
 *
 * Chrome ignores the result (already granted), so this is safe cross-browser.
 * Note Firefox requires permissions.request() to come from a user gesture in
 * some builds, so we attempt it on install AND expose the same call from the
 * popup button as the guaranteed-working path.
 */
let permissionRetryTimer = null;

/**
 * Ask until we have it.
 *
 * Firefox-family MV3 makes host_permissions opt-in, and Chrome ignores the whole
 * call because it already granted them. The awkward part is that
 * permissions.request() normally needs a user gesture — which used to mean the
 * ONLY way to grant access was the popup, i.e. the one thing a new user cannot
 * find. That is a circular dependency.
 *
 * So: try without a gesture on a short retry. Several Firefox versions do accept
 * an unprompted request from an installed (non-temporary) extension, and the
 * install-time permission prompt itself can grant it outright. Retry a few
 * times so we catch whichever path the browser allows, then give up quietly and
 * let the user finish it from about:addons (a path that never needs the popup).
 */
function schedulePermissionRetry(attempt = 0) {
  if (attempt >= 6) {
    console.warn('[RHEO] 🔒 Still no host permission after retries. Finish it in '
      + 'about:addons → RHEO Browser Bridge → Permissions → allow localhost.');
    return;
  }
  if (permissionRetryTimer) clearTimeout(permissionRetryTimer);
  const delay = Math.min(2000 * Math.pow(2, attempt), 30000); // 2s,4s,8s,16s,30s,30s
  permissionRetryTimer = setTimeout(async () => {
    if (await ensureHostPermissions(false)) return;
    schedulePermissionRetry(attempt + 1);
  }, delay);
}

async function ensureHostPermissions(interactive = false) {
  const api = (typeof browser !== 'undefined' && browser.permissions) ? browser : chrome;
  try {
    const granted = await api.permissions.contains({ origins: DESKFLOW_ORIGINS });
    if (granted) {
      if (permissionRetryTimer) { clearTimeout(permissionRetryTimer); permissionRetryTimer = null; }
      return true;
    }
    // Try regardless of `interactive`. A rejected/unavailable request is caught
    // below; asking costs nothing and may succeed unprompted.
    const requested = await api.permissions.request({ origins: DESKFLOW_ORIGINS })
      .catch(() => false);
    if (requested) {
      console.log('[RHEO] 🔓 Host permissions granted — can reach RHEO now.');
      if (permissionRetryTimer) { clearTimeout(permissionRetryTimer); permissionRetryTimer = null; }
      return true;
    }
    if (!interactive) {
      console.log('[RHEO] 🔒 Host permissions not granted (Firefox MV3 opt-in).');
      return false;
    }
    return false;
  } catch (err) {
    console.warn('[RHEO] permissions API unavailable:', err && err.message);
    return false;
  }
}

async function ensureRuntime(reason) {
  try {
    // Idempotent: loadState just re-reads chrome.storage.local, and
    // startFocusCheckPolling clears its previous interval before arming.
    await loadState();
    startFocusCheckPolling();
    await ensureHostPermissions(false);

    chrome.alarms.clear(ALARM_NAME);
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_PERIOD_MINUTES });

    // Re-announce on every wake. This is the heartbeat that keeps the desktop
    // app's "connected" state truthful — without it the app can only guess,
    // and a profile looks disconnected while the extension is working fine.
    await identifyBrowser();

    runtimeReady = true;
    console.log(`[RHEO] ♻️ Runtime ready (${reason}) · tab=${state.activeTabId ?? 'none'} focused=${state.isBrowserFocused}`);
  } catch (err) {
    console.warn('[RHEO] ensureRuntime failed:', err && err.message);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Unconditional, not gated on runtimeReady: this is also the heartbeat that
    // keeps the desktop app's "connected" state truthful. Gating it would let a
    // long-lived worker stop re-announcing, and the app would eventually show a
    // working extension as disconnected (its TTL is 60s, the alarm is 30s).
    // Cost is one storage read + one localhost POST per tick.
    await ensureRuntime(runtimeReady ? 'periodic tick' : 'service worker revived');
    await periodicSync();
  }
});

// ========================================
// --- Startup sequence ---
// ========================================

async function onStartup() {
  console.log('[RHEO] 🚀 Browser tracker extension started (MV3)');

  // 1. Load persisted state
  await loadState();

  // 2. Health check — verify RHEO server is running
  await healthCheck();

  // 3. Identify which browser this extension is running in
  await identifyBrowser();

  // 4. Check initial browser focus state
  await checkBrowserFocus();

  // 4. Start focus check polling to monitor foreground app changes
  startFocusCheckPolling();

  // 5. Set up periodic sync alarm. Shared with the service-worker revive path
  //    (ensureRuntime) so the two can never drift apart again.
  chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_PERIOD_MINUTES });
  runtimeReady = true;
  console.log(`[RHEO] ⏰ Periodic sync alarm set (every ${SYNC_PERIOD_MINUTES * 60}s)`);

  // 6. If we had an active tab from before SW restart, verify it still exists
  if (state.activeTabId) {
    try {
      const tab = await chrome.tabs.get(state.activeTabId);
      if (tab && tab.url) {
        console.log('[RHEO] 📋 Restored active tab:', state.activeTabDomain);
      } else {
        console.log('[RHEO] 📋 Previously active tab no longer exists, resetting');
        state.activeTabId = null;
        state.activeTabUrl = '';
        state.activeTabDomain = '';
        await saveState();
      }
    } catch {
      // Tab no longer exists — reset
      state.activeTabId = null;
      await saveState();
    }
  }

  // 5. Query the currently active tab to initialize tracking
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs.length > 0 && tabs[0].url) {
      await updateActiveTab(tabs[0].id);
      console.log('[RHEO] 📋 Initialized with current tab:', state.activeTabDomain);
    }
  } catch (err) {
    console.debug('[RHEO] Could not query active tab on startup:', err.message);
  }
}

// Listen for extension runtime events
chrome.runtime.onStartup.addListener(onStartup);
chrome.runtime.onInstalled.addListener(async () => {
  await ensureHostPermissions(false);
  schedulePermissionRetry(0);
  await onStartup();
});
chrome.runtime.onStartup.addListener(() => { schedulePermissionRetry(0); });

// Also run on service worker wake (handles SW being killed and restarted)
onStartup();

// ========================================
// --- Deep Focus: overlay control ---
// ========================================

let FOCUS_TOKEN = '';
chrome.storage.local.get('deskflowFocusToken', (v) => { FOCUS_TOKEN = v.deskflowFocusToken || ''; });

async function focusPost(path, body) {
  try {
    const r = await fetch(DESKFLOW_SERVER + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RHEO-Token': FOCUS_TOKEN },
      body: JSON.stringify(body)
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function checkTabFocus(tabId, domain) {
  if (!FOCUS_TOKEN) return;
  const r = await focusPost('/focus-web-activity', { domain });
  if (r && r.overlay) chrome.tabs.sendMessage(tabId, { type: 'FOCUS_SHOW' });
  else chrome.tabs.sendMessage(tabId, { type: 'FOCUS_HIDE' });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  // Popup → background: the only reliable way to get a Firefox MV3 host-
  // permission grant is from a real user gesture.
  if (msg && msg.type === 'DESKFLOW_REQUEST_PERMISSIONS') {
    return (async () => {
      const granted = await ensureHostPermissions(true);
      if (granted) { await ensureRuntime('permissions granted'); await identifyBrowser(); }
      return { ok: granted };
    })();
  }
  if (msg && msg.type === 'DESKFLOW_DIAGNOSE') {
    // Tell the popup WHY nothing is arriving, instead of a silent no-op.
    return (async () => {
      const granted = await ensureHostPermissions(false);
      let reachable = false, health = null;
      try {
        const r = await fetch(`${DESKFLOW_SERVER}/health`, { signal: AbortSignal.timeout(2500) });
        reachable = r.ok;
        health = await r.json().catch(() => null);
      } catch (e) { health = { error: e && e.message }; }
      return { ok: granted && reachable, permissions: granted, reachable, health };
    })();
  }
  if (msg?.type === 'FOCUS_CHECK' && sender.tab) checkTabFocus(sender.tab.id, msg.domain);
  if (msg?.type === 'FOCUS_BREAK') focusPost('/focus-break', { domain: msg.domain });

  // --- AI Context Capture ---
  if (msg?.type === 'AI_CONTEXT_CAPTURED' && msg.captures?.length) {
    relayAiContext(msg.captures);
  }
});

// ========================================
// --- AI Context Relay to Desktop App ---
// ========================================

let aiContextBuffer = [];
let aiContextFlushTimer = null;
let recentAiKeys = new Map();
const AI_CONTEXT_FLUSH_MS = 3000;
const AI_CONTEXT_MAX_BATCH = 20;

async function relayAiContext(captures) {
  // Deduplicate by captureKey
  const deduped = captures.filter(cap => {
    const key = cap.captureKey;
    if (!key) return true;
    if (recentAiKeys.has(key)) return false;
    recentAiKeys.set(key, Date.now());
    return true;
  });
  // Expire old keys (5 min)
  const now = Date.now();
  for (const [k, t] of recentAiKeys) {
    if (now - t > 300000) recentAiKeys.delete(k);
  }
  if (!deduped.length) return;
  aiContextBuffer.push(...deduped);
  if (aiContextFlushTimer) return;
  aiContextFlushTimer = setTimeout(flushAiContext, AI_CONTEXT_FLUSH_MS);
}

// --- Persistent retry queue (survives SW termination) ---
const RETRY_QUEUE_KEY = 'deskflow_retry_queue';
const MAX_RETRY_ATTEMPTS = 8;

async function enqueueRetry(batch) {
  const { [RETRY_QUEUE_KEY]: existing = [] } = await chrome.storage.local.get(RETRY_QUEUE_KEY);
  const entry = { batch, attempts: 0, firstFailedAt: Date.now(), lastAttemptAt: Date.now() };
  await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: [...existing, entry] });
}

async function drainRetryQueue() {
  const { [RETRY_QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(RETRY_QUEUE_KEY);
  if (!queue.length) return;
  const remaining = [];
  for (const entry of queue) {
    if (entry.attempts >= MAX_RETRY_ATTEMPTS) continue; // drop after max attempts
    try {
      const res = await fetch(`${DESKFLOW_SERVER}/ai-context`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captures: entry.batch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const stillFailing = entry.batch.filter(c =>
        body.results?.find(r => r.dedup_key === c.dedup_key)?.status === 'error');
      if (stillFailing.length) {
        remaining.push({ ...entry, batch: stillFailing, attempts: entry.attempts + 1, lastAttemptAt: Date.now() });
      }
    } catch {
      remaining.push({ ...entry, attempts: entry.attempts + 1, lastAttemptAt: Date.now() });
    }
  }
  await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: remaining });
}

async function flushAiContext() {
  aiContextFlushTimer = null;
  if (!aiContextBuffer.length) return;
  const batch = aiContextBuffer.splice(0, AI_CONTEXT_MAX_BATCH);
  try {
    const res = await fetch(`${DESKFLOW_SERVER}/ai-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captures: batch }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const stillFailing = batch.filter(c =>
      body.results?.find(r => r.dedup_key === c.dedup_key)?.status === 'error');
    if (stillFailing.length) {
      await enqueueRetry(stillFailing);
    }
  } catch (e) {
    // Server not running — enqueue for retry
    await enqueueRetry(batch);
  }
}

// ========================================
// --- Two-Way Context Loop: Polling for Commands from Desktop App ---
// ========================================

setInterval(async () => {
  try {
    const r = await fetch(`${DESKFLOW_SERVER}/extension/poll`);
    if (r.ok) {
      const cmds = await r.json();
      for (const cmd of cmds) {
        if (cmd.type === 'INSERT_INTO_CHAT') {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            chrome.tabs.sendMessage(tab.id, { type: 'DESKFLOW_INSERT_CONTEXT', text: cmd.text });
          }
        }
        // Helper: preserve the correlation fields (correlationId + expectedKeys)
        // so the response detector (ai-context-content.js) can echo them back and
        // the app can auto-fill the exact field/form that sent the request.
        const toInjectMessage = (cmd) => ({
          type: 'INJECT_PROMPT',
          promptType: cmd.promptType || (cmd.type ? cmd.type.replace('_INJECT', '').toLowerCase() : 'unknown'),
          text: cmd.text,
          episodeId: cmd.episodeId,
          correlationId: cmd.correlationId ?? null,
          expectedKeys: cmd.expectedKeys ?? [],
        });

        /**
         * Resolve which tab receives the prompt.
         *
         * Previously this was ALWAYS the active tab, so injection only worked if
         * you already had that provider open AND focused. When the desktop app
         * launches a provider for you the tab arrives asynchronously, so wait
         * briefly for one matching cmd.urlPatterns, fall back to the active tab,
         * and finally create one — so a prompt is never silently dropped.
         */
        const resolveTargetTab = async (cmd) => {
          const patterns = Array.isArray(cmd.urlPatterns) ? cmd.urlPatterns : [];
          if (patterns.length) {
            const deadline = Date.now() + (cmd.waitForTabMs || 20000);
            while (Date.now() < deadline) {
              const found = await chrome.tabs.query({ url: patterns });
              if (found && found.length) {
                const tab = found[found.length - 1];
                try { await chrome.tabs.update(tab.id, { active: true }); } catch (_e) {}
                return tab;
              }
              await new Promise(r => setTimeout(r, 700));
            }
          }
          const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (active) return active;
          if (cmd.url) return await chrome.tabs.create({ url: cmd.url, active: true });
          return null;
        };

        if (cmd.type === 'CONTENT_ENGINE_INJECT') {
          const tab = await resolveTargetTab(cmd);
          if (tab) chrome.tabs.sendMessage(tab.id, toInjectMessage(cmd));
        }
        // All other category injections (learn / goals / finance / resume / general)
        // reuse the same INJECT_PROMPT path — focusOverlay.js injects into the active
        // chat input on any supported provider. promptType carries the category so the
        // response detector can tag the capture correctly.
        else if (
          cmd.type === 'LEARN_INJECT' ||
          cmd.type === 'GOALS_INJECT' ||
          cmd.type === 'FINANCE_INJECT' ||
          cmd.type === 'RESUME_INJECT' ||
          cmd.type === 'GENERAL_INJECT'
        ) {
          const tab = await resolveTargetTab(cmd);
          if (tab) chrome.tabs.sendMessage(tab.id, toInjectMessage(cmd));
        }
        // Drain the persistent retry queue before processing new captures
        await drainRetryQueue();
      }
    }
  } catch (e) { /* Ignore polling errors if server is offline */ }
}, 2000);

// Also drain the retry queue at startup (survives SW restart)
chrome.runtime.onStartup.addListener(() => { drainRetryQueue(); });
chrome.runtime.onInstalled.addListener(() => { drainRetryQueue(); });

// ========================================
// --- Cleanup on service worker shutdown ---
// ========================================

chrome.runtime.onSuspend.addListener(async () => {
  console.log('[RHEO] 💤 Service worker suspending — flushing session');
  await logPreviousSession();
  // Persist any buffered captures to the retry queue before SW dies
  if (aiContextBuffer.length) await enqueueRetry(aiContextBuffer.splice(0));
});

/**
 * Is this tab in a private / incognito window? Best-effort.
 *
 * Chrome exposes `tab.incognito` and Firefox exposes `tab.private`; they are different
 * property names for the same fact, so both are read. Returns false when neither is
 * present rather than guessing, and the Halo must treat that as UNKNOWN.
 *
 * Chrome does not run most extensions inside incognito windows at all unless the user has
 * allowed it, so in practice this flag is often simply absent - which is exactly why the
 * Halo needs a "Browser" fallback state rather than assuming a domain is safe to show.
 */
function isPrivateTab(tab) {
  if (!tab) return false;
  return tab.incognito === true || tab.private === true;
}
