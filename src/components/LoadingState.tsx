interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton';
  rows?: number;
  className?: string;
}

export function LoadingState({ variant = 'spinner', rows = 3, className = '' }: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="animate-pulse bg-zinc-800 rounded-xl h-16 light:bg-stone-200/70" />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-5 h-5 border-2 border-zinc-700 rounded-full animate-spin light:border-stone-200" style={{ borderTopColor: 'var(--page-accent)' }} />
    </div>
  );
}
