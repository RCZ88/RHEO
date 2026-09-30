import type { ComponentType } from 'react';

export type WidgetId =
  | 'status-band' | 'momentum' | 'tier-breakdown' | 'pinned-activities'
  | 'goals' | 'quick-focus' | 'deadlines' | 'longest-focus'
  | 'schedule' | 'insights' | 'productivity-chart' | 'recent-sessions'
  | 'ai-usage' | 'console-widget' | 'finance-widget' | 'learn-widget'
  | 'browser-widget' | 'brain-widget' | 'covenant-widget' | 'health-widget'
  | 'daily-survey' | 'unified-goals' | 'drilldown' | 'spotlight'
  | 'streak' | 'schedule-sync' | 'momentum-orb' | 'momentum-score';

export interface WidgetMeta {
  id: WidgetId;
  name: string;
  description: string;
  /** neon accent used in the preview tile — mirrors the card's real glow color */
  accent: string;
  /* locked widgets cannot be hidden (core stopwatch) */
  locked?: boolean;
}

/** Preview fraction of the 12-col grid and relative height unit — MUST mirror DashboardPage */
export interface CellSpec { id: WidgetId; w: number; h: number }
export interface RowTemplate { key: string; cells: CellSpec[]; breakpointCols: number }

export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  'status-band':        { id: 'status-band',        name: 'Focus Stopwatch',      description: 'Live timer with neon tier glow',            accent: '#34d399', locked: true },
  momentum:             { id: 'momentum',           name: 'Daily Momentum',       description: 'Score, streak and breakdown',              accent: '#ec4899' },
  'tier-breakdown':     { id: 'tier-breakdown',     name: 'Tier Breakdown',       description: 'Time split across app categories',         accent: '#fbbf24' },
  'pinned-activities':  { id: 'pinned-activities',  name: 'Pinned Activities',    description: 'Your pinned focus sessions',               accent: '#a855f7' },
  goals:                { id: 'goals',              name: 'Goals',                description: "Today's goal completion",                  accent: '#8b5cf6' },
  'quick-focus':        { id: 'quick-focus',        name: 'Quick Focus',          description: 'One-tap focus launcher',                   accent: '#f43f5e' },
  deadlines:            { id: 'deadlines',          name: 'Deadlines',            description: 'Upcoming due dates',                       accent: '#fbbf24' },
  'longest-focus':      { id: 'longest-focus',      name: 'Longest Focus',        description: 'Personal best session',                    accent: '#22d3ee' },
  schedule:             { id: 'schedule',           name: 'Schedule',             description: "Today's planned blocks",                   accent: '#ec4899' },
  insights:             { id: 'insights',           name: 'Insights',             description: 'AI daily insight strip',                   accent: '#22d3ee' },
  'productivity-chart': { id: 'productivity-chart', name: 'Productivity Chart',   description: 'Weekly focus distribution',                accent: '#34d399' },
  'recent-sessions':    { id: 'recent-sessions',    name: 'Recent Sessions',      description: 'Latest tracked activity feed',             accent: '#71717a' },
  'ai-usage':           { id: 'ai-usage',           name: 'AI Usage',             description: 'AI model and tool usage stats',            accent: '#a78bfa' },
  'console-widget':     { id: 'console-widget',     name: 'Console',              description: 'Terminal and logs output',                 accent: '#22d3ee' },
  'finance-widget':     { id: 'finance-widget',     name: 'Finance',              description: 'Budget and expense tracking',              accent: '#34d399' },
  'learn-widget':       { id: 'learn-widget',       name: 'Learn',                description: 'Lessons and knowledge base',               accent: '#fbbf24' },
  'browser-widget':     { id: 'browser-widget',     name: 'Browser',              description: 'Browser history and activity',             accent: '#60a5fa' },
  'brain-widget':       { id: 'brain-widget',       name: 'Brain',                description: 'Context brain visualization',              accent: '#c084fc' },
  'covenant-widget':    { id: 'covenant-widget',    name: 'Covenant',             description: 'Pledge and habit tracking',                accent: '#fb923c' },
  'health-widget':      { id: 'health-widget',      name: 'Health',               description: 'Sleep and wellness tracking',              accent: '#4ade80' },

  // ── Library-only opt-in widgets (never auto-placed on the dashboard) ──
  'daily-survey':   { id: 'daily-survey',   name: 'Daily Survey',          description: 'End-of-day check-in prompts',               accent: '#a78bfa' },
  'unified-goals':  { id: 'unified-goals',  name: 'Unified Goals',         description: 'Goals and long-term goals in one view',     accent: '#34d399' },
  'streak':         { id: 'streak',         name: 'Streaks',               description: 'Goal streaks and milestones',               accent: '#fb923c' },
  'schedule-sync':  { id: 'schedule-sync',  name: 'Schedule Sync',         description: 'Schedule entries matched to goals',         accent: '#60a5fa' },
  'drilldown':      { id: 'drilldown',      name: 'Drill Down',            description: 'Heatmap and ecosystem drill-down',         accent: '#f472b6' },
  'spotlight':      { id: 'spotlight',      name: 'Spotlight',             description: 'Focused highlight panel',                  accent: '#fbbf24' },
  'momentum-orb':   { id: 'momentum-orb',   name: 'Momentum Orb',          description: 'Animated momentum visualization',           accent: '#c084fc' },
  'momentum-score': { id: 'momentum-score', name: 'Momentum Score',        description: 'Momentum score breakdown',                  accent: '#818cf8' },
};

/** THE ROW TEMPLATES — 1:1 mirror of DashboardPage geometry. w = fr share, h = height unit. */
export const ROW_TEMPLATES: RowTemplate[] = [
  { key: 'row-1', breakpointCols: 12, cells: [
    { id: 'status-band', w: 8, h: 1.0 },
    { id: 'momentum',    w: 4, h: 1.0 },
  ]},
  { key: 'row-2', breakpointCols: 12, cells: [{ id: 'tier-breakdown', w: 12, h: 0.28 }] },
  { key: 'row-3', breakpointCols: 12, cells: [{ id: 'pinned-activities', w: 12, h: 0.9 }] },
  { key: 'row-4', breakpointCols: 4,  cells: [
    { id: 'goals',         w: 1, h: 0.85 },
    { id: 'quick-focus',   w: 1, h: 0.85 },
    { id: 'deadlines',     w: 1, h: 0.85 },
    { id: 'longest-focus', w: 1, h: 0.85 },
  ]},
  { key: 'row-5', breakpointCols: 12, cells: [
    { id: 'schedule', w: 8, h: 0.8 },
    { id: 'insights', w: 4, h: 0.8 },
  ]},
  { key: 'row-6', breakpointCols: 12, cells: [{ id: 'productivity-chart', w: 12, h: 1.0 }] },
  { key: 'row-7', breakpointCols: 12, cells: [{ id: 'recent-sessions', w: 12, h: 0.9 }] },
  { key: 'row-8', breakpointCols: 4, cells: [
    { id: 'ai-usage',       w: 1, h: 0.85 },
    { id: 'console-widget', w: 1, h: 0.85 },
    { id: 'finance-widget', w: 1, h: 0.85 },
    { id: 'learn-widget',   w: 1, h: 0.85 },
  ]},
  { key: 'row-9', breakpointCols: 4, cells: [
    { id: 'browser-widget', w: 1, h: 0.85 },
    { id: 'brain-widget',   w: 1, h: 0.85 },
    { id: 'covenant-widget', w: 1, h: 0.85 },
    { id: 'health-widget',  w: 1, h: 0.85 },
  ]},
];

/**
 * LIBRARY-ONLY widgets — the 8 components that were written but never wired to a
 * dashboard row. They are deliberately NOT in ROW_TEMPLATES: that means the
 * dashboard never places them for you. They are listed in the Card Library so
 * you can switch them on yourself, and they render only once you do.
 *
 * `w` is the 12-column share and `h` the height unit used when they are shown.
 */
export const OPT_IN_WIDGETS: { id: WidgetId; w: number; h: number }[] = [
  { id: 'daily-survey',   w: 4,  h: 0.85 },
  { id: 'unified-goals',  w: 8,  h: 0.85 },
  { id: 'streak',         w: 4,  h: 0.85 },
  { id: 'schedule-sync',  w: 8,  h: 0.85 },
  { id: 'drilldown',      w: 4,  h: 0.85 },
  { id: 'spotlight',      w: 4,  h: 0.85 },
  { id: 'momentum-orb',   w: 4,  h: 0.85 },
  { id: 'momentum-score', w: 4,  h: 0.85 },
];

/** Every id the layout system accepts — default rows PLUS the opt-in set. */
export const ALL_WIDGET_IDS: WidgetId[] = [
  ...ROW_TEMPLATES.flatMap(r => r.cells.map(c => c.id)),
  ...OPT_IN_WIDGETS.map(o => o.id),
];

/** Opt-in ids, for callers that need to treat them as "not placed by default". */
export const OPT_IN_WIDGET_IDS: WidgetId[] = OPT_IN_WIDGETS.map(o => o.id);

/**
 * The widget library (CardLibrary / WidgetRegistry) and the dashboard renderer
 * (useDashboardLayout) were built against TWO different id schemes, so only 12 of
 * 24 widgets actually toggled. The 8 below are the library's names for widgets
 * the dashboard renders under a different id. Map library id -> dashboard id.
 *
 * Anything NOT in this map has no dashboard equivalent and cannot be rendered;
 * useDashboardLayout treats those as opt-in so they can never appear uninvited.
 */
export const WIDGET_ID_ALIAS: Record<string, WidgetId> = {
  'momentum-hero':   'momentum',
  'schedule-hero':   'schedule',
  'goals-card':      'goals',
  'deadlines-card':  'deadlines',
  'focus-card':      'quick-focus',
  'insight-strip':   'insights',
  'activity-feed':   'recent-sessions',
  'sleep-bar':       'health-widget',
};

/** Library id -> dashboard id, or null when there is nothing to render. */
export const toDashboardId = (id: string): WidgetId | null => {
  if ((ALL_WIDGET_IDS as string[]).includes(id)) return id as WidgetId;
  return WIDGET_ID_ALIAS[id] ?? null;
};
