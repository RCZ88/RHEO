import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 750;

export interface LinuxForegroundWindow {
  platform: 'linux';
  title: string | null;
  owner: {
    name: string;
    path?: string;
    processId?: number;
  };
}

function propValue(output: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = output.split(/\r?\n/).find((entry) => new RegExp(`^${escapedKey}\\s*=`).test(entry));
  return line?.match(/^.*?=\s*(.*)$/)?.[1]?.trim() || null;
}

function unquote(value: string | null): string | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^"|"$/g, '').trim() || null;
  }
}

function parsePid(value: string | null): number | undefined {
  const pid = Number.parseInt(value || '', 10);
  return Number.isFinite(pid) && pid > 0 ? pid : undefined;
}

export function parseLinuxWindowMetadata(
  windowId: string,
  xpropOutput: string,
): LinuxForegroundWindow | null {
  const pid = parsePid(propValue(xpropOutput, '_NET_WM_PID(CARDINAL)'));
  const rawClass = propValue(xpropOutput, 'WM_CLASS(STRING)');
  const classes = rawClass?.split(',').map((value) => unquote(value)?.trim()).filter(Boolean) || [];
  const className = classes.at(-1) || classes[0] || 'Unknown';
  const title = unquote(
    propValue(xpropOutput, '_NET_WM_NAME(UTF8_STRING)') || propValue(xpropOutput, 'WM_NAME(STRING)'),
  );

  if (!windowId || (!pid && !title && className === 'Unknown')) return null;
  return {
    platform: 'linux',
    title,
    owner: { name: className, processId: pid },
  };
}

async function executablePath(pid?: number): Promise<string | undefined> {
  if (!pid) return undefined;
  try {
    return await fs.readlink(`/proc/${pid}/exe`);
  } catch {
    return undefined;
  }
}

async function fromX11(): Promise<LinuxForegroundWindow | undefined> {
  const env = { ...process.env, LC_ALL: 'C' };
  try {
    const { stdout: activeOutput } = await execFileAsync(
      'xprop', ['-root', '\t$0', '_NET_ACTIVE_WINDOW'], { env, timeout: COMMAND_TIMEOUT_MS },
    );
    const windowId = activeOutput.match(/0x[0-9a-f]+/i)?.[0];
    if (!windowId || /^0x0+$/i.test(windowId)) return undefined;
    const { stdout } = await execFileAsync(
      'xprop', ['-id', windowId], { env, timeout: COMMAND_TIMEOUT_MS },
    );
    const metadata = parseLinuxWindowMetadata(windowId, stdout);
    if (!metadata) return undefined;
    metadata.owner.path = await executablePath(metadata.owner.processId);
    if (metadata.owner.path) {
      metadata.owner.name = path.basename(metadata.owner.path);
    }
    return metadata;
  } catch {
    return undefined;
  }
}

async function fromXdotool(): Promise<LinuxForegroundWindow | undefined> {
  // On pure Wayland, xdotool may work via XWayland but can be slow.
  // Use a shorter timeout to avoid blocking the poll cycle.
  const timeout = (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY) ? 300 : COMMAND_TIMEOUT_MS;
  try {
    const { stdout: idOutput } = await execFileAsync('xdotool', ['getactivewindow'], { timeout });
    const windowId = idOutput.trim();
    if (!windowId) return undefined;
    const [{ stdout: title }, { stdout: pidOutput }] = await Promise.all([
      execFileAsync('xdotool', ['getwindowname', windowId], { timeout }),
      execFileAsync('xdotool', ['getwindowpid', windowId], { timeout }),
    ]);
    const processId = parsePid(pidOutput.trim());
    const executable = await executablePath(processId);
    return {
      platform: 'linux',
      title: title.trim() || null,
      owner: {
        name: executable ? path.basename(executable) : 'Unknown',
        path: executable,
        processId,
      },
    };
  } catch {
    return undefined;
  }
}

// Use qdbus (available on KDE) instead of Python gi/PyGObject which is often missing
async function fromKWin(): Promise<LinuxForegroundWindow | undefined> {
  if (process.platform !== 'linux') return undefined;
  try {
    const scriptFile = path.join(os.tmpdir(), `rheo-kwin-${Date.now()}.js`);
    const resultFile = path.join(os.tmpdir(), `rheo-kwin-out-${Date.now()}.json`);
    const script = [
      `var w = workspace.activeWindow;`,
      `var value = (w && !w.desktopWindow && !w.dock) ? { name: String(w.resourceClass || w.desktopFileName || ''), pid: Number(w.pid), title: String(w.caption || '') } : null;`,
      `var f = new File("${resultFile}"); f.open(File.WriteOnly); f.write(JSON.stringify(value)); f.close();`,
    ].join('\n');
    await fs.writeFile(scriptFile, script);
    // Wrap qdbus calls in a race with a shorter total timeout to prevent
    // the entire poll cycle from stalling on a hanging D-Bus connection.
    const kwinResult = await Promise.race([
      (async () => {
        const stdout = await execFileAsync('qdbus', ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.loadScript', scriptFile, 'rheo-foreground-' + Date.now()], { timeout: COMMAND_TIMEOUT_MS });
        const scriptId = parseInt(stdout.stdout.trim());
        if (scriptId < 0) return undefined;
        try { await execFileAsync('qdbus', ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.start'], { timeout: COMMAND_TIMEOUT_MS }); } catch {}
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          const data = await fs.readFile(resultFile, 'utf8');
          const obj = JSON.parse(data);
          await fs.rm(scriptFile, { force: true }).catch(() => {});
          await fs.rm(resultFile, { force: true }).catch(() => {});
          if (obj && obj.name) {
            return { platform: 'linux', title: obj.title || null, owner: { name: obj.name, processId: obj.pid || 0 } };
          }
        } catch {}
        await fs.rm(scriptFile, { force: true }).catch(() => {});
        await fs.rm(resultFile, { force: true }).catch(() => {});
        return undefined;
      })(),
      new Promise<undefined>((_, reject) => setTimeout(() => reject(new Error('kwin timeout')), 2000)),
    ]);
    return kwinResult;
  } catch {
    try { await fs.rm(scriptFile, { force: true }).catch(() => {}); await fs.rm(resultFile, { force: true }).catch(() => {}); } catch {}
    return undefined;
  }
}

// GNOME Shell detection — placeholder; not needed on KDE
async function fromGnomeShell(): Promise<LinuxForegroundWindow | undefined> {
  return undefined;
}

// Use wmctrl to get the active window (works on X11 and some Wayland setups)
async function fromWmctrl(): Promise<LinuxForegroundWindow | undefined> {
  try {
    const { stdout: activeOutput } = await execFileAsync(
      'wmctrl', ['-G', '-l'], { timeout: COMMAND_TIMEOUT_MS },
    );
    const lines = activeOutput.trim().split('\n');
    // Find the line with '*' (active window) — wmctrl marks active with '*'
    const activeLine = lines.find(line => line.trim().startsWith('*'));
    if (!activeLine) return undefined;

    // Parse: desktop, window_id, owner, x, y, width, height, title
    // Remove leading '*' and split by whitespace
    const cleanLine = activeLine.trim().replace(/^\*/, '').trim();
    const parts = cleanLine.split(/\s+/);
    if (parts.length < 8) return undefined;

    const windowId = parts[1];
    const title = parts.slice(7).join(' ');

    if (!windowId || /^0x0+$/i.test(windowId)) return undefined;

    return {
      platform: 'linux',
      title: title || null,
      owner: { name: parts[2] || 'Unknown' },
    };
  } catch {
    return undefined;
  }
}

export async function getLinuxForegroundWindow(): Promise<LinuxForegroundWindow | undefined> {
  if (process.platform !== 'linux') return undefined;
  if (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY) {
    // KDE Wayland: use KWin first, then wmctrl via XWayland
    if (/kde/i.test(process.env.XDG_CURRENT_DESKTOP || '')) {
      const kwinResult = await fromKWin();
      if (kwinResult && kwinResult.title) return kwinResult;
    }
    // GNOME Wayland: try gdbus
    if (/gnome/i.test(process.env.XDG_CURRENT_DESKTOP || '')) {
      const gnomeResult = await fromGnomeShell();
      if (gnomeResult && gnomeResult.title) return gnomeResult;
    }
    // Fall back to wmctrl (works via XWayland on most compositors)
    const wmctrlResult = await fromWmctrl();
    if (wmctrlResult && wmctrlResult.title) return wmctrlResult;
    // Last resort: xdotool via XWayland
    const xdotoolResult = await fromXdotool();
    if (xdotoolResult && xdotoolResult.title) return xdotoolResult;
    // Absolute last resort: xprop
    return fromX11();
  }
  // X11 session: try wmctrl, then xdotool, then xprop
  const wmctrlResult = await fromWmctrl();
  if (wmctrlResult && wmctrlResult.title) return wmctrlResult;
  return (await fromXdotool()) || (await fromX11());
}
