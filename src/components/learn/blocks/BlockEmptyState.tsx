import React from 'react';
import { Inbox } from 'lucide-react';

interface BlockEmptyStateProps {
  icon?: React.ReactNode;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function BlockEmptyState({ icon, message, action }: BlockEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="w-12 h-12 rounded-xl bg-zinc-800/60 border border-zinc-700/30 flex items-center justify-center">
        {icon || <Inbox className="w-5 h-5 text-zinc-600" />}
      </div>
      <p className="text-sm text-zinc-500">{message || 'No content to display'}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-medium border border-amber-500/20 hover:bg-amber-500/25 transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
