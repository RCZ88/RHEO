import { app, ipcMain, BrowserWindow } from 'electron';

/**
 * Auto-update for packaged RHEO builds.
 *
 * WHY THIS IS A SEPARATE MODULE
 * -----------------------------
 * `src/main.ts` is ~30,000 lines and is the most contended file in this repo.
 * Everything here is additive and independently loadable, so the updater can be
 * wired in with one import and one call, and removed the same way.
 *
 * WHY IT IS A NO-OP UNDER `npm start`
 * ----------------------------------
 * electron-updater is meaningless for an unpackaged app: there is no install to
 * replace and no app-update.yml to read. Calling it there produces a confusing
 * "cannot find app-update.yml" error and, worse, tempts someone into adding
 * `--no-update` flags. So the guard is explicit and loud.
 *
 * WHY THERE IS A BACKOFF AND NOT A POLL LOOP
 * ------------------------------------------
 * `checkForUpdates()` hits the network. Doing that on every launch is rude to the
 * release server and to the user's bandwidth, and hammering GitHub's API from
 * every install eventually trips secondary rate limits. Once a day is plenty for
 * an app that changes on CZ's schedule.
 *
 * The GitHub provider is used rather than a generic HTTP server so updates need no
 * infrastructure of our own: a published GitHub Release IS the update feed, and
 * electron-updater reads `latest-linux.yml` / `latest.yml` from it automatically.
 */

const LOG = '[auto-update]';
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day

interface UpdaterModule {
  autoUpdater: {
    autoDownload: boolean;
    autoInstallOnAppQuit: boolean;
    checkForUpdates(): Promise<unknown>;
    quitAndInstall(silent?: boolean, forceRunAfter?: boolean): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
  };
}

let loaded: UpdaterModule | null = null;
let wired = false;

function log(...args: unknown[]): void {
  try {
    console.log(LOG, ...args);
  } catch {
    /* stdout closed */
  }
}

/** electron-updater throws if it cannot resolve electron's own internals. */
function loadUpdater(): UpdaterModule | null {
  if (loaded) return loaded;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    loaded = require('electron-updater') as UpdaterModule;
    return loaded;
  } catch (err) {
    log('electron-updater unavailable:', (err as Error).message);
    return null;
  }
}

/**
 * An app launched from `npm start` / `electron .` has no install directory, so
 * there is nothing to update. `app.isPackaged` is the supported check for this.
 */
export function isUpdaterAvailable(): boolean {
  if (!app.isPackaged) return false;
  return loadUpdater() !== null;
}

function shouldCheckNow(): boolean {
  return Date.now() - lastCheckAt > MIN_INTERVAL_MS;
}

/**
 * Called once from `whenReady`. Registers IPC for a manual "check now" from the
 * renderer and performs an automatic background check at most once a day.
 */
export function initAutoUpdate(getWindow: () => BrowserWindow | null): void {
  if (wired) return;
  wired = true;

  if (!app.isPackaged) {
    log('not packaged (dev run) — updater disabled by design');
    return;
  }
  const mod = loadUpdater();
  if (!mod) {
    log('electron-updater not installed — auto-update inactive');
    return;
  }

  const { autoUpdater } = mod;

  // Download in the background, but never install silently: the user must be
  // running when the app replaces itself, or a half-written binary is running.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info: unknown) => {
    const v = (info as { version?: string })?.version;
    log(`update available: ${v}`);
    getWindow()?.webContents.send('update-available', { version: v });
  });

  autoUpdater.on('update-not-available', () => {
    log('already up to date');
  });

  autoUpdater.on('error', (err: unknown) => {
    // An update check failing must NEVER break the app. Network down, rate
    // limited, or a malformed feed — all of these are routine, not exceptional.
    log('check failed (ignored):', (err as Error)?.message ?? String(err));
  });

  autoUpdater.on('update-downloaded', (info: unknown) => {
    const v = (info as { version?: string })?.version;
    log(`update downloaded: ${v} — installs on quit`);
    getWindow()?.webContents.send('update-downloaded', { version: v });
  });

  ipcMain.handle('app:check-for-update', async () => {
    try {
      const r = (await autoUpdater.checkForUpdates()) as { updateInfo?: { version?: string } };
      return { ok: true, version: r?.updateInfo?.version ?? null };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('app:install-update', () => {
    log('user requested install — quitting');
    // isSilent=false shows the updater's own progress UI before the restart.
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  if (shouldCheckNow()) {
    lastCheckAt = Date.now();
    // Fire and forget. A failure logs via the 'error' listener and is ignored.
    void autoUpdater.checkForUpdates().catch(() => undefined);
  } else {
    log('skipped — checked within the last 24h');
  }

  log(`enabled for ${app.getVersion()} on ${process.platform}`);
}