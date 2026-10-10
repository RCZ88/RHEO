import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import { cn } from '../../lib/utils';

export type KpiTrend = { direction: 'up' | 'down'; label: string };

export interface KpiCardProps {
  icon: LucideIcon;
  accent: 'violet' | 'emerald' | 'pink' | 'cyan' | 'amber';
  value: string;
  label: string;
  sublabel?: string;
  numericValue?: number;
  trend?: KpiTrend;
  loading?: boolean;
  empty?: boolean;
  error?: string;
  onRetry?: () => void;
  delay?: number;
}

const accentMap: Record<string, {
  bg: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  ring: string;
  dot: string;
}> = {
  violet: {
    bg: 'bg-violet-500/[0.08]',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
    valueColor: 'text-white',
    ring: 'ring-violet-500/30',
    dot: 'bg-violet-400',
  },
  emerald: {
    bg: 'bg-emerald-500/[0.08]',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    valueColor: 'text-white',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  pink: {
    bg: 'bg-pink-500/[0.08]',
    iconBg: 'bg-pink-500/20',
    iconColor: 'text-pink-400',
    valueColor: 'text-white',
    ring: 'ring-pink-500/30',
    dot: 'bg-pink-400',
  },
  cyan: {
    bg: 'bg-cyan-500/[0.08]',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    valueColor: 'text-white',
    ring: 'ring-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  amber: {
    bg: 'bg-amber-500/[0.08]',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    valueColor: 'text-white',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-400',
  },
};

export function KpiCard({
  icon: Icon,
  accent,
  value,
  label,
  sublabel,
  numericValue,
  trend,
  loading,
  empty,
  error,
  onRetry,
  delay = 0,
}: KpiCardProps) {
  const ac = accentMap[accent];
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -1 }}
      className={cn(
        'relative overflow-hidden rounded-xl p-4',
        'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]',
        'border border-zinc-800/40',
        'hover:border-zinc-700/50',
        'transition-all duration-200 group'
      )}
    >
      {/* Background glow */}
      <div className={cn('absolute inset-0 opacity-60', ac.bg)} />

      <div className="relative z-0 flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          'ring-1 ring-inset ring-white/5',
          ac.iconBg
        )}>
          <Icon className={cn('w-5 h-5', ac.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {loading ? (
              <div className="h-7 w-20 bg-zinc-800/60 rounded animate-pulse" />
            ) : error ? (
              <button onClick={onRetry} className="text-xs text-red-400 hover:text-red-300">
                {error}
              </button>
            ) : (
              <span className={cn('text-2xl font-bold font-mono tracking-tight', ac.valueColor)}>
                {numericValue !== undefined && numericValue > 0 ? (
                  <NumberTicker
                    value={numericValue}
                    formatter={(v) => {
                      if (accent === 'emerald') {
                        if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
                        if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
                        if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
                        if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
                        return `$${v.toFixed(v >= 1 ? 2 : 4)}`;
                      }
                      if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
                      if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                      if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                      if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
                      return v.toLocaleString();
                    }}
                    className="text-2xl font-bold font-mono tracking-tight"
                  />
                ) : (
                  <span>{value}</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-medium text-zinc-400 truncate">{label}</span>
            {sublabel && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-[10px] text-zinc-600 truncate">{sublabel}</span>
              </>
            )}
          </div>
        </div>

        {/* Trend badge */}
        {trend && !loading && !empty && !error && (
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0',
            'bg-zinc-800/60 ring-1 ring-zinc-700/40',
            trend.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'
          )}>
            {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.label}
          </span>
        )}
      </div>
    </motion.div>
  );
}
