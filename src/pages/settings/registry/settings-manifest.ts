/**
 * settings-manifest.ts — every Settings tab and setting group, declared once.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS — the autopsy
 *
 * Settings search was powered by THREE hand-maintained keyword sources that had
 * already drifted apart:
 *
 *   1. `settingsTabKeywords`      (SettingsPage)  9 of 12 tabs
 *   2. `terms={[...]}` props       39 arrays across SearchableSection call sites
 *   3. the tab labels themselves   12 strings
 *
 * And the consequences were all silent:
 *
 *   • **Three tabs were unreachable by search.** `appearance`, `database` and
 *     `shortcuts` had NO entry in `settingsTabKeywords`, so `findMatchingTab`
 *     returned null and the page never changed. A user searching "keyboard
 *     shortcut" got an unmoving screen — indistinguishable from broken search.
 *     This is the bug that prompted this file.
 *   • **Ambiguity resolved by object insertion order.** The matcher was
 *     `keywords.some(kw => q.includes(kw) || kw.includes(q))` returning the
 *     FIRST hit. `sync` is a keyword of BOTH `category` and `auth`, so it always
 *     landed on `category`; the auth tab was unreachable for its own headline
 *     feature.
 *   • **Two-character queries matched almost anything.** `kw.includes(q)` means
 *     "a" matches `category`. The first tab in insertion order won, so the result
 *     was arbitrary.
 *   • **No synonyms.** The Appearance tab holds theme and font settings, but
 *     `theme` was a keyword of `colors`. Searching "dark mode" matched nothing
 *     at all.
 *   • **Any control not wrapped in a `SearchableSection` was invisible while
 *     searching** — a setting you cannot find looks like a setting that is
 *     broken.
 *
 * One declaration per tab now. Search reads this, so it cannot fall behind the
 * tab list, and `npm run validate:settings` fails the build when a tab exists
 * here but not in `SettingsPage` (or the reverse).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { SettingGroupSpec, SettingsTabSpec } from './types'

export const SETTINGS_TABS: SettingsTabSpec[] = [
  {
    id: 'category',
    label: 'Category',
    hint: 'Productivity tiers and app/domain assignment',
    keywords: [
      'category', 'categories', 'tier', 'tiers', 'productive', 'neutral', 'distracting',
      'drag', 'drop', 'assign', 'assignment', 'reclassify', 'sort', 'order',
      'application', 'applications', 'apps', 'app', 'website', 'websites', 'domain', 'domains',
      'smart', 'keyword', 'keywords', 'categorization', 'categorise', 'categorize',
      'external', 'activities', 'forward', 'sync mode', 'data sync', 'custom',
      'add', 'new', 'rules',
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    hint: 'Theme, fonts and window chrome',
    // The tab people search for by what they SEE, never by its name.
    keywords: [
      'appearance', 'look', 'looks', 'style', 'theme', 'themes', 'dark', 'dark mode',
      'light', 'light mode', 'night mode', 'night', 'sepia', 'black', 'white',
      'contrast', 'brightness', 'dim', 'system theme', 'auto theme',
      'font', 'fonts', 'typeface', 'typography', 'size', 'zoom', 'density', 'compact',
      'comfortable', 'spacing', 'motion', 'animation', 'animate', 'reduce motion',
      'accent', 'accent colour', 'accent color', 'wallpaper', 'background', 'sidebar',
      'title bar', 'titlebar', 'window mode', 'fullscreen', 'hide', 'show', 'toggle',
    ],
  },
  {
    id: 'colors',
    label: 'Colors',
    hint: 'Per-category colour assignments',
    keywords: [
      'color', 'colors', 'colour', 'colours', 'palette', 'swatch', 'hex', 'rgb',
      'tint', 'shade', 'hue', 'category color', 'category colours', 'recolour',
      'recolor', 'assign colour', 'picker', 'custom colour', 'theme colors',
    ],
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    hint: 'Providers, routing, usage and diagnostics',
    keywords: [
      'ai', 'assistant', 'llm', 'model', 'models', 'provider', 'providers', 'openrouter',
      'openai', 'anthropic', 'claude', 'gemini', 'gpt', 'llama', 'local', 'ollama',
      'api', 'api key', 'apikey', 'token', 'key', 'routing', 'router', 'fallback',
      'daily brief', 'digest', 'research', 'topics', 'usage', 'cost', 'spend', 'price',
      'data access', 'privacy', 'agent colour', 'agent color', 'diagnostics', 'diagnostic',
      'health', 'status', 'test connection', 'multi-provider', 'temperature', 'context',
    ],
  },
  {
    id: 'general',
    label: 'General',
    hint: 'Idle behaviour, storage and export',
    keywords: [
      'general', 'behaviour', 'behavior', 'notification', 'notifications', 'notify',
      'toast', 'toasts', 'popup', 'banner', 'alert', 'banner duration', 'message',
      'idle', 'afk', 'away', 'inactive', 'threshold',
      'timeout', 'pause', 'pausing', 'resume', 'reset', 'ignore', 'auto-start',
      'autostart', 'auto-export', 'autoexport', 'storage', 'disk', 'size', 'cleanup',
      'clean up', 'export', 'import', 'csv', 'json', 'backup', 'restore', 'data',
      'startup', 'launch', 'on boot', 'language', 'locale', 'units', 'format',
      'period', 'week starts', 'first day', 'notification history', 'undo', 'redo',
    ],
  },
  {
    id: 'tracking',
    label: 'Tracking',
    hint: 'What gets captured, and when',
    keywords: [
      'tracking', 'track', 'capture', 'record', 'recording', 'transient', 'background',
      'foreground', 'detection', 'detect', 'game', 'gaming', 'entertainment', 'youtube',
      'netflix', 'exclude', 'ignore', 'ignore list', 'whitelist', 'blacklist',
      'browser', 'browsers', 'extension', 'profile', 'profiles', 'sleep', 'gap', 'gaps',
      'max session', 'session', 'prompt history', 'visible prompts', 'heartbeat',
      'idle', 'afk', 'screenshot', 'privacy', 'pause', 'active window', 'app detection',
    ],
  },
  {
    id: 'prompts',
    label: 'System Prompts',
    hint: 'The text handed to your coding agents',
    keywords: [
      'prompt', 'prompts', 'system prompt', 'system prompts', 'instruction', 'instructions',
      'default', 'defaults', 'agent', 'agents', 'command', 'commands', 'custom prompt',
      'claude', 'opencode', 'aider', 'codex', 'gemini', 'cursor', 'copilot', 'resume prompt',
      'addition', 'additions', 'preamble', 'persona', 'context', 'template',
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    hint: 'Currency, security and balances',
    keywords: [
      'finance', 'financial', 'money', 'currency', 'currencies', 'exchange', 'rate',
      'fx', 'conversion', 'auto-save', 'autosave', 'security', 'screen lock',
      'masking', 'mask', 'hide amounts', 'balance', 'balances', 'recalculate',
      'recalc', 'net worth', 'budget', 'wallet', 'account', 'accounts', 'transaction',
    ],
  },
  {
    id: 'devices',
    label: 'Devices',
    hint: 'Pairing and sync targets',
    keywords: [
      'device', 'devices', 'phone', 'mobile', 'tablet', 'pair', 'pairing', 'paired',
      'sync', 'syncing', 'remote', 'second monitor', 'display', 'watch', 'sensor',
    ],
  },
  {
    id: 'database',
    label: 'Database',
    hint: 'Storage, size and maintenance',
    keywords: [
      'database', 'db', 'sqlite', 'storage', 'disk', 'size', 'file size', 'vacuum',
      'compact', 'maintenance', 'integrity', 'repair', 'reset', 'wipe', 'clear data',
      'schema', 'tables', 'backup', 'restore', 'export', 'migrate', 'migration',
    ],
  },
  {
    id: 'auth',
    label: 'Auth',
    hint: 'Account, sign-in and sync credentials',
    keywords: [
      'auth', 'authentication', 'authorisation', 'authorization', 'login', 'log in',
      'sign in', 'signin', 'sign out', 'logout', 'register', 'signup', 'sign up',
      'sync', 'password', 'account', 'accounts', 'lock', 'locked', 'unlock',
      'credential', 'credentials', 'token', 'session', 'oauth', 'sync account',
      'sign-in', 'who am i', 'email',
    ],
  },
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    hint: 'Key bindings, navigation mode and rewind animation',
    keywords: [
      'shortcut', 'shortcuts', 'keybind', 'keybinds', 'keybinding', 'keybindings',
      'hotkey', 'hotkeys', 'keyboard', 'key', 'keys', 'bind', 'binding', 'chord',
      'command k', 'ctrl k', 'cmd k', 'ctrl+k', 'cmd+k', 'command palette', 'palette',
      'search', 'navigation', 'navigate', 'go to', 'jump', 'quick jump', 'command',
      'rewind', 'film', 'reel', 'cinema', 'mode', 'animation', 'animate', 'motion',
      'reduced motion', 'accessibility', 'a11y', 'tab', 'shift tab', 'enter',
    ],
  },
]

/**
 * Setting GROUPS inside tabs.
 *
 * Every entry is optional in the sense that a control rendered inside an
 * existing group is searchable automatically (its own text is harvested at
 * runtime), but a group needs an entry here to be findable BY SYNONYM before the
 * user has scrolled to it. These are the ones where a person is likely to search
 * a word that appears nowhere in the visible text.
 */
export const SETTING_GROUPS: SettingGroupSpec[] = [
  // Keyboard shortcuts
  { id: 'nav-mode', tab: 'shortcuts', title: 'Navigation', keywords: ['navigation', 'mode', 'list', 'classic', 'film', 'rewind', 'palette', 'ctrl k', 'go to', 'jump', 'cinema', 'reels'] },
  { id: 'nav-animation', tab: 'shortcuts', title: 'Rewind animation', keywords: ['animation', 'animate', 'motion', 'duration', 'speed', 'fast', 'quick', 'off', 'reduced motion', 'a11y'] },

  // Appearance
  { id: 'theme', tab: 'appearance', keywords: ['theme', 'dark', 'light', 'mode', 'colour scheme', 'color scheme', 'system theme'] },
  { id: 'fonts', tab: 'appearance', keywords: ['font', 'typeface', 'typography', 'size', 'family'] },
  { id: 'chrome', tab: 'appearance', keywords: ['title bar', 'titlebar', 'sidebar', 'window mode', 'fullscreen', 'hide', 'chrome', 'frame'] },

  // Tracking
  { id: 'idle-detection', tab: 'tracking', keywords: ['idle', 'afk', 'away', 'threshold', 'pause', 'inactive', 'gap', 'sleep'] },
  { id: 'app-detection', tab: 'tracking', keywords: ['app', 'apps', 'application', 'detection', 'exclude', 'ignore', 'game', 'gaming', 'entertainment'] },
  { id: 'browser-tracking', tab: 'tracking', keywords: ['browser', 'extension', 'chrome', 'firefox', 'edge', 'profile', 'tab', 'domain'] },

  // AI
  { id: 'ai-providers', tab: 'ai', keywords: ['provider', 'model', 'api key', 'openrouter', 'ollama', 'local', 'endpoint', 'base url'] },
  { id: 'ai-routing', tab: 'ai', keywords: ['routing', 'router', 'fallback', 'order', 'priority', 'multi-provider'] },
  { id: 'ai-usage', tab: 'ai', keywords: ['usage', 'cost', 'spend', 'tokens', 'budget', 'price', 'billing'] },
  { id: 'ai-diagnostics', tab: 'ai', keywords: ['diagnostics', 'health', 'status', 'test', 'connection', 'error', 'log'] },

  // Finance
  { id: 'finance-currency', tab: 'finance', keywords: ['currency', 'fx', 'exchange rate', 'conversion', 'usd', 'eur', 'idr'] },
  { id: 'finance-security', tab: 'finance', keywords: ['password', 'lock', 'mask', 'security', 'hide', 'privacy'] },

  // Category
  { id: 'tiers', tab: 'category', keywords: ['tier', 'productive', 'neutral', 'distracting', 'drag', 'drop', 'reorder'] },
  { id: 'domain-keywords', tab: 'category', keywords: ['keyword', 'smart', 'rule', 'categorisation', 'automation'] },

  // General
  { id: 'idle-behaviour', tab: 'general', keywords: ['idle', 'afk', 'threshold', 'pause', 'reset', 'ignore', 'auto-start', 'auto-export'] },
  // The other half of the idle decision. Without this entry "bedtime" and
  // "wake up" matched nothing in Settings search, which is a large part of why
  // the sleep window felt like it did not exist.
  { id: 'sleep-window', tab: 'general', keywords: ['sleep', 'bedtime', 'night', 'bed', 'wake', 'overnight', 'window', 'hours', 'woke', 'insomnia'] },
  { id: 'storage', tab: 'general', keywords: ['storage', 'disk', 'size', 'cleanup', 'export', 'csv', 'json', 'backup'] },
]

export const TAB_BY_ID = new Map(SETTINGS_TABS.map(t => [t.id, t]))
export const GROUP_BY_ID = new Map(SETTING_GROUPS.map(g => [g.id, g]))
