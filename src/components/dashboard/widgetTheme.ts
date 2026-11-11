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

  // ── v2: identity for every registry id that used to fall through to the
  // generic gray "WIDGET" theme — the reason the Card Library read as a wall of
  // identical tiles. Accents mirror each widget's real dashboard glow
  // (WIDGET_META.accent in widgetRegistry.tsx), expressed as index.css palette
  // vars so both themes resolve. Tints are color-mix of the same hue.
  'notes-card': {
    kicker: 'NOTES',
    accent: 'var(--color-violet-400)',
    tint: 'color-mix(in srgb, var(--color-violet-400) 14%, transparent)',
    detailRoute: '/life',
    detailLabel: 'Open notes',
  },
  'quick-focus': {
    kicker: 'DEEP WORK',
    accent: 'var(--color-rose-400)',
    tint: 'color-mix(in srgb, var(--color-rose-400) 14%, transparent)',
    detailRoute: '/activity',
    detailLabel: 'Open focus',
  },
  'schedule': {
    kicker: 'SCHEDULE',
    accent: 'var(--color-pink-400)',
    tint: 'color-mix(in srgb, var(--color-pink-400) 14%, transparent)',
    detailRoute: '/settings',
    detailLabel: 'Open schedule',
  },
  'insights': {
    kicker: 'AI INSIGHTS',
    accent: 'var(--color-cyan-400)',
    tint: 'color-mix(in srgb, var(--color-cyan-400) 14%, transparent)',
    detailRoute: '/insights',
    detailLabel: 'Open insights',
  },
  'recent-sessions': {
    kicker: 'RECENT',
    accent: 'var(--text-muted)',
    tint: 'color-mix(in srgb, var(--text-muted) 14%, transparent)',
    detailRoute: '/activity',
    detailLabel: 'Open activity',
  },
  'longest-focus': {
    kicker: 'PERSONAL BEST',
    accent: 'var(--color-cyan-400)',
    tint: 'color-mix(in srgb, var(--color-cyan-400) 14%, transparent)',
    detailRoute: '/activity',
    detailLabel: 'Open rankings',
  },
  'ai-usage': {
    kicker: 'AI',
    accent: 'var(--color-violet-400)',
    tint: 'color-mix(in srgb, var(--color-violet-400) 14%, transparent)',
    detailRoute: '/ai',
    detailLabel: 'Open AI deck',
  },
  'console-widget': {
    kicker: 'CONSOLE',
    accent: 'var(--color-cyan-400)',
    tint: 'color-mix(in srgb, var(--color-cyan-400) 14%, transparent)',
    detailRoute: '/penguin-console',
    detailLabel: 'Open console',
  },
  'finance-widget': {
    kicker: 'WALLET',
    accent: 'var(--color-emerald-400)',
    tint: 'color-mix(in srgb, var(--color-emerald-400) 14%, transparent)',
    detailRoute: '/finance',
    detailLabel: 'Open finance',
  },
  'learn-widget': {
    kicker: 'LYCEUM',
    accent: 'var(--color-amber-400)',
    tint: 'color-mix(in srgb, var(--color-amber-400) 14%, transparent)',
    detailRoute: '/learn',
    detailLabel: 'Open learn',
  },
  'browser-widget': {
    kicker: 'BROWSER',
    accent: 'var(--color-blue-400)',
    tint: 'color-mix(in srgb, var(--color-blue-400) 14%, transparent)',
    detailRoute: '/activity',
    detailLabel: 'Open browser activity',
  },
  'brain-widget': {
    kicker: 'BRAIN',
    accent: 'var(--color-purple-400)',
    tint: 'color-mix(in srgb, var(--color-purple-400) 14%, transparent)',
    detailRoute: '/ai',
    detailLabel: 'Open context brain',
  },
  'covenant-widget': {
    kicker: 'COVENANT',
    accent: 'var(--color-orange-400)',
    tint: 'color-mix(in srgb, var(--color-orange-400) 14%, transparent)',
    detailRoute: '/life',
    detailLabel: 'Open covenant',
  },
  'health-widget': {
    kicker: 'HEALTH',
    accent: 'var(--color-green-400)',
    tint: 'color-mix(in srgb, var(--color-green-400) 14%, transparent)',
    detailRoute: '/life',
    detailLabel: 'Open health',
  },
  'daily-survey': {
    kicker: 'CHECK-IN',
    accent: 'var(--color-violet-400)',
    tint: 'color-mix(in srgb, var(--color-violet-400) 14%, transparent)',
    detailRoute: '/life',
    detailLabel: 'Open daily survey',
  },
  'unified-goals': {
    kicker: 'GOALS',
    accent: 'var(--color-emerald-400)',
    tint: 'color-mix(in srgb, var(--color-emerald-400) 14%, transparent)',
    detailRoute: '/goals',
    detailLabel: 'Open goals',
  },
  'streak': {
    kicker: 'STREAKS',
    accent: 'var(--color-orange-400)',
    tint: 'color-mix(in srgb, var(--color-orange-400) 14%, transparent)',
    detailRoute: '/goals',
    detailLabel: 'Open streaks',
  },
  'schedule-sync': {
    kicker: 'SYNC',
    accent: 'var(--color-blue-400)',
    tint: 'color-mix(in srgb, var(--color-blue-400) 14%, transparent)',
    detailRoute: '/settings',
    detailLabel: 'Open schedule sync',
  },
  'drilldown': {
    kicker: 'DRILL DOWN',
    accent: 'var(--color-pink-400)',
    tint: 'color-mix(in srgb, var(--color-pink-400) 14%, transparent)',
    detailRoute: '/insights',
    detailLabel: 'Open drill-down',
  },
  'spotlight': {
    kicker: 'SPOTLIGHT',
    accent: 'var(--color-amber-400)',
    tint: 'color-mix(in srgb, var(--color-amber-400) 14%, transparent)',
    detailRoute: '/insights',
    detailLabel: 'Open spotlight',
  },
  'momentum-orb': {
    kicker: 'ORB',
    accent: 'var(--color-purple-400)',
    tint: 'color-mix(in srgb, var(--color-purple-400) 14%, transparent)',
    detailRoute: '/insights',
    detailLabel: 'Open momentum orb',
  },
  'momentum-score': {
    kicker: 'SCORE',
    accent: 'var(--color-indigo-400)',
    tint: 'color-mix(in srgb, var(--color-indigo-400) 14%, transparent)',
    detailRoute: '/insights',
    detailLabel: 'Open momentum score',
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
