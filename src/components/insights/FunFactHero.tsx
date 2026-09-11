import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, X } from 'lucide-react';
import { AnimatedGradientText } from '../ui/animated-gradient-text';

const DOMAIN_COLORS: Record<string, string> = {
  apps: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  browser: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20',
  productivity: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
  sleep: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20',
  git: 'from-orange-500/20 to-orange-600/5 border-orange-500/20',
  ai: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
  external: 'from-pink-500/20 to-pink-600/5 border-pink-500/20',
  focus: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
};

const DOMAIN_ACCENTS: Record<string, string> = {
  apps: 'text-blue-400',
  browser: 'text-cyan-400',
  productivity: 'text-emerald-400',
  sleep: 'text-indigo-400',
  git: 'text-orange-400',
  ai: 'text-purple-400',
  external: 'text-pink-400',
  focus: 'text-amber-400',
};

const DISMISS_KEY = 'deskflow-funfact-dismissed-date';

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function FunFactHero() {
  const [fact, setFact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const api = window.deskflowAPI;

  useEffect(() => {
    // Check if dismissed today
    try {
      const saved = localStorage.getItem(DISMISS_KEY);
      if (saved === getTodayStr()) {
        setDismissed(true);
        setLoading(false);
        return;
      }
    } catch {}

    if (!api?.getDailyFunFact) { setLoading(false); return; }
    api.getDailyFunFact().then((data: any) => {
      setFact(data);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Re-fetch on visibility change if day boundary crossed
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        try {
          const saved = localStorage.getItem(DISMISS_KEY);
          if (saved === getTodayStr()) {
            setDismissed(true);
            return;
          }
        } catch {}
        api?.getDailyFunFact?.().then((data: any) => {
          if (data?.copy?.headline) setFact(data);
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, getTodayStr()); } catch {}
  };

  if (loading || dismissed || !fact?.copy?.headline) return null;

  const gradient = DOMAIN_COLORS[fact.domain] || DOMAIN_COLORS.apps;
  const accent = DOMAIN_ACCENTS[fact.domain] || 'text-zinc-400';
  const direction = fact.comparison?.direction;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        className={`w-full rounded-xl border border-zinc-700/40 bg-gradient-to-br ${gradient} light:bg-[var(--color-card)]/85 p-4 relative overflow-hidden mb-4 light:border-[var(--ws-border)]`}
        style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.05)', lightBoxShadow: 'inset 0 1px 0 0 rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className={`w-3.5 h-3.5 ${accent}`} />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium light:text-stone-500">
                Today's insight
              </span>
            </div>
            <h3 className="text-base font-semibold text-zinc-100 leading-tight light:text-stone-900">
              <AnimatedGradientText colorFrom="#ec4899" colorTo="#f43f5e" speed={0.5}>
                {fact.copy.headline}
              </AnimatedGradientText>
            </h3>
            <p className="text-sm text-zinc-400 mt-0.5 light:text-stone-500">
              {fact.copy.subtext}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {direction && direction !== 'flat' && (
              <div className={`flex items-center gap-1 text-xs ${direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {direction === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{Math.abs(fact.comparison?.deltaPct || 0)}%</span>
              </div>
            )}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors light:text-stone-500 hover:light:text-stone-700 hover:light:bg-stone-200/60"
              title="Dismiss for today"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
