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

/**
 * Canonical category vocabulary — MUST match the app's Settings list
 * (`src/lib/afk.ts ALL_CATEGORIES`). The daemon used to write 'Development',
 * 'Web', 'Music', 'Media' and 'Social', none of which exist in the app, so
 * daemon-written rows fell outside every filter and chart that uses the real
 * vocabulary. Never add a value here that the app does not know.
 */
export const CANONICAL_CATEGORIES = [
  'IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication',
  'Design', 'Productivity', 'Tools', 'Education', 'Developer Tools',
  'Search Engine', 'News', 'Shopping', 'Social Media', 'Gaming',
  'Uncategorized', 'Other',
] as const;

const CATEGORY_ALIASES: Record<string, string> = {
  development: 'Developer Tools',
  developer: 'Developer Tools',
  programming: 'Developer Tools',
  web: 'Browser',
  browsing: 'Browser',
  music: 'Entertainment',
  media: 'Entertainment',
  video: 'Entertainment',
  social: 'Social Media',
  'social media': 'Social Media',
  misc: 'Other',
  'non-categorized': 'Uncategorized',
  uncategorised: 'Uncategorized',
};

/** Map legacy/foreign category values onto the app's canonical vocabulary. */
export function normalizeCategory(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return 'Uncategorized';
  const canonical = (CANONICAL_CATEGORIES as readonly string[]).find(
    (c) => c.toLowerCase() === raw.toLowerCase(),
  );
  if (canonical) return canonical;
  const alias = CATEGORY_ALIASES[raw.toLowerCase()];
  return alias || 'Uncategorized';
}

/**
 * Canonical app keywords. Mirrors src/main.ts DEFAULT_APP_CATEGORIES, with the
 * same values, plus the Linux binaries seen on this machine (idea, kolourpaint,
 * dolphin, okular, soffice.bin) that the app had no entry for.
 */
const DEFAULT_APP_CATEGORIES: Record<string, string> = {
  // IDE
  'visual studio code': 'IDE', vscode: 'IDE', code: 'IDE', clion: 'IDE',
  intellij: 'IDE', idea: 'IDE', 'jetbrains-idea': 'IDE', pycharm: 'IDE',
  webstorm: 'IDE', goland: 'IDE', rider: 'IDE', phpstorm: 'IDE',
  rubymine: 'IDE', datagrip: 'IDE', appcode: 'IDE', fleet: 'IDE',
  'android studio': 'IDE', sublime: 'IDE', vim: 'IDE', neovim: 'IDE',
  emacs: 'IDE', 'notepad++': 'IDE', 'visual studio': 'IDE', xcode: 'IDE',
  atom: 'IDE', flutter: 'IDE', dart: 'IDE',
  // AI Tools
  claude: 'AI Tools', chatgpt: 'AI Tools', gpt: 'AI Tools', copilot: 'AI Tools',
  perplexity: 'AI Tools', gemini: 'AI Tools', bard: 'AI Tools', mistral: 'AI Tools',
  anthropic: 'AI Tools', openai: 'AI Tools', cursor: 'AI Tools',
  // Browser
  chrome: 'Browser', chromium: 'Browser', 'chromium-browser': 'Browser',
  firefox: 'Browser', 'firefox-esr': 'Browser', safari: 'Browser', brave: 'Browser',
  zen: 'Browser', 'app.zen_browser.zen': 'Browser', arc: 'Browser', opera: 'Browser',
  vivaldi: 'Browser', edge: 'Browser', 'microsoft edge': 'Browser', comet: 'Browser',
  // Entertainment
  youtube: 'Entertainment', netflix: 'Entertainment', spotify: 'Entertainment',
  twitch: 'Entertainment', hulu: 'Entertainment', disney: 'Entertainment',
  'prime video': 'Entertainment', 'apple tv': 'Entertainment', hbo: 'Entertainment',
  vimeo: 'Entertainment', soundcloud: 'Entertainment', vlc: 'Entertainment',
  mpv: 'Entertainment', obs: 'Entertainment', 'obs studio': 'Entertainment',
  // Gaming
  minecraft: 'Gaming', fortnite: 'Gaming', valorant: 'Gaming', league: 'Gaming',
  dota: 'Gaming', csgo: 'Gaming', 'counter-strike': 'Gaming', 'rocket league': 'Gaming',
  apex: 'Gaming', overwatch: 'Gaming', pubg: 'Gaming', warzone: 'Gaming',
  genshin: 'Gaming', steam: 'Gaming', epic: 'Gaming', 'battle.net': 'Gaming',
  blizzard: 'Gaming', riot: 'Gaming', ubisoft: 'Gaming', origin: 'Gaming',
  xbox: 'Gaming', playstation: 'Gaming', nintendo: 'Gaming', godot: 'Gaming',
  lutris: 'Gaming', heroic: 'Gaming', gamescope: 'Gaming', proton: 'Gaming', wine: 'Gaming',
  // Communication
  slack: 'Communication', discord: 'Communication', 'discord-canary': 'Communication',
  teams: 'Communication', 'microsoft teams': 'Communication', zoom: 'Communication',
  skype: 'Communication', telegram: 'Communication', whatsapp: 'Communication',
  signal: 'Communication', messenger: 'Communication', mail: 'Communication',
  outlook: 'Communication', thunderbird: 'Communication',
  // Design
  figma: 'Design', photoshop: 'Design', illustrator: 'Design', sketch: 'Design',
  'adobe xd': 'Design', indesign: 'Design', affinity: 'Design',
  'affinity photo': 'Design', 'affinity designer': 'Design', canva: 'Design',
  dribbble: 'Design', behance: 'Design', invision: 'Design', zeplin: 'Design',
  miro: 'Design', blender: 'Design', gimp: 'Design', inkscape: 'Design',
  krita: 'Design', kolourpaint: 'Design',
  // Productivity (terminals, file managers, office, notes)
  terminal: 'Productivity', konsole: 'Productivity', kwrite: 'Productivity', 'gnome terminal': 'Productivity',
  alacritty: 'Productivity', kitty: 'Productivity', wezterm: 'Productivity',
  warp: 'Productivity', hyper: 'Productivity', iterm: 'Productivity',
  powershell: 'Productivity', cmd: 'Productivity', explorer: 'Productivity',
  'file explorer': 'Productivity', finder: 'Productivity', dolphin: 'Productivity',
  nautilus: 'Productivity', thunar: 'Productivity', okular: 'Productivity',
  'soffice.bin': 'Productivity', libreoffice: 'Productivity',
  notion: 'Productivity', evernote: 'Productivity', bear: 'Productivity',
  'apple notes': 'Productivity', todoist: 'Productivity', asana: 'Productivity',
  trello: 'Productivity', linear: 'Productivity', jira: 'Productivity',
  logseq: 'Productivity', craft: 'Productivity', obsidian: 'Productivity',
  'google docs': 'Productivity', 'microsoft word': 'Productivity',
  'microsoft excel': 'Productivity', 'microsoft powerpoint': 'Productivity',
  'plasma-systemmonitor': 'Tools', rheo: 'Productivity', deskflow: 'Productivity',
  // Developer Tools
  git: 'Developer Tools', github: 'Developer Tools', gitlab: 'Developer Tools',
  bitbucket: 'Developer Tools', docker: 'Developer Tools', kubernetes: 'Developer Tools',
  postman: 'Developer Tools', insomnia: 'Developer Tools', dbeaver: 'Developer Tools',
  tableplus: 'Developer Tools', 'sequel pro': 'Developer Tools', mysql: 'Developer Tools',
  mongodb: 'Developer Tools', redis: 'Developer Tools', nginx: 'Developer Tools',
  apache: 'Developer Tools', xampp: 'Developer Tools', wamp: 'Developer Tools',
  wireshark: 'Developer Tools',
  // Tools
  wispr: 'Tools', '1password': 'Tools', lastpass: 'Tools', bitwarden: 'Tools',
  keepass: 'Tools', dropbox: 'Tools', 'google drive': 'Tools', onedrive: 'Tools',
  icloud: 'Tools', box: 'Tools', syncthing: 'Tools', spectacle: 'Tools',
  // Education
  anki: 'Education', duolingo: 'Education',
  // System portals (never user activity; mapped here so a stale auto-detected
  // 'Social Media' entry can never outlive the fix)
  'xdg-desktop-portal': 'Other', 'xdg-document-portal': 'Other',
  'xdg-permission-store': 'Other',
};

/**
 * Canonical domain keywords. Deliberately NOT the app map: running app names
 * over a hostname is how `open.spotify.com` became 'Music' and
 * `youtube.com` became 'Social'.
 */
const DEFAULT_DOMAIN_CATEGORIES: Record<string, string> = {
  'youtube.com': 'Entertainment',
  'github.com': 'Developer Tools', 'gitlab.com': 'Developer Tools',
  'stackoverflow.com': 'Developer Tools', 'npmjs.com': 'Developer Tools',
  'pypi.org': 'Developer Tools', 'dev.to': 'Developer Tools',
  'mdn.io': 'Developer Tools', 'w3schools.com': 'Developer Tools',
  'codepen.io': 'Developer Tools', 'vercel.com': 'Developer Tools',
  'chatgpt.com': 'AI Tools', 'claude.ai': 'AI Tools', 'bard.google.com': 'AI Tools',
  'perplexity.ai': 'AI Tools', 'copilot.microsoft.com': 'AI Tools',
  'gemini.google.com': 'AI Tools',
  'twitter.com': 'Social Media', 'x.com': 'Social Media', 'facebook.com': 'Social Media',
  'instagram.com': 'Social Media', 'linkedin.com': 'Social Media',
  'reddit.com': 'Social Media', 'tiktok.com': 'Social Media', 'snapchat.com': 'Social Media',
  'netflix.com': 'Entertainment', 'twitch.tv': 'Entertainment', 'disney.com': 'Entertainment',
  'hulu.com': 'Entertainment', 'vimeo.com': 'Entertainment', 'soundcloud.com': 'Entertainment',
  'spotify.com': 'Entertainment', 'open.spotify.com': 'Entertainment',
  'bbc.com': 'News', 'cnn.com': 'News', 'reuters.com': 'News', 'bloomberg.com': 'News',
  'medium.com': 'News', 'substack.com': 'News', 'theverge.com': 'News',
  'arstechnica.com': 'News',
  'amazon.com': 'Shopping', 'ebay.com': 'Shopping', 'etsy.com': 'Shopping',
  'shopify.com': 'Shopping', 'walmart.com': 'Shopping', 'aliexpress.com': 'Shopping',
  'docs.google.com': 'Productivity', 'drive.google.com': 'Productivity',
  'notion.so': 'Productivity', 'trello.com': 'Productivity', 'asana.com': 'Productivity',
  'calendar.google.com': 'Productivity',
  'figma.com': 'Design', 'canva.com': 'Design', 'dribbble.com': 'Design',
  'behance.net': 'Design', 'unsplash.com': 'Design',
  'google.com': 'Search Engine', 'bing.com': 'Search Engine',
  'duckduckgo.com': 'Search Engine', 'yahoo.com': 'Search Engine',
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
 * Keyword match for app/process names — NOT a raw substring test. Short keys
 * must be exact (`x` otherwise matches every xdg- and xterm-prefixed process),
 * and normal keys must land on a token boundary (`code` must not match
 * `encode`).
 */
export function appKeywordMatches(lower: string, keyword: string): boolean {
  if (!keyword) return false;
  if (lower === keyword) return true;
  if (keyword.length <= 2) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lower);
}

/**
 * App categoriser. Precedence is deliberate:
 *   1. Gaming short-circuit (resolved game)
 *   2. user override (Settings correction)
 *   3. the canonical keyword map
 *   4. cached auto-detection
 *   5. Uncategorized
 *
 * The keyword map beats the cache because the cache is machine-written and
 * never expires: one bad historical guess (`firefox` → 'Media') otherwise
 * outranks the correct built-in mapping forever. A real user override still
 * wins over everything.
 */
export function categorizeApp(appName: string, opts?: { isResolvedGame?: boolean }): string {
  if (opts?.isResolvedGame) return 'Gaming';
  const lower = (appName || '').toLowerCase();

  const overrideMap = config.appCategoryMap || {};
  if (overrideMap[appName]) return normalizeCategory(overrideMap[appName]);
  const lowerKey = Object.keys(overrideMap).find((k) => k.toLowerCase() === lower);
  if (lowerKey) return normalizeCategory(overrideMap[lowerKey]);

  for (const [keyword, category] of Object.entries(DEFAULT_APP_CATEGORIES)) {
    if (appKeywordMatches(lower, keyword)) {
      if (config.detectedApps[lower] !== category) {
        config.detectedApps[lower] = category;
        dirty = true;
      }
      return category;
    }
  }

  if (config.detectedApps[lower]) {
    return normalizeCategory(config.detectedApps[lower]);
  }

  return 'Uncategorized';
}

/** Port of the app's domain categoriser, used by the browser ingest path.
 *
 *  Domains use their OWN map. The old code ran the app-name keywords over the
 *  hostname, which is why `open.spotify.com` became 'Music' and `youtube.com`
 *  became 'Social' — both values the app does not recognise. */
export function categorizeDomain(domain: string): string {
  const lower = (domain || '').toLowerCase();
  if (!lower) return 'Uncategorized';
  const override = config.domainCategoryMap || {};
  if (override[lower]) return normalizeCategory(override[lower]);
  const ciKey = Object.keys(override).find((k) => k.toLowerCase() === lower);
  if (ciKey) return normalizeCategory(override[ciKey]);

  // Exact host first, then a suffix match so `www.youtube.com` and
  // `m.youtube.com` hit the same rule without a wildcard per subdomain.
  const exact = DEFAULT_DOMAIN_CATEGORIES[lower];
  if (exact) {
    if (config.detectedDomains[lower] !== exact) {
      config.detectedDomains[lower] = exact;
      dirty = true;
    }
    return exact;
  }
  for (const [keyword, category] of Object.entries(DEFAULT_DOMAIN_CATEGORIES)) {
    if (lower === keyword || lower.endsWith(`.${keyword}`) || lower.includes(keyword)) {
      if (config.detectedDomains[lower] !== category) {
        config.detectedDomains[lower] = category;
        dirty = true;
      }
      return category;
    }
  }

  if (config.detectedDomains[lower]) {
    return normalizeCategory(config.detectedDomains[lower]);
  }

  // Writer parity: the app treats an unknown domain as 'Entertainment' (a
  // deliberate scoring choice, not a claim), so the daemon must not label the
  // same visit differently while it owns tracking.
  return 'Entertainment';
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