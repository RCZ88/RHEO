// R-10 · Boot splash — main process window + config
import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { getBootAnimation, setBootAnimation } from '../services/prefService';

export function createSplashWindow(): BrowserWindow | null {
  const cfg = getBootAnimation();
  if (!cfg?.enabled || cfg.variant !== 'meridian') return null;

  const primary = screen.getPrimaryDisplay();
  const W = 520;
  const H = 320;
  const x = Math.round((primary.workArea.width - W) / 2);
  const y = Math.round((primary.workArea.height - H) / 2);

  let splash: BrowserWindow | null = null;
  try {
    splash = new BrowserWindow({
      width: W,
      height: H,
      x: x,
      y: y,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      transparent: true,
      backgroundColor: '#09090b',
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });

    // Attempt transparent; fall back to solid bg on failure (R-10d)
    splash.on('ready-to-show', () => {
      if (splash && !splash.isDestroyed()) {
        splash.show();
      }
    });

    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    const splashUrl = isDev
      ? `${process.env.VITE_DEV_SERVER_URL}/splash.html`
      : `file://${path.join(__dirname, '../dist/splash.html')}`;

    splash.loadURL(splashUrl);

    // Dismiss on any user input
    const dismiss = () => { if (splash && !splash.isDestroyed()) splash.close(); };
    splash.webContents.on('did-finish-load', dismiss);
    splash.webContents.on('did-fail-load', dismiss);
    splash.on('focus', dismiss);
    splash.on('blur', () => { /* keep visible */ });
    splash.webContents.on('keydown', dismiss);
    splash.webContents.on('mouse-down', dismiss);

    // Hard cap 4000ms — splash can NEVER strand the app
    setTimeout(() => { if (splash && !splash.isDestroyed()) splash.close(); }, 4000);

    console.log('[R-10] Splash window created (520×320, frameless, transparent=%s)',
      splash.isTransparent() ? 'true' : 'false(fallback)');
  } catch (e) {
    console.error('[R-10] Failed to create splash window:', e);
    if (splash) splash.destroy();
    return null;
  }
  return splash;
}

export function dismissSplash() {
  // Called from renderer via IPC when main window is ready
  const all = BrowserWindow.getAllWindows();
  for (const w of all) {
    if (w.isVisible() && w.getTitle() === 'RHEO' && w.getSize()[0] === 520) {
      w.close();
    }
  }
}
