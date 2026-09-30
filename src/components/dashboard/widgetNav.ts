import type { WidgetId } from './widgetRegistry';

export interface WidgetNavTarget {
  /** Router path — MUST exist in src/App.tsx <Route path="..."> */
  route: string;
  /** DeepNav target section, must match a [data-section="..."] attribute on the target page */
  section?: string;
  /** Sub-tab of the target page (Life: covenant|gold|notes|schedule|habits|self|memories) */
  tab?: string;
  /** Short human label used in the button tooltip and aria-label */
  label: string;
  /** Shown on the button face when it has room (short forms only) */
  short?: string;
}

/**
 * CANONICAL widget -> origin-page map.
 *
 * Every dashboard widget MUST have an entry here. The dashboard renders a
 * real <button> from WIDGET_NAV[widgetId]; no entry means no button, which is
 * exactly the regression this map exists to prevent.
 *
 * Route validity is enforced against the route table in src/App.tsx.
 * Previously the dashboard hard-coded these inline and 5 of them were dead:
 *   /lyceum, /browser-history, /context-brain, /covenant, /terminal/tabs/console
 * -> all fell through to NotFoundPage. They are now remapped to live routes.
 */
export const WIDGET_NAV: Record<WidgetId, WidgetNavTarget> = {
  // ── Row 1: hero band ───────────────────────────────────────────────
  'status-band':       { route: '/activity', tab: 'focus', section: 'activity.focus',        label: 'Focus sessions',  short: 'Focus' },
  momentum:            { route: '/activity', tab: 'productivity', section: 'activity.productivity', label: 'Productivity', short: 'Prod' },
  // ── Row 2 ──────────────────────────────────────────────────────────
  'tier-breakdown':    { route: '/activity', tab: 'apps', section: 'activity.apps',           label: 'App breakdown' },
  // ── Row 3 ──────────────────────────────────────────────────────────
  'pinned-activities': { route: '/activity', tab: 'focus', section: 'activity.focus',         label: 'Activity log' },
  // ── Row 4 ──────────────────────────────────────────────────────────
  goals:               { route: '/life',    tab: 'gold',                       label: 'Goals' },
  'quick-focus':       { route: '/activity', tab: 'focus', section: 'activity.focus',         label: 'Focus sessions',  short: 'Focus' },
  deadlines:           { route: '/life',    tab: 'habits',                     label: 'Habits & streaks' },
  'longest-focus':     { route: '/rankings',                                  label: 'Rankings' },
  // ── Row 5 ──────────────────────────────────────────────────────────
  schedule:            { route: '/life',    tab: 'schedule',                   label: 'Schedule' },
  insights:            { route: '/reports', section: 'insights.recap',          label: 'Insights' },
  // ── Row 6 ──────────────────────────────────────────────────────────
  'productivity-chart':{ route: '/activity', tab: 'productivity', section: 'activity.productivity', label: 'Productivity' },
  // ── Row 7 ──────────────────────────────────────────────────────────
  'recent-sessions':   { route: '/activity', tab: 'apps', section: 'activity.apps',           label: 'Session history' },
  // ── Rows 8-9: stat widgets ─────────────────────────────────────────
  'ai-usage':          { route: '/ai',                                        label: 'AI' },
  'console-widget':    { route: '/terminal',                                  label: 'Console' },
  'finance-widget':    { route: '/finance', section: 'finance.overview',       label: 'Finance' },
  'learn-widget':      { route: '/learn',                                     label: 'Learn' },
  'browser-widget':    { route: '/activity', tab: 'websites', section: 'activity.websites',   label: 'Websites' },
  'brain-widget':      { route: '/life',    tab: 'self',                       label: 'Context Brain' },
  'covenant-widget':   { route: '/life',    tab: 'covenant',                   label: 'Covenant' },
  'health-widget':     { route: '/external',                                  label: 'Health & sleep' },
};

/** True when the widget has a real destination to jump to. */
export function hasWidgetNav(id: string): boolean {
  return Boolean((WIDGET_NAV as Record<string, WidgetNavTarget>)[id]?.route);
}

/** Dev guard: returns the widget ids that would render a dead button. */
export function findWidgetsMissingNav(ids: readonly string[]): string[] {
  return ids.filter((id) => !hasWidgetNav(id));
}
