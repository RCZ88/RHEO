import type { PageManifest } from '../types'

/**
 * / — the Dashboard.
 *
 * Every `section` here matches one of the ten `data-section` values in
 * `DashboardPage.tsx` (Hero, Momentum Hero, Tier Breakdown, Pinned, Goals Card,
 * Focus Start, Deadlines Card, Longest Focus, Schedule, Insight Strip).
 *
 * The palette previously targeted `dash.summary` / `dash.timer` / `dash.activity`
 * — three ids that were never written to any `data-section`, so all three
 * scrolled to nothing after a 1.85s retry loop. Fixed by pointing at the real
 * anchors instead of inventing dotted ids.
 */
const dashboard: PageManifest = {
  id: 'dashboard',
  route: '/',
  label: 'Dashboard',
  icon: 'LayoutDashboard',
  group: 'Navigation',
  keywords: ['dashboard', 'home', 'overview', 'summary', 'today'],
  hint: 'Focus timer, heatmap, momentum and today’s cards',

  sections: [
    { id: 'Hero', label: 'Hero', icon: 'Home', keywords: ['hero', 'greeting', 'welcome', 'today'] },
    { id: 'Momentum Hero', label: 'Momentum Hero', icon: 'ChartLine', keywords: ['momentum', 'streak', 'score'] },
    { id: 'Tier Breakdown', label: 'Tier Breakdown', icon: 'Layers', keywords: ['tier', 'breakdown', 'category', 'productive'] },
    { id: 'Pinned', label: 'Pinned Activities', icon: 'Bookmark', keywords: ['pinned', 'apps', 'bookmarks'] },
    { id: 'Goals Card', label: 'Goals Card', icon: 'Target', keywords: ['goals', 'objectives'] },
    { id: 'Focus Start', label: 'Focus Start', icon: 'Play', keywords: ['focus', 'start', 'timer', 'pomodoro'] },
    { id: 'Deadlines Card', label: 'Deadlines Card', icon: 'Flag', keywords: ['deadlines', 'due', 'calendar'] },
    { id: 'Longest Focus', label: 'Longest Focus', icon: 'Trophy', keywords: ['longest', 'focus', 'record', 'best'] },
    { id: 'Schedule', label: 'Schedule', icon: 'Calendar', keywords: ['schedule', 'today', 'plan'] },
    { id: 'Insight Strip', label: 'Insight Strip', icon: 'Lightbulb', keywords: ['insight', 'strip', 'tips'] },
  ],

  find: {
    // The dashboard used to declare 10 hand-written segments via
    // `useSmartSearch`, whose unmount cleanup calls `smartSearchUnindexPage`
    // and therefore also wipes whatever the DOM harvester had just indexed for
    // the same pageId. Letting the harvester own the dashboard removes that
    // ordering conflict; curated segments belong on pages the harvester cannot
    // describe, not on the one page it describes perfectly.
    segments: [
      {
        id: 'dash-hero',
        title: 'Dashboard hero',
        text: 'Your focus dashboard — see today’s productivity at a glance, pick a task, and start focusing.',
        section: 'Hero',
        rank: 2.0,
      },
      {
        id: 'dash-heatmap',
        title: 'Activity heatmap',
        text: 'Hour-by-hour usage heatmap. Click any cell to drill into that hour’s detail.',
        rank: 1.6,
      },
      {
        id: 'dash-pinned',
        title: 'Pinned activities',
        text: 'Apps and websites you pinned for one-tap switching.',
        section: 'Pinned',
        rank: 1.2,
      },
      {
        id: 'dash-insights',
        title: 'Insight strip',
        text: 'Rolling insights drawn from your tracked time and tier assignments.',
        section: 'Insight Strip',
        rank: 1.2,
      },
    ],
  },

  tutorial: {
    id: 'dashboard',
    name: 'Dashboard',
    steps: [
      {
        target: '[data-tutorial="dash.heatmap"]',
        title: 'Activity Heatmap',
        instruction: '• Click any cell to drill into hourly data\n• Hover for exact usage minutes',
        position: 'bottom',
        type: 'action',
      },
      {
        target: '[data-tutorial="dash.focus"]',
        title: 'Focus timer',
        instruction: '• Start a focus session and pick which app counts as the reward\n• Sessions land in Activity → Focus',
        position: 'bottom',
        type: 'action',
      },
    ],
  },
}

export default dashboard
