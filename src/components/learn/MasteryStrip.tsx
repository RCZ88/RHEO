import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { MasteryRing } from './MasteryRing';
import { useMasteryStats, LEVEL_ORDER, LEVEL_COLORS, type MasteryStats } from './useMasteryStats';
import type { MasteryLevel } from '../../shared/learn/types';

interface Props {
  stats: MasteryStats;
  onOpenNode?: (nodeId: string) => void;
  onOpenProfile?: () => void;
}

function modalLevel(dist: Record<MasteryLevel, number>): MasteryLevel {
  let best: MasteryLevel = 'L0';
  let max = 0;
  for (const l of LEVEL_ORDER) {
    if (dist[l] > max) { max = dist[l]; best = l; }
  }
  return best;
}

export function MasteryStrip({ stats, onOpenNode, onOpenProfile }: Props) {
  const [dueOpen, setDueOpen] = useState(false);

  if (stats.trackedNodes === 0 && stats.totalNodes === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#1c1917]/60 backdrop-blur-sm px-6 py-5 mb-10 relative">
        <p className="text-sm text-sage-400/70 italic font-serif text-center">
          Your mastery map fills in as you study — open a volume to begin.
        </p>
        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            className="absolute top-3 right-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 hover:text-clay-300 transition"
          >
            Edit preferences
          </button>
        )}
      </div>
    );
  }

  const modal = modalLevel(stats.distribution);

  return (
    <div className="rounded-xl border border-white/10 bg-[#1c1917]/60 backdrop-blur-sm px-6 py-5 mb-10 relative">
      {/* subtle top sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      {onOpenProfile && (
        <button
          onClick={onOpenProfile}
          className="absolute top-3 right-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 hover:text-clay-300 transition"
        >
          Edit preferences
        </button>
      )}

      <div className="flex items-center gap-6 flex-wrap">
        {/* Zone 1: Progress dial + headline */}
        <div className="flex items-center gap-3">
          <MasteryRing level={modal} size={44} strokeWidth={4} animated={false} />
          <div>
            <div className="font-serif text-3xl text-glow leading-none">
              {stats.proficientPlus}
              <span className="text-lg text-zinc-500"> / {stats.totalNodes}</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-clay-300 mt-1">
              Mastered
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-white/10 hidden sm:block" />

        {/* Zone 2: Level distribution */}
        <div className="flex items-end gap-2 flex-1 min-w-0">
          {LEVEL_ORDER.map((level) => {
            const count = stats.distribution[level];
            const pct = stats.trackedNodes > 0 ? (count / stats.trackedNodes) * 100 : 0;
            const barH = Math.max(4, pct * 1.4);
            return (
              <div key={level} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <MasteryRing level={level} target={level} size={22} strokeWidth={2} animated={false} />
                <div
                  className="w-full rounded-full transition-all"
                  style={{
                    height: `${barH}px`,
                    backgroundColor: LEVEL_COLORS[level],
                    opacity: count > 0 ? 0.85 : 0.15,
                  }}
                />
                <div className="font-mono text-[10px] text-zinc-500">{level}</div>
                <div className="text-xs font-medium text-zinc-400">{count}</div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-white/10 hidden sm:block" />

        {/* Zone 3: Due reviews */}
        <div className="relative">
          {stats.dueCount > 0 ? (
            <button
              onClick={() => setDueOpen(!dueOpen)}
              className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:bg-amber-500/25 transition"
            >
              {stats.dueCount} due
              <ChevronDown className={`w-3 h-3 transition-transform ${dueOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-sage-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Up to date</span>
            </div>
          )}

          {/* Due popover */}
          <AnimatePresence>
            {dueOpen && stats.dueItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-xl z-20 overflow-hidden"
              >
                <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {stats.dueItems.slice(0, 8).map((item) => (
                    <button
                      key={item.nodeId}
                      onClick={() => { onOpenNode?.(item.nodeId); setDueOpen(false); }}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition text-left"
                    >
                      <span className="text-xs text-zinc-300 truncate">{item.nodeId}</span>
                      <span className="text-[10px] text-amber-400 shrink-0 ml-2">
                        Due {new Date(item.dueAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
