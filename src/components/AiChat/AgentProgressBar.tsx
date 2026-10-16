import { type FC } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { MOTION } from '../ai/tokens';

interface AgentProgressBarProps {
  round: number;
  totalRounds: number;
  toolName?: string;
  status: 'thinking' | 'executing' | 'completed' | 'error';
  message?: string;
}

const toolLabels: Record<string, string> = {
  getGoals: 'Reading your goals',
  saveGoal: 'Saving goal',
  suggestGoals: 'Generating suggestions',
  getDashboardAggregates: 'Loading dashboard',
  getAIUsageSummary: 'Checking AI usage',
  getProjects: 'Loading projects',
  getConnectors: 'Checking data sources',
  getConnectorItems: 'Reading inbox',
  readPlanningMd: 'Reading your plan',
  getLongtermGoals: 'Checking long-term goals',
  getGoalContext: 'Building context',
};

function toolLabel(name?: string): string {
  if (!name) return 'Reasoning';
  return toolLabels[name] ?? name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
}

export const AgentProgressBar: FC<AgentProgressBarProps> = ({ round, totalRounds, toolName, status, message }) => {
  const pct = totalRounds > 0 ? round / totalRounds : 0;
  const isError = status === 'error';

  return (
    <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-950 light:bg-[var(--ws-surface-40)]">
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        {isError ? (
          <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
        ) : (
          <Loader2 className="h-3 w-3 text-pink-400 animate-spin shrink-0" />
        )}
        <span className="font-medium text-zinc-300">
          {isError ? message ?? 'Error' : toolLabel(toolName)}
        </span>
        <span className="text-zinc-600">·</span>
        <span>round {round}/{totalRounds}</span>
        <span className="ml-auto tabular-nums text-zinc-500">{Math.round(pct * 100)}%</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isError ? 'bg-red-500' : 'bg-pink-500'}`}
          style={{ transformOrigin: 'left' }}
          animate={{ scaleX: pct }}
          transition={{ duration: MOTION.normal, ease: MOTION.ease }}
        />
      </div>
    </div>
  );
};
