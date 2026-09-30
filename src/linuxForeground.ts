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
    // In broken XWayland environments _NET_ACTIVE_WINDOW returns an invalid
    // window ID (e.g. 0x600003 not in _NET_CLIENT_LIST). Use _NET_CLIENT_LIST_STACKING
    // — the last window is the foreground/active one.
    const { stdout: stackingOutput } = await execFileAsync(
      'xprop', ['-root', '_NET_CLIENT_LIST_STACKING'], { env, timeout: COMMAND_TIMEOUT_MS },
    );
    const ids = (stackingOutput.match(/0x[0-9a-f]+/gi) || []);
    if (ids.length === 0) return undefined;
    const windowId = ids[ids.length - 1]; // last = topmost/active
    if (!windowId || /^0x0+$/i.test(windowId)) return undefined;
    const { stdout } = await execFileAsync(
      'xprop', ['-id', windowId], { env, timeout: COMMAND_TIMEOUT_MS },
    );
    if (!stdout.trim()) return undefined;
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
    // On broken XWayland environments, xdotool getactivewindow returns
    // an invalid window ID (e.g. 0x400003) not in _NET_CLIENT_LIST. So:
    //   1. TRY `getactivewindow` (the correct answer when it works).
    //   2. VALIDATE it — only accept a non-zero id.
    //   3. Otherwise fall back to `search --onlyvisible` + _NET_WM_STATE_FOCUSED.
    //
    // Previously the code went straight to the search loop, which returns windows
    // in TREE order, not stacking order — so it regularly picked the wrong window
    // (often RHEO's own window, which is a real XWayland window).
    const timeout = (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY) ? 300 : COMMAND_TIMEOUT_MS;
    try {
      const { stdout: activeOut } = await execFileAsync(
        'xdotool', ['getactivewindow'], { timeout },
      );
      const activeId = activeOut.trim();
      if (activeId && !/^0x0+$/i.test(activeId)) {
        const title = await getXdotoolWindowName(activeId, timeout);
        const pid = await getXdotoolWindowPid(activeId, timeout);
        const executable = pid ? await executablePath(pid) : undefined;
        if (title || executable) {
          return {
            platform: 'linux',
            title: title || null,
            owner: {
              name: executable ? path.basename(executable) : 'Unknown',
              path: executable,
              processId: pid,
            },
          };
        }
      }
    } catch { /* fall through to the search scan */ }

    try {
      const { stdout: searchOutput } = await execFileAsync(
        'xdotool', ['search', '--onlyvisible', '--class', '.*'], { timeout },
      );
      const windowIds = searchOutput.trim().split('\n').filter(id => id.trim());
      if (windowIds.length === 0) return undefined;

      // Check each window for _NET_WM_STATE_FOCUSED using xprop
      for (const winId of windowIds) {
        try {
          const { stdout: xpropOutput } = await execFileAsync(
            'xprop', ['-id', winId.trim()], { timeout },
          );
          if (xpropOutput.includes('_NET_WM_STATE_FOCUSED')) {
            const title = await getXdotoolWindowName(winId.trim(), timeout);
            const pid = await getXdotoolWindowPid(winId.trim(), timeout);
            const executable = pid ? await executablePath(pid) : undefined;
            return {
              platform: 'linux',
              title: title || null,
              owner: {
                name: executable ? path.basename(executable) : 'Unknown',
                path: executable,
                processId: pid,
              },
            };
          }
        } catch { continue; }
      }
      return undefined;
    } catch {
      return undefined;
    }
}

async function getXdotoolWindowName(winId: string, timeout: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync('xdotool', ['getwindowname', winId], { timeout });
    return stdout.trim();
  } catch { return ''; }
}

async function getXdotoolWindowPid(winId: string, timeout: number): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('xdotool', ['getwindowpid', winId], { timeout });
    return parsePid(stdout.trim());
  } catch { return undefined; }
}

// ── Native-Wayland compositor strategies ─────────────────────────────────────
// KWin scripting CANNOT be used to read the active window on modern Plasma:
//   * QJSEngine exposes no `File` class  -> cannot write a result file
//   * `org.kde.kwin.Scripting.runScript` does not exist -> no return channel
//   * `print()` does not reach the journal
// (all three verified empirically). `org.kde.KWin.getWindowInfo()` needs a KWin
// window UUID, which the X11 ids from xdotool/wmctrl do not map to.
//
// So the correct approach on Wayland is to use the compositor's OWN query tool.
// Each strategy below is OPTIONAL and auto-detected: a machine that has none of
// them simply skips that step. Nothing is hardcoded to a specific distro or DE —
// the chain adapts to whatever the device actually provides.
//
//   kdotool  -> KDE Plasma (Wayland + X11)
//   hyprctl  -> Hyprland
//   swaymsg  -> Sway
//   wlrctl   -> wlroots-based compositors (Sway/Hyprland/Wayfire)
//   gdbus    -> GNOME Shell (requires Evaluations enabled in Looking Glass)

const STRATEGY_TIMEOUT_MS = 1200;

async function toolAvailable(bin: string): Promise<boolean> {
  try {
    await execFileAsync('which', [bin], { timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

const toolCache = new Map<string, boolean>();
async function hasTool(bin: string): Promise<boolean> {
  if (toolCache.has(bin)) return toolCache.get(bin)!;
  const v = await toolAvailable(bin);
  toolCache.set(bin, v);
  return v;
}

function windowFrom(
  name: string,
  title: string | null,
  pid?: number,
): LinuxForegroundWindow | undefined {
  const cleanName = (name || '').trim();
  const cleanTitle = (title || '').trim();
  if (!cleanName && !cleanTitle) return undefined;
  return {
    platform: 'linux',
    title: cleanTitle || null,
    owner: { name: cleanName || 'Unknown', processId: pid || 0 },
  };
}

/** Prefer a real executable name (from /proc/<pid>/exe) over a WM_CLASS. */
async function refineName(name: string, pid?: number): Promise<string> {
  if (pid) {
    const exe = await executablePath(pid);
    if (exe) {
      const base = path.basename(exe);
      // Electron/CEF apps all report a bare `electron`/`chrome` binary; keep the
      // friendlier class name in that case and let the caller map it.
      if (!/^(electron|chrome|chromium|cef_host|mono)$/i.test(base)) return base;
    }
  }
  return name;
}

// ── KDE Plasma: kdotool ───────────────────────────────────────────────────────
async function fromKdotool(): Promise<LinuxForegroundWindow | undefined> {
  if (!(await hasTool('kdotool'))) return undefined;
  try {
    // kdotool supports chained subcommands, e.g.
    //   kdotool getactivewindow getwindowclassname
    // Try the richest form first, then fall back to individual queries.
    const cls = await execFileAsync(
      'kdotool', ['getactivewindow', 'getwindowclassname'], { timeout: STRATEGY_TIMEOUT_MS },
    ).catch(() => null);
    const name = cls ? String(cls.stdout).trim().split('\n').pop()?.trim() || '' : '';

    const titleRes = await execFileAsync(
      'kdotool', ['getactivewindow', 'getwindowname'], { timeout: STRATEGY_TIMEOUT_MS },
    ).catch(() => null);
    const title = titleRes ? String(titleRes.stdout).trim() : '';

    if (!name && !title) return undefined;

    let pid: number | undefined;
    const pidRes = await execFileAsync(
      'kdotool', ['getactivewindow', 'getwindowpid'], { timeout: STRATEGY_TIMEOUT_MS },
    ).catch(() => null);
    if (pidRes) pid = parsePid(String(pidRes.stdout).trim());

    const refined = await refineName(name, pid);
    return windowFrom(refined, title, pid);
  } catch {
    return undefined;
  }
}

// ── Hyprland: hyprctl ────────────────────────────────────────────────────────
async function fromHyprctl(): Promise<LinuxForegroundWindow | undefined> {
  if (!(await hasTool('hyprctl'))) return undefined;
  try {
    const { stdout } = await execFileAsync(
      'hyprctl', ['activewindow', '-j'], { timeout: STRATEGY_TIMEOUT_MS },
    );
    const data = JSON.parse(String(stdout));
    if (!data || (!data.class && !data.title)) return undefined;
    const pid = parsePid(String(data.pid || ''));
    const refined = await refineName(String(data.class || ''), pid);
    return windowFrom(refined, String(data.title || ''), pid);
  } catch {
    return undefined;
  }
}

// ── Sway: swaymsg ─────────────────────────────────────────────────────────────
async function fromSwaymsg(): Promise<LinuxForegroundWindow | undefined> {
  if (!(await hasTool('swaymsg'))) return undefined;
  try {
    const { stdout } = await execFileAsync(
      'swaymsg', ['-t', 'get_tree', '-r'], { timeout: STRATEGY_TIMEOUT_MS },
    );
    const tree = JSON.parse(String(stdout));
    const node = tree?.nodes?.find((n: any) => n?.focused);
    if (!node) return undefined;
    const appName = String(node?.app?.name || '');
    const className = String(node?.window_properties?.class || '');
    const pid = parsePid(String(node?.pid || ''));
    const refined = await refineName(appName || className, pid);
    return windowFrom(refined, String(node?.name || ''), pid);
  } catch {
    return undefined;
  }
}

// ── wlroots compositors: wlrctl ──────────────────────────────────────────────
async function fromWlrctl(): Promise<LinuxForegroundWindow | undefined> {
  if (!(await hasTool('wlrctl'))) return undefined;
  try {
    const { stdout } = await execFileAsync('wlrctl', ['activewindow', 'title'], { timeout: STRATEGY_TIMEOUT_MS });
    const title = String(stdout).trim();
    const clsRes = await execFileAsync('wlrctl', ['activewindow', 'class'], { timeout: STRATEGY_TIMEOUT_MS }).catch(() => null);
    const name = clsRes ? String(clsRes.stdout).trim() : '';
    return windowFrom(name, title);
  } catch {
    return undefined;
  }
}
// GNOME Shell detection via the `org.gnome.Shell.Eval` D-Bus method.
// This requires "Evaluation of JavaScript in GNOME Shell" to be enabled in
// Looking Glass (Alt+F2 -> `lg` -> `Settings` -> Evaluations = true), so it is
// best-effort: if the method is not exposed, gdbus errors and we return
// undefined, letting the XWayland strategies run instead.
async function fromGnomeShell(): Promise<LinuxForegroundWindow | undefined> {
    if (process.platform !== 'linux') return undefined;
    const resultFile = path.join(os.tmpdir(), `rheo-gnome-out-${Date.now()}.json`);
    const script = [
      `const w = global.get_window_actor(global.display.focus_window);`,
      `const win = w ? w.meta_window : null;`,
      `const v = (win && !win.is_skip_taskbar()) ? {`,
      `  name: String(win.get_wm_class() || win.get_class() || ''),`,
      `  pid: Number(win.get_pid() || 0),`,
      `  title: String(win.get_title() || ''),`,
      `} : null;`,
      `const f = new Gio.File({ uri: 'file://${resultFile}' });`,
      `f.replace_contents(JSON.stringify(v), null, false, Gio.FileCreateFlags.NONE, null);`,
      `v ? v.title : '';`,
    ].join('\n');
    try {
      const { stdout } = await execFileAsync(
        'gdbus',
        [
          'call', '--session',
          '--dest', 'org.gnome.Shell',
          '--object-path', '/org/gnome/Shell',
          '--method', 'org.gnome.Shell.Eval',
          script,
        ],
        { timeout: COMMAND_TIMEOUT_MS },
      );
      await fs.rm(resultFile, { force: true }).catch(() => {});
      // stdout looks like: ('', <js-return-value>, []) or an error tuple.
      const titleMatch = stdout.match(/'((?:[^'\\]|\\.)*)'/);
      if (!titleMatch) return undefined;
      const title = titleMatch[1].replace(/\\'/g, "'");
      if (!title) return undefined;
      let name = '';
      let pid = 0;
      const nameMatch = stdout.match(/name['"]?[:=]\s*'([^']*)'/i);
      if (nameMatch) name = nameMatch[1];
      const pidMatch = stdout.match(/pid['"]?[:=]\s*(\d+)/i);
      if (pidMatch) pid = Number(pidMatch[1]);
      if (!name) {
        const exe = pid ? await executablePath(pid) : undefined;
        name = exe ? path.basename(exe) : 'Unknown';
      }
      return { platform: 'linux', title, owner: { name, processId: pid } };
    } catch {
      await fs.rm(resultFile, { force: true }).catch(() => {});
      return undefined;
    }
}

// Use wmctrl to get the active window (works on X11 and some Wayland setups)
// In broken XWayland environments, wmctrl -G -l has no '*' active marker and
// _NET_ACTIVE_WINDOW returns an invalid window ID. We use wmctrl -l -p which
// reliably shows all windows with their PIDs, and pick the last non-virtual one.
async function fromWmctrl(): Promise<LinuxForegroundWindow | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'wmctrl', ['-l', '-p'], { timeout: COMMAND_TIMEOUT_MS },
    );
    const lines = stdout.trim().split('\n');
    if (lines.length === 0) return undefined;

    // Find the last non-virtual window (not "Wayland to X Recording bridge",
    // "xwaylandvideobridge", etc.) — that's the active app window.
    const virtualPatterns = ['wayland to x', 'xwayland', 'recording bridge'];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 3) continue;
      const windowId = parts[0];
      const pid = parsePid(parts[2]);
      if (!windowId || /^0x0+$/i.test(windowId)) continue;
      if (!pid) continue;
      // Skip virtual/xwayland bridge windows
      try {
        const exePath = await executablePath(pid);
        if (!exePath) continue;
        const exeName = path.basename(exePath).toLowerCase();
        if (virtualPatterns.some(p => exeName.includes(p))) continue;
        const title = parts.slice(3).join(' ');
        return {
          platform: 'linux',
          title: title || null,
          owner: { name: path.basename(exePath), path: exePath, processId: pid },
        };
      } catch { continue; }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * BUMP ON EVERY DETECTION CHANGE. Printed in the tracking diagnostic so a
 * stale running process is immediately obvious instead of silently producing
 * confusing traces (which cost several cycles of guessing).
 */
export const LINUX_DETECT_BUILD = 'native-chain-v3-20260930';

/** Which strategy produced the last successful result (for diagnostics). */
export let lastStrategyUsed: string | null = null;
/** Ordered log of every strategy attempted on the last call (for diagnostics). */
export let lastStrategyTrace: string[] = [];

/**
 * Probe which helper binaries are actually installed, and describe the
 * session. If the compositor-native tools are missing, native Wayland
 * windows are simply NOT OBSERVABLE and no amount of code can fix that —
 * the user must install them. This makes that situation diagnosable instead
 * of a silent black hole.
 */
export async function probeLinuxTrackingEnvironment(): Promise<{
  platform: string;
  sessionType: string | null;
  currentDesktop: string | null;
  waylandDisplay: string | null;
  tools: Record<string, boolean>;
  note: string;
}> {
  const tools: Record<string, boolean> = {};
  for (const bin of ['qdbus6', 'qdbus', 'qdbus-qt6', 'qdbus-qt5', 'gdbus', 'kdotool', 'hyprctl', 'swaymsg', 'wlrctl', 'xdotool', 'wmctrl', 'xprop']) {
    try {
      await execFileAsync('which', [bin], { timeout: 1500 });
      tools[bin] = true;
    } catch {
      try {
        await execFileAsync(bin, ['--version'], { timeout: 1500 });
        tools[bin] = true;
      } catch {
        tools[bin] = false;
      }
    }
  }
  const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;
  // A compositor-native tool is what can see NATIVE Wayland windows.
  // qdbus is deliberately NOT counted: KWin scripting provably cannot return
  // data (no File class, no runScript, print() unreachable).
  const nativeTool =
    (tools['kdotool'] && 'kdotool (KDE)') ||
    (tools['hyprctl'] && 'hyprctl (Hyprland)') ||
    (tools['wlrctl'] && 'wlrctl (wlroots)') ||
    (tools['swaymsg'] && 'swaymsg (Sway)') ||
    (tools['gdbus'] && 'gdbus (GNOME Shell — needs Evaluations enabled)') ||
    '';
  const xwaylandOk = tools['xdotool'] || tools['wmctrl'] || tools['xprop'];
  let note = 'X11 session: xprop/xdotool/wmctrl can see every window.';
  if (isWayland) {
    if (nativeTool) {
      note = `Wayland: native tracking available via ${nativeTool}.`;
    } else if (xwaylandOk) {
      note = 'Wayland with NO compositor-native tool — ONLY XWayland apps (RHEO, Spotify, ...) can be tracked. Install kdotool (KDE), hyprctl (Hyprland), swaymsg/wlrctl (wlroots) or enable GNOME Looking Glass Evaluations.';
    } else {
      note = 'Wayland with NO tracking tools at all. Install kdotool / hyprctl / swaymsg, or xdotool + wmctrl + xorg.xprop for XWayland apps.';
    }
  }
  return {
    platform: `${process.platform} ${process.arch}`,
    sessionType: process.env.XDG_SESSION_TYPE || null,
    currentDesktop: process.env.XDG_CURRENT_DESKTOP || null,
    waylandDisplay: process.env.WAYLAND_DISPLAY || null,
    tools,
    note,
  };
}

export async function getLinuxForegroundWindow(): Promise<LinuxForegroundWindow | undefined> {
  lastStrategyUsed = null;
  lastStrategyTrace = [];
  if (process.platform !== 'linux') return undefined;

  // A strategy that returns a window is the answer. Otherwise the next one runs.
  const tryStrategy = async (name: string, fn: () => Promise<LinuxForegroundWindow | undefined>) => {
    const win = await fn();
    if (win && win.title) {
      lastStrategyUsed = name;
      lastStrategyTrace.push(`${name}=OK(${win.owner?.name})`);
      return win;
    }
    // On Wayland, an XWayland strategy "succeeding" is worse than failing: it
    // reports the last X11-focused window (often RHEO's own), which is stale
    // and never changes. Make that explicitly visible in the trace.
    const viaXwayland = name === 'xdotool' || name === 'wmctrl' || name === 'xprop';
    lastStrategyTrace.push(
      viaXwayland
        ? `${name}=STALE?(xwayland-cannot-see-native-wayland)`
        : `${name}=miss`,
    );
    return undefined;
  };

  // Compositor-native strategies: the ONLY ones that can see native Wayland
  // windows. Every one is optional and auto-detected, so this adapts to whatever
  // the device provides instead of assuming a specific distro/DE:
  //   kdotool (KDE) -> hyprctl (Hyprland) -> wlrctl (wlroots) -> swaymsg (Sway)
  //   -> gdbus/GNOME Shell
  // Order is by reliability for the most common compositors; each is skipped
  // automatically when its tool is absent.
  const NATIVE_STRATEGIES: Array<[string, () => Promise<LinuxForegroundWindow | undefined>]> = [
    ['kdotool', fromKdotool],
    ['hyprctl', fromHyprctl],
    ['wlrctl', fromWlrctl],
    ['swaymsg', fromSwaymsg],
    ['gnome-shell', fromGnomeShell],
  ];
  for (const [name, fn] of NATIVE_STRATEGIES) {
    if (!(await hasTool(name === 'gnome-shell' ? 'gdbus' : name))) {
      lastStrategyTrace.push(`${name}=absent(tool-not-installed)`);
      continue;
    }
    const r = await tryStrategy(name, fn);
    if (r) return r;
  }

  // XWayland strategies: xdotool checks real focus, wmctrl uses stacking,
  // xprop is the last resort. On Wayland these can only ever see XWayland apps
  // (RHEO, Spotify, ...), so they are a degraded fallback, not a real answer.
  const x = await tryStrategy('xdotool', fromXdotool);
  if (x) return x;
  const w = await tryStrategy('wmctrl', fromWmctrl);
  if (w) return w;
  return tryStrategy('xprop', fromX11);
}
