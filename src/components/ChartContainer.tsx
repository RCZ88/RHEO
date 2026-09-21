import * as React from "react";
import { GlassCard } from './GlassCard';

interface ChartContainerProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export function ChartContainer({ title, className = '', children }: ChartContainerProps) {
  return (
    <GlassCard className={className}>
      <p className="text-[11px] font-medium text-[var(--text-muted)] mb-3">{title}</p>
      <div className="relative h-48">
        {children}
      </div>
    </GlassCard>
  );
}
