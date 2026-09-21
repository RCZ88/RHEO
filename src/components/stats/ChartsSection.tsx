import * as React from "react";
interface ChartsSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function ChartsSection({ children, className = '' }: ChartsSectionProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 ${className}`}>
      {children}
    </div>
  );
}
