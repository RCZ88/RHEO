import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { NumberMaskProvider } from './context/NumberMaskContext';
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

console.log('BUILD MARKER v4');

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <HashRouter>
      <NumberMaskProvider>
        <App />
      </NumberMaskProvider>
    </HashRouter>
  </ErrorBoundary>
)
