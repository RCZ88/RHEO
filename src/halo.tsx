/**
 * halo.tsx — render root for the Halo Island's own window.
 *
 * Separate Vite entry, same reasoning as stt-panel.tsx: this window has to sit
 * above every other application, so it cannot share RHEO's renderer. This entry
 * mounts only the island.
 */

import { createRoot } from 'react-dom/client';
import { OverlayRoot } from './features/halo/OverlayRoot';
import './tokens.css';
import './index.css';

declare global {
  interface Window {
    __haloTimeout?: ReturnType<typeof setTimeout>;
    __haloShowError?: (message: string) => void;
  }
}

const container = document.getElementById('root');

if (!container) {
  console.error('[Halo] #root missing in halo.html');
} else {
  try {
    // THEME — this window is a SEPARATE document with its own <html>. The main
    // app's theme.ts runs in the main window and toggles `.light` on THAT
    // documentElement only, so it never reaches the island — the halo stayed
    // dark in light mode regardless of the app theme. Read the same
    // `df-theme` pref and apply `.light` here. The halo's surfaces are already
    // token-driven (halo.css reads --ws-surface / --text-primary), so the class
    // is all they need. Keep the class in sync if the user flips theme at
    // runtime via the shared THEME_EVENT.
    const THEME_KEY = 'df-theme';
    const resolveLight = (pref: string | null): boolean => {
      if (pref === 'light') return true;
      if (pref === 'dark') return false;
      try { return window.matchMedia('(prefers-color-scheme: light)').matches; } catch { return false; }
    };
    const applyHaloTheme = () => {
      let pref: string | null = null;
      try { pref = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
      document.documentElement.classList.toggle('light', resolveLight(pref));
    };
    applyHaloTheme();
    // Runtime sync: the main window's theme.ts writes `df-theme` to
    // localStorage when the user flips theme. `storage` events fire in OTHER
    // windows sharing that localStorage — i.e. here — so this is the correct
    // cross-window channel. (The app's THEME_EVENT CustomEvent does NOT cross
    // windows, so listening for it would never fire in the island.)
    window.addEventListener('storage', (e) => {
      if (e.key === THEME_KEY) applyHaloTheme();
    });

    // The native window is transparent; clearing the page background stops
    // Chromium compositing an opaque rectangle behind the island. This inline
    // style WINS over the html/body/#root background the .light class sets in
    // index.html, so the island stays transparent in light mode too.
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    createRoot(container).render(<OverlayRoot />);
    if (window.__haloTimeout) {
      clearTimeout(window.__haloTimeout);
      window.__haloTimeout = undefined;
    }
    const fb = document.getElementById('halo-fallback');
    if (fb) fb.style.display = 'none';
    console.log('[Halo] v1.0 island mounted');
  } catch (err) {
    console.error('[Halo] mount failed', err);
    window.__haloShowError?.(
      err instanceof Error ? `The island failed to start: ${err.message}` : 'The island failed to start.',
    );
  }
}