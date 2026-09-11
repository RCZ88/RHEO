import { useState, useMemo } from 'react';
import { AlertTriangle, Globe, AppWindow, Clock, TrendingUp } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Distraction {
  name: string;
  type: 'app' | 'website';
  timestamp: number;
}

interface FocusDistractionLogProps {
  distractions: Distraction[];
  isActive: boolean;
}

interface DistractionGroup {
  name: string;
  type: 'app' | 'website';
  count: number;
  lastSeen: number;
}

export function FocusDistractionLog({ distractions, isActive }: FocusDistractionLogProps) {
  const [expanded, setExpanded] = useState(false);

  const groupedDistractions = useMemo(() => {
    const groups = new Map<string, DistractionGroup>();
    for (const d of distractions) {
      const key = `${d.type}:${d.name}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, d.timestamp);
      } else {
        groups.set(key, {
          name: d.name,
          type: d.type,
          count: 1,
          lastSeen: d.timestamp,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [distractions]);

  const totalDistractions = distractions.length;
  const uniqueDistractions = groupedDistractions.length;
  const websiteDistractions = groupedDistractions.filter(d => d.type === 'website').length;
  const appDistractions = groupedDistractions.filter(d => d.type === 'app').length;

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!isActive && distractions.length === 0) {
    return (
      <GlassCard className="h-full bg-zinc-900/95 border-zinc-800/60">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-zinc-500" />
          Distractions
        </h3>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-8 h-8 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
            <AlertTriangle className="w-4 h-4 text-zinc-600" />
          </div>
          <p className="text-xs text-zinc-500">No distractions yet</p>
          <p className="text-[10px] text-zinc-600 mt-1">
            {isActive ? 'Staying focused...' : 'Start a session to track'}
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full bg-zinc-900/95 border-zinc-800/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Distractions
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'text-[10px] px-2 py-0.5 rounded border transition-colors',
            expanded
              ? 'bg-zinc-700/60 text-zinc-300 border-zinc-700/60'
              : 'bg-zinc-800/40 text-zinc-500 hover:bg-zinc-700'
          )}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Mini stat strip */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/40">
          <div className="text-[15px] font-bold text-amber-400 tabular-nums">{totalDistractions}</div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Total</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/40">
          <div className="text-[15px] font-bold text-rose-400 tabular-nums">{appDistractions}</div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Apps</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-zinc-800/30 border border-zinc-800/40">
          <div className="text-[15px] font-bold text-orange-400 tabular-nums">{websiteDistractions}</div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Sites</div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {groupedDistractions.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-4"
          >
            <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
            <p className="text-[11px] text-emerald-400 font-medium">Perfect focus!</p>
            <p className="text-[10px] text-zinc-600 mt-1">No distractions detected</p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-1"
          >
            {(expanded ? groupedDistractions : groupedDistractions.slice(0, 4)).map((group) => (
              <div
                key={`${group.type}:${group.name}`}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-800/20 hover:bg-zinc-800/40 border border-transparent transition-colors"
              >
                <div className={cn(
                  'w-6 h-6 rounded flex items-center justify-center shrink-0',
                  group.type === 'app' ? 'bg-rose-500/12' : 'bg-orange-500/12'
                )}>
                  {group.type === 'app' ? (
                    <AppWindow className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Globe className="w-3 h-3 text-orange-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-zinc-200 truncate">{group.name}</div>
                  <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                    <span className="font-mono tabular-nums">{group.count}x</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-2 h-2" />
                      {fmtTime(group.lastSeen)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {!expanded && groupedDistractions.length > 4 && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-[10px] text-zinc-500 hover:text-zinc-400 py-1.5 text-center border border-dashed border-zinc-800/40 hover:border-zinc-700 transition-colors"
              >
                +{groupedDistractions.length - 4} more
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
