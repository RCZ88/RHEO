import * as React from "react";
interface TerminalTabProps {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  accentColor?: string;
  onClick: () => void;
  className?: string;
}

export function TerminalTab({ label, icon, active, accentColor = 'var(--page-accent)', onClick, className = '' }: TerminalTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors duration-150 relative border-b-2 ${
        active
          ? 'text-[var(--text-primary)] border-b-2'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-transparent'
      } ${className}`}
      style={active ? { borderBottomColor: accentColor } : undefined}
    >
      {icon}
      <span className="truncate max-w-[120px]">{label}</span>
    </button>
  );
}
