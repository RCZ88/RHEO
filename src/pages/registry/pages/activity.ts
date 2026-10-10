import type { PageManifest } from '../types'

/**
 * /activity — the unified Apps / Websites / Productivity / Focus / External page.
 *
 * Two things this manifest fixes:
 *
 * 1. **`external` was missing.** `ActivityPage` renders five tabs and stamps
 *    `data-section="activity.external"`, but neither the palette nor
 *    `SMART_SEARCH_PAGES` had an entry for it.
 * 2. **The hint key.** `ActivityPage.tsx:59` documents that it reads
 *    `localStorage['/activity-activeTab']` — which is what `deepNav`'s generic
 *    `${route}-activeTab` produces, so this one already worked. It is now
 *    *declared* rather than coincidental, so a future route rename cannot
 *    silently break it.
 */
const activity: PageManifest = {
  id: 'activity',
  route: '/activity',
  label: 'Activity',
  icon: 'Activity',
  group: 'Navigation',
  keywords: ['activity', 'apps', 'websites', 'usage', 'tracking', 'browsing'],
  hint: 'Everything you used, by app, site, tier and focus session',
  aliases: ['stats', 'browser', 'productivity'], // legacy routes redirect here

  tabs: {
    variable: 'activeTab',
    stateKey: 'tab',
    storageKey: '/activity-activeTab',
    hashParam: 'tab',
    default: 'apps',
    items: [
      {
        id: 'apps',
        label: 'Applications',
        icon: 'Monitor',
        section: 'activity.apps',
        keywords: ['apps', 'applications', 'desktop', 'programs', 'windows'],
      },
      {
        id: 'websites',
        label: 'Websites',
        icon: 'Globe',
        section: 'activity.websites',
        keywords: ['websites', 'browser', 'domains', 'web', 'urls', 'chrome'],
      },
      {
        id: 'productivity',
        label: 'Productivity',
        icon: 'Target',
        section: 'activity.productivity',
        keywords: ['productivity', 'tier', 'focus', 'productive', 'distracting', 'score'],
      },
      {
        id: 'focus',
        label: 'Focus Sessions',
        icon: 'Timer',
        section: 'activity.focus',
        keywords: ['focus', 'sessions', 'concentration', 'pomodoro', 'deep work'],
      },
      {
        id: 'external',
        label: 'External',
        icon: 'Clock',
        section: 'activity.external',
        keywords: ['external', 'manual', 'offline', 'activities', 'logged'],
      },
    ],
  },

  tutorial: {
    id: 'activity',
    name: 'Activity',
    steps: [
      {
        target: '[data-tutorial="activity.tabs"]',
        title: 'Five views',
        instruction: '• Apps, Websites, Productivity, Focus, External\n• The tab you were last on is remembered',
        position: 'bottom',
        type: 'action',
      },
    ],
  },
}

export default activity
