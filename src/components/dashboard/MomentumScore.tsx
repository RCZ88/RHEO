import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Gauge, TrendingUp, TrendingDown, Minus,
  Target, Clock, Flame
} from 'lucide-react';
import { GlareHover } from '../ui/glare-hover';
import { AnimatedShinyText } from '../ui/animated-shiny-text';
import { NumberTicker } from '../ui/number-ticker';

interface MomentumData {
  score: number;
  streak: number;
  completionRate: number;
  focusHours: number;
  trend: 'up' | 'down' | 'stable';
}

interface MomentumScoreProps {
  goals: any[];
  focusTimeMs: number;
  className?: string;
}

function calculateMomentum(goals: any[], focusTimeMs: number): MomentumData {
  const today = new Date().toISOString().split('T')[0];
  const todayGoals = goals.filter(g => g.date === today);
  const completedToday = todayGoals.filter(g => g.status === 'done').length;
  const completionRate = todayGoals.length > 0 ? (completedToday / todayGoals.length) * 100 : 0;

  // Calculate streak
  let streak = 0;
  const completedDates = new Set<string>();
  goals.forEach(g => {
    if (g.status === 'done' && g.completedAt) {
      completedDates.add(g.completedAt.split('T')[0]);
    }
  });

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (completedDates.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const focusHours = focusTimeMs / (1000 * 60 * 60);

  // Momentum = streak (30%) + completion (40%) + focus (30%)
  const streakScore = Math.min(30, streak * 3);
  const completionScore = (completionRate / 100) * 40;
  const focusScore = Math.min(30, focusHours * 3);
  const score = Math.round(streakScore + completionScore + focusScore);

  // Trend based on last 3 days
  const last3Days = Array.from(completedDates).sort().slice(-3);
  const trend = last3Days.length >= 2 ? 
    (last3Days.length === 3 ? 'up' : 'stable') : 'down';

  return {
    score: Math.min(100, score),
    streak,
    completionRate: Math.round(completionRate),
    focusHours: Math.round(focusHours * 10) / 10,
    trend
  };
}

export function MomentumScore({ goals, focusTimeMs, className = '' }: MomentumScoreProps) {
  const [momentum, setMomentum] = useState<MomentumData>({
    score: 0,
    streak: 0,
    completionRate: 0,
    focusHours: 0,
    trend: 'stable'
  });

  useEffect(() => {
    setMomentum(calculateMomentum(goals, focusTimeMs));
  }, [goals, focusTimeMs]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#22d3ee';
    if (score >= 40) return '#fbbf24';
    if (score >= 20) return '#f97316';
    return '#f87171';
  };

  const getScoreGlow = (score: number) => {
    if (score >= 80) return 'rgba(52, 211, 153, 0.3)';
    if (score >= 60) return 'rgba(34, 211, 238, 0.3)';
    if (score >= 40) return 'rgba(251, 191, 36, 0.3)';
    if (score >= 20) return 'rgba(249, 115, 22, 0.3)';
    return 'rgba(248, 113, 113, 0.3)';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp size={14} className="text-emerald-400" />;
      case 'down': return <TrendingDown size={14} className="text-rose-400" />;
      default: return <Minus size={14} className="text-zinc-400" />;
    }
  };

  return (
    <GlareHover
      width="100%"
      height="auto"
      background="rgba(24, 24, 27, 0.5)"
      color={getScoreColor(momentum.score)}
      opacity={0.2}
      angle={-45}
      duration={600}
      className={`rounded-xl border border-zinc-800/50 ${className}`}
    >
      <div className="relative p-5 overflow-hidden">
        {/* Top edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-500/30 via-cyan-500/10 to-transparent" />
        
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full"
            style={{ 
              background: `radial-gradient(circle, ${getScoreGlow(momentum.score)} 0%, transparent 70%)`,
              filter: 'blur(25px)'
            }}
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Gauge className="w-4.5 h-4.5 text-cyan-400" />
              </div>
              <div>
                <AnimatedShinyText className="text-[15px] font-semibold" gradientFrom="#06b6d4" gradientTo="#22d3ee">
                  Momentum
                </AnimatedShinyText>
                <p className="text-[11px] text-zinc-500">Your drive today</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {getTrendIcon(momentum.trend)}
            </div>
          </div>

          {/* Score display */}
          <div className="text-center mb-4">
            <div className="relative inline-block">
              {/* Circular progress background */}
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke="rgba(39, 39, 42, 0.5)"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke={getScoreColor(momentum.score)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
                  animate={{ 
                    strokeDashoffset: 2 * Math.PI * 45 * (1 - momentum.score / 100) 
                  }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </svg>
              {/* Score number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold font-mono" style={{ color: getScoreColor(momentum.score) }}>
                    <NumberTicker value={momentum.score} delay={200} duration={1200} />
                  </div>
                  <p className="text-[10px] text-zinc-500 -mt-1">/ 100</p>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30">
              <div className="flex items-center gap-2">
                <Flame size={12} className="text-orange-400" />
                <span className="text-[12px] text-zinc-400">Streak</span>
              </div>
              <span className="text-[12px] font-mono text-zinc-300">
                {momentum.streak} days
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30">
              <div className="flex items-center gap-2">
                <Target size={12} className="text-violet-400" />
                <span className="text-[12px] text-zinc-400">Completion</span>
              </div>
              <span className="text-[12px] font-mono text-zinc-300">
                {momentum.completionRate}%
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-cyan-400" />
                <span className="text-[12px] text-zinc-400">Focus</span>
              </div>
              <span className="text-[12px] font-mono text-zinc-300">
                {momentum.focusHours}h
              </span>
            </div>
          </div>
        </div>
      </div>
    </GlareHover>
  );
}
