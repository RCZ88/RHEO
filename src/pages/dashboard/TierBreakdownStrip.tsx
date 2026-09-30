import { motion } from 'framer-motion';
import { CheckCircle2, MinusCircle, XCircle, Clock } from 'lucide-react';
import { BlurFade } from '../../components/ui/blur-fade';
import { NumberTicker } from '../../components/ui/number-ticker';
import { tierColor } from '../../lib/tierColors';

interface TierBreakdownStripProps {
  productiveHours: number;
  neutralHours: number;
  distractingHours: number;
  totalHours: number;
}

export function TierBreakdownStrip({
  productiveHours,
  neutralHours,
  distractingHours,
  totalHours,
}: TierBreakdownStripProps) {
  const stats = [
    {
      label: 'Productive',
      value: productiveHours,
      color: tierColor('productive'),
      textColor: 'text-[var(--tier-productive)]',
      borderColor: 'border-t-[var(--tier-productive)]/30',
      icon: <CheckCircle2 size={14} />
    },
    {
      label: 'Neutral',
      value: neutralHours,
      color: tierColor('neutral'),
      textColor: 'text-[var(--tier-neutral)]',
      borderColor: 'border-t-[var(--tier-neutral)]/30',
      icon: <MinusCircle size={14} />
    },
    {
      label: 'Distracting',
      value: distractingHours,
      color: tierColor('distracting'),
      textColor: 'text-[var(--tier-distracting)]',
      borderColor: 'border-t-[var(--tier-distracting)]/30',
      icon: <XCircle size={14} />
    },
    {
      label: 'Total',
      value: totalHours,
      color: '#ec4899',
      textColor: 'text-pink-400 light:text-pink-600',
      borderColor: 'border-t-pink-400/30',
      icon: <Clock size={14} />
    },
  ];

  return (
    <BlurFade delay={0.15} duration={0.4}>
      <div className="bg-zinc-950 light:bg-white backdrop-blur-xl border border-zinc-800 light:border-[var(--ws-border)] rounded-xl mb-4 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`relative p-4 ${i < stats.length - 1 ? 'border-r border-[#27272a] light:border-[var(--ws-border)]' : ''} ${stat.borderColor} border-t-[1px]`}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ color: stat.color }}>{stat.icon}</span>
                <span className="text-[11px] text-zinc-500 light:text-stone-500 uppercase tracking-wider font-medium">
                  {stat.label}
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-mono font-bold ${stat.textColor}`}>
                  <NumberTicker 
                    value={Math.round(stat.value * 10) / 10} 
                    decimals={1}
                    delay={400 + i * 100}
                    duration={1200}
                  />
                </span>
                <span className="text-[12px] text-zinc-500 light:text-stone-400">h</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </BlurFade>
  );
}
