/**
 * Progress rail. Structure follows the shadcn registry `progress` item; this
 * vendored copy predates the `data-slot` hooks the registry ships, which meant a
 * caller could not re-skin the indicator at all — the only way to change the fill
 * colour was to edit this shared file and break its other three importers.
 *
 * The hooks are ADDITIVE, so existing usages look exactly as before. New callers
 * target `[data-slot=progress-indicator]` to set the fill from page tokens.
 *
 * Note for whoever owns the other three call sites (finance budget, resume):
 * the default fill is still a hardcoded pink. On a page whose accent is not
 * pink that is a LAMINAR §2 violation, but it is their surface, not this one.
 */
interface ProgressProps {
  value: number;
  className?: string;
  /** Accessible name. Radix-free here, so it is forwarded by hand. */
  'aria-label'?: string;
}

export function Progress({ value, className = '', ...rest }: ProgressProps) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      {...rest}
      className={`h-1 rounded-full bg-zinc-800 overflow-hidden ${className}`}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-pink-500 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transformOrigin: 'left', transform: `scaleX(${Math.min(value, 100) / 100})` }}
      />
    </div>
  );
}
