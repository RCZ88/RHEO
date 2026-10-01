import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, BarChart3, Clock, TrendingUp, Monitor, PieChart, Plus, Layers, TrendingDown, Info, BookOpen, AlertTriangle, Wrench, Terminal, Bot, Settings, FileText, Brain, Calendar, Target, Zap, Globe, Wallet, CreditCard, Tag, Users, Receipt, Gauge, Sparkles, Moon, Code2, GitBranch, LineChart, Database, GraduationCap, Heart, Compass, ListTodo, History, Palette, Cpu, Bell, MessageSquare, Shield, FolderOpen, Image, LayoutGrid, Rocket, FlaskConical, Building2, Coins, ScrollText, Boxes, KeyRound, Volume2, Network, Repeat, ShieldAlert } from 'lucide-react';
import { navigateTo, scrollToSection } from '../lib/deepNav';
import { useNavigate } from 'react-router-dom';

interface PaletteItem {
  id: string;
  label: string;
  route: string;          // base route, e.g. '/activity'
  tab?: string;           // sub-tab key (deepNav sets localStorage hint)
  section?: string;       // data-section id to scroll to
  keywords: string[];
  group: string;
  icon: string;
}

/* ──────────────────────────────────────────────────────────────
 * COMPREHENSIVE NAVIGATION INDEX
 * Covers every route, every sub-tab, and every major card/section
 * in the application. Selecting an item switches the relevant
 * sub-tab (via deepNav) and scrolls the page to the exact
 * `data-section` anchor.
 * ────────────────────────────────────────────────────────────── */

const ITEMS: PaletteItem[] = [
  // ── Navigation (top-level routes) ──
  { id: 'nav-dashboard', label: 'Dashboard', route: '/', keywords: ['dashboard', 'home', 'overview', 'summary'], group: 'Navigation', icon: 'Layers' },
  { id: 'nav-activity', label: 'Activity', route: '/activity', keywords: ['activity', 'apps', 'websites', 'usage'], group: 'Navigation', icon: 'Activity' },
  { id: 'nav-rankings', label: 'Rankings', route: '/rankings', keywords: ['rankings', 'leaderboard', 'top', 'score'], group: 'Navigation', icon: 'TrendingUp' },
  { id: 'nav-ide', label: 'IDE Projects', route: '/ide', keywords: ['ide', 'projects', 'code', 'git'], group: 'Navigation', icon: 'Code2' },
  { id: 'nav-terminal', label: 'Terminal Workspace', route: '/terminal', keywords: ['terminal', 'workspace', 'agents', 'conductor'], group: 'Navigation', icon: 'Terminal' },
  { id: 'nav-life', label: 'Life', route: '/life', keywords: ['life', 'phases', 'river', 'gold', 'warmth'], group: 'Navigation', icon: 'Heart' },
  { id: 'nav-learn', label: 'Learn (Lyceum)', route: '/learn', keywords: ['learn', 'lyceum', 'lessons', 'education', 'courses'], group: 'Navigation', icon: 'GraduationCap' },
  { id: 'nav-ai', label: 'AI Studio / Canvas', route: '/ai', keywords: ['ai', 'chat', 'canvas', 'compositions', 'assistant'], group: 'Navigation', icon: 'Bot' },
  { id: 'nav-studio', label: 'Feature Studio', route: '/studio', keywords: ['studio', 'overlay', 'design', 'features'], group: 'Navigation', icon: 'Sparkles' },
  { id: 'nav-finance', label: 'Finance', route: '/finance', keywords: ['finance', 'money', 'wallet', 'budget'], group: 'Navigation', icon: 'Wallet' },
  { id: 'nav-resume', label: 'Resume Builder', route: '/resume', keywords: ['resume', 'cv', 'builder', 'jobs'], group: 'Navigation', icon: 'FileText' },
  { id: 'nav-external', label: 'External Tracking', route: '/external', keywords: ['external', 'manual', 'tracking', 'activities'], group: 'Navigation', icon: 'Globe' },
  { id: 'nav-reports', label: 'Reports & Insights', route: '/reports', keywords: ['reports', 'insights', 'analysis', 'recap'], group: 'Navigation', icon: 'PieChart' },
  { id: 'nav-database', label: 'Database', route: '/database', keywords: ['database', 'tables', 'sql', 'schema'], group: 'Navigation', icon: 'Database' },
  { id: 'nav-guide', label: 'Guide & Tutorials', route: '/guide', keywords: ['guide', 'help', 'tutorial', 'specs'], group: 'Navigation', icon: 'BookOpen' },
  { id: 'nav-settings', label: 'Settings', route: '/settings', keywords: ['settings', 'preferences', 'config'], group: 'Navigation', icon: 'Settings' },
  { id: 'titlebar-settings', label: 'Title bar settings', route: '', keywords: ['title bar', 'titlebar', 'hide', 'auto-hide', 'window title'], group: 'Appearance', icon: 'Monitor' },

  // ── Dashboard sections ──
  { id: 'dash-summary', label: 'Dashboard — Summary', route: '/', section: 'dash.summary', keywords: ['dashboard', 'summary', 'overview', 'total'], group: 'Dashboard', icon: 'Layers' },
  { id: 'dash-finance', label: 'Dashboard — Finance Overview', route: '/', section: 'dash.finance', keywords: ['dashboard', 'finance', 'money', 'overview'], group: 'Dashboard', icon: 'Wallet' },
  { id: 'dash-timer', label: 'Dashboard — Focus Timer', route: '/', section: 'dash.timer', keywords: ['dashboard', 'timer', 'focus', 'pomodoro'], group: 'Dashboard', icon: 'Clock' },
  { id: 'dash-activity', label: 'Dashboard — Live Activity', route: '/', section: 'dash.activity', keywords: ['dashboard', 'activity', 'live', 'feed'], group: 'Dashboard', icon: 'Activity' },

  // ── Activity sub-tabs + sections ──
  { id: 'activity-apps', label: 'Activity — Applications', route: '/activity', tab: 'apps', section: 'activity.apps', keywords: ['activity', 'apps', 'applications', 'desktop'], group: 'Activity', icon: 'Monitor' },
  { id: 'activity-websites', label: 'Activity — Websites', route: '/activity', tab: 'websites', section: 'activity.websites', keywords: ['activity', 'websites', 'browser', 'domains'], group: 'Activity', icon: 'Globe' },
  { id: 'activity-productivity', label: 'Activity — Productivity', route: '/activity', tab: 'productivity', section: 'activity.productivity', keywords: ['activity', 'productivity', 'tier', 'focus'], group: 'Activity', icon: 'Target' },
  { id: 'activity-focus', label: 'Activity — Focus Sessions', route: '/activity', tab: 'focus', section: 'activity.focus', keywords: ['activity', 'focus', 'sessions', 'concentration'], group: 'Activity', icon: 'Focus' },

  // ── Rankings sections ──
  { id: 'rankings-apps', label: 'Rankings — Top Apps', route: '/rankings', keywords: ['rankings', 'apps', 'top', 'leaderboard'], group: 'Rankings', icon: 'Monitor' },
  { id: 'rankings-categories', label: 'Rankings — Categories', route: '/rankings', keywords: ['rankings', 'categories', 'top'], group: 'Rankings', icon: 'Tag' },

  // ── IDE Projects sub-tabs + sections ──
  { id: 'ide-overview', label: 'IDE — Overview', route: '/ide', tab: 'overview', section: 'ide.overview', keywords: ['ide', 'overview', 'pulse', 'summary'], group: 'IDE Projects', icon: 'LayoutGrid' },
  { id: 'ide-environment', label: 'IDE — Environment', route: '/ide', tab: 'environment', section: 'ide.environment', keywords: ['ide', 'environment', 'tools', 'setup'], group: 'IDE Projects', icon: 'Cpu' },
  { id: 'ide-projects', label: 'IDE — Projects', route: '/ide', tab: 'projects', section: 'ide.projects', keywords: ['ide', 'projects', 'list', 'manage'], group: 'IDE Projects', icon: 'FolderOpen' },
  { id: 'ide-git', label: 'IDE — Git', route: '/ide', tab: 'git', section: 'ide.git', keywords: ['ide', 'git', 'commits', 'branch'], group: 'IDE Projects', icon: 'GitBranch' },
  { id: 'ide-analytics', label: 'IDE — Analytics', route: '/ide', tab: 'analytics', section: 'ide.analytics', keywords: ['ide', 'analytics', 'metrics', 'charts'], group: 'IDE Projects', icon: 'LineChart' },
  { id: 'ide-backup', label: 'IDE — Backup', route: '/ide', tab: 'backup', section: 'ide.backup', keywords: ['ide', 'backup', 'snapshot', 'restore'], group: 'IDE Projects', icon: 'Database' },
  { id: 'ide-ai-tools', label: 'IDE — AI Tools', route: '/ide', tab: 'ai', section: 'ide.ai-tools', keywords: ['ide', 'ai', 'tools', 'assistant', 'code'], group: 'IDE Projects', icon: 'Sparkles' },

  // ── Terminal Workspace groups + sections ──
  { id: 'terminal-setup', label: 'Terminal — Setup', route: '/terminal', tab: 'setup', keywords: ['terminal', 'setup', 'presets', 'routing'], group: 'Terminal Workspace', icon: 'Settings' },
  { id: 'terminal-work', label: 'Terminal — Work / Sessions', route: '/terminal', tab: 'work', keywords: ['terminal', 'work', 'sessions', 'agents'], group: 'Terminal Workspace', icon: 'Terminal' },
  { id: 'terminal-insights', label: 'Terminal — Insights', route: '/terminal', tab: 'insights', keywords: ['terminal', 'insights', 'analytics', 'costs'], group: 'Terminal Workspace', icon: 'LineChart' },
  { id: 'terminal-studio', label: 'Terminal — Studio', route: '/terminal', tab: 'studio', keywords: ['terminal', 'studio', 'build', 'dev'], group: 'Terminal Workspace', icon: 'Sparkles' },
  { id: 'terminal-conductor', label: 'Terminal — Conductor', route: '/terminal', tab: 'conductor', keywords: ['terminal', 'conductor', 'orchestrate', 'agents'], group: 'Terminal Workspace', icon: 'Network' },
  { id: 'terminal-context', label: 'Terminal — Context Brain', route: '/terminal', tab: 'context', keywords: ['terminal', 'context', 'knowledge', 'memory'], group: 'Terminal Workspace', icon: 'Brain' },

  // ── Life / Warmth sections ──
  { id: 'life-phases', label: 'Life — Phases', route: '/life', keywords: ['life', 'phases', 'timeline', 'seasons'], group: 'Life', icon: 'Compass' },
  { id: 'life-river', label: 'Life — River', route: '/life', keywords: ['life', 'river', 'flow', 'path'], group: 'Life', icon: 'Heart' },
  { id: 'life-gold', label: 'Life — Gold', route: '/life', keywords: ['life', 'gold', 'treasure', 'memories'], group: 'Life', icon: 'Coins' },

  // ── Learn (Lyceum) sections ──
  { id: 'learn-courses', label: 'Learn — Courses', route: '/learn', keywords: ['learn', 'courses', 'lessons', 'study'], group: 'Learn', icon: 'GraduationCap' },
  { id: 'learn-deck', label: 'Learn — Deck / Review', route: '/learn', keywords: ['learn', 'deck', 'flashcards', 'review'], group: 'Learn', icon: 'Layers' },

  // ── AI Studio / Canvas ──
  { id: 'ai-chat', label: 'AI — Chat', route: '/ai', keywords: ['ai', 'chat', 'assistant', 'conversation'], group: 'AI Studio', icon: 'MessageSquare' },
  { id: 'ai-canvas', label: 'AI — Canvas Deck', route: '/ai', tab: 'canvas', section: 'ai.canvas', keywords: ['ai', 'canvas', 'cards', 'deck'], group: 'AI Studio', icon: 'LayoutGrid' },
  { id: 'ai-daily-planner', label: 'AI — Daily Planner Card', route: '/ai', keywords: ['ai', 'daily', 'planner', 'schedule', 'card'], group: 'AI Studio', icon: 'Calendar' },
  { id: 'ai-weekly-schedule', label: 'AI — Weekly Schedule Card', route: '/ai', keywords: ['ai', 'weekly', 'schedule', 'card'], group: 'AI Studio', icon: 'Calendar' },
  { id: 'ai-deadline-tracker', label: 'AI — Deadline Tracker Card', route: '/ai', keywords: ['ai', 'deadline', 'tracker', 'card'], group: 'AI Studio', icon: 'Alarm' },
  { id: 'ai-compositions', label: 'AI — Compositions', route: '/ai', tab: 'compositions', section: 'ai.compositions', keywords: ['ai', 'compositions', 'library', 'saved'], group: 'AI Studio', icon: 'Layers' },
  { id: 'ai-tools', label: 'AI — Tools', route: '/ai', keywords: ['ai', 'tools', 'slash', 'commands'], group: 'AI Studio', icon: 'Wrench' },

  // ── Feature Studio ──
  { id: 'studio-overlay', label: 'Studio — Overlay Builder', route: '/studio', keywords: ['studio', 'overlay', 'builder', 'widget'], group: 'Feature Studio', icon: 'Sparkles' },
  { id: 'studio-templates', label: 'Studio — Templates', route: '/studio', keywords: ['studio', 'templates', 'presets'], group: 'Feature Studio', icon: 'LayoutGrid' },

  // ── Finance sub-tabs + sections ──
  { id: 'finance-overview', label: 'Finance — Overview', route: '/finance', tab: 'overview', section: 'finance.overview', keywords: ['finance', 'overview', 'summary', 'net worth'], group: 'Finance', icon: 'Wallet' },
  { id: 'finance-wallets', label: 'Finance — Wallets', route: '/finance', tab: 'wallets', section: 'finance.wallets', keywords: ['finance', 'wallets', 'accounts', 'balance'], group: 'Finance', icon: 'CreditCard' },
  { id: 'finance-transactions', label: 'Finance — Transactions', route: '/finance', tab: 'transactions', section: 'finance.transactions', keywords: ['finance', 'transactions', 'history', 'spending'], group: 'Finance', icon: 'Receipt' },
  { id: 'finance-categories', label: 'Finance — Categories', route: '/finance', tab: 'categories', section: 'finance.categories', keywords: ['finance', 'categories', 'budget', 'groups'], group: 'Finance', icon: 'Tag' },
  { id: 'finance-people', label: 'Finance — People', route: '/finance', tab: 'people', section: 'finance.people', keywords: ['finance', 'people', 'contacts', 'split'], group: 'Finance', icon: 'Users' },
  { id: 'finance-budget', label: 'Finance — Budget', route: '/finance', tab: 'budget', section: 'finance.budget', keywords: ['finance', 'budget', 'plan', 'limits'], group: 'Finance', icon: 'Gauge' },
  { id: 'finance-charts', label: 'Finance — Charts', route: '/finance', tab: 'charts', section: 'finance.charts', keywords: ['finance', 'charts', 'trends', 'graph'], group: 'Finance', icon: 'LineChart' },
  { id: 'finance-subscriptions', label: 'Finance — Subscriptions', route: '/finance', tab: 'subscriptions', section: 'finance.subscriptions', keywords: ['finance', 'subscriptions', 'recurring', 'monthly'], group: 'Finance', icon: 'Repeat' },
  { id: 'finance-audit', label: 'Finance — Audit Log', route: '/finance', tab: 'audit', section: 'finance.audit', keywords: ['finance', 'audit', 'log', 'changes'], group: 'Finance', icon: 'Audit' },
  { id: 'finance-recap', label: 'Finance — Recap', route: '/finance', tab: 'recap', section: 'finance.recap', keywords: ['finance', 'recap', 'summary', 'report'], group: 'Finance', icon: 'ScrollText' },

  // ── Resume Builder ──
  { id: 'resume-home', label: 'Resume — Home', route: '/resume', keywords: ['resume', 'home', 'builder'], group: 'Resume Builder', icon: 'FileText' },
  { id: 'resume-build', label: 'Resume — Build / Editor', route: '/resume/build', keywords: ['resume', 'build', 'editor', 'edit'], group: 'Resume Builder', icon: 'FileText' },
  { id: 'resume-preview', label: 'Resume — Preview', route: '/resume/preview', keywords: ['resume', 'preview', 'view'], group: 'Resume Builder', icon: 'FileText' },
  { id: 'resume-import', label: 'Resume — Import', route: '/resume/import', keywords: ['resume', 'import', 'upload', 'pdf'], group: 'Resume Builder', icon: 'FileText' },
  { id: 'resume-export', label: 'Resume — Export', route: '/resume/export', keywords: ['resume', 'export', 'download', 'pdf'], group: 'Resume Builder', icon: 'FileText' },

  // ── External Tracking ──
  { id: 'external-manual', label: 'External — Manual Entry', route: '/external', keywords: ['external', 'manual', 'entry', 'log'], group: 'External Tracking', icon: 'Plus' },
  { id: 'external-list', label: 'External — Activities List', route: '/external', keywords: ['external', 'activities', 'list', 'manage'], group: 'External Tracking', icon: 'ListTodo' },

  // ── Reports & Insights sub-tabs + sections ──
  { id: 'insights-day', label: 'Insights — Typical Day', route: '/reports', tab: 'typical', section: 'insights.day', keywords: ['insights', 'typical', 'day', 'heatmap', 'hours'], group: 'Reports & Insights', icon: 'Sun' },
  { id: 'insights-weekly', label: 'Insights — Weekly', route: '/reports', tab: 'weekly', section: 'insights.weekly', keywords: ['insights', 'weekly', 'trend', 'pattern'], group: 'Reports & Insights', icon: 'Calendar' },
  { id: 'insights-activities', label: 'Insights — Activities', route: '/reports', tab: 'activities', section: 'insights.activities', keywords: ['insights', 'activities', 'breakdown', 'sessions'], group: 'Reports & Insights', icon: 'Activity' },
  { id: 'insights-recap', label: 'Insights — Daily Recap', route: '/reports', tab: 'recap', section: 'insights.recap', keywords: ['insights', 'recap', 'daily', 'groupings', 'venn', 'summary'], group: 'Reports & Insights', icon: 'PieChart' },
  { id: 'insights-recap-topapps', label: 'Recap — Top Apps', route: '/reports', tab: 'recap', section: 'insights.recap.top-apps', keywords: ['recap', 'top apps', 'most used', 'app time'], group: 'Reports & Insights', icon: 'Monitor' },
  { id: 'insights-recap-categories', label: 'Recap — Categories', route: '/reports', tab: 'recap', section: 'insights.recap.category-distribution', keywords: ['recap', 'categories', 'category distribution', 'by activity'], group: 'Reports & Insights', icon: 'PieChart' },
  { id: 'insights-recap-productivity', label: 'Recap — Productivity', route: '/reports', tab: 'recap', section: 'insights.recap.productivity', keywords: ['recap', 'productive', 'distracting', 'tier'], group: 'Reports & Insights', icon: 'Zap' },
  { id: 'insights-recap-sleep', label: 'Recap — Sleep', route: '/reports', tab: 'recap', section: 'insights.recap.sleep', keywords: ['recap', 'sleep', 'hours', 'deficit'], group: 'Reports & Insights', icon: 'Moon' },
  { id: 'insights-recap-browser', label: 'Recap — Browser', route: '/reports', tab: 'recap', section: 'insights.recap.browser', keywords: ['recap', 'browser', 'web', 'sites'], group: 'Reports & Insights', icon: 'Globe' },
  { id: 'insights-recap-external', label: 'Recap — External', route: '/reports', tab: 'recap', section: 'insights.recap.external', keywords: ['recap', 'external', 'tracking', 'activities'], group: 'Reports & Insights', icon: 'Clock' },
  { id: 'insights-recap-days', label: 'Recap — Day by Day', route: '/reports', tab: 'recap', section: 'insights.recap.days', keywords: ['recap', 'daily summary', 'day by day', 'each day'], group: 'Reports & Insights', icon: 'Calendar' },
  { id: 'insights-recap-venn', label: 'Recap — Grouping Overlap', route: '/reports', tab: 'recap', section: 'insights.recap.venn', keywords: ['recap', 'venn', 'overlap', 'groupings'], group: 'Reports & Insights', icon: 'Target' },
  { id: 'insights-recap-summary', label: 'Recap — Summary Cards', route: '/reports', tab: 'recap', section: 'insights.recap.summary', keywords: ['recap', 'consistency', 'streak', 'best day'], group: 'Reports & Insights', icon: 'TrendingUp' },
  { id: 'insights-recap-sleep-trend', label: 'Recap — Sleep Trend', route: '/reports', tab: 'recap', section: 'insights.recap.sleep-trend', keywords: ['recap', 'sleep trend', 'chart', 'sleep hours'], group: 'Reports & Insights', icon: 'BarChart' },

  // ── Database sub-tabs + sections ──
  { id: 'database-browse', label: 'Database — Browse', route: '/database', tab: 'browse', section: 'database.browse', keywords: ['database', 'browse', 'tables', 'rows'], group: 'Database', icon: 'Database' },
  { id: 'database-architecture', label: 'Database — Architecture', route: '/database', tab: 'architecture', section: 'database.architecture', keywords: ['database', 'architecture', 'schema', 'diagram'], group: 'Database', icon: 'Boxes' },
  { id: 'database-changes', label: 'Database — Changes', route: '/database', tab: 'changes', section: 'database.changes', keywords: ['database', 'changes', 'history', 'migrations'], group: 'Database', icon: 'History' },

  // ── Guide / Tutorials ──
  { id: 'guide-tutorial', label: 'Guide — Tutorial', route: '/guide', tab: 'tutorial', section: 'guide.tutorial', keywords: ['guide', 'tutorial', 'walkthrough', 'help'], group: 'Guide', icon: 'BookOpen' },
  { id: 'guide-specs', label: 'Guide — Feature Specs', route: '/guide', tab: 'specs', section: 'guide.specs', keywords: ['guide', 'specs', 'features', 'specifications'], group: 'Guide', icon: 'FileText' },

  // ── Settings sub-tabs + sections ──
  { id: 'settings-appearance', label: 'Settings — Appearance', route: '/settings', tab: 'appearance', section: 'settings.appearance', keywords: ['settings', 'appearance', 'theme', 'dark', 'light'], group: 'Settings', icon: 'Palette' },
  { id: 'settings-category', label: 'Settings — Categories', route: '/settings', tab: 'category', section: 'settings.category', keywords: ['settings', 'category', 'tiers', 'assign'], group: 'Settings', icon: 'Tag' },
  { id: 'settings-general', label: 'Settings — General', route: '/settings', tab: 'general', section: 'settings.general', keywords: ['settings', 'general', 'preferences', 'period'], group: 'Settings', icon: 'Settings' },
  { id: 'settings-tracking', label: 'Settings — Tracking', route: '/settings', tab: 'tracking', section: 'settings.tracking', keywords: ['settings', 'tracking', 'apps', 'detection'], group: 'Settings', icon: 'Gauge' },
  { id: 'settings-prompts', label: 'Settings — Prompts', route: '/settings', tab: 'prompts', section: 'settings.prompts', keywords: ['settings', 'prompts', 'ai', 'instructions'], group: 'Settings', icon: 'MessageSquare' },
  { id: 'settings-colors', label: 'Settings — Colors', route: '/settings', tab: 'colors', section: 'settings.colors', keywords: ['settings', 'colors', 'palette', 'customize'], group: 'Settings', icon: 'Palette' },
  { id: 'settings-ai', label: 'Settings — AI', route: '/settings', tab: 'ai', section: 'settings.ai', keywords: ['settings', 'ai', 'model', 'provider', 'api'], group: 'Settings', icon: 'Bot' },
  { id: 'settings-ai-diagnostics', label: 'Settings — AI Diagnostics', route: '/settings', tab: 'ai', section: 'settings.ai.diagnostics', keywords: ['settings', 'ai', 'diagnostics', 'health', 'status'], group: 'Settings', icon: 'Shield' },
  { id: 'settings-finance', label: 'Settings — Finance', route: '/settings', tab: 'finance', section: 'settings.finance', keywords: ['settings', 'finance', 'currency', 'accounts'], group: 'Settings', icon: 'Wallet' },
  { id: 'settings-devices', label: 'Settings — Devices', route: '/settings', tab: 'devices', section: 'settings.devices', keywords: ['settings', 'devices', 'phone', 'sync', 'paired'], group: 'Settings', icon: 'Cpu' },

  // ── Focus page ──
  { id: 'focus-goals', label: 'Focus — Goals', route: '/focus', tab: 'goals', section: 'focus.goals', keywords: ['focus', 'goals', 'targets', 'objectives'], group: 'Focus', icon: 'Target' },
  { id: 'focus-stats', label: 'Focus — Stats', route: '/focus', tab: 'stats', section: 'focus.stats', keywords: ['focus', 'stats', 'statistics', 'metrics'], group: 'Focus', icon: 'BarChart3' },
  { id: 'focus-history', label: 'Focus — History', route: '/focus', tab: 'history', section: 'focus.history', keywords: ['focus', 'history', 'log', 'past'], group: 'Focus', icon: 'History' },
];

const ICON_MAP: Record<string, any> = {
  Layers, BarChart3, Clock, TrendingUp, Monitor, PieChart, Plus, Info, BookOpen, AlertTriangle,
  Wrench, Terminal, Bot, Settings, FileText, Brain, Calendar, Target, Zap, Globe, Wallet,
  CreditCard, Tag, Users, Receipt, Gauge, Sparkles, Moon, Code2, GitBranch, LineChart,
  Database, GraduationCap, Heart, Compass, ListTodo, History, Palette, Cpu, Bell, MessageSquare,
  Shield, FolderOpen, Image, LayoutGrid, Rocket, FlaskConical, Building2, Coins, ScrollText,
  Boxes, KeyRound, Volume2, Network, Repeat, ShieldAlert,
  Sun: Calendar, Focus: Target, Activity: TrendingUp, Audit: ShieldAlert, Alarm: Bell,
};

export default function GlobalSearchCommandPalette({ isOpen, onClose, onNavigate }: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (item: PaletteItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  const filtered = useMemo(() => {
    if (!query.trim()) return ITEMS;
    const q = query.toLowerCase();
    return ITEMS.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some(k => k.includes(q)) ||
      item.group.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard lives on the INPUT, not only on window.
  //
  // Why this changed: the handler used to sit on a window bubble-phase listener.
  // Any listener between the input and window that calls stopPropagation() — or
  // simply any future capture-phase handler — silently kills Enter, and the
  // palette looks alive while being keyboard-dead. React's onKeyDown on the
  // focused element is the only delivery path that cannot be swallowed from the
  // outside, so it is now the single source of truth. The window listener is
  // kept ONLY as a fallback for keys pressed while focus is outside the input,
  // and it bails out when the event already came from the input (no double-fire).
  // Commit reads from REFS, never from a useCallback closure.
  //
  // Why: the previous version closed over `filtered[selectedIndex]` inside a
  // useCallback whose deps included an `onNavigate` prop that is a fresh inline
  // arrow on every App render. That combination makes the memoised callback
  // and the live render disagree, and the failure is invisible — the palette
  // looks alive, arrows move the highlight, and Enter silently does nothing.
  // Refs written during render are always current, so this path cannot go stale.
  const filteredRef = useRef(filtered);
  const selectedIndexRef = useRef(selectedIndex);
  filteredRef.current = filtered;
  selectedIndexRef.current = selectedIndex;

  const move = useCallback(
    (delta: number) => setSelectedIndex(i => Math.min(Math.max(i + delta, 0), Math.max(filteredRef.current.length - 1, 0))),
    [],
  );

  const commit = useCallback(() => {
    const i = selectedIndexRef.current;
    const item = filteredRef.current[i];
    console.log('[CommandPalette] commit requested', { index: i, total: filteredRef.current.length, id: item?.id ?? null });
    if (!item) return;
    // Probe hook: lets a runtime test assert the Enter path fired end-to-end
    // without scraping React internals.
    window.dispatchEvent(new CustomEvent('command-palette:commit', { detail: { id: item.id, index: i } }));
    onNavigateRef.current(item);
  }, []);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (e.key === 'Home') { e.preventDefault(); setSelectedIndex(0); return; }
    if (e.key === 'End') { e.preventDefault(); setSelectedIndex(Math.max(filteredRef.current.length - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commit(); }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      // The input owns its own keys — do not double-handle them.
      if (e.target === inputRef.current) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, move, commit, onClose]);

  // Keep the highlighted row inside the scroll viewport. Without this, arrowing
  // past the fold moves an invisible selection and Enter then opens something
  // the user cannot see — the exact "Enter doesn't work" symptom.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`);
    if (!el) return;
    const rTop = root.scrollTop;
    const rBot = rTop + root.clientHeight;
    const eTop = el.offsetTop;
    const eBot = eTop + el.offsetHeight;
    if (eTop < rTop) root.scrollTop = eTop;
    else if (eBot > rBot) root.scrollTop = eBot - root.clientHeight;
  }, [selectedIndex, filtered]);

  if (!isOpen) return null;

  const groups = [...new Set(filtered.map(i => i.group))];

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={filtered[selectedIndex] ? `cmd-${filtered[selectedIndex].id}` : undefined}
            aria-label="Search pages, tabs, sections and cards"
            placeholder="Search pages, tabs, sections, cards..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
          />
          <kbd className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div ref={listRef} id="command-palette-results" role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">No results found</div>
          )}
          {groups.map(group => {
            const groupItems = filtered.filter(i => i.group === group);
            return (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{group}</div>
                {groupItems.map(item => {
                  const idx = filtered.indexOf(item);
                  const Icon = ICON_MAP[item.icon] || Layers;
                  return (
                    <button
                      key={item.id}
                      id={`cmd-${item.id}`}
                      role="option"
                      aria-selected={idx === selectedIndex}
                      data-idx={idx}
                      data-cmd-id={item.id}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                        idx === selectedIndex ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                      }`}
                      onClick={() => { selectedIndexRef.current = idx; setSelectedIndex(idx); commit(); }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-[10px] text-zinc-600 truncate">{item.section || item.route}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer — makes the keyboard contract visible instead of folklore */}
        <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600">
          <span><span className="text-zinc-400">↑↓</span> navigate</span>
          <span><span className="text-zinc-400">↵</span> open</span>
          <span><span className="text-zinc-400">esc</span> close</span>
          <span className="ml-auto normal-case tracking-normal text-zinc-600">
            {filtered.length > 0 ? `${selectedIndex + 1} of ${filtered.length}` : 'no matches'}
          </span>
        </div>
      </div>
    </div>
  );
}
