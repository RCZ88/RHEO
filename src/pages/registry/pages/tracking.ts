import type { PageManifest } from '../types'

/** /rankings — top apps and categories by time. */
const rankings: PageManifest = {
  id: 'rankings',
  route: '/rankings',
  label: 'Rankings',
  icon: 'Trophy',
  group: 'Navigation',
  keywords: ['rankings', 'leaderboard', 'top', 'score', 'best', 'most used', 'top apps', 'categories', 'spine', 'chart'],
  hint: 'Top apps and categories by tracked time',

  // No `sections`. The old palette declared `rankings.apps` and
  // `rankings.categories`, but RankingsPage renders a single panel — an `h1`
  // "Rankings" and an `h2` "The Spine" — with no apps/categories split to
  // anchor to. Both entries were fiction that navigated and scrolled to nothing.
  // The app/category distinction is expressible through keywords instead, which
  // is honest: it is a filter, not a region.
}

/** /external — manual activity logging. */
const external: PageManifest = {
  id: 'external',
  route: '/external',
  label: 'External Tracking',
  icon: 'Clock',
  group: 'Navigation',
  keywords: ['external', 'manual', 'tracking', 'offline', 'log', 'activities'],
  aliases: ['old-dashboard'],

  tabs: {
    variable: 'vizTab',
    stateKey: 'tab',
    storageKey: '/external-activeTab',
    default: 'grid',
    items: [
      { id: 'grid', label: 'Grid', icon: 'Grid3x3', keywords: ['grid', 'cards', 'layout'] },
      { id: 'daily', label: 'Daily', icon: 'Calendar', keywords: ['daily', 'day', 'list'] },
      { id: 'weekly', label: 'Weekly', icon: 'CalendarCheck', keywords: ['weekly', 'week'] },
      { id: 'monthly', label: 'Monthly', icon: 'Calendar', keywords: ['monthly', 'month'] },
    ],
  },
}

export { rankings, external }
