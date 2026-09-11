import { type HTMLAttributes } from 'react';

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({ orientation = 'horizontal', className = '', ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      className={`shrink-0 bg-zinc-800/60 light:bg-zinc-200/60 ${orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px'} ${className}`}
      {...props}
    />
  );
}
