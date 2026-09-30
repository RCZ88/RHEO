import * as React from "react";
import { useDroppable } from '@dnd-kit/core';
import { tierColor as getTierColor } from '../../../lib/tierColors';

export function TierContainer({ tier, color, label, description, creditLabel, children }: {
  tier: 'productive' | 'neutral' | 'distracting';
  color: string;
  label: string;
  description: string;
  creditLabel: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier });
  const tierColor = getTierColor(tier);
  return (
    <div ref={setNodeRef} className={`p-4 rounded-xl border transition-colors duration-150 ${isOver ? 'border-2 border-solid' : ''} ${tier === 'productive' ? 'bg-gradient-to-br from-[var(--tier-productive)]/10 to-transparent border-[var(--tier-productive)]/20' : tier === 'neutral' ? 'bg-gradient-to-br from-[var(--tier-neutral)]/10 to-transparent border-[var(--tier-neutral)]/20' : 'bg-gradient-to-br from-[var(--tier-distracting)]/10 to-transparent border-[var(--tier-distracting)]/20'}`}
      style={isOver ? { borderColor: tierColor, borderWidth: 2 } : undefined}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${tierColor} 0%, ${tierColor}88 100%)`, boxShadow: `0 0 10px ${tierColor}50` }} />
        <div><h3 className="font-semibold" style={{ color: tierColor }}>{label}</h3><span className="text-xs text-zinc-500">{creditLabel}</span></div>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{description}</p>
      <div className="flex flex-wrap gap-2 min-h-[48px]">{children}</div>
    </div>
  );
}
