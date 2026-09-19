// ============================================================================
// Workspace Group Rail
// Vertical icon rail for the 6 workspace groups.
// Replaces the old chunky text buttons with clean icon-only navigation.
// ============================================================================
import React from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Monitor, PieChart, Sparkles, Bot, Settings2,
  Shield, HelpCircle, Globe, Terminal
} from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

type GroupKey = 'setup' | 'work' | 'insights' | 'studio' | 'conductor' | 'ai-gateway' | 'context' | 'handbook';

interface GroupDef {
  key: GroupKey;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: string;
  accentHex: string;
}

const GROUPS: GroupDef[] = [
  { key: 'setup',     icon: Settings,   label: 'Setup',     accent: 'orange',  accentHex: '#f97316' },
  { key: 'work',      icon: Monitor,    label: 'Work',      accent: 'green',   accentHex: '#22c55e' },
  { key: 'insights',  icon: PieChart,   label: 'Insights',  accent: 'purple',  accentHex: '#a855f7' },
  { key: 'studio',    icon: Sparkles,   label: 'Studio',    accent: 'indigo',  accentHex: '#818cf8' },
  { key: 'conductor', icon: Bot,        label: 'Conductor', accent: 'rose',    accentHex: '#fb7185' },
  { key: 'ai-gateway', icon: Globe,     label: 'AI Gateway', accent: 'cyan',   accentHex: '#22d3ee' },
  { key: 'context',   icon: Settings2,  label: 'Context',   accent: 'amber',   accentHex: '#fbbf24' },
  { key: 'handbook',  icon: Terminal,   label: 'Handbook',  accent: 'emerald', accentHex: '#10b981' },
];

const ACCENT_ACTIVE: Record<string, string> = {
  orange:  'text-orange-400',
  green:   'text-green-400',
  purple:  'text-purple-400',
  indigo:  'text-indigo-400',
  rose:    'text-rose-400',
  cyan:    'text-cyan-400',
  amber:   'text-amber-400',
  emerald: 'text-emerald-400',
};

const ACCENT_BORDER: Record<string, string> = {
  orange:  'bg-orange-500',
  green:   'bg-green-500',
  purple:  'bg-purple-500',
  indigo:  'bg-indigo-500',
  rose:    'bg-rose-500',
  cyan:    'bg-cyan-500',
  amber:   'bg-amber-500',
  emerald: 'bg-emerald-500',
};

const ACCENT_BG: Record<string, string> = {
  orange:  'bg-orange-500/10',
  green:   'bg-green-500/10',
  purple:  'bg-purple-500/10',
  indigo:  'bg-indigo-500/10',
  rose:    'bg-rose-500/10',
  cyan:    'bg-cyan-500/10',
  amber:   'bg-amber-500/10',
  emerald: 'bg-emerald-500/10',
};

interface WorkspaceGroupRailProps {
  activeGroup: GroupKey;
  onGroupChange: (group: GroupKey) => void;
  fileChangedPulse?: boolean;
}

export function WorkspaceGroupRail({
  activeGroup, onGroupChange, fileChangedPulse,
}: WorkspaceGroupRailProps) {
  return (
    <nav className="flex flex-col items-center w-14 shrink-0 bg-zinc-950 border-r border-zinc-800/40 py-2 gap-1">
      {GROUPS.map((g) => {
        const isActive = activeGroup === g.key;
        const Icon = g.icon;
        return (
          <Tooltip key={g.key} content={g.label} side="right">
            <motion.button
              whileHover={{ scale: 1.15, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onGroupChange(g.key)}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c] ${
                isActive
                  ? `${ACCENT_BG[g.accent]} ${ACCENT_ACTIVE[g.accent]} shadow-[0_0_16px_rgba(0,0,0,0.4)]`
                  : 'text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="rail-indicator"
                  className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-full ${ACCENT_BORDER[g.accent]}`}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <Icon className="w-5 h-5 drop-shadow-md" />

              {g.key === 'work' && fileChangedPulse && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping shadow-lg" />
              )}
            </motion.button>
          </Tooltip>
        );
      })}

      {/* Bottom section */}
      <div className="flex-1" />
      <div className="w-5 h-px bg-zinc-800 my-1.5" />
      <Tooltip content="Help" side="right">
        <motion.button
          whileHover={{ scale: 1.15, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c]"
        >
          <HelpCircle className="w-5 h-5" />
        </motion.button>
      </Tooltip>
    </nav>
  );
}
