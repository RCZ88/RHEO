import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * FinStat — one cell of the ledger's KPI rail.
 *
 * WHY THIS SHAPE: the old Quick Stats row was three hand-written cards that
 * each invented their own label size, hue, padding and number style — which is
 * why three cards side by side never lined up. One primitive means the rail is
 * guaranteed to align, and a fourth tile costs one line.
 *
 * THE MEANING: a ledger reads top-down. Label, then figure, then evidence of
 * which way it moved. `tone` is the ONLY place sign colour is allowed, and it
 * takes a semantic ('pos' | 'neg' | 'flat') rather than a hue — so a caller
 * cannot paint "income" blue by accident.
 */

export type FinTone = 'pos' | 'neg' | 'flat';

interface FinStatProps {
  label: string;
  /** Pre-formatted, already display-currency. This component must NOT convert. */
  value: string;
  /** Optional second line under the figure — units, cadence, a caveat. */
  caption?: string;
  /** Signed delta, pre-formatted. Presence renders the trend row. */
  delta?: { text: string; tone: FinTone };
  icon?: ReactNode;
  /** Rendered right-aligned on the baseline — a Sparkline, usually. */
  aside?: ReactNode;
  tone?: FinTone;
  /** The one card in the rail that answers "what do I have?" */
  emphasis?: boolean;
  /** Magnitude step for the figure. 26 is rail-default; 34 only for net worth. */
  size?: 20 | 26 | 34;
}

const TONE_CLASS: Record<FinTone, string> = {
  pos: 'fin-pos',
  neg: 'fin-neg',
  flat: 'fin-flat',
};

export function FinStat({
  label, value, caption, delta, icon, aside, tone = 'flat', emphasis, size = 26,
}: FinStatProps) {
  return (
    <div
      className={`fin-surface ${emphasis ? 'fin-surface--raised fin-surface--accent' : ''} flex flex-col gap-3 p-5 min-w-0`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="shrink-0 text-[var(--page-accent)]" aria-hidden="true">{icon}</span>}
        <span className="fin-eyebrow truncate">{label}</span>
      </div>

      <div className="flex items-end justify-between gap-3 min-w-0">
        <div className="min-w-0">
          {/* The figure is the loudest thing in the cell. Tabular mono so a
              column of these lines up when scanned. */}
          <p
            className={`fin-figure ${TONE_CLASS[tone]} truncate`}
            style={{ ['--fin-fs' as string]: `${size}px` }}
          >
            {value}
          </p>
          {caption && <p className="fin-label mt-1 truncate">{caption}</p>}
        </div>
        {aside && <div className="shrink-0 pb-0.5">{aside}</div>}
      </div>

      {delta && (
        <div className="flex items-center gap-1.5 -mt-1">
          {/* Direction is carried by an ICON + a signed number, never by colour
              alone (Gate D / impeccable anti-pattern #10). */}
          {delta.tone === 'pos' ? (
            <TrendingUp className="w-3 h-3 fin-pos shrink-0" aria-hidden="true" />
          ) : delta.tone === 'neg' ? (
            <TrendingDown className="w-3 h-3 fin-neg shrink-0" aria-hidden="true" />
          ) : (
            <Minus className="w-3 h-3 text-[var(--text-disabled)] shrink-0" aria-hidden="true" />
          )}
          <span className={`fin-figure ${TONE_CLASS[delta.tone]} text-[12px]`}>{delta.text}</span>
        </div>
      )}
    </div>
  );
}
