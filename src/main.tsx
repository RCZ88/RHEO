// Signal to the HTML fallback overlay that the JS bundle loaded successfully
window.__RHEO_LOADED = true;

import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { NumberMaskProvider } from './context/NumberMaskContext';
import { ErrorBoundary, triggerGlobalError, isDynamicImportFailure, autoHealDynamicImport } from './components/ErrorBoundary'
import App from './App.tsx'
import './tokens.css'
import './index.css'
import './styles/lyceum-learn-features.css'
import './styles/signaling.css'

console.log('BUILD MARKER v5');

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
        <App />
      </NumberMaskProvider>
    </HashRouter>
  </ErrorBoundary>
)
