import type { ReactNode } from 'react';

interface WarmCardProps {
  children: ReactNode;
  className?: string;
  ambient?: boolean;
}

export function WarmCard({ children, className = '', ambient }: WarmCardProps) {
  return (
    <div
      className={`relative rounded-xl border border-zinc-800/50 p-5 ${ambient ? 'bg-zinc-900/30' : 'bg-zinc-900/80'} ${className}`}
    >
      {ambient && <div className="warmth-aurora" />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
