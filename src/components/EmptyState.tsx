import * as React from "react";
interface EmptyStateProps {
  icon?: React.ReactNode;
  iconComponent?: React.ComponentType<any>;
  title: string;
  description?: string;
  hint?: string;
  action?: { label: string; onClick: () => void } | React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, iconComponent: IconComp, title, description, hint, action, className = '' }: EmptyStateProps) {
  const iconEl = icon || (IconComp ? (
    <div className="w-9 h-9 rounded-lg border border-zinc-800/60 bg-zinc-900 flex items-center justify-center light:border-[var(--ws-border)] light:bg-white">
      <IconComp className="w-4 h-4 text-zinc-600 light:text-stone-500" />
    </div>
  ) : null);

  const descEl = description || hint;

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {iconEl && <div className="text-[var(--text-muted)] mb-3">{iconEl}</div>}
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      {descEl && <p className="text-xs text-[var(--text-muted)] mt-1 text-center max-w-xs">{descEl}</p>}
      {action && (
        'onClick' in (action as any) ? (
          <button
            onClick={(action as { label: string; onClick: () => void }).onClick}
            className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors duration-150 light:bg-[var(--ws-accent)] light:text-white light:hover:bg-[var(--ws-accent-hover)]"
          >
            {(action as { label: string; onClick: () => void }).label}
          </button>
        ) : (
          <div className="mt-3">{action as React.ReactNode}</div>
        )
      )}
    </div>
  );
}
