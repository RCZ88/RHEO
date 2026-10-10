import type { PageManifest } from '../types'

/**
 * /settings — twelve tabs.
 *
 * `SettingsPage` is the ONE page whose deep-nav hint key already matched
 * (`settings-activeTab`), so it is the reference implementation for the pattern.
 *
 * The palette was missing four tabs entirely: `database`, `auth`, `shortcuts`,
 * and `profile` — all of which have real `data-section` anchors in the page.
 */
const settings: PageManifest = {
  id: 'settings',
  route: '/settings',
  label: 'Settings',
  icon: 'Settings',
  group: 'Navigation',
  keywords: ['settings', 'preferences', 'config', 'options', 'customise'],
  hint: 'Appearance, categories, AI, tracking, devices and more',

  tabs: {
    variable: 'activeTab',
    stateKey: 'tab',
    storageKey: 'settings-activeTab',
    default: 'category',
    items: [
      { id: 'category', label: 'Categories', icon: 'Tags', section: 'settings.category', keywords: ['categories', 'tiers', 'assign', 'productivity'] },
      { id: 'appearance', label: 'Appearance', icon: 'Palette', section: 'settings.appearance', keywords: ['appearance', 'theme', 'dark', 'light', 'fonts'] },
      { id: 'colors', label: 'Colors', icon: 'Brush', section: 'settings.colors', keywords: ['colors', 'palette', 'customize', 'theme colors'] },
      { id: 'ai', label: 'AI Assistant', icon: 'Bot', section: 'settings.ai', keywords: ['ai', 'model', 'provider', 'api', 'assistant'] },
      { id: 'general', label: 'General', icon: 'Settings', section: 'settings.general', keywords: ['general', 'preferences', 'period', 'language'] },
      { id: 'tracking', label: 'Tracking', icon: 'Gauge', section: 'settings.tracking', keywords: ['tracking', 'apps', 'detection', 'idle', 'capture'] },
      { id: 'prompts', label: 'System Prompts', icon: 'MessageSquare', section: 'settings.prompts', keywords: ['prompts', 'instructions', 'system', 'agent'] },
      { id: 'finance', label: 'Finance', icon: 'Wallet', section: 'settings.finance', keywords: ['finance', 'currency', 'accounts', 'money'] },
      { id: 'devices', label: 'Devices', icon: 'Cpu', section: 'settings.devices', keywords: ['devices', 'phone', 'sync', 'paired'] },
      { id: 'database', label: 'Database', icon: 'Database', section: 'settings.database', keywords: ['database', 'storage', 'backup', 'size'] },
      { id: 'auth', label: 'Auth', icon: 'KeyRound', section: 'settings.auth', keywords: ['auth', 'login', 'account', 'security', 'password'] },
      { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: 'Keyboard', section: 'settings.shortcuts', keywords: ['shortcuts', 'keys', 'keybindings', 'hotkeys', 'ctrl'] },
    ],
  },

  sections: [
    { id: 'settings.ai.diagnostics', label: 'AI Diagnostics', icon: 'Activity', keywords: ['diagnostics', 'health', 'status', 'provider test'] },
    { id: 'settings.tracking.browsers', label: 'Tracking — Browsers', icon: 'Globe', keywords: ['browsers', 'chrome', 'extension', 'detect'] },
    { id: 'settings.tracking.extension-setup', label: 'Tracking — Extension Setup', icon: 'Blocks', keywords: ['extension', 'setup', 'install', 'pair'] },
    { id: 'settings.profile', label: 'Profile', icon: 'User', keywords: ['profile', 'name', 'avatar', 'identity'] },
    // The Halo Island panel. It was previously reachable from nowhere AND visible
    // everywhere: it sat outside every `activeTab === '…'` conditional, so it
    // mounted on Finance, Devices, Database, Auth and Keyboard Shortcuts too.
    // It now renders inside the Appearance tab.
    //
    // `SECTION_TAB` below is what makes this row honest. A same-page section row
    // carries a `section` but NO `tab` (see `sectionEntry` in registry.ts), so
    // picking it from ⌘K would land on whatever tab was last open and then try to
    // scroll to an element that only exists on Appearance. The map below is read
    // by `SettingsPage` to switch tabs before it scrolls.
    { id: 'settings.halo', label: 'Halo Island', icon: 'Sparkles', keywords: ['halo', 'island', 'floating', 'overlay', 'always on top', 'widget', 'pill'] },
  ],
}

/**
 * Which tab owns a given `settings.*` section.
 *
 * Exported so the page and the manifest cannot disagree: a section declared above
 * with no entry here is a section that can be targeted but never shown on the
 * right tab, which is the silent-scroll-failure class of bug the whole registry
 * was written to remove.
 *
 * It lives here rather than on `SectionSpec` because `tab` is documented as valid
 * only alongside a cross-page `route` (`registry/types.ts:44`) — `sectionEntry`
 * reads it for cross-page rows only. A same-page section therefore has nowhere to
 * declare its owning tab, and `SettingsPage` needs one to resolve.
 */
export const SETTINGS_SECTION_TAB: Record<string, string> = {
  'settings.halo': 'appearance',
}

/**
 * /guide — Tutorial | Feature Specs.
 *
 * **Two bugs fixed at once.**
 *
 * 1. `GuidePage` reads `location.state.guideTab`, not `state.tab`, so every
 *    palette entry that passed `tab:` was ignored. And it reads
 *    `localStorage['guide-activeTab']` while `deepNav` wrote `/guide-activeTab`
 *    — a key mismatch. `stateKey: 'guideTab'` and `storageKey: 'guide-activeTab'`
 *    are both declared here.
 * 2. `guide.tutorial` / `guide.specs` were `data-section` targets that no
 *    element ever carried. Both anchors now exist in `GuidePage.tsx`.
 *
 * The spec and tutorial CONTENT still lives in `feature-specs.ts` and
 * `tutorial-steps.ts` — this manifest owns navigation, not prose.
 */
const guide: PageManifest = {
  id: 'guide',
  route: '/guide',
  label: 'Guide & Tutorials',
  icon: 'BookOpen',
  group: 'Navigation',
  keywords: ['guide', 'help', 'tutorial', 'specs', 'walkthrough', 'docs', 'progress', 'reset', 'completed tours'],
  aliases: ['feature-specs'],

  tabs: {
    variable: 'activeTab',
    stateKey: 'guideTab',
    storageKey: 'guide-activeTab',
    default: 'tutorial',
    items: [
      { id: 'tutorial', label: 'Tutorial', icon: 'BookOpen', section: 'guide.tutorial', keywords: ['tutorial', 'walkthrough', 'tour', 'learn', 'onboarding'] },
      { id: 'specs', label: 'Feature Specs', icon: 'FileText', section: 'guide.specs', keywords: ['specs', 'features', 'specifications', 'reference', 'documentation'] },
    ],
  },

  // No `sections`. Tour progress is rendered by `TutorialPage`, which lives
  // INSIDE the `guide.tutorial` panel — there is no separate region to scroll to.
}

export { settings, guide }