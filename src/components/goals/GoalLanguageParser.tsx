import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LoaderCircle, Wand2, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { Input } from '../ui/input';
import type { GoalCategory, TrackingMode, CompletionLogic, CadenceConfig, CrossFeatureLink } from '../../types/goals';
import { DEFAULT_COMPLETION_LOGIC, DEFAULT_CADENCE_CONFIG } from '../../types/goals';

interface ParsedGoal {
  title: string;
  category: GoalCategory;
  period: 'daily' | 'weekly' | 'monthly';
  targetType: 'time' | 'completion' | 'external' | 'habit' | 'cross_feature';
  targetSeconds: number | null;
  externalActivityName: string | null;
  crossFeature: { feature: string; entityName: string } | null;
  cadenceConfig: CadenceConfig;
  trackingMode: TrackingMode;
  completionLogic: CompletionLogic;
}

interface GoalLanguageParserProps {
  onAccept: (parsed: ParsedGoal) => void;
  onCancel: () => void;
}

export function GoalLanguageParser({ onAccept, onCancel }: GoalLanguageParserProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedGoal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const api = (window as any).deskflowAPI;
      const result = await api?.goalAiParseLanguage?.(text.trim());
      if (result?.success && result.parsedGoal) {
        setParsed({
          title: result.parsedGoal.title || text.trim(),
          category: result.parsedGoal.category || 'work',
          period: result.parsedGoal.period || 'daily',
          targetType: result.parsedGoal.targetType || 'completion',
          targetSeconds: result.parsedGoal.targetSeconds || null,
          externalActivityName: result.parsedGoal.externalActivityName || null,
          crossFeature: result.parsedGoal.crossFeature || null,
          cadenceConfig: result.parsedGoal.cadenceConfig || DEFAULT_CADENCE_CONFIG,
          trackingMode: result.parsedGoal.trackingMode || 'manual',
          completionLogic: result.parsedGoal.completionLogic || DEFAULT_COMPLETION_LOGIC,
        });
      } else {
        setError(result?.error || 'Failed to parse goal');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to parse goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-zinc-300">
        <Wand2 size={14} className="text-violet-400" />
        Describe your goal in plain language
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. Practice guitar 3x a week for 20 minutes, but I travel so any 3 days is fine. Allow late completion with 1 day grace period."
        className="w-full h-20 px-3 py-2 rounded-xl bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 text-[12px] text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-violet-500/50"
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); parse(); } }}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={parse}
          disabled={!text.trim() || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 text-[11px] font-medium transition-colors"
        >
          {loading ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? 'Parsing...' : 'Parse with AI'}
        </button>
        <button onClick={onCancel} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-1.5">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <AnimatePresence>
        {parsed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2"
          >
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 size={12} /> Parsed goal:
            </div>
            <div className="text-[12px] text-zinc-200 font-medium">{parsed.title}</div>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className="px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">{parsed.category}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">{parsed.period}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">{parsed.targetType}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{parsed.trackingMode}</span>
              {parsed.cadenceConfig.type !== 'fixed' && (
                <span className="px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
                  {parsed.cadenceConfig.type}: {parsed.cadenceConfig.type === 'rolling' ? `${parsed.cadenceConfig.rollingTarget}x` : `any ${parsed.cadenceConfig.flexibleWindowDays}`}
                </span>
              )}
              {parsed.completionLogic.lateAllowed && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  late OK ({parsed.completionLogic.gracePeriodMinutes}m)
                </span>
              )}
              {parsed.completionLogic.partialCredit && (
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  partial credit
                </span>
              )}
            </div>
            <button
              onClick={() => onAccept(parsed)}
              className="w-full px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[11px] font-medium transition-colors"
            >
              Use this goal
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
