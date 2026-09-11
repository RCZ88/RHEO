/**
 * PageContextRegistry - Maps each app page route to its data sources.
 * Used by assemble-context IPC to inject page-specific context into agent sessions.
 */

export interface PageContextProvider {
  name: string;
  description: string;
  queryFn: string;
}

export interface PageContextEntry {
  route: string;
  name: string;
  description: string;
  contextProviders: PageContextProvider[];
  keyComponents: string[];
}

export const PAGE_CONTEXT_REGISTRY: Record<string, PageContextEntry> = {
  '/': {
    route: '/', name: 'dashboard',
    description: 'Main overview: timer, recent sessions, activity feed, weekly overview, gaps.',
    contextProviders: [
      { name: 'Recent Problems', description: 'Latest workspace problems', queryFn: 'SELECT id, title, status, priority FROM workspace_problems ORDER BY created_at DESC LIMIT 5' },
      { name: 'Recent Requests', description: 'Latest workspace requests', queryFn: 'SELECT id, title, status, priority FROM workspace_requests ORDER BY created_at DESC LIMIT 5' },
      { name: 'Recent Sessions', description: 'Latest terminal sessions', queryFn: "SELECT topic, agent, status FROM terminal_sessions ORDER BY created_at DESC LIMIT 5" },
    ],
    keyComponents: ['DashboardPage', 'StopwatchTimer', 'RecentSessionsCard', 'WeeklyOverview'],
  },
  '/finance': {
    route: '/finance', name: 'finance',
    description: 'Financial tracking: transactions, budgets, wallets, subscriptions, receivables.',
    contextProviders: [
      { name: 'Wallets', description: 'Current wallet balances', queryFn: 'SELECT name, balance, currency FROM finance_wallets WHERE is_archived = 0' },
      { name: 'Budgets', description: 'Active budget limits', queryFn: 'SELECT name, amount, period FROM finance_budgets WHERE is_active = 1' },
      { name: 'Recent Transactions', description: 'Last 5 transactions', queryFn: 'SELECT description, amount, type FROM finance_transactions ORDER BY timestamp DESC LIMIT 5' },
    ],
    keyComponents: ['FinancePage', 'BudgetOverview', 'WalletCard', 'SubscriptionsView'],
  },
  '/external': {
    route: '/external', name: 'external',
    description: 'External activity tracking: sleep, manual time, gaps, activity grid.',
    contextProviders: [
      { name: 'Recent External Sessions', description: 'Recent external sessions', queryFn: "SELECT type, start_time, end_time FROM external_sessions ORDER BY start_time DESC LIMIT 5" },
    ],
    keyComponents: ['ExternalPage', 'SleepPatternsCard', 'ActivityGrid', 'GapFillDrawer'],
  },
  '/life': {
    route: '/life', name: 'life',
    description: 'Life phases, memories, gold goals, covenant commitments, notes.',
    contextProviders: [
      { name: 'Life Phases', description: 'Current and recent life phases', queryFn: 'SELECT title, category, start_year, end_year FROM life_phases ORDER BY start_year DESC LIMIT 5' },
    ],
    keyComponents: ['LifePage', 'CoreSample', 'PhaseCard', 'CommitmentCard'],
  },
  '/learn': {
    route: '/learn', name: 'learn',
    description: 'Learning progress, mastered concepts, and active lessons.',
    contextProviders: [
      { name: 'Mastered Nodes', description: 'Recently mastered learning nodes', queryFn: "SELECT n.title, p.level, p.stability FROM learn_progress p JOIN learn_nodes n ON n.id = p.node_id WHERE p.level IN ('L2','L3','L4','L5') ORDER BY p.stability DESC LIMIT 5" },
      { name: 'In Progress', description: 'Currently learning nodes', queryFn: "SELECT n.title, p.level FROM learn_progress p JOIN learn_nodes n ON n.id = p.node_id WHERE p.level IN ('L0','L1') ORDER BY p.last_seen DESC LIMIT 5" },
    ],
    keyComponents: ['LearnPage', 'MasteryCard', 'CurriculumView'],
  },
  '/ide': {
    route: '/ide', name: 'ide',
    description: 'IDE projects, codebases, AI tools usage, code activity.',
    contextProviders: [
      { name: 'Active Projects', description: 'Recently opened projects', queryFn: 'SELECT name, path, primary_language FROM projects ORDER BY last_activity_at DESC LIMIT 5' },
    ],
    keyComponents: ['IDEProjectsPage', 'AIToolsTab', 'AnalyticsDashboard'],
  },
  '/ai': {
    route: '/ai', name: 'ai',
    description: 'AI Assistant configurations, agent sessions, and context brain.',
    contextProviders: [
      { name: 'Active Agents', description: 'Recent agent sessions', queryFn: "SELECT topic, agent, status FROM terminal_sessions WHERE agent IS NOT NULL ORDER BY created_at DESC LIMIT 5" },
    ],
    keyComponents: ['AiPage', 'AgentCard', 'AiContextPanel'],
  },
  '/activity': {
    route: '/activity', name: 'activity',
    description: 'Chronological log of workspace events and user actions.',
    contextProviders: [
      { name: 'Recent Events', description: 'Latest activity log entries', queryFn: 'SELECT action, entity_type, created_at FROM activity_log ORDER BY created_at DESC LIMIT 10' },
    ],
    keyComponents: ['StatsPage', 'BrowserActivityPage', 'ProductivityPage'],
  },
  '/studio': { route: '/studio', name: 'studio', description: 'Feature Studio for building custom features.', contextProviders: [], keyComponents: ['DesignWorkspacePage', 'FeatureStudioPage'] },
  '/resume': { route: '/resume', name: 'resume', description: 'Resume builder and professional experience.', contextProviders: [], keyComponents: ['ResumeBuilderPage'] },
  '/reports': { route: '/reports', name: 'reports', description: 'Insights, analytics, and generated reports.', contextProviders: [], keyComponents: ['InsightsPage'] },
  '/database': { route: '/database', name: 'database', description: 'Database schema viewer and raw data explorer.', contextProviders: [], keyComponents: ['DatabasePage'] },
  '/settings': { route: '/settings', name: 'settings', description: 'Application preferences and system configurations.', contextProviders: [], keyComponents: ['SettingsPage'] },
  '/guide': { route: '/guide', name: 'guide', description: 'Documentation, tutorials, and onboarding.', contextProviders: [], keyComponents: ['GuidePage'] },
};

export function getPageContextEntry(route: string): PageContextEntry | undefined {
  return PAGE_CONTEXT_REGISTRY[route] || PAGE_CONTEXT_REGISTRY['/'];
}
