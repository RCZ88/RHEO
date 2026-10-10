import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
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

  useEffect(() => {
    if (row.outcome === 'completed' && !hasSeenCompletion(row.id)) {
      celebrateFocusCompletion(cardRef.current);
      markCompletionSeen(row.id);
    }
  }, [row.id, row.outcome]);

  return (
    <div
      ref={cardRef}
      className="flex items-center gap-3 py-2 border-b border-zinc-800/40 last:border-0"
    >
      {/* Outcome dot + icon */}
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', meta.color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>

      {/* Duration bar */}
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

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-zinc-500">
          {new Date(row.started_at).toLocaleString(undefined, {
            month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit',
          })}
        </span>
        {row.outcome === 'failed' && row.broke_on_name && (
          <span className="text-[10px] text-rose-400 truncate max-w-[100px]">
            broke: {row.broke_on_name}
          </span>
        )}
        {row.outcome === 'completed' && row.return_count !== undefined && row.return_count > 0 && (
          <span className="text-[10px] text-zinc-500">
            +{row.return_count}x return
          </span>
        )}
        {row.strictness === 'non_allowed' && (
          <span className="text-[10px] text-amber-400">strict</span>
        )}
      </div>
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
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {rows.map(row => (
                <SessionRow key={row.id} row={row} />
              ))}
            </motion.div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
