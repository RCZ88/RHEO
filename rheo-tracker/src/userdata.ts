import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Resolves the app's userData directory.
 *
 * This is the single most important thing to get right, and it is NOT
 * ~/.config/RHEO. start-dev.sh:370-375 deliberately overrides Electron's default
 * so Windows and Linux share the same profile on the NTFS mount:
 *
 *   --user-data-dir=/run/media/.../Users/cleme/Application Data/RHEO
 *
 * Verified on this machine: that profile's DB had 33,613 rows with the newest
 * timestamp 2 minutes old, while ~/.config/RHEO held a 29,289-row fossil last
 * written on 5 October. A daemon hardcoded to ~/.config/RHEO would not just miss
 * the mount dependency — it would silently build a SECOND, parallel tracking
 * history that looks like data loss when the app is opened.
 *
 * So: ask the running system, in order of authority.
 *   1. RHEO_TRACKER_USER_DATA   — explicit override, always wins
 *   2. A running Electron process's --user-data-dir argument (the live truth)
 *   3. ~/.config/RHEO            — last resort, only if nothing else exists
 */

const DEFAULT_DIR_NAME = 'RHEO';

function fromEnv(): string | null {
  const explicit = process.env.RHEO_TRACKER_USER_DATA;
  if (explicit && explicit.trim()) return explicit.trim();
  return null;
}

function fromRunningApp(): string | null {
  let entries: string[];
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return null;
  }
  const me = process.pid;
  for (const entry of entries) {
    const pid = Number(entry);
    if (!Number.isInteger(pid) || pid === me) continue;
    let raw: string;
    try {
      raw = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8');
    } catch {
      continue;
    }
    if (!raw) continue;
    const argv = raw.split('\0').filter(Boolean);
    if (argv.some((a) => a.startsWith('--type='))) continue;
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      // Accept both `--user-data-dir=X` and `--user-data-dir X`.
      if (arg.startsWith('--user-data-dir=')) {
        const value = arg.slice('--user-data-dir='.length);
        if (value) return value;
      }
      if (arg === '--user-data-dir' && argv[i + 1]) {
        return argv[i + 1];
      }
    }
  }
  return null;
}

function hasDb(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, 'deskflow-data.db')).isFile();
  } catch {
    return false;
  }
}

export interface ResolvedUserData {
  dir: string;
  source: 'env' | 'running-app' | 'fallback';
}

export function resolveUserData(): ResolvedUserData {
  const env = fromEnv();
  if (env) return { dir: env, source: 'env' };

  const fromApp = fromRunningApp();
  if (fromApp && hasDb(fromApp)) return { dir: fromApp, source: 'running-app' };

  const fallback = path.join(os.homedir(), '.config', DEFAULT_DIR_NAME);
  return { dir: fallback, source: 'fallback' };
}


export function dbFile(dir: string): string {
  return process.env.RHEO_TRACKER_DB || path.join(dir, 'deskflow-data.db');
}
