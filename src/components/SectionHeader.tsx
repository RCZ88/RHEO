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
          <div className="w-9 h-9 rounded-lg bg-[var(--page-accent)]/10 border border-[var(--page-accent)]/20 flex items-center justify-center text-[var(--page-accent)] light:bg-[var(--page-accent)]/15 light:border-[var(--page-accent)]/30">
            {icon}
          </div>
        )}
        <h2 className="text-[15px] font-semibold text-zinc-100 light:text-stone-900 ${titleClassName}">{title}</h2>
      </div>
      {action}
    </div>
  );
}
