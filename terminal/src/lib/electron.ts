export function isElectron(): boolean {
  try {
    const w = window as unknown as Record<string, unknown>;
    if (w.electronAPI || w.require) return true;
    const proc = w.process as { versions?: Record<string, string> } | undefined;
    if (proc?.versions?.electron) return true;
    if (navigator.userAgent.toLowerCase().includes("electron")) return true;
  } catch { /* noop */ }
  return false;
}

export const SHELLS = [
  { id: "zsh", name: "Zsh", version: "zsh 5.9", prompt: "%n@%m %~ %#" },
  { id: "bash", name: "Bash", version: "GNU bash 5.2.21", prompt: "\\u@\\h:\\w\\$" },
  { id: "fish", name: "Fish", version: "fish 3.7.1", prompt: "user@host ~>" },
];

export const DISTROS = ["Ubuntu 24.04 LTS", "Fedora 41", "Arch Linux", "Debian 12", "Pop!_OS 22.04", "Linux Mint 21.3"];

export const MAIN_SNIPPET = `// main.js — real pty binding (Electron)
const { app, BrowserWindow } = require('electron');
const pty = require('node-pty');
const { ipcMain } = require('electron');

function createTerminal(cwd, shell = '/bin/zsh') {
  const ptyProc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120, rows: 32,
    cwd: cwd || process.env.HOME,
    env: { ...process.env, TERM: 'xterm-256color' },
  });
  ptyProc.onData((data) => win.webContents.send('pty:data', data));
  ipcMain.on('pty:write', (_e, chunk) => ptyProc.write(chunk));
  ipcMain.on('pty:resize', (_e, { cols, rows }) => ptyProc.resize(cols, rows));
  return ptyProc;
}`;

export const PRELOAD_SNIPPET = `// preload.js — safe renderer bridge
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  ptyWrite: (chunk) => ipcRenderer.send('pty:write', chunk),
  ptyResize: (cols, rows) => ipcRenderer.send('pty:resize', { cols, rows }),
  onPtyData: (cb) => ipcRenderer.on('pty:data', (_e, d) => cb(d)),
  platform: process.platform, // 'linux'
});`;

export const LINUX_TIPS = [
  "node-pty spawns the user's real login shell — cwd, env and dotfiles come along for free.",
  "One pty process per pane. Kill the pane → kill the child (SIGHUP) to avoid zombies.",
  "Forward xterm resize events from the renderer so ncurses apps (htop, lazygit) draw correctly.",
  "Respect $SHELL and /etc/passwd; fall back to /bin/bash when the preferred shell is missing.",
  "Gate destructive tools behind an allow-list before exposing them to MCP agents.",
];
