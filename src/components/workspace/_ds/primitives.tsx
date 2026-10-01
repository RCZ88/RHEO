// ============================================================================
// Workspace Design System — Primitives
// Small, composable, accessible building blocks shared by every workspace tab.
// Styling uses Tailwind arbitrary values bound to the app's CSS variables so
// colors stay consistent and theme-aware.
// ============================================================================
import React from 'react';
import { motion } from 'framer-motion';
import { popItem, SPRING_SNAPPY } from './motion';

// Reusable motion prop objects (kept as consts to stay JSX-safe).
const TAP = { scale: 0.95 };
const TAP_SM = { scale: 0.9 };
const HOVER_GROW = { scale: 1.08 };
const EMPTY_INIT = { opacity: 0, y: 8 };
const EMPTY_SHOW = { opacity: 1, y: 0 };
const EMPTY_TRANS = { duration: 0.25, ease: [0.16, 1, 0.3, 1] };
const BAR_INIT = { width: 0 };

// ---- Status model (shared across Prompt History, Sessions, Issues) ---------
export type WorkStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export const STATUS_META: Record<WorkStatus, { label: string; cls: string; dot: string }> = {
  pending:     { label: 'Pending',    cls: 'text-zinc-400 bg-zinc-500/15 ring-1 ring-zinc-500/30',   dot: '#a1a1aa' },
  in_progress: { label: 'Processing', cls: 'text-cyan-300 bg-cyan-500/15 ring-1 ring-cyan-400/40',    dot: '#22d3ee' },
  completed:   { label: 'Completed',  cls: 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30', dot: '#34d399' },
  failed:      { label: 'Failed',     cls: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30',      dot: '#f87171' },
};

// ---- StatusPill ------------------------------------------------------------
export const StatusPill: React.FC<{ status: WorkStatus; icon?: React.ReactNode; compact?: boolean }> = ({ status, icon, compact }) => {
  const m = STATUS_META[status] ?? STATUS_META.completed;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${m.cls} ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'}`}>
      {icon}
      {m.label}
    </span>
  );
};

// ---- Chip (filter / tag) ---------------------------------------------------
export const Chip: React.FC<{
  active?: boolean; onClick?: () => void; children: React.ReactNode; title?: string;
}> = ({ active, onClick, children, title }) => (
  <motion.button
    type="button" onClick={onClick} title={title} variants={popItem} whileTap={TAP}
    className={`inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium px-2.5 min-h-[28px] transition-colors focus-visible:outline-none ${
      active
        ? 'text-[color:var(--page-accent)] bg-[color-mix(in_srgb,var(--page-accent)_16%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--page-accent)_38%,transparent)]'
        : 'text-zinc-400 bg-zinc-800 ring-1 ring-zinc-700/60 hover:text-zinc-200 hover:bg-zinc-700/60'
    }`}
  >
    {children}
  </motion.button>
);

// ---- Segmented progress bar (per-session completion) -----------------------
export const ProgressBar: React.FC<{ value: number; total: number }> = ({ value, total }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const widthAnim = { width: `${pct}%` };
  return (
    <div className="flex items-center gap-2" title={`${value} of ${total} completed`}>
      <div className="relative h-1.5 flex-1 min-w-[48px] overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
          initial={BAR_INIT} animate={widthAnim} transition={SPRING_SNAPPY}
        />
      </div>
      <span className="tabular-nums text-[10px] text-zinc-500">{value}/{total}</span>
    </div>
  );
};

// ---- Skeleton (loading) ----------------------------------------------------
export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-3 w-full' }) => (
  <div className={`animate-pulse rounded-md bg-gradient-to-r from-zinc-800 via-zinc-700/70 to-zinc-800 ${className}`} />
);

// ---- IconButton (comfortable hit area, accessible) -------------------------
export const IconButton: React.FC<{
  onClick?: (e: React.MouseEvent) => void; title: string; children: React.ReactNode; danger?: boolean; className?: string;
}> = ({ onClick, title, children, danger, className = '' }) => (
  <motion.button
    type="button" onClick={onClick} title={title} aria-label={title} whileTap={TAP_SM} whileHover={HOVER_GROW}
    className={`grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition-colors focus-visible:outline-none ${
      danger ? 'hover:text-red-400 hover:bg-red-500/10' : 'hover:text-zinc-100 hover:bg-zinc-700/60'
    } ${className}`}
  >
    {children}
  </motion.button>
);

// ---- EmptyState ------------------------------------------------------------
export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }> = ({ icon, title, hint, action }) => (
  <motion.div
    initial={EMPTY_INIT} animate={EMPTY_SHOW} transition={EMPTY_TRANS}
    className="flex flex-col items-center justify-center py-12 text-center"
  >
    <div className="mb-3 grid h-13 w-13 place-items-center rounded-xl bg-zinc-800/80 text-zinc-500" style={SIZE_52}>
      {icon}
    </div>
    <p className="text-[13px] font-medium text-zinc-300">{title}</p>
    {hint && <p className="mt-1 max-w-[260px] text-[11px] text-zinc-500">{hint}</p>}
    {action && <div className="mt-3">{action}</div>}
  </motion.div>
);
const SIZE_52 = { width: 52, height: 52 };

// ---- WorkspaceError ---------------------------------------------------------
// Unified error state for ALL workspace data views.
export const WorkspaceError: React.FC<{
  title?: string; message: string; onRetry?: () => void; className?: string;
}> = ({ title = 'Something went wrong', message, onRetry, className = '' }) => (
  <motion.div
    initial={EMPTY_INIT} animate={EMPTY_SHOW} transition={EMPTY_TRANS}
    className={`flex flex-col items-center justify-center py-10 text-center ${className}`}
  >
    <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-red-500/10 text-red-400">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    </div>
    <p className="text-[13px] font-medium text-zinc-300">{title}</p>
    <p className="mt-1 max-w-[280px] text-[11px] text-zinc-500">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-300 bg-zinc-800 ring-1 ring-zinc-700/60 hover:bg-zinc-700/60 hover:text-zinc-100 transition-all duration-150 active:scale-[0.97]"
      >
        Retry
      </button>
    )}
  </motion.div>
);
