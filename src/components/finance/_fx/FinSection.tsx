import { type ReactNode } from 'react';

/**
 * FinSection — the section label that replaces the four ornament bands.
 *
 * WHAT IT REPLACES: `OverviewTab` drew every section header as a full-bleed
 * hairline with a green-to-transparent gradient on each side, flanking a small
 * uppercase label — four times, each in a DIFFERENT hue (emerald, amber, cyan).
 * That is a decorative chrome gradient (LAMINAR §7.1) AND a two-signal-hue
 * fail (§7.2), and it cost ~108px of vertical budget to announce four labels.
 * The markup is not quoted here on purpose: Tailwind's auto-source scan reads
 * this file's text including comments, so a pasted utility becomes a real rule.
 *
 * WHAT IT IS NOW: a 2px accent rule, a label, and an optional right-hand slot
 * for a control. ~24px instead of ~27px, but more importantly it says the same
 * thing ONCE in the page accent rather than four times in four hues.
 */
interface FinSectionProps {
  title: string;
  /** Right-aligned control or caption — a range toggle, a "view all" link. */
  action?: ReactNode;
  /** Optional one-line explanation. Finance is dense; saying what a number
   *  MEANS is worth more than the number being bigger. */
  hint?: string;
  className?: string;
}

export function FinSection({ title, action, hint, className = '' }: FinSectionProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="fin-rule-accent w-6 shrink-0" aria-hidden="true" />
      <h2 className="fin-eyebrow whitespace-nowrap">{title}</h2>
      {hint && <p className="fin-label truncate hidden sm:block">{hint}</p>}
      <span className="fin-hairline flex-1 min-w-[16px]" aria-hidden="true" />
      {action}
    </div>
  );
}
