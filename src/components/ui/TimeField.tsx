/**
 * TimeField — stable replacement for the native `<input type="time">`.
 *
 * Why it exists: Chromium's native time input on Linux renders as a janky
 * two-field spinner that swallows keystrokes and mis-opens its dropdown —
 * the "glitchy time selection" on the Schedule page. Two native <select>
 * controls have no such behaviour, so this component keeps the same
 * "HH:MM" wire format (nothing downstream changes) with hour + 5-minute-
 * step dropdowns. If a stored time falls off the 5-minute grid (existing
 * user data), its exact minute is injected into the option list rather
 * than silently snapped, so rendering never rewrites data.
 */

import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface TimeFieldProps {
  /** "HH:MM" (24h). Same format the native input produced. */
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** 'md' (default, 36px) or 'sm' (32px, tight rows like ActivityForm). */
  size?: 'sm' | 'md';
  startAriaLabel?: string;
  endAriaLabel?: string;
}

export function TimeField({ value, onChange, className, size = 'md', startAriaLabel = 'Hour', endAriaLabel = 'Minute' }: TimeFieldProps) {
  const [rawH = '09', rawM = '00'] = (value || '').split(':');
  const h = rawH.padStart(2, '0');
  const m = rawM.padStart(2, '0');
  const hour = HOURS.includes(h) ? h : HOURS[0];
  // Preserve an existing off-grid minute instead of snapping it.
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();

  const selectCls = cn(
    'rounded-lg border border-border bg-background text-foreground px-1.5 py-1',
    size === 'sm' ? 'h-8 min-h-[44px] text-[11px]' : 'h-9 text-[13px]',
    'transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20',
    'cursor-pointer light:bg-white light:border-zinc-200',
  );

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <select
        data-slot="time-field-hour"
        value={hour}
        onChange={e => onChange(`${e.target.value}:${m}`)}
        className={selectCls}
        aria-label={startAriaLabel}
      >
        {HOURS.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <span className="text-[var(--text-muted)] text-xs select-none">:</span>
      <select
        data-slot="time-field-minute"
        value={m}
        onChange={e => onChange(`${hour}:${e.target.value}`)}
        className={selectCls}
        aria-label={endAriaLabel}
      >
        {minutes.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}
