import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PenguinConsole from './App'

// PenguinConsole is mounted via React Router at /penguin-console
// This standalone entry is kept for potential future standalone use
if (document.getElementById('terminal-root')) {
  createRoot(document.getElementById('terminal-root') as HTMLElement).render(
    <StrictMode>
      <PenguinConsole />
    </StrictMode>
  )
}
