import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Clock, Monitor } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NumberTicker } from '../ui/number-ticker';

interface FocusSession {
  apps: string[];
  app: string;
  category: string;
  title: string;
  durationSeconds: number;
  startTime: string;
  endTime: string;
}

interface LongestFocusData {
  today: FocusSession[];
  week: FocusSession[];
  allTime: FocusSession[];
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getSessionColor(seconds: number): string {
  if (seconds >= 3600) return '#10b981';
  if (seconds >= 1800) return '#34d399';
  if (seconds >= 600) return '#6ee7b7';
  return '#a7f3d0';
}

function getRankBadge(index: number) {
  if (index === 0) return { label: '#1', color: '#fbbf24' };
  if (index === 1) return { label: '#2', color: '#94a3b8' };
  return { label: '#3', color: '#b45309' };
}

interface LongestFocusCardProps {
  data: LongestFocusData | null;
  loading?: boolean;
}

export function LongestFocusCard({ data, loading }: LongestFocusCardProps) {
  const [view, setView] = useState<'today' | 'week' | 'allTime'>('today');
  const sessions = data?.[view] ?? [];
  const topSession = sessions[0];
  const color = topSession ? getSessionColor(topSession.durationSeconds) : '#34d399';

  return (
    <Card className="rounded-[10px] h-full">
      <CardContent className="p-4 sm:p-5 h-full flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Zap size={14} style={{ color }} />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] light:text-stone-900">
              Focus Sessions
            </span>
          </div>
          <div className="flex light:bg-stone-100 light:border-[var(--ws-border)] rounded-lg p-0.5 border border-white/10">
            {(['today', 'week', 'allTime'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  view === v
                    ? 'light:bg-[rgb(28 25 23 / 0.04)] light:text-stone-900'
                    : 'light:text-stone-400 hover:light:text-stone-500'
                }`}
              >
                {v === 'allTime' ? 'Best' : v === 'today' ? 'Today' : 'Week'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <Monitor size={20} className="light:text-stone-500" />
            <div className="text-[11px] light:text-stone-400">
              No productive session yet{view === 'today' ? ' today' : view === 'week' ? ' this week' : ''}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {/* Top session hero */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-0`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-baseline gap-1"
              >
                <span className="text-3xl sm:text-4xl font-mono font-bold tabular-nums light:text-stone-900">
                  <NumberTicker value={Math.floor(topSession!.durationSeconds / 60)} />
                </span>
                <span className="text-sm font-medium light:text-stone-700">min</span>
                {topSession!.durationSeconds >= 3600 && (
                  <span className="text-xs light:text-stone-400 ml-1">
                    ({formatDuration(topSession!.durationSeconds)})
                  </span>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Top session info */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {topSession!.apps.length <= 2 ? (
                topSession!.apps.map((a, i) => (
                  <span key={i} className="text-[11px] font-medium light:text-stone-900">{a}{i < topSession!.apps.length - 1 ? ' · ' : ''}</span>
                ))
              ) : (
                <span className="text-[11px] font-medium light:text-stone-900">{topSession!.apps.length} apps — {topSession!.apps.slice(0, 2).join(', ')}</span>
              )}
              <span className="text-[10px] light:text-stone-500 px-1.5 py-0.5 rounded light:bg-[rgb(28 25 23 / 0.04)]">{topSession!.category}</span>
            </div>

            {/* Remaining sessions */}
            <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-auto">
              {sessions.slice(1).map((s, i) => {
                const rank = getRankBadge(i + 1);
                const sColor = getSessionColor(s.durationSeconds);
                return (
                  <div
                    key={`${view}-${i + 1}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg light:bg-[rgb(28 25 23 / 0.04)] border border-white/5"
                  >
                    <span
                      className="text-[10px] font-bold w-4 text-center shrink-0"
                      style={{ color: rank.color }}
                    >
                      {rank.label}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sColor }} />
                    <span className="text-[11px] light:text-stone-800 truncate flex-1 min-w-0">
                      {s.apps.length <= 2 ? s.apps.join(' · ') : `${s.apps.length} apps`}
                    </span>
                    <span className="text-[11px] font-mono font-medium light:text-stone-700 tabular-nums shrink-0">
                      {formatDuration(s.durationSeconds)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick cross-stats */}
            <div className="flex gap-2 pt-2 border-t border-white/10 shrink-0">
              {data?.today && view !== 'today' && data.today[0] && (
                <div className="text-[10px]">
                  <span className="light:text-stone-400">Today </span>
                  <span className="light:text-stone-800 font-medium">{formatDuration(data.today[0].durationSeconds)}</span>
                </div>
              )}
              {data?.week && view !== 'week' && data.week[0] && (
                <div className="text-[10px]">
                  <span className="light:text-stone-400">Week </span>
                  <span className="light:text-stone-800 font-medium">{formatDuration(data.week[0].durationSeconds)}</span>
                </div>
              )}
              {data?.allTime && view !== 'allTime' && data.allTime[0] && (
                <div className="text-[10px]">
                  <span className="light:text-stone-400">Best </span>
                  <span className="light:text-stone-800 font-medium">{formatDuration(data.allTime[0].durationSeconds)}</span>
                </div>
              )}
            </div>
          </div>
        )}
    </CardContent>
    </Card>
  );
}
