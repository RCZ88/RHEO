import {
  LayoutDashboard, Activity, Brain, GraduationCap,
  Code2, Wallet, HeartHandshake, Settings, BookOpen,
  Shield as ShieldIcon, Terminal, FlaskConical,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────
export interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  group: string;
  badge?: string;
}

// ── Navigation (§16 — URL is the single truth) ─────────────────────────
//
// This registry lives in its OWN module so that both Sidebar.tsx and
// sidebar/useSidebarConfig.ts can import it without forming a cycle. An earlier
// version had useSidebarConfig import from '../Sidebar', which meant the config
// store — whose module-level `load()` reads SIDEBAR_ITEMS during init — executed
// while Sidebar.tsx was still initialising, putting the binding in the temporal
// dead zone.
//
// Items are never added or removed by the arrange panel: every entry is a live
// route, and the panel only regroups / renames / reorders what is already here.
export const SIDEBAR_ITEMS: SidebarItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', group: 'OVERVIEW' },
  { icon: Activity, label: 'Activity', path: '/activity', group: 'RECORD' },
  { icon: Code2, label: 'IDE Projects', path: '/ide', group: 'RECORD' },
  { icon: Brain, label: 'AI Assistant', path: '/ai', group: 'INTELLIGENCE' },
  { icon: ShieldIcon, label: 'Insights', path: '/reports', group: 'INTELLIGENCE' },
  { icon: GraduationCap, label: 'Lyceum', path: '/learn', group: 'INTELLIGENCE' },
  // Lecture, Content Engine and Resume were three entries across two groups.
  // All three are surfaces that were built outside the app's design system, so
  // they are now discovered through the /labs hub that groups them. Their own
  // routes are untouched — every deep link and smart-search hit still resolves.
  // The registry behind that hub is src/components/labs/labRegistry.ts.
  { icon: FlaskConical, label: 'Labs', path: '/labs', group: 'CREATE' },
  { icon: HeartHandshake, label: 'Life', path: '/life', group: 'LIFE' },
{ icon: Wallet, label: 'Finance', path: '/finance', group: 'LIFE' },
    { icon: BookOpen, label: 'Guide', path: '/guide', group: 'SYSTEM' },
  { icon: Settings, label: 'Settings', path: '/settings', group: 'SYSTEM' },
  { icon: Terminal, label: 'Penguin Console', path: '/penguin-console', group: 'SYSTEM' },
];