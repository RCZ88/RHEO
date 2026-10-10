import type { PageManifest } from '../types'

/**
 * /reports — the Insights page: Day, Weekly, Activity, Recap, Rankings.
 *
 * **This page had no tab persistence at all.** `InsightsPage` reads neither
 * `location.state.tab` nor any localStorage hint, so `deepNav` wrote
 * `insights-activeTab` into the void and EVERY palette entry — all twelve of
 * them — landed on the default `typical`/Day tab and then scrolled to a section
 * that was not mounted. That is the whole reason "navigating the Recap
 * subsections doesn't work".
 *
 * Fix is two-part and both halves are necessary:
 *   1. `storageKey`/`stateKey` here, so the hint has a name.
 *   2. `InsightsPage.tsx` must actually read it (see the note in that file).
 *
 * The ten nested `insights.recap.*` anchors are declared as sections of the
 * recap tab, not as tabs, because they are panels inside Recap rather than
 * peers of it.
 */
const reports: PageManifest = {
  id: 'reports',
  route: '/reports',
  label: 'Reports & Insights',
  icon: 'PieChart',
  group: 'Navigation',
  keywords: ['reports', 'insights', 'analysis', 'recap', 'summary', 'patterns'],

  tabs: {
    variable: 'activeTab',
    stateKey: 'tab',
    storageKey: 'insights-activeTab',
    default: 'typical',
    items: [
      { id: 'typical', label: 'Typical Day', icon: 'Sun', section: 'insights.day', keywords: ['typical', 'day', 'heatmap', 'hours', 'routine'] },
      { id: 'weekly', label: 'Weekly', icon: 'Calendar', section: 'insights.weekly', keywords: ['weekly', 'trend', 'pattern', 'week'] },
      { id: 'activities', label: 'Activities', icon: 'Activity', section: 'insights.activities', keywords: ['activities', 'breakdown', 'sessions'] },
      {
        id: 'recap',
        label: 'Daily Recap',
        icon: 'Calendar',
        section: 'insights.recap',
        keywords: ['recap', 'daily', 'groupings', 'venn', 'summary'],
      },
      { id: 'rankings', label: 'Rankings', icon: 'Trophy', keywords: ['rankings', 'leaderboard', 'top', 'best'] },
    ],
  },

  sections: [
    { id: 'insights.recap.top-apps', label: 'Recap — Top Apps', icon: 'Monitor', keywords: ['recap', 'top apps', 'most used', 'app time'] },
    { id: 'insights.recap.category-distribution', label: 'Recap — Category Distribution', icon: 'PieChart', keywords: ['recap', 'categories', 'category distribution'] },
    { id: 'insights.recap.productivity', label: 'Recap — Productivity', icon: 'Zap', keywords: ['recap', 'productive', 'distracting', 'tier'] },
    { id: 'insights.recap.sleep', label: 'Recap — Sleep', icon: 'Moon', keywords: ['recap', 'sleep', 'hours', 'deficit'] },
    { id: 'insights.recap.browser', label: 'Recap — Browser', icon: 'Globe', keywords: ['recap', 'browser', 'web', 'sites'] },
    { id: 'insights.recap.external', label: 'Recap — External', icon: 'Clock', keywords: ['recap', 'external', 'offline'] },
    { id: 'insights.recap.days', label: 'Recap — Day by Day', icon: 'Calendar', keywords: ['recap', 'daily summary', 'each day'] },
    { id: 'insights.recap.venn', label: 'Recap — Grouping Overlap', icon: 'Circle', keywords: ['recap', 'venn', 'overlap', 'groupings'] },
    { id: 'insights.recap.summary', label: 'Recap — Summary', icon: 'ChartLine', keywords: ['recap', 'consistency', 'streak', 'best day'] },
    { id: 'insights.recap.sleep-trend', label: 'Recap — Sleep Trend', icon: 'ChartLine', keywords: ['recap', 'sleep trend', 'chart'] },
  ],
}

export default reports