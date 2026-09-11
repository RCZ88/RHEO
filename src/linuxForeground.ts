import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
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

  // A window without a PID is not useful to the tracker. Keep the metadata
  // usable for unusual X11 clients, but do not invent a process identity.
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
  try {
    const { stdout: idOutput } = await execFileAsync('xdotool', ['getactivewindow'], { timeout: COMMAND_TIMEOUT_MS });
    const windowId = idOutput.trim();
    if (!windowId) return undefined;
    const [{ stdout: title }, { stdout: pidOutput }] = await Promise.all([
      execFileAsync('xdotool', ['getwindowname', windowId], { timeout: COMMAND_TIMEOUT_MS }),
      execFileAsync('xdotool', ['getwindowpid', windowId], { timeout: COMMAND_TIMEOUT_MS }),
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

/**
 * Linux fallback for active-win. xprop is the reliable X11 path; xdotool is
 * useful on installations where xprop is absent or its output is incomplete.
 * Wayland compositors intentionally expose no universal active-window API, so
 * returning undefined is safer than attributing time to the wrong app.
 */
export async function getLinuxForegroundWindow(): Promise<LinuxForegroundWindow | undefined> {
  if (process.platform !== 'linux') return undefined;
  return (await fromX11()) || (await fromXdotool());
}
