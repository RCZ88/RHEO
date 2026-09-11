// ============================================================
// RHEO Dashboard — Widget Theme Map
// Per-widget identity: kicker label, accent token, detail route.
// LAMINAR §2: accents are real index.css tokens referenced by var().
// Chrome stays single-hue (page accent); accent applies ONLY to the
// widget's icon tile + hairline + hero numeral — one signal per card.
// LAMINAR §7: no raw hex/rgba in tsx. All values are var() refs.
// ============================================================

export interface WidgetTheme {
  /** Eyebrow label shown above the title (e.g. "TODAY", "SCHEDULE") */
  kicker: string;
  /** Accent token ref for icon tile + hairline + hero numeral */
  accent: string;
  /** Soft tint token ref for icon tile background (color-mix safe) */
  tint: string;
  /** Full-page route for "Open full view" */
  detailRoute: string;
  detailLabel: string;
}

const PAGE = 'var(--page-accent)';

export const WIDGET_THEMES: Record<string, WidgetTheme> = {
  'status-band': {
    kicker: 'NOW',
    accent: PAGE,
    tint: 'var(--accent-muted)',
    detailRoute: '/activity',
    detailLabel: 'Open live activity',
  },
  'schedule-hero': {
    kicker: 'SCHEDULE',
    accent: 'var(--color-amber-400)',
    tint: 'var(--warning-muted)',
    detailRoute: '/settings',
    detailLabel: 'Open schedule settings',
  },
  'insight-strip': {
    kicker: 'AI INSIGHTS',
    accent: 'var(--ws-accent)',
    tint: 'var(--info-muted)',
    detailRoute: '/insights',
    detailLabel: 'Open insights',
  },
  'goals-card': {
    kicker: 'TODAY',
    accent: PAGE,
    tint: 'var(--accent-muted)',
    detailRoute: '/goals',
    detailLabel: 'Open goals',
  },
  'deadlines-card': {
    kicker: 'DUE SOON',
    accent: 'var(--color-amber-400)',
    tint: 'var(--warning-muted)',
    detailRoute: '/goals',
    detailLabel: 'Open deadlines',
  },
  'focus-card': {
    kicker: 'DEEP WORK',
    accent: 'var(--success)',
    tint: 'var(--success-muted)',
    detailRoute: '/focus',
    detailLabel: 'Open focus',
  },
  'tier-breakdown': {
    kicker: 'TIME MIX',
    accent: PAGE,
    tint: 'var(--accent-muted)',
    detailRoute: '/stats',
    detailLabel: 'Open stats',
  },
  'pinned-activities': {
    kicker: 'PINNED',
    accent: 'var(--ws-accent)',
    tint: 'var(--info-muted)',
    detailRoute: '/external',
    detailLabel: 'Open activities',
  },
  'productivity-chart': {
    kicker: 'TREND',
    accent: 'var(--success)',
    tint: 'var(--success-muted)',
    detailRoute: '/stats',
    detailLabel: 'Open stats',
  },
  'sleep-bar': {
    kicker: 'RECOVERY',
    accent: 'var(--ws-accent)',
    tint: 'var(--info-muted)',
    detailRoute: '/external',
    detailLabel: 'Open sleep',
  },
  'mastery-ring': {
    kicker: 'LEARNING',
    accent: 'var(--success)',
    tint: 'var(--success-muted)',
    detailRoute: '/learn',
    detailLabel: 'Open learning',
  },
  'app-ecosystem': {
    kicker: 'ECOSYSTEM',
    accent: 'var(--ws-accent)',
    tint: 'var(--info-muted)',
    detailRoute: '/stats',
    detailLabel: 'Open stats',
  },
  'activity-feed': {
    kicker: 'RECENT',
    accent: PAGE,
    tint: 'var(--accent-muted)',
    detailRoute: '/activity',
    detailLabel: 'Open activity',
  },
  'momentum-hero': {
    kicker: 'MOMENTUM',
    accent: PAGE,
    tint: 'var(--accent-muted)',
    detailRoute: '/insights',
    detailLabel: 'Open insights',
  },
  'follow-through': {
    kicker: 'MONEY',
    accent: 'var(--success)',
    tint: 'var(--success-muted)',
    detailRoute: '/finance',
    detailLabel: 'Open finance',
  },
  'vcalendar': {
    kicker: 'CALENDAR',
    accent: 'var(--color-amber-400)',
    tint: 'var(--warning-muted)',
    detailRoute: '/settings',
    detailLabel: 'Open calendar',
  },
};

export function getWidgetTheme(id: string): WidgetTheme {
  return (
    WIDGET_THEMES[id] ?? {
      kicker: 'WIDGET',
      accent: PAGE,
      tint: 'var(--accent-muted)',
      detailRoute: '/dashboard',
      detailLabel: 'Open details',
    }
  );
}
