// Signal to the HTML fallback overlay that the JS bundle loaded successfully
window.__RHEO_LOADED = true;

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { NumberMaskProvider } from './context/NumberMaskContext';
import { ErrorBoundary, triggerGlobalError, isDynamicImportFailure, autoHealDynamicImport } from './components/ErrorBoundary'
import App from './App.tsx'
import { BootOverlay } from './components/boot/BootOverlay';
import { getSplashApi, type BootAnimationConfig } from './components/boot/bootTimings';
import './tokens.css'
import './index.css'
import './styles/lyceum-learn-features.css'
import './styles/terminal-handbook.css'
import './styles/signaling.css'
import { applyTierColors, getTierColorOverrides } from './lib/tierColors'

// Re-apply the user's saved tier colours BEFORE the first paint, so a
// customised productive/neutral/distracting palette survives a reload
// instead of flashing the default green/blue/red for a frame.
applyTierColors(getTierColorOverrides());

console.log('BUILD MARKER v5');

function BootGate({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<BootAnimationConfig | null | undefined>(undefined);

  useEffect(() => {
    console.info('[BootGate] v2.0 pre-bundle loading handoff');
    let cancelled = false;
    let settled = false;
    const resolve = (config: BootAnimationConfig | null) => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      setCfg(config?.enabled ? config : null);
    };
    const timeout = window.setTimeout(() => resolve(null), 2000);
    Promise.resolve()
      .then(() => getSplashApi()?.getBootAnimationConfig())
      .then(config => resolve(config ?? null))
      .catch(() => resolve(null));
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (cfg === undefined) return;
    let frame = 0;
    const handoff = () => {
      frame = requestAnimationFrame(() => {
        document.getElementById('df-startup')?.remove();
      });
    };
    if (cfg || document.documentElement.dataset.bootReady === 'true') handoff();
    window.addEventListener('rheo:boot-ready', handoff);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('rheo:boot-ready', handoff);
    };
  }, [cfg]);

  if (cfg === undefined) {
    return null;
  }

  return (
    <>
      {children}
      {cfg && (
        <BootOverlay
          config={cfg}
          onDone={() => setCfg(null)}
        />
      )}
    </>
  );
}

// Route ALL errors through React ErrorBoundary — both classic and modern patterns
let lastError: string | null = null;
const routeToBoundary = (err: unknown) => {
  if (isDynamicImportFailure(err)) {
    autoHealDynamicImport();
    return;
  }
  const key = err instanceof Error ? err.message : String(err);
  if (key === lastError) return; // deduplicate
  lastError = key;
  
  // Check if this is an IPC/500 error - log it prominently
  const msg = key.toLowerCase();
  if (msg.includes('500') || msg.includes('internal server error') || 
      msg.includes('ipc') || msg.includes('invoke')) {
    console.error('[Main] IPC/Server Error detected:', err);
  }
  
  if (err instanceof Error) triggerGlobalError(err);
  else triggerGlobalError(new Error(String(err)));
};
window.onerror = (_msg, _src, _line, _col, err) => { routeToBoundary(err || _msg); return true; };
window.onunhandledrejection = (e: PromiseRejectionEvent) => { routeToBoundary(e.reason); return true; };
window.addEventListener('error', (e) => routeToBoundary(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => routeToBoundary(e.reason));

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <HashRouter>
      <NumberMaskProvider>
        <BootGate>
          <App />
        </BootGate>
      </NumberMaskProvider>
    </HashRouter>
  </ErrorBoundary>
)