import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { EmptyState } from '../../components/EmptyState';
import type { FocusHistoryRow } from './focusHelpers';
import { fmtDuration } from './focusHelpers';
import { celebrateFocusCompletion, hasSeenCompletion, markCompletionSeen } from './focusConfetti';
import { cn } from '@/lib/utils';

interface FocusHistoryProps {
  history: FocusHistoryRow[];
  onStartFirstSession: () => void;
}

const OUTCOME_META: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-rose-400', label: 'Broken' },
  aborted: { icon: AlertTriangle, color: 'text-amber-400', label: 'Aborted' },
  active: { icon: Clock, color: 'text-pink-400', label: 'Active' },
};

function SessionRow({ row }: { row: FocusHistoryRow }) {
  const meta = OUTCOME_META[row.outcome] || OUTCOME_META.active;
  const Icon = meta.icon;
  const pct = row.planned_sec > 0 ? Math.min(100, Math.round((row.actual_sec || row.planned_sec) / row.planned_sec * 100)) : 100;
  const cardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (row.outcome === 'completed' && !hasSeenCompletion(row.id)) {
      celebrateFocusCompletion(cardRef.current);
      markCompletionSeen(row.id);
    }
  }, [row.id, row.outcome]);

  const startTime = new Date(row.started_at);
  const dateStr = startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = startTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endTime = row.ended_at ? new Date(row.ended_at) : null;
  const endTimeStr = endTime ? endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <div ref={cardRef} className="border-b border-zinc-800/40 last:border-0">
      {/* Main row — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-zinc-800/20 rounded-lg transition-colors px-1 group"
        aria-expanded={expanded}
      >
        {/* Outcome icon */}
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', meta.color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Duration + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-zinc-200 tabular-nums">
              {row.actual_sec ? fmtDuration(row.actual_sec) : fmtDuration(row.planned_sec)}
            </span>
            <span className="text-[10px] text-zinc-600">
              of {fmtDuration(row.planned_sec)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-zinc-800/60 mt-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: meta.color }}
            />
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-zinc-500">
            {dateStr} · {timeStr}
          </span>
          {row.outcome === 'failed' && row.broke_on_name && (
            <span className="text-[10px] text-rose-400 truncate max-w-[100px]">
              broke: {row.broke_on_name}
            </span>
          )}
          {row.strictness === 'non_allowed' && (
            <span className="text-[10px] text-amber-400">strict</span>
          )}
          {/* Expand chevron */}
          <ChevronRight className={cn(
            'w-3.5 h-3.5 text-zinc-600 transition-transform duration-150 shrink-0',
            expanded && 'rotate-90'
          )} />
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pb-3 pt-1 px-1">
              <div className="rounded-lg bg-zinc-800/30 border border-zinc-800/40 p-3 space-y-2">
                {/* Time details */}
                <div className="flex items-center gap-4 text-[11px]">
                  <div>
                    <span className="text-zinc-500">Started:</span>{' '}
                    <span className="text-zinc-300">{dateStr} at {timeStr}</span>
                  </div>
                  {endTimeStr && (
                    <div>
                      <span className="text-zinc-500">Ended:</span>{' '}
                      <span className="text-zinc-300">{endTimeStr}</span>
                    </div>
                  )}
                </div>

                {/* Duration comparison */}
                <div className="flex items-center gap-4 text-[11px]">
                  <div>
                    <span className="text-zinc-500">Planned:</span>{' '}
                    <span className="text-zinc-300">{fmtDuration(row.planned_sec)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Actual:</span>{' '}
                    <span className="text-zinc-300">{row.actual_sec ? fmtDuration(row.actual_sec) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Completion:</span>{' '}
                    <span className="text-zinc-300">{pct}%</span>
                  </div>
                </div>

                {/* Session metadata */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full',
                    row.outcome === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    row.outcome === 'failed' ? 'bg-rose-500/10 text-rose-400' :
                    row.outcome === 'aborted' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-zinc-700/50 text-zinc-400'
                  )}>
                    {meta.label}
                  </span>
                  {row.strictness === 'non_allowed' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                      Strict mode
                    </span>
                  )}
                  {row.return_count !== undefined && row.return_count > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">
                      {row.return_count}x return visits
                    </span>
                  )}
                </div>

                {/* Break info for failed sessions */}
                {row.outcome === 'failed' && row.broke_on_name && (
                  <div className="text-[11px] text-rose-300/80">
                    Broke focus on: <span className="font-medium">{row.broke_on_name}</span>
                  </div>
                )}

                {/* Session ID */}
                <div className="text-[9px] text-zinc-600 font-mono">
                  Session #{row.id}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FocusHistory({ history, onStartFirstSession }: FocusHistoryProps) {
  const emptyAction = { label: 'Start your first session', onClick: onStartFirstSession };

  if (history.length === 0) {
    return (
      <GlassCard className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border-zinc-800/60">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--page-accent)]" />
          Session history
        </h3>
        <EmptyState
          iconComponent={Clock}
          title="No focus sessions yet"
          description="Your first deep-work session is one click away."
          action={emptyAction}
        />
      </GlassCard>
    );
  }

  // Group by date
  const grouped = history.reduce((acc, row) => {
    const day = new Date(row.started_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(row);
    return acc;
  }, {} as Record<string, FocusHistoryRow[]>);

  return (
    <GlassCard className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] border-zinc-800/60">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-[var(--page-accent)]" />
        Session history
      </h3>

      <div className="max-h-[420px] overflow-y-auto ws-scroll pr-1">
        {Object.entries(grouped).map(([day, rows]) => (
          <div key={day}>
            <div className="flex items-center gap-2 px-1 mb-1.5 mt-1">
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{day}</span>
              <div className="flex-1 h-px bg-zinc-800/40" />
            </div>
            {rows.map(row => (
              <SessionRow key={row.id} row={row} />
            ))}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
