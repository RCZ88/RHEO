import * as React from "react";
interface StickyHeaderProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function StickyHeader({ title, icon, actions, className = '' }: StickyHeaderProps) {
  return (
    <div className={`sticky top-0 z-[var(--z-sticky)] h-14 flex items-center justify-between px-5 bg-[var(--bg-secondary)]/90 backdrop-blur-lg border-b border-[var(--border-subtle)] ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-[var(--page-accent)]">{icon}</span>}
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
