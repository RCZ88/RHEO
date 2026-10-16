import * as React from "react";
interface SectionHeaderProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

export function SectionHeader({ title, icon, action, className = '', titleClassName = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[var(--ws-accent-10)] border border-[var(--ws-accent)]/20 flex items-center justify-center text-[var(--ws-accent-text)] light:bg-[var(--ws-accent-15)] light:border-[var(--ws-accent)]/30">
            {icon}
          </div>
        )}
        <h2 className="text-[15px] font-semibold text-zinc-100 light:text-[var(--text-primary)] ${titleClassName}">{title}</h2>
      </div>
      {action}
    </div>
  );
}
