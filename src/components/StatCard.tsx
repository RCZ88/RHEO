import * as React from "react";
import { GlassCard } from './GlassCard';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, trend, icon, className = '' }: StatCardProps) {
  return (
    <GlassCard className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1">{label}</p>
          <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{value}</p>
          {trend && (
            <p className={`text-[11px] font-medium mt-1 ${
              trend.direction === 'up' ? 'text-[var(--success)]' :
              trend.direction === 'down' ? 'text-[var(--error)]' :
              'text-[var(--text-muted)]'
            }`}>
              {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--page-accent)]/10 flex items-center justify-center text-[var(--page-accent)]">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
