import { motion } from 'motion/react';
import { Sparkles, Target, TrendingUp, Moon, Brain, Zap, Globe } from 'lucide-react';
import { BlurFade } from '../../components/ui/blur-fade';

interface InsightAtom {
  id: string;
  kind: string;
  domain: string;
  value?: number;
  unit?: string;
  copy: { headline: string; subtext: string };
}

const DOMAIN_ACCENT: Record<string, string> = {
  focus: '#f472b6',
  finance: '#34d399',
  learn: '#22d3ee',
  sleep: '#818cf8',
  productivity: '#fbbf24',
  external: '#38bdf8',
  app: '#a78bfa',
};

const DOMAIN_ICON: Record<string, React.ReactNode> = {
  focus: <Target size={16} />,
  finance: <TrendingUp size={16} />,
  learn: <Brain size={16} />,
  sleep: <Moon size={16} />,
  productivity: <Zap size={16} />,
  external: <Globe size={16} />,
  app: <Zap size={16} />,
};

interface InsightStripProps {
  insights?: InsightAtom[];
}

export function InsightStrip({ insights = [] }: InsightStripProps) {
  if (insights.length === 0) return null;

  return (
    <BlurFade delay={0.12} duration={0.4}>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-pink-400" />
          <span className="text-[13px] font-semibold text-zinc-300 light:text-stone-800">AI Insights</span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {insights.map((insight, i) => {
            const accent = DOMAIN_ACCENT[insight.domain] || '#a1a1aa';
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.16 + i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex-shrink-0 w-[280px] bg-[#18181b] light:bg-white border border-[#27272a] light:border-[var(--ws-border)] rounded-xl p-4 hover:border-[#3f3f46] hover:light:border-[var(--ws-border-strong)] hover:-translate-y-0.5 transition-all duration-150 overflow-hidden"
              >
                <div className="absolute top-0 left-4 right-4 h-px opacity-50 pointer-events-none"
                  style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }} />

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${accent}18`, color: accent }}>
                    {DOMAIN_ICON[insight.domain] || <Sparkles size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-semibold text-zinc-200 light:text-stone-900 truncate">
                      {insight.copy.headline}
                    </h4>
                    <p className="text-[12px] text-zinc-500 light:text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {insight.copy.subtext}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-[10px] text-zinc-600 light:text-stone-400 uppercase tracking-widest font-medium">
                    {insight.domain}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </BlurFade>
  );
}
