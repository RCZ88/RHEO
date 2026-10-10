// ============================================================================
// Embedded browser — an in-app browser panel.
//
// WHY THIS EXISTS: the AI Gateway launched a SEPARATE Playwright Chromium, so
// signing in to Google looked like leaving the app entirely, and every
// navigation error was swallowed by a bare `catch {}`, so a failed load was
// indistinguishable from a slow one. This puts the page INSIDE the app window.
//
// Google refuses OAuth in embedded webviews that announce themselves as
// Electron, so the user agent is set to a normal desktop Chrome. That is a
// deliberate, documented workaround — see CHROME_UA.
//
// Uses WebContentsView (BrowserView is deprecated in modern Electron).
// ============================================================================
import { BrowserWindow, WebContentsView, ipcMain, shell, session } from 'electron';

const CHROME_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/** Persistent partition, so a Google sign-in survives an app restart. */
const PARTITION = 'persist:deskflow-embedded-browser';

export interface PanelBounds { x: number; y: number; width: number; height: number; }

interface Panel {
  view: WebContentsView;
  url: string;
}

let panel: Panel | null = null;
let host: BrowserWindow | null = null;

/** Only ever navigate to real web pages — blocks file://, javascript:, data:. */
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

function applyHardening(contents: Electron.WebContents) {
  // Any site that tries to spawn a window hands it to the REAL browser instead.
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeUrl(url)) { try { void shell.openExternal(url); } catch { /* ignore */ } }
    return { action: 'deny' };
  });

  // Navigations stay inside the panel, but a non-web scheme is refused outright.
  contents.on('will-navigate', (event, url) => {
    if (!isSafeUrl(url)) { event.preventDefault(); return; }
  });

  contents.on('will-attach-webview', (event) => { event.preventDefault(); });
}

export function registerEmbeddedBrowser(win: BrowserWindow) {
  host = win;
  ipcMain.handle('embedded-browser:open', async (_e, opts: { url?: string } = {}) => {
    const url = String(opts?.url || 'https://gemini.google.com/app');
    if (!isSafeUrl(url)) return { success: false, error: 'Refused to open a non-web URL.' };

    // Persistent session is what makes Google sign-in stick across restarts.
    const ses = session.fromPartition(PARTITION);
    try { await ses.setUserAgent(CHROME_UA); } catch { /* non-fatal */ }

    // Remove any previous panel so repeated opens cannot stack views.
    closePanel();

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        // The panel shows untrusted remote sites, so it gets NO Node access.
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        // Keep the honest Chrome UA on every request/frame, not just the main one.
        additionalArguments: [`--user-agent=${CHROME_UA}`],
      },
    });
    applyHardening(view.webContents);
    panel = { view, url };

    win.contentView.addChildView(view);
    // Load only AFTER the view is attached, otherwise the first paint can be lost.
    try {
      await view.webContents.loadURL(url);
    } catch (e: any) {
      // Previously this was a bare `catch {}` — which is why a black panel gave
      // the user no explanation at all.
      return { success: false, error: 'Could not load ' + url + ' — ' + (e?.message || String(e)), url };
    }
    return { success: true, url, title: view.webContents.getTitle() };
  });

  ipcMain.handle('embedded-browser:close', () => { closePanel(); return { success: true }; });

  ipcMain.handle('embedded-browser:resize', (_e, b: PanelBounds) => {
    if (!panel || !host) return { success: false, error: 'panel not open' };
    // A zero/negative rect would detach the view and look like a black hole.
    const width = Math.max(0, Math.round(b?.width ?? 0));
    const height = Math.max(0, Math.round(b?.height ?? 0));
    if (width < 40 || height < 40) return { success: false, error: 'panel too small' };
    panel.view.setBounds({ x: Math.round(b.x ?? 0), y: Math.round(b.y ?? 0), width, height });
    return { success: true };
  });

  ipcMain.handle('embedded-browser:navigate', async (_e, u: string) => {
    if (!panel) return { success: false, error: 'panel not open' };
    const url = String(u || '');
    if (!isSafeUrl(url)) return { success: false, error: 'Refused to open a non-web URL.' };
    try {
      await panel.view.webContents.loadURL(url);
      panel.url = url;
      return { success: true, url, title: panel.view.webContents.getTitle() };
    } catch (e: any) {
      return { success: false, error: (e?.message || String(e)), url };
    }
  });

  ipcMain.handle('embedded-browser:state', () => {
    if (!panel) return { open: false };
    const wc = panel.view.webContents;
    return { open: true, url: wc.getURL(), title: wc.getTitle(), canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward() };
  });

  ipcMain.handle('embedded-browser:reload', () => {
    if (!panel) return { success: false };
    panel.view.webContents.reload();
    return { success: true };
  });

  win.on('closed', () => { closePanel(); host = null; });
  return { success: true };
}

export function closePanel() {
  if (!panel) return;
  try { host?.contentView.removeChildView(panel.view); } catch { /* already detached */ }
  try { panel.view.webContents.close(); } catch { /* already destroyed */ }
  panel = null;
}