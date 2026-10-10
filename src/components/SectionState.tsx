import { AlertCircle, PieChart, BarChart3, Clock } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

interface SectionStateProps {
  kind: 'loading' | 'empty' | 'error';
  message?: string;
  hint?: string;
  chart?: 'pie' | 'bar' | 'card';
  onRetry?: () => void;
  /** Optional extra content below the message (install links, steps). Additive. */
  children?: React.ReactNode;
}

export function SectionState({ kind, message, hint, chart, onRetry, children }: SectionStateProps) {
  if (kind === 'loading') {
    if (chart === 'pie') {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="relative w-40 h-40">
            <div className="absolute inset-0 rounded-full animate-pulse bg-zinc-800/60" />
            <div className="absolute inset-4 rounded-full bg-zinc-900/80 light:bg-[var(--ws-surface-raised)]" />
          </div>
        </div>
      );
    }
    if (chart === 'bar') {
      return (
        <div className="flex items-end gap-2 h-56 px-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${30 + Math.random() * 50}%` }} />
          ))}
        </div>
      );
    }
    if (chart === 'card') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] rounded-xl p-5 space-y-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (kind === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-8 h-8 text-amber-400 mb-3" />
        <p className="text-sm text-amber-300 font-medium">{message || 'Failed to load data'}</p>
        {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const Icon = chart === 'pie' ? PieChart : chart === 'bar' ? BarChart3 : Clock;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-8 h-8 text-zinc-700 mb-3" />
      <p className="text-sm text-zinc-500">{message || 'No data available'}</p>
      {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
      {children}
    </div>
  );
}
