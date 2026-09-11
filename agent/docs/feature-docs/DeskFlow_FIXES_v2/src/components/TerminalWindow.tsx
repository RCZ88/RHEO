import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { getDefaultAgent } from '../lib/defaults';
import '@xterm/xterm/css/xterm.css';

declare global {
  interface Window {
    deskflowAPI?: {
      terminalWrite: (terminalId: string, data: string) => Promise<{ success: boolean }>;
      terminalWriteRaw: (terminalId: string, data: string) => Promise<{ success: boolean }>;
      terminalResize: (terminalId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
      terminalDestroy: (terminalId: string) => Promise<{ success: boolean }>;
      onTerminalData: (callback: (id: string, data: string) => void) => (() => void);
      onTerminalExit: (callback: (id: string, exitCode: number, signal: string) => void) => (() => void);
      onTerminalReady: (callback: (id: string) => void) => (() => void);
      onAgentReady: (callback: (data: { terminalId: string }) => void) => (() => void);
      onAgentTimeout: (callback: (data: { terminalId: string; agentType: string }) => void) => (() => void);
      retryAgentInit: (terminalId: string, agentType: string) => Promise<{ success: boolean }>;
      spawnTerminal: (terminalId: string, cwd?: string, agentType?: string, cols?: number, rows?: number) => Promise<boolean>;
      onAiTaskUpdated: (callback: (data: { terminalId: string; status: string; messageId?: string }) => void) => (() => void);
      onAiTaskFileChanged: (callback: (data: { tasks: any[] }) => void) => (() => void);
      getPromptStatus: (terminalId?: string) => Promise<{ success: boolean; data: any[] }>;
      aiTaskWatch: (projectPath: string) => Promise<{ success: boolean }>;
      aiTaskStopWatch: (projectPath: string) => Promise<{ success: boolean }>;
      aiTaskAdd: (task: { terminalId: string; prompt: string; agent: string; sessionId?: string; projectPath?: string }) => Promise<{ success: boolean; task?: any }>;
    };
  }
}

export interface PaneNode {
  type: 'leaf' | 'split';
  terminalId?: string;
  direction?: 'horizontal' | 'vertical';
  splitRatio?: number;
  children?: PaneNode[];
}

interface TerminalPaneProps {
  terminalId: string;
  isActive: boolean;
  onTerminalReady: (id: string) => void;
  onSplit: (id: string, direction: 'horizontal' | 'vertical') => void;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  agentStatus?: 'spawning' | 'waiting' | 'ready' | 'timeout';
  onRetryInit?: (terminalId: string) => void;
}

interface TerminalLayoutProps {
  layout: PaneNode | null;
  activeTerminalId: string | null;
  spawnTerminal: (id: string, cwd?: string, agentType?: string, cols?: number, rows?: number) => Promise<boolean>;
  onLayoutChange: (layout: PaneNode) => void;
  onActiveTerminalChange: (id: string) => void;
  onCloseTerminal: (id: string) => void;
  projectPath?: string;
  agentStatuses?: Record<string, 'spawning' | 'waiting' | 'ready' | 'timeout'>;
  onRetryInit?: (terminalId: string) => void;
}

const inputBuffers = new Map<string, string[]>();
const terminalReadyStates = new Map<string, boolean>();

export function replaceLeafTerminalId(node: PaneNode, targetId: string, newId: string): PaneNode {
  if (node.type === 'leaf') {
    return node.terminalId === targetId ? { ...node, terminalId: newId } : node;
  }
  return {
    ...node,
    children: node.children!.map(c => replaceLeafTerminalId(c, targetId, newId)),
  };
}

export function findLeafById(node: PaneNode | null, id: string | null): PaneNode | null {
  if (!node || !id) return null;
  if (node.type === 'leaf') {
    return node.terminalId === id ? node : null;
  }
  for (const child of node.children!) {
    const found = findLeafById(child, id);
    if (found) return found;
  }
  return null;
}

function findFirstLeaf(node: PaneNode): PaneNode | null {
  if (node.type === 'leaf') return node;
  for (const child of node.children!) {
    const found = findFirstLeaf(child);
    if (found) return found;
  }
  return null;
}

function TerminalPane({ terminalId, isActive, onTerminalReady, onSplit, onClose, onFocus, agentStatus, onRetryInit }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [exitWasCrash, setExitWasCrash] = useState(false);
  const isManualKillRef = useRef(false);
  const userScrolledUpRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      theme: {
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
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
      scrollback: 5000,
      cursorStyle: 'bar',
      windowsMode: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.onResize(({ cols, rows }) => {
      window.deskflowAPI?.terminalResize?.(terminalId, cols, rows);
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
        fitAddon.fit();
        if (terminal.rows <= 24 && containerRef.current.clientHeight > 200) {
          console.warn('[FIT-FIX] fit() returned <=24 rows — container may still be collapsed', containerRef.current.clientHeight);
        }
        window.deskflowAPI?.terminalResize?.(terminalId, terminal.cols, terminal.rows);
        ro.disconnect();
      }
    });
    ro.observe(containerRef.current);

    inputBuffers.set(terminalId, []);
    terminalReadyStates.set(terminalId, false);

    terminal.write('\x1b[33mStarting shell...\x1b[0m\r\n');

    console.log('[DEBUG:TW] TerminalPane mounted, calling onTerminalReady:', terminalId);
    onTerminalReady(terminalId);

    return () => {
      ro.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      inputBuffers.delete(terminalId);
      terminalReadyStates.delete(terminalId);
    };
  }, [terminalId, onTerminalReady]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const disposable = terminal.onData((data) => {
      const isReady = terminalReadyStates.get(terminalId);
      if (isReady) {
        window.deskflowAPI?.terminalWriteRaw?.(terminalId, data);
      } else {
        const buffer = inputBuffers.get(terminalId) || [];
        buffer.push(data);
        inputBuffers.set(terminalId, buffer);
      }
    });

    return () => disposable.dispose();
  }, [terminalId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const disposable = terminal.onScroll((newY: number) => {
      const buffer = terminal.buffer.active;
      userScrolledUpRef.current = newY < buffer.baseY;
    });
    return () => disposable.dispose();
  }, []);

  useEffect(() => {
    if (!window.deskflowAPI) return;

    const cleanupData = window.deskflowAPI.onTerminalData?.((id, data) => {
      if (id === terminalId && terminalRef.current) {
        terminalRef.current.write(data);
        // [INPUT-FIX] Receiving PTY output is definitive proof the shell is alive
        // and able to accept input. The one-shot 'ready' IPC event can be missed
        // (listener-registration race) or may never fire, which otherwise leaves
        // every keystroke buffered forever -> "green cursor, can't type" bug.
        // Unlock input and flush anything buffered the moment real output arrives.
        if (!terminalReadyStates.get(terminalId)) {
          terminalReadyStates.set(terminalId, true);
          const pending = inputBuffers.get(terminalId) || [];
          pending.forEach((bufferedData) => {
            window.deskflowAPI?.terminalWriteRaw?.(terminalId, bufferedData);
          });
          inputBuffers.set(terminalId, []);
        }
      }
    });

    const cleanupExit = window.deskflowAPI.onTerminalExit?.((id, exitCode, _signal, intentional) => {
      if (id === terminalId && terminalRef.current) {
        const crashed = exitCode !== 0 && !isManualKillRef.current && !intentional;
        terminalRef.current.write(`\r\n\x1b[${crashed ? '31' : '90'}mProcess exited with code ${exitCode}\x1b[0m\r\n`);
        terminalReadyStates.set(terminalId, false);
        setExitWasCrash(crashed);
        setIsDead(true);
        window.dispatchEvent(new CustomEvent('terminal:crashed', { detail: { terminalId: id, exitCode, crashed } }));
        isManualKillRef.current = false;
      }
    });

    const cleanupReady = window.deskflowAPI.onTerminalReady?.((id) => {
      if (id === terminalId) {
        setIsDead(false);
        setExitWasCrash(false);
        terminalReadyStates.set(terminalId, true);
        const buffer = inputBuffers.get(terminalId) || [];
        buffer.forEach((bufferedData) => {
          window.deskflowAPI?.terminalWriteRaw?.(terminalId, bufferedData);
        });
        inputBuffers.set(terminalId, []);
        setTimeout(() => {
          const fa = fitAddonRef.current;
          const t = terminalRef.current;
          if (fa && t) {
            fa.fit();
            window.deskflowAPI?.terminalResize?.(terminalId, t.cols, t.rows);
          }
        }, 250);
      }
    });

    // [INPUT-FIX] Last-resort safety net: if neither the 'ready' IPC event nor
    // any PTY output arrives within 2.5s (e.g. a silent shell), unlock input
    // anyway so the user can never be permanently locked out of typing.
    const inputUnlockFallback = setTimeout(() => {
      if (!terminalReadyStates.get(terminalId)) {
        terminalReadyStates.set(terminalId, true);
        const pending = inputBuffers.get(terminalId) || [];
        pending.forEach((bufferedData) => {
          window.deskflowAPI?.terminalWriteRaw?.(terminalId, bufferedData);
        });
        inputBuffers.set(terminalId, []);
      }
    }, 2500);

    return () => {
      clearTimeout(inputUnlockFallback);
      cleanupData?.();
      cleanupExit?.();
      cleanupReady?.();
    };
  }, [terminalId]);

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const terminal = terminalRef.current;
        if (terminal) {
          window.deskflowAPI?.terminalResize?.(terminalId, terminal.cols, terminal.rows);
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [terminalId]);

  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus();
      // [FIT-FIX] Defer the re-fit to after layout/paint. When a pane was display:none
      // and just became visible (tab/group switch), the container has no dimensions in
      // the same tick, so a synchronous fit() computes wrong rows/cols -> the terminal
      // overflows its box and the viewport can't scroll. Double-rAF waits for real layout.
      const doFit = () => {
        const fa = fitAddonRef.current;
        const t = terminalRef.current;
        const c = containerRef.current;
        if (!fa || !t || !c) return;
        if (c.clientWidth > 0 && c.clientHeight > 0) {
          try {
            fa.fit();
            window.deskflowAPI?.terminalResize?.(terminalId, t.cols, t.rows);
            console.log('[FIT-DBG] active re-fit', terminalId, 'cols', t.cols, 'rows', t.rows, 'containerH', c.clientHeight);

          } catch (e) { /* fit can throw if detached */ }
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(doFit));
    }
  }, [isActive, terminalId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-0 overflow-hidden"
      style={{ outline: isActive ? '2px solid rgb(34 197 94)' : 'none', outlineOffset: '-2px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onFocus(terminalId)}
      data-terminal-id={terminalId}
    >
      <style>{`.xterm-helper-textarea { position: absolute !important; top: -9999px !important; left: -9999px !important; opacity: 0 !important; width: 1px !important; height: 1px !important; overflow: hidden !important; z-index: -1 !important; }`}</style>
      {isHovered && (
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onSplit(terminalId, 'vertical'); }}
            className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-400"
            title="Split Vertical"
          >
            ⋮
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSplit(terminalId, 'horizontal'); }}
            className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-400"
            title="Split Horizontal"
          >
            ⋯
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); isManualKillRef.current = true; onClose(terminalId); }}
            className="p-1 bg-red-900/50 hover:bg-red-800 rounded text-xs text-red-400"
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Agent status indicator (non-blocking) */}
      {agentStatus === 'waiting' && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full px-2.5 py-1 z-10 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] text-cyan-400 font-medium">Initializing agent...</span>
        </div>
      )}
      {agentStatus === 'timeout' && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full px-2.5 py-1 z-10 cursor-pointer"
             onClick={() => onRetryInit?.(terminalId)}>
          <svg className="w-2.5 h-2.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] text-amber-400 font-medium">Agent failed. Click to retry.</span>
        </div>
      )}
      {isDead && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-sm rounded-full px-2.5 py-1 z-10 cursor-pointer"
             onClick={() => window.dispatchEvent(new CustomEvent('re-spawn-terminal', { detail: { terminalId } }))}>
          <svg className={`w-2.5 h-2.5 ${exitWasCrash ? 'text-red-400' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className={`text-[10px] font-medium ${exitWasCrash ? 'text-red-400' : 'text-zinc-400'}`}>{exitWasCrash ? 'Process crashed. Click to re-spawn.' : 'Process exited. Click to restart.'}</span>
        </div>
      )}
    </div>
  );
}

function SplitHandle({ direction, onDrag }: { direction: 'horizontal' | 'vertical'; onDrag: (delta: number) => void }) {
  const isDragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - lastPos.current;
      lastPos.current = currentPos;
      onDrag(delta);
    };
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, onDrag]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`flex-shrink-0 bg-zinc-800 hover:bg-green-600 transition-colors ${
        direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
      }`}
    />
  );
}

export function getLeafIds(node: PaneNode): string[] {
  if (node.type === 'leaf') return node.terminalId ? [node.terminalId] : [];
  if (!node.children || node.children.length === 0) return [];
  return node.children.flatMap(getLeafIds);
}

function PaneRenderer({
  node,
  activeTerminalId,
  onTerminalReady,
  onSplit,
  onClose,
  onFocus,
  onDragHandle,
  path,
  agentStatuses,
  onRetryInit,
}: {
  node: PaneNode;
  activeTerminalId: string | null;
  onTerminalReady: (id: string) => void;
  onSplit: (id: string, direction: 'horizontal' | 'vertical') => void;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onDragHandle: (path: number[], delta: number) => void;
  path: number[];
  agentStatuses?: Record<string, 'spawning' | 'waiting' | 'ready' | 'timeout'>;
  onRetryInit?: (terminalId: string) => void;
}) {
  if (node.type === 'leaf') {
    return (
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <TerminalPane
          terminalId={node.terminalId!}
          isActive={node.terminalId === activeTerminalId}
          onTerminalReady={onTerminalReady}
          onSplit={onSplit}
          onClose={onClose}
          onFocus={onFocus}
          agentStatus={agentStatuses?.[node.terminalId!]}
          onRetryInit={onRetryInit}
        />
      </div>
    );
  }

  const dir = node.direction || 'vertical';
  const flexDir = dir === 'horizontal' ? 'flex-row' : 'flex-col';
  const children = node.children || [];

  return (
    <div className={`flex ${flexDir} w-full h-full min-h-0`}>
      {children.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <SplitHandle direction={dir} onDrag={(delta) => onDragHandle(path, delta)} />}
          <div className="min-h-0 min-w-0 overflow-hidden flex flex-col" style={{ flex: 1 }}>
            <PaneRenderer
              node={child}
              activeTerminalId={activeTerminalId}
              onTerminalReady={onTerminalReady}
              onSplit={onSplit}
              onClose={onClose}
              onFocus={onFocus}
              onDragHandle={onDragHandle}
              path={[...path, i]}
              agentStatuses={agentStatuses}
              onRetryInit={onRetryInit}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// [PUSHDOWN-FIX] Measure the real on-screen size of a terminal pane so the PTY
// is spawned at the correct cols/rows from the very first byte. Spawning at a
// wrong 80x24 default and resizing afterwards is exactly what makes opencode's
// full-screen TUI redraw and "push down" in xterm.js. The old code read a
// `terminalRef` that does not exist in this scope, so it ALWAYS fell back to
// 80x24. Falls back to 80x24 only when the pane is not laid out yet.
function measureSpawnSize(terminalId: string): { cols: number; rows: number } {
  try {
    const el = document.querySelector(`[data-terminal-id="${terminalId}"]`) as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      // Prefer xterm's own measured cell box; fall back to the Consolas-14
      // metrics this app configures the terminal with.
      let cellW = 8.43;
      let cellH = 17;
      const measureEl = el.querySelector('.xterm-char-measure-element') as HTMLElement | null;
      if (measureEl) {
        const mw = measureEl.getBoundingClientRect().width;
        if (mw > 0) cellW = mw;
      }
      const rowEl = el.querySelector('.xterm-rows > div') as HTMLElement | null;
      if (rowEl) {
        const rh = rowEl.getBoundingClientRect().height;
        if (rh > 0) cellH = rh;
      }
      if (rect.width > 8 && rect.height > 8) {
        const cols = Math.max(40, Math.floor((rect.width - 8) / cellW));
        const rows = Math.max(10, Math.floor((rect.height - 8) / cellH));
        return { cols, rows };
      }
    }
  } catch { /* fall through to default */ }
  return { cols: 80, rows: 24 };
}

export function TerminalLayout({
  layout,
  activeTerminalId,
  spawnTerminal,
  onLayoutChange,
  onActiveTerminalChange,
  onCloseTerminal,
  projectPath,
  agentStatuses,
  onRetryInit,
}: TerminalLayoutProps) {
  const spawnedTerminalsRef = useRef(new Set<string>());

  useEffect(() => {
    const handleCleanup = (e: CustomEvent) => {
      const { terminalId } = e.detail as { terminalId: string };
      spawnedTerminalsRef.current.delete(terminalId);
    };
    const handleMarkSpawned = (e: CustomEvent) => {
      const { terminalId } = e.detail as { terminalId: string };
      if (terminalId) spawnedTerminalsRef.current.add(terminalId);
    };

    window.addEventListener('terminal-cleanup', handleCleanup as EventListener);
    window.addEventListener('terminal:mark-spawned', handleMarkSpawned as EventListener);
    return () => {
      window.removeEventListener('terminal-cleanup', handleCleanup as EventListener);
      window.removeEventListener('terminal:mark-spawned', handleMarkSpawned as EventListener);
    };
  }, []);

  const handleSplit = useCallback((terminalId: string, direction: 'horizontal' | 'vertical') => {
    if (!layout) return;
    const newTerminalId = `term-${Date.now()}`;
    spawnedTerminalsRef.current.add(newTerminalId);
    onLayoutChange(splitPane(layout, terminalId, newTerminalId, direction));
    
    const agentType = getDefaultAgent();
    spawnTerminal(newTerminalId, projectPath, agentType).then(() => {
      window.dispatchEvent(new CustomEvent('terminal-created', { detail: { terminalId: newTerminalId } }));
    });
  }, [layout, spawnTerminal, onLayoutChange, projectPath]);

  const handleClose = useCallback((terminalId: string) => {
    window.dispatchEvent(new CustomEvent('close-pane', { detail: { terminalId } }));
  }, []);

  const handleSplitDrag = useCallback((parentPath: number[], delta: number) => {
    if (!layout) return;
    onLayoutChange(adjustSplitRatio(layout, parentPath, delta));
  }, [layout, onLayoutChange]);

  const handleTerminalReady = useCallback(async (terminalId: string) => {
    console.log('[DEBUG:TW] handleTerminalReady called:', terminalId, 'spawnedTerminalsRef.has:', spawnedTerminalsRef.current.has(terminalId));
    if (spawnedTerminalsRef.current.has(terminalId)) {
      console.log('[DEBUG:TW] handleTerminalReady: already spawned, dispatching ready-custom');
      window.dispatchEvent(new CustomEvent('terminal:ready-custom', { detail: { id: terminalId } }));
      return;
    }
    spawnedTerminalsRef.current.add(terminalId);
    // D2-C: wait for layout + fitAddon.fit() to have real dimensions
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const { cols, rows } = measureSpawnSize(terminalId);
    const agentType = getDefaultAgent();
    console.log('[DEBUG:TW] handleTerminalReady: spawning terminal...', terminalId, agentType, 'cols', cols, 'rows', rows);
    const result = await spawnTerminal(terminalId, projectPath, agentType, cols, rows);
    console.log('[DEBUG:TW] handleTerminalReady: spawnTerminal result:', terminalId, JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('terminal:ready-custom', { detail: { id: terminalId } }));
    console.log('[DEBUG:TW] handleTerminalReady: done for', terminalId);
  }, [spawnTerminal, projectPath]);

  if (!layout || getLeafIds(layout).length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-[#0d0d0d]">
        <button
          onClick={() => {
            const newId = `term-${Date.now()}`;
            const agentType = getDefaultAgent();
            const { cols, rows } = measureSpawnSize(newId);
            spawnedTerminalsRef.current.add(newId);
            onLayoutChange({ type: 'leaf', terminalId: newId });
            spawnTerminal(newId, projectPath, agentType, cols, rows).then(() => {
              window.dispatchEvent(new CustomEvent('terminal-created', { detail: { terminalId: newId } }));
            });
          }}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
        >
          + Open Terminal
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 bg-[#0d0d0d] overflow-hidden flex flex-col">
      <PaneRenderer
        node={layout}
        activeTerminalId={activeTerminalId}
        onTerminalReady={handleTerminalReady}
        onSplit={handleSplit}
        onClose={handleClose}
        onFocus={onActiveTerminalChange}
        onDragHandle={handleSplitDrag}
        path={[]}
        agentStatuses={agentStatuses}
        onRetryInit={onRetryInit}
      />
    </div>
  );
}

export function removePane(layout: PaneNode, terminalId: string): PaneNode | null {
  if (layout.type === 'leaf') {
    return layout.terminalId === terminalId ? null : layout;
  }
  const newChildren = layout.children!.map(c => removePane(c, terminalId)).filter((c): c is PaneNode => c !== null);
  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...layout, children: newChildren };
}

export function splitPane(layout: PaneNode, targetId: string, newTerminalId: string, direction: 'horizontal' | 'vertical'): PaneNode {
  if (layout.type === 'leaf') {
    if (layout.terminalId === targetId) {
      return { type: 'split', direction, splitRatio: 0.5, children: [layout, { type: 'leaf', terminalId: newTerminalId }] };
    }
    return layout;
  }
  return { ...layout, children: layout.children!.map(c => splitPane(c, targetId, newTerminalId, direction)) };
}

export function findGroupIndex(layouts: PaneNode[], terminalId: string): number {
  for (let i = 0; i < layouts.length; i++) {
    if (findLeafById(layouts[i], terminalId)) return i;
  }
  return -1;
}

export function removeFromLayouts(layouts: PaneNode[], terminalId: string): PaneNode[] {
  return layouts
    .map(l => {
      if (l.type === 'leaf') {
        return l.terminalId === terminalId ? null : l;
      }
      const updated = removePane(l, terminalId);
      if (!updated) return null;
      const leaves = getLeafIds(updated);
      return leaves.length > 0 ? updated : null;
    })
    .filter((l): l is PaneNode => l !== null);
}

export function insertIntoLayout(layout: PaneNode | null, newTerminalId: string): PaneNode {
  if (!layout) {
    return { type: 'leaf', terminalId: newTerminalId };
  }
  if (layout.type === 'split') {
    return {
      ...layout,
      children: [...layout.children!, { type: 'leaf', terminalId: newTerminalId }]
    };
  }
  return {
    type: 'split',
    direction: 'vertical',
    splitRatio: 0.5,
    children: [layout, { type: 'leaf', terminalId: newTerminalId }]
  };
}

export function getGroupTrees(layout: PaneNode | null): PaneNode[] {
  if (!layout) return [];
  if (layout.type === 'leaf') return [layout];
  return layout.children!;
}

export function updateGroupTree(layout: PaneNode, groupIndex: number, newGroupTree: PaneNode): PaneNode {
  if (layout.type === 'leaf' && groupIndex === 0) return newGroupTree;
  if (layout.type === 'split' && layout.children) {
    const children = [...layout.children];
    if (groupIndex < children.length) {
      children[groupIndex] = newGroupTree;
    }
    return { ...layout, children };
  }
  return layout;
}

export function toggleSplitDirection(node: PaneNode, path: number[]): PaneNode {
  if (path.length === 0) {
    if (node.type === 'split') {
      return { ...node, direction: node.direction === 'horizontal' ? 'vertical' : 'horizontal' };
    }
    return node;
  }
  if (node.type === 'split' && node.children) {
    const idx = path[0];
    return {
      ...node,
      children: node.children.map((c, i) => i === idx ? toggleSplitDirection(c, path.slice(1)) : c),
    };
  }
  return node;
}

function adjustSplitRatio(layout: PaneNode, path: number[], delta: number): PaneNode {
  if (layout.type !== 'split') return layout;
  if (path.length === 0) {
    const currentRatio = layout.splitRatio || 0.5;
    const adjustment = delta * 0.001;
    return { ...layout, splitRatio: Math.max(0.1, Math.min(0.9, currentRatio + adjustment)) };
  }
  const idx = path[0];
  return {
    ...layout,
    children: layout.children!.map((c, i) => i === idx ? adjustSplitRatio(c, path.slice(1), delta) : c),
  };
}

export default TerminalLayout;
