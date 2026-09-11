// SimpleTerminalPage.tsx — Standalone terminal page (separate from workspace)
// Single xterm.js pane, no workspace shell, no mini-map, no sidebar groups.
import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal as TerminalIcon,
  PanelLeftClose,
  PanelLeft,
  Settings2,
  Shield,
  ChevronLeft,
} from 'lucide-react'
import { PageShell } from '../components/PageShell'
import { GlassCard } from '../components/GlassCard'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import '@xterm/xterm/css/xterm.css'

function generateTerminalId(): string {
  return `sterm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const THEME = {
  background: '#0d0d0d',
  foreground: '#e0e0e0',
  cursor: '#00ff00',
  cursorAccent: '#0d0d0d',
  selectionBackground: '#3b82f680',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export default function SimpleTerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const nav = useNavigate()
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const [shellCwd, setShellCwd] = useState(() => {
    // Default to user home — a sensible starting point
    if (typeof window !== 'undefined' && window.deskflowAPI) {
      return undefined // let main process pick default
    }
    return undefined
  })

  // Spawn terminal on mount
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return

    const id = generateTerminalId()
    setTerminalId(id)

    const terminal = new Terminal({
      theme: THEME,
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      scrollback: 5000,
      cursorStyle: 'bar',
      windowsMode: true,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(containerRef.current)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Listen for incoming data from main process
    const unsubData = window.deskflowAPI?.onTerminalData?.((_id, data) => {
      if (_id === id && terminalRef.current) {
        terminalRef.current.write(data)
      }
    })

    // Listen for exit
    const unsubExit = window.deskflowAPI?.onTerminalExit?.((_id, exitCode, signal, intentional) => {
      if (_id === id) {
        setStatus('error')
        setErrorMsg(`Shell exited (code ${exitCode}, signal ${signal})`)
      }
    })

    // Listen for ready
    const unsubReady = window.deskflowAPI?.onTerminalReady?.(_id => {
      if (_id === id) {
        setStatus('ready')
      }
    })

    // Fit before spawning so PTY gets correct dimensions
    if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
      try { fitAddon.fit() } catch {}
    }

    // ResizeObserver to keep xterm + PTY in sync
    const ro = new ResizeObserver(debounce(() => {
      if (fitAddonRef.current && containerRef.current) {
        try { fitAddonRef.current.fit() } catch {}
      }
    }, 150))
    ro.observe(containerRef.current)

    terminal.onResize(({ cols, rows }) => {
      window.deskflowAPI?.resizeTerminal?.(id, cols, rows)
    })

    terminal.onData(data => {
      window.deskflowAPI?.writeTerminal?.(id, data)
    })

    terminal.onLinkedTextContent(e => {
      if (e.isTrusted && e.detail) {
        window.open(e.detail, '_blank')
      }
    })

    // Spawn the PTY
    window.deskflowAPI?.spawnTerminal?.(id, shellCwd, undefined, terminal.cols, terminal.rows)
      .then(ok => {
        if (!ok) {
          setStatus('error')
          setErrorMsg('Failed to spawn shell')
        }
      })
      .catch(err => {
        setStatus('error')
        setErrorMsg(err.message || 'Spawn error')
      })

    return () => {
      ro.disconnect()
      unsubData?.()
      unsubExit?.()
      unsubReady?.()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      // Kill the PTY
      window.deskflowAPI?.killTerminal?.(id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    nav('/')  // go back to dashboard
  }, [nav])

  const toggleSidebar = useCallback(() => {
    setShowSidebar(s => !s)
  }, [])

  return (
    <PageShell
      title="Terminal"
      icon={<TerminalIcon className="w-4 h-4" />}
      showSidebar={showSidebar}
      onToggleSidebar={toggleSidebar}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showSidebar ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-zinc-300">Terminal</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === 'ready' && (
            <span className="text-xs text-green-400 font-medium">● Connected</span>
          )}
          {status === 'loading' && (
            <span className="text-xs text-zinc-500">Spawning shell...</span>
          )}
          {status === 'error' && (
            <span className="text-xs text-red-400">● Error</span>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="Close terminal"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {status === 'loading' && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingState message="Starting shell..." />
          </div>
        )}
        {status === 'error' && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Shield className="w-8 h-8 text-red-400" />}
              title="Shell Error"
              description={errorMsg || 'Unable to start shell'}
              action={
                <button
                  onClick={() => {
                    setStatus('loading')
                    setErrorMsg('')
                    // Retry: re-mount effect won't run, so we need a manual re-spawn
                    // For simplicity, just navigate away and back
                    nav('/')  // simplest: go home
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm"
                >
                  Go Back
                </button>
              }
            />
          </div>
        )}
        {status === 'ready' && (
          <div
            ref={containerRef}
            className="flex-1 min-h-0 px-2 py-2 bg-black rounded-lg overflow-hidden"
            style={{ minHeight: 0 }}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-800/60 text-xs text-zinc-500">
        <span>{userAgentLabel()}</span>
        {terminalId && (
          <span className="font-mono text-zinc-600">{terminalId.slice(0, 20)}</span>
        )}
      </div>
    </PageShell>
  )
}

function userAgentLabel(): string {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Macintosh')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  return 'Unknown'
}
