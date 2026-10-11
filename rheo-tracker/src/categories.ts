import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { CATEGORIES_PATH, log, warn } from './config';

/**
 * Faithful port of categorizeApp() from src/main.ts:5438-5460, reading and
 * writing the SAME deskflow-categories.json the app uses. That is deliberate: if
 * the daemon kept its own category table, an override set in Settings would
 * apply to app-written rows and silently not apply to daemon-written ones, so the
 * same app would be two categories depending on which process was running.
 */

interface CategoryConfig {
  version?: number;
  appCategoryMap: Record<string, string>;
  domainCategoryMap: Record<string, string>;
  detectedApps: Record<string, string>;
  detectedDomains: Record<string, string>;
  [k: string]: unknown;
}

const EMPTY: CategoryConfig = {
  appCategoryMap: {},
  domainCategoryMap: {},
  detectedApps: {},
  detectedDomains: {},
};

/** Mirrors src/main.ts:403 DEFAULT_APP_CATEGORIES (keyword → category). */
const DEFAULT_APP_CATEGORIES: Record<string, string> = {
  'visual studio code': 'Development',
  vscode: 'Development',
  code: 'Development',
  clion: 'Development',
  intellij: 'Development',
  pycharm: 'Development',
  webstorm: 'Development',
  goland: 'Development',
  rider: 'Development',
  phpstorm: 'Development',
  rubymine: 'Development',
  fleet: 'Development',
  cursor: 'Development',
  'android studio': 'Development',
  sublime: 'Development',
  terminal: 'Development',
  konsole: 'Development',
  'gnome terminal': 'Development',
  alacritty: 'Development',
  kitty: 'Development',
  wezterm: 'Development',
  warp: 'Development',
  hyper: 'Development',
  iterm: 'Development',
  chrome: 'Web',
  chromium: 'Web',
  firefox: 'Web',
  safari: 'Web',
  brave: 'Web',
  zen: 'Web',
  'zen browser': 'Web',
  arc: 'Web',
  opera: 'Web',
  vivaldi: 'Web',
  edge: 'Web',
  'microsoft edge': 'Web',
  figma: 'Design',
  sketch: 'Design',
  'affinity photo': 'Design',
  'affinity designer': 'Design',
  blender: 'Design',
  gimp: 'Design',
  inkscape: 'Design',
  krita: 'Design',
  steam: 'Gaming',
  lutris: 'Gaming',
  'heroic': 'Gaming',
  'gamescope': 'Gaming',
  proton: 'Gaming',
  wine: 'Gaming',
  spotify: 'Music',
  'vlc': 'Media',
  mpv: 'Media',
  obs: 'Media',
  'obs studio': 'Media',
  slack: 'Communication',
  discord: 'Communication',
  telegram: 'Communication',
  zoom: 'Communication',
  teams: 'Communication',
  'microsoft teams': 'Communication',
  signal: 'Communication',
  whatsapp: 'Communication',
  'discord-canary': 'Communication',
  postman: 'Tools',
  insomnia: 'Tools',
  wireshark: 'Tools',
  'dbeaver': 'Tools',
  'tableplus': 'Tools',
  notion: 'Productivity',
  obsidian: 'Productivity',
  'todoist': 'Productivity',
  jira: 'Productivity',
  'linear': 'Productivity',
  'google docs': 'Productivity',
  'microsoft word': 'Productivity',
  'microsoft excel': 'Productivity',
  libreoffice: 'Productivity',
};

let config: CategoryConfig = { ...EMPTY };
let dirty = false;
let lastRead = 0;

export function loadCategories(force = false): void {
  // The app rewrites this file whenever Settings changes. Re-read periodically so
  // an override set while the daemon runs is picked up without a restart.
  const now = Date.now();
  if (!force && now - lastRead < 30_000) return;
  lastRead = now;
  try {
    const parsed = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8')) as Partial<CategoryConfig>;
    config = {
      ...EMPTY,
      ...parsed,
      appCategoryMap: parsed.appCategoryMap || {},
      domainCategoryMap: parsed.domainCategoryMap || {},
      detectedApps: parsed.detectedApps || {},
      detectedDomains: parsed.detectedDomains || {},
    };
  } catch {
    // No file yet, or mid-write by the app. Keyword detection still works.
    config = { ...EMPTY };
  }
}

/**
 * Port of categorizeApp(). Order matters and is preserved exactly:
 *   1. Gaming short-circuit
 *   2. exact override, then case-insensitive override
 *   3. cached detection
 *   4. keyword match (cached on hit)
 *   5. Uncategorized
 */
export function categorizeApp(appName: string, opts?: { isResolvedGame?: boolean }): string {
  if (opts?.isResolvedGame) return 'Gaming';
  const lower = (appName || '').toLowerCase();

  const overrideMap = config.appCategoryMap || {};
  if (overrideMap[appName]) return overrideMap[appName];
  const lowerKey = Object.keys(overrideMap).find((k) => k.toLowerCase() === lower);
  if (lowerKey) return overrideMap[lowerKey];

  if (config.detectedApps[lower]) return config.detectedApps[lower];

  for (const [keyword, category] of Object.entries(DEFAULT_APP_CATEGORIES)) {
    if (lower.includes(keyword)) {
      config.detectedApps[lower] = category;
      dirty = true;
      return category;
    }
  }
  return 'Uncategorized';
}

/** Port of the app's domain categoriser, used by the browser ingest path. */
export function categorizeDomain(domain: string): string {
  const lower = (domain || '').toLowerCase();
  if (!lower) return 'Uncategorized';
  const override = config.domainCategoryMap || {};
  if (override[lower]) return override[lower];
  const ciKey = Object.keys(override).find((k) => k.toLowerCase() === lower);
  if (ciKey) return override[ciKey];
  if (config.detectedDomains[lower]) return config.detectedDomains[lower];

  for (const [keyword, category] of Object.entries(DEFAULT_APP_CATEGORIES)) {
    if (lower.includes(keyword)) {
      config.detectedDomains[lower] = category;
      dirty = true;
      return category;
    }
  }
  const social = ['facebook', 'instagram', 'twitter', 'x.com', 'tiktok', 'reddit', 'youtube'];
  for (const k of social) {
    if (lower.includes(k)) {
      config.detectedDomains[lower] = 'Social';
      dirty = true;
      return 'Social';
    }
  }
  const dev = ['github', 'gitlab', 'stackoverflow', 'npmjs', 'developer.mozilla', 'docs.', 'vercel'];
  for (const k of dev) {
    if (lower.includes(k)) {
      config.detectedDomains[lower] = 'Development';
      dirty = true;
      return 'Development';
    }
  }
  return 'Uncategorized';
}

/**
 * Persist newly detected keywords back into the shared JSON so the app sees the
 * same categories on the rows it writes later. write-then-rename, and only when
 * something actually changed, so we never rewrite a file the app owns.
 */
export async function flushCategories(): Promise<void> {
  if (!dirty) return;
  dirty = false;
  const tmp = `${CATEGORIES_PATH}.${process.pid}.tmp`;
  try {
    const current = JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8')) as CategoryConfig;
    current.detectedApps = { ...(current.detectedApps || {}), ...config.detectedApps };
    current.detectedDomains = { ...(current.detectedDomains || {}), ...config.detectedDomains };
    await fsp.writeFile(tmp, JSON.stringify(current, null, 2), 'utf8');
    await fsp.rename(tmp, CATEGORIES_PATH);
    log('flushed category cache into deskflow-categories.json');
  } catch {
    warn('category flush skipped (file absent or locked) — keyword cache stays in memory');
  }
}