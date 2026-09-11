import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Edit3, Trash2, RefreshCw, Flame, Clock, Target,
  Monitor, AlertCircle, Zap, ArrowRight, Calendar
} from 'lucide-react';
import { confetti } from '../ui/confetti';
import type { Goal as GoalType } from '../dashboard/types';
import { EntityChip } from './EntityChip';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  work: { label: 'Work', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  personal: { label: 'Personal', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  health: { label: 'Health', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  learning: { label: 'Learning', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  finance: { label: 'Finance', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  relationships: { label: 'Relationships', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

interface GoalCardProps {
  goal: GoalType;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (goal: GoalType) => void;
  longTermGoals?: { id: string; title: string }[];
  todoCount?: number;
  linkedSchedules?: { id: string; title: string }[];
  linkedDeadlines?: { id: string; title: string }[];
  onOpenConnections?: (goal: GoalType) => void;
}

export function GoalCard({ goal, onToggle, onDelete, onEdit, longTermGoals = [], todoCount = 0, linkedSchedules = [], linkedDeadlines = [], onOpenConnections }: GoalCardProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleToggle = () => {
    if (goal.status !== 'done') {
      confetti({ particleCount: 60, spread: 90, startVelocity: 40, colors: ['#8b5cf6', '#a78bfa', '#34d399', '#fbbf24'] });
    }
    onToggle(goal.id);
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      onDelete(goal.id);
      setDeleteConfirm(false);
    } else {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(prev => prev ? false : prev), 3000);
    }
  };

  const catMeta = CATEGORY_STYLES[goal.category] || CATEGORY_STYLES.work;
  const isTime = goal.target.type === 'time';
  const isExternal = goal.target.type === 'external';
  const progress = isTime && goal.target.targetSeconds
    ? Math.min(100, ((goal.progressSeconds || 0) / goal.target.targetSeconds) * 100)
    : isExternal && goal.target.maxExternalSeconds
      ? Math.min(100, Math.max(0, 100 - ((goal.progressSeconds || 0) / goal.target.maxExternalSeconds) * 100))
      : goal.target.done ? 100 : 0;

  const parentIds = goal.parentIds?.length ? goal.parentIds : (goal.parentId ? [goal.parentId] : []);
  const parentGoals = parentIds
    .map(id => longTermGoals.find(l => l.id === id))
    .filter((p): p is { id: string; title: string } => !!p);

  return (
    <div className="group relative p-4 rounded-xl bg-[rgba(24,24,27,0.55)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)] hover:border-zinc-700/50 transition-all duration-200">
      <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-violet-500/20 via-violet-500/5 to-transparent" />

      <div className="flex items-start gap-3">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleToggle}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-200 ${
            goal.status === 'done'
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-zinc-600 hover:border-violet-400/50'
          }`}
          aria-label={goal.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
        >
          {goal.status === 'done' && <Check size={12} className="text-white" strokeWidth={3} />}
        </motion.button>

        <div className="flex-1 min-w-0">
          <div className={`text-[13px] truncate transition-colors ${
            goal.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'
          }`}>{goal.title}</div>

          {goal.description && (
            <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-1">{goal.description}</p>
          )}

          {parentGoals.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <ArrowRight size={8} className="text-zinc-600 shrink-0" />
              {parentGoals.map(p => (
                <span key={p.id} className="text-[10px] text-zinc-500 truncate">Serves: {p.title}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catMeta.color}`}>
              {catMeta.label}
            </span>
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <RefreshCw size={8} />{goal.period}
            </span>
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Target size={8} />{goal.target.type}
            </span>

            {/* Cross-feature link badge */}
            {goal.crossFeatureLink && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-violet-500/10 text-violet-400 border-violet-500/20">
                {goal.crossFeatureLink.feature}: {goal.crossFeatureLink.label}
              </span>
            )}

            {/* Linked schedule badge */}
            {goal.linkedScheduleId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                <Calendar size={8} className="inline mr-0.5" />Scheduled
              </span>
            )}

            <EntityChip kind="todo" label={`${todoCount} todo${todoCount === 1 ? '' : 's'}`} onClick={onOpenConnections ? () => onOpenConnections(goal) : undefined} />
            {linkedSchedules.slice(0, 1).map(schedule => <EntityChip key={schedule.id} kind="schedule" label={schedule.title} onClick={onOpenConnections ? () => onOpenConnections(goal) : undefined} />)}
            {linkedDeadlines.slice(0, 1).map(deadline => <EntityChip key={deadline.id} kind="deadline" label={deadline.title} onClick={onOpenConnections ? () => onOpenConnections(goal) : undefined} />)}

            {isTime && goal.target.targetSeconds && (
              <span className="text-[10px] text-zinc-600">
                {formatTime(goal.progressSeconds || 0)} / {formatTime(goal.target.targetSeconds)}
              </span>
            )}

            {isExternal && goal.target.maxExternalSeconds && (
              <span className={`text-[10px] ${(goal.progressSeconds || 0) > goal.target.maxExternalSeconds ? 'text-amber-400' : 'text-zinc-600'}`}>
                {formatTime(goal.progressSeconds || 0)} / {formatTime(goal.target.maxExternalSeconds)} max
              </span>
            )}

            {goal.detection?.enabled && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                goal.detection.mode === 'avoidance'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <Monitor size={8} className="inline mr-0.5" />
                auto
              </span>
            )}

            {goal.streak && goal.streak > 1 && (
              <span className="text-[10px] text-amber-500/80 flex items-center gap-0.5">
                <Flame size={8} />{goal.streak}
              </span>
            )}

            {goal.trackingMode && goal.trackingMode !== 'manual' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                goal.trackingMode === 'system'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              }`}>
                {goal.trackingMode === 'system' ? '⚙️ system' : '🔄 hybrid'}
              </span>
            )}

            {goal.completionLogic?.lateAllowed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                <Clock size={8} className="inline mr-0.5" />late OK
              </span>
            )}

            {goal.status === 'missed' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20">
                missed
              </span>
            )}
          </div>

          {isTime && goal.target.targetSeconds && (
            <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          )}

          {goal.detection?.enabled && goal.detection.keywords.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-zinc-600">Detect:</span>
              {goal.detection.keywords.map((kw, i) => (
                <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-zinc-800/50 text-zinc-500">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {goal.status === 'done' && goal.completedAt && (
            <div className="mt-1 text-[10px] text-emerald-600/80 flex items-center gap-1">
              <Check size={8} /> Completed {new Date(goal.completedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onEdit(goal)}
            className="w-7 h-7 rounded-md bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-white flex items-center justify-center transition-colors"
            title="Edit goal"
          >
            <Edit3 size={12} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              deleteConfirm
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
            }`}
            title={deleteConfirm ? 'Click again to confirm' : 'Delete goal'}
          >
            <Trash2 size={12} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export function GoalCardSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-zinc-800/30 rounded-xl" />
      ))}
    </div>
  );
}

export function GoalEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
        <Target size={24} className="text-zinc-600" />
      </div>
      <p className="text-[14px] font-medium text-zinc-400">No routines yet</p>
      <p className="text-[12px] text-zinc-600 mt-1 max-w-[220px]">
        Routines are the things you do daily or weekly. Add one to start tracking.
      </p>
      <button
        onClick={onAdd}
        className="mt-3 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors text-[12px] font-medium"
      >
        Add Routine
      </button>
    </div>
  );
}

export function GoalErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="w-14 h-14 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
        <AlertCircle size={24} className="text-zinc-600" />
      </div>
      <p className="text-[14px] font-medium text-zinc-400">Could not load goals</p>
      <p className="text-[12px] text-zinc-600 mt-1 max-w-[220px]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-700/50 hover:text-white transition-colors text-[12px] font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}
