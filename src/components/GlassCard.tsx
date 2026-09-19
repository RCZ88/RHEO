type Accent = 'pink' | 'amber' | 'emerald' | 'none';

const accentConfig: Record<string, { rail: string; border: string; bg: string; edge: string, railLight: string; borderLight: string; bgLight: string }> = {
  pink:  { rail: 'bg-pink-500/60',     border: 'border-l-pink-500/20 hover:border-l-pink-500/30',   bg: 'bg-pink-500/[0.02]',  edge: 'border-pink-500/30', railLight: 'bg-pink-500/40', borderLight: 'border-l-pink-400/30', bgLight: 'bg-pink-500/[0.04]' },
  amber: { rail: 'bg-amber-500/60',    border: 'border-l-amber-500/20 hover:border-l-amber-500/30', bg: 'bg-amber-500/[0.02]', edge: 'border-amber-500/30', railLight: 'bg-amber-500/40', borderLight: 'border-l-amber-400/30', bgLight: 'bg-amber-500/[0.04]' },
  emerald: { rail: 'bg-emerald-500/60',border: 'border-l-emerald-500/20 hover:border-l-emerald-500/30', bg: 'bg-emerald-500/[0.02]', edge: 'border-emerald-500/30', railLight: 'bg-emerald-500/40', borderLight: 'border-l-emerald-400/30', bgLight: 'bg-emerald-500/[0.04]' },
};

interface GlassCardProps {
  variant?: 'default' | 'compact' | 'subtle' | 'notebook' | 'bordered' | 'elevated' | 'interactive';
  accent?: Accent;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const variantStyles: Record<string, string> = {
  default:   'bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/50 light:bg-[var(--color-card)] light:border-[var(--ws-border)]',
  compact:   'bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/40 p-3 light:bg-[var(--color-card)] light:border-[var(--ws-border)]',
  subtle:    'bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/30 light:bg-[color-mix(in_srgb,var(--color-card)_60%,transparent)] light:border-[var(--ws-border)]',
  notebook:  'bg-[var(--color-card)] border-l-2 light:bg-[var(--color-card)] light:border-l-2 light:border-l-stone-300',
  bordered:  'bg-transparent border-[1.5px] light:border-[var(--ws-border-strong)]',
  elevated:  'bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-600/40 light:bg-[var(--ws-surface-overlay)] light:border-[var(--ws-border-strong)]',
  interactive: 'bg-[var(--color-card)] border cursor-pointer hover:-translate-y-0.5 transition-all duration-200 light:bg-white/70 light:border-[var(--ws-border)]',
};

export function GlassCard({ variant = 'default', accent = 'none', className = '', children, onClick }: GlassCardProps) {
  const ac = accent !== 'none' ? accentConfig[accent] : null;

  const borderStyle = ac && (variant === 'notebook' || variant === 'bordered' || variant === 'interactive' || variant === 'elevated')
    ? ac.edge
    : '';

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl p-4 transition-colors duration-200 overflow-hidden ${variantStyles[variant]} ${ac ? `${ac.border} light:${ac.borderLight}` : ''} ${borderStyle} ${className}`}
    >
      {ac && variant !== 'notebook' && variant !== 'bordered' && (
        <>
          <div className={`absolute top-0 left-0 bottom-0 w-0.5 ${ac.rail} light:${ac.railLight}`} />
          <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${ac.bg} light:${ac.bgLight}`} />
        </>
      )}
      <div className="relative z-0 flex flex-col min-h-0 flex-1">
        {children}
      </div>
    </div>
  );
}
