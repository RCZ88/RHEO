import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Edit3, Clock, FolderKanban, Sliders, ShieldOff,
  Sparkles, Target, BarChart3, Moon, GitCommit, Globe, AppWindow,
  CheckSquare, PlusCircle, PlayCircle, RefreshCw,
  MessageSquare, Zap, Bot, X, ChevronDown, ArrowRight,
  Calendar, Bell, Brain, Terminal
} from 'lucide-react';

interface Feature {
  icon: typeof Bot;
  title: string;
  description: string;
  details: string[];
  tryIt?: string;
}

interface CapabilityGroup {
  icon: typeof Bot;
  title: string;
  color: string;
  accentBorder: string;
  features: Feature[];
}

const groups: CapabilityGroup[] = [
  {
    icon: Database,
    title: 'Read Data',
    color: 'from-cyan-500 to-blue-500',
    accentBorder: 'rgba(34,211,238,0.3)',
    features: [
      {
        icon: Target,
        title: 'Goals & Projects',
        description: 'Retrieve your goals, projects, and activities on demand',
        details: [
          'List daily goals and long-term objectives',
          'View project details, activity breakdowns, and stats',
          'Check sleep data, trends, and patterns',
        ],
        tryIt: 'Show me my goals for today',
      },
      {
        icon: BarChart3,
        title: 'Statistics & Trends',
        description: 'Get insights into your tracked data',
        details: [
          'View commit statistics and project health scores',
          'See browser and app category breakdowns',
          'Analyze productivity trends over time',
        ],
        tryIt: 'What are my productivity trends this week?',
      },
      {
        icon: Globe,
        title: 'Settings & Config',
        description: 'Check your current configuration',
        details: [
          'View productivity tier assignments for apps and domains',
          'Check recording modes and preferences',
          'Inspect category and tier configurations',
        ],
        tryIt: 'What are my current tier assignments?',
      },
    ],
  },
  {
    icon: Edit3,
    title: 'Create & Update',
    color: 'from-emerald-500 to-teal-400',
    accentBorder: 'rgba(52,211,153,0.3)',
    features: [
      {
        icon: CheckSquare,
        title: 'Daily Goals',
        description: 'Add or modify your daily and long-term goals',
        details: [
          'Create new daily goals with targets',
          'Edit existing goals and mark progress',
          'Set long-term objectives and track milestones',
        ],
        tryIt: 'Add a goal: Read for 30 minutes today',
      },
      {
        icon: FolderKanban,
        title: 'Projects',
        description: 'Create and manage projects',
        details: [
          'Create new projects with descriptions',
          'Update project details and metadata',
          'Manage problems and issues for projects',
        ],
        tryIt: 'Show me my active projects',
      },
      {
        icon: PlusCircle,
        title: 'External Activities',
        description: 'Log activities outside your computer',
        details: [
          'Add workouts, meetings, reading sessions',
          'Categorize activities with tiers (productive/neutral/distracting)',
          'Manual time entries for anything you did off-screen',
        ],
        tryIt: 'Log a 1 hour workout as productive',
      },
    ],
  },
  {
    icon: Clock,
    title: 'Track Time',
    color: 'from-violet-500 to-purple-400',
    accentBorder: 'rgba(167,139,250,0.3)',
    features: [
      {
        icon: PlayCircle,
        title: 'Start/Stop Tracking',
        description: 'Control activity tracking sessions',
        details: [
          'Start tracking a new activity or project',
          'Stop active tracking sessions',
          'Switch between activities seamlessly',
        ],
        tryIt: 'Start tracking focused work',
      },
      {
        icon: Moon,
        title: 'Sleep & Breaks',
        description: 'Log rest periods',
        details: [
          'Manually log sleep entries with start/end times',
          'Log breaks and personal time',
          'View sleep quality trends',
        ],
        tryIt: 'Log sleep from 11pm to 7am',
      },
      {
        icon: RefreshCw,
        title: 'Manual Time Entry',
        description: 'Add time to past activities',
        details: [
          'Add time retroactively to any activity',
          'Adjust durations for incorrectly tracked sessions',
          'Backfill missed tracking periods',
        ],
        tryIt: 'Add 2 hours of coding to my project today',
      },
    ],
  },
  {
    icon: Calendar,
    title: 'Schedule & Plan',
    color: 'from-amber-500 to-orange-400',
    accentBorder: 'rgba(251,191,36,0.3)',
    features: [
      {
        icon: Calendar,
        title: 'Weekly Schedule',
        description: 'Set up your recurring weekly schedule',
        details: [
          'Add class/meeting times for each day',
          'Set recurring schedule blocks with locations',
          'View schedule alongside daily goals',
        ],
        tryIt: 'Add Monday 9am-10am: Math class',
      },
      {
        icon: Bell,
        title: 'Deadlines',
        description: 'Track assignment and project deadlines',
        details: [
          'Add deadlines with due dates and priorities',
          'Get reminded as deadlines approach',
          'Auto-link deadlines to preparation goals',
        ],
        tryIt: 'Add deadline: Report due Friday, high priority',
      },
      {
        icon: Brain,
        title: 'AI Planning',
        description: 'Let AI suggest goals based on your schedule',
        details: [
          'AI analyzes schedule + deadlines to suggest goals',
          'Smart time-blocking based on your patterns',
          'End-of-day review and tomorrow planning',
        ],
        tryIt: 'Suggest goals for today based on my schedule',
      },
    ],
  },
  {
    icon: Terminal,
    title: 'Connectors',
    color: 'from-pink-500 to-rose-400',
    accentBorder: 'rgba(236,72,153,0.3)',
    features: [
      {
        icon: Globe,
        title: 'Email Integration',
        description: 'Read and send emails through connectors',
        details: [
          'Connect Gmail, Outlook, or other email providers',
          'Read unread emails and summaries',
          'Send replies directly from the AI assistant',
        ],
        tryIt: 'Show me my unread emails',
      },
      {
        icon: Calendar,
        title: 'Calendar Sync',
        description: 'Sync and manage calendar events',
        details: [
          'Connect Google Calendar or Outlook Calendar',
          'View today\'s events and upcoming meetings',
          'Create and update calendar events',
        ],
        tryIt: 'What meetings do I have today?',
      },
    ],
  },
];

function FeatureCard({ feature, index, onTryIt }: { feature: Feature; index: number; onTryIt: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const IconComponent = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <div className="relative rounded-lg border border-zinc-800/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-zinc-700/50 hover:bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-3"
        >
          <div className="flex items-start gap-2.5">
            <div className="shrink-0 w-7 h-7 rounded-md bg-zinc-800/60 flex items-center justify-center border border-zinc-700/30">
              <IconComponent className="w-3.5 h-3.5 text-zinc-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-xs text-zinc-200">{feature.title}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{feature.description}</div>
            </div>
            <ChevronDown className={`shrink-0 w-3.5 h-3.5 text-zinc-600 mt-0.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-2.5 border-t border-zinc-800/30 pt-2.5">
                <div className="space-y-1">
                  {feature.details.map((detail, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                      <div className="shrink-0 w-1 h-1 rounded-full bg-zinc-600 mt-1.5" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>

                {feature.tryIt && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onTryIt(feature.tryIt!); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-violet-500/8 border border-violet-500/20 text-[11px] text-violet-300 hover:bg-violet-500/15 hover:border-violet-500/30 transition-all duration-150 group/try"
                  >
                    <Sparkles size={11} className="text-violet-400" />
                    <span className="flex-1 text-left font-medium">Try: "{feature.tryIt}"</span>
                    <ArrowRight size={10} className="text-violet-500 group-hover/try:text-violet-300 transition-colors" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface AIFeaturesModalProps {
  open: boolean;
  onClose: () => void;
  onTryIt?: (prompt: string) => void;
}

export function AIFeaturesModal({ open, onClose, onTryIt }: AIFeaturesModalProps) {
  const handleTryIt = (text: string) => {
    onTryIt?.(text);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[80]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-zinc-700/40 bg-[rgba(24,24,27,0.92)] backdrop-blur-xl shadow-2xl shadow-black/50"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">AI Assistant Capabilities</h2>
                  <p className="text-[11px] text-zinc-500">Everything your AI can do for you</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>

            {/* Quick tags */}
            <div className="flex items-center gap-1.5 px-5 py-2 border-b border-zinc-800/30 shrink-0 bg-zinc-900/20 light:bg-[var(--ws-surface-raised)]">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/8 border border-emerald-500/15">
                <MessageSquare className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-300/80">Ask naturally</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/8 border border-cyan-500/15">
                <Zap className="w-2.5 h-2.5 text-cyan-400" />
                <span className="text-[10px] text-cyan-300/80">Real-time data</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/8 border border-violet-500/15">
                <Sparkles className="w-2.5 h-2.5 text-violet-400" />
                <span className="text-[10px] text-violet-300/80">Proactive suggestions</span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {groups.map((group, gi) => (
                <motion.div
                  key={group.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + gi * 0.05, duration: 0.25 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`shrink-0 w-6 h-6 rounded-md bg-gradient-to-br ${group.color} flex items-center justify-center`}>
                      <group.icon className="w-3 h-3 text-white" />
                    </div>
                    <h3 className="text-xs font-semibold text-zinc-300">{group.title}</h3>
                  </div>
                  <div className="grid gap-1.5">
                    {group.features.map((feature, fi) => (
                      <FeatureCard key={feature.title} feature={feature} index={fi + gi * 10} onTryIt={handleTryIt} />
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Limitations */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.25 }}
                className="mt-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/15"
              >
                <div className="flex items-start gap-2">
                  <ShieldOff className="shrink-0 w-3.5 h-3.5 text-rose-400 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-rose-300">Limitations</div>
                    <ul className="mt-1 space-y-0.5">
                      {[
                        'Cannot run shell commands or modify app files',
                        'Cannot change security settings',
                        'Cannot access files outside the app data scope',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
                          <div className="shrink-0 w-1 h-1 rounded-full bg-zinc-700 mt-1" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="px-5 py-2 border-t border-zinc-800/30 shrink-0 bg-zinc-900/15 light:bg-[var(--ws-surface-raised)]">
              <p className="text-[10px] text-zinc-600 text-center">
                Just type what you need in natural language — I'll figure out the rest.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
