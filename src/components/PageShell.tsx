import * as React from "react";
interface PageShellProps {
  variant?: 'default' | 'sticky-header' | 'dashboard';
  page: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function PageShell({ variant = 'default', page, className = '', style, children }: PageShellProps) {
  const layoutClass = {
    default:       'p-5 space-y-4',
    'sticky-header': 'flex flex-col h-full',
    dashboard:     'p-5 space-y-4',
  }[variant];

  return (
    <div
      data-page={page}
      className={`relative ${page === 'terminal' ? 'h-full min-h-0' : 'min-h-full'} ${layoutClass} ${className}`}
      style={{ animation: 'pageEnter var(--normal) var(--ease-out)', ...style }}
    >
      {children}
    </div>
  );
}
