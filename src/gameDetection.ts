import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

export const GAME_LAUNCHERS: Record<string, string[]> = {
  steam: ['steam.exe', 'steamwebhelper.exe'],
  epic: ['epicgameslauncher.exe', 'unrealcefsubprocess.exe'],
  'battle.net': ['battle.net.exe', 'agent.exe'],
  ea: ['eaapp.exe', 'origin.exe', 'eadesktop.exe'],
  gog: ['goggalaxy.exe'],
  ubisoft: ['ubisoftconnect.exe', 'upc.exe'],
  riot: ['riotclient.exe', 'riotclientservices.exe'],
};

const LAUNCHER_EXES = new Set(
  Object.values(GAME_LAUNCHERS).flat().map((e) => e.toLowerCase())
);

export const isLauncherProcess = (name?: string | null): boolean =>
  !!name && LAUNCHER_EXES.has(name.toLowerCase());

export const KNOWN_GAME_PROCESSES: Record<string, string> = {
  'client.exe': 'Wuthering Waves',
  'wutheringwaves.exe': 'Wuthering Waves',
  'genshinimpact.exe': 'Genshin Impact',
  'yuanshen.exe': 'Genshin Impact',
  'starrail.exe': 'Honkai: Star Rail',
  'eldenring.exe': 'Elden Ring',
  'cyberpunk2077.exe': 'Cyberpunk 2077',
  'valorant.exe': 'Valorant',
  'valorant-win64-shipping.exe': 'Valorant',
};

export function gameNameFromTitle(title?: string | null): string | null {
  if (!title) return null;
  const m = title.match(/^(.+?)\s*[-–—]\s*(?:steam|epic games)\s*$/i);
  if (m) return m[1].trim();
  const t = title.trim();
  if (t && !/^(steam|epic games launcher|battle\.net)$/i.test(t)) return t;
  return null;
}

export const installedGameIndex = new Map<string, string>();

function steamRoots(): string[] {
  const guesses = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    path.join(os.homedir(), '.steam', 'steam'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Steam'),
  ];
  return guesses.filter((p) => safeExists(path.join(p, 'steamapps')));
}

const safeExists = (p: string): boolean => {
  try { return fs.existsSync(p); } catch { return false; }
};

function libraryPaths(steamRoot: string): string[] {
  const out = [path.join(steamRoot, 'steamapps')];
  try {
    const vdf = fs.readFileSync(
      path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8'
    );
    for (const m of vdf.matchAll(/"path"\s*"([^"]+)"/g)) {
      out.push(path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps'));
    }
  } catch { return out; }
  return out;
}

export function buildInstalledGameIndex(): void {
  installedGameIndex.clear();
  try {
    for (const root of steamRoots()) {
      for (const lib of libraryPaths(root)) {
        if (!safeExists(lib)) continue;
        for (const f of fs.readdirSync(lib)) {
          if (!/^appmanifest_\d+\.acf$/.test(f)) continue;
          const acf = fs.readFileSync(path.join(lib, f), 'utf8');
          const name = acf.match(/"name"\s*"([^"]+)"/)?.[1];
          const dir = acf.match(/"installdir"\s*"([^"]+)"/)?.[1];
          if (!name) continue;
          if (dir) installedGameIndex.set(dir.toLowerCase(), name);
          installedGameIndex.set(
            name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.exe', name
          );
        }
      }
    }
  } catch (e) {
    console.warn('[gameDetection] index build skipped:', (e as Error)?.message);
  }
}

type ResolvedCache = { name: string | null; at: number };
let scanCache: ResolvedCache = { name: null, at: 0 };
const SCAN_TTL = 10000;
let scanInFlight: Promise<string | null> | null = null;

export function lookupExe(exe: string, fullPath?: string | null): string | null {
  const k = exe.toLowerCase();
  if (fullPath) {
    const lowerPath = fullPath.toLowerCase();
    for (const [dir, name] of installedGameIndex.entries()) {
      if (lowerPath.includes(dir)) return name;
    }
  }
  return KNOWN_GAME_PROCESSES[k] ?? installedGameIndex.get(k) ?? null;
}

export async function scanForGameProcess(): Promise<string | null> {
  const now = Date.now();
  if (now - scanCache.at < SCAN_TTL) return scanCache.name;
  if (scanInFlight) return scanInFlight;
  scanInFlight = (async () => {
    let found: string | null = null;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execFileP(
          'tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, timeout: 4000 }
        );
        for (const line of stdout.split(/\r?\n/)) {
          const exe = line.split('","')[0]?.replace(/"/g, '').trim();
          if (!exe) continue;
          if (isLauncherProcess(exe)) continue;
          const hit = lookupExe(exe, null);
          if (hit) { found = hit; break; }
        }
      }
    } catch {}
    scanCache = { name: found, at: Date.now() };
    scanInFlight = null;
    return found;
  })();
  return scanInFlight;
}

export type ResolveSource = 'title' | 'map' | 'index' | 'scan' | 'keepalive' | 'raw' | 'electron-title';
let lastResolvedGame: string | null = null;

const ELECTRON_TITLE_MAP: Record<string, string> = {
  'spotify': 'Spotify', 'spotify web player': 'Spotify',
  'visual studio code': 'VS Code', 'code - oss': 'VS Code', 'code oss': 'VS Code',
  'vscode': 'VS Code', 'code': 'VS Code', 'vscode insiders': 'VS Code',
  'slack': 'Slack', 'discord': 'Discord', 'teams': 'Microsoft Teams',
  'microsoft teams': 'Microsoft Teams',
  'obs studio': 'OBS Studio', 'obs': 'OBS Studio',
  'notion': 'Notion', 'figma': 'Figma',
  'whatsapp': 'WhatsApp', 'signal': 'Signal', 'zoom': 'Zoom',
  'notepad': 'Notepad', 'notepad++': 'Notepad++',
  'calculator': 'Calculator',
  'chrome': 'Chrome', 'chromium': 'Chrome', 'brave': 'Brave',
  'edge': 'Microsoft Edge', 'firefox': 'Firefox', 'safari': 'Safari',
  'opera': 'Opera', 'vivaldi': 'Vivaldi', 'arc': 'Arc',
  'cursor': 'Cursor', 'chatgpt': 'ChatGPT', 'claude': 'Claude',
  'perplexity': 'Perplexity', 'gemini': 'Gemini',
  'github': 'GitHub', 'gitlab': 'GitLab',
  'jetbrains': 'JetBrains', 'intellij': 'IntelliJ', 'pycharm': 'PyCharm',
  'webstorm': 'WebStorm', 'android studio': 'Android Studio', 'xcode': 'Xcode',
  'terminal': 'Terminal', 'iterm': 'iTerm', 'hyper': 'Hyper',
  'alacritty': 'Alacritty', 'kitty': 'Kitty',
  'gnome terminal': 'GNOME Terminal', 'konsole': 'Konsole',
  'postman': 'Postman', 'insomnia': 'Insomnia', 'dbeaver': 'DBeaver',
  'docker': 'Docker', 'docker desktop': 'Docker Desktop',
  'vlc': 'VLC', 'mpv': 'MPV', 'thunderbird': 'Thunderbird',
  'mail': 'Mail', 'outlook': 'Outlook', 'gmail': 'Gmail',
  'google drive': 'Google Drive', 'dropbox': 'Dropbox', 'onedrive': 'OneDrive',
  'calendar': 'Calendar', 'trello': 'Trello', 'asana': 'Asana',
  'todoist': 'Todoist', 'linear': 'Linear', 'jira': 'Jira',
  'evernote': 'Evernote', 'obsidian': 'Obsidian', 'sketch': 'Sketch',
  'affinity': 'Affinity', 'canva': 'Canva',
  'gimp': 'GIMP', 'inkscape': 'Inkscape', 'blender': 'Blender',
  'audacity': 'Audacity', 'photoshop': 'Photoshop',
  'illustrator': 'Illustrator', 'premiere': 'Premiere Pro',
  'lightroom': 'Lightroom', 'indesign': 'InDesign',
  'acrobat': 'Acrobat', 'reader': 'Adobe Reader',
  'rheo': 'RHEO', 'deskflow': 'DeskFlow', 'app tracker': 'RHEO',
  'steam': 'Steam', 'epic': 'Epic Games', 'origin': 'Origin',
  'minecraft': 'Minecraft', 'fortnite': 'Fortnite', 'roblox': 'Roblox',
  'valorant': 'Valorant', 'warframe': 'Warframe',
  'apex legends': 'Apex Legends', 'csgo': 'CS2',
  'dota': 'Dota 2', 'league of legends': 'League of Legends',
  'reddit': 'Reddit', 'twitter': 'X', 'x': 'X',
  'facebook': 'Facebook', 'instagram': 'Instagram', 'tiktok': 'TikTok',
  'youtube': 'YouTube', 'netflix': 'Netflix', 'twitch': 'Twitch',
  'soundcloud': 'SoundCloud', 'vimeo': 'Vimeo',
  'logseq': 'Logseq', 'joplin': 'Joplin',
  'simplenote': 'Simplenote', 'google keep': 'Google Keep',
  'wallpaper engine': 'Wallpaper Engine',
  'apple music': 'Apple Music', 'music': 'Music',
  'transmission': 'Transmission', 'qbittorrent': 'qBittorrent',
};

function stripSuffixes(title: string): string {
  const suffixes = [
    'spotify web player', 'visual studio code', 'code - oss', 'code oss',
    'vscode insiders', 'microsoft teams', 'obs studio', 'epic games launcher',
    'docker desktop', 'android studio', 'grand theft auto', 'premiere pro',
    'notepad++', 'adobe xd', 'adobe illustrator', 'adobe photoshop',
    'after effects', 'lightroom classic', 'indesign', 'acrobat reader',
    'windows media player', 'groove music', 'apple podcasts',
    'final fantasy xiv', 'world of Warcraft', 'league of legends',
  ];
  let stripped = title.toLowerCase().trim();
  for (const suf of suffixes) {
    stripped = stripped.replace(new RegExp(`[-–—]\\s*${suf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '');
  }
  // Generic suffix removal
  stripped = stripped.replace(/[-–—]\s*(spotify|visual studio code|code|slack|discord|teams|obs|notion|figma|whatsapp|signal|zoom|notepad|calculator|rheo|deskflow|app tracker|chrome|chromium|brave|edge|firefox|safari|opera|vivaldi|arc|cursor|chatgpt|claude|perplexity|gemini|github|gitlab|postman|insomnia|dbeaver|docker|vlc|mpv|thunderbird|trello|asana|todoist|linear|jira|terminal|iterm|hyper|alacritty|kitty|jetbrains|intellij|pycharm|webstorm|android studio|xcode|vscode|steam|epic|origin|minecraft|fortnite|roblox|valorant|csgo|counter strike|dota|league of legends|teamfight tactics|grand theft auto|gta|elden ring|cyberpunk|starfield|skyrim|fallout|wow|ffxiv|destiny|borderlands|gearbox|spotify web player)\s*$/i, '');
  return stripped.trim();
}

async function resolveElectronByTitle(title: string): Promise<string | null> {
  if (!title) return null;
  const lower = title.toLowerCase().trim();
  const stripped = stripSuffixes(title);
  for (const [key, name] of Object.entries(ELECTRON_TITLE_MAP)) {
    if (lower === key || lower.startsWith(key + ' ') || lower.startsWith(key + '-') || lower.startsWith(key + '—') || lower.startsWith(key + '-')) {
      return name;
    }
    if (stripped === key || stripped.startsWith(key + ' ') || stripped.startsWith(key + '-')) {
      return name;
    }
    if (lower.includes(key) && lower.length <= key.length + 25) {
      return name;
    }
  }
  return null;
}

export async function resolveForegroundApp(
  raw: { owner?: { name?: string; path?: string }; title?: string } | null,
): Promise<{ name: string; source: ResolveSource } | null> {
  if (!raw) {
    if (lastResolvedGame) return { name: lastResolvedGame, source: 'keepalive' };
    return null;
  }

  const proc = raw.owner?.name ?? '';
  const procPath = raw.owner?.path ?? '';
  const title = raw.title ?? '';

  const launcher = isLauncherProcess(proc);
  const mappedByProc = lookupExe(proc, procPath);

  if (proc.toLowerCase() === 'electron') {
    const byTitle = await resolveElectronByTitle(title);
    if (byTitle) {
      lastResolvedGame = byTitle;
      return { name: byTitle, source: 'electron-title' };
    }
    // Use the title as the app name instead of falling back to 'Electron'
    if (title && title !== 'Electron') {
      lastResolvedGame = title;
      return { name: title, source: 'electron-title' };
    }
    lastResolvedGame = null;
    return { name: 'Electron', source: 'raw' };
  }

  if (!launcher && !mappedByProc) {
    lastResolvedGame = null;
    return { name: proc || title || 'Unknown', source: 'raw' };
  }

  if (mappedByProc) {
    lastResolvedGame = mappedByProc;
    return { name: mappedByProc, source: 'map' };
  }

  const byTitle = gameNameFromTitle(title);
  if (byTitle) {
    lastResolvedGame = byTitle;
    return { name: byTitle, source: 'title' };
  }

  const byScan = await scanForGameProcess();
  if (byScan) {
    lastResolvedGame = byScan;
    return { name: byScan, source: 'scan' };
  }

  lastResolvedGame = null;
  return { name: proc, source: 'raw' };
}

export function rescanGames(): void {
  buildInstalledGameIndex();
  scanCache = { name: null, at: 0 };
}
