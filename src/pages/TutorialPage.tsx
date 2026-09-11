import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Home, BarChart3, Globe, Moon, Terminal, BookOpen, Sparkles,
  AlertTriangle, Palette, Network, Database, Activity, Settings,
  ExternalLink, Trophy, RotateCcw, Check, Timer,
  Target, PieChart, Code2, Clock4, Zap, Users, FileText,
  Sliders, Search, Layers, Cpu, Grip, Layout, Brain, TrendingUp, Upload, Download, Rocket, Award, Smartphone,
} from 'lucide-react';

import { PageShell } from '../components/PageShell';
import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';
import { EmptyState } from '../components/EmptyState';
import { useTutorialContext } from '../contexts/TutorialContext';
import { TUTORIAL_STEPS } from '../data/tutorial-steps';

interface Feature {
  id: string;
  name: string;
  icon: any;
  category: string;
  status: 'released' | 'beta' | 'planned';
  description: string;
  whatYoullFind: string[];
  whatYouCanDo: string[];
  visualIcons: any[];
  route: string;
}

const FEATURES: Feature[] = [
  {
    id: 'dashboard', name: 'Dashboard', icon: Home,
    category: 'Core', status: 'released',
    description: 'Your command center — see everything at a glance.',
    whatYoullFind: [
      '3D orbit system — planets scaled by app usage time',
      'Activity heatmap — 7x24 grid showing daily intensity',
      'Weekly overview bar chart with top apps and total hours',
      'Quick stats cards for instant insights and recent sessions feed',
    ],
    whatYouCanDo: [
      'Click a planet to see detailed app stats',
      'Click heatmap cells to drill into hourly data',
      'Hover for tooltips across all visualizations',
      'Use period selector to change the displayed time range',
    ],
    visualIcons: [Activity, Globe, Target],
    route: '/',
  },
  {
    id: 'orbit', name: '3D Orbit Visualization', icon: Activity,
    category: 'Core', status: 'released',
    description: 'Interactive solar system of your app usage.',
    whatYoullFind: [
      'Interactive solar system with app-planets in 3D space',
      'Glow effects and smooth Three.js rendered particles',
      'Planet labels showing app names and usage percentages',
      'Orbit rings connecting related app categories',
    ],
    whatYouCanDo: [
      'Drag to rotate the orbit camera freely',
      'Scroll to zoom in and out of the solar system',
      'Click any planet for a detailed app breakdown',
      'Hover over planets for quick tooltip stats',
    ],
    visualIcons: [Globe, Layers, Sparkles],
    route: '/',
  },
  {
    id: 'stats', name: 'Usage Statistics', icon: BarChart3,
    category: 'Core', status: 'released',
    description: 'Deep dive into how you spend your time.',
    whatYoullFind: [
      'Sorted app list with individual time breakdowns',
      'Category breakdown charts — pie, bar, and line views',
      'Time mode toggle switching between focus and total time',
      'Period selector and export buttons for CSV and JSON',
    ],
    whatYouCanDo: [
      'Switch between focus time and total time views',
      'Filter data by date range using the period selector',
      'Export your usage data as CSV or JSON files',
      'Click chart segments to drill into filtered views',
    ],
    visualIcons: [PieChart, BarChart3, FileText],
    route: '/stats',
  },
  {
    id: 'browser', name: 'Browser Activity', icon: Globe,
    category: 'Core', status: 'released',
    description: 'Track and analyze your browsing habits across domains.',
    whatYoullFind: [
      'Browser selector with extension connection status',
      'Domain stats list sorted by time spent per site',
      'Category distribution charts for browsing habits',
      'Live mode toggle and summary cards with top domains',
    ],
    whatYouCanDo: [
      'Switch between connected browsers for different data',
      'Toggle live tracking on and off in real time',
      'Browse the domain list sorted by time spent',
      'View category breakdown of your browsing patterns',
    ],
    visualIcons: [Globe, Search, Zap],
    route: '/browser',
  },
  {
    id: 'external', name: 'External Tracker', icon: Moon,
    category: 'Core', status: 'released',
    description: 'Track offline activities, sleep, and focus sessions.',
    whatYoullFind: [
      'Active timer with stopwatch and sleep mode support',
      'Activity grid for quick session logging',
      'Sleep timeline chart — 24h view of sleep patterns',
      'Consistency score with streak tracking and manual entry form',
    ],
    whatYouCanDo: [
      'Start, stop, and pause the focus timer',
      'Log sleep sessions with the manual entry form',
      'Track offline activities with category tags',
      'View your consistency trends and streaks over time',
    ],
    visualIcons: [Timer, Clock4, Activity],
    route: '/external',
  },
  {
    id: 'ai-assistant', name: 'AI Assistant', icon: Sparkles,
    category: 'Core', status: 'released',
    description: 'Your intelligent companion for goal achievement and daily planning.',
    whatYoullFind: [
      'Infinite canvas with pannable grid and zoom controls',
      'Card types: goals, schedule, deadlines, responses, connectors',
      'Minimap for bird\'s-eye navigation across the canvas',
      'Command palette (Ctrl+K) for quick actions and card creation',
    ],
    whatYouCanDo: [
      'Toggle between Canvas (spatial) and Deck (linear chat) modes',
      'Drag cards to organize, pin to keep, auto-arrange by type',
      'Scroll to zoom, drag background to pan, click minimap to jump',
      'Type questions in the input bar or use the command palette',
    ],
    visualIcons: [Sparkles, Target, Brain],
    route: '/ai',
  },
  {
    id: 'productivity', name: 'Productivity', icon: Zap,
    category: 'Core', status: 'released',
    description: 'Measure and optimize your productive vs distracting time.',
    whatYoullFind: [
      'Circular productivity score from 0 to 100',
      'Time breakdown grid — productive, neutral, and distracting',
      'App vs website comparison for productivity analysis',
      'Trend charts over selected periods and categories',
    ],
    whatYouCanDo: [
      'View your productivity breakdown by category',
      'Compare app productivity against website productivity',
      'Track productivity trends over days and weeks',
      'Identify your most distracting apps and patterns',
    ],
    visualIcons: [Zap, Target, BarChart3],
    route: '/productivity',
  },
  {
    id: 'settings', name: 'Settings', icon: Settings,
    category: 'Core', status: 'released',
    description: 'Configure every aspect of the tracker.',
    whatYoullFind: [
      'Category management with color coding and labels',
      'Productivity tiers with drag-and-drop app assignment',
      'App carousel for quick categorization',
      'AI categorization settings, timer behavior, and data sync controls',
    ],
    whatYouCanDo: [
      'Create and edit categories with custom colors',
      'Drag and drop apps into productivity tiers',
      'Configure AI-powered auto-categorization',
      'Adjust timer behavior and manage data sync backups',
    ],
    visualIcons: [Settings, Sliders, Cpu],
    route: '/settings',
  },
  {
    id: 'terminal', name: 'Terminal & Agent Sessions', icon: Terminal,
    category: 'Tracker Mind', status: 'released',
    description: 'AI-powered terminal with context-aware agents.',
    whatYoullFind: [
      'Multi-pane xterm.js terminal with AI agent integration',
      'Session management panel for save, load, and categorize',
      'Project selector and 12 sidebar knowledge system tabs',
      'Instruction panel, context sidebar, and problems workspace',
    ],
    whatYouCanDo: [
      'Open and manage multiple terminal panes simultaneously',
      'Save, load, and categorize terminal sessions',
      'Select projects for targeted agent context',
      'Assign agents to tasks from 5 available types',
    ],
    visualIcons: [Code2, Users, Zap],
    route: '/ide',
  },
  {
    id: 'context', name: 'Context Management', icon: BookOpen,
    category: 'Tracker Mind', status: 'released',
    description: '12 knowledge systems feeding context to AI agents.',
    whatYoullFind: [
      'System toggles for all 6 main knowledge systems',
      'Token budget sliders for fine-tuning per system',
      'Model tier selector for AI interaction levels',
      'Design skills panel and auto-assembled prompt preview',
    ],
    whatYouCanDo: [
      'Toggle knowledge systems on and off per session',
      'Adjust token budgets with precise slider controls',
      'Select the AI model tier for interactions',
      'Preview assembled context before sending to agents',
    ],
    visualIcons: [FileText, Layers, Sliders],
    route: '/ide',
  },
  {
    id: 'problems', name: 'Problems & Requests', icon: AlertTriangle,
    category: 'Tracker Mind', status: 'released',
    description: 'Track bugs, features, and checklists — AI-managed.',
    whatYoullFind: [
      'Problem list with status filters and priority colors',
      'Checklist items that auto-update from AI agent actions',
      'Activity log recording every change and assignment',
      'Terminal assignment integration for direct fixes',
    ],
    whatYouCanDo: [
      'Create bugs with priority levels and descriptions',
      'Track feature requests through their status workflow',
      'Auto-update checklist items via AI agent completions',
      'Assign problems directly to terminal sessions',
    ],
    visualIcons: [AlertTriangle, Check, FileText],
    route: '/ide',
  },
  {
    id: 'design', name: 'Design Skills System', icon: Palette,
    category: 'Tracker Mind', status: 'beta',
    description: 'AI design intelligence with taste controls.',
    whatYoullFind: [
      'Taste knobs for fine-tuning AI design output',
      'Style references for maintaining consistent branding',
      '5 skill modules covering layout, color, typography, and more',
      'Google Stitch integration for automated screen generation',
    ],
    whatYouCanDo: [
      'Adjust taste knobs to tune the design output direction',
      'Import and manage style references for brand consistency',
      'Toggle individual skill modules on and off',
      'Generate screens directly via Stitch integration',
    ],
    visualIcons: [Palette, Layout, Settings],
    route: '/ide',
  },
  {
    id: 'skills', name: 'Skills Framework', icon: Sparkles,
    category: 'Tracker Mind', status: 'released',
    description: 'Reusable skill definitions for agent behavior.',
    whatYoullFind: [
      'Skills browser with search and filter controls',
      'Toggle switches for enabling and disabling skills',
      'Skill stack composition area for combining behaviors',
      'SKILL.md file definitions browsable inline',
    ],
    whatYouCanDo: [
      'Browse available agent skills with search',
      'Toggle skills on and off for context assembly',
      'Compose skill stacks to define agent behavior',
      'Create new skill definitions for custom agents',
    ],
    visualIcons: [Sparkles, Layers, Grip],
    route: '/ide',
  },
  {
    id: 'graphify', name: 'Knowledge Graph', icon: Network,
    category: 'Tracker Mind', status: 'beta',
    description: 'Auto-generated knowledge graphs from your workspace.',
    whatYoullFind: [
      'AST analysis output showing code structure relationships',
      'Community detection for logical code grouping',
      'HTML export with interactive graph visualization',
      'JSON export with audit reports and Obsidian vault sync status',
    ],
    whatYouCanDo: [
      'Run AST analysis on your workspace codebase',
      'View community-clustered knowledge graph results',
      'Export graphs as HTML or JSON for sharing',
      'Sync knowledge graphs to your Obsidian vault',
    ],
    visualIcons: [Network, Search, Layers],
    route: '/ide',
  },
  {
    id: 'ide-projects', name: 'IDE Projects', icon: Code2,
    category: 'Tracker Mind', status: 'released',
    description: 'Manage your workspace projects, tools, and AI integrations.',
    whatYoullFind: [
      '7-tab layout — overview, IDEs, tools, projects, AI, git, trash',
      'Metric cards showing workspace statistics at a glance',
      'AI usage chart with token counts and cost breakdown',
      'Project list with scan tools and git integration panel',
    ],
    whatYouCanDo: [
      'Browse tabs to switch between different project views',
      'Trigger workspace scans to discover new projects',
      'View AI token usage and associated costs',
      'Manage git repositories and organize project tools',
    ],
    visualIcons: [Code2, Layers, Grip],
    route: '/ide',
  },
  {
    id: 'database', name: 'Database Analytics', icon: Database,
    category: 'Data', status: 'released',
    description: 'Full analytics and data browser for all tracked data.',
    whatYoullFind: [
      'Table browser with search and schema display',
      'Data table with pagination and sortable columns',
      'Analytics charts for tokens, costs, sessions, and problems',
      'Daily activity trend visualization and CSV export button',
    ],
    whatYouCanDo: [
      'Browse all database tables with live search',
      'View schema details including column types for each table',
      'Export table data to CSV for external analysis',
      'Switch between chart views for different metrics',
    ],
    visualIcons: [Database, BarChart3, Search],
    route: '/database',
  },
  {
    id: 'feature-specs', name: 'Feature Specs', icon: FileText,
    category: 'Tracker Mind', status: 'beta',
    description: 'Browse and copy feature specifications for AI context.',
    whatYoullFind: [
      'Sidebar with all features organized by category',
      'Detail view with sections, components, and IPC endpoints',
      'Copy as markdown for individual or all specs',
    ],
    whatYouCanDo: [
      'Search and filter specs by name or description',
      'Toggle MD View to see raw markdown',
      'Copy specs to paste into AI context',
    ],
    visualIcons: [FileText, Search, Layers],
    route: '/ide',
  },
  // ───────────────────────────────────────────────────
  // Resume Builder
  // ───────────────────────────────────────────────────
  {
    id: 'resume-hub', name: 'Resume Hub', icon: FileText,
    category: 'Core', status: 'released',
    description: 'Your resume dashboard — score, versions, and quick actions.',
    whatYoullFind: [
      'Animated score gauge showing resume quality out of 100',
      'Quick action cards for Build, Import, Preview, and Export',
      'Recent versions list with scores and dates',
      'Profile summary with target role and stats',
    ],
    whatYouCanDo: [
      'Click Build to start the 7-phase questionnaire',
      'Import chat conversations to extract takeaways',
      'Scan certifications with your phone camera',
      'Save and compare multiple resume versions',
    ],
    visualIcons: [FileText, TrendingUp, Award],
    route: '/resume',
  },
  {
    id: 'resume-builder', name: 'Resume Builder', icon: Rocket,
    category: 'Core', status: 'released',
    description: 'Adaptive questionnaire with AI feedback and live preview.',
    whatYoullFind: [
      '7-phase non-linear questionnaire you can navigate freely',
      'Voice input for long answers via built-in speech recognition',
      'Resizable live preview with ATS-safe formatting',
      'Detailed answer guides with include/exclude/tips',
    ],
    whatYouCanDo: [
      'Click any phase tab to jump to that section',
      'Use the mic button to dictate long answers',
      'Drag the preview divider to resize',
      'Follow the XYZ format for strong resume bullets',
    ],
    visualIcons: [Rocket, Sparkles, Target],
    route: '/resume/build',
  },
  {
    id: 'resume-import', name: 'Resume Import & Scan', icon: Upload,
    category: 'Core', status: 'released',
    description: 'Extract resume content from chats, docs, and certifications.',
    whatYoullFind: [
      'Chat transcript import from ChatGPT, Claude, and Cursor',
      'Mobile phone scanning for certifications and credentials',
      'Document upload with AI-powered content extraction',
      'Takeaway review grid with confirm/reject actions',
    ],
    whatYouCanDo: [
      'Paste chat conversations to extract resume-worthy items',
      'Scan physical certificates with your phone camera',
      'Upload PDFs and documents for AI analysis',
      'Review and confirm extracted takeaways before using them',
    ],
    visualIcons: [Upload, Smartphone, Award],
    route: '/resume/import',
  },
  {
    id: 'resume-export', name: 'Resume Export & Reports', icon: Download,
    category: 'Core', status: 'released',
    description: 'Export your resume and view improvement reports.',
    whatYoullFind: [
      'PDF, Markdown, and JSON export formats',
      'ATS compatibility score and keyword analysis',
      'Version management with role-specific tailoring',
      'Improvement suggestions and redline drafts',
    ],
    whatYouCanDo: [
      'Choose export format and set target role',
      'Compare resume versions side by side',
      'View ATS score and keyword match rate',
      'Get specific improvement suggestions',
    ],
    visualIcons: [Download, BarChart3, FileText],
    route: '/resume/export',
  },
];

const CATEGORIES = ['All', 'Core', 'Tracker Mind', 'Data'] as const;

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  released: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Released' },
  beta: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Beta' },
  planned: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Planned' },
};

const CATEGORY_META: Record<string, { gradient: string; iconBg: string; label: string }> = {
  Core: {
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
    label: 'Core',
  },
  'Tracker Mind': {
    gradient: 'from-purple-500/20 to-purple-500/5',
    iconBg: 'bg-purple-500/10 text-purple-400',
    label: 'Tracker Mind',
  },
  Data: {
    gradient: 'from-blue-500/20 to-blue-500/5',
    iconBg: 'bg-blue-500/10 text-blue-400',
    label: 'Data',
  },
};

const PROGRESS_KEY = 'guide-progress';

interface GuideProgress {
  viewedFeatures: string[];
}

function loadProgress(): GuideProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { viewedFeatures: [] };
}

function saveProgress(progress: GuideProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export default function TutorialPage({ noShell }: { noShell?: boolean }) {
  const [progress, setProgress] = useState<GuideProgress>(loadProgress);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const tutorial = useTutorialContext();

  const filteredFeatures = selectedCategory === 'All'
    ? FEATURES : FEATURES.filter((f) => f.category === selectedCategory);

  const isAllComplete = progress.viewedFeatures.length >= FEATURES.length;

  const openFeature = useCallback((feature: Feature) => {
    const steps = TUTORIAL_STEPS[feature.id];
    if (!steps) return;
    tutorial.startTutorial(feature.id, steps, feature.name, feature.route);
  }, [tutorial]);

  const resetProgress = useCallback(() => {
    const cleared: GuideProgress = { viewedFeatures: [] };
    saveProgress(cleared);
    setProgress(cleared);
  }, []);

  const content = (
    <>
      <div className="flex-shrink-0 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            
            <p className="text-xs text-zinc-500">
              {isAllComplete
                ? 'You\'ve explored every feature!'
                : `${FEATURES.length} features — ${progress.viewedFeatures.length} explored`}
            </p>
          </div>
          {progress.viewedFeatures.length > 0 && (
            <button onClick={resetProgress}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors">
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        <div className="px-5 pb-3 flex gap-1">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 ${
                selectedCategory === cat
                  ? 'bg-zinc-700/60 text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40'
              }`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {isAllComplete && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard variant="elevated" className="text-center mb-6 border-emerald-500/20">
              <Trophy className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-base font-semibold text-white mb-1">You've explored every feature!</h2>
              <p className="text-xs text-zinc-500 mb-3">Use the guide anytime to revisit feature details.</p>
            </GlassCard>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFeatures.length === 0 ? (
            <div className="col-span-full">
              <EmptyState icon={<Search className="w-12 h-12" />} title="No features" description="No features in this category" />
            </div>
          ) : (
            filteredFeatures.map((feature, i) => {
              const isViewed = progress.viewedFeatures.includes(feature.id);
              const status = STATUS_STYLES[feature.status];
              const meta = CATEGORY_META[feature.category];
              return (
                <motion.div key={feature.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}>
                  <GlassCard variant="interactive" className="overflow-hidden">
                    <div className={`h-1 bg-gradient-to-r ${meta.gradient}`} />
                    <div className="p-5">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="shrink-0 relative">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
                            <feature.icon className="w-6 h-6 text-white" />
                          </div>
                          {isViewed && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-white truncate">{feature.name}</h3>
                            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
                          </div>
                          <p className="text-xs text-zinc-400">{feature.description}</p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Search className="w-3 h-3 text-zinc-500" />
                          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">What You'll Find</span>
                        </div>
                        <div className="space-y-1">
                          {feature.whatYoullFind.map((point, pi) => (
                            <div key={pi} className="flex items-start gap-2 text-xs text-zinc-400">
                              <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-zinc-600" />
                              {point}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap className="w-3 h-3 text-zinc-500" />
                          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">What You Can Do</span>
                        </div>
                        <div className="space-y-1">
                          {feature.whatYouCanDo.map((point, pi) => (
                            <div key={pi} className="flex items-start gap-2 text-xs text-zinc-400">
                              <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-zinc-600" />
                              {point}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                        <div className="flex items-center gap-2">
                          {feature.visualIcons.map((VIcon, vi) => (
                            <div key={vi} className={`w-7 h-7 rounded-lg ${meta.iconBg} flex items-center justify-center`}>
                              <VIcon className="w-3.5 h-3.5" />
                            </div>
                          ))}
                        </div>
                        <button onClick={() => openFeature(feature)}
                          className="px-3.5 py-1.5 rounded-lg bg-zinc-700/40 border border-zinc-600/30 text-[11px] text-zinc-300 hover:bg-zinc-600/40 hover:text-white transition-colors duration-150 flex items-center gap-1.5">
                          <ExternalLink className="w-3 h-3" />
                          Open
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </>
  );

  if (noShell) return <div className="flex flex-col h-full overflow-hidden">{content}</div>;

  return (
    <PageShell page="tutorial" variant="sticky-header">
      {content}
    </PageShell>
  );
}
