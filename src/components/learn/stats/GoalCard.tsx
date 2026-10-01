import React from 'react';
import { motion } from 'framer-motion';

interface GoalCardProps {
  metric: string;
  target: number;
  current: number;
  type: 'daily' | 'weekly' | 'custom';
  completed?: boolean;
  onIncrement?: (delta: number) => void;
}

const METRIC_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  study_minutes: { label: 'Study Time', color: '#fbbf24', icon: '⏱' },
  cards_reviewed: { label: 'Cards Reviewed', color: '#5ab0c9', icon: '🃏' },
  nodes_completed: { label: 'Nodes Mastered', color: '#6fb38f', icon: '📘' },
  lessons_completed: { label: 'Lessons Done', color: '#d96846', icon: '📚' },
  quizzes_passed: { label: 'Quizzes Passed', color: '#a78bfa', icon: '✅' },
  mastery_points: { label: 'Mastery Points', color: '#f5c04e', icon: '⭐' },
};

export function GoalCard({ metric, target, current, type, completed, onIncrement }: GoalCardProps) {
  const config = METRIC_CONFIG[metric] || { label: metric, color: '#a8a29e', icon: '📊' };
  const pct = Math.min(100, Math.round((current / target) * 100));
  const circumference = 2 * Math.PI * 22;
  const dashoffset = circumference - (pct / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-5 transition-all ${
        completed
          ? 'border-sage-400/30 bg-sage-400/5'
          : 'border-white/10 bg-white/[0.02] hover:border-white/15'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Progress ring */}
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <motion.circle
              cx="24" cy="24" r="22" fill="none"
              stroke={config.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashoffset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-lg">
            {completed ? '✓' : config.icon}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">{config.label}</span>
            <span className="text-xs font-mono text-zinc-500">{pct}%</span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {current} / {target} {metric === 'study_minutes' ? 'min' : ''}
          </div>
          <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: config.color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {!completed && onIncrement && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onIncrement(1)}
            className="px-3 py-1 rounded-lg bg-white/5 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition"
          >
            +1
          </button>
          <button
            onClick={() => onIncrement(5)}
            className="px-3 py-1 rounded-lg bg-white/5 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition"
          >
            +5
          </button>
        </div>
      )}
    </motion.div>
  );
}
