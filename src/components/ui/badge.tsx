import { type HTMLAttributes } from 'react';

const variants = {
  default: 'bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20 light:bg-pink-500/15 light:text-pink-600',
  secondary: 'bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700 light:bg-zinc-100 light:text-zinc-700 light:ring-zinc-200',
  outline: 'bg-transparent text-zinc-400 ring-1 ring-zinc-800 light:bg-transparent light:text-zinc-500 light:ring-zinc-300',
  destructive: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 light:bg-red-50 light:text-red-600 light:ring-red-200',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ variant = 'default', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
