// ============================================================
// RHEO Dashboard — Widget Registration
// Registers all existing dashboard widgets into the registry
// ============================================================

import { WidgetRegistry } from './WidgetRegistry';
import {
  StatusBandSummary,
  ScheduleSummary,
  InsightsSummary,
  GoalsSummary,
  DeadlinesSummary,
  FocusSummary,
  TierBreakdownSummary,
  PinnedActivitiesSummary,
  ProductivityChartSummary,
  SleepSummary,
  MasterySummary,
  ActivityFeedSummary,
  MomentumSummary,
  FollowThroughSummary,
  CalendarSummary,
} from './WidgetSummaries';
import { AiUsageWidget } from './AiUsageWidget';
import { ConsoleWidget } from './ConsoleWidget';
import { FinanceWidget } from './FinanceWidget';
import { LearnWidget } from './LearnWidget';
import { BrowserWidget } from './BrowserWidget';
import { BrainWidget } from './BrainWidget';
import { CovenantWidget } from './CovenantWidget';
import { HealthWidget } from './HealthWidget';

// ── Dashboard Widgets ──
WidgetRegistry.register({
  id: 'status-band',
  name: 'Status Band',
  description: 'Timer, productivity score, and streak badges',
  icon: 'Activity',
  category: 'productivity',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: StatusBandSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'schedule-hero',
  name: 'Schedule Hero',
  description: 'Current schedule block and upcoming timeline',
  icon: 'Calendar',
  category: 'schedule',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: ScheduleSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'insight-strip',
  name: 'AI Insights',
  description: 'Horizontal scrollable AI insight cards',
  icon: 'Sparkles',
  category: 'insights',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: InsightsSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'goals-card',
  name: 'Goals',
  description: 'Today\'s goals with checkbox completion',
  icon: 'Target',
  category: 'productivity',
  defaultSize: { cols: 1, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: GoalsSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'deadlines-card',
  name: 'Deadlines',
  description: 'Upcoming deadlines with urgency badges',
  icon: 'AlertCircle',
  category: 'schedule',
  defaultSize: { cols: 1, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: DeadlinesSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'focus-card',
  name: 'Deep Focus',
  description: 'Focus progress ring and session controls',
  icon: 'Zap',
  category: 'productivity',
  defaultSize: { cols: 1, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 1, rows: 1 },
  component: FocusSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'tier-breakdown',
  name: 'Tier Breakdown',
  description: 'Productive/Neutral/Distracting time stats',
  icon: 'BarChart3',
  category: 'productivity',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: TierBreakdownSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'pinned-activities',
  name: 'Pinned Activities',
  description: 'Horizontal scroll of pinned activity pills',
  icon: 'Pin',
  category: 'productivity',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: PinnedActivitiesSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'productivity-chart',
  name: 'Productivity Chart',
  description: 'Stacked bar chart of daily productivity',
  icon: 'BarChart3',
  category: 'productivity',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: ProductivityChartSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'sleep-bar',
  name: 'Sleep',
  description: 'Weekly sleep bar chart with deficit indicator',
  icon: 'Moon',
  category: 'health',
  defaultSize: { cols: 1, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 1, rows: 1 },
  component: SleepSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'mastery-ring',
  name: 'Mastery',
  description: 'SVG mastery progress ring with gradient stroke',
  icon: 'Brain',
  category: 'learn',
  defaultSize: { cols: 1, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 1, rows: 1 },
  component: MasterySummary,
  defaultVisible: false,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'app-ecosystem',
  name: 'App Ecosystem',
  description: 'Compact orbit visualization of app usage',
  icon: 'Orbit',
  category: 'insights',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: () => null, // OrbitSystem is preserved untouched
  defaultVisible: false,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'activity-feed',
  name: 'Recent Sessions',
  description: 'Scrollable list of recent activity sessions',
  icon: 'Clock',
  category: 'insights',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: ActivityFeedSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'momentum-hero',
  name: 'Momentum',
  description: 'Momentum score visualization with trend',
  icon: 'Flame',
  category: 'insights',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: MomentumSummary,
  defaultVisible: true,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'follow-through',
  name: 'Follow Through',
  description: 'Finance follow-through summary card',
  icon: 'ArrowRight',
  category: 'finance',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: FollowThroughSummary,
  defaultVisible: false,
  sourcePage: 'dashboard',
});

WidgetRegistry.register({
  id: 'vcalendar',
  name: 'Calendar',
  description: 'Mini calendar date selector',
  icon: 'CalendarDays',
  category: 'schedule',
  defaultSize: { cols: 1, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 1, rows: 1 },
  component: CalendarSummary,
  defaultVisible: false,
  sourcePage: 'dashboard',
});

// ── New Widgets (8) ──
WidgetRegistry.register({
  id: 'ai-usage', name: 'AI Usage', description: 'Model usage stats and token consumption',
  icon: 'Bot', category: 'system',
  defaultSize: { cols: 4, rows: 2 }, minSize: { cols: 3, rows: 1 }, maxSize: { cols: 6, rows: 3 },
  component: AiUsageWidget, defaultVisible: true, sourcePage: 'ai',
});
WidgetRegistry.register({
  id: 'console-widget', name: 'Console', description: 'Terminal command usage and handbook progress',
  icon: 'Terminal', category: 'system',
  defaultSize: { cols: 4, rows: 2 }, minSize: { cols: 3, rows: 1 }, maxSize: { cols: 6, rows: 3 },
  component: ConsoleWidget, defaultVisible: true, sourcePage: 'terminal',
});
WidgetRegistry.register({
  id: 'finance-widget', name: 'Finance', description: 'Wallet balances and transaction overview',
  icon: 'Wallet', category: 'finance',
  defaultSize: { cols: 4, rows: 2 }, minSize: { cols: 3, rows: 1 }, maxSize: { cols: 6, rows: 3 },
  component: FinanceWidget, defaultVisible: true, sourcePage: 'finance',
});
WidgetRegistry.register({
  id: 'learn-widget', name: 'Learn', description: 'Lyceum lesson progress and mastery',
  icon: 'BookOpen', category: 'learn',
  defaultSize: { cols: 3, rows: 2 }, minSize: { cols: 2, rows: 1 }, maxSize: { cols: 4, rows: 2 },
  component: LearnWidget, defaultVisible: true, sourcePage: 'lyceum',
});
WidgetRegistry.register({
  id: 'browser-widget', name: 'Browser', description: 'Website categories and tracking',
  icon: 'Globe', category: 'system',
  defaultSize: { cols: 3, rows: 2 }, minSize: { cols: 2, rows: 1 }, maxSize: { cols: 4, rows: 2 },
  component: BrowserWidget, defaultVisible: true, sourcePage: 'browser',
});
WidgetRegistry.register({
  id: 'brain-widget', name: 'Brain', description: 'Context Brain knowledge graph stats',
  icon: 'Brain', category: 'system',
  defaultSize: { cols: 3, rows: 2 }, minSize: { cols: 2, rows: 1 }, maxSize: { cols: 4, rows: 2 },
  component: BrainWidget, defaultVisible: true, sourcePage: 'ai',
});
WidgetRegistry.register({
  id: 'covenant-widget', name: 'Covenant', description: 'Commitments and completion',
  icon: 'Shield', category: 'system',
  defaultSize: { cols: 3, rows: 2 }, minSize: { cols: 2, rows: 1 }, maxSize: { cols: 4, rows: 2 },
  component: CovenantWidget, defaultVisible: true, sourcePage: 'covenant',
});
WidgetRegistry.register({
  id: 'health-widget', name: 'Health', description: 'Sleep hours and consistency',
  icon: 'Moon', category: 'health',
  defaultSize: { cols: 6, rows: 2 }, minSize: { cols: 4, rows: 1 }, maxSize: { cols: 8, rows: 3 },
  component: HealthWidget, defaultVisible: true, sourcePage: 'external',
});
