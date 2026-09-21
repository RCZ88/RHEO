import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from "motion/react";
import {
  PieChart, Code, BookOpen, Clock, Calendar, Target,
  Terminal as TerminalIcon, TrendingUp, Plus, Play, CheckCircle,
  ClipboardList, NoteText, Bell, LayoutGrid, Activity,
  Zap, GitBranch, Shield, MessageSquare, Brain,
  Database, Cpu, Wrench, Settings, FlaskConical,
  ArrowUpRight, Sparkles, Layers, Gauge, ZapIcon
} from 'lucide-react';

export type FeatureCardType =
  | 'finance' | 'ide' | 'learn' | 'activity' | 'schedule' | 'goal' | 'terminal'
  | 'tasks' | 'notes' | 'reminders' | 'calendar' | 'stats' | 'timer'
  | 'workflow' | 'insights' | 'automation' | 'database' | 'ai';

interface FeatureCardProps {
  id: string;
  type: FeatureCardType;
  title: string;
  data?: any;
  onQuickAction?: () => void;
}

const configMap: Record<FeatureCardType, { icon: any; color: string; bg: string; route: string; label: string }> = {
  finance:    { icon: PieChart,     color: 'text-emerald-400', bg: 'bg-emerald-400/10',  route: '/finance',          label: 'Finance' },
  ide:        { icon: Code,          color: 'text-blue-400',    bg: 'bg-blue-400/10',     route: '/ide-projects',     label: 'IDE Projects' },
  learn:      { icon: BookOpen,      color: 'text-amber-400',   bg: 'bg-amber-400/10',    route: '/learn',            label: 'Learning' },
  activity:   { icon: Activity,      color: 'text-pink-400',    bg: 'bg-pink-400/10',     route: '/activity',         label: 'Activity' },
  schedule:   { icon: Calendar,      color: 'text-purple-400',  bg: 'bg-purple-400/10',   route: '/life?tab=schedule',label: 'Schedule' },
  goal:       { icon: Target,        color: 'text-cyan-400',    bg: 'bg-cyan-400/10',     route: '/life?tab=goals',   label: 'Goals' },
  terminal:   { icon: TerminalIcon,  color: 'text-green-400',   bg: 'bg-green-400/10',    route: '/workspace',        label: 'Terminal' },
  tasks:      { icon: ClipboardList, color: 'text-red-400',     bg: 'bg-red-400/10',      route: '/tasks',            label: 'Tasks' },
  notes:      { icon: NoteText,      color: 'text-yellow-400',  bg: 'bg-yellow-400/10',   route: '/notes',            label: 'Notes' },
  reminders:  { icon: Bell,          color: 'text-orange-400',  bg: 'bg-orange-400/10',   route: '/reminders',        label: 'Reminders' },
  calendar:   { icon: LayoutGrid,    color: 'text-teal-400',    bg: 'bg-teal-400/10',     route: '/calendar',         label: 'Calendar' },
  stats:      { icon: Gauge,         color: 'text-indigo-400',  bg: 'bg-indigo-400/10',   route: '/stats',            label: 'Stats' },
  timer:      { icon: Zap,           color: 'text-rose-400',    bg: 'bg-rose-400/10',     route: '/timer',            label: 'Timer' },
  workflow:   { icon: GitBranch,     color: 'text-violet-400',  bg: 'bg-violet-400/10',   route: '/workflow',         label: 'Workflow' },
  insights:   { icon: Brain,         color: 'text-fuchsia-400', bg: 'bg-fuchsia-400/10',  route: '/insights',         label: 'Insights' },
  automation: { icon: Cpu,           color: 'text-sky-400',     bg: 'bg-sky-400/10',      route: '/automation',       label: 'Automation' },
  database:   { icon: Database,      color: 'text-amber-500',   bg: 'bg-amber-500/10',    route: '/database',         label: 'Database' },
  ai:         { icon: Sparkles,      color: 'text-cyan-300',    bg: 'bg-cyan-300/10',     route: '/ai',               label: 'AI Assistant' },
};

export function FeatureCard({ id, type, title, data, onQuickAction }: FeatureCardProps) {
  const { icon: Icon, color, bg, route, label } = configMap[type] || configMap.ai;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(route)}
      className="group relative flex flex-col justify-between p-6 h-48 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-600 transition-colors overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 ${bg} blur-3xl opacity-20 group-hover:opacity-30 transition-opacity`} />

      <div className="relative z-10 flex items-start justify-between">
        <div className={`p-3 rounded-lg ${bg}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>

      <div className="relative z-10">
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        {data ? (
          <div className="text-sm text-zinc-400 line-clamp-2 mt-2">
            {type === 'finance' && typeof data.balance === 'number' && (
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-500" />
                <span>Balance: ${data.balance.toLocaleString()}</span>
              </div>
            )}
            {type === 'activity' && typeof data.hours === 'number' && (
              <div>Clocked: {data.hours.toFixed(1)}h today</div>
            )}
            {type === 'goal' && typeof data.progress === 'number' && (
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-cyan-500" />
                <span>{data.progress}% Complete</span>
              </div>
            )}
            {type === 'schedule' && data.nextEvent && (
              <div>Next: {data.nextEvent}</div>
            )}
            {type === 'tasks' && typeof data.count === 'number' && (
              <div>{data.count} tasks pending</div>
            )}
            {type === 'stats' && typeof data.value === 'number' && (
              <div>Score: {data.value}</div>
            )}
            {type === 'timer' && typeof data.seconds === 'number' && (
              <div>{Math.floor(data.seconds / 60)}m elapsed</div>
            )}
            {!(data.balance || data.hours || data.progress || data.nextEvent || data.count || data.value || data.seconds) ? (
              <p className="text-sm text-zinc-500 mt-2">No live data</p>
            ) : null}
            </div>
          ) : null}
        </div>

      <div className="absolute inset-x-0 bottom-0 p-3 bg-zinc-950/90 border-t border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between backdrop-blur-sm">
        <span className="text-xs text-zinc-500">Click to open</span>
        <div className="flex gap-2">
          {type === 'finance' && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickAction?.(); }}
              className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              title="Quick Add Transaction"
            >
              <Plus size={14} />
            </button>
          )}
          {type === 'terminal' && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickAction?.(); }}
              className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
              title="New Session"
            >
              <Play size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
